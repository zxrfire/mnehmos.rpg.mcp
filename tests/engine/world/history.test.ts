import { describe, it, expect } from 'vitest';
import {
    fillConsequences,
    appendFact,
    chronicle,
    classifyForObserver,
    concurrentEventsFor,
    createLedger,
    dayOfYear,
    explainFact,
    makeFact,
    nearMisses,
    queryFacts,
    recordUnresolved,
    resolveFact,
    seedPriorAges,
    type EventConsequences,
    type HistoricalFact,
    type HistoryLedger,
    type Observer
} from '../../../src/engine/world/history.js';
import { RUIN_NAMES, SCAR_NAMES } from '../../../src/data/cultivation/regions.js';
import { AGES, AGE_FIDELITY } from '../../../src/data/cultivation/history.js';
import { createWorld } from '../../../src/engine/world/world-state.js';

const CONSEQUENCE_TEST_QUESTIONS: readonly { key: keyof EventConsequences; question: string }[] = [
    { key: 'immediate', question: 'What changed immediately?' },
    { key: 'physical', question: 'What changed physically?' },
    { key: 'beneficiaries', question: 'Who benefited?' },
    { key: 'losers', question: 'Who lost something?' },
    { key: 'factionReactions', question: 'Which factions reacted?' },
    { key: 'relationshipChanges', question: 'Which relationships changed?' },
    { key: 'opportunitiesOpened', question: 'What new opportunities appeared?' },
    { key: 'opportunitiesClosed', question: 'What old opportunities disappeared?' },
    { key: 'rumours', question: 'What rumours spread?' },
    { key: 'tenYearsLater', question: 'What is still true ten years later?' }
] as const;

/** Everything the engine itself cannot answer. */
const unresolved = (ledger: HistoryLedger): HistoricalFact[] =>
    ledger.facts.filter(f => f.truth === 'unresolved');

/** "Nobody knows why", read the way `queryFacts` would be asked it. */
const unexplained = (ledger: HistoryLedger): HistoricalFact[] =>
    ledger.facts.filter(f => !f.causeKnown || f.fidelity === 'lost');

/** Which of the ten questions this consequence block leaves unanswered. */
function missingConsequences(c: Partial<EventConsequences> | null | undefined): string[] {
    if (!c) return CONSEQUENCE_TEST_QUESTIONS.map(q => q.question);
    const missing: string[] = [];
    for (const { key, question } of CONSEQUENCE_TEST_QUESTIONS) {
        const value = c[key];
        const empty =
            value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '') ||
            (Array.isArray(value) && value.length === 0);
        if (empty) missing.push(question);
    }
    return missing;
}

/**
 * Walk a fact's causal chain back to its roots.
 */
function causalChain(
    ledger: HistoryLedger,
    factId: string,
    maxDepth = 16
): HistoricalFact[] {
    const byId = new Map(ledger.facts.map(f => [f.id, f]));
    const out: HistoricalFact[] = [];
    const seen = new Set<string>();
    let frontier = [factId];
    for (let depth = 0; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const id of frontier) {
            if (seen.has(id)) continue;
            seen.add(id);
            const fact = byId.get(id);
            if (!fact) continue;
            out.push(fact);
            next.push(...fact.causes);
        }
        frontier = next;
    }
    return out;
}

