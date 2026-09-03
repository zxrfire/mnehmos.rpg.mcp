/**
 * The person the player named, when the verb arrived without them.
 *
 * Phase 1 can pick a verb and drop its object. When it does, a confrontation
 * arrives with an empty target and refuses for naming nobody - which is true
 * about what it received and false about the sentence that produced it. From a
 * chair that reads as people not persisting between turns.
 *
 * This reads the player's own sentence for a name of somebody standing here,
 * and it runs BEFORE the refusal so that everything downstream - the faction
 * branch, the resolution, the whole bout - runs on the recovered name exactly
 * as it would on a typed one.
 *
 * ── IT IS NOT KNOWLEDGE-GATED, AND MUST NOT BECOME SO ────────────────────
 *
 * Every other path from a name to a person is gated on awareness, because
 * handing back a name the player has not earned is a discovery leak -
 * `nearbyNames` says so in its own header, and `whoIsAbout` will not print a
 * lone stranger's name for that reason.
 *
 * **Here the player supplied the name.** Matching what they typed against who
 * is standing there tells them nothing they did not already write down. The
 * gate exists to stop the engine VOLUNTEERING a name; it was never meant to
 * stop the engine from hearing one.
 *
 * Adding the gate "for consistency" is the change that looks safe and is not:
 * it puts back the refusal for every unknown person a player can see, spawn or
 * be attacked by.
 *
 * ── AND IT DOES NOT GUESS ────────────────────────────────────────────────
 *
 * No fuzzy scoring and no closest match. `best()` covers approximate spelling
 * on the ordinary path, where a target IS present; this runs only when the
 * target is MISSING, so a wrong answer would be an act against somebody the
 * player never mentioned - worse than the refusal it replaces.
 *
 * So: exact, whole-word, case-insensitive, longest name wins, one person or
 * nothing.
 *
 * **Longest matters** where a roster holds both a given name and a full one.
 * "Ru Anwei" must beat a "Ru" standing beside her, or the sentence resolves to
 * the wrong person with total confidence.
 *
 * **One or nothing matters** because two names in a sentence is a sentence the
 * engine has no business picking a victim out of.
 */

/** The least a caller has to know about somebody to hand them to a verb. */
export interface SomebodyStandingHere {
    id: string;
    name: string;
}

/**
 * Letters, digits and spaces only, collapsed - so "Claire's" and "claire,"
 * both reduce to something a name can be found inside.
 *
 * Apostrophes go rather than splitting: a possessive is the commonest way a
 * player names a target ("I take claire's purse"), and treating the `'s` as a
 * word boundary is what makes the name survive it.
 */
function flattened(text: string): string {
    return ` ${text.toLowerCase().replace(/[^a-z0-9]+/gi, ' ').trim()} `;
}

/**
 * Whether `name` appears in `said` as whole words rather than inside another.
 *
 * The padding on both sides is what stops "An" matching the middle of "Chan",
 * which on a large roster is not hypothetical.
 */
function saidOutLoud(said: string, name: string): boolean {
    const needle = flattened(name).trim();
    if (needle.length === 0) return false;
    return flattened(said).includes(` ${needle} `);
}

/**
 * The one person present whose name the player wrote, or null.
 *
 * Null covers all three honest cases: nobody was named, nobody named is here,
 * or more than one person here was named and the engine will not choose.
 */
export function theNameTheVerbDropped(
    said: string | undefined,
    present: readonly SomebodyStandingHere[]
): SomebodyStandingHere | null {
    if (!said || said.trim().length === 0) return null;

    // Longest first, so a full name beats a given name that sits inside it.
    const named = present
        .filter(who => saidOutLoud(said, who.name))
        .sort((a, b) => b.name.length - a.name.length);

    if (named.length === 0) return null;

    // Two DIFFERENT people named is ambiguous and stays refused. Two entries
    // for one person - the same id twice on a roster - is not, so compare ids
    // rather than counting rows.
    const distinct = new Set(named.map(who => who.id));
    if (distinct.size > 1) {
        // Unless one name contains the other, in which case the longer is the
        // player being specific rather than naming two people: "Ru Anwei" also
        // matches a "Ru" who is standing there.
        const longest = named[0];
        const rest = named.slice(1);
        const allInside = rest.every(who => saidOutLoud(longest.name, who.name));
        if (!allInside) return null;
        return longest;
    }

    return named[0];
}
