/** Direct work shares one offer, one accepted word and the ordinary payment/grudge ledger. */
import { forStream } from '../cultivation/rng.js';
import { attemptWasAccepted, resolveAttempt, LEVERAGE_ATTEMPT_CONSTANTS } from '../social-leverage/an-attempt-to-move-somebody.js';
import { createObligation, settleObligation, type ObligationRecord, type Severity } from '../social/grudges.js';
import { privatePartyOf, privatePeopleCanSpeak } from './private-requests.js';
import { freeForPrivateBusiness } from './private-ventures.js';
import { isTheWorldsToMove, upsertRelationship, type NpcRecord } from './npc-state.js';
import { isRuined, transferPossession } from './possessions.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { witnessIndexFor, factsWithDataValue } from './witness-reaction-index.js';
import type { WorldState } from './world-state.js';
import { drawBackgroundIncidents, isPlayerInvolved } from './background-incident-draw.js';
import { woundsCarriedBy } from './npc-state.js';
import { untreatedInjuryCount } from '../cultivation/injuries.js';
import { earningsPerYear } from '../cultivation/origin.js';
import { ORDINARY_DUTY_DAYS } from '../encounters/duties.js';
import { whatTheyWouldDoItFor } from '../encounters/passing-a-duty-down-to-somebody-else.js';
import { doingPrivateWork, servePrivateWork } from './private-work-is-served.js';
import type { WhatYouAskedThemToMake } from '../social-leverage/commissioning-a-craft.js';
import type { AUnitOnTheBench } from './what-is-on-the-bench.js';
import { routineLocationOf } from './npc-routines.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { getHerb } from '../../data/cultivation/herbs.js';
import { getRecipe } from '../../data/cultivation/recipes.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import type { Recipe as BenchRecipe } from '../../data/cultivation/what-an-artifact-is-made-of.js';
import { actualBodiesArrivedTogether } from './a-body-that-actually-arrived.js';

export type PrivateWorkPayment = { kind: 'stones'; amount: number }
    | { kind: 'pill'; objectId: string } | { kind: 'favor'; severity: Severity };
export type PrivateWorkObjective = { kind: 'watch'; locationId: string; days: number; protectedId?: string }
    | { kind: 'escort'; personId: string; days: number; destinationId?: string; cargoId?: string }
    | { kind: 'handover'; objectId: string; recipientId: string; collectAt?: string; deliverAt?: string }
    | { kind: 'find'; personId: string; searchAt?: string }
    | { kind: 'gather'; herbId: string; quantity: number; locationId: string; recipientId: string }
    | { kind: 'refine'; recipeId: string; recipientId: string }
    | { kind: 'craft'; named: string; recipientId: string; ask?: WhatYouAskedThemToMake };
export interface PrivateWorkTerms {
    objective: PrivateWorkObjective;
    payment: PrivateWorkPayment;
    dueOnDay: number;
    description: string;
}

/** The web supplies reads/writes of its SQL body; a world mirror cannot pay or move it. */
export interface PrivateWorkBodies {
    words?: import('./private-requests.js').PrivateRequestLedger;
    localExchangeDays?: number;
    person(id: string): NpcRecord | undefined;
    canSpeak(actor: NpcRecord, subject: NpcRecord, day: number): boolean;
    payStones(fromId: string, toId: string, amount: number): boolean;
    payPill?(objectId: string, fromId: string, toId: string, day: number, factId: string): boolean;
    deliverMaterial?(objectId: string, toId: string, day: number, factId: string): boolean;
    bench?(personId: string): AUnitOnTheBench[];
    takeMaterials?(ask: WhatYouAskedThemToMake, bench: readonly AUnitOnTheBench[], day: number): boolean;
    takeRecipeMaterials?(grade: TechniqueGrade, recipe: BenchRecipe, bench: readonly AUnitOnTheBench[], day: number, named: string): boolean;
    spendJourneyFare?(sponsorId: string, amount: number): boolean;
}

/** A real wound or an open protection goal supplies the employer's need. */
function protectionWanted(state: WorldState, employer: NpcRecord): string | null {
    const goal = employer.goals.find(goal => goal.status === 'active' && goal.kind === 'protection'
        && goal.targetId && protectedOnTheGround(state, goal.targetId, employer.locationId ?? ''));
    if (goal?.targetId) return goal.targetId;
    return untreatedInjuryCount(woundsCarriedBy(employer)) > 0 ? employer.id : null;
}

