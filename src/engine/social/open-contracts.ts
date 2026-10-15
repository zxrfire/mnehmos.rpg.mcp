/** Content is open; the way a word binds is not. All terms live on existing oath rows. */
import { createObligation, settleObligation, type ObligationRecord, type OathCause } from './grudges.js';
import { stableId } from './common.js';

export type ContractBinding = 'word' | 'dao' | 'blood' | 'slave';
export interface ContractEnd {
    /** Literal ending condition; arbitrary prose never asserts that it has happened. */
    condition: string;
    untilDeathOf?: string;
}
const BINDING = 'contract-binding:';
const END = 'contract-end:';
const PAIR = 'contract-pair:';

/** Legacy words are ordinary instances, with their original enforcement preserved. */
export function bindingOf(word: ObligationRecord): ContractBinding {
    const binding = word.tags.find(tag => tag.startsWith(BINDING))?.slice(BINDING.length);
    if (binding === 'dao' || binding === 'blood' || binding === 'slave') return binding;
    if (word.subjectId === 'house-vermilion-seal') return 'dao';
    return word.cause === 'blood_pact' ? 'blood' : 'word';
}

export function endingOf(word: ObligationRecord): ContractEnd {
    const raw = word.tags.find(tag => tag.startsWith(END))?.slice(END.length);
    if (raw) {
        try { return JSON.parse(raw) as ContractEnd; } catch { /* Legacy words have no structured ending. */ }
    }
    return { condition: 'Fulfilment or release by the person owed the word.' };
}

export function contractPairOf(word: ObligationRecord): string | null {
    return word.tags.find(tag => tag.startsWith(PAIR))?.slice(PAIR.length) ?? null;
}

/** Both consent decisions precede this writer. Each person carries their own promise, once. */
export function agreeOpenContract(input: {
    firstId: string; secondId: string; firstTerms: string; secondTerms: string;
    firstConsents: boolean; secondConsents: boolean; binding: ContractBinding;
    end: ContractEnd; day: number; dueOnDay?: number | null; cause?: OathCause;
    eventId: string;
}): ObligationRecord[] {
    if (!input.firstConsents || !input.secondConsents || input.firstId === input.secondId
        || !input.firstTerms.trim() || !input.secondTerms.trim() || !input.end.condition.trim()) return [];
    const pair = stableId('contract', input.firstId, input.secondId, input.eventId);
    const tags = [`${PAIR}${pair}`, `${BINDING}${input.binding}`, `${END}${JSON.stringify(input.end)}`];
    return [[input.firstId, input.secondId, input.firstTerms], [input.secondId, input.firstId, input.secondTerms]]
        .map(([holderId, subjectId, terms]) => createObligation({
            id: `${pair}:${holderId}`, kind: 'oath', holderId, subjectId,
            cause: input.cause ?? (input.binding === 'blood' ? 'blood_pact' : 'other'),
            severity: 'serious', onDay: input.day, triggeringEventId: input.eventId,
            description: 'Agreed personal contract.', terms, tags,
            dueOnDay: input.dueOnDay ?? null
        }));
}

/** Only engine facts end a term automatically. Other conditions need an actual fulfilment/release act. */
export function endContractIfDue(word: ObligationRecord, day: number,
    alive: (id: string) => boolean): ObligationRecord {
    if (word.kind !== 'oath' || word.status !== 'open' || !contractPairOf(word)) return word;
    const end = endingOf(word);
    if (!(word.dueOnDay !== null && day >= word.dueOnDay)
        && !(end.untilDeathOf && !alive(end.untilDeathOf))) return word;
    return settleObligation(word, { resolution: 'oath_fulfilled', onDay: word.dueOnDay !== null && day >= word.dueOnDay ? word.dueOnDay : day,
        note: end.condition });
}
