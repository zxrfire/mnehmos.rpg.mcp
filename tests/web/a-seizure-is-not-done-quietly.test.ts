/**
 * The house took the thing back and nobody went and took it.
 *
 * `a-room-hands-down-what-it-decided.ts` moved the object row and wrote the
 * receipt, and that was the whole of the sentence: no party, no arrival, and no
 * notice. The design owner's ruling is that the seizure is a PUNISHMENT rather
 * than a recall - *"it sends the punishment disciples or even the elder to
 * enforce"* - and `a-house-holds-its-own.ts` has said since it was written that
 * taking back what a house GAVE *"is a seizure, which is a thing houses do and
 * is not a thing they can do quietly."* Neither half was carried out.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * SOMEBODY GOES, AND THEY GO TO THE PERSON. The party's own world rows are
 * what is read, not the report: a sentence carried out on somebody standing
 * somewhere else is the silent state change this leg exists to close, and a
 * line saying they came is not evidence they came.
 *
 * THE SEIZURE IS READ OUT AND THE LOAN IS NOT. A loan called in moved no
 * register and is nobody else's business; a bestowal taken back is the house
 * spending a thing and taking it back anyway. One `said_in_public` row for the
 * first and none for the second is the assertion that keeps the two footings
 * apart at the noisy end, exactly as `takeItBack` keeps them apart at the
 * register.
 *
 * AND THE NOTICE CARRIES THE SENTENCE AND NOT THE REASON. The owner, on how
 * houses announce judgements: *"they announce xyz has been caught and been
 * sentenced to death."* The summary names who and what was taken; the cause on
 * the complaint row is not in it.
 *
 * ── WHY THE ALIGNMENT MOVES AND THE HOUSE DOES NOT ───────────────────────
 *
 * One sentence is wanted at two severities, and a severity only reaches that
 * rung for one kind of house: the ladder position is the severity plus how far
 * the house goes, so a lighter row needs a house that goes further. The
 * alignment is therefore ASKED FOR rather than typed - `whatTheRoomDecides` is
 * run over the three until one lands on the rung - and the house is the same
 * house in every case, which isolates the severity as the only thing choosing
 * who goes.
 *
 * RED-CHECKED, all four. Dropping the arrival loop fails the two that read the
 * party's `locationId`; holding `wantsTheElder` at false fails the elder case;
 * announcing on both footings fails the loan.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { handDownWhatTheRoomDecided } from '../../src/web/a-room-hands-down-what-it-decided';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../../src/engine/social-leverage/reporting-what-you-saw';
import { whatTheRoomDecides } from '../../src/engine/social-leverage/what-a-room-decides-about-one-of-its-own';
import { THE_ELDER_GOES_IN_PERSON_AT } from '../../src/engine/social-leverage/somebody-is-sent-to-carry-it-out';
import { makeObject, transferPossession } from '../../src/engine/world/possessions';
import { createObligation } from '../../src/engine/social/grudges';
import { SEVERITY_ORDER, severityRank, type Severity } from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { getNpc, upsertNpc } from '../../src/engine/world/world-state';
import { setLocation } from '../../src/engine/world/npc-state';

const HOUSE = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) => sect.id < best.id ? sect : best);

/** The band below where the elder starts going himself. */
const BELOW = SEVERITY_ORDER[severityRank(THE_ELDER_GOES_IN_PERSON_AT) - 1] as Severity;

const ALIGNMENTS = ['righteous', 'neutral', 'demonic'] as const;

/**
 * The kind of house whose room answers this severity with the seizure.
 *
 * Asked of the room rather than worked out here: the rung is severity plus how
 * far the house goes, and a second copy of that sum in a test is a second copy
 * that will disagree the day either half moves.
 */
function aHouseThatReachesIt(severity: Severity): typeof ALIGNMENTS[number] {
    const found = ALIGNMENTS.find(alignment => whatTheRoomDecides({
        what: { does: 'reports', toId: 'somebody', line: 'it was brought' },
        theirsToPunish: true,
        alignment,
        severity,
        houseId: HOUSE.id,
        theHouseGaveThemSomething: true
    }).sentence === 'what the house gave is taken back');
    expect(found, `no kind of house answers ${severity} with the seizure`).toBeDefined();
    return found!;
}

/**
 * A house, a person in front of the room, a hand posted to it, and a thing.
 *
 * The rooms are handed over as data rather than dealt by `whoIsInChargeOfWhat`,
 * because which rung gets which room is positional and pinning it would pin the
 * deal instead of the sentence. The deal itself is exercised where it is made.
 */
