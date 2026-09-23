/**
 * Who in this house could strike somebody off its roll, for the refusal that
 * comes back when the player cannot.
 *
 * ── WHY THE REFUSAL NEEDS A NAME IN IT ───────────────────────────────────
 *
 * `noAuthority` answers with the RANK the power opens at - *"Outer Disciple
 * does not do that in the Azure Dew Sect. It opens at Pavilion Master"* - which
 * is true and leaves the player with nothing to do next. AGENTS.md's rule for
 * a refusal is that it carries the number: somebody told where the bar is has
 * learned where they stand, and somebody told WHO stands above it can go and
 * ask them. The names are read off the same roster every other house read uses,
 * so nothing here is a second account of who is in the house.
 *
 * ── AND WHAT THE POWER ACTUALLY REACHES ──────────────────────────────────
 *
 * An elder. `handleExpel` prices elders and dismisses one, and there is no rung
 * anywhere that puts an ordinary member off a roll by somebody's word: the
 * room's ladder of sentences (`what-a-room-decides-about-one-of-its-own.ts`)
 * runs rebuke, fine, what the house gave taken back, sealed, crippled, dead,
 * and none of those is a name struck off. What does take an ordinary member off
 * it is their own standing - `resolveAct` dismisses somebody the house will not
 * keep - and walking out. So the answer says both, rather than pretending there
 * is a door to push on.
 */

import type { ContactPerson } from '../engine/encounters/contact.js';
import { rosterFor } from './encounters.js';
import type { HousePosition } from './standing.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

/** How many of them to name. Enough to go and ask, short of reading out a roll. */
const NAME_THIS_MANY = 3;

export interface WhoCouldDoIt {
    /** Plain statements of fact, in the order they should be read. */
    lines: string[];
    /** The mechanical channel. */
    structure: string;
}

/**
 * The rung a dismissal opens at in this house, and who is standing on it.
 *
 * The rung is `noAuthority`'s own figure for `expel_elder` - the top of the
 * ladder - read here off the same rank count rather than restated as a number.
 */
export function whoCouldPutSomebodyOffTheRoll(
    game: Pick<GameService, 'repos' | 'knowledge' | 'atHand'>,
    cultivator: Cultivator,
    held: HousePosition
): WhoCouldDoIt {
    const opensAt = Math.max(0, held.rankCount - 1);
    const opensAtTitle = held.ranks[opensAt] ?? 'a rank this house does not have';
    const roster: ContactPerson[] = rosterFor(
        { repos: game.repos, knowledge: game.knowledge, world: game.atHand ?? null }, cultivator
    );
    const theirs = roster
        .filter(person => person.id !== cultivator.id && person.rankIndex >= opensAt)
        .sort((a, b) => b.rankIndex - a.rankIndex || b.realmOrdinal - a.realmOrdinal
            || (a.id < b.id ? -1 : 1));
    const named = theirs.slice(0, NAME_THIS_MANY).map(person => person.name);

    const lines = [
        `Dismissing somebody from ${held.sectName} is ${opensAtTitle}'s to do, and you are `
        + `${held.rankTitle}.`,
        named.length > 0
            ? `${named.join(', ')} stand${named.length === 1 ? 's' : ''} that high here, and it `
              + 'would be theirs to say.'
            : `Nobody you know of in ${held.sectName} stands that high, so there is nobody to ask `
              + 'for it either.',
        'And the power reaches an elder. Nobody puts an ordinary member off a roll by saying so: '
        + 'they walk out, or they fall so far in the house\'s regard that it stops keeping them.'
    ];
    return {
        lines,
        structure:
            `expel: ${cultivator.id} at rank ${held.rankIndex} of ${held.rankCount} in `
            + `${held.sectId}; the power opens at ${opensAt} (${opensAtTitle}). `
            + `${theirs.length} on the roster at or above it${named.length > 0 ? `: ${named.join(', ')}` : ''}. `
            + 'Nothing was dismissed and nothing was written.'
    };
}
