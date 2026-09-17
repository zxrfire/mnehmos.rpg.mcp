/**
 * A house hears from its people away on communication talismans.
 *
 * The design owner: *"you can imagine people out on a sect have communication
 * talismans, write them if they don't exist. That also gives a way for the
 * people the sect stations out to report back."* Then: they are counted, not
 * tracked (*"you just have a fungible stack"*), each is marked with a house, the
 * house *"sends people to give you more stack, check up on you, every once in a
 * while"*, and *"the recruiter burns a talisman and informs the Internal Affairs
 * Elder"*.
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * No slip carried word. A house held nothing of its own: what it could act on
 * was a reading over the ledger - who of it stood somewhere, which of its parties
 * came back (`whatAHousesOwnErrandsBringBack`), and what was in the air where its
 * people stood, `DAYS_NEWS_TAKES` late. Somebody posted in a town heard a thing
 * the day it happened there and their house heard it twenty days later if it was
 * in the same province, a hundred and eighty if not.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   a house stocks them, marked with it, a stack for everybody on its roll, and
 *   hands a stack to whoever it posts away
 *   a posted member's report is a fact the house holds on the day it is burnt,
 *   through the reading a returning party's account is held by
 *   the slip is spent: one fewer on the stack, and nothing left in the world
 *   no slip, no word; and a slip carries twelve walking days and no further
 *   a posting is looked in on every three years, and a look-in finds the dead
 *   a recruiter with a slip reports the recruit, and one without still owes it
 *   the cutting floor is Foundation; the board posts the cutting while the house
 *   is short, what the work cuts lands at the close, and the pass cuts nothing
 *   short work at home is taken by somebody at the seat who is teaching or at the
 *   work of their rank, without taking them off it
 *
 * ── MEASURED ─────────────────────────────────────────────────────────────
 *
 * Both arms in one process off a temporary pressure switch since removed, two
 * seeds (`afford-a`, `demography`) at two hundred years; the whole table is in
 * the header of `scripts/probe-how-soon-a-house-hears-from-its-people-away.ts`.
 * On the second cut: 611 reports sent, most of them twenty days before the
 * province's own air would have reached the seat and 68 the seat would not have
 * heard by the end; 9,901 look-ins finding 267 people gone; 952 recruits
 * reported on a slip; the advance 38.9s against 37.8s. With the board doing the
 * cutting, 30 of 87 houses had no stock left at two hundred years. With a
 * sitting at home taken between other work, 5 of 93, and 35 of 14,165
 * house-years with none while somebody who could cut stood at the seat; 9,959
 * stacks handed out, 1,327 recruits reported on a slip, 40.8s against 38.9s.
 *
 * Red-checked: with the report step returning nothing, with `SENT_WORD_HOME`
 * taken out of `whatAHousesOwnErrandsBringBack`, with the reach check removed,
 * with the cutting floor lowered to 0; and, together, with the board's floor
 * filter off, the `WORTH_REPEATING` bar off, a link costing a day more in the
 * province walk, and the landing returning nothing (six tests red).
 */

import { describe, expect, it } from 'vitest';

