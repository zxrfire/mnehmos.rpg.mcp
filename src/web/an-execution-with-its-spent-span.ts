/** Preserve actual preparatory/lesser span receipts through their enclosing act. */
import type { Execution } from './turn-wire-shapes.js';
import { foldTheCallsIntoOneTurn } from './a-sentence-can-be-more-than-one-call.js';

export function executionWithItsSpentSpan(first: Execution, second: Execution,
    ruling: Execution): Execution {
    return { ...ruling,
        ...foldTheCallsIntoOneTurn([first, second], ruling.facts.headline),
        outcome: ruling.outcome,
        cutShort: ruling.cutShort ?? first.cutShort ?? second.cutShort,
        timeDisposition: ruling.timeDisposition,
        nights: ruling.nights ?? first.nights ?? second.nights };
}
