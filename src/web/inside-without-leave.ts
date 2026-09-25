/**
 * Inside a house's walls without its leave: the third road past a gate, and what follows it.
 *
 * `standing-at-the-gate-of-a-house.ts` names the three roads in, and this is the third: over the
 * wall, past the people on it. Nothing here is a new rule.
 *
 *   the approach      declared by the sentence ("sneak in", "over the wall"), which is what
 *                     separates it from walking up to the gate and being asked
 *   who sees it       `concealmentHolds`, witness by witness: a witness below your rung does not
 *                     see you, and one at or above it does. At the wall the witnesses are the one
 *                     on watch and the house's people in its yard
 *   where it lands    `reachThrough` from the seat with the walls gone around (`enteredAt`), and
 *                     then the forecourt in the areas read, where a member let in stands
 *   being caught      `whatTheHouseDoesAboutIt`, carried out by `carryOutWhatAHouseDoes`
 *
 * Being inside without leave is a standing fact (`FLAG_INSIDE_WITHOUT_LEAVE`). At the end of every
 * turn it is read against whoever of the house is standing with them, and it lapses once they are
 * outside the walls, on the house's roll, or caught.
 */

import { getSect } from '../data/cultivation/sects.js';
import { concealmentHolds } from '../engine/cultivation/regard.js';
import { whatTheHouseDoesAboutIt } from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import type { Deed } from '../engine/social-leverage/what-a-deed-leaves.js';
import { shapeOf } from '../engine/social-leverage/what-somebody-does-about-being-wronged.js';
import { pathTo, reachThrough } from '../engine/world/architecture.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import {
    npcsWhereTheyStand,
    theOneOnWatchAtTheGate,
    whoCouldBeSentToTheGate
} from '../engine/world/where-in-a-place-somebody-is-standing.js';
import {
    npcsStandingIn,
    theSeatOfTheCompound,
    whereCompoundsAre
} from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { clearFlag, readJsonFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { guestPlaceHeldBy } from '../server/consolidated/sect-guest.js';
import { factsForRefusal, factsForToolResult, type EngineFacts } from './facts.js';
import { FLAG_INSIDE_WITHOUT_LEAVE } from './flag-keys.js';
import { howThisCultivatorStandsInTheHouseHolding } from './how-this-cultivator-stands-on-this-ground.js';
import { thePlayerIsSureItIsThem } from './the-narrator-plays-the-world.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import { standThemIn, theAreaTheyAreIn, theGateLetsThemIn } from './walking-across-a-place.js';
import {
    theHouseThisNameReaches,
    theHouseWhoseGateThisIs,
    whatTheGateOfThisHouseSays,
    type AHouseYouCouldWalkTo
} from './walking-up-to-a-house.js';

/** What is stored while they are inside. */
interface InsideWithoutLeave {
    houseId: string;
    seatId: string;
    sinceDay: number;
}

/**
 * The sentence going around a gate rather than up to it. Read off the sentence as typed, because
 * the plan says only `enter`, and walking in openly is `enter` too.
 */
const GOING_AROUND = new RegExp([
    String.raw`\b(?:sneak|sneaks|sneaking|slip|slips|slipping|creep|creeps|creeping|steal|steals|stealing)\s+(?:in|inside|into|past|around|round|over|through)\b`,
    String.raw`\binfiltrat\w*`,
    String.raw`\bover\s+(?:the|a|its|their)\s+walls?\b`,
    String.raw`\b(?:scale|scales|climb|climbs|hop|hops|jump|jumps|vault|vaults)\s+(?:the|a|its|their)\s+walls?\b`,
    String.raw`\b(?:go|goes|get|gets)\s+(?:around|round)\s+(?:the\s+)?gates?\b`
].join('|'), 'i');

/** What the sentence may name besides the house itself: the house's ground and its wall. */
const THE_GROUND_OF_IT = /^(?:the\s+|its\s+|their\s+)?(?:wall|walls|gate|gates|compound|grounds?|sect|house|seat|estate|yard|courtyard|forecourt|in|inside)$/i;

function theyMeanToGoAround(rawInput: string): boolean {
    return GOING_AROUND.test(rawInput);
}

/** On this house's roll, or sitting in on its guest roll. */
function theyHaveLeave(game: GameService, cultivator: Cultivator, houseId: string): boolean {
    return game.repos.sects.getMembership(cultivator.id)?.sectId === houseId
        || guestPlaceHeldBy(game.db, cultivator.id)?.hostFactionId === houseId;
}

/**
 * The first of these who sees somebody at this rung going unseen, strongest first: anybody at or
 * above it, which is where `concealmentHolds` stops holding. Null for nobody.
 */
export function theOneWhoSeesThem(yourOrdinal: number, witnesses: readonly NpcRecord[]): NpcRecord | null {
    return [...witnesses]
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal || (a.id < b.id ? -1 : 1))
        .find(npc => !concealmentHolds(yourOrdinal, {
            concealed: true,
            presentedAs: Math.max(0, Math.min(npc.cultivation.realmOrdinal, yourOrdinal - 1)),
            witnessOrdinal: npc.cultivation.realmOrdinal
        })) ?? null;
}

