/**
 * The guest roll: `sect_manage({ action: 'guest' })`.
 */

import { z } from 'zod';
import type Database from 'better-sqlite3';

import { rankName } from '../../engine/cultivation/realms.js';
import {
    WHAT_A_GUEST_PLACE_IS_NOT,
    guestPlaceAt,
    housesThatWouldTakeAGuest,
    houseWouldOfferMembership,
    takesGuests,
    shelfTopOf,
    type GuestPlace
} from '../../engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';
import { getSect } from '../../data/cultivation/sects.js';
import { KnowledgeGate } from '../../web/knowledge.js';
import {
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    readJsonFlag,
    resolveActiveRun,
    writeFlag,
    clearFlag
} from './cultivation-support.js';
import { applyProbation, carriedProbationFacts, probationOf } from './sect-probation.js';

// ═══════════════════════════════════════════════════════════════════════════
// THE ROLL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One row on somebody's guest roll.
 */
export interface GuestRollEntry {
    hostFactionId: string;
    /** In-world day the house let them sit down. */
    sinceDay: number;
    /**
     * Whether their own house had said not to.
     */
    againstTheirOwnHouse: boolean;
}

/** Flag key for the guest roll. One host at a time: you can only sit in one hall. */
export const FLAG_GUEST_STUDENT_OF = 'guest_student_of';

/** Where this cultivator is sitting in, or null. */
export function guestPlaceHeldBy(
    db: Database.Database,
    cultivatorId: string
): GuestRollEntry | null {
    return readJsonFlag<GuestRollEntry>(db, cultivatorId, FLAG_GUEST_STUDENT_OF);
}

/**
 * Whether this house would teach this cultivator this art on the guest roll.
 */
export function aGuestIsTaughtThis(
    db: Database.Database,
    cultivatorId: string,
    ordinal: number,
    techniqueId: string
): { hostFactionId: string; hostName: string } | null {
    const roll = guestPlaceHeldBy(db, cultivatorId);
    if (!roll) return null;
    const place = guestPlaceAt(roll.hostFactionId, ordinal, null);
    if (!place) return null;
    if (!place.opens.some(o => o.techniqueId === techniqueId)) return null;
    return { hostFactionId: place.factionId, hostName: place.factionName };
}

/**
 * What a house withholds from a guest, for a refusal that names what membership
 * would change instead of saying no.
 */
