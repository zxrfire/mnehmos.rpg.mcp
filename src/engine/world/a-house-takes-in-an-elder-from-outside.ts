/**
 * A house whose office stands empty takes in an elder from outside.
 *
 * `a-house-and-who-is-in-it.md`: an external elder who joins is just an elder,
 * and a guest elder is an external elder without an office. The house doc's
 * vacancy runs in three steps - the holder dies or leaves, somebody senior
 * covers (`APortfolio.actingId`), the house fills the chair - and the chair is
 * filled from inside first (`assessPromotions`). This is the half that was
 * never built: the chair still empty after the year's promotions, and somebody
 * from outside taken in to it.
 *
 * WHO. Somebody standing past the bar an insider would be promoted at, by the
 * margin the owner ruled an outsider owes (`whatAnOutsiderMustStandAt`), free,
 * of no house, and within reach: a guest of this house first (`GUEST_OF`, which
 * is where `GUEST_ELDERS` and the elder path meet), then anybody in the house's
 * province. Strongest first. They start at the house's lowest elder rung with no
 * merit in it.
 *
 * WHAT IT COSTS, AND WHO PAYS. `externalElderCost` prices the insult in standing
 * for a player-run house, which a background house has no store of. What every
 * house does have is a treasury, so the price is paid in its stones: a year of
 * the catalog's stipend at the rung the elder is seated at, times the same
 * escalation `externalElderCost` applies for every elder the house has already
 * taken in from outside and still has.
 *
 * DECIDED BY SOMEBODY. A sect is not a sect, it is the people in it: the fact
 * names the head as who took them in, or the most senior person on the roll
 * where the head's chair is empty.
 */

import { getSect, stipendForRank } from '../../data/cultivation/sects.js';
import { COST_PER_EXTERNAL_ELDER, elderRungOf, externalElderCost } from '../cultivation/leadership.js';
import { rankName } from '../cultivation/realms.js';
import { STIPEND_PERIOD_DAYS } from '../cultivation/what-each-rung-of-a-house-ladder-requires.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { whoIsInChargeOfWhat } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { theSpeciesItIs } from './a-beast-with-a-core-is-somebody-in-particular.js';
import { makeFact } from './history.js';
import { isBelowTheLid } from './layers.js';
import { isTheWorldsToMove, setLocation, theCatalogStatesTheyAreStanding, type NpcRecord } from './npc-state.js';
import { whatAnOutsiderMustStandAt } from './promotion-inside-a-house.js';
import { GUEST_OF } from './the-wanderer-the-catalog-names-is-somebody.js';

/**
 * How far above its own strongest a house will reach for somebody from outside.
 *
 * One realm. Far enough that a house can take in a senior another house turned
 * out - which is the whole of what this constant is for - and not so far that a
 * hall of Core Formation disciples acquires an Immortal.
 */
export const HOW_FAR_ABOVE_ITS_OWN_A_HOUSE_WILL_REACH = 4;
import { regionOf } from './what-people-are-saying.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** Carried by somebody a house took in as an elder from outside, naming the house. */
export const TAKEN_IN_AS_AN_ELDER = 'taken-in-as-an-elder:';

const DAYS_PER_YEAR = 365;

/**
 * What taking in one more elder from outside costs this house, in stones, or
 * null for a house the catalog states no stipend for.
 */
export function whatTakingInAnElderCosts(houseId: string, rankIndex: number, alreadyTakenIn: number): number | null {
    if (!getSect(houseId)) return null;
    const monthly = stipendForRank(houseId, rankIndex);
    if (monthly <= 0) return null;
    const escalation = externalElderCost(1, alreadyTakenIn).standingCost / COST_PER_EXTERNAL_ELDER;
    return Math.ceil(monthly * (DAYS_PER_YEAR / STIPEND_PERIOD_DAYS) * escalation);
}

/** Whether a house has an office nobody of its own holds: covered, or with nobody in it. */
export function anOfficeStandsEmpty(state: Pick<WorldState, 'locations'>, house: FactionRecord, roll: readonly NpcRecord[]): boolean {
    const portfolios = whoIsInChargeOfWhat({
        rooms: theRoomsThisHouseHas(state.locations, house.id),
        roll: roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
        rankCount: house.ranks.length
    });
    return portfolios.some(p => p.holderId === null || (p.actingId ?? null) !== null);
}

