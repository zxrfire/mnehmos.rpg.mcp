/**
 * The `craft` verb: a player at a bench, and what comes off it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS MISSING, WHICH WAS ONLY THIS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Nothing about building is decided here. `half-built-craft.ts` holds the
 * player's whole turn - which bill they meant, the rung gate, what comes out of
 * the pouch, how far the work may run ahead of the materials, the abandon
 * branch, the launch and what it mints - and it was written, tested, and had
 * NO IMPORTER IN `src/`. `building-a-conveyance-out-of-what-a-hunt-brings-back.ts`
 * underneath it has been live for houses the whole time, on the yearly world
 * pass.
 *
 * So this file is the joint and not the mechanism: it runs the plan, spends the
 * days through the same `shortSkip` every other span-spending verb runs
 * through, lands the write, and puts what was minted into the world. Every line
 * of it is somebody else's function called in order.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ORDER, AND WHY IT IS THIS ONE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *     plan          reads and decides. Writes nothing except an abandonment,
 *                   which `planTheBuild` owns because rendering "it comes off
 *                   the stocks" over a slip that is still standing is the
 *                   class of defect that whole module exists to close.
 *     the days      `shortSkip`, so the food clock, the world tick and the
 *                   encounter window run over a stretch at a bench exactly as
 *                   they do over a stretch of foraging.
 *     land          takes the materials, puts the work in, launches if it is
 *                   finished. Only ever called on a `work` plan.
 *     the world     what a launch minted becomes a row. Without this step a
 *                   player could finish a spirit boat and own nothing.
 *
 * The days go BEFORE the write because a cultivator who dies at the bench did
 * not finish the hull, and `applyTimeSkip` is what decides whether they are
 * still alive to put the last day in.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT HERE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A second yard. `workOn` takes `hands` because a house has several and divides
 * the work between them; a person is one pair, and the days do not divide. That
 * is why a spirit boat is 2,400 days of work for somebody alone and why a house
 * with four qualified elders is the only body that finishes one in a lifetime -
 * and it is the catalog's arithmetic rather than a rule stated here. Hiring a
 * yard is a real and missing thing; see {@link A_YARD_IS_NOT_HIREABLE_YET}.
 */

import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import {
    landTheBuild,
    planTheBuild,
    whichBillTheyMeant,
    type BuildPlan
} from './half-built-craft.js';
import { landTheMaking, planTheMaking } from './making-a-thing-at-your-own-bench.js';
import { forStream } from '../engine/cultivation/rng.js';
import { aVehicleOf } from '../engine/world/a-vehicle.js';
import { addToPouch } from '../server/consolidated/cultivation-support.js';
import { daysAtTheWork } from '../engine/social-leverage/commissioning-a-craft.js';
import { intoTheRoomTheWorkIsDoneIn } from './walking-inside-the-walls.js';
import { aBenchCouldMakeThat } from './what-somebody-was-asked-to-make.js';
import { whatIsBeingCut } from './communication-talisman-phrasings.js';
import type { GameService } from './turn-engine.js';
import { refused } from './tool-result-prose.js';
import { BENCH_FOCUS } from './turn-constants.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';


/**
 * Nobody can be paid to build for you, and that is an absence rather than a
 * decision.
 *
 * `what-each-house-makes-and-what-crosses-the-water.ts` says which houses hold
 * smiths and wrights and its own header says it models no production - and
 * `HOUSE_ARTISANS` has no consumer anywhere. So the shape of the missing thing
 * is a commission: a bill, somebody else's hands against it, a price and a
 * wait. Every piece of the arithmetic for it already exists - `workOn` divides
 * by hands, `successRateFor` reads the best hand, `quoteSale` prices work - and
 * what is absent is a party to put it to. Written down rather than half-built.
 */
export const A_YARD_IS_NOT_HIREABLE_YET =
    'You are the only pair of hands on it. There is nobody in this engine yet who takes a '
    + 'commission and builds a thing for money.';

