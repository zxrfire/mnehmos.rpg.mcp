/**
 * Fifty-seven percent of everybody in a two-hundred-year-old world was a dead
 * mortal.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Seed `dead-mortals-measure`, 616 people, advanced a year at a time:
 *
 *              rows   alive   dead   dead cultivators   dead mortals
 *     day 0     616     611      5                  0              5
 *     +50y      930     572    358                 43            315
 *     +200y    1780     549   1231                224           1007
 *
 * and those 1,007 rows were named 24,000 times across the world: 10,413 as a
 * witness to somebody else's event, 3,762 as an actor in one, 2,345 as
 * somebody's living relative, 2,830 across the lineages, 824 as the origin of
 * an inherited goal, and the rest through objects, absences and locations.
 * 1,850 of 4,670 historical facts named nobody but the forgotten.
 *
 * The design owner, on being shown it: *"do not track mortals wtf"*, and on
 * what should become of the rest: *"nobody remembers them"*, *"delete"*. An
 * earlier ruling in the same voice states the line: *"if sibling dies as a
 * mortal, drop. if dies as a cultivator, mark as dead in entities. this is
 * true for everyone."*
 *
 * Living mortals stay. They are the population of the villages and they are
 * who a life grows up knowing. What stops is accumulating them after they die.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ONE EXCEPTION, AND WHY IT IS THE RULING RATHER THAN A HOLE IN IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `seedTheWrongsStillOpen` writes the killings a world opens holding, and 5 of
 * 5 were done to mortals - so a naive drop deletes the victim of every opening
 * wrong, and with it the only thing a fresh world has that a player can be told
 * about.
 *
 * The obvious fix is to draw those victims from cultivators. Measured, it is
 * not available:
 *
 *     living cultivators below the Lid                        128
 *     of them NOT written by a catalog                          2
 *     of those unranked, with a blood tie, with a legal killer  0
 *
 * The procedural population tops out at ordinal 14, so every cultivator in a
 * seeded world who has a family is an authored figure, and that pass refuses to
 * write an unsettled murder onto one in either role. Restricting the draw gave
 * ZERO killings in every world swept.
 *
 * So the exception lands on the other side, and it is the ruling's own reason
 * rather than a softening of it: what is being deleted is the corpses of
 * farmers the engine *was never able to say anything about*, and a man whose
 * brother still carries the account for his killing is not one of them.
 * `theWorldForgetsTheMortalDead` keeps anybody a priced deed names. Over two
 * hundred years it swept 928 rows and kept 9 by this.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE PINS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Rates and invariants, not counts. No seed is pinned to a number.
 *
 * NOTE ON WHERE THE SWEEP IS CALLED FROM. `seedWorld` calls it; the yearly line
 * in `driver.ts` does not yet, because that file belongs to somebody else. The
 * lived-world tests below therefore call it themselves, once per world-year,
 * which is exactly what that line will do.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldYears } from '../../support/advance-world-years';
import { theWorldForgetsTheMortalDead } from '../../../src/engine/world/world-state';
import { markDead, somebodyTheCatalogWrote } from '../../../src/engine/world/npc-state';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms';
import { whatATellingLandsOn } from '../../../src/web/what-a-telling-lands-on';
import type { WorldState } from '../../../src/engine/world/world-state';
import type { NpcRecord } from '../../../src/engine/world/npc-state';

const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);

const isACultivator = (npc: NpcRecord): boolean =>
    npc.cultivation.realmOrdinal >= FOUNDATION_ORDINAL;

/** The same read `what-a-telling-lands-on.ts` makes. Never a second opinion. */
const carriedFor = (state: WorldState): Set<string> => {
    const ids = new Set<string>();
    for (const fact of state.history.facts) {
        if (!('deedWeight' in fact.data)) continue;
        for (const actor of fact.actors) ids.add(actor.id);
    }
    return ids;
};

/**
 * Rows the world should no longer be holding.
 *
 * `physically_dead` and not `status !== 'alive'`: `isUnadjudicated` says
 * `missing` and `unknown` are the states in which the engine genuinely does not
 * know what happened, and somebody who walked into the hills is a live question
 * rather than a corpse. 110 of the rows in the measured world are that.
 */
