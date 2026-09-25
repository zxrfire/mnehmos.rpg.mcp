/**
 * Nobody joins a house out of thin air.
 *
 * The design owner: *"How is that possible? Houses hold selection ceremonies at
 * their sect grounds too. They aren't open 365 days a year. They send people out
 * looking for seedlings, and open up recruitment once every x years."*
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `I join the X` put the player on X's roll from wherever they stood, on any day,
 * with nobody of X there - so nobody took them on, nobody told the house, and a
 * gate that lets somebody new in on the word of who took them on had nobody to
 * name.
 *
 * ── WHAT THIS PINS, PLAYED ───────────────────────────────────────────────
 *
 * With nobody taking people on where they stand, the join is refused and the
 * refusal says when and where the house next does. At the intake the house's
 * paper named, waited for, they are taken on - by somebody of the house, who
 * owes it a report, and whose name the player now knows. And somebody out looking
 * for disciples, standing beside them, takes them on in person.
 *
 * The recruiter beside them is arranged - an errand of the house moved onto
 * the player's ground - which `AGENTS.md` permits; the wall, the wait and the join
 * are played.
 *
 * The two joins that are taken are forced (`ADMIN sect join`), which lands the
 * house's look and nothing else: the road to being looked at is still checked.
 *
 * Red-checked by passing no `nobodyIsTakingPeopleOnHere` to `handleJoin`: the
 * refusal test goes red. And by dropping the in-person road in
 * `whoIsTakingPeopleOnHere`: the recruiter-beside-them test goes red.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { theReportsTheyOwe } from '../../src/engine/world/a-house-expects-somebody-it-took-on.js';
import { SENDING_REASONS } from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { getSect } from '../../src/data/cultivation/sects.js';

/** The played world the wall-and-wait test already pins: a dated intake is up at Wind Turn. */
const WORLD = 'a-xianxia-run';
const PLAYED = 'xianxia';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

type Game = Awaited<ReturnType<typeof makeGameInWorld>>['game'];
type Repos = Awaited<ReturnType<typeof makeGameInWorld>>['repos'];

/** The intakes on this wall, read off the engine's own words for them. */
async function whatIsPosted(game: Game): Promise<{ house: string; inDays: number }[]> {
    const said = (await game.act('what is posted here')).narration ?? '';
    return [...said.matchAll(/^(.+?) is holding an intake at .+? in (\d+) days/gm)]
        .map(row => ({ house: row[1]!, inDays: Number(row[2]) }));
}

/** A house on the wall this cultivator clears the bar of, by its catalog row. */
function aHouseTheyClear(repos: Repos, cultivatorId: string, names: readonly string[]) {
    const ordinal = repos.cultivators.getById(cultivatorId)!.realmOrdinal;
    for (const name of names) {
        const sect = repos.sects.list().find(s => s.name === name);
        if (sect && (getSect(sect.id)?.admissionOrdinal ?? Infinity) <= ordinal) return sect;
    }
    return null;
}

