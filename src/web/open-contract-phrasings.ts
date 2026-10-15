/** The fallback reads declared terms, never whether a promise was fulfilled. */
import type { PlannedAction } from './planned-action.js';

export function openContractSaid(raw: string): PlannedAction | null {
    if (!/\bcontract\b/i.test(raw) || !/\bI owe\b/i.test(raw) && /\b(?:beast|mission|bounty|board|wall|posted)\b/i.test(raw)
        || !/\b(?:offer|make|enter|agree|accept|decline|refuse|sign|swear)\b/i.test(raw)) return null;
    if (/\b(?:accept|agree|decline|refuse)\b/i.test(raw.split(/[:;]/)[0]!))
        return { action: 'oath', intent: /\b(?:decline|refuse)\b/i.test(raw) ? 'contract_decline' : 'contract_accept' };
    const target = /\b(?:with|to)\s+(.+?)(?=[:;]|\s+(?:by|bound|binding)\b|$)/i.exec(raw)?.[1]?.trim();
    const yourTerms = /\bI owe\s+(.+?)(?=;|$)/i.exec(raw)?.[1];
    const theirTerms = /\b(?:they|you|he|she) owe(?:s)?\s+(.+?)(?=;|$)/i.exec(raw)?.[1];
    const endCondition = /\b(?:ends when|until)\s+(.+?)(?=;|$)/i.exec(raw)?.[1];
    const binding = /\b(?:slave seal|soul contract)\b/i.test(raw) ? 'slave' : /\bdao\b/i.test(raw) ? 'dao'
        : /\bblood\b/i.test(raw) ? 'blood' : 'word';
    const days = /\bfor\s+(\d+(?:\.\d+)?)\s+days?\b/i.exec(raw)?.[1];
    return { action: 'oath', intent: 'contract_offer', target,
        ...(yourTerms && theirTerms && endCondition ? { contract: { yourTerms, theirTerms, endCondition, binding,
            ...(days ? { days: Number(days) } : {}),
            ...(binding === 'slave' ? { bound: /\b(?:seal me|I am bound|I serve)\b/i.test(raw) ? 'you' as const : 'them' as const } : {}) } } : {}) };
}
