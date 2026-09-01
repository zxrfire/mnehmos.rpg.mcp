/**
 * Work an institution gives you, and work you go and ask for.
 *
 * The gap this closes: a Dew Servant and a rogue currently live identical
 * lives. Membership costs a lifetime to obtain and pays a stipend, and there
 * is nothing whatever that a member DOES. Two shapes fix that, and they are
 * the same object seen from two directions:
 *
 *   the summons      the house calls on you. You may refuse, and refusing is
 *                    a row in the obligations ledger rather than a shrug
 *   the commission   you go to the board and take something. Accepting is an
 *                    oath; not finishing it is a broken one
 *
 * The difference between "a beast is on the road" and "the house has sent for
 * you because something came through the eastern wall and you are what they
 * have" is the whole of what makes a world feel inhabited, and only the second
 * one makes a membership mean anything.
 *
 * ── There is no duty catalog ─────────────────────────────────────────────
 *
 * This file authors no content and holds no rows. A duty is a READING of an
 * `ENCOUNTERS` row that already exists, and the reading is done over columns
 * the catalog already carries:
 *
 *   `enc-sect-war-mobilization`  tags obligation, war   -> a muster
 *   `enc-caravan-under-attack`   tags reward, timed     -> intervention wanted, now
 *   `enc-beast-tide`             tags tide, regional    -> a recall
 *   `enc-plague-village`         tags support           -> somebody needs a healer
 *   `enc-sect-mission-board`     tags quest             -> the board itself
 *   `enc-alchemist-commission`   tags quest, timed      -> a contract
 *
 * A parallel table beside `encounters.ts` carrying the same situations with a
 * payout column bolted on is exactly the mistake AGENTS.md names. So the
 * situation stays in the catalog, and the TERMS - how long, what it pays, what
 * refusing costs - are computed here from the rung it is pitched at and the
 * standing of whoever is being asked. No arithmetic in the content layer, and
 * no content in the arithmetic layer.
 *
 * ── Who gets asked ───────────────────────────────────────────────────────
 *
 * One rule, off the regard bands, and it produces the whole texture without a
 * branch on faction, title or importance:
 *
 *   unreachable / overmatched   the house does not send you against this. It
 *                               sends an elder. You are not told about it
 *   stretch / matched / assured you are what they have
 *   beneath / dismissed         it is beneath you, so you are not asked
 *
 * And what you are asked scales with how far up the house's own ladder you
 * stand, taken as a share of its rank array: told where to stand, given a
 * task, or asked what should be done.
 */

import { ENCOUNTERS, type EncounterEntry } from '../../data/cultivation/encounters.js';
import { regardFor, type Regard } from '../cultivation/regard.js';
import type { RegardBand } from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import type { Membership } from './types.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT KIND OF THING IT IS
// ─────────────────────────────────────────────────────────────────────────

export type DutyOrigin = 'summons' | 'commission';

/**
 * How the ask is put, which is a function of standing and nothing else.
 *
 * discovery.md's lesson applied to institutions: the shape of the approach
 * tells you where you stand more reliably than anything anybody says.
 */
export type DutyPosture =
    /** Told where to stand. No question was asked. */
    | 'told'
    /** Given a task and left to do it. */
    | 'assigned'
    /** Asked what should be done about it. */
    | 'consulted';

/**
 * How big the thing is.
 *
 * A caravan being raided and a war are the same mechanic with a number on it,
 * and keeping them one system is what stops the war being a set piece. Scale
 * moves three things and nothing else: how many go with you, how long it
 * takes, and what walking away is written down as.
 */
export type DutyScale =
    /** One road, one village, one nest. Days. */
    | 'local'
    /** A province notices. A beast tide, a contested vein, a secret realm. */
    | 'regional'
    /** The house is at war. Everybody ranked is on the list. */
    | 'total';

/**
 * What being sent gets you that you could not have got.
 *
 * The half of membership that is not danger. A trial ground and a front are
 * places a rogue cannot go and things a rogue cannot be given, and saying so
 * in gameplay rather than in prose is the whole argument for spending a
 * lifetime getting into a house.
 */
export interface DutyAccess {
    /** True when the destination has a gate somebody else is opening. */
    granted: boolean;
    /** Engine-authored, factual. Empty when nothing was granted. */
    note: string;
}

/**
 * Bands in which the house considers you the right answer to a problem.
 *
 * Not a list of good outcomes - a list of the situations somebody at your rung
 * is what an institution would actually spend. Everything else it handles with
 * somebody else, and you never hear about it.
 */
const SUMMONABLE_BANDS: readonly RegardBand[] = ['stretch', 'matched', 'assured'];

export function summonable(band: RegardBand): boolean {
    return SUMMONABLE_BANDS.includes(band);
}

