/**
 * A player can reach ground that teaches a road.
 *
 * `daoGroundsInReachOf` had no caller anywhere in `src/web` or `src/server`.
 * Twenty-three dao grounds were seeded into every world, the whole simulation
 * walked roads off them, and nothing a player could type reached one: no source
 * could put the name of one into their knowledge, standing on one resolved to
 * no province at all, and there was no sentence that asked what one wanted.
 *
 * These guard the four joints of that loop, and the last one is the point: the
 * rule the world runs for its own people is the rule the player is held to, and
 * a ground that will not teach says exactly what would change it.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import { discoveryContextFor } from '../../src/server/consolidated/cultivation-support';
import {
    ARTIFACT_LEGIBLE_WITHIN,
    STANDING_TO_STUDY_A_HOUSE_OBJECT,
    daoGroundsInReachOf,
    groundFromCatalogRow,
    howSomebodyStandsToAGround,
    howSomebodyStandsToAnObject,
    roadsCarriedByObjectsInReachOf,
    seedPlacesThatTeachADao,
    type SomebodyStanding
} from '../../src/engine/world/how-a-cultivator-comes-by-a-road';
import {
    PLACES_THAT_TEACH_A_DAO,
    daoGroundNamed,
    getPlaceThatTeachesADao
} from '../../src/data/cultivation/places-that-teach-a-dao';
import {
    groundThatTeachesARoad,
    howAPlayerStands,
    thingsCarriedThatTeachARoad,
    whatThisGroundWants,
    whatThisThingWants,
    whatSomebodyWouldSayAbout,
    whatTheyNowHold,
    whoCouldPointAtAGround
} from '../../src/web/ground-that-teaches-a-road';
import { rankName } from '../../src/engine/cultivation/realms';
import { createWorld, type WorldState } from '../../src/engine/world/world-state';
import { makeLocation } from '../../src/engine/world/locations';
import { createNpc } from '../../src/engine/world/npc-state';
import {
    discoverableInsights,
    formInsight,
    recordAchievement
} from '../../src/engine/cultivation/understanding';
import { forStream } from '../../src/engine/cultivation/rng';
import { applyTimeSkip } from '../../src/web/apply';
import { regionIdOfPlace } from '../../src/data/cultivation/regions';
import type { Achievement, Insight, TimeSkipResult } from '../../src/schema/cultivation';

/** A skip that changed nothing except what the cultivator understood. */
function skipThatOnlyTaught(insight: Insight, achievement: Achievement): TimeSkipResult {
    return {
        requestedDays: 30,
        simulatedDays: 30,
        interrupted: false,
        interruptReason: null,
        events: [],
        deltas: {
            cultivationProgress: 0, realmOrdinal: 0, hp: 0, qi: 0, satiety: 0,
            age: 30 / 360, injuriesGained: 0, spiritStones: 0
        },
        died: false,
        deathCause: null,
        injuriesSustained: [],
        breakthroughs: [],
        tolls: [],
        foundationEstablished: null,
        insightsGained: [insight],
        achievements: [achievement],
        visions: [],
        endState: { starvationTurns: 0, bleedingTurns: 0, yearsAtCurrentRealm: 0 }
    } as unknown as TimeSkipResult;
}

/** A worked example of each access kind, by id, so the cases stay legible. */
const FORD = getPlaceThatTeachesADao('dao-ground-grinding-ford')!;
const CLIFF = getPlaceThatTeachesADao('dao-ground-sword-marked-cliff')!;
const REGISTER = getPlaceThatTeachesADao('dao-ground-unwritten-register')!;

const nobody = (over: Partial<SomebodyStanding> = {}): SomebodyStanding => ({
    ordinal: 0,
    regionCatalogId: null,
    factionId: null,
    factionRankIndex: -1,
    ...over
});

