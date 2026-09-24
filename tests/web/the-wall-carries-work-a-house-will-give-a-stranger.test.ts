/**
 * A rogue reads a wall, and comes away with work and a name.
 *
 * THE DEFECT THIS IS THE PLAYED HALF OF. Everything a house could publish
 * outward was an intake, and only the houses at the bottom of the field posted
 * one. So somebody with no house standing in a market town could read that
 * three failing houses would hear them, and that was the entire public face of
 * a world of thirty-six. The duty board inside a compound answered the same way
 * from the other side: `[]` to anybody not on the roll.
 *
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING.
 * The board inside is still shut - nothing here puts anybody on a roll, and the
 * notices say so in as many words. What changed is that the wall outside now
 * carries what a house wants from people who are not its own, which is where a
 * rogue's first job comes from in this genre.
 *
 * Measured on the shipped catalog while writing this: 36 houses have at least
 * one ask, 55 asks in all, and a city wall that used to carry three intakes
 * from the three weakest houses now also carries work and a warning from houses
 * that would never hear an application.
 *
 * The two claims held down here are the two halves of "reachable":
 *
 *   IT ARRIVES BY TYPING A SENTENCE ANYBODY WOULD TYPE. Not through a new verb.
 *   `what is posted here` already existed and already read the wall.
 *
 *   AND IT CAN BE ACTED ON. A name off a notice is a name the engine will
 *   accept in the next sentence. The failure this replaces is on the record in
 *   `what-is-posted-on-the-wall-here.ts`: a house printed on the screen, and
 *   *"you have said a name and it is not one anybody has said to you"* one turn
 *   later, because nothing had written it down.
 */

import { describe, it, expect } from 'vitest';
import { theHouseLosesTrackOf } from '../../src/engine/world/who-a-house-has-lost-track-of.js';
import { makeGame } from './harness.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import {
    housesWithSomethingToSay,
    openDoorsInTheWorld,
    postingGroundOf,
    whoEachHouseIsLookingFor
} from '../../src/web/what-is-posted-on-the-wall-here.js';
import { housesThatHaveToAdvertise } from '../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import {
    WHEN_SILENCE_BECOMES_A_CAPTIVE,
    carriesATokenAt,
    lampsAreLitAt
} from '../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { REGIONS } from '../../src/data/cultivation/regions.js';

/**
 * The house loses track of somebody a season and more ago. What a house does not
 * know is held on the house (`who-a-house-has-lost-track-of.ts`); it used to be
 * read off a clock on the person, `lastConfirmedOnDay`.
 */
function loseTrackOf(state: import('../../src/engine/world/world-state.js').WorldState, gone: { id: string; factionId: string | null }): void {
    const at = state.factions.findIndex(f => f.id === gone.factionId);
    state.factions[at] = theHouseLosesTrackOf(state.factions[at]!, gone.id,
        state.currentDay - (WHEN_SILENCE_BECOMES_A_CAPTIVE + 5));
}

/** Every city on the map, which is where a wall carries the most paper. */
const CITIES = REGIONS.flatMap(r => r.places).filter(p => p.kind === 'city').map(p => p.name);

async function standingIn(where: string) {
    const { db, game } = makeGame();
    const { cultivator } = await game.newRun('Reader');
    db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(where, cultivator.id);
    return { db, game, cultivatorId: cultivator.id, gate: new KnowledgeGate(db) };
}

/** Names a wall put into this player's world off a notice rather than an intake. */
function offANotice(gate: KnowledgeGate, holderId: string) {
    return gate.awareness(holderId, 'sect').filter(r => r.sourceNote.includes('A notice posted at'));
}

describe('the wall carries work a house will give a stranger', () => {
    it('names houses the intake channel could never have named', async () => {
        const advertisers = new Set(
            housesThatHaveToAdvertise(openDoorsInTheWorld()).map(h => h.id)
        );

        // Every city, because which houses reach which wall is a province
        // question and a single town proves only that one town works.
        const found: string[] = [];
        for (const city of CITIES) {
            const { game, cultivatorId, gate } = await standingIn(city);
            await game.act('what is posted here');
            for (const row of offANotice(gate, cultivatorId)) {
                expect(row.sourceKind).toBe('read');
                expect(row.stage).toBe('placed');
                if (!advertisers.has(row.id)) found.push(row.id);
            }
        }

        expect(found.length, 'no wall in any city named a house outside the intake field')
            .toBeGreaterThan(0);
    });

    /**
     * The refusal that is content rather than a blank. The notice states the
     * work AND states that taking it is not a way onto the roll, which is the
     * three things a good refusal carries said before anybody was refused.
     */
    it('says what the work is and that it does not buy a place in the house', async () => {
        const { game } = await standingIn(CITIES[0]!);
        const answer = await game.act('what is posted here');
        const said = JSON.stringify(answer);
        expect(said).toContain('is not asking whose disciple you are');
        expect(said).toContain('not a place on the roll');
    });

    /**
     * ACTING ON IT. The name goes in, so the next sentence reaches the house
     * rather than the engine's ignorance of it.
     */
    it('leaves the player holding a name the next sentence can use', async () => {
        for (const city of CITIES) {
            const { game, cultivatorId, gate } = await standingIn(city);
            await game.act('what is posted here');
            const named = offANotice(gate, cultivatorId)[0];
            if (!named) continue;

            expect(gate.canPointAt(cultivatorId, 'sect', named.id)).toBe(true);
            const answer = await game.act(`I join the ${named.name}`);
            expect(JSON.stringify(answer), `${named.name} was printed and then not known`)
                .not.toContain('not one anybody has said to you');
            return;
        }
        throw new Error('no city wall carried a notice at all');
    });
});

