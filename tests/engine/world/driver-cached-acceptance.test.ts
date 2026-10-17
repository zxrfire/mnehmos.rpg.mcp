/** Source-keyed reachability sample of the original complete500-year run.
 * Its full cumulative deaths/accounts/digest remain, alongside final state.
 * The background builder owns the walk; CI only reads completed bytes and
 * cannot start a long walk. All original state/history/ancestry/knowledge
 * assertions remain. The old30s wall assertion is now a cold wall/CPU report,
 * not an enlarged threshold; the owner uses elapsed time as a yardstick.
 * Exact byte replay was explicitly retired by the reproducibility ruling. */
import { beforeAll, describe, expect, it } from 'vitest';
import { missingNativeFactLinks } from '../../support/native-fact-links.js';
import { readDriverAcceptanceSample, type DriverAcceptanceSample } from '../../support/driver-acceptance-sample.js';
import { queryFacts } from '../../../src/engine/world/history.js';
import { namesPermitted } from '../../support/the-names-a-digest-may-use.js';
const YEAR = 365;
describe('the acceptance sample: five hundred years', () => {
    let before: DriverAcceptanceSample['before'], after: DriverAcceptanceSample['after'];
    let run: DriverAcceptanceSample['run'], state: DriverAcceptanceSample['run']['state'];
    let elapsedMs: number, cpuMs: number, source: string;
    beforeAll(() => {
        const sample = readDriverAcceptanceSample();
        ({ before, after, run, elapsedMs, cpuMs, source } = sample);
        state = run.state;
    });
    it('keeps every present participant linked through five centuries of repeated calls', () => {
        expect(missingNativeFactLinks(state)).toEqual([]);
    });
    it('records five hundred actual years and their measured cold cost', () => {
        // Historical measurement behind the former wall-clock tripwire: The world now runs a pass over
        // everybody with a reason to kill somebody
        // (`why-one-cultivator-kills-another.ts`) and a room that hears what
        // somebody brought about the person holding the seat they want. Measured
        // on this seed at five hundred years: 16.5s without the two passes and
        // 23.1s with them, and most of the difference is not the passes
        // themselves (4ms a year) but the world they leave - 965 rows against
        // 663, because everybody killed, expelled or scattered is replaced.
        // The former tripwire intended to catch SCALING - "not a function of
        // 182,500 days". Native-year exploration now measures that shape.
        //
        // ── WHAT A FAILURE HERE MEANS, AND WHAT IT DOES NOT ──────────────
        //
        // This was a TRIPWIRE ON A QUIET MACHINE. It
        // aimed to catch: a change that makes advancing
        // the world cost more per year, which shows up as this number rising
        // run after run on a box with nothing else on it.
        //
        // IT ALSO FAILS UNDER CONTENTION, and that is not a defect. Measured
        // 23 September: 35,103ms in a full suite at twelve forks on a loaded
        // machine, and PASSING when the same file is run on its own minutes
        // later against the same commit. Somebody reading the red without that
        // will go hunting for a slowdown that is not there - or, worse, raise
        // the bound to make it quiet and throw the tripwire away.
        //
        // So: red here on a full parallel run means nothing until it is red
        // ALONE. Re-run this file by itself before believing it, and only then
        // ask what got slower.
        // Summit wiring computed neighbourhood rates even for people already at
        // their ground or manual ceiling. The climb now checks that ceiling first,
        // preserving every computed climb while avoiding those unused area reads.
        // Neutral neighbours use the same rate reader before constructing areas.
        // The former fixed wall tripwire above is historical. Shared-slot
        // wall time is now a reported yardstick in the standalone builder;
        // CI retains exact clock conservation and all observable state claims.
        console.log('[driver-fixture-cost]', JSON.stringify({ elapsedMs, cpuMs, source }));
        expect(run.daysAdvanced).toBe(500 * YEAR);
        expect(after.year).toBe(before.year + 500);
    });

    it('factions have risen and fallen', () => {
        expect(after.dissolvedFactions).toBeGreaterThan(0);
        const founded = queryFacts(state.history, { kinds: ['faction_founded'], fromDay: before.day });
        const fallen = queryFacts(state.history, { kinds: ['faction_fallen'], fromDay: before.day });
        // HOUSES FALL, AND A HOUSE IS FOUNDED WHEN SOMEBODY SPLITS ONE - which
        // is now rare on purpose. A splinter needs somebody held back for whom
        // going is worth more than what leaving costs them
        // (`who-splits-a-house-and-who-goes-with-them.ts`), and the catalog
        // worlds carry about one a century; this fixture's houses are small
        // enough to produce none in five hundred years, so the claim is that the
        // roster moved rather than that it moved in both directions.
        expect(founded.length + fallen.length).toBeGreaterThan(0);
        expect(fallen.length).toBeGreaterThan(0);
        // The roster is not the one it started with.
        expect(after.factionIds).not.toEqual(before.factionIds);
    });

    it('people have died and been inherited from', () => {
        expect(run.deaths.length).toBeGreaterThan(100);
        const inherited = run.deaths.filter(d => d.primaryHeirId !== null);
        expect(inherited.length).toBeGreaterThan(0);
        expect(queryFacts(state.history, { kinds: ['inheritance'] }).length).toBeGreaterThan(0);
        // Nobody who started is still walking around.
        expect(after.livingNpcs).toBeLessThan(before.livingNpcs);
    });

    it('grudges are still live and have passed to descendants', () => {
        // The charter's wording, and the half an heir would rather not have.
        expect(after.inheritedGrudges).toBeGreaterThan(0);
        const carried = state.npcs
            .flatMap(n => n.relationships)
            .filter(r => r.inheritedFromId !== null && r.standing < 0);
        expect(carried.length).toBeGreaterThan(0);
        for (const account of carried.slice(0, 10)) {
            expect(account.targetId).not.toBe(account.inheritedFromId);
            expect(account.note.length).toBeGreaterThan(0);
        }
    });

    it('goals have outlived their holders and passed down', () => {
        expect(after.inheritedGoals).toBeGreaterThan(0);
        const carried = state.npcs
            .flatMap(n => n.goals)
            .filter(g => g.generation > 0);
        for (const goal of carried.slice(0, 20)) {
            // The date is the original one: a goal three centuries old reads as
            // three centuries old.
            expect(goal.openedOnDay).toBeLessThan(state.currentDay);
            expect(goal.originHolderId).not.toBe('');
            expect(goal.inheritedFromId).not.toBeNull();
        }
    });

    it('history has accumulated with discoverable causes', () => {
        expect(after.facts).toBeGreaterThan(before.facts + 100);
        // Facts that point at earlier facts: the chain the present is explained by.
        const caused = state.history.facts.filter(f => f.causes.length > 0);
        expect(caused.length).toBeGreaterThan(0);
        const ids = new Set(state.history.facts.map(f => f.id));
        for (const fact of caused) {
            for (const cause of fact.causes) expect(ids.has(cause)).toBe(true);
        }
        // And some of it is genuinely not known, which is a feature.
        expect(after.unresolvedFacts).toBeGreaterThan(0);
    });

    it('locations have changed and carry their scars', () => {
        expect(after.locationChanges).toBeGreaterThan(before.locationChanges + 10);
        const changed = state.locations.filter(l => l.changes.length > 0);
        expect(changed.length).toBeGreaterThan(0);
        for (const loc of changed.slice(0, 20)) {
            // Every change is dated, ordered, and inside the run.
            let last = -Infinity;
            for (const change of loc.changes) {
                expect(change.onDay).toBeGreaterThanOrEqual(last);
                last = change.onDay;
                expect(change.summary.length).toBeGreaterThan(0);
            }
        }
        // Somewhere is now something it was not.
        expect(after.changedLocations).toBeGreaterThan(0);
    });

    it('nothing is incoherent', () => {
        // Every faction reference on a location resolves.
        const factionIds = new Set(state.factions.map(f => f.id));
        for (const loc of state.locations) {
            if (loc.controllingFactionId) expect(factionIds.has(loc.controllingFactionId)).toBe(true);
        }
        // A dissolved faction holds nobody and nothing.
        for (const faction of state.factions) {
            if (faction.dissolvedOnDay === null) continue;
            const members = state.npcs.filter(n => n.factionId === faction.id && n.status === 'alive');
            expect(members).toHaveLength(0);
        }
        // Nobody is in a faction that does not exist, or a place that does not.
        const locationIds = new Set(state.locations.map(l => l.id));
        for (const npc of state.npcs) {
            if (npc.factionId) expect(factionIds.has(npc.factionId)).toBe(true);
            if (npc.locationId) expect(locationIds.has(npc.locationId)).toBe(true);
            if (npc.status === 'physically_dead') expect(npc.diedOnDay).not.toBeNull();
        }
        // Every fact is dated inside the world's own history.
        for (const fact of state.history.facts) {
            expect(fact.day).toBeLessThanOrEqual(state.currentDay);
        }
        // Lineage edges never point at somebody born first - AND ONLY THE
        // GENERATIONAL ONES DO. A `clan` edge is a MARRIAGE, written through
        // the same two fields because `addLineageEdge` has only `parentId` and
        // `childId` to put a pair in, and there is no reason on earth for one
        // spouse to have been born after the other.
        //
        // Measured on `seed-a`: 4 of 101 edges failed this, and every one of
        // them was `relation: 'clan'` with a `spouse` tie behind it - He
        // Peichen and Wei Zhaoshan, Lu Minwu and Lu Anming, Ge Yiran and Wen
        // Danyang, Luo Zhaowu and Peng Kuanbo. Not one descendant edge
        // ran backwards. The rule was sound and the scope was not.
        for (const lineage of state.lineages) {
            for (const edge of lineage.edges) {
                if (edge.relation !== 'descendant') continue;
                const parent = state.npcs.find(n => n.id === edge.parentId);
                const child = state.npcs.find(n => n.id === edge.childId);
                if (parent && child) {
                    expect(child.identity.bornOnDay).toBeGreaterThan(parent.identity.bornOnDay);
                }
            }
        }
    });

    it('and the player, being a nobody, learned almost none of it', () => {
        const digest = run.digest!;
        // The world did far more than reached them.
        expect(digest.unheard).toBeGreaterThan(digest.lines.length);
        // What did reach them was mostly nameless.
        expect(digest.unattributed).toBeGreaterThan(0);
        // And nothing they were handed names a faction they never heard of.
        const permitted = namesPermitted(digest);
        for (const id of permitted.factions) expect(id).toBe('sect-azure-cloud');
        for (const line of digest.lines) {
            if (line.form === 'named') continue;
            expect(line.text).not.toMatch(/Crimson Abyss|Third Sluice|Ancient Bough Grove|Clearwater Ward|Golden Sheaf Sect/);
        }
    });

    // Exact record replay was retired by the owner; RNG streams remain named.
});
