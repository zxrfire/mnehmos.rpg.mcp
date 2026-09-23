/**
 * Somebody is challenged in front of people, and it is answered at their own
 * house.
 *
 * Ruled by the design owner. An equal may challenge somebody publicly. The
 * challenged person may refuse, and usually does unless the challenger is worth
 * answering; refusing costs face, and refusing a LIFE-AND-DEATH challenge costs
 * less than refusing a friendly one, because declining to die is understandable.
 * Accepting does not take anybody out of their compound: the duel is fought at
 * the challenged person's own house, on its duelling ground or its practice
 * yard. The terms are declared before it starts: to yield, or life and death.
 *
 * ── BUILT OUT OF WHAT FIGHTS ALREADY ─────────────────────────────────────
 *
 * A duel is one bout of one on one, and the engine already holds every part of
 * that: `resolveConfrontation` for the exchange, `combatantOf` for what each of
 * them brings to it, `whetherTheyGotUp` for whether the body got up,
 * `whoCouldHaveStoppedIt` for who in the yard could get a hand between two
 * people, and `attemptRescue` for whether any of them does. What is new here is
 * only the two things a duel has that a gathering's bout does not: DECLARED
 * TERMS, and a death under them being sanctioned.
 *
 * TERMS ARE THE INTENT, DECLARED RATHER THAN READ. A gathering reads why
 * somebody stood up off the standing between them (`whyTheyStoodUp`). A duel is
 * agreed in front of witnesses, so the blow each of them throws is the one the
 * terms name: `A_BOUT_BETWEEN_PEOPLE_WHO_EXPECT_TO_WALK_AWAY` under `to_yield`,
 * where either may break off, and `A_BLOW_MEANT_TO_END_IT` under
 * `life_and_death`, where neither does.
 *
 * ── A DEATH UNDER DECLARED TERMS IS SANCTIONED, AND NOTHING ELSE CHANGES ─
 *
 * The winner is not hunted for it: the fact carries `sanctioned`, so nothing
 * reading the record takes it for a murder. Every ordinary consequence still
 * follows, because they are consequences of a death rather than of a crime -
 * the lamp goes out where the house keeps one, `settleNpcDeath` passes the
 * estate and the goals, `whatAKillingLeaves` opens the accounts the kin and the
 * disciples hold and prices the patron's answer by what the dead were worth, and
 * an office they held stands empty for the next deal. A senior dying is news by
 * the weight of the fact, which is what the digest reads.
 *
 * ── GOING FOR THE KILL UNDER FRIENDLY TERMS IS NOT A DUEL DEATH ──────────
 *
 * It is a murder in front of witnesses, and it is the case bystanders actually
 * step into: the same rescue, and if it lands anyway the winner pays
 * {@link WHAT_BREAKING_THE_TERMS_COSTS} in face - four times what any win is
 * worth - and the fact is not sanctioned.
 */

import { A_BLOW_MEANT_TO_END_IT, A_BOUT_BETWEEN_PEOPLE_WHO_EXPECT_TO_WALK_AWAY } from '../cultivation/how-a-blow-was-thrown.js';
import { resolveConfrontation } from '../cultivation/combat.js';
import { realmIndexOf } from '../cultivation/realms.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { purposeOf, type RoomPurpose } from './architecture.js';
import { attemptRescue } from './convergence.js';
import { combatantOf, GRUDGE_STANDING } from './gatherings.js';
import { makeFact } from './history.js';
import { isBelowTheLid } from './layers.js';
import type { LocationRecord } from './locations.js';
import {
    NOTHING_LEFT_BUT_TO_END_IT,
    whetherTheyGotUp,
    whoCouldHaveStoppedIt,
    whyTheyStoodUp
} from './nobody-is-invincible.js';
import {
    isAwayOnSomething,
    isTheWorldsToMove,
    maxBodyOf,
    theWorldEnds,
    type NpcRecord
} from './npc-state.js';
import { settleNpcDeath } from './time.js';
import { whatAKillingLeaves } from './the-wrongs-a-world-opens-holding.js';
import { aPricedDeed } from './a-deed-enters-the-world-as-a-fact.js';
import {
    A_PUBLIC_WIN,
    aSlightBetween,
    faceOf,
    theSlightsBetween,
    theirFaceMoves,
    whatBeingWatchedIsWorth,
    whatLosingCosts,
    whatWinningIsWorth
} from './what-a-face-is-worth.js';
import { whoTheyLeave } from './who-is-left-when-somebody-dies.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { indexById, type FactionRecord, type WorldState } from './world-state.js';

