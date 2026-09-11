/**
 * The opening had a recap, and the player never saw it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * FOUND BY PLAYING, WITH OLLAMA NARRATING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Turn 0, in full, after the sheet:
 *
 *     Nine Peaks. The air here is thick enough to notice on the first breath.
 *     [...] Mo Wanming is here and has not looked up. [...] Duan Huilin is
 *     here and has not looked up. Han Ronglu is here and has not looked up.
 *     [...] It is an ordinary day and it intends to stay one.
 *
 * and under it, five suggestions, two of which were *"I ask Han Ronglu to
 * teach me"* and *"I look at Mo Wanming"*.
 *
 * The design owner: *"why does this opening not give any exposition? YOU HAD A
 * LIFE BEFORE THIS POINT. [...] IT NEEDS TO EXPLAIN THESE NAMES AT THE BOTTOM
 * OTHERWISE A NEW PLAYER IS VERY CONFUSED. WHERE IS THE RECAP OF MY LIFE TO
 * THIS POINT? HAVE THE ENGINE RETURN IT FOR THE FIRST TURN."*
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO CAUSES, AND NEITHER OF THEM WAS A MISSING FEATURE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **THE RECAP WAS WRITTEN AND HAD NO CHANNEL.** `theLifeBehindTheFirstTurn`
 * composed all sixteen years and `newRun` unshifted them onto `facts.lines` -
 * which is to say handed them to a model that is asked, at the bottom of the
 * same prompt, for *"two or three short paragraphs"*. Given a dozen facts whose
 * last three are the room in front of it, a small model writes the room. Nothing
 * threw. The recap simply shared a channel with a request for brevity, and lost.
 *
 * **AND THE PEOPLE WERE NEVER IN IT AT ALL.** The recap read `birth.knowledge`,
 * which is places and houses. The PEOPLE a childhood leaves are drawn by
 * `who-a-life-like-this-grew-up-knowing.ts` into a different table and were
 * never said, so the first screen offered a verb pointed at somebody the run had
 * not introduced. The same defect as "3 names known", one table over.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE HOLDS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The engine files the years as a ruling of its own, so no model can cost a
 * player their own past - and the narrator is asked, separately and explicitly,
 * to WRITE them. Both, because they are not the same artefact: *"the LLM should
 * be doing that"*, *"write as xianxia"*. A record is what survives; an account
 * is what is worth reading.
 */

import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, UnreachableProvider } from './harness';
import type { Harness } from './harness';

const A_WORLD = 'life-recap-world';

/** A run opened in a pinned world, which is the only thing every test here needs. */
async function anOpening(over: Partial<Parameters<typeof makeGameInWorld>[0]> = {}) {
    const harness: Harness = await makeGameInWorld({
        worldSeed: A_WORLD, worldEnabled: true, ...over
    });
    const { cultivator } = await harness.game.newRun('Aspirant');
    return { ...harness, cultivator };
}

/** Every engine ruling filed on turn 0, in the order the log holds them. */
function rulingsOnTurnZero(db: Database.Database): string[] {
    return db
        .prepare("SELECT text FROM web_play_log WHERE role = 'engine' AND turn = 0 ORDER BY id")
        .all()
        .map(row => (row as { text: string }).text);
}

function narrationOnTurnZero(db: Database.Database): string {
    return db
        .prepare("SELECT text FROM web_play_log WHERE role = 'narrator' AND turn = 0 ORDER BY id")
        .all()
        .map(row => (row as { text: string }).text)
        .join('\n');
}

/** The ruling that carries the life, which is the one that is not the sheet. */
function theRecap(db: Database.Database): string {
    const recap = rulingsOnTurnZero(db).find(text => /years old, standing in/.test(text));
    expect(recap, 'no turn 0 ruling carried the life behind this cultivator').toBeDefined();
    return recap!;
}

