/**
 * How the world keeps finding more ruins.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { clampOrdinal } from '../cultivation/realms.js';
import {
    ELDER_FLOOR_ORDINAL,
    type IntentStanding,
    type RuinAccess,
    type RuinCharacter,
    type RuinOrigin,
    type RuinScale
} from '../../data/cultivation/inheritance-trials.js';
import { wardConditionOf, wardIntegrityOf } from './how-far-gone-a-formation-is.js';
import { isBelowTheLid } from './layers.js';
import {
    makeEnvironment,
    makeThresholds,
    makeAffinity,
    makeLocation,
    type LocationRecord
} from './locations.js';
import { clampQiDensity } from './qi-scale.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE DOCTRINE
// Stated once, as data, so the tests assert against the same sentences the
// constants below were derived from.
// ─────────────────────────────────────────────────────────────────────────

export const RUINS_ARE_A_RESERVE_NOT_AN_ENDOWMENT = {
    principle:
        'Nobody is making ruins. The Late Age made them all and it is over, so the stock is finite in principle. What is not finite in practice is what has been found, because the world has never looked at most of its own ground and never will.',
    soTheRateIsGovernedBy:
        'How hard and how widely people are looking. Not by a countdown to an empty list. A province with nobody in it finds nothing whatever is under it, and the same province a century later with four houses working out of it finds several a decade.',
    theEasyGroundGoesFirst:
        'Ground is banded by depth and effort goes to the least-worked band anybody in the province can reach. What is found early is what people trip over; what is found late is under something, is more dangerous, and is worth more.',
    diminishingReturnsIsTheWholeShape:
        'Each find in a band makes the next one in that band harder, on a hyperbolic decline - steep at first and then a very long flat tail. That is the shape a producing field has, and it is why the analogy is worth taking literally rather than decoratively.',
    andCapabilityOpensGroundThatWasAlwaysThere:
        'A band nobody in the province can survive is a band nobody is looking in. When the ladder produces somebody who can go deeper, ground that has been there the whole time becomes findable and the rate steps back up. This is not new ruins. It is deepwater, and it is the reason the curve does not go to nothing.',
    whatThisIsNot:
        'It is not a spawner. Nothing here creates a ruin that the prior ages did not leave: every province has a stated number in the ground, the number is fixed for the life of the world, and a province that reaches it stops producing finds permanently. The claim is that the numbers are large and the looking is slow, not that the ground is infinite.',
    theMeasurementThatMatters:
        'The long horizon. A countdown and a reserve are indistinguishable at year 200 and differ completely at year 5000, so any change here has to be measured at five thousand years or it has not been measured.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// DEPTH
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many bands of depth the ground has.
 */
export const DEEPEST_BAND = 5;

/** Ordinals per band, so band and rung stay one arithmetic rather than two tables. */
export const ORDINALS_PER_BAND = 7;

/**
 * The deepest band anybody at this rung can look in.
 */
export function depthBandReachableBy(ordinal: number): number {
    return Math.max(0, Math.min(DEEPEST_BAND, Math.floor(ordinal / ORDINALS_PER_BAND)));
}

/** The rung the ground in a band is dangerous at. The floor of what is found there. */
export function floorOrdinalForBand(band: number): number {
    return clampOrdinal(band * ORDINALS_PER_BAND);
}

// ─────────────────────────────────────────────────────────────────────────
// EFFORT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rung at which somebody is any use on a survey.
 */
export const PROSPECTING_FLOOR_ORDINAL = 3;

/** Cultivators to a party. Eight, which is what a house sends and can feed. */
export const PROSPECTORS_PER_PARTY = 8;

/**
 * Chance per party-year of a find in unworked ground.
 */
export const EASY_FIND_ODDS_PER_PARTY_YEAR = 0.0022;

/**
 * Finds before the rate in a province has halved.
 */
export const FINDS_BEFORE_THE_RATE_HALVES = 5;

export interface ProvinceProspect {
    regionId: string;
    /** Parties out looking, which is people over `PROSPECTORS_PER_PARTY`. */
    parties: number;
    /** The deepest band anybody here could survey. */
    reachableBand: number;
    /** The band effort is currently going into, or null when there is none left. */
    workingBand: number | null;
    /** Finds already made in the working band. */
    foundInBand: number;
    /** What the Late Age left in that band, which is fixed for the world's life. */
    inGroundInBand: number;
    /** Everything found under this province, in every band. What the decline reads. */
    foundInProvince: number;
    /**
     * The decline term: what has been found, spread over the bands anybody can
     * reach. A province that can only reach the surface declines on its whole
     * history; the same province once it can reach three bands declines on a
     * third of it, which is what a new play does to a mature basin.
     */
    workedOverBy: number;
    /** Odds of a find this year. Zero when the province is worked out or empty. */
    oddsThisYear: number;
}

/** The region a location sits under, or itself when it is one. */
function regionIdOf(state: WorldState, locationId: string | null): string | null {
    let cursor = locationId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const location = state.locations.find(l => l.id === cursor);
        if (!location) return null;
        if (location.kind === 'region' || location.parentId === null) return location.id;
        cursor = location.parentId;
    }
    return null;
}

/**
 * How many parties are out looking in this province, and how deep they can go.
 */
export function prospectingEffortIn(
    state: WorldState,
    regionId: string
): { parties: number; strongestOrdinal: number } {
    let lookers = 0;
    let strongest = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        if (npc.cultivation.realmOrdinal < PROSPECTING_FLOOR_ORDINAL) continue;
        if (regionIdOf(state, npc.locationId) !== regionId) continue;
        lookers++;
        if (npc.cultivation.realmOrdinal > strongest) strongest = npc.cultivation.realmOrdinal;
    }
    return { parties: lookers / PROSPECTORS_PER_PARTY, strongestOrdinal: strongest };
}

// WHAT THE WORLD'S OWN DEAD LEAVE, WHICH IS MOST OF THE RESERVE

/**
 * The rung at which somebody has a door of their own and something behind it.
 */
