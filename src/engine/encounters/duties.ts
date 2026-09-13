/**
 * Work an institution gives you, and work you go and ask for.
 *
 * The situation stays in the catalog and the TERMS - how long, what it pays,
 * what refusing costs - are computed here from the rung it is pitched at and the
 * standing of whoever is being asked. No arithmetic in the content layer and no
 * content in the arithmetic layer; a parallel table with a payout column bolted
 * on is the mistake AGENTS.md names.
 */

import { ENCOUNTERS, type EncounterEntry } from '../../data/cultivation/encounters.js';
import { regardFor, type Regard } from '../cultivation/regard.js';
import type { RegardBand } from '../../schema/cultivation.js';
import { MAX_ORDINAL, rankName } from '../cultivation/realms.js';
import type { SendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import type { HouseAsItStands } from '../world/who-goes-out-for-a-house-and-what-comes-back.js';
import { whatAHouseHasOnItsBoard } from './what-a-house-has-on-its-board.js';
import type { Membership } from './types.js';

// WHAT KIND OF THING IT IS

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
 */
export interface DutyAccess {
    /** True when the destination has a gate somebody else is opening. */
    granted: boolean;
    /** Engine-authored, factual. Empty when nothing was granted. */
    note: string;
}

/**
 * Bands in which the house considers you the right answer to a problem.
 */
const SUMMONABLE_BANDS: readonly RegardBand[] = ['stretch', 'matched', 'assured'];

export function summonable(band: RegardBand): boolean {
    return SUMMONABLE_BANDS.includes(band);
}

/**
 * Bands where the work is far enough under somebody that nobody would have
 * thought of them for it.
 *
 * `assured` is deliberately not here: four to nine rungs down is a comfortable
 * job, not a job for a junior.
 */
const WELL_BENEATH_BANDS: readonly RegardBand[] = ['beneath', 'dismissed'];

export function wellBeneathYou(band: RegardBand): boolean {
    return WELL_BENEATH_BANDS.includes(band);
}

/**
 * Whether somebody reading a wall may take this line off it.
 *
 * The difference from {@link summonable} is the difference between a wall and a
 * person. `summonable` answers *would the house spend this person on this* -
 * which is the right question when the house is choosing somebody, and the
 * wrong one when the person is choosing off paper. A house does not stop an
 * elder taking down a disciple's notice; it notices.
 *
 * So what is still refused off a wall is only what is pitched ABOVE the reader
 * far enough that handing it over would be the house sending somebody who
 * cannot do it.
 */
export function takeableOffAWall(band: RegardBand): boolean {
    return summonable(band) || wellBeneathYou(band);
}

/**
 * That this duty is pitched well under whoever took it, as a fact and nothing
 * else. Null when it is not.
 *
 * The engine states it; the eyebrow is the narrator's. Anything here that
 * performed the reaction - a clerk's face, a pause at the desk - would be the
 * engine writing the scene, and both halves would then be written twice.
 *
 * Both figures are visible to anybody standing there: a notice says what rung
 * it is pitched at, and a cultivator's rung is the first thing a room reads.
 */
export function pitchedWellBeneath(pitchOrdinal: number, ordinal: number): string | null {
    const regard = regardFor(pitchOrdinal, ordinal);
    if (!wellBeneathYou(regard.band)) return null;
    return `It was posted at ${rankName(clampOrdinal(pitchOrdinal))}, ${regard.gap} rungs under `
        + `${rankName(clampOrdinal(ordinal))}, which is where the person who took it stands.`;
}

// READING THE CATALOG

/**
 * The row describes something an institution would call somebody in for.
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

// TERMS

/** Base contribution for a duty pitched at the bottom of the ladder. */
export const CONTRIBUTION_BASE = 8;
/** Added contribution per rung the duty is pitched at. */
export const CONTRIBUTION_PER_ORDINAL = 1.6;

/**
 * The span an ordinary errand runs to, and the span every duty's contribution
 * is measured against.
 *
 * One number doing both jobs, which is why it is named rather than typed three
 * times: {@link daysFor} returns it for a row carrying no scale tag, and
 * {@link dutyTermsFor} divides by it, so a duty of this length credits exactly
 * its base. It is the unit of work on a board.
 */
export const ORDINARY_DUTY_DAYS = 20;

/**
 * Stones the board pays for one errand's worth of contribution.
 *
 * The other half of {@link ORDINARY_DUTY_DAYS}: on an errand of that length a
 * duty credits `base` contribution and pays `base * this` in stones, so the two
 * constants together ARE the board's exchange rate and nothing else sets it.
 */
export const STONES_PER_ERRAND_OF_CONTRIBUTION = 1.4;

/**
 * How much stone-value the board itself puts on one point of contribution.
 */
export function contributionPerStoneOverDays(days: number): number {
    const span = Number.isFinite(days) && days > 0 ? days : 1;
    return span / (ORDINARY_DUTY_DAYS * STONES_PER_ERRAND_OF_CONTRIBUTION);
}

/**
 * ── AND IT PRICES WORK, NEVER MONEY ──────────────────────────────────────
 *
 * This rate exists so that a duty can be handed to somebody else for stones
 * (`passing-a-duty-down-to-somebody-else.ts`): what the board would have paid
 * for that work, as money. It is not a way in.
 *
 * There is no rate at which spirit stones become contribution, and there must
 * not be one. Contribution is the record of what somebody DID for a house, and
 * a rung is bought with it - so a money-to-contribution rate is cash buying a
 * rung with one step hidden in the middle. Somebody may still pay a house
 * (`donate`); the stones reach the treasury and the ledger of service does not
 * move.
 */

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
     */
    cohort: number;
    /** What the sending reaches that the person could not reach alone. */
    access: DutyAccess;
}

