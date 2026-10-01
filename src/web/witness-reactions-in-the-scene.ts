/** The scene supplies witnesses and evidence; the trust reader supplies belief. */
import { aWitnessSeesThrough } from '../engine/cultivation/regard.js';
import { reactToWitnessedFact, witnessReactions, accountForWitnessedDeed, observationOf, actorAndVictimOf,
    reportFromObservation, houseHearsWitnessReport, witnessReportsWhatTheySaw } from '../engine/world/witness-reactions.js';
import { aPricedDeed } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { makeFact, type HistoricalFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { createObligation } from '../engine/social/grudges.js';
import { whatServiceIsWorth } from '../engine/world/what-a-house-counts-in-somebodys-favour.js';
import { thePricesStanding } from '../engine/world/a-house-puts-a-price-on-somebody.js';
import { whatAPriceMeansTo, faceFromAPrice } from '../engine/world/witness-reactions.js';
import { theirFaceMoves } from '../engine/world/what-a-face-is-worth.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from '../engine/world/what-one-of-the-worlds-own-people-knows.js';
import { canPointAt } from '../engine/social/discovery.js';
import { ledgerAbout, writeOneObligation, type ObligationDb, type ObligationWriteDb } from '../storage/repos/obligation.repo.js';
import type { SeenDeed } from '../engine/social-leverage/an-account-of-a-deed.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { factsForToolResult } from './facts.js';
import { thePlayerIsSureItIsThem } from './the-narrator-plays-the-world.js';
import { whatYouAreNotShowing } from './what-you-are-not-showing.js';
import { deedAccountInWords } from './an-account-of-yourself.js';
import { theAreasOf, whereInThisPlaceTheyStand } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { whatATellingLandsOn } from './what-a-telling-lands-on.js';
import type { PlannedAction } from './planned-action.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

function seen(wrong: SeenDeed['wrong'], sawAct: boolean): SeenDeed {
    return { wrong, sawAct, sawFirstAttack: false, foundBeforeActor: false, sawPermission: false,
        recognisedProperty: false, bonesTaken: false, competingAccount: false };
}

function witnessName(game: GameService, me: Cultivator, id: string): string {
    const npc = game.atHand?.npcs.find(n => n.id === id);
    return npc && thePlayerIsSureItIsThem(npc.name, game.knowledge.awareness(me.id)) ? npc.name : 'The person here';
}

/** Record only what the same area could see, including a body that predates this turn. */
export function reactToWhatHappenedHere(game: GameService, me: Cultivator, done: Execution, input: {
    factsBefore: number; objectsBefore: ReadonlyMap<string, number>; rawInput: string;
    witnessIds: readonly string[];
}): void {
    const world = game.atHand;
    if (!world || !me.alive) return;
    const ledger = ledgerAbout(game.db as unknown as ObligationDb, me.id);
    const hidden = whatYouAreNotShowing(input.rawInput) !== null;
    const visible = (ids: readonly string[]) => ids.filter(id => {
        const npc = world.npcs.find(n => n.id === id);
        return npc && npc.status === 'alive' && (!hidden || aWitnessSeesThrough(me.realmOrdinal, npc.cultivation.realmOrdinal));
    });
    const witnesses = visible(input.witnessIds);
    const register = (fact: HistoricalFact, evidence: SeenDeed, victimId: string | null,
        ids = witnesses, howSeen: (id: string) => SeenDeed = () => evidence): void => {
        const added = reactToWitnessedFact(world, fact, { actorId: me.id, victimId, ledger,
            actorHouseId: game.repos.sects.getMembership(me.id)?.sectId ?? null,
            knows: (holderId, kind, id) => kind === 'cultivator'
                ? game.knowledge.stageOf(holderId, kind, id) === 'known'
                : game.knowledge.isAwareOf(holderId, kind, id),
            witnesses: ids.map(id => ({ id, seen: howSeen(id) })) });
        for (const row of added) {
            const name = witnessName(game, me, row.witnessId);
            if (row.state === 'pending') {
                const line = `${name} asks you to explain what they saw.`;
                done.facts.lines.push(line);
                done.facts.prose += `\n\n${line}`;
            }
            if (row.wrong !== null) game.knowledge.learn({ holderId: row.witnessId,
                kind: 'cultivator', id: me.id, name: me.name, factId: fact.id,
                onDay: Math.floor(world.currentDay), sourceKind: 'witnessed', sourceNote: 'Seen here.',
                statement: row.sawAct ? fact.summary : `${me.name} was beside a body.`, stage: 'encountered' });
            game.knowledge.learn({ holderId: row.witnessId, kind: 'event', id: fact.id, name: fact.summary,
                factId: fact.id, onDay: Math.floor(world.currentDay), sourceKind: 'witnessed',
                sourceNote: 'Seen here.', statement: fact.summary, stage: 'known' });
            if (row.state === 'reported_for') {
                const houseId = game.repos.sects.getMembership(me.id)?.sectId ?? null;
                const credit = houseHearsWitnessReport(world, fact, row, houseId);
                if (credit && houseId) game.repos.sects.addContribution(houseId, me.id,
                    Math.round(whatServiceIsWorth(me.realmOrdinal, row.manyHarmed ? 90 : 30)));
            }
            const report = reportFromObservation(fact, row,
                game.repos.sects.getMembership(me.id)?.sectId ?? null, Math.floor(world.currentDay));
            if (report && !ledger.some(held => held.holderId === report.holderId
                && held.subjectId === report.subjectId && held.triggeringEventId === fact.id)) {
                writeOneObligation(game.db as unknown as ObligationWriteDb, createObligation(report));
                houseHearsWitnessReport(world, fact, row, game.repos.sects.getMembership(me.id)?.sectId ?? null);
            }
        }
        if (added.length > 0) {
            game.theWorldMoved();
            done.calls.push({ name: 'world.reactToWitnessedFact', action: 'witness',
                summary: `${fact.id}: ${added.map(row => `${row.witnessId} ${row.state}`).join(', ')}.`, ok: true });
        }
    };
    const fresh = world.history.facts.slice(input.factsBefore);
    for (const fact of fresh) {
        const parties = actorAndVictimOf(fact);
        if (parties?.actorId !== me.id) continue;
        register(fact, observationOf(fact), parties.victimId, visible(fact.witnessIds));
    }
    for (const object of world.objects) {
        if (object.possessorId !== me.id || object.provenance.length <= (input.objectsBefore.get(object.id) ?? object.provenance.length)) continue;
        const link = object.provenance[object.provenance.length - 1];
        if (link?.how !== 'stolen') continue;
        const nowHere = visible(game.present(me).map(n => n.id));
        const fact = appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'grudge_opened',
            locationId: game.worldPlaceOf(me), witnessIds: [me.id, ...nowHere],
            actors: [{ id: me.id, name: me.name, role: 'actor' }],
            visibility: nowHere.length > 0 ? 'regional' : 'secret',
            summary: `${me.name} took ${object.name}.`, data: { objectId: object.id, deedWrong: 'robbed', ...aPricedDeed('serious') } }));
        const evidence = seen('robbed', true);
        const mark = object.tags.find(tag => tag.startsWith('house:'))?.slice('house:'.length);
        register(fact, evidence, object.ownerId, nowHere, id => ({ ...evidence,
            recognisedProperty: mark !== undefined && game.knowledge.isAwareOf(id, 'sect', mark) }));
    }
    for (const object of world.objects.filter(row => row.possessorId === me.id
        && row.ownerId !== null && row.ownerId !== me.id)) {
        const mark = object.tags.find(tag => tag.startsWith('house:'))?.slice('house:'.length);
        const knowers = visible(game.present(me).map(n => n.id)).filter(id =>
            object.knownOwnershipBy.includes(id)
            || mark !== undefined && game.knowledge.isAwareOf(id, 'sect', mark));
        const freshWitnesses = knowers.filter(id => !world.history.facts.some(fact =>
            fact.data.seenWithEvidence === object.id
            && witnessReactions(world, me.id).some(row => row.fact.id === fact.id
                && row.observation.witnessId === id)));
        if (freshWitnesses.length === 0) continue;
        const fact = appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'opportunity',
            locationId: game.worldPlaceOf(me), witnessIds: [me.id, ...freshWitnesses], visibility: 'secret',
            actors: [{ id: me.id, name: me.name, role: 'actor' }],
            summary: mark ? `${me.name} carried ${object.name} bearing a house mark.`
                : `${me.name} carried ${object.name}, which ${object.ownerName} owns.`,
            data: { objectId: object.id, seenWithEvidence: object.id, markedProperty: true } }),
        { recur: false });
        const evidence = { ...seen('robbed', false), recognisedProperty: true };
        register(fact, evidence, world.npcs.some(n => n.id === object.ownerId) ? object.ownerId : null,
            freshWitnesses);
    }
    const here = game.worldPlaceOf(me);
    const place = world.locations.find(row => row.id === here);
    const bodiesHere = place ? theAreasOf(world, place).whereBodiesAre : new Map<string, string>();
    const area = place ? whereInThisPlaceTheyStand(world, place, me.standingIn, me.sectId).id : null;
    const nowHere = visible(game.present(me).map(n => n.id));
    for (const body of world.npcs.filter(n => n.status === 'physically_dead'
        && n.locationId === here && bodiesHere.get(n.id) === area)) {
        const newWitnesses = nowHere.filter(id => !witnessReactions(world, me.id).some(row =>
            row.observation.victimId === body.id && row.observation.wrong === 'killed'
            && row.observation.witnessId === id));
        if (newWitnesses.length === 0) continue;
        const fact = appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'opportunity',
            locationId: here, witnessIds: [me.id, ...newWitnesses], visibility: 'secret',
            actors: [{ id: me.id, name: me.name, role: 'was beside the body' }, { id: body.id, name: body.name, role: 'subject' }],
            summary: `${me.name} was beside a body.`, data: { bodyId: body.id } }));
        const evidence = seen('killed', false);
        evidence.foundBeforeActor = body.diedOnDay !== null && body.diedOnDay < world.currentDay - 1;
        register(fact, evidence, body.id, newWitnesses);
    }
    const playerSees = (fact: HistoricalFact, actorId: string, victimId: string | null): void => {
        const added = reactToWitnessedFact(world, fact, { actorId, victimId,
            witnesses: [{ id: me.id, seen: observationOf(fact) }] });
        if (added.length === 0) return;
        game.knowledge.learn({ holderId: me.id, kind: 'event', id: fact.id, name: fact.summary,
            factId: fact.id, onDay: Math.floor(world.currentDay), sourceKind: 'witnessed',
            sourceNote: 'Seen here.', statement: fact.summary, stage: 'known' });
        game.theWorldMoved();
    };
    for (const person of game.present(me)) {
        for (const body of world.npcs.filter(n => n.status === 'physically_dead'
            && n.locationId === here && bodiesHere.get(n.id) === area)) {
            if (witnessReactions(world, person.id).some(row => row.observation.witnessId === me.id
                && row.fact.data.seenWithBody === true && row.observation.victimId === body.id)) continue;
            const fact = appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'opportunity',
                locationId: here, witnessIds: [person.id, me.id], visibility: 'secret',
                actors: [{ id: person.id, name: person.name, role: 'actor' },
                    { id: body.id, name: body.name, role: 'subject' }],
                summary: `${person.name} was beside a body.`,
                data: { bodyId: body.id, seenWithBody: true,
                    foundBeforeActor: body.diedOnDay !== null && body.diedOnDay < world.currentDay - 1 } }),
            { recur: false });
            playerSees(fact, person.id, body.id);
        }
        for (const object of world.objects.filter(row => row.possessorId === person.id
            && row.ownerId !== null && row.ownerId !== person.id)) {
            const mark = object.tags.find(tag => tag.startsWith('house:'))?.slice('house:'.length);
            if (!object.knownOwnershipBy.includes(me.id)
                && !(mark !== undefined && game.knowledge.isAwareOf(me.id, 'sect', mark))) continue;
            if (witnessReactions(world, person.id).some(row => row.observation.witnessId === me.id
                && row.fact.data.seenWithEvidence === object.id)) continue;
            const fact = appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'opportunity',
                locationId: here, witnessIds: [person.id, me.id], visibility: 'secret',
                actors: [{ id: person.id, name: person.name, role: 'actor' }],
                summary: mark ? `${person.name} carried ${object.name} bearing a house mark.`
                    : `${person.name} carried ${object.name}, which ${object.ownerName} owns.`,
                data: { objectId: object.id, seenWithEvidence: object.id, markedProperty: true } }),
            { recur: false });
            playerSees(fact, person.id, world.npcs.some(n => n.id === object.ownerId) ? object.ownerId : null);
        }
    }
}

