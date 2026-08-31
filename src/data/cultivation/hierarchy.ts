/**
 * Governance: who holds the water, and on what terms.
 *
 * FOUR MODELS, ALL PRESENT IN THE CATALOG
 * ---------------------------------------
 *   federated     an apex holds the vein system, courts administer arterial
 *                 veins, sects hold single veins at sufferance. Stable because
 *                 subsidiaries compete for standing rather than for veins, and
 *                 a parent that wants one gone stops renewing rather than
 *                 attacking. This is the Low Fall.
 *
 *   administered  a power holds its territory itself: no client sects, no
 *                 courts, no leases. Nothing is skimmed and it gets its own
 *                 reports, but it does all the work, owns every act by name,
 *                 and has no feeder - so it recruits directly. This is the
 *                 Quiet Marches, and it is taut: five provinces on a posted
 *                 staff small enough to name.
 *
 *   deference     direct rule by respect. A small sect administers only what
 *                 it can comfortably walk and holds a far larger zone because
 *                 nobody is willing to find out what happens otherwise. The
 *                 claim is worth exactly as much as the last time it was
 *                 tested, and beliefs decay. This is the Standing Grove.
 *
 *   unassailable  holds the ground outright, answers to nobody, and pays
 *                 nothing to anyone. Not a lease, not a claim, and not a
 *                 belief that could decay: the occupants are individually
 *                 stronger than anything that could be sent, everyone has
 *                 done the arithmetic, and nobody raises it. This is the
 *                 Hollow Court, and it is the only faction in the world that
 *                 sits on the vein it sits on because nothing can move it.
 *
 *   unbacked      holds no vein from anyone, answers to nobody, and pays for
 *                 it continuously - which is the whole difference from the
 *                 model above. Each survivor has ONE specific reason it has
 *                 not been absorbed, and for most of them the reason is that
 *                 it has not been worth the trouble yet. An unbacked sect is
 *                 tolerated. An unassailable one is not being tolerated by
 *                 anybody; the question does not arise.
 *
 * The felt difference is the deliverable. Under a federated power there is a
 * local sect to belong to and somebody nearby to petition. Under direct rule
 * there is no intermediate institution at all: joining a federated power means
 * joining a sect, and joining a direct ruler means being processed.
 *
 * THE PYRAMID
 * -----------
 * The federated stack is the vein network:
 *
 *   an apex institution        ancient, holds the vein system entire
 *     its courts               each administers one arterial vein
 *       the sects beneath      each holds a single vein, at sufferance
 *         unaffiliated locals  hold nothing, and are tolerated
 *
 * A subsidiary does not own its vein. It HOLDS one, on terms, from something
 * above it. That is why the map is not permanently on fire despite a vein loss
 * collapsing a sect within a generation: most sects are not competing for
 * veins at all. They are competing for standing with whoever grants them, and
 * a parent that wants a subsidiary gone does not attack it. It stops renewing.
 *
 * WHAT IS ABOVE THE MAP
 * ---------------------
 * The apex institutions in this file are not somewhere else on the map. They
 * are above it, and a starting cultivator DOES NOT KNOW THEY EXIST - not "has
 * not visited": the names have never been said in front of them. Every entry
 * therefore carries an `awareness` tier from `docs/world/discovery.md`:
 *
 *   unaware -> whisper -> named -> placed -> encountered -> known
 *
 * and `actsWithoutAttribution`, which is how an apex reaches a player who
 * cannot name it: a renewal denied, a road closed, a price that moves, an
 * elder who comes back from a journey changed and will not say where. The
 * narrator may use those freely. The narrator may not use the names.
 *
 * THE RECONTEXTUALISATION
 * -----------------------
 * The Kiln Wardens are already in the sect catalog as an eccentric local order
 * that guards the deep vein at the world's root, draws nothing from it, lights
 * every node it holds and does not recruit. They are not eccentric and they are
 * not local. They are a court, stationed, and when a player finally learns that
 * their province is a tenancy, the Wardens are the piece of evidence that was
 * sitting in plain view the whole time.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { TraditionIdSchema } from './traditions.js';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/** The ladder of knowing, from `docs/world/discovery.md`. */
export const AwarenessSchema = z.enum([
    'unaware',
    'whisper',
    'named',
    'placed',
    'encountered',
    'known'
]);
export type Awareness = z.infer<typeof AwarenessSchema>;

export const HierarchyRelationSchema = z.enum([
    'apex',           // holds the vein system, or holds a territory directly
    'court',          // administers one arterial vein on a federated apex's behalf
    'subsidiary',     // holds a single vein, on terms, from a court or a sect
    'administration', // an organ of a direct ruler: staff, not a vassal
    'contracted',     // works for a direct ruler under contract, not a lease
    'unaffiliated',   // holds nothing, tolerated, pays for it continuously
    'outside'         // holds no vein by nature - the Dao houses sell services
]);
export type HierarchyRelation = z.infer<typeof HierarchyRelationSchema>;

/** The four governance models. Every faction is marked with exactly one. */
export const GovernanceModelSchema = z.enum([
    'federated',
    'administered',
    'deference',
    'unassailable',
    'unbacked',
    'outside'
]);
export type GovernanceModel = z.infer<typeof GovernanceModelSchema>;

/**
 * Why an unbacked sect has not been absorbed. Each survivor gets exactly one,
 * and it must be specific: general resilience is not a reason.
 */
export const UnbackedReasonSchema = z.enum([
    'too_poor_to_be_worth_taking',
    'too_remote',
    'useful_to_everyone_aligned_with_none',
    'holding_something',
    'arrangement_that_is_not_patronage',
    'not_worth_the_trouble_yet'
]);
export type UnbackedReason = z.infer<typeof UnbackedReasonSchema>;

export const GrantTermsSchema = z.object({
    /** Paid in stones per year, or 0 where tribute is taken in kind. */
    tributeStonesPerYear: z.number().int().min(0),
    /** Taken in kind: labour, materials, access, silence. */
    inKind: z.array(z.string().min(15)),
    /** Disciples owed upward per cycle, which is the feeder made contractual. */
    disciplesPerCycle: z.number().int().min(0),
    /** What the holder actually gets, which is the whole reason to accept. */
    buys: z.array(z.string().min(20)),
    /** Cadence, and what non-renewal means in practice. */
    renewal: z.string().min(60)
});
export type GrantTerms = z.infer<typeof GrantTermsSchema>;

export const ParentageSchema = z.object({
    factionId: z.string(),
    governance: GovernanceModelSchema,
    relation: HierarchyRelationSchema,
    /** Null for apex institutions and for anyone holding nothing. */
    parentFactionId: z.string().nullable(),
    /** What they hold, and in whose gift it is. */
    holds: z.string().min(40),
    terms: GrantTermsSchema.nullable(),
    standing: z.enum(['good', 'strained', 'probationary', 'lapsed', 'not_applicable']),
    /** How aware this faction is of the apex above it. Most are not. */
    awarenessOfApex: AwarenessSchema,
    /** For the unaffiliated: what independence actually costs them. */
    costOfIndependence: z.string().nullable(),
    /** Unbacked only: the one specific reason nobody has taken them. */
    unbackedReason: UnbackedReasonSchema.nullable(),
    /**
     * Unbacked only. Independence is a real value and a real vanity: some are
     * proud of it and are respected in a slightly pitying way, and some would
     * take a backer tomorrow if one were offered.
     */
    independenceStance: z.enum(['proud', 'would_take_a_backer', 'indifferent']).nullable(),
    note: z.string().min(40)
});
export type Parentage = z.infer<typeof ParentageSchema>;

export const ApexRankSchema = z.object({
    title: z.string().min(1),
    /** What actually decides this rank. Never the ordinal. */
    decidedBy: z.string().min(30),
    note: z.string().min(30)
});
export type ApexRank = z.infer<typeof ApexRankSchema>;