export const craftVerbs = {
    /**
     * Build something, carry on with something, or walk away from it.
     *
     * `target` is the bill they named, or empty to carry on with whatever is on
     * the stocks. `days` is a span they asked for; absent, `planTheBuild` uses
     * `DAYS_AT_THE_BENCH` and says so out loud, because an engine that
     * substitutes a figure and reports it back as the player's intention is
     * telling them their own intention.
     *
     * `rawInput` reaches `planTheBuild` and is read for exactly one question -
     * whether they are abandoning what is standing - because `extractSubject`
     * hands back the object of the verb and the word that says they are walking
     * away from it is not in `target` at all.
     */
    async craft(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        days: number | undefined,
        rawInput = ''
    ): Promise<Execution> {
        const today = Math.floor(run.elapsedDays);
        const said = (target ?? '').trim();

        // Communication talismans are counted stock cut by the handful, not a
        // bench's one thing. See `sending-word-on-a-communication-talisman.ts`.
        if (whatIsBeingCut(said) !== null) {
            return await this.cutCommunicationTalismans(run, cultivator, ambient, said);
        }

        // ── A YARD OR A BENCH ────────────────────────────────────────────
        //
        // Two crafts and two material systems, and which one a sentence is for
        // is decided by the NOUN rather than by the verb - "I build a carriage"
        // and "I cut an earth-grade talisman" are both `craft`. The yard is
        // asked first and its own matcher answers: a sentence it claims is the
        // yard's, whatever else is in it, so nothing here can steal a hull.
        if (whichBillTheyMeant(said) === null && aBenchCouldMakeThat(said)) {
            return await this.atYourOwnBench(run, cultivator, said, today);
        }

        const plan: BuildPlan = planTheBuild({
            db: this.db,
            cultivator,
            said: (target ?? '').trim(),
            raw: rawInput,
            today,
            ...(days === undefined ? {} : { days })
        });

        // ── THE THREE THAT COST NOTHING ──────────────────────────────────
        //
        // `listing` and `abandoned` are executed reads; `refused` is a refusal
        // and has to read as one. `abandoned` is NOT a refusal even though it
        // costs nothing - it changed the world, and a caller that renders it as
        // one has told the player the slip is clear while it stands there.
        if (plan.kind === 'refused') {
            const answer = refused(
                'half-built-craft.planTheBuild',
                'craft',
                factsForRefusal(plan.headline, plan.lines.join(' '), plan.structure[0])
            );
            // The refusal's own reasons are the route, and a route stated only
            // in the first line is a route the player does not get.
            answer.facts.lines = plan.lines.slice();
            answer.facts.structure = plan.structure.slice();
            return answer;
        }
        if (plan.kind === 'listing' || plan.kind === 'abandoned') {
            const facts = factsForToolResult(plan.headline, plan.lines);
            facts.structure.push(...plan.structure);
            return this.freeAction(run, 'craft', facts);
        }

        // ── AND THE ONE THAT SPENDS ──────────────────────────────────────
        const spent = await this.shortSkip(
            run, cultivator, ambient, BENCH_FOCUS,
            `Working at ${plan.recipe!.name.toLowerCase()}`, plan.daysToWork!
        );

        // The sheet after the days, because the launch is rolled against the
        // rung the builder actually finished at and because somebody who died
        // at the bench put no last day in.
        const after = this.repos.cultivators.getById(cultivator.id) ?? cultivator;
        if (!after.alive) {
            const facts = factsForToolResult(
                'The work stops where you did.',
                [...spent.facts.lines, 'What was on the stocks is still on the stocks.']
            );
            facts.structure.push(
                `craft: ${plan.recipe!.id} left at ${plan.berth!.workDaysDone}/`
                + `${plan.recipe!.workDays} work days. The builder did not come back to it.`
            );
            return {
                facts,
                events: spent.events,
                timeSkip: spent.timeSkip,
                breakthrough: null,
                outcome: 'executed',
                calls: spent.calls
            };
        }

        const landed = landTheBuild({
            db: this.db,
            cultivator: after,
            plan,
            runSeed: run.seed,
            today: Math.floor(this.repos.runs.getById(run.id)?.elapsedDays ?? run.elapsedDays),
            // Where a tracked craft is moored. `cultivator.location` is free
            // text the engine stores and never computes with, which is exactly
            // what a mooring is.
            // `Cultivator.location` is nullable and a mooring is a place, so
            // a body that is nowhere the world has a name for moors what it
            // builds at the honest answer rather than at an empty string.
            mooredAt: after.location ?? 'nowhere anybody has named'
        });

        // ── AND IT BECOMES A ROW ─────────────────────────────────────────
        //
        // `mintCraft` decides whether there is an object at all and hands it
        // back rather than writing it; nothing had ever taken it. Without this
        // a player could finish a spirit boat, be told it was theirs, and own
        // nothing - the narration asserting an outcome the database never took,
        // which is the one thing this package exists to make impossible.
        // A counted-grade conveyance finished at the bench is a vehicle too: it goes with them, and
        // with no world to stand it in it is a count in the pouch as it was.
        if (landed.builtCounted) {
            this.atHand = this.atHand ?? await this.loadWorld();
            if (this.atHand) {
                this.atHand.objects.push(aVehicleOf({
                    id: `vehicle-${cultivator.id}-${run.turn}-${landed.builtCounted}`,
                    conveyanceId: landed.builtCounted,
                    ownerId: cultivator.id,
                    ownerName: cultivator.name,
                    at: this.worldPlaceOf(after)
                }));
                this.theWorldMoved();
            } else {
                addToPouch(this.db, cultivator.id, landed.builtCounted, 'artifact', 1);
            }
        }
        if (landed.minted) {
            this.atHand = this.atHand ?? await this.loadWorld();
            if (this.atHand) {
                // Built, it goes with them, as a bought one does. See `a-vehicle.ts`.
                this.atHand.objects.push({
                    ...landed.minted,
                    locationId: this.worldPlaceOf(after) ?? landed.minted.locationId,
                    data: { ...landed.minted.data, withId: cultivator.id }
                });
                this.theWorldMoved();
            }
        }

        const facts = factsForToolResult(plan.headline, [
            ...plan.lines,
            ...landed.lines
        ]);
        facts.structure.push(...plan.structure, ...landed.structure);
        // ── REQUIRED ONLY WHERE THE SLIP CLEARED ─────────────────────────
        //
        // A required line is a cost, and it is only worth paying where silence
        // would be a lie by omission. An ordinary turn at the bench says "eight
        // days at it, and it stands where you left it", which a player who is
        // not told loses nothing by: the slip keeps and the sentence works
        // again next turn.
        //
        // What they cannot play without is the turn where the yard emptied.
        // Either the thing exists and is theirs, or every piece that went in is
        // gone and there is nothing on the slip worth the wood - and both are
        // irreversible, which is the whole of the rule.
        if (landed.slipCleared) facts.required = landed.lines.slice(-2);

        // `shortSkip` has already put the span, the toll and the world tick on
        // its own `calls`, so nothing here restates them.
        const calls: ToolCallRecord[] = [
            ...spent.calls,
            ...landed.calls.map(call => ({
                name: call.name,
                action: 'craft',
                summary: call.summary,
                ok: true
            }))
        ];

        return {
            facts,
            events: spent.events,
            timeSkip: spent.timeSkip,
            breakthrough: null,
            outcome: 'executed',
            calls
        };
    },

    /**
     * Making one thing at a bench: the days the grade asks of this hand, then the
     * materials, then the thing.
     *
     * THE DAYS FIRST, through `shortSkip` like the yard, so the food clock, the
     * encounter window and the world tick run over them, and somebody who does
     * not come back from the bench puts nothing in and takes nothing out. How
     * many is `daysAtTheWork`, the one curve a commission and a cauldron read.
     *
     * The world is loaded BEFORE the plan, because the bench is the player's
     * pouch and the rows they are carrying together and a plan built without
     * the rows would refuse somebody over a heaven-grade horn they are holding.
     *
     * `landTheMaking` is reached only on a `make` plan, so the refusal path
     * cannot write and the making path cannot be rendered without the write.
     */
    async atYourOwnBench(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        said: string,
        today: number
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const objects = this.atHand?.objects ?? [];

        const plan = planTheMaking({
            db: this.db, objects, cultivator, said,
            houseIds: new Set((this.atHand?.factions ?? []).map(house => house.id))
        });
        if (plan.kind === 'refused') {
            const answer = refused(
                'engine.whetherTheirHandsCanDoIt',
                'craft',
                factsForRefusal(plan.headline, plan.lines.join(' '), plan.structure[0])
            );
            // The refusal names the slot, what would have filled it and how
            // anybody comes by one, and all of that is in the lines. A route
            // stated only in the first line is a route the player does not get.
            answer.facts.lines = plan.lines.slice();
            answer.facts.structure = plan.structure.slice();
            return answer;
        }

        // ── IN THE ROOM IT IS DONE IN, inside your own house ─────────────
        // A slip is cut wherever you are sitting; anything else made at a bench
        // is worked where the house works ore. See `intoTheRoomTheWorkIsDoneIn`.
        const wentTo = intoTheRoomTheWorkIsDoneIn(this, cultivator, plan.ask!.slip ? null : 'an_artifact');
        if (wentTo) cultivator = this.repos.cultivators.getById(cultivator.id) ?? cultivator;

        // ── THE DAYS AT IT ───────────────────────────────────────────────
        const days = daysAtTheWork(plan.ask!.grade, cultivator.realmOrdinal, { aSlip: Boolean(plan.ask!.slip) });
        const spent = await this.shortSkip(
            run, cultivator, this.ambientFor(cultivator, run), BENCH_FOCUS,
            `Making ${plan.ask!.named}`, days
        );
        const after = this.repos.cultivators.getById(cultivator.id) ?? cultivator;
        const lived = spent.timeSkip?.simulatedDays ?? days;
        if (!after.alive || lived < days) {
            const facts = factsForToolResult(
                'The work stops before it is done.',
                [...spent.facts.lines, 'Nothing went into it that did not come back out, and nothing was made.']
            );
            facts.structure.push(
                `craft at a bench: ${lived} of ${days} day(s) at ${plan.ask!.grade}-grade work, stopped. `
                + 'The materials are untouched; a made thing is whole or not at all.'
            );
            return { facts, events: spent.events, timeSkip: spent.timeSkip, breakthrough: null, outcome: 'executed', calls: spent.calls };
        }
        const finishedOn = Math.floor(this.repos.runs.getById(run.id)?.elapsedDays ?? today + days);
        // THE WORLD AS THE DAYS LEFT IT. The span advances the world and may hand
        // back a different state, so the rows written into are read again here:
        // a thing pushed onto the array from before the span is a thing nobody
        // holds afterwards.
        this.atHand = this.atHand ?? await this.loadWorld();
        const rowsNow = this.atHand?.objects ?? objects;
        const made = landTheMaking({
            db: this.db, objects: rowsNow, cultivator: after, plan, today: finishedOn,
            roll: forStream(run.seed, 'a-bench', cultivator.id, finishedOn, plan.ask!.named).next()
        });
        // The world is marked moved only where something moved. A take that
        // returns nothing has written nothing, which is what makes this safe.
        if (made.minted) {
            rowsNow.push(made.minted);
            this.theWorldMoved();
        }

        const facts = factsForToolResult(plan.headline, [
            ...(wentTo ? [wentTo] : []),
            `${days} day${days === 1 ? '' : 's'} at the work.`,
            ...plan.lines,
            ...made.lines
        ]);
        facts.structure.push(
            ...plan.structure,
            `daysAtTheWork(${plan.ask!.grade}, ordinal ${cultivator.realmOrdinal}) = ${days}, spent through shortSkip.`,
            ...made.structure
        );
        // WHAT THEY CANNOT PLAY WITHOUT. Materials came out of their hands and a
        // thing went into them, and both are irreversible - the same rule the
        // yard applies to the turn its slip cleared.
        if (made.minted) facts.required = made.lines.slice();

        return {
            facts,
            events: spent.events,
            timeSkip: spent.timeSkip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...spent.calls,
                ...made.calls.map(call => ({
                    name: call.name,
                    action: 'craft',
                    summary: call.summary,
                    ok: true
                }))
            ]
        };
    }
};
