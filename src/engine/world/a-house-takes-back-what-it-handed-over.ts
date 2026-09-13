/**
 * A house takes back what it handed over.
 *
 * `a-house-bestows-a-thing-on-somebody-who-earned-it.ts` is the forward read and
 * there was no backward one anywhere in the repo, so
 * `what the house gave is taken back` was a sentence a room could hand down and
 * nothing could carry out.
 *
 * ── WHAT IS REACHABLE, AND WHAT IS NOT ───────────────────────────────────
 *
 * Only what this house put into these hands. A thing somebody bought,
 * inherited, won or took is not reachable by this sentence at any severity, and
 * that is where the fiction would break - a house that can take anything off you
 * because it is annoyed with you is not a house, it is weather.
 *
 * ── THE GIFT-AND-LOAN LINE DECIDES WHICH ACT IT IS ───────────────────────
 *
 * `couldBeCalledBackIn` already draws it and this file does not redraw it:
 *
 *   A LOAN      the house never stopped owning it. Possession comes back and
 *               the register does not move. Routine, and a house may do it at
 *               the moment it costs most.
 *   A BESTOWAL  the house spent it. Ownership has to move back, and
 *               `a-house-holds-its-own.ts` says what that is: *"taking it back
 *               is a seizure, which is a thing houses do and is not a thing
 *               they can do quietly."*
 *
 * So {@link whatThisHouseHandedOver} puts every loan ahead of every bestowal. A
 * room reaching for the seizure while a loan is sitting in the same hands has
 * done more than it decided.
 *
 * ── WHY THE BESTOWAL IS MATCHED ON A NAME AS WELL AS AN ID ───────────────
 *
 * A thing in a treasury is held by nobody - `whatEachHouseHasGivenAway` selects
 * on `possessorId === null` - so the award link's `previousHolderId`, which
 * `transferPossession` computes from the possessor it moved from, is null and
 * not the house. The house is on that link as its `source`, by name, and that is
 * the only place it is. Matching the id alone would make every bestowal in a
 * fresh world unreachable, which is exactly the failure the lending pass had
 * when 199 of 199 carried objects read `unaccounted_for`.
 */

import {
    transferPossession,
    type ObjectRecord
} from './possessions.js';
import { couldBeCalledBackIn, whoseThisIs, type WhoseThisIs } from './a-house-holds-its-own.js';

/** Which of the two acts taking this thing back would be. */
export type TheFooting =
    /** A loan ends. Possession returns and the register never moved. */
    | 'called in'
    /** The house spent it and is taking it back anyway. Ownership moves. */
    | 'seized';

export interface SomethingHandedOver {
    object: ObjectRecord;
    /** From `whoseThisIs`, unchanged. Kept so a caller can say why. */
    whose: WhoseThisIs;
    footing: TheFooting;
}

export interface WhatCouldBeTakenBack {
    objects: readonly ObjectRecord[];
    houseId: string;
    /** The house's own name, for the award links that carry no id. See the banner. */
    houseName: string;
    /** Whose hands to look in. */
    fromId: string;
    /** Which ids name houses rather than people, for `whoseThisIs`. */
    houseIds: ReadonlySet<string>;
}

/**
 * Everything in these hands that this house handed over, lightest act first.
 *
 * Pure. It decides what is reachable and the caller writes, which is the shape
 * the bestowal side already has.
 */
export function whatThisHouseHandedOver(input: WhatCouldBeTakenBack): SomethingHandedOver[] {
    const found: SomethingHandedOver[] = [];

    for (const object of input.objects) {
        if (object.possessorId !== input.fromId) continue;
        const whose = whoseThisIs({
            ownerId: object.ownerId,
            possessorId: object.possessorId,
            houseIds: input.houseIds,
            provenance: object.provenance
        });

        if (couldBeCalledBackIn(whose) && object.ownerId === input.houseId) {
            found.push({ object, whose, footing: 'called in' });
            continue;
        }
        if (whose === 'their_own' && wasBestowedByThisHouse(object, input)) {
            found.push({ object, whose, footing: 'seized' });
        }
    }

    return found.sort((a, b) =>
        (a.footing === b.footing ? 0 : a.footing === 'called in' ? -1 : 1)
        || (b.object.power ?? 0) - (a.object.power ?? 0)
        || (a.object.id < b.object.id ? -1 : 1));
}

/**
 * Whether this house is the one that gave it to them.
 *
 * The most recent link naming this holder and nothing older, for the reason
 * `whoseThisIs` reads backwards: a thing given, sold on, and bought back carries
 * both words on its chain and only the last one is about now.
 */
function wasBestowedByThisHouse(object: ObjectRecord, input: WhatCouldBeTakenBack): boolean {
    for (let at = object.provenance.length - 1; at >= 0; at--) {
        const link = object.provenance[at];
        if (link === undefined || link.holderId !== input.fromId) continue;
        if (link.how !== 'awarded' && link.how !== 'gifted') return false;
        return link.previousHolderId === input.houseId
            || link.source.trim() === input.houseName.trim();
    }
    return false;
}

/**
 * The thing, back in the house's hands.
 *
 * `confiscated` on the chain for both footings, because both are the house
 * taking rather than the holder returning, and a later reader of the chain
 * should not have to work out which it was from the shape of the register. What
 * separates them is whether the register moved, which is the fact itself.
 */
export function takeItBack(handed: SomethingHandedOver, input: {
    houseId: string;
    houseName: string;
    onDay: number;
    /** What the room decided, in the house's own words. Goes on the chain. */
    note: string;
}): ObjectRecord {
    return transferPossession(handed.object, {
        onDay: input.onDay,
        toHolderId: input.houseId,
        toHolderName: input.houseName,
        how: 'confiscated',
        transfersOwnership: handed.footing === 'seized',
        source: input.houseName,
        note: input.note
    });
}

/** What each footing is, said once, for a caller reporting on one. */
export function whatTheFootingMeans(footing: TheFooting): string {
    return footing === 'called in'
        ? 'It was lent and the loan ends. The house owned it the whole time.'
        : 'It was given outright, so the house is taking back something that had stopped '
            + 'being its own. That is a seizure and it is done in front of the room.';
}
