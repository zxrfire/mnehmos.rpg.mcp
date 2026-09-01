import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    DEFAULT_LAYER,
    IMMORTAL_LAYER,
    MORTAL_LAYER,
    WORLD_LAYERS,
    evaluateLayerCrossing,
    expelsOrdinal,
    isAboveTheLid,
    isBelowTheLid,
    layerAbove,
    layerBelow,
    layerForOrdinal,
    layerOf
} from '../../../src/engine/world/layers.js';
import {
    IMMORTAL_LANDING_LOCATION_ID,
    IMMORTAL_NATIVE_COUNT,
    LID_CHANNEL_TAG,
    MAX_PERIL_RELIEF,
    advanceImmortalLayer,
    afterCrossingOf,
    ascend,
    ascensionOf,
    cannotBeHeldBelow,
    descend,
    ensureImmortalLayer,
    immortalStanding,
    immortalWorldShape,
    perilChance,
    readChannel,
    readTwoWays,
    residentsAbove,
    sendAcross,
    thingsMadeAbove
} from '../../../src/engine/world/immortal-world.js';
import { advanceWorldYears, worldShape } from '../../../src/engine/world/driver.js';
import { buildPlayerDigest, namesPermitted, simpleAccess } from '../../../src/engine/world/digest.js';
import { queryFacts } from '../../../src/engine/world/history.js';
import { addLineageEdge, createLineageRecord, descendantsOf } from '../../../src/engine/world/lineage.js';
import { evaluateAccess } from '../../../src/engine/world/locations.js';
import { addGoal, setRealm, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { isGoingConcern } from '../../../src/engine/cultivation/existence.js';
import {
    BREATHS_IN_THE_LOWER_REALM,
    FALSE_IMMORTAL_ORDINAL,
    OBJECT_CEILING_BELOW_THE_LID,
    TRUE_IMMORTAL_ORDINAL,
    powerMultiplierForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { cloneWorld, getFaction, getNpc, upsertNpc, upsertObject } from '../../../src/engine/world/world-state.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';
import { migrate } from '../../../src/storage/migrations.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

function world(seed = 'imm-a'): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 200 }).state;
}

/**
 * Somebody at the top of the ladder with everything that is supposed to cross:
 * a sect, a family, an open account, an unfinished goal and things in hand.
 */
function candidate(state: WorldState) {
    const at = state.npcs.findIndex(n => n.factionId !== null && n.status === 'alive');
    let npc = state.npcs[at];
    npc = setRealm(npc, TRUE_IMMORTAL_ORDINAL, state.currentDay - 5 * YEAR);
    npc = addGoal(npc, {
        kind: 'revenge',
        text: 'Settle the account at the Weir.',
        priority: 0.9,
        progress: 'Knows who.',
        obstacles: ['Nothing, any more.']
    }, state.currentDay - 40 * YEAR);

    const enemy = state.npcs.find(n => n.id !== npc.id && n.status === 'alive')!;
    npc = upsertRelationship(npc, {
        targetId: enemy.id,
        targetName: enemy.name,
        kind: 'enemy',
        standing: -0.9,
        note: 'An old thing.'
    }, state.currentDay - 40 * YEAR);
    state.npcs[at] = npc;

    const heir = state.npcs.find(
        n => n.id !== npc.id && n.status === 'alive' &&
            n.identity.bornOnDay > npc.identity.bornOnDay + 18 * YEAR
    ) ?? state.npcs.find(n => n.id !== npc.id && n.status === 'alive' && n.id !== enemy.id)!;
    let lineage = createLineageRecord({
        id: 'lin-candidate',
        surname: npc.name.split(' ')[0],
        founderId: npc.id,
        foundedOnDay: npc.identity.bornOnDay
    });
    lineage = addLineageEdge(lineage, {
        parentId: npc.id,
        childId: heir.id,
        relation: 'descendant',
        onDay: heir.identity.bornOnDay
    });
    state.lineages.push(lineage);

    // Things in hand. They do not go through the Lid.
    for (const [i, name] of ['a sword nobody can lift', 'a copied manual', 'a jade case'].entries()) {
        Object.assign(state, upsertObject(state, makeObject({
            id: `obj-cand-${i}`,
            name,
            kind: i === 1 ? 'manual' : 'artifact',
            significance: 'significant',
            power: i === 1 ? 41 : 40 + i,
            possessorId: npc.id,
            ownerId: npc.id,
            ownerName: npc.name,
            locationId: npc.locationId
        })));
    }

    return { npc: state.npcs[at], heir, enemy };
}

// ─────────────────────────────────────────────────────────────────────────
// IT IS A PLACE, NOT ONLY A RANK
// ─────────────────────────────────────────────────────────────────────────

