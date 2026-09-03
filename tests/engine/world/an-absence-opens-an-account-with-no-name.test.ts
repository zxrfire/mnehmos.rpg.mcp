/**
 * An absence is opened by the world, survives a restart, and leaves somebody
 * holding a wrong they cannot put a name to.
 *
 * Two tiers, as AGENTS.md asks for.
 *
 * The unit tier says WHAT HAPPENS: who opens an absence, that it is opened
 * once, what a giving-up leaves on the ledger, and that an explained absence
 * leaves nothing because nobody was wronged by a man who told them he was
 * going.
 *
 * The rate tier says IT HAPPENS AT ALL, and it is deliberately split in two
 * because the two halves are measurable by different instruments:
 *
 *   the closed form   a waiting tie gives up at a rate this module states, so
 *                     the fraction after Y years is 1 - (1 - rate) ^ Y and is
 *                     derivable rather than sampled. Measured on a cast that
 *                     cannot die, so nothing but the roll is in the number.
 *   the world         and then the same mechanism against a seeded world run
 *                     for centuries, where what is being asserted is only that
 *                     the wiring is live - the closed form cannot predict this
 *                     one, because how many people go missing and how long
 *                     their families outlive them are the world's business.
 */
import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import {
    createNpc,
    markMissing,
    upsertRelationship,
    type NpcRecord
} from '../../../src/engine/world/npc-state.js';
import {
    DEFINING_TIE_PATIENCE,
    STOP_WAITING_PER_YEAR,
    applyAbsence,
    beginAbsence,
    openAbsencesForTheUnaccountedFor
} from '../../../src/engine/world/when-somebody-does-not-come-back.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { NO_NAME_TAG, hasANameOnIt } from '../../../src/engine/social/accounts-with-no-name.js';

const YEAR = 365;

function bench(seed: string): { state: WorldState; day: number } {
    const state = createWorld({ seed, presentYear: 1000, skipPriorAges: true, regionCount: 2 });
    return { state, day: state.currentDay };
}