export const ApexInstitutionSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    traditionId: TraditionIdSchema,
    /**
     * Realm ordinal of the strongest member, on the same scale a sect's
     * `powerOrdinal` uses. An apex is measured because a grant is only worth
     * something if the granter can take it back: authority over a vein has to
     * be enforceable, or it is a letter. This is what makes the governance
     * stack and the power table one ranking rather than two.
     *
     * It sits in the band the visible world reads as empty. Nobody at an apex
     * is ever seen, which is the whole reason no sect can name what is above
     * it - not that the band is unoccupied, but that its occupants do not act.
     */
    powerOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** What it holds, which is never a single vein. */
    holds: z.string().min(80),
    /** Its courts, by id. */
    courtIds: z.array(z.string()),
    /**
     * Rank ladder. At an apex this is NOT derived from realm: everyone below a
     * high realm is simply a disciple, and position inside that vast class is
     * decided by service, sponsorship and results.
     */
    ranks: z.array(ApexRankSchema),
    rankIsOrdinalDerived: z.literal(false),
    /** The ordinal above which rank and realm begin to converge again. */
    ranksByRealmAboveOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    rankNote: z.string().min(120),
    /** Default awareness for a starting cultivator. Always 'unaware'. */
    startingAwareness: z.literal('unaware'),
    /** Where a name could legitimately come from, if it ever does. */
    awarenessSources: z.array(z.string().min(30)),
    /** How it reaches a player who cannot name it. */
    actsWithoutAttribution: z.array(z.string().min(40)),
    description: z.string().min(150)
});
export type ApexInstitution = z.infer<typeof ApexInstitutionSchema>;

export const CourtSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    apexId: z.string(),
    /**
     * Strongest member, same scale as everywhere else. A court has to outrank
     * every sect holding from it, or non-renewal is a suggestion.
     */
    powerOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** The arterial vein it administers. */
    administers: z.string().min(40),
    /** Region id whose sects hold from it. */
    grantsInRegionId: z.string(),
    /** A faction in the sect catalog that IS this court, where one is. */
    embodiedByFactionId: z.string().nullable(),
    startingAwareness: AwarenessSchema,
    description: z.string().min(120)
});
export type Court = z.infer<typeof CourtSchema>;

export const GuestElderSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    realmOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    traditionId: TraditionIdSchema,
    /** The faction hosting them. They are not a member of it. */
    hostFactionId: z.string(),
    provides: z.string().min(60),
    receives: z.string().min(60),
    term: z.string().min(40),
    /** Why the host is nervous. */
    hostRisk: z.string().min(60),
    /** Why the guest is nervous. */
    guestRisk: z.string().min(60),
    /** What happens if they walk out mid-crisis. Formally: nothing. */
    leaveClause: z.string().min(80)
});
export type GuestElder = z.infer<typeof GuestElderSchema>;

// ─────────────────────────────────────────────────────────────────────────
// APEX INSTITUTIONS
// Two, one per tradition, and neither is reachable. A player who learns one
// name has had the single largest revelation available to them.
// ─────────────────────────────────────────────────────────────────────────

export const APEX_INSTITUTIONS: readonly ApexInstitution[] = [
    {
        id: 'apex-deep-survey',
        name: 'The Deep Survey',
        traditionId: 'tradition-drawn',
        // Tribulation Transcendence Late. Above the Hollow Court, which is the
        // ceiling of the visible world, and above every court and tenant beneath
        // it - the Survey can end a four-hundred-year sect by declining to sign,
        // and this is the number that says the sect could not answer.
        powerOrdinal: 43,
        holds:
            'The arterial system: not the eleven veins of the Low Fall but the four beneath them that the eleven branch from, and the datum every survey in the province is ultimately measured against without knowing whose datum it is.',
        courtIds: ['court-third-sill', 'court-root-sill'],
        ranks: [
            { title: 'Unplaced', decidedBy: 'arrival, and nothing else. Everyone begins here and most people stay.', note: 'The class that contains almost everybody, at every realm from Qi Condensation to Deity Transformation.' },
            { title: 'Marked', decidedBy: 'a sponsor willing to attach their own standing to yours', note: 'The first mark is somebody else\'s risk taken on your behalf, and it can be withdrawn.' },
            { title: 'Second Mark', decidedBy: 'results: surveys completed, grants administered, errors not made', note: 'Where a competent person spends sixty years without embarrassment.' },
            { title: 'First Mark', decidedBy: 'service of a kind the Survey does not describe in writing', note: 'First Marks give instruction to Second Marks regardless of the realms involved, and this is not remarked upon.' },
            { title: 'Sill-Sworn', decidedBy: 'appointment to a court, which is a posting rather than an honour', note: 'The rank at which realm finally begins to matter again, because the work begins to require it.' },
            { title: 'Surveyor', decidedBy: 'the previous Surveyor of that arterial, and nothing else', note: 'Four of them. One per arterial vein.' }
        ],
        rankIsOrdinalDerived: false,
        ranksByRealmAboveOrdinal: 29,
        rankNote:
            'Below Void Refinement the Survey does not rank by cultivation at all. Everyone from a village Qi Condensation intake to a Deity Transformation elder brought in from a subsidiary is Unplaced or Marked, and where they stand inside that class is decided by sponsorship, results and service. A Core Formation cultivator taking correction from a Foundation Establishment First Mark is an ordinary Tuesday and nobody in the room finds it strange. The one number a cultivator has spent their whole life raising simply does not determine where they stand here, and arriving with the opposite assumption is the mistake every intake makes in its first month.',
        startingAwareness: 'unaware',
        awarenessSources: [
            'a sect elder who has been called upward and returned, who will not say where they went',
            'an inscription in a sealed site older than the province, using a survey datum nobody local can place',
            'the Anchorhold, which has noticed that its datum stone refers to a survey it does not hold and has never published the observation',
            'a grant renewal document, if a disciple is ever careless enough to leave one where an outer disciple can read it'
        ],
        actsWithoutAttribution: [
            'a sect that has held its mountain for four hundred years is gone in a season, and no battle was fought and nobody will say why',
            'the price of assayed stones moves across the whole province in the same week, in a direction that suits nobody who trades in them',
            'a road through a working vein is closed for a year, by nobody in particular, and reopens with the ground altered',
            'an elder returns from a journey nobody was told about, promotes two disciples, and stops attending the sect council'
        ],
        description:
            'The institution that holds the water. It does not appear in any market-town account of the world, its name is not spoken at an outer gate, and the sects of the Low Fall experience it as the weather: grants that are renewed, occasionally are not, and are never explained. It is ancient in the way the province is not, it survived whatever made the age late, and it regards a four-hundred-year-old sect mountain the way that sect regards a tenant farmer with a good record.'
    },
    {
        id: 'apex-long-cut',
        name: 'The Long Cut',
        traditionId: 'tradition-cut',
        // One rung below the Deep Survey and by the same logic. The Long Cut
        // administers everything itself, so its floor is not what its tenants
        // can field - it has none - but what it must be able to walk into.
        powerOrdinal: 42,
        holds:
            'Driven ground, directly: every province where the qi went into the stone rather than staying in the air, of which the Quiet Marches is one and not the largest, administered face by face with no client sects, no leases and no vassals anywhere in the arrangement.',
        courtIds: ['court-ninth-face'],
        ranks: [
            { title: 'Hand', decidedBy: 'being present on a face and working it, and nothing else whatsoever', note: 'Everyone below the top, at every realm, and the Long Cut sees no reason to subdivide people by how much qi they hold.' },
            { title: 'Set Hand', decidedBy: 'a face worked to completion without a death on it, recorded by date', note: 'The first distinction, and it is a record of work rather than a rank of person.' },
            { title: 'Face Master', decidedBy: 'assignment to a face, which is given by the schedule and taken back by it', note: 'A Face Master at Foundation Establishment directs Hands at Core Formation, because the face is what is being ranked.' },
            { title: 'Course Keeper', decidedBy: 'the schedule itself: who is trusted with a century of it, decided upward', note: 'The rank at which a person stops being told where to cut.' }
        ],
        rankIsOrdinalDerived: false,
        ranksByRealmAboveOrdinal: 33,
        rankNote:
            'The Long Cut ranks by work and by nothing else, which carvers consider obvious and every visiting Drawn cultivator finds insulting. Four titles cover every practitioner in every driven province, so a Hand may be an apprentice of nineteen or an Inner Face cultivator of four hundred, and the institution does not distinguish them in writing. Standing is what you have finished. A carver who has held a face for a century and a carver who arrived last spring are both Hands until a face is completed, and the century does not count for anything at all.',
        startingAwareness: 'unaware',
        awarenessSources: [
            'the Weir Office grant book, whose renewals are countersigned by an office it never names',
            'a Gleaners salvage crew that opened something and found the schedule already written on the wall in a hand nobody uses',
            'a Long Cut inspection, which happens roughly twice a century and is mistaken locally for a rich merchant party'
        ],
        actsWithoutAttribution: [
            'the Weir Office abruptly stops issuing grants for a season and gives no reason, having been given none',
            'a burn zone the Gleaners have worked for forty years is suddenly staked and posted, and the stakes are not Sixmile work',
            'a face nobody could work is found open, worked out and abandoned, with the spoil stacked in courses too neat for a local crew'
        ],
        description:
            'The other apex, over the other tradition, and it does not do any of this the way the Deep Survey does. The Long Cut grants nothing to anyone. It holds driven ground across five provinces itself, administers every face itself, and deals with the people on them itself, which means nothing is skimmed and it reads its own reports - and means it must do all of the work with a posted staff of about forty. It is consequently taut, extremely legalistic, and almost impossible to provoke: it owns every act by name, so it does very little quickly. There is no intermediate institution anywhere in the Quiet Marches. A carver\'s relationship is with the large thing itself, which is impersonal, consistent, and does not know their name.'
    }
];

