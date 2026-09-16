/**
 * A gate reads a token, and not a roll.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `standingAtTheGateOf` passed anybody whose rung on the house's roll was known,
 * and `whatTheTwoSay` and `theHouseTheirTokenNames` had no caller at all. So the
 * token - the one thing `a-house-knows-its-own-by-a-plate-and-a-token.ts` says a
 * stranger reads - was never read by anybody, and a recruit who had joined in a
 * village a province away walked through their house's gate on the strength of
 * a record nobody at the gate could see.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   carrying the house's token   passes, whatever the roll says. Off the roll
 *                                too: a genuine tag in the wrong hands still
 *                                reads as the house's, which is the seam the
 *                                plate file keeps open on purpose
 *   on the roll, no token        stopped and asked: "no token to read". An
 *                                obstacle, so a host, an asker and the wall are
 *                                all still said
 *   another house's token        stopped, and told whose it is
 *   a token cut for the dead     dust: reads as none, whoever carries it
 *
 * ── AND BELOW THE TOKEN RUNG, BY FACE ────────────────────────────────────
 *
 * Rung 0 carries no token, and every new disciple starts there, so a gate that
 * read only tokens stopped a house's own servants at their own door every time.
 * A house knows its people that far down by face: one of its own in its robes,
 * whose face somebody at the gate knows, passes. Whether a face is known is the
 * trust model's reading (`how-a-house-reads-a-face.ts`), the same one a lecture
 * hall reads a stranger on, from the other end. An unfamiliar face in the robes
 * of a big house is stopped, and so is a stranger in stolen robes.
 *
 * Red-checked: making the gate pass on the roll alone turns the stopped cases
 * red; making it ignore the face turns the known-face case red; letting a known
 * face pass without robes turns the no-robes case red.
 */

import { describe, expect, it } from 'vitest';

import {
    issueTo,
    theHouseTheirTokenNames
} from '../../../src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.js';
import {
    standingAtTheGateOf,
    type AtTheGateInput
} from '../../../src/engine/world/standing-at-the-gate-of-a-house.js';
import {
    theyKnowTheFace,
    whetherAFaceIsRemarkable,
    type AFaceBeingLookedAt
} from '../../../src/engine/social/how-a-house-reads-a-face.js';
import { A_ROLL_A_PLAYER_COULD_KNOW } from '../../../src/engine/world/a-house-raises-its-own.js';

const RANKS = ['Sword Servant', 'Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Grand Elder', 'Master'];
const HOST = { id: 'host', name: 'Wen Qiao', rankIndex: 4 };

function atTheGate(over: Partial<AtTheGateInput>): ReturnType<typeof standingAtTheGateOf> {
    return standingAtTheGateOf({
        factionId: 'house-a',
        factionName: 'Stone Gate Sect',
        ranks: RANKS,
        recruits: true,
        admissionOrdinal: 2,
        standing: null,
        theirPeopleHere: [HOST],
        theTokenNames: null,
        inTheRobes: false,
        aFaceTheyKnow: null,
        ...over
    });
}

