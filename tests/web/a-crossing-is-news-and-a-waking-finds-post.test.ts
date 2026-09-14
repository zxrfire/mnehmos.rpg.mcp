/**
 * Played: crossing a realm is news, and coming out of a sitting finds what came.
 *
 * Two seams that were wired at one end only, both reachable by typing a sentence.
 *
 * A BREAKTHROUGH FILED NOTHING. `aDeedEntersTheWorld` is reached from fights and
 * from sites and was never reached from the crossing path, so `I break through`
 * moved the sheet and appended no row to `state.history.facts` - the only table
 * `circulating`, `retell` and `buildPlayerDigest` read. A player crossed a realm
 * and nobody ever heard. It is now filed from both doors onto the same ladder:
 * the wall struck on command, and the wall crossed inside a sitting.
 *
 * A WAKING FOUND NOTHING. The unheard half of every span goes onto
 * `pendingArrivals` and only ever came back as an interruption during a LATER
 * sitting, so there was no coming out to a stack of post. Measured on a one-year
 * sitting: "nothing reached this cultivator. 166 event(s) passed unheard."
 *
 * The second test here is the half that must NOT change. Delivery is gated on
 * standing, and a rogue with no house, no office and nobody answering to them
 * gets nothing - the silence is the ruling rather than the defect, and a test
 * that only proved post arrives would have let somebody quietly soften it.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { circulating, regionOf } from '../../src/engine/world/what-people-are-saying';
import { howMuchWouldBeDeliveredTo } from '../../src/engine/world/digest';
import { positionIn } from '../../src/web/standing';
import type { HistoricalFact } from '../../src/engine/world/history';
import type { NpcRecord } from '../../src/engine/world/npc-state';
import type { WorldState } from '../../src/engine/world/world-state';

const WORLD = 'a-crossing-is-news';

/** The rung below the Foundation Establishment wall. */
const QI_CONDENSATION_TOP = 12;

/** Everything this person could repeat, uncapped, so the cut is not the limit. */
function inTheAirFor(world: WorldState, npc: NpcRecord): string[] {
    return circulating(world, {
        id: npc.id,
        name: npc.name,
        realmOrdinal: npc.cultivation.realmOrdinal,
        locationId: npc.locationId,
        regionId: regionOf(world, npc.locationId),
        factionId: npc.factionId ?? null
    }, world.currentDay, 5_000).map(fact => fact.id);
}

function crossingsNaming(facts: readonly HistoricalFact[], id: string): HistoricalFact[] {
    return facts.filter(f =>
        f.kind === 'realm_crossing' && f.actors.some(a => a.id === id));
}

describe('the world hears about a wall going down', () => {
    it('files a row when the barrier is struck on command', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'struck' });
        await h.game.newRun('Climber');
        // The world is loaded by an ordinary turn, and every write below needs
        // it: nothing is filed against a world that was never opened.
        await h.game.act('I look around');

        const id = h.game.state().cultivator.id;
        h.repos.cultivators.update(id, {
            realmOrdinal: QI_CONDENSATION_TOP, cultivationProgress: 100_000
        } as never);

        // A crossing can fail, and a failure costs nothing but a turn. Struck
        // until one lands, which is what a player does. `crossed` is asserted at
        // the end so the test cannot pass by never having got through a wall.
        let crossed = false;
        for (let attempt = 0; attempt < 40 && !crossed; attempt++) {
            const before = h.game.state().cultivator.realmOrdinal;
            await h.game.act('I break through');
            const after = h.game.state().cultivator;
            if (!after.alive) break;
            if (after.realmOrdinal <= before) continue;
            crossed = true;

            const world = await h.game.loadWorld();
            expect(world).not.toBeNull();
            const filed = crossingsNaming(world!.history.facts, id);
            expect(filed.length, 'the world holds the crossing').toBeGreaterThan(0);

            const row = filed[filed.length - 1];
            expect(Number(row.data.crossedIntoOrdinal)).toBe(after.realmOrdinal);
            // Authored, so a stranger who cannot name them is not handed a shrug.
            expect(String(row.data.unattributed)).not.toContain(after.name);

            // AND IT IS IN THE AIR WHERE IT HAPPENED AND NOT A PROVINCE AWAY,
            // which is the ruling: a Foundation Establishment crossing spreads
            // among the people near that rung and stays local. Asserted on the
            // pool rather than on `whatTheySay`'s top three - whether a quiet
            // crossing outranks a millennium of wars for a market's three slots
            // is a different question from whether it reached the street.
            // SOMEBODY ON THE STREET WHO WAS NOT NAMED IN IT - or nobody,
            // honestly, because `BYSTANDERS_AT_MOST` is 6 and a quiet square
            // puts every living body on the witness list with no remainder to
            // find. That used to be rare and is not any more: the world sends
            // parties out to a door when one opens, so squares empty.
            //
            // BOTH BRANCHES ARE THE SAME FACT and both are asserted. The
            // province is NOT an acceptable substitute here and trying it was
            // instructive: a crossing at this rung is `local`, so somebody a
            // street over in the same province genuinely does not have it in
            // the air, which is the ruling working rather than the test
            // failing.
            const hereRegion = regionOf(world!, row.locationId);
            const atTheSquare = world!.npcs.filter(npc =>
                npc.status === 'alive' && npc.id !== id && npc.locationId === row.locationId);
            const here = atTheSquare.find(npc => !row.witnessIds.includes(npc.id));
            if (here === undefined) {
                expect(
                    atTheSquare.every(npc => row.witnessIds.includes(npc.id)),
                    'nobody at the square was named and nobody was left over either'
                ).toBe(true);
            }
            const away = world!.npcs.find(npc =>
                npc.status === 'alive'
                && npc.locationId !== null
                && !row.witnessIds.includes(npc.id)
                && regionOf(world!, npc.locationId) !== hereRegion);
            expect(away, 'somebody a province off').toBeDefined();

            if (here) expect(inTheAirFor(world!, here)).toContain(row.id);
            expect(inTheAirFor(world!, away!)).not.toContain(row.id);
        }
        expect(crossed, 'forty strikes at a wall this cultivator can reach').toBe(true);
    }, 120_000);

    it('files a row for a wall crossed inside a sitting, by the same ladder', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'sat-through-it' });
        await h.game.newRun('Sitter');
        await h.game.act('I look around');
        await h.game.act('I buy the Lesser Qi-Gathering Manual');
        await h.game.act('I learn the Lesser Qi-Gathering Manual');

        const id = h.game.state().cultivator.id;
        // Banked, so the sitting has a wall to take rather than a rate to hope
        // for. Arranging the precondition; the crossing itself is played.
        h.repos.cultivators.update(id, {
            realmOrdinal: QI_CONDENSATION_TOP, cultivationProgress: 100_000
        } as never);

        // Sat until a wall goes down or the cultivator does. A stretch can be
        // cut short by an encounter, which is not a failure of this seam.
        let after = h.game.state().cultivator;
        for (let sitting = 0; sitting < 6; sitting++) {
            await h.game.act('I cultivate for 60 years anyway');
            after = h.game.state().cultivator;
            if (!after.alive || after.realmOrdinal > QI_CONDENSATION_TOP) break;
        }
        if (!after.alive) return;

        expect(after.realmOrdinal, 'the sitting carried them through a wall')
            .toBeGreaterThan(QI_CONDENSATION_TOP);
        const world = await h.game.loadWorld();
        const filed = crossingsNaming(world!.history.facts, id);
        expect(filed.length, 'a wall crossed in a cave is still a wall').toBeGreaterThan(0);
        // Dated when it happened rather than when the door opened: a crossing in
        // year three of a sixty-year sitting is news in year three.
        expect(filed[0].day).toBeLessThanOrEqual(Math.floor(world!.currentDay));
    }, 300_000);

});