describe('a life the narrator can drop', () => {
    /**
     * THE WHOLE DEFECT, IN ONE ASSERTION. The narration here is a single
     * sentence that mentions none of it, which is what the played model did.
     */
    it('files the sixteen years even when the narrator writes none of them', async () => {
        const provider = new ScriptedProvider({
            narrations: ['It is an ordinary day and it intends to stay one.']
        });
        const { db } = await anOpening({ provider });

        expect(narrationOnTurnZero(db)).toMatch(/ordinary day/);

        const recap = theRecap(db);
        // Where they come from, whose they are, and what it left them holding.
        expect(recap).toMatch(/years old, standing in/);
        expect(recap).toMatch(/What they came out of:/);
        expect(recap).toMatch(/spirit stones/);
    });

    /**
     * AND WHEN THERE IS NO MODEL AT ALL, which AGENTS.md calls a shipping mode
     * outright. A provider that refuses is the commonest version of this in the
     * wild - an ollama that is not running - and the opening must not be poorer
     * for it.
     */
    it('files them when the provider is unreachable', async () => {
        const { db } = await anOpening({ provider: new UnreachableProvider() });
        expect(theRecap(db)).toMatch(/years old, standing in/);
    });

    /**
     * THE NAMES AT THE BOTTOM OF THE SCREEN BELONG TO SOMEBODY.
     *
     * The suggestions point at people, so the opening has to have said who they
     * are. Every face a childhood left is named in the ruling, with the note
     * saying how this cultivator comes to know them.
     */
    it('names the people this childhood left behind', async () => {
        const { db, game, cultivator } = await anOpening();

        const faces = game.knowledge.awareness(cultivator.id, 'cultivator');
        expect(faces.length, 'this world left no faces to check').toBeGreaterThan(0);

        const recap = theRecap(db);
        for (const face of faces) {
            expect(recap, `the opening never said who ${face.name} is`).toContain(face.name);
        }
        // Acquaintance and nothing more. `who-a-life-like-this-grew-up-knowing`
        // grants no favour, and an opening implying one hands over the thing the
        // player is supposed to go and earn.
        expect(recap).toMatch(/not the same as being owed anything by them/);
    });

    /**
     * AND ONCE, NOT TWICE. `facts.prose` is what a player reads when no model
     * answers, and composing it after the recap was unshifted onto `facts.lines`
     * is what would print the sixteen years a second time on that path.
     */
    it('does not print the life twice when no model answers', async () => {
        const { db } = await anOpening({ provider: new UnreachableProvider() });
        const everything = [...rulingsOnTurnZero(db), narrationOnTurnZero(db)].join('\n');
        expect(everything.match(/years old, standing in/g) ?? []).toHaveLength(1);
    });

    /**
     * THE OTHER HALF, AND THE REASON THE RULING IS NOT THE WHOLE FIX. A record
     * is what survives a model; it is not an opening. The narrator is asked for
     * the years in its own voice, and told which turn is the one that has them.
     */
    it('asks the narrator to write the years rather than to skip them', async () => {
        const provider = new ScriptedProvider({ narrations: ['prose'] });
        await anOpening({ provider });

        const narration = provider.calls.find(call =>
            (call.messages.find(m => m.role === 'system')?.content ?? '')
                .startsWith('You are the narrator'));
        expect(narration, 'the opening never asked for prose').toBeDefined();

        const asked = narration!.messages.find(m => m.role === 'user')?.content ?? '';
        expect(asked).toContain('THE LIFE BEHIND THIS CULTIVATOR');
        expect(asked).toMatch(/OPEN BY WRITING THOSE YEARS/);
        // And the instruction that ate the childhood is not still sitting at the
        // bottom of the same prompt contradicting it.
        expect(asked).not.toMatch(/Write two or three short paragraphs/);
    });

    /**
     * AND THE GENRE'S OWN WORDS ARE IN FRONT OF IT. The played opening was
     * correct modern English, which is the register of a ruling and not of the
     * world. The lexicon is tier 1 in `docs/world/writing/tone.md`, so it is in
     * the system prompt of every narration rather than only of this one.
     */
    it('hands the narrator the vocabulary this world uses for itself', async () => {
        const provider = new ScriptedProvider({ narrations: ['prose'] });
        await anOpening({ provider });

        const system = provider.calls
            .map(call => call.messages.find(m => m.role === 'system')?.content ?? '')
            .find(text => text.startsWith('You are the narrator')) ?? '';

        expect(system).toContain('The words this world uses for itself');
        expect(system).toMatch(/jade beauty/);
        expect(system).toMatch(/fairy/i);
        expect(system).toMatch(/dantian/);
        expect(system).toMatch(/qi deviation/);
        // And the terms that are the ENGINE's rather than the genre's, which is
        // why a paraphrase puts two vocabularies on one screen.
        expect(system).toMatch(/muddled/i);
        expect(system).toMatch(/spirit stones/i);
    });

    /**
     * AND THE ONE FACT THE PLAYER IS NOT TOLD STAYS THAT WAY. The debt was safe
     * while it existed only in a prompt the narrator was ordered not to repeat.
     * The engine prints this channel now, so the exclusion is a property of the
     * row rather than an instruction to a model.
     */
    it('never prints what the world knows and the player does not', async () => {
        const { db } = await anOpening();
        expect(theRecap(db)).not.toMatch(/carrying the debt for it/);
    });
});