export function whyAGuestIsNotShownThis(
    db: Database.Database,
    cultivatorId: string,
    techniqueId: string
): { hostName: string; why: string } | null {
    const roll = guestPlaceHeldBy(db, cultivatorId);
    if (!roll) return null;
    const place = guestPlaceAt(roll.hostFactionId, 0, null);
    if (!place) return null;
    const kept = place.withholds.find(w => w.techniqueId === techniqueId);
    return kept ? { hostName: place.factionName, why: kept.why } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export const GuestSchema = z.object({
    action: z.literal('guest'),
    sectId: z.string().optional()
        .describe('The house being asked. Omit for every house that would take you'),
    accept: z.boolean().optional().default(false)
        .describe('Take the place. Without this the terms are read and nothing is written'),
    depart: z.boolean().optional().default(false)
        .describe('Leave the guest roll. Nothing is owed and nothing is forfeited'),
    cultivatorId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// THE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/** The terms, rendered the same way wherever they are shown. */
function termsOf(place: GuestPlace, ordinal: number): Record<string, unknown> {
    return {
        hostFactionId: place.factionId,
        hostName: place.factionName,
        // How anybody gets onto the HOUSE roll here, which is not what is being
        // offered. On the six dao houses this reads 'adoption' and is the whole
        // reason a guest place is the only thing an outsider can ever have.
        houseRollRoute: place.intakeRoute,
        opens: place.opens.map(o => ({
            techniqueId: o.techniqueId,
            name: o.name,
            requiredRank: rankName(o.requiredOrdinal),
            carriesTo: o.carriesTo === null ? null : rankName(o.carriesTo)
        })),
        openedButOutOfReach: place.openedButOutOfReach.map(o => ({
            name: o.name,
            requiredRank: rankName(o.requiredOrdinal),
            standingAt: rankName(ordinal)
        })),
        keepsBack: place.withholds.map(w => ({
            name: w.name,
            carriesTo: w.carriesTo === null ? null : rankName(w.carriesTo),
            why: w.why
        })),
        watchesForYears: place.termYears,
        notOffered: place.notOffered,
        yourOwnHouse: place.homeFactionId === null
            ? 'You belong to nobody, so nobody has a view.'
            : place.homeStance === 'forbids'
                ? `${getSect(place.homeFactionId)?.name ?? 'Your house'} forbids it. `
                  + 'Going anyway is a thing you did to them, and they will know where you were.'
                : place.homeStance === 'sends'
                    ? `${getSect(place.homeFactionId)?.name ?? 'Your house'} sends you. It knows `
                      + 'itself short of a book and this is an investment, which means you owe them '
                      + 'the term.'
                    : `${getSect(place.homeFactionId)?.name ?? 'Your house'} permits it. You remain `
                      + 'theirs the whole time and go back to them afterwards.',
        homeStance: place.homeStance,
        costsStandingWith: place.costsStandingWith
    };
}

export async function handleGuest(args: z.infer<typeof GuestSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const today = Math.floor(run.elapsedDays);
    const membership = repos.sects.getMembership(cultivator.id);
    const homeId = membership?.sectId ?? null;
    const held = guestPlaceHeldBy(repos.db, cultivator.id);

    // THE FAR END OF A PUBLISHED DOOR
    const probation = args.depart ? null : probationOf(repos, cultivator, run);
    if (probation && probation.outcome !== 'carried') {
        const applied = applyProbation(repos, cultivator, run, probation);
        if (applied) {
            repos.runs.incrementTurn(run.id, 1);
            return applied;
        }
    }

    // ── Walking out, which costs nothing, because nothing was given ──────
    if (args.depart) {
        if (!held) {
            return guidingError(
                'not_a_guest_anywhere',
                `${cultivator.name} is sitting in nowhere. There is nothing to leave.`,
                { hint: 'sect_manage({ action: "guest" }) lists the houses that would take one.' }
            );
        }
        const hostName = getSect(held.hostFactionId)?.name ?? held.hostFactionId;
        clearFlag(repos.db, cultivator.id, FLAG_GUEST_STUDENT_OF);
        return {
            departed: true,
            hostFactionId: held.hostFactionId,
            hostName,
            daysSatIn: Math.max(0, today - held.sinceDay),
            forfeited: 'Nothing. There was no rank to lose, no contribution to leave behind and '
                + 'no oath to break. You were never theirs, which is the whole of why you may go.',
            keeps: 'What you were taught is in your head and stays there. Nobody signed a shelf '
                + 'out to you and nobody has to ask for anything back.',
            narrationHint:
                `${cultivator.name} stops attending at ${hostName}. Nobody stops them and nobody `
                + 'is owed an explanation.'
        };
    }

    // ── The listing ─────────────────────────────────────────────────────
    if (!args.sectId) {
        const gate = new KnowledgeGate(repos.db);
        const all = housesThatWouldTakeAGuest(cultivator.realmOrdinal, homeId);
        const heard = all.filter(p => gate.isAwareOf(cultivator.id, 'sect', p.factionId));
        // SAID AS A SENTENCE, BECAUSE THE FALLBACK IS INVISIBLE
        const named = heard.map(p => p.factionName);
        const narrationHint = heard.length === 0
            ? all.length === 0
                ? 'No house in the world would take a guest at your rung. Everywhere with a '
                  + 'shallow end to open has nothing on it you can open yet.'
                : `${all.length} house${all.length === 1 ? '' : 's'} in the world would let `
                  + 'somebody sit in without taking them on, and you cannot name one of them. '
                  + 'Somebody would have to say a name in front of you first.'
            : `${named.length === 1
                ? `There is one house you have a name for that takes guests: ${named[0]}.`
                : `The houses you have names for that take guests are ${named.slice(0, -1).join(', ')} `
                  + `and ${named[named.length - 1]}.`} `
              + 'A guest place is teaching time and nothing else - no rung, no stipend, and '
              + 'nobody standing between you and anything. '
              + (homeId
                  ? 'You would remain your own house\'s the whole time, and go back to them '
                    + 'afterwards.'
                  : 'You would be on their guest roll and on nobody\'s house roll, which is '
                    + 'exactly where you are now.');
        return {
            narrationHint: probation
                ? `${narrationHint} You are ${Math.round(probation.yearsOnTheRoll)} years into `
                  + `the ${getSect(probation.factionId ?? '')?.name ?? 'house'}'s own intake, `
                  + 'and nothing about you has been decided yet.'
                : narrationHint,
            standingAt: rankName(cultivator.realmOrdinal),
            // The probation said out loud from the inside. A term whose own
            // terms are a secret is a worse arrangement than the one the
            // catalog describes, and this is the read a person in it would
            // actually make.
            probation: probation ? carriedProbationFacts(probation) : null,
            currentlyGuestOf: held
                ? { hostFactionId: held.hostFactionId, sinceDay: held.sinceDay }
                : null,
            wouldTakeAGuest: all.length,
            knownToYou: heard.length,
            houses: heard.map(p => ({
                hostFactionId: p.factionId,
                hostName: p.factionName,
                houseRollRoute: p.intakeRoute,
                opensToYouNow: p.opens.length,
                watchesForYears: p.termYears,
                homeStance: p.homeStance
            })),
            notOffered: WHAT_A_GUEST_PLACE_IS_NOT,
            note: heard.length === 0
                ? 'Knowing that a house takes guests is not the same as knowing the house. '
                  + 'Somebody would have to say a name in front of you first.'
                : 'A guest place is access and nothing else. Ask one of them for terms.',
            hint: 'sect_manage({ action: "guest", sectId }) for what one would actually show you.'
        };
    }

    // ── One house ───────────────────────────────────────────────────────
    const sect = getSect(args.sectId);
    if (!sect) {
        return guidingError('unknown_sect', `No house with id ${args.sectId}.`, {
            hint: 'sect_manage({ action: "guest" }) lists the ones that take guests.'
        });
    }

    const gate = new KnowledgeGate(repos.db);
    if (!gate.isAwareOf(cultivator.id, 'sect', sect.id)) {
        return guidingError(
            'sect_not_known',
            `${cultivator.name} has never heard of ${sect.name}. A name is where a door starts.`,
            { hint: 'Somebody would have to say the name in front of you first.' }
        );
    }

    if (membership && membership.sectId === sect.id) {
        return guidingError(
            'already_of_this_house',
            `${cultivator.name} is already ${membership.rankTitle} of ${sect.name}. `
            + 'A guest place is what a house offers somebody it has not taken.',
            {
                hint: 'What rank reaches on your own shelf is sect_manage({ action: "prospect" }).'
            }
        );
    }

    // ── The two honest refusals, and both name what would work ──────────
    if (!takesGuests(sect.id)) {
        const top = shelfTopOf(sect.id);
        return guidingError(
            'nothing_held_back',
            top === null
                ? `${sect.name} teaches no road to anybody. There is no shallow end here because `
                  + 'there is no shelf.'
                : `${sect.name} does not take guests. Everything it holds stops at `
                  + `${rankName(top)}, so there is nothing behind the door - opening any of it to `
                  + 'an outsider would be opening all of it, and a house that has nothing to hold '
                  + 'back cannot afford to be generous with what it has.',
            {
                sectId: sect.id,
                shelfTopRank: top === null ? null : rankName(top),
                hint: 'The houses that take guests are the ones with depth to protect. '
                    + 'sect_manage({ action: "guest" }) lists the ones you have heard of.'
            }
        );
    }

    const place = guestPlaceAt(sect.id, cultivator.realmOrdinal, homeId);
    if (!place) {
        return guidingError(
            'nothing_shallow_enough',
            `${sect.name} would let somebody sit in and has nothing on its low shelf to put in `
            + 'front of anybody.',
            { sectId: sect.id }
        );
    }

    const terms = termsOf(place, cultivator.realmOrdinal);

    if (!args.accept) {
        return {
            ...terms,
            probation: probation && probation.factionId === sect.id
                ? carriedProbationFacts(probation)
                : null,
            accepted: false,
            offerStands: place.opens.length > 0,
            narrationHint: place.opens.length === 0
                ? `${sect.name} would take a guest. Nothing it shows one is anything `
                  + `${cultivator.name} can open yet.`
                : `${sect.name} will let ${cultivator.name} sit in. It is teaching time and `
                  + 'nothing else.',
            hint: 'sect_manage({ action: "guest", sectId, accept: true }) takes the place. '
                + 'Nothing is signed and nothing is owed.'
        };
    }

    // ── Taking it ───────────────────────────────────────────────────────
    //
    // Not an attempt and not a judgement. A house that has decided to take
    // guests has decided; the filter was the shelf, and it has already run.
    // Nothing here rolls, because nothing here is a favour.
    const entry: GuestRollEntry = {
        hostFactionId: sect.id,
        sinceDay: today,
        againstTheirOwnHouse: place.homeStance === 'forbids'
    };
    writeFlag(repos.db, cultivator.id, FLAG_GUEST_STUDENT_OF, JSON.stringify(entry));

    // Read back AFTER the roll is written, so somebody taking a published door
    // is told the terms of the thing they have just joined rather than the
    // terms of the thing they were not in a moment ago.
    const nowOnProbation = probationOf(repos, cultivator, run);

    return {
        ...terms,
        probation: nowOnProbation ? carriedProbationFacts(nowOnProbation) : null,
        accepted: true,
        onDay: today,
        // Said plainly at the moment it is written, because this is the fact
        // somebody will otherwise discover by being surprised by it.
        stillOf: homeId
            ? `${getSect(homeId)?.name ?? homeId}. You are entered on this house's guest roll `
              + 'and on nobody\'s house roll. Two rolls, two relationships, and no conflict.'
            : 'Nobody. You are entered on this house\'s guest roll and on nobody\'s house roll.',
        replacedGuestPlaceAt: held && held.hostFactionId !== sect.id ? held.hostFactionId : null,
        narrationHint:
            `${cultivator.name} is entered on ${sect.name}'s guest roll. No rung, no stipend, `
            + 'no protection, and a seat in the hall.'
    };
}

/**
 * Whether the house has come round to putting membership to its guest.
 */
export function guestWouldBeOfferedAPlace(
    db: Database.Database,
    cultivatorId: string,
    ordinal: number,
    heldTechniqueIds: readonly string[],
    today: number
): { hostFactionId: string; hostName: string; yearsSatIn: number } | null {
    const roll = guestPlaceHeldBy(db, cultivatorId);
    if (!roll) return null;
    const place = guestPlaceAt(roll.hostFactionId, ordinal, null);
    if (!place) return null;
    const years = Math.max(0, today - roll.sinceDay) / 365;
    // The ordinal is passed because at a house that publishes its door the bar
    // behind it is what PASSING costs, and it does not bend - so the offer is
    // conditional on the guest having climbed to it themselves. Without this
    // argument that branch would exist and never be consulted.
    if (!houseWouldOfferMembership(place, heldTechniqueIds, years, ordinal)) return null;
    return {
        hostFactionId: place.factionId,
        hostName: place.factionName,
        yearsSatIn: Math.floor(years)
    };
}
