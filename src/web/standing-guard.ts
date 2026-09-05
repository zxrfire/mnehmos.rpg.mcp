/**
 * 护法: standing over somebody else's crossing while they cannot defend it.
 *
 * The impure edge around
 * `engine/cultivation/standing-guard-over-somebody-elses-crossing.ts`, which
 * has been complete since it was written - the weight a protector contributes,
 * the standing the arrangement needs, what a watch is worth to the odds, what
 * the vigil costs the person standing there - and had **no caller anywhere in
 * `src/`**. Every constant in it, including `TRUST_FLOOR` and
 * `VIGIL_RISK_AT_FULL_EXPOSURE`, was reachable by nothing.
 *
 * ── WHY THIS ONE MATTERED MORE THAN THE OTHER UNWIRED MODULES ────────────
 *
 * A probe of the genre's tropes against `parseIntent` found the verb surface
 * badly lopsided: 15 of 20 TAKING sentences reached a verb against 3 of 10
 * GIVING ones, and two of that three were `give` and `oath`. Under this repo's
 * epigraph that is a defect rather than a tone - **a vocabulary that can only
 * say the taking version of an act has taken a side**, which is the same
 * finding `furnace-technique.ts` produced pointing the other way. This is the
 * largest giving mechanic the engine already owned and could not be asked for.
 *
 * ── WHAT THIS FILE DECIDES, WHICH IS ALMOST NOTHING ──────────────────────
 *
 * The engine module decides whether the arrangement exists, what it is worth
 * and what it costs. `an-npc-striking-at-the-next-wall.ts` decides the
 * crossing, on the same `attemptBreakthrough` a player gets. `whatADeedLeaves`
 * prices the kindness and says which accounts open. What is here is the four
 * facts about the played world none of them can have: who is standing in this
 * square, what the tie between the two of them says and how old it is, what
 * ground they are both on, and how long the player said they would stand
 * there.
 *
 * ── THE BAR IS READ FROM THE SIDE THAT HAS TO EXTEND THE TRUST ───────────
 *
 * `wouldStandGuard` takes the standing between the two people and answers
 * whether the arrangement can be made at all. When the PLAYER offers, the
 * willingness half is already settled - they typed it - so what the engine has
 * to ask is the other half, and it is the same number: `DAO_PROTECTOR.theTrust`
 * calls accepting a protector the most complete trust available in this world,
 * and the subject is the one extending it. So the standing passed in is the
 * subject's own `NpcRelationship.standing` toward the player, which is the
 * world's stored -1..+1 axis and the same field `whoAnsweredTheShout` reads for
 * whether somebody comes when you shout. Nothing is invented for the occasion,
 * and a refusal comes back with the module's own reason on it.
 *
 * ── AND IT IS NOT SAFER THAN THE TAKING HALF ─────────────────────────────
 *
 * `resolveVigil` rolls one wound per protector against
 * `VIGIL_RISK_AT_FULL_EXPOSURE x whatArrivesAt x vigilExposure`, and the
 * severity is `crippling` where the share reaches half - which is every watch
 * kept a realm below a tribulation rung. The wound is an ordinary `createInjury`
 * through the ordinary path and it kills the ordinary way, by being carried.
 * Standing guard at the top of the ladder for somebody who is not close enough
 * to you is not available; standing there for somebody who is can end you.
 */

import {
    MAX_PROTECTION_BONUS,
    protectionAsAShareOfTheBase,
    protectionBonus,
    protectorWeight,
    resolveVigil,
    standingGuardCost,
    watchWeight,
    whatArrivesAt,
    wouldStandGuard,
    type GuardAnswer,
    type Protector,
    type Watch
} from '../engine/cultivation/standing-guard-over-somebody-elses-crossing.js';
import { rankName, triggersHeavenlyTribulation } from '../engine/cultivation/realms.js';
import { forStream } from '../engine/cultivation/rng.js';
import {
    guideOrdinalFor,
    readyToStrike,
    strikeAtTheWall
} from '../engine/world/an-npc-striking-at-the-next-wall.js';
import { BOOKLESS_CEILING, reachableCeilingFor } from '../engine/world/manuals.js';
import { roadsInReachOf } from '../engine/world/how-a-cultivator-comes-by-a-road.js';
import { groundRateAt } from '../engine/world/the-ground-somebody-is-actually-standing-on.js';
import { markDead } from '../engine/world/npc-state.js';
import { recordCrossing } from '../engine/world/recording-what-a-crossing-did.js';
import { aDeedEntersTheWorld } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { createObligation } from '../engine/social/grudges.js';
import { writeObligation, type DatabaseHandle } from './encounters.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

