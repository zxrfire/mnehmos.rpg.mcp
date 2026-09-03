/**
 * A rank is a way of referring to a person, and the resolver had no route for it.
 *
 * Played as a Sword Elder of the Azure Cloud Pavilion, one turn after the house
 * gained a `Grand Sword Elder` rung:
 *
 *   who is the grand elder here?
 *   Nothing here answers to it.
 *   Unresolved subject "grand elder here": no knowledge record and nothing
 *   co-located.
 *
 * The parser took a rank as a name and went looking for somebody called "grand
 * elder here".
 *
 * AND THE TOLD-THE-STRUCTURE GRANT IS WHAT MAKES IT WRONG. `what-joining-tells
 * -you.ts` landed the rule that being enrolled tells you the ladder, so a member
 * KNOWS there is a grand elder - they know the rank exists, they know somebody
 * holds it, and they may hold nothing at all about the person. Asking by the
 * rung is the natural thing to type in exactly that state, and it is the state
 * that grant produces at the bottom of a house.
 */

import { makeGameInWorld } from './harness';
import { resolveRankOnALadder } from '../../src/web/entities';
import { getSect } from '../../src/data/cultivation/sects';
import { getMembersOf } from '../../src/data/cultivation/members';

const HOUSE = 'sect-azure-cloud-pavilion';

/** A member of the Pavilion who holds no knowledge rows at all. */
function aMemberWhoKnowsNobody() {
    return {
        id: 'me', name: 'Elder', sectId: HOUSE, realmOrdinal: 20
    } as never;
}

const scopeKnowing = (ids: ReadonlySet<string>) => ({
    gate: {
        isAwareOf: (_holder: string, _kind: string, id: string) => ids.has(id),
        awareness: () => [],
        stageOf: () => 'named'
    },
    holderId: 'me',
    here: null
} as never);

describe('asking after a rung on your own ladder', () => {
    const ranks = getSect(HOUSE)!.ranks;

    it('resolves the rank the player said, not a person by that name', () => {
        const found = resolveRankOnALadder('the pavilion master', aMemberWhoKnowsNobody(), scopeKnowing(new Set()));
        expect(found?.kind).toBe('rank');
        expect(found?.name).toBe('Pavilion Master');
    });

    /**
     * THE SENTENCE THAT PRODUCED THIS. The house's idiom puts its own word in
     * the middle of the title - `Grand Sword Elder` - and a player naturally
     * leaves it out. Everybody says "the grand elder"; nobody says "the grand
     * sword elder".
     */
    it('reaches a title the player said the short form of', () => {
        const grand = ranks.find(r => /grand/i.test(r));
        if (!grand) return;
        const found = resolveRankOnALadder('the grand elder here', aMemberWhoKnowsNobody(), scopeKnowing(new Set()));
        expect(found?.name).toBe(grand);
    });

    /** And the score still chooses, so the longest title does not win by length. */
    it('keeps the exact title over the longer one that contains it', () => {
        if (!ranks.includes('Sword Elder')) return;
        const found = resolveRankOnALadder('sword elder', aMemberWhoKnowsNobody(), scopeKnowing(new Set()));
        expect(found?.name).toBe('Sword Elder');
    });

    it('answers to the plural a player would type', () => {
        const found = resolveRankOnALadder('the inner disciples', aMemberWhoKnowsNobody(), scopeKnowing(new Set()));
        expect(found?.name).toBe('Inner Disciple');
    });

    /**
     * RESOLVING THE RUNG IS NOT NAMING THE HOLDER. The two silences, and they
     * are the same shape as the ground holder's: being told the ladder entitles
     * somebody to ask, and whether a name comes back is a separate question.
     */
    it('says there is one and that you cannot say who', () => {
        const said = resolveRankOnALadder('the pavilion master', aMemberWhoKnowsNobody(), scopeKnowing(new Set()))!
            .facts.join(' ');
        expect(said).toMatch(/holds the rank of Pavilion Master/);
        expect(said).toMatch(/could not say which/);
    });

    it('names them once the asker holds a row about them', () => {
        const top = Math.max(...getMembersOf(HOUSE).map(m => m.rankIndex));
        const head = getMembersOf(HOUSE).find(m => m.rankIndex === top)!;
        const said = resolveRankOnALadder(ranks[top]!, aMemberWhoKnowsNobody(), scopeKnowing(new Set([head.id])))!
            .facts.join(' ');
        expect(said).toContain(head.name);
        expect(said).not.toMatch(/could not say which/);
    });

    /** No article anywhere: "There is a Inner Disciple" was what composing one gave. */
    it('never puts an article in front of a rank title', () => {
        for (const title of ranks) {
            const said = resolveRankOnALadder(title, aMemberWhoKnowsNobody(), scopeKnowing(new Set()))?.facts.join(' ') ?? '';
            expect(said, title).not.toMatch(/\bis a [A-Z]|\bThere is a [A-Z]/);
        }
    });

    /** It is the asker's own house's vocabulary, and means nothing without one. */
    it('answers nothing to somebody who serves nowhere', () => {
        const stranger = { id: 'me', name: 'Nobody', sectId: null, realmOrdinal: 20 } as never;
        expect(resolveRankOnALadder('the pavilion master', stranger, scopeKnowing(new Set()))).toBeNull();
    });

    it('answers nothing to a phrase that is not a rung', () => {
        const who = aMemberWhoKnowsNobody();
        expect(resolveRankOnALadder('the spirit stone market', who, scopeKnowing(new Set()))).toBeNull();
        expect(resolveRankOnALadder('ab', who, scopeKnowing(new Set()))).toBeNull();
    });

    /** The id is the rung, so nothing downstream can act on an unnamed person. */
    it('hands back the office rather than a person', () => {
        const found = resolveRankOnALadder('the pavilion master', aMemberWhoKnowsNobody(), scopeKnowing(new Set()))!;
        expect(found.id).toContain('#rank-');
        expect(getMembersOf(HOUSE).some(m => m.id === found.id)).toBe(false);
    });
});

describe('played, on a pinned world', () => {
    it('answers the sentence that was refused', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'rank', worldSeed: 'world-rank-1' });
        const { cultivator } = await game.newRun('Elder');
        db.prepare('UPDATE cultivators SET realm_ordinal = 20 WHERE id = ?').run(cultivator.id);
        game.repos.sects.addMember(HOUSE, cultivator.id, 4);

        const asked = await game.act('who is the grand elder here');

        expect(asked.narration).not.toMatch(/Nothing here answers to it/i);
        expect(asked.narration).not.toMatch(/Unresolved subject/i);
        expect(asked.narration).toMatch(/Grand Sword Elder|Sword Elder/);
    });

    /** And after being told the structure, the rung gives a name. */
    it('names the holder once being enrolled has told them', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'rank', worldSeed: 'world-rank-1' });
        const { cultivator } = await game.newRun('Elder');
        db.prepare('UPDATE cultivators SET realm_ordinal = 20 WHERE id = ?').run(cultivator.id);
        game.repos.sects.addMember(HOUSE, cultivator.id, 4);
        await game.act('who could teach me');

        const asked = await game.act('who is the pavilion master');

        expect(asked.narration).not.toMatch(/could not say which/i);
    });
});
