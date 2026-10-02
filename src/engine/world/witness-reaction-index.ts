/** In-memory readings of the one history ledger, updated as rows arrive or leave. */
import type { HistoricalFact } from './history.js';
import type { WorldState } from './world-state.js';

interface IndexedObservation { actorId: string; state: string }

export interface WitnessIndex {
    facts: readonly HistoricalFact[];
    length: number;
    tail: HistoricalFact | undefined;
    nextOrder: number;
    byId: Map<string, HistoricalFact>;
    order: Map<string, number>;
    byYear: Map<number, HistoricalFact[]>;
    byActor: Map<string, HistoricalFact[]>;
    factsByHouse: Map<string, HistoricalFact[]>;
    factsByPerson: Map<string, HistoricalFact[]>;
    presentAt: Map<string, Set<string>>;
    observed: Set<HistoricalFact>;
    pending: Set<HistoricalFact>;
    pendingByPlace: Map<string, Set<HistoricalFact>>;
    pendingByPerson: Map<string, Set<HistoricalFact>>;
    seenBody: Set<string>;
    seenEvidence: Set<string>;
    reports: Map<string, Map<string, HistoricalFact>>;
    warnings: Set<string>;
}

const INDEXES = new WeakMap<WorldState, WitnessIndex>();
export const evidenceKey = (evidenceId: string, actorId: string, witnessId: string): string =>
    `${evidenceId}\u001f${actorId}\u001f${witnessId}`;

function observations(fact: HistoricalFact): IndexedObservation[] {
    return typeof fact.data.witnessReactions === 'string'
        ? JSON.parse(fact.data.witnessReactions) as IndexedObservation[] : [];
}

function pendingKeys(index: WitnessIndex, fact: HistoricalFact, add: boolean): void {
    const update = (map: Map<string, Set<HistoricalFact>>, key: string): void => {
        if (add) {
            const held = map.get(key) ?? new Set<HistoricalFact>();
            held.add(fact);
            map.set(key, held);
        } else {
            const held = map.get(key);
            held?.delete(fact);
            if (held?.size === 0) map.delete(key);
        }
    };
    if (fact.locationId !== null) update(index.pendingByPlace, fact.locationId);
    for (const id of new Set([...fact.actors.map(actor => actor.id), ...fact.witnessIds])) {
        update(index.pendingByPerson, id);
    }
}

function addFact(index: WitnessIndex, fact: HistoricalFact): void {
    index.byId.set(fact.id, fact);
    if (!index.order.has(fact.id)) index.order.set(fact.id, index.nextOrder++);
    const year = Math.floor(fact.day / 365);
    const inYear = index.byYear.get(year) ?? [];
    inYear.push(fact);
    index.byYear.set(year, inYear);
    for (const houseId of fact.factionIds) {
        const rows = index.factsByHouse.get(houseId) ?? [];
        rows.push(fact);
        index.factsByHouse.set(houseId, rows);
    }
    for (const actor of fact.actors) {
        const rows = index.factsByPerson.get(actor.id) ?? [];
        rows.push(fact);
        index.factsByPerson.set(actor.id, rows);
    }
    for (const id of new Set([...fact.actors.map(actor => actor.id), ...fact.witnessIds])) {
        const held = index.presentAt.get(id) ?? new Set<string>();
        held.add(fact.id);
        index.presentAt.set(id, held);
    }
    const rows = observations(fact);
    if (rows.length > 0) index.observed.add(fact);
    if (rows.some(row => row.state === 'pending')) {
        index.pending.add(fact);
        pendingKeys(index, fact, true);
    }
    for (const actorId of new Set(rows.map(row => row.actorId))) {
        const actors = index.byActor.get(actorId) ?? [];
        actors.push(fact);
        index.byActor.set(actorId, actors);
    }
    const bodyId = fact.data.seenWithBody === true && typeof fact.data.bodyId === 'string'
        ? fact.data.bodyId : null;
    const objectId = typeof fact.data.seenWithEvidence === 'string'
        ? fact.data.seenWithEvidence : null;
    if (bodyId !== null || objectId !== null) {
        for (const actor of fact.actors) for (const witnessId of fact.witnessIds) {
            if (bodyId !== null) index.seenBody.add(evidenceKey(bodyId, actor.id, witnessId));
            if (objectId !== null) index.seenEvidence.add(evidenceKey(objectId, actor.id, witnessId));
        }
    }
    const reportedId = typeof fact.data.witnessReport === 'string' ? fact.data.witnessReport : null;
    if (reportedId !== null) {
        const reports = index.reports.get(reportedId) ?? new Map();
        if (typeof fact.data.reportedBy === 'string') reports.set(fact.data.reportedBy, fact);
        index.reports.set(reportedId, reports);
        if (fact.data.houseWarning === true) index.warnings.add(reportedId);
    }
}

