/** Content must never require another oath cause. Each agreed promise has one existing
 * oath row; legacy causes retain their original binding and arbitrary ending prose is not an outcome. */
import { describe, it, expect } from 'vitest';
import { agreeOpenContract, bindingOf, endingOf, endContractIfDue } from '../../../src/engine/social/open-contracts.js';
import { createObligation } from '../../../src/engine/social/grudges.js';
const offer = { firstId: 'one', secondId: 'two', firstTerms: 'Keep the eastern cloud red.',
    secondTerms: 'Name every mountain after our children.', binding: 'word' as const,
    end: { condition: 'When the third moon falls.' }, day: 4, eventId: 'said', firstConsents: true, secondConsents: true };
describe('open terms on existing oaths', () => {
    it('keeps both promises literally without a new cause', () => {
        const words = agreeOpenContract(offer);
        expect(words.map(word => word.terms)).toEqual([offer.firstTerms, offer.secondTerms]);
        expect(words.every(word => word.kind === 'oath' && word.cause === 'other')).toBe(true);
        expect(endingOf(words[0]).condition).toBe(offer.end.condition);
        expect(endContractIfDue(words[0], 10000, () => true)).toBe(words[0]);
    });
    it('binds neither person without both answers', () => {
        expect(agreeOpenContract({ ...offer, firstConsents: false })).toEqual([]);
        expect(agreeOpenContract({ ...offer, secondConsents: false })).toEqual([]);
    });
    it('ends a real dated term or a service until death from engine facts', () => {
        const word = agreeOpenContract({ ...offer, dueOnDay: 14 })[0];
        expect(endContractIfDue(word, 13, () => true).status).toBe('open');
        expect(endContractIfDue(word, 14, () => true).status).toBe('settled');
        const service = agreeOpenContract({ ...offer, binding: 'slave', end: { condition: 'Until my death.', untilDeathOf: 'one' } })[0];
        expect(endContractIfDue(service, 10, () => true).status).toBe('open');
        expect(endContractIfDue(service, 10, id => id !== 'one').status).toBe('settled');
    });
    it('reads legacy oath bindings without changing their rows', () => {
        for (const [cause, subjectId, binding] of [['service_term', 'person', 'word'], ['blood_pact', 'person', 'blood'],
            ['silence', 'house-vermilion-seal', 'dao'], ['sworn_brotherhood', 'person', 'word']] as const) {
            const word = createObligation({ kind: 'oath', holderId: 'me', subjectId, cause, severity: 'serious', onDay: 0, description: cause });
            expect(bindingOf(word)).toBe(binding);
            expect(word.tags).toEqual([]);
        }
    });
});
