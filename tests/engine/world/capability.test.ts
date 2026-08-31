import { describe, it, expect } from 'vitest';
import {
    assessCapability,
    can,
    grantStatus,
    grantsAvailableAt,
    heldGrants,
    makeCapabilityModifier,
    makeRequirements,
    makeSubject,
    neutralisedHazards,
    realmClassForOrdinal,
    requirementsFromInscription,
    requirementsFromLocation,
    requirementsFromOpposition,
    subjectFromLocation,
    subjectFromOpposition,
    type CapabilityActor
} from '../../../src/engine/world/capability.js';
import {
    makeAffinity,
    makeLocation,
    makeThresholds
} from '../../../src/engine/world/locations.js';

function actor(init: Partial<CapabilityActor> & { realmOrdinal: number }): CapabilityActor {
    return { id: 'a', ...init };
}

describe('capability: never a gate', () => {
    const elder = subjectFromOpposition({
        id: 'npc-elder',
        name: 'Elder Bai',
        realmOrdinal: 19,      // Core Formation Late
        alertness: 0.8
    });

    it('permits a weak cultivator to attempt to rob a Core Formation elder', () => {
        const thief = actor({ realmOrdinal: 4 });   // Qi Condensation Layer 5
        const a = assessCapability(thief, elder);

        // The attempt is allowed. That is the whole point.
        expect(a.attempt.holds).toBe(true);
        expect(a.attempt.requirement).toBe(0);
        // And everything else says what it costs.
        expect(a.survive.holds).toBe(false);
        expect(a.succeed.holds).toBe(false);
        expect(a.force.holds).toBe(false);
        expect(a.summary).toContain('can attempt');
        expect(a.summary).not.toContain('unavailable');
    });

    it('lets preparation and a distracted target change the answer without changing the realm', () => {
        const distracted = subjectFromOpposition({
            id: 'npc-elder', name: 'Elder Bai', realmOrdinal: 19, alertness: 0.1, preparation: 10
        });
        const thief = actor({ realmOrdinal: 10 });
        const alertCase = assessCapability(thief, elder);
        const distractedCase = assessCapability(thief, distracted);

        expect(distractedCase.succeed.requirement).toBeLessThan(alertCase.succeed.requirement);
        expect(distractedCase.survive.requirement).toBeLessThan(alertCase.survive.requirement);
        // Force does not move: imposing an outcome on somebody who resists is
        // the one place raw weight is close to the whole answer.
        expect(distractedCase.force.requirement).toBe(alertCase.force.requirement);
    });

    it('refuses an attempt only for physical reasons', () => {
        const sealed = makeSubject({
            kind: 'location', id: 'loc-x', name: 'the sealed vault',
            requirements: makeRequirements({ attempt: 0 }),
            sealed: true, keyId: 'key-jade'
        });
        expect(assessCapability(actor({ realmOrdinal: 40 }), sealed).attempt.holds).toBe(false);
        expect(assessCapability(actor({ realmOrdinal: 2, keyIds: ['key-jade'] }), sealed).attempt.holds).toBe(true);

        const absent = assessCapability(actor({ realmOrdinal: 40, present: false }), sealed);
        expect(absent.attempt.blockers.some(b => b.includes('not there'))).toBe(true);
    });
});

