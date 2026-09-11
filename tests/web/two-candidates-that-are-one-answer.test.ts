/**
 * "What techniques do I know" resolved into nothing. "What arts do I know" read
 * the sheet.
 *
 * FOUND BY PLAYING BLIND, on a cultivator holding one manual they had just
 * bought and read:
 *
 *     > what techniques do i know
 *     You turn the thought over and it does not resolve into anything you could
 *     actually do standing here. Cao Kebo does not follow, and asks what you
 *     mean by it. They tell you what is here instead - Xiao Suishan, Yun Yaozhi,
 *     Tang Zhenbo and 8 more...
 *
 *     > what arts do i know
 *     What you are practising:
 *       Lesser Qi-Gathering Manual (mortal grade)...
 *
 * A question about the player's own sheet, refused, and then answered with a
 * list of the people standing in the square.
 *
 * ── AND IT IS NOT A MISSING SYNONYM ──────────────────────────────────────
 *
 * That would not be worth a test. `context.md` under *What engine-only mode is
 * for*: a phrasing the tier does not know is the player's cue to say it plainly,
 * and near-synonym sweeps do not belong at this tier. The tier knew this one:
 *
 *     what techniques do i know    list_techniques 0.835   learn_technique 0.831
 *
 * Four thousandths apart, so `CLEAR_AIR_COUNTS_FOR` declined - correctly by its
 * own terms, because the model did not prefer one to the other. But
 * `theReadThatAnswersIt` already maps `learn_technique` to `list_techniques`:
 * the runner-up IS the winner once the engine's own asking-is-not-doing rule has
 * run on it. The tier refused over an ambiguity that does not exist, which is
 * the engine declining to answer a question it has one answer to.
 *
 * ── WHY IT IS NOT A LOWER BAR ────────────────────────────────────────────
 *
 * The answer taken is the READ both verbs settle to and never the winner. Two
 * verbs collapse the same way BECAUSE one is the free read of the other, so the
 * half that survives costs nothing, names what committing would take, and
 * leaves the commitment to the next sentence. Nothing on this path can reach a
 * verb that spends in-world time, and the ordinary floor still applies to both
 * candidates. Pinned below.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';

/**
 * The tier's own two constants, restated rather than imported: they are private
 * to the module by design, and a test that could import them could also move
 * them. If either changes, this file's arithmetic is meant to stop matching.
 */
const CLEAR_AIR_COUNTS_FOR = 3;
const SURE_ENOUGH_TO_ACT_ON = 0.87;
import {
    nearestVerbByMeaning,
    readyTheTier,
    verbForASentenceThePatternsMissed
} from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for.js';

beforeAll(async () => {
    await readyTheTier();
});

async function routes(said: string): Promise<string> {
    const fromTable = parseIntent(said);
    return (await verbForASentenceThePatternsMissed(said, fromTable)).action;
}

describe('a question whose two readings are one answer', () => {
    it('reads the sheet for the engine\'s own word for the thing', async () => {
        expect(await routes('what techniques do i know')).toBe('list_techniques');
    });

    /** And the phrasing that always worked still does. */
    it('leaves the phrasing that worked alone', async () => {
        expect(await routes('what arts do i know')).toBe('list_techniques');
        expect(await routes('list the techniques I hold')).toBe('list_techniques');
    });

    /**
     * AND THE MEASUREMENT IS PINNED, because the whole argument is that these
     * two are one answer rather than two. If a later edit to the exemplar set
     * separates them, this file should fail loudly rather than keep passing for
     * a different reason.
     */
    it('is decided between two candidates too close to call', async () => {
        const near = await nearestVerbByMeaning('what techniques do i know');
        expect(near).not.toBeNull();
        expect([near!.action, near!.runnerUp].sort())
            .toEqual(['learn_technique', 'list_techniques']);
        expect(near!.score - near!.runnerUpScore).toBeLessThan(0.05);
    });
});

describe('and it is not a lower bar', () => {
    /**
     * The sentences the tier's own header records as the junk its two rules
     * exist to refuse. A collapse rule that admits any of them has stopped
     * being about collapsing.
     *
     * ASSERTED AGAINST THE RULE THIS FILE ADDED AND NOT AGAINST THE TIER AS A
     * WHOLE. The collapse can only ever change a sentence the daylight rule
     * REJECTED, so that is the condition each of these is checked under:
     * recompute the tier's own two figures, and where they fall short of
     * `SURE_ENOUGH_TO_ACT_ON` the answer must still be a refusal. Where they do
     * not fall short, the sentence was already being acted on before any of
     * this and belongs to whoever tunes the floor - `I am broke` reaches `eat`
     * that way, which is wrong and is somebody else's finding.
     */
    it.each([
        'I step back',
        'I am broke',
        'I nod',
        'I stand up',
        'what is stopping me'
    ])('still refuses to act on "%s" when the tier was unsure of it', async said => {
        const near = await nearestVerbByMeaning(said);
        expect(near).not.toBeNull();
        const sure = near!.score + CLEAR_AIR_COUNTS_FOR * (near!.score - near!.runnerUpScore);
        if (sure >= SURE_ENOUGH_TO_ACT_ON) return;
        expect(await routes(said), `${near!.action} ${near!.score} / ${near!.runnerUp}`)
            .toBe('unclear');
    });

    /**
     * AND A SENTENCE THAT COMMANDS A TRAINING IS STILL REFUSED WHEN THE TIER IS
     * UNSURE OF IT. `i train the flame palm` scores 0.748 against a floor of
     * 0.76 for anything that spends the player's life, and its runner-up is
     * `learn_technique`, which settles the same way it does. The collapse sits
     * BELOW that floor on purpose, so this stays a refusal.
     */
    it('does not let a collapse walk a training verb past the time floor', async () => {
        expect(await routes('i train the flame palm')).toBe('unclear');
    });
});
