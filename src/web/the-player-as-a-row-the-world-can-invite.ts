/**
 * THE PLAYER, AS A ROW THE WORLD CAN PUT ON AN INVITATION LIST.
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
 *   THE FIVE GUARDS, on the passes that decide something FOR a cultivator, each
 *   of which skips a row carrying {@link PLAYER_ROW_TAG} - asked through
 *   `isTheWorldsToMove`, which is the one predicate for it:
 *
 *       applyAdvancement       a second climb, and a chronicled breakthrough
 *                              that never happened
 *       the lifespan pass      the player's death, declared by the world clock
 *       applyRecruitment       enrolment in a house they never walked into
 *       applyBookAcquisition   a manual they never earned
 *       the house payroll      a stipend paid into a purse that is not the one
 *                              the player spends out of
 *       creditMerit            service counted onto a row whose count is the
 *                              membership's, and is overwritten from it
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHICH FIELDS THE SHEET OWNS, AND WHAT A WRITE TO ONE OF THEM COSTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The refresh below writes these off the `Cultivator` every turn, so they are
 * the sheet's and a world write to any of them is thrown away unread:
 *
 *     the purse         `spiritStones`
 *     the body          rung, root, attributes, foundation, hp, wounds (both
 *                       the count and the rows), lifespan
 *     the arts          `techniqueIds`
 *     the standing      `factionId`, `factionRankIndex` and `merit`, off the
 *                       sect repository's membership - its `contribution` IS
 *                       the player's merit, in the same units
 *     the ending        `status`, `diedOnDay`, `endNote`, where the sheet says
 *                       they are dead
 *
 * MEASURED, which is why the fifth guard exists: with the player on a roll and
 * nothing else touching them, the world's economy pass paid their row 540
 * stones over sixty years and 1,080 over a hundred and twenty, in two pinned
 * worlds. Every one of them was written and wiped, and the one field that
 * drifted was the purse - rung, wounds, arts, house and rank all held.
 *
 * So the rule for the world layer is one line: a pass may read any of these and
 * may write NONE of them on this row. What the player is owed reaches them
 * through the play layer, which writes the sheet - the stipend through
 * `sect_manage.stipend`, a lift through `whatALiftTook`, a sale through the
 * counter. Everything the row carries that is NOT on the list above - who knows
 * them, what is owed them, what they are at, what a house has decided about
 * them - is the world's, and is left alone.
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
import { lifespanCeilingFor } from '../engine/cultivation/survival.js';
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
    /**
     * What the house counts in their favour, off the membership: the one store
     * of it for the player. The row's `merit` is written from this, in the same
     * units the world's own people carry
     * (`what-a-house-counts-in-somebodys-favour.ts`).
     */
    contribution?: number;
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
        // The body, from the sheet that owns it. The row stores what is
        // STANDING and derives the pool from the rung, so only the first half
        // crosses; a player who just paid a realm boundary's toll is met by the
        // world at what the wall left them, the same as anybody else. Anchored
        // to today, because the sheet's figure is true now and mending is
        // already the sheet's own business - see `time-skip.ts`.
        hp: cultivator.hp,
        bodyOnDay: onDay,
        techniqueIds: cultivator.knownTechniques.slice(),
        // The BODY's ceiling, not the rung's. Written from `lifespanForOrdinal`
        // it was the one physique-blind mirror row in the world - harmless only
        // because `time.ts` skips the player when it collects the day's dead,
        // so the row was wrong and nothing read it. Everybody else's row comes
        // off `lifespanWithPhysique` in `npc-state.ts`; this is the same answer
        // with the immortal status folded in as well.
        lifespanEndsOnDay:
            bornOnDay + Math.round(lifespanCeilingFor(cultivator) * DAYS_PER_YEAR),
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
        // Nowhere, except while the house has them standing at a post. See THE
        // ROW STANDS NOWHERE above: presence is the play layer's, and the one
        // thing the WORLD has to know is which of its posts are held - it fills
        // the empty ones (`applyPostings`), reading who is `stationed` and
        // where, and a post the player holds read as empty is the house paying
        // for two people to watch one town. So the stamp a posting writes
        // (`theOneBeingPlayedStandsAtThisPost`) survives the refresh, and
        // nothing else does: the moment the tour ends or they walk off it, the
        // activity is cleared and this is null again.
        //
        // Of the four defects a location on this row caused, three are already
        // answered where they were caused - `everybodyDrawingHere` dedupes by
        // id, so crowding counts one person once - and the fourth is answered
        // in `othersPresent`, which no longer hands the player their own row
        // back as somebody else standing here.
        locationId: base.activity?.kind === 'stationed' ? base.locationId : null,
        layer: MORTAL_LAYER,
        factionId: house.factionId,
        factionRankIndex: house.factionId === null ? -1 : Math.max(0, house.rankIndex),
        // What their house counts for them, projected like everything else the
        // sheet owns. A count for a house they are not on the roll of reads as
        // none, which is what the world's own rows do when somebody moves.
        merit: house.factionId === null
            ? null
            : { houseId: house.factionId, points: Math.max(0, Math.round(house.contribution ?? 0)) },
        spiritStones: Math.max(0, Math.round(cultivator.spiritStones)),
        // Death is the cultivation engine's to declare and it declares it on
        // the sheet - so the sheet is read here in this direction as in every
        // other, rather than `alive` being written unconditionally.
        //
        // It used to be. That was true for as long as nothing put a player's
        // death into the world at all, and it became a resurrection the moment
        // something did: `estate-settlement.ts` marks this row dead, and the
        // refresh at the end of the same turn wrote `alive` straight back over
        // it. Where the sheet says dead, whatever ended the row is left exactly
        // as whoever ended it wrote it - the status, the day and the note are
        // theirs, and a projection has no business editing an ending.
        status: cultivator.alive ? 'alive' : base.status,
        diedOnDay: cultivator.alive ? null : base.diedOnDay,
        endNote: cultivator.alive ? '' : base.endNote,
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
