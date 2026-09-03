/**
 * The dilution ladder, with somebody standing on every rung of it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS GUARDING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `bloodlineTierForChild` was designed, argued out in detail, and tested - and
 * **nothing in `src/` ever wrote an `AbilityTier` onto a person.** So it
 * answered `null` for every living soul, and the whole half of the design that
 * rests on it could not occur. That is `AGENTS.md`'s "a field nothing writes"
 * exactly: every artefact of a finished feature present except a writer, and the
 * absence reading as a value.
 *
 * Two writers now exist and both are asserted here:
 *
 *   THE SEEDER, so the ladder is being read from the first day of every world
 *   rather than waiting on a once-in-an-age event no run will see.
 *   THE BIRTH PASS, so it goes on being read after that, off both parents.
 *
 * And the third assertion is the one that makes the first two mean anything:
 * **the column is not one value.** A distribution of one is the signature of an
 * unwritten field, and counting it in a seeded world is the instrument.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import {
    bloodlineForChild,
    bloodlineTierForChild,
    type AbilityTier
} from '../../../src/engine/world/hunting-a-spirit-beast.js';
import { BEAST_CHANGE_ORDINAL, getBeast } from '../../../src/data/cultivation/beasts.js';
import {
    THE_LINE_AT_MILLRUN
} from '../../../src/data/cultivation/a-family-that-came-down-from-a-changed-beast.js';
import { lifespanForOrdinal } from '../../../src/engine/cultivation/realms.js';

const catalog = await loadCultivationCatalog();

describe('the family the ladder is read off', () => {
    it('descends from a beast that could have become a person', () => {
        const beast = getBeast(THE_LINE_AT_MILLRUN.speciesId);
        expect(beast, THE_LINE_AT_MILLRUN.speciesId).toBeDefined();
        // A line comes down from somebody, and below the change there is no
        // somebody to come down from.
        expect(beast!.ordinal).toBeGreaterThanOrEqual(BEAST_CHANGE_ORDINAL);
    });

    /**
     * The roster IS the ladder, and a roster that showed one strength would
     * demonstrate nothing. This is the reason the family is authored at all.
     */
    it('stands somebody on every rung of the ladder, and past the end of it', () => {
        const tiers = new Set(THE_LINE_AT_MILLRUN.people.map(p => p.tier));
        expect(tiers).toEqual(new Set<AbilityTier | null>(['final', 'grown', 'latent', null]));
    });

    /**
     * FOUND BY SEEDING. Three of them were authored at two centuries and
     * derived to Qi Condensation, whose lifespan is one - so they were seeded
     * already past their own span and the lifespan pass would have killed the
     * family in its first year.
     */
    it('gives nobody an age their own rung cannot carry', async () => {
        const { state } = seedWorld({ seed: 'line-span', catalog });
        for (const npc of state.npcs.filter(n => n.id.startsWith('npc-line-'))) {
            const age = (state.currentDay - npc.identity.bornOnDay) / 365;
            expect(age, npc.name).toBeLessThan(lifespanForOrdinal(npc.cultivation.realmOrdinal));
        }
    }, 120_000);

    it('seeds them as people, in a place, on one roll', async () => {
        const { state } = seedWorld({ seed: 'line-seed', catalog });
        const family = state.npcs.filter(n => n.identity.bloodline !== null);

        expect(family.length).toBe(
            THE_LINE_AT_MILLRUN.people.filter(p => p.tier !== null).length
        );
        // One place. A family is people who live together.
        expect(new Set(family.map(n => n.locationId)).size).toBe(1);
        // And one lineage, which the world builds off the shared surname it
        // already builds every other lineage off.
        const lineage = state.lineages.find(l => l.surname === THE_LINE_AT_MILLRUN.surname);
        expect(lineage, 'the family is on no roll').toBeDefined();
        expect(lineage!.edges.length).toBeGreaterThan(0);
    }, 120_000);

    /**
     * The instrument from `AGENTS.md`: count the column before trusting
     * anything computed from it. One value is the signature of a field nothing
     * writes, and `null` for everybody was the state this replaces.
     */
    it('does not read as one value across a seeded world', async () => {
        const { state } = seedWorld({ seed: 'line-column', catalog });
        const values = new Set(state.npcs.map(n => n.identity.bloodline?.tier ?? 'none'));
        expect(values.size).toBeGreaterThan(2);
        expect(values.has('none')).toBe(true);
    }, 120_000);
});