describe('one rule decides who a ground teaches, and what it is short of', () => {
    it('separates knowing where a landmark is from being able to read it', () => {
        // The cart drivers of the Quiet Marches have crossed the ford for six
        // hundred years and nobody there thinks of it as cultivation. They can
        // all point at it. Almost none of them takes anything off it - and that
        // gap is what makes them a source the player can be told by.
        const local = howSomebodyStandsToAGround(
            groundFromCatalogRow(FORD),
            nobody({ ordinal: 0, regionCatalogId: FORD.regionId })
        );
        expect(local.knowsWhereItIs).toBe(true);
        expect(local.inReach).toBe(false);
        expect(local.shortBy).toBe('below_the_floor');

        const readable = howSomebodyStandsToAGround(
            groundFromCatalogRow(FORD),
            nobody({ ordinal: FORD.fromOrdinal, regionCatalogId: FORD.regionId })
        );
        expect(readable).toEqual({ knowsWhereItIs: true, inReach: true, shortBy: null });
    });

    it('says province before rung, because that is the order somebody meets them', () => {
        const away = howSomebodyStandsToAGround(
            groundFromCatalogRow(FORD),
            nobody({ ordinal: 0, regionCatalogId: 'region-white-stair' })
        );
        // Not `below_the_floor`, which would be true and useless to somebody
        // standing in another province.
        expect(away.shortBy).toBe('somewhere_else');
        expect(away.knowsWhereItIs).toBe(false);
    });

    it('holds a house ground to membership first and then to standing', () => {
        const outsider = howSomebodyStandsToAGround(
            groundFromCatalogRow(CLIFF),
            nobody({ ordinal: 40, regionCatalogId: CLIFF.regionId })
        );
        expect(outsider.shortBy).toBe('not_of_the_house');
        expect(outsider.knowsWhereItIs).toBe(false);

        const junior = howSomebodyStandsToAGround(
            groundFromCatalogRow(CLIFF),
            nobody({
                ordinal: 40,
                regionCatalogId: CLIFF.regionId,
                factionId: CLIFF.heldBy,
                factionRankIndex: CLIFF.standingRequired - 1
            })
        );
        // Of the house: they know the terrace is up there and are not let on
        // it. This is what standing buys and nothing else does.
        expect(junior.knowsWhereItIs).toBe(true);
        expect(junior.shortBy).toBe('standing');

        const elder = howSomebodyStandsToAGround(
            groundFromCatalogRow(CLIFF),
            nobody({
                ordinal: CLIFF.fromOrdinal,
                regionCatalogId: CLIFF.regionId,
                factionId: CLIFF.heldBy,
                factionRankIndex: CLIFF.standingRequired
            })
        );
        expect(elder.inReach).toBe(true);
    });

    it('hides a buried ground from everybody alive until it is dug out', () => {
        const unfound = howSomebodyStandsToAGround(
            groundFromCatalogRow(REGISTER),
            nobody({ ordinal: 44, regionCatalogId: REGISTER.regionId })
        );
        expect(unfound.knowsWhereItIs).toBe(false);
        expect(unfound.shortBy).toBe('nobody_has_found_it');

        // The same row once the world has opened it. `found` is the one field
        // that separates the two, and it is `discovered` on the location.
        const dug = howSomebodyStandsToAGround(
            { ...groundFromCatalogRow(REGISTER), found: true },
            nobody({ ordinal: 44, regionCatalogId: REGISTER.regionId })
        );
        expect(dug.inReach).toBe(true);
    });

    it('needs no branch per ground: every authored row prices through the rule', () => {
        // The distribution guard. If a twenty-fourth ground needed a new case
        // this would be the test that noticed, because one of the five reasons
        // would come back undefined.
        for (const place of PLACES_THAT_TEACH_A_DAO) {
            const stands = howSomebodyStandsToAGround(
                groundFromCatalogRow(place),
                nobody({ ordinal: 0, regionCatalogId: place.regionId })
            );
            expect(stands.shortBy, place.name).not.toBeNull();
        }
    });
});

