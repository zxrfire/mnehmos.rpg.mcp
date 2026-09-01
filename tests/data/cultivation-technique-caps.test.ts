/**
 * The ceiling on a cultivation manual, and the succession of books it forces.
 *
 * THE DESIGN THIS PINS
 * --------------------
 * A cultivation manual carries a rung past which it cannot take anybody,
 * however long they practise. That is what makes the faction catalog's
 * `production.reliableOrdinal` TRUE BY CONSTRUCTION rather than by assertion:
 * a low-tier house teaches a low-tier manual, so it structurally cannot
 * produce a high-realm cultivator.
 *
 * It was already true of the NPCs - `members.ts` generates a roster against
 * `reliableOrdinal` - and only the player was exempt. That exemption was a
 * bug: a run reached ordinal 44 on the roll of a house whose catalog reads
 * `reliableOrdinal: 14`.
 *
 * Two things the caps must NOT do, both asserted below:
 *   - they must not touch dao arts. What you can DO is not what you ARE.
 *   - they must not touch comprehension. A cap stops a rank, never an insight.
 */

import { describe, it, expect } from 'vitest';
import {
    TECHNIQUES,
    capOf,
    classOf,
    getTechnique
} from '../../src/data/cultivation/techniques.js';
import { houseTeachingCeiling } from '../../src/data/cultivation/index.js';
import { PILLS, isAdvancement } from '../../src/data/cultivation/pills.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { FACTION_CHARACTER } from '../../src/data/cultivation/faction-character.js';
import {
    MANUALS_MAY_EXCEED_THE_LID,
    MAX_ORDINAL,
    REALM_TIERS,
    progressRequiredForOrdinal
} from '../../src/engine/cultivation/realms.js';
import { techniqueExhausted } from '../../src/engine/cultivation/cultivation.js';

const MANUALS = TECHNIQUES.filter(t => t.class === 'cultivation');
const DAO = TECHNIQUES.filter(t => t.class === 'dao');

describe('the two kinds of art are separated', () => {
    it('splits the catalog into manuals you practise and arts you use', () => {
        expect(MANUALS.length).toBeGreaterThan(0);
        expect(DAO.length).toBeGreaterThan(0);
        expect(MANUALS.length + DAO.length).toBe(TECHNIQUES.length);
    });

    it('gives every art exactly one class, derived rather than authored', () => {
        for (const t of TECHNIQUES) {
            expect(t.class, t.id).toBe(classOf(t));
        }
    });

    it('files every `cultivation` category art as a manual', () => {
        for (const t of TECHNIQUES.filter(t => t.category === 'cultivation')) {
            expect(t.class, t.id).toBe('cultivation');
        }
    });

    it('lets a forbidden art be a manual, because some of them are', () => {
        // `category` and `class` are genuinely different axes: a demonic
        // qi-gathering method is both forbidden AND a thing you practise to
        // climb. If this ever returns zero the override set has gone stale.
        const forbiddenManuals = MANUALS.filter(t => t.category === 'forbidden');
        expect(forbiddenManuals.length).toBeGreaterThan(0);
    });
});

describe('only manuals carry a ceiling', () => {
    it('never puts a cap on a dao art', () => {
        // What you can DO is not what you ARE. A sword art does not stop
        // working because you got stronger.
        for (const t of DAO) expect(t.cap, t.id).toBeNull();
    });

    it('caps every manual except the ones that go all the way', () => {
        for (const t of MANUALS) {
            if (t.cap === null) continue;
            expect(Number.isInteger(t.cap), t.id).toBe(true);
            expect(t.cap, t.id).toBeGreaterThan(t.requiredOrdinal);
            expect(t.cap, t.id).toBeLessThanOrEqual(MAX_ORDINAL);
        }
    });

    it('derives the cap rather than authoring it per entry', () => {
        for (const t of TECHNIQUES) expect(t.cap, t.id).toBe(capOf(t));
    });

    it('stops dead at the cap rather than tapering toward it', () => {
        const manual = MANUALS.find(t => t.cap !== null)!;
        expect(techniqueExhausted(manual.cap! - 1, manual.cap)).toBe(false);
        expect(techniqueExhausted(manual.cap!, manual.cap)).toBe(true);
        expect(techniqueExhausted(manual.cap! + 5, manual.cap)).toBe(true);
        // No manual declared is the old behaviour: no ceiling at all.
        expect(techniqueExhausted(40, null)).toBe(false);
        expect(techniqueExhausted(40, undefined)).toBe(false);
    });
});

