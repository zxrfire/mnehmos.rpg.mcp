import { describe, expect, it } from 'vitest';
import type { KnowingStage } from '../../../src/engine/social/discovery.js';
import { COMMON_HOUSE_COUNT, housesTeaching, isCommonlyHeld, whoseArt } from '../../../src/engine/world/manuals.js';
import { getSect } from '../../../src/data/cultivation/sects.js';
import { HELPLESS_REALM_GAP } from '../../../src/engine/cultivation/combat.js';
import {
    couldTheyTellItIs,
    isFlat,
    whatTheirRealmAffords,
    whatTheirReferenceAffords,
    whatTheGapItselfTells,
    whereThisArtWasLearned,
    type ArtObserver
} from '../../../src/engine/world/recognising-whose-art-you-just-watched.js';

const AZURE = 'sect-azure-cloud-pavilion';

/** The Pavilion's signature, taken from the catalog rather than typed in. */
const PAVILION_ART = (() => {
    const sect = getSect(AZURE) as { signatureTechniqueId?: string | null } | undefined;
    const id = sect?.signatureTechniqueId ?? null;
    if (!id) throw new Error('the Azure Cloud Pavilion has no signature art in the catalog');
    return id;
})();

/** An observer who holds one stage for one house and `unaware` for everything else. */
function reader(realmOrdinal: number, stages: Partial<Record<string, KnowingStage>> = {}): ArtObserver {
    return {
        realmOrdinal,
        referenceFor: (factionId: string) => stages[factionId] ?? 'unaware'
    };
}

describe('the catalog half is real before anything is gated on it', () => {
    it('the Pavilion signature is taught by exactly one house', () => {
        expect(whoseArt(PAVILION_ART)).toEqual([AZURE]);
        expect(housesTeaching(PAVILION_ART)).toBe(1);
    });

    it('and isCommonlyHeld disagrees, which is why this module does not use it', () => {
        // Reported, not fixed. `isCommonlyHeld` returns true for anything that
        // is not a cultivation road with a cap, so every fighting art in the
        // catalog reads as nobody's - including a signature one house teaches.
        // A house's signature is exactly what trust.md's strongest check is
        // about, so gating on that predicate would make the check answer
        // "nobody's art" for the case it exists to serve.
        expect(isCommonlyHeld(PAVILION_ART)).toBe(true);
        expect(housesTeaching(PAVILION_ART)).toBeLessThan(COMMON_HOUSE_COUNT);
    });
});

describe('the two axes are independent and neither rescues the other', () => {
    it('realm is counted in major realms, not ordinals', () => {
        // Thirteen rungs of Qi Condensation are one realm, and the step out of
        // it is worth more than all thirteen. Ordinal 0 against ordinal 12 is
        // the same realm and reads level.
        expect(whatTheirRealmAffords(0, 12)).toBe('consistent');
        // Two major realms up is out of reach entirely.
        expect(whatTheirRealmAffords(0, 30)).toBe('nothing');
        // One realm up is followed in shape and not in method.
        expect(whatTheirRealmAffords(0, 14)).toBe('impression');
        // A realm above the demonstration reads it flat.
        expect(whatTheirRealmAffords(30, 5)).toBe('certain');
    });

    it('reference is the awareness ladder, hop by hop', () => {
        expect(whatTheirReferenceAffords('unaware')).toBe('nothing');
        expect(whatTheirReferenceAffords('whisper')).toBe('nothing');
        expect(whatTheirReferenceAffords('named')).toBe('impression');
        expect(whatTheirReferenceAffords('placed')).toBe('consistent');
        expect(whatTheirReferenceAffords('encountered')).toBe('certain');
        expect(whatTheirReferenceAffords('known')).toBe('certain');
    });

    it('the recluse at the top of the ladder cannot say whose it is', () => {
        const result = whereThisArtWasLearned(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 10 },
            reader(40)
        );
        expect(result.perceived).toBe(true);
        expect(result.best).toBe('nothing');
        expect(result.houses.every(h => h.fromRealm === 'certain')).toBe(true);
        expect(result.perceivedButCouldNotPlaceIt).toBe(true);
    });

    it('the travelled nobody knows whose it is and cannot follow it', () => {
        const result = whereThisArtWasLearned(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 33 },
            reader(3, { [AZURE]: 'known' })
        );
        expect(result.perceived).toBe(false);
        expect(result.best).toBe('nothing');
        // And this is NOT the recluse's failure. They are different states and
        // the type keeps them apart.
        expect(result.perceivedButCouldNotPlaceIt).toBe(false);
        expect(result.houses.find(h => h.factionId === AZURE)?.fromReference).toBe('certain');
    });

    it('the flat answer needs both axes', () => {
        const demonstration = { techniqueId: PAVILION_ART, performedAtOrdinal: 20 };
        expect(whereThisArtWasLearned(demonstration, reader(35, { [AZURE]: 'placed' })).best)
            .toBe('consistent');
        expect(whereThisArtWasLearned(demonstration, reader(20, { [AZURE]: 'known' })).best)
            .toBe('consistent');
        expect(whereThisArtWasLearned(demonstration, reader(35, { [AZURE]: 'known' })).best)
            .toBe('certain');
    });
});

