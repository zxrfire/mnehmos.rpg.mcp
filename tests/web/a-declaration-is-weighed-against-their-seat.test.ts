/**
 * A DECLARATION THAT MEANS SOMETHING, BECAUSE SOMEBODY WORKED OUT WHAT IT MEANT.
 *
 * The design owner: *"what should follow a declaration has to do with how
 * likely you are to follow through"*, and *"if you can actually flatten a sect
 * they might beg you to stay your hand."*
 *
 * A declaration was words and a flag. It recorded a posture, said which house
 * could put the stronger person in a room, and stopped - so declaring on
 * somebody you could level and on somebody who could ignore you produced the
 * same turn with different names in it.
 *
 * What makes it an act is that the named house can go and look at what is
 * standing over its own ground and work out what is coming. Three layers, and
 * which one stops you decides which of three different things a war is:
 *
 *   NOTHING REACHES THEM  a thing they hear about and never feel
 *   IN, AND NOT THROUGH   a robbery
 *   NOTHING HOLDS         the compound comes down, and they pay to rebuild
 *
 * ── AND THE BEGGING IS ARITHMETIC ────────────────────────────────────────
 *
 * A house sues for peace when the reading says the seat comes down, and not
 * when somebody is frightening. Being robbed is survivable and being ended is
 * not, which is why `whatAHouseDoesAboutSomebodyWhoCanEndIt` reads the flatten
 * flag and nothing else.
 *
 * ── WHAT REACH IS WEIGHED, AND IT IS NOT THE PLAYER'S ────────────────────
 *
 * `sectThreat(...).acting` - what the declaring HOUSE can actually put in a
 * room. A war is a thing between two houses, so what is measured is what the
 * house can send, not what its head personally stands at. A head at the top of
 * the ladder speaking for a small house is still speaking for a small house.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../src/data/cultivation/index';
import { sectThreat } from '../../src/data/cultivation/sects';
import { makeGameInWorld } from './harness';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

/** The houses at the two ends of what anybody can put in a room. */
const BY_REACH = SECTS
    .map(sect => ({ sect, acting: sectThreat(sect.id)?.acting ?? 0 }))
    .sort((a, b) => b.acting - a.acting);
const THE_STRONGEST = BY_REACH[0]!;
const THE_WEAKEST = BY_REACH[BY_REACH.length - 1]!;

/**
 * Somebody entitled to declare, at the head of a named house.
 *
 * The rank gate is real and is not what this file measures: a disciple cannot
 * commit their house to anything, and `housePosture` says so first.
 */
async function theHeadOf(seed: string, houseId: string, houseName: string) {
    const harness = await makeGameInWorld({
        seed, worldSeed: `world-${seed}`, adminMode: true
    });
    const { cultivator } = await harness.game.newRun('Head');
    await harness.game.act('I look around');
    const house = SECTS.find(s => s.id === houseId)!;
    harness.repos.sects.addMember(houseId, cultivator.id, house.ranks.length - 1);
    harness.repos.cultivators.update(cultivator.id, {
        realmOrdinal: 44, sectId: houseId, sectName: houseName
    });
    return harness;
}

async function declareOn(harness: Awaited<ReturnType<typeof theHeadOf>>, targetId: string) {
    process.env.ADMIN_MODE = 'true';
    try {
        await harness.game.act(`ADMIN grant_knowledge kind=sect id=${targetId}`);
        const name = SECTS.find(s => s.id === targetId)!.name.replace(/^The /, '');
        return await harness.game.act(`I declare war on the ${name}`);
    } finally {
        delete process.env.ADMIN_MODE;
    }
}

describe('declaring on somebody you could actually level', () => {
    it('says the compound comes down, and they ask what it would take', async () => {
        const harness = await theHeadOf(
            'war-can-level', THE_STRONGEST.sect.id, THE_STRONGEST.sect.name
        );
        const answer = await declareOn(harness, THE_WEAKEST.sect.id);
        const heard = said(answer);

        expect(heard).toMatch(/not a form of words/i);
        expect(heard).toMatch(/that compound comes down/i);
        expect(heard).toMatch(/pay to put it back up/i);
        // THE BEGGING, which is the half that makes a declaration worth making.
        expect(heard).toMatch(/ask what it would take/i);
        expect(heard).toMatch(/does not stand on its dignity/i);
    }, 200_000);

    /**
     * AND THE OTHER WAY ROUND IS NOT THE SAME TURN WITH THE NAMES SWAPPED. A
     * small house declaring on a great one is a thing the great one hears
     * about, and nobody begs anybody.
     */
    it('says nothing lands, declaring the other way round', async () => {
        const harness = await theHeadOf(
            'war-cannot-reach', THE_WEAKEST.sect.id, THE_WEAKEST.sect.name
        );
        const answer = await declareOn(harness, THE_STRONGEST.sect.id);
        const heard = said(answer);

        // The declaration still happens - the engine does not grade - and what
        // it is worth is said plainly.
        expect(heard).toMatch(/is at war with/i);
        expect(heard).toMatch(/hear about|never feel|only thing about it that is/i);
        expect(heard).not.toMatch(/ask what it would take/i);
        expect(heard).not.toMatch(/that compound comes down/i);
    }, 200_000);
});

describe('what the reading is made of', () => {
    /**
     * The mechanical channel carries the figures, and the prose carries none of
     * them. A player who wants the arithmetic can have it; a narrator gets a
     * sentence rather than a number to garble.
     */
    it('puts the ward, the masonry and the verdict on the mechanical channel', async () => {
        const harness = await theHeadOf(
            'war-structure', THE_STRONGEST.sect.id, THE_STRONGEST.sect.name
        );
        const answer = await declareOn(harness, THE_WEAKEST.sect.id);
        const structure = ((answer as { toolCalls?: { name: string; summary: string }[] })
            .toolCalls ?? []).map(c => `${c.name} ${c.summary}`).join(' ');

        expect(structure).toMatch(/whatAHouseIsMadeOf/);
        expect(structure).toMatch(/masonry at 29/);
        // And the prose has no bare ordinal in it, which is the rule the world
        // docs keep for every line a person reads.
        expect(said(answer)).not.toMatch(/\bmasonry at \d+/);
    }, 200_000);
});
