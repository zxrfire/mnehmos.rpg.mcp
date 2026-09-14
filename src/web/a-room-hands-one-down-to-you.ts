/**
 * The room sits on the one being played, and somebody may speak for them.
 *
 * The whole judgement arc was world-only. `complaintsBrought` refuses somebody
 * their own case and `whereAComplaintGoes` sends it over the offender's head, so
 * the offender was always somebody the world holds a row for: a player could
 * watch a house sentence its people and could never be in front of the room.
 * Every verb that opens a row about the player - the library theft, the false
 * decree, the furnace, the leak your own house is told about - wrote an
 * `AGAINST_THEIR_OWN` row and nothing ever read it back at them.
 *
 * ── THE ROOM SITS ON A LATER DAY THAN THE ONE IT WAS TOLD ────────────────
 *
 * A room hears a complaint and then sits; it does not sit at the moment somebody
 * walks in with one. That is the one scheduling rule here and it is doing real
 * work: the day gate is what makes being caught and being sentenced two
 * different events, and it is the window an intercession exists in.
 *
 * ── WHO DECIDES IS THE READ THAT ALREADY EXISTS ──────────────────────────
 *
 * `whereAComplaintGoes`, unchanged: the holder of the room complaints go to, or
 * the head above them, and nobody where the only seat is the offender's own. A
 * house with nobody to decide hands nothing down and the report says so - that
 * is what being the most senior person in a small house buys, and it is the same
 * answer the world half gets.
 *
 * ── AND SOMEBODY WHO OWES YOU SPEAKS ─────────────────────────────────────
 *
 * The other half of the standing ruling: a word from somebody with standing can
 * move a sentence. Who speaks is not drawn and not chosen - it is read off the
 * ledger, which already holds every account anybody has with the player. The
 * first person on the house's roll who owes the accused an open row speaks, and
 * what they put up is that account: `a favour`, in the offer ladder's own
 * vocabulary, because an open account with somebody's name on it is what a
 * favour IS.
 *
 * So a player who has spent a run doing nothing for anybody stands in front of
 * the room on their own, and one who has is spoken for - by somebody they can
 * name, spending a thing they can see on the ledger. Nothing is added to pay
 * for it.
 *
 * ── WHERE THEY STAND IS THE PLAY LAYER'S AND IS PASSED ───────────────────
 *
 * The played row holds `locationId: null` for as long as it is played, so
 * `offenderAt` carries the place and `heldAt` comes back naming the room a seal
 * put them in. Putting them there is this caller's, which is why nothing under
 * `handDownWhatTheRoomDecided` writes a place onto a row it was told about.
 */

import type { Cultivator } from '../schema/cultivation.js';
import type { SectAlignment } from '../schema/cultivation.js';
import {
    severityRank,
    type ObligationRecord
} from '../engine/social/grudges.js';
import { ledgerAbout } from '../storage/repos/obligation.repo.js';
import { isYourOwnHouseHoldingIt } from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import {
    THE_ROOM_COMPLAINTS_GO_TO,
    whatStandsBetween,
    whereAComplaintGoes
} from '../engine/social-leverage/reporting-what-you-saw.js';
import {
    whoseCallItIs,
    type APortfolio
} from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
import type { APost } from '../engine/social-leverage/who-works-in-an-elders-hall.js';
import {
    anIntercessionFor,
    whyTheWordIsNotTheirsToSay
} from '../engine/social-leverage/somebody-speaks-for-the-accused.js';
import { whereTheOfferLanded } from '../engine/social-leverage/what-they-will-take-instead-of-money.js';
import { whatThisHouseHandedOver } from '../engine/world/a-house-takes-back-what-it-handed-over.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import {
    handDownWhatTheRoomDecided,
    type WhatWasHandedDown
} from './a-room-hands-down-what-it-decided.js';

/** Somebody on the house's roll, as much of them as this needs. */
export interface OnTheRollHere {
    id: string;
    name: string;
    rankIndex: number;
    realmOrdinal: number;
}

/** Who spoke, and what they spent doing it. */
export interface SomebodySpoke {
    id: string;
    name: string;
    /** Open rows they owe the accused. The account being spent. */
    owes: number;
}

