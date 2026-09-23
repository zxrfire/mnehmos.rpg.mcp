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
 *   Foundation they go into the pouch, marked with the player's house; the
 *   HOUSE's own blanks are Internal Affairs' work and a member sitting down to
 *   them is told so - the credit for that work is unchanged and who may earn it
 *   is now the house's answer; taken off the wall, the notice pays for what
 *   landed and nothing up front
 *   a slip is half of a pair keyed to the player: it arrives at its twin in the
 *   hall and is read there by a person, and with no twin it goes nowhere
 *   word to a person goes on a communication jade whose other half they hold,
 *   as often as it is used, and on slips it is refused with where they reach -
 *   and the refusal names whose half answers to one in their own pouch, which
 *   is the question a player asks next
 *   leaving a house breaks both halves of its pairs
 *   cutting as many as they like spends the days at the bench's cultivation rate,
 *   two slips a pair
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
import {
    THE_ONE_WHO_RECEIVED_IT,
    howManyTheHouseHas,
    howManyTwinsTheHallKeeps,
    keepTheTwins
} from '../../src/engine/world/a-communication-talisman-carries-word-home.js';
import { aPairOfCommunicationJade, theJadeBetween } from '../../src/engine/world/a-pair-of-communication-jade.js';
import { CUT_IN_A_SITTING, DAYS_A_SITTING_TAKES, daysToCut } from '../../src/data/cultivation/communication-talismans.js';
import { BENCH_FOCUS } from '../../src/web/turn-constants.js';
import { settleWhatYourHouseHasIssuedYou } from '../../src/web/what-your-house-has-issued-you.js';
import { whatCuttingPays } from '../../src/engine/world/what-a-house-hears-from-its-people-away.js';
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
        keepTheTwins(game.atHand!.objects, {
            houseId: house.id, houseName: house.name, senderId: cultivator.id, count: 2, hallLocationId: house.seatLocationId
        });

        const turn = await game.act('I send word to the sect that the pass is held');

        expect(turn.toolCalls.some(c => c.action === 'tell' && c.ok)).toBe(true);
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([{ houseId: house.id, count: 1 }]);
        expect(howManyTwinsTheHallKeeps(game.atHand!.objects, house.id, cultivator.id), 'and its twin').toBe(1);
        const word = game.atHand!.history.facts.filter(f =>
            f.data.communicationTalisman === true && f.actors.some(a => a.id === cultivator.id));
        expect(word).toHaveLength(1);
        expect(word[0]!.factionIds).toEqual([house.id]);
        expect(word[0]!.summary).toContain('the pass is held');
        const reader = word[0]!.actors.find(a => a.role === THE_ONE_WHO_RECEIVED_IT);
        if (reader) expect(game.atHand!.npcs.find(n => n.id === reader.id)?.factionId, 'read by somebody of the house').toBe(house.id);
    });

    it('with no twin in the hall, nothing is burnt', async () => {
        const { game, db, cultivator, house } = await aMemberAtTheirHall('send-word-no-twin');
        addToPouch(db, cultivator.id, pouchIdForCommunicationTalismans(house.id), 'talisman', 2);
        const turn = await game.act('I send word to the sect that the pass is held');
        expect(turn.toolCalls.some(c => c.action === 'tell' && !c.ok)).toBe(true);
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([{ houseId: house.id, count: 2 }]);
    });

    it('to a person, goes on a jade whose other half they hold, as often as it is used', async () => {
        const { game, cultivator, house } = await aMemberAtTheirHall('send-word-on-jade');
        const world = game.atHand!;
        const elder = world.npcs.find(n => n.status === 'alive' && n.factionId === house.id)!;
        world.objects.push(...aPairOfCommunicationJade({
            maker: { id: elder.id, name: elder.name, ordinal: 20 },
            keeps: { id: elder.id, name: elder.name },
            gives: { id: cultivator.id, name: cultivator.name },
            onDay: Math.floor(world.currentDay)
        }));
        game.theWorldMoved();

        for (const says of ['the pass is held', 'the pass is still held']) {
            const turn = await game.act(`I send word to ${elder.name} that ${says}`);
            expect(turn.toolCalls.some(c => c.name === 'world.sendWordOnJade' && c.ok), says).toBe(true);
        }
        // ── THE PAIR UNDER TEST, NOT EVERY HALF IN THE WORLD ─────────────
        //
        // This counted `objects.filter(isAJadeHalf)` and asserted two, which
        // was a true reading of the world when it was written and is not one
        // now: the world mints jade in its own year - the Internal Affairs
        // Elder for the house's elders, a master for a disciple they value -
        // and 42 pairs stand in this world before the test makes its own. The
        // count went to 86 and said nothing about the pair the test is about.
        //
        // Narrowed rather than loosened: `theJadeBetween` is the engine's own
        // answer to "is there a whole pair between these two", which is what
        // this line was always trying to say, and it is the same read the verb
        // itself makes. The pair survives being spoken into twice, which is the
        // whole of "as often as it is used".
        expect(theJadeBetween(game.atHand!, cultivator.id, elder.id), 'the pair is gone').not.toBeNull();
        expect(theJadeBetween(game.atHand!, elder.id, cultivator.id), 'and from their end').not.toBeNull();
        // The same narrowing on the facts: word other people sent on their own
        // jade is not what this turn did.
        expect(game.atHand!.history.facts.filter(f =>
            f.data.communicationJade === true && f.actors.some(a => a.id === cultivator.id)))
            .toHaveLength(2);
    });

    it('to somebody they hold no jade with, the refusal names who their jade does answer to', async () => {
        const { game, cultivator, house } = await aMemberAtTheirHall('send-word-jade-reach');
        const world = game.atHand!;
        const theirs = world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        const [holder, other] = [theirs[0]!, theirs[1]!];
        world.objects.push(...aPairOfCommunicationJade({
            maker: { id: holder.id, name: holder.name, ordinal: 20 },
            keeps: { id: holder.id, name: holder.name },
            gives: { id: cultivator.id, name: cultivator.name },
            onDay: Math.floor(world.currentDay)
        }));
        game.theWorldMoved();

        const turn = await game.act(`I send word to ${other.name} that the pass is held`);
        expect(turn.toolCalls.some(c => c.action === 'tell' && !c.ok)).toBe(true);
        // WHO, AND NOT WHERE. A jade pair carries word rather than position, so
        // the answer names the person and says nothing about where they stand.
        expect(turn.narration).toContain(`yours answers to ${holder.name}`);
    });

    it('to a person with only slips, it is refused and says where the slips reach', async () => {
        const { game, db, cultivator, house } = await aMemberAtTheirHall('send-word-person-no-jade');
        addToPouch(db, cultivator.id, pouchIdForCommunicationTalismans(house.id), 'talisman', 2);
        const elder = game.atHand!.npcs.find(n => n.status === 'alive' && n.factionId === house.id)!;
        const turn = await game.act(`I send word to ${elder.name} that the pass is held`);
        expect(turn.toolCalls.some(c => c.action === 'tell' && !c.ok)).toBe(true);
        expect(turn.narration).toContain('hall of');
        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([{ houseId: house.id, count: 2 }]);
    });
});