/** What was declared before it started. */
export type DuelTerms = 'to_yield' | 'life_and_death';

/** The ground a house settles things on, best first. */
export const WHERE_A_DUEL_IS_HELD: readonly RoomPurpose[] = ['duelling_ground', 'practice_yard'];

/** Within this many realms, two people are each other's equals for a challenge. */
export const AN_EQUAL_IS_WITHIN_REALMS = 1;

/** What answering a challenge at all is worth, against one public win. */
export const WHAT_ANSWERING_IS_WORTH = 0.25;

/**
 * What refusing to fight to the death costs, against refusing a friendly duel.
 *
 * The owner's ruling, and the reason it is not one figure: declining to die is
 * understandable, and declining to be measured is not.
 */
export const REFUSING_TO_DIE_COSTS = 0.25;

/** What killing somebody under friendly terms costs, against one public win. */
export const WHAT_BREAKING_THE_TERMS_COSTS = 4;

/**
 * What stepping in costs the one who does, against one public win.
 *
 * ALWAYS PAID, whoever they are - the owner: saving somebody in a life-and-death
 * duel costs the saver face whatever their status, and they pay it because the
 * tie is worth more. Status only scales how much: somebody a realm above the
 * fight is doing something nobody will say anything about, somebody who is
 * barely above it has stepped into an exchange they had no business in. So the
 * cost is divided by how far above the fight they stood.
 */
export const WHAT_STEPPING_IN_COSTS = 1;

/** What trying and failing costs, against stepping in and succeeding. */
export const AND_FAILING_COSTS = 0.5;

/** Where this house settles something, or null where it has no ground of its own. */
export function whereADuelIsFought(
    state: Pick<WorldState, 'locations'>,
    house: Pick<FactionRecord, 'id' | 'seatLocationId'>
): LocationRecord | null {
    for (const purpose of WHERE_A_DUEL_IS_HELD) {
        const room = state.locations.find(l => l.data?.factionId === house.id && purposeOf(l) === purpose);
        if (room) return room;
    }
    return state.locations.find(l => l.id === house.seatLocationId) ?? null;
}

/** What the challenged person did about it. */
export interface WhetherTheyAnswer {
    answers: boolean;
    /** Engine truth, one line. Never narration. */
    why: string;
    /** What refusing costs them in face. Nought where they answered. */
    faceIfRefused: number;
}

/**
 * Whether the challenged person answers, and what refusing costs.
 *
 * WORTH ANSWERING IS THREE THINGS, any of which is enough, and all of them are
 * facts the world already holds: the challenger is an equal (within
 * {@link AN_EQUAL_IS_WITHIN_REALMS} realms, which is what makes a public
 * challenge a challenge rather than a junior shouting), there is a pile between
 * them already (`theSlightsBetween` past the grudge band, so refusing is
 * refusing to settle something everybody knows about), or the challenger's own
 * face is at or above theirs, which is somebody it costs nothing to be seen
 * fighting.
 */
