/**
 * What becomes of a house's people when they leave its roll other than by
 * choosing to, and where the world's rogues come from in numbers.
 *
 * `rogues.ts` says rogues are most of the player's peers, and `WHY_UNAFFILIATED`
 * names where they come from: refused, born too far from a gate, thrown out, and
 * the sect that stopped existing. The world had none of the last two. A house
 * that fell cut its people loose with a bare `factionId: null` in three places,
 * nobody was ever thrown out, and a house that was destroyed killed everybody
 * below the line and left nobody to scatter - Nine Peaks ended with nobody.
 *
 * ── THE CATALOG'S OWN ACCOUNT, WHICH THIS FOLLOWS ────────────────────────
 *
 * `WHAT_FALLS_ON_THOSE_BELOW.andTheOnesWhoLeave` in `catastrophe.ts`: *"Some go
 * home ... Some walk to the next sect and learn that a disciple of a dead house
 * is a person with a partial curriculum and no standing, taken in a grade below
 * where they stood. Some do not stop walking, which is where rogue cultivators
 * come from in numbers."* Three ways, and two of them are a rogue: going home is
 * being on no roll where you were born, and not stopping is being on no roll on
 * the road. So a fallen house's people are taken in by the next house one time
 * in {@link THE_WAYS_A_FALLEN_HOUSES_PEOPLE_GO}, where a house in the province
 * would take them at all, and are rogues otherwise.
 *
 * ── AND WHO FALLS WHEN A HOUSE IS DESTROYED ──────────────────────────────
 *
 * Not everybody below the line. Somebody far beneath the height that came is at
 * real risk and somebody near it mostly gets out, which is the same per-person
 * reading an errand's losses take (`lostChance` off `regardFor`): each person's
 * own rung against the attacker's. The rest flee, and are rogues.
 *
 * ── WHAT IT PRODUCES ─────────────────────────────────────────────────────
 *
 * On `afford-a` at 5,000 years, of the 60 people on no roll at Foundation or
 * above, 21 came off a house that fell and 1 off one that was destroyed, against
 * 29 thrown out by a room. Before this a destroyed house killed everybody under
 * the line and left nobody to scatter - Nine Peaks ended with nobody - and a
 * fallen house's people were cut loose with a bare `factionId: null` in three
 * places, which the world's own intake then took straight back.
 *
 * ── EXCEPT THE ONES WHO DO NOT GO ────────────────────────────────────────
 *
 * Both readings above assume everybody was trying to leave. A minority are not:
 * they stand and fall with a house that is finished rather than scatter, more of
 * them in a family house and a righteous one, and they are the only people in
 * this file who are neither taken in nor on the road. Who they are is
 * `who-goes-down-with-the-house.ts`; both doors out of a house read it.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { WHAT_A_HOUSE_WILL_STOMACH } from './why-one-cultivator-kills-another.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { regardFor } from '../cultivation/regard.js';
import { whoAHouseWillTake } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { isBelowTheLid } from './layers.js';
import { setLocation, type NpcRecord } from './npc-state.js';
import { theSpeciesItIs } from './a-beast-with-a-core-is-somebody-in-particular.js';
import { theMarketOf } from './where-somebody-with-no-house-goes.js';
import { regionOf } from './what-people-are-saying.js';
import { lostChance } from './who-goes-out-for-a-house-and-what-comes-back.js';
import { STAYED_WITH, wouldGoDownWithTheHouse } from './who-goes-down-with-the-house.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** The tag every rogue row carries, naming how they came to be on no roll. */
export const ROGUE = 'rogue:';
/** Placed on no roll at world open. */
export const ROGUE_SEEDED = `${ROGUE}seeded`;
/** Fled a house that was destroyed. Followed by the house id. */
export const ROGUE_FLED = `${ROGUE}fled:`;
/** On no roll because the house stopped existing. Followed by the house id. */
export const ROGUE_HOUSE_FELL = `${ROGUE}house-fell:`;
/** Thrown out by their house's punishment room. Followed by the house id. */
export const ROGUE_EXPELLED = `${ROGUE}expelled:`;