async function aSeizure(seed: string, how: 'awarded' | 'lent') {
    const harness = await makeGameInWorld({ seed, worldSeed: 'seizure-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.repos.sects.addMember(HOUSE.id, cultivator.id, HOUSE.ranks.length - 2);

    const world = await harness.game.loadWorld();
    const ours = world.npcs.filter((npc: any) =>
        npc.factionId === HOUSE.id && npc.status === 'alive');
    const offender = ours[0];
    const hand = ours[1];
    expect(offender, 'the world seeds this house with people').toBeDefined();
    expect(hand, 'the world seeds this house with more than one person').toBeDefined();

    // Somewhere for it to happen, and the hand somewhere else, so an arrival is
    // a movement rather than a coincidence.
    const there = offender.locationId ?? world.locations[0].id;
    const elsewhere = world.locations.find((place: any) => place.id !== there)!.id;
    Object.assign(world, upsertNpc(world, setLocation(offender, there, 0)));
    Object.assign(world, upsertNpc(world, setLocation(hand, elsewhere, 0)));

    const me = harness.repos.cultivators.getById(cultivator.id)!;
    harness.repos.cultivators.create({
        ...me, id: offender.id, name: offender.name, kind: 'npc'
    });
    harness.repos.sects.addMember(HOUSE.id, offender.id, 0);

    world.objects.push(transferPossession(
        makeObject({
            id: 'the-thing', name: 'a plain iron blade', kind: 'artifact',
            significance: 'significant', power: 12, ownerId: HOUSE.id, ownerName: HOUSE.name
        }),
        {
            onDay: 1, toHolderId: offender.id, toHolderName: offender.name, how,
            ...(how === 'awarded' ? { transfersOwnership: true } : {}),
            source: HOUSE.name
        }
    ));

    const complaint = (severity: Severity) => {
        const row = createObligation({
            kind: 'grudge',
            holderId: HOUSE.id,
            subjectId: offender.id,
            cause: 'betrayal',
            severity,
            onDay: 0,
            description: 'they gave an order in the house\'s name that was not theirs to give',
            participants: [HOUSE.id],
            tags: [AGAINST_THEIR_OWN]
        });
        writeOneObligation(harness.db, row);
        return row;
    };

    const handDown = (severity: Severity) =>
        handDownWhatTheRoomDecided({
            repos: harness.repos,
            complaint: complaint(severity),
            byId: cultivator.id,
            byName: cultivator.name,
            offenderId: offender.id,
            offenderName: offender.name,
            offenderOrdinal: 1,
            houseId: HOUSE.id,
            houseName: HOUSE.name,
            onDay: 10,
            onTurn: 1,
            world,
            portfolios: [
                { purpose: THE_ROOM_COMPLAINTS_GO_TO, holderId: cultivator.id, depth: 0.65 }
            ],
            posts: [
                {
                    purpose: THE_ROOM_COMPLAINTS_GO_TO,
                    personId: hand.id,
                    selectedById: cultivator.id
                }
            ],
            brought: {
                what: { does: 'reports', toId: cultivator.id, line: 'it was brought' },
                theirsToPunish: true,
                alignment: aHouseThatReachesIt(severity),
                houseId: HOUSE.id,
                theHouseGaveThemSomething: true
            }
        });

    return { harness, world, playerId: cultivator.id, offender, hand, handDown, there };
}

describe('somebody goes and takes it', () => {
    it('sends the posted disciple, who is standing there when it happens', async () => {
        const { world, hand, handDown, there } = await aSeizure('seizure-hands', 'awarded');

        const handed = handDown(BELOW);

        expect(handed.decided.sentence).toBe('what the house gave is taken back');
        expect(handed.whoWent?.who).toBe('disciples posted to the room');
        expect(handed.whoWent?.partyIds).toEqual([hand.id]);
        // The report is not the evidence. The row is.
        expect(getNpc(world, hand.id)?.locationId).toBe(there);
        expect(handed.wherePlace).not.toBeNull();
    }, 300_000);

    it('sends the elder in person once the row is grave enough', async () => {
        const { world, playerId, hand, handDown, there } =
            await aSeizure('seizure-elder', 'awarded');

        const handed = handDown(THE_ELDER_GOES_IN_PERSON_AT);

        expect(handed.decided.sentence).toBe('what the house gave is taken back');
        expect(handed.whoWent?.who).toBe('the elder whose room it is');
        expect(handed.whoWent?.partyIds).toEqual([playerId, hand.id]);
        expect(getNpc(world, hand.id)?.locationId).toBe(there);
    }, 300_000);

    it('reads a seizure out, naming the sentence and not the reason', async () => {
        const { world, offender, handDown } = await aSeizure('seizure-said', 'awarded');

        const handed = handDown(BELOW);

        expect(handed.tookBack?.footing).toBe('seized');
        expect(handed.readOut).toBe(true);

        const said = world.history.facts.filter((fact: any) => fact.kind === 'said_in_public');
        expect(said).toHaveLength(1);
        expect(said[0].summary).toContain(offender.name);
        // The sentence is public where the reason is not.
        expect(said[0].summary).not.toContain('was not theirs to give');
    }, 300_000);

    it('says nothing in public when a loan ends, because a loan ending is not that act',
        async () => {
            const { world, handDown } = await aSeizure('seizure-loan', 'lent');

            const handed = handDown(BELOW);

            expect(handed.tookBack?.footing).toBe('called in');
            expect(handed.readOut).toBe(false);
            expect(world.history.facts.filter((fact: any) => fact.kind === 'said_in_public'))
                .toHaveLength(0);
        }, 300_000);
});
