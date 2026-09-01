/**
 * Filling the catalog's `{token}` slots with facts.
 *
 * `encounters.ts` is explicit that a `summaryTemplate` is an ENGINE-AUTHORED
 * FACTUAL SUMMARY and not prose. This module is what makes that true: every
 * slot is filled from arithmetic, from `regard.ts`, or from a name the CALLER
 * supplied, and nothing here composes a proper noun of its own.
 *
 * ── The rule this module enforces ────────────────────────────────────────
 *
 * `docs/world/discovery.md`: never reference an entity the player has no
 * knowledge record for. A summary is handed to a narrator, so a faction name
 * dropped into `{faction}` is a name spoken in the player's hearing. Two ways
 * that is legitimate and one way it is not:
 *
 *   legitimate   the player already knows the name
 *   legitimate   a PERSON in the encounter says it, flatly, assuming it needs
 *                no explaining - which is discovery.md's preferred way for a
 *                name to enter the world, and which produces a knowledge grant
 *                at the lowest stage with the source recorded honestly
 *   not          the engine narrating an unknown name in its own voice
 *
 * The third case is what `UNATTRIBUTED` is for. The consequence still arrives;
 * it simply arrives without anybody's name on it, which is the design and not a
 * degradation of it.
 */

import { MAX_ORDINAL, rankName } from '../cultivation/realms.js';
// The ONE banding table. This file used to carry a second one with different
// floors, which is how an encounter line and the sheet beside it came to
// disagree about the same ground.
import { QI_DENSITY_DEFAULT, ordinaryBandFor } from '../world/qi-scale.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import type {
    EncounterName,
    EncounterNamePools,
    EncounterPerson,
    EncounterPlace,
    KnowledgeGrant
} from './types.js';

/** What is said when there is no name that may be said. */
const UNATTRIBUTED = {
    faction: 'a body nobody here would name',
    rivalFaction: 'another body nobody here would name',
    place: 'somewhere up the valley',
    person: 'somebody',
    target: 'a connection the offer named and the record does not'
} as const;

/**
 * Kinds where a person is doing the talking.
 *
 * The narrow gate on unknown names being SAID. A ledger clerk, a recruiter, an
 * auctioneer and a sect messenger all state affiliations flatly because it has
 * not occurred to them that anyone would not know. A beast on a vein does not.
 */
const SPEAKING_KINDS = new Set(['dao_house', 'sect_event', 'commerce']);

export interface FillContext {
    entry: EncounterEntry;
    ordinal: number;
    place: EncounterPlace;
    cast: readonly EncounterPerson[];
    names: EncounterNamePools;
    rng: CultivationRNG;
    /** Absolute day, for anything dated. */
    absoluteDay: number;
    /** `Regard.damageMultiplier` against the threat, when there is one. */
    threatGap: number;
    /**
     * Whether the encounter actually arrived.
     *
     * Load-bearing, and it was not obvious until a guard caught it. A window
     * that had already shut still produces a summary, and if that summary
     * carries a name the player never earned, the discovery rule has been
     * broken by an event that did not even happen. Nobody said anything to
     * somebody who arrived four days late, so nothing is named and nothing is
     * granted. Defaults true for callers that resolve everything.
     */
    spoken?: boolean;
    /**
     * The body doing the asking, when one particular body is.
     *
     * Takes precedence for `{faction}`. A summons comes from the house the
     * cultivator belongs to and from nobody else, and drawing it out of the
     * general pool would occasionally have somebody else's sect order them
     * to a wall.
     */
    primaryFaction?: EncounterName | null;
}

export interface FillResult {
    values: Record<string, string | number>;
    grants: KnowledgeGrant[];
    castIds: string[];
}

/**
 * Fill every token the entry declares.
 *
 * Only the declared ones: `entry.tokens` is the contract, and a token the
 * catalog did not declare is a catalog bug that should stay visible rather
 * than be papered over here.
 */
