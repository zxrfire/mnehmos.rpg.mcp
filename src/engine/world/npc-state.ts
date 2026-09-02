/**
 * NPCs as small durable records.
 *
 * This is storage, not simulation. There is no tick loop here, no behaviour
 * tree, no per-NPC decision model, and no scheduler that wakes anybody up. The
 * LLM is the reasoning engine: given an NPC's record it can work out what that
 * person would do. The database's job is to make sure the record is still there
 * in thirty years and still says the same thing.
 *
 * The whole required shape is eight fields:
 *
 *   identity        who they are
 *   cultivation     where they stand on the ladder, and what they were dealt
 *   location        where they are
 *   faction         who they answer to
 *   goals           what they are currently trying to do
 *   relationships   who they are bound to, and how
 *   history         fact ids in the world ledger - what has happened to them
 *   memories        memory record ids - what they are carrying
 *
 * A trajectory is therefore stored as A FEW DURABLE FACTS rather than as a
 * simulated life: current goals plus recent significant events. "He has spent
 * eleven years trying to get into the Cold Kiln Hall and has been refused
 * twice" is two goal rows and two fact ids, and it is enough for the LLM to
 * reason about what he does when the player offers him a way in. Simulating
 * those eleven years would produce the same sentence at a thousand times the
 * cost.
 *
 * ── What the engine still owns ────────────────────────────────────────────
 *
 * Randomness. Talent is rolled here, from the run seed, via the cultivation
 * engine's own `rollSpiritRoot` and `rollAttributes` - never by the LLM, which
 * would unconsciously pick the answer it wanted. Everything stochastic about an
 * NPC comes out of `forStream(seed, ...)` and is reproducible.
 */

