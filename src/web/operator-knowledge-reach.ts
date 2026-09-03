/**
 * An operator reaching past what the played cultivator has heard of.
 *
 * ══ THE RULE, AND IT IS ONE LINE ══════════════════════════════════════════
 *
 *   REACHING LIFTS THE AWARENESS GATE FOR ONE OPERATOR LINE. IT LIFTS NOTHING
 *   ELSE, IT WRITES NOTHING, AND IT ENDS WITH THE LINE.
 *
 * The design owner, in four words: *"operator can bypass knowledge checks."*
 * The reason is the same reason this whole surface exists - an operator's job is
 * to stand the world in a state ordinary play would take four hundred years to
 * reach, and being subject to one cultivator's ignorance is exactly what stops
 * them. A name that cultivator has never had said in front of them does not
 * resolve, a place held below `REACHABLE_FROM` cannot be travelled to, and a
 * house they have never met cannot be asked about. All three are right for a
 * player and all three are in an operator's way.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────
 *
 * IT IS NOT A BYPASS OF A RULE. `docs/admin.md` already draws this line for the
 * content gates and it is the same line here: an operator may REACH a name, and
 * the act they then force still costs exactly what it costs and still writes
 * exactly what it writes. Nothing below touches an admission bar, a trial
 * requirement, a price, a rung, or anybody's willingness. The predicate this
 * lifts answers *may this name be said*, and there is nothing else in it.
 *
 * IT IS NOT KNOWLEDGE. Nothing here writes a row and nothing here is read by
 * `awareness()`, so the holder's own map of the world is untouched: after a
 * reached line they have heard of exactly what they had heard of before it.
 * That is the whole difference from `grant_knowledge`, which is the action for
 * actually giving somebody the names and writes ordinary rows to do it. There is
 * still no admin-knows-everything FLAG, for the reason `admin-manage.ts` gives:
 * a stored flag that read as knowledge would be a second source of truth beside
 * the table, and the first surface that forgot to check it would quietly
 * disagree with the rest of the game.
 *
 * ── WHY A CONTEXT, AND WHY THAT IS THE THING THAT KEEPS IT HONEST ────────
 *
 * The failure mode to avoid is a resolver that quietly stops gating because a
 * flag was left set. A flag can be left set. An `AsyncLocalStorage` scope cannot
 * be: it exists for the duration of one call and is gone when that call returns,
 * so "lifted for that line only" is true by construction rather than by
 * somebody remembering to clear it.
 *
 * Same shape and same reasoning as `forcing-an-attempt-to-land.ts`, which is the
 * sibling of this file: a context rather than an argument, because an argument
 * is a field a model can set and a model is in this path. A model may read an
 * ADMIN line and phrase the answer; it may never decide that a gate is open.
 *
 * ── AND IT IS SCOPED TO ONE HOLDER ───────────────────────────────────────
 *
 * The holder is the played cultivator, named at the door. Everybody else's
 * knowledge is untouched for the whole of the reached line, which matters more
 * than it looks: a forced wrong is answered by people who found out about it,
 * and lifting the gate for THEM would hand the world grudges nobody could have
 * held. What an operator reaches past is their own character's ignorance.
 *
 * ── AND IT SAYS SO ───────────────────────────────────────────────────────
 *
 * Every lift is recorded on the context so the surface can print it. A gate
 * lifted silently is indistinguishable from a gate that was never there, and
 * this one has to be as loud as the banner over every other admin line.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/** One name reached past, for the receipt. */
export interface ReachedPast {
    /** The predicate that would have refused: what it was asked. */
    readonly asked: 'isAwareOf' | 'canPointAt';
    /** `cultivator`, `sect`, `place` or `event`. */
    readonly kind: string;
    /** The row id, catalog id or place key. */
    readonly id: string;
}

/** One operator line, alive for exactly the duration of that line. */
export interface OperatorReach {
    /** The played cultivator. Nobody else's gate moves. */
    readonly holderId: string;
    /**
     * What was actually reached past, in the order it was asked, without
     * repeats. Filled as the line runs.
     *
     * Capped, because a single `look` asks the place gate about every row in the
     * gazetteer and a receipt is not a log. What the cap costs is a complete
     * list; what it buys is that the operator reads the line at all.
     */
    readonly reached: ReachedPast[];
}

/** How many lifts a receipt will name before it stops collecting them. */
export const REACHES_NAMED_IN_A_RECEIPT = 12;

const CURRENT = new AsyncLocalStorage<OperatorReach>();

/**
 * Run `fn` with the operator reaching past this holder's awareness.
 *
 * The ONLY way into the context. `holderId` of null opens nothing at all, which
 * is what an ADMIN line with the mode off gets - the caller decides, in one
 * place, and there is no second door.
 */
export async function withTheOperatorReaching<T>(
    holderId: string | null,
    fn: () => Promise<T>
): Promise<{ result: T; reach: OperatorReach | null }> {
    if (holderId === null) return { result: await fn(), reach: null };
    const reach: OperatorReach = { holderId, reached: [] };
    const result = await CURRENT.run(reach, fn);
    return { result, reach };
}

/**
 * Whether an operator is reaching past this holder's gate right now.
 *
 * Call it AFTER the real lookup has answered no, never instead of it: a gate
 * that stops asking is a gate that has stopped being one, and what is wanted is
 * a gate that answers honestly and is then overridden for one line.
 *
 *     if (this.awareStmt.get(...) !== undefined) return true;
 *     return theOperatorReachesPast(holderId, 'isAwareOf', kind, id);
 */
export function theOperatorReachesPast(
    holderId: string,
    asked: ReachedPast['asked'],
    kind: string,
    id: string
): boolean {
    const reach = CURRENT.getStore();
    if (reach === undefined) return false;
    if (reach.holderId !== holderId) return false;
    if (reach.reached.length < REACHES_NAMED_IN_A_RECEIPT
        && !reach.reached.some(r => r.asked === asked && r.kind === kind && r.id === id)) {
        reach.reached.push({ asked, kind, id });
    }
    return true;
}

/** What the receipt says about a reach, or null when nothing was reached past. */
export function whatTheOperatorReachedPast(reach: OperatorReach | null): string | null {
    if (reach === null || reach.reached.length === 0) return null;
    const named = reach.reached.map(r => `${r.kind} ${r.id}`).join(', ');
    return 'ADMIN reached past what this cultivator has heard of: ' + named
        + `${reach.reached.length >= REACHES_NAMED_IN_A_RECEIPT ? ', and more' : ''}. `
        + 'The awareness gate was lifted for this line and nothing else was - no name was '
        + 'learned, no record was written, and every bar, price and refusal behind it still '
        + 'stands. This cultivator has heard of exactly what they had heard of before it.';
}