function person(state: WorldState, id: string): NpcRecord {
    const npc = createNpc(state.seed, {
        id,
        name: id,
        bornOnDay: state.currentDay - 20 * YEAR,
        onDay: state.currentDay,
        locationId: 'loc-region-0'
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

/** A man, his wife, and a cousin - and then the man walks off the map. */
function vanishes(seed: string): { state: WorldState; day: number } {
    const b = bench(seed);
    person(b.state, 'him');
    person(b.state, 'her');
    person(b.state, 'cousin');
    tie(b.state, 'her', 'him', 'spouse', 0.9);
    tie(b.state, 'cousin', 'him', 'kin', 0.6);
    const at = b.state.npcs.findIndex(n => n.id === 'him');
    b.state.npcs[at] = markMissing(b.state.npcs[at], b.day, 'Went out and did not come back.');
    return b;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO OPENS ONE
// ─────────────────────────────────────────────────────────────────────────

describe('the world opens an absence for anybody it cannot account for', () => {
    it('sweeps somebody the world marked missing, and does it exactly once', () => {
        const { state, day } = vanishes('open-sweep');

        const first = openAbsencesForTheUnaccountedFor(state, day);
        expect(first).toHaveLength(1);
        expect(state.absences.map(a => a.absenteeId)).toEqual(['him']);

        // Ten more sweeps, and still one absence. This runs every year for five
        // centuries, so the idempotence is the load-bearing half.
        for (let i = 0; i < 10; i++) openAbsencesForTheUnaccountedFor(state, day + i * YEAR);
        expect(state.absences).toHaveLength(1);
    });

    it('opens it unexplained, and dates it to the day the world lost them', () => {
        const { state, day } = vanishes('open-unexplained');
        const [{ absence }] = openAbsencesForTheUnaccountedFor(state, day + 40 * YEAR);

        expect(absence.witnessIds).toEqual([]);
        expect(absence.toldIds).toEqual([]);
        expect(absence.leftOnDay).toBe(day);
        // Everybody holding a household tie is waiting, and none of them was
        // told anything.
        expect(absence.ties.filter(t => t.waiting).map(t => t.holderId)).toEqual(['cousin', 'her']);
        expect(absence.ties.every(t => !t.informed)).toBe(true);
    });

    it('is reached from the driver, on the same yearly line as everything else', () => {
        const { state } = vanishes('open-driver');
        expect(state.absences).toHaveLength(0);
        advanceWorldYears(state, 5);
        expect(state.absences.map(a => a.absenteeId)).toEqual(['him']);
    });

    it('survives a clone, ties and all', () => {
        const { state, day } = vanishes('open-clone');
        openAbsencesForTheUnaccountedFor(state, day);
        const copy = cloneWorld(state);
        copy.absences[0].ties[0].settledOnDay = 99;
        expect(state.absences[0].ties[0].settledOnDay).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT GIVING UP LEAVES
// ─────────────────────────────────────────────────────────────────────────

describe('an unexplained absence leaves an account with no name on it', () => {
    /** Run one vanishing far enough that somebody is certain to give up. */
    function afterCenturies(seed: string) {
        const { state, day } = vanishes(seed);
        openAbsencesForTheUnaccountedFor(state, day);
        return {
            state,
            pass: applyAbsence(state, state.absences[0], day + 300 * YEAR)
        };
    }

    it('opens one row per person who stopped waiting, against nobody', () => {
        const { pass } = afterCenturies('acct-open');

        const stopped = pass.consequences.filter(c => c.kind === 'stopped_waiting');
        expect(stopped.length).toBeGreaterThan(0);
        expect(pass.opens).toHaveLength(stopped.length);

        for (const row of pass.opens) {
            // The whole point: it has no subject, and it says so the one way
            // the storage layer recognises.
            expect(row.subjectId).toBeNull();
            expect(hasANameOnIt({ subjectId: row.subjectId })).toBe(false);
            expect(row.tags).toContain(NO_NAME_TAG);
            // It rests on an inference from silence and nothing else.
            expect(row.fromBelief).toBe(true);
            expect(row.severity === 'grave' || row.severity === 'serious').toBe(true);
        }
        expect(pass.opens.map(r => r.holderId).sort()).toEqual(
            stopped.map(c => c.subjectId).sort()
        );
    });

    it('dates the wrong to the day he vanished, not the day she gave up', () => {
        const { state, pass } = afterCenturies('acct-dated');
        const row = pass.opens[0];
        expect(row.onDay).toBe(state.absences[0].leftOnDay);
        expect(row.triggeringEventId).toBe(state.absences[0].truthFactId);
    });

    it('sets them looking for a name they do not have', () => {
        const { state, pass } = afterCenturies('acct-search');
        const holder = state.npcs.find(n => n.id === pass.opens[0].holderId)!;
        const search = holder.goals.filter(g => g.kind === 'revenge');

        expect(search).toHaveLength(1);
        expect(search[0].targetId).toBeNull();
        expect(search[0].obstacles).toContain('Nobody has put a name to it.');
    });

    it('opens nothing when the man told them where he was going', () => {
        const { state, day } = vanishes('acct-explained');
        const { absence } = beginAbsence(state, {
            absenteeId: 'him',
            absenteeName: 'him',
            onDay: day,
            toldIds: ['her', 'cousin']
        });
        const pass = applyAbsence(state, absence, day + 300 * YEAR);

        expect(pass.consequences.filter(c => c.kind === 'stopped_waiting').length)
            .toBeGreaterThan(0);
        // They were let down by a man who chose to go. That is not a wrong with
        // no name on it - if there is a name on it, it is his.
        expect(pass.opens).toEqual([]);
        expect(state.npcs.flatMap(n => n.goals).filter(g => g.kind === 'revenge')).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE RATE, AGAINST THE CLOSED FORM
// ─────────────────────────────────────────────────────────────────────────

describe('the rate people give up at, and the accounts it leaves', () => {
    /**
     * One waiting tie, one absence, one draw per year.
     *
     * Nobody here can die, so the only thing in the number is the roll and the
     * expectation is exact: `1 - (1 - rate) ^ years`, with the rate halved for
     * a tie above `DEFINING_STANDING`.
     */
    function gaveUpWithin(years: number, standing: number, seeds = 400): number {
        let stopped = 0;
        for (let s = 0; s < seeds; s++) {
            const { state, day } = bench(`rate-${standing}-${years}-${s}`);
            person(state, 'him');
            person(state, 'her');
            tie(state, 'her', 'him', 'kin', standing);
            const { absence } = beginAbsence(state, {
                absenteeId: 'him', absenteeName: 'him', onDay: day
            });
            const pass = applyAbsence(state, absence, day + years * YEAR);
            if (pass.consequences.some(c => c.kind === 'stopped_waiting')) stopped++;
        }
        return stopped / seeds;
    }

    const closedForm = (years: number, patience: number): number =>
        1 - Math.pow(1 - STOP_WAITING_PER_YEAR * patience, years);

    it('matches the closed form for an ordinary tie', () => {
        for (const years of [10, 50]) {
            const measured = gaveUpWithin(years, 0.6);
            const predicted = closedForm(years, 1);
            expect(Math.abs(measured - predicted)).toBeLessThan(0.06);
        }
    });

    it('matches the closed form for a defining one, which waits twice as long', () => {
        for (const years of [10, 50]) {
            const measured = gaveUpWithin(years, 0.95);
            const predicted = closedForm(years, DEFINING_TIE_PATIENCE);
            expect(Math.abs(measured - predicted)).toBeLessThan(0.06);
        }
    });

    /**
     * And the same mechanism against a world nobody arranged.
     *
     * This is the reading that matters, because the number it replaces is
     * ZERO: `applyAbsence` had one caller, `driver.ts`, which iterated a list
     * that nothing in `src/` ever filled, so `absenceConsequences` was empty on
     * every seed and every horizon however correct the module was.
     *
     * Pooled over two seeds rather than asserted on one, and the bars are far
     * below what was measured rather than tight to it - this is a guard on the
     * wiring being live, not a calibration of the world's rate of disappearance,
     * which is the pressure layer's business and moves when it is tuned.
     *
     * Measured at the time of writing, four seeds over five centuries each:
     * 720 absences opened, 3,524 ties snapshotted, 2,717 of them waiting, and
     * 2,027 people who eventually stopped - about 36 absences and 101 nameless
     * accounts per world-century. 571 died still waiting and 119 were still
     * waiting at the end, which is the other two thirds of the design.
     */
    it('is live on a seeded world, where it used to be structurally zero', async () => {
        const { seedWorld } = await import('../../../src/engine/world/seeding.js');
        const { loadCultivationCatalog } = await import('../../../src/engine/world/catalog.js');
        const catalog = await loadCultivationCatalog();

        let absences = 0;
        let nameless = 0;
        let gaveUp = 0;
        for (const seed of ['soak-a', 'soak-b']) {
            const state = seedWorld({ seed, catalog }).state;
            const out = advanceWorldYears(state, 300);
            absences += state.absences.length;
            nameless += out.accounts.filter(row => !hasANameOnIt({ subjectId: row.subjectId })).length;
            gaveUp += state.absences.reduce(
                (n, a) => n + a.ties.filter(t => t.settledAs === 'stopped_waiting').length,
                0
            );
            // Every person the world cannot account for has exactly one, which
            // is the sweep doing its job rather than a sample.
            const missing = state.npcs.filter(n => n.status === 'missing').length;
            expect(state.absences.filter(a => a.absenteeId).length).toBe(missing);
        }

        expect(absences).toBeGreaterThan(40);
        expect(gaveUp).toBeGreaterThan(80);
        // One row per giving-up, carried out of the driver for the ledger.
        expect(nameless).toBe(gaveUp);
    }, 300_000);

    it('and every one of those give-ups leaves exactly one nameless row', () => {
        const { state, day } = vanishes('rate-rows');
        openAbsencesForTheUnaccountedFor(state, day);
        const pass = applyAbsence(state, state.absences[0], day + 200 * YEAR);
        expect(pass.opens.length).toBe(
            pass.consequences.filter(c => c.kind === 'stopped_waiting').length
        );
    });
});
