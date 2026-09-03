/**
 * Sitting down for a long time, and everything that can interrupt it.
 *
 * `runSeclusion` is the verb the whole game is about: a cultivator sits, the
 * time-skip resolves the span in one deterministic pass, and what comes back
 * is a digest rather than a day-by-day simulation. Nobody is ever required to
 * live a decade an evening at a time.
 *
 * The rest of the module is what happens when the span does NOT run to the
 * end, and it is one subject because it is one decision taken twice. A broken
 * seclusion is a FORK, not an event: somebody interrupted a long sitting, and
 * the two things that were always physically available - go, or sit back down
 * - are both still open. The engine used to narrate that dilemma and then
 * resolve it silently, which is the engine deciding on a lucid character's
 * behalf, and it is a defect rather than a mode. `raiseTheCrossroads` puts the
 * question; `sitBackDown` and `getUpAndGo` are the two answers;
 * `settleAnyStandingCrossroads` is what happens when the player says something
 * else entirely, which is also an answer.
 *
 * `handBackWhatNeverHappened` is the one to be careful with. A span that was
 * cut short did not happen for its whole length, and what it returns is the
 * difference - so an error here is a player paying for years they did not
 * live.
 *
 * ── HOW THIS IS ATTACHED ──────────────────────────────────
 *
 * `GameService` methods living in another file, merged onto the prototype at
 * the bottom of `game.ts` with their signatures merged into the class
 * declaration. `this.runSeclusion(...)` resolves and typechecks exactly as it
 * did when the bodies sat in the class, and every line below is the line it
 * was. `src/web/README.md` has the argument and the warning about `private`.
 */

import { combatPowerForOrdinal } from '../engine/cultivation/combat.js';
import { techniqueCeiling } from '../engine/cultivation/cultivation.js';
import { canExistBeyondTheLid } from '../engine/cultivation/existence.js';
import { rankName } from '../engine/cultivation/realms.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import {
    type EncounterActivity,
    concealmentScale,
    sealedDoorFraction
} from '../engine/encounters/index.js';
import type { EncounterRoll } from '../engine/encounters/types.js';
import { wardHalfLifeYears } from '../engine/world/how-far-gone-a-formation-is.js';
import type { AmbientQi, Cultivator, Run, TimeSkipResult } from '../schema/cultivation.js';
import {
    isGuidingErrorBody,
    tollConditionsFor
} from '../server/consolidated/cultivation-support.js';
import { handleListAvailable } from '../server/consolidated/technique-manage.js';
import type { ActionName } from './actions.js';
import { applyTimeSkip } from './apply.js';
import {
    type SeclusionCrossroads,
    type WhoIsClose,
    howTheyAreReferredTo,
    whatGoingCost,
    whatStayingCommittedTo,
    whatTheForkAsks,
    whatTheForkAsksStructurally
} from './choosing-what-to-do-when-a-seclusion-is-broken.js';
import {
    PLAYER_ROLL_IDENTITY,
    activityForVerb,
    consumeArrivals,
    cutTo,
    daysActuallySpent,
    deltasDroppedBy,
    encounterCalls,
    encountersFor,
    recordEncounters,
    withEncounterDeltas
} from './encounters.js';
import {
    type EngineFacts,
    factsForRefusal,
    factsForTimeSkip,
    factsForToolResult,
    humanDays,
    placeName,
    rungAndOrdinal
} from './facts.js';
import { refused, skipCalls, tollCalls, worldCalls } from './tool-result-prose.js';
import {
    HURRIED_BELOW_DAYS,
    PROVISIONED_PREPARATION,
    SEALED_PREPARATION,
    SHORT_ACTION_DAYS
} from './turn-constants.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

/**
 * How much of an open seclusion gets through a door over the whole sitting.
 *
 * A shut door is not a ward, and it is not a constant either. `wardIntegrityOf`
 * halves a formation every `wardHalfLifeYears`, so the door somebody sat down
 * behind is weaker every year they stay behind it - which is the same clock the
 * world reads when it decides that an old sealed place has become enterable.
 *
 * Averaged across the stretch rather than sampled at either end, because the
 * time-skip takes ONE scale for the whole span: sampling at the start would
 * price a three-hundred-year sitting as though the ward were still fresh, and
 * sampling at the end would price the first decade as though it were already
 * gone. The mean of a halving curve over [0, Y] has a closed form and there is
 * no reason to approximate it.
 *
 * At full integrity this is the flat fraction the encounter tables use. At zero
 * integrity it is 1 - no reduction at all - because a formation that is
 * entirely gone is a person sitting in an open cave who believes otherwise.
 */