function offerWantedPrivateWatch(state: WorldState, employer: NpcRecord, worker: NpcRecord, day: number,
    bodies?: PrivateWorkBodies): HistoricalFact | null {
    const protectedId = protectionWanted(state, employer);
    if (!protectedId || !employer.locationId) return null;
    const days = ORDINARY_DUTY_DAYS;
    const quote = whatTheyWouldDoItFor({ days, contribution: 0,
        stones: Math.max(1, Math.round(earningsPerYear(worker.cultivation.realmOrdinal) * days / 365)),
        pitchOrdinal: employer.cultivation.realmOrdinal }, { id: worker.id,
        ordinal: worker.cultivation.realmOrdinal, spiritStones: worker.spiritStones });
    return offerPrivateWork(state, employer.id, worker.id, { objective: { kind: 'watch',
        locationId: employer.locationId, days, protectedId }, payment: { kind: 'stones', amount: quote.askStones },
        dueOnDay: day + days + LEVERAGE_ATTEMPT_CONSTANTS.ASK_DAYS.a_real_favour,
        description: `Keep a private watch for ${employer.name} for ${days} days.` }, day, bodies);
}

/** A met person resolves their yearly wish exactly, and asks this actual body. Silence is no acceptance. */
export function privateWorkOfferedOnContact(state: WorldState, workerId: string, day: number,
    bodies: PrivateWorkBodies, reachableEmployers: readonly NpcRecord[] = state.npcs): HistoricalFact[] {
    const worker = bodies.person(workerId), year = Math.floor(day / 365);
    if (!worker || worker.status !== 'alive' || state.obligations.some(word => word.status === 'open'
        && word.holderId === workerId && word.tags.includes('private-paid-work'))) return [];
    const index = witnessIndexFor(state), offered: HistoricalFact[] = [];
    for (const employer of reachableEmployers) {
        if (!isTheWorldsToMove(employer) || employer.status !== 'alive' || employer.id === workerId
            || protectionWanted(state, employer) === null || !bodies.canSpeak(employer, worker, day)
            || (index.factsByPerson.get(employer.id) ?? []).some(fact => fact.year === year && fact.data.privateWorkOffer === true)
            || !forStream(state.seed, 'private-work-exact', employer.id, year).chance(0.1)) continue;
        const offer = offerWantedPrivateWatch(state, employer, worker, day, bodies);
        if (offer) offered.push(offer);
    }
    return offered;
}

/** Background people offer at rates. The selected pair still needs actual reach and consent. */
export function privatePaidWorkThisYear(state: WorldState, year: number, day: number,
    onDue?: (workerId: string, day: number) => void): string[] {
    const index = witnessIndexFor(state);
    const pool = state.npcs.filter(person => person.status === 'alive' && isTheWorldsToMove(person)
        && person.locationId && protectionWanted(state, person) !== null
        && !(index.factsByPerson.get(person.id) ?? []).some(fact => fact.year === year && fact.data.privateWorkOffer === true));
    const chosen = [...pool.filter(person => isPlayerInvolved(state, person)
        && forStream(state.seed, 'private-work-exact', person.id, year).chance(0.1)),
        ...drawBackgroundIncidents(pool.filter(person => !isPlayerInvolved(state, person)).map(value => ({ value, rate: 0.1 })),
            forStream(state.seed, 'private-work-background', year), 4)];
    const offered: string[] = [];
    for (const employer of chosen) {
        const workers = state.npcs.filter(person => person.id !== employer.id && freeForPrivateBusiness(person, day)
            && privatePeopleCanSpeak(state, employer, person, day));
        if (!workers.length) continue;
        const rogues = workers.filter(person => person.factionId === null);
        const worker = forStream(state.seed, 'private-work-taker', employer.id, year).pick(rogues.length ? rogues : workers);
        const offer = offerWantedPrivateWatch(state, employer, worker, day);
        if (!offer) continue;
        offered.push(offer.id);
        const current = state.npcs.find(person => person.id === worker.id)!;
        if (current.activity?.privateWorkId && current.activity.untilDay != null) onDue?.(worker.id, current.activity.untilDay);
    }
    return offered;
}

function personIn(state: WorldState, id: string, bodies?: PrivateWorkBodies): NpcRecord | undefined {
    return bodies?.person(id) ?? state.npcs.find(person => person.id === id && isTheWorldsToMove(person));
}

