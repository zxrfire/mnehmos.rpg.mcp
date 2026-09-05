/**
 * A house's elemental door, reached the way a player reaches it.
 *
 * The Storm Tyrant Court's own admission line has always read "A mutated
 * lightning root. Everyone else the Court speaks to is not an applicant." It
 * lived in `SECT_ADMISSION.requirement`, which is prose the narrator renders and
 * nothing in `src/` enforced, so a wood-rooted applicant walked up and was
 * assessed on charm.
 *
 * Two things had to be true for the fix to count, and both are asserted here:
 * the Court refuses, and a player can find out BEFORE applying - otherwise the
 * only way to learn what a house teaches is to be turned away by it.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { handleSectManage } from '../../src/server/consolidated/sect-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { getSect } from '../../src/data/cultivation/sects.js';

const TYRANT = 'sect-storm-tyrant-court';
/** Teaches ten elementless books and one fire art nobody rises on. */
const AUCTION_HOUSE = 'sect-thousand-treasure-pavilion';

const ctx = undefined;

function payload(res: { content: Array<{ text?: string }> }): any {
    const text = res.content[0]?.text ?? '{}';
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const cultivation = async (a: Record<string, unknown>) =>
    payload(await handleCultivationManage(a, ctx));
const sect = async (a: Record<string, unknown>) => payload(await handleSectManage(a, ctx));

function hearOf(cultivatorId: string, factionId: string): void {
    const repos = ensureCultivationDb();
    const house = getSect(factionId)!;
    new KnowledgeGate(repos.db).learn({
        holderId: cultivatorId, kind: 'sect', id: house.id, name: house.name,
        onDay: 0, sourceKind: 'told', stage: 'named',
        statement: `${house.name} exists and is spoken of.`
    });
}

/**
 * Somebody standing past the Court's bar, holding a named root.
 *
 * The rung and the root are arranged rather than climbed to: this test is about
 * the door, and every other gate has to be clear for the door to be the thing
 * that answers.
 */
async function applicant(name: string, seed: string, spiritRoot: string) {
    const made = await cultivation({
        action: 'create_cultivator', name, seed, location: 'Green Water City'
    });
    expect(made.error).toBeUndefined();
    const id = made.cultivator.id as string;
    new CultivatorRepository(getDb()).update(id, {
        spiritRoot,
        realmOrdinal: 12,
        spiritStones: 10_000,
        // The Court takes men only (`A_HOUSE_THAT_TAKES_ONE_SEX`), and that gate
        // fires before this one. Arranging past it is what makes the elemental
        // door the thing that answers.
        sex: 'male',
        // The legal ceiling, not an invented one: `might` caps at 3 and
        // `insight` at 4 in `schema/cultivation.ts`, and a probe built out of
        // range is not measuring this game.
        attributes: { might: 3, insight: 4, fortune: 3, charm: 3 }
    });
    hearOf(id, TYRANT);
    hearOf(id, AUCTION_HOUSE);
    return id;
}

describe('a house can only teach what is on its shelf', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });
    afterEach(() => { closeDb(); });

    it('refuses a root its whole library has nothing for', async () => {
        const id = await applicant('Bai Rong', 'tyrant-wood', 'single_wood');
        const res = await sect({ action: 'join', cultivatorId: id, sectId: TYRANT });

        expect(res.error).toBe('root_the_house_cannot_teach');
        expect(res.houseElement).toBe('lightning');
        expect(res.spiritRoot).toBe('single_wood');
        // A refusal may never be a bare no. This one says what the house is and
        // that the fact does not change with rank.
        expect(res.message).toMatch(/one road/i);
        expect(res.hint).toMatch(/rolled once/i);
    });

    it('takes the root its library is written for', async () => {
        const id = await applicant('Lei Shu', 'tyrant-lightning', 'mutated_lightning');
        const res = await sect({ action: 'join', cultivatorId: id, sectId: TYRANT });
        // The walk-up roll may still refuse this one - that is a different
        // answer and a different code, and it is the point: the elemental door
        // is out of the way and somebody's opinion is what is left.
        expect(res.error).not.toBe('root_the_house_cannot_teach');
    });

    it('does not turn a house into a gate on the strength of one bottom-rung book', async () => {
        // The auction house has one fire art capped at 0. Counting it would
        // have made it refuse every root but fire, which is the defect the
        // cap rule exists against.
        const id = await applicant('Gu Yan', 'auction-wood', 'single_wood');
        const res = await sect({ action: 'join', cultivatorId: id, sectId: AUCTION_HOUSE });
        expect(res.error).not.toBe('root_the_house_cannot_teach');
    });
});

describe('and a player can find out before they walk up', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });
    afterEach(() => { closeDb(); });

    it('says what road each house teaches and how hard it holds it', async () => {
        const id = await applicant('Bai Rong', 'listing-wood', 'single_wood');
        const listed = await sect({ action: 'list', cultivatorId: id });

        const court = listed.sects.find((s: { id: string }) => s.id === TYRANT);
        expect(court.teachesElement).toBe('lightning');
        expect(court.elementalStance).toBe('requires');
        expect(court.rootAtTheDoor).toBe('refused');
        // And the listing does not go on calling it admissible.
        expect(court.admissible).toBe(false);

        const auction = listed.sects.find((s: { id: string }) => s.id === AUCTION_HOUSE);
        expect(auction.elementalStance).toBe('open');
        expect(auction.rootAtTheDoor).toBe('welcome');
    });

    it('reads a preference as a preference and never as a bar', async () => {
        const id = await applicant('Bai Rong', 'listing-pref', 'single_wood');
        const listed = await sect({ action: 'list', cultivatorId: id });
        const preferring = listed.sects.filter(
            (s: { elementalStance: string }) => s.elementalStance === 'prefers'
        );
        expect(preferring.length).toBeGreaterThan(0);
        for (const house of preferring) {
            expect(house.rootAtTheDoor).not.toBe('refused');
        }
    });
});
