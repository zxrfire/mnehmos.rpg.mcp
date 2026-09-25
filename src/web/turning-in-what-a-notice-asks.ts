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
import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import { takeFromTheHouse } from '../engine/world/a-house-holds-its-own.js';
import { A_BILL_STAYS_UP_FOR_DAYS } from '../engine/world/houses-that-have-to-advertise-for-disciples.js';
import { SENDING_REASONS } from '../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { aNoticeId, hasItComeDown, whatANoticeWantsBrought } from '../engine/encounters/a-notice-is-turned-in.js';
import {
    everythingEachHouseIsAsking,
    housesWithSomethingToSay,
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
    const house = housesWithSomethingToSay(asking).find(row => row.id === houseId);
    const today = Math.floor(run.elapsedDays);
    const window = Math.floor(today / A_BILL_STAYS_UP_FOR_DAYS);
    const turnedIn = theNoticesTurnedIn(game, playerId);
    return (house?.postsInPublic ? house.asks : []).flatMap(ask => {
        const reason = ask.kind === 'work' && ask.reasonId
            ? SENDING_REASONS.find(row => row.id === ask.reasonId) : undefined;
        const wants = reason ? whatANoticeWantsBrought(reason) : null;
        if (!reason || !wants) return [];
        const noticeId = aNoticeId(houseId, reason.id, window);
        const status = hasItComeDown({
            runSeed: run.seed, noticeId, today, turnedIn,
            windowStartDay: window * A_BILL_STAYS_UP_FOR_DAYS, windowDays: A_BILL_STAYS_UP_FOR_DAYS
        });
        return [{ noticeId, reason, wants, status }];
    });
}

/** The herbs and beast parts the player carries, cheapest first, which is what goes in first. */
function theMaterialsCarried(game: GameService, playerId: string) {
    return listPouch(game.db, playerId)
        .map(entry => ({ entry, is: whatAnIngredientIs(entry.itemId) }))
        .filter((row): row is { entry: typeof row.entry; is: NonNullable<typeof row.is> } => row.is !== null)
        .sort((a, b) => a.is.value - b.is.value);
}

/** Turning in at a house's gate what one of its notices asks. */
export function turnInWhatANoticeAsks(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    house: { factionId: string; factionName: string }
): Execution {
    const notices = whatTheHouseAsksBrought(game, run, cultivator.id, house.factionId);
    const open = notices.find(row => !row.status.down);
    if (!open) {
        const beaten = notices.find(row => row.status.byWhom === 'somebody else');
        const mine = notices.find(row => row.status.byWhom === 'the player');
        return refused('engine.turnInANotice', 'sect', factsForRefusal(
            'Nothing to turn in against.',
            beaten
                ? `Somebody else brought ${house.factionName} what its notice asked on day `
                  + `${beaten.status.onDay}, and the notice is down. The second to bring it gets nothing.`
                : mine
                    ? `You turned in what ${house.factionName}'s notice asked already, and it is down.`
                    : `${house.factionName} has nothing up that asks for anything to be brought.`,
            `turnInANotice(${house.factionId}): ${notices.length} notice(s) asking something brought, none up.`
        ));
    }

    const carried = theMaterialsCarried(game, cultivator.id);
    const held = carried.reduce((sum, row) => sum + row.entry.quantity, 0);
    if (held < open.wants.lots) {
        return refused('engine.turnInANotice', 'sect', factsForRefusal(
            'Not enough to turn in.',
            `${house.factionName}'s notice asks for ${open.wants.lots} lots of herbs or beast parts, `
            + `and you carry ${held}. Nothing is handed over.`,
            `turnInANotice(${open.noticeId}): ${held} of ${open.wants.lots} lots carried.`
        ));
    }

    // WHAT GOES IN, cheapest first, and the house pays out of what it holds.
    let owed = open.wants.lots;
    const handed: string[] = [];
    for (const row of carried) {
        if (owed <= 0) break;
        const taken = Math.min(owed, row.entry.quantity);
        if (removeFromPouch(game.db, cultivator.id, row.entry.itemId, taken)) {
            owed -= taken;
            handed.push(`${taken} ${row.is.name}`);
        }
    }
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
    facts.structure.push(`turnInANotice(${open.noticeId}): ${open.wants.lots} lots in, ${stones} stones out. `
        + 'First to turn it in; the notice is down.');
    const execution = game.freeAction(run, 'sect', facts);
    execution.calls = [{
        name: 'engine.turnInANotice',
        action: 'sect',
        summary: `${open.wants.lots} lots turned in to ${house.factionName}; ${stones} stones paid; notice ${open.noticeId} down.`,
        ok: true
    }];
    return execution;
}