export const RUNG_AT_WHICH_SOMEBODY_HAS_A_DOOR = 8;

/**
 * How many of the dead arranged it rather than simply stopping.
 */
export const SHARE_OF_THE_DEAD_WHO_ARRANGED_IT = 0.45;

/**
 * How thin a formation has to get before anybody can tell the place is there.
 */
export const FINDABLE_ONCE_INTEGRITY_FALLS_BELOW = 0.85;

/** What a dead cultivator left, and what state it is in now. */
export interface ClosedGroundLeftByTheDead {
    occupantId: string;
    occupantName: string;
    /** The rung they were at, which decides everything downstream. */
    ordinal: number;
    yearsSince: number;
    /** True where they saw it coming and arranged it. See `SHARE_OF_THE_DEAD_WHO_ARRANGED_IT`. */
    arranged: boolean;
    /** True where they went through the Lid, which is the great end of the scale. */
    crossed: boolean;
    wardIntegrity: number;
    origin: RuinOrigin;
    intent: IntentStanding;
    scale: RuinScale;
}

/**
 * How big a thing somebody at this rung leaves.
 */
export function scaleLeftBySomebodyAt(ordinal: number): RuinScale {
    if (ordinal >= 37) return 'a_mountain';
    if (ordinal >= 29) return 'a_compound';
    if (ordinal >= 21) return 'a_building';
    return 'one_room';
}

/**
 * Everybody under this province who has left closed ground behind them, and whose
 * door has thinned enough for anybody to know it is there.
 */
export function whatTheDeadLeftUnder(
    state: WorldState,
    regionId: string,
    nowYear: number
): ClosedGroundLeftByTheDead[] {
    const out: ClosedGroundLeftByTheDead[] = [];
    const crossed = new Set(state.ascensions.map(a => a.residentId));

    for (const npc of state.npcs) {
        if (npc.status === 'alive') continue;
        const ordinal = npc.cultivation.realmOrdinal;
        if (ordinal < RUNG_AT_WHICH_SOMEBODY_HAS_A_DOOR) continue;
        if (regionIdOf(state, npc.locationId) !== regionId) continue;

        const diedOn = npc.diedOnDay ?? npc.identity.bornOnDay;
        const yearsSince = Math.max(0, nowYear - Math.floor(diedOn / 365));
        const integrity = wardIntegrityOf({ setByOrdinal: ordinal, yearsSince });
        if (integrity >= FINDABLE_ONCE_INTEGRITY_FALLS_BELOW) continue;

        const wentThrough = crossed.has(npc.id);
        // Deterministic per person, so the same world always says the same
        // thing about the same body and a replay agrees with itself.
        const arranged = wentThrough
            // Divestment is what an ascension DOES. Everybody who crosses
            // arranges, because they know years in advance and none of what
            // they hold will buy anything on the far side.
            || forStream('divested', npc.id).chance(SHARE_OF_THE_DEAD_WHO_ARRANGED_IT);

        out.push({
            occupantId: npc.id,
            occupantName: npc.name,
            ordinal,
            yearsSince,
            arranged,
            crossed: wentThrough,
            wardIntegrity: integrity,
            origin: arranged ? 'left_addressed' : 'a_door_nobody_opened_again',
            // AND THIS IS THE CONVERGENCE. An arrangement binds while the
            // formation enforcing it is still up, and stops binding when it is
            // not. Nothing reclassifies the place; the thing that was doing the
            // sorting simply stops being able to refuse anybody.
            intent: !arranged
                ? 'never_addressed'
                : wardConditionOf(integrity) === 'nearly_gone' || wardConditionOf(integrity) === 'a_wall'
                    ? 'lapsed'
                    : 'addressed',
            scale: scaleLeftBySomebodyAt(ordinal)
        });
    }

    // Thinnest doors first, which is the order anybody actually finds them in.
    return out.sort((a, b) => a.wardIntegrity - b.wardIntegrity);
}

/**
 * Whether there is somebody alive behind this door.
 */
export function isSomebodyStillAliveInThere(
    state: WorldState,
    location: LocationRecord
): { occupied: boolean; occupantId: string | null } {
    const occupantId = location.data.occupantId;
    if (typeof occupantId === 'string') {
        const npc = state.npcs.find(n => n.id === occupantId);
        return { occupied: npc?.status === 'alive', occupantId };
    }
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        if (npc.locationId !== location.id) continue;
        return { occupied: true, occupantId: npc.id };
    }
    return { occupied: false, occupantId: null };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS IN THE GROUND
// ─────────────────────────────────────────────────────────────────────────

/** The `data` key a province's tally for one band lives on. */
export function foundKeyForBand(band: number): string {
    return `ruinsFound:${band}`;
}

/**
 * What the Late Age left under this province, in this band.
 */
export function ruinsInGroundUnder(region: LocationRecord, band: number): number {
    const rng = forStream('ruins-in-ground', region.id, String(band));
    // Deeper ground holds less of what anybody would call a ruin, because the
    // Late Age built on the surface like everybody else.
    const taper = 1 - band * 0.09;
    return Math.max(4, Math.round((18 + rng.int(0, 26)) * taper));
}

/**
 * Where a province stands: how hard it is being looked at, how deep, and what the
 * odds of a find are this year.
 */
