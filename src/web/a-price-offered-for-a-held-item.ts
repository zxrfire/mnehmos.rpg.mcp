import { randomUUID } from 'node:crypto';
/** Person-to-person item trade uses the actual holder, purse and ordinary decision. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';
import { wouldPartWithHeldItem, completeHeldItemSale, openHeldItemOffers, writeHeldItemOffer,
    priceOfferedForHeldItem } from '../engine/world/a-person-is-offered-a-price-for-what-they-hold.js';
import { isTheWorldsToMove, type NpcRecord } from '../engine/world/npc-state.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { transferActualSpiritStones, actualSpiritStones } from './transferring-actual-spirit-stones.js';
import { standInTheWorld } from './the-player-as-a-row-the-world-can-invite.js';
import { positionIn } from './standing.js';
import { factsForToolResult } from './facts.js';
import { stonesNamedIn } from './tool-result-prose.js';

import { itemTradeSaid } from './what-is-being-swapped-for-what.js';
import { makeObject } from '../engine/world/possessions.js';
import { everythingInThePouch, removeFromPouch, addToPouch, readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { FLAG_RATIONS_HELD } from './flag-keys.js';
import { nameOfHeld } from './what-a-holder-would-take-for-it.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import { whatThisThingIs } from '../engine/world/what-a-house-gives-merit-for.js';
import { matchScore, MATCH_THRESHOLD } from './entities.js';
import { wouldBuyHeldItem, heldItemValue, heldItemNeed } from '../engine/world/a-person-is-offered-a-price-for-what-they-hold.js';

function playerAsPerson(game: GameService, body: Cultivator): NpcRecord | null {
    const world = game.atHand!; const member = positionIn(game.repos, body.id);
    const person = standInTheWorld(world, body, { factionId: member?.sectId ?? null,
        rankIndex: member?.rankIndex ?? -1, contribution: member?.contribution ?? 0 }, routineTime(world));
    return person ? { ...person, locationId: game.worldPlaceOf(body) } : null;
}

export function tradeAHeldItem(game: GameService, run: Run, body: Cultivator,
    target: string | undefined, input: string, direction?: 'buy'|'sell', named?: string): Execution | null {
    const world = game.atHand, here = game.worldPlaceOf(body);
    if (!world || !here) return null;
    let said = itemTradeSaid(input);
    if (!said && direction && named) {
        const reachesOwnedItem = direction==='sell' && world.objects.some(o=>o.ownerId===body.id&&o.possessorId===body.id
            &&matchScore(named,o.name)>=MATCH_THRESHOLD);
        if (!reachesOwnedItem) return null;
        const reached=game.present(body).find(p=>world.npcs.some(n=>n.id===p.id&&isTheWorldsToMove(n)));
        if (!reached) return game.freeAction(run,'sell',factsForToolResult('No buyer is here.',
            ['There is nobody here to put a price to for the item you hold.']));
        said={person:reached.name,item:named,selling:direction==='sell'};
    }
    if (!said) return null;
    const view = playerAsPerson(game, body);
    const found = game.partyPutTo(body, target || said.person, game.scopeFor(body));
    const other = world.npcs.find(p => p.id === found?.id && p.status === 'alive');
    const no = (line: string) => game.freeAction(run, 'interact', factsForToolResult('No item or money changed hands.', [line]));
    if (!view || !other || !game.present(body).some(p => p.id === other.id)) return no('That person is not here to exchange the item.');
    const seller = said.selling ? view : other, buyer = said.selling ? other : view;
    const offers = openHeldItemOffers(world, seller.id).filter(f => f.data.buyerId === buyer.id
        && world.objects.some(o => o.id === f.data.objectId && matchScore(said.item, o.name) >= MATCH_THRESHOLD));
    const offer = offers.length === 1 ? offers[0] : undefined;
    const held = world.objects.filter(o => o.possessorId === seller.id && o.ownerId === seller.id);
    const matches = held.map(object => ({ object, score: matchScore(said.item, object.name) }))
        .filter(row => row.score >= MATCH_THRESHOLD).sort((a, b) => b.score - a.score);
    let object = offer ? held.find(o => o.id === offer.data.objectId) : matches[0]?.score !== matches[1]?.score ? matches[0]?.object : undefined;
    const stock = everythingInThePouch(game.db, seller.id).map(lot => ({...lot,
        name: lot.kind==='ration'?'Rations':getTechnique(lot.itemId)?.name ?? whatAnIngredientIs(lot.itemId)?.name ?? nameOfHeld(lot.itemId)}))
        .map(lot => ({lot,score:matchScore(said.item,lot.name)})).filter(row=>row.score>=MATCH_THRESHOLD)
        .sort((a,b)=>b.score-a.score);
    const counted = stock[0]?.score !== stock[1]?.score ? stock[0]?.lot : undefined;
    let newRow = false;
    if (!object && counted && matches.length===0) {
        object = makeObject({id:'item-trade:'+randomUUID(),name:counted.name,
            kind:counted.kind==='manual'?'manual':counted.kind==='artifact'?'artifact':counted.kind==='pill'?'pill':'material',
            significance:'notable',ownerId:seller.id,ownerName:seller.name,possessorId:seller.id,
            data: counted.kind==='manual'?{techniqueId:counted.itemId}:counted.kind==='pill'?{pillId:counted.itemId}:{materialId:counted.itemId}});
        newRow=true;
    }
    if (!object) return matches.length > 1 ? no('Name which held item you mean; more than one answers.') : null;
    if (said.quoting) {
        const price=Math.ceil(heldItemValue(world,object));
        const line=price>0?`${object.name}: ${price} spirit stones from its known value. ${other.name} has not yet agreed to a sale.`
            : `${other.name} holds ${object.name}. No price has been agreed; you can put an offer to them.`;
        return game.freeAction(run,'request',factsForToolResult('The item is in its actual holder?s hands.',[line]));
    }
    if (said.reply === 'refuse') {
        if (!offer) return no('There is no outstanding offer from that person for this item.');
        const line = `You refused the offer for ${object.name}. The item remains yours.`;
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', locationId: here,
            visibility: 'secret', witnessIds: [seller.id, buyer.id], causes: [offer.id],
            actors: [{ id: seller.id, name: seller.name, role: 'seller' }, { id: buyer.id, name: buyer.name, role: 'buyer' }],
            summary: line, data: { heldItemOfferAnswered: true, refused: true, objectId: object.id } }), { bystanders: false });
        game.theWorldMoved(); return game.freeAction(run, 'interact', factsForToolResult(line, [line]));
    }
    const namedPrice = stonesNamedIn(input);
    const price = said.reply === 'accept' ? offer?.data.stones : namedPrice ?? (heldItemValue(world, object) || undefined);
    if (typeof price !== 'number' || !Number.isInteger(price) || price < 0) return no('Name a whole number of spirit stones, or answer an actual offer.');
    if ((actualSpiritStones(game, buyer.id) ?? 0) < price) return no(`The buyer cannot pay ${price} spirit stones from their actual purse.`);
    const value = heldItemNeed(world, seller, object);
    if (!said.selling && !wouldPartWithHeldItem(world, seller, buyer, object, price, value))
        return no(`${other.name} refused ${price} spirit stones for ${object.name}.`);
    if (said.selling && !(offer?.data.stones === price) && !wouldBuyHeldItem(world, buyer, seller, object, price))
        return no(`${other.name} refused to buy ${object.name} for ${price} spirit stones.`);
    const backing = counted && (newRow || object.id===counted.itemId
        || Object.values(object.data).includes(counted.itemId)) ? counted : undefined;
    const units = newRow ? 1 : Math.max(1, whatThisThingIs(object)?.quantity ?? 1);
    if (backing && backing.quantity < units) return no('The actual inventory no longer holds that whole item lot.');
    if (newRow) world.objects.push(object);
    const sold = completeHeldItemSale(world, object.id, seller, buyer, price, here,
        commit => transferActualSpiritStones(game, buyer.id, seller.id, price, () => {
            if (backing) {
                if (backing.kind === 'ration') {
                    const before=Number(readFlag(game.db,seller.id,FLAG_RATIONS_HELD)??0);
                    if (before<units) throw new Error('The offered rations changed before payment.');
                    writeFlag(game.db,seller.id,FLAG_RATIONS_HELD,String(before-units));
                    writeFlag(game.db,buyer.id,FLAG_RATIONS_HELD,String(Number(readFlag(game.db,buyer.id,FLAG_RATIONS_HELD)??0)+units));
                } else {
                    if (!removeFromPouch(game.db,seller.id,backing.itemId,units)) throw new Error('The actual offered inventory changed before payment.');
                    addToPouch(game.db,buyer.id,backing.itemId,backing.kind,units);
                }
            }
            commit();
        }).ok, offer);
    if (!sold && newRow) world.objects=world.objects.filter(row=>row.id!==object!.id);
    if (!sold) return no('The actual item or payment changed before the exchange.');
    game.theWorldMoved();
    const line = `${object.name} sold for ${price} spirit stones. ${buyer.id === body.id ? 'You hold' : other.name + ' holds'} the item.`;
    return game.freeAction(run, 'interact', factsForToolResult(line, [line]));
}

/** Exact contact settles an ordinary person's priced proposal, never the player's answer. */
export function offersForYourHeldItems(game: GameService, body: Cultivator): string[] {
    const world = game.atHand, here = game.worldPlaceOf(body);
    if (!world || !here || !body.alive) return [];
    const seller = playerAsPerson(game, body); if (!seller) return [];
    const seen = game.present(body), now = routineTime(world), lines: string[] = [];
    for (const object of world.objects.filter(o => o.possessorId === body.id && o.ownerId === body.id)) {
        for (const face of seen) {
            const buyer = world.npcs.find(p => p.id === face.id && isTheWorldsToMove(p));
            if (!buyer) continue;
            const price = priceOfferedForHeldItem(world,object,seller,buyer,now); if (!price) continue;
            writeHeldItemOffer(world, object, seller, buyer, price.stones, here, price.untilDay);
            lines.push(`${face.name} offered ${price.stones} spirit stones for your ${object.name}.`);
        }
    }
    if (lines.length) game.theWorldMoved();
    return lines;
}