// ─────────────────────────────────────────────────────────────────────────
// READING THE CATALOG
// ─────────────────────────────────────────────────────────────────────────

/**
 * The row describes something an institution would call somebody in for.
 *
 * Every clause reads tags the catalog already has. If a new entry wants to be
 * a summons, it says so by being tagged the way the existing musters are - not
 * by being added to a list here.
 */
export function callsOn(entry: EncounterEntry): boolean {
    const tags = new Set(entry.tags);
    if (tags.has('obligation')) return true;
    if (tags.has('support')) return true;
    if (entry.kind === 'sect_event' && tags.has('war')) return true;
    // Something happening now, that pays, that somebody wants stopped.
    if (tags.has('timed') && (tags.has('reward') || tags.has('tide') || tags.has('regional'))) {
        return true;
    }
    // Ground a house sends a COHORT to. The catalog already says which rows
    // those are - "{count} sects have already sent parties", "{count} sects
    // have mobilised to hold ground over it" - and it says it as competition
    // against a clock. Trade is excluded: a house sends buyers to an auction
    // and that is not a deployment.
    if (tags.has('competition') && !tags.has('trade')) {
        if (tags.has('timed') || entry.kind === 'sect_event') return true;
    }
    return false;
}

/**
 * The row describes work that is on offer rather than work that is coming for
 * you. Disjoint from {@link callsOn} by precedence: a muster is not a job.
 */
export function isCommission(entry: EncounterEntry): boolean {
    if (callsOn(entry)) return false;
    const tags = new Set(entry.tags);
    if (tags.has('quest')) return true;
    // A paid contract with something dangerous at the end of it. The culling
    // notice is the ordinary case and it is deliberately in scope: a house
    // takes those on and hands them down.
    if (tags.has('trade') && entry.threatOrdinal !== null) return true;
    return false;
}

/** Everything the catalog can express as an institution calling on somebody. */
export const SUMMONS_ENTRIES: readonly EncounterEntry[] = ENCOUNTERS.filter(callsOn);

/** Everything the catalog can express as work on a board. */
export const COMMISSION_ENTRIES: readonly EncounterEntry[] = ENCOUNTERS.filter(isCommission);

// ─────────────────────────────────────────────────────────────────────────
// TERMS
// ─────────────────────────────────────────────────────────────────────────

/** Base contribution for a duty pitched at the bottom of the ladder. */
export const CONTRIBUTION_BASE = 8;
/** Added contribution per rung the duty is pitched at. */
export const CONTRIBUTION_PER_ORDINAL = 1.6;

/**
 * How much stone-value the board itself puts on one point of contribution.
 *
 * DERIVED, NOT PICKED, and it falls out of the two lines below in closed form.
 * `dutyTermsFor` prices a commission as
 *
 *     contribution = base * yieldScale * (days / 20)
 *     stones       = base * yieldScale * 1.4
 *
 * so the base, the pitch and the regard all cancel and what is left is
 * `contribution / stones = days / 28`. The house's own exchange rate, stated by
 * the house's own board, with nothing invented.
 *
 * It is a function of DAYS because that is the only term that survives: a long
 * commission pays more contribution for the same money, which is the board
 * saying that service is measured in time given rather than in value delivered.
 *
 * Exported so the donation path can read it rather than hold a second opinion.
 * If the two lines above are retuned this moves with them, which is the whole
 * point of deriving it here instead of writing a number down somewhere else.
 */
export function contributionPerStoneOverDays(days: number): number {
    const span = Number.isFinite(days) && days > 0 ? days : 1;
    return span / (20 * 1.4);
}

export interface DutyTerms {
    origin: DutyOrigin;
    posture: DutyPosture;
    /** The rung the duty is priced against: its threat, or its own pitch. */
    pitchOrdinal: number;
    /** Days it takes, if it is taken. */
    days: number;
    /** Paid into `sect_members.contribution` on completion. Zero outside a house. */
    contribution: number;
    /** Paid in spirit stones on completion. */
    stones: number;
    /** How the ledger records walking away. */
    refusal: RefusalTerms;
    /** Regard against whatever the duty is about. Carried for the caller. */
    regard: Regard;
    /** How big it is. Moves the cohort, the term and the cost of leaving. */
    scale: DutyScale;
    /**
     * How many of the house's own go with them.
     *
     * Peers at their own rung, which is where rivals, debts and witnesses come
     * from: people who were there, saw what was done, and are still about
     * afterwards. Zero for anything nobody else was sent to.
     */
    cohort: number;
    /** What the sending reaches that the person could not reach alone. */
    access: DutyAccess;
}

