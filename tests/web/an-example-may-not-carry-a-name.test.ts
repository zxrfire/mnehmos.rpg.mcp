/**
 * The worked examples in the narration prompt must carry no proper noun.
 *
 * Every name in this game is granted per run by `NAMES YOU MAY USE`, which is
 * built from what that cultivator has actually been told. An example sentence
 * is in the prompt on EVERY turn of EVERY run, so a name inside one is a name
 * in the prompt of a player who never heard it - and the model has been told
 * it may write anything the prompt names.
 *
 * Found by `discovery.test.ts`, which reads the knowledge table and caught two
 * sects the examples had hardcoded. It only knows about sects; a manual and a
 * family surname went past it in the same edit. This covers the rest by
 * shape rather than by list.
 */
import { describe, expect, it } from 'vitest';

import { composeNarrationUser } from '../../src/web/prompt.js';

/** Forms of address and sentence openers, which are capitals and not names. */
const NOT_A_NAME = new Set([
    'Fellow Daoist', 'Senior', 'Junior', 'Elder Brother', 'Elder Sister',
    'And', 'But', 'Eight', 'Eleven', 'Fifteen', 'Forty', 'Hah', 'Last', 'Millet',
    'Nine', 'No', 'Nobody', 'Only', 'That', 'The', 'Then', 'There', 'They',
    'Think', 'Three', 'Twenty', 'Two', 'We', 'What', 'Where', 'You', 'Your', 'It',
    'He', 'She', 'His', 'Her', 'Cold', 'Something', 'Beside', 'Down', 'Higher',
    'In', 'At', 'On', 'Of', 'For', 'If', 'Or', 'So', 'A', 'An', 'This', 'These', 'Its'
]);

describe('an example sentence may not carry a name', () => {
    it('has no proper noun in any worked example', () => {
        const prompt = composeNarrationUser(
            { lines: ['Nothing happened.'] } as never,
            { place: 'Nowhere', ambient: 'thin' } as never,
            { ambientIsNews: false }
        );
        const start = prompt.indexOf('SHAPES TO VARY');
        const end = prompt.indexOf('FIVE THINGS, CHECKED');
        expect(start, 'the examples block is in the prompt').toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);

        const examples = prompt.slice(start, end)
            .split('\n')
            .filter(line => line.startsWith('    ') || line.startsWith('       '));
        expect(examples.length, 'there are worked examples to check').toBeGreaterThan(10);

        const found: string[] = [];
        for (const line of examples) {
            // A capital that is not the first word of a sentence is the tell.
            for (const [word] of line.matchAll(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b/g)) {
                if (NOT_A_NAME.has(word)) continue;
                found.push(`${word}  <-  ${line.trim()}`);
            }
        }
        expect(found, `a worked example names something:\n${found.join('\n')}`).toEqual([]);
    });
});
