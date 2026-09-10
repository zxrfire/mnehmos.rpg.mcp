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
                { ranksGained: 0, breakthroughAttempted: false, died: false }],
            // A BAR SOMEBODY ELSE SETS IS NOT A CLAIM ABOUT THE PLAYER.
            //
            // An intake notice states its floor, and the engine's own fact for
            // one reads "will hear anybody who has reached Qi Condensation at
            // all" - so `reached ... condensation`, matched without asking who
            // the sentence was about, destroyed every narration of a town with
            // notices up. Measured on `who is here` against a live model:
            // discarded three runs out of three, and the run that survived did
            // so only by leaving all three notices out of the prose.
            ['The Azure Dew Sect will hear anybody who has reached Qi Condensation at all, '
                + 'and whoever answers is taken.',
                { ranksGained: 0, breakthroughAttempted: false, died: false, who: 'Wen Shu' }],
            ['Verdant Spring Valley wants somebody some way into Qi Condensation and not '
                + 'from the first rung of it.',
                { ranksGained: 0, breakthroughAttempted: false, died: false, who: 'Wen Shu' }],
            // Somebody else's standing, stated as what it is.
            ['He has attained a realm you will not see for forty years.',
                { ranksGained: 0, breakthroughAttempted: false, died: false, who: 'Wen Shu' }]
        ];
        for (const [text, filed] of cases) {
            expect(auditNarration(text, filed), text).toEqual([]);
        }
    });

    /**
     * And the claim the loosened check still has to catch: the player across the
     * bar, rather than the bar.
     */
    it('still catches an advancement the engine did not grant', () => {
        for (const text of [
            'You have reached Qi Condensation Layer 2.',
            'Wen Shu attained the second layer before the hour was out.',
            'Your breakthrough succeeded and the realm opened.',
            'She broke through to Foundation Establishment.'
        ]) {
            expect(
                auditNarration(text, {
                    ranksGained: 0, breakthroughAttempted: false, died: false, who: 'Wen Shu'
                }).map(v => v.kind),
                text
            ).toContain('invented_breakthrough');
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
        expect(result.narration).toMatch(/no cultivation method|nothing accumulates/i);
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
        expect(status.narration).toMatch(/no cultivation method|nothing accumulates/i);
    });

    it('is in the seclusion preamble, before the years are spent', async () => {
        const { game } = await stalledButFunded('ceil-pre');
        const result = await game.cultivate(1800, { anyway: true });
        expect(result.narration).toMatch(/no cultivation method|nothing accumulates/i);
    });

    it('goes quiet the moment they hold a book', async () => {
        const { game } = makeGame({ seed: 'ceil-quiet' });
        await game.newRun('Wen Shu');
        await game.act('I buy the Lesser Qi-Gathering Manual');
        await game.act('I learn the Lesser Qi-Gathering Manual');
        const status = await game.act('how am I doing');
        expect(status.narration).not.toMatch(/no cultivation method|nothing accumulates/i);
    });
});


/**
 * WHOSE death the prose is describing.
 *
 * `filed.died` means THE RUN ENDED. The check used to match any death in the
 * sentence, so prose naming an NPC dying was reported as the player's own
 * invented death and the turn was replaced - a true objection with a false
 * reason, which is the same sin as the narration this exists to police.
 *
 * Measured before the fix: "Han Liebo is dead." came back CAUGHT as
 * invented_death. Nothing about that narration was wrong.
 */