describe('the succession of books', () => {
    it('gives every realm a manual learnable on its first rung', () => {
        // Below the Lid only. From ordinal 45 upward
        // `progressRequiredForOrdinal` returns null - there is no progress
        // currency at all up there - so a gathering manual is not how anybody
        // climbs, and demanding one would be asserting a chain that does not
        // exist.
        for (const realm of REALM_TIERS) {
            if (progressRequiredForOrdinal(realm.ordinalStart) === null) continue;
            const atStart = MANUALS.filter(t => t.requiredOrdinal === realm.ordinalStart);
            expect(atStart.length, `${realm.key} has no manual at ordinal ${realm.ordinalStart}`)
                .toBeGreaterThan(0);
        }
    });

    it('hands each book off to the next at a realm boundary', () => {
        // The interlock, and it is why the cap is realmEnd + 1 rather than
        // realmEnd: a manual carries a cultivator one step OVER the boundary,
        // which is exactly the rung at which the next realm's manual becomes
        // learnable. At realmEnd the chain would dead-end at every boundary.
        for (const realm of REALM_TIERS) {
            if (progressRequiredForOrdinal(realm.ordinalStart) === null) continue;
            for (const manual of MANUALS.filter(t => t.requiredOrdinal === realm.ordinalStart)) {
                if (manual.cap === null) continue;
                expect(manual.cap, `${manual.id} should hand off at a boundary`)
                    .toBe(realm.ordinalEnd + 1);
                // A book that carries somebody as far as the Lid has nothing
                // to hand off TO, and that is right: the last crossing is not
                // made by practising. Every book below that must have a
                // successor or the chain dead-ends.
                if (progressRequiredForOrdinal(manual.cap) === null) continue;
                const successors = MANUALS.filter(t => t.requiredOrdinal <= manual.cap!
                    && (t.cap === null || t.cap > manual.cap!));
                expect(successors.length, `${manual.id} caps at ${manual.cap} with no successor`)
                    .toBeGreaterThan(0);
            }
        }
    });

    it('leaves no wall anywhere on the ladder', () => {
        // The property that matters to a player: standing anywhere, having
        // learned everything learnable, there is always a book that goes
        // further. Finding it is the game; there being none is a dead end.
        // Below the Lid: above it there is no progress to make, so "no book
        // goes further" is not a wall, it is the ladder ending.
        const walls: number[] = [];
        for (let ordinal = 0; progressRequiredForOrdinal(ordinal) !== null; ordinal++) {
            const learnable = MANUALS.filter(t => t.requiredOrdinal <= ordinal);
            const best = learnable.length
                ? Math.max(...learnable.map(t => t.cap ?? MAX_ORDINAL + 1))
                : -1;
            if (best <= ordinal) walls.push(ordinal);
        }
        expect(walls, `walls at ordinals ${walls.join(', ')}`).toHaveLength(0);
    });
});

describe('the escape routes are necessary and none of them is mandatory', () => {
    it('runs the taught books out well below the top of the ladder', () => {
        // The whole point. Past a certain height no house teaches a manual
        // that goes further, so the routes - digging, inheriting, a corpse, a
        // dao house, a False Immortal's leavings, theft, deducing the next
        // volume - stop being flavour and become the only way up.
        let ranOutAt: number | null = null;
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const taught = MANUALS.filter(t =>
                t.requiredOrdinal <= ordinal && t.provenance === 'taught');
            const best = taught.length
                ? Math.max(...taught.map(t => t.cap ?? MAX_ORDINAL + 1))
                : -1;
            if (best <= ordinal) { ranOutAt = ordinal; break; }
        }
        expect(ranOutAt, 'taught books must run out somewhere').not.toBeNull();
        expect(ranOutAt!).toBeLessThan(MAX_ORDINAL);
        // And not so early that the ordinary road is unplayable.
        expect(ranOutAt!).toBeGreaterThan(20);
    });

    it('offers more than one book above the point where teaching stops', () => {
        // No single route may be mandatory. Above the teaching ceiling there
        // has to be more than one book, or the game has exactly one path.
        const untaught = MANUALS.filter(t => t.provenance !== 'taught');
        expect(untaught.length).toBeGreaterThan(1);
        const routes = new Set(untaught.map(t => t.provenance));
        expect(routes.size, 'more than one KIND of route out').toBeGreaterThan(1);
    });

    it('has exactly one book that goes the whole way, and nobody teaches it', () => {
        const uncapped = MANUALS.filter(t => t.cap === null);
        expect(uncapped).toHaveLength(1);
        const prize = uncapped[0];
        // Legal only because paper is not an object: `MANUALS_MAY_EXCEED_THE_LID`
        // is what lets a book be rated where no artifact below 45 may be.
        expect(MANUALS_MAY_EXCEED_THE_LID).toBe(true);
        expect(prize.provenance).not.toBe('taught');
        expect(SECTS.some(s => s.teaches.includes(prize.id)
            || s.signatureTechniqueId === prize.id)).toBe(false);
    });
});

