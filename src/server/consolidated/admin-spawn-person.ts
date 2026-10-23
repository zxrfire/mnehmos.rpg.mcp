/** Trait-bearing encounters join the same population the world advances. */
import { createHash } from 'node:crypto';
import type { Cultivator, Run } from '../../schema/cultivation.js';
import type { AdminSpawnSpec } from '../../web/admin-spawn-spec.js';
import { resolveSect, worldLocationFor } from '../../web/entities.js';
import { BEAST_CHANGE_ORDINAL } from '../../data/cultivation/beasts.js';
import { rankRealmBand } from '../../data/cultivation/members.js';
import { SECTS } from '../../data/cultivation/sects.js';
import { DAYS_PER_YEAR } from '../../engine/cultivation/cultivation.js';
import { MAX_ORDINAL, rankName } from '../../engine/cultivation/realms.js';
import { forStream } from '../../engine/cultivation/rng.js';
import { createNpc, upsertRelationship } from '../../engine/world/npc-state.js';
import { andTheOtherEnd } from '../../engine/world/a-tie-has-two-ends.js';
import { holdsASlaveSeal } from '../../engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { releasePersonSeal, rememberForcedService } from '../../engine/world/person-seals.js';
import { writeObligations } from '../../storage/repos/obligation.repo.js';
import { recordSwornBrotherhood } from '../../engine/world/close-people-go-together.js';
import { standInTheWorld } from '../../web/the-player-as-a-row-the-world-can-invite.js';
import { theAreasOf } from '../../engine/world/where-in-a-place-somebody-is-standing.js';
import { theSpeciesTheyMeant } from '../../engine/world/a-beast-that-took-a-shape-is-somebody.js';
import { BEAST_TAG_PREFIX } from '../../engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { whatThisOneHasAlwaysWanted } from '../../engine/world/what-a-beast-has-always-wanted.js';
import { addGoal } from '../../engine/world/npc-state.js';
import { openHandednessOf, DISPOSITION_BANDS } from '../../engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { reticenceOf, RETICENCE_BANDS } from '../../engine/social-leverage/emotional-reticence.js';
import { faceOf } from '../../engine/social-leverage/how-much-their-face-matters.js';
import { thisHouseCanIssue } from '../../engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import {
    whatTheHouseGivesThem, whereThisHouseBurnsItsLamps, theInternalAffairsElderIn
} from '../../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { worldForRun, writeTheWorldNow } from '../state/cultivation-world.js';
import { guidingError, writeAdminAudit, type CultivationRepos } from './cultivation-support.js';

const TEMPERAMENT = {
    generous: (id: string) => openHandednessOf(id) >= DISPOSITION_BANDS.WORTH_SAYING,
    stingy: (id: string) => openHandednessOf(id) <= -DISPOSITION_BANDS.WORTH_SAYING,
    reticent: (id: string) => reticenceOf(id) >= RETICENCE_BANDS.WORTH_SAYING,
    expressive: (id: string) => reticenceOf(id) <= -RETICENCE_BANDS.WORTH_SAYING,
    proud: (id: string) => faceOf(id) >= DISPOSITION_BANDS.WORTH_SAYING,
    unassuming: (id: string) => faceOf(id) <= -DISPOSITION_BANDS.WORTH_SAYING
};