/**
 * What refusing costs, as a record rather than a number.
 *
 * `grudges.ts` is explicit that severity is a WORD, written once and never
 * recalculated, because how much a refusal is worth relative to a humiliation
 * is a judgement and judgements belong to whoever reads the record. So this
 * carries the vocabulary of that table and no weight at all.
 */
export interface RefusalTerms {
    kind: 'grudge';
    cause: 'broken_oath' | 'other';
    severity: 'slight' | 'serious' | 'grave' | 'unforgivable';
    /** Factual, for the ledger's `description`. Never narration. */
    description: string;
}

/**
 * Price a duty for the person being asked.
 *
 * Pure arithmetic over the entry's own columns and the asker's standing. It
 * decides nothing about whether the duty is offered - {@link summonable} does
 * that - and it never consults which house is asking, because a muster is a
 * muster.
 */
export function dutyTermsFor(
    entry: EncounterEntry,
    ordinal: number,
    membership: Membership | null,
    origin: DutyOrigin
): DutyTerms {
    const pitchOrdinal = clampOrdinal(entry.threatOrdinal ?? entry.minOrdinal);
    const regard = regardFor(pitchOrdinal, ordinal);
    const tags = new Set(entry.tags);

    const scale = scaleFor(tags);
    const days = daysFor(tags, scale);
    const posture = postureFor(membership);

    // What comes back scales with how far the thing is beneath the person
    // doing it, which is `yieldMultiplier` doing the job it exists for. An
    // elder clearing something at their own rung is paid for their time; an
    // elder clearing something ten rungs down is paid for a morning.
    const yieldScale = Math.max(0.25, Math.min(3, regard.yieldMultiplier));
    const base = CONTRIBUTION_BASE + pitchOrdinal * CONTRIBUTION_PER_ORDINAL;

    return {
        origin,
        posture,
        pitchOrdinal,
        days,
        // No house, no ledger to be credited in. A rogue doing the same work
        // for the same people is paid in stones and in nothing else, which is
        // the whole difference membership buys.
        contribution: membership ? Math.max(1, Math.round(base * yieldScale * (days / 20))) : 0,
        stones: Math.max(1, Math.round(base * 1.4 * yieldScale)),
        refusal: refusalFor(entry, tags, membership, origin, scale),
        regard,
        scale,
        cohort: cohortFor(scale, membership),
        access: accessFor(tags, membership)
    };
}

/**
 * How big, off the tags.
 *
 * A war is the top of one scale rather than a different kind of thing, which
 * is what lets the small version the player meets at rung four and the decade
 * that defines their life at rung twenty be the same code.
 */
export function scaleFor(tags: ReadonlySet<string>): DutyScale {
    if (tags.has('war')) return 'total';
    if (tags.has('tide') || tags.has('regional') || tags.has('competition')) return 'regional';
    return 'local';
}

/**
 * Who else was sent.
 *
 * Nobody is sent alone to a war and nobody is sent in company to break up a
 * fight on a road. The number falls with rank because a house spends its
 * bottom rungs in quantity and its top rungs singly, which is also why the
 * bottom rungs are where the survivor stories come from.
 */
function cohortFor(scale: DutyScale, membership: Membership | null): number {
    if (!membership) return 0;
    if (scale === 'local') return 0;
    const top = Math.max(1, membership.rankCount - 1);
    const share = Math.min(1, Math.max(0, membership.rankIndex / top));
    const base = scale === 'total' ? 40 : 12;
    return Math.max(1, Math.round(base * (1 - share * 0.75)));
}

/**
 * Whether the sending opens a door.
 *
 * True where the destination has a gate: a warded ground, a sealed site, a
 * competition with an entry cap, a front. A house walks its people through
 * those, and that is the thing membership buys which no amount of money does.
 */
function accessFor(tags: ReadonlySet<string>, membership: Membership | null): DutyAccess {
    if (!membership) return { granted: false, note: '' };
    const gated = tags.has('competition') || tags.has('sealed') ||
        tags.has('high-risk') || tags.has('war');
    if (!gated) return { granted: false, note: '' };
    return {
        granted: true,
        note: `${membership.factionName} is what gets them through the gate. ` +
            'Nobody arriving on their own account is admitted.'
    };
}

/**
 * How long it takes.
 *
 * Off the tags, because the catalog already says which things are urgent, which
 * are campaigns and which are errands. Fixed rather than rolled: the terms of
 * an offer do not change while you think about it, and a caller that wants
 * variety should vary which row it drew.
 */
function daysFor(tags: ReadonlySet<string>, scale: DutyScale): number {
    // A war is not a long errand. It is the thing that happens instead of the
    // decade the cultivator had planned, and the term says so.
    if (scale === 'total') return 720;
    if (scale === 'regional') return 90;
    if (tags.has('obligation')) return 60;
    if (tags.has('timed')) return 12;
    if (tags.has('quest')) return 30;
    return 20;
}

