/**
 * Somebody is already working this ground, and the player is told to get off it.
 *
 * The owner: *"they tell the guy to f*** off out of their ruin or dao ground, he
 * says yes or no, if no then fight"*, and *"I mean even an unowned ruin"*.
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * The rule, with nothing to say it. `being-told-to-get-off-this-ground.ts`
 * decides who speaks, whether anybody speaks at all, and what refusing looks
 * like off the same distribution the world's own year draws from - and no
 * sentence and no arrival reached any of it. A player could walk onto a ruin
 * three people were working and be told nothing.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   walking onto worked ground is told, by name, with what refusing would look
 *   like said BEFORE it is answered - which is the agency rule's own shape
 *   going is the ordinary walk, and what it leaves is the slight the engine
 *   names, held by the one who was sent away
 *   refusing hands off to the ordinary confrontation, and nothing is refused by
 *   rule
 *   nobody says anything to somebody four rungs above them
 *
 * OFFERING THEM SOMETHING IS NOT PINNED HERE, and that is the finding rather
 * than a gap: "I offer Hu Lan a share" is already an attempt to move a person
 * and already goes through `resolveAttempt` by the ordinary road, so there is
 * nothing in this scene for it to reach. What the scene owes it is the
 * SPEAKER'S NAME, which the demand carries, and that is asserted.
 *
 * Red-checked: with the arrival half of the hook dropped, the arrival test goes
 * red; with the slight not written, the going test goes red; with the refusal
 * branch dropped from the `refuse` dispatch, the refusing test goes red.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import {
    theDemandOnThisGround,
    settleWhoIsAlreadyOnThisGround
} from '../../src/web/somebody-tells-you-to-get-off-this-ground.js';
import { WHAT_MAKES_THEM_THINK_BETTER_OF_IT } from '../../src/engine/encounters/being-told-to-get-off-this-ground.js';
import { theirHeight } from '../../src/engine/world/why-one-cultivator-kills-another.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { setLocation } from '../../src/engine/world/npc-state.js';

const WORLD = 'somebody-is-here-first';

/** Ground of the kind people work, with two of them on it, in reach of the player. */
async function groundSomebodyIsWorking(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Arrival');
    await harness.game.act('I look around');
    const world = harness.game.atHand!;
    const today = Math.floor(world.currentDay);
    const from = harness.repos.cultivators.getById(cultivator.id)!;
    const here = harness.game.worldPlaceOf(from);
    const province = world.locations.find(l => l.id === here)?.parentId ?? null;

    const ground = world.locations.find(l =>
        (l.kind === 'ruin' || l.kind === 'cave' || l.kind === 'grave' || l.kind === 'secret_realm')
        && l.parentId === province);
    if (!ground) throw new Error('no worked ground in this province');

    // Two of the world's people on it, at work and not going anywhere.
    const working = world.npcs
        .filter(n => n.status === 'alive' && n.cultivation.realmOrdinal >= from.realmOrdinal)
        .slice(0, 2);
    if (working.length < 2) throw new Error('not two people in this world to work it');
    for (const npc of working) {
        const at = world.npcs.findIndex(n => n.id === npc.id);
        world.npcs[at] = {
            ...setLocation(world.npcs[at]!, ground.id, today),
            activity: {
                kind: 'out_with_a_party',
                note: `Working ${ground.name}.`,
                withIds: [],
                sinceDay: today,
                untilDay: today + 3650,
                returnTo: null
            }
        };
    }
    // The road to it, which is what a player has when somebody has told them.
    harness.game.knowledge.learnIfNew({
        holderId: cultivator.id,
        kind: 'place',
        id: ground.name,
        name: ground.name,
        onDay: Math.floor(harness.game.currentRun().run.elapsedDays),
        sourceKind: 'told',
        sourceNote: 'Somebody said where it was.',
        stage: 'known',
        statement: `${ground.name} is out there.`
    });
    return { ...harness, cultivator, world, ground, working, startedAt: from.location! };
}

/** Standing on it, which is where the three answers are answered from. */
function standOnIt(h: Awaited<ReturnType<typeof groundSomebodyIsWorking>>) {
    h.repos.cultivators.update(h.cultivator.id, { location: h.ground.name });
    return h.repos.cultivators.getById(h.cultivator.id)!;
}

