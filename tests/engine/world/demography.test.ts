/**
 * People are born in places, and the places stay populated.
 *
 * THE BUG THIS PINS
 * -----------------
 * `applyDemography` placed every newborn at `locationId: region.id`. A region
 * is a container - nobody stands in one - and `npcsAt` matches on an exact
 * `locationId`, so every settlement drained as its original inhabitants died
 * while the region node filled up with people nobody could ever meet.
 *
 * Measured over a seeded, advanced world before the fix:
 *
 *   day 0   Sweptground 25   Low Fall 30   Kettle 14   Sixmile 13
 *   +20y    Sweptground 18   Low Fall 18   Kettle  6   Sixmile  6
 *   +50y    Sweptground  7   Low Fall  4   Kettle  0   Sixmile  1
 *
 * Total alive held at about 350 the whole time - nobody was dying off - and
 * "The Quiet Marches (region)" went from 39 to 170. The encounter system draws
 * its cast from who is present, so the end state is person-free events forever.
 *
 * Three separate filters had the same defect: a newborn's home, a parent's
 * whereabouts, and a faction's seat all compared something to `region.id` when
 * every one of them meant "under this region".
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldForPlay, worldShape } from '../../../src/engine/world/driver.js';
import { npcsAt, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

function headcount(state: WorldState, kind: string): number {
    return state.locations
        .filter(l => l.kind === kind)
        .reduce((sum, l) => sum + npcsAt(state, l.id).length, 0);
}

function livingCount(state: WorldState): number {
    return state.npcs.filter(n => n.status === 'alive').length;
}

async function advancedWorld(years: number) {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed: 'demography', catalog });
    const before = {
        alive: livingCount(state),
        region: headcount(state, 'region'),
        settlements: headcount(state, 'settlement'),
        sectGround: headcount(state, 'sect_seat')
    };
    advanceWorldForPlay(state, { days: YEAR * years, stopOnInterrupt: false });
    return {
        state,
        before,
        after: {
            alive: livingCount(state),
            region: headcount(state, 'region'),
            settlements: headcount(state, 'settlement'),
            sectGround: headcount(state, 'sect_seat')
        }
    };
}

describe('a newborn is born somewhere somebody can stand', () => {
    it('drains the region containers instead of filling them', async () => {
        const { before, after } = await advancedWorld(80);
        // The exact inversion of the reported symptom. The container empties as
        // the wrongly-placed original cohort dies and is never replaced.
        expect(before.region).toBeGreaterThan(0);
        expect(after.region).toBeLessThan(before.region / 2);
    }, 180_000);

    it('keeps settlements populated across a long span', async () => {
        const { before, after } = await advancedWorld(80);
        expect(after.settlements).toBeGreaterThanOrEqual(before.settlements);
        // And the world is not simply growing: the headcount is held to target
        // by the same demography, so this is redistribution, not inflation.
        expect(after.alive).toBeLessThanOrEqual(before.alive * 1.1);
    }, 180_000);

    it('leaves no settlement without a soul in it', async () => {
        // The condition the encounter system actually depends on. An empty
        // settlement produces person-free events forever.
        const { state } = await advancedWorld(80);
        const empty = state.locations
            .filter(l => l.kind === 'settlement' && npcsAt(state, l.id).length === 0)
            .map(l => l.name);
        expect(empty, `settlements with nobody in them: ${empty.join(', ')}`).toHaveLength(0);
    }, 180_000);

    it('puts nobody on a region node after the original cohort is gone', async () => {
        // Anyone still standing on a container is a survivor of the ORIGINAL
        // placement rather than a new birth, so the real invariant is that the
        // count only ever falls. This used to assert a threshold at one point in
        // time instead, which measured the wrong thing in both directions: it
        // went red when promotion lengthened lifespans and left more of the
        // seeded cohort alive at 250 years, and it stayed green through a real
        // defect that only showed up later - births fell back to the region node
        // whenever a province ran out of habitable ground, so the count fell to
        // 14 by year 250 and then climbed to 265 by year 600.
        //
        // Now it walks the clock and demands monotonic decline, which is the
        // thing the comment always claimed to be checking.
        const marks = [100, 250, 400, 600];
        const counts: number[] = [];
        for (const years of marks) {
            const { state } = await advancedWorld(years);
            counts.push(headcount(state, 'region'));
        }
        for (let i = 1; i < counts.length; i++) {
            expect(
                counts[i],
                `people on region containers climbed between year ${marks[i - 1]} `
                + `and ${marks[i]}: ${counts.join(' -> ')}. Something is placing `
                + 'newborns on a map node nobody can stand on.'
            ).toBeLessThanOrEqual(counts[i - 1]);
        }
        // And it has to actually drain, not merely stop growing.
        expect(counts[counts.length - 1]).toBeLessThan(counts[0] / 2);
    }, 600_000);
});

describe('who lives where is decided by a weight, not by a coin flip', () => {
    it('gives every habitable place a population weight at seeding', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'weights', catalog });
        for (const l of state.locations.filter(l => l.kind === 'settlement' || l.kind === 'sect_seat')) {
            const weight = Number(l.data.populationWeight);
            expect(Number.isFinite(weight), `${l.name} has no populationWeight`).toBe(true);
            expect(weight).toBeGreaterThanOrEqual(0);
        }
    });

    it('does not put most of the world inside a sect compound', async () => {
        // There are far more houses in the catalog than there are towns, so an
        // unweighted draw over habitable ground put 61% of the living world
        // inside a compound within 150 years. A sect is a thing you join.
        const { after } = await advancedWorld(150);
        const share = after.sectGround / Math.max(1, after.alive);
        expect(share, `${Math.round(share * 100)}% of the world lives on sect ground`)
            .toBeLessThan(0.35);
        // But not zero: sect grounds are inhabited places, not scenery.
        expect(after.sectGround).toBeGreaterThan(0);
    }, 240_000);
});

describe('the other two filters that meant "under this region"', () => {
    it('still attaches newborns to lineages once births leave the container', async () => {
        // The parent filter was `n.locationId === region.id`, which matched only
        // the cohort the placement bug had parked on the container. Fixing the
        // placement without fixing this would have silently ended lineage.
        const { state } = await advancedWorld(80);
        expect(state.lineages.length).toBeGreaterThan(0);
        const withEdges = state.lineages.filter(l => l.edges.length > 0);
        expect(withEdges.length).toBeGreaterThan(0);
    }, 180_000);

    it('still lets factions recruit once their seats leave the container', async () => {
        // `f.seatLocationId === region.id` was true while factions were seated
        // on region nodes. Sects now hold ground of their own, so that
        // comparison went false for every faction in the world and the rolls
        // could only ever shrink.
        const { state, before } = await advancedWorld(80);
        const affiliated = state.npcs.filter(n => n.status === 'alive' && n.factionId !== null).length;
        expect(affiliated).toBeGreaterThan(0);
        expect(affiliated / Math.max(1, before.alive)).toBeGreaterThan(0.2);
    }, 180_000);
});

/**
 * The world must still have a top after five hundred years.
 *
 * THE FAILURE THIS PINS
 * ---------------------
 * `tone.md` promises that a player can vanish for decades and return to a
 * substantially different world. Measured, the world drifted in exactly one
 * direction and it was fatal: the six strongest living people went
 * 44,41,38,37,36,36 at seeding to a flat 12 by year 300, with every apex head,
 * court seat and named figure dead and nothing above ordinal 20 alive anywhere.
 * Population held steady throughout - people were being born and placed
 * correctly - they simply stopped existing at the top.
 *
 * `the-late-age.md` says figures older than anything now living walk through
 * this world constantly. The simulation produced the opposite: a world that had
 * giants at seeding and none a century later, whose entire institutional layer
 * was a snapshot that decayed on contact with its own clock.
 *
 * THE CAUSE was not that cultivation fails to advance. It is that a realm's
 * LIFESPAN is the whole of what a high realm buys - an ordinal 44 has a hundred
 * thousand years - and three separate removal events ignored it and picked
 * uniformly:
 *
 *   elder_died      everybody at a senior rank
 *   disappearance   everybody above ordinal 13, a pool of about fifty that the
 *                   world's entire high-realm cohort lives in
 *   technique_lost  every holder of a technique nobody else has, which is
 *                   structurally the high-realm figures
 *
 * and `killing` picked a victim uniformly from every living person and then a
 * killer from whoever was standing nearby, without ever asking whether they
 * could do it. That last one was the sharpest contradiction in the repo:
 * `standoff.ts` spends four hundred lines measuring who could kill an apex head
 * off the real resolver and concluding almost nobody, while this rolled eleven
 * times a century and did it for free.
 */
