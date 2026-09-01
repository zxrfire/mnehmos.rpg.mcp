/**
 * Consolidated Admin Tool - `admin_manage`
 *
 * Exploratory testing surface. Gated behind `ADMIN_MODE=true` in the process
 * environment and refused, clearly, otherwise.
 *
 * WHAT ADMIN IS
 * -------------
 * From context.md: "ADMIN bypasses GATES, not TRUTH."
 *
 * Spawning the grave of a Tribulation Transcender while the player sits at Qi
 * Condensation Layer 2 is a content gate being lifted. The engine genuinely
 * creates that site, writes it to SQLite, and hands it back; the agent then
 * narrates something that actually exists. That is the entire distinction, and
 * every action here honours it:
 *
 *   roster           read-only observability
 *   spawn_site       lifts the AWARENESS gate on a real catalogued site, so the
 *                    player can name it. Every gate inside it still stands.
 *   spawn_encounter  a REAL NPC cultivator is created, with talent rolled from
 *                    the run seed, advanced through `advanceRealm` like anyone
 *                    else, and persisted.
 *   grant_item       only catalog pills and herbs, into the real pouch
 *   set_ambient      lifts the "you must happen to be somewhere dense" gate by
 *                    relocating to a place the engine really does compute that
 *                    band for. The band is still the engine's number.
 *   set_location     a plain move, to a place that is really on the map
 *   advance_days     real time passes through `simulateTimeSkip`, with real
 *                    aging, real starvation and real death checks
 *   grant_progress   fills the qi-unit accumulator the engine already reads.
 *                    It rolls no breakthrough and claims none.
 *   set_realm        goes through `advanceRealm` like every other rank change,
 *                    stamping peak_ordinal and restarting the stagnation clock
 *
 * WHAT ADMIN IS NOT
 * -----------------
 * There is NO action here that takes an outcome as input and records it. No
 * `set_breakthrough_result`, no `declare`, no `force_success`, no `revive`, no
 * `set_hp`. That affordance must never be added: it is precisely the one that
 * invites the model to narrate a world that does not exist.
 *
 * Every call is written to the audit log with the run id as its target, which
 * is also how a run is flagged as admin-touched - `run_manage.ledger` reads the
 * same rows to exclude those runs from the death ledger and from balance data.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import {
    AmbientQiSchema,
    STARTING_SPIRIT_STONES,
    type AmbientQi
} from '../../schema/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    MAX_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    canAttemptBreakthrough,
    forStream,
    getSpiritRoot,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal,
    rollAttributes,
    rollSpiritRoot
} from '../../engine/cultivation/index.js';
import { getPill } from '../../data/cultivation/pills.js';
import { getHerb } from '../../data/cultivation/herbs.js';
import { REGIONS } from '../../data/cultivation/regions.js';
import { SITES, type Site } from '../../data/cultivation/inheritance-trials.js';
import { MATCH_THRESHOLD, matchScore } from '../../web/entities.js';
import { KnowledgeGate, loosePlaceKey } from '../../web/knowledge.js';
import { SiteLedger } from '../../web/trials.js';
import { handleCultivate } from './cultivation-manage.js';
import { worldForRun } from '../state/cultivation-world.js';
import {
    AMBIENT_BLOCK_DAYS,
    addToPouch,
    adminAuditTrail,
    aliasForAmbient,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isAdminRun,
    isGuidingErrorBody,
    resolveActiveRun,
    writeAdminAudit
} from './cultivation-support.js';

const ACTIONS = [
    'roster', 'spawn_encounter', 'spawn_site', 'grant_item',
    'set_ambient', 'set_location', 'advance_days', 'grant_progress', 'set_realm', 'audit_log'
] as const;
type AdminAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// THE GATE
// ═══════════════════════════════════════════════════════════════════════════

export function isAdminModeEnabled(): boolean {
    // Read at call time, not module load: the flag is an operator decision and
    // must be togglable without restarting a test suite or a server process.
    return String(process.env.ADMIN_MODE ?? '').toLowerCase() === 'true';
}

function adminDisabled(action: string) {
    return guidingError(
        'admin_mode_disabled',
        'admin_manage is unavailable: ADMIN_MODE is not enabled for this process.',
        {
            action,
            requires: 'ADMIN_MODE=true',
            hint:
                'This is an operator setting, not an in-play permission. Nothing you say in the ' +
                'conversation turns it on, and there is no fallback path that performs the action anyway.'
        }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// THE COMMAND LINE
//
// ADMIN is typed as a sentence and arrives here as `key=value` pairs. It is
// worth being explicit about why this lives beside the handlers rather than
// beside the caller that reads the keystrokes: the caller split the request on
// whitespace and took everything after `=` up to the next space, so
// `location=The Dead Verge` set the location to "The", and quoting it set the
// location to `"The`.
//
// That is not a cosmetic defect. MOST OF THIS WORLD'S GAZETTEER IS MULTI-WORD -
// The Dead Verge, Nine Peaks, The Low Fall, The Drowned Reach, Salt Reach - so
// a parser that stops at the first space can reach almost none of the map, and
// forbidden-zone and environmental gating cannot be exercised at all. The
// engine then narrated "The. The air here is unremarkable" for a place that
// does not exist, which is the surface lying about a write it really performed.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A key boundary: `key=` at the start of the string or after whitespace.
 *
 * A value therefore runs to the NEXT key rather than to the next space, which
 * is what makes an unquoted multi-word value work. `a=1 b=2` still splits into
 * two pairs, because ` b=` is a boundary; `location=The Dead Verge` does not,
 * because "Dead" and "Verge" are not followed by an equals sign.
 */
const ADMIN_ARG_KEY = /(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=/g;

/** Strip one matched pair of surrounding quotes, and nothing else. */
function unquote(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length < 2) return trimmed;
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' || first === '\'' || first === '`') && first === last) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}

export interface ParsedAdminCommand {
    /** The leading word. Empty when the operator typed a bare ADMIN. */
    action: string;
    /** Every `key=value` pair, numbers coerced where the whole value is one. */
    args: Record<string, unknown>;
}

/**
 * Parse an ADMIN command line into an action and its arguments.
 *
 * Exported so the surface that reads the keystrokes has one place to call and
 * this file owns the grammar it documents. Three shapes, all of which a person
 * writes without thinking about it:
 *
 *   set_location location=Nine Peaks             bare, multi-word
 *   set_location location="The Dead Verge"       quoted
 *   spawn_site ordinal=41 kind=grave             several pairs on one line
 *
 * A value is text between one key and the next, so quoting is a convenience
 * rather than a requirement and a stray quote is removed rather than stored.
 * Numbers are coerced only when the ENTIRE value is one: "Nine Peaks" stays a
 * string, and so does "3 Mile Ford".
 */
