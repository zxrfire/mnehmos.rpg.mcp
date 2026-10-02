/** In-memory readings of the one history ledger, updated as rows arrive or leave. */
import type { HistoricalFact } from './history.js';
import type { WorldState } from './world-state.js';
import { SENT_WORD_HOME, WENT_AND_CAME_BACK } from './who-goes-out-for-a-house-and-what-comes-back.js';

interface IndexedObservation { actorId: string; state: string }

export interface WitnessIndex {
    facts: readonly HistoricalFact[];
    length: number;
    tail: HistoricalFact | undefined;
    nextOrder: number;
    nextPosition: number;
    inserted: string[];
    introduced: Set<string>;
    byId: Map<string, HistoricalFact>;
    order: Map<string, number>;
    byYear: Map<number, HistoricalFact[]>;
    byKind: Map<HistoricalFact['kind'], HistoricalFact[]>;
    byPlace: Map<string, HistoricalFact[]>;
    stoodOn: Map<string, Map<string, Set<string>>>;
    reportedGround: Map<string, Map<string, Set<string>>>;
    byData: Map<string, HistoricalFact[]>;
    byDataValue: Map<string, Map<string | number | boolean | null, Set<HistoricalFact>>>;
    rumoured: Set<HistoricalFact>;
    competitions: Map<string, { closed: boolean; entries: HistoricalFact[]; resultIds: Set<string> }>;
    pendingCompetitions: Set<string>;
    pricesByYear: Map<number, HistoricalFact[]>;
    longestPriceSpan: number;
    paidPrices: Map<string, Set<string>>;
    references: Map<string, Set<HistoricalFact>>;
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
function referenceKeys(fact: HistoricalFact): string[] {
    return [...fact.actors.map(actor => actor.id), ...fact.witnessIds, ...fact.causes,
        ...Object.values(fact.data).filter((value): value is string => typeof value === 'string'),
        ...(fact.consequences?.beneficiaries.map(actor => actor.id) ?? []),
        ...(fact.consequences?.losers.map(actor => actor.id) ?? []),
        ...(fact.consequences?.relationshipChanges.flatMap(change => [change.aId, change.bId]) ?? [])];
}

function rememberReferences(index: WitnessIndex, fact: HistoricalFact): void {
    for (const key of referenceKeys(fact)) {
        const rows = index.references.get(key) ?? new Set();
        rows.add(fact);
        index.references.set(key, rows);
    }
}

function groundReferences(index: WitnessIndex, fact: HistoricalFact, add: boolean): void {
    if (fact.locationId === null) return;
    const update = (map: WitnessIndex['stoodOn'], ids: Iterable<string>): void => {
        const place = map.get(fact.locationId!) ?? new Map<string, Set<string>>();
        for (const id of ids) {
            const rows = place.get(id) ?? new Set<string>();
            if (add) rows.add(fact.id); else rows.delete(fact.id);
            if (rows.size > 0) place.set(id, rows); else place.delete(id);
        }
        if (place.size > 0) map.set(fact.locationId!, place); else map.delete(fact.locationId!);
    };
    update(index.stoodOn, [...fact.actors.filter(actor => actor.role !== SENT_WORD_HOME).map(actor => actor.id), ...fact.witnessIds]);
    if (fact.actors.some(actor => actor.role === WENT_AND_CAME_BACK || actor.role === SENT_WORD_HOME)) {
        update(index.reportedGround, fact.factionIds);
    }
}
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

function addFact(index: WitnessIndex, fact: HistoricalFact, arrays = true): void {
    index.byId.set(fact.id, fact);
    rememberReferences(index, fact);
    groundReferences(index, fact, true);
    for (const [key, values] of index.byDataValue) {
        const value = fact.data[key];
        if (value === undefined) continue;
        const rows = values.get(value) ?? new Set();
        rows.add(fact); values.set(value, rows);
    }
    const push = <K>(map: Map<K, HistoricalFact[]>, key: K): void => {
        const rows = map.get(key) ?? [];
        rows.push(fact);
        map.set(key, rows);
    };
    if (arrays) {
        push(index.byKind, fact.kind);
        if (fact.locationId !== null) push(index.byPlace, fact.locationId);
        for (const key of index.byData.keys()) {
            if (fact.data[key] !== undefined) push(index.byData, key);
        }
    }
    if (fact.data.openCompetition === true) {
        const key = `${fact.data.hostId}|${fact.data.contestDay}`;
        const board = index.competitions.get(key) ?? { closed: false, entries: [], resultIds: new Set<string>() };
        if (fact.data.result === true) board.resultIds.add(fact.id);
        board.closed = board.resultIds.size > 0;
        if (fact.data.entry === true && !board.entries.some(row => row.id === fact.id)) board.entries.push(fact);
        index.competitions.set(key, board);
        if (board.closed) index.pendingCompetitions.delete(key);
        else index.pendingCompetitions.add(key);
    }
    if ((fact.consequences?.rumours.length ?? 0) > 0) index.rumoured.add(fact);
    if (!index.order.has(fact.id)) {
        index.order.set(fact.id, index.nextPosition++);
    }
    if (!index.introduced.has(fact.id)) {
        index.introduced.add(fact.id);
        index.nextOrder++;
        index.inserted.push(fact.id);
    }
    const year = Math.floor(fact.day / 365);
    if (fact.kind === 'bounty_posted') {
        index.longestPriceSpan = Math.max(index.longestPriceSpan, Number(fact.data.lapsesOnDay ?? fact.day) - fact.day);
        if (arrays) push(index.pricesByYear, year);
    }
    if (fact.kind === 'grudge_settled' && typeof fact.data.priceFactId === 'string') {
        const rows = index.paidPrices.get(fact.data.priceFactId) ?? new Set();
        rows.add(fact.id); index.paidPrices.set(fact.data.priceFactId, rows);
    }
    if (arrays) {
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

function removeFact(index: WitnessIndex, fact: HistoricalFact, dropped: boolean, arrays = true): void {
    index.byId.delete(fact.id);
    groundReferences(index, fact, false);
    for (const [key, values] of index.byDataValue) {
        const rows = values.get(fact.data[key]!);
        rows?.delete(fact);
        if (rows?.size === 0) values.delete(fact.data[key]!);
    }
    if (fact.kind === 'grudge_settled' && typeof fact.data.priceFactId === 'string') {
        const rows = index.paidPrices.get(fact.data.priceFactId);
        rows?.delete(fact.id);
        if (rows?.size === 0) index.paidPrices.delete(fact.data.priceFactId);
    }
    for (const key of referenceKeys(fact)) {
        const rows = index.references.get(key);
        rows?.delete(fact);
        if (rows?.size === 0) index.references.delete(key);
    }
    const remove = (map: Map<string, HistoricalFact[]>, key: string): void => {
        map.set(key, (map.get(key) ?? []).filter(row => row.id !== fact.id));
    };
    if (arrays) {
        remove(index.byKind, fact.kind);
        if (fact.locationId !== null) remove(index.byPlace, fact.locationId);
        for (const key of index.byData.keys()) {
            if (fact.data[key] !== undefined) remove(index.byData, key);
        }
    }
    index.rumoured.delete(fact);
    if (dropped) index.order.delete(fact.id);
    const year = Math.floor(fact.day / 365);
    if (arrays) {
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
        const previous = index;
        index = { facts, length: 0, tail: undefined, nextOrder: previous?.nextOrder ?? 0,
            nextPosition: 0, inserted: previous?.inserted ?? [], introduced: previous?.introduced ?? new Set(),
            byId: new Map(), order: new Map(), byYear: new Map(), byActor: new Map(), observed: new Set(),
            byKind: new Map(), byPlace: new Map(), stoodOn: new Map(), reportedGround: new Map(),
            byData: new Map(), byDataValue: new Map(), rumoured: new Set(),
            competitions: new Map(),
            pendingCompetitions: new Set(),
            pricesByYear: new Map(), longestPriceSpan: 0, paidPrices: new Map(),
            references: new Map(),
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

export function factsAddedSince(world: WorldState, cursor: number): HistoricalFact[] {
    const index = witnessIndexFor(world);
    const out: HistoricalFact[] = [];
    for (let at = cursor; at < index.inserted.length; at++) {
        const fact = index.byId.get(index.inserted[at]!);
        if (fact) out.push(fact);
    }
    return out.sort((a, b) => index.order.get(a.id)! - index.order.get(b.id)!);
}

/** A sparse column is indexed on first use, then only appended rows are read. */
export function factsWithData(world: WorldState, key: string): readonly HistoricalFact[] {
    const index = witnessIndexFor(world);
    let rows = index.byData.get(key);
    if (!rows) {
        rows = world.history.facts.filter(fact => fact.data[key] !== undefined);
        index.byData.set(key, rows);
    }
    return rows;
}

export function factsInSpan(world: WorldState, fromDay: number, toDay: number): HistoricalFact[] {
    const index = witnessIndexFor(world);
    const rows: HistoricalFact[] = [];
    for (let year = Math.floor(fromDay / 365); year <= Math.floor(toDay / 365); year++) {
        for (const fact of index.byYear.get(year) ?? []) {
            if (fact.day >= fromDay && fact.day <= toDay) rows.push(fact);
        }
    }
    return rows.sort((a, b) => index.order.get(a.id)! - index.order.get(b.id)!);
}

/** A receipt or report keyed by the subject recorded in its sparse column. */
export function factsWithDataValue(world: WorldState, key: string,
    value: string | number | boolean | null): HistoricalFact[] {
    const index = witnessIndexFor(world);
    let values = index.byDataValue.get(key);
    if (!values) {
        values = new Map();
        for (const fact of factsWithData(world, key)) {
            const held = values.get(fact.data[key]!) ?? new Set<HistoricalFact>();
            held.add(fact); values.set(fact.data[key]!, held);
        }
        index.byDataValue.set(key, values);
    }
    return [...values.get(value) ?? []].sort((a, b) => index.order.get(a.id)! - index.order.get(b.id)!);
}

export function recordWitnessObservations(world: WorldState, fact: HistoricalFact,
    rows: readonly IndexedObservation[]): void {
    const index = witnessIndexFor(world);
    if (!index.order.has(fact.id)) return;
    rememberReferences(index, fact);
    groundReferences(index, fact, true);
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

/** A recurrence can acquire witnesses and causes without appending another row. */
export function noteFactReferences(world: WorldState, fact: HistoricalFact): void {
    const index = INDEXES.get(world);
    if (!index?.byId.has(fact.id)) return;
    rememberReferences(index, fact);
    groundReferences(index, fact, true);
    for (const id of [...fact.witnessIds, ...fact.actors.map(actor => actor.id)]) {
        const rows = index.presentAt.get(id) ?? new Set<string>();
        rows.add(fact.id);
        index.presentAt.set(id, rows);
    }
}

/** The dead-person sweep already knows which facts it kept and replaced. */
export function witnessHistoryWasPruned(world: WorldState,
    previous: readonly HistoricalFact[], dropped: ReadonlySet<string>,
    replaced?: ReadonlyMap<string, HistoricalFact>): void {
    const index = INDEXES.get(world);
    if (!index || index.facts !== previous) return;
    const replacements = new Map<string, HistoricalFact>(replaced);
    if (!replaced) for (const fact of world.history.facts) {
        if (index.byId.get(fact.id) !== fact) replacements.set(fact.id, fact);
    }
    const changed = [...dropped, ...replacements.keys()]
        .map(id => index.byId.get(id)).filter((fact): fact is HistoricalFact => fact !== undefined);
    const update = <K>(map: Map<K, HistoricalFact[]>, keys: Iterable<K>,
        belongs: (row: HistoricalFact, key: K) => boolean = () => true): void => {
        for (const key of new Set(keys)) {
            const rows = map.get(key);
            if (!rows) continue;
            const first = rows.findIndex(row => dropped.has(row.id) || replacements.has(row.id));
            if (first < 0) continue;
            const kept = rows.slice(0, first);
            for (let at = first; at < rows.length; at++) {
                const row = rows[at]!;
                const replacement = replacements.get(row.id) ?? row;
                if (!dropped.has(row.id) && belongs(replacement, key)) kept.push(replacement);
            }
            if (kept.length > 0) map.set(key, kept); else map.delete(key);
        }
    };
    update(index.byKind, changed.map(fact => fact.kind));
    update(index.byYear, changed.map(fact => Math.floor(fact.day / 365)));
    update(index.pricesByYear, changed.filter(fact => fact.kind === 'bounty_posted').map(fact => Math.floor(fact.day / 365)));
    update(index.byPlace, changed.flatMap(fact => fact.locationId === null ? [] : [fact.locationId]));
    update(index.byData, [...index.byData.keys()].filter(key => changed.some(fact => fact.data[key] !== undefined)));
    update(index.factsByHouse, changed.flatMap(fact => fact.factionIds));
    update(index.factsByPerson, changed.flatMap(fact => fact.actors.map(actor => actor.id)),
        (fact, id) => fact.actors.some(actor => actor.id === id));
    for (const key of new Set(changed.filter(fact => fact.data.openCompetition === true)
        .map(fact => `${fact.data.hostId}|${fact.data.contestDay}`))) {
        const board = index.competitions.get(key)!;
        board.entries = board.entries.filter(row => !dropped.has(row.id)).map(row => replacements.get(row.id) ?? row);
        for (const id of dropped) board.resultIds.delete(id);
        board.closed = board.resultIds.size > 0;
        if (!board.closed && board.entries.length > 0) index.pendingCompetitions.add(key);
        if (board.entries.length === 0 && board.resultIds.size === 0) {
            index.competitions.delete(key);
            index.pendingCompetitions.delete(key);
        }
    }
    for (const id of dropped) {
        const old = index.byId.get(id);
        if (old) removeFact(index, old, true, false);
    }
    for (const fact of replacements.values()) {
        const old = index.byId.get(fact.id);
        if (old === fact) continue;
        if (old) removeFact(index, old, false, false);
        addFact(index, fact, !old);
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
