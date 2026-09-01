/**
 * The ladder of knowing.
 *
 * docs/world/discovery.md specifies six stages and two rules about them that
 * are easy to write down and easy to lose:
 *
 *   - Each step needs a source, and the sources are scarce.
 *   - Seeing is a knowledge state, not an access state.
 *
 * These are design guards rather than coverage. Each one fails loudly if
 * somebody makes a name cheaper than the doc says it is, or lets a stage stand
 * in for permission.
 */

import { describe, it, expect } from 'vitest';
import {
    KNOWING_STAGES,
    NAMEABLE_FROM,
    REACHABLE_FROM,
    advanceStage,
    canName,
    canPointAt,
    highestStage,
    isAtLeast,
    stageAcross,
    stageCeilingFor,
    stageFromSource,
    stageFromStance,
    stageFromTags,
    stageOfRecord,
    stageRank,
    stageTag,
    stanceForStage,
    stepFor,
    type KnowingStage
} from '../../../src/engine/social/discovery';
import { recordKnowledge, type SourceKind } from '../../../src/engine/social/knowledge';

describe('the six stages', () => {
    it('are the doc\'s six, in the doc\'s order', () => {
        expect([...KNOWING_STAGES]).toEqual([
            'unaware', 'whisper', 'named', 'placed', 'encountered', 'known'
        ]);
    });

    it('orders strictly, so a comparison never ties two different rungs', () => {
        const ranks = KNOWING_STAGES.map(stageRank);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
        expect(new Set(ranks).size).toBe(ranks.length);
    });

    it('reads back the stage it wrote onto a record\'s tags', () => {
        for (const stage of KNOWING_STAGES) {
            expect(stageFromTags([stageTag(stage), 'unrelated'])).toBe(stage);
        }
        expect(stageFromTags(['stage:invented'])).toBeNull();
        expect(stageFromTags([])).toBeNull();
    });
});

describe('each step needs a source, and the source caps the step', () => {
    /**
     * The sentence this whole file exists for. A fragment through a wall is
     * unresolvable and cannot be asked about, so hearing it a hundred times is
     * still a whisper; only a better source moves anybody.
     */
    it('never lets an overheard fragment rise above a whisper', () => {
        expect(stageCeilingFor('overheard')).toBe('whisper');
        expect(stageFromSource('overheard', 'known')).toBe('whisper');
        expect(stageFromSource('overheard', 'placed')).toBe('whisper');

        let stage: KnowingStage = 'unaware';
        for (let i = 0; i < 100; i++) {
            stage = stepFor(stage, 'overheard', 'known').to;
        }
        expect(stage).toBe('whisper');
    });

    it('never lets a guess or a lie rise above a whisper either', () => {
        expect(stageCeilingFor('assumed')).toBe('whisper');
        expect(stageCeilingFor('fabricated')).toBe('whisper');
    });

    it('lets somebody who was told, or who read it, place a thing and no more', () => {
        for (const source of ['told', 'read', 'divined'] as const) {
            expect(stageCeilingFor(source)).toBe('placed');
            expect(stageFromSource(source, 'known')).toBe('placed');
        }
    });

    it('reserves the top of the ladder for having been there', () => {
        expect(stageCeilingFor('witnessed')).toBe('known');
        expect(stageFromSource('witnessed', 'known')).toBe('known');
    });

    /**
     * Deliberately not a judgement about the speaker.
     *
     * "A name from a drunk carter and a name from a sect archivist are
     * different facts, and the carter's may still be the true one." Both are
     * `told`; what separates them is the note on the row and nothing else.
     */
    it('does not rank sources by who the speaker was', () => {
        const sources: SourceKind[] = ['told', 'read'];
        const ceilings = new Set(sources.map(stageCeilingFor));
        expect(ceilings.size).toBe(1);
    });
});