/** A line in both channels the player reads. */
function alsoSay(facts: EngineFacts, line: string): void {
    facts.lines.push(line);
    facts.prose = facts.prose.length > 0 ? `${facts.prose}\n\n${line}` : line;
}

/** Who saw them, as the player can name them. */
function whoSaw(game: GameService, cultivator: Cultivator, seer: NpcRecord, houseName: string, watchId: string | null): string {
    if (thePlayerIsSureItIsThem(seer.name, game.knowledge.awareness(cultivator.id))) return seer.name;
    return seer.id === watchId ? 'The disciple on watch at the gate' : `Somebody of the ${houseName}`;
}

/**
 * Over the wall of the house whose gate they are standing at, or null where the sentence is not
 * that and the gate or the road should answer it.
 */
export function goingOverTheWall(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined,
    rawInput: string
): Execution | null {
    const world = game.atHand;
    if (!world || !theyMeanToGoAround(rawInput)) return null;
    const here = theAreaTheyAreIn(world, cultivator);
    const house = here ? theHouseWhoseGateThisIs(world, here.place.name) : null;
    if (!here || !house) return null;
    const named = (target ?? '').trim();
    if (named.length > 0 && !THE_GROUND_OF_IT.test(named)
        && theHouseThisNameReaches(world, named.replace(/^the\s+/i, ''))?.factionId !== house.factionId) {
        return null;
    }
    if (here.area.for !== 'gate') {
        return refused('engine.goingOverTheWall', 'move', factsForRefusal(
            `You are already inside the walls of the ${house.factionName}.`,
            `You are standing in ${here.area.name}, inside the walls of the ${house.factionName}.`,
            `goingOverTheWall: ${here.area.id} is not outside the gate. Nothing spent.`
        ));
    }
    // SOMEBODY THE GATE WOULD LET IN HAS NO WALL TO GO OVER, and is answered by the gate.
    if (theyHaveLeave(game, cultivator, house.factionId)
        || theGateLetsThemIn(whatTheGateOfThisHouseSays(game, cultivator, house).way)) {
        return null;
    }

    // WHERE IT LANDS: the seat, with its walls gone around.
    const onDay = Math.floor(world.currentDay);
    const { access } = howThisCultivatorStandsInTheHouseHolding({
        ground: house.seat, cultivator, standing: null, onDay
    });
    const reach = reachThrough(pathTo(world.locations, house.seat.id), access, { enteredAt: house.seat.id });
    if (reach.stoppedAt !== null) {
        return refused('engine.goingOverTheWall', 'move', factsForRefusal(
            `You do not get over the wall of the ${house.factionName}.`,
            reach.reason,
            `goingOverTheWall: reachThrough(${house.seat.id}, enteredAt) stopped at ${reach.stoppedAt}. Nothing spent.`
        ));
    }

    // WHO IS ON THE WALL: the one on watch, and the house's people in its yard.
    const watch = theOneOnWatchAtTheGate(world, house.seat) ?? whoCouldBeSentToTheGate(world, house.seat);
    const yard = npcsStandingIn(world, house.seat.id).filter(npc => npc.factionId === house.factionId);
    const witnesses = [...new Map([...yard, ...(watch ? [watch] : [])].map(npc => [npc.id, npc])).values()]
        .filter(npc => npc.status === 'alive' && npc.id !== cultivator.id);
    const seer = theOneWhoSeesThem(cultivator.realmOrdinal, witnesses);
    const read = witnesses.map(npc => `${npc.id}@${npc.cultivation.realmOrdinal}`).join(', ') || 'nobody';
    game.repos.runs.incrementTurn(run.id, 1);

    if (seer !== null) {
        const facts = factsForToolResult('Seen on the wall.', [
            `You go at the wall of the ${house.factionName}. `
            + `${whoSaw(game, cultivator, seer, house.factionName, watch?.id ?? null)} sees you on it.`
        ]);
        facts.structure.push(
            `goingOverTheWall(${house.factionId}): rung ${cultivator.realmOrdinal} against ${read}; `
            + `concealmentHolds fails against ${seer.id} at ${seer.cultivation.realmOrdinal}.`
        );
        const calls = theHouseCatchesThem(game, run, cultivator, house, seer, 'on its wall', facts);
        alsoSay(facts, `You are outside the gate of the ${house.factionName}.`);
        return { facts, events: [], timeSkip: null, breakthrough: null, outcome: 'executed', calls };
    }

    standThemIn(game, cultivator, 'forecourt');
    const landed = theAreaTheyAreIn(world, game.repos.cultivators.getById(cultivator.id) ?? cultivator);
    const stored: InsideWithoutLeave = { houseId: house.factionId, seatId: house.seat.id, sinceDay: onDay };
    writeFlag(game.repos.db, cultivator.id, FLAG_INSIDE_WITHOUT_LEAVE, JSON.stringify(stored));
    const line = `You go over the wall of the ${house.factionName} and come down in `
        + `${landed?.area.name ?? 'the forecourt'}. Nobody sees you.`;
    const facts = factsForToolResult('Over the wall.', [
        line,
        `You are inside the ${house.factionName} without its leave.`
    ]);
    facts.structure.push(
        `goingOverTheWall(${house.factionId}): rung ${cultivator.realmOrdinal} against ${read}; `
        + `concealmentHolds against every one. Standing in ${landed?.area.id ?? 'the forecourt'}; `
        + `${FLAG_INSIDE_WITHOUT_LEAVE} written. No time passed.`
    );
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{
            name: 'world.goingOverTheWall',
            action: 'move',
            summary: `${cultivator.name} went over the wall of ${house.factionName} unseen. No time passed.`,
            ok: true
        }]
    };
}

