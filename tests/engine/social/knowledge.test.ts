/**
 * The five epistemic layers, kept apart.
 *
 * The load-bearing assertions here are negative ones: that querying what
 * somebody believes never returns what is true, that a holder with no record
 * knows nothing however powerful they are, and that ground truth is intact and
 * separately queryable while a false belief is being acted on.
 */

import {
    KnowledgeLedger,
    publicHolderId,
    recordFact,
    recordKnowledge,
    recordPublicBelief,
    reviseKnowledge
} from '../../../src/engine/social/knowledge.js';
import { createGrudge } from '../../../src/engine/social/grudges.js';
import { daysForYears } from '../../../src/engine/social/common.js';

const CLAIM = 'who_killed_yun_mei';

function seed(): { ledger: KnowledgeLedger; truthId: string } {
    const ledger = new KnowledgeLedger();
    const fact = ledger.addFact(
        recordFact({
            claimKey: CLAIM,
            onDay: daysForYears(20),
            statement: 'Lord Hai killed Yun Mei at the Jade Gorge over a spirit vein claim.',
            detail: { killer: 'lord_hai', place: 'low_fall', reason: 'spirit_vein' },
            subjects: ['lord_hai', 'yun_mei', 'yun_qi'],
            concealed: true
        })
    );
    return { ledger, truthId: fact.id };
}

describe('layer 1: objective reality', () => {
    it('is stored, frozen, and queryable on its own', () => {
        const { ledger, truthId } = seed();
        const truth = ledger.truth(truthId)!;
        expect(truth.statement).toContain('Lord Hai');
        expect(truth.detail.killer).toBe('lord_hai');
        expect(Object.isFrozen(truth)).toBe(true);
        expect(ledger.truthAbout(CLAIM)).toHaveLength(1);
        expect(ledger.truthConcerning('lord_hai')).toHaveLength(1);
    });

    it('is not returned by any query for what somebody holds', () => {
        const { ledger } = seed();
        // Nobody has been told anything yet. The fact exists; no one has it.
        expect(ledger.heldBy('yun_qi')).toHaveLength(0);
        expect(ledger.claimsAbout(CLAIM)).toHaveLength(0);
        expect(ledger.isAwareOf('yun_qi', CLAIM)).toBe(false);
    });
});

describe('layers 2-4 are independently queryable', () => {
    it('separates knows, believes and suspects for the same topic', () => {
        const { ledger, truthId } = seed();

        ledger.addRecord(
            recordKnowledge({
                holderId: 'the_cart_driver',
                claimKey: CLAIM,
                stance: 'knows',
                statement: 'Lord Hai killed Yun Mei at the Jade Gorge over a spirit vein claim.',
                detail: { killer: 'lord_hai', place: 'low_fall', reason: 'spirit_vein' },
                factId: truthId,
                confidence: 1,
                onDay: daysForYears(20),
                source: { kind: 'witnessed', note: 'Was watering the mule forty paces off.' }
            })
        );
        ledger.addRecord(
            recordKnowledge({
                holderId: 'yun_qi',
                claimKey: CLAIM,
                stance: 'believes',
                statement: 'Bo Lan killed Yun Mei at the Jade Gorge.',
                detail: { killer: 'bo_lan', place: 'low_fall' },
                factId: truthId,
                confidence: 0.85,
                onDay: daysForYears(21),
                source: { kind: 'told', fromHolderId: 'a_broker' }
            })
        );
        ledger.addRecord(
            recordKnowledge({
                holderId: 'elder_shan',
                claimKey: CLAIM,
                stance: 'suspects',
                statement: 'Somebody in the Hai household was behind it.',
                factId: truthId,
                confidence: 0.3,
                onDay: daysForYears(22),
                source: { kind: 'inferred' }
            })
        );

        expect(ledger.knows('the_cart_driver')).toHaveLength(1);
        expect(ledger.believes('the_cart_driver')).toHaveLength(0);
        expect(ledger.believes('yun_qi')).toHaveLength(1);
        expect(ledger.knows('yun_qi')).toHaveLength(0);
        expect(ledger.suspects('elder_shan')).toHaveLength(1);
        expect(ledger.claimsAbout(CLAIM)).toHaveLength(3);
    });

    it('stores what the public believes as its own holder', () => {
        const { ledger, truthId } = seed();
        ledger.addRecord(
            recordPublicBelief({
                audienceId: 'sweptground',
                claimKey: CLAIM,
                stance: 'believes',
                statement: 'A beast got her on the road. There was a lot of blood.',
                factId: truthId,
                confidence: 0.6,
                onDay: daysForYears(23),
                source: { kind: 'told' }
            })
        );

        const held = ledger.publicBelief('sweptground', CLAIM);
        expect(held).toHaveLength(1);
        expect(held[0].holderKind).toBe('public');
        expect(held[0].holderId).toBe(publicHolderId('sweptground'));
        expect(held[0].statement).toContain('A beast');
        // The public's version is stored beside the personal ones, not merged.
        expect(ledger.heldBy('yun_qi')).toHaveLength(0);
    });

    it('lists every incompatible version in circulation, and who holds each', () => {
        const { ledger, truthId } = seed();
        for (const [holder, statement] of [
            ['yun_qi', 'Bo Lan killed her.'],
            ['ke_ran', 'Bo Lan killed her.'],
            ['elder_shan', 'The Hai killed her.']
        ] as const) {
            ledger.addRecord(
                recordKnowledge({
                    holderId: holder,
                    claimKey: CLAIM,
                    stance: 'believes',
                    statement,
                    factId: truthId,
                    onDay: daysForYears(24),
                    source: { kind: 'told' }
                })
            );
        }

        const versions = ledger.disagreementsAbout(CLAIM);
        expect(versions).toHaveLength(2);
        expect(versions.map(v => v.statement)).toEqual(['Bo Lan killed her.', 'The Hai killed her.']);
        expect(versions[0].holders).toEqual(['ke_ran', 'yun_qi']);
    });
});