export function prospectFor(state: WorldState, region: LocationRecord): ProvinceProspect {
    const { parties, strongestOrdinal } = prospectingEffortIn(state, region.id);
    const reachableBand = depthBandReachableBy(strongestOrdinal);

    // Effort goes to the least-worked band anybody can reach, shallowest first
    // on a tie. That is the easy ground going first, and it is also why a
    // province whose ladder has just produced somebody deeper steps its rate
    // back up: the new band is unworked and therefore outbids the old one.
    let workingBand: number | null = null;
    let foundInBand = 0;
    let inGroundInBand = 0;
    for (let band = 0; band <= reachableBand; band++) {
        const inGround = ruinsInGroundUnder(region, band);
        const found = Number(region.data[foundKeyForBand(band)] ?? 0);
        if (found >= inGround) continue;
        if (workingBand === null || found < foundInBand) {
            workingBand = band;
            foundInBand = found;
            inGroundInBand = inGround;
        }
    }

    const foundInProvince = foundUnder(region);
    const workedOverBy = foundInProvince / (reachableBand + 1);
    const odds = workingBand === null || parties <= 0
        ? 0
        : (parties * EASY_FIND_ODDS_PER_PARTY_YEAR) / (1 + workedOverBy / FINDS_BEFORE_THE_RATE_HALVES);

    return {
        regionId: region.id,
        parties,
        reachableBand,
        workingBand,
        foundInBand,
        inGroundInBand,
        foundInProvince,
        workedOverBy,
        oddsThisYear: Math.min(1, odds)
    };
}

// WHAT SORT OF THING GETS FOUND, AND HOW IT IS CLOSED

/**
 * What turns up at each depth.
 */
export const CHARACTERS_BY_BAND: readonly (readonly RuinCharacter[])[] = [
    ['waystation', 'open_ground', 'cut', 'battlefield'],
    ['waystation', 'open_ground', 'dwelling', 'physic_garden', 'battlefield'],
    ['compound', 'workshop', 'physic_garden', 'cut', 'scar'],
    ['compound', 'workshop', 'teaching_hall', 'array_anchor', 'scar'],
    ['archive', 'vault', 'ossuary', 'array_anchor', 'teaching_hall'],
    ['archive', 'vault', 'ossuary', 'compound']
];

/**
 * Hazards a character actually has, so a minted ruin reads to every system that
 * already switches on hazards the way an authored one would.
 */
const HAZARDS_BY_CHARACTER: Readonly<Record<RuinCharacter, readonly string[]>> = {
    compound: ['formation', 'guardian'],
    workshop: ['corrosive', 'formation'],
    archive: ['formation', 'sealed_qi'],
    vault: ['formation', 'sealed_qi', 'guardian'],
    battlefield: ['formation', 'pressure'],
    scar: ['lightning', 'thin_qi'],
    waystation: ['beasts'],
    physic_garden: ['beasts', 'corrosive'],
    array_anchor: ['pressure', 'formation'],
    ossuary: ['sealed_qi', 'guardian'],
    teaching_hall: ['formation'],
    cut: ['pressure', 'thin_qi'],
    dwelling: ['formation'],
    open_ground: []
};

/**
 * How a find is closed, given how deep it is and what sort of place it is.
 */
function accessForFind(
    character: RuinCharacter,
    band: number,
    rng: CultivationRNG
): RuinAccess {
    const floor = floorOrdinalForBand(band);

    const capable: readonly RuinCharacter[] = [
        'physic_garden', 'vault', 'cut', 'dwelling', 'workshop', 'archive'
    ];
    if (capable.includes(character) && rng.chance(0.22)) {
        // A fitting built for a house's own people, which has a range because
        // every measuring instrument has one.
        const ceiling = clampOrdinal(Math.max(floor + 2, floor + 6 + rng.int(0, 8)));
        return {
            admits: 'nobody_above_the_line',
            floorOrdinal: floor,
            ceilingOrdinal: ceiling,
            whatReadsThePerson:
                'A working fitting the house put here for its own people, which measures whoever is standing at it because that is what it was built to do and nobody ever asked it to do anything else.',
            whyItRefusesPower:
                'It is an instrument with a range rather than a defence with a threshold. Past the top of its range it does not read a stronger claimant as a stronger claimant, it reads nothing at all, and a thing that reads nothing does not open.',
            soWhoGoesInstead:
                'Somebody the party can spare who is small enough to be read, which is the standing practice of every house that has worked one of these and is written into nobody\'s procedure in those words.'
        };
    }

    if (band >= 4 && rng.chance(0.5)) {
        return {
            admits: 'elders_and_above',
            floorOrdinal: clampOrdinal(Math.max(ELDER_FLOOR_ORDINAL, floor)),
            whyNobodyBelowComesBack:
                'The approach rather than the door. Ground at this depth is under something that has to be held apart for as long as anybody is inside it, and a party that splits the holding between two people finds out that the holding is the whole job.',
            whoTheyGoFor:
                'The junior the elder is bringing up, who is stopped at a wall that what is down there answers and who cannot make the approach.',
            whatComesBackForThatPerson:
                'Something sized for somebody two realms below the person carrying it out, which is the only reason anybody at that height goes into a hole at all.'
        };
    }

    return {
        admits: 'anyone_who_survives_it',
        floorOrdinal: floor,
        whatIsDownThere:
            'What the house left when it stopped, at the setting it was left at, still doing whatever it was doing on the last day anybody was here to watch it.',
        whatItDoesToSomebodyShortOfIt:
            'The same thing it does to everybody, which is the point of a minimum: nothing forbids the entry, nothing announces itself, and the question of whether this was a good idea is settled on the way out rather than at the door.'
    };
}

// NAMING

const NAMES_BY_CHARACTER: Readonly<Record<RuinCharacter, readonly string[]>> = {
    compound: ['The Compound With Its Formations Out', 'The Seat Nobody Came Back To', 'The Walls Above %P'],
    workshop: ['The Floor With the Stock Still On It', 'The Cold Furnace Above %P', 'The Workshop They Swept First'],
    archive: ['The Shelves Under the Fall', 'The Room They Left the Lamps In', 'The Order On the Shelves at %P'],
    vault: ['The Door That Was Not Worth Breaking', 'The Undercroft Under %P', 'The Store With the Lid Still On'],
    battlefield: ['The Field the Crop Line Goes Round', 'Where Both of Them Stopped', 'The Ground Above %P Nobody Ploughs'],
    scar: ['The Fused Ground Above %P', 'The Line Where the Grass Stops', 'The Sheet Nobody Crosses Twice'],
    waystation: ['The Post Above the Ford', 'The Relay With the Board Still Up', 'The Bridge House At %P'],
    physic_garden: ['The Beds Under the Turf', 'The Wall Round the Old Physic', 'The Garden Above %P'],
    array_anchor: ['The Stone That Is Still Carrying', 'The Node Nobody Lit', 'The Anchor Above %P'],
    ossuary: ['The Walled Plot At %P', 'The Chamber With the Course Cut Over It', 'The Ten They Put Together'],
    teaching_hall: ['The Curriculum Cut Into the Face', 'The Hall They Taught Out Of', 'The Wall Above %P With the Exercises On It'],
    cut: ['The Working Face At %P', 'The Shaft With the Ladders Out', 'The Cut They Laid a Lid Over'],
    dwelling: ['The Rooms Somebody Lived In', 'The Cave Above %P With the Lintel Cut', 'The Seat Chamber Nobody Emptied'],
    open_ground: ['The Ground Above %P', 'The Stone in the Long Field', 'The Depression Nothing Grows In']
};