describe('the refusal names what would work', () => {
    it('states the bar, the reading against it, and the gap', () => {
        const ground = {
            id: 'loc-x',
            name: FORD.name,
            domain: FORD.domain,
            subject: FORD.subject,
            ground: groundFromCatalogRow(FORD),
            standing: howSomebodyStandsToAGround(
                groundFromCatalogRow(FORD),
                nobody({ ordinal: 0, regionCatalogId: FORD.regionId })
            ),
            underfoot: true
        };
        const wants = whatThisGroundWants(
            ground,
            nobody({ ordinal: 0, regionCatalogId: FORD.regionId })
        )!;
        expect(wants).not.toBeNull();
        // The rung it becomes legible at, by name, in both halves - the bar and
        // the thing that would change it. A refusal with no cost attached is
        // the ban this repo forbids.
        expect(wants.because).toContain(rankName(FORD.fromOrdinal));
        expect(wants.because).toContain(rankName(0));
        expect(wants.wouldWork).toContain(rankName(FORD.fromOrdinal));
    });

    it('sends somebody in the wrong province to the right one by name', () => {
        const g = groundFromCatalogRow(FORD);
        const who = nobody({ ordinal: 44, regionCatalogId: 'region-white-stair' });
        const wants = whatThisGroundWants(
            {
                id: 'loc-x', name: FORD.name, domain: FORD.domain, subject: FORD.subject,
                ground: g, standing: howSomebodyStandsToAGround(g, who), underfoot: false
            },
            who
        )!;
        expect(wants.shortBy).toBe('somewhere_else');
        expect(wants.wouldWork).toMatch(/Quiet Marches/);
    });
});

describe('standing on one is standing in its province', () => {
    it('resolves the province off the dao catalog when the gazetteer cannot', () => {
        // The gazetteer holds settlements and sites; a dao ground is a world
        // location under a region node and is not in it. Before this, a
        // cultivator who had walked to one resolved to NO province and got
        // nothing - the one place guaranteed to teach them was the one place
        // that could not.
        // The proof the fallback is load-bearing rather than belt and braces:
        // the gazetteer has never heard of any of these.
        expect(regionIdOfPlace(FORD.name)).toBeUndefined();
        expect(daoGroundNamed('The Grinding Ford')?.id).toBe(FORD.id);
        // Loose on both sides, because the parser strips the article off what
        // the player typed and every name in the catalog carries one.
        expect(daoGroundNamed('Grinding Ford')?.id).toBe(FORD.id);
        expect(daoGroundNamed('Ninewatch')).toBeUndefined();
    });

    it('puts the ground into the exposure context of somebody standing on it', async () => {
        const { game, repos } = makeGame({ seed: 'dao-ground-standing' });
        const created = (await game.newRun('Wen Shu')) as never as { cultivator: { id: string } };

        // A cultivator who can read it, standing on it. The floor and the
        // province are the ground's own; nothing here is invented.
        repos.cultivators.update(created.cultivator.id, {
            location: FORD.name,
            realmOrdinal: FORD.fromOrdinal
        });
        const row = repos.cultivators.getById(created.cultivator.id)!;

        const context = discoveryContextFor(repos, row, { runId: row.runId }).context;
        expect((context.daoGrounds ?? []).map(g => g.label)).toContain(FORD.name);
        const offered = (context.daoGrounds ?? []).find(g => g.label === FORD.name)!;
        expect(offered.domain).toBe(FORD.domain);
        // What it costs in years, which is a fact about HOW they got at it.
        expect(offered.how).toBe('ground_open');
    });

    it('gives them nothing under the floor, and says so rather than staying silent', async () => {
        const { game, repos } = makeGame({ seed: 'dao-ground-under' });
        const created = (await game.newRun('Wen Shu')) as never as { cultivator: { id: string } };
        repos.cultivators.update(created.cultivator.id, {
            location: FORD.name,
            realmOrdinal: 0
        });
        const row = repos.cultivators.getById(created.cultivator.id)!;

        const context = discoveryContextFor(repos, row, { runId: row.runId }).context;
        expect((context.daoGrounds ?? []).map(g => g.label)).not.toContain(FORD.name);
    });
});

