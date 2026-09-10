/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ENGINE MAY STATE A FINDING. IT MAY NOT READ OUT ITS OWN COLUMNS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The third of this repo's engine-voice guards, and the one with the SURFACE.
 * `the-engine-states-findings-not-its-rubric.test.ts` tests one function,
 * `no-source-in-the-players-face.test.ts` tests one channel, and `exposition`
 * tests the narrator. None of them was ever handed a played turn, so every leak
 * below survived all three.
 *
 * WHAT THIS PLAYS AND WHERE IT LOOKS. Twelve mechanics, a handful of sentences
 * each, through the real service - and then it reads EVERY channel a player can
 * end up in front of, which is the half that matters. The narration was already
 * clean; `structure`, carried on the tool calls, was not, and AGENTS.md is
 * explicit that it is shown in every mode:
 *
 *   *"`structure` is the mechanical channel and it is shown to the player in
 *   every mode, so 'mechanical' has never meant 'may be unreadable'. It means
 *   the fact without the mood - not the fact replaced by its own arithmetic."*
 *
 * EIGHT LEAKS, ALL FOUND BY PLAYING, ALL IN THAT CHANNEL:
 *
 *     "the rate multiplier at Qi Condensation Layer 1 is 0"
 *     "priced by regard at ordinal 0"                      (twice)
 *     "Satiety already 100/100"
 *     "Satiety is down to 20"                              (twice)
 *     "Resolved \"someone\" to cultivator npc-109"          (twice)
 *     "npc-174 (Qiu Nuohe) in world state"
 *     "a horizon of 0.0 travel days at ordinal 0"
 *     "4 HP lost"
 *
 * Two of those printed a database key beside the person's own name, which was
 * in the very next clause.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS BANNED AND WHAT IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The ruling: **ban raw stats, allow in-world estimation.** So a bare
 * percentage goes, `HP` and `Satiety` and `ordinal` go, and a row id goes. What
 * STAYS is every number a person standing there could give you - 30 spirit
 * stones, 15 rations, two and a bit years, a wall somebody judges at roughly
 * one in three. This guard is about the engine naming its own machinery, never
 * about the engine being precise.
 *
 * A NEW MECHANIC BELONGS IN THE LIST BELOW. That is the whole design of it: the
 * patterns are cheap and the coverage is the sentence list, so a mechanic
 * nobody added here is a mechanic this does not protect.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';

const SAID: Record<string, string[]> = {
    cultivation: ['I look around', 'I cultivate for a year', 'what is my rank',
        'how am I doing', 'am I at a bottleneck', 'where should I cultivate'],
    breakthrough: ['I try to break through', 'what is stopping me'],
    money: ['what do I have', 'how many rations do I have', 'I gather herbs',
        'what is this worth'],
    body: ['how hurt am I', 'am I hungry', 'I eat'],
    sects: ['what sects are near here', 'what is my standing'],
    people: ['who is here', 'I talk to someone', 'who is the strongest person here'],
    combat: ['I attack someone', 'I punch him', 'I stab him in the throat',
        'I break off', 'how strong is he', 'am I strong enough to fight him'],
    techniques: ['what techniques do I know', 'I practise the sword art',
        'what can I learn here', 'who would teach me'],
    travel: ['where can I go', 'I travel to the nearest town', 'what roads are there',
        'how far is it'],
    seclusion: ['I go into seclusion for a year', 'I seal myself away for ten years'],
    oaths: ['what oaths am I carrying', 'what do I owe'],
    sitting: ['I cultivate for ten years anyway']
};

// A bare percentage, and raw identifiers the engine has in-world words for.
const BANNED: Array<[RegExp, string]> = [
    [/\b\d+(?:\.\d+)?\s?%/, 'a bare percentage'],
    [/\bHP\b/, 'HP'],
    [/\bmaxHp\b/i, 'maxHp'],
    [/\bsatiety\b/i, 'satiety'],
    [/\bspiritStones\b/, 'spiritStones (the identifier)'],
    [/\brealmOrdinal\b/i, 'realmOrdinal'],
    [/\bordinal\b/i, 'ordinal'],
    [/\bmultiplier\b/i, 'multiplier'],
    [/\bmodifier\b/i, 'modifier'],
    [/\bfactionId\b|\bnpc-\d+\b|\bsect-[a-z-]+\b|\bloc-[a-z-]+\b/, 'an internal id']
];

describe('what a played turn puts in front of a player', () => {
    for (const [mechanic, lines] of Object.entries(SAID)) {
        it(`${mechanic}: no engine voice in any channel`, async () => {
            const h = await makeGameInWorld({ seed: `voice-${mechanic}`, worldSeed: 'voice-w' });
            await h.game.newRun('Probe');
            const leaks: string[] = [];
            for (const said of lines) {
                let out = '';
                try {
                    const r = await h.game.act(said) as {
                        narration?: string;
                        events?: unknown[];
                        toolCalls?: Array<{ summary?: string }>;
                    };
                    // EVERY CHANNEL, not just the narrated one. `structure`
                    // rides on the tool calls and is printed verbatim.
                    out = [
                        r.narration,
                        ...(r.events ?? []).map(e => JSON.stringify(e)),
                        ...(r.toolCalls ?? []).map(c => String(c.summary ?? ''))
                    ].filter(Boolean).map(String).join(' | ');
                } catch (err) {
                    // A refusal is an answer and is read like any other.
                    out = String(err);
                }
                for (const [pattern, name] of BANNED) {
                    const found = pattern.exec(out);
                    if (!found) continue;
                    const at = out.indexOf(found[0]);
                    leaks.push(
                        `${name} in "${said}": ...`
                        + out.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, ' ')
                        + '...');
                }
            }
            expect(leaks, leaks.join(' ;; ')).toEqual([]);
        }, 240_000);
    }
});
