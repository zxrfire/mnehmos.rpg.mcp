import { describe, it, expect } from 'vitest';
import {
    assessCapability,
    can,
    ARRANGED_GRANTS,
    grantStatus,
    grantsConferredAt,
    grantsHeldWith,
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

    it('hands over what the rung earned, because capability is enforced', () => {
        // The defect this replaced: `capabilityActorFor` returned `heldGrants:
        // []`, so NOBODY held any of the fifteen and every consumer downstream
        // was off. A capability nobody can hold is not a capability.
        const conferred = grantsConferredAt(33);
        expect(conferred).toContain('no_seam');
        expect(conferred).toContain('carries_own_ambient');
        expect(conferred).toContain('no_ambient_needed');

        // And it really reaches the consumer, rather than merely being returned.
        const whole = actor({ realmOrdinal: 33, heldGrants: conferred });
        expect(neutralisedHazards(whole, ['soul_pressure']).map(n => n.grant))
            .toEqual(['no_seam']);
    });

    it('does not confer what somebody had to go and arrange', () => {
        // The half of the old argument that was right, kept: a realm cannot
        // hand over an actual vessel that an actual person readied somewhere.
        expect(ARRANGED_GRANTS).toContain('prepared_vessel');
        expect(grantsConferredAt(24)).not.toContain('prepared_vessel');
        expect(grantsAvailableAt(24)).toContain('prepared_vessel');
    });

    it('takes back what a structural break denies, per the realm it broke at', () => {
        // The point of a broken status, mechanically. Before this, a crippled
        // nascent soul and a whole one were the same person with different
        // prose - which is the softening the agency rule forbids.
        const cases: [string, number, string][] = [
            ['failed-transformation', 28, 'carries_own_ambient'],
            ['partial-refinement', 32, 'no_ambient_needed'],
            ['failed-integration', 36, 'no_seam'],
            ['unfulfilled-ascension', 40, 'gates_places'],
            ['crippled-nascent-soul', 24, 'soul_persists']
        ];
        for (const [breakKey, ordinal, lost] of cases) {
            expect(grantsConferredAt(ordinal), `${breakKey}: whole`).toContain(lost);
            expect(grantsHeldWith(ordinal, [breakKey]), `${breakKey}: broken`)
                .not.toContain(lost);
        }
    });

    it('takes back only what the break names, and leaves the rest of the realm', () => {
        // "a lot of it IS stitched, so they're still a lot stronger than
        // anybody before that." An impairment among the great, not a demotion.
        const held = grantsHeldWith(36, ['failed-integration']);
        expect(held).not.toContain('no_seam');
        expect(held).toContain('immune_contamination');
        expect(held).toContain('spatial_folding');

        // And a partial refinement still survives the weak scars, which is the
        // owner's own distinction: folding goes, dead ground does not.
        const partial = grantsHeldWith(32, ['partial-refinement']);
        expect(partial).not.toContain('spatial_folding');
        expect(partial).not.toContain('no_ambient_needed');
        expect(partial).toContain('enters_dead_zones');
    });

    it('denies through the consumer, not merely in the list', () => {
        // The test that would have caught the original defect: assert the
        // BEHAVIOUR changes, not that an array is shorter.
        const ordinal = 28;
        const whole = actor({ realmOrdinal: ordinal, heldGrants: grantsConferredAt(ordinal) });
        const failed = actor({
            realmOrdinal: ordinal,
            heldGrants: grantsHeldWith(ordinal, ['failed-transformation'])
        });
        expect(neutralisedHazards(whole, ['thin_qi'])).toHaveLength(1);
        expect(neutralisedHazards(failed, ['thin_qi'])).toHaveLength(0);
    });

    it('stacks two breaks rather than letting the second one be free', () => {
        const both = grantsHeldWith(40, ['failed-integration', 'unfulfilled-ascension']);
        expect(both).not.toContain('no_seam');
        expect(both).not.toContain('gates_places');
    });

    it('ignores a wound that is not a break, and an unknown key', () => {
        const whole = grantsConferredAt(36);
        expect(grantsHeldWith(36, [])).toEqual(whole);
        expect(grantsHeldWith(36, ['torn-meridians'])).toEqual(whole);
        expect(grantsHeldWith(36, ['no-such-wound'])).toEqual(whole);
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
            id: 'loc-scar', name: 'the scar at Clear River Ford', kind: 'scar',
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