function paymentAvailable(state: WorldState, employer: NpcRecord, payment: PrivateWorkPayment): boolean {
    if (payment.kind === 'stones') return Number.isSafeInteger(payment.amount) && payment.amount > 0 && employer.spiritStones >= payment.amount;
    if (payment.kind === 'favor') return ['slight', 'serious', 'grave', 'unforgivable'].includes(payment.severity);
    return state.objects.some(object => object.id === payment.objectId && object.kind === 'pill'
        && !isRuined(object) && object.ownerId === employer.id && object.possessorId === employer.id);
}

/** Human takers receive an unanswered offer. Only an explicit later acceptance binds them. */
export function offerPrivateWork(state: WorldState, employerId: string, workerId: string, terms: PrivateWorkTerms,
    day: number, bodies?: PrivateWorkBodies): HistoricalFact | null {
    const employer = personIn(state, employerId, bodies), worker = bodies?.person(workerId)
        ?? state.npcs.find(person => person.id === workerId);
    if (!employer || !worker || employer.status !== 'alive' || worker.status !== 'alive'
        || employer.id === worker.id || !Number.isFinite(terms.dueOnDay) || terms.dueOnDay <= day
        || worker.cultivation.lifespanEndsOnDay <= terms.dueOnDay || !terms.description.trim()
        || !paymentAvailable(state, employer, terms.payment)
        || !(bodies?.canSpeak(employer, worker, day) ?? privatePeopleCanSpeak(state, employer, worker, day))) return null;
    const objective = terms.objective;
    if (objective.kind === 'watch' && (!Number.isFinite(objective.days) || objective.days <= 0
        || day + objective.days > terms.dueOnDay || !state.locations.some(place => place.id === objective.locationId))) return null;
    if (objective.kind === 'escort' && (!Number.isFinite(objective.days) || objective.days <= 0
        || objective.personId === worker.id || personIn(state, objective.personId, bodies)?.status !== 'alive'
        || day + objective.days > terms.dueOnDay)) return null;
    if (objective.kind === 'escort' && (objective.destinationId && !state.locations.some(place => place.id === objective.destinationId)
        || objective.cargoId && !state.objects.some(object => object.id === objective.cargoId && !isRuined(object)
            && object.possessorId === objective.personId))) return null;
    if (objective.kind === 'handover' && (!state.objects.some(object => object.id === objective.objectId && !isRuined(object))
        || !personIn(state, objective.recipientId, bodies))) return null;
    if (objective.kind === 'find' && personIn(state, objective.personId, bodies)?.status !== 'alive') return null;
    if (objective.kind === 'find' && [employer.id, worker.id].includes(objective.personId)) return null;
    if (objective.kind === 'gather' && (!getHerb(objective.herbId) || !Number.isSafeInteger(objective.quantity)
        || objective.quantity <= 0 || !state.locations.some(place => place.id === objective.locationId)
        || !personIn(state, objective.recipientId, bodies))) return null;
    if (objective.kind === 'watch' && objective.protectedId && !protectedOnTheGround(state, objective.protectedId, objective.locationId)) return null;
    if (objective.kind === 'refine' && (!getRecipe(objective.recipeId) || !personIn(state, objective.recipientId, bodies))) return null;
    const offer = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: employer.locationId,
        actors: [{ id: employer.id, name: employer.name, role: 'offered' }, { id: worker.id, name: worker.name, role: 'asked' }],
        summary: `${employer.name} offered ${worker.name} private paid work: ${terms.description}`,
        data: { privateWorkOffer: true, privateWorkTerms: JSON.stringify(terms) } }), { recur: false, bystanders: false });
    if (isTheWorldsToMove(worker) && freeForPrivateBusiness(worker, day)) {
        const tie = worker.relationships.find(row => row.targetId === employer.id);
        // Coin is promised on completion. The pure decision prices that promise;
        // its immediate-spend result is replaced by the explicit deferred term.
        const decision = resolveAttempt({ actor: privatePartyOf(state, employer), subject: privatePartyOf(state, worker),
            ask: 'a_real_favour', onDay: day, ledger: bodies?.words?.read() ?? state.obligations,
            approach: { leverage: terms.payment.kind === 'stones' ? 'coin' : 'favour', audience: 'alone' },
            stonesOffered: terms.payment.kind === 'stones' ? terms.payment.amount : 0,
            theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
            rng: forStream(state.seed, 'private-work-answer', offer.id, employer.id, worker.id) });
        const attentionDays = bodies?.localExchangeDays ?? decision.days;
        const answer = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: employer.locationId,
            actors: [{ id: worker.id, name: worker.name, role: 'answered' }], causes: [offer.id], summary: decision.line,
            data: { privateWorkAnswer: offer.id, accepted: attemptWasAccepted(decision.outcome), attentionDays } }),
            { recur: false, bystanders: false });
        // The paid word replaces the kindness claim, but a counter or refusal
        // remains the ordinary person's actual account of the approach.
        for (const input of [decision.marks.counterObligation,
            decision.marks.obligation?.kind === 'grudge' ? decision.marks.obligation : null])
            if (input) {
                const word = createObligation({ ...input, triggeringEventId: answer.id });
                if (bodies?.words) bodies.words.write(word);
                else state.obligations.push(word);
            }
        if (decision.marks.tie) for (const [who, other, move] of [
            [employer, worker, decision.marks.tie.yours], [worker, employer, decision.marks.tie.theirs]
        ] as const) {
            const at = state.npcs.findIndex(person => person.id === who.id);
            if (at >= 0 && isTheWorldsToMove(who)) state.npcs[at] = upsertRelationship(state.npcs[at]!, {
                targetId: other.id, targetName: other.name,
                kind: who.relationships.find(row => row.targetId === other.id)?.kind ?? 'acquaintance',
                standing: move.strength, factIds: [answer.id] }, day);
        }
        if (attemptWasAccepted(decision.outcome)) acceptPrivateWork(state, offer.id, worker.id, day, bodies, attentionDays);
    }
    return offer;
}

