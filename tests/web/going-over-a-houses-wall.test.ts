/**
 * The third road past a house's gate: over the wall, past the people on it.
 *
 * `standing-at-the-gate-of-a-house.ts` documented it as built in every piece and not wired:
 * `reachThrough` takes `enteredAt`, `concealmentHolds` answers whether a declared approach survives
 * a witness at or above your rung, and `what-a-house-does-when-it-catches-you.ts` is the cost of
 * failing. Before this, "I sneak in" at a gate was answered with the gate's own read, as if the
 * player had walked up to it, and "I go over the wall" reached nothing at all.
 *
 * What the assertions hold, all of it the owner's:
 *   - a witness below your rung does not see you, and one at or above it does
 *   - getting in unseen stands you in the forecourt in the areas read, where a member let in
 *     stands, so anything read by area there reads for you
 *   - being inside without leave is a standing fact, and somebody of the house at or above your
 *     rung who is standing with you later catches you
 *   - being caught is answered by the house's alignment: "depends on the sect. for righteous,
 *     maybe thrown with a warning; neutral, maybe crippling, maybe an arm, idk; demonic, possible
 *     death." A righteous house that already holds a trespass answers the next one harder, and a
 *     lost arm is a limb wound, not a crippling
 *   - walking in openly is still the gate's check, and "sneak in" with no gate here is still
 *     "Into what?"
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import { theOneWhoSeesThem } from '../../src/web/inside-without-leave';
import { FLAG_INSIDE_WITHOUT_LEAVE } from '../../src/web/flag-keys';
import { readFlag, writeFlag } from '../../src/server/consolidated/cultivation-support';
import {
    theStructureTheyHave,
    whatATrespassCosts
} from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { getSect } from '../../src/data/cultivation/sects';
import { theAreaTheyAreIn } from '../../src/web/walking-across-a-place';
import { theHouseThisNameReaches } from '../../src/web/walking-up-to-a-house';
import {
    theAreasOf,
    theOneOnWatchAtTheGate,
    whoCouldBeSentToTheGate
} from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { npcsStandingIn } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import type { NpcRecord } from '../../src/engine/world/npc-state';

type Played = { narration?: string; toolCalls: { name: string; action: string; summary: string }[] };
const said = (turn: Played) => [turn.narration ?? '', ...turn.toolCalls.map(call => call.summary)].join('\n');
const names = (turn: Played) => turn.toolCalls.map(call => call.name);

const HOUSE = 'Azure Dew Sect';

describe('the words', () => {
    it('reads going over a wall, or past a watch, as going in', () => {
        for (const sentence of [
            'I sneak in', 'I go over the wall', 'I climb over the wall', 'I scale the wall',
            'I sneak past the watch', 'I sneak around the gate', 'I infiltrate the sect'
        ]) {
            const plan = parseIntent(sentence);
            expect(plan.action, sentence).toBe('move');
            expect(plan.intent, sentence).toBe('enter');
        }
        // A wall gone over is the way in, not a destination.
        expect(parseIntent('I go over the wall').target).toBeUndefined();
        // Reading the wall is still reading it.
        expect(parseIntent('I read the wall').action).toBe('look');
    });
});

describe('who sees somebody going unseen', () => {
    const at = (ordinal: number, id = `w${ordinal}`) =>
        ({ id, cultivation: { realmOrdinal: ordinal } }) as unknown as NpcRecord;

    it('is anybody at or above their rung, and nobody below it', () => {
        expect(theOneWhoSeesThem(10, [at(9), at(3)])).toBeNull();
        expect(theOneWhoSeesThem(10, [at(9), at(10)])?.id).toBe('w10');
        expect(theOneWhoSeesThem(10, [at(12), at(10)])?.id).toBe('w12');
        // Nobody is below the bottom rung, so a mortal is seen by anybody at all.
        expect(theOneWhoSeesThem(0, [at(0)])?.id).toBe('w0');
        expect(theOneWhoSeesThem(10, [])).toBeNull();
    });
});

async function atTheGate(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'road-world' });
    await harness.game.newRun('Probe');
    await harness.game.act(`I travel to the ${HOUSE}`);
    const world = (await harness.game.loadWorld())!;
    const house = theHouseThisNameReaches(world, HOUSE)!;
    expect(house, `no ${HOUSE} in this world`).not.toBeNull();
    const me = () => harness.game.currentRun().cultivator;
    expect(theAreaTheyAreIn(world, me())?.area.for, 'the gate did not stop a stranger').toBe('gate');
    return { harness, world, house, me };
}

/** A rung above everybody of the house who is on the wall. */
function aboveTheWall(world: Awaited<ReturnType<typeof atTheGate>>['world'], house: { factionId: string; seat: any }): number {
    const yard = npcsStandingIn(world, house.seat.id).filter(npc => npc.factionId === house.factionId);
    const watch = theOneOnWatchAtTheGate(world, house.seat) ?? whoCouldBeSentToTheGate(world, house.seat);
    const top = Math.max(0, ...[...yard, ...(watch ? [watch] : [])].map(npc => npc.cultivation.realmOrdinal));
    expect(top + 1, 'the house has somebody on its wall at the top of the ladder').toBeLessThanOrEqual(MAX_ORDINAL);
    return top + 1;
}