/**
 * What refusing costs, as a record rather than a number. `grudges.ts` is explicit
 * that severity is a WORD, written once and never recalculated, so this carries
 * that table's vocabulary and no weight at all.
 */
export interface RefusalTerms {
    kind: 'grudge';
    cause: 'broken_oath' | 'other';
    severity: 'slight' | 'serious' | 'grave' | 'unforgivable';
    /** Factual, for the ledger's `description`. Never narration. */
    description: string;
}

/**
 * Price a duty for the person being asked. Pure arithmetic over the entry's own
 * columns and the asker's standing. It decides nothing about whether the duty is
 * offered - {@link summonable} does that - and it never consults which house is
 * asking, because a muster is a muster.
 */
export function dutyTermsFor(
    entry: EncounterEntry,
    ordinal: number,
    membership: Membership | null,
    origin: DutyOrigin,
    givenBy?: WhoIsSpeaking | null
): DutyTerms {
    const pitchOrdinal = clampOrdinal(entry.threatOrdinal ?? entry.minOrdinal);
    const regard = regardFor(pitchOrdinal, ordinal);
    const tags = new Set(entry.tags);

    const scale = scaleFor(tags);
    const days = daysFor(tags, scale);
    const posture = postureFor(membership, givenBy);

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
        contribution: membership
            ? Math.max(1, Math.round(base * yieldScale * (days / ORDINARY_DUTY_DAYS)))
            : 0,
        stones: Math.max(1, Math.round(base * STONES_PER_ERRAND_OF_CONTRIBUTION * yieldScale)),
        refusal: refusalFor(entry, tags, membership, origin, scale, givenBy),
        regard,
        scale,
        cohort: cohortFor(scale, membership),
        access: accessFor(tags, membership)
    };
}

/**
 * How big, off the tags.
 */
export function scaleFor(tags: ReadonlySet<string>): DutyScale {
    if (tags.has('war')) return 'total';
    if (tags.has('tide') || tags.has('regional') || tags.has('competition')) return 'regional';
    return 'local';
}

/**
 * Who else was sent.
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
 * How long it takes. Off the tags, because the catalog already says which things
 * are urgent, which are campaigns and which are errands. Fixed rather than
 * rolled: the terms of an offer do not change while you think about it.
 */
function daysFor(tags: ReadonlySet<string>, scale: DutyScale): number {
    // A war is not a long errand. It is the thing that happens instead of the
    // decade the cultivator had planned, and the term says so.
    if (scale === 'total') return 720;
    if (scale === 'regional') return 90;
    if (tags.has('obligation')) return 60;
    if (tags.has('timed')) return 12;
    if (tags.has('quest')) return 30;
    return ORDINARY_DUTY_DAYS;
}

