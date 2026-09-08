/**
 * The player is never shown a symbol out of this repository.
 *
 * PLAYED: `I assess myself` answered, in the narration,
 *
 *   Nothing here refuses an action for being unwise - only `attempt`
 *   refuses, and only for physical reasons. `regard` is the separate
 *   question of how far above or below this they are standing...
 *
 * Two fields of the tool's own result shape, in backticks, to somebody
 * standing in a market town. It reached there because a tool's `note` is read
 * by two audiences that want opposite things - an operator or a model driving
 * the MCP surface, and a person in the world - and `tool-result-prose.ts`
 * pushes it at the second.
 *
 * The note was fixed where it is written. This is the net, because that field
 * is read at three sites and filled by every tool in the game.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';

/** A symbol, a filename, or anything else only somebody with the source says. */
const SOURCE_IN_PROSE = /`[^`]+`|\b\w+\.(?:ts|md)\b|\bundefined\b|\[object Object\]/;

/**
 * A FORM FIELD, WHICH IS A DIFFERENT AUDIENCE AGAIN.
 *
 * `${n} year(s) off` on an obligation's due day, and `0 year(s)` for anything
 * inside six months. A parenthesised plural is what somebody writes when they
 * do not know the number yet; the engine knows it. An operator `note` may keep
 * the form register - it is read by something driving the surface - but the
 * narration is read by somebody standing in a room.
 */
const A_FORM_RATHER_THAN_A_SENTENCE = /\b[a-zA-Z]+\(s\)|\bN\/A\b|\bnull\b|\bNaN\b/;

describe('nothing in the narration comes out of the source', () => {
    it('holds across a turn of every ordinary verb', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'no-source', worldSeed: 'no-source', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Reader');
        db.prepare('UPDATE cultivators SET spirit_stones = 3000, realm_ordinal = 6 WHERE id = ?')
            .run(cultivator.id);

        // The same self-check as the form guard below: a pattern that has
        // stopped matching and a surface that has stopped offending look the
        // same from here.
        expect(SOURCE_IN_PROSE.test('only `attempt` refuses')).toBe(true);
        expect(SOURCE_IN_PROSE.test('only an attempt refuses')).toBe(false);

        const offences: string[] = [];
        for (const said of [
            'I look around',
            'I assess myself',
            'I assess this place',
            'who is here',
            'what do I know',
            'what is for sale',
            'what can I learn',
            'who would teach me',
            'what is stopping me',
            'what are people saying',
            'I cultivate for 30 days',
            'what missions are there'
        ]) {
            const answer = await game.act(said) as unknown as { narration: string };
            const found = SOURCE_IN_PROSE.exec(answer.narration);
            if (found) offences.push(`${said} -> ${found[0]}`);
        }
        expect(offences, 'the player was shown a symbol from the source').toEqual([]);
    }, 600_000);

    it('does not hand the player a form to read', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'no-forms', worldSeed: 'no-forms', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Reader');
        db.prepare('UPDATE cultivators SET spirit_stones = 3000, realm_ordinal = 14 WHERE id = ?')
            .run(cultivator.id);

        // THE PATTERN ITSELF, ASSERTED FIRST.
        //
        // A word-boundary escape in this file was eaten to a literal backspace
        // on the way to disk once already, and the guard went green because there was
        // nothing left for it to catch either way. A dead regex and a clean
        // surface read identically from here, so the regex is shown a line it
        // must reject before it is trusted with the narration.
        expect(A_FORM_RATHER_THAN_A_SENTENCE.test('which is 1 rung(s) up')).toBe(true);
        expect(A_FORM_RATHER_THAN_A_SENTENCE.test('which is 1 rung up')).toBe(false);

        const offences: string[] = [];
        for (const said of [
            'I look around',
            'what do I owe',
            'who owes me',
            'what do I carry',
            'what is my standing',
            'what have I done',
            'what is stopping me',
            'what houses are here',
            'what is for sale',
            'I look at my wounds'
        ]) {
            const answer = await game.act(said) as unknown as { narration: string };
            const found = A_FORM_RATHER_THAN_A_SENTENCE.exec(answer.narration);
            if (found) offences.push(`${said} -> ${found[0]}`);
        }
        expect(offences, 'the player was handed a form field').toEqual([]);
    }, 600_000);
});


/**
 * AND THE SAME RULE ON THE CHANNEL THAT IS NOT REWRITTEN.
 *
 * The guard above reads `answer.narration`, which is the channel a narrator
 * RE-WRITES. `facts.structure` is the other one, and `engineEntries` pushes it
 * to the play log verbatim as ENGINE RULING rows that sit on screen beside the
 * prose. Nothing checked it, so everything the rule above forbids arrived there
 * instead. Read off a live run before this existed:
 *
 *   whatIsWrongWithThisGround: 9 line(s) at stage encountered over 2 status(es)
 *   whoHoldsTheGround: held (name withheld from the player), answered at
 *     loc-region-low-fall-scarwater. Recourse the_record_does_not_say.
 *   filtered out of the learnable list below by `known !== true`
 *   0 pill row(s), 0 herb row(s), 22 stone(s)
 *   Standing at Qi Condensation Layer 1 (ordinal 0)
 *
 * Function names, a raw location id, a raw enum key, a code expression, six
 * parenthesised plurals, and the ladder index. `withoutTheHandlerName` already
 * strips one class of this at the sink, which is the repo noticing the problem
 * and fixing a single instance of it.
 *
 * An operator surface is a real thing and this is not one: the play log sits on
 * the same screen as the narration, in every mode, and `adminMode` gates only
 * the roster and the admin menu.
 */
describe('the engine log is read by somebody standing in a room', () => {
    /** A raw identifier: kebab-case ids, snake_case enum keys, fn( calls. */
    const A_SYMBOL_NOT_A_WORD =
        /\b[a-z]+(?:-[a-z0-9]+){2,}\b|\b[a-z]+_[a-z_]+\b|\b[a-z]+[A-Z][a-zA-Z]*\b/;

    it('shows no source, no form fields and no ladder index in its rulings', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'engine-log', worldSeed: 'engine-log', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Reader');
        db.prepare('UPDATE cultivators SET spirit_stones = 3000, realm_ordinal = 6 WHERE id = ?')
            .run(cultivator.id);

        // The patterns have to be alive, or a clean surface and a dead regex
        // read the same from here.
        expect(A_SYMBOL_NOT_A_WORD.test("answered at loc-region-low-fall")).toBe(true);
        expect(A_SYMBOL_NOT_A_WORD.test("Recourse the_record_does_not_say")).toBe(true);
        expect(A_SYMBOL_NOT_A_WORD.test("whoHoldsTheGround: held")).toBe(true);
        expect(A_SYMBOL_NOT_A_WORD.test("a quiet market town on thin ground")).toBe(false);
        expect(A_SYMBOL_NOT_A_WORD.test("Ning Jingyi says The Quiet Marches")).toBe(false);

        // AND A PERSON WHO IS ACTUALLY STANDING THERE.
        //
        // A hard-coded name is a name this world may not hold, and then the verb
        // resolves to a refusal and the person-read path never runs. That is how
        // `trust.md` reached a player through "look at a person" while this file
        // was green. AGENTS.md: read names out of the output rather than
        // hard-coding them, because any name the game prints it must accept.
        const roster = await game.act("who is here") as unknown as { narration: string };
        const somebody = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/.exec(roster.narration)?.[1];
        // A guard that silently skips the path it was added for is the defect
        // it exists to catch, so it has to have found somebody.
        expect(somebody, roster.narration.slice(0, 200)).toBeTruthy();

        const offences: string[] = [];
        for (const said of [
            "I look around",
            "I assess myself",
            "what is for sale",
            "what can I learn",
            "what am I carrying",
            "who is here",
            "what are people saying",
            "who would teach me",
            "what is stopping me",
            ...(somebody ? [`I look at ${somebody}`] : [])
        ]) {
            const answer = await game.act(said) as unknown as {
                state: { log: Array<{ role: string; text: string }> };
            };
            const rulings = (answer.state.log ?? []).filter(row => row.role === "engine");
            for (const row of rulings) {
                for (const [what, re] of [
                    ["source", SOURCE_IN_PROSE],
                    ["a form field", A_FORM_RATHER_THAN_A_SENTENCE],
                    ["a symbol", A_SYMBOL_NOT_A_WORD],
                    ["the ladder index", /ordinal \d/i]
                ] as Array<[string, RegExp]>) {
                    const hit = re.exec(row.text);
                    if (hit) offences.push(`${said} -> ${what}: ${hit[0]}`);
                }
            }
        }

        expect(
            [...new Set(offences)],
            "The engine log sits on the same screen as the prose and is rewritten by "
            + "nobody. What it says is what the player reads."
        ).toEqual([]);
    });
});