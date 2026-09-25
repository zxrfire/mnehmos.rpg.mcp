/**
 * A ratchet on the verb surface naming the verb and not the read.
 *
 * `WHAT_EACH_VERB_IS_FOR` is the only account of the action set the phase-1
 * classifier is ever given, and in this engine the model reads the player's
 * sentence FIRST - the pattern table is the fallback. So an intent the glossary
 * does not name is not merely undocumented. It is a read the model will never
 * reach for, left reachable only by a player who happens to type the one
 * sentence the table has a line for.
 *
 * MEASURED WHEN THIS WAS WRITTEN. Nineteen labels the code attaches to a verb
 * were named nowhere in the glossary:
 *
 *     look       7 named of 12    what a house holds, what it teaches, who
 *                                 stands behind it, what a province makes,
 *                                 whether a house would have you
 *     sect      20 named of 23    take, authority, decree
 *     coerce     4 named of  7    swallow, marry, furnace
 *     interact  11 named of 13    take, insult
 *     request   12 named of 14    wants, weigh
 *     attack     0 named of  2    let_them_go, step_between
 *     guard      0 named of  1    ask
 *     work       0 named of  1    board
 *
 * Every one of the five `look` reads was implemented, routed, tested and
 * reachable by anybody who typed the right sentence. Two agents in a row
 * declined to write them up on the ground that it would stale `docs/verbs.md`,
 * which is a reason to do both.
 *
 * WHY THE SIBLING RATCHET COULD NOT SEE ANY OF IT
 * -----------------------------------------------
 * `the-verb-surface-is-not-stale.test.ts` compares each verb's `intents`
 * against an exported runtime constant, and names the hole in its own header:
 * the entries carrying drift risk are the ones with nothing to compare against.
 * `SectIntent` and `CoercionIntent` are union types with no constant, `look`
 * has neither, and several verbs set their label inline in the branch that
 * recognises the sentence. The gap was written down and nothing measured it,
 * which is how eleven of the nineteen survived.
 *
 * So this one reads the source rather than asking the code for a list.
 * `scripts/find-intents-the-glossary-never-names.mjs` carries the three
 * readings and states what each cannot see. Reading the source is also what
 * lets it keep working while somebody else is moving intents about, which was
 * true while it was being written.
 *
 * WHAT THE NUMBER MEANS, AND WHICH WAY IT MOVES
 * ---------------------------------------------
 * Eleven of the nineteen were written into the glossary. Seven are deliberate
 * and sit in the allow-list below with a reason each. One is left over, and it
 * is a gap rather than a decision - `interact/insult`, whose entry says what
 * closing it takes and why it could not be done in the same pass.
 *
 * So the baseline is ONE, and it counts what is OUTSTANDING rather than what is
 * tolerated. Lower it when `insult` lands; never raise it. When this fails the
 * fix is the glossary entry, or a line in the allow-list saying why a model
 * should never be handed the label - and a label with neither is admitted to be
 * work outstanding. That is the shape `the-register-shows-what-the-catalogs-
 * hold.test.ts` uses, for the same reason: a bare count cannot tell a decision
 * from an oversight, so the decisions are written where the count is.
 *
 * A NEW INTENT REDS THIS THE DAY IT LANDS, and that is intended rather than an
 * accident of the baseline being low. A verb's reads are its whole surface, and
 * one the model has never heard of is content nobody knows the game has.
 */

import { describe, expect, it } from 'vitest';

import {
    findIntentsTheGlossaryNeverNames,
    theIntentsTheCodeAttaches,
    whatTheVerbSurfaceNames
} from '../../scripts/find-intents-the-glossary-never-names.mjs';
import { WHAT_EACH_VERB_IS_FOR } from '../../src/web/what-each-verb-is-for-in-the-players-words.js';
import { ACTION_NAMES, type ActionName } from '../../src/web/actions.js';

interface Unnamed { verb: string; intent: string; where: string }

const row = (r: Unnamed) => `${r.verb}/${r.intent}`;

/**
 * Labels the glossary is right never to name, and the reason for each.
 *
 * The reason is the point of the list. "Not named" and "must never be named"
 * are the same row in a count, and the first is a defect while the second is a
 * decision, so the decision is written down where the count is.
 *
 * Six of the seven are one judgement said six times: the model does not choose
 * these labels, and offering it one would be inviting it to decide on the
 * player's behalf that a sentence was a question rather than an act. That
 * decision belongs to `asking-is-not-doing.ts`, which reads the SHAPE of what
 * was typed, and the engine is what should be saying no.
 */
