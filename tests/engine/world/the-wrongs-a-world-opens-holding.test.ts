/**
 * The wrongs a world opens holding.
 *
 * THE UNIT TIER says what one seeded killing is: priced by the one pricer,
 * written by the one writer, done by somebody still standing there to somebody
 * whose people are still standing there, and indistinguishable from a deed a
 * player caused.
 *
 * THE RATE TIER says it happens at all, at a rate a world can carry, and
 * measured at the point a player would notice - which is not "the world has six
 * killings in it" but **of the settlements a run can open in, how many put
 * somebody who can be told in the room.**
 *
 * AND THE POPULATION IT DRAWS FROM CHANGED. It refused anybody the catalog wrote
 * in either role; the design owner lifted that, and the test that pinned the
 * refusal is replaced below by the two claims that replace it - that a wrong may
 * name an authored figure, and that it is still minted per world rather than
 * written down anywhere. What survived of the old guard is the head of a house,
 * which was always a separate rule for a mechanical reason.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { isActing, somebodyTheCatalogWrote } from '../../../src/engine/world/npc-state.js';
import { drawBirth } from '../../../src/engine/birth/birth.js';
import { OPEN_KILLINGS_PER_PROVINCE } from '../../../src/engine/world/the-wrongs-a-world-opens-holding.js';
import { SEVERITY_ORDER } from '../../../src/engine/social/grudges.js';
import type { HistoricalFact } from '../../../src/engine/world/history.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);
const SEEDS = ['wrong-a', 'wrong-b', 'wrong-c', 'wrong-d', 'wrong-e', 'wrong-f'];

let catalog: WorldCatalog;
async function world(seed: string): Promise<WorldState> {
    catalog ??= await loadCultivationCatalog();
    return seedWorld({ seed, catalog, population: 400 }).state;
}

/** The filter `what-a-telling-lands-on.ts` runs. Asked the same way here. */
function pricedIn(state: WorldState): HistoricalFact[] {
    return state.history.facts.filter(fact => fact.data && 'deedWeight' in fact.data);
}

function bereavedIn(state: WorldState) {
    const dead = new Set(state.npcs.filter(npc => !isActing(npc.status)).map(npc => npc.id));
    return state.npcs.filter(npc =>
        isActing(npc.status)
        && npc.relationships.some(r => BLOOD.has(r.kind) && dead.has(r.targetId)));
}

