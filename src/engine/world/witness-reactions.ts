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
import type { WorldState } from './world-state.js';
import { AGAINST_THEIR_OWN } from '../social-leverage/what-a-house-does-when-it-catches-you.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from './what-one-of-the-worlds-own-people-knows.js';
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

function observations(fact: HistoricalFact): WitnessReaction[] {
    return typeof fact.data.witnessReactions === 'string'
        ? JSON.parse(fact.data.witnessReactions) as WitnessReaction[] : [];
}

function save(fact: HistoricalFact, rows: readonly WitnessReaction[]): void {
    fact.data.witnessReactions = JSON.stringify(rows);
}

function aWitnessTellsSomeoneHere(world: WorldState, fact: HistoricalFact,
    seen: WitnessReaction): void {
    const witness = world.npcs.find(n => n.id === seen.witnessId);
    const place = world.locations.find(l => l.id === fact.locationId);
    if (!witness || !place || witness.locationId !== place.id) return;
    const areas = theAreasOf(world, place).whereIs;
    const listener = world.npcs.find(n => n.status === 'alive' && n.id !== witness.id
        && n.id !== seen.actorId && n.locationId === place.id
        && areas.get(n.id) === areas.get(witness.id));
    if (!listener || !forStream(world.seed, 'witness-tells-somebody-here', fact.id, witness.id)
        .chance(Math.max(0.05, Math.min(0.9, 0.5 - reticenceOf(witness.id) * 0.3)))) return;
    appendWorldFact(world, makeFact({ day: Math.floor(world.currentDay), kind: 'said_in_public',
        locationId: place.id, witnessIds: [witness.id, listener.id], visibility: 'regional',
        factionIds: fact.factionIds,
        actors: [{ id: witness.id, name: witness.name, role: 'said it' },
            { id: seen.actorId, name: world.npcs.find(n => n.id === seen.actorId)?.name ?? 'someone', role: 'named' }],
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
    preferredHouseId?: string | null): { houseId: string; toId: string } | null {
    const ground = whoHoldsTheGround(world.locations, fact.locationId);
    const postedHere = world.npcs.filter(n => n.status === 'alive' && n.factionId !== null
        && n.locationId === fact.locationId && n.activity?.kind === 'stationed'
        && knows(witness.id, 'cultivator', n.id));
    const houseId = preferredHouseId ?? ground.holderFactionId ?? postedHere[0]?.factionId ?? null;
    if (!houseId) return null;
    const posted = postedHere.find(n => n.factionId === houseId);
    if (posted) return { houseId, toId: posted.id };
    if (!knows(witness.id, 'sect', houseId)) return null;
    const house = world.factions.find(h => h.id === houseId);
    if (!house || house.seatLocationId !== fact.locationId) return null;
    const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === houseId);
    const portfolios = whoIsInChargeOfWhat({ rooms: theRoomsThisHouseHas(world.locations, houseId),
        roll: roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })), rankCount: house.ranks.length });
    const head = [...roll].sort((a, b) => b.factionRankIndex - a.factionRankIndex)[0];
    const toId = whereAComplaintGoes({ portfolios, aboutId: actorId, headId: head?.id ?? null });
    return toId && knows(witness.id, 'cultivator', toId) ? { houseId, toId } : null;
}

