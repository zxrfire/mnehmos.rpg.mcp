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

/**
 * A HOUSE MAY FALL. THE LADDER MAY NOT.
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────
 *
 * There used to be a test in the block above called *"still lets the world
 * decline, because decline is correct"*, and it asserted that fewer than a dozen
 * people were left standing above ordinal 30 after five centuries. That licensed
 * the wrong thing twice over. It passes at zero - a world with nobody above
 * ordinal 30 at all satisfies it - and it treated a HOUSE declining and the
 * WORLD declining as the same fact. They are not the same fact, and only one of
 * them is wanted.
 *
 * A house falling is the setting working. Houses lose their ground, fail to
 * replace an elder, are destroyed in a war. Measured across six seeds at fifteen
 * hundred years, 21 to 26 of the 32 the world starts with have ended, and that
 * is correct and must stay possible.
 *
 * ── WHAT THE OLD TEST WAS LETTING THROUGH ────────────────────────────────
 *
 * Measured on this seed before the fix this test was written for, and the shape
 * is why five centuries was the wrong horizon to ask at - it looks survivable at
 * 500 and is plainly not by 1500:
 *
 *              at or below   Foundation   Core   Nascent   Deity
 *               Qi Cond.
 *      500y            89%           26      6         5       6
 *     1000y            93%           21      3         0       1
 *     1500y            94%           21      3         0       0
 *     3000y            96%           13      3         1       1
 *
 * A floor and a ceiling with nothing between them. Every person in the bands
 * above the middle was a survivor of the seeding rather than somebody who
 * climbed, so the world was not in a Late Age, it was running out of people and
 * calling the shortage an era.
 *
 * THE CAUSE was that literacy was seeded once and never manufactured again.
 * `manualsOf` reads `teaches` off the content catalog keyed by the id of a house
 * somebody wrote by hand, so every house the world FOUNDS for itself read back
 * an empty shelf and could teach nobody anything for as long as it stood. Houses
 * standing went 32 -> 47 over three thousand years while houses holding a shelf
 * went 30 -> 5. With no reachable ceiling nobody crosses, and a distribution
 * with no inflow can only erode toward the rung people enter at. See `shelfOf`
 * and `librariesCarriedOutBy`.
 *
 * The same run after the fix: 75% at or below Qi Condensation, and 60 / 40 / 12
 * / 7 across the four bands, of whom 121 of 126 were born after the seeding.
 */