function ledgerWithEra(): HistoryLedger {
    const ledger = createLedger();
    ledger.eras.push({ id: 'era-now', name: 'the present age', startDay: 0, endDay: null, qiDensity: 0.3, note: '' });
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
        expect(unexplained(ledger).map(f => f.id)).toContain(mystery.id);

        const cause = appendFact(ledger, makeFact({ day: 99, kind: 'death', summary: 'Something large died here.' }));
        explainFact(ledger, mystery.id, [cause.id], 'partial');

        expect(unexplained(ledger).map(f => f.id)).not.toContain(mystery.id);
        expect(causalChain(ledger, mystery.id).map(f => f.id)).toContain(cause.id);
    });

    it('is not made better by being explained worse than it already is', () => {
        const ledger = ledgerWithEra();
        const fact = appendFact(ledger, makeFact({ day: 1, kind: 'war', summary: 'A war.' }));
        explainFact(ledger, fact.id, [], 'rumour');
        expect(fact.fidelity).toBe('full');
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
        expect(unresolved(ledger).map(f => f.id)).toEqual([fact.id]);
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
        expect(unresolved(ledger)).toHaveLength(0);
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
        const miss = appendFact(ledger, {
            ...makeFact({
                day: 20, kind: 'war', scale: 'continental',
                summary: 'The Cold Kiln Hall came within two provinces of holding the continent.'
            }),
            nearMiss: true,
            nearMissNote: 'Their patriarch died of an old wound in the fourth year, and nobody replaced him.'
        });

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
        expect(ledger.facts.filter(f => classifyForObserver(f, observer) === 'witnessed').map(f => f.id))
            .toEqual([present.id]);
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
        const thinAnswers = { immediate: 'Everyone was impressed.' };
        const thin = appendFact(ledger, makeFact({
            day: 10,
            kind: 'catastrophe',
            summary: 'A dramatic scene.',
            consequences: fillConsequences(thinAnswers)
        }));
        expect(thin.id).toBe('f1');
        expect(missingConsequences(thinAnswers)).toContain('What changed physically?');
        expect(missingConsequences(thinAnswers))
            .toContain('What is still true ten years later?');

        const fullAnswers = {
            immediate: 'The ridge came down across the pass.',
            physical: 'The pass is closed; a sealed structure is exposed.',
            beneficiaries: [{ id: 'fac-1', name: 'Cold Kiln Hall', role: 'claimant' }],
            losers: [{ id: 'fac-2', name: 'Salt Bell Court', role: 'dispossessed' }],
            factionReactions: [{ factionId: 'fac-1', reaction: 'Sent forty disciples to hold the site.' }],
            relationshipChanges: [{ aId: 'fac-1', bId: 'fac-2', change: 'open hostility' }],
            opportunitiesOpened: ['The exposed structure can be entered.'],
            opportunitiesClosed: ['The pass route to the northern markets.'],
            rumours: ['That a Void Tribulation cultivator did it on purpose.'],
            tenYearsLater: 'A town of eight hundred serves the excavation.'
        };
        const full = appendFact(ledger, makeFact({
            day: 20,
            kind: 'catastrophe',
            summary: 'The Saltbell ridge came down.',
            consequences: fillConsequences(fullAnswers)
        }));
        expect(missingConsequences(fullAnswers)).toHaveLength(0);
        expect(full.consequences?.tenYearsLater).toContain('eight hundred');
    });
});

