/**
 * Three of the four sentences carried out on a person happened with nobody there.
 *
 * `whoIsSentToCarryItOut` was written to close exactly this - the object that
 * changed hands with no hand in it - and it was wired to the seizure and to
 * nothing else. The seal, the crippling and the death went on moving state with
 * no party named, nobody travelling, and nothing in the report to say who came:
 * a house sealed one of its own from wherever the room happened to be sitting.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * SOMEBODY GOES, AND THE ROW IS THE EVIDENCE. Every arrival below is asserted
 * off the party's own `locationId` and never off the returned line. A sentence
 * saying somebody came is the same defect one layer up.
 *
 * WHO COMES IS TWO READINGS AND NOT ONE. Severity alone decided this while the
 * seizure was the only errand, and the seizure is the lightest of the four. A
 * house that answers a row UNDER the severity band with a sentence carried out
 * on the person - which is reachable, and the fixture finds the case rather than
 * naming it - sent two ordinary disciples to seal a cultivator while the elder
 * stayed in his room. The sentence's own rung is the second reading, and either
 * one sends the elder.
 *
 * A HOUSE SHORT OF PEOPLE SAYS SO AND THE SENTENCE STILL HAPPENS. The room
 * decided it; having nobody to walk it over is a fact about the house. Reported
 * as `nobody the house could send` rather than as a party that was never there,
 * which is the answer the seizure has always given.
 *
 * AND THE ONE BEING PLAYED IS REACHED THROUGH `offenderAt` AND NOTHING ELSE.
 * The played row holds `locationId: null` by design, so a party has nowhere to
 * come to unless the caller says where they stand. The last case passes a place
 * and asserts the party arrived at it - if a second notion of where the player
 * is ever appears under here, this is what goes red.
 *
 * RED-CHECKED, all five. Dropping the `somebodyGoes` call from a branch fails
 * that branch's arrival; dropping the `sentence` field from the call fails the
 * light-row case and nothing else; returning early on an empty party fails the
 * shorthanded case; ignoring `at.id` in the arrival loop fails the played one.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { handDownWhatTheRoomDecided } from '../../src/web/a-room-hands-down-what-it-decided';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../../src/engine/social-leverage/reporting-what-you-saw';
import {
    SENTENCES_IN_ORDER,
    whatTheRoomDecides,
    type Sentence
} from '../../src/engine/social-leverage/what-a-room-decides-about-one-of-its-own';
import {
    THE_ELDER_GOES_IN_PERSON_AT,
    THE_ELDER_GOES_IN_PERSON_FOR
} from '../../src/engine/social-leverage/somebody-is-sent-to-carry-it-out';
import {
    createObligation,
    SEVERITY_ORDER,
    severityRank,
    type Severity
} from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { getNpc, upsertNpc } from '../../src/engine/world/world-state';
import { setLocation, setRealm } from '../../src/engine/world/npc-state';
import { REALM_TIERS } from '../../src/engine/cultivation/realms';
import { qiSealOpensAt } from '../../src/engine/social/what-laying-a-qi-seal-takes';

const ALIGNMENTS = ['righteous', 'neutral', 'demonic'] as const;
type Alignment = typeof ALIGNMENTS[number];

/** The two rungs a seal needs, read off the ladder rather than typed. */
const SEALING_TIER = REALM_TIERS.findIndex(tier => tier.ordinalStart === qiSealOpensAt());
const SUBJECT_ORDINAL = REALM_TIERS[SEALING_TIER].ordinalStart;
const SEALER_ORDINAL = REALM_TIERS[SEALING_TIER + 1].ordinalStart;

const ON_DAY = 10;
const BROUGHT = { does: 'reports' as const, toId: 'somebody', line: 'it was brought' };

const reads = (severity: Severity, alignment: Alignment): Sentence => whatTheRoomDecides({
    what: BROUGHT,
    theirsToPunish: true,
    alignment,
    severity,
    houseId: null,
    theHouseGaveThemSomething: false
}).sentence;

/**
 * A row and a kind of house whose room answers it with this sentence.
 *
 * Asked of the room rather than worked out here: the rung is the severity plus
 * how far the house goes, and a second copy of that sum in a test is a second
 * copy that disagrees the day either half moves.
 */
function aRowThatReaches(sentence: Sentence): { severity: Severity; alignment: Alignment } {
    for (const severity of SEVERITY_ORDER) {
        for (const alignment of ALIGNMENTS) {
            if (reads(severity, alignment) === sentence) return { severity, alignment };
        }
    }
    throw new Error(`no kind of house answers any row with ${sentence}`);
}