function farmersTheWorldIsStillCarrying(state: WorldState): NpcRecord[] {
    const remembered = carriedFor(state);
    return state.npcs.filter(npc =>
        npc.status === 'physically_dead'
        && !isACultivator(npc)
        && !somebodyTheCatalogWrote(npc)
        && !remembered.has(npc.id));
}

/** Every string anywhere in the world that is one of these ids. */
function whatStillNames(state: WorldState, ids: ReadonlySet<string>): string[] {
    const found: string[] = [];
    const seen = new WeakSet<object>();
    const walk = (node: unknown, path: string): void => {
        if (typeof node === 'string') {
            if (ids.has(node)) found.push(`${path} = ${node}`);
            return;
        }
        if (node === null || typeof node !== 'object') return;
        if (seen.has(node as object)) return;
        seen.add(node as object);
        if (Array.isArray(node)) { for (const v of node) walk(v, `${path}[]`); return; }
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            if (ids.has(key)) found.push(`${path}.{key} = ${key}`);
            walk(value, `${path}.${key}`);
        }
    };
    for (const [key, value] of Object.entries(state as unknown as Record<string, unknown>)) {
        walk(value, key);
    }
    return found;
}

/** A world lived through, with the sweep on the yearly line. */
/**
 * Everybody the world stopped keeping, over a run of years.
 *
 * IT MEASURES THE WORLD RATHER THAN ITS OWN CALL. This took the ids before and
 * after a `theWorldForgetsTheMortalDead` of its own, which was the only sweep
 * there was while the pass was unwired. It is wired now - `advanceWorldForPlay`
 * runs it between passes - so by the time the helper asked, the year had
 * already been swept and it measured zero every time. The assertion that
 * caught it is the anti-vacuity guard below, which is exactly what that guard
 * is for.
 *
 * So the window goes around the ADVANCE, and the sweep it observes is the
 * one the game actually performs.
 */
function livedThrough(state: WorldState, years: number): Set<string> {
    const swept = new Set<string>();
    for (let year = 0; year < years; year++) {
        const before = new Set(state.npcs.map(npc => npc.id));
        advanceWorldYears(state, 1);
        const after = new Set(state.npcs.map(npc => npc.id));
        for (const id of before) if (!after.has(id)) swept.add(id);
    }
    return swept;
}