describe('a cap and a suitability are independent axes', () => {
    it('does not let the cap say anything about spirit root fit', () => {
        // A perfectly suited manual still runs out; an ill-suited one teaches
        // nothing at any height. Folding one into the other would collapse two
        // decisions into one, so element and cap must not correlate by
        // construction: manuals of the same element must span several caps.
        const byElement = new Map<string, Set<number | null>>();
        for (const t of MANUALS) {
            const key = t.element ?? 'none';
            if (!byElement.has(key)) byElement.set(key, new Set());
            byElement.get(key)!.add(t.cap);
        }
        const elementless = byElement.get('none');
        expect(elementless, 'elementless manuals exist at several heights').toBeDefined();
        expect(elementless!.size).toBeGreaterThan(1);
    });

    it('leaves comprehension untouched, because a cap stops a rank not an insight', () => {
        // The asymmetry `false-immortals.ts` is about: rank has a ceiling and
        // dao does not. Nothing in this file may put one on understanding.
        for (const t of MANUALS) {
            expect(t).not.toHaveProperty('insightCap');
            expect(t).not.toHaveProperty('daoCap');
        }
    });
});

describe('the houses, measured against their own books', () => {
    it('never derives a ceiling of zero from a house that takes no disciples', () => {
        // The Hollow Court reads `reliableOrdinal: 0` while sitting at power
        // ordinal 40, and its own note says why: "produces nobody, by
        // construction: it takes no disciples". Zero is a statement about
        // INTAKE. Deriving the cap from the MANUAL rather than the house is
        // what stops the strongest institution in the world being handed a
        // ceiling of zero.
        const hollow = FACTION_CHARACTER['sect-hollow-court'];
        expect(hollow.production.reliableOrdinal).toBe(0);
        expect(hollow.production.peakOrdinal).toBeGreaterThan(30);
        expect(houseTeachingCeiling('sect-hollow-court')).not.toBe(0);
        for (const t of MANUALS) expect(t.cap, t.id).not.toBe(0);
    });

    it('never lets a house teach past what it has ever produced', () => {
        // The load-bearing invariant, and the one the design actually needs.
        //
        // NOT measured against `reliableOrdinal`. Reliable is what a house
        // makes ROUTINELY, and a book may legitimately outrun it because most
        // disciples never finish the book - the Sweptground Temple's
        // `reliable 13 / peak 46` is precisely that story, and the gap between
        // those two numbers is the game rather than a defect. `peakOrdinal` is
        // the highest it has EVER produced, and teaching past THAT would be
        // the catalog claiming a ceiling its own history contradicts.
        //
        // One rung of slack, for a structural reason rather than a fudge: a
        // cap is `realmEnd + 1` so that a book hands its reader over at the
        // boundary where the next book opens. That last rung is a handoff, not
        // a claim that the house produces people standing on it.
        const over: string[] = [];
        for (const sect of SECTS) {
            const character = FACTION_CHARACTER[sect.id];
            if (!character?.production) continue;
            const ceiling = houseTeachingCeiling(sect.id);
            if (ceiling === null) continue;
            if (ceiling - character.production.peakOrdinal > 1) {
                over.push(`${sect.id} teaches to ${ceiling}, peak is ${character.production.peakOrdinal}`);
            }
        }
        expect(over, over.join('; ')).toHaveLength(0);
    });

    it('gives every recruiting house something for its disciples to practise', () => {
        // A house that takes intake and teaches no cultivation manual hands a
        // new disciple nothing to climb with, which makes joining it a purely
        // social act. Closed houses are exempt and correctly so.
        const empty: string[] = [];
        for (const sect of SECTS) {
            if (!sect.recruits) continue;
            const character = FACTION_CHARACTER[sect.id];
            if (!character?.production) continue;
            // A house that produces nobody is not expected to teach anybody.
            if (character.production.reliableOrdinal <= 0) continue;
            if (houseTeachingCeiling(sect.id) === null) empty.push(sect.id);
        }
        expect(empty, `recruiting houses with no cultivation manual: ${empty.join(', ')}`)
            .toHaveLength(0);
    });
});