export function parseAdminCommand(request: string): ParsedAdminCommand {
    const line = request.trim();
    const args: Record<string, unknown> = {};

    ADMIN_ARG_KEY.lastIndex = 0;
    const keys: Array<{ name: string; valueFrom: number; keyFrom: number }> = [];
    for (let m = ADMIN_ARG_KEY.exec(line); m !== null; m = ADMIN_ARG_KEY.exec(line)) {
        keys.push({
            name: m[1],
            keyFrom: m.index,
            valueFrom: m.index + m[0].length
        });
    }

    const action = (keys.length > 0 ? line.slice(0, keys[0].keyFrom) : line).trim().split(/\s+/)[0] ?? '';

    for (let i = 0; i < keys.length; i++) {
        const end = i + 1 < keys.length ? keys[i + 1].keyFrom : line.length;
        const raw = unquote(line.slice(keys[i].valueFrom, end));
        if (raw === '') {
            args[keys[i].name] = '';
            continue;
        }
        // `fill=true` and `includeDead=false` are how a person writes a flag,
        // and every boolean field in this surface's schemas rejects the string.
        // Only the two exact words, so a site called "True Something" is safe.
        if (raw === 'true' || raw === 'false') {
            args[keys[i].name] = raw === 'true';
            continue;
        }
        const asNumber = Number(raw);
        args[keys[i].name] = Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : raw;
    }

    return { action, args };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const RosterSchema = z.object({
    action: z.literal('roster'),
    includeDead: z.boolean().optional().default(true)
});

const SpawnEncounterSchema = z.object({
    action: z.literal('spawn_encounter'),
    ordinal: z.number().int().min(0).max(MAX_ORDINAL)
        .describe('Realm ordinal of the opponent. Normally gated by the player\'s own ordinal.'),
    name: z.string().min(1).max(100).optional(),
    location: z.string().optional(),
    disposition: z.enum(['hostile', 'wary', 'indifferent']).optional().default('hostile')
});

const SpawnSiteSchema = z.object({
    action: z.literal('spawn_site'),
    kind: z.enum(['grave', 'trial', 'any']).optional().default('any'),
    ordinal: z.number().int().min(0).max(MAX_ORDINAL).optional()
        .describe('Realm ordinal to aim at. The nearest catalogued site to it is revealed.'),
    name: z.string().min(1).max(120).optional()
        .describe('Name a specific catalogued site instead. Its own name, or the phrase in its id.')
});

const GrantItemSchema = z.object({
    action: z.literal('grant_item'),
    itemId: z.string().describe('A catalog pill id or herb id. Nothing else exists.'),
    quantity: z.number().int().min(1).max(999).optional().default(1),
    cultivatorId: z.string().optional()
});

const SetAmbientSchema = z.object({
    action: z.literal('set_ambient'),
    band: AmbientQiSchema,
    cultivatorId: z.string().optional()
});

const SetLocationSchema = z.object({
    action: z.literal('set_location'),
    location: z.string().min(1).max(200),
    cultivatorId: z.string().optional()
});

const AdvanceDaysSchema = z.object({
    action: z.literal('advance_days'),
    days: z.number().min(1).max(3_650_000).optional(),
    months: z.number().min(0).max(120_000).optional(),
    years: z.number().min(0).max(10_000).optional(),
    /**
     * Days of food bought up front, at the ordinary price, out of the ordinary
     * purse. Zero is the default and it is why a long span stops short: an
     * unprovisioned body empties its belly in fifty turns and the simulation
     * correctly refuses to keep going. This is not a gate ADMIN may lift -
     * starvation is truth - so what it gets instead is the ability to pay.
     */
    rations: z.number().int().min(0).max(10_000).optional().default(0),
    cultivatorId: z.string().optional()
});

const GrantProgressSchema = z.object({
    action: z.literal('grant_progress'),
    /** Qi-units to add. Omit and `fill` decides. */
    amount: z.number().min(0).max(1e12).optional(),
    /** Fill to exactly what the current rung requires for an attempt. */
    fill: z.boolean().optional(),
    cultivatorId: z.string().optional()
});

const SetRealmSchema = z.object({
    action: z.literal('set_realm'),
    ordinal: z.number().int().min(0).max(MAX_ORDINAL),
    cultivatorId: z.string().optional()
});

const AuditLogSchema = z.object({
    action: z.literal('audit_log'),
    runId: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional().default(50)
});

// ═══════════════════════════════════════════════════════════════════════════
// THE GAZETTEER
//
// `set_location` used to take any string at all, so "Nowhereville" reported
// "moved" and flagged the run, and the engine then described the ambient qi of
// a place that does not exist. ADMIN lifts gates, not truth: a place the world
// has never heard of is not a gate, it is a typo with a location row behind it.
//
// AGENTS.md: "a guard that only exists when the world is enabled is not a
// guard". The world driver can be off, and it is off in every test harness, so
// the register below is built primarily from the AUTHORED region catalog, which
// is present in every configuration. The world's own locations and the places
// people are actually standing are added on top when they exist - they can only
// ever widen what is accepted, never narrow it.
// ═══════════════════════════════════════════════════════════════════════════

interface Gazetteer {
    /** Canonical display names, deduplicated, in catalog order. */
    names: string[];
    /** Where each register's entries came from, for the response. */
    sources: Record<string, number>;
}

async function gazetteerFor(
    repos: ReturnType<typeof ensureCultivationDb>,
    run: { id: string; seed: string } & Record<string, unknown>
): Promise<Gazetteer> {
    const seen = new Map<string, string>();
    const sources: Record<string, number> = { regionCatalog: 0, world: 0, occupied: 0 };

    const add = (name: string | null | undefined, source: string): void => {
        const clean = (name ?? '').trim();
        if (clean.length === 0) return;
        const key = loosePlaceKey(clean);
        if (key === 'unnamed' || seen.has(key)) return;
        seen.set(key, clean);
        sources[source] = (sources[source] ?? 0) + 1;
    };

    // 1. The authored catalog. Always present, world driver or no world driver.
    for (const region of REGIONS) {
        add(region.name, 'regionCatalog');
        for (const place of region.places) add(place.name, 'regionCatalog');
    }

    // 2. The generated world's own locations, when there is a world.
    try {
        const world = await worldForRun(run as never);
        for (const location of world.locations) add(location.name, 'world');
    } catch {
        // A run with no world is a run in a game the world layer is not part
        // of. The authored catalog still holds, so this is not a failure.
    }

    // 3. Anywhere somebody is standing. A place with people in it is a place.
    for (const row of repos.cultivators.roster()) add(row.location, 'occupied');

    return { names: [...seen.values()], sources };
}

interface PlaceLookup {
    /** The gazetteer's own spelling, so what is stored is what the world calls it. */
    canonical: string | null;
    /** Best near misses, for the refusal. Never more than five. */
    nearest: string[];
}

/**
 * Which place on the map a typed name means.
 *
 * Loose-key equality first and it is not a fallback: `placeKey` keeps a leading
 * article and most operators drop it, so "Dead Verge" and "The Dead Verge" must
 * be the same place. Only then the fuzzy score, at the same threshold every
 * other resolver in this engine uses - a near miss that moves the cultivator
 * somewhere they did not ask for is worse than a refusal that lists the names.
 */
function lookUpPlace(wanted: string, gazetteer: Gazetteer): PlaceLookup {
    const needle = wanted.trim();
    const key = loosePlaceKey(needle);

    const exact = gazetteer.names.find(name => loosePlaceKey(name) === key);
    if (exact) return { canonical: exact, nearest: [] };

    const scored = gazetteer.names
        .map(name => ({ name, score: matchScore(needle, name) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score >= MATCH_THRESHOLD) {
        // One clear winner only. Two candidates tied at the top is exactly the
        // case where guessing picks the wrong one.
        const tied = scored.filter(entry => entry.score === scored[0].score);
        if (tied.length === 1) return { canonical: scored[0].name, nearest: [] };
    }

    return { canonical: null, nearest: scored.slice(0, 5).map(entry => entry.name) };
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleRoster(args: z.infer<typeof RosterSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('roster');
    const repos = ensureCultivationDb();

    const rows = repos.cultivators
        .roster()
        .filter(entry => (args.includeDead ?? true) || entry.alive);

    // Read-only observability writes no state, but it still lands in the audit
    // log: knowing that someone looked at the whole world is part of knowing
    // that a run was played with the lid off.
    const run = repos.runs.getActiveRun();
    writeAdminAudit(repos, 'roster', run?.id ?? null, { rows: rows.length });

    return {
        adminMode: true,
        count: rows.length,
        roster: rows.map(entry => ({
            ...entry,
            rank: rankName(entry.realmOrdinal),
            realm: realmForOrdinal(entry.realmOrdinal).name,
            spiritRootName: getSpiritRoot(entry.spiritRoot).name
        })),
        note: 'Read-only projection. Nothing here is writable through this action.'
    };
}

/**
 * What rung a catalogued site is pitched at.
 *
 * A grave's occupant, or the hardest strength gate inside a trial, or what the
 * outside advertises. Read off the catalog rather than stored, so a site added
 * to `inheritance-trials.ts` is aimable at without anybody remembering to
 * update a table here.
 */
function siteOrdinalOf(site: Site): number {
    if (site.kind === 'grave') return site.occupantOrdinal;
    let hardest = 0;
    for (const gate of site.interior.gates) {
        if (gate.kind === 'strength' && gate.ordinal > hardest) hardest = gate.ordinal;
    }
    return hardest > 0 ? hardest : site.outside.advertisedOrdinal ?? 0;
}

/** The id slug as a person would say it: `grave-shen-guyi` -> `shen guyi`. */
function sitePhrase(siteId: string): string {
    return siteId.replace(/^(?:trial|grave)-/, '').replace(/^the-/, '').replace(/-/g, ' ');
}

/**
 * ADMIN over the sites the player can actually reach.
 *
 * ══ WHY THIS DOES NOT INVENT A SITE ANY MORE ══════════════════════════════
 *
 * It used to write a fresh row into `cultivation_sites` with engine-rolled
 * contents, report `spawned: true`, and hand back an id. Nothing player-facing
 * has ever read those rows. The whole site surface - approach, outside, enter,
 * take - runs over the AUTHORED catalog in `inheritance-trials.ts`, gated on
 * whether the cultivator holds a knowledge record for the site, and
 * `SiteLedger` keys its rows `${runId}::${catalogId}` and drops anything whose
 * id is not a catalog id. So a spawned site was written, was real in SQLite,
 * and was unreachable: "Cave of a Tribulation Transcendence Cultivator" spawned
 * at Sweptground, and going to look for it answered "it is not the kind of
 * place that has one", twice, correctly.
 *
 * A tool that reports success for work it did not do is worse than one that
 * fails. So the gate this lifts is the one that was actually in the way -
 * AWARENESS. The site is a real catalogued site, its face is the face the
 * content authored, and every gate inside it still stands: the strength bar,
 * the comprehension bar, the claim conditions, all of them. What ADMIN removes
 * is "you have to have happened to hear about it", which is exactly a content
 * gate and exactly what this surface is for.
 */
export async function handleSpawnSite(args: z.infer<typeof SpawnSiteSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('spawn_site');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const kind = args.kind ?? 'any';
    const pool = SITES.filter(site => kind === 'any' || site.kind === kind);

    if (pool.length === 0) {
        return guidingError(
            'no_such_site_kind',
            `The catalog holds no sites of kind "${kind}".`,
            { kinds: [...new Set(SITES.map(s => s.kind))] }
        );
    }

    // ── Which site. Named beats aimed-at; aimed-at beats the seed. ────────
    let site: Site | null = null;
    let how = '';

    if (args.name) {
        const scored = pool
            .map(entry => ({
                entry,
                score: Math.max(matchScore(args.name!, entry.name), matchScore(args.name!, sitePhrase(entry.id)))
            }))
            .sort((a, b) => b.score - a.score);
        if (scored.length === 0 || scored[0].score < MATCH_THRESHOLD) {
            return guidingError(
                'unknown_site',
                `No catalogued site answers to "${args.name}".`,
                {
                    asked: args.name,
                    nearest: scored.slice(0, 5).map(s => s.entry.name),
                    catalogSize: SITES.length,
                    hint:
                        'ADMIN reveals sites that exist; it does not author them. Omit `name` and pass ' +
                        '`ordinal=N` to be given the catalogued site nearest that rung.'
                }
            );
        }
        site = scored[0].entry;
        how = `named by the caller and matched to the catalog at ${scored[0].score}/100`;
    } else if (args.ordinal !== undefined) {
        const wanted = args.ordinal;
        let best = pool[0];
        let bestGap = Math.abs(siteOrdinalOf(best) - wanted);
        for (const entry of pool) {
            const gap = Math.abs(siteOrdinalOf(entry) - wanted);
            // Ties break toward the harder site, so aiming high never lands low.
            if (gap < bestGap || (gap === bestGap && siteOrdinalOf(entry) > siteOrdinalOf(best))) {
                best = entry;
                bestGap = gap;
            }
        }
        site = best;
        how =
            bestGap === 0
                ? `catalogued at ordinal ${wanted} exactly`
                : `nearest catalogued site to ordinal ${wanted}; it stands at ${siteOrdinalOf(best)}, ` +
                  `${bestGap} rung(s) away. The catalog is authored and has no entry at every rung.`;
    } else {
        // Nothing named and nothing aimed at: the run's own seed picks, so two
        // calls on one run are reproducible rather than arbitrary.
        const nonce = repos.db
            .prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'admin_manage.spawn_site'")
            .get() as { n: number };
        site = forStream(run.seed, 'admin_site', nonce.n).pick(pool);
        how = 'picked from the run seed - no ordinal and no name were given';
    }

    const chosen: Site = site;
    const ordinal = siteOrdinalOf(chosen);
    const knowledge = new KnowledgeGate(repos.db);
    const ledger = new SiteLedger(repos.db);
    const alreadyHeld = knowledge.isAwareOf(cultivator.id, 'place', chosen.id);
    const onDay = Math.max(0, Math.floor(run.elapsedDays));

    repos.db.transaction(() => {
        // The knowledge record is the gate. `witnessed` is the honest source:
        // an operator put the name in front of this cultivator, and the audit
        // row says so in the same transaction.
        knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'place',
            id: chosen.id,
            name: chosen.name,
            onDay,
            sourceKind: 'witnessed',
            sourceNote: 'ADMIN revealed this site. The awareness gate was lifted; nothing inside it was.',
            statement: `${chosen.name} exists and can be found.`
        });
        // Sought, not entered. This is what makes a bare "I go inside" resolve
        // to this site rather than to nothing, and it claims no entry.
        ledger.write(run.id, chosen, run.elapsedDays, { soughtOnDay: onDay });
        writeAdminAudit(repos, 'spawn_site', run.id, {
            cultivatorId: cultivator.id,
            siteId: chosen.id,
            siteName: chosen.name,
            kind: chosen.kind,
            siteOrdinal: ordinal,
            selection: how,
            awarenessAlreadyHeld: alreadyHeld,
            gateLifted: `awareness only; player stands at ordinal ${cultivator.realmOrdinal}`
        });
    })();

    return {
        adminMode: true,
        spawned: true,
        revealed: true,
        site: {
            id: chosen.id,
            catalogId: chosen.id,
            kind: chosen.kind,
            name: chosen.name,
            ordinal,
            rank: rankName(ordinal),
            marker: chosen.outside.marker,
            advertisedOrdinal: chosen.outside.advertisedOrdinal,
            startingAwareness: chosen.outside.startingAwareness,
            awarenessAlreadyHeld: alreadyHeld
        },
        selection: how,
        // AGENTS.md: any name the game prints is a name the game must accept.
        // These two both resolve through `resolveSite`.
        sayThis: [`approach ${chosen.name}`, `approach the ${sitePhrase(chosen.id)}`],
        gateLifted: {
            playerOrdinal: cultivator.realmOrdinal,
            siteOrdinal: ordinal,
            what: 'awareness',
            note:
                'A content gate was lifted, not a truth. This is a real catalogued site and it is now ' +
                'nameable by this cultivator; the strength bar, the comprehension bar and every claim ' +
                'condition inside it are untouched and will refuse exactly as they would have. ' +
                'Nothing was rolled, nothing was granted, and nothing was invented.'
        },
        runFlagged: true
    };
}

export async function handleSpawnEncounter(
    args: z.infer<typeof SpawnEncounterSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('spawn_encounter');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, {});
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;

    // A real cultivator, with talent rolled from the run seed exactly as the
    // player's was. Nothing about this opponent is asserted.
    const nonce = repos.cultivators.list().length;
    const rootRng = forStream(run.seed, 'admin_encounter_root', nonce, args.ordinal);
    const attrRng = forStream(run.seed, 'admin_encounter_attrs', nonce, args.ordinal);
    const spiritRoot = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);

    const maxHp = 20 + attributes.might * 10 + args.ordinal * 5;
    const maxQi = 10 + attributes.insight * 5 + args.ordinal * 4;
    const opponentId = randomUUID();
    const siteId = randomUUID();
    const location = args.location ?? cultivator.location ?? 'the open road';
    const name = args.name ?? `A ${realmForOrdinal(args.ordinal).name} cultivator`;

    repos.db.transaction(() => {
        repos.cultivators.create({
            id: opponentId,
            runId: run.id,
            name,
            kind: 'enemy',
            spiritRoot: spiritRoot.key,
            attributes,
            realmOrdinal: 0,
            hp: maxHp,
            maxHp,
            qi: maxQi,
            maxQi,
            age: 20 + args.ordinal * 4,
            location,
            spiritStones: STARTING_SPIRIT_STONES * (1 + args.ordinal)
        });
        // The rank change takes the same road every rank change takes.
        if (args.ordinal > 0) repos.cultivators.advanceRealm(opponentId, args.ordinal);

        repos.db.prepare(`
            INSERT INTO cultivation_sites
                (id, run_id, kind, name, ordinal, location, contents, admin_spawned, discovered, created_on_day)
            VALUES (?, ?, 'encounter', ?, ?, ?, ?, 1, 0, ?)
        `).run(
            siteId, run.id, name, args.ordinal, location,
            JSON.stringify({
                opponentCultivatorId: opponentId,
                disposition: args.disposition ?? 'hostile'
            }),
            run.elapsedDays
        );

        writeAdminAudit(repos, 'spawn_encounter', run.id, {
            encounterId: siteId,
            opponentCultivatorId: opponentId,
            ordinal: args.ordinal,
            spiritRoot: spiritRoot.key,
            attributes,
            location,
            gateLifted: `player stands at ordinal ${cultivator.realmOrdinal}`
        });
    })();

    const opponent = repos.cultivators.getById(opponentId)!;

    return {
        adminMode: true,
        spawned: true,
        encounterId: siteId,
        opponent: describeCultivator(repos, opponent, run),
        disposition: args.disposition ?? 'hostile',
        location,
        gateLifted: {
            playerOrdinal: cultivator.realmOrdinal,
            opponentOrdinal: args.ordinal,
            powerRatio:
                realmForOrdinal(args.ordinal).powerMultiplier /
                realmForOrdinal(cultivator.realmOrdinal).powerMultiplier,
            note:
                'This opponent is a real persisted cultivator with engine-rolled talent. If the player ' +
                'fights it, the engine decides what happens.'
        },
        runFlagged: true
    };
}