const NOT_THE_GLOSSARYS_BUSINESS: Readonly<Record<string, string>> = {
    'guard/ask':
        'the read half of standing a watch, substituted by `theReadThatAnswersIt` when '
        + 'the sentence asked about one instead of offering to keep one. A model handed '
        + 'the label would pick it for somebody who plainly said they would stand there.',
    'work/board':
        'the same, for work: asking whether there is any is the board, and taking some is '
        + 'a season. Offering the model the read is how a player who said they are taking '
        + 'work for the winter gets shown a list instead, which is the one answer somebody '
        + 'with no stones cannot afford.',
    'request/weigh':
        'the same again: what it would take to ask them, built from the facts the attempt '
        + 'reads and spending none of its days. Reached by the shape of the question, and the '
        + 'twelve kinds the glossary does list are what the asking itself can be for.',
    'request/wants':
        'what a person is after, which is a read ABOUT somebody rather than an ask made OF '
        + 'them. It shares the verb because the target resolves the same way, and it is not '
        + 'a `RequestKind` - `request.intents` is that union, held complete by a mapped '
        + 'type, and a label with no weight and no price would break the guarantee that '
        + 'every kind of ask is costed. Arguable: if it is ever wanted as a chosen read it '
        + 'belongs on `look` or `assess`, not here.',
    'interact/insult':
        'a second reading of one act, rewritten to the `insult` verb in the turn engine '
        + 'before any resolver sees it, so the insult always lands on both the room and the '
        + 'obligation ledger. `insult` is the verb the model should say and it is named.',
    'interact/take':
        'a label that never survives to a resolver. The interact handler asks whose the '
        + 'thing is first, and either rewrites it to `steal` with the holder on the target '
        + 'or refuses because nobody is holding it. `steal` is what the model should say '
        + 'and is already named; `take` is the question in front of it.',
    'attack/let_them_go':
        'mercy, read off the sentence the player typed and never chosen. `attack` does not '
        + 'take an `intent` field at all, and its entry says in capitals why: nobody '
        + 'chooses an ending, they choose a swing. What a sparing lands on is whoever is '
        + 'beaten in front of the player, which the engine already holds - a label from a '
        + 'model would be a second opinion about it.',
    'attack/step_between':
        'the other half of the same branch, standing between two other people, and '
        + 'withheld for the same reason. Both were added because `i stay my hand` and `i '
        + 'stand between them` reached `unclear`; that is a job for the table and not for '
        + 'the glossary.',
    'attack/give_in':
        'the third of that family and the same branch read from the other end: a surrender '
        + 'said with no fight standing. Withheld for the reason the other two are - `attack` '
        + 'takes no `intent` from a model, because nobody chooses an ending - and for one '
        + 'more that is its own. A fight already reads these words before the table is asked '
        + '(`whatTheySaidInTheFight`), so the only sentences that reach this label are the '
        + 'ones said with nothing swinging. A model handed it could attach a surrender to a '
        + 'turn where the engine had already answered one.'
};

/**
 * What is outstanding, which is not the same as what is allowed.
 *
 * `interact/insult` is a real intent: the pattern table routes it, it is in
 * `ATTEMPT_INTENTS`, and it resolves against the person and leaves a mark, for
 * the reason recorded beside that set - an insult asks for nothing and is still
 * an attempt ON somebody. It is not in `INTERACT_INTENTS`, which is the list
 * `the-verb-surface-is-not-stale.test.ts` pins this glossary to in BOTH
 * directions, so naming it here alone turns that test red.
 *
 * Closing it is three edits in one commit: the label on `INTERACT_INTENTS` in
 * `planned-action.ts`, a line for it in the exhaustive denial record in
 * `unresolved-attempt-denials.ts`, and the entry here. None of that belonged to this
 * pass. It is counted rather than allow-listed on purpose.
 */
const OUTSTANDING = 1;

describe('an intent the glossary never names', () => {
    it('does not leave a read the code dispatches out of the phase-1 glossary', () => {
        const rows = findIntentsTheGlossaryNeverNames() as Unnamed[];
        const left = rows.filter(r => !(row(r) in NOT_THE_GLOSSARYS_BUSINESS));
        expect(
            left.length,
            `Intents the code attaches and the verb surface never names rose above ${OUTSTANDING}. `
            + 'Write the entry, or say in NOT_THE_GLOSSARYS_BUSINESS why a model should never be '
            + 'handed the label.'
            + left.map(r => `\n  ${r.verb}/${r.intent}  ${r.where}`).join('')
        ).toBeLessThanOrEqual(OUTSTANDING);
    });

    it('makes the allow-list carry a reason rather than a name', () => {
        for (const [label, why] of Object.entries(NOT_THE_GLOSSARYS_BUSINESS)) {
            expect(why.length, `${label} is withheld with no reason given`).toBeGreaterThan(40);
        }
    });

    it('keeps the allow-list to labels the code still attaches', () => {
        // An entry for a label nothing produces any more is an exemption nobody
        // can see the effect of, and it would quietly cover the next intent to
        // take that name.
        const rows = (findIntentsTheGlossaryNeverNames() as Unnamed[]).map(row);
        for (const label of Object.keys(NOT_THE_GLOSSARYS_BUSINESS)) {
            expect(rows, `${label} is allow-listed and is not reported`).toContain(label);
        }
    });
});

/**
 * The instrument, checked against the thing it measures.
 *
 * Both readings are of source text, and a regex that stopped matching would
 * report a clean sheet rather than an error - which is the failure mode this
 * whole ratchet exists to prevent, one layer down.
 */
describe('the reading of the verb surface', () => {
    it('agrees with the glossary the engine is actually given', () => {
        const fromSource = whatTheVerbSurfaceNames() as Map<string, string[]>;
        for (const verb of ACTION_NAMES) {
            expect(
                fromSource.get(verb),
                `the intents read out of the source for ${verb} are not the ones it exports`
            ).toEqual([...(WHAT_EACH_VERB_IS_FOR[verb as ActionName].intents ?? [])]);
        }
    });

    it('still sees every read `look` was fixed to name', () => {
        // The reverse direction, held only where the reading is known complete.
        // `look`'s twelve agree on both sides - every one is produced by the
        // pattern table AND dispatched in the `case 'look'` arm - so a named
        // intent missing from the reading means either the instrument broke or
        // a read was deleted and the glossary now offers the model something
        // that reaches nothing. Not asserted for the other verbs, where the
        // reading deliberately under-reports and a miss would mean neither.
        const attached = (theIntentsTheCodeAttaches() as Map<string, Map<string, string>>).get('look');
        for (const intent of WHAT_EACH_VERB_IS_FOR.look.intents ?? []) {
            expect([...(attached?.keys() ?? [])], `look names ${intent} and nothing attaches it`)
                .toContain(intent);
        }
    });
});
