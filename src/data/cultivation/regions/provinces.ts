/**
 * The provinces as a political layer - who holds from whom, and where - plus
 * every lookup over that layer and the prefectures and arterials beneath it.
 *
 * WHY ALL SIX ROWS ARE STILL IN ONE TABLE, when the map rows were split.
 * -----------------------------------------------------------------------
 * A row that belongs to a comparative table stays in the table; a subtree that
 * belongs to one place goes with that place. `PROVINCES` is one shape read six
 * ways, and four of its rows - Coldwater Cut, Hammerfall, the Sixteen Faces
 * and Greyhold - are driven provinces with no `Region` at all and therefore no
 * file to go to. Moving the two mapped rows out would leave a comparative
 * table with holes in it and nothing gained. Prefectures went the other way
 * for the same reason read the other direction: they are a subtree of exactly
 * one province each.
 *
 * The lookups are here rather than split across `prefectures.ts` and
 * `arterials.ts` because they share three private indices and answer each
 * other - `provinceForFaction` is `prefectureForFaction` plus one hop.
 * Splitting them would mean exporting the indices, which is adding surface
 * rather than moving code.
 */

import { z } from 'zod';
import { REGION_NAME } from '../place-names.js';
import { ARTERIALS, type Arterial } from './arterials.js';
import { PREFECTURES, type Prefecture } from './prefectures.js';
import {
    ADJACENT_REGION_ID,
    HOME_REGION_ID,
    LOW_FALL_PROVINCE_ID,
    QUIET_MARCHES_PROVINCE_ID
} from './region-ids.js';
import { LOW_FALL_PREFECTURES } from './low-fall.js';
import { QUIET_MARCHES_PREFECTURES } from './quiet-marches.js';

// ─────────────────────────────────────────────────────────────────────────
// PROVINCES, ARTERIALS AND PREFECTURES
//
// The tier below the apexes, made concrete. `FACTION_PARENTAGE` already says
// who holds from whom; this says WHERE, so that a grant is a place somebody
// can stand in rather than a line in a record.
//
// NOTHING HERE IS NEW GEOGRAPHY. Every name below was already forced by a
// number somewhere else in the catalog and has simply never been said out
// loud:
//
//   - the Deep Survey `holds` four arterials beneath the Low Fall, and there
//     are four Surveyors, one per arterial. So there are four arterials, and
//     they are named here.
//   - the Long Cut holds driven ground across FIVE provinces and the Ninth
//     Face Court administers "the Quiet Marches and four provinces beyond it".
//     So there are five, and Chi Yuanru's schedule bands are what tells them
//     apart.
//   - `court-third-sill` administers the third arterial, sits in the Low Fall,
//     and its `apexId` is `apex-long-cut`. That is not a note about a court.
//     It means the arterial that every surveyed vein in the Deep Survey's one
//     province branches from is administered by the other apex, and neither
//     of them has ever said so in a document.
//
// THE ASYMMETRY IS THE FINDING, and it was sitting in the data. The Long Cut
// is broad and shallow: five provinces, forty staff, everything administered
// directly, nothing delegated. The Deep Survey is narrow and deep: ONE
// province, four arterials under it, a filled ladder, and a storehouse it has
// already spent. An apex is not a bigger sect, and the two of them are not
// even the same shape.
//
// CONTRAST, NOT ADDITION
// ----------------------
// `docs/world/places/making-places-different.md` names the failure this section is
// most likely to commit: a gazetteer of interchangeable places with the proper
// nouns swapped. Two defences are built in.
//
//   1. A PREFECTURE IS NOT THE SAME KIND OF OBJECT IN THE TWO PROVINCES, and
//      the difference falls out of each region's governing fact rather than
//      being decorated on afterwards. The Low Fall's qi is in horizontal
//      surveyable veins, so a Low Fall prefecture is a CATCHMENT: a line on a
//      survey, held by a named institution with a gate, arbitrable, permanent,
//      inheritable, and argued about in writing. The Marches' qi is in the
//      stone, so a Marches prefecture is a FACE DISTRICT: a schedule entry
//      held by an OFFICE rather than by a sect, whose boundary is wherever the
//      work currently is, which moves when the work moves and stops existing
//      when the stone runs out. Crossing the border does not change what the
//      places are called. It changes what a place IS.
//
//   2. THE PROVINCES NOBODY HAS BEEN TO ARE THIN ON PURPOSE. The four driven
//      provinces past the Marches carry a name, a holder and one fact each,
//      and the one fact is a band in a schedule kept by one woman - which is
//      a single generic system telling five places apart, not five bespoke
//      descriptions. Their thinness is also diegetic: it is exactly what
//      anybody in either played province knows about them, which is a name
//      and a rumour of a queue position.
//
// HOLDING ON PAPER IS NOT HOLDING IN FACT
// ---------------------------------------
// `the-late-age.md`: every institution is operating a fraction of what it
// inherited. So `onPaper` and `onTheGround` are separate fields on every
// prefecture and they are allowed to disagree, in both directions - a house
// that holds less than the record says is the common case, and a house that
// holds more than any document mentions is the Longbough Grove. `discrepancy`
// names which kind, and the catalog test asserts that a prefecture claiming
// `none` really does read the same in both fields.
//
// NO ARITHMETIC HERE. Nothing in this section decides who would win a dispute
// over a boundary, what a catchment is worth, or how many houses it takes to
// move one. Those are questions for the resolvers. This is a statement about
// what is standing where.
// ─────────────────────────────────────────────────────────────────────────

