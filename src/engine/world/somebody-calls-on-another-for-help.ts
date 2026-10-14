/** A person asks somebody reached for real help, for themselves or somebody else. */
import { forStream } from '../cultivation/rng.js';
import { theGroundUnderYou } from '../social-leverage/ground-trust.js';
import { whoHoldsTheGround } from './ground-holder.js';
import { faceOf as howMuchTheirFaceMatters } from '../social-leverage/how-much-their-face-matters.js';
import { oddsOf, type AttemptInput } from '../social-leverage/an-attempt-to-move-somebody.js';
import { createObligation, type ObligationRecord } from '../social/grudges.js';
import { writeItDown } from './the-word-an-npc-gave.js';
import { hallResponsibilities } from './a-house-gives-one-elder-each-hall.js';
import { isTheWorldsToMove, relationshipWith, type NpcRecord } from './npc-state.js';
import { routineLocationOf } from './npc-routines.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { theirFaceMoves, whatBeingWatchedIsWorth } from './what-a-face-is-worth.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import type { WorldState } from './world-state.js';

/** The producer must start actual work; a promise alone does not purchase an owed favour. */
export function askSomebodyForHelp(state: WorldState, input: {
    askerId: string; beneficiaryId?: string; day: number; work: string;
    /** Rates callers still let the asker decide whether to spend their own face. */
    considerWhetherToAsk?: boolean;
    /** An explicit player act supplies its actual SQL body and observed scene, never an autonomous choice. */
    player?: { person: NpcRecord; placeId: string; present: ReadonlySet<string>;
        ledger: readonly ObligationRecord[]; rememberFavour: (record: ObligationRecord) => void };
    /** Read the actual art, medical or teaching authority; zero means unable. */
    ability: (person: NpcRecord) => number;
    /** The existing work path returns false if its bodily or resource gate stopped it. */
    perform: (helper: NpcRecord, beneficiary: NpcRecord) => boolean;
}): NpcRecord | null {
    const player = input.player?.person.id === input.askerId && !isTheWorldsToMove(input.player.person) ? input.player : null;
    const asker = player?.person ?? state.npcs.find(row => row.id === input.askerId && row.status === 'alive');
    const beneficiary = state.npcs.find(row => row.id === (input.beneficiaryId ?? input.askerId) && row.status === 'alive');
    if (!asker || asker.status !== 'alive' || !beneficiary || !isTheWorldsToMove(asker) && !player) return null;
    const potential = state.npcs.flatMap(person => {
        if (person.id === asker.id || person.status !== 'alive' || !isTheWorldsToMove(person)) return [];
        const ability = input.ability(person);
        return Number.isFinite(ability) && ability > 0 ? [{ person, ability }] : [];
    });
    if (!potential.length) return null;
    const key = `${asker.id}:${beneficiary.id}:${input.work}:${input.day}`;
    if (factsWithDataValue(state, 'personalHelpRequest', key).length) return null;
    const clock = { ...state, currentDay: Math.floor(input.day), currentHour: (input.day % 1) * 24 };
    const placeId = player?.placeId ?? routineLocationOf(clock, asker);
    const place = state.locations.find(row => row.id === placeId);
    if (!place) return null;
    const areas = player ? null : theAreasOf(clock, place).whereIs;
    const area = areas?.get(asker.id);
    if (!player && area === undefined) return null;
    const reached = (person: NpcRecord) => player ? player.present.has(person.id)
        : routineLocationOf(clock, person) === placeId && areas!.get(person.id) === area;
    const party = (person: NpcRecord) => ({ id: person.id, name: person.name, ordinal: person.cultivation.realmOrdinal,
        charm: person.cultivation.attributes.charm, factionId: person.factionId, ranked: !!person.factionId,
        alignment: state.factions.find(row => row.id === person.factionId)?.alignment ?? null });
    const oldColleagues = new Set(asker.factionId ? hallResponsibilities(state, asker.factionId)
        .filter(hall => hall.holderId === asker.id).flatMap(hall => hall.existingClaimants) : []);
    const candidates = potential.flatMap(({ person, ability }) => {
        if (!reached(person)) return [];
        const tie = relationshipWith(person, asker.id);
        const request: AttemptInput = { actor: party(asker), subject: party(person), ask: 'a_real_favour', onDay: input.day,
            where: theGroundUnderYou(whoHoldsTheGround(state.locations, placeId)),
            ledger: player?.ledger ?? state.obligations, theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
            approach: { leverage: 'name', audience: 'alone' },
            rng: forStream(state.seed, 'personal-help', key, person.id) };
        return [{ person, ability, request, odds: oddsOf(request).odds }];
    }).sort((a, b) => b.ability - a.ability
        || Number(oldColleagues.has(b.person.id)) - Number(oldColleagues.has(a.person.id))
        || b.odds - a.odds || a.person.id.localeCompare(b.person.id));
    const proposal = candidates[0];
    if (!proposal) return null;
    if (input.considerWhetherToAsk) {
        const tie = relationshipWith(asker, beneficiary.id);
        const decision: AttemptInput = { actor: party(beneficiary), subject: party(asker), ask: 'a_real_favour',
            onDay: input.day, ledger: state.obligations,
            theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
            rng: forStream(state.seed, 'personal-help-initiative', key) };
        const cost = whatBeingWatchedIsWorth(0) * (1 + howMuchTheirFaceMatters(asker.id));
        if (!decision.rng.chance(oddsOf(decision).odds / (1 + cost))) return null;
    }
    // Asking spends the same private unit of face as an unwitnessed deed.
    theirFaceMoves(state, asker.id, -whatBeingWatchedIsWorth(0), input.day);
    const agreed = proposal.request.rng.chance(proposal.odds);
    const done = agreed && input.perform(proposal.person, beneficiary);
    const witnesses = [...new Set([asker.id, proposal.person.id,
        ...(reached(beneficiary) ? [beneficiary.id] : [])])];
    const fact = appendWorldFact(state, makeFact({ day: input.day, kind: 'opportunity', locationId: placeId,
        visibility: 'secret', witnessIds: witnesses, actors: [{ id: asker.id, name: asker.name, role: 'asked' },
            { id: proposal.person.id, name: proposal.person.name, role: 'asked_for_help' },
            ...(witnesses.includes(beneficiary.id) && beneficiary.id !== asker.id && beneficiary.id !== proposal.person.id
                ? [{ id: beneficiary.id, name: beneficiary.name, role: 'beneficiary' }] : [])],
        summary: `${asker.name} asked ${proposal.person.name} to ${input.work} for ${beneficiary.name}. `
            + (done ? `${proposal.person.name} began the work.` : agreed ? 'The work could not start.' : `${proposal.person.name} refused.`),
        data: { personalHelpRequest: key, accepted: agreed, beganWork: done, beneficiaryId: beneficiary.id } }), { bystanders: false });
    if (!done) return null;
    const favour = createObligation({ kind: 'favor', holderId: proposal.person.id, subjectId: asker.id,
        cause: 'other', severity: 'serious', onDay: input.day, triggeringEventId: fact.id,
        description: `${proposal.person.name} began to ${input.work} for ${beneficiary.name}, at ${asker.name}'s request.`,
        tags: ['personal-help', `beneficiary:${beneficiary.id}`] });
    if (player) player.rememberFavour(favour);
    else writeItDown(state, favour);
    return state.npcs.find(row => row.id === proposal.person.id) ?? null;
}
