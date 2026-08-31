/**
 * The world has to be reachable in play, not only in the data directory.
 *
 * This suite exists because the repo spent months in a state where thousands of
 * lines of world - the sealed ancestors, the ages and their dead civilisations,
 * the readings of the Lid, the named members, the wanderers, the channels
 * upward - had zero consumers outside `src/data/cultivation/` and the admin
 * register. The world was alive in the test suite and static in the game.
 *
 * So the first describe block below is a REGRESSION GUARD rather than a unit
 * test: it asserts that a representative row from every catalog is still
 * reachable by somebody on the player-facing path. If a future change unwires a
 * catalog, "written but unreachable" fails the build instead of being noticed
 * a year later.
 *
 * The rest pins down the three properties the reachability must not cost:
 *
 * - the discovery gate holds. Nothing is offered that the player already
 *     has, and nothing is printed - only acquired.
 * - the stratum gate holds. A carter does not know what an apex sect is.
 * - the common case stays common. Most talk is local and mundane, and the
 *     deep material surfaces rarely and mostly as fragments.
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';
import { SECTS } from '../../src/data/cultivation/index';
import {
    COMMON_CURRENCY_ORDINAL,
    INSIDER_ONLY_FLOOR,
    LORE,
    LORE_CATALOGS,
    OVERHEARD_BAND_WEIGHTS,
    TOLD_BAND_WEIGHTS,
    WORKING_KNOWLEDGE_MARGIN,
    bandFor,
    holds,
    mentionableFor,
    pickWeighted,
    regionOfPlace,
    type LoreBand,
    type LoreCatalog,
    type Mentionable
} from '../../src/web/lore';
import { offerHearing, recordHearing, speakableFor } from '../../src/web/hearsay';
import { KnowledgeGate } from '../../src/web/knowledge';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support';
import { makeGame } from './harness';
import { CultivationRNG } from '../../src/engine/cultivation/rng';

/** Put somebody in the same place as the player. */
function placePerson(
    db: Database.Database,
    id: string,
    name: string,
    ordinal: number,
    opts: { where?: string; sectId?: string | null; sectRank?: string | null } = {}
) {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO cultivators (
            id, run_id, name, kind, spirit_root, attributes, realm_ordinal,
            cultivation_progress, hp, max_hp, qi, max_qi, satiety, starvation_turns,
            age, years_at_current_realm, spirit_stones, sect_id, sect_rank, location,
            feuds, known_techniques, alive, death_cause, died_on_turn, created_at, updated_at
        ) VALUES (
            @id, NULL, @name, 'npc', 'single_water',
            '{"might":2,"insight":2,"fortune":1,"charm":2}', @ordinal,
            0, 60, 60, 30, 30, 100, 0, 40, 2, 200, @sectId, @sectRank, @where,
            '[]', '[]', 1, NULL, NULL, @now, @now
        )
    `).run({
        id,
        name,
        ordinal,
        where: opts.where ?? 'Sweptground',
        sectId: opts.sectId ?? null,
        sectRank: opts.sectRank ?? null,
        now
    });
}

/** Every catalog that produced at least one row of the given predicate. */
function catalogsWhere(predicate: (entry: Mentionable) => boolean): Set<LoreCatalog> {
    const out = new Set<LoreCatalog>();
    for (const entry of LORE) if (predicate(entry)) out.add(entry.catalog);
    return out;
}

/**
 * Whether ANY speaker in this world could say this row out loud.
 *
 * The strongest honest reading of "reachable in play": some person the player
 * could stand next to holds the name. Insider rows need somebody from that
 * faction, which is a person the world actually contains.
 */
function reachableBySomebody(entry: Mentionable): boolean {
    for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
        if (holds(entry, { ordinal, factionId: null })) return true;
        if (entry.insiderFactionId && holds(entry, { ordinal, factionId: entry.insiderFactionId })) {
            return true;
        }
    }
    return false;
}

// ─────────────────────────────────────────────────────────────────────────

describe('every catalog is reachable in play', () => {
    it('draws on all of them, not just the sect catalog', () => {
        const present = catalogsWhere(() => true);
        for (const catalog of LORE_CATALOGS) {
            expect(present.has(catalog), `${catalog} contributes no rows to the speakable world`)
                .toBe(true);
        }
    });

    it('leaves nothing written but unsayable', () => {
        // The failure this whole file exists to catch: a catalog wired into the
        // table and then gated so hard that no person in the world could ever
        // say any of it.
        const reachable = catalogsWhere(reachableBySomebody);
        for (const catalog of LORE_CATALOGS) {
            expect(reachable.has(catalog), `no speaker in the world can name anything from ${catalog}`)
                .toBe(true);
        }
    });

    it('puts every catalog on the hearsay path specifically', () => {
        // `speakableFor` is what `offerHearing` draws from, and `offerHearing`
        // is what `game.act` calls. Anything visible here is visible in play.
        const byId = new Map(LORE.map(entry => [entry.id, entry]));
        const seen = new Set<LoreCatalog>();
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            for (const name of speakableFor(ordinal)) {
                const entry = byId.get(name.id);
                if (entry) seen.add(entry.catalog);
            }
        }

        // Insider-only material is deliberately absent from the unattached
        // path. It is reachable through a speaker who belongs to the faction,
        // which the next test covers.
        const insiderOnly = new Set<LoreCatalog>(['immortal-channels']);
        for (const catalog of LORE_CATALOGS) {
            if (insiderOnly.has(catalog)) {
                expect(seen.has(catalog), `${catalog} should be insider-only`).toBe(false);
                continue;
            }
            expect(seen.has(catalog), `${catalog} never reaches the hearsay path`).toBe(true);
        }
    });

    it('reaches the insider-only material through somebody who belongs there', () => {
        const channels = LORE.filter(entry => entry.catalog === 'immortal-channels');
        expect(channels.length).toBeGreaterThan(0);

        for (const channel of channels) {
            const faction = channel.insiderFactionId!;
            // An outer disciple of the right house holds it; a patriarch of the
            // wrong one does not. Position, not power.
            expect(holds(channel, { ordinal: 3, factionId: faction })).toBe(true);
            expect(holds(channel, { ordinal: MAX_ORDINAL, factionId: null })).toBe(false);
        }
    });

    it('names nothing twice under two ids', () => {
        // Two rows for one name would let the player acquire it from two
        // sources under two records and read it as two things.
        const seen = new Map<string, string>();
        for (const entry of LORE) {
            const key = entry.name.toLowerCase();
            expect(seen.has(key), `${entry.name} appears as ${seen.get(key)} and ${entry.id}`)
                .toBe(false);
            seen.set(key, entry.id);
        }
    });
});

describe('the stratum gate', () => {
    const carter = { ordinal: 0, factionId: null };

    it('keeps a carter out of what is above him', () => {
        const held = new Set(mentionableFor(carter).map(entry => entry.catalog));
        // He has never needed these words and is not being cagey about them.
        expect(held.has('apex')).toBe(false);
        expect(held.has('lid-theories')).toBe(false);
        expect(held.has('immortal-channels')).toBe(false);
        expect(held.has('immortal-items')).toBe(false);
    });

    it('still lets him say what is simply in the air', () => {
        const held = mentionableFor(carter);
        const ids = new Set(held.map(entry => entry.id));

        // discovery.md's own worked example is a court: "Road's shut past the
        // ford. Sill business, so it'll be shut a while." He says it the way you
        // would say a bank holiday, and cannot tell you a thing about it.
        expect(held.some(entry => entry.catalog === 'courts')).toBe(true);
        // And the enormous factions, for exactly the same reason.
        for (const sect of SECTS.filter(s => s.powerOrdinal >= COMMON_CURRENCY_ORDINAL)) {
            expect(ids.has(sect.id), sect.name).toBe(true);
        }
    });

    it('lets a rumour travel further down than a published deterrent', () => {
        const rumoured = LORE.filter(e => e.catalog === 'sealed-unowned' && e.floorOrdinal <= 8);
        expect(rumoured.length).toBeGreaterThan(0);
        for (const entry of rumoured) expect(holds(entry, carter)).toBe(true);

        // Whereas nothing that is holder-only leaves the walls, for anybody.
        const shut = LORE.filter(e => e.floorOrdinal >= INSIDER_ONLY_FLOOR);
        expect(shut.length).toBeGreaterThan(0);
        for (const entry of shut) {
            expect(holds(entry, { ordinal: MAX_ORDINAL, factionId: null })).toBe(false);
        }
    });

    it('keeps the old sect rule exactly', () => {
        // The rule this module inherited: your own working range, plus anything
        // in the air. Widening the source must not have widened the gate.
        const speakable = new Set(speakableFor(20).map(n => n.id));
        for (const sect of SECTS.filter(s => s.powerOrdinal <= 20 + WORKING_KNOWLEDGE_MARGIN)) {
            expect(speakable.has(sect.id), sect.name).toBe(true);
        }
        const beyond = SECTS.filter(s =>
            s.powerOrdinal > 20 + WORKING_KNOWLEDGE_MARGIN &&
            s.powerOrdinal < COMMON_CURRENCY_ORDINAL);
        for (const sect of beyond) expect(speakable.has(sect.id), sect.name).toBe(false);
    });

    it('does not consult the player knowledge at all', () => {
        // The speaker is not adjusting for their audience. One argument, and it
        // is the speaker's standing.
        expect(speakableFor.length).toBe(1);
        expect(mentionableFor.length).toBe(1);
    });
});

describe('locality decides how often, never whether', () => {
    it('joins a free-text place to the region it sits in', () => {
        expect(regionOfPlace('Sweptground')).toBe('region-low-fall');
        expect(regionOfPlace('Kettle')).toBe('region-quiet-marches');
        expect(regionOfPlace('  low fall  ')).toBe('region-low-fall');
        expect(regionOfPlace('nowhere in particular')).toBeNull();
        expect(regionOfPlace(null)).toBeNull();
    });

    it('reads the same row as local here and regional elsewhere', () => {
        const kettle = LORE.find(entry => entry.name === 'Kettle')!;
        expect(bandFor(kettle, { regionId: 'region-quiet-marches' })).toBe('local');
        expect(bandFor(kettle, { regionId: 'region-low-fall' })).toBe('regional');
        // An unknown place narrows nothing rather than excluding everything.
        expect(bandFor(kettle, { regionId: null })).toBe('regional');
    });

    it('holds deep material deep wherever the listener is standing', () => {
        for (const entry of LORE.filter(e => e.deep)) {
            expect(bandFor(entry, { regionId: 'region-low-fall' })).toBe('deep');
            expect(bandFor(entry, { regionId: null })).toBe('deep');
        }
    });
});

describe('weighting keeps the common case common', () => {
    /** Draw many names and count what band each landed in. */
    function tally(weights: Record<LoreBand, number>): Record<LoreBand, number> {
        const locale = { regionId: 'region-low-fall' };
        // A speaker who can reach into every band, so the shares being measured
        // are the weights rather than an accident of what was available.
        const candidates = mentionableFor({ ordinal: MAX_ORDINAL, factionId: 'sect-hollow-court' });
        const counts: Record<LoreBand, number> = { local: 0, regional: 0, world: 0, deep: 0 };
        for (let i = 0; i < 3_000; i++) {
            const rng = new CultivationRNG(`tally-${i}`);
            const picked = pickWeighted(candidates, locale, weights, rng);
            if (picked) counts[bandFor(picked, locale)]++;
        }
        return counts;
    }

    it('makes most talk local and mundane', () => {
        const counts = tally(TOLD_BAND_WEIGHTS);
        expect(counts.local).toBeGreaterThan(counts.regional);
        expect(counts.local).toBeGreaterThan(counts.world);
        expect(counts.local).toBeGreaterThan(counts.deep);
        // The deep material has to stay rare or it stops being deep.
        expect(counts.deep / 3_000).toBeLessThan(0.1);
    });

    it('surfaces the deep material mostly as overheard fragments', () => {
        const told = tally(TOLD_BAND_WEIGHTS);
        const overheard = tally(OVERHEARD_BAND_WEIGHTS);
        expect(overheard.deep).toBeGreaterThan(told.deep * 3);
        // And even then it is not the bulk of what gets said.
        expect(overheard.local).toBeGreaterThan(overheard.deep);
    });

    it('draws by band rather than by row, so a big catalog cannot buy airtime', () => {
        // MEMBERS is by far the largest catalog. If weighting were per row it
        // would swamp every band it sits in.
        const locale = { regionId: 'region-low-fall' };
        const candidates = mentionableFor({ ordinal: MAX_ORDINAL, factionId: null });
        const localRows = candidates.filter(e => bandFor(e, locale) === 'local');
        const members = localRows.filter(e => e.catalog === 'members');
        expect(members.length).toBeGreaterThan(localRows.length / 2);

        let deep = 0;
        for (let i = 0; i < 2_000; i++) {
            const rng = new CultivationRNG(`share-${i}`);
            const picked = pickWeighted(candidates, locale, OVERHEARD_BAND_WEIGHTS, rng);
            if (picked && picked.deep) deep++;
        }
        // The deep band's share survives the members catalog being enormous.
        expect(deep / 2_000).toBeGreaterThan(0.05);
    });

    it('still produces a name when only the rarest band is available', () => {
        const deepOnly = LORE.filter(entry => entry.deep).slice(0, 5);
        const rng = new CultivationRNG('only-deep');
        expect(pickWeighted(deepOnly, { regionId: null }, TOLD_BAND_WEIGHTS, rng)).not.toBeNull();
        expect(pickWeighted([], { regionId: null }, TOLD_BAND_WEIGHTS, rng)).toBeNull();
    });
});

describe('the deep material actually arrives, with honest provenance', () => {
    it('lands a name from outside the sect catalog in a real run', async () => {
        // The whole point of the change, asserted end to end: sweep occasions
        // until a hearing fires and confirm the player is accumulating names
        // that are not simply the sect list.
        const { db, game } = makeGame({ seed: 'deep-arrives' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-carter', 'The Carter', 4);
        const run = game.state().run as never;
        const carter = repos.cultivators.roster().find(r => r.id === 'npc-carter')!;

        const catalogById = new Map(LORE.map(entry => [entry.id, entry.catalog]));
        const heardCatalogs = new Set<LoreCatalog>();
        for (let i = 0; i < 400; i++) {
            const heard = offerHearing({
                repos, gate, cultivator, run, addressing: carter, occasion: `deep-${i}`
            });
            if (!heard) continue;
            for (const name of heard.names) {
                const catalog = catalogById.get(name.id);
                if (catalog) heardCatalogs.add(catalog);
            }
            recordHearing(gate, cultivator, run, heard);
        }

        expect(heardCatalogs.size).toBeGreaterThan(1);
        expect([...heardCatalogs].some(c => c !== 'sects')).toBe(true);
    });

    it('records who said it, so a carter and an archivist read differently later', async () => {
        const { db, game } = makeGame({ seed: 'provenance' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-carter', 'The Carter', 4);
        placePerson(db, 'npc-clerk', 'The Clerk', 12, {
            sectId: 'sect-lantern-hall', sectRank: 'Lantern Bearer'
        });
        const run = game.state().run as never;
        const roster = repos.cultivators.roster();
        const carter = roster.find(r => r.id === 'npc-carter')!;
        const clerk = roster.find(r => r.id === 'npc-clerk')!;

        let fromCarter = null;
        let fromClerk = null;
        for (let i = 0; i < 60 && !(fromCarter && fromClerk); i++) {
            fromCarter ??= offerHearing({
                repos, gate, cultivator, run, addressing: carter, occasion: `c-${i}`
            });
            fromClerk ??= offerHearing({
                repos, gate, cultivator, run, addressing: clerk, occasion: `k-${i}`
            });
        }
        expect(fromCarter).not.toBeNull();
        expect(fromClerk).not.toBeNull();

        expect(fromCarter!.note).toContain('The Carter');
        expect(fromCarter!.note).toMatch(/attached to nothing/i);
        expect(fromClerk!.note).toContain('The Clerk');
        expect(fromClerk!.note).toMatch(/Lantern Hall/);
        // Different facts. The stance is the same for both and the source is
        // what separates them - and the carter's may still be the true one.
        expect(fromClerk!.confidence).toBeGreaterThan(fromCarter!.confidence);

        recordHearing(gate, cultivator, run, fromCarter!);
        const rows = gate.awareness(cultivator.id).filter(r => r.sourceNote.includes('The Carter'));
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].stance).toBe('suspects');
        expect(rows[0].sourceKind).toBe('told');
    });

    it('never offers a name the player already holds', async () => {
        const { db, game } = makeGame({ seed: 'no-repeats' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-elder', 'The Elder', 22, {
            sectId: 'sect-hollow-court', sectRank: 'Guest of the Court'
        });
        const run = game.state().run as never;
        const elder = repos.cultivators.roster().find(r => r.id === 'npc-elder')!;

        for (let i = 0; i < 200; i++) {
            const heard = offerHearing({
                repos, gate, cultivator, run, addressing: elder, occasion: `dup-${i}`
            });
            if (!heard) continue;
            for (const name of heard.names) {
                expect(gate.isAwareOf(cultivator.id, name.kind, name.id)).toBe(false);
            }
            recordHearing(gate, cultivator, run, heard);
        }
    });
});

describe('the overheard channel', () => {
    it('carries two names from different catalogs when it can', async () => {
        // docs/world/discovery.md: what the player gets is a fragment they
        // cannot resolve - two names, a relationship implied between them, an
        // event that has apparently already happened, and no way to place any
        // of it. One name is a name-drop; two is a fragment.
        const { db, game } = makeGame({ seed: 'fragment' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-one', 'The First', 18, { sectId: 'sect-lantern-hall' });
        placePerson(db, 'npc-two', 'The Second', 21, { sectId: 'sect-azure-cloud-pavilion' });
        const run = game.state().run as never;

        const catalogById = new Map(LORE.map(entry => [entry.id, entry.catalog]));
        let pairs = 0;
        for (let i = 0; i < 120; i++) {
            const heard = offerHearing({ repos, gate, cultivator, run, occasion: `frag-${i}` });
            if (!heard) continue;
            expect(heard.mode).toBe('overheard');
            expect(heard.speaker).toBeNull();
            if (heard.names.length === 2) {
                pairs++;
                const catalogs = heard.names.map(n => catalogById.get(n.id));
                expect(catalogs[0]).not.toBe(catalogs[1]);
            }
            recordHearing(gate, cultivator, run, heard);
        }
        expect(pairs).toBeGreaterThan(0);
    });

    it('records both names as compromising to admit to', async () => {
        const { db, game } = makeGame({ seed: 'wall-two' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-one', 'The First', 16, { sectId: 'sect-lantern-hall' });
        placePerson(db, 'npc-two', 'The Second', 19, { sectId: 'sect-verdant-spring-hall' });
        const run = game.state().run as never;

        let heard = null;
        for (let i = 0; i < 120 && !(heard && heard.names.length === 2); i++) {
            heard = offerHearing({ repos, gate, cultivator, run, occasion: `two-${i}` });
        }
        expect(heard).not.toBeNull();
        const learned = recordHearing(gate, cultivator, run, heard!);
        expect(learned.length).toBe(heard!.names.length);

        for (const name of heard!.names) {
            const row = gate.awareness(cultivator.id).find(r => r.name === name.name)!;
            expect(row.sourceKind).toBe('overheard');
            expect(row.sourceNote).toMatch(/where this cultivator was standing/i);
            expect(row.stance).toBe('suspects');
        }
    });

    it('is still impossible with one person in the courtyard', async () => {
        const { db, game } = makeGame({ seed: 'still-alone' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-one', 'The Only', 14);
        const run = game.state().run as never;

        for (let i = 0; i < 40; i++) {
            expect(offerHearing({ repos, gate, cultivator, run, occasion: `mono-${i}` })).toBeNull();
        }
    });
});
