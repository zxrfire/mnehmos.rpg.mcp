/**
 * The vocabulary of the encounter layer.
 *
 * Deliberately structural rather than imported. This module is engine-pure -
 * state in, deltas out, no database, no world layer, no `src/web` - so
 * everything it needs about a place, a person or a name arrives as a plain
 * record the caller assembles from whatever it actually has. That is what lets
 * the same selection run against a live world, a fixture, and a test with three
 * hand-written people in it.
 */

import type { SimEvent } from '../../schema/cultivation.js';
import type { DutyAccess, DutyOrigin, DutyPosture, DutyScale, RefusalTerms } from './duties.js';
import type { Contact, ContactPerson, TieChange } from './contact.js';
import type { EncounterEntry, EncounterKind } from '../../data/cultivation/encounters.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CULTIVATOR IS DOING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The activity an encounter interrupts.
 *
 * Not the game's verb list - a coarsening of it. Six of the web layer's verbs
 * are "you are standing in a settlement doing something ordinary" and they all
 * have the same exposure to the world, so they are one activity here. What
 * separates the rows is how much of the world can reach you while you do it.
 */
export type EncounterActivity =
    /** Meditating. A door, shut, but only a door. */
    | 'seclusion'
    /** Closed-door seclusion. The formation is up and nothing gets through it. */
    | 'sealed'
    /** On the road between two places. */
    | 'travel'
    /** Standing about in an inhabited place: market, gate, inn, sect yard. */
    | 'abroad'
    /** Working ground: herbs, culling, digging, a ruin. */
    | 'gathering'
    /** Earning: labour, errands, waiting on somebody. */
    | 'labour'
    /** Lying up with wounds. */
    | 'convalescence';

/**
 * Whether anybody could find you.
 *
 * A seclusion on your sect's ground and a seclusion in a cave nobody has a
 * name for are not the same act, and the difference is not danger - it is
 * WHO can reach you. Being findable is the cost and the benefit of belonging:
 * a senior sister comes to check on you, and so does everything else your
 * house is inside.
 *
 * Nothing here is about how remote a place is. It is about whether somebody
 * looking for this person would know where to start.
 */
export type Locatability =
    /** On your house's ground, or where people know to look for you. */
    | 'known'
    /** Your own cave. A few people could find it if they tried. */
    | 'private'
    /** Nobody knows where you are, and nobody comes if it goes wrong. */
    | 'hidden';

/** Whether the thing that happened was, on balance, for you or against you. */
export type EncounterValence = 'good' | 'bad' | 'neutral';

/**
 * How the hostile half of an encounter stands relative to the cultivator.
 *
 * Read off `regard.ts` bands and nothing else, which is why there is no branch
 * anywhere on faction, title or importance. `above` is the one that carries
 * `docs/world/houses/discovery.md`: something far enough up is not a fight that was
 * lost, it is a fight that was never offered.
 */
export type EncounterStance =
    /** Nothing hostile in this entry at all. */
    | 'none'
    /** A real fight. Hand it to the combat resolver. */
    | 'engaged'
    /** So far above that engagement is not on the table. They did not look up. */
    | 'above'
    /** So far below that it costs nothing. The room rearranges itself. */
    | 'beneath';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE WORLD LOOKS LIKE FROM HERE
// ─────────────────────────────────────────────────────────────────────────

/** Where they are standing, reduced to what the draw actually reads. */
export interface EncounterPlace {
    id: string;
    name: string;
    /** `LocationKind` as a string, so this module does not import the world layer. */
    kind: string;
    /** 0..1. Multiplies how often anything happens here at all. */
    danger?: number;
    /** 1..100 geology. Only used to gate qi-specific entries. */
    qiDensity?: number;
    hazards?: readonly string[];
    controllingFactionId?: string | null;
    /** A sealed pocket. Nothing walks in; the site itself is the hazard. */
    sealed?: boolean;
    /**
     * How many are standing on this ground, and how many of them are sitting.
     *
     * The design owner's rule, in their words: "the encounter rate isn't simply
     * a function of people - it's a function of people / people in seclusion."
     * People behind their own doors are inert. They are not walking into
     * anybody's cave, and their presence is the mass that makes the place
     * unattractive to anybody who might.
     *
     * Both halves are needed because the same headcount means opposite things:
     * a mountain of a hundred all sealed is almost nobody moving, and a market
     * town of a hundred is everybody moving. Population alone cannot tell them
     * apart, which is why a sect's own cultivation ground came out as the most
     * dangerous place in the world to sit - measured, and exactly backwards.
     *
     * Omitted is legal and reads as ordinary traffic. See `companyEffect`.
     */
    company?: {
        /** Bodies on this ground, the cultivator included. */
        heads: number;
        /** 0..1 - the share of them who are sitting rather than moving about. */
        settledShare: number;
    };
}