/**
 * Who put the ask, where a person put it rather than a wall.
 *
 * `isHead` is the house's own flag and is not derived from the rung: a house
 * can have somebody at the top rung who is not its head, and the distinction
 * matters here because the head's word is the one that does not get argued
 * with.
 */
export interface WhoIsSpeaking {
    rankIndex: number;
    isHead: boolean;
}

/**
 * Told, assigned, or asked.
 *
 * Read off the GAP between whoever is speaking and whoever is being spoken to,
 * not off where the listener sits on the ladder. A notice nailed to a wall has
 * nobody speaking, and for that case the ladder is the whole answer: the higher
 * you are the more the house is asking rather than telling.
 *
 * The head of the house speaking to you is a different sentence, and the design
 * owner ruled it the other way round - *"once you hit elder the sect isn't
 * going to ask you for stuff, the patriarch just tells you to do things."*
 * There is nobody above the head to consult them on the head's behalf, so the
 * head tells at every rung, including the one just below their own.
 */
export function postureFor(
    membership: Membership | null,
    givenBy?: WhoIsSpeaking | null
): DutyPosture {
    if (!membership) return 'assigned';
    if (givenBy?.isHead) return 'told';
    const top = Math.max(1, membership.rankCount - 1);
    const share = Math.min(1, Math.max(0, membership.rankIndex / top));
    if (share < 0.34) return 'told';
    if (share < 0.75) return 'assigned';
    return 'consulted';
}

/**
 * The ledger's severities, weakest first, so a step up is a step along a list
 * the grudge layer already owns rather than a second scale.
 */
const HOW_BADLY_IT_WAS_NOT_KEPT: readonly RefusalTerms['severity'][] =
    ['slight', 'serious', 'grave', 'unforgivable'];

/**
 * One band heavier, and never as far as desertion.
 *
 * `unforgivable` belongs to walking out of a war and nothing else reaches it,
 * which is what makes it mean anything.
 */
function aBandHeavier(severity: RefusalTerms['severity']): RefusalTerms['severity'] {
    const at = HOW_BADLY_IT_WAS_NOT_KEPT.indexOf(severity);
    // Never downward: something that already reaches desertion stays there.
    const to = Math.max(at, Math.min(at + 1, HOW_BADLY_IT_WAS_NOT_KEPT.length - 2));
    return HOW_BADLY_IT_WAS_NOT_KEPT[to] ?? severity;
}

function refusalFor(
    entry: EncounterEntry,
    tags: ReadonlySet<string>,
    membership: Membership | null,
    origin: DutyOrigin,
    scale: DutyScale,
    givenBy?: WhoIsSpeaking | null
): RefusalTerms {
    // Joining a house is the vow. Refusing what it asks is that vow not kept,
    // and the ledger already has the word for it.
    const cause = membership ? 'broken_oath' : 'other';

    // Leaving a war is desertion, and the ledger has a word above grave for
    // exactly this. It is reachable only from a house at war, which is the
    // point: nothing else a member can decline is worth that word.
    const base: RefusalTerms['severity'] = scale === 'total' && membership
        ? 'unforgivable'
        : scale === 'total' || tags.has('tide') || tags.has('obligation')
            ? 'grave'
            : tags.has('support') || tags.has('reward') || entry.threatOrdinal !== null
                ? 'serious'
                : 'slight';

    // AND AN ORDER YOU CANNOT REFUSE IS WHAT MAKES IT AN ORDER. Refusing what
    // the head of your house told you to do is a different act from declining
    // a notice nobody signed, and the ledger had one word for both. The
    // posture was already computed and was not being read.
    //
    // Only where somebody is on the roll: a house's head has nothing to hold
    // against a stranger who did not do them a favour.
    const anOrder = membership !== null && givenBy?.isHead === true;
    const severity = anOrder ? aBandHeavier(base) : base;

    const what = scale === 'total' && origin === 'summons'
        ? `Recalled over ${entry.name.toLowerCase()} and did not report.`
        : origin === 'summons'
            ? `Called on over ${entry.name.toLowerCase()} and did not come.`
            : `Took ${entry.name.toLowerCase()} off the board and did not finish it.`;

    return {
        kind: 'grudge',
        cause,
        severity,
        description: !membership
            ? `${what} It was not owed to anybody, and it was noticed.`
            : anOrder
                ? `${what} It was an order and not an ask, given by the head of the house, `
                  + 'and everybody who heard it knows which of the two it was.'
                : `${what} The house had counted on it.`
    };
}

