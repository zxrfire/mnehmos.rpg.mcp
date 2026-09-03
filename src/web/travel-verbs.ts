/**
 * Getting somewhere: on foot, on something, by folding, or on somebody's span.
 *
 * `move` is the walk and the other three are the ways of covering ground that
 * are not walking. Each was built, argued out and left with no caller in
 * `src/` - `FOLD_TRAVEL_ENGINE_GAP` names this handler by name - and the four
 * verbs here are what read them. They share one thing that makes them a
 * module rather than four: `daysOnTheRoadTo` is the single reader of the
 * catalog's `travelDays`, and every verb below goes through it, so a fold that
 * saves ten days saves ten days that were being spent.
 *
 * ── HOW THIS IS ATTACHED, AND WHY IT LOOKS LIKE THIS ─────────────────────
 *
 * These are `GameService` methods that live in another file. They are merged
 * onto the prototype at the bottom of `game.ts`, and the interface is
 * merged into the class declaration there, so `this.move(...)` resolves and
 * typechecks exactly as it did when the body sat inside the class.
 *
 * The shape exists to make the move REVIEWABLE. Every line of every body below
 * is the line it was in `game.ts`, `this` included - the alternative, passing
 * the service in as `self`, would have rewritten about twelve hundred
 * expressions and turned a move into a rewrite nobody can check. What it costs
 * is that the members these reach are no longer marked `private`, which is a
 * compile-time annotation with no runtime meaning: `private` is erased, and
 * nothing here is reachable that was not already reachable by writing
 * `(service as any)`.
 */

import { cashToStones } from '../data/cultivation/mortal-world.js';
import {
    REGIONS,
    localPrice,
    regionIdOfPlace,
    requireRegion
} from '../data/cultivation/regions.js';
import { TECHNIQUES } from '../data/cultivation/techniques.js';
import {
    CONVEYANCES,
    countedConveyancesHeld,
    countedHoldingKey,
    kindOfCraft,
    requireConveyance
} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { brokenStatusesOn } from '../engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { stageRank } from '../engine/social/discovery.js';
import {
    boardAt,
    quotePassageAtACounter
} from '../engine/world/buying-passage-at-a-measured-span-counter.js';
import { grantsHeldWith } from '../engine/world/capability.js';
import {
    FOLD_FLOOR_ORDINAL,
    FOLD_GRANT,
    type FoldFix,
    priceFold
} from '../engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import {
    type Conveyance,
    bestForThisRoad,
    couldFlyOnTheirOwnBlade,
    priceJourney
} from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import {
    SPAN_CASH_PER_WALKED_DAY,
    SPAN_ROUTES,
    THE_SPAN_HOUSE_ID,
    counterPlaceNameAt,
    routeTo
} from '../engine/world/where-the-measured-span-still-answers.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import {
    listCarriedArtifacts,
    tollConditionsFor
} from '../server/consolidated/cultivation-support.js';
import type { ActionName } from './actions.js';
import { applyTimeSkip } from './apply.js';
import { PLAYER_ROLL_IDENTITY } from './encounters.js';
import { resolvePlace, worldLocationFor } from './entities.js';
import { factsForMove, factsForRefusal, factsForToolResult, placeName } from './facts.js';
import { refused, skipCalls, tollCalls, worldCalls } from './tool-result-prose.js';
import { SHORT_ACTION_DAYS, TRAVEL_FOCUS } from './turn-constants.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './game.js';

