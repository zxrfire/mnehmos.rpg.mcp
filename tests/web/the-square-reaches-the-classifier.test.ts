/**
 * The classifier is shown who is standing here.
 *
 * Written against a played defect: "I kill everyone here" read correctly as
 * `attack` and then resolved to nobody, while nine people stood in the square,
 * because the phase-1 prompt carried every name in the cultivator's world and
 * no mark on which of them were in front of them. A model cannot expand a
 * quantifier over a set it was never shown.
 *
 * What is pinned here is the SHOWING, not the model's reading of it. What a
 * model does with the square is the model's business and the engine still rules
 * on it; what must not happen again is the square being withheld.
 */
import { describe, expect, it } from 'vitest';

import { composeStateSummary, describeWhoIsHere } from '../../src/web/prompt';
import type { Company } from '../../src/web/facts';
import { makeGameInWorld } from './harness';

const WORLD = 'probe-world';

describe('who is standing here', () => {
    it('names the people the cultivator can name', () => {
        const company: Company = {
            named: [
                { name: 'Han Cikuan', ordinal: 9, sex: 'male', age: 61, rank: 'Sword Elder' },
                { name: 'He Cihe', ordinal: 3, sex: 'female', age: 22, rank: null }
            ],
            strangers: [],
            total: 2
        };
        const lines = describeWhoIsHere(company, 6).join('\n');

        expect(lines).toContain('Han Cikuan');
        expect(lines).toContain('3 rungs above them');
        expect(lines).toContain('He Cihe');
        expect(lines).toContain('3 rungs below them');
        expect(lines).toContain('2 people here in total');
    });

    /**
     * The design owner, on why resolving a description is only half of it:
     * *this should fall out of making names but also characteristics visible to
     * the LLM*. A reader shown only names can only write a name, so every
     * sentence that picks somebody out by what they are was one the phase-1
     * reader had no grounds to produce.
     */
    it('shows what a description reads, and says a description may be written', () => {
        const lines = describeWhoIsHere({
            named: [{ name: 'Han Cikuan', ordinal: 9, sex: 'male', age: 61, rank: 'Sword Elder' }],
            strangers: [],
            total: 1
        }, 6).join(String.fromCharCode(10));

        expect(lines).toContain('male');
        expect(lines).toContain('about 61');
        expect(lines).toContain('Sword Elder');
        expect(lines).toContain('DESCRIPTION');
    });

    it('counts a stranger at a height and never gives them a name', () => {
        const company: Company = {
            named: [],
            strangers: [{ ordinal: 9 }, { ordinal: 6 }, { ordinal: 1 }],
            total: 3
        };
        const lines = describeWhoIsHere(company, 6).join('\n');

        expect(lines).toContain('1 above them');
        expect(lines).toContain('1 level with them');
        expect(lines).toContain('1 below them');
        // The whole point of the count: they are reachable without a name.
        expect(lines).toContain('pointed at');
    });

    it('says an empty square is empty rather than saying nothing', () => {
        const lines = describeWhoIsHere({ named: [], strangers: [], total: 0 }, 6).join('\n');
        expect(lines).toContain('alone here');
    });

    it('states what it cut rather than reading complete', () => {
        const many = Array.from({ length: 20 }, (_, i) => ({
            name: `Person ${i}`, ordinal: 5, sex: 'female', age: 30, rank: null
        }));
        const lines = describeWhoIsHere({ named: many, strangers: [], total: 20 }, 6).join('\n');

        expect(lines).toContain('8 more this cultivator can name');
        expect(lines).toContain('20 people here in total');
    });
});

describe('the square in the real phase-1 prompt', () => {
    it('carries the people who are actually in front of the player', async () => {
        const { game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');

        const company = game.company(cultivator);
        const summary = composeStateSummary({
            cultivator,
            run: game.state().run as never,
            ambient: 'thin',
            present: company
        });

        expect(summary).toContain('STANDING HERE');
        // The square this world puts a fresh cultivator in is not empty, and if
        // it ever becomes empty this test should be told rather than pass.
        expect(company.total).toBeGreaterThan(0);
        expect(summary).toContain(`${company.total} people here in total`);
        for (const person of company.named) expect(summary).toContain(person.name);
    }, 120_000);
});
