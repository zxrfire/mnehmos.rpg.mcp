/** Rates choose distant opportunities; agreement itself always reads real consent and reach. */
import { agreeOpenContract, endContractIfDue, bindingOf, contractPairOf, type ContractBinding, type ContractEnd } from '../social/open-contracts.js';
import { createObligation, settleObligation } from '../social/grudges.js';
import { whatWalkingOutOfItCosts } from '../social-leverage/what-would-settle-an-account-this-heavy.js';
import { weatherTheStrikes, strikesForABrokenDaoOath, WHAT_A_WEATHERED_STRIKE_STILL_TAKES } from '../cultivation/existence.js';
import { realmIndexOf } from '../cultivation/realms.js';
import { woundsCarriedBy, carryingWounds, bodyStandingOn, maxBodyOf, markDead } from './npc-state.js';
import { settleNpcDeath } from './time.js';
import { forStream } from '../cultivation/rng.js';
import { privatePeopleCanSpeak, putPrivateRequest, privatePartyOf } from './private-requests.js';
import { oddsOf } from '../social-leverage/an-attempt-to-move-somebody.js';
import { drawBackgroundIncidents, isPlayerInvolved, playerAtTheContact } from './background-incident-draw.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { routineLocationOf } from './npc-routines.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { layPersonSeal, releasePersonSeal } from './person-seals.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { whatLayingASealTakes } from '../social/what-laying-a-qi-seal-takes.js';
import { isTheSamePerson } from '../cultivation/existence.js';
import { commandSlave, type PersonOrder } from './slave-orders.js';
import type { WorldState } from './world-state.js';

export interface OpenContractOffer {
    firstTerms: string; secondTerms: string; binding: ContractBinding; end: ContractEnd;
    days?: number; boundId?: string;
    /** An explicit service already among the terms, begun only after both answers. */
    initialOrder?: PersonOrder;
}

/** The proposer has chosen the offer. A human respondent receives a question, never a rolled answer. */
export function offerOpenContract(state: WorldState, proposer: NpcRecord, respondent: NpcRecord,
    offer: OpenContractOffer, day: number,
    reached: (proposer: NpcRecord, respondent: NpcRecord) => boolean = (proposer, respondent) => contractPeopleCanSpeak(state, proposer, respondent, day)): boolean {
    if (!isTheWorldsToMove(proposer) || !reached(proposer, respondent)) return false;
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret',
        locationId: proposer.locationId, actors: [{ id: proposer.id, name: proposer.name, role: 'offered' },
            { id: respondent.id, name: respondent.name, role: 'asked' }],
        summary: `${proposer.name} offered ${respondent.name} a contract.`,
        data: { openContractOffer: true, fromId: proposer.id, toId: respondent.id, offer: JSON.stringify(offer) } }),
    { recur: false, bystanders: false });
    if (!isTheWorldsToMove(respondent)) return false;
    const agreed = putPrivateRequest(state, proposer, respondent, day, fact.summary, `contract-consent:${fact.id}`,
        offer.binding === 'slave' && offer.boundId !== proposer.id ? 'against_their_interest' : 'a_real_favour', reached);
    appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: proposer.locationId,
        actors: fact.actors, causes: [fact.id], summary: `${respondent.name} ${agreed ? 'agreed' : 'declined'}.`,
        data: { openContractReply: fact.id, agreed } }), { recur: false, bystanders: false });
    if (!agreed) return false;
    if (offer.binding === 'slave') {
        const bound = offer.boundId === proposer.id ? proposer : respondent;
        const holder = bound.id === proposer.id ? respondent : proposer;
        if (!layPersonSeal(state, holder, bound, { kind: 'slave', day, consentOrSubmission: true,
            days: offer.days, note: bound.id === proposer.id ? offer.firstTerms : offer.secondTerms }).went) return false;
    }
    state.obligations.push(...agreeOpenContract({ firstId: proposer.id, secondId: respondent.id,
        firstTerms: offer.firstTerms, secondTerms: offer.secondTerms, firstConsents: true, secondConsents: true,
        binding: offer.binding, end: offer.end, day, eventId: fact.id,
        dueOnDay: offer.days === undefined ? null : day + offer.days }));
    if (offer.binding === 'slave' && offer.initialOrder) {
        const boundId = offer.boundId ?? respondent.id;
        const slave = state.npcs.find(person => person.id === boundId)!;
        const holder = state.npcs.find(person => person.id === (boundId === proposer.id ? respondent.id : proposer.id))!;
        commandSlave(state, holder, slave, offer.initialOrder, day, true);
    }
    return true;
}

