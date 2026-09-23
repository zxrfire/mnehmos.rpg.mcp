/**
 * A house puts the player on a posting, expects them there, looks in on them,
 * and counts the tour when it is served.
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * Postings for the world's own people (`applyPostings`), look-ins on them
 * (`wordFromThePeopleAway`), and a header in the talisman pass that said the
 * rest out loud: *"The player is never looked in on, because nothing puts the
 * player on a posting."* Both passes skip the player's row by design, so a
 * member could spend a life in a house and never once be sent to hold a town.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   the house puts a post to the player the way it puts any ask: a summons,
 *   answered with the ordinary words. A post is relieved, never invented - the
 *   town is one somebody of the house is stationed in
 *   saying yes writes the word and relieves the holder, and does NOT move the
 *   player: getting there is theirs
 *   being in the post's province is being at the post; leaving it before the
 *   term is out is a stated consequence - the word renounced and a row the house
 *   holds - and never a refusal of the walk
 *   a look-in falls due on the world's own cadence and reaches the player as
 *   somebody of the house standing where they are, with slips keyed to them
 *   a tour served counts `whatServiceIsWorth` over the term, the rate a served
 *   posting counts for anybody
 *
 * THE ARRANGEMENT IS ASKED OF THE ENGINE. Which house posts the player, and to
 * where, is `aPostTheHouseWouldSendThemTo`; the test only moves a stationed
 * tour's end day inside the year until the house's own draw says yes. The
 * cadences are arranged by writing the day on the word, which is where they are
 * read from.
 *
 * Red-checked, each break on its own: with the posting branch in
 * `goWhereTheHouseSentYou` taken out, saying yes runs the term as an ordinary
 * span and the taken-up, look-in and served tests go red; with the province
 * check answering true the leaving test goes red; with the look-in never sent
 * the look-in test goes red; with the served credit not written the served test
 * goes red. The served test first passed with the credit broken, because a term
 * of a day is worth nought at any rung - which is why it serves four hundred.
 * And the last test twice over: with the stamp not written the house sends a
 * second person to the town, and with it never cleared the post stays the
 * player's after they have walked off it.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { aPostTheHouseWouldSendThemTo } from '../../src/engine/world/a-house-posts-the-one-being-played.js';
import { addToTheStack } from '../../src/engine/world/a-communication-talisman-carries-word-home.js';
import { whoCutsPairsAtTheSeat, A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS } from '../../src/engine/world/what-a-house-hears-from-its-people-away.js';
import { theProvinceAround } from '../../src/engine/world/ground-holder.js';
import { whatServiceIsWorth } from '../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys.js';
import { readPendingSummons } from '../../src/web/pending-summons.js';
import { isAPosting, theirOpenPosting, theTownOf } from '../../src/web/holding-a-posting.js';
import { ledgerAbout, writeOneObligation } from '../../src/storage/repos/obligation.repo.js';
import { theCommunicationTalismansOnYou } from '../../src/web/sending-word-on-a-communication-talisman.js';

const WORLD = 'a-posting-for-the-player';

/** A member of a house whose own draw would post them, standing at its seat. */
async function aMemberTheHouseWouldPost(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Posted');
    // Nobody is stationed at world open: the world's own pass posts people once
    // a year, so the year is played rather than the posts written in.
    await harness.game.act('I wait for 400 days');
    const world = harness.game.atHand!;
    const today = Math.floor(world.currentDay);
    const houses = world.factions
        .filter(f => f.dissolvedOnDay === null && f.seatLocationId !== null && harness.repos.sects.getById(f.id) !== null)
        .sort((a, b) => world.npcs.filter(n => n.factionId === b.id).length - world.npcs.filter(n => n.factionId === a.id).length);
    for (const house of houses) {
        const members = world.npcs.filter(n => n.factionId === house.id);
        if (whoCutsPairsAtTheSeat(world, members, house.seatLocationId!) === null) continue;
        for (const stationed of members.filter(n => n.status === 'alive' && n.activity?.kind === 'stationed' && n.locationId)) {
            for (let offset = 20; offset <= 360; offset += 20) {
                const at = world.npcs.findIndex(n => n.id === stationed.id);
                world.npcs[at] = { ...world.npcs[at]!, activity: { ...world.npcs[at]!.activity!, untilDay: today + offset } };
                const post = aPostTheHouseWouldSendThemTo(world, { houseId: house.id, playerId: cultivator.id, rankIndex: 0, ordinal: 0, today });
                if (post?.relievedId !== stationed.id) continue;
                harness.repos.sects.addMember(house.id, cultivator.id, 0);
                const seat = world.locations.find(l => l.id === house.seatLocationId)!;
                harness.repos.cultivators.update(cultivator.id, { location: seat.name });
                addToTheStack(world.objects, { houseId: house.id, houseName: house.name, holderId: null, count: 40, locationId: seat.id });
                return { ...harness, cultivator, house, world, seat, post };
            }
        }
    }
    throw new Error('no house in this world would post the player');
}

