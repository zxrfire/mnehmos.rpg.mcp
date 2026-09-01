/**
 * Mortal care is the bottom rung of the healing ladder, not a substitute for it.
 *
 * The user's ruling, in their words: wounds are not forever, they are answered
 * by graded healing pills at the same rank requirement, "where a lower should
 * heal almost nothing - it'll heal a fixed hp amount and as you get up the
 * amount becomes a lot."
 *
 * A FIXED amount self-scales in exactly that way with no rule saying so, and
 * this file is what stops it quietly becoming a fraction again. It was a
 * fraction for one commit - "a full month restores a body completely" - which
 * made the entire pill ladder pointless: nobody buys a 1,200-potency Undying
 * Flesh Pill when a month and a few stones does more.
 */

import { describe, it, expect } from 'vitest';
import { makeGame, engineCalls } from './harness';
import { PILLS } from '../../src/data/cultivation/pills';

const HEAL = PILLS.filter(pill => pill.effect === 'heal_hp');

/**
 * Restore `hp` to 1 on a body of `maxHp`, with money, and buy a month of care.
 *
 * Returns what THE CARE restored, read off `engine.mortalCare` rather than off
 * the sheet. Those stopped being the same number when HP began recovering
 * ambiently: the month a stay costs also mends the body on its own, so the
 * sheet delta is the sum of two systems and only one of them is what the
 * healing ladder is a statement about. On a 5,000-HP frame the calendar's half
 * is 75 and care's is 24, which is exactly how a ladder guard turns into a
 * measurement of the wrong thing.
 *
 * Read from a mechanical channel rather than by parsing the prose, for the
 * usual reason: a reworded sentence is not a balance change.
 */
async function monthOfCare(seed: string, ordinal: number, maxHp: number) {
    const { db, game } = makeGame({ seed });
    const { cultivator } = await game.newRun('Hurt');
    db.prepare(
        'UPDATE cultivators SET realm_ordinal = ?, max_hp = ?, hp = 1, spirit_stones = 5000 WHERE id = ?'
    ).run(ordinal, maxHp, cultivator.id);
    const acted = await game.act('I get my injuries treated');
    const row = engineCalls(acted).find(call => call.name === 'engine.mortalCare');
    expect(row, 'the stay did not report what it restored').toBeDefined();
    return Number(/^(\d+) HP restored/.exec(row!.summary)![1]);
}

describe('a month of care restores a fixed amount, not a share of the wound', () => {
    it('mends the same number of HP on a novice and on a Nascent Soul body', async () => {
        const novice = await monthOfCare('care-guard-0', 0, 40);
        const nascent = await monthOfCare('care-guard-29', 29, 300);
        // THE assertion. A fraction would make these differ by 7.5x; a fixed
        // amount makes them identical, and identical is what turns "most of a
        // novice" into "almost nothing" four realms up without a rule for it.
        expect(nascent).toBe(novice);
    });

    it('is most of a small body and almost nothing on a large one', async () => {
        const novice = await monthOfCare('care-guard-a', 0, 40);
        const nascent = await monthOfCare('care-guard-b', 29, 300);
        expect(novice / 40).toBeGreaterThan(0.4);
        // "A lower should heal almost nothing" as you get up, structurally.
        expect(nascent / 300).toBeLessThan(0.15);
    });

    it('never exceeds what the body is actually missing', async () => {
        const { db, game } = makeGame({ seed: 'care-guard-cap' });
        const { cultivator } = await game.newRun('Grazed');
        db.prepare(
            'UPDATE cultivators SET max_hp = 40, hp = 38, spirit_stones = 5000 WHERE id = ?'
        ).run(cultivator.id);
        await game.act('I get my injuries treated');
        const after = game.state().cultivator;
        expect(after.hp).toBeLessThanOrEqual(after.maxHp);
    });

    it('cannot out-heal the pill it is the bottom rung of', async () => {
        const strongestMortal = Math.max(
            ...HEAL.filter(pill => pill.grade === 'mortal').map(pill => pill.potency)
        );
        const mended = await monthOfCare('care-guard-ladder', 0, 5000);
        // A month of a village physician is worth the best thing a village
        // physician can hand you, and not a rung more. Anything above this and
        // the graded consumable has no customers at any realm.
        expect(mended).toBeLessThanOrEqual(strongestMortal);
    });
});

describe('the ladder the ruling makes the real answer', () => {
    it('is graded by AMOUNT, ascending, with no gaps', () => {
        const byGrade = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;
        const best = byGrade.map(grade => Math.max(
            0, ...HEAL.filter(pill => pill.grade === grade).map(pill => pill.potency)
        ));
        for (let i = 1; i < best.length; i++) {
            expect(best[i], `${byGrade[i]} must out-heal ${byGrade[i - 1]}`)
                .toBeGreaterThan(best[i - 1]);
        }
    });

    it('carries the same rank requirement across grades: none', () => {
        // The user asked for lower/mid/upper at the SAME rank requirement, so
        // that the grades are told apart by how much they restore rather than
        // by who is allowed to swallow one. The catalog agrees by having no
        // rank column on a pill at all - the gate is price, toxicity, and
        // whether anybody can refine it.
        for (const pill of HEAL) {
            expect(pill, pill.name).not.toHaveProperty('requiredOrdinal');
            expect(pill, pill.name).not.toHaveProperty('minOrdinal');
        }
    });

    it('costs more the further up it goes, which is what gates it instead', () => {
        const mortal = HEAL.filter(p => p.grade === 'mortal');
        const top = HEAL.filter(p => p.grade === 'immortal' || p.grade === 'chaos');
        expect(Math.min(...top.map(p => p.value)))
            .toBeGreaterThan(Math.max(...mortal.map(p => p.value)) * 100);
    });

    it('is swallowable through a sentence a player can type', async () => {
        const { db, game } = makeGame({ seed: 'care-guard-swallow' });
        const { cultivator } = await game.newRun('Taker');
        db.prepare(
            'UPDATE cultivators SET max_hp = 60, hp = 10, spirit_stones = 500 WHERE id = ?'
        ).run(cultivator.id);
        await game.act('I buy a Minor Healing Pill');
        const before = game.state().cultivator.hp;
        await game.act('I swallow a healing pill');
        // The whole point of the ruling reaching a player at all.
        expect(game.state().cultivator.hp).toBeGreaterThan(before);
    });
});
