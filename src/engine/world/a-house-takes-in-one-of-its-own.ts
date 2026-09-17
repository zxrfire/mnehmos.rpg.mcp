/**
 * A house of hundreds keeps a roll worth knowing, because its people are there.
 *
 * `a-house-and-who-is-in-it.md`: a roll is the ten or twenty people a player
 * could come to know out of a house of hundreds, and when the slice cannot fill
 * a place, somebody who was always there becomes a row. The seeder fills a roll
 * to `aRollWorthModelling` once. Nothing afterwards did, so a roll only ever
 * refilled from whoever happened to be wandering unaffiliated in the province -
 * and splinters, sixty of them by 2,500 years, drew on the same people.
 *
 * MEASURED on `shape-a` at 2,500 years before this: catalog houses standing had
 * rolls of 1 to 11 against 7 to 21 worth modelling, compounds sleeping 112 to
 * 574 and treasuries of millions. A roll that thin loses its wars and is
 * scattered, and one that empties ends the house - the slice was judged, not
 * the house.
 *
 * ONE A YEAR, AT THE BOTTOM, AND ONLY FROM A HOUSE THAT HAS THE PEOPLE. A house
 * whose compound stands and sleeps people nobody models, that takes people in,
 * and whose roll is short of what it is worth modelling, has one of its own
 * outer disciples come forward: at the house's ground, at rank 0, in the band
 * the catalog states for that rung. Everything above rank 0 is still climbed.
 * A splinter has no compound and no unmodelled hundreds, so this never reaches
 * one.
 *
 * NOT A FIFTH INTAKE PASS. It is recruitment's own half for the house's own
 * people, run beside `applyRecruitment`, which takes in the unaffiliated.
 */

import { forStream } from '../cultivation/rng.js';
import { clampOrdinal } from '../cultivation/realms.js';
import { getSect } from '../../data/cultivation/sects.js';
import { whoAHouseWillTake } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { howManyAHouseReallyHas } from '../social/how-a-house-reads-a-face.js';
import { aRollWorthModelling, theBandARaisedMemberStandsIn } from './a-house-raises-its-own.js';
import { isBelowTheLid } from './layers.js';
import { createNpc, setRealm } from './npc-state.js';
import { getLocation, type FactionRecord, type WorldState } from './world-state.js';

const DAYS_PER_YEAR = 365;

/**
 * Whether a house has people the world does not model: its compound stands, it is
 * still the house's, and it sleeps somebody (`howManyAHouseReallyHas`). A seat a
 * conquest turned to a ruin sleeps nobody, whatever rooms still carry the name.
 *
 * READ OFF THE KIND, NOT THE `ruined` TAG. A splinter is seated where its founder
 * stood, which is usually the house it left's own grounds, and a splinter that
 * then fell tagged those grounds ruined and abandoned. Measured on `shape-a`:
 * eight catalog houses whose compounds three squatting splinters had "left
 * standing and empty" were read as having nobody, and fell.
 */
export function stillHasPeopleNobodyModels(state: WorldState, house: FactionRecord): boolean {
    const seat = house.seatLocationId === null ? null : getLocation(state, house.seatLocationId);
    if (!seat || seat.kind === 'ruin') return false;
    if (seat.controllingFactionId !== null && seat.controllingFactionId !== house.id) return false;
    return howManyAHouseReallyHas(state, house.id) > 0;
}

/** Each house short of its roll takes one of its own in. Returns how many came forward. */
export function theHousesTakeInTheirOwn(state: WorldState, year: number, day: number): number {
    const roll = new Map<string, { count: number; strongest: number }>();
    for (const n of state.npcs) {
        if (n.status !== 'alive' || n.factionId === null) continue;
        const r = roll.get(n.factionId) ?? { count: 0, strongest: -1 };
        r.count++;
        r.strongest = Math.max(r.strongest, n.cultivation.realmOrdinal);
        roll.set(n.factionId, r);
    }

    let raised = 0;
    let taken: Set<string> | null = null;
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house) || !house.tags.includes('recruits')) continue;
        const cf = getSect(house.id);
        if (!cf || !cf.recruits) continue;
        const here = roll.get(house.id) ?? { count: 0, strongest: -1 };
        const worth = aRollWorthModelling({
            rankCount: house.ranks.length,
            powerOrdinal: cf.powerOrdinal,
            admissionOrdinal: cf.admissionOrdinal,
            recruits: cf.recruits,
            yearsStanding: house.foundedOnDay === null
                ? Number.POSITIVE_INFINITY
                : (day - house.foundedOnDay) / DAYS_PER_YEAR
        });
        if (here.count >= worth) continue;
        if (!stillHasPeopleNobodyModels(state, house)) continue;

        const band = theBandARaisedMemberStandsIn(
            house.id, 0, here.count === 0 ? Number.POSITIVE_INFINITY : here.strongest);
        if (!band) continue;

        const rng = forStream(state.seed, 'a-house-takes-in-its-own', house.id, year);
        const ordinal = clampOrdinal(rng.int(band.minOrdinal, band.maxOrdinal));
        // The age the world's own births arrive at (`applyDemography`, 16 to 22).
        const age = rng.int(16, 22);
        const id = `npc-${state.nextNpcSeq++}`;
        taken ??= new Set(state.npcs.map(n => n.name));
        const takes = whoAHouseWillTake(house.id);
        let npc = createNpc(state.seed, {
            id,
            bornOnDay: day - age * DAYS_PER_YEAR,
            onDay: day,
            locationId: house.seatLocationId,
            occupation: 'unknown',
            takenNames: taken,
            ...(takes !== null ? { sex: takes } : {}),
            tags: [`raised:${house.id}`]
        });
        taken.add(npc.name);
        npc = { ...setRealm(npc, ordinal, day), factionId: house.id, factionRankIndex: 0 };
        state.npcs.push(npc);
        raised++;
    }
    return raised;
}
