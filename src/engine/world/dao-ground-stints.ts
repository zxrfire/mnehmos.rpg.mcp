/**
 * A dao ground is visited for a finite stretch, not lived on.
 */

import { affinityFor, AFFINITY_WEIGHT } from '../cultivation/dao.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { YEARS_A_ROAD_COSTS } from '../cultivation/what-a-road-in-reach-costs-to-walk.js';
import { reportingMagnitudeFor } from './a-deed-enters-the-world-as-a-fact.js';
import { whatArrivingInIsWorth } from './a-crossing-enters-the-world-as-news.js';
import { groundAtLocation } from './how-a-cultivator-comes-by-a-road.js';
import { makeFact } from './history.js';
import { walkingDaysFrom } from './locations.js';
import { isAwayOnSomething, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { whatSomebodyIsLike } from './what-somebody-is-like-and-where-it-came-from.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';

/** A journey keeps the traveller at their departure until its due day. */
export function startNpcJourney(
    state: Pick<WorldState, 'locations'>,
    npc: NpcRecord,
    destinationId: string,
    day: number,
    note: string
): NpcRecord {
    const days = npc.locationId === null ? 1
        : walkingDaysFrom(state.locations, npc.locationId).get(destinationId) ?? 1;
    return {
        ...npc,
        activity: {
            kind: 'travelling', note, withIds: [], sinceDay: day,
            untilDay: day + Math.max(1, Math.ceil(days)), returnTo: destinationId
        },
        updatedOnDay: day
    };
}

/**
 * The span after which somebody whose road has not opened finds other work.
 *
 * The cost itself remains in YEARS_A_ROAD_COSTS. Aptitude makes waiting more
 * worthwhile, temperament decides patience, and a higher rung has more calls
 * on its time. One draw fixes the stint at its start; the yearly pass never
 * rolls a person again.
 */
export function yearsBeforeGivingUpAtDaoGround(input: {
    seed: string;
    npc: NpcRecord;
    domain: Parameters<typeof affinityFor>[2]['domain'];
    subject: string;
}): number {
    const affinity = affinityFor(input.seed, input.npc.id, {
        domain: input.domain,
        subject: input.subject
    });
    const patience = (1 - whatSomebodyIsLike(input.npc).push) * 3;
    const rungCalls = Math.floor(input.npc.cultivation.realmOrdinal / 8);
    const affinityYears = Math.round((AFFINITY_WEIGHT[affinity] - 1) * 3);
    return Math.max(4, Math.round(6 + forStream(
        input.seed, 'dao-ground-stint', input.npc.id, input.domain, input.subject
    ).int(0, 6) + patience + affinityYears + rungCalls));
}

/** The first ordinary settlement under the ground's province. */
function onwardFrom(state: WorldState, locationId: string): string | null {
    let region = state.locations.find(place => place.id === locationId) ?? null;
    while (region?.parentId) region = state.locations.find(place => place.id === region!.parentId) ?? null;
    const regionId = region?.id ?? null;
    return state.locations.find(place => place.kind === 'settlement' && place.parentId === regionId)
        ?.id ?? null;
}

function returnFromGround(state: WorldState, npc: NpcRecord, groundId: string): string | null {
    const house = npc.factionId === null ? null : state.factions.find(f => f.id === npc.factionId);
    return house?.seatLocationId ?? onwardFrom(state, groundId);
}

function daoName(domain: Parameters<typeof affinityFor>[2]['domain']): string {
    return domain === 'life_death' ? 'life-and-death dao' : `${domain.replaceAll('_', '-')} dao`;
}

/** A comprehension is one recorded event, before its holder starts walking home. */
function recordDaoComprehension(
    state: WorldState,
    npc: NpcRecord,
    location: { id: string; name: string },
    ground: NonNullable<ReturnType<typeof groundAtLocation>>,
    day: number
): void {
    const dao = daoName(ground.domain);
    const worth = whatArrivingInIsWorth(npc.cultivation.realmOrdinal);
    appendWorldFact(state, makeFact({
        day,
        kind: 'dao_comprehension',
        scale: worth.scale,
        magnitude: reportingMagnitudeFor(worth.weight),
        visibility: 'regional',
        locationId: location.id,
        place: location.name,
        actors: [{ id: npc.id, name: npc.name, role: 'comprehended' }],
        factionIds: npc.factionId === null ? [] : [npc.factionId],
        summary: `${npc.name} comprehended the ${dao} at ${location.name}.`,
        data: {
            comprehendedDao: `the ${dao}`,
            daoDomain: ground.domain,
            daoSubject: ground.subject,
            daoGroundId: location.id
        }
    }), { recur: false });
}

export interface DaoGroundStintsResult {
    began: number;
    comprehended: number;
    gaveUp: number;
    calledAway: number;
}

/**
 * Start or finish every visit that is physically at a dao ground this year.
 * This is one pass over people and uses one fixed draw per stint, not days.
 */
export function applyDaoGroundStints(
    state: WorldState,
    day: number
): DaoGroundStintsResult {
    const result: DaoGroundStintsResult = { began: 0, comprehended: 0, gaveUp: 0, calledAway: 0 };
    for (let at = 0; at < state.npcs.length; at++) {
        const npc = state.npcs[at]!;
        if (npc.status !== 'alive' || !isTheWorldsToMove(npc) || npc.locationId === null) continue;
        const location = state.locations.find(place => place.id === npc.locationId);
        const ground = location === undefined ? null : groundAtLocation(location);
        if (ground === null || ground.access === 'buried') continue;
        if (npc.activity !== null && isAwayOnSomething(npc.activity.kind)) continue;

        if (npc.activity?.kind !== 'comprehending') {
            if (npc.activity !== null) continue;
            const back = returnFromGround(state, npc, location!.id);
            if (back === null) continue;
            state.npcs[at] = {
                ...npc,
                activity: {
                    kind: 'comprehending', note: `Studying ${ground.subject}.`, withIds: [],
                    sinceDay: day, untilDay: null, returnTo: back
                },
                updatedOnDay: day
            };
            result.began++;
            continue;
        }

        const yearsThere = (day - npc.activity.sinceDay) / DAYS_PER_YEAR;
        const cost = YEARS_A_ROAD_COSTS[ground.access === 'held' ? 'ground_held'
            : ground.access === 'buried' ? 'ground_buried' : 'ground_open'];
        const gaveUpAfter = yearsBeforeGivingUpAtDaoGround({
            seed: state.seed, npc, domain: ground.domain, subject: ground.subject
        });
        // Advancement changed this person in the immediately preceding pass.
        // A pending sending is the house's already-issued summons.
        const calledAway = npc.updatedOnDay === day - 1
            || (state.pendingSendings ?? []).some(sending => sending.party.some(person => person.id === npc.id));
        const why = yearsThere >= cost ? 'comprehended'
            : calledAway ? 'called away'
                : yearsThere >= gaveUpAfter ? 'gave up'
                    : null;
        const back = npc.activity.returnTo;
        if (why === null || back === null || back === undefined) continue;
        if (why === 'comprehended') recordDaoComprehension(state, npc, location!, ground, day);
        state.npcs[at] = startNpcJourney(state, npc, back, day,
            `${why[0]!.toUpperCase()}${why.slice(1)} ${ground.subject} at ${location!.name}.`);
        if (why === 'comprehended') result.comprehended++;
        else if (why === 'gave up') result.gaveUp++;
        else result.calledAway++;
    }
    return result;
}
