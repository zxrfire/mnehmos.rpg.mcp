/**
 * Inheritance grounds: reaching one, reading it from outside, going in, and taking
 * what is behind the door.
 */

import type Database from 'better-sqlite3';

import type { Cultivator, FoundationQuality, Insight, InnateAttributes } from '../schema/cultivation.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import type { CombatantInput } from '../engine/cultivation/combat.js';
import { mayBeNamed, type Awareness } from '../data/cultivation/hierarchy.js';
import {
    SITES,
    getSite,
    outsideViewOf,
    // What the GROUND does, as opposed to what a gate somebody built does.
    // See `readAccess` at the foot of this file for why the two are separate.
    readAdmission,
    type AdmissionReading,
    type Gate,
    type GateKind,
    type Site,
    type SiteOutsideView
} from '../data/cultivation/inheritance-trials.js';
import { matchScore, MATCH_THRESHOLD } from './entities.js';

// ─────────────────────────────────────────────────────────────────────────
// WHO MAY NAME WHAT
// ─────────────────────────────────────────────────────────────────────────

/** The awareness ladder, ordered, so two records can be compared. */
const AWARENESS_ORDER: readonly Awareness[] = [
    'unaware', 'whisper', 'named', 'placed', 'encountered', 'known'
];

/**
 * How much of a site this cultivator has.
 */
export function awarenessOfSite(site: Site, holderHasRecord: boolean): Awareness {
    const floor = site.outside.startingAwareness;
    if (!holderHasRecord) return floor;
    return AWARENESS_ORDER.indexOf(floor) >= AWARENESS_ORDER.indexOf('named') ? floor : 'named';
}

/**
 * Sites this cultivator could put a name to.
 */
export function nameableSites(holdsRecordFor: (siteId: string) => boolean): Site[] {
    return SITES.filter(site => mayBeNamed(awarenessOfSite(site, holdsRecordFor(site.id))));
}

/**
 * Which site a sentence meant, out of the ones this cultivator may name.
 */
export function resolveSite(query: string, permitted: readonly Site[]): Site | null {
    const wanted = query.trim();
    if (wanted.length < 3) return null;

    let winner: Site | null = null;
    let winning = 0;
    for (const site of permitted) {
        const score = Math.max(matchScore(wanted, site.name), matchScore(wanted, phraseOf(site.id)));
        if (score > winning) {
            winner = site;
            winning = score;
        }
    }
    return winning >= MATCH_THRESHOLD ? winner : null;
}

/** The id slug as a person would say it: `trial-the-eighth-stone` -> `eighth stone`. */
export function phraseOf(siteId: string): string {
    return siteId.replace(/^(?:trial|grave)-/, '').replace(/^the-/, '').replace(/-/g, ' ');
}

/**
 * Every distinctive phrase a player could type to mean a site, longest first.
 */
export const SITE_PHRASES: readonly string[] = [
    ...new Set(SITES.flatMap(site => [
        phraseOf(site.id),
        site.name.toLowerCase().replace(/^(?:the|a|an)\s+/, '')
    ]))
].sort((a, b) => b.length - a.length);

// ─────────────────────────────────────────────────────────────────────────
// THE CLAIMANT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a gate is allowed to read.
 */
export interface Claimant {
    realmOrdinal: number;
    /** Years actually spent at it, which is age minus the age they began at. */
    yearsCultivated: number;
    spiritRootKey: string;
    spiritRootGrade: string;
    foundationQuality: FoundationQuality;
    attributes: InnateAttributes;
    insights: readonly Insight[];
    /** World-state evidence a fate gate may turn on. Never a stat. */
    fate: FateEvidence;
}

/**
 * The world state the fate gates read.
 */
export interface FateEvidence {
    /**
     * Open obligations this cultivator holds that they did not take on -
     * `generation > 0` on the obligations ledger, which is the inheritance
     * case and exactly what "carrying an obligation you did not take on"
     * means.
     */
    obligationsNotTakenOn: number;
}

