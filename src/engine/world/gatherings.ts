/**
 * The chosen of allied houses meet each other.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The world simulated deaths, births, goals, grudges, wars and disasters, and
 * its people never MET. A cultivator's relationships were written once at
 * seeding and thereafter only ended - by death, by a faction folding, by
 * somebody being killed by somebody else's house. Measured on the drift audit
 * before this module existed:
 *
 *   inherited grudges after 500 years   221
 *   of those, originating in two people who met and disliked each other   0
 *
 * Every account in the world descended from a corpse or a catastrophe. Nobody
 * had ever been beaten in front of an audience, come second to somebody they
 * had to keep seeing, been left off an invitation list, or owed anybody
 * anything from a hole in the ground.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT A GATHERING IS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   AN EVENT THAT PUTS A DEFINED SET OF PEOPLE IN ONE PLACE FOR A DEFINED
 *   TIME AND PRODUCES OUTCOMES THAT PERSIST.
 *
 * Four kinds, and they differ in what they write rather than in their name:
 *
 *   MEETING       introductions. Writes ties, and nothing else. The floor, and
 *                 the commonest, because most of what a generation knows about
 *                 the next house along is who they have shaken hands with.
 *   CHALLENGE     two people test each other with nobody meant to be hurt. The
 *                 interesting outcomes are the ones where that fails - a real
 *                 injury, a humiliation in front of people - and the one where
 *                 the gap turns out to be categorical and somebody finds out
 *                 in an afternoon that a peer is out of reach.
 *   COMPETITION   ranked, public, standing on the line. A house's prestige
 *                 moves with its chosen's placing, and the winner may be
 *                 SELECTED UPWARD into the host - the feeder relationship
 *                 `docs/world/sects.md` documents, which is the single most
 *                 consequential thing that can happen to a promising
 *                 cultivator and is the reason inter-sect competitions matter.
 *   EXPEDITION    several houses' chosen enter a site together and are scored,
 *                 on one of two modes that produce genuinely different
 *                 behaviour - see THE TWO SCORING MODES.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS BESPOKE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * There is no branch on a faction id anywhere in this file, no table saying
 * which house holds a tournament, and no new record of who is friends with
 * whom. A gathering happens because of numbers that already exist:
 *
 *   WHO IS ALLIED   `FactionRecord.standing`, seeded from the catalog's
 *                   `rivalIds` (-0.6) and `parentFactionId` (+0.4). Read at
 *                   `ALLIED_STANDING`, which is `rivalsOf`'s -0.3 with the
 *                   sign flipped, and nothing else.
 *   WHO IS INVITED  the `chosen` tag `refreshChosen` maintains. A house with
 *                   no living chosen sends nobody.
 *   WHO CAN HOST    `resources.spirit_stones` against `HOSTING_COST_PER_HEAD`.
 *                   A circle whose senior house cannot pay does not gather.
 *   WHO WINS        `assessPower`, the combat layer's own pricing function,
 *                   and `resolveConfrontation`, its own resolver. There is no
 *                   second fight model in this file.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EXCLUSION IS THE POINT, NOT AN EDGE CASE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Measured on a seeded world, 21 of 32 houses are allied to nobody at all -
 * they hold no `parentFactionId` and nobody holds one to them - so they are
 * never in a circle and their chosen never meet anybody. That is not a gap in
 * the feature. It is the feature: the difference between a house inside the
 * pyramid and a house outside it is that the first one's disciples have known
 * the next generation of five other houses since they were forty, and the
 * second one's have not.
 *
 * Every gathering records the live houses in the host's region that were NOT
 * invited, on the fact, by id. It is readable from the record afterwards and
 * it costs those houses exactly what it should: no ties, no placings, no
 * prestige and no route upward.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TWO SCORING MODES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The user's requirement, and they must not collapse into one another.
 *
 *   HAUL    who brings the most out. Scored on wings worked, weighted by
 *           depth. Rewards SPREADING OUT - two entrants in one hall duplicate
 *           each other, and a house that fans across the site outscores one
 *           that follows its best cultivator around - and it rewards grinding,
 *           because every wing inside `expeditionBudget`'s reach is worth
 *           something to whoever gets to it.
 *   PROOF   who reaches a named room first. Scored on arrival, not on volume.
 *           Rewards READING THE PLACE: `identifyBuilder` either places the
 *           builder or does not, and somebody who places it gets
 *           `expectationsFor`'s pointer and walks straight there, while
 *           somebody who cannot searches from the door outward and pays the
 *           depth of every wrong room. A weaker cultivator who can read the
 *           site beats a stronger one who cannot, which is the whole reason
 *           the mode exists.
 *
 * A site offers `proof` only when there is something to prove - a builder the
 * provenance layer can name - and `haul` only when there is enough of it left
 * to be worth spreading across. Sites that offer both draw between them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The driver walks five centuries routinely, so the yearly cost has to be a
 * constant. It is: the circle scan is one pass over the faction list per year
 * (32 live houses, so about a thousand standing lookups), and everything after
 * the roll is bounded - `MAX_ATTENDEES` people, `MAX_INTRODUCTIONS` pairs,
 * `MAX_BOUTS` confrontations, `MAX_ENTRANTS` in a site. Nothing scales with
 * the roster, the history or the year.
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
    carryingWounds,
    relationshipWith,
    upsertRelationship,
    woundsCarriedBy,
    type NpcRecord,
    type RelationshipKind
} from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE NUMBERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Standing at which two houses count as allied.
 *
 * `pressure.ts` reads hostility at -0.3 in `rivalsOf`. This is the same line
 * with the sign flipped, so the two questions - who would move against this
 * house, who would send their people to it - are answered off one number and
 * cannot drift apart. The catalog's feeder edge is seeded at +0.4, comfortably
 * over it, and a rivalry at -0.6 is comfortably under.
 */