export async function handleGrantItem(args: z.infer<typeof GrantItemSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('grant_item');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const pill = getPill(args.itemId);
    const herb = pill ? undefined : getHerb(args.itemId);
    if (!pill && !herb) {
        return guidingError(
            'unknown_item',
            `No pill or herb with id ${args.itemId} exists in the catalogs.`,
            {
                hint:
                    'Admin lifts gates on things that exist. It does not invent items. ' +
                    'alchemy_manage({ action: "list_recipes" }) shows catalog pill ids.'
            }
        );
    }

    const kind = pill ? ('pill' as const) : ('herb' as const);
    const quantity = args.quantity ?? 1;

    repos.db.transaction(() => {
        addToPouch(repos.db, cultivator.id, args.itemId, kind, quantity);
        writeAdminAudit(repos, 'grant_item', run.id, {
            cultivatorId: cultivator.id,
            itemId: args.itemId,
            kind,
            quantity
        });
    })();

    return {
        adminMode: true,
        granted: true,
        item: pill
            ? { kind, id: pill.id, name: pill.name, grade: pill.grade, effect: pill.effect, potency: pill.potency }
            : { kind, id: herb!.id, name: herb!.name, grade: herb!.grade, biome: herb!.biome },
        quantity,
        cultivatorId: cultivator.id,
        runFlagged: true
    };
}