describe('the death check is about the player and nobody else', () => {
    const who = 'Mo Qianshu';

    it('does not report an NPC death as the player inventing one', () => {
        for (const prose of [
            'Han Liebo is dead.',
            'The bandit died where he stood.',
            'You cut Han Liebo down and he is dead.',
            // Another cultivator sharing nothing but the grammar.
            'Wen Shu is dead.'
        ]) {
            expect(auditNarration(prose, { died: false, who }), prose).toEqual([]);
        }
    });

    it('still catches the player dying, named either way', () => {
        for (const prose of [
            'You are dead.',
            'You died in the dark.',
            'You were killed.',
            'You did not survive.',
            // The engine's own account and the deterministic fallback use the
            // name rather than the second person, so both have to match.
            'Mo Qianshu is dead.',
            // A run is the player's and nobody else's, whoever is named.
            'He starved in the dark and the run is over.'
        ]) {
            expect(
                auditNarration(prose, { died: false, who }).map(v => v.kind),
                prose
            ).toEqual(['invented_death']);
        }
    });

    it('says nothing when the engine did record the death', () => {
        expect(auditNarration('You are dead.', { died: true, who })).toEqual([]);
    });

    /**
     * With no name supplied the check narrows rather than widens: it can miss
     * a by-name death and it can never blame the player for somebody else's.
     */
    it('under-reports rather than misattributing when no name is given', () => {
        expect(auditNarration('Mo Qianshu is dead.', { died: false })).toEqual([]);
        expect(auditNarration('You are dead.', { died: false }).map(v => v.kind))
            .toEqual(['invented_death']);
    });
});

/**
 * AND THE THIRD FABRICATION, WHICH IS QUIETER THAN THE OTHER TWO.
 *
 * FOUND BY PLAYING. The stall was read and nothing was bought. The next turn's
 * prose said:
 *
 *     "You have the Lesser Qi-Gathering Manual with you, but it remains a
 *      closed weight in your possession."
 *
 * The engine's facts for that same turn said the opposite in as many words -
 * *no method is practised, so the rate multiplier at Qi Condensation Layer 1 is
 * 0* - and the model wrote the player into owning the one object that would
 * have changed it. Nobody dies of this and no rank moves, which is why it is
 * quieter; a player who believes they own a method will sit for a year finding
 * out they do not.
 *
 * The check is narrow on both sides deliberately. Only names the engine SAID
 * this turn are considered, because only those were handed to the model; and
 * only names the player does not hold, because owning it is the whole question.
 */
describe('prose that hands the player something they do not have', () => {
    const filed = { who: 'Wen Shu', onOfferAndNotHeld: ['Lesser Qi-Gathering Manual'] };
    const invented = (text: string) =>
        auditNarration(text, filed).some(v => v.kind === 'invented_possession');

    it('catches the claim in the shapes a model writes it', () => {
        for (const text of [
            'You have the Lesser Qi-Gathering Manual with you, but it remains closed.',
            'Your Lesser Qi-Gathering Manual lies open on your knees.',
            'The Lesser Qi-Gathering Manual is in your hands.',
            'You carry the Lesser Qi-Gathering Manual and have not opened it.'
        ]) {
            expect(invented(text), text).toBe(true);
        }
    });

    /**
     * AND LEAVES THE MARKET ALONE, which is the whole reason this is a claim
     * check and not a mention check. A stall listing a manual, pricing it, and
     * saying what rung it opens at is the single commonest answer in the game.
     */
    it('says nothing about a manual that is merely for sale', () => {
        for (const text of [
            'A Lesser Qi-Gathering Manual is available for eight spirit stones; it opens at '
            + 'Qi Condensation Layer 1 and carries as far as Foundation Establishment Early.',
            'Beside the cooking pots, block-printed manuals are set down plainly.',
            'The stall has a Lesser Qi-Gathering Manual. You have eighty-eight spirit stones.'
        ]) {
            expect(invented(text), text).toBe(false);
        }
    });

    it('says nothing at all about something they actually hold', () => {
        // The caller only lists what is NOT held, so a book bought a moment ago
        // never reaches this check. Asserted so that the day somebody makes the
        // list "every name" instead, this fails.
        expect(auditNarration(
            'You have the Lesser Qi-Gathering Manual with you.',
            { who: 'Wen Shu', onOfferAndNotHeld: [] }
        )).toEqual([]);
    });

    it('leaves the other two audits exactly where they were', () => {
        expect(auditNarration('Nothing much happened.', filed)).toEqual([]);
    });
});