/**
 * The case severity alone got wrong: a row under the band, answered with a
 * sentence carried out on the person.
 */
function aLightRowThatReachesAHeavySentence():
    { severity: Severity; alignment: Alignment; sentence: Sentence } | null {
    const heavy = SENTENCES_IN_ORDER.indexOf(THE_ELDER_GOES_IN_PERSON_FOR);
    for (const severity of SEVERITY_ORDER) {
        if (severityRank(severity) >= severityRank(THE_ELDER_GOES_IN_PERSON_AT)) continue;
        for (const alignment of ALIGNMENTS) {
            const sentence = reads(severity, alignment);
            if (SENTENCES_IN_ORDER.indexOf(sentence) >= heavy) {
                return { severity, alignment, sentence };
            }
        }
    }
    return null;
}

/**
 * A house with three people standing, an offender in one place and the room's
 * two people in another.
 *
 * The house is read off the world rather than off the catalog - which house the
 * worldgen seeds most heavily is the worldgen's business - and the offender
 * exists ONLY in the world, which is who a punishment hall actually brings in.
 */
async function aRoomAndAParty(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'came-for-them-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    const world = await harness.game.loadWorld();

    const biggest = world.factions
        .map((faction: any) => ({
            faction,
            people: world.npcs.filter((npc: any) =>
                npc.factionId === faction.id
                && npc.status === 'alive'
                && npc.id !== cultivator.id)
        }))
        .sort((a: any, b: any) =>
            b.people.length - a.people.length
            || (a.faction.id < b.faction.id ? -1 : 1))[0];
    const house = biggest.faction;
    const [offenderRow, hand, elder] = biggest.people;
    expect(elder, 'the world seeds some house with three people standing').toBeDefined();

    const there = offenderRow.locationId ?? world.locations[0].id;
    const elsewhere = world.locations.find((place: any) => place.id !== there)!.id;
    Object.assign(world, upsertNpc(
        world, setLocation(setRealm(offenderRow, SUBJECT_ORDINAL, 0), there, 0)
    ));
    Object.assign(world, upsertNpc(world, setLocation(hand, elsewhere, 0)));
    Object.assign(world, upsertNpc(world, setLocation(elder, elsewhere, 0)));
    const offender = getNpc(world, offenderRow.id)!;

    const complain = (severity: Severity, aboutId: string) => {
        const row = createObligation({
            kind: 'grudge',
            holderId: house.id,
            subjectId: aboutId,
            cause: 'betrayal',
            severity,
            onDay: 0,
            description: 'they gave an order in the house\'s name that was not theirs to give',
            participants: [house.id],
            tags: [AGAINST_THEIR_OWN]
        });
        writeOneObligation(harness.db, row);
        return row;
    };

    const handDown = (opts: {
        severity: Severity;
        alignment: Alignment;
        /** Omitted means the offender the world holds, standing at `there`. */
        offenderId?: string;
        offenderName?: string;
        offenderOrdinal?: number;
        offenderAt?: { id?: string | null; name?: string | null };
        /** Omitted means the elder holds the room and the hand is posted to it. */
        theHouseHasPeople?: boolean;
    }) => handDownWhatTheRoomDecided({
        repos: harness.repos,
        complaint: complain(opts.severity, opts.offenderId ?? offender.id),
        byId: elder.id,
        byName: elder.name,
        offenderId: opts.offenderId ?? offender.id,
        offenderName: opts.offenderName ?? offender.name,
        offenderOrdinal: opts.offenderOrdinal ?? offender.cultivation.realmOrdinal,
        houseId: house.id,
        houseName: house.name,
        onDay: ON_DAY,
        onTurn: 1,
        byOrdinal: SEALER_ORDINAL,
        world,
        offenderAt: opts.offenderAt,
        portfolios: opts.theHouseHasPeople === false
            ? []
            : [{ purpose: THE_ROOM_COMPLAINTS_GO_TO, holderId: elder.id, depth: 0.65 }],
        posts: opts.theHouseHasPeople === false
            ? []
            : [{
                purpose: THE_ROOM_COMPLAINTS_GO_TO,
                personId: hand.id,
                selectedById: elder.id
            }],
        brought: {
            what: BROUGHT,
            theirsToPunish: true,
            alignment: opts.alignment,
            houseId: house.id,
            theHouseGaveThemSomething: false
        }
    });

    return { harness, world, cultivator, house, offender, hand, elder, there, handDown };
}