export function privateWorkTerms(offer: HistoricalFact): PrivateWorkTerms | null {
    return offer.data.privateWorkOffer === true && typeof offer.data.privateWorkTerms === 'string'
        ? JSON.parse(offer.data.privateWorkTerms) as PrivateWorkTerms : null;
}

/** Called for a sampled NPC yes or the player's explicit yes, never for silence. */
export function acceptPrivateWork(state: WorldState, offerId: string, workerId: string, day: number,
    bodies?: PrivateWorkBodies, preparationDays = 0): ObligationRecord | null {
    const offer = witnessIndexFor(state).byId.get(offerId), worker = personIn(state, workerId, bodies);
    const employer = offer && personIn(state, offer.actors.find(actor => actor.role === 'offered')?.id ?? '', bodies);
    const terms = offer ? privateWorkTerms(offer) : null;
    if (!offer || !terms || !worker || !employer || worker.status !== 'alive' || employer.status !== 'alive'
        || offer.day > day || terms.dueOnDay <= day
        || !offer.actors.some(actor => actor.id === workerId && actor.role === 'asked')
        || state.obligations.some(term => term.triggeringEventId === offerId && term.tags.includes('private-paid-work'))
        || !paymentAvailable(state, employer, terms.payment)
        || !(bodies?.canSpeak(employer, worker, day) ?? privatePeopleCanSpeak(state, employer, worker, day))
        || isTheWorldsToMove(worker) && !freeForPrivateBusiness(worker, day)) return null;
    if (terms.objective.kind === 'watch' && (worker.locationId !== terms.objective.locationId
        || day + preparationDays + terms.objective.days > terms.dueOnDay)) return null;
    const term = createObligation({ kind: 'oath', holderId: worker.id, subjectId: employer.id, cause: 'service_term',
        severity: 'serious', onDay: day, triggeringEventId: offer.id, tags: ['private-paid-work'],
        dueOnDay: terms.dueOnDay, terms: terms.description, description: `${worker.name} accepted ${employer.name}'s private work.` });
    state.obligations.push(term);
    if (isTheWorldsToMove(worker)) {
        const at = state.npcs.findIndex(person => person.id === workerId);
        const place = state.locations.find(place => place.id === worker.locationId);
        const clock = { ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 };
        const area = worker.activity?.standingIn ?? (!isTheWorldsToMove(employer) ? employer.activity?.standingIn : null)
            ?? (place ? theAreasOf(clock, place).whereIs.get(worker.id) : null);
        state.npcs[at] = { ...worker, activity: { kind: terms.objective.kind === 'watch' ? 'stationed' : 'their_own_business',
            standingIn: area, note: terms.description, withIds: [], sinceDay: day + preparationDays, untilDay: terms.objective.kind === 'watch'
                ? day + preparationDays + terms.objective.days : day + preparationDays, privateWorkId: term.id } };
    }
    return term;
}