export async function spawnPersonFromSpec(
    repos: CultivationRepos, run: Run, player: Cultivator,
    spec: AdminSpawnSpec & { location?: string; alignment?: string; disposition?: string }
): Promise<object> {
    if (spec.ordinal !== undefined && (!Number.isInteger(spec.ordinal) || spec.ordinal < 0 || spec.ordinal > MAX_ORDINAL)) {
        return guidingError('invalid_ordinal', `Ordinal ${spec.ordinal} is outside 0..${MAX_ORDINAL}. Nothing spawned.`);
    }
    const world = await worldForRun(run);
    const resolvedHouse = spec.house === undefined
        ? spec.alignment === undefined ? null : SECTS.filter(s => s.alignment === spec.alignment)
            .sort((a, b) => Math.abs(a.powerOrdinal - (spec.ordinal ?? 0)) - Math.abs(b.powerOrdinal - (spec.ordinal ?? 0))
                || a.id.localeCompare(b.id))[0] ?? null
        : spec.house === null ? null : resolveSect(repos, spec.house);
    const house = resolvedHouse === null ? null : world.factions.find(f => f.id === resolvedHouse.id && f.dissolvedOnDay === null) ?? null;
    if (spec.house != null && house === null) {
        return guidingError('unknown_house', `No living house answers to "${spec.house}". Nothing spawned.`);
    }
    if (spec.rank !== undefined && !house) {
        return guidingError('rank_without_house', `"${spec.rank}" needs a house. Nothing spawned.`);
    }
    if (house && spec.alignment !== undefined && house.alignment !== spec.alignment) {
        return guidingError('house_alignment', `${house.name} is ${house.alignment}, not ${spec.alignment}. Nothing spawned.`);
    }
    const rankIndex = !house ? -1 : spec.rank === undefined ? 0
        : house.ranks.findIndex(r => r.toLowerCase() === spec.rank!.toLowerCase());
    if (house && rankIndex < 0) {
        return guidingError('unknown_rank', `${house.name} has no rung "${spec.rank}". Its rungs are ${house.ranks.join(', ')}. Nothing spawned.`);
    }
    const species = spec.species === undefined ? null : theSpeciesTheyMeant(spec.species);
    if (spec.species !== undefined && !species) {
        return guidingError('unknown_species', `No beast species answers to "${spec.species}". Nothing spawned.`);
    }
    const band = house ? rankRealmBand(house.id, rankIndex) : undefined;
    const ordinal = spec.ordinal ?? species?.ordinal ?? (band
        ? forStream(run.seed, 'admin-person-rung', world.npcs.length).int(band.minOrdinal, band.maxOrdinal)
        : undefined);
    if (ordinal === undefined) {
        return guidingError('no_ordinal', 'An encounter needs an ordinal, a beast species, or a house rung. Nothing spawned.');
    }
    if (species && ordinal < BEAST_CHANGE_ORDINAL) {
        return guidingError('not_somebody', `Human form begins at ordinal ${BEAST_CHANGE_ORDINAL}; ordinal ${ordinal} has no human form. Nothing spawned.`);
    }
    const place = worldLocationFor(world, spec.location ?? player.location);
    if (!place) return guidingError('unknown_location', `No world place answers to "${spec.location ?? player.location}". Nothing spawned.`);
    const day = world.currentDay;
    const toward = !spec.toward || /^(me|player)$/i.test(spec.toward) ? player
        : world.npcs.find(person => person.status === 'alive' && person.name.toLowerCase() === spec.toward!.toLowerCase());
    if (!toward) return guidingError('unknown_tie_subject', `No living person answers to "${spec.toward}". Nothing spawned.`);
    const sealHolder = !spec.seal ? null : /^(me|player)$/i.test(spec.seal.holder) ? player
        : repos.cultivators.list().find(person => person.name.toLowerCase() === spec.seal!.holder.toLowerCase())
            ?? world.npcs.find(person => person.status === 'alive' && person.name.toLowerCase() === spec.seal!.holder.toLowerCase());
    if (spec.seal && (!sealHolder || ('alive' in sealHolder ? !sealHolder.alive : sealHolder.status !== 'alive')))
        return guidingError('unknown_seal_holder', `No living person answers to "${spec.seal.holder}". Nothing spawned.`);
    const age = spec.age ?? 20;
    const takenNames = new Set(world.npcs.map(n => n.name.toLowerCase()));
    if (spec.name && (takenNames.has(spec.name.toLowerCase()) || repos.cultivators.list().some(n => n.name.toLowerCase() === spec.name!.toLowerCase()))) {
        return guidingError('name_taken', `"${spec.name}" already names somebody. Nothing spawned.`);
    }
    let id: string;
    // Select an ordinary identity whose existing traits meet the request; store no copy of a trait.
    let attempt = 0;
    do {
        id = 'npc-admin-' + createHash('sha256').update(`${run.seed}:admin-person:${world.npcs.length}:${attempt++}`).digest('hex').slice(0, 24);
    } while (spec.temperament && !TEMPERAMENT[spec.temperament](id));
    let npc = createNpc(world.seed, {
        id, name: spec.name, takenNames, sex: spec.sex,
        bornOnDay: day - age * DAYS_PER_YEAR, onDay: day, locationId: place.id,
        factionId: house?.id ?? null, factionRankIndex: rankIndex,
        cultivation: { realmOrdinal: ordinal, ...(species ? { specialties: species.element ? [species.element] : [] } : {}) },
        bloodline: species ? { speciesId: species.id, tier: 'final' } : null,
        tags: species ? [`${BEAST_TAG_PREFIX}${species.id}`] : []
    });
    if (npc.cultivation.lifespanEndsOnDay <= day) {
        const span = (npc.cultivation.lifespanEndsOnDay - npc.identity.bornOnDay) / DAYS_PER_YEAR;
        return guidingError('age_past_lifespan', `Age ${age} reaches the end of this body's ${span}-year lifespan. Nothing spawned.`);
    }
    if (species) npc = addGoal(npc, whatThisOneHasAlwaysWanted({ beast: species, locationId: place.id }), day);
    if (spec.disposition) npc = upsertRelationship(npc, { targetId: toward.id, targetName: toward.name,
        kind: spec.disposition === 'hostile' ? 'enemy' : 'acquaintance',
        standing: spec.disposition === 'close' || spec.disposition === 'sworn_sibling' ? 1
            : spec.disposition === 'friendly' ? 0.5 : spec.disposition === 'hostile' ? -0.7
            : spec.disposition === 'wary' ? -0.15 : 0, note: 'ADMIN arranged the initial disposition.' }, day);
    // ADMIN arranges an existing effect, as it arranges a realm; ordinary laying still has its realm/consent gate.
    if (spec.seal && sealHolder) npc.cultivation.seal = { kind: spec.seal.kind, byId: sealHolder.id,
        atOrdinal: 'realmOrdinal' in sealHolder ? sealHolder.realmOrdinal : sealHolder.cultivation.realmOrdinal,
        liftsOnDay: null, sinceDay: day, note: 'ADMIN arranged an existing person seal.' };
    // The encounter shares an area with the player, subject to its three-person capacity.
    npc.activity = { kind: 'talking', note: 'Standing with the person they just encountered.',
        withIds: [player.id], sinceDay: day, untilDay: day + 1 };
    const issued = house ? whatTheHouseGivesThem({
        house, person: { id, name: npc.name, rankIndex }, wearsItsRobes: false, holdsItsToken: false,
        canCut: thisHouseCanIssue([...world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id)
            .map(n => n.cultivation.realmOrdinal), ordinal]),
        lampRoomId: whereThisHouseBurnsItsLamps(world.locations, house.id) ?? house.seatLocationId,
        internalAffairsElder: () => theInternalAffairsElderIn(world.locations, house,
            [...world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id), npc]
                .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })), world.npcs), onDay: day
    }) : null;
    repos.db.transaction(() => {
        if (spec.seal?.kind === 'slave' && sealHolder) {
            for (const old of world.npcs) if (old.status === 'alive' && holdsASlaveSeal(old.cultivation.seal, sealHolder.id, day))
                releasePersonSeal(world, old.id, day);
            for (const old of repos.cultivators.list()) if (old.alive && holdsASlaveSeal(old.qiSeal, sealHolder.id, day)) {
                const before = world.obligations.length;
                rememberForcedService(world, old.id, old.qiSeal!, day);
                writeObligations(repos.db, world.obligations.splice(before));
                repos.cultivators.update(old.id, { qiSeal: null });
            }
        }
        world.npcs.push(npc);
        if (spec.disposition) {
            let counterpart = world.npcs.find(person => person.id === toward.id);
            if (toward.id === player.id) {
                const member = repos.sects.getMembership(player.id);
                counterpart = standInTheWorld(world, player, { factionId: member?.sectId ?? null,
                    rankIndex: member?.rankIndex ?? -1, contribution: member?.contribution ?? 0 }, day) ?? undefined;
            }
            if (counterpart) {
                const close = spec.disposition === 'close' || spec.disposition === 'sworn_sibling';
                andTheOtherEnd(world.npcs, npc, npc.relationships.find(tie => tie.targetId === toward.id)!, day,
                    close ? { kind: 'ally', standing: 1, note: 'ADMIN arranged an existing close tie.' } : {});
                if (spec.disposition === 'sworn_sibling') {
                    const before = world.obligations.length;
                    recordSwornBrotherhood(world, npc, world.npcs.find(person => person.id === toward.id)!, day);
                    if (toward.id === player.id) writeObligations(repos.db, world.obligations.splice(before));
                }
            }
        }
        if (worldLocationFor(world, player.location)?.id === place.id) {
            const area = theAreasOf(world, place, undefined, player).whereIs.get(id);
            if (area) repos.cultivators.standIn(player.id, area);
        }
        if (issued) for (const thing of [issued.robes, issued.token, issued.lamp]) if (thing) world.objects.push(thing);
        writeAdminAudit(repos, 'spawn_encounter', run.id, { opponentNpcId: id, ordinal,
            sex: npc.identity.sex, age, house: house?.id ?? null, rankIndex,
            species: species?.id ?? null, temperament: spec.temperament ?? null });
        writeTheWorldNow(world);
    })();
    return {
        adminMode: true, spawned: true, encounterId: id,
        opponent: { id, name: npc.name, rank: rankName(ordinal) }, location: place.name,
        sex: npc.identity.sex, age, house: house?.name, rung: house?.ranks[rankIndex],
        species: species?.name, temperament: spec.temperament, disposition: spec.disposition,
        alignment: house?.alignment, seal: npc.cultivation.seal, sealHolder: sealHolder?.name,
        guesses: (spec.guesses ?? []).map(guess => `Read '${guess.word}' as ${guess.field} ${guess.value}.`),
        unusedWords: spec.unusedWords ?? [],
        sayThis: ['who is here', 'talk to someone'],
        gateLifted: { note: 'A real world NPC. Their name has not been introduced in play.' }
    };
}