/** Whether a province is written to, or named and nothing else. */
export const ProvinceStandingSchema = z.enum([
    /** Written to. It has a `Region` above, with places, customs and a method. */
    'played',
    /**
     * Named and nothing else, deliberately. Somebody in the catalog knows it
     * exists because a number in their own records refers to it; nobody the
     * player can reach has been there.
     */
    'named_only'
]);
export type ProvinceStanding = z.infer<typeof ProvinceStandingSchema>;

export const ProvinceSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    standing: ProvinceStandingSchema,
    /** The `REGIONS` row, where one exists. Null for the named-only ones. */
    regionId: z.string().nullable(),
    /** The apex that holds it. Never a court: courts administer, apexes hold. */
    heldByApexId: z.string(),
    /** The court the holding is administered THROUGH, where there is one. */
    administeredByCourtId: z.string().nullable(),
    /**
     * The one physical fact everything else follows from. For a played
     * province this restates the region's own `governingFact` so the two
     * tiers cannot drift; for a named-only one it is all there is.
     */
    governingFact: z.string().min(40),
    /** What the holder's own records say it holds here. */
    onPaper: z.string().min(40),
    /** What it actually walks. Frequently smaller. Occasionally larger. */
    onTheGround: z.string().min(40),
    /** Prefecture ids seated in it, in the order the local record lists them. */
    prefectureIds: z.array(z.string()),
    /**
     * Named-only provinces: what anybody in a played province actually knows,
     * which is usually one number out of one schedule. Null for played ones.
     */
    whatIsKnownOfIt: z.string().min(40).nullable(),
    startingAwareness: z.enum(['unaware', 'whisper', 'named', 'placed', 'encountered', 'known'])
});
export type Province = z.infer<typeof ProvinceSchema>;

// ─── the provinces ───────────────────────────────────────────────────────