function removeFact(index: WitnessIndex, fact: HistoricalFact, dropped: boolean): void {
    index.byId.delete(fact.id);
    if (dropped) index.order.delete(fact.id);
    const year = Math.floor(fact.day / 365);
    index.byYear.set(year, (index.byYear.get(year) ?? []).filter(row => row.id !== fact.id));
    for (const houseId of fact.factionIds) {
        const rows = (index.factsByHouse.get(houseId) ?? []).filter(row => row.id !== fact.id);
        if (rows.length > 0) index.factsByHouse.set(houseId, rows);
        else index.factsByHouse.delete(houseId);
    }
    for (const actorId of new Set(fact.actors.map(actor => actor.id))) {
        const rows = (index.factsByPerson.get(actorId) ?? []).filter(row => row.id !== fact.id);
        if (rows.length > 0) index.factsByPerson.set(actorId, rows);
        else index.factsByPerson.delete(actorId);
    }
    for (const id of new Set([...fact.actors.map(actor => actor.id), ...fact.witnessIds])) {
        const held = index.presentAt.get(id);
        held?.delete(fact.id);
        if (held?.size === 0) index.presentAt.delete(id);
    }
    index.observed.delete(fact);
    index.pending.delete(fact);
    pendingKeys(index, fact, false);
    for (const actorId of new Set(observations(fact).map(row => row.actorId))) {
        const actors = (index.byActor.get(actorId) ?? []).filter(row => row.id !== fact.id);
        if (actors.length > 0) index.byActor.set(actorId, actors);
        else index.byActor.delete(actorId);
    }
    const reportedId = typeof fact.data.witnessReport === 'string' ? fact.data.witnessReport : null;
    if (reportedId !== null && typeof fact.data.reportedBy === 'string') {
        const reports = index.reports.get(reportedId);
        if (reports?.get(fact.data.reportedBy)?.id === fact.id) reports.delete(fact.data.reportedBy);
        if (reports?.size === 0) index.reports.delete(reportedId);
        if (fact.data.houseWarning === true && ![...(reports?.values() ?? [])]
            .some(row => row.data.houseWarning === true)) index.warnings.delete(reportedId);
    }
}

export function witnessIndexFor(world: WorldState): WitnessIndex {
    const facts = world.history.facts;
    let index = INDEXES.get(world);
    if (!index || index.facts !== facts || index.length > facts.length
        || index.length > 0 && facts[index.length - 1] !== index.tail) {
        index = { facts, length: 0, tail: undefined, nextOrder: 0, byId: new Map(),
            order: new Map(), byYear: new Map(), byActor: new Map(), observed: new Set(),
            factsByHouse: new Map(), factsByPerson: new Map(), presentAt: new Map(),
            pending: new Set(), pendingByPlace: new Map(), pendingByPerson: new Map(),
            seenBody: new Set(), seenEvidence: new Set(),
            reports: new Map(), warnings: new Set() };
        INDEXES.set(world, index);
    }
    for (let at = index.length; at < facts.length; at++) addFact(index, facts[at]!);
    index.length = facts.length;
    index.tail = facts[facts.length - 1];
    return index;
}

export function recordWitnessObservations(world: WorldState, fact: HistoricalFact,
    rows: readonly IndexedObservation[]): void {
    const index = witnessIndexFor(world);
    if (!index.order.has(fact.id)) return;
    if (rows.some(row => row.state === 'pending')) {
        index.pending.add(fact);
        pendingKeys(index, fact, true);
    } else {
        index.pending.delete(fact);
        pendingKeys(index, fact, false);
    }
    if (rows.length > 0) index.observed.add(fact);
    for (const witnessId of fact.witnessIds) {
        const held = index.presentAt.get(witnessId) ?? new Set<string>();
        held.add(fact.id);
        index.presentAt.set(witnessId, held);
    }
    for (const row of rows) {
        const actors = index.byActor.get(row.actorId) ?? [];
        if (!actors.includes(fact)) actors.push(fact);
        index.byActor.set(row.actorId, actors);
    }
}

/** The dead-person sweep already knows which facts it kept and replaced. */
export function witnessHistoryWasPruned(world: WorldState,
    previous: readonly HistoricalFact[], dropped: ReadonlySet<string>): void {
    const index = INDEXES.get(world);
    if (!index || index.facts !== previous) return;
    for (const id of dropped) {
        const old = index.byId.get(id);
        if (old) removeFact(index, old, true);
    }
    for (const fact of world.history.facts) {
        const old = index.byId.get(fact.id);
        if (old === fact) continue;
        if (old) removeFact(index, old, false);
        addFact(index, fact);
    }
    index.facts = world.history.facts;
    index.length = world.history.facts.length;
    index.tail = world.history.facts[world.history.facts.length - 1];
}

export function recentWitnessFacts(index: WitnessIndex, day: number): HistoricalFact[] {
    const first = Math.floor((day - 365) / 365);
    const last = Math.floor(day / 365);
    const rows: HistoricalFact[] = [];
    for (let year = first; year <= last; year++) rows.push(...(index.byYear.get(year) ?? []));
    return rows.filter(fact => fact.day >= day - 365 && fact.day <= day)
        .sort((a, b) => (index.order.get(a.id) ?? 0) - (index.order.get(b.id) ?? 0));
}
