/**
 * City visitors must be people the ordinary scene can address, with their own
 * house and assignment in the private card. Looking grants no private detail.
 * The same turn route must accept a bid and a competition entry and persist
 * the engine's result; a scripted narrator only proves which facts reach it.
 * Recovered 2026-10-03 spatial ruling: city presence alone does not expose
 * auction lots. The transaction fixture stands in the actual auction house;
 * the public calendar remains city information. This replaces the earlier
 * fixture that accidentally allowed city-street bidding.
 * A purchased pill has a provenance row as well as its counted pouch unit.
 * Swallowing must spend both, so the consumed unit cannot be sold or handed in.
 * The deterministic narrator prints EngineFacts.prose, so catalogue and run
 * metadata must stay out of that channel while the lot and entry remain told.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { exchangeOffers } from '../../src/engine/world/wares-at-a-capital-exchange.js';
import { listPouch } from '../../src/server/consolidated/cultivation-support.js';
import { capitalCalendar, capitalPlaces } from '../../src/engine/world/capital-missions-and-calendar.js';
import { whatTheHouseMakesOf } from '../../src/engine/world/what-a-house-gives-merit-for.js';
import { makeFact } from '../../src/engine/world/history.js';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { thePeopleHere } from '../../src/web/the-narrator-plays-the-world.js';
import { whoAnswersTo } from '../../src/engine/world/what-a-house-answers-to.js';
import { enterAnOpenCompetition } from '../../src/engine/world/entering-an-open-competition.js';
import { markDead, setRealm } from '../../src/engine/world/npc-state.js';
import { vacanciesOnTheRolls } from '../../src/engine/world/a-house-takes-in-one-of-its-own.js';

async function opened(seed: string, provider?: ScriptedProvider) {
    const h = await makeGameInWorld({ seed, worldSeed: 'capital-play', provider });
    const run = await h.game.newRun('Visitor');
    return { ...h, ...run, world: h.game.atHand! };
}
function said(turn: { narration: string; toolCalls: { summary: string }[] }) {
    return turn.narration + ' ' + turn.toolCalls.map(c => c.summary).join(' ');
}

async function buyHealingConsignment(seed: string) {
    const h = await opened(seed);
    const city = capitalPlaces(h.world).find(l => h.world.npcs.some(n => n.locationId === l.id
        && exchangeOffers(h.world, n).some(o => h.world.objects.find(r => r.id === o.objectId)?.data.pillId === 'pill-minor-healing')))!;
    const seller = h.world.npcs.find(n => n.locationId === city.id
        && exchangeOffers(h.world, n).some(o => h.world.objects.find(r => r.id === o.objectId)?.data.pillId === 'pill-minor-healing'))!;
    const offer = exchangeOffers(h.world, seller).find(o => h.world.objects.find(r => r.id === o.objectId)?.data.pillId === 'pill-minor-healing')!;
    h.repos.cultivators.update(h.cultivator.id, { location: city.name, spiritStones: 100_000, hp: 1 });
    h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, city).whereIs.get(seller.id)!);
    h.game.theWorldMoved();
    const bought = await h.game.act(`I buy ${offer.name}`);
    expect(bought.toolCalls.some(c => c.name === 'world.tradeExchangeObject' && c.ok), said(bought)).toBe(true);
    const dose = h.world.objects.find(o => o.ownerId === h.cultivator.id && o.data.pillId === 'pill-minor-healing')!;
    expect(dose).toBeTruthy();
    return { ...h, dose, offer };
}

describe('capital events in player turns', () => {
    it('gives an addressed visitor their house and assignment through the existing private card', async () => {
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
        const h = await opened('capital-company', provider);
        const city = capitalPlaces(h.world).find(l => h.world.npcs.some(n => n.locationId === l.id && n.activity?.kind === 'stationed'))!;
        const visitor = h.world.npcs.find(n => n.locationId === city.id && n.activity?.kind === 'stationed')!;
        const house = h.world.factions.find(f => f.id === visitor.factionId)!;
        h.repos.cultivators.update(h.cultivator.id, { location: city.name });
        h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, city).whereIs.get(visitor.id)!);
        h.game.knowledge.learnIfNew({ holderId: h.cultivator.id, kind: 'cultivator', id: visitor.id,
            name: visitor.name, onDay: h.world.currentDay, sourceKind: 'told', stage: 'placed', statement: 'They introduced themselves.' });
        const me = h.repos.cultivators.getById(h.cultivator.id)!;
        const company = h.game.company(me);
        expect(company.named.some(p => p.name === visitor.name)).toBe(true);
        const awareness = h.game.knowledge.awareness(me.id);
        const privateCard = thePeopleHere(company, me.realmOrdinal, awareness, visitor.name).join(' ');
        expect(privateCard).toContain(`House: ${house.name}`);
        expect(privateCard).toContain(visitor.activity!.note);
        expect(thePeopleHere(company, me.realmOrdinal, awareness, null).join(' ')).not.toContain('Assignment:');
        plans.push(JSON.stringify({ action: 'interact', intent: 'talk', target: visitor.name, topic: 'why are you here' }));
        h.game.theWorldMoved();
        const turn = await h.game.act(`I ask ${visitor.name} why they are here`);
        expect(turn.narration).toBe('(scripted)');
        const prompt = provider.calls.filter(c => !(c.messages.find(m => m.role === 'system')?.content ?? '').startsWith('You are the intent router'))
            .at(-1)!.messages.find(m => m.role === 'user')!.content;
        expect(prompt).toContain(`House: ${house.name}`);
        expect(prompt).toContain(visitor.activity!.note);
    }, 120_000);

    it('lists and bids on the same real lot, then pays and receives it at closing', async () => {
        const h = await opened('capital-bid');
        const city = capitalPlaces(h.world)[0]!;
        const seller = h.world.npcs.find(n => n.locationId === city.id && n.status === 'alive')!;
        const day = h.world.currentDay;
        h.repos.cultivators.update(h.cultivator.id, { location: city.name, spiritStones: 10_000 });
        h.world.objects.push(makeObject({ id: 'played-lot', name: 'Auction Cargo', kind: 'material',
            ownerId: seller.id, ownerName: seller.name, possessorId: seller.id, locationId: city.id }));
        appendWorldFact(h.world, makeFact({ day, kind: 'gathering', summary: 'Auction Cargo was offered.', locationId: city.id,
            data: { auctionLot: true, objectId: 'played-lot', sellerId: seller.id, payeeId: seller.id,
                reserve: 100, closesOnDay: day + 1 } }));
        h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, city).areas.find(a => a.name === 'the auction house')!.id);
        h.game.theWorldMoved();
        const listed = await h.game.act('I look at the auction lots');
        expect(said(listed)).toContain('Auction Cargo');
        expect(listed.narration).toContain('Auction Cargo');
        expect(listed.narration).not.toContain('persisted auction catalogue');
        const bid = await h.game.act('I bid 900 spirit stones on Auction Cargo');
        expect(bid.toolCalls.some(c => c.name === 'world.bidAtCapitalAuction' && c.ok), said(bid)).toBe(true);
        h.world.currentDay = day + 1;
        h.game.theWorldMoved();
        await h.game.act('I look around');
        expect(h.world.objects.find(o => o.id === 'played-lot')!.ownerId).toBe(h.cultivator.id);
        expect(h.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(9100);
    }, 120_000);

    it('enters and resolves the city board from the same player competition verb', async () => {
        const h = await opened('capital-entry');
        const year = Math.floor(h.world.currentDay / 365);
        const occasion = [year, year + 1, year + 2].flatMap(y => capitalCalendar(h.world, y)).find(o => o.kind === 'competition')!;
        const city = h.world.locations.find(l => l.id === occasion.venueId)!;
        h.world.currentDay = occasion.onDay;
        h.repos.cultivators.update(h.cultivator.id, { location: city.name, realmOrdinal: 8 });
        h.game.theWorldMoved();
        const turn = await h.game.act('I enter the public competition');
        expect(turn.toolCalls.some(c => c.name === 'engine.enterAnOpenCompetition' && c.ok), said(turn)).toBe(true);
        expect(turn.narration).toContain('competition');
        expect(turn.narration).not.toMatch(/Public competition entry at world day|run cultivator-/);
        const result = h.world.history.facts.find(f => f.data.capitalCompetition === true && f.data.result === true
            && f.actors.some(a => a.id === h.cultivator.id));
        expect(result?.data).toMatchObject({ venueId: city.id, place: expect.any(Number) });
        expect(said(turn)).toContain(result!.summary);
        expect(said(turn)).toContain('1. ');
    }, 120_000);
    it('buys a visiting house consignment finite stock and sells it back through the ordinary market verbs', async () => {
        const h = await opened('exchange-purchase');
        const city = capitalPlaces(h.world).find(l => h.world.npcs.some(n => n.locationId === l.id && exchangeOffers(h.world, n).length))!;
        const seller = h.world.npcs.find(n => n.locationId === city.id && n.activity?.kind === 'stationed' && exchangeOffers(h.world, n).length)!;
        const offered = exchangeOffers(h.world, seller)[0]!;
        h.repos.cultivators.update(h.cultivator.id, { location: city.name, spiritStones: 100_000, realmOrdinal: 14 });
        h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, city).whereIs.get(seller.id)!);
        h.game.theWorldMoved();
        const bought = await h.game.act(`I buy ${offered.name}`);
        expect(bought.toolCalls.some(c => c.name === 'world.tradeExchangeObject' && c.ok), said(bought)).toBe(true);
        expect(h.world.objects.find(o => o.id === offered.objectId)!.ownerId).toBe(h.cultivator.id);
        expect(listPouch(h.repos.db, h.cultivator.id).length).toBeGreaterThan(0);
        // Buying the last lot can move a seller from the exchange into the street.
        h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, city).whereIs.get(seller.id)!);
        const sold = await h.game.act(`I sell ${offered.name}`);
        expect(sold.toolCalls.some(c => c.name === 'world.tradeExchangeObject' && c.ok), said(sold)).toBe(true);
        expect(h.world.objects.find(o => o.id === offered.objectId)!.ownerId).toBe(seller.id);
    }, 120_000);

    it('enters a winning player on the receiving house roll at its lowest rank', async () => {
        const h = await opened('capital-feeder');
        const receiver = h.world.factions.find(host => host.dissolvedOnDay === null
            && host.tags.includes('recruits')
            && h.world.factions.some(home => home.dissolvedOnDay === null
                && whoAnswersTo(host.id).includes(home.id)
                && Number(host.resources.power_ordinal ?? 0) > Number(home.resources.power_ordinal ?? 0)
                && h.repos.sects.getById(home.id)))!;
        const home = h.world.factions.find(house => whoAnswersTo(receiver.id).includes(house.id)
            && Number(receiver.resources.power_ordinal ?? 0) > Number(house.resources.power_ordinal ?? 0)
            && h.repos.sects.getById(house.id))!;
        expect(h.repos.sects.getById(receiver.id)).toBeTruthy();
        const city = capitalPlaces(h.world)[0]!;
        city.controllingFactionId = receiver.id;
        const year = Math.floor(h.world.currentDay / 365);
        const occasion = [year, year + 1, year + 2].flatMap(y => capitalCalendar(h.world, y))
            .find(o => o.kind === 'competition' && o.venueId === city.id)!;
        h.world.currentDay = occasion.onDay;
        while ((vacanciesOnTheRolls(h.world, occasion.onDay).get(receiver.id) ?? 0) < 3) {
            const outgoing = h.world.npcs.findIndex(n => n.status === 'alive' && n.factionId === receiver.id);
            expect(outgoing).toBeGreaterThanOrEqual(0);
            h.world.npcs[outgoing] = markDead(h.world.npcs[outgoing]!, occasion.onDay,
                'Died before the competition.');
        }
        expect(vacanciesOnTheRolls(h.world, occasion.onDay).get(receiver.id), 'receiving roll vacancy').toBeGreaterThanOrEqual(3);
        const rival = h.world.npcs.find(n => n.locationId === city.id && n.status === 'alive')!;
        for (const person of h.world.npcs) if (person.id !== h.cultivator.id) {
            person.locationId = null;
            person.activity = null;
            Object.assign(person, setRealm(person, 0, occasion.onDay));
        }
        Object.assign(rival, setRealm(rival, 0, occasion.onDay),
            { locationId: city.id, factionId: receiver.id, activity: null });
        enterAnOpenCompetition(h.world, receiver, rival, occasion.onDay, occasion.opensOnDay, city.id);
        h.repos.sects.addMember(home.id, h.cultivator.id, 2);
        h.repos.cultivators.update(h.cultivator.id, { location: city.name, realmOrdinal: 12 });
        h.game.theWorldMoved();
        const turn = await h.game.act('I enter the public competition');
        const selection = h.world.history.facts.find(f => f.data.feederSelection === true
            && f.actors.some(a => a.id === h.cultivator.id))!;
        expect(selection, said(turn)).toBeTruthy();
        expect(selection.data).toMatchObject({ fromHouseId: home.id, toHouseId: receiver.id });
        expect(h.repos.sects.getMembership(h.cultivator.id)).toMatchObject({ sectId: receiver.id, rankIndex: 0 });
        expect(h.repos.cultivators.getById(h.cultivator.id)!.sectId).toBe(receiver.id);
        expect(said(turn)).toContain(selection.summary);
    }, 120_000);

    it('swallows a bought pill once and retires its tracked unit with its pouch count', async () => {
        const h = await buyHealingConsignment('exchange-swallow');
        const swallowed = await h.game.act(`I swallow ${h.offer.name}`);
        expect(swallowed.toolCalls.some(c => c.name === 'alchemy_manage.consume_pill' && c.ok), said(swallowed)).toBe(true);
        expect(h.world.objects.find(o => o.id === h.dose.id)!.tags).toContain('ruined');
        expect(listPouch(h.repos.db, h.cultivator.id).some(p => p.itemId === 'pill-minor-healing')).toBe(false);
    }, 120_000);

    it('hands a bought pill to a house that needs it without retaining a second counted unit', async () => {
        const h = await buyHealingConsignment('exchange-hand-in');
        const house = h.world.factions.find(f => {
            if (f.dissolvedOnDay !== null || !f.seatLocationId || !h.repos.sects.getById(f.id)) return false;
            const purse = f.resources.spirit_stones;
            f.resources.spirit_stones = 0;
            if (whatTheHouseMakesOf(h.world, f.id, h.dose).wanted) return true;
            f.resources.spirit_stones = purse!;
            return false;
        })!;
        expect(house, 'a house with an empty purse must need this medicine').toBeTruthy();
        h.repos.sects.addMember(house.id, h.cultivator.id, 1);
        const seat = h.world.locations.find(l => l.id === house.seatLocationId)!;
        h.repos.cultivators.update(h.cultivator.id, { location: seat.name });
        h.game.theWorldMoved();
        const handed = await h.game.act(`I hand ${h.offer.name} in to the sect`);
        expect(handed.toolCalls.some(c => c.name === 'world.theHouseTakesItIn' && c.ok), said(handed)).toBe(true);
        expect(h.world.objects.find(o => o.id === h.dose.id)!.ownerId).toBe(house.id);
        expect(listPouch(h.repos.db, h.cultivator.id).some(p => p.itemId === 'pill-minor-healing')).toBe(false);
    }, 120_000);

});
