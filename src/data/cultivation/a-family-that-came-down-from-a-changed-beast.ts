/**
 * THE ONE FAMILY IN THE WORLD THAT CAME DOWN FROM SOMETHING THAT CHANGED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT IS SEEDED RATHER THAN WAITED FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `bloodlineTierForChild` was designed, argued out at length and tested, and
 * **nothing in the world ever wrote an `AbilityTier` on a person.** So it
 * returned null for everybody alive, and the whole half of the design that
 * rests on it - the step-down, the clan that will not marry out, the line that
 * is a claim it can no longer demonstrate - could not occur.
 *
 * The birth pass writes one now. That makes the ladder live and still never
 * fires, because the event at the top of it is a beast reaching
 * `BEAST_CHANGE_ORDINAL` and then marrying, which is a once-in-an-age thing no
 * run will see. **A family that already exists means the ladder is being
 * exercised from the first day of every world**, and it gives the rule
 * something to be read off rather than a hypothetical.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A NEW MECHANISM. IT IS TWO EXISTING ONES MEETING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   A beast at `BEAST_CHANGE_ORDINAL` and above is A PERSON, with its own row,
 *   holding what any cultivator holds. `hunting-a-spirit-beast.ts` says so and
 *   says that a branch on "is this a beast" anywhere near a social question
 *   means the design has gone wrong. There is no such branch here or anywhere.
 *
 *   A person marries, and a species ability is a real trait rather than a
 *   technique, so it comes down. The child, never having been a beast, is human
 *   and carries it anyway.
 *
 * That is the whole of it. This file authors **who exists**, and every rule
 * about what they carry is read from `bloodlineForChild` unchanged. There is no
 * dilution constant here, no clan mechanic, and no flag.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE ROSTER DEMONSTRATES, AND WHY IT IS SHAPED THIS WAY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Read top to bottom it is the ladder:
 *
 *   final    the ancestor, who was the beast. One person, and still alive -
 *            a Millennial Tortoise carries the years to be.
 *   grown    the ones who came of the ancestor and an outsider, one step down.
 *   grown    and the ones who came of two of THOSE, because two carriers hold
 *            the line. This is the pair of rows that make the family what it is.
 *   latent   the ones whose other parent was from outside, one step further.
 *   none     and the ones after them, who are simply people, and who the family
 *            can no longer show anything to prove what it says about itself.
 *
 * **Being insular is not stated anywhere and must not be.** It is what those
 * five rows produce: the branch that married its own can still show you, the
 * branch that married out is a claim. A family reading its own roster can see
 * which of the two it is becoming, and that is the whole reason such families
 * close. A flag saying "insular" would be the rule written a second time.
 *
 * ── AND THE SPECIES IS NOT DECORATION ───────────────────────────────────
 *
 * `beast-millennial-tortoise` is the ancestor because its ability is the one
 * that reads as a FAMILY TRAIT rather than as a weapon: Shellbound takes what
 * is under it out of reach and waits. A line that does not break is a thing
 * people say about a family, and it is `hunting-a-spirit-beast.ts`'s own
 * worked example - "a human family line that breathes fire, or that does not
 * break." What the ability does is read from `beasts.ts` and is not copied
 * here; a person carries a species and a strength, and nothing else.
 *
 * ── WHY A FAMILY AND NOT A HOUSE ────────────────────────────────────────
 *
 * Because the rule that produces it is about parents. A house recruits and a
 * line does not, and the thing being demonstrated is what two people leave in a
 * child - so the body it belongs to is a lineage, which the world already
 * builds off a shared surname in `seedLineages`. Giving it a sect row would
 * have added an institution to make a family legible, which is the same mistake
 * as a dilution constant in a different place.
 *
 * The surname is an ordinary one out of the common pool, deliberately.
 * `RESERVED_SURNAMES` is for names that settle a house on their own and is kept
 * tiny; the trust ladder is explicit that a shared surname proves nothing. **So
 * this family is legible by what its people carry and not by what they are
 * called**, which is the honest version and is also the interesting one: a
 * stranger with the same name proves nothing at all.
 */

import type { AbilityTier } from '../../engine/world/hunting-a-spirit-beast.js';
import type { Sex } from '../../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';
import { BEAST_CHANGE_ORDINAL } from './beasts.js';
import { PLACE } from './place-names.js';