import {
    THE_COMMUNICATION_TALISMAN,
    WHO_CAN_CUT_A_COMMUNICATION_TALISMAN,
    couldCutACommunicationTalisman
} from '../../../src/data/cultivation/communication-talismans.js';
import { SECTS, sectThreat } from '../../../src/data/cultivation/sects.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import {
    addToTheStack,
    burnACommunicationTalisman,
    howFarFromTheSeat,
    howManyTheHouseHas,
    howManyTheyCarry
} from '../../../src/engine/world/a-communication-talisman-carries-word-home.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    doesTheHouseExpect,
    theReportsTheyOwe,
    theyOweTheHouseAReport
} from '../../../src/engine/world/a-house-expects-somebody-it-took-on.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { linkLocations, makeLocation, walkingDaysFrom } from '../../../src/engine/world/locations.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { seedTreasuries } from '../../../src/engine/world/what-a-house-keeps-in-its-treasury.js';
import {
    A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS,
    A_STACK_A_HOUSE_HANDS_OUT,
    aLookInFallsDue,
    aSittingAtHomeIsTaken,
    freeForASittingAtHome,
    isThisHousesBusiness,
    itsCommunicationTalismansRunLow,
    theMakerThisIs,
    whatAHouseKeepsInStock,
    whatCuttingForTheHouseLands,
    wordFromThePeopleAway
} from '../../../src/engine/world/what-a-house-hears-from-its-people-away.js';
import { whatAHouseHasOnItsBoard } from '../../../src/engine/encounters/what-a-house-has-on-its-board.js';
import { peopleTakeWorkOffTheirHousesBoard } from '../../../src/engine/world/a-disciple-takes-work-off-the-board.js';
import { whatAHousesOwnErrandsBringBack } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;
const DAY = 200 * YEAR;
/** A catalog house, so the treasury seeder stocks it. */
const HOUSE = SECTS.find(s => (sectThreat(s.id)?.acting ?? 0) > 0)!.id;
const HOUSE_NAME = 'The House';
const SEAT = 'seat';
const TOWN = 'town';
const NEAR = 'near-town';
const FAR = 'far-town';

function person(state: WorldState, id: string, at: string, rankIndex: number, ordinal: number): NpcRecord {
    const npc = setRealm(createNpc(state.seed, {
        id, bornOnDay: DAY - 60 * YEAR, onDay: DAY, locationId: at, occupation: 'disciple'
    }), ordinal, DAY);
    return { ...npc, name: id, factionId: HOUSE, factionRankIndex: rankIndex, activity: null };
}

/**
 * A house seated in one province with a town in it, a town a province away on an
 * eight-day road and one on a twenty-day road. At home: an elder at Foundation,
 * two disciples who could host at the gate. In the town: one posted there.
 */