/**
 * The rung somebody stood on the day they came off a roll, written beside the
 * tag that says why.
 *
 * WHAT IT IS FOR: telling a rogue who was MINTED at height from one who CLIMBED
 * there afterwards. The design owner, on the count of people above the Beast
 * Change with no house: *"figure out how rogues are getting there and if it
 * makes sense"* - and the two roads deserve opposite answers. A fallen house's
 * elder standing at thirty-five is the genre working; somebody who climbed from
 * nothing to thirty-five with no house behind them probably should not exist.
 * The tags said which road, and nothing said where they were standing when they
 * took it.
 *
 * Read by the probe, and by nothing that decides anything.
 */
export const CAME_OFF_A_ROLL_AT = 'came-off-a-roll-at:';

/**
 * A RECORD IS AN OPINION, NOT A WALL.
 *
 * `aRecordFollowsThem` was read once, in the recruitment pass, as a filter on
 * the candidate pool: anybody a house had ever expelled was struck off every
 * intake in the world, for ever, with no read of WHO was looking or why. Put
 * beside the outside-elder door, which could not reach anybody stronger than
 * the house doing the hiring, that left a person a house turned out with no way
 * back onto any roll for a life that runs tens of thousands of years.
 *
 * It is also a player-facing dead end: the punishment room can expel the one
 * being played, and the expose route the owner called the normal way a seat
 * changes hands has expulsion as one of its three outcomes. A filter with no
 * opinion in it would end that character's institutional life on the spot.
 *
 * So the record is read the way a house reads anything else about a stranger:
 *
 *   is it even known here   somebody on this roll has to hold the row about it.
 *                           A record is a thing people know, not a mark on a
 *                           forehead, and a house four provinces away has not
 *                           heard. {@link theRecordIsKnownHere}.
 *   what the house makes    `WHAT_A_HOUSE_WILL_STOMACH`, the same table that
 *   of it                   decides how far a house's people will go for a deed
 *                           - righteous almost never, neutral sometimes,
 *                           demonic without blinking. A demonic house reading an
 *                           expulsion from a righteous one as a recommendation
 *                           falls out of that table rather than being written
 *                           in as a special case.
 *
 * And it is a story on both sides: {@link whatTakingInSomebodysCastOffStirs}.
 */
export const A_RECORD_IS_STILL_TALKED_ABOUT = 8;

/** Whether anybody on this roll holds a row about what this person did. */
export function theRecordIsKnownHere(
    state: WorldState,
    npc: Pick<NpcRecord, 'id' | 'historyFactIds'>,
    houseId: string
): boolean {
    const theirs = new Set(npc.historyFactIds.slice(-A_RECORD_IS_STILL_TALKED_ABOUT));
    if (theirs.size === 0) return false;
    for (const other of state.npcs) {
        if (other.id === npc.id || other.factionId !== houseId || other.status !== 'alive') continue;
        if (other.historyFactIds.some(id => theirs.has(id))) return true;
    }
    return false;
}

/** The house that turned them out, or null. */
export function whichHouseTurnedThemOut(npc: Pick<NpcRecord, 'tags'>): string | null {
    const tag = npc.tags.find(t => t.startsWith(ROGUE_EXPELLED));
    return tag === undefined ? null : tag.slice(ROGUE_EXPELLED.length) || null;
}

/**
 * Whether this house would take somebody a record follows, having heard of it.
 *
 * True for everybody nothing is known about, which is nearly everybody.
 */
export function aHouseWouldTakeThemAnyway(
    state: WorldState,
    npc: NpcRecord,
    house: Pick<FactionRecord, 'id' | 'alignment'>,
    rng: CultivationRNG
): boolean {
    if (!aRecordFollowsThem(npc)) return true;
    if (!theRecordIsKnownHere(state, npc, house.id)) return true;
    const stomach = WHAT_A_HOUSE_WILL_STOMACH[String(house.alignment ?? 'none')]
        ?? WHAT_A_HOUSE_WILL_STOMACH.none!;
    return rng.chance(stomach.ordinary);
}

/** What one house taking in what another threw out moves, by how far apart they stand. */
export const WHAT_TAKING_IN_A_CAST_OFF_COSTS = 0.12;

/**
 * A house takes in somebody another house turned out, and the two of them feel
 * it. Not a transfer: the genre treats this as a story, and the house that did
 * the expelling reads it as a house siding with somebody it condemned.
 */
