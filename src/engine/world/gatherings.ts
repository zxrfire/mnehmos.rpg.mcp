/**
 * The chosen of allied houses meet each other.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import {
    assessPower,
    resolveConfrontation,
    type CombatantInput,
    type ConfrontationResult
} from '../cultivation/combat.js';
import type { Injury } from '../../schema/cultivation.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { isBelowTheLid } from './layers.js';
import { fillConsequences, makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { recordPermanentWounds } from './recording-the-day-a-wound-was-taken.js';
import type { LocationRecord } from './locations.js';
import {
    expectationsFor,
    identifyBuilder,
    siteStanding,
    workWing,
    type RuinWing
} from './provenance.js';
import { expeditionBudget } from './convergence.js';
import {
    addGoal,
    bodyStandingOn,
    carryingWounds,
    maxBodyOf,
    relationshipWith,
    upsertRelationship,
    woundsCarriedBy,
    type NpcRecord,
    type RelationshipKind
} from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';
import { isRuined, ruin } from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE NUMBERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Standing at which two houses count as allied.
 */
export const ALLIED_STANDING = 0.3;

/**
 * How often a circle gathers, in years.
 */
export const GATHERING_YEARS = 15;

/**
 * What hosting costs the house in the chair, per head.
 */
export const HOSTING_COST_PER_HEAD = 400;

/** The most people one gathering seats. Bounds the cost, not the fiction. */
export const MAX_ATTENDEES = 12;

/** Introductions actually resolved at a meeting. */
export const MAX_INTRODUCTIONS = 12;

/** Bouts fought at one gathering. `MAX_EXCHANGES` is the budget inside each. */
export const MAX_BOUTS = 3;

/** People who go into a site together. */
export const MAX_ENTRANTS = 8;

/**
 * The standing a tie has to reach before the world calls it a friendship.
 *
 * The same 0.4 the catalog uses for a feeder edge and `settleNpcDeath` uses as
 * the bar for an account worth inheriting, read from the other end.
 */
export const FRIENDSHIP_STANDING = 0.4;

/**
 * Where an account becomes an account.
 */
export const GRUDGE_STANDING = -0.4;

/**
 * Both sides of a bout are priced on the same normalised MAXIMUM.
 */
const BOUT_BODY = 100;

/**
 * How much a day of showing can swing a placing.
 */
const SHOWING_SPREAD = 0.35;

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export type GatheringKind = 'meeting' | 'challenge' | 'competition' | 'expedition';

/** How an expedition was scored. Null for the other three kinds. */
export type ScoringMode = 'haul' | 'proof';

export interface GatheringPlacing {
    npcId: string;
    name: string;
    factionId: string | null;
    /** 1 is first. Ties are broken deterministically, never left equal. */
    place: number;
    /** The scoring number, for a harness that wants to see the distribution. */
    score: number;
}

/** One tie a gathering actually wrote, for the caller and for measurement. */
export interface GatheringTie {
    fromId: string;
    toId: string;
    kind: RelationshipKind;
    standing: number;
}

export interface Gathering {
    kind: GatheringKind;
    /** The house in the chair. It pays, and it is where this happened. */
    hostFactionId: string;
    /** Every house that sent somebody, host first. */
    factionIds: string[];
    /**
     * Live houses in the host's region that were not invited.
     *
     * Recorded rather than implied, so "who was left out" is a question the
     * record answers instead of one a reader has to reconstruct.
     */
    excludedFactionIds: string[];
    attendeeIds: string[];
    onDay: number;
    locationId: string | null;
    /** Empty for a meeting; ordered, one per entrant, for the other three. */
    placings: GatheringPlacing[];
    /** Only set for an expedition. */
    scoring: ScoringMode | null;
    /** Every relationship row this gathering wrote or moved. */
    ties: GatheringTie[];
    /** Somebody taken up into the host house. The feeder relationship firing. */
    selectedUpwardId: string | null;
    fact: HistoricalFact;
}

/**
 * A set of houses that would send their people to each other.
 */
export interface Circle {
    /** The house in the chair: most allies, then strongest, then by id. */
    host: FactionRecord;
    /** Host included, host first. */
    members: FactionRecord[];
}

// ─────────────────────────────────────────────────────────────────────────
// WHO IS ALLIED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Houses this one would sit down with.
 */
