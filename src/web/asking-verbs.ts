/**
 * Asking somebody for something, and what saying yes would cost them.
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
    liftIt,
    whatIsWithinReachOf,
    whichThingTheyMeant,
    type LiftedThing
} from './object-theft.js';
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

/**
 * What one lift came away with.
 *
 * `taken` is a number of spirit stones and `thing` is one row. Exactly one of
 * the two is ever non-zero, because a lift is one act - see `whatALiftTook`.
 */
export interface WhatALiftTook {
    taken: number;
    hadBefore: number;
    loose: number;
    thing: LiftedThing | null;
}
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
    aQuestionRatherThanAName,
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
 */
const askedBeforeKey = (personId: string, kind: string): string => `asked:${kind}:${personId}`;

/**
 * The ground the two of them are standing on, priced for whether a stranger is
 * believed on it.
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
     */
    /**
     * A demand for something somebody knows, resolved by standing.
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
        // A QUESTION IS NOT A NAME, so the have-they-heard-of-it gate does not
        // decide it. See `aQuestionRatherThanAName`: asking somebody who holds
        // this ground is a question the square can answer, and it was being
        // refused because no entity called "who is in charge" exists.
        if (standing === 'they_do_not_know' && !aQuestionRatherThanAName(topic)) {
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
         */
        demand?: {
            who: RosterEntry;
            topic: string;
            scope: KnowledgeScope;
            standing: WhatStandsInTheWay;
        },
        /**
         * The thing the sentence named, when it named one.
         */
        named?: string
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

        // A BRIBE IS A NUMBER
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
            // WHERE THIS IS HAPPENING. A term and never a gate, damped by whatever
            // tie the subject already holds, because the ruling is about the same
            // STRANGER saying the same thing.
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
            ? this.whatALiftTook(
                cultivator, party, named ?? '', Math.floor(run.elapsedDays)
            )
            : null;

        const marks = this.recordWhatTheAskLeft(
            run, cultivator, party, result, 'interact', true, wrong
        ).calls;

        // HOW MANY TIMES THEY HAVE HAD THIS FROM YOU
        const triedKey = askedBeforeKey(party.id, intent);
        const priorTries = Number(readFlag(this.db, cultivator.id, triedKey) ?? '0');
        writeFlag(this.db, cultivator.id, triedKey, String(priorTries + 1));

        const facts = factsForAttempt(
            party.name, intent, result, party.facts, wrong, priorTries
        );

        // AND THEN THEY DO SOMETHING ABOUT IT
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

        // AND WHAT, EXACTLY, DID THEY AGREE TO
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
        // AND WHAT A TAKING DID NOT MOVE
        if (!demand && wrong !== null) {
            const took = lifted === null
                ? `Nothing came away in a hand. The world has what was done written down and `
                  + `${party.name} is carrying it; what they were holding is still theirs.`
                // AND WHERE A THING CAME AWAY, IT IS NAMED
                : lifted.thing !== null
                    ? `${lifted.thing.object.name} `
                      + (lifted.thing.because === 'moored'
                          ? 'comes off its mooring and is standing where you are. '
                          : 'is out of their hands and into yours. ')
                      + `It is still ${party.name}'s - taking a thing does not make it yours - `
                      + 'and the record of how it came to you travels with it.'
                    : lifted.taken === 0
                        ? `${party.name} was carrying nothing worth the trouble, and that is the `
                          + 'whole of what came of it - except that they know.'
                        : `${lifted.taken} spirit stones off ${party.name}, out of the `
                          + `${lifted.hadBefore} they were carrying. It is in your own purse now, `
                          + 'with nothing in the ledger to say it was ever theirs.';
            facts.lines.push(took);
            facts.prose = `${facts.prose}\n\n${took}`;
            facts.structure.push(
                lifted === null
                    ? 'No possession moved. This wrong takes nothing by its nature; what it '
                      + 'leaves is the reprisal and the grudge.'
                    : lifted.thing !== null
                    ? `possessions.transferPossession: ${lifted.thing.object.id} possessor `
                      + `${party.id} -> ${cultivator.id}, how=stolen, transfersOwnership=false so `
                      + `owner stays ${lifted.thing.object.ownerId}. Held as `
                      + `${lifted.thing.because}; provenance now `
                      + `${lifted.thing.object.provenance.length} link(s). Missed as `
                      + `${lifted.thing.severity}, off significance `
                      + `${lifted.thing.object.significance}. The purse was not touched: a lift `
                      + 'is one act.'
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
     */
    /**
     * What a theft that came off actually takes, and why it is bounded.
     */
    whatALiftTook(
        this: GameService,
        cultivator: Cultivator,
        // An id and a name is all this reads, and widening it to that is what
        // lets the coercion path take a purse without a second lift. A
        // `ResolvedEntity` still satisfies it.
        party: { id: string; name: string },
        /**
         * The player's own sentence, where the caller has it.
         */
        said = '',
        /** The run's own clock, for the provenance link. */
        onDay = 0
    ): WhatALiftTook | null {
        // TWO PLACES A PERSON CAN LIVE, AND BOTH HAVE TO BE ROBBABLE
        const stored = this.repos.cultivators.getById(party.id);
        const npc = stored ? null : (this.atHand?.npcs ?? []).find(row => row.id === party.id);
        if (!stored && !npc) return null;

        // ── DID THEY NAME A THING, AND IS IT WITHIN REACH ────────────────
        //
        // Ahead of the purse, because a lift is one act: somebody who said they
        // are taking the boat is taking the boat, and emptying their pocket as
        // well would spend something the player did not say.
        const named = said.trim();
        const reach = named.length >= 3
            ? whichThingTheyMeant(
                whatIsWithinReachOf(this.atHand, party.id, cultivator.location),
                named
            )
            : null;
        if (reach) {
            const lifted = liftIt(reach, {
                thiefId: cultivator.id,
                thiefName: cultivator.name,
                fromName: party.name,
                onDay,
                here: cultivator.location
            });
            const at = this.atHand!.objects.findIndex(row => row.id === reach.object.id);
            if (at >= 0) this.atHand!.objects[at] = lifted.object;
            this.worldDirty = true;
            return {
                taken: 0,
                hadBefore: Math.max(0, Math.floor(stored ? stored.spiritStones : npc!.spiritStones)),
                loose: 0,
                thing: lifted
            };
        }

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
        return { taken, hadBefore, loose, thing: null };
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
        lifted: WhatALiftTook | null = null
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

        // AND IT GOES ON THE LEDGER, WHICH IS THE HALF THAT LASTS
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
        // AND A THING HAS A THIRD READING OF THE SAME QUESTION
        const readings = [verdict.grudge.severity, worthOfTheLoss]
            .concat(lifted?.thing ? [lifted.thing.severity] : []);
        const severity = readings.reduce(
            (worst, one) => (severityRank(one) > severityRank(worst) ? one : worst)
        );

        // AND WHO ELSE ENDS UP CARRYING IT
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
                ...(lifted?.thing ? [`took:${lifted.thing.object.id}`]
                    : lifted !== null ? [`took:${lifted.taken}`] : [])
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

        // A WOUND THAT IS NOT A KILLING MUST NOT KILL
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

        // THE WOUND, NAMED, AND WHAT IS LEFT IN THE BODY
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
            // AND THE EDGE, MARKED
            if (nearlyGone(standing)) {
                sayThisWhateverTheNarratorDoes(facts, theBodyIsNearlyGone(standing, standing.spiritStones));
            }
        }

        // AND IT CAN BE THE END
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

        // A HOUSE IS NOT A PERSON
        if (party.kind !== 'cultivator' || !party.party) {
            return this.interact(
                run, cultivator, ambient, query, 'negotiate',
                named.length >= 2 ? named : undefined, leverage, rawInput
            );
        }

        // WHAT THEY ARE AFTER, WHICH IS A READ AND NOT A REQUEST
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

        // WHAT WOULD IT TAKE, AND WHAT IS BEING PUT DOWN FOR IT
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

        // AND HOW MANY TIMES THEY HAVE HEARD IT
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

        // A REQUEST THAT CANNOT BE PUT
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

        // AND WHO THIS PARTICULAR PERSON IS
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

        // AND WHAT A REFUSAL WOULD LEAVE BEHIND
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

        // ONE INPUT, PRICED ONCE, ROLLED AT MOST ONCE
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
            // AND WHAT THE TWO OF THEM ALREADY ARE TO EACH OTHER
            theirTie: heldTie,
            yourTie: tieFrom(this.repos, cultivator.id, party.id),
            ledger: openLedgerBetween(this.repos, cultivator.id, party.id),
            // WHERE THIS IS HAPPENING. A term and never a gate, damped by whatever
            // tie the subject already holds, because the ruling is about the same
            // STRANGER saying the same thing.
            where: theGroundBetweenThem(this.atHand, this.worldPlaceOf(cultivator)),
            // AND WHAT THEY WANT THAT YOU ARE PART OF
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

        // WHAT IT WOULD TAKE, WITHOUT DOING IT
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

        // AND WHAT THE ATTEMPT LEFT BEHIND
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

        // AND WHETHER THEY WANTED ANYTHING OF YOU
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

        // A REFUSAL THAT NAMES A TRADE IS NOT A REBUFF
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
     * Every art a person could actually walk somebody down, from both of the places
     * one is written.
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

        // NOT HOLDING ONE, AND WHO IS
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
            // somebody carries them nowhere at all. Measured against a receiver at
            // rung 29, a middle Step is worth 0 to them and a higher one is worth
            // 33 - and with no receiver passed, both read 29.
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

        // ASKING THE PRICE IS A QUESTION, NOT AN ATTEMPT
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
            // WHERE THIS IS HAPPENING. A term and never a gate, damped by whatever
            // tie the subject already holds, because the ruling is about the same
            // STRANGER saying the same thing.
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
            // THE ROW MOVES. IT IS NOT COPIED
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
