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
    isWideSpan,
    LIVING_TRANSMISSIONS,
    teachersOf,
    transmissionsBy,
    carriesTo,
    getTechnique
} from '../../src/data/cultivation/techniques.js';
import { THE_DEEPEST_ROADS } from '../../src/data/cultivation/roads-to-the-top-of-the-ladder.js';
import { houseTeachingCeiling } from '../../src/data/cultivation/index.js';
import { PILLS, isAdvancement } from '../../src/data/cultivation/pills.js';
import { getArtifact } from '../../src/data/cultivation/artifacts.js';
import { MEMBERS } from '../../src/data/cultivation/members.js';
import { shardPower } from '../../src/engine/world/possessions.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { FACTION_CHARACTER } from '../../src/data/cultivation/faction-character.js';
import {
    MANUALS_MAY_EXCEED_THE_LID,
    MAX_ORDINAL,
    REALM_TIERS,
    progressRequiredForOrdinal
} from '../../src/engine/cultivation/realms.js';
import { realmsSpannedBy, techniqueExhausted } from '../../src/engine/cultivation/cultivation.js';

const MANUALS = TECHNIQUES.filter(t => t.class === 'cultivation');

/**
 * The corridor is what the world ROUTINELY offers, so every gap, choke-point
 * and element-lock check below is made against the ordinary succession.
 *
 * Wide-span treasures are excluded deliberately and it matters: a single
 * grave-only book that opens at five and ends at forty-five continues at every
 * rung on the ladder, so counting it would report the corridor as having no
 * choke points and no gaps at all. A gap that is closed only by a unique
 * treasure nobody has is still a gap.
 */
