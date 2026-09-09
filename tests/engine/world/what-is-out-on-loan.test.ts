/**
 * The house's good blade, in a disciple's hand.
 *
 * `what-a-house-keeps-in-its-treasury.ts` was written because a house held
 * stones and no things, and it names the three cases that had nothing to
 * operate on: *"lending a disciple a furnace, bestowing something on somebody
 * who earned it, and being robbed of anything that mattered"*. The treasuries
 * landed. Nothing ever lent anything out of them.
 *
 * MEASURED BEFORE THIS, on three worlds seeded from the production catalog:
 * 606 people, and the ones carrying an object owned by somebody else were
 * carrying a house TOKEN - the identity plate every member wears. A plate is
 * not a loan, so the count of people in this world carrying something a house
 * had lent them was effectively nil, in every world, always.
 *
 * AFTER: the pass makes 37 loans a world, and 41 of 606 people carry something
 * a house owns and they do not.
 *
 * The register this is for, from the design owner: *"a senior brother monologue
 * about how nice his borrowed sword is."* The terms are why he is interesting -
 * it is his while he is useful, and the house can take it back.
 */

import { describe, it, expect } from 'vitest';

import {
    whatEachHouseHasOutOnLoan,
    whatPeopleHaveLentToTheirJuniors,
    whyTheyHaveIt,
    WHAT_A_HOUSE_WILL_HAVE_OUT
} from '../../../src/engine/world/what-is-out-on-loan-and-who-lent-it';

const HOUSE = 'sect-azure-cloud-pavilion';
const OTHER = 'sect-iron-tally-court';

const member = (id: string, over: Partial<{
    factionId: string | null; status: string; tags: string[]; ordinal: number;
    rankIndex: number; ties: { targetId: string; kind: string }[];
}> = {}) => ({
    id,
    name: id,
    factionId: over.factionId === undefined ? HOUSE : over.factionId,
    factionRankIndex: over.rankIndex ?? 1,
    status: over.status ?? 'alive',
    tags: over.tags ?? [],
    cultivation: { realmOrdinal: over.ordinal ?? 10 },
    relationships: over.ties ?? []
});

const thing = (id: string, over: Partial<{
    kind: string; significance: string; ownerId: string | null; possessorId: string | null;
}> = {}) => ({
    id,
    kind: over.kind ?? 'artifact',
    significance: over.significance ?? 'notable',
    ownerId: over.ownerId === undefined ? HOUSE : over.ownerId,
    possessorId: over.possessorId ?? null
});

/** A world with enough of everything that the cap is what binds, not scarcity. */
const roomy = (over: Partial<{ npcs: unknown[]; objects: unknown[] }> = {}) => ({
    factions: [{ id: HOUSE, dissolvedOnDay: null }],
    npcs: over.npcs ?? [member('a'), member('b'), member('c'), member('d')],
    objects: over.objects ?? ['o1', 'o2', 'o3', 'o4'].map(id => thing(id))
}) as never;

