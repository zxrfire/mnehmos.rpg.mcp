/** A witness's reading of an event leaves the event and its consequences intact. */
import { doesTheDeedNeedExplaining, weighAnAccountOfADeed, type DeedAccount, type DeedBelief, type SeenDeed } from '../social-leverage/an-account-of-a-deed.js';
import type { AttemptInput, Party } from '../social-leverage/an-attempt-to-move-somebody.js';
import { forStream } from '../cultivation/rng.js';
import { theGroundUnderYou } from '../social-leverage/ground-trust.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { whoIsInChargeOfWhat } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { whatStandsBetween, whereAComplaintGoes, whatTheWitnessDoesAboutIt } from '../social-leverage/reporting-what-you-saw.js';
import { shapeOf, severityOfTheWrong } from '../social-leverage/what-somebody-does-about-being-wronged.js';
import { createObligation, type ObligationInput, type ObligationRecord } from '../social/grudges.js';
import { whoHoldsTheGround } from './ground-holder.js';
import type { HistoricalFact } from './history.js';
import { relationshipWith, upsertRelationship, type NpcRecord } from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import type { WorldState } from './world-state.js';
import { AGAINST_THEIR_OWN } from '../social-leverage/what-a-house-does-when-it-catches-you.js';
import { whatOneOfTheWorldsOwnPeopleKnows,
    whatOneOfTheWorldsOwnPeopleKnowsFromWitnessIndex } from './what-one-of-the-worlds-own-people-knows.js';
import { canPointAt } from '../social/discovery.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { areAtWarWithEachOther } from './war-melee.js';
import { creditMerit, whatServiceIsWorth } from './what-a-house-counts-in-somebodys-favour.js';
import { theirFaceMoves, whatWinningIsWorth } from './what-a-face-is-worth.js';
import type { PersonBounty } from './a-house-puts-a-price-on-somebody.js';
import { A_PURSE_WORTH_TAKING, whatAPriceIsWorthTo } from './why-one-cultivator-kills-another.js';
import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { reticenceOf } from '../social-leverage/emotional-reticence.js';
import { evidenceKey, factsWithData, recentWitnessFacts, recordWitnessObservations,
    witnessIndexFor } from './witness-reaction-index.js';

export interface WitnessReaction extends SeenDeed {
    witnessId: string;
    actorId: string;
    victimId: string | null;
    state: 'ignored' | 'remembered' | 'pending' | 'reported' | 'reported_for' | DeedBelief;
    reportedTo?: string;
    reportHouseId?: string;
    account?: DeedAccount;
    words?: string;
    blamedId?: string | null;
    regard?: 'gratitude' | 'credit';
}

interface WitnessLookup {
    npcAt: ReadonlyMap<string, number>;
    livingAt: ReadonlyMap<string, readonly NpcRecord[]>;
    rollByHouse: ReadonlyMap<string, readonly NpcRecord[]>;
}

function npcById(world: WorldState, id: string | null | undefined,
    lookup?: WitnessLookup): NpcRecord | undefined {
    if (!id) return undefined;
    const at = lookup?.npcAt.get(id);
    return at === undefined ? lookup ? undefined : world.npcs.find(n => n.id === id) : world.npcs[at];
}

function npcIndex(world: WorldState, id: string, lookup?: WitnessLookup): number {
    return lookup ? lookup.npcAt.get(id) ?? -1 : world.npcs.findIndex(n => n.id === id);
}

function observations(fact: HistoricalFact): WitnessReaction[] {
    return typeof fact.data.witnessReactions === 'string'
        ? JSON.parse(fact.data.witnessReactions) as WitnessReaction[] : [];
}

function save(world: WorldState, fact: HistoricalFact, rows: readonly WitnessReaction[]): void {
    fact.data.witnessReactions = JSON.stringify(rows);
    recordWitnessObservations(world, fact, rows);
}

function worldKnowledgeGate(world: WorldState): (holderId: string, kind: 'cultivator' | 'sect', id: string) => boolean {
    let heldIndex: ReturnType<typeof witnessIndexFor> | null = null;
    let read: ReturnType<typeof whatOneOfTheWorldsOwnPeopleKnowsFromWitnessIndex> | null = null;
    return (holderId, kind, id) => {
        const index = witnessIndexFor(world);
        if (heldIndex !== index) {
            heldIndex = index;
            read = whatOneOfTheWorldsOwnPeopleKnowsFromWitnessIndex(world, index);
        }
        const stage = read!(holderId, kind, id);
        return kind === 'cultivator' ? stage === 'known' : canPointAt(stage);
    };
}

function aWitnessTellsSomeoneHere(world: WorldState, fact: HistoricalFact,
    seen: WitnessReaction, lookup?: WitnessLookup): void {
    if (fact.data.toldOfWitnessedFact !== undefined) return;
    const witness = npcById(world, seen.witnessId, lookup);
    const place = world.locations.find(l => l.id === fact.locationId);
    if (!witness || !place || witness.locationId !== place.id) return;
    const areas = theAreasOf(world, place).whereIs;
    const listener = (lookup ? lookup.livingAt.get(place.id) ?? [] : world.npcs).find(n => n.status === 'alive' && n.id !== witness.id
        && n.id !== seen.actorId && n.locationId === place.id
        && areas.get(n.id) === areas.get(witness.id));
    if (!listener || !forStream(world.seed, 'witness-tells-somebody-here', fact.id, witness.id)
        .chance(Math.max(0.05, Math.min(0.9, 0.5 - reticenceOf(witness.id) * 0.3)))) return;
    appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'said_in_public',
        locationId: place.id, witnessIds: [witness.id, listener.id], visibility: 'regional',
        factionIds: fact.factionIds,
        actors: [{ id: witness.id, name: witness.name, role: 'said it' },
            { id: seen.actorId, name: npcById(world, seen.actorId, lookup)?.name ?? 'someone', role: 'named' }],
        summary: `${witness.name} told ${listener.name} what they saw: ${fact.summary}`,
        data: { toldOfWitnessedFact: fact.id, fromWitness: witness.id,
            ...(seen.state === 'half-belief' ? { accountOnlyPartlyBelieved: true } : {}) } }),
    { recur: false, bystanders: false });
}

