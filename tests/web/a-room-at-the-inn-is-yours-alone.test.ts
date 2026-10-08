/** Staffdiagnostic07 measured baseline19 PASS against candidate13 PASS/6 FAIL.
 * At the ordinary rental clock, the canonical trading inn worker was alive at
 * the same town but packed into the noodle stall; the guest was at the inn and
 * no keeper could receive payment. Service workers now claim their actual
 * service bin before ordinary packing. Existing rental/privacy assertions stay
 * unchanged; explicit rooms, company, absence and offshift work remain real.
 * This successor has not been compiled or run; prior proof is native, not model. */
/** Diagnostic07 limits the observer to canonical inn-first selection. It uses
 * only the new pure worker helper on the baseline, without candidate service
 * exports or any baseline engine caller. Later counters cannot alter inn choice.
 * This is diagnostic context, not a claim that other venue workers were selected. */
/** Diagnostic06 retains the ordinary opening rental fixture unchanged. Its
 * observed candidate refusal is still evidence, not rewritten into success.
 * Before rental, record actual canonical worker/routine/area/listener facts to
 * distinguish an unstaffed shift from a worker placed in another table area. */
/** Diagnostic04: paired03 proved baseline19 PASS versus candidate10 PASS/9 FAIL,
 * with frozen integrity, but the JSON reporter captured no console observations.
 * This file sink supplies actual setup/receipt evidence; assertions remain unchanged. */