describe('the demand', () => {
    it('stands where people are working the ground, and names who speaks', async () => {
        const h = await groundSomebodyIsWorking('ground-demand-stands');
        const standing = theDemandOnThisGround(h.game, standOnIt(h));

        expect(standing, 'nobody told the arrival anything').not.toBeNull();
        expect(h.working.map(n => n.id)).toContain(standing!.demand.saidBy.id);
        expect(standing!.demand.theirSide).toHaveLength(2);
        // What refusing would look like, said off the world's own distribution.
        expect(standing!.refusing.line).toMatch(/times in a hundred/);
    }, 120_000);

    it('says nothing to somebody four rungs above them', async () => {
        const h = await groundSomebodyIsWorking('ground-nobody-speaks');
        // Their HEIGHT, which is what the rule reads: two of them stand higher
        // together than either does alone, and the engine's own function says
        // by how much.
        const them = theirHeight(h.working.map(n => ({ cultivation: { realmOrdinal: n.cultivation.realmOrdinal } })));
        h.repos.cultivators.update(h.cultivator.id, {
            location: h.ground.name,
            realmOrdinal: Math.ceil(them) + WHAT_MAKES_THEM_THINK_BETTER_OF_IT
        });

        const standing = theDemandOnThisGround(
            h.game, h.repos.cultivators.getById(h.cultivator.id)!
        );

        expect(standing, 'somebody told a cultivator four rungs above them to leave').toBeNull();
    }, 120_000);

    it('reaches the player as something said, with the three answers', async () => {
        const h = await groundSomebodyIsWorking('ground-demand-arrives');
        // Coming from somewhere nobody is standing, so what is said is about
        // arriving rather than about what was left behind.
        const empty = h.world.locations.find(l => l.kind === 'settlement'
            && !h.world.npcs.some(n => n.locationId === l.id));
        const before = {
            ...h.repos.cultivators.getById(h.cultivator.id)!,
            location: empty?.name ?? 'the open road'
        };
        const said = settleWhoIsAlreadyOnThisGround(h.game, before, standOnIt(h));

        expect(said, 'walking onto it said nothing').not.toBeNull();
        const spoken = said!.lines.join(' ');
        const speaker = theDemandOnThisGround(h.game, h.repos.cultivators.getById(h.cultivator.id)!)!;
        expect(spoken).toContain(speaker.demand.saidBy.name);
        expect(spoken).toContain(h.ground.name);
        expect(spoken.toLowerCase()).toContain('you can go');
        expect(spoken.toLowerCase()).toContain('tell them no');
    }, 120_000);
});

describe('the three answers', () => {
    it('refusing hands off to the confrontation rather than being refused', async () => {
        const h = await groundSomebodyIsWorking('ground-refused');
        standOnIt(h);

        expect(parseIntent('I refuse')).toMatchObject({ action: 'sect', intent: 'refuse' });
        const turn = await h.game.act('I refuse');

        // Not "nothing is being asked of you": something is, and it is not the house's.
        expect(turn.narration.toLowerCase()).not.toContain('nothing is being asked of you');
        expect(turn.toolCalls.some(call => call.action === 'attack'), 'no confrontation opened').toBe(true);
    }, 180_000);

    it('going leaves the slight and nothing else', async () => {
        const h = await groundSomebodyIsWorking('ground-went');
        standOnIt(h);
        const before = ledgerAbout(h.db as never, h.cultivator.id).length;

        const turn = await h.game.act(`I travel to ${h.startedAt}`);

        expect(h.repos.cultivators.getById(h.cultivator.id)!.location).toBe(h.startedAt);
        const held = ledgerAbout(h.db as never, h.cultivator.id)
            .filter(row => row.tags.includes('told_to_leave'));
        expect(held, 'no slight was written').toHaveLength(1);
        expect(held[0]!.holderId, 'the one sent away holds it').toBe(h.cultivator.id);
        expect(held[0]!.severity).toBe('slight');
        expect(ledgerAbout(h.db as never, h.cultivator.id).length).toBe(before + 1);
        expect(turn.narration).toContain(h.ground.name);
    }, 180_000);

    it('and putting something to them is the ordinary attempt, by name', async () => {
        const h = await groundSomebodyIsWorking('ground-offered');
        const standing = theDemandOnThisGround(h.game, standOnIt(h))!;
        const plan = parseIntent(`I offer ${standing.demand.saidBy.name} a share of what is here`);
        expect(plan.action).toBe('interact');
        expect(plan.target).toBe(standing.demand.saidBy.name);
    }, 120_000);
});
