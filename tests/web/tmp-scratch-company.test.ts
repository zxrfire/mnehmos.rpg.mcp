import { describe, expect, it } from 'vitest';
import { requestPutToSomebody, baseWeightOf } from '../../src/web/what-a-request-asks-and-of-whom';
import { parseIntent } from '../../src/web/verb-pattern-table';

describe('scratch', () => {
    it('parses', () => {
        const lines = [
            'I ask Jiang Anyi to come with me',
            'I ask Jiang Anyi to come with me to the Salt Road',
            'I invite Jiang Anyi to travel with me for a month',
            'I ask her to join me',
            'come with me',
            'will you come with me to the Burial Sands',
            'I ask him to escort me to the market',
            'I beg her to come along',
            'I ask him to take me with him',
            'I ask her to join me for a drink',
            'I ask him to teach me the Iron Bell Manual',
            'I ask him to promote me',
            'I travel with her to the ruins',
            'I go with him'
        ];
        for (const line of lines) {
            const parsed = requestPutToSomebody(line);
            const plan = parseIntent(line);
            console.log(
                JSON.stringify(line),
                '->', parsed ? `${parsed.kind}/${parsed.person}/${parsed.object ?? ''}` : 'null',
                '|| plan:', JSON.stringify(plan)
            );
        }
        expect(baseWeightOf('company')).toBe('a_real_favour');
    });
});
