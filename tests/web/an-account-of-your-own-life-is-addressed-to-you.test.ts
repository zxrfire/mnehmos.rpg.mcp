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
 * ── THE FOURTH PLACE: THE STORED RECORDS THEMSELVES ──────────────────────
 *
 * Three sentences survived the pass above because they are not authored prose.
 * They are KNOWLEDGE RECORDS, written at birth and quoted verbatim into the
 * opening recap and into `recall`. Played with no model, the opening read:
 *
 *     What you came out of: A farm in a thin county.
 *     You are standing here with 30 spirit stones, ...
 *     Deep Snow Village is where they are from. Where they grew up.
 *     Liang Peilu. Has been at the far end of that street since before either
 *     of them was anybody.
 *
 * and mid-run `what do I know about Six Li` put the record straight against the
 * sentence that reads it back:
 *
 *     Six Li is where they are from. You are sure of that much.
 *     You were there for it. Where they grew up.
 *
 * A record is HELD BY somebody and rows exist for NPCs, so third person in a
 * record is not wrong in itself. What was missing is that a holder reading
 * their own record is being addressed.
 *
 * The row is persisted and `recall` reads it back out of SQLite, so a second
 * wording would have to survive the round trip; and it cannot be derived on the
 * way out either, because a pronoun in a record points at the holder in some
 * rows and at the SUBJECT in others - "X is from home. Knowing them is not the
 * same as being owed anything by them" is one of the rows being read. So the
 * holder left the stored sentence instead, and the single wording is now right
 * to both readers and after a round trip.
 *
 * These two cases sweep the RECORDS rather than the prose: every recap line
 * that opens with a name this life holds, and the round trip through `recall`
 * on the one place whose subject is the holder. The sweep is per line and never
 * over the whole recap, because the line introducing the childhood faces says
 * "owed anything by them" of the faces and is correct.
 *
 * Red on four of the six before the change: the home-place record in all three
 * worlds, both through the recap and through `recall`, and the childhood-face
 * note on the world that drew it.
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

/** Every name this cultivator holds a record on, read out of the listing verb. */
function namesHeld(listing: string): string[] {
    return listing
        .split(/\n+/)
        .flatMap(line => {
            const row = /^(?:People|Places|Houses|Things that happened): (.+)\.$/.exec(line.trim());
            return row ? row[1].split(', ').map(name => name.trim()) : [];
        })
        .filter(name => name.length > 0);
}

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

        it(`${world}: the records this life opens holding address the one holding them`, async () => {
            const h = await makeGameInWorld({ seed: `addr-${world}`, worldSeed: world });
            await h.game.newRun('Zzqq');

            const recap = h.game.state().log
                .filter(e => e.turn === 0 && e.role === 'engine')
                .map(e => e.text)
                .find(text => /^\d+ years old/.test(text)) as string;
            expect(recap, 'the opening recap reaches the player at all').toBeDefined();

            // Read out of the game rather than hard-coded: any name the recap
            // quotes a record for is a name this verb lists.
            const held = namesHeld((await h.game.act('what do I know')).narration);
            expect(held.length, 'a run opens holding names').toBeGreaterThan(0);

            const quoted = recap.split('\n').filter(line =>
                held.some(name => line.startsWith(`${name}.`) || line.startsWith(`${name} `)));
            expect(quoted.length, `the recap quotes a record: ${recap}`).toBeGreaterThan(0);

            const found = quoted
                .map(line => offence(line, 'a record quoted into the opening'))
                .filter((hit): hit is string => hit !== null);
            expect(found, found.join(' ;; ')).toEqual([]);
        }, 240_000);

        it(`${world}: a record read back out of the database still addresses its holder`, async () => {
            const h = await makeGameInWorld({ seed: `addr-${world}`, worldSeed: world });
            await h.game.newRun('Zzqq');

            // The one record whose subject is the holder themselves: where they
            // are from. `recall` reads it out of SQLite, which is what a second
            // wording composed in memory at birth would not have survived.
            const home = h.game.state().cultivator.location as string;
            const { narration } = await h.game.act(`what do I know about ${home}`);

            // `factsForRecall` files each record as the statement and then the
            // line saying how it arrived, so the pair is the record. The
            // closing sentence about whether two records are the same thing
            // says `them` of the RECORDS and is correctly outside this slice.
            const said = narration.split(/\n{2,}/);
            const about = said.flatMap((part, at) =>
                part.includes(home) ? [part, said[at + 1] ?? ''] : []);
            expect(about.length, narration).toBeGreaterThan(0);

            const found = about
                .map(part => offence(part, 'a record read back out of the database'))
                .filter((hit): hit is string => hit !== null);
            expect(found, found.join(' ;; ')).toEqual([]);
        }, 240_000);
    }
});