const ORDINARY = MANUALS.filter(t => !isWideSpan(t));
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
        // Except the wide-span books, which are the whole point of there being
        // an override: a treasure reaches further than its realm geometry, and
        // that is exactly what makes it a treasure rather than four saved rungs.
        for (const t of TECHNIQUES) {
            if (isWideSpan(t)) continue;
            expect(t.cap, t.id).toBe(capOf(t));
        }
    });

    it('keeps the wide-span books rare, and gated on something money cannot buy', () => {
        const wide = MANUALS.filter(isWideSpan);
        expect(wide.length, 'a skip has to exist').toBeGreaterThan(0);
        // Rare. If half the catalog lets you skip, the corridor is gone.
        expect(wide.length / MANUALS.length).toBeLessThan(0.15);
        for (const t of wide) {
            // Gated on comprehension rather than on rank, which is the whole
            // design: `requiredOrdinal` is the wrong instrument for a treasure
            // because gating a cap-33 book behind ordinal 29 stops it skipping
            // anything. Comprehension is the axis money cannot buy.
            expect(t.domain, t.id + ' must be dao-gated').not.toBeNull();
            expect(t.domainDegree, t.id).toBeGreaterThanOrEqual(2);
            // And the opening is hard, so it cannot be coasted on.
            expect(t.opening, t.id + ' needs a hard opening').not.toBeNull();
            expect(t.opening!.rateMultiplier, t.id).toBeLessThan(0.5);
            expect(t.opening!.rungs, t.id).toBeGreaterThan(0);
        }
    });

    it('lets a house teach a long road, but never a treasure', () => {
        // WHAT CHANGED, AND WHY.
        //
        // This used to read `expect(t.provenance).not.toBe('taught')` for
        // every wide book, on the reasoning that nobody teaches a book making
        // four of their own redundant. That reasoning is sound about a house
        // with four books and says nothing about a house that cannot use the
        // ordinary succession at all - and the catalog contains one, because
        // the mutated elements are deliberately starved and there is no ice
        // manual below ordinal 33 for the one house that admits nothing else.
        // Put to the user in as many words - "who says a sect can't have a
        // manual going from 13 all the way to 29? some can be longer than
        // others" - and the answer was that only this assertion did.
        //
        // So length is no longer the line. REACH is. A book spanning two or
        // three realms is a deep house road: longer than ordinary, still a
        // curriculum, and it ends somewhere a successor volume opens. A book
        // spanning four or more is a treasure - it does not continue a
        // succession, it replaces one - and nobody transmits those, which is
        // the half of the old rule that was always doing the work.
        //
        // Everything else the wide books pay is unchanged and asserted above:
        // a comprehension gate and a hard opening, both, for every one of them
        // whoever hands it over.
        const TAUGHT_REALM_LIMIT = 3;
        for (const t of MANUALS.filter(isWideSpan)) {
            const realms = realmsSpannedBy({ requiredOrdinal: t.requiredOrdinal, cap: t.cap });
            if (t.provenance === 'taught') {
                expect(realms, `${t.id} is taught and reaches ${realms} realms`)
                    .toBeLessThanOrEqual(TAUGHT_REALM_LIMIT);
            } else {
                expect(realms, `${t.id} is a treasure that skips nothing much`)
                    .toBeGreaterThan(TAUGHT_REALM_LIMIT);
            }
        }
        // And a taught long road is still the exception, not the shelf. If
        // most houses hold one, the succession of manuals has been abolished
        // rather than deepened.
        const taughtWide = MANUALS.filter(t => isWideSpan(t) && t.provenance === 'taught');
        expect(taughtWide.length / MANUALS.length, 'long roads must stay rare')
            .toBeLessThan(0.1);
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
                // A wide-span book is not part of the ordinary succession; it
                // is the thing that lets somebody leave it.
                if (isWideSpan(manual)) continue;
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
            const learnable = ORDINARY.filter(t => t.requiredOrdinal <= ordinal);
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
    it('never derives a ceiling of zero from a house with a road and no shelf', () => {
        // The Hollow Court used to read `reliableOrdinal: 0`, on the reasoning
        // that zero is a statement about INTAKE rather than about the house -
        // it takes nobody from the bottom because there is no bottom here. The
        // reasoning was sound and answered the wrong question: it admits at a
        // Void Refinement floor, and the honest reading of "routinely" is what
        // happens to somebody after they walk in, which is that they reach the
        // top of the ladder. Four are standing there now.
        //
        // What the assertion is actually guarding is unchanged and is the
        // second line: whatever the house's own intake looks like, the ceiling
        // comes off the MANUAL, so the strongest acting body in the world can
        // never be handed a teaching ceiling of zero.
        const hollow = FACTION_CHARACTER['sect-hollow-court'];
        expect(hollow.production.reliableOrdinal).toBeGreaterThan(36);
        expect(hollow.production.peakOrdinal).toBeGreaterThan(30);
        expect(houseTeachingCeiling('sect-hollow-court')).not.toBe(0);
        for (const t of MANUALS) expect(t.cap, t.id).not.toBe(0);
    });

    it('never lets a house teach past what it has ever produced', () => {
        // The load-bearing invariant, and the one the design actually needs.
        //
        // NOT measured against `reliableOrdinal`. Reliable is what a house
        // makes ROUTINELY, and a book may legitimately outrun it because most
        // disciples never finish the book - the Burnt Earth Temple's
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
        // are behind a seal, on a body, or inside one of the four institutions
        // that stand at the top of the world.
        //
        // That last clause is the change, and it is narrow on purpose. The
        // assertion used to be that NOTHING at this height is taught, which
        // read as scarcity and was in fact an accident: it meant the strongest
        // houses in the world had teach lists ending at Core Formation, and the
        // apex whose own member walked off the top of the ladder inside living
        // memory could be recorded as unable to teach past the middle of it.
        //
        // The four roads are exempt and nothing else is. Each is held by
        // exactly one of the four bodies with somebody standing in the band the
        // book is written for, which is the fact that makes holding it
        // coherent - and a shelf is still not a promise: `THE_DEEPEST_ROADS`
        // carries the one or two lent copies and the single teacher, available
        // sometimes, that stand between a chosen disciple and any of them.
        const exempt = new Set(THE_DEEPEST_ROADS.map(r => r.techniqueId));
        const top = MANUALS.filter(t => (t.cap ?? MAX_ORDINAL) >= MAX_ORDINAL - 1);
        expect(top.length).toBeGreaterThan(0);
        for (const t of top) {
            if (exempt.has(t.id)) continue;
            expect(t.provenance, t.id).not.toBe('taught');
        }
        // And the exemption stays tiny: four bodies, four roads, one each.
        expect(THE_DEEPEST_ROADS.length).toBe(4);
        expect(new Set(THE_DEEPEST_ROADS.map(r => r.factionId)).size).toBe(4);
        expect(new Set(THE_DEEPEST_ROADS.map(r => r.techniqueId)).size).toBe(4);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ADVANCEMENT RULE
//
// `docs/world/things/economy.md`: "Buying advancement always costs more than buying
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

// ─────────────────────────────────────────────────────────────────────────
// THE CORRIDOR
//
// `docs/world/writing/escapes.md` measured the ladder above the middle and found it is
// not a ladder at all: at most heights the world offers exactly ONE book that
// continues, and usually wants a specific element for it.
//
//   17-20  one, fire-locked, three houses
//   25-28  earth-locked, or a forbidden method from two demonic houses
//   29-31  one, ruin, one trial
//   33-35  one, ice-locked, ONE house
//   37-40  one
//   41-44  ruin and grave only
//
// That corridor is the design. What it must never become is a DEAD END, and
// nothing was watching for that: retire or re-rate one manual and the game
// becomes unwinnable at some rung with no test failing.
// ─────────────────────────────────────────────────────────────────────────

describe('the corridor has no gaps', () => {
    it('offers at least one continuation at every rung below the last crossing', () => {
        const gaps: string[] = [];
        for (let ordinal = 0; progressRequiredForOrdinal(ordinal) !== null; ordinal++) {
            const continues = ORDINARY.filter(t =>
                t.requiredOrdinal <= ordinal && (t.cap === null || t.cap > ordinal));
            if (continues.length === 0) gaps.push(String(ordinal));
        }
        expect(
            gaps,
            `no cultivation manual continues past ordinal(s) ${gaps.join(', ')} - `
            + 'that is an unwinnable game, not a hard one'
        ).toHaveLength(0);
    });

    it('names the choke points rather than letting them go unnoticed', () => {
        // Not an assertion that the corridor be wide. It is deliberately
        // narrow. This pins that we KNOW where the single-source rungs are, so
        // that a change which adds or removes one is visible in a diff.
        const chokes: number[] = [];
        for (let ordinal = 0; progressRequiredForOrdinal(ordinal) !== null; ordinal++) {
            const continues = ORDINARY.filter(t =>
                t.requiredOrdinal <= ordinal && (t.cap === null || t.cap > ordinal));
            if (continues.length === 1) chokes.push(ordinal);
        }
        // Every choke point must still have somewhere to go, which the first
        // test covers - and must be reachable by at least one route, which is
        // what makes it a door rather than a wall.
        for (const ordinal of chokes) {
            const only = ORDINARY.find(t =>
                t.requiredOrdinal <= ordinal && (t.cap === null || t.cap > ordinal))!;
            expect(
                only.survivingCopy,
                `ordinal ${ordinal} has exactly one continuation (${only.id}) and no surviving copy`
            ).toBe(true);
        }
        expect(chokes.length, 'the corridor is narrow on purpose').toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT A MANUAL DEMANDS, AND THE WAYS OUT WHEN IT RUNS OUT
// ─────────────────────────────────────────────────────────────────────────

describe('a manual asks for more than an element', () => {
    it('makes at least one refusal on each axis possible', () => {
        // Only `element` was authored, so every suitability miss a player could
        // ever see read as an element miss - "it is sound, it is written for
        // water, you draw fire" was the ONLY failure in the game. The root and
        // comprehension axes existed, were judged by `assessFit`, and had
        // nothing whatever to judge.
        expect(MANUALS.some(t => t.element !== null), 'element axis').toBe(true);
        expect(MANUALS.some(t => t.rootGrades.length > 0), 'root-grade axis').toBe(true);
        expect(MANUALS.some(t => t.domain !== null), 'comprehension axis').toBe(true);
    });

    it('keeps the demands consistent with the element that implies them', () => {
        // Ice is a mutated element, so a manual written in ice that also asks
        // for a mutated root is being explicit rather than stricter. A manual
        // asking for a root grade its own element rules out would be a door
        // with no key anywhere in the world.
        for (const t of MANUALS.filter(m => m.rootGrades.includes('mutated'))) {
            expect(['ice', 'lightning', null], `${t.id} asks for a mutated root`)
                .toContain(t.element);
        }
    });

    it('leaves the bottom of the ladder asking for nothing', () => {
        // A six-page block-printed market-town book does not have opinions.
        const first = MANUALS.find(t => t.id === 'lesser-qi-gathering-manual')!;
        expect(first.rootGrades).toHaveLength(0);
        expect(first.domain).toBeNull();
        expect(first.element).toBeNull();
    });

    it('never demands a comprehension degree nobody could hold', () => {
        for (const t of MANUALS) {
            if (t.domain === null) continue;
            expect(t.domainDegree, t.id).toBeGreaterThan(0);
            expect(t.domainDegree, t.id).toBeLessThanOrEqual(3);
        }
    });
});

describe('a scattered work is objects, not a second cap field', () => {
    it('resolves every volume id to a real object', () => {
        for (const manual of MANUALS.filter(m => m.volumes !== null)) {
            expect(manual.volumes!.length, manual.id).toBeGreaterThan(1);
            for (const id of manual.volumes!) {
                expect(getArtifact(id), `${manual.id} names missing volume ${id}`).toBeDefined();
            }
        }
    });

    it('rates a volume one rung below the whole, by the ordinary rule', () => {
        // `shardPower`, the same arithmetic that turns a broken blade into a
        // worse blade. One piece of that reasoning in the repo, not two.
        for (const manual of MANUALS.filter(m => m.volumes !== null)) {
            for (const id of manual.volumes!) {
                const volume = getArtifact(id)!;
                // A book is not a weapon. `OBJECT_CEILING_BELOW_THE_LID` caps
                // objects because an object rated at a rung lets its holder
                // strike at it, and paper does not - which is exactly why
                // `MANUALS_MAY_EXCEED_THE_LID` can be true. A volume that
                // carried combat power would make a library an armoury.
                expect(volume.power, id).toBeNull();
                expect(shardPower(volume.power), id).toBeNull();
                expect(volume.tags, id).toContain('shard');
                expect(volume.tags, id).toContain(`from:${manual.id}`);
            }
        }
    });

    it('puts the volumes in different hands, which is the whole point', () => {
        for (const manual of MANUALS.filter(m => m.volumes !== null)) {
            const holders = manual.volumes!.map(id => getArtifact(id)!.possessorId);
            expect(new Set(holders).size, `${manual.id}: one holder is not a scattered set`)
                .toBe(holders.length);
            // And they are not all equally findable. A volume nobody can name
            // and a volume a house would miss by name are different thefts.
            const known = manual.volumes!.map(id => getArtifact(id)!.knownOwnershipBy.length);
            expect(new Set(known).size, `${manual.id}: every volume is equally known`)
                .toBeGreaterThan(1);
        }
    });

    it('adds no second cap field anywhere', () => {
        // A partial set's ceiling is derived by the engine. If a `volumeCap`
        // ever appears here there are two opinions about the same number.
        for (const t of TECHNIQUES) {
            expect(t).not.toHaveProperty('volumeCap');
            expect(t).not.toHaveProperty('partialCap');
        }
    });
});

describe('derivation is a road, not a hole-closer', () => {
    it('marks only a minority of manuals derivable', () => {
        // X3. The same discipline NO_SURVIVING_COPY_TECHNIQUE_IDS is held to:
        // if this set ever grows to cover the choke points, the corridor has
        // been quietly abolished rather than opened.
        const derivable = MANUALS.filter(t => t.derivable);
        expect(derivable.length).toBeGreaterThan(0);
        expect(derivable.length / MANUALS.length).toBeLessThan(0.35);
    });

    it('never lets derivation open a single-source choke point', () => {
        // The load-bearing one. A choke point that anybody deep enough can
        // simply write for themselves is not a choke point.
        for (let ordinal = 0; progressRequiredForOrdinal(ordinal) !== null; ordinal++) {
            const continues = ORDINARY.filter(t =>
                t.requiredOrdinal <= ordinal && (t.cap === null || t.cap > ordinal));
            if (continues.length !== 1) continue;
            expect(continues[0].derivable,
                `ordinal ${ordinal}: its only continuation ${continues[0].id} is derivable`)
                .toBe(false);
        }
    });

    it('gives every non-derivable manual of note a stated reason', () => {
        // A stated absence is a design statement. A silent one is missing
        // content - the distinction NO_SURVIVING_COPY_NOTES exists to make.
        const noted = MANUALS.filter(t => t.notDerivableReason !== null);
        expect(noted.length).toBeGreaterThan(0);
        for (const t of noted) {
            expect(t.derivable, `${t.id} is both derivable and explained away`).toBe(false);
            expect(t.notDerivableReason!.length).toBeGreaterThan(60);
        }
    });
});

describe('every choke point has more than one way through', () => {
    it('gives the narrowest stretch on the ladder a second route', () => {
        // X2. heaven-conversing-primordial-canon is the only continuation
        // between ordinal 37 and 40, and its only route was a parting gift: a
        // dead woman's estate in a shed with a bad roof. One route at the
        // narrowest point on the ladder reads as missing content rather than
        // as scarcity, so the work is now also scattered into three volumes.
        const canon = MANUALS.find(t => t.id === 'heaven-conversing-primordial-canon')!;
        expect(canon.volumes, 'the 37-40 corridor needs a second door').not.toBeNull();
        expect(canon.volumes!.length).toBeGreaterThanOrEqual(3);
        // The estate route is untouched: the complete work is still where it
        // was, and it is still the better prize.
        expect(canon.survivingCopy).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// LIVING TEACHERS
//
// The sixth route. `provenance` answers how a COPY reaches a reader and every
// one of its answers is paper; a person is not paper, and the engine has
// always known the difference - `opacity` is how much of an art fails to
// survive being written down, and `guidanceMultiplier` prices a master by the
// gap. Neither could be used to GET a method, because nothing said which
// person held which one.
// ─────────────────────────────────────────────────────────────────────────

describe('a person can be the source of a method, not only a shelf', () => {
    it('names a real person and a real art on every row', () => {
        expect(LIVING_TRANSMISSIONS.length).toBeGreaterThan(0);
        for (const t of LIVING_TRANSMISSIONS) {
            const member = MEMBERS.find(m => m.id === t.memberId);
            expect(member, `${t.memberId} is not in the cast`).toBeDefined();
            expect(t.techniqueIds.length, t.memberId).toBeGreaterThan(0);
            for (const id of t.techniqueIds) {
                const art = getTechnique(id);
                expect(art, `${t.memberId} teaches missing art ${id}`).toBeDefined();
                // Only cultivation manuals. A dao art is not a rank ceiling and
                // teaching one is a different route with a different meaning.
                expect(art!.class, id).toBe('cultivation');
            }
        }
    });

    it('never lets somebody teach past where they themselves have stood', () => {
        // The rule that keeps this from being a shop. Guidance is priced on the
        // gap between guide and guided, and somebody who has not stood where
        // the book ends cannot walk anybody to it.
        for (const t of LIVING_TRANSMISSIONS) {
            const member = MEMBERS.find(m => m.id === t.memberId)!;
            for (const id of t.techniqueIds) {
                const art = getTechnique(id)!;
                // Strictly above where the student BEGINS, which is the rule
                // guidance actually implies. How far they can then take them is
                // derived: their own rung or the cap, whichever is lower.
                expect(
                    member.realmOrdinal,
                    `${member.name} stands at ${member.realmOrdinal}, below the start of ${art.id}`
                ).toBeGreaterThan(art.requiredOrdinal);
                const reach = carriesTo(member.realmOrdinal, id)!;
                expect(reach, id).toBeGreaterThan(art.requiredOrdinal);
                if (art.cap !== null) expect(reach, id).toBeLessThanOrEqual(art.cap);
            }
        }
    });

    it('asks for something that is not money', () => {
        // A method somebody can buy is a shelf with extra steps.
        for (const t of LIVING_TRANSMISSIONS) {
            expect(t.wants.length, t.memberId).toBeGreaterThan(40);
            expect(t.whyNotTheShelf.length, t.memberId).toBeGreaterThan(80);
            expect(t.wants.toLowerCase()).not.toMatch(/spirit stones|a fee|price of/);
        }
    });

    it('puts a teacher at the choke points, which is where a person is worth most', () => {
        // Not everywhere - a teacher for the market-town book would be absurd.
        // At the rungs where the world offers exactly one continuation, a
        // living alternative is the difference between a door and a wall.
        const taught = new Set(LIVING_TRANSMISSIONS.flatMap(t => t.techniqueIds));
        let chokesCovered = 0;
        let chokes = 0;
        for (let ordinal = 0; progressRequiredForOrdinal(ordinal) !== null; ordinal++) {
            const continues = ORDINARY.filter(t =>
                t.requiredOrdinal <= ordinal && (t.cap === null || t.cap > ordinal));
            if (continues.length !== 1) continue;
            chokes++;
            if (taught.has(continues[0].id)) chokesCovered++;
        }
        expect(chokes, 'the corridor still has choke points').toBeGreaterThan(0);
        expect(chokesCovered, 'no choke point has a living teacher').toBeGreaterThan(0);
    });

    it('resolves both directions of the lookup', () => {
        for (const t of LIVING_TRANSMISSIONS) {
            expect(transmissionsBy(t.memberId)).toContain(t);
            for (const id of t.techniqueIds) expect(teachersOf(id)).toContain(t);
        }
        expect(teachersOf('no-such-art')).toHaveLength(0);
        expect(transmissionsBy('member-nobody')).toHaveLength(0);
    });
});

describe('the corridor is a little wider than it was', () => {
    it('leaves no realm above the middle with a single element locking it', () => {
        // The failure the design agent measured: a fire root standing at Body
        // Integration had nothing at all in front of it, in any house, at any
        // price, because the one continuation was ice. One book per rung is a
        // narrow world; one book per rung that also demands one element is a
        // closed one.
        const stranded: string[] = [];
        for (let ordinal = 13; progressRequiredForOrdinal(ordinal) !== null; ordinal++) {
            const continues = ORDINARY.filter(t =>
                t.requiredOrdinal <= ordinal && (t.cap === null || t.cap > ordinal));
            if (continues.length === 0) continue;
            const elements = new Set(continues.map(t => t.element));
            // Either somebody has an elementless option, or there is more than
            // one element on offer. A single elemental book and nothing else
            // strands every other root in the world.
            if (elements.size === 1 && !elements.has(null)) {
                stranded.push(`${ordinal} (only ${[...elements][0]})`);
            }
        }
        expect(stranded, `element-locked with no alternative at ordinal ${stranded.join(', ')}`)
            .toHaveLength(0);
    });
});