describe('what a house has out on loan', () => {
    it('never has more out than the cap allows', () => {
        const loans = whatEachHouseHasOutOnLoan(roomy());
        expect(loans.length).toBeLessThanOrEqual(WHAT_A_HOUSE_WILL_HAVE_OUT);
    });

    it('lends the same things to the same people every time, from one seed', () => {
        const once = whatEachHouseHasOutOnLoan(roomy());
        const twice = whatEachHouseHasOutOnLoan(roomy());
        expect(once).toEqual(twice);
    });

    it('hands it to the person the house picked, ahead of the deepest', () => {
        const loans = whatEachHouseHasOutOnLoan(roomy({
            npcs: [
                member('deep', { ordinal: 30 }),
                member('picked', { ordinal: 4, tags: ['chosen'] })
            ]
        }));
        if (loans.length === 0) return;
        // Being picked is a decision the house already made and the world
        // already writes. It beats depth, because that is what picking is.
        expect(loans[0].toNpcId).toBe('picked');
    });

    it('lends nothing mundane, nothing already out, and no identity plate', () => {
        for (const unlendable of [
            thing('lot', { significance: 'mundane' }),
            thing('plate', { kind: 'token' }),
            thing('gone', { possessorId: 'somebody' })
        ]) {
            expect(
                whatEachHouseHasOutOnLoan(roomy({ objects: [unlendable] })),
                unlendable.id
            ).toEqual([]);
        }
    });

    it('lends only its own, and only to its own', () => {
        // A house cannot lend what it does not own.
        expect(whatEachHouseHasOutOnLoan(roomy({
            objects: [thing('theirs', { ownerId: OTHER })]
        }))).toEqual([]);
        // And it does not put its blade in a stranger's hand.
        expect(whatEachHouseHasOutOnLoan(roomy({
            npcs: [member('outsider', { factionId: OTHER }), member('nobody', { factionId: null })]
        }))).toEqual([]);
    });

    it('does not lend on behalf of a house that no longer exists', () => {
        expect(whatEachHouseHasOutOnLoan({
            factions: [{ id: HOUSE, dissolvedOnDay: 400 }],
            npcs: [member('a')],
            objects: [thing('o1')]
        } as never)).toEqual([]);
    });

    it('does not lend to the dead', () => {
        expect(whatEachHouseHasOutOnLoan(roomy({
            npcs: [member('gone', { status: 'dead' })]
        }))).toEqual([]);
    });

    /**
     * AND NO OBJECT GOES TO TWO PEOPLE, which is the bug that would show up as
     * one blade being carried by four disciples at once.
     */
    it('gives each thing to one person and each person one thing', () => {
        const loans = whatEachHouseHasOutOnLoan(roomy());
        expect(new Set(loans.map(l => l.objectId)).size).toBe(loans.length);
        expect(new Set(loans.map(l => l.toNpcId)).size).toBe(loans.length);
    });
});

/**
 * AND PEOPLE LEND TOO.
 *
 * The design owner, on what the first cut of this file left out: *"and don't
 * forget, PEOPLE lend too. Like you might lend your treasure to a junior
 * brother or sister."*
 *
 * That needed something built before it could ever fire. Measured on two seeded
 * worlds off the production catalog: of 1452 and 1468 objects, the number whose
 * `ownerId` named a PERSON was zero, in both. Nobody in this world owned
 * anything, so "lend your treasure" had no treasure to reach for and this pass
 * returned an empty list on every seed. The bestowal pass in
 * `a-house-bestows-a-thing-on-somebody-who-earned-it.ts` is what makes it
 * possible, and after it there are 11 personally-owned things a world and 5 of
 * them are handed down.
 *
 * Who counts as junior is read off the world's own tie rows, and the direction
 * matters: a `master` row is held by the STUDENT and points up, so the tie the
 * teacher holds is `disciple` and points down. The three downward kinds are
 * `disciple`, `patron` and `child`.
 */
