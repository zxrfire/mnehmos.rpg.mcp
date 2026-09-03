/**
 * The one writer, and the slot producers declare into.
 *
 * Knowledge used to be written by whoever happened to be holding the player -
 * `noteEncounter` has fourteen call sites across six files - and every new
 * perception meant remembering to add a fifteenth. That is how a house named to
 * the player three times in one session was still `unaware` when they tried to
 * ask it for something: a verb that forgets is indistinguishable from a verb
 * that decided not to.
 *
 * So a producer DECLARES what it showed and the turn boundary writes it.
 */

import { recordPerception } from '../../src/web/shown-this-turn';
import { foldTheCallsIntoOneTurn } from '../../src/web/a-sentence-can-be-more-than-one-call';

/** A gate that records what it was asked to write and answers honestly. */
function spyGate() {
    const written: Record<string, unknown>[] = [];
    const held = new Set<string>();
    return {
        written,
        learnIfNew(input: Record<string, unknown>) {
            const key = `${input.kind}:${input.id}`;
            if (held.has(key)) return false;
            held.add(key);
            written.push(input);
            return true;
        }
    };
}

const RUN = { elapsedDays: 41.7 } as never;
const WHO = { id: 'holder-1' } as never;

describe('writing down what a turn showed', () => {
    it('writes every name, with the perception\'s source and note', () => {
        const gate = spyGate();
        const learned = recordPerception(gate as never, WHO, RUN, {
            names: [
                { kind: 'sect', id: 'sect-a', name: 'A House', stage: 'named' },
                { kind: 'cultivator', id: 'who-2', name: 'Somebody' }
            ],
            note: 'They hold the ground this cultivator was standing on.',
            sourceKind: 'witnessed',
            stage: 'placed'
        });
        expect(learned).toHaveLength(2);
        expect(gate.written[0].sourceKind).toBe('witnessed');
        expect(gate.written[0].sourceNote).toContain('standing on');
        // The day is the run's, floored, exactly as every other writer does it.
        expect(gate.written[0].onDay).toBe(41);
    });

    /**
     * A name's own stage beats the perception's default. The traveller case:
     * where they came from is `placed` because they said it with a number of
     * days on it, and anything else they mentioned is a `whisper`.
     */
    it('lets a name carry its own stage over the perception\'s default', () => {
        const gate = spyGate();
        recordPerception(gate as never, WHO, RUN, {
            names: [
                { kind: 'place', id: 'p1', name: 'Somewhere', stage: 'placed' },
                { kind: 'place', id: 'p2', name: 'Elsewhere' }
            ],
            note: 'A traveller said where they had been.',
            sourceKind: 'told',
            stage: 'whisper'
        });
        expect(gate.written[0].stage).toBe('placed');
        expect(gate.written[1].stage).toBe('whisper');
    });

    /** Only what moved somebody up the ladder comes back. */
    it('reports only what was new', () => {
        const gate = spyGate();
        const perception = {
            names: [{ kind: 'sect' as const, id: 'sect-a', name: 'A House' }],
            note: 'shown',
            sourceKind: 'witnessed' as const
        };
        expect(recordPerception(gate as never, WHO, RUN, perception)).toHaveLength(1);
        expect(recordPerception(gate as never, WHO, RUN, perception)).toHaveLength(0);
    });

    /** Showing nothing is the ordinary case and must not be an error. */
    it('is content with a perception that showed nothing', () => {
        const gate = spyGate();
        expect(recordPerception(gate as never, WHO, RUN, {
            names: [], note: 'nothing here', sourceKind: 'witnessed'
        })).toHaveLength(0);
        expect(gate.written).toHaveLength(0);
    });
});

describe('a sentence that was more than one call', () => {
    /**
     * CONCATENATED, unlike the hearing beside it. A turn has at most one thing
     * somebody SAID to render, and every step of a plan can show the player
     * something - so taking the first would silently drop what the later steps
     * put in front of them, which is the defect the seam exists to end.
     */
    it('keeps what every step showed, not just the first', () => {
        const step = (id: string) => ({
            facts: { headline: '', lines: [], structure: [], prose: '' },
            events: [], timeSkip: null, breakthrough: null,
            outcome: 'executed' as const, calls: [],
            perceived: [{ names: [{ kind: 'sect' as const, id, name: id }], note: 'n', sourceKind: 'witnessed' as const }]
        });
        const folded = foldTheCallsIntoOneTurn([step('a'), step('b'), step('c')]);
        expect(folded.perceived).toHaveLength(3);
        expect(folded.perceived!.map(p => p.names[0].id)).toEqual(['a', 'b', 'c']);
    });

    it('is content when no step showed anything', () => {
        const bare = {
            facts: { headline: '', lines: [], structure: [], prose: '' },
            events: [], timeSkip: null, breakthrough: null,
            outcome: 'executed' as const, calls: []
        };
        expect(foldTheCallsIntoOneTurn([bare, bare]).perceived).toEqual([]);
    });
});