describe('history: seeding prior ages', () => {
    it('is deterministic for a seed and produces remnants backed by dated facts', () => {
        const a = seedPriorAges('seed-alpha', { presentYear: 0 });
        const b = seedPriorAges('seed-alpha', { presentYear: 0 });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(JSON.stringify(seedPriorAges('seed-beta', { presentYear: 0 }))).not.toBe(JSON.stringify(a));

        // Laid on the written ages, every one of them and nothing else.
        expect(a.ledger.eras.map(e => e.id)).toEqual(AGES.map(age => age.id));
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

    /**
     * The oldest age is remembered as the written history says it is: by rumour,
     * which is the worst fidelity the record holds. The generator used to call
     * it `lost`; the written age is the one kept.
     */
    it('leaves the oldest age unexplained', () => {
        const prior = seedPriorAges('seed-alpha', { presentYear: 0 });
        const oldest = prior.ledger.facts.filter(f => f.eraId === AGES[0].id);
        expect(oldest.length).toBeGreaterThan(0);
        expect(oldest.every(f => f.fidelity === AGE_FIDELITY[AGES[0].id])).toBe(true);
        expect(unexplained(prior.ledger).length).toBeGreaterThan(0);
    });
});

/**
 * EVERY WORLD IS LAID ON THE WRITTEN AGES.
 *
 * The design owner, reversing an earlier ruling that the written history stay
 * unwired while the schema moved: *"we need the history to be used as well to
 * keep it in sync with the schema migrations"*, and *"so always use the history
 * on a fresh template"*. Before this, `seedPriorAges` made up three ages of 900
 * years with drawn names, and `historyEras` in the catalog - the Open Gate,
 * True Weight, Hundred Schools and Beacon Ages and the Lasting Peace - was read
 * only by its own test. A schema change could break the written ages and no
 * world would notice.
 *
 * What the seed generates now happens INSIDE the written ages, and where the
 * two disagreed the written age won. Each assertion below is one of those
 * disagreements, pinned from the catalog's own row rather than restated.
 */
describe('history: the written ages are the template', () => {
    const SEEDS = ['seed-alpha', 'seed-beta', 'seed-gamma', 'seed-delta', 'seed-epsilon', 'seed-zeta'];
    const priors = SEEDS.map(seed => seedPriorAges(seed, { presentYear: 1000 }));
    const byAge = (prior: ReturnType<typeof seedPriorAges>, kind: string) =>
        new Map(AGES.map(age => [age.id, prior.ledger.facts.filter(f => f.eraId === age.id && f.kind === kind).length]));

    it('opens the world in the Lasting Peace, 1,517 years after it began, with no generated age anywhere', () => {
        for (const prior of priors) {
            const present = prior.ledger.eras.find(e => e.endDay === null)!;
            expect(present.id).toBe(AGES[AGES.length - 1].id);
            expect(present.startDay).toBe(dayOfYear(1000 - AGES[AGES.length - 1].beganYearsAgo!));
            expect(present.qiDensity).toBe(AGES[AGES.length - 1].qiDensity);
        }
    });

    it('is laid on a bare world too: skipping the generated past does not skip the ages', () => {
        const bare = createWorld({ seed: 'bare', skipPriorAges: true, presentYear: 1000 });
        expect(bare.history.eras.map(e => e.id)).toEqual(AGES.map(age => age.id));
        expect(bare.history.facts).toHaveLength(0);
    });

    it('holds as many great powers in an age as its row says, where it says', () => {
        for (const prior of priors) {
            const founded = byAge(prior, 'faction_founded');
            for (const age of AGES) {
                if (age.record?.greatPowers) expect(founded.get(age.id), age.id).toBe(age.record.greatPowers);
            }
        }
    });

    it('fights no war in an age whose row says it fought none, and scars only the ground its row says was scarred', () => {
        let wars = 0;
        let scars = 0;
        for (const prior of priors) {
            const warred = byAge(prior, 'war');
            const scarred = byAge(prior, 'tribulation_scar');
            for (const age of AGES) {
                if (!age.record?.wars) expect(warred.get(age.id), age.id).toBe(0);
                if (!age.record?.scars) expect(scarred.get(age.id), age.id).toBe(0);
                wars += warred.get(age.id)!;
                scars += scarred.get(age.id)!;
            }
        }
        // And the ages that did, did: otherwise these assert nothing.
        expect(wars).toBeGreaterThan(0);
        expect(scars).toBeGreaterThan(0);
    });

    it('puts more crossings in the Hundred Schools Age than in every other age combined', () => {
        for (const prior of priors) {
            const crossed = byAge(prior, 'ascension');
            const most = AGES.filter(age => age.record?.crossings === 'every_power');
            const rest = AGES.filter(age => age.record?.crossings !== 'every_power');
            const inMost = most.reduce((n, age) => n + crossed.get(age.id)!, 0);
            const inRest = rest.reduce((n, age) => n + crossed.get(age.id)!, 0);
            expect(inMost).toBeGreaterThan(inRest);
            for (const age of AGES) {
                if (age.record?.crossings === 'none') expect(crossed.get(age.id), age.id).toBe(0);
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ONE OF THEM IS ALREADY OPEN
//
// Ruled by the design owner after a run was measured opening with nothing to
// aim at - twelve ruins, twelve of them sealed and undiscovered:
//
//   "it should open, you should know about it, and you should not go at
//    ordinal 0. a player can hear gossip above their realm and that's okay"
//
// The long-run rate stays with the discovery pass at 4-5 openings per century.
// What is pinned here is the first day, and WHICH one - because a choice made
// on an index does not survive somebody re-rolling the world, and a choice made
// on a property does.
// ─────────────────────────────────────────────────────────────────────────
describe('a world opens with exactly one ruin already open', () => {
    const seeds = ['seed-alpha', 'seed-beta', 'seed-gamma', 'seed-delta', 'seed-epsilon'];

    it('opens one and only one, whatever the seed', () => {
        for (const seed of seeds) {
            const open = seedPriorAges(seed, { presentYear: 0 }).ruins.filter(r => r.opened);
            expect(open, seed).toHaveLength(1);
        }
    });

    /**
     * THE SHALLOWEST, and the reason is causal rather than mechanical: it is the
     * only one anybody could plausibly have got into. These are calibrated for
     * the disciples of houses that no longer exist, and a Late Age province
     * cannot field the people the deep ones were built to stop.
     */
    it('opens the shallowest one, which is the one anybody could have got into', () => {
        for (const seed of seeds) {
            const ruins = seedPriorAges(seed, { presentYear: 0 }).ruins;
            const shallowest = [...ruins].sort(
                (a, b) => a.dangerOrdinal - b.dangerOrdinal || (a.id < b.id ? -1 : 1)
            )[0];
            expect(ruins.find(r => r.opened)?.id, seed).toBe(shallowest.id);
        }
    });

    /**
     * A REFUSAL NAMES ITS AUTHOR, and so does an opening. Somebody got in, on a
     * date, and the fact is on the ledger for the news layer to carry.
     */
    it('names who got in and when, and puts it on the ledger', () => {
        const prior = seedPriorAges('seed-alpha', { presentYear: 0 });
        const open = prior.ruins.find(r => r.opened)!;
        expect(open.openedByName).toBeTruthy();
        expect(open.openedYear).not.toBeNull();

        const fact = prior.ledger.facts.find(f => f.kind === 'ruin_opened');
        expect(fact).toBeTruthy();
        expect(fact!.summary).toContain(open.openedByName!);
        expect(fact!.visibility).toBe('public');
        // It caused nothing to be forgotten: the sealing is still its cause.
        expect(fact!.causes).toContain(open.originFactId);
    });

    /**
     * Within living memory. The news layer decays a fact over four centuries,
     * so a lifetime ago costs it almost nothing and being older than the
     * province's memory would cost it everything.
     */
    it('happened recently enough that people alive now grew up with it', () => {
        for (const seed of seeds) {
            const open = seedPriorAges(seed, { presentYear: 0 }).ruins.find(r => r.opened)!;
            expect(open.openedYear!, seed).toBeLessThan(0);
            expect(open.openedYear!, seed).toBeGreaterThanOrEqual(-120);
        }
    });

    /** Same seed, same answer. The choice is a property, not a draw order. */
    it('is deterministic in the seed', () => {
        const a = seedPriorAges('seed-alpha', { presentYear: 0 }).ruins.find(r => r.opened);
        const b = seedPriorAges('seed-alpha', { presentYear: 0 }).ruins.find(r => r.opened);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});

/**
 * The authored names for the generated half of the map, and whether a world
 * can actually reach them.
 *
 * `drawPlaceName` was keyed on the site's own id and nothing else. A ruin is
 * drawn for every faction in every age, so the twelve keys are the same in
 * every world, and every world got the same twelve names in the same order -
 * leaving eight of the twenty authored ruin names unreachable anywhere, three
 * of them carrying a `LOCAL_RESIDUE` story about ground no generator would
 * ever make. Scars escaped it because a scar is drawn on a coin flip.
 */
describe('history: naming the generated half of the map', () => {
    const seeds = Array.from({ length: 24 }, (_, i) => `name-seed-${i}`);

    it('reaches every authored ruin and scar name across a pool of worlds', () => {
        const ruins = new Set<string>();
        const scars = new Set<string>();
        for (const seed of seeds) {
            const prior = seedPriorAges(seed, { presentYear: 0 });
            for (const r of prior.ruins) ruins.add(r.name);
            for (const s of prior.scars) scars.add(s.name);
        }
        for (const entry of RUIN_NAMES) {
            expect(ruins.has(entry.name), `${entry.name} is never drawn by any world`).toBe(true);
        }
        for (const entry of SCAR_NAMES) {
            expect(scars.has(entry.name), `${entry.name} is never drawn by any world`).toBe(true);
        }
    });

    it('gives one world one set of names, and two worlds different ones', () => {
        const namesOf = (seed: string): string =>
            seedPriorAges(seed, { presentYear: 0 }).ruins.map(r => r.name).join('|');
        expect(namesOf('name-seed-0')).toBe(namesOf('name-seed-0'));
        expect(namesOf('name-seed-0')).not.toBe(namesOf('name-seed-1'));
    });

    it('never repeats a name inside one world', () => {
        for (const seed of seeds) {
            const prior = seedPriorAges(seed, { presentYear: 0 });
            const all = [...prior.ruins.map(r => r.name), ...prior.scars.map(s => s.name)];
            expect(new Set(all).size, seed).toBe(all.length);
        }
    });
});