function party(world: WorldState, npc: NpcRecord): Party {
    return { id: npc.id, name: npc.name, ordinal: npc.cultivation.realmOrdinal,
        factionId: npc.factionId, alignment: world.factions.find(h => h.id === npc.factionId)?.alignment ?? null };
}

function trustFor(world: WorldState, actor: NpcRecord, witness: NpcRecord,
    fact: HistoricalFact, ledger: readonly ObligationRecord[]): AttemptInput {
    const standing = relationshipWith(witness, actor.id)?.standing ?? 0;
    return { actor: party(world, actor), subject: party(world, witness), onDay: world.currentDay,
        ask: 'a_courtesy', theirTie: { active: true, strength: standing }, ledger,
        rng: forStream(world.seed, 'witness-account', fact.id, actor.id, witness.id),
        where: theGroundUnderYou(whoHoldsTheGround(world.locations, fact.locationId)) };
}

function authorityKnownTo(world: WorldState, fact: HistoricalFact, witness: NpcRecord, actorId: string,
    knows: (holderId: string, kind: 'cultivator' | 'sect', id: string) => boolean,
    preferredHouseId?: string | null, lookup?: WitnessLookup): { houseId: string; toId: string } | null {
    const ground = whoHoldsTheGround(world.locations, fact.locationId);
    const postedHere = (lookup ? lookup.livingAt.get(fact.locationId ?? '') ?? [] : world.npcs).filter(n => n.status === 'alive' && n.factionId !== null
        && n.locationId === fact.locationId && n.activity?.kind === 'stationed'
        && knows(witness.id, 'cultivator', n.id));
    const houseId = preferredHouseId ?? ground.holderFactionId ?? postedHere[0]?.factionId ?? null;
    if (!houseId) return null;
    const posted = postedHere.find(n => n.factionId === houseId);
    if (posted) return { houseId, toId: posted.id };
    if (!knows(witness.id, 'sect', houseId)) return null;
    const house = world.factions.find(h => h.id === houseId);
    if (!house || house.seatLocationId !== fact.locationId) return null;
    const roll = (lookup ? lookup.rollByHouse.get(houseId) ?? [] : world.npcs).filter(n => n.status === 'alive' && n.factionId === houseId);
    const portfolios = whoIsInChargeOfWhat({ rooms: theRoomsThisHouseHas(world.locations, houseId),
        roll: roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })), rankCount: house.ranks.length });
    const head = [...roll].sort((a, b) => b.factionRankIndex - a.factionRankIndex)[0];
    const toId = whereAComplaintGoes({ portfolios, aboutId: actorId, headId: head?.id ?? null });
    return toId && knows(witness.id, 'cultivator', toId) ? { houseId, toId } : null;
}

function reportingDecision(world: WorldState, fact: HistoricalFact, actor: NpcRecord,
    witness: NpcRecord, seen: SeenDeed, ledger: readonly ObligationRecord[],
    knows: (holderId: string, kind: 'cultivator' | 'sect', id: string) => boolean,
    forOwnSide = false, lookup?: WitnessLookup): { houseId: string; toId: string } | null {
    const authority = authorityKnownTo(world, fact, witness, actor.id, knows,
        forOwnSide ? witness.factionId : undefined, lookup);
    if (!authority || actor.id === authority.toId) return null;
    const between = whatStandsBetween(ledger, witness.id, actor.id);
    const report = whatTheWitnessDoesAboutIt({ witness: { id: witness.id, name: witness.name,
        standing: relationshipWith(witness, actor.id)?.standing ?? null, role: 'peer' },
        ...between, theyOweYou: seen.manyHarmed ? 0 : between.theyOweYou,
        theyHoldAboutYou: between.theyHoldAboutYou + (seen.manyHarmed ? 1 : 0),
        serviceToTheirHouse: forOwnSide,
        toId: authority.toId, rungsAbove: actor.cultivation.realmOrdinal - witness.cultivation.realmOrdinal });
    return report.does === 'reports' ? authority : null;
}