describe('and it reaches the sheet', () => {
    it('puts the road in the room a played insight is drawn from', async () => {
        const { game, repos } = makeGame({ seed: 'dao-ground-room' });
        const created = (await game.newRun('Wen Shu')) as never as { cultivator: { id: string } };
        repos.cultivators.update(created.cultivator.id, {
            location: FORD.name,
            realmOrdinal: FORD.fromOrdinal
        });
        const row = repos.cultivators.getById(created.cultivator.id)!;

        // Deterministic, and the honest form of the claim: whether an insight
        // FORMS is a yearly roll, and whether the ground is in the room at all
        // is not. Before this it never was.
        const room = discoverableInsights(row, {
            ...discoveryContextFor(repos, row, { runId: row.runId }).context,
            survived: null
        });
        const fromTheGround = room.find(c => c.domain === FORD.domain
            && c.access.label === FORD.name);
        expect(fromTheGround, 'the ford has to be in the room').toBeTruthy();
        expect(fromTheGround!.subject).toBe(FORD.subject);
    });

    it('and what forms from it names the ground in its own provenance', async () => {
        const { game, repos } = makeGame({ seed: 'dao-ground-life' });
        const created = (await game.newRun('Wen Shu')) as never as {
            cultivator: { id: string }; run: { id: string };
        };
        repos.cultivators.update(created.cultivator.id, {
            location: FORD.name,
            realmOrdinal: FORD.fromOrdinal
        });
        const row = repos.cultivators.getById(created.cultivator.id)!;
        const runRow = repos.runs.getById(created.run.id)!;

        // Built through the engine's own constructors, and NOT through the
        // yearly roll: whether a meditative state lands in any given decade is
        // a draw of about one in fifty a year and a single-seed assertion on it
        // would be pinning a coincidence. What is under test is the joint - a
        // ground in the room, an insight formed from it, and the row surviving
        // the trip to the sheet.
        //
        // Played for real once, off the same wiring: a cultivator seeded at the
        // ford's own floor and left to sit reached `body`/`wear` in 24 years,
        // with `stood on The Grinding Ford, which is ground that teaches it`
        // written into the account.
        const candidate = discoverableInsights(row, {
            ...discoveryContextFor(repos, row, { runId: row.runId }).context,
            survived: null
        }).find(c => c.access.label === FORD.name)!;
        const achievement = recordAchievement(
            {
                kind: 'meditative_state',
                onDay: 400,
                turn: 1,
                summary: 'Sat in the ford until the water stopped being an interruption.'
            },
            forStream(runRow.seed, 'test', 400)
        );
        const insight: Insight = formInsight(candidate, 1, achievement);

        const applied = applyTimeSkip(repos, {
            before: row,
            run: runRow,
            skip: skipThatOnlyTaught(insight, achievement)
        });
        expect(applied.understanding.insights).toBe(1);

        const after = repos.cultivators.getById(created.cultivator.id)!;
        const stored = (after.insights ?? []).find(i => i.id === insight.id)!;
        expect(stored, 'the insight has to be on the sheet').toBeTruthy();
        expect(stored.domain).toBe(FORD.domain);
        // Legible: the engine can always say WHICH event produced an insight,
        // and this one says which ground was under them when it did.
        expect(stored.provenance.account).toContain(FORD.name);
    });
});

