/**
 * Asking somebody for something, and what saying yes would cost them.
 *
 * The verb the design rests on. There are exactly two ways past a manual's
 * ceiling - another book, or somebody willing to teach you - and until
 * `request` existed the book half worked and the teacher half reached four
 * different lookups, none of which was a person.
 *
 * Three channels onto one resolver, which is why they are one module rather
 * than three. `request` is the ask; `demandOf` is an ask with weight behind it
 * and no resolver of its own, reading the ordinary ask for its verdict before
 * handing the whole thing to `resolveAttempt`; `whatWouldItTake` is the same
 * arithmetic stopped at the roll, so "could I ask her to teach me" answers
 * with the real number rather than a description of it. They cannot drift
 * because there is nothing to drift from.
 *
 * Four rules the module keeps, all of them older than this file:
 *
 * - The ask is DERIVED, never asserted. Whether teaching somebody an art is an
 *   afternoon or the end of their standing is a fact about the book and the
 *   house, and nothing reads the word the player typed - bribing, begging and
 *   asking politely produce the same weight for the same thing.
 * - Money is priced by the line the catalog already draws, so a purse buys an
 *   introduction and does not buy a house's canon.
 * - A take changes a row. Being taught still meets the manual's own entry
 *   requirement, because being favoured does not lift it.
 * - A refusal names what would work. Every one, without exception. "No" is a
 *   bug.
 *
 * ── HOW THIS IS ATTACHED ────────────────────────────────────
 *
 * `GameService` methods living in another file, merged onto the prototype at
 * the bottom of `game.ts` with their signatures merged into the class
 * declaration. `this.request(...)` resolves and typechecks exactly as it did
 * when the bodies sat in the class, and every line below is the line it was.
 * `src/web/README.md` has the argument and the warning about `private`.
 */

import { getSect } from '../data/cultivation/index.js';
import { transmissionsBy } from '../data/cultivation/techniques.js';
import { earningsPerYear } from '../engine/cultivation/origin.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    type AskWeight,
    howTheyHoldWhatTheyHave,
    oddsOf,
    openHandednessOf,
    resolveAttempt,
    whatTheyDoAboutBeingWronged
} from '../engine/social-leverage/index.js';
import { whatItWasWorth } from '../engine/social-leverage/what-a-deed-leaves.js';
import {
    theGroundUnderYou,
    type TheGroundUnderYou
} from '../engine/social-leverage/ground-trust.js';
import {
    type OnTheTable,
    howHeavyThisAskIs,
    howTheyAreHoldingIt,
    whatItWouldTake
} from '../engine/social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell.js';
import { createObligation, severityRank } from '../engine/social/grudges.js';
import {
    selfFactFromTopic,
    whatTheySayAboutThemselves
} from '../engine/social/what-somebody-knows-about-themselves.js';
import {
    catalogPersonBehind,
    theOneIdAPersonIsKnownBy
} from '../engine/world/a-catalog-person-and-their-world-row.js';
import { whoHoldsTheGround } from '../engine/world/ground-holder.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { statusesInArea } from '../engine/world/what-is-true-of-a-place-right-now.js';
import { transferPossession } from '../engine/world/possessions.js';
import {
    type SomebodyWithGoals,
    type TheClocksSomebodyIsUnder,
    aWantThatCannotWait,
    goalsHeldBy,
    whatTheirNeedDoesToThePriceOf
} from '../engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import type {
    AmbientQi,
    ApproachLeverage,
    Cultivator,
    Run,
    SectAlignment
} from '../schema/cultivation.js';
import { addToPouch, readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { theRollLands } from '../server/consolidated/forcing-an-attempt-to-land.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { ActionName } from './actions.js';
import { askedAbout } from './asked.js';
import {
    type DatabaseHandle,
    openLedgerBetween,
    tieFrom,
    writeObligation
} from './encounters.js';
import {
    type KnowledgeScope,
    type ResolvedEntity,
    resolveAnything,
    resolveCultivator,
    resolvePill,
    resolveTechnique
} from './entities.js';
import {
    type EngineFacts,
    factsForAttempt,
    factsForRefusal,
    factsForRequest,
    factsForToolResult,
    factsForWeighingARequest,
    nearlyGone,
    placeName,
    sayThisWhateverTheNarratorDoes,
    theBodyIsNearlyGone
} from './facts.js';
import type { Hearing } from './hearsay.js';
import {
    WHAT_A_BARE_DEMAND_IS_BACKED_BY,
    WHAT_A_WITHHELD_ANSWER_WEIGHS,
    type WhatStandsInTheWay,
    nothingToBeGotFrom,
    whatLeaningOnThemCost,
    whatStandsInTheWay
} from './making-somebody-tell-you.js';
import { whatTheAskCameTo } from './saying-what-an-ask-cost-and-how-likely-it-was.js';
import { addHearing, refused, stonesNamedIn, structureCalls } from './tool-result-prose.js';
import { TRAVEL_FOCUS, WRONG_BEHIND_INTENT } from './turn-constants.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import {
    heldByTheirHouse,
    howHighTheirHouseReaches,
    theThingAskedFor,
    whatIsBeingPutDown
} from './what-a-holder-would-take-for-it.js';
import { type RequestKind, requestPutToSomebody } from './what-a-request-asks-and-of-whom.js';
import {
    type TheOneAsking,
    type TheOneBeingAsked,
    whatItWouldCostThem
} from './what-asking-this-person-for-this-would-cost-them.js';
import {
    factsForSomebodyWhoWillNotSay,
    factsForSomebodyWithNoOpenBusiness,
    factsForWhatTheyAreAfter
} from './what-somebody-is-after.js';
import type { GameService } from './turn-engine.js';

/**
 * How heavy the thing being asked for is, from the player's own sentence.
 *
 * `AskWeight` is what the resolver prices resistance and duration off, and it
 * must come from what was asked rather than from the verb: bribing somebody for
 * directions and bribing them to open their house's vault are the same verb and
 * are not the same ask.
 *
 * Defaults to `a_courtesy`, which is the forgiving direction. Reading a
 * betrayal into a sentence that asked for directions would price an afternoon
 * as a season and a half, and the cost of being wrong the other way is that an
 * attempt is cheaper than it should have been.
 */
function askWeightOf(text: string): AskWeight {
    const said = text.toLowerCase();
    if (/\b(?:betray|turn on|sell out|inform on|give (?:me )?(?:up|them up)|open the (?:vault|reserves|treasury)|hand over the|let me in(?:to)? the (?:vault|treasury|reserves)|denounce)\b/.test(said)) {
        return 'a_betrayal';
    }
    if (/\b(?:against (?:his|her|their) (?:own )?interest|lie for me|cover for me|break (?:the )?(?:rule|rules|oath)|risk (?:his|her|their)|take the blame|falsify|forge)\b/.test(said)) {
        return 'against_their_interest';
    }
    if (/\b(?:lend|loan|give me|hand me|spare me|pay for|put in a word|vouch for|introduce me to|teach me|train me|escort|come with me|fight|help me)\b/.test(said)) {
        return 'a_real_favour';
    }
    return 'a_courtesy';
}

/**
 * The request kinds a plan may name. Anything else falls to the cheapest
 * reading, which is the rule every other intent-carrying action here obeys.
 */
const REQUEST_KINDS: ReadonlySet<string> = new Set<RequestKind>([
    'teaching', 'discipleship', 'introduction', 'telling', 'a_thing', 'nothing',
    // The price asked before it is paid, and the thing put down for it. Both
    // reach `whatWouldItTake` below rather than the ordinary request path,
    // because the ordinary path ends at `interact` for anything that is not an
    // art - which is where every barter-tier object in the catalog used to
    // stop.
    'terms', 'a_trade'
]);

/**
 * How many times this cultivator has already put a request to somebody.
 *
 * Per pair, and it is what stops six identical refusals in a row. The state was
 * changing under all six - a refusal writes a record and the next attempt reads
 * it - and the text did not know, which reads as a broken loop rather than as a
 * person saying no again. The same defect was fixed in the wound warning
 * earlier, and the fix is the same: let the text know what the state knows.
 */
const askedBeforeKey = (personId: string, kind: string): string => `asked:${kind}:${personId}`;

/**
 * The ground the two of them are standing on, priced for whether a stranger is
 * believed on it.
 *
 * The design owner's ruling that trust depends on WHERE YOU ARE. The world
 * simulation has filled `AttemptInput.where` at both of its `resolveAttempt`
 * calls since the term landed, and the PLAYED calls did not - so every
 * manoeuvre any NPC ran on any other was priced on its ground and every
 * manoeuvre the player ran was priced nowhere. That is this repository's
 * commonest defect with the arms reversed, and it is one function rather than
 * three copies for the obvious reason.
 *
 * Null is a real answer and weighs nothing: it means the caller does not know
 * where this is happening, which is not the same as ground nobody holds. See
 * `GroundHolding`, where the four ways of having no holder are four rows.
 *
 * The statuses are read on the WORLD clock rather than the run's, because a
 * famine is dated in the world and `run.elapsedDays` is a different number.
 */
function theGroundBetweenThem(
    world: { locations: Parameters<typeof whoHoldsTheGround>[0]; statuses: Parameters<typeof statusesInArea>[0]; currentDay: number } | null,
    locationId: string | null
): TheGroundUnderYou | null {
    if (!world || !locationId) return null;
    const day = Math.floor(world.currentDay);
    return theGroundUnderYou(
        whoHoldsTheGround(world.locations, locationId),
        statusesInArea(world.statuses, world.locations, locationId, day)
    );
}

