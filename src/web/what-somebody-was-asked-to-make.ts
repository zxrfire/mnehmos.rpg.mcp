/**
 * The thing a player asked somebody to make, read out of their own words.
 *
 * The design owner: *"you should be able to ask your master to cut a slip or
 * craft something for you"*, and on what a slip is: *"talismans are crafted by
 * the cultivator using materials and contain 1 attack at that strength"*,
 * *"mortal earth heaven immortal"*, *"combat and teleportation talismans
 * exist"*.
 *
 * So a sentence names three things and this reads all three off it: the GRADE,
 * which is the ladder the whole world's artifacts hang on; whether it is a SLIP
 * and which of the two kinds; and whether it is a RING, which the commissioning
 * layer gates separately because a ring's grade means something else than every
 * other grade.
 *
 * Nothing here decides anything. It turns words into the shape
 * `commissioning-a-craft.ts` already takes, and that module says whether the
 * hands can and whether the person will.
 */

import type { TechniqueGrade } from '../schema/cultivation.js';
import type { WhatIsInTheSlip } from '../engine/world/a-talisman-is-one-act-somebody-already-paid-for.js';
import type { WhatYouAskedThemToMake } from '../engine/social-leverage/index.js';

/**
 * The grade named, or the bottom of the ladder.
 *
 * MORTAL BY DEFAULT, and deliberately the cheapest thing rather than the
 * dearest: a player who says "a talisman" and no more is asking for a talisman,
 * and answering them with the price of an immortal one would be the engine
 * choosing the most expensive reading of an ambiguous sentence.
 */
export function gradeAskedFor(named: string): TechniqueGrade {
    const said = named.toLowerCase();
    if (/\bimmortal\b/.test(said)) return 'immortal';
    if (/\bheaven(?:ly)?\b/.test(said)) return 'heaven';
    if (/\bearth(?:ly)?\b/.test(said)) return 'earth';
    return 'mortal';
}

/** The words that name a folded slip rather than a made thing. */
const A_SLIP = /\b(?:talisman|talismans|slip|slips|charm|charms|paper|seal|seals)\b/i;

/**
 * A way out rather than a strike.
 *
 * Both kinds exist and the sentence usually says which. A slip with nothing in
 * the sentence about going anywhere is the common one, which is the strike.
 */
const A_WAY_OUT =
    /\b(?:escape|escaping|gets?|got|getting) (?:me |us |him |her |them )?out\b|\b(?:escape|escaping|way out|teleport|teleportation|flee|fleeing|fold|folding|transport|carries me|carry me)\b/i;

/** And a ring, which is folded space rather than worked material. */
const A_RING = /\b(?:storage ring|storage ‑ring|ring|rings|pouch of holding)\b/i;

export function whatTheyWereAskedToMake(named: string): WhatYouAskedThemToMake {
    const grade = gradeAskedFor(named);
    const slip: WhatIsInTheSlip | null = A_SLIP.test(named)
        ? (A_WAY_OUT.test(named) ? 'a_way_out' : 'a_strike')
        : null;
    return {
        // The player's own words, echoed. Read by no conditional here or in the
        // commissioning layer - it exists so the answer names the thing the way
        // the person asking named it.
        named: named.slice(0, 80),
        grade,
        ...(slip === null ? {} : { slip }),
        ...(slip === null && A_RING.test(named) ? { aRing: true } : {})
    };
}