export function fillTokens(ctx: FillContext): FillResult {
    const grants: KnowledgeGrant[] = [];
    const castIds: string[] = [];
    const values: Record<string, string | number> = {};
    const arrived = ctx.spoken ?? true;
    const speaking =
        arrived && (SPEAKING_KINDS.has(ctx.entry.kind) || ctx.entry.tags.includes('social'));

    // Drawn once and reused, so `{faction}` and `{rivalFaction}` in one summary
    // are two different bodies and `{name}` is one person throughout.
    const faction = ctx.primaryFaction
        ? { picked: ctx.primaryFaction, text: ctx.primaryFaction.name }
        : takeName(ctx.names.factions ?? [], ctx.rng, speaking, 'sect', grants);
    const rival = takeName(
        (ctx.names.factions ?? []).filter(f => f.id !== faction.picked?.id),
        ctx.rng, speaking, 'sect', grants
    );
    const person = arrived ? takePerson(ctx, grants, castIds) : UNATTRIBUTED.person;

    for (const token of ctx.entry.tokens) {
        values[token] = fillOne(token, ctx, {
            faction: faction.text ?? UNATTRIBUTED.faction,
            rivalFaction: rival.text ?? UNATTRIBUTED.rivalFaction,
            person
        });
    }

    return { values, grants, castIds };
}

interface Resolved {
    faction: string;
    rivalFaction: string;
    person: string;
}

