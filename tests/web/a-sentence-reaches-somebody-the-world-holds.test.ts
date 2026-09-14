/**
 * Three of the room's sentences could not touch the people it sentences.
 *
 * `handDownWhatTheRoomDecided` carries out seven sentences. Three of them asked
 * `repos.cultivators.getById` and acted only on what it returned - a row in the
 * `cultivators` table, which exists for the player and for whoever a test has
 * stood one up for. The people a punishment hall actually brings in front of it
 * are the house's own members, who live in `WorldState` as `NpcRecord` and have
 * no such row. So:
 *
 *   THE SEAL         refused outright - *"there is no record for them to carry a
 *                    seal"* - because `qiSeal` was a column on the other table
 *                    and `NpcRecord` had no equivalent.
 *   THE CRIPPLING    refused the same way. A house could take what somebody had
 *                    built only if a run was being played through them.
 *   THE EXECUTION    worked, and left everything the person was carrying on the
 *                    corpse forever: the object rows still named a dead
 *                    possessor, because the estate path takes a `Cultivator`,
 *                    reads `cultivator_pouch` and zeroes a `cultivators`
 *                    column, none of which an NPC has. The design owner:
 *                    *"the artifacts go to the sect treasury."*
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * A SENTENCE IS A STATE CHANGE OR IT IS NOTHING, which is the rule the fine
 * half of this arc was built on. Every assertion below reads the WORLD - the
 * seal on the record, the wound rows, the object's possessor and owner - and
 * never the returned line. The offender here deliberately has no `cultivators`
 * row at all, so anything that passes is passing on the world's own half.
 *
 * AND THE DEAD DO NOT CHANGE ON THEIR OWN. What the house takes is read off the
 * body BEFORE `markDead` and moved in the same act, because a possessor is a
 * possessor until something moves them and nothing ever sweeps a corpse looking
 * for things to redistribute.
 *
 * RED-CHECKED, all four. Restoring the `cultivators.getById` refusal in either
 * branch fails the seal and the crippling; dropping the `carryingWounds` call
 * fails the wound; dropping the `whatAnEndingLeavesToTheHouse` block fails the
 * estate; leaving the confiscation until after `markDead` fails it too, because
 * the rows are keyed on a possessor.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import {
    SEALED_AND_HELD,
    THE_CAPABILITY_WAS_TAKEN,
    THE_HOUSE_ENDED_THEM,
    handDownWhatTheRoomDecided
} from '../../src/web/a-room-hands-down-what-it-decided';
import { createObligation } from '../../src/engine/social/grudges';
import { writeOneObligation, ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { REALM_TIERS } from '../../src/engine/cultivation/realms';
import { qiSealOpensAt } from '../../src/engine/social/what-laying-a-qi-seal-takes';
import { theSealOn, setRealm } from '../../src/engine/world/npc-state';
import { makeObject, transferPossession } from '../../src/engine/world/possessions';
import { isPermanentWound } from '../../src/data/cultivation/wounds';

const HOUSE = SECTS
    .filter(sect => sect.recruits && sect.alignment === 'righteous')
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/** The two rungs a seal needs, read off the ladder rather than typed. */
const SEALING_TIER = REALM_TIERS.findIndex(tier => tier.ordinalStart === qiSealOpensAt());
const SUBJECT_ORDINAL = REALM_TIERS[SEALING_TIER].ordinalStart;
const SEALER_ORDINAL = REALM_TIERS[SEALING_TIER + 1].ordinalStart;

const ON_DAY = 10;

/**
 * A house, a world, and somebody in front of the room who exists ONLY in the
 * world.
 *
 * The offender is picked out of `world.npcs` and no `cultivators` row is ever
 * created for them, which is the whole arrangement: `repos.cultivators.getById`
 * answers null for them, exactly as it does for the several hundred people a
 * real house could bring in.
 */
async function aRoomAndSomebodyTheWorldHolds(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'sentence-reaches-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    const world = await harness.game.loadWorld();

    const at = world.npcs.findIndex((npc: any) =>
        npc.status === 'alive' && npc.id !== cultivator.id);
    expect(at).toBeGreaterThanOrEqual(0);
    // Put them at the rung a seal can reach, through the engine's own mover
    // rather than by assigning the field: `setRealm` carries the body and the
    // span across with it, and a hand-set ordinal would disagree with both.
    world.npcs[at] = setRealm(world.npcs[at], SUBJECT_ORDINAL, 0);
    const them = world.npcs[at];

    // The arrangement this whole file is about.
    expect(harness.repos.cultivators.getById(them.id)).toBeNull();

    return { harness, world, byId: cultivator.id, them, at };
}

function complain(harness: any, aboutId: string, severity: string) {
    const row = createObligation({
        kind: 'grudge',
        holderId: HOUSE.id,
        subjectId: aboutId,
        cause: 'betrayal',
        severity: severity as never,
        onDay: 0,
        description: 'they gave an order in the house\'s name that was not theirs to give',
        participants: [HOUSE.id],
        tags: [AGAINST_THEIR_OWN]
    });
    writeOneObligation(harness.db, row);
    return row;
}

/** A demonic reading, which is what carries a row up to the heavy sentences. */
const demonic = () => ({
    what: { does: 'reports' as const, toId: 'elder', line: 'it was brought' },
    theirsToPunish: true,
    alignment: 'demonic' as const,
    houseId: HOUSE.id,
    theHouseGaveThemSomething: false
});

