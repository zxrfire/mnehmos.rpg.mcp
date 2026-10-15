/** Open personal terms enter the same oath ledger after two actual answers. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { PlannedAction } from './planned-action.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { agreeOpenContract, endContractIfDue, bindingOf } from '../engine/social/open-contracts.js';
import { type OpenContractOffer } from '../engine/world/people-agree-open-contracts.js';
import { resolveAttempt, attemptWasAccepted } from '../engine/social-leverage/an-attempt-to-move-somebody.js';
import { privatePartyOf } from '../engine/world/private-requests.js';
import { createObligation } from '../engine/social/grudges.js';
import { forStream } from '../engine/cultivation/rng.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { ledgerAbout, writeObligations } from '../storage/repos/obligation.repo.js';
import { applyActualPersonSeal, releaseActualPersonSeal } from './person-seals-at-the-actual-body.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { theRollLands } from '../server/consolidated/forcing-an-attempt-to-land.js';
import { openContractSaid } from './open-contract-phrasings.js';
import { isTheSamePerson } from '../engine/cultivation/existence.js';
import { commandAtTheActualBody } from './slave-orders-at-the-actual-body.js';

function pendingOffers(game: GameService, body: Cultivator) {
    const world = game.atHand!;
    return world.history.facts.filter(fact => fact.data.openContractOffer === true && fact.data.toId === body.id
        && game.present(body).some(person => person.id === fact.data.fromId)
        && !world.history.facts.some(reply => reply.data.openContractReply === fact.id));
}

export function contractOffersAtBody(game: GameService, body: Cultivator): string[] {
    if (!game.atHand) return [];
    const day = routineTime(game.atHand), words = ledgerAbout(game.db, body.id);
    if (body.qiSeal?.kind === 'slave' && body.qiSeal.liftsOnDay !== null && day >= body.qiSeal.liftsOnDay)
        releaseActualPersonSeal(game, body.id, body.qiSeal.liftsOnDay);
    const changed = words.map(word => endContractIfDue(word, day, id => {
        const person = actualPersonFor(game, id);
        return !!person && person.status !== 'physically_dead'
            && isTheSamePerson({ existenceState: person.status, identityContinuity: person.identityContinuity });
    }))
        .filter((word, at) => word !== words[at]);
    writeObligations(game.db, changed);
    for (const word of changed) {
        const person = actualPersonFor(game, word.holderId);
        if (bindingOf(word) === 'slave' && person?.cultivation.seal?.kind === 'slave'
            && person.cultivation.seal.byId === word.subjectId) releaseActualPersonSeal(game, person.id, word.settlement!.onDay);
    }
    return pendingOffers(game, body).flatMap(fact => {
        const proposer = actualPersonFor(game, String(fact.data.fromId));
        if (!proposer) return [];
        game.theyGaveTheirName(body, game.currentRun().run, proposer);
        const offer = JSON.parse(String(fact.data.offer)) as OpenContractOffer;
        return [`${proposer.name} offers a ${offer.binding} contract. They owe: ${offer.firstTerms} You owe: ${offer.secondTerms} `
            + `It ends: ${offer.end.condition} Do you agree?`];
    });
}

export function openContractsWithAPerson(game: GameService, run: Run, body: Cultivator,
    action: PlannedAction, raw: string) {
    if (!game.atHand || !action.contract && !action.intent?.startsWith('contract_')) return null;
    const world = game.atHand, day = routineTime(world), player = actualPersonFor(game, body.id)!;
    const decline = action.intent === 'contract_decline';
    const pending = pendingOffers(game, body);
    const target = (action.target ? game.somebodyAtHand(action.target, body) : null)
        ?? game.present(body).find(person => raw.toLowerCase().includes(person.name.toLowerCase())) ?? null;
    const invitation = pending.find(fact => target ? fact.data.fromId === target.id
        : pending.length === 1 || raw.toLowerCase().includes(fact.actors[0].name.toLowerCase()));
    const answering = action.intent === 'contract_accept' || decline;
    const other = actualPersonFor(game, answering ? String(invitation?.data.fromId ?? '') : target?.id ?? '');
    const refusal = (line: string) => refused('social.openContract', 'oath', factsForRefusal('No contract was made.', line));
    if (!other || !game.present(body).some(person => person.id === other.id)) return refusal('Reach the person whose answer is needed.');
    let offer: OpenContractOffer, eventId: string, agreed: boolean;
    if (answering) {
        if (!invitation) return refusal('There is no unanswered contract offer from that person.');
        offer = JSON.parse(String(invitation.data.offer)) as OpenContractOffer;
        eventId = invitation.id;
        agreed = !decline;
        appendWorldFact(world, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: game.worldPlaceOf(body),
            actors: invitation.actors, causes: [invitation.id], summary: `${body.name} ${agreed ? 'accepted' : 'declined'} the contract.`,
            data: { openContractReply: invitation.id, agreed } }), { recur: false, bystanders: false });
    } else {
        const terms = action.contract ?? openContractSaid(raw)?.contract;
        if (!terms) return refusal('State what each person owes, the binding, and the ending condition.');
        offer = { firstTerms: terms.yourTerms, secondTerms: terms.theirTerms, binding: terms.binding,
            end: { condition: terms.endCondition,
                ...(terms.untilDeath ? { untilDeathOf: terms.untilDeath === 'you' ? body.id : other.id } : {}) },
            days: terms.days, boundId: terms.bound === 'you' ? body.id : other.id };
        const result = resolveAttempt({ actor: privatePartyOf(world, player), subject: privatePartyOf(world, other),
            theAttemptLands: theRollLands('an_approach_to_somebody'),
            ask: offer.binding === 'slave' && offer.boundId !== body.id ? 'against_their_interest' : 'a_real_favour', onDay: day,
            ledger: [...world.obligations, ...ledgerAbout(game.db, body.id)],
            theirTie: { active: true, strength: Math.max(0, other.relationships.find(tie => tie.targetId === body.id)?.standing ?? 0) },
            approach: { leverage: 'name', audience: 'alone' }, rng: forStream(run.seed, 'open-contract-answer', run.turn, other.id) });
        agreed = attemptWasAccepted(result.outcome);
        const fact = appendWorldFact(world, makeFact({ day, kind: 'opportunity', visibility: 'secret',
            locationId: game.worldPlaceOf(body), actors: [{ id: body.id, name: body.name, role: 'offered' },
                { id: other.id, name: other.name, role: 'answered' }], summary: `${body.name} offered ${other.name} a contract. ${result.line}`,
            data: { openContractAgreement: agreed } }), { recur: false, bystanders: false });
        eventId = fact.id;
        writeObligations(game.db, [result.marks.obligation, result.marks.counterObligation]
            .flatMap(input => input ? [createObligation({ ...input, triggeringEventId: eventId })] : []));
    }
    if (agreed && offer.binding === 'slave') {
        const boundId = offer.boundId ?? (answering ? body.id : other.id);
        const holderId = boundId === body.id ? other.id : body.id;
        const laid = applyActualPersonSeal(game, holderId, boundId, { kind: 'slave', day, consentOrSubmission: true,
            days: offer.days, note: boundId === body.id ? answering ? offer.secondTerms : offer.firstTerms
                : answering ? offer.firstTerms : offer.secondTerms });
        if (!laid?.went) { game.theWorldMoved(); return refusal(laid?.line ?? 'No slave seal could be laid.'); }
    }
    const words = agreeOpenContract({ firstId: answering ? other.id : body.id, secondId: answering ? body.id : other.id,
        firstTerms: offer.firstTerms, secondTerms: offer.secondTerms, firstConsents: true,
        secondConsents: agreed, binding: offer.binding, end: offer.end, day, eventId,
        dueOnDay: offer.days === undefined ? null : day + offer.days });
    writeObligations(game.db, words);
    if (words.length && offer.binding === 'slave' && offer.initialOrder) {
        const boundId = offer.boundId ?? body.id;
        commandAtTheActualBody(game, boundId === body.id ? other.id : body.id, boundId, offer.initialOrder);
    }
    game.theWorldMoved();
    return game.freeAction(run, 'oath', factsForToolResult(words.length ? 'Both people agreed the contract.' : 'No contract was made.',
        words.length ? [`${offer.binding} binding.`, offer.firstTerms, offer.secondTerms, `Ends: ${offer.end.condition}`]
            : [`${other.name} did not agree. Nothing binds either person.`]));
}
