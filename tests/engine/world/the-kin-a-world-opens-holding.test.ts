/**
 * The ties of blood between catalog people that a world opens holding.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Three ties were asserted in the writing and stated by no row anywhere. Ru
 * Anwei's `detail` opens *"The younger sister"* and her `wants` is to be asked
 * about something other than her sister. Ru Anxi is *"the one people mistake for
 * her cousin"*. Hou Baiyu wants his uncle to stop introducing him to people as
 * his uncle. Every sentence is about a second person and the engine could name
 * none of them.
 *
 * Measured on four fresh worlds, seeds `wed-a..d`, before the pass: Ru Anxi was
 * the Grand Sword Elder's drawn daughter in two of them and nobody's relative in
 * the other two, and in no world was she anything at all to Ru Anwei.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHICH OF THE TWO SISTERS IS ELDER IS NOT OPEN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It looked like the one thing the catalog had left for a reader to choose. It
 * had not. `named-figures.ts` on Ru Anjing: she *"left her younger sister
 * holding the hall"*, and `governance-and-water-rights.ts` and `crossings.ts`
 * say the same in their own words. The catalog settles it three times in three
 * files, so nothing here chose it and nothing here should re-open it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * STATED KIN AND DRAWN CHILDREN ARE NOT IN TENSION, which was the one thing
 * that could have made this the wrong change. The ruling next door - marriages
 * stated, children drawn, so that a life can open inside a household the catalog
 * wrote - is untouched: the birth draw reads ages and `child` ties and never
 * looks at a `kin` row. Measured both ways below.
 *
 * WHAT IT DISPLACES, MEASURED, BOTH ARMS IN ONE TREE. Seeds `wed-a..d`, every
 * relationship row dumped with the pass on and off and the two diffed:
 *
 *     kin rows        +4 per world   two ties, both halves
 *     ally rows       -1 per world   Ru Anxi's "Serves under." toward Ru Anwei
 *     everything else  no change     spouse, parent, child, rival identical
 *
 * The same row every time. It is the derived rank-order row `seedFactions`
 * deals from the four under a house's head toward the head, and a pair holds
 * exactly one relationship row, so the blood lands on top of it. The rank order
 * it was read off has not moved and can be read off the roster; the blood
 * cannot be derived from anything, which is why it wins the slot.
 *
 * ONE STATED TIE CANNOT BE WRITTEN AT ALL, AND THAT IS A RULE. Ru Anjing lives
 * in `named-figures.ts` because she crossed the Lid, `seedNamedFigures`
 * instantiates `MEMBERS` and nobody else, so no world holds a row for her. The
 * catalog states the tie regardless and the pass counts it under `aboveTheLid`
 * with the reason attached - a row dropped in silence is how a thing ends up
 * asserted in prose and absent from the data, which is the defect this whole
 * pass exists to close.
 */

import { describe, expect, it } from 'vitest';

import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { AUTHORED_KIN, KIN_THE_OTHER_WAY_ROUND, MEMBERS } from '../../../src/data/cultivation/members.js';
import { getNamedFigure } from '../../../src/data/cultivation/named-figures.js';
import {
    seedTheKinTheCatalogStates
} from '../../../src/engine/world/the-kin-a-world-opens-holding.js';
import {
    couldHaveBeenAParentTo,
    SIBLING_STANDING
} from '../../../src/engine/world/the-ties-an-ordinary-life-produces.js';
import {
    worldIdForCatalogPerson
} from '../../../src/engine/world/a-catalog-person-and-their-world-row.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const DAYS_PER_YEAR = 365;
const SEEDS = ['wed-a', 'wed-b', 'wed-c', 'wed-d'];

let catalog: WorldCatalog;
async function world(seed: string): Promise<WorldState> {
    catalog ??= await loadCultivationCatalog();
    return seedWorld({ seed, catalog, population: 400 }).state;
}

const rowFor = (state: WorldState, catalogId: string): NpcRecord | undefined =>
    state.npcs.find(npc => npc.id === worldIdForCatalogPerson(catalogId));

