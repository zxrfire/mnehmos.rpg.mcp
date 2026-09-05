/**
 * The obligation ledger.
 *
 * These are memory tests, not behaviour tests. Nothing here asserts what an
 * NPC does about a grudge - that is the narrator's call. What is asserted is
 * that the record is still exactly there, decades and generations later, with
 * its severity, its date, its triggering event and its provenance intact.
 */

import {
    ObligationLedger,
    createBloodFeud,
    createGrudge,
    createFavor,
    createOath,
    inheritLedgerOnDeath,
    inheritOnDeath,
    settleObligation,
    severityRank
} from '../../../src/engine/social/grudges.js';
import { daysForYears } from '../../../src/engine/social/common.js';

function theKilling() {
    return createGrudge({
        holderId: 'yun_qi',
        subjectId: 'lord_hai',
        cause: 'killed_kin',
        severity: 'unforgivable',
        onDay: daysForYears(20),
        description: 'Killed his younger sister over a spirit vein claim at the Jade Gorge.',
        triggeringEventId: 'fact_low_fall',
        participants: ['mei', 'elder_shan'],
        tags: ['public']
    });
}

describe('records', () => {
    it('stores the event, the date, the severity and everyone involved', () => {
        const record = theKilling();
        expect(record.kind).toBe('grudge');
        expect(record.cause).toBe('killed_kin');
        expect(record.severity).toBe('unforgivable');
        expect(record.triggeringEventId).toBe('fact_low_fall');
        expect(record.participants).toEqual(['mei', 'elder_shan']);
        expect(record.status).toBe('open');
        expect(record.generation).toBe(0);
        expect(record.originHolderId).toBe('yun_qi');
    });

    it('keeps debts, favours and oaths in the same ledger, distinguished by kind', () => {
        const ledger = new ObligationLedger();
        ledger.put(theKilling());
        ledger.put(
            createFavor({
                holderId: 'yun_qi',
                subjectId: 'bo_lan',
                cause: 'saved_life',
                severity: 'grave',
                onDay: daysForYears(21),
                description: 'Carried him out of the collapsed ruin at Clear River Ford.'
            })
        );
        ledger.put(
            createOath({
                holderId: 'yun_qi',
                subjectId: 'azure_cloud_sect',
                cause: 'sect_vow',
                severity: 'serious',
                onDay: daysForYears(18),
                description: 'Sworn on admission.',
                terms: 'Twenty years of service, or the equivalent in contribution.',
                dueOnDay: daysForYears(38)
            })
        );

        expect(ledger.heldBy('yun_qi')).toHaveLength(3);
        expect(ledger.heldBy('yun_qi', { kind: 'oath' })).toHaveLength(1);
        expect(ledger.heldBy('yun_qi', { dueByDay: daysForYears(40) })).toHaveLength(1);
        expect(ledger.heldBy('yun_qi', { dueByDay: daysForYears(30) })).toHaveLength(0);
    });

    it('orders severities for filtering without ever weighting them', () => {
        expect(severityRank('slight')).toBeLessThan(severityRank('unforgivable'));
        const ledger = new ObligationLedger();
        ledger.put(theKilling());
        ledger.put(
            createGrudge({
                holderId: 'yun_qi',
                subjectId: 'a_merchant',
                cause: 'robbery',
                severity: 'slight',
                onDay: daysForYears(22),
                description: 'Short-changed him on a bundle of third-grade herbs.'
            })
        );
        expect(ledger.heldBy('yun_qi', { minSeverity: 'grave' })).toHaveLength(1);
        expect(ledger.heldBy('yun_qi')).toHaveLength(2);
    });
});

describe('nothing expires', () => {
    it('is byte-identical after forty years', () => {
        const ledger = new ObligationLedger();
        const original = theKilling();
        ledger.put(original);

        const later = daysForYears(60);
        const found = ledger.heldBy('yun_qi', { asOfDay: later });

        expect(found).toHaveLength(1);
        // No decay term touched it. Same severity, same date, same words.
        expect(found[0]).toEqual(original);
        expect(found[0].severity).toBe('unforgivable');
        expect(found[0].incurredOnDay).toBe(daysForYears(20));
    });

    it('leaves the open ledger only through an explicit settlement', () => {
        const ledger = new ObligationLedger();
        const record = theKilling();
        ledger.put(record);
        expect(ledger.heldBy('yun_qi')).toHaveLength(1);

        ledger.put(
            settleObligation(record, {
                resolution: 'avenged',
                onDay: daysForYears(64),
                note: 'Forty-four years later, on a road outside Burnt Earth.'
            })
        );

        expect(ledger.heldBy('yun_qi')).toHaveLength(0);
        const settled = ledger.heldBy('yun_qi', { includeSettled: true });
        expect(settled[0].status).toBe('settled');
        expect(settled[0].settlement!.resolution).toBe('avenged');
        expect(settled[0].settlement!.onDay).toBe(daysForYears(64));
    });
});

