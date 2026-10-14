/** One private offer and service ledger read actual SQL bodies, purses and custody. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { TechniqueGradeSchema } from '../schema/cultivation.js';
import type { PlannedAction } from './planned-action.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { transferActualSpiritStones } from './transferring-actual-spirit-stones.js';
import { privatePeopleCanSpeak } from '../engine/world/private-requests.js';
import { offerPrivateWork, acceptPrivateWork, privateWorkTerms, privateWorkOfferedOnContact,
    settlePrivateWork, type PrivateWorkBodies, type PrivateWorkTerms } from '../engine/world/private-paid-work.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { isTheWorldsToMove } from '../engine/world/npc-state.js';
import { factsWithDataValue } from '../engine/world/witness-reaction-index.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { transferPossession, isRuined } from '../engine/world/possessions.js';
import { whatThisThingIs } from '../engine/world/what-a-house-gives-merit-for.js';
import { addToPouch, removeFromPouch, pouchQuantity } from '../storage/cultivator-pouch.js';
import { writeObligations } from '../storage/repos/obligation.repo.js';
import { whatThisPersonHasOnTheBench } from './what-is-on-the-bench.js';
import { takeWhatTheRecipeNames } from './taking-the-materials-off-the-bench.js';
import { whatItIsMadeOf } from '../data/cultivation/what-an-artifact-is-made-of.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { passHours } from './routine-invitations.js';
import { HERBS, FORAGE_BASE_DAYS } from '../data/cultivation/herbs.js';
import { PILLS } from '../data/cultivation/pills.js';
import { RECIPES } from '../data/cultivation/recipes.js';
import { daysAtTheWork } from '../engine/social-leverage/commissioning-a-craft.js';
import { executionWithItsSpentSpan } from './an-execution-with-its-spent-span.js';
import { LEVERAGE_ATTEMPT_CONSTANTS } from '../engine/social-leverage/an-attempt-to-move-somebody.js';
import { startPrivateRoadProtection } from '../engine/world/a-private-road-guard-joins-the-actual-party.js';
import { bindFollowingParty } from './following-the-party-leader.js';
import { withPrivatePlayerContact } from './joining-a-private-party.js';
import { aPrivatePillPromiseNamesARealDose } from './a-private-pill-promise-names-a-real-dose.js';
import { readPrivateWordsAtTheActualBody } from './private-words-on-the-actual-ledger.js';
import { LESSER_ACTION_DAYS } from './lesser-action-costs.js';

export function privateWorkBodiesFor(game: GameService): PrivateWorkBodies {
    const person: PrivateWorkBodies['person'] = id => {
        const actual = actualPersonFor(game, id);
        if (!actual || isTheWorldsToMove(actual)) return actual;
        const native = game.atHand!.npcs.find(row => row.id === id);
        return { ...actual, activity: native?.activity?.privateWorkId || native?.activity?.capitalMissionId
            ? native.activity : actual.activity };
    };
    const payPill: NonNullable<PrivateWorkBodies['payPill']> = (id, from, to, day, factId) => {
        const world = game.atHand!, at = world.objects.findIndex(object => object.id === id);
        const object = world.objects[at], thing = object && whatThisThingIs(object);
        if (!object || object.kind !== 'pill' || !thing || isRuined(object) || object.ownerId !== from || object.possessorId !== from) return false;
        if (game.repos.cultivators.getById(from) && pouchQuantity(game.db, from, thing.kindId) < thing.quantity) return false;
        game.db.transaction(() => {
            if (game.repos.cultivators.getById(from) && !removeFromPouch(game.db, from, thing.kindId, thing.quantity)) throw new Error('The actual pill payment moved.');
            if (game.repos.cultivators.getById(to)) addToPouch(game.db, to, thing.kindId, 'pill', thing.quantity);
        })();
        world.objects[at] = transferPossession(object, { toHolderId: to, toHolderName: person(to)?.name ?? to,
            onDay: day, how: 'bought', transfersOwnership: true, factId });
        return true;
    };
    return { person, localExchangeDays: LESSER_ACTION_DAYS.request,
        canSpeak: (actor, subject, day) => {
            const sql = game.repos.cultivators.getById(actor.id) ?? game.repos.cultivators.getById(subject.id);
            if (sql) return sql.alive && game.present(sql).some(face => face.id === (sql.id === actor.id ? subject.id : actor.id));
            return privatePeopleCanSpeak(game.atHand!, actor, subject, day);
        },
        payStones: (from, to, amount) => transferActualSpiritStones(game, from, to, amount).ok,
        spendJourneyFare: (id, amount) => {
            const current = actualPersonFor(game, id);
            if (!current || current.spiritStones < amount) return false;
            if (game.repos.cultivators.getById(id)) game.repos.cultivators.applyDeltas(id, { spiritStones: -amount });
            else game.atHand!.npcs.find(person => person.id === id)!.spiritStones -= amount;
            return true;
        },
        payPill,
        deliverMaterial: (id, to, day, factId) => {
            const world = game.atHand!, at = world.objects.findIndex(object => object.id === id);
            const object = world.objects[at], thing = object && whatThisThingIs(object);
            if (!object || !thing || isRuined(object) || !object.possessorId) return false;
            const from = object.possessorId;
            if (game.repos.cultivators.getById(from) && pouchQuantity(game.db, from, thing.kindId) < thing.quantity) return false;
            game.db.transaction(() => {
                if (game.repos.cultivators.getById(from) && !removeFromPouch(game.db, from, thing.kindId, thing.quantity)) throw new Error('The actual delivery moved.');
                if (game.repos.cultivators.getById(to)) addToPouch(game.db, to, thing.kindId, object.kind === 'pill' ? 'pill' : 'herb', thing.quantity);
            })();
            world.objects[at] = transferPossession(object, { toHolderId: to, toHolderName: person(to)?.name ?? to,
                onDay: day, how: 'gifted', transfersOwnership: true, factId });
            return true;
        },
        bench: id => whatThisPersonHasOnTheBench(game.repos.cultivators.getById(id) ? game.db : undefined, game.atHand!.objects, id),
        takeMaterials: (ask, bench, day) => takeWhatTheRecipeNames({ db: game.db, objects: game.atHand!.objects,
            grade: ask.grade, bench, onDay: day, intoWhat: ask.named,
            recipe: ask.slip ? null : whatItIsMadeOf(ask.grade, ask.demonic === true) }) !== null,
        takeRecipeMaterials: (grade, recipe, bench, day, named) => takeWhatTheRecipeNames({ db: game.db,
            objects: game.atHand!.objects, grade, recipe, bench, onDay: day, intoWhat: named }) !== null };
}

export function settlePrivateWorkAtTheBody(game: GameService): string[] {
    const world = game.atHand;
    if (!world) return [];
    const body = game.state().cultivator;
    readPrivateWordsAtTheActualBody(game, body.id);
    const words = world.obligations.filter(term => term.status === 'open' && term.tags.includes('private-paid-work')
        && (term.holderId === body.id || term.subjectId === body.id));
    if (!words.length) return [];
    const before = world.history.facts.length;
    for (const word of words.filter(word => word.holderId === body.id && routineTime(world) > word.incurredOnDay)) {
        const offer = world.history.facts.find(fact => fact.id === word.triggeringEventId);
        const objective = offer && privateWorkTerms(offer)?.objective;
        if (!offer || objective?.kind !== 'find' || !game.present(body).some(person => person.id === objective.personId)
            || factsWithDataValue(world, 'privateWorkMeeting', offer.id).length) continue;
        const target = actualPersonFor(game, objective.personId)!;
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'gathering', visibility: 'secret',
            locationId: game.worldPlaceOf(body), causes: [offer.id], witnessIds: [body.id, target.id],
            actors: [{ id: body.id, name: body.name, role: 'finder' }, { id: target.id, name: target.name, role: 'found' }],
            summary: `${body.name} found ${target.name} in person.`, data: { privateWorkMeeting: offer.id } }), { recur: false, bystanders: false });
    }
    settlePrivateWork(world, routineTime(world), privateWorkBodiesFor(game), new Set([body.id]));
    writeObligations(game.db, world.obligations.filter(term => term.holderId === body.id || term.subjectId === body.id));
    game.theWorldMoved();
    return world.history.facts.slice(before).filter(fact => fact.data.privateWorkPayment || fact.data.privateWorkCompleted)
        .map(fact => fact.summary);
}

/** An explicit delivery moves the actual job's goods through the existing custody writer. */
function deliverPrivateWork(game: GameService, run: Run, body: Cultivator, raw: string) {
    const world = game.atHand!;
    if (!/\b(?:give|deliver|hand over|bring)\b/i.test(raw)) return null;
    const bodies = privateWorkBodiesFor(game);
    for (const word of world.obligations.filter(word => word.status === 'open' && word.holderId === body.id
        && word.tags.includes('private-paid-work') && (word.dueOnDay ?? Infinity) >= routineTime(world))) {
        const offer = world.history.facts.find(fact => fact.id === word.triggeringEventId);
        const terms = offer && privateWorkTerms(offer), objective = terms?.objective;
        if (!offer || !objective || !('recipientId' in objective)) continue;
        const recipient = bodies.person(objective.recipientId);
        if (!recipient || !raw.toLowerCase().includes(recipient.name.toLowerCase())) continue;
        const object = world.objects.find(object => object.possessorId === body.id && !isRuined(object)
            && raw.toLowerCase().includes(object.name.toLowerCase())
            && (objective.kind === 'handover' ? object.id === objective.objectId
                : objective.kind === 'gather' ? object.data.privateGather === offer.id
                    : objective.kind === 'refine' ? object.data.privateRefinement === offer.id
                        : objective.kind === 'craft' && object.name === objective.named));
        if (!object) continue;
        if (!bodies.canSpeak(bodies.person(body.id)!, recipient, routineTime(world))
            || objective.kind === 'handover' && objective.deliverAt && game.worldPlaceOf(body) !== objective.deliverAt)
            return refused('world.privateDelivery', 'give', factsForRefusal('The private delivery is out of reach.',
                'Reach the actual recipient at the agreed delivery ground. Nothing moved.'));
        const thing = whatThisThingIs(object);
        const moved = thing && (object.kind === 'material' || object.kind === 'pill')
            ? bodies.deliverMaterial!(object.id, recipient.id, routineTime(world), offer.id)
            : object.ownerId === body.id || objective.kind === 'handover' && object.ownerId === word.subjectId;
        if (!moved) return refused('world.privateDelivery', 'give', factsForRefusal('The private goods could not be delivered.',
            'The actual custody and counted stock must still support this delivery. Nothing moved.'));
        if (!thing || object.kind !== 'material' && object.kind !== 'pill') {
            const at = world.objects.findIndex(row => row.id === object.id);
            world.objects[at] = transferPossession(object, { toHolderId: recipient.id, toHolderName: recipient.name,
                onDay: routineTime(world), how: 'gifted', transfersOwnership: true, factId: offer.id });
        }
        game.theWorldMoved();
        return game.freeAction(run, 'give', factsForToolResult('The private goods were delivered.',
            [`You delivered ${object.name} to ${recipient.name}. The private word reads that actual delivery.`]));
    }
    return null;
}