describe('and the birth pass keeps writing it', () => {
    /**
     * The far end. A world that runs must go on producing carriers, or the
     * seeded family is a tableau rather than a line - and the tell would be a
     * world where the only people carrying anything are the nine that were
     * placed there.
     *
     * POOLED, AND THE BAR IS UNCHANGED. This asked one seed to prove a rare
     * event and reported the world moving as the world breaking.
     *
     * Measured over eight seeds either side of a ladder change that had
     * nothing to do with bloodlines: 29 carriers born against 22, and SIX OF
     * EIGHT SEEDS producing at least one on both sides. The mechanism did not
     * move at all. What moved was `line-run` itself, from 4 to 0 - while `p5`
     * went 0 to 1 in the other direction on the same change.
     *
     * So two seeds in eight already produced nothing before anybody touched
     * anything, which made this a guard with a one-in-four chance of failing
     * on any given day for reasons that were never about the line.
     *
     * The bar is still "the world must go on producing carriers". It is simply
     * no longer asked of a single draw. See AGENTS.md, pool the sample and
     * never widen the bar.
     */
    it('produces carriers who were not seeded', async () => {
        const SEEDS = ['line-run', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
        let carriers: NpcRecord[] = [];
        let born: NpcRecord[] = [];
        let seedsThatProduced = 0;
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog });
            const after = advanceWorldYears(state, 200).state;
            const theirs = after.npcs.filter(n => n.identity.bloodline !== null);
            const theirsBorn = theirs.filter(n => !n.id.startsWith('npc-line-'));
            if (theirsBorn.length > 0) seedsThatProduced++;
            carriers = carriers.concat(theirs);
            born = born.concat(theirsBorn);
        }
        expect(carriers.length).toBeGreaterThan(0);
        expect(born.length, 'no line has come down to anybody the world made').toBeGreaterThan(0);
        // And it is not one lucky world carrying the whole claim.
        expect(
            seedsThatProduced,
            'the line comes down in isolated worlds only'
        ).toBeGreaterThanOrEqual(3);

        // And what they carry is a real species with a real strength, not a
        // flag: the ability is looked up rather than copied onto the person.
        for (const n of born) {
            expect(getBeast(n.identity.bloodline!.speciesId), n.name).toBeDefined();
        }
    }, 900_000);
});

describe('the ladder itself is unchanged, and is not restated anywhere', () => {
    it('steps down for one carrier and holds for two', () => {
        expect(bloodlineTierForChild('final', null)).toBe('grown');
        expect(bloodlineTierForChild('grown', null)).toBe('latent');
        expect(bloodlineTierForChild('latent', null)).toBeNull();
        expect(bloodlineTierForChild('grown', 'grown')).toBe('grown');
        expect(bloodlineTierForChild(null, null)).toBeNull();
    });

    /**
     * A person carries one line. Two carriers of DIFFERENT species is a case
     * the tier arithmetic cannot answer on its own, and the answer is the
     * stronger one rather than a new kind of person.
     */
    it('gives a child of two different lines the stronger one, either way round', () => {
        const shell = { speciesId: 'beast-millennial-tortoise', tier: 'final' as const };
        const hawk = { speciesId: 'beast-thunder-hawk', tier: 'latent' as const };

        expect(bloodlineForChild(shell, hawk)).toEqual({
            speciesId: 'beast-millennial-tortoise', tier: 'final'
        });
        expect(bloodlineForChild(hawk, shell)).toEqual({
            speciesId: 'beast-millennial-tortoise', tier: 'final'
        });
    });

    it('is gone rather than empty when it goes', () => {
        expect(bloodlineForChild({ speciesId: 'beast-thunder-hawk', tier: 'latent' }, null))
            .toBeNull();
    });
});