export function whetherTheyAnswer(input: {
    challenged: NpcRecord;
    challenger: NpcRecord;
    terms: DuelTerms;
    witnesses: number;
}): WhetherTheyAnswer {
    const gap = Math.abs(
        realmIndexOf(input.challenged.cultivation.realmOrdinal)
        - realmIndexOf(input.challenger.cultivation.realmOrdinal)
    );
    const anEqual = gap <= AN_EQUAL_IS_WITHIN_REALMS;
    const pile = theSlightsBetween(input.challenged, input.challenger.id);
    // SOMEBODY WITH A NAME, which is face they have actually won. Read as
    // "at least as much as mine" alone this was true of every pair in the world
    // who had never been in front of anybody - nought against nought - and
    // nobody ever refused anything.
    const standsAsHigh = faceOf(input.challenger) > 0
        && faceOf(input.challenger) >= faceOf(input.challenged);
    const worthAnswering = anEqual || pile >= -GRUDGE_STANDING || standsAsHigh;

    const watched = whatBeingWatchedIsWorth(input.witnesses);
    const refusing = Number((A_PUBLIC_WIN * watched
        * (input.terms === 'life_and_death' ? REFUSING_TO_DIE_COSTS : 1)).toFixed(2));

    return worthAnswering
        ? {
            answers: true,
            why: anEqual
                ? 'An equal asked in front of people.'
                : pile >= -GRUDGE_STANDING
                    ? `Slights worth ${pile.toFixed(2)} already stand between them.`
                    : 'The challenger stands as high as they do.',
            faceIfRefused: 0
        }
        : {
            answers: false,
            why: `${gap} realm${gap === 1 ? '' : 's'} between them, and the challenger `
                + 'holds no face above theirs.',
            faceIfRefused: refusing
        };
}

/** What a duel came to. Every id is somebody the world holds. */
export interface WhatTheDuelCameTo {
    fought: boolean;
    terms: DuelTerms;
    locationId: string | null;
    witnesses: number;
    /** Set where the challenged refused, with what it cost them. */
    refused: { byId: string; why: string; face: number } | null;
    winnerId: string | null;
    loserId: string | null;
    /** True where the loser did not get up and nobody stopped it. */
    died: boolean;
    /** Who stepped in, where somebody did. */
    savedById: string | null;
    /** Who tried and did not reach them. */
    failedById: string | null;
    /** True where a friendly duel was ended past the mark. It is a murder. */
    theTermsWereBroken: boolean;
    /** Face moved, by id, after everything. */
    faceMoved: Record<string, number>;
    /** Engine truth, one line. */
    line: string;
}

/**
 * Hold one duel. Mutates `state` in place, and writes one fact.
 *
 * The challenge is public by construction: the witnesses are whoever is
 * standing on the ground it is fought on.
 */