export function privateBusinessBoundaryDates(game: GameService): number[] {
    const world = game.atHand;
    if (!world) return [];
    const body = game.state().cultivator, dates: number[] = [];
    for (const offer of factsWithDataValue(world, 'privatePartyInvitation', true)) {
        if (offer.actors.some(actor => actor.id === body.id && actor.role === 'asked')
            && !world.history.facts.some(reply => reply.data.privatePartyReply === offer.id || reply.data.privatePartyDeparture === offer.id)
            && typeof offer.data.respondByDay === 'number') dates.push(offer.data.respondByDay);
    }
    for (const term of world.obligations) {
        if (term.status !== 'open' || !term.tags.includes('private-paid-work')
            || term.holderId !== body.id && term.subjectId !== body.id) continue;
        if (term.dueOnDay != null) dates.push(term.dueOnDay);
        const offer = world.history.facts.find(fact => fact.id === term.triggeringEventId);
        const terms = offer && privateWorkTerms(offer);
        const worker = world.npcs.find(person => person.id === term.holderId);
        if (terms?.objective.kind === 'watch' && worker?.activity?.privateWorkId === term.id)
            dates.push(worker.activity.sinceDay + terms.objective.days);
    }
    return dates;
}

export function privateWorkOffersAtTheBody(game: GameService, body: Cultivator): string[] {
    const world = game.atHand;
    if (!world || !body.alive) return [];
    const employers = game.present(body).map(face => actualPersonFor(game, face.id)).filter((person): person is NonNullable<typeof person> => !!person);
    const offers = privateWorkOfferedOnContact(world, body.id, routineTime(world), privateWorkBodiesFor(game), employers);
    if (offers.length) game.theWorldMoved();
    return factsWithDataValue(world, 'privateWorkOffer', true).filter(offer => offer.actors.some(actor => actor.id === body.id && actor.role === 'asked')
        && !world.obligations.some(word => word.triggeringEventId === offer.id && word.tags.includes('private-paid-work'))
        && !world.history.facts.some(reply => reply.data.privateWorkDeclined === offer.id)
        && (privateWorkTerms(offer)?.dueOnDay ?? 0) > routineTime(world)
        && game.present(body).some(face => offer.actors.some(actor => actor.id === face.id && actor.role === 'offered')))
        .map(offer => {
            const speaker = offer.actors.find(actor => actor.role === 'offered')!;
            game.theyGaveTheirName(body, game.currentRun().run, speaker);
            const terms = privateWorkTerms(offer)!;
            const payment = terms.payment;
            const wage = payment.kind === 'stones' ? `${payment.amount} spirit stones`
                : payment.kind === 'favor' ? `a ${payment.severity} favour`
                    : world.objects.find(object => object.id === payment.objectId)?.name ?? 'the actual pill';
            return `${offer.summary} The payment is ${wage}, due on completion; the deadline is in ${terms.dueOnDay - routineTime(world)} days. Do you accept the private paid work?`;
        });
}

