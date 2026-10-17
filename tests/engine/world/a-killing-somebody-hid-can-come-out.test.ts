/**
 * Hidden killings have a chance of discovery, and discovery uses the ordinary
 * fact, grievance and house-sentence writers. On8210cf97 the fixed afford-a
 *300-year sample retained zero hidden killings, so it could not test disclosure.
 * Native concealment is a priced grudge_opened deed, distinct from the death
 * and wake. Its participants are retained; forgetting is not an explanation
 * for that empty sample.
 *
 * Reachability finds the SAME unresolved-deed predicate at250/300 across two seeds.
 * The shared predicate covers its secret deed, dead victim, living killer and
 * inquirers within the inquiry span. An arranged instance written by the engine
 * and a real checkpoint instance call the SAME resolution scenario. Conditional
 * hazard units retain the four inputs. A complete native500-year measurement
 * produced one concealed deed, too late for100 years of follow-up. The old
 * population-wide >5 and <50% sample bounds are retired: larger real samples
 * also mix materially different ranks and numbers of inquirers. They were
 * observations of an older population, not universal rules of the hazard.
 * Low-profile deaths retain the full-inquiry <50% calibration below. A seeded
 * one-year sample exercises the actual discovery pass:16384 trials expect
 * about18 discoveries at its ordinary one-inquirer chance, with most hidden.
 * Real checkpoint reachability and the resolution contract remain separate.
 */
import { describe, it, expect } from 'vitest';
import { sampledWorld } from '../../support/sampled-world.js';
import { witnessIndexFor } from '../../../src/engine/world/witness-reaction-index.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, markDead, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { aDeedEntersTheWorld } from '../../../src/engine/world/a-deed-enters-the-world-as-a-fact.js';
import { aHiddenKillingBecomesKnown } from '../../../src/engine/world/a-hidden-killing-becomes-known.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { CAME_TO_LIGHT, HOW_LONG_A_THING_CAN_COME_OUT, whetherItComesOut,
    whoIsAskingAbout, whatComesToLightThisYear } from '../../../src/engine/world/what-comes-to-light-about-a-killing.js';

function isAnUnresolvedKillingWithInquirers(world: WorldState, factId: string): boolean {
    const fact = witnessIndexFor(world).byId.get(factId);
    if (!fact || fact.kind !== 'grudge_opened' || fact.data?.hidden !== true
        || fact.data.deedWeight !== 'unforgivable'
        || fact.data[CAME_TO_LIGHT] !== undefined || fact.visibility !== 'secret' || fact.causeKnown) return false;
    const killer = world.npcs.find(person => person.id === fact.actors.find(actor => actor.role === 'killer')?.id);
    const victim = world.npcs.find(person => person.id === fact.actors.find(actor => actor.role === 'victim')?.id);
    const age = (world.currentDay - fact.day) / 365;
    return !!killer && !!victim && killer.status === 'alive' && victim.status === 'physically_dead'
        && age >= 0 && age <= HOW_LONG_A_THING_CAN_COME_OUT
        && whoIsAskingAbout(world, victim).some(person => person.id !== killer.id);
}

function discoveryScenario(world: WorldState, factId: string): void {
    expect(isAnUnresolvedKillingWithInquirers(world, factId)).toBe(true);
    const fact = world.history.facts.find(row => row.id === factId)!;
    const killer = world.npcs.find(person => person.id === fact.actors.find(actor => actor.role === 'killer')!.id)!;
    const victim = world.npcs.find(person => person.id === fact.actors.find(actor => actor.role === 'victim')!.id)!;
    const asking = whoIsAskingAbout(world, victim).filter(person => person.id !== killer.id);
    aHiddenKillingBecomesKnown(world, fact, killer, victim, asking, world.currentDay);
    expect(fact.visibility).not.toBe('secret');
    expect(fact.causeKnown).toBe(true);
    expect(fact.data?.[CAME_TO_LIGHT]).toBe(world.currentDay);
    const said = world.history.facts.filter(row => row.data?.cameToLightAbout === factId);
    expect(said.length).toBeGreaterThan(0);
    for (const person of asking) expect(world.npcs.find(row => row.id === person.id)!.relationships.some(tie =>
        tie.targetId === killer.id && tie.standing <= -0.8 && /hid it/.test(tie.note))).toBe(true);
    expect(world.npcs.some(person => person.relationships.some(tie => tie.targetId === person.id && /hid it/.test(tie.note)))).toBe(false);
    whatComesToLightThisYear(world, Math.floor(world.currentDay / 365), world.currentDay);
    expect(world.history.facts.filter(row => row.data?.cameToLightAbout === factId)).toHaveLength(said.length);
}