/** One entry point for an act witnessed directly or somebody found at its aftermath. */
export function reactToWitnessedFact(world: WorldState, fact: HistoricalFact, input: {
    actorId: string;
    actorHouseId?: string | null;
    victimId: string | null;
    witnesses: readonly { id: string; seen: SeenDeed }[];
    ledger?: readonly ObligationRecord[];
    knows?: (holderId: string, kind: 'cultivator' | 'sect', id: string) => boolean;
    lookup?: WitnessLookup;
}): WitnessReaction[] {
    const actor = npcById(world, input.actorId, input.lookup);
    if (!actor) return [];
    const actorHouseId = input.actorHouseId ?? actor.factionId;
    const rows = observations(fact);
    const added: WitnessReaction[] = [];
    const victim = npcById(world, input.victimId, input.lookup);
    for (const seeing of input.witnesses) {
        const witness = npcById(world, seeing.id, input.lookup);
        if (witness?.status !== 'alive') continue;
        if (!witness || witness.id === actor.id || rows.some(row => row.witnessId === witness.id && row.actorId === actor.id)) continue;
        const victimTie = input.victimId === null ? null : relationshipWith(witness, input.victimId);
        const carriesForVictim = witness.id === input.victimId
            || (victimTie !== null && victimTie.standing > 0 && ['kin', 'spouse', 'parent', 'child', 'master', 'disciple', 'ally'].includes(victimTie.kind))
            || (victim?.factionId !== null && victim?.factionId === witness.factionId);
        const forOwnSide = seeing.seen.wrong === 'killed' && seeing.seen.sawAct
            && actorHouseId !== null && actorHouseId === witness.factionId
            && victim !== undefined && victim.factionId !== null && victim.factionId !== actorHouseId
            && areAtWarWithEachOther(world, actorHouseId, victim.factionId);
        const helped = seeing.seen.wrong === null && fact.actors.some(a => a.id === actor.id
            && (a.role === 'helper' || a.role === 'rescuer'));
        const gratitude = helped && (witness.id === input.victimId || carriesForVictim);
        const credit = forOwnSide || helped && !gratitude && (
            witness.factionId !== null && witness.factionId === actor.factionId
            || world.factions.find(h => h.id === witness.factionId)?.alignment === 'righteous'
            || (relationshipWith(witness, actor.id)?.standing ?? 0) > 0);
        const needs = doesTheDeedNeedExplaining({
            trust: trustFor(world, actor, witness, fact, input.ledger ?? world.obligations),
            seen: seeing.seen, carriesForVictim, forOwnSide,
            ownsGround: seeing.seen.wrong === 'trespassed'
                && whoHoldsTheGround(world.locations, fact.locationId).holderFactionId === witness.factionId
        });
        const knows = input.knows ?? worldKnowledgeGate(world);
        const report = (forOwnSide || needs && seeing.seen.manyHarmed) && !witness.tags.includes('the-player')
            ? reportingDecision(world, fact, actor, witness, seeing.seen,
                input.ledger ?? world.obligations, knows, forOwnSide, input.lookup) : null;
        const row: WitnessReaction = { ...seeing.seen, witnessId: witness.id, actorId: actor.id,
            victimId: input.victimId, state: report ? forOwnSide ? 'reported_for' : 'reported' : needs ? 'pending'
                : seeing.seen.wrong === null ? 'remembered' : 'ignored',
            ...(gratitude ? { regard: 'gratitude' as const } : credit ? { regard: 'credit' as const } : {}),
            ...(report ? { reportHouseId: report.houseId, reportedTo: report.toId } : {}) };
        rows.push(row);
        added.push(row);
        if (gratitude || credit) {
            const at = npcIndex(world, witness.id, input.lookup);
            const tie = relationshipWith(witness, actor.id);
            const changedTie = { targetId: actor.id, targetName: actor.name,
                kind: tie?.kind ?? 'acquaintance' as const, standing: Math.min(1, (tie?.standing ?? 0)
                    + (gratitude ? 0.15 : 0.05)), note: `${witness.name} saw ${fact.summary}`,
                factIds: [fact.id], inheritedFromId: null };
            world.npcs[at] = upsertRelationship(witness, changedTie, world.currentDay);
            andTheOtherEnd(world.npcs, world.npcs[at]!, changedTie, world.currentDay);
        }
        if (!fact.witnessIds.includes(witness.id)) fact.witnessIds.push(witness.id);
    }
    if (added.length > 0) save(world, fact, rows);
    for (const row of added) if (row.state === 'remembered') aWitnessTellsSomeoneHere(world, fact, row, input.lookup);
    return added;
}

/** The player can choose to take first hand evidence to a known local authority. */
export function witnessReportsWhatTheySaw(world: WorldState, fact: HistoricalFact, input: {
    witnessId: string; actorId: string; recipientId: string;
    knows: (holderId: string, kind: 'cultivator' | 'sect', id: string) => boolean;
}): WitnessReaction | null {
    const witness = world.npcs.find(n => n.id === input.witnessId);
    if (!witness || !fact.witnessIds.includes(input.witnessId)) return null;
    const rows = observations(fact);
    const seen = rows.find(row => row.witnessId === input.witnessId && row.actorId === input.actorId);
    const actor = world.npcs.find(n => n.id === input.actorId);
    const victim = world.npcs.find(n => n.id === seen?.victimId);
    const forOwnSide = actor?.factionId !== null && actor?.factionId === witness.factionId
        && victim !== undefined && victim.factionId !== null && victim.factionId !== actor?.factionId
        && areAtWarWithEachOther(world, actor!.factionId!, victim.factionId!);
    const authority = authorityKnownTo(world, fact, witness, input.actorId, input.knows,
        forOwnSide ? witness.factionId : undefined);
    if (!authority || authority.toId !== input.recipientId) return null;
    if (!seen || seen.state === 'reported' || seen.state === 'reported_for' || seen.wrong === null) return null;
    seen.state = forOwnSide ? 'reported_for' : 'reported';
    seen.reportHouseId = authority.houseId;
    seen.reportedTo = authority.toId;
    save(world, fact, rows);
    return seen;
}

/** A house account exists only after a witness actually reaches its person. */
export function reportFromObservation(fact: HistoricalFact, seen: WitnessReaction,
    actorHouseId: string | null, onDay: number): ObligationInput | null {
    if (!seen.reportHouseId || !seen.reportedTo || seen.wrong === null || seen.state === 'reported_for') return null;
    const wrong = seen.wrong === 'bones' ? 'violated' : seen.wrong;
    return { kind: 'grudge', holderId: seen.reportHouseId, subjectId: seen.actorId,
        cause: seen.wrong === 'bones' ? 'harvested' : shapeOf(wrong).cause,
        severity: seen.manyHarmed ? 'grave' : seen.wrong === 'bones' ? 'serious' : severityOfTheWrong(wrong),
        onDay, triggeringEventId: fact.id, description: `A witness reported ${fact.summary}`,
        fromBelief: !seen.sawAct, participants: [seen.witnessId, seen.reportedTo],
        tags: ['reported_by_a_witness', ...(actorHouseId === seen.reportHouseId ? [AGAINST_THEIR_OWN] : [])] };
}