/**
 * How long a watch runs when the player did not say.
 *
 * The engine has no figure for how long a crossing takes and the protector
 * module says outright that it is not the place to invent one - `vigilDays` is
 * supplied because "the caller is spending that span on the subject already and
 * knows it". So the span is the PLAYER'S, taken off their own sentence, and
 * this is only what a sentence with no duration in it means. Thirty days is the
 * shortest stretch the seclusion picker treats as a real one, which makes a
 * bare "I stand guard for her" a month rather than an afternoon.
 */
export const A_WATCH_WITH_NO_LENGTH_SAID = 30;

/**
 * The one intent this verb reads, and it selects a READ rather than an outcome.
 *
 * "Who would stand guard for me" is a question about the roster and must never
 * be answered by standing a watch. Anything else - including an intent nobody
 * recognises - falls through to the acting branch, which refuses safely
 * because it needs a person standing here before it spends anything.
 */
export const GUARD_IS_A_QUESTION = 'ask';

/** The most days a single watch may run for, so a typo cannot spend a life. */
export const LONGEST_WATCH = 365 * 10;

/**
 * The plain sentence for each way the arrangement can fail to exist.
 *
 * Keyed off `GuardAnswer.reason` so the refusal and the decision cannot drift,
 * and each one names the fact that would change the answer rather than
 * restating that it failed - the standard `standing.ts` sets for every refusal
 * in this package.
 */
const WHY_NOT: Readonly<Record<
    NonNullable<GuardAnswer['reason']>,
    (them: string, answer: GuardAnswer) => string
>> = {
    cannot_matter: them =>
        `Whatever comes down for ${them} will not notice you are there. A protector is worth `
        + 'what they could actually stand against, counted in whole realms, and two below the '
        + 'attempt is not a fight - it is somebody else in the blast. Standing there would not '
        + 'change their odds by anything at all.',
    not_bound_closely_enough: (them, answer) =>
        `${them} would not let you. Handing somebody your defence for the whole of a crossing `
        + 'is the most complete trust anybody extends in this world, and what it takes rises '
        + `with what is coming: this one needs ${answer.standingRequired.toFixed(2)} and the two `
        + 'of you do not stand there yet. Time, and things done for them, are the only two '
        + 'things that move it.',
    tie_too_new: them =>
        `You have not known ${them} long enough. An arrangement like this is almost never made `
        + 'between parties who are not already bound by something older than it, and the tie '
        + 'between you is younger than the arrangement would be.'
};