function arrangedKilling(seed = 'hidden-death-scenario'): { world: WorldState; factId: string } {
    const world = createWorld({ seed, presentYear: 0, regionCount: 0, skipPriorAges: true });
    world.locations.push(makeLocation({ id: 'town', name: 'A town', kind: 'settlement' }));
    const person = (id: string) => createNpc(world.seed, { id, name: id, onDay: 0, bornOnDay: -20 * 365, locationId: 'town' });
    const killer = person('killer'), inquirer = person('inquirer');
    const victim = markDead(upsertRelationship(person('victim'), { targetId: inquirer.id, targetName: inquirer.name,
        kind: 'kin', standing: 0.8, note: 'Their family.', factIds: [] }, 0), 0, 'Killed.');
    world.npcs.push(killer, victim, inquirer);
    const { fact } = aDeedEntersTheWorld(world, { kind: 'grudge_opened', day: 0, locationId: 'town', weight: 'unforgivable',
        actors: [{ id: killer.id, name: killer.name, role: 'killer' }, { id: victim.id, name: victim.name, role: 'victim' }],
        summary: 'A person killed another and concealed it.', unattributed: 'A death was reported.',
        workedOut: false, data: { hidden: true } });
    expect(isAnUnresolvedKillingWithInquirers(world, fact.id)).toBe(true);
    return { world, factId: fact.id };
}

async function realInstances() {
    const instances = [];
    for (const seed of ['drift-guard', 'demography']) for (const years of [250, 300]) {
        const world = await sampledWorld(seed, { years });
        instances.push({ seed, years, world, ids: world.history.facts.filter(fact => isAnUnresolvedKillingWithInquirers(world, fact.id)).map(fact => fact.id) });
    }
    return instances;
}

describe('what would turn one up', () => {
    const fresh = { yearsSince: 1, onOpenGround: false, asking: 4, victimOrdinal: 40 };
    it('is nothing where nobody remains to ask', () => {
        expect(whetherItComesOut({ ...fresh, asking: 0 })).toBe(0);
        expect(whetherItComesOut(fresh)).toBeGreaterThan(0);
    });
    it('fades and stops outside the inquiry span', () => {
        expect(whetherItComesOut({ ...fresh, yearsSince: 100 })).toBeLessThan(whetherItComesOut(fresh));
        expect(whetherItComesOut({ ...fresh, yearsSince: HOW_LONG_A_THING_CAN_COME_OUT + 1 })).toBe(0);
    });
    it('is lower on open ground and for somebody less known', () => {
        expect(whetherItComesOut({ ...fresh, onOpenGround: true })).toBeLessThan(whetherItComesOut(fresh));
        expect(whetherItComesOut({ ...fresh, victimOrdinal: 2 })).toBeLessThan(whetherItComesOut(fresh));
    });
    it('leaves most low-rung deaths hidden even with one continuous inquirer', () => {
        let hidden = 1;
        for (let yearsSince = 1; yearsSince <= HOW_LONG_A_THING_CAN_COME_OUT; yearsSince++)
            hidden *= 1 - whetherItComesOut({ yearsSince, onOpenGround: false, asking: 1, victimOrdinal: FOUNDATION_ORDINAL - 1 });
        expect(1 - hidden).toBeGreaterThan(0);
        expect(1 - hidden).toBeLessThan(0.5);
    });
});

describe('discovery from the same reachable precondition', () => {
    it('the yearly pass turns up some low-profile killings and leaves most hidden', () => {
        const trials = 16_384;
        let discovered = 0;
        for (let draw = 0; draw < trials; draw++) {
            const { world, factId } = arrangedKilling(`hidden-annual-${draw}`);
            const result = whatComesToLightThisYear(world, 0, 0);
            const fact = world.history.facts.find(row => row.id === factId)!;
            expect(result.found.length + result.stillHidden).toBe(1);
            expect(result.found.length).toBe(Number(typeof fact.data[CAME_TO_LIGHT] === 'number'));
            if (result.found.length > 0) {
                expect(fact.causeKnown).toBe(true);
                expect(fact.visibility).not.toBe('secret');
            }
            discovered += result.found.length;
        }
        expect(discovered).toBeGreaterThan(0);
        expect(discovered / trials).toBeLessThan(0.5);
    });
    it('finds the shared unresolved-deed state in genuinely walked worlds', async () => {
        const reached = await realInstances();
        expect(reached.some(sample => sample.ids.length > 0)).toBe(true);
    }, 120_000);
    it('records disclosure and its accounts from an arranged instance', () => {
        const { world, factId } = arrangedKilling();
        discoveryScenario(world, factId);
    });
    it('passes a real unresolved instance through the same scenario', async () => {
        const sample = (await realInstances()).find(sample => sample.ids.length > 0);
        expect(sample).toBeDefined();
        discoveryScenario(sample!.world, sample!.ids[0]!);
    }, 120_000);
});
