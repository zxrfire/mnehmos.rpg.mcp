/**
 * A name the player knows, as it is spelled, wherever they typed it near enough.
 *
 * The owner: "if i have a typo, you know what i mean", and it holds for every action and for
 * the model as well as the fallback table. So before a sentence is read, any stretch of it that
 * is a name this cultivator knows (a person or a place), in any case or an edit or two away, is
 * written back as the name. The model then reads the name; the table, whose patterns look for
 * a capitalised name, finds one.
 *
 * Only names they KNOW. A near guess at a stranger's real name is the player's to make and the
 * stranger's to answer, and correcting it would hand them the name.
 */

/** How many single-letter edits turn one string into the other. */
export function editsApart(a: string, b: string): number {
    if (a === b) return 0;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j]! + 1,
                current[j - 1]! + 1,
                previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous = current;
    }
    return previous[b.length]!;
}

/** How far a stretch may be from a name and still be that name: one edit, two for a long one. */
export function aTypoAway(typed: string, name: string): boolean {
    if (typed.length < 4 || name.length < 4 || Math.abs(typed.length - name.length) > 2) return false;
    return editsApart(typed, name) <= (Math.max(typed.length, name.length) >= 9 ? 2 : 1);
}

/**
 * A stretch that is a typo of a name. A name of several words may have ONE of
 * them misspelt: "your name" was two edits from the place then called "Four Names", one in each word,
 * and asking somebody their name was read as a question about a place.
 */
function nearlyThisName(typed: string, name: string, width: number): boolean {
    if (width === 1) return aTypoAway(typed, name);
    const typedWords = typed.split(/\s+/);
    const nameWords = name.split(/\s+/);
    if (typedWords.length !== nameWords.length) return false;
    const misspelt = nameWords.map((_, i) => i).filter(i => typedWords[i] !== nameWords[i]);
    return misspelt.length === 1 && aTypoAway(typedWords[misspelt[0]!]!, nameWords[misspelt[0]!]!);
}

/** The sentence, with every name they know written as it is spelled. */
export function inTheSpellingOfTheNamesTheyKnow(said: string, names: readonly string[]): string {
    const known = [...new Set(names.filter(name => name.trim().length >= 4))]
        // Longest first, so "Iron Crest Pass" is tried before "Iron Crest".
        .sort((a, b) => b.length - a.length);
    let out = said;
    for (const name of known) {
        const width = name.trim().split(/\s+/).length;
        const words = out.split(/(\s+)/);
        const lower = name.toLowerCase();
        for (let i = 0; i < words.length; i += 2) {
            // A stretch of `width` words, with the separators between them, and a possessive
            // or punctuation kept off the end.
            const stretch = words.slice(i, i + width * 2 - 1).join('');
            const tail = /(?:'s|s'|[.,!?;:])+$/i.exec(stretch)?.[0] ?? '';
            const bare = stretch.slice(0, stretch.length - tail.length);
            if (bare === name) continue;
            const candidate = bare.toLowerCase();
            if (candidate === lower || nearlyThisName(candidate, lower, width)) {
                words.splice(i, width * 2 - 1, name + tail);
            }
        }
        out = words.join('');
    }
    return out;
}
