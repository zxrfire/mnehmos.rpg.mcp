/** Hypothetical posts for remit fixtures; production uses actual Internal Affairs appointments. */
import type { APortfolio } from '../../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';
import { inTheOrderOfficesAreDealt } from '../../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';
import type { OnTheRoll } from '../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import { whoDecidesIn } from '../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import type { APost } from '../../src/engine/social-leverage/who-works-in-an-elders-hall.js';

/**
 * Who works in each of this house's rooms.
 *
 * Rooms in the order offices are dealt, disciples heaviest-first, round robin - the same deal
 * `whoIsInChargeOfWhat` makes, so the archive's disciple is a more senior
 * disciple than the mission hall's for the same reason the archive's elder is a
 * more senior elder. One rule, read twice.
 *
 * Empty where the house has no disciples, which is the honest answer for a body
 * that admits nobody: its rooms are run by the people who decide in it and
 * there is nobody else in them.
 */
export function whoStaffsWhat(input: {
    portfolios: readonly APortfolio[];
    roll: readonly OnTheRoll[];
    rankCount: number;
}): APost[] {
    const deciders = new Set(
        whoDecidesIn({ roll: input.roll, rankCount: input.rankCount }).map(p => p.id)
    );
    // Everybody on the roll who is not one of the people who decide, heaviest
    // first. `rankIndex < 0` is somebody unaffiliated standing in the list.
    const hands = input.roll
        .filter(person => person.rankIndex >= 0 && !deciders.has(person.id))
        .sort((a, b) => b.rankIndex - a.rankIndex || a.id.localeCompare(b.id));
    if (hands.length === 0) return [];

    const rooms = [...input.portfolios]
        .sort((a, b) => inTheOrderOfficesAreDealt(a.purpose, b.purpose));

    return rooms.map((room, i) => ({
        purpose: room.purpose,
        personId: hands[i % hands.length]!.id,
        selectedById: room.holderId
    }));
}
