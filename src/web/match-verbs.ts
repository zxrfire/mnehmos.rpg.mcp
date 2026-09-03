/**
 * A match, a refusal, and a child - what each does to two houses.
 *
 * One subject, because they are one negotiation seen at three moments. A match
 * is put to a party rather than to a person; the refusal is as much of the
 * mechanic as the acceptance, and carries its own reason; and a child is what
 * the arrangement was FOR, which is why placing one belongs beside proposing
 * one rather than beside the other things a cultivator can spend years on.
 *
 * Two rules the module keeps, and both are the setting's rather than this
 * file's:
 *
 * - An origin buys inputs and never rank. Being born well makes surviving the
 *   climb far likelier because it buys stones, provisioned years, a teacher
 *   and placement - it does not put anybody at the top, and nothing here may
 *   grant a rung.
 * - What NPCs do is emergent and must not become an enum. Who will agree to a
 *   match, and at what price, comes out of what those people want and what is
 *   owed - a tenth reason should need no code, only a person with a different
 *   want.
 *
 * ── HOW THIS IS ATTACHED ──────────────────────────────────
 *
 * `GameService` methods living in another file, merged onto the prototype at
 * the bottom of `game.ts` with their signatures merged into the class
 * declaration. `this.proposeAMatch(...)` resolves and typechecks exactly as it
 * did when the bodies sat in the class, and every line below is the line it
 * was. `src/web/README.md` has the argument and the warning about `private`.
 *
 * `shareOfALife` was a `private static`. A static has no instance, which is
 * what module scope already means, so it is a declaration here.
 */

import { favourStanceOf } from '../data/cultivation/a-favour-skips-the-admission-bar.js';
import { getSect } from '../data/cultivation/index.js';
import { intakeRouteOf } from '../data/cultivation/sects.js';
import { spendAWord, wasPlaced } from '../engine/birth/spending-a-word-to-place-a-child.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    type APartyToAMatch,
    type TheHouseBeingAsked,
    type TheRoute,
    YEARS_BEFORE_A_CHILD_CAN_BE_PLACED,
    aFavourOwedPutOnTheTable,
    theSuitorIsPastWhatTheyCouldReach,
    whatAChildCosts,
    whatAHouseWouldTakeForAMatch,
    whatAMatchChanges,
    whatDecliningSomebodyLeaves,
    whatLeavingAMatchCosts,
    whatRefusingAMatchTheyAlreadyMadeLeaves,
    whatTheChildIs,
    whatTheHousesNoIsWorth,
    whetherTheyGoAlongWithIt,
    whoAgreesAndWhoDoesNot
} from '../engine/household/index.js';
import {
    type AskWeight,
    type WhereTheBodyLands,
    openHandednessOf,
    resolveAttempt,
    whatTheBodyWants
} from '../engine/social-leverage/index.js';
import { type ObligationDb, ledgerAbout } from '../storage/repos/obligation.repo.js';
import type {
    OnTheTable
} from '../engine/social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell.js';
import { createObligation, settleObligation } from '../engine/social/grudges.js';
import { DEFINING_STANDING } from '../engine/world/when-somebody-does-not-come-back.js';
import type { AmbientQi, ApproachLeverage, Cultivator, Run } from '../schema/cultivation.js';
import { round2 } from '../server/consolidated/cultivation-support.js';
import { theRollLands } from '../server/consolidated/forcing-an-attempt-to-land.js';
import {
    type DatabaseHandle,
    openLedgerBetween,
    recordTheTieAnAttemptLeft,
    tieFrom,
    writeObligation
} from './encounters.js';
import { factsForRefusal, factsForToolResult, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import { CALLING_IN_A_FAVOUR, RAISING_FOCUS, TRAVEL_FOCUS } from './turn-constants.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import {
    howHighTheirHouseReaches,
    whatIsBeingPutDown
} from './what-a-holder-would-take-for-it.js';
import type { KnowledgeScope } from './entities.js';
import type { GameService } from './turn-engine.js';

/**
 * A fraction of a lifespan, as somebody would say it out loud.
 *
 * The same bands `whatAChildCosts` renders its own note with, said here so
 * the player's sentence can carry the two people's NAMES - which this layer
 * holds and the pure engine function does not, which is why its note reads
 * "at 6fd9935f-ee10-4184-ad6b-2dc0d0f320d4's rung".
 */
function shareOfALife(fraction: number): string {
    if (fraction <= 0) return 'none';
    if (fraction >= 1) return 'more than the whole';
    const pct = fraction * 100;
    return pct < 1 ? 'under a hundredth' : `about ${Math.round(pct)} in a hundred`;
}

/**
 * What the room said, in sentences a player can act on.
 *
 * ── THIS EXISTS BECAUSE A NUMBER NOBODY PRINTS IS A NUMBER NOBODY HAS ────
 *
 * AGENTS.md's most-repeated defect, one size down: `whatTheBodyWants` returns
 * three things that are worth more than its scalar, and all three die at this
 * boundary unless somebody writes them out.
 *
 *   whoMovedIt   the answer turned on ONE person. Under three tiers a player's
 *                problem is not what the house thinks, it is WHICH ELDER - so
 *                they get the name, and a name the game printed is a name the
 *                game will accept back.
 *   moved        what this asker has already done to that person, UNCLAMPED.
 *                A reading is held to the axis and the sway is not, so a player
 *                who has put down more than the axis can hold is told that the
 *                next favour bought nothing. That is the difference between a
 *                house that says no and a house whose no can be understood.
 *   against      who was overruled. A costly disagreement that nobody is told
 *                about is a free one.
 *
 * Prose only, and none of it decides anything - every number here was settled
 * by the engine before this function was called.
 */
