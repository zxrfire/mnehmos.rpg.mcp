/**
 * Five of the seven sentences a punishment hall can hand down did nothing.
 *
 * `whatTheRoomDecides` has had a seven-rung ladder since it was written and
 * `handDownWhatTheRoomDecided` carried out two rungs of it - the rebuke and the
 * fine. The other five reported `notCarriedOutHere`, naming a module, and for
 * four of them the module existed and was simply never called; for the fifth,
 * taking back what a house handed over, THERE WAS NO SUCH FUNCTION ANYWHERE.
 * Measured before this landed: `grep -rn "whatLayingASealTakes" src/` returned
 * the engine file and one comment, and nothing in `src/web/` at all, so no
 * sentence anybody could be given had ever put a seal on anybody.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * A SENTENCE IS A STATE CHANGE OR IT IS NOTHING. Every played assertion below
 * reads the store rather than the sentence: the object row's possessor, the
 * `qiSeal` column, the injury table, `alive`. A line saying a thing happened is
 * not evidence the thing happened, and that is the exact defect the fine half of
 * this arc was built to close.
 *
 * ONLY WHAT THE HOUSE HANDED OVER IS REACHABLE. A house that can take anything
 * off you because it is annoyed with you is not a house. What the person bought
 * or took is untouchable at every severity, and `whatThisHouseHandedOver`
 * returning an empty list for it is the assertion that says so.
 *
 * AND THE LOAN GOES BEFORE THE BESTOWAL, because calling in a loan is the
 * lesser act - the register never moves - and a room that seizes while a loan is
 * sitting in the same hands has done more than it decided.
 *
 * RED-CHECKED, all four run. Sorting bestowals first in
 * `whatThisHouseHandedOver` fails the ordering; holding `transfersOwnership`
 * at false in `takeItBack` fails the seizure's register check; dropping the
 * `repos.cultivators.update` call in the seal branch fails the seal; dropping
 * `addInjury` fails the crippling.
 *
 * The fourth of those is worth naming because the obvious version of it does
 * NOT go red: forcing `transfersOwnership` to TRUE changes nothing observable
 * on a loan, since the house was the owner the whole time. Only the seizure can
 * see that field, which is the asymmetry the two footings exist to carry.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { getMembersOf } from '../../src/data/cultivation/members';
import {
    SEALED_AND_HELD,
    THE_CAPABILITY_WAS_TAKEN,
    THE_HOUSE_ENDED_THEM,
    WHAT_THE_HOUSE_GAVE_IS_BACK,
    handDownWhatTheRoomDecided
} from '../../src/web/a-room-hands-down-what-it-decided';
import {
    takeItBack,
    whatThisHouseHandedOver
} from '../../src/engine/world/a-house-takes-back-what-it-handed-over';
import { makeObject, transferPossession } from '../../src/engine/world/possessions';
import { createObligation } from '../../src/engine/social/grudges';
import { writeOneObligation, ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { REALM_TIERS } from '../../src/engine/cultivation/realms';
import { qiSealOpensAt } from '../../src/engine/social/what-laying-a-qi-seal-takes';

const HOUSE = SECTS
    .filter(sect => sect.recruits && sect.alignment === 'righteous')
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

const HOUSE_IDS = new Set([HOUSE.id]);

/**
 * The two rungs a seal needs, read off the ladder rather than typed.
 *
 * Sealing opens at Core Formation and a seal needs a gap to hold at all, so the
 * subject sits at the tier sealing opens on and whoever seals them one above it.
 * `MAX_ORDINAL` and the tier list have both been rewritten; a number copied out
 * of them is a coincidence maintained by attention.
 */
const SEALING_TIER = REALM_TIERS.findIndex(tier => tier.ordinalStart === qiSealOpensAt());
const SUBJECT_ORDINAL = REALM_TIERS[SEALING_TIER].ordinalStart;
const SEALER_ORDINAL = REALM_TIERS[SEALING_TIER + 1].ordinalStart;

// ─────────────────────────────────────────────────────────────────────────
// WHAT A HOUSE CAN REACH, WHICH IS ONLY WHAT IT HANDED OVER
// ─────────────────────────────────────────────────────────────────────────

function aThing(id: string, power: number) {
    return makeObject({
        id, name: `a thing called ${id}`, kind: 'weapon', significance: 'significant',
        power, ownerId: HOUSE.id, ownerName: HOUSE.name
    });
}

/** Lent: the house keeps the register and hands over the thing. */
function lentTo(id: string, power: number, toId: string) {
    return transferPossession(aThing(id, power), {
        onDay: 1, toHolderId: toId, toHolderName: 'Them', how: 'lent', source: HOUSE.name
    });
}