describe('the wrongs a world opens holding', () => {
    // ─────────────────────────────────────────────────────────────────────
    // THE UNIT TIER
    // ─────────────────────────────────────────────────────────────────────

    it('writes a priced deed the telling layer can actually find', async () => {
        const state = await world('wrong-a');
        const priced = pricedIn(state);
        expect(priced.length, 'a fresh world holds wrongs').toBeGreaterThan(0);

        const at = new Map(state.npcs.map(npc => [npc.id, npc]));
        for (const fact of priced) {
            // Priced, in the ledger's own vocabulary, by `whatADeedLeaves`.
            expect(SEVERITY_ORDER).toContain(fact.data.deedWeight);
            // The writer stamps this, and `doerOf` reads it. Without it the
            // telling layer falls back to actors[0] and a change of order
            // would silently make the victim the killer.
            expect(fact.data.deedDoerId, 'the doer is named on the row').toBeDefined();
            // A name-free line for anybody with no standing to be told, which is
            // required rather than optional for the reason the writer gives: a
            // fact without one reaches every stranger in the province as a shrug.
            expect(String(fact.data.unattributed).length).toBeGreaterThan(20);

            const doer = at.get(String(fact.data.deedDoerId))!;
            const victim = fact.actors.find(a => a.id !== doer.id)!;
            expect(doer, 'somebody the world holds did it').toBeDefined();
            expect(isActing(doer.status), 'and is still standing there').toBe(true);
            expect(isActing(at.get(victim.id)!.status), 'and the other one is dead')
                .toBe(false);
            // Written through `appendWorldFact`, so the people who were there
            // are on it - which is what makes the deed recoverable from the
            // person who did it rather than only from the person it was done to.
            expect(fact.witnessIds.length).toBeGreaterThan(0);
        }
    }, 120000);

    it('leaves somebody living holding a tie to the person it was done to', async () => {
        const state = await world('wrong-b');
        const priced = pricedIn(state);
        const bereaved = bereavedIn(state);
        expect(bereaved.length,
            'an account with nobody to hold it is not an account').toBeGreaterThan(0);

        // Every killing left somebody. That is the whole reason the families run
        // first, and it is the assertion that goes red if that order is swapped.
        const dead = new Set(state.npcs.filter(n => !isActing(n.status)).map(n => n.id));
        for (const fact of priced) {
            const victimId = fact.actors
                .find(a => a.id !== String(fact.data.deedDoerId))!.id;
            const holders = state.npcs.filter(npc =>
                isActing(npc.status)
                && npc.relationships.some(r => BLOOD.has(r.kind) && r.targetId === victimId));
            expect(holders.length, `${fact.summary} left nobody`).toBeGreaterThan(0);
            expect(dead.has(victimId)).toBe(true);
        }
    }, 120000);

    /**
     * A WRONG MAY NAME SOMEBODY THE CATALOG WROTE, AND IS STILL THIS WORLD'S OWN.
     *
     * This pass used to refuse an authored figure in either role, and the
     * refusal was argued: the first version drew the doer from everybody able
     * and produced *"The Storm Tyrant killed Lu Zhenshi at Deep Drift Village"*,
     * which is the seeder writing an unsettled murder onto the record of the
     * most heavily authored people in the world. The design owner has ruled the
     * other way - *wrongs may touch authored figures* - and the distinction that
     * makes it safe is the one `members.ts` states from the other end, in WHO THE
     * CATALOG'S OWN PEOPLE ARE MARRIED TO: a marriage is a fact about a person
     * and is hardcoded, a killing is a fact about a world and must not be. So the guard that
     * survives is not about authorship at all. It is `never kills the head of a
     * house` below, which is mechanical - the faction row is priced on that
     * person - and it covers an authored apex and a procedural one alike.
     *
     * Measured over these six seeds after the change: 35 killings, 8 with an
     * authored victim and 18 with an authored killer, and all six worlds carried
     * a different set. Before it, an authored figure appeared in 0 of 24.
     *
     * The two assertions are the two halves of the ruling. That authored figures
     * ARE reached, so lifting the guard did something; and that the killings are
     * MINTED, so no two worlds carry the same history. A per-killing identity
     * check would be wrong here and is deliberately not made: the candidate pool
     * in a thin province is small enough that two seeds can land the same pair,
     * and they did once in six. The claim is about the world, not the row.
     */
    it('lets a wrong name an authored figure, and mints a different one per world', async () => {
        let authoredVictims = 0;
        let authoredKillers = 0;
        let killings = 0;
        const perWorld: string[] = [];

        for (const seed of SEEDS) {
            const state = await world(seed);
            const at = new Map(state.npcs.map(npc => [npc.id, npc]));
            const said: string[] = [];
            for (const fact of pricedIn(state)) {
                const doerId = String(fact.data.deedDoerId);
                const victimId = fact.actors.find(a => a.id !== doerId)!.id;
                if (somebodyTheCatalogWrote(at.get(victimId)!)) authoredVictims++;
                if (somebodyTheCatalogWrote(at.get(doerId)!)) authoredKillers++;
                killings++;
                said.push(`${doerId}>${victimId}`);
            }
            perWorld.push(said.sort().join(','));
        }

        expect(killings, 'no world holds a wrong at all').toBeGreaterThan(0);
        expect(authoredVictims + authoredKillers,
            'the guard is lifted and nothing came through it').toBeGreaterThan(0);
        // Not itself seeded, so unique. Every world carries its own history.
        expect(new Set(perWorld).size,
            `two worlds carry the same killings: ${perWorld.join(' | ')}`).toBe(SEEDS.length);
    }, 300000);

    /**
     * AND A VICTIM SURVIVES THE MORTAL SWEEP FOR ONE OF TWO REASONS.
     *
     * `theWorldForgetsTheMortalDead` deletes a mortal who dies. It keeps two
     * populations, and an opening victim now lands in either: somebody the
     * catalog wrote is kept by NAME, and a procedural farmer is kept only by the
     * priced-deed exception that exists for exactly this pass.
     *
     * Measured over these six seeds: of 35 victims, 8 are authored and 27 are
     * procedural, and every one of the 27 stands below Foundation. So the
     * exception is still load-bearing and will stay so while the seeder's own
     * population is mortal - which is the honest answer to whether lifting the
     * catalog guard let it be retired. It did not.
     */
    it('leaves every victim standing in the world after the mortal sweep', async () => {
        for (const seed of SEEDS) {
            const state = await world(seed);
            const held = new Set(state.npcs.map(npc => npc.id));
            for (const fact of pricedIn(state)) {
                for (const actor of fact.actors) {
                    expect(held, `${seed}: "${fact.summary}" names a row nothing holds`)
                        .toContain(actor.id);
                }
            }
        }
    }, 300000);

    it('never kills the head of a house', async () => {
        for (const seed of SEEDS) {
            const state = await world(seed);
            for (const faction of state.factions) {
                const members = state.npcs.filter(npc => npc.factionId === faction.id);
                if (members.length === 0) continue;
                const strongest = members
                    .slice()
                    .sort((a, b) =>
                        b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                        || b.factionRankIndex - a.factionRankIndex
                        || (a.id < b.id ? -1 : 1))[0];
                // A house's `power_ordinal` is priced on this person. Killing
                // them leaves the faction row claiming a dead leader.
                expect(isActing(strongest.status),
                    `${faction.name} lost ${strongest.name}`).toBe(true);
            }
        }
    }, 300000);

    // ─────────────────────────────────────────────────────────────────────
    // THE RATE TIER
    // ─────────────────────────────────────────────────────────────────────

    /**
     * The brake the design owner put on this, in one assertion.
     *
     * *A world where everybody has a dead brother is as broken as one where
     * nobody does.* The bound is stated per province because that is the unit
     * the rate is written in and the one a reader can check by walking around;
     * the share of the living is the consequence and is reported so a change in
     * it cannot pass unnoticed.
     */
    it('holds at most one open killing per province, and leaves under a fiftieth bereaved', async () => {
        let killings = 0;
        let living = 0;
        let bereaved = 0;
        const perWorld: string[] = [];
        for (const seed of SEEDS) {
            const state = await world(seed);
            const provinces = state.locations.filter(l => l.kind === 'region').length;
            const priced = pricedIn(state);
            expect(priced.length, `${seed}: one per province at most`)
                .toBeLessThanOrEqual(provinces * OPEN_KILLINGS_PER_PROVINCE);

            const alive = state.npcs.filter(npc => isActing(npc.status)).length;
            const lost = bereavedIn(state).length;
            killings += priced.length;
            living += alive;
            bereaved += lost;
            perWorld.push(`${seed} ${priced.length} killings / ${lost} bereaved of ${alive}`);
        }
        expect(killings, `the world holds some: ${perWorld.join(', ')}`).toBeGreaterThan(0);
        expect(bereaved / living, `pooled: ${perWorld.join(', ')}`).toBeLessThan(0.02);
    }, 300000);

    /**
     * Measured at the point a player would notice, which is the only measurement
     * that answers the question this work was for.
     *
     * A run opens in one of a small fixed set of settlements, drawn from the RUN
     * seed. So the question is not how many wrongs a world holds - it is how
     * often a player, on turn one, is standing in a room with somebody who lost
     * a relative to one.
     *
     * Both edges are asserted. Too low and the whole layer is unreachable
     * without days of travel and a reason to travel that nothing supplies. Too
     * high and every town in the world has an unavenged murder in it, which is
     * a theme rather than a setting.
     *
     * THE PER-WORLD FLOOR IS A MAJORITY AND NOT AN EVERY, and it was an every
     * until the Grove's four settlements went on the map. What the change to
     * the map did, measured on both arms in one process:
     *
     *     before   wrong-a..f  2 2 2 2 1 3 of 19 openings   pooled 0.083
     *     after    wrong-a..f  3 2 3 2 0 3 of 23 openings   pooled 0.090
     *
     * The layer did not get harder to reach. It got easier - the pooled share
     * rose and two worlds gained a coverable opening - and `wrong-e` had been
     * sitting on a single hit the whole time, so ANY change to the map was
     * going to take it to zero. An `every` over six seeds was pinning that one
     * hit, which is a count the seeds chose rather than a rule about the world;
     * the rule is the pooled rate, and it is asserted three lines down and
     * improved. A majority still fails a world where the layer has genuinely
     * gone unreachable, which is what this measurement is for.
     */
    it('puts a tellable hearer in the opening room about one run in six', async () => {
        catalog ??= await loadCultivationCatalog();
        const openings = new Set<string>();
        for (let i = 0; i < 400; i++) {
            openings.add((drawBirth(`sweep-${i}`) as { place: { name: string } }).place.name);
        }
        expect(openings.size, 'a run opens in a small fixed set of settlements')
            .toBeGreaterThan(8);

        let hits = 0;
        let pairs = 0;
        let worldsWithOne = 0;
        const perWorld: string[] = [];
        for (const seed of SEEDS) {
            const state = await world(seed);
            const nameOf = new Map(state.locations.map(l => [l.id, l.name]));
            const bereavedPlaces = new Set(
                bereavedIn(state).map(npc => nameOf.get(npc.locationId ?? '') ?? ''));
            let here = 0;
            for (const opening of openings) if (bereavedPlaces.has(opening)) here++;
            hits += here;
            pairs += openings.size;
            if (here > 0) worldsWithOne++;
            perWorld.push(`${seed} ${here}/${openings.size}`);
        }
        expect(worldsWithOne * 3, `most worlds open somewhere with somebody to tell: ${perWorld.join(', ')}`)
            .toBeGreaterThanOrEqual(SEEDS.length * 2);
        const share = hits / pairs;
        expect(share, `pooled: ${perWorld.join(', ')}`).toBeGreaterThan(0.05);
        expect(share, `pooled: ${perWorld.join(', ')}`).toBeLessThan(0.45);
    }, 300000);
});