describe('a common book belongs to nobody, so there is no check to run', () => {
    it('reads as an absent subject rather than as a failure', () => {
        // The province's standard crossing: twenty-four houses teach it.
        const id = 'foundation-tempering-scripture';
        expect(housesTeaching(id)).toBeGreaterThanOrEqual(COMMON_HOUSE_COUNT);
        const result = whereThisArtWasLearned({ techniqueId: id, performedAtOrdinal: 10 }, reader(30, { [AZURE]: 'known' }));
        expect(result.nobodysArt).toBe(true);
        expect(result.houses).toEqual([]);
        expect(result.revealsTheReader).toBe(false);
    });
});

describe('the check reveals the checker', () => {
    it('only a reference that came from the room does', () => {
        const demonstration = { techniqueId: PAVILION_ART, performedAtOrdinal: 20 };
        expect(whereThisArtWasLearned(demonstration, reader(35, { [AZURE]: 'placed' })).revealsTheReader)
            .toBe(false);
        expect(whereThisArtWasLearned(demonstration, reader(35, { [AZURE]: 'encountered' })).revealsTheReader)
            .toBe(true);
        // And it does not depend on the rung: somebody who cannot follow the
        // movement still gives themselves away by knowing whose it is.
        expect(whereThisArtWasLearned(demonstration, reader(1, { [AZURE]: 'known' })).revealsTheReader)
            .toBe(true);
    });
});

describe('putting a claim to the check', () => {
    const demonstration = { techniqueId: PAVILION_ART, performedAtOrdinal: 20 };

    it('no reference is told plainly and never handed a false negative', () => {
        const answer = couldTheyTellItIs(demonstration, reader(40), AZURE);
        expect(answer.verdict).toBe('would_not_know_it');
        expect(isFlat(answer.verdict)).toBe(false);
    });

    it('a reference and a low rung is hedged, and honestly hedged', () => {
        const answer = couldTheyTellItIs(demonstration, reader(20, { [AZURE]: 'placed' }), AZURE);
        expect(answer.verdict).toBe('consistent');
        expect(isFlat(answer.verdict)).toBe(false);
        expect(answer.theHouseDoesTeachIt).toBe(true);
    });

    it('a reference and a high rung is flat', () => {
        const answer = couldTheyTellItIs(demonstration, reader(35, { [AZURE]: 'known' }), AZURE);
        expect(answer.verdict).toBe('it_is');
        expect(isFlat(answer.verdict)).toBe(true);
    });

    it('a flat negative is only ever given to somebody who has earned it', () => {
        const other = 'sect-lantern-hall';
        const sure = couldTheyTellItIs(demonstration, reader(35, { [other]: 'known' }), other);
        expect(sure.verdict).toBe('it_is_not');

        // The same person, one rung band down, gets the honest hedge instead of
        // the same answer with more confidence than they hold.
        const unsure = couldTheyTellItIs(demonstration, reader(20, { [other]: 'named' }), other);
        expect(unsure.verdict).toBe('inconsistent');
        expect(isFlat(unsure.verdict)).toBe(false);
    });

    it('the rung gap is its own answer and is not the same as ignorance', () => {
        const answer = couldTheyTellItIs(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 40 },
            reader(2, { [AZURE]: 'known' }),
            AZURE
        );
        expect(answer.verdict).toBe('could_not_follow');
    });
});

