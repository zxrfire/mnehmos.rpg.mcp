/**
 * Which wound an ordinary injury is.
 */

import type { InjurySeverity, InjurySource } from '../../schema/cultivation.js';

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