/** A report reaches a real person; the house may also warn people on its ground. */
export function houseHearsWitnessReport(world: WorldState, fact: HistoricalFact,
    seen: Pick<WitnessReaction, 'reportHouseId' | 'reportedTo' | 'witnessId' | 'manyHarmed'>,
    actorHouseId: string | null, onDay = world.currentDay,
    lookup?: WitnessLookup): HistoricalFact | null {
    if (!seen.reportHouseId || !seen.reportedTo) return null;
    const index = witnessIndexFor(world);
    const previous = index.reports.get(fact.id)?.get(seen.witnessId);
    if (previous) return previous;
    const house = world.factions.find(h => h.id === seen.reportHouseId);
    const witness = npcById(world, seen.witnessId, lookup);
    const recipient = npcById(world, seen.reportedTo, lookup);
    if (!house || !witness || !recipient) return null;
    const reportFor = 'state' in seen && seen.state === 'reported_for';
    const actorId = reportFor && 'actorId' in seen ? String(seen.actorId) : null;
    const actor = actorId ? npcById(world, actorId, lookup) : null;
    const victimId = reportFor && 'victimId' in seen ? String(seen.victimId) : null;
    const victim = victimId ? npcById(world, victimId, lookup) : null;
    if (reportFor && actor && victim && actorHouseId === house.id
        && victim.factionId !== null && areAtWarWithEachOther(world, house.id, victim.factionId)) {
        const at = npcIndex(world, actor.id, lookup);
        world.npcs[at] = creditMerit(actor, Math.round(whatServiceIsWorth(actor.cultivation.realmOrdinal,
            seen.manyHarmed ? 90 : 30)));
        theirFaceMoves(world, actor.id, whatWinningIsWorth({ winnerOrdinal: actor.cultivation.realmOrdinal,
            loserOrdinal: victim.cultivation.realmOrdinal, witnesses: fact.witnessIds.length }), onDay);
    }
    const warning = !reportFor && seen.manyHarmed === true && actorHouseId !== house.id
        && (actorHouseId === null || (house.standing[actorHouseId] ?? 0) <= 0)
        && !index.warnings.has(fact.id);
    return appendWorldFact(world, makeFact({ day: Math.floor(onDay), kind: 'said_in_public',
        locationId: recipient.locationId, factionIds: [house.id],
        witnessIds: [witness.id, recipient.id], visibility: warning ? 'regional' : 'faction',
        actors: [{ id: witness.id, name: witness.name, role: 'witness' },
            { id: recipient.id, name: recipient.name, role: 'recipient' }],
        summary: reportFor && actor ? `${house.name} credited ${actor.name} for ${fact.summary}`
            : warning ? `${house.name} warned of ${fact.summary}`
                : `${witness.name} reported ${fact.summary} to ${recipient.name}.`,
        data: { witnessReport: fact.id, reportedBy: witness.id, houseWarning: warning,
            ...(reportFor ? { warCreditFor: actorId } : {}) } }),
    { recur: false, bystanders: false });
}

/** Stored observations, newest first; resolved accounts remain available to challenge. */
export function witnessReactions(world: WorldState, actorId?: string, witnessId?: string): { fact: HistoricalFact; observation: WitnessReaction }[] {
    const index = witnessIndexFor(world);
    const facts = witnessId === undefined
        ? actorId === undefined ? [...index.observed] : (index.byActor.get(actorId) ?? [])
        : [...index.presentAt.get(witnessId) ?? []].map(id => index.byId.get(id)!)
            .filter(fact => index.observed.has(fact));
    return facts.sort((a, b) => (index.order.get(a.id) ?? 0) - (index.order.get(b.id) ?? 0))
        .flatMap(fact => observations(fact)
        .filter(row => (actorId === undefined || row.actorId === actorId)
            && (witnessId === undefined || row.witnessId === witnessId))
        .map(observation => ({ fact, observation }))).reverse();
}

/** A posted price is read through the same ties and appetite as the witnessed deed. */
export function whatAPriceMeansTo(world: WorldState, paper: Pick<PersonBounty,
    'targetId' | 'posterFactionId' | 'purseStones'>, observer: NpcRecord):
    'standing' | 'warning' | 'payday' | 'danger' | 'nothing' {
    const target = world.npcs.find(n => n.id === paper.targetId);
    if (!target || observer.id === target.id) return 'nothing';
    const tie = relationshipWith(observer, target.id)?.standing ?? 0;
    if (tie >= 0.4) return 'warning';
    if (target.factionId !== null && observer.factionId === target.factionId
        && paper.posterFactionId !== target.factionId) return 'standing';
    if (observer.factionId === null
        && observer.cultivation.realmOrdinal >= target.cultivation.realmOrdinal
        && openHandednessOf(observer.id) < 0
        && whatAPriceIsWorthTo(observer, paper.purseStones) > 0) return 'payday';
    if (observer.cultivation.realmOrdinal < target.cultivation.realmOrdinal) return 'danger';
    return 'nothing';
}

/** The purse measures the public weight of the price in ordinary wins. */
export function faceFromAPrice(purseStones: number): number {
    return Math.log2(1 + Math.max(0, purseStones) / A_PURSE_WORTH_TAKING);
}

/** News reaches each person on the ordinary distance and standing clock. */
export function peopleReadPricesTheyHaveHeardOf(world: WorldState, day: number): void {
    const knows = whatOneOfTheWorldsOwnPeopleKnows(world);
    for (const fact of recentWitnessFacts(witnessIndexFor(world), day).filter(row => row.kind === 'bounty_posted'
        && row.day <= day && row.day >= day - 365)) {
        const targetId = typeof fact.data.priceOn === 'string' ? fact.data.priceOn : null;
        const purse = Number(fact.data.purseStones ?? 0);
        if (!targetId || purse <= 0) continue;
        const paper = { targetId, posterFactionId: fact.factionIds[0] ?? null, purseStones: purse };
        const target = world.npcs.find(n => n.id === targetId);
        if (!target) continue;
        for (const observer of world.npcs.filter(n => n.status === 'alive' && n.id !== targetId)) {
            if (!canPointAt(knows(observer.id, 'event', fact.id))) continue;
            const reading = whatAPriceMeansTo(world, paper, observer);
            if (observer.factionId !== null && observer.factionId === target.factionId
                && paper.posterFactionId !== target.factionId && fact.data.priceFaceCredited !== true) {
                theirFaceMoves(world, targetId, faceFromAPrice(purse), day);
                fact.data.priceFaceCredited = true;
            }
            if (reading === 'warning' && observer.locationId === target.locationId
                && !factsWithData(world, 'priceWarning').some(row => row.data.priceWarning === fact.id && row.data.warnedBy === observer.id)) {
                appendWorldFact(world, makeFact({ day, kind: 'said_in_public', locationId: observer.locationId,
                    witnessIds: [observer.id, target.id], visibility: 'secret',
                    actors: [{ id: observer.id, name: observer.name, role: 'warned' },
                        { id: target.id, name: target.name, role: 'recipient' }],
                    summary: `${observer.name} told ${target.name} of a price of ${purse} spirit stones on their head.`,
                    data: { priceWarning: fact.id, warnedBy: observer.id } }),
                { recur: false, bystanders: false });
            }
        }
    }
}

