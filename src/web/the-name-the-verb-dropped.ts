/**
 * The person the player named, when the verb arrived without them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Found by playing, with an opponent standing in the square:
 *
 *     > I coerce claire to hand over her stuff, all of it
 *     Nobody in particular.
 *     Unresolved party: no subject named for a confrontation.
 *
 * Claire was there. She was in the roster the same turn, she had been spawned
 * the turn before, and the player had just typed her name. What reached the
 * engine was `coerce()` with an EMPTY target, because phase 1 picked the verb
 * and dropped the object - so the refusal was true about what it received and
 * false about the sentence that produced it.
 *
 * From a chair this reads as people not persisting: you talk to somebody, and
 * next turn the game behaves as though nobody is there. Nothing was actually
 * forgotten. The name simply never survived the trip.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY READING THE PLAYER'S OWN SENTENCE IS NOT A LEAK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every other path that turns a name into a person is gated on knowledge,
 * because handing back a name the player has not earned is the discovery leak
 * this codebase keeps closing - `nearbyNames` says so in its own header, and
 * `whoIsAbout` will not print a lone stranger's name for exactly that reason.
 *
 * **This one is not gated, and the reason is that the player supplied the
 * name.** Matching what they typed against who is standing there tells them
 * nothing they did not already write down. The gate exists to stop the engine
 * VOLUNTEERING a name; it was never meant to stop the engine from hearing one.
 *
 * The distinction is worth keeping straight, because the safe-looking change
 * is to add the gate here "for consistency", and that would restore the bug
 * for every unknown person a player can see, spawn or be attacked by.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DELIBERATELY DOES NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It does not guess. There is no fuzzy scoring here and no "closest match":
 * `best()` exists for the case where the player named somebody and got the
 * spelling approximately right, and it runs on the ordinary path where a
 * target IS present. This runs only when the target is MISSING, so a wrong
 * answer would be an act against somebody the player never mentioned - which
 * is worse than the refusal it replaces.
 *
 * So the match is exact, on a whole word, case-insensitively, and it takes
 * the LONGEST name that appears. Longest matters where a roster holds both a
 * given name and a full one: "Ru Anwei" must win over a "Ru" standing beside
 * her, or the sentence resolves to the wrong person with total confidence.
 *
 * And it returns ONE person or nothing. Two names in a sentence is a sentence
 * the engine has no business picking a victim out of.
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
 * The padding on both sides is what stops "An" matching the middle of
 * "Chan", which on a large roster is not hypothetical.
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
        // player being specific rather than the player naming two people:
        // "Ru Anwei" also matches a "Ru" who is standing there.
        const longest = named[0];
        const rest = named.slice(1);
        const allInside = rest.every(who => saidOutLoud(longest.name, who.name));
        if (!allInside) return null;
        return longest;
    }

    return named[0];
}
