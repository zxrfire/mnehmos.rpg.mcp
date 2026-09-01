/**
 * Nobody takes a 2% gamble with their meridians on somebody else's behalf.
 *
 * `runSeclusion` passes `autoBreakthrough: true`, and the skip used to strike
 * the instant `canAttemptBreakthrough` said yes. That is by construction the
 * worst legal moment: no overflow has accumulated, so the odds sit at their
 * minimum for the rung. Played live it produced a realm boundary attempted at
 * 2% - the floor of the whole scale - on a healthy, fully provisioned
 * cultivator, and the meridian injuries a boundary failure inflicts then killed
 * the run. The player never chose it and was never told it was coming.
 *
 * The rule is derived rather than picked: while the headroom left in
 * `overflowBonus` is worth more than the whole attempt is worth, striking is
 * the dominated move. It always resolves, because sitting raises the chance and
 * shrinks the headroom at the same time.
 */

import {
    computeBreakthroughOdds,
    overflowBonus,
    MAX_OVERFLOW_BONUS,
    MIN_BREAKTHROUGH_CHANCE
} from '../../../src/engine/cultivation/breakthrough.js';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { FOUNDATION_ORDINAL, progressRequiredForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { makeCultivator } from './fixtures.js';

/** The last rung of Qi Condensation - the boundary the report died on. */
const WALL = FOUNDATION_ORDINAL - 1;

/** A cultivator standing on a full gate with `overflow` times the price banked. */
function atTheGate(overflow: number) {
    const required = progressRequiredForOrdinal(WALL)!;
    return makeCultivator({
        realmOrdinal: WALL,
        cultivationProgress: required * (1 + overflow),
        spiritRoot: 'muddled_five_element',
        hp: 40,
        maxHp: 40
    });
}

function sit(overflow: number, days: number) {
    return simulateTimeSkip(atTheGate(overflow), days, {
        seed: 'unattended-crossing',
        rollIdentity: 'player',
        locationId: 'nowhere',
        turn: 1,
        startDay: 0,
        autoBreakthrough: true,
        randomEvents: false,
        grainAbstinence: true
    });
}

describe('the odds at the moment the gate opens', () => {
    it('are a small multiple of the floor of the whole scale', () => {
        const odds = computeBreakthroughOdds(atTheGate(0), { ambient: 'thin' });
        // Not pinned to MIN_BREAKTHROUGH_CHANCE exactly: this fixture is
        // healthier than the character that died, and the point is the ORDER OF
        // MAGNITUDE. A realm boundary struck the moment the gate opens is
        // single-digit percent for anybody, and 2% for somebody unlucky.
        expect(odds.finalChance).toBeGreaterThanOrEqual(MIN_BREAKTHROUGH_CHANCE);
        expect(odds.finalChance).toBeLessThan(0.1);
    });

    it('are worth less than what continuing to sit could still add', () => {
        const odds = computeBreakthroughOdds(atTheGate(0), { ambient: 'thin' });
        const headroom = MAX_OVERFLOW_BONUS - overflowBonus(WALL, atTheGate(0).cultivationProgress);
        expect(odds.finalChance).toBeLessThan(headroom);
    });
});

describe('an unattended skip', () => {
    // Short, deliberately. Over a long enough stretch the deferral RESOLVES -
    // progress accumulates, headroom shrinks, and the crossing is taken. That
    // is the design and it has its own case below; this one is about the
    // moment the gate opens.
    it('does not strike a realm boundary at the floor', () => {
        const skip = sit(0, 60);
        const struck = skip.events.filter(
            e => e.kind === 'breakthrough_success' || e.kind === 'breakthrough_failure'
        );
        expect(struck, 'the skip attempted a crossing nobody agreed to').toHaveLength(0);
    });

    it('says so, rather than sitting on a full gate in silence', () => {
        const skip = sit(0, 60);
        const deferred = skip.events.filter(e => e.kind === 'crossing_deferred');
        expect(deferred).toHaveLength(1);
        // The odds are the actionable half: a player who can read them can
        // decide to sit longer, which is the thing they could not do before.
        expect(deferred[0].summary).toMatch(/prices at \d+\.\d%/);
        expect(Number(deferred[0].data.finalChance)).toBeGreaterThan(0);
    });

    it('says it once however long the stretch is', () => {
        const long = sit(0, 20 * 365);
        expect(long.events.filter(e => e.kind === 'crossing_deferred')).toHaveLength(1);
    });

    /**
     * The escape hatch, and the reason this is a deferral rather than a ban.
     * Sitting raises the chance and shrinks the headroom at once, so the two
     * cross and the crossing does eventually get attempted on its own.
     */
    it('does strike once sitting has stopped being the better move', () => {
        const skip = sit(3, 400);
        const struck = skip.events.filter(
            e => e.kind === 'breakthrough_success' || e.kind === 'breakthrough_failure'
        );
        expect(struck.length, 'a well-banked gate was never struck').toBeGreaterThan(0);
        expect(skip.events.filter(e => e.kind === 'crossing_deferred')).toHaveLength(0);
    });
});
