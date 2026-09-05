/**
 * Which wound an ordinary injury is.
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
 * Sources where the mechanism is qi forced through too fast rather than the body
 * being opened.
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