/**
 * Somebody who is actually standing there.
 *
 * The cast an encounter draws from. It is supplied, never invented: an
 * encounter that needs a person and is handed nobody produces a person-free
 * entry instead, because inventing one at the moment of the encounter is the
 * bespoke path.
 */
export interface EncounterPerson {
    id: string;
    name: string;
    realmOrdinal: number;
    factionId?: string | null;
    factionName?: string | null;
    rank?: string | null;
    /** True when the player already has a knowledge record for them. */
    known?: boolean;
}

/**
 * What the cultivator belongs to.
 *
 * The three independent axes of standing, as `sects.ts` and `sect_members`
 * already hold them: which house, how far up its ladder, and how much of its
 * ledger is in your favour. Null membership is the ordinary case and every
 * institutional path degrades to nothing rather than to a default house.
 */
export interface Membership {
    factionId: string;
    factionName: string;
    /** Index into the sect's own `ranks` array. 0 is the bottom rung. */
    rankIndex: number;
    /** How many rungs that array has, so a share can be taken of it. */
    rankCount: number;
    contribution: number;
}

/** A name the world holds, and whether this player has heard it. */
export interface EncounterName {
    id: string;
    name: string;
    known?: boolean;
}

/**
 * Names and content the caller can substantiate.
 *
 * Everything filled into a `{token}` slot comes from here or from arithmetic.
 * Nothing in this module composes a proper noun, which is the mechanical form
 * of "never reference an entity the player has no knowledge record for": if
 * the caller does not hand over a faction, no faction is named.
 */
export interface EncounterNamePools {
    factions?: readonly EncounterName[];
    places?: readonly EncounterName[];
    /** Herb, pill and technique names from the live catalogs. */
    herbs?: readonly string[];
    pills?: readonly string[];
    techniques?: readonly string[];
    /** Things that can be found: authored elsewhere, listed here. */
    loot?: readonly string[];
}

/**
 * One line the world digest already produced, offered for arrival.
 *
 * The digest's own attribution gating has already run by the time a line gets
 * here, so `text` is safe to hand to a narrator verbatim. What this layer adds
 * is that a thing reported at a distance sometimes turns up instead.
 */
export interface ArrivableFact {
    factId: string;
    day: number;
    /** Already attribution-gated. Contains no name the player lacks a record for. */
    text: string;
    /** 0..1. Big things arrive; small ones stay reports. */
    magnitude: number;
    kind?: string;
    namableFactionIds?: readonly string[];
    namableNpcIds?: readonly string[];
    /**
     * Still happening, with somewhere to be and a clock on it.
     *
     * The difference between reading that a caravan was raided and walking
     * into the raid. A fact with this set arrives as a SCENE the player can
     * join, ignore or exploit; one without it arrives as a consequence that
     * has already finished happening. The world layer decides which it is,
     * because the world layer is what knows whether the thing is over.
     */
    inProgress?: InProgress;
}

