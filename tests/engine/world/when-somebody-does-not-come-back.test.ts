import { describe, it, expect } from 'vitest';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import {
    createNpc,
    markDead,
    upsertRelationship,
    type NpcRecord
} from '../../../src/engine/world/npc-state.js';
import {
    STOP_WAITING_PER_YEAR,
    WRITTEN_OFF_GRACE_YEARS,
    applyAbsence,
    beginAbsence,
    fateClaimKey,
    homecoming
} from '../../../src/engine/world/when-somebody-does-not-come-back.js';
import { KnowledgeLedger } from '../../../src/engine/social/knowledge.js';
import { stageAcross } from '../../../src/engine/social/discovery.js';

const YEAR = 365;

// ─────────────────────────────────────────────────────────────────────────
// A small, entirely explicit world.
//
// Hand-built rather than seeded, because every assertion below is about ONE
// tie and a seeded world would make each of them a statement about the
// population as well. The seeded case gets its own block at the bottom.
// ─────────────────────────────────────────────────────────────────────────

interface Bench {
    state: WorldState;
    day: number;
}

function bench(seed = 'abs-a'): Bench {
    const state = createWorld({ seed, presentYear: 1000, skipPriorAges: true, regionCount: 2 });
    return { state, day: state.currentDay };
}

function person(
    state: WorldState,
    id: string,
    opts: { locationId?: string | null; factionId?: string | null; rank?: number } = {}
): NpcRecord {
    const npc = createNpc(state.seed, {
        id,
        name: id,
        bornOnDay: state.currentDay - 20 * YEAR,
        onDay: state.currentDay,
        locationId: opts.locationId ?? 'loc-region-0',
        factionId: opts.factionId ?? null,
        factionRankIndex: opts.rank ?? -1
    });
    state.npcs.push(npc);
    return npc;
}

function tie(
    state: WorldState,
    fromId: string,
    toId: string,
    kind: Parameters<typeof upsertRelationship>[1]['kind'],
    standing: number
): void {
    const at = state.npcs.findIndex(n => n.id === fromId);
    state.npcs[at] = upsertRelationship(
        state.npcs[at],
        { targetId: toId, targetName: toId, kind, standing },
        state.currentDay
    );
}

/** The absentee, the woman who promised to wait, and the enemy who watched. */
function withCast(seed: string): Bench {
    const b = bench(seed);
    person(b.state, 'her');
    person(b.state, 'enemy');
    tie(b.state, 'her', 'him', 'spouse', 0.9);
    tie(b.state, 'enemy', 'him', 'enemy', -0.8);
    return b;
}

// ─────────────────────────────────────────────────────────────────────────
// OPENING AN ABSENCE
// ─────────────────────────────────────────────────────────────────────────

