/**
 * What a player can actually do about somebody they cannot fight.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES, AND IT IS THE LAST HOP
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `assessGap` returns `REAL_OPTIONS` on `GapAssessment.options` whenever the
 * verdict is `helpless`, and its own comment says what they are: *"Not
 * consolation text - these are the branches the world genuinely permits, and
 * every one of them is a different tool call."* That list rides on
 * `ConfrontationResult.gap`, through the tool projection, into the web layer,
 * and was never printed. Measured in play: a Qi Condensation 6 attacking a
 * Grand Ascension NPC got six identical no-contests and not one word about what
 * would have worked.
 *
 * AGENTS.md: **a refusal names a route.** Here the route was computed, correct,
 * already in the payload, and thrown away by the layer that talks to the player.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND PRINTING THE LIST RAW WOULD HAVE BEEN WORSE THAN DROPPING IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This is the part that took the work. `REAL_OPTIONS` has nine entries and
 * **five of them have no verb behind them**. Printing all nine would be the
 * narrator inventing affordances - the failure AGENTS.md names by example,
 * *"it writes 'you could try climbing the wall' where there is no climb
 * verb"* - and it would do it in the one moment a player is desperate enough to
 * try every line in the paragraph.
 *
 * So each option is mapped to the sentence a player would actually type, and an
 * option with nothing behind it is NOT printed. What it is instead is written
 * down in {@link NO_VERB_CARRIES_THESE}, because an absence nobody records gets
 * mistaken for a design decision.
 *
 * `tests/web/gap-routes.test.ts` asserts that every entry in `REAL_OPTIONS` is
 * either mapped or listed as unreachable, so a tenth option cannot be added
 * without somebody saying which of the two it is.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE LIST IS KEEPABLE NOW AND WAS NOT BEFORE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * When `REAL_OPTIONS` was written, *"flee, and accept being hunted"* was a
 * `move` intent that resolved as a journey, and there was no moment in which to
 * negotiate with somebody who was already swinging. A fight is now something a
 * player stands inside for several turns, breaking off is `attemptFlight` with
 * a priced chance, and a shout asks a real question about who is able and
 * willing. Each of the four routes below is a promise the game can keep, and
 * that is the bar for printing one.
 *
 * Pure. No state, no I/O, no engine call.
 */

/**
 * A branch that is open to somebody who cannot win the fight in front of them.
 *
 * Rendered the way `linesFor` renders an affordance - `"what you would say" -
 * why` - because that is the shape this game already teaches a route in, and a
 * player who has seen the affordance row reads it without being told.
 */
export interface RouteOutOfAGap {
    /** The engine's own option, verbatim, so the mapping is auditable. */
    option: string;
    /** What a player would actually type. */
    say: string;
    /** Why it is the thing that works against somebody this far above you. */
    because: string;
}

/**
 * The leading word of each engine option, which is what the mapping keys on.
 *
 * Matched on the OPENING of the string rather than the whole of it, so a
 * reworded tail does not silently unmap a route. A reworded HEAD does unmap it,
 * and that is deliberate: the option drops out of the printed list rather than
 * being attached to the wrong sentence, and the test catches it the same day.
 */
const CARRIED_BY: ReadonlyArray<{ starts: string; say: string; because: string }> = Object.freeze([
    {
        starts: 'flee',
        say: 'I get out of here',
        because:
            'the first thing that works, and the only one that works while they are looking at '
            + 'you. Going is a road out of here rather than a fight you lose more slowly.'
    },
    {
        starts: 'negotiate',
        say: 'I talk to them',
        because:
            'somebody who can end you without effort has no reason to and might have a reason '
            + 'not to. What they want is the whole of what you have to work with.'
    },
    {
        starts: 'seek protection',
        say: 'I call on somebody who owes me',
        because:
            'not willingness - reach. Somebody who can actually stand in front of them will do '
            + 'it for a tie they already hold, and the tie is the thing to go and build first.'
    },
    {
        starts: 'prepare',
        say: 'I go and cultivate',
        because:
            'the gap is realms rather than nerve, and nothing carried into a fight closes it. '
            + 'Coming back higher is the only answer that changes the arithmetic.'
    }
]);

/**
 * Options the engine offers that nothing in the game can currently carry out.
 *
 * NOT a to-do list and not a complaint. It is the honest half of the mapping
 * above: these are real branches of the world that a player has no sentence
 * for, and each is a design question rather than a missing pattern.
 *
 *   hide                    there is no concealment state anywhere. `opening:
 *                           'from_concealment'` is a property of how a fight
 *                           STARTS, decided by the sentence, and not a thing
 *                           somebody can be in.
 *   exploit terrain         `Edge` is priced and every played fight passes
 *                           `edges: []`. A player has never brought one and
 *                           cannot choose one.
 *   the specialised counter the tradition layer has real counters - a soul art
 *                           against a Drawn cultivator, and the Cut's immunity
 *                           to one - and nothing lets a player select an
 *                           approach on that axis.
 *   avoid detection         the same absence as `hide`, from the other side.
 *
 * `manipulate a third party` is deliberately not here and also not mapped: it
 * is `interact` with leverage, which exists, but it is the same sentence as
 * `negotiate` from the player's side, and printing two routes that are typed
 * identically teaches nothing. The engine keeps them apart because the TARGET
 * differs; the player says the same words either way.
 */
export const NO_VERB_CARRIES_THESE: readonly string[] = Object.freeze([
    'hide',
    'exploit terrain',
    'find the specialised counter',
    'avoid detection',
    'manipulate a third party'
]);

/**
 * The routes worth naming, out of whatever the engine offered.
 *
 * Order is the engine's, which is already the order that helps: `REAL_OPTIONS`
 * leads with fleeing and ends with not being found, and that is the order
 * somebody in front of something enormous needs them in.
 */
export function routesOutOfAGap(options: readonly string[]): RouteOutOfAGap[] {
    const routes: RouteOutOfAGap[] = [];
    for (const option of options) {
        const carried = CARRIED_BY.find(row => option.startsWith(row.starts));
        if (carried) routes.push({ option, say: carried.say, because: carried.because });
    }
    return routes;
}

/**
 * The routes as a player reads them, or nothing at all.
 *
 * Returns an empty array rather than a consolation sentence when nothing is
 * carried, because a refusal that names no route is at least honest, and one
 * that names a route the game cannot keep is not.
 *
 * Deliberately NOT a nine-line dump. AGENTS.md: nothing reads as a dump, and a
 * paragraph of clauses is the engine talking to itself in front of the player.
 * The lead sentence says what the list IS - the things that work against
 * somebody this far above you - so the player reads it as the answer to what
 * they just tried rather than as a menu.
 */
export function sayingWhatWouldWork(
    routes: readonly RouteOutOfAGap[],
    them: string
): string[] {
    if (routes.length === 0) return [];
    return [
        `What works against ${them} is not a better swing. It is one of these:`,
        ...routes.map(r => `"${r.say}" - ${r.because}`)
    ];
}
