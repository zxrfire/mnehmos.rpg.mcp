/**
 * The authority boundary, from the other side.
 *
 * `narrator-authority.test.ts` has twenty-three cases and every one of them
 * guards the INPUT: an invented action name is discarded, an invented stat
 * field is stripped, an out-of-range duration falls back, and the model is only
 * ever shown facts the engine produced. All necessary, and none of them looks
 * at what the model SAYS. The engine was protected from the model; the player
 * was not.
 *
 * Measured against the real service with a scripted narrator:
 *
 *     narration-claims-breakthrough = true
 *     ordinal-after = 0        progress-after = 0
 *
 * Two ranks announced to a player that the engine never granted, in prose
 * imitating the engine's own digest down to the day numbers and the odds. And
 * the inverse: the engine files a `method_ceiling` line saying in full why
 * nothing is accumulating, hands the model the whole sentence, and the model
 * drops it - so a cultivator sits for fifty years and is never told why.
 *
 * Addition and omission. One rule, two signs, and a player who is told they
 * advanced two ranks HAS been given an outcome by a model, whether or not a row
 * moved: they will plan the next forty years around it.
 *
 * Every provider here is a local fake. Nothing in this file touches a network.
 */

import { describe, it, expect } from 'vitest';
import { auditNarration, withRequiredLines } from '../../src/web/narrator';
import { makeGame, ScriptedProvider } from './harness';

/** Prose in the engine's own digest format, announcing ranks nobody granted. */
const FABRICATED_ADVANCEMENT =
    'Day 91 - Breakthrough succeeded: Qi Condensation Layer 1 to Layer 2. Odds were 94.0%. '
    + 'Day 275 - Breakthrough succeeded: Layer 2 to Layer 3. Odds were 91.0%. '
    + 'Wen Shu opened his eyes on a body that was not the one he sat down in.';

/** A cultivator with money and no book: the engine grants nothing, correctly. */
async function stalledButFunded(seed: string, provider?: ScriptedProvider) {
    const harness = makeGame(provider ? { seed, provider } : { seed });
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db
        .prepare('UPDATE cultivators SET spirit_stones = 200000 WHERE id = ?')
        .run(cultivator.id);
    return harness;
}

describe('prose that contradicts the engine is not shown', () => {
    it('discards an invented advancement and renders the engine account instead', async () => {
        const provider = new ScriptedProvider({ plans: [], narrations: [FABRICATED_ADVANCEMENT] });
        const { game } = await stalledButFunded('fab-guard', provider);

        const result = await game.cultivate(1800, { anyway: true });
        const after = game.state().cultivator;

        // The engine was untouched, as it always was. This half already held.
        expect(after.realmOrdinal).toBe(0);
        expect(after.cultivationProgress).toBe(0);

        // And now so is the player. This is the assertion that did not exist.
        expect(result.narration).not.toMatch(/breakthrough succeeded/i);
    });

    it('discards an invented death', () => {
        const violations = auditNarration(
            'Wen Shu is dead. He starved in the dark and the run is over.',
            { ranksGained: 0, died: false }
        );
        expect(violations.map(v => v.kind)).toEqual(['invented_death']);
    });

    it('is one-directional: it never requires the prose to say anything', () => {
        // Terse prose is not a fabrication. Omission is the `required`
        // channel's problem, and conflating the two would make every short
        // narration a violation.
        expect(auditNarration('The room was quiet.', {
            ranksGained: 1,
            breakthroughAttempted: true,
            died: true
        })).toEqual([]);
    });

    it('does not flag legitimate prose, which is what makes it usable at all', () => {
        const cases: Array<[string, Parameters<typeof auditNarration>[1]]> = [
            ['The barrier gave. Wen Shu broke through to Qi Condensation Layer 2.',
                { ranksGained: 1, breakthroughAttempted: true, died: false }],
            // A real FAILURE. Prose about a failed attempt legitimately contains
            // the words a successful one would, and discarding it would throw
            // away writing about the most dramatic thing in the game.
            ['He struck the barrier and did not attain the next layer; three meridians tore.',
                { ranksGained: 0, breakthroughAttempted: true, died: false }],
            ['Wen Shu is dead. The run is over.',
                { ranksGained: 0, died: true }],
            ['Forty years went by and nobody came to the cave.',
                { ranksGained: 0, breakthroughAttempted: false, died: false }],
            ['Nothing accumulated, because there is no road for the qi to take.',
                { ranksGained: 0, breakthroughAttempted: false, died: false }]
        ];
        for (const [text, filed] of cases) {
            expect(auditNarration(text, filed), text).toEqual([]);
        }
    });

    it('audits nothing when the caller files no account', () => {
        // A call site with no outcome to describe must lose nothing by not
        // supplying one, or adding the guard to a new site becomes a refactor
        // rather than a line.
        expect(auditNarration(FABRICATED_ADVANCEMENT, null)).toEqual([]);
        expect(auditNarration(FABRICATED_ADVANCEMENT, undefined)).toEqual([]);
    });
});

describe('lines the player must read survive a narrator that skips them', () => {
    const LINE = 'Without a manual there is no road for the qi to take.';

    it('puts back an engine line the model dropped', () => {
        const whole = withRequiredLines('Years went by. The room was quiet.', [LINE]);
        expect(whole).toContain(LINE);
    });

    it('adds nothing when the model already said it, however it phrased the paragraph', () => {
        // Normalised matching, so quoting the sentence inside a paragraph counts
        // as having said it. A required line stapled onto prose that already
        // contains it is a cost with no benefit.
        const already =
            'He sat, and sat. Without a manual, there is no road for the qi to take -- '
            + 'and so nothing came of any of it.';
        expect(withRequiredLines(already, [LINE])).toBe(already);
    });

    it('does nothing at all when the engine required nothing', () => {
        expect(withRequiredLines('Prose.', [])).toBe('Prose.');
        expect(withRequiredLines('Prose.', undefined)).toBe('Prose.');
    });

    it('reaches a real player through a real narrator that ignored it', async () => {
        const provider = new ScriptedProvider({
            plans: [],
            narrations: ['Years went by. The room was quiet.']
        });
        const { game } = await stalledButFunded('req-guard', provider);
        const result = await game.cultivate(1800, { anyway: true });
        expect(result.narration).toMatch(/no road for the qi/i);
    });
});

describe('the ceiling is answerable without spending the decade', () => {
    it('is on the status read, beside the progress figure it explains', async () => {
        const { game } = makeGame({ seed: 'ceil-status' });
        await game.newRun('Wen Shu');
        const status = await game.act('how am I doing');
        // "0 of 100 toward the next rank" with no explanation attached invites
        // another decade, and the true answer is that no number of decades
        // moves it.
        expect(status.narration).toMatch(/no road for the qi/i);
    });

    it('is in the seclusion preamble, before the years are spent', async () => {
        const { game } = await stalledButFunded('ceil-pre');
        const result = await game.cultivate(1800, { anyway: true });
        expect(result.narration).toMatch(/no road for the qi/i);
    });

    it('goes quiet the moment they hold a book', async () => {
        const { game } = makeGame({ seed: 'ceil-quiet' });
        await game.newRun('Wen Shu');
        await game.act('I buy the Lesser Qi-Gathering Manual');
        await game.act('I learn the Lesser Qi-Gathering Manual');
        const status = await game.act('how am I doing');
        expect(status.narration).not.toMatch(/no road for the qi/i);
    });
});
