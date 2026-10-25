/**
 * Turning in what a house's notice asks, at its gate: the first to bring it is paid out of the
 * house's stores, and the paper comes down.
 *
 * The owner: "first person to turn it in gets it, and they retract the notice. if you're second,
 * tough luck". So nothing here is signed for. The player brings what the paper names to the gate,
 * which speaks for the house to outsiders, and is paid or told somebody else got there first.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { FLAG_NOTICES_TURNED_IN } from './flag-keys.js';
import { listPouch, readJsonFlag, removeFromPouch, writeFlag } from '../server/consolidated/cultivation-support.js';
import { takeFromTheHouse } from '../engine/world/a-house-holds-its-own.js';
import { A_BILL_STAYS_UP_FOR_DAYS } from '../engine/world/houses-that-have-to-advertise-for-disciples.js';
import { aNoticeId, hasItComeDown } from '../engine/encounters/a-notice-is-turned-in.js';
import { matchScore } from './entities.js';
import {
    everythingEachHouseIsAsking,
    housesWithSomethingToSay,
    theNoticesOnThisWall,
    whatEachHouseHasAPriceOn,
    whoEachHouseIsLookingFor
} from './what-is-posted-on-the-wall-here.js';

/** The notices this player turned in, by notice id. */
export function theNoticesTurnedIn(game: Pick<GameService, 'db'>, playerId: string): ReadonlySet<string> {
    return new Set(readJsonFlag<string[]>(game.db, playerId, FLAG_NOTICES_TURNED_IN) ?? []);
}

/** The house's notices that ask something brought, each with whether it has come down. */
function whatTheHouseAsksBrought(game: GameService, run: Run, playerId: string, houseId: string) {
    const world = game.atHand;
    const asking = world
        ? everythingEachHouseIsAsking(whoEachHouseIsLookingFor(world), whatEachHouseHasAPriceOn(world))
        : new Map();
    const today = Math.floor(run.elapsedDays);
    const house = housesWithSomethingToSay(asking, today).find(row => row.id === houseId);
    const window = Math.floor(today / A_BILL_STAYS_UP_FOR_DAYS);
    const turnedIn = theNoticesTurnedIn(game, playerId);
    return (house?.postsInPublic ? house.asks : []).flatMap(ask => {
        const wants = ask.kind === 'work' ? ask.item : undefined;
        if (!wants) return [];
        const noticeId = aNoticeId(houseId, wants.id, window);
        const status = hasItComeDown({
            runSeed: run.seed, noticeId, today, turnedIn,
            windowStartDay: window * A_BILL_STAYS_UP_FOR_DAYS, windowDays: A_BILL_STAYS_UP_FOR_DAYS
        });
        return [{ noticeId, wants, status }];
    });
}

/**
 * Where what they are handing in is turned in, said to a stranger away from any house's gate: the
 * gate of every house whose notice asks for the thing they named, or of the notices on the wall
 * where they stand when they named only "the notice". Null where no notice up is what they mean,
 * and handing in is somebody else's question.
 */
export function whereANoticeIsTurnedIn(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    said: string | undefined
): Execution | null {
    const world = game.atHand;
    if (!world) return null;
    const asking = everythingEachHouseIsAsking(whoEachHouseIsLookingFor(world), whatEachHouseHasAPriceOn(world));
    const turnedIn = theNoticesTurnedIn(game, cultivator.id);
    const named = (said ?? '').trim();
    const byName = named.length === 0 ? [] : housesWithSomethingToSay(asking, Math.floor(run.elapsedDays))
        .flatMap(house => house.postsInPublic ? house.asks.flatMap(ask =>
            ask.kind === 'work' && ask.item && matchScore(named, ask.item.name) > 60
                && whatTheHouseAsksBrought(game, run, cultivator.id, house.id)
                    .some(row => row.wants.id === ask.item!.id && !row.status.down)
                ? [{ houseId: house.id, houseName: house.name, item: ask.item }] : []) : []);
    const onThisWall = byName.length > 0 || !/\bnotices?\b/i.test(named) ? [] : theNoticesOnThisWall(cultivator, run, asking, turnedIn)
        .flatMap(notice => notice.kind === 'work' && notice.item
            ? [{ houseId: notice.houseId, houseName: notice.houseName, item: notice.item }] : []);
    const wanted = byName.length > 0 ? byName : onThisWall;
    if (wanted.length === 0) return null;
    const seatOf = (houseId: string): string | null => {
        const seat = world.factions.find(row => row.id === houseId)?.seatLocationId;
        return world.locations.find(row => row.id === seat)?.name ?? null;
    };
    const lines = wanted.slice(0, 3).map(row => {
        const seat = seatOf(row.houseId);
        return `${row.houseName} takes in the ${row.item.count} ${row.item.name} its notice asks for at `
            + `its own gate${seat ? `, at ${seat}` : ''}.`;
    });
    return refused('engine.turnInANotice', 'sect', factsForRefusal(
        'A notice is turned in at the gate of the house that put it up.',
        `${lines.join(' ')} Nothing is handed over here.`,
        `whereANoticeIsTurnedIn: ${wanted.length} notice(s) ask for what was named; not at any of their gates.`
    ));
}