function workHasBeenDone(state: WorldState, offer: HistoricalFact, terms: PrivateWorkTerms,
    term: ObligationRecord, worker: NpcRecord, day: number, bodies?: PrivateWorkBodies): boolean {
    const objective = terms.objective;
    if (worker.activity?.privateWorkId === term.id && day < worker.activity.sinceDay) return false;
    if (objective.kind === 'watch') return worker.status === 'alive' && worker.locationId === objective.locationId
        && worker.activity?.privateWorkId === term.id && worker.activity.kind === 'stationed'
        && day >= worker.activity.sinceDay + objective.days && (!objective.protectedId
            || protectedOnTheGround(state, objective.protectedId, objective.locationId));
    if (objective.kind === 'escort') {
        const begun = factsWithDataValue(state, 'privateEscortStarted', offer.id)[0];
        const protectedPerson = personIn(state, objective.personId, bodies);
        if (objective.destinationId && begun) {
            const arrivedTogether = protectedPerson && actualBodiesArrivedTogether(state, [worker, protectedPerson].map(person => ({
                id: person.id, name: person.name, alive: person.status === 'alive', locationId: person.locationId })), objective.destinationId, begun.day);
            return protectedPerson?.status === 'alive' && worker.status === 'alive'
                && protectedPerson.locationId === objective.destinationId && worker.locationId === objective.destinationId
                && (arrivedTogether || begun.data.itineraryFactId == null && day >= Number(begun.data.endsOnDay))
                && (!objective.cargoId || state.objects.some(object => object.id === objective.cargoId && !isRuined(object)
                    && object.possessorId === objective.personId));
        }
        const clock = { ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 };
        return !!begun && protectedPerson?.status === 'alive' && worker.status === 'alive'
            && day >= Number(begun.data.endsOnDay) && doingPrivateWork(state, worker, term.id)
            && routineLocationOf(clock, worker) !== null
            && routineLocationOf(clock, worker) === routineLocationOf(clock, protectedPerson);
    }
    if (objective.kind === 'find') return state.history.facts.some(fact => fact.id !== offer.id && fact.day > term.incurredOnDay && fact.day <= day
        && fact.actors.some(actor => actor.id === worker.id) && fact.actors.some(actor => actor.id === objective.personId)
        && fact.witnessIds.includes(worker.id) && fact.witnessIds.includes(objective.personId));
    if (objective.kind === 'gather') return state.objects.some(object => !isRuined(object)
        && object.data.privateGather === offer.id && object.data.materialId === objective.herbId
        && Number(object.data.quantity) >= objective.quantity && object.ownerId === objective.recipientId
        && object.possessorId === objective.recipientId && object.provenance.some(entry => entry.previousHolderId === worker.id
            && entry.holderId === objective.recipientId && entry.onDay >= term.incurredOnDay));
    if (objective.kind === 'refine') return state.objects.some(object => !isRuined(object)
        && object.data.privateRefinement === offer.id && object.data.pillId === getRecipe(objective.recipeId)?.producesPillId
        && object.ownerId === objective.recipientId && object.possessorId === objective.recipientId
        && object.provenance.some(entry => entry.how === 'crafted' && entry.holderId === worker.id && entry.onDay >= term.incurredOnDay)
        && object.provenance.some(entry => entry.holderId === objective.recipientId && entry.previousHolderId === worker.id));
    return state.objects.some(object => !isRuined(object)
        && object.ownerId === objective.recipientId && object.possessorId === objective.recipientId
        && (objective.kind === 'handover' ? object.id === objective.objectId
            : object.name === objective.named && object.provenance.some(entry => entry.how === 'crafted'
                && entry.holderId === worker.id && entry.onDay >= term.incurredOnDay))
        && object.provenance.some(entry => entry.onDay >= Math.max(offer.day, term.incurredOnDay)
            && (objective.kind !== 'handover' || entry.holderId === objective.recipientId && entry.previousHolderId === worker.id)));
}

