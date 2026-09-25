/**
 * After a thing is taken off somebody, what they do depends on the person: some say nothing to
 * save face, some settle it themselves, some report it and it leaks. The owner: "depends on
 * personality", and a trait moves "what might happen" rather than deciding it.
 */
import { describe, expect, it } from 'vitest';

import { forStream } from '../../../src/engine/cultivation/rng.js';
import { reticenceOf } from '../../../src/engine/social-leverage/emotional-reticence.js';
import { faceOf } from '../../../src/engine/social-leverage/how-much-their-face-matters.js';
import { openHandednessOf } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { whatTheyDoAboutALoss } from '../../../src/engine/social-leverage/what-somebody-does-about-a-loss.js';

const ids = Array.from({ length: 400 }, (_, i) => `npc-${i}`);
const proud = ids.reduce((a, b) => (faceOf(b) > faceOf(a) ? b : a));
const shameless = ids.reduce((a, b) => (faceOf(b) < faceOf(a) ? b : a));

/** A thousand thefts off the same person, each on its own draw. */
function tally(theirId: string, houseId: string | null, canDo: 'warned' | 'injured') {
    const rng = forStream('loss-test', theirId);
    const counts = { says_nothing: 0, settles_it_themselves: 0, reports_it: 0, asTheyAre: 0 };
    for (let n = 0; n < 1000; n++) {
        const done = whatTheyDoAboutALoss({ theirId, houseId, canDo, rng });
        counts[done.then] += 1;
        if (!done.coverFirst) counts.asTheyAre += 1;
        expect(done.itLeaks).toBe(done.then === 'reports_it');
        expect(done.replacedFrom).toBe(done.then === 'reports_it' ? 'their_house' : 'whatever_is_to_hand');
        if (!done.coverFirst) expect(done.then).toBe('settles_it_themselves');
    }
    return counts;
}

describe('how much their face matters', () => {
    it('is fixed for a person and spread across people', () => {
        expect(faceOf('npc-7')).toBe(faceOf('npc-7'));
        expect(faceOf(proud)).toBeGreaterThan(0.5);
        expect(faceOf(shameless)).toBeLessThan(-0.5);
    });

    it('is its own trait, not a second reading of another', () => {
        const differs = (other: (id: string) => number) => ids.some(id => Math.sign(faceOf(id)) !== Math.sign(other(id)));
        expect(differs(openHandednessOf)).toBe(true);
        expect(differs(reticenceOf)).toBe(true);
    });
});

describe('what they do about the loss moves with the trait, and is not decided by it', () => {
    it('makes a report likelier the less their face matters, and possible for either', () => {
        const fromProud = tally(proud, 'house-1', 'injured');
        const fromShameless = tally(shameless, 'house-1', 'injured');
        expect(fromShameless.reports_it).toBeGreaterThan(fromProud.reports_it);
        expect(fromProud.says_nothing).toBeGreaterThan(fromShameless.says_nothing);
        expect(fromShameless.reports_it).toBeGreaterThan(0);
        expect(fromShameless.settles_it_themselves).toBeGreaterThan(0);
    });

    it('sends somebody with no face to lose after you as they are, and a proud one never', () => {
        expect(tally(shameless, 'house-1', 'injured').asTheyAre).toBeGreaterThan(0);
        expect(tally(proud, 'house-1', 'injured').asTheyAre).toBe(0);
    });

    it('has no report to make with no house to make it to', () => {
        expect(tally(shameless, null, 'injured').reports_it).toBe(0);
    });

    it('rarely has them come after somebody they cannot reach', () => {
        const cannot = tally(proud, 'house-1', 'warned');
        const can = tally(proud, 'house-1', 'injured');
        expect(cannot.settles_it_themselves).toBeLessThan(can.settles_it_themselves / 5);
    });
});