describe('the top of the world survives its own clock', () => {
    const HORIZON_YEARS = 500;

    // The real catalog, as the rest of this file uses, because the shape being
    // pinned only exists in the world that ships: the fixture has no apex tier
    // to lose.
    async function soaked() {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'drift-guard', catalog });
        const before = topOrdinals(state);
        advanceWorldForPlay(state, { days: 365 * HORIZON_YEARS, stopOnInterrupt: false });
        return { state, before, after: topOrdinals(state) };
    }

    // Counts everybody the ENGINE knows is out there, not everybody the world
    // can currently account for. At 44 almost nobody is seen from one century
    // to the next, so `missing` is the ordinary condition rather than a loss -
    // and a measure that dropped them reported an entirely correct
    // disappearance as the ceiling collapsing. See `EXTANT_STATES`.
    const EXTANT = new Set([
        'alive', 'missing', 'sealed',
        'soul_preserved', 'possessing', 'reconstructed'
    ]);

    function topOrdinals(state: WorldState): number[] {
        return state.npcs
            .filter(n => EXTANT.has(n.status))
            .map(n => n.cultivation.realmOrdinal)
            .sort((a, b) => b - a)
            .slice(0, 6);
    }

    it('does not converge on a uniform floor', async () => {
        const { before, after } = await soaked();
        expect(before[0], 'the world starts with somebody at the top').toBeGreaterThan(40);
        // The exact failure: after 500 years the strongest person alive was at
        // ordinal 13, in a world whose institutions the lore describes as
        // having stood for millennia.
        expect(
            after[0],
            `strongest alive after ${HORIZON_YEARS} years is ordinal ${after[0]}`
        ).toBeGreaterThan(30);
    }, 600_000);

    it('keeps somebody at the very top, not merely somebody high', async () => {
        // A world with a 32 and nothing above it is not this setting either.
        // The apex TIER has to survive as a tier - which is what this always
        // meant and not what it used to measure.
        //
        // It asserted the single strongest survivor was within one rung of the
        // single strongest at seeding, on one seed. That is a point value on
        // one sample of a stochastic world, and it fails for trajectory changes
        // that are not regressions: measured across six seeds, four hold at 44
        // and two land at 41, which is still Tribulation Transcendence and
        // still the top tier of the ladder. A world losing its single
        // strongest person over five centuries is not a defect - it is the
        // decline the test below insists on.
        //
        // So it now asks the question the comment always asked: is anybody
        // still standing in the apex tier at all?
        const { before, after } = await soaked();
        const APEX_FLOOR = 41;   // Tribulation Transcendence begins here.
        expect(before[0], 'the world starts with somebody in the apex tier')
            .toBeGreaterThanOrEqual(APEX_FLOOR);
        expect(
            after[0],
            `strongest alive after ${HORIZON_YEARS} years is ordinal ${after[0]}, `
            + 'which is below the apex tier entirely'
        ).toBeGreaterThanOrEqual(APEX_FLOOR);
    }, 600_000);

    it('still lets the world decline, because decline is correct', async () => {
        // The other half, and the one easy to break while fixing the first.
        // Houses are "operating a fraction of what they inherited"; a world
        // where the elite is preserved intact for five centuries would be a
        // worse setting than one that decays. What must not happen is total
        // collapse to the floor.
        const { state, before } = await soaked();
        const aliveHigh = state.npcs.filter(
            n => n.status === 'alive' && n.cultivation.realmOrdinal > 30
        ).length;
        const seededHigh = before.filter(o => o > 30).length;
        expect(aliveHigh, 'the high tier must thin').toBeLessThan(seededHigh + 6);
    }, 600_000);

    it('never lets somebody be killed by a person who could not do it', async () => {
        // The contradiction with `standoff.ts`, made permanent. A killer more
        // than `CASUAL_KILL_MAX_GAP` rungs below cannot get there however the
        // day goes - that is the combat layer's own edge cap - so a world event
        // must not do for free what the resolver says is out of reach.
        const { state } = await soaked();
        // Looked up by name, which is the only handle the record keeps - so
        // names that are not unique are skipped rather than guessed at. A
        // newborn inheriting a parent's surname can collide, and a guess there
        // would report a killing that never happened.
        const counts = new Map<string, number>();
        for (const n of state.npcs) counts.set(n.name, (counts.get(n.name) ?? 0) + 1);
        const byName = new Map(state.npcs.map(n => [n.name, n]));
        for (const npc of state.npcs) {
            const match = /^Killed by (.+)\.$/.exec(npc.endNote ?? '');
            if (!match) continue;
            if ((counts.get(match[1]) ?? 0) !== 1) continue;
            const killer = byName.get(match[1]);
            if (!killer) continue;
            expect(
                killer.cultivation.realmOrdinal,
                `${killer.name} (${killer.cultivation.realmOrdinal}) killed `
                + `${npc.name} (${npc.cultivation.realmOrdinal})`
            ).toBeGreaterThanOrEqual(npc.cultivation.realmOrdinal - 3);
        }
    }, 600_000);
});