export function settleOpenContracts(state: WorldState, day: number): void {
    const alive = (id: string) => state.npcs.some(person => person.id === id && person.status !== 'physically_dead'
        && isTheSamePerson({ existenceState: person.status, identityContinuity: person.identityContinuity }));
    for (let at = 0; at < state.obligations.length; at++) {
        const word = state.obligations[at];
        const ended = endContractIfDue(word, day, alive);
        if (ended !== word) {
            state.obligations[at] = ended;
            const person = state.npcs.find(person => person.id === word.holderId);
            if (bindingOf(word) === 'slave' && person?.cultivation.seal?.kind === 'slave'
                && person.cultivation.seal.byId === word.subjectId) releasePersonSeal(state, person.id, ended.settlement!.onDay);
        }
    }
}

/** World people break the same words and suffer the same binding, never a narrator's verdict. */
export function breakOpenContract(state: WorldState, personId: string, wordId: string, day: number): boolean {
    const person = state.npcs.find(person => person.id === personId && isTheWorldsToMove(person) && person.status === 'alive');
    const at = state.obligations.findIndex(word => word.id === wordId && word.holderId === personId && word.status === 'open' && word.kind === 'oath');
    const word = state.obligations[at];
    if (!person || !word || !word.subjectId) return false;
    const cost = whatWalkingOutOfItCosts({ binding: { ...word, subjectId: word.subjectId }, leaverId: personId, leaverName: person.name, onDay: day });
    state.obligations[at] = settleObligation(word, { resolution: 'broken', onDay: day, note: 'The agreed word was not kept.', byId: personId });
    state.obligations.push(...[cost.reopened, cost.opened].flatMap(input => input ? [createObligation(input)] : []));
    const bodyAt = state.npcs.findIndex(row => row.id === personId);
    if (bindingOf(word) === 'slave' && person.cultivation.seal?.kind === 'slave') {
        state.npcs[bodyAt] = { ...person, soulState: 'fragmented', updatedOnDay: day };
    } else if (bindingOf(word) === 'dao') {
        const struck = weatherTheStrikes({ attributes: person.cultivation.attributes, injuries: woundsCarriedBy(person) }, 'normal',
            forStream(state.seed, 'oath', `broke-${word.id}`), 1, strikesForABrokenDaoOath(realmIndexOf(person.cultivation.realmOrdinal)),
            'for the word given', 'The word is gone.', 'The last strike ended them.');
        state.npcs[bodyAt] = carryingWounds(person, struck.injuries, day);
        state.npcs[bodyAt] = { ...state.npcs[bodyAt], cultivation: { ...state.npcs[bodyAt].cultivation,
            hp: Math.max(0, bodyStandingOn(person, day) - Math.round(maxBodyOf(person) * WHAT_A_WEATHERED_STRIKE_STILL_TAKES * struck.weathered)),
            bodyOnDay: day } };
        if (!struck.survived) {
            const dying = state.npcs[bodyAt];
            state.npcs[bodyAt] = markDead(dying, day, 'The backlash of the broken dao oath ended their life.');
            settleNpcDeath(state, dying, day);
            appendWorldFact(state, makeFact({ day, kind: 'death', visibility: 'regional', locationId: dying.locationId,
                actors: [{ id: dying.id, name: dying.name, role: 'victim' }], causes: word.triggeringEventId ? [word.triggeringEventId] : [],
                summary: `${dying.name} died in the backlash of the broken dao oath.`, data: { brokenDaoOath: word.id } }), { recur: false });
        }
    }
    return true;
}

