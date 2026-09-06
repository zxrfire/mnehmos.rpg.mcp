/**
 * BEING BACKED IS A TRADE, AND ONLY ONE SIDE OF IT WAS PLAYED.
 *
 * `whatTheHouseDoesAboutIt` has two ways of answering a house that cannot
 * reach you. Where nothing stands behind you it acts. Where your own house
 * does, it sets `redirectedTo` and hands the matter to the people who have a
 * claim on you - which is what this genre actually does about an offence
 * across house lines. Not a duel. A letter.
 *
 * `theComplaintYourHouseReceives` is the second pass and had no caller
 * anywhere, so the redirect was a dead end in the engine. A ranked player who
 * leaked somebody else's art got the good half of being backed - the aggrieved
 * house cannot touch you - and never the half that makes it a bargain. Being
 * somebody's was pure shelter.
 *
 * ── WHY THE SECOND PASS IS THE WORSE ONE ─────────────────────────────────
 *
 * The function says it in its own comment: *your own house is not deterred by
 * your own house. Nothing stands between it and you, which is why a complaint
 * is worse than a beating.* The shield that stopped the first pass is the
 * thing answering the second, at `backing: 'none'`, and what it opens is
 * tagged `AGAINST_THEIR_OWN` - the direction `what-a-deed-leaves.ts`
 * deliberately does not produce, because a house is a holder there only when
 * its member was the VICTIM.
 *
 * What the house then DOES is not decided here. It is
 * `ifCaughtAtSomethingTheHousePunishes`, off alignment, and the three answers
 * are the three kinds of house: a demonic one settles the matter and does not
 * discuss the method, a righteous one wants to know where it came from, and a
 * neutral one prices it.
 */

import { describe, expect, it } from 'vitest';

import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { SECTS } from '../../src/data/cultivation/sects';
import {
    AGAINST_THEIR_OWN,
    ifCaughtAtSomethingTheHousePunishes,
    isYourOwnHouseHoldingIt,
    theComplaintYourHouseReceives
} from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { engineCalls, makeGameInWorld } from './harness';

/** The Azure Cloud Pavilion's own sword. One house teaches it. */
const PAVILION = 'sect-azure-cloud-pavilion';
const THE_SWORD = 'void-piercing-sword-domain';

/** Somebody else's house, so that being backed means something. */
const SOMEBODY_ELSES = SECTS.find(s => s.id !== PAVILION)!;

describe('the second pass, as a reading', () => {
    /** No redirect, no complaint. A house that could act does not write. */
    it('answers nothing where the matter never went over anybody\'s head', () => {
        const stayed = theComplaintYourHouseReceives(
            { redirectedTo: null } as never,
            { id: 'h', name: 'H', houseId: 'h', houseName: 'H', alignment: null, ranked: true },
            20
        );
        expect(stayed).toBeNull();
    });

    /**
     * AND WHERE IT DID, THE SHIELD IS GONE. This is the whole of why the
     * second pass is worse, and it is one field.
     */
    it('hands it to your own house with nothing standing in the way', () => {
        const handed = theComplaintYourHouseReceives(
            { redirectedTo: 'sect-mine' } as never,
            {
                id: 'sect-mine', name: 'Mine', houseId: 'sect-mine', houseName: 'Mine',
                alignment: 'righteous', ranked: true
            },
            31
        );
        expect(handed).not.toBeNull();
        expect(handed!.backing).toBe('none');
        expect(handed!.answering.id).toBe('sect-mine');
        expect(handed!.theirOrdinal).toBe(31);
    });

    /** The three kinds of house, and they are not degrees of the same answer. */
    it('answers by what kind of house was told, and not by how bad it was', () => {
        const told = (alignment: 'demonic' | 'righteous' | 'neutral' | null) =>
            ifCaughtAtSomethingTheHousePunishes({ theirsToPunish: true, alignment });
        expect(told('demonic')).toBe('killed');
        expect(told('righteous')).toBe('questioned_about_the_source');
        expect(told('neutral')).toBe('priced');
        // And a house with no claim opens nothing. Being disapproved of is not
        // a record, which is the line the whole redirect rests on.
        expect(ifCaughtAtSomethingTheHousePunishes({ theirsToPunish: false, alignment: 'demonic' }))
            .toBe('nothing');
    });
});

