/**
 * Inheritance grounds: reaching one, reading it from outside, going in, and
 * taking what is behind the door.
 *
 * `data/cultivation/inheritance-trials.ts` has carried the whole of this from
 * the start - twenty-odd sites, three kinds of gate, an interior that the type
 * system itself keeps out of the pre-entry view - and nothing a player could
 * type reached any of it. It was the largest finished, tested, unplayable
 * system in the game, and `scripts/playtest-systems.ts` reported it as such in
 * its own friction block for as long as that block existed.
 *
 * This module is to that catalog what `entities.ts` is to the roster: the
 * narrow layer that decides WHICH site a sentence meant, whether this
 * cultivator may name it at all, and what each gate answers when it is put to
 * them. `game.ts` owns the writes; `facts.ts` owns the sentences.
 *
 * ── The interior stays outside until somebody walks in ────────────────────
 * The catalog's own guarantee is structural: `outsideViewOf` returns a type
 * with no `interior` key, so a caller holding only the outside view cannot
 * reach the inside even by mistake. Nothing here weakens that. There is
 * exactly one call to `enterSite` in this package's whole reachable surface
 * and it sits behind a recorded entry - see `GameService.site`.
 *
 * ── Three gates, three unrelated questions ────────────────────────────────
 * `THE_THREE_GATES` states the design and this module implements it without
 * flattening it:
 *
 *   strength        an ordinal. Meet it or do not. A refusal names the
 *                   shortfall, because there IS one and the claimant can do
 *                   something about it - namely get stronger.
 *   age_and_talent  what the run accumulated or was dealt. A refusal names
 *                   which measure fell short, and says plainly that power
 *                   does not substitute, because the catalog says so per gate
 *                   in `strengthDoesNotHelp`.
 *   fate            not a check against the sheet at all. A refusal here must
 *                   NOT imply a shortfall, because there is nothing to fall
 *                   short of and nothing to go and do. `FATE_IS_NOT_A_STAT`
 *                   is enforced by the schema (`characterStat` is `z.null()`)
 *                   and by {@link fateEvidenceFor}, which reads world state
 *                   rows and never touches an attribute.
 *
 * ── Locality, and why there is none ───────────────────────────────────────
 * No entry in the catalog carries a location, deliberately: an inheritance
 * ground is not on anybody's map. So "what is near here" cannot be answered
 * by distance and is not pretended to be. What it is answered by is the same
 * thing the sect listing is answered by - what this cultivator has actually
 * heard of - and the catalog states the starting point per site in
 * `outside.startingAwareness`, which is why thirteen of them are nameable by
 * a villager and the rest have to reach the player some other way.
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
 *
 * The catalog's `startingAwareness` is the floor - what a fresh cultivator in
 * this world already has for that particular site, which for a gate on a
 * hillside everybody walks past is `named` and for an oath room under a
 * dyer's yard is `unaware`. A knowledge record raises it to `named`, and
 * nothing lowers it: having been told about a thing does not un-tell you.
 */
export function awarenessOfSite(site: Site, holderHasRecord: boolean): Awareness {
    const floor = site.outside.startingAwareness;
    if (!holderHasRecord) return floor;
    return AWARENESS_ORDER.indexOf(floor) >= AWARENESS_ORDER.indexOf('named') ? floor : 'named';
}

/**
 * Sites this cultivator could put a name to.
 *
 * The predicate the whole surface rests on, and the reason a player cannot
 * simply type their way into the best grave in the world on turn one: below
 * `named` the catalog withholds the name, the rumour and the attribution, so
 * there is nothing to type and nothing to resolve.
 */
export function nameableSites(holdsRecordFor: (siteId: string) => boolean): Site[] {
    return SITES.filter(site => mayBeNamed(awarenessOfSite(site, holdsRecordFor(site.id))));
}