describe('capability: the predicates come apart', () => {
    const ruin = makeLocation({
        id: 'loc-ruin',
        name: 'the sealed compound at Coldfall',
        kind: 'ruin',
        thresholds: makeThresholds(13, 21, 25, 30),
        hazards: ['formation', 'sealed_qi'],
        data: { comprehensionOrdinal: 33 }
    });

    it('answers attempt, survive and understand separately for the same place', () => {
        const foundation = actor({ realmOrdinal: 13 });      // Foundation Establishment Early
        const a = assessCapability(foundation, subjectFromLocation(ruin));

        expect(a.attempt.holds).toBe(true);     // can go in
        expect(a.survive.holds).toBe(false);    // will not come out
        expect(a.understand.holds).toBe(false); // could not read it either way
        expect(a.understand.requirement).toBeGreaterThan(a.succeed.requirement);
    });

    it('lets knowledge make something legible that power cannot', () => {
        const inscription = makeSubject({
            kind: 'inscription', id: 'ins-1', name: 'the door script',
            requirements: requirementsFromInscription(33),
            comprehensionKeys: ['knowledge:ninefold-script']
        });
        const strong = assessCapability(actor({ realmOrdinal: 28 }), inscription);
        const scholar = assessCapability(
            actor({ realmOrdinal: 6, knowledgeIds: ['knowledge:ninefold-script'] }),
            inscription
        );

        expect(strong.understand.holds).toBe(false);
        expect(scholar.understand.holds).toBe(true);
        expect(scholar.understand.applied.some(m => m.modifierId.startsWith('knowledge:'))).toBe(true);
    });

    it('moves one predicate without moving the others', () => {
        const wardingRobe = makeCapabilityModifier({
            id: 'mod-robe', source: 'artifact', sourceId: 'item-robe',
            label: 'qi-warding robe', offsets: { survive: 10 }
        });
        const base = assessCapability(actor({ realmOrdinal: 13 }), subjectFromLocation(ruin));
        const robed = assessCapability(
            actor({ realmOrdinal: 13, modifiers: [wardingRobe] }),
            subjectFromLocation(ruin)
        );
        expect(robed.survive.requirement).toBeLessThan(base.survive.requirement);
        expect(robed.succeed.requirement).toBe(base.succeed.requirement);
        expect(robed.understand.requirement).toBe(base.understand.requirement);
    });

    it('shows its work and states a reason naming the unhandled hazard', () => {
        const domain = makeLocation({
            id: 'loc-soul', name: 'the soul-suppressing hall', kind: 'sealed_domain',
            thresholds: makeThresholds(0, 25, 29, 33),
            hazards: ['soul_pressure']
        });
        const a = assessCapability(actor({ realmOrdinal: 14 }), subjectFromLocation(domain));
        expect(a.survive.holds).toBe(false);
        expect(a.survive.likelihood).toBe('impossible');
        expect(a.survive.unhandledHazards).toContain('soul_pressure');
        expect(a.survive.reason).toContain('soul_pressure');
        expect(a.summary).toContain('Survival:');
    });
});