export function claimantOf(
    cultivator: Cultivator,
    context: { yearsCultivated: number; fate: FateEvidence }
): Claimant {
    return {
        realmOrdinal: cultivator.realmOrdinal,
        yearsCultivated: Math.max(0, context.yearsCultivated),
        spiritRootKey: cultivator.spiritRoot,
        spiritRootGrade: getSpiritRoot(cultivator.spiritRoot).grade,
        foundationQuality: cultivator.foundationQuality,
        attributes: cultivator.attributes,
        insights: cultivator.insights ?? [],
        fate: context.fate
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE GATES
// ─────────────────────────────────────────────────────────────────────────

export interface GateVerdict {
    kind: GateKind;
    met: boolean;
    /**
     * What the door does, in the catalog's own words. Narratable: every
     * string here was authored beside the site and none of it is composed
     * from a template.
     */
    account: string[];
    /**
     * The measure that fell short, where the concept of falling short applies
     * at all. NULL on every fate gate, always, and that is load-bearing: a
     * fate refusal that named a shortfall would be telling the player there
     * is something to go and do, and there is not.
     */
    shortfall: string | null;
    /** The inspector's line. Ordinals, degrees, counts. Never narrated. */
    structure: string;
}

/**
 * "a" or "an", by what the next word actually starts with.
 */
function anArticleFor(phrase: string): string {
    return /^[aeiou]/i.test(phrase) ? 'an' : 'a';
}

/** Whether one age-and-talent requirement is satisfied, and what it asked. */
function talentMeasure(
    requirement: Extract<Gate, { kind: 'age_and_talent' }>['requires'][number],
    claimant: Claimant
): { met: boolean; asked: string; held: string } {
    switch (requirement.measure) {
        case 'years_cultivated':
            return {
                met: claimant.yearsCultivated >= requirement.atLeast,
                asked: `${requirement.atLeast} years at it`,
                held: `${Math.floor(claimant.yearsCultivated)}`
            };
        case 'spirit_root_grade':
            return {
                met: requirement.oneOf.includes(claimant.spiritRootGrade as never),
                asked: `${anArticleFor(requirement.oneOf[0])} ${requirement.oneOf.join(' or ')} root`,
                held: claimant.spiritRootGrade
            };
        case 'spirit_root':
            return {
                met: requirement.oneOf.includes(claimant.spiritRootKey),
                asked: `one of ${requirement.oneOf.join(', ')}`,
                held: claimant.spiritRootKey
            };
        case 'foundation_quality':
            return {
                met: requirement.oneOf.includes(claimant.foundationQuality),
                asked: `${anArticleFor(requirement.oneOf[0])} ${requirement.oneOf.join(' or ')} foundation`,
                held: claimant.foundationQuality
            };
        case 'attribute':
            return {
                met: claimant.attributes[requirement.attribute] >= requirement.atLeast,
                asked: `${requirement.attribute} ${requirement.atLeast}`,
                held: `${claimant.attributes[requirement.attribute]}`
            };
        case 'insight':
            return {
                met: claimant.insights.some(
                    insight => insight.domain === requirement.domain && insight.degree >= requirement.atLeast
                ),
                asked: `${requirement.domain} comprehension at degree ${requirement.atLeast}`,
                held: claimant.insights.length === 0
                    ? 'nothing comprehended'
                    : claimant.insights.map(i => `${i.domain}:${i.degree}`).join(', ')
            };
    }
}

/**
 * Whether world state satisfies a coincidence, and what was consulted.
 */
export function fateEvidenceFor(
    coincidence: Extract<Gate, { kind: 'fate' }>['coincidence'],
    evidence: FateEvidence
): { satisfied: boolean; consulted: string } {
    switch (coincidence) {
        case 'carries_an_obligation':
            return {
                satisfied: evidence.obligationsNotTakenOn > 0,
                consulted:
                    `obligations ledger: ${evidence.obligationsNotTakenOn} open obligation(s) held at ` +
                    'generation > 0, which is business inherited rather than incurred.'
            };
        default:
            return {
                satisfied: false,
                consulted:
                    `coincidence '${coincidence}' turns on world state the engine keeps no ledger for yet. ` +
                    'Not satisfied, and deliberately not distinguishable from an unsatisfied one.'
            };
    }
}

/** One gate, put to one claimant. Pure: reads, decides, mutates nothing. */
export function evaluateGate(gate: Gate, claimant: Claimant): GateVerdict {
    if (gate.kind === 'strength') {
        const met = claimant.realmOrdinal >= gate.ordinal;
        return {
            kind: 'strength',
            met,
            account: met ? [gate.test] : [gate.below, gate.noWorkaround],
            shortfall: met ? null : `${gate.ordinal - claimant.realmOrdinal} rank(s) short of what it is set at`,
            structure:
                `strength gate: set at ordinal ${gate.ordinal}, claimant at ${claimant.realmOrdinal}. ` +
                `${met ? 'Met.' : 'Not met, and there is no route around a strength gate by construction.'}`
        };
    }

    if (gate.kind === 'age_and_talent') {
        const measured = gate.requires.map(requirement => ({
            requirement,
            ...talentMeasure(requirement, claimant)
        }));
        const failed = measured.filter(m => !m.met);
        const met = failed.length === 0;
        return {
            kind: 'age_and_talent',
            met,
            account: met
                ? [gate.test]
                : [gate.below, gate.strengthDoesNotHelp, ...failed.map(f => f.requirement.note)],
            shortfall: met
                ? null
                : failed.map(f => `${f.asked} (holding ${f.held})`).join('; '),
            structure:
                `age_and_talent gate: ${measured.length} measure(s), ${failed.length} unmet` +
                `${failed.length ? ` - ${failed.map(f => `${f.requirement.measure} wants ${f.asked}, holds ${f.held}`).join('; ')}` : ''}. ` +
                'Power is not one of the measures and cannot substitute for one.'
        };
    }

    const world = fateEvidenceFor(gate.coincidence, claimant.fate);
    return {
        kind: 'fate',
        met: world.satisfied,
        account: world.satisfied ? [gate.worldStateCheck] : [gate.below, gate.whoHasEverPassed],
        // Never a shortfall. There is nothing to be short of.
        shortfall: null,
        structure:
            `fate gate: coincidence '${gate.coincidence}', characterStat null at the schema level. ` +
            `${world.consulted} ${gate.whyItCannotBeFarmed.slice(0, 120)}`
    };
}

export interface GateReading {
    verdicts: GateVerdict[];
    /** The first gate that did not open, in the order they are met. */
    blockedBy: GateVerdict | null;
}

/** Every gate on a site, in the order they are met, stopping at the first refusal. */
export function readGates(site: Site, claimant: Claimant): GateReading {
    const verdicts: GateVerdict[] = [];
    for (const gate of site.interior.gates) {
        const verdict = evaluateGate(gate, claimant);
        verdicts.push(verdict);
        if (!verdict.met) return { verdicts, blockedBy: verdict };
    }
    return { verdicts, blockedBy: null };
}

/**
 * The ordinal at which a site applies force to a body, or null where it applies
 * none.
 */
export function forceOrdinalOf(site: Site, blockedBy: GateVerdict | null): number | null {
    if (!blockedBy || blockedBy.kind !== 'strength') return null;
    const gate = site.interior.gates.find(g => g.kind === 'strength');
    return gate && gate.kind === 'strength' ? gate.ordinal : null;
}

/**
 * The gate, priced as force so the existing combat resolver can apply it.
 */
export function forceAt(site: Site, ordinal: number): CombatantInput {
    const maxHp = Math.max(10, 20 + ordinal * 12);
    return {
        id: `gate:${site.id}`,
        name: `the gate at ${site.name}`,
        realmOrdinal: ordinal,
        spiritRoot: 'muddled_five_element',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [],
        hp: maxHp,
        maxHp,
        qi: maxHp,
        maxQi: maxHp,
        artifactGrade: 0,
        battlesSurvived: 0
    };
}

/** Technique ids a site hands over, trial prize or grave good alike. */
export function prizeTechniqueIds(site: Site): string[] {
    return site.kind === 'trial'
        ? [...site.interior.prize.techniqueIds]
        : site.interior.contents.map(good => good.techniqueId).filter((id): id is string => id !== null);
}

/** Immortal item ids a site hands over. Null on every trial, by schema. */
export function prizeImmortalItemIds(site: Site): string[] {
    return site.kind === 'trial'
        ? []
        : site.interior.contents.map(good => good.immortalItemId).filter((id): id is string => id !== null);
}

/** Everything with no catalog entry, described plainly by the catalog itself. */
export function prizeOther(site: Site): string[] {
    return site.kind === 'trial'
        ? [...site.interior.prize.other]
        : site.interior.contents
            .filter(good => good.techniqueId === null && good.immortalItemId === null)
            .map(good => good.proven && good.survived
                ? `${good.what} It survived ${good.survived}`
                : good.what);
}

// THE LEDGER

export interface SiteRecord {
    catalogId: string;
    /** The day they went looking, which is what makes it the site at hand. */
    soughtOnDay: number | null;
    enteredOnDay: number | null;
    takenOnDay: number | null;
    takenBy: string | null;
    /** Technique and item ids that actually left the site. */
    granted: string[];
}

interface LedgerRow {
    id: string;
    contents: string;
}

const EMPTY: Omit<SiteRecord, 'catalogId'> = {
    soughtOnDay: null,
    enteredOnDay: null,
    takenOnDay: null,
    takenBy: null,
    granted: []
};

export class SiteLedger {
    private readonly readStmt: Database.Statement;
    private readonly listStmt: Database.Statement;
    private readonly upsertStmt: Database.Statement;

    constructor(db: Database.Database) {
        this.readStmt = db.prepare('SELECT id, contents FROM cultivation_sites WHERE id = ?');
        this.listStmt = db.prepare(
            'SELECT id, contents FROM cultivation_sites WHERE run_id = ? AND discovered = 1'
        );
        this.upsertStmt = db.prepare(`
            INSERT INTO cultivation_sites (id, run_id, kind, name, ordinal, location, contents, discovered, created_on_day)
            VALUES (@id, @runId, @kind, @name, @ordinal, NULL, @contents, 1, @onDay)
            ON CONFLICT(id) DO UPDATE SET contents = excluded.contents, discovered = 1
        `);
    }

    private static rowId(runId: string, catalogId: string): string {
        return `${runId}::${catalogId}`;
    }

    private static parse(row: LedgerRow): SiteRecord | null {
        const catalogId = row.id.slice(row.id.indexOf('::') + 2);
        if (!getSite(catalogId)) return null;
        try {
            const blob = JSON.parse(row.contents) as Partial<SiteRecord>;
            return {
                catalogId,
                soughtOnDay: blob.soughtOnDay ?? null,
                enteredOnDay: blob.enteredOnDay ?? null,
                takenOnDay: blob.takenOnDay ?? null,
                takenBy: blob.takenBy ?? null,
                granted: Array.isArray(blob.granted) ? blob.granted : []
            };
        } catch {
            // A row this layer cannot read is a row this layer has not
            // written. Treated as absent rather than as a failure: refusing to
            // let the player near a site because of a malformed blob is worse
            // than letting them start over on it.
            return null;
        }
    }

    get(runId: string, catalogId: string): SiteRecord | null {
        const row = this.readStmt.get(SiteLedger.rowId(runId, catalogId)) as LedgerRow | undefined;
        return row ? SiteLedger.parse(row) : null;
    }

    /** Every site this run has found, newest interest first. */
    found(runId: string): SiteRecord[] {
        const rows = this.listStmt.all(runId) as LedgerRow[];
        const records: SiteRecord[] = [];
        for (const row of rows) {
            const parsed = SiteLedger.parse(row);
            if (parsed) records.push(parsed);
        }
        return records.sort((a, b) => (b.soughtOnDay ?? -1) - (a.soughtOnDay ?? -1));
    }

    /**
     * The site a bare sentence means.
     */
    atHand(runId: string): SiteRecord | null {
        return this.found(runId)[0] ?? null;
    }

    write(runId: string, site: Site, onDay: number, patch: Partial<Omit<SiteRecord, 'catalogId'>>): SiteRecord {
        const existing = this.get(runId, site.id) ?? { catalogId: site.id, ...EMPTY };
        const next: SiteRecord = { ...existing, ...patch, catalogId: site.id };
        this.upsertStmt.run({
            id: SiteLedger.rowId(runId, site.id),
            runId,
            kind: site.kind,
            name: site.name,
            ordinal: site.kind === 'grave' ? site.occupantOrdinal : hardestOrdinal(site),
            contents: JSON.stringify({
                soughtOnDay: next.soughtOnDay,
                enteredOnDay: next.enteredOnDay,
                takenOnDay: next.takenOnDay,
                takenBy: next.takenBy,
                granted: next.granted
            }),
            onDay: Math.max(0, Math.floor(onDay))
        });
        return next;
    }
}

/** The highest ordinal any strength gate on this site is set at, or 0. */
function hardestOrdinal(site: Site): number {
    let highest = 0;
    for (const gate of site.interior.gates) {
        if (gate.kind === 'strength' && gate.ordinal > highest) highest = gate.ordinal;
    }
    return highest;
}

/**
 * The pre-entry face, re-exported through this module so that every caller in
 * `src/web` reaches it by the one route.
 */
export function faceOf(site: Site, awareness: Awareness): SiteOutsideView | undefined {
    return outsideViewOf(site.id, awareness);
}

// WHAT THE GROUND ITSELF DOES, BEFORE ANY GATE

/**
 * What this ground does to this claimant, before any gate is consulted.
 */
export function readAccess(site: Site, claimant: Claimant): AdmissionReading {
    return readAdmission(site.access, claimant.realmOrdinal);
}

/**
 * The ordinal the GROUND applies to somebody short of its floor.
 */
export function groundForceOrdinalOf(
    site: Site,
    reading: AdmissionReading
): number | null {
    if (reading.closedBy !== 'below_the_floor') return null;
    return site.access.floorOrdinal;
}