/** An account is words put to one witness in the player's current area. */
export function explainingWhatTheySaw(game: GameService, run: Run, me: Cultivator, action: PlannedAction, raw: string): Execution | null {
    const world = game.atHand;
    if (!world) return null;
    const account = action.deedAccount ?? deedAccountInWords(action.topic ?? raw);
    if (!account) return null;
    const here = game.present(me);
    const pending = witnessReactions(world, me.id).filter(row => row.observation.state === 'pending'
        && here.some(person => person.id === row.observation.witnessId));
    const target = action.target?.toLowerCase();
    const candidate = target ? pending.find(row => here.find(person => person.id === row.observation.witnessId)?.name.toLowerCase() === target)
        : pending.length === 1 ? pending[0] : undefined;
    if (!candidate) return null;
    const words = action.topic ?? raw;
    const blameName = action.blamed ?? /\bit\s+was\s+([^,.]+)$/i.exec(words)?.[1]?.trim();
    const blamed = account === 'blame' && blameName
        ? world.npcs.find(n => n.name.toLowerCase() === blameName.toLowerCase()
            && game.knowledge.isAwareOf(me.id, 'cultivator', n.id)) : null;
    const ledger = ledgerAbout(game.db as unknown as ObligationDb, me.id);
    const result = accountForWitnessedDeed(world, candidate.fact, { actorId: me.id, witnessId: candidate.observation.witnessId,
        account, words, blamedId: blamed?.id ?? null, ledger, onDay: Math.floor(run.elapsedDays),
        knows: (holderId, kind, id) => kind === 'cultivator'
            ? game.knowledge.stageOf(holderId, kind, id) === 'known'
            : game.knowledge.isAwareOf(holderId, kind, id) });
    if (!result) return null;
    const name = witnessName(game, me, candidate.observation.witnessId);
    const line = `${name} ${result.belief === 'belief' ? 'believes your account' : result.belief === 'half-belief' ? 'accepts part of your account and remains suspicious' : 'does not believe your account'}.`;
    const facts = factsForToolResult('Your account is heard.', [line]);
    const opens = [...result.opens];
    if (account === 'blame' && blamed) {
        const telling = whatATellingLandsOn({ world, tellerId: me.id, hearerId: candidate.observation.witnessId,
            hearer: world.npcs.find(n => n.id === candidate.observation.witnessId) ?? null, blamedId: blamed.id,
            onDay: Math.floor(run.elapsedDays), canPointAt: fact => fact.id === candidate.fact.id,
            heldAbout: id => ledger.find(row => row.holderId === candidate.observation.witnessId && row.triggeringEventId === id) ?? null });
        if (result.belief === 'belief' && telling.opens) opens.push(telling.opens);
        game.knowledge.learn({ holderId: candidate.observation.witnessId, kind: 'cultivator', id: blamed.id,
            name: blamed.name, onDay: Math.floor(world.currentDay), sourceKind: 'told', fromHolderId: me.id,
            sourceNote: 'Named in an account of a deed.', statement: `${me.name} says ${words}`, stage: 'named' });
    }
    for (const row of opens) writeOneObligation(game.db as unknown as ObligationWriteDb, createObligation(row));
    if (result.reportsTo) houseHearsWitnessReport(world, candidate.fact,
        witnessReactions(world, me.id).find(row => row.fact.id === candidate.fact.id
            && row.observation.witnessId === candidate.observation.witnessId)!.observation,
        game.repos.sects.getMembership(me.id)?.sectId ?? null);
    game.theWorldMoved();
    const execution = game.freeAction(run, 'tell', facts);
    execution.outcome = 'executed';
    execution.calls.push({ name: 'world.accountForWitnessedDeed', action: 'tell',
        summary: `${candidate.fact.id}: ${result.belief}, confidence ${result.confidence}; ${opens.length} obligations; report ${result.reportsTo ?? 'none'}.`, ok: true });
    return execution;
}

