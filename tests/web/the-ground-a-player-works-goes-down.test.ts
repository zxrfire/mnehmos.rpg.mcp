/**
 * The counted stock is reached by playing, not only by a unit test.
 *
 * AGENTS.md's most-repeated defect is a module nothing calls: a subsystem that
 * is designed, written, tested and rendered, and that nothing in the running
 * game ever reaches. `what-a-place-still-has-in-the-ground.ts` is exactly the
 * shape that happens to - a pure module with its own unit tests - so the
 * question this file exists to answer is the only one that matters about it:
 *
 *     does a player typing a sentence move the number?
 *
 * The world is pinned as well as the run, because these assertions turn on
 * which place the run opens in and what grows there.
 *
 * ── WHAT THE FIRST ASSERTION USED TO SAY, AND WHY IT STOPPED BEING TRUE ──
 *
 * It said the gather wrote TWO cells and no more, and that the amount on them
 * was 1: a player was the only thing in the world that drew from the ground
 * when this file was written (a7ae1f78). The next commit the same day
 * (8cab8c96, *the ground goes down under the people who stand on it*) made the
 * district's own people work it every year, and the first turn of any run steps
 * a whole world-year - `applyPressure` owns a year whose first day falls in the
 * span and simulates it atomically, so seven played days at Old River Village
 * step year 1000 entire.
 *
 * Measured on this fixture, seed `stock-a` in `ground-stock-world`: the first
 * gather leaves EIGHT cells, four bands of two - herb and beast material at
 * mortal and at immortal, the grades the people standing there work - and the
 * mortal herb band reads 1,645 drawn against a capacity of 4,886. One of those
 * 1,645 is the player's. The old assertion was pinning a count the engine chose
 * and a world with nobody else in it.
 *
 * ── SO THE PLAYER'S OWN ARMFUL IS SEPARATED FROM THE DISTRICT'S YEAR ─────
 *
 * The second gather is the measurement, because no year turns over inside it:
 * day 365,007 to 365,014 owns no year start, and the test asserts that by
 * checking every other band's stamp is where the first turn left it. What the
 * ground would hold on that day without the player is `standingStock` read off
 * a copy of the record taken before the turn - regrowth and all - and what it
 * actually holds is that figure less the one herb they carried off. Measured:
 * a mortal band of 4,886 regrows 93.704 over the seven days a gather takes and
 * the record fell by 92.704.
 *
 * That is the assertion a return value cannot make. A `drawFromTheGround` that
 * computed the right number and persisted none of it reads identically from the
 * caller's side, so the figure is taken off the WORLD - and off a world
 * reloaded out of SQLite at the end, which is the only read that can tell a
 * write from a write onto a copy.
 */
import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { resetCultivationWorlds, worldForRun } from '../../src/server/state/cultivation-world';
import { worldLocationFor } from '../../src/web/entities';
import {
    STOCK_GRADES,
    capacityFor,
    drawFromTheGround,
    drawnOnDayKey,
    howTheGroundReads,
    recordGroundDraw,
    standingStock
} from '../../src/engine/world/what-a-place-still-has-in-the-ground';
import type { TechniqueGrade } from '../../src/schema/cultivation';

const WORLD = 'ground-stock-world';

type Game = Awaited<ReturnType<typeof makeGameInWorld>>['game'];

/** The world row for wherever the run's cultivator is standing. */
async function groundUnderThePlayer(game: Game) {
    const state = game.state();
    const run = state.run!;
    const world = await worldForRun(run as never);
    const place = worldLocationFor(world, state.cultivator.location);
    expect(place, 'the pinned world does not know where the run opened').not.toBeNull();
    return { world, place: place! };
}

/** The bands a place carries, and which cells each of them keeps. */
function bandsOn(place: { data: Record<string, unknown> }): Map<string, string[]> {
    const bands = new Map<string, string[]>();
    for (const key of Object.keys(place.data)) {
        if (!key.startsWith('ground.')) continue;
        const cut = key.lastIndexOf('.');
        const band = key.slice(0, cut);
        bands.set(band, [...(bands.get(band) ?? []), key.slice(cut + 1)].sort());
    }
    return bands;
}

/**
 * One played gather, and the grade of what came out of the ground.
 *
 * Read off the turn's own record rather than fixed here: which herb this
 * ground puts up is the catalog's business, and a grade typed into a test is a
 * second copy of that decision.
 */
async function gatherOne(game: Game): Promise<TechniqueGrade> {
    const turn = await game.act('I gather herbs') as {
        toolCalls?: { name: string; summary: string }[];
    };
    const pouched = (turn.toolCalls ?? []).find(call => call.name === 'storage.addToPouch');
    expect(pouched, 'the gather took nothing, so there is no draw to follow').toBeDefined();
    const grade = /\((\w+)\) added to the pouch/.exec(pouched!.summary)?.[1];
    expect(STOCK_GRADES, `"${pouched!.summary}" names no grade`).toContain(grade);
    return grade as TechniqueGrade;
}