export interface WhatTheRoomDidToYou {
    complaint: ObligationRecord;
    /** Who sat on it. Null where the house had nobody to decide it. */
    decidedBy: { id: string; name: string } | null;
    spokeForYou: SomebodySpoke | null;
    /** Null where nobody could decide it, in which case nothing was handed down. */
    handed: WhatWasHandedDown | null;
    /** Where the house is holding them now, where a seal put them somewhere. */
    heldAt: { id: string; name: string } | null;
    /** Plain statements of fact for the player. Present tense, second person. */
    lines: string[];
    /** The mechanical channel. Never narration. */
    structure: string;
}

/**
 * The one row the room sits on today.
 *
 * Heaviest first, then the oldest of those, then the id, so the same pile is
 * read the same way twice. Only rows the house was told about on an earlier day:
 * see the banner.
 */
export function theComplaintTheRoomSitsOn(
    repos: CultivationRepos,
    houseId: string,
    aboutId: string,
    onDay: number
): ObligationRecord | null {
    const open = ledgerAbout(repos.db as never, houseId).filter(row =>
        row.status === 'open'
        && row.holderId === houseId
        && row.subjectId === aboutId
        && isYourOwnHouseHoldingIt(row)
        && row.incurredOnDay < onDay);

    return open.sort((a, b) =>
        severityRank(b.severity) - severityRank(a.severity)
        || a.incurredOnDay - b.incurredOnDay
        || (a.id < b.id ? -1 : 1))[0] ?? null;
}

/**
 * Who on this roll owes the accused enough to spend it on them.
 *
 * The ledger decides, not a disposition and not a draw. Ordered by what they owe
 * and then by how senior they are, because a word is worth what the person
 * saying it is worth - and settled by id last so two people who owe the same
 * amount at the same rung do not swap places between reads.
 */
export function whoWouldSpeakForYou(input: {
    repos: CultivationRepos;
    accusedId: string;
    roll: readonly OnTheRollHere[];
    room: ReturnType<typeof whoseCallItIs> | null;
}): SomebodySpoke | null {
    const ledger = ledgerAbout(input.repos.db as never, input.accusedId);
    const could = input.roll
        .filter(person => whyTheWordIsNotTheirsToSay({
            speakerId: person.id,
            accusedId: input.accusedId,
            room: input.room
        }) === null)
        .map(person => ({
            person,
            owes: whatStandsBetween(ledger, person.id, input.accusedId).theyOweYou
        }))
        .filter(entry => entry.owes > 0);

    const best = could.sort((a, b) =>
        b.owes - a.owes
        || b.person.rankIndex - a.person.rankIndex
        || (a.person.id < b.person.id ? -1 : 1))[0];
    return best === undefined
        ? null
        : { id: best.person.id, name: best.person.name, owes: best.owes };
}

export interface TheRoomSittingOnYou {
    repos: CultivationRepos;
    /** The one being played, who is the offender. */
    offender: Cultivator;
    houseId: string;
    houseName: string;
    alignment: SectAlignment | null;
    portfolios: readonly APortfolio[];
    posts: readonly APost[];
    roll: readonly OnTheRollHere[];
    rankCount: number;
    headId: string | null;
    world: WorldState | null;
    onDay: number;
    onTurn: number;
    /** Where the player is standing. The play layer holds this and nothing else does. */
    at: { id: string | null; name: string | null };
}

/**
 * Weigh what the house is holding about the player, and carry it out on them.
 *
 * Null where there is nothing outstanding, which is the ordinary answer and the
 * one every turn gets. Everything else routes to the same
 * `handDownWhatTheRoomDecided` the world half uses, so a sentence on the player
 * and a sentence on anybody else are the same seven rungs carried out by the
 * same instruments.
 */
