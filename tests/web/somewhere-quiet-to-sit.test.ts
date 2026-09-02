/**
 * Crowding: the strongest lever in the game, and the player could not reach it.
 *
 * Measured by a playtester across five places on one character: 0.171 qi-units
 * a day at the emptiest, 0.763 at the busiest. A 4.5x spread, wider than the
 * whole thin-to-normal ambient band range, with `thin` empty ground beating
 * `normal` crowded ground by 2.7x. It decides whether the Foundation wall is
 * passable inside a lifetime.
 *
 * Three separate failures kept it out of reach, and this file covers all three:
 *
 *   INVISIBLE     the sheet said `Ambient qi: THIN` and nothing about who else
 *                 was standing there, while the engine's own encounter line
 *                 read "comfortably carries 3 and currently holds 9".
 *   UNASKABLE     "how crowded is it here" resolved into no action at all.
 *   UNREACHABLE   `where can I go` listed only settlements the player had names
 *                 for - two towns, both crowded - while 34 caves, wilds and
 *                 veins sat in the same world, already discovered, 31 of them
 *                 empty. `move` would have accepted any of them by name all
 *                 along; nobody was ever told the names.
 */

import { parseIntent } from '../../src/web/actions';
import { KnowledgeGate } from '../../src/web/knowledge';
import { DAO_GROUND_TAG } from '../../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { makeGame, planned, engineCalls } from './harness';

describe('the question a player asks the moment occupancy matters', () => {
    it('resolves, in the ways somebody actually asks it', () => {
        for (const text of [
            'how crowded is it here',
            'how busy is this place',
            'how many cultivators are here',
            'who else is drawing on this ground',
            'is it crowded here'
        ]) {
            const action = parseIntent(text);
            expect(action.action, text).toBe('look');
            expect(action.intent, text).toBe('crowding');
        }
    });

    it('does not swallow the ordinary look, or the place history', () => {
        expect(parseIntent('I look around').intent).not.toBe('crowding');
        // Place history is also a `look`, with its own intent. What must not
        // happen is the crowding branch taking it, since it fires first.
        expect(parseIntent('what happened here').intent).toBe('history');
    });
});

describe('somewhere quiet to sit', () => {
    /**
     * Every one of these was typed in play and every one of them failed - two
     * into nothing at all, one into the room description. They are asking where
     * there is empty ground, which is what `destinations` answers.
     */
    it('routes the phrasings a player actually used', () => {
        for (const text of [
            'I seek an uninhabited place to cultivate',
            'I go into the wilds to find a secluded spot',
            'I look for a quiet cave in the mountains',
            'somewhere away from the crowds',
            'I want an empty valley to sit in'
        ]) {
            expect(parseIntent(text).action, text).toBe('destinations');
        }
    });

    /**
     * The guard on the other side. `move` owns a named journey and `gather`
     * owns a search for herbs; a pattern wide enough to catch the sentences
     * above must not take either, which is the documented failure mode of every
     * previous widening in this file.
     */
    it('leaves the neighbouring verbs alone', () => {
        expect(parseIntent('I travel to Nine Peaks').action).toBe('move');
        expect(parseIntent('I go into the mountains to Scarwater').action).toBe('move');
        expect(parseIntent('I look for herbs').action).toBe('gather');
        expect(parseIntent('I pick the mushrooms by the quiet stream').action).toBe('gather');
    });
});

