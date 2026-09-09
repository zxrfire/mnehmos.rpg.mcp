/**
 * The engine may say what it found. It may not read out how it marked.
 *
 * FOUND BY PLAYING. Studying a manual put this in front of the player:
 *
 *     It reads as suited for this body at Qi Condensation Layer 1, judged on
 *     2 axises: reach match, element match.
 *
 * The design owner: *"this is not great. this is tell not show."*
 *
 * Wrong twice. It recited the SCORING PROCEDURE - how many axes were consulted
 * and what each returned - which is the engine reading its own marking scheme
 * aloud in a channel the player reads. And in doing so it threw away the one
 * thing worth printing: every `FitAxis` already carries an engine-authored
 * factual `note` saying what it FOUND. "It is written for wood, which is what
 * this cultivator draws" is a fact somebody can act on. "element match" is a
 * column heading.
 *
 * `structure` is the mechanical channel and it is shown to the player in every
 * mode, so "mechanical" has never meant "may be unreadable". It means the fact
 * without the mood - not the fact replaced by its own arithmetic.
 */

import { describe, it, expect } from 'vitest';

import { assessFit } from '../../src/engine/encounters/suitability';

/**
 * Vocabulary that only appears when a marking scheme is being described rather
 * than a finding reported.
 */
const A_MARKING_SCHEME = [
    /\bjudged on\b/i,
    /\bscored on\b/i,
    /\baxis\b/i,
    /\baxes\b/i,
    /\baxises\b/i,
    /\bverdict\b/i,
    /\b(?:match|miss|unknown)\s*(?:,|\.|$)/i
];

describe('what a fit reading puts in front of a player', () => {
    /**
     * Every axis note, over every shape of find the assessor produces, has to
     * be a sentence about the world. This is the property that was violated:
     * the notes were fine and were not being used.
     */
    it('carries a factual note on every axis it reports', () => {
        const finds = [
            { gradeOrdinal: 1, elements: ['wood'], kind: 'manual' as const },
            { gradeOrdinal: 1, elements: ['fire'], kind: 'manual' as const },
            { gradeOrdinal: 30, elements: [], kind: 'manual' as const },
            { gradeOrdinal: 1, elements: [], kind: 'manual' as const }
        ];
        const seekers = [
            { ordinal: 1, elements: ['wood'] },
            { ordinal: 1, elements: [] },
            { ordinal: 40, elements: ['metal'] }
        ];
        let seen = 0;
        for (const find of finds) {
            for (const seeker of seekers) {
                const fit = assessFit(find as never, seeker as never);
                expect(fit.axes.length).toBeGreaterThan(0);
                for (const axis of fit.axes) {
                    seen++;
                    // A note is a sentence, not a label.
                    expect(axis.note.length, `${axis.axis} note`).toBeGreaterThan(15);
                    expect(axis.note.trim(), `${axis.axis} note`).toMatch(/[.!?]$/);
                    for (const pattern of A_MARKING_SCHEME) {
                        expect(axis.note, `${axis.axis}: ${axis.note}`).not.toMatch(pattern);
                    }
                }
            }
        }
        expect(seen).toBeGreaterThan(20);
    });

    it('says what the element finding actually was, in words', () => {
        const drawn = assessFit(
            { gradeOrdinal: 1, elements: ['wood'], kind: 'manual' } as never,
            { ordinal: 1, elements: ['wood'] } as never
        );
        expect(drawn.axes.find(a => a.axis === 'element')!.note)
            .toMatch(/written for wood, which is what this cultivator draws/);

        const missed = assessFit(
            { gradeOrdinal: 1, elements: ['fire'], kind: 'manual' } as never,
            { ordinal: 1, elements: ['wood'] } as never
        );
        expect(missed.axes.find(a => a.axis === 'element')!.note)
            .toMatch(/written for fire\. This cultivator draws wood\./);
    });

    /**
     * AND THE LINE THE NARRATOR IS HANDED IS A SENTENCE TOO.
     *
     * `line` goes into `facts.lines`, which is the only channel that reaches a
     * model. A rubric there would come back as prose about a rubric.
     */
    it('hands the narrator a sentence rather than a scoring summary', () => {
        const fit = assessFit(
            { gradeOrdinal: 1, elements: ['wood'], kind: 'manual' } as never,
            { ordinal: 1, elements: ['wood'] } as never
        );
        expect(fit.line.length).toBeGreaterThan(20);
        for (const pattern of A_MARKING_SCHEME) {
            expect(fit.line, fit.line).not.toMatch(pattern);
        }
    });
});
