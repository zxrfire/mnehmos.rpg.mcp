/**
 * The classifier is shown who is standing here.
 *
 * Written against a played defect: "I kill everyone here" read correctly as
 * `attack` and then resolved to nobody, while nine people stood in the square,
 * because the phase-1 prompt carried every name in the cultivator's world and
 * no mark on which of them were in front of them. A model cannot expand a
 * quantifier over a set it was never shown.
 *
 * What is pinned here is the SHOWING, not the model's reading of it. What a
 * model does with the square is the model's business and the engine still rules
 * on it; what must not happen again is the square being withheld.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
    AWARENESS_SHOWN_TO_THE_CLASSIFIER,
    LIVE_THINGS_SHOWN_TO_THE_CLASSIFIER,
    composeStateSummary,
    describeAwareness,
    describeWhatIsLive,
    describeWhoIsHere
} from '../../src/web/prompt';
import type { Company } from '../../src/web/facts';
import { makeGameInWorld } from './harness';

const WORLD = 'probe-world';

describe('who is standing here', () => {
    it('names the people the cultivator can name', () => {
        const company: Company = {
            named: [
                { name: 'Han Cikuan', ordinal: 9, sex: 'male', age: 61, rank: 'Sword Elder' },
                { name: 'He Cihe', ordinal: 3, sex: 'female', age: 22, rank: null }
            ],
            strangers: [],
            total: 2
        };
        const lines = describeWhoIsHere(company, 6).join('\n');

        expect(lines).toContain('Han Cikuan');
        expect(lines).toContain('3 rungs above them');
        expect(lines).toContain('He Cihe');
        expect(lines).toContain('3 rungs below them');
        expect(lines).toContain('2 people here in total');
    });

    /**
     * The design owner, on why resolving a description is only half of it:
     * *this should fall out of making names but also characteristics visible to
     * the LLM*. A reader shown only names can only write a name, so every
     * sentence that picks somebody out by what they are was one the phase-1
     * reader had no grounds to produce.
     */
    it('shows what a description reads, and says a description may be written', () => {
        const lines = describeWhoIsHere({
            named: [{ name: 'Han Cikuan', ordinal: 9, sex: 'male', age: 61, rank: 'Sword Elder' }],
            strangers: [],
            total: 1
        }, 6).join(String.fromCharCode(10));

        expect(lines).toContain('male');
        expect(lines).toContain('about 61');
        expect(lines).toContain('Sword Elder');
        expect(lines).toContain('DESCRIPTION');
    });

    it('counts a stranger at a height and never gives them a name', () => {
        const company: Company = {
            named: [],
            strangers: [{ ordinal: 9 }, { ordinal: 6 }, { ordinal: 1 }],
            total: 3
        };
        const lines = describeWhoIsHere(company, 6).join('\n');

        expect(lines).toContain('1 above them');
        expect(lines).toContain('1 level with them');
        expect(lines).toContain('1 below them');
        // The whole point of the count: they are reachable without a name.
        expect(lines).toContain('pointed at');
    });

    it('says an empty square is empty rather than saying nothing', () => {
        const lines = describeWhoIsHere({ named: [], strangers: [], total: 0 }, 6).join('\n');
        expect(lines).toContain('alone here');
    });

    it('states what it cut rather than reading complete', () => {
        const many = Array.from({ length: 20 }, (_, i) => ({
            name: `Person ${i}`, ordinal: 5, sex: 'female', age: 30, rank: null
        }));
        const lines = describeWhoIsHere({ named: many, strangers: [], total: 20 }, 6).join('\n');

        expect(lines).toContain('8 more this cultivator can name');
        expect(lines).toContain('20 people here in total');
    });
});