describe('over the wall, played', () => {
    it('gets somebody above everyone on the wall inside unseen, standing where a member let in stands', async () => {
        const { harness, world, house, me } = await atTheGate('over-the-wall-unseen');
        harness.repos.cultivators.update(me().id, { realmOrdinal: aboveTheWall(world, house) });

        const turn = await harness.game.act('I sneak in') as Played;
        expect(names(turn), said(turn)).toContain('world.goingOverTheWall');
        expect(said(turn)).toMatch(/Nobody sees you/);
        expect(names(turn)).not.toContain('social.whatATrespassCosts');

        const firstForecourt = theAreasOf(world, house.seat).areas.find(area => area.for === 'forecourt')!;
        expect(theAreaTheyAreIn(world, me())?.area.id).toBe(firstForecourt.id);
        expect(readFlag(harness.db, me().id, FLAG_INSIDE_WITHOUT_LEAVE)).not.toBeNull();
        // Inside the walls, so the gate stands between them and nothing.
        const again = await harness.game.act('I go over the wall') as Played;
        expect(said(again)).toMatch(/inside the walls of/);
        expect(names(again)).not.toContain('world.goingOverTheWall');
    }, 300_000);

    it('is seen on the wall by anybody at or above the rung, and the house answers it', async () => {
        const { harness, house, me, world } = await atTheGate('over-the-wall-seen');
        // A new life is at the bottom rung, and everybody of a house is at or above it.
        expect(me().realmOrdinal).toBe(0);

        const turn = await harness.game.act('I go over the wall') as Played;
        expect(said(turn)).toMatch(/sees you on it/);
        expect(names(turn), said(turn)).toContain('social.whatATrespassCosts');
        expect(ledgerAbout(harness.db, me().id)
            .some(row => row.holderId === house.factionId && row.tags.includes('over_the_wall')), said(turn)).toBe(true);
        // Never got in.
        expect(theAreaTheyAreIn(world, me())?.area.for).toBe('gate');
        expect(readFlag(harness.db, me().id, FLAG_INSIDE_WITHOUT_LEAVE)).toBeNull();
    }, 300_000);

    it('keeps them inside without leave until somebody at or above their rung stands with them', async () => {
        const { harness, world, house, me } = await atTheGate('over-the-wall-later');
        const rung = aboveTheWall(world, house);
        harness.repos.cultivators.update(me().id, { realmOrdinal: rung });
        await harness.game.act('I sneak in');
        expect(readFlag(harness.db, me().id, FLAG_INSIDE_WITHOUT_LEAVE)).not.toBeNull();

        // Somebody of the house comes and stands with them, below their rung, and then at it.
        const today = Math.floor(world.currentDay);
        const at = world.npcs.findIndex(npc => npc.status === 'alive' && npc.factionId === house.factionId
            && npc.locationId !== house.seat.id);
        expect(at, 'nobody of the house anywhere else').toBeGreaterThanOrEqual(0);
        const standWithThem = (ordinal: number) => {
            const npc = world.npcs[at]!;
            world.npcs[at] = {
                ...npc,
                locationId: house.seat.id,
                cultivation: { ...npc.cultivation, realmOrdinal: ordinal },
                activity: { kind: 'talking', withIds: [me().id], sinceDay: today, untilDay: today + 1 }
            };
            harness.game.theWorldMoved();
        };

        standWithThem(rung - 1);
        const below = await harness.game.act('who is here?') as Played;
        expect(names(below), said(below)).not.toContain('social.whatATrespassCosts');
        expect(readFlag(harness.db, me().id, FLAG_INSIDE_WITHOUT_LEAVE)).not.toBeNull();

        standWithThem(rung);
        const seen = await harness.game.act('who is here?') as Played;
        expect(said(seen)).toMatch(/where you have no leave to be/);
        expect(names(seen)).toContain('social.whatATrespassCosts');
        expect(ledgerAbout(harness.db, me().id)
            .some(row => row.holderId === house.factionId && row.tags.includes('over_the_wall'))).toBe(true);
        expect(readFlag(harness.db, me().id, FLAG_INSIDE_WITHOUT_LEAVE)).toBeNull();
    }, 300_000);

    it('answers walking in openly with the gate, and never goes over the wall', async () => {
        const { harness, world, me } = await atTheGate('in-through-the-gate');
        for (const sentence of ['I enter', `I enter the ${HOUSE}`]) {
            const turn = await harness.game.act(sentence) as Played;
            expect(names(turn), sentence).toContain('engine.standingAtTheGateOf');
            expect(names(turn), sentence).not.toContain('world.goingOverTheWall');
            expect(theAreaTheyAreIn(world, me())?.area.for, sentence).toBe('gate');
        }
    }, 300_000);

    it('says there is nothing to get into where there is no gate', async () => {
        const harness = await makeGameInWorld({ seed: 'no-gate-here', worldSeed: 'road-world' });
        await harness.game.newRun('Probe');
        for (const sentence of ['I sneak in', 'I go over the wall']) {
            const turn = await harness.game.act(sentence) as Played;
            expect(said(turn), sentence).toMatch(/nothing to enter/);
            expect(names(turn), sentence).not.toContain('world.goingOverTheWall');
        }
    }, 300_000);
});