/** The two ends of a stated tie, split by whether a world can hold them. */
const inTheRoster = AUTHORED_KIN.filter(k =>
    MEMBERS.some(m => m.id === k.oneId) && MEMBERS.some(m => m.id === k.otherId));
const reachingOutside = AUTHORED_KIN.filter(k => !inTheRoster.includes(k));

describe('the kin the catalog states', () => {
    it('names somebody a catalog holds at both ends', () => {
        // The half that is about the DATA rather than about a world: a row
        // naming nobody is a tie the sheet and the seeder both drop, and the
        // drop is silent at every layer.
        for (const kin of AUTHORED_KIN) {
            for (const id of [kin.oneId, kin.otherId]) {
                const held = MEMBERS.some(m => m.id === id) || getNamedFigure(id) !== undefined;
                expect(held, `${id} is in no catalog`).toBe(true);
            }
            expect(kin.oneId, 'a tie between somebody and themselves').not.toBe(kin.otherId);
            expect(Object.keys(KIN_THE_OTHER_WAY_ROUND)).toContain(kin.tie);
        }
    });

    it('states no tie of descent, so the drawn children stay drawn', () => {
        // THE RULING NEXT DOOR, AS AN ASSERTION ON THIS LIST. A stated parent
        // or child would be the fixed roster the marriage work refused: 24 of
        // three thousand births open as the child of an authored figure and a
        // roster would take every one of those seats. A tie among the catalog's
        // own people is a different fact and is what this list is for.
        const descent = ['parent', 'child', 'daughter', 'son', 'mother', 'father'];
        for (const kin of AUTHORED_KIN) {
            for (const word of [kin.tie, KIN_THE_OTHER_WAY_ROUND[kin.tie]]) {
                expect(descent, `the catalog states a tie of descent: ${word}`)
                    .not.toContain(word.toLowerCase());
            }
        }
    });

    it('writes every tie whose two ends a world holds, in every world', async () => {
        expect(inTheRoster.length, 'no stated tie is writable, so this guards nothing')
            .toBeGreaterThan(0);

        const perSeed: string[] = [];
        for (const seed of SEEDS) {
            const state = await world(seed);
            for (const kin of inTheRoster) {
                const one = rowFor(state, kin.oneId);
                const other = rowFor(state, kin.otherId);
                expect(one, `${seed}: ${kin.oneId} has no world row`).toBeDefined();
                expect(other, `${seed}: ${kin.otherId} has no world row`).toBeDefined();

                // Both halves, at the standing this engine gives a blood tie,
                // and each end holding the word for what the OTHER person is.
                const forward = one!.relationships.find(r => r.targetId === other!.id);
                const back = other!.relationships.find(r => r.targetId === one!.id);
                expect(forward?.kind, `${seed}: ${one!.name} holds nothing toward ${other!.name}`)
                    .toBe('kin');
                expect(back?.kind, `${seed}: the tie is written from one side only`).toBe('kin');
                expect(forward!.standing).toBeCloseTo(SIBLING_STANDING, 5);
                expect(back!.standing).toBeCloseTo(SIBLING_STANDING, 5);
                expect(forward!.note.toLowerCase())
                    .toContain(KIN_THE_OTHER_WAY_ROUND[kin.tie].toLowerCase());
                expect(back!.note.toLowerCase()).toContain(kin.tie.toLowerCase());
            }

            perSeed.push(state.npcs
                .flatMap(npc => npc.relationships
                    .filter(r => r.kind === 'kin' && r.note !== 'Same household.')
                    .map(r => [npc.id, r.targetId].sort().join('|')))
                .sort()
                .filter((pair, i, all) => all.indexOf(pair) === i)
                .join(','));
        }

        // The claim itself rather than a proxy for it: the SET is the same in
        // every world, which is what "a fact about them rather than about a
        // world" means when it reaches the engine.
        expect(new Set(perSeed).size, 'the catalog\'s kin differ between worlds').toBe(1);
    }, 300_000);

    it('counts a tie it cannot write rather than dropping it', async () => {
        // The Lid, as a counter. Ru Anjing is the one row in it today and the
        // assertion is deliberately about the CATEGORY - a stated tie with
        // somebody the roster does not hold - so the next immortal tie somebody
        // authors lands here without a line of new code or a new test.
        expect(reachingOutside.length, 'no stated tie reaches outside the roster, so this '
            + 'guards nothing - if the catalog legitimately lost that case, drop the '
            + 'counter in the same change').toBeGreaterThan(0);

        const state = await world(SEEDS[0]);
        // Run over the already-seeded world: the pass is idempotent, so what it
        // reports is the split rather than a second set of rows.
        const seeded = seedTheKinTheCatalogStates(state);
        expect(seeded.written).toBe(inTheRoster.length);
        expect(seeded.aboveTheLid).toBe(reachingOutside.length);
        // Nought, and it is the assertion that matters: a stated tie between two
        // roster members that no world holds is a catalog and a seeder
        // disagreeing about who exists.
        expect(seeded.unwritten).toBe(0);

        for (const kin of reachingOutside) {
            const outside = MEMBERS.some(m => m.id === kin.oneId) ? kin.otherId : kin.oneId;
            expect(rowFor(state, outside), `${outside} has a world row after all`).toBeUndefined();
            // BOTH ENDS OR NEITHER, the ruling the marriage pass already makes:
            // the half that IS in the world holds no row for the half that is not.
            const inside = outside === kin.oneId ? kin.otherId : kin.oneId;
            const here = rowFor(state, inside)!;
            expect(here.relationships.some(r => r.targetId === worldIdForCatalogPerson(outside)))
                .toBe(false);
        }
    }, 300_000);

    it('keeps the ages the catalog states, and could have been anybody a parent', async () => {
        // TWO CHECKS THAT ARE ONE CHECK. The catalog calls Ru Anxi a younger
        // relative and Ru Anwei the younger sister, and a world that derived
        // its ages the other way round would print the writing's own words back
        // at a reader inverted. And an authored tie has to satisfy the rule a
        // drawn one does - `couldHaveBeenAParentTo`, the alive-when-the-child-
        // was-born check that reached a player last time it was missing.
        //
        // The age band is closed-form rather than sampled: `seedNamedFigures`
        // gives a catalog person 16 + 9 x ordinal + [0,40] years, so the elder
        // end of every stated tie sits at a higher ordinal and cannot overlap.
        for (const seed of SEEDS) {
            const state = await world(seed);
            for (const kin of inTheRoster) {
                const junior = rowFor(state, kin.oneId)!;
                const senior = rowFor(state, kin.otherId)!;
                const ageOf = (n: NpcRecord): number =>
                    Math.floor((state.currentDay - n.identity.bornOnDay) / DAYS_PER_YEAR);
                expect(ageOf(senior), `${seed}: ${senior.name} is younger than ${junior.name}`)
                    .toBeGreaterThan(ageOf(junior));

                // And the generational tie satisfies the parent rule, which is
                // what an uncle is one step removed from: old enough to be a
                // generation up, and standing when the other was born.
                if (kin.tie === 'nephew') {
                    expect(
                        couldHaveBeenAParentTo(senior, ageOf(junior), state.currentDay),
                        `${seed}: ${senior.name} could not have been a generation above ${junior.name}`
                    ).toBe(true);
                }
            }
        }
    }, 300_000);

    it('takes no seat away from a life that opens as somebody\'s child', async () => {
        // THE RECONCILIATION, MEASURED RATHER THAN ARGUED. The birth draw reads
        // ages and `child` ties; a `kin` row is not either, so writing one
        // cannot make its holder ineligible as a parent. Asserted against the
        // real predicate rather than by reading the draw's source, so it goes
        // red if the predicate ever starts reading blood.
        const state = await world(SEEDS[0]);
        for (const kin of inTheRoster) {
            for (const id of [kin.oneId, kin.otherId]) {
                const npc = rowFor(state, id)!;
                expect(npc.relationships.some(r => r.kind === 'kin')).toBe(true);
                // Sixteen, which is what a life opens at.
                expect(couldHaveBeenAParentTo(npc, 16, state.currentDay),
                    `${npc.name} stopped being able to be a parent when the tie was written`)
                    .toBe(true);
            }
        }
    }, 300_000);
});