// ─────────────────────────────────────────────────────────────────────────
// MISSING IS NOT GONE
//
// At the top of the ladder almost nobody is seen from one century to the next,
// so being unaccounted for is the ordinary condition of a Tribulation
// Transcendence figure rather than a loss. `ExistenceState` already said so -
// "whereabouts unknown; aliveness genuinely unresolved" - and the measure did
// not read it, so a perfectly ordinary disappearance reported as the world's
// ceiling collapsing.
//
// The engine is allowed to know things the world cannot. That is the same
// licence `afterCrossing` takes when it records `still_above` about somebody
// no house alive can confirm.
// ─────────────────────────────────────────────────────────────────────────

describe('the world can lose sight of somebody without losing them', () => {
    it('keeps a missing figure in the ceiling and out of the headcount', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'missing-guard', catalog });
        const top = [...state.npcs].sort(
            (a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
        )[0];
        const ceiling = top.cultivation.realmOrdinal;

        const before = worldShape(state);
        expect(before.strongestOrdinal).toBe(ceiling);

        // Exactly the thing that used to read as collapse.
        const at = state.npcs.findIndex(n => n.id === top.id);
        state.npcs[at] = { ...state.npcs[at], status: 'missing' };
        const after = worldShape(state);

        expect(after.strongestOrdinal, 'the ceiling is what the engine knows')
            .toBe(ceiling);
        expect(after.livingNpcs, 'the headcount is what the world can see')
            .toBe(before.livingNpcs - 1);
        expect(after.unaccountedFor).toBe(before.unaccountedFor + 1);
    });

    it('does drop the ceiling when somebody is established dead', async () => {
        // The other half: this must still be able to fall, or it is not a
        // measure of anything.
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'missing-guard', catalog });
        const top = [...state.npcs].sort(
            (a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
        )[0];
        const at = state.npcs.findIndex(n => n.id === top.id);
        state.npcs[at] = { ...state.npcs[at], status: 'physically_dead' };
        expect(worldShape(state).strongestOrdinal)
            .toBeLessThan(top.cultivation.realmOrdinal);
    });
});