export function whatTakingInSomebodysCastOffStirs(
    state: WorldState,
    npc: Pick<NpcRecord, 'id' | 'name' | 'tags'>,
    house: Pick<FactionRecord, 'id' | 'name' | 'alignment'>,
    day: number
): void {
    const turnedOut = whichHouseTurnedThemOut(npc);
    if (turnedOut === null || turnedOut === house.id) return;
    const them = state.factions.find(f => f.id === turnedOut && f.dissolvedOnDay === null);
    if (them === undefined) return;
    // Further apart, harder felt: a demonic house taking in what a righteous one
    // condemned is the case the genre is made of.
    const apart = String(them.alignment ?? 'none') === String(house.alignment ?? 'none') ? 0.5 : 1;
    const move = WHAT_TAKING_IN_A_CAST_OFF_COSTS * apart;
    them.standing[house.id] = Number(
        Math.max(-1, (them.standing[house.id] ?? 0) - move).toFixed(3));
    appendWorldFact(state, makeFact({
        day,
        kind: 'grudge_opened',
        scale: 'local',
        summary: `The ${house.name} took in ${npc.name}, whom the ${them.name} had put off its roll.`,
        actors: [{ id: npc.id, name: npc.name, role: 'taken in' }],
        locationId: null,
        factionIds: [house.id, them.id],
        visibility: 'regional',
        magnitude: 0.3,
        data: {
            unattributed: 'A hall that turned somebody out has heard where they went, and it is not pleased.'
        }
    }));
}

/** The rung they stood on when they came off a roll, or null where nothing says. */
export function whereTheyStoodWhenTheyCameOff(npc: Pick<NpcRecord, 'tags'>): number | null {
    const tag = npc.tags.find(t => t.startsWith(CAME_OFF_A_ROLL_AT));
    if (tag === undefined) return null;
    const at = Number(tag.slice(CAME_OFF_A_ROLL_AT.length));
    return Number.isFinite(at) ? at : null;
}

/**
 * Whether a register would show a house why not to take this person on.
 *
 * `WHY_UNAFFILIATED` in `rogues.ts`: *"A record that follows them ... Gates are
 * where registers are read, so a bad register means no gate."* Being thrown out
 * of a house is the record. Without this the world's intake took its rogues
 * back: at two and a half thousand years a world held five people on no roll at
 * Foundation or above, because everybody thrown out of a hall was on another
 * one within a lifetime.
 */
export function aRecordFollowsThem(npc: Pick<NpcRecord, 'tags'>): boolean {
    return npc.tags.some(t => t.startsWith(ROGUE_EXPELLED));
}

/**
 * Home, the next sect, or the road: the catalog's three ways, of which the next
 * sect is one.
 */
export const THE_WAYS_A_FALLEN_HOUSES_PEOPLE_GO = 3;

/**
 * Somebody off their roll and on their own, standing where they will stand next.
 *
 * The one writer for leaving a roll other than by walking out: `factionId` and
 * the rung cleared, the tag saying why, and nothing taken off them - they keep
 * their ties, their accounts, their arts and what they know.
 */
export function offTheRoll(npc: NpcRecord, day: number, tag: string, toLocationId?: string | null): NpcRecord {
    const moved = toLocationId === undefined || toLocationId === null ? npc : setLocation(npc, toLocationId, day);
    return {
        ...moved,
        factionId: null,
        factionRankIndex: -1,
        tags: Array.from(new Set([...moved.tags, tag,
            `${CAME_OFF_A_ROLL_AT}${npc.cultivation.realmOrdinal}`])),
        activity: {
            kind: 'their_own_business',
            note: 'On their own, and on nobody\'s roll.',
            withIds: [],
            sinceDay: day,
            untilDay: null,
            returnTo: null
        },
        updatedOnDay: day
    };
}

/**
 * Whether somebody the attacker's height came for falls, or gets out.
 *
 * The minority who would not walk away from this house do not get out: they
 * stand where they are and fall with it, whatever their rung against the
 * height that came. See `who-goes-down-with-the-house.ts`.
 */
