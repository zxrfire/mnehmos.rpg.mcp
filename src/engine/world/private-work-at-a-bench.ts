/** An accepted private commission uses the existing hands, recipe, duration and work outcome. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { HistoricalFact } from './history.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import type { ObligationRecord } from '../social/grudges.js';
import type { PrivateWorkBodies, PrivateWorkObjective } from './private-paid-work.js';
import { privatePeopleCanSpeak } from './private-requests.js';
import { whatThisPersonHasOnTheBench, theIdsOnTheBench } from './what-is-on-the-bench.js';
import { takeWhatTheRecipeNames } from './taking-the-materials-off-the-bench.js';
import { daysAtTheWork, whetherTheirHandsCanDoIt } from '../social-leverage/commissioning-a-craft.js';
import { mintAMadeThing, theOddsTheWorkHolds } from '../social-leverage/whether-the-work-holds.js';
import { whatItIsMadeOf } from '../../data/cultivation/what-an-artifact-is-made-of.js';
import { theBestVesselToHand } from './the-vessel-somebody-works-at.js';
import { transferPossession } from './possessions.js';
import { forStream } from '../cultivation/rng.js';

export function servePrivateCraft(state: WorldState, offer: HistoricalFact, term: ObligationRecord,
    objective: Extract<PrivateWorkObjective, { kind: 'craft' }>, worker: NpcRecord, day: number,
    bodies?: PrivateWorkBodies): void {
    const ask = objective.ask;
    if (!ask || ask.aRing || ask.named !== objective.named) return;
    const recipient = bodies?.person(objective.recipientId) ?? state.npcs.find(person => person.id === objective.recipientId);
    const canSpeak = (person: NpcRecord) => bodies?.canSpeak(worker, person, day) ?? privatePeopleCanSpeak(state, worker, person, day);
    let started = factsWithDataValue(state, 'privateCraftStarted', offer.id)[0];
    if (!started) {
        const employer = bodies?.person(term.subjectId ?? '') ?? state.npcs.find(person => person.id === term.subjectId);
        if (!employer || !canSpeak(employer)) return;
        const bench = [...(bodies?.bench?.(employer.id) ?? whatThisPersonHasOnTheBench(undefined, state.objects, employer.id)),
            ...(bodies?.bench?.(worker.id) ?? whatThisPersonHasOnTheBench(undefined, state.objects, worker.id))];
        const hands = whetherTheirHandsCanDoIt(ask, worker.cultivation.realmOrdinal, theIdsOnTheBench(bench));
        const days = daysAtTheWork(ask.grade, worker.cultivation.realmOrdinal, { aSlip: Boolean(ask.slip) });
        if (!hands.theyCan || day + days > (term.dueOnDay ?? Infinity)) return;
        started = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: worker.locationId,
            actors: [{ id: worker.id, name: worker.name, role: 'maker' }], causes: [offer.id],
            summary: `${worker.name} began making ${ask.named}.`,
            data: { privateCraftStarted: offer.id, readyOnDay: day + days } }), { recur: false, bystanders: false });
        const at = state.npcs.findIndex(person => person.id === worker.id);
        state.npcs[at] = { ...state.npcs[at]!, activity: { ...worker.activity!, untilDay: day + days } };
    }
    const due = Number(started.data.readyOnDay), thingId = `private-made:${offer.id}`;
    if (day < due || worker.locationId !== started.locationId) return;
    let made = state.objects.find(object => object.id === thingId);
    if (!made && !factsWithDataValue(state, 'privateCraftResolved', offer.id).length) {
        const employer = bodies?.person(term.subjectId ?? '') ?? state.npcs.find(person => person.id === term.subjectId);
        const bench = [...(bodies?.bench?.(worker.id) ?? whatThisPersonHasOnTheBench(undefined, state.objects, worker.id)),
            ...(employer && canSpeak(employer) ? bodies?.bench?.(employer.id)
                ?? whatThisPersonHasOnTheBench(undefined, state.objects, employer.id) : [])];
        if (!whetherTheirHandsCanDoIt(ask, worker.cultivation.realmOrdinal, theIdsOnTheBench(bench)).theyCan) return;
        const took = bodies?.takeMaterials ? bodies.takeMaterials(ask, bench, day)
            : takeWhatTheRecipeNames({ objects: state.objects, grade: ask.grade, bench, onDay: day,
                intoWhat: ask.named, recipe: ask.slip ? null : whatItIsMadeOf(ask.grade, ask.demonic === true) }) !== null;
        if (!took) return;
        const vessel = ask.slip ? null : theBestVesselToHand(state.objects, worker.id, 'refining_furnace', worker.cultivation.realmOrdinal);
        const odds = theOddsTheWorkHolds(ask, worker.cultivation.realmOrdinal, vessel?.grade ?? null);
        const succeeded = !odds.rolled || forStream(state.seed, 'private-commission-work', offer.id, worker.id).chance(odds.chance);
        appendWorldFact(state, makeFact({ day: due, kind: 'opportunity', visibility: 'secret', locationId: worker.locationId,
            actors: [{ id: worker.id, name: worker.name, role: 'maker' }], causes: [offer.id],
            summary: `${worker.name}'s work on ${ask.named} ${succeeded ? 'was completed' : 'failed'}.`,
            data: { privateCraftResolved: offer.id, succeeded } }), { recur: false, bystanders: false });
        if (succeeded) {
            made = transferPossession(mintAMadeThing({ id: thingId, ask,
                maker: { id: worker.id, name: worker.name, ordinal: worker.cultivation.realmOrdinal }, onDay: due }),
                { toHolderId: worker.id, toHolderName: worker.name, onDay: due, how: 'crafted', factId: offer.id });
            made.locationId = worker.locationId;
            made.ownerId = objective.recipientId; made.ownerName = recipient?.name ?? objective.recipientId;
            state.objects.push(made);
        }
        const at = state.npcs.findIndex(person => person.id === worker.id);
        state.npcs[at] = { ...state.npcs[at]!, activity: { ...state.npcs[at]!.activity!, untilDay: term.dueOnDay } };
    }
    if (made && made.possessorId === worker.id && recipient && canSpeak(recipient)) {
        const at = state.objects.findIndex(object => object.id === made!.id);
        state.objects[at] = transferPossession(made, { toHolderId: recipient.id, toHolderName: recipient.name,
            onDay: day, how: 'gifted', transfersOwnership: true, factId: offer.id });
    }
}
