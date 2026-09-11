/**
 * The player-facing channel calls the player YOU, on every turn and in every
 * mode.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, AS IT WAS PLAYED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A run opened with no narrator model configured - which AGENTS.md names a
 * shipping mode, not a degraded one - and the first screen read:
 *
 *     Clear River Ford.
 *     Gu Lanlin is here, looking at what is on a counter and not buying.
 *     They were raised on ground like this. They have breathed nothing else
 *     and have nothing to set it against.
 *
 * The "they" in the third line is the PLAYER. Two turns later the same channel
 * said "Fang Zhenshan stands at Qi Condensation Layer 10, 9 rungs above you",
 * so one account called the player both `they` and `you`. The status sheet did
 * both inside four lines: "Nothing is owed to them and nothing is asked of
 * them" sat two lines above "however long you sit".
 *
 * ── WHY IT WAS STRUCTURAL AND NOT A WORDING SLIP ─────────────────────────
 *
 * `EngineFacts` has two channels and they had one set of sentences. `lines` is
 * shown to a narrator, who is writing ABOUT a cultivator and correctly reads
 * third person; `prose` is shown to the player, who IS the cultivator. Three
 * readings were pushed onto both: the ground read, the standing sheet, and the
 * turn-0 recap of the sixteen years. A sentence right for one consumer was
 * wrong for the other and could not be fixed by rewording it in place.
 *
 * The ruling: it says YOU.
 *
 * ── WHAT THIS PINS, AND WHAT IT DELIBERATELY DOES NOT ────────────────────
 *
 * Third person is still correct, and common, for everybody who is not the
 * player - so this never bans a pronoun outright. It reads the three places
 * whose whole subject is the player and nobody else:
 *
 *   the standing sheet   every line is about the person asking
 *   the ground read      the first paragraph of a look, after the place name
 *   the opening recap    its first sentence, which is this life so far
 *
 * Anything with somebody else in it is out of scope by construction, which is
 * why the corpus is those three rather than the whole narration.
 *
 * The runs are fresh and unhurt on purpose. The standing sheet's injury line
 * says "nothing has closed them" of the INJURIES, which is a correct third
 * person about something that is not a person, and a sheet read after a fight
 * would trip the sweep on it.
 *
 * Went red on all nine cases before the fix - every world, every arm.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';

/** A third-person reference, which in these three places can only be the player. */
const THIRD_PERSON = /\b(they|them|their|themselves)\b/i;

/** Every way of asking the engine to read the player back to themselves. */
const ASKING_ABOUT_YOURSELF = ['what is my rank', 'how am I doing', 'how hurt am I'];

/**
 * Three worlds, because the ground read branches on where the person was
 * raised against where they are standing, and one world only ever exercises
 * one branch of it.
 */
const WORLDS = ['addressed-a', 'addressed-b', 'addressed-c'];

function offence(text: string, what: string): string | null {
    const hit = THIRD_PERSON.exec(text);
    if (!hit) return null;
    const at = text.indexOf(hit[0]);
    return `${what}: ...${text.slice(Math.max(0, at - 70), at + 70).replace(/\s+/g, ' ')}...`;
}

describe('what the engine calls the player when it is the engine talking', () => {
    for (const world of WORLDS) {
        it(`${world}: the standing sheet is addressed to the person asking`, async () => {
            const h = await makeGameInWorld({ seed: `addr-${world}`, worldSeed: world });
            await h.game.newRun('Zzqq');
            const found: string[] = [];

            for (const said of ASKING_ABOUT_YOURSELF) {
                const { narration } = await h.game.act(said);
                const hit = offence(narration, said);
                if (hit) found.push(hit);
                // The sheet is the player reading themselves, so it addresses
                // them. Whether it may NAME them is settled next door in
                // `the-player-is-you.test.ts`, which carries the one exemption:
                // `who am I` reaches this sheet and the name is the question.
                expect(narration, said).toMatch(/\byou\b/i);
            }

            expect(found, found.join(' ;; ')).toEqual([]);
        }, 240_000);

        it(`${world}: the ground reads back to the person standing on it`, async () => {
            const h = await makeGameInWorld({ seed: `addr-${world}`, worldSeed: world });
            await h.game.newRun('Zzqq');

            // The turn-0 account is where this was reported from, and it was a
            // second defect with the same symptom: the opening overwrote the
            // player's channel with the narrator's before printing it, so the
            // whole first screen of a run with no model was the writer's copy.
            const opening = h.game.state().log
                .filter(e => e.turn === 0 && e.role === 'narrator')
                .map(e => e.text)
                .join('\n\n');
            expect(opening.length).toBeGreaterThan(0);

            // Place and then what this person can tell of the qi, and nobody
            // else is in it - the company is its own paragraph below.
            const { narration } = await h.game.act('I look around');
            const [ground] = narration.split('\n\n');

            expect(offence(ground, 'the ground read'), ground).toBeNull();
            // And the first screen says the same thing about the same square,
            // rather than a third-person rendering of it.
            expect(opening, opening).toContain(ground);
        }, 240_000);

        it(`${world}: the life behind the first turn is told to the one who lived it`, async () => {
            const h = await makeGameInWorld({ seed: `addr-${world}`, worldSeed: world });
            await h.game.newRun('Zzqq');

            // The turn-0 engine ruling: the sixteen years, filed whatever a
            // model does. It is the entry that opens with the age.
            const recap = h.game.state().log
                .filter(e => e.turn === 0 && e.role === 'engine')
                .map(e => e.text)
                .find(text => /^\d+ years old/.test(text));
            expect(recap, 'the opening recap reaches the player at all').toBeDefined();

            // The whole account of a life, and it never once spoke to the
            // person whose life it was.
            expect(recap, recap).toMatch(/\byou\b/i);
            // Its own first sentence is this person, where they are, and the
            // ground under them. Later lines name other people and are theirs.
            expect(offence((recap as string).split('\n')[0], 'the opening sentence')).toBeNull();
        }, 240_000);
    }
});