/** Telling the posted authority a deed you actually witnessed carries that fact to the house. */
export function reportingWhatYouSaw(game: GameService, run: Run, me: Cultivator,
    action: PlannedAction, raw: string): Execution | null {
    const world = game.atHand;
    if (!world || !(action.reportWitnessedEvent
        || /\b(?:report|killed|stole|robbed|wounded|trespassed|took the bones)\b/i.test(raw))) return null;
    const present = game.present(me);
    const recipient = action.target
        ? present.find(n => n.name.toLowerCase() === action.target!.toLowerCase())
        : present.length === 1 ? present[0] : undefined;
    if (!recipient) return null;
    const possible = world.history.facts.filter(fact => fact.witnessIds.includes(me.id))
        .map(fact => ({ fact, parties: actorAndVictimOf(fact), seen: observationOf(fact) }))
        .filter((row): row is typeof row & { parties: { actorId: string; victimId: string | null } } =>
            row.parties !== null && row.parties.actorId !== me.id && row.seen.wrong !== null);
    const named = possible.filter(row => {
        const actor = world.npcs.find(n => n.id === row.parties.actorId);
        return actor && raw.toLowerCase().includes(actor.name.toLowerCase());
    });
    if (named.some(row => !game.knowledge.isAwareOf(me.id, 'cultivator', row.parties.actorId))) return null;
    const chosen = named.length === 1 ? named[0] : named.length === 0 && possible.length === 1 ? possible[0] : null;
    if (!chosen) return null;
    if (!witnessReactions(world, chosen.parties.actorId).some(row => row.fact.id === chosen.fact.id
        && row.observation.witnessId === me.id)) {
        reactToWitnessedFact(world, chosen.fact, { actorId: chosen.parties.actorId, victimId: chosen.parties.victimId,
            witnesses: [{ id: me.id, seen: chosen.seen }] });
    }
    const reported = witnessReportsWhatTheySaw(world, chosen.fact, { witnessId: me.id,
        actorId: chosen.parties.actorId, recipientId: recipient.id,
        knows: (holderId, kind, id) => kind === 'cultivator'
            ? game.knowledge.stageOf(holderId, kind, id) === 'known'
            : game.knowledge.isAwareOf(holderId, kind, id) });
    if (!reported) return null;
    const actorHouseId = world.npcs.find(n => n.id === chosen.parties.actorId)?.factionId ?? null;
    const account = reportFromObservation(chosen.fact, reported, actorHouseId, Math.floor(world.currentDay));
    if (account) world.obligations.push(createObligation(account));
    houseHearsWitnessReport(world, chosen.fact, reported, actorHouseId);
    game.theWorldMoved();
    const facts = factsForToolResult(`${recipient.name} has your report.`, [
        `${recipient.name} heard what you witnessed.`]);
    const execution = game.freeAction(run, 'tell', facts);
    execution.outcome = 'executed';
    execution.calls.push({ name: 'world.witnessReportsWhatTheySaw', action: 'tell',
        summary: `${chosen.fact.id} reported to ${recipient.id}.`, ok: true });
    return execution;
}