export function alliesOf(state: WorldState, faction: FactionRecord): FactionRecord[] {
    const out: FactionRecord[] = [];
    for (const other of state.factions) {
        if (other.id === faction.id) continue;
        if (other.dissolvedOnDay !== null || !isBelowTheLid(other)) continue;
        const forward = faction.standing[other.id] ?? 0;
        const back = other.standing[faction.id] ?? 0;
        if (forward <= -ALLIED_STANDING || back <= -ALLIED_STANDING) continue;
        if (forward >= ALLIED_STANDING || back >= ALLIED_STANDING) out.push(other);
    }
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Houses this one would sit down with because they share a province.
 */
export function neighboursOf(state: WorldState, faction: FactionRecord): FactionRecord[] {
    const home = regionOf(state, faction.seatLocationId);
    if (home === null) return [];
    const out: FactionRecord[] = [];
    for (const other of state.factions) {
        if (other.id === faction.id) continue;
        if (other.dissolvedOnDay !== null || !isBelowTheLid(other)) continue;
        if (regionOf(state, other.seatLocationId) !== home) continue;
        const forward = faction.standing[other.id] ?? 0;
        const back = other.standing[faction.id] ?? 0;
        if (forward <= -ALLIED_STANDING || back <= -ALLIED_STANDING) continue;
        out.push(other);
    }
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Everybody a house would sit down with: its allies and its neighbours. */
export function circleCandidatesFor(state: WorldState, faction: FactionRecord): FactionRecord[] {
    const seen = new Map<string, FactionRecord>();
    for (const f of alliesOf(state, faction)) seen.set(f.id, f);
    for (const f of neighboursOf(state, faction)) seen.set(f.id, f);
    return [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Every circle the world currently contains, one per group.
 */
export function circlesOf(state: WorldState): Circle[] {
    const live = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f));
    const allies = new Map<string, FactionRecord[]>();
    // Allies AND provincial neighbours. See `neighboursOf` for why the alliance
    // graph alone leaves one circle in the world by the middle of a long run.
    for (const f of live) allies.set(f.id, circleCandidatesFor(state, f));

    const seats: Circle[] = [];
    for (const f of live) {
        const mine = allies.get(f.id) ?? [];
        if (mine.length === 0) continue;
        const rank = (x: FactionRecord): [number, number, string] =>
            [(allies.get(x.id) ?? []).length, Number(x.resources.power_ordinal ?? 0), x.id];
        const [myAllies, myPower, myId] = rank(f);
        let bestIsMe = true;
        for (const other of mine) {
            const [n, p, id] = rank(other);
            if (n > myAllies || (n === myAllies && p > myPower)
                || (n === myAllies && p === myPower && id < myId)) {
                bestIsMe = false;
                break;
            }
        }
        if (bestIsMe) seats.push({ host: f, members: [f, ...mine] });
    }
    return seats;
}

/**
 * Who a house would actually send.
 */
export function chosenOf(state: WorldState, factionId: string): NpcRecord[] {
    return state.npcs
        .filter(n => n.status === 'alive' && isBelowTheLid(n)
            && n.factionId === factionId && n.tags.includes('chosen'))
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
            || (a.id < b.id ? -1 : 1));
}

// ─────────────────────────────────────────────────────────────────────────
// THE YEARLY PASS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Hold whatever gatherings this year holds.
 */
export function applyGatherings(state: WorldState, year: number, day: number): Gathering[] {
    const out: Gathering[] = [];
    for (const circle of circlesOf(state)) {
        const rng = forStream(state.seed, 'gathering', year, circle.host.id);
        if (!rng.chance(1 / GATHERING_YEARS)) continue;
        const held = holdGathering(state, circle, day, rng);
        if (held) out.push(held);
    }
    return out;
}

/**
 * Run one gathering, or decline.
 */
export function holdGathering(
    state: WorldState,
    circle: Circle,
    day: number,
    rng: CultivationRNG
): Gathering | null {
    const sending: { faction: FactionRecord; people: NpcRecord[] }[] = [];
    for (const faction of circle.members) {
        const people = chosenOf(state, faction.id);
        if (people.length > 0) sending.push({ faction, people });
    }
    // A gathering of one house is that house's morning. Two is the minimum for
    // anybody to meet anybody, and it is the whole point of the event.
    if (sending.length < 2) return null;

    // Round-robin across the houses rather than taking the strongest twelve, so
    // a large house does not fill the hall and a house that sent one person is
    // still represented. Exclusion in this module is about who was invited, and
    // it should never happen by accident to somebody who came.
    const attendees: NpcRecord[] = [];
    for (let depth = 0; attendees.length < MAX_ATTENDEES; depth++) {
        let added = false;
        for (const s of sending) {
            if (attendees.length >= MAX_ATTENDEES) break;
            const person = s.people[depth];
            if (!person) continue;
            attendees.push(person);
            added = true;
        }
        if (!added) break;
    }
    if (attendees.length < 2) return null;

    const bill = attendees.length * HOSTING_COST_PER_HEAD;
    const purse = Number(circle.host.resources.spirit_stones ?? 0);
    if (purse < bill) return null;
    circle.host.resources.spirit_stones = purse - bill;

    const kind = drawKind(state, circle, attendees, rng);
    const site = kind === 'expedition' ? reachableSite(state, circle, rng) : null;
    const locationId = site?.id ?? circle.host.seatLocationId;

    const ties: GatheringTie[] = [];
    const placings: GatheringPlacing[] = [];
    let scoring: ScoringMode | null = null;
    let selectedUpwardId: string | null = null;
    let summary = '';
    const changes: string[] = [];

    // The fact id has to exist before the ties do, because every row this
    // writes carries it and "which relationships originate at a gathering" has
    // to be answerable from the relationship alone two centuries later. So the
    // fact is appended first with a provisional summary and its narrative
    // fields are filled in afterwards, in place, on the stored record.
    const fact = appendWorldFact(state, makeFact({
        day,
        kind: 'gathering',
        scale: 'regional',
        actors: attendees.map(n => ({ id: n.id, name: n.name, role: 'attended' })),
        witnessIds: attendees.map(n => n.id),
        locationId,
        factionIds: sending.map(s => s.faction.id),
        visibility: 'public',
        magnitude: kind === 'meeting' ? 0.3 : 0.55,
        summary: `${circle.host.name} received the chosen of ${sending.length - 1} allied houses.`,
        data: {
            gathering: kind,
            unattributed:
                'There are unfamiliar colours on the road up to the compound, and the '
                + 'inns have put their prices up.'
        }
    }));

    switch (kind) {
        case 'meeting':
            summary = runMeeting(state, attendees, day, fact.id, rng, ties);
            break;
        case 'challenge':
            summary = runChallenge(state, attendees, day, fact.id, rng, ties, placings);
            break;
        case 'competition': {
            const result = runCompetition(state, circle, attendees, day, fact.id, rng, ties, placings);
            summary = result.summary;
            selectedUpwardId = result.selectedUpwardId;
            break;
        }
        case 'expedition': {
            if (!site) return null;
            const result = runExpedition(state, attendees, site, day, fact.id, rng, ties, placings);
            summary = result.summary;
            scoring = result.scoring;
            break;
        }
    }

    for (const tie of ties) {
        changes.push(`${tie.fromId} -> ${tie.toId}: ${tie.kind} at ${tie.standing.toFixed(2)}`);
    }

    const excluded = uninvitedNear(state, circle);
    const stored = state.history.facts.find(f => f.id === fact.id);
    if (stored) {
        stored.summary = summary;
        stored.data = {
            ...stored.data,
            scoring,
            // Scalars only: `data` is a flat bag by contract, so lists are
            // joined rather than nested. Both are read back by the harness.
            excludedFactionIds: excluded.map(f => f.id).join(','),
            placings: placings
                .map(p => `${p.place}. ${p.name} (${p.factionId ?? 'unbacked'})`)
                .join(' | '),
            selectedUpwardId
        };
        stored.consequences = fillConsequences({
            immediate: summary,
            beneficiaries: placings.filter(p => p.place === 1)
                .map(p => ({ id: p.npcId, name: p.name, role: 'first' })),
            losers: placings.filter(p => p.place === placings.length && placings.length > 1)
                .map(p => ({ id: p.npcId, name: p.name, role: 'last' })),
            relationshipChanges: ties.map(t => ({
                aId: t.fromId, bId: t.toId,
                change: `${t.kind}, standing ${t.standing.toFixed(2)}`
            })),
            factionReactions: excluded.map(f => ({
                factionId: f.id,
                reaction: 'Was not asked, and its people were not in the room.'
            })),
            tenYearsLater: ties.length > 0
                ? 'The people who were in that room still know each other.'
                : 'Nobody who was there can say anything came of it.'
        });
    }

    // And the houses move, a notch, because their juniors did. This is the only
    // thing in the world that CREATES a positive standing edge: everything else
    // in `pressure.ts` is erosive, so without it the alliance graph can only
    // ever shrink. Bounded hard at the alliance line plus a margin, so a circle
    // that gathers every fifteen years for five centuries does not saturate
    // into an unbreakable bloc.
    settleHouseStanding(state, circle, ties);

    return {
        kind,
        hostFactionId: circle.host.id,
        factionIds: sending.map(s => s.faction.id),
        excludedFactionIds: excluded.map(f => f.id),
        attendeeIds: attendees.map(n => n.id),
        onDay: day,
        locationId,
        placings,
        scoring,
        ties,
        selectedUpwardId,
        fact: stored ?? fact as HistoricalFact
    };
}

/**
 * Which of the four this circle can actually hold.
 */
function drawKind(
    state: WorldState,
    circle: Circle,
    attendees: readonly NpcRecord[],
    rng: CultivationRNG
): GatheringKind {
    const table: { kind: GatheringKind; weight: number }[] = [{ kind: 'meeting', weight: 5 }];
    if (attendees.length >= 2) table.push({ kind: 'challenge', weight: 3 });
    // A ranking needs a FIELD, and three is the smallest number that produces
    // one - a first, a last, and somebody in the middle who is neither. Set at
    // four it never fired at all across fifteen centuries of soak, because a
    // circle is usually two houses and `chosenCount` gives a house one or two
    // favourites; the threshold was measuring the size of the world rather than
    // whether a competition was possible in it.
    const houses = new Set(attendees.map(n => n.factionId));
    if (attendees.length >= 3 && houses.size >= 2) table.push({ kind: 'competition', weight: 3 });
    if (reachableSite(state, circle) !== null) table.push({ kind: 'expedition', weight: 2 });

    const total = table.reduce((sum, t) => sum + t.weight, 0);
    let cursor = rng.next() * total;
    for (const t of table) {
        cursor -= t.weight;
        if (cursor < 0) return t.kind;
    }
    return 'meeting';
}

/**
 * Live houses standing near the host that were not asked.
 */
function uninvitedNear(state: WorldState, circle: Circle): FactionRecord[] {
    const home = regionOf(state, circle.host.seatLocationId);
    if (home === null) return [];
    const inside = new Set(circle.members.map(f => f.id));
    return state.factions.filter(f =>
        f.dissolvedOnDay === null && isBelowTheLid(f) && !inside.has(f.id) &&
        f.seatLocationId !== null && regionOf(state, f.seatLocationId) === home
    ).sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The region a location sits in, or itself when it is one. Cycle-guarded. */
function regionOf(state: WorldState, locationId: string | null): string | null {
    let cursor = locationId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const location = state.locations.find(l => l.id === cursor);
        if (!location) return null;
        if (location.kind === 'region' || location.parentId === null) return location.id;
        cursor = location.parentId;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. A MEETING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Introductions, and what they leave behind.
 */
function runMeeting(
    state: WorldState,
    attendees: readonly NpcRecord[],
    day: number,
    factId: string,
    rng: CultivationRNG,
    ties: GatheringTie[]
): string {
    const pairs = crossHousePairs(attendees).slice(0, MAX_INTRODUCTIONS);
    let friendships = 0;
    let quarrels = 0;

    for (const [a, b] of pairs) {
        const forward = impression(state, a, b, rng);
        const back = impression(state, b, a, rng);
        write(state, a, b, forward, 'Met at a gathering.', factId, day, ties);
        write(state, b, a, back, 'Met at a gathering.', factId, day, ties);
        if (forward >= FRIENDSHIP_STANDING || back >= FRIENDSHIP_STANDING) friendships++;
        if (forward <= GRUDGE_STANDING || back <= GRUDGE_STANDING) quarrels++;
    }

    return `${attendees.length} chosen of allied houses were introduced. `
        + `${pairs.length} pairs met; ${friendships} of them came away friends and `
        + `${quarrels} came away with something to settle.`;
}

/**
 * What one person came away thinking of another.
 */
function impression(state: WorldState, from: NpcRecord, to: NpcRecord, rng: CultivationRNG): number {
    const existing = relationshipWith(from, to.id);
    let value = existing?.standing ?? 0;

    // Their houses' own view, halved, because a junior inherits a position
    // without having earned it and can revise it in an afternoon.
    const mine = state.factions.find(f => f.id === from.factionId);
    const theirs = to.factionId;
    if (mine && theirs) value += (mine.standing[theirs] ?? 0) * 0.5;

    // Being within reach of each other. `HELPLESS_REALM_GAP` is two realms and
    // the combat layer's own statement of when a difference stops being a
    // contest; below that people are peers and it matters what they think of
    // each other, above it they are barely in the same conversation.
    const gap = Math.abs(from.cultivation.realmOrdinal - to.cultivation.realmOrdinal);
    const peers = gap <= 8;

    value += (rng.next() - 0.5) * (peers ? 0.9 : 0.4);
    return Math.max(-1, Math.min(1, value));
}

// ─────────────────────────────────────────────────────────────────────────
// 2. A FRIENDLY CHALLENGE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Two people test each other and nobody is meant to be hurt.
 */
function runChallenge(
    state: WorldState,
    attendees: readonly NpcRecord[],
    day: number,
    factId: string,
    rng: CultivationRNG,
    ties: GatheringTie[],
    placings: GatheringPlacing[]
): string {
    // Drawn rather than taken off the top of the list, so the same two people
    // are not the ones who stand up at every gathering for a century.
    const all = crossHousePairs(attendees);
    if (all.length === 0) return 'Nobody would stand up.';
    const pairs: [NpcRecord, NpcRecord][] = [];
    const used = new Set<number>();
    for (let n = 0; n < MAX_BOUTS && used.size < all.length; n++) {
        let at = rng.int(0, all.length - 1);
        while (used.has(at)) at = (at + 1) % all.length;
        used.add(at);
        pairs.push(all[at]);
    }

    const lines: string[] = [];
    let hurt = 0;
    let outclassed = 0;

    for (let i = 0; i < pairs.length; i++) {
        const [a, b] = pairs[i];
        const result = resolveConfrontation(
            combatantOf(a, state),
            combatantOf(b, state),
            {
                rng: forStream(state.seed, 'gathering-bout', factId, i),
                ambient: 'normal',
                turn: 1,
                intent: { goal: 'subdue', willWithdraw: true }
            }
        );

        const winner = result.winnerId === a.id ? a : result.winnerId === b.id ? b : null;
        const loser = result.loserId === a.id ? a : result.loserId === b.id ? b : null;

        if (result.outcome === 'no_contest') {
            // The interesting half of this whole kind. Somebody just measured
            // themselves against a peer and the answer was categorical.
            const behind = a.cultivation.realmOrdinal <= b.cultivation.realmOrdinal ? a : b;
            const ahead = behind === a ? b : a;
            openAmbition(state, behind, ahead, day);
            write(state, behind, ahead, -0.2, `Could not touch them at a friendly bout.`,
                factId, day, ties);
            write(state, ahead, behind, 0.1, 'Stood up to them and should not have.',
                factId, day, ties);
            outclassed++;
            lines.push(`${behind.name} could not reach ${ahead.name} at all`);
            continue;
        }

        // What the bout did to a body. The resolver already returns wound ROWS,
        // and this used to count them and throw them away - so a crippling
        // wound and a scratch both arrived on the record as "+1".
        for (const person of [a, b]) {
            applyWounds(state, person, result.injuries[person.id] ?? [], day);
        }

        // And what it did to what they were holding. A bout is a real swing:
        // somebody who stood up against a peer a realm and a half above them
        // with a blade that could not take it goes home without the blade, and
        // the house's shelf is one row poorer in a way somebody can look up.
        lines.push(...applyBoutBreakages(state, result.brokenObjects, day));

        if (winner && loser) {
            const ugly = result.outcome === 'crippled' || result.outcome === 'humiliation'
                || (result.injuries[loser.id] ?? []).some(w => w.severity === 'crippling');
            if (ugly) {
                hurt++;
                write(state, loser, winner,
                    GRUDGE_STANDING - 0.15,
                    `A friendly bout that was not. ${result.outcome}.`, factId, day, ties);
                write(state, winner, loser, -0.1,
                    'Went further than was meant and knows it.', factId, day, ties);
                lines.push(`${winner.name} ${result.outcome === 'crippled' ? 'crippled' : 'humiliated'} ${loser.name}`);
            } else {
                // The ordinary result: both of them think better of the other
                // afterwards, and one of them is going to remember the score.
                write(state, loser, winner, -0.15, 'Lost to them in front of people.',
                    factId, day, ties);
                write(state, winner, loser, 0.25, 'Worth standing up with.', factId, day, ties);
                lines.push(`${winner.name} took the bout from ${loser.name}`);
            }
            placings.push(place(winner, placings.length + 1, result.aggressor.total));
            placings.push(place(loser, placings.length + 1, result.defender.total));
        } else {
            // A stalemate is not a loss. Both of them come away with a rival
            // and neither of them with an account.
            write(state, a, b, 0.2, 'Neither could finish it.', factId, day, ties);
            write(state, b, a, 0.2, 'Neither could finish it.', factId, day, ties);
            lines.push(`${a.name} and ${b.name} could not settle it`);
        }
    }

    return `Friendly bouts: ${lines.join('; ')}.`
        + (hurt > 0 ? ` ${hurt} went further than anyone intended.` : '')
        + (outclassed > 0 ? ` ${outclassed} found out how far behind they are.` : '');
}

/**
 * Somebody decides they are not going to be this far behind for ever.
 */
function openAmbition(state: WorldState, behind: NpcRecord, ahead: NpcRecord, day: number): void {
    const at = state.npcs.findIndex(n => n.id === behind.id);
    if (at < 0) return;
    if (state.npcs[at].goals.some(g => g.targetId === ahead.id && g.status === 'active')) return;
    state.npcs[at] = addGoal(state.npcs[at], {
        kind: 'status',
        text: `Stand up to ${ahead.name} and not be laughed at.`,
        priority: 0.65,
        targetId: ahead.id,
        obstacles: [`${ahead.name} is ${ahead.cultivation.realmOrdinal - behind.cultivation.realmOrdinal} rungs above.`],
        note: 'Measured at a friendly bout and found not to be a contest.'
    }, day);
}

/** Put the rows the resolver produced onto the record, as rows. */
function applyWounds(
    state: WorldState,
    npc: NpcRecord,
    wounds: readonly Injury[],
    day: number
): void {
    if (wounds.length === 0) return;
    const at = state.npcs.findIndex(n => n.id === npc.id);
    if (at < 0) return;
    state.npcs[at] = carryingWounds(state.npcs[at], wounds, day);
    // A maiming taken at a gathering is a day in a life. Only the permanent
    // band - everything that heals stays a field on the record, where the count
    // already lives. See `recording-the-day-a-wound-was-taken.ts`.
    recordPermanentWounds(state, state.npcs[at], wounds, day);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. A MARTIAL COMPETITION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ranked, public, with standing on the line.
 */
function runCompetition(
    state: WorldState,
    circle: Circle,
    attendees: readonly NpcRecord[],
    day: number,
    factId: string,
    rng: CultivationRNG,
    ties: GatheringTie[],
    placings: GatheringPlacing[]
): { summary: string; selectedUpwardId: string | null } {
    const scored = attendees.map(npc => {
        const power = assessPower(combatantOf(npc, state), { ambient: 'normal' }).total;
        const showing = 1 + (rng.next() - 0.5) * 2 * SHOWING_SPREAD;
        return { npc, score: power * showing };
    }).sort((a, b) => b.score - a.score || (a.npc.id < b.npc.id ? -1 : 1));

    for (let i = 0; i < scored.length; i++) {
        placings.push(place(scored[i].npc, i + 1, scored[i].score));
    }

    // Prestige, which is what the placing was for. Positive at the top of the
    // board, negative at the bottom, and the size of it scales with the field -
    // coming last in a field of twelve says more than coming last in four.
    for (const p of placings) {
        if (!p.factionId) continue;
        const faction = state.factions.find(f => f.id === p.factionId);
        if (!faction) continue;
        const share = placings.length <= 1 ? 0 : 1 - 2 * ((p.place - 1) / (placings.length - 1));
        faction.resources.prestige = Number(faction.resources.prestige ?? 0) + share;
    }

    // Everybody who was ranked against everybody they were ranked against. The
    // person immediately above you is the one you remember.
    for (let i = 1; i < scored.length && i < MAX_INTRODUCTIONS; i++) {
        const below = scored[i].npc;
        const above = scored[i - 1].npc;
        if (below.factionId === above.factionId) continue;
        write(state, below, above, -0.2, `Placed ${i + 1} behind them.`, factId, day, ties);
        write(state, above, below, 0.1, 'Came up right behind and will again.', factId, day, ties);
    }

    // And the winner goes up, if there is anywhere above them to go.
    let selectedUpwardId: string | null = null;
    const champion = scored[0]?.npc ?? null;
    if (champion && champion.factionId !== null && champion.factionId !== circle.host.id) {
        const home = state.factions.find(f => f.id === champion.factionId);
        const answersTo = (home?.standing[circle.host.id] ?? 0) >= ALLIED_STANDING;
        const higher = Number(circle.host.resources.power_ordinal ?? 0)
            > Number(home?.resources.power_ordinal ?? 0);
        if (home && answersTo && higher) {
            const at = state.npcs.findIndex(n => n.id === champion.id);
            if (at >= 0) {
                state.npcs[at] = {
                    ...state.npcs[at],
                    factionId: circle.host.id,
                    // At the bottom, and it is supposed to feel like a demotion.
                    factionRankIndex: 0,
                    tags: state.npcs[at].tags.filter(t => t !== 'chosen'),
                    updatedOnDay: day
                };
                selectedUpwardId = champion.id;
            }
        }
    }

    const board = placings.slice(0, 3).map(p => `${p.place}. ${p.name}`).join(', ');
    return {
        summary: `${circle.host.name} ranked ${placings.length} chosen of `
            + `${new Set(attendees.map(n => n.factionId)).size} houses. ${board}.`
            + (selectedUpwardId
                ? ` ${champion?.name} was taken into the ${circle.host.name} at its lowest rank.`
                : ''),
        selectedUpwardId
    };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. A RUIN EXPEDITION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Several houses' chosen go into a hole together and are scored.
 */
function runExpedition(
    state: WorldState,
    attendees: readonly NpcRecord[],
    site: LocationRecord,
    day: number,
    factId: string,
    rng: CultivationRNG,
    ties: GatheringTie[],
    placings: GatheringPlacing[]
): { summary: string; scoring: ScoringMode } {
    const entrants = attendees.slice(0, MAX_ENTRANTS);
    const standing = siteStanding(site);
    const canProve = identifyBuilder(site, { id: 'anybody', realmOrdinal: 46 }).builderName !== null;
    const canHaul = standing.wings.length >= 3;

    const scoring: ScoringMode = canProve && (!canHaul || rng.chance(0.5)) ? 'proof' : 'haul';
    const result = scoring === 'proof'
        ? raceForTheProof(state, entrants, site, day, rng)
        : contestTheHaul(state, entrants, site, day, rng);

    for (let i = 0; i < result.ranked.length; i++) {
        placings.push(place(result.ranked[i].npc, i + 1, result.ranked[i].score));
    }

    // What happened inside is what the ties are made of. Somebody who came out
    // with nothing and stood next to somebody who came out with everything has
    // an opinion about it; two people who worked the same hall and both came
    // out have a different one.
    for (let i = 1; i < result.ranked.length; i++) {
        const behind = result.ranked[i];
        const ahead = result.ranked[i - 1];
        if (behind.npc.factionId === ahead.npc.factionId) continue;
        if (behind.score === 0 && ahead.score > 0) {
            write(state, behind.npc, ahead.npc, GRUDGE_STANDING,
                `Came out of ${site.name} with nothing while they did not.`, factId, day, ties);
            write(state, ahead.npc, behind.npc, 0.05, 'Was slower.', factId, day, ties);
        } else {
            write(state, behind.npc, ahead.npc, 0.3,
                `Went into ${site.name} together.`, factId, day, ties);
            write(state, ahead.npc, behind.npc, 0.3,
                `Went into ${site.name} together.`, factId, day, ties);
        }
    }

    return { summary: result.summary, scoring };
}

interface Scored { npc: NpcRecord; score: number }

/**
 * HAUL: who brings the most out.
 */
function contestTheHaul(
    state: WorldState,
    entrants: readonly NpcRecord[],
    site: LocationRecord,
    day: number,
    rng: CultivationRNG
): { ranked: Scored[]; summary: string } {
    const taken = new Set<string>();
    const scores: Scored[] = [];
    let current = site;
    let worked = 0;

    // Strongest first, because they get first pick of the deep rooms, which is
    // both the advantage of being strong and the reason a party spreads.
    const order = [...entrants].sort((a, b) =>
        b.cultivation.realmOrdinal - a.cultivation.realmOrdinal || (a.id < b.id ? -1 : 1));

    for (const npc of order) {
        const budget = expeditionBudget(current, day, { realmOrdinal: npc.cultivation.realmOrdinal });
        const reachable = budget.wings
            .filter(w => w.reachable && !taken.has(w.wing.id) && !w.wing.sealed)
            .sort((a, b) => b.depthDays - a.depthDays);
        const target = reachable[0];
        if (!target) {
            scores.push({ npc, score: 0 });
            continue;
        }
        taken.add(target.wing.id);
        const change = workWing(current, {
            wingId: target.wing.id,
            onDay: day,
            byName: npc.name
        });
        if (!change) {
            scores.push({ npc, score: 0 });
            continue;
        }
        current = change.location;
        worked++;
        // What was actually left in it. A hall three parties have already been
        // through pays a fraction of one nobody has opened, which is
        // `REMAINING_SHARE` doing the work rather than a number chosen here.
        const before = target.wing.state;
        const share = before === 'untouched' ? 1 : before === 'probed' ? 0.5
            : before === 'picked_over' ? 0.2 : 0.05;
        scores.push({ npc, score: target.depthDays * share * (0.8 + rng.next() * 0.4) });
    }

    replaceLocation(state, current);
    const ranked = scores.sort((a, b) => b.score - a.score || (a.npc.id < b.npc.id ? -1 : 1));
    const empty = ranked.filter(s => s.score === 0).length;
    return {
        ranked,
        summary: `${entrants.length} chosen went into ${site.name} on a haul, and `
            + `${worked} halls were worked. ${ranked[0]?.npc.name ?? 'nobody'} brought out the most; `
            + `${empty} came out with nothing.`
    };
}

/**
 * PROOF: who reaches a named room first.
 */
function raceForTheProof(
    state: WorldState,
    entrants: readonly NpcRecord[],
    site: LocationRecord,
    day: number,
    rng: CultivationRNG
): { ranked: Scored[]; summary: string } {
    const wings = siteStanding(site).wings;
    const pointed = expectationsFor(site).map(e => e.wingId).filter((id): id is string => id !== null);
    const targetId = pointed[0] ?? wings[wings.length - 1]?.id ?? null;
    const target = wings.find(w => w.id === targetId) ?? null;
    if (!target) {
        return {
            ranked: entrants.map(npc => ({ npc, score: 0 })),
            summary: `${site.name} had nothing in it worth racing for.`
        };
    }

    const runs = entrants.map(npc => {
        const actor = {
            id: npc.id,
            realmOrdinal: npc.cultivation.realmOrdinal,
            attributes: npc.cultivation.attributes,
            knowledgeIds: npc.cultivation.techniqueIds
        };
        const reading = identifyBuilder(site, actor);
        const budget = expeditionBudget(site, day, { realmOrdinal: npc.cultivation.realmOrdinal });
        // The cost of not knowing: every room shallower than the target, walked
        // and left again, before the right door.
        const wrongTurns = reading.placed
            ? 0
            : wings.filter(w => w.depthDays < target.depthDays).reduce((sum, w) => sum + w.depthDays, 0);
        const days = target.depthDays + wrongTurns + rng.next();
        const reachable = Number.isFinite(budget.safeDepth)
            ? days <= budget.safeDepth : true;
        return { npc, days, reachable, read: reading.placed };
    }).sort((a, b) => {
        if (a.reachable !== b.reachable) return a.reachable ? -1 : 1;
        return a.days - b.days || (a.npc.id < b.npc.id ? -1 : 1);
    });

    // Exactly one person gets there first, and the value of getting there
    // second is nothing. That is what makes this a race rather than a haul.
    const winner = runs.find(r => r.reachable) ?? null;
    const ranked: Scored[] = runs.map(r => ({
        npc: r.npc,
        score: winner && r.npc.id === winner.npc.id ? 1 : 0
    }));

    if (winner) {
        const change = workWing(site, {
            wingId: target.id,
            onDay: day,
            byName: winner.npc.name,
            unsealed: target.sealed
        });
        if (change) replaceLocation(state, change.location);
    }

    const readers = runs.filter(r => r.read).length;
    return {
        ranked,
        summary: winner
            ? `${entrants.length} chosen raced for ${target.name} of ${site.name}. `
                + `${readers} could read the place; ${winner.npc.name} got there first, `
                + `in ${Math.round(winner.days)} days.`
            : `${entrants.length} chosen raced for ${target.name} of ${site.name} and `
                + `none of them could reach it before the way out shut.`
    };
}

/**
 * A site this circle could actually go into.
 */
function reachableSite(
    state: WorldState,
    circle: Circle,
    rng?: CultivationRNG
): LocationRecord | null {
    const home = regionOf(state, circle.host.seatLocationId);
    // Somebody in the circle has to be able to stand in it. `entry` and
    // `survival` are the location layer's own bars and are not restated here.
    const reach = Math.max(0, ...circle.members.map(f => Number(f.resources.power_ordinal ?? 0)));
    const open = state.locations.filter(l =>
        (l.kind === 'ruin' || l.kind === 'grave' || l.kind === 'secret_realm') &&
        isBelowTheLid(l) && l.discovered && !l.sealed &&
        (home === null || regionOf(state, l.id) === home || l.parentId === null) &&
        reach >= l.thresholds.survival &&
        siteStanding(l).unopened.some(w => !w.sealed)
    );
    if (open.length === 0) return null;
    // DRAWN, not taken off the top. Taking the first match sent every circle to
    // the same hole for five centuries, and because the scoring mode is a
    // property of the SITE - only a place with a nameable builder can be raced
    // for a proof - one anonymous ruin at the head of the list meant the proof
    // mode fired once in thirty-five expeditions. That read as a broken mode
    // and was a broken selection.
    return rng ? open[rng.int(0, open.length - 1)] : open[0];
}

function replaceLocation(state: WorldState, next: LocationRecord): void {
    const at = state.locations.findIndex(l => l.id === next.id);
    if (at >= 0) state.locations[at] = next;
}

// ─────────────────────────────────────────────────────────────────────────
// WRITING IT DOWN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Move one person's account of another, and stamp the gathering on it.
 */
function write(
    state: WorldState,
    from: NpcRecord,
    to: NpcRecord,
    delta: number,
    note: string,
    factId: string,
    day: number,
    ties: GatheringTie[]
): void {
    const at = state.npcs.findIndex(n => n.id === from.id);
    if (at < 0) return;
    const holder = state.npcs[at];
    const prev = relationshipWith(holder, to.id);
    const standing = Math.max(-1, Math.min(1, (prev?.standing ?? 0) + delta));
    const kind = prev && STRUCTURAL.has(prev.kind) ? prev.kind : kindFor(standing);

    state.npcs[at] = upsertRelationship(holder, {
        targetId: to.id,
        targetName: to.name,
        kind,
        standing,
        note: prev ? prev.note : note,
        factIds: [factId],
        inheritedFromId: prev?.inheritedFromId ?? null
    }, day);
    ties.push({ fromId: from.id, toId: to.id, kind, standing });
}

/**
 * Kinds that describe a structure rather than a temperature.
 *
 * Somebody's master is still their master after a bad afternoon, and a bout
 * does not turn a sibling into an acquaintance.
 */
const STRUCTURAL: ReadonlySet<RelationshipKind> = new Set<RelationshipKind>([
    'kin', 'spouse', 'parent', 'child', 'master', 'disciple', 'patron', 'client'
]);

/** The word for a number. The thresholds are the ones the rest of the engine uses. */
function kindFor(standing: number): RelationshipKind {
    if (standing <= GRUDGE_STANDING) return 'enemy';
    if (standing <= -0.15) return 'rival';
    if (standing >= FRIENDSHIP_STANDING) return 'ally';
    return 'acquaintance';
}

/**
 * Two houses' standing moves because their juniors' did.
 */
function settleHouseStanding(state: WorldState, circle: Circle, ties: readonly GatheringTie[]): void {
    const byPair = new Map<string, number>();
    for (const tie of ties) {
        const from = state.npcs.find(n => n.id === tie.fromId)?.factionId ?? null;
        const to = state.npcs.find(n => n.id === tie.toId)?.factionId ?? null;
        if (!from || !to || from === to) continue;
        const key = from < to ? `${from}|${to}` : `${to}|${from}`;
        const delta = tie.standing >= FRIENDSHIP_STANDING ? 0.02
            : tie.standing <= GRUDGE_STANDING ? -0.03 : 0;
        if (delta !== 0) byPair.set(key, (byPair.get(key) ?? 0) + delta);
    }

    const CEILING = ALLIED_STANDING + 0.35;
    for (const [key, delta] of byPair) {
        const [aId, bId] = key.split('|');
        const a = state.factions.find(f => f.id === aId);
        const b = state.factions.find(f => f.id === bId);
        if (!a || !b) continue;
        for (const [holder, otherId] of [[a, bId], [b, aId]] as const) {
            const now = holder.standing[otherId] ?? 0;
            // Only ever moves a standing that is already inside the band this
            // module is about. It cannot make a blood enemy an ally by seating
            // their juniors near each other, and it cannot push an alliance
            // past the ceiling.
            if (delta > 0 && now >= CEILING) continue;
            holder.standing[otherId] = Math.max(-1, Math.min(CEILING, now + delta));
        }
    }
    void circle;
}

// ─────────────────────────────────────────────────────────────────────────
// SMALL THINGS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every pair of attendees from different houses, deterministically ordered.
 */
function crossHousePairs(attendees: readonly NpcRecord[]): [NpcRecord, NpcRecord][] {
    const out: [NpcRecord, NpcRecord][] = [];
    for (let i = 0; i < attendees.length; i++) {
        for (let j = i + 1; j < attendees.length; j++) {
            if (attendees[i].factionId === attendees[j].factionId) continue;
            out.push([attendees[i], attendees[j]]);
        }
    }
    return out;
}

function place(npc: NpcRecord, at: number, score: number): GatheringPlacing {
    return { npcId: npc.id, name: npc.name, factionId: npc.factionId, place: at, score };
}

/**
 * Price an NPC for the combat layer.
 */
export function combatantOf(npc: NpcRecord, state: WorldState): CombatantInput {
    const wounds: Injury[] = woundsCarriedBy(npc);
    const max = maxBodyOf(npc);
    const share = max > 0 ? bodyStandingOn(npc, state.currentDay) / max : 1;

    return {
        weapon: bestObjectHeldBy(npc, state),
        id: npc.id,
        name: npc.name,
        realmOrdinal: npc.cultivation.realmOrdinal,
        spiritRoot: npc.cultivation.spiritRoot,
        attributes: npc.cultivation.attributes,
        injuries: wounds,
        hp: Math.max(1, Math.round(BOUT_BODY * Math.max(0, Math.min(1, share)))),
        maxHp: BOUT_BODY,
        qi: BOUT_BODY,
        maxQi: BOUT_BODY,
        technique: bestArt(npc)
    };
}

/**
 * The rated object this person is actually holding, or null.
 */
function bestObjectHeldBy(npc: NpcRecord, state: WorldState): CombatantInput['weapon'] {
    let best: CombatantInput['weapon'] = null;
    for (const object of state.objects) {
        if (object.possessorId !== npc.id) continue;
        if (object.power === null || isRuined(object)) continue;
        // A CARRIAGE IS NOT A WEAPON
        if (object.tags.includes('conveyance')) continue;
        if (best === null || object.power > best.power) {
            best = { id: object.id, name: object.name, power: object.power };
        }
    }
    return best;
}

/**
 * Write what the bout did to the objects in it.
 */
function applyBoutBreakages(
    state: WorldState,
    broken: ConfrontationResult['brokenObjects'],
    day: number
): string[] {
    const lines: string[] = [];
    for (const loss of broken) {
        const object = state.objects.find(o => o.id === loss.broke.objectId);
        if (!object) continue;
        const at = state.objects.indexOf(object);
        state.objects[at] = ruin(object, {
            onDay: day,
            source: `swung at somebody it was not fit for, and did not survive it`,
            note: loss.broke.exposure.cause
        });
        lines.push(`${object.name} did not survive the bout`);
    }
    return lines;
}

/**
 * The art they would actually bring.
 */
function bestArt(npc: NpcRecord): CombatantInput['technique'] {
    let best: CombatantInput['technique'] = null;
    let bar = -1;
    for (const id of npc.cultivation.techniqueIds) {
        const t = getTechnique(id) as unknown as
            (NonNullable<CombatantInput['technique']> & { requiredOrdinal?: number }) | undefined;
        if (!t) continue;
        const need = Number(t.requiredOrdinal ?? 0);
        if (need > npc.cultivation.realmOrdinal || need <= bar) continue;
        bar = need;
        best = t;
    }
    return best;
}

/** Re-exported for a harness that wants the raw resolver result. */
export type { ConfrontationResult, RuinWing };
