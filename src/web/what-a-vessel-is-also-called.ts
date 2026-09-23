/**
 * The words a player uses for a thing the board calls something else.
 *
 * ── WHY THIS EXISTS, AND IT IS NOT A CONVENIENCE ─────────────────────────
 *
 * The design owner ruled on the three senses this genre gives the word
 * `furnace`, and the board was renamed to match: the vessel a pill is worked in
 * is a `cauldron`, and the vessel a sword is forged in is an `artifact furnace`.
 * The renaming was right and it broke the sentence somebody had always typed.
 *
 * Measured against the board afterwards, on the exact strings a player says:
 *
 *     "Earth-grade refining furnace"  ->  nothing at all
 *     "refining furnace"              ->  nothing at all
 *     "pill furnace"                  ->  a Qi Gathering Pill
 *
 * The first two are a rename leaving its old name reaching nowhere, which is
 * the near-synonym defect AGENTS.md opens with. The third is worse and is the
 * reason this file is not just a list: `pill furnace` is the owner's own
 * sentence - *"a player may call it a pill furnace and mean the same thing"* -
 * and the loose resolver, which walks the words of a phrase longest first and
 * takes the first row any single word reaches, answered `pill`. A player asking
 * for the vessel would have bought a pill. That is the defect the comment above
 * `resolvePriceLoosely`'s caller already warns about in the medicine case, one
 * family over.
 *
 * ── HOW IT WORKS, AND WHY IT IS A REWRITE RATHER THAN A TABLE OF IDS ─────
 *
 * Each entry replaces a PHRASE with the board's own phrase and then lets the
 * ordinary scorer do its work. So the grade word in front is untouched and
 * keeps working by construction: "Iron-grade refining furnace" becomes
 * "Iron-grade artifact furnace" and reaches the iron row, without this file
 * knowing that grades exist. A table of ids would have to name every row and
 * would go stale the next time somebody adds a grade.
 */

/** A phrase somebody says, and the phrase the board uses for the same thing. */
const ALSO_CALLED: ReadonlyArray<readonly [RegExp, string]> = [
    // The forging vessel. `refining furnace` is what the board called it until
    // the owner's ruling, and it is still what the id says.
    [/\brefining\s+furnace(s)?\b/gi, 'artifact furnace$1'],
    // And the alchemy vessel, which the owner says may be called this.
    [/\bpill\s+furnace(s)?\b/gi, 'cauldron$1'],
    // A forge is the building; the vessel in it is the artifact furnace. Said
    // by players who mean the thing they can carry.
    [/\bforging\s+furnace(s)?\b/gi, 'artifact furnace$1']
];

/**
 * The sentence with any of those phrases put into the board's own words.
 *
 * Returns the string unchanged where nothing matched, so a caller can use it
 * unconditionally and nothing else in the resolver has to know this exists.
 */
export function inTheBoardsOwnWords(said: string): string {
    let out = said;
    for (const [phrase, instead] of ALSO_CALLED) out = out.replace(phrase, instead);
    return out;
}