export const ALLIED_STANDING = 0.3;

/**
 * How often a circle gathers, in years.
 *
 * A generation rather than a season. A gathering is the thing a disciple has
 * been preparing for since the last one, and a world that holds one every
 * spring makes it furniture; measured against the settling clock, one every
 * fifteen years puts three or four in an ordinary cultivator's climb through
 * the middle of the ladder and one or two before their first real rank.
 *
 * Rolled per circle per year rather than scheduled, so the rate is a property
 * of how many circles the world still has rather than of how eventful the year
 * was - the same argument `applyConvergences` makes for staying outside the
 * event budget.
 */
export const GATHERING_YEARS = 15;

/**
 * What hosting costs the house in the chair, per head.
 *
 * Somebody feeds and houses forty disciples of five other houses for a season,
 * and it is not free. Against a seeded treasury of twenty to forty thousand
 * stones this is a real bill and not a rounding error, which is what makes
 * "who can afford it" one of the three things that decide whether a circle
 * gathers at all. A house that has lost its vein stops holding these long
 * before it stops existing, and its juniors stop knowing anybody.
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
 *
 * `settleNpcDeath` inherits a relationship at -0.4 or worse and drops
 * everything above it. So this is not a display threshold: it is the line
 * between a dislike that dies with the person who felt it and a grudge their
 * heir is still carrying two hundred years later, and a gathering that wants
 * to produce the second has to reach it.
 */
export const GRUDGE_STANDING = -0.4;

/**
 * Both sides of a bout are priced on the same normalised body.
 *
 * `resolveExchange` computes damage as a FRACTION of the defender's maximum
 * precisely so the arithmetic works at Qi Condensation and at Grand Ascension
 * alike, and `WITHDRAW_HP_FRACTION` and `EXHAUSTED_QI_FRACTION` are fractions
 * too. So a bout between two equal-sized pools resolves on the advantage ratio
 * and the rolls, and the absolute number is arbitrary.
 *
 * That matters because the world layer does not store NPC hit points and this
 * module must not invent a formula for them - a second body model beside
 * `cultivation-manage.ts`'s is exactly the parallel system this project keeps
 * building by accident. What the bout produces that the world CAN store is an
 * untreated injury count, and that is what gets written back.
 */
const BOUT_BODY = 100;

