/**
 * A house's memories come up in conversation as its people's. The owner: *"but remember a sect
 * is its people"*.
 *
 * Played on a pinned world. The house loses its head; then the player talks to three people one
 * at a time: an elder who was on the roll when it happened, somebody the house took on after,
 * and somebody of another house. What reaches the narrator is the card of the one spoken to,
 * and only theirs: what they remember, how they came to know it, and how long ago.
 */
import { describe, expect, it } from 'vitest';

import type { ProviderCallOpts, ProviderCallResult } from '../../src/agent/provider/types';
import { aUniformFor } from '../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house';
import { aDeedEntersTheWorld } from '../../src/engine/world/a-deed-enters-the-world-as-a-fact';
import { makeFact } from '../../src/engine/world/history';
import { isTheWorldsToMove, markDead, type NpcRecord } from '../../src/engine/world/npc-state';
import { whatADeathIsWorth } from '../../src/engine/world/what-a-death-at-this-height-is-worth';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import type { WorldState } from '../../src/engine/world/world-state';
import { thePeopleHere, whatTheyRememberOnTheirCard } from '../../src/web/the-narrator-plays-the-world';
import type { Company } from '../../src/web/facts';
import { makeGameInWorld, ScriptedProvider } from './harness';

const WORLD = 'a-house-remembers-its-dead';
const YEAR = 365;

/** A model that puts every sentence to whoever the test is standing in front of. */
class TalkingToOnePerson extends ScriptedProvider {
    plan = '{"action":"look"}';
    constructor() {
        super({ plans: [], narrations: ['They answer.'] });
    }
    override async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        const system = opts.messages.find(m => m.role === 'system')?.content ?? '';
        if (!system.startsWith('You are the intent router')) return super.call(opts);
        this.calls.push(opts);
        return { text: this.plan, raw: this.plan, durationMs: 0 };
    }
    lastNarrationPrompt(): string {
        const narrations = this.calls.filter(call =>
            !(call.messages.find(m => m.role === 'system')?.content ?? '').startsWith('You are the intent router'));
        return narrations.at(-1)?.messages.find(m => m.role === 'user')?.content ?? '';
    }
}

/** The card of the one spoken to, from the narration prompt. */
function theirCard(prompt: string, name: string): string {
    const from = prompt.indexOf('THE PEOPLE HERE');
    const block = prompt.slice(from, prompt.indexOf('\n\n', from));
    const at = block.split('\n').findIndex(line => line.startsWith('- ') && line.includes(name));
    if (at < 0) return '';
    const rest = block.split('\n').slice(at + 1);
    const end = rest.findIndex(line => line.startsWith('- '));
    return [block.split('\n')[at]!, ...(end < 0 ? rest : rest.slice(0, end))].join('\n');
}

async function aHouseThatLostItsHead() {
    const provider = new TalkingToOnePerson();
    const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'remember', provider });
    const { cultivator } = await h.game.newRun('Shen Wuyou');
    const opened = (await h.game.loadWorld())!.currentDay;

    // Somewhere nobody is standing, for one conversation at a time, and far enough off that
    // getting there takes days: everybody on a roll the day the world opened was robed that day,
    // so somebody robed on arriving has to be robed after it.
    const before = (await h.game.loadWorld())!;
    const empty = before.locations.find(l =>
        l.kind !== 'region' && l.kind !== 'grave' && l.name !== cultivator.location
        && !before.npcs.some(row => row.locationId === l.id)
        && before.locations.filter(other => other.name === l.name).length === 1)!;
    provider.plan = JSON.stringify({ action: 'move', intent: 'travel', target: empty.name });
    for (let leg = 0; leg < 6 && h.game.currentRun().cultivator.location !== empty.name; leg++) {
        await h.game.act(`I travel to ${empty.name}`);
    }
    const world = (await h.game.loadWorld())!;
    expect(world.currentDay, 'the road passed no days').toBeGreaterThan(opened);

    // A house with a head, an elder on its roll, and somebody of another house.
    const alive = (n: NpcRecord) => n.status === 'alive' && isTheWorldsToMove(n);
    let found: { house: WorldState['factions'][number]; head: NpcRecord; elder: NpcRecord } | null = null;
    for (const house of world.factions) {
        const roll = world.npcs.filter(n => alive(n) && n.factionId === house.id);
        const head = roll.find(n => house.ranks.length > 1 && n.factionRankIndex === house.ranks.length - 1);
        const elder = roll.find(n => n.id !== head?.id);
        if (head && elder) { found = { house, head, elder }; break; }
    }
    expect(found, 'the pinned world has a house with a head and somebody under them').not.toBeNull();
    const { house, head, elder } = found!;
    const stranger = world.npcs.find(n => alive(n) && n.factionId !== null && n.factionId !== house.id)!;
    const newcomer = world.npcs.find(n => alive(n) && n.factionId === null && n.relationships.length === 0)!;

    // ARRANGED: the head died two years ago, through the two writes the world's own deaths make.
    const died = world.currentDay - 2 * YEAR;
    const at = world.npcs.findIndex(n => n.id === head.id);
    world.npcs[at] = markDead(head, died, 'Their span ran out.');
    const worth = whatADeathIsWorth(head, house);
    appendWorldFact(world, makeFact({
        day: died, kind: 'death', scale: worth.scale, visibility: worth.visibility,
        actors: [{ id: head.id, name: head.name, role: 'deceased' }],
        locationId: head.locationId, factionIds: [house.id],
        summary: `${head.name} reached the end of their lifespan and died of old age.`
    }), { bystanders: false });

    // And the house took somebody on today, and robed them.
    const n = world.npcs.findIndex(row => row.id === newcomer.id);
    world.npcs[n] = { ...newcomer, factionId: house.id, factionRankIndex: 0 };
    world.objects.push(aUniformFor({
        memberId: newcomer.id, houseId: house.id, houseName: house.name, onDay: world.currentDay
    }));

    // Wherever the road left them, they stand there now, alone.
    h.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(empty.name, cultivator.id);
    h.game.repos.cultivators.standIn(cultivator.id, null);
    for (const row of world.npcs) if (row.locationId === empty.id) row.locationId = null;
    h.game.theWorldMoved();

    /** Put this one person, and nobody else, where the player is standing. */
    const standHere = (person: NpcRecord): void => {
        for (const row of world.npcs) if (row.locationId === empty.id) row.locationId = null;
        const i = world.npcs.findIndex(row => row.id === person.id);
        world.npcs[i] = { ...world.npcs[i]!, locationId: empty.id, activity: null };
    };

    /** Put this one person in front of the player, known by name, and ask about their house. */
    const talkTo = async (person: NpcRecord): Promise<string> => {
        standHere(person);
        h.game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'cultivator', id: person.id, name: person.name,
            onDay: Math.floor(world.currentDay), sourceKind: 'witnessed', stage: 'encountered'
        });
        h.game.theWorldMoved();
        provider.plan = JSON.stringify({ action: 'interact', intent: 'talk', target: person.name, topic: 'your house' });
        await h.game.act(`${person.name}, tell me about your house`);
        return theirCard(provider.lastNarrationPrompt(), person.name);
    };

    return { ...h, provider, world, cultivator, house, head, elder, stranger, newcomer, empty, standHere, talkTo };
}

