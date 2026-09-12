/**
 * Getting somewhere: on foot, on something, by folding, or on somebody's span.
 */

import { resolveSect } from './entities.js';
import { readTheWall } from './what-is-posted-on-the-wall-here.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { cashToStones } from '../data/cultivation/mortal-world.js';
import {
    REGIONS,
    localPrice,
    placeRoadDays,
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
import { primaryRoadOf } from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import {
    listCarriedArtifacts,
    daoHeartConditions,
    tollConditionsFor
} from '../server/consolidated/cultivation-support.js';
import type { ActionName } from './actions.js';
import { applyTimeSkip } from './apply.js';
import { PLAYER_ROLL_IDENTITY } from './encounters.js';
import { resolvePlace, worldLocationFor } from './entities.js';
import { loosePlaceKey } from './knowledge.js';
import {
    howStandingHerePutIt,
    whoBeingHereIntroducesYouTo
} from '../engine/world/being-on-their-ground.js';
import type { Perception } from './shown-this-turn.js';
import {
    whatBeingAMemberTellsYou,
    whatStandingAmongYourOwnShows
} from './meeting-your-own-house.js';
import { getMembersOf } from '../data/cultivation/members.js';
import { getSect } from '../data/cultivation/sects.js';
import { factsForMove, factsForRefusal, factsForToolResult, placeName } from './facts.js';
import { refused, skipCalls, tollCalls, worldCalls } from './tool-result-prose.js';
import { SHORT_ACTION_DAYS, TRAVEL_FOCUS } from './turn-constants.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

/**
 * The house whose ground somebody has just walked onto, written down.
 */
function noteWhoseGroundThisIs(
    game: GameService,
    cultivator: Cultivator,
    run: Run,
    arrivedAt: string
): void {
    if (!game.atHand) return;
    const row = worldLocationFor(game.atHand, arrivedAt);
    if (!row) return;
    const introduced = whoBeingHereIntroducesYouTo(game.atHand.locations, row.id);
    if (!introduced || !introduced.factionName) return;
    // `learnIfNew` rather than `noteEncounter`, and the stage is the reason.
    // `noteEncounter` lets the source decide, and `witnessed` carries a ceiling
    // of `known` - measured, arrival granted `encountered`, which is somebody
    // you have dealt with rather than a name you can say. Standing on their
    // ground is worth `named` and no more, which is the same grant the `look`
    // caller makes and the reason both are deliberately below their own ceiling.
    game.knowledge.learnIfNew({
        holderId: cultivator.id,
        kind: 'sect',
        id: introduced.factionId,
        name: introduced.factionName,
        onDay: Math.floor(run.elapsedDays),
        sourceKind: 'witnessed',
        sourceNote: 'They hold the ground this cultivator walked onto.',
        stage: 'named',
        statement: howStandingHerePutIt(introduced)
    });
}

/**
 * Who of your own house is standing where you have just arrived.
 */
function meetingYourOwnHouse(game: GameService, cultivator: Cultivator) {
    const membership = game.repos.sects.getMembership(cultivator.id);
    if (!membership) return null;
    return whatStandingAmongYourOwnShows(cultivator, membership.sectId, {
        houseName: getSect(membership.sectId)?.name ?? 'the house',
        here: game.present(cultivator).map(row => ({
            id: row.id,
            name: row.name,
            realmOrdinal: row.realmOrdinal,
            factionId: row.sectId,
            known: game.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id)
        }))
    });
}

/**
 * And the structure being enrolled told them, which needs nobody present.
 */
function theStructureYouWereTold(game: GameService, cultivator: Cultivator) {
    const membership = game.repos.sects.getMembership(cultivator.id);
    if (!membership) return null;
    const house = getSect(membership.sectId);
    if (!house) return null;
    return whatBeingAMemberTellsYou(membership.sectId, {
        houseName: house.name,
        // The house's own roll. Guests are in `GUEST_ELDERS` and are not in
        // this table at all, so the exclusion costs nothing to enforce.
        ladder: getMembersOf(membership.sectId).map(member => ({
            id: member.id,
            name: member.name,
            rankIndex: member.rankIndex,
            realmOrdinal: member.realmOrdinal
        })),
        ranks: house.ranks
    });
}