function whatTheRoomSays(
    council: WhereTheBodyLands,
    nameOf: (id: string) => string
): { forThePlayer: string[]; forTheRecord: string[] } {
    if (council.leaning === null || council.whoMovedIt === null) {
        // Not silence. A body with nobody at a deciding rung is a body there is
        // nobody in to ask, and saying so is the honest answer rather than
        // letting the player read the absence as indifference.
        return {
            forThePlayer: [council.line],
            forTheRecord: [`The room: ${council.line}`]
        };
    }

    const mover = council.whoMovedIt;
    const who = nameOf(mover.id);
    const forThePlayer: string[] = [];

    forThePlayer.push(
        council.settledBy === 'the seat'
            ? `The room did not want it and ${who}, who holds the seat, settled it anyway - `
              + `over ${council.against.length} of them who were far enough away to mind.`
            : council.settledBy === 'the elders, unanimous against the seat'
                ? `${who} and every other elder are on the same side of the head of the house, `
                  + 'and a head who is alone in the room does not hold it. The seat was '
                  + 'overruled.'
                : `${who} is the one the room turned on. Take them out of it and the answer `
                  + 'moves further than for anybody else in there.'
    );

    // What this asker has already done to that person, which is the part they
    // can still change.
    if (mover.whatMovedThem.favoursOwed > 0 || mover.whatMovedThem.wrongsHeld > 0) {
        const owed = mover.whatMovedThem.favoursOwed;
        const held = mover.whatMovedThem.wrongsHeld;
        const parts: string[] = [];
        if (owed > 0) parts.push(`${owed} thing${owed === 1 ? '' : 's'} they owe you`);
        if (held > 0) parts.push(`${held} they hold against you`);
        forThePlayer.push(
            `That is not only who they are: ${parts.join(' and ')} sits between you, and it `
            + `moved them ${mover.moved > 0 ? 'toward' : 'away from'} you by `
            + `${Math.abs(mover.moved).toFixed(2)}.`
        );
        // THE UNCLAMPED HALF. Past the end of the axis a further favour is a
        // favour spent for nothing, and a player is owed that sentence before
        // they spend it rather than after.
        if (Math.abs(mover.baseline + mover.moved) > 1) {
            forThePlayer.push(
                'You are already past what that can buy with them. Whatever you put down next '
                + 'moves this particular person no further, and would do more somewhere else.'
            );
        }
    } else {
        forThePlayer.push(
            `Nothing stands between you and ${who} either way. They are answering on who they `
            + 'are, which is the only thing they have to go on.'
        );
    }

    if (council.against.length > 0) {
        forThePlayer.push(
            `Overruled, and they will remember it: ${council.against.map(p => nameOf(p.id))
                .join(', ')}.`
        );
    }

    return {
        forThePlayer,
        forTheRecord: [
            `The room: ${council.theRoom.length} deciding, settled by ${council.settledBy}, `
            + `landing at ${council.leaning.toFixed(3)}. ${council.line}`,
            `Turned on ${mover.id} (rung ${mover.rankIndex}, weight ${mover.weight}, `
            + `base ${mover.baseline.toFixed(3)}, moved ${mover.moved.toFixed(3)}, `
            + `reading ${mover.reading.toFixed(3)}).`,
            `Overruled: ${council.against.length === 0
                ? 'nobody'
                : council.against.map(p => `${p.id} (rung ${p.rankIndex})`).join(', ')}.`
        ]
    };
}

/**
 * How a house's roll carries somebody, in `birth.ts`'s own three values.
 *
 * `'by blood'` where the roster IS a lineage - `intakeRouteOf` answers that and
 * no faction id is named here - because a lineage is entered by blood and a
 * match is one of the two ways somebody comes to be of one. `'by taking'` for
 * anybody a house has actually put on its roll, which is the case where the
 * house has a say in where they go. `null` for somebody who merely stands
 * there, and a house cannot dispose of them at all.
 */
function rollFor(houseId: string | null, ranked: boolean): 'by blood' | 'by taking' | null {
    if (houseId === null) return null;
    if (intakeRouteOf(houseId) === 'adoption') return 'by blood';
    return ranked ? 'by taking' : null;
}

