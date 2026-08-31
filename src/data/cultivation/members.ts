/**
 * Members - the people inside the institutions, at human scale.
 *
 * THE GAP THIS FILLS
 * ------------------
 * The world catalog is complete at the top and empty in the middle. It has
 * apexes, Dao houses, sealed ancestors, a False Immortal and twenty-eight
 * factions with grievances - and until this file, nobody the player could
 * actually know. Every named figure was enormous or institutional.
 *
 * That breaks the design's emotional argument. A grudge that persists for
 * decades, a debt repaid forty years late, and the Price of Advancement taking
 * somebody at a crossing all require a person who was worth losing. Without a
 * roster at the bottom of the ladder, the toll takes a stranger, and a stranger
 * costs nothing.
 *
 * So: named people at every rank of every faction that recruits, weighted hard
 * toward the bottom, because the bottom is where the player starts and where
 * almost everybody is.
 *
 * WHAT A PERSON IS HERE
 * ---------------------
 * Six fields and no more: a name, a rank, a realm, one thing they want, one
 * thing they are afraid of, and one concrete detail. A person who takes ten
 * lines is not reusable, and this catalog exists to be reused - the narrator
 * reaches for these people repeatedly across a run, and they have to fit in a
 * prompt beside everything else.
 *
 * Two roles carry a little more, because the design asks something specific of
 * them:
 *
 *   rival    carries `rivalry`, and the load-bearing field is `beatableBecause`.
 *            Every existing power in the world is untouchable by construction -
 *            a Dao house cannot be fought, a sect cannot be beaten by one
 *            person, and the answer to "why did the stronger party not simply
 *            kill them" is always institutional. A rival here is the opposite:
 *            personal, at the player's altitude, and genuinely defeatable, with
 *            the reason written down so nobody has to invent plot armour or
 *            plot frailty later.
 *
 *   master   carries `teaching`, which is `asking.md`'s three limits made
 *            explicit: what they know, what they may say, and what it costs
 *            them to say it. Those are different limits and all three apply.
 *            Masters here are competent rather than formidable, frequently out
 *            of their depth about the wider world, and capable of a straight
 *            answer inside the part they actually hold.
 *
 * RULES THIS FILE KEEPS
 * ---------------------
 * - NOBODY IS FLAGGED IMPORTANT. There are no chosen ones and no hidden
 *   prodigies marked as such. Where somebody is exceptional it is legible only
 *   in what they do, and the catalog never says so. `people.md` is explicit
 *   that exceptional NPCs emerge from the same inputs as anybody else and never
 *   from a flag, and a `notable: true` column would be that flag.
 * - REALMS ARE PLAUSIBLE FOR RANK AND FACTION. Enforced by `rankRealmBand`,
 *   which is derived from the faction's own admission bar and its production
 *   tier in `faction-character.ts` rather than asserted by hand. Most people
 *   here are at Qi Condensation. Foundation Establishment is notable. Core
 *   Formation is a senior figure, and there is exactly one person in this file
 *   above Nascent Soul.
 * - NAMES VARY BY REGION. The Low Fall uses clan surnames with one- or
 *   two-syllable given names; the Quiet Marches uses tool-names and
 *   face-numbers and has no clan names at all. See `customs.naming` in
 *   `regions.ts`. A Marches-born person carrying two names in the Low Fall
 *   style is announcing that they are leaving.
 * - EVERY FACTION HAS SOMEBODY WHO IS GOOD COMPANY. `tone.md` requires humour
 *   and requires it to come from character. `goodCompany` marks who it is
 *   available from; it is a fact about their manner, not about their worth.
 * - THESE ARE CONTENT, NOT SIMULATION. Small durable records the narrator
 *   reasons from. Nothing here is a live agent, nothing here has state, and the
 *   engine owns every decision as usual.
 *
 * The two factions that take no applicants at all - the Kiln Wardens and the
 * Hollow Court - have no members here on purpose. They are facts about the
 * world rather than doors, and a starting cultivator does not meet one.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { requireSect, getSect } from './sects.js';
import { FACTION_CHARACTER } from './faction-character.js';
import { getRegionForFaction } from './regions.js';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/**
 * What this person is TO A PLAYER, which is not a statement about their
 * importance and not a ranking.
 *
 *   peer    somebody the player can meet on level ground and become a friend,
 *           a debtor, a rival or a corpse with. Most of the catalog.
 *   rival   personal opposition at the player's altitude, and beatable.
 *   master  somebody who will teach, inside stated limits.
 *   senior  a rank-holder the player deals with rather than fights.
 */
export const FactionMemberRoleSchema = z.enum(['peer', 'rival', 'master', 'senior']);
export type FactionMemberRole = z.infer<typeof FactionMemberRoleSchema>;

/**
 * Personal opposition, which is the thing the world otherwise cannot supply.
 *
 * `beatableBecause` is the whole point of the object. It is written in advance
 * so that a defeat is a consequence of something true about the person rather
 * than a narrator's mercy, and so that a player who works the weakness out has
 * actually worked something out.
 */
export const RivalrySchema = z.object({
    /** What the quarrel is actually over. Personal, never institutional. */
    grievance: z.string().min(30),
    /** Why they can be genuinely defeated. Concrete and exploitable. */
    beatableBecause: z.string().min(60)
});
export type Rivalry = z.infer<typeof RivalrySchema>;

/**
 * A master's three limits, from `asking.md`: what they know, what they are
 * allowed to say, and what it costs them to say it. All three apply at once,
 * and keeping them separate is what stops a master becoming an oracle.
 */
export const TeachingSchema = z.object({
    /** The bounded thing they genuinely hold, stated without inflation. */
    knows: z.string().min(30),
    /** What they may not say, and on whose authority. */
    mayNotSay: z.string().min(30),
    /** What a straight answer costs them. Never nothing, except where it is. */
    costsThem: z.string().min(30)
});
export type Teaching = z.infer<typeof TeachingSchema>;

export const MemberSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(2),
    /** Faction id in `sects.ts` or `DAO_HOUSES`. */
    factionId: z.string().min(1),
    /** Index into that faction's own `ranks` array. */
    rankIndex: z.number().int().min(0),
    /** The rank name, denormalised so narration needs no lookup. */
    rank: z.string().min(1),
    realmOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    role: FactionMemberRoleSchema,
    /**
     * One thing, and the minimum is deliberately tiny. The best answers in
     * this catalog are three words long - a Lantern Bearer who wants "out",
     * an Applicant who wants "a ticket" - and a floor that forbade them would
     * be a floor that forced padding.
     */
    wants: z.string().min(3),
    /** One thing. Frequently shorter than the wanting, and allowed to be. */
    fears: z.string().min(3),
    /** One specific concrete thing: a habit, a possession, an injury, a line. */
    detail: z.string().min(30),
    /** Whether they are pleasant to be around. A fact about manner. */
    /**
     * The faction's strongest member, and not a product of its pipeline.
     *
     * `rankRealmBand` caps a rank at what the faction can reliably produce,
     * which is the right rule for everybody the faction actually made. It is the
     * wrong rule for the one person it did not: an inherited elder, somebody who
     * arrived already formed, or the last survivor of a richer age. On most of
     * this catalog the two figures are far apart - a faction standing at 33
     * whose pipeline tops out near 28 - and that distance is the Late Age, not
     * a data error.
     *
     * So an outlier is exempt from the band and asserted to sit exactly on the
     * faction's `powerOrdinal`, because that number is defined as this person.
     * At most one per faction.
     */
    outlier: z.boolean(),
    /**
     * Why they are above what the faction can produce. Null when they are not.
     *
     *   inherited   came with the compound, or with the vein, or with a merger
     *   remnant     one of several left from a larger predecessor, and the
     *               reason this matters is that remnants come in cores. A sect
     *               squatting in somebody else's compound frequently squats in
     *               it with somebody else's elders, and a faction can therefore
     *               have a whole band of people its own ground could never have
     *               made - which is what a lit-node count of eleven out of
     *               sixty-three looks like from the inside.
     *   arrived     climbed elsewhere and walked in already formed
     *   last_of_age the only one still standing from a richer period
     */
    outlierReason: z.enum(['inherited', 'remnant', 'arrived', 'last_of_age']).nullable(),
    goodCompany: z.boolean(),
    rivalry: RivalrySchema.nullable(),
    teaching: TeachingSchema.nullable()
});
export type Member = z.infer<typeof MemberSchema>;

// ─────────────────────────────────────────────────────────────────────────
// PLAUSIBILITY
//
// What a rank can plausibly stand at, derived rather than asserted, so the
// catalog cannot drift away from the factions it describes.
//
// Three inputs, all of them already in the world:
//
//   admissionOrdinal   the bar at the front gate. Nobody in a faction stands
//                      below it, because that is what the bar is.
//   reliableOrdinal    what the faction can currently turn out from its own
//                      intake (`faction-character.ts`). This, plus one realm of
//                      slack, is the ceiling for anybody in this catalog - a
//                      member above it would be a member the faction could not
//                      have produced, which is a claim needing its own story.
//   powerOrdinal       the strongest member who will actually answer. It caps
//                      the ceiling from above, which matters for the small
//                      factions: the Sixmile Wardens' best Warden is at
//                      Foundation Establishment and that is the top of them.
//
// The curve between the bottom rank and the top is deliberately loose in both
// directions:
//
//   LEAD  every rank's ceiling sits a little ahead of its own position, because
//         a low-rank member who is simply strong is an ordinary thing - a
//         transfer, a late admission, somebody who arrived already made.
//   LAG   every rank's floor sits a little behind, because rank is bought with
//         service as often as with qi, and the outer disciple of thirty years
//         is the most characteristic person in the setting.
//   HEADROOM guarantees four rungs of room above the admission bar at every
//         rank, so a faction with a high bar and a low pipeline is not left
//         with a band of width zero.
// ─────────────────────────────────────────────────────────────────────────

/** Rungs of slack above the admission bar, at every rank. */
const HEADROOM = 4;
/** How far a rank's ceiling runs ahead of its own position, as a fraction. */
const LEAD = 0.22;
/** How far a rank's floor lags behind it, as a fraction. */
const LAG = 0.35;
/** Slack above what a faction can reliably produce. One realm, roughly. */
const ABOVE_PRODUCTION = 8;

export interface RealmBand {
    minOrdinal: number;
    maxOrdinal: number;
}

/**
 * The band a member at this rank of this faction may stand in.
 *
 * Returns undefined for an unknown faction or an out-of-range rank index; the
 * catalog test treats either as a failure.
 */
export function rankRealmBand(factionId: string, rankIndex: number): RealmBand | undefined {
    const sect = getSect(factionId);
    if (!sect) return undefined;
    if (!Number.isInteger(rankIndex) || rankIndex < 0 || rankIndex >= sect.ranks.length) {
        return undefined;
    }

    const admission = sect.admissionOrdinal;
    const production = FACTION_CHARACTER[factionId]?.production.reliableOrdinal ?? admission;
    const ceiling = Math.min(
        sect.powerOrdinal,
        Math.max(admission, production) + ABOVE_PRODUCTION
    );
    const span = Math.max(0, ceiling - admission);

    const top = Math.max(1, sect.ranks.length - 1);
    const t = Math.min(1, rankIndex / top);

    const maxOrdinal = Math.min(
        MAX_ORDINAL,
        Math.max(
            admission + HEADROOM,
            Math.round(admission + span * Math.min(1, t + LEAD))
        )
    );
    const minOrdinal = Math.max(
        admission,
        Math.round(admission + span * Math.max(0, t - LAG))
    );
    return { minOrdinal, maxOrdinal: Math.max(minOrdinal, maxOrdinal) };
}

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
//
// Ordered as `sects.ts` is ordered: Low Fall righteous, neutral, demonic; then
// the Dao houses; then the Quiet Marches. Within a faction, from the bottom
// rank upward, because that is the order the player meets them in.
// ─────────────────────────────────────────────────────────────────────────

