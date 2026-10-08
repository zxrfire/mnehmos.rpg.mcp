/**
 * 2026-10-03 actual vault force binding existed, but the canonical model-facing
 * destroy description still offered only held things and claimed no time;
 * deterministic breaking nouns omitted doors and locks. A typed physical attempt
 * could miss an installed authority. These are routing/reference controls only:
 * they neither grant strength/access nor prove that a vault actually breaks.
 * The existing reference read binds one previously named thing and drops absent
 * or ambiguous targets. It cannot invent a nearest door for “break it down”.
 * Person seals/cultivation and ward destruction keep their existing meanings.
 * Baseline gave 2 failures and 1 pass; the repaired parser passed all 3
 * (integration-full-topic-and-door-routing-green-20261003-01.log). Active
 * model lane routing is separately checked with the native vault controls.
 */
import { expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import type { PlanWithSteps } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { resolvingAgainstTheLastTurn, type WhatTheLastTurnDid } from '../../src/web/last-turn-memory.js';

it('ordinary door and lock names reach destruction with their complete physical target', () => {
    for (const target of ['the door of Copper Archive', 'the lock on Cloud Treasury']) {
        expect(parseIntent('I break ' + target)).toMatchObject({ action: 'destroy', target: target.replace(/^the /, '') });
    }
});
it('break it down uses the existing unique prior reference, never a guessed door', () => {
    const input = 'I break it down.';
    const action = parseIntent(input);
    const plan: PlanWithSteps = { action, source: 'model' };
    expect(action).toMatchObject({ action: 'destroy', target: 'it' });
    const memory = (names: string[]): WhatTheLastTurnDid => ({ runId: 'run', cultivatorId: 'cult', onTurn: 4,
        outcome: 'executed', acts: [], named: names.map(name => ({ name })) });
    const one = resolvingAgainstTheLastTurn(plan,
        memory(['the door of Copper Archive']), input);
    expect(one.plan.action).toMatchObject({ action: 'destroy', target: 'the door of Copper Archive' });
    for (const names of [[], ['the door of Copper Archive', 'the lock on Cloud Treasury']]) {
        const unresolved = resolvingAgainstTheLastTurn(plan, memory(names), input);
        expect(unresolved.plan.action.action).toBe('destroy');
        expect(unresolved.plan.action.target).toBeUndefined();
    }
});
it('door nouns do not reroute person seals, cultivation or information into physical destruction', () => {
    for (const input of ['I break his neck', 'I break through to the next realm',
        'I break the seal on her cultivation', 'Could you break it down for me?']) {
        expect(parseIntent(input).action, input).not.toBe('destroy');
    }
    expect(parseIntent('I break the ward').action).toBe('destroy');
});