import { appendFileSync } from 'node:fs';
import { workersAtPublicCounters, workingWorldCounterFacts } from '../../src/engine/world/who-is-working-at-a-public-counter.js';
import { npcsStandingIn } from '../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { routineOf } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { theAreaNamed } from '../../src/web/walking-across-a-place.js';
import { whoKeepsTheCounter } from '../../src/web/who-keeps-a-counter-here.js';
import type { GameService } from '../../src/web/turn-engine.js';
/**
 * The room you paid for is yours, and nobody else is in it.
 *
 * The owner: "go to your room, sleep, wake up ... in the room is just yourself
 * (unless ur with a party), but you do rest up". Played: "head up to my room"
 * reached a house's interior room somewhere else and was refused, and the sleep
 * after it was dropped with it.
 *
 * A run now opens at 08:00 (`turn-engine.ts`'s `newRun` advances the clock a
 * third of a day before any act), and a lesser act spends a fraction of a day
 * (`lesser-action-costs.ts`), so the clock is no longer pinned at 0 the way it
 * was when this file was written. A walk from one area of a place to another -
 * up to a room, back down, out to the street - now genuinely costs a quarter
 * day each hop (`walkAcrossThePlace`'s own "A quarter day passed"); that is
 * new and correct, the stairs just no longer being free rather than the walk
 * itself. The two assertions updated below expect that quarter day, and the
 * "already paid for" assertion moved to a delta against a baseline, which is
 * what it was actually about: a repeated buy that changes nothing spends
 * nothing MORE, even though the run clock itself is no longer zero.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld, ScriptedProvider } from './harness';

const WORLD = 'road-world';
function recordStaffInnDiagnostic(value: unknown): void {
    const target = process.env.RPG_STAFF_INN_DIAGNOSTIC_PATH;
    if (target) appendFileSync(target, JSON.stringify(value) + '\n', 'utf8');
}



function recordActualInnWork(game: GameService): void {
    const world=game.atHand,body=game.currentRun().cultivator;
    if(!world)throw new Error('Ordinary opening diagnostic lost actual world');
    const place=worldLocationFor(world,body.location??'');
    if(!place)throw new Error('Actual opening body has no place');
    // Inn is first in the single canonical deal; later counters cannot change its selected ID.
    const counters=['inn'] as const;
    const people=npcsStandingIn(world,place.id);
    const workers=workersAtPublicCounters(world,place.name,people,counters);
    const facts=workingWorldCounterFacts(world,people,counters);
    const placement=peopleInThisPlace(game.repos,body,world,place);
    const selected=workers.get('inn');
    const inn = theAreaNamed(placement.areas, 'inn');
    if (!selected || !inn) throw new Error('Ordinary opening lacks actual inn and working person');
    expect(placement.whereIs.get(selected.id), 'selected worker is physically at the inn').toBe(inn.id);
    recordStaffInnDiagnostic({staff08InnDiagnostic:'pre-rental actual worker truth',
        body:{id:body.id,location:body.location,standingIn:body.standingIn},
        day:world.currentDay,hour:world.currentHour,counters,
        selected:selected?.id??null,keeperAtCurrentArea:whoKeepsTheCounter(game,body,'inn',['inn']),
        currentPresent:game.present(body).map(person=>person.id),
        areas:placement.areas.map(area=>({id:area.id,name:area.name,for:area.for})),
        workers:facts,
        localPeople:people.map(person=>({id:person.id,status:person.status,
            occupation:person.identity.occupation,activity:person.activity,
            routine:routineOf(world,person),area:placement.whereIs.get(person.id)??null}))});
}

describe('a room at the inn', () => {
    it('is a walk up, with nobody in it, and the night there is rest', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Lu Qingmo');
        recordActualInnWork(game);
        const debugRental = await game.act('I take a room at the inn for two nights');
        recordStaffInnDiagnostic({ staff08InnDiagnostic: 'ordinary opening rental', result: debugRental, body: game.state().cultivator, clock: game.state().run.elapsedDays });
        const before = game.state().run.elapsedDays;

        const up = await game.act('I go up to my room');
        expect(up.narration).toMatch(/to your room at the inn/);
        // Walking to another area of the same place is a quarter day
        // (`walkAcrossThePlace`), not the full day on the road the played bug
        // spent - "not a day" is the claim, and it never meant free.
        expect(game.state().run.elapsedDays, 'a walk up the stairs is not a day').toBe(before + 0.25);
        expect(game.present(repos.cultivators.getById(cultivator.id)!)).toEqual([]);

        const slept = await game.act('I sleep for 2 nights');
        expect(game.state().run.elapsedDays - before - 0.25).toBeCloseTo(2);
        expect(slept.narration).not.toMatch(/seclusion|worn the body/);
    }, 120_000);

    it('is somewhere else where no room was taken here', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Lu Qingmo');
        const standing = game.state().cultivator.location;

        // Not lodged, "my room" is the home read's to answer - a house's quarters, or nowhere.
        const up = await game.act('I go up to my room');
        expect(game.state().cultivator.location).toBe(standing);
        expect(up.narration).not.toMatch(/your room at the inn/);
    }, 120_000);

    // Played: "sweet, ill grab a room for tonight then" came from the model as a buy of the inn's
    // own name, and nothing on the board is called that.
    it('is taken when the model buys the inn by its name', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"buy","target":"The Eleven Beds"}'], narrations: ['The opening.', 'A room.']
        });
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD, provider });
        await game.newRun('Lu Qingmo');
        await game.act('sweet, ill grab a room for tonight then');
        expect(game.state().log.some(entry => entry.role === 'engine' && /^A room at /.test(entry.text))).toBe(true);
    }, 120_000);

    /** Played: a second "crash for the night" bought "0 night(s) for 0 cash" and the narrator slept it. */
    it('says a room already paid for is already yours, and spends nothing [already-paid-room-no-op-zero]', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Lu Qingmo');
        await game.act('I take a room at the inn');
        const stones = game.state().cultivator.spiritStones;
        const before = game.state().run.elapsedDays;

        const again = await game.act('I take a room at the inn');
        expect(again.narration).toMatch(/already yours through day \d+; nothing more is bought/);
        expect(game.state().cultivator.spiritStones).toBe(stones);
        expect(game.state().run.elapsedDays).toBe(before);
        expect(again.toolCalls.some(call => call.name === 'engine.lesserActionTime')).toBe(false);
    }, 120_000);

    /**
     * Played: "head back downstairs" came as move(the town they stood in) and spent a day on
     * the road. The bug was the ROAD day - walking out of a place you stand in is never that -
     * not the quarter day `walkAcrossThePlace` now spends on a genuine area-to-area hop, which
     * this test's two moves both still are. Only the final, repeated "go to town" - naming the
     * area already stood in - is the free, refused no-op the title is about.
     */
    it('never spends a day going to the place they already stand in', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Lu Qingmo');
        const town = game.state().cultivator.location;
        await game.act('I take a room at the inn');
        await game.act('I go up to my room');
        const before = game.state().run.elapsedDays;

        const down = await game.act(`I go to ${town}`);
        expect(down.narration).toMatch(/from your room at the inn to /);
        expect(game.state().run.elapsedDays).toBe(before + 0.25);

        await game.act('I go out to the street');
        const there = await game.act(`I go to ${town}`);
        expect(there.narration).toMatch(/already/i);
        expect(game.state().run.elapsedDays).toBe(before + 0.5);
    }, 120_000);

    // Played: "crash for the night" in the paid room read as nothing, and the model's sleep was
    // refused for having no reading beside it.
    it.each([
        ['crash for the night', 1],
        ['ok im gonna crash for the night', 1],
        ['hit the sack', 1],
        ['call it a night', 1],
        ['bed down for 2 nights', 2]
    ])('reads the words people sleep in as a night: %s', (said, nights) => {
        expect(parseIntent(said)).toMatchObject({ action: 'wait', days: nights });
    });

    it('does not read a collision as sleep', () => {
        expect(parseIntent('I crash into him').action).not.toBe('wait');
    });

    /** Played: the model handed "ok head up to my room" over as target "room". */
    it('takes a bare "room" as the room at the inn', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Lu Qingmo');
        await game.act('I take a room at the inn');

        const up = await game.act('I go to room');
        expect(up.narration).toMatch(/to your room at the inn/);
        // Alone in it, nobody is standing close enough to ask what a stray sentence meant.
        const stray = await game.act('Qixuanzhe');
        expect(stray.narration).not.toMatch(/asked what was meant/);
        expect(game.present(repos.cultivators.getById(cultivator.id)!)).toEqual([]);
    }, 120_000);

    /** The owner: a room is an area "at an inn (or in your sect, or a cave)". */
    it('is their quarters at their own house\'s seat, and nobody else is in them', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Lu Qingmo');
        const world = (await game.loadWorld())!;
        const seat = world.locations.find(l => l.kind === 'sect_seat'
            && typeof (l.data as { factionId?: unknown }).factionId === 'string'
            && repos.sects.getById((l.data as { factionId: string }).factionId) !== null)!;
        const houseId = (seat.data as { factionId: string }).factionId;
        repos.sects.addMember(houseId, cultivator.id, 0);
        repos.cultivators.update(cultivator.id, { location: seat.name, sectId: houseId });

        const up = await game.act('I go to my room');
        expect(up.narration).toMatch(/to your quarters/);
        expect(game.present(repos.cultivators.getById(cultivator.id)!)).toEqual([]);
    }, 120_000);

    it('comes back down to the inn', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Lu Qingmo');
        await game.act('I take a room at the inn');
        await game.act('I go up to my room');

        const down = await game.act('I go downstairs');
        expect(down.narration).toMatch(/from your room at the inn to /);
    }, 120_000);
});