describe('inheritance', () => {
    it('passes the holder side to descendants, faithfully and without discount', () => {
        const original = theKilling();
        const heirs = inheritOnDeath(
            original,
            'yun_qi',
            [
                { id: 'yun_shi', relation: 'descendant' },
                { id: 'ke_ran', relation: 'disciple' }
            ],
            daysForYears(90)
        );

        expect(heirs).toHaveLength(2);
        for (const heir of heirs) {
            expect(heir.subjectId).toBe('lord_hai');
            // Faithful copy: the severity is not discounted by generation.
            expect(heir.severity).toBe('unforgivable');
            expect(heir.cause).toBe('killed_kin');
            expect(heir.description).toBe(original.description);
            expect(heir.triggeringEventId).toBe('fact_low_fall');
            // The wrong happened when it happened.
            expect(heir.incurredOnDay).toBe(original.incurredOnDay);
            expect(heir.generation).toBe(1);
            expect(heir.originHolderId).toBe('yun_qi');
            expect(heir.inheritance[0].deceasedId).toBe('yun_qi');
        }
        expect(heirs.map(h => h.holderId).sort()).toEqual(['ke_ran', 'yun_shi']);
    });

    it('passes the subject side too, which is how a quarrel becomes a clan feud', () => {
        const original = theKilling();
        const transferred = inheritOnDeath(
            original,
            'lord_hai',
            [{ id: 'hai_zhen', relation: 'descendant' }],
            daysForYears(70)
        );

        expect(transferred).toHaveLength(1);
        // "He is beyond me. His grandson is not."
        expect(transferred[0].holderId).toBe('yun_qi');
        expect(transferred[0].subjectId).toBe('hai_zhen');
    });

    it('never lets anyone inherit a record against themselves', () => {
        const original = theKilling();
        const both = inheritOnDeath(
            original,
            'yun_qi',
            [{ id: 'lord_hai', relation: 'disciple' }],
            daysForYears(90)
        );
        expect(both).toHaveLength(0);
    });

    it('does not hand on a record that was already settled', () => {
        const settled = settleObligation(theKilling(), {
            resolution: 'forgiven',
            onDay: daysForYears(30),
            note: 'She would not have wanted it.'
        });
        expect(inheritOnDeath(settled, 'yun_qi', [{ id: 'yun_shi', relation: 'descendant' }], 40000))
            .toHaveLength(0);
    });

    it('is still queryable and traceable three generations on', () => {
        const ledger = new ObligationLedger();
        const feud = createBloodFeud({
            holderId: 'gen0',
            subjectId: 'hai_line',
            cause: 'destroyed_sect',
            severity: 'unforgivable',
            onDay: daysForYears(10),
            description: 'The Hai burned the mountain and salted the vein.',
            triggeringEventId: 'fact_the_burning'
        });
        ledger.put(feud);

        let current = feud;
        for (let generation = 1; generation <= 3; generation++) {
            const passed = inheritLedgerOnDeath(
                [current],
                current.holderId,
                [{ id: `gen${generation}`, relation: 'descendant' }],
                daysForYears(10 + generation * 60)
            );
            ledger.putAll(passed);
            current = passed[0];
        }

        const greatGrandchild = ledger.heldBy('gen3');
        expect(greatGrandchild).toHaveLength(1);
        expect(greatGrandchild[0].generation).toBe(3);
        // Two hundred years on, the record still names the original event, the
        // original date, and whose feud it was to begin with.
        expect(greatGrandchild[0].originHolderId).toBe('gen0');
        expect(greatGrandchild[0].triggeringEventId).toBe('fact_the_burning');
        expect(greatGrandchild[0].incurredOnDay).toBe(daysForYears(10));
        expect(greatGrandchild[0].severity).toBe('unforgivable');

        const lineage = ledger.lineage(greatGrandchild[0].id);
        expect(lineage).toHaveLength(4);
        expect(lineage[lineage.length - 1].id).toBe(feud.id);

        // Findable from the target's side too, without knowing the holder.
        expect(ledger.against('hai_line', { minGeneration: 1 })).toHaveLength(3);
    });
});

describe('ledger queries', () => {
    it('finds a record from any bystander it names, not only the principals', () => {
        const ledger = new ObligationLedger();
        ledger.put(theKilling());
        expect(ledger.involving('elder_shan')).toHaveLength(1);
        expect(ledger.involving('mei')).toHaveLength(1);
        expect(ledger.involving('a_stranger')).toHaveLength(0);
    });

    it('groups everything that came out of one event', () => {
        const ledger = new ObligationLedger();
        ledger.put(theKilling());
        ledger.put(
            createGrudge({
                holderId: 'elder_shan',
                subjectId: 'lord_hai',
                cause: 'killed_sectmate',
                severity: 'grave',
                onDay: daysForYears(20),
                description: 'The girl was ours.',
                triggeringEventId: 'fact_low_fall'
            })
        );
        expect(ledger.fromEvent('fact_low_fall')).toHaveLength(2);
    });

    it('flags a record founded on a belief without discounting it', () => {
        const suspected = createGrudge({
            holderId: 'yun_qi',
            subjectId: 'bo_lan',
            cause: 'betrayal',
            severity: 'grave',
            onDay: daysForYears(25),
            description: 'Believes Bo Lan sold his position to the Hai.',
            fromBelief: true
        });
        expect(suspected.fromBelief).toBe(true);
        // Same severity as any other. A feud founded on a lie kills people
        // exactly as thoroughly - the flag exists so it can be settled as
        // proven_false, not so the engine can quietly discount it.
        expect(suspected.severity).toBe('grave');

        const cleared = settleObligation(suspected, {
            resolution: 'proven_false',
            onDay: daysForYears(41),
            note: 'The ledger at Lantern Hall named someone else.'
        });
        expect(cleared.status).toBe('settled');
    });
});

describe('determinism', () => {
    it('mints the same ids for the same inputs, so records round-trip', () => {
        expect(theKilling().id).toBe(theKilling().id);
        const a = inheritOnDeath(theKilling(), 'yun_qi', [{ id: 'yun_shi', relation: 'descendant' }], 900);
        const b = inheritOnDeath(theKilling(), 'yun_qi', [{ id: 'yun_shi', relation: 'descendant' }], 900);
        expect(a).toEqual(b);
    });
});