import { forStream } from '../cultivation/rng.js';
import { reconcileSoulAndSelf, ruinSoul } from '../cultivation/how-much-of-a-person-is-left.js';
import { whoTheyAreNow } from './reading-a-tie-against-the-roster.js';
import { clampOrdinal, lifespanForOrdinal, rankName } from '../cultivation/realms.js';
import {
    rollAttributes,
    rollSpiritRoot,
    type InnateAttributes,
    type SpiritRootKey
} from '../cultivation/spirit-roots.js';
import { rollOrigin, type OriginTierKey } from '../cultivation/origin.js';
import { rollSex, type Sex } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import type { Bloodline } from './hunting-a-spirit-beast.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { untreatedInjuryCount } from '../cultivation/injuries.js';
import type { Injury } from '../../schema/cultivation.js';
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
 *
 * A goal is durable state and is the main thing the LLM reads to decide how
 * somebody behaves. It carries its own history - when it was opened, what
 * blocked it, when it closed - because "he has wanted this for forty years" is
 * a fact about the world and not a mood.
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
     *
     * A goal does not end with its holder. A disciple continues the revenge; a
     * descendant inherits the search. Three hundred years later the goal can
     * still be live, and the chain back to whose it originally was is what makes
     * that legible rather than arbitrary.
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
 *
 * `standing` runs -1 (wants them dead) to +1 (would die for them). It is a
 * stored number rather than an inferred one so that a grudge opened in year 744
 * still reads -0.9 in year 812, and so that inheritance can carry it forward
 * without anyone having to re-derive why.
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
 *
 * At low realms `body destroyed = dead`. Above Nascent Soul that equivalence
 * breaks, and a cultivator stops being one body plus one row plus one
 * continuous physical existence. A person is a persistent identity that may
 * occupy several physical states over time.
 *
 * `missing` and `unknown` are the two this layer cares about most, and they are
 * NOT placeholders for a decision the engine is avoiding. They are correct
 * answers. If a cultivator vanishes into a ruin the engine does not have to
 * adjudicate what happened to them, and the world may hold several incompatible
 * beliefs at once - died, soul escaped, reincarnated, in seclusion, sealed,
 * became a remnant - with the truth genuinely unresolved until something
 * settles it. The belief side lives in the social layer; the unresolved fact
 * lives in `history.ts` with `truth: 'unresolved'`; this field is where the
 * person's own record says "nobody knows".
 *
 *     year 50     a powerful cultivator disappears        missing
 *     year 500    still missing                           missing
 *     year 2000   civilisation treats them as long dead   missing (belief: dead)
 *     year 4000   a sealed body is found                  sealed
 *     year 4020   they wake, memories and grudges intact  alive
 *
 * Absence is not removal. A dead or missing character's inheritance, remnant,
 * disciples, descendants, enemies, artifacts, techniques and reputation keep
 * acting on the world: death changes their mode of existence, it does not take
 * them out of the simulation.
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
     *
     * This is also the honest explanation for why a Dao house has the members
     * it does: nobody is assigned to one. Origins are rolled, the weights are
     * the same weights, and the derivation that follows spends what the birth
     * actually supplied. It carries no rank - an NPC born into one still has to
     * have walked the ladder to be anywhere on it.
     */
    origin: OriginTierKey;
    /**
     * A plain fact, carried so a child can have two parents.
     *
     * `what-sex-somebody-is-and-what-it-is-for.ts` is the whole of the design
     * and the short version is that it answers a PARENTAGE question and nothing
     * else. It has no authority over who may match with whom - the household
     * layer neither imports this nor names it, and a test scans that directory
     * for the vocabulary - and nothing anywhere branches on it except
     * `canBeTheTwoParentsOf`.
     */
    sex: Sex;
    /**
     * What a line left in them, or null for the overwhelming majority.
     *
     * A species ability that came down from an ancestor who was a beast before
     * it was a person, at the strength it has diluted to. `AbilityTier` and its
     * ladder are `hunting-a-spirit-beast.ts`'s and are not restated here; what
     * this field adds is a place for the answer to live, which is what that
     * whole half of the design was missing.
     *
     * Two carriers hold the line, one carrier and an outsider steps it down,
     * and it is gone in three generations. **Every one of those sentences is
     * `bloodlineTierForChild`'s** - nothing here decides any of it, and there is
     * no dilution constant on this record or anywhere near it.
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
     *
     * Kept as a stored field because the roster view, the repo and the web
     * layer all read it, and derived from `injuries` at every write in this
     * layer - see `carryingWounds`. It is a cache of a count, never a second
     * opinion about what somebody is carrying.
     */
    untreatedInjuries: number;
    /**
     * WHAT THEY ARE ACTUALLY CARRYING, as rows rather than as a number.
     *
     * The world layer kept only the count, and everything that needed a wound
     * fabricated one: `combatantOf` in `gatherings.ts` and the opponent stub in
     * `combat-manage.ts` both expanded the integer into that many identical
     * generic `Injury` objects with `woundType: null`, because there was nothing
     * else to expand it into.
     *
     * That made a whole authored layer unreachable from the world. A broken
     * foundation, a cracked core, an imperfect tribulation body and an
     * unfinished cultivation base are rows in `data/cultivation/wounds.ts`
     * with names, permanence
     * and stated treatments, and `what-goes-wrong-at-a-realm-boundary.ts`
     * decides which one a failed crossing leaves - but no NPC could hold any of
     * it, so the population the setting most wanted could not exist: somebody
     * who struck at a wall, cracked, survived, and is standing at their rung
     * finished.
     *
     * Ordinary wounds live here too. One list, two natures, exactly as
     * `InjurySchema.woundType` describes - a second list beside this one is a
     * list nothing downstream would read.
     */
    injuries: Injury[];
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
     *
     * TWO CLOCKS RUN AT A RUNG AND THEY ARE NOT THE SAME CLOCK.
     * `lastAdvancedOnDay` is the settling clock: how long they have been stuck
     * here at all, and a plateau longer than the realm allows ends the climb.
     * This one is the accumulation clock: how much of the next rung's
     * requirement they are currently holding.
     *
     * A failed crossing burns part of what was accumulated and leaves the
     * settling clock alone - so this moves and that does not. Without the
     * distinction a failure at a high rung costs nothing but a review cycle,
     * and somebody who reached the wall once would strike at it every twelve
     * years until it opened, which turns a thousand-year crossing into a
     * formality.
     *
     * Zero means "the same as `lastAdvancedOnDay`", which is the honest reading
     * of every row written before the world struck at anything.
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
     *
     * Stored rather than derived from `locationId`, because the question "who
     * is above the Lid" has to keep having an answer for somebody whose
     * location is unknown - and because a person's layer is a fact about them
     * rather than about where they were last seen. Ascension is the only thing
     * that changes it, and it changes nothing else about the record: the same
     * id, the same lineage edges, the same grudges, the same history. See
     * `layers.ts` and `immortal-world.ts`.
     */
    layer: LayerKey;
    factionId: string | null;
    /** Index into the faction's rank ladder. -1 when unaffiliated. */
    factionRankIndex: number;

    /**
     * What they are actually holding.
     *
     * Not invented for a roster: it is what `deriveOrdinal` already spent a
     * whole life computing - an origin's purse, plus a stipend, minus the
     * upkeep of every year at a rank and every pill bought on the way - and
     * then discarded. Without it nobody in the world held a single stone, so
     * nothing could be bought, sold, stolen, bribed, inherited or extorted and
     * the economy content had no participants at all.
     */
    spiritStones: number;

    goals: NpcGoal[];
    relationships: NpcRelationship[];

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
     *
     * A remnant is not the person. A will, a projection, an obsession, a
     * recorded consciousness or an inheritance guardian may say "I was the
     * founder of this sect" without being the founder's consciousness, and that
     * distinction is frequently the whole point of the encounter - so it is
     * preserved in state rather than left to the narrator to remember.
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
 *
 * Below the Lid the player had no `NpcRecord` at all, which made them
 * structurally invisible to every system keyed on the roster - most sharply to
 * `gatherings.ts`, whose entire invitation list is drawn from `state.npcs`, so
 * the person playing could not be invited to anything. `web/the-player-as-a-
 * row-the-world-can-invite.ts` puts one there, with the SAME ID as the
 * cultivator, the way `residentAbove` already does above the Lid.
 *
 * A row on the roster is a row the simulation will try to move, and that is the
 * one thing it must not do here: the player's rung, wounds and lifespan live on
 * their `Cultivator` sheet and are advanced by `time-skip.ts`. A world pass
 * that also advanced them would climb the ladder twice and write a chronicle
 * entry for a breakthrough that never happened.
 *
 * So the row is REFRESHED from the sheet at the top of every turn, which makes
 * drift impossible - and the four passes that decide something FOR a cultivator
 * skip it by this tag:
 *
 *     applyAdvancement       would climb the ladder a second time, and would
 *                            chronicle a breakthrough that never happened
 *     the lifespan pass      would declare the player dead mid-run
 *     applyRecruitment       would enrol them in a house they never entered
 *     applyBookAcquisition   would hand them a manual they never earned
 *
 * The last two also matter for reproducibility rather than only for
 * correctness: both draw a RANDOM INDEX over the roster, so a row sitting in
 * their candidate lists shifts every draw after it and quietly reseeds the
 * world. Any pass that samples the roster by index needs this guard even where
 * the write itself would be harmless.
 *
 * Everything else the world does to this row is deliberately left alone. Being
 * met, ranked, resented, owed something, named in a goal or seated at a
 * gathering is the entire point of it being there.
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
     *
     * Supplied by the two callers that already know the answer: a birth, which
     * has two parents and a child of theirs, and anything importing a person
     * who already exists. Seeding leaves it alone and takes the roll.
     */
    sex?: Sex;
    /**
     * A line this person carries, where somebody has decided they carry one.
     *
     * Nobody is born with one by accident: the world writes it at a birth from
     * `bloodlineForChild`, and the catalog writes it on the people descended
     * from something that changed. There is no roll here and there must not be
     * one - a rolled bloodline would put fire in a farm family for no reason
     * anybody could trace.
     */
    bloodline?: Bloodline | null;
    tags?: string[];
}