describe('somebody who goes there can point at it', () => {
    it('offers the grounds a person in this province could name, and no others', async () => {
        const { game } = makeGame({ seed: 'dao-ground-source' });
        await game.newRun('Wen Shu');

        // A tiny world rather than a seeded one: what is under test is which
        // grounds a location's own people can point at, and a seeded world
        // would be measuring the seeder.
        const state = tinyWorld();
        const grounds = seedPlacesThatTeachADao(state);
        state.locations.push(...grounds);

        const offers = whoCouldPointAtAGround(state, 'loc-town-marches');
        const named = new Set(offers.map(o => o.ground.name));
        // Open and carving ground in the province, whatever rung the speaker
        // stands at. This is the whole reason the source works at all: 0 of the
        // living NPCs in a seeded world stand in a settlement at the rung the
        // Slow Bell or the Cut Face asks for.
        expect(named).toContain('The Grinding Ford');
        expect(named).toContain('The Counted Wall');
        // Not another province's, and not one nobody has dug out.
        expect(named).not.toContain('The Glass Field');
        expect(named).not.toContain('The Unwritten Register');
        // Nor a house's ground, to somebody who is not of the house.
        expect(named).not.toContain('The Sword-Marked Cliff');
    });

    it('and the world reads reach off the same rule the player is held to', () => {
        const state = tinyWorld();
        state.locations.push(...seedPlacesThatTeachADao(state));

        const npc = state.npcs[0];
        // At the ford's own floor, standing in its province.
        npc.cultivation.realmOrdinal = FORD.fromOrdinal;
        const reach = daoGroundsInReachOf(state, npc);
        expect(reach.map(r => r.sourceName)).toContain(FORD.name);

        // And the player half agrees, given the same standing.
        const here = state.locations.find(l => l.id === 'loc-town-marches')!;
        const player = howAPlayerStands(state, here, {
            realmOrdinal: FORD.fromOrdinal, sectId: null, sectRank: null
        });
        const seen = groundThatTeachesARoad(state, player)
            .filter(row => row.standing.inReach)
            .map(row => row.name);
        expect(seen).toEqual(reach.map(r => r.sourceName));
    });
});

describe('hearing where a ground is grants the ground and nothing else', () => {
    it('does not name the speaker in ambient talk, which would be a free discovery', () => {
        const state = tinyWorld();
        state.locations.push(...seedPlacesThatTeachADao(state));
        const offer = whoCouldPointAtAGround(state, 'loc-town-marches')[0];

        // The first build of this channel wrote the speaker's name into the
        // prose, so walking past a square of strangers named one of them for
        // free. `tests/web/presence.test.ts` caught it. What is granted is the
        // PLACE, from a real source; the voice stays a voice.
        const said = whatSomebodyWouldSayAbout(offer.ground, 'Somebody here');
        expect(said).not.toContain(offer.speaker.name);
        expect(said).toContain(offer.ground.name);
        // And what the player ends up holding says where it is and no more.
        expect(whatTheyNowHold(offer.ground)).toContain(offer.ground.name);
        expect(whatTheyNowHold(offer.ground)).toMatch(/nothing about what it is for/i);
    });
});

