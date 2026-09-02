/**
 * THE PLAYER, AS A ROW THE WORLD CAN PUT ON AN INVITATION LIST.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `gatherings.ts` draws its attendees from `chosenOf`, which reads
 * `state.npcs`. Below the Lid the player has never had an `NpcRecord` - they
 * are a `Cultivator` row and an `Observer` and nothing else - so they were
 * STRUCTURALLY UNINVITABLE. Not "rarely invited": absent from the list the
 * invitation is drawn from, permanently, at every rung and in every house.
 *
 * The whole gathering system - introductions across houses, friendly bouts,
 * ranked competitions with prestige and selection upward, expeditions into a
 * site with several houses' chosen scored against each other - could not
 * include the person playing. That is this repository's signature defect
 * (AGENTS.md: "the world's rules must bind the player too") in a system that
 * is otherwise finished and tested.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE PRECEDENT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `residentAbove` in `above.ts` solved exactly this above the Lid, and the
 * shape it chose is the one followed here: materialise one row WITH THE SAME
 * ID AS THE CULTIVATOR, so lineage edges, grudges, obligations, history facts
 * and object provenance all keep resolving against one identity instead of
 * quietly becoming two people. Nothing here is a second identity model. It is
 * the same person, written in the vocabulary the world layer speaks.
 *
 * The two halves compose rather than overlap: `residentAbove` owns the player
 * once `canExistBeyondTheLid` is true, and this function stands down at
 * exactly that point.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE HAZARD, AND WHAT ACTUALLY PREVENTS IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A row on the roster is a row the simulation will try to move. If the world
 * advanced this one the way it advances everybody, the player would climb the
 * ladder twice - once in `time-skip.ts` where their progress actually lives,
 * and again in `applyAdvancement` - and their sheet and their row would drift
 * apart until nothing could tell which was the character.
 *
 * Two things stop it, and they are deliberately different in kind:
 *
 *   THE REFRESH, which is this function. Every span, before the world moves,
 *   the row is OVERWRITTEN from the authoritative `Cultivator`: rung,
 *   attributes, root, wounds, arts, purse, house, rank, where they are
 *   standing, whether they are alive. So no write the world made to it last
 *   span can survive into this one, and drift is not corrected, it is
 *   structurally impossible. The character sheet is the source and the row is
 *   a projection of it, in that order, always.
 *
 *   THE FOUR GUARDS, on the passes that decide something FOR a cultivator, each
 *   of which skips a row carrying {@link PLAYER_ROW_TAG}:
 *
 *       applyAdvancement       a second climb, and a chronicled breakthrough
 *                              that never happened
 *       the lifespan pass      the player's death, declared by the world clock
 *       applyRecruitment       enrolment in a house they never walked into
 *       applyBookAcquisition   a manual they never earned
 *
 *   The refresh alone would undo every RECORD those write. Two of them append a
 *   FACT on the way, which a refresh cannot take back, and the other two draw a
 *   RANDOM INDEX over the roster - so a row sitting in their candidate lists
 *   shifts every draw after it and quietly reseeds the world. That second
 *   reason is the one to remember: any pass sampling the roster by index needs
 *   the guard even where the write itself would be harmless.
 *
 * Everything else the world does to this row is left alone on purpose. Being
 * met, being ranked, being disliked, being owed something, being named in
 * somebody's goal, being at a gathering - those are the point. Deciding
 * something for them is the only thing the world does not get to do.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ROW STANDS NOWHERE, AND THAT IS DELIBERATE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `locationId` is null and is never set. The row is a MEMBERSHIP - somebody
 * the world can name, invite, rank and resent - and it is emphatically not a
 * second account of where the player is standing. Presence belongs to the play
 * layer, which has always owned it and reads `cultivator.location`.
 *
 * This was arrived at by giving the row a location and watching what happened.
 * `npcsAt` is used all over both layers to mean "the other people here", and
 * every one of those call sites predates the row and adds the player back
 * explicitly where they are wanted. In one afternoon, one honest `locationId`
 * produced four separate defects:
 *
 *     the crowding term counted the player twice - `groundFor` appends them
 *     after `npcsAt`, and crowding is the largest multiplier in the model
 *     `othersPresent` returned the player to themselves, so `somebodyAtHand`
 *     could pick them as an opponent and a bout wrote one set of wound rows
 *     twice under one id
 *     a headcount of the square went up by one
 *     a persistence test looking for "somebody only the world holds" found the
 *     player instead
 *
 * None of those is a bug in those callers. They are what a second source of
 * presence costs, and the cheapest place to stop paying it is here. Nothing
 * the row exists for needs a location: `chosenOf` reads status, layer, faction
 * and tags, and a gathering seats people by id.
 *
 * `npc-state.ts` already documents an unknown location as a legitimate state,
 * for the same underlying reason - a person's whereabouts is a fact the world
 * may simply not hold. If something later genuinely needs the world to know
 * where the player is standing, that is a design decision with the four
 * consequences above attached to it, and it should be taken deliberately
 * rather than by setting a field.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { canExistBeyondTheLid } from '../engine/cultivation/existence.js';
import { MORTAL_LAYER } from '../engine/world/layers.js';
import { lifespanForOrdinal } from '../engine/cultivation/realms.js';
import {
    createNpc,
    PLAYER_ROW_TAG,
    type NpcRecord
} from '../engine/world/npc-state.js';
import { getNpc, upsertNpc, type WorldState } from '../engine/world/world-state.js';

/** Days in a year, for turning an age into a birth day on the world clock. */
const DAYS_PER_YEAR = 365;