describe('somebody remembers what their house went through', () => {
    it('lived by a member who was there, told to one taken on after, and nothing to a stranger', async () => {
        const at = await aHouseThatLostItsHead();

        const elder = await at.talkTo(at.elder);
        expect(elder, 'the elder was not the one spoken to').toContain('(THE PLAYER IS SPEAKING TO THEM)');
        expect(elder).toContain('What they remember');
        expect(elder).toMatch(/lived through it, 2 years ago: The head of their house died; their span ran out\./);

        const newcomer = await at.talkTo(at.newcomer);
        expect(newcomer).toMatch(
            /told it by their house, 2 years ago, before they were on the roll: The head of their house died; their span ran out\./);

        const stranger = await at.talkTo(at.stranger);
        expect(stranger).toContain('(THE PLAYER IS SPEAKING TO THEM)');
        expect(stranger).not.toMatch(/head of (their|another) house died/);
        expect(stranger).not.toContain(at.head.name);
    }, 300_000);

    /** It runs both ways: what the player did in front of somebody, they remember. */
    it('remembers what the player did in front of them', async () => {
        const at = await aHouseThatLostItsHead();
        const day = Math.floor(at.world.currentDay);
        // ARRANGED: they are standing there when the player says it, and nobody else is.
        at.standHere(at.stranger);
        const deed = aDeedEntersTheWorld(at.world, {
            kind: 'said_in_public', weight: 'slight', workedOut: true, day,
            locationId: at.empty.id,
            actors: [{ id: at.cultivator.id, name: at.cultivator.name, role: 'said it' }],
            summary: `${at.cultivator.name} swore in front of the shrine to find the one who burned it.`,
            unattributed: 'Somebody swore an oath in front of a burned shrine.'
        });
        expect(deed.fact.witnessIds, 'nobody was drawn as standing there').toContain(at.stranger.id);
        const card = await at.talkTo(at.stranger);
        expect(card).toContain('lived through it, this year, and the player was in it: '
            + 'The player swore in front of the shrine to find the one who burned it.');
    }, 300_000);
});

/** The card itself: the one spoken to carries it, and a name the player lacks is not on it. */
describe('what somebody remembers, on their card', () => {
    const remembered = [{
        what: 'Wen Zhao was killed by Gu Lan', how: 'lived' as const, toldBy: null, beforeTheyJoined: false,
        yearsAgo: 12, itWasTheir: 'their master', withThePlayer: false, keptToThemselves: false,
        named: [
            { id: 'npc-wen', name: 'Wen Zhao', otherwise: 'their master' },
            { id: 'npc-gu', name: 'Gu Lan', otherwise: 'somebody of another house' }
        ]
    }];

    it('says each person in it the way this one would, where the player has no name for them', () => {
        expect(whatTheyRememberOnTheirCard(remembered, id => id === 'npc-gu')).toEqual([
            'lived through it, 12 years ago, and it was their master: Their master was killed by Gu Lan.'
        ]);
        expect(whatTheyRememberOnTheirCard(remembered, () => false)[0])
            .toContain('Their master was killed by somebody of another house.');
    });

    it('is on the card of the one spoken to and nobody else', () => {
        const lines = whatTheyRememberOnTheirCard(remembered, () => true);
        const person = (name: string) => ({
            name, ordinal: 5, sex: 'man', age: 60, rank: null, at: null, looksUp: true, playsToTheRoom: 0,
            withNames: [], like: null, chewing: null, remembers: lines
        });
        const company = { named: [person('Old Gu'), person('Young Mo')], strangers: [], total: 2 } as unknown as Company;
        const said = thePeopleHere(company, 5, [], 'Old Gu').join('\n');
        expect(said.match(/What they remember/g)).toHaveLength(1);
        expect(theirCard(`${said}\n\n`, 'Old Gu')).toContain('Wen Zhao was killed by Gu Lan');
        expect(thePeopleHere(company, 5, [], null).join('\n')).not.toContain('What they remember');
    });
});
