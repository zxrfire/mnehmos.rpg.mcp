import { describe, it, expect } from 'vitest';
import {
    CONSEQUENCE_TEST_QUESTIONS,
    appendFact,
    causalChain,
    chronicle,
    classifyForObserver,
    concurrentEventsFor,
    createLedger,
    dayOfYear,
    degradeFidelity,
    explainFact,
    makeFact,
    missingConsequences,
    nearMisses,
    openEra,
    queryFacts,
    recordMajorEvent,
    recordNearMiss,
    recordUnresolved,
    resolveFact,
    seedPriorAges,
    unexplainedFacts,
    unresolvedFacts,
    witnessedEventsFor,
    type HistoryLedger,
    type Observer
} from '../../../src/engine/world/history.js';

function ledgerWithEra(): HistoryLedger {
    const ledger = createLedger();
    openEra(ledger, { id: 'era-now', name: 'the present age', startDay: 0, qiDensity: 0.3, note: '' });
    return ledger;
}

describe('history: storage and retrieval', () => {
    it('assigns sequential ids and derives the year from the day', () => {
        const ledger = ledgerWithEra();
        const a = appendFact(ledger, makeFact({ day: dayOfYear(10), kind: 'death', summary: 'A died.' }));
        const b = appendFact(ledger, makeFact({ day: dayOfYear(11), kind: 'birth', summary: 'B born.' }));
        expect(a.id).toBe('f1');
        expect(b.id).toBe('f2');
        expect(a.year).toBe(10);
        expect(a.eraId).toBe('era-now');
    });

    it('queries by day window, kind, actor, location and text', () => {
        const ledger = ledgerWithEra();
        appendFact(ledger, makeFact({
            day: 100, kind: 'betrayal', summary: 'Yun Cishan opened the gate.',
            actors: [{ id: 'npc-1', name: 'Yun Cishan', role: 'betrayer' }],
            locationId: 'loc-a'
        }));
        appendFact(ledger, makeFact({ day: 900, kind: 'war', summary: 'A war over the Saltbell vein.', locationId: 'loc-b' }));

        expect(queryFacts(ledger, { fromDay: 0, toDay: 500 })).toHaveLength(1);
        expect(queryFacts(ledger, { kinds: ['war'] })).toHaveLength(1);
        expect(queryFacts(ledger, { actorId: 'npc-1' })).toHaveLength(1);
        expect(queryFacts(ledger, { locationId: 'loc-b' })).toHaveLength(1);
        expect(queryFacts(ledger, { text: 'saltbell' })).toHaveLength(1);
        expect(queryFacts(ledger, { text: 'nothing here' })).toHaveLength(0);
    });

    it('walks a causal chain back to its roots', () => {
        const ledger = ledgerWithEra();
        const vein = appendFact(ledger, makeFact({ day: 100, kind: 'resource_contested', summary: 'A vein was contested.' }));
        const killing = appendFact(ledger, makeFact({
            day: 200, kind: 'grudge_opened', summary: 'A killing over the vein.', causes: [vein.id]
        }));
        const revenge = appendFact(ledger, makeFact({
            day: 900, kind: 'grudge_settled', summary: 'The account closed.', causes: [killing.id]
        }));

        expect(causalChain(ledger, revenge.id).map(f => f.id)).toEqual([revenge.id, killing.id, vein.id]);
    });
});

describe('history: the surviving record', () => {
    it('stores "nobody knows why" as a queryable state, and lets it be resolved later', () => {
        const ledger = ledgerWithEra();
        const mystery = appendFact(ledger, makeFact({
            day: 100, kind: 'zone_forbidden', summary: 'The forest turned.',
            causeKnown: false, fidelity: 'rumour'
        }));
        expect(unexplainedFacts(ledger).map(f => f.id)).toContain(mystery.id);

        const cause = appendFact(ledger, makeFact({ day: 99, kind: 'death', summary: 'Something large died here.' }));
        explainFact(ledger, mystery.id, [cause.id], 'partial');

        expect(unexplainedFacts(ledger).map(f => f.id)).not.toContain(mystery.id);
        expect(causalChain(ledger, mystery.id).map(f => f.id)).toContain(cause.id);
    });

    it('degrades fidelity but never improves it by accident', () => {
        const ledger = ledgerWithEra();
        const fact = appendFact(ledger, makeFact({ day: 1, kind: 'war', summary: 'A war.', fidelity: 'partial' }));
        degradeFidelity(fact, 'full');
        expect(fact.fidelity).toBe('partial');
        degradeFidelity(fact, 'lost');
        expect(fact.fidelity).toBe('lost');
    });
});