/** Where this cultivator stands in a house, as the sect repository holds it. */
export interface StandingInAHouse {
    factionId: string | null;
    /** Index into the house's rank ladder. -1 when unaffiliated. */
    rankIndex: number;
}

/**
 * Put the player on the roster, or refresh the row that is already there.
 *
 * Idempotent, cheap, and safe to call before every span - which is how it is
 * called. Returns the row, or null when the player is not the lower world's to
 * hold: above the Lid `residentAbove` owns them, and nothing here may touch a
 * row on the immortal layer.
 */
export function standInTheWorld(
    state: WorldState,
    cultivator: Cultivator,
    house: StandingInAHouse,
    onDay: number
): NpcRecord | null {
    // The far side is `above.ts`'s. Writing a mortal-layer row over an
    // immortal one would put a True Immortal back in the province, which is
    // the one thing `evaluateLidTransit` exists to price.
    if (canExistBeyondTheLid(cultivator)) return null;

    const existing = getNpc(state, cultivator.id);
    if (existing && existing.layer !== MORTAL_LAYER) return null;

    const bornOnDay = Math.max(0, Math.floor(onDay - cultivator.age * DAYS_PER_YEAR));

    // Everything the world layer stores about a body, read off the sheet that
    // owns it. `untreatedInjuries` is the world's integer count and `injuries`
    // is the row list; both are set from the same source so a reader of either
    // sees the same wounds. See AGENTS.md on the count/row mismatch.
    const cultivation = {
        realmOrdinal: cultivator.realmOrdinal,
        spiritRoot: cultivator.spiritRoot,
        attributes: cultivator.attributes,
        foundation: cultivator.foundationQuality,
        untreatedInjuries: cultivator.injuries.length,
        injuries: cultivator.injuries.slice(),
        techniqueIds: cultivator.knownTechniques.slice(),
        lifespanEndsOnDay:
            bornOnDay + lifespanForOrdinal(cultivator.realmOrdinal) * DAYS_PER_YEAR,
        lastAdvancedOnDay: onDay,
        accumulatingSinceDay: onDay
    };

    const base = existing ?? createNpc(state.seed, {
        id: cultivator.id,
        name: cultivator.name,
        bornOnDay,
        onDay,
        layer: MORTAL_LAYER,
        origin: cultivator.origin,
        sex: cultivator.sex,
        occupation: 'the one being played',
        tags: [PLAYER_ROW_TAG]
    });

    const row: NpcRecord = {
        ...base,
        name: cultivator.name,
        // The sheet wins here as it wins everywhere else on this row. A sex
        // rolled onto the row at creation and a sex on the sheet would be two
        // answers about one person, and the header's rule is that the sheet is
        // the source and the row is a projection of it, in that order, always.
        identity: {
            ...base.identity,
            bornOnDay,
            origin: cultivator.origin,
            sex: cultivator.sex
        },
        // Merged rather than replaced: `specialties`, and anything the record
        // shape grows later, belong to the world layer and are not on the
        // sheet. What the sheet owns, the sheet wins.
        cultivation: { ...base.cultivation, ...cultivation },
        // Nowhere, always. See THE ROW STANDS NOWHERE above: presence is the
        // play layer's and a second copy of it here costs more than it buys.
        locationId: null,
        layer: MORTAL_LAYER,
        factionId: house.factionId,
        factionRankIndex: house.factionId === null ? -1 : Math.max(0, house.rankIndex),
        spiritStones: Math.max(0, Math.round(cultivator.spiritStones)),
        // The player is alive for as long as there is a run. Death is the
        // cultivation engine's to declare and it declares it on the sheet.
        status: 'alive',
        diedOnDay: null,
        endNote: '',
        // The tag is what the two simulation guards read. It is never dropped,
        // and a house tagging this row `chosen` adds to it rather than
        // replacing it - which is how the player gets invited at all.
        tags: base.tags.includes(PLAYER_ROW_TAG)
            ? base.tags
            : [...base.tags, PLAYER_ROW_TAG],
        lastConfirmedOnDay: onDay,
        updatedOnDay: onDay
    };

    Object.assign(state, upsertNpc(state, row));
    return row;
}
