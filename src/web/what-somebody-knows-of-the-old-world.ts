/** The old world's records, as facts somebody can tell or read where they are held. */

import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import { stageCeilingFor } from '../engine/social/discovery.js';

import {
    CALENDARS, DRIVEN_GROUND_AND_THE_NODE, PRESENT_YEAR, SECT_ARCHIVE,
    THE_CALENDAR_OFFSET, THE_FIRST_CULTIVATORS, THE_LID,
    WHAT_THE_OFFSET_HIDES, WHY_THE_RECONCILIATION_IS_NOT_MADE
} from '../data/cultivation/history.js';
import {
    ABANDONED_IS_NOT_CONDEMNED, HOW_AN_UPKEEP_IS_READ, MODERN_AND_ANCIENT,
    THE_EXTINCTION_IS_SYMMETRIC, THE_RUIN_MEDICINE, THE_TRADE
} from '../data/cultivation/lost-ages.js';
import {
    A_RESTING_PLACE_IS_NOT_A_GRAVE, A_RUIN_IS_TYPICALLY_MORE_EPIC_THAN_A_CAVE,
    THE_THREE_GATES, THE_THREE_WAYS_GROUND_IS_CLOSED, WHY_CLOSED_GROUND
} from '../data/cultivation/inheritance-trials.js';
import { SEALED_ANCESTOR_PATTERN, THE_BINDING_CONSTRAINT } from '../data/cultivation/sealed-ancestors.js';
import {
    DEATHS_AVAILABLE, THE_HOLLOW_COURT_COULD, THE_REVOLT, WHO_HOLDS_A_KEY,
    WHY_THE_HEAD_IS_PINNED
} from '../data/cultivation/the-top-of-the-world.js';
import {
    IDENTIFYING_A_SEAT, THE_CANDIDATE_REGISTER, THE_OPEN_AXIS, THE_PRESENT_COUNT
} from '../data/cultivation/false-immortals.js';
import { ATTESTATION_IS_USABILITY } from '../data/cultivation/named-figures.js';
import { getPill } from '../data/cultivation/pills.js';
import { idsForFaction } from '../data/cultivation/governance-and-water-rights.js';
import { REALM_TIERS } from '../engine/cultivation/realms.js';
import { INSIDER_ONLY_FLOOR, WORKING_KNOWLEDGE_MARGIN } from './lore.js';
import type { ResolvedEntity } from './entities.js';
import type { KnowledgeGate } from './knowledge.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';

interface RecordFact {
    id: string;
    name: string;
    topic: RegExp;
    lines: readonly string[];
    ordinal: number;
    /** Absent for circulated knowledge; present for a record held inside these houses. */
    holders?: readonly string[];
    archived: boolean;
}

const floor = (key: string) => REALM_TIERS.find(realm => realm.key === key)!.ordinalStart;
const foundation = floor('foundation_establishment');
const core = floor('core_formation');
const nascent = floor('nascent_soul');
const voidRealm = floor('void_tribulation');
const lastRealm = floor('tribulation_transcendence');