export function doorScaleOverStretch(
    setByOrdinal: number,
    days: number,
    hidden = false
): number {
    const years = Math.max(0, days) / 365;
    const halfLife = wardHalfLifeYears(setByOrdinal);
    const meanIntegrity = years <= 0
        ? 1
        : (halfLife / (years * Math.LN2)) * (1 - Math.pow(0.5, years / halfLife));
    const held = Math.min(1, Math.max(0, meanIntegrity));
    const fraction = sealedDoorFraction();
    // Linear between "the door is as set" and "there is no door".
    const throughTheDoor = fraction + (1 - fraction) * (1 - held);
    // A HIDDEN DOOR IS A DIFFERENT KIND OF PROTECTION AND MULTIPLIES WITH IT.
    //
    // The ward decides whether somebody who is standing at the door gets
    // through it. Concealment decides whether they are standing there at all,
    // and it filters by RUNG rather than by rate - hide the entrance and only
    // somebody at your own realm or above finds the place. The two are
    // independent, so they multiply: a decayed ward on a hidden cave is still
    // hidden, and a fresh ward on an obvious one is still obvious.
    return hidden ? throughTheDoor * concealmentScale(setByOrdinal) : throughTheDoor;
}

export const seclusionVerbs = {
    /**
     * Cultivating, provisioned out of the purse.
     *
     * The engine's food clock is not a nuisance to be routed around: a full
     * belly covers fifty turn-consuming actions, so a decade of unattended
     * cultivation genuinely is impossible without provisions, and buying them
     * is the "eat, or keep the stones" choice made concrete. Provisions are
     * bought up front at whatever the purse covers; when it does not cover the
     * whole stretch, the engine starves the remainder, which is correct.
     *
     * `sealed` is what separates `seclude` from `cultivate`, and it is a real
     * bargain rather than a flavour: closed-door seclusion turns off random
     * events, which buys safety from encounters at the price of every
     * opportunity that would have found you. Both halves are the engine's.
     */
    async runSeclusion(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        days: number,
        options: {
            sealed?: boolean;
            acknowledged?: boolean;
            askedFor?: number;
            /**
             * The fork this sitting is the second half of, when it is one.
             *
             * Set only by `sitBackDown`. It carries the rations the interrupted
             * half left in the pack, so the resumed span is not charged a
             * second time for food that was already bought, and it carries the
             * sentence saying what the player committed to.
             */
            resuming?: SeclusionCrossroads;
        } = {}
    ): Promise<Execution> {
        const sealed = options.sealed ?? false;
        const startDay = Math.floor(run.elapsedDays);

        // ── A STRETCH WHOSE RETURN IS ZERO IS NOT SOLD SILENTLY ──────────
        //
        // `techniqueCeiling` is a HARD zero, not a taper, and the engine knows
        // it on day zero. It used to say so on day zero and then spend the
        // years anyway, at full hazard, which is the single worst thing this
        // game does to a player. Two live runs, at opposite ends of the ladder:
        //
        //   a beginner with no manual sat 900 days for exactly 0 progress,
        //   collected a disturbance and a serious deviation on the way, then
        //   found a manual and died on the next action of the wounds the
        //   pointless stretch had given them. Turn 9.
        //
        //   ordinal 13, healthy, 100 years of rations, sat down for thirty
        //   years against an exhausted manual. The engine printed "it is
        //   stopped, and no amount of sitting with it changes that" on Day 0,
        //   ran thirteen more years, aged them 122 to 148 and killed them by
        //   stagnation.
        //
        // The second case is the general one and it will hit every player
        // repeatedly, because every cultivator reaches the end of a book many
        // times in a career. The cost is lifespan, which is the resource the
        // whole game is about.
        //
        // A refusal rather than a free pass. Making a zero-return stretch cost
        // nothing would be worse: it turns "sit until something happens" into a
        // dominant move and it lies about the cave, which is dangerous whether
        // or not anybody is making progress. So the years are still real and
        // still spendable - the player just has to mean it. Same shape as the
        // wasted-pill override, and for the same reason: this layer cannot ask
        // a question and wait for an answer.
        const wall = techniqueCeiling(
            cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap
        );
        if (wall.multiplier === 0 && !options.acknowledged) {
            return this.sittingWouldReturnNothing(cultivator, wall, days);
        }

        // `cultivate` reaches here without an action-level world load, and the
        // encounter layer reads the place and the people standing in it.
        this.atHand = await this.loadWorld();

        // BEFORE anything is spent. Provisioning is priced per day, and a
        // seclusion cut short in year eight should not have been provisioned
        // for twenty.
        const enc = encountersFor(
            { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
            {
                seed: run.seed,
                startDay,
                days,
                activity: sealed ? 'sealed' : 'seclusion',
                cultivator,
                arrivable: this.pendingArrivals,
                // The row id is a randomUUID and would make the run
                // irreproducible from its seed. See PLAYER_ROLL_IDENTITY.
                rollIdentity: PLAYER_ROLL_IDENTITY
            }
        );
        const lived = daysActuallySpent(enc, startDay, days);

        const provisioning = this.buyProvisions(
            cultivator, lived, options.resuming?.rationsLeft ?? 0
        );
        const provisioned = withEncounterDeltas(provisioning.cultivator, enc);
        const prepared = provisioning.covered >= lived;
        // Held rather than inlined: the ceiling is reported in the preamble
        // below off the same terms the rate was computed from, so the sentence
        // a player reads and the number the engine used cannot disagree.
        const terms = this.rateTermsFor(provisioned);

        const skip = simulateTimeSkip(provisioned, lived, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(provisioned),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: 1,
                ...terms,
                ground: this.groundFor(provisioned)
            },
            understanding: this.understandingFor(run, provisioned),
            techniqueElement: null,
            rations: provisioning.rations,
            grainAbstinence: false,
            autoBreakthrough: true,
            // A SHUT DOOR IS NOT A WARD.
            //
            // Sealing used to switch the encounter tables off entirely, and
            // that made closed-door seclusion a dominant strategy rather than
            // a trade: everything that can kill a cultivator in a long stretch
            // arrives through those tables, so a player who sealed was simply
            // safe. Found by playing - three runs died to wounds and to a
            // fight, and the fourth survived by never opening the door.
            //
            // The world does not stop at the threshold. A rogue cultivator
            // barges into the cave; somebody arrives at it needing help. Being
            // behind a door changes what happens next and does not decide
            // whether anything happens at all.
            //
            // What sealing still buys is real and is priced below: a sealed
            // crossing is a PREPARED one - the door is shut, the site was
            // chosen, and `SEALED_PREPARATION` is worth more than
            // `PROVISIONED_PREPARATION` at the toll and at the foundation.
            //
            // Nothing wanders into a True Immortal's seclusion, and that guard
            // stays: the encounter tables are the mortal world's and they do
            // not reach above the Lid.
            randomEvents: !canExistBeyondTheLid(cultivator),
            // The door is a rate, not a switch, and the rate is not constant:
            // a formation is a thing somebody built, and it goes. Over a long
            // enough sitting the ward the cultivator set on their own door
            // decays under them, and a door that is gone is not a door.
            //
            // Both ends of this now read the SAME arithmetic. A prospector
            // standing at a sealed ruin asking whether they can get in, and a
            // cultivator sitting behind their own seal wondering what can
            // reach them, are asking one question about one object - from
            // outside, a live cultivator's sealed cave and a dead one's are
            // indistinguishable, which is most of why anybody opens either.
            //
            // The half-life carries the cultivator's own rung, so this scales
            // with power the way the setting says it should: a seal set near
            // the bottom is largely gone within a lifetime, and one set near
            // the top holds for tens of thousands of years.
            randomEventScale: sealed ? doorScaleOverStretch(cultivator.realmOrdinal, lived) : 1,
            // A boundary crossed inside this stretch exacts its price, and it
            // can only take what the run actually owns. Handing it the real
            // rows is what makes the price a delete rather than an assertion.
            toll: {
                ...tollConditionsFor(this.repos, provisioned),
                // A sealed crossing is a prepared one: the door is shut, the
                // site was chosen, nobody is coming through it.
                preparation: prepared ? (sealed ? SEALED_PREPARATION : PROVISIONED_PREPARATION) : 0,
                hurried: lived < HURRIED_BELOW_DAYS
            },
            foundation: {
                preparation: prepared ? (sealed ? SEALED_PREPARATION : PROVISIONED_PREPARATION) : 0,
                hurried: lived < HURRIED_BELOW_DAYS
            }
        });

        const applied = applyTimeSkip(this.repos, { before: provisioned, run, skip });
        // The world spends exactly the days the cultivator spent. Not the days
        // that were asked for: a skip cut short by a wound stops the world at
        // the same hour it stopped the cultivator.
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
        const verb: ActionName = sealed ? 'seclude' : 'cultivate';

        // ── WHAT ACTUALLY HAPPENED, AGAINST WHAT WAS GOING TO ───────────
        //
        // `lived` is the encounter layer's own truncation and it is not the
        // last word: `simulateTimeSkip` then stops wherever IT likes - a wound,
        // a deviation threshold, a major encounter, a death - and everything
        // rolled between the two is a span nobody reached. Until this cut, all
        // of it was recorded, narrated and consumed off the arrivals list
        // anyway. Three playtests found it independently; the plainest was a
        // cultivator who died on day 5 and read a mission board on day 2995.
        //
        // Everything downstream reads `happened` rather than `enc`.
        const happened = cutTo(enc, startDay, skip.simulatedDays);
        this.handBackWhatNeverHappened(applied.cultivator, enc, happened);

        // AFTER the skip, because a knowledge grant is a write and writes belong
        // in phase 2. Phase 3 then only ever gets a licence to mention something
        // that is already true.
        const enc2 = recordEncounters(
            this.knowledge, applied.cultivator, applied.run.elapsedDays, happened, this.repos
        );
        this.pendingArrivals = consumeArrivals(this.pendingArrivals, happened);

        const facts = factsForTimeSkip(
            provisioned, applied.cultivator, skip, ambient,
            sealed ? 'Closed-door seclusion' : 'Seclusion',
            // `lived` was already cut down by the encounter layer before the
            // skip saw it, so the skip's own idea of what was requested is the
            // truncated figure. `days` is what the player actually said.
            days,
            // And what they said before the parser's own ceiling took a
            // thousandfold bite out of it without mentioning that it had.
            options.askedFor !== undefined && options.askedFor > days
                ? options.askedFor
                : undefined
        );
        facts.lines.unshift(provisioning.line);

        // ── WHAT THE CAVE MOUTH CHARGED, SAID OUT LOUD ───────────────────
        //
        // This line has been built and thrown away since it was written, and it
        // killed runs. `buyProvisions` tops the pack up at the door and charges
        // for it; the sentence describing the purchase went into `lines`, which
        // is a LICENCE, and a narrator that would rather write about the
        // mountain simply did not use it. Observed on a live server: a purse
        // going 24 -> 6 -> 0 across two seclusions with nothing said either
        // time, then starvation on the third turn, by a sixteen-year-old who
        // started with thirty stones.
        //
        // The playtester who found it first logged those two deaths as their
        // own harness error, which is the measure of how invisible it was.
        //
        // A purse being spent is the definition of a fact a player cannot play
        // without, so it takes the same treatment `method_ceiling` already has.
        (facts.required ??= []).push(provisioning.line);

        // ── AND ANYTHING THAT STOPPED THE STRETCH ────────────────────────
        //
        // Same failure, same span, and worse. A serious qi deviation was rolled
        // with `interrupts: true` - "cultivation is halted until the deviation
        // is cleansed" - and did not appear in the narration at all. An event
        // that ENDED the thing the player paid for is not a detail a stylist
        // may drop for pacing: it is the reason the stretch came back short,
        // and without it the player reads a truncated seclusion as the engine
        // miscounting.
        //
        // Only the interrupting ones. A digest of forty lines all marked
        // required is a digest with nothing required in it.
        for (const event of skip.events) {
            if (event.interrupts) facts.required.push(event.summary);
        }

        // ── AND IF IT STOPPED BECAUSE OF SOMEBODY, IT IS A QUESTION ──────
        //
        // The one interrupt in the whole file that is not a fact about the
        // cultivator's own body. A wound, a deviation, an empty pack - those
        // have happened and the only honest thing to do is report them. A
        // person at the cave mouth has not happened yet, and `time-skip.ts`
        // already writes two sentences saying so and naming both costs.
        //
        // What it could not do was hold the question open, so the engine
        // answered it: "You came out early. 5.3 years of the 40 years were
        // spent; the rest was not yours to spend." The player was told they had
        // a choice and then shown the outcome of a choice somebody else made.
        //
        // `raiseTheCrossroads` puts it back. Nothing here changes what was
        // rolled, what it cost, or the chance of anything - the stretch stopped
        // exactly where it stopped, and both branches out of it were always
        // physically there. What changes is who takes one.
        if (options.resuming) {
            // Said before the fork is possibly raised again, so a second
            // interruption reads as a second question rather than as the first
            // one repeating.
            const committed = whatStayingCommittedTo(
                options.resuming,
                howTheyAreReferredTo(
                    options.resuming.whoIsClose,
                    options.resuming.whoIsClose
                        ? rankName(options.resuming.whoIsClose.realmOrdinal)
                        : null
                )
            );
            facts.lines.unshift(committed);
            (facts.required ??= []).push(committed);
        }
        // `applied.run`, not `run`: the skip has already booked its turn, and a
        // question stamped with the turn before the one it was asked on reads
        // as a stale record to anybody auditing the log.
        this.raiseTheCrossroads(applied.run, applied.cultivator, skip, facts, {
            sealed,
            acknowledged: options.acknowledged ?? false,
            daysAsked: lived,
            startDay
        });

        // ── THE CEILING, BEFORE THE DECADE RATHER THAN AFTER ─────────────
        //
        // The engine files a `method_ceiling` event and it arrives inside a
        // digest of forty other lines, which is the worst possible place for
        // the only fact in the span a player can act on. Said here as well, at
        // the top, in its own right - and marked required, so it survives a
        // narrator that would rather write about the weather.
        //
        // Not an interrupt, deliberately. Being told is not a reason to stop a
        // seclusion out from under somebody who chose it knowingly, and an
        // interrupt every chunk would leave a stalled cultivator unable to pass
        // time at all.
        const ceiling = techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap);
        if (ceiling.line !== null) {
            facts.lines.unshift(ceiling.line);
            (facts.required ??= []).push(ceiling.line);
        }

        if (sealed) {
            // ── THE PROSE YIELDS TO THE MEASUREMENT ──────────────────────
            //
            // This used to read "no encounter and no opportunity could reach
            // this stretch", and it had been false since the door became a rate
            // rather than a switch. `randomEvents` is on behind a seal, scaled
            // by `doorScaleOverStretch`, and the comment at that call site says
            // in full why: a door that made a cultivator simply safe made
            // closed-door seclusion the dominant strategy rather than a trade.
            //
            // A player who reads the old sentence and is then interrupted has
            // been told the engine lied to them, which is worse than being
            // interrupted. So this says what the seal actually buys - a rate,
            // and a better crossing - and it says that the rate is not zero and
            // does not stay where it was set.
            facts.lines.unshift(
                'The door was sealed. Less reaches you behind it and it is not nothing: a seal '
                + 'is a thing somebody built, it thins what finds you rather than stopping it, '
                + 'and over a long enough sitting it goes on its own. What it certainly buys is '
                + 'the crossing - a shut door and a chosen site are worth more at the boundary '
                + 'than provisions alone.'
            );
        }
        facts.lines.push(...applied.tollLines);
        facts.lines.push(...enc2.lines);
        facts.lines.push(...world.lines);
        facts.structure.push(...enc2.structure);
        facts.structure.push(...world.structure);
        if (world.lines.length > 0) {
            facts.prose = `${facts.prose}\n\n${world.lines.join('\n')}`;
        }

        return {
            facts,
            events: [...skip.events, ...enc2.events].sort((a, b) => a.dayOffset - b.dayOffset),
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...skipCalls(verb, skip, provisioning.line),
                ...tollCalls(applied.tollLines),
                ...encounterCalls(happened, verb, enc),
                ...worldCalls(world)
            ]
        };
    },

    /**
     * Take back what the cultivator was credited for a span they never spent.
     *
     * `withEncounterDeltas` runs BEFORE the skip, because the skip needs a
     * starting HP and a starting purse. So by the time `cutTo` works out which
     * days were actually lived, the HP and stones of occurrences that never
     * happened are already folded in. Left alone, the sheet would disagree with
     * the account the player just read - which is the same defect as the events
     * themselves, one layer down.
     *
     * A write rather than a re-run of the skip: re-running it with different
     * starting HP is a balance change wearing a bug fix's clothes, and it can
     * shift where the skip stops, which is the very thing being measured here.
     *
     * Silent when nothing was dropped, which is the ordinary case. Never on a
     * cultivator the run has already closed: a death is final and the repo
     * refuses the write in any case.
     */
    handBackWhatNeverHappened(
        this: GameService,
        after: Cultivator,
        rolled: EncounterRoll,
        happened: EncounterRoll
    ): void {
        if (!after.alive) return;
        const dropped = deltasDroppedBy(rolled, happened);
        if (dropped.hp === 0 && dropped.spiritStones === 0) return;
        this.repos.cultivators.applyDeltas(after.id, {
            hp: -dropped.hp,
            spiritStones: -dropped.spiritStones
        });
    },

    // ── A BROKEN SECLUSION IS A QUESTION ─────────────────────────────────
    //
    // Everything from here to `settleAnyStandingCrossroads` is one feature and
    // it is described in full in
    // `choosing-what-to-do-when-a-seclusion-is-broken.ts`. The short version:
    // the engine stops a long sitting when somebody comes near, writes two very
    // good sentences about the two things the cultivator could do, and then did
    // one of them without asking. These four methods are the asking.

    /**
     * Hold the fork open for one turn, if the stretch stopped because of a person.
     *
     * Only `major_encounter`. Every other interrupt is a fact about the
     * cultivator's own body that has already happened - a torn channel, a
     * deviation, an empty pack - and there is nothing to decide about a thing
     * that is already true. A person at the cave mouth has not arrived yet, and
     * that is the entire difference.
     *
     * `canWithdraw` is READ off the event the engine filed, never re-rolled. It
     * was decided by a sample drawn against the cultivator's own Fortune inside
     * `simulateTimeSkip` and re-deciding it here would be a second opinion on
     * something that already has one - the exact shape of defect the authority
     * rule exists to forbid.
     */
    raiseTheCrossroads(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        skip: TimeSkipResult,
        facts: EngineFacts,
        context: {
            sealed: boolean;
            acknowledged: boolean;
            /** The span the skip was handed, after the encounter layer's own cut. */
            daysAsked: number;
            startDay: number;
        }
    ): void {
        // Whatever question was standing has been answered by getting here at
        // all: this turn was a seclusion, which is either the resumption or a
        // fresh sitting, and both settle the old one.
        this.crossroads = null;

        if (skip.interruptReason !== 'major_encounter') return;
        if (!cultivator.alive) return;

        const remaining = Math.floor(context.daysAsked - skip.simulatedDays);
        // A stretch that stopped on its own last day has nothing left to
        // decide about. Offering a fork over zero days would be a panel with
        // nothing behind either button.
        if (remaining < 1) return;

        const filed = [...skip.events].reverse().find(event =>
            event.kind === 'encounter' && event.data?.severity === 'major');
        if (!filed) return;

        const crossroads: SeclusionCrossroads = {
            runId: run.id,
            cultivatorId: cultivator.id,
            raisedOnTurn: run.turn,
            canWithdraw: filed.data?.canWithdraw === true,
            sealed: context.sealed,
            acknowledged: context.acknowledged,
            daysAsked: Math.floor(context.daysAsked),
            daysSpent: Math.floor(skip.simulatedDays),
            daysRemaining: remaining,
            stoppedOnDay: Math.floor(context.startDay + skip.simulatedDays),
            rationsLeft: Math.max(0, Math.floor(skip.endState.rationsRemaining ?? 0)),
            whoIsClose: this.whoIsCloseNow(cultivator)
        };
        this.crossroads = crossroads;

        // ── AND THE SENTENCE THAT USED TO ANSWER IT COMES OUT ────────────
        //
        // `factsForTimeSkip` closes every interrupted stretch with "You came
        // out early. 5.3 years of the 40 years were spent; the rest was not
        // yours to spend." That is exactly right for a torn channel or an empty
        // pack, where the stretch ended because something already happened. It
        // is the defect itself when the stretch ended on a QUESTION: read live,
        // it announced the outcome of a decision two paragraphs before the
        // decision was put to the player, and it says the years are not theirs
        // in the same breath as offering them.
        //
        // Removed here rather than conditioned at source because the condition
        // is not knowable there - `factsForTimeSkip` sees an interrupt and not
        // whether anybody is going to be asked about it. When these two files
        // are next open together the branch belongs in `facts.ts`, keyed on the
        // same fact this method tests.
        const CAME_OUT_EARLY = 'You came out early.';
        facts.prose = facts.prose
            .split('\n\n')
            .filter(paragraph => !paragraph.startsWith(CAME_OUT_EARLY))
            .join('\n\n');

        const question = whatTheForkAsks(crossroads, this.howToReferToThem(crossroads));
        facts.lines.push(question);
        // Required, for the same reason the provisioning line and every
        // interrupting event are required: a narrator that drops the question
        // leaves the player reading an outcome nobody chose, which is the whole
        // defect this exists to close.
        (facts.required ??= []).push(question);
        facts.structure.push(whatTheForkAsksStructurally(crossroads));
    },

    /**
     * Who the world says is close enough to matter.
     *
     * A READ, and nothing but a read. `present` is the same crowd the hearsay
     * layer and every pointing phrase resolve against, in the same single total
     * order, and the last of it is what `somebodyAtHand` already means by "the
     * nearest cultivator" - see `oneCrowd` for why that order exists and why it
     * must not be recomputed here.
     *
     * `combatPowerForOrdinal` prices both of them off the ladder alone. Deeper
     * pricing would need attributes, wounds and what they are carrying, and the
     * roster carries none of those - `assessPower` on a half-built combatant
     * would be a worse number than an honest coarse one. What this is for is
     * the operator's line saying who was outside and roughly what they were
     * worth; nothing reads it back and nothing resolves against it.
     *
     * Null when the world is off or the place holds nobody, and the sentences
     * degrade to the engine's own "whoever that is" rather than inventing a
     * person to fill the slot.
     */
    whoIsCloseNow(this: GameService, cultivator: Cultivator): WhoIsClose | null {
        const here = this.present(cultivator);
        if (here.length === 0) return null;
        const them = here[here.length - 1];
        return {
            id: them.id,
            name: them.name,
            realmOrdinal: them.realmOrdinal,
            theirPower: combatPowerForOrdinal(them.realmOrdinal),
            yourPower: combatPowerForOrdinal(cultivator.realmOrdinal),
            known: this.knowledge.isAwareOf(cultivator.id, 'cultivator', them.id)
        };
    },

    /** A name only if it has been earned; otherwise the rung, which anybody can feel. */
    howToReferToThem(this: GameService, crossroads: SeclusionCrossroads): string {
        return howTheyAreReferredTo(
            crossroads.whoIsClose,
            crossroads.whoIsClose ? rankName(crossroads.whoIsClose.realmOrdinal) : null
        );
    },

    /**
     * The player sat back down. Spend the rest of the sitting.
     *
     * The whole of staying is one call into the ordinary seclusion path for the
     * remaining days, starting from the day it stopped - which the run's clock
     * is already standing on, because the first half advanced it. Every roll in
     * `time-skip.ts` and in `src/engine/encounters/` is keyed to an ABSOLUTE
     * day, so the surviving days give exactly what they were always going to
     * give and a forty-year sitting split into 5.3 and 34.7 is the same forty
     * years. There is no second simulation and no modifier anywhere in it.
     *
     * It can be interrupted again, and if it is, that is a second question and
     * not the first one repeating.
     */
    async sitBackDown(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        crossroads: SeclusionCrossroads
    ): Promise<Execution> {
        this.crossroads = null;
        return await this.runSeclusion(run, cultivator, ambient, crossroads.daysRemaining, {
            sealed: crossroads.sealed,
            // Already answered for this sitting. Asking again would refuse the
            // second half of a stretch the player has explicitly recommitted to.
            acknowledged: crossroads.acknowledged,
            resuming: crossroads
        });
    },

    /**
     * The player got up. Say what that cost, and take no day for saying it.
     *
     * A turn of attention and nothing else. The remaining days are already
     * gone - they were never spent, and this is the sentence that says so - and
     * charging a day on top would be billing somebody for the act of answering.
     */
    getUpAndGo(
        this: GameService,
        run: Run,
        crossroads: SeclusionCrossroads
    ): Execution {
        this.crossroads = null;
        const them = this.howToReferToThem(crossroads);
        const cost = whatGoingCost(crossroads, them);
        const facts = factsForToolResult(
            crossroads.canWithdraw
                ? 'Up, and out by the road that does not cross them.'
                : 'On your feet, which is all getting up buys.',
            [cost],
            cost
        );
        facts.required = [cost];
        facts.structure.push(
            `The crossroads raised on turn ${crossroads.raisedOnTurn} was answered by leaving. `
            + `${crossroads.daysSpent} of ${crossroads.daysAsked} days stand spent and `
            + `${crossroads.daysRemaining} were forfeited unspent. No day passed answering: the `
            + 'remainder was never simulated, so there is nothing to take back and nothing to '
            + 'refund. '
            + (crossroads.canWithdraw
                ? 'A clean withdrawal had been rolled available, so nobody saw the place.'
                : 'No clean withdrawal had been rolled, so the only thing that changed is '
                  + 'posture.')
        );
        const execution = this.freeAction(run, 'wait', facts);
        execution.calls = [{
            name: 'engine.seclusionCrossroads',
            action: 'leave',
            summary:
                `The interrupted sitting was ended by the player. ${crossroads.daysRemaining} `
                + 'unspent days forfeited; nothing was rolled and no day passed.',
            ok: true
        }];
        return execution;
    },

    /**
     * Anything that spends a day instead of sitting is going, and it says so.
     *
     * The fork is not a modal jail. A player who answers it by travelling, by
     * eating, by taking work or by walking down the mountain has made the
     * decision - they are not sitting any more - and the engine's job is to say
     * what that cost rather than to refuse every verb until the question has
     * been answered in the approved words. AGENTS.md, agency: do not ban.
     *
     * A FREE ACTION IS NOT GOING. The test is whether THE CLOCK MOVED, not
     * whether a turn was taken. `freeAction` exists because "looking around
     * must never be able to kill you, and in a permadeath game that is a rule,
     * not a courtesy" - and charging thirty-four years for "what am I
     * carrying", for a refusal, or for a sentence the parser could not resolve
     * would break that rule harder than anything it was written against. None
     * of those take the cultivator off the seat and none of them bring the
     * person outside a day closer, so the question is still open and still
     * theirs.
     *
     * Called after phase 2 and before phase 3 on every path that can take a
     * turn, so the sentence is in the facts the narrator is handed rather than
     * bolted onto prose that has already been written.
     */
    settleAnyStandingCrossroads(
        this: GameService,
        execution: Execution,
        crossroads: SeclusionCrossroads,
        cultivator: Cultivator,
        clockMoved: boolean
    ): void {
        if (!clockMoved) return;
        if (execution.outcome === 'refused') return;
        // Identity, not a blanket clear. A player who answered by starting a
        // FRESH sitting has had a new question raised inside this same turn by
        // `raiseTheCrossroads`, and nulling the field here would throw it away
        // and resolve the new fork silently - which is this bug, reintroduced
        // one turn later by its own fix.
        if (this.crossroads === crossroads) this.crossroads = null;
        if (!cultivator.alive) return;

        const cost = whatGoingCost(crossroads, this.howToReferToThem(crossroads));
        execution.facts.lines.push(cost);
        (execution.facts.required ??= []).push(cost);
        execution.facts.structure.push(
            `The crossroads raised on turn ${crossroads.raisedOnTurn} was answered by doing `
            + `something else, which is leaving. ${crossroads.daysRemaining} unspent days of the `
            + `${crossroads.daysAsked} were forfeited. Nothing was refunded and nothing further `
            + 'was rolled for them.'
        );
    },

    /**
     * The zero-return refusal, and where the next volume is.
     *
     * Honest was never the problem - `techniqueCeiling.line` is one of the best
     * sentences in the game and it was already being printed. The problem was
     * that it was printed and then ignored, and that it stopped at the
     * diagnosis. "What is missing is the next volume" is true and leaves the
     * player standing in the same cave with no idea where a volume comes from.
     *
     * So the refusal carries the pointer. The candidates come out of the same
     * catalog read `list_techniques` uses, filtered to cultivation arts that
     * carry FURTHER than this cultivator currently stands, which is the exact
     * definition of "the next volume". Naming one is worth more than naming
     * four: a player who has been stopped needs a next step, not a menu.
     *
     * Free, like every refusal: no time, no food, no roll.
     */
    async sittingWouldReturnNothing(
        this: GameService,
        cultivator: Cultivator,
        wall: ReturnType<typeof techniqueCeiling>,
        days: number
    ): Promise<Execution> {
        const next = await this.theNextVolume(cultivator);

        const wouldBe = wall.state === 'no_method'
            ? 'There is no road for the qi to take, so the whole stretch returns exactly nothing.'
            : 'The book has ended, so the whole stretch returns exactly nothing.';

        const pointer = next
            ? `${next} carries further than you stand, and you could be taught it. `
              + 'Ask who would teach you, or what there is to learn.'
            : 'Ask what there is to learn, and who would teach you. Neither costs a day.';

        return refused('engine.techniqueCeiling', 'cultivate', factsForRefusal(
            `${humanDays(days)} of sitting would produce nothing.`,
            `${wall.line} ${wouldBe} ${pointer} `
            + 'Say it again with "anyway" and the years go by regardless - they are yours to spend.',
            (wall.state === 'no_method'
                ? 'No method is practised, so the rate multiplier at '
                : 'The manual has ended, so the rate multiplier at ')
            + `${rungAndOrdinal(cultivator.realmOrdinal)} is 0 and the stretch returns exactly `
            + 'nothing. '
            + `${days} day${days === 1 ? ' was' : 's were'} refused before anything was spent: `
            + 'no provisioning, no encounter roll, no time passed.'
        ));
    },

    /**
     * The best art in reach that carries further than this cultivator stands.
     *
     * Returns a NAME or null, and nothing else - this is a pointer inside a
     * refusal, not a second listing verb. Reads through the same handler
     * `list_techniques` uses so the two cannot come to disagree about what is
     * available, and stays silent rather than guessing if that read fails.
     */
    async theNextVolume(this: GameService, cultivator: Cultivator): Promise<string | null> {
        try {
            const listed = await handleListAvailable({
                action: 'list_available',
                cultivatorId: cultivator.id,
                includeConflicting: false,
                includeForbidden: false
            });
            if (isGuidingErrorBody(listed)) return null;

            const compatible = (listed as {
                compatible?: {
                    name?: string;
                    known?: boolean;
                    class?: string;
                    carriesToOrdinal?: number | null;
                }[];
            }).compatible ?? [];

            const reaching = compatible
                .filter(row =>
                    row.known !== true
                    && row.class === 'cultivation'
                    && typeof row.name === 'string'
                    && (row.carriesToOrdinal ?? -1) > cultivator.realmOrdinal)
                .sort((a, b) => (b.carriesToOrdinal ?? 0) - (a.carriesToOrdinal ?? 0));

            return reaching[0]?.name ?? null;
        } catch {
            // A pointer that cannot be read is a pointer the refusal does
            // without. It must never be the reason the refusal fails to arrive.
            return null;
        }
    },

    async shortSkip(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        focus: number,
        label: string,
        days = SHORT_ACTION_DAYS,
        activity: EncounterActivity = activityForVerb(label)
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);

        const enc = encountersFor(
            { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
            {
                seed: run.seed,
                startDay,
                days,
                activity,
                cultivator,
                arrivable: this.pendingArrivals,
                // The row id is a randomUUID and would make the run
                // irreproducible from its seed. See PLAYER_ROLL_IDENTITY.
                rollIdentity: PLAYER_ROLL_IDENTITY
            }
        );
        const lived = daysActuallySpent(enc, startDay, days);
        const before = withEncounterDeltas(cultivator, enc);

        const skip = simulateTimeSkip(before, lived, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: focus,
                ...this.rateTermsFor(before),
                ground: this.groundFor(before)
            },
            understanding: this.understandingFor(run, before),
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, lived),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // The same cut the long path takes, and for the same reason: a short
        // action can still be stopped early by the skip, and an occurrence past
        // that day did not happen. See `cutTo`.
        const happened = cutTo(enc, startDay, skip.simulatedDays);
        this.handBackWhatNeverHappened(applied.cultivator, enc, happened);

        const enc2 = recordEncounters(
            this.knowledge, applied.cultivator, applied.run.elapsedDays, happened, this.repos
        );
        this.pendingArrivals = consumeArrivals(this.pendingArrivals, happened);

        // ── WHAT THE PLAYER ASKED FOR, NOT WHAT WAS LEFT OF IT ───────────
        //
        // The same defect `runSeclusion` was fixed for, on the path that serves
        // every other span-spending verb: wait, work, a sect duty, a ride, a
        // fold, a passage and a proposal all arrive here.
        //
        // `days` is the player's own figure. `lived` is what the encounter
        // layer left of it, and `simulateTimeSkip` records THAT as its
        // `requestedDays` - so with nothing passed, `factsForTimeSkip` falls
        // back to the truncated span and tells the player their own intention,
        // wrongly. Played, on a fresh nobody:
        //
        //   > I wait a year
        //   "Waiting of 4 months was intended." ... and fifty days were spent.
        //
        // Worse than a cosmetic misreport: because `asked` equalled
        // `requestedDays`, the paragraph that exists to say "it was never going
        // to be a year, something was already coming" could not fire at all.
        // The player is told a shorter span than they asked for AND is not told
        // why it was shortened.
        //
        // Travel and foraging cannot drift this way - both hand
        // `simulateTimeSkip` the same figure they were asked for, with no
        // encounter cut in between - so they are left alone rather than given a
        // parameter that could only ever repeat itself.
        const facts = factsForTimeSkip(before, applied.cultivator, skip, ambient, label, days);
        facts.lines.push(...enc2.lines);
        facts.lines.push(...world.lines);
        facts.structure.push(...enc2.structure);
        facts.structure.push(...world.structure);
        if (world.lines.length > 0) {
            facts.prose = `${facts.prose}\n\n${world.lines.join('\n')}`;
        }

        return {
            facts,
            events: [...skip.events, ...enc2.events].sort((a, b) => a.dayOffset - b.dayOffset),
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...skipCalls(label.toLowerCase().startsWith('practice') ? 'train_technique' : 'wait', skip, null),
                ...encounterCalls(happened, label.toLowerCase(), enc),
                ...worldCalls(world)
            ]
        };
    }
};