function protectedOnTheGround(state: WorldState, id: string, locationId: string): boolean {
    const person = state.npcs.find(row => row.id === id);
    if (person) return person.status === 'alive' && person.locationId === locationId;
    return state.objects.some(object => object.id === id && !isRuined(object)
        && (object.possessorId ? state.npcs.some(holder => holder.id === object.possessorId && holder.locationId === locationId)
            : object.locationId === locationId));
}

/** Read the next accepted job appointment from its word, work facts and actual course. */
export function privateWorkAppointment(state: WorldState, worker: NpcRecord): number | null {
    const id = worker.activity?.privateWorkId ?? worker.activity?.passageCompany?.privateWorkId
        ?? (worker.activity?.capitalMissionId ? witnessIndexFor(state).byId.get(worker.activity.capitalMissionId)?.data.privateWorkId : null);
    const word = typeof id === 'string' ? state.obligations.find(word => word.id === id && word.status === 'open') : null;
    if (!word || worker.activity?.untilDay == null) return null;
    if (factsWithDataValue(state, 'privateWorkCompleted', word.triggeringEventId ?? '').some(fact => fact.data.finished))
        return worker.activity.capitalMissionId || worker.activity.vesselId
            ? Math.min(worker.activity.untilDay, word.dueOnDay ?? Infinity) : word.dueOnDay;
    const escort = factsWithDataValue(state, 'privateEscortStarted', word.triggeringEventId ?? '')[0];
    return Math.min(worker.activity.untilDay, worker.activity.passageCompany?.untilDay ?? Infinity,
        typeof escort?.data.endsOnDay === 'number' ? escort.data.endsOnDay : Infinity);
}