/** A real paper can be named aloud; each hearer reads its size through their own ties. */
export function boastingOfThePrice(game: GameService, run: Run, me: Cultivator,
    action: PlannedAction, raw: string): Execution | null {
    const world = game.atHand;
    if (!world || !(/\b(?:boast|brag)\b[^.?!]*\b(?:price|bounty)\b/i.test(raw)
        || /\b(?:tell|say|announce)\b[^.?!]*\b(?:price|bounty)\b[^.?!]*\bon my head\b/i.test(raw))) return null;
    const audience = action.target
        ? game.present(me).filter(n => n.name.toLowerCase() === action.target!.toLowerCase())
        : game.present(me);
    if (audience.length === 0) return null;
    const paper = thePricesStanding(world, world.currentDay).find(p => p.targetId === me.id);
    if (!paper) return null;
    const fact = appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'said_in_public',
        locationId: game.worldPlaceOf(me), witnessIds: [me.id, ...audience.map(n => n.id)],
        visibility: 'regional', actors: [{ id: me.id, name: me.name, role: 'said it' }],
        summary: `${me.name} said that ${paper.posterName} put ${paper.purseStones} spirit stones on their head.`,
        data: { priceBoasted: paper.id } }), { recur: false });
    const knows = whatOneOfTheWorldsOwnPeopleKnows(world);
    const priceFact = world.history.facts.find(f => f.id === paper.id);
    const lines = audience.map(n => {
        const person = world.npcs.find(row => row.id === n.id)!;
        const hasRead = game.knowledge.isAwareOf(n.id, 'event', paper.id)
            || canPointAt(knows(n.id, 'event', paper.id));
        const reading = hasRead ? whatAPriceMeansTo(world, paper, person) : 'nothing';
        if (hasRead && person.factionId !== null
            && person.factionId === (game.repos.sects.getMembership(me.id)?.sectId ?? null)
            && paper.posterFactionId !== person.factionId && priceFact && priceFact.data.priceFaceCredited !== true) {
            theirFaceMoves(world, me.id, faceFromAPrice(paper.purseStones), world.currentDay);
            priceFact.data.priceFaceCredited = true;
        }
        if (reading === 'warning') appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay),
            kind: 'said_in_public', locationId: game.worldPlaceOf(me),
            witnessIds: [n.id, me.id], visibility: 'secret',
            actors: [{ id: n.id, name: n.name, role: 'warned' },
                { id: me.id, name: me.name, role: 'recipient' }],
            summary: `${n.name} warned ${me.name} of the ${paper.purseStones} spirit stone price.`,
            data: { priceWarning: paper.id, warnedBy: n.id } }), { recur: false, bystanders: false });
        const name = witnessName(game, me, n.id);
        return reading === 'warning' ? `${name} warned you of the price.`
            : reading === 'standing' ? `${name} counted the price in your standing with your house.`
                : reading === 'payday' ? `${name} has the strength and reason to pursue the price.`
                    : reading === 'danger' ? `${name} stands below you and knows the price.`
                        : `${name} heard your claim about the price.`;
    });
    game.theWorldMoved();
    const execution = game.freeAction(run, 'tell', factsForToolResult('You named the price on your head.', lines));
    execution.outcome = 'executed';
    execution.calls.push({ name: 'world.boastingOfThePrice', action: 'tell',
        summary: `${fact.id}: ${paper.id} named to ${audience.map(n => n.id).join(', ')}.`, ok: true });
    return execution;
}