describe('and who the world has a reason to reach is read off the run', () => {
    /**
     * The two arms run in one command and differ in exactly one thing: whether
     * the cultivator is on a roll. A stash-and-rerun is not a control arm and a
     * second harness minutes later is a second tree, so the comparison is made
     * here, against the same world seed, with the membership as the only variable.
     */
    function standingOf(h: Awaited<ReturnType<typeof makeGameInWorld>>, id: string) {
        const held = positionIn(h.repos, id);
        return {
            inAHouse: held !== null,
            tier: held?.tier ?? null,
            ownFollowing: 0,
            hasASeat: false
        } as const;
    }

    it('reaches nobody for a fresh rogue, and an office holder once they are on a roll', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'nobody-writes' });
        await h.game.newRun('Nobody');
        await h.game.act('I look around');

        const id = h.game.state().cultivator.id;
        expect(h.repos.sects.getMembership(id), 'a fresh run is on no roll').toBeFalsy();
        const asARogue = standingOf(h, id);
        expect(asARogue.inAHouse).toBe(false);
        expect(howMuchWouldBeDeliveredTo(asARogue), 'nobody carries anything to a nobody')
            .toBe(0);

        // The same person, on a roll, at a rung whose business piles up. Read
        // out of the world's own catalog rather than named, because which house
        // is standing here is not what this is about.
        const house = h.repos.sects.list()[0];
        expect(house, 'the world has a house to be on the roll of').toBeTruthy();
        h.repos.sects.addMember(house.id, id, Math.max(0, house.ranks.length - 2));

        const asAnElder = standingOf(h, id);
        expect(asAnElder.inAHouse).toBe(true);
        expect(howMuchWouldBeDeliveredTo(asAnElder))
            .toBeGreaterThan(howMuchWouldBeDeliveredTo(asARogue));
    }, 120_000);

    it('comes out of a long sitting having delivered nothing to a rogue', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'silence-is-the-ruling' });
        await h.game.newRun('Nobody');
        await h.game.act('I look around');
        await h.game.act('I buy the Lesser Qi-Gathering Manual');
        await h.game.act('I learn the Lesser Qi-Gathering Manual');

        const { narration } = await h.game.act('I cultivate for 20 years anyway');
        // The headline a delivery writes into the prose. Its absence is the
        // assertion: a rogue's decade produces the unheard count and no post,
        // and softening that is the failure this pins. It goes red the moment
        // anything hands post to somebody with no standing.
        expect(narration).not.toContain('had been kept for this cultivator');
        expect(
            howMuchWouldBeDeliveredTo(standingOf(h, h.game.state().cultivator.id)),
            'still nobody, twenty years later'
        ).toBe(0);
    }, 180_000);
});