describe('leaving a house', () => {
    it('breaks both halves of its pairs, as its token goes back', async () => {
        const { game, db, repos, cultivator, house } = await aMemberAtTheirHall('slips-go-back');
        addToPouch(db, cultivator.id, pouchIdForCommunicationTalismans(house.id), 'talisman', 4);
        keepTheTwins(game.atHand!.objects, {
            houseId: house.id, houseName: house.name, senderId: cultivator.id, count: 4, hallLocationId: house.seatLocationId
        });
        const stock = howManyTheHouseHas(game.atHand!.objects, house.id);
        repos.sects.removeMember(house.id, cultivator.id);

        const settled = settleWhatYourHouseHasIssuedYou(game, repos.cultivators.getById(cultivator.id)!);

        expect(theCommunicationTalismansOnYou(db, cultivator.id)).toEqual([]);
        expect(howManyTwinsTheHallKeeps(game.atHand!.objects, house.id, cultivator.id)).toBe(0);
        expect(howManyTheHouseHas(game.atHand!.objects, house.id), 'nothing keyed goes back as a blank').toBe(stock);
        expect(settled?.lines.join(' ')).toContain('broke');
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
        expect(howManyTwinsTheHallKeeps(game.atHand!.objects, house.id, cultivator.id), 'the twins, in the hall').toBe(3);
    });

    it('as many as they like, and the drawerful is the days it takes at the bench\'s rate, not in seclusion', async () => {
        const { game, db, repos, cultivator, house } = await aMemberAtTheirHall('cut-a-drawerful');
        repos.cultivators.update(cultivator.id, { realmOrdinal: FOUNDATION_ORDINAL });
        writeFlag(db, cultivator.id, FLAG_RATIONS_HELD, '30');
        const before = game.atHand!.currentDay;

        const turn = await game.act('I make 30 communication talismans');

        // What was cut is what the days spent could cut: a span broken off early cuts
        // less, and nothing lands for days that did not pass.
        const spent = game.atHand!.currentDay - before;
        expect(spent).toBeGreaterThan(0);
        expect(spent).toBeLessThanOrEqual(daysToCut(2 * 30));
        const held = theCommunicationTalismansOnYou(db, cultivator.id);
        const count = held.find(h => h.houseId === house.id)?.count ?? 0;
        // Two slips a pair: the half in the pouch and the twin in the hall.
        expect(count).toBe(Math.min(30, Math.floor(Math.floor(spent / DAYS_A_SITTING_TAKES) * CUT_IN_A_SITTING / 2)));
        expect(turn.toolCalls.some(c => c.action === 'craft' && c.ok)).toBe(true);
        expect(BENCH_FOCUS).toBeLessThan(1);
    }, 120_000);

    // ── AND THE HOUSE'S OWN BLANKS ARE NOT A MEMBER'S TO CUT ─────────────
    //
    // THE RULE MOVED, and this test moved with it rather than being quietly
    // relabelled. It used to assert that any member at Foundation could cut the
    // house's blanks into its treasury and be credited for it - three into the
    // stock, a day's service, and the stones for what went in - which was the
    // meritorious act having no owner. The design owner's ruling: *"the internal
    // affairs elder crafts them, or his disciples who work in internal affairs -
    // probably his disciples craft them for disciples, the elder crafts them for
    // elders."* So the credit is still exactly what it was, and WHO may earn it
    // is now the house's own answer: `who-cuts-the-houses-slips.ts`.
    //
    // The landing it used to prove is proved twice over below - the notice taken
    // off the wall, which is this house's own road to the work - and in
    // `the-houses-own-slips-are-cut-by-its-office.test.ts`, which walks the same
    // road through the board and counts the contribution at the end of it.
    it('and are not a member\'s to cut, with nobody having handed them the seal', async () => {
        const { game, db, repos, cultivator, house } = await aMemberAtTheirHall('cut-for-the-house');
        repos.cultivators.update(cultivator.id, { realmOrdinal: FOUNDATION_ORDINAL });
        const stock = howManyTheHouseHas(game.atHand!.objects, house.id);
        const before = repos.sects.getMembership(cultivator.id)!.contribution;
        const stonesBefore = repos.cultivators.getById(cultivator.id)!.spiritStones;

        const turn = await game.act('I cut three communication talismans for the sect');

        expect(turn.toolCalls.some(c => c.action === 'craft' && !c.ok)).toBe(true);
        expect(turn.narration.toLowerCase()).toContain('internal affairs');
        expect(howManyTheHouseHas(game.atHand!.objects, house.id)).toBe(stock);
        expect(repos.sects.getMembership(cultivator.id)!.contribution).toBe(before);
        expect(repos.cultivators.getById(cultivator.id)!.spiritStones).toBe(stonesBefore);
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

        const stonesBefore = repos.cultivators.getById(cultivator.id)!.spiritStones;

        const turn = await game.act('I take the cutting communication talismans');

        expect(turn.toolCalls.some(c => c.name === 'encounters.completeDuty' && c.ok)).toBe(true);
        const landed = howManyTheHouseHas(game.atHand!.objects, house.id);
        expect(landed).toBeGreaterThan(0);
        // Paid for what the player landed, at what the slips are worth, and not a stone
        // for the term. The house's own people cut while the month ran too, so what is in
        // the stock is the most the player can have landed.
        expect(repos.cultivators.getById(cultivator.id)!.spiritStones - stonesBefore)
            .toBeLessThanOrEqual(whatCuttingPays(landed, FOUNDATION_ORDINAL));
    }, 300_000);
});
