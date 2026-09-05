/**
 * Sitting down for a long time, and everything that can interrupt it.
 */

import { combatPowerForOrdinal } from '../engine/cultivation/combat.js';
import { techniqueCeiling } from '../engine/cultivation/cultivation.js';
import { insightName, integrateInsight } from '../engine/cultivation/understanding.js';
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
import type {
    AmbientQi,
    Cultivator,
    InsightDomain,
    Run,
    TimeSkipResult
} from '../schema/cultivation.js';
import {
    type CultivationRepos,
    isGuidingErrorBody,
    persistUnderstanding,
    daoHeartConditions,
    tollConditionsFor
} from '../server/consolidated/cultivation-support.js';
import { copiesHeldBy, handleListAvailable } from '../server/consolidated/technique-manage.js';
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
    return hidden ? throughTheDoor * concealmentScale(setByOrdinal) : throughTheDoor;
}

/**
 * The comprehension a dao partner further along the road hands over.
 */
function grantAnInsightFromAPartner(
    repos: CultivationRepos,
    cultivator: Cultivator,
    road: { subject: string; domain: InsightDomain },
    partnerName: string
): string | null {
    const achievement = {
        id: `dao-partner-${cultivator.id}-${road.domain}-${road.subject}-${Math.floor(cultivator.age)}`,
        kind: 'extraordinary_instruction' as const,
        onDay: 0,
        turn: 0,
        summary: `Sat the same art with ${partnerName}, who is further along the same road.`,
        detail: { partner: partnerName, subject: road.subject }
    };
    const taken = integrateInsight(cultivator.insights ?? [], {
        domain: road.domain,
        subject: road.subject,
        access: { kind: 'teacher', label: partnerName },
        opening: `sitting the same art beside ${partnerName}, who has been further down it`
    }, achievement);

    // Already as far down this road as the degrees go. Nothing was granted, so
    // nothing is written and nothing is said.
    if (!taken.deepened && (cultivator.insights ?? []).some(
        i => i.domain === road.domain && i.subject === road.subject
    )) {
        return null;
    }

    persistUnderstanding(repos, cultivator.id, [taken.insight], [achievement]);
    return `And something on the road came clear that had not been: ${insightName(taken.insight)}, `
        + `off ${partnerName}, who had already passed the place you were standing.`;
}

export const seclusionVerbs = {
    /**
     * Cultivating, provisioned out of the purse.
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
             */
            resuming?: SeclusionCrossroads;
            /**
             * The dao partner sitting the same art beside them for the whole
             * stretch.
             */
            daoPartner?: {
                id: string;
                name: string;
                bonusDays: number;
                theirBonusDays: number;
                insight: { subject: string; domain: InsightDomain } | null;
            };
        } = {}
    ): Promise<Execution> {
        const sealed = options.sealed ?? false;
        const startDay = Math.floor(run.elapsedDays);

        // A STRETCH WHOSE RETURN IS ZERO IS NOT SOLD SILENTLY
        const wall = techniqueCeiling(
            cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap,
            copiesHeldBy(this.db, cultivator.id).length > 0
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
                ground: this.groundFor(provisioned),
                // The flat day figure the pure function returned, spent over
                // the span actually lived. `lived` and not `days`: a stretch a
                // wound cut short at day four did not get thirty days of
                // company out of it, and dividing by what was asked for would
                // pay a bonus for years nobody sat.
                ...(options.daoPartner && lived > 0
                    ? { sharedPracticeBonus: 1 + options.daoPartner.bonusDays / lived }
                    : {})
            },
            understanding: this.understandingFor(run, provisioned),
            techniqueElement: null,
            rations: provisioning.rations,
            grainAbstinence: false,
            autoBreakthrough: true,
            // A SHUT DOOR IS NOT A WARD.
            randomEvents: !canExistBeyondTheLid(cultivator),
            // The door is a rate, not a switch, and the rate is not constant: a
            // formation is a thing somebody built, and it goes. Over a long enough
            // sitting the ward the cultivator set on their own door decays under
            // them, and a door that is gone is not a door.
            randomEventScale: sealed ? doorScaleOverStretch(cultivator.realmOrdinal, lived) : 1,
            // 道心. A wall crossed inside a stretch weighs the record exactly as
            // a deliberate strike does. `daoHeartConditions` is the one
            // derivation and `crossing.ts` is the other door onto it - if the
            // two came apart, seclusion would be the cheap way past a wall and
            // a player who found it would be climbing a different ladder.
            ...daoHeartConditions(this.repos.db, provisioned, Math.floor(run.elapsedDays)),
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

        // WHAT ACTUALLY HAPPENED, AGAINST WHAT WAS GOING TO
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

        // WHAT THE CAVE MOUTH CHARGED, SAID OUT LOUD
        (facts.required ??= []).push(provisioning.line);

        // AND WHO WAS SITTING THERE WITH THEM
        if (options.daoPartner) {
            const partner = options.daoPartner;
            const days_ = (n: number) => `${n} day${n === 1 ? '' : 's'}' progress`;
            facts.lines.unshift(
                `${partner.name} sat the same art beside you for the whole stretch. You came out `
                + `${days_(partner.bonusDays)} ahead of where you would have alone`
                + (partner.theirBonusDays === partner.bonusDays
                    ? ', and so did they.'
                    : `, and they came out ${days_(partner.theirBonusDays)} ahead of theirs - `
                      + 'whichever of you is further back on the road takes the larger share of '
                      + 'it.')
            );
            facts.required.push(facts.lines[0]);

            // The other half of what a partner further along is worth, and the
            // half that is not a rate. Written to the row here rather than
            // returned, because `applyTimeSkip` has already saved the stretch
            // and an insight granted after it is an insight the next turn can
            // see.
            if (partner.insight) {
                const took = grantAnInsightFromAPartner(
                    this.repos, applied.cultivator, partner.insight, partner.name
                );
                if (took !== null) {
                    facts.lines.unshift(took);
                    facts.required.push(took);
                }
            }
        }

        // AND ANYTHING THAT STOPPED THE STRETCH
        for (const event of skip.events) {
            if (event.interrupts) facts.required.push(event.summary);
        }

        // AND IF IT STOPPED BECAUSE OF SOMEBODY, IT IS A QUESTION
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

        // THE CEILING, BEFORE THE DECADE RATHER THAN AFTER
        const ceiling = techniqueCeiling(
            cultivator.realmOrdinal, terms.techniqueCap,
            copiesHeldBy(this.db, cultivator.id).length > 0
        );
        if (ceiling.line !== null) {
            facts.lines.unshift(ceiling.line);
            (facts.required ??= []).push(ceiling.line);
        }

        if (sealed) {
            // THE PROSE YIELDS TO THE MEASUREMENT
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

    // A BROKEN SECLUSION IS A QUESTION

    /**
     * Hold the fork open for one turn, if the stretch stopped because of a person.
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

        // AND THE SENTENCE THAT USED TO ANSWER IT COMES OUT
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
            ...daoHeartConditions(this.repos.db, cultivator, Math.floor(run.elapsedDays)),
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

        // WHAT THE PLAYER ASKED FOR, NOT WHAT WAS LEFT OF IT
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