describe('layers: the one point where progression is geographic', () => {
    it('registers exactly two, ordered, with the top one open-ended', () => {
        expect(WORLD_LAYERS).toHaveLength(2);
        expect(WORLD_LAYERS.map(l => l.key)).toEqual([MORTAL_LAYER, IMMORTAL_LAYER]);
        expect(WORLD_LAYERS.map(l => l.index)).toEqual([0, 1]);
        // Higher layers, later or never. There is nowhere above the immortal
        // world, and adding one is a data change nobody should make.
        expect(layerAbove(IMMORTAL_LAYER)).toBeNull();
        expect(layerBelow(MORTAL_LAYER)).toBeNull();
        expect(layerAbove(MORTAL_LAYER)!.key).toBe(IMMORTAL_LAYER);
    });

    it('puts 46 on the far side and 45 on this one, which is the whole of the difference', () => {
        expect(layerForOrdinal(FALSE_IMMORTAL_ORDINAL).key).toBe(MORTAL_LAYER);
        expect(layerForOrdinal(TRUE_IMMORTAL_ORDINAL).key).toBe(IMMORTAL_LAYER);
        // A False Immortal may stay. That is why the world has had False
        // Immortals living in it and has never had a True one.
        expect(expelsOrdinal(MORTAL_LAYER, FALSE_IMMORTAL_ORDINAL)).toBe(false);
        expect(expelsOrdinal(MORTAL_LAYER, TRUE_IMMORTAL_ORDINAL)).toBe(true);
    });

    it('reads anything without a stated layer as below the Lid', () => {
        expect(DEFAULT_LAYER).toBe(MORTAL_LAYER);
        expect(layerOf(undefined)).toBe(MORTAL_LAYER);
        expect(isBelowTheLid({})).toBe(true);
        expect(isAboveTheLid({ layer: IMMORTAL_LAYER })).toBe(true);
    });
});