describe('stages never fall', () => {
    it('keeps the higher of what was held and what was gained', () => {
        expect(advanceStage('placed', 'whisper')).toEqual({
            from: 'placed', to: 'placed', moved: false
        });
        expect(advanceStage('whisper', 'placed')).toEqual({
            from: 'whisper', to: 'placed', moved: true
        });
    });

    it('reads a holder\'s position as the highest live row they have', () => {
        const rows = [
            recordKnowledge({
                holderId: 'h', claimKey: 'exists:place:kettle', stance: 'suspects',
                statement: 'a word', onDay: 1, source: { kind: 'overheard' },
                tags: [stageTag('whisper')]
            }),
            recordKnowledge({
                holderId: 'h', claimKey: 'exists:place:kettle', stance: 'believes',
                statement: 'somebody came from there', onDay: 40, source: { kind: 'told' },
                tags: [stageTag('placed')]
            })
        ];
        expect(stageAcross(rows)).toBe('placed');
        // And the weaker row is not deleted by the stronger one arriving.
        expect(rows).toHaveLength(2);
    });

    it('ignores superseded rows', () => {
        const superseded = {
            ...recordKnowledge({
                holderId: 'h', claimKey: 'k', stance: 'knows', statement: 's',
                onDay: 1, source: { kind: 'witnessed' }, tags: [stageTag('known')]
            }),
            superseded: true
        };
        expect(stageAcross([superseded])).toBe('unaware');
    });
});

describe('a row written before the ladder existed still has a position', () => {
    it('derives one from the stance and the source, with no migration', () => {
        expect(stageFromStance('ignorant', 'told')).toBe('unaware');
        expect(stageFromStance('suspects', 'overheard')).toBe('whisper');
        expect(stageFromStance('believes', 'told')).toBe('named');
        expect(stageFromStance('knows', 'witnessed')).toBe('encountered');
        expect(stageFromStance('knows', 'told')).toBe('placed');
    });

    it('prefers the row\'s own tag over the derivation', () => {
        const tagged = recordKnowledge({
            holderId: 'h', claimKey: 'k', stance: 'believes', statement: 's',
            onDay: 0, source: { kind: 'told' }, tags: [stageTag('placed')]
        });
        expect(stageOfRecord(tagged)).toBe('placed');

        const untagged = recordKnowledge({
            holderId: 'h', claimKey: 'k', stance: 'believes', statement: 's',
            onDay: 0, source: { kind: 'told' }
        });
        expect(stageOfRecord(untagged)).toBe('named');
    });
});

describe('the two predicates are not the same question', () => {
    it('licenses the name from a whisper and the journey only from placed', () => {
        expect(NAMEABLE_FROM).toBe('whisper');
        expect(REACHABLE_FROM).toBe('placed');

        expect(canName('whisper')).toBe(true);
        expect(canPointAt('whisper')).toBe(false);
        expect(canPointAt('named')).toBe(false);
        expect(canPointAt('placed')).toBe(true);
    });

    it('says nothing at all about admission', () => {
        // "Seeing is a knowledge state, not an access state." Nothing in this
        // module takes a realm, a threshold or a faction, and the whole of what
        // reaching the top of the ladder buys is the right to say a word.
        const source = String(canPointAt) + String(stanceForStage) + String(isAtLeast);
        expect(source).not.toMatch(/ordinal|realm|threshold|admission|faction/i);
    });
});

describe('the ladder maps onto the stance vocabulary rather than replacing it', () => {
    it('gives every stage a stance an existing query can filter on', () => {
        expect(stanceForStage('unaware')).toBe('ignorant');
        expect(stanceForStage('whisper')).toBe('suspects');
        expect(stanceForStage('named')).toBe('believes');
        expect(stanceForStage('placed')).toBe('believes');
        expect(stanceForStage('encountered')).toBe('knows');
        expect(stanceForStage('known')).toBe('knows');
    });

    it('never assigns a positive stage the ignorant stance', () => {
        for (const stage of KNOWING_STAGES) {
            if (stage === 'unaware') continue;
            expect(stanceForStage(stage)).not.toBe('ignorant');
        }
    });

    it('is monotone in the stance it implies', () => {
        const order = ['ignorant', 'suspects', 'believes', 'believes', 'knows', 'knows'];
        expect(KNOWING_STAGES.map(stanceForStage)).toEqual(order);
        expect(highestStage('named', 'placed')).toBe('placed');
    });
});