describe('a player working the ground moves the number', () => {
    it('writes the band down on the place after a gather', async () => {
        const { game } = await makeGameInWorld({ seed: 'stock-a', worldSeed: WORLD });
        await game.newRun('Digger');

        const before = await groundUnderThePlayer(game);
        const untouched = Object.keys(before.place.data)
            .filter(k => k.startsWith('ground.'));
        expect(untouched, 'a fresh world starts with nothing drawn').toEqual([]);

        await gatherOne(game);
        const marked = await groundUnderThePlayer(game);
        const bands = bandsOn(marked.place);
        expect([...bands.keys()], 'a played turn left no mark on the ground at all')
            .not.toHaveLength(0);
        // Two cells per band and no more: an amount and a day. A counted thing
        // is a number on a row, and a third field here would be the start of
        // giving it a history. How MANY bands is the district's business.
        for (const [band, cells] of bands) {
            expect(cells, `${band} keeps more than an amount and a day`)
                .toEqual(['day', 'drawn']);
        }

        // ── AND THE ARMFUL THE PLAYER CARRIED OFF, ON ITS OWN ────────────
        //
        // The record as it stood before the second gather, kept so the same
        // read can be asked what this ground would hold today with nobody
        // working it.
        const wasStanding = { ...marked.place, data: { ...marked.place.data } };

        const grade = await gatherOne(game);
        const now = await groundUnderThePlayer(game);
        const onDay = Math.floor(now.world.currentDay);
        const mine = `ground.herb.${grade}`;

        // Nothing but the player wrote in that span, which is what makes the
        // arithmetic below a measurement rather than a hope. If a world-year
        // ever does turn over inside it, this says so instead of quietly
        // crediting the district's take to the player.
        for (const band of bandsOn(now.place).keys()) {
            if (band === mine) continue;
            expect(now.place.data[`${band}.day`], `${band} moved: a world-year turned over `
                + 'inside the span and the player\'s own draw cannot be separated from it')
                .toBe(wasStanding.data[`${band}.day`]);
        }

        const withoutThePlayer = standingStock(wasStanding, 'herb', grade, onDay).remaining;
        const onTheRecord = standingStock(now.place, 'herb', grade, onDay).remaining;
        expect(onTheRecord, 'the herb that went into the pouch came off nothing')
            .toBeCloseTo(withoutThePlayer - 1, 6);
        expect(now.place.data[drawnOnDayKey('herb', grade)], 'the mark is not today\'s')
            .toBe(onDay);

        // AND IT IS IN THE STORE, NOT ONLY IN THE HANDLE. Dropping the world
        // cache forces the reload out of SQLite, which is the read that can
        // tell a persisted write from one onto a copy.
        const groundCellsOf = (place: { data: Record<string, unknown> }) =>
            Object.fromEntries(Object.entries(place.data).filter(([k]) => k.startsWith('ground.')));
        const inTheHandle = groundCellsOf(now.place);
        resetCultivationWorlds();
        const reloaded = await groundUnderThePlayer(game);
        expect(groundCellsOf(reloaded.place), 'the drawdown never reached the world\'s own store')
            .toEqual(inTheHandle);
    }, 120_000);

    it('answers what a place still has when the player looks at it', async () => {
        // The read that stops this being a simulation nobody can see. Asked of
        // the province, because that is a name that resolves to a place: a
        // settlement usually shares its name with the house that runs it, and
        // the house wins the lookup. That is entity resolution's business and
        // not this file's, but it is why the province is what gets examined.
        const { game } = await makeGameInWorld({ seed: 'stock-b', worldSeed: WORLD });
        await game.newRun('Surveyor');
        const { world, place } = await groundUnderThePlayer(game);
        const province = world.locations.find(l => l.id === place.parentId) ?? place;

        const said = await game.act(`I examine ${province.name}`) as { narration?: string };
        expect(said.narration ?? '').toContain(`The ground around ${province.name}`);
    }, 120_000);

    it('says so in prose when a district has been worked out', async () => {
        // Stripping a band the honest way - a hundred played passes - is not a
        // test, it is a soak. So the band is emptied through the same engine
        // call the verb uses and the VERB is then asked what it says, which is
        // the half that could be broken without anybody noticing.
        const { game } = await makeGameInWorld({ seed: 'stock-c', worldSeed: WORLD });
        await game.newRun('Stripper');
        const { world, place } = await groundUnderThePlayer(game);

        for (const grade of STOCK_GRADES) {
            const draw = drawFromTheGround(place, {
                kind: 'herb',
                grade,
                wanted: capacityFor(place, 'herb', grade),
                onDay: Math.floor(world.currentDay)
            });
            recordGroundDraw(place, draw);
        }

        expect(howTheGroundReads(place, Math.floor(world.currentDay)))
            .toContain('worked out');

        const said = await game.act('I gather herbs') as { narration?: string };
        // Nothing came out of the ground, and the player is told why rather
        // than handed a quieter yield.
        expect(said.narration ?? '').toMatch(/worked out|last of|bare ground|nothing/i);
    }, 120_000);

    it('keeps the drawdown across a new life in the same world', async () => {
        // The stock is on the WORLD, not on the run. A district somebody
        // stripped is still stripped for whoever comes next, which is the whole
        // reason the clock is the world's.
        const { game } = await makeGameInWorld({ seed: 'stock-d', worldSeed: WORLD });
        await game.newRun('First');
        const first = await groundUnderThePlayer(game);

        const draw = drawFromTheGround(first.place, {
            kind: 'beast_material',
            grade: 'earth',
            wanted: 40,
            onDay: Math.floor(first.world.currentDay)
        });
        recordGroundDraw(first.place, draw);

        const later = standingStock(
            first.place, 'beast_material', 'earth', Math.floor(first.world.currentDay)
        );
        expect(later.remaining).toBe(draw.after);
        expect(later.remaining).toBeLessThan(later.capacity);
    }, 120_000);
});
