/**
 * The player sends word on a communication talisman, and cuts them.
 *
 * The design owner: *"you can imagine people out on a sect have communication
 * talismans"*, and they are counted, marked with a house, and made by *"anyone
 * foundation or above"*; *"making them for the house IS a meritous task"*.
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * Nothing. "I burn a transmission talisman to tell my master..." reached
 * `destroy`, whose row owns "burn" beside "talisman", and "I send word to the
 * sect that..." reached no verb: `SENDING_A_MESSAGE` was only ever read as a
 * reason a sentence was NOT an order.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   the sentences reach `tell/send_word` and `craft`, whichever name the slip
 *   is given
 *   with no slip marked with the house, nothing goes and the refusal says so;
 *   with one, one is burnt and the house holds a fact of what was sent
 *   below Foundation nobody cuts one and the refusal names the rung; at
 *   Foundation they go into the pouch, marked with the player's house; cut for
 *   the house they go into its stock and are counted as contribution
 *
 * Red-checked with the send-word row taken out of the pattern table (the parse
 * test and both sending tests go red) and with the floor lowered to 0.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys.js';
import { parseIntent } from '../../src/web/actions.js';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { howManyTheHouseHas } from '../../src/engine/world/a-communication-talisman-carries-word-home.js';
import {
    pouchIdForCommunicationTalismans,
    theCommunicationTalismansOnYou
} from '../../src/web/sending-word-on-a-communication-talisman.js';

const WORLD = 'word-on-a-slip';

describe('the sentences', () => {
    it('reach sending word, whatever the slip is called', () => {
        for (const said of [
            'I burn a communication talisman to tell my master that the pass is held',
            'I burn a transmission talisman to tell my master that the pass is held',
            'I use a message talisman to tell the sect that the pass is held'
        ]) {
            const plan = parseIntent(said);
            expect(plan, said).toMatchObject({ action: 'tell', intent: 'send_word' });
            expect(plan.topic).toBe('the pass is held');
        }
        expect(parseIntent('I send word to the sect that I have found a door'))
            .toMatchObject({ action: 'tell', intent: 'send_word', target: 'the sect', topic: 'I have found a door' });
    });

    it('reach cutting them, and a burnt manual is still a breaking', () => {
        expect(parseIntent('I make some communication talismans').action).toBe('craft');
        expect(parseIntent('I cut five communication talismans for the sect').action).toBe('craft');
        expect(parseIntent('I burn the manual').action).toBe('destroy');
    });
});

/** A player on the roll of a house with a hall, standing in it. */
async function aMemberAtTheirHall(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Sender');
    const world = (await harness.game.loadWorld())!;
    const house = world.factions.find(f =>
        f.dissolvedOnDay === null && f.seatLocationId !== null && harness.repos.sects.getById(f.id) !== null)!;
    harness.repos.sects.addMember(house.id, cultivator.id, 1);
    const seat = world.locations.find(l => l.id === house.seatLocationId)!;
    harness.repos.cultivators.update(cultivator.id, { location: seat.name });
    return { ...harness, cultivator, house };
}

describe('sending word', () => {
    it('with no slip marked with the house, nothing goes', async () => {
        const { game, db, cultivator } = await aMemberAtTheirHall('send-word-without');
        const facts = game.atHand!.history.facts.length;
        const turn = await game.act('I send word to the sect that the pass is held');
        expect(turn.toolCalls.some(c => c.action === 'tell' && !c.ok)).toBe(true);
        expect(turn.narration.toLowerCase()).toContain('communication talisman');
        expect(game.atHand!.history.facts.length).toBe(facts);
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([]);
    });

    it('with one, it is burnt and the house holds what was sent', async () => {
        const { game, db, cultivator, house } = await aMemberAtTheirHall('send-word-with');
        addToPouch(db, cultivator.id, pouchIdForCommunicationTalismans(house.id), 'talisman', 2);

        const turn = await game.act('I send word to the sect that the pass is held');

        expect(turn.toolCalls.some(c => c.action === 'tell' && c.ok)).toBe(true);
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([{ houseId: house.id, count: 1 }]);
        const word = game.atHand!.history.facts.filter(f =>
            f.data.communicationTalisman === true && f.actors.some(a => a.id === cultivator.id));
        expect(word).toHaveLength(1);
        expect(word[0]!.factionIds).toEqual([house.id]);
        expect(word[0]!.summary).toContain('the pass is held');
    });
});

describe('cutting them', () => {
    it('below Foundation nobody can, and the refusal names the rung', async () => {
        const { game, db, repos, cultivator } = await aMemberAtTheirHall('cut-below');
        repos.cultivators.update(cultivator.id, { realmOrdinal: FOUNDATION_ORDINAL - 1 });
        const turn = await game.act('I make some communication talismans');
        expect(turn.toolCalls.some(c => c.action === 'craft' && !c.ok)).toBe(true);
        expect(turn.narration).toMatch(/Foundation/);
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([]);
    });

    it('at Foundation they go into the pouch, marked with your house', async () => {
        const { game, db, repos, cultivator, house } = await aMemberAtTheirHall('cut-at');
        repos.cultivators.update(cultivator.id, { realmOrdinal: FOUNDATION_ORDINAL });
        await game.act('I make three communication talismans');
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([{ houseId: house.id, count: 3 }]);
    });

    it('and cut for the house they go into its stock and count as work for it', async () => {
        const { game, db, repos, cultivator, house } = await aMemberAtTheirHall('cut-for-the-house');
        repos.cultivators.update(cultivator.id, { realmOrdinal: FOUNDATION_ORDINAL });
        const stock = howManyTheHouseHas(game.atHand!.objects, house.id);
        const before = repos.sects.getMembership(cultivator.id)!.contribution;

        await game.act('I cut three communication talismans for the sect');

        expect(howManyTheHouseHas(game.atHand!.objects, house.id)).toBe(stock + 3);
        expect(repos.sects.getMembership(cultivator.id)!.contribution).toBeGreaterThan(before);
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([]);
    });
});

describe('the cutting notice, taken off the wall', () => {
    it('reads as taking the notice, not as cutting or as a theft', () => {
        expect(parseIntent('I take the cutting communication talismans'))
            .toMatchObject({ action: 'sect', intent: 'duty' });
    });

    it('and finished, what was cut goes into the house stock, the same landing the world uses', async () => {
        const { game, db, repos, cultivator, house } = await aMemberAtTheirHall('cut-off-the-board');
        repos.cultivators.update(cultivator.id, { realmOrdinal: FOUNDATION_ORDINAL });
        writeFlag(db, cultivator.id, FLAG_RATIONS_HELD, '12');
        // The house has handed out everything it had, so the notice is posted.
        const world = game.atHand!;
        for (let i = 0; i < world.objects.length; i++) {
            const o = world.objects[i]!;
            if (o.ownerId === house.id && o.possessorId === null && o.tags.includes('communication-talismans')) {
                world.objects[i] = { ...o, data: { ...o.data, quantity: 0 } };
            }
        }
        game.theWorldMoved();
        expect(howManyTheHouseHas(game.atHand!.objects, house.id)).toBe(0);

        const turn = await game.act('I take the cutting communication talismans');

        expect(turn.toolCalls.some(c => c.name === 'encounters.completeDuty' && c.ok)).toBe(true);
        expect(howManyTheHouseHas(game.atHand!.objects, house.id)).toBeGreaterThan(0);
    }, 300_000);
});