export const PROVINCES: readonly Province[] = [
    {
        id: LOW_FALL_PROVINCE_ID,
        name: REGION_NAME.LOW_FALL,
        standing: 'played',
        regionId: HOME_REGION_ID,
        heldByApexId: 'apex-deep-survey',
        administeredByCourtId: 'court-kiln',
        governingFact:
            'The veins here are horizontal, shallow and surveyable, so the qi belongs to whoever holds the surface above it - and the surface has been held continuously for four hundred years.',
        onPaper:
            'The Deep Survey holds the arterial system and the province standing on it: four arterials, eleven surveyed veins, seventeen institutions, and a datum nobody local can place.',
        onTheGround:
            'Two of the four arterials have no administrator, one is a datum nobody draws on, and the fourth - the only one anything branches from - is administered by a court that answers to the Long Cut. The Survey holds one province and is present on two catchments of it, and both of those two are over the northern watershed and have been for as long as anybody has walked them.',
        prefectureIds: LOW_FALL_PREFECTURES.map(p => p.id),
        whatIsKnownOfIt: null,
        startingAwareness: 'known'
    },
    {
        id: QUIET_MARCHES_PROVINCE_ID,
        name: REGION_NAME.QUIET_MARCHES,
        standing: 'played',
        regionId: ADJACENT_REGION_ID,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact:
            'The qi is not gone; it was driven into the stone. There is nothing in the air and a great deal in the rock, and the only way to get at it is to cut.',
        onPaper:
            'One of five driven provinces held directly by the Long Cut, administered face by face through the Ninth Face Court, with no client sects, no leases and no vassals anywhere in the arrangement.',
        onTheGround:
            'Two workable faces, a worked-out cemetery district, a staked corridor nobody scheduled, a burn edge that moves, and a face that cannot be worked and is walked anyway. Eleven people at a counter administer all of it.',
        prefectureIds: QUIET_MARCHES_PREFECTURES.map(p => p.id),
        whatIsKnownOfIt: null,
        startingAwareness: 'known'
    },
    // ── the four the Marches has never heard named ────────────────────────
    // One fact each, and the fact is a band in the Assessor's schedule. A
    // single generic system telling five places apart is worth more than five
    // descriptions, and it is the honest amount: this IS what anybody in
    // either played province knows, which is a name and a queue position.
    {
        id: 'province-coldwater-cut',
        name: 'The Coldwater Cut',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact:
            'The driven stone there is still deep, so the first century of the Long Cut course schedule is almost entirely Coldwater and everything else waits.',
        onPaper: 'First band of five on the course schedule, and it has held the position for as long as the schedule has existed.',
        onTheGround: 'Nobody in either played province has been, and the Long Cut does not publish what it takes out.',
        prefectureIds: [],
        whatIsKnownOfIt:
            'A name on a schedule the Weir Office countersigns once every twenty years without reading past its own line, and a rumour among Kettle carvers that there is somewhere the tools are better.',
        startingAwareness: 'unaware'
    },
    {
        id: 'province-hammerfall',
        name: 'Hammerfall',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact: 'Second band. Worked hard for eleven hundred years and still returning enough to keep a course open.',
        onPaper: 'Second band of five, and the only one that has ever moved up rather than down.',
        onTheGround: 'Unknown here. The Assessor of the Four Faces rates it annually and the figure is not circulated.',
        prefectureIds: [],
        whatIsKnownOfIt: 'Nothing at all in the Marches. The name appears once on the schedule the Twenty-Year Hand carries and nobody at the Weir Office has ever asked what it is.',
        startingAwareness: 'unaware'
    },
    {
        id: 'province-the-sixteen-faces',
        name: 'The Sixteen Faces',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact: 'Third band, and the only driven province where more than one face is open at a time, which is what the name is.',
        onPaper: 'Third band of five, and it has been third for two hundred years.',
        onTheGround: 'Unknown here, and the Long Cut has never had reason to describe it to anybody in the Marches.',
        prefectureIds: [],
        whatIsKnownOfIt: 'A name, and the fact that it is above the Marches in the queue, which is the only comparative figure anybody in Kettle has ever heard.',
        startingAwareness: 'unaware'
    },
    {
        id: 'province-greyhold',
        name: 'Greyhold',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact: 'Fourth band, one place above the Marches, and it has been sliding for two centuries in the same direction the Marches slid.',
        onPaper: 'Fourth band of five, and it is the only one of the five that has ever moved downward twice.',
        onTheGround: 'Unknown here, and the Assessor believes it will change places with the Marches within her tenure and has not written that down.',
        prefectureIds: [],
        whatIsKnownOfIt:
            'The one name a Kettle carver might have heard, because it is the province directly above them in a queue nobody has told them they are in.',
        startingAwareness: 'unaware'
    }
];