/** How many of one thing the player carries. */
function howManyCarried(game: GameService, playerId: string, itemId: string): number {
    return listPouch(game.db, playerId).filter(entry => entry.itemId === itemId)
        .reduce((sum, entry) => sum + entry.quantity, 0);
}

/** Turning in at a house's gate what one of its notices asks. */
export function turnInWhatANoticeAsks(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    house: { factionId: string; factionName: string },
    /** What they said they were handing in, which picks between two notices where it can. */
    said?: string
): Execution {
    const notices = whatTheHouseAsksBrought(game, run, cultivator.id, house.factionId);
    const up = notices.filter(row => !row.status.down);
    // The notice they meant: the one they named, else the one they carry enough for.
    const named = said ? up.find(row => matchScore(said, row.wants.name) > 60) : undefined;
    const open = named
        ?? up.find(row => howManyCarried(game, cultivator.id, row.wants.id) >= row.wants.count)
        ?? up[0];
    if (!open) {
        const beaten = notices.find(row => row.status.byWhom === 'somebody else');
        const mine = notices.find(row => row.status.byWhom === 'the player');
        return refused('engine.turnInANotice', 'sect', factsForRefusal(
            'Nothing to turn in against.',
            beaten
                ? `Somebody else brought ${house.factionName} the ${beaten.wants.count} ${beaten.wants.name} `
                  + `its notice asked for on day ${beaten.status.onDay}, and the notice is down. The second `
                  + 'to bring it gets nothing.'
                : mine
                    ? `You turned in what ${house.factionName}'s notice asked already, and it is down.`
                    : `${house.factionName} has nothing up that asks for anything to be brought.`,
            `turnInANotice(${house.factionId}): ${notices.length} notice(s) asking something brought, none up.`
        ));
    }

    const held = howManyCarried(game, cultivator.id, open.wants.id);
    if (held < open.wants.count) {
        return refused('engine.turnInANotice', 'sect', factsForRefusal(
            'Not enough to turn in.',
            `${house.factionName}'s notice asks for ${open.wants.count} ${open.wants.name}, and you `
            + `carry ${held}. Nothing is handed over.`
            + (up.length > 1 ? ` Its other notice${up.length > 2 ? 's ask' : ' asks'} for `
                + `${up.filter(row => row !== open).map(row => `${row.wants.count} ${row.wants.name}`).join(' and ')}.` : ''),
            `turnInANotice(${open.noticeId}): ${held} of ${open.wants.count} carried.`
        ));
    }

    // WHAT GOES IN, and the house pays out of what it holds.
    removeFromPouch(game.db, cultivator.id, open.wants.id, open.wants.count);
    const handed = [`${open.wants.count} ${open.wants.name}`];
    const coffers = game.atHand?.factions.find(row => row.id === house.factionId) ?? null;
    const paid = coffers
        ? takeFromTheHouse(Number(coffers.resources.spirit_stones ?? 0), open.wants.purse, 'notice')
        : null;
    const stones = paid ? paid.moved : open.wants.purse;
    if (coffers && paid) {
        coffers.resources.spirit_stones = paid.after;
        game.theWorldMoved();
    }
    game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: stones });
    writeFlag(game.db, cultivator.id, FLAG_NOTICES_TURNED_IN,
        JSON.stringify([...theNoticesTurnedIn(game, cultivator.id), open.noticeId]));

    const lines = [
        `The disciple on the gate takes ${handed.join(', ')} for ${house.factionName}'s notice and `
        + `pays ${stones} spirit stone${stones === 1 ? '' : 's'} out of the house's stores. `
        + 'The notice comes down.',
        ...(paid?.cameUpShort ? [`The house had less than the paper said, and paid what it had.`] : [])
    ];
    const facts = factsForToolResult(`Turned in ${house.factionName}'s notice.`, lines);
    facts.structure.push(`turnInANotice(${open.noticeId}): ${open.wants.count} in, ${stones} stones out. `
        + 'First to turn it in; the notice is down.');
    const execution = game.freeAction(run, 'sect', facts);
    execution.calls = [{
        name: 'engine.turnInANotice',
        action: 'sect',
        summary: `${open.wants.count} ${open.wants.name} turned in to ${house.factionName}; ${stones} stones paid; notice ${open.noticeId} down.`,
        ok: true
    }];
    return execution;
}