/** The courts. Each administers one arterial vein on an apex's behalf. */
export const COURTS: readonly Court[] = [
    {
        id: 'court-third-sill',
        name: 'The Third Sill',
        apexId: 'apex-deep-survey',
        // Grand Ascension Late. Its strongest tenant is the Storm Tyrant Court at
        // Body Integration Perfection, and a court that could not answer its own
        // tenant would be issuing suggestions rather than grants.
        powerOrdinal: 38,
        administers: 'The third arterial vein, which the eleven surveyed veins of the Low Fall branch from.',
        grantsInRegionId: 'region-low-fall',
        embodiedByFactionId: null,
        startingAwareness: 'unaware',
        description:
            'The office the Low Fall actually holds from, though no sect in the province would put it that way and most would deny the framing. Grants are issued in writing, renewed on a twelve-year cycle, and delivered by a courier who does not stay for an answer. The Sill has never been to the province. It has never needed to.'
    },
    {
        id: 'court-root-sill',
        name: 'The Root Sill',
        apexId: 'apex-deep-survey',
        powerOrdinal: 37,
        administers: 'The datum itself: the deep vein at the world\'s root that the arterial system is measured from.',
        grantsInRegionId: 'region-low-fall',
        embodiedByFactionId: 'sect-kiln-wardens',
        startingAwareness: 'unaware',
        description:
            'The court nobody in the province has recognised as a court. The Kiln Wardens hold every node lit, draw nothing from the richest ground in the world, make no ancestral claim, refuse all applicants, have no grievance in nine hundred years of outside record, and have never been observed making an exchange of any kind - because they are not a faction with strange habits. They are staff, posted, doing an assigned job on someone else\'s datum, and every single thing the province finds inexplicable about them is explained by that sentence.'
    },
    {
        id: 'court-ninth-face',
        name: 'The Ninth Face',
        apexId: 'apex-long-cut',
        // The Ninth Face's tenants are small - the Weir Office at Nascent Soul
        // Early - so this is far above what the Marches requires. A court of the
        // Long Cut is not sized against its province.
        powerOrdinal: 37,
        administers: 'The driven ground of the Quiet Marches and four provinces beyond it that the Marches has never heard named.',
        grantsInRegionId: 'region-quiet-marches',
        embodiedByFactionId: null,
        startingAwareness: 'unaware',
        description:
            'Countersigns the Weir Office grant book once every twenty years, adjusts the schedule, and leaves. The Office presents the countersignature as a formality of its own devising, which is the single most successful piece of institutional theatre in either province.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// PARENTAGE
// Where each of the twenty-nine sits in the stack.
// ─────────────────────────────────────────────────────────────────────────

const NO_TERMS = null;

export const FACTION_PARENTAGE: Record<string, Parentage> = {
    // ── holders of a Low Fall vein, from the Third Sill ────────────────
    'sect-azure-cloud-pavilion': {
        factionId: 'sect-azure-cloud-pavilion',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The gorge vein at Low Fall, held on a twelve-year grant renewed nineteen times.',
        terms: {
            tributeStonesPerYear: 40_000,
            inKind: ['first refusal on anything recovered from a sealed site within the grant', 'the use of the gorge road for couriers who are not announced'],
            disciplesPerCycle: 2,
            buys: ['the vein, which is the whole of the sect\'s ability to produce cultivators', 'protection in the sense that nobody else may be granted it', 'arbitration when a boundary is disputed, decided in writing and not appealable'],
            renewal: 'Twelve years. A renewal is a single sheet delivered by a courier who does not wait. Non-renewal has happened once in the province in four hundred years and the sect concerned no longer exists, having fought nobody.'
        },
        standing: 'good',
        awarenessOfApex: 'named',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Pavilion Master and two Sword Elders know who the grant comes from. Nobody below Core Formation in the sect has been told, and the outer gate is taught that the vein is the Pavilion\'s by right of Kang Ye taking it.'
    },
    'sect-nine-peaks-ascetic-order': {
        factionId: 'sect-nine-peaks-ascetic-order',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The deepest vein in the province, held on the oldest continuous grant in the Low Fall.',
        terms: {
            tributeStonesPerYear: 0,
            inKind: ['the entire vein output above a fixed local allowance, taken quarterly', 'maintenance of the workings, at the Order\'s own cost'],
            disciplesPerCycle: 3,
            buys: ['the deepest vein in the province, and the only pipeline in the Low Fall that reliably produces Nascent Soul', 'the right to refuse every lease request without giving reasons, which the Order has exercised for two centuries and is not the Order\'s right to exercise'],
            renewal: 'Twelve years, and the Order has never seen a renewal document, because the grant is administered through the Root Sill directly and arrives as a spoken confirmation from somebody who walks in without being announced.'
        },
        standing: 'good',
        awarenessOfApex: 'placed',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Order\'s famous refusal to lease its vein is not principle. It is a term, and the Mountain Elders have let three generations of the province believe otherwise because the alternative is explaining who sets it.'
    },
    'sect-verdant-spring-hall': {
        factionId: 'sect-verdant-spring-hall',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'sect-nine-peaks-ascetic-order',
        holds: 'The spring valley, held from the Ascetic Order rather than from the Sill: a sub-grant, and a rung lower than the Hall lets on.',
        terms: {
            tributeStonesPerYear: 6_000,
            inKind: ['treatment of Order ascetics without charge, which is the term the Hall minds', 'a physician resident at Nine Peaks year-round'],
            disciplesPerCycle: 0,
            buys: ['the valley and its springs', 'the Order standing between the Hall and anyone who wants the valley'],
            renewal: 'Twelve years, in step with the Order\'s own. If the Order lost its grant the Hall would lose the valley the same season, which is a dependency the Hall has never publicly acknowledged.'
        },
        standing: 'good',
        awarenessOfApex: 'whisper',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Hall bills everyone except the people it is contractually obliged to treat for free, which is why its ledger of unpaid bills has a category nobody outside the Hall understands.'
    },
    'sect-ashen-forge-clan': {
        factionId: 'sect-ashen-forge-clan',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The volcanic flank and the furnace, held on a grant that specifies the furnace rather than the ground.',
        terms: {
            tributeStonesPerYear: 12_000,
            inKind: ['a fixed quota of worked steel annually, collected without discussion of price'],
            disciplesPerCycle: 1,
            buys: ['the volcanic flank, and the furnace named on the grant as the thing granted', 'the furnace, explicitly, in a clause the clan has never been able to explain to itself'],
            renewal: 'Twelve years. The grant document names the furnace as the thing granted and the ground as an appurtenance of it, which is backwards from how the clan understands its own history.'
        },
        standing: 'good',
        awarenessOfApex: 'whisper',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The clan believes the furnace is theirs by right of the First Hammer having built the compound around it. The grant document, which two Cinder Elders have read, says otherwise, and they have not told the rota.'
    },
    'sect-cinnabar-crucible-guild': {
        factionId: 'sect-cinnabar-crucible-guild',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The volcanic field furnace halls, and the refining hall with the method-script on the wall.',
        terms: {
            tributeStonesPerYear: 18_000,
            inKind: ['a standing supply of earth-grade medicine at cost, quantity unspecified and therefore unlimited'],
            disciplesPerCycle: 1,
            buys: ['the furnace halls beside the volcanic fields, with the method-script wall in them', 'the exclusive right to refine commercially in the province, which is the Guild\'s entire business model'],
            renewal: 'Twelve years, and the medicine clause is renewed separately and more often, which the Guild finds ominous and correctly so.'
        },
        standing: 'strained',
        awarenessOfApex: 'named',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'Standing is strained because the Guild\'s heaven-grade failure rate has risen and the in-kind clause does not care why. It has begun buying finished pills to meet the quota, at a loss it cannot sustain for another cycle.'
    },
    'sect-frostmirror-court': {
        factionId: 'sect-frostmirror-court',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The glacier and the cold vein under it, on a grant nobody else has ever applied for.',
        terms: {
            tributeStonesPerYear: 3_000,
            inKind: ['a copy of every inscription recovered from the ice, sent onward unread by the Court'],
            disciplesPerCycle: 0,
            buys: ['the glacier, the cold vein beneath it, and the library that was dug out of it', 'the assurance that nothing will be granted above it, which is why the Court has never lost the library'],
            renewal: 'Twelve years, at a tribute so low the Court has privately concluded the Sill wants the inscriptions and not the stones.'
        },
        standing: 'good',
        awarenessOfApex: 'placed',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Court is the only Low Fall sect that has worked out roughly what it is dealing with, and has responded by paying promptly, sending the inscriptions on, and asking nothing.'
    },
    'sect-nine-abyss-flame-sect': {
        factionId: 'sect-nine-abyss-flame-sect',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The caldera and the vent vein, on a grant that the righteous sects of the province do not believe exists.',
        terms: {
            tributeStonesPerYear: 55_000,
            inKind: ['nothing in kind; the Sill takes stones from this one and has never explained the preference'],
            disciplesPerCycle: 2,
            buys: ['the caldera, the vent vein under it, and the seal at the vent nobody asks about', 'the absence of any grant to anyone who might want to take it'],
            renewal: 'Twelve years, paid early every cycle for two hundred years, which the Sill has never acknowledged and the sect has never stopped doing.'
        },
        standing: 'good',
        awarenessOfApex: 'named',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Sill grants to a demonic sect on the same terms as anyone else because tribute is tribute, and the Sweptground Temple has been told this to its face by a courier who did not stay to discuss it.'
    },
    'sect-storm-tyrant-court': {
        factionId: 'sect-storm-tyrant-court',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The floating stone, and a vein the Court can no longer reach the bottom of.',
        terms: {
            tributeStonesPerYear: 30_000,
            inKind: ['inspection access to the tether once a decade, which the Court dreads and cannot refuse'],
            disciplesPerCycle: 1,
            buys: ['the stone and what remains of the vein under it', 'silence about the tether, which is the term that matters'],
            renewal: 'Twelve years. The last two renewals were issued for six, which in the province\'s grant vocabulary is a warning delivered without a word.'
        },
        standing: 'probationary',
        awarenessOfApex: 'named',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'A six-year renewal is what the Sill does instead of a threat. The Court has not told its disciples, has stopped opening the vault at successions, and is trying to buy a lightning-root intake it can present at the next calling.'
    },
    'sect-crimson-abyss-hall': {
        factionId: 'sect-crimson-abyss-hall',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The sinkhole and the thin vein beneath the town, on the least valuable grant in the province.',
        terms: {
            tributeStonesPerYear: 9_000,
            inKind: ['a list, annually, of everyone the righteous sects refused that year, which the Hall compiles anyway'],
            disciplesPerCycle: 1,
            buys: ['the sinkhole hall and the thin vein beneath the town, which is worth little and is theirs', 'the fact that the town above it continues officially not to know'],
            renewal: 'Twelve years, and the Hall has never missed a payment, because its recruiters understand precisely what the alternative looks like.'
        },
        standing: 'good',
        awarenessOfApex: 'named',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The in-kind clause is the interesting one: something above the province wants the refusal lists, and the Hall has never been told why it collects them.'
    },
    'sect-thousand-treasure-pavilion': {
        factionId: 'sect-thousand-treasure-pavilion',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'No vein at all: a charter to hold auctions in the province, which is a grant of a different kind and renewed on the same cycle.',
        terms: {
            tributeStonesPerYear: 22_000,
            inKind: ['a catalogue of every lot above a threshold value, sent onward before the auction rather than after it'],
            disciplesPerCycle: 0,
            buys: ['the right to auction, without which the Pavilion is a warehouse', 'first sight of what comes out of the ground in two provinces'],
            renewal: 'Twelve years. The pre-auction catalogue clause means the Pavilion has never once sold a genuinely significant lot to whoever bid highest.'
        },
        standing: 'good',
        awarenessOfApex: 'placed',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Pavilion knows more about the Sill than any other faction in the province and has built its whole fraudulent ancestry on the certainty that the Sill does not care what it claims about its own dead.'
    },
    'sect-stonewright-consortium': {
        factionId: 'sect-stonewright-consortium',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'court-third-sill',
        holds: 'The assay monopoly: the right to set and publish the exchange rate, granted rather than earned.',
        terms: {
            tributeStonesPerYear: 0,
            inKind: ['the rate itself, set within a band the Consortium is given and has never published', 'refining capacity reserved for the Sill\'s own use, quantity unstated'],
            disciplesPerCycle: 0,
            buys: ['the monopoly, which is worth more than any vein in the province', 'the presses, which are maintained by somebody the Consortium does not employ'],
            renewal: 'Twelve years, and the band moves each time, which is why the Consortium\'s Rate-Setters cannot explain their own rate to their own Council.'
        },
        standing: 'good',
        awarenessOfApex: 'placed',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Consortium believes it sets the price of everything. It sets it inside a band, and the band is the answer to the question its own factions have been arguing about for two centuries.'
    },

    // ── the courts themselves ─────────────────────────────────────────
    'sect-kiln-wardens': {
        factionId: 'sect-kiln-wardens',
        governance: 'federated',
        relation: 'court',
        parentFactionId: 'apex-deep-survey',
        holds: 'The datum: the root vein, held on nobody\'s behalf but the Survey\'s, and drawn on by nobody at all.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'known',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'Not a faction. A posting. Every unexplained thing about the Wardens - the lit nodes, the refusal to recruit, the absent grievance, the nine hundred years without a single recorded exchange - is what an outside observer sees when they mistake staff for an institution.'
    },

    // ── the Quiet Marches stack ───────────────────────────────────────
    'sect-weir-office': {
        factionId: 'sect-weir-office',
        governance: 'administered',
        relation: 'administration',
        parentFactionId: 'court-ninth-face',
        holds: 'Nothing of its own. It administers both workable faces on the Long Cut\'s behalf, from a counter, with a register.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'known',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'Not a sect and not a tenant: a bureau. The Office issues grants because the Long Cut has delegated the counter work to a local staff of eleven, and its famous discretion extends exactly as far as the schedule it is given. The absolute hegemon of the Quiet Marches is a clerk\'s office with a stamp, and every carver in the region has organised their entire life around the stamp without once asking whose it is.'
    },
    'sect-gleaners-company': {
        factionId: 'sect-gleaners-company',
        governance: 'administered',
        relation: 'contracted',
        parentFactionId: 'sect-weir-office',
        holds: 'A salvage contract, renewed annually, on burn zones that are administered rather than leased.',
        terms: {
            tributeStonesPerYear: 2_000,
            inKind: ['a share of every find above a threshold, assessed at the administration\'s valuation', 'crew rolls submitted quarterly, by name, including the dead'],
            disciplesPerCycle: 0,
            buys: ['access to the burn zones, which is a permission rather than a holding', 'nothing else whatsoever - a contractor is not protected, arbitrated for, or spoken for'],
            renewal: 'Annual, and a contract is not a lease: there is no standing to renew, only a decision to contract again. The Company has never once disputed a valuation, because there is no forum in which a contractor could.'
        },
        standing: 'good',
        awarenessOfApex: 'unaware',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'Under direct rule there are no client sects, so the Company is not a subsidiary - it is a supplier with a renewable contract, and the difference is invisible until the year it is not renewed and there is nobody to appeal to, because appeal means addressing the clerk who decided.'
    },
    'sect-sixmile-wardens': {
        factionId: 'sect-sixmile-wardens',
        governance: 'unbacked',
        relation: 'unaffiliated',
        parentFactionId: null,
        holds: 'Nothing. Nine hundred painted stakes, a shed and a survey, none of which anybody has thought to grant.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'unaware',
        costOfIndependence:
            'No grant, so no vein, so no pipeline: a Warden stops at Chipping and stays there. The Wardens perform the single most useful public service in the region and are paid in paint.',
        unbackedReason: 'arrangement_that_is_not_patronage',
        independenceStance: 'would_take_a_backer',
        note: 'The one specific reason they have not been absorbed: the woman at Sixmile, who walks the burn edge once a month and is very probably Twice-Worked, and who would be annoyed. Nobody has said this out loud, the arrangement is not patronage and could not be described as such, and the administration has quietly left the Wardens alone for nineteen years. Otherwise tolerated because the roads they mark are the roads the administration\'s own contractors walk in on.'
    },

    'sect-standing-grove': {
        factionId: 'sect-standing-grove',
        governance: 'deference',
        relation: 'unaffiliated',
        holds: 'A valley, a mountain and four settlements administered directly, and a zone eleven days across held by nothing but a belief about what would happen.',
        parentFactionId: null,
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'whisper',
        costOfIndependence: 'It cannot grow. Six disciples is the number at which every one of them is known by name across the province, and the deference is a belief about those six specific people rather than about an institution - so a seventh means a roster, a roster means administration, and administration means the belief stops being about anybody in particular.',
        unbackedReason: 'holding_something',
        independenceStance: 'proud',
        note: 'Direct rule by respect. The Grove holds what it can comfortably walk and claims nothing beyond it, and the ground beyond it is nevertheless theirs because nobody has been willing to find out otherwise since the year 41 test. The Third Sill has never granted the valley to anyone, has never been asked to, and has left the file open.'
    },
    // ── unaffiliated, and paying for it ───────────────────────────────
    'sect-sweptground-temple': {
        factionId: 'sect-sweptground-temple',
        governance: 'unbacked',
        relation: 'unaffiliated',
        parentFactionId: null,
        holds: 'Swept ground, chosen for having no vein under it, and therefore nothing anybody needs to grant.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'whisper',
        costOfIndependence:
            'It produces Foundation Establishment and no further, and it knows exactly why. The Abbot has twice been approached about a grant and twice declined, on the argument that a Temple with a vein would start turning people away to keep it - which is correct, and has cost four generations of disciples their ceiling.',
        unbackedReason: 'too_poor_to_be_worth_taking',
        independenceStance: 'proud',
        note: 'The only faction in either province that is unaffiliated on purpose, at a price it has calculated and pays annually in the careers of people who trusted it.'
    },
    'sect-clear-river-alliance': {
        factionId: 'sect-clear-river-alliance',
        governance: 'unbacked',
        relation: 'unaffiliated',
        parentFactionId: null,
        holds: 'Fords and traffic. No vein, no grant, and no relationship with anything above it.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'unaware',
        costOfIndependence:
            'Wide and shallow forever: nine at Foundation Establishment, one Nascent Soul in three hundred years, and no mechanism by which that changes. The Alliance is a large organisation that cannot produce a strong person.',
        unbackedReason: 'useful_to_everyone_aligned_with_none',
        independenceStance: 'proud',
        note: 'Tolerated absolutely, because eleven towns need crossing and the Sill has no interest in the river.'
    },
    'sect-hollow-bell-wanderers': {
        factionId: 'sect-hollow-bell-wanderers',
        governance: 'unbacked',
        relation: 'unaffiliated',
        parentFactionId: null,
        holds: 'Nothing whatsoever, which the league presents as philosophy.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'unaware',
        costOfIndependence:
            'Every member who reaches Foundation Establishment is recruited away within a year by a sect that holds a vein, because the league has nothing to offer someone who has started to matter.',
        unbackedReason: 'not_worth_the_trouble_yet',
        independenceStance: 'would_take_a_backer',
        note: 'The bottom of the pyramid, and the only rung on it where the word "tolerated" is not a euphemism for anything.'
    },
    'sect-bone-lantern-cult': {
        factionId: 'sect-bone-lantern-cult',
        governance: 'unbacked',
        relation: 'unaffiliated',
        parentFactionId: null,
        holds: 'Battlefields on a rotation, none of them granted, all of them nominally somebody else\'s.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'unaware',
        costOfIndependence:
            'No vein and no protection: the Verdant Spring Hall hunts them on principle and the Crimson Abyss Hall hunts them over supply, and neither can be arbitrated because the Cult is not a party to anything.',
        unbackedReason: 'too_remote',
        independenceStance: 'indifferent',
        note: 'Tolerated in the specific sense that nobody has been granted the ground it works, so nobody with standing has been wronged by it.'
    },
    'sect-the-severed': {
        factionId: 'sect-the-severed',
        governance: 'unbacked',
        relation: 'unaffiliated',
        parentFactionId: null,
        holds: 'Rented cutting houses at the edge of six cities, and no ground at all.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'named',
        costOfIndependence:
            'They cannot be granted anything because a grant is an obligation with a term, and their whole doctrine is the pre-emptive severance of exactly that. They climb faster than anyone and hold nothing, which is the trade they say they are making.',
        unbackedReason: 'not_worth_the_trouble_yet',
        independenceStance: 'proud',
        note: 'The one faction whose independence is not a cost but the product, and the Sill has never approached them, which they have noticed.'
    },
    'sect-hollow-court': {
        factionId: 'sect-hollow-court',
        governance: 'unassailable',
        relation: 'unaffiliated',
        parentFactionId: null,
        holds: 'The richest vein anyone has ever surveyed, and the four mountains standing on it. Not granted, not leased, not claimed - occupied, by people nothing in the world can make leave.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'known',
        costOfIndependence:
            'Nothing. This is the entry that makes the column mean something: every other independent faction in the catalog pays for its independence continuously, and the Court pays nothing, because there is no instrument by which a bill could be presented.',
        unbackedReason: null,
        independenceStance: 'indifferent',
        note: 'The Deep Survey has written to the Court once. The letter was answered and the Court has not discussed it, and the province has spent two hundred years deciding what that means. Both institutions know the thing nobody says aloud: the Survey administers the vein system, and the one vein it does not administer is the best one.'
    },

    // ── outside the vein stack entirely: the Dao houses ───────────────
    'house-ninefold-ledger': {
        factionId: 'house-ninefold-ledger',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'No vein. A book hall and forty-one arbitration benches, none of which anybody grants.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'placed',
        costOfIndependence:
            'It cannot be protected, only needed. The Ledger has no vein, no pipeline dependency and no patron, and its safety consists entirely of being the instrument the Third Sill uses when a boundary is disputed.',
        unbackedReason: 'arrangement_that_is_not_patronage',
        independenceStance: 'would_take_a_backer',
        note: 'The Sill\'s arbitration clause names the Ledger. The Ledger has never mentioned this to a client and prices its work as though it were an ordinary house.'
    },
    'house-narrow-hour': {
        factionId: 'house-narrow-hour',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'A hall with no walls on a bare hill nobody has ever wanted, and four standing chairs beside four thrones.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'whisper',
        costOfIndependence:
            'Its income is retainers and its retainers are falling, and no institution above it has any reason to care, because a house that sells readings is not a holding.',
        unbackedReason: null,
        independenceStance: null,
        note: 'Sighted something eighty years ago that it has not published, and has quietly declined two commissions from parties it will not name.'
    },
    'house-bound-word': {
        factionId: 'house-bound-word',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'Oath halls and a treaty vault, which are buildings rather than ground.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'named',
        costOfIndependence:
            'Every treaty in its vault is between parties who hold from somebody, and the house has slowly realised that its most famous agreements were between tenants with no authority to make them.',
        unbackedReason: null,
        independenceStance: null,
        note: 'The unpublished weir treaty is the house\'s standing fear, and the reason it has never sought a patron: a patron would want to read the vault.'
    },
    'house-quiet-cut': {
        factionId: 'house-quiet-cut',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'Four portable nodes, no address, no ground, and a policy of leaving nothing behind that could be surveyed.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'whisper',
        costOfIndependence:
            'No institution will seat it publicly, so it has no arbitration, no protection and no recourse, and every client it has could deny it in a room.',
        unbackedReason: null,
        independenceStance: null,
        note: 'Has twice been paid by a party it could not identify, through three intermediaries, for cuts it was not permitted to record. It has drawn the obvious conclusion and written nothing down.'
    },
    'house-held-names': {
        factionId: 'house-held-names',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'Register houses at nine city gates, leased from the cities.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'whisper',
        costOfIndependence:
            'Entirely dependent on nine city administrations enforcing registration on its behalf, any one of which could stop and cost it a ninth of its income overnight.',
        unbackedReason: null,
        independenceStance: null,
        note: 'Three of the nine leases are countersigned by an office the House has never identified, and it has stopped asking the cities about it.'
    },
    'house-measured-span': {
        factionId: 'house-measured-span',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'Nine gate stations, on ground so worthless the question of granting it has never arisen.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'named',
        costOfIndependence:
            'It carries for everyone and is owed nothing by anyone. When a station is lost the house replaces it out of its own freight income, and it has lost twenty-two.',
        unbackedReason: null,
        independenceStance: null,
        note: 'The only house whose survey of the province disagrees with the Anchorhold\'s, in four places, all of them over arterial ground.'
    },
    'house-anchorhold': {
        factionId: 'house-anchorhold',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'Eleven perimeters, the standard weights and the surface survey of record.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'whisper',
        costOfIndependence:
            'Funded by settlements that are becoming too poor to fund it, with no patron and a published schedule for waking its own ancestor that is, on paper, its entire strategic reserve.',
        unbackedReason: null,
        independenceStance: null,
        note: 'The Anchorhold has noticed that the datum stone every measurement in the province is taken from is itself a marker referring to a survey the house does not hold. It has never published this, three Wardens of the Survey know, and it is the closest any Low Fall institution has come to naming the thing above them.'
    },
    'house-lantern-hall-placeholder': {
        factionId: 'sect-lantern-hall',
        governance: 'outside',
        relation: 'outside',
        parentFactionId: null,
        holds: 'Reading halls in nine cities and the stack rooms beneath them.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'named',
        costOfIndependence:
            'Unwelcome in nine cities, dependent on leases it does not control, and holding nothing anybody wants except records several parties would prefer did not exist.',
        unbackedReason: null,
        independenceStance: null,
        note: 'The Hall records crossings. Somebody above the province has been receiving copies of its crossing ledger for two hundred years, by an arrangement the Hall believes it initiated.'
    }
};

// Lantern Hall is keyed by its real id above; this alias keeps the record
// addressable by faction id like every other entry.
FACTION_PARENTAGE['sect-lantern-hall'] = FACTION_PARENTAGE['house-lantern-hall-placeholder'];
delete FACTION_PARENTAGE['house-lantern-hall-placeholder'];

// ─────────────────────────────────────────────────────────────────────────
// THE FEEDER
// The legitimate route out of a small sect, and the reason competitions
// matter to everyone except the people running them.
// ─────────────────────────────────────────────────────────────────────────

export const FEEDER = {
    name: 'the calling',
    cadence: 'Once every twelve years, in step with the grant cycle, because it is part of it.',
    intakeSize: 9,
    intakeNote:
        'Nine from the whole province, against a cohort of perhaps four thousand disciples of the right age across twenty-six institutions.',
    selectionRoutes: [
        {
            route: 'inter-sect competition',
            how: 'The Azure Cloud tournament and three smaller ones are watched by people nobody introduces. Placing is not the criterion; being interesting is, and the criterion is not published.',
            share: 4
        },
        {
            route: 'an elder\'s recommendation',
            how: 'A sect elder who has themselves been called may recommend one disciple per cycle, and spends their own standing doing it. Most never use it.',
            share: 3
        },
        {
            route: 'the disciple quota',
            how: 'Grant terms oblige some sects to send one or two upward per cycle regardless of quality, which is how a mediocre disciple from a well-taxed sect displaces a prodigy from a poor one.',
            share: 1
        },
        {
            route: 'purchase',
            how: 'The Thousand Treasure Pavilion has bought two seats in four hundred years, at prices it has never disclosed, for candidates it has never explained.',
            share: 1
        }
    ],
    /**
     * The exposure event. A competition is the first place a mis-sorted
     * cultivator sees their own Dao practised properly by somebody else, which
     * is worth more to them than winning and is invisible to everyone else in
     * the hall.
     */
    exposureNote:
        'For the people at the top a competition is recruitment. For a disciple whose comprehension has never fitted what their sect teaches, it is the first time they have watched their own Dao done correctly by a stranger from four valleys away - and that is a larger event in their life than the result, though nobody watching will register it.',
    whatHappensToTheRest:
        'Nothing. Four thousand disciples continue at the sects that raised them, and the nine are not mentioned again by name at the outer gate, because the sect does not enjoy the reminder that its best go somewhere else.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ARRIVAL
// Encoded so a tool cannot accidentally carry standing across, and stated
// without softening anywhere.
// ─────────────────────────────────────────────────────────────────────────

export const ARRIVAL_RULES = {
    entryRankIndex: 0,
    entryRankNote:
        'You enter at the lowest rank of the receiving institution. There is no exception, no accelerated intake, no recognition of a title held below, and no mechanism by which any of that could be granted.',
    /** Deliberately empty. Nothing travels. */
    carriesOver: [] as readonly string[],
    doesNotCarry: [
        'rank: a core disciple of a granting sect arrives Unplaced, alongside people who arrived Unplaced a century ago',
        'reputation: the province you were famous in is a farm, and its opinions are not evidence here',
        'contribution: every point of it was earned in somebody else\'s ledger and stays there',
        'seniority: years served below do not count as years served here, and are not recorded',
        'titles: the ones you held are not used, and using them yourself is the mistake that gets remembered',
        'favours: your sponsors below have no standing to spend here on your behalf'
    ],
    whatDoesTravel:
        'Your realm, which the institution notes and does not rank you by, and whatever you actually understand, which is the only thing here that was ever yours.',
    firstMonth:
        'A promotion that feels exactly like a demotion, and it is meant to. Twenty years of work buys the right to be nobody in a larger room, among people who regard the sect that raised you as a supplier.',
    unapologetic:
        'Nobody at the receiving institution considers this harsh, explains it, or softens it. It is simply how intake works, it has worked this way for longer than the province has existed, and being asked about it produces mild confusion rather than sympathy.'
} as const;

/**
 * The arrival state, as numbers, so nothing can leak across by accident. Any
 * tool that promotes a cultivator upward must take its values from here rather
 * than carrying the cultivator's existing standing.
 */
export function arrivalStateFor(_fromFactionId: string, toInstitutionId: string): {
    institutionId: string;
    rankIndex: number;
    rankTitle: string;
    contributionCarried: 0;
    reputationCarried: 0;
    seniorityCarried: 0;
    titlesRecognised: readonly string[];
} {
    const apex = APEX_INSTITUTIONS.find(a => a.id === toInstitutionId);
    return {
        institutionId: toInstitutionId,
        rankIndex: ARRIVAL_RULES.entryRankIndex,
        rankTitle: apex ? apex.ranks[ARRIVAL_RULES.entryRankIndex].title : 'lowest rank',
        contributionCarried: 0,
        reputationCarried: 0,
        seniorityCarried: 0,
        titlesRecognised: []
    };
}

// -------------------------------------------------------------------------
// DIRECT RULE
// No feeder, so it recruits itself. The Long Cut commits to the wide option:
// it tests everybody, on a schedule, and the schedule is the most ordinary
// and most frightening document in the Quiet Marches.
// -------------------------------------------------------------------------

export const DIRECT_RULE = {
    apexId: 'apex-long-cut',
    regionId: 'region-quiet-marches',
    intakeModel: 'tests everyone' as const,
    intake:
        'Every child in every administered province is tested at seven, in the village, by a clerk with a register and a piece of driven stone. It takes a morning. The results are written down, the register goes back to the Ninth Face, and about one child in nine hundred is collected within the year.',
    intakeNote:
        'There is no competition, no tournament, no sponsor and no recommendation, because there is no subsidiary to run one. The Marches does not have a route upward; it has an appointment it was given at seven and either passed or did not, and adults who were not collected can look up their own entry.',
    staffing:
        'About forty posted staff for five provinces, plus local bureaus like the Weir Office. It is not enough, everyone in the administration knows it is not enough, and the schedule is written to be survivable rather than adequate.',
    brittleness:
        'A taut, brittle thing: one lost bureau or one bad season on a face and the schedule slips for a decade, because there is no vassal to absorb it and no deniability to hide behind.',
    legalism:
        'It owns every act by name, so it does nothing quickly. Every decision is written, receipted and appealable on a form that is logged and answered, usually years later, usually with the original decision restated. It is almost impossible to provoke into a mistake, and impossible to hurry.',
    whatItFeelsLike:
        'There is no local sect to belong to, no familiar hierarchy, and nobody nearby to petition. Petitioning means addressing a clerk. Joining a federated power means joining a sect; joining a direct ruler means being processed.',
    noSkim:
        'Nothing is taken by an intermediate tier, and the reports the Long Cut reads are its own rather than what a subsidiary wanted it to hear - which is exactly the trade it made in exchange for doing all of the work itself.'
} as const;

// -------------------------------------------------------------------------
// DEFERENCE
// The claim is worth exactly as much as the last time it was tested.
// -------------------------------------------------------------------------

export const DEFERENCE_HOLDINGS: readonly {
    factionId: string;
    administeredCore: string;
    deferenceZone: string;
    zoneIsContested: string;
    disciples: number;
    lastTestedYearsAgo: number;
    whatHappened: string;
    responseTimeDays: number;
    ifTheyDoNotAnswer: string;
    selectivityIsLoadBearing: string;
    cannotGrow: string;
}[] = [
    {
        factionId: 'sect-standing-grove',
        administeredCore:
            'A valley of old trees, the mountain above it and four settlements: everything inside a day and a half of walking, which is the entire extent of what the Grove actually governs.',
        deferenceZone:
            'Roughly eleven days across, in every direction, within which nobody encroaches, nobody applies for a grant, and nobody has tested the assumption in forty-one years.',
        zoneIsContested:
            'The Grove believes the zone runs eleven days out because that is where the last test happened. Two granted sects have moved leases inward on the northern side in the last twenty years without announcing it, so the real extent is smaller than the Grove thinks and nobody, including the Grove, could draw it.',
        disciples: 6,
        lastTestedYearsAgo: 41,
        whatHappened:
            'A caravan was taxed at the northern edge by a party who left the province immediately afterwards, which is exactly the shape a test takes: small, deniable, and awkward to answer without looking disproportionate. Keeper Wen Zhao answered it in nine days, visibly, in front of witnesses who had not been asked to attend, and then went home and never referred to it again.',
        responseTimeDays: 9,
        ifTheyDoNotAnswer:
            'The zone does not shrink at the place it was tested. It evaporates entirely, everywhere, within a season, because deference is a single belief and everyone hears at the same time. This is the most dangerous thing in the existence of the Grove and it will arrive as something small.',
        selectivityIsLoadBearing:
            'Six disciples means each is known by name across the province, so the reputation is a handful of specific people rather than an institution. That is precisely why the deference holds, and precisely why one disgrace by one of the six would cost the whole zone.',
        cannotGrow:
            'A seventh disciple means a roster, a roster means administration, and administration means becoming a different kind of institution. The Grove refuses and is being slowly outlasted: the Verdant Spring Hall made the opposite choice two centuries ago, grew into a sub-granted institution with nine springs and a billing department, and its elders still describe the decision as the year the Hall stopped being what it was.'
    }
];

/**
 * The three borders differ in kind, and this is worth stating plainly because
 * a player will encounter all three and only one of them is on a map.
 */
export const BORDER_KINDS = {
    federated:
        'A line on a lease. It is written down, it is arbitrable, and both parties can produce the document - which is why federated borders generate lawsuits rather than wars.',
    administered:
        'Where the patrols stop. It is exactly as large as the administration can afford to walk, it moves when staffing moves, and the register knows precisely where it is.',
    deference:
        'Wherever people stop being willing to find out. Nobody can point to it on a map, everybody inside it can feel it, and it is the only border in the world that can vanish in a season without anyone crossing it.'
} as const;

/** What model each province runs on, and what that feels like from below. */
export const REGION_GOVERNANCE: Record<string, {
    model: GovernanceModel;
    apexId: string | null;
    fromBelow: string;
    joining: string;
}> = {
    'region-low-fall': {
        model: 'federated',
        apexId: 'apex-deep-survey',
        fromBelow:
            'Twenty-seven institutions, cross-cutting feuds, a local sect for every valley and somebody nearby to petition about anything. Nobody is strong enough to stop anyone else, which is loud, exploitable and survivable.',
        joining: 'Joining a federated power means joining a sect: an admission day, a queue, an elder who looks at you, and a name on an outer-gate roll.'
    },
    'region-quiet-marches': {
        model: 'administered',
        apexId: 'apex-long-cut',
        fromBelow:
            'One administration, a register and a schedule. No intermediate institution of any kind, nobody local with authority to decide anything, and a counter with a queue at it. Consistent, impersonal, and it does not know your name.',
        joining: 'Joining a direct ruler means being processed: a test you sat at seven, an entry in a register you may read, and a decision made elsewhere by somebody you will never meet.'
    }
};

/**
 * The trade an unbacked sect offers a player, which is real in both
 * directions and should be presented as such.
 */
export const UNBACKED_PLAYER_TRADE = {
    upside: [
        'the most available institution in the world: a low admission bar, often none at all',
        'faster advancement, because there are few people above you and nobody senior waiting for the same slot',
        'genuine responsibility early - a two-year disciple can be running something that matters'
    ],
    downside: [
        'no arbitration: a dispute is settled immediately by whoever is stronger',
        'no route up, because selection requires a parent to select you, so a gift is either wasted or poached',
        'poaching costs the poacher nothing, since there is no patron to offend',
        'the ceiling arrives sooner and harder than anywhere else'
    ],
    trap:
        'Rising fast in a sect with nowhere to send you is its own kind of trap. The first six years feel better than any granted sect could offer, and the seventh is the year you understand that the person above you is the ceiling, and that there is nobody above them at all.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// GUEST ELDERS
// Neither member nor outsider. Transactional on both sides, and both sides
// are right to be slightly nervous.
// ─────────────────────────────────────────────────────────────────────────

export const GUEST_ELDERS: readonly GuestElder[] = [
    {
        id: 'guest-shen-of-the-fourth-ford',
        name: 'Shen Yiao, called Shen of the Fourth Ford',
        realmOrdinal: 30,
        traditionId: 'tradition-drawn',
        hostFactionId: 'sect-azure-cloud-pavilion',
        provides:
            'Presence, mostly. A Void Refinement cultivator seated at the Pavilion for eleven months of the year is a deterrent the Pavilion could not otherwise field, and she has drawn a blade for them twice in forty years.',
        receives:
            'Cave rent on the gorge vein at no charge, first refusal on anything the Pavilion recovers, and the Pavilion\'s silence about where she was for the sixty years before she arrived.',
        term: 'Renewed annually by nothing more formal than her staying, and she has left mid-year twice without notice.',
        hostRisk:
            'She is stronger than the Pavilion Master, is not bound by its rules, and the disciples have begun going to her rather than to the Sword Elders, which nobody has said out loud.',
        guestRisk:
            'If the Pavilion loses its grant she loses the only decent vein she has legal access to, and she is old enough that starting again elsewhere is not a plan.',
        leaveClause:
            'She may walk out at any time, including during a siege, and no oath, contract or obligation exists that anyone could point at afterwards. The Pavilion knows this, has considered asking her to swear something with the Bound Word, and has concluded that asking would itself end the arrangement.'
    },
    {
        id: 'guest-third-face-ren',
        name: 'Third Face Ren',
        realmOrdinal: 19,
        traditionId: 'tradition-cut',
        hostFactionId: 'sect-stonewright-consortium',
        provides:
            'The only carver the Consortium has ever retained: he reads driven stone the assay house cannot price, which is how the Kettle branch stopped being cheated on salvage lots within a season of his arrival.',
        receives:
            'Stones, in quantity, paid weekly rather than by grant day - the only arrangement in the Marches that lets a carver cultivate without the Weir Office - and passage on Consortium carts.',
        term: 'A written agreement of five years, the only guest arrangement in either province that has ever been put on paper, and it names no penalty for either side.',
        hostRisk:
            'He is Keystone, immune to every soul-directed art the Consortium\'s own guards know, and the Consortium\'s insurance table reads him a rank low, which means it has systematically underpriced its own guest elder.',
        guestRisk:
            'Working for a Low Fall institution has made him unwelcome at the Kettle grant queue, and if the agreement lapses he goes back to a region where the Office decides whether he advances.',
        leaveClause:
            'Five years, then nothing. He has said he will not renew and the Consortium has not decided whether to believe him, because he says that every year.'
    },
    {
        id: 'guest-the-twice-worked-woman',
        name: 'The woman at Sixmile, who gives no name',
        realmOrdinal: 26,
        traditionId: 'tradition-cut',
        hostFactionId: 'sect-sixmile-wardens',
        provides:
            'She walks the burn edge once a month and tells the Wardens where the stakes are now wrong, which is the only reason the survey has stayed accurate as the ground moved.',
        receives:
            'Nothing the Wardens can afford: paint, a shed, and the fact that nobody in Sixmile asks her anything at all.',
        term: 'No term, no agreement, and no discussion of one in nineteen years.',
        hostRisk:
            'The Wardens are fairly sure she is Twice-Worked - a seam and a circulation both - which makes her one of perhaps eleven people in the world and means somebody, eventually, will come looking for her at Sixmile.',
        guestRisk:
            'Neither tradition will have her, so a militia that owns nothing and asks nothing is the best arrangement available, and it depends entirely on the Wardens continuing not to ask.',
        leaveClause:
            'She could leave tonight and the Wardens would learn of it by the stakes going wrong. There is no arrangement to breach, which is the entire basis on which she stays, and both parties understand that naming it would end it.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const APEX_BY_ID: ReadonlyMap<string, ApexInstitution> = new Map(APEX_INSTITUTIONS.map(a => [a.id, a]));
const COURT_BY_ID: ReadonlyMap<string, Court> = new Map(COURTS.map(c => [c.id, c]));

export function getApexInstitution(id: string): ApexInstitution | undefined {
    return APEX_BY_ID.get(id);
}

export function getCourt(id: string): Court | undefined {
    return COURT_BY_ID.get(id);
}

export function getParentage(factionId: string): Parentage | undefined {
    return FACTION_PARENTAGE[factionId];
}

/** Everything holding directly from this faction, court or apex. */
export function getSubsidiariesOf(parentId: string): Parentage[] {
    return Object.values(FACTION_PARENTAGE).filter(p => p.parentFactionId === parentId);
}

/**
 * Walk upward from a faction to whatever is at the top. Returns the chain of
 * ids, which for a third-tier subsidiary in the Marches is four long and for
 * an unaffiliated league is one.
 */
export function chainToApex(factionId: string): string[] {
    const chain = [factionId];
    let cursor: string | null = FACTION_PARENTAGE[factionId]?.parentFactionId ?? null;
    const guard = new Set<string>([factionId]);
    while (cursor && !guard.has(cursor)) {
        chain.push(cursor);
        guard.add(cursor);
        const court = COURT_BY_ID.get(cursor);
        if (court) {
            chain.push(court.apexId);
            break;
        }
        cursor = FACTION_PARENTAGE[cursor]?.parentFactionId ?? null;
    }
    return chain;
}

/** Depth in the pyramid: 0 apex, 1 court, 2 vein-holder, 3 sub-holder. */
export function tierOf(factionId: string): number {
    return Math.max(0, chainToApex(factionId).length - 1);
}

/** Guest arrangements at a faction. Not members; do not count them as such. */
export function getGuestElders(factionId: string): GuestElder[] {
    return GUEST_ELDERS.filter(g => g.hostFactionId === factionId);
}

/**
 * Whether a name may be spoken in narration to a cultivator with this
 * awareness record. The hard rule from `docs/world/discovery.md`: never
 * reference an entity the player has no knowledge record for.
 */
export function mayBeNamed(awareness: Awareness): boolean {
    return awareness !== 'unaware' && awareness !== 'whisper';
}

/** What an unaware player experiences instead of a name. */
export function unattributedEffectsOf(apexId: string): readonly string[] {
    return APEX_BY_ID.get(apexId)?.actsWithoutAttribution ?? [];
}
