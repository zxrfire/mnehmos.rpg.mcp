/**
 * A house expects somebody it took on, and lets them in at the gate on that word.
 *
 * The design owner's ruling: the recruiter reports back to the Internal Affairs
 * Elder, the house expects the person by name with who took them on and where,
 * and somebody never entered and not known by face is let in when they are on
 * that list and can say who took them on. A stranger claiming a name is stopped.
 * The word travels by communication talisman or, with no slip, with the
 * recruiter the next time they are at the house.
 *
 * AND WITH NO REPORT THEY ARE QUESTIONED. The first cut stopped them at the gate
 * until the report came, measured with `probe-is-a-recruit-expected-at-the-gate.ts`,
 * four seeds summed, at 3 waiting at 25 years and 10 at 60 - people whose
 * recruiter died before they were next at the house. The design owner: *"the
 * house still knows the recruiter went to the area and knows what their standards
 * are, right? Questioned and allowed if matched, else rejected."* The same probe
 * after it, entries counted by what the house made of them at the start of the
 * year they were entered:
 *
 *                                   25 years          60 years
 *   on the report                    434              1069
 *   on questioning                    72               124
 *   nobody took them on               12                50
 *   waiting at the gate                0                 0
 *   rejected on questioning            0                 1
 *
 * (The worlds moved under other work between the two measurements, so the
 * counts of people are not comparable across them; the waiting are.)
 *
 * Red-checked: the pass not making a recruiter's report (let in on that report);
 * the gate not reading the house's word (the three the gate lets in); questioning always matching (the three turned away go
 * red); the recruiter's whereabouts not compared (somewhere else then); the bar
 * not read (does not meet what the house takes); and the pass not turning off its
 * roll somebody questioning rejected (not of the house).
 */

import { describe, expect, it } from 'vitest';

import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { THE_INTERNAL_AFFAIRS_ELDER } from '../../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import {
    aRecruiterOwesTheHouseAReport,
    doesTheHouseExpect,
    theHouseExpects,
    theReportsTheyOwe,
    theyOweTheHouseAReport,
    whatTheHouseMakesOfSomebodyNew,
    whoTheHouseExpects,
    whoTheySayTookThemOn
} from '../../../src/engine/world/a-house-expects-somebody-it-took-on.js';
import {
    aUniformFor,
    enterWhoeverHasReachedTheHouse,
    wearsTheRobesOf
} from '../../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { standingAtTheGateOf, type AtTheGateInput } from '../../../src/engine/world/standing-at-the-gate-of-a-house.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;
const DAY = 200 * YEAR;
const HOUSE = 'house-a';
const HOUSE_NAME = 'Stone Gate Sect';
const SEAT = 'seat-a';
const VILLAGE = 'loc-village';
const FAR = 'loc-far';
/** Holding the village post, so the house does not send its elder to hold it. */
const POSTED = {
    kind: 'stationed' as const, note: 'Holding the post.', withIds: [], sinceDay: DAY,
    untilDay: DAY + 50 * YEAR, returnTo: SEAT
};

function person(state: WorldState, id: string, at: string, rankIndex: number, faction: string | null = HOUSE): NpcRecord {
    const npc = setRealm(createNpc(state.seed, {
        id, name: id, bornOnDay: DAY - 60 * YEAR, onDay: DAY, locationId: at, occupation: 'disciple'
    }), 6, DAY);
    return { ...npc, factionId: faction, factionRankIndex: faction === null ? -1 : rankIndex, activity: null };
}

/**
 * A house with an elder at home and a disciple posted in a village a few days
 * off, and a recruit standing in that village, just taken on.
 */