describe('beginAbsence', () => {
    it('opens a reunion goal on the person who was told, and on nobody else', () => {
        const { state, day } = withCast('abs-open');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him',
            absenteeName: 'him',
            onDay: day,
            toldIds: ['her']
        });

        const her = state.npcs.find(n => n.id === 'her')!;
        const enemy = state.npcs.find(n => n.id === 'enemy')!;
        expect(her.goals.filter(g => g.kind === 'reunion')).toHaveLength(1);
        expect(her.goals[0].targetId).toBe('him');
        expect(enemy.goals.filter(g => g.kind === 'reunion')).toHaveLength(0);

        expect(absence.ties.map(t => t.holderId)).toEqual(['enemy', 'her']);
        expect(absence.ties.find(t => t.holderId === 'her')!.waiting).toBe(true);
        expect(absence.ties.find(t => t.holderId === 'enemy')!.waiting).toBe(false);
    });

    it('nobody waits for somebody who told nobody where they were going', () => {
        const { state, day } = withCast('abs-silent');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him',
            absenteeName: 'him',
            onDay: day
        });
        expect(absence.ties.every(t => !t.waiting)).toBe(true);
        expect(state.npcs.flatMap(n => n.goals)).toHaveLength(0);
    });

    it('a witness reaches the top of the knowing ladder and a told party does not', () => {
        const { state, day } = withCast('abs-ladder');
        const { accounts, truth } = beginAbsence(state, {
            absenteeId: 'him',
            absenteeName: 'him',
            onDay: day,
            witnessIds: ['enemy'],
            toldIds: ['her']
        });

        const ledger = new KnowledgeLedger();
        for (const record of accounts) ledger.addRecord(record);

        expect(stageAcross(ledger.heldBy('enemy'))).toBe('encountered');
        expect(stageAcross(ledger.heldBy('her'))).toBe('placed');
        expect(ledger.knows('enemy')).toHaveLength(1);
        // The truth is a fact, held by nobody, and both accounts point at it.
        expect(truth.subjects).toEqual(['him']);
        expect(accounts.every(a => a.factId === truth.id)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE YEARLY PASS
// ─────────────────────────────────────────────────────────────────────────

describe('applyAbsence', () => {
    it('costs a two-year absence nothing and a hundred-year one everything', () => {
        const stopped = (years: number): number => {
            let count = 0;
            for (let s = 0; s < 60; s++) {
                const { state, day } = withCast(`abs-dur-${s}`);
                const { absence } = beginAbsence(state, {
                    absenteeId: 'him', absenteeName: 'him', onDay: day, toldIds: ['her']
                });
                const pass = applyAbsence(state, absence, day + years * YEAR);
                if (pass.consequences.some(c => c.kind === 'stopped_waiting')) count++;
            }
            return count;
        };

        const two = stopped(2);
        const ten = stopped(10);
        const forty = stopped(40);
        const hundred = stopped(100);

        expect(two).toBeLessThan(ten);
        expect(ten).toBeLessThan(forty);
        expect(forty).toBeLessThanOrEqual(hundred);
        // A ten-year seclusion has to stay playable and a forty-year one has to
        // hurt. These are the two numbers the design turns on.
        expect(ten / 60).toBeLessThan(0.35);
        expect(forty / 60).toBeGreaterThan(0.4);
    });

    it('is idempotent and decomposable across a split span', () => {
        const shape = (splits: readonly number[]): string => {
            const { state, day } = withCast('abs-split');
            const { absence } = beginAbsence(state, {
                absenteeId: 'him', absenteeName: 'him', onDay: day, toldIds: ['her']
            });
            for (const at of splits) applyAbsence(state, absence, day + at * YEAR);
            // Running the last one twice must change nothing at all.
            applyAbsence(state, absence, day + splits[splits.length - 1] * YEAR);
            return JSON.stringify({
                ties: absence.ties,
                writtenOff: absence.writtenOffOnDay,
                npcs: state.npcs,
                facts: state.history.facts.map(f => f.summary)
            });
        };
        expect(shape([10, 30, 60])).toBe(shape([60]));
        expect(shape([1, 2, 3, 60])).toBe(shape([60]));
    });

    it('a person who stops waiting closes the goal, rewrites the tie, and files a belief', () => {
        // Long enough that the roll has effectively certainly come up.
        const { state, day } = withCast('abs-stop');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him', absenteeName: 'him', onDay: day, toldIds: ['her']
        });
        const pass = applyAbsence(state, absence, day + 200 * YEAR);

        const stop = pass.consequences.find(c => c.kind === 'stopped_waiting')!;
        expect(stop).toBeDefined();
        expect(stop.afterYears).toBeGreaterThan(0);

        const her = state.npcs.find(n => n.id === 'her')!;
        const goal = her.goals.find(g => g.kind === 'reunion')!;
        expect(goal.status).toBe('abandoned');
        expect(goal.note).toContain('Waited');

        // The tie is not deleted and it is not hostile. It is what it became.
        const rel = her.relationships.find(r => r.targetId === 'him')!;
        expect(rel.kind).toBe('acquaintance');
        expect(rel.standing).toBeLessThan(0.9);
        expect(rel.standing).toBeGreaterThan(0);
        expect(rel.sinceDay).toBe(day);
        expect(rel.factIds).toContain(stop.factId);

        // And an account of it exists, dated, inferred, with no fact behind it.
        const belief = pass.accounts.find(a => a.id === stop.accountIds[0])!;
        expect(belief.holderId).toBe('her');
        expect(belief.source.kind).toBe('inferred');
        expect(belief.factId).toBeNull();
        expect(belief.acquiredOnDay).toBe(stop.onDay);
    });

    it('somebody who dies first dies waiting, and the goal closes as impossible', () => {
        const { state, day } = withCast('abs-diedwaiting');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him', absenteeName: 'him', onDay: day, toldIds: ['her']
        });
        const at = state.npcs.findIndex(n => n.id === 'her');
        state.npcs[at] = markDead(state.npcs[at], day + 3 * YEAR, 'Fever.');

        const pass = applyAbsence(state, absence, day + 40 * YEAR);
        const died = pass.consequences.find(c => c.kind === 'died_waiting')!;
        expect(died).toBeDefined();
        expect(died.subjectId).toBe('her');

        const her = state.npcs.find(n => n.id === 'her')!;
        expect(her.goals.find(g => g.kind === 'reunion')!.status).toBe('impossible');

        // And it is settled once. A dead woman does not also stop waiting.
        const again = applyAbsence(state, absence, day + 80 * YEAR);
        expect(again.consequences.filter(c => c.subjectId === 'her')).toHaveLength(0);
    });

    it('nobody is written off inside the grace period', () => {
        for (let s = 0; s < 40; s++) {
            const { state, day } = withCast(`abs-grace-${s}`);
            const { absence } = beginAbsence(state, {
                absenteeId: 'him', absenteeName: 'him', onDay: day
            });
            applyAbsence(state, absence, day + WRITTEN_OFF_GRACE_YEARS * YEAR);
            expect(absence.writtenOffOnDay).toBeNull();
        }
    });

    it('being written off produces an unresolved fact, a public belief and a register entry', () => {
        const { state, day } = withCast('abs-writeoff');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him', absenteeName: 'him', onDay: day, locationId: 'loc-region-0'
        });
        const pass = applyAbsence(state, absence, day + 300 * YEAR);

        const off = pass.consequences.find(c => c.kind === 'written_off')!;
        expect(off).toBeDefined();
        expect(absence.writtenOffOnDay).not.toBeNull();

        const fact = state.history.facts.find(f => f.id === off.factId)!;
        // The engine knows he is alive and declines to say he is dead.
        expect(fact.truth).toBe('unresolved');
        expect(fact.claimedOutcomes.length).toBeGreaterThan(1);
        expect(fact.causeKnown).toBe(false);

        const ledger = new KnowledgeLedger();
        for (const record of pass.accounts) ledger.addRecord(record);
        const versions = ledger.disagreementsAbout(fateClaimKey('him'));
        const holders = versions.flatMap(v => v.holders);
        expect(holders).toContain('public:loc-region-0');
        expect(holders).toContain('public:register:loc-region-0');
        // The register carries its own date and its own source.
        const register = pass.accounts.find(a => a.holderId === 'public:register:loc-region-0')!;
        expect(register.source.kind).toBe('read');
        expect(register.statement).toMatch(/deceased, entered in year \d+/);

        // And it only ever happens once.
        const again = applyAbsence(state, absence, day + 600 * YEAR);
        expect(again.consequences.filter(c => c.kind === 'written_off')).toHaveLength(0);
    });

    it('a house stops counting a member it has written off', () => {
        const { state, day } = bench('abs-rolls');
        person(state, 'him', { factionId: 'fac-a', rank: 2 });
        person(state, 'her');
        tie(state, 'her', 'him', 'spouse', 0.9);

        const { absence } = beginAbsence(state, {
            absenteeId: 'him', absenteeName: 'him', onDay: day, factionId: 'fac-a', factionRankIndex: 2
        });
        const pass = applyAbsence(state, absence, day + 300 * YEAR);

        expect(pass.consequences.some(c => c.kind === 'struck_from_the_rolls')).toBe(true);
        const him = state.npcs.find(n => n.id === 'him')!;
        expect(him.factionId).toBeNull();
        expect(him.factionRankIndex).toBe(-1);
    });

    it('telling somebody buys time that merely being seen leaving does not', () => {
        // An ORDINARY tie, below `DEFINING_STANDING`, so the only thing
        // separating the two runs is whether she was told or only watched him
        // go. A defining tie is already patient and the two do not stack.
        const stopped = (told: boolean): number => {
            let count = 0;
            for (let s = 0; s < 80; s++) {
                const b = bench(`abs-told-${s}`);
                person(b.state, 'her');
                tie(b.state, 'her', 'him', 'ally', 0.6);
                const { absence } = beginAbsence(b.state, {
                    absenteeId: 'him',
                    absenteeName: 'him',
                    onDay: b.day,
                    witnessIds: told ? [] : ['her'],
                    toldIds: told ? ['her'] : []
                });
                const pass = applyAbsence(b.state, absence, b.day + 25 * YEAR);
                if (pass.consequences.some(c => c.kind === 'stopped_waiting')) count++;
            }
            return count;
        };
        expect(stopped(true)).toBeLessThan(stopped(false));
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE DISAGREEMENT
// ─────────────────────────────────────────────────────────────────────────

describe('the epistemic layer after a long absence', () => {
    it('holds several dated, sourced, incompatible accounts of one absence', () => {
        const { state, day } = withCast('abs-disagree');
        const opened = beginAbsence(state, {
            absenteeId: 'him',
            absenteeName: 'him',
            onDay: day,
            locationId: 'loc-region-0',
            witnessIds: ['enemy'],
            toldIds: ['her']
        });

        const ledger = new KnowledgeLedger();
        ledger.addFact(opened.truth);
        for (const record of opened.accounts) ledger.addRecord(record);

        const pass = applyAbsence(state, opened.absence, day + 400 * YEAR);
        for (const record of pass.accounts) ledger.addRecord(record);

        const versions = ledger.disagreementsAbout(fateClaimKey('him'));
        expect(versions.length).toBeGreaterThanOrEqual(4);

        const byHolder = new Map(
            ledger.claimsAbout(fateClaimKey('him')).map(r => [r.holderId, r])
        );

        // The enemy watched, and is the only correct account in the world.
        const enemy = byHolder.get('enemy')!;
        expect(enemy.stance).toBe('knows');
        expect(enemy.source.kind).toBe('witnessed');
        expect(ledger.compareToReality(enemy.id)!.groundless).toBe(false);

        // The woman who waited holds a belief with nothing behind it.
        const her = ledger
            .heldBy('her')
            .find(r => r.tags.includes('stopped_waiting'))!;
        expect(her.stance).toBe('believes');
        expect(ledger.isGroundless(her.id)).toBe(true);

        // The public and the register both say he died, and can say it in
        // different years, because they are different holders.
        expect(byHolder.get('public:loc-region-0')!.statement).toContain('died');
        expect(byHolder.get('public:register:loc-region-0')!.statement).toContain('deceased');

        // Nothing in the ledger is the truth. The truth is a fact.
        expect(ledger.claimsAbout(fateClaimKey('him')).every(r => r.holderId !== 'him')).toBe(true);
        expect(ledger.truthAbout(fateClaimKey('him'))).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// COMING BACK
// ─────────────────────────────────────────────────────────────────────────

describe('homecoming', () => {
    it('reports what is materially different and does not change anything', () => {
        const { state, day } = withCast('abs-home');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him', absenteeName: 'him', onDay: day, toldIds: ['her']
        });
        applyAbsence(state, absence, day + 120 * YEAR);

        const before = JSON.stringify(state);
        const out = homecoming(state, absence, day + 120 * YEAR);
        expect(JSON.stringify(state)).toBe(before);

        expect(out.yearsAway).toBe(120);
        expect(out.ties).toHaveLength(2);
        const hers = out.ties.find(t => t.holderId === 'her')!;
        expect(hers.standingThen).toBe(0.9);
        expect(hers.outcome).not.toBe('unchanged');
        expect(hers.summary.length).toBeGreaterThan(0);
    });

    it('a witness who dies takes the only true account out of reach', () => {
        const { state, day } = withCast('abs-witness');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him', absenteeName: 'him', onDay: day, witnessIds: ['enemy']
        });
        const at = state.npcs.findIndex(n => n.id === 'enemy');
        state.npcs[at] = markDead(state.npcs[at], day + 10 * YEAR, 'Old account settled.');

        const pass = applyAbsence(state, absence, day + 40 * YEAR);
        expect(pass.consequences.some(c => c.kind === 'witness_lost')).toBe(true);
        expect(homecoming(state, absence, day + 40 * YEAR).survivingWitnesses).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// GUARDS
// ─────────────────────────────────────────────────────────────────────────

describe('what this module is not allowed to be', () => {
    it('has no rate that is not tiny, so a decade stays playable', () => {
        expect(STOP_WAITING_PER_YEAR).toBeLessThan(0.1);
    });

    it('never ranks anybody by cultivation when deciding who waits', () => {
        // Same world, same seed, same tie. Only the waiting party's position on
        // the ladder differs. If any decision here consulted a realm this would
        // diverge, which is the social layer's prohibition enforced from the
        // world side: a mortal wife waits exactly as long as a Nascent Soul one.
        const run = (ordinal: number): string => {
            const { state, day } = withCast('abs-realm-blind');
            const at = state.npcs.findIndex(n => n.id === 'her');
            state.npcs[at] = {
                ...state.npcs[at],
                cultivation: { ...state.npcs[at].cultivation, realmOrdinal: ordinal }
            };
            const { absence } = beginAbsence(state, {
                absenteeId: 'him', absenteeName: 'him', onDay: day, toldIds: ['her']
            });
            const pass = applyAbsence(state, absence, day + 60 * YEAR);
            return pass.consequences.map(c => `${c.kind}@${c.afterYears}`).join('|');
        };
        expect(run(40)).toBe(run(1));
        expect(run(1)).toContain('@');
    });
});