export function holdADuel(
    state: WorldState,
    input: {
        challenger: NpcRecord;
        challenged: NpcRecord;
        terms: DuelTerms;
        where: LocationRecord;
        day: number;
        rng?: CultivationRNG;
    }
): WhatTheDuelCameTo {
    const { terms, where, day } = input;
    const rng = input.rng
        ?? forStream(state.seed, 'a-duel', input.challenger.id, input.challenged.id, day);
    const watching = state.npcs.filter(n =>
        n.status === 'alive' && isBelowTheLid(n) && n.locationId === where.id
        && n.id !== input.challenger.id && n.id !== input.challenged.id);
    const witnesses = watching.length;
    const faceMoved: Record<string, number> = {};

    const answer = whetherTheyAnswer({
        challenged: input.challenged, challenger: input.challenger, terms, witnesses
    });
    if (!answer.answers) {
        faceMoved[input.challenged.id] = -answer.faceIfRefused;
        theirFaceMoves(state, input.challenged.id, -answer.faceIfRefused, day);
        const line = `${input.challenged.name} would not answer ${input.challenger.name}`
            + `${witnesses > 0 ? `, in front of ${witnesses}` : ''}.`;
        appendWorldFact(state, makeFact({
            day, kind: 'said_in_public', scale: 'personal', summary: line,
            actors: [
                { id: input.challenger.id, name: input.challenger.name, role: 'challenger' },
                { id: input.challenged.id, name: input.challenged.name, role: 'refused' }
            ],
            locationId: where.id,
            factionIds: [input.challenged.factionId, input.challenger.factionId]
                .filter((id): id is string => id !== null),
            visibility: 'faction', magnitude: 0.2, causeKnown: true,
            data: { duel: true, terms, refused: true, witnesses }
        }), { recur: false });
        return {
            fought: false, terms, locationId: where.id, witnesses,
            refused: { byId: input.challenged.id, why: answer.why, face: answer.faceIfRefused },
            winnerId: null, loserId: null, died: false, savedById: null, failedById: null,
            theTermsWereBroken: false, faceMoved, line
        };
    }

    // ── THE BOUT ─────────────────────────────────────────────────────────
    //
    // THE TERMS SAY WHAT IS THROWN, AND SOMEBODY MAY MEAN SOMETHING ELSE.
    // `whyTheyStoodUp` is the world's existing reading of whether a person is
    // here for a bout or here to end somebody, off what the two of them already
    // hold. Under life-and-death terms that is what was declared anyway. Under
    // friendly terms it is a person who agreed to fight to a yield and came to
    // kill - which is the case bystanders step into, and the one thing in a
    // duel that is a murder rather than a duel death.
    const meaning = [
        { who: input.challenger, came: whyTheyStoodUp({ who: input.challenger, against: input.challenged.id }) },
        { who: input.challenged, came: whyTheyStoodUp({ who: input.challenged, against: input.challenger.id }) }
    ];
    const meansToEndIt = terms === 'life_and_death'
        ? null
        : meaning.find(m => m.came === 'to_end_them')?.who ?? null;
    // Whoever means it more stands on the aggressor side, so the blow the
    // resolver carries is theirs rather than whoever was named first.
    const side = meansToEndIt?.id === input.challenged.id
        ? [input.challenged, input.challenger] as const
        : [input.challenger, input.challenged] as const;
    const result = resolveConfrontation(
        combatantOf(side[0], state),
        combatantOf(side[1], state),
        {
            rng,
            ambient: 'normal',
            turn: 1,
            intent: {
                thrown: terms === 'life_and_death' || meansToEndIt !== null
                    ? A_BLOW_MEANT_TO_END_IT
                    : A_BOUT_BETWEEN_PEOPLE_WHO_EXPECT_TO_WALK_AWAY,
                // Under friendly terms either of them may break off. Under life
                // and death neither does, which is what the terms mean - and
                // neither does somebody who came to end it.
                willWithdraw: terms !== 'life_and_death' && meansToEndIt === null
            }
        }
    );

    const byId = (id: string | null): NpcRecord | null =>
        id === null ? null : [input.challenger, input.challenged].find(n => n.id === id) ?? null;
    const winner = byId(result.winnerId);
    const loser = byId(result.loserId);

    // ANSWERING IS WORTH SOMETHING WHATEVER HAPPENS NEXT.
    const answered = Number((A_PUBLIC_WIN * WHAT_ANSWERING_IS_WORTH
        * whatBeingWatchedIsWorth(witnesses)).toFixed(2));
    faceMoved[input.challenged.id] = answered;
    theirFaceMoves(state, input.challenged.id, answered, day);

    let died = false;
    let savedById: string | null = null;
    let failedById: string | null = null;
    let broken = false;
    let line: string;

    if (winner && loser) {
        const won = whatWinningIsWorth({
            winnerOrdinal: winner.cultivation.realmOrdinal,
            loserOrdinal: loser.cultivation.realmOrdinal,
            witnesses
        });
        const lost = whatLosingCosts({
            loserOrdinal: loser.cultivation.realmOrdinal,
            winnerOrdinal: winner.cultivation.realmOrdinal,
            witnesses
        });
        faceMoved[winner.id] = (faceMoved[winner.id] ?? 0) + won;
        faceMoved[loser.id] = (faceMoved[loser.id] ?? 0) - lost;
        theirFaceMoves(state, winner.id, won, day);
        theirFaceMoves(state, loser.id, -lost, day);
        aSlightBetween(state, {
            slighted: loser, by: winner, worth: lost,
            note: `Beaten by them at ${where.name}, on declared terms.`, day
        });

        // ── DID THEY GET UP ──────────────────────────────────────────────
        const at = indexById(state.npcs, loser.id);
        const left = result.hp[loser.id];
        const got = whetherTheyGotUp({
            npc: state.npcs[at]!,
            hp: left === undefined ? maxBodyOf(state.npcs[at]!) : left,
            onDay: day
        });
        state.npcs[at] = got.npc;

        const killingBlow = result.finished && result.loserId === loser.id && got.cause !== null;
        // Terms said yield and the blow that landed was not one. Whoever threw
        // it declared one thing and did another in front of everybody.
        broken = killingBlow && terms === 'to_yield';

        if (killingBlow) {
            // EACH PERSON PRESENT DECIDES FOR THEMSELVES. Their tie to the one
            // on the ground is what puts them in it, and getting a hand between
            // two people takes standing a realm above the height they are
            // fighting at - which is what `standingThere` asks.
            const reachedRealm = Math.max(
                realmIndexOf(winner.cultivation.realmOrdinal),
                realmIndexOf(loser.cultivation.realmOrdinal)
            );
            const strongEnough = whoCouldHaveStoppedIt({
                present: watching,
                fighting: [winner.id, loser.id],
                reachedRealm
            });
            const rescue = strongEnough.length === 0
                ? null
                : attemptRescue(state, {
                    subject: state.npcs[at]!,
                    location: where,
                    depthDays: 0,
                    day,
                    standingThere: { theyMustOutmatchRealm: reachedRealm }
                }, rng);

            if (rescue?.came && rescue.rescuer) {
                savedById = rescue.rescuer.rescuerId;
                // Up again, and the duel is over.
                state.npcs[at] = {
                    ...state.npcs[at]!,
                    cultivation: { ...state.npcs[at]!.cultivation, hp: 1, bodyOnDay: day }
                };
                const cost = whatSteppingInCosts({
                    rescuerOrdinal: rescue.rescuer.ordinal, reachedRealm, witnesses
                });
                faceMoved[savedById] = (faceMoved[savedById] ?? 0) - cost;
                theirFaceMoves(state, savedById, -cost, day);
            } else {
                if (rescue && !rescue.came && strongEnough.length > 0) {
                    // Somebody was willing and did not get there, which is its
                    // own thing to have been seen doing.
                    const tried = strongEnough[0]!;
                    failedById = tried.id;
                    const cost = whatSteppingInCosts({
                        rescuerOrdinal: tried.cultivation.realmOrdinal, reachedRealm, witnesses
                    }) * AND_FAILING_COSTS;
                    faceMoved[tried.id] = (faceMoved[tried.id] ?? 0) - cost;
                    theirFaceMoves(state, tried.id, -cost, day);
                }
                died = theEndOfIt(state, {
                    winner, loser, terms, where, day, witnesses, faceMoved, broken
                });
            }
        } else if (got.cause !== null) {
            // Down, and up again in a week.
            state.npcs[at] = {
                ...state.npcs[at]!,
                cultivation: { ...state.npcs[at]!.cultivation, hp: 1, bodyOnDay: day }
            };
        }

        line = died
            ? `${winner.name} killed ${loser.name} at ${where.name}`
                + `${broken ? ', under friendly terms' : ', on life-and-death terms'}.`
            : savedById !== null
                ? `${winner.name} had ${loser.name} and somebody got a hand in.`
                : `${winner.name} took it from ${loser.name} at ${where.name}.`;
    } else {
        line = `${input.challenger.name} and ${input.challenged.name} could not settle it.`;
    }

    if (!died) {
        appendWorldFact(state, makeFact({
            day, kind: 'said_in_public', scale: 'personal', summary: line,
            actors: [
                { id: input.challenger.id, name: input.challenger.name, role: 'challenger' },
                { id: input.challenged.id, name: input.challenged.name, role: 'challenged' },
                ...(savedById === null ? [] : [{ id: savedById, name: savedById, role: 'stepped_in' }])
            ],
            locationId: where.id,
            factionIds: [input.challenged.factionId, input.challenger.factionId]
                .filter((id): id is string => id !== null),
            visibility: 'faction', magnitude: 0.3, causeKnown: true,
            data: { duel: true, terms, witnesses, savedBy: savedById, failedBy: failedById }
        }), { recur: false });
    }

    return {
        fought: true, terms, locationId: where.id, witnesses, refused: null,
        winnerId: winner?.id ?? null, loserId: loser?.id ?? null,
        died, savedById, failedById, theTermsWereBroken: broken, faceMoved, line
    };
}