describe('nobody joins a house out of thin air', () => {
    it('refuses a join with nobody taking people on, and says when and where the house next does', async () => {
        const { game, repos, db } = await makeGameInWorld({ seed: PLAYED, worldSeed: WORLD });
        const { cultivator } = await game.newRun('Shen Wuyou');
        const posted = await whatIsPosted(game);
        const house = aHouseTheyClear(repos, cultivator.id, posted.map(p => p.house))
            ?? repos.sects.list().find(s => new KnowledgeGate(db).isAwareOf(cultivator.id, 'sect', s.id)
                && (getSect(s.id)?.admissionOrdinal ?? Infinity) <= cultivator.realmOrdinal);
        expect(house, 'this run knows no house it clears the bar of').toBeTruthy();

        const said = (await game.act(`I join the ${house!.name}`)).narration ?? '';
        expect(repos.sects.getMembership(cultivator.id), 'joined on a day nobody was taking anybody on').toBeNull();
        expect(said, said).toContain(`Nobody of ${house!.name} is taking anybody on here today.`);
        expect(said, said).toMatch(/opens its grounds at .+ in \d+ days|holds intakes in towns|looking for disciples/);
    }, 300_000);

    it('takes them on at the intake its paper named, once they have waited for it', async () => {
        const { game, repos } = await makeGameInWorld({ seed: PLAYED, worldSeed: WORLD });
        const { cultivator } = await game.newRun('Shen Wuyou');
        const posted = await whatIsPosted(game);
        const house = aHouseTheyClear(repos, cultivator.id, posted.map(p => p.house));
        expect(house, 'no intake on this wall is one the run clears the bar of').toBeTruthy();

        await game.act(`I wait until the ${house!.name} intake`);
        // FORCED, because the house still weighs whoever turns up: being at the
        // intake is the road to being looked at, and the look is a roll.
        const said = (await game.act(`ADMIN sect join the ${house!.name}`)).narration ?? '';
        expect(said, said).not.toContain('is taking anybody on here today');
        expect(repos.sects.getMembership(cultivator.id)?.sectId, said).toBe(house!.id);
        const took = said.match(/(.+?) took you on for .+ at its intake/m);
        expect(took, said).not.toBeNull();

        // Whoever took them on owes the house word of it, and the player knows who.
        const world = game.atHand!;
        const recruiter = world.npcs.find(n => theReportsTheyOwe(n).some(r => r.personId === cultivator.id))
            ?? world.npcs.find(n => n.factionId === house!.id && took![0].includes(n.name));
        expect(recruiter, 'nobody of the house took them on').toBeTruthy();
        expect(game.knowledge.isAwareOf(cultivator.id, 'cultivator', recruiter!.id)).toBe(true);
    }, 300_000);

    it('takes them on in person, by somebody of the house out looking for disciples beside them', async () => {
        const { game, repos } = await makeGameInWorld({ seed: PLAYED, worldSeed: WORLD });
        const { cultivator } = await game.newRun('Shen Wuyou');
        const world = (await game.loadWorld())!;
        const here = game.worldPlaceOf(repos.cultivators.getById(cultivator.id)!);
        expect(here, 'the run stands nowhere in the world').not.toBeNull();

        // ARRANGED: somebody of a house the player clears, out looking for
        // disciples, on the player's ground.
        const recruiting = SENDING_REASONS.find(r => r.id === 'sending-to-recruit')!.name.toLowerCase();
        const at = world.npcs.findIndex(n => n.status === 'alive' && n.factionId !== null
            && (getSect(n.factionId)?.admissionOrdinal ?? Infinity) <= cultivator.realmOrdinal
            && getSect(n.factionId)?.recruits === true
            && n.factionRankIndex >= 1);
        expect(at, 'nobody in this world is of a house the run clears').toBeGreaterThanOrEqual(0);
        const npc = world.npcs[at]!;
        const house = world.factions.find(f => f.id === npc.factionId)!;
        world.npcs[at] = {
            ...npc,
            locationId: here,
            activity: {
                kind: 'out_with_a_party', note: `Out for the ${house.name} on ${recruiting}.`, withIds: [],
                sinceDay: Math.floor(world.currentDay), untilDay: Math.floor(world.currentDay) + 150,
                returnTo: npc.locationId
            }
        };
        game.theWorldMoved();
        // Beside them: in the area of the place the recruiter is read into, three at most to one.
        await standWhereThePeopleAre({ game, repos }, cultivator.id, new Set([npc.id]));
        game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'sect', id: house.id, name: house.name,
            onDay: 0, sourceKind: 'told', stage: 'named'
        });

        const said = (await game.act(`ADMIN sect join the ${house.name}`)).narration ?? '';
        expect(said, said).not.toContain('is taking anybody on here today');
        expect(repos.sects.getMembership(cultivator.id)?.sectId, said).toBe(house.id);
        expect(said, said).toContain(`${npc.name} took you on for ${house.name} in person`);
        const recruiter = game.atHand!.npcs.find(n => n.id === npc.id)!;
        expect(theReportsTheyOwe(recruiter).map(r => r.personId)).toContain(cultivator.id);
    }, 300_000);
});