/** Values remain in their catalogs; this table selects what a question asks for. */
function records(peaceYear: number): RecordFact[] {
    const row = (id: string, name: string, topic: RegExp, lines: readonly string[], ordinal: number,
        holders?: readonly string[], archived = true): RecordFact =>
        ({ id: `old-world-${id}`, name, topic, lines, ordinal, holders, archived });
    const medicine = getPill(THE_RUIN_MEDICINE.pillId)!;
    return [
        row('nodes', 'nodes and carved seams', /\b(?:nodes?|carved seams?|driven ground|reconciliation)\b/i,
            DRIVEN_GROUND_AND_THE_NODE.knowledge, foundation, DRIVEN_GROUND_AND_THE_NODE.heldBy),
        row('reconciliation', 'the two traditions', /\b(?:reconciliation|two traditions|nodes? and (?:carved )?seams?)\b/i,
            WHY_THE_RECONCILIATION_IS_NOT_MADE, foundation, DRIVEN_GROUND_AND_THE_NODE.heldBy),
        row('archive', 'sect archives', /\b(?:archives?|old records|stipend rolls)\b/i, SECT_ARCHIVE.knowledge, 0),
        row('calendar', 'the provincial calendars', /\b(?:calendar|reckoning|current year|what year|offset)\b/i,
            [`The commercial count is year ${peaceYear} of the ${CALENDARS.find(calendar => calendar.id === 'calendar-great-peace')!.name.replace(/^The /, '')}, or ${peaceYear - THE_CALENDAR_OFFSET.commercialYears} by ${CALENDARS.find(calendar => calendar.id === 'calendar-face-years')!.name}. Contracts use an offset of ${THE_CALENDAR_OFFSET.commercialYears} years; no shared dated event verifies it.`], 0),
        row('survey-offset', 'the survey calendar offset', /\b(?:calendar|reckoning|offset)\b/i,
            [`The Temple's survey notes compute an offset of ${THE_CALENDAR_OFFSET.surveyYears} years. That differs from commercial practice.`], foundation, ['house-immovable-mountain']),
        row('inheritance-offset', 'the inheritance calendar offset', /\b(?:calendar|reckoning|offset)\b/i,
            [`The Palace's unpublished inheritance computation gives ${THE_CALENDAR_OFFSET.inheritanceYears} years. Commercial contracts use ${THE_CALENDAR_OFFSET.commercialYears}.`], foundation, ['house-ninefold-karma']),
        row('founding-dates', 'discrepancies in the founding dates', /\b(?:offset hides|date discrepancies|inconsistent dates)\b/i,
            WHAT_THE_OFFSET_HIDES.slice(0, 1), foundation, ['house-immovable-mountain']),
        row('estate-dates', 'discrepancies in the inheritance dates', /\b(?:offset hides|date discrepancies|inconsistent dates)\b/i,
            WHAT_THE_OFFSET_HIDES.slice(1, 2), foundation, ['house-ninefold-karma']),
        row('border-dates', 'discrepancies in the border accounts', /\b(?:offset hides|date discrepancies|inconsistent dates)\b/i,
            WHAT_THE_OFFSET_HIDES.slice(2), foundation, ['house-shrinking-earth']),
        row('first', 'the first cultivators', /\b(?:first cultivators?|origin of cultivation|cultivation began)\b/i,
            THE_FIRST_CULTIVATORS.knowledge, foundation, THE_FIRST_CULTIVATORS.heldBy),
        row('lid', 'the Lid', /\b(?:the lid|boundary (?:above|between)|limit of the world)\b/i,
            THE_LID.knowledge, nascent, THE_LID.heldBy),
        row('abandoned', 'abandoned arts', /\b(?:abandoned|condemned) arts?\b/i, ABANDONED_IS_NOT_CONDEMNED.knowledge, core),
        row('upkeep', 'ancient art upkeep', /\b(?:ancient.*(?:upkeep|materials)|material.gated arts?)\b/i, HOW_AN_UPKEEP_IS_READ.knowledge, nascent),
        row('ancient', 'modern and ancient arts', /\b(?:modern|ancient) arts?\b/i, MODERN_AND_ANCIENT.knowledge, core),
        row('extinction', 'the longevity flower extinction', /\b(?:extinct.*(?:flower|longevity)|longevity flower|extinction)\b/i,
            THE_EXTINCTION_IS_SYMMETRIC.knowledge, voidRealm, ['sect-hollow-court']),
        row('medicine', 'ruin longevity medicine', /\b(?:ruin medicine|ancient longevity|immortal longevity|thousand.year pill)\b/i,
            [`${medicine.name} grants ${medicine.potency} years. Its ingredient is extinct; surviving doses were refined before the extinction.`], nascent),
        row('trade', 'medicine offered through an ancestor', /\b(?:send.*flower|ancestor.*pill|medicine trade)\b/i,
            THE_TRADE.knowledge, voidRealm),
        row('resting', 'resting chambers and graves', /\b(?:resting (?:place|chamber)|grave.*(?:seal|sleep)|grave or)\b/i,
            A_RESTING_PLACE_IS_NOT_A_GRAVE.knowledge, foundation),
        row('ruin', 'abandoned seats and caves', /\b(?:ruins?.*caves?|empty seats?|abandoned (?:seat|mountain))\b/i,
            A_RUIN_IS_TYPICALLY_MORE_EPIC_THAN_A_CAVE.knowledge, foundation),
        row('gates', 'inheritance trial gates', /\b(?:trial gates?|three gates|inheritance.*(?:gate|test))\b/i, THE_THREE_GATES.knowledge, foundation),
        row('access', 'closed ground access', /\b(?:closed ground.*(?:access|floor|cap)|entry cap|elder floor|survival floor)\b/i,
            THE_THREE_WAYS_GROUND_IS_CLOSED.knowledge, foundation),
        row('closed', 'closed ground', /\bclosed ground\b/i, [WHY_CLOSED_GROUND.knowledge[0]!], foundation),
        row('seal', 'sealed ancestors', /\b(?:sealed ancestors?|wake conditions?)\b/i, SEALED_ANCESTOR_PATTERN.knowledge, voidRealm),
        row('window', 'a waking window', /\b(?:waking window|binding constraint|who holds.*after)\b/i, THE_BINDING_CONSTRAINT.knowledge, voidRealm),
        row('apex-death', 'an apex head dying', /\b(?:kill.*apex|apex.*(?:die|death|killed|mortal))\b/i, DEATHS_AVAILABLE.knowledge, lastRealm),
        row('court', 'the Court and the apexes', /\b(?:court.*apex|hollow court could|empyrean court could)\b/i,
            THE_HOLLOW_COURT_COULD.knowledge, lastRealm, ['sect-hollow-court'], false),
        row('revolt', 'a revolt against an apex', /\b(?:revolt|apex.*clients)\b/i, THE_REVOLT.knowledge, lastRealm),
        row('key', 'sealed strength against an apex', /\b(?:who holds a key|sealed.*apex|ancestors?.*apex)\b/i, WHO_HOLDS_A_KEY.knowledge, lastRealm),
        row('pinned', 'an apex head at its artifact', /\b(?:pinned head|head.*(?:pinned|vault)|apex.*(?:travel|leave))\b/i, WHY_THE_HEAD_IS_PINNED.knowledge, voidRealm),
        row('seats', 'identifying a Court seat', /\b(?:identify.*seat|identifying.*seat|seat identit)\b/i,
            IDENTIFYING_A_SEAT.knowledge, voidRealm, THE_CANDIDATE_REGISTER.heldBy),
        row('candidates', 'the candidate register', /\b(?:candidate register|returned crossers?)\b/i,
            THE_CANDIDATE_REGISTER.knowledge, voidRealm, THE_CANDIDATE_REGISTER.heldBy),
        row('dao', 'a False Immortal continuing its dao', /\b(?:false immortal.*(?:dao|understanding)|open axis)\b/i, THE_OPEN_AXIS.knowledge, lastRealm),
        row('protectors', 'reserved protector posts', /\b(?:false immortal.*protectors?|reserved.*posts?|present count)\b/i,
            THE_PRESENT_COUNT.knowledge.slice(0, 1), voidRealm),
        row('guest', 'the Court guest and its reserved post', /\b(?:court.*(?:guest|protector)|present count)\b/i,
            THE_PRESENT_COUNT.knowledge.slice(1), voidRealm, ['sect-hollow-court'], false),
        row('names', 'addressing an ancestor by name', /\b(?:attestation|ceremonial names?|ancestor.*name|usable names?)\b/i, ATTESTATION_IS_USABILITY.knowledge, foundation)
    ];
}

