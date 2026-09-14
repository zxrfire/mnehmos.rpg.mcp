/**
 * A beast kill somebody answers for, played.
 *
 * `who-answers-for-a-beast-that-was-killed.ts` had no caller anywhere in
 * `src/`, and it took something larger down with it: `Beast.disposition` is
 * read in exactly one file and it is that one, so the catalog set righteous,
 * neutral or demonic on every row in the world and nothing live ever asked.
 *
 * So the assertions here are about the played surface rather than the module.
 * The one that matters most is the third: killing a DEMONIC beast off
 * somebody's ground opens a favour they owe you, through the identical call
 * that opens a grudge for a righteous one. One expression, both signs, and no
 * branch anywhere on what the thing was.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { beastsOnThisGround, hasACore }
    from '../../src/engine/world/hunting-a-spirit-beast.js';
import { isOnAVein, isSealedOn, whatGroundThisIs }
    from '../../src/engine/world/what-ground-a-place-is.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import type { LocationRecord } from '../../src/engine/world/locations.js';
import type { BeastDisposition } from '../../src/data/cultivation/beasts.js';

const WORLD = 'kill-answer';

/**
 * A cored species that is really standing on this piece of ground.
 *
 * ASKED OF THE ENGINE RATHER THAN NAMED. Going out after one in particular
 * reaches it where it lives and is refused where it does not, so a fixture that
 * names a glacier animal and stands the player on a mountain is arranging a
 * situation the game cannot produce. The Glacier Lynx was doing exactly that.
 */
function aCoredOneOn(
    world: WorldState, place: LocationRecord, leaning: BeastDisposition
): string | null {
    const grounds = whatGroundThisIs(world, place);
    const here = beastsOnThisGround({
        sealed: isSealedOn(place, world.currentDay),
        onAVein: isOnAVein(world, place, grounds),
        grounds: grounds ?? undefined
    }).filter(b => hasACore(b) && b.disposition === leaning);
    return here[0]?.name ?? null;
}

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

/**
 * A cultivator standing on a house's own ground, four realms above anything
 * they are about to meet.
 *
 * The gap is deliberate and it is not the point of the test: below it a hunt
 * breaks off on the round budget rather than finishing, so nothing is killed
 * and the path under test is never entered. Four realms is `assessPower`'s own
 * one-action resolution, which is the reliable way to get a body.
 */
async function standingOnAHousesGround(seed: string) {
    const { game, db } = await makeGameInWorld({ seed, worldSeed: WORLD });
    await game.newRun('Hunter');
    const say = (s: string) => game.act(s) as Promise<Said>;
    await say('ADMIN set_realm ordinal=34');

    const world = (game as unknown as { atHand: WorldState }).atHand;
    // A seat whose ground carries both signs, so the pair of cases below is
    // one arrangement rather than two that happen to share a fixture.
    const seat = world.locations.find(l =>
        l.kind === 'sect_seat' && l.controllingFactionId !== null
        && aCoredOneOn(world, l, 'righteous') !== null
        && aCoredOneOn(world, l, 'demonic') !== null)
        ?? world.locations.find(
            l => l.kind === 'sect_seat' && l.controllingFactionId !== null)!;
    await say(`ADMIN move ${seat.name}`);
    return {
        game, db, say, seat,
        righteous: aCoredOneOn(world, seat, 'righteous'),
        demonic: aCoredOneOn(world, seat, 'demonic')
    };
}

function obligationsAbout(db: unknown, subjectId: string): {
    id: string; kind: string; holder_id: string; subject_id: string;
    cause: string; severity: string; triggering_event_id: string | null;
}[] {
    return (db as { prepare(sql: string): { all(...a: unknown[]): unknown[] } })
        .prepare('SELECT * FROM obligations WHERE subject_id = ? OR holder_id = ?')
        .all(subjectId, subjectId) as never;
}

describe('who answers for a beast you killed', () => {
    it('opens an account against you when the ground had somebody on it', async () => {
        const { say, db, righteous } = await standingOnAHousesGround('answer-a');
        expect(righteous, 'no righteous cored species stands on that seat').not.toBeNull();
        const said = await say(`I hunt the ${righteous}`);

        // The engine's own line, and it names the two halves the module
        // decides: how many parties can put a name to it, and what the house
        // does about it.
        expect(said.narration ?? '').toMatch(/can say whose doing it was/);

        const me = (db as unknown as { prepare(q: string): { get(): { id: string } } })
            .prepare('SELECT id FROM cultivators LIMIT 1').get();
        const rows = obligationsAbout(db, me.id);
        expect(rows.length).toBeGreaterThan(0);
        // The account rests on an event that is IN the ledger. A house owed
        // something for a killing nobody can repeat is the defect this column
        // has always existed to prevent.
        for (const row of rows) expect(row.triggering_event_id).not.toBeNull();
    }, 300_000);

    it('opens nothing at all where nobody was standing behind it', async () => {
        // Most of the hunting trade, and the reason it is a trade. A beast on
        // ground nobody holds is nobody's.
        const { game } = await makeGameInWorld({ seed: 'answer-b', worldSeed: WORLD });
        await game.newRun('Hunter');
        const say = (s: string) => game.act(s) as Promise<Said>;
        await say('ADMIN set_realm ordinal=34');
        const world = (game as unknown as { atHand: WorldState }).atHand;
        const open = world.locations.find(
            l => l.kind === 'settlement' && l.controllingFactionId === null
                && aCoredOneOn(world, l, 'righteous') !== null
        );
        if (!open) return;
        await say(`ADMIN move ${open.name}`);
        const said = await say(`I hunt the ${aCoredOneOn(world, open, 'righteous')}`);
        expect(said.narration ?? '').not.toMatch(/can say whose doing it was/);
    }, 300_000);

    it('turns the demonic side of the catalog into a favour, through the same call', async () => {
        // THE ASSERTION THAT MAKES `disposition` LIVE. `whoPaidFor` is the one
        // read of it, and it flips which side of the transfer paid without a
        // second code path: killing the thing that had been taking from a
        // district is a kindness done to the district, priced by the machinery
        // that prices every other kindness.
        const ground = await standingOnAHousesGround('answer-c');
        expect(ground.righteous, 'no righteous cored species on that seat').not.toBeNull();
        expect(ground.demonic, 'no demonic cored species on that seat').not.toBeNull();
        const righteous = await ground.say(`I hunt the ${ground.righteous}`);
        const demonic = await ground.say(`I hunt the ${ground.demonic}`);

        expect(righteous.narration ?? '').toMatch(/the name on it is the person who did it/);
        expect(demonic.narration ?? '').toMatch(/is owed something/);
        expect(demonic.narration ?? '').not.toMatch(/the name on it is the person who did it/);
    }, 300_000);

    it('makes the killing something people repeat', async () => {
        // The world CONTAINS it. Before this the obligation ledger could say a
        // house was owed something for an event that was in no ledger anybody
        // reads - so nobody could repeat it, no digest carried it, and a
        // stranger asking about this cultivator found nothing.
        const { say, righteous } = await standingOnAHousesGround('answer-d');
        expect(righteous, 'no righteous cored species stands on that seat').not.toBeNull();
        const before = await say('what do people say about me');
        await say(`I hunt the ${righteous}`);
        const after = await say('what do people say about me');
        expect(after.narration ?? '').not.toBe(before.narration ?? '');
    }, 300_000);
});