describe('a gate reads a token, and not a roll', () => {
    it('passes somebody on the roll carrying the house\'s token', () => {
        const gate = atTheGate({ standing: 1, theTokenNames: 'house-a' });
        expect(gate.way).toBe('on the roll');
        expect(gate.facts.join(' ')).not.toMatch(/no token to read/);
    });

    it('stops somebody on the roll with nothing to show, and says so as a fact', () => {
        const gate = atTheGate({ standing: 1, theTokenNames: null });
        expect(gate.way).toBe('stopped and asked');
        expect(gate.facts.join(' ')).toContain('There is no token to read.');
    });

    it('and being stopped is an obstacle: every other way in is still said', () => {
        const said = atTheGate({ standing: 1, theTokenNames: null }).facts.join(' ');
        expect(said, 'the host road').toContain(HOST.name);
        expect(said, 'the wall').toMatch(/wall is a wall/);
        expect(said, 'what would give them a token').toMatch(/token is cut inside/);
    });

    it('stops somebody carrying another house\'s token, and says whose', () => {
        const gate = atTheGate({ standing: 1, theTokenNames: 'house-b' });
        expect(gate.way).toBe('stopped and asked');
        expect(gate.facts.join(' ')).toMatch(/another house's/);
    });

    it('passes somebody off the roll who carries a genuine token, which is the seam', () => {
        expect(atTheGate({ standing: null, theTokenNames: 'house-a' }).way).toBe('on the roll');
    });

    it('turns away a stranger with no token, as it always did', () => {
        expect(atTheGate({ standing: null, theTokenNames: null }).way).toBe('turned away');
    });

    it('lets a host walk in somebody stopped', () => {
        expect(atTheGate({ standing: 1, theTokenNames: null, hostedBy: HOST }).way).toBe('brought in');
    });
});

describe('below the token rung a house knows its people by face', () => {
    const KNOWN = { name: 'Wen Qiao', because: 'they have dealt with you and know your face.' };

    it('passes one of its own in its robes whose face somebody at the gate knows', () => {
        const gate = atTheGate({ standing: 0, inTheRobes: true, aFaceTheyKnow: KNOWN });
        expect(gate.way).toBe('on the roll');
        expect(gate.facts.join(' ')).toMatch(/knows your face/);
        expect(gate.facts.join(' ')).not.toMatch(/no token to read/);
    });

    it('stops one of its own in its robes whose face nobody at the gate knows, and says so', () => {
        const gate = atTheGate({ standing: 0, inTheRobes: true, aFaceTheyKnow: null });
        expect(gate.way).toBe('stopped and asked');
        expect(gate.facts.join(' ')).toContain('There is no token to read.');
        expect(gate.facts.join(' ')).toContain('nobody at the gate knows your face');
    });

    it('stops one of its own with no robes and no token, whoever knows them', () => {
        const gate = atTheGate({ standing: 0, inTheRobes: false, aFaceTheyKnow: KNOWN });
        expect(gate.way).toBe('stopped and asked');
        expect(gate.facts.join(' ')).toContain('not in the house\'s robes');
    });

    it('stops a stranger in the robes, and says nothing about a roll the guard cannot see', () => {
        const gate = atTheGate({ standing: null, inTheRobes: true, aFaceTheyKnow: KNOWN });
        expect(gate.way).toBe('stopped and asked');
        expect(gate.facts.join(' ')).not.toMatch(/on its roll|A place on the roll/);
    });

    it('and still turns away a stranger in their own clothes', () => {
        expect(atTheGate({ standing: null, inTheRobes: false, aFaceTheyKnow: null }).way).toBe('turned away');
    });
});

describe('whose face a house knows is the trust model\'s reading, from the house\'s end', () => {
    const ordinary: AFaceBeingLookedAt = {
        registers: true,
        knowsThem: false,
        inTheRobes: true,
        takenForRung: 3,
        strongestOfTheHouse: 30,
        houseSize: A_ROLL_A_PLAYER_COULD_KNOW * 10,
        groundUnderDuress: false
    };

    it('does not know an unfamiliar face in the robes of a large house', () => {
        expect(theyKnowTheFace(ordinary).known).toBe(false);
    });

    it('knows somebody they have dealt with', () => {
        expect(theyKnowTheFace({ ...ordinary, knowsThem: true }).known).toBe(true);
    });

    it('knows every face in a house small enough to know them all', () => {
        expect(theyKnowTheFace({ ...ordinary, houseSize: A_ROLL_A_PLAYER_COULD_KNOW }).known).toBe(true);
    });

    it('places nobody out of the robes, and nobody whose face does not register', () => {
        expect(theyKnowTheFace({ ...ordinary, knowsThem: true, inTheRobes: false }).known).toBe(false);
        expect(theyKnowTheFace({ ...ordinary, knowsThem: true, registers: false }).known).toBe(false);
    });

    it('and reads the same axes a lecture hall reads a stranger on', () => {
        // The two ends of one reading: what lets one of the house be known is
        // what makes a stranger stand out.
        for (const face of [
            { ...ordinary, knowsThem: true },
            { ...ordinary, houseSize: A_ROLL_A_PLAYER_COULD_KNOW }
        ]) {
            expect(theyKnowTheFace(face).known).toBe(true);
            expect(whetherAFaceIsRemarkable(face).remarkable).toBe(true);
        }
        expect(whetherAFaceIsRemarkable(ordinary).remarkable).toBe(false);
    });
});

describe('the token a gate reads answers for the person it was cut for', () => {
    const { token } = issueTo({
        memberId: 'issued-to', memberName: 'Issued To', houseId: 'house-a', houseName: 'Stone Gate Sect',
        plateRoomId: 'hall', onDay: 0
    });

    it('in their own hands, while they live', () => {
        expect(theHouseTheirTokenNames([token], 'issued-to', () => true)).toBe('house-a');
    });

    it('in somebody else\'s hands, while the person it was cut for lives', () => {
        const taken = { ...token, possessorId: 'somebody-else' };
        expect(theHouseTheirTokenNames([taken], 'somebody-else', id => id === 'issued-to')).toBe('house-a');
    });

    it('and as nothing off a corpse, whoever is carrying it', () => {
        const looted = { ...token, possessorId: 'somebody-else' };
        expect(theHouseTheirTokenNames([looted], 'somebody-else', id => id !== 'issued-to')).toBeNull();
    });
});
