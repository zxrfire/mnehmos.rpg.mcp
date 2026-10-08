/** The player's sheet supplies presence and purse to the same auction used by the world. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { PlannedAction } from './actions.js';
import { capitalCalendar } from '../engine/world/capital-missions-and-calendar.js';
import { bidAtCapitalAuction, capitalAuctionLots, settleCapitalAuctions } from '../engine/world/a-capital-auction.js';
import { addToPouch } from '../server/consolidated/cultivation-support.js';
import { whatThisThingIs } from '../engine/world/what-a-house-gives-merit-for.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

import { presenceForScene } from './playing-through-a-presence.js';
import { theAreaTheyAreIn, theAreaNamed } from './walking-across-a-place.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { refused } from './tool-result-prose.js';

export async function attendACapitalAuction(game: GameService, run: Run, cultivator: Cultivator,
    action: PlannedAction, said: string): Promise<Execution | null> {
    const bid = /^\s*(?:i\s+)?bid\s+(\d+)\s+(?:spirit\s+)?stones?\s+(?:on|for)\s+(.+?)\s*[.!]?$/i.exec(said);
    const asking = /\bauction\b/i.test(said) && /\b(?:attend|look|lots|when|read|what|calendar|schedule|scheduled|date|dates)\b/i.test(said);
    if (!bid && !asking && action.intent !== 'auction' && action.intent !== 'auction_bid') return null;
    game.atHand = game.atHand ?? await game.loadWorld();
    const world = game.atHand;
    const observer = presenceForScene(game, cultivator);
    const here = game.worldPlaceOf(observer);
    const day = Math.floor(world?.currentDay ?? 0);
    const calendarOnly = !bid && action.intent !== 'auction_bid'
        && /\b(?:when|calendar|schedule|scheduled|dates?)\b/i.test(said)
        && !/\b(?:lots?|bid|bidding)\b/i.test(said);
    // A calendar is public information about the city. Stock and bids belong
    // to the actual auction-house scene, including an actual remote presence.
    if (!calendarOnly) {
        const at = theAreaTheyAreIn(world, observer);
        const auction = at && world ? theAreaNamed(theAreasOf(world, at.place).areas, 'auction house') : null;
        if (!at || !auction || at.area.id !== auction.id) return refused('world.capitalAuctionArea', 'market', factsForRefusal(
            'The auction lots are not here.',
            auction ? `The lots and bidding are in ${auction.name}. Move to ${auction.name} to inspect them or bid.`
                : 'There is no auction house here.',
            'No lot inspected, no bid submitted, no purse changed.'));
    }
    const lots = !calendarOnly && world && here ? capitalAuctionLots(world, here, day) : [];
    const lines: string[] = [];
    let ok = true;
    let mutation = false;
    if (bid || action.intent === 'auction_bid') {
        const target = (bid?.[2] ?? action.target ?? '').toLowerCase().replace(/[.!]$/, '').trim();
        const numbered = /^lot\s+(\d+)$/.exec(target);
        const lot = numbered ? lots[Number(numbered[1]) - 1]
            : lots.find(f => world?.objects.find(o => o.id === f.data.objectId)?.name.toLowerCase() === target);
        const npcAt = world?.npcs.findIndex(n => n.id === cultivator.id) ?? -1;
        const stones = Number(bid?.[1] ?? action.topic);
        if (world && npcAt >= 0) world.npcs[npcAt] = { ...world.npcs[npcAt]!, spiritStones: cultivator.spiritStones };
        const recorded = world && here && lot && npcAt >= 0
            ? bidAtCapitalAuction(world, world.npcs[npcAt]!, here, lot.id, stones, day, here) : null;
        ok = recorded !== null;
        mutation = ok;
        const top = lot && world ? Math.max(Number(lot.data.reserve) - 1, ...world.history.facts
            .filter(f => f.data.auctionBid === true && f.data.lotId === lot.id).map(f => Number(f.data.stones))) : 0;
        lines.push(recorded ? `You bid ${stones} spirit stones for ${world!.objects.find(o => o.id === lot!.data.objectId)!.name}.`
            : !lot ? 'That lot is not open for bidding here.' : `The bid was refused. Reserve: ${lot.data.reserve} spirit stones. Current bid: ${top}. Your purse: ${cultivator.spiritStones}; other open bids also commit that purse.`);
    } else if (world && here) {
        const future = [Math.floor(day / 365), Math.floor(day / 365) + 1]
            .flatMap(year => capitalCalendar(world, year)).filter(o => o.venueId === here && o.onDay >= day);
        for (const occasion of future) lines.push(`${occasion.kind === 'auction' ? 'Auction' : 'Inter-house competition'}: day ${occasion.onDay}, entry opens on day ${occasion.opensOnDay}.`);
        for (const [i, lot] of lots.entries()) {
            const object = world.objects.find(o => o.id === lot.data.objectId);
            const top = Math.max(Number(lot.data.reserve), ...world.history.facts
                .filter(f => f.data.auctionBid === true && f.data.lotId === lot.id).map(f => Number(f.data.stones)));
            lines.push(`Lot ${i + 1}: ${object?.name ?? 'withdrawn'}, reserve ${lot.data.reserve} spirit stones, current price ${top}, closes on day ${lot.data.closesOnDay}.`);
        }
        if (!lines.length) lines.push('No capital auction or inter-house competition is scheduled here.');
    } else lines.push('No auction is open here.');
    if (mutation) game.theWorldMoved();
    const facts = factsForToolResult(lines[0]!, lines);
    return { ...game.freeAction(run, 'market', facts), outcome: ok ? 'executed' : 'refused', facts,
        ...(calendarOnly ? { timeDisposition: 'free_read' as const } : {}),
        calls: [{ name: bid ? 'world.bidAtCapitalAuction' : calendarOnly ? 'world.capitalCalendar' : 'world.capitalAuctionLots', action: 'market', summary: lines.join(' '), ok }] };
}

/** Deferred player bids settle after the sheet's final position and purse are known. */
export function settleYourCapitalAuctions(game: GameService, cultivator: Cultivator): string[] {
    const world = game.atHand;
    const at = world?.npcs.findIndex(n => n.id === cultivator.id) ?? -1;
    if (!world || at < 0) return [];
    world.npcs[at] = { ...world.npcs[at]!, spiritStones: cultivator.spiritStones };
    const settled = settleCapitalAuctions(world, Math.floor(world.currentDay),
        { id: cultivator.id, locationId: game.worldPlaceOf(cultivator) });
    if (!settled.length) return [];
    for (const result of settled.filter(f => f.data.winnerId === cultivator.id)) {
        const object = world.objects.find(o => o.id === result.data.objectId);
        const thing = object ? whatThisThingIs(object) : null;
        if (thing && object && (object.kind === 'pill' || object.kind === 'material'))
            addToPouch(game.repos.db, cultivator.id, thing.kindId, object.kind === 'pill' ? 'pill' : 'herb', thing.quantity);
    }
    const purse = world.npcs[at]!.spiritStones;
    if (purse !== cultivator.spiritStones) game.repos.cultivators.update(cultivator.id, { spiritStones: purse });
    game.theWorldMoved();
    return settled.filter(f => f.actors.some(a => a.id === cultivator.id))
        .map(f => f.summary.replaceAll(cultivator.name, 'you'));
}
