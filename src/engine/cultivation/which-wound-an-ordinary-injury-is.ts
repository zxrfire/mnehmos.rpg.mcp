/**
 * Which wound an ordinary injury is.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A seeded world advanced four hundred years:
 *
 *     injuries carried by NPCs   192
 *     with no wound type         128
 *       failed_breakthrough       83
 *       combat                    30
 *       qi_deviation              15
 *
 * Two thirds of everything anybody was carrying was a row with `woundType:
 * null` and a description composed out of two enums - "A serious meridian
 * injury, taken in combat." The authored table in `data/cultivation/wounds.ts`
 * was reachable only from the crossing-failure path, which names the wound it
 * inflicts because the whole point of that table is that a wound has a
 * DIAGNOSIS - a parted channel, a burnt span, a base left unfinished are each a
 * different thing a physician would say and a different answer to "can this be
 * treated". Everything else in the engine minted wounds anonymously.
 *
 * That sentence used to read "a cracked core and a ruined dantian are different
 * diagnoses", and it is worth saying why it does not any more, because the
 * reasoning survived the example. This setting says CORE and has exactly one
 * core wound, so those two were never two diagnoses - they were one wound
 * carrying a borrowed word on the second row. The point the sentence was making
 * is unaffected: a named wound and an anonymous one are different, and the
 * catalog exists so the engine can say WHICH thing happened.
 *
 * That is not the fabrication defect it was reported as. These are real minted
 * injuries from real events, not `Injury` objects expanded out of an integer
 * count - `carryingWounds` and `combatantOf` were fixed for that separately.
 * They are wounds the engine knew everything about except what to call them,
 * because there was nowhere that said what an ordinary one is.
 *
 * ── The rule ─────────────────────────────────────────────────────────────
 *
 * Ordinary wounds only. Nothing here returns a permanent row, and nothing here
 * returns a broken status: a maiming and a cracked core are outcomes something
 * decided, and a default that could hand one out would let a bar-room brawl
 * produce the population the crossing table exists to produce. What this maps is
 * the difference the engine already knew and was throwing away - a channel
 * opened along its length is not the same injury as a channel burned by qi
 * forced through it faster than it could pass - and both of those are rows in
 * the catalog with treatments, presentations and a physician's account of what
 * closes them.
 *
 * ── Deterministic, and deliberately not seeded ───────────────────────────
 *
 * A pure function of source and severity, with no RNG. Every call site here
 * shares its stream with the resolver that called it, and drawing one more
 * sample would shift every subsequent draw in that stream - which would change
 * the outcome of runs already recorded, from a change that is supposed to be
 * about what a wound is CALLED.
 */

import type { InjurySeverity, InjurySource } from '../../schema/cultivation.js';
import { getWoundType } from '../../data/cultivation/wounds.js';

/**
 * A channel opened along its length. The general case, and the only ordinary
 * row that carries all three severities.
 */
const TORN = 'torn-meridians';

/**
 * A channel burned rather than torn, because qi went through it faster than it
 * could pass. Minor and serious only - the catalog does not admit a crippling
 * scorching, and at that point the channel has gone.
 */
const SCORCHED = 'scorched-channels';

/**
 * Sources where the mechanism is qi forced through too fast rather than the
 * body being opened.
 *
 * Deviation is the definition of it. Tribulation is lightning going through a
 * body along the channels that will carry it. Backlash is a technique returning
 * its own output. All three are burns.
 */
const BURNS: ReadonlySet<InjurySource> = new Set<InjurySource>([
    'qi_deviation',
    'tribulation',
    'backlash'
]);

/**
 * The catalog key for an ordinary injury of this source and severity.
 *
 * Never null: the fallback is the row that carries every severity, so a source
 * added later gets a wound with a name rather than no wound type at all.
 */
export function ordinaryWoundFor(source: InjurySource, severity: InjurySeverity): string {
    if (BURNS.has(source) && severity !== 'crippling') return SCORCHED;
    return TORN;
}

/**
 * Every key this module can return, for the test that keeps it honest.
 *
 * The invariant worth asserting is not which key comes back but that none of
 * them is permanent and all of them exist - see the rule above.
 */
export const ORDINARY_WOUND_KEYS: readonly string[] = [TORN, SCORCHED];

/** True where this key names something this module would hand out. */
export function isOrdinaryWound(key: string | null | undefined): boolean {
    return key !== null && key !== undefined && ORDINARY_WOUND_KEYS.includes(key)
        && getWoundType(key) !== null;
}