export const guardVerbs = {
    /**
     * Stand guard over somebody's crossing.
     *
     * Reads as a refusal in every case where the arrangement does not exist,
     * and each refusal names what would change it. Where it does exist the
     * span is spent, the crossing is resolved with the watch folded into the
     * odds, the wound is rolled, and the account it opens is written.
     */
    async standGuard(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        named: string | undefined,
        days: number | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;

        const wanted = (named ?? '').trim().toLowerCase();
        const here = this.present(cultivator).filter(row => row.id !== cultivator.id);

        // ── WHO, AND THE READ WHEN NOBODY WAS NAMED ──────────────────────
        //
        // A bare "who would stand guard for me" is the free half of this verb
        // and is answered below by `whoWouldStandOverYourCrossing`. What lands
        // here is a sentence that named somebody the square does not hold.
        const subjectRow = wanted.length >= 2
            ? here.find(row => row.name.toLowerCase().includes(wanted))
            : undefined;
        if (!subjectRow) {
            return refused('guard.whoIsHere', 'guard', factsForRefusal(
                wanted.length >= 2
                    ? `${(named ?? '').trim()} is not standing here.`
                    : 'You did not say who.',
                here.length > 0
                    ? 'A watch is kept in the same room as the person keeping it. Here with you: '
                      + `${here.slice(0, 8).map(row => row.name).join(', ')}.`
                    : 'A watch is kept in the same room as the person keeping it, and there is '
                      + 'nobody here to keep one over.',
                `guard: ${here.length} row(s) at ${cultivator.location ?? 'nowhere'}, none `
                + `matching "${(named ?? '').trim().slice(0, 40)}". Nothing spent.`
            ));
        }

        const npc = world?.npcs.find(row => row.id === subjectRow.id) ?? null;
        if (!world || !npc) {
            // The subject has to be somebody the WORLD holds, because the
            // crossing is resolved against a world record - their book, their
            // teacher, the ground and both of their clocks. A stored-only row
            // carries none of that, and inventing it would be a second
            // breakthrough path beside `strikeAtTheWall`.
            return refused('guard.notAWorldRecord', 'guard', factsForRefusal(
                `You cannot stand over ${subjectRow.name}'s crossing.`,
                'What a watch is worth is decided against the book in their hands, whoever is '
                + 'teaching them and the years they have stood at their rung, and none of that '
                + 'is written down for this person.',
                'guard: subject has no `NpcRecord`. `readyToStrike` was not called and nothing '
                + 'was spent.'
            ));
        }

        // ── TWO CLOCKS, AND ONLY ONE OF THEM IS THIS PERSON'S ────────────
        //
        // Everything about the subject is dated in WORLD days - the tie's
        // `sinceDay`, `lastAdvancedOnDay`, `accumulatingSinceDay`, the lifespan
        // - and the run's own clock starts near zero. Asking `wouldStandGuard`
        // whether a tie is older than ten years against `run.elapsedDays`
        // compares a number in the hundreds against one in the hundreds of
        // thousands, and every tie in the world reads as made yesterday.
        // Measured: a forty-thousand-day friendship came back `tie_too_new`.
        const today = Math.floor(world.currentDay);
        // What the LEDGER is dated in, which is the run's clock, exactly as
        // `giveSomething` and `whatTheKillLeft` already date theirs.
        const onDay = Math.floor(run.elapsedDays);

        // ── WOULD THE ARRANGEMENT EXIST AT ALL ───────────────────────────
        //
        // The standing is the subject's own toward the player, off the row the
        // world already keeps, and the tie's `sinceDay` is how old it is.
        // Somebody with no row at all stands at zero, which is below
        // `TRUST_FLOOR` at every rung - a stranger does not hand you their
        // defence, and no rule anywhere had to say so.
        const tie = npc.relationships.find(row => row.targetId === cultivator.id) ?? null;
        const me: Protector = {
            id: cultivator.id,
            name: cultivator.name,
            realmOrdinal: cultivator.realmOrdinal,
            standing: tie?.standing ?? 0,
            ...(tie ? { tieSinceDay: tie.sinceDay } : {})
        };
        const answer = wouldStandGuard(me, npc.cultivation.realmOrdinal, today);
        if (!answer.willing) {
            return refused('engine.wouldStandGuard', 'guard', factsForRefusal(
                answer.reason === 'cannot_matter'
                    ? `You are too far below what ${npc.name} is walking into.`
                    : `${npc.name} would not put their crossing in your hands.`,
                WHY_NOT[answer.reason ?? 'not_bound_closely_enough'](npc.name, answer),
                `wouldStandGuard: reason=${answer.reason}, standing=${me.standing.toFixed(2)}, `
                + `required=${answer.standingRequired.toFixed(2)}, riskAsked=`
                + `${answer.riskAsked.toFixed(3)}, weight=`
                + `${protectorWeight(me.realmOrdinal, npc.cultivation.realmOrdinal).toFixed(2)}. `
                + 'Nothing spent.'
            ));
        }

        // ── ARE THEY ACTUALLY AT A WALL ──────────────────────────────────
        //
        // `readyToStrike` is the world's own arithmetic and is asked here
        // unchanged. Almost everybody is refused by it, which is correct and is
        // what makes the answer worth anything: a watch is kept over a crossing
        // and there is no crossing to keep one over most of the time.
        const location = npc.locationId === null
            ? undefined
            : world.locations.find(row => row.id === npc.locationId);
        const manualCeiling = reachableCeilingFor(world, npc) || BOOKLESS_CEILING;
        const byId = new Map(world.npcs.map(row => [row.id, row]));
        const readiness = readyToStrike(npc, today, {
            // The ground both of them are standing on. `ambient` is the band
            // the turn already computed for this square, and the rate is the
            // one this location supplies - today's figure rather than the
            // yearly pass's average over a chamber allocation, because a watch
            // is a thing happening in one place on one day.
            ambient,
            rateMultiplier: groundRateAt(location) ?? 1,
            guideOrdinal: guideOrdinalFor(npc, byId),
            manualCeiling
        });
        if (!readiness.ready) {
            return refused('engine.readyToStrike', 'guard', factsForRefusal(
                `${npc.name} is not about to cross anything.`,
                readiness.settled
                    ? `${npc.name} is finished climbing. The rung above them costs more than the `
                      + 'years they have left or more than the years anybody is allowed to stand '
                      + 'at one, and no watch changes arithmetic. There is nothing here to guard.'
                    : `${npc.name} is still accumulating. They have `
                      + `${readiness.yearsAccumulated.toFixed(0)} of the `
                      + `${readiness.yearsNeeded.toFixed(0)} years the next rung asks of them, `
                      + 'and a watch is kept over a crossing rather than over a cultivation.',
                `readyToStrike: ready=false, settled=${readiness.settled}, `
                + `yearsAccumulated=${readiness.yearsAccumulated.toFixed(2)}, yearsNeeded=`
                + `${readiness.yearsNeeded.toFixed(2)}, yearsStood=`
                + `${readiness.yearsStood.toFixed(2)}. Nothing spent.`
            ));
        }

        // ── WHAT THE WATCH IS WORTH, AND WHAT IT COSTS TO KEEP ───────────
        const watch: Watch = { protectors: [me] };
        const ordinal = npc.cultivation.realmOrdinal;
        const bonus = protectionBonus(watch, ordinal);
        const share = MAX_PROTECTION_BONUS > 0 ? bonus / MAX_PROTECTION_BONUS : 0;
        const vigilDays = Math.max(
            1, Math.min(LONGEST_WATCH, Math.floor(days ?? A_WATCH_WITH_NO_LENGTH_SAID))
        );
        const cost = standingGuardCost(me, ordinal, vigilDays);

        // ── THE CROSSING ─────────────────────────────────────────────────
        //
        // The same `attemptBreakthrough` the player gets, through the same
        // `strikeAtTheWall` the world's own advancement pass runs, with the
        // watch handed over as `protection`. Its own stream, keyed on the
        // subject and the day, so a run replayed from its seed guards the same
        // crossing to the same end and no other draw anywhere moves.
        const strike = strikeAtTheWall(
            npc, today, readiness,
            forStream(run.seed, 'stand-guard', npc.id, today),
            ambient,
            roadsInReachOf(world, npc),
            { share, by: [cultivator.name] }
        );
        if (!strike) {
            return refused('engine.strikeAtTheWall', 'guard', factsForRefusal(
                `${npc.name} cannot make the attempt.`,
                'Something they are carrying closes the road for good. A cracked core is refused '
                + 'at the wall for the rest of a life however long that life is, and no watch '
                + 'opens a door that has been shut from the inside.',
                'strikeAtTheWall returned null - `canAttemptBreakthrough` refused the subject. '
                + 'Nothing spent.'
            ));
        }

        // ── WHAT THE PERSON STANDING THERE TOOK ──────────────────────────
        const vigil = resolveVigil(
            watch, ordinal,
            forStream(run.seed, 'vigil', npc.id, today),
            run.turn, vigilDays
        )[0];
        const hurt = vigil?.injuries ?? [];
        for (const injury of hurt) {
            this.repos.cultivators.addInjury(cultivator.id, {
                id: injury.id,
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn,
                woundType: injury.woundType
            });
        }

        // ── AND THE WORLD HOLDS THE SUBJECT'S NEW STATE ──────────────────
        const at = world.npcs.findIndex(row => row.id === npc.id);
        if (strike.died) {
            world.npcs[at] = markDead(
                npc, today,
                triggersHeavenlyTribulation(ordinal)
                    ? `Called down the tribulation at ${rankName(ordinal)} and did not hold it, `
                      + `with ${cultivator.name} standing over it.`
                    : `The crossing out of ${rankName(ordinal)} did not open, and closed, with `
                      + `${cultivator.name} standing over it.`
            );
        } else {
            world.npcs[at] = strike.npc;
        }
        recordCrossing(world, world.npcs[at], strike.result, today);
        this.worldDirty = true;

        // ── THE ACCOUNT IT OPENS ─────────────────────────────────────────
        //
        // Priced by `whatADeedLeaves` through `aDeedEntersTheWorld`, which is
        // the one pricer, at `paidBy: 'actor'` - the direction that makes this
        // a kindness and opens a FAVOUR on the protector's side rather than a
        // grudge. The cost is `riskAsked`, which is what the module already
        // decided was being asked of the person standing there, against the
        // one thing they had to give: a share of whatever came down.
        //
        // WITNESSES ARE ZERO WHERE NOBODY ELSE IS IN THE SQUARE, and that is
        // load-bearing rather than tidy. `whatItWasWorth` weighs an unwitnessed
        // kindness one step HIGHER, because public virtue is already paid for
        // by reputation and helping somebody where nobody would ever have known
        // is the thing that tells them something. A watch kept alone in a cave
        // is worth more than one kept in a courtyard, and no rule here says so.
        const others = here.filter(row => row.id !== npc.id).length;
        const mine = this.repos.sects.getMembership(cultivator.id);
        const deed = aDeedEntersTheWorld(world, {
            kind: 'debt_incurred',
            day: today,
            locationId: npc.locationId,
            place: cultivator.location ?? 'nowhere anybody has named',
            actors: [
                { id: cultivator.id, name: cultivator.name, role: 'stood over it' },
                { id: npc.id, name: npc.name, role: 'crossed' }
            ],
            factionIds: npc.factionId ? [npc.factionId] : [],
            summary:
                `${cultivator.name} stood guard over ${npc.name}'s crossing at `
                + `${rankName(ordinal)} for ${vigilDays} days, and it `
                + `${strike.result.outcome === 'success' ? 'opened' : 'did not open'}.`,
            unattributed:
                'Somebody went into a crossing with their back covered, and nobody outside the '
                + 'room could say by whom.',
            price: {
                deed: {
                    // `shielded_crossing` has been a `FavorCause` since the
                    // ledger was written and nothing had ever produced one.
                    // The vocabulary was already right; what was missing was
                    // the act.
                    cause: 'shielded_crossing',
                    paidBy: 'actor',
                    cost: answer.riskAsked,
                    // What a wound at a crossing takes does not come back. The
                    // flag is the module's own word for it and it is true here
                    // exactly when the roll landed.
                    irreversible: hurt.length > 0,
                    onDay,
                    description: cost.obligation.note,
                    witnesses: others,
                    participants: [npc.id]
                },
                actor: {
                    id: cultivator.id,
                    name: cultivator.name,
                    houseId: mine?.sectId ?? cultivator.sectId ?? null,
                    houseName: null,
                    alignment: null,
                    ranked: (mine?.rankIndex ?? 0) > 0
                },
                subject: {
                    id: npc.id,
                    name: npc.name,
                    houseId: npc.factionId,
                    houseName: null,
                    alignment: null,
                    ranked: npc.factionRankIndex > 0
                }
            },
            data: {
                vigilDays,
                protectionShare: share,
                subjectOrdinal: ordinal,
                outcome: strike.result.outcome
            }
        });

        const calls: ToolCallRecord[] = [{
            name: 'engine.wouldStandGuard',
            action: 'guard',
            summary:
                `willing at standing ${me.standing.toFixed(2)} against required `
                + `${answer.standingRequired.toFixed(2)}; riskAsked `
                + `${answer.riskAsked.toFixed(3)}; weight `
                + `${watchWeight(watch, ordinal).toFixed(2)} of a full watch.`,
            ok: true
        }, {
            name: 'engine.protectionBonus',
            action: 'guard',
            summary:
                `+${(bonus * 100).toFixed(1)} points on the crossing, which is `
                + `${(protectionAsAShareOfTheBase(watch, ordinal) * 100).toFixed(0)}% of the `
                + `base chance at ${rankName(ordinal)}; share ${share.toFixed(2)} of `
                + `MAX_PROTECTION_BONUS. Folded by strikeAtTheWall, not by this file.`,
            ok: true
        }, {
            name: 'engine.strikeAtTheWall',
            action: 'guard',
            summary:
                `${(strike.result.finalChance * 100).toFixed(1)}% final chance, rolled `
                + `${strike.result.roll.toFixed(4)} - ${strike.result.outcome}. `
                + `${strike.result.narrationHint}`,
            ok: true
        }, {
            name: 'engine.resolveVigil',
            action: 'guard',
            summary:
                `wound chance ${(cost.woundChance * 100).toFixed(1)}% at severity `
                + `${cost.woundSeverity} over ${cost.vigilDays} days; `
                + `${hurt.length} taken. Exposure is the mirror of the weight, so standing `
                + 'below the attempt is the dangerous side of it.',
            ok: true
        }];

        if (deed) {
            calls.push({
                name: 'world.aDeedEntersTheWorld',
                action: 'guard',
                summary:
                    `${deed.fact.id} (debt_incurred, ${deed.weight}, magnitude `
                    + `${deed.fact.magnitude.toFixed(2)}) priced by whatADeedLeaves at cost `
                    + `${answer.riskAsked.toFixed(3)}; it reached ${deed.leaves?.reached}.`,
                ok: true
            });
            // ── AND THE ROWS IT OPENS ARE WRITTEN ────────────────────────
            //
            // `whatADeedLeaves` decided every one of them, holder-first, and
            // none of it is re-decided here. This is the giving direction of
            // the exact loop `hunt` already runs for a killing: the same
            // pricer, the same ledger, the same fact id on every row.
            for (const opens of deed.leaves?.opens ?? []) {
                const record = createObligation({ ...opens, triggeringEventId: deed.fact.id });
                writeObligation(this.db as unknown as DatabaseHandle, record);
                calls.push({
                    name: 'social.createObligation',
                    action: 'guard',
                    summary:
                        `${record.id}: ${record.holderId} holds a ${record.severity} `
                        + `${record.kind} about ${record.subjectId} for ${record.cause}, off `
                        + `${deed.fact.id}. Permanent until settled, and inheritable.`,
                    ok: true
                });
            }
        }

        // ── THE SPAN, SPENT THE ORDINARY WAY ─────────────────────────────
        //
        // `shortSkip`, after the wound is on the sheet, so the days are lived
        // by the body that took it - the deviation risk an untreated wound
        // raises is the ordinary one and a watch does not get a clean span for
        // having been generous. The encounter window is over it too: standing
        // still beside a crossing is exactly as findable as standing still
        // anywhere else.
        const wounded = this.repos.cultivators.getById(cultivator.id) ?? cultivator;
        const spent = await this.shortSkip(
            run, wounded, ambient, WATCH_FOCUS,
            `Standing guard over ${npc.name}'s crossing`, vigilDays
        );

        const lines = [
            strike.result.outcome === 'success'
                ? `${npc.name} came out of it at ${rankName(strike.npc.cultivation.realmOrdinal)}.`
                : strike.died
                    ? `${npc.name} did not come out of it.`
                    : `${npc.name} did not get through, and is still standing at `
                      + `${rankName(ordinal)}.`,
            `The watch was worth ${(bonus * 100).toFixed(1)} points on the attempt - `
            + `${(protectionAsAShareOfTheBase(watch, ordinal) * 100).toFixed(0)}% of what a `
            + `crossing at ${rankName(ordinal)} is worth on its own.`,
            hurt.length > 0
                ? `You took ${hurt[0].description}`
                : 'What came down passed close and did not land on you.',
            ...spent.facts.lines
        ];

        const facts = factsForToolResult(
            strike.result.outcome === 'success'
                ? `${npc.name} crossed, and you were standing over it.`
                : `${npc.name} did not cross, and you were standing over it.`,
            lines
        );
        facts.structure.push(
            `guard: subject=${npc.id} at ordinal ${ordinal}; watchWeight `
            + `${watchWeight(watch, ordinal).toFixed(2)}; protection share ${share.toFixed(3)}; `
            + `whatArrivesAt ${whatArrivesAt(ordinal).toFixed(2)}; vigilDays ${vigilDays}; `
            + `wounds ${hurt.length}; outcome ${strike.result.outcome}.`
        );
        // ── WHAT THE PLAYER CANNOT PLAY WITHOUT ──────────────────────────
        //
        // A crippling wound taken for somebody else, and a death. Both are
        // irreversible and both are the kind of thing prose drops - the same
        // reason `required` exists at all.
        const grave = hurt.filter(injury =>
            injury.severity === 'crippling' || injury.severity === 'serious');
        if (grave.length > 0 || strike.died) {
            facts.required = [
                ...(strike.died ? [`${npc.name} died at the wall.`] : []),
                ...grave.map(injury => `You are carrying ${injury.description}`)
            ];
        }

        return {
            facts,
            events: spent.events,
            timeSkip: spent.timeSkip,
            breakthrough: null,
            outcome: 'executed',
            calls: [...calls, ...spent.calls]
        };
    },

    /**
     * Who standing here would keep a watch over your own next crossing.
     *
     * The free read, and the reason it is worth having: the arrangement is
     * refused far more often than it is made, and a player who cannot see who
     * WOULD stand has no way to tell a mechanic that is closed to them from one
     * that does not exist. `wouldStandGuard` is asked of each person in the
     * square with the two of them the other way round - their standing toward
     * you is what the world stores, and it is the same number either way when
     * the question is whether the tie carries the arrangement.
     *
     * Nothing is spent and nothing is written. Every name in it is one the
     * caller has already run the presence gate over.
     */
    whoWouldStandOverYourCrossing(
        this: GameService,
        run: Run,
        cultivator: Cultivator
    ): Execution {
        // The WORLD's clock, because every tie's `sinceDay` is dated in it and
        // `wouldStandGuard` asks how old the tie is. See the note in
        // `standGuard`: the run's clock reads every friendship as new.
        const today = Math.floor(this.atHand?.currentDay ?? run.elapsedDays);
        const mine = cultivator.realmOrdinal;
        const willing: string[] = [];
        const short: string[] = [];

        for (const row of this.present(cultivator)) {
            if (row.id === cultivator.id) continue;
            const npc = this.atHand?.npcs.find(other => other.id === row.id) ?? null;
            const tie = npc?.relationships.find(t => t.targetId === cultivator.id) ?? null;
            const answer = wouldStandGuard({
                id: row.id,
                name: row.name,
                realmOrdinal: row.realmOrdinal,
                standing: tie?.standing ?? 0,
                ...(tie ? { tieSinceDay: tie.sinceDay } : {})
            }, mine, today);
            if (answer.willing) willing.push(row.name);
            else if (answer.reason === 'not_bound_closely_enough') short.push(row.name);
        }

        const facts = factsForToolResult(
            willing.length > 0
                ? `${willing.length} here would stand over your crossing.`
                : 'Nobody here would stand over your crossing.',
            [
                willing.length > 0
                    ? `They would: ${willing.slice(0, 8).join(', ')}.`
                    : 'A protector is the only defence a crossing has, because the person '
                      + 'making it cannot defend anything. Nobody standing here is bound to '
                      + 'you closely enough, or stands high enough to matter against what '
                      + 'would come down.',
                ...(short.length > 0
                    ? [`Close, and not close enough: ${short.slice(0, 8).join(', ')}. What it `
                       + 'takes rises with what is coming, and things done for somebody are '
                       + 'what moves it.']
                    : [])
            ]
        );
        facts.structure.push(
            `guard/ask: ${willing.length} willing, ${short.length} short on standing, against a `
            + `crossing at ${rankName(mine)}. Nothing spent.`
        );
        return this.freeAction(run, 'guard', facts);
    }
};

/**
 * What a watch does to the guard's own cultivation over the span.
 *
 * Zero, and it is a statement rather than a default: the whole of what a
 * protector spends is days they are not spending on their own climb, which the
 * module's own `VigilCost` says is expressed by simply not advancing them. A
 * focus multiplier above zero would be the engine quietly paying somebody back
 * for a kindness, which is the one thing the epigraph forbids.
 */
const WATCH_FOCUS = 0;
