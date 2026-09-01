/**
 * The other side of the Lid.
 *
 * `layers.ts` says what a layer IS and what may cross between them. This is the
 * place itself: how it comes into existence, what happens when somebody arrives,
 * what standing means up there, what still kills, and how the two layers keep
 * running at the same time.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * BOTH FACTS ARE TRUE AT ONCE, AND THAT IS THE WHOLE POINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Measured against the world they left, a newly ascended immortal is beyond
 * comprehension: a True Immortal with a wide art takes any fully mobilised apex
 * in about two rounds, and mean damage from anybody below the Lid is zero.
 * Measured against the world they arrived in, they are a newcomer with no
 * lineage, no standing, no allies, and cultivation that is unremarkable.
 *
 * Making both true SIMULTANEOUSLY - rather than alternately, or by fiat - is
 * this module's actual job, and the trick is that neither reading is invented:
 *
 *   - The first is already measured. `powerMultiplierForOrdinal(46)` against the
 *     strongest thing alive below is a division, and `readTwoWays` does it
 *     rather than asserting it.
 *
 *   - The second falls out of the ladder ending. **Everybody above the Lid
 *     stands at ordinal 46**, because 46 is the only ordinal that can be there.
 *     So cultivation is not a differentiator up there at all - it is the entry
 *     ticket, and a newcomer's is identical to a founder's. Standing is made of
 *     things this layer already models for the world below: tenure, lineage,
 *     a house, allies, and what you are holding. A newcomer scores zero on
 *     every one of them, and no second power ladder had to be invented to say
 *     so.
 *
 * That is what produces the payoff the design is after: the player meets the
 * invincible ancestor who reorganised a continent, and later finds out he is
 * not considered exceptional at home.
 *
 * ── DELIBERATELY THIN ────────────────────────────────────────────────────
 *
 * There is no second progression system here, no second economy and no second
 * survival layer. The weight of this game lives below the Lid. What is up here
 * is: a place, some people who were already there, some things with no
 * equivalent below, two ways to die, and a channel through which almost
 * nothing fits.
 *
 * ── GENERATED ON CONTACT ─────────────────────────────────────────────────
 *
 * A world nobody has ascended from does not carry forty immortals. The layer is
 * materialised by `ensureImmortalLayer` the first time anything needs it, and
 * everything in it derives from the WORLD seed rather than from when the call
 * happened - so the same seed always produces the same sky, whether it was
 * first looked at in year 1,000 or year 1,500.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { DESCENT_TRIBULATION_STRIKES } from '../cultivation/existence.js';
import {
    MAX_ORDINAL,
    OBJECT_CEILING_BELOW_THE_LID,
    TRUE_IMMORTAL_ORDINAL,
    powerMultiplierForOrdinal,
    rankName
} from '../cultivation/realms.js';
import {
    makeFact,
    personName,
    placeName,
    recordUnresolved,
    yearOfDay,
    type HistoricalFact
} from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import {
    IMMORTAL_LAYER,
    MORTAL_LAYER,
    evaluateLayerCrossing,
    isAboveTheLid,
    isBelowTheLid,
    layerOf,
    makeAscensionRecord,
    type AscensionRecord,
    type CrossingVerdict
} from './layers.js';
import {
    makeAffinity,
    makeEnvironment,
    makeLocation,
    makeThresholds,
    QI_DENSITY_MAX,
    type LocationRecord
} from './locations.js';
import { addLineageEdge, ancestorsOf, createLineageRecord } from './lineage.js';
import { storeMemory } from './memory.js';
import {
    addGoal,
    createNpc,
    markDead,
    setRealm,
    upsertRelationship,
    type NpcRecord
} from './npc-state.js';
import { makeObject, transferPossession, type ObjectRecord } from './possessions.js';
import {
    currentEraQiDensity,
    getFaction,
    getLocation,
    getNpc,
    makeFaction,
    upsertFaction,
    upsertLocation,
    upsertNpc,
    upsertObject,
    type FactionRecord,
    type WorldState
} from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE OF THE PLACE
// ─────────────────────────────────────────────────────────────────────────

/** Houses standing above the Lid. Small: this layer is deliberately thin. */
export const IMMORTAL_HOUSE_COUNT = 5;
/** People who were already there when the newcomer arrived. */
export const IMMORTAL_NATIVE_COUNT = 48;
/** Places up there that are calibrated to kill immortals. */
export const IMMORTAL_PERIL_GROUND_COUNT = 3;

/**
 * How far the immortal houses predate anything the lower world can produce a
 * record of.
 *
 * Not decoration. `foundedOnDay` sits this far behind the earliest day in the
 * chronicle, so "older than the lower world's records" is a comparison the
 * engine can perform rather than a sentence somebody wrote.
 */
export const OLDER_THAN_THE_RECORD_YEARS = 12_000;

/**
 * Qi at densities the lower world cannot produce.
 *
 * MEASURED, AND THE MEASUREMENT CORRECTED THE OBVIOUS ASSERTION. The first
 * version of this said the two ranges do not overlap, and that is false: the
 * density scale is 0..1 BY DEFINITION - 1.0 is "the richest ground the world
 * has ever carried" - so a sealed ruin and a worked vein below both reach 1.0
 * on it, and nothing above can be off the end of a scale with an end.
 *
 * What is actually different is where the figure sits and how much of the map
 * carries it. Below, the AGE runs at about 0.34 and only ever falls; the places
 * at 1.0 are pockets, they are a small minority of the map, and every one of
 * them is either sealed or being fought over. Above, it is the floor, over the
 * whole layer, unguarded. `immortalWorldShape` reports both halves of that
 * comparison rather than the one that reads better.
 */
export const IMMORTAL_QI_DENSITY = QI_DENSITY_MAX;

/** Local laws of the place, and a newcomer does not get a vote on them. */
export const IMMORTAL_SPECIAL_RULES: readonly string[] = [
    'the qi does not have to be gathered, and a body that cannot shed it fails',
    'distance answers to precedence rather than to walking',
    'nothing here is renegotiated by arriving with an opinion about it'
];

// ─────────────────────────────────────────────────────────────────────────
// STANDING
// ─────────────────────────────────────────────────────────────────────────

/**
 * How long it takes for arriving to stop being the most interesting thing
 * about somebody.
 *
 * Three thousand years, because that is the figure the setting quotes for how
 * long is a long time to keep not losing. Tenure saturates there; it does not
 * keep paying forever, or the oldest resident would be unreachable by anybody
 * and the layer would have a permanent apex, which is precisely the shape this
 * design refuses.
 */
export const TENURE_SATURATION_YEARS = 3_000;

/**
 * What standing is made of.
 *
 * Every weight is on an axis the world layer already stores for the world
 * below. None of them is cultivation, and that is deliberate: up there
 * cultivation is the entry ticket and everybody holds the same one.
 */
export const STANDING_WEIGHTS = {
    tenure: 0.30,
    lineage: 0.25,
    house: 0.25,
    allies: 0.12,
    holdings: 0.08
} as const;

export interface StandingComponent {
    source: keyof typeof STANDING_WEIGHTS;
    /** Contribution to the total, already weighted. */
    value: number;
    note: string;
}