export function theRoomSitsOnYou(input: TheRoomSittingOnYou): WhatTheRoomDidToYou | null {
    const complaint = theComplaintTheRoomSitsOn(
        input.repos, input.houseId, input.offender.id, input.onDay
    );
    if (complaint === null) return null;

    const decidedById = whereAComplaintGoes({
        portfolios: input.portfolios,
        aboutId: input.offender.id,
        headId: input.headId
    });
    const nameOf = (id: string): string =>
        input.roll.find(person => person.id === id)?.name ?? 'somebody senior';

    if (decidedById === null) {
        return {
            complaint,
            decidedBy: null,
            spokeForYou: null,
            handed: null,
            heldAt: null,
            lines: [
                `${input.houseName} is holding something against you and there is nobody in it `
                + 'who can decide it. The room that hears this is yours or there is no room, and '
                + 'a complaint nobody can sit on stays open.'
            ],
            structure:
                `a-room-hands-one-down-to-you: ${complaint.id} open against ${input.offender.id} `
                + `at ${input.houseId}; whereAComplaintGoes returned nobody. Nothing handed down.`
        };
    }

    const room = whoseCallItIs({
        purpose: THE_ROOM_COMPLAINTS_GO_TO,
        portfolios: input.portfolios,
        roll: input.roll.map(person => ({ id: person.id, rankIndex: person.rankIndex })),
        rankCount: input.rankCount,
        asking: input.offender.id
    });
    const spokeForYou = whoWouldSpeakForYou({
        repos: input.repos,
        accusedId: input.offender.id,
        roll: input.roll,
        room
    });
    // WHAT THEY PUT UP IS THE ACCOUNT THEY OWE. A favour, in the ladder's own
    // word for it, and the same reading `asking-something-that-can-refuse-for-a-
    // piece-of-it.ts` gives an open account.
    const intercession = spokeForYou === null ? null : anIntercessionFor(room, 'a favour');

    const handed = handDownWhatTheRoomDecided({
        repos: input.repos,
        complaint,
        byId: decidedById,
        byName: nameOf(decidedById),
        portfolios: input.portfolios,
        posts: input.posts,
        offenderId: input.offender.id,
        offenderName: input.offender.name,
        offenderOrdinal: input.offender.realmOrdinal,
        houseId: input.houseId,
        houseName: input.houseName,
        onDay: input.onDay,
        onTurn: input.onTurn,
        world: input.world,
        byOrdinal: input.roll.find(person => person.id === decidedById)?.realmOrdinal
            ?? input.offender.realmOrdinal,
        offenderAt: input.at,
        brought: {
            // It is in front of the room, so it was brought. The question
            // `whatTheWitnessDoesAboutIt` answers was answered when the row
            // was written.
            what: { does: 'reports', toId: decidedById, line: complaint.description },
            theirsToPunish: true,
            alignment: input.alignment,
            houseId: input.houseId,
            theHouseGaveThemSomething: input.world !== null
                && whatThisHouseHandedOver({
                    objects: input.world.objects,
                    houseId: input.houseId,
                    houseName: input.houseName,
                    fromId: input.offender.id,
                    houseIds: new Set(input.world.factions.map(house => house.id))
                }).length > 0,
            intercession
        }
    });

    // ── AND THE HALL IS A PLACE, SO THEY ARE PUT IN IT ───────────────────
    //
    // The design owner on being sealed: they *"get sealed -> put to a place"*.
    // The seal is on the sheet already; this is the other half, and it is
    // written here because where the played cultivator stands is the play
    // layer's one copy of that fact.
    const heldAt = handed.sealed ? handed.heldAt : null;
    if (heldAt !== null) {
        input.repos.cultivators.update(input.offender.id, { location: heldAt.name });
    }

    const lines = [
        `${nameOf(decidedById)} of ${input.houseName} sits on what the house is holding against `
        + `you. ${handed.decided.line}`
    ];
    if (spokeForYou !== null) {
        const landed = whereTheOfferLanded(
            intercession!.wants, intercession!.offered
        );
        lines.push(
            `${spokeForYou.name} speaks for you and spends what you are owed doing it. `
            + landed.line
        );
    }
    lines.push(handed.line);
    if (heldAt !== null) lines.push(`You are held in ${heldAt.name}.`);

    return {
        complaint,
        decidedBy: { id: decidedById, name: nameOf(decidedById) },
        spokeForYou,
        handed,
        heldAt,
        lines,
        structure:
            `a-room-hands-one-down-to-you: ${complaint.id} -> ${handed.decided.sentence}, `
            + `decided by ${decidedById}. Before anybody spoke: `
            + `${handed.decided.beforeAnybodySpoke}; word: ${handed.decided.word}`
            + (spokeForYou === null
                ? ' (nobody on the roll owes you an open row).'
                : ` (${spokeForYou.id}, ${spokeForYou.owes} open row(s) owed, offered a favour, `
                  + `wanted ${intercession!.wants}).`)
            + (handed.notCarriedOutHere === null
                ? ` Carried out here. Read out: ${handed.readOut}.`
                : ` Routed to ${handed.notCarriedOutHere}.`)
    };
}