describe('history: even the engine may not know', () => {
    it('records what is known, lists what is claimed, and endorses nothing', () => {
        const ledger = ledgerWithEra();
        const fact = recordUnresolved(
            ledger,
            makeFact({
                day: dayOfYear(430),
                kind: 'faction_fallen',
                summary: 'The Ninefold Court existed, and its territory was abandoned in year 430.',
                fidelity: 'rumour'
            }),
            ['destroyed', 'ascended', 'sealed itself', 'migrated']
        );

        expect(fact.truth).toBe('unresolved');
        expect(fact.causeKnown).toBe(false);
        expect(fact.claimedOutcomes).toHaveLength(4);
        // The summary says only what is known. It does not pick one.
        expect(fact.summary).not.toContain('destroyed');
        expect(unresolvedFacts(ledger).map(f => f.id)).toEqual([fact.id]);
    });

    it('lets somebody find out, without losing what people used to say', () => {
        const ledger = ledgerWithEra();
        const fact = recordUnresolved(
            ledger,
            makeFact({ day: dayOfYear(430), kind: 'faction_fallen', summary: 'They stopped being there.' }),
            ['destroyed', 'ascended']
        );
        const evidence = appendFact(ledger, makeFact({
            day: dayOfYear(3100), kind: 'ruin_opened', summary: 'A sealed hall was opened and read.'
        }));

        const resolved = resolveFact(ledger, fact.id, 'They sealed themselves in and did not come out.', 'reconstructed', [evidence.id]);
        expect(resolved!.truth).toBe('reconstructed');
        expect(resolved!.causeKnown).toBe(true);
        expect(resolved!.claimedOutcomes).toContain('ascended');
        expect(unresolvedFacts(ledger)).toHaveLength(0);
    });

    it('separates unresolved from merely poorly recorded', () => {
        const ledger = ledgerWithEra();
        appendFact(ledger, makeFact({ day: 1, kind: 'war', summary: 'A war.', fidelity: 'lost' }));
        recordUnresolved(ledger, makeFact({ day: 2, kind: 'catastrophe', summary: 'Something happened.' }), ['a', 'b']);
        expect(queryFacts(ledger, { truth: ['objective'] })).toHaveLength(1);
        expect(queryFacts(ledger, { truth: ['unresolved'] })).toHaveLength(1);
    });
});

describe('history: things that almost happened', () => {
    it('stores a near miss as an ordinary row with a flag', () => {
        const ledger = ledgerWithEra();
        appendFact(ledger, makeFact({ day: 10, kind: 'war', summary: 'A war that was won.' }));
        const miss = recordNearMiss(
            ledger,
            makeFact({
                day: 20, kind: 'war', scale: 'continental',
                summary: 'The Cold Kiln Hall came within two provinces of holding the continent.'
            }),
            'Their patriarch died of an old wound in the fourth year, and nobody replaced him.'
        );

        expect(miss.nearMiss).toBe(true);
        expect(miss.nearMissNote).toContain('old wound');
        expect(nearMisses(ledger).map(f => f.id)).toEqual([miss.id]);
        // It is a fact like any other: it appears in a plain query too.
        expect(queryFacts(ledger, { kinds: ['war'] })).toHaveLength(2);
        expect(queryFacts(ledger, { nearMiss: false })).toHaveLength(1);
    });
});

describe('history: three kinds of world event', () => {
    const ledger = ledgerWithEra();
    const beforeBirth = appendFact(ledger, makeFact({ day: 100, kind: 'catastrophe', summary: 'A mountain went.' }));
    const elsewhere = appendFact(ledger, makeFact({ day: 5000, kind: 'war', summary: 'A war two provinces over.', magnitude: 0.8 }));
    const present = appendFact(ledger, makeFact({
        day: 5200, kind: 'catastrophe', summary: 'The sky changed colour.', witnessIds: ['pc']
    }));
    const afterDeath = appendFact(ledger, makeFact({ day: 99999, kind: 'ascension', summary: 'Someone got out.' }));

    const observer: Observer = { id: 'pc', bornOnDay: 4000, diedOnDay: 9000 };

    it('classifies relative to the observer, not on the event', () => {
        expect(classifyForObserver(beforeBirth, observer)).toBe('historical');
        expect(classifyForObserver(elsewhere, observer)).toBe('concurrent');
        expect(classifyForObserver(present, observer)).toBe('witnessed');
        expect(classifyForObserver(afterDeath, observer)).toBe('future');
    });

    it('reports the concurrent events an observer was alive for and absent from', () => {
        const missed = concurrentEventsFor(ledger, observer, 4000, 9000);
        expect(missed.map(f => f.id)).toEqual([elsewhere.id]);
        expect(missed.map(f => f.id)).not.toContain(present.id);
    });

    it('reports what the observer was standing under', () => {
        expect(witnessedEventsFor(ledger, observer).map(f => f.id)).toEqual([present.id]);
    });

    it('filters a chronicle by relation', () => {
        expect(chronicle(ledger, { observer, relations: ['historical'] }).map(f => f.id))
            .toEqual([beforeBirth.id]);
    });
});