describe('the square in the real phase-1 prompt', () => {
    it('carries the people who are actually in front of the player', async () => {
        const { game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');

        const company = game.company(cultivator);
        const summary = composeStateSummary({
            cultivator,
            run: game.state().run as never,
            ambient: 'thin',
            present: company
        });

        expect(summary).toContain('STANDING HERE');
        // The square this world puts a fresh cultivator in is not empty, and if
        // it ever becomes empty this test should be told rather than pass.
        expect(company.total).toBeGreaterThan(0);
        expect(summary).toContain(`${company.total} people here in total`);
        for (const person of company.named) expect(summary).toContain(person.name);
    }, 120_000);
});


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AND WHAT HAS A BODY HERE TO ANSWER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FOUND BY AUDIT, and it is the cheapest prose defect in the repo:
 * `describeWhatIsWithinReach` was DEAD - zero callers, not even a test - while
 * the whole chain above it ran on every single turn.
 *
 *     turn-engine.ts:1998  withinReach: this.reachFrom(cultivator).map(...)
 *     prompt.ts:760        withinReach?: readonly ThingWithinReach[]  <- arrives
 *     prompt.ts:819        describeWhatIsWithinReach(...)             <- DEAD
 *
 * So every turn the game resolved what was reachable, asked
 * `theWordsThisPersonAnswersTo` what each person and house present answers to,
 * assembled the `alsoCalled` list, put all of it on the prompt input - and then
 * told the narrator none of it. The forms-of-address table was on the same wire
 * and died at the same boundary.
 *
 * It is the same class as the square itself, which is what this file was
 * written about: a model cannot bind a phrase to a person it was never shown.
 * The square told it WHO is here; this tells it what each of them ANSWERS TO,
 * which is how a novel refers to anybody twice.
 */
describe('what is within reach, and the names it answers to', () => {
    // A real cultivator and a real run, built once. Hand-authoring a
    // `Cultivator` here would drift from the schema the moment anybody adds a
    // field, and the point of these three is the BLOCK rather than the body.
    type Summary = Parameters<typeof composeStateSummary>[0];
    let PLAYER: Summary['cultivator'];
    let RUN: Summary['run'];
    let EMPTY_SQUARE: Company;

    beforeAll(async () => {
        const { game } = await makeGameInWorld({ seed: 'reach-fixture', worldSeed: WORLD });
        const started = await game.newRun('Probe');
        PLAYER = started.cultivator;
        RUN = game.state().run as never;
        EMPTY_SQUARE = { total: 0, named: [], strangers: [] } as unknown as Company;
    }, 120_000);

    it('carries the other names a thing here answers to', () => {
        const summary = composeStateSummary({
            cultivator: PLAYER,
            run: RUN,
            ambient: 'thin',
            present: EMPTY_SQUARE,
            withinReach: [
                {
                    kind: 'person',
                    name: 'Fang Qiuyan',
                    alsoCalled: ['Elder Fang', 'the elder'],
                    through: null
                },
                {
                    kind: 'house',
                    name: 'Azure Dew Sect',
                    alsoCalled: ['the sect'],
                    through: { name: 'Fang Qiuyan' }
                }
            ]
        });

        expect(summary).toContain('WITHIN REACH');
        expect(summary).toContain('Fang Qiuyan');
        expect(summary).toContain('Elder Fang');
        // A house is reachable because somebody who answers for it is standing
        // here, and saying through WHOM is the whole of why it is on the list.
        expect(summary).toContain('here through Fang Qiuyan');
    });

    /**
     * AND IT IS NOT A LIMIT ON WHAT MAY BE NAMED, which is stated in the block
     * itself for the same reason the live block states it. A model handed a
     * list reads it as the permitted set unless told otherwise, and anything
     * the cultivator has heard of can be named whether or not it is standing
     * here.
     */
    it('says outright that it is not a limit', () => {
        const summary = composeStateSummary({
            cultivator: PLAYER,
            run: RUN,
            ambient: 'thin',
            present: EMPTY_SQUARE,
            withinReach: [
                { kind: 'person', name: 'Fang Qiuyan', alsoCalled: [], through: null }
            ]
        });
        expect(summary).toMatch(/NOT A LIMIT ON WHAT MAY BE NAMED/);
    });

    it('says nothing at all when nothing is reachable', () => {
        const summary = composeStateSummary({
            cultivator: PLAYER, run: RUN, ambient: 'thin', present: EMPTY_SQUARE, withinReach: []
        });
        expect(summary).not.toContain('WITHIN REACH');
    });

    /**
     * THE WHOLE CHAIN, ON A REAL RUN. The unit tests above prove the block is
     * composed; this proves the engine actually fills it, which is the half
     * that was broken - the data had been arriving correctly the entire time.
     */
    it('reaches the real prompt on a played turn', async () => {
        const { game } = await makeGameInWorld({ seed: 'reach-1', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');

        const reach = game.reachFrom(cultivator);
        expect(reach.length, 'a fresh square reaches nothing').toBeGreaterThan(0);

        const summary = composeStateSummary({
            cultivator,
            run: game.state().run as never,
            ambient: 'thin',
            present: game.company(cultivator),
            withinReach: reach.map(thing => ({
                kind: thing.kind,
                name: thing.name,
                alsoCalled: thing.alsoCalled,
                through: thing.through ? { name: thing.through.name } : null
            }))
        });

        expect(summary).toContain('WITHIN REACH');
        for (const thing of reach.slice(0, 3)) expect(summary).toContain(thing.name);
    }, 120_000);
});

describe('what the world is holding out', () => {
    /**
     * The design owner's model, in his own words:
     *
     *   > get_affordances() doesn't mean "here are the only things you are
     *   > allowed to do." It means "here are the things the world currently
     *   > considers particularly actionable." The LLM still has a
     *   > general-purpose attempt_action... You don't want the MCP layer
     *   > deciding "teleport isn't in the current affordance list, therefore
     *   > the player can't attempt it."
     *
     * So the block has to say so, out loud, in the prompt. A reader handed an
     * unqualified list of six sentences will pick from the six.
     */
    it('says it is not a menu, and stays inside its cap', () => {
        const many = Array.from({ length: 20 }, (_, i) => ({
            say: `sentence ${i}`, because: `reason ${i}`, routesTo: 'move'
        }));
        const block = describeWhatIsLive(many).join(String.fromCharCode(10));

        expect(block).toContain('NOT A MENU');
        expect(block).toContain('still worth attempting');
        expect(block).toContain('sentence 0');
        expect(block).not.toContain(`sentence ${LIVE_THINGS_SHOWN_TO_THE_CLASSIFIER}`);
        // The action each one routes to, so a reader of a log can see what was
        // being offered and a test can assert the pairing.
        expect(block).toContain('(move)');
    });

    it('says nothing at all when nothing is live', () => {
        expect(describeWhatIsLive([])).toEqual([]);
    });
});

describe('the list of everything they have heard of', () => {
    const row = (name: string, onDay: number) => ({
        kind: 'cultivator' as const,
        id: name,
        name,
        statement: '',
        stance: 'knows' as const,
        sourceKind: 'witnessed' as const,
        sourceNote: '',
        acquiredOnDay: onDay,
        stage: 'known' as const
    });

    /**
     * This block was unbounded, and it is the one part of the state summary
     * that grows for as long as a run lasts. The cap is safe only because
     * whatever the player NAMED is lifted to the top of it first: cutting the
     * one row this turn is about is the single way a cap here costs a turn.
     */
    it('keeps what the sentence named, whatever else it cuts', () => {
        const rows = [
            ...Array.from({ length: 200 }, (_, i) => row(`Person ${i}`, 5000 + i)),
            row('Xun Erlang', 0)
        ];
        const block = describeAwareness(rows, 'I ask Xun Erlang to teach me')
            .join(String.fromCharCode(10));

        expect(block).toContain('Xun Erlang');
        expect(block).toContain('more this cultivator can name, not listed here');
        // And the cut is stated honestly, because the block above this one
        // claims to be the whole of what can be named.
        expect(block).toContain('absent for room');
        expect(block.split(String.fromCharCode(10)).length)
            .toBeLessThanOrEqual(AWARENESS_SHOWN_TO_THE_CLASSIFIER + 1);
    });

    it('shows the most recently learned first, and says nothing about a cut it did not make', () => {
        const block = describeAwareness([row('Old', 1), row('New', 900)], '')
            .join(String.fromCharCode(10));
        expect(block.indexOf('New')).toBeLessThan(block.indexOf('Old'));
        expect(block).not.toContain('not listed here');
    });
});