export async function handleSetAmbient(args: z.infer<typeof SetAmbientSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_ambient');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const day = Math.floor(run.elapsedDays);
    const base = cultivator.location ?? 'the open road';

    // Ambient qi is a pure function of (seed, place, day). The honest way to
    // change it is therefore to change the place - and to a place the engine
    // really does compute this band for, not to a claim about the old one.
    const alias = aliasForAmbient(run.seed, base, day, args.band as AmbientQi);
    if (!alias) {
        return guidingError(
            'ambient_alias_not_found',
            `No aliased site near "${base}" derives ${args.band} on this block. The search is bounded on purpose.`,
            { band: args.band, location: base, day }
        );
    }

    const blockEnd = Math.floor(day / AMBIENT_BLOCK_DAYS) * AMBIENT_BLOCK_DAYS + AMBIENT_BLOCK_DAYS - 1;

    repos.db.transaction(() => {
        repos.db.prepare(`
            INSERT INTO ambient_aliases (run_id, location, alias, band, from_day, to_day)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(run.id, base, alias, args.band, day, blockEnd);
        writeAdminAudit(repos, 'set_ambient', run.id, {
            cultivatorId: cultivator.id,
            location: base,
            alias,
            band: args.band,
            fromDay: day,
            toDay: blockEnd
        });
    })();

    return {
        adminMode: true,
        set: true,
        location: base,
        alias,
        band: args.band,
        fromDay: day,
        toDay: blockEnd,
        note:
            'The gate lifted is "you must happen to be somewhere with this band". The band itself is still ' +
            `derived by the engine from (seed, "${alias}", day) - it was found, not declared. It holds for ` +
            'this 30-day ambient block only, then the world goes back to being what it is.',
        runFlagged: true
    };
}

export async function handleSetLocation(args: z.infer<typeof SetLocationSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_location');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const from = cultivator.location;

    // ── The destination has to be somewhere. ──────────────────────────────
    const gazetteer = await gazetteerFor(repos, run);
    const found = lookUpPlace(args.location, gazetteer);
    if (!found.canonical) {
        return guidingError(
            'unknown_place',
            `"${args.location}" is not a place. The map has no entry for it under that name or ` +
            'anything close enough to be sure of.',
            {
                asked: args.location,
                nearest: found.nearest,
                gazetteerSize: gazetteer.names.length,
                registers: gazetteer.sources,
                hint:
                    found.nearest.length > 0
                        ? `Did you mean one of: ${found.nearest.join(', ')}? Names are matched with ` +
                          'or without a leading "the", and a multi-word name needs no quoting.'
                        : 'ADMIN lifts content gates, not truth. It moves the cultivator to somewhere ' +
                          'that exists; it does not invent a location. The region catalog is the ' +
                          'authority and it is present whether or not the world driver is running.'
            }
        );
    }

    const to = found.canonical;
    const renamed = loosePlaceKey(to) !== loosePlaceKey(args.location) || to !== args.location.trim();

    const updated = repos.db.transaction(() => {
        const result = repos.cultivators.update(cultivator.id, { location: to });
        writeAdminAudit(repos, 'set_location', run.id, {
            cultivatorId: cultivator.id,
            from,
            asked: args.location,
            to
        });
        return result;
    })();

    return {
        adminMode: true,
        moved: true,
        from,
        to,
        asked: args.location,
        // Stored under the gazetteer's spelling, not the operator's, so every
        // later lookup - ambient, ground standing, who is co-located - joins.
        normalised: renamed,
        cultivator: updated ? describeCultivator(repos, updated, run) : null,
        runFlagged: true,
        note:
            'Checked against the region catalog, the world\'s own locations and everywhere somebody ' +
            'is standing. No travel time passed and nothing on the road happened: this is a ' +
            'placement, not a journey, and it is in the audit log as one.'
    };
}

export async function handleAdvanceDays(
    args: z.infer<typeof AdvanceDaysSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('advance_days');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;

    // Real time, through the real simulation. `idle` focus means no cultivation
    // progress accrues, but the body still ages, the belly still empties, the
    // stagnation clock still runs and the death checks still fire. Skipping
    // time is not skipping consequences.
    const result = await handleCultivate({
        action: 'cultivate',
        cultivatorId: cultivator.id,
        days: args.days,
        months: args.months,
        years: args.years,
        focus: 'idle',
        rations: args.rations ?? 0,
        autoBreakthrough: false,
        randomEvents: false
    } as Parameters<typeof handleCultivate>[0]);

    writeAdminAudit(repos, 'advance_days', run.id, {
        cultivatorId: cultivator.id,
        days: args.days,
        months: args.months,
        years: args.years,
        rations: args.rations ?? 0,
        result: isGuidingErrorBody(result) ? result : { advanced: true }
    });

    if (isGuidingErrorBody(result)) return result;

    // ── THE SPAN THAT WAS ASKED FOR AND THE SPAN THAT HAPPENED ────────────
    //
    // `years=50` moved 1.73 years and `days=200000` moved 180, and the caller
    // was told neither figure. Both numbers were in the result object the whole
    // time; nothing rendered them, and the note underneath asserted "Nothing
    // was skipped", which is the "fallbacks in ordinary English are invisible"
    // lesson wearing a reassurance. There is no arbitrary clamp here: the
    // simulation stops when something stops it, and what stopped it is a fact
    // the operator needs more than the day count.
    const body = result as Record<string, unknown>;
    const requested = typeof body.requestedDays === 'number' ? body.requestedDays : null;
    const simulated = typeof body.simulatedDays === 'number' ? body.simulatedDays : null;
    const reason = typeof body.interruptReason === 'string' ? body.interruptReason : null;
    const short = requested !== null && simulated !== null && simulated < requested;

    return {
        adminMode: true,
        advanced: true,
        ...result,
        stoppedShort: short
            ? {
                requestedDays: requested,
                simulatedDays: simulated,
                unsimulatedDays: requested! - simulated!,
                reason,
                explanation: explainInterrupt(reason),
                limit: interruptLimitFor(reason)
            }
            : null,
        note: short
            ? `The span asked for was ${requested} day(s) and ${simulated} were simulated. ` +
              `${explainInterrupt(reason)} This is not a clamp on how much time ADMIN may advance - ` +
              'it is the simulation refusing to run past something that happened. Time was advanced ' +
              'through simulateTimeSkip at idle focus: no cultivation progress, but real aging, real ' +
              'hunger, real stagnation and real death checks.'
            : 'Time was advanced through simulateTimeSkip at idle focus: no cultivation progress, but real ' +
              'aging, real hunger, real stagnation and real death checks. The whole span asked for was ' +
              'simulated; nothing was skipped except the gain.',
        runFlagged: true
    };
}

/**
 * What stopped the span, in a sentence.
 *
 * The engine's reason codes are precise and unreadable. Every one of these is
 * a real thing that happened to the cultivator rather than a budget - which is
 * the point, and the reason the response says so instead of reporting a limit
 * that does not exist.
 */
function explainInterrupt(reason: string | null): string {
    if (reason === null) return 'The simulation stopped without recording a reason, which is itself worth a look.';
    if (reason.startsWith('death:')) {
        return `The cultivator died (${reason.slice('death:'.length)}) and the run closed. Time stops there.`;
    }
    if (reason.startsWith('breakthrough_')) {
        return `A breakthrough resolved (${reason.slice('breakthrough_'.length)}) and it was wounding enough to stop the span.`;
    }
    switch (reason) {
        case 'provisions_exhausted':
            return 'The provisions ran out. Pass `rations=N` to buy N days of food up front, at the ordinary price out of the ordinary purse - unprovisioned, a body gets about fifty turns.';
        case 'starvation_begun':
            return 'The belly emptied and starvation began. Pass `rations=N` to provision the span.';
        case 'hostile_ground':
            return 'The ground where the cultivator is standing is killing them. Move somewhere survivable first with `set_location`.';
        case 'lethal_injury_threshold':
            return 'Untreated wounds reached the lethal count. Treat them before advancing further.';
        case 'major_encounter':
            return 'Somebody walked in. The span stops so the encounter can be played.';
        case 'toll_charged':
            return 'The Price of Advancement fell due at a realm boundary and was charged.';
        case 'iteration_limit':
            return `The simulation reached its own hard ceiling of ${MAX_SIMULATION_CHUNKS.toLocaleString('en')} chunks in one call. This one IS a limit, it exists so a single call cannot hang the process, and the way past it is to call advance_days again.`;
        default:
            return `The simulation reported "${reason}".`;
    }
}

/**
 * The hard chunk ceiling inside `simulateTimeSkip`, restated here only so the
 * one interrupt that genuinely IS a limit can name its own number.
 */
const MAX_SIMULATION_CHUNKS = 100_000;

/** The numeric limit behind a reason, where one exists. Null where none does. */
function interruptLimitFor(reason: string | null): number | null {
    return reason === 'iteration_limit' ? MAX_SIMULATION_CHUNKS : null;
}

/**
 * Fill the accumulator the engine already reads, and roll nothing.
 *
 * ══ WHY THIS EXISTS ═══════════════════════════════════════════════════════
 *
 * The surface could put a cultivator at any rung and could not test a crossing
 * FROM one. `set_realm` goes through `advanceRealm`, which clears accumulated
 * progress by design, and `advance_days` runs at idle focus and grants none by
 * design - so an operator could stand somebody at ordinal 41 and then had no
 * way at all to reach the attempt, which is the single thing anybody would use
 * this surface for.
 *
 * This does not take an outcome as input. Cultivation progress is an
 * accumulator, not a result: the engine decides what happens when it is spent,
 * and `canAttemptBreakthrough` is consulted here only to report, never to
 * change anything. It is the weaker sibling of `set_realm`, and it is the
 * honest one - it fills the tank and leaves the roll where it belongs.
 */
export async function handleGrantProgress(
    args: z.infer<typeof GrantProgressSchema>
): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('grant_progress');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);

    if (required === null) {
        return guidingError(
            'not_denominated_in_qi',
            `${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}. Whatever is above ` +
            'this is not bought with qi, and there is no amount of this currency that would do.',
            {
                ordinal: cultivator.realmOrdinal,
                hint:
                    'Above the Lid the progress ladder returns null rather than a number, because a ' +
                    'figure here would be a lie with a lot of digits in it. Nothing to grant.'
            }
        );
    }

    const before = cultivator.cultivationProgress;
    const wantsFill = args.fill === true || args.amount === undefined;
    const amount = wantsFill ? Math.max(0, required - before) : args.amount!;

    if (amount <= 0) {
        return guidingError(
            'already_at_the_bar',
            `${cultivator.name} already holds ${before} of the ${required} qi-units the attempt from ` +
            `${rankName(cultivator.realmOrdinal)} needs.`,
            { progress: before, required, hint: 'Pass `amount=N` to add anyway.' }
        );
    }

    const updated = repos.db.transaction(() => {
        const result = repos.cultivators.update(cultivator.id, {
            cultivationProgress: before + amount
        });
        writeAdminAudit(repos, 'grant_progress', run.id, {
            cultivatorId: cultivator.id,
            ordinal: cultivator.realmOrdinal,
            before,
            granted: amount,
            after: before + amount,
            required,
            mode: wantsFill ? 'fill_to_the_bar' : 'explicit_amount'
        });
        return result;
    })();

    // Read back through the engine's own eligibility check. Reported, never
    // acted on: whether the attempt is legal is the engine's answer and this
    // action does not attempt anything.
    const after = updated ?? cultivator;
    const eligibility = canAttemptBreakthrough(after);

    return {
        adminMode: true,
        granted: true,
        ordinal: after.realmOrdinal,
        rank: rankName(after.realmOrdinal),
        progressBefore: before,
        progressGranted: amount,
        progressAfter: after.cultivationProgress,
        progressRequired: required,
        mode: wantsFill ? 'fill_to_the_bar' : 'explicit_amount',
        eligibility: {
            eligible: eligibility.eligible,
            reason: eligibility.eligible ? null : eligibility.reason,
            progressAvailable: eligibility.progressAvailable,
            progressRequired: eligibility.progressRequired,
            daoRequired: eligibility.daoRequired,
            daoHeld: eligibility.daoHeld
        },
        runFlagged: true,
        note:
            'Qi-units were added to the accumulator through CultivatorRepository.update. NO BREAKTHROUGH ' +
            'WAS ROLLED AND NONE IS CLAIMED: the eligibility above is a read of what the engine now ' +
            'thinks, and the attempt itself still has to be made and can still fail or kill. Nothing ' +
            'else moved - not the rung, not the peak, not the stagnation clock, not the foundation.'
    };
}

export async function handleSetRealm(args: z.infer<typeof SetRealmSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('set_realm');
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const from = cultivator.realmOrdinal;
    const delta = args.ordinal - from;

    if (delta === 0) {
        return guidingError(
            'already_at_ordinal',
            `${cultivator.name} already stands at ${rankName(from)}.`,
            { ordinal: from }
        );
    }

    // ── THE RUNG AND THE CROSSING ARE TWO SEPARATE FACTS ──────────────────
    //
    // `immortalStatus` is written in exactly one place in the engine: by an
    // actual last crossing, through `result.immortalStatusGained`. `set_realm`
    // is a bookkeeping write through `advanceRealm`, which does not touch it -
    // so placing somebody at 45 gave the right rank, the right lifespan and the
    // right refusal, and left `immortalStatus: "none"` behind them. Everything
    // downstream then misread it: `theOnlyAxisLeft` was false for a False
    // Immortal where the code says it is literally true, a False Immortal was
    // offered "True Immortal" as a next rank though the Lid never opens twice,
    // and a True Immortal standing in Undersnow was offered farmhand work.
    //
    // The distinction between STANDING at a rung and HAVING CROSSED is real and
    // load-bearing elsewhere - `canExistBeyondTheLid` reads the status on
    // purpose and is deliberately left alone. What was wrong is that admin set
    // one of the two facts and not the other. It sets both now, at this layer,
    // and says so.
    const status =
        args.ordinal === TRUE_IMMORTAL_ORDINAL
            ? ('true_immortal' as const)
            : args.ordinal === FALSE_IMMORTAL_ORDINAL
                ? ('false_immortal' as const)
                : null;
    const statusBefore = cultivator.immortalStatus;

    const updated = repos.db.transaction(() => {
        // The same road every rank change takes: peak_ordinal is stamped,
        // accumulated progress is cleared, the stagnation clock restarts.
        let result = repos.cultivators.advanceRealm(cultivator.id, delta);
        // `recordImmortalStatus` refuses to overwrite a status already held, so
        // somebody who genuinely crossed keeps the crossing they made.
        if (status !== null && statusBefore === 'none') {
            result = repos.cultivators.recordImmortalStatus(cultivator.id, status) ?? result;
        }
        writeAdminAudit(repos, 'set_realm', run.id, {
            cultivatorId: cultivator.id,
            fromOrdinal: from,
            toOrdinal: args.ordinal,
            delta,
            immortalStatusBefore: statusBefore,
            immortalStatusWritten: status !== null && statusBefore === 'none' ? status : null,
            via: 'CultivatorRepository.advanceRealm'
        });
        return result;
    })();

    const runAfter = repos.runs.getById(run.id)!;
    const statusWritten = status !== null && statusBefore === 'none' ? status : null;

    return {
        adminMode: true,
        set: true,
        fromOrdinal: from,
        fromRank: rankName(from),
        toOrdinal: args.ordinal,
        toRank: rankName(args.ordinal),
        progressCleared: true,
        stagnationClockReset: true,
        peakOrdinal: runAfter.peakOrdinal,
        immortalStatus: updated?.immortalStatus ?? statusBefore,
        immortalStatusWritten: statusWritten,
        cultivator: updated ? describeCultivator(repos, updated, runAfter) : null,
        runFlagged: true,
        note:
            'No breakthrough was rolled and none is claimed. This is a bookkeeping write through ' +
            'advanceRealm, it is in the audit log, and this run is excluded from the death ledger.' +
            (statusWritten
                ? ` The two rungs above the Lid are the two landings of one crossing, so immortalStatus ` +
                  `was set to "${statusWritten}" in the same transaction: a rung without a status is a ` +
                  'state the engine has no reading for, and everything downstream misreads it. NO ' +
                  'CROSSING WAS ATTEMPTED AND NONE IS CLAIMED - the tribulation was not rolled, ' +
                  'nothing was survived, and the ledger of what a crossing takes away is empty ' +
                  'because nothing was taken.'
                : '')
    };
}

export async function handleAuditLog(args: z.infer<typeof AuditLogSchema>): Promise<object> {
    if (!isAdminModeEnabled()) return adminDisabled('audit_log');
    const repos = ensureCultivationDb();
    const run = args.runId ? repos.runs.getById(args.runId) : repos.runs.getActiveRun();

    return {
        adminMode: true,
        runId: run?.id ?? null,
        runFlagged: run ? isAdminRun(repos.db, run.id) : false,
        entries: adminAuditTrail(repos.db, run?.id ?? null, args.limit ?? 50),
        note: 'These rows are the admin flag. run_manage.ledger reads them to exclude these runs.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<AdminAction, ActionDefinition> = {
    roster: {
        schema: RosterSchema,
        handler: handleRoster,
        aliases: ['world', 'everyone', 'all_cultivators'],
        description: 'Every cultivator in the world, read-only'
    },
    spawn_encounter: {
        schema: SpawnEncounterSchema,
        handler: handleSpawnEncounter,
        aliases: ['encounter', 'spawn_enemy'],
        description: 'Instantiate a real opponent at a normally-gated realm ordinal'
    },
    spawn_site: {
        schema: SpawnSiteSchema,
        handler: handleSpawnSite,
        aliases: ['site', 'spawn_grave', 'grave', 'reveal_site'],
        description: 'Reveal a real catalogued site so the player can name it; its own gates all stand'
    },
    grant_item: {
        schema: GrantItemSchema,
        handler: handleGrantItem,
        aliases: ['grant', 'give_item', 'give'],
        description: 'Put a catalog pill or herb into the real pouch'
    },
    set_ambient: {
        schema: SetAmbientSchema,
        handler: handleSetAmbient,
        aliases: ['ambient', 'set_qi'],
        description: 'Relocate to a place the engine derives the requested ambient band for'
    },
    set_location: {
        schema: SetLocationSchema,
        handler: handleSetLocation,
        aliases: ['move', 'teleport', 'relocate'],
        description: 'Move the cultivator to a place that is really on the map'
    },
    advance_days: {
        schema: AdvanceDaysSchema,
        handler: handleAdvanceDays,
        aliases: ['advance', 'skip_time', 'fast_forward'],
        description: 'Advance real in-world time with real consequences and no cultivation gain'
    },
    grant_progress: {
        schema: GrantProgressSchema,
        handler: handleGrantProgress,
        aliases: ['progress', 'grant_qi', 'fill_progress', 'fill'],
        description: 'Fill the qi-unit accumulator so a crossing can be ATTEMPTED. Rolls nothing.'
    },
    set_realm: {
        schema: SetRealmSchema,
        handler: handleSetRealm,
        aliases: ['realm', 'set_ordinal', 'set_rank'],
        description: 'Move the cultivator on the ladder through advanceRealm; logged and flagged'
    },
    audit_log: {
        schema: AuditLogSchema,
        handler: handleAuditLog,
        aliases: ['audit', 'log', 'trail'],
        description: 'The admin audit trail for a run - the rows that flag it'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const AdminManageTool = {
    name: 'admin_manage',
    description: `ADMIN - exploratory testing surface. Requires ADMIN_MODE=true in the environment;
every other call is refused with a clear error and no fallback path.

ADMIN LIFTS GATES, NOT TRUTH. Revealing a Tribulation Transcender's grave to a Qi Condensation
player is a content gate being lifted: the site is a real catalogued site, and every gate inside
it - strength, comprehension, the claim conditions - still stands and still refuses.

There is NO action here - and there must never be one - that takes an outcome as input and
records it. No declare, no force_success, no set_hp, no revive. Every action below performs a real
deterministic mutation and returns what the engine actually did.

- roster           every cultivator in the world with rank, location, sect, standing (read-only)
- spawn_site       reveals a real catalogued site by ordinal or by name; awareness gate only
- spawn_encounter  a REAL persisted NPC cultivator with engine-rolled talent at any ordinal
- grant_item       catalog pills and herbs only, into the real pouch
- set_ambient      relocates to a place the engine genuinely derives that band for, this block only
- set_location     move the cultivator; the destination is checked against the real gazetteer
- advance_days     real time through simulateTimeSkip: real aging, hunger, stagnation, death.
                   Says how much of the span it actually simulated and what stopped it.
- grant_progress   fills the qi-unit accumulator so a crossing can be ATTEMPTED; rolls nothing
- set_realm        goes through advanceRealm like any other rank change; logged and flagged
- audit_log        the admin trail for this run

Arguments are key=value. A value runs to the next key, so a multi-word name needs no quoting:
  ADMIN set_location location=The Dead Verge
  ADMIN spawn_site ordinal=41 kind=grave

Every call is audited, and the run is flagged so it is excluded from the death ledger and from
balance statistics.

Actions: ${ACTIONS.join(', ')}`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        runId: z.string().optional(),
        ordinal: z.number().int().optional(),
        kind: z.enum(['grave', 'trial', 'any']).optional(),
        name: z.string().optional(),
        location: z.string().optional(),
        disposition: z.enum(['hostile', 'wary', 'indifferent']).optional(),
        itemId: z.string().optional(),
        quantity: z.number().int().optional(),
        band: AmbientQiSchema.optional(),
        days: z.number().optional(),
        months: z.number().optional(),
        years: z.number().optional(),
        rations: z.number().int().optional(),
        amount: z.number().optional(),
        fill: z.boolean().optional(),
        includeDead: z.boolean().optional(),
        limit: z.number().int().optional()
    })
};

/**
 * The routed result as an object, before it is written out for a reader.
 *
 * Exported because `handleAdminManage` no longer embeds a machine payload in
 * its text (see the note at the bottom of it), and a programmatic caller - a
 * test, a harness, another tool - should be reading the result rather than
 * parsing prose out of it. This is that door, and it is the honest one:
 * `read state, not prose`.
 */
export async function adminResult(args: unknown): Promise<Record<string, unknown>> {
    const response = await router(args as Record<string, unknown>);
    const text = response.content[0]?.text ?? '{}';
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { error: 'unreadable_admin_result', message: text };
    }
}

export async function handleAdminManage(
    args: unknown,
    _ctx?: SessionContext
): Promise<McpResponse> {
    const response = await router(args as Record<string, unknown>);
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return response;
        const data = JSON.parse(jsonText);

        let output = '';
        if (data.error === 'admin_mode_disabled') {
            output = RichFormatter.header('Admin Mode Disabled', '🔒');
            output += RichFormatter.alert(data.message, 'error');
            output += `\n*${data.hint}*\n`;
        } else if (data.error === true || typeof data.error === 'string') {
            output = RichFormatter.header('Admin Refused', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (Array.isArray(data.nearest) && data.nearest.length > 0) {
                output += RichFormatter.list(data.nearest.map(String));
            }
            if (data.hint) output += `\n*${data.hint}*\n`;
        } else if (data.roster) {
            output = RichFormatter.header(`World Roster (${data.count})`, '🗺️');
            output += RichFormatter.table(
                ['Name', 'Kind', 'Rank', 'Root', 'Sect', 'Location', 'Alive'],
                data.roster.map((r: Record<string, unknown>) => [
                    String(r.name), String(r.kind), String(r.rank), String(r.spiritRootName),
                    String(r.sectName ?? '-'), String(r.location ?? '-'), r.alive ? 'yes' : 'no'
                ])
            );
        } else if (data.site) {
            output = RichFormatter.header(`Site Revealed: ${data.site.name}`, '⛏️');
            output += RichFormatter.keyValue({
                'Catalog id': data.site.catalogId ?? data.site.id,
                'Kind': data.site.kind,
                'Pitched at': `ordinal ${data.site.ordinal} (${data.site.rank})`,
                'Chosen because': data.selection,
                'Was already nameable': data.site.awarenessAlreadyHeld ? 'yes' : 'no',
                'Say this': Array.isArray(data.sayThis) ? data.sayThis.join('  |  ') : undefined
            });
            output += RichFormatter.alert(
                'Awareness gate lifted, and nothing else. Every gate inside this site still stands.',
                'warning'
            );
        } else if (data.encounterId) {
            output = RichFormatter.header('Encounter Spawned', '⚔️');
            output += RichFormatter.keyValue({
                'Encounter': data.encounterId,
                'Opponent': data.opponent?.name,
                'Rank': data.opponent?.realm?.name,
                'Power ratio': data.gateLifted?.powerRatio,
                'Disposition': data.disposition
            });
        } else if (data.moved) {
            output = RichFormatter.header('Moved', '🧭');
            output += RichFormatter.keyValue({
                'From': data.from ?? '(nowhere recorded)',
                'To': data.to,
                'Asked for': data.normalised ? data.asked : undefined
            });
        } else if (data.advanced) {
            output = RichFormatter.header('Time Advanced', '⏳');
            output += RichFormatter.keyValue({
                'Requested': `${data.requestedDays} day(s)`,
                'Simulated': `${data.simulatedDays} day(s) (${data.simulatedYears} years)`,
                'Stopped short by': data.stoppedShort
                    ? `${data.stoppedShort.unsimulatedDays} day(s) - ${data.stoppedShort.reason}`
                    : 'nothing; the whole span ran'
            });
            if (data.stoppedShort) {
                output += RichFormatter.alert(String(data.stoppedShort.explanation), 'warning');
            }
        } else if (data.granted === true && data.progressAfter !== undefined) {
            output = RichFormatter.header('Progress Granted', '📈');
            output += RichFormatter.keyValue({
                'Standing at': `ordinal ${data.ordinal} (${data.rank})`,
                'Progress': `${data.progressBefore} -> ${data.progressAfter} of ${data.progressRequired} required`,
                'Attempt now legal': data.eligibility?.eligible
                    ? 'yes'
                    : `no - ${data.eligibility?.reason ?? 'the engine says not'}`,
                'Dao roads': `${data.eligibility?.daoHeld} held, ${data.eligibility?.daoRequired} required`
            });
        } else if (data.set === true && data.toRank) {
            output = RichFormatter.header(`Rung Set: ${data.toRank}`, '🪜');
            output += RichFormatter.keyValue({
                'From': `${data.fromOrdinal} (${data.fromRank})`,
                'To': `${data.toOrdinal} (${data.toRank})`,
                'Immortal status': data.immortalStatus,
                'Status written here': data.immortalStatusWritten ?? 'no - the rung is below the Lid',
                'Progress cleared': data.progressCleared ? 'yes' : 'no',
                'Peak stamped': data.peakOrdinal
            });
        } else {
            output = RichFormatter.header('Admin', '🔧');
            output += RichFormatter.keyValue({
                'Action performed': Object.keys(data).find(k =>
                    ['granted', 'moved', 'set', 'advanced', 'spawned'].includes(k)
                ) ?? 'read',
                'Run flagged': data.runFlagged ?? false
            });
        }

        if (data.note) output += `\n*${data.note}*\n`;

        // ── NO SERIALISED STATE OBJECT ────────────────────────────────────
        //
        // This used to append the whole result blob through
        // `RichFormatter.embedJson`. The wrapper is an HTML comment, which is
        // invisible in a browser and NOT invisible in the game's narrative log,
        // where it is rendered as text - so every admin call dumped several
        // kilobytes of internal state into the player's story, the same family
        // as the `technique_manage.list_available` and `encounters.assessFit`
        // leaks. Admin output is out-of-world and it is legible; it is not a
        // machine payload wearing prose as a hat. Anything an operator needs is
        // rendered above by name, and `audit_log` holds the record.
        output += `\n> ADMIN - out of world. Nothing above is narration, and no part of it is a claim about ` +
            `what a character perceives. Run flagged: ${data.runFlagged === true ? 'yes' : 'no'}.\n`;

        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
