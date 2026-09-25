/**
 * What the disciple on a house's gate tells a stranger who asks after its board or its work.
 *
 * The owner: "a sects board is internal", "the board is INSIDE", "they are outside", "they post
 * NOTICES for external", and of the gate: "you can ask the disciple at the gates about this too",
 * "they'd know, of course", "they represent the sect to outsiders". What a notice may ask: "a sect
 * asks for things from people where a sect doesn't need to put stuff upfront", so never a delivery.
 *
 * Played blind at the Azure Dew Sect's gate: "what's on your notice board then? any jobs an
 * outsider can do?" was answered with the mortal work list, and the house said nothing.
 *
 * So the answer is the board's door and the house's paper: the board is inside and for its own,
 * and here is everything it has put up for outsiders, and where. Read off the same asks the town
 * walls carry, so the gate and the wall cannot disagree.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForToolResult } from './facts.js';
import { provinceForFaction } from '../data/cultivation/regions/provinces.js';
import { theOneOnWatchAtTheGate } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import {
    A_BILL_STAYS_UP_FOR_DAYS,
    WHAT_A_NOTICE_DOES_NOT_BUY,
    whatThePaperSays
} from '../engine/world/houses-that-have-to-advertise-for-disciples.js';
import { theNoticesThatAreDown } from '../engine/encounters/a-notice-is-turned-in.js';
import { theNoticesTurnedIn } from './turning-in-what-a-notice-asks.js';
import {
    everythingEachHouseIsAsking,
    housesWithSomethingToSay,
    whatEachHouseHasAPriceOn,
    whoEachHouseIsLookingFor
} from './what-is-posted-on-the-wall-here.js';
import { theAreaTheyAreIn } from './walking-across-a-place.js';
import { theHouseWhoseGateThisIs } from './walking-up-to-a-house.js';
import { thePlayerIsSureItIsThem } from './the-narrator-plays-the-world.js';
import { aCrowdIsAsked } from './asking-the-way.js';
import {
    howBigTheTownBelowIs,
    whatTheTownIsBelow,
    whatTradesBelow
} from '../engine/world/the-town-at-the-foot-of-a-house.js';

/** A topic asking after a house's work: its board, its notices, a job going. */
const A_WORK_TOPIC = /\b(?:work|jobs?|board|notices?|postings?|posted|duties|errands?|hir(?:e|ing)|missions?|tasks?|bount(?:y|ies))\b/i;

export function aWorkTopic(topic: string | undefined): boolean {
    return A_WORK_TOPIC.test(topic ?? '');
}

/**
 * Whether the words were put to the gate: to nobody in particular, to the crowd, to the watch by
 * what they are, or by name to somebody of the house standing at it.
 */
export function theGateIsAsked(
    game: GameService,
    cultivator: Cultivator,
    house: { factionId: string },
    query: string
): boolean {
    const asked = query.trim();
    if (asked.length < 2 || aCrowdIsAsked(asked)) return true;
    if (/\b(?:disciple|watch|guard|gatekeeper|gate)\b/i.test(asked)) return true;
    const key = asked.toLowerCase();
    return game.present(cultivator).some(one => one.sectId === house.factionId
        && (one.name.toLowerCase() === key || key.startsWith(`${one.name.toLowerCase()} `)));
}

/**
 * The house whose gate a stranger is standing outside, or null: anywhere else, inside the gate,
 * or on its roll, the board is somebody else's question.
 */
export function theGateAStrangerStandsAt(
    game: GameService,
    cultivator: Cultivator
): { factionId: string; factionName: string } | null {
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (!game.atHand || !here || here.area.for !== 'gate') return null;
    const house = theHouseWhoseGateThisIs(game.atHand, here.place.name);
    if (!house || cultivator.sectId === house.factionId
        || game.repos.sects.getMembership(cultivator.id)?.sectId === house.factionId) return null;
    return { factionId: house.factionId, factionName: house.factionName };
}

