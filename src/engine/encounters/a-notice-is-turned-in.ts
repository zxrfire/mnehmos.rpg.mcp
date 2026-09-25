/**
 * A house's notice is turned in, never taken: the first to bring what it asks is paid, and the
 * paper comes down.
 *
 * The owner, asked whether a work notice was taken at the gate or at the wall: "that's not how it
 * works. first person to turn it in gets it, and they retract the notice. if you're second, tough
 * luck". And of what one asks: "a notice is per herb and for a speciifc count, if they want a
 * second herb its a new notice. each notice is of a diff grade with a diff reward (fixed, but
 * fixed per tier)".
 *
 * So a notice names one thing and how many, pays what its tier pays, and has a day it came down,
 * which the world can reach before the player does.
 *
 * PURE. The seed, the day and the ids in; what is brought, what is paid and whether it is down out.
 */

import { BEAST_MATERIALS } from '../../data/cultivation/beasts.js';
import { HERBS } from '../../data/cultivation/herbs.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import { forStream } from '../cultivation/rng.js';

/** How many a notice of each tier asks for, and the purse it pays for them. Fixed per tier. */
export const A_NOTICE_OF_EACH_TIER: Readonly<Record<TechniqueGrade, { count: number; purse: number }>> = {
    mortal: { count: 10, purse: 100 },
    earth: { count: 5, purse: 1_200 },
    heaven: { count: 3, purse: 9_000 },
    immortal: { count: 2, purse: 60_000 },
    chaos: { count: 1, purse: 300_000 }
};

const TIERS: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

/** One thing a house wants brought: which, how many, and what the first to bring them is paid. */
export interface WhatIsBrought {
    id: string;
    name: string;
    grade: TechniqueGrade;
    count: number;
    purse: number;
}

/** How many tiers of its work a house puts up at once: the top of what it can use, and the next. */
const TIERS_ASKED_AT_ONCE = 2;

/**
 * What a house wants brought this window: one notice for each of the top tiers it can use, each
 * naming one herb or beast part. What a house can use is what its strongest can harvest; a house
 * of pills wants herbs, a house of forges and fists wants beast parts, and the rest want either.
 */
export function whatAHouseWantsBrought(
    house: { id: string; powerOrdinal: number; specialities: readonly string[] },
    window: number
): WhatIsBrought[] {
    const craft = new Set(house.specialities.map(word => word.toLowerCase()));
    const herbs = ['alchemy', 'support', 'cultivation'].some(word => craft.has(word));
    const beasts = ['forging', 'attack', 'defense'].some(word => craft.has(word));
    const pool = [
        ...(herbs || !beasts ? HERBS.map(row => ({ id: row.id, name: row.name, grade: row.grade, harvest: row.harvestOrdinal })) : []),
        ...(beasts || !herbs ? BEAST_MATERIALS.map(row => ({ id: row.id, name: row.name, grade: row.grade, harvest: row.harvestOrdinal })) : [])
    ].filter(row => row.harvest <= house.powerOrdinal);
    const usable = TIERS.filter(tier => pool.some(row => row.grade === tier)).slice(-TIERS_ASKED_AT_ONCE);
    return usable.map(tier => {
        const choices = pool.filter(row => row.grade === tier).sort((a, b) => (a.id < b.id ? -1 : 1));
        const picked = choices[forStream(house.id, 'what-a-house-wants-brought', tier, window).int(0, choices.length - 1)]!;
        return { id: picked.id, name: picked.name, grade: tier, ...A_NOTICE_OF_EACH_TIER[tier] };
    });
}

/** A notice, told apart from the same ask put up again in a later window. */
export function aNoticeId(houseId: string, itemId: string, window: number): string {
    return `${houseId}:${itemId}:${window}`;
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
 * Which of a house's asks are down today, for a wall to leave off: a notice of something brought,
 * by its item and its window, and nothing else.
 */
export function theNoticesThatAreDown(input: {
    runSeed: string;
    today: number;
    windowDays: number;
    turnedIn: ReadonlySet<string>;
}): (houseId: string, ask: { kind: string; item?: { id: string } }) => boolean {
    const window = Math.floor(Math.max(0, input.today) / input.windowDays);
    return (houseId, ask) => ask.kind === 'work' && ask.item !== undefined && hasItComeDown({
        runSeed: input.runSeed,
        noticeId: aNoticeId(houseId, ask.item.id, window),
        today: input.today,
        windowStartDay: window * input.windowDays,
        windowDays: input.windowDays,
        turnedIn: input.turnedIn
    }).down;
}