/** Interpret the one historical row every witness already holds. */
export function observationOf(fact: HistoricalFact): SeenDeed {
    const actor = fact.actors.find(a => a.role === 'killer' || a.role === 'attacker');
    const wrong: SeenDeed['wrong'] = fact.data.bones ? 'bones'
        : fact.data.seenWithBody === true ? 'killed'
        : fact.data.furnace === true && fact.data.type === 'coerced' ? 'violated'
        : fact.data.seenWithEvidence !== undefined || fact.data.deedWrong === 'robbed'
            || fact.data.wrong === 'robbed' ? 'robbed'
        : fact.data.deedWrong === 'trespassed' ? 'trespassed'
        : actor?.role === 'killer' || fact.data.died === true && fact.kind === 'death' ? 'killed'
        : actor?.role === 'attacker' && fact.kind === 'injury' ? 'wounded' : null;
    return { wrong, sawAct: fact.data.seenWithBody !== true && fact.data.seenWithEvidence === undefined,
        sawFirstAttack: fact.data.selfDefence === true,
        foundBeforeActor: fact.data.foundBeforeActor === true, sawPermission: fact.data.permission === true,
        recognisedProperty: fact.data.markedProperty === true, bonesTaken: wrong === 'bones',
        competingAccount: fact.claimedOutcomes.length > 1,
        manyHarmed: wrong !== null && (Number(fact.data.harmedCount ?? 0) >= 3
            || fact.kind === 'war' && fact.magnitude >= 0.7) };
}

export function actorAndVictimOf(fact: HistoricalFact): { actorId: string; victimId: string | null } | null {
    const actor = fact.actors.find(a => ['killer', 'attacker', 'actor', 'taker', 'heir', 'rescuer', 'helper'].includes(a.role))
        ?? fact.actors.find(a => !['victim', 'defender', 'subject', 'named', 'witness', 'recipient'].includes(a.role));
    if (!actor) return null;
    const victim = fact.actors.find(a => ['victim', 'defender', 'subject', 'it was done to'].includes(a.role));
    return { actorId: actor.id, victimId: victim?.id ?? null };
}

/** Both callers write the returned obligations into the ledger they own. */
export function accountForWitnessedDeed(world: WorldState, fact: HistoricalFact, input: {
    actorId: string; witnessId: string; account: DeedAccount; words: string;
    blamedId?: string | null; ledger?: readonly ObligationRecord[]; onDay?: number;
    knows?: (holderId: string, kind: 'cultivator' | 'sect', id: string) => boolean;
    lookup?: WitnessLookup;
}): { belief: DeedBelief; confidence: number; opens: ObligationInput[]; reportsTo: string | null } | null {
    const rows = observations(fact);
    const seen = rows.find(row => row.actorId === input.actorId && row.witnessId === input.witnessId && row.state === 'pending');
    const actor = npcById(world, input.actorId, input.lookup);
    const witness = npcById(world, input.witnessId, input.lookup);
    if (!seen || !actor || !witness) return null;
    const ledger = input.ledger ?? world.obligations;
    const weighed = weighAnAccountOfADeed({ trust: trustFor(world, actor, witness, fact, ledger), seen, account: input.account });
    Object.assign(seen, { state: weighed.belief, account: input.account, words: input.words, blamedId: input.blamedId ?? null });
    save(world, fact, rows);
    if (weighed.belief === 'half-belief') aWitnessTellsSomeoneHere(world, fact, seen, input.lookup);
    const at = npcIndex(world, witness.id, input.lookup);
    // A telling may have appended a fact onto the witness since the account began.
    const current = npcById(world, witness.id, input.lookup)!;
    const standing = relationshipWith(current, actor.id)?.standing ?? 0;
    if (weighed.belief !== 'belief') {
        const changedTie = { targetId: actor.id, targetName: actor.name,
            kind: weighed.belief === 'disbelief' ? 'enemy' as const : 'acquaintance' as const,
            standing: Math.max(-1, standing - (weighed.belief === 'disbelief' ? 0.3 : 0.1)),
            note: `${actor.name}'s account of ${fact.id}: ${weighed.belief}.`,
            factIds: [fact.id], inheritedFromId: null };
        world.npcs[at] = upsertRelationship(current, changedTie, input.onDay ?? world.currentDay);
        andTheOtherEnd(world.npcs, world.npcs[at]!, changedTie, input.onDay ?? world.currentDay);
    }
    const opens: ObligationInput[] = [];
    let reportsTo: string | null = null;
    if (weighed.responsible && seen.wrong !== null) {
        const wrong = seen.wrong === 'bones' ? 'violated' : seen.wrong;
        const onDay = input.onDay ?? world.currentDay;
        const row: ObligationInput = { kind: 'grudge', holderId: witness.id, subjectId: actor.id,
            cause: seen.wrong === 'bones' ? 'harvested' : shapeOf(wrong).cause,
            severity: seen.wrong === 'bones' ? 'serious' : severityOfTheWrong(wrong), onDay,
            triggeringEventId: fact.id, description: `${witness.name} holds ${actor.name} responsible for ${fact.summary}`,
            fromBelief: !seen.sawAct, participants: [witness.id], tags: ['witnessed_deed'] };
        if (!ledger.some(held => held.status === 'open' && held.holderId === witness.id
            && held.subjectId === actor.id && held.triggeringEventId === fact.id)) opens.push(row);
        const knows = input.knows ?? worldKnowledgeGate(world);
        const report = reportingDecision(world, fact, actor, witness, seen,
            [...ledger, ...opens.map(createObligation)], knows, false, input.lookup);
        if (report) {
            reportsTo = report.toId;
            seen.reportHouseId = report.houseId;
            seen.reportedTo = report.toId;
            save(world, fact, rows);
            const account = reportFromObservation(fact, seen, actor.factionId, onDay);
            if (account) opens.push(account);
        }
    }
    return { belief: weighed.belief, confidence: weighed.confidence, opens, reportsTo };
}

