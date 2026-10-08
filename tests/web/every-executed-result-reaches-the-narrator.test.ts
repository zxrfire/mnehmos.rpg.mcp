/**
 * One sentence may contain several actual spans and conversations. After the
 * sentence caps were retired, the fold still kept its first scalar result:
 * two month rulings were deduplicated to one, a later automatic rank grant
 * could be audited as invented, and only the first hearing received its
 * addressed/overheard dialogue instructions. State and knowledge were already
 * correct; their transient presentation was incomplete.
 *
 * These boundary controls use actual fact builders and the actual narration
 * audit. The scalar-only arm runs beside the complete arm: it must reject the
 * same faithful advancement and omit the second hearing directive. Static
 * gate answers still deduplicate; legacy single-result callers remain intact.
 */
import { describe, expect, it } from 'vitest';
import { TimeSkipResultSchema } from '../../src/schema/cultivation';
import { foldTheCallsIntoOneTurn } from '../../src/web/a-sentence-can-be-more-than-one-call';
import { factsForTimeSkip, observable } from '../../src/web/facts';
import { composeNarrationUser } from '../../src/web/prompt';
import { auditNarration } from '../../src/web/narrator';
import { siteVerbs } from '../../src/web/site-verbs';
import { addHearing } from '../../src/web/tool-result-prose';
import type { Hearing } from '../../src/web/hearsay';
import type { Execution } from '../../src/web/turn-wire-shapes';
import type { GameService } from '../../src/web/game';
import { makeCultivator } from '../engine/cultivation/fixtures';

describe('all executed results reach narration', () => {
    it('retains both lived months and permits a later automatic rank grant', () => {
        const before = makeCultivator({ realmOrdinal: 0 });
        const middle = makeCultivator({ ...before, age: before.age + 30 / 365 });
        const after = makeCultivator({ ...middle, realmOrdinal: 1, age: middle.age + 30 / 365 });
        const first = TimeSkipResultSchema.parse({ requestedDays: 30, simulatedDays: 30, deltas: {} });
        const second = TimeSkipResultSchema.parse({ requestedDays: 30, simulatedDays: 30, deltas: { realmOrdinal: 1 } });
        const span = (skip: typeof first, from: typeof before, to: typeof before): Execution => ({
            facts: factsForTimeSkip(from, to, skip, 'normal', 'Waiting'), events: [],
            timeSkip: skip, breakthrough: null, outcome: 'executed', calls: []
        });
        const folded = foldTheCallsIntoOneTurn([span(first, before, middle), span(second, middle, after)]);
        const elapsed = factsForTimeSkip(before, middle, first, 'normal', 'Waiting').lines[1]!;
        expect(folded.facts.lines.filter(line => line === elapsed)).toHaveLength(2);
        expect(folded.timeSkip).toBe(first);
        expect(folded.timeSkips?.reduce((days, skip) => days + skip.simulatedDays, 0)).toBe(60);
        const receiver = { currentRun: () => ({ cultivator: after }), namedAndNotHeld: () => [] } as unknown as GameService;
        const filed = siteVerbs.filedOutcome.call(receiver, folded);
        expect(filed.ranksGained).toBe(1);
        expect(filed.died).toBe(false);
        const prose = 'You broke through to Qi Condensation Layer 2.';
        expect(auditNarration(prose, filed).map(problem => problem.kind)).not.toContain('invented_breakthrough');
        const scalarOnly = siteVerbs.filedOutcome.call(receiver, { ...folded, timeSkips: undefined, breakthroughs: undefined });
        expect(auditNarration(prose, scalarOnly).map(problem => problem.kind)).toContain('invented_breakthrough');
        const prompt = composeNarrationUser(folded.facts, { place: 'the cave', ambient: 'normal', filed });
        expect(prompt.split(`- ${elapsed}`).length - 1).toBe(2);
    });

    it('keeps addressed and later overheard dialogue instructions through a nested fold', () => {
        const told: Hearing = { mode: 'told', speaker: 'the keeper', names: [{ kind: 'place', id: 'first', name: 'First Crossing' }], note: 'said to you', confidence: 1, sourceKind: 'told' };
        const overheard: Hearing = { mode: 'overheard', speaker: null, names: [{ kind: 'place', id: 'second', name: 'Second Crossing' }], note: 'behind a wall', confidence: 1, sourceKind: 'overheard' };
        const hearing = (heard: Hearing): Execution => {
            const facts = observable('A name was said.', [], '');
            addHearing(facts, heard);
            return { facts, events: [], timeSkip: null, breakthrough: null, hearing: heard, outcome: 'executed', calls: [] };
        };
        const staticRead: Execution = { facts: observable('The gate answers.', ['The board is inside.'], 'The board is inside.'), events: [], timeSkip: null, breakthrough: null, outcome: 'executed', calls: [] };
        const folded = foldTheCallsIntoOneTurn([foldTheCallsIntoOneTurn([hearing(told), staticRead]), hearing(overheard), staticRead]);
        expect(folded.hearing).toBe(told);
        expect(folded.facts.lines.filter(line => line === 'The board is inside.')).toHaveLength(1);
        const scene = { place: 'the courtyard', ambient: 'normal' as const, hearing: folded.hearing, hearings: folded.hearings };
        const prompt = composeNarrationUser(folded.facts, scene);
        expect(prompt).toContain('SPOKEN HERE by the keeper: First Crossing');
        expect(prompt).toContain('SPOKEN HERE, OVERHEARD: Second Crossing');
        expect(prompt.indexOf('SPOKEN HERE by the keeper')).toBeLessThan(prompt.indexOf('SPOKEN HERE, OVERHEARD'));
        expect(composeNarrationUser(folded.facts, { ...scene, hearings: undefined })).not.toContain('SPOKEN HERE, OVERHEARD: Second Crossing');
        // A wrapper can attach another real hearing after its inner fold.
        const rebound = foldTheCallsIntoOneTurn([{ ...folded, hearing: overheard }, staticRead]);
        expect(rebound.hearings).toEqual([told, overheard]);
    });
});
