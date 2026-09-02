/**
 * The discovery rule.
 *
 * docs/world/discovery.md: never reference an entity the player has no
 * knowledge record for. A Qi Condensation cultivator in a village does not know
 * the ancient sects exist, and that is the accurate state of almost everyone.
 *
 * These tests are about the enforcement rather than the instruction. Telling a
 * model not to name what it has not been given is necessary and not sufficient;
 * what these check is that it is never given the names in the first place -
 * not in the state summary, not in an entity resolution, and not leaking out
 * through a refusal message.
 */

import { describe, it, expect } from 'vitest';
import { REGIONS, SECTS } from '../../src/data/cultivation/index';
import { KnowledgeGate, existenceClaimKey } from '../../src/web/knowledge';
import {
    DISCOVERY_RULE,
    composeNarrationUser,
    composeStateSummary,
    narratorCore,
    narrationSystemPrompt
} from '../../src/web/prompt';
import { resolveSect } from '../../src/web/entities';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support';
import { makeGame, engineCalls, refusedCall, planned, ScriptedProvider } from './harness';
import { drawBirth } from '../../src/engine/birth/birth';

/** The sect a villager is seeded with: the softest body that takes applicants. */
const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/** A sect the player has demonstrably not been told about. */
const UNHEARD_SECT = SECTS.find(sect => sect.id !== LOCAL_SECT.id)!;

/**
 * Where the default harness seed actually births somebody.
 *
 * Derived rather than named. Every run used to open in the same village, so
 * writing "Sweptground" here was correct by construction; with birth origins
 * drawn from the seed it would be correct by luck, and luck is what this file
 * exists to stop relying on.
 */
const HOME_PLACE = drawBirth('test-seed').place.name;

/** The county a new cultivator is born into. Everything in it is ordinary. */
const HOME_REGION = REGIONS.find(region =>
    region.places.some(place => place.name === HOME_PLACE))!;

/** The next town over, whichever it is. Ordinary local knowledge either way. */
const NEIGHBOUR_PLACE = HOME_REGION.places.find(place => place.name !== HOME_PLACE)!.name;

/**
 * Open a run and apply the county floor.
 *
 * `seedStartingAwareness` is the knowledge layer's floor and it is applied
 * here rather than by the run, because the run does not call it yet: birth
 * seeds its own rows and only grants the province to a family with reach,
 * which leaves nine births in ten holding exactly one place name and unable to
 * travel anywhere. The floor is a FLOOR - every write goes through
 * `learnIfNew`, so it never demotes what a good birth already granted - and
 * `GameService.newRun` should call it immediately after applying
 * `birth.knowledge`. Until it does, these tests apply it themselves and the
 * behaviour they pin is the behaviour that lands the moment it is wired.
 */
async function newVillager(): Promise<{
    db: ReturnType<typeof makeGame>['db'];
    game: ReturnType<typeof makeGame>['game'];
    cultivator: { id: string; location: string | null };
    gate: KnowledgeGate;
}> {
    const { db, game } = makeGame();
    const { cultivator } = await game.newRun('Villager');
    const gate = new KnowledgeGate(db);
    gate.seedStartingAwareness(cultivator.id, 0, cultivator.location ?? HOME_PLACE, null);
    return { db, game, cultivator, gate };
}