/**
 * The people an arrival introduces, whichever way the ground was covered.
 *
 * Three facts land on arriving: the place stops being a rumour, the house that
 * holds the ground is written, and the people of your OWN house standing on it
 * become nameable. `move` did all three and `ride`, `fold` and `passage` did
 * the first two - so a Frostmirror disciple who walked to the terraces was
 * introduced to their own people and the same disciple who bought passage to
 * the same ground was introduced to nobody. That is the "Sword Elder who could
 * not name one person in his own house" defect, live on three of the four ways
 * of arriving.
 *
 * One reader, called from the shared arrival and from `move`, rather than the
 * third fact living in one handler.
 */
function whatArrivingIntroduces(
    game: GameService,
    cultivator: Cultivator
): { perceived: Perception[]; structure: string[] } {
    const perceived: Perception[] = [];
    const structure: string[] = [];

    const told = theStructureYouWereTold(game, cultivator);
    if (told) perceived.push(told);

    const met = meetingYourOwnHouse(game, cultivator);
    if (met) {
        perceived.push(met.perception);
        structure.push(
            `on the roll and in the room: ${met.perception.names.length} newly nameable, `
            + `${met.hiddenByHeight} withheld for height.`
        );
    }
    return { perceived, structure };
}

/** How many named places a refusal offers. A road question wants a few, not a gazetteer. */
const MOST_ROADS_NAMED = 6;

/**
 * The places this cultivator could name and actually be carried to.
 *
 * `somewhereReal` read the other way round, which is the rule in AGENTS.md
 * about every read running both ways: it answers *is this name a place I may
 * go to*, and nothing answered *which names are*. So a refusal could say the
 * name was not one and could not say what would have been.
 *
 * It leaks nothing. A name is on this list only where the gate would already
 * have let the sentence through - heard of and pointable at, or a square
 * somebody is standing in - so the player is being handed back what they have
 * already been told.
 */
function theRoadsThisCultivatorKnows(engine: GameService, cultivator: Cultivator): string[] {
    const here = loosePlaceKey(cultivator.location ?? '');
    const named = new Map<string, string>();
    const add = (name: string | null | undefined) => {
        if (!name) return;
        const key = loosePlaceKey(name);
        if (key.length === 0 || key === here || named.has(key)) return;
        named.set(key, name);
    };

    for (const row of engine.knowledge.awareness(cultivator.id, 'place')) {
        if (engine.knowledge.canPointAt(cultivator.id, 'place', row.id)) add(row.name);
    }
    for (const row of engine.repos.cultivators.roster()) add(row.location);
    return [...named.values()].slice(0, MOST_ROADS_NAMED);
}

/**
 * The sentence a refusal ends with, naming the roads rather than only the gap.
 *
 * Measured across four situations: `move` was chosen 20 times and refused 20
 * times, and every one of those refusals said what the name was not - *"nobody
 * sets you right, because nobody is sure what you meant"* - while the
 * destinations read, free and one sentence away, was printing the answer to
 * anybody who asked for it in different words. A refusal that names no route is
 * the one shape this engine is not allowed to produce.
 */
function andTheRoadsThatDoGoSomewhere(engine: GameService, cultivator: Cultivator): string {
    const roads = theRoadsThisCultivatorKnows(engine, cultivator);
    return roads.length === 0
        ? ' Nowhere has been named to you yet that you could set out for, which is what asking '
          + 'somebody here is for.'
        : ` Somewhere you could say instead: ${roads.join(', ')}.`;
}

