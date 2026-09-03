/**
 * An operator reaching past what the played cultivator has heard of.
 *
 * The design owner's ruling, in four words: *"operator can bypass knowledge
 * checks."* An operator's job is to stand the world somewhere ordinary play
 * would take four hundred years to reach, and being subject to one character's
 * ignorance is exactly what stops them.
 *
 * Three claims, and they fail in three different directions, so all three are
 * here:
 *
 *   IT REACHES        an ADMIN line resolves a name this cultivator has never
 *                     had said in front of them, where the same sentence typed
 *                     plainly is refused.
 *   IT IS NOT A       and the act behind the name still meets every bar. The
 *   BYPASS OF A RULE  Hollow Court admits at Void Refinement whether or not
 *                     anybody has heard of it.
 *   IT DOES NOT LEAK  the very next ordinary sentence is refused again, and
 *                     nothing was written: the holder has heard of exactly what
 *                     they had heard of before the line.
 *
 * The world is off. Nothing here asserts anything about the several hundred
 * people seeding one would cost, and the house being reached for is a catalog
 * house that exists in every configuration.
 */

import { describe, it, expect } from 'vitest';

import { engineCalls, makeGame } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import {
    REACHES_NAMED_IN_A_RECEIPT,
    theOperatorReachesPast,
    withTheOperatorReaching
} from '../../src/web/operator-knowledge-reach';

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
async function withAdminMode<T>(on: boolean, fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = on ? 'true' : 'false';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

/**
 * A house at the top of the world that nobody starts having heard of.
 *
 * The Hollow Court is the right one to test with because it refuses for TWO
 * separate reasons - nobody has heard of it, and it admits at Void Refinement -
 * so a reach that lifted more than the awareness gate would be visible
 * immediately.
 */
const THE_COURT = 'the Hollow Court';

// ═══════════════════════════════════════════════════════════════════════════
// THE CONTEXT ITSELF
// ═══════════════════════════════════════════════════════════════════════════

describe('the reach is a scope and not a flag', () => {
    it('answers nothing at all outside a line', () => {
        // Nothing outside `withTheOperatorReaching` can open it, and it is
        // opened in one place, behind ADMIN_MODE, on a verb the operator named.
        expect(theOperatorReachesPast('anybody', 'isAwareOf', 'sect', 'sect-hollow-court'))
            .toBe(false);
    });

    it('is closed again the moment the line returns', async () => {
        const inside = await withTheOperatorReaching('holder-1', async () =>
            theOperatorReachesPast('holder-1', 'isAwareOf', 'sect', 'x'));
        expect(inside.result).toBe(true);
        // A flag can be left set. A scope cannot be, and that is the whole
        // reason this is one.
        expect(theOperatorReachesPast('holder-1', 'isAwareOf', 'sect', 'x')).toBe(false);
    });

    it('opens for one holder, so nobody else\'s gate moves', async () => {
        // This matters more than it looks. A forced wrong is answered by people
        // who found out about it, and `asking-verbs.ts` asks the gate what the
        // person being ASKED knows. Lifting that would hand the world grudges
        // nobody could have held.
        const seen = await withTheOperatorReaching('holder-1', async () => ({
            player: theOperatorReachesPast('holder-1', 'isAwareOf', 'sect', 'x'),
            somebodyElse: theOperatorReachesPast('holder-2', 'isAwareOf', 'sect', 'x')
        }));
        expect(seen.result).toEqual({ player: true, somebodyElse: false });
    });

    it('records what it reached past, and stops recording rather than growing', async () => {
        const ran = await withTheOperatorReaching('holder-1', async () => {
            for (let i = 0; i < REACHES_NAMED_IN_A_RECEIPT + 20; i++) {
                theOperatorReachesPast('holder-1', 'isAwareOf', 'sect', `sect-${i}`);
            }
            // A repeat is not a second lift, so the receipt does not say it twice.
            theOperatorReachesPast('holder-1', 'isAwareOf', 'sect', 'sect-0');
        });
        expect(ran.reach!.reached).toHaveLength(REACHES_NAMED_IN_A_RECEIPT);
        expect(ran.reach!.reached[0]).toEqual({
            asked: 'isAwareOf', kind: 'sect', id: 'sect-0'
        });
    });

    it('opens nothing at all without a holder', async () => {
        // Which is what an ADMIN line gets when there is no run to name one.
        const ran = await withTheOperatorReaching(null, async () =>
            theOperatorReachesPast('holder-1', 'isAwareOf', 'sect', 'x'));
        expect(ran.result).toBe(false);
        expect(ran.reach).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// PLAYED
// ═══════════════════════════════════════════════════════════════════════════

describe('an ADMIN line reaches a name ordinary play cannot say', () => {
    it('refuses the name typed plainly, resolves it typed as ADMIN, and refuses it again after', async () => {
        await withAdminMode(true, async () => {
            const { db, game } = makeGame({ adminMode: true, seed: 'reach' });
            const { cultivator } = await game.newRun('Shen Yuan');
            const gate = new KnowledgeGate(db);

            // ── BEFORE ──
            const plain = await game.act(`I join ${THE_COURT}`);
            expect(engineCalls(plain).find(c => c.name === 'engine.resolveSect')?.summary)
                .toMatch(/no knowledge record/);

            // ── THE OPERATOR LINE ──
            const forced = await game.act(`ADMIN sect join ${THE_COURT}`);
            // The name resolved. What refused is the house's own admission bar,
            // which is a fact about the world and not about awareness - so the
            // reach lifted the gate and left the rule exactly where it was.
            expect(engineCalls(forced).map(c => c.name)).not.toContain('engine.resolveSect');
            expect(forced.narration).toMatch(/admits from Void Refinement/);
            expect(forced.narration).toMatch(/PRECONDITION and not a roll/);

            // ── AFTER, AND THIS IS THE ONE THAT MATTERS ──
            //
            // The failure mode to avoid is a resolver that quietly stops gating
            // because a flag was left set. The very next ordinary sentence is
            // refused for the same reason it was refused before the line.
            const after = await game.act(`I join ${THE_COURT}`);
            expect(engineCalls(after).find(c => c.name === 'engine.resolveSect')?.summary)
                .toMatch(/no knowledge record/);

            // And nothing was written. The reach is not knowledge, and the
            // holder's own map of the world is what it was - `grant_knowledge`
            // is the action that actually gives somebody a name.
            expect(gate.isAwareOf(cultivator.id, 'sect', 'sect-hollow-court')).toBe(false);
            expect(gate.stageOf(cultivator.id, 'sect', 'sect-hollow-court')).toBe('unaware');
        });
    }, 60_000);

    it('writes what it reached past to the audit trail, which is the admin flag', async () => {
        // As loud as the banner over every other admin line. A gate lifted
        // silently is indistinguishable from a gate that was never there.
        await withAdminMode(true, async () => {
            const { game } = makeGame({ adminMode: true, seed: 'reach' });
            await game.newRun('Shen Yuan');
            await game.act(`ADMIN sect join ${THE_COURT}`);

            const trail = await game.act('ADMIN audit_log');
            expect(trail.narration).toContain('reach.sect');
            expect(trail.narration).toContain('sect-hollow-court');
            expect(trail.narration).toMatch(/no name was learned, no record was written/);
        });
    }, 60_000);

    it('does not open at all with ADMIN_MODE off', async () => {
        await withAdminMode(false, async () => {
            const { game } = makeGame({ adminMode: false, seed: 'reach' });
            await game.newRun('Shen Yuan');
            await expect(game.act(`ADMIN sect join ${THE_COURT}`)).rejects.toThrow(/ADMIN is off/i);
        });
    }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// AND THE ACTION THAT ACTUALLY GIVES SOMEBODY THE NAMES
//
// `grant_knowledge` is the persistent counterpart to the reach, and it was
// lifting half the gate. Measured before this was pinned: it wrote 992 place
// rows and the game could point at 10 of them, so `where can I go` - one of the
// two lines the action itself tells the operator to type next - answered with
// eight names and "there are 982 further names you are carrying that you cannot
// place".
//
// `REACHABLE_FROM` is `placed` and the rows were landing at `named`, because
// nothing stated a stage and `stageFromStance` derives one from a stance nobody
// set. `placed` is exactly what `stageCeilingFor('told')` permits.
// ═══════════════════════════════════════════════════════════════════════════

describe('grant_knowledge lifts the whole gate and not half of it', () => {
    it('leaves every granted place somewhere the cultivator can point at', async () => {
        await withAdminMode(true, async () => {
            const { db, game } = makeGame({ adminMode: true, seed: 'granted' });
            const { cultivator } = await game.newRun('Shen Yuan');
            await game.act('ADMIN grant_knowledge kind=place');

            const gate = new KnowledgeGate(db);
            const held = gate.awareness(cultivator.id, 'place');
            expect(held.length).toBeGreaterThan(100);
            const cannotPointAt = held.filter(
                row => !gate.canPointAt(cultivator.id, 'place', row.id)
            );
            expect(cannotPointAt.map(row => row.name)).toEqual([]);
        });
    }, 60_000);

    it('and nothing above placed, because that would be a life they did not live', async () => {
        // `encountered` and `known` are claims about having been there and
        // having dealt with it. Being told a name is neither.
        await withAdminMode(true, async () => {
            const { db, game } = makeGame({ adminMode: true, seed: 'granted' });
            const { cultivator } = await game.newRun('Shen Yuan');
            await game.act('ADMIN grant_knowledge kind=sect');

            const gate = new KnowledgeGate(db);
            const granted = gate.provenanceOf(cultivator.id, 'sect', 'sect-hollow-court');
            expect(granted).toHaveLength(1);
            expect(granted[0].stage).toBe('placed');
            expect(granted[0].sourceKind).toBe('told');
        });
    }, 60_000);
});
