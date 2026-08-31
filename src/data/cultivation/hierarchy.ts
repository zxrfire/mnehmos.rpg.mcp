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
    /**
     * The same house's row in `SECTS`, where it has one.
     *
     * Two of the three apexes exist only here, because nobody can join them and
     * they have no roster, no admission bar and no stipend. The Azure Cloud
     * Pavilion is the exception and it is not an accident: it is the one apex a
     * player can walk into, so it needs a sect row as well - and for a while it
     * had one under a different id with nothing joining them, which is how it
     * came to own an immortal artifact that queries against the apex could not
     * see. This field is that join. Null where the house is apex-only.
     */
    factionId: z.string().nullable(),
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
    /**
     * How many the institution has above Grand Ascension, and whether that
     * person can go anywhere.
     *
     * An apex has exactly one, and one is a different thing from two. The
     * single holder is the reason the institution is unassailable AT HOME and
     * the reason it is nearly powerless anywhere else: they sit, they cultivate,
     * and they are the last formation on the vault. Sending them out uncovers
     * the one thing that cannot be uncovered, so they are never sent, and every
     * institution in the world that matters knows this about every other one.
     *
     * This is what stops `powerOrdinal` at the top of the table from meaning
     * that a last-realm cultivator can be dispatched. Almost nowhere can.
     */
    /**
     * How deep the position goes, which is the axis the three differ on.
     * Ancient means the institution has held the last realm continuously for
     * longer than anyone can check. Recent means it holds it because of one
     * person and one event, and an event does not renew.
     */
    heritage: z.enum(['ancient', 'recent']),
    /**
     * The consumables the divestment left, and how much of them is still there.
     *
     * This is where reading the three by `powerOrdinal` alone gets the world
     * wrong. An ascending cultivator divests EVERYTHING, and most of everything
     * is not artifacts - it is pills nobody can refine any more, materials that
     * are not gathered any more, single-use items made by somebody who was
     * about to stop existing. The sent-down treasure is the permanent part. The
     * stock is the rest of it, and the rest of it is larger.
     *
     * Age therefore runs backwards here. An ancient apex has depth of position
     * and an empty storehouse: thousands of years of crises, each of which was
     * survived by spending something, and nothing has been added since the
     * founder. A recent one has a shallow position and a nearly full one.
     *
     * The strategic shape is the inversion of a sealed ancestor. A sealed sect
     * has one enormous card and can play it once. A young apex has a great many
     * medium cards and can play them for a century - and is permanently poorer
     * after each, with no way to restock, because the person who made them is
     * on the other side of the Lid.
     */
    stock: z.object({
        /** Roughly what is left, as a fraction of what was originally left behind. */
        remaining: z.enum(['spent', 'depleted', 'substantial', 'nearly_intact']),
        description: z.string().min(80),
        /** What it buys in practice, which is not the same as what it is. */
        buys: z.string().min(60),
        /** Why it cannot be replaced. Always the same reason, worth restating. */
        cannotRestock: z.string().min(60)
    }),
    /**
     * The realm of the next strongest after the pinned one, which is where
     * heritage depth stops being a word and becomes a number.
     *
     * An ancient apex has a filled gradient underneath: centuries of people at
     * every rung, so the institution survives losing anyone in particular. A
     * recent one has a cliff - one person at the top and a gap below her,
     * because the position was built by a single crossing and there has not
     * been time to grow anything into the space. That gap is the honest
     * measure of how new a power is, and it is not fixable with money.
     */
    secondStrongestOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    depthNote: z.string().min(80),
    /** What could take the position away. Never the same answer twice. */
    instability: z.string().min(80),
    lastRealm: z.object({
        /**
         * How many the house has at the last realm. Was a literal 1, which
         * was a claim about the world enforced by the type system, and it was
         * wrong: the Azure Cloud Pavilion has two and every power reading in
         * the setting was taking its number from here. One is still the
         * common case and `pinned` is still about one person - the one on the
         * object - however many the house has up there.
         */
        count: z.number().int().min(1),
        pinned: z.literal(true),
        /**
         * The name, where anybody has it. Null is the ordinary case and is a
         * fact rather than a gap: two of the three seats are held by somebody
         * no outsider has ever been given a name for, and a register that
         * invented one would be worse than a register that says so.
         */
        holderName: z.string().nullable(),
        note: z.string().min(80)
    }),
    /**
     * What the pinned one is actually sitting on.
     *
     * Each apex was founded by somebody who made the crossing, and each of them
     * sent something back down. Nothing crosses the Lid except the cultivator
     * and, through a very few objects, information - so these are those objects.
     * They are why an apex is an apex, and they are why its strongest member has
     * not stood up in four hundred years.
     *
     * The Court is the party with the clearest motive, but it is nowhere near the
     * nothing from anyone, holds the best vein, pays nobody, and can be offered
     * nothing - which makes it inert, and makes a setting with no pressure on it.
     * This is the exception. A treasure that improves the odds on the last
     * crossing is the only thing four people working continuously on that
     * crossing could want, and it is held by the two institutions that can
     * neither be attacked nor traded with.
     *
     * And then the wider problem, which is arithmetic anybody can do. A sect
     * holding a sealed ancestor is holding a single-use asset: waking them is
     * generally the end of them, so it is spent once and spent on something
     * worth it. One of these objects is a permanent advantage. Trading a
     * one-off for a trump card is a GOOD TRADE, and every sect with something
     * under its mountain has run that calculation at least once - which means
     * the number of parties who would move on an empty seat is not one, it is
     * roughly the number of sealed ancestors in the world.
     *
     * That is the actual reason the seats are never left. Not the Court.
     *
     * And the sum works even for a sect with no interest in the crossing at
     * all - see `asAnArtifact`. These are immortal-made objects, formidable
     * before any question of the Lid comes into it, so the wanting is not
     * confined to people with a realistic route upward. Most of the parties who
     * would move on an empty seat have no such route and want it anyway.
     *
     * `ifUncovered` is where the arrangement has slack. The holder is pinned,
     * not fixed: an emergency large enough to make an apex send its one out is
     * the single event that puts the object in reach, and everybody who
     * understands the situation has already thought about this.
     */
    sentDown: z.object({
        id: z.string(),
        name: z.string().min(1),
        description: z.string().min(80),
        /** What it is good for, stated without mysticism. */
        uses: z.array(z.string().min(40)).min(2),
        /**
         * What it is worth to somebody who will never cross, and never intended
         * to.
         *
         * These are immortal-made objects, and that is a statement about
         * construction before it is a statement about the Lid. Strip out every
         * question of ascension and each one is still the strongest artifact
         * anyone in the region has heard described - which means the contender
         * set is not only the parties chasing the crossing. It is also everyone
         * who simply wants the best weapon in the world, and that is a much
         * larger and much less patient group.
         */
        asAnArtifact: z.string().min(80),
        /** Why the holders never use it. */
        reserveTerms: z.string().min(60),
        /** What becomes possible the moment the seat is empty. */
        ifUncovered: z.string().min(80),
        /**
         * Optional, and it is the whole shape of the Deep Survey: the object is
         * portable, its effects would travel, and it is never going anywhere.
         *
         * The reason is mundane and should be written that way. Nothing
         * metaphysical happens if the Lamp leaves. The headquarters is simply
         * full of valuable things and the defence is presence: take the Lamp
         * and the one last-realm cultivator out of the vault and what remains
         * is a building holding several centuries of accumulated wealth behind
         * seals that a lesser sect could work through given time and an
         * absence. It is a security posture, not a mystical necessity.
         */
        cannotLeave: z.object({
            portable: z.literal(true),
            whatItCouldDo: z.string().min(150),
            whyItNeverWill: z.string().min(150),
            whatExposedMeans: z.array(z.string().min(60)).min(3),
            howQuickly: z.string().min(100),
            theBind: z.string().min(150),
            /** Who would actually try it, which is not an apex rival. */
            whoWouldTry: z.string().min(150),
            /** Deference-border logic, applied to an apex. */
            deferenceLogic: z.string().min(200),
            nearlyDid: z.object({
                yearsAgo: z.number().int().min(1),
                what: z.string().min(150),
                proposedBy: z.string().min(60),
                theArgumentThatStopped: z.string().min(200),
                outcome: z.string().min(100)
            }),
            whoOutsideKnows: z.string().min(200)
        }).nullable(),
        intact: z.boolean()
    }),
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
    /**
     * Two of the three are unnameable and start at `unaware`. The third is a
     * sect with a front gate, and that difference is most of what makes it the
     * least stable of them - it can be found, petitioned, joined and watched.
     */
    startingAwareness: AwarenessSchema,
    /** Where a name could legitimately come from, if it ever does. */
    awarenessSources: z.array(z.string().min(30)),
    /** How it reaches a player who cannot name it. */
    actsWithoutAttribution: z.array(z.string().min(40)),
    description: z.string().min(150)
});
export type ApexInstitution = z.infer<typeof ApexInstitutionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// WHAT A COURT CALLS ITS PEOPLE
//
// Not a disciple ladder, and this is the whole difference between a court and
// a sect. A sect ranks people by how far along its own road they have walked,
// so its ladder is a curriculum with titles on it. A court does not teach and
// does not admit: it administers an arterial vein for something above it, and
// the only questions it ever has to answer are which tenant draws what, who
// signed for it, and whether the figure was true. So its titles are the pieces
// of that job, held by one person each, and a court with nobody in an office
// has a piece of the arterial nobody is doing.
//
// Two consequences worth writing down, because both look like errors:
//
//   - THE TITLES DO NOT SORT. The Sill Courier stands four realms below the
//     Keeper of the Eleven and is not junior to her; she carries the grants and
//     he apportions them, and neither office contains the other. A court roster
//     read as a ladder reads as nonsense, which is the correct reading.
//
//   - EVERY OFFICER HOLDS TWO STANDINGS. The court office is what they do, and
//     `apexRank` is where they stand inside the institution that posted them -
//     a title from that apex's own `ranks`. That is what a posting means. The
//     Deep Survey's ladder says outright that Sill-Sworn is an appointment to a
//     court rather than an honour, and this field is the other end of that
//     sentence: the people in these rosters are Survey and Long Cut staff on a
//     posting, not a local body that grew where it stands.
//
// The Root Sill is the case that proves the rule and is written to. Its offices
// are the Kiln Warden ranks the province has been looking at for nine hundred
// years, because the Wardens ARE the Root Sill; the reveal is not a new set of
// titles, it is the second column.
// ─────────────────────────────────────────────────────────────────────────

export const CourtOfficerSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(2),
    /** The office. Named for a piece of the work, never for a rung. */
    title: z.string().min(3),
    /** What that office actually does, stated as a task rather than a status. */
    office: z.string().min(60),
    /** Same scale as everywhere else, and capped by the court's own ordinal. */
    realmOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Their standing inside the apex that posted them. A title from its ranks. */
    apexRank: z.string().min(1),
    /** One thing. The floor is deliberately tiny; the best answers are short. */
    wants: z.string().min(3),
    fears: z.string().min(3),
    /** One concrete thing: a habit, a possession, a record, a refusal. */
    detail: z.string().min(30)
});
export type CourtOfficer = z.infer<typeof CourtOfficerSchema>;