/** What stepping in costs the one who does. See {@link WHAT_STEPPING_IN_COSTS}. */
export function whatSteppingInCosts(input: {
    rescuerOrdinal: number;
    reachedRealm: number;
    witnesses: number;
}): number {
    const above = Math.max(1, realmIndexOf(input.rescuerOrdinal) - input.reachedRealm);
    return Number((A_PUBLIC_WIN * WHAT_STEPPING_IN_COSTS
        * whatBeingWatchedIsWorth(input.witnesses) / above).toFixed(2));
}

/**
 * The body, and everything a death in this world leaves - which is everything,
 * whether or not the terms made it lawful.
 */
function theEndOfIt(
    state: WorldState,
    input: {
        winner: NpcRecord;
        loser: NpcRecord;
        terms: DuelTerms;
        where: LocationRecord;
        day: number;
        witnesses: number;
        faceMoved: Record<string, number>;
        broken: boolean;
    }
): boolean {
    const { winner, loser, terms, where, day, broken } = input;
    const at = indexById(state.npcs, loser.id);
    const dying = state.npcs[at]!;
    const ended = theWorldEnds(dying, day, broken
        ? `Killed by ${winner.name} at ${where.name}, under terms that said otherwise.`
        : `Killed by ${winner.name} at ${where.name}, on life-and-death terms.`);
    // Somebody the world may not end goes down and is carried off the ground.
    if (!ended) {
        state.npcs[at] = { ...dying, cultivation: { ...dying.cultivation, hp: 1, bodyOnDay: day } };
        return false;
    }
    state.npcs[at] = ended;
    const handoff = settleNpcDeath(state, dying, day);

    const summary = broken
        ? `${winner.name} killed ${loser.name} at ${where.name} in a duel fought to yield.`
        : `${winner.name} killed ${loser.name} at ${where.name}, on declared life-and-death terms.`;
    const theyLeft = whoTheyLeave({
        dead: dying,
        heirs: handoff.heirs,
        stillHere: id => state.npcs.some(n => n.id === id && n.status === 'alive')
    });
    // THE ACCOUNTS STILL OPEN. A sanctioned death is still a death, and the
    // people it left behind are not bound by the terms two other people agreed.
    const leaves = whatAKillingLeaves(state, { victim: dying, killer: winner, day, theyLeft, description: summary });

    // AND WHAT IT DID TO THE WINNER IN FRONT OF EVERYBODY.
    const watched = whatBeingWatchedIsWorth(input.witnesses);
    const moved = broken
        ? -Number((A_PUBLIC_WIN * WHAT_BREAKING_THE_TERMS_COSTS * watched).toFixed(2))
        : Number((A_PUBLIC_WIN * watched).toFixed(2));
    input.faceMoved[winner.id] = (input.faceMoved[winner.id] ?? 0) + moved;
    theirFaceMoves(state, winner.id, moved, day);

    appendWorldFact(state, makeFact({
        day,
        kind: 'grudge_opened',
        scale: 'local',
        summary,
        actors: [
            { id: winner.id, name: winner.name, role: 'killer' },
            { id: loser.id, name: loser.name, role: 'victim' }
        ],
        locationId: where.id,
        factionIds: [loser.factionId, winner.factionId].filter((id): id is string => id !== null),
        visibility: 'regional',
        magnitude: broken ? 0.55 : 0.45,
        causeKnown: true,
        data: {
            // PRICED LIKE EVERY OTHER KILLING, so what the dead one's people
            // hold is a weight the ledger can read rather than a duel's own
            // opinion of itself.
            ...(leaves ? aPricedDeed(leaves.weight) : {}),
            duel: true,
            terms,
            // THE ONE THING THE TERMS CHANGE. Nothing reading the record takes a
            // sanctioned death for a murder, and a killing under friendly terms
            // is not one.
            sanctioned: !broken,
            theTermsWereBroken: broken,
            witnesses: input.witnesses,
            unattributed: 'Somebody was carried off a duelling ground and did not get up.'
        }
    }), { recur: false });
    return true;
}