/** A place name a person would use, derived from the province and the character. */
export function nameForFind(
    region: LocationRecord,
    character: RuinCharacter,
    rng: CultivationRNG
): string {
    const templates = NAMES_BY_CHARACTER[character];
    const template = templates[rng.int(0, templates.length - 1)];
    const place = region.name.replace(/^(?:the|The)\s+/, '').replace(/\s*\(region\)\s*$/i, '');
    return template.replace('%P', place);
}

// A NAMER MUST NEVER BE FED ITS OWN OUTPUT

/** Marks a place minted as a room INSIDE another. Never a seat in its own right. */
export const INNER_ROOM_TAG = 'inner-room';

/**
 * Wrappers this module applies to a place name, so they can be recognised and
 * stripped rather than stacked.
 */
const NAME_WRAPPERS: readonly { prefix: string; suffix: string }[] = [
    { prefix: 'The Door At ', suffix: ' That Nobody Left Could Open' }
];

/**
 * The underlying place, with any decoration this module applied taken back off.
 */
export function baseNameOf(location: LocationRecord): string {
    const stored = location.data.baseName;
    if (typeof stored === 'string' && stored.length > 0) return stored;
    return undecorate(location.name);
}

/** Strip every layer of every known wrapper. Terminates: each pass shortens. */
export function undecorate(name: string): string {
    let out = name;
    for (let guard = 0; guard < 64; guard++) {
        let changed = false;
        for (const { prefix, suffix } of NAME_WRAPPERS) {
            if (out.startsWith(prefix) && out.endsWith(suffix)) {
                out = out.slice(prefix.length, out.length - suffix.length);
                changed = true;
            }
        }
        if (!changed) break;
    }
    return out.trim();
}

/**
 * Apply a wrapper exactly once, whatever it is handed.
 */
export function decorateOnce(base: string, wrapper: { prefix: string; suffix: string }): string {
    const root = undecorate(base);
    return `${wrapper.prefix}${root}${wrapper.suffix}`;
}

/** The inner-room name, built from the underlying place and never from itself. */
export function nameForInnerRoom(seat: LocationRecord): string {
    return decorateOnce(baseNameOf(seat), NAME_WRAPPERS[0]);
}

/**
 * Repair a world that is already carrying compounded names.
 */
