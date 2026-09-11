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
 *
 * ── FOUR PINNED CLAIMS WERE MEASURED AND WERE WRONG ──────────────────────
 *
 * The section was written off one work's opening chapters. Re-measured across
 * twenty-four books, 311,360 paragraphs and 789,521 sentences - twenty-two of
 * them professionally translated, plus one volume by another author and one
 * machine translation held out as a control:
 *
 *     "Six does not occur"          16,687 paragraphs of >=6 sentences exist,
 *                                   6,858 of them with no speech in them, and
 *                                   the shape occurs in every book measured.
 *                                   Always assessment, never mood
 *     "A third of spoken lines
 *      carry no tag"                two thirds do - 65% of quoted spans,
 *                                   per-book mean, and no book below 54%.
 *                                   The claim was inverted
 *     "Interiority is one short
 *      sentence, and it assesses"   the assesses half is the rule; the length
 *                                   half banned a paragraph the genre leans on
 *     "It is, There is are the
 *      loudest signal of the
 *      wrong genre"                 2.78 per 100 sentences, nowhere near zero
 *                                   in any book, and they carry the explanatory
 *                                   frames. Narrowed to the two habits that
 *                                   were actually wrong
 *
 * Books are weighted equally rather than pooled: the corpus runs 2,821 to
 * 90,580 paragraphs a book, so a pooled average is the longest book's opinion.
 *
 * One claim STRENGTHENED on the wider corpus rather than breaking. `said`
 * outweighs every other dialogue tag combined 1.46 to 1 across the twenty-two
 * professionally translated books (per-book mean 1.40, lowest 0.92). At
 * sixteen books this could only be stated conditionally, because the machine
 * translation - which runs 0.21, and produces tag variety exactly the way an
 * unprompted model does - dragged the pooled figure to a tie.
 *
 * So the wording assertions below name the CORRECTED rules, and a second set
 * asserts the reverted claims are gone. That second set is the durable half:
 * it survives any rewording and goes red if somebody restores a claim the
 * corpus contradicts.
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
            'One to three sentences is the house style at every height',
            'The funny beat is three paragraphs',
            'takes a person or a thing as its subject',
            'The narration argues',
            "Never close on the day's temper",
            'People speak, and the speech carries the scene',
            'The tag is the plain one',
            'Speech is loud',
            'Terms are stated in full, by a person',
            'Standing shows in who defers',
            'Interiority assesses',
            'A refusal is short, unsoftened and unexplained',
            'A jump in time is three words'
        ]) expect(prompt, rule).toContain(rule);
    });

    it('does not restore a claim the corpus contradicts', () => {
        // Each of these shipped for a while and each is measurably false. The
        // measurements are in this file's header and in `how-the-prose-moves.md`.
        const prompt = narrationSystemPrompt();
        for (const [gone, why] of [
            ['Six does not occur', "long paragraphs exist and are the genre's reasoning paragraph"],
            ['A third of spoken lines carry no tag', 'two thirds do; the claim was inverted'],
            ['Interiority is one short sentence, and it assesses', 'it runs as long as the calculation']
        ] as const) expect(prompt, why).not.toContain(gone);

        // The fourth correction cannot be pinned by absence: the page states the
        // claim in order to retract it. Pin the retraction instead.
        expect(prompt).toContain('this is not a ban on');
        expect(prompt).toContain("is the engine's voice. This is the narrator's");
    });

    it('does not state the paragraph rule unconditionally, and does state the sentence one', () => {
        // ── TWO SHIPPED GUIDANCE SETS MET AT ORDINAL 0 ────────────────────
        // This page told every turn to write one to three sentences. The ladder
        // page had measured the paragraph SHORTENING as reach grows - 37.9 mean
        // words low against 32.2 and 28.3, four-plus-sentence paragraphs 29.7%
        // low against 15.8% middle, falling monotonically book by book in one
        // arc and halving in the other - which makes the terse paragraph a
        // HIGH-band form. Played at Qi Condensation in a market town, the
        // opening came back clipped and world-weary: the top of the ladder
        // written at the bottom of it.
        //
        // What is pinned is the SPLIT and not the wording: the paragraph is
        // named as the part that moves with height, the sentence as the part
        // that does not, and the bottom as the expansive band. Collapsing
        // either half back into an unconditional rule restores the collision.
        const prompt = narrationSystemPrompt();
        expect(prompt).toContain('The sentence is the invariant');
        expect(prompt).toMatch(/paragraphs of four or more[\s\S]{0,80}29\.7%/);
        expect(prompt).toMatch(/bottom[\s\S]{0,120}long paragraph is twice as common/);
        // The correction must not swing the other way: the low band gets a
        // longer paragraph, not licence for the speechless reasoning block,
        // which is distributed by work rather than by height.
        expect(prompt).toContain('the low band does not lift that');
    });

    it('still permits the long reasoning paragraph, and still forbids musing', () => {
        // The correction that is easiest to lose: a later editor tightening the
        // paragraph rule would silently re-ban the genre's commonest paragraph.
        // Both halves have to survive together or the rule means nothing.
        const prompt = narrationSystemPrompt();
        expect(prompt).toContain('a long paragraph does occur');
        expect(prompt).toContain('may run as long as the assessment does');
        expect(prompt).toMatch(/reason at length and\s+may never muse/);
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