export const askingVerbs = {
    /**
     * An attempt to move somebody, resolved rather than described.
     *
     * `engine/social-leverage/` has been finished and unreachable: a pressure
     * model with four outcomes - taken, refused, reported, turned - tone,
     * leverage, audience, concealment, patience, alignment-dependent fallout
     * and delayed discovery, with 34 passing tests and no player route into it.
     * NPCs ran it on each other while "I bribe the gate guard" came back "they
     * look at you the way people look at a sentence with a hole in it".
     *
     * Three things this has to get right, all learned elsewhere the hard way:
     *
     *   THE DAYS REACH THE CLOCK. An attempt that costs nothing is not play,
     *   and `result.days` is the engine's own figure for what it took.
     *   THE TERMS REACH THE INSPECTOR. `result.terms` is the only thing that
     *   will ever reveal that a term has gone wrong.
     *   THE OUTCOME REACHES THE PROSE. A `turned` result coming back as "It is
     *   done. Nothing about it drew attention." is the invisible-fallback
     *   failure this codebase has now had four times.
     *
     * The ask is read from the player's sentence and defaults to `a_courtesy`,
     * which is the forgiving direction: assuming somebody asked for a betrayal
     * when they asked for directions would price an afternoon as a season.
     */
    /**
     * A demand for something somebody knows, resolved by standing.
     *
     * The third discovery channel and the shortest method in it, which is the
     * point: **there is no resolver here.** `resolveAttempt` prices the gap in
     * standing, the charm, the tie, what is owed your way, what they want from
     * you, the audience and how freely this particular person parts with
     * anything, and that list IS the ruling - "either via power or something
     * else", where the something else is most of the arithmetic.
     *
     * What this adds is the one thing the resolver cannot know: whether there
     * was anything to be got in the first place. An ordinary ask is run first,
     * unpressed, purely to read which of `asking.md`'s three limits is in the
     * way - and a demand that runs into limit one is refused before anybody's
     * day is spent, because standing moves what a person will SAY and never
     * what they hold.
     */
    async demandOf(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        party: ResolvedEntity,
        who: RosterEntry,
        intent: string,
        leverage: ApproachLeverage | undefined,
        topic: string,
        rawInput: string,
        scope: KnowledgeScope
    ): Promise<Execution> {
        // The unpressed reading, taken for its verdict and thrown away. Nothing
        // is written by it: `askedAbout` is pure, and the record-writing half of
        // `askAround` is not reached until the demand has actually resolved.
        const subject = resolveAnything(this.repos, topic, cultivator, scope);
        // The same reading `askAround` takes, and it has to be the same one: a
        // demand for somebody's own name that was refused at limit one here
        // would be refused for a reason that does not exist, while the polite
        // ask two lines away answered it.
        const ownFact = selfFactFromTopic(topic);
        const unpressed = askedAbout({
            asker: cultivator,
            asked: who,
            speakerName: this.knowledge.isAwareOf(cultivator.id, 'cultivator', who.id)
                ? who.name
                : null,
            subject,
            rawTopic: topic,
            aboutThemselves: ownFact === null
                ? null
                : whatTheySayAboutThemselves(ownFact, {
                    name: who.name,
                    age: who.age,
                    sex: who.sex,
                    houseName: who.sectName,
                    rankName: who.sectRank
                }),
            holdsIt: subject !== null
                && (subject.kind === 'cultivator' || subject.kind === 'sect' || subject.kind === 'place')
                && this.knowledge.isAwareOf(who.id, subject.kind, subject.id),
            priorDealings: this.dealingsWith(cultivator, who.id)
        });

        const standing = whatStandsInTheWay(unpressed);
        if (standing === 'they_do_not_know') {
            const copy = nothingToBeGotFrom(party.name, subject?.name ?? topic);
            return refused('engine.askedAbout', 'interact', factsForRefusal(
                copy.headline, copy.prose, copy.structure
            ));
        }

        // What is behind it, when the sentence named nothing. A demand with
        // nothing else on the table is backed by the asker's own name, which is
        // both the honest reading and the ruling's own first half. See the
        // constant: this was measured going in at `none` and the standing term
        // was doing nothing at all.
        return this.pressSomebody(
            run, cultivator, ambient, party, intent,
            leverage ?? WHAT_A_BARE_DEMAND_IS_BACKED_BY,
            rawInput, null,
            { who, topic, scope, standing }
        );
    },

    async pressSomebody(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        party: ResolvedEntity,
        intent: string,
        leverage: ApproachLeverage | undefined,
        rawInput: string,
        spoken: Hearing | null,
        /**
         * Present when what is being demanded is an ANSWER.
         *
         * The whole of what makes a demand a demand rather than a second verb:
         * it changes what the ask weighs and it gives the landed attempt
         * something to actually hand over. Everything else on this path - the
         * resolver, the days, the stones, the marks - is identical.
         */
        demand?: {
            who: RosterEntry;
            topic: string;
            scope: KnowledgeScope;
            standing: WhatStandsInTheWay;
        }
    ): Promise<Execution> {
        // What the ask weighs. A name somebody is sitting on is not a courtesy,
        // whatever the sentence around it looked like - and the constant is
        // read here rather than off the player's wording on purpose, because a
        // price that moves with the phrasing is a price you can talk your way
        // out of. See `making-somebody-tell-you.ts`.
        const asked = demand ? WHAT_A_WITHHELD_ANSWER_WEIGHS : askWeightOf(rawInput);
        const them = party.party!;
        const membership = this.repos.sects.getMembership(cultivator.id);
        const mySect = membership ? this.repos.sects.getById(membership.sectId) : null;
        const theirSect = them.factionId ? getSect(them.factionId) : null;

        // ── A BRIBE IS A NUMBER ──────────────────────────────────────────
        //
        // Measured in play: "I bribe Kong Kelin" came back "Kong Kelin agreed.
        // It was taken." with the purse at 6043 before and 6043 after. Nothing
        // was named, nothing was priced, nothing moved. That is the softening
        // the agency rule forbids and it is the invisible kind - the player
        // believes they spent something.
        //
        // The resolver's own contract has carried `stonesOffered` from the
        // start, documented as "spirit stones actually put down. Only spent
        // when the attempt lands", and this caller never filled it. So the sum
        // comes off the player's own sentence, which is where it belongs: what
        // somebody is willing to put down is a decision and not a derivation,
        // and an engine that picked a figure would be choosing for them.
        //
        // Not banning. A coin approach with no sum in it is a sentence with a
        // hole in it, and the refusal names the hole and the purse rather than
        // shrugging - the same shape as every other guiding refusal here.
        const offered = leverage === 'coin' ? stonesNamedIn(rawInput) : null;
        if (leverage === 'coin' && offered === null) {
            return refused('engine.resolveAttempt', 'interact', factsForRefusal(
                'You did not say how much.',
                `You get as far as suggesting there is money in it and then find you have not `
                + `decided on a figure, which ${party.name} notices before you do. A bribe is a `
                + `number said out loud. You are carrying ${cultivator.spiritStones} spirit `
                + 'stones; say what you are putting down.',
                `Coin leverage with no sum in the sentence. resolveAttempt.stonesOffered is `
                + '"spirit stones actually put down"; without one the attempt would resolve at '
                + 'full odds and charge nothing, which is what it did for as long as this '
                + 'caller left the field unset.'
            ));
        }
        if (offered !== null && offered > cultivator.spiritStones) {
            return refused('engine.resolveAttempt', 'interact', factsForRefusal(
                'You do not have it.',
                `The figure is out of your mouth before you have counted it. You said ${offered} `
                + `and you are carrying ${cultivator.spiritStones}, which leaves you `
                + `${offered - cultivator.spiritStones} short of what you have just promised. `
                + `${party.name} waits for the rest of it and then stops waiting.`,
                `Offered ${offered} against a purse of ${cultivator.spiritStones}. Refused before `
                + 'the resolver, so no days were spent and no mark was written.'
            ));
        }

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
                ordinal: them.realmOrdinal,
                ...(them.charm === undefined ? {} : { charm: them.charm }),
                factionId: them.factionId,
                alignment: theirSect?.alignment ?? null,
                ranked: them.ranked
            },
            onDay: Math.floor(run.elapsedDays),
            // The same three terms `request` supplies, for the same reason: a
            // bribe from somebody who has done you a favour is not the same
            // sentence as a bribe from a stranger, and until these were passed
            // the engine could not tell the two apart.
            theirTie: tieFrom(this.repos, party.id, cultivator.id),
            yourTie: tieFrom(this.repos, cultivator.id, party.id),
            ledger: openLedgerBetween(this.repos, cultivator.id, party.id),
            // WHERE THIS IS HAPPENING. A term and never a gate, damped by
            // whatever tie the subject already holds, because the ruling is
            // about the same STRANGER saying the same thing.
            //
            // The world simulation reads the SUBJECT's ground, because the
            // approach goes to them. Here it is the player's, and the two are
            // the same square by construction - somebody has to be present to
            // be pressed - so this is the same rule and not a second one.
            // Resolving the subject's own world row instead would be the
            // mistake `the-player-as-a-row-the-world-can-invite.ts` names:
            // presence belongs to the play layer.
            where: theGroundBetweenThem(this.atHand, this.worldPlaceOf(cultivator)),
            // And the fourth, which was the last term with no caller at all.
            theyWantSomethingFromYou: this.whatTheyWantOfYou(cultivator, party.id) !== null,
            ask: asked,
            ...(offered === null ? {} : { stonesOffered: offered }),
            approach: {
                // The player's own words, recorded and echoed, never parsed for
                // an outcome. `leverage` is what the resolver actually reads.
                intent: rawInput.slice(0, 400),
                ...(leverage ? { leverage } : {})
            },
            // The row id is a randomUUID; keying on it would make the run
            // irreproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rng: forStream(run.seed, 'social_leverage', Math.floor(run.elapsedDays), party.id)
        });

        // AND THE MONEY IS REAL. The resolver's contract is that stones are
        // spent only when the attempt LANDS - somebody who refuses you does not
        // keep the purse - so this is the one write and it is on `stonesSpent`
        // rather than on what was offered, because those two are the same
        // number only on a take and the resolver owns the difference.
        if (result.stonesSpent > 0) {
            this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -result.stonesSpent });
        }

        // THE DAYS ARE REAL. Pressing somebody for a betrayal is a season and a
        // half of work, and an attempt that costs no time is not a decision.
        // Run through `shortSkip` rather than by adding to a counter, so the
        // food, the world and the bleed clock all move the way they move for
        // every other span in the game.
        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Pressing ${party.name}`, result.days
        );

        // What this attempt WAS, when it was a wrong, read off the one closed
        // table that decides it. Handed to both halves - the records the
        // attempt leaves, and what the other party does about it - so a threat
        // cannot be a wrong to one of them and an arrangement to the other.
        const wrong = WRONG_BEHIND_INTENT[intent] ?? null;

        // ── AND A THEFT TAKES SOMETHING ──────────────────────────────────
        //
        // Before the resolver's consequences are read, because everything
        // downstream is priced off what it cost them: the reprisal, the weight
        // of the grudge, and whether their house ends up carrying it.
        const lifted = wrong === 'robbed'
            && (result.outcome === 'taken' || result.outcome === 'turned')
            ? this.whatALiftTook(cultivator, party)
            : null;

        const marks = this.recordWhatTheAskLeft(
            run, cultivator, party, result, 'interact', true, wrong
        ).calls;

        // ── HOW MANY TIMES THEY HAVE HAD THIS FROM YOU ───────────────────
        //
        // `request` has counted this since it was written and this path never
        // did, so `factsForAttempt` was handed a hardcoded zero and printed
        // "and this was the first try" on every attempt for ever. Played: three
        // thefts off one person, the odds correctly falling 5% -> 2% as the
        // grudge landed, all three reported as the first.
        //
        // The same key shape `request` uses - the person AND what was put to
        // them - because "they have heard this from you before" is a claim
        // about the thing being attempted. Somebody who has been bribed twice
        // has not been robbed before.
        //
        // Read before the count is written, and written whether or not it came
        // off: an attempt they caught is an attempt they remember.
        const triedKey = askedBeforeKey(party.id, intent);
        const priorTries = Number(readFlag(this.db, cultivator.id, triedKey) ?? '0');
        writeFlag(this.db, cultivator.id, triedKey, String(priorTries + 1));

        const facts = factsForAttempt(
            party.name, intent, result, party.facts, wrong, priorTries
        );

        // ── AND THEN THEY DO SOMETHING ABOUT IT ──────────────────────────
        //
        // Measured in play, and it is the reason this call exists: a player
        // stood in front of a Void Refinement stranger, threatened them and
        // robbed them, and BOTH LANDED - and the only record either left was a
        // social TIE, which is what this engine writes for people who are
        // getting on. Coercion registered as relationship-building.
        //
        // The reprisal is decided AFTER the attempt and reads only what the
        // resolver already decided, so nothing here re-prices the ask and
        // nothing branches on the player's wording. See
        // `what-somebody-does-about-being-wronged.ts` for why it is the lesser
        // of what they can do and what they would do, floored at a warning.
        const reprisal = await this.whatTheWrongedPartyDid(
            run, cultivator, party, intent,
            // `turned` is a landing too - they did it AND took hold of you -
            // and it has to read as one here, or the reprisal weighs the deed
            // as merely attempted while `recordWhatTheAskLeft` withholds the
            // arrangement records for a deed that came off.
            result.outcome === 'taken' || result.outcome === 'turned',
            them.realmOrdinal, theirSect?.alignment ?? null, facts, lifted
        );
        if (spoken) addHearing(facts, spoken);
        // Whatever the answering half of a demand did, on the engine channel.
        const demandCalls: ToolCallRecord[] = [];

        // ── AND WHAT, EXACTLY, DID THEY AGREE TO ─────────────────────────
        //
        // Measured: `I bribe Han Peiru with 60 spirit stones` came back "Han
        // Peiru agreed." - agreed to WHAT, and nothing followed. The resolver
        // is right not to know; it prices the weight of an ask and must never
        // read the player's verb. What was missing is that the sentence never
        // said. `request` is the verb that carries an object, so a sentence
        // that reaches HERE is one that put something on the table and named
        // nothing to spend it on, and the honest answer is to say so and say
        // what the sentence with an object looks like.
        //
        // A line and not a refusal. `AGENTS.md` forbids the removed verb: the
        // approach still happens, the stones still move, and what is added is
        // the thing the player needs in order to ask for something next time.
        //
        // A demand takes neither branch: something WAS named, and what was
        // named was an answer. What follows is the answer being handed over, or
        // not, plus the sentence that makes leaning on somebody a different
        // event from asking them.
        if (demand) {
            // The ordinary ask, run for real this time, with `compelled` set
            // off what the resolver decided. Everything downstream is the
            // untouched asking path - the knowledge write, the name that falls
            // out of the answer, the stranger who introduced themselves by
            // replying - so a compelled answer deposits exactly what a
            // volunteered one does and by exactly the same route.
            const carried = result.outcome === 'taken' || result.outcome === 'turned';
            const answered = this.askAround(
                run, cultivator, demand.who, demand.topic, demand.scope, carried
            );
            const cost = whatLeaningOnThemCost(party.name, demand.standing, result);

            const said = [...answered.facts.lines, ...cost.lines];
            facts.lines.push(...said);
            facts.prose = [facts.prose, ...said].join('\n\n');
            facts.structure.push(...answered.facts.structure, ...cost.structure);
            demandCalls.push(...answered.calls);
        }
        // ── AND WHAT A TAKING DID NOT MOVE ───────────────────────────────
        //
        // Said plainly rather than left to the hint below, which offers the
        // player the three shapes of a REQUEST - be taught, be introduced, be
        // taken as a disciple - and is exactly the wrong prompt to end a
        // robbery on. It is also the honest state of the engine: the attempt
        // resolves, the reprisal lands and the ledger is written, and no goods
        // move, because nothing in this layer takes an object off a person.
        // `AGENTS.md`: "the engine has no answer for this yet" is a legitimate
        // sentence, and it is a better one than a hint that reads like a menu.
        if (!demand && wrong !== null) {
            const took = lifted === null
                ? `Nothing came away in a hand. The world has what was done written down and `
                  + `${party.name} is carrying it; what they were holding is still theirs.`
                : lifted.taken === 0
                    ? `${party.name} was carrying nothing worth the trouble, and that is the whole `
                      + 'of what came of it - except that they know.'
                    : `${lifted.taken} spirit stones off ${party.name}, out of the `
                      + `${lifted.hadBefore} they were carrying. It is in your own purse now, `
                      + 'with nothing in the ledger to say it was ever theirs.';
            facts.lines.push(took);
            facts.prose = `${facts.prose}\n\n${took}`;
            facts.structure.push(
                lifted === null
                    ? 'No possession moved. This wrong takes nothing by its nature; what it '
                      + 'leaves is the reprisal and the grudge.'
                    : `Lift: ${lifted.taken} of ${lifted.hadBefore} stones, capped at `
                      + `${lifted.loose} - a year of what somebody at ordinal `
                      + `${them.realmOrdinal} earns, which is what bounds how much money is ON a `
                      + 'person rather than behind a door. Counted stock, moved as a number on '
                      + 'two rows; `transferPossession` is for singular things and is not used '
                      + 'here. No tracked object moved: see `docs/world/things/items.md`.'
            );
        } else if (!demand && requestPutToSomebody(rawInput) === null) {
            const unnamed =
                `Nothing was named to go with it, so what ${party.name} agreed to or refused was `
                + `the approach itself. Asking for a thing is "ask ${party.name} to teach me `
                + `<an art>", "ask ${party.name} to introduce me to <somebody>", or "ask `
                + `${party.name} to take me as a disciple" - and those have outcomes this does `
                + 'not.';
            facts.lines.push(unnamed);
            facts.prose = `${facts.prose}

${unnamed}`;
            facts.structure.push(
                'The sentence put leverage on the table and named no object, so `ask` weighed '
                + 'the approach rather than a request. See `request` and '
                + '`what-a-request-asks-and-of-whom.ts`.'
            );
        }
        // The span's own account underneath the attempt's: what the days cost.
        facts.lines.push(...spent.facts.lines);
        facts.structure.push(...spent.facts.structure);

        const execution: Execution = {
            ...spent,
            facts,
            outcome: result.outcome === 'taken' ? 'executed' : 'refused'
        };
        execution.hearing = spoken;
        execution.calls = [
            {
                name: 'engine.resolveAttempt',
                action: 'interact',
                // Every term, named, and named in words. The only thing that
                // will ever reveal that one of them has gone wrong, and it is
                // worth nothing if the person reading it has to know the field
                // names to see it.
                summary: whatTheAskCameTo({
                    subject: party.name,
                    kind: intent,
                    ask: asked,
                    leverage,
                    odds: result.odds,
                    terms: result.terms,
                    outcome: result.outcome,
                    days: result.days,
                    stonesSpent: result.stonesSpent,
                    priorAsks: priorTries,
                    reachedTheHouse: result.marks.reachedTheHouse
                }),
                ok: result.outcome === 'taken'
            },
            ...structureCalls(party.structure),
            ...spent.calls,
            ...marks,
            ...reprisal,
            ...demandCalls
        ];
        return execution;
    },

    /**
     * What the person on the other end of a coercive attempt does about it.
     *
     * WHICH VERBS REACH THIS, and why it is a lookup rather than a judgement:
     * three of the ten interact intents put something on the table that a
     * person answers rather than merely declines - a threat, a lie and answers
     * taken under pressure. `bribe`, `seduce`, `recruit`, `negotiate`, `trade`,
     * `talk` and `apologise` are not wrongs, however badly they land, and a
     * refused bribe leaves a grudge and nothing else. The mapping is a closed
     * table and not a string test, so a verb added to the parser does not
     * silently acquire consequences nobody chose for it.
     *
     * ORDER MATTERS: this runs after `resolveAttempt` and reads only what the
     * resolver already decided. It re-prices nothing, rolls nothing, and reads
     * no part of the player's sentence.
     */
    /**
     * What a theft that came off actually takes, and why it is bounded.
     *
     * ── WHAT A THEFT CAN TAKE ────────────────────────────────────────────
     *
     * SPIRIT STONES, AND NOTHING TRACKED. `docs/world/things/items.md` splits
     * the world's things into counted stock and singular tracked objects, and
     * the two move by different machinery for a reason the barter path in this
     * file states at length: `transferPossession` reassigns the possessor on
     * the SINGLE row rather than inserting a copy, because a copy manufactures
     * the scarcest class of object in the world out of nothing. Stones are a
     * number on a row. They are moved as a number on two rows, and this method
     * deliberately never touches an object.
     *
     * Taking a tracked thing off somebody is a different event and is not done
     * here: it needs a provenance entry saying whose it was and how it moved -
     * the trade path writes one - and "stolen" is a story about the object that
     * outlives everybody involved. That is worth building and it is worth
     * building deliberately.
     *
     * ── AND WHY IT IS CAPPED AT A YEAR OF THEIR OWN EARNINGS ─────────────
     *
     * A lift takes what somebody has ON them. Above that, money is not on a
     * person - it is somewhere with a door and a ledger, and taking it is
     * already a different verb with a different clock: `sect.siphon` runs over
     * months and gets found out. So the cap is `earningsPerYear` at THEIR rung,
     * which is the engine's existing answer to "what is a year of this person's
     * life worth" and the same function `purseWeight` prices a bribe against.
     * It scales the right way on its own: a farm child has almost nothing loose
     * and an elder has a great deal, with no second table saying so.
     *
     * Nothing is rolled. The resolver already decided whether it came off, and
     * re-rolling the amount would price the same event twice.
     */
    whatALiftTook(
        this: GameService,
        cultivator: Cultivator,
        party: ResolvedEntity
    ): { taken: number; hadBefore: number; loose: number } | null {
        // ── TWO PLACES A PERSON CAN LIVE, AND BOTH HAVE TO BE ROBBABLE ───
        //
        // `resolveCultivator` matches against the `cultivators` table PLUS
        // whoever is standing in front of the player, and the second half is
        // where the world's several hundred people come in - they have no
        // stored row at all until something materialises one. So a lift that
        // only knew about the table would work on the handful of stored people
        // and silently take nothing from everybody else, which is the "a rule
        // that binds one and not the other" failure with the halves swapped.
        const stored = this.repos.cultivators.getById(party.id);
        const npc = stored ? null : (this.atHand?.npcs ?? []).find(row => row.id === party.id);
        if (!stored && !npc) return null;

        const hadBefore = Math.max(0, Math.floor(
            stored ? stored.spiritStones : npc!.spiritStones
        ));
        const ordinal = stored ? stored.realmOrdinal : npc!.cultivation.realmOrdinal;
        const loose = Math.max(0, Math.floor(earningsPerYear(Math.max(0, ordinal))));
        const taken = Math.min(hadBefore, loose);

        if (taken > 0) {
            if (stored) {
                this.db.transaction(() => {
                    this.repos.cultivators.applyDeltas(party.id, { spiritStones: -taken });
                    this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: taken });
                })();
            } else {
                npc!.spiritStones = hadBefore - taken;
                // The turn wrapper writes the world when this is set, so a
                // restart cannot find the stones back in the pocket they came
                // out of.
                this.worldDirty = true;
                this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: taken });
            }
        }
        return { taken, hadBefore, loose };
    },

    async whatTheWrongedPartyDid(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        party: ResolvedEntity,
        intent: string,
        landed: boolean,
        theirOrdinal: number,
        alignment: SectAlignment | null,
        facts: EngineFacts,
        /** What the deed took off them, when it took anything. */
        lifted: { taken: number; hadBefore: number; loose: number } | null = null
    ): Promise<ToolCallRecord[]> {
        const wrong = WRONG_BEHIND_INTENT[intent];
        if (!wrong) return [];

        // Anybody at all present is an audience. The room is what makes a
        // humiliation a second wrong, which is the reading the resolver's own
        // `AUDIENCE_RESISTANCE` already takes of one - and it is also what
        // decides whether the house ends up carrying this. See below.
        const inPublic = this.company(cultivator).total > 0;

        const verdict = whatTheyDoAboutBeingWronged({
            wrong,
            landed,
            inPublic,
            theirOrdinal,
            yourOrdinal: cultivator.realmOrdinal,
            alignment,
            theirName: party.name,
            yourName: cultivator.name
        });

        // The engine's account goes on all three channels, for the three
        // different readers: `lines` is what the narrator may use, `prose` is
        // what the deterministic narrator ships verbatim, and `structure` is
        // the log, which is the only one of the three that cannot be dressed.
        facts.lines.push(verdict.line);
        facts.prose = `${facts.prose}\n\n${verdict.line}`;
        facts.structure.push(
            `Reprisal: ${verdict.response}. Weighed as ${verdict.grudge.severity} `
            + `${verdict.grudge.cause} against ${cultivator.name}.`
        );

        const calls: ToolCallRecord[] = [{
            name: 'social.reprisal',
            action: 'interact',
            summary: verdict.line,
            ok: true
        }];

        // ── AND IT GOES ON THE LEDGER, WHICH IS THE HALF THAT LASTS ──────
        //
        // The reprisal is what happened in the room and it is over in a turn.
        // The grudge is what the world still holds in forty years, and it is
        // the record that makes `recordWhatTheAskLeft` withholding the tie a
        // correction rather than a deletion: the event does not vanish, it
        // changes sides. `oddsOf` reads the worst open grudge the subject holds
        // against the actor, so this is also what makes robbing somebody make
        // the next thing you want off them HARDER, which is the whole of what
        // was wrong.
        //
        // The id is derived from the pair and the cause and NOT the day, on the
        // same reasoning the refusal grudge gives next door: "X robbed me" is
        // one standing fact about two people however many times it happens, and
        // a resolver that read a count would have read six thefts as six
        // separate injuries. Severity is decided once, here, and never
        // recomputed afterwards - `grudges.ts` requires exactly that.
        //
        // ── AND WHAT IT COST THEM IS PART OF THAT DECISION ───────────────
        //
        // `whatTheyDoAboutBeingWronged` weighs the DEED - what was put on the
        // table, whether it came off, whether anybody watched - and that is
        // the right input for what somebody does in the room. It has no way to
        // know what the deed took, so a lift of somebody's last stone and a
        // lift of an elder's small change came out identical.
        //
        // `whatItWasWorth` is the other half and is exported for exactly this:
        // it prices a deed from `cost`, RELATIVE TO WHAT THE PAYER HAD, which
        // is the whole of what makes the model fair in both directions. So the
        // two are read together and the HEAVIER stands. Not an average and not
        // an override: neither module can make the record lighter than the
        // other thought it was, which is the only combination that cannot lose
        // a fact.
        const cost = lifted !== null && lifted.hadBefore > 0
            ? lifted.taken / lifted.hadBefore
            : 0;
        const worthOfTheLoss = whatItWasWorth({
            cause: verdict.grudge.cause,
            paidBy: 'subject',
            cost,
            onDay: Math.floor(run.elapsedDays),
            description: verdict.line
        });
        const severity = severityRank(worthOfTheLoss) > severityRank(verdict.grudge.severity)
            ? worthOfTheLoss
            : verdict.grudge.severity;

        // ── AND WHO ELSE ENDS UP CARRYING IT ─────────────────────────────
        //
        // THE ROOM, not the wound. A house is a party to a thing done to one of
        // its own IN FRONT OF PEOPLE, because that is when it becomes a fact
        // about the house rather than about the member - the same reading
        // `AUDIENCE_RESISTANCE` takes of an audience and the same one the
        // reprisal above takes of it. A wrong done where nobody could see stays
        // between the two of them however hard it landed, which is what leaves
        // room for a thing nobody has worked out yet.
        const held = createObligation({
            kind: 'grudge',
            id: `grudge_${party.id}_${cultivator.id}_${verdict.grudge.cause}`,
            holderId: party.id,
            subjectId: cultivator.id,
            cause: verdict.grudge.cause,
            severity,
            onDay: Math.floor(run.elapsedDays),
            description: verdict.line,
            participants: inPublic && party.party?.factionId ? [party.party.factionId] : [],
            tags: [
                `wrong:${wrong}`,
                `reprisal:${verdict.response}`,
                landed ? 'landed' : 'attempted',
                ...(inPublic ? ['witnessed'] : []),
                ...(lifted !== null ? [`took:${lifted.taken}`] : [])
            ]
        });
        writeObligation(this.db as unknown as DatabaseHandle, held);
        calls.push({
            name: 'social.createObligation',
            action: 'interact',
            summary:
                `${party.name} now holds a ${held.severity} ${held.kind} about ${cultivator.name} `
                + `for ${held.cause}, written down on day ${Math.floor(run.elapsedDays)} and open `
                + 'until somebody settles it. It costs points on every later approach to them, '
                + 'and it is what an attempt on a person leaves instead of a tie. Weighed as '
                + `${verdict.grudge.severity} by what was done and ${worthOfTheLoss} by what it `
                + `cost them (${Math.round(cost * 100)}% of what they had); the heavier stands. `
                + `${!inPublic
                    ? 'Nobody else could see it, so it stays between the two of them.'
                    : party.party?.factionId
                        ? `${party.party.factionId} is on the record with them: it was done where `
                          + 'people could see.'
                        : 'It was done where people could see, and they answer to nobody who '
                          + 'could take it up.'}`,
            ok: true
        });

        // A warning and a driving-off cost the body nothing, and stopping here
        // is the point: the floor of this system is that something is SAID.
        if (verdict.wound === null && !verdict.fatal) return calls;

        // ── A WOUND THAT IS NOT A KILLING MUST NOT KILL ──────────────────
        //
        // The fraction is of the POOL, because that is the only figure that
        // means the same thing at every rung. What it must not do is finish
        // somebody the verdict did not sentence: `injured` and `crippled` are
        // separate answers from `killed` precisely so that surviving them is
        // the point, and a verdict that killed by arithmetic would collapse
        // three outcomes into one.
        //
        // It bites today rather than in theory: current health does not rise
        // when the pool does, so a cultivator standing at 30 of 15,360 takes
        // an `injured` verdict worth 7,680. Left unclamped, every reprisal
        // above Foundation was a death sentence.
        const wanted = Math.max(1, Math.round(cultivator.maxHp * verdict.hpFraction));
        const damage = verdict.fatal ? wanted : Math.min(wanted, Math.max(0, cultivator.hp - 1));
        this.db.transaction(() => {
            this.repos.cultivators.addInjury(cultivator.id, {
                severity: verdict.wound ?? 'crippling',
                // `combat`, because that is what it was, whatever the sentence
                // that started it looked like.
                source: 'combat',
                description: verdict.line,
                sustainedOnTurn: run.turn
            });
            this.repos.cultivators.applyDeltas(cultivator.id, { hp: -damage });
        })();

        calls.push({
            name: 'cultivator.addInjury',
            action: 'interact',
            summary:
                `A ${verdict.wound} wound and ${damage} of ${cultivator.maxHp} health, for `
                + `${verdict.grudge.cause}. Untreated, and it does not close on its own. `
                + (damage < wanted
                    ? `The verdict was worth ${wanted}; ${damage} is what a body standing on `
                      + `${cultivator.hp} had left to give without dying, and this verdict is not `
                      + 'a killing.'
                    : 'Nothing was clamped: the body could carry the whole of it.'),
            ok: true
        });

        // ── THE WOUND, NAMED, AND WHAT IS LEFT IN THE BODY ───────────────
        //
        // `verdict.line` is what the room saw - "Fang Shutao answers being
        // robbed in the body. Shen Wu does not walk away from it whole." - and
        // that is the right sentence for what it is. What it is not is a
        // statement of the injury, and this layer wrote one, took half the
        // pool, and said neither. Played: two thefts off one person took a
        // cultivator 40 -> 20 -> 1 and no turn mentioned a number, a wound, or
        // that the next blow of any kind would finish it.
        //
        // Required rather than merely offered, on the rule `AGENTS.md` states
        // for exactly this: a wound is something the player must be told, and
        // the channel that survives a model is where it belongs.
        const standing = this.repos.cultivators.getById(cultivator.id) ?? cultivator;
        if (!verdict.fatal) {
            sayThisWhateverTheNarratorDoes(
                facts,
                `A ${verdict.wound ?? 'serious'} wound, open and untreated`
                // "0 of the body gone with it" - the clamp above leaves a
                // living cultivator on one point, so a second wound taken there
                // costs nothing further and printing the zero says the blow did
                // not land. It did; there was simply nothing left for it to
                // take, which is a worse sentence and the true one.
                + (damage > 0
                    ? `, and ${damage} of the body gone with it: ${standing.hp} of `
                      + `${standing.maxHp} left.`
                    : `. There was nothing left in the body for it to take: ${standing.hp} of `
                      + `${standing.maxHp}, the same as before, because that is the floor.`)
                + ' Nothing closes it on its own - a month under a physician does, in any '
                + 'settlement.'
            );
            // ── AND THE EDGE, MARKED ─────────────────────────────────────
            //
            // The clamp above deliberately leaves somebody alive on 1 rather
            // than letting an `injured` verdict kill, and that is right. It
            // also produced the state a player is least able to see and most
            // needs to: standing on a single point, where any encounter at all
            // is fatal, with the prose reading exactly as it read at half
            // health. The same sentence a long stretch closes with, from the
            // same function, so the two surfaces cannot drift.
            if (nearlyGone(standing)) {
                sayThisWhateverTheNarratorDoes(facts, theBodyIsNearlyGone(standing, standing.spiritStones));
            }
        }

        // ── AND IT CAN BE THE END ────────────────────────────────────────
        //
        // Death goes through `markDead` like every other death in this engine -
        // there is no second road, and `endRun` is closed in the same
        // transaction so the ledger can never show a live run whose cultivator
        // is a corpse. `combat_defeat` because it was one, decided by the
        // stronger party alone.
        if (verdict.fatal) {
            this.repos.cultivators.markDead(
                cultivator.id, 'combat_defeat', run.turn, verdict.line
            );
            calls.push({
                name: 'cultivator.markDead',
                action: 'interact',
                summary:
                    `${party.name} killed ${cultivator.name}. The run is closed: there is no `
                    + 'reload, no revival and no continuation.',
                ok: true
            });
        }

        return calls;
    },


    // ─────────────────────────────────────────────────────────────────────
    // ASKING A PERSON FOR SOMETHING
    // ─────────────────────────────────────────────────────────────────────

    /**
     * A request put to a person, with an object.
     *
     * THE VERB THE DESIGN RESTS ON, and it did not exist. The engine says,
     * correctly and often, that there are exactly two ways past a manual's
     * ceiling - another book, or somebody willing to teach you - and it says it
     * well: *"You have no name to ask for, which is the whole of what is
     * stopping you"*, *"A book or a teacher is the only thing that does."* The
     * book half works; a common primer costs about eight spirit stones at a
     * stall. The teacher half had no verb at all, and four phrasings of it
     * reached four different lookups, none of which was a person.
     *
     * THREE THINGS THIS HAS TO GET RIGHT.
     *
     *   THE REQUEST HAS AN OBJECT. `resolveAttempt` has always priced the ask
     *   and never known what the ask WAS, so a landed bribe came back as
     *   "Han Peiru agreed." - agreed to what, and nothing followed. What is
     *   being asked for is resolved here, said in the prose, and carried into
     *   the mechanical channel.
     *
     *   A TAKE CHANGES SOMETHING. `handleLearn` has carried
     *   `provenance: 'taught_by_a_person'` since it was written and nothing in
     *   the codebase has ever passed it. This is that caller. A teaching that
     *   lands puts the art on the sheet through the same gate every other route
     *   uses, so being taught is still subject to rank, root, dao and what has
     *   surfaced in this run - `manuals.md`'s two gates and not one: *"rank says
     *   what the house will give you; the manual's own entry requirement says
     *   what you can open, and being favoured does not lift it."*
     *
     *   A REFUSAL NAMES WHAT WOULD WORK. Every one of them, without exception.
     *   `what-asking-this-person-for-this-would-cost-them.ts` owns those
     *   sentences and each carries the next move: what they are actually
     *   carrying, who teaches it, that a stall sells a copy, that an
     *   introduction runs along a line somebody is already standing on.
     */
    async request(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string,
        topic: string | undefined,
        leverage: ApproachLeverage | undefined,
        rawInput: string
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();

        // What was asked for. The plan carries it; the sentence is re-read only
        // where the plan came from a model that gave a label and no shape, and
        // for the `weigh` read, which deliberately drops the kind so that the
        // interrogative cannot reach the attempt by carrying it along.
        const reread = requestPutToSomebody(rawInput);
        const weighing = intent === 'weigh';
        const kind: RequestKind = REQUEST_KINDS.has(intent)
            ? intent as RequestKind
            : reread?.kind ?? 'a_thing';
        const named = (topic ?? reread?.object ?? '').trim();

        if (query.length < 2) {
            return refused('engine.resolveParty', 'request', factsForRefusal(
                'Asked of whom?',
                'A request is put to somebody. You have not said who, and there is nobody the '
                + `sentence could have meant. ${this.whoIsAbout(cultivator)}`,
                'Unresolved party: request with no subject named. '
                + `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        const party = this.partyPutTo(cultivator, query, scope);
        if (!party) return this.nobodyByThatName(cultivator, query, scope, 'request');

        // ── A HOUSE IS NOT A PERSON ──────────────────────────────────────
        //
        // Asking an institution for something is `petition`, which has its own
        // record and its own refusal, and asking one informally is the approach
        // that describes it. Neither is this: `resolveAttempt` prices one person
        // against another, and a faction has no rung, no charm and no afternoon
        // to spend.
        if (party.kind !== 'cultivator' || !party.party) {
            return this.interact(
                run, cultivator, ambient, query, 'negotiate',
                named.length >= 2 ? named : undefined, leverage, rawInput
            );
        }

        // ── WHAT THEY ARE AFTER, WHICH IS A READ AND NOT A REQUEST ───────
        //
        // "What does Kong Kelin want" reached nothing at all before this - the
        // parser answered `unclear` - while the resolver was already pricing a
        // term for exactly that fact and getting `false` for it from every
        // caller. Wiring the term without the verb would have left the odds
        // moving for a reason no player could see, let alone play toward.
        //
        // Free, and above `noteEncounter` on purpose: wondering what somebody
        // is after is not an approach and must not be recorded as one.
        if (intent === 'wants') {
            return this.freeAction(run, 'request', this.whatIsThisPersonAfter(cultivator, party));
        }

        this.noteEncounter(
            cultivator, run, party, 'witnessed',
            `Asked for something at ${placeName(cultivator)}.`
        );

        // ── BEING TOLD SOMETHING THEY KNOW ───────────────────────────────
        //
        // Already answered, and answered well: `askAround` reads what this
        // person could know, what they are placed to say and what saying it
        // would cost - `asking.md`'s three limits, all applied at once. Routing
        // here rather than reimplementing it is the point.
        if (kind === 'telling' && named.length >= 2) {
            const who = this.present(cultivator).find(row => row.id === party.id);
            if (who) return this.askAround(run, cultivator, who, named, scope);
        }

        // ── WHAT WOULD IT TAKE, AND WHAT IS BEING PUT DOWN FOR IT ────────
        //
        // Ahead of the art read, because both of these name a thing that is
        // not an art and the fall-through below sends anything that is not an
        // art to `interact`. That fall-through is where every barter-tier
        // object in the catalog stopped: the comment under it says the honest
        // thing - it does not invent a way to hand objects over - and the
        // consequence was that a heaven-grade cure could be NAMED by the
        // physician, named by the wound read, and reached by nothing.
        if (kind === 'terms' || kind === 'a_trade') {
            return await this.whatWouldItTake(
                run, cultivator, ambient, party, kind, named,
                reread?.putDown ?? null, leverage, rawInput
            );
        }

        // Asking somebody FOR a named art is asking to be taught it: a copy and
        // an afternoon end in the same place, and `handleLearn` cannot tell them
        // apart either. Anything else that is merely a thing falls back to the
        // approach that already handles it, rather than inventing a way to hand
        // objects over.
        const asArt = named.length >= 2 && kind !== 'nothing'
            ? resolveTechnique(this.repos, named, cultivator.id)
            : null;
        let shape: RequestKind = kind;
        if (kind === 'a_thing' || kind === 'telling') {
            if (asArt) shape = 'teaching';
            else {
                return this.interact(
                    run, cultivator, ambient, query, 'negotiate',
                    named.length >= 2 ? named : undefined, leverage, rawInput
                );
            }
        }

        // ── AND HOW MANY TIMES THEY HAVE HEARD IT ────────────────────────
        //
        // Read before anything is decided, so the outcome can be described as
        // the second time rather than as the first again. Incremented once the
        // attempt is actually made, which is why it is read here and written
        // below rather than in one place.
        // Keyed on the KIND as well as the person, because "they have heard this
        // from you before" is a claim about the thing being asked for. Somebody
        // who bought a stranger three drinks and then asks to be taught has
        // asked for that once.
        const askedKey = askedBeforeKey(party.id, kind);
        const priorAsks = Number(readFlag(this.db, cultivator.id, askedKey) ?? '0');

        const holds = this.whatTheyAreCarrying(party.id);
        const asked: TheOneBeingAsked = {
            id: party.id,
            name: party.name,
            ordinal: party.party.realmOrdinal,
            factionId: party.party.factionId,
            holds,
            // The catalog person this world row stands for, when it stands for
            // one. Asked of the catalog rather than of the prefix: `npc-95` is
            // a procedural NPC and stripping it invents a person called `95`.
            memberId: catalogPersonBehind(party.id)
        };
        const asking: TheOneAsking = {
            name: cultivator.name,
            ordinal: cultivator.realmOrdinal,
            factionId: cultivator.sectId ?? null,
            holds: cultivator.knownTechniques
        };

        // Who they would be putting you in front of, when that is the ask.
        const toMeet = shape === 'introduction' && named.length >= 2
            ? resolveCultivator(this.repos, named, cultivator.id, scope, cultivator.realmOrdinal)
            : null;
        const meeting = toMeet && toMeet.party
            ? {
                id: toMeet.id,
                name: toMeet.name,
                factionId: toMeet.party.factionId,
                here: this.present(cultivator).some(row => row.id === toMeet.id)
            }
            : null;

        const costing = whatItWouldCostThem({
            kind: shape as 'teaching' | 'introduction' | 'discipleship' | 'nothing',
            asking,
            asked,
            techniqueId: asArt?.id ?? null,
            toMeet: meeting,
            namedButUnresolved: named
        });

        // ── A REQUEST THAT CANNOT BE PUT ─────────────────────────────────
        //
        // Not a ban. Every one of these is the sentence having a hole in it -
        // no such art, nobody of that name to be introduced to, they are
        // carrying nothing you have not got - and every one names what would
        // work instead. Refused BEFORE the resolver, so no day is spent and no
        // mark is written, which is the same shape the missing-sum refusal on a
        // bribe already has.
        if (costing.refusal) {
            return refused('engine.priceTheAsk', 'request', factsForRefusal(
                costing.refusal.headline,
                costing.refusal.prose,
                costing.refusal.structure
            ));
        }

        const offered = leverage === 'coin' ? stonesNamedIn(rawInput) : null;
        if (offered !== null && offered > cultivator.spiritStones) {
            return refused('engine.resolveAttempt', 'request', factsForRefusal(
                'You do not have it.',
                `You said ${offered} and you are carrying ${cultivator.spiritStones}, which `
                + `leaves you ${offered - cultivator.spiritStones} short of what you have just `
                + `promised. ${party.name} waits for the rest of it and then stops waiting.`,
                `Offered ${offered} against a purse of ${cultivator.spiritStones}. Refused before `
                + 'the resolver, so no days were spent and no mark was written.'
            ));
        }

        const membership = this.repos.sects.getMembership(cultivator.id);
        const mySect = membership ? this.repos.sects.getById(membership.sectId) : null;
        const theirSect = asked.factionId ? getSect(asked.factionId) : null;

        // Read once and used twice: the resolver prices it, and the refusal
        // reads it to know whether telling the player to turn up again is still
        // advice or has become a loop.
        const heldTie = tieFrom(this.repos, party.id, cultivator.id);
        const tieStrength = heldTie?.active ? heldTie.strength : 0;

        // ── AND WHO THIS PARTICULAR PERSON IS ────────────────────────────
        //
        // Read from their id and from nothing else, which is the whole of the
        // ruling: *"kind elders exist just as greedy demonic cultivators
        // exist."* Two people at the same rung of the same house, equally owed
        // and equally fond of you, answered identically before this.
        //
        // The resolver would derive the same number on its own if this were not
        // passed; it is read here so the SENTENCES can say it, in the facts
        // before the outcome and in the refusal after it. A term nobody can see
        // is a term nobody can play against.
        const openHandedness = openHandednessOf(party.id);
        const holdsThings = howTheyHoldWhatTheyHave(openHandedness);
        const aboutThem = holdsThings === null
            ? party.facts
            : [...party.facts, `${party.name} ${holdsThings}.`];

        // Read once and used three times: the resolver prices it, the costing
        // line says it, and a refusal names it as the thing that is already
        // working for the player rather than sending them off after a lever
        // they are holding.
        const wanted = this.whatTheyWantOfYou(cultivator, party.id);

        // ── AND WHAT A REFUSAL WOULD LEAVE BEHIND ────────────────────────
        //
        // Ruled by the design owner: a refusal is not automatically an
        // offence. Three of these four are the inputs that decide whether it
        // was one, and every one is read off a row rather than off the
        // sentence somebody typed.
        //
        // THE ASKER'S NEED. A crippling wound nobody has closed is the case
        // the ruling names - *"an injury that is blocking their own path"* -
        // and it is the one the ladder actually stops somebody for. A wound
        // that costs a life is survivable; one that costs a rung is not.
        const pressing = cultivator.injuries.some(
            wound => !wound.treated && wound.severity === 'crippling'
        );
        // THEIR OWN CLAIM. A want with no deadline on it is a store put by
        // against something that may never come, and a want with a day on it
        // is somebody's emergency. That is the whole present/reserved test and
        // it reads `deadlineOnDay`, which has been on the row since it was
        // written and which almost nothing has ever read.
        const theirBusiness = this.theirOpenBusiness(party.id);
        const theirTopWant = theirBusiness?.goals[0] ?? null;
        // NOT `deadlineOnDay === null`, which is what this said until playing
        // showed the column is empty in every world this game generates. The
        // date is derived from the clocks they are actually under, so a want
        // held by somebody four years off the end of their climb is pressing
        // and the same want held by somebody who advanced last year is not.
        const reserved = theirTopWant !== null && !aWantThatCannotWait(
            theirTopWant,
            theirBusiness?.clocks ?? null,
            this.clocksOfWhoeverTheWantIsAbout(theirTopWant.targetId),
            Math.floor(run.elapsedDays)
        );
        // AND WHETHER SAYING YES WAS EVER THEIRS TO SAY. `immortal-items.ts`
        // has the institutional version in full - a quorum, a counted line
        // item, *"arithmetic rather than a lever"* - and this is the same
        // shape at a personal scale: their house's own road, asked of somebody
        // holding no rank in it, is not a thing they could hand over however
        // much they wanted to. A refusal from them is not a wrong.
        const theirsToGive = !(costing.ask === 'a_betrayal' && !party.party.ranked);

        // ── ONE INPUT, PRICED ONCE, ROLLED AT MOST ONCE ──────────────────
        //
        // Built before the read branches off, because the read and the attempt
        // have to be the same arithmetic or the read is a second opinion. The
        // resolver exports `oddsOf` for exactly this - "a probe that cannot see
        // the breakdown cannot tell a tuning problem from a bug" - so weighing
        // an approach runs every term the attempt would run and stops at the
        // roll. Nothing can drift, because there is nothing to drift from.
        const attempt = {
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
                ordinal: asked.ordinal,
                ...(party.party.charm === undefined ? {} : { charm: party.party.charm }),
                factionId: asked.factionId,
                alignment: theirSect?.alignment ?? null,
                ranked: party.party.ranked,
                openHandedness
            },
            onDay: Math.floor(run.elapsedDays),
            // ── AND WHAT THE TWO OF THEM ALREADY ARE TO EACH OTHER ───────
            //
            // Three of the resolver's seven terms - their view of you, what is
            // owed either way, and what they hold against you - are worth up to
            // half again as much as the purse put together, and NO CALLER IN
            // THIS LAYER HAS EVER SUPPLIED ONE. So every approach any player
            // has ever made was made by a stranger, however many times the two
            // of them had dealt with each other, and `asking.md`'s "cheapest
            // lever in the game, available to a cultivator with nothing"
            // reached nothing at all.
            //
            // Both are read off rows and neither is invented: the ledger is the
            // obligations table, and the tie is what THIS resolver wrote the
            // last time an attempt landed.
            theirTie: heldTie,
            yourTie: tieFrom(this.repos, cultivator.id, party.id),
            ledger: openLedgerBetween(this.repos, cultivator.id, party.id),
            // WHERE THIS IS HAPPENING. A term and never a gate, damped by
            // whatever tie the subject already holds, because the ruling is
            // about the same STRANGER saying the same thing.
            //
            // The world simulation reads the SUBJECT's ground, because the
            // approach goes to them. Here it is the player's, and the two are
            // the same square by construction - somebody has to be present to
            // be pressed - so this is the same rule and not a second one.
            // Resolving the subject's own world row instead would be the
            // mistake `the-player-as-a-row-the-world-can-invite.ts` names:
            // presence belongs to the play layer.
            where: theGroundBetweenThem(this.atHand, this.worldPlaceOf(cultivator)),
            // ── AND WHAT THEY WANT THAT YOU ARE PART OF ──────────────────
            //
            // The last of the seven with no caller anywhere in this layer.
            // Read off goal rows and never off an opinion about what somebody
            // probably wants, and deliberately blind to the gap in rung: the
            // resolver already has a standing term, and a second reading of it
            // would turn the one lever a cultivator with nothing can carry
            // into one more advantage for the people who have every other one.
            theyWantSomethingFromYou: wanted !== null,
            // The three that decide whether a refusal is an offence, and the
            // count that decides whether patience has run out. Read above.
            timesAskedBefore: priorAsks,
            askersNeedIsPressing: pressing,
            theirHoldOnItIsMerelyReserved: reserved,
            theAnswerWasTheirsToGive: theirsToGive,
            // THE ASK IS THE THING BEING ASKED FOR, and it is derived rather
            // than read off the sentence. Whether teaching somebody an art is
            // an afternoon or the end of their standing is a fact about the
            // book and the house, and `betrayalOfSelling` already decides it for
            // every NPC in the world.
            ask: costing.ask,
            ...(offered === null ? {} : { stonesOffered: offered }),
            approach: {
                intent: rawInput.slice(0, 400),
                ...(leverage ? { leverage } : {})
            },
            rng: forStream(run.seed, 'social_leverage', Math.floor(run.elapsedDays), party.id)
        };

        // ── WHAT IT WOULD TAKE, WITHOUT DOING IT ─────────────────────────
        //
        // "Could I ask her to teach me" is a question, and `request` spends days
        // and can spend the purse. The read now carries the REAL odds and the
        // real breakdown rather than a description of them, which is the whole
        // reason it is worth having: a player who is told a thing comes off one
        // time in eight can decide whether to spend the afternoon.
        if (weighing) {
            const weighed = oddsOf(attempt);
            const weighing = this.freeAction(run, 'request', factsForWeighingARequest(
                cultivator, party.name, shape, costing, aboutThem, offered, priorAsks,
                tieStrength, weighed.odds
            ));
            // Filed as a call rather than only onto `structure`, so the read
            // shows its arithmetic in the same place the attempt shows its own.
            // A read whose breakdown is harder to find than the attempt's is a
            // read nobody checks.
            weighing.calls.push({
                name: 'engine.priceTheAsk',
                action: 'request',
                summary: whatTheAskCameTo({
                    subject: party.name,
                    kind: shape,
                    ask: costing.ask,
                    leverage,
                    odds: weighed.odds,
                    terms: weighed.terms,
                    priorAsks,
                    // The term, said as the thing itself. See `theTermsInWords`.
                    ...(wanted ? { theNeed: wanted.goal.text } : {})
                }),
                ok: true
            }, ...costing.structure.map(line => ({
                name: 'engine.priceTheAsk',
                action: 'request' as ActionName,
                summary: line,
                ok: true
            })));
            return weighing;
        }

        const result = resolveAttempt({ ...attempt, theAttemptLands: theRollLands('an_approach_to_somebody') });

        if (result.stonesSpent > 0) {
            this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -result.stonesSpent });
        }

        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Asking ${party.name}`, result.days
        );

        writeFlag(this.db, cultivator.id, askedKey, String(priorAsks + 1));

        const calls: ToolCallRecord[] = [
            {
                name: 'engine.resolveAttempt',
                action: 'request',
                // Composed after the records are written, below, because one
                // clause of it is a claim about the ledger.
                summary: '',
                ok: result.outcome === 'taken'
            },
            ...structureCalls(party.structure),
            ...costing.structure.map(line => ({
                name: 'engine.priceTheAsk',
                action: 'request' as ActionName,
                summary: line,
                ok: true
            })),
            ...spent.calls
        ];

        // ── AND WHAT THE ATTEMPT LEFT BEHIND ─────────────────────────────
        //
        // `factsForAttempt` has said "it is on somebody's ledger now, and
        // ledgers here are kept" since it was written, and nothing wrote to the
        // ledger. That is the narrator asserting an outcome the database never
        // took, which is the one thing this codebase forbids outright. The
        // resolver hands back the records; this persists them.
        const left = this.recordWhatTheAskLeft(
            run, cultivator, party, result, 'request', shape !== 'nothing'
        );
        calls.push(...left.calls);

        // The engine's own account of the whole attempt, every figure kept and
        // every enum resolved. Filled in here rather than above because it says
        // whether anything reached the ledger, and the only honest source for
        // that is whether anything did.
        calls[0].summary = whatTheAskCameTo({
            subject: party.name,
            kind: shape,
            ask: costing.ask,
            leverage,
            odds: result.odds,
            terms: result.terms,
            outcome: result.outcome,
            days: result.days,
            stonesSpent: result.stonesSpent,
            priorAsks,
            ...(wanted ? { theNeed: wanted.goal.text } : {}),
            wroteToTheLedger: left.wroteToTheLedger,
            reachedTheHouse: result.marks.reachedTheHouse
        });

        // Built AFTER the records are written, because one of its lines is a
        // claim about the ledger and the only honest source for that claim is
        // whether anything went into it.
        const facts = factsForRequest(
            cultivator, party.name, shape, named, costing, result, aboutThem, priorAsks,
            left.wroteToTheLedger, tieStrength, openHandedness
        );

        // ── AND WHETHER THEY WANTED ANYTHING OF YOU ──────────────────────
        //
        // Said either way, because the arithmetic says it either way: the
        // channel prints "nothing came from something they want that the asker
        // could reach" on every attempt where this reads zero, and a player who
        // is shown a term that never moves and is never told what moves it has
        // been shown a field name.
        //
        // The refusal names a door that exists. It did not before this change -
        // "find out what they want" was a sentence the parser answered
        // `unclear` - and `asking.md` is exact about why that matters: a
        // refusal is the one place the player is being told what to do next.
        const alsoSaid: string[] = [];
        if (wanted !== null) {
            const carried =
                `Something ${party.name} is already after ran through you while you asked, `
                + 'which is why this was not the request a stranger would have made.';
            alsoSaid.push(carried);
            facts.structure.push(
                `The 'wants' term was carried by goal "${wanted.goal.id}" (${wanted.because}). `
                + 'Read off open goal rows by `whatTheyWantThatYouCouldReach`, which is blind to '
                + 'the gap in rung by design.'
            );
        } else {
            alsoSaid.push(
                `Nothing ${party.name} is chasing runs through you, and that is a term of this `
                + `the same as standing is. Ask what ${party.name} wants; if it turns out to be `
                + 'money, a road they have not walked, or a word from a house, then you are '
                + 'holding part of it and the next asking is a different asking.'
            );
            facts.structure.push(
                'The \'wants\' term read zero: no open goal row of theirs is pointed at this '
                + 'cultivator, at their house, at a purse worth a year of this person\'s '
                + 'earnings, or at a road this person has not walked.'
            );
        }

        // ── A REFUSAL THAT NAMES A TRADE IS NOT A REBUFF ─────────────────
        //
        // The design owner's correction to the grudge model, said in the
        // prose rather than only in the record: *"someone could trade someone
        // for something else"*. A no that comes with what they ARE after is an
        // opening, and the sentence is emergent rather than authored - the
        // want is `text` off their own goal row, written by whoever opened it,
        // so a want nobody has thought of yet reads correctly here with no
        // code.
        //
        // Said on a refusal only. Somebody who agreed has no counter-offer to
        // make, and telling them what else they wanted would be noise.
        if (result.outcome !== 'taken' && theirTopWant !== null) {
            alsoSaid.push(
                `It is not a door closing. ${party.name} is carrying something of their own - `
                + `${theirTopWant.text} - and somebody who turns up holding part of that is not `
                + 'making the same request twice.'
            );
        }
        if (result.marks.obligation === null) {
            facts.structure.push(
                'No grudge was written. A refusal is not automatically an offence: what writes '
                + 'one is the ask being wrong - coercion, money for what money is not the medium '
                + `for, or asking past patience - or the refusal being wrong, which needs all of `
                + 'a pressing need, a merely reserved hold, a binding between the two, and the '
                + 'answer having been theirs to give.'
            );
        }
        if (!theirsToGive) {
            facts.structure.push(
                'The answer was not theirs to give: their house\'s own road, asked of somebody '
                + 'holding no rank in it. Arithmetic rather than a lever, so no pressure reaches '
                + 'it and no grudge comes of it either way.'
            );
        }
        // Onto the PROSE as well as onto the lines. A line pushed after
        // `factsForRequest` has already composed its prose reaches the
        // inspector and never reaches the player, which is the invisible half
        // of the invisible-fallback defect. `pressSomebody` does the same
        // thing for the same reason.
        if (alsoSaid.length > 0) {
            facts.lines.push(...alsoSaid);
            facts.prose = `${facts.prose}

${alsoSaid.join(' ')}`;
        }

        facts.lines.push(...spent.facts.lines);
        facts.structure.push(...spent.facts.structure);

        const execution: Execution = {
            ...spent,
            facts,
            outcome: result.outcome === 'taken' ? 'executed' : 'refused'
        };
        execution.calls = calls;

        // ── AND THE THING ACTUALLY HAPPENS ───────────────────────────────
        if (result.outcome === 'taken' || result.outcome === 'turned') {
            const done = await this.whatTheyAgreedTo(
                run, cultivator, party, shape, costing, meeting
            );
            facts.lines.push(...done.lines);
            facts.prose = `${facts.prose}

${done.lines.join(' ')}`;
            execution.calls.push(...done.calls);
        }

        return execution;
    },

    /**
     * Every art a person could actually walk somebody down, from both of the
     * places one is written.
     *
     * A cultivator row carries `knownTechniques` and a world NPC carries
     * `cultivation.techniqueIds`, and most of the people standing in a square
     * are the second kind - `othersPresent` unions the two, and a reader that
     * looked at only one of them would find the roster empty in exactly the
     * places a player actually stands.
     */
    whatTheyAreCarrying(this: GameService, personId: string): string[] {
        const held = new Set<string>(
            this.repos.cultivators.getById(personId)?.knownTechniques ?? []
        );
        if (this.atHand) {
            for (const npc of this.atHand.npcs) {
                if (npc.id !== personId) continue;
                for (const id of npc.cultivation.techniqueIds) held.add(id);
            }
        }
        // The five people in the world who are worth more than the shelf they
        // stand beside. `LIVING_TRANSMISSIONS` is read by the catalog and by the
        // register and by nothing in `src/engine/` or `src/web/` - AGENTS.md
        // lists it first among the modules nothing calls. This is the route a
        // player takes to it.
        for (const carried of transmissionsBy(theOneIdAPersonIsKnownBy(personId))) {
            for (const id of carried.techniqueIds) held.add(id);
        }
        return [...held];
    },

    /**
     * What a person standing here is currently trying to do, off their rows.
     *
     * Null when there is nothing to read: the world is off, or this is a
     * cultivator row rather than somebody the world holds. Both are honest
     * absences and neither is an empty goal list, which would say "they want
     * nothing" about somebody the record has never had an opinion on.
     */
    theirOpenBusiness(this: GameService, personId: string): SomebodyWithGoals | null {
        if (!this.atHand) return null;
        const npc = this.atHand.npcs.find(row => row.id === personId);
        if (!npc) return null;
        return {
            id: npc.id,
            ordinal: npc.cultivation.realmOrdinal,
            factionId: npc.factionId,
            holds: this.whatTheyAreCarrying(personId),
            goals: goalsHeldBy(npc),
            clocks: this.clocksUnder(npc)
        };
    },

    /**
     * The clocks a person is under, which is where a want's date comes from.
     *
     * Found by playing: NOTHING IN THIS WORLD HAS EVER WRITTEN A
     * `deadlineOnDay`. Not the seeder, not `openAmbition`, not the birth goal.
     * So every want read as open-ended, every holder was negotiable, and the
     * case the design owner cared about most - somebody who cannot wait -
     * could not occur at all. Same defect as a module nothing calls, one size
     * down: a field nothing writes.
     *
     * The date is DERIVED here rather than stamped on the row, because a
     * stamped one is wrong by the second year - the settling clock resets on
     * every advance, and a stored deadline would go on reading true. Both
     * numbers are already on the record and are already moved by the world.
     */
    clocksUnder(this: GameService, npc: NpcRecord): TheClocksSomebodyIsUnder {
        return {
            ordinal: npc.cultivation.realmOrdinal,
            lastAdvancedOnDay: npc.cultivation.lastAdvancedOnDay,
            lifespanEndsOnDay: npc.cultivation.lifespanEndsOnDay
        };
    },

    /**
     * The clocks of whoever a want points at, when it points at a person.
     *
     * A want about a child is dated by the child, which is the owner's own
     * example. Null for a want pointed at a house, a place, or nobody.
     */
    clocksOfWhoeverTheWantIsAbout(this: GameService, targetId: string | null): TheClocksSomebodyIsUnder | null {
        if (targetId === null || !this.atHand) return null;
        const npc = this.atHand.npcs.find(row => row.id === targetId);
        return npc ? this.clocksUnder(npc) : null;
    },

    /**
     * What somebody is after, said to the player, behind the gate that owns it.
     *
     * THE GATE IS THEIR SIDE OF THE TIE, and it is the strict one on purpose.
     * `recordContact` writes the PLAYER's side every time the player notices
     * anybody, so gating on that would hand the business of everybody in the
     * square to somebody who had merely looked at them. Their side is written
     * only by an attempt that LANDED - a drink stood, a visit paid, a favour
     * done - which is `asking.md`'s "someone who has reason to talk to you"
     * exactly, and it is reachable by a cultivator with nothing because every
     * one of those costs a day and no stones.
     *
     * An open obligation either way counts too, for the same reason and off the
     * same rows the resolver reads: a debtor talks to their creditor.
     */
    whatIsThisPersonAfter(this: GameService, cultivator: Cultivator, party: ResolvedEntity): EngineFacts {
        const theirTie = tieFrom(this.repos, party.id, cultivator.id);
        const dealings = openLedgerBetween(this.repos, cultivator.id, party.id);
        if (!(theirTie?.active && theirTie.strength > 0) && dealings.length === 0) {
            return factsForSomebodyWhoWillNotSay(party.name);
        }

        const them = this.theirOpenBusiness(party.id);
        if (!them || them.goals.length === 0) {
            return factsForSomebodyWithNoOpenBusiness(party.name);
        }

        const today = this.atHand ? Math.floor(this.atHand.currentDay) : 0;
        return factsForWhatTheyAreAfter(
            party.name,
            them,
            them.goals[0],
            this.whatTheyWantOfYou(cultivator, party.id),
            today,
            this.clocksOfWhoeverTheWantIsAbout(them.goals[0].targetId)
        );
    },

    /**
     * WHAT WOULD IT TAKE, AND WHAT HAPPENS WHEN SOMETHING IS PUT DOWN.
     *
     * ── THE GAP THIS IS THE LIVE END OF ──────────────────────────────────
     *
     * Played, at a crippling meridian tear. The physician's refusal is correct
     * and complete - it names the medicine, its grade, and then says *"Nobody
     * sells one of these for stones... a favour owed, something out of a hole
     * nobody else has been down, or an art"* - and **nothing in the game
     * accepted that sentence.** `request` sends anything that is not an art to
     * `interact`, whose own comment says the honest thing: it does not invent a
     * way to hand objects over. So every heaven-grade and above cure in the
     * catalog was nameable, priced, seeded onto real houses, and unobtainable,
     * with the refusal that said so as the closest the game came to admitting
     * it.
     *
     * ── WHAT IT READS, AND WHOSE ANSWER EACH PIECE IS ────────────────────
     *
     *   the thing        `theThingAskedFor` off the pill catalog: how high it
     *                    carries somebody, and whether money buys one at all.
     *   who is holding   `heldByTheirHouse` off `state.objects`, which is the
     *                    one possessions table. Barter pills are seeded onto
     *                    HOUSES, so this asks about the shelf behind the person.
     *   their need       `whatTheirNeedDoesToThePriceOf`, which is the ONE
     *                    model of what somebody needs and how urgently. Nothing
     *                    here second-guesses it and nothing here reads a goal
     *                    row.
     *   the price        `whatItWouldTake`, which prices both sides on one
     *                    scale and never asks what kind of thing either is.
     *
     * ── AND WHY A RANK DECIDES WHETHER IT IS THEIRS TO GIVE ──────────────
     *
     * `party.ranked` and not their rung. Somebody standing in a house without a
     * rank in it is not deciding what leaves its vault, and telling that apart
     * from a refusal is the distinction `immortal-items.ts` insists on:
     * *"arithmetic rather than a lever"*, where there is no version of the
     * problem in which the right person is found and enough pressure applied. A
     * player who cannot draw that line spends a run looking for a lever that
     * does not exist.
     */
    async whatWouldItTake(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        party: ResolvedEntity,
        kind: 'terms' | 'a_trade',
        named: string,
        putDown: string | null,
        leverage: ApproachLeverage | undefined,
        rawInput: string
    ): Promise<Execution> {
        if (named.length < 2) {
            return refused('engine.resolvePill', 'request', factsForRefusal(
                'A price for what?',
                `You ask ${party.name} what they would want and do not say what for, which is a `
                + `question they cannot answer. Name the thing: "ask ${party.name} what they `
                + `would take for a Meridian Rebirth Pill".`,
                'Request of kind terms/a_trade with no object named. Nothing spent, no time '
                + 'passed.'
            ));
        }

        const asPill = resolvePill(named);
        const thing = asPill ? theThingAskedFor(asPill.id) : null;
        if (!asPill || !thing) {
            return refused('engine.resolvePill', 'request', factsForRefusal(
                'Nothing by that name that anybody trades.',
                `You put the words to ${party.name} and they do not know what you are asking `
                + `for. Nothing in the world is called "${named}" that a person would barter `
                + 'over.',
                `No catalog row matched "${named}". Nothing spent, no time passed.`
            ));
        }

        // ── BELOW THE LINE THERE IS A COUNTER, AND IT IS BETTER ──────────
        //
        // A barter verb aimed at a sixty-stone pill would be the game making
        // something harder than it is. `pillTradeTier` is the one place the
        // cash line is decided and this reads it rather than restating it.
        if (!thing.pastTheCashLine) {
            return refused('engine.pillTradeTier', 'request', factsForRefusal(
                'That one is simply bought.',
                `${thing.name} is not something anybody bargains over - it is made constantly, `
                + `it is on boards, and ${party.name} would wonder why you were asking them `
                + `instead of a counter. "buy a ${thing.name}" is the sentence.`,
                `${asPill.id} is commodity tier, so it has a cash price and no barter. See `
                + 'buying-and-bartering-pills.ts.'
            ));
        }

        const world = this.atHand;
        const theirFaction = party.party?.factionId ?? null;
        const onShelf = heldByTheirHouse(world, theirFaction, asPill.id);

        // ── NOT HOLDING ONE, AND WHO IS ─────────────────────────────────
        //
        // A dead end and a next move are different answers, which is the
        // reasoning `nobodyByThatName` already runs on. Who holds a tracked
        // object is not a secret - the standing register prints it - so naming
        // the houses that do leaks nothing, and it is the whole difference
        // between a refusal that ends a run and one that starts a journey.
        if (!onShelf) {
            const elsewhere = (world?.objects ?? [])
                .filter(o => o.kind === 'pill' && o.data?.pillId === asPill.id
                    && o.data?.spent !== true && o.ownerName)
                .map(o => String(o.ownerName))
                .filter((name, at, all) => all.indexOf(name) === at)
                .slice(0, 4);

            return refused('engine.possessions', 'request', factsForRefusal(
                'Not something they have.',
                `${party.name} has no ${thing.name} to price. `
                + (elsewhere.length > 0
                    ? `What is holding one, on the standing register: ${elsewhere.join(', ')}. `
                      + 'A thing like this sits in a vault rather than in a pocket, so the person '
                      + 'to ask is somebody who speaks for one of those.'
                    : 'Nothing on the register is holding one either, which is the honest answer '
                      + 'and a worse one: what would move this is finding one rather than '
                      + 'affording it.'),
                `No unspent ${asPill.id} row against ${theirFaction ?? 'no house'}. `
                + `${elsewhere.length} holder(s) elsewhere in state.objects.`
            ));
        }

        // ── WHAT THEIR NEED DOES TO IT, FROM THE ONE MODEL THAT DECIDES ──
        const today = world ? Math.floor(world.currentDay) : Math.floor(run.elapsedDays);
        const them = this.theirOpenBusiness(party.id);
        const theirsToGive = party.party?.ranked === true;
        const need = them
            ? whatTheirNeedDoesToThePriceOf(
                them, thing.tracked, true, today, theirsToGive,
                goal => this.clocksOfWhoeverTheWantIsAbout(goal.targetId)
            )
            : null;

        const holding = howTheyAreHoldingIt(
            need ?? (theirsToGive ? null : { effect: 'the_answer_is_not_theirs_to_give' }),
            thing.carriesTo,
            howHighTheirHouseReaches(world, theirFaction)
        );

        const table: OnTheTable[] = putDown === null
            ? []
            // The fourth argument is WHO IS RECEIVING IT, and without it the
            // function cannot honour its own contract. A medicine carries the
            // person who takes it somewhere, and where that is depends on where
            // they already stand: an Unearned Step whose grade tops out beneath
            // somebody carries them nowhere at all. Measured against a receiver
            // at rung 29, a middle Step is worth 0 to them and a higher one is
            // worth 33 - and with no receiver passed, both read 29.
            : [whatIsBeingPutDown(
                putDown, cultivator.realmOrdinal, this.whatTheyAreCarrying(party.id),
                party.party?.realmOrdinal
            )];

        const answer = whatItWouldTake(holding, table);
        const weight = howHeavyThisAskIs(answer);

        const structure = [
            `${thing.name}: carries to rung ${thing.carriesTo}, ${thing.tracked.significance}, `
            + `past the cash line. Held by ${onShelf.ownerName ?? theirFaction}.`,
            `Their hold: ${need?.effect ?? 'no need bound up in it'}; claim can wait = `
            + `${holding.theirClaimCanWait}; theirs to give = ${holding.theirsToGive}.`,
            `On the table: ${answer.theBestPutDown ?? 'nothing singular'} at rung `
            + `${answer.theBestOnTheTable} against a bar of ${answer.theHeightToReach}.`
        ];

        // ── ASKING THE PRICE IS A QUESTION, NOT AN ATTEMPT ───────────────
        //
        // It costs them a sentence, so it costs no day and rolls nothing. What
        // it is NOT is free of consequence: they now know somebody is looking
        // for one of these, and that is worth something to the sort of person
        // who holds one. Filed as an encounter rather than as a mark, because
        // nothing was asked of them.
        if (kind === 'terms') {
            const facts = factsForToolResult(
                `${party.name}, on what it would take.`,
                [
                    `You say what you are after and ask what it would take. ${answer.line}`,
                    ...(need?.goal
                        ? [`What they are carrying of their own: ${need.goal.text}`]
                        : [])
                ]
            );
            facts.structure.push(...structure);
            this.noteEncounter(
                cultivator, run, party, 'witnessed',
                `Asked what it would take to get a ${thing.name}.`
            );
            return this.freeAction(run, 'request', facts);
        }

        // ── AND PUTTING SOMETHING DOWN IS AN ATTEMPT ─────────────────────
        //
        // Resolved by the resolver everything else is resolved by, carrying two
        // terms it had no caller for. Nothing is refused outright - `AGENTS.md`
        // forbids the removed verb - so a pebble put down for the best thing in
        // the province gets a very bad number rather than a closed door.
        const membership = this.repos.sects.getMembership(cultivator.id);
        const mySect = membership ? this.repos.sects.getById(membership.sectId) : null;
        const theirSect = theirFaction ? getSect(theirFaction) : null;
        const heldTie = tieFrom(this.repos, party.id, cultivator.id);

        const attempt = {
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
                ordinal: party.party?.realmOrdinal ?? 0,
                ...(party.party?.charm === undefined ? {} : { charm: party.party.charm }),
                factionId: theirFaction,
                alignment: theirSect?.alignment ?? null,
                ranked: party.party?.ranked ?? false,
                openHandedness: openHandednessOf(party.id)
            },
            onDay: Math.floor(run.elapsedDays),
            theirTie: heldTie,
            yourTie: tieFrom(this.repos, cultivator.id, party.id),
            ledger: openLedgerBetween(this.repos, cultivator.id, party.id),
            // WHERE THIS IS HAPPENING. A term and never a gate, damped by
            // whatever tie the subject already holds, because the ruling is
            // about the same STRANGER saying the same thing.
            //
            // The world simulation reads the SUBJECT's ground, because the
            // approach goes to them. Here it is the player's, and the two are
            // the same square by construction - somebody has to be present to
            // be pressed - so this is the same rule and not a second one.
            // Resolving the subject's own world row instead would be the
            // mistake `the-player-as-a-row-the-world-can-invite.ts` names:
            // presence belongs to the play layer.
            where: theGroundBetweenThem(this.atHand, this.worldPlaceOf(cultivator)),
            // A trade whose price is met is an ordinary favour. One whose price
            // is not met asks them to end up worse off and see it while
            // agreeing, which is what `against_their_interest` means.
            ask: (weight.thePriceWasMet
                ? 'a_real_favour'
                : 'against_their_interest') as AskWeight,
            theyWantSomethingFromYou: weight.theyWantWhatIsInFrontOfThem,
            theAnswerWasTheirsToGive: holding.theirsToGive,
            theirHoldOnItIsMerelyReserved: holding.theirClaimCanWait,
            approach: {
                intent: rawInput.slice(0, 400),
                ...(leverage ? { leverage } : {})
            },
            rng: forStream(
                run.seed, 'social_leverage', Math.floor(run.elapsedDays), `${party.id}:trade`
            )
        };

        const result = resolveAttempt({ ...attempt, theAttemptLands: theRollLands('an_approach_to_somebody') });
        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Trading with ${party.name}`, result.days
        );
        const left = this.recordWhatTheAskLeft(run, cultivator, party, result, 'request', true);

        const lines = [
            `You put down ${answer.theBestPutDown ?? 'nothing anybody could hold'} for a `
            + `${thing.name}. ${answer.line}`
        ];

        const took = result.outcome === 'taken' || result.outcome === 'turned';
        if (took) {
            // ── THE ROW MOVES. IT IS NOT COPIED ──────────────────────────
            //
            // A pouch row inserted while the shelf keeps its own lets the same
            // house be traded with twice, and the world gains a second one of
            // the scarcest class of object it has. That is not untidiness - it
            // is manufacturing, from nothing, the exact thing this economy is
            // built around not having.
            //
            // HOW SCARCE, AND WHERE IT NOW COMES FROM. Cultivator deaths supply
            // none of it: 2373 deaths over six seeds and forty years, not one at
            // the heaven band or above. That was once the whole argument and it
            // is only half of one now - `hunting-a-spirit-beast.ts` made beasts
            // a live supply, and a played run brought a heaven-grade core worth
            // about 2900 stones out of one. So the material exists, it is hunted
            // rather than inherited, and every unit of it was paid for by
            // somebody going out and killing something.
            //
            // Which sharpens this rule rather than relaxing it. A supply that
            // has to be earned is exactly the supply a duplication bug destroys
            // the meaning of.
            //
            // `transferPossession` is what the rest of the world already uses -
            // `immortal-world.ts` in four places, `legacy.ts`, and the repair
            // dose next door. It reassigns the possessor on the SINGLE record
            // rather than making another, and `transfersOwnership` moves the
            // legal half too, which a trade should and a loan should not: the
            // house sold it, so it is not theirs any more in either sense.
            //
            // AND THE PROVENANCE IS THE POINT RATHER THAN BOOKKEEPING. What
            // `items.md` cares about is that somebody can ask, two centuries
            // on, whose this was and how it moved - so the entry carries the
            // house it came off, the day, and the terms. An object that arrives
            // in a pouch with no history is the signature of something stolen,
            // and this one was not.
            const index = (world?.objects ?? []).findIndex(o => o.id === onShelf.id);
            if (world && index >= 0) {
                world.objects[index] = transferPossession(world.objects[index], {
                    onDay: today,
                    toHolderId: cultivator.id,
                    toHolderName: cultivator.name,
                    // The catalog's own word for a thing that changed hands for
                    // a consideration. That the consideration was not money is
                    // what the note carries; `AcquisitionMode` is deliberately
                    // a small closed set and does not need a barter member.
                    how: 'bought',
                    transfersOwnership: true,
                    source: `Traded by ${onShelf.ownerName ?? party.name}`,
                    note: `Given for ${answer.theBestPutDown ?? 'something offered'}, which `
                        + `carried them to rung ${answer.theBestOnTheTable} against a thing that `
                        + `carries to rung ${answer.theHeightToReach}. Not sold for stones.`
                });
                // The turn wrapper writes the world when this is set, so a
                // restart cannot lose the fact that the shelf is now empty.
                this.worldDirty = true;
            }

            // The pouch is the PLAYER-FACING half and not a second copy: the
            // object row is the world's record of which one this is and where
            // it has been, and the pouch entry is the thing `consume_pill`
            // actually spends. A barter pill has both because it has a story; a
            // bought one has only the pouch, because a commodity has none.
            addToPouch(this.db, cultivator.id, asPill.id, 'pill', 1);
            lines.push(
                `${party.name} takes what you offered and the ${thing.name} is in your pouch. `
                + 'It came off a shelf that is now short of one, and the record says whose it '
                + 'was.'
            );
        } else if (result.outcome === 'countered') {
            lines.push(
                `${party.name} does not close the door. They want something, they have said so, `
                + 'and what you put down is not yet it.'
            );
        } else {
            lines.push(`${party.name} does not take it.`);
        }
        lines.push(...spent.facts.lines);

        const facts = factsForToolResult(
            `${party.name}, on a ${thing.name}: ${result.outcome}.`, lines
        );
        facts.structure.push(...structure, ...spent.facts.structure);

        return {
            ...spent,
            facts,
            outcome: took ? 'executed' : 'refused',
            calls: [
                {
                    name: 'engine.whatItWouldTake',
                    action: 'request',
                    summary: `${asPill.id}: bar ${answer.theHeightToReach}, offered `
                        + `${answer.theBestOnTheTable}, ${answer.why ?? 'price met'}; `
                        + `attempt ${result.outcome} at odds ${result.odds}.`,
                    ok: took
                },
                ...left.calls,
                ...spent.calls
            ]
        };
    }
};