export function repairCompoundedNames(state: WorldState): number {
    let repaired = 0;
    for (let i = 0; i < state.locations.length; i++) {
        const location = state.locations[i];
        // ONLY DECORATED PLACES. An earlier draft of this fell through to every
        // location in the world so that it could stamp `baseName` on all of
        // them, which writes a key onto seven hundred settlements and provinces
        // that have nothing to do with this module. A repair pass should touch
        // what is broken and nothing else.
        const decorated = NAME_WRAPPERS.some(
            w => location.name.startsWith(w.prefix) && location.name.endsWith(w.suffix)
        );
        if (!decorated) continue;

        // One layer is correct and is left alone. More than one is the defect.
        const root = undecorate(location.name);
        const wanted = decorateOnce(root, NAME_WRAPPERS[0]);
        const subjectStale = typeof location.data.daoSubject === 'string'
            && location.data.daoSubject !== wanted;
        if (wanted === location.name && typeof location.data.baseName === 'string' && !subjectStale) {
            continue;
        }

        const data: LocationRecord['data'] = { ...location.data, baseName: root };
        if (subjectStale) data.daoSubject = wanted;
        if (wanted !== location.name) repaired++;
        state.locations[i] = { ...location, name: wanted, data };
    }
    return repaired;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

export interface RuinFind {
    locationId: string;
    regionId: string;
    name: string;
    character: RuinCharacter;
    /** Where it came from. A floor rather than a taxonomy - see `RuinOriginSchema`. */
    origin: RuinOrigin;
    /** How big it is, which decides who can take it and whether anybody knows. */
    scale: RuinScale;
    /** How much of the arrangement still binds. Decay moves this and only this. */
    intent: IntentStanding;
    /** Which of the three ways this ground is closed. */
    admits: RuinAccess['admits'];
    floorOrdinal: number;
    ceilingOrdinal: number | null;
    depthBand: number;
    /** True where the entrant is not the person who gains. Cap or elder floor. */
    someoneElseBenefits: boolean;
    /**
     * Whether the world already held a record for this place.
     */
    provenance: 'already_here' | 'newly_described';
}

export interface ProspectingResult {
    found: RuinFind[];
    /** Provinces that had anybody looking at all this year. */
    provincesWorked: number;
    /** Provinces whose reachable ground is exhausted. Rare, and it is real. */
    provincesWorkedOut: number;
}

/** The `data` key a minted find carries, so the world can tell one from a seeded ruin. */
export const FOUND_BY_PROSPECTING_TAG = 'found-by-prospecting';

/**
 * A year of the world looking for what the Late Age left.
 */
export function applyRuinProspecting(
    state: WorldState,
    year: number,
    day: number
): ProspectingResult {
    const result: ProspectingResult = { found: [], provincesWorked: 0, provincesWorkedOut: 0 };
    // Worlds are persisted, so fixing the generator does not fix the rows it
    // already wrote. Idempotent and cheap, so an affected world heals on its
    // next tick rather than needing anybody to migrate it by hand.
    repairCompoundedNames(state);
    const rng = forStream(state.seed, 'ruins-found', year);
    // Bodies whose ground the world has already turned up. Read off the
    // locations rather than kept, so a reload cannot lose it and two finds can
    // never be the same person's cave.
    const claimedOccupants = new Set<string>();
    for (const l of state.locations) {
        if (typeof l.data.occupantId === 'string') claimedOccupants.add(l.data.occupantId);
    }

    for (let i = 0; i < state.locations.length; i++) {
        const region = state.locations[i];
        if (region.kind !== 'region' || !isBelowTheLid(region)) continue;

        const prospect = prospectFor(state, region);
        if (prospect.parties > 0) result.provincesWorked++;
        if (prospect.workingBand === null) {
            // Nothing left in reach. Not the same as nobody looking, and the
            // two are counted separately because they look identical in a
            // single figure and mean opposite things.
            if (prospect.parties > 0) result.provincesWorkedOut++;
            continue;
        }
        if (!rng.chance(prospect.oddsThisYear)) continue;

        const band = prospect.workingBand;
        const findRng = forStream(state.seed, 'ruin-find', region.id, String(year));

        // WHAT THE WORLD'S OWN DEAD LEFT
        const left = whatTheDeadLeftUnder(state, region.id, year)
            .filter(one => !claimedOccupants.has(one.occupantId));
        if (left.length > 0 && findRng.chance(0.6)) {
            const one = left[0];
            claimedOccupants.add(one.occupantId);
            const minted = mintGroundLeftByTheDead(region, one, day, year, findRng);
            state.locations.push(minted.location);
            state.locations[i] = {
                ...region,
                data: { ...region.data, [foundKeyForBand(band)]: prospect.foundInBand + 1 }
            };
            result.found.push(minted.find);
            continue;
        }

        // AN EMPTY SEAT
        const seat = findFallenSeatUnder(state, region.id);
        if (seat) {
            const ending = howTheHouseEnded(state, seat);
            const at = state.locations.indexOf(seat);
            state.locations[at] = {
                ...seat,
                discovered: true,
                discoveredOnDay: day,
                data: {
                    ...seat.data,
                    foundInYear: year,
                    ruinOrigin: 'abandoned_by_a_house',
                    ruinScale: 'a_mountain',
                    intentStanding: 'never_addressed',
                    ruinCharacter: 'compound',
                    // The four questions, answered off the world's own record
                    // of the fall rather than drawn. See `howTheHouseEnded`.
                    howItEnded: ending.ending,
                    strippedShare: ending.strippedShare,
                    theRecordsSurvive: ending.theRecordsSurvive,
                    whatAPartyFinds: ending.whatAPartyFinds
                }
            };

            // AND THE ONE DOOR NOBODY COULD OPEN. When the leadership was killed,
            // the vault is intact because the people who could reach it are the
            // reason there was a hurry - so it is a SEPARATE piece of closed ground
            // inside a picked-over mountain, running down on its own schedule at
            // the rung of the people who sealed it. The day it finally fails is a
            // much later find and a very good century for whoever is standing
            // there.
            if (ending.theVaultIsStillShut) {
                const vaultOrdinal = clampOrdinal(Math.max(seat.thresholds.mastery, 20));
                const vaultId = `${seat.id}-vault`;
                if (!state.locations.some(l => l.id === vaultId)) {
                    const vault = makeLocation({
                        id: vaultId,
                        // From the UNDERLYING PLACE, never from whatever the
                        // last pass wrote here. See `nameForInnerRoom`.
                        name: nameForInnerRoom(seat),
                        kind: 'ruin',
                        parentId: seat.id,
                        layer: seat.layer,
                        description:
                            'An inner room in a mountain that has otherwise been gone over by everybody, still shut, because the people who were authorised to open it and the people who knew how were the same people and they died on the same afternoon.',
                        ambient: seat.ambient,
                        qiDensity: clampQiDensity(seat.qiDensity + 15),
                        thresholds: makeThresholds(
                            Math.max(0, vaultOrdinal - 4), vaultOrdinal,
                            clampOrdinal(vaultOrdinal + 2), clampOrdinal(vaultOrdinal + 4)
                        ),
                        hazards: HAZARDS_BY_CHARACTER.vault.slice(),
                        environment: makeEnvironment({
                            spiritualDensity: 0.05,
                            danger: 0.8,
                            resources: ['manuals'],
                            climate: 'sunless',
                            politicalControl: 'whoever gets in'
                        }),
                        sealed: true,
                        // NOT found. The mountain is found; the vault is the
                        // thing the mountain has instead of a bottom, and it
                        // becomes findable when its own formation thins.
                        discovered: false,
                        // NOT `ruined`. An inner room is not a fallen seat, and
                        // tagging it as one put it straight back into the pool
                        // `findFallenSeatUnder` draws from - so the next pass
                        // treated this vault as a seat, minted a vault inside
                        // it, and wrapped the name again. That is the whole of
                        // the fourteen-layer defect and this line is the fix.
                        tags: ['ruin', INNER_ROOM_TAG, 'ruin-character:vault'],
                        data: {
                            ruinCharacter: 'vault',
                            ruinOrigin: 'abandoned_by_a_house',
                            ruinScale: 'a_building',
                            intentStanding: 'never_addressed',
                            setByOrdinal: vaultOrdinal,
                            depthBand: depthBandReachableBy(vaultOrdinal),
                            // The clean root, so no later pass has to recover
                            // one by unwrapping.
                            baseName: baseNameOf(seat)
                        }
                    });
                    vault.origin.fromDay = seat.origin.fromDay;
                    state.locations.push(vault);
                }
            }
            state.locations[i] = {
                ...region,
                data: { ...region.data, [foundKeyForBand(band)]: prospect.foundInBand + 1 }
            };
            result.found.push({
                locationId: seat.id,
                regionId: region.id,
                name: seat.name,
                character: 'compound',
                origin: 'abandoned_by_a_house',
                scale: 'a_mountain',
                intent: 'never_addressed',
                admits: 'anyone_who_survives_it',
                floorOrdinal: seat.thresholds.survival,
                ceilingOrdinal: null,
                depthBand: depthBandReachableBy(seat.thresholds.survival),
                someoneElseBenefits: false,
                provenance: 'already_here'
            });
            continue;
        }

        // THE GROUND THE WORLD ALREADY HELD, FIRST
        const alreadyHere = findUndiscoveredUnder(state, region.id);
        if (alreadyHere) {
            const at = state.locations.indexOf(alreadyHere);
            state.locations[at] = {
                ...alreadyHere,
                discovered: true,
                discoveredOnDay: day,
                data: { ...alreadyHere.data, foundInYear: year }
            };
            state.locations[i] = {
                ...region,
                data: { ...region.data, [foundKeyForBand(band)]: prospect.foundInBand + 1 }
            };
            const character = characterOfSeededRuin(alreadyHere, findRng);
            result.found.push({
                locationId: alreadyHere.id,
                regionId: region.id,
                name: alreadyHere.name,
                character,
                // THE DEEP PAST, AND IT IS THE ONE THING THAT IS NOT RENEWABLE.
                // What the vanished eras left is a fixed quantity and every one
                // opened is gone from it forever, because producing another
                // requires having been an institution of that era and that era is
                // over. The refill above happens at the near end and what it
                // produces is modern - smaller, shallower, and made by people the
                // current ladder can account for. A world where prospecting
                // eventually turns up another peak-era inheritance has quietly made
                // the past infinite, and the past is the one thing that is not.
                origin: 'abandoned_by_a_house',
                scale: 'a_compound',
                intent: 'never_addressed',
                admits: 'anyone_who_survives_it',
                floorOrdinal: alreadyHere.thresholds.survival,
                ceilingOrdinal: null,
                depthBand: depthBandReachableBy(alreadyHere.thresholds.survival),
                someoneElseBenefits: false,
                provenance: 'already_here'
            });
            continue;
        }

        const characters = CHARACTERS_BY_BAND[Math.min(band, CHARACTERS_BY_BAND.length - 1)];
        const character = characters[findRng.int(0, characters.length - 1)];
        const access = accessForFind(character, band, findRng);
        const name = nameForFind(region, character, findRng);
        const floor = access.floorOrdinal;

        const id = `loc-found-${region.id}-${band}-${prospect.foundInBand + 1}`;
        if (state.locations.some(l => l.id === id)) continue;

        const density = clampQiDensity(region.qiDensity + 10 + band * 8);
        const found = makeLocation({
            id,
            name,
            kind: 'ruin',
            parentId: region.id,
            layer: region.layer,
            description:
                `${name}. Nobody put this here recently: it has been under this province since the ` +
                `Late Age and what changed is that somebody found it.`,
            ambient: density >= 80 ? 'dense' : region.ambient,
            qiDensity: density,
            thresholds: makeThresholds(
                Math.max(0, floor - 4),
                floor,
                clampOrdinal(floor + 3),
                clampOrdinal(floor + 6)
            ),
            hazards: HAZARDS_BY_CHARACTER[character].slice(),
            affinities: [
                makeAffinity('formation', 1.2, 2, 'Whatever was laid here is still laid here.')
            ],
            environment: makeEnvironment({
                // Sealed, so what the pocket holds and what anybody can reach
                // are different numbers. That gap is the economy of going in
                // and it is the same one `locationFromRuin` describes.
                spiritualDensity: 0.05,
                danger: Math.min(1, 0.4 + band * 0.1),
                resources: ['qi', 'manuals'],
                climate: 'sunless',
                politicalControl: 'whoever gets in',
                specialRules: [],
                knownSecrets: [],
                historicalScars: []
            }),
            sealed: true,
            sealedOnDay: null,
            // Found. That is the whole of what this pass does: the ruin was
            // always here and is now on somebody's map.
            discovered: true,
            discoveredOnDay: day,
            tags: ['ruin', 'late_age', FOUND_BY_PROSPECTING_TAG, `ruin-character:${character}`],
            data: {
                ruinCharacter: character,
                admits: access.admits,
                floorOrdinal: floor,
                ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
                depthBand: band,
                foundInYear: year
            }
        });
        found.origin.fromDay = day;
        state.locations.push(found);

        // The tally is on the province, because the province is what gets
        // worked out. One integer per band and nothing else: a second table
        // keyed by province would drift from the locations it is describing.
        state.locations[i] = {
            ...region,
            data: {
                ...region.data,
                [foundKeyForBand(band)]: prospect.foundInBand + 1
            }
        };

        result.found.push({
            locationId: id,
            regionId: region.id,
            name,
            character,
            admits: access.admits,
            floorOrdinal: floor,
            ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
            depthBand: band,
            origin: ORIGIN_BY_CHARACTER[character],
            scale: SCALE_BY_BAND[Math.min(band, SCALE_BY_BAND.length - 1)],
            // The deep past never had an intent to lose. Only an arrangement
            // somebody made can lapse, and nobody arranged this.
            intent: 'never_addressed',
            someoneElseBenefits: access.admits !== 'anyone_who_survives_it',
            provenance: 'newly_described'
        });
    }

    return result;
}

/**
 * What sort of ending a character implies, where the world has no record of one.
 */
const ORIGIN_BY_CHARACTER: Readonly<Record<RuinCharacter, RuinOrigin>> = {
    compound: 'abandoned_by_a_house',
    teaching_hall: 'abandoned_by_a_house',
    archive: 'abandoned_by_a_house',
    ossuary: 'abandoned_by_a_house',
    vault: 'abandoned_by_a_house',
    workshop: 'overrun_at_work',
    waystation: 'overrun_at_work',
    physic_garden: 'overrun_at_work',
    cut: 'overrun_at_work',
    dwelling: 'a_door_nobody_opened_again',
    battlefield: 'fought_over_and_left',
    array_anchor: 'fought_over_and_left',
    scar: 'what_the_catastrophe_made',
    open_ground: 'what_the_catastrophe_made'
};

/** Deeper ground is bigger ground, because depth is what a big builder buys. */
const SCALE_BY_BAND: readonly RuinScale[] = [
    'one_room', 'a_building', 'a_building', 'a_compound', 'a_compound', 'a_mountain'
];

/**
 * A sealed site under this province that the world has not found yet.
 */
// WHAT HAPPENED, WHO DIED, WHO LEFT, AND WHAT COULD THEY CARRY

export type HowAHouseEnded =
    | 'leadership_killed'
    | 'evacuated'
    | 'stopped_receiving_instructions'
    | 'dissolved';

export interface WhatTheEndingLeaves {
    ending: HowAHouseEnded;
    /** True where nobody left alive could open the inner room. */
    theVaultIsStillShut: boolean;
    /** True where the house's own paper is still on the shelves. */
    theRecordsSurvive: boolean;
    /** How much of the ordinary contents went out of the door, 0..1. */
    strippedShare: number;
    /** The one sentence a party standing in it would use. */
    whatAPartyFinds: string;
}

/**
 * How a house ended, read off its own fall rather than drawn.
 */
export function howTheHouseEnded(
    state: WorldState,
    seat: LocationRecord
): WhatTheEndingLeaves {
    const factionId = seat.controllingFactionId ?? String(seat.data.formerFactionId ?? '');
    const faction = factionId ? state.factions.find(f => f.id === factionId) ?? null : null;

    // Was anybody at the top of this house killed rather than simply dying?
    const leadershipKilled = state.npcs.some(
        n => n.status !== 'alive' && n.factionId === factionId
            && n.factionRankIndex <= 1
            && (n.endNote ?? '').toLowerCase().includes('kill')
    );
    // A seat is the house's own; anything else under the house is a branch.
    const isTheSeat = faction?.seatLocationId === seat.id;

    const ending: HowAHouseEnded = leadershipKilled ? 'leadership_killed'
        : !isTheSeat ? 'stopped_receiving_instructions'
            : seat.changes.some(c => c.kind === 'conquered' || c.kind === 'destroyed') ? 'evacuated'
                : 'dissolved';

    switch (ending) {
        case 'leadership_killed':
            return {
                ending,
                theVaultIsStillShut: true,
                theRecordsSurvive: false,
                strippedShare: 0.85,
                whatAPartyFinds: 'A mountain that has been gone over by everybody who could get up it, and one door in the middle of it that none of them could open, because the people who knew how are the reason there was a hurry.'
            };
        case 'evacuated':
            return {
                ending,
                theVaultIsStillShut: false,
                theRecordsSurvive: false,
                strippedShare: 0.6,
                whatAPartyFinds: 'What nobody could carry. Heavy things, fixed things, buried things, and everything that needed somebody of a rank that had already died to move it, which is a filter nobody applied on purpose.'
            };
        case 'stopped_receiving_instructions':
            return {
                ending,
                theVaultIsStillShut: true,
                theRecordsSurvive: true,
                strippedShare: 0.2,
                whatAPartyFinds: 'A place where nothing happened. It was never the prize, it simply stopped being told anything and ran down, and the records are all still on the shelves because it never occurred to anybody that they were worth destroying.'
            };
        default:
            return {
                ending,
                theVaultIsStillShut: false,
                theRecordsSurvive: true,
                strippedShare: 0.45,
                whatAPartyFinds: 'Nothing broken anywhere. It is a headquarters, so it is big and central and everybody knows where it is, and it emptied because people stopped coming rather than because anything was done to it.'
            };
    }
}

/**
 * A house's seat that the world's own simulation emptied, and nobody has been back
 * to.
 */
function findFallenSeatUnder(state: WorldState, regionId: string): LocationRecord | null {
    for (const location of state.locations) {
        if (!location.tags.includes('ruined')) continue;
        if (location.discovered) continue;
        if (location.tags.includes('emptied')) continue;
        // A room inside a seat is not a seat. Without this the pass mints an
        // inner room, finds it again next year as though it were a fallen
        // house, and mints a room inside THAT - which is how one location
        // ended up with fourteen layers of name on it. Checked here as well as
        // at the tag, because a world already in flight is carrying rooms that
        // were tagged `ruined` before the tag was corrected.
        if (location.tags.includes(INNER_ROOM_TAG)) continue;
        if (location.id.endsWith('-vault')) continue;
        if (regionIdOf(state, location.parentId ?? location.id) !== regionId) continue;
        return location;
    }
    return null;
}

/**
 * Turn one dead cultivator's closed door into a place on the map.
 */
function mintGroundLeftByTheDead(
    region: LocationRecord,
    one: ClosedGroundLeftByTheDead,
    day: number,
    year: number,
    rng: CultivationRNG
): { location: LocationRecord; find: RuinFind } {
    const floor = clampOrdinal(one.ordinal);
    const band = depthBandReachableBy(floor);
    const character: RuinCharacter = one.scale === 'one_room' ? 'dwelling'
        : one.scale === 'a_building' ? (rng.chance(0.5) ? 'dwelling' : 'archive')
            : one.scale === 'a_compound' ? 'compound' : 'vault';

    // An arrangement that still binds sorts applicants, which is a talent-shaped
    // problem. One that has lapsed cannot refuse anybody, so what is left is the
    // ground itself and the ordinary minimum.
    const access: RuinAccess = one.intent === 'addressed'
        ? {
            admits: 'nobody_above_the_line',
            floorOrdinal: Math.max(0, floor - 6),
            ceilingOrdinal: clampOrdinal(floor + 2),
            whatReadsThePerson: `The arrangement ${one.occupantName} left running, which was built to select a successor and is therefore an instrument for measuring somebody about the size they were.`,
            whyItRefusesPower: 'It was calibrated rather than made lethal, and a calibration has a top as well as a bottom. Somebody far above what it was aimed at does not read as a better candidate; they read as off the end of the scale, and the arrangement does not hand anything to a reading it cannot make.',
            soWhoGoesInstead: 'Whoever in the party is nearest the size the builder had in mind, which is a thing a house works out by sending people and losing them until the pattern is obvious.'
        }
        : {
            admits: 'anyone_who_survives_it',
            floorOrdinal: floor,
            whatIsDownThere: `What ${one.occupantName} had when they stopped, where they left it, behind a door that has been thinning ever since and is not thinning any faster because anybody is standing at it.`,
            whatItDoesToSomebodyShortOfIt: 'The formation is still running at whatever is left of the setting it was left at, and it does not know that the person it was protecting is not there. Below the rung it was set at, that is enough.'
        };

    const name = one.scale === 'one_room'
        ? `The Door ${one.occupantName} Did Not Open Again`
        : one.scale === 'a_building'
            ? `What ${one.occupantName} Left Behind the Second Door`
            : `${one.occupantName}'s Seat, With Nobody In It`;

    const location = makeLocation({
        id: `loc-closed-${one.occupantId}`,
        name,
        kind: 'ruin',
        parentId: region.id,
        layer: region.layer,
        description: one.arranged
            ? `${name}. Somebody who could see the end coming put what they had in order and shut the door on it.`
            : `${name}. A door that was shut from the inside and never opened again, with everything still where it was.`,
        ambient: region.ambient,
        qiDensity: clampQiDensity(region.qiDensity + 6 + band * 6),
        thresholds: makeThresholds(
            Math.max(0, floor - 4), floor, clampOrdinal(floor + 2), clampOrdinal(floor + 4)
        ),
        hazards: HAZARDS_BY_CHARACTER[character].slice(),
        environment: makeEnvironment({
            spiritualDensity: 0.05,
            danger: Math.min(1, 0.3 + band * 0.1),
            resources: ['qi', 'manuals'],
            climate: 'sunless',
            politicalControl: 'whoever gets in'
        }),
        sealed: true,
        discovered: true,
        discoveredOnDay: day,
        tags: [
            'ruin', FOUND_BY_PROSPECTING_TAG, `ruin-character:${character}`,
            one.crossed ? 'left-on-the-way-out' : 'left-at-the-end'
        ],
        data: {
            ruinCharacter: character,
            ruinOrigin: one.origin,
            ruinScale: one.scale,
            intentStanding: one.intent,
            // Whose it was. The contents are that person's inventory rather
            // than a table roll, so two centuries later somebody can still find
            // out whose it was - and `isSomebodyStillAliveInThere` reads this.
            occupantId: one.occupantId,
            occupantName: one.occupantName,
            setByOrdinal: one.ordinal,
            wardIntegrity: one.wardIntegrity,
            admits: access.admits,
            floorOrdinal: access.floorOrdinal,
            ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
            depthBand: band,
            foundInYear: year
        }
    });
    location.origin.fromDay = day;

    return {
        location,
        find: {
            locationId: location.id,
            regionId: region.id,
            name,
            character,
            origin: one.origin,
            scale: one.scale,
            intent: one.intent,
            admits: access.admits,
            floorOrdinal: access.floorOrdinal,
            ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
            depthBand: band,
            someoneElseBenefits: access.admits !== 'anyone_who_survives_it',
            provenance: 'newly_described'
        }
    };
}

function findUndiscoveredUnder(state: WorldState, regionId: string): LocationRecord | null {
    let parentless: LocationRecord | null = null;
    for (const location of state.locations) {
        if (location.kind !== 'ruin' || location.discovered) continue;
        if (location.tags.includes('emptied')) continue;
        // The prior ages hang their ruins off nothing: `locationFromRuin` sets no
        // `parentId`, so a seeded site is in the world and in no province.
        // Measured, that made the whole seeded stock unreachable by this pass - a
        // thousand-year run found a hundred and sixteen sites and not one of them
        // was ground the catalog already held. A party from anywhere may claim one,
        // which is both the honest reading (parties travel, and a site nobody can
        // place is exactly the sort somebody stumbles onto) and the only one that
        // does not require re-parenting the seeding pass.
        if (location.parentId === null) {
            if (parentless === null) parentless = location;
            continue;
        }
        if (regionIdOf(state, location.parentId) !== regionId) continue;
        return location;
    }
    return parentless;
}

/**
 * What sort of place a seeded ruin turns out to be.
 */
export function characterOfSeededRuin(
    location: LocationRecord,
    rng: CultivationRNG
): RuinCharacter {
    if (location.kind === 'grave') return 'ossuary';
    if (location.hazards.includes('lightning')) return 'scar';
    if (location.hazards.includes('guardian') && location.hazards.includes('sealed_qi')) return 'vault';
    if (location.hazards.includes('guardian')) return 'compound';
    if (location.hazards.includes('corrosive')) return 'workshop';
    const band = depthBandReachableBy(location.thresholds.survival);
    const characters = CHARACTERS_BY_BAND[Math.min(band, CHARACTERS_BY_BAND.length - 1)];
    return characters[rng.int(0, characters.length - 1)];
}

/**
 * Everything the world currently knows about and has not emptied.
 */
export function standingReserve(state: WorldState): LocationRecord[] {
    return state.locations.filter(
        l => l.kind === 'ruin' && l.sealed && l.discovered && !l.tags.includes('emptied')
    );
}

/** What this province has found, across every band. Used for the worked-out reading. */
export function foundUnder(region: LocationRecord): number {
    let total = 0;
    for (let band = 0; band <= DEEPEST_BAND; band++) {
        total += Number(region.data[foundKeyForBand(band)] ?? 0);
    }
    return total;
}

/** And what is left in it, across every band. Finite, and stated. */
export function stillInGroundUnder(region: LocationRecord): number {
    let total = 0;
    for (let band = 0; band <= DEEPEST_BAND; band++) {
        total += Math.max(0, ruinsInGroundUnder(region, band)
            - Number(region.data[foundKeyForBand(band)] ?? 0));
    }
    return total;
}