type Posted = Awaited<ReturnType<typeof aMemberTheHouseWouldPost>>;

/** Asked and accepted, standing at the town. */
async function atThePost(seed: string): Promise<Posted> {
    const h = await aMemberTheHouseWouldPost(seed);
    await h.game.act('I look around');
    await h.game.act('I accept');
    const town = h.world.locations.find(l => l.id === h.post.townId)!;
    h.repos.cultivators.update(h.cultivator.id, { location: town.name });
    await h.game.act('I look around');
    return h;
}

describe('being posted', () => {
    it('is put to the player as a summons, to a town the house already holds', async () => {
        const h = await aMemberTheHouseWouldPost('posted-asked');
        const turn = await h.game.act('I look around');
        const pending = readPendingSummons(h.repos, h.cultivator.id);
        expect(pending, 'a standing ask').not.toBeNull();
        expect(isAPosting(pending!.entryId)).toBe(true);
        expect(theTownOf(pending!.entryId)).toBe(h.post.townId);
        expect(turn.narration).toContain(h.post.townName);
    });

    it('taken up, writes the word and relieves the holder, and does not move the player', async () => {
        const h = await aMemberTheHouseWouldPost('posted-accepted');
        await h.game.act('I look around');
        const standing = h.repos.cultivators.getById(h.cultivator.id)!.location;
        const turn = await h.game.act('I accept');

        const word = theirOpenPosting(h.game, h.cultivator.id);
        expect(word, 'the posting is on the ledger').not.toBeNull();
        expect(word!.tags.some(isAPosting)).toBe(true);
        expect(h.repos.cultivators.getById(h.cultivator.id)!.location).toBe(standing);
        expect(readPendingSummons(h.repos, h.cultivator.id)).toBeNull();
        const relieved = h.game.atHand!.npcs.find(n => n.id === h.post.relievedId)!;
        expect(relieved.activity?.untilDay).toBe(Math.floor(h.game.atHand!.currentDay));
        expect(turn.narration).toContain(h.post.townName);
    });

    it('refused, is not put again', async () => {
        const h = await aMemberTheHouseWouldPost('posted-refused');
        await h.game.act('I look around');
        await h.game.act('I refuse');
        expect(ledgerAbout(h.db as never, h.cultivator.id).some(r => r.tags.some(isAPosting) && r.kind !== 'oath')).toBe(true);
        await h.game.act('I look around');
        expect(readPendingSummons(h.repos, h.cultivator.id)).toBeNull();
    });
});