/**
 * Whoever of the house is standing with somebody inside its walls without leave, at the end of a
 * turn, and whether one of them sees them. Null where there is nothing to say.
 */
export function somebodyInsideSeesThem(
    game: GameService,
    run: Run,
    cultivator: Cultivator
): { lines: string[]; calls: ToolCallRecord[] } | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;
    const inside = readJsonFlag<InsideWithoutLeave>(game.repos.db, cultivator.id, FLAG_INSIDE_WITHOUT_LEAVE);
    if (inside === null) return null;

    const compounds = whereCompoundsAre(world);
    const placeId = game.worldPlaceOf(cultivator);
    const seat = theSeatOfTheCompound(world, placeId, compounds);
    const here = theAreaTheyAreIn(world, cultivator);
    const outside = seat === null || seat.id !== inside.seatId || (placeId === seat.id && here?.area.for === 'gate');
    if (outside || theyHaveLeave(game, cultivator, inside.houseId)) {
        clearFlag(game.repos.db, cultivator.id, FLAG_INSIDE_WITHOUT_LEAVE);
        return null;
    }

    const standing = placeId === seat.id && here
        ? npcsWhereTheyStand(world, here.place, cultivator.standingIn, { id: cultivator.id, sectId: cultivator.sectId })
        : npcsStandingIn(world, placeId!, compounds);
    const witnesses = standing.filter(npc => npc.factionId === inside.houseId && npc.status === 'alive');
    if (witnesses.length === 0) return null;
    const seer = theOneWhoSeesThem(cultivator.realmOrdinal, witnesses);
    const read = witnesses.map(npc => `${npc.id}@${npc.cultivation.realmOrdinal}`).join(', ');
    if (seer === null) {
        return {
            lines: [],
            calls: [{
                name: 'world.insideWithoutLeave',
                action: 'move',
                summary: `Inside ${inside.houseId} without leave since day ${inside.sinceDay}; rung `
                    + `${cultivator.realmOrdinal} against ${read}: concealmentHolds against every one.`,
                ok: true
            }]
        };
    }

    const faction = world.factions.find(row => row.id === inside.houseId);
    const house: AHouseYouCouldWalkTo = {
        factionId: inside.houseId,
        factionName: faction?.name ?? getSect(inside.houseId)?.name ?? inside.houseId,
        seat
    };
    const facts = factsForToolResult('', []);
    const lines = [`${whoSaw(game, cultivator, seer, house.factionName, null)} sees you inside the walls of `
        + `the ${house.factionName}, where you have no leave to be.`];
    const calls = theHouseCatchesThem(game, run, cultivator, house, seer, 'inside its walls', facts);
    lines.push(...facts.lines);
    calls.push({
        name: 'world.insideWithoutLeave',
        action: 'move',
        summary: `Inside ${inside.houseId} without leave since day ${inside.sinceDay}; rung `
            + `${cultivator.realmOrdinal} against ${read}; concealmentHolds fails against ${seer.id}. `
            + facts.structure.join(' '),
        ok: true
    });
    return { lines, calls };
}