/**
 * The queue, which is the whole of what tells the five driven provinces apart.
 *
 * Not arithmetic and not a rule: a list, in the order the Assessor's schedule
 * puts them, kept because "the Marches is last of five" is a fact a player can
 * be told and a fact that explains everything about why nothing arrives.
 */
export const DRIVEN_PROVINCE_SCHEDULE_ORDER: readonly string[] = [
    'province-coldwater-cut',
    'province-hammerfall',
    'province-the-sixteen-faces',
    'province-greyhold',
    QUIET_MARCHES_PROVINCE_ID
];

// ─── province + prefecture lookups ───────────────────────────────────────

const PROVINCE_BY_ID: ReadonlyMap<string, Province> = new Map(PROVINCES.map(p => [p.id, p]));
const PREFECTURE_BY_ID: ReadonlyMap<string, Prefecture> = new Map(PREFECTURES.map(p => [p.id, p]));

/** Every faction with any interest in a prefecture, holder or sub-holder. */
const PREFECTURE_BY_FACTION: ReadonlyMap<string, string> = (() => {
    const map = new Map<string, string>();
    for (const pref of PREFECTURES) {
        if (pref.heldByFactionId) map.set(pref.heldByFactionId, pref.id);
    }
    for (const pref of PREFECTURES) {
        for (const sub of pref.subHoldings) {
            if (!map.has(sub.factionId)) map.set(sub.factionId, pref.id);
        }
    }
    return map;
})();

export function getProvince(id: string): Province | undefined {
    return PROVINCE_BY_ID.get(id);
}

export function requireProvince(id: string): Province {
    const p = PROVINCE_BY_ID.get(id);
    if (!p) throw new Error(`Unknown province: ${id}`);
    return p;
}

export function getPrefecture(id: string): Prefecture | undefined {
    return PREFECTURE_BY_ID.get(id);
}

export function prefecturesOf(provinceId: string): Prefecture[] {
    return PREFECTURES.filter(p => p.provinceId === provinceId);
}

/** The province a `REGIONS` row stands on. */
export function provinceForRegion(regionId: string): Province | undefined {
    return PROVINCES.find(p => p.regionId === regionId);
}

/** The prefecture a faction holds, or sits inside as a sub-holder. */
export function prefectureForFaction(factionId: string): Prefecture | undefined {
    const id = PREFECTURE_BY_FACTION.get(factionId);
    return id ? PREFECTURE_BY_ID.get(id) : undefined;
}

/** The province a faction's ground is in. */
export function provinceForFaction(factionId: string): Province | undefined {
    const pref = prefectureForFaction(factionId);
    return pref ? PROVINCE_BY_ID.get(pref.provinceId) : undefined;
}

/**
 * Whose gift a faction's ground is in, tracing sub-holdings up. Returns null
 * where nothing granted it - which is a real and important answer, and the
 * only thing the Pavilion, the Hollow Court, the Grove, the Clear River
 * Alliance and the Sixmile Wardens have in common.
 */
export function delegatedFrom(factionId: string): string | null {
    const pref = prefectureForFaction(factionId);
    if (!pref) return null;
    if (pref.heldByFactionId === factionId) return pref.delegatedFromId;
    const sub = pref.subHoldings.find(s => s.factionId === factionId);
    if (!sub) return null;
    return sub.delegatedFromId === factionId ? null : sub.delegatedFromId;
}

/** Arterials under a province, in the Survey's own numbering. */
export function arterialsOf(provinceId: string): Arterial[] {
    return ARTERIALS.filter(a => a.provinceId === provinceId)
        .sort((a, b) => a.ordinalInSystem - b.ordinalInSystem);
}

/** Prefectures where the record and the ground do not agree. */
export function contestedGround(): Prefecture[] {
    return PREFECTURES.filter(p => p.discrepancy !== 'none');
}