describe('acting on wrong information', () => {
    it('lets a false belief found a real grudge while ground truth stays intact', () => {
        const { ledger, truthId } = seed();
        const belief = ledger.addRecord(
            recordKnowledge({
                holderId: 'yun_qi',
                claimKey: CLAIM,
                stance: 'believes',
                statement: 'Bo Lan killed Yun Mei at the Jade Gorge.',
                detail: { killer: 'bo_lan', place: 'low_fall' },
                factId: truthId,
                confidence: 0.9,
                onDay: daysForYears(21),
                source: { kind: 'told', fromHolderId: 'a_broker' }
            })
        );

        // The narrator reads the belief, not the fact, and writes a grudge.
        const grudge = createGrudge({
            holderId: 'yun_qi',
            subjectId: String(belief.detail.killer),
            cause: 'killed_kin',
            severity: 'unforgivable',
            onDay: daysForYears(21),
            description: 'Believes Bo Lan killed his sister at the Jade Gorge.',
            triggeringEventId: belief.id,
            fromBelief: true
        });

        expect(grudge.subjectId).toBe('bo_lan');
        expect(grudge.fromBelief).toBe(true);
        // Meanwhile the truth is untouched and still names the real killer.
        expect(ledger.truth(truthId)!.detail.killer).toBe('lord_hai');

        // And the engine - only the engine - can see the divergence.
        const accuracy = ledger.compareToReality(belief.id)!;
        expect(accuracy.statementMatches).toBe(false);
        expect(accuracy.wrongDetail).toContain('killer');
        expect(accuracy.missingDetail).toContain('reason');
    });

    it('records a claim with no fact behind it at all', () => {
        const ledger = new KnowledgeLedger();
        const lie = ledger.addRecord(
            recordKnowledge({
                holderId: 'ke_ran',
                claimKey: 'yun_qi_carries_a_heaven_grade_manual',
                stance: 'believes',
                statement: 'He is carrying a heaven-grade manual out of the Clear River Ford ruin.',
                factId: null,
                confidence: 0.8,
                onDay: daysForYears(30),
                source: { kind: 'fabricated', fromHolderId: 'a_broker', note: 'To get him followed.' }
            })
        );

        expect(lie.factId).toBeNull();
        expect(ledger.isGroundless(lie.id)).toBe(true);
        expect(ledger.compareToReality(lie.id)!.groundless).toBe(true);
    });

    it('traces a claim back to whether anyone ever actually saw it', () => {
        const { ledger, truthId } = seed();
        const seen = ledger.addRecord(
            recordKnowledge({
                holderId: 'the_cart_driver',
                claimKey: CLAIM,
                stance: 'knows',
                statement: 'Lord Hai killed Yun Mei at the Jade Gorge over a spirit vein claim.',
                factId: truthId,
                onDay: daysForYears(20),
                source: { kind: 'witnessed' }
            })
        );
        const heard = ledger.addRecord(
            recordKnowledge({
                holderId: 'a_broker',
                claimKey: CLAIM,
                stance: 'believes',
                statement: 'One of the Hai did for the Yun girl.',
                factId: truthId,
                onDay: daysForYears(20) + 40,
                source: { kind: 'told', fromHolderId: 'the_cart_driver', viaRecordId: seen.id }
            })
        );
        const thirdHand = ledger.addRecord(
            recordKnowledge({
                holderId: 'ke_ran',
                claimKey: CLAIM,
                stance: 'believes',
                statement: 'The Hai killed the Yun girl.',
                factId: truthId,
                onDay: daysForYears(21),
                source: { kind: 'told', fromHolderId: 'a_broker', viaRecordId: heard.id }
            })
        );

        const chain = ledger.provenance(thirdHand.id);
        expect(chain.map(r => r.holderId)).toEqual(['ke_ran', 'a_broker', 'the_cart_driver']);
        expect(ledger.isGroundless(thirdHand.id)).toBe(false);
    });
});