describe('holding the post', () => {
    it('is reached by being in its province, and leaving it is a consequence, not a refusal', async () => {
        const h = await atThePost('posted-left');
        const word = theirOpenPosting(h.game, h.cultivator.id)!;
        expect(word.tags.some(t => t.startsWith('arrived:')), 'reached').toBe(true);

        const province = theProvinceAround(h.world.locations, h.post.townId);
        const away = h.world.locations.find(l => l.kind === 'settlement'
            && theProvinceAround(h.world.locations, l.id) !== province)!;
        h.repos.cultivators.update(h.cultivator.id, { location: away.name });
        const turn = await h.game.act('I look around');

        expect(h.repos.cultivators.getById(h.cultivator.id)!.location, 'the walk was not refused').toBe(away.name);
        expect(theirOpenPosting(h.game, h.cultivator.id)).toBeNull();
        expect(ledgerAbout(h.db as never, h.cultivator.id)
            .some(r => r.holderId === h.house.id && r.tags.includes('failed') && r.tags.some(isAPosting))).toBe(true);
        expect(turn.narration.toLowerCase()).toContain('left your posting');
    });

    it('is looked in on: somebody of the house stands there, with slips keyed to the player', async () => {
        const h = await atThePost('posted-looked-in');
        const word = theirOpenPosting(h.game, h.cultivator.id)!;
        const runDay = Math.floor(h.game.currentRun().run.elapsedDays);
        const every = A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * 365;
        writeOneObligation(h.db as never, {
            ...word,
            tags: [...word.tags.filter(t => !t.startsWith('arrived:')), `arrived:${runDay - every + 1}`]
        });
        const slipsBefore = theCommunicationTalismansOnYou(h.db, h.cultivator.id).find(s => s.houseId === h.house.id)?.count ?? 0;

        const turn = await h.game.act('I wait for three days');

        const here = h.game.worldPlaceOf(h.repos.cultivators.getById(h.cultivator.id)!);
        const visitor = h.game.atHand!.npcs.find(n => n.factionId === h.house.id
            && n.activity?.kind === 'out_with_a_party' && n.activity.note.includes(h.cultivator.name));
        expect(visitor, 'somebody was sent').toBeDefined();
        expect(visitor!.locationId).toBe(here);
        expect(turn.narration).toContain(visitor!.name);
        const slipsAfter = theCommunicationTalismansOnYou(h.db, h.cultivator.id).find(s => s.houseId === h.house.id)?.count ?? 0;
        expect(slipsAfter).toBeGreaterThanOrEqual(Math.max(slipsBefore, 1));
    });

    // ── AND THE WORLD KNOWS THE POST IS HELD ─────────────────────────────
    //
    // `applyPostings` fills the posts nobody is stationed at, reading the whole
    // roll - the player's world row with it. The row stands nowhere by design,
    // so a post the player was holding read as empty and the house sent one of
    // its own people to the same town: it paid for two to watch one. The stamp
    // is written when the posting is taken up and cleared at all three ends,
    // because a stamp nothing clears is a way to hold a town forever by having
    // once stood in it.
    it('is not filled twice: the world sends nobody while the player holds it, and somebody after', async () => {
        const h = await atThePost('posted-not-filled-twice');
        const stamped = h.game.atHand!.npcs.find(n => n.id === h.cultivator.id);
        expect(stamped?.activity?.kind, 'the world was not told').toBe('stationed');
        expect(stamped?.locationId).toBe(h.post.townId);
        const took = Math.floor(h.game.atHand!.currentDay);

        // A WHOLE YEAR OF THE WORLD'S, played rather than advanced, because it
        // is the world's own posting pass this is about and that runs once a
        // year. A wait is cut short by whatever the world does in it, so it is
        // asked again until the year has actually turned.
        const aYearOfIt = async (): Promise<void> => {
            // Fed, because a year of waiting is a year of eating and this test
            // is about the house's posts rather than about the pack.
            writeFlag(h.db, h.cultivator.id, FLAG_RATIONS_HELD, '900');
            const from = Math.floor(h.game.atHand!.currentDay);
            for (let turn = 0; turn < 12 && Math.floor(h.game.atHand!.currentDay) - from < 400; turn++) {
                await h.game.act('I wait for 200 days');
            }
        };
        await aYearOfIt();

        // NOT "nobody is stationed there": the one the player relieved stands in
        // the town with an expired tour until the world's own return pass sweeps
        // them home, which is that pass's business and not this one's. What must
        // not happen is the house SENDING somebody new to a post it already has
        // somebody at.
        const sentSince = (day: number) => h.game.atHand!.npcs.filter(n =>
            n.id !== h.cultivator.id && n.factionId === h.house.id
            && n.activity?.kind === 'stationed' && n.locationId === h.post.townId
            && (n.activity.sinceDay ?? 0) > day);
        expect(sentSince(took).map(n => n.name), 'the house posted somebody to a town the player holds').toEqual([]);

        // And walking off it hands the post back, which is the half that stops
        // this being a way to freeze a town by standing in it once.
        const left = Math.floor(h.game.atHand!.currentDay);
        const province = theProvinceAround(h.world.locations, h.post.townId);
        const away = h.world.locations.find(l => l.kind === 'settlement'
            && theProvinceAround(h.world.locations, l.id) !== province)!;
        h.repos.cultivators.update(h.cultivator.id, { location: away.name });
        await h.game.act('I look around');
        expect(h.game.atHand!.npcs.find(n => n.id === h.cultivator.id)?.activity, 'still stamped').toBeNull();
        expect(theirOpenPosting(h.game, h.cultivator.id)).toBeNull();

        await aYearOfIt();
        expect(sentSince(left).length, 'the post stayed empty after they left it').toBeGreaterThan(0);
    }, 300_000);

    it('served to its end, counts the served-posting rate over the term', async () => {
        const h = await atThePost('posted-served');
        const word = theirOpenPosting(h.game, h.cultivator.id)!;
        const runDay = Math.floor(h.game.currentRun().run.elapsedDays);
        // A tour taken up four hundred days ago, due tomorrow.
        const incurredOnDay = runDay - 400;
        writeOneObligation(h.db as never, {
            ...word,
            incurredOnDay,
            dueOnDay: runDay + 1,
            tags: [...word.tags.filter(t => !t.startsWith('arrived:')), `arrived:${incurredOnDay}`]
        });
        const before = h.repos.sects.getMembership(h.cultivator.id)!.contribution;
        const ordinal = h.repos.cultivators.getById(h.cultivator.id)!.realmOrdinal;

        await h.game.act('I wait for three days');

        expect(theirOpenPosting(h.game, h.cultivator.id)).toBeNull();
        const credited = h.repos.sects.getMembership(h.cultivator.id)!.contribution - before;
        const rate = Math.round(whatServiceIsWorth(ordinal, 401));
        expect(rate).toBeGreaterThan(0);
        expect(credited).toBe(rate);
    });
});