export interface SomebodyInTheLine {
    /** Given name. The surname is the family's and is the same for all of them. */
    given: string;
    sex: Sex;
    /** How strong the line still is in them, or null where it has gone. */
    tier: AbilityTier | null;
    /**
     * Their rung, where the fiction requires one, and null where it does not.
     *
     * Authored for exactly one person - the ancestor, who has to stand at or
     * above `BEAST_CHANGE_ORDINAL` because that is what being one means.
     * Everybody else goes through the same derivation the rest of the world
     * does, off their own talent and their own province, and gets whatever it
     * gives them. **An origin buys inputs and never rank**, and being descended
     * from something is an origin.
     */
    ordinal: number | null;
    /**
     * How old they are now.
     *
     * **It has to fit inside the lifespan the rung they derive to actually
     * gives them**, and for everybody but the ancestor that rung is Qi
     * Condensation, which is a hundred years. Authored ages of two centuries
     * seeded three people who were already past their own span, which the
     * lifespan pass would then have killed in the first year - a family that
     * dissolves the moment the world moves.
     *
     * So the descendants are within one ordinary life of each other and the
     * ancestor is not, and the gap between those two facts is the content: it
     * has outlived most of its own line, which is a large part of why a line
     * dilutes at all.
     */
    ageYears: number;
    /** One concrete thing, at human scale. Never a rule. */
    note: string;
}

export interface TheLineThatCameDown {
    /** A `Beast` id in `beasts.ts`. What the ability does is read from there. */
    speciesId: string;
    surname: string;
    /** A settlement name the gazetteer carries. */
    place: string;
    /** The province it is in, by region id. */
    regionId: string;
    people: readonly SomebodyInTheLine[];
}

export const THE_LINE_AT_MILLRUN: TheLineThatCameDown = Object.freeze({
    speciesId: 'beast-millennial-tortoise',
    surname: 'Duan',
    place: PLACE.MILLRUN,
    regionId: 'region-wide-field',
    people: Object.freeze<readonly SomebodyInTheLine[]>([
        {
            given: 'Ankuan',
            sex: 'male',
            tier: 'final',
            // The one authored rung in the file, and it is authored because it
            // is the definition rather than a rating: below this the thing that
            // came out of the water could not have spoken to anybody.
            ordinal: BEAST_CHANGE_ORDINAL + 2,
            ageYears: 640,
            note:
                'Keeps the mill race clear, badly, and has kept it clear for four hundred '
                + 'years. Sheds a fingernail-sized plate about once a generation and the '
                + 'household dates them, so the family has a longer continuous record than '
                + 'the village does.'
        },
        {
            given: 'Wanhe',
            sex: 'female',
            tier: 'grown',
            ordinal: null,
            ageYears: 88,
            note: 'Holds the household ledger and will not let anybody else see the old half of it.'
        },
        {
            given: 'Zhaolin',
            sex: 'male',
            tier: 'grown',
            ordinal: null,
            ageYears: 71,
            note: 'Married his second cousin, which the village found remarkable once and does not any more.'
        },
        {
            given: 'Suiya',
            sex: 'female',
            tier: 'grown',
            ordinal: null,
            ageYears: 66,
            note:
                'Of the two who both carried it, and the reason the family can still show '
                + 'anybody anything. Stands in the race in winter to prove a point nobody asked her to prove.'
        },
        {
            given: 'Jingbo',
            sex: 'male',
            tier: 'latent',
            ordinal: null,
            ageYears: 49,
            note: 'His mother married out of the village and he has heard about it his whole life.'
        },
        {
            given: 'Minru',
            sex: 'female',
            tier: 'latent',
            ordinal: null,
            ageYears: 41,
            note: 'Can take a blow she should not be able to take, once, and cannot say why or do it twice.'
        },
        {
            given: 'Ciping',
            sex: 'male',
            tier: 'latent',
            ordinal: null,
            ageYears: 33,
            note: 'Sells the dated plates to collectors, which the older half of the family regards as theft.'
        },
        {
            given: 'Xuechen',
            sex: 'female',
            tier: null,
            ordinal: null,
            ageYears: 22,
            note:
                'Says the family does not break and has never been able to demonstrate it. '
                + 'Nobody has told her the arithmetic and she has worked most of it out.'
        },
        {
            given: 'Lieshi',
            sex: 'male',
            tier: null,
            ordinal: null,
            ageYears: 17,
            note: 'Left for the market town twice and came back both times, and does not discuss it.'
        }
    ])
});