export const travelVerbs = {
    /**
     * Going somewhere, however it was meant.
     *
     * One engine path for every intent. `flee`, `enter`, `approach` and
     * `travel` all resolve identically because the engine has no basis yet for
     * treating them differently, and manufacturing one in this layer would be a
     * mechanic invented in the narration tier.
     *
     * TODO(world): route through `assessCapability` once `world_locations` is
     * populated, so entering a sealed ruin is answered by "can attempt / can
     * survive / can succeed" against that location's thresholds. The rule then
     * stays the same: the attempt is always permitted, circumstances decide.
     */
    async move(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string
    ): Promise<Execution> {
        const place = resolvePlace(target);
        if (!place) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you ` +
                'that you have not decided where you are going, and there is nothing out there ' +
                'obliging enough to decide it for you.',
                'No destination named; location unchanged and no time passed.'
            ));
        }

        // A destination has to be somewhere.
        //
        // `resolvePlace` accepts any string, because a place in this engine
        // is free text and always has been. That is fine for describing one
        // and catastrophic for travelling to one: "I follow the cultivator"
        // parsed the trailing noun as a destination and the engine dutifully
        // moved the player to a location called `cultivator`, spent the
        // travel days, and then described its ambient qi. A name the world
        // has never heard of is not a place; it is a misparse with a
        // location row behind it.
        //
        // Checked against three registers, any of which is enough: the
        // world's own locations, anywhere a person is standing, and
        // anywhere this cultivator has heard of. The third is what keeps
        // this from being a discovery leak in reverse - the player may go
        // where they have been told about, and the refusal below never says
        // where that is.
        // Only where there is a register to check against. With the world
        // driver off, places in this engine are documented free text and
        // there is nothing that could say a name is wrong; refusing then
        // would make travel impossible rather than safe.
        if (this.atHand && !this.somewhereReal(place.name, cultivator)) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'No road goes there.',
                `You ask after ${place.name} and get the look people give a name that is not a ` +
                'place. Nobody sets you right, because nobody is sure what you meant.',
                `Unresolved destination "${place.name}": matches no world location, no ` +
                'occupied place and nothing this cultivator has heard of. Location unchanged, ' +
                'no time passed.'
            ));
        }

        // ── THE NAME WE STORE IS THE WORLD'S, NOT THE PLAYER'S ───────────
        //
        // `extractSubject` consumes an optional leading article after the verb,
        // so "I travel to The Quiet Marches" arrives here as "Quiet Marches" -
        // and every province in the world is named "The" something. Matching
        // survives that, because `somewhereReal` compares on `loosePlaceKey`
        // and the comment there says exactly why. STORING did not: the run then
        // sat at a location string matching no world row at all, so the
        // province could not be resolved from it, `where can I go` answered for
        // the wrong province, and a house's gate the player had just been told
        // about was never listed.
        //
        // So canonicalise to the row the world actually holds. The refusals
        // above deliberately keep the player's own words; this is the arrival,
        // and the arrival is a fact about the world.
        // The world's row where there is one; otherwise the catalog's province,
        // because a run without the world layer still travels and still has to
        // store a name the rest of the engine can resolve.
        const worldRow = this.atHand ? worldLocationFor(this.atHand, place.name) : null;
        //
        // PLACES WIN. A town you can walk to is a better answer than the
        // province containing it, so the province branch is consulted only when
        // the typed name is not a place the catalog knows.
        const bareName = (name: string) => name.replace(/^the\s+/i, '').toLowerCase();
        const asProvince = regionIdOfPlace(place.name)
            ? undefined
            : REGIONS.find(region => bareName(region.name) === bareName(place.name));
        const arrivedAt = worldRow?.name ?? asProvince?.name ?? place.name;

        // ── AND THE ROAD IS AS LONG AS THE CATALOG SAYS IT IS ────────────
        //
        // This spent `SHORT_ACTION_DAYS` for every journey to anywhere, while
        // `destinations` printed the catalog's `travelDays` beside each
        // province - so the game told a player Kettle was eleven days away and
        // then took them there in one. `FOLD_TRAVEL_ENGINE_GAP` names this line
        // as the reason a fold could not be shown to save anybody anything.
        //
        // Only where the catalog states a figure. Nothing anywhere prices a
        // road between two settlements of one province, and inventing a number
        // for one is the fabricated-zero mistake `whereCouldTheyGo` records
        // having made once already - so inside a province the flat day stands.
        const onTheRoad = this.daysOnTheRoadTo(cultivator, place.name) ?? SHORT_ACTION_DAYS;

        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, onTheRoad, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: TRAVEL_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, onTheRoad),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, {
            before: cultivator, run, skip, location: arrivedAt
        });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // Standing somewhere is how a place stops being a rumour. Recorded with
        // its source so a place walked to and a place read about stay different
        // facts.
        this.noteEncounter(
            applied.cultivator, run, { kind: 'place', id: arrivedAt, name: arrivedAt },
            'witnessed', `Arrived on day ${Math.round(applied.run.elapsedDays)}.`
        );

        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        return {
            facts: factsForMove(cultivator, applied.cultivator, place.name, intent, skip, ambient, ambientAfter),
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'cultivator.update',
                    action: 'move',
                    summary: `Location set to "${place.name}" (intent: ${intent}); ambient qi there is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('move', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    },

    // ─────────────────────────────────────────────────────────────────────
    // THE THREE WAYS OF COVERING GROUND THAT ARE NOT WALKING
    //
    // `ride`, `fold` and `passage`, and between them they add no mechanism at
    // all. Every piece was built, argued out and left with no caller in
    // `src/`, and two of the three modules record their own gap in their own
    // file - `FOLD_TRAVEL_ENGINE_GAP` names this handler by name.
    //
    //   the conveyance ladder     `priceJourney`, `bestForThisRoad`,
    //                             `unsuitedFor`, `whatArrivingOnThisSays`,
    //                             `couldFlyOnTheirOwnBlade`
    //   folding space             `priceFold`, `foldRangeInWalkingDays`,
    //                             `whatArrivingByFoldSays`
    //   somebody else's span      `boardAt`, `quotePassageAtACounter`,
    //                             `whatTheBoardDoesNotSay`
    //
    // ── AND THE ROAD IS PAID NOW, WHICH IS WHAT MAKES ANY OF IT MEAN ─────
    //
    // `FOLD_TRAVEL_ENGINE_GAP` is explicit that a saving cannot be shown to a
    // player without printing a number the engine does not charge. It was
    // right: `move` spent a flat day for every journey while `destinations`
    // printed the catalog's `travelDays` beside each province, so the game
    // told a player Kettle was eleven days away and then took them there in
    // one. {@link daysOnTheRoadTo} is the single reader of that figure and
    // every verb here goes through it, `move` included - so a fold that saves
    // ten days saves ten days that were being spent.
    //
    // What that does NOT change: a journey the catalog does not price. Nothing
    // anywhere states a road between two settlements of one province, and a
    // fabricated number is the mistake `whereCouldTheyGo` records having made
    // once already. Inside a province the flat day stands.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * What the catalog says this road costs on foot, or null where it says
     * nothing.
     *
     * Null means "unpriced", never "free". Two settlements of one province
     * have no stated road between them and never have had; so does a place the
     * gazetteer does not contain, which is most of the ground a player can
     * legitimately stand on.
     */
    daysOnTheRoadTo(this: GameService, cultivator: Cultivator, destination: string): number | null {
        const bare = (name: string) => name.replace(/^the\s+/i, '').trim().toLowerCase();
        const from = requireRegion(standingOf(cultivator).regionId);
        const toRegionId = regionIdOfPlace(destination)
            ?? REGIONS.find(region => bare(region.name) === bare(destination))?.id
            ?? null;
        if (toRegionId === null || toRegionId === from.id) return null;

        let shortest: number | null = null;
        for (const link of from.connections) {
            if (link.otherRegionId !== toRegionId) continue;
            if (shortest === null || link.travelDays < shortest) shortest = link.travelDays;
        }
        return shortest;
    },

    /**
     * What this cultivator could actually put under them for a road, best last.
     *
     * TWO THINGS, AND THE FLOOR. Their own blade, which is not property and
     * cannot be bought, lent or taken; and a tracked craft they own, which is
     * an ordinary object row with a `conveyanceId` on it. Everything else in
     * `CONVEYANCES` is a COUNTED holding - a house has four of these and could
     * not tell you which went to Kettle last spring - and there is nowhere in
     * this engine that counts them for a person. See
     * {@link A_HIRED_BEAST_IS_NOT_MODELLED}.
     */
    whatTheyCouldRide(
        this: GameService,
        cultivator: Cultivator
    ): Array<{ conveyance: Conveyance; power: number | null }> {
        const available: Array<{ conveyance: Conveyance; power: number | null }> = [
            { conveyance: requireConveyance('conv-on-foot'), power: null }
        ];

        const flightArt = TECHNIQUES.find(t => t.id === 'gale-riding-sword-flight');
        if (flightArt) {
            const known = cultivator.knownTechniques
                .map(id => TECHNIQUES.find(t => t.id === id))
                .filter((t): t is NonNullable<typeof t> => t !== undefined)
                .map(t => ({ id: t.id, subject: t.subject ?? null }));
            const gate = couldFlyOnTheirOwnBlade({
                realmOrdinal: cultivator.realmOrdinal,
                known,
                flightArt: { id: flightArt.id, requiredOrdinal: flightArt.requiredOrdinal }
            });
            if (gate.can) {
                available.push({ conveyance: requireConveyance('conv-sword-flight'), power: null });
            }
        }

        for (const row of this.atHand?.objects ?? []) {
            // Held OR owned. `mintCraft` moors a craft rather than handing it
            // to somebody - a craft with a possessor is one `bestObjectHeldBy`
            // would arm them with - so reading `possessorId` alone meant that
            // even somebody who built one could not ride it.
            if (row.possessorId !== cultivator.id && row.ownerId !== cultivator.id) continue;
            const kind = kindOfCraft(row);
            if (kind) available.push({ conveyance: kind, power: row.power });
        }

        // ── AND WHAT THEY SIMPLY HAVE ────────────────────────────────────
        //
        // The counted tier, which the note above correctly said nothing in
        // this engine counted for a person. Something does now: `buy` writes
        // it through `adjustCountedHolding` onto the player's own world row,
        // which is the same free-form `Record<string, number>` a house keeps
        // its yard in. No new field anywhere, and a person and a house answer
        // the question with the same four functions.
        for (const { conveyance } of countedConveyancesHeld(this.whatIsInTheirYard(cultivator))) {
            available.push({ conveyance, power: null });
        }

        return available;
    },

    /**
     * What this cultivator has of the counted conveyances, in the shape the
     * catalog's four functions read.
     *
     * The pouch is where it lives, and it is the right place rather than a
     * convenient one: the pouch is already what this person holds as an
     * AMOUNT, fungible, with no identity and no past - which is the whole
     * definition of the counted tier. `countedHoldingKey` is the key those
     * four functions agree on, so a person and a house answer "what is in the
     * yard" with the same code over the same shape, and nothing new is stored
     * anywhere.
     *
     * `what-a-house-moves-its-people-on.ts` says of its own counted section
     * that when a general counted-stock model lands these are the adapter to
     * delete. This is that adapter on the player's side.
     */
    whatIsInTheirYard(this: GameService, cultivator: Cultivator): Record<string, number> {
        const yard: Record<string, number> = {};
        // `listPouch` is the ALCHEMY reader and filters to pills and herbs by
        // design; `listCarriedArtifacts` is the accessor for everything else
        // in the same table. Reading the wrong one is why a bought mule was a
        // row in the database that no sentence a player could type could see -
        // the same defect this file records having found twice before, once
        // for a granted artifact and once for a bought manual.
        for (const entry of listCarriedArtifacts(this.db, cultivator.id)) {
            const kind = CONVEYANCES.find(c => c.id === entry.itemId);
            if (!kind || kind.holding !== 'counted') continue;
            yard[countedHoldingKey(kind.id)] = entry.quantity;
        }
        return yard;
    },

    /**
     * Spend a journey and arrive, which is the half every one of these shares.
     *
     * Extracted rather than repeated so that the four verbs cannot drift: the
     * food clock, the toll, the world tick and the `witnessed` record are the
     * same for somebody who walked, rode, folded or bought a ticket. What
     * differs between them is only what the days were and what the arrival
     * reads as.
     */
    async arriveAfterSpending(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        days: number,
        arrivedAt: string
    ) {
        const spent = Math.max(1, Math.ceil(days));
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, spent, {
            seed: run.seed,
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: TRAVEL_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            rations: this.drawFromPack(cultivator, spent),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, {
            before: cultivator, run, skip, location: arrivedAt
        });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // Standing somewhere is how a place stops being a rumour, and it is
        // also the only thing that gives a later fold a `stood` fix.
        this.noteEncounter(
            applied.cultivator, run, { kind: 'place', id: arrivedAt, name: arrivedAt },
            'witnessed', `Arrived on day ${Math.round(applied.run.elapsedDays)}.`
        );

        return { skip, applied, world };
    },

    /**
     * Where this journey is going, or the refusal that says why it is nowhere.
     *
     * The same three registers `move` checks, in one place, because a verb that
     * could travel somewhere `move` refuses would be a way round the discovery
     * gate rather than a new way of getting there.
     */
    whereThisJourneyGoes(
        this: GameService,
        cultivator: Cultivator,
        target: string | undefined,
        action: ActionName
    ): { name: string } | Execution {
        const place = resolvePlace(target);
        if (!place) {
            return refused('engine.resolvePlace', action, factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you `
                + 'that you have not decided where you are going, and there is nothing out there '
                + 'obliging enough to decide it for you.',
                'No destination named; location unchanged and no time passed.'
            ));
        }
        if (this.atHand && !this.somewhereReal(place.name, cultivator)) {
            return refused('engine.resolvePlace', action, factsForRefusal(
                'No road goes there.',
                `You ask after ${place.name} and get the look people give a name that is not a `
                + 'place. Nobody sets you right, because nobody is sure what you meant.',
                `Unresolved destination "${place.name}": matches no world location, no `
                + 'occupied place and nothing this cultivator has heard of. Location unchanged, '
                + 'no time passed.'
            ));
        }
        return { name: place.name };
    },

    /** The world's own name for somewhere, which is what gets stored. */
    theWorldsNameFor(this: GameService, place: string): string {
        const bare = (name: string) => name.replace(/^the\s+/i, '').toLowerCase();
        const worldRow = this.atHand ? worldLocationFor(this.atHand, place) : null;
        const asProvince = regionIdOfPlace(place)
            ? undefined
            : REGIONS.find(region => bare(region.name) === bare(place));
        return worldRow?.name ?? asProvince?.name ?? place;
    },

    /**
     * Going somewhere ON something.
     *
     * The conveyance layer, reached. What this does that `move` does not is
     * ask what is under the traveller, price the road against it, and say what
     * a watcher at the far gate reads off the arrival - which
     * `docs/world/houses/trust.md` treats as an expensive signal and which was
     * a figure of speech for as long as nothing produced one.
     *
     * It never refuses for having nothing to ride. Walking is a row in the
     * table, it is the floor, and arriving on foot tells everybody at the gate
     * what this party can afford exactly as loudly as arriving on a hull does.
     */
    async ride(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        wanted: string | undefined
    ): Promise<Execution> {
        const going = this.whereThisJourneyGoes(cultivator, target, 'ride');
        if ('facts' in going) return going;

        const arrivedAt = this.theWorldsNameFor(going.name);
        const road = this.daysOnTheRoadTo(cultivator, going.name);
        const walkingDays = road ?? SHORT_ACTION_DAYS;
        const available = this.whatTheyCouldRide(cultivator);

        // What the sentence ASKED for, where it named something, and what
        // actually suits the road. The two are reported separately and the
        // second is what happens: which conveyance is right for a road is an
        // answer the engine already owns, and `bestForThisRoad`'s whole
        // argument is that best is not fastest.
        const asked = wanted
            ? CONVEYANCES.find(c => c.name.toLowerCase().includes(wanted)
                || wanted.includes(c.name.toLowerCase().replace(/^an? /, '')))
            : undefined;
        const chosen = (asked && available.some(a => a.conveyance.id === asked.id)
            ? available.find(a => a.conveyance.id === asked.id)!
            : bestForThisRoad(available, walkingDays, 1))
            ?? available[0];

        const journey = priceJourney({
            walkingDays,
            conveyance: chosen.conveyance,
            power: chosen.power,
            heads: 1
        });

        const { skip, applied, world } = await this.arriveAfterSpending(
            run, cultivator, journey.daysOneWay, arrivedAt
        );
        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        const lines: string[] = [
            `${chosen.conveyance.name}, from ${placeName(cultivator)} to ${arrivedAt}.`,
            road === null
                ? 'Nothing in the catalog prices a road inside one province, so this is the '
                    + 'short journey everything else in the game is: a day, and the day is spent.'
                : `${road} days of road, covered in ${journey.daysOneWay}.`
                    + (journey.daysSavedAgainstWalking > 0
                        ? ` ${journey.daysSavedAgainstWalking} saved against walking it.`
                        : ' Nothing saved: this is what walking costs.'),
            journey.arrivalReads
        ];
        if (journey.wrongToolNote) lines.push(journey.wrongToolNote);
        if (asked && !available.some(a => a.conveyance.id === asked.id)) {
            lines.push(
                `There is no ${asked.name.toLowerCase()} to be had here. What the road got `
                + `instead is ${chosen.conveyance.name.toLowerCase()}, and it is what they have.`
            );
        }
        lines.push(...applied.tollLines, ...world.lines);

        const facts = factsForToolResult(
            `${arrivedAt}, on ${chosen.conveyance.name.toLowerCase()}.`, lines
        );
        facts.structure.push(
            `priceJourney: ${chosen.conveyance.id} at power ${chosen.power ?? 'none'}, `
            + `${walkingDays} walking day(s) -> ${journey.daysOneWay}; `
            + `saved ${journey.daysSavedAgainstWalking}; `
            + `available ${available.map(a => a.conveyance.id).join(', ')}.`,
            ...world.structure
        );

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'engine.priceJourney',
                    action: 'ride',
                    summary:
                        `${chosen.conveyance.name} over ${walkingDays} walking day(s): `
                        + `${journey.daysOneWay} day(s), ${journey.daysSavedAgainstWalking} saved. `
                        + `Ambient qi at ${arrivedAt} is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('ride', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    },

    /**
     * Stepping across the distance instead of covering it.
     *
     * Three answers rather than two, which is the whole shape of `priceFold`: a
     * fold inside the range, a distance the folder does not have, and a rung
     * that does not fold at all. None of them is a ban - the road is still
     * there in every case, and the refusals say so.
     *
     * ── THE FIX IS THE HARD PART AND IT IS NOT NEGOTIABLE ────────────────
     *
     * There are exactly two, both things the folder did themselves, and there
     * is deliberately no third for having been told. Only ONE of them is
     * writable in this world, and the reason is worth having:
     *
     *   `stood`  the knowledge row for the place is at `encountered` or above,
     *            which for a PLACE has exactly one writer - arriving in it. It
     *            is what standing somewhere buys that hearing about it never
     *            does, and it is the whole of the player's path to a fold.
     *   `seen`   NOT REACHABLE, and see {@link A_SIGHTING_HAS_NO_NAME_ON_IT}.
     *
     * THE OBVIOUS WRONG ANSWER, AND IT WAS MEASURED. The first build read
     * `seen` off `horizonInDays` - "you can fly and look around" - on the
     * reasoning that a rung which can see that far has made it out. The sight
     * horizon dwarfs the fold range at every rung on the curve: 78.7 days of
     * sight against 6.0 days of reach at the floor, 642 against 33.5 at Grand
     * Ascension. So EVERY destination inside a fold's range is inside the
     * horizon, always, and the fix check becomes a no-op that hands anybody
     * above the floor a fix on every name they have ever been told. That is the
     * third fix the module forbids, arrived at by accident, and it would delete
     * the Measured Span's entire business and the Late Age premise it
     * expresses. It is written down here because it is an attractive wrong turn
     * and somebody will otherwise take it again.
     */
    async fold(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const going = this.whereThisJourneyGoes(cultivator, target, 'fold');
        if ('facts' in going) return going;

        const arrivedAt = this.theWorldsNameFor(going.name);
        const road = this.daysOnTheRoadTo(cultivator, going.name);
        // A road inside one province is unpriced rather than free, and a fold
        // across one is a reach of under a day. Charged at the floor, and said
        // out loud rather than quoted as a saving.
        const walkingDays = road ?? 1;
        const held = grantsHeldWith(cultivator.realmOrdinal, brokenStatusesOn(cultivator.injuries));

        // The fix, before the range, because a fold with nowhere to aim is not
        // a distance problem.
        const stage = this.knowledge.stageOf(cultivator.id, 'place', arrivedAt);
        const fix: FoldFix | null =
            stageRank(stage) >= stageRank('encountered') ? 'stood' : null;

        if (fix === null && held.includes(FOLD_GRANT)) {
            return refused('engine.priceFold', 'fold', factsForRefusal(
                'They know the name and not the place.',
                `You have the word ${arrivedAt} and nothing else - somebody said it to you, or `
                + 'you read it off a board. A fold is not a survey: what it needs is ground you '
                + 'have stood on, and being told about somewhere is not the same kind of fact. '
                + 'The road is open, as it is to everybody.',
                `No FoldFix for "${arrivedAt}": knowing stage ${stage}, which is below `
                + 'encountered - the rung standing somewhere writes and nothing else does. '
                + 'No time passed.'
            ));
        }

        const cost = priceFold({
            ordinal: cultivator.realmOrdinal,
            heldGrants: held,
            walkingDays,
            fix: fix ?? 'stood'
        });

        if (!cost.canFoldAtAll || !cost.withinRange) {
            return refused('engine.priceFold', 'fold', factsForRefusal(
                cost.canFoldAtAll ? 'Too far, in one step.' : 'Space does not fold for them.',
                `${cost.reason}`,
                `priceFold: range ${cost.rangeDays.toFixed(1)} day(s) at ordinal `
                + `${cultivator.realmOrdinal} (floor ${FOLD_FLOOR_ORDINAL}, `
                + `grant ${held.includes(FOLD_GRANT) ? 'held' : 'not held'}), `
                + `road ${walkingDays} day(s). Location unchanged, no time passed.`
            ));
        }

        const { skip, applied, world } = await this.arriveAfterSpending(
            run, cultivator, cost.daysSpent, arrivedAt
        );
        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        const lines: string[] = [
            cost.reason,
            cost.arrivalReads,
            road === null
                ? 'Nothing prices a road inside one province, so nothing was saved that anybody '
                    + 'can put a number to. What it cost is the settling, and that is real.'
                : `${cost.daysSavedAgainstWalking} day(s) saved against the ${road} on the road.`,
            ...applied.tollLines,
            ...world.lines
        ];

        const facts = factsForToolResult(`${arrivedAt}, in one step.`, lines);
        facts.structure.push(
            `priceFold: fix ${fix}, range ${cost.rangeDays.toFixed(1)} day(s), `
            + `road ${walkingDays}, settling ${cost.settlingDays}, short by ${cost.landsShortBy}, `
            + `spent ${cost.daysSpent}, saved ${cost.daysSavedAgainstWalking}.`,
            ...world.structure
        );

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'engine.priceFold',
                    action: 'fold',
                    summary:
                        `Folded ${walkingDays} walking day(s) on a ${fix} fix, inside a reach of `
                        + `${cost.rangeDays.toFixed(1)}. ${cost.daysSpent} day(s) spent, `
                        + `${cost.daysSavedAgainstWalking} saved. Ambient qi at ${arrivedAt} is `
                        + `${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('fold', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    },

    /**
     * A counter, a board, and a place on somebody else's span.
     *
     * THE BOARD IS THE MORE IMPORTANT HALF and it is free. A board is a map
     * somebody can read without owning a map - a list of places, a distance to
     * each in the unit every road in this world is quoted in, and a price - and
     * reading one writes a `read` knowledge record against every destination on
     * it, which reaches `placed`. `placed` is `REACHABLE_FROM`: the exact rung
     * that makes a province a legal destination and a listable one. Somebody
     * who has never left their province learns at a board that there are
     * others, and can then go.
     *
     * A place read off a board is a place HEARD ABOUT and not a place stood in,
     * which is why the source is `read` and not `witnessed`, and why a fold
     * still refuses to aim at it.
     */
    async passage(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string
    ): Promise<Execution> {
        const here = standingOf(cultivator);
        const counter = counterPlaceNameAt(placeName(cultivator));
        const today = Math.floor(run.elapsedDays);
        const rate = localPrice(here.regionId, SPAN_CASH_PER_WALKED_DAY);

        if (counter === null) {
            return refused('engine.boardAt', 'passage', factsForRefusal(
                'The house keeps no counter here.',
                'There is no board to read and nobody at a desk to read it to you. The Measured '
                + 'Span runs from the ground it runs from, and this is not any of it - which is '
                + 'not the house being unhelpful, it is where an inherited survey stops.',
                `No Span counter at "${placeName(cultivator)}". The house keeps `
                + `${SPAN_ROUTES.length} route(s), from `
                + `${[...new Set(SPAN_ROUTES.map(r => r.fromPlace))].join(', ')}. `
                + 'No time passed.'
            ));
        }

        const board = boardAt(counter, SPAN_ROUTES, rate, today);

        // ── THE DISCOVERABILITY HALF, AND IT RUNS BEFORE ANYTHING ELSE ───
        //
        // Written whichever step this is, because standing at a board and
        // reading it is what happened either way, and somebody who buys a
        // ticket has certainly read the line they bought.
        const learned: string[] = [];
        for (const line of board.lines) {
            const isNew = this.noteEncounter(
                cultivator, run, { kind: 'place', id: line.toPlace, name: line.toPlace },
                'read',
                `On the board at ${counter} on day ${today}: `
                + `${line.walkedDaysItReplaces} days of road, ${line.fareCash} cash.`
            );
            if (isNew) {
                learned.push(
                    `${line.toPlace} was a word you did not have this morning. It is on a board `
                    + 'with a distance and a price beside it, which is as much as anybody ever '
                    + 'gets about somewhere they have not been.'
                );
            }
        }

        const wanted = (target ?? '').trim();
        const route = wanted.length >= 2 ? routeTo(counter, wanted) : null;

        if (intent !== 'buy' || route === null) {
            const lines: string[] = [
                `The board at ${counter}.`,
                ...board.lines.map(line =>
                    `${line.toPlace} - ${line.walkedDaysItReplaces} days of road, `
                    + `${line.fareCash} cash, `
                    + (line.openToday
                        ? 'running today'
                        : `next departure day ${line.nextDepartureDay ?? 'unstated'}`)
                    + (line.inheritedTerminal
                        ? '. One of the nine, and the house did not build it.'
                        : '. The house folds this one itself.')),
                board.limits
            ];
            if (wanted.length >= 2 && route === null && intent === 'buy') {
                lines.push(
                    `Nothing on this board goes to ${wanted}. That is not a refusal and it is `
                    + 'not a price: it is the end of the survey.'
                );
            }
            lines.push(...learned);

            const facts = factsForToolResult(
                `${counter}: ${board.running} route${board.running === 1 ? '' : 's'}.`, lines
            );
            facts.structure.push(
                `boardAt: ${counter}, ${board.running} route(s), fare rate ${rate} cash per `
                + `walked day replaced, on day ${today}. Every destination noted at 'read', `
                + 'which reaches `placed` and is what makes a province legal to travel to.'
            );
            return this.freeAction(run, 'passage', facts);
        }

        // ── AND BUYING ONE ───────────────────────────────────────────────
        const quote = quotePassageAtACounter(route, {
            heads: 1,
            worstPassengerOrdinal: cultivator.realmOrdinal,
            cashPerWalkedDayReplaced: rate,
            onDay: today
        });
        const stones = Math.max(1, Math.ceil(cashToStones(quote.fareCash)));

        if (cultivator.spiritStones < stones) {
            return refused('engine.quotePassageAtACounter', 'passage', factsForRefusal(
                'The fare is the fare.',
                `${route.toPlace} is ${quote.fareCash} cash, which is ${stones} spirit stones, `
                + `and you are carrying ${cultivator.spiritStones}. The clerk does not argue `
                + 'and does not offer a second figure. What the house sells is priced by true '
                + 'distance off a table nobody outside it can check, and it is the same figure '
                + 'for everybody standing at this counter.',
                `quotePassageAtACounter: ${route.id} at ${quote.fareCash} cash (${stones} stones) `
                + `against a purse of ${cultivator.spiritStones}. No time passed.`
            ));
        }

        this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stones });
        const paid = this.repos.cultivators.getById(cultivator.id)!;
        const arrivedAt = this.theWorldsNameFor(route.toPlace);

        const { skip, applied, world } = await this.arriveAfterSpending(
            run, paid, Math.max(1, quote.daysSpent), arrivedAt
        );
        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        const lines: string[] = [
            `${counter} to ${route.toPlace}. ${quote.fareCash} cash, ${stones} spirit stones.`,
            quote.openToday
                ? 'It was running today, and the crossing itself is an hour.'
                : `It was not running. You waited for day ${quote.nextDepartureDay ?? today}, `
                    + 'because a span is held open at a cost and is not standing open all year.',
            quote.settlingDays > 0
                ? `${quote.settlingDays} day(s) afterwards are not much use to anybody. Being `
                    + 'moved through space you do not understand is rough, and how rough is how '
                    + 'little you understand it.'
                : 'You rode it easily. At this rung the fare is the whole of what it costs.',
            `${quote.daysSavedAgainstWalking} day(s) saved against the `
            + `${route.walkedDaysItReplaces} on the road.`,
            quote.notCovered,
            ...learned,
            ...applied.tollLines,
            ...world.lines
        ];

        const facts = factsForToolResult(`${route.toPlace}, through the span.`, lines);
        facts.structure.push(
            `quotePassageAtACounter: ${route.id}, fare ${quote.fareCash} cash at ${rate} per `
            + `walked day, ${quote.settlingDays} settling day(s) at ordinal `
            + `${cultivator.realmOrdinal} (folding floor ${FOLD_FLOOR_ORDINAL}), `
            + `${quote.daysSpent} day(s) spent, ${quote.daysSavedAgainstWalking} saved. `
            + `Witnessed by ${THE_SPAN_HOUSE_ID}.`,
            ...world.structure
        );

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'engine.quotePassageAtACounter',
                    action: 'passage',
                    summary:
                        `${route.id}: ${stones} stones, ${quote.daysSpent} day(s), `
                        + `${quote.daysSavedAgainstWalking} saved. Ambient qi at ${arrivedAt} `
                        + `is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('passage', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    }
};
