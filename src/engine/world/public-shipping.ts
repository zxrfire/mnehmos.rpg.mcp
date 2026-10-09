import { shipHandsForHull, publicShipHullCanBeBoarded } from './a-public-ship-hull.js';
import { requireConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import type { ObjectRecord } from './possessions.js';
import { companyDuringPassage } from './company-during-a-passage.js';
/**
 * Where a ship puts in: every lane's landfalls, and every place on open water, each at its own dock.
 *
 * The owner: "all island places have a dock". So nothing on open water is walked to, and nothing
 * is hand-listed: a dock is every place the world stands directly on a province that is open water
 * (`openWater` in the catalog), a house's grounds and a ruin as much as a port town, and without a
 * world the catalog's own places there. A room inside a house's walls is reached through the dock
 * of the ground it stands in.
 *
 * How far apart two docks are is the catalog's chain of passages between them (`placeRoadDays`).
 * A dock only the world knows (a house's grounds, a ruin, the vein) has no passages of its own,
 * so it is a day out from the catalog port nearest it ({@link thePortADockIsNear}) and takes that
 * port's days plus the one. Two catalog places no chain joins are the flat unpriced day apart.
 */

import { REGIONS, isOpenWater, placeRoadDays, regionIdOfPlace, requireRegion } from '../../data/cultivation/regions.js';
import { forStream } from '../cultivation/rng.js';
import { SEA_LANES } from '../../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { regionCatalogIdOf } from './how-a-cultivator-comes-by-a-road.js';
import { placeScopeFor, type LocationRecord, type PlaceScope } from './locations.js';
import { worldLocationFor, loosePlaceKey } from './place-lookup.js';
import { SHORT_ACTION_DAYS } from './short-action.js';
import type { PassageRunMoment } from './passage-moment.js';
import type { WorldState } from './world-state.js';
import { theLandfall } from './where-a-lane-makes-landfall.js';
import { laneIsOpenInMonth, type SeaLane } from './what-a-sea-crossing-costs.js';
import { monthOf, theSeatFare } from './the-fare-and-calendar-of-a-passage.js';
import { stonesFor } from './the-fare-and-calendar-of-a-passage.js';
import { provisionForLane, resolveCrossing } from './what-a-sea-crossing-costs.js';
import type { NpcActivity, NpcRecord } from './npc-state.js';
import { shipIdForLane } from './the-ship-on-a-lane.js';
import { locationOnNpcJourney, journeyTimeHasReached } from './places-on-the-way.js';
import { factsWithDataValue, witnessIndexFor, type HistoryFactSource } from './witness-reaction-index.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
export { theLandfall };
export type DockWorld = { seed: string; locations: readonly LocationRecord[] } | null;
type World = DockWorld;

/** The catalog place a lane's landfall names, where it names one. */

/** The province a place is in, by the catalog or the world's row. */
export function theProvinceOf(world: World, place: string,scope?:PlaceScope): string | null {
    const named = regionIdOfPlace(place);
    if (named) return named;
    const row = world ? worldLocationFor(world, place,scope) : null;
    return row && world ? regionCatalogIdOf(world as WorldState, row.id,scope?.places) : null;
}

function isOpenWaterProvinceRow(row: LocationRecord | undefined): boolean {
    const id = (row?.data as { catalogRegionId?: unknown } | undefined)?.catalogRegionId;
    return row?.kind === 'region' && typeof id === 'string' && isOpenWater(id);
}

/** Every place standing directly on open water, each of which has a dock. */
function theDocksOnOpenWater(world: World): string[] {
    const docks = REGIONS.filter(region => isOpenWater(region.id)).flatMap(region => region.places.map(place => place.name));
    if (!world) return docks;
    const byId = new Map(world.locations.map(row => [row.id, row]));
    for (const row of world.locations) {
        if (row.parentId && isOpenWaterProvinceRow(byId.get(row.parentId)) && !docks.includes(row.name)) docks.push(row.name);
    }
    return docks;
}

/** Every place a ship puts in at. */
export function thePortsShipsPutInAt(world: World,scope?:PlaceScope): string[] {
    if (!world) return portsShipsPutInAt(world);
    const routes = scope??placeScopeFor(world.locations);
    let ports = PORTS.get(routes);
    if (!ports) PORTS.set(routes, ports = portsShipsPutInAt(world));
    return ports.slice();
}

/** The ports for one unchanged place list: every line and dock read in a year asks the same thing. */
const PORTS = new WeakMap<object, string[]>();

function portsShipsPutInAt(world: World): string[] {
    const ports = new Set<string>();
    for (const lane of SEA_LANES) {
        for (const end of [theLandfall(lane.fromPlace), theLandfall(lane.toPlace)]) if (end) ports.add(end);
    }
    for (const dock of theDocksOnOpenWater(world)) ports.add(dock);
    return [...ports];
}

/**
 * The dock a place is reached by: itself where it has one, and for a room behind a house's walls
 * on open water, the dock of the ground the house stands on. Null where no ship puts in.
 */
export function theDockOf(world: World, place: string): string | null {
    const ports = thePortsShipsPutInAt(world);
    const own = ports.find(port => loosePlaceKey(port) === loosePlaceKey(place));
    if (own) return own;
    if (!world) return null;
    const byId = new Map(world.locations.map(row => [row.id, row]));
    let row = worldLocationFor(world, place) ?? undefined;
    for (let hops = 0; row && hops < 12; hops++) {
        const parent = row.parentId ? byId.get(row.parentId) : undefined;
        if (isOpenWaterProvinceRow(parent)) return ports.find(port => loosePlaceKey(port) === loosePlaceKey(row!.name)) ?? null;
        row = parent;
    }
    return null;
}

/**
 * The catalog port a dock only the world knows lies near: the port its house holds, for a house's
 * grounds; otherwise the one of its province's ports its own draw points at, since the world keeps
 * no distance for it. A catalog place is its own.
 */
export function thePortADockIsNear(world: World, dock: string,scope?:PlaceScope): string {
    const province = regionIdOfPlace(dock);
    if (province) return requireRegion(province).places.find(place => loosePlaceKey(place.name) === loosePlaceKey(dock))!.name;
    const row = world ? worldLocationFor(world, dock,scope) : null;
    const regionId = row && world ? regionCatalogIdOf(world as WorldState, row.id,scope?.places) : null;
    const ports = regionId ? requireRegion(regionId).places.filter(place => place.kind !== 'site') : [];
    if (!row || ports.length === 0) return dock;
    const house = row.controllingFactionId ?? (row.data as { factionId?: unknown }).factionId;
    const held = typeof house === 'string' ? ports.find(place => place.heldByFactionId === house) : undefined;
    if (held) return held.name;
    return ports[Math.floor(forStream(world!.seed, 'the-port-a-dock-is-near', row.id).next() * ports.length)]!.name;
}

/** Days of sailing between two docks of one open-water province. */
export function daysOfSailingBetween(world: World, from: string, to: string,scope?:PlaceScope): number {
    const [a, b] = [thePortADockIsNear(world, from,scope), thePortADockIsNear(world, to,scope)];
    const out = (a === from ? 0 : 1) + (b === to ? 0 : 1);
    return (a === b ? 0 : placeRoadDays(a, b) ?? SHORT_ACTION_DAYS) + out;
}

export interface PublicShipLine {
    service: 'ship'; to: string; walkingDays: number; days: number; cashPerSeat: number;
    runsFromDay: number | null; lane: SeaLane;
}

/**
 * A ship between two ports of an open-water province. The catalog states the days and
 * nothing else about the passage, so it is worked all year at ordinary weather.
 */
const GENERATED_PASSAGES = new WeakSet<SeaLane>();

function aPassageBetween(from: string, to: string, days: number): SeaLane {
    const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const passage = {
        id: `passage-${slug(from)}-${slug(to)}`,
        fromPlace: from,
        toPlace: to,
        expectedDays: days,
        openMonthsPerYear: 12,
        intermediateLandfallDays: [],
        weatherSeverity: 1
    };
    GENERATED_PASSAGES.add(passage);
    return passage;
}

/** The first day from today the lane is worked, or null where it never is. */
function whenTheLaneRuns(lane: SeaLane, today: number): number | null {
    for (let day = today; day < today + 366; day++) {
        if (laneIsOpenInMonth(lane, monthOf(day))) return day;
    }
    return null;
}


/**
 * The ships from a dock: each lane with a landfall here, then across open water to every other
 * dock of the province, nearest first (`where-a-ship-puts-in.ts`). Nothing from anywhere a ship
 * does not put in.
 */
const SHIP_LINES = new WeakMap<object,Map<string,{lines:PublicShipLine[];days:Map<number,PublicShipLine[]>}>>();
const CATALOG_PORTS = {};

export function publicShipLinesFrom(world: DockWorld, here: string, today: number,scope?:PlaceScope): PublicShipLine[] {
    scope ??= world?placeScopeFor(world.locations):undefined;
    const key=world?scope!:CATALOG_PORTS;
    let answers=SHIP_LINES.get(key);
    if(!answers)SHIP_LINES.set(key,answers=new Map());
    const name=(world?.seed??'')+'\u0001'+here,day=Math.floor(today);
    let held=answers.get(name);
    if(!held){
        held={lines:shipLinesFrom(world,here,0,scope),days:new Map()};
        answers.set(name,held);
    }
    let lines=held.days.get(day);
    if(!lines){
        lines=held.lines.map(line=>{
            const runs=whenTheLaneRuns(line.lane,day);
            return {...line,runsFromDay:runs===day?null:runs};
        });
        if(held.days.size>=8)held.days.delete(held.days.keys().next().value!);
        held.days.set(day,lines);
    }
    return lines.map(line=>({...line,
        lane:GENERATED_PASSAGES.has(line.lane)?{...line.lane,intermediateLandfallDays:line.lane.intermediateLandfallDays.slice()}:line.lane,
        runsFromDay:line.runsFromDay===null?null:line.runsFromDay+today-day}));
}

function shipLinesFrom(world: DockWorld, here: string, today: number,scope?:PlaceScope): PublicShipLine[] {
    const regionId = theProvinceOf(world, here,scope);
    const ports = thePortsShipsPutInAt(world,scope);
    if (!regionId || !ports.includes(here)) return [];
    const lines: PublicShipLine[] = [];
    for (const lane of SEA_LANES) {
        const from = theLandfall(lane.fromPlace);
        const to = theLandfall(lane.toPlace);
        if (!from || !to) continue;
        const other = from === here ? to : to === here ? from : null;
        if (!other) continue;
        const runs = whenTheLaneRuns(lane, today);
        lines.push({
            service: 'ship',
            to: other,
            walkingDays: lane.expectedDays,
            days: lane.expectedDays,
            cashPerSeat: theSeatFare(regionId, 'ship', lane.expectedDays, lane),
            runsFromDay: runs === today ? null : runs,
            lane
        });
    }
    if (!isOpenWater(regionId)) return lines;
    const across = ports
        .filter(port => port !== here && theProvinceOf(world, port,scope) === regionId && !lines.some(line => line.to === port))
        .map(port => ({ to: port, days: daysOfSailingBetween(world, here, port,scope) }))
        .sort((a, b) => a.days - b.days || a.to.localeCompare(b.to));
    for (const { to, days } of across) {
        const lane = aPassageBetween(here, to, days);
        lines.push({
            service: 'ship',
            to,
            walkingDays: days,
            days,
            cashPerSeat: theSeatFare(regionId, 'ship', days, lane),
            runsFromDay: null,
            lane
        });
    }
    return lines;
}

/** The actual bounded sailing, also used by a crew and a sponsored passenger. */
export interface PublicPassageLeg {
    lane: SeaLane; vesselId: string; fromId: string; toId: string;
    departureDay: number; arrivalDay: number;
}
export interface PublicPassageQuote extends PublicPassageLeg {
    heads: number; fareStones: number; days: number;
    provision: ReturnType<typeof provisionForLane>;
    crossing: ReturnType<typeof resolveCrossing>;
}
type ShippingWorld = NonNullable<DockWorld> & {
    npcs?: readonly NpcRecord[]; objects?: readonly ObjectRecord[]; history?: Pick<WorldState['history'], 'facts'>;
};

function shippingHasHistory(world:ShippingWorld):world is ShippingWorld & HistoryFactSource { return !!world.history; }

/** Only the physical booking bounds are needed to locate a known hull. */
type HullLeg = Omit<PublicPassageLeg, 'lane'> & { laneId: string; reserved?: true; passengerIds?: readonly string[] };

/** Actor membership is indexed; each quote still reads the current records. */
type ShippingActorShape={id:string;alive:boolean;vessel:string|null;mission:string|null;crew:string[]};
const SHIPPING_ACTORS=new WeakMap<readonly NpcRecord[],{
    shapes:ShippingActorShape[];vessels:Map<string,Set<number>>;missions:Map<string,Set<number>>;living:Map<string,number>
}>();
function shippingActors(npcs:readonly NpcRecord[]) {
    let read=SHIPPING_ACTORS.get(npcs);
    if(!read)SHIPPING_ACTORS.set(npcs,read={shapes:[],vessels:new Map(),missions:new Map(),living:new Map()});
    const membership=(shape:ShippingActorShape)=>new Set([...(shape.vessel?[shape.vessel]:[]),...shape.crew]);
    const remove=(shape:ShippingActorShape,at:number)=>{
        for(const vessel of membership(shape)) {
            const slots=read!.vessels.get(vessel);slots?.delete(at);
            if(slots?.size===0)read!.vessels.delete(vessel);
        }
        if(shape.mission){const slots=read!.missions.get(shape.mission);slots?.delete(at);
            if(slots?.size===0)read!.missions.delete(shape.mission);}
        if(shape.alive){const count=read!.living.get(shape.id)!-1;
            if(count)read!.living.set(shape.id,count);else read!.living.delete(shape.id);}
    };
    for(let at=0;at<Math.max(npcs.length,read.shapes.length);at++) {
        const npc=npcs[at],old=read.shapes[at];
        if(!npc){if(old)remove(old,at);continue;}
        const alive=npc.status==='alive',vessel=npc.activity?.vesselId??null;
        const mission=alive?npc.activity?.capitalMissionId??null:null;
        let sameCrew=!!old,crewAt=0;
        for(const tag of npc.tags)if(tag.startsWith('crew-of:')) {
            if(old?.crew[crewAt++]!==tag.slice(8))sameCrew=false;
        }
        if(old&&old.id===npc.id&&old.alive===alive&&old.vessel===vessel&&old.mission===mission
            &&sameCrew&&crewAt===old.crew.length)continue;
        if(old)remove(old,at);
        const shape={id:npc.id,alive,vessel,mission,crew:npc.tags.filter(tag=>tag.startsWith('crew-of:')).map(tag=>tag.slice(8))};
        read.shapes[at]=shape;
        for(const id of membership(shape)){
            const slots=read.vessels.get(id)??new Set<number>();slots.add(at);read.vessels.set(id,slots);
        }
        if(mission){const slots=read.missions.get(mission)??new Set<number>();slots.add(at);read.missions.set(mission,slots);}
        if(alive)read.living.set(npc.id,(read.living.get(npc.id)??0)+1);
    }
    read.shapes.length=npcs.length;
    const people=(slots:ReadonlySet<number>|undefined)=>[...slots??[]].sort((a,b)=>a-b).map(at=>npcs[at]!);
    return {people:(vessel:string)=>people(read!.vessels.get(vessel)),living:read.living,
        missions:()=>[...read!.missions].sort((a,b)=>Math.min(...a[1])-Math.min(...b[1]))
            .map(([id,slots])=>[id,people(slots).map(npc=>npc.id)] as const)};
}
type ShippingActors=ReturnType<typeof shippingActors>;

/** Paid future berths exist only while a living participant continues the mission. */
function activeReservedLegs(world: ShippingWorld, vesselId: string,read:ShippingActors): HullLeg[] {
    if (!world.history) return [];
    const ids=read.missions();
    if(!ids.length)return [];
    const index = witnessIndexFor(world as WorldState);
    const legs: HullLeg[] = [];
    for (const [id,passengerIds] of ids) {
        const mission = index.byId.get(id);
        if (mission?.data.publicMission !== true || typeof mission.data.publicReservations !== 'string') continue;
        let reservations: unknown;
        try { reservations = JSON.parse(mission.data.publicReservations); } catch { continue; }
        if (!Array.isArray(reservations)) continue;
        for (const reservation of reservations) {
            if (!reservation || typeof reservation !== 'object') continue;
            const leg = reservation as Partial<PublicPassageLeg>;
            if (leg.vesselId !== vesselId || typeof leg.fromId !== 'string' || typeof leg.toId !== 'string'
                || typeof leg.lane?.id !== 'string' || typeof leg.departureDay !== 'number'
                || typeof leg.arrivalDay !== 'number' || !Number.isFinite(leg.departureDay)
                || !Number.isFinite(leg.arrivalDay) || leg.arrivalDay <= leg.departureDay) continue;
            legs.push({ vesselId, fromId: leg.fromId, toId: leg.toId,
                departureDay: leg.departureDay, arrivalDay: leg.arrivalDay, laneId: leg.lane.id, reserved: true,
                passengerIds });
        }
    }
    return legs;
}

/** Current bookings and their immutable history locate a hull; no fleet store exists. */
function knownHullLegs(world: ShippingWorld, vesselId: string,read:ShippingActors): HullLeg[] {
    const held = new Map<number, { leg: HullLeg; authority: number; confirmedDay: number }>();
    const keep = (leg: HullLeg, authority: number, confirmedDay: number) => {
        const old = held.get(leg.departureDay);
        if (!old || authority > old.authority || authority === old.authority && confirmedDay >= old.confirmedDay)
            held.set(leg.departureDay, { leg, authority, confirmedDay });
    };
    // An actual bound/recorded course supersedes its paid plan at the same departure.
    for (const leg of activeReservedLegs(world, vesselId,read)) keep(leg, -1, leg.departureDay);
    // The existing sparse index owns historical lookups. It reads only history.
    const history = world.history ? factsWithDataValue(world as WorldState, 'vesselId', vesselId) : [];
    const byFactId = new Map(history.map(fact => [fact.id, fact]));
    const replaced = new Map<string, HistoricalFact>();
    for (const changed of history) for (const id of changed.causes) {
        const prior = byFactId.get(id);
        if (prior?.data.publicPassage === true && prior.data.vesselId === vesselId
            && changed.data.publicPassage === true && changed.data.seaLaneId === prior.data.seaLaneId
            && typeof prior.data.departureDay === 'number' && typeof changed.data.departureDay === 'number'
            && changed.data.departureDay > prior.data.departureDay && changed.day === changed.data.departureDay)
            replaced.set(id, changed);
    }
    for (const fact of history) {
        const data = fact.data;
        if (data.publicPassage !== true || typeof data.fromLocationId !== 'string'
            || typeof data.toLocationId !== 'string' || typeof data.departureDay !== 'number'
            || typeof data.arrivalDay !== 'number' || typeof data.seaLaneId !== 'string') continue;
        const changed = replaced.get(fact.id);
        const ground = changed?.data.fromLocationId;
        const interrupted = changed && typeof ground === 'string';
        keep({ vesselId, fromId: data.fromLocationId, toId: interrupted ? ground : data.toLocationId,
            departureDay: data.departureDay, arrivalDay: interrupted ? changed.day : data.arrivalDay,
            laneId: data.seaLaneId }, 1, fact.day);
    }
    for (const npc of read.people(vesselId)) {
        const doing = npc.activity;
        if (doing?.kind !== 'travelling' || doing.vesselId !== vesselId || !doing.seaLaneId
            || !doing.fromLocationId || !doing.returnTo || doing.untilDay == null) continue;
        // A currently bound crew is the actual course, including a turnback.
        keep({ vesselId, fromId: doing.fromLocationId, toId: doing.returnTo,
            departureDay: doing.sinceDay, arrivalDay: doing.untilDay, laneId: doing.seaLaneId },
            npc.status === 'alive' && npc.tags.includes(`crew-of:${vesselId}`) ? 2 : 0, npc.updatedOnDay);
    }
    return [...held.values()].map(one => one.leg);
}

type HullRead = { legs: readonly HullLeg[]; standingCrew: readonly NpcRecord[];
    crewIds: ReadonlySet<string>; berths:()=>{crewHeads:number;aboard:ReadonlyMap<number,ReadonlySet<string>>};
    operator:NpcRecord|null; physicalHull:ObjectRecord|undefined };

/** A single unchanged quote pass holds only an ephemeral read of existing truth. */
function readHull(world: ShippingWorld, vesselId: string, consideredLegs: readonly PublicPassageLeg[]): HullRead {
    const read=shippingActors(world.npcs??[]),people=read.people(vesselId);
    const crew=people.filter(npc=>npc.tags.includes('crew-of:'+vesselId));
    const crewIds=new Set(crew.map(npc=>npc.id));
    const standingCrew=crew.filter(npc=>npc.status==='alive'&&npc.activity?.kind!=='travelling');
    const operator=crew.find(npc=>npc.status==='alive'&&npc.identity.occupation==='shipmaster')??null;
    let berths:{crewHeads:number;aboard:Map<number,Set<string>>}|undefined;
    return { legs: [...knownHullLegs(world, vesselId,read), ...consideredLegs.filter(leg => leg.vesselId === vesselId)
        .map(leg => ({ ...leg, laneId: leg.lane.id }))],standingCrew,crewIds,operator,
        physicalHull:world.objects?.find(object=>object.id===vesselId),
        berths:()=>{
            if(berths)return berths;
            const aboard=new Map<number,Set<string>>();
            const crewHeads=[...crewIds].reduce((count,id)=>count+(read.living.get(id)??0),0);
            for(const npc of people) {
                if(npc.activity?.kind==='travelling'&&npc.activity.vesselId===vesselId) {
                    const ids=aboard.get(npc.activity.sinceDay)??new Set<string>();
                    ids.add(npc.id);aboard.set(npc.activity.sinceDay,ids);
                }
            }
            return berths={crewHeads,aboard};
        } };
}

/** A world obstruction can change only at an existing hull/crew position event. */
function hullPositionAt(hull: HullRead, fromId: string, toId: string, departureDay: number, laneId: string): {
    same: HullLeg | undefined; blockedUntil?: number | null;
} {
    const legs = hull.legs;
    const same = legs.find(leg => leg.fromId === fromId && leg.toId === toId
        && leg.departureDay === departureDay && leg.laneId === laneId);
    const past = legs.filter(leg => !leg.reserved && journeyTimeHasReached(departureDay,leg.arrivalDay))
        .sort((a, b) => b.arrivalDay - a.arrivalDay)[0];
    const standingCrew = hull.standingCrew.filter(npc => npc.updatedOnDay <= departureDay);
    const confirmed = [...standingCrew].sort((a, b) => b.updatedOnDay - a.updatedOnDay)[0];
    let blocked = false;
    if (confirmed && (!past || confirmed.updatedOnDay >= past.arrivalDay)) {
        blocked = confirmed.locationId !== fromId;
    } else if (past) blocked = past.toId !== fromId;
    if (!past && !same) {
        // An elapsed unboarded reservation never establishes an actual landfall.
        const earliest = legs.filter(leg => !leg.reserved)
            .sort((a, b) => a.departureDay - b.departureDay)[0];
        blocked ||= !!earliest && earliest.fromId !== fromId;
        blocked ||= standingCrew.some(npc => npc.locationId !== fromId);
    }
    if (!blocked) return { same };
    const changes = [
        ...legs.filter(leg => leg.toId === fromId && leg.arrivalDay > departureDay).map(leg => leg.arrivalDay),
        ...hull.standingCrew.filter(npc => npc.locationId === fromId && npc.updatedOnDay > departureDay)
            .map(npc => npc.updatedOnDay)
    ];
    // A reserved return is only a future opportunity: the quote still verifies
    // actual position there and cannot promote its promised arrival to truth.
    return { same, blockedUntil: changes.length ? Math.min(...changes) : null };
}

/** A first boarding realises the lane's hull at that dock, as the existing crew factory does. */
export function quotePublicPassage(world: ShippingWorld, fromId: string, toId: string,
    departureDay: number, heads = 1, consideredLegs: readonly PublicPassageLeg[] = [],
    crossingSeed = `${world.seed}:${departureDay}`, requestingIds: readonly string[] = [],scope?:PlaceScope): PublicPassageQuote | null {
    return quoteAPublicPassage(world, fromId, toId, departureDay, heads, consideredLegs, crossingSeed, undefined, requestingIds,undefined,scope).quote;
}

/** A real existing hull may take an admitted onward line only from its actual port.
 * This is a quote, not consent, payment or a future boarding. It creates nothing.
 * The same fare/calendar/weather/finite-capacity/position core remains authoritative.
 */
export function quotePublicPassageOnActualHull(world: ShippingWorld, vesselId:string,
    fromId:string,toId:string,departureDay:number,heads=1,
    consideredLegs:readonly PublicPassageLeg[]=[],crossingSeed=`${world.seed}:${departureDay}`,
    requestingIds:readonly string[]=[]):PublicPassageQuote|null {
    if (!world.objects?.some(object=>object.id===vesselId) || !world.npcs
        || !publicShipHullCanBeBoarded({objects:world.objects,npcs:world.npcs,locations:world.locations},
            {vesselId,fromId,departureDay})) return null;
    return quoteAPublicPassage(world,fromId,toId,departureDay,heads,consideredLegs,crossingSeed,
        undefined,requestingIds,vesselId).quote;
}

/** The single fare, weather and hull-position authority behind both public readers. */
function quoteAPublicPassage(world: ShippingWorld, fromId: string, toId: string,
    departureDay: number, heads: number, consideredLegs: readonly PublicPassageLeg[],
    crossingSeed: string, held?: HullRead, requestingIds: readonly string[] = [], actualVesselId?: string,scope?:PlaceScope): { quote: PublicPassageQuote | null; retryAt?: number | null } {
    if (!Number.isInteger(heads) || heads < 1 || !Number.isFinite(departureDay)) return { quote: null };
    scope ??= placeScopeFor(world.locations);
    const from = scope.places.get(fromId);
    const to = scope.places.get(toId);
    if (!from || !to || fromId === toId) return { quote: null };
    const line = publicShipLinesFrom(world, from.name, departureDay,scope).find(one => one.to === to.name);
    if (!line || line.runsFromDay !== null) return { quote: null };
    const lane = line.lane;
    const vesselId = actualVesselId ?? shipIdForLane(lane);
    const hull = held ?? readHull(world, vesselId, consideredLegs);
    if (world.objects && world.npcs && !publicShipHullCanBeBoarded({objects:world.objects,npcs:world.npcs,locations:world.locations},
        {vesselId,fromId,departureDay}, false,{hull:hull.physicalHull,operator:hull.operator})) return {quote:null,retryAt:null};
    const legs = hull.legs;
    const position = hullPositionAt(hull, fromId, toId, departureDay, lane.id);
    if (position.blockedUntil !== undefined) return { quote: null, retryAt: position.blockedUntil };
    const same = position.same;
    const berths=hull.berths();
    const aboard = new Set(berths.aboard.get(departureDay));
    const bookings = shippingHasHistory(world) ? factsWithDataValue(world,'vesselId',vesselId)
        .filter(fact => fact.data.publicPassage===true && fact.data.actualBoarding===true
            && fact.data.departureDay===departureDay && fact.data.fromLocationId===fromId
            && fact.data.toLocationId===toId) : [];
    for (const booking of bookings) for (const actor of booking.actors) if (actor.role==='aboard') aboard.add(actor.id);
    const crewIds=hull.crewIds;
    for (const reserved of hull.legs) if (reserved.reserved && reserved.departureDay===departureDay
        && reserved.fromId===fromId && reserved.toId===toId)
        for (const id of reserved.passengerIds ?? []) aboard.add(id);
    const requesting=new Set(requestingIds);
    if (requesting.size>heads) return {quote:null,retryAt:null};
    const passengers=[...aboard].filter(id=>!crewIds.has(id) && !requesting.has(id)).length;
    // An older player boarding omitted its actor entirely. Do not fabricate
    // free berths from that omission: this unknown active claim blocks another
    // acceptance until the actual dated arrival. A read/refusal stores nothing.
    const unknownLegacy = shippingHasHistory(world) ? factsWithDataValue(world,'vesselId',vesselId)
        .some(fact=>fact.data.publicPassage===true && fact.data.actualBoarding!==true
            && fact.data.departureDay===departureDay && typeof fact.data.runId==='string'
            && typeof fact.data.arrivalDay==='number' && fact.data.arrivalDay>departureDay) : false;
    if (unknownLegacy) return {quote:null,retryAt:same?.arrivalDay ?? null};
    // Existing realised crew occupy berths too; the first boarding uses the
    // exact crew-factory draw before any people or object are materialised.
    const crewHeads=Math.max(berths.crewHeads,
        1+shipHandsForHull(world.seed,vesselId));
    const capacity=requireConveyance('conv-water-ship').heads;
    if (crewHeads+heads>capacity) return {quote:null,retryAt:null};
    if (passengers+crewHeads+heads>capacity) return {quote:null,retryAt:same?.arrivalDay ?? null};
    const provision = provisionForLane(lane, heads);
    const crossing = resolveCrossing(crossingSeed, lane, provision, monthOf(departureDay));
    if (crossing.laneWasShut) return { quote: null };
    const days = same ? same.arrivalDay - same.departureDay : crossing.daysTaken;
    const arrivalDay = departureDay + days;
    if (legs.some(leg => !journeyTimeHasReached(leg.departureDay,arrivalDay) && !journeyTimeHasReached(departureDay,leg.arrivalDay)
        && !(leg.fromId === fromId && leg.toId === toId && leg.departureDay === departureDay))) return { quote: null };
    const next = legs.filter(leg => leg.departureDay >= arrivalDay)
        .sort((a, b) => a.departureDay - b.departureDay)[0];
    if (next && next.fromId !== toId) return { quote: null, retryAt: next.departureDay };
    return { quote: { lane, vesselId, fromId, toId, departureDay, arrivalDay, days, heads,
        fareStones: stonesFor(line.cashPerSeat) * heads, provision, crossing } };
}

/**
 * The earliest day-based sailing which can still reach a physical occasion.
 * Exact readiness and hull event times are candidates; between them crossing
 * weather is drawn for each calendar day, rather than an invented service cadence.
 * Occupied spans and closed seasons skip to their existing physical/calendar end.
 */
export function earliestQuotedPublicPassage(world: ShippingWorld, fromId: string, toId: string,
    readyDay: number, latestUsefulArrival: number, heads = 1,
    consideredLegs: readonly PublicPassageLeg[] = [],scope?:PlaceScope): PublicPassageQuote | null {
    if (!Number.isFinite(readyDay) || !Number.isFinite(latestUsefulArrival)
        || latestUsefulArrival <= readyDay || !Number.isInteger(heads) || heads < 1) return null;
    scope ??= placeScopeFor(world.locations);
    const from = scope.places.get(fromId);
    const to = scope.places.get(toId);
    if (!from || !to || fromId === toId) return null;
    const line = publicShipLinesFrom(world, from.name, readyDay,scope).find(one => one.to === to.name);
    if (!line) return null;
    const vesselId = shipIdForLane(line.lane);
    const hull = readHull(world, vesselId, consideredLegs);
    const legs = hull.legs;
    const events = [...new Set(legs.flatMap(leg => [leg.departureDay, leg.arrivalDay]))]
        .filter(day => day > readyDay && day < latestUsefulArrival).sort((a, b) => a - b);
    let event = 0;
    let day = readyDay;
    // resolveCrossing's existing physical minimum is one day, including short lanes.
    while (day + 1 <= latestUsefulArrival) {
        const position = hullPositionAt(hull, fromId, toId, day, line.lane.id);
        if (position.blockedUntil === null) return null;
        if (position.blockedUntil !== undefined) {
            day = position.blockedUntil;
            continue;
        }
        if (!laneIsOpenInMonth(line.lane, monthOf(day))) {
            const opens = whenTheLaneRuns(line.lane, Math.ceil(day));
            if (opens === null || opens <= day) return null;
            day = opens;
            continue;
        }
        const reading = quoteAPublicPassage(world, fromId, toId, day, heads, consideredLegs, `${world.seed}:${day}`, hull,undefined,undefined,scope);
        const quoted = reading.quote;
        if (quoted && quoted.arrivalDay <= latestUsefulArrival) return quoted;
        if (reading.retryAt === null) return null;
        if (reading.retryAt !== undefined && reading.retryAt > day) {
            day = reading.retryAt;
            continue;
        }
        const occupied = legs.filter(leg => leg.departureDay <= day && day < leg.arrivalDay
            && !(leg.departureDay === day && leg.fromId === fromId && leg.toId === toId));
        if (occupied.length) {
            day = Math.max(...occupied.map(leg => leg.arrivalDay));
            continue;
        }
        while (event < events.length && events[event]! <= day) event++;
        day = Math.min(Math.floor(day) + 1, events[event] ?? Infinity);
    }
    return null;
}

/** One activity writer for paid personal berths, house-sponsored berths and the actual crew. */
export function activityOfAPublicPassage(leg: PublicPassageLeg, purpose: string, withIds: string[] = []): NpcActivity {
    return { kind: 'travelling', note: purpose, withIds,
        fromLocationId: leg.fromId, returnTo: leg.toId, sinceDay: leg.departureDay,
        untilDay: leg.arrivalDay, seaLaneId: leg.lane.id, vesselId: leg.vesselId };
}

/** The caller pays the quoted sponsoring purse once; no personal wallet is injected. */
export function onSponsoredPublicPassage(world: ShippingWorld, npc: NpcRecord, quote: PublicPassageQuote,
    purpose: string, withIds: string[] = []): NpcRecord | null {
    if (npc.status !== 'alive' || locationOnNpcJourney(world.locations, npc, quote.departureDay) !== quote.fromId) return null;
    return { ...npc, activity: companyDuringPassage(npc.activity, activityOfAPublicPassage(quote, purpose, withIds), quote.departureDay), updatedOnDay: quote.departureDay };
}


/** A historical booking/course change survives the people who once carried it. */
export function recordPublicPassage(world: WorldState, leg: PublicPassageLeg,
    onDay = leg.departureDay, locationId = leg.fromId, actorIds: readonly string[] = [],
    priorReceiptId?: string, boardingMoment?: PassageRunMoment,
    boardingPeople?: readonly {id:string;name:string}[], onwardAgreementId?:string, lost=false): HistoricalFact {
    const parent = priorReceiptId ? witnessIndexFor(world).byId.get(priorReceiptId) : undefined;
    const validParent = parent?.data.publicPassage === true && parent.data.vesselId === leg.vesselId
        && (parent.data.seaLaneId === leg.lane.id
            || onwardAgreementId && typeof parent.data.arrivalDay==='number'
                && journeyTimeHasReached(leg.departureDay,parent.data.arrivalDay) && parent.data.toLocationId===leg.fromId)
        && parent.day <= onDay
        && typeof parent.data.departureDay === 'number' && parent.data.departureDay <= leg.departureDay
        ? parent : undefined;
    const previous = validParent ?? factsWithDataValue(world, 'vesselId', leg.vesselId)
        .filter(fact => fact.data.publicPassage === true && fact.data.departureDay === leg.departureDay)
        .sort((a, b) => b.day - a.day)[0];
    const actors = actorIds.flatMap(id => {
        const named=boardingPeople?.find(person=>person.id===id);
        const npc=world.npcs.find(person=>person.id===id);
        return named || npc ? [{id,name:named?.name ?? npc!.name,role:'aboard'}] : [];
    });
    // A supplied historic parent establishes lineage, not uniqueness. Repeated
    // settlement asks the same existing receipt identity, including its actors.
    const existing = factsWithDataValue(world, 'vesselId', leg.vesselId).find(candidate =>
        candidate.data.publicPassage === true && candidate.data.departureDay === leg.departureDay
        && (!validParent || candidate.id === validParent.id || candidate.causes.includes(validParent.id))
        && (!lost || candidate.data.publicPassageLost === true)
        && actors.every(actor => candidate.actors.some(prior => prior.id === actor.id))
        && (!boardingPeople?.length || candidate.data.actualBoarding === true)
        && candidate.data.fromLocationId === leg.fromId && candidate.data.toLocationId === leg.toId
        && candidate.data.arrivalDay === leg.arrivalDay && candidate.data.seaLaneId === leg.lane.id
        && (!boardingMoment || candidate.data.runId === boardingMoment.runId
            && candidate.data.boardingRunElapsedDays === boardingMoment.elapsedDays));
    if (existing) return existing;
    if (previous && (!lost || previous.data.publicPassageLost===true) && actors.every(actor=>previous.actors.some(prior=>prior.id===actor.id))
        && (!boardingPeople?.length || previous.data.actualBoarding===true)
        && previous.data.fromLocationId === leg.fromId && previous.data.toLocationId === leg.toId
        && previous.data.arrivalDay === leg.arrivalDay && previous.data.seaLaneId === leg.lane.id
        && (!boardingMoment || previous.data.runId === boardingMoment.runId
            && previous.data.boardingRunElapsedDays === boardingMoment.elapsedDays)) return previous;
    return appendWorldFact(world, makeFact({ day: onDay, kind: 'gathering', locationId,
        summary: `Public ship passage: ${leg.fromId} to ${leg.toId}; arrival day ${leg.arrivalDay}.`,
        visibility: 'public', causes: previous ? [previous.id] : [],
        actors, data: { publicPassage: true, vesselId: leg.vesselId, seaLaneId: leg.lane.id,
            fromLocationId: leg.fromId, toLocationId: leg.toId,
            departureDay: leg.departureDay, arrivalDay: leg.arrivalDay,
            ...(boardingPeople?.length ? {actualBoarding:true} : {}),
            ...(onwardAgreementId && validParent ? {onwardAgreementId} : {}),
            ...(lost ? {publicPassageLost:true} : {}),
            ...(boardingMoment ? { runId: boardingMoment.runId,
                boardingRunElapsedDays: boardingMoment.elapsedDays } : {}) } }), { recur: false });
}