function fillOne(token: string, ctx: FillContext, resolved: Resolved): string | number {
    const rng = ctx.rng;
    const o = ctx.ordinal;

    switch (token) {
        // ── people, places, bodies ──────────────────────────────────────
        case 'faction':
            return resolved.faction;
        case 'rivalFaction':
            return resolved.rivalFaction;
        case 'name':
            return resolved.person;
        case 'place':
            return ctx.place.name;
        case 'target':
            return UNATTRIBUTED.target;
        case 'witnesses':
            return ctx.cast.length;

        // ── the ladder ──────────────────────────────────────────────────
        case 'threatRank':
            return rankName(clampOrdinal(ctx.entry.threatOrdinal ?? o));
        case 'rank':
            return rankName(clampOrdinal(o));
        case 'wardOrdinal':
            return rankName(clampOrdinal(o + rng.int(2, 6)));
        case 'gap':
            return Math.abs(Math.round(ctx.threatGap));

        // ── counts ──────────────────────────────────────────────────────
        case 'count':
            return rng.int(2, 9);
        case 'settlements':
            return rng.int(1, 6);
        case 'occupants':
            return rng.int(8, 90);
        case 'supported':
            return rng.int(3, 20);
        case 'failed':
            return rng.int(0, 4);
        case 'untreated':
            return rng.int(0, 3);
        case 'generations':
            return rng.int(2, 7);

        // ── time ────────────────────────────────────────────────────────
        case 'days':
            return rng.int(3, 90);
        case 'years':
            return rng.int(5, 900);
        case 'remainingYears':
            return rng.int(4, 120);

        // ── money and measure ───────────────────────────────────────────
        case 'stones':
            return stonesFor(o, rng);
        case 'percent':
            return rng.int(5, 70);
        case 'range':
            return rng.int(4, 300);
        case 'height':
            return `${rng.int(5, 9)} feet`;

        // ── the ground ──────────────────────────────────────────────────
        case 'ambient':
            return ambientWord(ctx.place, rng);
        case 'sealGrade':
        case 'grade':
            return gradeWord(rng);
        case 'feature':
            return featureWord(ctx.place, rng);

        // ── content the caller substantiated ────────────────────────────
        case 'herbName':
            return pickOr(ctx.names.herbs, rng, 'a spirit herb');
        case 'pillName':
            return pickOr(ctx.names.pills, rng, 'a pill nobody here refines');
        case 'techniqueName':
            return pickOr(ctx.names.techniques, rng, 'a method they will not write down');
        case 'loot':
            return pickOr(ctx.names.loot, rng, 'a storage pouch and what was in it');

        // ── stated circumstance ─────────────────────────────────────────
        case 'cause':
            return pick(rng, CAUSES);
        case 'grudgeSource':
            return pick(rng, GRUDGES);
        case 'severity':
            return pick(rng, SEVERITIES);
        case 'condition':
            return pick(rng, CONDITIONS);
        case 'method':
            return pick(rng, METHODS);
        case 'reason':
            return pick(rng, REASONS);
        case 'stakes':
            return pick(rng, STAKES);
        case 'terms':
            return pick(rng, TERMS);
        case 'counterTerms':
            return pick(rng, COUNTER_TERMS);
        case 'penalty':
            return pick(rng, PENALTIES);
        case 'requirement':
            return pick(rng, REQUIREMENTS);
        case 'task':
            return pick(rng, TASKS);
        case 'consequence':
            return pick(rng, CONSEQUENCES);
        case 'contained':
            return pick(rng, CONTAINED);

        default:
            // Left visible on purpose. `encounters.ts` says an unfilled token
            // should be loud in the log rather than quietly become an empty
            // string the narrator then writes around.
            return `{${token}}`;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// NAMES
// ─────────────────────────────────────────────────────────────────────────

interface TakenName {
    picked: EncounterName | null;
    /** The name, or null when nothing may be said. */
    text: string | null;
}

/**
 * A name that may appear in this summary.
 *
 * Known names first, always. An unknown name is used only when somebody in the
 * encounter is doing the talking, and using one records the acquisition at the
 * lowest stage with the source and the fact that it was not explained.
 */
function takeName(
    pool: readonly EncounterName[],
    rng: CultivationRNG,
    speaking: boolean,
    kind: 'sect' | 'place',
    grants: KnowledgeGrant[]
): TakenName {
    if (pool.length === 0) return { picked: null, text: null };

    const known = pool.filter(n => n.known);
    if (known.length > 0) {
        const picked = known[rng.int(0, known.length - 1)];
        return { picked, text: picked.name };
    }

    if (!speaking) return { picked: null, text: null };

    const picked = pool[rng.int(0, pool.length - 1)];
    grants.push({
        kind,
        id: picked.id,
        name: picked.name,
        sourceKind: 'told',
        sourceNote:
            'Said flatly, in the middle of something else, by somebody to whom it ' +
            'did not occur that it might need explaining.',
        stance: 'suspects',
        confidence: 0.2,
        statement: `${picked.name} is a name that got said. What it is remains unknown.`
    });
    return { picked, text: picked.name };
}

/**
 * Somebody out of the crowd.
 *
 * The promotion seam. A place holds people who are nobody in particular until
 * something makes one of them a person; an encounter is one of the things that
 * does. The grant is `witnessed` rather than `told` - the player was in the
 * same event as them, which is a stronger fact than a name in a sentence.
 *
 * Nobody present means nobody is named. This module never invents a person.
 */
function takePerson(
    ctx: FillContext,
    grants: KnowledgeGrant[],
    castIds: string[]
): string {
    const cast = ctx.cast;
    if (cast.length === 0) return UNATTRIBUTED.person;

    // Whoever is nearest the pitch of the entry, so a duel challenge comes from
    // somebody who could plausibly issue one. Ties break on id for stability.
    const pitch = ctx.entry.threatOrdinal ?? ctx.entry.minOrdinal;
    const ranked = [...cast].sort((a, b) =>
        Math.abs(a.realmOrdinal - pitch) - Math.abs(b.realmOrdinal - pitch) ||
        (a.id < b.id ? -1 : 1));
    const near = ranked.slice(0, Math.min(4, ranked.length));
    const picked = near[ctx.rng.int(0, near.length - 1)];

    castIds.push(picked.id);
    if (!picked.known) {
        grants.push({
            kind: 'cultivator',
            id: picked.id,
            name: picked.name,
            sourceKind: 'witnessed',
            sourceNote: `Met at ${ctx.place.name} on day ${Math.round(ctx.absoluteDay)}. ` +
                (picked.factionName
                    ? `They gave ${picked.factionName}${picked.rank ? `, as ${picked.rank}` : ''}.`
                    : 'They gave nothing anybody could point at.'),
            stance: 'knows',
            confidence: 0.9,
            statement: `${picked.name} is somebody they have now dealt with.`
        });
    }
    return picked.name;
}

// ─────────────────────────────────────────────────────────────────────────
// STATED CIRCUMSTANCE
// Short factual phrases, not prose. The narrator writes the scene; these are
// the facts it is written from, and they exist so that two firings of the same
// row are two different events rather than the same sentence twice.
// ─────────────────────────────────────────────────────────────────────────

const CAUSES = [
    'a vein shifting upstream', 'a failed crossing', 'an unpaid toll',
    'a claim nobody checked', 'a seal that gave out', 'a harvest that failed twice',
    'a debt inherited with a house', 'a road closed without notice'
] as const;

const GRUDGES = [
    'a contested claim', 'a death in a shared party', 'a broken witness',
    'a herb ground taken', 'a name given to an auditor'
] as const;

const SEVERITIES = ['minor', 'serious', 'crippling'] as const;

const CONDITIONS = [
    'water-damaged, most of it legible', 'the first third missing',
    'complete, and in a hand nobody reads now', 'burned at one edge'
] as const;

const METHODS = [
    'force', 'a borrowed key', 'a formation read from the outside',
    'the method for a different seal of the same age'
] as const;

const REASONS = [
    'an unsettled assessment', 'no registration held',
    'a standing instruction that names nobody', 'insufficient standing'
] as const;

const STAKES = [
    'the loser leaves the county', 'whatever is carried',
    'a public acknowledgement', 'the herb ground'
] as const;

const TERMS = [
    'passage and no more', 'the site left alone for a hundred years',
    'one debt called in later, unspecified', 'a share of what comes up'
] as const;

const COUNTER_TERMS = [
    'the drawing rights over the vein', 'silence about what is down there',
    'one act, named at the time'
] as const;

const PENALTIES = [
    'the whole of what was staked, and standing', 'the claim reverts',
    'a line on a register that is never struck'
] as const;

const REQUIREMENTS = [
    'a spirit root of any grade', 'passing an open trial',
    'a name held on the register', 'a sponsor already inside'
] as const;

const TASKS = [
    'a culling contract', 'escorting a shipment two counties over',
    'clearing a nest off a claim', 'standing witness at a signing'
] as const;

const CONSEQUENCES = [
    'withdrawn every service it had standing in the county',
    'entered a line on a register and sent nobody',
    'declined to certify anything for the parties involved',
    'stopped carrying anyone on that route'
] as const;

const CONTAINED = [
    'something the perimeter was built around', 'a scar still drawing',
    'a chamber nobody has opened', 'a thing that has not been described in writing'
] as const;

// ─────────────────────────────────────────────────────────────────────────
// SMALL DERIVATIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Money scales with the rung.
 *
 * A crude exponent, and deliberately crude: the point is that a toll a Qi
 * Condensation cultivator cannot pay is pocket change ten rungs up, which is
 * the same statement the regard bands make about damage.
 */
function stonesFor(ordinal: number, rng: CultivationRNG): number {
    const base = Math.round(6 * Math.pow(1.28, Math.max(0, ordinal)));
    return Math.max(1, rng.int(Math.max(1, Math.round(base * 0.4)), Math.max(2, base * 2)));
}

/**
 * The band of the ground this is happening on.
 *
 * Two defects lived here, and both of them made an encounter line assert a
 * MEASUREMENT the rest of the engine disagreed with. The crowding template
 * reads "Measured ambient has fallen to {ambient}", which is a claim about a
 * reading, so getting it wrong is not a wording problem.
 *
 *   A SECOND BANDING TABLE. The floors here were 70/40/15 against
 *   `QI_BAND_FLOORS`' 90/55/25, so the same density banded two ways depending
 *   on which reader you asked. A place at 45 was `dense` in this sentence and
 *   `normal` on the sheet beside it. One table now, the canonical one.
 *
 *   A RANDOM DRAW WHERE THERE WAS NO READING. An unmapped place - a road, a
 *   hillside, anywhere the world has no record for - has no density, and this
 *   answered by picking a band out of a hat and then calling it "measured".
 *   Played live, that is how the panel, `/api/state` and the engine log came to
 *   give three different answers about the same ground. Unmeasured ground now
 *   reads as the Late Age's ordinary open air, which is what such a place is.
 *
 * The sample is still drawn, because every stream in this package is aligned by
 * position and dropping a draw would shift every subsequent one.
 */
function ambientWord(place: EncounterPlace, rng: CultivationRNG): string {
    void pick(rng, ['thin', 'normal', 'dense'] as const);
    const density = place.qiDensity;
    return ordinaryBandFor(
        typeof density === 'number' && Number.isFinite(density) ? density : QI_DENSITY_DEFAULT
    );
}

function gradeWord(rng: CultivationRNG): string {
    return pick(rng, ['mortal', 'spirit', 'earth', 'heaven', 'immortal'] as const);
}

function featureWord(place: EncounterPlace, rng: CultivationRNG): string {
    const hazards = place.hazards ?? [];
    if (hazards.length > 0) return hazards[rng.int(0, hazards.length - 1)];
    return pick(rng, ['vein', 'ridge', 'water', 'ledge'] as const);
}

function pick<T>(rng: CultivationRNG, items: readonly T[]): T {
    return items[rng.int(0, items.length - 1)];
}

function pickOr(items: readonly string[] | undefined, rng: CultivationRNG, fallback: string): string {
    if (!items || items.length === 0) return fallback;
    return items[rng.int(0, items.length - 1)];
}

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}
