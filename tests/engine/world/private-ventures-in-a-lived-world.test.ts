/**
 * An arranged private trip does not prove the annual writer reaches actual
 * officeless elders. This walks the unaltered living catalog for thirty years
 * and records who went, where, and what their native work and auction paths did.
 * It neither clears activities nor seeds remembered destinations for them.
 */
import { expect, it } from 'vitest';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { writeFileSync } from 'node:fs';

it('real elders undertake private journeys on their own dates and purse', async () => {
    const state = seedWorld({ seed: 'private-ventures-lived-world', catalog: await loadCultivationCatalog() }).state;
    const started = new Map<string, { person: string; destination: string; auction: boolean }>();
    const completed = new Set<string>();
    const bidders = new Set<string>();
    const initialPeople = state.npcs.length;
    const began = performance.now();
    for (let year = 0; year < 30; year++) {
        advanceWorldForPlay(state, { days: 365 });
        for (const fact of state.history.facts) {
            if (typeof fact.data.privateSponsorId === 'string') started.set(fact.id, {
                person: fact.data.privateSponsorId, destination: String(fact.data.destinationId),
                auction: fact.data.privateVenture !== true });
            if (fact.data.finished === true && started.has(String(fact.data.missionWork))) completed.add(String(fact.data.missionWork));
            if (fact.data.auctionBid === true && fact.actors.some(actor => [...started.values()].some(trip => trip.person === actor.id)))
                for (const actor of fact.actors) bidders.add(actor.id);
        }
    }
    const report = { seed: state.seed, years: 30, milliseconds: performance.now() - began, initialPeople,
        departures: started.size, people: new Set([...started.values()].map(trip => trip.person)).size,
        destinations: new Set([...started.values()].map(trip => trip.destination)).size,
        auctionVisits: [...started.values()].filter(trip => trip.auction).length,
        completedWork: completed.size, bidders: [...bidders], trips: [...started] };
    writeFileSync('.claude/w02-lived-world-evidence.json', JSON.stringify(report, null, 2));
    expect(started.size).toBeGreaterThan(0);
    expect(report.people).toBeGreaterThan(0);
}, 180_000);