function build(): WorldState {
    const state = createWorld({ seed: 'a-house-expects-somebody', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    const region = makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' });
    const elsewhere = makeLocation({ id: 'loc-region-2', name: 'The Next Province', kind: 'region' });
    const seat = makeLocation({ id: SEAT, name: 'The Hall', kind: 'sect_seat', parentId: region.id });
    const village = makeLocation({ id: VILLAGE, name: 'Low Ford', kind: 'settlement', parentId: region.id });
    const far = makeLocation({ id: FAR, name: 'Far Ford', kind: 'settlement', parentId: elsewhere.id });
    linkLocations(seat, village, 'road', 6);
    state.locations.push(region, elsewhere, seat, village, far);
    state.factions.push(makeFaction({
        id: HOUSE, name: HOUSE_NAME, seatLocationId: SEAT, foundedOnDay: 0,
        resources: { spirit_stones: 50_000, power_ordinal: 4, reliable_ordinal: 4 }
    }));
    state.npcs.push(
        person(state, 'elder', SEAT, 4),
        { ...person(state, 'posted', VILLAGE, 2), activity: POSTED },
        person(state, 'recruit', VILLAGE, 0)
    );
    state.objects.push(
        aUniformFor({ memberId: 'elder', houseId: HOUSE, houseName: HOUSE_NAME, onDay: 0 }),
        aUniformFor({ memberId: 'posted', houseId: HOUSE, houseName: HOUSE_NAME, onDay: 0 })
    );
    return state;
}

const npc = (state: WorldState, id: string) => state.npcs.find(n => n.id === id)!;
const house = (state: WorldState) => state.factions.find(f => f.id === HOUSE)!;
const put = (state: WorldState, id: string, locationId: string) => {
    const at = state.npcs.findIndex(n => n.id === id);
    state.npcs[at] = { ...state.npcs[at]!, locationId, activity: null };
};

describe('whoever took somebody on owes the house a report', () => {
    it('is whoever of the house stood where they were taken on, and the recruit knows who', () => {
        const state = build();
        const recruiter = aRecruiterOwesTheHouseAReport(state, {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' }, placeId: VILLAGE, onDay: DAY
        });
        expect(recruiter?.id).toBe('posted');
        expect(theReportsTheyOwe(npc(state, 'posted'))).toEqual([expect.objectContaining({
            houseId: HOUSE, personId: 'recruit', whereId: VILLAGE, whereName: 'Low Ford', takenOnDay: DAY
        })]);
        expect(whoTheySayTookThemOn(npc(state, 'recruit'), HOUSE)).toEqual(expect.objectContaining({
            recruiterId: 'posted', recruiterName: 'posted', whereName: 'Low Ford'
        }));
        // Not yet told, so not yet expected.
        expect(doesTheHouseExpect(house(state), 'recruit')).toBeNull();
    });

    it('is somebody in the house\'s compound where nobody of the house stood there', () => {
        const state = build();
        put(state, 'posted', FAR);
        const recruiter = aRecruiterOwesTheHouseAReport(state, {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' }, placeId: VILLAGE, onDay: DAY,
            inReach: id => id === VILLAGE || id === SEAT
        });
        expect(recruiter?.id).toBe('elder');
    });

    it('is nobody where the house has nobody in reach, and then nobody owes anything', () => {
        const state = build();
        state.factions[0] = { ...state.factions[0]!, seatLocationId: null };
        put(state, 'posted', FAR);
        put(state, 'elder', FAR);
        const recruiter = aRecruiterOwesTheHouseAReport(state, {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' }, placeId: VILLAGE, onDay: DAY
        });
        expect(recruiter).toBeNull();
        expect(whoTheySayTookThemOn(npc(state, 'recruit'), HOUSE)).toBeNull();
    });
});

describe('the report reaches the Internal Affairs office, however it travelled', () => {
    it('writes the expectation with who reported, the day, and the office it was addressed to', () => {
        const state = build();
        theyOweTheHouseAReport(state, 'posted', {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' }, placeId: VILLAGE, onDay: DAY
        });
        const written = theHouseExpects(state, {
            houseId: HOUSE,
            person: { id: 'recruit', name: 'recruit' },
            recruiter: { id: 'posted', name: 'posted' },
            where: { id: VILLAGE, name: 'Low Ford' },
            takenOnDay: DAY,
            reportedBy: { id: 'posted' },
            onDay: DAY + 3,
            addressedTo: THE_INTERNAL_AFFAIRS_ELDER
        });
        expect(written).not.toBeNull();
        expect(doesTheHouseExpect(house(state), 'recruit')).toEqual({
            personId: 'recruit',
            personName: 'recruit',
            recruiterId: 'posted',
            recruiterName: 'posted',
            whereId: VILLAGE,
            whereName: 'Low Ford',
            takenOnDay: DAY,
            reportedById: 'posted',
            reportedOnDay: DAY + 3,
            addressedTo: 'Internal Affairs Elder',
            // Nobody holds the office today: the house holds the word regardless.
            receivedById: null
        });
        // Made, so no longer owed: a slip and a walk cannot both deliver it.
        expect(theReportsTheyOwe(npc(state, 'posted'))).toEqual([]);
        // And once, however often it arrives.
        theHouseExpects(state, {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' },
            recruiter: { id: 'posted', name: 'posted' }, where: null, takenOnDay: DAY,
            reportedBy: null, onDay: DAY + 4, addressedTo: THE_INTERNAL_AFFAIRS_ELDER
        });
        expect(whoTheHouseExpects(house(state))).toHaveLength(1);
    });
});

describe('a recruiter with no slip reports when they are next at the house', () => {
    it('and a recruit let in on that report is not questioned', () => {
        const state = build();
        theyOweTheHouseAReport(state, 'posted', {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' }, placeId: VILLAGE, onDay: DAY
        });
        put(state, 'recruit', SEAT);
        put(state, 'posted', SEAT);
        const done = enterWhoeverHasReachedTheHouse(state, DAY + YEAR);
        expect(done.reported).toBe(1);
        expect(done.admittedOnQuestioning).toBe(0);
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(true);
        // Entered, so no longer expected and nobody asks who took them on again.
        expect(doesTheHouseExpect(house(state), 'recruit')).toBeNull();
        expect(whoTheySayTookThemOn(npc(state, 'recruit'), HOUSE)).toBeNull();
    });

    it('while somebody nobody took on - born or woken inside the house - is not new at its gate', () => {
        const state = build();
        state.npcs.push(person(state, 'woken', SEAT, 4));
        const done = enterWhoeverHasReachedTheHouse(state, DAY);
        expect(done.admittedOnQuestioning + done.rejected).toBe(0);
        expect(wearsTheRobesOf(state.objects, 'woken', HOUSE)).toBe(true);
    });

    it('and the house stops expecting somebody who is no longer on its roll', () => {
        const state = build();
        theHouseExpects(state, {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' },
            recruiter: { id: 'posted', name: 'posted' }, where: null, takenOnDay: DAY,
            reportedBy: { id: 'posted' }, onDay: DAY, addressedTo: THE_INTERNAL_AFFAIRS_ELDER
        });
        const at = state.npcs.findIndex(n => n.id === 'recruit');
        state.npcs[at] = { ...state.npcs[at]!, factionId: null, factionRankIndex: -1 };
        enterWhoeverHasReachedTheHouse(state, DAY);
        expect(doesTheHouseExpect(house(state), 'recruit')).toBeNull();
    });
});

/**
 * NO REPORT, SO THE INTERNAL AFFAIRS ELDER ASKS. The design owner: *"the house
 * still knows the recruiter went to the area and knows what their standards are,
 * right? Questioned and allowed if matched, else rejected."*
 */
describe('with no report, the recruit is questioned', () => {
    /** Taken on in the village by the disciple posted there, who has not reported; now at the gate. */
    function atTheGateWithNoReport(): WorldState {
        const state = build();
        theyOweTheHouseAReport(state, 'posted', {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' }, placeId: VILLAGE, onDay: DAY
        });
        put(state, 'recruit', SEAT);
        return state;
    }
    const made = (state: WorldState) => whatTheHouseMakesOfSomebodyNew(state, house(state), npc(state, 'recruit'));

    it('lets them in when the one they name was posted where they say, and they meet the bar', () => {
        const state = atTheGateWithNoReport();
        const read = made(state);
        expect(read.reading).toBe('admitted on questioning');
        expect(read.reading === 'admitted on questioning' && read.because).toContain('posted in that province');
        const done = enterWhoeverHasReachedTheHouse(state, DAY);
        expect(done.admittedOnQuestioning).toBe(1);
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(true);
    });

    it('and the same when the one they name died before they could report', () => {
        const state = atTheGateWithNoReport();
        const at = state.npcs.findIndex(n => n.id === 'posted');
        state.npcs[at] = { ...state.npcs[at]!, status: 'physically_dead', diedOnDay: DAY + 5 };
        expect(made(state).reading).toBe('admitted on questioning');
        enterWhoeverHasReachedTheHouse(state, DAY + YEAR);
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(true);
    });

    it('and a report about somebody else is not the word for them, so they are questioned too', () => {
        const state = atTheGateWithNoReport();
        theHouseExpects(state, {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' },
            recruiter: { id: 'elder', name: 'elder' }, where: null, takenOnDay: DAY,
            reportedBy: { id: 'elder' }, onDay: DAY, addressedTo: THE_INTERNAL_AFFAIRS_ELDER
        });
        expect(made(state).reading).toBe('admitted on questioning');
    });

    it('turns them away when the one they name is not of the house', () => {
        const state = atTheGateWithNoReport();
        const at = state.npcs.findIndex(n => n.id === 'posted');
        state.npcs[at] = { ...state.npcs[at]!, factionId: null, factionRankIndex: -1 };
        const read = made(state);
        expect(read.reading).toBe('rejected on questioning');
        expect(read.reading === 'rejected on questioning' && read.because).toContain('has nobody of its own called posted');
        const done = enterWhoeverHasReachedTheHouse(state, DAY);
        expect(done.rejected).toBe(1);
        expect(npc(state, 'recruit').factionId).toBeNull();
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(false);
    });

    it('turns them away when the house knows the one they name was somewhere else then', () => {
        const state = atTheGateWithNoReport();
        const at = state.npcs.findIndex(n => n.id === 'posted');
        state.npcs[at] = { ...state.npcs[at]!, locationId: FAR };
        const read = made(state);
        expect(read.reading).toBe('rejected on questioning');
        expect(read.reading === 'rejected on questioning' && read.because).toContain('away in The Next Province');
    });

    it('turns them away when they do not meet what the house takes', () => {
        const state = atTheGateWithNoReport();
        state.factions[0] = {
            ...state.factions[0]!,
            resources: { ...state.factions[0]!.resources, admission_ordinal: 12 }
        };
        const read = made(state);
        expect(read.reading).toBe('rejected on questioning');
        expect(read.reading === 'rejected on questioning' && read.because).toContain('takes from');
    });

    it('while a house that sent for somebody itself has its word already', () => {
        const state = build();
        theHouseExpects(state, {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' },
            recruiter: null, where: null, takenOnDay: DAY,
            reportedBy: null, onDay: DAY, addressedTo: THE_INTERNAL_AFFAIRS_ELDER
        });
        expect(made(state).reading).toBe('expected');
    });
});

describe('lived through the world\'s own year', () => {
    it('a recruit taken on by somebody at home is expected, arrives and is entered', () => {
        const state = build();
        theyOweTheHouseAReport(state, 'elder', {
            houseId: HOUSE, person: { id: 'recruit', name: 'recruit' }, placeId: VILLAGE, onDay: DAY
        });
        applyPressure(state, DAY, DAY + 2 * YEAR, { intensity: 0 });
        const recruit = npc(state, 'recruit');
        expect(recruit.factionId).toBe(HOUSE);
        expect(wearsTheRobesOf(state.objects, 'recruit', HOUSE)).toBe(true);
    });
});

describe('at the gate', () => {
    const RANKS = ['Servant', 'Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Sect Master'];
    const atTheGate = (over: Partial<AtTheGateInput>) => standingAtTheGateOf({
        factionId: HOUSE,
        factionName: HOUSE_NAME,
        ranks: RANKS,
        recruits: true,
        admissionOrdinal: 2,
        standing: 0,
        theirPeopleHere: [],
        theTokenNames: null,
        inTheRobes: false,
        aFaceTheyKnow: null,
        expected: null,
        ...over
    });
    const WORD = {
        reading: 'expected' as const, recruiterName: 'Wen Qiao', whereName: 'Low Ford',
        theyCanSayWhoTookThemOn: true, because: null
    };

    it('lets in somebody never entered whom the house expects, when they say who took them on', () => {
        const gate = atTheGate({ expected: WORD });
        expect(gate.way).toBe('on the roll');
        const said = gate.facts.join(' ');
        expect(said).toContain('You say Wen Qiao took you on at Low Ford');
        expect(said).toContain('The house was told to expect you by name');
    });

    it('lets them in on questioning, and says what the questioning found', () => {
        const gate = atTheGate({
            expected: { ...WORD, reading: 'admitted on questioning', because: 'Wen Qiao was posted there.' }
        });
        expect(gate.way).toBe('on the roll');
        const said = gate.facts.join(' ');
        expect(said).toContain('taken to its Internal Affairs Elder and questioned');
        expect(said).toContain('Wen Qiao was posted there.');
        expect(said).toContain('You are let in');
    });

    it('turns them away on questioning, and says why', () => {
        const gate = atTheGate({
            expected: { ...WORD, reading: 'rejected on questioning', because: 'Wen Qiao was away in the north.' }
        });
        expect(gate.way).toBe('turned away');
        const said = gate.facts.join(' ');
        expect(said).toContain('Wen Qiao was away in the north.');
        expect(said).toContain('You are not let in.');
        expect(said).not.toContain('A place on the roll would open it');
    });

    it('lets in somebody the house sent for, with nobody to name', () => {
        const gate = atTheGate({ expected: { ...WORD, recruiterName: null, theyCanSayWhoTookThemOn: false } });
        expect(gate.way).toBe('on the roll');
        expect(gate.facts.join(' ')).toContain('The house sent for you');
    });

    it('stops them when they cannot say who took them on', () => {
        const gate = atTheGate({ expected: { ...WORD, theyCanSayWhoTookThemOn: false } });
        expect(gate.way).toBe('stopped and asked');
        expect(gate.facts.join(' ')).toContain('you cannot say who took you on');
    });

    it('stops them when the house has no word of them', () => {
        const gate = atTheGate({ expected: null });
        expect(gate.way).toBe('stopped and asked');
        expect(gate.facts.join(' ')).toContain('Nobody at the gate was told to expect you');
    });

    it('and being expected is not a token: a stranger off the roll is turned away whatever they claim', () => {
        expect(atTheGate({ standing: null, expected: WORD }).way).toBe('turned away');
    });
});