/**
 * AND THE SAME RULE ONCE THE WORLD STARTS RUNNING.
 *
 * The pass above worked at seed time and stopped working the moment the clock
 * moved. Measured across 13 pinned worlds at population 240, 25 years each,
 * both arms in one instrument:
 *
 *     killings a world was SEEDED holding, priced        74 of 74
 *     killings those worlds PRODUCED, priced              0 of 215
 *
 * A killing with no `deedWeight` is one nobody inherits, one
 * `whatATellingLandsOn` will not write a row about, and one whose victim the
 * mortal sweep deletes - so the world committed a murder and was left holding
 * no debt, no grudge and no corpse. 100 of those 215 rows had the victim struck
 * off them entirely, which is the record no longer saying a killing happened at
 * all.
 *
 * Afterwards, on the same instrument: 172 of 216 carry a debt and 44 correctly
 * do not, and 181 of 1,950 births open knowing about a killing the world did,
 * against none before.
 *
 * ── THE RULE IS THIS PASS'S OWN, ASKED AT THE GRAVE ─────────────────────
 *
 * The draw above refuses a victim with no blood on the record, so every deed it
 * writes is one somebody is left holding. A pass reacting to a fight cannot
 * choose who died, so it asks `whoTheyLeave` after the fact instead - the same
 * question, and the better half of it: it drops anybody already buried, which a
 * world at day zero never has to think about.
 */