describe('the ground under the cultivator, on the wire', () => {
    /**
     * ── Re-derived under the perception ruling, not weakened ─────────────
     *
     * This assertion used to read `supported > 0` and `share > 0` on a fresh
     * run, and it was right when it was written: the lever was invisible and
     * putting the figures on the sheet was the fix. The design owner has since
     * ruled that reading a vein is a skill that arrives with the ladder - "you
     * can't tell at qi condensation, you can just say the qi feels light or
     * heavy" - so at ordinal 0 those two fields are deliberately null and the
     * sheet falls back to a headcount and a feeling.
     *
     * What the original test was defending has NOT moved and is asserted below:
     * the sheet still carries occupancy, and it still says something a player
     * can act on. The figures themselves are covered at every band in
     * `what-you-can-tell-about-the-ground.test.ts`.
     */
    it('reports who is drawing on it, at the resolution the reader has', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Wei Zhaoxun');
        await game.act('I look around');

        const ground = game.state().derived.ground;
        expect(ground, 'the sheet carries no occupancy at all').not.toBeNull();
        // Counting the people in a square is not a skill, so this survives at
        // every height and is what the sheet shows instead of a percentage.
        expect(ground!.heads).toBeGreaterThanOrEqual(1);
        expect(ground!.line.length).toBeGreaterThan(0);

        // A first-year disciple is not handed a surveyor's figures.
        expect(ground!.supported).toBeNull();
        expect(ground!.share).toBeNull();
        expect(ground!.line).not.toMatch(/\d/);
    }, 60_000);

    it('answers the question with something the reader could actually tell', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Wei Zhaoxun');
        const asked = await game.act('how crowded is it here');

        expect(planned(asked).action).toBe('look');
        // The low end has to stay ACTIONABLE, which is the constraint that
        // makes the gate a design and not a nerf: no arithmetic, and still a
        // statement about this ground that can be compared against another.
        expect(asked.narration).toContain('What gets to you here');
        expect(asked.narration).not.toContain('comfortably carries');
    }, 60_000);

    /**
     * The whole point. The read used to be settlements only, so a player asking
     * where to go was answered with the towns and never with the empty ground
     * in the same province.
     */
    it('lists ground that is not a town, with how busy each place is', async () => {
        const { game } = makeGame({ worldEnabled: true });
        await game.newRun('Wei Zhaoxun');
        const where = await game.act('where can I go');

        const rows = engineCalls(where)
            .filter(call => call.name === 'engine.whereCouldTheyGo')
            .map(call => call.summary)
            .join(' ');
        expect(rows).toContain('place(s) this cultivator can point at');

        // Occupancy on every row the world holds a record for, and at least one
        // destination that is not a settlement.
        expect(where.narration).toMatch(/drawing on it|Nobody is drawing on it/);
        expect(where.narration).toMatch(/a cave|the wilds|a spirit vein/);
    }, 60_000);
});

/**
 * AND IT IS STILL GATED.
 *
 * The read above was fixed by walking the world's own location table into a
 * player-facing list with no knowledge check anywhere in it, which closed one
 * hole by opening another: a cultivator holding no record for any of them was
 * handed The Glass Field and The Nine-City Assize by name, and would have been
 * handed any prospected find that landed on one of the three kinds.
 *
 * Those are dao grounds - `how-a-cultivator-comes-by-a-road.ts` seeds its
 * `open` catalog rows as ordinary `wilds`, discovered from day one - and this
 * read is the only place in the played game they appear at all.
 *
 * The fix is not an exclusion list. It is the gate the rest of the read
 * already uses, applied here too, with the ordinary local ground granted at
 * birth as a real record so the farm boy keeps his caves.
 */
describe('the ground is learned, not handed over', () => {
    it('names nothing this cultivator has no record for', async () => {
        const { db, game } = makeGame({ worldEnabled: true, seed: 'gated-ground' });
        const created = await game.newRun('Wei Zhaoxun');
        const where = await game.act('where can I go');

        const world = await game.loadWorld();
        expect(world).not.toBeNull();
        const gate = new KnowledgeGate(db);

        // Every piece of quiet ground the world holds, anywhere: whatever the
        // read named, this cultivator can point at.
        const quiet = world!.locations.filter(row =>
            row.kind === 'wilds' || row.kind === 'cave' || row.kind === 'vein');
        expect(quiet.length, 'the world holds no quiet ground to test against').toBeGreaterThan(0);

        let named = 0;
        for (const row of quiet) {
            if (!(where.narration ?? '').includes(row.name)) continue;
            named++;
            expect(
                gate.canPointAt(created.cultivator.id, 'place', row.id)
                || gate.awareness(created.cultivator.id, 'place')
                    .some(held => held.name === row.name
                        && gate.canPointAt(created.cultivator.id, 'place', held.id)),
                `${row.name} was named to somebody holding no record for it`
            ).toBe(true);
        }
        expect(named, 'nothing was named, so this proves nothing').toBeGreaterThan(0);
    }, 120_000);

    it('does not hand over a road that teaches itself', async () => {
        const { game } = makeGame({ worldEnabled: true, seed: 'gated-ground' });
        await game.newRun('Wei Zhaoxun');
        const where = await game.act('where can I go');

        const world = await game.loadWorld();
        const dao = world!.locations.filter(row => row.tags.includes(DAO_GROUND_TAG));
        expect(dao.length, 'no dao ground in this world to withhold').toBeGreaterThan(0);
        for (const ground of dao) {
            expect(where.narration ?? '', `${ground.name} leaked`).not.toContain(ground.name);
        }
    }, 120_000);
});