/**
 * Create an NPC record, with talent rolled by the engine.
 *
 * Spirit root and attributes come out of the run seed through the cultivation
 * engine's own roll functions, in separate named sub-streams keyed on the id.
 * That matters for a reason beyond reproducibility: if the LLM chose these, it
 * would give the interesting NPC the good root every time, and the world's
 * distribution of talent would quietly become a distribution of narrative
 * convenience.
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

    const root = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);
    const ordinal = clampOrdinal(opts.cultivation?.realmOrdinal ?? 0);

    const cultivation: NpcCultivation = {
        realmOrdinal: ordinal,
        spiritRoot: root.key,
        attributes,
        foundation: 'incomplete',
        untreatedInjuries: 0,
        injuries: [],
        techniqueIds: [],
        specialties: root.elements.slice(),
        lifespanEndsOnDay: opts.bornOnDay + lifespanForOrdinal(ordinal) * DAYS_PER_YEAR,
        lastAdvancedOnDay: opts.onDay,
        accumulatingSinceDay: opts.onDay,
        ...(opts.cultivation ?? {})
    };
    // Recompute the derived field if the caller overrode the ordinal but not it.
    if (opts.cultivation?.lifespanEndsOnDay === undefined) {
        cultivation.lifespanEndsOnDay =
            opts.bornOnDay + lifespanForOrdinal(cultivation.realmOrdinal) * DAYS_PER_YEAR;
    }

    return {
        id: opts.id,
        name: opts.name ?? personName(nameRng, opts.takenNames),
        identity: {
            bornOnDay: opts.bornOnDay,
            origin: opts.origin ?? rollOrigin(originRng.next()).key,
            sex: opts.sex ?? rollSex(sexRng.next()),
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

/**
 * Move a cultivator up the ladder.
 *
 * Recomputes lifespan and resets the settling clock, because both are functions
 * of the realm and neither should ever be stored inconsistently with it.
 */
