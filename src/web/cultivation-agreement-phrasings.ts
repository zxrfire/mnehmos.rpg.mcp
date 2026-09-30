import type { PlannedAction } from './planned-action.js';

export function cultivationAgreementSaid(input: string): PlannedAction | null {
    const offered = /^(?:i\s+)?(?:offer myself|willingly offer myself)\s+as\s+(?:a |your |their )?(?:cultivation )?furnace\s+to\s+(.+?)[.!]?$/i.exec(input.trim());
    if (offered) return { action: 'cultivate', intent: 'offered_self', target: offered[1] };
    const rite = /^(?:i\s+)?(?:ask|invite)\s+(.+?)\s+to\s+(?:willingly\s+)?(?:offer|be)\s+(?:themselves as |my |a )?(?:cultivation )?furnace[.!]?$/i.exec(input.trim());
    if (rite) return { action: 'cultivate', intent: 'offered', target: rite[1] };
    const bond = /^(?:i\s+)?(?:make|swear|form|end|terminate|break)\s+(?:a |the |my )?beast cultivation contract\s+with\s+(.+?)(?:\s+sharing\s+(\d+)%\s+of\s+(?:my |the )?qi)?[.!]?$/i.exec(input.trim());
    if (bond) return { action: 'oath', intent: /\b(?:end|terminate|break)\b/i.test(input) ? 'end_beast_contract' : 'beast_contract',
        target: bond[1], topic: bond[2] ?? '25' };
    return null;
}