/** The world spends a bounded number of witnessed incidents each year. */
export function witnessReactionsThisYear(world: WorldState, day: number,
    visiting?: { id: string; placeId: string }): void {
    type Body = WorldState['npcs'][number];
    type Goods = WorldState['objects'][number];
    type Incident = { kind: 'body'; body: Body; placeId: string }
        | { kind: 'goods'; goods: Goods; placeId: string }
        | { kind: 'fact'; fact: HistoricalFact; war: boolean };

    let index = witnessIndexFor(world);
    const people = new Map(world.npcs.map(n => [n.id, n]));
    const npcAt = new Map(world.npcs.map((n, at) => [n.id, at]));
    const places = new Map(world.locations.map(place => [place.id, place]));
    const livingAt = new Map<string, Body[]>();
    const rollByHouse = new Map<string, Body[]>();
    const bodiesAt = new Map<string, Body[]>();
    const goodsAt = new Map<string, Goods[]>();
    const playerIds = new Set<string>();
    const playerPlaces = new Set<string>();
    if (visiting) {
        playerIds.add(visiting.id);
        playerPlaces.add(visiting.placeId);
    }
    for (const person of world.npcs) {
        if (person.tags.includes('the-player')) {
            playerIds.add(person.id);
            if (person.locationId) playerPlaces.add(person.locationId);
        }
        if (person.status === 'alive' && person.factionId !== null) {
            const roll = rollByHouse.get(person.factionId) ?? [];
            roll.push(person);
            rollByHouse.set(person.factionId, roll);
        }
        if (!person.locationId) continue;
        if (person.status === 'alive') {
            const here = livingAt.get(person.locationId) ?? [];
            here.push(person);
            livingAt.set(person.locationId, here);
        } else if (person.status === 'physically_dead' && person.diedOnDay !== null
            && person.diedOnDay >= day - 365) {
            const here = bodiesAt.get(person.locationId) ?? [];
            here.push(person);
            bodiesAt.set(person.locationId, here);
        }
    }
    const lookup: WitnessLookup = { npcAt, livingAt, rollByHouse };
    for (const goods of world.objects) {
        if (!goods.possessorId || !(goods.ownerId !== null && goods.ownerId !== goods.possessorId
            || goods.tags.some(tag => tag.startsWith('house:')))) continue;
        const holder = people.get(goods.possessorId);
        if (!holder?.locationId) continue;
        const here = goodsAt.get(holder.locationId) ?? [];
        here.push(goods);
        goodsAt.set(holder.locationId, here);
    }
    const areaByPlace = new Map<string, ReturnType<typeof theAreasOf>>();
    const areaAt = (placeId: string): ReturnType<typeof theAreasOf> | null => {
        let area = areaByPlace.get(placeId);
        if (area) return area;
        const place = places.get(placeId);
        if (!place) return null;
        area = theAreasOf(world, place);
        areaByPlace.set(placeId, area);
        return area;
    };
    let knowledgeIndex: ReturnType<typeof witnessIndexFor> | null = null;
    let knowledge: ReturnType<typeof whatOneOfTheWorldsOwnPeopleKnowsFromWitnessIndex> | null = null;
    const knows = (holderId: string, kind: 'cultivator' | 'sect', id: string): boolean => {
        const current = witnessIndexFor(world);
        if (knowledgeIndex !== current) {
            knowledge = whatOneOfTheWorldsOwnPeopleKnowsFromWitnessIndex(world, current);
            knowledgeIndex = current;
        }
        const stage = knowledge!(holderId, kind, id);
        return kind === 'cultivator' ? stage === 'known' : canPointAt(stage);
    };
    const emitted: HistoricalFact[] = [];
    const emitBody = (body: Body, actor: Body, witnesses: readonly Body[], placeId: string): void => {
        if (witnesses.length === 0) return;
        const fact = appendWorldFact(world, makeFact({ day, kind: 'opportunity', locationId: placeId,
            witnessIds: [actor.id, ...witnesses.map(n => n.id)], visibility: 'secret',
            actors: [{ id: actor.id, name: actor.name, role: 'actor' },
                { id: body.id, name: body.name, role: 'subject' }],
            summary: `${actor.name} was beside ${body.name}'s body.`,
            data: { seenWithBody: true, bodyId: body.id,
                foundBeforeActor: body.diedOnDay !== null && body.diedOnDay < day - 1 } }),
        { recur: false, bystanders: false });
        emitted.push(fact);
        for (const witness of witnesses) index.seenBody.add(evidenceKey(body.id, actor.id, witness.id));
    };
    const emitGoods = (goods: Goods, actor: Body, witnesses: readonly Body[], placeId: string): void => {
        if (witnesses.length === 0) return;
        const mark = goods.tags.find(tag => tag.startsWith('house:'))?.slice(6);
        const fact = appendWorldFact(world, makeFact({ day, kind: 'opportunity', locationId: placeId,
            witnessIds: [actor.id, ...witnesses.map(n => n.id)], visibility: 'secret',
            actors: [{ id: actor.id, name: actor.name, role: 'actor' }],
            summary: mark ? `${actor.name} carried ${goods.name} bearing a house mark.`
                : `${actor.name} carried ${goods.name}, which ${goods.ownerName} owns.`,
            data: { seenWithEvidence: goods.id, objectId: goods.id, markedProperty: true } }),
        { recur: false, bystanders: false });
        emitted.push(fact);
        for (const witness of witnesses) index.seenEvidence.add(evidenceKey(goods.id, actor.id, witness.id));
    };
    const goodsKnownTo = (goods: Goods, witness: Body): boolean => {
        const mark = goods.tags.find(tag => tag.startsWith('house:'))?.slice(6);
        return goods.knownOwnershipBy.includes(witness.id)
            || mark !== undefined && knows(witness.id, 'sect', mark);
    };

    for (const placeId of playerPlaces) {
        const area = areaAt(placeId);
        if (!area) continue;
        const living = livingAt.get(placeId) ?? [];
        for (const actor of living) {
            const here = area.whereIs.get(actor.id);
            const observers = living.filter(n => n.id !== actor.id && area.whereIs.get(n.id) === here);
            if (observers.length === 0) continue;
            for (const body of bodiesAt.get(placeId) ?? []) {
                if (area.whereBodiesAre.get(body.id) !== here) continue;
                emitBody(body, actor, observers.filter(n =>
                    !index.seenBody.has(evidenceKey(body.id, actor.id, n.id))), placeId);
            }
            for (const goods of goodsAt.get(placeId) ?? []) {
                if (goods.possessorId !== actor.id) continue;
                emitGoods(goods, actor, observers.filter(n => goodsKnownTo(goods, n)
                    && !index.seenEvidence.has(evidenceKey(goods.id, actor.id, n.id))), placeId);
            }
        }
    }

    index = witnessIndexFor(world);
    const recent = recentWitnessFacts(index, day);
    const touchesPlayer = (fact: HistoricalFact): boolean =>
        fact.locationId !== null && playerPlaces.has(fact.locationId)
        || fact.actors.some(actor => playerIds.has(actor.id))
        || fact.witnessIds.some(id => playerIds.has(id));
    const exact: HistoricalFact[] = [];
    const incidents: Incident[] = [];
    for (const fact of recent) {
        if (fact.data.witnessReactions !== undefined && !touchesPlayer(fact)) continue;
        if (touchesPlayer(fact)) exact.push(fact);
        else if (fact.kind === 'war' && Number(fact.data.fell ?? 0) >= 3) {
            incidents.push({ kind: 'fact', fact, war: true });
        } else if (fact.witnessIds.length > 0 && actorAndVictimOf(fact)) {
            incidents.push({ kind: 'fact', fact, war: false });
        }
    }
    for (const [placeId, bodies] of bodiesAt) {
        if (playerPlaces.has(placeId) || (livingAt.get(placeId)?.length ?? 0) < 2) continue;
        for (const body of bodies) incidents.push({ kind: 'body', body, placeId });
    }
    for (const [placeId, goods] of goodsAt) {
        if (playerPlaces.has(placeId) || (livingAt.get(placeId)?.length ?? 0) < 2) continue;
        for (const held of goods) incidents.push({ kind: 'goods', goods: held, placeId });
    }
    const bodyCount = incidents.filter(row => row.kind === 'body').length;
    const goodsCount = incidents.filter(row => row.kind === 'goods').length;
    const warCount = incidents.filter(row => row.kind === 'fact' && row.war).length;
    const otherCount = incidents.filter(row => row.kind === 'fact' && !row.war).length;
    const rate = Math.min(6, bodyCount * 0.15 + goodsCount * 0.08
        + warCount * 0.75 + otherCount * 0.01);
    const rng = forStream(world.seed, 'background-witnesses', Math.floor(day / 365));
    const draw = Math.min(incidents.length, Math.floor(rate) + (rng.chance(rate % 1) ? 1 : 0));
    const chosen: HistoricalFact[] = [];
    const weightOf = (row: Incident): number => row.kind === 'fact'
        ? row.war ? 12 : 1 : row.kind === 'body' ? 8 : 5;
    for (let i = 0; i < draw; i++) {
        const total = incidents.reduce((sum, row) => sum + weightOf(row), 0);
        let ticket = rng.int(0, total - 1);
        let at = 0;
        for (; at < incidents.length - 1; at++) {
            ticket -= weightOf(incidents[at]!);
            if (ticket < 0) break;
        }
        const [incident] = incidents.splice(at, 1);
        if (!incident) continue;
        if (incident.kind === 'fact') {
            chosen.push(incident.fact);
            continue;
        }
        const area = areaAt(incident.placeId);
        if (!area) continue;
        const living = livingAt.get(incident.placeId) ?? [];
        if (incident.kind === 'body') {
            const body = incident.body;
            const atBody = area.whereBodiesAre.get(body.id);
            const pairs: { actor: Body; witness: Body }[] = [];
            for (const actor of living) for (const witness of living) {
                if (actor.id === witness.id || area.whereIs.get(actor.id) !== atBody
                    || area.whereIs.get(witness.id) !== atBody
                    || index.seenBody.has(evidenceKey(body.id, actor.id, witness.id))) continue;
                pairs.push({ actor, witness });
            }
            if (pairs.length > 0) {
                const pair = pairs[rng.int(0, pairs.length - 1)]!;
                emitBody(body, pair.actor, [pair.witness], incident.placeId);
            }
        } else {
            const goods = incident.goods;
            const actor = people.get(goods.possessorId!);
            if (!actor || actor.status !== 'alive') continue;
            const near = living.filter(n => n.id !== actor.id
                && area.whereIs.get(n.id) === area.whereIs.get(actor.id)
                && goodsKnownTo(goods, n)
                && !index.seenEvidence.has(evidenceKey(goods.id, actor.id, n.id)));
            if (near.length > 0) emitGoods(goods, actor,
                [near[rng.int(0, near.length - 1)]!], incident.placeId);
        }
    }

    index = witnessIndexFor(world);
    const selected = new Set([...exact, ...chosen, ...emitted]);
    for (const fact of [...selected].sort((a, b) =>
        (index.order.get(a.id) ?? 0) - (index.order.get(b.id) ?? 0))) resolveWitnessFact(world, fact, day, knows, lookup);

    index = witnessIndexFor(world);
    const pendingCandidates = new Set([...selected].filter(fact => index.pending.has(fact)));
    for (const placeId of playerPlaces) for (const fact of index.pendingByPlace.get(placeId) ?? []) {
        pendingCandidates.add(fact);
    }
    for (const personId of playerIds) for (const fact of index.pendingByPerson.get(personId) ?? []) {
        pendingCandidates.add(fact);
    }
    settleWitnessAccounts(world, pendingCandidates, day, knows, lookup);
}