describe('a new cultivator starts knowing almost nothing', () => {
    it('starts with the county and nothing past it', async () => {
        const { cultivator, gate } = await newVillager();

        const places = gate.awareness(cultivator.id, 'place');
        const named = new Set(places.map(row => row.name));

        // discovery.md's line is "their world is the county", and the county is
        // not one village. Somebody born in a temple town can name the market
        // town two days off, because everybody around them could.
        expect(named.has(HOME_PLACE)).toBe(true);
        for (const neighbour of HOME_REGION.places) {
            expect(named.has(neighbour.name)).toBe(true);
        }
        // And the province itself - unless a town inside it is called the same
        // thing, in which case the town is the row worth holding, because it is
        // somewhere a person can walk to.
        const seatSharesTheName = HOME_REGION.places
            .some(place => HOME_REGION.name.toLowerCase().endsWith(place.name.toLowerCase()));
        expect(named.has(HOME_REGION.name) || seatSharesTheName).toBe(true);

        // The county, and not an inch more. Every other province on the map is
        // a name and nothing else, and everything else in the world is unheard
        // of entirely.
        for (const region of REGIONS) {
            if (region.id === HOME_REGION.id) continue;
            for (const place of region.places) {
                expect(named.has(place.name)).toBe(false);
            }
        }
        expect(gate.awareness(cultivator.id, 'sect').map(row => row.name))
            .toEqual([LOCAL_SECT.name]);
        expect(SECTS.length).toBeGreaterThan(2);
    });

    /**
     * The bug this seed exists to fix, kept as an assertion.
     *
     * Travel is gated on being able to name a destination. Before this, a new
     * cultivator held exactly one place record - where they were standing - and
     * nothing in the early game granted another, so a run was confined for its
     * whole life to the ground it was born on and died at the bottom of the
     * ladder on halved cultivation. Measured across seven playthroughs from a
     * clean database, every one of them.
     */
    it('can name somewhere other than where it is standing', async () => {
        const { cultivator, gate } = await newVillager();

        const elsewhere = gate.awareness(cultivator.id, 'place')
            .filter(row => row.name !== HOME_PLACE);

        expect(elsewhere.length).toBeGreaterThan(1);
        // And can point at them, which is the predicate that licenses setting
        // out. Being able to name a place is not the same as being able to go
        // to one, and only the second is a route out of the village.
        expect(elsewhere.some(row => gate.canPointAt(cultivator.id, 'place', row.id))).toBe(true);
    });

    it('records where each name came from, not just that it is held', async () => {
        const { cultivator, gate } = await newVillager();

        const home = gate.awareness(cultivator.id, 'place')
            .find(row => row.name === HOME_PLACE)!;
        expect(home).toMatchObject({ stance: 'knows', sourceKind: 'witnessed', stage: 'known' });

        // The next town over is ordinary local knowledge, held on somebody
        // else's word, and it is stored as exactly that rather than as
        // something they have seen.
        const neighbour = gate.awareness(cultivator.id, 'place')
            .find(row => row.name === NEIGHBOUR_PLACE)!;
        expect(neighbour).toMatchObject({ sourceKind: 'told', stage: 'placed' });

        // A name everyone in the county repeats is a belief, not a certainty,
        // and it is stored as one.
        const sect = gate.awareness(cultivator.id, 'sect')[0];
        expect(sect).toMatchObject({ stance: 'believes', sourceKind: 'told', stage: 'named' });
        expect(sect.sourceNote).toMatch(/county/i);
    });

    it('knows the province over the border by name and no more', async () => {
        const { cultivator, gate } = await newVillager();

        const beyond = REGIONS.find(region => region.id !== HOME_REGION.id)!;
        // A name, a direction, and nothing anybody local could tell them.
        expect(gate.stageOf(cultivator.id, 'place', beyond.name)).toBe('named');
        expect(gate.canPointAt(cultivator.id, 'place', beyond.name)).toBe(false);
    });

    it('files awareness as an ordinary knowledge record, not a new table', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Villager');

        const row = db
            .prepare('SELECT * FROM knowledge_records WHERE holder_id = ? AND claim_key = ?')
            .get(cultivator.id, existenceClaimKey('sect', LOCAL_SECT.id)) as Record<string, unknown>;

        expect(row).toBeDefined();
        expect(row.holder_kind).toBe('character');
        expect(row.stance).toBe('believes');
        expect(row.source_kind).toBe('told');
        expect(row.superseded).toBe(0);
    });
});