describe('the manuals a player can actually reach', () => {
    it('resolves every manual id the catalog hands out', () => {
        for (const t of MANUALS) expect(getTechnique(t.id), t.id).toBeDefined();
    });

    it('puts the whole ladder behind a book at some height', () => {
        // Nothing above ordinal zero is reachable by cultivating raw: at every
        // rung there is a manual that has to be found, and the highest of them
        // are behind a seal or on a body.
        const top = MANUALS.filter(t => (t.cap ?? MAX_ORDINAL) >= MAX_ORDINAL - 1);
        expect(top.length).toBeGreaterThan(0);
        for (const t of top) expect(t.provenance).not.toBe('taught');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ADVANCEMENT RULE
//
// `docs/world/economy.md`: "Buying advancement always costs more than buying
// survival. Within a grade, the things that touch progression - breakthrough
// odds, cultivation progress, lifespan, and freedom from having to eat - sit
// at the top of both the value and the danger ranges."
//
// The rule was being contradicted in two grades by a catalog that was in fact
// obeying it: the abstinence pills sit at the very top of their grades, above
// lifespan, and only the doc's ENUMERATION disagreed. See ADVANCEMENT_EFFECTS.
// ─────────────────────────────────────────────────────────────────────────

describe('advancement costs more than survival, in every grade', () => {
    const GRADES = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;

    it('puts the cheapest advancement pill above the dearest survival pill', () => {
        for (const grade of GRADES) {
            const inGrade = PILLS.filter(p => p.grade === grade);
            const advancement = inGrade.filter(p => isAdvancement(p.effect));
            const survival = inGrade.filter(p => !isAdvancement(p.effect));
            if (advancement.length === 0 || survival.length === 0) continue;
            const cheapestAdvancement = Math.min(...advancement.map(p => p.value));
            const dearestSurvival = Math.max(...survival.map(p => p.value));
            expect(cheapestAdvancement, `${grade}: advancement must top survival`)
                .toBeGreaterThan(dearestSurvival);
        }
    });

    it('classes abstinence as advancement, on the same argument as lifespan', () => {
        // Lifespan is the plainest survival there is and has always been filed
        // as advancement, because what it buys is years to cultivate in.
        // Abstinence is that argument at a shorter horizon.
        expect(isAdvancement('extend_lifespan')).toBe(true);
        expect(isAdvancement('grain_abstinence')).toBe(true);
        // And the line holds where it should: a meal is not a decade.
        expect(isAdvancement('sate_hunger')).toBe(false);
        expect(isAdvancement('heal_hp')).toBe(false);
        expect(isAdvancement('treat_injury')).toBe(false);
    });

    it('gives the abstinence ladder a rung a poor cultivator can reach', () => {
        // The heaven-grade pill is ninety-six years of a best-case village
        // wage for one purchase, against a Qi Condensation lifespan of a
        // hundred. It is the designed answer to long seclusion and it was the
        // ONLY answer, which put it out of reach of everybody who needs it.
        const ladder = PILLS.filter(p => p.effect === 'grain_abstinence')
            .sort((a, b) => a.value - b.value);
        expect(ladder.length, 'more than one rung').toBeGreaterThan(1);
        const bottom = ladder[0];
        expect(bottom.grade).toBe('mortal');
        // Reachable: about a year of a villager's savings, not a century of it.
        expect(bottom.value).toBeLessThan(100);
        // And it buys real time rather than a gesture.
        expect(bottom.potency).toBeGreaterThanOrEqual(365);
        // Assemblable: ten of the bottom rung is a decade, and costs an order
        // of magnitude less than buying the decade in one swallow.
        const decade = ladder.find(p => p.potency >= 3_650)!;
        expect(bottom.value * 10).toBeLessThan(decade.value);
    });

    it('keeps every abstinence pill at the top of its own grade', () => {
        // The catalog's own instinct, now asserted: the pill that buys
        // uninterrupted time is the dearest thing in its tier.
        for (const pill of PILLS.filter(p => p.effect === 'grain_abstinence')) {
            const inGrade = PILLS.filter(p => p.grade === pill.grade);
            expect(pill.value, `${pill.id} tops ${pill.grade}`)
                .toBe(Math.max(...inGrade.map(p => p.value)));
        }
    });
});
