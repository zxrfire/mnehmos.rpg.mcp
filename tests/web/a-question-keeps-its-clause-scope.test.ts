/** The methodless-sitting fix exposed a reader defect: removing a trailing
 * question mark while reading the first clause turned a question into years.
 * Question scope belongs to the utterance; actual requested sequences remain. */
import { expect, it } from 'vitest';
import { theClausesOf, theWholeSentenceAsAPlan } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { DeterministicNarrator } from '../../src/web/narrator.js';
import { costsTheAskerNothing } from '../../src/web/asking-is-not-doing.js';

for (const said of [
    'I seclude ten years and nobody finds me?',
    'I sit here a hundred years and stay whole?',
    'I cultivate for a month and I stay whole?'
]) it(`keeps the closing question in the complete read: ${said}`, async () => {
    expect(theClausesOf(said)).toEqual([said]);
    const read = await new DeterministicNarrator().plan(said);
    expect(costsTheAskerNothing(read.action)).toBe(true);
    expect(read.steps?.every(step => costsTheAskerNothing(step.action)) ?? true).toBe(true);
});

it('retains a real request after a question and both real long acts', () => {
    expect(theClausesOf('Can I sit and cultivate here? Then I walk to the village')).toEqual([
        'Can I sit and cultivate here?', 'I walk to the village'
    ]);
    expect(theClausesOf('I meditate for a month and then walk to the village')).toEqual([
        'I meditate for a month', 'walk to the village'
    ]);
    expect(theClausesOf('I meditate for a month; nobody finds me?')).toEqual([
        'I meditate for a month', 'nobody finds me?'
    ]);
    expect(theClausesOf('go to the landing and wait?', [], true)).toEqual([
        'go to the landing', 'wait?'
    ]);
});

it('retains independently interpreted acts when a reader supplies them', async () => {
    // A closing question can belong to the final exchange in a model-read plan.
    // Keeping native question scope must not become an executor punctuation gate.
    const steps = [
        { action: { action: 'move' as const, target: 'the landing' }, said: 'I go to the landing' },
        { action: { action: 'interact' as const, intent: 'talk', target: 'the clerk', topic: 'What runs today?' }, said: 'ask what runs today?' }
    ];
    const read = await theWholeSentenceAsAPlan('I go to the landing and ask what runs today?', steps,
        async () => ({ action: 'unclear' }));
    expect(read.steps).toEqual(steps);
});