export const CourtSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    apexId: z.string(),
    /**
     * Strongest member, same scale as everywhere else. A court has to outrank
     * every sect holding from it, or non-renewal is a suggestion.
     */
    powerOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /**
     * The one who got furthest, and what happened to them.
     *
     * This is the difference between a court and an apex, stated as a fact
     * rather than a rank. An apex has somebody at the last realm sitting on
     * what a founder sent down. A court had somebody at the last realm and no
     * longer does, and the two ways of no longer having them are the two ways
     * the crossing ends for everybody who is not an apex: you attempt it and
     * leave a scar, or you do not attempt it and old age takes you at the top
     * of the ladder.
     *
     * Null where a court has never produced one, which is the ordinary case.
     */
    highWaterMark: z.object({
        name: z.string().min(2),
        ordinal: z.number().int().min(0).max(MAX_ORDINAL),
        yearsAgo: z.number().int().min(1),
        /** 'attempted' left a scar; 'declined' died of old age at the rung. */
        end: z.enum(['attempted', 'declined']),
        note: z.string().min(120)
    }).nullable(),
    /** The arterial vein it administers. */
    administers: z.string().min(40),
    /** Region id whose sects hold from it. */
    grantsInRegionId: z.string(),
    /** A faction in the sect catalog that IS this court, where one is. */
    embodiedByFactionId: z.string().nullable(),
    /**
     * Why this court's offices are named the way they are, derived from what it
     * administers rather than from anybody's ladder. See the section comment
     * above `CourtOfficerSchema`.
     */
    officesNote: z.string().min(120),
    /**
     * Set only where the court has changed patrons, which has happened once.
     *
     * A court that moves takes its ground, its clients and its people, and its
     * people arrive holding titles from a ladder that no longer applies. The
     * conversion is never clean and the places it is not clean are where the
     * grievances live, so they are written down rather than smoothed over.
     */
    transferNote: z.string().min(120).optional(),
    /**
     * The court's own name for its top office, where it has one.
     *
     * `leaderTitleOfCourt` derives "the Ninth Lord" from "The Ninth Face
     * Court", which is right for a court the apex posted and named. It is
     * wrong for one that grew and was re-described afterwards: the Kiln has
     * called its senior a Keeper of the Kiln for nine hundred years and did
     * not stop when the Survey started calling the posting something else.
     * Set this where the house names its own; leave it out where the apex does.
     */
    leaderTitle: z.string().min(3).optional(),
    /**
     * The people actually standing in those offices.
     *
     * A court is not a wall of names and a dead high-water mark. It is between
     * three and six people doing a job on somebody else's vein, and the first
     * of them is the `powerOrdinal`: that number is defined as the strongest
     * member who will answer, so somebody in this array has to be at it.
     */
    roster: z.array(CourtOfficerSchema).min(3),
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
        factionId: null,
        name: 'The Deep Survey',
        traditionId: 'tradition-drawn',
        // Tribulation Transcendence Late. Above the Hollow Court, which is the
        // ceiling of the visible world, and above every court and tenant beneath
        // it - the Survey can end a four-hundred-year sect by declining to sign,
        // and this is the number that says the sect could not answer.
        powerOrdinal: 43,
        stock: {
            remaining: 'spent',
            description:
                'Nothing anyone has seen in six hundred years. Whatever the founder left beyond the Lamp went into an unbroken run of crises the Survey does not enumerate, and the storehouse under the datum vault is inventoried annually by a clerk who has never had to change a figure.',
            buys:
                'Nothing. The Survey wins by never being made to spend, which is a posture available only to an institution that has nothing left to spend.',
            cannotRestock:
                'The person who made it went through the Lid. Nothing comes back that way, and no living hand can produce any of it.'
        },
        heritage: 'ancient',
        secondStrongestOrdinal: 39,
        depthNote:
            'A filled ladder underneath, and the Survey does not publish where it thins because it does not thin anywhere anyone has been able to check. Losing the seated one would be a catastrophe of a specific kind - the Lamp becomes takeable - and would not be an institutional collapse. There is a great deal of Survey below the Survey.',
        instability:
            // Written to stand alone. It used to open "Almost none, and the
            // exception is specific:", which is an answer to an unstated
            // question, and the Standing Register concatenates these fields
            // into one paragraph without their labels - so it landed mid-page
            // as a non-sequitur. Every field in this record has to read as a
            // sentence somebody could have said, not as the second half of an
            // exchange.
            'The Survey is almost entirely stable, and its one exposure is specific: the position rests on one person not standing up. Anything large enough to require her attention elsewhere ends the arrangement in an afternoon, and the Survey has structured four hundred years of procedure around never producing such a thing. It is stable in the way a held breath is stable.',
        lastRealm: {
            count: 1,
            pinned: true,
            holderName: null,
            note: 'One, seated under the datum vault and cultivating without interruption, on top of what the founder sent down. The Survey administers a vein system across a province on the strength of a single person who has not left a room in four hundred years, and its entire posture - the couriers, the unappealable arbitration, the letters that do not wait for an answer - is built to make sure nobody ever needs to test whether that person would come out.'
        },
        sentDown: {
            id: 'sent-datum-lamp',
            name: 'The Datum Lamp',
            description:
                'A survey instrument, in the sense that a sword is a length of metal. The founder of the Survey sent it back down after her crossing, and it does the one thing nothing on this side does: it holds a fixed reference that is not local. Everything the Survey measures is measured against it in the end.',
            uses: [
                'comprehension at the last realm - it presents a structure from the far side of the Lid as something that can be studied rather than inferred, which is the difference between guessing at the crossing and reading about it',
                'a channel upward, used four times in nine hundred years, each of which cost more than the Survey has ever explained - and the cost is the better explanation for the number than expense alone: every use is presumed to risk the thing the object is anchoring, which is why four is a total rather than a rate'
            ],
            asAnArtifact:
                'Set the Lid aside and it is still an immortal-made instrument, and the practical effect is that its holder cannot be lied to about where anything is. Formations do not resolve against it, concealment does not hold in front of it, and a boundary dispute in its presence is over. The Survey has won four hundred years of arbitrations it never had to attend, and the reason is not procedural.',
            reserveTerms:
                'Never carried, never lent, never demonstrated - and this reads as policy only until you understand that it is not one. See `cannotLeave`. The Survey does not deny that it exists and has never once described what it does.',
            cannotLeave: {
                portable: true,
                whatItCouldDo:
                    'Nothing physically stops four Surveyors carrying it out of the vault, and its effects would travel with it. A holder who cannot be lied to about where anything is, formations that do not resolve against it, concealment that does not hold in front of it, and any boundary dispute anywhere in the world over on arrival. Walked into a room, it settles the room. There is no faction in either province that could argue with it in person and several that would simply concede on sight.',
                whyItNeverWill:
                    'Because the headquarters would be empty. Nothing happens to the institution if the Lamp goes out of the door - no structure fails, nothing is unanchored, and the Survey would be exactly as capable in the field. The problem is that the seat is full of valuable things and the defence is presence: the Lamp and the one seated under the vault are what keeps the place unopened, and both of them would be somewhere else. It is a logistics problem and a security posture, and the Survey has never dressed it up as anything more interesting.',
                whatExposedMeans: [
                    'A building with several centuries of accumulated wealth in it and nobody of consequence inside: the standing stock, the founding volumes, the arterial survey in its original hand, artifacts entered on the register and never described, and the sealed volumes for years four hundred to nine hundred.',
                    'Seals that hold against a casual attempt and are not proof against a competent crew with weeks and no interruptions. They were cut to deter, and deterrence assumes somebody is coming home.',
                    'The one seated under the vault cannot carry it. Nobody can. She could take the Lamp and perhaps two other things, and everything else stays in a room whose only real defence has just walked out of the province.',
                    'The courts would keep functioning throughout, which is the part that makes it survivable and also the part that makes it tempting: the Survey would still be the Survey, minus whatever was taken, and would have to explain the gap in a register it publishes to itself.'
                ],
                howQuickly:
                    'The absence is the whole window. A crew that knows the vault is unattended has exactly as long as the journey lasts, and a Survey party walking a dispute in person is gone for weeks. Nothing about it needs to be fast - it needs to be uninterrupted, which is the same thing from the other side.',
                theBind:
                    'Their single greatest asset is the one thing they cannot take anywhere, and the reason is not grand. They stay put because leaving means being robbed. They could settle any dispute in the world by attending it, and would come back to a lighter building - so the Lamp has never left the chamber, and the Survey has never once turned up to anything in person.',
                whoWouldTry:
                    'Not an apex, which is what makes it a real risk rather than a theoretical one. An ordinary ambitious sect with a formation master, a decent crew and patience - the Ashen Forge Clan could field one, the Crimson Abyss Hall would pay for one, and there are eleven institutions in the province with the means and no standing to lose. None of them would face the Survey. All of them can count.',
                deferenceLogic:
                    'It is the deference border applied to an apex. The Survey is not defended in the sense of being hard to enter; it is defended by a belief about what would happen to anybody who tried, held by everybody who might otherwise. That belief is worth exactly what the last test was worth, and there has not been a test - so nobody knows the real value, including the Survey. Its whole posture, the couriers who do not wait, the arbitration nobody attends, the rulings that cannot be appealed, exists so that the question is never put. The institution is built to make sure nobody ever needs to find out whether the one under the vault would come out, and the honest answer is that she would rather not, and they cannot afford to be asked. Somebody has certainly thought about this. Somebody may already be counting the days the vault has gone unattended.',
                nearlyDid: {
                    yearsAgo: 240,
                    what: 'Two arterial veins were being worked simultaneously by parties the Survey could not identify, its couriers were being turned back at three borders, and a Sill ruling was openly ignored for the first time in the institutional record. It was the closest the arterial system has come to being taken out of Survey administration, and everybody involved knew it.',
                    proposedBy: 'The Surveyor of the second arterial, seconded by the Sill-Sworn of the Third Sill, in writing, in a minute that still exists.',
                    theArgumentThatStopped:
                        'The Surveyor of the fourth arterial asked who was sitting on the vault while they did this. Nobody had an answer, because there is not one: there is one person of consequence at the seat, she was the person they proposed to send, and the building she would be leaving contains everything the institution has ever been given. The minute records the question and no reply, and then the proposal being withdrawn by the party that made it. It is four lines long and it is the whole of the Survey self-understanding: they are not an army, they are a very well-supplied office with one guard.',
                    outcome: 'The Lamp stayed in the chamber. The Survey lost the two arterials for nineteen years, recovered them by ordinary administration and outliving the parties, and has never revisited the question. The Surveyor who proposed it was not censured and served another two hundred years.'
                },
                whoOutsideKnows:
                    'The Long Cut has wondered for two centuries why the Survey never brings the object to a dispute in person, and its files record the observation as institutional discretion - the reading one legalistic body naturally reaches about another. The gap between discretion and cannot is the entire intelligence question. If the Long Cut ever established that the Survey stays home because leaving means being robbed, it would hold the most valuable thing either apex has about the other: not that the Survey is strong, which everybody knows, but that its strength has a fixed address and one guard, and that every unappealable ruling for four hundred years has been issued by an institution that could not have enforced it in person. Nobody else has even the observation. The Anchorhold, which has noticed that its own datum stone refers to a survey it does not hold, is closer than it knows and is asking a different question.'
            },
            ifUncovered:
                'It is a physical object in a room, and the room is guarded by exactly one person. If that person is ever elsewhere it can be taken by anyone who can reach the chamber - and the Court, which has four people who would each have a reason, is only the most obvious. Every sect holding a sealed ancestor is holding a single-use asset, and this is the object that would justify spending it - a permanent advantage for a one-off, which is a trade a great many quiet mountains have already priced.',
            intact: true
        },
        holds:
            'The arterial system: not the eleven veins of the Low Fall but the four beneath them that the eleven branch from, and the datum every survey in the province is ultimately measured against without knowing whose datum it is.',
        courtIds: ['court-kiln'],
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
        factionId: null,
        name: 'The Long Cut',
        traditionId: 'tradition-cut',
        // One rung below the Deep Survey and by the same logic. The Long Cut
        // administers everything itself, so its floor is not what its tenants
        // can field - it has none - but what it must be able to walk into.
        powerOrdinal: 42,
        stock: {
            remaining: 'depleted',
            description:
                'Three sealed cases in the seat chamber, and the Long Cut publishes the count. It has published a decreasing count for eleven hundred years, which is the most honest thing any institution in the setting does and also an extremely effective deterrent.',
            buys:
                'Three emergencies, and everyone knows it is three, so the Marches has arranged itself carefully around never being the fourth.',
            cannotRestock:
                'The founder drove the Nail through and did not come back. What is in the cases is what there is.'
        },
        heritage: 'ancient',
        secondStrongestOrdinal: 38,
        depthNote:
            'Forty posted staff, and the top of them is much closer to the seat than anyone outside assumes. The Long Cut does everything itself, which over eleven hundred years has produced an unusually even distribution: no prodigies, no gaps, and nobody who has not done the work below them.',
        instability:
            'The Nail cannot be moved, so the Long Cut cannot retreat with it, cannot hide it and cannot bargain with it. Its whole position is a siege it has been winning by default for so long that the staff of forty treat the seat as geography rather than as a garrison.',
        lastRealm: {
            count: 1,
            pinned: true,
            holderName: null,
            note: 'One, and the Long Cut is more honest about it than the Survey is: the posted staff of forty exists precisely because the one who could settle anything permanently is sitting on the thing that must not be left. Legalism is what an institution does when its strongest member cannot be spent.'
        },
        sentDown: {
            id: 'sent-ninth-nail',
            name: 'The Ninth Nail',
            description:
                'A nail, and it is genuinely a nail: a hand span of dull metal that the founder of the Long Cut drove through from the other side rather than sent. It is the only object in the Marches that does not move, and every perimeter in five provinces is surveyed off it.',
            uses: [
                'comprehension at the last realm - it was driven through the Lid from above, so it is a worked example of the crossing that can be held in the hand, and the Cut tradition holds this to be worth more than any manual',
                'a channel upward, in one direction only: things can be said along it, and nothing has ever been said back'
            ],
            asAnArtifact:
                'It is a fixed point in a world where nothing else is fixed, which sounds academic until somebody tries to move, fold or unmake ground near it and finds that they cannot. The Marches has never lost a perimeter within sight of it. Anyone holding it holds ground absolutely, which is worth having whether or not they ever intend to look upward.',
            reserveTerms:
                'The Long Cut cannot move it and has stopped pretending that this is a policy. It is where it is. The seat was built around it afterwards.',
            ifUncovered:
                'It cannot be carried off, which makes the problem different rather than smaller: anyone who reaches it can use it in place for as long as they are left alone there, and the only reason nobody has is that somebody is always sitting on it. The Long Cut is candid inside its own records that if the seat is ever vacated the contenders will not be the Court alone but every sect that has been maintaining a seal and waiting for a reason to spend it.',
            cannotLeave: null,
            intact: true
        },
        holds:
            'Driven ground, directly: every province where the qi went into the stone rather than staying in the air, of which the Quiet Marches is one and not the largest, administered face by face with no client sects, no leases and no vassals anywhere in the arrangement.',
        courtIds: ['court-ninth-face', 'court-third-sill'],
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
    },
    {
        id: 'apex-azure-cloud',
        factionId: 'sect-azure-cloud-pavilion',
        name: 'The Azure Cloud Pavilion',
        traditionId: 'tradition-drawn',
        powerOrdinal: 41,
        stock: {
            remaining: 'nearly_intact',
            description:
                'Eleven years of divestment, three hundred and eighty years old, and largely untouched. Pills refined by a method that ended with her, materials from ground that is now thin, and a quantity of single-use work nobody alive could attempt - the Pavilion holds the full sequence in which she left it and has never published the list.',
            buys:
                'Confrontations it should lose. The Pavilion is the weakest of the three by standing power and the only one that can afford to spend its way through a bad decade, which is why nobody has yet found out where the bottom of it is.',
            cannotRestock:
                'She is through the Lid. Every use is permanent, the stock only ever goes down, and the Pavilion is three hundred and eighty years into a resource that has no second source.'
        },
        heritage: 'recent',
        secondStrongestOrdinal: 37,
        depthNote:
            'A cliff, and it is the signature of a young power. Ru Anjing is through the Lid, her younger sister holds the hall at the first rung of the last realm, and the next name after that is early Grand Ascension - three full stages down, with nobody in between. The Pavilion is not hiding this; it cannot. Any rival who counts the sect roster arrives at the same figure, and the figure says that the Pavilion is one person deep.',
        instability:
            'The other two are ancient and cannot be dated. This one can: three hundred and eighty years, one crossing, one person. Its position is real and it is young, and youth is the whole exposure - the Pavilion has a front gate, an outer courtyard, an admission standard and disciples, so it can be found, petitioned, joined, watched and counted in a way the other two never can. It is the brightest position in the region and the only apex that could be ended by something other than a fight.',
        lastRealm: {
            count: 1,
            pinned: true,
            holderName: 'Ru Anwei',
            note: 'One: Ru Anwei, younger sister of the woman who crossed, at the first rung of the last realm and no further after three hundred and eighty years. She sits in the inner hall with the Edge. Ru Anjing spent her last decades making the sect independent rather than strong - settling what was outstanding, calling in what was owed, and leaving the cost of touching the Pavilion legible enough that nobody has since wanted to establish the figure - and then left her sister to hold it. The province finds the arrangement touching. Every rival reads it as exactly what it is: an apex resting on one woman who is the weakest thing at her own tier - one woman, one object, and nothing behind either of them. What that reading leaves out is what she is holding and what she would do with it, which is the whole of why nobody has tested it: she cannot hold a province and does not have to. She has to reach one man once.'
        },
        sentDown: {
            id: 'artifact-the-standing-edge',
            name: 'The Standing Edge',
            description:
                'A sword left point-down in the floor of the inner hall, which no living smith can account for and no formation master can read. It does not need drawing to be measured: standing in the room with it is how the Pavilion certifies that a visitor is who they say they are. Twice in three hundred and eighty years it has been drawn, and both times the argument stopped.',
            uses: [
                'comprehension at the last realm - it is the only such object whose sender is still remembered by name, and the Pavilion holds the full record of her divestment, which is a map of what she thought mattered on the way out',
                'a channel upward, which the Pavilion spent a hundred and eighty years ago and which returned two words. It has not been attempted again and the Pavilion will not say whether it could be'
            ],
            asAnArtifact:
                'It settles the question of who somebody is, permanently and without appeal, in a world where identity is a thing people lose at realm boundaries and forge for a living. A sect that can certify a person is a sect every ledger, house and court in the region has to deal with, and the Pavilion has never had to advertise this.',
            reserveTerms:
                'Held in reserve, never carried. The Pavilion Master may draw it only with four Sword Elders consenting in the same room, and the Pavilion has refused itself permission at least nine times, including once during a siege.',
            ifUncovered:
                'Easily the most exposed of the three, and the Pavilion knows it. The hall is inside a working sect with a gate and a courtyard rather than under a mountain nobody can find, and the one who sits with it is the whole of the defence. Every party that has priced the other two has also priced this one, and it prices lower.',
            cannotLeave: null,
            intact: true
        },
        holds:
            'The gorge vein at Low Fall and the terraced peaks above it, held outright and openly, on no grant from anyone, since the year Ru Anjing crossed.',
        courtIds: ['court-azure-mist'],
        ranks: [
            {
                title: 'Pavilion Master',
                decidedBy: 'The consent of the Sword Elders, and in practice by who is prepared to carry the sect rather than by who is strongest in it.',
                note: 'The one apex rank in the world that a person outside the institution can name and often has met.'
            },
            {
                title: 'Sword Elder',
                decidedBy: 'Service, and a vote of the standing elders. Four seats, and they have been four since the divestment.',
                note: 'Any one of them can refuse the drawing of the Edge, which makes the seat worth more than the strength behind it.'
            },
            {
                title: 'Core Disciple',
                decidedBy: 'Sponsorship by a sitting elder, and a record of work the sect can point at. Sponsorship can be withdrawn and occasionally is.',
                note: 'The rung where the Pavilion stops being an ordinary sect to the person standing on it, and where they are first told there is an inner hall.'
            },
            {
                title: 'Inner Disciple',
                decidedBy: 'Years given, and the judgement of whoever taught them. The Pavilion promotes on trust and says so.',
                note: 'Publicly listed, unlike anything at the other two apexes, and the list is read by every rival in the province the week it changes.'
            }
        ],
        rankIsOrdinalDerived: false,
        ranksByRealmAboveOrdinal: 37,
        rankNote:
            'Alone among the three, this ladder is public and the sect runs an ordinary outer courtyard beneath it. A Sword Servant swept the same stones as everyone else and can name the Pavilion Master on sight, which is precisely the exposure the other two apexes were built to avoid, and precisely why the province thinks of the Pavilion as reachable in a way the Survey and the Cut never are.',
        startingAwareness: 'named',
        awarenessSources: [
            'Any market town in the Low Fall. The Pavilion is a place with a road to it and a recruitment cycle, and the crossing is the proudest story the province has.'
        ],
        actsWithoutAttribution: [
            'It does not need to. Alone among the three it acts in its own name, which is a luxury and, increasingly, a liability - every refusal it makes is attributable, dated and remembered by whoever was refused.'
        ],
        description:
            'The third apex, the youngest by an order of magnitude, and the only one anybody can walk to. It holds the gorge outright on no grant, having been made independent by Ru Anjing in the decades before her crossing, and it holds the newest object in the world sent down from the other side of the Lid. Everything the Deep Survey and the Long Cut achieve through being unnameable, the Pavilion achieves through being unambiguous - and it is the one position of the three that can be lost without a fight, because prestige from a single event decays on a schedule nobody controls.'
    }
];