describe('capability: realm classes are potential, not entitlement', () => {
    it('maps ordinals onto classes and accumulates grants upward', () => {
        expect(realmClassForOrdinal(12)).toBe('mortal');
        expect(realmClassForOrdinal(17)).toBe('core');
        expect(realmClassForOrdinal(21)).toBe('nascent_soul');
        expect(realmClassForOrdinal(29)).toBe('void');
        expect(realmClassForOrdinal(44)).toBe('tribulation');

        expect(grantsAvailableAt(29)).toContain('no_ambient_needed');
        expect(grantsAvailableAt(29)).toContain('soul_persists');   // inherited from below
        expect(grantsAvailableAt(21)).not.toContain('no_ambient_needed');
    });

    it('does not hand a cultivator their realm class for free', () => {
        const unprepared = actor({ realmOrdinal: 22 });
        const prepared = actor({ realmOrdinal: 22, heldGrants: ['prepared_vessel'] });

        expect(heldGrants(unprepared)).toHaveLength(0);
        expect(grantStatus(unprepared, 'prepared_vessel')).toBe('available_not_held');
        expect(grantStatus(prepared, 'prepared_vessel')).toBe('held');
        expect(grantStatus(actor({ realmOrdinal: 14 }), 'prepared_vessel')).toBe('out_of_reach');
    });

    it('drops a claimed grant the realm does not support', () => {
        const overreaching = actor({ realmOrdinal: 14, heldGrants: ['no_ambient_needed'] });
        expect(heldGrants(overreaching)).toHaveLength(0);
    });

    it('gives two same-realm cultivators different answers at the same door', () => {
        const bodyKiller = makeLocation({
            id: 'loc-crush', name: 'the pressure vault', kind: 'sealed_domain',
            thresholds: makeThresholds(17, 29, 30, 33),
            hazards: ['pressure']
        });
        const subject = subjectFromLocation(bodyKiller);

        const unprepared = assessCapability(actor({ realmOrdinal: 22 }), subject);
        const prepared = assessCapability(
            actor({ realmOrdinal: 22, heldGrants: ['soul_persists', 'prepared_vessel'] }),
            subject
        );

        expect(unprepared.attempt.holds).toBe(true);
        expect(prepared.attempt.holds).toBe(true);
        expect(unprepared.survive.requirement).toBeGreaterThan(prepared.survive.requirement);
        expect(unprepared.survive.holds).toBe(false);
    });

    it('decouples Void Refinement from the scarcity the world runs on', () => {
        const scar = makeLocation({
            id: 'loc-scar', name: 'the scar at Scarwater', kind: 'scar',
            thresholds: makeThresholds(0, 29, 33, 44),
            hazards: ['thin_qi', 'dead_zone']
        });
        const subject = subjectFromLocation(scar);

        const deity = assessCapability(actor({ realmOrdinal: 27, heldGrants: ['carries_own_ambient'] }), subject);
        const voidRefiner = assessCapability(
            actor({ realmOrdinal: 29, heldGrants: ['no_ambient_needed', 'enters_dead_zones'] }),
            subject
        );

        // Carrying your own conditions helps with thin ground; it does not make
        // a dead zone survivable.
        expect(deity.survive.unhandledHazards).toContain('dead_zone');
        expect(voidRefiner.survive.unhandledHazards).toHaveLength(0);
        expect(voidRefiner.survive.requirement).toBeLessThan(deity.survive.requirement);
        expect(voidRefiner.survive.holds).toBe(true);
        expect(voidRefiner.survive.neutralised.map(n => n.hazard)).toContain('dead_zone');
    });

    it('stops gating Grand Ascension by places at all', () => {
        const forbidden = makeLocation({
            id: 'loc-forbidden', name: 'the Sourbank marsh', kind: 'forbidden_zone',
            thresholds: makeThresholds(21, 29, 33, 40),
            hazards: ['corrosive']
        });
        const a = assessCapability(
            actor({ realmOrdinal: 37, heldGrants: ['gates_places'] }),
            subjectFromLocation(forbidden)
        );
        expect(a.attempt.requirement).toBe(0);
        expect(a.survive.requirement).toBe(0);
        expect(can(a, 'force')).toBe(true);
    });

    it('reports which hazards a cultivator has an answer to', () => {
        const bodyIntegration = actor({ realmOrdinal: 33, heldGrants: ['immune_contamination'] });
        const matched = neutralisedHazards(bodyIntegration, ['corrosive', 'formation']);
        expect(matched).toEqual([{ hazard: 'corrosive', grant: 'immune_contamination' }]);
    });
});

describe('capability: environment and specialists', () => {
    const cold = makeLocation({
        id: 'loc-cold', name: 'the Cold Kiln undervault', kind: 'sealed_domain',
        thresholds: makeThresholds(10, 21, 25, 29),
        hazards: ['cold'],
        affinities: [makeAffinity('ice', 1.5, 8, 'The cold answers to somebody who works in it.')]
    });

    it('lets a lower-realm specialist survive where a stronger generalist cannot', () => {
        const specialist = assessCapability(
            actor({
                realmOrdinal: 13,
                profile: { specialties: ['ice'] },
                modifiers: [makeCapabilityModifier({
                    id: 'mod-ice', source: 'technique', sourceId: 'tech-borrowed-breath',
                    label: 'Borrowed Breath', hazards: ['cold'], offsets: { survive: 6 }
                })]
            }),
            subjectFromLocation(cold)
        );
        const generalist = assessCapability(actor({ realmOrdinal: 19 }), subjectFromLocation(cold));

        expect(specialist.survive.holds).toBe(true);
        expect(generalist.survive.holds).toBe(false);
        expect(specialist.environmentMultiplier).toBeGreaterThan(1);
    });

    it('requirements derived from a location match its thresholds', () => {
        const r = requirementsFromLocation(cold);
        expect(r.attempt).toBe(cold.thresholds.entry);
        expect(r.survive).toBe(cold.thresholds.survival);
        expect(r.succeed).toBe(cold.thresholds.operational);
        expect(r.force).toBe(cold.thresholds.mastery);
        // Comprehension defaults to the acting bar when content does not raise it.
        expect(r.understand).toBe(cold.thresholds.operational);
    });

    it('requirements against an opponent never gate the attempt', () => {
        for (const ordinal of [0, 10, 20, 30, 44]) {
            expect(requirementsFromOpposition({ id: 'x', name: 'x', realmOrdinal: ordinal }).attempt).toBe(0);
        }
    });
});
