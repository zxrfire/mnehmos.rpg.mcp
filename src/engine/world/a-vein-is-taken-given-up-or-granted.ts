/**
 * Veins are grants: war takes them, a failing holder returns them, and the
 * apex or court grants them again. No holder can sell one. The yearly writes
 * are in `applyWhoHoldsTheVeins`; seeding uses the same grant selection.
 */
import { APEX_INSTITUTIONS, COURTS } from '../../data/cultivation/governance-and-water-rights.js';
import { provinceForRegion } from '../../data/cultivation/regions/provinces.js';
import { howFarFromTheSeat } from './a-communication-talisman-carries-word-home.js';
import { isBelowTheLid } from './layers.js';
import type { LocationRecord } from './locations.js';
import type { FactionRecord, WorldState } from './world-state.js';
import { howThePurseIsRunning } from './what-a-house-does-when-it-cannot-pay.js';

const A_WAR_TAKES_A_VEIN_AT = 0.2;

interface AVeinAsItStands {
    id: string;
    worksAt: number;
    holderId: string | null;
    grantorId: string | null;
}

interface AHouseAsItStands {
    id: string;
    live: boolean;
    members: number;
    purse: number;
    payroll: number;
    strongest: number;
    war: { againstId: string; losing: number; settled: boolean } | null;
}

export type HowAVeinChangedHands = 'taken_in_war' | 'given_up' | 'granted';

interface AVeinChangesHands {
    veinId: string;
    how: HowAVeinChangedHands;
    fromId: string | null;
    toId: string | null;
}

/**
 * The living grant authority for this ground. Jurisdiction precedes distance;
 * outside a catalog jurisdiction the nearest reachable apex or court grants.
 * Derived from the ground, never from its current occupier.
 */
export function whoGrantsThisVein(state: WorldState, vein: LocationRecord): FactionRecord | null {
    const regionId = String(vein.data.catalogRegionId ?? '');
    const province = provinceForRegion(regionId);
    const howFar = howFarFromTheSeat(state.locations);
    const authorities = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f))
        .flatMap(f => {
            const apex = APEX_INSTITUTIONS.find(a => a.factionId === f.id);
            const court = COURTS.find(c => c.id === f.id || c.embodiedByFactionId === f.id);
            if (!apex && !court) return [];
            const distance = f.seatLocationId ? howFar(f.seatLocationId, vein.id) : null;
            if (distance === null) return [];
            const inJurisdiction = (province !== undefined && apex?.holdsProvinceIds.includes(province.id))
                || (court?.grantsInRegionId === regionId && court.grantsInPrefectureIds.length > 0);
            return [{ faction: f, distance, inJurisdiction: Boolean(inJurisdiction) }];
        });
    authorities.sort((a, b) => Number(b.inJurisdiction) - Number(a.inJurisdiction)
        || a.distance - b.distance || a.faction.id.localeCompare(b.faction.id));
    return authorities[0]?.faction ?? null;
}

/** One change per vein per pass; a returned vein is granted on the next pass. */
export function whoseVeinsChangeHands(input: {
    veins: readonly AVeinAsItStands[];
    houses: readonly AHouseAsItStands[];
    /** Null where the house cannot reach the vein. */
    daysFrom: (houseId: string, veinId: string) => number | null;
}): AVeinChangesHands[] {
    const byId = new Map<string, AHouseAsItStands>(input.houses.map(h => [h.id, h]));
    const out: AVeinChangesHands[] = [];
    const canWork = (h: AHouseAsItStands, vein: AVeinAsItStands): boolean =>
        h.live && h.members > 0 && h.strongest >= vein.worksAt
        && input.daysFrom(h.id, vein.id) !== null;
    const grant = (vein: AVeinAsItStands): void => {
        const grantor = vein.grantorId === null ? null : byId.get(vein.grantorId);
        if (!grantor?.live) return;
        const recipient = input.houses.filter(h => h.id !== grantor.id && canWork(h, vein)
            && h.war === null && howThePurseIsRunning(h.purse, h.payroll) !== 'cannot_pay')
            .sort((a, b) => (input.daysFrom(a.id, vein.id) ?? Infinity)
                - (input.daysFrom(b.id, vein.id) ?? Infinity)
                || b.purse - a.purse || a.id.localeCompare(b.id))[0];
        if (recipient) out.push({ veinId: vein.id, how: 'granted', fromId: grantor.id, toId: recipient.id });
    };

    for (const vein of [...input.veins].sort((a, b) => a.id.localeCompare(b.id))) {
        const holder = vein.holderId === null ? null : byId.get(vein.holderId);
        if (holder === undefined) continue;

        if (holder === null) {
            grant(vein);
            continue;
        }

        if (!holder.live) {
            out.push({ veinId: vein.id, how: 'given_up', fromId: holder.id, toId: vein.grantorId });
            continue;
        }
        if (holder.war !== null && (holder.war.losing >= A_WAR_TAKES_A_VEIN_AT
            || (holder.war.settled && holder.war.losing > 0))) {
            const taker = byId.get(holder.war.againstId);
            if (taker && canWork(taker, vein)) {
                out.push({ veinId: vein.id, how: 'taken_in_war', fromId: holder.id, toId: taker.id });
                continue;
            }
        }
        if (holder.id === vein.grantorId) {
            grant(vein);
            continue;
        }
        if (howThePurseIsRunning(holder.purse, holder.payroll) === 'cannot_pay'
            && (holder.members === 0 || holder.strongest < vein.worksAt)) {
            out.push({ veinId: vein.id, how: 'given_up', fromId: holder.id, toId: vein.grantorId });
        }
    }
    return out;
}