describe('the world does not keep a farmer who died', () => {
    /**
     * A RATCHET ON THE SEEDER, and it does not currently exercise the sweep.
     * Said plainly rather than left to be discovered: the only deaths a fresh
     * world contains are the wrongs, every one of those is carried for, so
     * `seedWorld`'s call takes nothing today and this assertion would hold
     * without it. It is here because the next pass that kills somebody while
     * laying a world out will not think to ask, and because the invariant
     * should be true from day zero rather than from the first simulated year.
     * The sweep itself is proved by the four tests below.
     */
    it('a fresh world holds no mortal who died and nobody carries anything for',
        async () => {
            const catalog = await loadCultivationCatalog();
            const { state } = seedWorld({ seed: 'forgets-fresh', catalog });
            expect(farmersTheWorldIsStillCarrying(state)).toEqual([]);
        }, 120000);

    /**
     * And the sweep is what makes it true, rather than it happening to be true
     * because a fresh world has barely any dead in it.
     *
     * Two ordinary living mortals are killed by hand and the world is asked to
     * forget them. Arranged rather than lived, because the state under test is
     * one line of a yearly pass and reaching it by simulation would be fifty
     * years of world to prove one predicate - and the lived case is the test
     * below.
     */
    it('takes the row, and everything that was only ever about them',
        async () => {
            const catalog = await loadCultivationCatalog();
            const { state } = seedWorld({ seed: 'forgets-by-hand', catalog });

            const doomed = state.npcs.filter(npc =>
                npc.status === 'alive'
                && !isACultivator(npc)
                && !somebodyTheCatalogWrote(npc)
                && npc.relationships.some(r => BLOOD.has(r.kind))).slice(0, 2);
            expect(doomed.length, 'a fresh world has ordinary mortals with families')
                .toBe(2);

            const ids = new Set(doomed.map(npc => npc.id));
            const mourners = state.npcs.filter(npc =>
                npc.status === 'alive'
                && !ids.has(npc.id)
                && npc.relationships.some(r => ids.has(r.targetId)));
            expect(mourners.length, 'and somebody alive is tied to them')
                .toBeGreaterThan(0);

            for (const npc of doomed) {
                const at = state.npcs.findIndex(n => n.id === npc.id);
                state.npcs[at] = markDead(state.npcs[at], state.currentDay, 'Old age.');
            }

            const went = theWorldForgetsTheMortalDead(state);
            expect(went.people).toBe(2);
            expect(state.npcs.some(npc => ids.has(npc.id)),
                'the rows are gone').toBe(false);
            expect(whatStillNames(state, ids),
                'and so is every last thing that named them').toEqual([]);
        }, 120000);

    /**
     * Two centuries, with the sweep where the yearly line will put it.
     *
     * The claim is the one the owner's ruling makes: the world stops growing a
     * pile of corpses. Floored well below the measured figures so ordinary
     * drift does not fail this and a regression does - measured on
     * `dead-mortals-measure`, 1780 rows became 888 and 1007 dead mortals became
     * 130, of which 110 are `missing` rather than dead.
     */
    it('a world two centuries old is not mostly dead farmers', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'forgets-lived', catalog });
        const swept = livedThrough(state, 200);

        expect(swept.size, 'and it swept people, rather than finding none')
            .toBeGreaterThan(100);
        expect(farmersTheWorldIsStillCarrying(state),
            'no farmer is left on the books at the end of it').toEqual([]);

        const alive = state.npcs.filter(npc => npc.status === 'alive').length;
        expect(
            state.npcs.length / alive,
            `${state.npcs.length} rows for ${alive} living people; before the sweep `
            + 'a measured world carried 1780 for 549, which is 3.2'
        ).toBeLessThan(2);
    }, 180000);

    /**
     * And nothing anywhere is left pointing at somebody who is gone.
     *
     * The whole-world walk rather than a list of tables, because the point of
     * failure is the table nobody thought of. It is the same walk the
     * measurement used to find the 24,000 references in the first place.
     */
    it('leaves nothing in the world naming a row it took out', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'forgets-dangling', catalog });
        const swept = livedThrough(state, 60);

        expect(swept.size).toBeGreaterThan(0);
        expect(whatStillNames(state, swept).slice(0, 20)).toEqual([]);
    }, 180000);

    /**
     * The wrong a fresh world opens holding is the exception, and it survives.
     *
     * This is the collision the whole change turns on, so it is asserted from
     * the verb rather than from the row: the bereaved can still be told who
     * killed their relative, at the fact the world priced it on.
     */
    it('a killing somebody still carries an account for is remembered', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'forgets-fresh', catalog });

        const priced = state.history.facts.filter(f => 'deedWeight' in f.data);
        expect(priced.length, 'a fresh world holds wrongs').toBeGreaterThan(0);

        const dead = new Set(
            state.npcs.filter(npc => npc.status !== 'alive').map(npc => npc.id));
        const hearer = state.npcs.find(npc =>
            npc.status === 'alive'
            && npc.relationships.some(tie =>
                BLOOD.has(tie.kind)
                && dead.has(tie.targetId)
                && priced.some(f => f.actors.some(a => a.id === tie.targetId))));
        expect(hearer, 'somebody alive lost a relative to one of them').toBeDefined();

        const loss = hearer!.relationships.find(tie =>
            BLOOD.has(tie.kind) && dead.has(tie.targetId))!;
        const fact = priced.find(f => f.actors.some(a => a.id === loss.targetId))!;
        const killer = fact.actors.find(a => a.id !== loss.targetId)!;

        // The sweep has already run once inside `seedWorld`, and the victim is
        // still on the books BECAUSE somebody carries the account.
        expect(state.npcs.some(npc => npc.id === loss.targetId),
            'the victim is a row the world keeps').toBe(true);

        const landed = whatATellingLandsOn({
            world: state,
            hearerId: hearer!.id,
            hearer: hearer!,
            tellerId: 'a-teller',
            blamedId: killer.id,
            onDay: state.currentDay,
            canPointAt: () => true,
            heldAbout: () => null
        });
        expect(landed.opens, 'and the telling still opens the account').not.toBeNull();
        expect(landed.factId).toBe(fact.id);
    }, 120000);
});