/** Somebody worth challenging, and what they are worth answering about. */
export function isTheirsToChallenge(challenger: NpcRecord, challenged: NpcRecord): boolean {
    if (challenger.id === challenged.id) return false;
    if (!isTheWorldsToMove(challenger) || !isTheWorldsToMove(challenged)) return false;
    if (challenger.status !== 'alive' || challenged.status !== 'alive') return false;
    if (!isBelowTheLid(challenger) || !isBelowTheLid(challenged)) return false;
    return Math.abs(
        realmIndexOf(challenger.cultivation.realmOrdinal)
        - realmIndexOf(challenged.cultivation.realmOrdinal)
    ) <= AN_EQUAL_IS_WITHIN_REALMS;
}

// ─────────────────────────────────────────────────────────────────────────
// THE YEAR'S CHALLENGES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance a pile heavy enough to fight over is taken to the ground in a year.
 *
 * Two people inside one house who cannot stand each other do not duel every
 * spring: most of it is years of not speaking. What puts it on the ground is a
 * draw, and the pile decides the terms rather than the odds - see below.
 */
export const A_PILE_IS_TAKEN_TO_THE_GROUND = 0.04;

/*
 * MEASURED at this rate over 500 years, one world each: 21 duels and 3 deaths
 * on `shape-a`, 85 and 6 on `shape-b` - a duel somewhere in the world every few
 * years and about a death a century, with the spread between the seeds being
 * how many people are standing at their own house's ground with somebody they
 * cannot stand. Nothing else moved: 925 people against 924 with the pass off,
 * and 32 catalog houses standing against 30. Face ran from -2.1 to +2.4 over
 * the people who had been in front of anybody at all.
 *
 * Nobody refused in either world, and that is this pass rather than the rule:
 * it only ever pairs equals (`isTheirsToChallenge`), and an equal asking is one
 * of the three things that make a challenge worth answering. A refusal is what
 * happens when somebody far below asks, which is a thing a player does.
 */