describe('what a trespass costs, by the house', () => {
    const FOUNDATION = 14;
    const cost = (alignment: 'righteous' | 'neutral' | 'demonic' | null, draw: number, warnedBefore = false, yourOrdinal = FOUNDATION) =>
        whatATrespassCosts({ alignment, warnedBefore, yourOrdinal, draw });

    it('has a righteous house warn the first time and wound the second', () => {
        expect(cost('righteous', 0.1).kind).toBe('warned');
        expect(cost('righteous', 0.9).kind).toBe('warned');
        expect(cost('righteous', 0.1, true).kind).toBe('wounded');
    });

    it('has a neutral house take either a crippling or an arm, and the arm is not a crippling', () => {
        expect(theStructureTheyHave(FOUNDATION)).not.toBeNull();
        expect(cost('neutral', 0.1)).toMatchObject({
            kind: 'wounded', woundKey: theStructureTheyHave(FOUNDATION), severity: 'crippling'
        });
        expect(cost('neutral', 0.9)).toMatchObject({ kind: 'wounded', woundKey: 'severed-flesh', severity: 'serious' });
        // With no crossing behind them to break, the crippling is a channel cut.
        expect(cost('neutral', 0.1, false, 0)).toMatchObject({ woundKey: 'severed-meridian', severity: 'crippling' });
        // A house with no alignment on its catalog row is read as neutral.
        expect(cost(null, 0.9)).toMatchObject({ woundKey: 'severed-flesh' });
    });

    it('has a demonic house kill or cripple', () => {
        expect(cost('demonic', 0.1).kind).toBe('killed');
        expect(cost('demonic', 0.9)).toMatchObject({ kind: 'wounded', severity: 'crippling' });
    });
});

/**
 * Somebody inside a house of this alignment without leave, with one of the house at their rung
 * standing with them. Arranged rather than walked: the road in is played above.
 */