describe('what crosses the Lid, in both directions', () => {
    it('refuses to take anybody below True Immortal up, and not as long odds', () => {
        const v = evaluateLayerCrossing({ subject: 'person', direction: 'up', ordinal: 44 });
        expect(v.permitted).toBe(false);
        expect(v.reason).toBe('crushed_beyond_the_lid');
        // A False Immortal is one rung up and still cannot go.
        expect(
            evaluateLayerCrossing({ subject: 'person', direction: 'up', ordinal: FALSE_IMMORTAL_ORDINAL }).permitted
        ).toBe(false);
        expect(
            evaluateLayerCrossing({ subject: 'person', direction: 'up', ordinal: TRUE_IMMORTAL_ORDINAL }).permitted
        ).toBe(true);
    });

    it('gives a descent ten to fifteen breaths and calls it ruinous', () => {
        const v = evaluateLayerCrossing({
            subject: 'person', direction: 'down', ordinal: TRUE_IMMORTAL_ORDINAL
        });
        expect(v.permitted).toBe(true);
        expect(v.ruinous).toBe(true);
        expect(v.breathsBelow).toEqual({ ...BREATHS_IN_THE_LOWER_REALM });
    });

    it('caps what can be held below, and exempts paper', () => {
        const weapon = evaluateLayerCrossing({
            subject: 'object', direction: 'down', ordinal: TRUE_IMMORTAL_ORDINAL,
            power: TRUE_IMMORTAL_ORDINAL, madeAbove: true
        });
        expect(weapon.permitted).toBe(false);
        expect(weapon.reason).toBe('above_the_object_ceiling');

        expect(evaluateLayerCrossing({
            subject: 'object', direction: 'down', ordinal: TRUE_IMMORTAL_ORDINAL,
            power: OBJECT_CEILING_BELOW_THE_LID, madeAbove: true
        }).permitted).toBe(true);

        // A manual is paper, and may be rated anywhere.
        expect(evaluateLayerCrossing({
            subject: 'manual', direction: 'down', ordinal: TRUE_IMMORTAL_ORDINAL,
            power: TRUE_IMMORTAL_ORDINAL, madeAbove: true
        }).permitted).toBe(true);
    });

    it('lets nothing made below go up, which is why the world is full of sealed caves', () => {
        const below = evaluateLayerCrossing({
            subject: 'object', direction: 'up', ordinal: TRUE_IMMORTAL_ORDINAL, power: 40
        });
        expect(below.permitted).toBe(false);
        expect(below.reason).toBe('nothing_goes_through_but_the_cultivator');

        expect(evaluateLayerCrossing({
            subject: 'object', direction: 'up', ordinal: TRUE_IMMORTAL_ORDINAL,
            power: TRUE_IMMORTAL_ORDINAL, madeAbove: true
        }).permitted).toBe(true);
    });

    it('needs a channel for information, in either direction', () => {
        for (const direction of ['up', 'down'] as const) {
            expect(evaluateLayerCrossing({
                subject: 'information', direction, ordinal: TRUE_IMMORTAL_ORDINAL
            }).reason).toBe('no_channel');
            expect(evaluateLayerCrossing({
                subject: 'information', direction, ordinal: TRUE_IMMORTAL_ORDINAL, channel: true
            }).permitted).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT IS LIKE UP THERE
// ─────────────────────────────────────────────────────────────────────────

describe('the far side, materialised on contact', () => {
    it('does not exist until something needs it', () => {
        const state = world('imm-lazy');
        expect(immortalWorldShape(state).exists).toBe(false);
        expect(state.locations.every(l => isBelowTheLid(l))).toBe(true);
        expect(residentsAbove(state)).toHaveLength(0);
    });

    it('is a place with ground, houses, and people who were born there', () => {
        const state = world('imm-place');
        const summary = ensureImmortalLayer(state);

        expect(summary.created).toBe(true);
        expect(summary.houseIds.length).toBeGreaterThan(1);
        expect(summary.nativeIds).toHaveLength(IMMORTAL_NATIVE_COUNT);
        expect(state.locations.some(l => l.id === IMMORTAL_LANDING_LOCATION_ID)).toBe(true);
        expect(summary.perilGroundIds.length).toBeGreaterThan(0);

        // Everybody up there stands at the only ordinal that can be up there.
        for (const id of summary.nativeIds) {
            expect(getNpc(state, id)!.cultivation.realmOrdinal).toBe(TRUE_IMMORTAL_ORDINAL);
            expect(isAboveTheLid(getNpc(state, id)!)).toBe(true);
        }
    });

    /**
     * The obvious assertion here was wrong and the measurement said so.
     *
     * "Densities the lower world cannot produce" cannot mean a bigger number:
     * the scale runs 0..1 by definition, where 1.0 is the richest ground the
     * world has ever carried, and both a sealed ruin and a worked vein below
     * already reach it. What is actually true is where the figure sits and how
     * much of the map holds it - the age below runs about a third and only ever
     * falls, the places at the ceiling are a small minority, and every one of
     * them is sealed or being fought over. Above, the ceiling is the floor,
     * everywhere, and nobody is guarding it.
     */
    it('holds qi the lower world has not held since before its history', () => {
        const state = world('imm-qi');
        ensureImmortalLayer(state);
        const shape = immortalWorldShape(state);

        expect(shape.minQiDensityAbove).toBeGreaterThan(shape.eraQiDensityBelow);
        expect(shape.eraQiDensityBelow).toBeLessThan(0.5);
        // A pocket or two below reaches it. It is not the map.
        expect(shape.shareBelowAtImmortalDensity).toBeGreaterThan(0);
        expect(shape.shareBelowAtImmortalDensity).toBeLessThan(0.25);
        // Above, it is flat: the floor and the ceiling are the same figure.
        const above = state.locations.filter(l => isAboveTheLid(l));
        expect(Math.max(...above.map(l => l.qiDensity))).toBe(shape.minQiDensityAbove);
    });

    it('is older than the lower world can produce a record of', () => {
        const state = world('imm-old');
        const summary = ensureImmortalLayer(state);
        const earliestBelow = Math.min(...state.history.facts
            .filter(f => f.data.layer !== IMMORTAL_LAYER)
            .map(f => f.day));
        expect(summary.oldestFoundedOnDay).toBeLessThan(earliestBelow);
    });

    it('carries resources and arts with no equivalent below', () => {
        const state = world('imm-things');
        ensureImmortalLayer(state);
        const made = thingsMadeAbove(state);
        expect(made.length).toBeGreaterThan(0);

        // Not a parallel catalog: ordinary rows in the ordinary object table,
        // ordered by the ordinary power field. What makes them unavailable
        // below is the crossing rule, which applies to everything in the world.
        const weapons = made.filter(o => o.kind !== 'manual');
        expect(weapons.every(o => cannotBeHeldBelow(o))).toBe(true);
        expect(made.some(o => o.kind === 'manual' && !cannotBeHeldBelow(o))).toBe(true);
    });

    it('has natural law of its own that a newcomer does not get a vote on', () => {
        const state = world('imm-law');
        ensureImmortalLayer(state);
        const landing = state.locations.find(l => l.id === IMMORTAL_LANDING_LOCATION_ID)!;
        expect(landing.environment.specialRules.length).toBeGreaterThan(0);
    });

    it('is a property of the seed rather than of when anybody looked', () => {
        const early = world('imm-det');
        const late = world('imm-det');
        ensureImmortalLayer(early);
        advanceWorldYears(late, 500);
        ensureImmortalLayer(late);

        const shapeOf = (s: WorldState) => {
            const above = s.locations.filter(l => isAboveTheLid(l));
            return {
                locations: above.map(l => `${l.id}:${l.name}:${l.qiDensity}`).sort(),
                houses: s.factions.filter(f => isAboveTheLid(f)).map(f => `${f.id}:${f.name}`).sort(),
                natives: s.npcs.filter(n => n.tags.includes('native'))
                    .map(n => `${n.id}:${n.name}:${n.cultivation.realmOrdinal}`).sort()
            };
        };
        expect(shapeOf(late)).toEqual(shapeOf(early));
    });

    it('is created once and only once', () => {
        const state = world('imm-idem');
        const first = ensureImmortalLayer(state);
        const before = state.locations.length;
        const second = ensureImmortalLayer(state);
        expect(second.created).toBe(false);
        expect(state.locations.length).toBe(before);
        expect(second.nativeIds).toEqual(first.nativeIds);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TRANSITION AT 46
// ─────────────────────────────────────────────────────────────────────────

describe('ascension is a transition and never an ending', () => {
    it('refuses anybody who has not completed the last crossing', () => {
        const state = world('imm-gate');
        const someone = state.npcs.find(n => n.status === 'alive')!;
        const out = ascend(state, { npcId: someone.id, onDay: state.currentDay });
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('crushed_beyond_the_lid');
        expect(immortalWorldShape(state).exists).toBe(false);
    });

    it('moves them, and leaves them a going concern', () => {
        const state = world('imm-move');
        const { npc } = candidate(state);
        const out = ascend(state, { npcId: npc.id, onDay: state.currentDay });

        expect(out.ok).toBe(true);
        const after = getNpc(state, npc.id)!;
        expect(after.status).toBe('alive');
        expect(isGoingConcern(after.status)).toBe(true);
        expect(isAboveTheLid(after)).toBe(true);
        expect(after.locationId).toBe(IMMORTAL_LANDING_LOCATION_ID);
        // Lifespan has stopped being a number, and does not quietly run out.
        expect(after.cultivation.lifespanEndsOnDay).toBeGreaterThan(state.currentDay + 1e9);
        expect(afterCrossingOf(state, npc.id)).toBe('still_above');
    });

    it('is not a hard reset: everything that was true about them still is', () => {
        const state = world('imm-noreset');
        const { npc, heir, enemy } = candidate(state);
        const factsBefore = queryFacts(state.history, { actorId: npc.id }).length;

        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        const after = getNpc(state, npc.id)!;

        // Same id, same grudge, same unfinished business, same history.
        expect(after.id).toBe(npc.id);
        expect(after.relationships.find(r => r.targetId === enemy.id)!.standing).toBeLessThan(0);
        expect(after.goals.some(g => g.text.includes('Weir'))).toBe(true);
        expect(queryFacts(state.history, { actorId: npc.id }).length).toBeGreaterThan(factsBefore);

        // Still on the family tree, with the descendant still below.
        const lineage = state.lineages.find(l => l.id === 'lin-candidate')!;
        expect(descendantsOf(lineage, npc.id).map(d => d.id)).toContain(heir.id);
        expect(isBelowTheLid(getNpc(state, heir.id)!)).toBe(true);
    });

    it('takes nothing through with them, and builds a door on what is left', () => {
        const state = world('imm-divest');
        const { npc } = candidate(state);
        const out = ascend(state, { npcId: npc.id, onDay: state.currentDay, spiritStones: 4_000 });

        expect(out.ok).toBe(true);
        // Nothing they were carrying is still theirs.
        expect(state.objects.filter(o => o.possessorId === npc.id)).toHaveLength(0);

        // The house they left got the best thing they could legally leave.
        expect(out.gift).not.toBeNull();
        expect(out.gift!.power ?? 0).toBeLessThanOrEqual(OBJECT_CEILING_BELOW_THE_LID);
        const faction = getFaction(state, npc.factionId ?? out.record!.fromFactionId!)!;
        expect(faction.resources.ascended_ancestors).toBe(1);
        expect(faction.resources.last_ascension_day).toBe(state.currentDay);

        // The rest went behind a door somebody put there on purpose, on their
        // way out, knowing they would never come back to check.
        expect(out.inheritance).not.toBeNull();
        const cache = out.inheritance!;
        expect(cache.sealed).toBe(true);
        expect(cache.discovered).toBe(false);
        expect(cache.data.spiritStones).toBe(4_000);
        expect(out.divested.length).toBeGreaterThan(0);
        for (const object of out.divested) {
            expect(object.locationId).toBe(cache.id);
            expect(object.possessorId).toBeNull();
            expect(object.provenance[object.provenance.length - 1].source).toContain(npc.name);
        }

        // Calibrated rather than merely lethal: somebody below the Lid is meant
        // to get in eventually, and the trial says which somebody.
        const calibratedFor = Number(cache.data.calibratedFor);
        expect(calibratedFor).toBeGreaterThanOrEqual(17);
        expect(calibratedFor).toBeLessThan(TRUE_IMMORTAL_ORDINAL);
        expect(evaluateAccess(cache, { realmOrdinal: 5 }).level).not.toBe('mastered');
        expect(evaluateAccess(cache, { realmOrdinal: calibratedFor + 4 }).level).toBe('mastered');
    });

    it('tells the world below nothing it can rely on', () => {
        const state = world('imm-signal');
        const { npc } = candidate(state);
        const out = ascend(state, { npcId: npc.id, onDay: state.currentDay });

        const below = state.history.facts.find(f => f.id === out.record!.belowFactId)!;
        expect(below.truth).toBe('unresolved');
        expect(below.claimedOutcomes.length).toBe(3);
        // Crossed, died, and in seclusion are indistinguishable from underneath.
        expect(below.claimedOutcomes.join(' ')).toMatch(/above the Lid/);
        expect(below.claimedOutcomes.join(' ')).toMatch(/did not survive/);
        expect(below.claimedOutcomes.join(' ')).toMatch(/seclusion/);

        // The engine's own record is secret and stays that way.
        const arrival = out.facts.find(f => f.data.arrivedOnDay !== undefined)!;
        expect(arrival.visibility).toBe('secret');
    });

    it('refuses a second crossing for the same name', () => {
        const state = world('imm-twice');
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        const again = ascend(state, { npcId: npc.id, onDay: state.currentDay + YEAR });
        expect(again.ok).toBe(false);
        expect(again.reason).toBe('already_above');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A NEWLY ASCENDED IMMORTAL IS A NOBODY
// ─────────────────────────────────────────────────────────────────────────

describe('both facts are true at the same time', () => {
    function arrived(seed: string) {
        const state = world(seed);
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        return { state, id: npc.id };
    }

    it('scores zero on every axis standing is made of', () => {
        const { state, id } = arrived('imm-nobody');
        const standing = immortalStanding(state, id);

        expect(standing.resident).toBe(true);
        expect(standing.tenureYears).toBeLessThan(1);
        expect(standing.lineageDepthAbove).toBe(0);
        expect(standing.houseId).toBeNull();
        expect(standing.alliesAbove).toBe(0);
        expect(standing.holdingsAbove).toBe(0);
        expect(standing.standing).toBe(0);
        expect(standing.verdict).toContain('newcomer');
        // Last in the room, and the room is not small.
        expect(standing.rankAmongResidents).toBe(standing.residentCount);
        expect(standing.residentCount).toBeGreaterThan(IMMORTAL_NATIVE_COUNT);
    });

    it('measures the same cultivation everybody up there has', () => {
        const { state, id } = arrived('imm-same');
        const newcomer = getNpc(state, id)!;
        for (const other of residentsAbove(state)) {
            expect(other.cultivation.realmOrdinal).toBe(newcomer.cultivation.realmOrdinal);
            expect(powerMultiplierForOrdinal(other.cultivation.realmOrdinal))
                .toBe(powerMultiplierForOrdinal(newcomer.cultivation.realmOrdinal));
        }
        expect(immortalStanding(state, id).cultivationIsUnremarkable).toBe(true);
    });

    it('reads as beyond comprehension below and unremarkable above, at once', () => {
        const { state, id } = arrived('imm-two');
        const readings = readTwoWays(state, id);

        // Measured, not asserted: a division over the living roster below,
        // whatever the strongest thing alive down there happens to be today.
        expect(readings.below.powerMultiplier).toBe(powerMultiplierForOrdinal(TRUE_IMMORTAL_ORDINAL));
        expect(readings.below.timesTheStrongestBelow).toBeCloseTo(
            readings.below.powerMultiplier / readings.below.strongestBelowMultiplier, 2
        );
        // At least a full realm clear of it, and in this world a great deal more.
        expect(readings.below.timesTheStrongestBelow).toBeGreaterThanOrEqual(16);

        // And below the middle of the room they walked into.
        expect(readings.above.standing).toBeLessThan(readings.above.medianResidentStanding);
        expect(readings.above.rankAmongResidents).toBeGreaterThan(1);
        expect(readings.bothTrue).toBe(true);
    });

    it('gives the people who were already there the standing instead', () => {
        const { state } = arrived('imm-natives');
        const natives = state.npcs.filter(n => n.tags.includes('native'));
        const standings = natives.map(n => immortalStanding(state, n.id).standing);
        expect(Math.min(...standings)).toBeGreaterThan(0);
        // Tenure, a line, a house, allies. None of it is cultivation.
        const best = immortalStanding(state, natives[0].id);
        expect(best.tenureYears).toBeGreaterThan(1_000);
        expect(best.houseId).not.toBeNull();
        expect(best.alliesAbove).toBeGreaterThan(0);
        expect(best.components.map(c => c.source).sort())
            .toEqual(['allies', 'holdings', 'house', 'lineage', 'tenure']);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THEY CAN STILL DIE
// ─────────────────────────────────────────────────────────────────────────

describe('ascension removes exactly two things', () => {
    it('leaves everything on the list still able to kill, and nobody safe', () => {
        // A newcomer with nothing is in the most danger; a founder with
        // everything is in less, and never in none.
        expect(perilChance('environment', 0)).toBeGreaterThan(perilChance('environment', 1));
        expect(perilChance('politics', 0)).toBeGreaterThan(perilChance('politics', 1));
        expect(MAX_PERIL_RELIEF).toBeLessThan(1);
        expect(perilChance('environment', 1)).toBeGreaterThan(0);
        expect(perilChance('politics', 1)).toBeGreaterThan(0);
    });

    it('kills people up there over a long enough run, and records which two things did it', () => {
        const state = world('imm-death');
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });

        const out = advanceImmortalLayer(state, state.currentDay, state.currentDay + 3_000 * YEAR);
        state.currentDay += 3_000 * YEAR;

        expect(out.deaths.length).toBeGreaterThan(0);
        expect(out.perils.every(p => p.kind === 'environment' || p.kind === 'politics')).toBe(true);
        for (const id of out.deaths) {
            expect(getNpc(state, id)!.status).toBe('physically_dead');
        }
    });

    it('is not a wasting: nobody up there ever dies of lifespan', () => {
        const state = world('imm-span');
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        advanceWorldYears(state, 400);

        const dead = state.npcs.filter(n => isAboveTheLid(n) && n.status === 'physically_dead');
        for (const person of dead) {
            expect(person.endNote).not.toMatch(/lifespan/i);
        }
    });

    it('lets nobody below find out, ever', () => {
        const state = world('imm-quiet');
        const { npc, heir } = candidate(state);
        const out = ascend(state, { npcId: npc.id, onDay: state.currentDay });
        const factionId = out.record!.fromFactionId!;

        const from = state.currentDay;
        const advance = advanceImmortalLayer(state, from, from + 6_000 * YEAR);
        state.currentDay = from + 6_000 * YEAR;
        expect(advance.deaths.length).toBeGreaterThan(0);

        // Every death above is secret, and the disciple who knew them best
        // learns nothing from the world's own report.
        const deathFacts = state.history.facts.filter(
            f => f.day >= from && f.kind === 'death' && f.data.layer === IMMORTAL_LAYER
        );
        expect(deathFacts.length).toBeGreaterThan(0);
        expect(deathFacts.every(f => f.visibility === 'secret')).toBe(true);

        const digest = buildPlayerDigest(
            state.history.facts.filter(f => f.day >= from),
            simpleAccess({
                actorId: heir.id,
                locationId: getNpc(state, heir.id)!.locationId,
                factionId,
                knownFactionIds: [factionId],
                knownNpcIds: state.npcs.filter(n => isBelowTheLid(n)).map(n => n.id)
            }),
            from,
            state.currentDay
        );
        const names = namesPermitted(digest);
        for (const resident of state.npcs.filter(n => isAboveTheLid(n))) {
            expect(names.npcs.has(resident.name)).toBe(false);
        }

        // And the sect's claim is unchanged by the truth, which is the point.
        const claimIsTrue = afterCrossingOf(state, npc.id) === 'still_above';
        expect(typeof claimIsTrue).toBe('boolean');
        expect(getFaction(state, factionId)!.resources.ascended_ancestors).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE LOWER WORLD DOES NOT PAUSE
// ─────────────────────────────────────────────────────────────────────────

describe('both layers keep running', () => {
    it('leaves a world behind rather than a snapshot', () => {
        const state = world('imm-running');
        const { npc, heir } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });

        const before = worldShape(state);
        const heirWas = getNpc(state, heir.id)!.cultivation.realmOrdinal;
        advanceWorldYears(state, 300);
        const after = worldShape(state);

        // The world they left is substantially different when they next look.
        expect(after.facts).toBeGreaterThan(before.facts);
        expect(after.year).toBe(before.year + 300);
        expect(
            after.livingNpcs !== before.livingNpcs ||
            after.locationChanges > before.locationChanges ||
            after.factionIds.join() !== before.factionIds.join()
        ).toBe(true);
        // Including the disciple, who has had three centuries of their own.
        //
        // This used to assert simply that they were dead, on the arithmetic
        // that a Qi Condensation life is a hundred years and three hundred had
        // passed. That stopped being the only way the three centuries can show:
        // the world now rolls real breakthroughs for NPCs, so a disciple who
        // crossed into Foundation Establishment has two hundred years and one
        // who reached Core Formation has five hundred, and being alive at the
        // end is then a fact about what they did rather than a failure of the
        // clock. See `an-npc-striking-at-the-next-wall.ts`.
        //
        // The claim was always "three centuries happened to them too", so that
        // is what it asks: they are gone, or they are not the person the
        // ancestor left behind.
        const heirNow = getNpc(state, heir.id)!;
        expect(
            heirNow.status !== 'alive' || heirNow.cultivation.realmOrdinal !== heirWas,
            `the disciple is still alive at ordinal ${heirNow.cultivation.realmOrdinal}, `
            + `exactly where they were three hundred years ago`
        ).toBe(true);
    });

    it('advances the far side on the same call as the near one', () => {
        const state = world('imm-driver');
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        const out = advanceWorldYears(state, 1_500);
        expect(out.immortalPerils.length + out.immortalDeaths.length).toBeGreaterThan(0);
        expect(immortalWorldShape(state).exists).toBe(true);
    });

    it('is decomposable: ten years then thirty is forty, on both layers', () => {
        const base = world('imm-decompose');
        candidate(base);
        const npcId = base.npcs.find(n => isBelowTheLid(n) && n.cultivation.realmOrdinal === TRUE_IMMORTAL_ORDINAL)!.id;
        ascend(base, { npcId, onDay: base.currentDay });

        const whole = cloneWorld(base);
        const split = cloneWorld(base);
        advanceWorldYears(whole, 400);
        advanceWorldYears(split, 150);
        advanceWorldYears(split, 250);

        const shapeOf = (s: WorldState) => ({
            ...immortalWorldShape(s),
            residentStatuses: residentsAbove(s).map(r => `${r.id}:${r.status}`).sort()
        });
        expect(shapeOf(split)).toEqual(shapeOf(whole));
    });

    it('does not let the lower world run immortal politics', () => {
        const state = world('imm-pressure');
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });

        const houseIds = state.factions.filter(f => isAboveTheLid(f)).map(f => f.id);
        const aboveLocationChanges = state.locations
            .filter(l => isAboveTheLid(l))
            .reduce((n, l) => n + l.changes.length, 0);

        advanceWorldYears(state, 300);

        // Politics up there has been running uninterrupted for a very long
        // time, and a fifty-five-events-per-century budget does not get to
        // reorganise it. Nothing dissolves, nothing migrates, no ground scars.
        for (const id of houseIds) {
            expect(getFaction(state, id)!.dissolvedOnDay).toBeNull();
        }
        expect(state.locations.filter(l => isAboveTheLid(l))
            .reduce((n, l) => n + l.changes.length, 0)).toBe(aboveLocationChanges);
        expect(state.npcs.filter(n => isAboveTheLid(n))
            .every(n => n.locationId === null || isAboveTheLid(state.locations.find(l => l.id === n.locationId)!)))
            .toBe(true);
    });

    it('does not grow a third layer, however long it runs', () => {
        const state = world('imm-nothird');
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        advanceWorldYears(state, 500);

        const layers = new Set(state.locations.map(l => layerOf(l)));
        expect(Array.from(layers).sort()).toEqual([IMMORTAL_LAYER, MORTAL_LAYER].sort());
        expect(WORLD_LAYERS).toHaveLength(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// COMING BACK DOWN
// ─────────────────────────────────────────────────────────────────────────

describe('a descent answers once, very fast, and cannot conquer', () => {
    function abovePerson(seed: string) {
        const state = world(seed);
        const { npc } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        return { state, id: npc.id };
    }

    it('buys ten to fifteen breaths and the heaviest tribulation in the game', () => {
        const { state, id } = abovePerson('imm-down');
        const target = state.locations.find(l => l.kind === 'region' && isBelowTheLid(l))!;
        const out = descend(state, {
            residentId: id,
            toLocationId: target.id,
            onDay: state.currentDay,
            reason: 'To settle one thing.'
        });

        expect(out.ok).toBe(true);
        expect(out.breaths).toBeGreaterThanOrEqual(BREATHS_IN_THE_LOWER_REALM.min);
        expect(out.breaths).toBeLessThanOrEqual(BREATHS_IN_THE_LOWER_REALM.max);
        expect(out.strikes).toBeGreaterThan(0);
        // Witnessed, enormous, and over before it starts.
        expect(out.fact!.visibility).toBe('public');
        expect(out.fact!.magnitude).toBeGreaterThan(0.9);
        // Still above the Lid the whole time: the expulsion is already running.
        expect(isAboveTheLid(getNpc(state, id)!)).toBe(true);
    });

    it('refuses to leave anything at its own rung behind', () => {
        const { state, id } = abovePerson('imm-leave');
        const relic = thingsMadeAbove(state).find(o => o.kind !== 'manual')!;
        Object.assign(state, upsertObject(state, { ...relic, possessorId: id }));
        const manual = thingsMadeAbove(state).find(o => o.kind === 'manual')!;
        Object.assign(state, upsertObject(state, { ...manual, possessorId: id }));

        const target = state.locations.find(l => l.kind === 'region' && isBelowTheLid(l))!;
        const out = descend(state, {
            residentId: id,
            toLocationId: target.id,
            onDay: state.currentDay,
            reason: 'A delivery.',
            leaveBehind: [relic.id, manual.id]
        });

        expect(out.refused.map(r => r.objectId)).toContain(relic.id);
        expect(out.refused[0].reason).toBe('above_the_object_ceiling');
        expect(out.carriedBack).toContain(relic.id);
        // Paper stays. Nothing about holding it makes the reader anything.
        expect(out.leftBehind).toContain(manual.id);
    });

    it('will not carry anybody who is not already up there', () => {
        const state = world('imm-nodown');
        const someone = state.npcs.find(n => n.status === 'alive')!;
        const out = descend(state, {
            residentId: someone.id,
            toLocationId: someone.locationId!,
            onDay: state.currentDay,
            reason: 'No.'
        });
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('not_beyond_the_lid');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE CHANNEL
// ─────────────────────────────────────────────────────────────────────────

describe('the only reliable channel between the two sides', () => {
    function wired(seed: string) {
        const state = world(seed);
        const { npc, heir } = candidate(state);
        ascend(state, { npcId: npc.id, onDay: state.currentDay });
        Object.assign(state, upsertObject(state, makeObject({
            id: 'obj-channel',
            name: 'a jade slip that answers',
            kind: 'token',
            significance: 'legendary',
            possessorId: heir.id,
            locationId: getNpc(state, heir.id)!.locationId,
            tags: [LID_CHANNEL_TAG]
        })));
        return { state, aboveId: npc.id, belowId: heir.id };
    }

    it('carries a message to exactly one person and announces nothing', () => {
        const { state, aboveId, belowId } = wired('imm-chan');
        const out = sendAcross(state, {
            fromId: aboveId,
            toId: belowId,
            onDay: state.currentDay,
            channelObjectId: 'obj-channel',
            subject: 'information',
            message: 'Do not go to the Weir.'
        });

        expect(out.ok).toBe(true);
        expect(out.fact!.visibility).toBe('secret');
        expect(state.memories.records.some(
            m => m.ownerId === belowId && m.summary.includes('Weir')
        )).toBe(true);
    });

    it('refuses without one, however much anybody wants it', () => {
        const { state, aboveId, belowId } = wired('imm-nochan');
        Object.assign(state, upsertObject(state, makeObject({
            id: 'obj-not-a-channel', name: 'a jade slip that does not', kind: 'token'
        })));
        const out = sendAcross(state, {
            fromId: aboveId, toId: belowId, onDay: state.currentDay,
            channelObjectId: 'obj-not-a-channel', subject: 'information', message: 'Hello.'
        });
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('no_channel');
    });

    it('sends paper down and refuses a weapon at the same rating', () => {
        const { state, aboveId, belowId } = wired('imm-send');
        const manual = thingsMadeAbove(state).find(o => o.kind === 'manual')!;
        const relic = thingsMadeAbove(state).find(o => o.kind !== 'manual')!;
        Object.assign(state, upsertObject(state, { ...manual, possessorId: aboveId }));

        const paper = sendAcross(state, {
            fromId: aboveId, toId: belowId, onDay: state.currentDay,
            channelObjectId: 'obj-channel', subject: 'manual', objectId: manual.id
        });
        expect(paper.ok).toBe(true);
        expect(state.objects.find(o => o.id === manual.id)!.possessorId).toBe(belowId);

        const weapon = sendAcross(state, {
            fromId: aboveId, toId: belowId, onDay: state.currentDay,
            channelObjectId: 'obj-channel', subject: 'object', objectId: relic.id
        });
        expect(weapon.ok).toBe(false);
        expect(weapon.reason).toBe('above_the_object_ceiling');
    });

    it('says exactly what silence establishes, which is nothing', () => {
        const { state, aboveId, belowId } = wired('imm-silence');
        expect(readChannel(state, 'obj-channel')!.lastAnsweredOnDay).toBeNull();

        sendAcross(state, {
            fromId: aboveId, toId: belowId, onDay: state.currentDay,
            channelObjectId: 'obj-channel', subject: 'information', message: 'Still here.'
        });
        const answered = readChannel(state, 'obj-channel')!;
        expect(answered.lastAnsweredOnDay).toBe(state.currentDay);
        expect(answered.statement).toContain('picking up');

        const later = readChannel(state, 'obj-channel', state.currentDay + 400 * YEAR)!;
        expect(later.silentYears).toBeGreaterThan(300);
        // Four things, and it distinguishes none of them.
        expect(later.consistentWith).toHaveLength(4);
        expect(later.consistentWith.join(' ')).toMatch(/stopped working/);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────

describe('the layer survives a restart', () => {
    it('has the columns and the table in the migrated schema', () => {
        const db = new Database(':memory:');
        migrate(db);
        for (const table of ['world_locations', 'world_factions', 'world_npcs', 'world_actors']) {
            const cols = new Set(
                (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
            );
            expect(cols.has('layer'), `${table}.layer`).toBe(true);
        }
        const cols = new Set(
            (db.prepare('PRAGMA table_info(world_ascensions)').all() as { name: string }[]).map(c => c.name)
        );
        for (const c of [
            'resident_id', 'ascended_on_day', 'from_faction_id', 'to_location_id',
            'below_fact_id', 'after_crossing', 'died_above_on_day',
            'inheritance_location_id', 'parting_gift_object_id'
        ]) {
            expect(cols.has(c), `world_ascensions.${c}`).toBe(true);
        }
        db.close();
    });

    it('round-trips the layer, the residents and what the engine knows became of them', () => {
        const db = new Database(':memory:');
        migrate(db);
        const repo = new WorldStateRepository(db);

        const state = world('imm-persist');
        const { npc } = candidate(state);
        const out = ascend(state, { npcId: npc.id, onDay: state.currentDay, runId: 'run-1' });
        // And then the engine learns something the world never will.
        state.ascensions[0].afterCrossing = 'died_above';
        state.ascensions[0].diedAboveOnDay = state.currentDay + 900 * YEAR;
        Object.assign(state, upsertNpc(state, {
            ...getNpc(state, npc.id)!,
            status: 'physically_dead',
            diedOnDay: state.currentDay + 900 * YEAR
        }));

        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;

        expect(loaded.locations.filter(l => isAboveTheLid(l)).length)
            .toBe(state.locations.filter(l => isAboveTheLid(l)).length);
        expect(loaded.factions.filter(f => isAboveTheLid(f)).length)
            .toBe(state.factions.filter(f => isAboveTheLid(f)).length);
        expect(loaded.npcs.filter(n => isAboveTheLid(n)).length)
            .toBe(state.npcs.filter(n => isAboveTheLid(n)).length);

        const record = ascensionOf(loaded, npc.id)!;
        expect(record.afterCrossing).toBe('died_above');
        expect(record.runId).toBe('run-1');
        expect(record.fromFactionId).toBe(out.record!.fromFactionId);
        expect(record.inheritanceLocationId).toBe(out.record!.inheritanceLocationId);
        expect(record.belowFactId).toBe(out.record!.belowFactId);
        db.close();
    });
});