/**
 * Words that say a player is going, not where they are going.
 *
 * `resolvePlace` accepts any string, because places in this engine are free
 * text, so the trailing word of "I run away" arrived as a destination and the
 * refusal reported having gone looking for a town called `away`:
 *
 *     You ask after away and get the look people give a name that is not a
 *     place.
 *
 * Nobody named a place. Measured in the refusal probe: `move` refused 22 of 28,
 * and the four sentences behind it are all this one thought - *I leave*, *I
 * wander off*, *I run away*, *I get out of here*. Three carry no target at all
 * and land correctly on the no-destination refusal; only the one with a word
 * after the verb went wrong, which is what made it look like a different defect
 * from its own siblings.
 *
 * Treating these as no destination said routes all four to one answer, and that
 * answer names the roads. It widens nothing: a sentence that named no place
 * still refuses, and still refuses to pick one on the player's behalf.
 *
 * Deliberately not here: `home`, `back` and `on`. Each could be resolved
 * against somewhere the player has actually been, which is an answer rather
 * than a refusal, and belongs with whoever builds that.
 */
const A_DIRECTION_RATHER_THAN_A_DESTINATION =
    /^(?:away|off|out|onwards?|onward|elsewhere|somewhere|anywhere|nowhere|there|here)$/i;

/** The destination the sentence named, with the direction words taken out. */
function destinationNamed(target: string | undefined): string | undefined {
    const said = (target ?? '').trim();
    return A_DIRECTION_RATHER_THAN_A_DESTINATION.test(said) ? undefined : target;
}