/**
 * How much a day of showing can swing a placing.
 *
 * Not a fudge factor for drama: without it a competition is `assessPower`
 * sorted descending, the same house wins every time for four centuries, and
 * the ranking carries no information a caller could not have got from
 * `power_ordinal`. With it, entrants within about a third of each other can
 * change places and entrants a realm apart cannot, which is the correct shape -
 * a competition should be able to surprise you about who among the good ones
 * is best and should never suggest a Qi Condensation disciple beat a Core
 * Formation one.
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
 *
 * Not stored anywhere and deliberately not: it is recomputed from `standing`
 * every year, so a circle dissolves the moment the house at its centre folds,
 * which is what actually happens to a feeder pyramid when the court above it
 * goes. See the harness for what that does to the gathering rate over five
 * centuries - it is the single largest thing this module measured.
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
 *
 * Either direction counts. The catalog only ever writes the feeder edge
 * upward - a branch holds +0.4 toward its court and the court holds nothing
 * back - and reading only the outbound half would mean a court never invited
 * anybody while every branch invited a court that was not holding a gathering.
 * An alliance is a fact about a pair, and one side asserting it is enough for
 * the two to be in a room.
 *
 * Hostility in either direction vetoes it, so a house that is somebody's feeder
 * and somebody's enemy at once is not in that circle.
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
 * Every circle the world currently contains, one per group.
 *
 * A house hosts when it has more allies than anybody else in its own circle,
 * and ties break on power and then on id. That is not a rule about courts: it
 * is arithmetic that lands on courts because a court is the house five branches
 * point at, which is what `parentFactionId` means. If a branch ever accumulates
 * more alliances than its court it hosts instead, and nothing here notices.
 *
 * One host per group, so a three-house chain does not hold three gatherings in
 * the same season under three different chairs.
 */
export function circlesOf(state: WorldState): Circle[] {
    const live = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f));
    const allies = new Map<string, FactionRecord[]>();
    for (const f of live) allies.set(f.id, alliesOf(state, f));

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
 *
 * The `chosen` tag and nothing else. `refreshChosen` maintains it yearly and a
 * house that has lost its favourite names another, so this list refills itself
 * without anything here knowing how - and a house that cannot name one, because
 * it teaches nothing or has nobody at a rank low enough to be promoted over,
 * sends nobody and is simply absent from the record.
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
 *
 * Called from `applyPressure` alongside `applyAdvancement` and
 * `applyRecruitment`: the parts of a year that are arithmetic rather than
 * incident. Deliberately outside the weighted event table, for the reason
 * `applyConvergences` states - a gathering that only happens when the year had
 * a slot free is not a calendar.
 *
 * Mutates `state` in place, the same way every other pass in the driver does.
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
 *
 * Three ways it does not happen, and all three are outcomes rather than
 * failures: nobody was sent, only one house sent anybody, or the house in the
 * chair could not pay for it.
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
 *
 * Derived from what the circle has, never declared. A site the party can get
 * into puts an expedition on the table; enough entrants from enough houses to
 * be worth ranking puts a competition on it; two people are enough for a bout.
 * A meeting is always available and is weighted heaviest, because it is the
 * ordinary thing and the other three are what a good year looks like.
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
 *
 * "Near" is the host's own region, because a house on the other side of the
 * province was not snubbed, it was simply somewhere else. Everything left is
 * either a rival - which is the ordinary and legible reason - or a house
 * nobody is allied to at all, which is the quieter and more permanent one.
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
 *
 * Only across houses: two disciples of the same sect already know each other
 * and being in the same hall is not news. What decides whether it goes well is
 * three things the world already stores and one roll:
 *
 *   HOW CLOSE THEY ARE ON THE LADDER   people within reach of each other take
 *                                      each other seriously, in both
 *                                      directions. A gap of a realm produces
 *                                      an acquaintance rather than a friend or
 *                                      an enemy, because neither of them is
 *                                      really the other's problem.
 *   WHAT THEIR HOUSES THINK            two branches of the same court start
 *                                      warm; two houses that only just clear
 *                                      the hostility line do not.
 *   WHAT IS ALREADY ON THE BOOKS       an inherited grudge does not evaporate
 *                                      because somebody was polite at dinner.
 *
 * Two rolls, not one, because the halves are allowed to disagree completely and
 * the asymmetric cases are the interesting ones: he thinks they got on, she has
 * been counting.
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
 *
 * Deliberately small in range. A first impression is not a life: it opens the
 * account somewhere between mild warmth and mild dislike, and everything after
 * it - a bout that went badly, a wing somebody took first - is what pushes it
 * past a threshold that matters.
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
 *
 * `resolveConfrontation` with `goal: 'subdue'` and `willWithdraw: true`, which
 * is the engine's own description of exactly this: the aggressor is not trying
 * to finish anybody and the loser breaks off rather than being finished. There
 * is no second resolver here and there must not be one - what makes a challenge
 * different from a killing is the INTENT handed to the same function, and the
 * outcomes it can reach follow from that.
 *
 * Three endings are worth more than the win:
 *
 *   NO CONTEST   the gap was categorical and the resolver refused to roll. The
 *                loser did not lose a fight; they found out in an afternoon
 *                that somebody they came up alongside is out of reach. That
 *                opens a GOAL, which outlives them and passes to an heir.
 *   CRIPPLED     nobody was meant to be hurt and somebody was. The injury goes
 *                on the record as an untreated one, which the survival layer
 *                and every future breakthrough will read, and it opens a real
 *                account at inheritable depth.
 *   HUMILIATION  beaten and let go in front of people, which the combat layer
 *                already calls the genre's engine, and which seeds its own
 *                obligation.
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
            combatantOf(a),
            combatantOf(b),
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
 *
 * A goal rather than a relationship, because goals INHERIT - `settleNpcDeath`
 * hands the unfinished ones to an heir with the generation counter bumped - so
 * an afternoon in which a nineteen-year-old discovered a peer was out of reach
 * can still be driving somebody's great-grandchild.
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
}