export const matchVerbs = {
    /**
     * How the played cultivator enters a negotiation about a match.
     *
     * `carriesTheLineAt` is null and that is honest rather than lazy. Nothing
     * in this world writes an ability tier onto anybody - the dilution rule has
     * had no writer since it was written - so the engine can answer what a
     * match does to a line and the played game has no line to hand it. Stated
     * here so the next person finds the gap rather than the null.
     */
    asAPartyToAMatch(this: GameService, cultivator: Cultivator): APartyToAMatch {
        const membership = this.repos.sects.getMembership(cultivator.id);
        const houseId = membership?.sectId ?? cultivator.sectId ?? null;
        return {
            personId: cultivator.id,
            reachesTo: cultivator.realmOrdinal,
            carriesTheLineAt: null,
            houseId,
            onTheRoll: rollFor(houseId, membership !== null)
        };
    },

    /**
     * What a house would take, and who else has a say in it.
     *
     * Two shapes of sentence reach here and the difference between them is
     * whether anything was put on the table. Asking what it would take is a
     * question and costs no day; putting something down is an attempt and runs
     * through the same resolver every other attempt in this game runs through.
     */
    async proposeAMatch(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        offered: string | undefined,
        intent: string,
        leverage: ApproachLeverage | undefined,
        rawInput: string
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();
        if (query.length < 2) {
            return refused('engine.resolveParty', 'propose', factsForRefusal(
                'A match with whom?',
                'A match is put to somebody, or to their house. You have not said who. '
                + `${this.whoIsAbout(cultivator)}`,
                'Unresolved party: propose with no subject named. '
                + `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        const party = this.partyPutTo(cultivator, query, scope);
        if (!party) return this.nobodyByThatName(cultivator, query, scope, 'propose');
        if (party.kind !== 'cultivator' || !party.party) {
            return refused('engine.resolveParty', 'propose', factsForRefusal(
                'A house is not the party to a match. Somebody in it is.',
                `A match is between two people and is negotiated with whoever speaks for them. `
                + `"${query}" is a body rather than a person, so name somebody on its roll and `
                + 'put it to them.',
                `Resolved "${query}" to a ${party.kind}. Nothing spent, no time passed.`
            ));
        }

        const world = this.atHand;
        const theirFaction = party.party.factionId ?? null;
        const mine = this.asAPartyToAMatch(cultivator);
        const theirs: APartyToAMatch = {
            personId: party.id,
            reachesTo: party.party.realmOrdinal ?? 0,
            carriesTheLineAt: null,
            houseId: theirFaction,
            onTheRoll: rollFor(theirFaction, party.party.ranked === true)
        };
        const house: TheHouseBeingAsked = {
            houseId: theirFaction ?? '',
            reachesTo: howHighTheirHouseReaches(world, theirFaction),
            // Counted off the roster, and it can only ever be zero while
            // nothing writes a line onto anybody. See `asAPartyToAMatch`.
            othersCarryingTheLineAsWell: 0
        };

        // ── AND WHO IN THAT HOUSE IS ACTUALLY DECIDING ───────────────────
        //
        // "some can pressure or sell off their daughter, some won't" - and it
        // is not a field on the family. What a house will spend somebody for
        // is what the people who decide in it will spend them for, plus what
        // THIS asker has already done to each of them. Nothing is authored per
        // house: the roll and the ladder are the world's, and both terms are
        // read off rows that exist for other reasons.
        //
        // The whole roll goes in and the module decides who among them counts,
        // so there is one answer to "who are the elders here" rather than one
        // per caller. The player's own row is on that roll under the same id
        // as their sheet, so a cultivator who has climbed into a seat is in
        // the room they are negotiating with, at their own weight.
        const council = whatTheBodyWants({
            roll: (world?.npcs ?? [])
                .filter(n => theirFaction !== null && n.factionId === theirFaction)
                .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
            rankCount: theirFaction ? getSect(theirFaction)?.ranks.length ?? 0 : 0,
            asking: cultivator.id,
            // Every open row naming the player, in any capacity. The module
            // picks out what each decider owes them and what each holds about
            // them; handing it a pair query would have asked only about the
            // person being proposed for, who is usually not in the room.
            ledger: ledgerAbout(this.repos.db as unknown as ObligationDb, cultivator.id),
            asOfDay: Math.floor(run.elapsedDays)
        });
        const nameInTheRoom = (id: string): string =>
            id === cultivator.id
                ? cultivator.name
                : (world?.npcs ?? []).find(n => n.id === id)?.name ?? 'somebody unnamed';
        const roomLines = whatTheRoomSays(council, nameInTheRoom);

        // ── WHAT IS ON THE TABLE, AND THE LIST IS OPEN ───────────────────
        //
        // The same `whatIsBeingPutDown` the barter verb uses, which asks one
        // question of anything at all - how high does it carry whoever receives
        // it - and branches on nothing about what kind of thing it is. Stones,
        // an art, a manual, a material, protection, an alliance: one field.
        const table: OnTheTable[] = [];
        if (offered && offered.trim().length >= 2) {
            // `theirs.reachesTo` is the fourth argument for the reason the
            // barter caller passes one: what a thing is worth is a fact about
            // the person receiving it. This is the owner's Hollow Court case,
            // and it falls out of rows rather than out of a branch on a house -
            // a member standing at the Void Refinement floor is refused stones
            // and refused a heaven-grade pill, and the one thing in the catalog
            // that reaches past her own rung is a higher Unearned Step.
            table.push(whatIsBeingPutDown(
                offered.trim(), cultivator.realmOrdinal, this.whatTheyAreCarrying(party.id),
                theirs.reachesTo
            ));
        }

        // ── AND A WORD ALREADY OWED IS ONE OF THE THINGS YOU CAN PUT DOWN ─
        //
        // The credit side of the ledger has never been spendable. An obligation
        // owed TO somebody sat there as a scoreboard entry, and the one thing
        // in this world money does not buy is exactly what a word is for. This
        // is the whole of the wiring: a favour is worth the rung of whoever
        // owes it, which is the pricing module's own rule.
        //
        // It matters most for somebody with no house, who has no other road.
        const callingItIn = CALLING_IN_A_FAVOUR.test(rawInput.toLowerCase());
        const owed = openLedgerBetween(this.repos, cultivator.id, party.id)
            .filter(r => r.kind === 'favor' && r.holderId === cultivator.id);
        if (callingItIn) {
            for (const record of owed) {
                table.push(aFavourOwedPutOnTheTable(record, theirs.reachesTo));
            }
        }

        const answer = whatAHouseWouldTakeForAMatch({ house, theirs, theOther: mine, table });
        const says = whoAgreesAndWhoDoesNot(answer);

        // ── WHICH ROUTE THIS IS, AND IT IS READ OFF THE TIE ──────────────
        //
        // The order of consent is the whole difference between the two routes,
        // and in a played game the order is visible in the ledger rather than
        // in the sentence: two people with a tie the world already calls
        // defining have something between them, and a house answering now is
        // answering about a thing that exists. Everybody else is asking first.
        const heldTie = tieFrom(this.repos, cultivator.id, party.id);
        const route: TheRoute =
            heldTie !== null
            && (heldTie.type === 'spouse' || heldTie.type === 'lover'
                || heldTie.strength >= DEFINING_STANDING)
                ? 'person first'
                : 'family first';

        // ── AND WHETHER THE FAMILY'S ANSWER EVEN MATTERS ─────────────────
        //
        // The reprisal layer's own question with the parties in the seats a
        // match puts them in. No rung is read here: what decides it is whether
        // anything of the family's would be cost by acting, and whether the
        // suitor is simply past what they could reach.
        const membership = this.repos.sects.getMembership(cultivator.id);
        const stick = whatTheHousesNoIsWorth({
            theFamily: { houseId: theirFaction },
            theSuitorsBacking: membership !== null ? 'backed' : 'none',
            // ── AND THE GAP IS READ LOOKING UP, NOT DOWN ─────────────────
            //
            // `answer.howFarApart` is the band read from the suitor toward the
            // house, and the question here is the other one: can the FAMILY
            // reach the SUITOR. The two are not mirror images - `dismissed`
            // wants seventeen rungs and `unreachable` wants nine - and taking
            // the wrong one handed the family power it does not have. Played:
            // a cultivator at rung 44 was told by a family that reaches 29 to
            // elope or give up. It now reads `they can be pressed`, whose own
            // line is the right answer to the owner's case - "they can still
            // start something, and they are in no position to finish it".
            theSuitorIsOutOfTheirReach:
                theSuitorIsPastWhatTheyCouldReach(theirs.reachesTo, mine.reachesTo)
        });

        // ── AND WHETHER THE PERSON GOES ALONG WITH IT ────────────────────
        //
        // Off what they want and who they already have a tie to, both of which
        // are rows the world keeps for other reasons. There is no compliance
        // field anywhere and there must not be one.
        const wanted = this.whatTheyWantOfYou(cultivator, party.id);
        const theirOwnAnswer = whetherTheyGoAlongWithIt({
            wantsItServes: wanted ? 1 : 0,
            // A want a match forecloses needs a reading this layer does not yet
            // have. Zero is honest: nothing is being asserted about them.
            wantsItForecloses: 0,
            standingTowardSomebodyElse: this.strongestTieAwayFrom(party.id, cultivator.id)
        });

        const structure = [
            `Match: ${cultivator.name} (rung ${mine.reachesTo}, `
            + `${mine.houseId ?? 'no house'}) with ${party.name} (rung ${theirs.reachesTo}, `
            + `${theirs.houseId ?? 'no house'}, on the roll ${theirs.onTheRoll ?? 'not at all'}).`,
            `The house is short of: ${answer.shortOf}. Standing between them: `
            + `${answer.howFarApart}, read from the suitor toward the house. `
            + `Children of it would carry `
            + `${answer.theLineTheChildrenWouldCarry ?? 'no line'}.`,
            `Bar ${answer.price.theHeightToReach}; on the table `
            + `${answer.price.theBestPutDown ?? 'nothing singular'} at `
            + `${answer.price.theBestOnTheTable}; ${answer.price.why ?? 'price met'}.`,
            ...says.says.map(s =>
                `${s.party}: ${s.inFavour === null ? 'not this layer to answer' : s.inFavour}. `
                + s.because),
            `Route: ${route}. What the house's no is worth: ${stick.is} (their reach `
            + `${stick.theirReach}). The person themselves: ${theirOwnAnswer.answer}.`,
            ...roomLines.forTheRecord
        ];

        // ── ASKING WHAT IT WOULD TAKE IS A QUESTION ──────────────────────
        //
        // It costs a sentence, so it costs no day and rolls nothing. What it is
        // not is free of consequence: they now know what you are after.
        if (table.length === 0) {
            const facts = factsForToolResult(
                `${party.name}, on what a match would take.`,
                [
                    `You put it to ${party.name} and their people, and ask what it would take. `
                    + answer.line,
                    ...says.says
                        .filter(s => s.inFavour !== null)
                        .map(s => `${s.party[0].toUpperCase()}${s.party.slice(1)}: ${s.because}`),
                    says.onlyThePersonIsLeftToAsk
                        ? 'Nobody who speaks for them objects. What is left is whether they want '
                          + 'it, and that is theirs to say.'
                        : 'They do not all say the same thing, which is where these come apart.',
                    // What the family's answer is actually worth. A player who
                    // cannot tell a refusal that binds from one that follows
                    // from nothing is negotiating in the dark.
                    stick.line,
                    // And the person themselves, in terms somebody who had
                    // asked about them would recognise.
                    `${party.name}: ${theirOwnAnswer.because}`,
                    // Who in that house actually settled it, what your own
                    // history with them did to the answer, and who got
                    // overruled. Asking the price is exactly the moment a
                    // player needs the name.
                    ...roomLines.forThePlayer
                ]
            );
            facts.structure.push(...structure);
            this.noteEncounter(
                cultivator, run, party, 'witnessed', 'Put a match to them and asked the price.'
            );
            return this.freeAction(run, 'propose', facts);
        }

        // ── AND PUTTING SOMETHING DOWN IS AN ATTEMPT ─────────────────────
        const mySect = membership ? this.repos.sects.getById(membership.sectId) : null;
        const theirSect = theirFaction ? getSect(theirFaction) : null;

        const result = resolveAttempt({
            // ADMIN, and only ADMIN. Decides whether they moved, and
            // nothing else about what follows. See
            // forcing-an-attempt-to-land.ts for why that line is there.
            theAttemptLands: theRollLands('an_approach_to_somebody'),
            actor: {
                id: cultivator.id,
                name: cultivator.name,
                ordinal: cultivator.realmOrdinal,
                charm: cultivator.attributes.charm,
                factionId: membership?.sectId ?? null,
                alignment: mySect?.alignment ?? null,
                ranked: membership !== null
            },
            subject: {
                id: party.id,
                name: party.name,
                ordinal: theirs.reachesTo,
                ...(party.party.charm === undefined ? {} : { charm: party.party.charm }),
                factionId: theirFaction,
                alignment: theirSect?.alignment ?? null,
                ranked: party.party.ranked ?? false,
                openHandedness: openHandednessOf(party.id)
            },
            onDay: Math.floor(run.elapsedDays),
            theirTie: tieFrom(this.repos, party.id, cultivator.id),
            yourTie: tieFrom(this.repos, cultivator.id, party.id),
            ledger: openLedgerBetween(this.repos, cultivator.id, party.id),
            // A match whose price is met is an ordinary favour. One whose price
            // is not met asks them to end up worse off and see it while
            // agreeing, which is what `against_their_interest` means.
            ask: (answer.weight.thePriceWasMet
                ? 'a_real_favour'
                : 'against_their_interest') as AskWeight,
            theyWantSomethingFromYou: answer.weight.theyWantWhatIsInFrontOfThem,
            theAnswerWasTheirsToGive: theirs.onTheRoll !== null,
            theirHoldOnItIsMerelyReserved: answer.price.why !== 'they_need_it_themselves',
            approach: {
                intent: rawInput.slice(0, 400),
                ...(leverage ? { leverage } : {})
            },
            rng: forStream(
                run.seed, 'social_leverage', Math.floor(run.elapsedDays), `${party.id}:match`
            )
        });

        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Putting a match to ${party.name}`, result.days
        );
        const left = this.recordWhatTheAskLeft(run, cultivator, party, result, 'propose', true);
        const took = result.outcome === 'taken' || result.outcome === 'turned';

        const lines = [
            `${intent === 'accept' ? 'You agree to it' : 'You put it to them'} and set down `
            + `${answer.price.theBestPutDown ?? 'nothing anybody could hold'}. ${answer.line}`,
            // The room, on the turn something was actually put down. A player
            // who has just spent a singular thing is owed the name of whoever
            // it turned on, and owed being told when it bought nothing.
            ...roomLines.forThePlayer
        ];
        const calls: ToolCallRecord[] = [];

        if (took) {
            const changed = whatAMatchChanges({
                one: mine,
                other: theirs,
                onDay: Math.floor(run.elapsedDays),
                // Nobody is bound. A match two people agreed to gives no house
                // anything to collect, and `whatWalkingOutOfItCosts` names that
                // as the common case. A house EXTRACTING one writes the oath,
                // and that path is the world's rather than the player's.
                bound: null,
                note: `Agreed at ${placeName(cultivator)} for `
                    + `${answer.price.theBestPutDown ?? 'terms neither of them wrote down'}.`
            });

            // Both halves of the tie, at the strength and the type the engine
            // answered with rather than at anything restated here.
            recordTheTieAnAttemptLeft(
                this.repos, cultivator.id, party.id, Math.floor(run.elapsedDays),
                {
                    theirs: {
                        type: changed.ties[1].type,
                        strength: changed.ties[1].strength,
                        significance: 'defining',
                        roles: ['married']
                    },
                    yours: {
                        type: changed.ties[0].type,
                        strength: changed.ties[0].strength,
                        significance: 'defining',
                        roles: ['married']
                    },
                    event: {
                        onDay: Math.floor(run.elapsedDays),
                        kind: 'match',
                        summary: changed.note
                    }
                }
            );

            lines.push(
                `It stands. ${party.name} and ${cultivator.name} are a household, and everybody `
                + 'who deals with either of them now reads that.'
            );
            if (changed.rolls.length > 0) {
                lines.push(
                    'And a roll moves: ' + changed.rolls
                        .map(r => `${r.personId} is on ${r.houseId}'s, by blood, at no rank in `
                            + 'it. A lineage is entered by blood and a match is one of the two '
                            + 'ways somebody comes to be of one.')
                        .join(' ')
                );
            }
            if (changed.betweenTheHouses) {
                lines.push(
                    `${changed.betweenTheHouses[0]} and ${changed.betweenTheHouses[1]} are now `
                    + 'connected by it, which is a thing the standing register holds and other '
                    + 'houses read.'
                );
            }
            calls.push({
                name: 'engine.whatAMatchChanges',
                action: 'propose',
                summary: changed.note,
                ok: true
            });
        } else if (result.outcome === 'countered') {
            lines.push(
                `${party.name} does not close the door. Something would move this and what you `
                + 'put down is not yet it.'
            );
        } else {
            lines.push(`${party.name} says no.`);

            // ── AND WHAT THAT NO COSTS THEM, WHICH IS USUALLY NOTHING ────
            //
            // The gate is categorical and it is the route: declining a
            // proposal is declining a proposal, and houses have to be able to
            // do that constantly without accumulating enemies. What opens an
            // account is a no said to a thing the two of them already made.
            const refused = whatRefusingAMatchTheyAlreadyMadeLeaves({
                route,
                theHouse: {
                    id: party.id,
                    name: party.name,
                    houseId: theirFaction,
                    houseName: theirSect?.name ?? null,
                    alignment: theirSect?.alignment ?? null,
                    ranked: party.party.ranked === true
                },
                theSuitor: {
                    id: cultivator.id,
                    name: cultivator.name,
                    houseId: membership?.sectId ?? null,
                    houseName: mySect?.name ?? null,
                    alignment: mySect?.alignment ?? null,
                    ranked: membership !== null
                },
                ofWhatTheyHad: answer.price.theHeightToReach <= 0
                    ? 0
                    : Math.min(1, answer.price.theBestOnTheTable
                        / Math.max(1, cultivator.realmOrdinal)),
                onDay: Math.floor(run.elapsedDays),
                reach: stick.theirReach
            });
            for (const row of refused?.opens ?? []) {
                const record = createObligation(row);
                writeObligation(this.db as unknown as DatabaseHandle, record);
                calls.push({
                    name: 'engine.whatRefusingAMatchTheyAlreadyMadeLeaves',
                    action: 'propose',
                    summary: `${record.holderId} holds a ${record.severity} ${record.kind} about `
                        + `${record.subjectId}. The two of them had already agreed it, and it was `
                        + 'refused anyway.',
                    ok: true
                });
            }
            if (refused !== null) {
                lines.push(
                    'And it was not a proposal they were turning down. The two of you had it '
                    + 'already, and it was taken away in front of whoever was there.'
                );
            }
            if (stick.is !== 'a negotiation') {
                lines.push(stick.line);
            }
        }
        lines.push(...spent.facts.lines);

        const facts = factsForToolResult(
            `${party.name}, on a match: ${result.outcome}.`, lines
        );
        facts.structure.push(...structure, ...spent.facts.structure);

        return {
            ...spent,
            facts,
            outcome: took ? 'executed' : 'refused',
            calls: [
                {
                    name: 'engine.whatAHouseWouldTakeForAMatch',
                    action: 'propose',
                    summary: `bar ${answer.price.theHeightToReach}, offered `
                        + `${answer.price.theBestOnTheTable}, ${answer.price.why ?? 'price met'}; `
                        + `attempt ${result.outcome} at odds ${result.odds}.`,
                    ok: took
                },
                ...calls,
                ...left.calls,
                ...spent.calls
            ]
        };
    },

    /**
     * How strongly somebody already stands toward anybody who is not the asker.
     *
     * Read off the world's own relationship standings, which are kept for a
     * dozen other reasons, and compared by the caller against the world's own
     * defining bar. Zero where there is no world or no row - honest rather than
     * assumed, and it means the answer falls through to what they want.
     */
    strongestTieAwayFrom(this: GameService, personId: string, notTowardId: string): number {
        const world = this.atHand;
        if (!world) return 0;
        const npc = world.npcs.find(n => n.id === personId);
        if (!npc) return 0;
        let strongest = 0;
        for (const tie of npc.relationships) {
            if (tie.targetId === notTowardId) continue;
            if (tie.standing > strongest) strongest = tie.standing;
        }
        return strongest;
    },

    /**
     * Saying no, and walking out, which are one act at two moments.
     *
     * ONE IMPLEMENTATION FOR EVERYBODY. Nothing below reads which party is
     * played. A player matched by their own house and running from it, and
     * somebody running from a clan that will not marry out, reach the same two
     * functions with the arguments in different positions.
     *
     * Which of the two this is depends on the ledger rather than on the
     * sentence: an open `marriage_pact` held by this cultivator means they are
     * in one, and leaving is what they are doing. With none, they are refusing
     * one that was put to them.
     */
    declineAMatch(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        rawInput: string
    ): Execution {
        const scope = this.scopeFor(cultivator);
        const today = Math.floor(run.elapsedDays);
        const query = (target ?? '').trim();
        const party = query.length >= 2 ? this.partyPutTo(cultivator, query, scope) : null;

        // ── ARE THEY IN ONE? THE LEDGER ANSWERS, NOT THE SENTENCE ────────
        const binding = party
            ? openLedgerBetween(this.repos, cultivator.id, party.id)
                .find(r => r.kind === 'oath' && r.cause === 'marriage_pact'
                    && r.holderId === cultivator.id)
            : undefined;

        if (binding) {
            const rolls = binding.participants.filter(id => id.startsWith('sect-')
                || id.startsWith('court-') || id.startsWith('clan-'));
            const cost = whatLeavingAMatchCosts({
                binding,
                leaverId: cultivator.id,
                leaverName: cultivator.name,
                rollsTheyWereOn: rolls,
                onDay: today
            });

            const written: string[] = [];
            for (const row of [cost.onTheLedger?.reopened, cost.onTheLedger?.opened]) {
                if (!row) continue;
                const record = createObligation(row);
                writeObligation(this.db as unknown as DatabaseHandle, record);
                written.push(`${record.kind} at ${record.severity}, held by ${record.holderId}`);
            }
            writeObligation(
                this.db as unknown as DatabaseHandle,
                settleObligation(binding, {
                    resolution: 'oath_released',
                    onDay: today,
                    byId: cultivator.id,
                    note: 'Not by agreement. They left.'
                })
            );

            const facts = factsForToolResult(
                'You leave it.',
                [
                    'Nothing stops you, and nothing about it is softened. ' + cost.note,
                    ...cost.offTheRolls.map(off => off.whatWasLost),
                    'What you have instead is what anybody has who answers to nobody: no roll, '
                    + 'no house between you and whoever comes looking, and a door that opens on '
                    + 'a word from somebody high enough.'
                ]
            );
            facts.structure.push(
                `Oath ${binding.id} released. Records opened: ${written.join('; ') || 'none'}.`,
                ...cost.offTheRolls.map(off =>
                    `Off ${off.houseId}: lowest door now rung `
                    + `${off.theLowestDoorNowInFrontOfThem ?? 'unknown'}.`)
            );
            return this.freeAction(run, 'decline', facts);
        }

        // ── OR THEY ARE REFUSING SOMEBODY, AND THE PRICE IS WHAT WAS STAKED
        if (!party) {
            return refused('engine.resolveParty', 'decline', factsForRefusal(
                'Refuse whom?',
                'Nobody has put a match to you that the ledger knows of, and you have not named '
                + 'anybody to refuse. '
                + `${this.whoIsAbout(cultivator)}`,
                'No open marriage_pact held by this cultivator and no party resolved. '
                + `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        const membership = this.repos.sects.getMembership(cultivator.id);
        const mySect = membership ? this.repos.sects.getById(membership.sectId) : null;
        const theirFaction = party.party?.factionId ?? null;
        const theirSect = theirFaction ? getSect(theirFaction) : null;

        // What they staked, off the ledger and off the rungs. A word given
        // first is the heavier injury and it is on the record: an open favour
        // this cultivator owes THEM, tagged from an earlier agreement, is the
        // engine's own memory of having said yes.
        const between = openLedgerBetween(this.repos, cultivator.id, party.id);
        const hadBeenToldYes = between.some(r =>
            r.kind === 'oath' && r.cause === 'marriage_pact');
        const staked = {
            theBestOnTheTable: Math.max(
                0,
                ...between
                    .filter(r => r.kind === 'favor' && r.holderId === party.id)
                    .map(() => party.party?.realmOrdinal ?? 0)
            ),
            theyReachTo: party.party?.realmOrdinal ?? 0,
            hadBeenToldYes
        };

        const leaves = whatDecliningSomebodyLeaves({
            declining: {
                id: cultivator.id,
                name: cultivator.name,
                houseId: membership?.sectId ?? null,
                houseName: mySect?.name ?? null,
                alignment: mySect?.alignment ?? null,
                ranked: membership !== null
            },
            asking: {
                id: party.id,
                name: party.name,
                houseId: theirFaction,
                houseName: theirSect?.name ?? null,
                alignment: theirSect?.alignment ?? null,
                ranked: party.party?.ranked === true
            },
            // THE GATE, and it is the route rather than a threshold. A player
            // refusing somebody who had only asked has declined a proposal;
            // one refusing after the two of them agreed has taken away a thing
            // that existed, and the ledger only hears about the second.
            route: hadBeenToldYes ? 'person first' : 'family first',
            staked,
            onDay: today,
            // A house behind somebody is who the account goes to when they
            // cannot carry it themselves. The same read the reprisal layer
            // makes, and nothing about a match changes it.
            reach: membership !== null ? 'answerable' : 'unbacked',
            description: rawInput.slice(0, 300)
        });

        const written: string[] = [];
        for (const row of leaves.left?.opens ?? []) {
            const record = createObligation(row);
            writeObligation(this.db as unknown as DatabaseHandle, record);
            written.push(`${record.kind} at ${record.severity}, held by ${record.holderId}`);
        }

        const facts = factsForToolResult(
            `You refuse ${party.name}.`,
            [
                `You say no. ${leaves.note}`,
                leaves.left === null
                    ? 'Nothing was put down and no word had been given, so there is nothing for '
                      + 'anybody to hold against you. A refusal that costs nothing is still a '
                      + 'refusal.'
                    : 'They had something riding on it, and being told no in front of whoever '
                      + 'was there is a thing that happened to them rather than a thing that '
                      + 'did not.'
            ]
        );
        facts.structure.push(
            `Staked: ${Math.round(leaves.ofWhatTheyHad * 100)} in a hundred of what they had; `
            + `word given first = ${hadBeenToldYes}.`,
            `Records opened: ${written.join('; ') || 'none'}.`
        );
        this.noteEncounter(cultivator, run, party, 'witnessed', 'Refused a match.');
        return this.freeAction(run, 'decline', facts);
    },

    /**
     * Having a child, and placing one.
     *
     * ── THE VERB IS THE DECISION AND NOT A NEW CLOCK ─────────────────────
     *
     * A decade spent raising somebody is a decade not spent cultivating, and
     * the time skip already charges for time. Nothing here invents a second
     * clock, adds a penalty, or writes a rung: `birth.ts`'s first contract rule
     * is that an origin buys inputs and never rank, and a child of a match is
     * subject to it like anybody else.
     *
     * ── AND `place` IS THE FAVOUR REACHING A PLAYER FOR THE FIRST TIME ───
     *
     * `spendAWord` has written the obligation a placer carries since it was
     * written, the world uses it for NPCs, and no player has ever been able to
     * spend one. It is the whole road for somebody with no house, and it is
     * finite: a word spent here is a word not spent on their own advancement.
     */
    async haveAChild(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        days: number | undefined,
        intent: string
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        const today = Math.floor(run.elapsedDays);
        const query = (target ?? '').trim();

        if (intent === 'place') {
            return this.placeAChild(run, cultivator, query, scope);
        }

        // ── THE OTHER PARENT ─────────────────────────────────────────────
        const party = query.length >= 2 ? this.partyPutTo(cultivator, query, scope) : null;
        if (!party || party.kind !== 'cultivator' || !party.party) {
            return refused('engine.resolveParty', 'child', factsForRefusal(
                'With whom?',
                'A child has two parents and you have named one. Say who the other is. '
                + `${this.whoIsAbout(cultivator)}`,
                'Unresolved party: child with no other parent named. '
                + `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        const tie = tieFrom(this.repos, cultivator.id, party.id);
        const mine = this.asAPartyToAMatch(cultivator);
        const other: APartyToAMatch = {
            personId: party.id,
            reachesTo: party.party.realmOrdinal ?? 0,
            carriesTheLineAt: null,
            houseId: party.party.factionId ?? null,
            onTheRoll: rollFor(party.party.factionId ?? null, party.party.ranked === true)
        };

        const years = Math.max(1, Math.round((days ?? YEARS_BEFORE_A_CHILD_CAN_BE_PLACED * 365) / 365));
        const cost = whatAChildCosts({ one: mine, other, years });
        const child = whatTheChildIs({ one: mine, other });

        // ── THE YEARS, SPENT THE WAY EVERY OTHER STRETCH IS SPENT ────────
        const spent = await this.shortSkip(
            run, cultivator, ambient, RAISING_FOCUS,
            `Raising a child with ${party.name}`, years * 365
        );

        // The child gets an identity the ledger, the lineage code and the
        // grudge inheritance can all see. Derived from the two parents and the
        // day, so it is reproducible from the seed like everything else.
        const childId = `child_${cultivator.id}_${party.id}_${today}`;
        recordTheTieAnAttemptLeft(
            this.repos, cultivator.id, childId, today,
            {
                theirs: {
                    type: 'parent', strength: 0.9, significance: 'defining',
                    roles: ['raised_them']
                },
                yours: {
                    type: 'child', strength: 0.9, significance: 'defining',
                    roles: ['theirs']
                },
                event: { onDay: today, kind: 'birth', summary: child.note }
            }
        );

        // ── THE YEARS ARE THE PRICE, AND THEY HAVE TO SURVIVE THE NARRATOR ──
        //
        // Played in the browser against a local model:
        //
        //   > Gu Peiyan and I have a child together
        //   "You spent fifty days in a quiet room, breathing in the hollow air,
        //    waiting for a response to your claim about Gu Peiyan. No answer
        //    came. The hunger arrived with the silence..."
        //
        // Fifty days gone, the rations gone, starvation begun, and the prose
        // read as though nothing had happened. Both halves of that were this
        // composer's doing. The sentence a player cannot play without - THIS
        // MANY YEARS ARE ABOUT TO GO - was one line in the middle of a digest,
        // and `spent.facts.required`, which carries the starvation and the
        // death verbatim so a model cannot drop them, was thrown away
        // wholesale. Exactly the omission `b22bf98` fixed for forage and
        // travel, on the most expensive verb in the game: a default child is
        // sixteen years, which is longer than any other single turn a player
        // can take.
        //
        // ── AND THE SAME PARAGRAPH WAS A DUMP IN TWO OTHER WAYS ──────────
        //
        // Both found in the same played turn, and both are this composer
        // shipping a channel that was never meant for a reader:
        //
        //   "12 years, which is about 12 in a hundred of a whole life at
        //    6fd9935f-ee10-4184-ad6b-2dc0d0f320d4's rung and about 12 in a
        //    hundred at npc-100's."
        //
        // `whatAChildCosts` is a pure engine function with no names in front
        // of it, so its `note` says the two ids because ids are all it has.
        // That note belongs on the structure channel, where an id is exactly
        // the right word, and the player gets the same arithmetic said with
        // the two people's names in it - which this layer holds and the
        // engine does not.
        //
        //   "1.1 years was asked for; 30 days passed before something returned
        //    control. The engine stopped the skip: starvation begun. Net
        //    change: 0 progress, 0 ranks, 0 HP, 0 spirit stones..."
        //
        // That is `spent.facts.LINES` - the engine channel - joined into the
        // player's prose, because `factsForToolResult` composes its prose out
        // of whatever it is handed. The span already has a written account of
        // itself in `spent.facts.prose`, and that is what a reader gets;
        // `lines` still carries the same facts for a narrator that wants them.
        const theSpan =
            `${years} year${years === 1 ? '' : 's'} of your own life went into it, and they are `
            + 'years nobody was cultivating.';
        const shares =
            `That is ${shareOfALife(cost.toEachOfThem[0].ofAWholeLifeAtTheirRung)} of a `
            + `whole life at ${cultivator.name}'s rung, and `
            + `${shareOfALife(cost.toEachOfThem[1].ofAWholeLifeAtTheirRung)} at `
            + `${party.name}'s.`;

        const said = [
            `${theSpan} ${shares}`,
            child.note,
            'Nothing about them is settled by it. They stand at no rung, on nobody\'s ladder, '
            + 'and what they become is what somebody spends on them.'
        ];

        const facts = factsForToolResult(
            `A child, with ${party.name}.`,
            [...said, ...spent.facts.lines],
            [...said, spent.facts.prose].join('\n\n')
        );
        facts.required = [theSpan, ...(spent.facts.required ?? [])];
        facts.structure.push(
            cost.note,
            `Years: ${years}. To ${cultivator.name}: `
            + `${cost.toEachOfThem[0].ofAWholeLifeAtTheirRung.toFixed(4)} of a whole life at `
            + `rung ${mine.reachesTo}. To ${party.name}: `
            + `${cost.toEachOfThem[1].ofAWholeLifeAtTheirRung.toFixed(4)} at rung `
            + `${other.reachesTo}.`,
            `Rolls: ${child.rolls.map(r => r.houseId).join(', ') || 'none'}. Line: `
            + `${child.theLineTheyCarry ?? 'none'}. Tie to ${party.name} before this: `
            + `${tie ? `${tie.type} at ${round2(tie.strength)}` : 'none recorded'}.`,
            ...spent.facts.structure
        );

        return {
            ...spent,
            facts,
            outcome: 'executed',
            calls: [
                {
                    name: 'engine.whatAChildCosts',
                    action: 'child',
                    summary: `${years} years spent. ${child.note}`,
                    ok: true
                },
                ...spent.calls
            ]
        };
    },

    /**
     * A word spent on a door, which is what a name is actually worth.
     *
     * `spendAWord` decides all of it and none of it is reimplemented here: the
     * house's own stance, whether there is a bar to skip at all, the receipt
     * the person asked now holds, and who is told.
     */
    placeAChild(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        query: string,
        scope: KnowledgeScope
    ): Execution {
        const today = Math.floor(run.elapsedDays);
        if (query.length < 2) {
            return refused('engine.resolveParty', 'child', factsForRefusal(
                'Placed where?',
                'A child is placed at a house, on somebody\'s word. Name the house.',
                'Unresolved house: child/place with no house named.'
            ));
        }

        const party = this.partyPutTo(cultivator, query, scope);
        const houseId = party?.kind === 'sect'
            ? party.id
            : party?.party?.factionId ?? null;
        if (!houseId) {
            return this.nobodyByThatName(cultivator, query, scope, 'child');
        }

        // A favour runs through a person and never through an institution. With
        // nobody named, the person asked is whoever this cultivator actually
        // knows there - and with nobody known, there is no favour to spend,
        // only a letter.
        const askedOfId = party?.kind === 'cultivator' ? party.id : null;
        if (askedOfId === null) {
            return refused('engine.spendAWord', 'child', factsForRefusal(
                'A word runs through a person.',
                `Nobody writes to ${query} about a child. A favour is one person asking another, `
                + 'so name somebody there who would take the asking - and if you do not know '
                + 'anybody there, that is the thing standing in the way rather than the bar.',
                'spendAWord requires askedOfId; a faction is not a party to a favour.'
            ));
        }

        const result = spendAWord({
            askerId: cultivator.id,
            // The child by the id the household tie already carries. A player
            // with no child has nothing to place, and the refusal says so.
            childId: `child_of_${cultivator.id}`,
            houseId,
            askedOfId,
            onDay: today,
            childOrdinal: 0
        });

        if (!wasPlaced(result)) {
            const stance = favourStanceOf(houseId);
            return refused('engine.spendAWord', 'child', factsForRefusal(
                'The word buys nothing here.',
                stance?.why
                    ?? 'There is nothing at this door for a word to move, and asking anyway '
                       + 'spends something for nothing.',
                `spendAWord refused: ${result}.`
            ));
        }

        writeObligation(this.db as unknown as DatabaseHandle, result.obligation);
        recordTheTieAnAttemptLeft(
            this.repos, cultivator.id, askedOfId, today,
            {
                theirs: {
                    type: 'patron', strength: 0.6, significance: 'defining',
                    roles: ['took_a_child_in']
                },
                yours: {
                    type: result.tie.type, strength: result.tie.strength,
                    significance: 'defining', roles: [...result.tie.roles]
                },
                event: {
                    onDay: today, kind: 'placement',
                    summary: result.obligation.description
                }
            }
        );

        const facts = factsForToolResult(
            `Placed, on a word to ${party?.name ?? askedOfId}.`,
            [
                `You ask, personally, and the bar comes down for one person once. The child is `
                + `on ${houseId}'s roll at the bottom of it, on no rung, having met nothing.`,
                'What it cost is not stones. You owe somebody, the amount was never named, and '
                + 'an unnamed debt does not end the way a price does.',
                'And it is a gamble rather than a gift: a child placed above what they turn out '
                + 'to be does not come home.'
            ]
        );
        facts.structure.push(
            `spendAWord: house ${houseId}, asked of ${askedOfId}, favour `
            + `${result.obligation.severity} written to ${result.obligation.holderId}.`
        );
        return this.freeAction(run, 'child', facts);
    }
};