/** A thing still running when the cultivator got there. */
export interface InProgress {
    /** Where it is. The player has to be there, or get there. */
    locationId: string;
    /** Absolute day after which it is over, whoever did or did not come. */
    endsOnDay: number;
    /** Rung of whatever is doing it, when something is. */
    threatOrdinal?: number | null;
    /** How many are already in it, on any side. */
    involved?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE DISCOVERY SEAM
// ─────────────────────────────────────────────────────────────────────────

/**
 * A name that entered the player's world because of this encounter.
 *
 * Shaped to be spread straight into `KnowledgeGate.learnIfNew` with a holder
 * and a day added. The knowledge layer owns the ladder of knowing; this layer
 * only ever reports that a source existed and what it said, which is the one
 * thing a selection can honestly know.
 */
export interface KnowledgeGrant {
    kind: 'cultivator' | 'sect' | 'place' | 'event';
    id: string;
    name: string;
    /** `SourceKind` from the social layer, as a string to avoid the import. */
    sourceKind: 'witnessed' | 'told' | 'overheard' | 'read' | 'inferred' | 'assumed';
    sourceNote: string;
    stance?: 'knows' | 'believes' | 'suspects';
    confidence?: number;
    statement?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT COMES BACK
// ─────────────────────────────────────────────────────────────────────────

/** Net change the engine decided on its own. Everything else is a decision. */
export interface EncounterDeltas {
    hp: number;
    spiritStones: number;
    satiety: number;
    /** Days of provisions taken or found. */
    rations: number;
}

/**
 * A fight this encounter offers, described but not resolved.
 *
 * Resolution needs artifact rows and a battle history the pure layer does not
 * hold, so the encounter layer prices the opposition and stops. The caller
 * builds `CombatantInput`s from this and calls `resolveMelee`, or does not,
 * because the player was handed control back and may simply leave.
 */
export interface Confrontation {
    threatOrdinal: number;
    /** How many of them. Always at least one. */
    count: number;
    stance: EncounterStance;
    /** `Regard.damageMultiplier` for this threat against this cultivator. */
    damageMultiplier: number;
    /** Regard's own factual line about the gap. Never narration. */
    reaction: string;
    /**
     * Walking away is available.
     *
     * True whenever the stance is anything but `engaged`, whatever the entry's
     * tags say. An `unavoidable` tag means the EVENT happens to you; it has
     * never meant that fighting is compulsory, and a resolver that read it
     * that way was putting cultivators into fights against things nine rungs
     * above them and calling the result a defeat.
     */
    avoidable: boolean;
    /**
     * There is a fight here that this cultivator could actually have.
     *
     * False for `above` and `beneath`. A driver must not call the combat
     * resolver on a confrontation where this is false: one is a thing that did
     * not look up, and the other is a thing that cannot reach them. Neither is
     * a battle, and scoring either as one is how the encounter layer became
     * the leading cause of death in the game.
     */
    engageable: boolean;
}

/**
 * An institution asking for this person by name.
 *
 * Present on an occurrence when the thing that happened was a call rather than
 * a coincidence. Everything here is settled - how long, what it pays, what the
 * ledger says if it is walked away from - EXCEPT whether it is taken, which is
 * the player's and is why an occurrence carrying one always interrupts.
 */
export interface Duty {
    origin: DutyOrigin;
    posture: DutyPosture;
    factionId: string | null;
    factionName: string | null;
    /** Days it takes, if taken. */
    days: number;
    /** Contribution paid on completion. Zero without a house to be credited in. */
    contribution: number;
    stones: number;
    /** The rung it is priced against. */
    pitchOrdinal: number;
    /** Absolute day it must be answered or finished by. */
    dueOnDay: number;
    refusal: RefusalTerms;
    /** How big it is. A raided caravan and a war differ here and nowhere else. */
    scale: DutyScale;
    /** Peers sent with them. Where rivals, debts and witnesses come from. */
    cohort: number;
    /** What the sending reaches that they could not reach alone. */
    access: DutyAccess;
    /**
     * Who actually said it.
     *
     * An order carries very differently from a named elder who has an opinion
     * about you than from "the sect", and the house has a roster, so there is
     * no reason for it ever to be the second. Null only when the caller
     * supplied no roster.
     */
    spokenBy: DutyMouth | null;
}

/** The person who brought the order, and what is true about them. */
export interface DutyMouth {
    id: string;
    name: string;
    /** Their rung on the house ladder, which is why they are the one carrying it. */
    rankIndex: number;
    realmOrdinal: number;
    /** Whether the player already has a record for them. */
    known: boolean;
    /** What `members.ts` says about them. Never composed here. */
    detail: string | null;
}

/**
 * Something still happening, that the cultivator is standing in.
 *
 * The difference between reading that a caravan was raided and walking into
 * the raid. A scene has somewhere to be and a clock, and the clock runs whether
 * or not anybody joins - which is what stops it being a quest marker.
 */
export interface Scene {
    locationId: string;
    /** Absolute day it is over, whoever did or did not come. */
    endsOnDay: number;
    threatOrdinal: number | null;
    /** How many are already in it, on any side. */
    involved: number;
    /** Days left when the cultivator arrived. Zero means they got there late. */
    daysLeft: number;
}

/** One thing that happened, fully resolved except for anything a player decides. */
export interface EncounterOccurrence {
    /** Catalog row id, or `digest:<factId>` for an arrival. */
    id: string;
    entryId: string | null;
    kind: EncounterKind | 'arrival' | 'contact';
    valence: EncounterValence;
    /** Days into the window. */
    dayOffset: number;
    /** Absolute day, the coordinate every roll was keyed to. */
    absoluteDay: number;
    interrupts: boolean;
    stance: EncounterStance;
    /** Ready to concatenate onto `TimeSkipResult.events`. */
    event: SimEvent;
    deltas: EncounterDeltas;
    confrontation: Confrontation | null;
    /** Set when an institution asked for this person by name. */
    duty: Duty | null;
    /** Set when the thing was still running when they got there. */
    scene: Scene | null;
    /**
     * Set when this was ordinary contact with somebody from their own house.
     *
     * Not a duty and not danger. It carries a `tie` describing what it does to
     * the relationships record, which is how repeated contact with the same
     * person accumulates instead of resetting.
     */
    contact: Contact | null;
    grants: KnowledgeGrant[];
    /** People from the supplied cast who took part. Ids only. */
    castIds: string[];
    source: 'catalog' | 'digest' | 'summons' | 'contact';
}

/** Everything a window produced, chronologically. */
export interface EncounterRoll {
    occurrences: EncounterOccurrence[];
    /**
     * Absolute day of the first occurrence that stops what the cultivator was
     * doing, or null. The caller truncates its own span here.
     */
    firstInterruptDay: number | null;
    /** How many checks were made. Diagnostics and design guards, never play. */
    checks: number;
    /** Eligible catalog rows after every predicate. Zero is a reportable state. */
    poolSize: number;
}

/** The whole input to a roll. Pure data; nothing here is read from a database. */
export interface EncounterRollInput {
    seed: string;
    /** Absolute day the window opens. */
    startDay: number;
    /** Length of the window. One day is legal and is the ordinary turn. */
    days: number;
    activity: EncounterActivity;
    cultivator: {
        id: string;
        realmOrdinal: number;
        /** 0..3. Moves presence and timing only - never a resolution. */
        fortune: number;
        maxHp: number;
        hp: number;
        spiritStones: number;
        factionId?: string | null;
    };
    place: EncounterPlace;
    /**
     * What they belong to, when they belong to anything.
     *
     * Null is the ordinary case. With it, the house can call on them; without
     * it, nothing here changes except that no summons is ever drawn - a rogue
     * simply is not sent for.
     */
    membership?: Membership | null;
    /**
     * Whether anybody could find them here. Defaults to `private`.
     *
     * Only consulted for the shut-door activities, because standing in a
     * market is being locatable by definition.
     */
    locatability?: Locatability;
    /**
     * The house's own roster, with whatever the record already says about each.
     *
     * Supplied by the caller from `members.ts` plus the `relationships` table.
     * Without it there is no ordinary contact and no named mouth on a summons -
     * both degrade to silence rather than to an invented person.
     */
    roster?: readonly ContactPerson[];
    /** Who is standing there. Empty is legal and is honestly handled. */
    cast?: readonly EncounterPerson[];
    names?: EncounterNamePools;
    /** World-digest lines eligible to arrive rather than be reported. */
    arrivable?: readonly ArrivableFact[];
    /** Cap on how many occurrences one window may produce. */
    limit?: number;
}

export type { EncounterEntry, EncounterKind };
export type { Contact, ContactPerson, TieChange };
