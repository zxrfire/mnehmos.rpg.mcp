/**
 * An elder who hated you counted as standing behind you.
 *
 * `howItLandedOn` decides, among other things, who is BACKING the person
 * speaking. It built that set by membership alone:
 *
 *     present, not the person addressed, and on the same roll as the player
 *
 * So a house-mate holding a grudge about this cultivator was counted as
 * standing behind them - there in the square, on the roll, and perfectly
 * willing to watch.
 *
 * That matters because of what backing does. It is the thing that decides
 * whether a threat from somebody far weaker LANDS or reads as absurd:
 * `cannotReachThem` needs the speaker to be several realms down AND unbacked,
 * and being backed cancels it. So the game was lending the player the weight of
 * people who would not move.
 *
 * ── WHAT A PERSONAL FALLING-OUT COSTS, RULED DIRECTLY ────────────────────
 *
 * The design owner: *a personal refusal means the elder may not recommend you
 * for things like postings, or lend you a hand when disciples fight.*
 *
 * And then, on what a recommendation actually is: *it means what it means
 * today, and what it means in game. Does he like you?*
 *
 * Which is the whole design. There is no recommendation flag and there should
 * not be one - it is the FEELING, which `whatTheyFeelAboutYou` already derives
 * off the obligation ledger, and which therefore moves whenever the ledger
 * moves.
 *
 * ── ONE NOTION OF WHAT PEOPLE HAVE AGAINST EACH OTHER ────────────────────
 *
 * `ALREADY_STANDS_BETWEEN_THEM` was written for a different question - how a
 * sentence lands - and it carries over because of what it SAYS rather than what
 * it was for: these are the feelings that mean something stands between two
 * people, and somebody with something standing between you does not step in
 * front of a blade for you. Reusing it keeps one statement of what people hold
 * against each other instead of opening a second that would drift.
 *
 * ── AND FEELING NOTHING IS STILL BACKING ─────────────────────────────────
 *
 * `nothing_either_way` is deliberately not in that set. A house-mate with no
 * particular opinion about somebody still answers for the house, and that is
 * both the common case and the institutional one. What breaks house solidarity
 * is a grievance, not an absence of warmth - a rule that required people to LIKE
 * you before they backed you would empty every square in the game.
 */

import { describe, it, expect } from 'vitest';

import {
    ALREADY_STANDS_BETWEEN_THEM,
    howTheyTookIt
} from '../../../src/engine/social/how-they-took-what-you-said';
import {
    whatTheyFeelAboutYou
} from '../../../src/engine/social-leverage/what-they-feel-about-you';
import type { ObligationRecord } from '../../../src/engine/social/grudges';

const THEM = 'elder';
const ME = 'me';

function aRecord(over: Partial<ObligationRecord> = {}): ObligationRecord {
    return {
        id: 'ob-1',
        kind: 'grudge',
        holderId: THEM,
        subjectId: ME,
        cause: 'humiliation',
        severity: 'serious',
        incurredOnDay: 100,
        triggeringEventId: null,
        description: 'It happened in front of people.',
        participants: [THEM, ME],
        tags: [],
        terms: null,
        dueOnDay: null,
        status: 'open',
        settlement: null,
        inheritance: [],
        generation: 0,
        originHolderId: THEM,
        fromBelief: false,
        recordedOnDay: 100,
        ...over
    } as ObligationRecord;
}

const feels = (ledger: readonly ObligationRecord[]) =>
    whatTheyFeelAboutYou({ theirId: THEM, aboutId: ME, ledger }).feeling;

describe('what the set says about standing behind somebody', () => {
    /**
     * THE DEFECT, at the level the fix turns on. A house-mate holding a grudge
     * has a feeling that is in the set, so the backing filter drops them.
     */
    it('puts somebody carrying a grudge on the wrong side of it', () => {
        expect(ALREADY_STANDS_BETWEEN_THEM.has(feels([aRecord()]))).toBe(true);
    });

    /**
     * AND SOMEBODY WITH NOTHING BETWEEN THEM STAYS ON THE RIGHT SIDE. This is
     * the institutional case and it is the common one; a rule that dropped it
     * would empty every square.
     */
    it('leaves a house-mate with no opinion standing where they were', () => {
        expect(feels([])).toBe('nothing_either_way');
        expect(ALREADY_STANDS_BETWEEN_THEM.has(feels([]))).toBe(false);
    });

    /**
     * AND SOMEBODY WHO IS GLAD OF YOU CERTAINLY DOES. A favour they hold about
     * you is warmth, and warmth is not something standing between you.
     */
    it('leaves somebody who owes you nothing but goodwill standing there', () => {
        const warm = feels([aRecord({ kind: 'favor', cause: 'gifted_resource', severity: 'slight' })]);
        expect(ALREADY_STANDS_BETWEEN_THEM.has(warm)).toBe(false);
    });

    /**
     * THE SET IS NOT EVERYTHING AND NOT NOTHING, so neither assertion above
     * passes by the set being degenerate.
     */
    it('divides the feelings rather than swallowing them', () => {
        expect(ALREADY_STANDS_BETWEEN_THEM.size).toBeGreaterThan(0);
        expect(ALREADY_STANDS_BETWEEN_THEM.has('nothing_either_way')).toBe(false);
        expect(ALREADY_STANDS_BETWEEN_THEM.has('warm')).toBe(false);
    });
});

/**
 * AND WHAT BACKING IS FOR, which is why any of this is worth doing.
 *
 * Backing cancels `cannotReachThem`: without it, somebody several realms down
 * saying something about you is watching-a-man-shout rather than a threat. So
 * counting a hostile house-mate as backing does not merely misreport the room -
 * it changes what the words were.
 */
describe('backing is what makes a weaker person worth hearing', () => {
    const said = (speakerIsBacked: boolean) => howTheyTookIt({
        wrongInTheAct: 'threatened',
        aboutThem: true,
        feeling: 'nothing_either_way',
        realmsOverTheSpeaker: 4,
        speakerIsBacked,
        landed: false,
        theyHaveSomethingToAnswerFor: false
    });

    it('is nothing from far below with nobody behind them', () => {
        expect(said(false).took).toBeNull();
    });

    it('is something once somebody is', () => {
        expect(said(true).took).not.toBeNull();
    });
});