export function whetherTheyFall(state: WorldState, npc: NpcRecord, attackerOrdinal: number, day: number): boolean {
    const house = npc.factionId === null
        ? undefined
        : state.factions.find(f => f.id === npc.factionId);
    if (house !== undefined && wouldGoDownWithTheHouse(state.seed, npc, house)) return true;
    return forStream(state.seed, 'a-house-destroyed', npc.id, day)
        .chance(lostChance(regardFor(attackerOrdinal, npc.cultivation.realmOrdinal)));
}

/** Where somebody running from a house goes: the market of its province, or nowhere new. */
export function whereTheyRunTo(state: WorldState, house: FactionRecord): string | null {
    const province = regionOf(state, house.seatLocationId);
    return province === null ? null : theMarketOf(state, province)?.id ?? null;
}

/**
 * A live house in the fallen one's province that would take this person in at
 * its bottom rung, or null.
 *
 * The same floors the world's own intake reads - the admission rung, the sex a
 * house takes, and nobody stronger than everybody already on its roll - and not
 * a house at war with the one that fell.
 */
export function whoWouldTakeThemIn(
    state: WorldState,
    fallen: FactionRecord,
    npc: NpcRecord,
    strongest: ReadonlyMap<string, number>
): FactionRecord | null {
    const province = regionOf(state, fallen.seatLocationId);
    if (province === null) return null;
    const ordinal = npc.cultivation.realmOrdinal;
    const houses = state.factions.filter(f =>
        f.id !== fallen.id && f.dissolvedOnDay === null && isBelowTheLid(f) && f.tags.includes('recruits')
        && f.seatLocationId !== null && regionOf(state, f.seatLocationId) === province
        && ordinal >= Number(f.resources.admission_ordinal ?? 0)
        && (whoAHouseWillTake(f.id) ?? npc.identity.sex) === npc.identity.sex
        && ordinal <= (strongest.get(f.id) ?? -1)
        && (f.standing[fallen.id] ?? 0) > -0.3
    ).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (houses.length === 0) return null;
    return houses[forStream(state.seed, 'the-next-house', npc.id).int(0, houses.length - 1)]!;
}

/** What happened to a fallen house's people. */
export interface WhereTheyWent {
    takenIn: { npcId: string; houseId: string }[];
    rogues: string[];
    /**
     * The minority who did not scatter: off the roll like everybody else,
     * because there is no roll, but standing where the house stood and carrying
     * {@link STAYED_WITH}. See `who-goes-down-with-the-house.ts`.
     */
    stayed: string[];
}

/**
 * Release everybody still on a house's roll: the next house takes some, and the
 * rest are rogues. Writes the rows; returns who went where.
 */
export function releaseTheRoll(state: WorldState, house: FactionRecord, day: number, tag: string): WhereTheyWent {
    const out: WhereTheyWent = { takenIn: [], rogues: [], stayed: [] };
    const strongest = new Map<string, number>();
    for (const n of state.npcs) {
        if (n.status !== 'alive' || n.factionId === null) continue;
        strongest.set(n.factionId, Math.max(strongest.get(n.factionId) ?? -1, n.cultivation.realmOrdinal));
    }
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.factionId !== house.id || npc.status !== 'alive' || theSpeciesItIs(npc) !== null) continue;
        // THE ONES WHO DO NOT SCATTER, FIRST. Somebody who would go down with
        // this house is not looking for the next hall and is not on the road:
        // they stay where it stood. The roll is gone either way, so what is
        // written is where they are and the tag saying why.
        if (wouldGoDownWithTheHouse(state.seed, npc, house)) {
            state.npcs[i] = offTheRoll(npc, day, `${STAYED_WITH}${house.id}`, house.seatLocationId);
            out.stayed.push(npc.id);
            continue;
        }
        const next = forStream(state.seed, 'a-fallen-houses-people', npc.id, day).chance(1 / THE_WAYS_A_FALLEN_HOUSES_PEOPLE_GO)
            ? whoWouldTakeThemIn(state, house, npc, strongest)
            : null;
        if (next !== null) {
            state.npcs[i] = { ...npc, factionId: next.id, factionRankIndex: 0, updatedOnDay: day };
            out.takenIn.push({ npcId: npc.id, houseId: next.id });
        } else {
            state.npcs[i] = offTheRoll(npc, day, `${tag}${house.id}`);
            out.rogues.push(npc.id);
        }
    }
    return out;
}
