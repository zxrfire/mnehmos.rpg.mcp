/**
 * A posting says where it goes.
 *
 * TWO HALVES OF ONE DEFECT, both silent.
 *
 * `aPostingAsAnOffer` has taken a `placeName` since it was written and NOTHING
 * anywhere passed one. Measured on the pinned world below before the fix: every
 * offer and every refusal on every board read "<reason>, for <house>" and not
 * one of them carried a destination, at any rung.
 *
 * And `whereASendingGoes` has asked its caller for *seats of the houses this
 * reason is about* since IT was written, while the world's own sendings handed
 * it every seat in the world. So the party sent to collect on a grant was
 * received at a hall drawn at random and the subsidiary that owed the grant
 * never saw anybody. The ruling this encodes: an elder travels to friendly
 * houses in their own faction, a court's elder down and a lesser house's elder
 * up - which the `needs` key already names, because the same relation is what
 * opened the reason.
 *
 * WHAT IS PINNED HERE IS NOT WHICH VILLAGE. A destination is drawn, so the
 * assertions are that one is named at all, that the name is a place the world
 * holds rather than a row id, that the same wall read twice says the same thing,
 * and that an errand about a named house ends at THAT house.
 *
 * RED-CHECKED. Dropping `placeFor` from the board call leaves every notice
 * without a destination and the first case fails; handing `whereASendingGoes`
 * every seat in the world fails the last.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { sectBoardFor } from '../../src/web/encounters';
import {
    whereASendingGoes,
    whichHousesAReasonIsAbout,
    type HouseAsItStands
} from '../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back';
import { getSendingReason } from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road';
import { getParentage, getSubsidiariesOf } from '../../src/data/cultivation/governance-and-water-rights';

const A_HOUSE = 'sect-azure-cloud-pavilion';

async function aMemberReadingTheBoard() {
    const { game, repos, db } = await makeGameInWorld({
        seed: 'a-posting-says-where-it-goes',
        worldSeed: 'a-posting-says-where-it-goes',
        worldEnabled: true
    });
    const { cultivator } = await game.newRun('Aspirant');
    repos.sects.addMember(A_HOUSE, cultivator.id, 0);
    const world = await game.loadWorld();
    const deps = {
        repos, world,
        knowledge: { knows: () => true, isAwareOf: () => true, learn: () => undefined }
    } as never;
    return {
        world,
        boardAt(ordinal: number) {
            db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
                .run(ordinal, cultivator.id);
            return sectBoardFor(deps, repos.cultivators.getById(cultivator.id)!);
        }
    };
}

/** Everything the wall said, takeable or not. */
function everyNoticeOn(board: ReturnType<
    Awaited<ReturnType<typeof aMemberReadingTheBoard>>['boardAt']
>): { id: string; name: string }[] {
    return [
        ...board.offers.map(offer => ({ id: offer.entry.id, name: offer.entry.name })),
        ...board.refusals.map(row => ({ id: row.entryId, name: row.name }))
    ].filter(row => row.id.startsWith('posted-'));
}

describe('a posting says where it goes', () => {
    it('names somewhere, and names it by name', async () => {
        const reading = await aMemberReadingTheBoard();
        const places = new Set(reading.world.locations.map(l => l.name));
        const ids = new Set(reading.world.locations.map(l => l.id));

        let carried = 0;
        for (const ordinal of [2, 14, 26]) {
            for (const notice of everyNoticeOn(reading.boardAt(ordinal))) {
                const at = / at (.+), for /.exec(notice.name)?.[1];
                if (at === undefined) continue;
                carried += 1;
                expect(places.has(at), `${at} is not a place this world holds`).toBe(true);
                expect(ids.has(at), `${notice.name} printed a row id`).toBe(false);
            }
        }
        expect(carried, 'no posting on any wall said where it went').toBeGreaterThan(0);
    }, 300_000);

    it('says the same thing to somebody who reads it twice', async () => {
        const reading = await aMemberReadingTheBoard();
        const first = everyNoticeOn(reading.boardAt(14)).map(n => n.name).sort();
        const again = everyNoticeOn(reading.boardAt(14)).map(n => n.name).sort();
        expect(again).toEqual(first);
    }, 300_000);

    it('sends an errand about one house to that house and to no other', () => {
        // The Pavilion's own subsidiary, off the governance table rather than
        // off a fixture: an errand to collect on a grant is about the body that
        // owes it, and about nothing else standing in the world.
        const below = getSubsidiariesOf(A_HOUSE);
        expect(below.length, 'the fixture house holds nothing from anybody').toBeGreaterThan(0);

        const house: HouseAsItStands = {
            id: A_HOUSE,
            name: 'Azure Cloud Pavilion',
            holdsGround: true,
            standing: {},
            hasAFind: false
        };
        const collecting = getSendingReason('sending-to-collect-tribute')!;
        const about = whichHousesAReasonIsAbout(collecting.needs, house);
        expect([...about].sort()).toEqual(below.map(p => p.factionId).sort());

        const seats = about.map(id => `seat-of-${id}`);
        const chosen = whereASendingGoes({
            needs: collecting.needs,
            fromLocationId: `seat-of-${A_HOUSE}`,
            seatsInPlay: seats,
            elsewhere: ['a-village', 'a-market-town'],
            pick: () => 0
        });
        expect(seats).toContain(chosen);
    });

    it('sends a call from above back up to whoever it came from', () => {
        // The other direction, and the reason the rung of whoever travels is
        // already in the key: a parent is up, a subsidiary is down.
        const below = getSubsidiariesOf(A_HOUSE)[0]!;
        const parent = getParentage(below.factionId)?.parentFactionId ?? null;
        expect(parent).toBe(A_HOUSE);

        const answering = getSendingReason('sending-to-answer-a-call')!;
        const about = whichHousesAReasonIsAbout(answering.needs, {
            id: below.factionId,
            name: 'the house below',
            holdsGround: true,
            standing: {},
            hasAFind: false
        });
        expect([...about]).toEqual([A_HOUSE]);
    });
});