function handDown(harness: any, opts: {
    byId: string; them: any; severity: string; world: unknown;
}) {
    return handDownWhatTheRoomDecided({
        repos: harness.repos,
        complaint: complain(harness, opts.them.id, opts.severity),
        byId: opts.byId,
        offenderId: opts.them.id,
        offenderName: opts.them.name,
        offenderOrdinal: opts.them.cultivation.realmOrdinal,
        houseId: HOUSE.id,
        houseName: HOUSE.name,
        onDay: ON_DAY,
        onTurn: 1,
        byOrdinal: SEALER_ORDINAL,
        world: opts.world as never,
        brought: demonic()
    });
}

const tagged = (harness: any, id: string, tag: string) =>
    ledgerAbout(harness.db as never, id).filter((row: any) => (row.tags ?? []).includes(tag));

describe('a sentence reaches somebody the world holds', () => {
    it('seals them, on the record the world actually keeps', async () => {
        const { harness, world, byId, them, at } = await aRoomAndSomebodyTheWorldHolds('reach-seal');

        const handed = handDown(harness, { byId, them, severity: 'serious', world });

        expect(handed.decided.sentence).toBe('years sealed and held');
        expect(handed.notCarriedOutHere).toBeNull();
        expect(handed.sealed).toBe(true);
        expect(handed.theWorldMoved).toBe(true);

        const after = world.npcs[at];
        const seal = theSealOn(after, ON_DAY);
        expect(seal).not.toBeNull();
        expect(seal!.byId).toBe(byId);
        expect(tagged(harness, them.id, SEALED_AND_HELD)).toHaveLength(1);
    }, 300_000);

    it('takes what they built, as a wound the world is carrying', async () => {
        const { harness, world, byId, them, at } =
            await aRoomAndSomebodyTheWorldHolds('reach-cripple');

        const handed = handDown(harness, { byId, them, severity: 'grave', world });

        expect(handed.decided.sentence).toBe('the capability taken');
        expect(handed.notCarriedOutHere).toBeNull();
        expect(handed.woundKey).not.toBeNull();
        expect(handed.theWorldMoved).toBe(true);

        const after = world.npcs[at];
        const rows = after.cultivation.injuries;
        expect(rows).toHaveLength(1);
        expect(rows[0].severity).toBe('crippling');
        expect(rows[0].woundType).toBe(handed.woundKey);
        // The count beside the list, which is the thing `carryingWounds` exists
        // to keep honest and the thing a direct push would have left behind.
        expect(after.cultivation.untreatedInjuries).toBe(1);
        // And it is a maiming, so it has its day in the ledger like every other.
        expect(isPermanentWound(rows[0].woundType)).toBe(true);
        expect(world.history.facts.some((fact: any) =>
            fact.kind === 'injury' && fact.actors.some((a: any) => a.id === them.id))).toBe(true);
        expect(tagged(harness, them.id, THE_CAPABILITY_WAS_TAKEN)).toHaveLength(1);
    }, 300_000);

    it('ends them, and what they were carrying goes to the house', async () => {
        const { harness, world, byId, them, at } =
            await aRoomAndSomebodyTheWorldHolds('reach-death');

        world.objects.push(transferPossession(
            makeObject({
                id: 'a-blade-they-owned', name: 'a blade', kind: 'artifact',
                significance: 'significant', power: 12,
                ownerId: them.id, ownerName: them.name
            }),
            { onDay: 1, toHolderId: them.id, toHolderName: them.name, how: 'bought' }
        ));
        world.npcs[at] = { ...world.npcs[at], spiritStones: 40 };
        const house = world.factions.find((row: any) => row.id === HOUSE.id);
        const purseBefore = Number(house?.resources.spirit_stones ?? 0);

        const handed = handDown(harness, {
            byId, them: world.npcs[at], severity: 'unforgivable', world
        });

        expect(handed.decided.sentence).toBe('death');
        expect(handed.ended).toBe(true);
        expect(world.npcs[at].status).toBe('physically_dead');

        const blade = world.objects.find((row: any) => row.id === 'a-blade-they-owned')!;
        expect(blade.possessorId).toBe(HOUSE.id);
        expect(blade.ownerId).toBe(HOUSE.id);
        expect(blade.provenance[blade.provenance.length - 1].how).toBe('confiscated');
        expect(handed.keptByTheHouse?.objectIds).toContain('a-blade-they-owned');

        // The purse moved and the corpse holds nothing, in that order, and the
        // report says the same figure the purse did - a haul reported as
        // something other than what moved is the defect this arc is about
        // wearing the other face.
        expect(Number(house?.resources.spirit_stones ?? 0)).toBe(purseBefore + 40);
        expect(handed.keptByTheHouse?.stones).toBe(40);
        expect(world.npcs[at].spiritStones).toBe(0);
        expect(tagged(harness, them.id, THE_HOUSE_ENDED_THEM)).toHaveLength(1);
    }, 300_000);

    it('takes nothing off somebody who was carrying nothing, and says so', async () => {
        const { harness, world, byId, them, at } =
            await aRoomAndSomebodyTheWorldHolds('reach-death-empty');
        world.npcs[at] = { ...world.npcs[at], spiritStones: 0 };

        const handed = handDown(harness, {
            byId, them: world.npcs[at], severity: 'unforgivable', world
        });

        expect(handed.ended).toBe(true);
        // Reported as an empty haul rather than as no haul: the house did carry
        // the sentence out, and most people are carrying nothing.
        expect(handed.keptByTheHouse?.objectIds).toEqual([]);
        expect(handed.keptByTheHouse?.stones).toBe(0);
    }, 300_000);
});
