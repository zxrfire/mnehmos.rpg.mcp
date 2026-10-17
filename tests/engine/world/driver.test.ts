import { describe, it, expect } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { advanceWorldYears } from '../../support/advance-world-years.js';
import { applyPressure, PRESSURE_TEMPLATES } from '../../../src/engine/world/pressure.js';
import {
    MARKET_MAGNITUDE,
    buildPlayerDigest,
    simpleAccess,
    unattributedTextOf
} from '../../../src/engine/world/digest.js';
import { cloneWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { makeFact, appendFact } from '../../../src/engine/world/history.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { worldShape } from '../../support/the-shape-of-a-world.js';
import { namesPermitted } from '../../support/the-names-a-digest-may-use.js';

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

    /**
     * WHEN IN A YEAR ANYTHING HAPPENS, ON THE PATH THE GAME ACTUALLY RUNS.
     *
     * `applyPressure` dates each of its lines at `year * 365 + offset` - a fixed
     * offset per line, a drawn one for the event budget - and clamps anything
     * past the end of the span. With the year index taken a year AHEAD of the
     * span it was handed, `year * 365` was the LAST day of a 365-day slice, so
     * every offset clamped onto it: a century of a house's history - feuds
     * opening, ground changing hands, people leaving - landed on a hundred
     * identical calendar dates, one a year, and the world visibly ran on a
     * metronome.
     *
     * Measured over 200 years on seeds alpha, beta and gamma, real catalog, 400
     * people, through `advanceWorldForPlay` in the 365-day slices it uses:
     *
     *     before   1.05 distinct days per year, 2852 of 2862 facts on a boundary
     *     after    6.50 distinct days per year,  182 of 3005 facts on a boundary
     *
     * The BULK path hid it, which is why it stood for so long: one 200-year span
     * is off by one year out of two hundred, so it went from 13 of 2147 facts on
     * a boundary to 0 of 2250 and read as healthy throughout.
     *
     * On the fixture world here, sixty played years: 26 to 35 dates of the
     * calendar used against a broken 1, and the first day of the year went from
     * holding everything to 13-17% of facts. Those residual ones are not this
     * pass - `lifespanEndsOnDay` is `bornOnDay` plus whole years and a world's
     * seeded cohort is born on a year boundary, so its deaths and the estates
     * that follow them land there. Anybody the world bears afterwards is born on
     * `year * 365 + 180` and dies off the boundary.
     *
     * The assertions are the shape of the defect rather than today's figures: a
     * broken pass puts every fact of a year on ONE date and that date is the
     * boundary, so the claims are that many dates are used and that the boundary
     * is not the busiest of them. Both are far from 26 and from 1.
     */
    it('spreads a year of its own affairs across the year', () => {
        const state = world('drv-spread');
        const start = state.currentDay;
        for (let i = 0; i < 60; i++) advanceWorldYears(state, 1);

        const mine = state.history.facts.filter(f => f.day >= start);
        expect(mine.length).toBeGreaterThan(200);

        const perDate = new Map<number, number>();
        for (const f of mine) {
            const date = f.day % YEAR;
            perDate.set(date, (perDate.get(date) ?? 0) + 1);
        }
        expect(
            perDate.size,
            `a year's facts landed on ${perDate.size} dates of the calendar`
        ).toBeGreaterThan(15);

        const busiest = [...perDate.entries()].sort((a, b) => b[1] - a[1])[0];
        expect(
            busiest[0],
            `the first day of the year is still the busiest, holding ${busiest[1]} of ${mine.length}`
        ).not.toBe(0);

        const onTheBoundary = perDate.get(0) ?? 0;
        expect(
            onTheBoundary / mine.length,
            `${onTheBoundary} of ${mine.length} facts fell on New Year's day`
        ).toBeLessThan(0.25);
    });

    it('writes real state, not just a line of prose', () => {
        const state = world('drv-state');
        const holders = (): Map<string, string | null> => new Map(state.locations
            .filter(l => l.kind === 'vein')
            .map(l => [l.id, l.controllingFactionId]));
        const before = holders();
        const out = applyPressure(state, state.currentDay, state.currentDay + 120 * YEAR);

        // The 30 September ruling removes sales: veins are taken in war,
        // seized by rivals, returned to the grantor and granted again. While the seizure
        // was the only way, one hostile pair traded one vein back and forth
        // and every vein was back with its first holder at year 120.
        const ways = ['vein_lost', 'vein_taken_in_war', 'vein_given_up', 'vein_granted'];
        const transfers = out.events.filter(e => ways.includes(e.kind));
        expect(new Set(transfers.map(e => e.kind)).size).toBeGreaterThanOrEqual(2);
        for (const transfer of transfers) {
            expect(transfer.fact.factionIds.length).toBe(2);
            expect(transfer.fact.locationId).not.toBeNull();
        }
        const after = holders();
        expect([...before].some(([id, holder]) => after.has(id) && after.get(id) !== holder)).toBe(true);
        for (const id of before.keys()) {
            const ground = state.locations.find(l => l.id === id)!;
            expect(ground.kind).toBe('vein');
            expect(ground.tags).not.toContain('forbidden');
        }

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

    it('keeps every vein out of forbidden ground through 500 years of zone attempts', () => {
        const state = world('drv-forbidden-veins');
        const wilds = makeLocation({ id: 'test-wilds', name: 'a woodland', kind: 'wilds' });
        state.locations.push(wilds);
        const before = new Map(state.locations.filter(l => l.kind === 'vein')
            .map(l => [l.id, l.controllingFactionId]));
        const forbidden = PRESSURE_TEMPLATES.find(t => t.kind === 'zone_forbidden')!;
        for (let year = 1; year <= 500; year++) {
            forbidden.apply(state, state.currentDay + year * YEAR,
                forStream(state.seed, 'test-zone-forbidden', year));
        }
        for (const [id, holder] of before) {
            const ground = state.locations.find(l => l.id === id)!;
            expect(ground.kind).toBe('vein');
            expect(ground.tags).not.toContain('forbidden');
            expect(ground.controllingFactionId).toBe(holder);
        }
        expect(state.locations.find(l => l.id === wilds.id)!.kind).toBe('forbidden_zone');
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
            // `ScheduledEffect.data` is a loose record, so the day comes back
            // as string | number | boolean and has to be read as a number.
            expect(war.dueOnDay).toBeGreaterThan(Number(war.data.openedOnDay ?? 0));
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
        const table = PRESSURE_TEMPLATES;
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
            summary: 'The Azure Cloud Pavilion lost the gorge vein to the Crimson Abyss Fortress.',
            factionIds: ['sect-azure-cloud', 'sect-crimson-abyss'],
            locationId: 'loc-region-low-fall',
            visibility: 'public',
            magnitude: 0.75,
            data: { unattributed: 'The road up the gorge is closed to anyone without a token.' }
        }));
        appendFact(state.history, makeFact({
            day: state.currentDay + 200,
            kind: 'war',
            summary: 'The Third Sluice Court moved against the Ancient Bough Grove.',
            factionIds: ['court-third-sill', 'sect-ancient-bough-grove'],
            visibility: 'public',
            magnitude: 0.8,
            data: { unattributed: 'The roads are not safe and the caravans have stopped.' }
        }));
        appendFact(state.history, makeFact({
            day: state.currentDay + 300,
            kind: 'betrayal',
            summary: 'Somebody opened the gate for the Crimson Abyss Fortress.',
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
            expect(line.text).not.toMatch(/Azure Cloud|Crimson Abyss|Third Sluice|Ancient Bough Grove/);
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
            factionIds: ['sect-fallen-grain-caravan'],
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
            summary: 'The Third Sluice Court went to war.',
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

    /**
     * ONE DECOMPOSITION IS NOT THE CLAIM. The sibling above checked 10+30 only,
     * and the defect that broke this layer was invisible at that span: the world
     * forgets its mortal dead, that sweep ran once per CALL rather than once per
     * world year, and forty years in one call against ten-then-thirty first
     * differed at 285 facts against 291. Under twenty years there is nothing to
     * forget yet and every split agreed, which is why a single decomposition
     * passed for as long as it did.
     *
     * A played game advances in whatever slices a player's turns happen to make,
     * so the claim is that EVERY decomposition of a span gives one world - not
     * that one particular pair of chunks agrees.
     *
     * Red-checked: with the sweep moved back to once per advance, chunk counts
     * 2, 3, 5 and 10 all diverge here.
     */
    it('is decomposable however the span is chopped up', () => {
        const chunked = (chunks: number): WorldState => {
            const state = world('drive-c');
            for (let i = 0; i < chunks; i++) advanceWorldYears(state, 300 / chunks);
            return state;
        };

        const one = chunked(1);
        for (const chunks of [2, 3, 5, 10]) {
            const many = chunked(chunks);
            expect(many.currentDay, `${chunks} chunks landed on a different day`)
                .toBe(one.currentDay);
            expect(
                many.history.facts.map(f => `${f.day}:${f.summary}`),
                `300 years in ${chunks} calls is a different history from 300 in one`
            ).toEqual(one.history.facts.map(f => `${f.day}:${f.summary}`));
            expect(
                JSON.stringify(worldShape(many)),
                `300 years in ${chunks} calls is a different world from 300 in one`
            ).toBe(JSON.stringify(worldShape(one)));
        }
    });
    // Repeated-call career links are checked on the cached five-century sample.


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


// The unchanged cumulative/state500-year claims read their source-keyed
// completed run in driver-cached-acceptance.test.ts.

describe('cloneWorld still available for callers that want the old world', () => {
    it('leaves the original untouched', () => {
        const state = world('clone-a');
        const copy = cloneWorld(state);
        advanceWorldYears(copy, 30);
        expect(state.currentDay).not.toBe(copy.currentDay);
    });
});
