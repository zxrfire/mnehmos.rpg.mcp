/**
 * A private native word had no SQL body/purse adapter. These played controls
 * use the one offer/service/completion/grievance path on actual people: silence
 * is no consent, a real completed watch pays once, leaving fails the word and
 * an emptied payer creates an unpaid-work grievance. Nothing credits a house.
 * The payer's ordinary routine leaves the worker's area during the watch.
 * Completion is retained; the fixture arranges a real subsequent meeting through
 * the area reader and SQL standing writer before requiring the actual payment.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { routineTime } from '../../src/engine/world/npc-routines';
import { offerPrivateWork, privateWorkTerms } from '../../src/engine/world/private-paid-work';
import { privateWorkBodiesFor, settlePrivateWorkAtTheBody, offerPrivateWorkFromThePlayer } from '../../src/web/private-work-with-a-person';
import { ledgerAbout, writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { settleObligation } from '../../src/engine/social/grudges';
import { makeObject } from '../../src/engine/world/possessions';
import { addToPouch, pouchQuantity } from '../../src/storage/cultivator-pouch';
import { factsWithDataValue } from '../../src/engine/world/witness-reaction-index';
import { getHerb } from '../../src/data/cultivation/herbs';
import { aPrivatePillPromiseNamesARealDose } from '../../src/web/a-private-pill-promise-names-a-real-dose';
import { whatThisThingIs } from '../../src/engine/world/what-a-house-gives-merit-for';

async function prepared(payment: 'stones' | 'pill' | 'favor' = 'stones', work: 'watch' | 'gather' = 'watch') {
    const h = await makeGameInWorld({ seed: 'actual-private-work', worldSeed: 'actual-private-work-world' });
    const { cultivator } = await h.game.newRun('Worker');
    const world = h.game.atHand!, day = routineTime(world);
    const place = makeLocation({ id: 'private-work-court', name: 'Private Work Court', kind: 'settlement' });
    world.locations.push(place);
    const employer = createNpc(world.seed, { id: 'actual-private-payer', name: 'Lin Chen', locationId: place.id,
        bornOnDay: day - 24 * 365, onDay: day, spiritStones: 50 });
    world.npcs.push(employer);
    const area = theAreasOf(world, place).whereIs.get(employer.id)!;
    h.game.repos.cultivators.update(cultivator.id, { location: place.name });
    h.game.repos.cultivators.standIn(cultivator.id, area);
    if (payment === 'pill') world.objects.push(makeObject({ id: 'actual-private-pill-wage', name: 'Qi Gathering Pill',
        kind: 'pill', ownerId: employer.id, possessorId: employer.id, ownerName: employer.name,
        data: { pillId: 'pill-qi-gathering', doses: 1 } }));
    const offer = offerPrivateWork(world, employer.id, cultivator.id, {
        objective: work === 'watch' ? { kind: 'watch', locationId: place.id, days: 0.25 }
            : { kind: 'gather', herbId: getHerb('herb-blood-millet')!.id,
                quantity: 1, locationId: place.id, recipientId: employer.id },
        payment: payment === 'stones' ? { kind: 'stones', amount: 7 } : payment === 'pill'
            ? { kind: 'pill', objectId: 'actual-private-pill-wage' } : { kind: 'favor', severity: 'serious' },
        dueOnDay: day + (work === 'watch' ? 2 : 20), description: work === 'watch' ? 'Keep a private watch for six hours.'
            : 'Gather and deliver the named herb.' }, day, privateWorkBodiesFor(h.game));
    expect(offer).not.toBeNull();
    h.game.theWorldMoved();
    return { ...h, employer, place, body: h.game.currentRun().cultivator, offer: offer! };
}

async function meetPayer(h: Awaited<ReturnType<typeof prepared>>) {
    const world = h.game.atHand!;
    const area = theAreasOf(world, h.place).whereIs.get(h.employer.id);
    expect(area).toBeDefined();
    h.game.repos.cultivators.standIn(h.body.id, area!);
    expect(h.game.present(h.game.state().cultivator).some(face => face.id === h.employer.id)).toBe(true);
    await h.game.act('look around');
}

describe('private work with the actual person', () => {
    it('offers without an automatic word or advance wage', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        const looked = await h.game.act('look around');
        expect(looked.narration).toContain('Do you accept the private paid work?');
        expect(h.game.atHand!.obligations.some(word => word.triggeringEventId === h.offer.id)).toBe(false);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
    });
    it('pays a completed fractional watch once through the actual two purses', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        const accepted = await h.game.act('I accept the private paid work');
        expect(accepted.narration).toContain('accepted the private paid work');
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        await h.game.act('I wait 6 hours');
        expect(factsWithDataValue(h.game.atHand!, 'privateWorkCompleted', h.offer.id).some(fact => fact.data.finished)).toBe(true);
        await meetPayer(h);
        expect(h.game.state().cultivator.spiritStones).toBe(before + 7);
        expect(h.game.atHand!.npcs.find(person => person.id === h.employer.id)!.spiritStones).toBe(43);
        settlePrivateWorkAtTheBody(h.game);
        expect(h.game.state().cultivator.spiritStones).toBe(before + 7);
        expect(ledgerAbout(h.db, h.body.id).some(word => word.triggeringEventId === h.offer.id && word.status === 'settled')).toBe(true);
        expect(factsWithDataValue(h.game.atHand!, 'privateWorkPayment', h.offer.id)).toHaveLength(1);
    }, 120000);
    it('records a broken word if the worker leaves the real ground', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        await h.game.act('I accept the private paid work');
        h.game.repos.cultivators.update(h.body.id, { location: 'Emerald Water City' });
        settlePrivateWorkAtTheBody(h.game);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        expect(ledgerAbout(h.db, h.body.id).some(word => word.tags.includes('private-work-failed') && word.subjectId === h.body.id)).toBe(true);
    });
    it('records unpaid completed work if the actual payer spent the stones', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        await h.game.act('I accept the private paid work');
        h.game.atHand!.npcs.find(person => person.id === h.employer.id)!.spiritStones = 0;
        h.game.theWorldMoved();
        await h.game.act('I wait 6 hours');
        await meetPayer(h);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        expect(ledgerAbout(h.db, h.body.id).some(word => word.tags.includes('private-work-unpaid') && word.holderId === h.body.id)).toBe(true);
    }, 120000);
    it('can be paid in a real favour rather than merit or contribution', async () => {
        const h = await prepared('favor');
        await h.game.act('I accept the private paid work');
        await h.game.act('I wait 6 hours');
        await meetPayer(h);
        expect(ledgerAbout(h.db, h.body.id).some(word => word.kind === 'favor' && word.tags.includes('private-work-payment')
            && word.holderId === h.body.id && word.subjectId === h.employer.id)).toBe(true);
        expect(h.game.atHand!.obligations.some(word => word.kind === 'favor' && word.tags.includes('private-work-payment')
            && (word.holderId === h.body.id || word.subjectId === h.body.id))).toBe(false);
    }, 120000);
    it('moves the actual pill wage into SQL custody only once', async () => {
        const h = await prepared('pill');
        await h.game.act('I accept the private paid work');
        await h.game.act('I wait 6 hours');
        await meetPayer(h);
        const thing = h.game.atHand!.objects.find(object => object.id === 'actual-private-pill-wage')!;
        expect(thing.possessorId).toBe(h.body.id);
        expect(pouchQuantity(h.db, h.body.id, String(thing.data.pillId))).toBe(1);
        settlePrivateWorkAtTheBody(h.game);
        expect(pouchQuantity(h.db, h.body.id, String(thing.data.pillId))).toBe(1);
    }, 120000);
    it('a player-originated offer uses ordinary NPC consent and defers payment', async () => {
        const h = await prepared(), world = h.game.atHand!, before = h.body.spiritStones;
        const offer = offerPrivateWorkFromThePlayer(h.game, h.body, h.employer.id, {
            objective: { kind: 'watch', locationId: h.place.id, days: 0.25 }, payment: { kind: 'stones', amount: 10 },
            dueOnDay: routineTime(world) + 2, description: 'Keep watch for the actual player.' });
        expect(offer).not.toBeNull();
        expect(privateWorkTerms(offer!)!.payment).toEqual({ kind: 'stones', amount: 10 });
        expect(factsWithDataValue(world, 'privateWorkAnswer', offer!.id)).toHaveLength(1);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
    });
    it('the played gather and explicit delivery pay for actual harvested goods', async () => {
        const h = await prepared('stones', 'gather'), before = h.body.spiritStones;
        const herb = getHerb('herb-blood-millet')!;
        const offer = h.offer;
        await h.game.act('I accept the private paid work');
        const gather = await h.game.act('I forage for ' + herb.name);
        const gathered = h.game.atHand!.objects.find(object => object.data.privateGather === offer.id);
        expect(gathered, gather.narration).toBeDefined();
        expect(gathered!.possessorId).toBe(h.body.id);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        h.game.repos.cultivators.standIn(h.body.id, theAreasOf(h.game.atHand!, h.place).whereIs.get(h.employer.id)!);
        const delivered = await h.game.act(`I deliver ${herb.name} to ${h.employer.name}`);
        expect(delivered.narration).toContain('delivered');
        expect(h.game.atHand!.objects.find(object => object.id === gathered!.id)!.possessorId).toBe(h.employer.id);
        expect(pouchQuantity(h.db, h.body.id, herb.id)).toBe(0);
        expect(h.game.state().cultivator.spiritStones).toBe(before + 7);
    }, 120000);
    it('one promised pill dose splits actual stock and transfers only that dose', async () => {
        const h = await prepared(), world = h.game.atHand!, id = 'pill-qi-gathering';
        addToPouch(h.db, h.body.id, id, 'pill', 2);
        world.objects.push(makeObject({ id: 'two-real-private-wage-doses', name: 'Qi Gathering Pill', kind: 'pill',
            ownerId: h.body.id, ownerName: h.body.name, possessorId: h.body.id, data: { pillId: id, quantity: 2 } }));
        const dose = aPrivatePillPromiseNamesARealDose(h.game, h.body, id)!;
        expect(whatThisThingIs(dose)?.quantity).toBe(1);
        expect(pouchQuantity(h.db, h.body.id, id)).toBe(2);
        expect(world.objects.filter(object => object.possessorId === h.body.id && object.data.pillId === id)
            .reduce((total, object) => total + whatThisThingIs(object)!.quantity, 0)).toBe(2);
        const bodies = privateWorkBodiesFor(h.game);
        expect(bodies.payPill!(dose.id, h.body.id, h.employer.id, routineTime(world), h.offer.id)).toBe(true);
        expect(pouchQuantity(h.db, h.body.id, id)).toBe(1);
        expect(world.objects.find(object => object.id === dose.id)!.possessorId).toBe(h.employer.id);
        expect(bodies.payPill!(dose.id, h.body.id, h.employer.id, routineTime(world), h.offer.id)).toBe(false);
        expect(pouchQuantity(h.db, h.body.id, id)).toBe(1);
    });
    it('the sentence offer enters the same ordinary decision and does not prepay', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        h.game.theyGaveTheirName(h.body, h.game.currentRun().run, h.employer);
        const offered = await h.game.act(`I offer ${h.employer.name} 10 spirit stones to keep watch for 0.25 days within 2 days`);
        const offer = factsWithDataValue(h.game.atHand!, 'privateWorkOffer', true).find(fact =>
            fact.actors.some(actor => actor.id === h.body.id && actor.role === 'offered'));
        expect(offer, offered.narration).toBeDefined();
        expect(factsWithDataValue(h.game.atHand!, 'privateWorkAnswer', offer!.id)).toHaveLength(1);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
    });
    it('a word released through the ordinary ledger cannot later pay or fail from its former native copy', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        await h.game.act('I accept the private paid work');
        const word = ledgerAbout(h.db, h.body.id).find(word => word.triggeringEventId === h.offer.id)!;
        writeOneObligation(h.db, settleObligation(word, { resolution: 'oath_released', byId: h.employer.id,
            onDay: routineTime(h.game.atHand!), note: 'The holder released the remaining private watch.' }));
        settlePrivateWorkAtTheBody(h.game);
        await h.game.act('I wait 6 hours');
        await meetPayer(h);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        expect(factsWithDataValue(h.game.atHand!, 'privateWorkPayment', h.offer.id)).toHaveLength(0);
        expect(h.game.atHand!.obligations.find(term => term.id === word.id)!.settlement?.resolution).toBe('oath_released');
        expect(ledgerAbout(h.db, h.body.id).some(term => term.tags.includes('private-work-failed'))).toBe(false);
    }, 120000);
});