async function insideAHouseOf(alignment: 'righteous' | 'neutral' | 'demonic', seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'road-world' });
    await harness.game.newRun('Probe');
    const world = (await harness.game.loadWorld())!;
    const found = [...world.factions].sort((a, b) => (a.id < b.id ? -1 : 1))
        .filter(f => getSect(f.id)?.alignment === alignment)
        .map(f => ({ f, house: theHouseThisNameReaches(world, f.name) }))
        .find(({ f, house }) => house !== null
            && world.npcs.some(npc => npc.status === 'alive' && npc.factionId === f.id && npc.locationId !== house.seat.id));
    expect(found, `no seated ${alignment} house with anybody away from its seat`).toBeDefined();
    const house = found!.house!;
    const id = harness.game.currentRun().cultivator.id;
    const rung = 14;
    harness.repos.cultivators.update(id, { realmOrdinal: rung });
    const forecourt = theAreasOf(world, house.seat).areas.find(area => area.for === 'forecourt')!;
    const witness = world.npcs.findIndex(npc => npc.status === 'alive' && npc.factionId === house.factionId
        && npc.locationId !== house.seat.id);

    const trespass = async () => {
        harness.repos.cultivators.update(id, { location: house.seat.name });
        harness.repos.cultivators.standIn(id, forecourt.id);
        const day = Math.floor(world.currentDay);
        writeFlag(harness.db, id, FLAG_INSIDE_WITHOUT_LEAVE,
            JSON.stringify({ houseId: house.factionId, seatId: house.seat.id, sinceDay: day }));
        const npc = world.npcs[witness]!;
        world.npcs[witness] = {
            ...npc,
            locationId: house.seat.id,
            cultivation: { ...npc.cultivation, realmOrdinal: rung },
            activity: { kind: 'talking', withIds: [id], sinceDay: day, untilDay: day + 1 }
        } as NpcRecord;
        harness.game.theWorldMoved();
        const turn = await harness.game.act('who is here?') as Played;
        const answered = turn.toolCalls.find(call => call.name === 'social.whatATrespassCosts');
        expect(answered, said(turn)).toBeDefined();
        return { turn, answered: answered!.summary };
    };
    const me = () => harness.repos.cultivators.getById(id)!;
    return { harness, world, house, rung, trespass, me };
}

describe('what a trespass costs, played', () => {
    it('has a righteous house put them out with a warning, and wound them the second time', async () => {
        const { trespass, me, world } = await insideAHouseOf('righteous', 'trespass-righteous');
        const first = await trespass();
        expect(first.answered).toMatch(/: warned\./);
        expect(said(first.turn)).toMatch(/warned not to come over the wall again/);
        expect(me().injuries).toHaveLength(0);
        expect(theAreaTheyAreIn(world, me())?.area.for).toBe('gate');

        const second = await trespass();
        expect(second.answered).toMatch(/: wounded\./);
        expect(me().injuries).toHaveLength(1);
        expect(theAreaTheyAreIn(world, me())?.area.for).toBe('gate');
    }, 300_000);

    it('has a neutral house take a crippling or an arm, and put them out', async () => {
        const { trespass, me, world, rung } = await insideAHouseOf('neutral', 'trespass-neutral');
        const { answered } = await trespass();
        expect(answered).toMatch(/: wounded\./);
        const [wound] = me().injuries;
        expect([
            `${theStructureTheyHave(rung)}/crippling`, 'severed-flesh/serious'
        ]).toContain(`${wound?.woundType}/${wound?.severity}`);
        expect(theAreaTheyAreIn(world, me())?.area.for).toBe('gate');
    }, 300_000);

    it('has a demonic house kill them, or cripple them and put them out', async () => {
        const { trespass, me, rung } = await insideAHouseOf('demonic', 'trespass-demonic');
        const { answered } = await trespass();
        if (/: killed\./.test(answered)) {
            expect(me().alive).toBe(false);
        } else {
            expect(answered).toMatch(/: wounded\./);
            expect(me().injuries.map(w => `${w.woundType}/${w.severity}`))
                .toContain(`${theStructureTheyHave(rung)}/crippling`);
        }
    }, 300_000);
});