/** The gate's answer: the board is inside, and what the house puts up for outsiders. */
export function whatTheGateSaysOfItsWork(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    house: { factionId: string; factionName: string }
): Execution {
    const world = game.atHand;
    const onDay = Math.floor(run.elapsedDays);
    const seat = world?.locations.find(row => row.id === world.factions
        .find(faction => faction.id === house.factionId)?.seatLocationId) ?? null;
    const watch = world && seat ? theOneOnWatchAtTheGate(world, seat) : null;
    const who = watch && thePlayerIsSureItIsThem(watch.name, game.knowledge.awareness(cultivator.id))
        ? watch.name : 'The disciple on the gate';

    const asking = world
        ? everythingEachHouseIsAsking(whoEachHouseIsLookingFor(world), whatEachHouseHasAPriceOn(world))
        : new Map();
    const speaking = housesWithSomethingToSay(asking).find(row => row.id === house.factionId) ?? null;
    // A notice somebody has turned in is down, and the gate does not name it.
    const isDown = theNoticesThatAreDown({
        runSeed: run.seed, today: onDay, windowDays: A_BILL_STAYS_UP_FOR_DAYS,
        turnedIn: theNoticesTurnedIn(game, cultivator.id)
    });
    const asks = speaking?.postsInPublic ? speaking.asks.filter(ask => !isDown(house.factionId, ask)) : [];
    // "the town walls of the Jade Gorge": a name's own "The" is lower case inside a sentence.
    const province = provinceForFaction(house.factionId)?.name.replace(/^The /, 'the ') ?? null;

    const lines = [
        `${who} says the board is inside the walls and is for ${house.factionName}'s own. `
        + 'Nobody outside the gate reads it.'
    ];
    if (asks.length === 0) {
        lines.push(`${who} says ${house.factionName} has nothing up for outsiders.`);
    } else {
        // Said by the watch, not remembered: played, a bare "what is up" was narrated as the
        // player's own memory of walls they had walked past.
        // The owner: the wall below the gate carries the house's notices, "but they also know so
        // they can also just tell you".
        lines.push(`${who} names what ${house.factionName} has up for outsiders now, on the wall below `
            + `the gate and on the town walls${province ? ` of ${province}` : ''}:`);
        const said = new Set<string>();
        for (const ask of asks) {
            const first = !said.has(ask.kind);
            said.add(ask.kind);
            lines.push(`  ${whatThePaperSays(speaking!, ask, onDay)}${first ? ` ${WHAT_A_NOTICE_DOES_NOT_BUY[ask.kind]}` : ''}`);
        }
    }

    const facts = factsForToolResult(`Asked at the gate of ${house.factionName} after its board.`, lines);
    facts.structure.push(`theGateSpeaksForItsHouse(${house.factionId}): ${asks.length} asks put up for `
        + 'outsiders; the board is inside the walls. No time passed.');
    const execution = game.freeAction(run, 'interact', facts);
    execution.calls = [{
        name: 'engine.theGateSpeaksForItsHouse',
        action: 'talk',
        summary: `The gate of ${house.factionName} answered after its board: ${asks.length} asks for outsiders.`,
        ok: true
    }];
    return execution;
}

/**
 * The town below a house's wall, said on every look from outside its gate and not only on
 * arriving. Played blind: a starving stranger at the Azure Dew gate asked "is there anywhere near
 * here i can get food?", the look said nothing of the inn and the market below the wall, and the
 * model had the watch answer "There is nothing for you here."
 */
export function theTownBelowTheGate(
    game: GameService,
    cultivator: Cultivator
): { lines: string[]; structure: string } | null {
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    if (!game.atHand || !here || here.area.for !== 'gate') return null;
    const house = theHouseWhoseGateThisIs(game.atHand, here.place.name);
    const reading = house ? whatTheTownIsBelow(house.factionId) : null;
    if (!house || !reading) return null;
    const trades = whatTradesBelow(reading);
    return {
        lines: [`Outside the wall there is a ${howBigTheTownBelowIs(reading)}, and it is here because the `
            + `house is: ${trades.map(trade => trade.name).join(', ')}.`],
        structure: `theTownBelowTheGate(${house.factionId}): ${trades.map(trade => trade.id).join(', ')}. `
            + 'Read only, nothing spent.'
    };
}