function canRead(row: RecordFact, speaker: Pick<RosterEntry, 'realmOrdinal' | 'sectId'>): boolean {
    if (row.ordinal > speaker.realmOrdinal + WORKING_KNOWLEDGE_MARGIN) return false;
    if (!row.holders) return true;
    if (speaker.sectId === null) return false;
    const ids = idsForFaction(speaker.sectId);
    return row.holders.some(holder => holder === speaker.sectId || ids.includes(holder));
}

/** Recognising the topic does not grant its facts to somebody unable to read them. */
export function whatSomebodyKnowsOfTheOldWorld(topic: string, speaker: Pick<RosterEntry, 'realmOrdinal' | 'sectId'>,
    peaceYear: number): { subject: ResolvedEntity; records: RecordFact[]; holdsIt: boolean } | null {
    const matching = records(peaceYear).filter(row => row.topic.test(topic));
    if (matching.length === 0) return null;
    const held = matching.filter(row => canRead(row, speaker));
    const first = (held[0] ?? matching[0])!;
    return {
        subject: { kind: 'lore', id: first.id, name: first.name,
            facts: held.flatMap(row => [...row.lines]),
            structure: [`ordinal ${held.length ? first.ordinal : INSIDER_ONLY_FLOOR}; surviving record, not an observation.`] },
        records: held,
        holdsIt: held.length > 0
    };
}

/** Save what was actually said, so recall cannot consult an undisclosed catalog fact. */
export function keepOldWorldKnowledge(gate: KnowledgeGate, cultivator: Cultivator, run: Run,
    recordsSaid: readonly RecordFact[], source: { kind: 'told' | 'read'; name: string; id?: string },
    said?: readonly string[]): boolean {
    let learned = false;
    for (const row of recordsSaid) {
        row.lines.forEach((line, index) => {
            if (said !== undefined && !said.includes(line)) return;
            learned = gate.learnIfNew({ holderId: cultivator.id, kind: 'event', id: `${row.id}-${index}`, name: row.name,
                statement: line, stance: 'believes', stage: stageCeilingFor(source.kind), onDay: Math.floor(run.elapsedDays),
                sourceKind: source.kind, sourceNote: source.name, fromHolderId: source.id }) || learned;
        });
    }
    return learned;
}

/** The archive's holdings are the house's records, rather than the visitor's standing. */
export function oldWorldArchive(houseId: string, peaceYear: number, houseOrdinal: number): RecordFact[] {
    return records(peaceYear).filter(row => row.archived
        && canRead(row, { sectId: houseId, realmOrdinal: houseOrdinal }));
}

/** The running era owns the date across runs; a run clock is only the no-world fallback. */
export function oldWorldYear(world: WorldState | null, elapsedDays: number): number {
    const present = world?.history.eras.find(era => era.endDay === null);
    return world && present
        ? Math.floor((world.currentDay - present.startDay) / DAYS_PER_YEAR)
        : PRESENT_YEAR + Math.floor(elapsedDays / DAYS_PER_YEAR);
}