/**
 * The house has them: `whatTheHouseDoesAboutIt` over a trespass, carried out, and where that leaves
 * them. Put out through the gate where the house acted on them in person and did not take years
 * off them; left where they stand where the matter went over their head.
 */
function theHouseCatchesThem(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    house: AHouseYouCouldWalkTo,
    seer: NpcRecord,
    where: string,
    facts: EngineFacts
): ToolCallRecord[] {
    const onDay = Math.floor(run.elapsedDays);
    const mine = game.repos.sects.getMembership(cultivator.id)?.sectId ?? null;
    const mySect = mine ? getSect(mine) : undefined;
    const theirs = getSect(house.factionId);
    const deed: Deed = {
        cause: shapeOf('trespassed').cause,
        // Nothing was taken off the house, so it cost the house nothing it had.
        paidBy: 'subject',
        cost: 0,
        onDay,
        description: `${cultivator.name} was found ${where} by ${seer.name}, and is not of ${house.factionName}.`,
        knownTo: [house.factionId],
        witnesses: 1,
        participants: [seer.id],
        tags: ['trespassed']
    };
    const answer = whatTheHouseDoesAboutIt({
        deed,
        offender: {
            id: cultivator.id,
            name: cultivator.name,
            houseId: mine,
            houseName: mySect?.name ?? mine,
            alignment: mySect?.alignment ?? null,
            ranked: mine !== null
        },
        answering: {
            id: house.factionId,
            name: house.factionName,
            houseId: house.factionId,
            houseName: house.factionName,
            alignment: theirs?.alignment ?? null,
            ranked: true
        },
        backing: mine !== null && mine !== house.factionId ? 'backed' : 'none',
        // They have hands on the person, which is as far along knowing as there is short of a name.
        stages: new Map([[house.factionId, 'encountered']]),
        theirOrdinal: seer.cultivation.realmOrdinal,
        yourOrdinal: cultivator.realmOrdinal,
        worth: { wouldBeMissed: mine !== null },
        onDay
    });
    const calls = game.carryOutWhatAHouseDoes({
        answer, deed, run, cultivator, mine, facts,
        houseId: house.factionId,
        houseName: house.factionName,
        howItKnows: `seen ${where} by ${seer.id}`,
        grudge: { tags: ['trespassed', 'over_the_wall'] },
        action: 'move'
    });
    clearFlag(game.repos.db, cultivator.id, FLAG_INSIDE_WITHOUT_LEAVE);

    const inHand = answer.acting === 'they_can_act' && answer.bother !== 'beyond_them' && answer.indenture === null;
    const placeId = game.worldPlaceOf(cultivator);
    const alreadyOutside = placeId === house.seat.id && theAreaTheyAreIn(game.atHand, cultivator)?.area.for === 'gate';
    if (inHand && !alreadyOutside) {
        if (placeId !== house.seat.id) game.repos.cultivators.update(cultivator.id, { location: house.seat.name });
        standThemIn(game, game.repos.cultivators.getById(cultivator.id) ?? cultivator, 'gate');
        alsoSay(facts, `You are put out through the gate of the ${house.factionName}.`);
        facts.structure.push(`Put out: ${placeId} to outside the gate of ${house.seat.id}.`);
    }
    return calls;
}