/**
 * Told, assigned, or asked.
 *
 * A share of the house's own rank array, so a house with four rungs and a
 * house with seven both produce the whole range and neither needs a rule.
 * Outside a house nobody is giving orders, so the ask is always a request.
 */
export function postureFor(membership: Membership | null): DutyPosture {
    if (!membership) return 'assigned';
    const top = Math.max(1, membership.rankCount - 1);
    const share = Math.min(1, Math.max(0, membership.rankIndex / top));
    if (share < 0.34) return 'told';
    if (share < 0.75) return 'assigned';
    return 'consulted';
}

function refusalFor(
    entry: EncounterEntry,
    tags: ReadonlySet<string>,
    membership: Membership | null,
    origin: DutyOrigin,
    scale: DutyScale
): RefusalTerms {
    // Joining a house is the vow. Refusing what it asks is that vow not kept,
    // and the ledger already has the word for it.
    const cause = membership ? 'broken_oath' : 'other';

    // Leaving a war is desertion, and the ledger has a word above grave for
    // exactly this. It is reachable only from a house at war, which is the
    // point: nothing else a member can decline is worth that word.
    const severity = scale === 'total' && membership
        ? 'unforgivable'
        : scale === 'total' || tags.has('tide') || tags.has('obligation')
            ? 'grave'
            : tags.has('support') || tags.has('reward') || entry.threatOrdinal !== null
                ? 'serious'
                : 'slight';

    const what = scale === 'total' && origin === 'summons'
        ? `Recalled over ${entry.name.toLowerCase()} and did not report.`
        : origin === 'summons'
            ? `Called on over ${entry.name.toLowerCase()} and did not come.`
            : `Took ${entry.name.toLowerCase()} off the board and did not finish it.`;

    return {
        kind: 'grudge',
        cause,
        severity,
        description: membership
            ? `${what} The house had counted on it.`
            : `${what} It was not owed to anybody, and it was noticed.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHO IS ASKED, AND WHAT IS ON THE BOARD
// ─────────────────────────────────────────────────────────────────────────

export interface DutyCandidate {
    entry: EncounterEntry;
    terms: DutyTerms;
    /** Catalog weight, unchanged. Board order and draw weight both use it. */
    weight: number;
}

/**
 * Everything the house might call this person in for.
 *
 * Empty is a legitimate and frequent answer: no membership, or nothing at this
 * rung that the house would spend somebody like them on. A caller that gets
 * nothing back should say nothing rather than reach for a fallback.
 */
export function summonsPool(ordinal: number, membership: Membership | null): DutyCandidate[] {
    if (!membership) return [];
    return poolFrom(SUMMONS_ENTRIES, ordinal, membership, 'summons');
}

/**
 * What is on the board, for somebody standing in front of it.
 *
 * Narrowed the same way, for the same reason. An elder is not offered errands,
 * and {@link boardRefusals} is what lets a caller say so rather than show an
 * empty wall.
 */
export function commissionBoard(ordinal: number, membership: Membership | null): DutyCandidate[] {
    return poolFrom(COMMISSION_ENTRIES, ordinal, membership, 'commission');
}

function poolFrom(
    entries: readonly EncounterEntry[],
    ordinal: number,
    membership: Membership | null,
    origin: DutyOrigin
): DutyCandidate[] {
    const out: DutyCandidate[] = [];
    for (const entry of entries) {
        if (ordinal < entry.minOrdinal || ordinal > entry.maxOrdinal) continue;
        const terms = dutyTermsFor(entry, ordinal, membership, origin);
        if (!summonable(terms.regard.band)) continue;
        out.push({ entry, terms, weight: entry.weight });
    }
    out.sort((a, b) => (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
    return out;
}

/**
 * What was on the board and is not being offered to this person, with the
 * reason attached.
 *
 * "An Elder is not offered errands at all and gets told so" - and the telling
 * is `regard.reaction`, which is engine-authored and already says exactly how
 * far beneath somebody a thing is pitched.
 */
export function boardRefusals(
    ordinal: number,
    membership: Membership | null
): { entry: EncounterEntry; regard: Regard }[] {
    const out: { entry: EncounterEntry; regard: Regard }[] = [];
    for (const entry of COMMISSION_ENTRIES) {
        if (ordinal < entry.minOrdinal || ordinal > entry.maxOrdinal) continue;
        const terms = dutyTermsFor(entry, ordinal, membership, 'commission');
        if (summonable(terms.regard.band)) continue;
        out.push({ entry, regard: terms.regard });
    }
    out.sort((a, b) => (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
    return out;
}

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}