export function setRealm(npc: NpcRecord, ordinal: number, onDay: number): NpcRecord {
    const realmOrdinal = clampOrdinal(ordinal);
    return {
        ...npc,
        cultivation: {
            ...npc.cultivation,
            realmOrdinal,
            lifespanEndsOnDay:
                npc.identity.bornOnDay + lifespanForOrdinal(realmOrdinal) * DAYS_PER_YEAR,
            lastAdvancedOnDay: onDay,
            // A new rung is a new requirement and nothing carries over.
            accumulatingSinceDay: onDay
        },
        updatedOnDay: onDay
    };
}

/**
 * Add wounds to a record and keep the count honest.
 *
 * The ONE write path for `injuries`, so `untreatedInjuries` cannot drift from
 * the list it is a count of. Everything in the world layer that hurts somebody
 * comes through here: a bout at a gathering, a failed crossing, a tribulation.
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
 *
 * Rows where the world has them, and generic stand-ins only for a shortfall
 * between the stored count and the stored list. That shortfall is legacy: rows
 * written before wounds were kept as rows have a count and no list, and a
 * combat resolver that ignored them would quietly heal every NPC in an old save
 * on load. It is the last home of the fabrication that used to live in two
 * callers, and it shrinks to nothing as saves turn over.
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
 *
 * Merges rather than replaces: the `sinceDay` of an existing relationship is
 * preserved, so a forty-year friendship that turns hostile is still forty years
 * old. That is the whole reason betrayal reads as betrayal.
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
 *
 * Note what this does NOT do: it does not close the record, and above Nascent
 * Soul it may not even be the end of the person. Goals are marked `impossible`
 * for this holder specifically so that {@link legacyGoals} can pick them up and
 * hand them on - the goal is not deleted, because a disciple continuing a
 * revenge three hundred years later is the continuity the whole design is for.
 *
 * The soul goes through {@link ruinSoul} rather than being assigned, because
 * `soulState` and `identityContinuity` are two readings of one thing and this
 * function used to move only the first. Every corpse in a four-hundred-year run
 * - 2,054 of them - was a fading soul at 100% continuity, which is not a
 * borderline case but the two fields never having been joined.
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
 *
 * Not dead, not confirmed alive, and deliberately not adjudicated. Goals stay
 * ACTIVE, because a missing person's goals are not known to have stopped -
 * which is the difference between this and death, and is what makes the
 * fifty-year-old search still a live thread.
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
 *
 * The engine decides whether a transition is legal; the narrator interprets it.
 * Legality is not enforced here on purpose - `capability.ts` answers whether a
 * cultivator can do this, and this is the write path once the answer is yes, so
 * the check lives in one place instead of two that can disagree.
 *
 * Reconstruction and possession normally cost something: pass a lowered
 * `identityContinuity` and a `soulState` to say so. The rebuilt body is rarely
 * identical, and a powerful soul does not make every vessel suitable.
 *
 * A caller that passes only one of the two gets both moved. The soul is taken as
 * given and continuity is capped to what that soul can hold - see
 * `reconcileSoulAndSelf` - so a transition that fragments somebody cannot leave
 * them wholly themselves just because the caller did not think to say so.
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
 * Goals that should be handed on when this person stops being able to pursue
 * them.
 *
 * Anything that was live and mattered. Low-priority goals die with their
 * holder, which is correct: nobody inherits somebody else's intention to buy a
 * better cauldron.
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
 *
 * The goal keeps its ORIGINAL opening date, its progress and its obstacles, and
 * gains a generation. Three hundred years later the record still says when it
 * was opened and by whom, which is what makes an inherited revenge read as
 * inherited rather than as a fresh grievance somebody invented.
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
     *
     * `name` is what the tie stored. `whoTheyAreNow` is that name read against
     * the roster, and it is the field that stops the LLM being handed a master
     * who died two centuries ago as somebody it could go and talk to. Four ties
     * in five in an advanced world point at somebody who is not alive, so
     * without it the most common case renders as the rarest one.
     *
     * Present only when {@link npcBrief} was given a roster to read against.
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
 *
 * Deliberately small. An NPC's behaviour comes out of goals, relationships and
 * a handful of recent events; handing over the full record every time is how a
 * context window gets spent on nothing.
 *
 * Pass `roster` - the world's own `state.npcs` - and every tie is read against
 * it. Without it the brief says only the name a tie stored, which in an advanced
 * world is the wrong reading four times in five: 84% of all ties point at
 * somebody who is dead, missing or no longer in their own body, and an agent
 * handed "Chu Zhenkuan, master, +0.6" with nothing else will go looking for him.
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