/** The courts. Each administers one arterial vein on an apex's behalf. */
export const COURTS: readonly Court[] = [
    {
        id: 'court-third-sill',
        name: 'The Third Sill Court',
        // Transferred. The Third Sill administered the third arterial under
        // the Deep Survey for nine hundred years and does not any more, and the
        // reason is in this catalog rather than in a chronicle: three of its
        // own clients - the Frostmirror, the Storm Tyrant and the Nine Abyss -
        // have been contesting the third arterial's grant book for two
        // centuries (see `contestedClaimsOf`), the Survey declined to settle it
        // on the standing ground that a grant dispute among clients is the
        // court's own business, and the Long Cut offered to settle it. That is
        // the whole of it. No fighting, no betrayal, no announcement - an
        // administration went where its problem could be solved, which is the
        // only thing an administration has ever done.
        apexId: 'apex-long-cut',
        // Grand Ascension Late. Its strongest tenant is the Storm Tyrant Court at
        // Body Integration Perfection, and a court that could not answer its own
        // tenant would be issuing suggestions rather than grants.
        powerOrdinal: 38,
        highWaterMark: {
            name: 'Shen Guyi',
            ordinal: 44,
            yearsAgo: 160,
            end: 'declined',
            note: 'Reached the end of Tribulation Transcendence in the Sill\'s own service and spent his last eleven years divesting, exactly the way somebody preparing to cross divests: artifacts, manuals, stones, given away in a recorded order. Then he did not attempt it. He sat, and old age took him at a rung nobody has stood on in the Low Fall since. He never said why, and the one time he was asked he said that he had thought about it. The Sill has been a court for a hundred and sixty years rather than something else because of that decision, and does not discuss it.'
        },
        administers: 'The third arterial vein, which the eleven surveyed veins of the Low Fall branch from.',
        grantsInRegionId: 'region-low-fall',
        embodiedByFactionId: null,
        officesNote:
            'Four things happen to a grant and the Sill has one person for each: it is measured, it is apportioned, it is drafted, and it is carried. Nobody here is anybody\'s disciple and nobody here teaches, so there is no ladder and never has been - an Assessor does not become a Keeper of the Eleven by being good at assessing, he becomes one because the office fell vacant and somebody had to hold it. Inside the Deep Survey the same five people are a Surveyor, a Sill-Sworn, two First Marks and a Second Mark, which is the standing that would decide a room if they were ever all in one, and they have not been in one in ninety years. The two columns do not agree and the Survey does not expect them to: the courier stands a mark above the man who measures the vein and eight rungs below him on the ladder, which is exactly what a body that ranks by service rather than by realm looks like from close up.',
        transferNote:
            'Every officer here holds a Long Cut rank now, and the conversion was not clean. The Survey ladder had a rung for a posting to a court and the Long Cut ladder has no such thing, so the Sill-Sworn came out a Set Hand, which is two removes from what the title meant and is the sort of thing a career notices. The Sill Courier came out a Face Master, one rung above the Assessor she has always been eight ordinals beneath, because the Long Cut counts what a person does on a course rather than where they stand on the ladder - which is the same quirk the Survey had, arrived at for a different reason, and is the only part of the transfer nobody has complained about.',
        roster: [
            {
                id: 'court-officer-ruan-kezhen',
                name: 'Ruan Kezhen',
                title: 'the Third Lord',
                office: 'Signs the eleven grants and, four times in the last century, the non-renewals. He has never been to the Low Fall and has never had to be.',
                realmOrdinal: 38,
                apexRank: 'Course Keeper',
                wants: 'to hand the third arterial on to whoever comes next without having been made to answer the Frostmirror in person',
                fears: 'a question that can only be settled by attending it',
                detail: 'Reads every draft his Sill-Sworn puts in front of him, signs about two thirds, and returns the rest with a single word in the margin and no explanation of it.'
            },
            {
                id: 'court-officer-bai-zhensu',
                name: 'Bai Zhensu',
                title: 'the Sill-Sworn',
                office: 'Drafts everything the Third Lord signs, and keeps the twelve-year book in which every grant in the province has a page and a date.',
                realmOrdinal: 33,
                apexRank: 'Set Hand',
                wants: 'the Frostmirror correspondence answered, in writing, by somebody',
                fears: 'that the correct answer is the one the Sill is giving, and that she has been wrong about it for eleven years',
                detail: 'Seconded the proposal to send the Lamp out of its chamber two hundred and forty years ago, in writing, and has drafted four replies to the Frostmirror Court in the last eleven and filed all four unsent.'
            },
            {
                id: 'court-officer-gu-mianzhi',
                name: 'Gu Mianzhi',
                title: 'Keeper of the Eleven',
                office: 'Decides what share of the third arterial each of the eleven surveyed veins beneath it may draw, and revises the figures on the same twelve-year cycle as the grants.',
                realmOrdinal: 30,
                apexRank: 'Face Master',
                wants: 'the eleventh vein struck off the apportionment, because it has not drawn its share in sixty years and somebody is drawing it',
                fears: 'being right about that',
                detail: 'Keeps the apportionment on eleven separate sheets rather than one, so that no visitor who sees a figure ever sees what it is a share of.'
            },
            {
                id: 'court-officer-tang-qishan',
                name: 'Tang Qishan',
                title: 'Assessor of the Third',
                office: 'Walks the arterial itself, measures what is in it, and reports a figure the whole apportionment is then calculated from.',
                realmOrdinal: 29,
                apexRank: 'Hand',
                wants: 'his own cold-arterial figures read next to the Frostmirror\'s, once, by anybody at all',
                fears: 'that the two sets agree',
                detail: 'Walks the arterial end to end every fourth year on foot rather than flying it, on the grounds that a figure taken at height is a figure taken from a distance, and has done it nineteen times; he has been a Second Mark for all nineteen, because his figures keep disagreeing with the apportionment that is calculated off them.'
            },
            {
                id: 'court-officer-yin-cha',
                name: 'Yin Cha',
                title: 'the Sill Courier',
                office: 'Carries the grants to the eleven gates, hands them over, and does not stay for an answer. She is the only part of the Third Sill anybody in the province has ever seen.',
                realmOrdinal: 21,
                apexRank: 'Face Master',
                wants: 'to be allowed to take the chair once',
                fears: 'the gate that does not open on the day',
                detail: 'Ninety years on the same circuit. She is greeted by name at four of the eleven gates and by title at none, has been offered a chair at seven of them, and refuses every time because she is instructed to - and she stands a full mark above the Assessor inside the Survey while standing eight rungs below him on the ladder, which neither of them has ever mentioned to the other.'
            }
        ],
        startingAwareness: 'unaware',
        description:
            'The office the Low Fall actually holds from, though no sect in the province would put it that way and most would deny the framing. Grants are issued in writing, renewed on a twelve-year cycle, and delivered by a courier who does not stay for an answer. The Sill has never been to the province. It has never needed to.'
    },
    {
        id: 'court-kiln',
        // The id used to be `court-root-sill`, which was the name the OTHER
        // half walked off with. The row was calling itself by its sibling's
        // name in its own id and in its own officesNote while being named the
        // Kiln Court, which is the schism written down wrong rather than the
        // schism.
        //
        // The old name, kept by the half that stayed. For nine hundred years
        // this court had two of them - the Survey called it the Root Sill and
        // the province called it the Kiln - and nobody had to choose, because
        // a Keeper of the Kiln was a Sill-Sworn of the Deep Survey and both
        // sentences described one person. When the house split, each half took
        // one of the names, and the one that kept the ground kept the older.
        // See `THE_KILN_SCHISM`.
        name: 'The Kiln Court',
        apexId: 'apex-deep-survey',
        powerOrdinal: 37,
        highWaterMark: null,
        administers: 'The datum itself: the deep vein at the world\'s root that the arterial system is measured from.',
        grantsInRegionId: 'region-low-fall',
        // Null on purpose, and this is the change. It used to point at
        // `sect-kiln-wardens`, because they were the same people. They are two
        // bodies now and the join would be a lie.
        embodiedByFactionId: null,
        leaderTitle: 'Keeper of the Kiln',
        officesNote:
            'The offices are the four Warden ranks the province has been reading off the gate for nine hundred years, because there is nothing else to reveal: the Kiln issues no grants, administers no tenants and has no correspondence, so it has no drafting office, no courier and no apportionment. What it has is a datum, nine hundred formation nodes and a perimeter, and the work is walking all three on a schedule. The second column used to be the whole of the reveal - a Keeper of the Kiln was a Sill-Sworn of the Deep Survey, which explained nine hundred years of refusing applicants, taking nothing out of the richest ground in the world, and having no grievance. It explains less now, because the people who found that sentence intolerable are not here to be described by it. Ji Wanluo is Keeper of the Kiln and there is another Keeper of the Kiln four provinces away who says she is not.',
        roster: [
            {
                id: 'court-officer-ji-wanluo',
                name: 'Ji Wanluo',
                title: 'Keeper of the Kiln',
                office: 'Holds the datum, reports one figure upward once a year, and answers nothing downward. The figure has not changed in her tenure and she submits it anyway.',
                realmOrdinal: 37,
                apexRank: 'Sill-Sworn',
                wants: 'nothing she has ever stated to anyone outside the perimeter',
                fears: 'the figure changing',
                detail: 'Holds the original posting order, which is nine hundred years old, names the first four Wardens, and is the only document at the kiln that is not a number.'
            },
            {
                id: 'court-officer-che-yuan',
                name: 'Che Yuan',
                title: 'Gate Warden',
                office: 'Turns applicants around. Once, politely, with the distance to the nearest inn given in li and the walking time given in hours, and then he closes the gate.',
                realmOrdinal: 31,
                apexRank: 'First Mark',
                wants: 'to be permitted to give the second figure, which is how far it is to a sect that would take them',
                fears: 'the day a figure does not work and somebody keeps standing there',
                detail: 'Has turned away something over four thousand people and can name the eleven who came back a second time, which is not a list he has been asked for and is not written down anywhere.'
            },
            {
                id: 'court-officer-lou-tinghe',
                name: 'Lou Tinghe',
                title: 'Second Warden',
                office: 'Holds the node rota: nine hundred lit nodes walked and checked on a cycle, which is the only reason the world\'s one complete formation network is still complete.',
                realmOrdinal: 29,
                apexRank: 'First Mark',
                wants: 'the rota shortened by one day, which she has requested four times in sixty years',
                fears: 'a node that goes out between passes',
                detail: 'Carries the rota as a knotted cord rather than a book, because a book gets wet and the cord tells her where she is by touch in the dark.'
            },
            {
                id: 'court-officer-xie-bo',
                name: 'Xie Bo',
                title: 'Warden',
                office: 'Walks the perimeter, which is nine days out in every direction, and reports what crossed it. Most years the answer is nothing.',
                realmOrdinal: 25,
                apexRank: 'Second Mark',
                wants: 'a season on the node rota instead, for a change of ground',
                fears: 'nothing he can name, which the other three have noticed',
                detail: 'The only Warden in living memory to have spoken a sentence to an outsider that was not a number, and he has never been told whether it was held against him.'
            }
        ],
        startingAwareness: 'unaware',
        description:
            'The court nobody in the province has recognised as a court, and which the province has called the Kiln Wardens for nine hundred years without being corrected. The Kiln Court holds every node lit, draw nothing from the richest ground in the world, make no ancestral claim, refuse all applicants, have no grievance in nine hundred years of outside record, and have never been observed making an exchange of any kind - because they are not a faction with strange habits. They are staff, posted, doing an assigned job on someone else\'s datum, and every single thing the province finds inexplicable about them is explained by that sentence.'
    },
    {
        id: 'court-azure-mist',
        name: 'The Azure Mist Court',
        apexId: 'apex-azure-cloud',
        startingAwareness: 'named',
        description:
            'The Azure Cloud Pavilion\'s own court, on the mist terraces below the gorge, running the runoff of the vein Ru Anjing worked and teaching the Pavilion\'s forms to the people the terraces sent back. It is the youngest court in the world by nine centuries and the only one that was never posted: it grew, on water nobody wanted, and was re-described afterwards. Four people hold it - a Court Warden one rung under Grand Ascension whose own register entry still reads placement, an elder who has quietly taught nineteen students the terraces later took back, a disciple keeping channel figures nobody else can read, and a servant who knows the walking time to every sect in the province because he gives it to everybody the Mist cannot take. The Low Fall calls it a feeder and has not revised the figure in a hundred and fifty years.',
        // The youngest court in the world by nine hundred years, and the only
        // one whose apex did not appoint it: the Mist became a court the way
        // the Pavilion became an apex, by one person going further than the
        // institution around her and the institution being re-described
        // afterwards. It was filed as a feeder for three centuries on the
        // strength of a power figure that stopped being true in the second one.
        powerOrdinal: 37,
        // Null on purpose: a high-water mark is somebody the house is past.
        // The Mist has never been past anybody - its strongest is alive, in
        // post, and still the reason the figure moved.
        highWaterMark: null,
        administers: 'The mist terraces below the gorge and the runoff of the Pavilion\'s own vein, which is water nobody else wanted and which turns out to have carried two people to the top of the world in one lifetime.',
        grantsInRegionId: 'region-low-fall',
        embodiedByFactionId: 'sect-azure-mist-court',
        transferNote:
            'Not a transfer - a promotion, and the only one in the catalog. The Mist was a feeder sect under the Azure Cloud Pavilion and is now the Pavilion\'s court, on the same ground, with the same four people, doing the same work. Nothing about it changed except the figure everybody was using for it, which had been wrong for a hundred and fifty years. The Low Fall has not adjusted and still calls it a feeder.',
        officesNote:
            'Four offices for four people, and they were invented in an afternoon, which shows. The Mist ran on the Pavilion\'s own disciple ladder for three centuries - Court Warden, Mist Elder, Outer Disciple, Mist Servant - because it was a feeder and a feeder does not need office names. A court does, so it has them now, and every one of them is a flat description of the task: the person who keeps the roll, the person who teaches the second attempt, the person who walks the channels, the person who answers the gate. Nobody at the Mist uses them. The old titles are what everybody still says out loud, including in correspondence with the Pavilion, and correcting it has never been anybody\'s job.',
        roster: [
            {
                id: 'court-officer-pei-hanzhang',
                name: 'Pei Hanzhang',
                // The embodied court keeps its sect's own top rank, the same
                // way the Kiln does: the province has been reading the real
                // title for three centuries without knowing it was one.
                title: 'Court Warden',
                office: 'Holds the recall roll: every disciple the terraces sent down, what they failed at, and what happened to them after. It is the only such record in the Low Fall and the Pavilion has never asked to see it.',
                realmOrdinal: 37,
                apexRank: 'Sword Elder',
                wants: 'the recall rate put in front of somebody at the terraces who can read it',
                fears: 'the day the Mist becomes interesting enough to be worth taking back',
                detail: 'Her entry in the Pavilion\'s register still reads placement. She has never asked for it to be corrected and has been asked why twice, and gave a different answer both times.'
            },
            {
                id: 'court-officer-yu-shenxing',
                name: 'Yu Shenxing',
                title: 'Master of the Second Attempt',
                office: 'Teaches the Pavilion\'s forms to people who failed at them once, which is the entire trade of the house and the one thing the terraces cannot do.',
                realmOrdinal: 21,
                apexRank: 'Inner Disciple',
                wants: 'to be allowed to say out loud that the Mist teaches better',
                fears: 'being right about it in front of the wrong person',
                detail: 'Keeps a tally of which of his students the terraces later took back. It is nineteen, over sixty years, and he has never shown it to anybody at the Pavilion.'
            },
            {
                id: 'court-officer-tan-liuyi',
                name: 'Tan Liuyi',
                title: 'Walker of the Channels',
                office: 'Walks the terrace channels and keeps the runoff moving, which is the whole of the Mist\'s income and takes one person eleven days a month.',
                realmOrdinal: 9,
                apexRank: 'Inner Disciple',
                wants: 'a second pair of hands on the channels before the winter',
                fears: 'the runoff thinning, which she has measured and not reported',
                detail: 'Has three years of channel figures in her own notation that nobody else can read, including the year the flow dropped and came back.'
            },
            {
                id: 'court-officer-kong-zhaoyu',
                name: 'Kong Zhaoyu',
                title: 'Keeper of the Terrace Gate',
                office: 'Answers the gate. The Mist is the one door in the Low Fall that has never turned anybody away for standing, and he is the reason people know that.',
                realmOrdinal: 4,
                apexRank: 'Inner Disciple',
                wants: 'to be sent up to the terraces once, to see them',
                fears: 'being sent up and recalled, like everybody else here',
                detail: 'Knows the walking time to every sect in the Low Fall in hours, because he gives the figure to everybody the Mist cannot take.'
            }
        ]
    },
    {
        id: 'court-ninth-face',
        name: 'The Ninth Face Court',
        apexId: 'apex-long-cut',
        // The Ninth Face Court's tenants are small - the Weir Office at Nascent Soul
        // Early - so this is far above what the Marches requires. A court of the
        // Long Cut is not sized against its province.
        powerOrdinal: 37,
        highWaterMark: {
            name: 'Yun Baiheng',
            ordinal: 44,
            yearsAgo: 90,
            end: 'attempted',
            note: 'The Face took her to the end of Tribulation Transcendence on driven ground, which is the thing a court exists to be able to do once, and she went up alone in the spring and attempted the crossing. There is a scar in the high Marches, eleven li of ground that has not held qi since, and there is no body, because a failed crossing does not leave one. It is the most recent attempt anybody in either province can date, and the Long Cut has not authorised a candidate since.'
        },
        administers: 'The driven ground of the Quiet Marches and four provinces beyond it that the Marches has never heard named.',
        grantsInRegionId: 'region-quiet-marches',
        embodiedByFactionId: null,
        officesNote:
            'The Long Cut ranks by work and its court does the same, so every office here is a face: one person holds the course, one holds the schedule that is countersigned into the Weir Office book, one assesses faces across the four provinces, and one holds a face that cannot be worked and never will be. Nothing is decided by realm and it shows - the man who signs the only document the Quiet Marches has ever been governed by stands eleven rungs below the woman who walks eleven li of dead ground four times a year and records that it is unchanged. Neither office contains the other and the Long Cut has never seen why one would.',
        roster: [
            {
                id: 'court-officer-qiao-shendu',
                name: 'Qiao Shendu',
                title: 'the Ninth Lord',
                office: 'Holds the course: what is cut, in what order, across the ninth face and the four provinces beyond it, on a schedule written a century at a time.',
                realmOrdinal: 37,
                apexRank: 'Course Keeper',
                wants: 'to finish his course without putting a second name forward',
                fears: 'being asked for one',
                detail: 'Authorised Yun Baiheng ninety years ago, in four lines, and has authorised nobody since; the four lines are still the last entry on that page of the course book and he has left the rest of the page blank.'
            },
            {
                id: 'court-officer-chi-yuanru',
                name: 'Chi Yuanru',
                title: 'Assessor of the Four Faces',
                office: 'Rates driven ground across the four provinces the Marches has never heard named, and decides which faces enter the course at all.',
                realmOrdinal: 33,
                apexRank: 'Face Master',
                wants: 'the Marches promoted out of the schedule\'s bottom band, where it has sat for two hundred years',
                fears: 'that the Gapwater figure she has is the right one',
                detail: 'Has the Weir Office\'s own unpublished survey of how much workable stone is left at Gapwater, obtained by asking for it, and the Office does not know she kept the copy.'
            },
            {
                id: 'court-officer-mo-xingzhi',
                name: 'Mo Xingzhi',
                title: 'Face Master of the Eleven Li',
                office: 'Holds a face that cannot be worked: eleven li of high Marches that has not held qi in ninety years. She walks it four times a year and records that it is unchanged.',
                realmOrdinal: 30,
                apexRank: 'Face Master',
                wants: 'the face struck off the course, which she has never requested',
                fears: 'that it will be struck off, and that the record will stop',
                detail: 'Was Yun Baiheng\'s Set Hand for forty years and asked for the posting the season after; her quarterly return has said unchanged three hundred and sixty times and she writes the word out in full every time. She is a Face Master who was never made a Set Hand of the Long Cut, because the one face she worked to completion had a death on it.'
            },
            {
                id: 'court-officer-shao-kang',
                name: 'Shao Kang',
                title: 'the Twenty-Year Hand',
                office: 'Walks into Kettle once every twenty years, countersigns the Weir Office grant book, adjusts the schedule, and is gone inside a day.',
                realmOrdinal: 26,
                apexRank: 'Set Hand',
                wants: 'to be asked once what the countersignature is for',
                fears: 'nothing about the errand, which he has now run four times',
                detail: 'Has never been offered lodging in Kettle, has never corrected a Weir Master who described the countersignature as an internal formality of the Office\'s own devising, and has written a note about it in the margin of the schedule on all four visits.'
            }
        ],
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
    // ── the two Azure feeders ──────────────────────────────────────────
    // The Pavilion has no courts. It grants to these two and to nobody else,
    // which makes its structure the smallest of the three apexes and the only
    // one where the whole arrangement fits on a page.
    //
    // A feeder is not a court. A court administers an arterial vein on an apex's
    // behalf and issues grants of its own; a feeder administers nothing and
    // issues nothing. What it does is hold people - probationers, late
    // admissions, the refused-but-not-disqualified - somewhere the terraces can
    // still see them.
    'sect-azure-mist-court': {
        factionId: 'sect-azure-mist-court',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'sect-azure-cloud-pavilion',
        holds: 'The lower gorge, inside the Pavilion\'s own grant rather than under one of its own, on terms that have never been written down because both parties are the same institution.',
        terms: {
            tributeStonesPerYear: 0,
            inKind: [
                'every disciple the terraces ask for, on the day they ask',
                'a probation roll, submitted quarterly, listing who was sent down and who is ready to go back up'
            ],
            disciplesPerCycle: 0,
            buys: [
                'the lower half of a vein the Pavilion was not using',
                'the standing to teach the Pavilion\'s own forms, which no other body in the province has',
                'nothing resembling independence, and Mist has never asked for any'
            ],
            renewal: 'There is no renewal because there is no grant document. The Mist holds what it holds because the Pavilion has not asked for it back, and both of them know that is the whole of it.'
        },
        standing: 'good',
        awarenessOfApex: 'known',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'Being sent down here is not a disgrace and the province does not read it as one. It reads it as the terraces deciding somebody is worth the cost of somewhere to put them, which is more than they decide about most people.'
    },
    'sect-azure-dew-sect': {
        factionId: 'sect-azure-dew-sect',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'sect-azure-mist-court',
        holds: 'Four hill villages at the head of the gorge, where the vein runs shallow, held from the Mist rather than from the terraces - which is the only place in the Azure grant where anything is held at one remove.',
        terms: {
            tributeStonesPerYear: 0,
            inKind: [
                'anybody it finds who is worth sending up, which is two or three a decade',
                'the village rolls, which the Pavilion has never once read'
            ],
            disciplesPerCycle: 0,
            buys: [
                'the shallow end of the vein and the right to be the only body teaching on it',
                'the Pavilion\'s name at a village door, which opens it'
            ],
            renewal: 'None, same as the Mist. The difference is that the Dew built its own compound, which it mentions.'
        },
        standing: 'good',
        awarenessOfApex: 'known',
        costOfIndependence: null,
        unbackedReason: null,
        independenceStance: null,
        note: 'The Dew is not where people are sent. It is where people are found, which is a different institution wearing a similar name, and the terraces have never been entirely sure what to do with it.'
    },
    'sect-azure-cloud-pavilion': {
        factionId: 'sect-azure-cloud-pavilion',
        governance: 'unassailable',
        relation: 'apex',
        parentFactionId: null,
        holds: 'The gorge vein at Low Fall and the terraced peaks above it, outright, on no grant from anyone. The Pavilion was a Third Sill tenant for fifteen hundred years and stopped being one in the year Ru Anjing crossed.',
        terms: NO_TERMS,
        standing: 'not_applicable',
        awarenessOfApex: 'known',
        costOfIndependence:
            'Nothing recurring, which is what Ru Anjing actually bought with her last decades. She did not make the Pavilion strong - it was already respectable - she made its independence not worth contesting, settled what was outstanding, and left the position standing without her in it. Nineteen grant renewals are still in the archive and the twentieth was never issued or asked for.',
        unbackedReason: null,
        independenceStance: 'proud',
        note: 'The Third Sill Court has never formally acknowledged that the grant lapsed and the Pavilion has never formally asserted that it did. Both parties have found this comfortable for three hundred and eighty years, and the Low Fall reads the silence as whatever suits the speaker.'
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
        parentFactionId: 'sect-frostmirror-court',
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
        note: 'Moved under the Frostmirror when the Frostmirror was promoted, which the Guild was not consulted about and has not forgiven. It now buys cold from its own landlord.'
    },
    'sect-frostmirror-court': {
        factionId: 'sect-frostmirror-court',
        governance: 'federated',
        relation: 'court',
        parentFactionId: 'apex-deep-survey',
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
        note: 'Promoted out of the Third Sill once the ice curriculum turned out to be the one thing in the province nobody could replace. It administers the cold arterial and grants to the Cinnabar Crucible Guild, which needs the cold more than it admits.'
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
        relation: 'court',
        parentFactionId: 'apex-deep-survey',
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
        note: 'Held on probation by the Third Sill for two centuries and promoted over its head, because the lightning curriculum is the one thing in the Low Fall nobody can replace and the Survey would rather administer such a thing than lease it. The probation came with it: a court on probation is a new arrangement and nobody is comfortable with it, least of all the Third Sill, which was not asked.'
    },
    'sect-crimson-abyss-hall': {
        factionId: 'sect-crimson-abyss-hall',
        governance: 'federated',
        relation: 'subsidiary',
        parentFactionId: 'sect-storm-tyrant-court',
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
        note: 'Moved under the Storm Tyrant when the Storm Tyrant was promoted, for a reason the Survey stated in one line: one letter should cover both demonic holdings. Neither party was consulted and both resent it in the same words.'
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
        // The half that walked, under the Survey's own name for the posting,
        // which is the part the Survey finds hardest to answer. It is the
        // second administration the Long Cut has taken from the Deep Survey in
        // living memory and the second that walked rather than fought - and it
        // now stands directly against the first. See `THE_KILN_SCHISM`.
        parentFactionId: 'apex-long-cut',
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
        note: 'Holds nothing from anybody and never has. The paint and the stakes are the whole of the institution, and the burn edge does not care whose name is on a grant.'
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
        note: 'Direct rule by respect. The Grove holds what it can comfortably walk and claims nothing beyond it, and the ground beyond it is nevertheless theirs because nobody has been willing to find out otherwise since the year 41 test. The Third Sill Court has never granted the valley to anyone, has never been asked to, and has left the file open.'
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
// BUYING PEOPLE
// The other intake model, and the only one in the world that takes people
// who have never cultivated at all. It is not charity and it is not a quirk:
// it is the one rational move available to an institution that is thin on
// members and rich in resources, and no other apex is in that position.
// -------------------------------------------------------------------------

export const AZURE_CLOUD_INTAKE = {
    apexId: 'apex-azure-cloud',
    factionId: 'sect-azure-cloud-pavilion',
    intakeModel: 'tests and takes uncultivated mortals' as const,

    theTrade:
        'Two facts about the Pavilion are already established and they answer each other. It is one person deep, with about ninety disciples and six at Core Formation, and it is the richest institution in the region because a woman on the other side of the Lid loves her sister and sends what she can every nine to fourteen years. Thin on members, rich in resources. There is exactly one rational move available to an institution in that position, and the Pavilion has been making it for a century: spend the thing you have in surplus to buy the thing you lack. They are converting medicine, materials and stones into people.',
    whyNobodyElseCanDoIt:
        'And nobody else at that height can copy it, which is why it reads as the sharpest difference at the top of the world rather than as a house style. The Hollow Court, which is unassailable rather than an apex and sits in no tier of this file, will not look at anybody below a Void Refinement floor with evidence they could cross, and nothing else counts toward it. The Deep Survey and the Long Cut are rationing their consumables so hard that their own elders are refused: a Survey elder who asked for a lower Unearned Step for a promising second would be told no, in writing, with the standing stock cited. Not one of those three could fund a heavy loss rate on unproven mortals even if it wanted to.',
    itIsCircumstanceNotValues:
        'Nothing here is a difference of principle. Put the Deep Survey in the Pavilion\'s position - one benefactor, an income, ninety disciples and a stock it cannot spend - and the Survey would run the same programme inside a decade, with better records. Put the Pavilion on the Survey\'s footing and it would ration exactly as hard. The programme is a consequence of a sister, and it would end the year the sending stopped.',
    theOtherReason:
        'There is a second motive, it is patient, and it is the strongest link between this programme and the vault. The Pavilion holds seven lower Unearned Steps. Each one carries a cultivator standing at Nascent Soul Perfection across the boundary into Deity Transformation - which is worth seven of the most valuable acts available anywhere in the province, and is worth nothing at all unless there are seven people standing at ordinal 24. There are not. The Pavilion produces reliably at Core Formation, with six people at that height and about ninety disciples below it, so the constraint on the largest stock in the world is not medicine and never was. It is people. An intake taken young, taught properly and pushed hard is how a sect manufactures the specific candidates its own holdings require, and that is what the probation programme is actually for underneath everything else. The payoff is twenty to forty years out, everybody senior understands it, and it is written in no document.',
    theBottleneckIsPeople:
        'State it plainly, because it is the sentence that makes the whole position cohere: thin on members, rich on resources, holding objects that only work on members it does not have. Every other apex is rationing scarcity. The Azure Cloud Pavilion is waiting - for forty years, if that is what it takes - for anybody at all to arrive at the one rung where what it already owns becomes usable.',

    // ── the test ──────────────────────────────────────────────────────
    whatTheyTest: [
        'Root: grade, count and conflict, measured properly with instruments most sects cannot afford to keep.',
        'The physical and perceptual measures: what the body will take, how fast the senses settle, whether the qi in the room registers at all.',
        'Temperament under pressure, tested rather than interviewed, over days, by people who have done it a great many times.',
        'Whether the person can be taught, which is the measure the assessors weight most heavily and the one they trust least to a single sitting.'
    ],
    theTestIsRigorous:
        'This is not a formality and it is not kind. Candidates are held for eight to twelve days, measured continuously, and told nothing about how they are doing. The Pavilion runs it seriously because the whole programme depends on the selection being better than chance, and it takes the best it finds rather than the ones it likes.',
    whatTheyCannotTest:
        'And they cannot test for affinity, which is the honest part. Affinity is rolled at creation, is never shown, and is discoverable only by exposure - nothing warns anybody beforehand, and no instrument, root reading or interview reveals it. That is not a limitation of the Pavilion. Nobody in the world can see it, and the Pavilion is one of the very few institutions that knows this clearly enough to say so internally.',
    soTheAssessmentIs:
        'Good, insufficient, and known by them to be insufficient. They can tell you who has the root, the body, the nerve and the capacity to learn, and they cannot tell you which of those people will ever stand in a room where their own Dao is being practised. So the assessment narrows the field and does not decide the outcome, and everyone running it understands that.',
    soTheyBuyTimeInstead:
        'Which is why nobody is admitted. They are taken on probation, and the probation is the answer to the thing the test cannot reach: if affinity surfaces only on exposure, then buy exposure, apply it repeatedly for years, and watch. See `probation` below. It is the only instrument in the world that actually detects the thing, and the people who built it cannot say what it is that it detects.',
    theGambleIsThePoint:
        'Which makes the programme a wager rather than a recruitment pipeline, and the Pavilion accepts it in those terms. Most of what it takes will not come to much. It pays for that, absorbs it, and keeps going, because the occasional person who comes out of the far end justifies the entire century of expenditure - and because the Pavilion is the only institution in the world that can currently afford to be wrong this often.',
    theLossRate: {
        testedEachYear: 'Two to three thousand, across the Low Fall and four provinces beyond it.',
        takenOnProbationEachYear: 'Between nine and fourteen. The number is set by what the Pavilion can house, feed and walk through the round rather than by how many pass.',
        confirmedEachYear: 'Three or four. Everybody else is carried for years first and then sent home.',
        stillThereAtTwenty: 'Two, on average, counting the ones who were kept for reasons other than promise.',
        producedInACentury: 'Eleven people the Pavilion considers the programme to have produced. Two of them are Sword Elders.',
        howTheyRegardIt: 'A return of eleven in a hundred years would be a catastrophe for any other institution and is a bargain for this one, because the alternative use of the resource was a shelf.'
    },

    // ── probation ─────────────────────────────────────────────────────
    probation: {
        theModel:
            'Nobody is admitted. Everybody is taken on probation, for years, and the decision is deferred the entire time. The Pavilion presents this as prudence and it is prudence, but it is also the answer to the problem the entrance test cannot solve, and it is a better answer than anybody there can articulate.',
        whatItActuallyIs:
            'It is the affinity test, run empirically instead of measured. Affinity is invisible to every instrument, and surfaces only on exposure to the thing itself - and first exposure to a Dao somebody has strong affinity for is unmistakable to that person, while everybody else sees only that they went quiet. So a probationary period inside an apex sect is a person being walked past everything the institution practises, over and over, for years, while trained people watch for exactly that. The Pavilion has built the only working instrument in the world for detecting affinity, out of time and attention, and it cannot name what the instrument detects.',
        whatTheyThinkTheyAreTesting:
            'Their own account is about character. They will tell you probation measures whether the teaching takes, whether a person settles, whether they hold up over years rather than over days, and whether they can be around cultivators without either curdling or inflating - all of which is sensible, and all of which they could test in eighteen months. The document says four to seven years and gives no reason, and nobody has ever formally asked why the number is that.',
        whyThatExplanationIsWrong:
            'Because the thing they actually select on is not a virtue. Their assessors have a standing note, passed down and never justified, that the candidates who come to something are usually the ones who go quiet first - who stop in a yard they were only being walked through, who ask an out-of-order question about a practice that has nothing to do with their assignment, who are found the following week doing badly and repeatedly something nobody set them. The Pavilion reads that as unusual dedication and rewards it. It is not dedication. It is recognition, and they are the only institution in the world reliably catching it, for a reason they have written down incorrectly for a century.',
        theRound:
            'The mechanism, and it is deliberate breadth: a probationer is rotated past the sword yard, the formation floor, the pill rooms, the array works, the archive, the beast pens and the outer edge of the inner hall, in a cycle that repeats with variations for as long as they are held. The stated reason is that the sect does not want narrow servants. The working reason is that a probationer who has only ever been shown one thing has only ever been offered one chance, and the Pavilion learned that the hard way long enough ago that the lesson is now just the schedule.',
        stagedCommitment:
            'And this is the concrete affordability mechanism, which is the whole reason the programme exists at their resource level and not at anybody else. Probation is cheap: a bed, food, a share of a teacher who is teaching a room anyway, and time. Full admission is expensive: a sponsor who stakes their standing, a place on the disciple list every rival reads the week it changes, a share of the stock, and medicine that comes off a shelf that only ever goes down. So the sect commits nothing scarce until exposure has done its work, and it can be wrong nine times out of ten at the cheap stage. The Deep Survey and the Long Cut could not run even the cheap stage, because for them the bed and the teacher are the scarce things.',
        theLength:
            'Four to seven years, occasionally nine, and the length is not padding. Exposure needs repetition and chance, so the instrument only works if it runs long, which means the Pavilion is carrying a dozen people at any time it has not decided about and may never keep. That is a real and continuous cost, it is visible to every rival who counts the compound, and it is a large part of why this programme is unique to them rather than obvious to everybody.',
        notAllForPromise:
            'And not everybody who is kept is kept for promise. Some are retained because they turned out to be useful, some because they are liked, and one or two because somebody senior has a reason of their own that is nobody else\'s business. This is true, it is not written anywhere, and nobody involved would confirm it.',
        howDisciplesRegardThem:
            'Probationers are a class of their own: not disciples, not outsiders, not servants, and treated as none of the three. They eat separately, are not on any list, and hold a position that can end on a decision nobody is obliged to explain. The kinder disciples are patient with them in the way one is patient with a guest. The rest are not, and the reason is specific rather than snobbery: a probationer is somebody who might turn out to be better than you, and who got in without a family, a sponsor or twenty years of contribution. Some of it is ugly. There is a standing joke about how long the current intake will last, and there are inner disciples who make a point of learning no names until year four.',
        failingProbationIsTheWorseWound:
            'Failing the entrance test is being told you were not worth taking. Failing probation is worse by a long way, because you were inside. You lived there, you walked the round, you were taught things, you saw what the top of the world actually looks like from the floor of it - and then people who had watched you for five years decided, and you were walked back out through the gate you came in by. The entrance test tells somebody they were not measured highly. Probation tells them they were given the thing everybody in their province would trade a decade for, and it did not take.',
        theWashoutIsNotAMortal:
            'But a washout is not a villager who never left. They had years of real exposure inside an apex: they may have comprehended something, they certainly learned names, forms, practices and the shape of the place, and they understood at least one true thing about how cultivation actually works. A former Azure Cloud probationer in a market town knows more about the top of the world than anybody else within four counties, is worth far more as a source than their standing suggests, and will usually talk - which is the `asking.md` principle exactly: the useful person is often two rungs below the one who really knows, and is very much easier to get an hour with.'
    },

    // ── the door ──────────────────────────────────────────────────────
    theSecondDoor:
        'And it is a real door for the poor, which almost nothing in this world is. A child in a thin county with a good root and nothing else has no placement, no teacher, no readable manual and nobody outside the valley who knows the family name, and the only door that opens for them opens on nerve: go into a ruin, which does not check who your parents were. This is the second one. It opens on being found and measured, it requires no nerve and no money, and it is the single largest piece of good luck available to somebody born with nothing.',
    originTiers: ['thin_county', 'market_town'] as readonly string[],
    itIsRare:
        'It must stay rare to be worth anything. Nine to fourteen people a year out of five provinces means most people in a thin province have never met anyone it happened to, have never met anyone who was even tested, and know it as a thing that is said to happen somewhere else. A player who is approached should have no framework for what is being offered, and the villagers around them should not be able to supply one.',

    rejectionIsAWound:
        'Most of the people who are tested fail, and failing is not nothing. They were measured by an apex institution, at length, by people who do this for a living, and found wanting - which is a specific, permanent and public social fact, and it is a completely different thing from never having been looked at. A person who was never tested can believe anything about themselves. A person who was tested for eleven days and sent home cannot, and neither can the county they go back to.',
    whatRejectionProduces: [
        'The ones who never say it, and are described locally as having gone away for a season and come back quiet.',
        'The ones who say it constantly, and are the least believed people in the county precisely because the claim is unfalsifiable and enormous.',
        'The ones who go into a ruin the following spring, because the other door is still open and they now have a reason.',
        'The ones who hate the Pavilion with a specificity that lasts fifty years, and who will help anybody who is working against it.',
        'And the occasional one who was measured accurately and rejected correctly, and who then found their own Dao at forty by accident, which the Pavilion has no mechanism for hearing about.'
    ],
    itIsInTheWorldAlready:
        'Some of these people are alive right now and it shaped them. Treat a rejected candidate as an available piece of backstory for any adult from a thin province, and treat the Pavilion as genuinely not knowing what it produced: it keeps the register of who it took and has never once looked at the far larger register of who it did not.',

    // ── the scouts ────────────────────────────────────────────────────
    theScouts: {
        howMany: 'Six, standing, plus whoever a Sword Elder is currently borrowing.',
        whoTheyAre: 'Inner Disciples at Foundation Establishment or a little above, chosen for patience and an ordinary face rather than for strength. It is a posting of eight to twelve years and it is not considered a promotion.',
        theRoute: 'A fixed circuit of markets, festivals, hiring fairs, temple days and mine gates, walked on a schedule that repeats every fourteen months, so the same scout sees the same county at the same time of year and can tell what has changed in it.',
        theMethod: 'Watching, mostly. Then a conversation that is not about cultivation, then a small thing to carry, or lift, or listen for, that measures something without the subject knowing they were measured. A scout who has found somebody makes an offer with a date on it and does not explain what it is for.',
        theQuota: 'Two put forward a year, and a scout who puts forward nobody for three years is rotated out without prejudice. The quota is why a scout who has found nothing by autumn starts taking chances, and why the worst candidates in any given intake arrive in the last two months of the year.',
        theCover: 'They travel as buyers of ordinary things - hides, dye, seed stock, salvage - and the cover is real, because a buyer who never buys is remembered. Several of them are locally believed to be poor merchants with an odd habit of asking after other people\'s children.',
        whatItIsLikeToMeetOne:
            'A player should be able to meet one, be looked at, be asked three mild questions and be handed something to hold, and never learn what happened. The scene works best when nothing is explained and the offer, if it comes, comes months later through somebody else.'
    },

    // ── wide intake, narrow conversion ────────────────────────────────
    theFunnel:
        'And here is the thing the whole programme is most often misread as, so it is stated flatly: the bar at the narrow end has not moved. Becoming an actual disciple of the Azure Cloud Pavilion is exactly as hard as it has always been, and an Azure Cloud disciple is precisely as impressive as anybody the Hollow Court or the Deep Survey keeps. There is no discount anywhere in this. What is wide is the mouth of the funnel, not its throat.',
    notTheSoftApex:
        'So do not read them as the charitable apex, the easy apex or the kind one. They are the apex that can afford to look at everybody, which is an entirely different thing from admitting them, and the people they eventually keep have been through a longer and more searching filter than anybody at the other two. Washing out is the ordinary outcome. Being kept is the remarkable one, and the sect behaves accordingly.',

    // ── the name ──────────────────────────────────────────────────────
    theNameIsWithheld:
        'A probationer does not get to say they are of the Azure Cloud Pavilion. They are not a member; the claim is not theirs to make; and everybody inside the sect knows precisely where that line sits. This is the same fact as the paragraph above rather than a second rule: the name is withheld from unproven people exactly because the standard behind it is high, and letting probationers carry it would spend the one thing the Pavilion guards most carefully.',
    theBestNameYouCannotSpend:
        'Which puts a probationer in a much more interesting position than a member. Naming a sect is one of the levers that opens a door anywhere in the world, and this person is holding the best possible name and is forbidden to spend it. All of the exposure, none of the standing. They are seeing things almost nobody alive will ever see, and at a gate, in a market, in front of a magistrate, they are nobody.',
    noProtectionOutside:
        'And it is a real vulnerability rather than an embarrassment. A probationer on the road is an unaffiliated cultivator, whatever they are on the inside, with no sect behind the answer they give and no party who will come and ask about them. Travelling during probation is a materially different risk from travelling as a disciple, the sect does not pretend otherwise, and the ones who are sent out on errands know exactly what they are carrying and what they are not.',
    claimingItFalsely:
        'Claiming it anyway is a serious offence to the sect and a serious mistake socially, and it is detectable: an apex has few enough actual disciples that they are known, the list is published and read, and the wrong answer in the wrong room is far worse than no answer. It has been done. A probationer in his fifth year, two provinces out and cornered by a toll party at a river crossing, said the name to get across, and it worked - and it was repeated, in a report, to a Sword Elder inside the season. The Pavilion did not punish him with anything dramatic. It sent him home, in year five, with the decision on his probation left formally unmade, which is the most complete answer available to them and is understood by everybody who hears the story.',
    whatTheWashoutMaySay:
        'And it cleans up the washout, which is the part that lasts. They were never Azure Cloud, so they cannot say they were. The only true sentence available is that they were tested by the Pavilion - which is a boast and an admission of failure in the same breath, and how a person delivers that sentence tells you almost everything worth knowing about them.',
    theRank: {
        title: 'Probationer',
        sitsBelow: 'Sword Servant, which is rank index 0 and the lowest actual rank of the sect.',
        note: 'A probationer holds a place in the compound and no rung on the ladder. They are fed, taught and rotated, and they are not on the list.',
        notSplicedIntoTheRankArray:
            'Deliberately not inserted into `sect.ranks` for the Pavilion. Those indices are a contract: `members.ts` pins every member to a `rankIndex`, the stipend array is parallel to them, and `rankRealmBand` derives its bands from position in that array. Adding a rung at the bottom would silently move every Azure Cloud member down one and change every band. So the probationary standing is expressed here and in `SECT_ADMISSION.probationOrdinal`, and it wants lifting into the schema as a proper rank below index 0 by whoever owns that.'
    },

    // ── the anomaly ───────────────────────────────────────────────────
    theAnomaly:
        'Read as a table, the Pavilion is the strangest row in the world: power ordinal 41, and a door that opens at the very bottom of the ladder. The Hollow Court will not look below 29. The other high sects sit at 13, 21 and 29. Nothing else in the catalog combines that much power with that low a door, and the anomaly is the single most legible expression of everything else about them - thin on members, rich on resources, and gambling because they are the only ones who can afford the losses.',
    whoWouldNoticeIt:
        'Almost nobody, because almost nobody reads the world as a table. A farmer knows the Pavilion tests people. A well-informed cultivator who has dealt with two or three apexes would see it immediately and find it strange, and is exactly the sort of person who would remark on it over a drink and expect you to already understand why it matters.',
    theSameNumberForOppositeReasons:
        'And the one other body in the catalog whose door sits at the bottom is the Hollow Bell Wanderers, whose entire ceremony is showing up and ringing the bell. Same number, opposite reasons. The Wanderers take anybody because they are a loose league with nothing to protect and no capacity to assess. The Pavilion takes anybody in because it can afford to test them for years and send most of them home. A number is not a policy, and these two are the proof.',

    // ── handoff ───────────────────────────────────────────────────────
    engineHandoff:
        'This is the content-side statement of a placement channel that does not exist in the engine yet. `thin_county` and `market_town` both carry `placement.reach: 0` in `src/engine/cultivation/origin.ts`, which is correct for every other route and wrong for this one: the Pavilion reaches into exactly those two tiers, on its own initiative, at no cost to the candidate. Wiring it needs a reach that is granted by an institution rather than owned by the origin, a low probability, an age band, and entry below the lowest rank rather than at it. No engine file is edited here.',
    engineGaps: [
        'PROBATIONARY RANK. A probationer carries the sect id and is not a member. Anything that gates social effect on membership must test the rank rather than the presence of a `sectId`, and if the engine currently reads "has a sectId" as "may claim the sect", this rule is what turns that into a live bug. The name claim, gate access, sect-backed reputation and any protection a faction extends to its own all need to check the rank.',
        'PROBATION FLOOR. `admissionOrdinal` is a single number and `rankRealmBand` in `members.ts` derives every band from it, so it cannot express a door at 0 and a disciple bar at 3 at the same time. Held here as `SECT_ADMISSION.probationOrdinal` on the content side; lifting it into the schema as a second floor is the clean fix, and until then `admissionOrdinal` must stay at the membership bar or the whole ladder slides down.',
        'PLACEMENT BY INSTITUTION. Reach that belongs to the reaching party rather than to the origin tier, which is the general shape of this and would also serve any other body that goes looking.'
    ]
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT A BODY CALLS ITS LEADER
//
// "Seat" is the Hollow Court's own vocabulary and belongs to it alone. Every
// other body names its leader after the thing it is standing on, which is the
// ordinary convention in both provinces: a lordship is over a place or an
// object, never over people, and the title outlives whoever holds it.
//
// Derived rather than typed, so a title cannot drift from the body it belongs
// to. An apex is named for what its founder sent down - the Lamp Lord sits on
// the Datum Lamp - and a court for the word that distinguishes it from the
// other courts. The second is a wardenship rather than a lordship, because the
// second does not hold the object.
//
// These are offices. The province can say the Lamp Lord refused a petition
// without anybody knowing who that is, which is how the two hidden apexes
// prefer it.
// ─────────────────────────────────────────────────────────────────────────

/** Last significant word, with a leading article dropped. */
function lastWord(name: string): string {
    const parts = name.replace(/^The\s+/i, '').trim().split(/\s+/);
    return parts[parts.length - 1];
}

/** First significant word, which is what distinguishes one court from another. */
function firstWord(name: string): string {
    return name.replace(/^The\s+/i, '').trim().split(/\s+/)[0];
}

/** What an apex calls the one in the seat: named for the object they sit on. */
export function leaderTitleOf(apex: ApexInstitution): string {
    return `the ${lastWord(apex.sentDown.name)} Lord`;
}

/**
 * And the one below them, who does not hold the object.
 *
 * Grand Elder rather than a lesser lordship: a lordship here is over the thing
 * the body stands on, and the second stands on nothing. Warden was the obvious
 * alternative and is taken - three factions in the catalog are Wardens of
 * something, and one of them guards the world-heart.
 */
export function secondTitleOf(apex: ApexInstitution): string {
    return `the ${lastWord(apex.name)} Grand Elder`;
}

/** A court is distinguished from its siblings by its first word, not its last. */
export function leaderTitleOfCourt(court: Court): string {
    return court.leaderTitle ?? `the ${firstWord(court.name)} Lord`;
}

export function getApexInstitution(id: string): ApexInstitution | undefined {
    return APEX_BY_ID.get(id);
}

export function getCourt(id: string): Court | undefined {
    return COURT_BY_ID.get(id);
}

/** Everybody standing in an office at this court, strongest first. */
export function courtOfficers(courtId: string): CourtOfficer[] {
    const court = COURT_BY_ID.get(courtId);
    if (!court) return [];
    return [...court.roster].sort((a, b) => b.realmOrdinal - a.realmOrdinal);
}

/**
 * The officer a court's `powerOrdinal` is actually referring to.
 *
 * The number is defined as the strongest member who will answer, so it is a
 * person rather than a rating, and this is the way to reach them.
 */
export function strongestOfficerOf(court: Court): CourtOfficer {
    return court.roster.reduce((best, o) => (o.realmOrdinal > best.realmOrdinal ? o : best));
}

/** One officer, by id, from any court. */
export function getCourtOfficer(officerId: string): CourtOfficer | undefined {
    for (const court of COURTS) {
        const found = court.roster.find(o => o.id === officerId);
        if (found) return found;
    }
    return undefined;
}

export function getParentage(factionId: string): Parentage | undefined {
    return FACTION_PARENTAGE[factionId];
}

/**
 * Everything holding directly from this faction, court or apex.
 *
 * A COUNT TAKEN THROUGH HERE IS NOT A ROSTER, and this is the one warning the
 * function needs. Walking down from an apex and totalling what turns up crosses
 * three catalogs that count three different kinds of thing: the apex's own posted
 * staff, the officers it has posted into courts, and the clients underneath it,
 * whose ceilings include sealed ancestors that are single-use and are not
 * members of anything. A figure summed across those reads as a headcount, is
 * reported as one, and then surprises the person who wrote it - the Long Cut
 * has forty posted staff and exactly one person above ordinal 41, and any
 * larger number said about it is a mobilisation rather than a roll.
 *
 * So say which was summed wherever such a figure is quoted. `powerOrdinal` is
 * the strongest single body that will answer and is the only figure here that
 * needs no qualification; everything else assembled from this function is a
 * sum, and a sum that does not name its parts is the whole of the confusion.
 */
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

/**
 * Every id one house answers to.
 *
 * Callers holding a faction id should not have to know whether it came from
 * `SECTS` or `APEX_INSTITUTIONS`. The Azure Cloud Pavilion is one house with a
 * row in each; anything keyed by faction - artifacts, members, grants - can be
 * filed under either and found through here.
 */
export function idsForFaction(id: string): string[] {
    const apex = APEX_INSTITUTIONS.find(a => a.id === id || a.factionId === id);
    if (apex) return apex.factionId === null ? [apex.id] : [apex.id, apex.factionId];

    // A court can be the same body as a sect too, and for the same reason: the
    // Kiln and the Azure Mist are institutions with a row in each catalog. This
    // case was missing, so anything that drew the pyramid from both tables drew
    // those houses twice, at two different ordinals, as though they were
    // neighbours rather than one another.
    const court = COURTS.find(c => c.id === id || c.embodiedByFactionId === id);
    if (court) {
        return court.embodiedByFactionId === null
            ? [court.id]
            : [court.id, court.embodiedByFactionId];
    }

    return [id];
}

/**
 * The Kiln schism: one house, two names, two patrons, and no instrument that
 * can settle which is which.
 *
 * The oldest arrangement in the region was that the court on the datum had two
 * names and one body. The Deep Survey posted it and called it the Root Sill;
 * the province had been calling those people the Kiln Wardens for longer than
 * the Survey had existed and went on doing so; and for nine hundred years the
 * duplication cost nothing, because a Keeper of the Kiln was a Sill-Sworn of
 * the Deep Survey and both sentences described the same person.
 *
 * The Survey reposted the court. Most of the Wardens declined the reposting.
 * Each half kept one of the names, and the one that walked was taken in by the
 * Long Cut - which is now holding two of the Deep Survey's former
 * administrations, and has arranged, without saying anything, for them to be
 * standing opposite each other.
 */
export const THE_KILN_SCHISM = {
    whoIsWhere:
        'The Kiln Court holds the datum, the nine hundred formation nodes and the perimeter, under the Deep Survey, keeping the older of the two names. The Root Sill Court is four provinces away under the Long Cut, keeping the Survey\'s own administrative name for a posting it no longer holds - which everybody involved understands as the sharper of the two choices, and nobody has ever said so aloud.',
    andBothClaimTheLineage:
        'Each says it is the house. The Kiln Court has the ground, the datum and the work, and can point out that the Kiln was never anything but where those things are. The Root Sill Court has the roll, most of the people, the founding posting order naming the first four Wardens, and the sealed ancestor - and can point out that a house is who is in it. Neither argument is weak, both are nine hundred years old, and there is no instrument anywhere that decides it.',
    andItIsNowTheKilnAgainstTheThirdSill:
        'Which makes the live quarrel not Survey against Long Cut but court against court. The Third Sill was the first administration to leave the Deep Survey for the Long Cut, and it is the body the Root Sill now sits beside and is measured against - two defectors under one patron, one of whom left over a grant book and one of whom left over a name, each privately of the view that the other\'s reason was the lesser one. They are the two halves of the Long Cut\'s answer to the Survey and they do not like each other.',
    andTheSealIsTheReasonItMatters:
        'Nobody would treat a naming dispute as a regional question. What is asleep under the kiln is the strongest sealed thing in the world at forty-four, and it has not moved, because it never does - the argument is about whose it is. The Long Cut has acquired a claim on the best single weapon in the region by taking in some disaffected administrators, and did not have to say a word to do it.',
    whatTheSurveyDidAboutIt:
        'Nothing in public, which is consistent with everything else it does. It lists the Kiln Court as its court on the datum, receives one figure a year from Ji Wanluo, and has never referred to the Root Sill Court in correspondence - a body wearing a name the Survey invented. It has lost two administrations to the Long Cut in living memory and acknowledged neither, and there is a reading of that as composure and a reading of it as having no answer.',
    howToRunIt:
        'Both entries are real and both are in the catalog. A player who deals with either should be able to deal with the other, get a different account of the same nine hundred years, and find that nothing in the world can tell them which one is the house. That is not a plot waiting to resolve. It is the answer.'
} as const;