function resolveWitnessFact(world: WorldState, fact: HistoricalFact, day: number,
    knows: ReturnType<typeof worldKnowledgeGate>, lookup?: WitnessLookup,
    onlyWitnesses?: ReadonlySet<string>): number {
    let changed = 0;
    if (fact.kind === 'war' && Number(fact.data.fell ?? 0) >= 3) {
        for (const id of fact.witnessIds.filter(id => !onlyWitnesses || onlyWitnesses.has(id))) {
            const witness = npcById(world, id, lookup);
            if (witness?.status !== 'alive') continue;
            const authority = authorityKnownTo(world, fact, witness, '', knows, undefined, lookup);
            if (!authority) continue;
            const report = whatTheWitnessDoesAboutIt({ witness: { id: witness.id,
                name: witness.name, standing: null, role: 'peer' }, theyOweYou: 0,
                theyHoldAboutYou: 1, toId: authority.toId, rungsAbove: 0 });
            if (report.does === 'reports' && !witnessIndexFor(world).reports.get(fact.id)?.has(witness.id)) {
                const written = houseHearsWitnessReport(world, fact, {
                    witnessId: witness.id, reportHouseId: authority.houseId,
                    reportedTo: authority.toId, manyHarmed: true }, null, day, lookup);
                if (written) changed++;
            }
        }
    }
    const parties = actorAndVictimOf(fact);
    if (!parties || fact.witnessIds.length === 0 || !npcById(world, parties.actorId, lookup)) return changed;
    const seen = observationOf(fact);
    const added = reactToWitnessedFact(world, fact, { actorId: parties.actorId,
        victimId: parties.victimId, knows, lookup,
        witnesses: fact.witnessIds.filter(id => id !== parties.victimId && (!onlyWitnesses || onlyWitnesses.has(id))).map(id => ({ id, seen })) });
    changed += added.length;
    const actor = npcById(world, parties.actorId, lookup)!;
    for (const row of added) {
        if (row.state === 'reported_for') {
            houseHearsWitnessReport(world, fact, row, actor.factionId, day, lookup);
            continue;
        }
        const account = reportFromObservation(fact, row, actor.factionId, day);
        if (account && !world.obligations.some(o => o.holderId === account.holderId
            && o.subjectId === account.subjectId && o.triggeringEventId === fact.id)) {
            world.obligations.push(createObligation(account));
            houseHearsWitnessReport(world, fact, row, actor.factionId, day, lookup);
        }
    }
    return changed;
}