export const MEMBERS: readonly Member[] = [
    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - RIGHTEOUS
    // ═══════════════════════════════════════════════════════════════════

    // --- Azure Cloud Pavilion -----------------------------------------
    {
        id: 'member-yan-shuling',
        name: 'Yan Shuling',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 0,
        rank: 'Sword Servant',
        realmOrdinal: 5,
        role: 'peer',
        wants: 'a sword name before her twentieth year, because her mother had one at nineteen',
        fears: 'that the armoury sergeant is right and her wrists are wrong for the blade',
        detail: 'Sharpens the whole servants\' dormitory\'s blades on rest days, badly, for the company rather than the coppers.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-hou-baiyu',
        name: 'Hou Baiyu',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 1,
        rank: 'Outer Disciple',
        realmOrdinal: 9,
        role: 'rival',
        wants: 'for his uncle to stop introducing him to people as his uncle',
        fears: 'being posted to the lower gate, where nobody of consequence walks past',
        detail: 'Keeps a written list of everyone who has beaten him in the yard, with dates, and has never crossed a name off it.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Somebody arrived the same year he did, is doing better on less, and has not once mentioned an uncle.',
            beatableBecause: 'Every advantage he has is borrowed and none of it travels. The Sword Elder is his uncle rather than his sponsor, the yard privileges evaporate the moment the man is on circuit, and Hou Baiyu has never in his life fought somebody who was not being watched by a relative.'
        },
        teaching: null
    },
    {
        id: 'member-cen-qingzhi',
        name: 'Cen Qingzhi',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 1,
        rank: 'Outer Disciple',
        realmOrdinal: 11,
        role: 'peer',
        wants: 'the same courtyard, the same duty roster, and another thirty years of both',
        fears: 'promotion, which would move him off the east terrace',
        detail: 'Thirty-one years an outer disciple, and knows the position of every flagstone worn through in the practice yard - two hundred and ten of them - and will recite the count to a visitor.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-mu-yanling',
        name: 'Mu Yanling',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 2,
        rank: 'Inner Disciple',
        realmOrdinal: 13,
        role: 'peer',
        wants: 'selection upward at the next inter-sect competition, which is in four years',
        fears: 'that she is the one everyone assumes will rise, and that the assumption has been doing the work',
        detail: 'Flies the blade barefoot because boots cost her a half-beat on the mount, and has ruined four sets of feet doing it.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    // The Pavilion sends six of these out and does not consider it a promotion.
    // See AZURE_CLOUD_INTAKE.theScouts in `hierarchy.ts`: the practice implies
    // the post, so the post has somebody standing in it.
    {
        id: 'member-cai-ruzhen',
        name: 'Cai Ruzhen',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 2,
        rank: 'Inner Disciple',
        realmOrdinal: 14,
        role: 'peer',
        wants: 'to put forward two people this year who are still there in ten, which she has managed once in nine years',
        fears: 'that the two she has already sent home were the ones, and that she will find out from somebody else',
        detail: 'Travels as a buyer of dye and does actually buy it, badly, at a small annual loss the Pavilion covers without comment; asks strangers three mild questions and hands them something to hold, and will not say what she is measuring even when the answer would cost her nothing.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-shi-weiran',
        name: 'Shi Weiran',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 4,
        rank: 'Sword Elder',
        realmOrdinal: 16,
        role: 'master',
        wants: 'to demonstrate the second form correctly once more before he stops being able to demonstrate it',
        fears: 'that he is an elder because the Pavilion has nobody else to be one',
        detail: 'Right forearm visibly heavier than the left, like every Pavilion sword, and a tremor in it he hides by keeping that hand on the scabbard throughout a conversation.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'The first four forms to the bottom, and the fifth by rote, which he says out loud before teaching it.',
            mayNotSay: 'Anything about what the reserve holds or the count of what is in it, which is the Pavilion Master\'s and has been since the theft nobody has publicly accounted for.',
            costsThem: 'A question about Ru Anjing puts him in an argument the Sword Elders have been having for forty years, in which he has no standing and a stated position he no longer believes.'
        }
    },
    // The seat is the compensation. See THE_STEP_AND_THE_BOUNDARY in
    // `immortal-items.ts`: a candidate asked to hold at Perfection while a
    // council decides, paid in rank because rank costs the Pavilion nothing.
    {
        id: 'member-xiang-yuwei',
        name: 'Xiang Yuwei',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 4,
        rank: 'Sword Elder',
        realmOrdinal: 24,
        role: 'senior',
        wants: 'a decision, in either direction, from four people who have not been able to reach one in eleven years',
        fears: 'that she will be asked to keep holding until she is old enough that the arithmetic answers itself',
        detail: 'Made a Sword Elder at thirty-one, which the province read as the fastest rise in four centuries and the hall read correctly: she is standing at the top of her realm under a standing instruction not to break through, and the seat arrived the same season the instruction did.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },

    // --- Verdant Spring Hall -------------------------------------------
    {
        id: 'member-tao-chunxi',
        name: 'Tao Chunxi',
        factionId: 'sect-verdant-spring-hall',
        rankIndex: 0,
        rank: 'Herb Boy',
        realmOrdinal: 3,
        role: 'peer',
        wants: 'to be allowed to touch a patient, once, under supervision',
        fears: 'the ledger of unpaid bills, on which his family appears twice',
        detail: 'Names a herb from the smell of the cut end with his eyes shut, and does it as a party trick at the ford market for coppers.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-jiang-ruoshui',
        name: 'Jiang Ruoshui',
        factionId: 'sect-verdant-spring-hall',
        rankIndex: 1,
        rank: 'Outer Physician',
        realmOrdinal: 8,
        role: 'peer',
        wants: 'a ford posting where she would be the only physician for nine li',
        fears: 'being the only physician for nine li',
        detail: 'Carries the needle roll her teacher gave her with one needle missing, and has never replaced it, and will not explain which one.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-pei-hanyue',
        name: 'Pei Hanyue',
        factionId: 'sect-verdant-spring-hall',
        rankIndex: 2,
        rank: 'Inner Physician',
        realmOrdinal: 12,
        role: 'peer',
        wants: 'the Hall to charge an enemy on the floor exactly what it charges anyone else',
        fears: 'that she argues about billing because she has not advanced in nine years',
        detail: 'Keeps a tally of patients treated free in the back of the dispensary book, where the billing faction has now found it twice.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-lou-tingwei',
        name: 'Lou Tingwei',
        factionId: 'sect-verdant-spring-hall',
        rankIndex: 3,
        rank: 'Hall Physician',
        realmOrdinal: 15,
        role: 'master',
        wants: 'to finish a working index of which formulae in the Hall\'s book came out of the valley ruin',
        fears: 'that the answer is most of them',
        detail: 'Pins his sleeves back even at meals, and has been unable to stop for nineteen years, and eats alone because of it.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Every mortal- and earth-grade treatment in the Hall\'s book, and why each step in it is there.',
            mayNotSay: 'The third stanza of the restoration art, to anyone below Hall Physician, which is a rule of the Hall Sovereign\'s and not negotiable at his level.',
            costsThem: 'Every hour spent teaching is an hour off an index he has been building for nineteen years and expects to need eleven more for.'
        }
    },
    {
        id: 'member-xue-songyi',
        name: 'Xue Songyi',
        factionId: 'sect-verdant-spring-hall',
        rankIndex: 4,
        rank: 'Life Elder',
        realmOrdinal: 19,
        role: 'senior',
        wants: 'somebody, anybody, to tell her what the ceremonial duty at the springs is for',
        fears: 'that she has been performing it wrongly for sixty years',
        detail: 'Goes alone to the ninth spring at dawn on the first of each month and pours out a measure of water, which nobody in the Hall including her can explain.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Nine Peaks Ascetic Order --------------------------------------
    {
        id: 'member-kuang-da',
        name: 'Kuang Da',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 0,
        rank: 'Stone Bearer',
        realmOrdinal: 6,
        role: 'peer',
        wants: 'a smaller stone, and will die before he asks for one',
        fears: 'admitting he chose the stone to impress somebody who left the Order the following spring',
        detail: 'His stone is the largest in living memory, he has carried it eleven years, and the sound of him putting it down is how the refectory knows he has arrived.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-rong-bingchen',
        name: 'Rong Bingchen',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 1,
        rank: 'Ascetic',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'to be first up the ninth peak once, in front of the whole intake',
        fears: 'the workings, and will not walk the fourth peak path at all',
        detail: 'Counts her steps aloud on the climb, which the entire Order finds unbearable and nobody has ever told her.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-sang-zhiyuan',
        name: 'Sang Zhiyuan',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 3,
        rank: 'Peak Warden',
        realmOrdinal: 17,
        role: 'master',
        wants: 'the workings surveyed and the question of Meng Da settled in writing',
        fears: 'what a survey would find, which is a different thing from not wanting one',
        detail: 'Has the workings entrance measured, staked and roped to a standard nobody asked for, and has never gone in past the rope.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Body-tempering to Core Formation, and can correct a stance from the far side of a courtyard without raising his voice.',
            mayNotSay: 'Anything about what is in the workings, on the Mountain Elders\' standing instruction, which is doctrine wearing the clothes of caution and he knows it.',
            costsThem: 'Every honest answer about the workings is a step further from the Mountain Elders\' good opinion, and he wants the seat.'
        }
    },
    {
        id: 'member-yin-muqing',
        name: 'Yin Muqing',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 4,
        rank: 'Mountain Elder',
        realmOrdinal: 21,
        role: 'senior',
        wants: 'to die before anybody opens the workings',
        fears: 'that Meng Da is alive in them',
        detail: 'Has personally swept and maintained the forty unlit formation nodes for fifty years, and cannot say what a single one of them does.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Clear River Alliance ------------------------------------------
    {
        id: 'member-ren-xiaomao',
        name: 'Ren Xiaomao',
        factionId: 'sect-clear-river-alliance',
        rankIndex: 0,
        rank: 'Boat Hand',
        realmOrdinal: 2,
        role: 'peer',
        wants: 'her own boat, which is eleven years of wages at the rate she is paid',
        fears: 'the third ford in spring, where she lost a pole and nearly the rest',
        detail: 'Introduces herself to everyone by ford and season - "Third, this spring" - including to paying customers, who find it baffling.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-qiao-duo',
        name: 'Qiao Duo',
        factionId: 'sect-clear-river-alliance',
        rankIndex: 1,
        rank: 'River Disciple',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'to be taken on the border road run to Scarwater once, to see it',
        fears: 'land, which he says as though it were an ordinary thing to be afraid of',
        detail: 'Has never slept more than one night away from water in his life and offers this as a qualification.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-fang-lianzhou',
        name: 'Fang Lianzhou',
        factionId: 'sect-clear-river-alliance',
        rankIndex: 1,
        rank: 'River Disciple',
        realmOrdinal: 9,
        role: 'rival',
        wants: 'the Ford Master\'s seat at Scarwater, which is the only seat on the border road',
        fears: 'that the River Elders are right and he cannot read water',
        detail: 'Has twice reported another disciple\'s smuggling to the Ford Master, been thanked both times, and promoted neither.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Somebody the Ford Master likes is going to get Scarwater, and Fang Lianzhou has decided in advance who it is.',
            beatableBecause: 'His entire method is information, and he has no allies to give him any - the Alliance settles debts in crossings and nobody owes him one. Cornered without a river at his back he is a nine-layer cultivator with a boat pole, and he knows it, which is why he has never once started anything on land.'
        },
        teaching: null
    },
    {
        id: 'member-nie-zhaoxin',
        name: 'Nie Zhaoxin',
        factionId: 'sect-clear-river-alliance',
        rankIndex: 3,
        rank: 'Ford Master',
        realmOrdinal: 14,
        role: 'master',
        wants: 'to federate the border road and be remembered as the man who did it',
        fears: 'drowning on land, which is what the River Elders say will happen and which he repeats as a joke',
        detail: 'Keeps the two-age-old survey copy in oilcloth and will unwrap it for anybody who asks, at length, and then again on the way out.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'Every crossing, smuggler, toll dodge and drowned secret between the eleven river towns, in more detail than the charts hold.',
            mayNotSay: 'The name of a client of the carrying trade, which is the one thing the Alliance sells and the one thing it will expel a Ford Master over.',
            costsThem: 'A straight answer about the fords is worth money to the Thousand Treasure Pavilion, he knows exactly what it is worth, he gives it away anyway, and it has already cost him a River Elder\'s seat.'
        }
    },
    {
        id: 'member-su-jinglan',
        name: 'Su Jinglan',
        factionId: 'sect-clear-river-alliance',
        rankIndex: 4,
        rank: 'River Elder',
        realmOrdinal: 16,
        role: 'senior',
        wants: 'the Alliance to stay river people and stop talking about the road',
        fears: 'being the last one who thinks so',
        detail: 'Has not been on land longer than a market day in forty years, and declines invitations by letter, in a hand that is famously bad.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Sweptground Temple --------------------------------------------
    {
        id: 'member-tan-wu',
        name: 'Tan Wu',
        factionId: 'sect-sweptground-temple',
        rankIndex: 0,
        rank: 'Lamp Novice',
        realmOrdinal: 1,
        role: 'peer',
        wants: 'to find out whether he has a spirit root at all, which nobody has told him',
        fears: 'being told',
        detail: 'Has swept the same corridor for two years and can name whoever is coming from the sound of the footstep, at forty paces, every time.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-gu-anrou',
        name: 'Gu Anrou',
        factionId: 'sect-sweptground-temple',
        rankIndex: 0,
        rank: 'Lamp Novice',
        realmOrdinal: 3,
        role: 'peer',
        wants: 'eleven days\' cart fare back to Kettle, to fetch her brother',
        fears: 'that the cough is the thing that decides it and not the fare',
        detail: 'Rinses her mouth with vinegar before every meal, which no Low Fall native does and which nobody at the Temple has asked her about.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-ji-yuanhe',
        name: 'Ji Yuanhe',
        factionId: 'sect-sweptground-temple',
        rankIndex: 1,
        rank: 'Temple Monk',
        realmOrdinal: 8,
        role: 'peer',
        wants: 'to learn one art that is not elementless, just to know what it is like',
        fears: 'that the Temple takes people like him because nobody else will, and that this is the whole of it',
        detail: 'Has memorised the Lesser Qi-Gathering Manual so completely that he recites it in his sleep, to the dormitory\'s continuing distress.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-zhuo-heping',
        name: 'Zhuo Heping',
        factionId: 'sect-sweptground-temple',
        rankIndex: 2,
        rank: 'Inner Monk',
        realmOrdinal: 12,
        role: 'peer',
        wants: 'a posting to the Kettle Mission, eleven days away',
        fears: 'that he wants it because it is eleven days from his family\'s creditors',
        detail: 'Cuts his own hair rather than let anybody do it, badly, in front of a polished pan, on the first of the month.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-lai-shouyi',
        name: 'Lai Shouyi',
        factionId: 'sect-sweptground-temple',
        rankIndex: 3,
        rank: 'Hall Warden',
        realmOrdinal: 15,
        role: 'master',
        wants: 'to get one more disciple past Foundation Establishment before his hands go',
        fears: 'the Abbot accepting a vein grant',
        detail: 'Teaches with his hands inside his sleeves and corrects a stance by describing it rather than touching it, having been struck once as a novice and never got over it.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'Every elementless art the Temple holds, all six nodes of its formation, and precisely why a temple that only accepted clean roots would be a temple for other people.',
            mayNotSay: 'Anything about the crossing in the Temple\'s record, which is the Abbot\'s and which the Abbot has never discussed with anybody.',
            costsThem: 'The honest answer about the Temple\'s ceiling ends with a disciple leaving for a sect that has a vein. It has ended that way four times and he gives it anyway.'
        }
    },
    {
        id: 'member-hua-jueming',
        name: 'Hua Jueming',
        factionId: 'sect-sweptground-temple',
        rankIndex: 5,
        rank: 'Abbot',
        realmOrdinal: 20,
        role: 'senior',
        wants: 'nothing that he will say out loud',
        fears: 'that refusing the grant twice was pride wearing the clothes of principle',
        detail: 'Has twice written the letter accepting a vein grant, and both drafts are in the desk drawer of an office nobody at the Temple has ever been told not to enter.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Lantern Hall ---------------------------------------------------
    {
        id: 'member-xi-linzhao',
        name: 'Xi Linzhao',
        factionId: 'sect-lantern-hall',
        rankIndex: 0,
        rank: 'Copyist',
        realmOrdinal: 4,
        role: 'peer',
        wants: 'to be allowed down into the stack room, which is larger than the hall above it',
        fears: 'copying out a name he knows',
        detail: 'Copies faster with his left hand than his right, has been told four times to stop, and has not stopped.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-duan-cuiwen',
        name: 'Duan Cuiwen',
        factionId: 'sect-lantern-hall',
        rankIndex: 1,
        rank: 'Reader',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'the ford towns circuit, where nobody important has to be read their own ledger',
        fears: 'having been right, in public, to a Pavilion disciple, at a market, in front of his friends',
        detail: 'Carries a folded page of a ledger that is not hers and will not say whose it is.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-min-boyan',
        name: 'Min Boyan',
        factionId: 'sect-lantern-hall',
        rankIndex: 2,
        rank: 'Hall Archivist',
        realmOrdinal: 14,
        role: 'master',
        wants: 'the nine cities\' indices reconciled before he dies, which he calculates as eleven more years of work',
        fears: 'the Stonewright Consortium buying up the Hall\'s paper supply, which it has begun to',
        detail: 'Has an index of the indices, in his own hand, which he has never copied and will not allow out of the room.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'What the crossings have taken in this province for four hundred years, by name, by face, and by the date of the boundary that took it.',
            mayNotSay: 'A living person\'s ledger, aloud, unless they have asked for it themselves. He will not be talked round this and has refused a patriarch.',
            costsThem: 'A full answer takes a day out of the reconciliation. There are eleven years of it left, he is sixty-one, and he does the arithmetic in front of you before agreeing.'
        }
    },
    {
        id: 'member-kong-zhaoting',
        name: 'Kong Zhaoting',
        factionId: 'sect-lantern-hall',
        rankIndex: 3,
        rank: 'Keeper of Names',
        realmOrdinal: 18,
        role: 'senior',
        wants: 'to stop being the one sent to funerals',
        fears: 'forgetting one of them',
        detail: 'Writes the name on the inside of her wrist in ink before she goes, every time, and has done it something over a thousand times.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- The Standing Grove ---------------------------------------------
    {
        id: 'member-ge-yiran',
        name: 'Ge Yiran',
        factionId: 'sect-standing-grove',
        rankIndex: 0,
        rank: 'Guest of the Grove',
        realmOrdinal: 15,
        role: 'peer',
        wants: 'to be told whether she has been accepted, which nobody has said in four years',
        fears: 'asking',
        detail: 'Was given a bed, a bowl and no duties whatsoever, and has invented a full day of duties and keeps to them.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-wen-danyang',
        name: 'Wen Danyang',
        factionId: 'sect-standing-grove',
        rankIndex: 1,
        rank: 'Disciple',
        realmOrdinal: 19,
        role: 'master',
        wants: 'an argument with somebody who disagrees with him about anything at all',
        fears: 'being the nearest Grove disciple on the day the boundary is tested',
        detail: 'Settles disputes in the four settlements, refuses payment, accepts food, and has become very fat.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'The Grove\'s entire working curriculum, which is six arts, and he will teach any of them to anybody who walks up the valley.',
            mayNotSay: 'Anything on the Grove\'s behalf about where its boundary runs, which is the Keeper\'s alone and which nobody including the Keeper can point to on a map.',
            costsThem: 'Nothing, and he says so cheerfully, and it is the reason people distrust the offer and go elsewhere.'
        }
    },
    {
        id: 'member-yun-qingtai',
        name: 'Yun Qingtai',
        factionId: 'sect-standing-grove',
        rankIndex: 3,
        rank: 'Keeper of the Grove',
        realmOrdinal: 24,
        role: 'senior',
        wants: 'to take no disciples this decade either',
        fears: 'being tested somewhere small and deniable at the edge, which is how it would come',
        detail: 'Walks the whole claim on foot once a year, eleven days, and has done so for two centuries; it is the only patrol the Grove has ever had.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - NEUTRAL
    // ═══════════════════════════════════════════════════════════════════

    // --- Stonewright Consortium ------------------------------------------
    {
        id: 'member-pan-mingyu',
        name: 'Pan Mingyu',
        factionId: 'sect-stonewright-consortium',
        rankIndex: 0,
        rank: 'Weigher',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'a Refiner\'s ticket, which is four years and an examination away',
        fears: 'her hands, which have started shaking on the fine scale',
        detail: 'Calls the weight of a stone to within a grain by hand, and has never been asked to prove it in a way that counted.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-teng-kexin',
        name: 'Teng Kexin',
        factionId: 'sect-stonewright-consortium',
        rankIndex: 1,
        rank: 'Refiner',
        realmOrdinal: 11,
        role: 'peer',
        wants: 'to watch a press taken apart, once, by anybody',
        fears: 'being on shift when one stops',
        detail: 'Talks to the presses out loud and by name, and the whole hall has now adopted her names for them, including the House Factor.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-qin-fusheng',
        name: 'Qin Fusheng',
        factionId: 'sect-stonewright-consortium',
        rankIndex: 2,
        rank: 'Factor',
        realmOrdinal: 15,
        role: 'rival',
        wants: 'the Scarwater rate desk, which decides what the entire border road pays',
        fears: 'an audit of the nineteen percent',
        detail: 'Keeps a private book of who has bought below rate and from whom, and it is more accurate than the Consortium\'s own.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Anybody trading across the border road without going through him is, in his reading, stealing from him personally.',
            beatableBecause: 'All of his power is a desk he does not hold yet and a book he is not supposed to keep. He cannot fight and has never claimed to. One credible audit request lodged with the Ninefold Ledger removes him entirely, and the Consortium will not spend a stone defending a Factor.'
        },
        teaching: null
    },
    {
        id: 'member-yao-wangchun',
        name: 'Yao Wangchun',
        factionId: 'sect-stonewright-consortium',
        rankIndex: 3,
        rank: 'House Factor',
        realmOrdinal: 18,
        role: 'master',
        wants: 'a transfer to anywhere that is not the head of a vein',
        fears: 'that she is very good at this',
        detail: 'Prices a valley in her head on the walk in, involuntarily, and stopped saying the number out loud about ten years ago.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'The rate, its whole history, and exactly what a quarter-point on it does to a poor cultivator\'s month.',
            mayNotSay: 'Next quarter\'s rate, which is a Rate-Setter\'s and is a hanging matter, and she will name the punishment rather than pretend not to know the number.',
            costsThem: 'Explaining the rate honestly to somebody it is about to ruin is the part of the work she goes home from, and she has begun going home earlier.'
        }
    },

    // --- Thousand Treasure Pavilion --------------------------------------
    {
        id: 'member-mo-guyun',
        name: 'Mo Guyun',
        factionId: 'sect-thousand-treasure-pavilion',
        rankIndex: 0,
        rank: 'Runner',
        realmOrdinal: 5,
        role: 'peer',
        wants: 'to stand on the auction floor during a sale instead of outside the door',
        fears: 'the consignor whose lot she carried last spring, who has since been ruined and knows her face',
        detail: 'Recites the catalogue of any auction she has run for, in order, including the withdrawn lots, on request and often without one.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-sha-peiran',
        name: 'Sha Peiran',
        factionId: 'sect-thousand-treasure-pavilion',
        rankIndex: 1,
        rank: 'Clerk',
        realmOrdinal: 9,
        role: 'peer',
        wants: 'an appraiser\'s ticket',
        fears: 'that his eye is ordinary and that everybody except him has worked this out',
        detail: 'Buys cheap dug fragments out of his own wages to practise on, and owns a box of two hundred worthless ones he can date to the season.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-dai-huaiyu',
        name: 'Dai Huaiyu',
        factionId: 'sect-thousand-treasure-pavilion',
        rankIndex: 2,
        rank: 'Appraiser',
        realmOrdinal: 14,
        role: 'master',
        wants: 'one week in which nobody asks him where a piece came from',
        fears: 'signing a forgery',
        detail: 'Says "out of the ground" the way other men say "from a workshop", and is the best grave-reader in the province who does not call himself one.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'Provenance: what came out of a hole rather than a workshop, roughly which hole, and roughly when it was opened.',
            mayNotSay: 'Who consigned anything, ever, which is not a rule so much as the Pavilion\'s entire business model.',
            costsThem: 'Naming a grave names the digger. Diggers have friends, several of them are in the Bone Lantern Cult, and he has to keep buying from them next season.'
        }
    },
    {
        id: 'member-zong-ruilin',
        name: 'Zong Ruilin',
        factionId: 'sect-thousand-treasure-pavilion',
        rankIndex: 3,
        rank: 'Hall Steward',
        realmOrdinal: 17,
        role: 'senior',
        wants: 'the Council Seat that has stood vacant for nine years',
        fears: 'that it is vacant because the Grand Steward prefers it vacant',
        detail: 'Has been running the Low Fall floor for nine years and signs every document "acting", including his own correspondence.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Cinnabar Crucible Guild ------------------------------------------
    {
        id: 'member-fu-niankang',
        name: 'Fu Niankang',
        factionId: 'sect-cinnabar-crucible-guild',
        rankIndex: 0,
        rank: 'Bellows Hand',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'to sit the apprentice examination, which costs twelve stones to enter',
        fears: 'failing it twice, which bars a candidate permanently',
        detail: 'Has burned off both eyebrows and draws them back on with charcoal every morning, in a different mood each time.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-chai-xilian',
        name: 'Chai Xilian',
        factionId: 'sect-cinnabar-crucible-guild',
        rankIndex: 1,
        rank: 'Apprentice Alchemist',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'permission to read the fourth line of the method-script on the refining hall wall',
        fears: 'that she has already read it and that it made no sense',
        detail: 'Keeps a tally of failed batches on the inside of her cupboard door. It stands at four hundred and eleven.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-ruan-jiangming',
        name: 'Ruan Jiangming',
        factionId: 'sect-cinnabar-crucible-guild',
        rankIndex: 2,
        rank: 'Journeyman Alchemist',
        realmOrdinal: 15,
        role: 'rival',
        wants: 'the Cauldron Master\'s furnace, which is allocated on results and nothing else',
        fears: 'a public examination',
        detail: 'Has twice reported another journeyman\'s batch as contaminated, was correct twice, and is disliked for it by people who agree with him.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Somebody else\'s batches are holding, and he has decided the reason is favouritism rather than method.',
            beatableBecause: 'The Guild admits by examination and allocates by examination, and he cannot fix one he is not invigilating. Everything he has ever won he won by being right in public, so being wrong in public once is the whole of it. He is also an alchemist and has never been in a fight.'
        },
        teaching: null
    },
    {
        id: 'member-nie-shiyu',
        name: 'Nie Shiyu',
        factionId: 'sect-cinnabar-crucible-guild',
        rankIndex: 3,
        rank: 'Cauldron Master',
        realmOrdinal: 18,
        role: 'master',
        wants: 'to establish, one way or the other, whether the fourth line is a step in the method',
        fears: 'proving it the way the Furnace Elder proved it',
        detail: 'Refines with the door propped open and a bucket of sand by her right foot, which is why she still has both hands.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Every mortal- and earth-grade formula in the Guild book, and the exact failure mode of each one.',
            mayNotSay: 'Which heaven-grade formulae the Guild privately knows are incomplete, which is a Furnace Elder\'s to disclose and never has been.',
            costsThem: 'Saying "recovered, not devised" out loud in the refining hall is a thing the Guild has formally censured two people for, and she has been censured once.'
        }
    },
    {
        id: 'member-liang-tuoshan',
        name: 'Liang Tuoshan',
        factionId: 'sect-cinnabar-crucible-guild',
        rankIndex: 4,
        rank: 'Furnace Elder',
        realmOrdinal: 21,
        role: 'senior',
        wants: 'to see one heaven-grade batch hold, in his lifetime, by any hand',
        fears: 'that the missing steps were removed on purpose',
        detail: 'Has kept every failed heaven-grade crucible for thirty years, numbered, in a locked room, and cannot say what he is looking for in them.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Ashen Forge Clan --------------------------------------------------
    {
        id: 'member-jin-erchun',
        name: 'Jin Erchun',
        factionId: 'sect-ashen-forge-clan',
        rankIndex: 0,
        rank: 'Coal Hand',
        realmOrdinal: 6,
        role: 'peer',
        wants: 'to be told, by anybody at the family table, that she is clan',
        fears: 'the answer being polite',
        detail: 'Married in six years ago and has fed the great furnace on the night shift ever since, because nobody born to it will take that shift.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-jin-tianlu',
        name: 'Jin Tianlu',
        factionId: 'sect-ashen-forge-clan',
        rankIndex: 1,
        rank: 'Smith',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'to leave',
        fears: 'what leaving costs a blood clan\'s son, which he has watched once already',
        detail: 'Carries a Clear River Alliance boat token in his belt that he has had for three years and never used.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-jin-genlin',
        name: 'Jin Genlin',
        factionId: 'sect-ashen-forge-clan',
        rankIndex: 3,
        rank: 'Hammer Master',
        realmOrdinal: 15,
        role: 'master',
        wants: 'to learn how the great furnace was originally lit',
        fears: 'it going out on his watch',
        detail: 'Has written down every method of lighting a cold furnace he has ever heard of, forty-one of them, and has tried none.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Metalwork, reforging field fragments, and every grade of edge the clan can currently produce, which is fewer than it used to be.',
            mayNotSay: 'The clan\'s tempering sequence, to anybody not born or married in, which is the one rule the Clan Chief has never bent.',
            costsThem: 'Teaching an outsider anything at all is argued about at the family table afterwards, and he is not the loudest man at that table.'
        }
    },
    {
        id: 'member-jin-wenqi',
        name: 'Jin Wenqi',
        factionId: 'sect-ashen-forge-clan',
        rankIndex: 4,
        rank: 'Cinder Elder',
        realmOrdinal: 19,
        role: 'senior',
        wants: 'the quarrel with the Azure Cloud Pavilion settled before she dies',
        fears: 'that the clan enjoys the quarrel more than it wants the trade',
        detail: 'Keeps the tally of Pavilion swords the clan has refused to repair. It stands at ninety-one and she has stopped saying it aloud.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Hollow Bell Wanderers ---------------------------------------------
    {
        id: 'member-hu-anzhou',
        name: 'Hu Anzhou',
        factionId: 'sect-hollow-bell-wanderers',
        rankIndex: 0,
        rank: 'Stray',
        realmOrdinal: 1,
        role: 'peer',
        wants: 'to eat twice a day',
        fears: 'winter',
        detail: 'Carries a bell he has not earned the right to hang, and hangs it at crossroads where he judges nobody will check.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-pu-meixi',
        name: 'Pu Meixi',
        factionId: 'sect-hollow-bell-wanderers',
        rankIndex: 0,
        rank: 'Stray',
        realmOrdinal: 3,
        role: 'peer',
        wants: 'the Sweptground Temple to have said yes, which it did not, for reasons nobody explained',
        fears: 'the Crimson Abyss Hall, which keeps a list of who was refused where and has her on it',
        detail: 'Keeps her four refusal chits in a wallet and produces them to strangers as credentials.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-zhan-deyi',
        name: 'Zhan Deyi',
        factionId: 'sect-hollow-bell-wanderers',
        rankIndex: 1,
        rank: 'Bellringer',
        realmOrdinal: 6,
        role: 'peer',
        wants: 'nothing much, and says so with a sincerity people find irritating',
        fears: 'a sect offering him a place',
        detail: 'Knows where nine crossroads bells hang and has re-hung all of them at least twice out of his own pocket.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-cao-nanshan',
        name: 'Cao Nanshan',
        factionId: 'sect-hollow-bell-wanderers',
        rankIndex: 2,
        rank: 'Wanderer',
        realmOrdinal: 11,
        role: 'rival',
        wants: 'to be the one who brings the Thousand Treasure Pavilion something worth a floor lot',
        fears: 'dying in a hole for a fragment worth eleven stones',
        detail: 'Has robbed two members of his own league and is still in it, because the Wanderers have no mechanism for expelling anybody.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'He has decided that anybody digging the same ground is taking a find that was going to be his.',
            beatableBecause: 'He works alone by necessity rather than by preference - the league tolerates him and nobody will stand beside him. He has never won a fight he did not start from behind, and the two people he robbed will both cheerfully say where he sleeps.'
        },
        teaching: null
    },
    {
        id: 'member-qu-yaoguang',
        name: 'Qu Yaoguang',
        factionId: 'sect-hollow-bell-wanderers',
        rankIndex: 3,
        rank: 'Road Elder',
        realmOrdinal: 14,
        role: 'master',
        wants: 'to teach one person to dig without dying of it',
        fears: 'that anyone she trains to Foundation Establishment is recruited away within the year, because they always are',
        detail: 'Prices her instruction by the hour in food rather than stones, and has never once been paid in stones.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'Sealed-site work, what a bad chamber smells like before it kills you, and every art the league holds, which is six.',
            mayNotSay: 'Nothing, formally. The league forbids nobody anything, which she points out is not generosity but the absence of an institution.',
            costsThem: 'The ones she teaches well leave within a year, and she teaches well, and she has done this eleven times.'
        }
    },
    {
        id: 'member-xun-zhenning',
        name: 'Xun Zhenning',
        factionId: 'sect-hollow-bell-wanderers',
        rankIndex: 4,
        rank: 'Bell Keeper',
        realmOrdinal: 13,
        role: 'senior',
        wants: 'ground, quietly, and would deny wanting it',
        fears: 'the league finding out he has been asking the Clear River Alliance about a hillside',
        detail: 'Presents the league\'s having no ground as a philosophy, and carries a survey map of an abandoned hillside in his pack.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Frostmirror Sect -------------------------------------------------
    {
        id: 'member-yue-linshuang',
        name: 'Yue Linshuang',
        factionId: 'sect-frostmirror-sect',
        rankIndex: 0,
        rank: 'Snow Servant',
        realmOrdinal: 14,
        role: 'peer',
        wants: 'to stop being grateful, which is the only thing anyone at the Court has ever asked of her',
        fears: 'leaving, and finding that the arts kill her outside the cold hall',
        detail: 'Has not been warm in four years, has stopped noticing, and other people notice within a minute of meeting her.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-ning-qianshu',
        name: 'Ning Qianshu',
        factionId: 'sect-frostmirror-sect',
        rankIndex: 1,
        rank: 'Mirror Disciple',
        realmOrdinal: 17,
        role: 'peer',
        wants: 'to be sent out to look for another mutated ice root, which the Court does once a decade',
        fears: 'finding one and being wrong about it',
        detail: 'Keeps a list of eleven names of people rumoured to have the root. Nine of them are dead and she has not crossed them off.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-bai-tuoyun',
        name: 'Bai Tuoyun',
        factionId: 'sect-frostmirror-sect',
        rankIndex: 4,
        rank: 'Frost Elder',
        realmOrdinal: 22,
        role: 'master',
        wants: 'the curriculum copied out in full before the glacier moves again',
        fears: 'that it was never complete and that the Court has been teaching a fragment for four hundred years',
        detail: 'Teaches in a hall cold enough to crack a cup, and provides the cups.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'The entire ice curriculum, which no other institution in the world holds any part of.',
            mayNotSay: 'He may not open the library to anyone without a mutated ice root, and the rule is medical rather than political.',
            costsThem: 'Explaining why he cannot teach you requires describing what the arts do to an ordinary root, and he has watched that happen once, to a friend.'
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOW FALL - DEMONIC
    // ═══════════════════════════════════════════════════════════════════

    // --- The Severed -------------------------------------------------------
    {
        id: 'member-han-shuqing',
        name: 'Han Shuqing',
        factionId: 'sect-the-severed',
        rankIndex: 0,
        rank: 'Bound',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'to stop being frightened of a ledger she has already signed',
        fears: 'the second cut, which is scheduled for the spring',
        detail: 'Has cut nothing yet, and introduces herself with her full name every time, twice, as though testing that it is still there.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-yi-first-cut',
        name: 'Yi, who was Shen Yi',
        factionId: 'sect-the-severed',
        rankIndex: 1,
        rank: 'First Cut',
        realmOrdinal: 12,
        role: 'peer',
        wants: 'to be told that the arithmetic is right',
        fears: 'meeting his sister at a market, which is why he takes no work north of the gorge',
        detail: 'Still writes the two characters of his surname on scrap paper and burns them, weekly. The Severed regard this as failure and do not forbid it.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-third-cut-at-scarwater',
        name: 'The Third Cut at Scarwater',
        factionId: 'sect-the-severed',
        rankIndex: 2,
        rank: 'Third Cut',
        realmOrdinal: 17,
        role: 'rival',
        wants: 'the cutting house at Low Fall, which is four times the size of his',
        fears: 'nothing he will name, which is the doctrine and is also not true',
        detail: 'Recites what he has given up to applicants, in order, as a sales pitch. The fourth item is a daughter.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'He recruits from the refused and the desperate, and somebody has begun getting to them first, which he takes as theft.',
            beatableBecause: 'He has cut so much that there is nobody left to call and nobody left to warn him, which is the doctrine working exactly as advertised. And the Severed show their ledger to applicants before anything else, so anybody willing to walk in and apply can read a full and accurate list of what he no longer has.'
        },
        teaching: null
    },
    {
        id: 'member-ninth-cut-ledger-keeper',
        name: 'The Ninth Cut who keeps the ledger',
        factionId: 'sect-the-severed',
        rankIndex: 3,
        rank: 'Ninth Cut',
        realmOrdinal: 24,
        role: 'master',
        wants: 'applicants to understand the terms before they sign, and is entirely sincere about it',
        fears: 'nothing available to him, which he states as an achievement rather than a boast',
        detail: 'Shows the ledger of what each member has given up before anything else, and will read it aloud, slowly, if asked.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Precisely what each cut costs, in what order they should be taken, and how much faster the road runs afterwards.',
            mayNotSay: 'He may not withhold the ledger from anybody who asks for it, which is doctrine and the only rule the Severed enforce internally.',
            costsThem: 'Nothing at all, and he says so, and that sentence is simultaneously the sales pitch and the warning.'
        }
    },

    // --- Crimson Abyss Hall ------------------------------------------------
    {
        id: 'member-tang-lingyun',
        name: 'Tang Lingyun',
        factionId: 'sect-crimson-abyss-hall',
        rankIndex: 0,
        rank: 'Blood Offering',
        realmOrdinal: 4,
        role: 'peer',
        wants: 'the stipend, which is four times what she was offered anywhere else',
        fears: 'finding out where the tithe comes from',
        detail: 'Refused by the Pavilion in spring, took the Hall\'s money in autumn, and has spent none of it: eleven months\' worth in a bag under a floorboard.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-ping-xingzhi',
        name: 'Ping Xingzhi',
        factionId: 'sect-crimson-abyss-hall',
        rankIndex: 1,
        rank: 'Crimson Servant',
        realmOrdinal: 9,
        role: 'peer',
        wants: 'any posting that is not the lower hall',
        fears: 'the drain in the floor of the lower hall',
        detail: 'Is the funniest man in the Hall, has six jokes, and has told them so often that the Hall Master can prompt him into any of them by clearing his throat.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-lin-mudan',
        name: 'Lin Mudan',
        factionId: 'sect-crimson-abyss-hall',
        rankIndex: 2,
        rank: 'Chosen',
        realmOrdinal: 14,
        role: 'rival',
        wants: 'to be Left Envoy inside twenty years',
        fears: 'being spent, which is what the Chosen are for',
        detail: 'Keeps the Hall\'s list of who was refused where, updates it herself in a fair hand, and recruits off it in person.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Somebody she approached said no, in front of two other people she was recruiting, and both of them then also said no.',
            beatableBecause: 'Her whole advantage is the list, and the list is a book in a room in a sinkhole under a town that officially does not know it is there. She also knows precisely what the Hall does with a Chosen who is damaged, so she will not take a risk that leaves a visible mark, and can be pushed into refusing a fight she would win.'
        },
        teaching: null
    },
    {
        id: 'member-zhu-renshan',
        name: 'Zhu Renshan',
        factionId: 'sect-crimson-abyss-hall',
        rankIndex: 3,
        rank: 'Hall Master',
        realmOrdinal: 17,
        role: 'master',
        wants: 'the supply quarrel with the Bone Lantern Cult settled by purchase rather than by killing',
        fears: 'the town above deciding that it does know',
        detail: 'Pays the town\'s night-soil contractor four times the going rate, personally, in cash, and has done for twenty years.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'The forbidden arts the Hall teaches, and exactly what each of them does to the person using it over twenty years.',
            mayNotSay: 'Where the tithe comes from, which is the Left Envoy\'s and above, and which he will decline to discuss in a way that makes clear he knows.',
            costsThem: 'A full answer about the tithe is the answer that loses him the Hall, and he has two children in the town above it.'
        }
    },
    {
        id: 'member-cui-fangzhi',
        name: 'Cui Fangzhi',
        factionId: 'sect-crimson-abyss-hall',
        rankIndex: 4,
        rank: 'Left Envoy',
        realmOrdinal: 20,
        role: 'senior',
        wants: 'the Abyss Lord to die',
        fears: 'the Abyss Lord not dying',
        detail: 'Has stopped eating anything the Hall\'s kitchen prepares and brings her own food in a covered box, which everyone has noticed and nobody mentions.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- Bone Lantern Cult -------------------------------------------------
    {
        id: 'member-shao-kongzhi',
        name: 'Shao Kongzhi',
        factionId: 'sect-bone-lantern-cult',
        rankIndex: 0,
        rank: 'Grave Digger',
        realmOrdinal: 3,
        role: 'peer',
        wants: 'to be moved off the sorting wall and onto the carts',
        fears: 'the third year after an engagement, which is when the Cult goes in',
        detail: 'Sorts fragments by weight as instructed, and has begun secretly sorting one corner of the field wall by what the pieces used to be.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-wu-liuyi',
        name: 'Wu Liuyi',
        factionId: 'sect-bone-lantern-cult',
        rankIndex: 1,
        rank: 'Lantern Bearer',
        realmOrdinal: 8,
        role: 'peer',
        wants: 'out',
        fears: 'the Verdant Spring Hall, which hunts the Cult on principle and does not check rank first',
        detail: 'Has a Verdant Spring herb boy\'s token she took off a body four years ago and has never dared sell.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-yu-ziyan',
        name: 'Yu Ziyan',
        factionId: 'sect-bone-lantern-cult',
        rankIndex: 2,
        rank: 'Bone Disciple',
        realmOrdinal: 12,
        role: 'rival',
        wants: 'the Gleaners\' Company driven off the border sites entirely',
        fears: 'the Company\'s factor at Scarwater, personally and by name',
        detail: 'Has killed two Gleaners in six years, can name them both, and does, at length, when drinking.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Sixty years of two outfits robbing each other across a border, narrowed down to whichever face he saw last.',
            beatableBecause: 'His method is ambush on ground he has already scouted, and he has no second plan for a fight that starts somewhere else. The Cult will not avenge him either: it follows wars at a respectful distance and files a dead disciple as a supply problem.'
        },
        teaching: null
    },
    {
        id: 'member-ye-puxian',
        name: 'Ye Puxian',
        factionId: 'sect-bone-lantern-cult',
        rankIndex: 3,
        rank: 'Corpse Warden',
        realmOrdinal: 15,
        role: 'master',
        wants: 'an apprentice who does not flinch in the first week',
        fears: 'the Pale Ancestor\'s tomb being opened by anybody, the Cult included',
        detail: 'The best grave-reader in the region, will say so, is right, and holds a farmer\'s hardcore contract to prove she is also a legitimate supplier.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'How to read a battlefield, a barrow and a sealed chamber, better than anybody in either region.',
            mayNotSay: 'The Pale Elders\' rotation, which is how the Cult stays unfound and is the only secret it actually keeps.',
            costsThem: 'An outsider who learns to read graves becomes competition, and the Cult\'s entire margin is that nobody else is willing to do the work.'
        }
    },

    // --- Nine Abyss Flame Sect ---------------------------------------------
    {
        id: 'member-tong-anze',
        name: 'Tong Anze',
        factionId: 'sect-nine-abyss-flame-sect',
        rankIndex: 0,
        rank: 'Kindling',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'the first transformation stage, which is nine years off at his rate',
        fears: 'reading the contract again',
        detail: 'Keeps his copy of the contract terms folded in his boot and has read it eleven times since signing.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-xiang-yunzhao',
        name: 'Xiang Yunzhao',
        factionId: 'sect-nine-abyss-flame-sect',
        rankIndex: 1,
        rank: 'Flame Servant',
        realmOrdinal: 15,
        role: 'peer',
        wants: 'the bridge repaired',
        fears: 'the bridge repaired, which would mean visitors',
        detail: 'Runs a book on how long each year\'s intake lasts, quotes odds on individuals to their faces, and pays out honestly.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-zhou-hongshi',
        name: 'Zhou Hongshi',
        factionId: 'sect-nine-abyss-flame-sect',
        rankIndex: 2,
        rank: 'Abyss Disciple',
        realmOrdinal: 20,
        role: 'rival',
        wants: 'a Flame Hall of his own before the transformation takes his face',
        fears: 'mirrors, which the sect does not keep',
        detail: 'Has begun to be recognisable, late on, by what has stopped being human about him, and has taken to a scarf.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'He has decided that somebody else is going to be given the hall he has been promised twice.',
            beatableBecause: 'The transformation trades reach for control: he burns very hot and cannot sustain it past about a quarter of an hour, after which he is slower than he was before he started. And the sect will not lift a finger for a disciple who loses - the contract terms say so in writing and he provides them on request.'
        },
        teaching: null
    },
    {
        id: 'member-tu-baochen',
        name: 'Tu Baochen',
        factionId: 'sect-nine-abyss-flame-sect',
        rankIndex: 3,
        rank: 'Flame Hall Master',
        realmOrdinal: 25,
        role: 'master',
        wants: 'an intake that has actually read the terms before arriving',
        fears: 'that the caldera vein is falling, which the last survey suggests and which he has not passed on',
        detail: 'Provides the contract terms in full, in writing, and makes every applicant read them aloud in front of two witnesses.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Fire arts to Deity Transformation, and the contract\'s whole schedule of costs, year by year, out to year sixty.',
            mayNotSay: 'The caldera\'s current output, which the Flame Sovereign has forbidden anyone to discuss since the survey.',
            costsThem: 'He signs the intake and is measured on it, so an honest answer about what the art has done to him by year forty costs him the disciples he is judged by.'
        }
    },

    // --- Storm Tyrant Sect ------------------------------------------------
    {
        id: 'member-tian-changgeng',
        name: 'Tian Changgeng',
        factionId: 'sect-storm-tyrant-sect',
        rankIndex: 0,
        rank: 'Rod Bearer',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'to write to his family, which is not forbidden and is not delivered',
        fears: 'the tether',
        detail: 'Was taken off a road at fifteen, has never been told he may leave, and has never asked.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-bo-shuyi',
        name: 'Bo Shuyi',
        factionId: 'sect-storm-tyrant-sect',
        rankIndex: 1,
        rank: 'Storm Servant',
        realmOrdinal: 14,
        role: 'peer',
        wants: 'to work out how the tether chain was made',
        fears: 'the annual inspection, at which somebody might notice the marks',
        detail: 'Has climbed the tether chain twice at night, further the second time, and has told exactly one person.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-du-yanzhi',
        name: 'Du Yanzhi',
        factionId: 'sect-storm-tyrant-sect',
        rankIndex: 2,
        rank: 'Arc Disciple',
        realmOrdinal: 18,
        role: 'rival',
        wants: 'the Thunder Warden\'s post at the tether',
        fears: 'the Frostmirror Sect, one of whose disciples beat her once in front of witnesses',
        detail: 'Has challenged the same Frostmirror Rime Disciple three times by letter and been ignored three times, and keeps the unanswered letters.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'She was beaten in public and has been assigning the blame outward, in widening circles, for six years.',
            beatableBecause: 'She fights to be watched and will not disengage in front of an audience, which everybody who has fought her twice already knows. Take the second fight somewhere with no witnesses and she will not start it; take it somewhere crowded and she will not stop it in time.'
        },
        teaching: null
    },
    {
        id: 'member-kang-lishu',
        name: 'Kang Lishu',
        factionId: 'sect-storm-tyrant-sect',
        rankIndex: 4,
        rank: 'Storm Elder',
        realmOrdinal: 21,
        role: 'master',
        wants: 'the tether understood before it fails',
        fears: 'it failing in his lifetime, which he has calculated is more likely than not',
        detail: 'Inspects the chain annually, writes the same report, and has now filed twenty-six identical reports.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'The world\'s only working lightning curriculum, to Nascent Soul, and the whole of the fragment the Court lives on.',
            mayNotSay: 'He may not teach an unmutated root, which is not a secret but a refusal: the Court has no interest and the arts kill everyone else.',
            costsThem: 'The Court treats a refusal as a scheduling matter, so a straight answer given to an outsider is read internally as a failure to collect them.'
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // DAO HOUSES
    // Smaller rosters, because a house is a profession before it is a
    // faction and the bottom of one is a clerk rather than a disciple.
    // ═══════════════════════════════════════════════════════════════════

    // --- The Ninefold Ledger -----------------------------------------------
    {
        id: 'member-shen-zhenyi',
        name: 'Shen Zhenyi',
        factionId: 'house-ninefold-ledger',
        rankIndex: 0,
        rank: 'Tallyhand',
        realmOrdinal: 6,
        role: 'peer',
        wants: 'a circuit posting, which means travel, a per diem, and being out of the building',
        fears: 'the published error rate, which is one in six and includes hers',
        detail: 'Has memorised the house\'s published error rate and quotes it to clients before they ask, which her superiors have twice asked her to stop doing.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-guan-boting',
        name: 'Guan Boting',
        factionId: 'house-ninefold-ledger',
        rankIndex: 1,
        rank: 'Reader of Threads',
        realmOrdinal: 12,
        role: 'peer',
        wants: 'to be moved off placement work and onto debt arbitration',
        fears: 'placing a Marches carver low and reading about the outcome',
        detail: 'Has one placement she got wrong four years ago; the man who relied on it is dead, and she keeps the case note in her own desk.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-tan-changshi',
        name: 'Tan Changshi',
        factionId: 'house-ninefold-ledger',
        rankIndex: 3,
        rank: 'Circuit Arbiter',
        realmOrdinal: 18,
        role: 'master',
        wants: 'the Weir Office to submit its rank table for certification, which it has never done',
        fears: 'being asked to certify an ancestral claim he cannot actually check',
        detail: 'Carries the certified border table on a single folded sheet and produces it in arguments the way other men produce a weapon.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'The certified band-for-band table between the two vocabularies, and every published dispute about it, including the house\'s own error rate.',
            mayNotSay: 'Anything about an open audit, and there is always an open audit, which he will say pleasantly and immediately.',
            costsThem: 'Stating in public that the Weir Office\'s table is revenue rather than scholarship is a claim the house would then have to back, and the house charges for backing claims.'
        }
    },

    // --- The House of the Narrow Hour ---------------------------------------
    {
        id: 'member-shu-chanming',
        name: 'Shu Chanming',
        factionId: 'house-narrow-hour',
        rankIndex: 0,
        rank: 'Watcher',
        realmOrdinal: 8,
        role: 'peer',
        wants: 'to see one convergence resolve, all the way through, once',
        fears: 'the count of advisers, which is eleven and has been falling for three centuries',
        detail: 'Sleeps in the afternoon so as to be awake for the hours the house considers narrow, and has not eaten a meal with anybody in a year.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-luo-hengzhi',
        name: 'Luo Hengzhi',
        factionId: 'house-narrow-hour',
        rankIndex: 1,
        rank: 'Sighting Disciple',
        realmOrdinal: 13,
        role: 'peer',
        wants: 'a straight answer from anybody in the house about anything at all',
        fears: 'becoming the sort of person who does not give one',
        detail: 'Answers direct questions directly, and has been formally told twice that this is not the house\'s manner.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-mei-shuangqing',
        name: 'Mei Shuangqing',
        factionId: 'house-narrow-hour',
        rankIndex: 2,
        rank: 'Reader of Hours',
        realmOrdinal: 19,
        role: 'master',
        wants: 'an apprentice who will still be here in forty years',
        fears: 'the discipline dying with the eleven',
        detail: 'Is the house\'s only reader in the Quiet Marches, has refused to publish a rank table eleven times, and can list the eleven occasions in order.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Convergence reading to the limit of what the house still holds, and will teach it to anybody who stays four years.',
            mayNotSay: 'She will not give a mapping between the two rank vocabularies, on the grounds that a rank is a position in a convergence rather than a title, and that both published tables answer a question nobody asked.',
            costsThem: 'Every hour spent on a beginner is an hour eleven advisers with no replacements do not have.'
        }
    },

    // --- The House of the Bound Word ----------------------------------------
    {
        id: 'member-lian-shouzhen',
        name: 'Lian Shouzhen',
        factionId: 'house-bound-word',
        rankIndex: 0,
        rank: 'Witness',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'to witness something that matters',
        fears: 'witnessing something that matters',
        detail: 'Has stood witness to four hundred and six contracts, all of them about grain, and recites the grain clause from memory in two dialects for entertainment.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-he-muyan',
        name: 'He Muyan',
        factionId: 'house-bound-word',
        rankIndex: 1,
        rank: 'Sworn Clerk',
        realmOrdinal: 12,
        role: 'peer',
        wants: 'to begin the forty years of oathwright training, which starts at thirty and he is twenty-nine',
        fears: 'the intake being cancelled, which it has been twice in his lifetime',
        detail: 'Has already bought the ink and the case, and keeps them on the shelf above his bed where visitors can see them.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-gong-liangfu',
        name: 'Gong Liangfu',
        factionId: 'house-bound-word',
        rankIndex: 2,
        rank: 'Oathwright',
        realmOrdinal: 18,
        role: 'master',
        wants: 'the training shortened, and argues for it annually, and loses annually',
        fears: 'a shortened oathwright writing a bad term',
        detail: 'Writes terms in a hand so plain it has become legally distinctive, and refuses to use the house\'s ceremonial script at all.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'What an oath binds to and what it does not, exactly, which almost nobody outside the house understands correctly.',
            mayNotSay: 'He may not draft anything for a party without the house\'s fee and the house\'s record of it, which is the whole institution.',
            costsThem: 'Explaining that most oaths in circulation bind nothing at all is bad for a business built on witnessing them, and he has been asked to stop saying it at markets.'
        }
    },

    // --- The House of the Quiet Cut ------------------------------------------
    {
        id: 'member-jia-changting',
        name: 'Jia Changting',
        factionId: 'house-quiet-cut',
        rankIndex: 0,
        rank: 'Holder of the Blade',
        realmOrdinal: 9,
        role: 'peer',
        wants: 'to know what the house has already had her do',
        fears: 'the answer',
        detail: 'Keeps a private diary in a cipher of her own invention, which is the one thing the house has not cut out of her, because it does not know it exists.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-shan-wuji',
        name: 'Shan Wuji',
        factionId: 'house-quiet-cut',
        rankIndex: 1,
        rank: 'Cutter',
        realmOrdinal: 14,
        role: 'peer',
        wants: 'a posting with paperwork in it',
        fears: 'being recut',
        detail: 'Is extremely funny about the house\'s filing system, which is the only subject anybody in it jokes about, and he has an audience of nine.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-liu-hengan',
        name: 'Liu Hengan',
        factionId: 'house-quiet-cut',
        rankIndex: 3,
        rank: 'Master of Removal',
        realmOrdinal: 22,
        role: 'master',
        wants: 'an audit of the house\'s own work, which he has now formally requested four times',
        fears: 'that the house has recut the same work six times and would have no way of knowing',
        detail: 'Keeps a tally of jobs he is certain he has done twice. It stands at nine, and he can prove none of them.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Severance in the technical sense: what a cut takes, what grows back, and how long the difference takes to show.',
            mayNotSay: 'Any client and any job, which the house enforces by cutting the discussion itself out of whoever had it.',
            costsThem: 'Describing severance accurately is how somebody learns to detect it, and not being detected is the entire product.'
        }
    },

    // --- The House of Held Names ---------------------------------------------
    {
        id: 'member-qi-anding',
        name: 'Qi Anding',
        factionId: 'house-held-names',
        rankIndex: 0,
        rank: 'Register Hand',
        realmOrdinal: 5,
        role: 'peer',
        wants: 'to be allowed to hold a name for a single day',
        fears: 'the register room, which she has been inside exactly once',
        detail: 'Knows the register\'s index by shelf and box number and has never been permitted to open one.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-bian-changle',
        name: 'Bian Changle',
        factionId: 'house-held-names',
        rankIndex: 1,
        rank: 'Namekeeper',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'a transfer to the ford office, where nobody argues',
        fears: 'Lantern Hall readers, who argue with him at markets and are better at it',
        detail: 'Has lost the same argument to the same Lantern Hall reader four times and goes back to the same market every season.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-xu-zhengsu',
        name: 'Xu Zhengsu',
        factionId: 'house-held-names',
        rankIndex: 3,
        rank: 'Warden of the Register',
        realmOrdinal: 18,
        role: 'master',
        wants: 'one clean handover of a name, done properly, in her career',
        fears: 'Lantern Hall publishing what the house holds',
        detail: 'Is an administrator rather than a cultivator, cannot fight at all, and says so within the first minute of meeting anyone.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'What a name is in the house\'s technical sense, what holding one does, and what happens to somebody whose name is held badly.',
            mayNotSay: 'Whose names the register holds, which is the house, entire.',
            costsThem: 'The honest answer to "do you hold mine" is one she is forbidden to give and cannot bring herself to lie about, so she changes the subject, and is transparently bad at it.'
        }
    },

    // --- The House of the Measured Span ---------------------------------------
    {
        id: 'member-cheng-tuoyi',
        name: 'Cheng Tuoyi',
        factionId: 'house-measured-span',
        rankIndex: 0,
        rank: 'Chain Bearer',
        realmOrdinal: 10,
        role: 'peer',
        wants: 'a span of her own to hold',
        fears: 'the Scarwater station never opening, which is nine years late',
        detail: 'Walks everywhere at a measured pace and counts, cannot stop, and has stopped apologising for it.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-fan-jingsheng',
        name: 'Fan Jingsheng',
        factionId: 'house-measured-span',
        rankIndex: 1,
        rank: 'Surveyor',
        realmOrdinal: 15,
        role: 'peer',
        wants: 'the border road courier run, which is four days rather than eleven',
        fears: 'the last forty li before Kettle, which are on nobody\'s survey',
        detail: 'Has walked the unsurveyed forty li twice, will not do it a third time, and will not say why.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-hao-lingchuan',
        name: 'Hao Lingchuan',
        factionId: 'house-measured-span',
        rankIndex: 2,
        rank: 'Span Master',
        realmOrdinal: 21,
        role: 'master',
        wants: 'the Scarwater station opened in his lifetime',
        fears: 'that the Clear River Alliance is right that it would end them, because he thinks it would',
        detail: 'Carries the chain itself on every journey, physically, and it weighs eleven catties.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Distance work and gate-standing to Nascent Soul, and the real cost of holding a span open for an hour.',
            mayNotSay: 'He may not open a span for anybody outside the house\'s published schedule, which is the only product the house sells.',
            costsThem: 'Nothing much, and he knows why: every honest description of what a span costs makes the fee sound reasonable, which is precisely why the house lets him talk.'
        }
    },

    // --- The Anchorhold --------------------------------------------------------
    {
        id: 'member-di-shizhen',
        name: 'Di Shizhen',
        factionId: 'house-anchorhold',
        rankIndex: 0,
        rank: 'Peg',
        realmOrdinal: 12,
        role: 'peer',
        wants: 'to finish the year\'s perimeter watch, which is the admission requirement and the cultivation method at once',
        fears: 'the eastern perimeter, where the barred lineage lives and nobody explains anything',
        detail: 'Has stood the watch eight months, goes six weeks at a stretch without speaking to a person, and has begun talking to the markers.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-yong-heshan',
        name: 'Yong Heshan',
        factionId: 'house-anchorhold',
        rankIndex: 1,
        rank: 'Holder',
        realmOrdinal: 17,
        role: 'peer',
        wants: 'a posting with other people in it',
        fears: 'being good at solitude',
        detail: 'Has an entire repertoire of perimeter jokes that only work if you have stood a watch, and tells them to everybody regardless.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-gan-suzhi',
        name: 'Gan Suzhi',
        factionId: 'house-anchorhold',
        rankIndex: 3,
        rank: 'Warden of the Survey',
        realmOrdinal: 23,
        role: 'master',
        wants: 'the last forty li surveyed and certified',
        fears: 'surveying them and finding out why nobody has',
        detail: 'Has the burn-edge survey drawn to the foot and a blank space after it, and shows the blank space to anybody who asks about the border.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Fixity, survey work, and how to stand a year\'s perimeter watch without coming off it strange.',
            mayNotSay: 'She may not certify anything past the burn edge, which is why the blank space is blank and why nothing sworn there binds.',
            costsThem: 'A straight answer about the unsurveyed forty li tells a smuggler exactly where oaths do not hold, and she is aware that this is why most people ask.'
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE QUIET MARCHES
    // Tool-names and face-numbers, no clan names, and a ceiling that
    // arrives four realms earlier than it does one province over.
    // ═══════════════════════════════════════════════════════════════════

    // --- The Weir Office ---------------------------------------------------
    {
        id: 'member-queue-bo',
        name: 'Queue Bo',
        factionId: 'sect-weir-office',
        rankIndex: 0,
        rank: 'Applicant',
        realmOrdinal: 3,
        role: 'peer',
        wants: 'a ticket',
        fears: 'the appeal form, which is logged and answered in years',
        detail: 'Has held the same place in the grant queue for two years and refuses on principle to sell it, and mentions the principle often.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-chisel-ma',
        name: 'Chisel Ma',
        factionId: 'sect-weir-office',
        rankIndex: 1,
        rank: 'Ticketed',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'forty days at the Gapwater face instead of eleven',
        fears: 'the dust-lung, which took her father at forty-one',
        detail: 'Rinses with vinegar four times a day rather than the usual two, and it has taken the enamel off her front teeth.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-third-face-ren',
        name: 'Third Face Ren',
        factionId: 'sect-weir-office',
        rankIndex: 2,
        rank: 'Standing Grant',
        realmOrdinal: 12,
        role: 'rival',
        wants: 'the Under-Warden\'s post, which allocates grant days',
        fears: 'losing the grant, which is the whole of what he is',
        detail: 'Holds a standing grant and sublets half his days at a markup, which is not permitted and is not policed.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Anybody new on the book is, in his arithmetic, holding days that were going to be his.',
            beatableBecause: 'Everything he has is one line in a grant book that is public, itemised and wholly discretionary, and the book can be read at the counter by anybody who queues. He does not have to be fought at all; he has to be reported, once, by somebody willing to stand in a queue for a morning.'
        },
        teaching: null
    },
    {
        id: 'member-kettle-shen',
        name: 'Kettle Shen',
        factionId: 'sect-weir-office',
        rankIndex: 3,
        rank: 'Under-Warden of the Weir',
        realmOrdinal: 15,
        role: 'master',
        wants: 'the grant book made non-discretionary, and has drafted the rule twice',
        fears: 'the Weir Master reading the drafts',
        detail: 'Is the clerk who is not empowered to make an exception and says so pleasantly, and means the pleasantly.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'The weir works, its seven live nodes, and exactly what a day of grant time buys at each of the two faces.',
            mayNotSay: 'He may not vary a grant by so much as an hour, which is the Weir Master\'s alone and is the reason the Office exists.',
            costsThem: 'Explaining the book honestly to a refused applicant is a conversation that ends with them understanding they will never be on it, and he has had it several hundred times.'
        }
    },
    {
        id: 'member-gapwater-yun',
        name: 'Gapwater Yun',
        factionId: 'sect-weir-office',
        rankIndex: 5,
        rank: 'Weir Master',
        realmOrdinal: 17,
        role: 'senior',
        wants: 'nothing to change',
        fears: 'the Low Fall working out what the two faces are worth',
        detail: 'Is the strongest thing anybody in the Marches has seen, has never left the region, and has been told what he would count for outside it and did not believe it.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- The Sixmile Wardens -------------------------------------------------
    {
        id: 'member-stakes',
        name: 'Stakes',
        factionId: 'sect-sixmile-wardens',
        rankIndex: 0,
        rank: 'Marker',
        realmOrdinal: 1,
        role: 'peer',
        wants: 'a proper name, and will not choose one',
        fears: 'nothing, visibly, which the older Wardens find alarming',
        detail: 'Fifteen years old, carries forty stakes and a paint pot, and has never been further out than the third marker.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-paint-hui',
        name: 'Paint Hui',
        factionId: 'sect-sixmile-wardens',
        rankIndex: 0,
        rank: 'Marker',
        realmOrdinal: 3,
        role: 'peer',
        wants: 'to be allowed onto the burn edge',
        fears: 'her mother finding out that she already has been',
        detail: 'Mixes the paint too thin to make it go further and has been told about it twice, by name, at the shed.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-ninth-marker-ji',
        name: 'Ninth Marker Ji',
        factionId: 'sect-sixmile-wardens',
        rankIndex: 1,
        rank: 'Warden',
        realmOrdinal: 6,
        role: 'peer',
        wants: 'to get through the year, having lost two friends to ground that moved',
        fears: 'wet winters, after which the edge moves faster',
        detail: 'Repaints the ninth marker twice a season though it does not need it, and the shed has stopped charging him for the paint.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-survey-wen',
        name: 'Survey Wen',
        factionId: 'sect-sixmile-wardens',
        rankIndex: 2,
        rank: 'Road Warden',
        realmOrdinal: 10,
        role: 'master',
        wants: 'the survey copied, so that it stops being one shed and one map',
        fears: 'the shed',
        detail: 'Keeps the only complete map of safe ground in the region in an unlocked shed at Sixmile, explains this once, free, and is visibly tired of explaining it.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'Every safe route through the Marches, and how to read ground that looks like ordinary heath and is not.',
            mayNotSay: 'She will not let the survey out of the shed, because there is one copy of it and nine hundred stakes depend on it.',
            costsThem: 'A day spent teaching is a day the stakes are not repainted, and the burn edge moves about a pace a year regardless of who is busy.'
        }
    },
    {
        id: 'member-longstake-mu',
        name: 'Longstake Mu',
        factionId: 'sect-sixmile-wardens',
        rankIndex: 3,
        rank: 'Warden of the Six Mile',
        realmOrdinal: 13,
        role: 'senior',
        wants: 'the Weir Office to pay for the paint its grantees walk in on',
        fears: 'dying and taking the uncopied parts of the survey with him',
        detail: 'Is the strongest Warden in the region and would be an outer disciple in the Low Fall, has been told so, and now says it first, as a joke.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // --- The Gleaners' Company ------------------------------------------------
    {
        id: 'member-barrow-nine',
        name: 'Barrow Nine',
        factionId: 'sect-gleaners-company',
        rankIndex: 0,
        rank: 'Barrow Hand',
        realmOrdinal: 2,
        role: 'peer',
        wants: 'one season without a loss in her crew',
        fears: 'the odds, which are one in nine a season and which she has done the arithmetic on',
        detail: 'Numbers her crews rather than naming them, because names turned out to be worse.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-sorting-yard-heng',
        name: 'Sorting Yard Heng',
        factionId: 'sect-gleaners-company',
        rankIndex: 0,
        rank: 'Barrow Hand',
        realmOrdinal: 4,
        role: 'peer',
        wants: 'never to go into a hole again',
        fears: 'being sent back down when the yard is quiet',
        detail: 'Prices salvage faster than the Factor does and says the numbers out loud uninvited, which the Factor tolerates because he is right.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-second-face-guo',
        name: 'Second Face Guo',
        factionId: 'sect-gleaners-company',
        rankIndex: 1,
        rank: 'Gleaner',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'eleven days\' cart fare to Scarwater and a start on the other side',
        fears: 'arriving there and being read one rank low by the insurance table',
        detail: 'Has the fare, in imported stones, and has had it for three years.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-lampblack-ke',
        name: 'Lampblack Ke',
        factionId: 'sect-gleaners-company',
        rankIndex: 2,
        rank: 'Deep Gleaner',
        realmOrdinal: 11,
        role: 'rival',
        wants: 'the Bone Lantern Cult off the border sites for a single season',
        fears: 'Yu Ziyan, by name, and says the name',
        detail: 'Has been robbed twice by the Cult, and has begun going armed and going first.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: {
            grievance: 'Two robberies, one of which cost a crew member, and a sixty-year feud he has decided to settle personally.',
            beatableBecause: 'He takes the ground everybody else refuses, which means he is usually already hurt by the time anyone meets him. The Company will not follow him either: it loses one in nine a season and does not spend people on grudges.'
        },
        teaching: null
    },
    {
        id: 'member-hollowmarket-zhai',
        name: 'Hollowmarket Zhai',
        factionId: 'sect-gleaners-company',
        rankIndex: 3,
        rank: 'Company Factor',
        realmOrdinal: 14,
        role: 'master',
        wants: 'the sealed part of the sorting-yard ruin opened, and argues himself out of it weekly',
        fears: 'that it was sealed for a reason',
        detail: 'Sorts, prices and buys in a yard he refuses to walk further into, and has drawn the line on the floor in the same paint the Wardens use.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: {
            knows: 'Sealed-site work, what a burn zone does to a body over a season, and the price of everything the region produces.',
            mayNotSay: 'The layout of the three worked nodes at the front of the ruin, because being the ones who know the way in is the Company\'s only advantage.',
            costsThem: 'Every gleaner he trains properly is one who survives long enough to buy a cart fare to Scarwater, and eleven have.'
        }
    },

    // ══════════════════════════════════════════════════════════════════
    // THE STRONGEST MEMBER OF EACH FACTION
    //
    // One per recruiting faction, at that faction's own ordinal, holding its
    // top rank. These are the people `powerOrdinal` has always been referring
    // to; until now the number named nobody and the cast stopped well short of
    // it, so a reader took the roster for the faction.
    //
    // Marked `outlier` because none of them came out of the pipeline that
    // produced everybody above: see the field comment on `MemberSchema`.
    // ══════════════════════════════════════════════════════════════════

    {
        id: 'member-ru-anwei',
        name: 'Ru Anwei',
        factionId: 'sect-azure-cloud-pavilion',
        rankIndex: 5,
        rank: 'Pavilion Master',
        realmOrdinal: 41,
        role: 'senior',
        wants: 'to be asked about something other than her sister, once',
        fears: 'that the Pavilion has confused holding the position with being the position, and that she is the confusion',
        detail: 'The younger sister, and the whole of the Pavilion above Nascent Soul. Sits in the inner hall with the Edge and has not left the peaks in ninety years.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-ji-wanniang',
        name: 'Ji Wanniang',
        factionId: 'sect-verdant-spring-hall',
        rankIndex: 5,
        rank: 'Hall Sovereign',
        realmOrdinal: 26,
        role: 'senior',
        wants: 'the day back when it was nine people and a valley',
        fears: 'that the Hall has become large enough that somebody will be turned away and she will not hear about it',
        detail: 'Treats nine patients a day at a table by the third spring, in rotation, without regard to who they are, and has refused every request to stop.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-duan-shiyin',
        name: 'Duan Shiyin',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 5,
        rank: 'Order Patriarch',
        realmOrdinal: 28,
        role: 'senior',
        wants: 'to be told the workings are empty',
        fears: 'Meng Da, awake and eight hundred years angry, which the Order has decided is not a fear because it cannot be acted on',
        detail: 'Carries the largest stone in the Order and has carried it since admission, which the younger ascetics take as doctrine and is in fact a wager she lost.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-old-ge-of-the-ninth-ford',
        name: 'Old Ge of the Ninth Ford',
        factionId: 'sect-clear-river-alliance',
        rankIndex: 5,
        rank: 'Alliance Head',
        realmOrdinal: 24,
        role: 'senior',
        wants: 'the fords kept open',
        fears: 'a Measured Span station at Scarwater, which would make every ford on the river a formality',
        detail: 'Still runs a boat, personally, on the least profitable crossing the Alliance keeps, and will not say why the Alliance keeps it.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-the-abbot',
        name: 'The Abbot',
        factionId: 'sect-sweptground-temple',
        rankIndex: 5,
        rank: 'Abbot',
        realmOrdinal: 30,
        role: 'senior',
        wants: 'nothing, stated plainly and believed by everyone who has asked',
        fears: 'that the First Abbot never crossed, and that four centuries of poor people have swept a yard for a story',
        detail: 'Sweeps the yard at dawn with the novices and eats standing from the same bowl, and has answered to no other name in forty years.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-warden-general-mo-ai',
        name: 'Warden-General Mo Ai',
        factionId: 'sect-lantern-hall',
        rankIndex: 5,
        rank: 'Hall Warden-General',
        realmOrdinal: 31,
        role: 'senior',
        wants: 'the register consulted rather than admired',
        fears: 'that writing a name down is a comfort to the Hall and nothing whatever to the person it belonged to',
        detail: 'Has personally written down eleven thousand names taken at crossings and can recite any of them on request, which she does, in full, when asked to justify the Hall.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-principal-hou-sanyi',
        name: 'Principal Hou Sanyi',
        factionId: 'sect-stonewright-consortium',
        rankIndex: 5,
        rank: 'Consortium Principal',
        realmOrdinal: 33,
        role: 'senior',
        wants: 'one more press, built rather than repaired',
        fears: 'that the presses are irreplaceable, which he has established privately and never written down',
        detail: 'Sets the rate personally every ninth day and has never delegated it, and weighs his own correspondence in front of whoever brought it.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-grand-steward-lei-fu',
        name: 'Grand Steward Lei Fu',
        factionId: 'sect-thousand-treasure-pavilion',
        rankIndex: 5,
        rank: 'Grand Steward',
        realmOrdinal: 27,
        role: 'senior',
        wants: 'a season without a Ledger auditor in the building',
        fears: 'the tablet hall, and what an audit of it would establish about forty years of provenance',
        detail: 'Appraises with gloves off and hands visibly shaking, which he has never explained and which has never once been wrong.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-grandmaster-xie-ruo',
        name: 'Grandmaster Xie Ruo',
        factionId: 'sect-cinnabar-crucible-guild',
        rankIndex: 5,
        rank: 'Guild Grandmaster',
        realmOrdinal: 25,
        role: 'senior',
        wants: 'the missing steps, in any form, from any source',
        fears: 'that they are not missing but withheld, and that the Guild has spent nine hundred years being permitted to fail',
        detail: 'Keeps both hands bandaged rather than the required one, and has done since the year she read the fourth line of the wall script aloud.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-clan-chief-duan-wu',
        name: 'Clan Chief Duan Wu',
        factionId: 'sect-ashen-forge-clan',
        rankIndex: 5,
        rank: 'Clan Chief',
        realmOrdinal: 23,
        role: 'senior',
        wants: 'a written record of the starting method',
        fears: 'the furnace going out on his rota, which is the only version of the fear anybody in the clan actually holds',
        detail: 'Takes his turn on the furnace rota like everyone else and has never once traded the shift, including the night his father died.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-bell-keeper-ji',
        name: 'Bell Keeper Ji',
        factionId: 'sect-hollow-bell-wanderers',
        rankIndex: 4,
        rank: 'Bell Keeper',
        realmOrdinal: 20,
        role: 'senior',
        wants: 'somebody to stay',
        fears: 'that the league is a waiting room, which he has worked out and has decided not to say to anybody who is still in it',
        detail: 'Hangs a bell at every crossroads he passes and has never returned to one, so nobody including him knows how many there are.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-court-sovereign-yan-shu',
        name: 'Court Sovereign Yan Shu',
        factionId: 'sect-frostmirror-sect',
        rankIndex: 5,
        rank: 'Court Sovereign',
        realmOrdinal: 34,
        role: 'senior',
        wants: 'more glacier',
        fears: 'that the curriculum is finite and that she is the one spending the last of it',
        detail: 'Holds the cold hall and does not sweep it, and can name the year each layer of dust arrived, which she does, unprompted, to visitors.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-the-one-who-introduces-herself-as-four-bonds-and-a-name',
        name: 'The one who introduces herself as four bonds and a name',
        factionId: 'sect-the-severed',
        rankIndex: 5,
        rank: 'The Severed Themselves',
        realmOrdinal: 38,
        role: 'senior',
        wants: 'the doctrine tested by somebody who is not already committed to it',
        fears: 'that it works, and that what arrives at the end will not be able to tell',
        detail: 'Gives the count and nothing else, and has given the same count for sixty years, which the Severed regard as either discipline or a lie.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-abyss-lord-wen-qiao',
        name: 'Abyss Lord Wen Qiao',
        factionId: 'sect-crimson-abyss-hall',
        rankIndex: 5,
        rank: 'Abyss Lord',
        realmOrdinal: 29,
        role: 'senior',
        wants: 'the righteous sects to keep refusing people',
        fears: 'that the tithe has to come from somewhere, and that the Hall is the nearest somewhere',
        detail: 'Sits at the recruiting table personally on admission days outside other sects, with the cash box, and pays out in coin she counts herself.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-the-cult-ancestor',
        name: 'The Cult Ancestor',
        factionId: 'sect-bone-lantern-cult',
        rankIndex: 5,
        rank: 'Cult Ancestor',
        realmOrdinal: 26,
        role: 'senior',
        wants: 'to be left to work',
        fears: 'the Crimson Abyss Hall, which hunts them over supply rather than principle and is much better at it',
        detail: 'Works battlefields in silence and talks continuously on the road back, and has never given a name to anybody outside the cult.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-flame-sovereign-rong-yi',
        name: 'Flame Sovereign Rong Yi',
        factionId: 'sect-nine-abyss-flame-sect',
        rankIndex: 5,
        rank: 'Flame Sovereign',
        realmOrdinal: 34,
        role: 'senior',
        wants: 'a successor named before the contract asks for one',
        fears: 'the Kindler waking for a reason nobody chose, with the caldera as the collateral',
        detail: 'Has no left hand and will not say what it went into, and signs with the right in front of witnesses to make the point that she can.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-the-storm-tyrant',
        name: 'The Storm Tyrant',
        factionId: 'sect-storm-tyrant-sect',
        rankIndex: 5,
        rank: 'Storm Tyrant',
        realmOrdinal: 34,
        role: 'senior',
        wants: 'the tether to hold one more century',
        fears: 'a Ledger certification of the vault, which would establish exactly what the Court has and what it does not',
        detail: 'Stands through every audience, indoors and out, and is audibly uncomfortable in still air - which visitors read as menace and is a tell.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-keeper-shen-muyan',
        name: 'Keeper Shen Muyan',
        factionId: 'sect-standing-grove',
        rankIndex: 3,
        rank: 'Keeper of the Grove',
        realmOrdinal: 27,
        role: 'senior',
        wants: 'to be asked rather than tested',
        fears: 'a small deniable test at the edge, public enough that not answering it becomes the answer',
        detail: 'Answers questions and asks none, including of people who have plainly come to test the zone, and has never once been the first to speak.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-weir-master-tan-zhu',
        name: 'Weir Master Tan Zhu',
        factionId: 'sect-weir-office',
        rankIndex: 5,
        rank: 'Weir Master',
        realmOrdinal: 21,
        role: 'senior',
        wants: 'the Gapwater survey to come back wrong in the good direction',
        fears: 'that the face is finite and that he has the figure, which he has not circulated',
        detail: 'Carries the current page of the grant book on his person at all times and will produce it mid-sentence, including at meals.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-warden-ai-sanniang',
        name: 'Warden Ai Sanniang',
        factionId: 'sect-sixmile-wardens',
        rankIndex: 3,
        rank: 'Warden of the Six Mile',
        realmOrdinal: 14,
        role: 'senior',
        wants: 'six more miles held',
        fears: 'the burn edge accelerating, which three Wardens have said aloud and the survey shed can prove',
        detail: 'Carries paint and a brush and stops mid-sentence to repaint a stake, which she has done in the middle of a negotiation twice.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-company-master-xun-erlang',
        name: 'Company Master Xun Erlang',
        factionId: 'sect-gleaners-company',
        rankIndex: 4,
        rank: 'Company Master',
        realmOrdinal: 17,
        role: 'senior',
        wants: 'a season without a death on the yard',
        fears: 'the sealed part of the sorting yard, and his brother, who went in on a wager thirty years ago',
        detail: 'Rinses with vinegar on the schedule and spits before speaking, including to his own people, including indoors.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-keeper-cao-duan',
        name: 'Keeper Cao Duan',
        factionId: 'house-ninefold-ledger',
        rankIndex: 5,
        rank: 'Keeper of the Ninefold Book',
        realmOrdinal: 32,
        role: 'senior',
        wants: 'the nine sealed volumes to stay sealed for one more Keeper',
        fears: 'that the Tally Court was not corrupt, and that the Ledger wrote the account that says otherwise',
        detail: 'Writes in front of whoever is speaking and reads the entry back before leaving, and has never left an entry unread in fifty years.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-first-sighting-yu-lian',
        name: 'First Sighting Yu Lian',
        factionId: 'house-narrow-hour',
        rankIndex: 5,
        rank: 'First Sighting',
        realmOrdinal: 30,
        role: 'senior',
        wants: 'a reading she does not have to hedge',
        fears: 'Cao Yin\u2019s sealed account of the year of the scar, which does not match what happened',
        detail: 'Sits facing away from whoever is speaking, on doctrine, and has never in her tenure turned around during a reading.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-keeper-shi-anren',
        name: 'Keeper Shi Anren',
        factionId: 'house-bound-word',
        rankIndex: 5,
        rank: 'Keeper of the Standing Word',
        realmOrdinal: 31,
        role: 'senior',
        wants: 'the founding oath revisited by somebody with standing to revisit it',
        fears: 'the unpublished treaty in the house vault, and the two transfers it permitted',
        detail: 'Will not answer a yes-or-no question with either word, and has held that through two arbitrations where it cost the house money.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-the-last-cut',
        name: 'The Last Cut',
        factionId: 'house-quiet-cut',
        rankIndex: 5,
        rank: 'The Last Cut',
        realmOrdinal: 33,
        role: 'senior',
        wants: 'the commissions to keep coming from the people who condemn them',
        fears: 'the register of absences, which cannot say what was removed and can say that something was',
        detail: 'Gives no name, is never seen twice with the same face, and takes work only through third parties, including from the houses that want the Cut destroyed.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-first-register-bai-yun',
        name: 'First Register Bai Yun',
        factionId: 'house-held-names',
        rankIndex: 5,
        rank: 'First Register',
        realmOrdinal: 29,
        role: 'senior',
        wants: 'to be paid for what Lantern Hall gives away',
        fears: 'erasure at the source, which has happened four times and left her holding an entry for nobody',
        detail: 'Recites the names she carries every morning, aloud, in order, and has not stumbled in thirty-one years.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-keeper-fu-nianzhi',
        name: 'Keeper Fu Nianzhi',
        factionId: 'house-measured-span',
        rankIndex: 5,
        rank: 'Keeper of the Long Measure',
        realmOrdinal: 34,
        role: 'senior',
        wants: 'the closed terminals opened from this side',
        fears: 'that they are closed from the other side, and that Fu Zhen is still on it',
        detail: 'Paces distances compulsively, indoors included, and has interrupted a negotiation to pace the room it was held in.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-the-standing-anchor',
        name: 'The Standing Anchor',
        factionId: 'house-anchorhold',
        rankIndex: 5,
        rank: 'The Standing Anchor',
        realmOrdinal: 35,
        role: 'senior',
        wants: 'the perimeters to hold',
        fears: 'two lost in one season, which is the published condition that wakes Xu Ci',
        detail: 'Stands through every meeting on doctrine, and has not sat down in the presence of another house in twenty years.',
        outlier: true,
        outlierReason: 'last_of_age',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // ── the Nine Peaks remnant core ────────────────────────────────────
    // Eleven of sixty-three formation nodes lit, and a production figure
    // seven rungs below where the Order stands. Both numbers have the same
    // cause: the Order did not make these people either. They came with the
    // mountains, from the house that held them before, and they are why a
    // sect whose pipeline tops out at twenty-one has a band at twenty-five
    // and above. This is what a remnant core is, and it is not rare.
    {
        id: 'member-shi-lianzhen',
        name: 'Shi Lianzhen',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 4,
        rank: 'Mountain Elder',
        realmOrdinal: 27,
        role: 'senior',
        wants: 'the peaks lit again, which she has costed and does not raise',
        fears: 'that the Order is a caretaker and that she is the caretaking',
        detail: 'Was a Peak Warden of the house that held these mountains before the Order did, and has never once said so to a disciple. She knows what thirty of the dark nodes were for.',
        outlier: true,
        outlierReason: 'remnant',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-lu-qianzhou',
        name: 'Lu Qianzhou',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 4,
        rank: 'Mountain Elder',
        realmOrdinal: 26,
        role: 'senior',
        wants: 'a disciple who can read the node script',
        fears: 'dying with the script unread, which he estimates is likely',
        detail: 'Carries a stone he did not choose at admission because he was not admitted - he was already here. He is the only person alive who has seen the workings lit, and he was a child.',
        outlier: true,
        outlierReason: 'remnant',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-cheng-wanru',
        name: 'Cheng Wanru',
        factionId: 'sect-nine-peaks-ascetic-order',
        rankIndex: 3,
        rank: 'Peak Warden',
        realmOrdinal: 25,
        role: 'senior',
        wants: 'to be treated as an ascetic rather than as an inheritance',
        fears: 'that the Order keeps her for what she remembers and not for what she does',
        detail: 'Answers to a rank the Order created for the remnants and gives it precedence over her old one, which nobody has used in ninety years and which she can still write.',
        outlier: true,
        outlierReason: 'remnant',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },

    // ── the Azure feeders ──────────────────────────────────────────────
    // Both Wardens are outliers marked `inherited`: neither pavilion produced
    // them. Pei Hanzhang came down from the terraces and stayed, and Shu
    // Wanping is descended from the woman the Dew counts its history by.
    {
        id: 'member-pei-hanzhang',
        name: 'Pei Hanzhang',
        factionId: 'sect-azure-mist-court',
        rankIndex: 4,
        rank: 'Court Warden',
        realmOrdinal: 27,
        role: 'senior',
        wants: 'the recall rate put in front of somebody at the terraces who can read it',
        fears: 'the day the Mist becomes interesting enough to be worth taking back',
        detail: 'Came down on probation at nineteen, was recalled, went back up, and asked to return - which the terraces recorded as a placement because there is no other word on the form.',
        outlier: true,
        outlierReason: 'inherited',
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-yu-shenxing',
        name: 'Yu Shenxing',
        factionId: 'sect-azure-mist-court',
        rankIndex: 3,
        rank: 'Mist Elder',
        realmOrdinal: 21,
        role: 'master',
        wants: 'one disciple who goes up and then writes',
        fears: 'that he teaches better than the terraces and that it makes no difference to anybody',
        detail: 'Keeps a list of every disciple he has sent back up, forty-one names, and has heard from four of them.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'The first two Pavilion forms properly, slowly, to people who have already failed them once, which is the thing the terraces cannot do.',
            mayNotSay: 'What the recall roll actually contains, because he has read it and it is not what the disciples are told.',
            costsThem: 'Every hour spent teaching is an hour not spent on his own probation term, which is posted on the wall like everybody else and has not been struck through in eleven years.'
        }
    },
    {
        id: 'member-tan-liuyi',
        name: 'Tan Liuyi',
        factionId: 'sect-azure-mist-court',
        rankIndex: 1,
        rank: 'Outer Disciple',
        realmOrdinal: 9,
        role: 'peer',
        wants: 'her term struck through',
        fears: 'being recalled before she is ready and failing at the terraces twice',
        detail: 'Wrote her probation term on the wall in a hand so small the Warden made her do it again, and has left the first one there underneath.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-kong-zhaoyu',
        name: 'Kong Zhaoyu',
        factionId: 'sect-azure-mist-court',
        rankIndex: 0,
        rank: 'Mist Servant',
        realmOrdinal: 4,
        role: 'peer',
        wants: 'to be told what he was refused for',
        fears: 'that the answer is nothing in particular',
        detail: 'Refused at the terraces without a stated reason, which the Mist wrote down as such, and he has read that line on his own file more times than anybody knows.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-shu-wanping',
        name: 'Shu Wanping',
        factionId: 'sect-azure-dew-sect',
        rankIndex: 4,
        rank: 'Sect Warden',
        realmOrdinal: 24,
        role: 'senior',
        wants: 'the four villages surveyed before anybody decides anything about them',
        fears: 'that the shallow vein is why the villages are there and that nobody has checked how much is left',
        detail: 'Descended from Shu Lianniang and mentions it only to explain why she will not leave, which she is asked roughly once a decade.',
        outlier: true,
        outlierReason: 'inherited',
        goodCompany: true,
        rivalry: null,
        teaching: null
    },
    {
        id: 'member-ao-jinglu',
        name: 'Ao Jinglu',
        factionId: 'sect-azure-dew-sect',
        rankIndex: 3,
        rank: 'Dew Elder',
        realmOrdinal: 19,
        role: 'master',
        wants: 'two more years in the third village before anybody is asked to join',
        fears: 'sending somebody up who was not ready and having it counted anyway',
        detail: 'Teaches in a village square rather than a hall, in all weather, and has never once held a class indoors.',
        outlier: false,
        outlierReason: null,
        goodCompany: true,
        rivalry: null,
        teaching: {
            knows: 'The gathering manual to the bottom and the tempering scripture as far as anybody in a village will ever need it.',
            mayNotSay: 'Which of the village children he has already decided about, because saying so changes them.',
            costsThem: 'He is the only Dew Elder who has never asked to be posted up the gorge, and every year he does not ask makes the asking harder.'
        }
    },
    {
        id: 'member-huan-shiqing',
        name: 'Huan Shiqing',
        factionId: 'sect-azure-dew-sect',
        rankIndex: 1,
        rank: 'Outer Disciple',
        realmOrdinal: 7,
        role: 'peer',
        wants: 'the Mist year skipped',
        fears: 'arriving at the terraces as a Dew admission and being read as one',
        detail: 'Was found at eleven and admitted at thirteen, and has been told the route up runs through the Mist so many times that she can recite the reasons and does, mockingly.',
        outlier: false,
        outlierReason: null,
        goodCompany: false,
        rivalry: null,
        teaching: null
    }
];

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const MEMBER_BY_ID: ReadonlyMap<string, Member> = new Map(MEMBERS.map(m => [m.id, m]));