/**
 * Who challenges whom this year, and what came of it.
 *
 * WHO. Somebody standing on their own house's ground with a pile against
 * somebody standing there too, who is their equal (`isTheirsToChallenge`). The
 * pile is the standing already on the tie, which every bout, insult and passing
 * over in this world has been writing for centuries - so nothing here decides
 * who hates whom, it only reads it.
 *
 * THE TERMS ARE THE PILE. Past the band where there is nothing left but to end
 * it (`NOTHING_LEFT_BUT_TO_END_IT`, the same reading a gathering's bout takes),
 * the challenge is life and death. Anything lighter is fought to yield.
 */
export function theChallengesThisYear(state: WorldState, year: number, day: number): WhatTheDuelCameTo[] {
    const out: WhatTheDuelCameTo[] = [];
    const rolls = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null || !isBelowTheLid(npc)) continue;
        if (npc.activity && isAwayOnSomething(npc.activity.kind)) continue;
        const roll = rolls.get(npc.factionId);
        if (roll) roll.push(npc); else rolls.set(npc.factionId, [npc]);
    }

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        const where = whereADuelIsFought(state, house);
        if (!where) continue;
        const roll = rolls.get(house.id) ?? [];
        if (roll.length < 2) continue;
        const rng = forStream(state.seed, 'challenges', house.id, year);
        const onTheGround = new Set(roll.map(n => n.id));

        for (const challenger of roll) {
            // The one they hold the most against, and only where it is a pile
            // rather than a coolness.
            const worst = [...challenger.relationships]
                .filter(tie => onTheGround.has(tie.targetId) && tie.standing <= GRUDGE_STANDING)
                .sort((a, b) => a.standing - b.standing)[0];
            if (!worst) continue;
            const challenged = roll.find(n => n.id === worst.targetId);
            if (!challenged || !isTheirsToChallenge(challenger, challenged)) continue;
            if (out.some(row => row.winnerId === challenged.id || row.loserId === challenged.id
                || row.refused?.byId === challenged.id)) continue;
            if (!rng.chance(A_PILE_IS_TAKEN_TO_THE_GROUND)) continue;

            const terms: DuelTerms = worst.standing <= NOTHING_LEFT_BUT_TO_END_IT
                ? 'life_and_death'
                : 'to_yield';
            const atTheGround = state.npcs.find(n => n.id === challenged.id)!;
            const asker = state.npcs.find(n => n.id === challenger.id)!;
            out.push(holdADuel(state, {
                challenger: asker, challenged: atTheGround, terms, where, day,
                rng: forStream(state.seed, 'a-duel', house.id, challenger.id, year)
            }));
        }
    }
    return out;
}