/** The yearly pass. Returns how many were taken in. Mutates `state` in place. */
export function theHousesTakeInEldersFromOutside(state: WorldState, day: number): number {
    const rolls = new Map<string, NpcRecord[]>();
    const free: NpcRecord[] = [];
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        if (npc.factionId !== null) {
            const roll = rolls.get(npc.factionId);
            if (roll) roll.push(npc); else rolls.set(npc.factionId, [npc]);
        } else if (isTheWorldsToMove(npc) && npc.activity === null && theSpeciesItIs(npc) === null) {
            free.push(npc);
        }
    }
    if (free.length === 0) return 0;

    let takenIn = 0;
    const gone = new Set<string>();
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house) || house.seatLocationId === null) continue;
        const roll = rolls.get(house.id) ?? [];
        if (roll.length === 0) continue;
        const rankCount = house.ranks.length;
        const rung = Math.min(elderRungOf(rankCount), rankCount - 1);
        if (rung <= 0) continue;
        if (!anOfficeStandsEmpty(state, house, roll)) continue;

        const already = roll.filter(n => n.tags.includes(`${TAKEN_IN_AS_AN_ELDER}${house.id}`)).length;
        const price = whatTakingInAnElderCosts(house.id, rung, already);
        if (price === null || (house.resources.spirit_stones ?? 0) < price) continue;

        const admission = Number(house.resources.admission_ordinal ?? 0);
        const power = Number(house.resources.power_ordinal ?? admission);
        const bar = whatAnOutsiderMustStandAt(house.id, rung, rankCount, admission, power);
        const province = regionOf(state, house.seatLocationId);
        const guestTag = `${GUEST_OF}${house.id}`;
        // AND HOW FAR ABOVE ITS OWN A HOUSE WILL REACH.
        //
        // This read `<= strongestHere`: a house could never take anybody
        // stronger than its strongest, which stopped the Sweptground Temple
        // hiring the world's one False Immortal as its Quiet Elder in its tenth
        // year - and also shut the door on every senior any house ever expelled.
        // Measured on `afford-a` at five thousand years: of seventeen rogues
        // above ordinal 29, THIRTEEN were put there by a house - eight expelled,
        // four scattered when their house fell - and nobody could ever take them
        // back, for lives that run tens of thousands of years. A state with no
        // exit, accumulating for as long as the world runs.
        //
        // The genre is emphatic the other way: a strong cultivator turned out of
        // one house is exactly who a rival wants. So a house reaches one realm
        // past its own ceiling ({@link HOW_FAR_ABOVE_ITS_OWN_A_HOUSE_WILL_REACH})
        // and takes them the way the owner said such people come in - as a
        // GUEST elder, who keeps their own arts rather than learning the
        // house's. What it may still never do is take somebody a catalog states
        // is standing, which is the Quiet Elder case and the rule the world's
        // own passes already keep.
        const strongestHere = roll.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), -1);
        const reach = strongestHere + HOW_FAR_ABOVE_ITS_OWN_A_HOUSE_WILL_REACH;
        const chosen = free
            .filter(n => !gone.has(n.id) && n.cultivation.realmOrdinal >= bar
                && n.cultivation.realmOrdinal <= reach
                && !(n.cultivation.realmOrdinal > strongestHere
                    && theCatalogStatesTheyAreStanding(n)))
            .map(n => ({ n, guest: n.tags.includes(guestTag) || n.cultivation.realmOrdinal > strongestHere }))
            .filter(({ n, guest }) => guest || (province !== null && regionOf(state, n.locationId) === province))
            .sort((a, b) => Number(b.guest) - Number(a.guest)
                || b.n.cultivation.realmOrdinal - a.n.cultivation.realmOrdinal
                || (a.n.id < b.n.id ? -1 : a.n.id > b.n.id ? 1 : 0))[0]?.n;
        if (!chosen) continue;

        const at = state.npcs.findIndex(n => n.id === chosen.id);
        if (at < 0) continue;
        const moved = setLocation(state.npcs[at]!, house.seatLocationId, day);
        state.npcs[at] = {
            ...moved,
            factionId: house.id,
            factionRankIndex: rung,
            merit: null,
            // SOMEBODY ABOVE THE HOUSE'S OWN CEILING STAYS A GUEST. The owner,
            // on what leaving costs: you learn the new house's arts unless you
            // come in as a guest elder. Below the ceiling the tag is spent on
            // the way in, as it always was.
            tags: chosen.cultivation.realmOrdinal > strongestHere
                ? [...moved.tags.filter(t => t !== guestTag), guestTag, `${TAKEN_IN_AS_AN_ELDER}${house.id}`]
                : [...moved.tags.filter(t => t !== guestTag), `${TAKEN_IN_AS_AN_ELDER}${house.id}`],
            updatedOnDay: day
        };
        house.resources.spirit_stones = (house.resources.spirit_stones ?? 0) - price;
        gone.add(chosen.id);
        roll.push(state.npcs[at]!);
        takenIn++;

        const decider = [...roll]
            .filter(n => n.id !== chosen.id)
            .sort((a, b) => b.factionRankIndex - a.factionRankIndex
                || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] ?? null;
        const title = house.ranks[rung] ?? 'elder';
        appendWorldFact(state, makeFact({
            day,
            kind: 'promotion',
            scale: 'local',
            summary: `${chosen.name} was taken in from outside as ${title} of the `
                + `${house.name.replace(/^[Tt]he\s+/, '')}, at ${rankName(chosen.cultivation.realmOrdinal)}, `
                + `for ${price} spirit stones.`,
            actors: [
                { id: chosen.id, name: chosen.name, role: 'taken_in' },
                ...(decider ? [{ id: decider.id, name: decider.name, role: 'took_them_in' }] : [])
            ],
            locationId: house.seatLocationId,
            factionIds: [house.id],
            visibility: 'faction',
            magnitude: 0.4,
            causeKnown: true,
            data: { fromOutside: true, toRank: rung, rankCount, realmOrdinal: chosen.cultivation.realmOrdinal, price }
        }), { recur: false });
    }
    return takenIn;
}