describe('a house may fall; the ladder may not', () => {
    // Deliberately longer than the block above. The collapse this pins is a
    // long-horizon shape and five hundred years does not show it - the middle
    // bands are still holding the last of the seeded cohort at that point.
    const HORIZON_YEARS = 1500;

    const REALMS: [string, number, number, number][] = [
        // name, lo, hi, and the floor this world has to keep occupied. Measured
        // across six seeds after the fix: 53-74, 21-40, 8-12, 1-8. The bars are
        // set below every one of those and above every pre-fix figure, so this
        // fails on the defect and does not fail on ordinary seed variance.
        ['Foundation Establishment', 13, 16, 20],
        ['Core Formation', 17, 20, 10],
        ['Nascent Soul', 21, 24, 3],
        ['Deity Transformation', 25, 28, 1]
    ];

    it('lets its houses fall without letting its ladder collapse', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'drift-guard', catalog });
        // Who and what the world started with, so a later count can tell a
        // survivor from an arrival. A band held entirely by people placed there
        // at seeding is a band that is dying, whatever its headcount reads.
        const seededNpcIds = new Set(state.npcs.map(n => n.id));
        const seededFactionIds = state.factions.map(f => f.id);
        advanceWorldForPlay(state, { days: YEAR * HORIZON_YEARS, stopOnInterrupt: false });
        const alive = state.npcs.filter(n => n.status === 'alive');

        // ── Decline, at the level decline belongs to. ──────────────────────
        const fallen = seededFactionIds.filter(
            id => state.factions.find(f => f.id === id)?.dissolvedOnDay != null
        );
        expect(
            fallen.length,
            `${fallen.length} of the ${seededFactionIds.length} houses the world started with `
            + `have ended in ${HORIZON_YEARS} years. Houses have to be able to fall.`
        ).toBeGreaterThan(0);

        // ── And the thing that must not decline. ───────────────────────────
        const bottom = alive.filter(n => n.cultivation.realmOrdinal <= 12).length;
        expect(
            bottom / alive.length,
            `${Math.round((bottom / alive.length) * 100)}% of the living world stands at or `
            + 'below Qi Condensation, which is a floor rather than a distribution'
        ).toBeLessThan(0.85);

        // The exact symptom in the complaint: consecutive empty bands in the
        // middle of the ladder. A realm nobody is standing in is a realm nobody
        // crossed, and four of those in a row is not a Late Age.
        const counts = REALMS.map(([, lo, hi]) => alive.filter(
            n => n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi).length);
        const reads = REALMS.map(([n], i) => `${n} ${counts[i]}`).join(', ');
        REALMS.forEach(([name, , , floor], i) => {
            expect(counts[i], `${name} holds ${counts[i]}. The ladder reads ${reads}`)
                .toBeGreaterThanOrEqual(floor);
        });
        // And it has to narrow. A flat middle is not a pyramid either, and the
        // apex staying rare is the half of this that must not be fixed away.
        expect(counts[0], `the ladder reads ${reads}`).toBeGreaterThan(counts[3]);

        // ── Turnover of identity, which is what makes the middle alive. ────
        //
        // The half a headcount cannot see. A band held by the seeded cohort
        // empties the moment they run out of lifespan, so a world can read
        // healthy on the day and be finished. This is the measure that told the
        // two apart, and it is worth keeping even though the collapse above is
        // what has the teeth.
        const high = alive.filter(n => n.cultivation.realmOrdinal >= 13);
        const risen = high.filter(n => !seededNpcIds.has(n.id));
        expect(
            risen.length / Math.max(1, high.length),
            `${risen.length} of ${high.length} people above Qi Condensation were born since `
            + 'the seeding. The rest of the ladder is inherited rather than climbed.'
        ).toBeGreaterThan(0.5);
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

    it('does drop the ceiling once everybody at the top is established dead', async () => {
        // The other half: this must still be able to fall, or it is not a
        // measure of anything.
        //
        // ── RE-DERIVED, BECAUSE THE ASSUMPTION UNDER IT STOPPED BEING TRUE ──
        //
        // This used to kill the single strongest NPC and assert the ceiling
        // fell. That was correct for years and is not any more: seeding the
        // Hollow Court stood its four Seats up at ordinals 44, 43, 43 and 42,
        // so the world it seeds now reads 44(alive), 44(alive), 43, 43, 42, 41
        // and killing one of TWO people at 44 correctly leaves the ceiling at
        // 44. The test failed with "expected 44 to be less than 44".
        //
        // The old assumption was that exactly one person sits at the top of the
        // world. The behaviour being guarded is not that - it is that the
        // ceiling is a real measurement that falls when the rung empties - so
        // the rung is emptied rather than one person taken off it. That keeps
        // the guard and drops only the coincidence it was leaning on.
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'missing-guard', catalog });
        const ceiling = state.npcs.reduce(
            (top, n) => Math.max(top, n.cultivation.realmOrdinal), 0);
        const atTheTop = state.npcs.filter(n => n.cultivation.realmOrdinal === ceiling);
        expect(atTheTop.length, 'nobody is at the ceiling').toBeGreaterThan(0);

        // Killing all but one must NOT move it, which is the half that would
        // have caught the stale version rather than merely tolerating it.
        for (const n of atTheTop.slice(1)) {
            const at = state.npcs.findIndex(x => x.id === n.id);
            state.npcs[at] = { ...state.npcs[at], status: 'physically_dead' };
        }
        expect(worldShape(state).strongestOrdinal, 'one survivor still holds the rung')
            .toBe(ceiling);

        const last = state.npcs.findIndex(x => x.id === atTheTop[0].id);
        state.npcs[last] = { ...state.npcs[last], status: 'physically_dead' };
        expect(worldShape(state).strongestOrdinal, 'the rung is empty and the ceiling has not moved')
            .toBeLessThan(ceiling);
    });
});