const MEMBERS_BY_FACTION: ReadonlyMap<string, readonly Member[]> = (() => {
    const map = new Map<string, Member[]>();
    for (const member of MEMBERS) {
        const list = map.get(member.factionId);
        if (list) list.push(member);
        else map.set(member.factionId, [member]);
    }
    return map;
})();

export function getMember(id: string): Member | undefined {
    return MEMBER_BY_ID.get(id);
}

export function requireMember(id: string): Member {
    const member = MEMBER_BY_ID.get(id);
    if (!member) throw new Error(`Unknown member: ${id}`);
    return member;
}

/** Everybody named inside one faction, bottom rank first. */
export function getMembersOf(factionId: string): readonly Member[] {
    return MEMBERS_BY_FACTION.get(factionId) ?? [];
}

/** Which region a member stands in, resolved through their faction. */
export function getMemberRegionId(memberId: string): string | undefined {
    const member = MEMBER_BY_ID.get(memberId);
    if (!member) return undefined;
    return getRegionForFaction(member.factionId)?.id;
}

/** Everybody in a region, across every faction seated there. */
export function getMembersInRegion(regionId: string): Member[] {
    return MEMBERS.filter(m => getRegionForFaction(m.factionId)?.id === regionId);
}

export function getMembersByRole(role: FactionMemberRole): Member[] {
    return MEMBERS.filter(m => m.role === role);
}