export const travelVerbs = {
    /**
     * Going somewhere, however it was meant.
     */
    async move(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string
    ): Promise<Execution> {
        const place = resolvePlace(destinationNamed(target));
        if (!place) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you ` +
                'that you have not decided where you are going, and there is nothing out there ' +
                'obliging enough to decide it for you.'
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
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
            // A HOUSE IS NOT A PLACE, AND SAYING SO BEATS SAYING YOU NEVER
            // HEARD OF IT.
            //
            // FOUND BY PLAYING, and it was the game contradicting itself one
            // turn apart. Turn one told the player, unprompted, that the Azure
            // Dew Sect was holding an intake here in sixty-nine days. Turn two
            // said "I go to the azure dew sect" and got *"matches no world
            // location, no occupied place and NOTHING THIS CULTIVATOR HAS HEARD
            // OF"*.
            //
            // Both halves were doing their job. `readTheWall` had written the
            // house into the knowledge table, and `somewhereReal` looks for a
            // PLACE - so the sect was known and its ground was not, and the
            // refusal reported the second as though it were the first.
            //
            // The design owner: *"if it's something you know it should mention.
            // Like, you've heard the abc sect is recruiting."* So it says what
            // is actually held: you know them, here is what you were told, and
            // what nobody has told you is where they are.
            const known = this.whatTheyKnowOfThisHouse(place.name, cultivator, run);
            if (known !== null) {
                // THE INFORMATION IS THE SAME. THE VOICE IS NOT THE ENGINE'S.
                //
                // The first cut of this said "a name you have been given and
                // not a place you have been given", and the design owner: *"the
                // info is right, but the prose, not right... if that's engine
                // feedback, that's okay."* Exactly the line this repo draws:
                // the mechanical channel may say a house is not a location, and
                // the channel a player reads as a scene may not, because that
                // is the engine explaining its own categories out loud.
                //
                // So the scene says what it is like to know a name and not a
                // road, the paper says the rest in the words it was written in,
                // and the category stays in the record below.
                const asked = this.anybodyElseHere(cultivator)
                    ? `You ask the way to ${known.name} and get it twice over: everybody has `
                      + 'heard the name, nobody has been.'
                    : `You turn the name over and it goes nowhere. ${known.name} is something `
                      + 'you know of, not somewhere you know the road to.';
                return refused('engine.resolvePlace', 'move', factsForRefusal(
                    'You have the name. You do not have the road.',
                    known.told === null
                        ? `${asked} Whoever they are, they have not said where they keep `
                          + 'themselves, and a name is not a direction.'
                        : `${asked} What you have of them is the paper: ${known.told}`,
                    `"${place.name}" is a house this cultivator has heard of and not a location. `
                    + 'Location unchanged, no time passed.'
                ));
            }
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'No road goes there.',
                // AND NO BYSTANDERS IN AN EMPTY SQUARE. This read "you get the
                // look people give a name that is not a place" on ground the
                // same turn had already reported as empty - "Nobody is about" -
                // so the answer put a crowd in a place it had just emptied.
                (this.anybodyElseHere(cultivator)
                    ? `You ask after ${place.name} and get the look people give a name that is `
                      + 'not a place.'
                    : `You turn ${place.name} over and it does not attach to anywhere. No road `
                      + 'you know of runs to it, and there is nobody here to ask.')
                // AND IT SAYS WHERE THE ROADS DO GO.
                //
                // This ended "nobody sets you right, because nobody is sure
                // what you meant", which is a refusal declining to name a
                // route while the destinations read - free, and one sentence
                // away - was printing the answer to anybody who asked in
                // different words. Nothing is opened by saying it: every name
                // here is one the gate above would already have let through.
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
                `Unresolved destination "${place.name}": matches no world location, no ` +
                'occupied place and nothing this cultivator has heard of. Location unchanged, ' +
                'no time passed.'
            ));
        }

        // ── THE NAME WE STORE IS THE WORLD'S, NOT THE PLAYER'S ───────────
        //
        // `extractSubject` consumes an optional leading article after the verb,
        // so "I travel to The Silent Cliffs" arrives here as "Silent Cliffs" -
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
        // province - so the game told a player Iron Ridge was eleven days away and
        // then took them there in one. `FOLD_TRAVEL_ENGINE_GAP` names this line
        // as the reason a fold could not be shown to save anybody anything.
        //
        // Only where the catalog states a figure, at either of the two scales
        // it states one at - a province road, or a road between two named
        // places of one province. Inventing a number where it states none is
        // the fabricated-zero mistake `whereCouldTheyGo` records having made
        // once already, so an unpriced journey still costs the flat day.
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
            ...daoHeartConditions(this.repos.db, cultivator, Math.floor(run.elapsedDays)),
            toll: tollConditionsFor(this.repos, cultivator)
        });

        this.putBackWhatWasNotEaten(cultivator, skip);
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

        // AND WHOSE GROUND IT IS. The place and its holder are one arrival.
        noteWhoseGroundThisIs(this, applied.cultivator, run, arrivedAt);

        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);
        const facts = factsForMove(
            cultivator, applied.cultivator, place.name, intent, skip, ambient, ambientAfter
        );

        // ── AND WHO OF YOUR OWN IS STANDING HERE ─────────────────────────
        //
        // `the-people-you-serve-with.ts` holds the rule and why it needs both
        // the roll AND the room. See {@link whatArrivingIntroduces}.
        const introduced = whatArrivingIntroduces(this, applied.cultivator);
        const perceived = introduced.perceived;
        facts.structure.push(...introduced.structure);

        return {
            facts,
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
            ],
            perceived
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
    // told a player Iron Ridge was eleven days away and then took them there in
    // one. {@link daysOnTheRoadTo} is the single reader of that figure and
    // every verb here goes through it, `move` included - so a fold that saves
    // ten days saves ten days that were being spent.
    //
    // What that does NOT change: a journey the catalog does not price. A
    // fabricated number is the mistake `whereCouldTheyGo` records having made
    // once already, so an unpriced pair still costs the flat day. Since
    // `RegionPlaceConnectionSchema` landed, the catalog can state a road
    // between two named places of ONE province as well, and
    // {@link daysOnTheRoadTo} reads that at the same scale in the same unit -
    // so the set of unpriced journeys is smaller and the rule about them is
    // exactly as it was.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * What the catalog says this road costs on foot, or null where it says nothing.
     */
    daysOnTheRoadTo(this: GameService, cultivator: Cultivator, destination: string): number | null {
        const bare = (name: string) => name.replace(/^the\s+/i, '').trim().toLowerCase();
        const from = requireRegion(standingOf(cultivator).regionId);

        // The finer scale first, because it is the one that can answer at all
        // when both ends are in one province. It reads both directions off a
        // row the catalog states once.
        const nextDoor = placeRoadDays(placeName(cultivator), destination);
        if (nextDoor !== null) return nextDoor;

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
     */
    whatTheyCouldRide(
        this: GameService,
        cultivator: Cultivator
    ): Array<{ conveyance: Conveyance; power: number | null }> {
        const available: Array<{ conveyance: Conveyance; power: number | null }> = [
            { conveyance: requireConveyance('conv-on-foot'), power: null }
        ];

        // WHATEVER THEY HOLD THAT CARRIES THEM, and not one art by id.
        //
        // This read `gale-riding-sword-flight` by name, so the catalog's other
        // fifteen movement arts could not put a road under anybody - and the
        // design note on that row says exactly why that is wrong: the design
        // owner named flight as the ANALOGY for an incidental ability, so the
        // row is the EXAMPLE and not the case. `category: 'movement'` is the
        // catalog's own statement of which arts these are, and the gate asks
        // each one what road it stands on.
        const held = cultivator.knownTechniques
            .map(id => TECHNIQUES.find(t => t.id === id))
            .filter((t): t is NonNullable<typeof t> => t !== undefined)
            // `HeldArt.subject` is a scalar where a row carries several, so
            // this is `primaryRoadOf` - the road the row is written under.
            .map(t => ({ ...t, subject: primaryRoadOf(t) }));

        const carriesThem = held
            .filter(art => art.category === 'movement')
            // Deepest first, so the strongest thing they hold decides it.
            .sort((a, b) => b.requiredOrdinal - a.requiredOrdinal)
            .some(art => couldFlyOnTheirOwnBlade({
                realmOrdinal: cultivator.realmOrdinal,
                known: held.map(t => ({ id: t.id, subject: t.subject })),
                flightArt: {
                    id: art.id,
                    requiredOrdinal: art.requiredOrdinal,
                    subject: art.subject
                }
            }).can);

        if (carriesThem) {
            available.push({ conveyance: requireConveyance('conv-sword-flight'), power: null });
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
            ...daoHeartConditions(this.repos.db, cultivator, Math.floor(run.elapsedDays)),
            toll: tollConditionsFor(this.repos, cultivator)
        });

        this.putBackWhatWasNotEaten(cultivator, skip);
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

        // AND WHOSE GROUND IT IS. The place and its holder are one arrival.
        noteWhoseGroundThisIs(this, applied.cultivator, run, arrivedAt);

        // AND WHO OF YOUR OWN IS STANDING ON IT. The third fact of an arrival,
        // which used to live only in `move` - so the same ground reached by
        // road introduced a disciple to their own house and the same ground
        // reached by fold, boat or passage introduced them to nobody.
        const introduced = whatArrivingIntroduces(this, applied.cultivator);

        return { skip, applied, world, ...introduced };
    },

    /**
     * Where this journey is going, or the refusal that says why it is nowhere.
     */
    whereThisJourneyGoes(
        this: GameService,
        cultivator: Cultivator,
        target: string | undefined,
        action: ActionName
    ): { name: string } | Execution {
        const place = resolvePlace(destinationNamed(target));
        if (!place) {
            return refused('engine.resolvePlace', action, factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you `
                + 'that you have not decided where you are going, and there is nothing out there '
                + 'obliging enough to decide it for you.'
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
                'No destination named; location unchanged and no time passed.'
            ));
        }
        if (this.atHand && !this.somewhereReal(place.name, cultivator)) {
            return refused('engine.resolvePlace', action, factsForRefusal(
                'No road goes there.',
                `You ask after ${place.name} and get the look people give a name that is not a `
                + 'place.'
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
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

        const { skip, applied, world, perceived, structure: introducedBy } =
            await this.arriveAfterSpending(
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
            ...world.structure,
            ...introducedBy
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
            ],
            // The same three facts an arrival on foot grants. See
            // `whatArrivingIntroduces`.
            perceived
        };
    },

    /**
     * Stepping across the distance instead of covering it.
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
        //
        // `FoldFix` HAS A SECOND MEMBER AND IT IS MEANT TO HAVE NO PRODUCER
        // HERE. `seen` was tried, derived from the sight horizon, and measured
        // wrong: the horizon dwarfs the fold range at every rung on the curve -
        // 78.7 days of sight against 6.0 of reach at the floor - so every
        // destination inside a fold's range is inside the horizon, the check is
        // a no-op, and anybody above the floor has a fix on every name they
        // have ever heard. `getting-there-without-walking-it.test.ts` pins it
        // and says so, and the module names it as the third fix it forbids.
        // Anything that wants to produce `seen` has to be a narrower fact than
        // "high enough to see that far".
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

        const { skip, applied, world, perceived, structure: introducedBy } =
            await this.arriveAfterSpending(
                run, cultivator, cost.daysSpent, arrivedAt
            );
        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        const lines: string[] = [
            cost.reason,
            cost.arrivalReads,
            road === null
                ? 'Nothing prices a road inside one province, so nothing was saved that anybody '
                    + 'can put a number to. What it cost is the settling, and that is real.'
                : `${howMany(cost.daysSavedAgainstWalking, 'day')} saved against the ${road} on the road.`,
            ...applied.tollLines,
            ...world.lines
        ];

        const facts = factsForToolResult(`${arrivedAt}, in one step.`, lines);
        facts.structure.push(
            `priceFold: fix ${fix}, range ${cost.rangeDays.toFixed(1)} day(s), `
            + `road ${walkingDays}, settling ${cost.settlingDays}, short by ${cost.landsShortBy}, `
            + `spent ${cost.daysSpent}, saved ${cost.daysSavedAgainstWalking}.`,
            ...world.structure,
            ...introducedBy
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
            ],
            // The same three facts an arrival on foot grants. See
            // `whatArrivingIntroduces`.
            perceived
        };
    },

    /**
     * A counter, a board, and a place on somebody else's span.
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

        const { skip, applied, world, perceived, structure: introducedBy } =
            await this.arriveAfterSpending(
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
                ? `${howMany(quote.settlingDays, 'day')} afterwards are not much use to anybody. Being `
                    + 'moved through space you do not understand is rough, and how rough is how '
                    + 'little you understand it.'
                : 'You rode it easily. At this rung the fare is the whole of what it costs.',
            `${howMany(quote.daysSavedAgainstWalking, 'day')} saved against the `
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
            ...world.structure,
            ...introducedBy
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
            ],
            // The same three facts an arrival on foot grants. See
            // `whatArrivingIntroduces`.
            perceived
        };
    },

    /**
     * WHAT THIS CULTIVATOR ACTUALLY KNOWS ABOUT A HOUSE THEY NAMED.
     *
     * Null when the name is not a house they have heard of, which is the ordinary
     * case and the one the plain refusal is for.
     *
     * `told` is the thing that makes the refusal worth reading: a bill on the wall
     * here is how most players hear of a house at all, and it is what they are
     * really asking about when they say the name back. Re-read rather than
     * remembered, because the wall is a pure function of the place and the day.
     */
    whatTheyKnowOfThisHouse(
        this: GameService,
        named: string,
        cultivator: Cultivator,
        run: Run
    ): { name: string; told: string | null } | null {
        const scope = {
            gate: this.knowledge, holderId: cultivator.id, here: placeName(cultivator)
        };
        const house = resolveSect(this.repos, named, scope, null);
        if (house === null) return null;

        // What the paper here says about them, where there is paper about them.
        const wall = readTheWall(this.knowledge, cultivator, run);
        const about = wall.lines.find((line: string) => line.includes(house.name)) ?? null;
        return { name: house.name, told: about };
    },

    /**
     * Whether there is anybody here at all to give somebody a look.
     *
     * A refusal that describes bystanders on ground the same turn reported as empty
     * is the engine contradicting itself inside one screen.
     */
    anybodyElseHere(this: GameService, cultivator: Cultivator): boolean {
        return this.present(cultivator).some(row => row.id !== cultivator.id);
    }
};
