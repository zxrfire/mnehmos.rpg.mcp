/**
 * What a body shows to somebody standing in front of it.
 *
 * The world's people have carried wounds since `carryingWounds` was written, and
 * the only thing that ever read one into a scene was a COUNT: `untreatedInjuries
 * > 0` puts somebody at `mending` and nothing else anywhere said what was wrong
 * with them. So a one-armed elder and a man with a bruise read out identically,
 * and the elder's arm existed only as a row nobody looked at.
 *
 * The text was already written. Every row in `wounds.ts` carries a
 * `presentation` - *"what somebody who has this is LIKE to meet"* - authored
 * alongside the wound and read, until now, by nothing in `src/`.
 *
 * ── IT PASSES THE PERCEPTION TEST BECAUSE OF HOW IT IS WRITTEN ───────────
 *
 * AGENTS.md forbids handing the narrator a fact the eye cannot reach, and names
 * three ways out. This is the third: SAY THE BEHAVIOUR AND LET THE READER
 * CONCLUDE. The presentations are authored as manner rather than as diagnosis -
 * somebody favouring one side, somebody who sends every question indoors,
 * somebody with a half-second between deciding and moving - which is exactly
 * what a stranger in a square gets. Several of them say outright that the
 * underlying fact is not advertised, and that is the same sentence: what shows
 * is the care taken to hide it.
 *
 * So this hands over the presentation and never the wound's name, its severity,
 * its key, or what would treat it. Those are the record, and the record is not
 * on anybody's face.
 *
 * ── ONE WOUND, NOT THE LIST ──────────────────────────────────────────────
 *
 * Somebody carrying four wounds is not four paragraphs. A reader takes in the
 * thing that is most obviously true of a person and nothing else on a first
 * look, and a list would read as a medical note - which is the record again,
 * wearing prose.
 *
 * ── AND IT COSTS THE WORLD ADVANCE NOTHING ───────────────────────────────
 *
 * Read on demand, over one person, at the moment somebody looks at them. There
 * is no pass, nothing to expire and nothing to keep current, which is the same
 * shape `bodyStandingOn` already has for the body it reads.
 */

import { getWoundType, isPermanentWound } from '../../data/cultivation/wounds.js';
import { INJURY_SEVERITY_ORDER } from '../cultivation/injuries.js';
import type { Injury } from '../../schema/cultivation.js';
import { woundsCarriedBy, type NpcRecord } from './npc-state.js';

/**
 * The wound that decides how somebody reads, or null.
 *
 * Permanent first, then by severity, then the oldest - a maiming is what anybody
 * notices whatever else is open, and between two of a kind the one that has been
 * shaping how they move for longer is the one that has shaped it more.
 *
 * Treated wounds are skipped. A closed wound is scar tissue, it costs what
 * `scarTempering` prices it at, and it is not what somebody looks like now.
 */
export function theWoundThatShows(injuries: readonly Injury[]): Injury | null {
    let worst: Injury | null = null;
    for (const injury of injuries) {
        if (injury.treated) continue;
        if (getWoundType(injury.woundType) === null) continue;
        if (worst === null || ranks(injury) > ranks(worst)) worst = injury;
        else if (
            ranks(injury) === ranks(worst)
            && injury.sustainedOnTurn < worst.sustainedOnTurn
        ) worst = injury;
    }
    return worst;
}

function ranks(injury: Injury): number {
    const severity = INJURY_SEVERITY_ORDER.indexOf(injury.severity);
    return (isPermanentWound(injury.woundType) ? 10 : 0) + Math.max(0, severity);
}

/**
 * What this person is like to meet, where their body has anything to say.
 *
 * Null is the common answer and the right one: most people are not carrying
 * anything, and a scene fact that says so about everybody is noise.
 *
 * Reads through `woundsCarriedBy` rather than the array, so a row loaded from a
 * save that holds a count and no list still reads - it reconstructs generic
 * rows with a null `woundType`, which this correctly finds nothing authored for
 * and skips. A number is not a thing anybody can look at.
 */
export function whatTheirBodyShows(npc: NpcRecord): string | null {
    const showing = theWoundThatShows(woundsCarriedBy(npc));
    if (showing === null) return null;
    return getWoundType(showing.woundType)?.presentation ?? null;
}