describe('somebody comes for the other three', () => {
    it('sends a party for the seal, and they are standing there when it goes on', async () => {
        const { world, hand, elder, there, handDown } = await aRoomAndAParty('came-seal');

        const handed = handDown(aRowThatReaches('years sealed and held'));

        expect(handed.decided.sentence).toBe('years sealed and held');
        expect(handed.sealed).toBe(true);
        expect(handed.whoWent).not.toBeNull();
        expect(handed.whoWent!.partyIds.length).toBeGreaterThan(0);
        // The rows, not the report.
        for (const id of handed.whoWent!.partyIds) {
            expect(getNpc(world, id)?.locationId, id).toBe(there);
        }
        // The house's own people and no new role.
        expect(handed.whoWent!.partyIds.every(id => id === hand.id || id === elder.id)).toBe(true);
    }, 300_000);

    it('sends a party for the crippling', async () => {
        const { world, there, handDown } = await aRoomAndAParty('came-cripple');

        const handed = handDown(aRowThatReaches('the capability taken'));

        expect(handed.decided.sentence).toBe('the capability taken');
        expect(handed.woundKey).not.toBeNull();
        expect(handed.whoWent!.partyIds.length).toBeGreaterThan(0);
        for (const id of handed.whoWent!.partyIds) {
            expect(getNpc(world, id)?.locationId, id).toBe(there);
        }
    }, 300_000);

    it('sends a party for the death, and they arrive before it happens', async () => {
        const { world, offender, there, handDown } = await aRoomAndAParty('came-death');

        const handed = handDown(aRowThatReaches('death'));

        expect(handed.decided.sentence).toBe('death');
        expect(handed.ended).toBe(true);
        expect(getNpc(world, offender.id)?.status).toBe('physically_dead');
        // Read where they stood while they were still standing: a party sent to
        // where a corpse ended up is a different fact.
        expect(handed.wherePlace).not.toBeNull();
        for (const id of handed.whoWent!.partyIds) {
            expect(getNpc(world, id)?.locationId, id).toBe(there);
        }
    }, 300_000);

    it('sends the elder for a sentence the severity alone would have left to the hands',
        async () => {
            const light = aLightRowThatReachesAHeavySentence();
            expect(
                light,
                'no house answers a row under the band with a sentence over it, so the sentence '
                + 'read buys nothing and should come out'
            ).not.toBeNull();

            const { elder, handDown } = await aRoomAndAParty('came-light-row');
            const handed = handDown(light!);

            expect(handed.decided.sentence).toBe(light!.sentence);
            expect(severityRank(light!.severity))
                .toBeLessThan(severityRank(THE_ELDER_GOES_IN_PERSON_AT));
            expect(handed.whoWent!.who).toBe('the elder whose room it is');
            expect(handed.whoWent!.partyIds[0]).toBe(elder.id);
        }, 300_000);

    it('says a house has nobody to send, and hands the sentence down anyway', async () => {
        const { world, offender, handDown } = await aRoomAndAParty('came-nobody');

        const handed = handDown({ ...aRowThatReaches('death'), theHouseHasPeople: false });

        expect(handed.whoWent!.who).toBe('nobody the house could send');
        expect(handed.whoWent!.partyIds).toEqual([]);
        // The room decided it. Being short of hands is a fact about the house,
        // reported rather than swallowed, and not a veto on what was decided.
        expect(handed.ended).toBe(true);
        expect(getNpc(world, offender.id)?.status).toBe('physically_dead');
    }, 300_000);

    it('comes to the one being played at the place the caller named', async () => {
        const { harness, world, cultivator, there, handDown } = await aRoomAndAParty('came-played');
        const place = world.locations.find((row: any) => row.id === there)!;
        const me = harness.repos.cultivators.getById(cultivator.id)!;

        const handed = handDown({
            ...aRowThatReaches('years sealed and held'),
            offenderId: me.id,
            offenderName: me.name,
            offenderOrdinal: me.realmOrdinal,
            offenderAt: { id: place.id, name: place.name }
        });

        expect(handed.sealed).toBe(true);
        expect(handed.wherePlace).toBe(place.name);
        expect(handed.whoWent!.partyIds.length).toBeGreaterThan(0);
        for (const id of handed.whoWent!.partyIds) {
            expect(getNpc(world, id)?.locationId, id).toBe(place.id);
        }
        // And nothing wrote a place onto the played row, which is the one copy
        // of that fact and is the play layer's.
        expect(getNpc(world, me.id)?.locationId ?? null).toBeNull();
    }, 300_000);
});
