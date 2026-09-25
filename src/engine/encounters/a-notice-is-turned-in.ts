/**
 * A house's notice is turned in, never taken: the first to bring what it asks is paid, and the
 * paper comes down.
 *
 * The owner, asked whether a work notice was taken at the gate or at the wall: "that's not how it
 * works. first person to turn it in gets it, and they retract the notice. if you're second, tough
 * luck". So a notice has no signing on. It has what is brought, the purse the paper states, and
 * the day it came down, which the world can reach before the player does.
 *
 * PURE. The seed, the day and the ids in; what is brought, what is paid and whether it is down out.
 */

import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import type { SendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { forStream } from '../cultivation/rng.js';
import { clampOrdinal, MAX_ORDINAL } from '../cultivation/realms.js';
import { dutyTermsFor } from './duties.js';

/** What a house's sending asks a stranger to bring in, where it asks anything at all. */
const WHAT_IS_BROUGHT_IN: Readonly<Record<string, 'materials'>> = {
    'sending-for-materials': 'materials'
};

/** What turning a notice in takes, and what it pays: null where there is nothing to bring. */
export function whatANoticeWantsBrought(reason: SendingReason): { lots: number; purse: number } | null {
    if (WHAT_IS_BROUGHT_IN[reason.id] !== 'materials') return null;
    // The purse is what the house would have paid hands of its own for the trip, pitched where the
    // work is pitched, so the paper can state it before anybody reads it.
    const pitch = clampOrdinal(reason.floorOrdinal ?? 0);
    const priced: EncounterEntry = {
        id: reason.id,
        name: reason.name,
        kind: 'opportunity',
        simEventKind: 'opportunity',
        weight: 1,
        minOrdinal: 0,
        maxOrdinal: MAX_ORDINAL,
        interrupts: false,
        threatOrdinal: pitch,
        summaryTemplate: reason.what,
        tokens: [],
        tags: ['notice']
    } as EncounterEntry;
    return { lots: reason.hands, purse: Math.max(1, dutyTermsFor(priced, pitch, null, 'commission').stones) };
}

/** A notice, told apart from the same ask put up again in a later window. */
export function aNoticeId(houseId: string, reasonId: string, window: number): string {
    return `${houseId}:${reasonId}:${window}`;
}

/** How often somebody else brings a notice in before its paper comes down anyway. */
const SOMEBODY_ELSE_GETS_THERE_FIRST = 0.6;

/**
 * The day somebody else turns this notice in, or null where nobody does this window. Drawn on the
 * notice's own stream, so replaying a turn does not change who got there first.
 */
export function theDaySomebodyElseTurnsItIn(
    runSeed: string,
    noticeId: string,
    windowStartDay: number,
    windowDays: number
): number | null {
    const draw = forStream(runSeed, 'a-notice-turned-in', noticeId);
    if (draw.next() >= SOMEBODY_ELSE_GETS_THERE_FIRST) return null;
    return windowStartDay + draw.int(0, Math.max(0, windowDays - 1));
}

/** Whether a notice has come down: turned in by the player, or by somebody else by today. */
export function hasItComeDown(input: {
    runSeed: string;
    noticeId: string;
    today: number;
    windowStartDay: number;
    windowDays: number;
    turnedIn: ReadonlySet<string>;
}): { down: boolean; byWhom: 'the player' | 'somebody else' | null; onDay: number | null } {
    if (input.turnedIn.has(input.noticeId)) return { down: true, byWhom: 'the player', onDay: null };
    const day = theDaySomebodyElseTurnsItIn(input.runSeed, input.noticeId, input.windowStartDay, input.windowDays);
    return day !== null && day <= input.today
        ? { down: true, byWhom: 'somebody else', onDay: day }
        : { down: false, byWhom: null, onDay: null };
}

/**
 * Which of a house's asks are down today, for a wall to leave off: a work ask by its sending and
 * its window, and nothing else, since only a work notice is turned in here.
 */
export function theNoticesThatAreDown(input: {
    runSeed: string;
    today: number;
    windowDays: number;
    turnedIn: ReadonlySet<string>;
}): (houseId: string, ask: { kind: string; reasonId?: string }) => boolean {
    const window = Math.floor(Math.max(0, input.today) / input.windowDays);
    return (houseId, ask) => ask.kind === 'work' && ask.reasonId !== undefined && hasItComeDown({
        runSeed: input.runSeed,
        noticeId: aNoticeId(houseId, ask.reasonId, window),
        today: input.today,
        windowStartDay: window * input.windowDays,
        windowDays: input.windowDays,
        turnedIn: input.turnedIn
    }).down;
}