function settleWitnessAccounts(world: WorldState, candidates: Iterable<HistoricalFact>, day: number,
    knows: ReturnType<typeof worldKnowledgeGate>, lookup?: WitnessLookup,
    onlyWitnesses?: ReadonlySet<string>): number {
    const index = witnessIndexFor(world);
    let changed = 0;
    const pending = [...candidates]
        .sort((a, b) => (index.order.get(b.id) ?? 0) - (index.order.get(a.id) ?? 0));
    for (const fact of pending) for (const observation of observations(fact).reverse()) {
        if (observation.state !== 'pending' || onlyWitnesses && !onlyWitnesses.has(observation.witnessId)) continue;
        const actor = npcById(world, observation.actorId, lookup);
        const witness = npcById(world, observation.witnessId, lookup);
        if (actor?.status !== 'alive' || witness?.status !== 'alive'
            || actor.tags.includes('the-player') || witness.tags.includes('the-player')) continue;
        const account: DeedAccount = observation.sawFirstAttack ? 'defence'
            : !observation.sawAct ? 'found'
                : forStream(world.seed, 'an-account-of-a-witnessed-deed', fact.id, actor.id, witness.id)
                    .chance(Math.max(0.1, Math.min(0.9,
                        0.45 + (relationshipWith(actor, witness.id)?.standing ?? 0) * 0.2)))
                    ? 'admitted' : 'denial';
        const answer = accountForWitnessedDeed(world, fact, { actorId: actor.id, witnessId: witness.id,
            onDay: day, knows, lookup, account, words: account === 'defence' ? 'They attacked first.'
                : account === 'found' ? 'I found them this way.'
                    : account === 'admitted' ? 'I did it.' : 'It was not me.' });
        if (answer) {
            changed++;
            world.obligations.push(...answer.opens.map(createObligation));
            if (answer.reportsTo) houseHearsWitnessReport(world, fact,
                observations(fact).find(row => row.actorId === actor.id && row.witnessId === witness.id)!,
                actor.factionId, day, lookup);
        }
    }
    return changed;
}

/** Settle the carded people's outstanding reactions through the yearly resolver. */
export function settleWitnessesOnContact(world: WorldState, personIds: ReadonlySet<string>): boolean {
    const index = witnessIndexFor(world);
    const facts = new Set<HistoricalFact>();
    for (const id of personIds) for (const factId of index.presentAt.get(id) ?? []) {
        const fact = index.byId.get(factId);
        if (fact && fact.day <= world.currentDay && fact.witnessIds.some(witness => personIds.has(witness))) facts.add(fact);
    }
    const knows = worldKnowledgeGate(world);
    let changed = 0;
    for (const fact of [...facts].sort((a, b) => index.order.get(a.id)! - index.order.get(b.id)!)) {
        changed += resolveWitnessFact(world, fact, Math.floor(world.currentDay), knows, undefined, personIds);
    }
    changed += settleWitnessAccounts(world, facts, Math.floor(world.currentDay), knows, undefined, personIds);
    return changed > 0;
}