describe('played, by somebody who is somebody\'s', () => {
    /**
     * A seller who is in a house that is NOT the one whose art it is. That is
     * the only arrangement in which being backed can cost anything, and it is
     * the one the engine had never played.
     */
    async function aSellerBackedBySomebodyElse(seed: string) {
        const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
        const created = (await harness.game.newRun('Wen Shuyi')) as never as
            { cultivator: { id: string } };
        const id = created.cultivator.id;
        harness.repos.cultivators.update(id, {
            realmOrdinal: 22,
            sectId: SOMEBODY_ELSES.id,
            sectName: SOMEBODY_ELSES.name
        });
        harness.repos.techniques.upsert(
            (TECHNIQUES as readonly { id: string }[]).find(t => t.id === THE_SWORD) as never
        );
        expect(harness.repos.techniques.learn(id, THE_SWORD, 1), 'the arrangement did not take')
            .toBeTruthy();
        return { ...harness, id };
    }

    /**
     * The house only ever learns of a leak because one of ITS OWN was standing
     * there - `whatTheirReferenceAffords` off the roster, and nothing else
     * reaches `placed`. So the square is chosen rather than hoped for, exactly
     * as `selling-a-copy-of-somebody-elses-art.test.ts` does it.
     */
    function standWhereOneOfTheirsIs(
        harness: Awaited<ReturnType<typeof aSellerBackedBySomebodyElse>>
    ): void {
        const world = (harness.game as unknown as { atHand: {
            npcs: { status: string; factionId: string | null; locationId: string | null }[];
            locations: { id: string; name: string }[];
        } | null }).atHand;
        const theirs = world!.npcs
            .find(n => n.status === 'alive' && n.factionId === PAVILION && n.locationId);
        expect(theirs, 'the seeded world holds nobody of the Pavilion').toBeTruthy();
        const where = world!.locations.find(l => l.id === theirs!.locationId)!;
        harness.repos.cultivators.update(harness.id, { location: where.name });
    }

    it('is answered by its own house when the aggrieved one cannot reach it', async () => {
        const harness = await aSellerBackedBySomebodyElse('complaint-lands');
        const { game, db, id } = harness;
        await game.act('I look around');
        standWhereOneOfTheirsIs(harness);

        const said = await game.act('I sell a copy of the Void-Piercing Sword Domain');
        const calls = engineCalls(said).map(c => c.name).join(' ');
        const structure = engineCalls(said).map(c => c.summary).join(' ');

        expect(calls, said.narration ?? '').toContain('social.theComplaintYourHouseReceives');
        expect(structure).toMatch(/backing 'none'/);

        // AND IT IS WRITTEN. A complaint that changes no row is a scene.
        const rows = db.prepare(
            'SELECT holder_id, subject_id, tags FROM obligations WHERE subject_id = ?'
        ).all(id) as { holder_id: string; subject_id: string; tags: string }[];
        const own = rows.filter(r => r.holder_id === SOMEBODY_ELSES.id);
        expect(own.length, 'the house was told and opened nothing').toBeGreaterThan(0);
        expect(own.some(r => isYourOwnHouseHoldingIt({ tags: JSON.parse(r.tags) as string[] })))
            .toBe(true);
        expect(own[0]!.tags).toContain(AGAINST_THEIR_OWN);
    }, 200_000);

    /**
     * AND SOMEBODY ON NOBODY'S ROLL HAS NOTHING TO BE HANDED TO. The shelter
     * and the exposure are the same fact, which is the trade this models: a
     * rogue cannot be complained about, and is answered directly instead.
     */
    it('writes nothing about a seller no house would be told about', async () => {
        const harness = await makeGameInWorld({
            seed: 'complaint-nobody', worldSeed: 'world-complaint-nobody'
        });
        const created = (await harness.game.newRun('Rogue')) as never as
            { cultivator: { id: string } };
        const id = created.cultivator.id;
        harness.repos.cultivators.update(id, { realmOrdinal: 22 });
        harness.repos.techniques.upsert(
            (TECHNIQUES as readonly { id: string }[]).find(t => t.id === THE_SWORD) as never
        );
        harness.repos.techniques.learn(id, THE_SWORD, 1);

        await harness.game.act('I look around');
        const said = await harness.game.act('I sell a copy of the Void-Piercing Sword Domain');
        expect(engineCalls(said).map(c => c.name).join(' '))
            .not.toContain('social.theComplaintYourHouseReceives');
    }, 200_000);
});
