import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';

const SENTENCES = [
    'whose art is that',
    'do I recognise this style',
    'would they recognise the art I am using',
    'can anybody here place my style',
    'does my form give away where I trained',
    'would anyone here recognise my technique',
    'can they tell whose art I am using',
    'does my style give me away',
    'would the Azure Cloud Pavilion recognise their own art on me',
    'who here can place my art'
];

describe('probe', () => {
    it('prints', () => {
        for (const s of SENTENCES) {
            const plan = parseIntent(s) as Record<string, unknown>;
            console.log(JSON.stringify({ s, plan }));
        }
        expect(true).toBe(true);
    });
});