/**
 * People a cultivator at this ordinal can actually meet on level ground:
 * close enough that neither party is unfightable, which is the band where
 * friendship, debt and murder are all still available.
 *
 * The default spread of four rungs is one realm at the top of the ladder and
 * a third of Qi Condensation at the bottom, which is about right - a Layer 2
 * and a Layer 6 are peers, a Layer 2 and a Foundation cultivator are not.
 */
export function getPeersAt(ordinal: number, spread = 4): Member[] {
    const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
    return MEMBERS.filter(m => Math.abs(m.realmOrdinal - clamped) <= spread);
}

/** Personal opposition seated in this region, lowest realm first. */
export function getRivalsIn(regionId: string): Member[] {
    return getMembersInRegion(regionId)
        .filter(m => m.role === 'rival')
        .sort((a, b) => a.realmOrdinal - b.realmOrdinal);
}

/** Everyone in this region who will teach, and on what terms. */
export function getMastersIn(regionId: string): Member[] {
    return getMembersInRegion(regionId)
        .filter(m => m.role === 'master')
        .sort((a, b) => a.realmOrdinal - b.realmOrdinal);
}

/**
 * Whether this member's realm is plausible for their rank and their faction.
 * The catalog test asserts it for every entry; the helper is exported so a
 * generator adding people later fails the same way.
 */
export function realmIsPlausible(member: Member): boolean {
    const band = rankRealmBand(member.factionId, member.rankIndex);
    if (!band) return false;
    return member.realmOrdinal >= band.minOrdinal && member.realmOrdinal <= band.maxOrdinal;
}

/** Whether the denormalised rank string still matches the faction's ladder. */
export function rankNameIsCurrent(member: Member): boolean {
    const sect = getSect(member.factionId);
    if (!sect) return false;
    return sect.ranks[member.rankIndex] === member.rank;
}

/** Head count per faction, for the content smoke test and tool responses. */
export function memberCountsByFaction(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [factionId, list] of MEMBERS_BY_FACTION) out[factionId] = list.length;
    return out;
}

/**
 * A one-line rendering, for a narrator that needs the whole person in a
 * sentence rather than an object. Deliberately terse: these people are meant
 * to be cheap to hold in mind alongside everything else in a scene.
 */
export function describeMember(id: string): string | undefined {
    const member = MEMBER_BY_ID.get(id);
    if (!member) return undefined;
    const sect = requireSect(member.factionId);
    return `${member.name}, ${member.rank}, ${sect.name}. Wants ${member.wants}. Fears ${member.fears}. ${member.detail}`;
}