function build(opts: { postedOn?: number; cutter?: number } = {}): WorldState {
    const state = createWorld({ seed: 'a-house-hears-from-its-people-away', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    const home = makeLocation({ id: 'province', name: 'The Province', kind: 'region' });
    const next = makeLocation({ id: 'next-province', name: 'The Next Province', kind: 'region' });
    const far = makeLocation({ id: 'far-province', name: 'The Far Province', kind: 'region' });
    const seat = makeLocation({ id: SEAT, name: 'The Hall', kind: 'sect_seat', parentId: home.id });
    const town = makeLocation({ id: TOWN, name: 'Low Ford', kind: 'settlement', parentId: home.id });
    const near = makeLocation({ id: NEAR, name: 'Reed Crossing', kind: 'settlement', parentId: next.id });
    const distant = makeLocation({ id: FAR, name: 'Salt End', kind: 'settlement', parentId: far.id });
    linkLocations(town, near, 'road', 8);
    linkLocations(town, distant, 'road', 20);
    state.locations.push(home, next, far, seat, town, near, distant);
    state.factions.push(makeFaction({
        id: HOUSE, name: HOUSE_NAME, seatLocationId: SEAT, foundedOnDay: 0,
        ranks: ['Outer', 'Inner', 'Core', 'Elder', 'Head'],
        resources: { spirit_stones: 50_000, power_ordinal: 20, reliable_ordinal: 20 }
    }));
    const postedOn = opts.postedOn ?? DAY + 2;
    state.npcs.push(
        person(state, 'elder', SEAT, 4, opts.cutter ?? FOUNDATION_ORDINAL + 2),
        person(state, 'inner-one', SEAT, 3, 8),
        person(state, 'inner-two', SEAT, 3, 9),
        {
            ...person(state, 'posted', TOWN, 2, 10),
            activity: {
                kind: 'stationed', note: 'Holding the post.', withIds: [], sinceDay: postedOn,
                untilDay: postedOn + 20 * YEAR, returnTo: SEAT
            }
        }
    );
    // The house's own stock, as the treasury seeder leaves it.
    addToTheStack(state.objects, {
        houseId: HOUSE, houseName: HOUSE_NAME, holderId: null, count: whatAHouseKeepsInStock(4), locationId: SEAT
    });
    return state;
}

/** Something that happened in the posted member's town, of the kind a house wants to know. */
function somethingHappensInTown(state: WorldState, onDay: number) {
    return appendWorldFact(state, makeFact({
        day: onDay,
        kind: 'catastrophe',
        scale: 'local',
        visibility: 'public',
        magnitude: 0.5,
        summary: 'Something came out of the treeline at Low Ford.',
        locationId: TOWN
    }));
}

const wordAbout = (state: WorldState, factId: string) =>
    state.history.facts.filter(f => f.data.communicationTalisman === true && f.data.wordOf === factId);

describe('a house keeps communication talismans, marked with it', () => {
    it('stocks a stack for everybody on its roll when the treasury is seeded', () => {
        const state = build();
        state.objects.length = 0;
        const rows = seedTreasuries(state);
        const stock = rows.filter(o => o.tags.includes('communication-talismans') && o.ownerId === HOUSE);
        expect(stock).toHaveLength(1);
        expect(stock[0]!.data.markedBy).toBe(HOUSE);
        expect(stock[0]!.data.quantity).toBe(whatAHouseKeepsInStock(4));
        // Counted: one row with a number, and never the tag the strike and
        // teleportation slips carry.
        expect(stock[0]!.significance).toBe('mundane');
        expect(stock[0]!.tags).not.toContain('talisman');
    });

    it('and hands a stack to somebody it has just posted away', () => {
        const state = build();
        const before = howManyTheHouseHas(state.objects, HOUSE);
        wordFromThePeopleAway(state, { day: DAY + 10 });
        expect(howManyTheyCarry(state.objects, 'posted', HOUSE)).toBe(A_STACK_A_HOUSE_HANDS_OUT);
        expect(howManyTheHouseHas(state.objects, HOUSE)).toBe(before - A_STACK_A_HOUSE_HANDS_OUT);
    });
});

describe('a posted member sends word home', () => {
    it('and the house holds it on the day the slip is burnt, before the air would have got it there', () => {
        const state = build();
        const happened = somethingHappensInTown(state, DAY + 5);
        const told = () => whatAHousesOwnErrandsBringBack(state.history.facts)(HOUSE, TOWN);
        expect(told()).toBe('unaware');

        const year = wordFromThePeopleAway(state, { day: DAY + 30 });

        const word = wordAbout(state, happened.id);
        expect(word).toHaveLength(1);
        expect(word[0]!.day, 'the day it happened, which is the day they saw it').toBe(DAY + 5);
        expect(word[0]!.factionIds).toEqual([HOUSE]);
        expect(word[0]!.visibility, 'a slip is heard by the house and nobody in the square').toBe('secret');
        expect(told(), 'the house can now point at the ground the word was about').toBe('placed');

        const report = year.reports.find(r => r.aboutFactId === happened.id)!;
        expect(report.reportedOn).toBe(DAY + 5);
        expect(report.seatWouldHaveHeardOn === null || report.seatWouldHaveHeardOn > report.reportedOn).toBe(true);
    });

    it('and the slip is spent: one fewer on the stack, and nothing kept of it', () => {
        const state = build();
        somethingHappensInTown(state, DAY + 5);
        const rows = state.objects.length;
        wordFromThePeopleAway(state, { day: DAY + 30 });
        expect(howManyTheyCarry(state.objects, 'posted', HOUSE)).toBe(A_STACK_A_HOUSE_HANDS_OUT - 1);
        // One stack row for the posted member, added when it was handed over.
        expect(state.objects.length).toBe(rows + 1);
        expect(state.objects.some(o => o.data.spent === true)).toBe(false);
    });

    it('does not say the same thing twice', () => {
        const state = build();
        const happened = somethingHappensInTown(state, DAY + 5);
        wordFromThePeopleAway(state, { day: DAY + 30 });
        wordFromThePeopleAway(state, { day: DAY + 30 + YEAR });
        expect(wordAbout(state, happened.id)).toHaveLength(1);
    });
});

describe('a slip is a count and a distance', () => {
    const send = (state: WorldState, from: string) => burnACommunicationTalisman(state, {
        senderId: 'posted', senderName: 'posted', houseId: HOUSE, fromLocationId: from,
        onDay: DAY + 1, to: { kind: 'the_hall' }, says: 'word.'
    });

    it('with none, no word goes and nothing is written', () => {
        const state = build();
        const facts = state.history.facts.length;
        const burnt = send(state, TOWN);
        expect(burnt).toMatchObject({ sent: false, why: 'no_slip', carrying: 0 });
        expect(state.history.facts.length).toBe(facts);
    });

    it(`carries ${THE_COMMUNICATION_TALISMAN.reachWalkingDays} walking days and no further, and says the distance`, () => {
        const state = build();
        addToTheStack(state.objects, { houseId: HOUSE, houseName: HOUSE_NAME, holderId: 'posted', count: 2 });

        const far = send(state, FAR);
        expect(far).toMatchObject({ sent: false, why: 'out_of_reach', walkingDays: 20 });
        expect(howManyTheyCarry(state.objects, 'posted', HOUSE), 'nothing burnt').toBe(2);

        const near = send(state, NEAR);
        expect(near).toMatchObject({ sent: true, walkingDays: 8 });
        expect(howManyTheyCarry(state.objects, 'posted', HOUSE)).toBe(1);
    });

    it("and another house's slip does not reach this one", () => {
        const state = build();
        addToTheStack(state.objects, { houseId: 'somebody-else', houseName: 'Else', holderId: 'posted', count: 2 });
        expect(send(state, TOWN)).toMatchObject({ sent: false, why: 'no_slip' });
    });
});

describe('the house looks in on its postings', () => {
    it(`every ${A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS} years from the day they were posted`, () => {
        const every = A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * YEAR;
        expect(aLookInFallsDue(DAY, null, DAY, DAY + 364)).toBeNull();
        expect(aLookInFallsDue(DAY, null, DAY + every - 10, DAY + every + 10)).toBe(DAY + every);
        expect(aLookInFallsDue(DAY, DAY + every - 1, DAY + every - 10, DAY + every + 10), 'not after it ends').toBeNull();
    });

    it('sends somebody with a fresh stack, and there and well is not a row', () => {
        const postedOn = DAY - A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * YEAR + 10;
        const state = build({ postedOn });
        const year = wordFromThePeopleAway(state, { day: DAY + 200 });
        expect(year.lookedIn).toBe(1);
        expect(howManyTheyCarry(state.objects, 'posted', HOUSE)).toBe(A_STACK_A_HOUSE_HANDS_OUT);
        expect(state.history.facts.some(f => f.data.lookedInOn === 'posted')).toBe(false);
    });

    it('and a wound it finds is a fact the house holds', () => {
        const postedOn = DAY - A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * YEAR + 10;
        const state = build({ postedOn });
        const at = state.npcs.findIndex(n => n.id === 'posted');
        const row = state.npcs[at]!;
        state.npcs[at] = { ...row, cultivation: { ...row.cultivation, untreatedInjuries: 1 } };
        wordFromThePeopleAway(state, { day: DAY + 200 });
        const visit = state.history.facts.find(f => f.data.lookedInOn === 'posted');
        expect(visit?.factionIds).toEqual([HOUSE]);
        expect(visit?.locationId).toBe(TOWN);
        expect(visit?.summary).toMatch(/untreated wound/);
    });

    it('and that is how a house learns somebody posted away is dead', () => {
        const postedOn = DAY - A_POSTING_IS_LOOKED_IN_ON_EVERY_YEARS * YEAR + 10;
        const state = build({ postedOn });
        const at = state.npcs.findIndex(n => n.id === 'posted');
        state.npcs[at] = { ...state.npcs[at]!, status: 'physically_dead', diedOnDay: DAY - 100 };
        const year = wordFromThePeopleAway(state, { day: DAY + 200 });
        expect(year.foundGone).toBe(1);
        const visit = state.history.facts.find(f => f.data.lookedInOn === 'posted');
        expect(visit?.summary).toMatch(/is dead/);
        expect(howManyTheyCarry(state.objects, 'posted', HOUSE), 'nobody hands the dead a stack').toBe(0);
    });
});

describe('a recruiter reports a recruit to the Internal Affairs Elder', () => {
    const owed = (state: WorldState) => theyOweTheHouseAReport(state, 'posted', {
        houseId: HOUSE, person: { id: 'recruit', name: 'Recruit' }, placeId: TOWN, onDay: DAY + 3
    });

    it('on a slip, so the house expects them', () => {
        const state = build();
        owed(state);
        wordFromThePeopleAway(state, { day: DAY + 30 });
        const house = state.factions.find(f => f.id === HOUSE)!;
        expect(doesTheHouseExpect(house, 'recruit')?.reportedOnDay).toBe(DAY + 3);
        expect(theReportsTheyOwe(state.npcs.find(n => n.id === 'posted')!)).toHaveLength(0);
    });

    it('and with no slip the report is still owed, and nobody is expected', () => {
        const state = build({ postedOn: DAY - YEAR });
        owed(state);
        wordFromThePeopleAway(state, { day: DAY + 30 });
        const house = state.factions.find(f => f.id === HOUSE)!;
        expect(doesTheHouseExpect(house, 'recruit')).toBeNull();
        expect(theReportsTheyOwe(state.npcs.find(n => n.id === 'posted')!)).toHaveLength(1);
    });
});

describe('who cuts them', () => {
    it('anyone at Foundation or above, and nobody below', () => {
        expect(WHO_CAN_CUT_A_COMMUNICATION_TALISMAN).toBe(FOUNDATION_ORDINAL);
        expect(couldCutACommunicationTalisman(FOUNDATION_ORDINAL - 1)).toBe(false);
        expect(couldCutACommunicationTalisman(FOUNDATION_ORDINAL)).toBe(true);
    });

    it('a house that is short posts the cutting on its board, and only to somebody at Foundation', () => {
        const state = build();
        const house = { id: HOUSE, name: HOUSE_NAME, holdsGround: false, standing: {}, hasAFind: false };
        const cutting = (ordinal: number, short: boolean) => whatAHouseHasOnItsBoard({
            house: { ...house, itsCommunicationTalismansRunLow: short }, ordinal
        }).some(e => e.id.includes('sending-to-cut-communication-talismans'));
        expect(itsCommunicationTalismansRunLow(state, HOUSE, 4)).toBe(false);
        expect(cutting(FOUNDATION_ORDINAL, false), 'not posted while the stock is full').toBe(false);
        expect(cutting(FOUNDATION_ORDINAL, true)).toBe(true);
        expect(cutting(FOUNDATION_ORDINAL - 1, true), 'not offered under the floor').toBe(false);
    });

    it('the pass cuts nothing itself, so a house nobody cuts for runs short', () => {
        const state = build();
        const stock = howManyTheHouseHas(state.objects, HOUSE);
        wordFromThePeopleAway(state, { day: DAY + 10 });
        wordFromThePeopleAway(state, { day: DAY + 10 + YEAR });
        expect(howManyTheHouseHas(state.objects, HOUSE)).toBe(stock - A_STACK_A_HOUSE_HANDS_OUT);
        expect(itsCommunicationTalismansRunLow(state, HOUSE, 4)).toBe(true);
    });

    it('what the work cuts lands in the stock when its term closes, up to what the house is short', () => {
        const state = build();
        wordFromThePeopleAway(state, { day: DAY + 10 });
        const short = howManyTheHouseHas(state.objects, HOUSE);
        const elder = state.npcs.find(n => n.id === 'elder')!;
        const term = { thingId: THE_COMMUNICATION_TALISMAN.id, sinceDay: DAY + 20, untilDay: DAY + 40 };
        expect(whatCuttingForTheHouseLands(state, theMakerThisIs(elder), term)).toBe(whatAHouseKeepsInStock(4) - short);
        expect(howManyTheHouseHas(state.objects, HOUSE)).toBe(whatAHouseKeepsInStock(4));
        expect(whatCuttingForTheHouseLands(state, theMakerThisIs(elder), term), 'nobody cuts into a full drawer').toBe(0);
    });

    it('and nothing lands for a hand under Foundation, or for other work', () => {
        const state = build({ cutter: FOUNDATION_ORDINAL - 1 });
        wordFromThePeopleAway(state, { day: DAY + 10 });
        const elder = state.npcs.find(n => n.id === 'elder')!;
        expect(whatCuttingForTheHouseLands(state, theMakerThisIs(elder),
            { thingId: THE_COMMUNICATION_TALISMAN.id, sinceDay: DAY + 20, untilDay: DAY + 40 })).toBe(0);
        const able = { ...elder, cultivation: { ...elder.cultivation, realmOrdinal: FOUNDATION_ORDINAL } };
        expect(whatCuttingForTheHouseLands(state, theMakerThisIs(able), { thingId: 'a-manual', sinceDay: DAY, untilDay: DAY + 20 })).toBe(0);
    });
});

describe('what somebody away thinks worth a slip', () => {
    const house = { standing: { 'a-rival': -0.5, 'a-stranger': 0 } };
    const ours = new Set(['one-of-ours']);
    const fact = (over: Partial<{ magnitude: number; scale: 'personal' | 'local'; factionIds: string[]; actors: { id: string; name: string; role: string }[] }>) => ({
        magnitude: 0.45, scale: 'local' as const, factionIds: ['a-rival'], actors: [], ...over
    });

    it('a rival raising an elder, and not a rival taking on a disciple', () => {
        expect(isThisHousesBusiness(fact({ magnitude: 0.45 }), house, ours)).toBe(true);
        expect(isThisHousesBusiness(fact({ magnitude: 0.3 }), house, ours)).toBe(false);
    });

    it('anything about one of its own, and nothing about a house of no concern', () => {
        expect(isThisHousesBusiness(fact({
            magnitude: 0.2, scale: 'personal', factionIds: ['a-stranger'],
            actors: [{ id: 'one-of-ours', name: 'x', role: 'heir' }]
        }), house, ours)).toBe(true);
        expect(isThisHousesBusiness(fact({ magnitude: 0.9, factionIds: ['a-stranger'] }), house, ours)).toBe(false);
    });

    it('and news of the ground itself when it is heavy enough to repeat', () => {
        expect(isThisHousesBusiness(fact({ magnitude: 0.55, factionIds: [] }), house, ours)).toBe(true);
        expect(isThisHousesBusiness(fact({ magnitude: 0.25, factionIds: [] }), house, ours)).toBe(false);
    });
});

describe('a sitting between other work', () => {
    const short = (state: WorldState) => {
        const at = state.objects.findIndex(o => o.ownerId === HOUSE && o.possessorId === null
            && o.tags.includes('communication-talismans'));
        state.objects[at] = { ...state.objects[at]!, data: { ...state.objects[at]!.data, quantity: 0 } };
    };
    const at = (state: WorldState, id: string) => state.npcs.findIndex(n => n.id === id);
    const doing = (state: WorldState, id: string, activity: NpcRecord['activity']) => {
        const i = at(state, id);
        state.npcs[i] = { ...state.npcs[i]!, activity };
    };
    const teaching: NpcRecord['activity'] = {
        kind: 'teaching', note: 'Teaching.', withIds: ['inner-one'], sinceDay: DAY, untilDay: DAY + YEAR
    };

    it('is free for somebody at the seat who is teaching or at the work of their rank, and nobody else', () => {
        const state = build();
        const elder = () => state.npcs[at(state, 'elder')]!;
        expect(freeForASittingAtHome(elder(), SEAT)).toBe(true);
        doing(state, 'elder', teaching);
        expect(freeForASittingAtHome(elder(), SEAT)).toBe(true);
        doing(state, 'elder', { kind: 'the_work_of_their_rank', note: 'At it.', withIds: [], sinceDay: DAY });
        expect(freeForASittingAtHome(elder(), SEAT)).toBe(true);
        doing(state, 'elder', {
            kind: 'the_work_of_their_rank', note: 'Copying.', withIds: [], sinceDay: DAY, untilDay: DAY + 30,
            thingId: 'a-manual'
        });
        expect(freeForASittingAtHome(elder(), SEAT), 'at a desk making something').toBe(false);
        doing(state, 'elder', { kind: 'talking', note: 'Talking.', withIds: ['inner-one'], sinceDay: DAY });
        expect(freeForASittingAtHome(elder(), SEAT), 'in a scene').toBe(false);
        const onABoardTerm = (activity: NpcRecord['activity']) =>
            ({ ...elder(), activity, tags: [...elder().tags, `board-work|${HOUSE}|${DAY + 20}|10|5`] });
        expect(freeForASittingAtHome(onABoardTerm(teaching), SEAT), 'teaching, with an old term on them').toBe(true);
        expect(freeForASittingAtHome(onABoardTerm(
            { kind: 'the_work_of_their_rank', note: 'At a notice.', withIds: [], sinceDay: DAY, untilDay: DAY + 20 }
        ), SEAT), 'at a board term at home already').toBe(false);
        doing(state, 'elder', null);
        expect(freeForASittingAtHome(elder(), 'somewhere-else'), 'away from the seat').toBe(false);
        expect(freeForASittingAtHome(state.npcs[at(state, 'posted')]!, SEAT), 'posted away').toBe(false);
    });

    it('a teacher at the seat cuts for a short house, is counted for it, and goes on teaching', () => {
        const state = build();
        short(state);
        doing(state, 'elder', teaching);
        const house = { id: HOUSE, name: HOUSE_NAME, holdsGround: false, standing: {}, hasAFind: false,
            itsCommunicationTalismansRunLow: true };
        const roll = state.npcs.map((n, i) => (n.factionId === HOUSE ? i : -1)).filter(i => i >= 0);
        const sat = aSittingAtHomeIsTaken(state, {
            house, seatLocationId: SEAT, roll, reach: FOUNDATION_ORDINAL + 2, day: DAY + 10, alreadyTaken: () => 0
        });
        expect(sat).toBe(1);
        expect(howManyTheHouseHas(state.objects, HOUSE)).toBeGreaterThan(0);
        const elder = state.npcs[at(state, 'elder')]!;
        expect(elder.activity, 'nothing they were at is interrupted').toEqual(teaching);
        expect(elder.merit?.points ?? 0).toBeGreaterThan(0);
    });

    it('not a notice the wholly free have already filled, and not under the floor', () => {
        const state = build();
        short(state);
        const house = { id: HOUSE, name: HOUSE_NAME, holdsGround: false, standing: {}, hasAFind: false,
            itsCommunicationTalismansRunLow: true };
        const roll = state.npcs.map((n, i) => (n.factionId === HOUSE ? i : -1)).filter(i => i >= 0);
        const input = { house, seatLocationId: SEAT, roll, reach: FOUNDATION_ORDINAL + 2, day: DAY + 10 };
        expect(aSittingAtHomeIsTaken(state, { ...input, alreadyTaken: () => 1 })).toBe(0);
        const below = build({ cutter: FOUNDATION_ORDINAL - 1 });
        short(below);
        const belowRoll = below.npcs.map((n, i) => (n.factionId === HOUSE ? i : -1)).filter(i => i >= 0);
        expect(aSittingAtHomeIsTaken(below, {
            ...input, roll: belowRoll, reach: FOUNDATION_ORDINAL - 1, alreadyTaken: () => 0
        })).toBe(0);
        expect(howManyTheHouseHas(below.objects, HOUSE)).toBe(0);
    });

    it('and the board pass asks it, so a house whose only cutter is teaching is stocked', () => {
        const state = build();
        short(state);
        doing(state, 'elder', teaching);
        peopleTakeWorkOffTheirHousesBoard(state, 200, DAY + 10);
        expect(howManyTheHouseHas(state.objects, HOUSE)).toBeGreaterThan(0);
        expect(state.npcs[at(state, 'elder')]!.activity).toEqual(teaching);
    });
});

describe('how far a slip has to carry', () => {
    it('is the full walk, read over the provinces', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'afford-a', catalog });
        const howFar = howFarFromTheSeat(state.locations);
        let compared = 0;
        for (const seat of state.factions.map(f => f.seatLocationId).filter((id): id is string => id !== null).slice(0, 12)) {
            const walked = walkingDaysFrom(state.locations, seat);
            for (const place of state.locations) {
                expect(howFar(seat, place.id), `${seat} to ${place.id}`).toBe(walked.get(place.id) ?? null);
                compared++;
            }
        }
        expect(compared).toBeGreaterThan(1000);
    }, 120_000);
});
