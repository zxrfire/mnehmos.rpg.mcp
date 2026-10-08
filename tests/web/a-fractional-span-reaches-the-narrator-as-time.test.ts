/** Oct7 ordinary-fraction diagnostic: actual .125 day/native resource depletion
 * reached the narrator as '0 days passed', 'Broken off after 0 days' and
 * 'At the outset', despite three actual hours. humanDays and the event-offset
 * reader both rounded away the span. These emitter-boundary controls drain the
 * native precise held body with real hunger and one ration; the engine supplies
 * the actual depletion event/offset and body delta. No event or healing outcome
 * is invented. Facts and the final narrator input must retain .125/.0625 time,
 * while zero and integer-day wording stay intact. No model acceptance claimed.
 * Suggested red control removes only fractional humanDays and restores rounding
 * in howFarIn; tests must fail on the false zero duration/event chronology.
 */
import { describe, expect, it } from 'vitest';
import { simulateTimeSkipParts } from '../../src/engine/cultivation/time-skip.js';
import { makeCultivator } from '../engine/cultivation/fixtures.js';
import { skipEndState } from '../../src/server/consolidated/cultivation-support.js';
import { factsForTimeSkip, humanDays } from '../../src/web/facts.js';
import { composeNarrationUser } from '../../src/web/prompt.js';

function receipt(days: number, hungry = true) {
    const before = makeCultivator({ realmOrdinal: 0, satiety: hungry ? 0 : 100, hp: 30, maxHp: 30 });
    const parts = simulateTimeSkipParts(before, days, { seed: 'fractional-time-facts', locationId: 'room',
        locationDensity: .1, startDay: 0, turn: 0, randomEvents: false, autoBreakthrough: false,
        grainAbstinence: !hungry, rations: hungry ? 1 : 0, options: { focusMultiplier: 0 } },
        { preciseDays: true, nextBoundary: () => null });
    let next = parts.next();
    while (!next.done) next = parts.next();
    const skip = next.value;
    const after = { ...before, ...skipEndState(before, skip) };
    const facts = factsForTimeSkip(before, after, skip, 'normal', 'Waiting');
    const prompt = composeNarrationUser(facts, { place: 'the room', ambient: 'normal' });
    return { skip, facts, prompt };
}
describe('fractional native receipts retain their elapsed time in narration', () => {
    it.each([{ days: .125, words: '3 hours' }, { days: .0625, words: '1 hour 30 minutes' }])(
        'states the real $days-day resource interruption and event offset', ({ days, words }) => {
            const { skip, facts, prompt } = receipt(days);
            expect(skip.simulatedDays).toBe(days);
            expect(skip.interrupted).toBe(true);
            expect(skip.interruptReason).toBe('provisions_exhausted');
            const event = skip.events.find(row => row.kind === 'resource_depleted');
            expect(event).toBeDefined();
            expect(event!.dayOffset).toBe(days);
            expect(facts.headline).toContain('after ' + words);
            expect(facts.lines).toContain(words + ' passed as asked.');
            const eventLine = words + ' in: ' + event!.summary;
            expect(facts.lines).toContain(eventLine);
            expect(prompt).toContain(eventLine);
            expect(prompt).toContain(words + ' passed as asked.');
            expect(facts.required).toContain(eventLine);
            expect([facts.headline, ...facts.lines].join('\n')).not.toMatch(/(?:after |passed as asked\. )?0 days passed|after 0 days/);
            expect(facts.lines).not.toContain('At the outset: ' + event!.summary);
        });
    it('retains actual zero and whole-day/month/year terms', () => {
        const zero = receipt(0, false), day = receipt(1);
        expect(zero.skip.simulatedDays).toBe(0);
        expect(zero.facts.lines).toContain('0 days passed as asked.');
        const event = day.skip.events.find(row => row.kind === 'resource_depleted');
        expect(day.skip.simulatedDays).toBe(1);
        expect(event?.dayOffset).toBe(1);
        expect(day.facts.lines).toContain('The next day: ' + event!.summary);
        expect(day.facts.lines).toContain('1 day passed as asked.');
        expect(humanDays(18)).toBe('18 days');
        expect(humanDays(90)).toBe('3 months');
        expect(humanDays(3650)).toBe('10 years');
    });
    it('distinguishes a day plus a real fraction and a positive sub-minute span from zero', () => {
        expect(humanDays(1.125)).toBe('1 day 3 hours');
        expect(humanDays(30 / (24 * 60 * 60))).toBe('30 seconds');
        expect(humanDays(.00000001)).not.toMatch(/^0 /);
    });
});