/**
 * Which site a sentence meant, out of the ones this cultivator may name.
 *
 * Scored against the display name and against the id slug, because the id is
 * where the short distinctive phrase lives - "the eighth stone" is the whole
 * of `trial-the-eighth-stone` and none of "The Chamber Under the Eighth
 * Stone". Below {@link MATCH_THRESHOLD} nothing resolves, on the same
 * reasoning as every other resolver here: a near miss that opens the wrong
 * door is worse than a miss that asks the player to be clearer.
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
 *
 * A view over the catalog rather than a written list, so a site added to
 * `inheritance-trials.ts` becomes typeable without anybody remembering to
 * come here. Read by the deterministic parser, which needs to know that "the
 * eighth stone" is a place before `game.ts` gets a chance to resolve it.
 *
 * Built from ids AND from whole names, and the distinction matters.
 *
 * This was ids only, on the reasoning that site names are English sentences -
 * "Two Graves On a Survey Line", "A Culler On the Kettle Circuit" - and that
 * matching a player's prose against the WORDS in those would fire on half the
 * sentences in the game. That reasoning is correct about words and does not
 * apply to whole names, because `siteNamed` tests `text.includes(phrase)`: a
 * complete name is one long specific substring, not a bag of common words.
 *
 * The gap it left was closed-loop and unwinnable. The game lists these places
 * by NAME - "The ones you have names for are The Outer Gate of a Sect That No
 * Longer Exists, The Bench at the Burned Seat, The Gate Frame With No Gate In
 * It..." - and then accepted only the id slug, which is never shown anywhere.
 * Found by playing: asking what ruins were near, typing back one of the names
 * the game had just printed, and getting nothing. `trial-the-swept-frame`
 * answers to "swept frame", and the player had been told "The Gate Frame With
 * No Gate In It".
 *
 * The leading article is dropped so that "I approach the Gate Frame..." and
 * "I approach Gate Frame..." both land, and the length floor in `siteNamed`
 * still guards against a short slug becoming a wildcard.
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
 *
 * Written out rather than taking a `Cultivator`, so that the set of things a
 * door may ask about is visible in one place and cannot quietly grow. Note
 * what is absent: `fortune`. The attribute measure does not accept it at the
 * schema level and nothing here could pass it if it did - see
 * `FATE_IS_NOT_A_STAT`.
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
 *
 * Every field is a count of real rows. There is no number here that rises
 * because somebody did the same activity more times, which is the whole of
 * `FATE_IS_NOT_A_STAT`: a farmable coincidence is not a coincidence.
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
                asked: `a ${requirement.oneOf.join(' or ')} root`,
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
                asked: `a ${requirement.oneOf.join(' or ')} foundation`,
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
 *
 * Only one of the six is currently readable off real rows, and this says so
 * rather than pretending otherwise. That is the honest state of the engine
 * and it is reported on the mechanical channel, never to the player: from
 * inside the fiction a door that does not open because the world never
 * arranged the coincidence and a door that does not open because the engine
 * holds no ledger for that kind of coincidence look identical, and they must,
 * because the alternative is a hint and a hint is the whole prize.
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
 * The ordinal at which a site applies force to a body, or null where it
 * applies none.
 *
 * ONLY a strength gate states one. A talent gate is indifferent to how hard
 * the claimant can be hit and a fate gate is not about the claimant at all,
 * so neither of them is turned into damage here - which is why the audit
 * bench, whose own `howItKills` opens "It does not, and that is the trap",
 * costs a failed claimant nothing but the days.
 *
 * An unguarded grave is likewise not given a hazard it does not have. The
 * catalog is explicit that most graves have no gate and that "an unguarded
 * grave is the ordinary case"; inventing a force for one out of the
 * occupant's rank would be exactly the bespoke rule AGENTS.md forbids.
 */
export function forceOrdinalOf(site: Site, blockedBy: GateVerdict | null): number | null {
    if (!blockedBy || blockedBy.kind !== 'strength') return null;
    const gate = site.interior.gates.find(g => g.kind === 'strength');
    return gate && gate.kind === 'strength' ? gate.ordinal : null;
}

/**
 * The gate, priced as force so the existing combat resolver can apply it.
 *
 * A gate is not a person and is never treated as one: it has no name in the
 * roster, it cannot be fought, negotiated with or fled from, and every
 * person-shaped field below takes the neutral value. What it has is an
 * ordinal and a body in front of it, which is precisely what `resolveExchange`
 * prices. Doing it this way rather than writing a damage formula here is the
 * point - there is one combat model in this project and a second one living
 * in the web layer would drift from it within a month.
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

// ─────────────────────────────────────────────────────────────────────────
// THE LEDGER
//
// What has been done to a site, in this run. Written to `cultivation_sites`,
// which the schema already keeps for exactly this and whose own comment says
// a site outlives the run that turned it up. No new table: "the map is pocked
// with other people's ambitions" is a property of the ground, and the ground
// already has a table.
//
// `location` is deliberately left NULL. The catalog does not say where any of
// these are, and writing the cultivator's own location into the row would be
// asserting a geography nobody authored - and would then feed `siteTagsAt`,
// which grants comprehension sources off discovered ground. A site the player
// found is not a vein under their feet.
// ─────────────────────────────────────────────────────────────────────────

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
     *
     * "I go inside" and "what does it look like from out here" name nothing,
     * exactly the way "what happened here" names nowhere. Both mean the thing
     * the cultivator went to most recently, and that is a row rather than an
     * assumption.
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
 *
 * Kept as a thin pass-through rather than inlined at the call site because it
 * is the single most important line in this file: everything a player who has
 * not gone in may be told comes from here, and the compiler refuses to hand
 * back an `interior` key through it.
 */
export function faceOf(site: Site, awareness: Awareness): SiteOutsideView | undefined {
    return outsideViewOf(site.id, awareness);
}