describe('a locus you can carry is the same mechanic, not a second one', () => {
    // Ruled by the design owner: remains impart a dao at a high enough rung.
    // That is exposure with a different container, and the container already
    // existed - an ordinary object with a `power` and a `daoDomain`. These
    // guard that it stays one system: the same `shortBy` vocabulary, the same
    // legibility window, and no second reach rule anywhere.
    const remains = {
        possessorId: 'house-x',
        power: 40
    };

    it('imparts nothing unless it is high enough, which is its own power', () => {
        const ordinary = howSomebodyStandsToAnObject(
            { possessorId: 'me', power: 4 },
            { ordinal: 20, regionCatalogId: null, factionId: null, factionRankIndex: -1, id: 'me' }
        );
        // A low object in your own hands is in reach and teaches whatever it
        // says it teaches, which for an ordinary death is nothing: the row
        // carries no `daoDomain` and never reaches this rule at all.
        expect(ordinary.inReach).toBe(true);
    });

    it('receives nothing unless the reader is close enough, on the same window', () => {
        const far = howSomebodyStandsToAnObject(remains, {
            ordinal: remains.power - ARTIFACT_LEGIBLE_WITHIN - 1,
            regionCatalogId: null, factionId: 'house-x', factionRankIndex: 5, id: 'me'
        });
        expect(far.shortBy).toBe('below_the_floor');
        const near = howSomebodyStandsToAnObject(remains, {
            ordinal: remains.power - ARTIFACT_LEGIBLE_WITHIN,
            regionCatalogId: null, factionId: 'house-x', factionRankIndex: 5, id: 'me'
        });
        expect(near.inReach).toBe(true);
    });

    it('rations a house\'s own by standing, which is why they sit in a hall', () => {
        const junior = howSomebodyStandsToAnObject(remains, {
            ordinal: 40, regionCatalogId: null, factionId: 'house-x',
            factionRankIndex: STANDING_TO_STUDY_A_HOUSE_OBJECT - 1, id: 'me'
        });
        expect(junior.knowsWhereItIs).toBe(true);
        expect(junior.shortBy).toBe('standing');

        const stranger = howSomebodyStandsToAnObject(remains, {
            ordinal: 40, regionCatalogId: null, factionId: null, factionRankIndex: -1, id: 'me'
        });
        expect(stranger.knowsWhereItIs).toBe(false);
    });

    it('and the refusal names the bar, the same way ground does', () => {
        const state = tinyWorld();
        state.objects.push({
            id: 'obj-ancestor',
            name: 'What is left of the fourth patriarch',
            kind: 'artifact',
            power: 40,
            possessorId: 'house-x',
            ownerId: 'house-x',
            ownerName: 'A house',
            locationId: null,
            tags: [],
            data: { daoDomain: 'life_death' }
        } as never);

        const who = {
            ordinal: 10, regionCatalogId: 'region-quiet-marches',
            factionId: 'house-x', factionRankIndex: 5, id: 'npc-local'
        };
        const [thing] = thingsCarriedThatTeachARoad(state, who);
        expect(thing.name).toContain('fourth patriarch');
        const wants = whatThisThingWants(thing, who)!;
        expect(wants.shortBy).toBe('below_the_floor');
        expect(wants.because).toContain(rankName(40));
        expect(wants.wouldWork).toContain(rankName(40 - ARTIFACT_LEGIBLE_WITHIN));

        // And the world's own reader agrees, off the same rule.
        const npc = state.npcs[0];
        npc.factionId = 'house-x';
        npc.factionRankIndex = 5;
        npc.cultivation.realmOrdinal = 40 - ARTIFACT_LEGIBLE_WITHIN;
        expect(roadsCarriedByObjectsInReachOf(state, npc).map(r => r.sourceId))
            .toEqual(['obj-ancestor']);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A WORLD SMALL ENOUGH TO REASON ABOUT
//
// Two provinces and one settlement in each, so that what a test asserts is the
// rule rather than the seeder's draw. `seedPlacesThatTeachADao` needs region
// nodes carrying `catalogRegionId` and nothing else.
// ─────────────────────────────────────────────────────────────────────────

function tinyWorld(): WorldState {
    const state = createWorld({ seed: 'dao-ground-tiny', skipPriorAges: true });
    for (const region of ['region-quiet-marches', 'region-wide-field', 'region-low-fall']) {
        state.locations.push(makeLocation({
            id: `loc-${region}`,
            name: region,
            kind: 'region',
            data: { catalogRegionId: region }
        }));
    }
    state.locations.push(makeLocation({
        id: 'loc-town-marches',
        name: 'A town in the Marches',
        kind: 'settlement',
        parentId: 'loc-region-quiet-marches'
    }));
    state.npcs.push(createNpc(state.seed, {
        id: 'npc-local',
        name: 'A carter',
        bornOnDay: 0,
        onDay: state.currentDay,
        locationId: 'loc-town-marches'
    }));
    return state;
}
