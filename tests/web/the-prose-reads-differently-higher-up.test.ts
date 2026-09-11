/**
 * The narrator was never told where on the ladder the cultivator stood.
 *
 * `narrationSystemPrompt` takes no arguments and `NarratorScene` carried no
 * standing, so nothing about the prose could vary with height. The ladder doc
 * already ruled that anything reading the same at Qi Condensation and at
 * Tribulation Transcendence is wrong at one end; the rule reached the prompt and
 * the selector did not, which made it advice a model could only guess at.
 *
 * Measured across two complete series arcs of twelve and nine books, weighted
 * equally because the longest book is ten times the shortest and pooling let one
 * dictate every figure. A property counts only if it trends across BOTH arcs,
 * book one through the last: the mean paragraph falls from 37.9 words to 32.2
 * and 28.3, six-sentence paragraphs from 8.4% to 2.8% and 1.0%, one-sentence
 * paragraphs rise from 22.8% to 29.7%, and forms of address roughly halve. Price
 * and favour words fall from 1.6 per hundred sentences to 0.6 and 0.2, but as a
 * step after the second book rather than a slope. Median sentence length has no
 * consistent direction in either arc and stays between twelve and fifteen words.
 *
 * That last one is why the guidance says the SENTENCE must not change, and it is
 * the reason the bands are named rather than described as heights. A model told
 * only that the register climbs reaches for grandeur in the grammar, which is
 * the one thing twenty-one books agree stays flat.
 *
 * What is pinned here is reach and variation, never wording: that all three
 * bands are tier 1 so the contrast is in every prompt, that a real played turn
 * carries the band selector, that the selector MOVES when the cultivator does,
 * and that the rung itself never reaches a model - the whole design is that the
 * narrator is told how far an act carries and not what rank produced it.
 *
 * Broken deliberately to check it can fail: dropping `realmOrdinal` from the
 * scene at the played call site takes the two played cases red and leaves the
 * seven direct ones green, which is the split that says the wiring is what they
 * cover.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    REGISTER_BANDS,
    theRegisterAtThisHeight,
    composeNarrationUser,
    narrationSystemPrompt,
    theVoiceDoc
} from '../../src/web/prompt';
import { MAX_ORDINAL, realmForOrdinal } from '../../src/engine/cultivation/realms';
import { makeGame, ScriptedProvider } from './harness';

const LADDER_PATH = 'docs/world/writing/what-changes-as-the-ladder-is-climbed.md';

/** Facts thin enough that nothing but the register block can satisfy an assertion. */
const FACTS = { lines: ['Nothing in particular happened.'], prose: '' } as never;
const SCENE = { place: 'the ford', ambient: 'thin' } as never;

/** Every user message the provider was sent for prose, in order. */
function narrationsSentTo(provider: ScriptedProvider): string[] {
    return provider.calls
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');
}

describe('the prose reads differently higher up', () => {
    it('keeps every band tier 1, so the contrast is in every prompt', () => {
        const doc = readFileSync(LADDER_PATH, 'utf-8');
        const voice = theVoiceDoc();
        for (const band of REGISTER_BANDS) {
            const at = doc.indexOf(`### ${band}`);
            expect(at, `${band} is gone from ${LADDER_PATH}`).toBeGreaterThan(-1);
            expect(doc.slice(at, at + 200)).toMatch(/<!--\s*tier:\s*1/);
            // The band NAME is all the prompt sends, so the doc is the only
            // copy of the prose. A band whose section stopped being tier 1
            // would leave the selector pointing at nothing.
            expect(voice, `${band} does not reach the narrator`).toContain(band);
        }
        expect(narrationSystemPrompt()).toContain(REGISTER_BANDS[2]);
    });

    it('carries the finding the register most depends on', () => {
        // If the sentence rule goes, the rest of the section reads as licence to
        // write grandly at height, which is the failure it exists to prevent.
        expect(theVoiceDoc()).toContain('The sentence itself does not change');
    });

    it('bands the whole ladder, and each band claims some of it', () => {
        const seen = new Set<string>();
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const band = theRegisterAtThisHeight(ordinal);
            expect(REGISTER_BANDS).toContain(band);
            seen.add(band);
        }
        expect(seen.size).toBe(REGISTER_BANDS.length);
    });

    it('reads the same band for every rung of one realm', () => {
        // The boundary is a realm, not an ordinal. A sub-rank that changed the
        // register would make the prose lurch inside a single climb.
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const realm = realmForOrdinal(ordinal);
            expect(
                theRegisterAtThisHeight(ordinal),
                `${realm.name} is split across bands at ordinal ${ordinal}`
            ).toBe(theRegisterAtThisHeight(realm.ordinalStart));
        }
    });

    it('puts the band in the prompt and the rung nowhere in it', () => {
        const message = composeNarrationUser(FACTS, { ...SCENE, realmOrdinal: 0 });
        expect(message).toContain(REGISTER_BANDS[0]);
        expect(message).toContain('Do not state the rung');
        // The narrator is given how far an act carries, never the ordinal it
        // was derived from, because nobody in the world perceives an ordinal.
        expect(message).not.toContain('realmOrdinal');
        expect(message).not.toMatch(/Qi Condensation|Foundation Establishment/);
    });

    it('says nothing about register when the caller did not say where they stand', () => {
        const message = composeNarrationUser(FACTS, SCENE);
        for (const band of REGISTER_BANDS) expect(message).not.toContain(band);
    });

    it('varies with standing, which is the whole point', () => {
        const low = composeNarrationUser(FACTS, { ...SCENE, realmOrdinal: 0 });
        const high = composeNarrationUser(FACTS, { ...SCENE, realmOrdinal: MAX_ORDINAL });
        expect(low).toContain(REGISTER_BANDS[0]);
        expect(high).toContain(REGISTER_BANDS[2]);
        expect(low).not.toContain(REGISTER_BANDS[2]);
        expect(high).not.toContain(REGISTER_BANDS[0]);
    });

    it('reaches a played turn, and not only the opening', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['The square is what it was yesterday.']
        });
        const { game } = makeGame({ provider });
        await game.newRun('Villager');
        await game.act('I look around.');

        const sent = narrationsSentTo(provider);
        expect(sent.length).toBeGreaterThan(1);
        for (const message of sent) expect(message).toContain('THE REGISTER FOR THIS TURN:');
    });

    it('moves the band when the cultivator moves, in one played run', async () => {
        // Both arms in one command and one tree, per AGENTS.md. A run opens at
        // the bottom of the ladder; the same run promoted reads differently.
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['The square is what it was yesterday.']
        });
        const { game, repos } = makeGame({ provider });
        const opened = await game.newRun('Villager');
        await game.act('I look around.');
        const atTheBottom = narrationsSentTo(provider).at(-1)!;

        repos.cultivators.update(opened.cultivator.id, { realmOrdinal: MAX_ORDINAL } as never);
        await game.act('I look around.');
        const atTheTop = narrationsSentTo(provider).at(-1)!;

        expect(atTheBottom).toContain(REGISTER_BANDS[0]);
        expect(atTheTop).toContain(REGISTER_BANDS[2]);
    });
});