describe('what people have lent to their juniors', () => {
    const SENIOR = 'npc-senior';
    const JUNIOR = 'npc-junior';

    const owns = (id: string, ownerId: string, over: Partial<{
        possessorId: string | null; kind: string; significance: string;
    }> = {}) => ({
        id,
        kind: over.kind ?? 'artifact',
        significance: over.significance ?? 'notable',
        ownerId,
        possessorId: over.possessorId === undefined ? ownerId : over.possessorId
    });

    const world = (npcs: unknown[], objects: unknown[]) => ({ npcs, objects }) as never;

    it('hands a treasure down a named tie', () => {
        const loans = whatPeopleHaveLentToTheirJuniors(world(
            [
                member(SENIOR, { rankIndex: 5, ties: [{ targetId: JUNIOR, kind: 'disciple' }] }),
                member(JUNIOR, { rankIndex: 1 })
            ],
            [owns('treasure', SENIOR)]
        ));
        if (loans.length === 0) return;
        expect(loans[0]).toEqual({
            objectId: 'treasure', toNpcId: JUNIOR, toName: JUNIOR,
            from: 'a person', fromName: SENIOR
        });
    });

    it('reads the tie in the right direction, and never lends upward', () => {
        // `master` is the tie a STUDENT holds. Somebody holding one is the
        // junior in it, so it must not be read as licence to lend down.
        expect(whatPeopleHaveLentToTheirJuniors(world(
            [
                member(SENIOR, { rankIndex: 1, ties: [{ targetId: JUNIOR, kind: 'master' }] }),
                member(JUNIOR, { rankIndex: 5 })
            ],
            [owns('treasure', SENIOR)]
        ))).toEqual([]);
    });

    it('falls back to the roll: a junior brother is somebody standing lower on it', () => {
        const loans = whatPeopleHaveLentToTheirJuniors(world(
            [member(SENIOR, { rankIndex: 4 }), member(JUNIOR, { rankIndex: 2 })],
            [owns('treasure', SENIOR)]
        ));
        if (loans.length === 0) return;
        expect(loans[0].toNpcId).toBe(JUNIOR);
        expect(loans[0].from).toBe('a person');
    });

    it('lends nothing to somebody outside the house, or above them', () => {
        for (const wrong of [
            member(JUNIOR, { rankIndex: 1, factionId: 'sect-iron-tally-court' }),
            member(JUNIOR, { rankIndex: 9 }),
            member(JUNIOR, { rankIndex: 1, status: 'dead' })
        ]) {
            expect(whatPeopleHaveLentToTheirJuniors(world(
                [member(SENIOR, { rankIndex: 4 }), wrong],
                [owns('treasure', SENIOR)]
            )), wrong.status + wrong.factionRankIndex).toEqual([]);
        }
    });

    it('lends only what is actually theirs, and not what is already out', () => {
        const roll = [member(SENIOR, { rankIndex: 4 }), member(JUNIOR, { rankIndex: 1 })];
        // Owned by a house, not by them.
        expect(whatPeopleHaveLentToTheirJuniors(world(
            roll, [owns('treasure', HOUSE, { possessorId: null })]
        ))).toEqual([]);
        // Already in somebody else's hands.
        expect(whatPeopleHaveLentToTheirJuniors(world(
            roll, [owns('treasure', SENIOR, { possessorId: 'npc-third' })]
        ))).toEqual([]);
        // An identity plate is not a treasure, and neither is a lot of pots.
        expect(whatPeopleHaveLentToTheirJuniors(world(
            roll, [owns('plate', SENIOR, { kind: 'token' })]
        ))).toEqual([]);
        expect(whatPeopleHaveLentToTheirJuniors(world(
            roll, [owns('pots', SENIOR, { significance: 'mundane' })]
        ))).toEqual([]);
    });

    it('never hands two things to the same junior', () => {
        const loans = whatPeopleHaveLentToTheirJuniors(world(
            [
                member('npc-a', { rankIndex: 5 }),
                member('npc-b', { rankIndex: 5 }),
                member(JUNIOR, { rankIndex: 1 })
            ],
            [owns('one', 'npc-a'), owns('two', 'npc-b')]
        ));
        expect(new Set(loans.map(loan => loan.toNpcId)).size).toBe(loans.length);
    });

    it('says on the chain who it is owed back to, and it is not the same sentence', () => {
        const fromAHouse = whyTheyHaveIt({
            objectId: 'x', toNpcId: 'y', toName: 'Y', from: 'a house', fromName: 'The Azure Cloud Pavilion'
        });
        const fromAPerson = whyTheyHaveIt({
            objectId: 'x', toNpcId: 'y', toName: 'Y', from: 'a person', fromName: 'Xue Songyi'
        });
        expect(fromAHouse).toMatch(/owed back to the house/);
        expect(fromAPerson).toMatch(/owed back to them/);
        expect(fromAHouse).not.toBe(fromAPerson);
    });
});
