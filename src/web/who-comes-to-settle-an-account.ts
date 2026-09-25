/**
 * Who holds an account against a cultivator, and who would come to settle it.
 *
 * `whoIsComingForYou` has always said who may act and thinks it worth doing; it
 * only filled the sheet. This hands the same list to the encounter draw, with
 * the person who would actually arrive: the holder, or somebody on the roll of
 * a house that holds one.
 */

import type { AnAccountComingDue } from '../engine/encounters/types.js';
import type { AHolder } from '../engine/social-leverage/being-hunted.js';
import { WHAT_A_RECORD_COUNTS_FOR } from '../engine/social-leverage/personal-alignment.js';
import { whatSomebodyIsLike } from '../engine/world/what-somebody-is-like-and-where-it-came-from.js';
import { npcsInFaction, type WorldState } from '../engine/world/world-state.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import type { ObligationDb } from '../storage/repos/obligation.repo.js';
import { type APersonsRecord, whatTheWorldHoldsAbout } from './personal-record.js';
import type { GameService } from './turn-engine.js';
import { whereYouStandOnYourHousesRoll } from './walking-up-to-a-house.js';

/**
 * Who an id on the ledger is: a world person, a `cultivators` row, or a house,
 * whose rung is whoever answers for it. Null for anybody unplaceable, which
 * `whoIsComingForYou` then leaves out.
 */
export function whoHoldsThisAccount(
    world: WorldState | null,
    repos: CultivationRepos,
    id: string
): AHolder | null {
    const npc = (world?.npcs ?? []).find(row => row.id === id);
    if (npc) {
        return { id: npc.id, name: npc.name, ordinal: npc.cultivation.realmOrdinal, houseId: npc.factionId };
    }
    const row = repos.cultivators.getById(id);
    if (row) {
        return { id: row.id, name: row.name, ordinal: row.realmOrdinal, houseId: row.sectId ?? null };
    }
    const house = repos.sects.getById(id);
    return house
        ? { id: house.id, name: house.name, ordinal: house.powerOrdinal, houseId: house.id }
        : null;
}

/** The whole record about this cultivator, read the one way the sheet reads it. */
export function whatIsHeldAgainst(service: GameService, cultivator: Cultivator): APersonsRecord {
    return whatTheWorldHoldsAbout({
        db: service.db as unknown as ObligationDb,
        person: {
            id: cultivator.id,
            ordinal: cultivator.realmOrdinal,
            // `Backing`'s three values off the roll: a house that would have to be
            // dealt with, a roll whose house would not stand behind you, nobody.
            backing: cultivator.sectId === null
                ? 'none'
                : whereYouStandOnYourHousesRoll(service, cultivator)
                    ? 'backed'
                    : 'unclaimable'
        },
        lookUpHolder: id => whoHoldsThisAccount(service.atHand, service.repos, id)
    });
}

/**
 * Who a house sends: the least of its living people who stands at or above the
 * cultivator, and its strongest where nobody does. A house spends what the job
 * needs, not its best.
 */
export function whoAHouseSends(
    world: WorldState,
    houseId: string,
    againstOrdinal: number,
    exceptId: string
): { id: string; name: string; realmOrdinal: number } | null {
    const roll = npcsInFaction(world, houseId).filter(npc => npc.id !== exceptId);
    if (roll.length === 0) return null;
    const byRung = [...roll].sort((a, b) =>
        a.cultivation.realmOrdinal - b.cultivation.realmOrdinal || (a.id < b.id ? -1 : 1));
    const pick = byRung.find(npc => npc.cultivation.realmOrdinal >= againstOrdinal)
        ?? byRung[byRung.length - 1];
    return { id: pick.id, name: pick.name, realmOrdinal: pick.cultivation.realmOrdinal };
}

/**
 * The open accounts whose holders may come, one row per holder, heaviest first,
 * each with who would arrive. A holder with nobody alive to send is left out.
 */
export function accountsComingDue(service: GameService, cultivator: Cultivator): AnAccountComingDue[] {
    const coming = whatIsHeldAgainst(service, cultivator).hunted.coming;
    const world = service.atHand;
    const out = new Map<string, AnAccountComingDue>();

    for (const pursuer of coming) {
        const weight = WHAT_A_RECORD_COUNTS_FOR[pursuer.severity];
        const already = out.get(pursuer.holderId);
        if (already) {
            already.weight += weight;
            continue;
        }

        const npc = world?.npcs.find(row => row.id === pursuer.holderId) ?? null;
        const row = npc ? null : service.repos.cultivators.getById(pursuer.holderId);
        const house = npc || row ? null : service.repos.sects.getById(pursuer.holderId);

        const sent = npc
            ? npc.status === 'alive'
                ? { id: npc.id, name: npc.name, realmOrdinal: npc.cultivation.realmOrdinal }
                : null
            : row
                ? row.alive ? { id: row.id, name: row.name, realmOrdinal: row.realmOrdinal } : null
                : house && world
                    ? whoAHouseSends(world, house.id, cultivator.realmOrdinal, cultivator.id)
                    : null;
        if (!sent || sent.id === cultivator.id) continue;
        const sentRow = world?.npcs.find(person => person.id === sent.id) ?? null;

        out.set(pursuer.holderId, {
            holderId: pursuer.holderId,
            holderName: pursuer.holderName,
            holderIsAHouse: house !== null,
            sent: { ...sent, strength: whatTheyCouldBreakADoorWith(world, sent) },
            ...(sentRow ? { push: whatSomebodyIsLike(sentRow).push } : {}),
            weight,
            severity: pursuer.severity,
            what: pursuer.what,
            carried: pursuer.carriedRatherThanSettled
        });
    }
    return [...out.values()];
}

/**
 * What somebody could put through a door: their rung, or the rung of the strongest
 * rated thing they carry where that is higher. An art is pitched at or below the
 * rung of whoever works it, so it adds nothing a door would feel over the rung.
 */
function whatTheyCouldBreakADoorWith(
    world: WorldState | null,
    who: { id: string; realmOrdinal: number }
): number {
    let best = who.realmOrdinal;
    for (const object of world?.objects ?? []) {
        if (object.possessorId !== who.id || object.power === null) continue;
        if (Number.isFinite(object.power) && object.power > best) best = object.power;
    }
    return best;
}