describe('what a house is asking after comes off its own lamps', () => {
    /**
     * The gate is the HOUSE'S. With no world there is no roll, so nobody is
     * missing and no search is posted - which is the honest reading rather than
     * a convenient empty list, and it is why the map is taken as an argument.
     */
    it('asks after nobody when there is no roll to read', () => {
        expect(whoEachHouseIsLookingFor(null).size).toBe(0);
        expect(housesWithSomethingToSay(new Map()).every(h =>
            h.asks.every(ask => ask.kind !== 'missing'))).toBe(true);
    });

    /**
     * The lamp read against a real roll.
     *
     * Measured on a seeded world: 606 people, 2 of them unseen for a season at
     * the moment it is made, and NOT ONE search posted - because neither is on
     * a roll at a rung a lamp was lit for. Stop seeing one disciple who has a
     * lamp and their house is asking after them by name the next time anybody
     * reads a wall.
     */
    it('asks after somebody the world has stopped seeing', async () => {
        const state = seedWorld({
            seed: 'a-house-comes-looking', catalog: await loadCultivationCatalog()
        }).state;
        expect(whoEachHouseIsLookingFor(state).size, 'somebody was already missing').toBe(0);

        const gone = state.npcs.find(npc =>
            npc.status === 'alive' && npc.factionId && carriesATokenAt(npc.factionRankIndex))!;
        loseTrackOf(state, gone);

        const asks = whoEachHouseIsLookingFor(state).get(gone.factionId!);
        expect(asks).toHaveLength(1);
        expect(asks![0]).toMatchObject({ kind: 'missing', who: gone.name });
    });

    /**
     * AND THE GATE IS THE LAMP IN THE HALL. A house that never lit one for
     * somebody is not told they are gone, so it posts no search - the
     * difference between a house and a gathering of people, arriving without a
     * rule written for it.
     *
     * This arm used to arrange it by dropping every member of the house under
     * the rung a lamp is lit at, AFTER world open had lit theirs, and assert no
     * search. That was the hall inferring its lamps from who could light one today,
     * which `a-house-reads-its-own-roll-off-the-lamps.test.ts` records being
     * replaced by reading the lamp rows. The two situations are now two arms.
     */
    it('posts no search for somebody the house never light a lamp for', async () => {
        const state = seedWorld({
            seed: 'a-house-comes-looking', catalog: await loadCultivationCatalog()
        }).state;
        const gone = state.npcs.find(npc =>
            npc.status === 'alive' && npc.factionId && carriesATokenAt(npc.factionRankIndex))!;
        loseTrackOf(state, gone);

        // A hall with nothing burning in it: the house never lit a lamp for anybody.
        state.objects = state.objects.filter(o =>
            !(o.ownerId === gone.factionId && o.tags.includes('life-lamp')));
        expect(whoEachHouseIsLookingFor(state).get(gone.factionId!)).toBeUndefined();
    });

    it('but a house that has lost everybody who could light one still reads the lamps it lit', async () => {
        const state = seedWorld({
            seed: 'a-house-comes-looking', catalog: await loadCultivationCatalog()
        }).state;
        const gone = state.npcs.find(npc =>
            npc.status === 'alive' && npc.factionId && carriesATokenAt(npc.factionRankIndex))!;
        loseTrackOf(state, gone);

        // Everybody on that roll drops under the rung a lamp is lit at, which
        // is the state the world sim reaches by killing a house's elders. The
        // lamp lit before that is still burning.
        for (const npc of state.npcs) {
            if (npc.factionId !== gone.factionId) continue;
            npc.cultivation = { ...npc.cultivation, realmOrdinal: lampsAreLitAt() - 1 };
        }
        const asks = whoEachHouseIsLookingFor(state).get(gone.factionId!);
        expect(asks).toHaveLength(1);
        expect(asks![0]).toMatchObject({ kind: 'missing', who: gone.name });
    });

    /** And a search reaches the wall as an ask like any other once it exists. */
    it('carries a search as a notice when the hall has one to post', () => {
        // The house is read out of the catalog rather than named: any house
        // the game prints is a house this has to work for.
        const anyHouse = housesWithSomethingToSay()[0]!.id;
        const houses = housesWithSomethingToSay(new Map([
            [anyHouse, [{ kind: 'missing' as const, who: 'Mo Qingzhi', unseenForDays: 120, wants: 'them' as const }]]
        ]));
        const asking = houses.find(h => h.id === anyHouse);
        expect(asking?.asks.some(ask => ask.kind === 'missing')).toBe(true);
    });
});

describe('a wall is still a wall', () => {
    it('carries nothing where there is no paper', async () => {
        const hamlet = REGIONS.flatMap(r => r.places).find(p => p.kind === 'hamlet')!.name;
        const { game } = await standingIn(hamlet);
        expect(postingGroundOf(hamlet)).toBe('hamlet');
        const answer = await game.act('what is posted here');
        expect(JSON.stringify(answer)).toContain('Nothing is posted here');
    });
});
