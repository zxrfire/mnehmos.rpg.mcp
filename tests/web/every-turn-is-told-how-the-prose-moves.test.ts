/**
 * The narrator was told what to say and never how the sentence should move.
 *
 * Played openings came back as competent quiet English literary fiction - "It
 * is the ground they were raised on", "The day asks nothing in particular" -
 * with every existing rule obeyed. The register rules govern the paragraph and
 * the vocabulary section governs the nouns; nothing governed the sentence in
 * between, so the model wrote the sentence it writes by default. The design
 * owner ruled the fix scope as the whole game rather than the opening.
 *
 * The guidance is a tier-1 section of `tone.md` rather than a constant in
 * `prompt.ts` because `theVoiceDoc` loads that file's tier-1 sections into the
 * single narration system prompt, which is the same prompt on every turn. A
 * copy in `prompt.ts` is the arrangement that already drifted once.
 *
 * What is pinned here is reach and shape, never wording: that the section is
 * still tier 1, that it arrives at a REAL played turn rather than only at a
 * direct call, and that it still carries worked pairs - a small local model
 * copies a pair and argues with a rule.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { narrationSystemPrompt, theVoiceDoc, TONE_PATH } from '../../src/web/prompt';
import { makeGame, ScriptedProvider } from './harness';

/** The heading the tier marker has to stay attached to. */
const HEADING = '## The prose is translated xianxia, not an English novel';

describe('the narrator is told how the prose moves', () => {
    it('keeps the section at tier 1, which is what puts it in every turn', () => {
        const doc = readFileSync(TONE_PATH, 'utf-8');
        const from = doc.indexOf(HEADING);
        expect(from, `${HEADING} is gone from ${TONE_PATH}`).toBeGreaterThan(-1);

        // The marker is the parseable comment immediately after the heading,
        // which is the whole of how a section earns its place in the prompt.
        const marker = doc.slice(from, from + 200);
        expect(marker).toMatch(/<!--\s*tier:\s*1/);
        expect(theVoiceDoc()).toContain(HEADING);
    });

    it('reaches the one narration prompt, so it reaches every narrated turn', () => {
        const prompt = narrationSystemPrompt();
        for (const rule of [
            'Paragraphs run one to three sentences',
            'The funny beat is three paragraphs',
            'takes a person or a thing as its subject',
            'Never close on the mood or the weather',
            'People speak, and the speech carries the scene',
            'The tag is the plain one',
            'Terms are stated in full, by a person',
            'Standing shows in who defers',
            'Interiority is one short sentence, and it assesses',
            'A refusal is short, unsoftened and unexplained',
            'A jump in time is three words'
        ]) expect(prompt, rule).toContain(rule);
    });

    it('carries worked pairs and not only rules', () => {
        const prompt = narrationSystemPrompt();
        // Both halves of one pair, so a rewrite that keeps the rule and drops
        // the example goes red. The wrong half is real narration this engine
        // produced; the right half is the same facts.
        expect(prompt).toContain('It is the ground they were raised on.');
        expect(prompt).toContain('You grew up on this ground.');
        // A pair from a turn that is not the opening, because the ruling was
        // that the whole game reads this way.
        expect(prompt).toContain('There is nothing there to reach with.');
        expect(prompt).toContain("The elder's hand leaves your head.");
    });

    it('arrives at a played turn that is not the opening', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['The square is what it was yesterday.']
        });
        const { game } = makeGame({ provider });
        await game.newRun('Villager');
        await game.act('I look around.');

        const narrations = provider.calls
            .map(call => call.messages.find(m => m.role === 'system')?.content ?? '')
            .filter(system => !system.startsWith('You are the intent router'));

        expect(narrations.length).toBeGreaterThan(0);
        for (const system of narrations) expect(system).toContain(HEADING);
    });

    it('does not spend the name gate to buy the register', () => {
        // The pairs put speech and swagger in the prose. Neither may loosen the
        // rule that a name the player has not been told cannot appear.
        const prompt = narrationSystemPrompt();
        expect(prompt).toContain('WHAT MAY BE NAMED');
        expect(prompt).toContain('A line is not an outcome');
    });
});