describe('an unheard-of entity does not resolve', () => {
    it('refuses to describe a sect the player has never heard named', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const result = await game.act(`I examine ${UNHEARD_SECT.name}.`);
        const refusal = refusedCall(result);

        expect(refusal).not.toBeNull();
        // And the refusal does not leak the thing it is refusing to describe:
        // "you have never heard of it" and "it is not there" look the same from
        // inside, or the error message becomes the answer key.
        expect(refusal!.summary).not.toContain(UNHEARD_SECT.description);
        expect(refusal!.summary).toMatch(/has heard of|know of|no knowledge/i);
    });

    it('refuses to approach a faction the player has never heard named', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const result = await game.act(`I negotiate with ${UNHEARD_SECT.name}.`);
        expect(planned(result).action).toBe('interact');
        expect(refusedCall(result)).not.toBeNull();
        expect(engineCalls(result).some(c => c.name === 'engine.resolveInteraction')).toBe(false);
    });

    it('resolves the one sect the player has actually heard of', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const result = await game.act(`I examine ${LOCAL_SECT.name}.`);
        expect(refusedCall(result)).toBeNull();
        expect(engineCalls(result)[0].summary).toContain('sect');
        expect(result.narration).toContain(LOCAL_SECT.name);
    });
});

describe('being in the room counts', () => {
    /** Put a stranger in the same place as the player. */
    function placeStranger(db: any, where: string, name = 'The Stranger') {
        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO cultivators (
                id, run_id, name, kind, spirit_root, attributes, realm_ordinal,
                cultivation_progress, hp, max_hp, qi, max_qi, satiety, starvation_turns,
                age, years_at_current_realm, spirit_stones, sect_id, sect_rank, location,
                feuds, known_techniques, alive, death_cause, died_on_turn, created_at, updated_at
            ) VALUES (
                'npc-stranger', NULL, @name, 'npc', 'single_water',
                '{"might":2,"insight":2,"fortune":1,"charm":2}', 8,
                0, 60, 60, 30, 30, 100, 0, 40, 2, 200, NULL, NULL, @where,
                '[]', '[]', 1, NULL, NULL, @now, @now
            )
        `).run({ name, where, now });
    }

    it('resolves somebody standing in the same place with no prior record', async () => {
        const { db, game } = makeGame();
        await game.newRun('Villager');
        placeStranger(db, HOME_PLACE);

        const result = await game.act('I speak with The Stranger.');
        expect(planned(result).action).toBe('interact');
        expect(refusedCall(result)?.name).not.toBe('engine.resolveParty');
        expect(engineCalls(result)[0].summary).toMatch(/The Stranger/);
    });

    it('writes that encounter down, with witnessed as the source', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Villager');
        placeStranger(db, HOME_PLACE);

        await game.act('I speak with The Stranger.');

        const gate = new KnowledgeGate(db);
        expect(gate.isAwareOf(cultivator.id, 'cultivator', 'npc-stranger')).toBe(true);
        // Found rather than indexed: the same turn can also deposit a name
        // somebody dropped in passing, and hearsay now draws people out of the
        // catalogs as well as factions, so "the first person row" is no longer
        // the same thing as "the person they just met".
        const record = gate.awareness(cultivator.id, 'cultivator')
            .find(row => row.id === 'npc-stranger');
        expect(record).toMatchObject({ name: 'The Stranger', sourceKind: 'witnessed' });
    });

    it('does not resolve somebody standing somewhere else', async () => {
        const { db, game } = makeGame();
        await game.newRun('Villager');
        placeStranger(db, 'The Low Fall');

        const result = await game.act('I speak with The Stranger.');
        expect(refusedCall(result)).not.toBeNull();
        expect(refusedCall(result)!.name).toBe('engine.resolveParty');
    });

    it('moves a place up the ladder once the cultivator has stood in it', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Walker');
        const gate = new KnowledgeGate(db);

        // Local geography, held on everybody else's word. They can point at it
        // and set out for it, and they have never seen it.
        expect(gate.stageOf(cultivator.id, 'place', NEIGHBOUR_PLACE)).toBe('placed');
        await game.act(`I travel to ${NEIGHBOUR_PLACE}.`);
        // Having been there is a different fact, from a different source, and
        // it is a step rather than a duplicate.
        expect(gate.stageOf(cultivator.id, 'place', NEIGHBOUR_PLACE)).toBe('encountered');

        const place = gate.awareness(cultivator.id, 'place').find(row => row.name === 'Scarwater');
        expect(place).toMatchObject({ sourceKind: 'witnessed', stance: 'knows' });

        // And the older, weaker record is still on file. Nothing in this layer
        // is overwritten: how somebody came to hold something twice is the
        // thing a player later pays to have untangled.
        const chain = gate.provenanceOf(cultivator.id, 'place', NEIGHBOUR_PLACE);
        expect(chain.map(row => row.sourceKind).sort()).toEqual(['told', 'witnessed']);
    });
});

describe('the prompt never carries the answer key', () => {
    it('sends the classifier only what this cultivator has heard of', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);

        const summary = composeStateSummary({
            cultivator,
            run: game.state().run as never,
            ambient: 'thin',
            awareness: gate.awareness(cultivator.id)
        });

        expect(summary).toContain('HAS HEARD OF');
        expect(summary).toContain(LOCAL_SECT.name);
        for (const sect of SECTS) {
            if (sect.id === LOCAL_SECT.id) continue;
            expect(summary).not.toContain(sect.name);
        }
    });

    it('gives the narrator an explicit whitelist and nothing beyond it', () => {
        const message = composeNarrationUser(
            { headline: 'A road.', lines: [`The road out of ${HOME_PLACE} is closed.`], prose: '' },
            {
                place: HOME_PLACE,
                ambient: 'thin',
                awareness: [{
                    kind: 'place',
                    id: 'sweptground',
                    name: HOME_PLACE,
                    statement: `${HOME_PLACE} is where they are from.`,
                    stance: 'knows',
                    sourceKind: 'witnessed',
                    sourceNote: '',
                    acquiredOnDay: 0,
                    stage: 'known'
                }]
            }
        );

        expect(message).toContain('NAMES YOU MAY USE');
        expect(message).toContain(`- ${HOME_PLACE}`);
        for (const sect of SECTS) {
            expect(message).not.toContain(sect.name);
        }
    });

    it('says so plainly when the cultivator has heard of nothing', () => {
        const message = composeNarrationUser(
            { headline: 'x', lines: ['y'], prose: '' },
            { place: 'Nowhere', ambient: 'thin', awareness: [] }
        );
        expect(message).toMatch(/heard of nobody and nowhere/);
    });

    it('carries the whitelist through the real narrator call', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['A road, and nobody on it.']
        });
        const { game } = makeGame({ provider });
        await game.newRun('Villager');
        await game.act('I look around.');

        const narrationCall = provider.calls.at(-1)!;
        const user = narrationCall.messages.find(m => m.role === 'user')!.content;
        const system = narrationCall.messages.find(m => m.role === 'system')!.content;

        expect(user).toContain('NAMES YOU MAY USE');
        expect(user).toContain(HOME_PLACE);
        for (const sect of SECTS) {
            if (sect.id === LOCAL_SECT.id) continue;
            expect(user).not.toContain(sect.name);
        }

        expect(system).toContain('WHAT MAY BE NAMED');
        expect(system).toMatch(/does\s+not\s+exist\s+as\s+far\s+as\s+your\s+own\s+prose\s+is\s+concerned/);
    });
});

describe('the narrator constitution', () => {
    it('is loaded from docs/world/NARRATOR-CORE.md rather than paraphrased', () => {
        const core = narratorCore();
        expect(core.source).toBe('file');
        expect(core.text).toContain('# Narrator Core');
        expect(core.text).toContain('The AI narrates. The engine decides.');
    });

    it('puts Tier 1 and the discovery rule into the narration prompt', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toContain(narratorCore().text);
        expect(prompt).toContain(DISCOVERY_RULE);
        // Tier 1 comes before the setting detail: it is the constitution.
        expect(prompt.indexOf('Narrator Core')).toBeLessThan(prompt.indexOf('THE CEILING'));
    });

    it('states unattributed consequence as the preferred move', () => {
        expect(DISCOVERY_RULE).toMatch(/consequence without attribution/i);
        expect(DISCOVERY_RULE).toMatch(/leave the cause unnamed/i);
    });

    it('carries the higher-stratum texture', () => {
        expect(DISCOVERY_RULE).toMatch(/entourage tells them more/i);
        expect(DISCOVERY_RULE).toMatch(/usually not interested/i);
        expect(DISCOVERY_RULE).toMatch(/Do not explain them/i);
    });
});

describe('a permitted lookup does not leak the names inside it', () => {
    it('names no other sect when the player examines the one they know', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const result = await game.act(`I examine ${LOCAL_SECT.name}.`);
        const text = result.narration + JSON.stringify(result.toolCalls);

        // The sect itself is nameable. Everything it is connected to - the
        // sects it feuds with, the ground it sits on - is not, and asking about
        // the one you know must not hand over the ones you do not.
        expect(text).toContain(LOCAL_SECT.name);
        for (const sect of SECTS) {
            if (sect.id === LOCAL_SECT.id) continue;
            expect(text).not.toContain(sect.name);
        }
    });

    it('redacts rivals and seat out of a catalog sect for a holder who knows neither', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);

        const withRivals = SECTS.find(sect => sect.rivals.length > 0)!;
        gate.learn({
            holderId: cultivator.id,
            kind: 'sect',
            id: withRivals.id,
            name: withRivals.name,
            onDay: 0,
            sourceKind: 'told',
            sourceNote: 'A traveller mentioned it once.'
        });

        const repos = ensureCultivationDb();
        const scope = { gate, holderId: cultivator.id, here: HOME_PLACE };
        // Force the catalog branch by asking about a sect id the database has
        // no row for, which is what an unseeded deployment would hit.
        db.prepare('DELETE FROM sects WHERE id = ?').run(withRivals.id);

        const resolved = resolveSect(repos, withRivals.name, scope)!;
        expect(resolved).not.toBeNull();
        const text = resolved.facts.join(' ');

        expect(text).toContain(withRivals.name);
        for (const rivalId of withRivals.rivals) {
            const rival = SECTS.find(sect => sect.id === rivalId);
            if (rival) expect(text).not.toContain(rival.name);
        }
        expect(text).toMatch(/none of whom this cultivator could name/i);
        // The seat is a place the player has never heard of either, so it is
        // reported as unlocatable rather than named.
        expect(text).toMatch(/not something this cultivator could point to/i);
        expect(text).not.toContain(withRivals.territory);
    });

    it('withholds the faction and whereabouts of somebody merely seen', async () => {
        const { db, game } = makeGame();
        await game.newRun('Villager');

        // Sects are seeded from the catalog, so use one that is already there.
        const otherSect = SECTS.find(sect => sect.id !== LOCAL_SECT.id)!;
        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO cultivators (
                id, run_id, name, kind, spirit_root, attributes, realm_ordinal,
                cultivation_progress, hp, max_hp, qi, max_qi, satiety, starvation_turns,
                age, years_at_current_realm, spirit_stones, sect_id, sect_rank, location,
                feuds, known_techniques, alive, death_cause, died_on_turn, created_at, updated_at
            ) VALUES (
                'npc-envoy', NULL, 'The Envoy', 'npc', 'single_metal',
                '{"might":3,"insight":3,"fortune":2,"charm":3}', 22,
                0, 200, 200, 90, 90, 100, 0, 300, 4, 9000, @sect, 'Elder', @where,
                '[]', '[]', 1, NULL, NULL, @now, @now
            )
        `).run({ sect: otherSect.id, now, where: HOME_PLACE });

        const result = await game.act('I speak with The Envoy.');
        const text = result.narration + JSON.stringify(result.toolCalls);

        // Standing in the same courtyard makes them visible, not legible.
        expect(text).toContain('The Envoy');
        expect(text).not.toContain(otherSect.name);
        expect(text).toMatch(/name means nothing to this cultivator/i);
    });
});
