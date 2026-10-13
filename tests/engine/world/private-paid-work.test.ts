/**
 * Private hires and commissions existed separately; a direct paid offer had
 * no common accepted word, deferred payment, or grievance for nonpayment.
 * These controls require real work/custody before payment, keep the house out
 * of the account, and prevent repeated settlement or a forged completion.
 * Non-watch work originally had only a failure-date appointment. Whole world
 * advancement now proves that preparation actually starts the journey or bench
 * work, rather than relying only on direct calls to the settlement helper.
 * Gathering words must consume actual finite ground stock after the ordinary
 * work span, deliver the same material, and pay once without house merit.
 * Refinement words use the actual named recipe, shared player odds and real
 * ingredient spend. Unrelated same-grade herbs cannot satisfy its formula;
 * a successful actual dose must be delivered before the private wage is paid.
 * Disabling only the exact-ingredient guard made both the actual spend and
 * substitute-ingredient controls fail (17 passed / 2 failed, 2026-10-12).
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { makeObject, transferPossession, isRuined } from '../../../src/engine/world/possessions.js';
import { offerPrivateWork, privatePaidWorkThisYear, settlePrivateWork, type PrivateWorkTerms } from '../../../src/engine/world/private-paid-work.js';
import { meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import Database from 'better-sqlite3';
import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';
import { addGoal } from '../../../src/engine/world/npc-state.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { advancePublicCapitalMission, sendHouseMission } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../../../src/engine/world/history.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { refiningOrdinalFor } from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { WHAT_AN_ARTIFACT_IS_MADE_OF, whatWouldFill } from '../../../src/data/cultivation/what-an-artifact-is-made-of.js';
import { whatThisPersonHasOnTheBench } from '../../../src/engine/world/what-is-on-the-bench.js';
import { takeWhatTheRecipeNames } from '../../../src/engine/world/taking-the-materials-off-the-bench.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { whoIsOnTheRoadWith } from '../../../src/engine/world/who-is-on-the-road-with-you.js';
import { HERBS, FORAGE_BASE_DAYS } from '../../../src/data/cultivation/herbs.js';
import { drawnKey } from '../../../src/engine/world/what-a-place-still-has-in-the-ground.js';
import { RECIPES } from '../../../src/data/cultivation/recipes.js';
import { getPill } from '../../../src/data/cultivation/pills.js';
import { ingredientsOfPrivateRefinement } from '../../../src/engine/world/private-work-at-a-cauldron.js';
import { refineChance } from '../../../src/engine/cultivation/the-odds-a-refinement-holds.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { whatTheRecipeSpends } from '../../../src/data/cultivation/what-an-artifact-is-made-of.js';

function accepted(terms?: Partial<PrivateWorkTerms>, prepare?: (state: WorldState) => void) {
    for (let seed = 0; seed < 100; seed++) {
        const state = createWorld({ seed: `private-paid-${seed}`, regionCount: 0, skipPriorAges: true });
        state.locations.push(makeLocation({ id: 'ground', name: 'The work site', kind: 'wilds' }));
        const employer = createNpc(state.seed, { id: 'employer', locationId: 'ground', onDay: 0, bornOnDay: -30 * 365,
            spiritStones: 1000, cultivation: { realmOrdinal: 20 } });
        const worker = createNpc(state.seed, { id: 'worker', locationId: 'ground', onDay: 0, bornOnDay: -20 * 365,
            spiritStones: 10, cultivation: { realmOrdinal: 3 } });
        employer.activity = null; worker.activity = null;
        state.npcs.push(employer, worker);
        state.objects.push(makeObject({ id: 'cargo', name: 'Actual cargo', kind: 'other', ownerId: employer.id,
            ownerName: employer.name, possessorId: employer.id, locationId: 'ground' }));
        state.objects.push(makeObject({ id: 'dose', name: 'An actual dose', kind: 'pill', ownerId: employer.id,
            ownerName: employer.name, possessorId: employer.id, locationId: 'ground' }));
        prepare?.(state);
        const offer = offerPrivateWork(state, employer.id, worker.id, { objective: { kind: 'watch', locationId: 'ground', days: 10 },
            payment: { kind: 'stones', amount: 50 }, dueOnDay: 20, description: 'Guard the work site.', ...terms }, 0.5);
        const term = state.obligations.find(row => row.tags.includes('private-paid-work'));
        if (offer && term) {
            // Wage controls arrange an actual reachable payer. The separate
            // absence control moves this body away and requires deferred pay.
            state.npcs[0] = { ...state.npcs[0], activity: { kind: 'talking', note: 'Available to receive the work and pay.',
                standingIn: state.npcs[1].activity?.standingIn, withIds: [], sinceDay: 0.5, untilDay: term.dueOnDay } };
            return { state, offer, term };
        }
    }
    throw new Error('No ordinary paid offer was accepted across the sampled arrangements.');
}

it('a private refiner spends exact actual ingredients after work, delivers the real dose and receives wages once', () => {
    const recipe = RECIPES.find(recipe => recipe.requiredOrdinal <= 3 && getPill(recipe.producesPillId)!.grade === 'mortal')!;
    const h = accepted({ objective: { kind: 'refine', recipeId: recipe.id, recipientId: 'employer' } }, state => {
        for (const ingredient of recipe.ingredients) state.objects.push(makeObject({ id: ingredient.itemId, name: ingredient.itemId,
            kind: 'material', ownerId: 'employer', possessorId: 'employer', data: { materialId: ingredient.itemId, quantity: ingredient.quantity + 1 } }));
    });
    const worker = h.state.npcs.find(person => person.id === 'worker')!, start = worker.activity!.sinceDay;
    const pill = getPill(recipe.producesPillId)!;
    const odds = refineChance(recipe.baseSuccessRate, worker.cultivation.realmOrdinal, recipe.requiredOrdinal,
        worker.cultivation.attributes.insight, 0).chance;
    for (let sample = 0; sample < 100; sample++) {
        h.state.seed = `private-refinement-success-${sample}`;
        if (forStream(h.state.seed, 'private-refinement-work', h.offer.id, worker.id).chance(odds)) break;
    }
    const employerPurse = h.state.npcs.find(person => person.id === 'employer')!.spiritStones;
    const workerPurse = worker.spiritStones;
    settlePrivateWork(h.state, start);
    const work = h.state.history.facts.find(fact => fact.data.privateRefinementStarted === h.offer.id)!;
    expect(work).toBeDefined();
    expect(h.state.objects.some(object => object.data.privateRefinement === h.offer.id)).toBe(false);
    const ready = Number(work.data.readyOnDay);
    settlePrivateWork(h.state, ready - 0.01);
    for (const ingredient of recipe.ingredients) expect(h.state.objects.find(object => object.id === ingredient.itemId)!.data.quantity)
        .toBe(ingredient.quantity + 1);
    settlePrivateWork(h.state, ready);
    const dose = h.state.objects.find(object => object.data.privateRefinement === h.offer.id)!;
    expect(dose.data.pillId).toBe(pill.id);
    expect(dose.possessorId).toBe('employer'); expect(dose.ownerId).toBe('employer');
    for (const ingredient of recipe.ingredients) expect(h.state.objects.find(object => object.id === ingredient.itemId)!.data.quantity).toBe(1);
    expect(h.state.npcs.find(person => person.id === 'employer')!.spiritStones).toBe(employerPurse - 50);
    expect(h.state.npcs.find(person => person.id === 'worker')!.spiritStones).toBe(workerPurse + 50);
    const after = h.state.objects.length;
    settlePrivateWork(h.state, ready + 1);
    expect(h.state.objects.length).toBe(after);
    expect(h.state.npcs.find(person => person.id === 'worker')!.spiritStones).toBe(workerPurse + 50);
});

it('an alchemy recipe cannot be supplied with unrelated same-grade ingredients', () => {
    const recipe = RECIPES.find(recipe => recipe.requiredOrdinal <= 3 && getPill(recipe.producesPillId)!.grade === 'mortal')!;
    const slots = ingredientsOfPrivateRefinement(recipe.id)!;
    const ids = slots.map(slot => slot.materialId!);
    const other = HERBS.find(herb => herb.grade === slots[0].grade && !ids.includes(herb.id))!;
    expect(other).toBeDefined();
    expect(whatTheRecipeSpends(getPill(recipe.producesPillId)!.grade, ids, slots)).not.toBeNull();
    expect(whatTheRecipeSpends(getPill(recipe.producesPillId)!.grade, ids.map(() => other.id), slots)).toBeNull();
});

it('a private gatherer spends real days, draws finite ground and delivers before receiving wages', () => {
    const herb = HERBS.find(herb => herb.biome === 'cave' && herb.harvestOrdinal <= 20)!;
    expect(herb).toBeDefined();
    const h = accepted({ objective: { kind: 'gather', herbId: herb.id, quantity: 2,
        locationId: 'ground', recipientId: 'employer' }, dueOnDay: 40 }, state => {
        state.locations[0].kind = 'cave';
        state.npcs[1].cultivation.realmOrdinal = Math.max(3, herb.harvestOrdinal);
    });
    const begins = h.state.npcs[1].activity!.sinceDay;
    expect(settlePrivateWork(h.state, begins)).toEqual([]);
    const ends = h.state.npcs[1].activity!.untilDay!;
    expect(ends - begins).toBe(2 * FORAGE_BASE_DAYS);
    expect(h.state.objects.some(object => object.data.privateGather === h.offer.id)).toBe(false);
    expect(settlePrivateWork(h.state, ends - 0.01)).toEqual([]);
    expect(settlePrivateWork(h.state, ends)).toEqual([h.term.id]);
    const gathered = h.state.objects.find(object => object.data.privateGather === h.offer.id)!;
    expect(gathered.data.materialId).toBe(herb.id);
    expect(gathered.data.quantity).toBe(2);
    expect(gathered.ownerId).toBe('employer'); expect(gathered.possessorId).toBe('employer');
    expect(Number(h.state.locations[0].data[drawnKey('herb', herb.grade)])).toBeGreaterThan(0);
    expect(h.state.npcs[0].spiritStones).toBe(950); expect(h.state.npcs[1].spiritStones).toBe(60);
    expect(meritWith(h.state.npcs[1], 'any-house')).toBe(0);
    expect(settlePrivateWork(h.state, ends + 1)).toEqual([]);
    expect(h.state.objects.filter(object => object.data.privateGather === h.offer.id)).toHaveLength(1);
});

it('a real span pays once from the employer to the worker, without merit', () => {
    const h = accepted();
    const ends = h.state.npcs[1].activity!.untilDay!;
    expect(h.state.npcs[0].spiritStones).toBe(1000); expect(h.state.npcs[1].spiritStones).toBe(10);
    expect(settlePrivateWork(h.state, ends - 0.01)).toEqual([]);
    expect(settlePrivateWork(h.state, ends)).toEqual([h.term.id]);
    expect(h.state.npcs[0].spiritStones).toBe(950); expect(h.state.npcs[1].spiritStones).toBe(60);
    expect(meritWith(h.state.npcs[1], 'any-house')).toBe(0);
    expect(settlePrivateWork(h.state, 30)).toEqual([]);
    expect(h.state.npcs[1].spiritStones).toBe(60);
});

it('abandonment costs no unearned payment and leaves the employer a real grievance', () => {
    const h = accepted(); h.state.npcs[1].activity = null;
    expect(settlePrivateWork(h.state, 2)).toEqual([h.term.id]);
    expect(h.state.npcs[0].spiritStones).toBe(1000);
    expect(h.state.obligations.some(row => row.kind === 'grudge' && row.holderId === 'employer'
        && row.subjectId === 'worker' && row.tags.includes('private-work-failed'))).toBe(true);
});

it('an employer who cannot pay for completed work owes a grievance to the worker', () => {
    const h = accepted(); h.state.npcs[0].spiritStones = 0;
    settlePrivateWork(h.state, h.state.npcs[1].activity!.untilDay!);
    expect(h.state.npcs[1].spiritStones).toBe(10);
    expect(h.state.obligations.some(row => row.kind === 'grudge' && row.holderId === 'worker'
        && row.subjectId === 'employer' && row.tags.includes('private-work-unpaid'))).toBe(true);
});

it('pill and favour terms pay their actual promised medium', () => {
    const dose = accepted({ payment: { kind: 'pill', objectId: 'dose' } });
    settlePrivateWork(dose.state, dose.state.npcs[1].activity!.untilDay!);
    expect(dose.state.objects.find(object => object.id === 'dose')!.ownerId).toBe('worker');
    expect(dose.state.npcs[1].spiritStones).toBe(10);
    const favour = accepted({ payment: { kind: 'favor', severity: 'slight' } });
    settlePrivateWork(favour.state, favour.state.npcs[1].activity!.untilDay!);
    expect(favour.state.obligations.some(row => row.kind === 'favor' && row.holderId === 'worker'
        && row.subjectId === 'employer' && row.tags.includes('private-work-payment'))).toBe(true);
});

it('delivery requires this worker to have handed over the real object', () => {
    const h = accepted({ objective: { kind: 'handover', objectId: 'cargo', recipientId: 'employer' } });
    expect(settlePrivateWork(h.state, 1)).toEqual([]);
    h.state.objects[0] = transferPossession(h.state.objects[0], { toHolderId: 'worker', toHolderName: 'Worker',
        onDay: 2, how: 'lent', transfersOwnership: false });
    expect(settlePrivateWork(h.state, 3)).toEqual([]);
    h.state.objects[0] = transferPossession(h.state.objects[0], { toHolderId: 'employer', toHolderName: 'Employer',
        onDay: 4, how: 'gifted', transfersOwnership: true });
    const area = theAreasOf({ ...h.state, currentDay: 4 }, h.state.locations[0]).whereIs.get('employer')!;
    h.state.npcs[0].activity = { kind: 'talking', note: 'Receiving the delivery.', withIds: [],
        standingIn: area, sinceDay: 4, untilDay: 5 };
    h.state.npcs[1].activity = { kind: 'their_own_business', note: 'Delivering.', privateWorkId: h.term.id,
        withIds: [], sinceDay: 3.5, untilDay: 20, standingIn: area };
    expect(settlePrivateWork(h.state, 4)).toEqual([h.term.id]);
    expect(h.state.npcs[1].spiritStones).toBe(60);
});

it('completed work waits for an actual meeting to pay, rather than moving stones across the world', () => {
    const h = accepted(), ends = h.state.npcs[1].activity!.untilDay!;
    h.state.locations.push(makeLocation({ id: 'elsewhere', name: 'Another place', kind: 'wilds' }));
    h.state.npcs[0].locationId = 'elsewhere';
    expect(settlePrivateWork(h.state, ends)).toEqual([]);
    expect(h.state.npcs[1].spiritStones).toBe(10);
    const completed = h.state.history.facts.find(fact => fact.data.privateWorkCompleted === h.offer.id && fact.data.finished)!;
    expect(completed.witnessIds).not.toContain('employer');
    // Going to collect earned pay must not erase the completed service.
    h.state.npcs[1].locationId = 'elsewhere';
    h.state.npcs[0].locationId = 'ground';
    h.state.npcs[1].locationId = 'ground';
    const area = theAreasOf({ ...h.state, currentDay: Math.floor(ends), currentHour: (ends % 1) * 24 },
        h.state.locations[0]).whereIs.get('worker')!;
    h.state.npcs[0].activity = { kind: 'talking', note: 'Paying the worker.', standingIn: area,
        withIds: [], sinceDay: ends, untilDay: ends + 1 };
    expect(settlePrivateWork(h.state, ends)).toEqual([h.term.id]);
    expect(h.state.npcs[1].spiritStones).toBe(60);
});

it('finding somebody crosses their actual local area before recording contact or wages', () => {
    const h = accepted({ objective: { kind: 'find', personId: 'the-sought-person' } }, state => {
        const person = createNpc(state.seed, { id: 'the-sought-person', locationId: 'ground', onDay: 0,
            bornOnDay: -25 * 365, cultivation: { realmOrdinal: 3 } });
        person.activity = null; state.npcs.push(person);
    });
    const starts = h.state.npcs[1].activity!.sinceDay;
    const areas = theAreasOf({ ...h.state, currentDay: Math.floor(starts), currentHour: (starts % 1) * 24 }, h.state.locations[0]).areas;
    const targetArea = areas.find(area => area.for !== 'room')!.id;
    const originArea = areas.find(area => area.id !== targetArea)!.id;
    for (const at of [0, 2]) h.state.npcs[at].activity = { kind: 'talking', note: 'Waiting here.',
        withIds: [], sinceDay: starts, untilDay: 20, standingIn: targetArea };
    h.state.npcs[1].activity!.standingIn = originArea;
    expect(settlePrivateWork(h.state, starts)).toEqual([]);
    expect(h.state.history.facts.some(fact => fact.data.privateWorkMeeting === h.offer.id)).toBe(false);
    const arrival = h.state.npcs[1].activity!.untilDay!;
    expect(arrival).toBeGreaterThan(starts);
    expect(settlePrivateWork(h.state, arrival - 0.01)).toEqual([]);
    expect(settlePrivateWork(h.state, arrival)).toEqual([h.term.id]);
    expect(h.state.history.facts.some(fact => fact.data.privateWorkMeeting === h.offer.id)).toBe(true);
    expect(h.state.npcs[1].spiritStones).toBe(60);
});

it('an impossible return-by quote spends no fare and picks up nothing remotely', () => {
    const h = accepted({ objective: { kind: 'handover', objectId: 'cargo', recipientId: 'employer', collectAt: 'far-away' },
        dueOnDay: 5 }, state => {
        const place = makeLocation({ id: 'far-away', name: 'Distant work', kind: 'wilds' });
        linkLocations(state.locations[0], place, 'road', 100); state.locations.push(place);
        state.objects[0] = { ...state.objects[0], ownerId: null, possessorId: null, locationId: place.id };
        appendWorldFact(state, makeFact({ day: 0, kind: 'opportunity', visibility: 'secret', locationId: place.id,
            actors: [{ id: 'worker', name: 'Worker', role: 'visited' }], summary: 'The worker has been to the distant work site.' }),
            { recur: false });
    });
    const before = h.state.npcs[1].spiritStones;
    settlePrivateWork(h.state, h.state.npcs[1].activity!.sinceDay);
    expect(h.state.history.facts.some(fact => fact.data.privateWorkId === h.term.id && fact.data.publicMission)).toBe(false);
    expect(h.state.npcs[1].spiritStones).toBe(before);
    expect(h.state.objects[0].possessorId).toBeNull();
    expect(h.state.npcs[1].locationId).toBe('ground');
});

it('normal world advancement starts a private collection after preparation and carries its actual work to payment', () => {
    const h = accepted({ objective: { kind: 'handover', objectId: 'cargo', recipientId: 'employer', collectAt: 'collection' },
        dueOnDay: 100 }, state => {
        const destination = makeLocation({ id: 'collection', name: 'The actual collection site', kind: 'wilds' });
        linkLocations(state.locations[0], destination, 'road', 4); state.locations.push(destination);
        state.objects[0] = { ...state.objects[0], ownerId: null, possessorId: null, locationId: destination.id };
        appendWorldFact(state, makeFact({ day: 0, kind: 'opportunity', visibility: 'secret', locationId: destination.id,
            actors: [{ id: 'worker', name: 'Worker', role: 'visited' }], summary: 'The worker has visited the actual collection site.' }),
            { recur: false });
    });
    const starts = h.state.npcs[1].activity!.sinceDay;
    expect(h.state.npcs[1].activity!.untilDay).toBe(starts);
    advanceWorldForPlay(h.state, { days: 30, pressure: { intensity: 0 }, stopOnInterrupt: false });
    const itinerary = h.state.history.facts.find(fact => fact.data.privateWorkId === h.term.id && fact.data.publicMission)!;
    expect(itinerary).toBeDefined(); expect(itinerary.day).toBe(starts);
    expect(h.state.objects[0].possessorId).toBe('employer');
    expect(h.state.objects[0].provenance.some(entry => entry.holderId === 'worker' && entry.how === 'found')).toBe(true);
    expect(h.state.history.facts.some(fact => fact.data.privateWorkPayment === h.offer.id && fact.data.paid === true)).toBe(true);
    expect(h.state.obligations.find(word => word.id === h.term.id)!.status).toBe('settled');
});

it('normal world advancement starts and finishes an accepted private slip commission on its work dates', () => {
    const h = accepted({ objective: { kind: 'craft', named: 'A privately cut slip', recipientId: 'employer',
        ask: { named: 'A privately cut slip', grade: 'mortal', slip: 'a_strike' } }, dueOnDay: 100 }, state => {
        state.npcs[1].cultivation.realmOrdinal = refiningOrdinalFor('mortal');
    });
    const starts = h.state.npcs[1].activity!.sinceDay;
    const area = theAreasOf({ ...h.state, currentDay: Math.floor(starts), currentHour: (starts % 1) * 24 },
        h.state.locations[0]).areas.find(area => area.for !== 'room')!.id;
    h.state.npcs[0].activity = { kind: 'talking', note: 'Waiting for the commissioned work.',
        withIds: [], standingIn: area, sinceDay: 0, untilDay: 100 };
    h.state.npcs[1].activity!.standingIn = area;
    advanceWorldForPlay(h.state, { days: 30, pressure: { intensity: 0 }, stopOnInterrupt: false });
    const started = h.state.history.facts.find(fact => fact.data.privateCraftStarted === h.offer.id)!;
    expect(started).toBeDefined(); expect(started.day).toBe(starts);
    const done = h.state.history.facts.find(fact => fact.data.privateCraftResolved === h.offer.id)!;
    expect(done.day).toBe(Number(started.data.readyOnDay));
    const made = h.state.objects.find(object => object.name === 'A privately cut slip')!;
    expect(made.possessorId).toBe('employer');
    expect(h.state.history.facts.some(fact => fact.data.privateWorkPayment === h.offer.id && fact.data.paid === true)).toBe(true);
});

it('a hired guard joins the actual party and earning wages preserves its accepted journey', () => {
    const h = accepted({ objective: { kind: 'escort', personId: 'employer', days: 5 }, dueOnDay: 100 });
    const starts = h.state.npcs[1].activity!.sinceDay;
    const area = theAreasOf({ ...h.state, currentDay: Math.floor(starts), currentHour: (starts % 1) * 24 },
        h.state.locations[0]).areas.find(area => area.for !== 'room')!.id;
    h.state.npcs[0].activity = { kind: 'talking', note: 'Meeting the person guarding the journey.', withIds: [],
        standingIn: area, sinceDay: 0, untilDay: starts + 1 };
    h.state.npcs[1].activity!.standingIn = area;
    settlePrivateWork(h.state, starts);
    expect(whoIsOnTheRoadWith(h.state.npcs, 'employer', starts).map(person => person.id)).toContain('worker');
    const destination = makeLocation({ id: 'road-destination', name: 'The journey destination', kind: 'wilds' });
    linkLocations(h.state.locations[0], destination, 'road', 1); h.state.locations.push(destination);
    const mission = sendHouseMission(h.state, null, destination, h.state.npcs.slice(), 'a private journey', starts,
        { days: 10 }, undefined, undefined, undefined, undefined, h.state.npcs[0])!;
    expect(mission).toBeDefined();
    expect(h.state.npcs[1].activity?.privateWorkId).toBe(h.term.id);
    advanceWorldForPlay(h.state, { days: 30, pressure: { intensity: 0 }, stopOnInterrupt: false });
    const completion = h.state.history.facts.find(fact => fact.data.privateWorkCompleted === h.offer.id && fact.data.finished)!;
    expect(completion).toBeDefined(); expect(completion.day, JSON.stringify({ cursor: h.state.pressureCursor,
        beginnings: h.state.history.facts.filter(fact => fact.data.privateEscortStarted === h.offer.id),
        worker: h.state.npcs[1].activity })).toBe(starts + 5);
    expect(h.state.history.facts.some(fact => fact.data.privateWorkPayment === h.offer.id && fact.data.paid)).toBe(true);
    expect(h.state.npcs[1].locationId).toBe('ground');
    expect(h.state.npcs[1].activity?.capitalMissionId).toBeUndefined();
    expect(h.state.npcs[1].activity?.privateWorkId).toBeUndefined();
    expect(h.state.npcs[1].status).toBe('alive');
    expect(meritWith(h.state.npcs[1], 'any-house')).toBe(0);
});

it('collection happens on the paid itinerary at its real arrival, then the worker returns to deliver', () => {
    const h = accepted({ objective: { kind: 'handover', objectId: 'cargo', recipientId: 'employer', collectAt: 'collection' },
        dueOnDay: 100 }, state => {
        const destination = makeLocation({ id: 'collection', name: 'The collection grounds', kind: 'wilds' });
        linkLocations(state.locations[0], destination, 'road', 4); state.locations.push(destination);
        state.objects[0] = { ...state.objects[0], ownerId: null, possessorId: null, locationId: destination.id };
        appendWorldFact(state, makeFact({ day: 0, kind: 'opportunity', visibility: 'secret', locationId: destination.id,
            actors: [{ id: 'worker', name: 'Worker', role: 'visited' }], summary: 'The worker visited the collection grounds.' }),
            { recur: false });
    });
    const starts = h.state.npcs[1].activity!.sinceDay;
    settlePrivateWork(h.state, starts);
    const itinerary = h.state.history.facts.find(fact => fact.data.privateWorkId === h.term.id)!;
    expect(itinerary).toBeDefined();
    expect(h.state.objects[0].possessorId).toBeNull();
    expect(h.state.npcs[0].spiritStones).toBe(1000);
    advancePublicCapitalMission(h.state, 'worker', Number(itinerary.data.plannedReturnDay));
    expect(h.state.npcs[1].locationId).toBe('ground');
    expect(h.state.objects[0].provenance.some(entry => entry.holderId === 'worker' && entry.how === 'found')).toBe(true);
    // The worker crosses the last local area to hand the cargo to its recipient.
    settlePrivateWork(h.state, Number(itinerary.data.plannedReturnDay));
    settlePrivateWork(h.state, Number(itinerary.data.plannedReturnDay) + 0.5);
    expect(h.state.objects[0].possessorId).toBe('employer');
    expect(h.state.obligations.find(term => term.id === h.term.id)!.status).toBe('settled');
    expect(h.state.npcs[0].spiritStones).toBe(950);
});

it('a private maker uses the native materials, work duration and outcome before delivery or wages', () => {
    let successes = 0, failures = 0;
    for (let sample = 0; sample < 30; sample++) {
        const h = accepted({ objective: { kind: 'craft', named: 'A commissioned blade', recipientId: 'employer',
            ask: { named: 'A commissioned blade', grade: 'earth' } }, dueOnDay: 365 }, state => {
            state.npcs[1].cultivation.realmOrdinal = refiningOrdinalFor('earth');
            for (const [index, slot] of WHAT_AN_ARTIFACT_IS_MADE_OF.earth.entries()) {
                const material = whatWouldFill(slot)[0];
                state.objects.push(makeObject({ id: `ingredient-${index}`, name: material.name, kind: 'material',
                    possessorId: 'worker', ownerId: 'worker', locationId: 'ground', data: { materialId: material.id } }));
            }
        });
        h.state.seed = `private-commission-outcome-${sample}`;
        const starts = h.state.npcs[1].activity!.sinceDay;
        const area = theAreasOf({ ...h.state, currentDay: Math.floor(starts), currentHour: (starts % 1) * 24 },
            h.state.locations[0]).areas.find(area => area.for !== 'room')!.id;
        h.state.npcs[0].activity = { kind: 'talking', note: 'Waiting for the work.', withIds: [],
            standingIn: area, sinceDay: 0, untilDay: 400 };
        h.state.npcs[1].activity!.standingIn = area;
        settlePrivateWork(h.state, starts);
        const started = h.state.history.facts.find(fact => fact.data.privateCraftStarted === h.offer.id)!;
        expect(started).toBeDefined();
        expect(h.state.objects.filter(object => object.kind === 'material').every(object => !isRuined(object))).toBe(true);
        expect(h.state.npcs[0].spiritStones).toBe(1000);
        const end = Number(started.data.readyOnDay);
        settlePrivateWork(h.state, end - 0.01);
        expect(h.state.objects.some(object => object.name === 'A commissioned blade')).toBe(false);
        settlePrivateWork(h.state, end);
        expect(h.state.objects.filter(object => object.kind === 'material').every(isRuined)).toBe(true);
        const outcome = h.state.history.facts.find(fact => fact.data.privateCraftResolved === h.offer.id)!;
        if (outcome.data.succeeded) {
            successes++;
            expect(h.state.objects.find(object => object.name === 'A commissioned blade')!.possessorId).toBe('employer');
            expect(h.state.npcs[0].spiritStones).toBe(950);
        } else {
            failures++;
            expect(h.state.npcs[0].spiritStones).toBe(1000);
            settlePrivateWork(h.state, 365);
            expect(h.state.obligations.some(word => word.tags.includes('private-work-failed'))).toBe(true);
        }
        const count = h.state.objects.length;
        settlePrivateWork(h.state, 366);
        expect(h.state.objects.length).toBe(count);
        expect(meritWith(h.state.npcs[1], 'any-house')).toBe(0);
    }
    expect(successes).toBeGreaterThan(0); expect(failures).toBeGreaterThan(0);
});

it('a native material stack spends only the recipe units and spent rows cannot be used again', () => {
    const h = accepted();
    for (const [index, slot] of WHAT_AN_ARTIFACT_IS_MADE_OF.earth.entries()) {
        const material = whatWouldFill(slot)[0];
        h.state.objects.push(makeObject({ id: `stack-${index}`, name: material.name, kind: 'material',
            possessorId: 'worker', ownerId: 'worker', data: { materialId: material.id, quantity: 2 } }));
    }
    const take = () => takeWhatTheRecipeNames({ objects: h.state.objects, grade: 'earth',
        bench: whatThisPersonHasOnTheBench(undefined, h.state.objects, 'worker'), onDay: 1, intoWhat: 'Actual work' });
    expect(take()).not.toBeNull();
    expect(h.state.objects.filter(object => object.kind === 'material').every(object => !isRuined(object) && object.data.quantity === 1)).toBe(true);
    expect(take()).not.toBeNull();
    expect(take()).toBeNull();
});

it('the annual producer offers against a real protection goal and books actual service deadlines', () => {
    let offers = 0, acceptedJobs = 0;
    for (let sample = 0; sample < 160; sample++) {
        const h = accepted();
        h.state.seed = `private-work-annual-${sample}`;
        h.state.obligations = []; h.state.history.facts = [];
        h.state.npcs[1] = { ...h.state.npcs[1], activity: null };
        h.state.npcs[0] = addGoal(h.state.npcs[0], { kind: 'protection', priority: 1,
            text: 'Protect the actual cargo.', targetId: 'cargo' }, 0);
        const due: number[] = [];
        const started = privatePaidWorkThisYear(h.state, 0, 0.5, (_id, day) => due.push(day));
        offers += started.length;
        acceptedJobs += due.length;
        for (const deadline of due) {
            expect(deadline).toBeGreaterThan(0.5);
            settlePrivateWork(h.state, deadline);
            expect(h.state.obligations.some(term => term.tags.includes('private-paid-work') && term.status === 'settled')).toBe(true);
        }
    }
    expect(offers).toBeGreaterThan(0); expect(acceptedJobs).toBeGreaterThan(0);
});

it('the accepted word, physical activity and deferred wage survive a real database save', () => {
    const h = accepted(), untilDay = h.state.npcs[1].activity!.untilDay!;
    const db = new Database(':memory:');
    try {
        migrate(db); const repo = new WorldStateRepository(db); repo.saveWorld(h.state);
        const resumed = repo.loadWorld(h.state.id)!;
        expect(resumed.npcs[0].spiritStones).toBe(1000);
        settlePrivateWork(resumed, untilDay);
        expect(resumed.npcs[0].spiritStones).toBe(950);
        expect(resumed.npcs[1].spiritStones).toBe(60);
        expect(resumed.obligations.find(term => term.id === h.term.id)!.status).toBe('settled');
    } finally { db.close(); }
});