describe('history: the Consequence Test', () => {
    it('names every unanswered question', () => {
        expect(missingConsequences(null)).toHaveLength(CONSEQUENCE_TEST_QUESTIONS.length);
        expect(missingConsequences({ immediate: 'The wall fell.' }))
            .toHaveLength(CONSEQUENCE_TEST_QUESTIONS.length - 1);
    });

    it('stores the event either way but reports what was left blank', () => {
        const ledger = ledgerWithEra();
        const thin = recordMajorEvent(
            ledger,
            makeFact({ day: 10, kind: 'catastrophe', summary: 'A dramatic scene.' }),
            { immediate: 'Everyone was impressed.' }
        );
        expect(thin.fact.id).toBe('f1');
        expect(thin.warnings).toContain('What changed physically?');
        expect(thin.warnings).toContain('What is still true ten years later?');

        const full = recordMajorEvent(
            ledger,
            makeFact({ day: 20, kind: 'catastrophe', summary: 'The Saltbell ridge came down.' }),
            {
                immediate: 'The ridge came down across the pass.',
                physical: 'The pass is closed; a sealed structure is exposed.',
                beneficiaries: [{ id: 'fac-1', name: 'Cold Kiln Hall', role: 'claimant' }],
                losers: [{ id: 'fac-2', name: 'Salt Bell Court', role: 'dispossessed' }],
                factionReactions: [{ factionId: 'fac-1', reaction: 'Sent forty disciples to hold the site.' }],
                relationshipChanges: [{ aId: 'fac-1', bId: 'fac-2', change: 'open hostility' }],
                opportunitiesOpened: ['The exposed structure can be entered.'],
                opportunitiesClosed: ['The pass route to the northern markets.'],
                rumours: ['That a Void Refinement cultivator did it on purpose.'],
                tenYearsLater: 'A town of eight hundred serves the excavation.'
            }
        );
        expect(full.warnings).toHaveLength(0);
        expect(full.fact.consequences?.tenYearsLater).toContain('eight hundred');
    });
});

describe('history: seeding prior ages', () => {
    it('is deterministic for a seed and produces remnants backed by dated facts', () => {
        const a = seedPriorAges('seed-alpha', { presentYear: 0 });
        const b = seedPriorAges('seed-alpha', { presentYear: 0 });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(JSON.stringify(seedPriorAges('seed-beta', { presentYear: 0 }))).not.toBe(JSON.stringify(a));

        expect(a.ledger.eras.length).toBe(3);
        expect(a.ruins.length).toBeGreaterThan(0);
        expect(a.lostTechniques.length).toBeGreaterThan(0);

        const ids = new Set(a.ledger.facts.map(f => f.id));
        for (const ruin of a.ruins) expect(ids.has(ruin.originFactId)).toBe(true);
        for (const scar of a.scars) expect(ids.has(scar.originFactId)).toBe(true);
    });

    it('thins the qi monotonically toward the present', () => {
        const densities = seedPriorAges('seed-alpha', { presentYear: 0 }).ledger.eras.map(e => e.qiDensity);
        for (let i = 1; i < densities.length; i++) {
            expect(densities[i]).toBeLessThan(densities[i - 1]);
        }
    });

    it('leaves the oldest age unexplained', () => {
        const prior = seedPriorAges('seed-alpha', { presentYear: 0 });
        const oldest = prior.ledger.facts.filter(f => f.eraId === 'era-0');
        expect(oldest.length).toBeGreaterThan(0);
        expect(oldest.every(f => f.fidelity === 'lost' || f.fidelity === 'partial')).toBe(true);
        expect(unexplainedFacts(prior.ledger).length).toBeGreaterThan(0);
    });
});