export interface ImmortalStanding {
    residentId: string;
    residentName: string;
    onDay: number;
    /** False when this person is not above the Lid at all. */
    resident: boolean;
    tenureYears: number;
    /** Generations of their line resident above. Zero for anybody who arrived. */
    lineageDepthAbove: number;
    houseId: string | null;
    houseName: string | null;
    houseRankIndex: number;
    /** People above the Lid who would do something for them. */
    alliesAbove: number;
    /** Things they hold that were made above the Lid. */
    holdingsAbove: number;
    /** 0..1, itemised. Not a power rating - see `cultivationIsUnremarkable`. */
    standing: number;
    components: StandingComponent[];
    /** 1 is the highest-standing resident. */
    rankAmongResidents: number;
    residentCount: number;
    /**
     * Always true, for everybody, and it is the load-bearing fact of the layer.
     * Ordinal 46 is the only ordinal that can be here, so a newcomer's
     * cultivation is identical to a founder's and buys them nothing.
     */
    cultivationIsUnremarkable: boolean;
    verdict: string;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT STILL KILLS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How often the layer asks whether somebody is still there.
 *
 * Fifty years. A rate, not a tick: perils are drawn at absolute multiples of
 * this interval, so ten years then thirty produces the same world as forty and
 * the cost of a five-century advance is one draw per resident per fifty years.
 */
export const PERIL_INTERVAL_YEARS = 50;
export const PERIL_INTERVAL_DAYS = PERIL_INTERVAL_YEARS * DAYS_PER_YEAR;

/**
 * The two things ascension did not remove.
 *
 * Heavenly tribulation is behind them and lifespan has stopped being a number.
 * Everything else on the list still applies, and these are the two the setting
 * names: environmental dangers calibrated for immortals, and politics that has
 * been running uninterrupted for a very long time and kills the people who lose
 * at it.
 *
 * Base rates are per resident per fifty years, before standing. A newcomer at
 * zero standing survives five centuries about three times in five and three
 * thousand years about once in thirty; a founder with everything survives five
 * centuries almost always and three thousand years rather less than half the
 * time. Nobody is safe, which is the requirement.
 */
export const ENVIRONMENT_PERIL_PER_INTERVAL = 0.030;
export const POLITICS_PERIL_PER_INTERVAL = 0.025;

/**
 * The most standing can buy.
 *
 * Deliberately short of 1. A house, four generations and three thousand years
 * of not losing makes somebody hard to kill and never makes them safe - and
 * the alternative would be a permanent apex nothing can remove, which is the
 * one thing the layer must not produce.
 */
export const MAX_PERIL_RELIEF = 0.72;

export type PerilKind = 'environment' | 'politics';

export function perilChance(kind: PerilKind, standing: number): number {
    const base = kind === 'environment'
        ? ENVIRONMENT_PERIL_PER_INTERVAL
        : POLITICS_PERIL_PER_INTERVAL;
    const relief = MAX_PERIL_RELIEF * clamp01(standing);
    return base * (1 - relief);
}

// ─────────────────────────────────────────────────────────────────────────
// IDS
// Fixed rather than sequenced, so the layer is byte-identical for a seed
// whatever the world had already numbered when it was first materialised.
// ─────────────────────────────────────────────────────────────────────────

export const IMMORTAL_SEAM_LOCATION_ID = 'loc-above-seam';
export const IMMORTAL_LANDING_LOCATION_ID = 'loc-above-landing';
/** One abode per resident, keyed by them, so settling twice is settling once. */
export const abodeLocationId = (residentId: string): string => `loc-above-abode-${residentId}`;
const houseId = (i: number) => `fac-above-${i}`;
const houseSeatId = (i: number) => `loc-above-house-${i}`;
const perilGroundId = (i: number) => `loc-above-peril-${i}`;
const nativeId = (i: number) => `npc-above-${i}`;
const houseLineageId = (i: number) => `lin-above-${i}`;

const HOUSE_FORMS = ['Ascendancy', 'Terrace', 'Concord', 'Precedence', 'Standing'] as const;

// ─────────────────────────────────────────────────────────────────────────
// MATERIALISING THE LAYER
// ─────────────────────────────────────────────────────────────────────────

export interface ImmortalLayerSummary {
    /** True when this call is what created it. */
    created: boolean;
    landingLocationId: string;
    houseIds: string[];
    perilGroundIds: string[];
    nativeIds: string[];
    /** Things made above the Lid, which is the only place they can be. */
    objectIds: string[];
    /** Day the oldest house was founded. Well behind the chronicle's first row. */
    oldestFoundedOnDay: number;
}

/**
 * Bring the far side into existence, once.
 *
 * Everything derives from the world seed, so the sky a world has is a property
 * of the world rather than of when somebody first looked at it. Idempotent:
 * the presence of any location on the immortal layer is the flag, so there is
 * no separate "seeded" boolean to fall out of agreement with the rows.
 */
export function ensureImmortalLayer(state: WorldState): ImmortalLayerSummary {
    const existing = state.locations.filter(l => isAboveTheLid(l));
    if (existing.length > 0) return summarise(state, false);

    const rng = forStream(state.seed, 'immortal-world');

    // "Older than the lower world's records" is a comparison, not a claim: the
    // houses are founded this far behind the earliest day the chronicle holds.
    const earliestRecorded = Math.min(
        state.history.eras[0]?.startDay ?? state.currentDay,
        state.history.facts[0]?.day ?? state.currentDay,
        state.currentDay
    );
    const foundedDay = earliestRecorded - OLDER_THAN_THE_RECORD_YEARS * DAYS_PER_YEAR;

    // ── The seam, and the ground on the other side of it ─────────────────
    const seam = makeLocation({
        id: IMMORTAL_SEAM_LOCATION_ID,
        name: 'the seam',
        kind: 'portal',
        layer: IMMORTAL_LAYER,
        description:
            'The near side of the Lid, from above. It is not a door and nobody built it; ' +
            'it is where the pressure stops being survivable in one direction and starts ' +
            'being survivable in the other.',
        ambient: 'spirit_tide',
        qiDensity: IMMORTAL_QI_DENSITY,
        thresholds: makeThresholds(TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, MAX_ORDINAL),
        hazards: ['pressure', 'lightning'],
        environment: makeEnvironment({
            spiritualDensity: IMMORTAL_QI_DENSITY,
            danger: 0.5,
            resources: [],
            climate: 'unweathered',
            politicalControl: 'nobody, and everybody watches it',
            specialRules: IMMORTAL_SPECIAL_RULES.slice(),
            historicalScars: ['everyone here came through it']
        }),
        discovered: true,
        tags: ['immortal', 'seam']
    });
    seam.origin.fromDay = foundedDay;

    const landing = makeLocation({
        id: IMMORTAL_LANDING_LOCATION_ID,
        name: `the ${placeName(rng).toLowerCase()}`,
        kind: 'wilds',
        layer: IMMORTAL_LAYER,
        parentId: seam.id,
        description:
            'Open ground within sight of the seam. Nobody owns it, which is the whole of ' +
            'what it has to recommend it, and everybody arrives here.',
        ambient: 'spirit_tide',
        qiDensity: IMMORTAL_QI_DENSITY,
        thresholds: makeThresholds(TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, MAX_ORDINAL),
        hazards: ['pressure'],
        environment: makeEnvironment({
            spiritualDensity: IMMORTAL_QI_DENSITY,
            danger: 0.35,
            resources: ['qi'],
            climate: 'unweathered',
            politicalControl: 'nobody has bothered',
            specialRules: IMMORTAL_SPECIAL_RULES.slice()
        }),
        discovered: true,
        tags: ['immortal', 'landing']
    });
    landing.origin.fromDay = foundedDay;

    let next = upsertLocation(upsertLocation(state, seam), landing);
    Object.assign(state, next);

    // ── The houses, and the ground each of them sits on ──────────────────
    const houses: FactionRecord[] = [];
    for (let i = 0; i < IMMORTAL_HOUSE_COUNT; i++) {
        const hr = forStream(state.seed, 'immortal-house', i);
        const name = `the ${placeName(hr)} ${hr.pick(HOUSE_FORMS)}`;
        const seat = makeLocation({
            id: houseSeatId(i),
            name: `the seat of ${name}`,
            kind: 'sect_seat',
            layer: IMMORTAL_LAYER,
            description:
                'Held continuously since before anything the lower world can produce a ' +
                'record of. Nothing here was built in a hurry and nothing here is new.',
            ambient: 'spirit_tide',
            qiDensity: IMMORTAL_QI_DENSITY,
            thresholds: makeThresholds(
                TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, MAX_ORDINAL
            ),
            hazards: ['formation'],
            affinities: [makeAffinity('formation', 1.2, 0, 'The arrays answer to the house.')],
            environment: makeEnvironment({
                spiritualDensity: IMMORTAL_QI_DENSITY,
                danger: 0.2,
                resources: ['qi', 'materials'],
                climate: 'unweathered',
                politicalControl: name,
                specialRules: IMMORTAL_SPECIAL_RULES.slice()
            }),
            controllingFactionId: houseId(i),
            discovered: true,
            tags: ['immortal', 'house_seat']
        });
        seat.origin.fromDay = foundedDay - i * 400 * DAYS_PER_YEAR;

        const house = makeFaction({
            id: houseId(i),
            name,
            kind: hr.weighted({ clan: 40, court: 35, order: 25 }),
            layer: IMMORTAL_LAYER,
            alignment: 'neutral',
            seatLocationId: seat.id,
            controlledLocationIds: [seat.id],
            ranks: ['Held', 'Seated', 'Standing', 'Precedent'],
            description:
                'An immortal house. It has been running its own politics, uninterrupted, for ' +
                'longer than the lower world has had writing.',
            foundedOnDay: seat.origin.fromDay,
            resources: {
                tenure_years: OLDER_THAN_THE_RECORD_YEARS + i * 400,
                seats: hr.int(3, 7)
            },
            tags: ['immortal', 'house']
        });
        houses.push(house);
        Object.assign(state, upsertLocation(upsertFaction(state, house), seat));
    }

    // Politics that has been running uninterrupted for a very long time. It is
    // stored the way every other rivalry is stored: as standing, both ways.
    for (let i = 0; i < houses.length; i++) {
        const hr = forStream(state.seed, 'immortal-politics', i);
        for (let j = i + 1; j < houses.length; j++) {
            const standing = hr.float(-0.9, 0.6);
            houses[i].standing[houses[j].id] = Number(standing.toFixed(3));
            houses[j].standing[houses[i].id] = Number((standing * hr.float(0.6, 1)).toFixed(3));
        }
        Object.assign(state, upsertFaction(state, houses[i]));
    }

    // ── Ground calibrated for immortals ──────────────────────────────────
    const perilGrounds: LocationRecord[] = [];
    for (let i = 0; i < IMMORTAL_PERIL_GROUND_COUNT; i++) {
        const pr = forStream(state.seed, 'immortal-peril-ground', i);
        const ground = makeLocation({
            id: perilGroundId(i),
            name: `the ${placeName(pr).toLowerCase()}`,
            kind: 'forbidden_zone',
            layer: IMMORTAL_LAYER,
            description:
                'A phrase worth taking seriously: it is calibrated for immortals. What is ' +
                'wrong with it cannot be walked out of by being strong, because everybody ' +
                'here is exactly as strong as everybody else.',
            ambient: 'spirit_tide',
            qiDensity: IMMORTAL_QI_DENSITY,
            // Thresholds cannot express this and are not asked to: the ladder
            // ends at 46 and everybody standing here is 46. What decides
            // whether somebody comes back out is what they know and who they
            // have, which is `perilChance`, not a comparison of ordinals.
            thresholds: makeThresholds(
                TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, MAX_ORDINAL, MAX_ORDINAL
            ),
            hazards: ['pressure', 'sealed_qi', 'illusion'],
            environment: makeEnvironment({
                spiritualDensity: IMMORTAL_QI_DENSITY,
                danger: pr.float(0.75, 0.95),
                resources: ['materials'],
                climate: 'unweathered',
                politicalControl: 'nobody has ever held it',
                specialRules: IMMORTAL_SPECIAL_RULES.slice(),
                historicalScars: ['people who were unkillable below the Lid have ended here']
            }),
            discovered: true,
            tags: ['immortal', 'peril_ground']
        });
        ground.origin.fromDay = foundedDay;
        perilGrounds.push(ground);
        Object.assign(state, upsertLocation(state, ground));
    }

    // ── Natives ──────────────────────────────────────────────────────────
    // Born there, at the only ordinal that can be there, in houses that were
    // already old. Created by the same factory everybody else is, with talent
    // rolled from the world seed exactly the same way.
    const nativeIds: string[] = [];
    for (let i = 0; i < IMMORTAL_NATIVE_COUNT; i++) {
        const nr = forStream(state.seed, 'immortal-native', i);
        const house = houses[i % houses.length];
        const generation = Math.floor(i / houses.length);
        const bornOnDay = foundedDay + nr.int(0, OLDER_THAN_THE_RECORD_YEARS - 200) * DAYS_PER_YEAR;
        // " of " never occurs in a lower-world name, so this cannot collide
        // with the roster below without the layer having to read it.
        const name = `${personName(nr)} of ${house.name}`;

        let npc = createNpc(state.seed, {
            id: nativeId(i),
            name,
            bornOnDay,
            onDay: state.currentDay,
            layer: IMMORTAL_LAYER,
            locationId: generation === 0 ? house.seatLocationId : house.seatLocationId,
            factionId: house.id,
            factionRankIndex: Math.max(0, house.ranks.length - 1 - generation),
            occupation: 'immortal',
            description:
                'Born above the Lid. Has never been below it and has no particular reason to be ' +
                'curious about it.',
            cultivation: { realmOrdinal: TRUE_IMMORTAL_ORDINAL },
            tags: ['immortal', 'native']
        });
        npc = setRealm(npc, TRUE_IMMORTAL_ORDINAL, bornOnDay);
        npc = addGoal(npc, {
            kind: nr.weighted({ status: 40, discovery: 30, protection: 20, revenge: 10 }),
            text: nr.pick([
                'Hold what the house holds.',
                'Find out what the far ground is for.',
                'Settle a precedence that has been open since before the lower world had writing.',
                'Keep a seat that three other houses would like.'
            ]),
            priority: nr.float(0.4, 0.9),
            progress: 'Ongoing, and has been for a very long time.',
            obstacles: ['Four other houses.']
        }, bornOnDay);
        nativeIds.push(npc.id);
        Object.assign(state, upsertNpc(state, npc));
    }

    // Who would do something for whom. Ordinary relationship rows, and the
    // reason a native's standing is not zero: a newcomer has nobody in this
    // list and no way to get into anybody else's quickly.
    for (let i = 0; i < houses.length; i++) {
        const members = nativeIds.filter((_, k) => k % houses.length === i);
        const ar = forStream(state.seed, 'immortal-allies', i);
        for (const memberId of members) {
            let member = getNpc(state, memberId)!;
            for (const otherId of members) {
                if (otherId === memberId) continue;
                const other = getNpc(state, otherId)!;
                member = upsertRelationship(member, {
                    targetId: other.id,
                    targetName: other.name,
                    kind: 'ally',
                    standing: Number(ar.float(0.25, 0.8).toFixed(3)),
                    note: 'Same house, for a very long time.'
                }, member.identity.bornOnDay);
            }
            Object.assign(state, upsertNpc(state, member));
        }
    }

    // Clan lines above, so lineage depth is something the engine can walk
    // rather than a number stored on a row.
    for (let i = 0; i < houses.length; i++) {
        const members = nativeIds.filter((_, k) => k % houses.length === i);
        if (members.length < 2) continue;
        const founder = getNpc(state, members[0])!;
        let lineage = createLineageRecord({
            id: houseLineageId(i),
            surname: houses[i].name,
            founderId: founder.id,
            foundedOnDay: founder.identity.bornOnDay,
            tags: ['immortal']
        });
        for (let k = 1; k < members.length; k++) {
            lineage = addLineageEdge(lineage, {
                parentId: members[k - 1],
                childId: members[k],
                relation: 'descendant',
                onDay: getNpc(state, members[k])!.identity.bornOnDay
            });
        }
        state.lineages.push(lineage);
    }

    // ── Things with no equivalent below ──────────────────────────────────
    // Ordinary rows in the ordinary object table, made by the ordinary factory,
    // ordered by the ordinary `power` field. What makes them have no equivalent
    // below is not a separate catalog: it is that nothing rated above
    // OBJECT_CEILING_BELOW_THE_LID can be held down there, which is a rule in
    // `layers.ts` that applies to every object in the world.
    const objectIds: string[] = [];
    for (let i = 0; i < houses.length; i++) {
        const or = forStream(state.seed, 'immortal-object', i);
        const head = nativeIds[i];
        const holder = getNpc(state, head);
        const seatId = houses[i].seatLocationId;

        const relic = makeObject({
            id: `obj-above-${i}-relic`,
            name: `the ${placeName(or).toLowerCase()} of ${houses[i].name}`,
            kind: 'artifact',
            significance: 'legendary',
            power: TRUE_IMMORTAL_ORDINAL,
            possessorId: head,
            ownerId: houses[i].id,
            ownerName: houses[i].name,
            locationId: seatId,
            description: 'Made above the Lid, and therefore unable to be anywhere else.',
            tags: ['immortal_make']
        });
        relic.provenance.push({
            onDay: houses[i].foundedOnDay ?? foundedDay,
            holderId: head,
            holderName: holder?.name ?? head,
            how: 'crafted',
            source: houses[i].name,
            previousHolderId: null,
            previousHolderName: null,
            factId: null,
            note: 'Nobody below the Lid has ever seen one.'
        });
        objectIds.push(relic.id);
        Object.assign(state, upsertObject(state, relic));

        // A manual is paper. It is the one thing up here that can be sent down
        // and studied, and it leaves the reader exactly as strong as they were.
        const manual = makeObject({
            id: `obj-above-${i}-manual`,
            name: `a course of cutting kept by ${houses[i].name}`,
            kind: 'manual',
            significance: 'legendary',
            power: TRUE_IMMORTAL_ORDINAL,
            possessorId: head,
            ownerId: houses[i].id,
            ownerName: houses[i].name,
            locationId: seatId,
            description:
                'An art with no equivalent below. Paper crosses the Lid; what it buys the ' +
                'reader down there is depth and not a single point of force.',
            tags: ['immortal_make', 'sendable']
        });
        objectIds.push(manual.id);
        Object.assign(state, upsertObject(state, manual));
    }

    // The engine is allowed to know this. Nobody below is.
    appendWorldFact(state, makeFact({
        day: foundedDay,
        kind: 'faction_founded',
        scale: 'world',
        summary:
            `${IMMORTAL_HOUSE_COUNT} houses were already standing above the Lid, and had been ` +
            'for longer than anything the lower world can produce a record of.',
        visibility: 'secret',
        fidelity: 'lost',
        magnitude: 0.9,
        factionIds: houses.map(h => h.id),
        locationId: landing.id,
        data: { layer: IMMORTAL_LAYER }
    }));

    void perilGrounds;
    return summarise(state, true);
}

function summarise(state: WorldState, created: boolean): ImmortalLayerSummary {
    const above = state.locations.filter(l => isAboveTheLid(l));
    return {
        created,
        landingLocationId: IMMORTAL_LANDING_LOCATION_ID,
        houseIds: state.factions.filter(f => isAboveTheLid(f)).map(f => f.id).sort(),
        perilGroundIds: above.filter(l => l.tags.includes('peril_ground')).map(l => l.id).sort(),
        nativeIds: state.npcs.filter(n => isAboveTheLid(n) && n.tags.includes('native'))
            .map(n => n.id).sort(),
        objectIds: state.objects.filter(o => o.tags.includes('immortal_make')).map(o => o.id).sort(),
        oldestFoundedOnDay: Math.min(
            ...state.factions.filter(f => isAboveTheLid(f)).map(f => f.foundedOnDay ?? 0)
        )
    };
}

// ─────────────────────────────────────────────────────────────────────────
// READING THE LAYER
// ─────────────────────────────────────────────────────────────────────────

/** Everybody currently above the Lid and still a going concern. */
export function residentsAbove(state: WorldState): NpcRecord[] {
    return state.npcs
        .filter(n => isAboveTheLid(n) && n.status !== 'physically_dead')
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function ascensionsOf(state: WorldState): AscensionRecord[] {
    if (!state.ascensions) state.ascensions = [];
    return state.ascensions;
}

export function ascensionOf(state: WorldState, residentId: string): AscensionRecord | null {
    return ascensionsOf(state).find(a => a.residentId === residentId) ?? null;
}

/**
 * What the engine knows became of somebody who crossed.
 *
 * Admin and engine only. Rendering this to anybody below the Lid would delete
 * the setting's most useful uncertainty: a house whose channel has gone quiet
 * knows nothing at all, because silence is equally consistent with death, with
 * disinterest, with a war up there, and with an object down here that stopped
 * working.
 */
export function afterCrossingOf(state: WorldState, residentId: string): AscensionRecord['afterCrossing'] | null {
    return ascensionOf(state, residentId)?.afterCrossing ?? null;
}

/**
 * Standing above the Lid, itemised.
 *
 * Nothing in here reads cultivation, because cultivation up there is a
 * constant. A newcomer scores zero on every axis: no tenure, no line, no house,
 * no allies, nothing in hand that was made on this side. That is what "a
 * newcomer with no lineage, no standing, no allies and unremarkable
 * cultivation" is, in data.
 */
export function immortalStanding(
    state: WorldState,
    residentId: string,
    onDay = state.currentDay
): ImmortalStanding {
    const npc = getNpc(state, residentId);
    const residents = residentsAbove(state);
    const resident = npc != null && isAboveTheLid(npc);

    const components: StandingComponent[] = [];
    const record = ascensionOf(state, residentId);
    const arrivedOnDay = record?.ascendedOnDay ?? npc?.identity.bornOnDay ?? onDay;
    const tenureYears = resident ? Math.max(0, (onDay - arrivedOnDay) / DAYS_PER_YEAR) : 0;

    const tenureShare = Math.min(1, tenureYears / TENURE_SATURATION_YEARS);
    components.push({
        source: 'tenure',
        value: tenureShare * STANDING_WEIGHTS.tenure,
        note: tenureYears < 1
            ? 'Arrived. That is the whole of it so far.'
            : `${Math.round(tenureYears)} years of not having lost yet.`
    });

    const ancestry = ancestryAbove(state, residentId);
    const lineageDepthAbove = ancestry.depth;
    const lineageShare = Math.min(1, lineageDepthAbove / 4);
    components.push({
        source: 'lineage',
        value: lineageShare * STANDING_WEIGHTS.lineage,
        note: lineageDepthAbove > 0
            ? `${lineageDepthAbove} generations of ${ancestry.surname} above the Lid before them.`
            : 'No line here. Whatever family they have is on the wrong side of the Lid, ' +
              'and being its founder is worth nothing on this one.'
    });

    const house = npc?.factionId ? getFaction(state, npc.factionId) : null;
    const houseAbove = house != null && isAboveTheLid(house);
    const rankShare = houseAbove && house.ranks.length > 1
        ? Math.min(1, Math.max(0, npc!.factionRankIndex) / (house.ranks.length - 1))
        : 0;
    components.push({
        source: 'house',
        value: houseAbove ? (0.5 + 0.5 * rankShare) * STANDING_WEIGHTS.house : 0,
        note: houseAbove
            ? `${house.ranks[Math.min(npc!.factionRankIndex, house.ranks.length - 1)]} of ${house.name}.`
            : 'No house. Nobody up here is obliged to notice.'
    });

    const alliesAbove = resident
        ? npc!.relationships.filter(r => r.standing > 0.2 && isAboveTheLid(getNpc(state, r.targetId))).length
        : 0;
    components.push({
        source: 'allies',
        value: Math.min(1, alliesAbove / 8) * STANDING_WEIGHTS.allies,
        note: alliesAbove === 0
            ? 'Nobody here would do anything for them.'
            : `${alliesAbove} people here who would.`
    });

    const holdingsAbove = state.objects.filter(
        o => o.possessorId === residentId && o.tags.includes('immortal_make')
    ).length;
    components.push({
        source: 'holdings',
        value: Math.min(1, holdingsAbove / 6) * STANDING_WEIGHTS.holdings,
        note: holdingsAbove === 0
            ? 'Nothing in hand that was made on this side.'
            : `${holdingsAbove} things made here.`
    });

    const standing = resident
        ? Number(components.reduce((sum, c) => sum + c.value, 0).toFixed(6))
        : 0;

    let rank = 1;
    if (resident) {
        for (const other of residents) {
            if (other.id === residentId) continue;
            if (rawStanding(state, other.id, onDay) > standing) rank++;
        }
    }

    return {
        residentId,
        residentName: npc?.name ?? residentId,
        onDay,
        resident,
        tenureYears: Number(tenureYears.toFixed(2)),
        lineageDepthAbove,
        houseId: houseAbove ? house!.id : null,
        houseName: houseAbove ? house!.name : null,
        houseRankIndex: houseAbove ? npc!.factionRankIndex : -1,
        alliesAbove,
        holdingsAbove,
        standing,
        components,
        rankAmongResidents: resident ? rank : 0,
        residentCount: residents.length,
        cultivationIsUnremarkable: true,
        verdict: resident
            ? standing < 0.05
                ? 'A newcomer. No lineage, no standing, no allies, and cultivation that is the ' +
                  'same cultivation everybody here has.'
                : `Stands ${rank} of ${residents.length}.`
            : 'Not above the Lid.'
    };
}

/**
 * How many generations of this person's line were already up here.
 *
 * ANCESTORS above the Lid, not membership of a line whose founder happens to be
 * above it. The distinction cost a test: a newly ascended cultivator is the
 * founder of their own family, that family is entirely below, and counting the
 * line rather than the ancestry handed a newcomer a generation of standing for
 * having had children in a world they can no longer reach. Being somebody's
 * ancestor is worth nothing on this side; having one is the whole of it.
 */
function ancestryAbove(state: WorldState, residentId: string): { depth: number; surname: string } {
    let depth = 0;
    let surname = '';
    for (const lineage of state.lineages) {
        if (!lineage.memberIds.includes(residentId)) continue;
        const above = ancestorsOf(lineage, residentId)
            .filter(a => isAboveTheLid(getNpc(state, a.id)));
        if (above.length > depth) {
            depth = above.length;
            surname = lineage.surname;
        }
    }
    return { depth, surname };
}

/** The total only, for the ranking pass. Avoids building every breakdown twice. */
function rawStanding(state: WorldState, residentId: string, onDay: number): number {
    return immortalStandingTotal(state, residentId, onDay);
}

function immortalStandingTotal(state: WorldState, residentId: string, onDay: number): number {
    const npc = getNpc(state, residentId);
    if (!npc || !isAboveTheLid(npc)) return 0;
    const record = ascensionOf(state, residentId);
    const arrivedOnDay = record?.ascendedOnDay ?? npc.identity.bornOnDay;
    const tenure = Math.min(1, Math.max(0, (onDay - arrivedOnDay) / DAYS_PER_YEAR) / TENURE_SATURATION_YEARS);

    const depth = ancestryAbove(state, residentId).depth;

    const house = npc.factionId ? getFaction(state, npc.factionId) : null;
    const houseAbove = house != null && isAboveTheLid(house);
    const rankShare = houseAbove && house.ranks.length > 1
        ? Math.min(1, Math.max(0, npc.factionRankIndex) / (house.ranks.length - 1))
        : 0;

    const allies = npc.relationships.filter(
        r => r.standing > 0.2 && isAboveTheLid(getNpc(state, r.targetId))
    ).length;
    const holdings = state.objects.filter(
        o => o.possessorId === residentId && o.tags.includes('immortal_make')
    ).length;

    return (
        tenure * STANDING_WEIGHTS.tenure +
        Math.min(1, depth / 4) * STANDING_WEIGHTS.lineage +
        (houseAbove ? (0.5 + 0.5 * rankShare) * STANDING_WEIGHTS.house : 0) +
        Math.min(1, allies / 8) * STANDING_WEIGHTS.allies +
        Math.min(1, holdings / 6) * STANDING_WEIGHTS.holdings
    );
}

// ─────────────────────────────────────────────────────────────────────────
// BOTH READINGS, SIDE BY SIDE
// ─────────────────────────────────────────────────────────────────────────

export interface TwoReadings {
    subjectId: string;
    subjectName: string;
    /** What they are worth measured against the world they left. */
    below: {
        rank: string;
        powerMultiplier: number;
        strongestBelowMultiplier: number;
        /** Measured, not asserted. A division over the living roster. */
        timesTheStrongestBelow: number;
        statement: string;
    };
    /** What they are worth measured against the world they arrived in. */
    above: {
        standing: number;
        rankAmongResidents: number;
        residentCount: number;
        medianResidentStanding: number;
        /** True while cultivation is a constant up there, which is always. */
        cultivationIsUnremarkable: boolean;
        statement: string;
    };
    /** Both are true at the same time. The gap is the entire perspective shift. */
    bothTrue: true;
}

/**
 * The invincible ancestor, priced twice.
 *
 * The lower reading is a measurement over the living roster: whatever the
 * strongest thing alive below actually is, divided into what a True Immortal
 * is. The upper reading is a rank among residents. Neither is a sentence
 * somebody wrote next to a faction, and they disagree by orders of magnitude,
 * which is the payoff.
 */
export function readTwoWays(
    state: WorldState,
    subjectId: string,
    onDay = state.currentDay
): TwoReadings {
    const npc = getNpc(state, subjectId);
    const ordinal = npc?.cultivation.realmOrdinal ?? TRUE_IMMORTAL_ORDINAL;
    const mine = powerMultiplierForOrdinal(ordinal);

    let strongestBelow = 1;
    for (const other of state.npcs) {
        if (other.id === subjectId) continue;
        if (other.status !== 'alive' || !isBelowTheLid(other)) continue;
        strongestBelow = Math.max(strongestBelow, powerMultiplierForOrdinal(other.cultivation.realmOrdinal));
    }

    const standing = immortalStanding(state, subjectId, onDay);
    const residents = residentsAbove(state);
    const totals = residents
        .map(r => immortalStandingTotal(state, r.id, onDay))
        .sort((a, b) => a - b);
    const median = totals.length === 0
        ? 0
        : totals.length % 2 === 1
            ? totals[(totals.length - 1) / 2]
            : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2;

    const times = mine / strongestBelow;

    return {
        subjectId,
        subjectName: npc?.name ?? subjectId,
        below: {
            rank: rankName(ordinal),
            powerMultiplier: mine,
            strongestBelowMultiplier: strongestBelow,
            timesTheStrongestBelow: Number(times.toFixed(2)),
            statement:
                `Against the strongest thing alive below the Lid, ${times.toFixed(0)} times over. ` +
                'Mean damage from anybody down there is zero, and a descent would reorganise a continent.'
        },
        above: {
            standing: standing.standing,
            rankAmongResidents: standing.rankAmongResidents,
            residentCount: standing.residentCount,
            medianResidentStanding: Number(median.toFixed(6)),
            cultivationIsUnremarkable: true,
            statement:
                standing.standing < median
                    ? `Stands ${standing.rankAmongResidents} of ${standing.residentCount}, below the ` +
                      'middle of the room, and holds exactly the cultivation everybody in it holds.'
                    : `Stands ${standing.rankAmongResidents} of ${standing.residentCount}.`
        },
        bothTrue: true
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE TRANSITION AT 46
// ─────────────────────────────────────────────────────────────────────────

export interface AscendInput {
    /** Must already be in `state.npcs`, at ordinal 46. */
    npcId: string;
    onDay: number;
    /** The run this life was, when the caller keeps a run ledger. */
    runId?: string | null;
    /**
     * Object ids to divest. Defaults to everything they are holding, which is
     * the correct default: nothing goes through the Lid except the cultivator.
     */
    divest?: readonly string[];
    /** Whether the house they leave gets a parting gift. Default true. */
    partingGift?: boolean;
    /** Spirit stones left in the cache. */
    spiritStones?: number;
}

export interface AscendResult {
    ok: boolean;
    reason: string | null;
    detail: string;
    state: WorldState;
    record: AscensionRecord | null;
    /** The sealed cache they built on the way out. */
    inheritance: LocationRecord | null;
    /** What the house got, when there was a house. */
    gift: ObjectRecord | null;
    divested: ObjectRecord[];
    facts: HistoricalFact[];
    standing: ImmortalStanding | null;
    readings: TwoReadings | null;
}

/**
 * Go through.
 *
 * Ascension has been an ending everywhere it appears; here it becomes a
 * transition, and the difference is enumerable:
 *
 *   - the person is still `alive`, still a going concern, still in the roster;
 *   - their lineage edges, relationships, grudges, debts, history facts and
 *     the provenance of everything they ever owned are untouched;
 *   - their house's claim to an ascended ancestor becomes TRUE, and stays
 *     unverifiable;
 *   - what they were carrying stops being theirs, because nothing goes through
 *     the Lid with them - and that divestment is the author of the world's
 *     entire inheritance economy;
 *   - the world below does not pause, and nothing about it waits for them.
 *
 * The lower world is told nothing it can rely on. The fact it gets is
 * `unresolved`, with the three candidate answers people actually offer, and it
 * stays that way: crossed, died and in seclusion are indistinguishable from
 * underneath. The engine's own answer is on the `AscensionRecord` and never
 * renders.
 */
export function ascend(state: WorldState, input: AscendInput): AscendResult {
    const empty: AscendResult = {
        ok: false, reason: null, detail: '', state,
        record: null, inheritance: null, gift: null, divested: [], facts: [],
        standing: null, readings: null
    };

    const npc = getNpc(state, input.npcId);
    if (!npc) {
        return { ...empty, reason: 'no_such_person', detail: 'Nobody by that id is in this world.' };
    }
    if (npc.status === 'physically_dead') {
        return { ...empty, reason: 'already_terminal', detail: 'This identity ended. Nothing crosses out of that.' };
    }
    if (isAboveTheLid(npc)) {
        return { ...empty, reason: 'already_above', detail: 'The Lid does not open twice for the same name.' };
    }

    const verdict = evaluateLayerCrossing({
        subject: 'person',
        direction: 'up',
        ordinal: npc.cultivation.realmOrdinal
    });
    if (!verdict.permitted) {
        return { ...empty, reason: verdict.reason, detail: verdict.detail };
    }

    ensureImmortalLayer(state);

    const onDay = input.onDay;
    const facts: HistoricalFact[] = [];
    const fromLocationId = npc.locationId;
    const fromFactionId = npc.factionId;
    const faction = fromFactionId ? getFaction(state, fromFactionId) : null;
    const rng = forStream(state.seed, 'ascension', npc.id);

    // ── Divestment, and the door somebody put on it ──────────────────────
    const held = input.divest
        ? state.objects.filter(o => input.divest!.includes(o.id))
        : state.objects.filter(o => o.possessorId === npc.id);

    // A parting gift is the clean route and it is the rare one: it requires
    // somebody on their way out to still care about a specific institution.
    let gift: ObjectRecord | null = null;
    const wantsGift = (input.partingGift ?? true) && faction != null && held.length > 0;
    if (wantsGift) {
        const best = held.slice().sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0];
        const canLeave = evaluateLayerCrossing({
            subject: best.kind === 'manual' ? 'manual' : 'object',
            direction: 'down',
            ordinal: npc.cultivation.realmOrdinal,
            power: best.power
        });
        if (canLeave.permitted) {
            gift = transferPossession(best, {
                onDay,
                toHolderId: faction!.id,
                toHolderName: faction!.name,
                how: 'inherited',
                source: `${npc.name}, on the way out`,
                note: 'Left to the house that raised them. They knew they were not coming back.',
                transfersOwnership: true
            });
            // The gift is the LINE, and this tag is what makes it one.
            //
            // Without it `sendAcross` had no reachable channel object anywhere
            // in the codebase, so the only reliable connection between the two
            // layers was written, tested and impossible to open. The setting
            // has always said what a channel is made of: a house that holds
            // something left by the one who crossed is a house that receives,
            // and a house that holds nothing hears nothing. That is the whole
            // difference between the four bodies in `IMMORTAL_CHANNELS` and
            // everybody else, and it is a property of the OBJECT rather than of
            // the house - which is why it is set here and not on the faction.
            //
            // It cuts both ways, as it should: the gift is also what a rival
            // would have to take to cut the line, and the house cannot tell
            // whether silence means the line is dead or the person is.
            gift = { ...gift, locationId: faction!.seatLocationId };
            if (!gift.tags.includes(LID_CHANNEL_TAG)) {
                gift = { ...gift, tags: gift.tags.concat(LID_CHANNEL_TAG) };
            }
            Object.assign(state, upsertObject(state, gift));
        }
    }

    // Everything else goes behind a door, calibrated rather than merely lethal,
    // for whoever proves worth it. The builder picks the level of person they
    // intend to find it; they will never come back to check.
    const remaining = held.filter(o => o.id !== gift?.id);
    let inheritance: LocationRecord | null = null;
    const divested: ObjectRecord[] = [];

    if (remaining.length > 0 || (input.spiritStones ?? 0) > 0) {
        const calibratedFor = rng.int(17, 33);
        const site = fromLocationId ? getLocation(state, fromLocationId) : null;
        inheritance = makeLocation({
            id: `loc-inheritance-${npc.id}`,
            name: `what ${npc.name} left`,
            kind: 'cave',
            parentId: site?.id ?? null,
            description:
                `Built on the way out, gated, stocked, and abandoned on purpose. The trials inside ` +
                `were calibrated for ${rankName(calibratedFor)}, which is a decision somebody made ` +
                'about who they wanted to find it.',
            ambient: site?.ambient ?? 'normal',
            qiDensity: site?.qiDensity ?? 40,
            thresholds: makeThresholds(
                Math.max(0, calibratedFor - 8),
                Math.max(0, calibratedFor - 4),
                calibratedFor,
                calibratedFor + 4
            ),
            hazards: ['formation', 'guardian', 'illusion'],
            affinities: [
                makeAffinity('formation', 1.3, 3, 'The array was left readable, by somebody who wanted it read.')
            ],
            environment: makeEnvironment({
                spiritualDensity: 0.05,
                danger: 0.7,
                resources: ['manuals'],
                politicalControl: 'whoever gets in',
                specialRules: ['the trials do not escalate; they were set once and left'],
                historicalScars: [`${npc.name} sealed this and went through the Lid.`]
            }),
            sealed: true,
            discovered: false,
            tags: ['inheritance', 'left_on_the_way_out'],
            data: {
                builtById: npc.id,
                builtByName: npc.name,
                builtOnDay: onDay,
                calibratedFor,
                spiritStones: input.spiritStones ?? 0
            }
        });
        inheritance.origin.fromDay = onDay;
        inheritance.sealedOnDay = onDay;
        Object.assign(state, upsertLocation(state, inheritance));

        for (const object of remaining) {
            const moved = {
                ...transferPossession(object, {
                    onDay,
                    toHolderId: null,
                    toHolderName: 'nobody',
                    how: 'lost',
                    source: `the inheritance ${npc.name} built on the way out`,
                    note: 'Nothing goes through the Lid except the cultivator.'
                }),
                locationId: inheritance.id
            };
            divested.push(moved);
            Object.assign(state, upsertObject(state, moved));
        }
    }

    // ── The move ─────────────────────────────────────────────────────────
    // The rank is already 46; what changes is the layer, the place, and the
    // fact that they now belong to nobody. Everything else on the record is
    // left exactly as it was, which is what stops this being a reset.
    let moved: NpcRecord = {
        ...setRealm(npc, TRUE_IMMORTAL_ORDINAL, onDay),
        layer: IMMORTAL_LAYER,
        locationId: IMMORTAL_LANDING_LOCATION_ID,
        factionId: null,
        factionRankIndex: -1,
        updatedOnDay: onDay,
        lastConfirmedOnDay: onDay,
        tags: npc.tags.includes('ascended') ? npc.tags : npc.tags.concat('ascended')
    };
    Object.assign(state, upsertNpc(state, moved));

    // ── What the world below got, which is nothing it can rely on ────────
    const belowFact = recordUnresolved(state.history, makeFact({
        day: onDay,
        kind: 'ascension',
        scale: 'regional',
        actors: [{ id: npc.id, name: npc.name, role: 'crossed' }],
        locationId: fromLocationId,
        factionIds: fromFactionId ? [fromFactionId] : [],
        summary:
            `${npc.name} attempted the last crossing and has not been seen since. ` +
            'Nothing about what followed is established.',
        visibility: fromFactionId ? 'faction' : 'regional',
        magnitude: 0.65,
        data: {
            unattributed:
                'The sky over the north mountain did something nobody there can describe, and ' +
                'a name stopped being read out at a compound gate.'
        }
    }), [
        'They completed it and are above the Lid.',
        'They did not survive it, and there is no body because there never is.',
        'They are in seclusion somewhere and will come out.'
    ]);
    facts.push(belowFact);

    // The engine's own record. Secret, and it stays that way.
    facts.push(appendWorldFact(state, makeFact({
        day: onDay,
        kind: 'ascension',
        scale: 'world',
        actors: [{ id: npc.id, name: npc.name, role: 'arrived' }],
        locationId: IMMORTAL_LANDING_LOCATION_ID,
        summary: `${npc.name} came out at the landing. Nobody there took any notice.`,
        visibility: 'secret',
        magnitude: 0.2,
        data: { layer: IMMORTAL_LAYER, arrivedOnDay: onDay }
    })));

    // ── The house they left ──────────────────────────────────────────────
    // Its claim to a living ascended ancestor is now true, and it will never be
    // able to establish that. The recency of a crossing is most of a sect's
    // prestige, so the day is what is recorded rather than any verdict.
    if (faction) {
        faction.resources.ascended_ancestors = (faction.resources.ascended_ancestors ?? 0) + 1;
        faction.resources.last_ascension_day = onDay;
        Object.assign(state, upsertFaction(state, faction));

        const witnesses = state.npcs
            .filter(n => n.factionId === faction.id && n.status === 'alive' && n.id !== npc.id)
            .slice(0, 6);
        for (const witness of witnesses) {
            storeMemory(state.memories, {
                ownerId: witness.id,
                kind: 'rumour',
                summary: `${npc.name} went for the last crossing. Nobody knows what happened after that.`,
                onDay,
                actorIds: [npc.id],
                factionIds: [faction.id],
                locationId: fromLocationId,
                salience: 0.75,
                sourceFactIds: [belowFact.id]
            });
        }
    }

    const record = makeAscensionRecord({
        id: `asc-${npc.id}`,
        residentId: npc.id,
        residentName: npc.name,
        ascendedOnDay: onDay,
        fromLocationId,
        fromFactionId,
        runId: input.runId ?? null,
        toLocationId: IMMORTAL_LANDING_LOCATION_ID,
        belowFactId: belowFact.id,
        inheritanceLocationId: inheritance?.id ?? null,
        partingGiftObjectId: gift?.id ?? null
    });
    ascensionsOf(state).push(record);

    return {
        ok: true,
        reason: null,
        detail:
            `${npc.name} is through. Below the Lid they are a name that stopped being read out; ` +
            'above it they are somebody standing on open ground that nobody owns.',
        state,
        record,
        inheritance,
        gift,
        divested,
        facts,
        standing: immortalStanding(state, npc.id, onDay),
        readings: readTwoWays(state, npc.id, onDay)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ABODE
//
// The landing is open ground that nobody owns and everybody arrives on, and
// until this existed that was the whole of the far side for a newcomer -
// which made ascension read as an ending with a field attached. It is not.
// Somebody who comes through settles, quickly, and the abode is the first
// thing that happens up there: somewhere to be, somewhere to keep what they
// make, and somewhere they can be found by anybody else on this layer.
//
// It is an ordinary location and nothing about it is immortal-specific except
// the layer. `kind` is `cave` - the genre's own word for a cultivator's
// dwelling, and a kind with no faction implication - rather than a new member
// of `LocationKind`, because a type widened for one case is the bespoke rule
// this design forbids. What an abode is FOR follows from the generic systems:
// objects have a `locationId`, people have a `locationId`, and being findable
// is `evaluateAccess` against thresholds like anywhere else.
// ─────────────────────────────────────────────────────────────────────────

export interface SettleAbodeInput {
    residentId: string;
    onDay: number;
    /** What they call it. Rolled from the world seed when they have not said. */
    name?: string;
}

export interface SettleAbodeResult {
    ok: boolean;
    reason: string | null;
    detail: string;
    state: WorldState;
    abode: LocationRecord | null;
    /** False when they already had one. Settling twice is settling once. */
    created: boolean;
}

/**
 * Make somewhere to be, above the Lid.
 *
 * Idempotent by construction: the id is keyed on the resident, so a second
 * call finds the first one's location and moves nobody. The abode hangs off
 * the landing rather than off the seam, which is a statement about the
 * geography and not a convenience - everybody arrives at the landing, so
 * everybody's ground is measured from it.
 *
 * Thresholds are the layer's, which is to say the entry bar is True Immortal
 * and so is every other bar. Nothing up there is difficult because of the
 * ladder; the ladder is finished. What an abode is worth is that it is YOURS,
 * on a layer where a newcomer's standing is zero on every axis
 * (`immortalStanding`), and holdings is one of the axes.
 */
export function settleAbode(state: WorldState, input: SettleAbodeInput): SettleAbodeResult {
    const npc = getNpc(state, input.residentId);
    const base: SettleAbodeResult = {
        ok: false, reason: null, detail: '', state, abode: null, created: false
    };

    if (!npc) {
        return { ...base, reason: 'no_such_person', detail: 'Nobody by that id is in this world.' };
    }
    if (!isAboveTheLid(npc)) {
        return {
            ...base,
            reason: 'not_beyond_the_lid',
            detail:
                'An abode is built on the far side of the Lid, and they are on this one. Nothing '
                + 'below True Immortal can hold ground up there because nothing below True '
                + 'Immortal can be up there.'
        };
    }

    ensureImmortalLayer(state);

    const id = abodeLocationId(npc.id);
    const already = getLocation(state, id);
    if (already) {
        // Already settled. The one thing this still does is put them in it,
        // because a resident who wandered to the landing has an abode they are
        // simply not standing in.
        return {
            ...base,
            ok: true,
            abode: already,
            created: false,
            detail: `${already.name} is already theirs, and has been since they made it.`
        };
    }

    const rng = forStream(state.seed, 'immortal-abode', npc.id);
    const abode = makeLocation({
        id,
        name: input.name?.trim() || `the ${placeName(rng).toLowerCase()}`,
        kind: 'cave',
        layer: IMMORTAL_LAYER,
        parentId: IMMORTAL_LANDING_LOCATION_ID,
        description:
            'Ground taken out of the open and made into somewhere. Nobody contested it, '
            + 'because there is a great deal of ground up here and nothing on it anybody '
            + 'wants; what it is worth is that it is theirs, which on this layer is a '
            + 'thing a newcomer has none of.',
        ambient: 'spirit_tide',
        qiDensity: IMMORTAL_QI_DENSITY,
        thresholds: makeThresholds(
            TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, MAX_ORDINAL
        ),
        hazards: [],
        environment: makeEnvironment({
            spiritualDensity: IMMORTAL_QI_DENSITY,
            danger: 0.1,
            resources: ['qi'],
            climate: 'unweathered',
            politicalControl: `${npc.name}, and nobody has argued`,
            specialRules: IMMORTAL_SPECIAL_RULES.slice()
        }),
        discovered: true,
        tags: ['immortal', 'abode'],
        data: { heldById: npc.id, heldByName: npc.name, settledOnDay: input.onDay }
    });
    abode.origin.fromDay = input.onDay;
    Object.assign(state, upsertLocation(state, abode));

    Object.assign(state, upsertNpc(state, {
        ...npc,
        locationId: abode.id,
        updatedOnDay: input.onDay
    }));

    // Secret, and it stays that way. Nothing below the Lid learns that
    // somebody up there has built anything, because there is no signal across
    // the boundary in either direction that is not an object or a channel.
    appendWorldFact(state, makeFact({
        day: input.onDay,
        kind: 'opportunity',
        scale: 'personal',
        actors: [{ id: npc.id, name: npc.name, role: 'settled' }],
        locationId: abode.id,
        summary: `${npc.name} stopped standing on the landing and made ${abode.name}.`,
        visibility: 'secret',
        magnitude: 0.15,
        data: { layer: IMMORTAL_LAYER, abodeLocationId: abode.id }
    }));

    return {
        ...base,
        ok: true,
        abode,
        created: true,
        detail:
            `${abode.name}. It is the first thing anybody does up here, and it is the first `
            + 'thing they have owned since the Lid took everything else.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// COMING BACK DOWN
// ─────────────────────────────────────────────────────────────────────────

export interface DescendInput {
    residentId: string;
    /** Where below they are forcing the opening. */
    toLocationId: string;
    onDay: number;
    /** Why. The most interesting fact anybody will ever learn about them. */
    reason: string;
    /** Object ids they intend to leave behind down there. */
    leaveBehind?: readonly string[];
}

export interface DescentResult {
    ok: boolean;
    reason: string | null;
    detail: string;
    state: WorldState;
    verdict: CrossingVerdict;
    /** How long they had. Rolled from the world seed, never from the story. */
    breaths: number;
    /** Tribulation the transit itself draws. The caller resolves the strikes. */
    strikes: number;
    /** Objects that went back up with them, because everything at that rung does. */
    carriedBack: string[];
    /** What they were not permitted to leave, and why. */
    refused: { objectId: string; reason: string }[];
    /** What they were permitted to leave, and did. */
    leftBehind: string[];
    fact: HistoricalFact | null;
}

/**
 * Force an opening inward.
 *
 * Not a travel option. It is paid for out of cultivation condensed over ages,
 * it draws the heaviest tribulation in the game, and it buys ten to fifteen
 * breaths - enough to end a faction and not enough to take one, hold ground,
 * occupy a province, install anybody or govern for an afternoon. That is why
 * nobody above the Lid rules anything down here.
 *
 * The visit is resolved atomically and the resident's layer never changes,
 * because the expulsion is already happening for the whole time they are here:
 * a True Immortal in the lower world is a thing being pushed back out, the way
 * water finds a level.
 */
export function descend(state: WorldState, input: DescendInput): DescentResult {
    const npc = getNpc(state, input.residentId);
    const base: DescentResult = {
        ok: false, reason: null, detail: '', state,
        verdict: evaluateLayerCrossing({
            subject: 'person', direction: 'down', ordinal: npc?.cultivation.realmOrdinal ?? 0
        }),
        breaths: 0, strikes: 0, carriedBack: [], refused: [], leftBehind: [], fact: null
    };

    if (!npc) return { ...base, reason: 'no_such_person', detail: 'Nobody by that id is in this world.' };
    if (!isAboveTheLid(npc)) {
        return { ...base, reason: 'not_beyond_the_lid', detail: 'There is nothing to come down from.' };
    }
    if (!base.verdict.permitted) {
        return { ...base, reason: base.verdict.reason, detail: base.verdict.detail };
    }

    const rng = forStream(state.seed, 'descent', npc.id, input.onDay);
    const window = base.verdict.breathsBelow!;
    const breaths = rng.int(window.min, window.max);

    // Everything they are carrying that was made above goes back up with them,
    // whether they meant it to or not. This is the ceiling on any object that
    // can be held below, and it is a ceiling for a reason rather than by
    // accident of what has turned up.
    const carried = state.objects.filter(o => o.possessorId === npc.id);
    const wanted = new Set(input.leaveBehind ?? []);
    const carriedBack: string[] = [];
    const refused: { objectId: string; reason: string }[] = [];
    const leftBehind: string[] = [];

    for (const object of carried) {
        if (!wanted.has(object.id)) {
            carriedBack.push(object.id);
            continue;
        }
        const canLeave = evaluateLayerCrossing({
            subject: object.kind === 'manual' ? 'manual' : 'object',
            direction: 'down',
            ordinal: npc.cultivation.realmOrdinal,
            power: object.power,
            madeAbove: object.tags.includes('immortal_make')
        });
        if (!canLeave.permitted) {
            refused.push({ objectId: object.id, reason: canLeave.reason ?? 'refused' });
            carriedBack.push(object.id);
            continue;
        }
        const moved = {
            ...transferPossession(object, {
                onDay: input.onDay,
                toHolderId: null,
                toHolderName: 'nobody',
                how: 'gifted',
                source: `${npc.name}, in the fifteen breaths they had`,
                note: input.reason
            }),
            locationId: input.toLocationId
        };
        Object.assign(state, upsertObject(state, moved));
        leftBehind.push(object.id);
    }

    // Witnessed, enormous, and over almost before it started.
    const fact = appendWorldFact(state, makeFact({
        day: input.onDay,
        kind: 'catastrophe',
        scale: 'regional',
        actors: [{ id: npc.id, name: npc.name, role: 'descended' }],
        locationId: input.toLocationId,
        summary:
            `Something came down at ${getLocation(state, input.toLocationId)?.name ?? input.toLocationId} ` +
            `and was gone inside ${breaths} breaths. ${input.reason}`,
        visibility: 'public',
        magnitude: 0.95,
        data: {
            breaths,
            unattributed:
                'The sky opened, briefly, and everyone within forty li stopped being able to ' +
                'stand up. Nobody agrees on what was in it.',
            residentId: npc.id
        }
    }));

    return {
        ...base,
        ok: true,
        state,
        breaths,
        strikes: DESCENT_TRIBULATION_STRIKES,
        carriedBack,
        refused,
        leftBehind,
        fact,
        detail:
            `${breaths} breaths below the Lid, and then the lightning took them back up. ` +
            'It can answer, once, very fast. It cannot conquer.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE CHANNEL
// ─────────────────────────────────────────────────────────────────────────

/** What marks an object as a working line of enquiry through the Lid. */
export const LID_CHANNEL_TAG = 'lid_channel';

export interface SendAcrossInput {
    /** Who is sending. Either side. */
    fromId: string;
    /** Who is receiving. */
    toId: string;
    onDay: number;
    /** The artifact through which it passes. Must carry `lid_channel`. */
    channelObjectId: string;
    subject: 'object' | 'manual' | 'information';
    /** For an object or a manual. */
    objectId?: string;
    /** For information. A message, an answer, a warning, a confirmation. */
    message?: string;
}

export interface SendAcrossResult {
    ok: boolean;
    reason: string | null;
    detail: string;
    state: WorldState;
    verdict: CrossingVerdict;
    fact: HistoricalFact | null;
    /** The object that actually crossed, when one did. */
    objectId: string | null;
}

/**
 * Put something through the Lid without going through it.
 *
 * The setting's only reliable channel between the two sides, and the reason
 * anything below knows the other side exists at all. It is also why the most
 * valuable commodity in the world is not a treasure but a working line of
 * enquiry to somebody who already went through - precisely the sort of thing
 * that gets misreported, faked and sold.
 *
 * A message reaches exactly one person: it is stored as their memory and as a
 * secret fact. It does not become public knowledge, because a channel does not
 * announce.
 */
export function sendAcross(state: WorldState, input: SendAcrossInput): SendAcrossResult {
    const from = getNpc(state, input.fromId);
    const to = getNpc(state, input.toId);
    const channel = state.objects.find(o => o.id === input.channelObjectId) ?? null;
    const base: SendAcrossResult = {
        ok: false, reason: null, detail: '', state,
        verdict: { permitted: false, reason: null, detail: '', breathsBelow: null, ruinous: false },
        fact: null, objectId: null
    };

    if (!from || !to) {
        return { ...base, reason: 'no_such_person', detail: 'One end of this is not in the world.' };
    }
    if (!channel || !channel.tags.includes(LID_CHANNEL_TAG)) {
        return {
            ...base,
            reason: 'no_channel',
            detail:
                'Nothing carries it. The artifacts through which knowledge passes the Lid are among ' +
                'the rarest objects in the world, and a claim to hold one is usually a claim.'
        };
    }
    if (layerOf(from) === layerOf(to)) {
        return { ...base, reason: 'same_layer', detail: 'Both ends are on the same side. This is a letter.' };
    }

    const direction = isAboveTheLid(from) ? 'down' : 'up';
    const object = input.objectId
        ? state.objects.find(o => o.id === input.objectId) ?? null
        : null;

    const verdict = evaluateLayerCrossing({
        subject: input.subject,
        direction,
        ordinal: from.cultivation.realmOrdinal,
        power: object?.power ?? null,
        madeAbove: object?.tags.includes('immortal_make') ?? false,
        channel: true
    });
    if (!verdict.permitted) {
        return { ...base, verdict, reason: verdict.reason, detail: verdict.detail };
    }

    if (input.subject !== 'information') {
        if (!object) {
            return { ...base, verdict, reason: 'no_such_object', detail: 'There is nothing to send.' };
        }
        const moved = {
            ...transferPossession(object, {
                onDay: input.onDay,
                toHolderId: to.id,
                toHolderName: to.name,
                how: 'gifted',
                source: `sent through ${channel.name}`,
                note: input.message ?? '',
                transfersOwnership: true
            }),
            locationId: to.locationId
        };
        Object.assign(state, upsertObject(state, moved));
        base.objectId = moved.id;
    }

    // The recipient knows. Nobody else does, and the channel answering is the
    // only evidence in existence that somebody on the far side is picking up.
    storeMemory(state.memories, {
        ownerId: to.id,
        kind: 'promise',
        summary: input.message ?? `Something came through ${channel.name}.`,
        onDay: input.onDay,
        actorIds: [from.id],
        salience: 0.9,
        tags: [LID_CHANNEL_TAG, direction]
    });

    const fact = appendWorldFact(state, makeFact({
        day: input.onDay,
        kind: 'opportunity',
        scale: 'personal',
        actors: [
            { id: from.id, name: from.name, role: 'sender' },
            { id: to.id, name: to.name, role: 'recipient' }
        ],
        locationId: to.locationId,
        summary: `${channel.name} answered. ${input.message ?? 'Something came through it.'}`,
        visibility: 'secret',
        magnitude: 0.5,
        data: { channelObjectId: channel.id, direction, subject: input.subject }
    }));

    const answered = { ...channel, data: { ...channel.data, lastAnsweredOnDay: input.onDay } };
    Object.assign(state, upsertObject(state, answered));

    return {
        ...base,
        ok: true,
        verdict,
        fact,
        detail: verdict.detail
    };
}

export interface ChannelReading {
    channelObjectId: string;
    name: string;
    lastAnsweredOnDay: number | null;
    silentYears: number | null;
    /** Everything the silence is equally consistent with. All of it, always. */
    consistentWith: string[];
    statement: string;
}

/**
 * What a house can actually conclude from its channel.
 *
 * A channel that still answers proves somebody is picking up. A channel that
 * has gone quiet proves nothing at all, and this returns the whole list of
 * things it is equally consistent with, so no caller can quietly collapse it
 * into "the ancestor is dead."
 */
export function readChannel(
    state: WorldState,
    channelObjectId: string,
    onDay = state.currentDay
): ChannelReading | null {
    const channel = state.objects.find(o => o.id === channelObjectId) ?? null;
    if (!channel) return null;
    const last = typeof channel.data.lastAnsweredOnDay === 'number'
        ? channel.data.lastAnsweredOnDay
        : null;
    const silentYears = last === null ? null : Math.max(0, (onDay - last) / DAYS_PER_YEAR);

    return {
        channelObjectId,
        name: channel.name,
        lastAnsweredOnDay: last,
        silentYears: silentYears === null ? null : Number(silentYears.toFixed(2)),
        consistentWith: [
            'they died up there',
            'they are alive and have stopped caring',
            'there is a war on the far side',
            'the object down here stopped working'
        ],
        statement: last === null
            ? 'It has never answered. That establishes nothing about anybody.'
            : silentYears! < 1
                ? 'It answered. Somebody up there is picking up, and that is the whole of what is known.'
                : `Quiet for ${Math.round(silentYears!)} years, which is equally consistent with four ` +
                  'different things and distinguishes none of them.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE TWO LAYERS, RUNNING AT THE SAME TIME
// ─────────────────────────────────────────────────────────────────────────

export interface ImmortalPeril {
    residentId: string;
    residentName: string;
    kind: PerilKind;
    onDay: number;
    /** The chance it was drawn against, after standing. */
    chance: number;
    fatal: boolean;
    note: string;
}

export interface ImmortalAdvanceResult {
    /** Perils that arrived. Most of them are survived. */
    perils: ImmortalPeril[];
    /** People who stopped being up there, and nobody below will ever know. */
    deaths: string[];
    /** Natives born above across the span. */
    born: number;
    /** Zero when the layer does not exist yet, which is the normal case. */
    residents: number;
}

/**
 * Advance the far side alongside the near one.
 *
 * Called from the driver on the same slice as `applyPressure`, which is what
 * makes "the lower world does not pause" and "the immortal world does not
 * pause" the same statement. An ascended cultivator does not leave a snapshot
 * behind and does not become one: both layers keep running, and whoever next
 * looks at either finds it substantially different.
 *
 * Cheap and decomposable. Perils are drawn at ABSOLUTE multiples of
 * `PERIL_INTERVAL_DAYS`, so ten years then thirty produces exactly the world
 * forty years produces, and a five-century advance is ten draws per resident.
 *
 * No-ops entirely on a world nobody has ascended from, which is almost all of
 * them.
 */
export function advanceImmortalLayer(
    state: WorldState,
    fromDay: number,
    toDay: number
): ImmortalAdvanceResult {
    const out: ImmortalAdvanceResult = { perils: [], deaths: [], born: 0, residents: 0 };
    if (!state.locations.some(l => isAboveTheLid(l))) return out;

    const firstInterval = Math.floor(fromDay / PERIL_INTERVAL_DAYS) + 1;
    const lastInterval = Math.floor(toDay / PERIL_INTERVAL_DAYS);
    out.residents = residentsAbove(state).length;
    if (lastInterval < firstInterval) return out;

    for (let k = firstInterval; k <= lastInterval; k++) {
        const day = Math.min(toDay, k * PERIL_INTERVAL_DAYS);

        for (const resident of residentsAbove(state)) {
            if (resident.status !== 'alive') continue;
            const standing = immortalStandingTotal(state, resident.id, day);
            const rng = forStream(state.seed, 'immortal-peril', resident.id, k);

            // Both draws happen on every path so the stream stays aligned
            // whatever the standing works out to.
            const environmentRoll = rng.next();
            const politicsRoll = rng.next();

            const environmentChance = perilChance('environment', standing);
            const politicsChance = perilChance('politics', standing);
            const kind: PerilKind | null =
                environmentRoll < environmentChance ? 'environment'
                    : politicsRoll < politicsChance ? 'politics'
                        : null;
            if (kind === null) continue;

            const note = kind === 'environment'
                ? 'Ground calibrated for immortals, which is a phrase worth taking seriously.'
                : 'Politics that has been running uninterrupted for a very long time, and they lost at it.';

            out.perils.push({
                residentId: resident.id,
                residentName: resident.name,
                kind,
                onDay: day,
                chance: Number((kind === 'environment' ? environmentChance : politicsChance).toFixed(6)),
                fatal: true,
                note
            });
            killAbove(state, resident, day, note);
            out.deaths.push(resident.id);
        }

        out.born += replenishNatives(state, day, k);
    }

    out.residents = residentsAbove(state).length;
    return out;
}

/**
 * Somebody stops being up there.
 *
 * Written as a secret fact and nothing else. There is deliberately no estate
 * settled, no inheritance fired and no grudge handed on: whatever they were
 * going to leave below was left at the crossing, and the lower world has no way
 * of learning that this happened. A house whose ancestor died four thousand
 * years ago is still claiming a living one, honestly, and will go on doing so.
 */
function killAbove(state: WorldState, resident: NpcRecord, onDay: number, note: string): void {
    Object.assign(state, upsertNpc(state, markDead(resident, onDay, note)));
    appendWorldFact(state, makeFact({
        day: onDay,
        kind: 'death',
        scale: 'personal',
        actors: [{ id: resident.id, name: resident.name, role: 'deceased' }],
        locationId: resident.locationId,
        summary: `${resident.name} is no longer above the Lid. ${note}`,
        visibility: 'secret',
        fidelity: 'lost',
        magnitude: 0.3,
        data: { layer: IMMORTAL_LAYER }
    }));

    const record = ascensionOf(state, resident.id);
    if (record) {
        record.afterCrossing = 'died_above';
        record.diedAboveOnDay = onDay;
        record.endNoteAbove = note;
    }
}

/**
 * The sky does not empty.
 *
 * The same demographic floor the lower world runs, at a hundredth of the size:
 * without it a five-century soak reports a collapse that is an artefact of the
 * model rather than anything that happened. It is not a second progression
 * system - nobody here advances, because there is nowhere to advance to.
 */
function replenishNatives(state: WorldState, day: number, interval: number): number {
    const houses = state.factions.filter(f => isAboveTheLid(f) && f.dissolvedOnDay === null);
    if (houses.length === 0) return 0;

    const living = state.npcs.filter(n => isAboveTheLid(n) && n.status === 'alive').length;
    if (living >= IMMORTAL_NATIVE_COUNT) return 0;

    const rng = forStream(state.seed, 'immortal-birth', interval);
    const house = houses[rng.int(0, houses.length - 1)];
    const id = `npc-above-b${interval}`;
    if (getNpc(state, id)) return 0;

    let npc = createNpc(state.seed, {
        id,
        name: `${personName(rng)} of ${house.name}`,
        bornOnDay: day - rng.int(200, 900) * DAYS_PER_YEAR,
        onDay: day,
        layer: IMMORTAL_LAYER,
        locationId: house.seatLocationId,
        factionId: house.id,
        factionRankIndex: 0,
        occupation: 'immortal',
        cultivation: { realmOrdinal: TRUE_IMMORTAL_ORDINAL },
        tags: ['immortal', 'native']
    });
    npc = setRealm(npc, TRUE_IMMORTAL_ORDINAL, npc.identity.bornOnDay);
    Object.assign(state, upsertNpc(state, npc));

    const lineage = state.lineages.find(l => l.id.startsWith('lin-above-') && l.surname === house.name);
    if (lineage) {
        const parentId = lineage.memberIds[lineage.memberIds.length - 1];
        const at = state.lineages.findIndex(l => l.id === lineage.id);
        state.lineages[at] = addLineageEdge(lineage, {
            parentId,
            childId: npc.id,
            relation: 'descendant',
            onDay: npc.identity.bornOnDay
        });
    }
    return 1;
}

// ─────────────────────────────────────────────────────────────────────────
// A COMPACT VIEW, FOR ADMIN AND FOR TESTS
// ─────────────────────────────────────────────────────────────────────────

export interface ImmortalWorldShape {
    exists: boolean;
    day: number;
    year: number;
    residents: number;
    natives: number;
    arrivals: number;
    houses: number;
    /** Ascensions the engine knows ended badly. Never rendered below the Lid. */
    diedAbove: number;
    stillAbove: number;
    /** Lowest qi density anywhere above. It is also the highest: the layer is flat. */
    minQiDensityAbove: number;
    maxQiDensityBelow: number;
    /** The lower world's own age. It only ever falls, and it is late. */
    eraQiDensityBelow: number;
    /**
     * Share of places below that reach the immortal floor.
     *
     * The honest half of "densities the lower world cannot produce": a few
     * pockets do, and every one of them is sealed or contested. Above, it is
     * the whole map and nobody is guarding it.
     */
    shareBelowAtImmortalDensity: number;
}

export function immortalWorldShape(state: WorldState): ImmortalWorldShape {
    const above = state.locations.filter(l => isAboveTheLid(l));
    const below = state.locations.filter(l => layerOf(l) === MORTAL_LAYER);
    const residents = residentsAbove(state);
    const records = ascensionsOf(state);
    const floorAbove = above.length === 0 ? 0 : Math.min(...above.map(l => l.qiDensity));
    return {
        exists: above.length > 0,
        day: state.currentDay,
        year: yearOfDay(state.currentDay),
        residents: residents.length,
        natives: residents.filter(n => n.tags.includes('native')).length,
        arrivals: residents.filter(n => n.tags.includes('ascended')).length,
        houses: state.factions.filter(f => isAboveTheLid(f)).length,
        diedAbove: records.filter(r => r.afterCrossing === 'died_above').length,
        stillAbove: records.filter(r => r.afterCrossing === 'still_above').length,
        minQiDensityAbove: floorAbove,
        maxQiDensityBelow: Math.max(0, ...below.map(l => l.qiDensity)),
        eraQiDensityBelow: currentEraQiDensity(state),
        shareBelowAtImmortalDensity: below.length === 0
            ? 0
            : Number((below.filter(l => l.qiDensity >= floorAbove).length / below.length).toFixed(4))
    };
}

/** Objects that exist only because there is a place they could be made. */
export function thingsMadeAbove(state: WorldState): ObjectRecord[] {
    return state.objects
        .filter(o => o.tags.includes('immortal_make'))
        .sort((a, b) => (b.power ?? 0) - (a.power ?? 0) || (a.id < b.id ? -1 : 1));
}

/**
 * True when this object could never be held below the Lid.
 *
 * A property of the object's rating read through the ordinary crossing rule,
 * not a flag anybody set. `OBJECT_CEILING_BELOW_THE_LID` is the whole of it.
 */
export function cannotBeHeldBelow(object: ObjectRecord): boolean {
    return object.kind !== 'manual' && (object.power ?? 0) > OBJECT_CEILING_BELOW_THE_LID;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