function reportingDecision(world: WorldState, fact: HistoricalFact, actor: NpcRecord,
    witness: NpcRecord, seen: SeenDeed, ledger: readonly ObligationRecord[],
    knows: (holderId: string, kind: 'cultivator' | 'sect', id: string) => boolean,
    forOwnSide = false): { houseId: string; toId: string } | null {
    const authority = authorityKnownTo(world, fact, witness, actor.id, knows,
        forOwnSide ? witness.factionId : undefined);
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
}): WitnessReaction[] {
    const actor = world.npcs.find(n => n.id === input.actorId);
    if (!actor) return [];
    const actorHouseId = input.actorHouseId ?? actor.factionId;
    const rows = observations(fact);
    const added: WitnessReaction[] = [];
    const victim = world.npcs.find(n => n.id === input.victimId);
    for (const seeing of input.witnesses) {
        const witness = world.npcs.find(n => n.id === seeing.id && n.status === 'alive');
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
        const knows = input.knows ?? ((holderId: string, kind: 'cultivator' | 'sect', id: string) => {
            const stage = whatOneOfTheWorldsOwnPeopleKnows(world)(holderId, kind, id);
            return kind === 'cultivator' ? stage === 'known' : canPointAt(stage);
        });
        const report = (forOwnSide || needs && seeing.seen.manyHarmed) && !witness.tags.includes('the-player')
            ? reportingDecision(world, fact, actor, witness, seeing.seen,
                input.ledger ?? world.obligations, knows, forOwnSide) : null;
        const row: WitnessReaction = { ...seeing.seen, witnessId: witness.id, actorId: actor.id,
            victimId: input.victimId, state: report ? forOwnSide ? 'reported_for' : 'reported' : needs ? 'pending'
                : seeing.seen.wrong === null ? 'remembered' : 'ignored',
            ...(gratitude ? { regard: 'gratitude' as const } : credit ? { regard: 'credit' as const } : {}),
            ...(report ? { reportHouseId: report.houseId, reportedTo: report.toId } : {}) };
        rows.push(row);
        added.push(row);
        if (gratitude || credit) {
            const at = world.npcs.findIndex(n => n.id === witness.id);
            const tie = relationshipWith(witness, actor.id);
            world.npcs[at] = upsertRelationship(witness, { targetId: actor.id, targetName: actor.name,
                kind: tie?.kind ?? 'acquaintance', standing: Math.min(1, (tie?.standing ?? 0)
                    + (gratitude ? 0.15 : 0.05)), note: `${witness.name} saw ${fact.summary}`,
                factIds: [fact.id], inheritedFromId: null }, world.currentDay);
        }
        if (!fact.witnessIds.includes(witness.id)) fact.witnessIds.push(witness.id);
    }
    if (added.length > 0) save(fact, rows);
    for (const row of added) if (row.state === 'remembered') aWitnessTellsSomeoneHere(world, fact, row);
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
    save(fact, rows);
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
    actorHouseId: string | null, onDay = world.currentDay): HistoricalFact | null {
    if (!seen.reportHouseId || !seen.reportedTo) return null;
    const previous = world.history.facts.find(row => row.data.witnessReport === fact.id
        && row.data.reportedBy === seen.witnessId);
    if (previous) return previous;
    const house = world.factions.find(h => h.id === seen.reportHouseId);
    const witness = world.npcs.find(n => n.id === seen.witnessId);
    const recipient = world.npcs.find(n => n.id === seen.reportedTo);
    if (!house || !witness || !recipient) return null;
    const reportFor = 'state' in seen && seen.state === 'reported_for';
    const actorId = reportFor && 'actorId' in seen ? String(seen.actorId) : null;
    const actor = actorId ? world.npcs.find(n => n.id === actorId) : null;
    const victimId = reportFor && 'victimId' in seen ? String(seen.victimId) : null;
    const victim = victimId ? world.npcs.find(n => n.id === victimId) : null;
    if (reportFor && actor && victim && actorHouseId === house.id
        && victim.factionId !== null && areAtWarWithEachOther(world, house.id, victim.factionId)) {
        const at = world.npcs.findIndex(n => n.id === actor.id);
        world.npcs[at] = creditMerit(actor, Math.round(whatServiceIsWorth(actor.cultivation.realmOrdinal,
            seen.manyHarmed ? 90 : 30)));
        theirFaceMoves(world, actor.id, whatWinningIsWorth({ winnerOrdinal: actor.cultivation.realmOrdinal,
            loserOrdinal: victim.cultivation.realmOrdinal, witnesses: fact.witnessIds.length }), onDay);
    }
    const warning = !reportFor && seen.manyHarmed === true && actorHouseId !== house.id
        && (actorHouseId === null || (house.standing[actorHouseId] ?? 0) <= 0)
        && !world.history.facts.some(row => row.data.witnessReport === fact.id
            && row.data.houseWarning === true);
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
export function witnessReactions(world: WorldState, actorId?: string): { fact: HistoricalFact; observation: WitnessReaction }[] {
    return world.history.facts.flatMap(fact => observations(fact)
        .filter(row => actorId === undefined || row.actorId === actorId)
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
    for (const fact of world.history.facts.filter(row => row.kind === 'bounty_posted'
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
                && !world.history.facts.some(row => row.data.priceWarning === fact.id && row.data.warnedBy === observer.id)) {
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
}): { belief: DeedBelief; confidence: number; opens: ObligationInput[]; reportsTo: string | null } | null {
    const rows = observations(fact);
    const seen = rows.find(row => row.actorId === input.actorId && row.witnessId === input.witnessId && row.state === 'pending');
    const actor = world.npcs.find(n => n.id === input.actorId);
    const witness = world.npcs.find(n => n.id === input.witnessId);
    if (!seen || !actor || !witness) return null;
    const ledger = input.ledger ?? world.obligations;
    const weighed = weighAnAccountOfADeed({ trust: trustFor(world, actor, witness, fact, ledger), seen, account: input.account });
    Object.assign(seen, { state: weighed.belief, account: input.account, words: input.words, blamedId: input.blamedId ?? null });
    save(fact, rows);
    if (weighed.belief === 'half-belief') aWitnessTellsSomeoneHere(world, fact, seen);
    const at = world.npcs.findIndex(n => n.id === witness.id);
    const standing = relationshipWith(witness, actor.id)?.standing ?? 0;
    if (weighed.belief !== 'belief') {
        world.npcs[at] = upsertRelationship(witness, { targetId: actor.id, targetName: actor.name,
            kind: weighed.belief === 'disbelief' ? 'enemy' : 'acquaintance',
            standing: Math.max(-1, standing - (weighed.belief === 'disbelief' ? 0.3 : 0.1)),
            note: `${actor.name}'s account of ${fact.id}: ${weighed.belief}.`,
            factIds: [fact.id], inheritedFromId: null }, input.onDay ?? world.currentDay);
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
        const knows = input.knows ?? ((holderId: string, kind: 'cultivator' | 'sect', id: string) => {
            const stage = whatOneOfTheWorldsOwnPeopleKnows(world)(holderId, kind, id);
            return kind === 'cultivator' ? stage === 'known' : canPointAt(stage);
        });
        const report = reportingDecision(world, fact, actor, witness, seen,
            [...ledger, ...opens.map(createObligation)], knows);
        if (report) {
            reportsTo = report.toId;
            seen.reportHouseId = report.houseId;
            seen.reportedTo = report.toId;
            save(fact, rows);
            const account = reportFromObservation(fact, seen, actor.factionId, onDay);
            if (account) opens.push(account);
        }
    }
    return { belief: weighed.belief, confidence: weighed.confidence, opens, reportsTo };
}

/** The world's witnessed events get the same hearing as the player's. */
export function witnessReactionsThisYear(world: WorldState, day: number): void {
    const bodies = world.npcs.filter(n => n.status === 'physically_dead'
        && n.diedOnDay !== null && n.diedOnDay >= day - 365 && n.locationId !== null);
    const heldObjects = world.objects.filter(o => o.possessorId !== null
        && o.ownerId !== null && o.ownerId !== o.possessorId);
    const evidencePlaces = new Set<string>(bodies.map(n => n.locationId!));
    for (const object of heldObjects) {
        const holder = world.npcs.find(n => n.id === object.possessorId);
        if (holder?.locationId) evidencePlaces.add(holder.locationId);
    }
    const evidenceKnows = whatOneOfTheWorldsOwnPeopleKnows(world);
    for (const place of world.locations.filter(l => evidencePlaces.has(l.id))) {
        const areas = theAreasOf(world, place);
        const living = world.npcs.filter(n => n.status === 'alive' && n.locationId === place.id);
        const bodiesHere = bodies.filter(n => n.locationId === place.id);
        for (const actor of living) {
            const here = areas.whereIs.get(actor.id);
            const observers = living.filter(n => n.id !== actor.id && areas.whereIs.get(n.id) === here);
            if (observers.length === 0) continue;
            for (const body of bodiesHere.filter(n => areas.whereBodiesAre.get(n.id) === here)) {
                const witnesses = observers.filter(n => !world.history.facts.some(f => f.data.seenWithBody === true
                    && f.data.bodyId === body.id && f.actors.some(a => a.id === actor.id)
                    && f.witnessIds.includes(n.id)));
                if (witnesses.length === 0) continue;
                appendWorldFact(world, makeFact({ day, kind: 'opportunity', locationId: place.id,
                    witnessIds: [actor.id, ...witnesses.map(n => n.id)], visibility: 'secret',
                    actors: [{ id: actor.id, name: actor.name, role: 'actor' },
                        { id: body.id, name: body.name, role: 'subject' }],
                    summary: `${actor.name} was beside ${body.name}'s body.`,
                    data: { seenWithBody: true, bodyId: body.id,
                        foundBeforeActor: body.diedOnDay !== null && body.diedOnDay < day - 1 } }),
                { recur: false, bystanders: false });
            }
            for (const object of heldObjects.filter(o => o.possessorId === actor.id)) {
                const mark = object.tags.find(tag => tag.startsWith('house:'))?.slice(6);
                const witnesses = observers.filter(n => object.knownOwnershipBy.includes(n.id)
                    || mark !== undefined && canPointAt(evidenceKnows(n.id, 'sect', mark)))
                    .filter(n => !world.history.facts.some(f => f.data.seenWithEvidence === object.id
                        && f.actors.some(a => a.id === actor.id) && f.witnessIds.includes(n.id)));
                if (witnesses.length === 0) continue;
                appendWorldFact(world, makeFact({ day, kind: 'opportunity', locationId: place.id,
                    witnessIds: [actor.id, ...witnesses.map(n => n.id)], visibility: 'secret',
                    actors: [{ id: actor.id, name: actor.name, role: 'actor' }],
                    summary: mark ? `${actor.name} carried ${object.name} bearing a house mark.`
                        : `${actor.name} carried ${object.name}, which ${object.ownerName} owns.`,
                    data: { seenWithEvidence: object.id, objectId: object.id, markedProperty: true } }),
                { recur: false, bystanders: false });
            }
        }
    }
    const knows = whatOneOfTheWorldsOwnPeopleKnows(world);
    for (const fact of world.history.facts) {
        if (fact.day > day || fact.day < day - 365 || fact.data.witnessReactions !== undefined) continue;
        const parties = actorAndVictimOf(fact);
        if (fact.kind === 'war' && Number(fact.data.fell ?? 0) >= 3) {
            for (const id of fact.witnessIds) {
                const witness = world.npcs.find(n => n.id === id && n.status === 'alive');
                if (!witness) continue;
                const authority = authorityKnownTo(world, fact, witness, '',
                    (holderId, kind, targetId) => kind === 'cultivator'
                        ? knows(holderId, kind, targetId) === 'known'
                        : canPointAt(knows(holderId, kind, targetId)));
                if (!authority) continue;
                const report = whatTheWitnessDoesAboutIt({ witness: { id: witness.id,
                    name: witness.name, standing: null, role: 'peer' }, theyOweYou: 0,
                    theyHoldAboutYou: 1, toId: authority.toId, rungsAbove: 0 });
                if (report.does === 'reports') houseHearsWitnessReport(world, fact, {
                    witnessId: witness.id, reportHouseId: authority.houseId,
                    reportedTo: authority.toId, manyHarmed: true }, null, day);
            }
        }
        if (!parties || fact.witnessIds.length === 0 || !world.npcs.some(n => n.id === parties.actorId)) continue;
        const seen = observationOf(fact);
        const added = reactToWitnessedFact(world, fact, { actorId: parties.actorId, victimId: parties.victimId,
            knows: (holderId, kind, id) => kind === 'cultivator'
                ? knows(holderId, kind, id) === 'known' : canPointAt(knows(holderId, kind, id)),
            witnesses: fact.witnessIds.filter(id => id !== parties.victimId).map(id => ({ id, seen })) });
        const actor = world.npcs.find(n => n.id === parties.actorId)!;
        for (const row of added) {
            if (row.state === 'reported_for') {
                houseHearsWitnessReport(world, fact, row, actor.factionId, day);
                continue;
            }
            const account = reportFromObservation(fact, row, actor.factionId, day);
            if (account && !world.obligations.some(o => o.holderId === account.holderId
                && o.subjectId === account.subjectId && o.triggeringEventId === fact.id)) {
                world.obligations.push(createObligation(account));
                houseHearsWitnessReport(world, fact, row, actor.factionId, day);
            }
        }
    }
    for (const { fact, observation } of witnessReactions(world)) {
        if (observation.state !== 'pending') continue;
        const actor = world.npcs.find(n => n.id === observation.actorId && n.status === 'alive');
        const witness = world.npcs.find(n => n.id === observation.witnessId && n.status === 'alive');
        if (!actor || !witness || actor.tags.includes('the-player')) continue;
        if (witness.tags.includes('the-player')) continue;
        const account: DeedAccount = observation.sawFirstAttack ? 'defence'
            : !observation.sawAct ? 'found'
                : forStream(world.seed, 'an-account-of-a-witnessed-deed', fact.id, actor.id, witness.id)
                    .chance(Math.max(0.1, Math.min(0.9,
                        0.45 + (relationshipWith(actor, witness.id)?.standing ?? 0) * 0.2)))
                    ? 'admitted' : 'denial';
        const answer = accountForWitnessedDeed(world, fact, { actorId: actor.id, witnessId: witness.id,
            onDay: day,
            account, words: account === 'defence' ? 'They attacked first.'
                : account === 'found' ? 'I found them this way.'
                    : account === 'admitted' ? 'I did it.' : 'It was not me.' });
        if (answer) {
            world.obligations.push(...answer.opens.map(createObligation));
            if (answer.reportsTo) houseHearsWitnessReport(world, fact,
                observations(fact).find(row => row.actorId === actor.id && row.witnessId === witness.id)!,
                actor.factionId, day);
        }
    }
}
