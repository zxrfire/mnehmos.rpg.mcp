import { describe, it, expect } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    advanceWorldForPlay,
    advanceWorldYears,
    worldShape
} from '../../../src/engine/world/driver.js';
import { applyPressure, pressureTemplates } from '../../../src/engine/world/pressure.js';
import {
    MARKET_MAGNITUDE,
    buildPlayerDigest,
    namesPermitted,
    simpleAccess,
    unattributedTextOf
} from '../../../src/engine/world/digest.js';
import { cloneWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { makeFact, appendFact, queryFacts } from '../../../src/engine/world/history.js';

const YEAR = 365;

function world(seed = 'drv-a', population = 250): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population }).state;
}

// ─────────────────────────────────────────────────────────────────────────
// PRESSURE
// ─────────────────────────────────────────────────────────────────────────

describe('pressure: the world changes on its own', () => {
    it('makes things happen over a span that would otherwise be silent', () => {
        const state = world();
        const before = state.history.facts.length;
        const out = applyPressure(state, state.currentDay, state.currentDay + 50 * YEAR);
        expect(out.events.length).toBeGreaterThan(10);
        expect(state.history.facts.length).toBeGreaterThan(before);
        expect(out.yearsStepped).toBe(50);
    });

    it('is deterministic and decomposable across a split span', () => {
        const a = world('drv-split');
        const b = world('drv-split');
        const start = a.currentDay;

        applyPressure(a, start, start + 60 * YEAR);
        applyPressure(b, start, start + 20 * YEAR);
        applyPressure(b, start + 20 * YEAR, start + 60 * YEAR);

        expect(b.history.facts.map(f => f.summary)).toEqual(a.history.facts.map(f => f.summary));
        expect(JSON.stringify(b.factions)).toBe(JSON.stringify(a.factions));
    });

    it('writes real state, not just a line of prose', () => {
        const state = world('drv-state');
        const veinsBefore = state.locations
            .filter(l => l.kind === 'vein')
            .map(l => `${l.id}:${l.controllingFactionId}`)
            .join('|');
        const out = applyPressure(state, state.currentDay, state.currentDay + 120 * YEAR);

        const veinEvents = out.events.filter(e => e.kind === 'vein_lost');
        expect(veinEvents.length).toBeGreaterThan(0);
        const veinsAfter = state.locations
            .filter(l => l.kind === 'vein')
            .map(l => `${l.id}:${l.controllingFactionId}`)
            .join('|');
        expect(veinsAfter).not.toBe(veinsBefore);

        // Every event names something it actually moved, and every fact it
        // wrote is in the ledger.
        const factIds = new Set(state.history.facts.map(f => f.id));
        for (const event of out.events) {
            expect(factIds.has(event.fact.id)).toBe(true);
            const touched =
                event.touched.factions.length + event.touched.locations.length + event.touched.npcs.length;
            expect(touched).toBeGreaterThan(0);
        }
    });

    it('binds to entities that exist rather than inventing them', () => {
        const state = world('drv-bind');
        const out = applyPressure(state, state.currentDay, state.currentDay + 200 * YEAR);
        const factionIds = new Set(state.factions.map(f => f.id));
        const locationIds = new Set(state.locations.map(l => l.id));
        const npcIds = new Set(state.npcs.map(n => n.id));

        for (const event of out.events) {
            for (const id of event.touched.factions) expect(factionIds.has(id)).toBe(true);
            for (const id of event.touched.locations) expect(locationIds.has(id)).toBe(true);
            for (const id of event.touched.npcs) expect(npcIds.has(id)).toBe(true);
        }
    });

    it('goes quiet when the world runs out of institutions', () => {
        const state = world('drv-quiet');
        for (const f of state.factions) f.dissolvedOnDay = state.currentDay;
        const out = applyPressure(state, state.currentDay, state.currentDay + 40 * YEAR);
        // A floor, not silence, and far below a live world's rate.
        expect(out.events.length).toBeLessThan(20);
    });

    it('schedules its own follow-ons: a war opened now settles later', () => {
        const state = world('drv-war');
        const before = state.schedule.length;
        const out = applyPressure(state, state.currentDay, state.currentDay + 300 * YEAR);

        // Assert the invariant, not the draw: a weighted table may or may not
        // produce a war in any given span, but every war it does produce must
        // have put its own ending on the books.
        const opened = out.events.filter(e => e.kind === 'war_opened');
        const scheduled = state.schedule.filter(e => e.kind === 'war_resolves');
        expect(scheduled.length).toBe(opened.length);
        if (opened.length > 0) expect(state.schedule.length).toBeGreaterThan(before);
        for (const war of scheduled) {
            expect(war.dueOnDay).toBeGreaterThan(war.data.openedOnDay ?? 0);
            expect(war.fired).toBe(false);
        }
    });

    it('authors a name-free consequence on every event it produces', () => {
        const state = world('drv-unattr');
        const out = applyPressure(state, state.currentDay, state.currentDay + 200 * YEAR);
        expect(out.events.length).toBeGreaterThan(20);

        const names = state.factions.map(f => f.name)
            .concat(state.npcs.slice(0, 200).map(n => n.name));
        for (const event of out.events) {
            const text = unattributedTextOf(event.fact);
            expect(text.length).toBeGreaterThan(10);
            for (const name of names) expect(text).not.toContain(name);
        }
    });

    it('has a table nobody has quietly emptied', () => {
        const table = pressureTemplates();
        expect(table.length).toBeGreaterThanOrEqual(12);
        expect(table.every(t => t.weight > 0)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DISCOVERY
// ─────────────────────────────────────────────────────────────────────────

describe('digest: the player learns what they could plausibly have heard', () => {
    function factsFor(state: WorldState) {
        appendFact(state.history, makeFact({
            day: state.currentDay + 100,
            kind: 'resource_contested',
            summary: 'The Azure Cloud Pavilion lost the gorge vein to the Crimson Abyss Hall.',
            factionIds: ['sect-azure-cloud', 'sect-crimson-abyss'],
            locationId: 'loc-region-low-fall',
            visibility: 'public',
            magnitude: 0.75,
            data: { unattributed: 'The road up the gorge is closed to anyone without a token.' }
        }));
        appendFact(state.history, makeFact({
            day: state.currentDay + 200,
            kind: 'war',
            summary: 'The Third Sill Court moved against the Standing Grove.',
            factionIds: ['court-third-sill', 'sect-standing-grove'],
            visibility: 'public',
            magnitude: 0.8,
            data: { unattributed: 'The roads are not safe and the caravans have stopped.' }
        }));
        appendFact(state.history, makeFact({
            day: state.currentDay + 300,
            kind: 'betrayal',
            summary: 'Somebody opened the gate for the Crimson Abyss Hall.',
            factionIds: ['sect-crimson-abyss'],
            visibility: 'secret',
            magnitude: 0.9,
            data: { unattributed: 'A gate was found open.' }
        }));
        return state.history.facts.slice(-3);
    }

    it('never names a faction the player has no record for', () => {
        const state = world('dig-a');
        const facts = factsFor(state);
        const nobody = simpleAccess({
            actorId: 'pc',
            locationId: 'loc-region-low-fall',
            knownFactionIds: []
        });

        const digest = buildPlayerDigest(facts, nobody, state.currentDay, state.currentDay + 400);
        for (const line of digest.lines) {
            expect(line.form).not.toBe('named');
            expect(line.text).not.toMatch(/Azure Cloud|Crimson Abyss|Third Sill|Standing Grove/);
        }
        expect(namesPermitted(digest).factions.size).toBe(0);
    });

    it('delivers an unknown faction as an unattributed consequence, not silence', () => {
        const state = world('dig-b');
        const facts = factsFor(state);
        const nobody = simpleAccess({ actorId: 'pc', locationId: 'loc-region-low-fall' });
        const digest = buildPlayerDigest(facts, nobody, state.currentDay, state.currentDay + 400);

        const vein = digest.lines.find(l => l.kind === 'resource_contested')!;
        expect(vein.form).toBe('unattributed');
        expect(vein.text).toContain('road up the gorge');
        expect(vein.channel).toBe('visible');
        expect(digest.unattributed).toBeGreaterThan(0);
    });

    it('names it once the player has heard of everyone in it', () => {
        const state = world('dig-c');
        const facts = factsFor(state);
        const informed = simpleAccess({
            actorId: 'pc',
            locationId: 'loc-region-low-fall',
            knownFactionIds: ['sect-azure-cloud', 'sect-crimson-abyss']
        });
        const digest = buildPlayerDigest(facts, informed, state.currentDay, state.currentDay + 400);
        const vein = digest.lines.find(l => l.kind === 'resource_contested')!;
        expect(vein.form).toBe('named');
        expect(vein.text).toContain('Azure Cloud Pavilion');
        expect(vein.namableFactionIds).toContain('sect-crimson-abyss');
    });

    it('reports partially: what they know may be named, what they do not may not', () => {
        const state = world('dig-d');
        const facts = factsFor(state);
        const half = simpleAccess({
            actorId: 'pc',
            locationId: 'loc-region-low-fall',
            knownFactionIds: ['sect-azure-cloud']
        });
        const digest = buildPlayerDigest(facts, half, state.currentDay, state.currentDay + 400);
        const vein = digest.lines.find(l => l.kind === 'resource_contested')!;
        expect(vein.form).toBe('partial');
        expect(vein.namableFactionIds).toEqual(['sect-azure-cloud']);
        expect(vein.text).not.toContain('Crimson Abyss');
    });

    it('keeps a secret secret, whoever is asking', () => {
        const state = world('dig-e');
        const facts = factsFor(state);
        const insider = simpleAccess({
            actorId: 'pc',
            locationId: 'loc-region-low-fall',
            factionId: 'sect-crimson-abyss',
            knownFactionIds: ['sect-crimson-abyss']
        });
        const digest = buildPlayerDigest(facts, insider, state.currentDay, state.currentDay + 400);
        expect(digest.lines.some(l => l.kind === 'betrayal')).toBe(false);
        expect(digest.unheard).toBeGreaterThan(0);
    });

    it('counts what never reached them at all', () => {
        const state = world('dig-f');
        // Somewhere else entirely, knowing nobody, in no sect.
        const isolated = simpleAccess({ actorId: 'pc', locationId: 'loc-region-highstair' });
        const small = appendFact(state.history, makeFact({
            day: state.currentDay + 10,
            kind: 'promotion',
            summary: 'A minor promotion in a sect nobody outside it cares about.',
            factionIds: ['sect-gleaners-company'],
            locationId: 'loc-region-scarwater',
            visibility: 'faction',
            magnitude: 0.2,
            data: { unattributed: 'Nothing you would notice.' }
        }));
        const digest = buildPlayerDigest([small], isolated, state.currentDay, state.currentDay + 400);
        expect(digest.lines).toHaveLength(0);
        expect(digest.unheard).toBe(1);
        expect(digest.headline).toContain('did not reach you');
    });

    it('lets the market carry big public news to somebody with no standing', () => {
        const state = world('dig-g');
        const big = appendFact(state.history, makeFact({
            day: state.currentDay + 10,
            kind: 'war',
            summary: 'The Third Sill Court went to war.',
            factionIds: ['court-third-sill'],
            locationId: 'loc-region-highstair',
            visibility: 'public',
            magnitude: MARKET_MAGNITUDE + 0.1,
            data: { unattributed: 'The roads are not safe and the caravans have stopped.' }
        }));
        const nobody = simpleAccess({ actorId: 'pc', locationId: 'loc-region-low-fall' });
        const digest = buildPlayerDigest([big], nobody, state.currentDay, state.currentDay + 400);
        expect(digest.lines).toHaveLength(1);
        expect(digest.lines[0].channel).toBe('market');
        expect(digest.lines[0].form).toBe('unattributed');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE DRIVER
// ─────────────────────────────────────────────────────────────────────────

describe('driver: the world moves with the cultivator', () => {
    it('advances the clock, fires the books, and makes new things happen in one call', () => {
        const state = world('drive-a');
        const out = advanceWorldYears(state, 40, {
            access: simpleAccess({ actorId: 'pc', locationId: 'loc-region-low-fall' }),
            observer: { id: 'pc', bornOnDay: state.currentDay - 20 * YEAR }
        });
        expect(out.daysAdvanced).toBe(40 * YEAR);
        expect(out.toDay).toBe(out.fromDay + 40 * YEAR);
        expect(out.pressure.length).toBeGreaterThan(5);
        expect(out.events.length).toBeGreaterThan(out.pressure.length - 1);
        expect(out.digest).not.toBeNull();
        expect(out.digest!.lines.length + out.digest!.unheard).toBeGreaterThan(0);
    });

    it('mutates in place instead of cloning a world per call', () => {
        const state = world('drive-b');
        const out = advanceWorldYears(state, 5);
        // The same object came back: a play loop calling this hundreds of times
        // is not copying four hundred NPCs every time.
        expect(out.state).toBe(state);
        expect(state.currentDay).toBe(out.toDay);
    });

    it('is decomposable: ten years then thirty equals forty', () => {
        const single = world('drive-c');
        const split = world('drive-c');
        advanceWorldYears(single, 40);
        advanceWorldYears(split, 10);
        advanceWorldYears(split, 30);

        expect(split.currentDay).toBe(single.currentDay);
        expect(split.history.facts.map(f => f.summary)).toEqual(single.history.facts.map(f => f.summary));
        expect(JSON.stringify(worldShape(split))).toBe(JSON.stringify(worldShape(single)));
    });

    it('gives an interrupted seclusion only the consequences it lived through', () => {
        const state = world('drive-d');
        state.schedule.push({
            id: 'e-interrupt',
            kind: 'meeting',
            dueOnDay: state.currentDay + 3 * YEAR,
            summary: 'Somebody knocked.',
            actorIds: [],
            locationId: 'loc-region-low-fall',
            factionId: null,
            repeatDays: null,
            interrupts: true,
            chance: 1,
            fired: false,
            firedOnDay: null,
            data: {}
        });
        const out = advanceWorldYears(state, 40, {
            interruptPolicy: { actorId: 'pc', locationIds: ['loc-region-low-fall'] }
        });
        expect(out.interrupted).toBe(true);
        expect(out.daysAdvanced).toBe(3 * YEAR);
        // Pressure ran over three years, not forty.
        for (const event of out.pressure) {
            expect(event.onDay).toBeLessThanOrEqual(out.toDay);
        }
    });

    it('lets a sealed cultivator miss everything, and says how much', () => {
        const state = world('drive-e');
        const out = advanceWorldYears(state, 60, {
            stopOnInterrupt: false,
            access: simpleAccess({ actorId: 'pc', locationId: null })
        });
        expect(out.interrupted).toBe(false);
        expect(out.daysAdvanced).toBe(60 * YEAR);
        expect(out.digest!.unheard).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ACCEPTANCE TEST
// ─────────────────────────────────────────────────────────────────────────

/**
 * AGENTS.md:
 *
 *   > Start as a nobody, run 500 years, and confirm the resulting world is
 *   > recognisably descended from the world you started in.
 *
 * Concretely: factions risen and fallen, people dead and inherited from,
 * grudges live and passed to descendants, history accumulated with discoverable
 * causes, locations changed and carrying their scars, and nothing incoherent.
 *
 * Run as one advance rather than five hundred so the test also demonstrates
 * that the cost of a century is not a function of how many days are in it.
 */
describe('the acceptance test: five hundred years', () => {
    const seeded = seedWorld({
        seed: 'soak-500',
        catalog: fixtureCatalog(),
        presentYear: 1000,
        population: 400
    });
    const before = worldShape(seeded.state);

    const started = Date.now();
    const run = advanceWorldYears(seeded.state, 500, {
        access: simpleAccess({
            actorId: 'pc',
            locationId: 'loc-region-low-fall',
            knownFactionIds: ['sect-azure-cloud']
        }),
        observer: { id: 'pc', bornOnDay: 1000 * YEAR }
    });
    const elapsedMs = Date.now() - started;
    const after = worldShape(run.state);
    const state = run.state;

    it('completes in a sane time', () => {
        expect(elapsedMs).toBeLessThan(20_000);
        expect(after.year).toBe(before.year + 500);
    });

    it('factions have risen and fallen', () => {
        expect(after.dissolvedFactions).toBeGreaterThan(0);
        const founded = queryFacts(state.history, { kinds: ['faction_founded'], fromDay: before.day });
        const fallen = queryFacts(state.history, { kinds: ['faction_fallen'], fromDay: before.day });
        expect(founded.length).toBeGreaterThan(0);
        expect(fallen.length).toBeGreaterThan(0);
        // The roster is not the one it started with.
        expect(after.factionIds).not.toEqual(before.factionIds);
    });

    it('people have died and been inherited from', () => {
        expect(run.deaths.length).toBeGreaterThan(100);
        const inherited = run.deaths.filter(d => d.primaryHeirId !== null);
        expect(inherited.length).toBeGreaterThan(0);
        expect(queryFacts(state.history, { kinds: ['inheritance'] }).length).toBeGreaterThan(0);
        // Nobody who started is still walking around.
        expect(after.livingNpcs).toBeLessThan(before.livingNpcs);
    });

    it('grudges are still live and have passed to descendants', () => {
        // The charter's wording, and the half an heir would rather not have.
        expect(after.inheritedGrudges).toBeGreaterThan(0);
        const carried = state.npcs
            .flatMap(n => n.relationships)
            .filter(r => r.inheritedFromId !== null && r.standing < 0);
        expect(carried.length).toBeGreaterThan(0);
        for (const account of carried.slice(0, 10)) {
            expect(account.targetId).not.toBe(account.inheritedFromId);
            expect(account.note.length).toBeGreaterThan(0);
        }
    });

    it('goals have outlived their holders and passed down', () => {
        expect(after.inheritedGoals).toBeGreaterThan(0);
        const carried = state.npcs
            .flatMap(n => n.goals)
            .filter(g => g.generation > 0);
        for (const goal of carried.slice(0, 20)) {
            // The date is the original one: a goal three centuries old reads as
            // three centuries old.
            expect(goal.openedOnDay).toBeLessThan(state.currentDay);
            expect(goal.originHolderId).not.toBe('');
            expect(goal.inheritedFromId).not.toBeNull();
        }
    });

    it('history has accumulated with discoverable causes', () => {
        expect(after.facts).toBeGreaterThan(before.facts + 100);
        // Facts that point at earlier facts: the chain the present is explained by.
        const caused = state.history.facts.filter(f => f.causes.length > 0);
        expect(caused.length).toBeGreaterThan(0);
        const ids = new Set(state.history.facts.map(f => f.id));
        for (const fact of caused) {
            for (const cause of fact.causes) expect(ids.has(cause)).toBe(true);
        }
        // And some of it is genuinely not known, which is a feature.
        expect(after.unresolvedFacts).toBeGreaterThan(0);
    });

    it('locations have changed and carry their scars', () => {
        expect(after.locationChanges).toBeGreaterThan(before.locationChanges + 10);
        const changed = state.locations.filter(l => l.changes.length > 0);
        expect(changed.length).toBeGreaterThan(0);
        for (const loc of changed.slice(0, 20)) {
            // Every change is dated, ordered, and inside the run.
            let last = -Infinity;
            for (const change of loc.changes) {
                expect(change.onDay).toBeGreaterThanOrEqual(last);
                last = change.onDay;
                expect(change.summary.length).toBeGreaterThan(0);
            }
        }
        // Somewhere is now something it was not.
        expect(after.changedLocations).toBeGreaterThan(0);
    });

    it('nothing is incoherent', () => {
        // Every faction reference on a location resolves.
        const factionIds = new Set(state.factions.map(f => f.id));
        for (const loc of state.locations) {
            if (loc.controllingFactionId) expect(factionIds.has(loc.controllingFactionId)).toBe(true);
        }
        // A dissolved faction holds nobody and nothing.
        for (const faction of state.factions) {
            if (faction.dissolvedOnDay === null) continue;
            const members = state.npcs.filter(n => n.factionId === faction.id && n.status === 'alive');
            expect(members).toHaveLength(0);
        }
        // Nobody is in a faction that does not exist, or a place that does not.
        const locationIds = new Set(state.locations.map(l => l.id));
        for (const npc of state.npcs) {
            if (npc.factionId) expect(factionIds.has(npc.factionId)).toBe(true);
            if (npc.locationId) expect(locationIds.has(npc.locationId)).toBe(true);
            if (npc.status === 'physically_dead') expect(npc.diedOnDay).not.toBeNull();
        }
        // Every fact is dated inside the world's own history.
        for (const fact of state.history.facts) {
            expect(fact.day).toBeLessThanOrEqual(state.currentDay);
        }
        // Lineage edges never point at somebody born first.
        for (const lineage of state.lineages) {
            for (const edge of lineage.edges) {
                const parent = state.npcs.find(n => n.id === edge.parentId);
                const child = state.npcs.find(n => n.id === edge.childId);
                if (parent && child) {
                    expect(child.identity.bornOnDay).toBeGreaterThan(parent.identity.bornOnDay);
                }
            }
        }
    });

    it('and the player, being a nobody, learned almost none of it', () => {
        const digest = run.digest!;
        // The world did far more than reached them.
        expect(digest.unheard).toBeGreaterThan(digest.lines.length);
        // What did reach them was mostly nameless.
        expect(digest.unattributed).toBeGreaterThan(0);
        // And nothing they were handed names a faction they never heard of.
        const permitted = namesPermitted(digest);
        for (const id of permitted.factions) expect(id).toBe('sect-azure-cloud');
        for (const line of digest.lines) {
            if (line.form === 'named') continue;
            expect(line.text).not.toMatch(/Crimson Abyss|Third Sill|Standing Grove|Weir Office|Gleaners/);
        }
    });

    it('is reproducible: the same seed produces the same five centuries', () => {
        const repeat = seedWorld({
            seed: 'soak-500',
            catalog: fixtureCatalog(),
            presentYear: 1000,
            population: 400
        });
        const out = advanceWorldYears(repeat.state, 500);
        expect(JSON.stringify(worldShape(out.state))).toBe(JSON.stringify(after));
    });
});

describe('cloneWorld still available for callers that want the old world', () => {
    it('leaves the original untouched', () => {
        const state = world('clone-a');
        const copy = cloneWorld(state);
        advanceWorldYears(copy, 30);
        expect(state.currentDay).not.toBe(copy.currentDay);
    });
});