// ─────────────────────────────────────────────────────────────────────────
// 3. A MARTIAL COMPETITION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ranked, public, with standing on the line.
 *
 * Scored on `assessPower` - the combat layer's own pricing, which reads realm,
 * attributes, foundation, injuries, insights and what they are carrying - times
 * one seeded showing per entrant. The showing is what stops the ranking being
 * `power_ordinal` sorted descending, which would carry no information and would
 * mean the same house won for five centuries. See `SHOWING_SPREAD`.
 *
 * Two things move afterwards, and the second is the important one:
 *
 *   PRESTIGE   `resources.prestige` on the placing houses. A free-form resource
 *              key, which is what `resources` is for, rather than a new table.
 *   SELECTION  the winner, if they came from a house that answers to the host,
 *              is TAKEN UP. `docs/world/sects.md`: "a generation's outstanding
 *              disciple is selected upward... you arrive at the higher sect at
 *              the bottom." So they change faction, land at rank 0, and LOSE
 *              the chosen tag - their reputation does not travel and neither
 *              does their rank. Their old house then names a replacement on the
 *              next pass of `refreshChosen`, without anything here telling it
 *              to, which is the two systems composing rather than a special
 *              case.
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
        const power = assessPower(combatantOf(npc), { ambient: 'normal' }).total;
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
    //
    // AFTER the ties are written, deliberately. A tie recorded between two
    // people of different houses reads as a same-house tie the moment the
    // champion changes colours, which is not a bug - it is what selection
    // upward DOES, and the row keeps the gathering's fact id so the history is
    // still legible. Anything reading `factionId` to reconstruct who met whom
    // has to know that.
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
 *
 * The site, the wings, the depth clock and the read are all
 * `provenance.ts`/`convergence.ts` and none of it is reimplemented here. What
 * this adds is the CONTEST: who got what, in one of two modes that reward
 * opposite behaviour. See THE TWO SCORING MODES at the top of the file.
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
 *
 * Each entrant takes the best wing nobody in the party has claimed yet, which
 * is what makes this reward spreading out: the second person into a hall gets
 * the next one down, so a party that fans across the site covers more of it
 * than one that queues behind its strongest member. Depth is the weight,
 * because the far rooms are the ones with anything left, and
 * `expeditionBudget` decides which of them anybody can reach and walk back out
 * of - so a short window is a small haul for everybody and a long one is a
 * grind that pays.
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
 *
 * The target is what the site's own habits point at - `expectationsFor` returns
 * the wing the builder's behaviour implies, so the answer is IN the place and
 * is not invented here. Then:
 *
 *   somebody who can PLACE the builder walks the target's depth and no further
 *   somebody who cannot searches from the door outward and pays every wrong
 *   room's depth before they get to the right one
 *
 * That is the whole difference, and it is why this mode rewards reading rather
 * than realm: `identifyBuilder` is `assessCapability`'s `understand` predicate,
 * which Insight and knowledge move and raw ordinal only partly does, so a
 * scholar three rungs down can beat the strongest person in the party to it.
 * Anybody whose walk runs past `expeditionBudget`'s safe depth does not get
 * there at all, and if nobody does the site keeps its secret, which is a real
 * outcome and should stay reachable.
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
 *
 * Open, found, with a wing nobody has opened, and inside somebody's reach. All
 * four are questions the location record already answers. A world whose ruins
 * are all sealed offers no expeditions, which is the correct answer for a
 * seeded world - every ruin starts sealed and undiscovered, and it takes the
 * `ruin_opened` template or a convergence to change that.
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
 *
 * `upsertRelationship` replaces `kind` and `standing` outright, so calling it
 * blind would let a polite dinner in year 700 overwrite an inherited blood
 * feud with an acquaintance. So the delta is applied to whatever is already
 * there, the structural kinds are never overwritten, and the fact id is merged
 * into `factIds` rather than replacing it - which is what makes "did this tie
 * begin at a gathering or at a death" answerable from the row itself, forever.
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
 *
 * The one constructive force in the world's alliance graph. Every other write
 * to `standing` in `pressure.ts` is a subtraction - a vein taken, a border
 * moved, a house ended - so without this the graph can only shrink, and the
 * measured consequence is that gatherings become rarer every century until
 * they stop. See the harness.
 *
 * Bounded on both sides. A circle that meets every fifteen years for five
 * centuries would otherwise saturate into a permanent bloc, which is the
 * opposite failure and just as wrong.
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
 *
 * Same-house pairs are dropped: two disciples of one sect being in the same
 * hall is not an introduction, and counting it would make a large delegation
 * look like a social success.
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
 *
 * Everything the world layer actually stores, and nothing invented. One of the
 * combat layer's inputs has no world-layer equivalent and is handled rather
 * than faked:
 *
 *   THE BODY  normalised. See `BOUT_BODY`.
 *
 * Injuries used to be the second. The world kept a COUNT, so this expanded it
 * into that many identical `serious` wounds with `woundType: null` - which is
 * what `combat-manage.ts` still does for an opponent described rather than
 * stored. NPCs now carry rows, so the rows are what a bout prices; the only
 * synthesis left is in `woundsCarriedBy`, for a save written before they did.
 */
function combatantOf(npc: NpcRecord): CombatantInput {
    const wounds: Injury[] = woundsCarriedBy(npc);

    return {
        id: npc.id,
        name: npc.name,
        realmOrdinal: npc.cultivation.realmOrdinal,
        spiritRoot: npc.cultivation.spiritRoot,
        attributes: npc.cultivation.attributes,
        injuries: wounds,
        hp: BOUT_BODY,
        maxHp: BOUT_BODY,
        qi: BOUT_BODY,
        maxQi: BOUT_BODY,
        technique: bestArt(npc)
    };
}

/**
 * The art they would actually bring.
 *
 * Both sides of every bout are built the same way from the same field, which is
 * the rule AGENTS.md states from the other end: handing one side a technique
 * and not the other is a 1.4x swing that will look like whatever you were
 * measuring. What differs between two entrants here is what their house's shelf
 * gave them, which is the difference that is supposed to matter.
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