/** Bestowed the way seeding bestows: out of the treasury, register and all. */
function bestowedOn(id: string, power: number, toId: string) {
    return transferPossession(aThing(id, power), {
        onDay: 1, toHolderId: toId, toHolderName: 'Them', how: 'awarded',
        transfersOwnership: true, source: HOUSE.name
    });
}

describe('what a house can take back', () => {
    const asked = (objects: any[]) => whatThisHouseHandedOver({
        objects, houseId: HOUSE.id, houseName: HOUSE.name, fromId: 'them', houseIds: HOUSE_IDS
    });

    it('reaches a loan and a bestowal, and calls them different acts', () => {
        expect(asked([lentTo('lent', 5, 'them')]).map(row => row.footing)).toEqual(['called in']);
        expect(asked([bestowedOn('given', 5, 'them')]).map(row => row.footing)).toEqual(['seized']);
    });

    it('cannot reach what the house never handed over', () => {
        const bought = transferPossession(
            makeObject({ id: 'bought', name: 'theirs', kind: 'weapon', ownerId: 'them', ownerName: 'Them' }),
            { onDay: 1, toHolderId: 'them', toHolderName: 'Them', how: 'bought', transfersOwnership: true }
        );
        const stolen = transferPossession(aThing('stolen', 9), {
            onDay: 1, toHolderId: 'them', toHolderName: 'Them', how: 'stolen'
        });
        // The stolen one is the house's and the house did not hand it over.
        // Recovering it is a different act with its own word, and the room's
        // sentence is not that word.
        expect(asked([bought, stolen])).toEqual([]);
    });

    it('puts the loan before the bestowal, however good the bestowal is', () => {
        const order = asked([bestowedOn('given', 99, 'them'), lentTo('lent', 1, 'them')]);
        expect(order.map(row => row.footing)).toEqual(['called in', 'seized']);
    });

    it('moves the register for a seizure and not for a loan', () => {
        const back = { houseId: HOUSE.id, houseName: HOUSE.name, onDay: 9, note: 'the room said so' };

        const loan = takeItBack(asked([lentTo('lent', 5, 'them')])[0], back);
        expect(loan.possessorId).toBe(HOUSE.id);
        expect(loan.ownerId).toBe(HOUSE.id);

        const gift = takeItBack(asked([bestowedOn('given', 5, 'them')])[0], back);
        expect(gift.possessorId).toBe(HOUSE.id);
        // It had stopped being the house's. Taking it back is the register
        // moving a second time, which is what makes it a seizure.
        expect(gift.ownerId).toBe(HOUSE.id);
        expect(gift.provenance[gift.provenance.length - 1].how).toBe('confiscated');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE ROOM CARRYING EACH ONE OUT
// ─────────────────────────────────────────────────────────────────────────

/** A house, somebody in front of the room, and a row about them. */
async function aRoom(seed: string, ordinal = SUBJECT_ORDINAL) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'carried-out-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.repos.sects.addMember(HOUSE.id, cultivator.id, HOUSE.ranks.length - 2);

    const other = getMembersOf(HOUSE.id).find((m: any) => m.rankIndex === 0)
        ?? getMembersOf(HOUSE.id)[0];
    const me = harness.repos.cultivators.getById(cultivator.id)!;
    harness.repos.cultivators.create({
        ...me, id: other.id, name: other.name, kind: 'npc', realmOrdinal: ordinal
    });
    harness.repos.sects.addMember(HOUSE.id, other.id, 0);

    return { harness, playerId: cultivator.id, other };
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

/**
 * A demonic reading, which is what carries a row up the ladder far enough to
 * reach the five rungs above the fine. The alignment is the only thing moving
 * it - there is no table of offences anywhere in this arc.
 */
const demonic = (gave = false) => ({
    what: { does: 'reports' as const, toId: 'elder', line: 'it was brought' },
    theirsToPunish: true,
    alignment: 'demonic' as const,
    houseId: HOUSE.id,
    theHouseGaveThemSomething: gave
});

async function handDown(harness: any, opts: {
    playerId: string; other: any; severity: string; gave?: boolean; world?: unknown;
}) {
    return handDownWhatTheRoomDecided({
        repos: harness.repos,
        complaint: complain(harness, opts.other.id, opts.severity),
        byId: opts.playerId,
        offenderId: opts.other.id,
        offenderName: opts.other.name,
        offenderOrdinal: harness.repos.cultivators.getById(opts.other.id)!.realmOrdinal,
        houseId: HOUSE.id,
        houseName: HOUSE.name,
        onDay: 10,
        onTurn: 1,
        byOrdinal: SEALER_ORDINAL,
        world: opts.world as never,
        brought: demonic(opts.gave ?? false)
    });
}

const tagged = (harness: any, id: string, tag: string) =>
    ledgerAbout(harness.db as never, id).filter((row: any) => (row.tags ?? []).includes(tag));

describe('the room carries it out', () => {
    it('takes a lent thing back, and the object row is what moved', async () => {
        const { harness, playerId, other } = await aRoom('carried-out-recall');
        const world = await harness.game.loadWorld();
        world.objects.push(lentTo('a-lent-blade', 12, other.id));

        const handed = await handDown(harness, {
            playerId, other, severity: 'slight', gave: true, world
        });

        expect(handed.decided.sentence).toBe('what the house gave is taken back');
        expect(handed.notCarriedOutHere).toBeNull();
        expect(handed.tookBack?.footing).toBe('called in');

        const moved = world.objects.find((row: any) => row.id === 'a-lent-blade')!;
        expect(moved.possessorId).toBe(HOUSE.id);
        expect(tagged(harness, other.id, WHAT_THE_HOUSE_GAVE_IS_BACK)).toHaveLength(1);
    }, 300_000);

    it('takes nothing and says so where the house has nothing out with them', async () => {
        const { harness, playerId, other } = await aRoom('carried-out-nothing-out');
        const world = await harness.game.loadWorld();

        const handed = await handDown(harness, {
            playerId, other, severity: 'slight', gave: true, world
        });

        // A sentence reported as carried out that moved no state is the defect
        // this arc exists to close, so the honest report survives here.
        expect(handed.tookBack).toBeNull();
        expect(handed.notCarriedOutHere).not.toBeNull();
        expect(tagged(harness, other.id, WHAT_THE_HOUSE_GAVE_IS_BACK)).toHaveLength(0);
    }, 300_000);

    it('seals them, and the column and the pool are what moved', async () => {
        const { harness, playerId, other } = await aRoom('carried-out-seal');
        const world = await harness.game.loadWorld();
        const before = harness.repos.cultivators.getById(other.id)!;

        const handed = await handDown(harness, {
            playerId, other, severity: 'serious', world
        });

        expect(handed.decided.sentence).toBe('years sealed and held');
        expect(handed.notCarriedOutHere).toBeNull();
        expect(handed.sealed).toBe(true);

        const after = harness.repos.cultivators.getById(other.id)!;
        expect(after.qiSeal).not.toBeNull();
        expect(after.qiSeal!.byId).toBe(playerId);
        // The lid goes on at once rather than leaking away, and the CEILING is
        // untouched: a seal is a lid, not a wound.
        expect(after.qi).toBeLessThanOrEqual(before.qi);
        expect(after.maxQi).toBe(before.maxQi);
        expect(tagged(harness, other.id, SEALED_AND_HELD)).toHaveLength(1);
    }, 300_000);

    it('takes the capability, as a crippling wound in the injury table', async () => {
        const { harness, playerId, other } = await aRoom('carried-out-cripple');
        const world = await harness.game.loadWorld();

        const handed = await handDown(harness, {
            playerId, other, severity: 'grave', world
        });

        expect(handed.decided.sentence).toBe('the capability taken');
        expect(handed.notCarriedOutHere).toBeNull();
        expect(handed.woundKey).not.toBeNull();

        const hurt = harness.repos.cultivators.listInjuries(other.id);
        expect(hurt).toHaveLength(1);
        expect(hurt[0].severity).toBe('crippling');
        expect(hurt[0].woundType).toBe(handed.woundKey);
        expect(tagged(harness, other.id, THE_CAPABILITY_WAS_TAKEN)).toHaveLength(1);
    }, 300_000);

    it('ends them, through the one function that ends anybody', async () => {
        const { harness, playerId, other } = await aRoom('carried-out-death');
        const world = await harness.game.loadWorld();

        const handed = await handDown(harness, {
            playerId, other, severity: 'unforgivable', world
        });

        expect(handed.decided.sentence).toBe('death');
        expect(handed.ended).toBe(true);
        expect(harness.repos.cultivators.getById(other.id)!.alive).toBe(false);
        expect(tagged(harness, other.id, THE_HOUSE_ENDED_THEM)).toHaveLength(1);
    }, 300_000);

    it('settles the complaint whichever sentence it was', async () => {
        const { harness, playerId, other } = await aRoom('carried-out-settled');
        const world = await harness.game.loadWorld();
        const handed = await handDown(harness, { playerId, other, severity: 'grave', world });
        // A row left open after the room has read it is the state the whole arc
        // exists to leave behind.
        expect(handed.settled?.status).toBe('settled');
    }, 300_000);
});
