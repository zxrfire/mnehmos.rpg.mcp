/**
 * NPCs as small durable records.
 */

import { forStream } from '../cultivation/rng.js';
import { reconcileSoulAndSelf, ruinSoul } from '../cultivation/how-much-of-a-person-is-left.js';
import { whoTheyAreNow } from './reading-a-tie-against-the-roster.js';
import {
    carriedAcross,
    clampOrdinal,
    lifespanForOrdinal,
    maxHpForOrdinal,
    rankName
} from '../cultivation/realms.js';
import {
    rollAttributes,
    rollSpiritRoot,
    type InnateAttributes,
    type SpiritRootKey
} from '../cultivation/spirit-roots.js';
import { rollOrigin, type OriginTierKey } from '../cultivation/origin.js';
import { rollSex, type Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import {
    lifespanWithPhysique,
    physiqueOrNull,
    rollPhysique,
    type PhysiqueKey
} from '../cultivation/physiques.js';
import type { Bloodline } from './hunting-a-spirit-beast.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { untreatedInjuryCount } from '../cultivation/injuries.js';
import { HP_RECOVERY_FRACTION_PER_DAY, type Injury } from '../../schema/cultivation.js';
import { personName } from './history.js';
import { DEFAULT_LAYER, type LayerKey } from './layers.js';

// ─────────────────────────────────────────────────────────────────────────
// GOALS
// ─────────────────────────────────────────────────────────────────────────

export type GoalKind =
    | 'cultivation'
    | 'revenge'
    | 'wealth'
    | 'status'
    | 'protection'
    | 'discovery'
    | 'survival'
    | 'reunion'
    | 'debt'
    | 'other';

export type GoalStatus = 'active' | 'achieved' | 'abandoned' | 'blocked' | 'impossible';

/**
 * One thing an NPC is trying to do.
 */
export interface NpcGoal {
    id: string;
    kind: GoalKind;
    /** 1. The goal. Plain statement, written by the LLM, stored verbatim. */
    text: string;
    /** 2. Priority, 0..1. What this person drops everything else for. */
    priority: number;
    /**
     * 3. Progress. Where they have got to, in words:
     * "Has identified the killer's faction."
     */
    progress: string;
    /**
     * 4. Obstacles. What is in the way: "Insufficient strength." Plural
     * because there is usually more than one, and because a goal that becomes
     * possible is a goal one obstacle came off.
     */
    obstacles: string[];
    /** 5. Deadline, as an absolute day. Null for "no deadline", which is common. */
    deadlineOnDay: number | null;

    status: GoalStatus;
    /** Who or what it is about: an NPC id, a faction id, a location id. */
    targetId: string | null;
    openedOnDay: number;
    closedOnDay: number | null;
    /** Why it is blocked or was abandoned. Empty while active. */
    note: string;
    /**
     * Set when this goal was inherited rather than formed.
     */
    inheritedFromId: string | null;
    /** The person who first opened it, however many hands ago. */
    originHolderId: string;
    /** How many times it has been handed on. Zero for a goal you formed. */
    generation: number;
}

// ─────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────────────

export type RelationshipKind =
    | 'kin'
    | 'spouse'
    | 'parent'
    | 'child'
    | 'master'
    | 'disciple'
    | 'ally'
    | 'rival'
    | 'enemy'
    | 'patron'
    | 'client'
    | 'creditor'
    | 'debtor'
    | 'acquaintance';

/**
 * A durable tie between two people.
 */
export interface NpcRelationship {
    targetId: string;
    targetName: string;
    kind: RelationshipKind;
    standing: number;
    /** What it is actually about. One line, factual. */
    note: string;
    sinceDay: number;
    lastChangedDay: number;
    /** Fact ids that explain this relationship. The causal chain. */
    factIds: string[];
    /** Set when the tie was inherited rather than earned. */
    inheritedFromId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE RECORD
// ─────────────────────────────────────────────────────────────────────────

/**
 * Existence is multi-valued once cultivation is profound.
 */
export type ExistenceState =
    | 'alive'
    | 'physically_dead'
    | 'soul_preserved'
    | 'remnant'
    | 'sealed'
    | 'possessing'
    | 'reincarnated'
    | 'reconstructed'
    | 'missing'
    | 'unknown';

/** Retained name for the field. */
export type NpcStatus = ExistenceState;

/** How intact the soul is. Orthogonal to which body, if any, it is in. */
export type SoulState = 'intact' | 'damaged' | 'fragmented' | 'fading';

/** States in which the person is still acting in the world under their own will. */
const ACTING_STATES = new Set<ExistenceState>(['alive', 'soul_preserved', 'possessing', 'reconstructed']);

export function isActing(state: ExistenceState): boolean {
    return ACTING_STATES.has(state);
}

/** States in which the engine genuinely does not know what happened. */
export function isUnadjudicated(state: ExistenceState): boolean {
    return state === 'missing' || state === 'unknown';
}

export interface NpcIdentity {
    /** Absolute day of birth. Age is a subtraction, never a stored field. */
    bornOnDay: number;
    /**
     * Where they were born, drawn from the run seed exactly as the player's is.
     */
    origin: OriginTierKey;
    /**
     * A plain fact, carried so a child can have two parents.
     */
    sex: Sex;
    /**
     * The body they were born as, or null for 98 people in a hundred.
     */
    physique: PhysiqueKey | null;
    /**
     * What a line left in them, or null for the overwhelming majority.
     */
    bloodline: Bloodline | null;
    /** What they do when they are not cultivating. The economy is made of these. */
    occupation: string;
    /** Titles, sect ranks, epithets. Free text; the LLM writes them. */
    titles: string[];
    /** Other names they are known by. Rumours attach to these. */
    aliases: string[];
    /** One or two lines. Appearance, manner, the thing people remember. */
    description: string;
}

/**
 * What somebody is at, as a kind. See {@link NpcRecord.activity}.
 *
 * A closed set, because the whole point of it being data is that nothing
 * branches on the string: the prose is one line per kind and the world sim
 * moves people between kinds. A tenth kind is a row here and a line beside the
 * other lines, and no code anywhere else.
 */
export type ActivityKind =
    /** Chasing a thing they need. */
    | 'their_own_business'
    /** Open channels, and nothing else worth doing until they close. */
    | 'mending'
    /** The work of their rung, on their house's own ground. */
    | 'the_work_of_their_rank'
    /** Somebody in front of them being corrected. Takes people. */
    | 'teaching'
    /** Talking. Takes people, and is the commonest thing anybody is at. */
    | 'talking'
    /**
     * At a house's shelves, looking for something to learn.
     *
     * `seedSectLibraries` has put real books on real shelves since it was
     * written, gated by rank, so somebody at this is standing in front of a
     * catalog the player can also reach - and what they walk away with is a
     * thing that exists rather than a flavour line.
     */
    | 'at_the_shelves'
    /**
     * Getting people together for something the house is sending out.
     *
     * The owner's own worked example, which is the shape this whole field is
     * for: *"on one turn (or maybe many) the outer sect disciple is being
     * taught by an elder [...] once that's done, he goes out and takes a task
     * and is recruiting a group to go out."* Three activities in sequence, the
     * middle one alone and the outer two with other people in them.
     *
     * It reaches machinery that already exists rather than inventing any:
     * `duties.ts` is the task, `why-a-house-puts-a-party-on-the-road.ts` is the
     * reason, and `who-goes-out-for-a-house-and-what-comes-back.ts` is what
     * happens to the party. Somebody at this is somebody a player can join.
     */
    | 'mustering'
    /**
     * Eating, drinking, or sitting over the remains of both.
     *
     * The commonest thing anybody in any world is at, and the one most likely
     * to be happening when a stranger walks in. Takes people as often as not.
     */
    | 'at_a_table'
    /**
     * In a fight with something that is not a person, and it is going one way
     * or the other.
     *
     * `hunting-a-spirit-beast.ts` is the whole machine for this and the beasts
     * are catalogued with rungs on them, so somebody at it is in a real fight
     * with a real thing - which a player can walk into, help with, or watch.
     */
    | 'fighting_a_beast'
    /** Somewhere goods change hands. */
    | 'trade'
    /** Ground worth working, being worked. */
    | 'drawing_on_the_ground'
    /**
     * Posted somewhere for the house, for years rather than for an errand.
     *
     * The design owner: *"a sect stations their people outside the sect too"*,
     * and on who goes: *"maybe no office elders go outside"* - an elder holding
     * a room stays and approves things, and an elder holding none is exactly
     * who a house can spare. There are fewer rooms than elders on purpose, so
     * being spare is the ordinary condition rather than a failure.
     *
     * Distinct from `out_with_a_party`, which is an errand with a term measured
     * in weeks and a party around you. A station is one person, a place, and
     * years - and it is why a house has people in towns it does not own.
     */
    | 'stationed'
    /**
     * Out on the errand they mustered for, with the party they mustered.
     *
     * The end of the owner's worked chain - taught, then a task taken, then a
     * group recruited, then *"mid expedition with his party"* - and the one
     * activity where `withIds` is the whole party rather than a companion.
     * Everybody in it names everybody else, so walking into the middle of one
     * reads the same whoever you looked at.
     */
    | 'out_with_a_party'
    /** Between places, alone. */
    | 'travelling'
    /** The road, which is what a cultivator is at when nothing else is true. */
    | 'their_practice'
    /**
     * Sitting with a dao rather than with an art.
     *
     * Distinct from `their_practice`, and the distinction is the one
     * `understanding.ts` already draws: an art is worked at and a dao is
     * comprehended, they accumulate on different clocks, and somebody at this
     * is doing the thing no amount of diligence substitutes for. Dao ground and
     * the places that teach one already exist, so somebody at it is somewhere
     * the player could also sit.
     */
    | 'comprehending'
    /**
     * Nothing, on purpose.
     *
     * A specific state a specific person is in, and never a fallback. The whole
     * complaint this field answers was four hundred people at nothing by
     * default.
     */
    | 'idle'
    /**
     * One of them is taking something off the other.
     *
     * Not a fight and not a conversation. The bottom of a house is its own
     * society with its own order in it, and that order is enforced by people
     * who have nothing except being three months senior - a junior disciple
     * relieved of a find, a stall told what its rent is now, a debt collected
     * that was never lent. It is the commonest scene in the outer sect of the
     * genre and the world had no way to say it was happening.
     *
     * SYMMETRIC LIKE EVERY OTHER SCENE. Both people are at `squeezing` and both
     * name the other in `withIds`; which end of it they are on is in the note,
     * because the engine does not need to know and the narrator does. Nothing
     * switches on who is squeezing whom - a caller that needs to know reads
     * `howHardTheyPush` on both of them, which is where it came from.
     */
    | 'squeezing';

export interface NpcActivity {
    kind: ActivityKind;
    /**
     * What they are actually at, in words. The thing itself, not the category.
     *
     * The same shape `NpcGoal.text` has and for the same reason: the KIND is
     * what the engine reasons about and the note is what a person would say
     * they were doing. "Sitting over the third form and not getting it" and
     * "copying out a borrowed manual before it has to go back" are both
     * `their_practice`, and the difference between them is the whole of what
     * makes a square worth standing in.
     *
     * Written by whoever set the activity - the seeder writes plain ones, the
     * narrator can write better - and stored verbatim.
     */
    note: string;
    /**
     * Everybody else in it, by id. Empty for the things one person does alone.
     *
     * Symmetric by construction: everybody named here names everybody else,
     * so the scene reads the same whichever of them was walked up to.
     */
    withIds: string[];
    /** The day they started it, so a world can tell a habit from a moment. */
    sinceDay: number;
    /**
     * The day it ends, for the things that have an end.
     *
     * Null for the ordinary activities, which stop when somebody stops - a
     * person at a table is at a table until they are not. A SENDING has a term:
     * the house said forty days and the party is away for forty days, and
     * without a date on it nothing could tell a party still out from a party
     * that never came home.
     *
     * A day and not a countdown, because a countdown has to be decremented by
     * somebody and the thing that forgets is the thing that strands a party in
     * a province forever.
     */
    untilDay?: number | null;
    /**
     * Where they were standing when it started, for the things that take you
     * somewhere.
     *
     * Null for everything that happens where you already are. An errand needs
     * it because HOME IS NOT A HOUSE'S SEAT: a disciple who lives in a village
     * and is sent out has to come back to the village. Sending everybody to
     * their house's front door instead emptied settlements one party at a time,
     * which `demography.test.ts` catches as a settlement with nobody in it.
     */
    returnTo?: string | null;
}

export interface NpcCultivation {
    realmOrdinal: number;
    spiritRoot: SpiritRootKey;
    attributes: InnateAttributes;
    /**
     * Foundation is a history, not a rank: 'stable', 'unstable', 'damaged',
     * 'exceptional', 'incomplete', 'rebuilt'. Two people at the same ordinal
     * can have very different futures and the record must be able to say why.
     */
    foundation: string;
    /**
     * How many of the wounds below are still untreated.
     */
    untreatedInjuries: number;
    /**
     * WHAT THEY ARE ACTUALLY CARRYING, as rows rather than as a number.
     */
    injuries: Injury[];
    /**
     * WHAT IS STANDING IN THE BODY, as of `bodyOnDay`.
     */
    hp: number;
    /**
     * The day `hp` was last true. Mending runs forward from here on read.
     */
    bodyOnDay: number;
    /** Technique ids they can actually use. */
    techniqueIds: string[];
    /** Tags for environmental compatibility: 'fire', 'poison', 'soul', 'sword'. */
    specialties: string[];
    /** Absolute day their lifespan runs out at the current realm. */
    lifespanEndsOnDay: number;
    /** Absolute day of their most recent rank advance. Settling counts from here. */
    lastAdvancedOnDay: number;
    /**
     * Absolute day their current stock of progress started building.
     */
    accumulatingSinceDay: number;
}

export interface NpcRecord {
    id: string;
    name: string;
    identity: NpcIdentity;
    cultivation: NpcCultivation;

    locationId: string | null;
    /**
     * Which layer of the world this person is on.
     */
    layer: LayerKey;
    factionId: string | null;
    /** Index into the faction's rank ladder. -1 when unaffiliated. */
    factionRankIndex: number;

    /**
     * What they are actually holding.
     */
    spiritStones: number;

    goals: NpcGoal[];
    relationships: NpcRelationship[];

    /**
     * What they are at, right now, and who with.
     *
     * The design owner: *"they ought to all be doing something"*, *"you seed
     * activity and it changes obviously as they do something else"*, and *"like
     * a sect brother might be talking to a sect sister"*.
     *
     * STORED AND NOT DERIVED, which was the first cut and the wrong one. A
     * derived activity is a function of the roster and therefore the same every
     * time you look, which is a diorama rather than a world: the point is that
     * it CHANGES, and that the change is a thing that happened rather than a
     * different reading of the same row. It is seeded when the world opens and
     * rolled forward with everything else.
     *
     * `withIds` is the other half of it, and it is why this is a record rather
     * than a string. People at the same compound doing the same thing WITH each
     * other is the commonest scene in the genre, and it cannot be written as
     * independent facts without them disagreeing about whether it is happening.
     *
     * N PEOPLE AND NOT TWO. A conversation is two, a lesson is a master and
     * however many are sitting in front of them, a work party is as many as the
     * work takes, and a duel is two with a ring of people around it. Nothing
     * here caps it, and everybody in one names everybody else in it, so the
     * scene reads the same whichever of them you walked up to.
     *
     * Null for somebody nobody has ever looked at - a row the seeder has not
     * reached yet - and never as a way of saying they are idle. Doing nothing
     * is `'idle'`, which is a specific state a specific person is in.
     */
    activity: NpcActivity | null;

    /** Fact ids in the world ledger. The trajectory, as durable facts. */
    historyFactIds: string[];
    /** Memory record ids. What this person is carrying. */
    memoryIds: string[];

    status: ExistenceState;
    /**
     * Which body this identity currently occupies, when it is not their own.
     * Null for `alive` in the original body, and for states with no body at all.
     */
    bodyId: string | null;
    soulState: SoulState;
    /**
     * How much of the original person this actually is, 0..1.
     */
    identityContinuity: number;
    /** Absolute day of the transition out of `alive`. Not always a death. */
    diedOnDay: number | null;
    /** Factual note on how they ended. The narrator renders it; it is not lore. */
    endNote: string;

    /** Absolute day the record was last confirmed. Not a simulation cursor. */
    lastConfirmedOnDay: number;
    updatedOnDay: number;
    tags: string[];
    nextGoalSeq: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ONE ROW THE WORLD DOES NOT MOVE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The tag on the player's own row.
 */
export const PLAYER_ROW_TAG = 'the-player';

/**
 * Whether this record is the simulation's to decide things for.
 *
 * False for exactly one row in any world. Read at the four passes above; every
 * other pass may read and write this record freely.
 */
export function isTheWorldsToMove(npc: Pick<NpcRecord, 'tags'>): boolean {
    return !npc.tags.includes(PLAYER_ROW_TAG);
}

// ─────────────────────────────────────────────────────────────────────────
// CREATION
// ─────────────────────────────────────────────────────────────────────────

export interface CreateNpcOptions {
    id: string;
    /** Omit to have the engine roll a name. */
    name?: string;
    /**
     * Names already spoken for in this world. A rolled name is drawn to avoid
     * them, because the knowledge system is keyed by id and everything the
     * player reads is keyed by name - two people sharing one breaks the rule
     * that a name you were told is a name you have.
     */
    takenNames?: ReadonlySet<string>;
    bornOnDay: number;
    onDay: number;
    locationId?: string | null;
    /** Which layer they were born on. Omit for the lower world, as almost everybody is. */
    layer?: LayerKey;
    factionId?: string | null;
    factionRankIndex?: number;
    /** What they hold. Seeding passes what the life derivation actually left. */
    spiritStones?: number;
    occupation?: string;
    description?: string;
    /** Override the rolled talent. Used when importing an existing character. */
    cultivation?: Partial<NpcCultivation>;
    /**
     * Override the rolled origin. For importing an existing character only;
     * seeding never supplies it, because deciding where somebody was born is
     * the same act as deciding they matter.
     */
    origin?: OriginTierKey;
    /**
     * Override the rolled sex.
     */
    sex?: Sex;
    /**
     * A line this person carries, where somebody has decided they carry one.
     */
    bloodline?: Bloodline | null;
    /**
     * Override the rolled physique. For importing somebody who already exists.
     */
    physique?: PhysiqueKey | null;
    tags?: string[];
}

/**
 * Create an NPC record, with talent rolled by the engine.
 */
export function createNpc(seed: string, opts: CreateNpcOptions): NpcRecord {
    const rootRng = forStream(seed, 'npc-root', opts.id);
    const attrRng = forStream(seed, 'npc-attrs', opts.id);
    const nameRng = forStream(seed, 'npc-name', opts.id);
    // Its own named stream, so adding the axis did not perturb the root or the
    // attributes of any world that had already been seeded.
    const originRng = forStream(seed, 'npc-origin', opts.id);
    // The same discipline, and the same reason: a draw added to any stream
    // above this line would have shifted every root and every attribute in
    // every seeded world. Proved byte-identical rather than assumed - see
    // `tests/engine/world/everybody-has-a-sex.test.ts`.
    const sexRng = forStream(seed, 'npc-sex', opts.id);
    // The same discipline again, and it must stay the LAST stream declared and
    // the last draw taken: a stream added above any line here shifts every root
    // and every attribute in every world that has already been seeded.
    const physiqueRng = forStream(seed, 'npc-physique', opts.id);

    const root = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);
    const ordinal = clampOrdinal(opts.cultivation?.realmOrdinal ?? 0);

    // THE BODY, AND THE ONE THING THAT CAN TAKE IT BACK
    const rolled = opts.physique !== undefined
        ? physiqueOrNull(opts.physique)
        : rollPhysique(physiqueRng.next());
    const ageYearsNow = Math.max(0, (opts.onDay - opts.bornOnDay) / DAYS_PER_YEAR);
    const physique =
        rolled && lifespanWithPhysique(lifespanForOrdinal(ordinal), rolled) <= ageYearsNow
            ? null
            : rolled;

    const cultivation: NpcCultivation = {
        realmOrdinal: ordinal,
        spiritRoot: root.key,
        attributes,
        foundation: 'incomplete',
        untreatedInjuries: 0,
        injuries: [],
        // Whole, at the rung they are placed on. Nobody is born or seeded
        // already spent, and the pool is the one derivation rather than a
        // number chosen here.
        hp: maxHpForOrdinal(attributes.might, ordinal),
        bodyOnDay: opts.onDay,
        techniqueIds: [],
        specialties: root.elements.slice(),
        lifespanEndsOnDay: opts.bornOnDay
            + lifespanWithPhysique(lifespanForOrdinal(ordinal), physique) * DAYS_PER_YEAR,
        lastAdvancedOnDay: opts.onDay,
        accumulatingSinceDay: opts.onDay,
        ...(opts.cultivation ?? {})
    };
    // Recompute the derived fields if the caller overrode the ordinal but not
    // them. Both are functions of the rung and neither may be stored
    // inconsistently with it - a seeded elder placed at ordinal 29 with a
    // newborn's pool would read as a body nine tenths spent.
    if (opts.cultivation?.lifespanEndsOnDay === undefined) {
        cultivation.lifespanEndsOnDay =
            opts.bornOnDay
            + lifespanWithPhysique(lifespanForOrdinal(cultivation.realmOrdinal), physique)
              * DAYS_PER_YEAR;
    }
    if (opts.cultivation?.hp === undefined) {
        cultivation.hp = maxHpForOrdinal(
            cultivation.attributes.might,
            cultivation.realmOrdinal
        );
    }

    return {
        id: opts.id,
        name: opts.name ?? personName(nameRng, opts.takenNames),
        identity: {
            bornOnDay: opts.bornOnDay,
            origin: opts.origin ?? rollOrigin(originRng.next()).key,
            sex: opts.sex ?? rollSex(sexRng.next()),
            physique: physique?.key ?? null,
            bloodline: opts.bloodline ?? null,
            occupation: opts.occupation ?? 'unknown',
            titles: [],
            aliases: [],
            description: opts.description ?? ''
        },
        cultivation,
        locationId: opts.locationId ?? null,
        layer: opts.layer ?? DEFAULT_LAYER,
        factionId: opts.factionId ?? null,
        factionRankIndex: opts.factionRankIndex ?? (opts.factionId ? 0 : -1),
        spiritStones: Math.max(0, Math.round(opts.spiritStones ?? 0)),
        goals: [],
        relationships: [],
        // Null until the seeder reaches them. Never a way of saying idle.
        activity: null,
        historyFactIds: [],
        memoryIds: [],
        status: 'alive',
        bodyId: null,
        soulState: 'intact',
        identityContinuity: 1,
        diedOnDay: null,
        endNote: '',
        lastConfirmedOnDay: opts.onDay,
        updatedOnDay: opts.onDay,
        tags: opts.tags ?? [],
        nextGoalSeq: 1
    };
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATES
// All pure. Take a record, return a new one. Persistence is at the edges.
// ─────────────────────────────────────────────────────────────────────────

export function setLocation(npc: NpcRecord, locationId: string | null, onDay: number): NpcRecord {
    return { ...npc, locationId, updatedOnDay: onDay, lastConfirmedOnDay: onDay };
}

export function setFaction(
    npc: NpcRecord,
    factionId: string | null,
    rankIndex: number,
    onDay: number
): NpcRecord {
    return {
        ...npc,
        factionId,
        factionRankIndex: factionId ? rankIndex : -1,
        updatedOnDay: onDay
    };
}

// THE BODY

/**
 * The pool this person holds at the rung they are standing on.
 *
 * Derived every time rather than stored, so it cannot disagree with the ordinal
 * on the row next to it. See `hp` for why that is the direction taken.
 */
export function maxBodyOf(npc: NpcRecord): number {
    return maxHpForOrdinal(npc.cultivation.attributes.might, npc.cultivation.realmOrdinal);
}

/**
 * What is actually standing in the body on a given day.
 */
export function bodyStandingOn(npc: NpcRecord, day: number): number {
    const max = maxBodyOf(npc);
    // A record with no body on it reads as WHOLE, never as empty. Saves written
    // before the world held one load that way out of the repository, and a
    // fixture assembled by hand in a test has the same nothing on it - and the
    // failure mode of reading it as zero is a whole population of corpses that
    // no assertion in the file would be looking for.
    const stored = npc.cultivation.hp;
    const held = Number.isFinite(stored) ? Math.max(0, Math.min(max, stored)) : max;
    const anchor = Number.isFinite(npc.cultivation.bodyOnDay) ? npc.cultivation.bodyOnDay : day;
    const days = Math.max(0, day - anchor);
    if (days === 0 || held >= max) return held;
    return Math.min(max, Math.floor(held + max * HP_RECOVERY_FRACTION_PER_DAY * days));
}

/**
 * Take something out of the body, and stamp the day it was taken.
 */
export function bodyTaken(npc: NpcRecord, amount: number, onDay: number): NpcRecord {
    const standing = bodyStandingOn(npc, onDay);
    const left = Math.max(0, standing - Math.max(0, Math.round(amount)));
    return {
        ...npc,
        cultivation: { ...npc.cultivation, hp: left, bodyOnDay: onDay },
        updatedOnDay: onDay
    };
}

/**
 * Move a cultivator up the ladder.
 */
export function setRealm(npc: NpcRecord, ordinal: number, onDay: number): NpcRecord {
    const realmOrdinal = clampOrdinal(ordinal);
    const wasMax = maxBodyOf(npc);
    const nowMax = maxHpForOrdinal(npc.cultivation.attributes.might, realmOrdinal);
    return {
        ...npc,
        cultivation: {
            ...npc.cultivation,
            realmOrdinal,
            hp: carriedAcross(bodyStandingOn(npc, onDay), wasMax, nowMax),
            bodyOnDay: onDay,
            // The rung moved and the body did not. `lifespanWithPhysique` is
            // read at every stamp rather than folded in once, so a physique
            // is still worth what it is worth after a crossing.
            lifespanEndsOnDay:
                npc.identity.bornOnDay
                + lifespanWithPhysique(
                    lifespanForOrdinal(realmOrdinal),
                    physiqueOrNull(npc.identity.physique)
                ) * DAYS_PER_YEAR,
            lastAdvancedOnDay: onDay,
            // A new rung is a new requirement and nothing carries over.
            accumulatingSinceDay: onDay
        },
        updatedOnDay: onDay
    };
}

/**
 * Add wounds to a record and keep the count honest.
 */
export function carryingWounds(
    npc: NpcRecord,
    added: readonly Injury[],
    onDay: number
): NpcRecord {
    if (added.length === 0) return npc;
    const injuries = [...npc.cultivation.injuries, ...added];
    return {
        ...npc,
        cultivation: {
            ...npc.cultivation,
            injuries,
            untreatedInjuries: untreatedInjuryCount(injuries)
        },
        updatedOnDay: onDay
    };
}

/**
 * The wounds to hand to anything that prices a body.
 */
export function woundsCarriedBy(npc: NpcRecord): Injury[] {
    const rows = npc.cultivation.injuries;
    const shortfall = Math.max(0, Math.floor(npc.cultivation.untreatedInjuries))
        - untreatedInjuryCount(rows);
    if (shortfall <= 0) return [...rows];
    return [
        ...rows,
        ...Array.from({ length: shortfall }, (_, i) => ({
            id: `${npc.id}-carried-${i}`,
            severity: 'serious' as const,
            source: 'combat' as const,
            description: 'A wound they were already carrying.',
            sustainedOnTurn: 0,
            treated: false,
            cultivationPenalty: 0.25,
            breakthroughPenalty: 0.15,
            // Null because there is genuinely nothing to name. This row was
            // reconstructed from a count, and a count does not remember what it
            // was counting.
            woundType: null
        }))
    ];
}

export interface GoalInput {
    kind: GoalKind;
    text: string;
    priority?: number;
    progress?: string;
    obstacles?: string[];
    deadlineOnDay?: number | null;
    targetId?: string | null;
    note?: string;
}

export function addGoal(npc: NpcRecord, input: GoalInput, onDay: number): NpcRecord {
    const goal: NpcGoal = {
        id: `${npc.id}-g${npc.nextGoalSeq}`,
        kind: input.kind,
        text: input.text,
        priority: clamp01(input.priority ?? 0.5),
        progress: input.progress ?? '',
        obstacles: input.obstacles ?? [],
        deadlineOnDay: input.deadlineOnDay ?? null,
        status: 'active',
        targetId: input.targetId ?? null,
        openedOnDay: onDay,
        closedOnDay: null,
        note: input.note ?? '',
        inheritedFromId: null,
        originHolderId: npc.id,
        generation: 0
    };
    return {
        ...npc,
        goals: npc.goals.concat(goal),
        nextGoalSeq: npc.nextGoalSeq + 1,
        updatedOnDay: onDay
    };
}

export function closeGoal(
    npc: NpcRecord,
    goalId: string,
    status: Exclude<GoalStatus, 'active'>,
    onDay: number,
    note = ''
): NpcRecord {
    return {
        ...npc,
        goals: npc.goals.map(g =>
            g.id === goalId ? { ...g, status, closedOnDay: onDay, note: note || g.note } : g
        ),
        updatedOnDay: onDay
    };
}

export function activeGoals(npc: NpcRecord): NpcGoal[] {
    return npc.goals
        .filter(g => g.status === 'active' || g.status === 'blocked')
        .sort((a, b) => b.priority - a.priority || a.openedOnDay - b.openedOnDay || (a.id < b.id ? -1 : 1));
}

export interface RelationshipInput {
    targetId: string;
    targetName: string;
    kind: RelationshipKind;
    standing: number;
    note?: string;
    factIds?: string[];
    inheritedFromId?: string | null;
}

/**
 * Create or update a tie.
 */
export function upsertRelationship(
    npc: NpcRecord,
    input: RelationshipInput,
    onDay: number
): NpcRecord {
    const at = npc.relationships.findIndex(r => r.targetId === input.targetId);
    const next = npc.relationships.slice();
    if (at >= 0) {
        const prev = next[at];
        next[at] = {
            ...prev,
            kind: input.kind,
            standing: clampStanding(input.standing),
            note: input.note ?? prev.note,
            lastChangedDay: onDay,
            factIds: mergeIds(prev.factIds, input.factIds ?? []),
            inheritedFromId: input.inheritedFromId ?? prev.inheritedFromId
        };
    } else {
        next.push({
            targetId: input.targetId,
            targetName: input.targetName,
            kind: input.kind,
            standing: clampStanding(input.standing),
            note: input.note ?? '',
            sinceDay: onDay,
            lastChangedDay: onDay,
            factIds: (input.factIds ?? []).slice(),
            inheritedFromId: input.inheritedFromId ?? null
        });
    }
    next.sort((a, b) => (a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0));
    return { ...npc, relationships: next, updatedOnDay: onDay };
}

export function adjustStanding(
    npc: NpcRecord,
    targetId: string,
    delta: number,
    onDay: number,
    note?: string
): NpcRecord {
    const at = npc.relationships.findIndex(r => r.targetId === targetId);
    if (at < 0) return npc;
    const next = npc.relationships.slice();
    next[at] = {
        ...next[at],
        standing: clampStanding(next[at].standing + delta),
        note: note ?? next[at].note,
        lastChangedDay: onDay
    };
    return { ...npc, relationships: next, updatedOnDay: onDay };
}

export function relationshipWith(npc: NpcRecord, targetId: string): NpcRelationship | null {
    return npc.relationships.find(r => r.targetId === targetId) ?? null;
}

/** Everyone this person has an active account with, worst first. */
export function enemiesOf(npc: NpcRecord, threshold = -0.4): NpcRelationship[] {
    return npc.relationships
        .filter(r => r.standing <= threshold)
        .sort((a, b) => a.standing - b.standing || (a.targetId < b.targetId ? -1 : 1));
}

/** Link a world fact to this NPC. The trajectory is a list of these. */
export function recordFact(npc: NpcRecord, factId: string, onDay: number): NpcRecord {
    if (npc.historyFactIds.includes(factId)) return npc;
    return {
        ...npc,
        historyFactIds: npc.historyFactIds.concat(factId),
        updatedOnDay: onDay,
        lastConfirmedOnDay: Math.max(npc.lastConfirmedOnDay, onDay)
    };
}

export function attachMemory(npc: NpcRecord, memoryId: string, onDay: number): NpcRecord {
    if (npc.memoryIds.includes(memoryId)) return npc;
    return { ...npc, memoryIds: npc.memoryIds.concat(memoryId), updatedOnDay: onDay };
}

export function detachMemories(npc: NpcRecord, memoryIds: readonly string[], onDay: number): NpcRecord {
    const drop = new Set(memoryIds);
    return {
        ...npc,
        memoryIds: npc.memoryIds.filter(id => !drop.has(id)),
        updatedOnDay: onDay
    };
}

/**
 * The body is gone.
 */
export function markDead(npc: NpcRecord, onDay: number, endNote: string): NpcRecord {
    return {
        ...ruinSoul(npc, 'fading'),
        status: 'physically_dead',
        diedOnDay: onDay,
        endNote,
        updatedOnDay: onDay,
        lastConfirmedOnDay: onDay,
        goals: npc.goals.map(g =>
            g.status === 'active' || g.status === 'blocked'
                ? { ...g, status: 'impossible' as GoalStatus, closedOnDay: onDay }
                : g
        )
    };
}

/**
 * Nobody has seen them.
 */
export function markMissing(npc: NpcRecord, onDay: number, endNote = ''): NpcRecord {
    return {
        ...npc,
        status: 'missing',
        endNote: endNote || npc.endNote,
        updatedOnDay: onDay
    };
}

export interface ExistenceTransition {
    to: ExistenceState;
    onDay: number;
    bodyId?: string | null;
    soulState?: SoulState;
    /** What survived the transition. Often not all of it. */
    identityContinuity?: number;
    note?: string;
}

/**
 * Change the mode of existence.
 */
export function setExistence(npc: NpcRecord, t: ExistenceTransition): NpcRecord {
    const leavingLife = npc.status === 'alive' && t.to !== 'alive';
    return {
        ...reconcileSoulAndSelf({
            ...npc,
            soulState: t.soulState ?? npc.soulState,
            identityContinuity: t.identityContinuity !== undefined
                ? Math.max(0, Math.min(1, t.identityContinuity))
                : npc.identityContinuity
        }),
        status: t.to,
        bodyId: t.bodyId !== undefined ? t.bodyId : npc.bodyId,
        diedOnDay: leavingLife && npc.diedOnDay === null ? t.onDay : npc.diedOnDay,
        endNote: t.note ?? npc.endNote,
        updatedOnDay: t.onDay,
        lastConfirmedOnDay: t.to === 'missing' || t.to === 'unknown'
            ? npc.lastConfirmedOnDay
            : t.onDay
    };
}

/**
 * Goals that should be handed on when this person stops being able to pursue them.
 */
export function legacyGoals(npc: NpcRecord, minPriority = 0.5): NpcGoal[] {
    return npc.goals
        .filter(
            g =>
                g.priority >= minPriority &&
                (g.status === 'impossible' || g.status === 'active' || g.status === 'blocked')
        )
        .sort((a, b) => b.priority - a.priority || a.openedOnDay - b.openedOnDay || (a.id < b.id ? -1 : 1));
}

/**
 * Take up somebody else's unfinished business.
 */
export function inheritGoals(
    heir: NpcRecord,
    goals: readonly NpcGoal[],
    fromId: string,
    onDay: number
): NpcRecord {
    let next = heir;
    let seq = heir.nextGoalSeq;
    const added: NpcGoal[] = [];
    for (const goal of goals) {
        if (heir.goals.some(g => g.originHolderId === goal.originHolderId && g.text === goal.text)) {
            continue;
        }
        added.push({
            ...goal,
            id: `${heir.id}-g${seq++}`,
            status: 'active',
            closedOnDay: null,
            inheritedFromId: fromId,
            originHolderId: goal.originHolderId,
            generation: goal.generation + 1,
            note: goal.note || `Inherited from ${fromId} on day ${onDay}.`,
            obstacles: goal.obstacles.slice()
        });
    }
    if (added.length === 0) return heir;
    next = {
        ...heir,
        goals: heir.goals.concat(added),
        nextGoalSeq: seq,
        updatedOnDay: onDay
    };
    return next;
}

/** Update where a goal has got to, and what is still in the way. */
export function updateGoal(
    npc: NpcRecord,
    goalId: string,
    patch: { progress?: string; obstacles?: string[]; priority?: number; deadlineOnDay?: number | null },
    onDay: number
): NpcRecord {
    return {
        ...npc,
        goals: npc.goals.map(g =>
            g.id === goalId
                ? {
                    ...g,
                    progress: patch.progress ?? g.progress,
                    obstacles: patch.obstacles ?? g.obstacles,
                    priority: patch.priority !== undefined ? clamp01(patch.priority) : g.priority,
                    deadlineOnDay:
                        patch.deadlineOnDay !== undefined ? patch.deadlineOnDay : g.deadlineOnDay
                }
                : g
        ),
        updatedOnDay: onDay
    };
}

// ─────────────────────────────────────────────────────────────────────────
// READING
// ─────────────────────────────────────────────────────────────────────────

export function ageInYears(npc: NpcRecord, onDay: number): number {
    return Math.floor((onDay - npc.identity.bornOnDay) / DAYS_PER_YEAR);
}

export function yearsToLifespanEnd(npc: NpcRecord, onDay: number): number {
    return (npc.cultivation.lifespanEndsOnDay - onDay) / DAYS_PER_YEAR;
}

export interface NpcBrief {
    id: string;
    name: string;
    rank: string;
    ageYears: number;
    locationId: string | null;
    factionId: string | null;
    status: ExistenceState;
    /** What they are currently trying to do, highest priority first. */
    goals: {
        text: string;
        kind: GoalKind;
        priority: number;
        progress: string;
        obstacles: string[];
        deadlineInDays: number | null;
        status: GoalStatus;
        yearsOpen: number;
        generation: number;
    }[];
    /**
     * Ties that matter, strongest feeling first.
     */
    relationships: {
        name: string;
        whoTheyAreNow?: string;
        kind: RelationshipKind;
        standing: number;
        note: string;
    }[];
    /** Ids of the most recent facts about them. The trajectory, compactly. */
    recentFactIds: string[];
    memoryIds: string[];
    /** Days since this record was last confirmed. Stale records are a fact. */
    staleDays: number;
}

/**
 * The compact bundle the LLM is handed to reason about this person.
 */
export function npcBrief(
    npc: NpcRecord,
    onDay: number,
    recentFacts = 6,
    relationshipLimit = 8,
    roster: readonly NpcRecord[] = []
): NpcBrief {
    const byId = new Map(roster.map(n => [n.id, n]));
    return {
        id: npc.id,
        name: npc.name,
        rank: rankName(npc.cultivation.realmOrdinal),
        ageYears: ageInYears(npc, onDay),
        locationId: npc.locationId,
        factionId: npc.factionId,
        status: npc.status,
        goals: activeGoals(npc).map(g => ({
            text: g.text,
            kind: g.kind,
            priority: g.priority,
            progress: g.progress,
            obstacles: g.obstacles.slice(),
            deadlineInDays: g.deadlineOnDay === null ? null : g.deadlineOnDay - onDay,
            status: g.status,
            yearsOpen: Math.floor((onDay - g.openedOnDay) / DAYS_PER_YEAR),
            generation: g.generation
        })),
        relationships: npc.relationships
            .slice()
            .sort((a, b) =>
                Math.abs(b.standing) - Math.abs(a.standing) || (a.targetId < b.targetId ? -1 : 1)
            )
            .slice(0, relationshipLimit)
            .map(r => ({
                name: r.targetName,
                ...(roster.length > 0
                    ? { whoTheyAreNow: whoTheyAreNow(byId.get(r.targetId) ?? null, r.targetName).description }
                    : {}),
                kind: r.kind,
                standing: r.standing,
                note: r.note
            })),
        recentFactIds: npc.historyFactIds.slice(-recentFacts),
        memoryIds: npc.memoryIds,
        staleDays: Math.max(0, onDay - npc.lastConfirmedOnDay)
    };
}

/** Environmental profile for the location layer's compatibility check. */
export function environmentProfile(npc: NpcRecord): {
    specialties: string[];
    vulnerabilities: string[];
} {
    return {
        specialties: npc.cultivation.specialties.slice(),
        vulnerabilities: (npc.tags.filter(t => t.startsWith('vuln:')) ?? []).map(t => t.slice(5))
    };
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function clampStanding(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(-1, Math.min(1, n));
}

function mergeIds(a: readonly string[], b: readonly string[]): string[] {
    const out = a.slice();
    for (const id of b) if (!out.includes(id)) out.push(id);
    return out;
}