/** Structured calls and sentence calls enter the same native offer. */
export function offerPrivateWorkFromThePlayer(game: GameService, body: Cultivator, workerId: string, terms: PrivateWorkTerms) {
    if (!game.atHand || !body.alive) return null;
    readPrivateWordsAtTheActualBody(game, body.id);
    const offer = offerPrivateWork(game.atHand, body.id, workerId, terms, routineTime(game.atHand), privateWorkBodiesFor(game));
    if (offer) {
        writeObligations(game.db, game.atHand.obligations.filter(word => word.subjectId === body.id || word.holderId === body.id));
        game.theWorldMoved();
    }
    return offer;
}

export async function privateWorkWithAPerson(game: GameService, run: Run, body: Cultivator,
    action: PlannedAction, raw: string) {
    const world = game.atHand;
    if (!world || !body.alive) return null;
    const delivered = deliverPrivateWork(game, run, body, raw);
    if (delivered) return delivered;
    const reply = /\b(?:accept|agree|decline|refuse)\b/i.test(raw) && /\b(?:private|paid) (?:work|job)\b/i.test(raw);
    if (reply) {
        const offers = factsWithDataValue(world, 'privateWorkOffer', true).filter(offer => offer.actors.some(actor => actor.id === body.id && actor.role === 'asked')
            && !world.obligations.some(term => term.triggeringEventId === offer.id && term.tags.includes('private-paid-work'))
            && !world.history.facts.some(reply => reply.data.privateWorkDeclined === offer.id));
        const named = action.target && game.somebodyAtHand(action.target, body);
        const offer = offers.find(offer => named ? offer.actors.some(actor => actor.id === named.id && actor.role === 'offered') : offers.length === 1);
        if (!offer) return refused('world.privatePaidWork', 'request', factsForRefusal('No private work was accepted.', 'Name one actual open offer from somebody you can reach. Nothing spent.'));
        if (/\b(?:decline|refuse)\b/i.test(raw)) {
            appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
                locationId: game.worldPlaceOf(body), actors: [{ id: body.id, name: body.name, role: 'answered' }],
                causes: [offer.id], summary: `${body.name} declined the private paid work.`, data: { privateWorkDeclined: offer.id } }), { recur: false, bystanders: false });
            game.theWorldMoved();
            return game.freeAction(run, 'request', factsForToolResult('Private work declined.', ['You declined the private paid work. No word or wage was written.']));
        }
        const term = acceptPrivateWork(world, offer.id, body.id, routineTime(world), privateWorkBodiesFor(game));
        if (!term) return refused('world.privatePaidWork', 'request', factsForRefusal('No private work was accepted.', 'Its real payer, wage, ground or deadline is no longer available. Nothing spent.'));
        const terms = privateWorkTerms(offer)!;
        const at = world.npcs.findIndex(person => person.id === body.id);
        world.npcs[at] = { ...world.npcs[at], locationId: null, activity: { kind: terms.objective.kind === 'watch' ? 'stationed' : 'their_own_business',
            standingIn: body.standingIn, note: terms.description, withIds: [], sinceDay: routineTime(world), untilDay: terms.dueOnDay, privateWorkId: term.id } };
        writeObligations(game.db, [term]);
        if (terms.objective.kind === 'escort') {
            const started = withPrivatePlayerContact(game, body, () => startPrivateRoadProtection(world, offer, term,
                terms, routineTime(world), privateWorkBodiesFor(game)));
            if (typeof started?.data.itineraryFactId === 'string') {
                world.npcs[at] = { ...world.npcs[at], locationId: null };
                const binding = bindFollowingParty(game, run, body, terms.objective.personId, started.data.itineraryFactId);
                if (!binding.ok) throw new Error(binding.reason);
            }
        }
        game.theWorldMoved();
        return game.freeAction(run, 'request', factsForToolResult('Private work accepted.', ['You accepted the private paid work.', terms.description,
            'Payment is owed on completion. This is no house duty and earns no merit or contribution.']));
    }
    const pitch = /\b(?:offer|pay|hire|commission)\b/i.test(raw) && /\b(?:stones?|pill|favou?r)\b/i.test(raw);
    if (!pitch) return null;
    const named = (action.target && game.somebodyAtHand(action.target, body))
        || game.present(body).find(person => raw.toLowerCase().includes(person.name.toLowerCase()));
    const worker = named && actualPersonFor(game, named.id);
    if (!worker) return null;
    const stones = /(-?\d+(?:\.\d+)?)\s+(?:spirit\s+)?stones?\b/i.exec(raw);
    const days = /\bfor\s+(\d+(?:\.\d+)?)\s+days?\b/i.exec(raw);
    const deadline = /\bwithin\s+(\d+(?:\.\d+)?)\s+days?\b/i.exec(raw);
    const promisedPill = PILLS.find(pill => raw.toLowerCase().includes(pill.name.toLowerCase()));
    const pill = !stones && promisedPill ? aPrivatePillPromiseNamesARealDose(game, body, promisedPill.id) : null;
    const payment: PrivateWorkTerms['payment'] | null = stones ? { kind: 'stones', amount: Number(stones[1]) }
        : /\bfavou?r\b/i.test(raw) ? { kind: 'favor', severity: 'serious' }
            : pill ? { kind: 'pill', objectId: pill.id } : null;
    if (!payment) return null;
    let duration = days ? Number(days[1]) : 0;
    const placeId = game.worldPlaceOf(body);
    if (!placeId) return null;
    let objective: PrivateWorkTerms['objective'];
    const herb = /\b(?:gather|collect|forage)\b/i.test(raw) ? HERBS.find(herb => raw.toLowerCase().includes(herb.name.toLowerCase())) : null;
    const wantedPill = /\brefine\b/i.test(raw) ? PILLS.find(pill => raw.toLowerCase().includes(pill.name.toLowerCase())) : null;
    const destination = world.locations.find(place => place.id !== placeId && raw.toLowerCase().includes(place.name.toLowerCase()));
    const protectedPerson = /\b(?:guard|protect|escort)\b/i.test(raw) ? world.npcs.find(person => person.id !== worker.id
        && (person.id === body.id && /\b(?:guard|protect|escort)\s+(?:me|my cargo|my goods)\b/i.test(raw)
            || person.id !== body.id && raw.toLowerCase().includes(person.name.toLowerCase()))) : null;
    const cargo = /\b(?:cargo|goods)\b/i.test(raw) && protectedPerson ? world.objects.find(object => object.possessorId === protectedPerson.id
        && raw.toLowerCase().includes(object.name.toLowerCase())) : null;
    if (herb) {
        const prefix = raw.slice(0, raw.toLowerCase().indexOf(herb.name.toLowerCase()));
        const quantity = Number(/(\d+)\s*$/.exec(prefix)?.[1] ?? 1);
        objective = { kind: 'gather', herbId: herb.id, quantity, locationId: destination?.id ?? placeId, recipientId: body.id };
        duration = FORAGE_BASE_DAYS * quantity;
    } else if (wantedPill) {
        const recipe = RECIPES.find(recipe => recipe.producesPillId === wantedPill.id);
        if (!recipe) return null;
        objective = { kind: 'refine', recipeId: recipe.id, recipientId: body.id };
        duration = daysAtTheWork(wantedPill.grade, worker.cultivation.realmOrdinal);
    } else if (/\b(?:make|craft|forge|commission)\b/i.test(raw)) {
        const readGrade = TechniqueGradeSchema.safeParse(/\b([a-z]+)(?:-|\s+)grade\b/i.exec(raw)?.[1].toLowerCase());
        const grade = readGrade.success ? readGrade.data : undefined;
        const named = /\b(?:make|craft|forge)\s+(.+?)(?=\s+(?:within|for\s+\d|by)\b|$)/i.exec(raw)?.[1].trim();
        if (!grade || !named) return null;
        objective = { kind: 'craft', named, recipientId: body.id, ask: { named, grade, demonic: /\bdemonic\b/i.test(raw) } };
        duration = daysAtTheWork(grade, worker.cultivation.realmOrdinal);
    } else if (protectedPerson && destination && duration > 0) objective = { kind: 'escort', personId: protectedPerson.id,
        destinationId: destination.id, days: duration, ...(cargo ? { cargoId: cargo.id } : {}) };
    else if (/\b(?:guard|watch|protect)\b/i.test(raw) && duration > 0) objective = { kind: 'watch', locationId: placeId, days: duration };
    else if (/\b(?:find|locate)\b/i.test(raw)) {
        const target = world.npcs.find(person => person.id !== worker.id && person.id !== body.id && raw.toLowerCase().includes(person.name.toLowerCase()));
        if (!target || !deadline) return null;
        objective = { kind: 'find', personId: target.id, ...(destination ? { searchAt: destination.id } : {}) };
    } else if (/\b(?:deliver|carry|bring)\b/i.test(raw)) {
        const object = world.objects.find(object => object.ownerId === body.id && object.possessorId === body.id && raw.toLowerCase().includes(object.name.toLowerCase()));
        if (!object || !deadline) return null;
        const recipient = world.npcs.find(person => person.id !== worker.id && person.id !== body.id
            && raw.toLowerCase().includes(person.name.toLowerCase()));
        if (!recipient) return null;
        objective = { kind: 'handover', objectId: object.id, recipientId: recipient.id, collectAt: placeId, deliverAt: destination?.id };
    }
    else return null;
    const offer = offerPrivateWorkFromThePlayer(game, body, worker.id, { objective,
        payment, dueOnDay: routineTime(world) + (deadline ? Number(deadline[1]) : duration + LEVERAGE_ATTEMPT_CONSTANTS.ASK_DAYS.a_real_favour),
        description: raw });
    if (!offer) return refused('world.privatePaidWork', 'request', factsForRefusal('No private offer was made.', 'The actual people, purse, access and deadline cannot support those terms. Nothing spent.'));
    const answer = factsWithDataValue(world, 'privateWorkAnswer', offer.id)[0];
    const spent = await passHours(game, run, body, Number(answer?.data.attentionDays ?? 0) * 24);
    if (!spent.finished) return spent.spent;
    const accepted = world.obligations.some(term => term.triggeringEventId === offer.id && term.tags.includes('private-paid-work'));
    const done = game.freeAction(game.currentRun().run, 'request', factsForToolResult('A private paid offer was made.', [
        `${worker.name} ${accepted ? 'accepted' : 'did not accept'} the private work. No wage was paid in advance.` ]), !spent.spent);
    return spent.spent ? executionWithItsSpentSpan(spent.spent, done, done) : done;
}