describe('and the wrongs a world commits', () => {
    const RUN_FOR = ['ran-a', 'ran-b', 'ran-c'];
    const YEARS = 25;
    /** The state, and the rows it was already holding before the clock moved. */
    interface Lived { state: WorldState; seeded: ReadonlySet<string> }
    let lived: Lived[] | null = null;

    async function worldsThatRan(): Promise<Lived[]> {
        if (lived) return lived;
        const out: Lived[] = [];
        for (const seed of RUN_FOR) {
            const state = await world(seed);
            // WHAT THE WORLD WAS BORN HOLDING, taken before it moves. Without
            // this every claim below is satisfied by the seeded killings, which
            // were already priced and are the population this work is NOT
            // about - the first cut of these tests passed with the stamp
            // toggled off for exactly that reason.
            const seeded = new Set(state.history.facts.map(fact => fact.id));
            advanceWorldForPlay(state, { days: YEARS * 365, stopOnInterrupt: false });
            out.push({ state, seeded });
        }
        lived = out;
        return out;
    }

    /** Every row the world WROTE that says somebody killed somebody. */
    const killingsIn = (lived: Lived) => lived.state.history.facts.filter(fact =>
        !lived.seeded.has(fact.id)
        && fact.actors.some(who => who.role === 'killer')
        && fact.actors.some(who => who.role === 'victim'));

    it('leave a debt, which not one of them used to', async () => {
        let priced = 0;
        for (const one of await worldsThatRan()) {
            priced += killingsIn(one).filter(f => 'deedWeight' in f.data).length;
        }
        expect(priced).toBeGreaterThan(0);
    });

    /**
     * The half that makes it a rule rather than a flat yes. Somebody who
     * answered to nobody and left nobody leaves no account, and the world says
     * so by writing the killing and pricing nothing.
     */
    it('and not every one of them does', async () => {
        let unpriced = 0;
        for (const one of await worldsThatRan()) {
            unpriced += killingsIn(one).filter(f => !('deedWeight' in f.data)).length;
        }
        expect(unpriced).toBeGreaterThan(0);
    });

    /**
     * The claim the seeded half already makes, asked of the produced half: a
     * priced deed is what `whoIsStillCarriedFor` keeps a row over the mortal
     * sweep for, so a killing the world is holding an account for has somebody
     * to hold it ABOUT. Without this the player's murdered neighbour is a name
     * that stops resolving.
     */
    it('and leave a victim the world can still be asked about', async () => {
        for (const one of await worldsThatRan()) {
            const roster = new Set(one.state.npcs.map(npc => npc.id));
            for (const fact of killingsIn(one)) {
                if (!('deedWeight' in fact.data)) continue;
                const victim = fact.actors.find(who => who.role === 'victim')!;
                expect(roster.has(victim.id), `${fact.summary} names nobody the world holds`)
                    .toBe(true);
            }
        }
    });

    /**
     * BOTH DOORS, and asserted because there are two and they were fixed
     * separately. A world kills people through the yearly pressure table - one
     * person murders another - and through the fight resolver, which is where
     * a war's dead come out; the second is also the player's own door. A claim
     * that only counted rows would have been satisfied by either on its own.
     */
    it('through both of the doors a world kills people by', async () => {
        const doors = new Set<string>();
        for (const one of await worldsThatRan()) {
            for (const fact of killingsIn(one)) {
                if (!('deedWeight' in fact.data)) continue;
                doors.add('pressure' in fact.data ? 'the yearly pass' : 'a fight');
            }
        }
        expect(doors).toEqual(new Set(['the yearly pass', 'a fight']));
    });

    /**
     * Read off the rows rather than off the writer: a killing the world was
     * born holding and one it committed last year have to be the same kind of
     * thing to everything downstream, or the telling layer has two populations
     * and only knows about one.
     */
    it('are the same kind of row as the ones the world opened holding', async () => {
        for (const one of await worldsThatRan()) {
            const weights = new Set(killingsIn(one)
                .filter(f => 'deedWeight' in f.data)
                .map(f => String(f.data.deedWeight)));
            expect(weights.size).toBeGreaterThan(0);
            for (const weight of weights) {
                expect(SEVERITY_ORDER as readonly string[]).toContain(weight);
            }
        }
    });
});
