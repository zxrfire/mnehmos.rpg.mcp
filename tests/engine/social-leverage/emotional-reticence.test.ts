/**
 * Whether somebody lets it show, and the property that makes it worth having.
 *
 * The design owner: *"maybe they say nothing and are stoic, maybe they are
 * emotional."* Two people meeting the same event have to be able to answer it
 * differently, and the axis that decides which must not be a second reading of
 * an axis the world already has - otherwise every scene's speech is predictable
 * from its economics, and the variation is a costume rather than a fact.
 *
 * So the load-bearing case is the correlation against open-handedness, measured
 * over the real member catalog. Everything else here is the ordinary shape:
 * deterministic, total, and both tails populated.
 */

import { describe, it, expect } from 'vitest';

import {
    reticenceOf,
    howMuchTheyLetShow,
    RETICENCE_BANDS
} from '../../../src/engine/social-leverage/emotional-reticence';
import {
    openHandednessOf
} from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';
import { MEMBERS } from '../../../src/data/cultivation/members';

const mean = (xs: readonly number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

function correlation(xs: readonly number[], ys: readonly number[]): number {
    const mx = mean(xs);
    const my = mean(ys);
    let top = 0;
    let left = 0;
    let right = 0;
    for (let i = 0; i < xs.length; i++) {
        top += (xs[i] - mx) * (ys[i] - my);
        left += (xs[i] - mx) ** 2;
        right += (ys[i] - my) ** 2;
    }
    return left === 0 || right === 0 ? 0 : top / Math.sqrt(left * right);
}

describe('how much a person lets show', () => {
    it('is the same answer every time it is asked', () => {
        expect(reticenceOf('npc-member-yan-shuling'))
            .toBe(reticenceOf('npc-member-yan-shuling'));
        expect(reticenceOf('a')).not.toBe(reticenceOf('b'));
    });

    it('answers for a body the world has never seen, and never throws', () => {
        expect(reticenceOf('')).toBe(0);
        expect(reticenceOf('   ')).toBe(0);
        expect(Number.isFinite(reticenceOf('a person invented in a test'))).toBe(true);
    });

    it('stays inside the scale', () => {
        for (const member of MEMBERS) {
            const value = reticenceOf(member.id);
            expect(value).toBeGreaterThanOrEqual(-1);
            expect(value).toBeLessThanOrEqual(1);
        }
    });
});

describe('and it is not a second reading of how freely they part with things', () => {
    it('correlates with open-handedness at nothing, over the real catalog', () => {
        const ids = MEMBERS.map(member => member.id);
        const r = correlation(ids.map(reticenceOf), ids.map(openHandednessOf));
        expect(Math.abs(r)).toBeLessThan(0.2);
    });

    it('puts generous silent people and grasping loud ones in the world', () => {
        const ids = MEMBERS.map(member => member.id);
        const generousAndSilent = ids.filter(id =>
            openHandednessOf(id) >= 0.4 && reticenceOf(id) >= 0.4).length;
        const graspingAndLoud = ids.filter(id =>
            openHandednessOf(id) <= -0.4 && reticenceOf(id) <= -0.4).length;
        expect(generousAndSilent).toBeGreaterThan(0);
        expect(graspingAndLoud).toBeGreaterThan(0);
    });
});

describe('the sentence it produces', () => {
    it('says nothing at all about most people', () => {
        const ids = MEMBERS.map(member => member.id);
        const said = ids.filter(id => howMuchTheyLetShow(reticenceOf(id)) !== null).length;
        expect(said).toBeLessThan(ids.length / 2);
        expect(said).toBeGreaterThan(0);
    });

    it('reaches both ends, and they are different sentences', () => {
        const stoic = howMuchTheyLetShow(RETICENCE_BANDS.MARKED);
        const raw = howMuchTheyLetShow(-RETICENCE_BANDS.MARKED);
        expect(stoic).not.toBeNull();
        expect(raw).not.toBeNull();
        expect(stoic).not.toBe(raw);
        expect(howMuchTheyLetShow(0)).toBeNull();
    });

    it('names no axis a later enum could be hung off', () => {
        for (const value of [-1, -0.8, -0.5, 0, 0.5, 0.8, 1]) {
            const said = howMuchTheyLetShow(value);
            if (said === null) continue;
            expect(said).not.toMatch(/stoic|emotional/i);
        }
    });

    it('survives a value that is not a number', () => {
        expect(howMuchTheyLetShow(Number.NaN)).toBeNull();
    });
});