// WHO IS ASKED, AND WHAT IS ON THE BOARD

export interface DutyCandidate {
    entry: EncounterEntry;
    terms: DutyTerms;
    /** Catalog weight, unchanged. Board order and draw weight both use it. */
    weight: number;
}

/**
 * Everything the house might call this person in for. Not a list of good
 * outcomes - a list of the situations somebody at your rung is what an
 * institution would actually spend.
 */
export function summonsPool(ordinal: number, membership: Membership | null): DutyCandidate[] {
    if (!membership) return [];
    return poolFrom(SUMMONS_ENTRIES, ordinal, membership, 'summons');
}

/**
 * What this house would send THIS member on, off its own state.
 *
 * MEASURED, before this existed. `summonsPool` filters the eight hand-authored
 * `SUMMONS_ENTRIES` on their ordinal windows alone, and the windows stop: every
 * rung above 33 had nothing, at any rank, and the pool at the bottom rung of a
 * house was identical to the pool at its top. So a house stopped sending for
 * somebody at exactly the rung that made them worth sending.
 *
 * Nothing new is invented to fix it. `whatAHouseHasOnItsBoard` pitches the
 * house's own reasons at whatever rung the reader stands on, which is what
 * makes it impossible to run out of, and `reasonsOpenTo` gates each reason on
 * what is true of the house today. It was wired to the board and to nothing
 * else, so the house could be browsed and could not send for anybody.
 *
 * The board and the sending are therefore the same rows read twice - once as
 * paper somebody walks up to, once as somebody arriving at your door - and the
 * only difference between them is the origin and who is speaking.
 */
export function whatAHouseWouldSendYouOn(input: {
    ordinal: number;
    membership: Membership | null;
    house: HouseAsItStands;
    /** The highest rung the house has anybody standing on. */
    reachOfTheHouse?: number;
    /**
     * The highest rung anybody OTHER than this person stands on, where the
     * caller knows. What it buys is the house's own wall rung, which is where
     * the juniors' work is pitched - and a junior's job is a thing a house puts
     * to a senior, as somebody to send WITH them. See
     * `who-a-senior-is-asked-to-take-out.ts`.
     */
    reachOfTheRest?: number;
    /** Where each reason would send them, when the world knows. */
    placeFor?: (reason: SendingReason) => string | null;
    /** Who put it, where a person did. Decides the posture and nothing else. */
    givenBy?: WhoIsSpeaking | null;
}): DutyCandidate[] {
    if (!input.membership) return [];
    const out: DutyCandidate[] = [];
    for (const entry of whatAHouseHasOnItsBoard({
        house: input.house,
        ordinal: input.ordinal,
        ...(input.reachOfTheHouse === undefined ? {} : { reachOfTheHouse: input.reachOfTheHouse }),
        ...(input.reachOfTheRest === undefined ? {} : { reachOfTheRest: input.reachOfTheRest }),
        ...(input.placeFor === undefined ? {} : { placeFor: input.placeFor })
    })) {
        const terms = dutyTermsFor(
            entry, input.ordinal, input.membership, 'summons', input.givenBy
        );
        // A sending pitched where the person sent cannot survive it is not put
        // to them, which is the gate every other pool goes through.
        //
        // WORK UNDER THEM IS KEPT, AND IS NOT THE SAME ASK. A house does not
        // send an elder to do a disciple's errand; it asks them to go out with
        // the disciples whose errand it is. Whether there ARE any is a fact
        // about the roll and the caller holds the roll, so the caller drops the
        // row where the house has nobody to send.
        if (!summonable(terms.regard.band) && !wellBeneathYou(terms.regard.band)) continue;
        out.push({ entry, terms, weight: entry.weight });
    }
    out.sort((a, b) => (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
    return out;
}

/**
 * What is on the board, for somebody standing in front of it.
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
 * What was on the board and is not being offered to this person, with the reason
 * attached.
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