describe('power does not imply omniscience', () => {
    it('gives a holder with no record nothing, whoever they are', () => {
        const { ledger } = seed();
        // The most powerful cultivator in the province. No rows name them.
        expect(ledger.heldBy('hollow_court_elder')).toHaveLength(0);
        expect(ledger.stanceOn('hollow_court_elder', CLAIM)).toHaveLength(0);
        expect(ledger.isAwareOf('hollow_court_elder', CLAIM)).toBe(false);
    });

    it('exposes no query that takes any measure of strength', () => {
        const { ledger } = seed();
        // Every accessor is keyed by holder id and topic. There is deliberately
        // no realm, rank or power parameter anywhere on the surface, and this
        // assertion is here so that adding one breaks a test on purpose.
        const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(ledger));
        expect(surface).not.toContain('knownAtRealm');
        expect(surface.some(name => /realm|ordinal|power|rank/i.test(name))).toBe(false);
    });
});

describe('finding out you were wrong', () => {
    it('supersedes the old claim, keeps it, and logs the revision', () => {
        const { ledger, truthId } = seed();
        const wrong = ledger.addRecord(
            recordKnowledge({
                holderId: 'yun_qi',
                claimKey: CLAIM,
                stance: 'believes',
                statement: 'Bo Lan killed Yun Mei at the Jade Gorge.',
                detail: { killer: 'bo_lan' },
                factId: truthId,
                confidence: 0.9,
                onDay: daysForYears(21),
                source: { kind: 'told', fromHolderId: 'a_broker' }
            })
        );

        const result = reviseKnowledge(wrong, {
            onDay: daysForYears(61),
            cause: 'The ledger at Lantern Hall named Lord Hai.',
            to: {
                stance: 'knows',
                statement: 'Lord Hai killed Yun Mei at the Jade Gorge over a spirit vein claim.',
                detail: { killer: 'lord_hai', place: 'low_fall', reason: 'spirit_vein' },
                factId: truthId,
                confidence: 1,
                source: { kind: 'read', note: 'Lantern Hall archive.' }
            }
        });
        ledger.updateRecord(result.previous);
        ledger.addRecord(result.revised!);
        ledger.addRevision(result.revision);

        expect(result.revision.accepted).toBe(true);
        expect(ledger.believes('yun_qi')).toHaveLength(0);
        expect(ledger.knows('yun_qi')).toHaveLength(1);
        // Forty years of being wrong is kept, because it explains everything
        // he did in the meantime.
        const all = ledger.stanceOn('yun_qi', CLAIM, { includeSuperseded: true });
        expect(all).toHaveLength(2);
        expect(all[0].statement).toContain('Bo Lan');
        expect(ledger.compareToReality(result.revised!.id)!.statementMatches).toBe(true);
    });

    it('records a refusal to accept the truth as faithfully as an acceptance', () => {
        const { ledger, truthId } = seed();
        const wrong = ledger.addRecord(
            recordKnowledge({
                holderId: 'yun_qi',
                claimKey: CLAIM,
                stance: 'believes',
                statement: 'Bo Lan killed Yun Mei at the Jade Gorge.',
                factId: truthId,
                confidence: 0.95,
                onDay: daysForYears(21),
                source: { kind: 'told' }
            })
        );

        const result = reviseKnowledge(wrong, {
            onDay: daysForYears(45),
            cause: 'Bo Lan told him to his face. He did not believe him.'
        });
        ledger.updateRecord(result.previous);
        ledger.addRevision(result.revision);

        expect(result.revision.accepted).toBe(false);
        expect(result.revised).toBeNull();
        // The old belief is still live. Nothing forced him to change his mind.
        expect(ledger.believes('yun_qi')).toHaveLength(1);
        expect(ledger.revisionsFor('yun_qi', CLAIM)).toHaveLength(1);
    });
});

describe('determinism', () => {
    it('mints the same ids for the same inputs, so records round-trip', () => {
        const first = recordFact({ claimKey: CLAIM, onDay: 100, statement: 'x' });
        const second = recordFact({ claimKey: CLAIM, onDay: 100, statement: 'x' });
        expect(first.id).toBe(second.id);

        const source = { kind: 'told' } as const;
        const a = recordKnowledge({
            holderId: 'h',
            claimKey: CLAIM,
            stance: 'believes',
            statement: 'y',
            onDay: 100,
            source
        });
        const b = recordKnowledge({
            holderId: 'h',
            claimKey: CLAIM,
            stance: 'believes',
            statement: 'y',
            onDay: 100,
            source
        });
        expect(a).toEqual(b);
    });
});