describe('an art says where somebody trained, not whom they serve', () => {
    it('the result carries no allegiance anywhere on it', () => {
        const result = whereThisArtWasLearned(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 20 },
            reader(35, { [AZURE]: 'known' })
        );
        // The type has no field for it and the object must not grow one.
        const keys = Object.keys(result);
        for (const forbidden of ['allegiance', 'servesFactionId', 'currentHouse', 'memberOf']) {
            expect(keys).not.toContain(forbidden);
        }
        // What it does carry is where the art is taught, and that is all it
        // claims. The Hollow Court is an entire institution built on the gap:
        // it takes nobody below a Void Refinement floor, so every Seat arrived
        // trained somewhere else and performs that house's art honestly.
        expect(result.houses.map(h => h.factionId)).toContain(AZURE);
    });

    it('recognising the Court own people is not what the check does', () => {
        // The Court teaches nothing at intake, so an art of theirs identifying
        // a member would have to be an art they took IN. Whatever a Seat
        // performs, this check answers about the house that taught it - and
        // there is no branch anywhere on the Court's id.
        const anyCourtArt = whoseArt(PAVILION_ART);
        expect(anyCourtArt).not.toContain('sect-hollow-court');
    });
});

/**
 * ── THE TWO AXES DO NOT FAIL THE SAME WAY ────────────────────────────────
 *
 * Ruled by the design owner, correcting this module: *"they can tell that this
 * is something that will fuck them up, right? being unable to read something is
 * itself a sign."*
 *
 * `whatTheirRealmAffords` going to `nothing` used to be the whole of what a
 * watcher far below came away with, and it read as a shrug - which is the
 * genre's most basic beat rendered as an absence. What is under test here is
 * that the two readings run in OPPOSITE directions at the far end: what they
 * can name falls to nothing while what they can feel rises to certainty.
 */
describe('being unable to read something is itself a sign', () => {
    it('reports certainty about being outclassed exactly where identification fails', () => {
        // The same subtraction, asked twice. This is the pair that matters and
        // it is asserted as a pair, because either one alone is half an answer.
        const farBelow = whereThisArtWasLearned(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 40 },
            reader(0, { [AZURE]: 'known' })
        );

        expect(farBelow.perceived).toBe(false);
        expect(farBelow.best).toBe('nothing');
        // And the thing they DID come away with, unhedged.
        expect(farBelow.outOfTheirDepth.beyondThem).toBe(true);
        expect(farBelow.outOfTheirDepth.certainty).toBe('certain');
        expect(farBelow.outOfTheirDepth.realmsAbove).toBeGreaterThanOrEqual(HELPLESS_REALM_GAP);
    });

    it('feels nothing at all when the thing is level with them or under them', () => {
        // Somebody standing over a thing their own size is not out of their
        // depth and has nothing to feel. The axis is about being outclassed,
        // not a general-purpose alarm.
        const level = whereThisArtWasLearned(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 20 },
            reader(20, { [AZURE]: 'known' })
        );
        expect(level.outOfTheirDepth.beyondThem).toBe(false);
        expect(level.outOfTheirDepth.certainty).toBe('nothing');

        const above = whereThisArtWasLearned(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 4 },
            reader(40, { [AZURE]: 'known' })
        );
        expect(above.outOfTheirDepth.realmsAbove).toBeLessThan(0);
        expect(above.outOfTheirDepth.certainty).toBe('nothing');
    });

    it('hedges at one realm under, which is the rung people get killed at', () => {
        const oneUnder = whereThisArtWasLearned(
            { techniqueId: PAVILION_ART, performedAtOrdinal: 24 },
            reader(20, { [AZURE]: 'known' })
        );
        expect(oneUnder.outOfTheirDepth.realmsAbove).toBe(1);
        expect(oneUnder.outOfTheirDepth.beyondThem).toBe(false);
        expect(oneUnder.outOfTheirDepth.certainty).toBe('impression');
    });

    it('always says which direction it is, in both directions', () => {
        for (const [at, by] of [[40, 0], [20, 20], [4, 40]] as const) {
            const read = whatTheGapItselfTells(by, at);
            expect(read.account.length).toBeGreaterThan(20);
        }
    });
});
