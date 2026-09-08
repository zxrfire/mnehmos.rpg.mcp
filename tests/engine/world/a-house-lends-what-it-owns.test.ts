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
    WHAT_A_HOUSE_WILL_HAVE_OUT
} from '../../../src/engine/world/a-house-lends-what-it-owns-to-somebody-it-trusts';

const HOUSE = 'sect-azure-cloud-pavilion';
const OTHER = 'sect-iron-tally-court';

const member = (id: string, over: Partial<{
    factionId: string | null; status: string; tags: string[]; ordinal: number;
}> = {}) => ({
    id,
    factionId: over.factionId === undefined ? HOUSE : over.factionId,
    status: over.status ?? 'alive',
    tags: over.tags ?? [],
    cultivation: { realmOrdinal: over.ordinal ?? 10 }
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