/** No catalog of contract content: people offer support toward the goals they actually have. */
export function openContractsThisYear(state: WorldState, year: number, day: number,
    exactly?: ReadonlySet<string>): void {
    settleOpenContracts(state, day);
    const seriousAccounts = new Set(state.obligations.filter(account => account.status === 'open'
        && (account.kind === 'grudge' || account.kind === 'blood_feud')
        && (account.severity === 'grave' || account.severity === 'unforgivable'))
        .map(account => JSON.stringify([account.holderId, account.subjectId])));
    const unhappyWords = new Map(state.obligations.filter(word => word.status === 'open' && contractPairOf(word)
        && seriousAccounts.has(JSON.stringify([word.holderId, word.subjectId]))).map(word => [word.holderId, word]));
    const wantsOut = (person: NpcRecord) => unhappyWords.get(person.id);
    const pool = state.npcs.filter(person => person.status === 'alive' && isTheWorldsToMove(person)
        && (!exactly || exactly.has(person.id)) && (person.relationships.some(tie => tie.standing > 0) || wantsOut(person)));
    const rate = (person: NpcRecord) => 0.04 * Math.max(wantsOut(person) ? 1 : 0, ...person.relationships.map(tie => tie.standing));
    const selected = exactly ? pool.filter(person => forStream(state.seed, 'contract-exact', person.id, year).chance(rate(person))) : [...pool.filter(person => isPlayerInvolved(state, person)
        && forStream(state.seed, 'contract-exact', person.id, year).chance(rate(person))),
    ...drawBackgroundIncidents(pool.filter(person => !isPlayerInvolved(state, person)).map(value => ({ value, rate: rate(value) })),
        forStream(state.seed, 'contract-background', year), 4)];
    for (const proposer of selected) {
        const unhappyWord = wantsOut(proposer);
        const beneficiary = unhappyWord && state.npcs.find(person => person.id === unhappyWord.subjectId);
        if (unhappyWord && beneficiary && contractPeopleCanSpeak(state, proposer, beneficiary, day)) {
            const subject = privatePartyOf(state, proposer, day);
            // A live slave effect is not a promise they may choose to abandon.
            if (subject.compelledById === beneficiary.id) continue;
            const rng = forStream(state.seed, 'keep-open-word', unhappyWord.id, year);
            const keep = oddsOf({ actor: privatePartyOf(state, beneficiary, day), subject, ask: 'against_their_interest',
                onDay: day, ledger: state.obligations, approach: { leverage: 'name', audience: 'alone' }, rng });
            if (!rng.chance(keep.odds)) breakOpenContract(state, proposer.id, unhappyWord.id, day);
            continue;
        }
        if (state.history.facts.some(fact => fact.year === year && fact.data.openContractOffer === true && fact.data.fromId === proposer.id)) continue;
        const contact = playerAtTheContact(state);
        const candidates = contact?.person ? [contact.person, ...state.npcs.filter(person => person.id !== contact.person!.id)] : state.npcs;
        const other = candidates.find(person => person.id !== proposer.id && person.status === 'alive'
            && proposer.relationships.some(tie => tie.targetId === person.id && tie.standing > 0)
            && contractPeopleCanSpeak(state, proposer, person, day));
        if (!other) continue;
        const atPlace = routineLocationOf({ ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 }, proposer);
        if (!atPlace) continue;
        const goal = proposer.goals.find(goal => goal.status === 'active');
        const rng = forStream(state.seed, 'contract-terms', proposer.id, other.id, year);
        const bindings: ContractBinding[] = ['word', 'blood', 'dao'];
        // Content stays open. A service offer is possible only if its actual seal can be laid.
        const master = proposer.cultivation.realmOrdinal >= other.cultivation.realmOrdinal ? proposer : other;
        const servant = master.id === proposer.id ? other : proposer;
        if (whatLayingASealTakes({ kind: 'slave', sealerId: master.id, sealerOrdinal: master.cultivation.realmOrdinal,
            subjectOrdinal: servant.cultivation.realmOrdinal, subjectConsentsOrSubmitted: true,
            subjectIsThere: true, subjectAlreadySealed: !!servant.cultivation.seal,
            onDay: day, subjectMaxQi: 0, forDays: 365, note: 'An offered service term.' }).went) bindings.push('slave');
        const binding = rng.pick(bindings);
        const willingness = oddsOf({ actor: privatePartyOf(state, other, day), subject: privatePartyOf(state, proposer, day),
            ask: binding === 'slave' && servant.id === proposer.id ? 'against_their_interest' : 'a_real_favour',
            theirTie: { active: true, strength: Math.max(0, proposer.relationships.find(tie => tie.targetId === other.id)?.standing ?? 0) },
            onDay: day, ledger: state.obligations, approach: { leverage: 'name', audience: 'alone' }, rng });
        if (!rng.chance(willingness.odds)) continue;
        offerOpenContract(state, proposer, other, { binding,
            ...(binding === 'slave' ? { boundId: servant.id,
                initialOrder: { action: 'guard' as const, destinationId: atPlace,
                    words: 'Guard this place for the agreed year.', days: 365 } } : {}),
            firstTerms: binding === 'slave' ? proposer.id === servant.id ? 'Guard this place for the agreed year under the seal.'
                : 'Provide resources and protection for the agreed year.' : `Aid ${other.name} on the road when called upon.`,
            secondTerms: binding === 'slave' ? other.id === servant.id ? 'Guard this place for the agreed year under the seal.'
                : 'Provide resources and protection for the agreed year.'
                : goal ? `Aid ${proposer.name}: ${goal.text}` : `Aid ${proposer.name} on the road when called upon.`,
            days: 365, end: { condition: 'A year of mutual aid, or mutual release.' } }, day);
    }
}

function contractPeopleCanSpeak(state: WorldState, proposer: NpcRecord, respondent: NpcRecord, day: number): boolean {
    if (isTheWorldsToMove(respondent)) return privatePeopleCanSpeak(state, proposer, respondent, day);
    const contact = playerAtTheContact(state);
    const place = contact && state.locations.find(place => place.id === contact.placeId);
    if (!contact || !place || contact.person?.id !== respondent.id || proposer.status !== 'alive'
        || routineLocationOf({ ...state, currentDay: Math.floor(day), currentHour: day % 1 * 24 }, proposer) !== place.id) return false;
    return theAreasOf(state, place, undefined, { id: respondent.id, sectId: respondent.factionId,
        standingIn: contact.areaId }).whereIs.get(proposer.id) === contact.areaId;
}