export function settlePrivateWork(state: WorldState, day: number, bodies?: PrivateWorkBodies, personIds?: ReadonlySet<string>,
    onDue?: (workerId: string, day: number) => void): string[] {
    const settled: string[] = [];
    for (let at = 0; at < state.obligations.length; at++) {
        const term = state.obligations[at]!;
        if (term.status !== 'open' || !term.tags.includes('private-paid-work')) continue;
        if (personIds && !personIds.has(term.holderId) && !personIds.has(term.subjectId ?? '')) continue;
        const offer = witnessIndexFor(state).byId.get(term.triggeringEventId ?? '');
        const terms = offer && privateWorkTerms(offer);
        let worker = personIn(state, term.holderId, bodies);
        const employer = personIn(state, term.subjectId ?? '', bodies);
        if (!offer || !terms || !worker) continue;
        servePrivateWork(state, offer, term, terms, day, bodies);
        worker = personIn(state, term.holderId, bodies)!;
        const next = privateWorkAppointment(state, worker);
        if (next != null && next > day) onDue?.(worker.id, next);
        let completed = factsWithDataValue(state, 'privateWorkCompleted', offer.id)
            .find(fact => fact.data.finished === true && fact.day <= day);
        const complete = !!completed || workHasBeenDone(state, offer, terms, term, worker, day, bodies);
        const abandoned = worker.status !== 'alive' || !doingPrivateWork(state, worker, term.id)
            || terms.objective.kind === 'watch' && worker.locationId !== terms.objective.locationId;
        if (!complete && !abandoned && day < (term.dueOnDay ?? Infinity)) continue;
        const canPayHere = !!employer && (bodies?.canSpeak(employer, worker, day) ?? privatePeopleCanSpeak(state, employer, worker, day));
        const employerName = employer?.name ?? offer.actors.find(actor => actor.role === 'offered')?.name ?? term.subjectId ?? '';
        if (complete && !completed) {
            completed = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
                locationId: worker.locationId, causes: [offer.id], actors: [{ id: worker.id, name: worker.name, role: 'worker' },
                    ...(canPayHere ? [{ id: employer!.id, name: employer!.name, role: 'employer' }] : [])],
                summary: `${worker.name} completed ${employerName}'s private work.`,
                data: { privateWorkCompleted: offer.id, finished: true } }), { recur: false, bystanders: false });
            const workerAt = state.npcs.findIndex(person => person.id === worker!.id);
            if (workerAt >= 0 && state.npcs[workerAt].activity?.privateWorkId === term.id
                && state.npcs[workerAt].activity?.kind === 'stationed') state.npcs[workerAt] = {
                ...state.npcs[workerAt], activity: { ...state.npcs[workerAt].activity!, kind: 'their_own_business', untilDay: term.dueOnDay } };
        }
        // An absent SQL participant cannot be settled through a world mirror.
        // Their actual adapter closes the account; native work can still proceed.
        if (!employer) continue;
        if (complete && !canPayHere && day < (term.dueOnDay ?? Infinity)) continue;
        const fact = completed ?? appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
            locationId: worker.locationId, causes: [offer.id], actors: [{ id: worker.id, name: worker.name, role: 'worker' },
                { id: employer.id, name: employer.name, role: 'employer' }],
            summary: complete ? `${worker.name} completed ${employer.name}'s private work.` : `${worker.name} did not complete ${employer.name}'s private work.`,
            data: { privateWorkCompleted: offer.id, finished: complete } }), { recur: false, bystanders: false });
        let paid = false;
        const payer = personIn(state, employer.id, bodies), taker = personIn(state, worker.id, bodies);
        if (complete && canPayHere && payer && taker && paymentAvailable(state, payer, terms.payment)) {
            if (terms.payment.kind === 'stones') {
                if (bodies) paid = bodies.payStones(employer.id, worker.id, terms.payment.amount);
                else {
                    const employerAt = state.npcs.findIndex(person => person.id === employer.id);
                    const workerAt = state.npcs.findIndex(person => person.id === worker.id);
                    state.npcs[employerAt] = { ...payer, spiritStones: payer.spiritStones - terms.payment.amount };
                    state.npcs[workerAt] = { ...taker, spiritStones: taker.spiritStones + terms.payment.amount }; paid = true;
                }
            } else if (terms.payment.kind === 'pill') {
                const payment = terms.payment;
                if (bodies?.payPill) paid = bodies.payPill(payment.objectId, employer.id, worker.id, day, fact.id);
                else {
                    const index = state.objects.findIndex(object => object.id === payment.objectId);
                    state.objects[index] = transferPossession(state.objects[index]!, { toHolderId: worker.id,
                        toHolderName: worker.name, onDay: day, how: 'bought', transfersOwnership: true, factId: fact.id }); paid = true;
                }
            } else {
                const favour = createObligation({ kind: 'favor', holderId: worker.id, subjectId: employer.id,
                    cause: 'other', severity: terms.payment.severity, onDay: day, triggeringEventId: fact.id,
                    description: 'The agreed favour for completed private work.', tags: ['private-work-payment'] });
                if (bodies?.words) bodies.words.write(favour);
                else state.obligations.push(favour);
                paid = true;
            }
        }
        state.obligations[at] = settleObligation(term, { onDay: day, resolution: complete ? 'oath_fulfilled' : 'broken',
            byId: worker.id, note: complete ? 'The private work was completed.' : 'The private work was not completed.' });
        if (!complete || !paid) state.obligations.push(createObligation({ kind: 'grudge',
            holderId: complete ? worker.id : employer.id, subjectId: complete ? employer.id : worker.id,
            cause: complete ? 'other' : 'broken_oath', severity: term.severity, onDay: day, triggeringEventId: fact.id,
            description: complete ? 'The agreed private work payment was not made.' : 'The accepted private work was not done.',
            tags: [complete ? 'private-work-unpaid' : 'private-work-failed', offer.id] }));
        if (complete) appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: worker.locationId,
            actors: [{ id: employer.id, name: employer.name, role: 'payer' }, { id: worker.id, name: worker.name, role: 'worker' }],
            causes: [fact.id], summary: paid ? `${employer.name} paid the agreed ${terms.payment.kind === 'stones'
                ? `${terms.payment.amount} spirit stones` : terms.payment.kind === 'pill' ? 'pill' : 'favour'} to ${worker.name}.`
                : `${employer.name} did not pay ${worker.name} for the completed private work.`,
            data: { privateWorkPayment: offer.id, paid } }), { recur: false, bystanders: false });
        const workerAt = state.npcs.findIndex(person => person.id === worker.id);
        if (workerAt >= 0 && isTheWorldsToMove(worker) && state.npcs[workerAt]!.activity?.privateWorkId === term.id) {
            const current = state.npcs[workerAt]!;
            if (current.activity?.capitalMissionId || current.activity?.vesselId) {
                const continuing = { ...current.activity }; delete continuing.privateWorkId;
                state.npcs[workerAt] = { ...current, activity: continuing };
            } else state.npcs[workerAt] = { ...current, activity: null };
        }
        settled.push(term.id);
    }
    return settled;
}
