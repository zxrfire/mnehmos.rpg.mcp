/**
 * The Standing Register: every faction in the world, on the one ladder.
 *
 * This is a VIEW, and the distinction matters more here than usual. Nothing in
 * this file authors anything - it reads the catalogs and arranges them, so
 * regenerating the sheet is a function call rather than an editing session, and
 * it cannot drift from what the engine actually believes. If a figure here looks
 * wrong, the catalog is wrong.
 *
 * Two consumers, one build:
 *
 *   GET /api/admin/register        the structure, as JSON, for tooling
 *   GET /api/admin/register.html   the same structure rendered, for reading
 *   npm run register               writes the rendered sheet to a file
 *
 * ADMIN ONLY, for the ordinary reason rather than a security one: the sheet
 * states plainly what the world spends enormous effort keeping unstated. It
 * names the two apexes a starting cultivator is `unaware` of, prints which
 * sealed ancestors are not publicly known, and lists a wanderer whose entire
 * design is that nobody knows he exists. Handing it to a player is handing them
 * the answer key.
 */

import {
    SECTS,
    SECT_ADMISSION,
    SECT_ANCESTRY,
    WITHDRAWN_POWERS,
    auditAncestralClaim,
    canProjectLastRealm,
    contestedClaimsOf,
    getDaoHouse,
    getSect,
    intakeRouteOf,
    sectThreat,
    type IntakeRoute
} from '../data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    leaderTitleOf,
    secondTitleOf,
    strongestOfficerOf,
    idsForFaction,
    COURTS,
    FACTION_PARENTAGE,
    getApexInstitution,
    getCourt,
    getParentage,
    type Posting
} from '../data/cultivation/hierarchy.js';
import { ARTIFACTS, artifactsOwnedBy } from '../data/cultivation/artifacts.js';
import { IMMORTAL_CHANNELS, LINEAGE_STANDINGS } from '../data/cultivation/crossings.js';
import { IMMORTAL_ITEMS, IMMORTAL_HOLDINGS } from '../data/cultivation/immortal-items.js';
// Built and rendered in its own module, so adding the section to the sheet is
// one call rather than an edit inside this file. See its header.
import {
    buildRepairMedicineRegister,
    renderRepairMedicineSection,
    renderRepairMedicineHolders,
    type RegisterRepairMedicine
} from './register-structural-repair-medicine.js';
// Two more sections in their own modules, for the same reason. The kinds
// section answers what KINDS of thing the world tracks - the almanac, on the
// Objects tab - and the holdings pane answers what is actually inside each
// house, read across seven catalogs that have never been joined.
import {
    buildItemsRegister,
    renderItemsSection,
    type RegisterItems
} from './register-items.js';
import {
    buildHoldings,
    holdingsByHouse,
    holdingsFacts,
    renderHoldingsSection,
    type RegisterHoldings
} from './register-what-each-house-holds.js';
import { WANDERERS } from '../data/cultivation/wanderers.js';
import { MEMBERS } from '../data/cultivation/members.js';
import { rollOf } from '../data/cultivation/faction-roll.js';
import {
    HOW_THE_COURT_IS_SEEN,
    getHollowCourtMember
} from '../data/cultivation/hollow-court-roster.js';
import { HERBS } from '../data/cultivation/herbs.js';
import { ARTERIALS, PROVINCES } from '../data/cultivation/regions.js';
import { getFactionCharacter } from '../data/cultivation/faction-character.js';
import {
    SHARED_EVENTS,
    historyOf,
    otherPartiesTo,
    sharedEventsFor,
    type SharedEvent
} from '../data/cultivation/faction-history.js';
import { demonicStandingOf } from '../data/cultivation/demonic-sects-and-what-they-are-willing-to-do.js';
import {
    A_NEWBORN_WITH_POTENTIAL,
    THE_APEXES_THAT_TRADE,
    favourStanceOf,
    willNotBeMoved
} from '../data/cultivation/a-favour-skips-the-admission-bar.js';
import {
    NO_PLACE_FOR_THEIR_OWN,
    THE_MEMENTO_AND_THE_SEARCH,
    WASHING_OUT,
    noPlaceForTheirOwn
} from '../data/cultivation/bodies-that-cannot-keep-their-members-children.js';
import {
    TECHNIQUES,
    GRADE_ORDER,
    carriesTo,
    classOf,
    getTechnique,
    gradeRank,
    opacityOf,
    teachableEndOf,
    transmissionModeOf
} from '../data/cultivation/techniques.js';
import {
    ANCIENT_ARTS,
    ARCHIVE_COPIES,
    LOST_MATERIALS,
    MEDICINE_HOLDINGS
} from '../data/cultivation/lost-ages.js';
import type { TechniqueGrade } from '../schema/cultivation.js';
import { glossaryGroups } from './register-glossary.js';
import {
    REALM_TIERS,
    MAX_ORDINAL,
    TOTAL_RANKS,
    FALSE_IMMORTAL_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    OBJECT_CEILING_BELOW_THE_LID,
    MANUALS_MAY_EXCEED_THE_LID,
    WHAT_AN_ART_BUYS,
    rankName,
    realmForOrdinal
} from '../engine/cultivation/realms.js';
import {
    relationshipsOf,
    type Warmth,
    type ResolvedRelationship
} from '../data/cultivation/faction-relationships.js';
import {
    contentionBetween,
    contendersWith,
    type Contention
} from '../data/cultivation/what-two-houses-both-have-a-hand-on.js';
import {
    deepRoadOf,
    whoHoldsDeepRoad,
    type DeepRoadHolding
} from '../data/cultivation/roads-to-the-top-of-the-ladder.js';

/**
 * The band this page is about, and the two rungs above it.
 *
 * Grand Ascension is where the register starts naming people; Tribulation
 * Transcendence is the approach to the Lid; Immortal is the pair of rungs the
 * crossing lands on. All three are read out of REALM_TIERS rather than written
 * down, because the ladder has been re-cut before and the numbers in this file
 * must not be a second, quieter copy of it.
 */
const GRAND_ASCENSION = REALM_TIERS.find(t => t.key === 'grand_ascension')!;
const TRIBULATION = REALM_TIERS.find(t => t.key === 'tribulation_transcendence')!;

/** Inside Grand Ascension itself, rather than merely at or above its floor. */
const inGrandAscension = (ordinal: number): boolean =>
    ordinal >= GRAND_ASCENSION.ordinalStart && ordinal <= GRAND_ASCENSION.ordinalEnd;

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export interface RegisterRow {
    id: string;
    name: string;
    /** Strongest ACTING member. Never the sealed ceiling. */
    ordinal: number;
    rank: string;
    realm: string;
    alignment: string;
    admissionOrdinal: number;
    recruits: boolean;
    governance: string;
    standing: string;
    parentId: string | null;
    /** Set only where something sealed raises what the faction could field once. */
    sealedCeiling: number | null;
    isDaoHouse: boolean;
}

export interface RegisterApex {
    id: string;
    name: string;
    ordinal: number;
    secondStrongestOrdinal: number;
    heritage: string;
    stock: string;
    startingAwareness: string;
    giftName: string;
    instability: string;
    courts: { id: string; name: string; ordinal: number }[];
}

export interface RegisterSealed {
    hostId: string;
    hostName: string;
    hostOrdinal: number;
    name: string;
    ordinal: number;
    sealGrade: string;
    sealReason: string;
    publiclyKnown: boolean;
    dormantYears: number;
    wakeCondition: string;
    /** Where they are, in one concrete line. */
    restingPlace: string;
    /**
     * The three or four things that make a sealed ancestor an asset rather than
     * a second problem, where the house can answer them.
     *
     * Most cannot: the seal is older than the roster, or the reason was
     * desperation, or the person went under angry. A protector whose loyalty is
     * a question is not reinforcement. These are printed where present and left
     * out where they are not, because the absence is itself the reading - the
     * register must not supply an answer the house has not got.
     */
    whoTheyAre: string | null;
    sealedBefore: string | null;
    knowsWhatFor: string | null;
    resourcesWent: string | null;
}

/**
 * One object out of the artifact catalog, with its two holders resolved.
 *
 * Ownership and possession are separate on `ObjectRecord` and the register does
 * not collapse them, because on this catalog the difference is the entire
 * story: three of the four strongest objects in the world sit in a vault their
 * owner also is, and the other four are on people. A single "held by" column
 * would render both as the same fact.
 */
export interface RegisterArtifact {
    id: string;
    name: string;
    /** Always present on this catalog; the field is nullable on the record. */
    power: number;
    significance: string;
    ownerId: string | null;
    ownerName: string;
    /**
     * The dossier this object's owner opens, or null where the owner is not a
     * faction this register holds an entry for. Null on an unowned object is
     * ordinary; null on an owned one means the id does not resolve, and the
     * sheet says so rather than quietly dropping the row from a faction.
     */
    ownerLinkId: string | null;
    possessorId: string | null;
    /** The possessor as a reader would name them, or '' where nobody holds it. */
    possessorName: string;
    /**
     * Where the possessor is the owning institution rather than a person.
     *
     * Not a category of object. It is the same column read twice: an owner
     * holding its own property is a vault, and anything else is somebody
     * carrying it around.
     */
    inVault: boolean;
    /** The rung the possessor stands on, where the catalogs record one. */
    possessorOrdinal: number | null;
    tags: string[];
    description: string;
}

/**
 * Where making stops, read off the catalog rather than written down.
 *
 * The one structural line in the artifact table is not a numeric gap - the band
 * beneath the top has been filled in and there is no longer a wide step
 * anywhere. It is a boundary of provenance: nothing a forge below the Lid has
 * finished passes a certain rung, and everything above that rung was sent down
 * by somebody who crossed. That is a fact about the tags, so it is derived from
 * them and stated only where they actually partition the table - if a forged
 * object ever outranks a sent-down one, the sheet stops drawing the line rather
 * than drawing it in the wrong place.
 */
export interface RegisterArtifactCeiling {
    /** The strongest thing anybody below the Lid has made. */
    madeHere: number;
    /** The weakest thing that came down, which is above it. */
    weakestSentDown: number;
    /** Index in the artifact list of the first row at or below the ceiling. */
    breakAt: number;
}

/**
 * One person standing in one court office.
 *
 * Two standings, and the second is the point. `ordinal` is the ladder everybody
 * in the world is on; `apexRank` is where the same person stands inside the
 * institution that posted them, and the two columns routinely disagree.
 */
export interface RegisterCourtOfficer {
    id: string;
    name: string;
    title: string;
    office: string;
    ordinal: number;
    rank: string;
    apexRank: string;
    wants: string;
    fears: string;
    detail: string;
    /** Whether this is the officer the court's own ordinal is naming. */
    answersForTheCourt: boolean;
}

/**
 * One claimant's side of a contested lineage, as headings and text.
 *
 * Headings are derived from the catalog record's own keys rather than written
 * here, so a field added to the catalog turns up on the page instead of being
 * silently lost - which is exactly how the record this replaces reached no page
 * at all for as long as it existed. `against` is resolved to the other
 * claimant's name and, where it has an entry on this sheet, its anchor.
 */
/**
 * How a faction came to be where it is, and what that explains.
 *
 * First on the entry, and the placement is the argument: everything below it is
 * a consequence of it, and each layer under it is checkable against this one. A
 * house whose history claims one thing and whose roster shows another is either
 * declining or lying, and both are worth a reader's attention - but only if the
 * history was read first.
 *
 * Every field is quoted from `faction-history.ts` and none is assembled here.
 * The dates live on the shared events, once each, and the register does not
 * restate them in any sentence of its own.
 */
export interface RegisterHistory {
    origin: string;
    /** Why its pipeline sits where it does against its own strongest member. */
    whyTheGapIs: string;
    /** Null where the house holds no dark nodes, which is the honest case. */
    whatTheUnlitNodesWere: string | null;
    /** Where `wrongAbout` traces back to, which is a piece of history by definition. */
    whereTheWrongBeliefComesFrom: string;
    /** Events with other bodies: dated once, and each party's own telling. */
    shared: {
        id: string;
        yearsAgo: number;
        what: string;
        explains: string;
        /** This faction's own account. Partisan, and not reconciled with the others. */
        ourAccount: string;
        /** Everybody else who was there, with a way to go and read their version. */
        others: { id: string; name: string; anchor: string | null }[];
    }[];
}

/**
 * What a demonic faction is actually willing to do, and on what leash.
 *
 * Null on everything not filed demonic. `demonic` is an alignment field and a
 * field is not an identity, so this is the answer to the question the field
 * stands in for - and it is here rather than assembled, because the six answers
 * have to differ from each other and a view cannot enforce that.
 */
export interface RegisterDemonic {
    kind: string;
    theLineItCrosses: string;
    whoPays: string;
    didTheyAgree: string;
    whatItKeepsLocal: string;
    standingOnTheContract: string;
    ifItWereDestroyed: string;
}

/**
 * WHAT USED TO BE HERE: `RegisterLineageDispute`, and the block that drew it.
 *
 * Two bodies each carried a partisan account arguing that it was the real
 * house, and the sheet printed both under a "Contested lineage" heading with a
 * line saying nothing in the world settles it. The catalog no longer carries
 * either account: what happened was a schism, and the two have run
 * independently since - two rolls, two patrons, two provinces, no
 * correspondence. That is a relationship rather than a claim, and it is now one
 * row in the relationships section at the foot of both entries, with a side
 * apiece and a different word for how each of them feels about it.
 */

/**
 * How a body nobody can join comes to have anybody in it.
 *
 * On two entries. Read it beside an ordinary house's admission ordinal and the
 * difference is the whole point: every other institution in the world states a
 * bar and waits, and these two state nothing, because there is no application
 * to make. The decision is taken by somebody else, about you, elsewhere.
 */
export interface RegisterPosting {
    appointedBy: string;
    whatItIsWorthFromBelow: string;
    whatItIsWorthFromAbove: string;
    andAfterwards: string;
    andBeingPassedOver: string;
    andWhatTheTermIsWorthAfterwards: string;
}

/**
 * Why a body has no place for its own members' children.
 *
 * On three entries. Two of them have no intake at all - people arrive by
 * appointment to a posting and a child cannot be appointed - and one has a bar
 * nothing else in the world applies. Same situation, opposite causes, and
 * different stories downstream: the postings are public appointments so the
 * child knows exactly who their parent is, and the Court's discretion is
 * absolute so the child never learns a name.
 */
/**
 * Whether a word from somebody high enough gets somebody in here.
 *
 * `answer` is the headline and the rest is why. `andWhetherItsOwnWordMoves`
 * is the other direction and frequently the other answer - a house that cannot
 * be moved may still be able to move somebody else, and the one house that
 * could move almost anybody has never once tried.
 */
/**
 * What somebody in the province would actually say if you asked who these are.
 *
 * NOT a summary of the entry and not the catalog's `description`, which is
 * excellent and is four hundred words about what is INTERESTING about a house.
 * This is what it IS, in the order a stranger would say it, and it is assembled
 * from the fields that carry the outside view rather than the true one:
 * `knownAs` is by definition what the province thinks, and the gap between it
 * and `actuallyGoodAt` is the whole reason the register carries both.
 *
 * ON A DAO HOUSE IT LEADS WITH THE DAO, because that is the first thing anybody
 * would mention and the thing the house is FOR. A dao house entry that opened
 * on its territory was answering a question nobody asks: these are bodies with
 * no territory, whose whole identity is one principle applied for nineteen
 * centuries.
 */
export interface RegisterPasserby {
    /** One or two sentences. The answer to "who are they?" and nothing else. */
    line: string;
    /**
     * The dao, on a dao house. Null on everything else.
     *
     * Carried separately as well as being in the line, because it is the one
     * fact about these houses that a reader scanning for it should not have to
     * read a sentence to find.
     */
    dao: string | null;
}

export interface RegisterFavour {
    answer: string;
    why: string;
    andWhatItTakes: string | null;
    andWhetherItsOwnWordMoves: string | null;
    /** Apex only: the same question asked of a body nobody joins. */
    apexStance: string | null;
}

export interface RegisterNoPlace {
    reason: string;
    whyItCannotKeepThem: string;
    whereTheChildGoes: string;
    whatTheChildKnows: string;
    andWhetherItIsPermanent: string;
    whatItCostsTheParent: string;
}

export interface RegisterCourt {
    id: string;
    name: string;
    apexId: string;
    apexName: string;
    ordinal: number;
    administers: string;
    /**
     * The same section a faction entry ends on, on the two courts that have no
     * faction row of their own.
     *
     * Without it the Kiln Court - one of the two claimants to the largest
     * unresolved question in the region - was the one body in the world whose
     * side of that argument had no relations printed anywhere, because it is a
     * court with no sect row and the section lives on the sect entry.
     */
    relationships: RegisterRelationship[];
    /**
     * Three or four sentences that say what this court is. See
     * {@link buildCourtSynopsis}.
     *
     * A court panel used to open on `administers`, which for a body whose whole
     * job is administering something is a definition rather than an
     * introduction: it told a reader who did not know the setting nothing, and a
     * reader who did nothing new.
     */
    synopsis: string[];
    /** The court in its own words, which is a different account from the sect's. */
    description: string;
    officesNote: string;
    /** The vein system it apportions grants across, by region. */
    grantsInRegionId: string;
    /**
     * The sect catalog's row for this same body, where there is one.
     *
     * Two of the four courts are also factions - the Kiln and the Azure Mist -
     * and this is the field that says so. Anything drawing the pyramid has to
     * read it or it draws those houses twice, at two different ordinals, as
     * though they were neighbours rather than one another.
     */
    embodiedByFactionId: string | null;
    /**
     * Whether a starting cultivator may be told this court's name.
     *
     * A court is exactly as nameable as the apex above it, which is a rule
     * rather than a quirk: the two ancient apexes are hidden and their courts
     * inherit that, and the Pavilion has a front gate so its court has one too.
     * Both ends are carried so the sheet can show the rule holding rather than
     * asserting it.
     */
    startingAwareness: string;
    apexAwareness: string;
    /**
     * The one who got furthest, and how it ended. Null is the ordinary case.
     *
     * This is the difference between a court and an apex stated as a fact
     * rather than as a rank: an apex has somebody at the last realm sitting on
     * what a founder sent down, and a court had one and no longer does.
     */
    highWaterMark: {
        name: string;
        ordinal: number;
        rank: string;
        yearsAgo: number;
        end: string;
        note: string;
    } | null;
    /**
     * How this court came to answer where it does, on the two that moved.
     *
     * Null where a court has always answered where it answers. The register
     * does NOT classify what kind of move it was: one of the two was a transfer
     * between patrons and the other a promotion inside one, the note says which
     * in its own first sentence, and a heading that picked one word for both
     * printed the wrong one on the Azure Mist for as long as it existed.
     */
    transferNote: string | null;
    /**
     * This court's own account of a lineage another body also claims.
     *
     * Null on three of the four. Where it is set it is partisan and is meant to
     * be: the catalog holds no joint version, because the two claimants are two
     * bodies four provinces apart under different patrons rather than one body
     * with an argument in it. The sheet quotes it whole and never summarises
     * it - every field is an argument one side makes, and paraphrasing an
     * argument is how a register starts adjudicating.
     */
    /**
     * How a body that takes nobody comes to have anybody in it. Null on most.
     *
     * EVERY OTHER COURT ON THIS SHEET IS A SECT - members, an intake, a ladder,
     * a seat, a sub-sect or tributary sect of something larger - and "court"
     * describes what it administers rather than what kind of institution it is.
     * Two bodies are not: they are organisations with postings, they take
     * nobody at all, and somebody stands there because they were appointed.
     * Which is also the only reason the reposting at the centre of the largest
     * unresolved question in the region was a thing anybody could do - you can
     * repost a posting, and you cannot repost a sect.
     */
    posting: RegisterPosting | null;
    /** Why it has no place for a member's child. Null on all but one court. */
    noPlaceForItsOwn: RegisterNoPlace | null;
    /**
     * Catalog order, deliberately unsorted.
     *
     * Sorting these by ordinal would draw a ladder the offices do not form: the
     * Sill Courier stands a mark above the Assessor inside the Survey and eight
     * rungs below him on the ladder, and neither office contains the other. The
     * strongest is flagged instead, which is the only ordering fact that is
     * true.
     */
    officers: RegisterCourtOfficer[];
}

// ─────────────────────────────────────────────────────────────────────────
// ARTS
//
// The link a reader actually wants and the one the sheet had nowhere: which
// house teaches a given art, and what a given house teaches. Neither direction
// is stored - `SECTS[].teaches` holds technique ids and `TECHNIQUES` holds no
// faction at all - so both are derived here, at build time, from that one
// field plus `signatureTechniqueId`.
//
// Derived rather than cached on purpose. The teach lists are actively moving
// as orphaned arts are given teachers, and a second copy of this relation
// living anywhere would be wrong within the week.
// ─────────────────────────────────────────────────────────────────────────

/** One art, with every house that hands it over. */
export interface RegisterTechnique {
    id: string;
    name: string;
    grade: TechniqueGrade;
    category: string;
    /** Null on an elementless art, which is a real and common state. */
    element: string | null;
    /** The rung the art is written for, which a holder may be under. */
    requiredOrdinal: number;
    rank: string;
    /**
     * Where a copy comes from: taught by somebody, or read off a page found in
     * a ruin or a grave. It decides which transmission channel is available.
     */
    provenance: string;
    /** 'shown' or 'read', resolved from provenance. */
    transmission: string;
    /** How much of the art fails to survive being written down, 0..1. */
    opacity: number;
    /**
     * How many people one use lands on: single, several, or a whole place.
     *
     * A property of the art and never of the holder, and absent in the catalog
     * means `single` - so it is resolved to a word here rather than left blank,
     * because a blank column reads as unknown and this one is never unknown.
     */
    reach: string;
    /** False where no copy exists anywhere in the world. */
    survivingCopy: boolean;
    /**
     * Which age wrote it, and a SECOND AND INDEPENDENT AXIS from `class`.
     *
     * Rendered as a SPLIT rather than a label, because "ancient cultivation"
     * and "ancient dao" are different things and putting them in one row
     * invites a reader to average them. `class` splits an art by what it is
     * for; `era` splits it by what kind of thing it does at all, and all four
     * quadrants are real and occupied.
     */
    era: string;
    /** 'cultivation' or 'dao'. The other axis of the same split. */
    artClass: string;
    /**
     * Where the world's supply of the material stops, on mastery's [0,1].
     *
     * Null on everything modern and on most ancient arts. NOT A LIMIT THE
     * ENGINE ENFORCES - see the section note - so it is rendered as a belief
     * the catalog records rather than as a bar.
     */
    worldSupplyCeiling: number | null;
    description: string;
    /** Every faction that will teach it, strongest first. */
    taughtBy: { id: string; name: string; ordinal: number; signature: boolean }[];
    /**
     * The body that holds it where no teach list can say so. Four arts.
     *
     * A road to the top of the ladder held by an apex with no sect row is not
     * an art nobody can obtain - it is one that is lent, on terms, by a named
     * body. `taughtBy` stays exactly the sect catalog's teach lists; this is
     * the other relation, and the copy count and teacher count are on it
     * because those are what a shelf entry would have got wrong.
     */
    heldBy: { id: string; name: string; ordinal: number; copies: number; teachers: number } | null;
}

/** One house, and the library it will actually open. */
export interface RegisterTeaching {
    id: string;
    name: string;
    ordinal: number;
    /** The art it is known for, where it has one. */
    signature: { id: string; name: string; grade: TechniqueGrade } | null;
    /** Everything on the teach list, strongest grade first. */
    arts: { id: string; name: string; grade: TechniqueGrade; requiredOrdinal: number }[];
    /**
     * Ids on the teach list with no row in `TECHNIQUES`.
     *
     * Empty, and it has to stay empty: a teach list that names an art the
     * catalog does not have is a house promising something nobody can learn.
     */
    unknownArtIds: string[];
}

/**
 * A house's library, resolved, for the entry rather than for the arts sheet.
 *
 * Built from the SAME technique map the Arts tab is built from and handed down
 * to the dossiers, rather than looked up a second time. `SECTS[].teaches` holds
 * ids and nothing else, so every readable fact about a curriculum - what the
 * arts are called, what grade they are, how many people one lands on - lives on
 * the technique row. Two lookups would be two answers within the week.
 *
 * This is the first thing an entry should say after what kind of body it is. A
 * dossier that gives a rung and a landlord and never says the house teaches five
 * ice arts and will not admit anybody without a mutated ice root has described
 * an address rather than an institution.
 */
export interface RegisterCurriculum {
    /** Everything on the teach list, strongest grade first. */
    arts: {
        id: string;
        name: string;
        grade: TechniqueGrade;
        category: string;
        element: string | null;
        reach: string;
        requiredOrdinal: number;
        /**
         * Nobody else in the world teaches it.
         *
         * The difference between a library and a shelf, and it is derived from
         * the teach lists rather than asserted: an art taught by exactly one
         * house is that house's, and an art on twenty shelves is a fact about
         * the world instead. Reading a teach list without this makes a house
         * that holds the only lightning curriculum anybody has look the same as
         * one that stocks the primer everybody stocks.
         */
        onlyHere: boolean;
        /** How many houses teach it at all, including this one. */
        housesTeachingIt: number;
    }[];
    /** The one it is known for, where it has one. */
    signature: { id: string; name: string; grade: TechniqueGrade; reach: string } | null;
    /** What kinds of thing it teaches, most-taught first. */
    categories: string[];
    /**
     * The elements on the list, deduped and in teaching order.
     *
     * One element across a whole library is the strongest single statement a
     * teach list makes about a house - it is what makes the Frostmirror an ice
     * house rather than a court with some cold arts - and an empty list is
     * equally a statement: a library with no element in it is a library about
     * bodies, doors or paperwork.
     */
    elements: string[];
    /** Arts that land on more than one person. Most houses teach none. */
    wide: { name: string; reach: string }[];
    /** The hardest thing on the list, which is what the library is worth. */
    hardest: { name: string; grade: TechniqueGrade; requiredOrdinal: number } | null;
    /** How much of the list is this house's alone. The interesting figure. */
    exclusiveCount: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE DOSSIER
//
// An entry on this sheet is read by somebody deciding something about the
// faction - whether to join it, lean on it, avoid it, or count it in a war -
// and the four blocks below are the four questions that decision turns on.
//
// None of this is written here. Every field is a field the catalogs already
// hold, assembled into the order a reader needs rather than the order the
// catalogs happen to store it in. That is the whole of the work: the register
// used to render one narrative paragraph per faction, which is a document
// written to be read rather than one written to be used, and the two are not
// the same document in a different box.
//
// Where the catalogs are opinionated the sheet quotes them rather than
// summarising. "The Court has never described what it does" is a fact with a
// source; "highly secretive" is the register inventing an assessment voice,
// and this file is not allowed one.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What it can put in front of you today, against what it could field once.
 *
 * The single most decision-relevant pair of numbers about any faction here,
 * and they are deliberately different: `acting` is who answers a challenge
 * this afternoon and `ceiling` is what the house could produce once, at a cost
 * that is usually the house. A reader who conflates them will walk into the
 * one faction in the province that can kill them.
 */
export interface RegisterFielded {
    acting: number;
    actingRank: string;
    /** Only where it is genuinely higher than `acting`. Null is the usual case. */
    ceiling: number | null;
    ceilingRank: string | null;
    /** What would have to happen for the ceiling to become a real number. */
    wakeCondition: string | null;
    /** What spending it costs, which is generally the house that spent it. */
    wakeCost: string | null;
    /** Whether rivals can be assumed to know the ceiling exists. */
    ceilingIsPublic: boolean;
    /** Seats held out of the world entirely. One faction has these. */
    withdrawn: { count: number; occupiedBy: string; seats: { position: string; ordinal: number }[] } | null;
    /** True only where a house holds more than one last-realm cultivator awake. */
    canProjectLastRealm: boolean;
    /**
     * What it can make, as against what it happens to contain.
     *
     * A house can stand at a rung because somebody walked in. `reliableOrdinal`
     * is the rung it reaches from its own intake, which is the number that says
     * whether it will still be standing there in a century.
     *
     * AND IT IS NOT A CEILING. Three different quantities were being flattened
     * into that one figure, and the sheet was reading the lowest of them as a
     * limit on the other two:
     *
     *   reliable      what it turns out routinely. A low figure here is not an
     *                 embarrassment and on several houses it is a policy.
     *   taughtCeiling what is realistically available to somebody there now,
     *                 bounded by who is alive to teach them - which is the
     *                 strongest living member and nothing else.
     *   everReached   what has actually been reached from inside this house,
     *                 off its own ancestral roll. Bounded by nothing but the
     *                 ladder, because a book carries you to the end of a realm
     *                 and the crossing is not in any book: everything past a
     *                 house's shelf came from somewhere else, so a house that
     *                 produced somebody who went all the way has demonstrated
     *                 that its ceiling was never its pipeline.
     *
     * The house where all three disagree most is the sharpest entry on the
     * sheet and must read as remarkable rather than as a contradiction.
     */
    produces: {
        reliableOrdinal: number;
        reliableRank: string;
        currentCount: number;
        peakOrdinal: number;
        peakRank: string;
        peakCount: number;
        yearsSinceLastPeak: number;
        note: string;
        /**
         * True where the house takes nobody at all.
         *
         * On those, `reliableOrdinal` is arithmetically correct and says
         * nothing: a body with no intake produces nothing from an intake it
         * does not have, which is not the same statement as producing nobody.
         * The register printed the second sentence for a long time about a
         * house whose own roll holds people who crossed the Lid.
         */
        takesNobody: boolean;
        /**
         * The gate, repeated here because it is what the routine figure means.
         *
         * A house whose routine figure sits BELOW its own admission bar is not
         * describing a pipeline - it is describing a door that only opens to
         * people who are already past where a pipeline would start.
         */
        gateOpensAt: number;
        /** Strongest living member: what is realistically reachable here now. */
        taughtCeiling: number;
        taughtCeilingRank: string;
        /** The furthest anybody produced here ever went. Off the ancestral roll. */
        everReached: { ordinal: number; rank: string; name: string; yearsAgo: number } | null;
    } | null;
}

/** Who it answers to and on what terms, which is a position rather than a label. */
export interface RegisterHoldsFrom {
    governance: string;
    relation: string;
    parentId: string | null;
    parentName: string | null;
    parentLinkId: string | null;
    standing: string;
    /** What it holds, and in whose gift. */
    holds: string;
    /** How much it knows about the apex over it. Most know nothing. */
    awarenessOfApex: string;
    terms: {
        tributeStonesPerYear: number;
        inKind: string[];
        disciplesPerCycle: number;
        buys: string[];
        renewal: string;
    } | null;
    /** For the unbacked: what independence actually costs, and how they hold it. */
    costOfIndependence: string | null;
    independenceStance: string | null;
    unbackedReason: string | null;
    note: string;
}

/**
 * One relationship, seen from the entry it is printed on.
 *
 * `holdsFrom` above answers who a body reports to, once, upward, and that was
 * the whole of what the sheet said about a faction's relations for a long time.
 * It is the wrong shape for the question a reader actually has: a body has
 * relations in three directions, the warmth of each is a separate fact from the
 * structure of it, and the interesting houses are the ones where those two
 * disagree - dutiful upward and brutal downward, or warm to a patron who is
 * merely civil back.
 *
 * Every field here is quoted from `faction-relationships.ts` and none is
 * assembled at render time. `theirWarmth` is the other body's word for the same
 * tie, printed beside this body's, so an asymmetry is visible on the entry
 * rather than requiring a reader to go and open the other one.
 */
export interface RegisterRelationship extends ResolvedRelationship {
    /** The other body's entry on this sheet, where it has one. */
    anchor: string | null;
    /**
     * What the two of them both have a hand on. Usually empty.
     *
     * The second axis of a relationship and the one the sheet had no way to
     * show. A tie's warmth says how two bodies get on; this says what there is
     * between them to get on about, and the interesting pairs are the ones
     * where those disagree - two houses contesting a founding while remaining
     * scrupulously civil is the commonest shape in the catalog, and it is what
     * the design owner meant by semi-enemies.
     *
     * Derived, never authored. See
     * `what-two-houses-both-have-a-hand-on.ts` for why it must be.
     */
    contestedOver: readonly Contention[];
}

/**
 * What a body holds at the top of the ladder, and what it can do with it.
 *
 * The catalog row plus the two numbers a reader wants resolved against it: the
 * rung the road ends at, and the rung the house's own teacher stops at. Those
 * are not the same figure on three of the four holders, and the gap between
 * them is the most useful thing on the block - a road with no teacher for its
 * last rungs is a road somebody has to finish alone.
 */
export interface RegisterDeepRoad extends DeepRoadHolding {
    roadName: string;
    /** Where the book ends. */
    cap: number | null;
    capRank: string | null;
    /** The furthest the strongest teacher here can actually carry somebody. */
    carriesTo: number;
    carriesToRank: string;
    /** Whether the house can finish what it starts. Three of four cannot. */
    canFinishIt: boolean;
    /** How hard the first rungs are, in the manual's own words. Null is smooth. */
    opening: { rungs: number; rateMultiplier: number } | null;
    /**
     * The highest rung anybody can be TAUGHT to on this road.
     *
     * Not `cap`, and the difference is the correction. `cap` is where the paper
     * stops, and on a book covering the last realm that is the rung the last
     * crossing LANDS on - which nobody is ever taught onto. Comparing a
     * teacher's reach against `cap` reported the one house in the world whose
     * leader can teach every teachable rung as two rungs short of finishing its
     * own road. See `teachableEndOf` in the technique catalog.
     */
    teachableEnd: number | null;
}

/**
 * What it is actually good at, against what it is known for.
 *
 * Reputation fixes on whatever is legible from the road and then stops
 * updating, so these two fields are reliably different - and the gap is usable
 * in both directions, which is why the sheet prints both rather than picking.
 */
export interface RegisterCapability {
    practice: string;
    knownAs: string;
    actuallyGoodAt: string;
    theGap: string;
    /** What it counts, and therefore what it will and will not trade. */
    unitOfValue: string;
    /** Where it has stopped doing the thing it is defined by. Usually absent. */
    quietlyStopped: string | null;
    grievance: string;
    fear: string;
    /** What it is late for, which is how most of these houses actually lose. */
    lateness: string;
    /** The disagreement inside it. */
    disagreement: string;
    /** What the house itself has wrong, which it cannot tell you. */
    wrongAbout: string;
    /**
     * The one sentence that could not be said about anything else in the world.
     *
     * The catalog calls this the faction test, written down, and it is checked
     * for uniqueness by the data suite - which makes it the single most useful
     * line about a house that the register was not printing anywhere at all.
     */
    distinctSentence: string;
}

/** How somebody gets in, and what clearing the bar actually requires. */
export interface RegisterWayIn {
    intake: IntakeRoute;
    /** The membership bar. */
    minOrdinal: number;
    minRank: string;
    /**
     * The rung at which a house will take somebody on and start spending,
     * without admitting them. One house has one and it is the real door.
     */
    guestFromOrdinal: number | null;
    requirement: string;
    preferredRoots: string[];
    minInsight: number | null;
    minMight: number | null;
    minCharm: number | null;
    /** The ladder and what each rung pays, which is the offer stated as numbers. */
    ladder: { rank: string; stipend: number }[];
}

/**
 * Things a reader should not take at face value.
 *
 * A dossier flags what is uncertain instead of smoothing it. A house claiming
 * an ancestor above the Lid that the catalog says it does not have is the
 * single most useful line the register can carry about it, and the old entry
 * had no place to put it.
 */
export interface RegisterFlag {
    kind: string;
    text: string;
}

/** What a faction is trying to become, with everybody named resolved. */
export interface RegisterAmbition {
    wants: string;
    blockedBy: { id: string; name: string; ordinal: number; linkId: string | null }[];
    wouldCost: string;
    /**
     * The other hand on the same object, with what that party says it wants.
     *
     * Both directions, from `contestedClaimsOf`: a claim contested from one
     * side only is a claim the catalog has recorded once, and printing it once
     * would make an argument look like an assertion.
     */
    contestedWith: { id: string; name: string; ordinal: number; wants: string; linkId: string | null }[];
    movedOn: string;
}

/** One body answering directly to an apex, however the catalog files it. */
export interface RegisterSubordinate {
    id: string;
    name: string;
    ordinal: number;
    /** court, subsidiary, administration - the parentage vocabulary. */
    kind: string;
    /** The catalog's own account of how it came to answer here. */
    cameFrom: string | null;
    /**
     * True where the grant costs no stones and owes no disciples.
     *
     * The field that stops the sheet describing every arrangement in the world
     * as a lease. Two houses in the catalog hold on terms that take nothing in
     * either direction, and both of them are under the same apex - which is not
     * a tenancy, whatever the governance column says, and is the difference
     * between a family and an administration stated as a number.
     */
    paysNothing: boolean;
    /** Tribute in stones a year, so the sheet can total what a patron takes. */
    stonesPerYear: number;
    /** The renewal clause, which on the free grants is the whole explanation. */
    renewal: string | null;
    linkId: string | null;
}

/** How somebody gets into a dao house, which is not an admission day. */
export interface RegisterHouseAdmission {
    surname: string;
    route: string;
    prodigyIn: string;
    marriage: string;
    surrendered: string;
    naming: string;
    lastTaken: string;
    costOfTheForm: string;
}

/**
 * One faction, and everybody attached to it.
 *
 * The register used to be a set of cross-cutting tables - all factions here,
 * all sealed ancestors there - which answers "who is strongest" well and
 * "what am I dealing with" badly. A person reading about the Frostmirror Court
 * had to find it in four places. This is the other arrangement: the sect is the
 * unit, and everything that belongs to it is underneath it.
 *
 * The four states a person can be in are kept separate because they are not
 * degrees of the same thing:
 *
 *   active     alive, in the sect, and can be met
 *   sealed     alive, cannot act without being spent
 *   ascended   through the Lid, and gone
 *   dead/lost  the line stops there
 */
export interface SectDossier {
    id: string;
    name: string;
    /** Strongest ACTING member, which is what orders this list. */
    ordinal: number;
    rank: string;
    alignment: string;
    admissionOrdinal: number;
    recruits: boolean;
    /**
     * How somebody actually gets in.
     *
     * `recruits` answers "is there a door", which for a dao house is genuinely
     * yes and for an admission ordinal is meaningless: the way into a house is
     * adoption, and the ordinal beside it is the rung a family member is
     * expected to reach rather than a bar an applicant clears.
     */
    intake: IntakeRoute;
    governance: string;
    standing: string;
    parentName: string | null;
    territory: string;
    /**
     * The house in its own words - the several sentences the catalog carries
     * about its ground, what its teaching actually does, what outsiders get
     * wrong about it, and where it cannot produce what it stands on.
     *
     * `territory` is the one-line placement and this is the body. The sheet was
     * rendering the first and dropping the second, which left thirty entries
     * that opened onto nothing but chips and a ceiling - a card that expands
     * onto no prose reads as a faction the register has nothing to say about,
     * and the catalog had four sentences on every one of them.
     */
    description: string;
    /**
     * The ladder this house ranks its own people on, bottom to top.
     *
     * Carried because the shape of it is identity: six rungs from Snow Servant
     * to Court Sovereign is a sect, four titles covering every practitioner in
     * five provinces is an institution that has decided ranking people is not
     * interesting, and the two are not the same kind of body.
     */
    titles: string[];
    /** What the catalog says it is for: attack, defence, movement, support. */
    specialities: string[];
    /** What it will teach, resolved. Null on a house with no teach list. */
    curriculum: RegisterCurriculum | null;
    /**
     * The road to the top of the ladder, on the four bodies that hold one.
     *
     * Beside the curriculum rather than inside it, because a teach list answers
     * "is this title on the shelf" and the two questions that decide whether
     * anybody ever gets up one of these are not on any shelf: how many copies
     * physically exist, and how many people in the house can teach at that
     * depth. Those are the fields that separate an apex, which can spare a
     * fraction of one person, from the body that has four working on nothing
     * else. See {@link DeepRoadHolding}.
     */
    deepRoad: RegisterDeepRoad | null;
    /**
     * Three or four sentences that say what this faction is, assembled from the
     * fields rather than written. See {@link buildSynopsis}.
     */
    synopsis: string[];
    /** What it can field now against what it could field once. Always present. */
    fielded: RegisterFielded;
    /** Who it answers to and on what terms. Null only where nothing records one. */
    holdsFrom: RegisterHoldsFrom | null;
    /**
     * Everything it stands in relation to, above, below and beside.
     *
     * Last on the entry, and never empty: every body in the catalog is in at
     * least one, because the tables the ties are read out of already covered
     * the world. An entry with nothing here would be a fault in the data rather
     * than a body that stands alone, which is why the section says so.
     */
    relationships: RegisterRelationship[];
    /** Reputation against capability. Null where the catalog has no character row. */
    capability: RegisterCapability | null;
    /** The door, where there is one. Null on a house that takes nobody. */
    wayIn: RegisterWayIn | null;
    /** What a reader should not take at face value. Empty is the usual case. */
    flags: RegisterFlag[];
    /**
     * The second name this body is filed under, where it has one.
     *
     * A court that is also a sect has two: the one the province has used for
     * nine hundred years, and the one the apex calls the posting. Both go on
     * the one entry, because which name is "real" is exactly the thing the
     * catalog says has never been settled.
     */
    alsoKnownAs: string | null;
    /**
     * The court record for a body that is also a court, where there is one.
     *
     * `alsoKnownAs` carries the second name and nothing else, which was enough
     * for a heading and not enough for an entry: what makes the Azure Mist a
     * court rather than a feeder is how it became one, and that sentence is on
     * the court row rather than on the sect row.
     */
    asCourt: {
        name: string;
        administers: string;
        /** How it came to answer where it does. Null on a court that never moved. */
        transferNote: string | null;
        apexName: string;
    } | null;
    /** What it could field once, at cost. Null where that is just its ordinal. */
    ceiling: number | null;
    apex: {
        giftName: string;
        heritage: string;
        stock: string;
        secondSeat: number;
        /** Who holds the seat and why they do not leave it. */
        seatNote: string;
        /** What could take the position away. Never the same answer twice. */
        instability: string;
        /**
         * Whether a starting cultivator may be told the name exists.
         *
         * The single most characterful fact about two of the three and it never
         * reached the page. `unaware` does not mean "has not visited": the name
         * has never been said in front of them, which is a fact about the whole
         * posture of the institution rather than about the player's travels.
         */
        startingAwareness: string;
        /** How many the house has at the last realm, and whether they can move. */
        lastRealmCount: number;
        /** How deep the position goes under the seated one. */
        depthNote: string;
        /** What actually decides standing inside it, which is rarely the ladder. */
        rankNote: string;
        /** How many institutions of this kind exist at all. Context for the rest. */
        ofHowMany: number;
        /**
         * Everything answering directly to it, courts and tenants in one list.
         *
         * Read from both tables, because the catalog files subordination in two
         * places and they do not overlap: a court names its apex on its own row,
         * and everything else points upward from the parentage table. An apex
         * built from one of them loses whichever of its subordinates lives in
         * the other, and the Long Cut's only direct tenant lives in the second.
         */
        answeredBy: RegisterSubordinate[];
    } | null;
    channel: {
        kind: string;
        crossings: number;
        tier: string | null;
        depletion: string | null;
    } | null;
    withdrawn: { count: number; occupiedBy: string } | null;
    holdings: { item: string; count: number; byGrade: { higher: number; middle: number; lower: number } }[];
    partingGift: { name: string; intact: boolean } | null;
    /** Everything in the artifact catalog this faction owns, strongest first. */
    artifacts: RegisterArtifact[];
    /**
     * How it came to be here. First on the entry, and everything else follows.
     */
    history: RegisterHistory | null;
    /** What it is willing to do that the others are not. Null on all but six. */
    demonic: RegisterDemonic | null;
    /**
     * How it is staffed, where it is staffed rather than joined. Null on most.
     *
     * It sits in the ranks-and-people part of the entry rather than with the
     * history, because it is a fact about who is next rather than about how the
     * body came to be here - and the precedence a completed term buys is a fact
     * about a promotion queue, which is exactly what that part of the entry is
     * for. See `RegisterPosting`.
     */
    posting: RegisterPosting | null;
    /**
     * Why this body has no place for its own members' children. Null on all but three.
     *
     * It sits with the ranks and the people, because it is a fact about who is
     * in the house and who is conspicuously not. Everywhere else a cultivator
     * raises their child in their own house and no field is needed; these three
     * cannot, for two opposite reasons, and the reason decides what happens to
     * the child afterwards.
     */
    noPlaceForItsOwn: RegisterNoPlace | null;
    /**
     * Whether somebody can get in here on a favour, which is the question an
     * ordinary person is actually asking.
     *
     * A favour skips the admission ordinal - that is the whole of what one
     * does, and it is the only thing that makes a name worth anything before a
     * child has an ordinal at all. It sits beside the gate rather than in the
     * global section because the answer is a fact about this house, and the two
     * "no" answers are not the same no: one house has nothing to skip and
     * another has something and will not skip it.
     */
    favour: RegisterFavour | null;
    /**
     * What a passerby would tell you these people are. Leads the entry.
     *
     * The first chunk, and the one the whole restructure turned on: a reader
     * arriving at a faction wants to know what it is before anything else, and
     * the sheet was opening on an assembled precis of figures. See
     * {@link buildPasserby}.
     */
    passerby: RegisterPasserby | null;
    /** What it is trying to become. Null on the four that want nothing. */
    ambition: RegisterAmbition | null;
    /**
     * This body's own account of a lineage another body also claims. Usually null.
     *
     * It sits with the claims and the ancestors at the foot of the entry rather
     * than up with the history, and the placement is the argument: a claim is
     * what a house asserts, not what is true, and a reader who has already been
     * shown the roll, the holdings and the standings can weigh it. Shown first
     * it would be accepted.
     */
    /** The family, and the door. Null on everything that is not a dao house. */
    house: RegisterHouseAdmission | null;
    people: {
        /**
         * Everybody on the body's roll, strongest first.
         *
         * Read from `rollOf` rather than by filtering the member catalog here.
         * Membership used to be a property of each PERSON and nothing could ask
         * a HOUSE who was in it, so three readers rebuilt it three different
         * ways by scanning - and one house's people were in a catalog none of
         * them read, which is how the highest acting body in the world had an
         * entry with nobody on it. `source` says which catalog a row came out
         * of, so the sheet reports state rather than restating it.
         */
        active: {
            name: string;
            rank: string;
            ordinal: number;
            role: string;
            wants: string;
            detail: string;
            source: string;
            /** The name they use outside, on the one body that needs one. */
            worksOutsideAs: string | null;
            /** What the world knew about them before they went in. */
            knownForBefore: string | null;
            /** What the body can actually require of them. Null where nothing records it. */
            askedOf: string | null;
        }[];
        sealed: RegisterSealed | null;
        /**
         * What the ancestral roll says about the same person, which is not what
         * the seal record says.
         *
         * Every sealed ancestor in the world is also on their house's roll under
         * `fate: 'dormant'`, and the two entries carry different halves: the
         * seal record has the trigger, the cost and who he is, and the roll has
         * how the disappearance was accounted for at the time. The register was
         * printing the first and dropping the second, which is the half a player
         * meets first, because it is the public story.
         */
        sealedOnTheRoll: string | null;
        ascended: { name: string; ordinal: number | null; yearsAgo: number; rememberedFor: string }[];
        terminal: { name: string; fate: string; ordinal: number | null; yearsAgo: number; rememberedFor: string }[];
    };
}

/** The floor for the first tab. Grand Ascension begins here. */
export const HIGH_BAND_FLOOR = GRAND_ASCENSION.ordinalStart;

/**
 * One person at or above Grand Ascension.
 *
 * Assembled across every catalog at once, because nothing above thirty-six is
 * an ordinary member: the named-member catalog tops out well below it. What is
 * up there is lordships, sealed ancestors and the crossed, and most of them
 * have no name anybody outside their own walls has been given. `named: false` is a fact
 * about the world rather than a hole in the data.
 */
export interface HighPerson {
    name: string;
    named: boolean;
    ordinal: number;
    rank: string;
    /**
     * What this person is doing, never what realm they are at.
     *
     * acting | pinned | withdrawn | sealed | ascended | died above | came back
     *
     * The distinction earns its keep at the top two rungs. `rank` already says
     * False Immortal or True Immortal, so a state that repeated it would spend
     * a column saying nothing: what the state column is for is the fact the
     * rank does not carry - whether they are in the world, under a mountain,
     * above the Lid, or back down from it and unable to go again.
     */
    state: string;
    /**
     * Whether they still exist anywhere.
     *
     * The axis is existence, not location, which is the correction that matters:
     * ascension is not an ending. Somebody who crossed is alive on the other
     * side of the Lid, can in principle come back down for the ten or fifteen
     * breaths that costs, and belongs in the living list. Somebody who crossed
     * and then died up there does not - the Immortal Realm has dangers and
     * politics of its own, and three thousand years is a long time to survive
     * them.
     *
     * Sealed also counts as alive: under a mountain and wakeable is a completely
     * different fact from gone.
     *
     * This is an operator's page, so it states which. Nobody below the Lid can
     * establish it, and every sect claiming its ancestor still answers is making
     * a claim it has no way to check.
     */
    alive: boolean;
    /**
     * Shown instead of the ordinal where the catalog holds a band rather than a
     * rung. `ordinal` still carries the band floor so the table can sort, and
     * printing that number on its own would assert something nobody recorded.
     */
    ordinalNote: string | null;
    /**
     * The body they belong to, as an id rather than only a name.
     *
     * Carried so the name in this table can open that body's entry. Resolved
     * through `idsForFaction` at the end of the build, because a row may name a
     * court, an apex or a sect and all three can be filed under a second id.
     */
    factionId: string | null;
    factionName: string;
    factionOrdinal: number;
    note: string;
}

/**
 * Who reports to whom, resolved into a tree.
 *
 * Built by walking `FACTION_PARENTAGE` rather than by hand, so the diagram
 * cannot describe a chain the catalog does not hold. Sub-tenancies are real and
 * are drawn as such: one sect holds from another sect rather than from the
 * court, which no flat table shows.
 */
export interface StackNode {
    id: string;
    name: string;
    ordinal: number;
    standing: string;
    /**
     * The dossier this node opens, or null where there is nothing to open.
     *
     * Resolved here rather than in the renderer because the ids do not line up
     * on their own: an apex is filed under its apex id and its dossier under a
     * sect id, and a court has no dossier at all - it is an office, not a
     * faction, and the Factions tab is right not to list it. A card with no
     * destination is drawn as a card rather than as a link that goes nowhere.
     */
    linkId: string | null;
    children: StackNode[];
}

export interface WorldRegister {
    generatedAt: string;
    counts: {
        factions: number;
        apexes: number;
        courts: number;
        sealed: number;
        wanderers: number;
        immortalObjects: number;
        artifacts: number;
        courtOfficers: number;
        techniques: number;
        /** Arts no house in the world will hand over. Not a fault; a fact. */
        untaughtTechniques: number;
        /** Kinds of thing the engine can track at all, catalogued or not. */
        itemKinds: number;
        /** Authored rows across every item catalog that is not the artifacts. */
        catalogued: number;
    };
    /**
     * Every kind of thing the world can hold, and every catalogued instance.
     *
     * The objects section is ONE of the kinds - the artifact table, sorted on a
     * combat rating. This is the other nine, which is most of what somebody can
     * actually pick up: manuals, medicine, ingredients, the comprehension
     * pieces that are gone once understood, lots of currency, graves and ground.
     *
     * NOT `items`, which on this record is the two immortal objects and has
     * been for a long time. Renaming that field would move a name three tests
     * and the served JSON already read.
     */
    trackedItems: RegisterItems;
    /**
     * What is inside each house, joined across the seven catalogs that hold it.
     *
     * Nothing else on the sheet answers "if I walk in, what is in it and what
     * can it do for me or to me", because the inventory is scattered: the owner
     * is a field on the object, the arts are a teach list, the doses are a
     * third table, the ground is a grant, and what is asleep is in the
     * ancestral records.
     *
     * NOT `holdings`, which on this record is the immortal-object holdings
     * table and is read by name elsewhere.
     */
    whatEachHouseHolds: RegisterHoldings;
    /**
     * The medicine that mends a cultivator who crossed and arrived broken,
     * and - the figure this section exists for - how many sent-down doses are
     * left. Nobody below the Lid can make another, so that number only falls.
     */
    repairMedicine: RegisterRepairMedicine;
    ladder: { key: string; name: string; start: number; end: number }[];
    apexes: RegisterApex[];
    rows: RegisterRow[];
    sealed: RegisterSealed[];
    channels: {
        factionId: string;
        name: string;
        kind: string;
        crossings: number;
        tier: string | null;
        depletion: string | null;
        mostRecentCrossingYearsAgo: number | null;
    }[];
    /**
     * The two objects, and what each grade of them actually does.
     *
     * Grade is not dosage and the counts are not evenly spread: the higher
     * grade of each is a single object, and the lower grade is the one anybody
     * has actually seen. A holdings figure that does not say which grade is
     * being held is close to meaningless, which is why this sits beside them.
     */
    items: {
        id: string;
        name: string;
        form: string;
        effect: string;
        knownCount: number;
        /** How many were ever known, which is a larger and unhappier figure. */
        everKnown: number;
        knownByGrade: { higher: number; middle: number; lower: number };
        grades: { higher: string; middle: string; lower: string };
    }[];
    holdings: { factionId: string; name: string; itemId: string; count: number }[];
    wanderers: {
        id: string;
        recordName: string;
        commonName: string;
        lastOrdinal: number;
        outcome: string;
        crossingYearsAgo: number;
        affiliationId: string | null;
    }[];
    withdrawn: { factionId: string; name: string; count: number; occupiedBy: string }[];
    /**
     * Every artifact in the world, strongest first.
     *
     * One table, in the catalog's own order, because the order is the argument.
     * The register does not band it, group it by owner or file the top of it
     * separately: an object an ascended founder sent down and a dead bandit's
     * sabre are the same row with different numbers, and any arrangement that
     * separates them is the sheet asserting a distinction the engine does not
     * make.
     */
    artifacts: RegisterArtifact[];
    /** Where making stops, read off the catalog's own provenance tags. */
    artifactCeiling: RegisterArtifactCeiling | null;
    /** Every court, with the people standing in its offices. */
    courts: RegisterCourt[];
/**
     * The three bodies with no place for their own members' children.
     *
     * Global AND per-entry, and both are needed. Each of the three carries its
     * own account on its own entry, because the reason differs and the
     * downstream story differs with it. This section is the comparison, which
     * no single entry can show: two of them get there because there is no door
     * at all, one because of a bar nothing else in the world applies, and the
     * contrast is the fact rather than either half of it.
     *
     * Everywhere else a cultivator simply raises their child in their own
     * house, which needs no mechanism and gets no section. That sentence is
     * here because an earlier draft made this universal and it was wrong.
     */
    noPlaceForTheirOwn: {
        factionId: string;
        name: string;
        anchor: string | null;
        reason: string;
        whyItCannotKeepThem: string;
        whereTheChildGoes: string;
        whatTheChildKnows: string;
        andWhetherItIsPermanent: string;
        whatItCostsTheParent: string;
    }[];
    /**
     * What happens when a placement does not take.
     *
     * Beside the three rather than on any of them, because it is an outcome of
     * being placed above your ability rather than a rule about a body - and it
     * applies to the Court's placements as much as to the postings', which is
     * the sharpest thing about it.
     */
    washingOut: { key: string; heading: string; text: string }[];
    /**
     * What a favour is for, and which doors it does not open.
     *
     * Global because the mechanic is, and because the useful facts are
     * comparisons no single entry can carry: five houses admit at the floor and
     * a favour buys nothing at any of them, five have a bar that will not move
     * and each for a different reason, and the three apexes differ on this axis
     * far more sharply than on their alignments.
     */
    theFavour: {
        /** Houses where a word buys nothing, because the door is already open. */
        noBarToSpeakOf: { id: string; name: string; anchor: string | null }[];
        /** Houses where a word buys the bar, which is the ordinary case. */
        movesForOne: { id: string; name: string; anchor: string | null; bar: number }[];
        /** Houses whose bar does not move, and why each one cannot. */
        willNotMove: { id: string; name: string; anchor: string | null; why: string }[];
        /** The two apexes that trade a word, and the one that will not. */
        apexes: { key: string; heading: string; text: string }[];
        /** The extreme case the whole mechanic exists for. */
        theNewborn: { key: string; heading: string; text: string }[];
    };
    /** The object at the centre of the one storyline this produces. */
    theMemento: { key: string; heading: string; text: string }[];
    /** Every art, with every house that teaches it. Grade descending. */
    techniques: RegisterTechnique[];
    /** Every house with a teach list, and what is on it. */
    teaching: RegisterTeaching[];
    /** The reporting tree, one root per apex. */
    stack: StackNode[];
    /** Everybody at or above Grand Ascension, strongest first. */
    high: HighPerson[];
    /** Every faction with everything attached to it, strongest acting member first. */
    dossiers: SectDossier[];
    /**
     * Everybody at Grand Ascension, drawn from every kind of entity at once.
     *
     * This band is the top of the world anyone can actually meet, and it is the
     * one the faction table hides: courts are not factions, an apex second is
     * not an institution, and a sealed ancestor is not an acting member. Read
     * the catalogs one at a time and the band looks nearly empty. It is not.
     */
    grandAscension: {
        name: string;
        ordinal: number;
        kind: string;
        note: string;
    }[];
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────

function nameOf(id: string): string {
    return getSect(id)?.name ?? getApexInstitution(id)?.name ?? getCourt(id)?.name ?? id;
}

/**
 * The ancestral roll's account of whoever the seal record names.
 *
 * Joined on the rung rather than on the name. The two catalogs spell the same
 * person differently - "The Mirror" on one and "The First Sovereign, called the
 * Mirror" on the other - and every house has at most one of each, so the
 * ordinal is the reliable key and a string comparison is a bug waiting for a
 * rename. Null where the roll does not carry them, which is a real state: the
 * whole point of several of these is that the sect's papers do not say.
 */
function rollNoteFor(
    ancestors: readonly { fate: string; name: string; realmOrdinal: number | null; rememberedFor: string }[],
    sealed: RegisterSealed
): string | null {
    const dormant = ancestors.filter(a => a.fate === 'dormant');
    const match = dormant.find(a => a.realmOrdinal === sealed.ordinal)
        ?? (dormant.length === 1 ? dormant[0] : undefined);
    return match?.rememberedFor ?? null;
}

/** The rung a faction, court or apex stands on, or 0 where nothing records one. */
function ordinalOf(id: string): number {
    return getSect(id)?.powerOrdinal
        ?? getApexInstitution(id)?.powerOrdinal
        ?? getCourt(id)?.powerOrdinal
        ?? 0;
}

/**
 * A seat id, as the artifact catalog writes them, resolved to a seat.
 *
 * The four withdrawn seats are positions rather than people - the catalog
 * records a rung and a position and no name for any of them - so `seat-third`
 * resolves to the third entry of the owning faction's withdrawn ladder and
 * carries that seat's own ordinal. It is worth the resolution: the Fourth Seat
 * stands at forty-two and is carrying a forty-three, and the two numbers next
 * to each other are the most useful line in the table.
 */
const SEAT_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

function resolveSeat(ownerId: string | null, possessorId: string): { name: string; ordinal: number } | null {
    const word = /^seat-(.+)$/.exec(possessorId)?.[1];
    if (!word || !ownerId) return null;
    const index = SEAT_WORDS.indexOf(word);
    const seat = index >= 0 ? WITHDRAWN_POWERS[ownerId]?.seats[index] : undefined;
    return seat ? { name: seat.position, ordinal: seat.ordinal } : null;
}

/**
 * Every artifact, in the catalog's own order.
 *
 * `ownerLinkId` is left null here and filled in from the dossiers afterwards,
 * because the owner id on a record is not always the id the sheet files that
 * house under - a house that is both an apex and a joinable sect answers to two
 * - and `artifactsOwnedBy` is the thing that knows. What is left null at the
 * end is genuinely an owner this sheet has no entry for, which is worth seeing
 * rather than worth hiding.
 */
function buildArtifacts(): RegisterArtifact[] {
    return ARTIFACTS.map(a => {
        const inVault = a.possessorId !== null && a.possessorId === a.ownerId;
        const seat = a.possessorId ? resolveSeat(a.ownerId, a.possessorId) : null;
        const member = a.possessorId ? MEMBERS.find(m => m.id === a.possessorId) : undefined;

        return {
            id: a.id,
            name: a.name,
            power: a.power ?? 0,
            significance: a.significance,
            ownerId: a.ownerId,
            ownerName: a.ownerName,
            ownerLinkId: null as string | null,
            possessorId: a.possessorId,
            possessorName: a.possessorId === null
                ? ''
                : inVault
                    ? a.ownerName || nameOf(a.possessorId)
                    : seat?.name ?? member?.name ?? nameOf(a.possessorId),
            inVault,
            possessorOrdinal: seat?.ordinal ?? member?.realmOrdinal
                ?? (inVault && a.ownerId ? ordinalOf(a.ownerId) || null : null),
            tags: [...a.tags],
            description: a.description
        };
    });
}

/**
 * The rung where making stops, or null where the catalog does not draw one.
 *
 * Measured, never asserted. The whole table is sorted on power, so the boundary
 * is a valid one only if the two provenances do not interleave: every row above
 * the break sent down, every row from the break on made here. Anything else and
 * the sheet says nothing, because a ceiling somebody has already passed is
 * worse than no ceiling at all.
 */
function findArtifactCeiling(list: RegisterArtifact[]): RegisterArtifactCeiling | null {
    const madeHere = (a: RegisterArtifact): boolean => a.tags.includes('forged');
    const sentDown = (a: RegisterArtifact): boolean => a.tags.includes('immortal-made');

    const breakAt = list.findIndex(madeHere);
    if (breakAt <= 0 || breakAt >= list.length) return null;
    if (!list.slice(0, breakAt).every(a => sentDown(a) && !madeHere(a))) return null;
    if (!list.slice(breakAt).every(a => madeHere(a) && !sentDown(a))) return null;

    return {
        madeHere: list[breakAt].power,
        weakestSentDown: list[breakAt - 1].power,
        breakAt
    };
}

/**
 * One body's own side of a contested lineage, quoted whole.
 *
 * This used to be a single top-level `schism` section built from one standalone
 * catalog record, and the record before that reached no page at all - which is
 * the exact class of failure this page's suite exists to catch. It is now read
 * off whichever body is being rendered, because the catalog no longer holds a
 * joint version: two bodies four provinces apart under different patrons have
 * no shared vantage to narrate from, so each carries its own and a reader
 * compares them.
 *
 * Headings are derived from the record's own keys rather than written, so a
 * field added to the catalog turns up here instead of being silently lost. The
 * text is never summarised: every field is an argument one of two parties makes
 * about which of them is the house, both arguments are nine hundred years old,
 * and there is no instrument anywhere that decides it. A paraphrase would pick
 * a side.
 */
/**
 * How a faction came to be here, read whole out of the history catalog.
 *
 * Nothing is assembled and nothing is summarised. The shared events arrive with
 * this faction's own account already selected - the catalog holds one account
 * per party and the register picks the one belonging to the entry being drawn,
 * which is the whole mechanism by which two houses can carry different
 * accounts of the same year without either of them being the sheet's opinion.
 *
 * `anchor` on the other parties is filled in the second pass, once the entries
 * exist.
 */
function buildHistory(factionId: string): RegisterHistory | null {
    const h = historyOf(factionId);
    if (!h) return null;
    return {
        origin: h.origin,
        whyTheGapIs: h.whyTheGapIs,
        whatTheUnlitNodesWere: h.whatTheUnlitNodesWere,
        whereTheWrongBeliefComesFrom: h.whereTheWrongBeliefComesFrom,
        shared: sharedEventsFor(factionId).map((e: SharedEvent) => ({
            id: e.id,
            yearsAgo: e.yearsAgo,
            what: e.what,
            explains: e.explains,
            ourAccount: e.accounts[factionId],
            others: otherPartiesTo(e, factionId).map(id => ({
                id,
                name: nameOf(id),
                anchor: null as string | null
            }))
        }))
    };
}

/**
 * What a passerby would tell you these people are.
 *
 * Assembled, not written, and built out of the field that already carries the
 * OUTSIDE view rather than the true one - `knownFor.outside` is defined in its
 * own catalog as "what people two provinces away would say they are", which is
 * the passerby, exactly. Everything else on this sheet is the inside view, and
 * mixing the two here would produce a sentence nobody in the world could say.
 *
 * THE DAO COMES FIRST ON A DAO HOUSE. These are bodies with no territory whose
 * entire identity is one principle applied for millennia, so opening on
 * anything else answers a question nobody asked. A stranger asked about the
 * Quiet Cut says "they cut things" before they say a word about where the house
 * is, and they are right to.
 */
function buildPasserby(factionId: string): RegisterPasserby | null {
    const outside = getFactionCharacter(factionId)?.knownFor.outside ?? null;
    const house = getDaoHouse(factionId);

    if (house) {
        // The dao, what the principle actually is, and what they sell, in that
        // order - because that is the order somebody would say it in.
        const sells = house.services[0]
            ? `They sell ${unperiod(upTo(house.services[0], 130))}.`
            : '';
        return {
            dao: house.principle,
            // THE REPUTATION IS NOT SPLICED IN HERE ANY MORE, and it is a
            // presentation fix rather than a cut - the entry header now prints
            // it as its own paragraph. Spliced, it was the fourth clause of a
            // paragraph well past the page's chunk limit, so the split landed
            // wherever the sentence boundaries happened to fall and on one
            // house that was after the single word "Weights." The reputation
            // is short enough to survive whole once it is its own block.
            line: [
                `A house of ${house.principle}.`,
                upTo(firstSentence(house.principleDescription), 260),
                sells
            ].filter(Boolean).join(' ')
        };
    }

    if (!outside) return null;
    return { dao: null, line: outside };
}

/**
 * Whether a favour gets somebody in here, and whether this house spends one.
 *
 * Read off the favour catalog, which authors the unusual answers and derives
 * the ordinary one from `SECT_ADMISSION` - so a house whose bar moves cannot
 * drift out of step with the bar it states.
 */
function buildFavour(factionId: string, apexStance: string | null): RegisterFavour | null {
    const f = favourStanceOf(factionId);
    if (!f && !apexStance) return null;
    return {
        answer: f?.answer ?? 'nobody joins it',
        why: f?.why ?? 'Nobody is admitted here on any terms, so there is no bar for a word to skip.',
        andWhatItTakes: f?.andWhatItTakes ?? null,
        andWhetherItsOwnWordMoves: f?.andWhetherItsOwnWordMovesAnybody ?? null,
        apexStance
    };
}

/** Why a body cannot keep a member's child. Null on all but three. */
function buildNoPlace(factionId: string): RegisterNoPlace | null {
    const x = noPlaceForTheirOwn(factionId);
    if (!x) return null;
    return {
        reason: x.reason,
        whyItCannotKeepThem: x.whyItCannotKeepThem,
        whereTheChildGoes: x.whereTheChildGoes,
        whatTheChildKnows: x.whatTheChildKnows,
        andWhetherItIsPermanent: x.andWhetherItIsPermanent,
        whatItCostsTheParent: x.whatItCostsTheParent
    };
}

/** How a body that takes nobody is staffed. Null on all but two. */
function buildPosting(d: Posting | undefined): RegisterPosting | null {
    if (!d) return null;
    return {
        appointedBy: d.appointedBy,
        whatItIsWorthFromBelow: d.whatItIsWorthFromBelow,
        whatItIsWorthFromAbove: d.whatItIsWorthFromAbove,
        andAfterwards: d.andAfterwards,
        andBeingPassedOver: d.andBeingPassedOver,
        andWhatTheTermIsWorthAfterwards: d.andWhatTheTermIsWorthAfterwards
    };
}

/** What a demonic faction is willing to do. Null on everything else. */
function buildDemonic(factionId: string): RegisterDemonic | null {
    const d = demonicStandingOf(factionId);
    if (!d) return null;
    return {
        kind: d.kind,
        theLineItCrosses: d.theLineItCrosses,
        whoPays: d.whoPays,
        didTheyAgree: d.didTheyAgree,
        whatItKeepsLocal: d.whatItKeepsLocal,
        standingOnTheContract: d.standingOnTheContract,
        ifItWereDestroyed: d.ifItWereDestroyed
    };
}

/** Every court, with the people actually standing in its offices. */
function buildCourts(): RegisterCourt[] {
    return COURTS.map(court => {
        const answering = strongestOfficerOf(court);
        return {
            id: court.id,
            name: court.name,
            apexId: court.apexId,
            apexName: getApexInstitution(court.apexId)?.name ?? court.apexId,
            ordinal: court.powerOrdinal,
            administers: court.administers,
            relationships: buildRelationships(court.id),
            // Filled after the panel is assembled: the precis reads it.
            synopsis: [] as string[],
            description: court.description,
            officesNote: court.officesNote,
            grantsInRegionId: court.grantsInRegionId,
            embodiedByFactionId: court.embodiedByFactionId,
            startingAwareness: court.startingAwareness,
            // Read off the apex rather than restated, because the rule is that
            // the two agree. Printing the court's own value alone would show a
            // fact where the sheet can show a consequence.
            apexAwareness: getApexInstitution(court.apexId)?.startingAwareness ?? court.startingAwareness,
            highWaterMark: court.highWaterMark
                ? {
                    name: court.highWaterMark.name,
                    ordinal: court.highWaterMark.ordinal,
                    rank: rankName(court.highWaterMark.ordinal),
                    yearsAgo: court.highWaterMark.yearsAgo,
                    end: court.highWaterMark.end,
                    note: court.highWaterMark.note
                }
                : null,
            transferNote: court.transferNote ?? null,
            posting: buildPosting(court.posting),
            noPlaceForItsOwn: buildNoPlace(court.id),
            // `court.roster` rather than `courtOfficers()`, and the difference
            // is the whole reason this field exists: the helper sorts by
            // ordinal, and an ordinal sort on a court roster invents a chain of
            // command out of a set of parallel jobs.
            officers: court.roster.map(o => ({
                id: o.id,
                name: o.name,
                title: o.title,
                office: o.office,
                ordinal: o.realmOrdinal,
                rank: rankName(o.realmOrdinal),
                apexRank: o.apexRank,
                wants: o.wants,
                fears: o.fears,
                detail: o.detail,
                answersForTheCourt: o.id === answering.id
            }))
        };
    })
        .map(court => ({ ...court, synopsis: buildCourtSynopsis(court) }))
        .sort((a, b) => b.ordinal - a.ordinal);
}

/**
 * Every art, with every house that hands it over.
 *
 * Sorted by grade descending and then by the rung the art is written for, so
 * the table reads the way the artifact table does: the thing that decides how
 * much an art is worth is first, and the top row and the bottom row are the
 * same kind of record. An art with an empty `taughtBy` is not an error - it is
 * an art that exists in the world with nobody alive willing to teach it, which
 * is the single most useful thing this table can tell a reader.
 */
function buildTechniques(): RegisterTechnique[] {
    const teachersOf = (techniqueId: string) => SECTS
        .filter(s => s.teaches.includes(techniqueId))
        .map(s => ({
            id: s.id,
            name: s.name,
            ordinal: s.powerOrdinal,
            signature: s.signatureTechniqueId === techniqueId
        }))
        .sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));

    /**
     * The body that HOLDS a road to the top of the ladder, where a teach list
     * cannot say so.
     *
     * Deliberately not folded into `taughtBy`, which is defined as the sect
     * catalog's teach lists and nothing else and is asserted to be exactly
     * that. Two of the four roads are held by apexes with no sect row, so no
     * shelf anywhere can carry them - and reading only the shelves reported
     * those two as arts nobody in the world can hand over, which is the
     * opposite of what is true about them. Holding is a different relation
     * from teaching and it gets a different field.
     */
    const heldByOf = (techniqueId: string): RegisterTechnique['heldBy'] => {
        const road = whoHoldsDeepRoad(techniqueId);
        if (!road) return null;
        const apex = getApexInstitution(road.factionId);
        const sect = getSect(road.factionId);
        return {
            id: road.factionId,
            name: apex?.name ?? sect?.name ?? road.factionId,
            ordinal: apex?.powerOrdinal ?? sect?.powerOrdinal ?? 0,
            copies: road.copies,
            teachers: road.teachers.length
        };
    };

    return TECHNIQUES
        .map(t => ({
            id: t.id,
            name: t.name,
            grade: t.grade,
            category: String(t.category),
            element: t.element === null || t.element === undefined ? null : String(t.element),
            requiredOrdinal: t.requiredOrdinal,
            rank: rankName(t.requiredOrdinal),
            provenance: t.provenance,
            transmission: transmissionModeOf(t.provenance),
            opacity: opacityOf(t),
            reach: t.reach ?? 'single',
            survivingCopy: t.survivingCopy,
            description: t.description,
            era: String(t.era ?? 'modern'),
            artClass: String(t.class ?? classOf(t)),
            worldSupplyCeiling:
                ANCIENT_ARTS.find(a => a.techniqueId === t.id)?.worldSupplyCeiling ?? null,
            taughtBy: teachersOf(t.id),
            heldBy: heldByOf(t.id)
        }))
        .sort((a, b) =>
            gradeRank(b.grade) - gradeRank(a.grade)
            || b.requiredOrdinal - a.requiredOrdinal
            || a.name.localeCompare(b.name));
}

/**
 * The same relation from the other end: one house, and the library it opens.
 *
 * Both directions are built because a reader arrives from both. Someone
 * looking at an art wants to know who would teach it to them; someone looking
 * at a house wants to know what joining it would actually get them, and that
 * second question is the one an admission ordinal cannot answer.
 */
function buildTeaching(byId: ReadonlyMap<string, RegisterTechnique>): RegisterTeaching[] {
    return SECTS
        .filter(s => s.teaches.length > 0)
        .map(s => {
            const arts = s.teaches
                .map(id => byId.get(id))
                .filter((t): t is RegisterTechnique => t !== undefined)
                .map(t => ({ id: t.id, name: t.name, grade: t.grade, requiredOrdinal: t.requiredOrdinal }))
                .sort((a, b) =>
                    gradeRank(b.grade) - gradeRank(a.grade)
                    || b.requiredOrdinal - a.requiredOrdinal
                    || a.name.localeCompare(b.name));

            const sig = s.signatureTechniqueId ? byId.get(s.signatureTechniqueId) : undefined;

            return {
                id: s.id,
                name: s.name,
                ordinal: s.powerOrdinal,
                signature: sig ? { id: sig.id, name: sig.name, grade: sig.grade } : null,
                arts,
                // Surfaced rather than swallowed. A teach list naming an art
                // the catalog does not have is a house promising something
                // nobody can learn, and silently dropping the id would make
                // the sheet agree with the promise.
                unknownArtIds: s.teaches.filter(id => !byId.has(id))
            };
        })
        .sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));
}

/**
 * One house's library, off the same technique map the Arts tab is built from.
 *
 * Null rather than an empty shape where a house teaches nothing, because the
 * two are different facts: the Root Sill Court has no teach list at all and the
 * register must not print an empty curriculum at it as though the list had been
 * mislaid.
 */
function buildCurriculum(
    factionId: string,
    byId: ReadonlyMap<string, RegisterTechnique>
): RegisterCurriculum | null {
    const sect = getSect(factionId);
    if (!sect || sect.teaches.length === 0) return null;

    const arts = sect.teaches
        .map(id => byId.get(id))
        .filter((t): t is RegisterTechnique => t !== undefined)
        .map(t => ({
            id: t.id,
            name: t.name,
            grade: t.grade,
            category: t.category,
            element: t.element,
            reach: t.reach,
            requiredOrdinal: t.requiredOrdinal,
            // Derived from the teach lists rather than stated anywhere, so it
            // cannot drift: `taughtBy` is every faction that will teach the
            // art, and a list of one is a house holding something.
            onlyHere: t.taughtBy.length === 1,
            housesTeachingIt: t.taughtBy.length
        }))
        .sort((a, b) =>
            gradeRank(b.grade) - gradeRank(a.grade)
            || b.requiredOrdinal - a.requiredOrdinal
            || a.name.localeCompare(b.name));

    if (!arts.length) return null;

    // Most-taught first rather than alphabetical. What a library is mostly
    // about is the fact; which letter that word starts with is not.
    const byFrequency = (values: string[]): string[] => {
        const counts = new Map<string, number>();
        for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(e => e[0]);
    };

    const sig = sect.signatureTechniqueId ? byId.get(sect.signatureTechniqueId) : undefined;

    return {
        arts,
        signature: sig ? { id: sig.id, name: sig.name, grade: sig.grade, reach: sig.reach } : null,
        categories: byFrequency(arts.map(a => a.category)),
        elements: byFrequency(arts.map(a => a.element).filter((e): e is string => e !== null)),
        wide: arts.filter(a => a.reach !== 'single').map(a => ({ name: a.name, reach: a.reach })),
        hardest: { name: arts[0].name, grade: arts[0].grade, requiredOrdinal: arts[0].requiredOrdinal },
        exclusiveCount: arts.filter(a => a.onlyHere).length
    };
}

/**
 * Everything answering directly to one apex, courts and tenants in one list.
 *
 * Both tables, because they hold different halves and neither is a superset:
 * `COURTS[].apexId` names the courts, and `FACTION_PARENTAGE` names everything
 * that holds directly from the apex without being one - which on the Long Cut
 * is the Root Sill Court, a body the court table does not carry at all.
 * Deduped through `idsForFaction`, so a body with a row in both catalogs is one
 * subordinate rather than two.
 */
function answeredByOf(apexIds: readonly string[]): RegisterSubordinate[] {
    const under = new Set(apexIds);
    const seen = new Set<string>();
    const out: RegisterSubordinate[] = [];

    const push = (id: string, kind: string, cameFrom: string | null): void => {
        const key = idsForFaction(id)[0];
        if (seen.has(key)) return;
        seen.add(key);
        // Read through every id the body answers to: a court that is also a
        // sect files its grant terms under the sect id and its patron under the
        // court id, and looking only at the id we arrived by loses one of them.
        const terms = idsForFaction(id).map(x => getParentage(x)?.terms).find(Boolean) ?? null;
        out.push({
            id,
            name: nameOf(id),
            ordinal: ordinalOf(id),
            kind,
            cameFrom,
            paysNothing: terms !== null && terms.tributeStonesPerYear === 0 && terms.disciplesPerCycle === 0,
            stonesPerYear: terms?.tributeStonesPerYear ?? 0,
            renewal: terms?.renewal ?? null,
            linkId: null
        });
    };

    for (const court of COURTS) {
        if (under.has(court.apexId)) push(court.id, 'court', court.transferNote ?? null);
    }
    for (const p of Object.values(FACTION_PARENTAGE)) {
        if (p.parentFactionId !== null && under.has(p.parentFactionId)) push(p.factionId, p.relation, null);
    }

    return out.sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));
}

/**
 * The two numbers at the top of every entry, and what turns one into the other.
 *
 * `sectThreat` is the authority for both. Nothing here recomputes a rung: a
 * ceiling equal to the acting figure is reported as no ceiling at all, because
 * a house whose one-off is its everyday is a house with nothing held back, and
 * printing the same number twice would suggest otherwise.
 */
function buildFielded(factionId: string, acting: number): RegisterFielded {
    const threat = sectThreat(factionId);
    const character = getFactionCharacter(factionId);
    const p = character?.production;
    const raised = threat && threat.ceiling > threat.acting;

    return {
        acting,
        actingRank: rankName(acting),
        ceiling: raised ? threat.ceiling : null,
        ceilingRank: raised ? rankName(threat.ceiling) : null,
        wakeCondition: raised ? threat.wakeCondition : null,
        wakeCost: raised ? threat.wakeCost : null,
        ceilingIsPublic: threat?.sealedIsPublic ?? false,
        withdrawn: threat?.withdrawn
            ? {
                count: threat.withdrawn.count,
                occupiedBy: threat.withdrawn.occupiedBy,
                seats: threat.withdrawn.seats.map(x => ({ position: x.position, ordinal: x.ordinal }))
            }
            : null,
        canProjectLastRealm: canProjectLastRealm(factionId),
        produces: p
            ? {
                reliableOrdinal: p.reliableOrdinal,
                reliableRank: rankName(p.reliableOrdinal),
                currentCount: p.currentCount,
                peakOrdinal: p.peakOrdinal,
                peakRank: rankName(p.peakOrdinal),
                peakCount: p.peakCount,
                yearsSinceLastPeak: p.yearsSinceLastPeak,
                note: p.note,
                takesNobody: intakeRouteOf(factionId) === 'closed',
                gateOpensAt: getSect(factionId)?.admissionOrdinal ?? 0,
                // The strongest living member, which is the real bound on what
                // is available to somebody standing there now: past the end of
                // the house's shelf there is nothing but a person who has been
                // further, and this is the furthest person there is.
                taughtCeiling: acting,
                taughtCeilingRank: rankName(acting),
                everReached: furthestEverProducedHere(factionId)
            }
            : null
    };
}

/**
 * The furthest anybody produced inside this house ever went.
 *
 * Read off the ancestral roll rather than off `production`, because the two
 * answer different questions and the sheet was letting the second answer the
 * first. `peakOrdinal` is the best a house's PIPELINE ever did; this is the
 * best anybody who came out of it ever did, which on a handful of houses is a
 * completely different figure and on one of them is the whole entry.
 *
 * Ancestors with no recorded ordinal are skipped rather than counted as zero -
 * an absent field reading as zero is a mistake this repo has already made.
 */
function furthestEverProducedHere(
    factionId: string
): { ordinal: number; rank: string; name: string; yearsAgo: number } | null {
    const roll = SECT_ANCESTRY[factionId]?.ancestors ?? [];
    let best: { ordinal: number; rank: string; name: string; yearsAgo: number } | null = null;
    for (const a of roll) {
        if (a.realmOrdinal === null || a.realmOrdinal === undefined) continue;
        if (best === null || a.realmOrdinal > best.ordinal) {
            best = {
                ordinal: a.realmOrdinal,
                rank: rankName(a.realmOrdinal),
                name: a.name,
                yearsAgo: a.yearsAgo
            };
        }
    }
    return best;
}

/** Who it answers to, on what terms, and what it would cost to stop. */
function buildHoldsFrom(factionId: string): RegisterHoldsFrom | null {
    const p = getParentage(factionId);
    if (!p) return null;
    return {
        governance: p.governance,
        relation: p.relation,
        parentId: p.parentFactionId,
        parentName: p.parentFactionId ? nameOf(p.parentFactionId) : null,
        // Filled in the second pass, once the set of entries exists.
        parentLinkId: null,
        standing: p.standing,
        holds: p.holds,
        awarenessOfApex: p.awarenessOfApex,
        terms: p.terms
            ? {
                tributeStonesPerYear: p.terms.tributeStonesPerYear,
                inKind: [...p.terms.inKind],
                disciplesPerCycle: p.terms.disciplesPerCycle,
                buys: [...p.terms.buys],
                renewal: p.terms.renewal
            }
            : null,
        costOfIndependence: p.costOfIndependence,
        independenceStance: p.independenceStance,
        unbackedReason: p.unbackedReason,
        note: p.note
    };
}

/**
 * Everything one body stands in relation to, quoted whole from the catalog.
 *
 * Keyed on every id the body is filed under rather than on one of them, for the
 * reason every other join on this sheet is: a court that is also a sect has a
 * row in two tables, the ties were written against whichever id their author
 * had in front of them, and a single-id lookup silently drops half of them.
 */
function buildRelationships(factionId: string): RegisterRelationship[] {
    const tied = relationshipsOf(factionId, idsForFaction(factionId))
        .map(r => ({
            ...r,
            anchor: null as string | null,
            // What the two of them both have a hand on, read out of the tables
            // that already held it. A tie says how they get on; this says what
            // there is between them to get on ABOUT, and they are different
            // facts - the commonest contention in the world sits under a tie
            // whose warmth is `civil`.
            contestedOver: contentionBetween(factionId, r.otherId)
        }));

    // A CONTENTION IS NOT ALWAYS A TIE, and the two halves of the Kiln are the
    // case that proves it. Neither carries the other in `rivals`; neither has
    // an ambition; they have not corresponded in nine hundred years. They do
    // have an authored tie, so they would have survived this. Other pairs do
    // not: two houses drawing on one patron or teaching one road are contending
    // whether or not anybody ever wrote a relationship between them, and
    // dropping those would put the register back to reporting only what
    // somebody remembered to author.
    const already = new Set<string>();
    for (const r of tied) for (const id of idsForFaction(r.otherId)) already.add(id);

    const untied: RegisterRelationship[] = contendersWith(factionId)
        .filter(c => !already.has(c.otherId) && !idsForFaction(c.otherId).some(id => already.has(id)))
        .map(c => ({
            id: `contention-${factionId}-and-${c.otherId}`,
            otherId: c.otherId,
            otherName: c.otherName,
            // Level, because a contention on its own says nothing about the
            // ladder. Where the ladder is known, the tie above carries it.
            stance: 'alongside' as const,
            kind: 'contested_claim' as const,
            source: 'the contested claims' as const,
            what: c.over.map(o => o.what).join(' '),
            since: 'Undated. It is read off what both of them hold rather than off anything either of them wrote.',
            // No warmth is recorded because nothing recorded a relationship.
            // `distant` is the scale's word for exactly that - no ill will and
            // no contact, nobody maintains this one - and it is the honest
            // answer rather than a neutral placeholder.
            warmth: 'distant' as const,
            theirWarmth: 'distant' as const,
            howTheyPutIt: 'Neither body has said anything about the other that the catalog records.',
            andSoTheyDo: 'Nothing either of them has written down. What they have is the object below, and both of them have a hand on it.',
            grievance: null,
            anchor: null as string | null,
            contestedOver: c.over
        }));

    return [...tied, ...untied];
}

/**
 * The deep road a body holds, with the two rungs a reader needs beside it.
 *
 * `carriesTo` is not restated here - it is the technique layer's own function,
 * given the strongest teacher on the holding. Recomputing the rule would be a
 * second copy of it, and this is exactly the join where a second copy would
 * quietly disagree: the whole point of the block is that three of the four
 * houses cannot walk anybody to the end of their own road.
 */
function buildDeepRoad(factionId: string): RegisterDeepRoad | null {
    const holding = idsForFaction(factionId).map(id => deepRoadOf(id)).find(Boolean);
    if (!holding) return null;
    const art = getTechnique(holding.techniqueId);
    const strongest = holding.teachers.reduce((n, t) => Math.max(n, t.realmOrdinal), 0);
    const reach = carriesTo(strongest, holding.techniqueId) ?? strongest;
    return {
        ...holding,
        roadName: art?.name ?? holding.techniqueId,
        cap: art?.cap ?? null,
        capRank: art?.cap === null || art?.cap === undefined ? null : rankName(art.cap),
        carriesTo: reach,
        carriesToRank: rankName(reach),
        teachableEnd: teachableEndOf(holding.techniqueId),
        // Against the teachable end rather than against the cap. The book may
        // run past the highest rung anybody can be walked to, and a teacher
        // standing at that rung has finished the road whatever the paper says
        // after it.
        canFinishIt: (() => {
            const end = teachableEndOf(holding.techniqueId);
            return end === null ? true : reach >= end;
        })(),
        opening: art?.opening ?? null
    };
}

/** Reputation against capability, straight out of the character catalog. */
function buildCapability(factionId: string): RegisterCapability | null {
    const c = getFactionCharacter(factionId);
    if (!c) return null;
    return {
        practice: c.practice,
        knownAs: c.knownFor.outside,
        actuallyGoodAt: c.knownFor.actuallyGoodAt,
        theGap: c.knownFor.theGap,
        unitOfValue: c.unitOfValue,
        quietlyStopped: c.quietlyStopped ?? null,
        grievance: c.grievance,
        fear: c.fear,
        lateness: c.lateness,
        disagreement: c.disagreement,
        wrongAbout: c.wrongAbout,
        distinctSentence: c.distinctSentence
    };
}

/** The door: the bar, what clearing it takes, and what the rungs pay. */
function buildWayIn(factionId: string): RegisterWayIn | null {
    const sect = getSect(factionId);
    if (!sect) return null;
    const admission = SECT_ADMISSION[factionId];
    const house = getDaoHouse(factionId);
    return {
        intake: intakeRouteOf(factionId) ?? (sect.recruits ? 'open' : 'closed'),
        minOrdinal: admission?.minOrdinal ?? sect.admissionOrdinal,
        minRank: rankName(admission?.minOrdinal ?? sect.admissionOrdinal),
        guestFromOrdinal: admission?.guestFromOrdinal ?? null,
        // A dao house has no entrance requirement because it has no entrance.
        // Its route in is the adoption block, which the entry prints separately.
        requirement: admission?.requirement
            ?? (house ? 'No entrance requirement, because there is no entrance. See the route in below.' : ''),
        preferredRoots: [...(admission?.preferredRoots ?? [])],
        minInsight: admission?.minInsight ?? null,
        minMight: admission?.minMight ?? null,
        minCharm: admission?.minCharm ?? null,
        ladder: sect.ranks.map((rank, i) => ({ rank, stipend: sect.stipend[i] ?? 0 }))
    };
}

/**
 * What a reader should not take at face value.
 *
 * Every entry here is a disagreement the catalogs already record - a claim
 * against an audit of it, a one-off nobody outside knows about, a house that
 * has stopped doing the thing it is named for. The register states the
 * disagreement and does not adjudicate it.
 */
function buildFlags(factionId: string, fielded: RegisterFielded): RegisterFlag[] {
    const flags: RegisterFlag[] = [];

    const claim = auditAncestralClaim(factionId);
    if (claim) {
        flags.push({
            kind: claim.true ? 'claim stands' : 'claim is false',
            text: claim.true
                ? 'Claims an ancestor still above the Lid, and the claim is true. '
                    + `Last contact ${claim.recency.replace(/_/g, ' ')}; the parting gift is `
                    + (claim.giftIntact ? 'intact.' : 'spent.')
                : 'Claims an ancestor still above the Lid. The claim does not hold. '
                    + `Last contact ${claim.recency.replace(/_/g, ' ')}, the parting gift is `
                    + (claim.giftIntact ? 'intact' : 'spent')
                    + ', and what is discoverable is: ' + claim.traces.join('; ') + '.'
        });
    }

    if (fielded.ceiling !== null && !fielded.ceilingIsPublic) {
        flags.push({
            kind: 'ceiling not public',
            text: `Can reach ${fielded.ceiling} once and nobody outside the house knows it. `
                + 'Anybody pricing this faction off its acting figure is pricing it '
                + `${fielded.ceiling - fielded.acting} rungs low.`
        });
    }

    const character = getFactionCharacter(factionId);
    if (character?.quietlyStopped) {
        flags.push({ kind: 'stopped', text: character.quietlyStopped });
    }
    // `wrongAbout` deliberately does NOT go here. It is true of essentially
    // every house in the catalog, so flagging it made the flag count useless -
    // every card carried the marker and the marker stopped meaning anything.
    // It is a standing blind spot rather than a discrepancy, so it sits with
    // the other capability fields where a reader is already weighing the house.

    return flags;
}

/**
 * Trim a catalog field to its first sentence.
 *
 * Several of these fields run to a paragraph because they were written to be
 * read on their own. The synopsis needs the claim rather than the argument for
 * it, and the claim is reliably the first sentence.
 */
function firstSentence(s: string): string {
    const m = /^(.*?[.!?])(\s|$)/.exec(s.trim());
    return (m ? m[1] : s.trim()).trim();
}

/**
 * The claim a field is making, short enough to splice into a sentence.
 *
 * Two problems, one helper. Several of these fields open with a single word -
 * "Teaching.", "Disclosure.", "Recruiting." - and put the substance in the
 * sentence after it, so taking the first sentence alone produced a synopsis
 * that said "what it is actually best at is teaching" and stopped. Others run
 * to two hundred words, and splicing one whole turned the precis back into the
 * paragraph it exists to replace.
 *
 * So: take the first sentence; where that is only a label, take the second as
 * well but ONLY if the pair still fits, because a clipped pair is how this
 * produced "Standing inside the Guild is a count of." - a fragment that reads
 * as data loss. Nothing is ever cut mid-clause: it fits whole, or it is cut
 * back to the last comma that fits, or it is not taken.
 *
 *  is the length below which a first sentence is treated as a label
 * rather than an answer. Zero for a field whose label IS the answer -
 *  says "Successful batches." and means it.
 */
function claim(s: string, max: number, minUseful = 25): string {
    const parts = s.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    const first = (parts[0] ?? '').trim();
    const second = (parts[1] ?? '').trim();

    if (first.length >= minUseful) {
        if (first.length <= max) return first;
    } else if (second) {
        const pair = `${first} ${second}`;
        if (pair.length <= max) return pair;
        if (second.length <= max) return second;
    }

    // Too long whole. Cut back to the last clause boundary that fits, and
    // fall back to the last whole word only when there is no boundary at all.
    const source = first.length >= minUseful || !second ? first : second;
    if (source.length <= max) return source;
    const cut = source.slice(0, max);
    const boundary = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('; '), cut.lastIndexOf(' - '));
    const trimmed = boundary > max * 0.3
        ? cut.slice(0, boundary)
        // No clause boundary to cut at, so cut back to the last whole word -
        // and then keep going while the tail is a word no sentence can end on.
        // Without this the Gleaners' unit of value came out "honoured after a".
        : cut.replace(/\s+\S*$/, '')
            .replace(/(\s+(?:of|with|and|the|a|an|to|in|on|that|which|is|was|by|from|at|after|before))+$/i, '');
    return trimmed.trim();
}

/** Drop a trailing full stop so a fragment can be spliced into a sentence. */
function unperiod(s: string): string {
    return s.trim().replace(/\.+$/, '');
}

/**
 * Lowercase the first letter, unless the word is a name.
 *
 * Catalog fields are written as standalone sentences and start capitalised, so
 * splicing one into the middle of another needs the case fixed. A word that is
 * capitalised further along - "Frostmirror", "Nine Abyss" - is a proper noun
 * and is left alone, which is the cheap test that gets this right in practice.
 */
function spliceable(s: string): string {
    const t = s.trim();
    if (!t) return t;
    const firstWord = t.split(/\s+/)[0].replace(/[^A-Za-z]/g, '');
    const isName = firstWord.length > 1
        && firstWord[0] === firstWord[0].toUpperCase()
        && /[A-Z]/.test(firstWord.slice(1));
    if (isName) return t;
    return t.charAt(0).toLowerCase() + t.slice(1);
}

/**
 * As much of a field as fits, in whole sentences rather than one.
 *
 * `claim` takes the first sentence and stops, which is right where the rest of
 * the paragraph is the argument for it and wrong where the second sentence is
 * the operative half. The Frostmirror's admission reads "A mutated ice root,
 * verified at the gate." and then "No other applicant is admitted, ever." - the
 * first without the second is a preference rather than a bar, and taking only
 * the first said the wrong thing about the single most characterful house in
 * the catalog.
 */
function upTo(s: string, max: number): string {
    const parts = s.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    let out = '';
    for (const part of parts) {
        const next = out ? `${out} ${part}` : part;
        if (next.length > max) break;
        out = next;
    }
    return out || claim(s, max);
}

/** "a", "a and b", "a, b and c". */
function series(items: readonly string[]): string {
    if (items.length <= 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Exactly one full stop at the end, whatever the pieces arrived with.
 *
 * Half the material spliced below is a whole catalog sentence and half is a
 * fragment, and joining the two kinds by hand produced "...is not the door most
 * people come through.." on every entry with a quoted requirement. Punctuation
 * is not the interesting part of this file and it should not be hand-managed.
 */
function sentence(s: string): string {
    const t = s.trim().replace(/\s+([.,;:])/g, '$1');
    if (!t) return '';
    return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Small counts as words, larger ones as digits.
 *
 * The sheet is numeric everywhere it is measuring something, and these are not
 * measurements - "One of 3 institutions above the map" reads as a table cell
 * that escaped. Anything past nine is rare enough here that the digit is
 * clearer than the word.
 */
const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = (n: number): string => SMALL[n] ?? String(n);

/** Whether a name may be said in front of somebody who has just started. */
const hidden = (awareness: string): boolean => awareness === 'unaware' || awareness === 'whisper';

/**
 * What kind of body this is, in one noun, from how it holds what it holds.
 *
 * Read off `relation` rather than off the name, because the names lie in both
 * directions: the Root Sill Court is a sect and the Kiln Wardens were a court
 * for nine hundred years while everybody called them an eccentric local order.
 */
function kindNoun(d: SectDossier): string {
    if (d.apex) return 'institution above the map';
    if (d.house) return 'dao house';
    if (d.asCourt) return 'court';
    // The catalog draws a line here that costs nothing to keep and everything
    // to lose: an unbacked house is TOLERATED and pays for it continuously, and
    // an unassailable one is not being tolerated by anybody, because the
    // question does not arise. Reading `relation` alone printed the second as
    // the first on the strongest acting faction in the world.
    if (d.holdsFrom?.governance === 'unassailable') return 'unassailable house';
    switch (d.holdsFrom?.relation) {
        case 'court': return 'court';
        case 'administration': return 'administration';
        case 'contracted': return 'contractor';
        case 'unaffiliated': return 'unbacked house';
        // NOT "dao house". `outside` means holds no vein by nature, which is
        // true of the seven houses and of Lantern Hall, which is not one - and
        // calling it one printed a family and an adoption door onto a sect with
        // an ordinary gate and a literacy test.
        default: return 'house';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// THE PRECIS
//
// Four things, in the order somebody deciding about a faction needs them:
// what it is and what its people can actually do, what it can put in front of
// you, who it answers to and who answers to it, and the one fact that would
// change how you deal with it.
//
// ASSEMBLED from catalog fields, never written - but assembled by judgement
// rather than poured into a frame, and that distinction is the whole of this
// rewrite. The version it replaces spliced every faction in the world into one
// fixed sentence shape, which produced two failures the frame could not see:
// the Long Cut opened on a definition of what driven ground is, because
// `administers` happened to be first in the frame, and it closed on the string
// "Instability:" pasted in front of a sentence, because the last slot had a
// label. A frame cannot decide what leads. Deciding what leads is the work.
//
// Three rules hold in every line below.
//
//   Identity first.   Not geography, not a landlord, not a rung. A reader who
//                     does not know the setting has to finish the first
//                     sentence knowing what kind of thing this is, and a reader
//                     who does has to learn something from it.
//   No field labels.  No sentence begins with the name of a field, and no
//                     clause is shaped so that a reader can see the slot.
//   Quote, never characterise. The catalogs are opinionated already. "The arts
//                     kill everyone else" is a fact with a source; "highly
//                     selective" is the register inventing an assessment voice,
//                     and this file is not allowed one.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What it is: the kind of body, who it stands under, and the shape of its own
 * ladder.
 *
 * An apex gets a different opening from a sect for a real reason rather than a
 * stylistic one. What is worth knowing first about a house in the pyramid is
 * whose pyramid it is in; what is worth knowing first about the three at the
 * top is that they are at the top, how old that is, and whether a person
 * starting out is even permitted to know the name. `startingAwareness` had
 * never once reached the page, and it is the fact that governs everything
 * about how two of the three behave.
 */
function identityLine(d: SectDossier): string {
    if (d.apex) {
        const a = d.apex;
        const age = a.heritage === 'ancient'
            ? 'held so long that nobody can date it'
            : 'young enough to date exactly';
        const reach = hidden(a.startingAwareness)
            ? 'and a beginner cannot name it, because the name has never been said in front of them'
            : 'and it is the one of them a beginner can name, walk to, and be refused by in person';
        return `One of ${count(a.ofHowMany)} institutions above the map, ${age}, `
            + `answering to nobody because there is nobody above it - ${reach}.`;
    }

    const kind = kindNoun(d);
    const opening = `${/^[aeiou]/i.test(d.alignment) ? 'An' : 'A'} ${d.alignment} ${kind}`;

    const h = d.holdsFrom;
    const under = h && h.parentName
        ? `under ${h.parentName}`
            + (h.standing === 'strained' || h.standing === 'probationary' || h.standing === 'lapsed'
                ? ` on ${h.standing.replace(/_/g, ' ')} terms`
                : '')
        : h && h.governance === 'unassailable'
            ? 'holding its ground outright and paying nobody, because nothing that could be sent could take it'
            : h && h.governance === 'unbacked'
                ? 'holding no vein from anybody and paying for that continuously'
            : h && h.relation === 'outside'
                // Not poverty and not independence: a body that sells a service
                // has no use for a vein and is outside the pyramid rather than
                // at the bottom of it.
                ? 'holding no vein by nature, because what it sells is not ground'
                : 'holding what it holds outright, on no grant from anyone';

    // The ladder, because its shape is identity: six rungs with names for each
    // is a sect, four titles covering five provinces is an institution that
    // decided ranking people was not interesting, and the two are not the same
    // kind of body even where the ordinals match.
    const ladder = d.titles.length > 1
        ? `, ${count(d.titles.length)} rungs from ${d.titles[0]} to ${d.titles[d.titles.length - 1]}`
        : '';

    // A body that is also a court, where the catalog records how it became one.
    // Two courts in the world moved and the difference between them is the
    // whole point: one was handed between patrons and one was promoted inside
    // one, and the note says which in its own first sentence.
    const asCourt = d.asCourt?.transferNote
        ? `, and ${spliceable(unperiod(claim(d.asCourt.transferNote, 130)))}`
        : '';

    // One element across a whole library is the strongest single statement a
    // teach list makes, and it is a statement about what the house IS.
    const c = d.curriculum;
    const throughout = c && c.elements.length === 1 && c.arts.length >= 3
        && c.arts.every(a => a.element === c.elements[0])
        ? ` - and ${c.elements[0]} end to end, because every art on its list is ${c.elements[0]}`
        : '';

    return sentence(`${opening} ${under}${ladder}${asCourt}${throughout}`);
}

/**
 * What its people can actually do, with the arts named.
 *
 * Off the same technique map the Arts tab is built from, so a house's stated
 * curriculum is always the one the arts catalog holds. Naming them matters more
 * than counting them: five ids is a number, and the frost needle, the tomb
 * slash, the rimeglass carapace, the mirror displacement and the stillness
 * canon is a house.
 *
 * Who it refuses rides on the same sentence rather than on its own, because on
 * the houses where the door is the characteristic fact the two are one fact.
 */
function curriculumLine(d: SectDossier): string | null {
    const c = d.curriculum;
    const w = d.wayIn;

    // The door, and the catalog's own words for it wherever it has them. A
    // requirement field is already a whole sentence, so it is dropped in with
    // no frame at all - "A mutated ice root, verified at the gate. No other
    // applicant is admitted, ever." needs nothing in front of it, and anything
    // put there would be the register talking over the catalog.
    const door = ((): string => {
        if (!w) return '';
        if (w.intake === 'closed') return 'It takes nobody, under any circumstances.';
        if (w.intake === 'adoption') return 'There is no admission day and no applicant: the way in is adoption.';
        return w.requirement
            ? sentence(upTo(w.requirement, 210))
            : sentence(`It looks at anybody from ${w.minOrdinal} up`);
    })();

    if (!c) {
        const a = d.apex;
        if (a) {
            // An apex with no teach list still ranks its people, and how it does
            // that IS the introduction to what kind of institution it is. Four
            // titles covering every practitioner in five provinces says more
            // about the Long Cut than any figure on the sheet.
            const ladder = d.titles.length
                ? `${count(d.titles.length)} titles cover everybody in it - ${series(d.titles)} - and `
                : '';
            return sentence(`${ladder}${spliceable(unperiod(claim(a.rankNote, 200)))}`);
        }
        // Teaching nothing is not a hole in the data. It is what the Root Sill
        // Court and the Hollow Court are, and silence here would read as a
        // teach list the register mislaid.
        const nothing = 'It hands nothing over: no teach list, no signature art, and nobody comes here to learn.';
        return door ? `${nothing} ${door}` : nothing;
    }

    const top = c.hardest;
    const under = c.arts.filter(a => a.name !== top?.name).slice(0, 5).map(a => a.name);
    const rest = c.arts.length - 1 - under.length;

    const body = `${count(c.arts.length)} art${c.arts.length === 1 ? '' : 's'}`
        + (top ? `, topped by ${top.name} at ${top.grade} grade and written for ${top.requiredOrdinal}` : '')
        + (under.length
            ? rest > 0
                ? `, and under it ${under.join(', ')}, and ${count(rest)} more`
                : `, and under it ${series(under)}`
            : '')
        + (c.signature && c.signature.name !== top?.name
            ? `; the one it is known for is ${c.signature.name}`
            : '')
        // Reach separates an art that kills a man from one that clears a
        // courtyard, and no faction entry has ever carried it.
        + (c.wide.length
            ? `. ${count(c.wide.length).charAt(0).toUpperCase()}${count(c.wide.length).slice(1)} of them `
                + `land${c.wide.length === 1 ? 's' : ''} on more than one person: `
                + series(c.wide.map(x => `${x.name} on ${x.reach === 'field' ? 'a whole place' : 'several'}`))
            : '');

    return door ? `${sentence(body)} ${door}` : sentence(body);
}

/**
 * What it can put in front of you today, against what it could produce once.
 *
 * The pair the whole entry turns on, and the two figures are deliberately
 * different: one answers a challenge this afternoon and the other costs the
 * house that spends it. A reserve is stated as its own number and never as a
 * distance above the acting figure, because it is routinely level with the
 * house and sometimes under it - the Pavilion's protector stands at 41 against
 * a living head of 41 - and "N above" would be false on both.
 */
function forceLine(d: SectDossier): string {
    const f = d.fielded;
    const a = d.apex;

    if (a) {
        // One at the last realm and unable to leave the object is the whole of
        // what an apex is, and it is why the ordinal at the top of the sheet
        // does not mean a last-realm cultivator can be dispatched.
        const seat = `${count(a.lastRealmCount)} at the last realm, pinned`
            + (d.artifacts.length ? ` to an object rated ${d.artifacts[0].power}` : '')
            + `, the next strongest at ${a.secondSeat}`
            // Age runs backwards on the storehouse and it is the one capability
            // axis the three apexes actually differ on: an ancient position
            // comes with an empty one, because every crisis in a thousand years
            // was survived by spending something nobody can make any more.
            + `, and a storehouse the catalog calls ${a.stock.replace(/_/g, ' ')}`;
        return sentence(`It answers at ${f.acting} (${f.actingRank}) with nothing held back: ${seat}`)
            + ` ${sentence(upTo(a.depthNote, 200))}`;
    }

    let head = `It answers at ${f.acting} (${f.actingRank})`;

    const sealed = d.people.sealed;
    if (f.ceiling !== null) {
        // Its own number, never a distance above the acting figure: a reserve
        // is routinely level with its house and sometimes under it, and a
        // ceiling everybody knows about is a deterrent while one nobody knows
        // about is an ambush. The sheet has to say which.
        head += `, and could put ${f.ceiling} into the world once`
            + (sealed ? ` - ${sealed.name}, ${sealed.dormantYears.toLocaleString()} years under the seal` : '')
            + (f.ceilingIsPublic
                ? ', and rivals can be assumed to know it is there'
                : ', and nobody outside the house knows it is there, so anybody pricing it off the first '
                    + `figure is ${count(f.ceiling - f.acting)} rungs low`);
    } else if (sealed) {
        // A seal that raises nothing is still the most consequential thing in
        // the building, and the old entry printed "holds nothing back" over it.
        const where = sealed.ordinal === f.acting
            ? 'level with the living head, so waking him buys a second body rather than a stronger one'
            : `${f.acting - sealed.ordinal} rungs under the living head`;
        head += ` with nothing held back above it: what is sealed underneath stands at ${sealed.ordinal}, ${where}`;
    } else {
        head += ' with nothing held back';
    }

    // What it can MAKE, as against what it happens to contain. A house can
    // stand at a rung because somebody walked in; this is the number that says
    // whether it will still be standing there in a century.
    const p = f.produces;
    const makes = p
        ? p.reliableOrdinal === 0
            // Not a missing figure. Four factions in the catalog produce nobody
            // at all, and printing "reaches 0" reads as data loss rather than
            // as the most consequential fact about a house of that kind.
            ? '. From its own intake it produces nobody, and never has'
            : `. From its own intake it reaches ${p.reliableOrdinal}, with `
                + (p.currentCount > 0 ? `${count(p.currentCount)} at or above it` : 'nobody currently at or above it')
                + (p.yearsSinceLastPeak > 0
                    ? `; its best ever was ${p.peakOrdinal}, ${p.yearsSinceLastPeak.toLocaleString()} years ago`
                    : `; ${p.peakOrdinal} is its best ever and it has one standing now`)
        : '';

    const withdrawn = f.withdrawn
        ? `. ${count(f.withdrawn.count)} of its seats are out of the world entirely`
        : '';

    return sentence(`${head}${makes}${withdrawn}`)
        // The one place a mid-string sentence break is assembled rather than
        // quoted, so the capital has to be put back by hand.
        .replace(/\. ([a-z])/g, (_, ch: string) => `. ${ch.toUpperCase()}`);
}

/**
 * Who it answers to, who answers to it, and who is standing in its way.
 *
 * The place the sheet was flattest, because governance, standing and a tribute
 * figure describe a lease and not every arrangement in the catalog is one. Two
 * of them are not: a grant that costs no stones and owes no disciples and has
 * no renewal document is not a tenancy at all, and rendering it with the same
 * three fields as a tenancy says something false about both parties. So the
 * terms are read before they are printed, and where they come to nothing the
 * catalog's own account of why is quoted instead.
 */
function answeringLine(d: SectDossier): string | null {
    const said: string[] = [];
    const a = d.apex;
    const h = d.holdsFrom;

    // ── upward ───────────────────────────────────────────────────────────
    if (h && h.parentName === null && h.costOfIndependence) {
        // Independence that was bought once and never contested since is a
        // different arrangement from independence nobody has got round to
        // ending, and the note is where the catalog says which.
        // The first sentence of the note only. It is reliably the state of
        // affairs and the rest is the commentary, and leaving room here is what
        // lets the entry go on to say who answers to the house and what the
        // house is reaching for - which on the Pavilion are the same lapsed
        // grant seen from two directions, and dropping either halves it.
        said.push(sentence(`It pays nobody for the ground it stands on: ${spliceable(upTo(h.note, 200))}`));
    } else if (h && h.parentName !== null) {
        const t = h.terms;
        // Only where it is a warning. `good` and `not_applicable` are the two
        // ordinary states and printing them says nothing a reader can use.
        const standing = h.standing === 'strained' || h.standing === 'probationary' || h.standing === 'lapsed'
            ? ` on ${h.standing.replace(/_/g, ' ')} terms`
            : '';
        if (t && t.tributeStonesPerYear === 0 && t.disciplesPerCycle === 0) {
            // Not a lease, whatever the governance column says. A grant that
            // takes nothing in either direction is a house holding something
            // for a house it is part of, and rendering it with the tribute
            // vocabulary describes an administration that is not there.
            said.push(sentence(
                `It holds from ${h.parentName}${standing} for no stones and no disciples, `
                + `and its renewal clause reads: ${upTo(t.renewal, 240)}`
            ));
        } else if (t) {
            const pays = [
                t.tributeStonesPerYear > 0 ? `${t.tributeStonesPerYear.toLocaleString()} stones a year` : '',
                t.disciplesPerCycle > 0
                    ? `${count(t.disciplesPerCycle)} disciple${t.disciplesPerCycle === 1 ? '' : 's'} a cycle`
                    : ''
            ].filter(Boolean);
            said.push(sentence(
                `It holds from ${h.parentName}${standing} for ${series(pays)}`
                + (t.buys.length ? `, which buys ${spliceable(unperiod(claim(t.buys[0], 170)))}` : '')
            ));
        } else {
            said.push(sentence(`It holds from ${h.parentName}${standing}, on no terms the catalog records`));
        }
    }

    // ── how it can be paid ───────────────────────────────────────────────
    //
    // Only where there is no door, which is the condition rather than the tier:
    // a house you can join answers "how do I deal with it" by having a gate, and
    // the Pavilion has one. The two that do not are the two a reader has exactly
    // one question about, and `unitOfValue` is the whole of the answer - the
    // Survey's says it cannot be paid at all and that anybody arriving with an
    // offer has already misunderstood the room.
    if (a && d.capability && d.wayIn === null) {
        said.push(sentence(
            'Nobody joins it, so the only thing worth knowing about dealing with it is what it counts: '
            + spliceable(upTo(d.capability.unitOfValue, 230))
        ));
    }

    // ── downward ─────────────────────────────────────────────────────────
    if (a && a.answeredBy.length) {
        const under = series(a.answeredBy.map(s => `${s.name} at ${s.ordinal}`));
        const free = a.answeredBy.filter(s => s.paysNothing);
        const terms = free.find(s => s.renewal)?.renewal ?? null;

        // Where nothing under it pays anything, the arrangement is not a
        // pyramid of grants and must not be drawn as one.
        // The contrast the sheet was flattening. Two of the three apexes are
        // administrations and hold what is under them by grant, tribute and the
        // threat of not renewing; one of them takes nothing from either of its
        // own, and rendering both as the same pyramid says something false
        // about all six bodies involved.
        const stones = a.answeredBy.reduce((n, s) => n + s.stonesPerYear, 0);
        const cost = free.length === a.answeredBy.length && terms
            ? `, and ${spliceable(unperiod(upTo(terms, 130)))}`
            : stones > 0
                ? `, for ${stones.toLocaleString()} stones a year between them`
                : '';
        said.push(sentence(`${under} answer${a.answeredBy.length === 1 ? 's' : ''} to it${cost}`));

    }

    // ── who is in the way ────────────────────────────────────────────────
    const blockers = d.ambition?.blockedBy.map(b => b.name) ?? [];
    if (blockers.length) {
        said.push(sentence(
            `What it is reaching for - ${spliceable(unperiod(upTo(d.ambition!.wants, 190)))} - `
            + `runs through ${series(blockers)}`
        ));
    }

    // ── and last, where a subordinate came from ──────────────────────────
    //
    // Last because it is the one thing here that is also said in full on the
    // subordinate's own entry. On the Long Cut it survives and it is the most
    // characterful fact the sheet holds about the house; on the Pavilion it is
    // dropped in favour of what the Pavilion itself is reaching for, which is
    // the right trade in both directions.
    if (a) {
        const moved = a.answeredBy.find(s => s.cameFrom);
        if (moved) said.push(sentence(`${moved.name} did not start here. ${upTo(moved.cameFrom!, 200)}`));
    }

    if (!said.length) return null;

    // Budgeted rather than counted. One long quoted clause is worth two short
    // derived ones, and a fixed sentence count spent the whole answer on a
    // renewal note on exactly the entries with the most to say.
    let out = '';
    for (const s of said) {
        const next = out ? `${out} ${s}` : s;
        if (out && next.length > 700) break;
        out = next;
    }
    return out;
}

/**
 * The one fact that would change how a reader deals with it.
 *
 * A judgement about usefulness rather than about the faction, in a fixed
 * priority: a claim an audit does not support beats a house that has quietly
 * stopped doing what it is named for, which beats what is actually holding an
 * apex in place, which beats the sentence the catalog wrote to be the one thing
 * true of this house and nothing else in the world.
 *
 * `instability` is real intelligence and the old entry buried it under a pasted
 * label. It is a complete sentence in the catalog with its subject in front of
 * it, so it needs no frame at all - the Long Cut's says the Nail cannot be
 * moved and therefore neither can the institution, which is the single most
 * useful thing anybody could know before dealing with it.
 */
function decisiveLine(d: SectDossier): string | null {
    const falseClaim = d.flags.find(x => x.kind === 'claim is false');
    if (falseClaim) return firstSentence(falseClaim.text) + ' The claim does not hold.';

    const stopped = d.flags.find(x => x.kind === 'stopped');
    if (stopped) return `What it has quietly stopped doing, and has not said so: ${spliceable(unperiod(upTo(stopped.text, 220)))}.`;

    // No frame at all. `instability` is already whole sentences with their
    // subjects in front of them, and the label this replaces - the string
    // "Instability:" pasted in front of a sentence - was the thing the designer
    // could see through the prose from across the room.
    if (d.apex) return upTo(d.apex.instability, 340);

    if (d.capability?.distinctSentence) return d.capability.distinctSentence;

    if (d.ambition?.movedOn) return `Nothing has moved on it beyond this: ${spliceable(unperiod(claim(d.ambition.movedOn, 200)))}.`;

    return null;
}

/**
 * Three or four sentences that leave a reader able to place a faction.
 *
 * Capped at five entries and floored at three. Where a house has more to say
 * than fits, what goes is the lowest of the four questions rather than the tail
 * of a paragraph, because half of the fourth answer is worse than none of it.
 */
function buildSynopsis(d: SectDossier): string[] {
    return [
        identityLine(d),
        curriculumLine(d),
        forceLine(d),
        answeringLine(d),
        decisiveLine(d)
    ]
        .filter((s): s is string => s !== null && s.trim().length > 0)
        // Several of these open on a spliced catalog fragment, which arrives
        // lowercase because it was written to sit in the middle of a sentence.
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .slice(0, 5);
}

/**
 * The same four questions, for a body that is an office rather than a faction.
 *
 * A court panel opened on `administers`, which on a body whose entire job is
 * administering something is a definition rather than an introduction. What a
 * reader needs first is that this is somebody else's office rather than a
 * house: nobody joins it, nobody is anybody's disciple in it, and the person
 * who answers for it stands somewhere quite different inside the institution
 * that posted them than they do on the ladder.
 */
function buildCourtSynopsis(court: RegisterCourt): string[] {
    const out: string[] = [];
    const answering = court.officers.find(o => o.answersForTheCourt);

    out.push(
        `An office of ${court.apexName} rather than a house - ${count(court.officers.length)} posts, `
        + `nobody's disciples, and no ladder between them - `
        + (hidden(court.startingAwareness)
            ? 'and a beginner has never heard the name, because a court is exactly as nameable as the apex above it.'
            : 'and a beginner may be told the name, because a court is exactly as nameable as the apex above it.')
    );

    out.push(sentence(
        (answering
            ? `${answering.name}, ${answering.title}, at ${answering.ordinal}, is the one who answers for it - `
                + `${answering.apexRank} inside ${court.apexName}, which is a different standing entirely - and what`
            : 'The catalog names nobody who answers for it, and what')
        + ` it apportions is ${spliceable(unperiod(claim(court.administers, 220)))}`
    ));

    if (court.transferNote) {
        // No word of the sheet's own. One of the two moves was a transfer
        // between patrons and the other a promotion inside one, and the note
        // says which in its own first sentence.
        out.push(upTo(court.transferNote, 260));
    }

    out.push(court.highWaterMark
        ? `${court.highWaterMark.name} got furthest, to ${court.highWaterMark.ordinal}, `
            + `${court.highWaterMark.yearsAgo.toLocaleString()} years ago, and `
            + (court.highWaterMark.end === 'attempted'
                ? 'went up alone and attempted the crossing.'
                : 'declined it, dying of old age at a rung nobody has stood on since.')
        : 'Nobody here has ever reached the last realm, which is the ordinary case and is the whole '
            + 'difference between a court and an apex: an apex has somebody up there sitting on what a '
            + 'founder sent down, and a court does not.');

    return out.slice(0, 5);
}

/** A faction's ambition, with everybody it names resolved to a faction. */
function buildAmbition(factionId: string): RegisterAmbition | null {
    const ambition = getSect(factionId)?.ambition;
    if (!ambition) return null;
    return {
        wants: ambition.wants,
        blockedBy: ambition.blockedBy.map(id => ({ id, name: nameOf(id), ordinal: ordinalOf(id), linkId: null })),
        wouldCost: ambition.wouldCost,
        // Both directions. `contestedWith` is symmetric in the catalog, and
        // reading only this side's list would print a claim as a statement
        // rather than as two parties with their hands on one object.
        contestedWith: contestedClaimsOf(factionId).map(other => ({
            id: other.id,
            name: other.name,
            ordinal: other.powerOrdinal,
            wants: other.ambition?.wants ?? 'nothing the catalog records',
            linkId: null
        })),
        movedOn: ambition.movedOn
    };
}

/** The family and the door, for the seven houses that have one. */
function buildHouse(factionId: string): RegisterHouseAdmission | null {
    const house = getDaoHouse(factionId);
    if (!house) return null;
    return {
        surname: house.houseSurname,
        route: house.admission.route,
        prodigyIn: house.admission.prodigyIn,
        marriage: house.admission.marriage,
        surrendered: house.admission.surrendered,
        naming: house.admission.naming,
        lastTaken: house.admission.lastTaken,
        costOfTheForm: house.admission.costOfTheForm
    };
}

/**
 * Every faction, as one tree.
 *
 * Roots are ordered by acting ordinal, so an apex heads the list because it is
 * strongest rather than because it is an apex. A faction that holds from nobody
 * is a root with no children, which is the honest drawing of it: independence
 * is not a separate category of thing, it is a branch that stops immediately.
 *
 * A court is a node rather than a label because a court is a real intermediary:
 * it issues the grant, it arbitrates, and losing it would not be the same event
 * as losing the apex. Sub-tenancies hang off the sect that granted them, which
 * is the shape the parentage table holds and the shape a flat register loses.
 */
function buildStack(dossierIds: ReadonlySet<string>): StackNode[] {
    /**
     * An apex may be filed under two ids; so may a court.
     *
     * Through `idsForFaction` rather than by matching names. One body can hold
     * a row in two catalogs at once - the Pavilion is an apex and a sect, the
     * Kiln and the Azure Mist are courts and sects - and the catalogs say so in
     * a field, so the sheet asks instead of stripping a leading "The" off two
     * strings and hoping they agree.
     */
    const linkFor = (id: string): string | null =>
        idsForFaction(id).find(candidate => dossierIds.has(candidate)) ?? null;

    /**
     * Everything holding from this body, under every id the body answers to.
     *
     * The parentage table is keyed by whichever id its author had in front of
     * them, and for a house with two rows that is not always the same one: the
     * Pavilion's own tenants are filed under its sect id, and the Azure Mist's
     * are filed under the sect id of a court. Resolving the parent through
     * `idsForFaction` is what makes those tenants hang off the one node that is
     * actually their landlord instead of off a second copy of it.
     *
     * The second filter is the other half of the same fact. A body must never
     * be drawn as its own tenant, which is what happens the moment its two ids
     * both appear in one branch.
     */
    const childrenOf = (parentId: string): StackNode[] => {
        const ids = new Set(idsForFaction(parentId));
        return Object.values(FACTION_PARENTAGE)
            .filter(p => p.parentFactionId !== null && ids.has(p.parentFactionId))
            .filter(p => !ids.has(p.factionId))
            .map(p => ({
                id: p.factionId,
                name: nameOf(p.factionId),
                ordinal: ordinalOf(p.factionId),
                standing: p.standing,
                linkId: linkFor(p.factionId),
                children: childrenOf(p.factionId)
            }))
            .sort((a, b) => b.ordinal - a.ordinal);
    };

    const claimed = new Set<string>();
    const roots: StackNode[] = APEX_INSTITUTIONS
        .map(apex => {
            const courts = COURTS.filter(c => c.apexId === apex.id);

            /**
             * Every id the courts under this apex answer to.
             *
             * A court that is also a sect is a parentage child of this apex in
             * its own right, so without this it is drawn twice: once as the
             * court and once as an ordinary tenant, at two different ordinals,
             * with its own tenants hanging off the copy. That was the bug -
             * the pyramid was being read out of `COURTS` and out of
             * `FACTION_PARENTAGE` with nothing joining the two.
             */
            const asCourts = new Set(courts.flatMap(c => idsForFaction(c.id)));

            return {
                id: apex.id,
                name: apex.name,
                ordinal: apex.powerOrdinal,
                standing: 'not_applicable',
                linkId: linkFor(apex.id),
                children: [
                    ...courts.map(c => ({
                        id: c.id,
                        name: c.name,
                        ordinal: c.powerOrdinal,
                        standing: 'not_applicable',
                        linkId: linkFor(c.id),
                        children: childrenOf(c.id)
                    })),
                    // Held direct, with no court in between. Rare, and worth
                    // seeing. `childrenOf` already covers both of the apex's
                    // own ids, so a house granted from under its sect row is
                    // not lost.
                    ...childrenOf(apex.id).filter(n => !asCourts.has(n.id))
                ].sort((a, b) => b.ordinal - a.ordinal)
            };
        });

    // Anything already drawn somewhere in the tree must not appear again at the
    // root, or the Pavilion would be listed twice: once as an apex and once as
    // a faction that holds from nobody, which are the same fact said twice.
    const walk = (n: StackNode): void => {
        claimed.add(n.id);
        if (n.linkId) claimed.add(n.linkId);
        n.children.forEach(walk);
    };
    roots.forEach(walk);

    for (const p of Object.values(FACTION_PARENTAGE)) {
        if (p.parentFactionId) continue;
        if (claimed.has(p.factionId)) continue;
        roots.push({
            id: p.factionId,
            name: nameOf(p.factionId),
            ordinal: ordinalOf(p.factionId),
            standing: p.standing,
            linkId: linkFor(p.factionId),
            children: []
        });
    }

    return roots.sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));
}

/**
 * Everybody at or above Grand Ascension, from every catalog at once.
 *
 * A faction whose acting ordinal sits in the band contributes a seat rather
 * than a name, unless an apex records one. That is not a shortcut: the sect
 * catalog stores a number for its strongest member and no identity for them,
 * and the honest rendering of that is a row which says so.
 */
function buildHighBand(rows: RegisterRow[], sealedList: RegisterSealed[]): HighPerson[] {
    const out: HighPerson[] = [];

    for (const apex of APEX_INSTITUTIONS) {
        out.push({
            name: apex.lastRealm.holderName ?? leaderTitleOf(apex),
            named: apex.lastRealm.holderName !== null,
            ordinal: apex.powerOrdinal,
            rank: rankName(apex.powerOrdinal),
            state: 'pinned',
            alive: true,
            ordinalNote: null,
            factionId: apex.id,
            factionName: apex.name,
            factionOrdinal: apex.powerOrdinal,
            note: apex.lastRealm.note
        });
        if (apex.secondStrongestOrdinal >= HIGH_BAND_FLOOR) {
            out.push({
                name: secondTitleOf(apex),
                named: false,
                ordinal: apex.secondStrongestOrdinal,
                rank: rankName(apex.secondStrongestOrdinal),
                state: 'acting',
                alive: true,
                ordinalNote: null,
                factionId: apex.id,
                factionName: apex.name,
                factionOrdinal: apex.powerOrdinal,
                note: apex.depthNote
            });
        }
    }

    // A court is an office, but somebody holds it, and that person is in the
    // band. Listed as a seat rather than a name for the same reason as the rest:
    // the catalog stores a realm for the office and no identity for the holder.
    for (const court of COURTS) {
        const hwm = court.highWaterMark;
        if (hwm) {
            out.push({
                name: hwm.name,
                named: true,
                ordinal: hwm.ordinal,
                ordinalNote: null,
                rank: rankName(hwm.ordinal),
                state: hwm.end === 'attempted' ? 'failed the crossing' : 'declined the crossing',
                alive: false,
                factionId: court.id,
                factionName: court.name,
                factionOrdinal: court.powerOrdinal,
                note: hwm.yearsAgo.toLocaleString() + ' years ago. ' + hwm.note
            });
        }

        if (court.powerOrdinal < HIGH_BAND_FLOOR) continue;
        // A court's ordinal is defined as the strongest officer who will answer,
        // so it names a person rather than an office. Before the rosters landed
        // the sheet had only the office to print and said `unnamed`; it now has
        // the person, and the office is what goes beside them.
        const holder = strongestOfficerOf(court);
        out.push({
            name: holder.name,
            named: true,
            ordinal: court.powerOrdinal,
            rank: rankName(court.powerOrdinal),
            state: 'acting',
            alive: true,
            ordinalNote: null,
            factionId: court.id,
            factionName: court.name,
            factionOrdinal: court.powerOrdinal,
            note: holder.title.replace(/^the /, '').replace(/^./, ch => ch.toUpperCase())
                + ' (' + holder.apexRank + ' inside '
                + (getApexInstitution(court.apexId)?.name ?? court.apexId) + '). '
                + holder.office
        });
    }

    for (const row of rows) {
        // Already emitted above from the apex catalog. Matched on the id the
        // apex catalog now carries for its own sect row, so the Pavilion is
        // recognised as itself rather than as two houses with similar names.
        if (APEX_INSTITUTIONS.some(a => a.factionId === row.id || a.id === row.id)) continue;
        const withdrawn = WITHDRAWN_POWERS[row.id];

        if (row.ordinal >= HIGH_BAND_FLOOR) {
            if (withdrawn) {
                // Every seat, with the rung it actually stands on. Second and
                // Third share one, which is the age tiebreak visible in the
                // data: equal ordinals, younger seat first.
                for (const seat of withdrawn.seats) {
                    out.push({
                        name: seat.position,
                        named: false,
                        ordinal: seat.ordinal,
                        ordinalNote: null,
                        rank: rankName(seat.ordinal),
                        state: 'withdrawn',
                        alive: true,
                        factionId: row.id,
                        factionName: row.name,
                        factionOrdinal: row.ordinal,
                        note: seat.position === 'Third Seat'
                            ? 'Holds the north mountain. ' + withdrawn.occupiedBy
                            : withdrawn.occupiedBy
                    });
                }
            } else {
                const top = MEMBERS
                    .filter(m => m.factionId === row.id && m.outlier)
                    .sort((a, b) => b.realmOrdinal - a.realmOrdinal)[0];
                out.push({
                    name: top?.name ?? 'strongest member',
                    named: top !== undefined,
                    ordinal: row.ordinal,
                    rank: row.rank,
                    state: 'acting',
                    alive: true,
                    ordinalNote: null,
                    factionId: row.id,
                    factionName: row.name,
                    factionOrdinal: row.ordinal,
                    note: top
                        ? top.rank + '. ' + top.detail
                        : 'The catalog records the realm and not the person. Whoever holds it answers for the faction.'
                });
            }
        }

    }

    for (const sl of sealedList) {
        if (sl.ordinal < HIGH_BAND_FLOOR) continue;
        out.push({
            name: sl.name,
            named: true,
            ordinal: sl.ordinal,
            rank: rankName(sl.ordinal),
            state: 'sealed',
            alive: true,
            ordinalNote: null,
            factionId: sl.hostId,
            factionName: sl.hostName,
            factionOrdinal: sl.hostOrdinal,
            note: sl.sealGrade + ' seal, sealed as a ' + sl.sealReason.replace(/_/g, ' ') + ', '
                + sl.dormantYears.toLocaleString() + ' years. '
                + (sl.publiclyKnown ? 'Known.' : 'Not publicly known.')
                + ' Wakes on: ' + sl.wakeCondition
        });
    }

    for (const [hostId, record] of Object.entries(SECT_ANCESTRY)) {
        for (const a of record.ancestors) {
            if (a.fate !== 'ascended') continue;
            if ((a.realmOrdinal ?? 0) < HIGH_BAND_FLOOR) continue;
            out.push({
                name: a.name,
                named: true,
                ordinal: a.realmOrdinal as number,
                rank: rankName(a.realmOrdinal as number),
                state: a.afterCrossing === 'died_above' ? 'died above' : 'ascended',
                alive: a.afterCrossing !== 'died_above',
                ordinalNote: null,
                factionId: hostId,
                factionName: nameOf(hostId),
                factionOrdinal: getSect(hostId)?.powerOrdinal ?? 0,
                note: a.yearsAgo.toLocaleString() + ' years ago. '
                    + (a.afterCrossing === 'died_above'
                        ? 'Crossed, and did not survive what was up there. '
                        : 'Crossed, and is still above. ')
                    + a.rememberedFor
            });
        }
    }

    // Every house that has produced a crossing, which is not the same as a
    // founder - most of these are people the house made rather than people who
    // made the house. The Court has produced
    // six. None of them are in SECT_ANCESTRY, because none of those bodies is a
    // sect, so the ascended half of this page was missing them entirely.
    //
    // Only the most recent is named. A house that produced six across four
    // thousand years does not remember six people - it remembers the last one
    // and a number - so the rest are carried as a count, which is what the
    // catalog actually holds.
    //
    // Whether they are still up there is derived rather than guessed: an
    // answering channel means somebody above the Lid is picking up. That is what
    // the channel IS. A body whose channel still answers has at least one
    // founder alive on the other side.
    for (const standing of LINEAGE_STANDINGS) {
        const alreadyNamed = (SECT_ANCESTRY[standing.factionId]?.ancestors ?? [])
            .filter(a => a.fate === 'ascended').length;
        const unnamed = standing.count - alreadyNamed;
        if (unnamed <= 0) continue;

        const channel = IMMORTAL_CHANNELS.find(c => c.factionId === standing.factionId);
        const answering = channel?.kind === 'answering_channel';
        // Somebody who crossed is a True Immortal, and only that. The Immortal
        // realm has two rungs and the crossing lands on one of them: 45 is the
        // attempt that did not complete, and a False Immortal is by definition
        // still down here. Reading the top tier's first ordinal - which is what
        // this used to do - would file every ascended founder in the world
        // under the outcome they did not have.
        const ordinal = TRUE_IMMORTAL_ORDINAL;

        out.push({
            name: standing.mostRecentCrossingName ?? `${unnamed} who crossed`,
            named: standing.mostRecentCrossingName !== null,
            ordinal,
            rank: rankName(ordinal),
            state: answering ? 'ascended' : 'ascended, unheard',
            alive: answering,
            ordinalNote: null,
            factionId: standing.factionId,
            factionName: nameOf(standing.factionId),
            factionOrdinal: getSect(standing.factionId)?.powerOrdinal
                ?? getApexInstitution(standing.factionId)?.powerOrdinal
                ?? 0,
            note: `Crossed ${standing.mostRecentCrossingYearsAgo.toLocaleString()} years ago, the most recent this house has produced. `
                + (standing.mostRecentCrossingNote ? standing.mostRecentCrossingNote + ' ' : '')
                + (unnamed > 1
                    ? `${unnamed - 1} earlier crossing${unnamed === 2 ? '' : 's'} from this house, and the names have gone. `
                    : '')
                + (answering
                    ? 'The channel still answers, which is how the sheet knows somebody is up there: an answering channel is somebody picking up.'
                    : 'Nothing has answered in a long time, and the sheet does not claim to know why.')
        });
    }

    // The wanderers sit in this table on their ordinal like everybody else,
    // rather than in a block of their own. That is the point of them: a False
    // Immortal is at 45, which is above every Tribulation Transcendence name in
    // the world, and filing him separately would hide the one fact about him
    // that matters to somebody reading down the column.
    //
    // The state column says what he is doing. The rank column already says what
    // he is - `rankName(45)` is "False Immortal" - and it also carries, by way
    // of the Key, that the Lid does not open twice. A state of "came back,
    // barred" said both of those again and nothing else, which left the column
    // empty on the one row a reader is most curious about.
    //
    // What the rank cannot say is that nothing on this page holds him. Every
    // other person in this table is somewhere in an institution: acting for
    // one, pinned by one, withdrawn inside one, sealed under one. He is in none
    // of them, which is a fact about everybody else - there is no faction
    // behind him and nobody to petition afterwards.
    for (const w of WANDERERS) {
        if (w.lastOrdinal < HIGH_BAND_FLOOR) continue;
        const cameBack = w.crossingOutcome === 'false_immortal';
        out.push({
            name: w.recordName,
            named: true,
            ordinal: w.lastOrdinal,
            rank: rankName(w.lastOrdinal),
            // Every wanderer is at large, including the one carrying a rank.
            // The affiliation on these records is a roll entry with nothing
            // attached in either direction - the catalog's own word for what it
            // amounts to is "nothing" - so the faction column names the roll he
            // is on and the state column says, correctly, that it does not hold
            // him. Reading `affiliation` as membership here would put the one
            // person no institution controls under the same word as the people
            // who answer for theirs.
            state: 'at large',
            alive: true,
            ordinalNote: null,
            factionId: w.affiliation?.factionId ?? null,
            factionName: w.affiliation ? nameOf(w.affiliation.factionId) : 'none',
            factionOrdinal: w.affiliation ? getSect(w.affiliation.factionId)?.powerOrdinal ?? 0 : 0,
            note: 'Called ' + w.commonName + '. Crossed ' + w.crossingYearsAgo.toLocaleString()
                + ' years ago and did not complete it.'
                + (cameBack
                    ? ' Walks the world at a rung no institution on this page can field, and is held by'
                        + ' none of them: no sect, no court, no seal, no sponsor, nobody to answer to'
                        + ' and nobody to answer for him.'
                    : '')
        });
    }

    return out.sort((a, b) =>
        Number(b.alive) - Number(a.alive)
        || b.ordinal - a.ordinal
        || a.factionName.localeCompare(b.factionName));
}

/**
 * Attach every person and object in the world to the faction that holds them.
 *
 * Sorted by acting ordinal because that is the order somebody reads a register
 * in: strongest first, and everything about that faction before the next one
 * starts. Factions with nobody named and nothing buried still get an entry - an
 * empty dossier is a fact about a sect, and omitting it would quietly make the
 * world look better staffed than it is.
 */
function buildDossiers(
    rows: RegisterRow[],
    sealed: RegisterSealed[],
    channels: WorldRegister['channels'],
    /**
     * The arts catalog, already resolved for the Arts tab.
     *
     * Passed down rather than looked up again, so a house's stated curriculum
     * and the arts sheet are the same read of the same rows. Two lookups would
     * be two answers inside a week - the teach lists are actively moving as
     * orphaned arts are given teachers.
     */
    techniquesById: ReadonlyMap<string, RegisterTechnique>
): SectDossier[] {
    const fromSects = rows.map(row => {
        const sect = getSect(row.id);
        // Every id this house answers to. One house can have a row in the apex
        // catalog and a row in the sect catalog - the Pavilion does - and each
        // of the tables below was written against whichever of the two its
        // author had in front of them. Keying on a single id silently drops
        // that house's court, its channel and its artifacts from its own entry.
        const ids = idsForFaction(row.id);
        const has = (id: string | null | undefined): boolean =>
            id !== null && id !== undefined && ids.includes(id);

        const record = ids.map(id => SECT_ANCESTRY[id]).find(Boolean);
        const ancestors = record?.ancestors ?? [];
        const apex = APEX_INSTITUTIONS.find(a => has(a.id) || has(a.factionId));
        const channel = channels.find(c => has(c.factionId)) ?? null;
        const withdrawn = ids.map(id => WITHDRAWN_POWERS[id]).find(Boolean) ?? null;
        const mine = sealed.find(x => has(x.hostId)) ?? null;
        const fielded = buildFielded(row.id, row.ordinal);

        return {
            id: row.id,
            name: row.name,
            ordinal: row.ordinal,
            rank: row.rank,
            alignment: row.alignment,
            admissionOrdinal: row.admissionOrdinal,
            recruits: row.recruits,
            intake: intakeRouteOf(row.id) ?? (row.recruits ? 'open' : 'closed'),
            governance: row.governance,
            standing: row.standing,
            parentName: row.parentId ? nameOf(row.parentId) : null,
            territory: sect?.territory ?? '',
            description: sect?.description ?? '',
            titles: [...(sect?.ranks ?? [])],
            specialities: [...(sect?.specialities ?? [])].map(String),
            curriculum: buildCurriculum(row.id, techniquesById),
            deepRoad: buildDeepRoad(row.id),
            // Filled in the second pass: it reads the assembled blocks below.
            synopsis: [],
            fielded,
            holdsFrom: buildHoldsFrom(row.id),
            relationships: buildRelationships(row.id),
            capability: buildCapability(row.id),
            // Null where the body is a posting, and the null is the fact
            // rather than the view hiding something: there is no way in,
            // because there is no application anybody could make. `posting`
            // carries what replaces it - see `RegisterPosting`.
            wayIn: getParentage(row.id)?.posting ? null : buildWayIn(row.id),
            flags: buildFlags(row.id, fielded),
            // A court that is also a sect: the apex's name for the posting,
            // shown beside the name everybody actually uses.
            alsoKnownAs: COURTS.find(c => c.embodiedByFactionId === row.id)?.name ?? null,
            asCourt: ((): SectDossier['asCourt'] => {
                const court = COURTS.find(c => c.embodiedByFactionId === row.id);
                return court
                    ? {
                        name: court.name,
                        administers: court.administers,
                        transferNote: court.transferNote ?? null,
                        apexName: getApexInstitution(court.apexId)?.name ?? court.apexId
                    }
                    : null;
            })(),
            ceiling: row.sealedCeiling,
            apex: apex
                ? {
                    giftName: apex.sentDown.name,
                    heritage: apex.heritage,
                    stock: apex.stock.remaining,
                    secondSeat: apex.secondStrongestOrdinal,
                    seatNote: apex.lastRealm.note,
                    instability: apex.instability,
                    startingAwareness: apex.startingAwareness,
                    lastRealmCount: apex.lastRealm.count,
                    depthNote: apex.depthNote,
                    rankNote: apex.rankNote,
                    ofHowMany: APEX_INSTITUTIONS.length,
                    answeredBy: answeredByOf(idsForFaction(apex.id))
                }
                : null,
            channel: channel
                ? {
                    kind: channel.kind,
                    crossings: channel.crossings,
                    tier: channel.tier,
                    depletion: channel.depletion
                }
                : null,
            withdrawn: withdrawn
                ? { count: withdrawn.count, occupiedBy: withdrawn.occupiedBy }
                : null,
            holdings: IMMORTAL_HOLDINGS
                .filter(h => has(h.factionId))
                .map(h => ({
                    item: IMMORTAL_ITEMS.find(i => i.id === h.itemId)?.name ?? h.itemId,
                    count: h.count,
                    byGrade: { ...h.byGrade }
                })),
            partingGift: record?.partingGift
                ? { name: record.partingGift.name, intact: record.partingGift.intact }
                : null,
            // Filled in after the dossier list exists, because an artifact row
            // carries a link to its owner's entry and the set of entries is not
            // known until every dossier has been made.
            artifacts: [] as RegisterArtifact[],
            ambition: buildAmbition(row.id),
            history: buildHistory(row.id),
            demonic: buildDemonic(row.id),
            posting: buildPosting(getParentage(row.id)?.posting),
            noPlaceForItsOwn: buildNoPlace(row.id),
            // The apex stance has to be looked up by faction id, not skipped:
            // the one apex with a sect row is rendered from `rows` rather than
            // from the apex-only builder, and it is the apex whose answer to
            // this question matters most.
            passerby: buildPasserby(row.id),
            favour: buildFavour(
                row.id,
                APEX_INSTITUTIONS.find(a => a.factionId === row.id)?.whetherItsWordSkipsABar ?? null
            ),
            house: buildHouse(row.id),
            people: {
                active: rollOf(row.id).map(entry => {
                    // The thin roll row plus whatever its own catalog carries.
                    // The join is by id rather than by name, because a roll is
                    // a union and two catalogs spell people differently.
                    const member = MEMBERS.find(m => m.id === entry.id);
                    const court = getHollowCourtMember(entry.id);
                    return {
                        name: entry.name,
                        rank: entry.rank,
                        ordinal: entry.realmOrdinal,
                        role: member?.role ?? (court ? 'on the road' : 'office'),
                        wants: entry.doing,
                        detail: member?.detail ?? court?.detail ?? '',
                        source: entry.source,
                        worksOutsideAs: court?.worksOutsideAs ?? null,
                        knownForBefore: court?.knownForBefore ?? null,
                        askedOf: court?.whatIsAskedOfThem ?? null
                    };
                }),
                sealed: mine,
                sealedOnTheRoll: mine ? rollNoteFor(ancestors, mine) : null,
                ascended: ancestors
                    .filter(a => a.fate === 'ascended')
                    .map(a => ({
                        name: a.name,
                        ordinal: a.realmOrdinal,
                        yearsAgo: a.yearsAgo,
                        rememberedFor: a.rememberedFor
                    })),
                terminal: ancestors
                    .filter(a => a.fate === 'dead' || a.fate === 'lost')
                    .map(a => ({
                        name: a.name,
                        fate: a.fate,
                        ordinal: a.realmOrdinal,
                        yearsAgo: a.yearsAgo,
                        rememberedFor: a.rememberedFor
                    }))
            }
        };
    });

    // The Deep Survey and the Long Cut hold no sect row because they are not
    // sects. Synthesising an entry for them is not padding: they are the first
    // and second factions on this list, and a register whose top two entries are
    // missing describes a different world.
    //
    // An apex that DOES have a sect row is not synthesised, and the test for
    // that is `factionId` rather than a name comparison. The Pavilion used to be
    // caught by stripping "The " off both spellings, which worked until one of
    // them was renamed and would then have produced the same house twice.
    const covered = new Set(fromSects.map(d => d.id));
    const apexOnly: SectDossier[] = APEX_INSTITUTIONS
        .filter(a => !covered.has(a.id) && !(a.factionId && covered.has(a.factionId)))
        .map(a => ({
            id: a.id,
            name: a.name,
            ordinal: a.powerOrdinal,
            rank: rankName(a.powerOrdinal),
            // Read off the apex rather than defaulted. It used to be a hard
            // 'neutral' here, which asserted that the top of the world has no
            // politics - and the Azure Cloud Pavilion is righteous, holds the
            // position against the other two, and had that fact disappear the
            // moment the sheet read it as an apex rather than as a house.
            alignment: a.alignment,
            admissionOrdinal: 0,
            recruits: false,
            intake: 'closed',
            governance: 'apex',
            standing: 'not_applicable',
            parentName: null,
            territory: a.holds,
            description: a.description,
            // The apex ladder, which is the same field a sect's is: four titles
            // covering five provinces and six rungs covering one mountain are
            // the same column, and the difference between them is the reading.
            titles: a.ranks.map(r => r.title),
            specialities: [],
            curriculum: a.factionId ? buildCurriculum(a.factionId, techniquesById) : null,
            // Read on the apex id as well as the faction id, because the two
            // apexes with no sect row have no curriculum at all and their road
            // is the only shelf they have.
            deepRoad: buildDeepRoad(a.id),
            synopsis: [],
            // An apex is not sealed and holds nothing back, so its ceiling is
            // its acting figure: the one at the last realm is seated, awake,
            // and the whole posture of the institution is built on never
            // needing to move them. The depth below is the second seat.
            fielded: {
                acting: a.powerOrdinal,
                actingRank: rankName(a.powerOrdinal),
                ceiling: null,
                ceilingRank: null,
                wakeCondition: null,
                wakeCost: null,
                ceilingIsPublic: false,
                withdrawn: null,
                canProjectLastRealm: a.lastRealm.count > 1,
                produces: {
                    reliableOrdinal: a.secondStrongestOrdinal,
                    reliableRank: rankName(a.secondStrongestOrdinal),
                    currentCount: a.lastRealm.count,
                    peakOrdinal: a.powerOrdinal,
                    peakRank: rankName(a.powerOrdinal),
                    peakCount: a.lastRealm.count,
                    yearsSinceLastPeak: 0,
                    note: a.depthNote,
                    // An apex with no sect row has no gate at all; one with a
                    // sect row is read through it.
                    takesNobody: a.factionId === null || intakeRouteOf(a.factionId) === 'closed',
                    gateOpensAt: a.factionId ? getSect(a.factionId)?.admissionOrdinal ?? 0 : 0,
                    taughtCeiling: a.powerOrdinal,
                    taughtCeilingRank: rankName(a.powerOrdinal),
                    everReached: a.factionId ? furthestEverProducedHere(a.factionId) : null
                }
            },
            holdsFrom: buildHoldsFrom(a.id),
            relationships: buildRelationships(a.id),
            capability: buildCapability(a.id) ?? (a.factionId ? buildCapability(a.factionId) : null),
            wayIn: a.factionId ? buildWayIn(a.factionId) : null,
            flags: [
                { kind: 'what could end it', text: a.instability },
                // A body nobody can join is one a reader has exactly one
                // question about - how it can be paid - and for a while this
                // sheet could not answer it for the two hidden apexes, because
                // neither had a row in the character catalog and the register
                // is not allowed to invent a `unitOfValue`. Both have one now.
                // The flag stays as a guard rather than as a report: if a
                // future apex arrives without a character row, its entry says
                // so instead of printing a silence a reader would take for an
                // institution that trades in nothing.
                ...(buildCapability(a.id) ?? (a.factionId ? buildCapability(a.factionId) : null)
                    ? []
                    : [{
                        kind: 'nothing recorded',
                        text: 'The character catalog has no row for this institution, so the register '
                            + 'cannot say what it counts in and therefore cannot say how it can be paid. '
                            + 'That is a hole in the data rather than an institution that trades in nothing, '
                            + 'and it is stated here so nobody reads the silence as an answer.'
                    }])
            ],
            alsoKnownAs: null,
            asCourt: null,
            ceiling: null,
            apex: {
                giftName: a.sentDown.name,
                heritage: a.heritage,
                stock: a.stock.remaining,
                secondSeat: a.secondStrongestOrdinal,
                seatNote: a.lastRealm.note,
                instability: a.instability,
                startingAwareness: a.startingAwareness,
                lastRealmCount: a.lastRealm.count,
                depthNote: a.depthNote,
                rankNote: a.rankNote,
                ofHowMany: APEX_INSTITUTIONS.length,
                answeredBy: answeredByOf(idsForFaction(a.id))
            },
            channel: (channels.find(c => c.factionId === a.id) ?? null) && {
                kind: channels.find(c => c.factionId === a.id)!.kind,
                crossings: channels.find(c => c.factionId === a.id)!.crossings,
                tier: channels.find(c => c.factionId === a.id)!.tier,
                depletion: channels.find(c => c.factionId === a.id)!.depletion
            },
            withdrawn: null,
            holdings: IMMORTAL_HOLDINGS
                .filter(h => h.factionId === a.id)
                .map(h => ({
                    item: IMMORTAL_ITEMS.find(i => i.id === h.itemId)?.name ?? h.itemId,
                    count: h.count,
                    byGrade: { ...h.byGrade }
                })),
            partingGift: null,
            artifacts: [] as RegisterArtifact[],
            ambition: buildAmbition(a.id),
            history: buildHistory(a.id),
            demonic: buildDemonic(a.id),
            posting: buildPosting(getParentage(a.id)?.posting),
            noPlaceForItsOwn: buildNoPlace(a.id),
            passerby: buildPasserby(a.factionId ?? a.id),
            favour: buildFavour(a.factionId ?? a.id, a.whetherItsWordSkipsABar),
            house: null,
            people: {
                active: [
                    {
                        name: a.lastRealm.holderName ?? leaderTitleOf(a),
                        rank: rankName(a.powerOrdinal),
                        ordinal: a.powerOrdinal,
                        role: 'pinned',
                        wants: 'not to be required elsewhere',
                        detail: a.lastRealm.note,
                        source: 'the apex catalog',
                        worksOutsideAs: null,
                        knownForBefore: null,
                        askedOf: null
                    },
                    {
                        name: secondTitleOf(a),
                        rank: rankName(a.secondStrongestOrdinal),
                        ordinal: a.secondStrongestOrdinal,
                        role: 'senior',
                        wants: 'the position to hold without anybody testing what is behind it',
                        detail: a.depthNote,
                        source: 'the apex catalog',
                        worksOutsideAs: null,
                        knownForBefore: null,
                        askedOf: null
                    }
                ],
                sealed: null,
                sealedOnTheRoll: null,
                ascended: [],
                terminal: []
            }
        }));

    return [...fromSects, ...apexOnly].sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));
}

/**
 * Assemble the whole sheet from the catalogs.
 *
 * Pure apart from the timestamp: no database, no run, no player. The register
 * describes the world, not a game in progress, which is why it is safe to call
 * before a run exists and why two calls a second apart agree.
 */
export function buildRegister(): WorldRegister {
    const rows: RegisterRow[] = SECTS.map(sect => {
        const parentage = FACTION_PARENTAGE[sect.id];
        const threat = sectThreat(sect.id);
        return {
            id: sect.id,
            name: sect.name,
            ordinal: sect.powerOrdinal,
            rank: rankName(sect.powerOrdinal),
            realm: realmForOrdinal(sect.powerOrdinal).name,
            alignment: sect.alignment,
            admissionOrdinal: sect.admissionOrdinal,
            recruits: sect.recruits,
            governance: parentage?.governance ?? 'unrecorded',
            standing: parentage?.standing ?? 'not_applicable',
            parentId: parentage?.parentFactionId ?? null,
            // Only report a ceiling that is genuinely higher. Not everything
            // sealed raises one, and claiming otherwise would overstate a host
            // whose sealed ancestor is weaker than its own elders.
            sealedCeiling: threat && threat.ceiling > threat.acting ? threat.ceiling : null,
            isDaoHouse: sect.id.startsWith('house-')
        };
    }).sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));

    const apexes: RegisterApex[] = APEX_INSTITUTIONS.map(a => ({
        id: a.id,
        name: a.name,
        ordinal: a.powerOrdinal,
        secondStrongestOrdinal: a.secondStrongestOrdinal,
        heritage: a.heritage,
        stock: a.stock.remaining,
        startingAwareness: a.startingAwareness,
        giftName: a.sentDown.name,
        instability: a.instability,
        courts: COURTS.filter(c => c.apexId === a.id)
            .map(c => ({ id: c.id, name: c.name, ordinal: c.powerOrdinal }))
    })).sort((x, y) => y.ordinal - x.ordinal);

    const sealed: RegisterSealed[] = Object.entries(SECT_ANCESTRY)
        .flatMap(([hostId, record]) => {
            const d = record.dormant;
            if (!d) return [];
            return [{
                hostId,
                hostName: nameOf(hostId),
                hostOrdinal: getSect(hostId)?.powerOrdinal ?? 0,
                name: d.name,
                ordinal: d.realmOrdinal,
                sealGrade: d.sealGrade,
                sealReason: d.sealReason,
                publiclyKnown: d.publiclyKnown,
                dormantYears: d.dormantYears,
                wakeCondition: d.wakeCondition,
                restingPlace: d.restingPlace,
                whoTheyAre: d.whoHeIs ?? null,
                sealedBefore: d.sealedBeforeTheCrossing ?? null,
                knowsWhatFor: d.andHeKnowsWhatHeIsFor ?? null,
                resourcesWent: d.andTheResourcesWentSomewhere ?? null
            }];
        })
        .sort((a, b) => b.ordinal - a.ordinal);

    const channels = IMMORTAL_CHANNELS.map(ch => {
        const standing = LINEAGE_STANDINGS.find(s => s.factionId === ch.factionId);
        return {
            factionId: ch.factionId,
            name: nameOf(ch.factionId),
            kind: ch.kind,
            crossings: standing?.count ?? 0,
            tier: standing?.tier ?? null,
            depletion: standing?.depletion ?? null,
            mostRecentCrossingYearsAgo: standing?.mostRecentCrossingYearsAgo ?? null
        };
    }).sort((a, b) => b.crossings - a.crossings);

    // The arts first, because the faction entries are built out of them. A
    // house's curriculum and the Arts tab are one read of one catalog: build
    // them separately and the two drift, and a house's stated library stops
    // being the one anybody can actually go and learn.
    const techniques = buildTechniques();
    const techniquesById = new Map(techniques.map(t => [t.id, t]));
    const teaching = buildTeaching(techniquesById);

    const dossiers = buildDossiers(rows, sealed, channels, techniquesById);

    // Second pass, and it has to be one: an artifact row says which entry on
    // this sheet its owner opens, and the entries do not exist until now.
    const dossierIds = new Set(dossiers.map(d => d.id));
    const artifacts = buildArtifacts();
    const artifactById = new Map(artifacts.map(a => [a.id, a]));
    /** The entry a faction, court or apex id opens, or null where none does. */
    const entryFor = (id: string): string | null =>
        idsForFaction(id).find(candidate => dossierIds.has(candidate)) ?? null;

    /**
     * The anchor on this page where a body's own account can be read.
     *
     * Two shapes, because two kinds of body get drawn: a faction entry, and a
     * court panel on a body with no faction row. Resolving through the faction
     * table alone reached only the first, which on the one contested lineage in
     * the catalog meant the half with no faction entry made a claim the reader
     * could not go and answer.
     */
    /**
     * The three bodies with no place for their own members' children.
     *
     * Built here rather than inline in the return, because the anchors are
     * filled in the second pass and a literal inside the returned object cannot
     * be reached from it.
     */
    /**
     * The favour, arranged as the three comparisons that are worth making.
     *
     * Built here rather than inline, because the anchors are filled in the
     * second pass once the entries exist. The three lists are derived from the
     * catalog rather than written out, so a house whose bar changes moves
     * between them on its own.
     */
    const heading = (key: string): string => key
        .replace(/([A-Z]+)/g, ' $1')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim()
        .replace(/^./, c => c.toUpperCase());

    const favourRows = {
        noBarToSpeakOf: SECTS
            .filter(x => favourStanceOf(x.id)?.answer === 'no bar to speak of')
            .map(x => ({ id: x.id, name: x.name, anchor: null as string | null })),
        movesForOne: SECTS
            .filter(x => favourStanceOf(x.id)?.answer === 'yes, at a price')
            .map(x => ({
                id: x.id,
                name: x.name,
                anchor: null as string | null,
                bar: SECT_ADMISSION[x.id]?.minOrdinal ?? x.admissionOrdinal
            }))
            .sort((a, b) => b.bar - a.bar),
        willNotMove: willNotBeMoved().map(f => ({
            id: f.factionId,
            name: nameOf(f.factionId),
            anchor: null as string | null,
            why: f.why
        })),
        apexes: Object.entries(THE_APEXES_THAT_TRADE)
            .map(([key, text]) => ({ key, heading: heading(key), text: String(text) })),
        theNewborn: Object.entries(A_NEWBORN_WITH_POTENTIAL)
            .map(([key, text]) => ({ key, heading: heading(key), text: String(text) }))
    };

    const noPlaceRows = NO_PLACE_FOR_THEIR_OWN.map(x => ({
        factionId: x.factionId,
        name: nameOf(x.factionId),
        anchor: null as string | null,
        reason: x.reason as string,
        whyItCannotKeepThem: x.whyItCannotKeepThem,
        whereTheChildGoes: x.whereTheChildGoes,
        whatTheChildKnows: x.whatTheChildKnows,
        andWhetherItIsPermanent: x.andWhetherItIsPermanent,
        whatItCostsTheParent: x.whatItCostsTheParent
    }));

    const anchorFor = (id: string): string | null => {
        const entry = entryFor(id);
        if (entry) return `faction-${entry}`;
        return getCourt(id) ? `court-${id}` : null;
    };

    for (const d of dossiers) {
        d.artifacts = artifactsOwnedBy(d.id)
            .map(a => artifactById.get(a.id))
            .filter((a): a is RegisterArtifact => a !== undefined);
        for (const a of d.artifacts) a.ownerLinkId = d.id;

        // Everybody an ambition names is somebody with an entry on this sheet,
        // and a register that prints "blocked by the Third Sill Court" without
        // a way to go and read the Third Sill Court is making the reader search
        // for it by eye.
        if (d.ambition) {
            for (const b of d.ambition.blockedBy) b.linkId = entryFor(b.id);
            for (const o of d.ambition.contestedWith) o.linkId = entryFor(o.id);
        }
        // Same for everybody named in a shared event, and for the same reason:
        // the accounts are partisan by construction, so each has to be one
        // click from the others.
        if (d.history) {
            for (const e of d.history.shared) {
                for (const o of e.others) o.anchor = anchorFor(o.id);
            }
        }
        if (d.holdsFrom?.parentId) d.holdsFrom.parentLinkId = entryFor(d.holdsFrom.parentId);
        // A relationship names a second body by construction, so every row in
        // the section has to be one click from the other side of itself. That
        // is not a convenience: the two sides are allowed to feel differently
        // about the same tie, and a reader who cannot reach the other entry has
        // only been shown half of it.
        for (const r of d.relationships) r.anchor = anchorFor(r.otherId);
        if (d.apex) for (const s of d.apex.answeredBy) s.linkId = entryFor(s.id);
        // Last, because it reads every block above it - including the artifacts,
        // which is why this cannot move above the assignment two lines up.
        d.synopsis = buildSynopsis(d);
    }

    // The three bodies with no place for their own, each linked to its own
    // entry, because that section is a comparison and a reader has to be able
    // to get from it to any of the three.
    for (const x of noPlaceRows) x.anchor = anchorFor(x.factionId);
    for (const x of favourRows.noBarToSpeakOf) x.anchor = anchorFor(x.id);
    for (const x of favourRows.movesForOne) x.anchor = anchorFor(x.id);
    for (const x of favourRows.willNotMove) x.anchor = anchorFor(x.id);

    // The same for the artifact table's owner column, where the id may belong
    // to a body filed under a different one.
    for (const a of artifacts) {
        if (a.ownerLinkId === null && a.ownerId !== null) a.ownerLinkId = entryFor(a.ownerId);
    }

    const trackedItems = buildItemsRegister();
    const courts = buildCourts();
    // Courts get the same treatment for the same reason. A court with no
    // faction row is still a body other entries link to, and the one contested
    // lineage in the catalog has exactly that shape on one of its two sides.
    for (const c of courts) {
        for (const r of c.relationships) r.anchor = anchorFor(r.otherId);
    }

    return {
        generatedAt: new Date().toISOString(),
        counts: {
            factions: rows.length,
            apexes: apexes.length,
            courts: COURTS.length,
            sealed: sealed.length,
            wanderers: WANDERERS.length,
            immortalObjects: IMMORTAL_HOLDINGS.reduce((n, h) => n + h.count, 0),
            artifacts: artifacts.length,
            courtOfficers: courts.reduce((n, c) => n + c.officers.length, 0),
            techniques: techniques.length,
            untaughtTechniques: techniques.filter(t => t.taughtBy.length === 0).length,
            itemKinds: trackedItems.counts.kinds,
            catalogued: trackedItems.rows.length
        },
        repairMedicine: buildRepairMedicineRegister(),
        trackedItems,
        whatEachHouseHolds: buildHoldings(dossiers),
        ladder: REALM_TIERS.map(t => ({
            key: t.key, name: t.name, start: t.ordinalStart, end: t.ordinalEnd
        })),
        apexes,
        rows,
        sealed,
        channels,
        items: IMMORTAL_ITEMS.map(i => ({
            id: i.id,
            name: i.name,
            form: i.form,
            effect: i.effect,
            knownCount: i.knownCount,
            everKnown: i.everKnown,
            knownByGrade: { ...i.knownByGrade },
            grades: { higher: i.grades.higher, middle: i.grades.middle, lower: i.grades.lower }
        })),
        holdings: IMMORTAL_HOLDINGS.map(h => ({
            factionId: h.factionId, name: nameOf(h.factionId), itemId: h.itemId, count: h.count
        })),
        wanderers: WANDERERS.map(w => ({
            id: w.id,
            recordName: w.recordName,
            commonName: w.commonName,
            lastOrdinal: w.lastOrdinal,
            outcome: w.crossingOutcome,
            crossingYearsAgo: w.crossingYearsAgo,
            affiliationId: w.affiliation?.factionId ?? null
        })),
        withdrawn: Object.entries(WITHDRAWN_POWERS).map(([factionId, w]) => ({
            factionId, name: nameOf(factionId), count: w.count, occupiedBy: w.occupiedBy
        })),
        artifacts,
        artifactCeiling: findArtifactCeiling(artifacts),
        courts,
        noPlaceForTheirOwn: noPlaceRows,
        theFavour: favourRows,
        // Headings derived from the record's own keys, so a field added to the
        // catalog turns up here instead of being silently dropped.
        washingOut: Object.entries(WASHING_OUT).map(([key, text]) => ({
            key,
            heading: key
                .replace(/([A-Z]+)/g, ' $1')
                .replace(/\s+/g, ' ')
                .toLowerCase()
                .trim()
                .replace(/^./, c => c.toUpperCase()),
            text: String(text)
        })),
        theMemento: Object.entries(THE_MEMENTO_AND_THE_SEARCH).map(([key, text]) => ({
            key,
            heading: key
                .replace(/([A-Z]+)/g, ' $1')
                .replace(/\s+/g, ' ')
                .toLowerCase()
                .trim()
                .replace(/^./, c => c.toUpperCase()),
            text: String(text)
        })),
        techniques,
        teaching,
        stack: buildStack(dossierIds),
        high: buildHighBand(rows, sealed),
        dossiers,
        grandAscension: [
            ...rows
                .filter(r => inGrandAscension(r.ordinal))
                .map(r => ({ name: r.name, ordinal: r.ordinal, kind: 'faction', note: 'strongest acting member' })),
            ...COURTS.map(c => ({
                name: c.name,
                ordinal: c.powerOrdinal,
                kind: 'court',
                note: 'administers an arterial vein for ' + (getApexInstitution(c.apexId)?.name ?? c.apexId)
            })).filter(c => inGrandAscension(c.ordinal)),
            ...APEX_INSTITUTIONS.map(a => ({
                name: secondTitleOf(a),
                ordinal: a.secondStrongestOrdinal,
                kind: 'apex second',
                note: 'the strongest at ' + a.name + ' after the one who does not stand up'
            })).filter(a => inGrandAscension(a.ordinal)),
            ...sealed
                .filter(x => inGrandAscension(x.ordinal))
                .map(x => ({
                    name: x.name,
                    ordinal: x.ordinal,
                    kind: 'sealed',
                    note: 'asleep under ' + x.hostName + ', ' + x.sealGrade + ' seal'
                }))
        ].sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER
//
// Self-contained: one document, inline styles, no fetches. It is served to an
// operator, saved to a file, and pasted into things, and every one of those
// stops working the moment it needs a stylesheet from somewhere.
// ─────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const STYLE = `
/* ── The bar's own tokens ────────────────────────────────────────────────
   The top bar is not the register's design: it is the game's top bar, and it
   has to read as the same component when a player crosses between the two.
   Its values are lifted from web/styles.css, which is a single fixed dark
   palette, so they are carried here as a small token set of their own rather
   than folded into the sheet's tokens - the sheet is light by default and the
   bar must not be.

   Dark is therefore the accurate one, matched to the game hex for hex. Light
   is the same bar re-lit: the ink ramp inverts, the accents stay the same hue
   and darken enough to hold contrast on paper. */
/* ── One hue, one job ────────────────────────────────────────────────────
   THE DEFECT THIS CLOSES. Teal (--datum) is the sheet's structure: every
   panel's left rule, every open card's border, every figure, every link. It
   was ALSO the colour that meant "this body stands over that one" on a
   relationship row - so inside a single open entry a reader met teal bars
   that were structure and teal bars that were a direction, with nothing
   distinguishing them. Neither could be read, which is exactly what the
   design owner reported: the colour code and the border are the same blue.

   Teal keeps the structural job, because it holds it in a hundred places and
   the sheet's whole identity is built on it. DIRECTION MOVES OFF IT, onto two
   hues that appear NOWHERE ELSE on this page and mean nothing else when they
   do - a plum for a body standing over this one, a moss for a body answering
   to it, grey for level. Burnt orange (--signal) was not available either: it
   already means "look at this" on flags, seals and ambitions.

   The bar tokens are not borrowed for this any more. --bar-brass is the game
   bar's badge colour and it was doing duty as the "below" rule, which meant a
   change to the top bar would silently restyle the relationship section. */
:root{--ground:#EDF0F1;--panel:#F7F9F9;--ink:#12181C;--quiet:#5C6E74;--faint:#8C9BA0;
--rule:#C4D0D3;--strong:#9AAAAF;--datum:#14545F;--datum-soft:#DCE8EA;--signal:#9E4A16;--signal-soft:#F0E0D3;
--rel-up:#5A3E86;--rel-up-soft:#E7E0F0;--rel-down:#42632C;--rel-down-soft:#E1EBD9;
--rel-level:#6C7C81;--rel-level-soft:#E4E9EA;
--bar-top:#F8FAFA;--bar-bottom:#E7ECEE;--bar-line:rgba(18,24,28,.12);--bar-line-strong:rgba(18,24,28,.2);
--bar-ink:#12181C;--bar-ink-dim:#5C6E74;--bar-hover:rgba(18,24,28,.06);--bar-sigil:#1D5B48;
--bar-brass:#7E5D1C;--bar-brass-dim:rgba(126,93,28,.13);--bar-focus:#1D5B48;
--bar-font-read:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif;
--bar-font-mono:"Cascadia Mono","SFMono-Regular",Menlo,Consolas,"Liberation Mono","Courier New",monospace;
--bar-h:52px;--bar-r-sm:4px;--bar-r-md:7px;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0C1113;--panel:#131A1D;
--ink:#DFE7E9;--quiet:#93A5AA;--faint:#64777D;--rule:#263337;--strong:#3A4C52;--datum:#6BB6C4;
--datum-soft:#173136;--signal:#D2884D;--signal-soft:#342315;
--rel-up:#B79AD8;--rel-up-soft:#241B33;--rel-down:#A6C583;--rel-down-soft:#1B2618;
--rel-level:#8B9AA0;--rel-level-soft:#1B2225;
--bar-top:#0D1211;--bar-bottom:#0A0E0D;--bar-line:rgba(232,230,223,.09);--bar-line-strong:rgba(232,230,223,.18);
--bar-ink:#E8E6DF;--bar-ink-dim:#B9BDB6;--bar-hover:#161E1C;--bar-sigil:#7FD1B9;
--bar-brass:#CFA95F;--bar-brass-dim:rgba(207,169,95,.13);--bar-focus:#7FD1B9;}}
:root[data-theme="dark"]{--ground:#0C1113;--panel:#131A1D;--ink:#DFE7E9;--quiet:#93A5AA;--faint:#64777D;
--rule:#263337;--strong:#3A4C52;--datum:#6BB6C4;--datum-soft:#173136;--signal:#D2884D;--signal-soft:#342315;
--rel-up:#B79AD8;--rel-up-soft:#241B33;--rel-down:#A6C583;--rel-down-soft:#1B2618;
--rel-level:#8B9AA0;--rel-level-soft:#1B2225;
--bar-top:#0D1211;--bar-bottom:#0A0E0D;--bar-line:rgba(232,230,223,.09);--bar-line-strong:rgba(232,230,223,.18);
--bar-ink:#E8E6DF;--bar-ink-dim:#B9BDB6;--bar-hover:#161E1C;--bar-sigil:#7FD1B9;
--bar-brass:#CFA95F;--bar-brass-dim:rgba(207,169,95,.13);--bar-focus:#7FD1B9;}
*{box-sizing:border-box}
/* Leading and measure are half of whether a page is easy, and neither costs a
   word. 1.68 rather than 1.6 opens the line spacing on a serif set at 16px,
   and text-wrap:pretty stops the last line of a paragraph landing as one
   orphaned word where the browser supports it. */
body{background:var(--ground);color:var(--ink);margin:0;padding:0 clamp(14px,4vw,44px) 80px;
font:16px/1.68 Newsreader,Georgia,"Times New Roman",serif;-webkit-font-smoothing:antialiased;
text-wrap:pretty}
.sheet{max-width:1080px;margin:0 auto}
/* ── The bar ─────────────────────────────────────────────────────────────
   The register opens in a tab of its own, so it has to carry its own way back.
   The rules below are a deliberate copy of .topbar in web/styles.css - same
   52px height, same brand block, same gradient and hairline, same ghost-button
   controls, same actions-on-the-right - because a player who follows a link
   out of the game and lands somewhere that merely resembles it has been given
   two applications instead of one.

   Full-bleed: it is a sibling of the sheet rather than a child of it, and the
   negative margin is exactly the body's own padding, so the bar spans the
   viewport without 100vw - which overshoots by the width of the scrollbar
   and would put a horizontal scroll on every page that has one. */
.opbar{position:sticky;top:0;z-index:20;min-height:var(--bar-h);
display:flex;align-items:center;gap:12px;flex-wrap:wrap;
margin:0 calc(-1 * clamp(14px,4vw,44px));padding:0 14px;
border-bottom:1px solid var(--bar-line);
background:linear-gradient(to bottom,var(--bar-top),var(--bar-bottom));
-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.opbar__brand{display:flex;align-items:center;gap:9px;min-width:0}
.opbar__sigil{color:var(--bar-sigil);display:flex}
.opbar__title{font-family:var(--bar-font-read);font-size:16px;letter-spacing:.02em;color:var(--bar-ink);
white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Everything after this sits on the right, as it does in the game. */
.opbar__actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
justify-content:flex-end;padding:6px 0}
.opbar__badge{font-family:var(--bar-font-mono);font-size:10px;letter-spacing:.14em;padding:3px 7px;
border-radius:var(--bar-r-sm);border:1px solid currentColor;white-space:nowrap;
color:var(--bar-brass);background:var(--bar-brass-dim)}
/* .btn.btn--ghost.btn--sm, as an anchor. */
.opbar a{font-family:inherit;font-size:13px;font-weight:500;line-height:1.3;padding:5px 10px;
border:1px solid transparent;border-radius:var(--bar-r-md);background:transparent;
color:var(--bar-ink-dim);text-decoration:none;white-space:nowrap;
transition:background 180ms,border-color 180ms,color 180ms}
.opbar a:hover{background:var(--bar-hover);color:var(--bar-ink);border-color:var(--bar-line)}
.opbar a:active{transform:translateY(1px)}
.opbar a[aria-current]{color:var(--bar-ink);border-color:var(--bar-line-strong)}
.opbar a:focus-visible{outline:2px solid var(--bar-focus);outline-offset:2px;color:var(--bar-ink)}
/* The way out. The register is usually a tab of its own, so the control a
   reader looks for first is the one that closes it - drawn as a close rather
   than as one more link in a row of links, and never ghosted away. */
.opbar__close{display:inline-flex;align-items:center;gap:7px;
color:var(--bar-ink);border-color:var(--bar-line-strong)}
.opbar__close:hover{color:var(--bar-ink);border-color:var(--bar-ink-dim);background:var(--bar-hover)}
.opbar__close-x{font-family:var(--bar-font-mono);font-size:13px;line-height:1}
.opbar__hint{font-family:var(--bar-font-mono);font-size:10px;letter-spacing:.1em;color:var(--bar-ink-dim);
opacity:.7}
@media (max-width:640px){.opbar__hint{display:none}}
.mast{padding:clamp(30px,6vw,64px) 0 24px;border-bottom:2px solid var(--ink)}
.mark{font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;
color:var(--faint);display:flex;flex-wrap:wrap;gap:6px 20px;margin-bottom:18px}
h1{font:700 clamp(34px,7vw,68px)/.97 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.025em;
margin:0 0 12px;text-wrap:balance}
.stand{font-size:clamp(16px,2vw,20px);line-height:1.5;color:var(--quiet);max-width:60ch;margin:0;font-weight:300}
.stand em{color:var(--ink);font-style:italic}
section{padding-top:clamp(36px,5vw,60px)}
/* ── A SECTION HEADER IS ALSO ITS FOLD CONTROL ───────────────────────────
   The sheet renders everything, always. There is no simple mode and no
   advanced mode - a mode means somebody has decided in advance what a reader
   does not need, and on a register whose whole job is to be complete that is
   the wrong trade. What the reader gets instead is the ability to put away
   any section they are not reading, one at a time or all at once, and to have
   that remembered the next time the page is built. */
.sh{display:flex;align-items:baseline;gap:8px 16px;flex-wrap:wrap;
border-bottom:1px solid var(--strong);padding-bottom:8px;margin-bottom:20px;cursor:pointer}
.sh:hover h2{color:var(--datum)}
.secfold{appearance:none;background:transparent;border:1px solid var(--rule);border-radius:3px;
color:var(--quiet);font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;padding:4px 9px;cursor:pointer;white-space:nowrap;
transition:color .12s,border-color .12s}
.secfold:hover{color:var(--datum);border-color:var(--datum)}
.secfold:focus-visible{outline:2px solid var(--datum);outline-offset:2px}
section[data-folded] .secbody{display:none}
section[data-folded]>.sh{margin-bottom:0;border-bottom-style:dashed}
section[data-folded]>.sh h2{color:var(--faint)}
/* The one control that acts on the whole page. Sits under the tabs, where a
   reader looking for a way to make the sheet smaller looks first. */
.foldbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 0 0;
border-bottom:1px solid var(--rule)}
.foldbar p{margin:0;flex:1;min-width:220px;font-size:13px;line-height:1.5;color:var(--quiet)}
.foldbar .secfold{padding:5px 11px}
.sh h2{font:600 clamp(19px,2.4vw,26px)/1.2 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.012em;margin:0;flex:1}
.sh .r{font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;
color:var(--faint);white-space:nowrap}
.note{max-width:68ch;color:var(--quiet);margin:0 0 16px;line-height:1.68}
.note strong{color:var(--ink);font-weight:500}
.chip{display:inline-block;font:500 10px/1.5 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;padding:2px 7px;border:1px solid var(--strong);color:var(--quiet);white-space:nowrap}
.chip.pin{border-color:var(--datum);color:var(--datum);background:var(--datum-soft)}
.chip.wd{border-color:var(--datum);color:var(--datum)}
.chip.sl{border-style:dashed}
.chip.ex{border-color:var(--signal);color:var(--signal);background:var(--signal-soft)}
.scroll{overflow-x:auto;border:1px solid var(--rule);background:var(--panel);margin-bottom:14px}
table{border-collapse:collapse;width:100%;font-size:15px;min-width:600px}
caption{text-align:left;font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding:10px 14px;border-bottom:1px solid var(--rule)}
th{text-align:left;font:600 10px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;color:var(--quiet);padding:9px 14px;border-bottom:1px solid var(--strong);white-space:nowrap}
td{padding:9px 14px;border-bottom:1px solid var(--rule);vertical-align:top}
tbody tr:last-child td{border-bottom:none}
td.n{font:500 15px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
color:var(--datum);white-space:nowrap}
td.nm{font:500 15px Archivo,"Helvetica Neue",Arial,sans-serif;white-space:nowrap}
td.q{color:var(--quiet);font-size:14.5px}
td.m{font:12.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet);white-space:nowrap}
tr.brk td{border-top:2px solid var(--strong)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;vertical-align:middle;margin-right:7px}
.dot.righteous{background:var(--datum)}.dot.neutral{background:var(--faint)}.dot.demonic{background:var(--signal)}
.cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))}
.card{border:1px solid var(--rule);border-top:3px solid var(--datum);background:var(--panel);padding:18px;
display:flex;flex-direction:column;gap:10px}
.card.recent{border-top-color:var(--signal)}
.card h3{font:600 19px Archivo,"Helvetica Neue",Arial,sans-serif;margin:0;letter-spacing:-.01em}
.card .gift{font:600 14px Archivo,"Helvetica Neue",Arial,sans-serif;color:var(--ink)}
.card p{margin:0;font-size:14.5px;color:var(--quiet)}
.met{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);border:1px solid var(--rule)}
.met div{background:var(--panel);padding:8px 10px}
.met dt{font:10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;
color:var(--faint);margin:0 0 3px}
.met dd{margin:0;font:500 15px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.prose{border-left:3px solid var(--datum);background:var(--datum-soft);padding:14px 18px;margin:0 0 14px;max-width:70ch;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.prose p{margin:0;font-size:15.5px;line-height:1.62;color:var(--ink);font-style:italic}
.govgrp{margin-bottom:26px}
.bandhead{font:600 11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--datum);margin:22px 0 8px;display:flex;gap:9px;align-items:baseline}
.bandhead span{color:var(--faint);font-weight:400}
.govhead{font:600 11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;
color:var(--datum);margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid var(--strong);display:flex;gap:9px;align-items:baseline}
.govhead span{color:var(--faint);font-weight:400;letter-spacing:.06em}
.govlist{display:flex;flex-direction:column;gap:8px}
.orgchart{border:1px solid var(--rule);background:var(--panel);padding:18px 20px;overflow-x:auto}
.orgchart ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
/* Children hang off a rail dropped from the card above them. */
.orgchart ul ul{margin:10px 0 0 26px;padding-left:24px;border-left:2px solid var(--rule)}
.orgchart li{position:relative}
.orgchart ul ul>li::before{content:"";position:absolute;left:-24px;top:24px;width:22px;height:2px;background:var(--rule)}
.ncard{background:var(--ground);border:1px solid var(--rule);border-left:3px solid var(--faint);max-width:none}
/* More air between the three lines of a card head. They are three different
   KINDS of statement - who this is, the facts about it, what it is reaching
   for - and 3px of gap made them one block of text. */
.ncard>summary{list-style:none;cursor:pointer;padding:12px 15px;display:grid;gap:7px}
.ncard>summary::-webkit-details-marker{display:none}
.ncard>summary:hover{background:var(--datum-soft)}
.ncard>summary:focus-visible{outline:2px solid var(--datum);outline-offset:-2px}
.ncard[open]{border-color:var(--datum);border-left-color:var(--datum)}
.ncard[open]>summary{border-bottom:1px solid var(--rule)}
.ncard--flat{padding:11px 14px;display:grid;gap:3px}
.nbody{padding:14px}
.nbody .dos{border:none;border-left:none;background:transparent;padding:0}
.ncard[open] .ngo::after{content:" (open)"}
.ncard:focus-visible{outline:2px solid var(--datum);outline-offset:2px}
.node.apex>.ncard{border-left-color:var(--datum);border-left-width:5px;background:var(--datum-soft)}
.node.court>.ncard{border-left-color:var(--datum)}
/* THE CARD HEAD, WHICH IS THE MOST-READ THING ON THE SHEET.
   Every faction in the world is a row here, so a reader meets this shape
   thirty-four times before they meet anything else. It used to be a name, a
   bare number and then one undifferentiated run of uppercase micro-type
   holding six facts. Now it is three ranked lines: the name, the facts with
   printed separators and named labels, and the want on its own line. */
.nhead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
/* Names wrap at their own spaces rather than being held on one line and
   pushing everything else off the card. */
.nname{font:600 16.5px/1.3 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.01em;
min-width:0;overflow-wrap:break-word}
.nord{font:500 14px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
color:var(--datum);white-space:nowrap}
/* Wrapping rather than a flex row that overflows, and the gap is small because
   the separator is a printed character now and does the work. */
.nkind{font:10.5px/1.7 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.08em;
color:var(--faint);display:flex;flex-wrap:wrap;align-items:baseline;gap:0 2px}
.nfact{white-space:nowrap}
/* The two weights that give the row its hierarchy: the label recedes, the
   value is in reading ink. A reader scanning for "which one admits at 3" is
   looking at the values and never at the labels. */
.nfl{text-transform:uppercase;letter-spacing:.11em;color:var(--faint)}
.nfv{color:var(--ink);font-weight:500;text-transform:none;letter-spacing:.02em}
.nsep{color:var(--strong)}
.nfact.pin .nfv{color:var(--datum)}
.nfact.ex .nfv{color:var(--signal)}
.nfact.sl .nfv{border-bottom:1px dashed var(--strong)}
.nord .nfl{font-size:9.5px;margin-right:1px}
.ngo{font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--datum);opacity:0;transition:opacity .12s}
/* Motive on the closed card. Clamped to two lines: it is a scanning aid, and
   an ambition that ran to a paragraph here would make the list unscannable.
   Labelled, and set apart from the facts line above by a hairline, because the
   two used to run into each other with nothing at all between them. */
.nwant{font-size:14px;line-height:1.5;color:var(--quiet);display:-webkit-box;-webkit-line-clamp:2;
-webkit-box-orient:vertical;overflow:hidden;padding-top:6px;border-top:1px solid var(--rule);max-width:88ch}
.nwant .nfl{font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.13em;
text-transform:uppercase;color:var(--faint);margin-right:4px}
.ncard:hover .ngo,.ncard:focus-visible .ngo{opacity:1}
.objblk{border:1px solid var(--rule);background:var(--panel);padding:16px 18px;margin-bottom:12px}
.objblk h3{font:600 18px Archivo,"Helvetica Neue",Arial,sans-serif;margin:0 0 12px;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.objcount{margin:-6px 0 12px;font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--datum);font-variant-numeric:tabular-nums}
.objmeta{font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.grades{margin:0;display:grid;grid-template-columns:78px 1fr;gap:8px 16px}
.grades dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--datum);padding-top:3px}
.grades dd{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
/* ── One house's inventory ───────────────────────────────────────────────
   The same definition grammar as .grades and .relsides, at a wider label
   column because these labels are phrases rather than one word. Thirty-odd
   disclosures on one pane, so the summary is a row rather than a heading and
   the whole thing collapses to a list somebody can scan. */
/* ── The two listing tables ──────────────────────────────────────────────
   FIXED LAYOUT, because auto layout on a hundred rows of free text sizes
   every column to its longest cell. Measured on the first draft: one table
   4,058px wide holding three rows, and a forty-one row one 13,280px tall.
   Widths are declared per table in its own colgroup; this rule is only what
   makes the browser honour them. */
.itemtbl,.holdtbl{table-layout:fixed;width:100%}
/* break-word rather than anywhere: a name should wrap at its own spaces and
   only ever be cut inside a word when the word alone cannot fit the column.
   Anywhere gave mid-word breaks on names that had a space in them the browser
   was perfectly willing to use.
   NOTE: no backticks in this comment. It lives inside a template literal and
   one backtick here terminates the whole stylesheet - see AGENTS.md. */
.itemtbl td,.holdtbl td{vertical-align:top;word-break:normal;overflow-wrap:break-word}
/* A one-word mono cell - a grade, a state, a standing - is never improved by
   being cut in half. It either fits its column or the column is wrong, and
   breaking "legendary" across two lines hides the fact that it is wrong. */
.itemtbl td.m,.holdtbl td.m{overflow-wrap:normal}
/* td.nm and td.m are nowrap everywhere else on the sheet, which is right for a
   name column sized to its content and wrong inside a fixed table: the cell
   cannot grow, so the text runs out over the column beside it. Scoped to these
   two tables rather than relaxed globally. */
/* td.n was left out of this relaxation and it is the same bug: a fixed cell
   that cannot wrap does not grow, it OVERFLOWS, and a rung printed with its
   realm name - "13 Foundation Establishment Early" - ran straight across the
   column beside it and sat on top of that cell's own chip. Every cell in a
   fixed table has to be allowed to wrap or the table is lying about its
   widths. */
.itemtbl td.nm,.itemtbl td.m,.itemtbl td.n,
.holdtbl td.nm,.holdtbl td.m,.holdtbl td.n{white-space:normal}
.itemtbl td.nm .dim,.holdtbl td.nm .dim{display:block;margin-top:2px}
.holdset{margin:6px 0 2px;display:grid;grid-template-columns:172px 1fr;gap:7px 16px}
.holdset dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding-top:3px}
.holdset dd{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
.holddrill{border-top:1px solid var(--rule);padding:9px 0 10px}
.holddrill>summary{cursor:pointer;font-size:15px;color:var(--ink);list-style:none}
.holddrill>summary::-webkit-details-marker{display:none}
.holddrill>summary::after{content:" +";color:var(--faint);font:600 12px "IBM Plex Mono",ui-monospace,Menlo,monospace}
.holddrill[open]>summary::after{content:" -"}
.holddrill>summary:hover{color:var(--datum)}
@media (max-width:640px){.holdset{grid-template-columns:1fr;gap:2px}
.holdset dt{padding-top:9px}}
/* ── CROSS-REFERENCES, IN THE SHEET'S OWN VOICE ──────────────────────────
   These were underlined in the datum colour, which on a page with no other
   underline and no other saturated run of text read as pasted-in web
   furniture - the design owner's word was ugly, and every one of them was a
   name or a phrase sitting inside a line of the sheet's own prose. A jump is
   now the surrounding text with a hairline under it, and it only takes the
   datum colour under the cursor, so a table of house names reads as a table
   of house names and a reference inside a sentence reads as the sentence. */
.jump{color:inherit;cursor:pointer;text-decoration:none;
border-bottom:1px dotted var(--strong);transition:color .12s,border-color .12s}
.jump:hover{color:var(--datum);border-bottom-color:var(--datum)}
/* ── THE DIRECTION KEY, BESIDE THE CHIPS IT EXPLAINS ─────────────────────
   One line, its own element, never inside a note - a key that gets folded
   into a disclosure is a key nobody reads, and that has happened here. */
.dirkey{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;margin:0 0 4px}
.dirkey .relchip{cursor:default;background:none;border-color:var(--rule);opacity:.85}
.dirkey__arrow{font:10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.09em;
text-transform:uppercase;color:var(--faint);padding-left:2px}
/* One dated event this house was in the room for. A line rather than a row in
   the four-column people grid, which gave it a 38px column for an ordinal it
   does not have and wrapped the other party's name one word per line. */
.evtref{margin:0;padding:5px 0;border-top:1px solid var(--rule);
font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet);border-bottom:none}
.evtref:hover{color:var(--datum)}
.evtrefy{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.dos:target,.dos.flash{border-left-color:var(--datum);box-shadow:0 0 0 2px var(--datum-soft)}
/* Seven tabs in a row that could not wrap put a horizontal scrollbar on the
   whole document at any narrow width, which is the one page-level scroll this
   sheet is not allowed to have: everything else that is too wide scrolls
   inside its own .scroll box. */
.tabs{display:flex;flex-wrap:wrap;gap:2px;margin-top:clamp(22px,3vw,32px);border-bottom:2px solid var(--ink)}
.tab{appearance:none;background:transparent;border:1px solid var(--rule);border-bottom:none;color:var(--quiet);
font:600 12px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.09em;text-transform:uppercase;
padding:10px 16px;cursor:pointer;display:flex;gap:8px;align-items:center}
.tab span{color:var(--faint);font-weight:400}
.tab[aria-selected="true"]{background:var(--ink);color:var(--ground);border-color:var(--ink)}
.tab[aria-selected="true"] span{color:var(--ground);opacity:.65}
.tab:focus-visible{outline:2px solid var(--datum);outline-offset:2px}
.dim{font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--faint)}
.grp.weapons h4,.grp.weapons .wo{color:var(--signal)}
.grp.terminal h4{color:var(--faint)}
.legend{padding-top:clamp(28px,4vw,44px)}
.keys{display:grid;gap:1px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));background:var(--rule);border:1px solid var(--rule)}
.key{background:var(--panel);padding:14px 16px}
.key h4{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--datum);margin:0 0 9px}
/* The concept, once, before the vocabulary of it. Set as prose against the
   definition list below so the eye can tell at a glance which is which: this
   paragraph is the thing being explained, the terms are its parts. */
.key__intro{margin:0 0 13px;padding-bottom:12px;border-bottom:1px solid var(--rule);
font-size:14px;line-height:1.55;color:var(--ink)}
.key dl{margin:0;display:flex;flex-direction:column;gap:7px}
.key dt{font:500 13.5px Archivo,"Helvetica Neue",Arial,sans-serif;color:var(--ink)}
.key dd{margin:1px 0 0;font-size:13.5px;line-height:1.5;color:var(--quiet)}
.stack{display:flex;flex-direction:column;gap:16px}
.dos{border:1px solid var(--rule);border-left:3px solid var(--faint);background:var(--panel);padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.dos.apex{border-left-color:var(--datum)}
.dos header{display:flex;gap:16px;align-items:flex-start}
.dos .ord{font:500 30px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--datum);line-height:1;min-width:46px}
.dos h3{font:600 19px Archivo,"Helvetica Neue",Arial,sans-serif;margin:0 0 3px;letter-spacing:-.01em;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.dos .terr b{color:var(--ink);font-weight:600}
/* The house in its own words. Set as running prose rather than as another
   small-print line, because it is the only part of an entry that is written
   to be read rather than scanned. */
.desc{margin:0;font-size:15.5px;line-height:1.62;color:var(--ink);max-width:70ch}
/* The precis. The first thing in an entry and the only prose above the fold,
   so it is set at reading size in full ink while the folded narrative below
   is not. */
.synop{margin:0;font-size:15px;line-height:1.6;color:var(--ink);max-width:72ch}
.dos .terr{margin:0;font-size:14.5px;color:var(--quiet);max-width:70ch}
.meta{display:flex;flex-wrap:wrap;gap:4px 20px;font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:8px 0}
.meta b{font-weight:500;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;font-size:10px;margin-right:5px}
.grps{display:flex;flex-direction:column;gap:12px}
.grp h4{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:0 0 6px;display:flex;gap:8px;align-items:center}
.grp h4 span{color:var(--datum)}
.grp h4 .gap{color:var(--faint);font-weight:400;letter-spacing:.04em;text-transform:none}
.grp.sealed h4,.grp.sealed .wo{color:var(--signal)}
.grp.ascended .wo{color:var(--datum)}
/* NAMES GET LESS AND THE DESCRIPTION GETS MORE, which is the opposite of what
   an auto column does. Auto is sized to its longest cell, so one long name or
   one long role title took width off the only column on the row that is prose,
   on every row, for every faction. Fractions bound all three: the name and the
   role wrap at their own spaces, and what they give up goes to the detail.
   NOTE: no backticks in this comment - see AGENTS.md and the note above. */
/* The separators inside a .who row are printed marks that the grid hides, for
   the same reason the card heads carry one: on screen the columns separate the
   cells, and flattened they do not. A screen reader meeting a middot between
   two cells is reading the row correctly, so nothing hides it from one.
   NOTE: no backticks in this comment - see AGENTS.md. */
.rsep{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.who{display:grid;grid-template-columns:minmax(0,1.1fr) 38px minmax(0,1fr) minmax(0,2.7fr);
gap:4px 14px;padding:6px 0;border-top:1px solid var(--rule);align-items:baseline}
.who:first-of-type{border-top:none}
.wn{font:500 15px Archivo,"Helvetica Neue",Arial,sans-serif}
.wo{font:500 14px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--quiet);text-align:right}
.wr{font:11.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--faint)}
.wd{font-size:14px;color:var(--quiet)}
.none{margin:0;font-size:14px;color:var(--faint);font-style:italic}
/* ── The artifact catalog ────────────────────────────────────────────────
   One table, no bands, no separate treatment for the top of it. The power
   column is the only thing that is emphasised, because the power column is the
   only thing that distinguishes the first row from the last. */
td.pw{font:600 17px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
color:var(--datum);white-space:nowrap;text-align:right}
th.pw{text-align:right}
/* The step between two adjacent rows, drawn where the numbers put it rather
   than where the prose would like it. */
tr.gapline td{border-top:2px solid var(--strong);border-bottom:2px solid var(--strong);
background:var(--datum-soft);color:var(--datum);
font:600 10px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
/* ── Arts ────────────────────────────────────────────────────────────────
   An art nobody will teach is dimmed rather than hidden or moved. It belongs
   on its grade's own table, in the same order as everything else - what is
   different about it is that the last column has no names in it, and that is
   the fact worth seeing next to the arts that do. */
tr.orphan td.nm,tr.orphan td.pw{color:var(--faint)}
/* Seven columns, one of which is a paragraph. At the shared 600px minimum the
   description collapses to a two-word ribbon and every row grows to the height
   of the page; this asks for the width it needs and lets .scroll do what it is
   already there for. */
table.arts{min-width:1040px}
table.arts td.q:last-child{min-width:30ch}
/* ── Ambition ────────────────────────────────────────────────────────────
   Signal rather than datum, and deliberately: everything else in a dossier is
   what a faction IS, and this is the one block that is what it is reaching
   for and has not got. */
.ambit{border-left:3px solid var(--signal);background:var(--panel);padding:12px 16px;margin:0}
.ambit dl{margin:0;display:grid;grid-template-columns:104px 1fr;gap:7px 16px}
.ambit dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--signal);padding-top:3px}
.ambit dd{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
.ambit dd b{color:var(--ink);font-weight:500}
.ambit .side{display:block;padding:5px 0;border-top:1px solid var(--rule)}
.ambit .side:first-child{border-top:none;padding-top:0}
.house{border-left:3px solid var(--datum);background:var(--panel);padding:12px 16px;margin:0}
/* The same block, on the one subject that is not a datum fact. A seal is the
   thing a house is holding back, so it is drawn in the signal colour that
   marks every other sealed row on the sheet. */
.sealblk{border-left:3px solid var(--signal);background:var(--ground);padding:12px 16px;margin:9px 0 2px}
.house dl,.sealblk dl{margin:0;display:grid;grid-template-columns:132px 1fr;gap:7px 16px}
.house dt,.sealblk dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--datum);padding-top:3px}
.sealblk dt{color:var(--signal)}
.house dd,.sealblk dd{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
@media (max-width:640px){.ambit dl,.house dl,.sealblk dl{grid-template-columns:1fr}
.ambit dt,.house dt,.sealblk dt{padding-top:9px}}
/* ── The dossier blocks ──────────────────────────────────────────────────
   One visual grammar, four weights. The assessment is the loudest thing in
   an entry because it is the thing a reader came for; the context prose is
   the quietest and is folded away. Same definition-list shape as .ambit and
   .house so an entry reads as one document rather than as five panels. */
.assess,.holds,.cap,.wayin{border-left:3px solid var(--rule);background:var(--panel);padding:12px 16px;margin:0}
.assess{border-left-color:var(--datum);background:var(--datum-soft)}
.holds{border-left-color:var(--faint)}
.cap{border-left-color:var(--faint)}
.wayin{border-left-color:var(--faint)}
.assess dl,.holds dl,.cap dl,.wayin dl{margin:0;display:grid;grid-template-columns:150px 1fr;gap:7px 16px}
.assess dt,.holds dt,.cap dt,.wayin dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);margin:0}
.assess dt{color:var(--datum)}
.assess dd,.holds dd,.cap dd,.wayin dd{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
.assess dd b,.holds dd b,.cap dd b,.wayin dd b{color:var(--ink);font-weight:600}
.assess dd b{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.ladder{display:flex;flex-wrap:wrap;gap:4px 14px;font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace}
.ladder b{font-weight:500}
/* Uncertainty is the one thing on an entry that should catch the eye without
   being read first, so it takes the signal colour the ambition block uses. */
.flags{border-left:3px solid var(--signal);background:var(--panel);padding:12px 16px}
.flags h4{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;
color:var(--signal);margin:0 0 8px;display:flex;gap:8px}
.flags h4 span{color:var(--faint);font-weight:400}
.flag{display:grid;grid-template-columns:150px 1fr;gap:16px;padding:5px 0;border-top:1px solid var(--rule)}
.flag:first-of-type{border-top:none}
.fk{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--signal)}
.ft{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
/* The narrative prose, folded. It is context under the assessment rather than
   the entry itself, and an entry that opened with it buried every fact. */
.context>summary{cursor:pointer;font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding:6px 0;list-style:none}
.context>summary::-webkit-details-marker{display:none}
.context>summary::after{content:" +"}
.context[open]>summary::after{content:" -"}
.context>summary:hover{color:var(--datum)}
/* The continuation of an oversized field. No chunk on this sheet is longer
   than a short paragraph, so a field that runs past it becomes a lead and a
   disclosure holding the rest in paragraphs of the same size. It is drawn
   quieter than the context disclosure above, because it is the same material
   continuing rather than a different kind of material. */
.more{margin:4px 0 0}
.more>summary{cursor:pointer;font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;
letter-spacing:.1em;text-transform:uppercase;color:var(--faint);list-style:none}
.more>summary::-webkit-details-marker{display:none}
.more>summary::after{content:" +"}
.more[open]>summary::after{content:" -"}
.more>summary:hover{color:var(--datum)}
.more p{margin:6px 0 0}
dd .more{margin-top:5px}
@media (max-width:640px){
.assess dl,.holds dl,.cap dl,.wayin dl,.flag{grid-template-columns:1fr;gap:2px}
.assess dt,.holds dt,.cap dt,.wayin dt{padding-top:9px}}
/* The six parts of an entry. A divider rather than a box: the parts are a
   reading order, not containers, and drawing them as containers made a house
   look like five unrelated records filed together. */
/* The passerby line. Larger than the body and set apart, because it is the
   answer to the first question and everything under it is detail. */
/* WHAT IT IS, then what is said about it. The identity line is the heavier of
   the two so the eye takes it first; the reputation sits under it in the
   quieter colour, which is what it is - somebody else's opinion. */
.ident{margin:4px 0 0;font-size:16px;line-height:1.5;color:var(--ink);font-weight:500;max-width:74ch}
.pass{margin:6px 0 0;font-size:15px;line-height:1.55;color:var(--quiet);max-width:74ch}
.chip.dao{background:var(--datum-soft);color:var(--datum);border-color:var(--datum)}
/* An art nobody else teaches. The mark is on the row rather than in a separate
   list, so the ordering does the grouping and the reader keeps one table. */
.who.sole .wn{font-weight:600}
.who.sole{border-left:2px solid var(--datum);padding-left:8px;margin-left:-10px}
.part{display:flex;align-items:baseline;gap:10px;margin:22px 0 10px;
padding-bottom:5px;border-bottom:1px solid var(--rule);flex-wrap:wrap}
.part h4{margin:0;font:600 10.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;
letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.part span{font-size:11.5px;color:var(--faint)}
/* ── The reader folds what they are not reading ──────────────────────────
   Nothing here hides anything by default. Every part of every entry renders
   open, at full detail, and this is only the control that lets somebody put
   away the parts they have finished with. The heading is the control, so
   there is nothing extra to aim at, and the marker on the right says which
   way it will go. The folded set is kept per PART NAME rather than per entry
   - see foldablePart - so folding Ancestors once folds it everywhere. */
.partfold{margin:0}
.partfold>summary{list-style:none;cursor:pointer}
.partfold>summary::-webkit-details-marker{display:none}
.partfold>summary:hover .part h4{color:var(--datum)}
.partfold>summary:focus-visible{outline:2px solid var(--datum);outline-offset:2px}
.partfold>summary .part::after{content:"hide";margin-left:auto;
font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.13em;
text-transform:uppercase;color:var(--faint)}
.partfold:not([open])>summary .part::after{content:"show"}
.partfold:not([open])>summary .part{border-bottom-style:dashed;color:var(--faint)}
.partfold:not([open])>summary .part h4{color:var(--quiet)}
/* ── A LABEL AND ITS BODY ARE TWO COLUMNS, NOT ONE PARAGRAPH ─────────────
   THE DEFECT. A paragraph written as a bold label followed by its text sets
   the body indented after the label on the first line and then wraps every
   later line back to the left margin - underneath the label. On screen that
   reads as a two-column layout whose second column has escaped, which is
   exactly what the design owner reported: text should not go under.
   The fix is to make the two columns real. Same measurements and the same
   grammar as .hist and .relsides, so a labelled paragraph and a definition
   list look like the same thing on the page, because they are. Applied by
   separateLabelFromBody, which only treats a bold as a label when it really
   is one - short, and not a grammatical part of the sentence after it. */
.labelled{display:grid;grid-template-columns:160px minmax(0,1fr);gap:4px 16px;align-items:baseline}
.labelled>.lbl{font:600 10px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding-top:2px}
.labelled>.lbd{min-width:0}
@media (max-width:640px){.labelled{grid-template-columns:1fr;gap:2px}
.labelled>.lbl{padding-top:8px}}
/* Inside a definition value there is no room for a second pair of columns, so
   the same defect is fixed by stacking instead. A name over its description
   is still a name and a description; a name with its description wrapped back
   underneath it is neither. */
dd>.lbl--stacked{display:block;margin-bottom:2px;color:var(--ink)}
/* History, and the demonic identities, share a term list. Both are the
   catalog's own sentences with a heading derived from the field. */
.hist{margin:0 0 10px;display:grid;grid-template-columns:160px 1fr;gap:7px 16px}
.hist dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding-top:2px}
.hist dd{margin:0;font-size:14px;line-height:1.55;color:var(--quiet)}
@media (max-width:640px){.hist{grid-template-columns:1fr;gap:2px}.hist dt{padding-top:9px}}
/* One rule for the section, a thinner one per item inside it.
   THE BUG THIS FIXES. Both rules below were drawn against var(--line), which
   is not a variable this sheet defines and never was - so the whole
   declaration was invalid, no bar was ever painted, and the events ran
   together as one undifferentiated wall of prose. var(--rule) is the token
   that exists. The .part divider above had the same fault on its bottom
   border, so the rules between the six parts of an entry were invisible too.
   NOTE: no backticks in this comment. It lives inside a template literal and
   one backtick here terminates the whole stylesheet - see AGENTS.md.
   The structure is reused by the relationships section, because they are the
   same kind of material: records about this house and somebody else. One
   heavier rule down the left says where the group starts and stops; a lighter
   rule on each item separates them inside it. Two weights, not two layouts. */
.evts{margin:8px 0 4px;border-left:3px solid var(--rule);padding-left:14px}
.evt{border-left:2px solid var(--rule);padding:0 0 0 12px;margin:10px 0}
.evth{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;margin-bottom:4px}
.evty{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;color:var(--ink)}
.evtx,.evtw{font-size:11px;color:var(--faint)}
/* The neutral line reads quieter than the partisan one, because it is the
   floor both accounts stand on rather than either party speaking. */
.evtn{margin:0 0 5px;font-size:13px;line-height:1.5;color:var(--faint)}
.evta{margin:0;font-size:14px;line-height:1.55;color:var(--quiet)}
.demon{margin:12px 0}
/* ── THE RESUME NOTATION ─────────────────────────────────────────────────
   Two lines on a faction entry that used to be two whole sections. They are
   read rather than scanned only if something makes them look like data, so
   they take the sheet's mono face and the label takes the same micro-caps a
   card fact does. The separator is a printed middot in the markup, not a gap:
   this sheet gets copied out of the browser and a gap does not survive that. */
.holdline{margin:6px 0 0;font:12.5px/1.9 "IBM Plex Mono",ui-monospace,Menlo,monospace;
color:var(--quiet);display:flex;flex-wrap:wrap;align-items:baseline;gap:0 4px}
.holdline .nfl{font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.13em;
text-transform:uppercase;color:var(--faint);margin-right:4px}
.hn b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.holdline .jump{font-size:11px;letter-spacing:.04em}
/* The pointers to the pages that own the material this entry used to carry. */
.crossref{margin:8px 0 14px;font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;
letter-spacing:.06em;color:var(--faint);display:flex;flex-wrap:wrap;gap:0 4px}
.crossref:empty{display:none}
/* A jump on this line inherits the line's faint colour, which is right for the
   sheet and too quiet to look operable. One step up in colour and a visible
   rule under it, rather than the saturated underline this replaced. */
.crossref .jump{color:var(--quiet);border-bottom-color:var(--rule)}
/* The tab's key. A block, so the page's chunk pass leaves it alone - it only
   splits a bare paragraph, and a key that ships half behind a disclosure is a
   key nobody reads. */
.notekey{border-left:3px solid var(--rule);padding:2px 0 2px 14px;margin:0 0 20px;max-width:72ch}
.notekey p{margin:0 0 8px;color:var(--quiet);line-height:1.6}
.notekey p:last-child{margin-bottom:0}
.notekey .relchip{cursor:default}
/* ── THE RELATIONS STRIP ─────────────────────────────────────────────────
   A house's whole position in the world, in one glance. Direction is carried
   by the reserved plum/moss/grey AND by a glyph, never by hue alone; the two
   warmth words carry the asymmetry the section's prose used to have to assert.
   A list, so that a chip is a line when the stylesheet is not there. */
.relstrip{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.relchip{display:inline-flex;align-items:baseline;gap:6px;cursor:pointer;
border:1px solid var(--rule);border-left-width:3px;border-radius:3px;padding:3px 9px 3px 7px;
font:11.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet);background:var(--panel)}
.relchip:hover{border-color:var(--datum);color:var(--ink)}
.relchip--above{border-left-color:var(--rel-up)}
.relchip--below{border-left-color:var(--rel-down)}
.relchip--alongside{border-left-color:var(--rel-level)}
.relchip--above .relchip__mark{color:var(--rel-up)}
.relchip--below .relchip__mark{color:var(--rel-down)}
.relchip--alongside .relchip__mark{color:var(--rel-level)}
.relchip__mark{font-size:9px;line-height:1}
.relchip__who{color:var(--ink)}
/* The warmth word takes the warmth colours the Ties tab already uses for these
   six words - no new palette, and the same word is the same colour on both
   tabs. Direction keeps plum/moss/grey on the left rule and its glyph. */
.relchip__warm{font-size:10px;letter-spacing:.06em}
.relchip__arrow{font-size:10px;color:var(--faint)}
/* Contesting is a THIRD fact and gets neither of the two hues already spoken
   for. A dotted underrule and the word itself: the word is what carries it,
   and the rule is only there to let a reader find the marked chips in a strip
   of twelve without reading any of them. */
.relchip--contesting{border-bottom:2px dotted var(--signal)}
.relchip__over{font-size:10px;letter-spacing:.06em;color:var(--signal)}
/* One direction per entry, so one column rather than the two-column grid this
   replaced. Full measure, because it is now the only account on the card. */
.tieside--mine{border-left:2px solid var(--rule);padding-left:12px;margin:10px 0 0;max-width:72ch}
.tiecontend{border-left:2px solid var(--signal);padding:2px 0 2px 12px;margin:12px 0 0;max-width:72ch}
.tiecontend h5{margin:0 0 6px;font:600 12.5px Archivo,"Helvetica Neue",Arial,sans-serif;color:var(--ink)}
/* The pointer to the other side. Quiet: it is a signpost, not an account. */
.tieother{margin:12px 0 0;color:var(--quiet);font-size:14px;max-width:72ch}
/* ── THE TIES PAGE ───────────────────────────────────────────────────────
   Both ends of a tie side by side, which is the only arrangement in which the
   disagreement between them is visible. Two columns where there is room and
   one where there is not; nothing here scrolls the document. */
.tiesides{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin:10px 0 0}
.tieside{border-left:2px solid var(--rule);padding-left:12px;min-width:0}
.tieside h5{margin:0 0 6px;font:600 12.5px Archivo,"Helvetica Neue",Arial,sans-serif;
color:var(--ink);display:flex;flex-wrap:wrap;align-items:baseline;gap:7px}
.warmpair{display:inline-flex;align-items:baseline;gap:5px}
.warmslash{color:var(--faint)}
.warmtag{font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;padding:1px 6px;border:1px solid currentColor;border-radius:2px}
.warmkey{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0 0 18px;
font:11.5px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet)}
.wk{display:flex;align-items:baseline;gap:6px;max-width:44ch}
.wk b{font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;padding:1px 6px;border:1px solid currentColor;border-radius:2px;white-space:nowrap}
/* WARMTH IS A SCALE AND READS AS ONE, and it deliberately borrows neither of
   the direction hues. Direction is plum and moss and means one thing on this
   sheet; a chip here carries direction on its left rule and warmth in its
   fill, so the two must not be able to be confused. Warmth runs teal at the
   good end, grey through the middle, and the signal orange the rest of the
   sheet reserves for "look at this" at the bad end - with the two extremes
   filled so the ends of the scale separate at a distance.

   NEVER COLOUR ALONE. The word is printed inside every mark that carries a
   hue, so cold and wary do not have to be told apart by eye. */
.warm-warm{color:var(--datum);background:var(--datum-soft)}
.warm-civil{color:var(--datum)}
.warm-distant{color:var(--strong)}
.warm-wary{color:var(--quiet)}
.warm-cold{color:var(--signal)}
.warm-hostile{color:var(--signal);background:var(--signal-soft)}
/* A tie card carries its direction the way a relationship row does. */
.tie{border-left:3px solid var(--rule)}
.tie.rel--above{border-left-color:var(--rel-up)}
.tie.rel--below{border-left-color:var(--rel-down)}
.tie.rel--alongside{border-left-color:var(--rel-level)}
.tie .nhead{gap:6px}
.prov{margin:10px 0 0;font:10px "IBM Plex Mono",ui-monospace,Menlo,monospace;
letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
/* ── A GRADE BAND IS A FOLD ──────────────────────────────────────────────
   Inside a quadrant, grade is the axis a reader sorts by, and a page that
   opens every grade of every quadrant at once has made the sort useless. */
.band{margin:0 0 6px;border-top:1px solid var(--rule)}
.band>summary{list-style:none;cursor:pointer;padding:9px 0;display:flex;align-items:baseline;
justify-content:space-between;gap:14px}
.band>summary::-webkit-details-marker{display:none}
.band>summary .bandhead{margin:0}
.band>summary::after{content:"show";font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;
letter-spacing:.12em;text-transform:uppercase;color:var(--faint);white-space:nowrap}
.band[open]>summary::after{content:"hide"}
.band>summary:hover .bandhead{color:var(--datum)}
.band>summary:focus-visible{outline:2px solid var(--datum);outline-offset:2px}
.demon h4{margin:0 0 8px;font:600 10.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;
letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.demon h4 span{margin-left:8px;letter-spacing:.06em;text-transform:none;color:var(--faint)}
.dispute{margin:0;display:grid;grid-template-columns:180px 1fr;gap:9px 16px}
.dispute dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--signal);padding-top:3px}
.dispute dd{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
@media (max-width:640px){.dispute{grid-template-columns:1fr;gap:2px}
.dispute dt{padding-top:9px}}
/* ── How a body stands with everybody ────────────────────────────────────
   Three groups - above, beside, under - and inside each one a row whose head
   carries the two warmth words next to each other. The pairing is the whole
   design: an asymmetric row has to be readable as asymmetric at a glance,
   without the reader having to open the other entry. Colour is taken from the
   existing tokens rather than a new palette, so the six words theme with
   everything else on the sheet. */
/* The relationships section. Same two-weight rule grammar as the events block
   above: one heavier rule down the left of the whole section, one lighter rule
   per row inside it, and the row rule carries the direction as colour.
   DIRECTION IS THE COLOUR AXIS and warmth is not. A reader arrives wanting to
   know who backs this house and whom it backs, so that is what is legible from
   across the page: plum for a body standing over this one, moss for a body
   answering to it, and a plain grey for level. Warmth is a word in the
   sentence, because six shades of warmth on top of three of direction is two
   colour systems fighting over one row and neither of them readable.

   THE TWO HUES ARE RESERVED. They are defined once at the top of this sheet
   and used only here, so a plum rule anywhere on the page means one thing and
   a teal rule always means structure. They were teal and brass, which is the
   collision the token comment explains: teal was simultaneously the panel
   border, the open-card border, the figures and the links. */
.rels{margin:8px 0 4px;border-left:3px solid var(--rule);padding-left:14px}
.relgrp{margin:14px 0 0}
.relgrp:first-child{margin-top:2px}
.relgrp h4{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);margin:0 0 6px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
/* The group heading takes the direction's own colour rather than the sheet's
   structural teal, so the whole of this region reads on one axis. */
.relgrp h4 span{color:var(--rel-level)}
.relgrp--above h4 span{color:var(--rel-up)}
.relgrp--below h4 span{color:var(--rel-down)}
.relgrp h4 .gap{color:var(--faint);font-weight:400;letter-spacing:.04em;text-transform:none}
/* Wider than the 2px it was. The direction rule is now the only coloured mark
   in this region and it is what a reader decodes from across the page, so it
   is given enough weight to be seen without being read. */
.rel{border-left:4px solid var(--rule);padding:0 0 0 13px;margin:14px 0}
.rel--above{border-left-color:var(--rel-up)}
.rel--below{border-left-color:var(--rel-down)}
.rel--alongside{border-left-color:var(--rel-level)}
.relh{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;margin-bottom:5px}
.relwho{font:600 14px Newsreader,Georgia,serif;color:var(--ink)}
/* The badge repeats the rule colour, because a coloured bar alone is a legend
   lookup and this has to be readable without one. */
.reldir{font:600 9.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;padding:2px 6px;border-radius:3px;border:1px solid var(--rule);
color:var(--faint);white-space:nowrap}
.reldir.above{color:var(--rel-up);border-color:var(--rel-up);background:var(--rel-up-soft)}
.reldir.below{color:var(--rel-down);border-color:var(--rel-down);background:var(--rel-down-soft)}
.reldir.alongside{color:var(--rel-level);border-color:var(--rel-level);background:var(--rel-level-soft)}
/* The key, as three sample cards rather than three loose badges. It shows the
   RULE as well as the badge, because the rule is the mark a reader decodes
   scanning from a distance and the badge was the only thing the old key
   taught. Cards, so it is built by the same function the rows are and cannot
   drift from them - and a block, so nothing can fold it away. */
.relkey{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
gap:6px 14px;margin:8px 0 2px}
.relkey .rel{margin:0}
.relkey .relh{margin-bottom:0}
.relkey .relwho{font:400 12px "IBM Plex Mono",ui-monospace,Menlo,monospace;
letter-spacing:.02em;color:var(--quiet)}
/* The reading line: who stands where, and how each end feels about it. */
.relsay{margin:0 0 6px;font-size:14.5px;line-height:1.55;color:var(--ink)}
.relsay b{font-weight:600}
.relwhat{margin:0 0 6px;font-size:14px;line-height:1.55;color:var(--quiet)}
.relsides{margin:0;display:grid;grid-template-columns:160px 1fr;gap:6px 16px}
.relsides dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding-top:2px}
.relsides dd{margin:0;font-size:14px;line-height:1.55;color:var(--quiet)}
@media (max-width:640px){.relsides{grid-template-columns:1fr;gap:2px}
.relsides dt{padding-top:9px}}
/* ── A court's offices ───────────────────────────────────────────────────
   The two standing columns sit side by side and are given the same weight,
   because neither is the real one. */
td.ap{font:12.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--signal);white-space:nowrap}
tr.answers td.nm:first-child::after{content:" \\2022";color:var(--datum)}
@media (max-width:720px){.who{grid-template-columns:1fr 34px;gap:2px 10px}.wr,.wd{grid-column:1 / -1}}
foot,footer{margin-top:clamp(48px,7vw,80px);border-top:2px solid var(--ink);padding-top:16px;
font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.06em;color:var(--faint);
display:flex;flex-wrap:wrap;gap:8px 26px}
`;


/**
 * Render one curated paragraph, where there is one.
 *
 * Visually distinct from everything around it on purpose. The tables are the
 * catalog and this is a model talking about the catalog, and a reader must
 * never have to guess which they are looking at. A stale block keeps its text
 * and says so rather than vanishing - a dated paragraph that admits it is dated
 * is worth more than a hole.
 */
function prose(blocks: Record<string, { text: string; stale?: boolean }> | undefined, id: string): string {
    const block = blocks?.[id];
    if (!block || !block.text) return '';
    const flag = block.stale
        ? '<span class="chip ex">behind the catalog</span>'
        : '';
    return `<aside class="prose">${flag}<p>${esc(block.text)}</p></aside>`;
}

/** A row of small labelled facts under a dossier heading. */
function metaRow(pairs: [string, string][]): string {
    // SEPARATED BY A PRINTED MIDDOT, not by the gap. Flattened - which is what
    // happens the moment anybody copies a stretch of this sheet - a row of
    // gapped spans came out as "heritage ancientstock depletedsecond 38".
    return `<div class="meta">${pairs
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`)
        .join('<span class="rsep"> &middot; </span>')}</div>`;
}

/**
 * A cross-reference to another entry on this sheet, by anchor id.
 *
 * WHY THIS IS NOT AN `<a href="#...">`. Two reasons, and the second is the one
 * a reader complained about.
 *
 * A faction entry lives inside a pane that is `hidden` unless its tab is
 * selected, so a fragment link to one is a link to nothing - the browser
 * cannot scroll to an element with no box. Every other cross-reference on the
 * sheet already goes through `data-goto`, which switches to the owning tab
 * first and then scrolls. Five call sites were still emitting a raw fragment
 * link and were dead on click.
 *
 * And a fragment link stops being a fragment the moment it leaves the page.
 * Copy a stretch of this sheet into anything that keeps links and every one of
 * them comes out resolved against wherever the register happened to be served,
 * host and port included - which are the operator's and are wrong for every
 * other reader. What was reported was
 * `[The Kiln Court](http://localhost:8787/api/admin/register.html#court-court-kiln)`
 * repeated on every historical event. The href is relative in the markup; it is
 * the copy that resolves it, and the only fix that survives a copy is not to
 * emit a URL at all.
 */
function jumpTo(anchor: string | null, name: string): string {
    return anchor
        ? `<span class="jump" data-goto="${esc(anchor)}">${esc(name)}</span>`
        : esc(name);
}

/**
 * A faction name that opens that faction's entry, wherever it is printed.
 *
 * Every tab names factions and only the org chart could be clicked, so the same
 * name was a link in one place and dead text in another. Resolved through
 * `idsForFaction` rather than by matching the printed name: a body filed under
 * two ids prints under whichever name its own catalog uses, and the entry is
 * under the other one about half the time.
 *
 * Falls back to plain text where there is genuinely no entry to open, which is
 * a real state - a wanderer holds no affiliation, and a few ids in the object
 * catalog resolve to nothing at all.
 */
function factionLink(
    id: string | null,
    name: string,
    byId: ReadonlyMap<string, SectDossier>
): string {
    const target = id ? idsForFaction(id).find(candidate => byId.has(candidate)) : undefined;
    return target
        ? `<span class="jump" data-goto="faction-${esc(target)}">${esc(name)}</span>`
        : esc(name);
}

function tagChips(tags: readonly string[]): string {
    if (!tags.length) return '';
    return `<span class="tags">${tags
        .map(t => `<span class="chip">${esc(t.replace(/-/g, ' '))}</span>`)
        .join('')}</span>`;
}

/** Who is actually carrying it, as one short phrase. */
function heldByLine(a: RegisterArtifact): string {
    if (!a.possessorId) return 'nobody';
    const ord = a.possessorOrdinal === null ? '' : ` ${a.possessorOrdinal}`;
    return a.inVault
        ? `${a.possessorName} (vault)`
        : `${a.possessorName}${ord}`;
}

/**
 * The whole catalog, one table, strongest first.
 *
 * No grouping and no banding. The first row and the last row are drawn the same
 * way with different numbers in the power column, which is the only claim this
 * page makes about them; everything a reader might conclude from that is theirs
 * to conclude.
 */
function artifactTable(list: RegisterArtifact[], ceiling: RegisterArtifactCeiling | null): string {
    const cols = 6;
    const body = list.map((a, i) => {
        // The one rule in the table, drawn where the catalog puts it. It is a
        // label rather than a divider: the rows either side of it are the same
        // kind of record, and what changes across it is who finished the object.
        const ceilingRow = ceiling && ceiling.breakAt === i
            ? `<tr class="gapline"><td colspan="${cols}">nothing made here passes ${ceiling.madeHere}</td></tr>`
            : '';
        const ownerName = a.ownerId === null ? '' : a.ownerName || nameOf(a.ownerId);
        const owner = a.ownerId === null
            ? '<span class="dim">nobody</span>'
            : a.ownerLinkId
                ? `<span class="jump" data-goto="faction-${esc(a.ownerLinkId)}">${esc(ownerName)}</span>`
                : esc(ownerName) + ' <span class="chip">no entry</span>';
        return ceilingRow
            + `<tr><td class="pw">${a.power}</td>`
            + `<td class="nm">${esc(a.name)}</td>`
            + `<td class="q">${owner}</td>`
            + `<td class="m">${esc(heldByLine(a))}</td>`
            + `<td class="m">${esc(a.significance)}</td>`
            + `<td class="q">${esc(a.description)}${tagChips(a.tags)}</td></tr>`;
    }).join('');

    // WIDTHS, DECLARED, BECAUSE AUTO LAYOUT GOT THEM EXACTLY BACKWARDS.
    // Measured on the rendered page before this: the artifact name column was
    // 351px holding "The First Course" with two hundred pixels of nothing
    // beside it, while "What it is" - the only column on the row anybody reads
    // as prose - was squeezed to 317px and came out as eight lines of six
    // words. Auto layout sizes a column to its longest cell and a nowrap name
    // cell has no longest line, so the names took the width and the paragraph
    // paid for it. Meanwhile "The Hollow Court" in a 104px owner column broke
    // across two lines, which is the same fault seen from the other end.
    //
    // So: the names get less and are allowed to wrap, and the description gets
    // the rest. `table-layout:fixed` is what makes a browser honour any of it.
    return `<div class="scroll"><table class="itemtbl">
  <colgroup><col style="width:6%"><col style="width:18%"><col style="width:15%"><col style="width:14%"><col style="width:11%"><col style="width:36%"></colgroup>
  <caption>Every artifact in the world &middot; power descending</caption>
  <thead><tr><th class="pw">Power</th><th>Artifact</th><th>Owner</th><th>Held by</th><th>Standing</th><th>What it is</th></tr></thead>
  <tbody>${body}</tbody></table></div>`;
}

/**
 * Who will hand this art over, as names rather than as a count.
 *
 * An empty list is the interesting row and is printed as such. It does not mean
 * the art is lost - `survivingCopy` is the field that answers that - it means
 * every copy is somewhere that does not teach, so the only way to it is the
 * read channel off a page in a ruin or a grave.
 */
function taughtByLine(t: RegisterTechnique): string {
    if (!t.taughtBy.length) {
        // Held is not taught, and the sheet says which. A road at the top of
        // the ladder inside a body with no teach list is neither an orphan nor
        // a curriculum: it is one or two copies, lent and returned, and a
        // teacher who is sometimes available.
        if (t.heldBy) {
            return `<span class="jump" data-goto="faction-${esc(t.heldBy.id)}">${esc(t.heldBy.name)}</span>`
                + ` <span class="dim">${t.heldBy.ordinal}</span>`
                + ` <span class="chip pin">held, not taught</span>`
                + ` <span class="dim">${t.heldBy.copies} cop${t.heldBy.copies === 1 ? 'y' : 'ies'},`
                + ` ${t.heldBy.teachers} who can teach it</span>`;
        }
        return `<span class="dim">${t.survivingCopy
            ? 'nobody teaches it'
            : 'no copy anywhere'}</span>`;
    }
    return t.taughtBy
        .map(f => `<span class="jump" data-goto="faction-${esc(f.id)}">${esc(f.name)}</span>`
            + ` <span class="dim">${f.ordinal}</span>`
            + (f.signature ? ' <span class="chip pin">signature</span>' : ''))
        .join(' &middot; ');
}

/**
 * Every art, banded by grade, strongest band first.
 *
 * Banded rather than sorted flat, and this is the one place the arts sheet
 * differs from the artifact sheet on purpose. An artifact's power is a single
 * scale and banding it would assert a tier the engine does not have. A grade is
 * already a band in the catalog - it sets the qi cost, the ordinal range and
 * the baseline opacity - so drawing the bands is reporting the catalog rather
 * than editorialising over it.
 */
/**
 * The arts, split on the era axis before the grade one.
 *
 * A SPLIT rather than a label, and that is the whole instruction. `era` and
 * `class` are independent axes and all four quadrants are occupied, so
 * "ancient cultivation" and "ancient dao" are different things: one is a road
 * with a different bargain - lifespan, or blood, for something the elemental
 * line has no way of asking for - and the other is spears somebody else can
 * carry, or a piece of ground taken out of the world. Sharing a row would
 * invite a reader to average them into "old stuff", which is exactly the
 * reading the tier was built to avoid.
 *
 * Neither era is the stronger and the comparison is not coherent. Modern is
 * elemental and scales; ancient is categorical. What is forbidden is a strict
 * upgrade, because then the abandonment makes no sense.
 */
const QUADRANTS: { era: string; artClass: string; head: string; note: string }[] = [
        {
            era: 'modern', artClass: 'cultivation',
            head: 'Modern &middot; cultivation',
            note: 'The elemental ladder every house teaches. This is what a curriculum IS, and what an admission gate is for.'
        },
        {
            era: 'modern', artClass: 'dao',
            head: 'Modern &middot; dao',
            note: 'Fire, ice, lightning, and at the top of the ladder something a province still names. Elemental, and it scales.'
        },
        {
            era: 'ancient', artClass: 'cultivation',
            head: 'Ancient &middot; cultivation',
            note: 'A road with a different bargain: lifespan, or blood, for something the elemental line has no way of asking for. The cost is paid by the user, in their own body or their own span, and on some of them it compounds - which is why an era worked it out and walked away rather than being forbidden.'
        },
        {
            era: 'ancient', artClass: 'dao',
            head: 'Ancient &middot; dao',
            note: 'Categorical rather than elemental: spears somebody else can carry, a piece of ground taken out of the world, a second body. Not stronger than the modern line - the comparison does not resolve - and never a strict upgrade, or the abandonment would make no sense.'
        }
];

/**
 * The same four quadrants, one SECTION each, and each one starts folded.
 *
 * WHY SECTIONS RATHER THAN HEADINGS. The arts tab was one section holding four
 * quadrant headings holding up to five grade tables each - so a reader who
 * wanted the heaven-grade ancient dao arts scrolled past a hundred and thirty
 * rows of everything else to reach them. Era and class are the sheet's own two
 * axes and the catalog's grades are the third; making the first two fold
 * independently turns a scroll into two clicks.
 *
 * `startfolded` is honoured once, on first sight of a section, and never
 * against a reader who has already opened it - the fold set in localStorage
 * still wins. A default is a starting position, not a preference.
 */
function techniqueQuadrantSections(list: RegisterTechnique[]): string {
    return QUADRANTS.map(q => {
        const rows = list.filter(t => t.era === q.era && t.artClass === q.artClass);
        const capped = rows.filter(t => t.worldSupplyCeiling !== null);
        const untaught = rows.filter(t => !t.taughtBy.length).length;
        return `<section class="startfolded">
  <div class="sh"><h2>${q.head}</h2><span class="r">${rows.length} art${rows.length === 1 ? '' : 's'}${untaught ? ` &middot; ${untaught} with no teacher` : ''} &middot; by grade</span></div>
  <p class="note">${q.note}${capped.length
            ? ` ${capped.length} of these ${capped.length === 1 ? 'has' : 'have'} a supply ceiling in the <em>Ceiling</em> column.`
            : ''}</p>
  ${rows.length
            ? techniqueTables(rows)
            // AN EMPTY QUADRANT IS PRINTED, NOT HIDDEN. The design states all
            // four are real; the catalog currently fills three. Dropping the
            // head would leave a reader unable to tell "no such thing exists"
            // from "this table forgot", and the gap is falsifiable on the page.
            : '<p class="note"><strong>Nothing in the catalog occupies this quadrant yet.</strong> It is printed empty rather than left out: a missing head reads as an oversight, and this is a real absence.</p>'}
</section>
`;
    }).join('');
}

function techniqueTables(list: RegisterTechnique[]): string {
    return [...GRADE_ORDER].reverse().map(grade => {
        const rows = list.filter(t => t.grade === grade);
        if (!rows.length) return '';
        const untaught = rows.filter(t => !t.taughtBy.length).length;

        // A GRADE IS A FOLD OF ITS OWN, and closed to start. Grade is the
        // catalog's own band - it sets the qi cost, the ordinal range and the
        // baseline opacity - so it is the axis a reader is most often sorting
        // by inside a quadrant, and a page that opens on every row of every
        // grade at once has made that sort useless.
        return `<details class="band"${untaught ? '' : ''}>
    <summary><span class="bandhead">${esc(grade)} <span>${rows.length}</span>`
            + (untaught ? `<span>&middot; ${untaught} with no teacher</span>` : '')
            + `</span></summary>
  <div class="scroll"><table class="arts">
    <caption>${esc(grade)} grade &middot; ${rows.length} &middot; by the rung the art is written for</caption>
    <thead><tr><th class="pw">Ord</th><th>Art</th><th>Kind</th><th>Reach</th><th>Channel</th><th>Ceiling</th><th>Taught by</th><th>What it does</th></tr></thead>
    <tbody>${rows.map(t => `<tr${t.taughtBy.length ? '' : ' class="orphan"'}>`
        + `<td class="pw">${t.requiredOrdinal}</td>`
        + `<td class="nm">${esc(t.name)}</td>`
        + `<td class="m">${esc(t.category)}${t.element ? ' &middot; ' + esc(t.element) : ' <span class="dim">elementless</span>'}</td>`
        + `<td class="m">${t.reach === 'single' ? `<span class="dim">${esc(t.reach)}</span>` : esc(t.reach)}</td>`
        + `<td class="m">${esc(t.transmission)}${t.survivingCopy ? '' : ' &middot; no copy'}</td>`
        // The world's BELIEF about where the material runs out, not a bar the
        // engine applies. See the section note.
        + `<td class="m">${t.worldSupplyCeiling === null
            ? '<span class="dim">none</span>'
            : `${Math.round(t.worldSupplyCeiling * 100)}%`}</td>`
        + `<td class="q">${taughtByLine(t)}</td>`
        + `<td class="q">${esc(t.description)}</td></tr>`).join('')}</tbody></table></div>
  </details>`;
    }).join('');
}


// ─────────────────────────────────────────────────────────────────────────
// WHO ADMINISTERS WHOSE GROUND
//
// Two facts nobody in the world has written down, both of them ordinary joins
// between catalogs that already exist. Derived here rather than stored, for the
// reason the arts tab already gives: the interesting figure is a join and
// either side of it can move, so the claim should be falsifiable on the page
// instead of going quietly stale.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every arterial, the apex whose province it sits in, and who the court that
 * administers it actually answers to.
 *
 * The row that matters is the one where those last two are different houses.
 * A holding is administered THROUGH a court, courts answer to an apex, and
 * nothing anywhere requires the two apexes to be the same - so an apex can be
 * dependent on a rival for the working of its own ground without a single
 * document saying so, because there is no document that would say it. Neither
 * house has an interest in writing it down and neither has ever been asked.
 */
function groundTable(): string {
    const apexName = (id: string | null): string =>
        id === null ? '' : APEX_INSTITUTIONS.find(a => a.id === id)?.name ?? id;

    const rows = ARTERIALS.map(a => {
        const province = PROVINCES.find(p => p.id === a.provinceId) ?? null;
        const court = a.administeredByCourtId === null
            ? null
            : COURTS.find(c => c.id === a.administeredByCourtId) ?? null;
        const holder = province ? province.heldByApexId : null;
        const patron = court ? court.apexId : null;
        return {
            arterial: a.name,
            province: province ? province.name : '(no province)',
            holder,
            court: court ? court.name : null,
            patron,
            crossed: holder !== null && patron !== null && holder !== patron
        };
    });

    const crossed = rows.filter(r => r.crossed);

    return `<div class="scroll"><table class="arts">
    <caption>Arterials, their holder, and who administers them &middot; ${rows.length}</caption>
    <thead><tr><th>Arterial</th><th>In</th><th>Held by</th><th>Administered through</th><th>Which answers to</th></tr></thead>
    <tbody>${rows.map(r => `<tr${r.crossed ? ' class="orphan"' : ''}>`
        + `<td class="nm">${esc(r.arterial)}</td>`
        + `<td class="m">${esc(r.province)}</td>`
        + `<td class="nm">${esc(apexName(r.holder))}</td>`
        + `<td class="q">${r.court === null
            ? '<span class="dim">nobody; the holder works it directly</span>'
            : esc(r.court)}</td>`
        + `<td class="nm">${r.patron === null
            ? '<span class="dim">&mdash;</span>'
            : r.crossed
                ? `<strong>${esc(apexName(r.patron))}</strong>`
                : esc(apexName(r.patron))}</td></tr>`).join('')}</tbody></table></div>
  ${crossed.length === 0
        ? '<p class="note">Every arterial here is administered through a court answering to the house that holds the ground. Nothing crosses.</p>'
        : `<p class="note"><strong>${crossed.length === 1 ? 'One arterial is' : `${crossed.length} arterials are`} administered through a court that answers to somebody else.</strong> ${crossed.map(r =>
            `${esc(r.arterial)} sits in ${esc(r.province)}, which ${esc(apexName(r.holder))} holds, and is run through ${esc(r.court ?? '')} - and ${esc(r.court ?? '')} answers to ${esc(apexName(r.patron))}.`).join(' ')} A holding is administered <em>through</em> a court, courts answer to an apex, and nothing requires the two to be the same house. So an apex can depend on a rival for the working of its own ground, and <strong>no document anywhere says so</strong> - not because it is hidden, but because there is no document whose job it would be, and neither house has ever had a reason to ask for one.</p>`}`;
}

/**
 * How much ground each apex actually holds, including the ones holding none.
 *
 * The zero is the point. An empty territory list is `heritage: 'recent'` stated
 * as geography rather than as prose: a house can sit at the top of the power
 * table and hold no province at all, which says something about how it got
 * there that no ordinal does.
 */
function apexGroundTable(): string {
    const rows = APEX_INSTITUTIONS
        .map(apex => ({
            name: apex.name,
            provinces: PROVINCES.filter(p => p.heldByApexId === apex.id)
        }))
        .sort((a, b) => b.provinces.length - a.provinces.length
            || a.name.localeCompare(b.name));

    const landless = rows.filter(r => r.provinces.length === 0);

    return `<div class="scroll"><table class="arts">
    <caption>Provinces held, by house &middot; ${rows.length} houses</caption>
    <thead><tr><th>House</th><th class="pw">Provinces</th><th>Which</th></tr></thead>
    <tbody>${rows.map(r => `<tr${r.provinces.length === 0 ? ' class="orphan"' : ''}>`
        + `<td class="nm">${esc(r.name)}</td>`
        + `<td class="pw">${r.provinces.length}</td>`
        + `<td class="q">${r.provinces.length === 0
            ? '<span class="dim">none at all</span>'
            : r.provinces.map(p => esc(p.name)).join(', ')}</td></tr>`).join('')}</tbody></table></div>
  ${landless.length === 0
        ? ''
        : `<p class="note"><strong>${landless.map(r => esc(r.name)).join(' and ')} hold${landless.length === 1 ? 's' : ''} no province at all.</strong> Not a small one - none. An empty territory list is a recent heritage stated as geography rather than as prose, and it is the fact the power table cannot show you: a house can stand near the top of it and own no ground, which says how it got there. What such a house has instead is whatever its entry says it has, and every bit of that is the kind of thing that can be taken away in a season.</p>`}`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE LAST AGE LEFT, AND WHO IS SITTING ON IT
//
// Three ledgers that between them say something no power ordinal says: a house
// with the book and no material is a different house from one with neither,
// and from one quietly holding the last of both. The catalog knows; almost
// nobody in the world does, and this sheet is written for a reader who is
// allowed to know more than the people in it.
// ─────────────────────────────────────────────────────────────────────────

/** The stock words, as a reader meets them rather than as the type spells them. */
const ARCHIVE_STOCK: Readonly<Record<string, { label: string; gloss: string }>> = {
    spent: {
        label: 'spent',
        gloss: 'A house that spent theirs used it, and knows exactly what the art does.'
    },
    never_had_any: {
        label: 'never had any',
        gloss: 'A house that never had any owns a description.'
    },
    remnant: {
        label: 'a remnant',
        gloss: 'Some of it is still there.'
    }
};

/**
 * Who is holding a book nobody can feed.
 *
 * `willingToPartWithIt` is the field that makes an ancient manual reachable
 * rather than decorative: giving away something nobody there can use costs
 * nothing, so it can be a reward, a favour, or a consolation prize handed over
 * by people who are not being generous.
 *
 * EXACTLY ONE REMNANT EXISTS AND IT IS A SECRET, so the row does not print it.
 * The interesting state is that somebody is sitting on the last of the material
 * and the world does not know which house; a table with the word in a column
 * beside a name has answered the question the secret exists to keep open. The
 * count is stated underneath instead, which tells a reader the fact exists
 * without telling them the answer.
 */
function archiveTable(): string {
    const rows = [...ARCHIVE_COPIES]
        .sort((a, b) => nameOf(a.factionId).localeCompare(nameOf(b.factionId)));
    const remnants = rows.filter(r => r.stock === 'remnant').length;

    return `<div class="scroll"><table class="arts">
    <caption>Ancient copies in houses that cannot work them &middot; ${rows.length}</caption>
    <thead><tr><th>House</th><th>The book</th><th>Material</th><th>How they came by it</th><th>Would they part with it</th></tr></thead>
    <tbody>${rows.map(r => {
        const shown = r.stock === 'remnant'
            ? ARCHIVE_STOCK.never_had_any
            : ARCHIVE_STOCK[r.stock] ?? { label: r.stock, gloss: '' };
        return '<tr>'
            + `<td class="nm">${esc(nameOf(r.factionId))}</td>`
            + `<td class="nm">${esc(techniqueNameOf(r.techniqueId))}</td>`
            + `<td class="m">${esc(shown.label)}</td>`
            + `<td class="q">${esc(r.provenanceNote)}</td>`
            + `<td class="q">${esc(r.willingToPartWithIt)}</td></tr>`;
    }).join('')}</tbody></table></div>
  <p class="note"><strong>Every house here can open the book and none of them can work it.</strong> ${esc(ARCHIVE_STOCK.spent.gloss)} ${esc(ARCHIVE_STOCK.never_had_any.gloss)} That is not pedantry - it decides what they can tell you, and what they think the thing is worth.${remnants > 0
        ? ` Somewhere on this list ${remnants === 1 ? 'is a house that still has some of the material' : `are ${remnants} houses that still have some of the material`} and ${remnants === 1 ? 'has' : 'have'} not said so. This sheet does not print which, because that is the fact.`
        : ''}</p>`;
}

/** The medicine ledger. Four standings, and the unconfirmed one is the point. */
function medicineTable(): string {
    const rows = [...MEDICINE_HOLDINGS]
        .sort((a, b) => nameOf(a.factionId).localeCompare(nameOf(b.factionId)));
    const believed = rows.filter(r => r.standing === 'believed_to_hold');

    const label = (standing: string): string =>
        standing === 'holds_one' ? 'holds one'
            : standing === 'spent_theirs' ? 'spent theirs'
                : standing === 'believed_to_hold' ? 'believed to hold one'
                    : 'never had one';

    return `<div class="scroll"><table class="arts">
    <caption>Who still has theirs &middot; ${rows.length}</caption>
    <thead><tr><th>House</th><th>Standing</th><th>How the world knows</th><th>What became of it</th></tr></thead>
    <tbody>${rows.map(r => '<tr>'
        + `<td class="nm">${esc(nameOf(r.factionId))}</td>`
        + `<td class="m">${r.standing === 'believed_to_hold'
            ? `<em>${esc(label(r.standing))}</em>`
            : esc(label(r.standing))}</td>`
        + `<td class="q">${esc(r.howItIsKnown)}</td>`
        + `<td class="q">${r.whatBecameOfIt === null
            ? '<span class="dim">nothing became of it; it is still theirs</span>'
            : esc(r.whatBecameOfIt)}</td></tr>`).join('')}</tbody></table></div>
  <p class="note"><strong>A house that has spent its one is a different house from a house that has not, and a house nobody can confirm either way is a third thing again.</strong>${believed.length > 0
        ? ` ${believed.map(r => esc(nameOf(r.factionId))).join(' and ')} ${believed.length === 1 ? 'is' : 'are'} <em>believed to</em> hold one, and it has never been confirmed. That is left unresolved here on purpose: the ambiguity is worth more to everybody standing near ${believed.length === 1 ? 'them' : 'either of them'} than either answer would be, which is why nobody with an interest has ever pushed for one.`
        : ''}</p>`;
}

/** What the extinctions closed downstream, and how much is left, and where. */
function lostMaterialTable(): string {
    const rows = LOST_MATERIALS;
    const total = rows.reduce((n, r) => n + r.remaining.inArchives + r.remaining.unfound, 0);
    const unfound = rows.reduce((n, r) => n + r.remaining.unfound, 0);

    return `<div class="scroll"><table class="arts">
    <caption>Materials nobody can gather, and what went with them &middot; ${rows.length}</caption>
    <thead><tr><th>Material</th><th>Recipes</th><th>Arts it feeds</th><th class="pw">In archives</th><th class="pw">Unfound</th><th>Where the unfound are</th></tr></thead>
    <tbody>${rows.map(r => '<tr>'
        + `<td class="nm">${esc(herbNameOf(r.herbId))}</td>`
        + `<td class="m">${r.closedRecipeIds.length
            ? `${r.closedRecipeIds.length} closed`
            : '<span class="dim">none</span>'}</td>`
        + `<td class="q">${r.gatesTechniqueIds.length
            ? r.gatesTechniqueIds.map(id => esc(techniqueNameOf(id))).join(', ')
            : '<span class="dim">none</span>'}</td>`
        + `<td class="pw">${r.remaining.inArchives}</td>`
        + `<td class="pw">${r.remaining.unfound}</td>`
        + `<td class="q">${r.remaining.placements.length === 0
            ? '<span class="dim">nowhere anybody has placed</span>'
            : r.remaining.placements.map(p =>
                `<strong>${p.units}</strong> at ${esc(p.siteId)} &mdash; ${esc(p.note)}`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
  <p class="note"><strong>${total} units of this material exist in the world, and ${unfound} of them are in ground nobody has opened.</strong> The figure is small on purpose. "Nobody has any" is a wall; a number with placements against it is a search with a destination and an end - and every unit somebody finds is one nobody else can ever have, which is a kind of consequence a world otherwise has to fake. What each row also closed is beside it: an extinction is not one loss, it is a list.</p>
  ${rows.map(r => `<p class="note"><strong>${esc(herbNameOf(r.herbId))}.</strong> ${esc(r.remaining.whatIsKnownOfTheCount)}${r.closedObjectKinds.length
        ? ` What can no longer be made with it: ${r.closedObjectKinds.map(k => esc(k)).join('; ')}.`
        : ''}</p>`).join('')}`;
}

/** A technique id resolved to what people call it. Falls back to the id, visibly. */
function techniqueNameOf(id: string): string {
    return TECHNIQUES.find(t => t.id === id)?.name ?? id;
}

/** A herb id resolved the same way. */
function herbNameOf(id: string): string {
    return HERBS.find(h => h.id === id)?.name ?? id;
}

/**
 * The shelf, house by house, and this is the page that owns it.
 *
 * WHAT THIS REPLACED, AND IT WAS TWO THINGS RENDERING THE SAME FACT. The Arts
 * tab already listed every house's teach list, and every faction entry listed
 * the same list again in a different shape - with the element, the category and
 * how many other houses teach each title - and under it the deep road with its
 * copy count, its provenance, its opening penalty and a biography of its one
 * teacher. Three renderings of one field on the sect catalog, one of them on a
 * page whose job is to say what a house IS.
 *
 * There is one now, here, and it is the fullest of the three. The faction entry
 * carries what elements and to what level, which is what a reader deciding
 * about a house is asking, and points at this.
 */
function teachingBody(d: SectDossier): string {
    if (!d.curriculum && !d.deepRoad) {
        return '<p class="none">Nothing on any teach list. This body takes people in for what they '
            + 'can already do, or it takes nobody at all.</p>';
    }
    return (d.curriculum ? curriculumBlock(d.curriculum) : '')
        + (d.deepRoad ? deepRoadBlock(d.deepRoad) : '');
}

/**
 * What a house teaches, at a glance, on its closed card.
 *
 * THE LEVEL IS THE TEACHABLE END. `cap` is where the paper stops, and on the
 * roads that cover the last realm nobody is ever walked onto that rung - so a
 * cap printed as a level is a promise the house cannot keep.
 */
function teachingFacts(d: SectDossier): string[] {
    const c = d.curriculum;
    const roadEnd = d.deepRoad ? d.deepRoad.teachableEnd ?? d.deepRoad.cap : null;
    return [
        c && c.elements.length ? nfact('elements', c.elements.join(', ')) : '',
        c ? nfact('arts', String(c.arts.length)) : '',
        c && c.hardest ? nfact('to', `${c.hardest.requiredOrdinal} - ${c.hardest.grade}`) : '',
        c && c.exclusiveCount ? nfact('nowhere else', String(c.exclusiveCount), 'pin') : '',
        d.deepRoad
            ? nfact('and', `a road to the top${roadEnd === null ? '' : `, teachable to ${roadEnd}`}`, 'pin')
            : ''
    ];
}

/**
 * The four questions that decide whether a seal is an asset.
 *
 * Who is down there, why they agreed, whether they know what waking will mean,
 * and where the resources for it went. Printed only where the catalog answers
 * them - a house that cannot is in a materially different position from one
 * that can, and filling the gap with a placeholder would erase the distinction
 * the fields exist to record.
 *
 * Opens on the public story rather than the private one. What a reader outside
 * the four people who know is going to meet first is the account the house gave
 * at the time, and the rest of the block is what that account is covering.
 */
function sealedDetail(sl: RegisterSealed, onTheRoll: string | null): string {
    const rows: [string, string | null][] = [
        ['On the roll', onTheRoll],
        ['Resting place', sl.restingPlace],
        ['Who he is', sl.whoTheyAre],
        ['Sealed before the crossing', sl.sealedBefore],
        ['Knows what he is for', sl.knowsWhatFor],
        ['Where the output went', sl.resourcesWent]
    ];
    const present = rows.filter(([, v]) => v);
    if (!present.length) return '';
    return `<div class="sealblk"><dl>${present
        .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v as string)}</dd>`)
        .join('')}</dl></div>`;
}

/**
 * The two numbers, at the top of every entry, with the gap between them named.
 *
 * Deliberately the first thing in the body. A reader deciding whether to cross
 * this faction needs the one-off before they need anything else, and the old
 * entry had the ceiling as a chip in the header and the cost of spending it
 * nowhere at all.
 */
function fieldedBlock(f: RegisterFielded): string {
    const gap = f.ceiling === null
        ? ''
        : `<dt>The gap</dt><dd><b>${f.ceiling - f.acting} rungs</b>, and it is one use. `
            + (f.ceilingIsPublic
                ? 'Rivals know it is there.'
                : 'Nobody outside the house knows it is there, so anybody pricing this faction off the first figure is pricing it low.')
            + '</dd>'
            + (f.wakeCondition ? `<dt>What makes it real</dt><dd>${esc(f.wakeCondition)}</dd>` : '')
            + (f.wakeCost ? `<dt>What it costs</dt><dd>${esc(f.wakeCost)}</dd>` : '');

    // Three rows rather than one, and the split is the correction. The sheet
    // printed `reliableOrdinal` as though it were a limit and it is not: it is
    // what a house turns out ROUTINELY. What is available to somebody standing
    // there now is bounded by who is alive to teach them, and what has been
    // reached from inside the house at all is bounded by nothing but the
    // ladder. On the sharpest entry in the catalog all three disagree wildly,
    // and that has to read as remarkable rather than as a contradiction.
    const p = f.produces;
    const produces = p
        ? `<dt>Turns out routinely</dt><dd>`
            + (p.takesNobody
                // Arithmetically correct and completely misleading as a
                // sentence: a body with no intake produces nothing from an
                // intake it does not have. It has not produced nobody.
                ? `<span class="dim">Nothing, and the figure is not a measurement. `
                    + `It takes nobody, so there is no intake for a pipeline to run on - `
                    + `what this house has produced is on the roll below, not in this row.</span>`
                // The same failure from the other direction, on a house that
                // does admit and admits nobody who needs the pipeline: a
                // routine figure below the gate is a statement about the gate.
                : p.reliableOrdinal < p.gateOpensAt
                ? `<span class="dim">Nothing that means anything. `
                    + `Its gate opens at <b>${p.gateOpensAt}</b>, so everybody who has ever walked in `
                    + `was already past where a pipeline would start, and nothing has been walked up from `
                    + `the bottom because there is no bottom here.</span>`
                : `<b>${p.reliableOrdinal}</b> (${esc(p.reliableRank)}), `
                    + `with ${p.currentCount} at or above it. Its pipeline's best was `
                    + `<b>${p.peakOrdinal}</b> (${esc(p.peakRank)}), ${p.peakCount} of them, `
                    + `${p.yearsSinceLastPeak.toLocaleString()} years ago.`)
            + ` ${esc(p.note)}</dd>`
            + `<dt>Reachable here now</dt><dd><b>${p.taughtCeiling}</b> (${esc(p.taughtCeilingRank)}) - `
            + `bounded by who is alive to teach it and by nothing else. `
            + (p.takesNobody
                ? 'Nobody is being taught here, so this is what the house could walk somebody to if it ever chose to.'
                : p.taughtCeiling > p.reliableOrdinal
                    ? `The routine figure is ${p.taughtCeiling - p.reliableOrdinal} rungs under this and is not a ceiling on it: `
                        + 'it is what happens without a prodigy, without a matched root and without anything arriving from outside.'
                    : 'Which is the routine figure, so this house walks everybody as far as anybody here has been.')
            + `</dd>`
            + (p.everReached && p.everReached.ordinal > p.taughtCeiling
                ? `<dt>Reached from here, ever</dt><dd><b>${p.everReached.ordinal}</b> (${esc(p.everReached.rank)}) - `
                    + `${esc(p.everReached.name)}, ${p.everReached.yearsAgo.toLocaleString()} years ago. `
                    + 'Bounded by the ladder and nothing else. A book carries somebody to the end of a realm and the '
                    + 'crossing is in no book, so everything past this house\'s own shelf came from somewhere else - '
                    + 'which is exactly why the first figure is not a limit on this one.</dd>'
                : '')
        : '';

    const withdrawn = f.withdrawn
        ? `<dt>Withdrawn</dt><dd>${f.withdrawn.count} seats out of the world entirely - `
            + f.withdrawn.seats.map(x => `${esc(x.position)} at ${x.ordinal}`).join(', ')
            + `. ${esc(f.withdrawn.occupiedBy)}</dd>`
        : '';

    return `<div class="assess"><dl>
    <dt>Can field now</dt><dd><b>${f.acting}</b> &middot; ${esc(f.actingRank)}${f.canProjectLastRealm ? ' &middot; and can send somebody at the last realm away from home, which almost nothing can' : ''}</dd>
    <dt>Could field once</dt><dd>${f.ceiling === null
        ? '<span class="dim">Nothing held back. The first figure is the whole of it.</span>'
        : `<b>${f.ceiling}</b> &middot; ${esc(f.ceilingRank as string)}`}</dd>
    ${gap}
    ${produces}
    ${withdrawn}
  </dl></div>`;
}

/**
 * How the one body that hardly ever appears is nevertheless known.
 *
 * On one entry, because it is one house's practice. It sits with the people
 * rather than with the history, because every sentence in it is about what
 * happens when one of them is in a room with somebody who is not - which is a
 * fact about the roster above it and about nothing else.
 */
function howTheCourtIsSeenBlock(): string {
    const rows: [string, string][] = [
        ['Where they are seen at all', HOW_THE_COURT_IS_SEEN.whereTheyAreSeenAtAll],
        ['Masked', HOW_THE_COURT_IS_SEEN.masked],
        ['Why the anonymity is worth having', HOW_THE_COURT_IS_SEEN.whyItIsWorthIt],
        ['Why they do not talk', HOW_THE_COURT_IS_SEEN.whyTheyDoNotTalk],
        ['And sometimes they do', HOW_THE_COURT_IS_SEEN.andSometimesTheyDo],
        ['Why nobody can be sure which is which', HOW_THE_COURT_IS_SEEN.andWhyNobodyCanBeSure]
    ];
    return '<div class="grp"><h4>How they are seen <span>6</span>'
        + '<span class="gap">famous, and impossible to place</span></h4>'
        + '<p class="note">Admission is public: somebody watched each of these people walk up the mountain, and '
        + 'the province can name every one of them. What it cannot do is join that list to the working names it '
        + 'hears afterwards. <strong>This sheet carries both, because it is the record rather than a thing '
        + 'anybody in the world is reading.</strong></p>'
        + `<dl class="hist">${rows.map(([k, v]) => `<dt>${esc(k)}</dt>${chunkedDd(v)}`).join('')}</dl>`
        + '</div>';
}

/**
 * The road to the top of the ladder, and what stands between it and a reader.
 *
 * Three figures lead, because they are the ones a reader would otherwise take
 * off a teach list and get wrong: how many copies exist, how many people can
 * teach it, and how far the best of those people can actually carry somebody.
 * The last of those is not authored anywhere - it is the technique layer's own
 * rule applied to the house's own seats - and on three of the four holders it
 * comes out below the end of their own book.
 */
function deepRoadBlock(r: RegisterDeepRoad): string {
    const teachers = r.teachers.map(t =>
        `<div class="who"><span class="wn">${esc(t.who)}</span>`
        + `<span class="wo">${t.realmOrdinal}</span>`
        + `<span class="wr">${esc(rankName(t.realmOrdinal))}</span>`
        + `<span class="wd">${esc(t.availability)}</span></div>`).join('');

    const rows: string[] = [
        `<dt>Copies in the house</dt><dd><b>${r.copies}</b>.</dd>`,
        `<dt>Why that many</dt>${chunkedDd(r.whyThatManyCopies)}`,
        `<dt>How a reader gets one</dt>${chunkedDd((r.access === 'lent' ? 'Lent, and it goes back. ' : 'Read where it sits; it does not leave the room. ') + r.accessTerms)}`,
        `<dt>Who can teach it</dt><dd><b>${r.teachers.length}</b>.</dd>`,
        `<dt>What that is worth</dt>${chunkedDd(r.capacityNote)}`,
        `<dt>How far they can take you</dt><dd><b>${r.carriesTo}</b> &middot; ${esc(r.carriesToRank)}`
            + (r.cap === null
                ? ', against a book that ends nowhere.'
                : r.canFinishIt
                    ? `, and the book ends at ${r.cap}${r.teachableEnd !== null && r.teachableEnd < r.cap
                        ? ` - of which ${r.teachableEnd} is the highest rung anybody can be taught to, because the last is reached by surviving the crossing and by nothing else`
                        : ''}. This house can walk somebody to the end of its own road.`
                    : `, and the book ends at ${r.cap}. `
                        + `The last ${(r.teachableEnd ?? r.cap) - r.carriesTo} teachable rung`
                        + `${(r.teachableEnd ?? r.cap) - r.carriesTo === 1 ? '' : 's'} have no teacher anywhere and have to be walked alone.`)
            + '</dd>',
        `<dt>What the opening costs</dt><dd>${r.opening
            ? `The first ${r.opening.rungs} rungs run at ${Math.round(r.opening.rateMultiplier * 100)}% of ordinary progress. A hard stretch of somebody else's shorthand before the road opens up.`
            : 'Nothing. There is no bad stretch anywhere in it, which is what separates this road from every other one at its height - the same reach, and a fraction of the cost to walk.'}</dd>`,
        `<dt>Where the teaching comes from</dt>${chunkedDd(r.whereTheTeachingComesFrom)}`
    ];
    if (r.gradedByStanding) {
        rows.push(`<dt>And who gets how much</dt>${chunkedDd(r.gradedByStanding)}`);
    }

    // THE LEVEL ON THE HEADING IS THE TEACHABLE END, not the cap. The cap is
    // where the paper stops, and on a road covering the last realm the final
    // rung is reached by surviving the crossing and by nothing else - so a cap
    // quoted as a level is a rung no house can walk anybody onto. The cap is
    // still inside the block below, where it is explicitly set against the
    // teachable end, which is the one place it means what it says.
    const headEnd = r.teachableEnd ?? r.cap;
    return `<div class="grp deeproad"><h4>The road to the top of the ladder <span>1</span>`
        + `<span class="gap">${esc(r.roadName)}${headEnd === null ? '' : ` &middot; teachable to ${headEnd}`} &middot; ${r.copies} cop${r.copies === 1 ? 'y' : 'ies'} &middot; ${r.teachers.length} who can teach it</span></h4>`
        + `<dl class="hist">${rows.join('')}</dl>`
        + `<h4>Who can carry somebody up it <span>${r.teachers.length}</span></h4>`
        + teachers
        + '</div>';
}

/**
 * What each warmth word means, printed where it is used rather than only in the
 * key, because a one-word column that needs a lookup is a column nobody reads.
 *
 * THE GLOSS IS A REMINDER AND NEVER A RESCUE. A reader meets the word before
 * they reach the bracket, so any word that needs the bracket to avoid being
 * misread has already been misread. `correct` failed exactly that way for a
 * long time here - it was meant in the formal-manners sense and every reader
 * took it to mean "accurate" - and the fix was the word, not a longer gloss.
 * It is `civil` now. Nothing on this list is doing that any more: warm, civil,
 * distant, wary, cold and hostile each mean in this scale what they mean in a
 * sentence, and the glosses below only say how far each one goes.
 */
const WARMTH_GLOSS: Record<Warmth, string> = {
    warm: 'glad of them, and will spend on them unasked',
    civil: 'the forms observed, and nothing past them',
    distant: 'no ill will and no contact; nobody maintains this one',
    wary: 'useful, watched, and not left unattended',
    cold: 'the forms observed, and the warmth deliberately withheld',
    hostile: 'acted against, or would be if the cost fell'
};

const STANCE_HEADS: Record<RegisterRelationship['stance'], { label: string; gloss: string; badge: string }> = {
    above: {
        label: 'Who backs it',
        gloss: 'the bodies it answers to, and how warm that is from each end',
        badge: 'backs it'
    },
    alongside: {
        label: 'Who stands level with it',
        gloss: 'neither above nor below - rivals, claimants, and bodies under the same roof',
        badge: 'level'
    },
    below: {
        label: 'Who it backs',
        gloss: 'the bodies that answer to it, and how it treats them',
        badge: 'it backs'
    }
};

type RelStance = RegisterRelationship['stance'];

/**
 * One relationship card, and the only place a direction is written down.
 *
 * A tie states its direction TWICE, on purpose: as the colour of the card's own
 * left rule, which is what a reader decodes scanning the page from a distance,
 * and as a badge repeating that colour, because a coloured bar on its own is a
 * legend lookup. Both class strings are spelled here and nowhere else, so a
 * card cannot carry the badge without the rule or the rule without the badge.
 *
 * IT IS ONE FUNCTION RATHER THAN A CLASS STRING AT EACH SITE because it was
 * previously the latter, and the page could not then be counted. The key at the
 * head of the section drew three sample badges of its own, so a census of the
 * rendered sheet found 238 badges against 124 coloured containers and read as
 * 114 rows that had lost their rule. Every one of the 114 was a key sample
 * (38 entries carry the section, three badges apiece) and no row was ever
 * missing its colour - but nothing in the markup distinguished the two cases,
 * which is the defect this closes. The key now renders through this function
 * like everything else, so badges and containers reconcile per direction by
 * construction rather than by argument, and the key gains the thing it was
 * missing: it shows the RULE as well as the badge, which is the mark a reader
 * is actually decoding.
 */
function relCard(stance: RelStance, who: string, body: string): string {
    return `<div class="rel rel--${esc(stance)}">`
        + `<div class="relh">`
        + `<span class="relwho">${who}</span>`
        + `<span class="reldir ${esc(stance)}">${esc(STANCE_HEADS[stance].badge)}</span>`
        + `</div>`
        + body
        + `</div>`;
}

/**
 * What the tie IS, as a noun phrase, read from the other body's side.
 *
 * The register used to print `kind` raw - "apex and court", "patron and
 * client" - which is a token out of an enum and not a sentence. It told a
 * reader who already knew the schema nothing new and a reader who did not know
 * it nothing at all. The same tie also reads differently from each end, so
 * there are two phrasings and the stance picks one: the body above is the apex
 * a court answers to, and the body below is a court administering one of its
 * veins. One fact, two sentences, and neither of them is an enum.
 */
const TIE_PHRASE: Record<string, { fromBelow: string; fromAbove: string; level: string }> = {
    patron_and_client: {
        fromBelow: 'the house it holds its ground from, on stated terms',
        fromAbove: 'a tenant holding ground from it on stated terms',
        level: 'a grant between them'
    },
    apex_and_court: {
        fromBelow: 'the apex whose arterial vein it administers',
        fromAbove: 'a court administering one of its arterial veins',
        level: 'a court and the apex over it'
    },
    apex_and_posting: {
        fromBelow: 'the apex that appoints into its posting',
        fromAbove: 'a posting it appoints into, staffed by nobody who applied',
        level: 'a posting and the apex that fills it'
    },
    severed_patronage: {
        fromBelow: 'the apex it answered for nine hundred years and does not any more',
        fromAbove: 'a body that used to answer to it and walked',
        level: 'a patronage that ended'
    },
    administration: {
        fromBelow: 'the house it is the staff of, rather than a tenant of',
        fromAbove: 'its own staff, rather than a tenant',
        level: 'an administration and the house it works for'
    },
    contracted: {
        fromBelow: 'the house it works for under contract, rather than under a lease',
        fromAbove: 'a contractor rather than a tenant',
        level: 'a contract between them'
    },
    two_bodies_nobody_joins: {
        fromBelow: 'the only other body in the world nobody joins',
        fromAbove: 'the only other body in the world nobody joins',
        level: 'the only other body in the world nobody joins'
    },
    same_patron: {
        fromBelow: 'another body answering the same house',
        fromAbove: 'another body answering the same house',
        level: 'another body answering the same house'
    },
    rivals: {
        fromBelow: 'a standing feud, carried on both rolls',
        fromAbove: 'a standing feud, carried on both rolls',
        level: 'a standing feud, carried on both rolls'
    },
    contested_claim: {
        fromBelow: 'a second hand on the same thing',
        fromAbove: 'a second hand on the same thing',
        level: 'a second hand on the same thing'
    },
    counter: {
        fromBelow: 'the house holding the thing that beats its own dao',
        fromAbove: 'a house whose dao it holds the answer to',
        level: 'each of them holding part of the answer to the other'
    },
    service_and_dependent: {
        fromBelow: 'a service it cannot function without',
        fromAbove: 'a house that cannot function without what it supplies',
        level: 'a service between them'
    },
    shared_event: {
        fromBelow: 'a party to the same event, with its own account of it',
        fromAbove: 'a party to the same event, with its own account of it',
        level: 'a party to the same event, with its own account of it'
    },
    tolerated: {
        fromBelow: 'a body it holds nothing over and asks nothing of',
        fromAbove: 'a body that holds nothing over it and asks nothing of it',
        level: 'a body neither of them holds anything over'
    }
};

function tiePhrase(r: RegisterRelationship): string {
    const entry = TIE_PHRASE[r.kind];
    if (!entry) return 'a tie the catalog records and this sheet has no phrasing for';
    return r.stance === 'above'
        ? entry.fromBelow
        : r.stance === 'below'
            ? entry.fromAbove
            : entry.level;
}

/**
 * The one sentence that says who stands where, in words rather than in fields.
 *
 * `stance` is stored from the point of view of the OTHER body - above means
 * they are above this one - so a sentence that named only one party would read
 * backwards half the time. It names both.
 */
function standingSentence(r: RegisterRelationship, name: string): string {
    if (r.stance === 'above') return `${r.otherName} stands above ${name}`;
    if (r.stance === 'below') return `${name} stands above ${r.otherName}`;
    return `${r.otherName} stands level with ${name}`;
}

/**
 * How each side feels, as a sentence, with the meaning of the word beside it.
 *
 * The two warmth words used to be printed as bare tokens with the string "and
 * back" between them, which is internal bookkeeping wearing a label. A reader
 * has one question here - do these two like each other, and does it run both
 * ways - and it is answered in a sentence or it is not answered.
 */
function warmthSentence(r: RegisterRelationship, name: string): string {
    const mine = `${esc(name)} is <b>${esc(r.warmth)}</b> toward them (${esc(WARMTH_GLOSS[r.warmth])})`;
    // The gloss and then stop. A mismatch used to be followed by two lines
    // explaining that warmth is stored at each end and a tie is stored once -
    // true, worth saying, and a fact about the DATABASE rather than about the
    // world. It rendered 28 times on one sheet. The reader can see that the two
    // words differ; being told what that means about the schema is the machine
    // talking. Said once now, in the section note above.
    const theirs = r.warmth === r.theirWarmth
        ? ', and is met with the same.'
        : `, and is met with <b>${esc(r.theirWarmth)}</b> (${esc(WARMTH_GLOSS[r.theirWarmth])}).`;
    return mine + theirs;
}

/**
 * How a body stands with everything around it. Last on the entry.
 *
 * WHAT A READER SEES AND WHAT THEY DO NOT. Everything in the reading line is a
 * sentence. The stored fields - the warmth enum, the tie kind, and which table
 * the row came out of - are this sheet's own bookkeeping, and printing them raw
 * was the defect this replaces: an entry that read "civil / and back /
 * civil / apex and court / from authored" was showing somebody the shape of
 * the record instead of telling them anything. Provenance is collapsed into one
 * line at the foot of the section, which is where this sheet puts detail only
 * somebody checking the data wants.
 *
 * DIRECTION IS COLOUR, not a heading. The question a reader arrives with is who
 * backs this house and whom it backs, and three headed lists do not answer that
 * until they have been read. Every row carries its stance on its own left rule
 * and in a badge, so the two directions separate before a word is read - and
 * the grouping stays, because a reader comparing all the patrons wants them
 * adjacent.
 *
 * THE RULES MATCH THE EVENTS BLOCK. One heavier rule down the left of the whole
 * section and a lighter one on each row, which is the grammar `.evts` and
 * `.evt` already use for the same kind of material. No new layout.
 */
// ─────────────────────────────────────────────────────────────────────────
// TIES: THE RESUME STRIP, AND THE PAGE THAT OWNS THE RECORD
//
// WHAT THIS REPLACED AND WHY. Every faction entry used to carry its whole
// relationship dossier - a card per tie, each with what the tie is, when it
// started, how this house puts it, what it does about it, and the grievance.
// Thirty-eight entries carried it and every tie was written out twice, once
// inside each party's entry, so a single feud produced two near-identical
// four-paragraph blocks and the sheet carried the general rule "a feud the
// other party has not heard about is not a feud" once per feud.
//
// A faction entry is a resume. It says what a body IS in the time somebody
// spends deciding whether they care, and four screens of correspondence is not
// that. So the entry keeps the SHAPE of a house's position - how many ties,
// running which way, how warm at each end - as a strip of chips that is read at
// a glance, and the record itself moved to the Ties tab, where each pair is
// written ONCE.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The direction glyph, which is the accessible half of the colour.
 *
 * Direction is carried by the reserved plum/moss/grey palette AND by this
 * mark, never by the palette alone: about one man in twelve cannot separate
 * two of those hues, and a strip that meant nothing to them would be a strip
 * that meant nothing. The counts sentence above the strip says the same fact
 * a third time, in words.
 */
const STANCE_MARK: Record<RelStance, string> = {
    above: '&#9650;',      // pointing up: this body stands over the house
    alongside: '&#9679;',  // level
    below: '&#9660;'       // pointing down: this body answers to the house
};

const STANCE_WORD: Record<RelStance, string> = {
    above: 'stands over it',
    alongside: 'level with it',
    below: 'answers to it'
};

/**
 * The two ends of the warmth scale, found by position rather than by name.
 *
 * `Warmth` is an ordered list from `warm` to `hostile` and the ordering is the
 * whole of its meaning, so the ends are read off the length rather than written
 * out as two lists of words. A seventh word added to the scale shifts these on
 * its own; a seventh word added to a hardcoded list would be silently absent
 * from both bands, which is the failure this shape exists to prevent.
 *
 * The middle - civil, distant, wary - is not a band and gets no summary line.
 * That is most of the world, it is where a body sits with everybody it has no
 * particular feeling about, and counting it would drown the two ends that
 * actually say something.
 */
const WARMTH_SCALE: readonly Warmth[] = ['warm', 'civil', 'distant', 'wary', 'cold', 'hostile'];
const warmthRank = (w: Warmth): number => Math.max(0, WARMTH_SCALE.indexOf(w));
/** Glad of them, and will spend on them unasked. The warm end, which is narrow. */
const isClose = (w: Warmth): boolean => warmthRank(w) === 0;
/** Warmth deliberately withheld, or acted against. The cold end, which is two words. */
const isAtOdds = (w: Warmth): boolean => warmthRank(w) >= WARMTH_SCALE.length - 2;

/**
 * How a house's position in the world looks at a glance, and nothing else.
 *
 * TWO QUESTIONS, NOT ONE, and this is the correction that produced this pass.
 * The block answered only where a body sits on the ladder - so many above it,
 * so many under it - and the design owner's verdict was that a house "also has
 * enemies, competitors, friends, which are outside the rung". Every one of
 * those was already in the catalog and none of it reached the page: warmth was
 * printed as two bare words at the tail of a chip, and what two bodies are both
 * reaching for was not printed at all.
 *
 * So the summary line now answers both. Where it stands is the ladder. How it
 * stands is the warm end of the warmth scale, the cold end of it, and whether
 * there is an object the two of them both have a hand on - which is a separate
 * fact from either, and is the one that makes the Kiln pair legible: they are
 * scrupulously civil and they are contending over the founding they both
 * descend from.
 *
 * NOT A TAXONOMY, and this is the constraint the shape had to meet. Nothing
 * here branches on what KIND of tie it is. There are two derived facts - a
 * position on an ordered scale, and whether an intersection is empty - and a
 * tenth kind of relationship needs no new code in this function at all.
 *
 * One chip per tie: the direction as a mark and a colour, the other body's
 * name, the two warmths with an arrow between them - `cold &rarr; civil`
 * meaning this house is cold to them and they are civil back - and a mark where
 * the two are contending. The chip opens the pair's full account on the Ties
 * tab. Nothing here is a summary OF that account; it is the index to it, and
 * the reasons, the histories and the claims themselves live there.
 */
function relSummaryStrip(rels: RegisterRelationship[], name: string, selfAnchor: string): string {
    if (!rels.length) {
        return foldablePart('Who it knows', 'nothing recorded, which is a hole in the data',
            `<p class="none">Nothing in the catalog puts ${esc(name)} in relation to any other body. `
            + 'That is a hole in the data rather than a house that stands alone: every faction holds from '
            + 'somebody, is held from, is contested, or was in a room when something happened.</p>');
    }

    const above = rels.filter(r => r.stance === 'above').length;
    const below = rels.filter(r => r.stance === 'below').length;
    const level = rels.filter(r => r.stance === 'alongside').length;
    const close = rels.filter(r => isClose(r.warmth)).length;
    const odds = rels.filter(r => isAtOdds(r.warmth)).length;
    const contesting = rels.filter(r => r.contestedOver.length > 0).length;

    // THE LADDER FIRST, THEN THE THREE THE OWNER ASKED FOR. Separated by a
    // dash rather than a comma, because they are answers to two different
    // questions and a single comma list read as one undifferentiated heap -
    // which is how the ladder counts came to be the only thing anybody saw.
    const ladder = [
        above ? `${above} over it` : '',
        level ? `${level} level` : '',
        below ? `${below} under it` : ''
    ].filter(Boolean).join(', ');
    const feeling = [
        close ? `close to ${close}` : '',
        odds ? `at odds with ${odds}` : '',
        contesting ? `contesting with ${contesting}` : ''
    ].filter(Boolean).join(', ');
    const counts = [ladder, feeling].filter(Boolean).join(' - ');

    // Sorted the way the counts are read, so the strip and the sentence above
    // it are in the same order and one confirms the other.
    const order: RelStance[] = ['above', 'alongside', 'below'];
    const chips = [...rels]
        .sort((a, b) => order.indexOf(a.stance) - order.indexOf(b.stance)
            || a.otherName.localeCompare(b.otherName))
        // A LIST ITEM PER CHIP, and a printed separator inside each one. Both
        // for the same reason: this sheet gets copied out of the browser, and
        // separation that lives only in a gap or a border does not survive
        // that. Flattened, a strip of styled spans came out as
        // "The Deep Surveycold civilNine Abyss Flame Sect...".
        .map(r => {
            // WARMTH IN THE WARMTH COLOURS, WHICH ALREADY EXIST. `.warm-*` is
            // the vocabulary the Ties tab has always used for these six words,
            // built out of the sheet's own tokens - so this introduces no
            // palette and a reader who has met the words on one tab meets the
            // same colours here. Direction keeps plum/moss/grey and its glyph,
            // untouched: those two hues mean direction on this page and nothing
            // else, and that separation was itself a correction.
            const contesting = r.contestedOver.length > 0;
            const over = contesting
                ? ` They both have a hand on ${r.contestedOver.length === 1 ? 'one thing' : `${r.contestedOver.length} things`}: ${r.contestedOver.map(c => c.from).join(', ')}.`
                : '';
            return `<li class="relchip relchip--${esc(r.stance)}${contesting ? ' relchip--contesting' : ''}"`
                + ` data-goto="${esc(tieAnchor(selfAnchor, r.anchor, r.otherName))}"`
                + ` title="${esc(`${r.otherName} ${STANCE_WORD[r.stance]}. ${name} is ${r.warmth} toward them: ${WARMTH_GLOSS[r.warmth]}.${over} What they make of ${name} is on their own entry.`)}">`
                + `<span class="relchip__mark" aria-hidden="true">${STANCE_MARK[r.stance]}</span>`
                + `<span class="relchip__who">${esc(r.otherName)}</span>`
                + '<span class="nsep"> &middot; </span>'
                // ONE DIRECTION. This printed `cold &rarr; civil` - this
                // house's warmth and the other's, side by side - and the design
                // owner's ruling is that the reciprocal belongs on the other
                // house's own entry and nowhere else. The reader of THIS entry
                // has one subject and one question, and every row answers it
                // the same way: what does this house think of that one. The
                // other half is one click away and is that house's business.
                + `<span class="relchip__warm warm-${esc(r.warmth)}">${esc(r.warmth)}</span>`
                // The contention mark carries a word beside it rather than
                // standing alone. A bare glyph on a strip that already has one
                // is a second thing to look up, and this block has been
                // reported once already for exactly that.
                + (contesting
                    ? '<span class="nsep"> &middot; </span>'
                        + `<span class="relchip__over">contesting ${r.contestedOver.length === 1 ? 'a claim' : `${r.contestedOver.length} claims`}</span>`
                    : '')
                + '</li>';
        })
        .join('');

    // THE KEY GOES WHERE THE CHIPS ARE, and this reverses an earlier ruling.
    // It said the glyphs were explained once at the top of the tab and never
    // per house. That is true of the markup and false of the reading: the key
    // sits above thirty-four entries, this block sits inside a fold inside one
    // of them, and a reader who opens a house is nowhere near it. The design
    // owner read `&#9679; Azure Cloud Pavilion &middot; wary &rarr; cold` and
    // asked what it meant, which is the whole argument.
    //
    // It is one short line, emitted as its own element rather than at the tail
    // of a note - a key folded into a disclosure is a key nobody reads, and
    // that has happened on this exact block before.
    const key = '<p class="dirkey">'
        + `<span class="relchip relchip--above"><span class="relchip__mark">${STANCE_MARK.above}</span>`
        + '<span class="relchip__who">stands over it</span></span>'
        + `<span class="relchip relchip--alongside"><span class="relchip__mark">${STANCE_MARK.alongside}</span>`
        + '<span class="relchip__who">level with it</span></span>'
        + `<span class="relchip relchip--below"><span class="relchip__mark">${STANCE_MARK.below}</span>`
        + '<span class="relchip__who">answers to it</span></span>'
        + `<span class="dirkey__arrow">the warmth word is ${esc(name)}'s own view outward; what they make of it is on their entries</span></p>`;

    return foldablePart('Who it knows', counts,
        key + `<ul class="relstrip">${chips}</ul>`);
}

/**
 * Where the pair's record sits on the Ties tab. Stable from either end.
 *
 * KEYED ON THE SHEET ANCHORS AND NOT ON THE NAMES. A body is filed under two
 * ids about half the time and prints under whichever name its own catalog
 * uses, so a name key resolves to two different strings from the two ends of
 * the same tie - which is a chip pointing at nothing. Two of them did: the
 * Azure Mist Court is a court and a sect and its two neighbours reached it by
 * the name the other catalog uses. `anchor` has already been resolved through
 * the register's own id-collapsing, so both ends agree by construction.
 *
 * A body with no entry at all falls back to its name, which is fine because
 * there is then nothing on either side to disagree with.
 */
function tieAnchor(selfAnchor: string, otherAnchor: string | null, otherName: string): string {
    const other = otherAnchor ?? `name-${otherName}`;
    const key = [selfAnchor, other].map(x => x.toLowerCase()).sort().join('--');
    return `tie-${key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 96);
}

/** One pair, seen from both ends, assembled once. */
interface TiePair {
    anchor: string;
    aId: string;
    aName: string;
    aAnchor: string | null;
    bName: string;
    bAnchor: string | null;
    /** Where B stands relative to A. */
    stance: RelStance;
    kind: string;
    source: string;
    what: string;
    since: string;
    /** How A regards B, and how B regards A. */
    aWarmth: Warmth;
    bWarmth: Warmth;
    aPutsIt: string;
    aDoes: string;
    aGrievance: string | null;
    /** Filled when the other end's entry was seen too, which is the usual case. */
    bPutsIt: string | null;
    bDoes: string | null;
    bGrievance: string | null;
    /** True where neither body holds from the other. The lateral ties. */
    lateral: boolean;
    /**
     * The A-side relationship row, kept whole.
     *
     * So that the sentence helpers this sheet already has - what the standing
     * is, what the tie is called in words, how warm it is from each end - are
     * called rather than reimplemented. Every one of those sentences is the
     * catalog's phrasing assembled by code that was already right; this pass
     * moved where they are printed, not what they say.
     */
    rel: RegisterRelationship;
}

/**
 * Every tie in the world, once.
 *
 * The catalog stores a tie on both parties, which is correct - a house's own
 * entry has to be readable on its own - and it means the register meets each
 * one twice. Collapsing on the pair is what takes the relations page from two
 * partisan accounts printed apart to one row with both accounts on it, which
 * is also the only shape in which the disagreement between them is visible.
 */
function buildTiePairs(
    dossiers: readonly SectDossier[],
    courts: readonly RegisterCourt[]
): TiePair[] {
    const byAnchor = new Map<string, TiePair>();

    // Both catalogs, because the two courts with no faction row of their own
    // carry ties like anything else - and one of them is a party to the largest
    // unresolved question in the region. Dropped from this pass, their chips
    // would point at a record nothing had rendered.
    const bodies: { id: string; name: string; anchor: string; relationships: RegisterRelationship[] }[] = [
        ...dossiers.map(d => ({ id: d.id, name: d.name, anchor: `faction-${d.id}`, relationships: d.relationships })),
        ...courts
            .filter(court => !dossiers.some(d => idsForFaction(d.id).includes(court.id)))
            .map(court => ({ id: court.id, name: court.name, anchor: `court-${court.id}`, relationships: court.relationships }))
    ];

    for (const d of bodies) {
        for (const r of d.relationships) {
            const anchor = tieAnchor(d.anchor, r.anchor, r.otherName);
            const seen = byAnchor.get(anchor);
            if (seen) {
                // The second end. Only the partisan fields differ; `what`,
                // `since` and `kind` are the pair's and are already stored.
                if (seen.bName === d.name) {
                    seen.bPutsIt = r.howTheyPutIt;
                    seen.bDoes = r.andSoTheyDo;
                    seen.bGrievance = r.grievance;
                }
                continue;
            }
            byAnchor.set(anchor, {
                anchor,
                aId: d.id,
                aName: d.name,
                aAnchor: d.anchor,
                bName: r.otherName,
                bAnchor: r.anchor,
                stance: r.stance,
                kind: r.kind,
                source: r.source,
                what: r.what,
                since: r.since,
                aWarmth: r.warmth,
                bWarmth: r.theirWarmth,
                aPutsIt: r.howTheyPutIt,
                aDoes: r.andSoTheyDo,
                aGrievance: r.grievance,
                bPutsIt: null,
                bDoes: null,
                bGrievance: null,
                lateral: r.stance === 'alongside',
                rel: r
            });
        }
    }
    return [...byAnchor.values()].sort((x, y) => x.aName.localeCompare(y.aName)
        || x.bName.localeCompare(y.bName));
}

/**
 * WHAT THIS IS NOT: A GRID.
 *
 * The first draft of this page was a square of every body against every other,
 * and it was the wrong object twice over. A pair with nothing between them is
 * not a fact worth a cell, so the square was mostly blanks - and blanks are the
 * one thing a grid renders emphatically. Then the feudal edges came out of it,
 * because who holds from whom is a hierarchy and the org chart on the Factions
 * tab already draws it better than any plane can: indentation carries that
 * meaning with no notation at all, and a grid restating those edges would be
 * the copy-rather-than-cross-reference failure in a new shape.
 *
 * What is left is a short list, so a list is what it is. One line per tie, both
 * warmths on it, and the direction of the pair said once in the header instead
 * of on every row. It wraps at every viewport, it needs no scroll container,
 * and it has no empty-cell problem because a pair that does not exist is simply
 * not a line.
 *
 * The tie cards below ARE that list - each one's closed summary is the line -
 * so the index and the record cannot drift apart, because they are one object.
 */
/**
 * Every tie, filed under BOTH of its parties.
 *
 * A pair is still built once - `buildTiePairs` collapses the catalog's two
 * halves onto one object with both accounts on it, and that is what makes the
 * disagreement between them visible. What changed is where the object is
 * printed. The design owner asked for the Ties tab to carry the same house
 * structure the Factions tab carries: you click a house, and it tells you the
 * ties that house has. A tie belongs to two houses, so it is printed under
 * two, off one record, by one function.
 *
 * ONLY ONE COPY CARRIES THE ANCHOR. Every `data-goto` on the sheet points at
 * a tie by the pair's canonical id, so exactly one rendering may hold it -
 * the copy under the first-named party, which is deterministic because the
 * anchor is built from the two ids sorted. The mirror is the same record with
 * no id, which is also what keeps the sheet's ids unique.
 */
function tiesByBody(pairs: readonly TiePair[]): Map<string, { pair: TiePair; canonical: boolean }[]> {
    const out = new Map<string, { pair: TiePair; canonical: boolean }[]>();
    const put = (anchor: string | null, pair: TiePair, canonical: boolean): void => {
        if (!anchor) return;
        if (!out.has(anchor)) out.set(anchor, []);
        out.get(anchor)!.push({ pair, canonical });
    };
    for (const p of pairs) {
        put(p.aAnchor, p, true);
        put(p.bAnchor, p, false);
    }
    // Read in the order the direction key is read: what stands over this house,
    // then what is level with it, then what answers to it. Relative to the
    // house whose list this is, which is not the stored direction on half of
    // them - the record is filed from one end and read from both.
    const order: RelStance[] = ['above', 'alongside', 'below'];
    for (const [anchor, list] of out) {
        list.sort((x, y) => order.indexOf(stanceFrom(x.pair, anchor))
            - order.indexOf(stanceFrom(y.pair, anchor))
            || otherEnd(x.pair, anchor).localeCompare(otherEnd(y.pair, anchor)));
    }
    return out;
}

/** Where the other party stands, from the point of view of one end. */
function stanceFrom(p: TiePair, anchor: string): RelStance {
    if (p.aAnchor === anchor) return p.stance;
    return p.stance === 'above' ? 'below' : p.stance === 'below' ? 'above' : 'alongside';
}

/** The party at the other end of a tie from the body whose page this is. */
function otherEnd(p: TiePair, anchor: string): string {
    return p.aAnchor === anchor ? p.bName : p.aName;
}

/** Every tie one body has, in full, on that body's own card. */
function tiesOfHouse(
    anchor: string,
    index: ReadonlyMap<string, { pair: TiePair; canonical: boolean }[]>
): string {
    const list = index.get(anchor) ?? [];
    if (!list.length) {
        return '<p class="none">Nothing in the catalog puts this body in relation to any other. '
            + 'That is a hole in the data rather than a house that stands alone: every faction holds from '
            + 'somebody, is held from, is contested, or was in a room when something happened.</p>';
    }
    return list.map(x => tieCard(x.pair, { emitId: x.canonical, from: anchor })).join('');
}

/** How a body's ties read at a glance, for its closed card. */
function tieFacts(
    anchor: string,
    index: ReadonlyMap<string, { pair: TiePair; canonical: boolean }[]>
): string[] {
    const list = index.get(anchor) ?? [];
    const at = (s: RelStance): number => list.filter(x => stanceFrom(x.pair, anchor) === s).length;
    const above = at('above');
    const level = at('alongside');
    const below = at('below');
    // THIS HOUSE'S OWN WARMTH, NOT THE OTHER END'S. This read the far side and
    // reported "hostile to it" - how many bodies are hostile TOWARD this house
    // - on a card that is otherwise entirely this house's view outward. Two
    // directions on one line is the confusion the whole pass exists to remove,
    // and it is the reciprocal that has to go: it is on those bodies' own
    // cards, counted there, from their side.
    const mine = list.map(x => x.pair.aAnchor === anchor ? x.pair.aWarmth : x.pair.bWarmth);
    const close = mine.filter(isClose).length;
    const odds = mine.filter(isAtOdds).length;
    const contesting = list.filter(x => x.pair.rel.contestedOver.length > 0).length;
    return [
        nfact('knows', String(list.length)),
        above ? nfact('over it', String(above)) : '',
        level ? nfact('level with it', String(level)) : '',
        below ? nfact('under it', String(below)) : '',
        close ? nfact('close to', String(close)) : '',
        odds ? nfact('at odds with', String(odds), 'ex') : '',
        contesting ? nfact('contesting with', String(contesting), 'ex') : ''
    ];
}

/** The warmth scale, said once, where the grid is read rather than per tie. */
function warmthLegend(): string {
    return `<div class="warmkey">${(Object.keys(WARMTH_GLOSS) as Warmth[])
        .map(w => `<span class="wk warm-${esc(w)}"><b>${esc(w)}</b> ${esc(WARMTH_GLOSS[w])}</span>`)
        .join('')}</div>`;
}

/**
 * What ONE house makes of another, on that house's own entry.
 *
 * ONE SUBJECT PER ENTRY, ONE DIRECTION PER ROW. This card used to print the
 * pair: both names, both warmth words, and both partisan accounts side by side
 * in a two-column grid. The design owner's ruling is that a house's entry
 * carries that house's own view outward and nothing else - what the other body
 * makes of it belongs on the other body's entry, and is one click away.
 *
 * The argument is not layout, it is that a symmetric row cannot say the most
 * characterful thing this data holds. "A is cold to B; B has not thought about
 * A in two hundred years" is a real and common shape - the Deep Survey is
 * `distant` to a court it reposted, which is `cold` back - and printed as one
 * shared row it reads as a single mutual temperature that belongs to neither of
 * them. Read one direction at a time, each is a statement somebody is making.
 *
 * WHAT STAYS SHARED, AND WHY THAT IS NOT A CONTRADICTION. `what` and `since`
 * are the tie's facts, and the catalog defines them as the part neither party
 * disputes - a fact about the world rather than about how anybody feels. So
 * does the contention: two bodies have a hand on one object or they do not, and
 * that is not a matter of opinion either. It is the DISPOSITION that is
 * directed, and only the disposition is shown one-way.
 */
function tieCard(p: TiePair, opts: { emitId?: boolean; from?: string | null } = {}): string {
    const emitId = opts.emitId ?? true;
    // WHOSE PAGE THIS IS, AND WHY THE SUMMARY TURNS ROUND.
    //
    // A pair is stored from one end: `stance` says where B stands relative to
    // A, and the closed line prints A, then B, then A's regard and B's answer.
    // Printed unchanged under B's own house that line is not merely awkward,
    // it is WRONG - "stands over it" would be read as B standing over the
    // house the reader had just clicked, when B is that house. So the summary
    // is mirrored to the reader's viewpoint. The body is not, and does not
    // need to be: every sentence in it names both bodies outright.
    const mirrored = opts.from != null && p.bAnchor === opts.from && p.aAnchor !== opts.from;
    const firstName = mirrored ? p.bName : p.aName;
    const secondName = mirrored ? p.aName : p.bName;
    const firstWarmth = mirrored ? p.bWarmth : p.aWarmth;
    const secondWarmth = mirrored ? p.aWarmth : p.bWarmth;
    const stance: RelStance = mirrored
        ? (p.stance === 'above' ? 'below' : p.stance === 'below' ? 'above' : 'alongside')
        : p.stance;

    // Whose entry this is, and whose it is about. `mirrored` already worked out
    // that the reader is standing on B; these two names it.
    const mineName = firstName;
    const theirName = secondName;
    const theirAnchor = mirrored ? p.aAnchor : p.bAnchor;
    const myWarmth = firstWarmth;
    const myPutsIt = mirrored ? p.bPutsIt : p.aPutsIt;
    const myDoes = mirrored ? p.bDoes : p.aDoes;
    const myGrievance = mirrored ? p.bGrievance : p.aGrievance;
    // Their word for it, named but NOT printed. A reader who has just been told
    // that the other side is allowed to disagree will want to know whether it
    // does, and sending them there with no idea whether it is worth the trip is
    // its own small failure. So the line says that a second account exists and
    // where it is; it does not say what it contains.
    const theirWarmth = secondWarmth;

    const contested = p.rel.contestedOver;
    const contentionBlock = contested.length
        ? '<div class="tiecontend"><h5>What they both have a hand on</h5>'
            + `<dl class="relsides">${contested
                .map(cl => `<dt>${esc(cl.from)}</dt>${chunkedDd(cl.what)}`)
                .join('')}</dl></div>`
        : '';

    return `<details class="ncard tie rel--${esc(stance)}"${emitId ? ` id="${esc(p.anchor)}"` : ''}>
    <summary>
      <span class="nhead"><span class="nname">${esc(theirName)}</span>`
        + '<span class="rsep"> &middot; </span>'
        // ONE WORD, AND IT IS THIS HOUSE'S. The line used to carry both
        // warmths as `cold / civil` and a reader had to work out per row which
        // direction they were looking at. There is only one direction on this
        // entry now, so the word needs no side to be read against.
        + `<span class="warmtag warm-${esc(myWarmth)}">${esc(myWarmth)}</span></span>`
        + nfacts([
            // The value already contains the verb - "stands over it" - so the
            // label must not repeat it. Labelled `stands` this read
            // "stands stands over it".
            nfact('on the ladder', STANCE_WORD[stance]),
            nfact('the tie', p.kind.replace(/_/g, ' ')),
            contested.length
                ? nfact('contesting', contested.length === 1 ? 'a claim' : `${contested.length} claims`, 'ex')
                : ''
        ])
        + `<span class="ngo">open</span>
    </summary>
    <div class="nbody">
      ${relCard(p.stance, jumpTo(theirAnchor, theirName),
            `<p class="relsay">${esc(standingSentence(p.rel, p.aName))}${p.stance === 'alongside'
                ? `. Between them: ${esc(tiePhrase(p.rel))}. `
                : `, as ${esc(tiePhrase(p.rel))}. `}`
            + `${warmthSentence(p.rel, p.aName)}</p>`
            + chunked(p.what, 'the rest of what the tie is', 'relwhat')
            + `<dl class="relsides"><dt>Since</dt>${chunkedDd(p.since)}</dl>`
            + contentionBlock
            + `<div class="tieside tieside--mine"><h5>${esc(mineName)} on ${esc(theirName)} `
            + `<span class="warmtag warm-${esc(myWarmth)}">${esc(myWarmth)}</span></h5>`
            + (myPutsIt
                ? `<dl class="relsides"><dt>How they put it</dt>${chunkedDd(myPutsIt)}`
                    + (myDoes ? `<dt>And so they do</dt>${chunkedDd(myDoes)}` : '')
                    + (myGrievance ? `<dt>The grievance</dt>${chunkedDd(myGrievance)}` : '')
                    + '</dl>'
                : `<p class="none">The catalog carries this tie from ${esc(theirName)}'s end only.</p>`)
            + '</div>'
            + `<p class="tieother">${esc(theirName)} answers <span class="warmtag warm-${esc(theirWarmth)}">${esc(theirWarmth)}</span>, `
            + `and says why on ${jumpTo(theirAnchor, 'its own entry')}.</p>`)}
      <p class="prov">read from ${esc(p.source)}</p>
    </div>
  </details>`;
}

/** Who it answers to, on what terms, and what leaving would cost. */
function holdsFromBlock(h: RegisterHoldsFrom): string {
    const parent = h.parentName === null
        ? '<span class="dim">nobody - it holds what it holds outright</span>'
        : (h.parentLinkId
            ? `<span class="jump" data-goto="faction-${esc(h.parentLinkId)}">${esc(h.parentName)}</span>`
            : esc(h.parentName))
            + ` &middot; standing <b>${esc(h.standing.replace(/_/g, ' '))}</b>`;

    const terms = h.terms
        ? `<dt>Pays</dt><dd>${h.terms.tributeStonesPerYear > 0
            ? `<b>${h.terms.tributeStonesPerYear.toLocaleString()}</b> stones a year`
            : 'No stones'}`
            + (h.terms.disciplesPerCycle > 0 ? `, and <b>${h.terms.disciplesPerCycle}</b> disciples upward per cycle` : '')
            + (h.terms.inKind.length ? `. In kind: ${h.terms.inKind.map(esc).join('; ')}` : '')
            + '.</dd>'
            + `<dt>Buys</dt><dd>${h.terms.buys.map(esc).join('; ')}.</dd>`
            + `<dt>Renewal</dt><dd>${esc(h.terms.renewal)}</dd>`
        : '';

    const independence = h.costOfIndependence
        ? `<dt>Cost of independence</dt><dd>${esc(h.costOfIndependence)}`
            + (h.independenceStance ? ` <span class="dim">stance: ${esc(h.independenceStance.replace(/_/g, ' '))}</span>` : '')
            + '</dd>'
            + (h.unbackedReason ? `<dt>Why nobody took them</dt><dd>${esc(h.unbackedReason.replace(/_/g, ' '))}</dd>` : '')
        : '';

    return `<div class="holds"><dl>
    <dt>Answers to</dt><dd>${parent}</dd>
    <dt>Holds</dt><dd>${esc(h.holds)}</dd>
    <dt>Knows of the apex</dt><dd>${esc(h.awarenessOfApex.replace(/_/g, ' '))}</dd>
    ${terms}
    ${independence}
    <dt>Note</dt><dd>${esc(h.note)}</dd>
  </dl></div>`;
}

/**
 * Reputation against capability, and what the house will trade.
 *
 * Both halves, never one: a reader who hires the reputation gets the wrong
 * thing, and a reader who has worked out the reality is holding something
 * almost nobody has bothered to learn. `unitOfValue` is the operative line -
 * it is what this house counts, and therefore how it can be paid.
 */
function capabilityBlock(c: RegisterCapability): string {
    // NO `Known as` ROW. `knownAs` is `knownFor.outside`, which is the same
    // string the entry header prints under the name - so this dl was rendering
    // a paragraph the reader had already met, word for word, a screen higher.
    // `Actually good at` and `Why the two differ` still refer to it and read
    // correctly against the header line, because it is the same line.
    return `<div class="cap"><dl>
    <dt>Actually good at</dt><dd><b>${esc(c.actuallyGoodAt)}</b></dd>
    <dt>Why the two differ</dt><dd>${esc(c.theGap)}</dd>
    <dt>Counts in</dt><dd>${esc(c.unitOfValue)}</dd>
    <dt>Practice</dt><dd>${esc(c.practice)}</dd>
    <dt>Grievance</dt><dd>${esc(c.grievance)}</dd>
    <dt>Fear</dt><dd>${esc(c.fear)}</dd>
    <dt>Late for</dt><dd>${esc(c.lateness)}</dd>
    <dt>Argues internally about</dt><dd>${esc(c.disagreement)}</dd>
    <dt>Has wrong about itself</dt><dd>${esc(c.wrongAbout)}</dd>
  </dl></div>`;
}

/**
 * The library, off the same rows the Arts tab is built from.
 *
 * On the entry rather than only on the arts sheet, because "what can its people
 * actually do" is a question about the faction and answering it two tabs away
 * made every entry describe an address and a rung. Reach is here for the same
 * reason it is on the arts table: it is the property that separates an art
 * which kills a man from one that clears a courtyard, and a house that teaches
 * three of the second kind is a different problem from one that teaches none.
 */
function curriculumBlock(c: RegisterCurriculum): string {
    // Theirs alone first, then the rest. A teach list read flat makes a house
    // holding the only lightning curriculum in the world look like one that
    // stocks the primer everybody stocks, and the ordering is the correction:
    // what is worth crossing a province for is at the top.
    const ordered = [...c.arts].sort((a, b) => Number(b.onlyHere) - Number(a.onlyHere));
    return `<div class="grp arts"><h4>Arts <span>${c.arts.length}</span>`
        + (c.exclusiveCount
            ? `<span class="gap">${c.exclusiveCount} taught nowhere else</span>`
            : '<span class="gap">nothing here is theirs alone</span>')
        + (c.signature ? `<span class="gap">known for ${esc(c.signature.name)}</span>` : '')
        + '</h4>'
        + ordered.map(a => `<div class="who${a.onlyHere ? ' sole' : ''}"><span class="wn">${esc(a.name)}</span>`
            + `<span class="wo">${a.requiredOrdinal}</span>`
            + `<span class="wr">${esc(a.grade)} &middot; ${esc(a.category)}`
            + `${a.element ? ' &middot; ' + esc(a.element) : ''}`
            + `${a.reach === 'single' ? '' : ' &middot; ' + esc(a.reach)}`
            + `${c.signature && c.signature.id === a.id ? ' &middot; signature' : ''}</span>`
            + `<span class="wd">${esc(rankName(a.requiredOrdinal))}`
            + (a.onlyHere
                ? ' &middot; <b>nobody else teaches this</b>'
                : ` &middot; on ${a.housesTeachingIt} teach lists`)
            + '</span></div>').join('')
        + '</div>';
}

/** The door: the bar, what clearing it takes, and what the rungs pay. */
function wayInBlock(w: RegisterWayIn): string {
    const stats = [
        w.minInsight !== null ? `insight ${w.minInsight}` : '',
        w.minMight !== null ? `might ${w.minMight}` : '',
        w.minCharm !== null ? `charm ${w.minCharm}` : ''
    ].filter(Boolean).join(', ');

    const bar = w.intake === 'closed'
        ? '<span class="dim">Closed. It takes nobody, and that is a fact about the world rather than an option.</span>'
        : w.intake === 'adoption'
            ? `<b>Adoption only.</b> There is no admission day and no applicant. The number beside it - ${w.minOrdinal} - is the rung a family member is expected to reach, not a bar anybody clears from outside.`
            : `<b>${w.minOrdinal}</b> &middot; ${esc(w.minRank)}`
                + (w.guestFromOrdinal !== null
                    ? `. That bar is for membership and is not the door most people come through: it will take somebody on at <b>${w.guestFromOrdinal}</b> and carry them for years before deciding.`
                    : '');

    return `<div class="wayin"><dl>
    <dt>The bar</dt><dd>${bar}</dd>
    ${w.requirement ? `<dt>What it takes</dt><dd>${esc(w.requirement)}</dd>` : ''}
    ${w.preferredRoots.length ? `<dt>Roots wanted</dt><dd>${w.preferredRoots.map(r => esc(r.replace(/_/g, ' '))).join(', ')}</dd>` : ''}
    ${stats ? `<dt>Minimums</dt><dd>${esc(stats)}</dd>` : ''}
    <dt>The ladder</dt><dd class="ladder">${w.ladder.map(r =>
        `<span><b>${esc(r.rank)}</b> ${r.stipend.toLocaleString()}</span>`).join('')}
      <span class="dim">rung and what it pays per cycle</span></dd>
  </dl></div>`;
}

/**
 * What a reader should not take at face value.
 *
 * Empty on most factions, which is itself worth seeing: an entry with no flags
 * is one where the catalogs agree with each other and with the house.
 */
function flagBlock(flags: RegisterFlag[]): string {
    if (!flags.length) return '';
    return `<div class="flags"><h4>Do not take at face value <span>${flags.length}</span></h4>`
        // The text is a paragraph rather than a span, so the page-level size
        // rule reaches it. A flag is prose and some of them run long; as a span
        // inside a grid cell it was the one piece of an entry the limit could
        // not see.
        + flags.map(f => `<div class="flag"><span class="fk">${esc(f.kind)}</span><p class="ft">${esc(f.text)}</p></div>`).join('')
        + '</div>';
}

/** What a faction is reaching for, and everybody with a hand on the same thing. */
function ambitionBlock(a: RegisterAmbition): string {
    const blocked = a.blockedBy.length
        ? a.blockedBy.map(b => (b.linkId
            ? `<span class="jump" data-goto="faction-${esc(b.linkId)}">${esc(b.name)}</span>`
            : esc(b.name))
            + (b.ordinal ? ` <span class="dim">${b.ordinal}</span>` : '')).join(' &middot; ')
        : '<span class="dim">nobody named</span>';
    const contested = a.contestedWith.length
        ? a.contestedWith.map(o =>
            `<span class="side"><b>${o.linkId
                ? `<span class="jump" data-goto="faction-${esc(o.linkId)}">${esc(o.name)}</span>`
                : esc(o.name)}</b> <span class="dim">${o.ordinal}</span> &middot; ${esc(o.wants)}</span>`).join('')
        : '<span class="dim">nobody else has a hand on it</span>';

    return `<div class="ambit"><dl>
    <dt>Wants</dt><dd><b>${esc(a.wants)}</b></dd>
    <dt>Blocked by</dt><dd>${blocked}</dd>
    <dt>Would cost</dt><dd>${esc(a.wouldCost)}</dd>
    <dt>Contested</dt><dd>${contested}</dd>
    <dt>Moved on</dt><dd>${esc(a.movedOn)}</dd>
  </dl></div>`;
}

/** The family, and the only door into it. */
function houseBlock(h: RegisterHouseAdmission): string {
    return `<div class="house"><dl>
    <dt>Family</dt><dd><b>${esc(h.surname)}</b></dd>
    <dt>Route in</dt><dd><b>${esc(h.route)}</b></dd>
    <dt>Taken for</dt><dd>${esc(h.prodigyIn)}</dd>
    <dt>Marriage</dt><dd>${esc(h.marriage)}</dd>
    <dt>Given up</dt><dd>${esc(h.surrendered)}</dd>
    <dt>The name</dt><dd>${esc(h.naming)}</dd>
    <dt>Last taken</dt><dd>${esc(h.lastTaken)}</dd>
    <dt>What it costs</dt><dd>${esc(h.costOfTheForm)}</dd>
  </dl></div>`;
}

/**
 * A court's offices, in the order the catalog holds them.
 *
 * Two standing columns, side by side and equally weighted. Reading the ladder
 * column alone puts the Sill Courier at the bottom of her own court; reading
 * the apex column alone puts her a mark above the man who measures the vein.
 * Both are true, neither contains the other, and the table refuses to pick.
 */
/**
 * THE SIZE LIMIT, AND WHY IT IS A RENDER RULE RATHER THAN AN EDITING RULE.
 *
 * No chunk on this sheet may be longer than a short paragraph - four or five
 * lines. That is a reading constraint and it applies to every part of an entry
 * and to every sub-part inside one: a history, a relationship, a want, a road.
 *
 * The catalog does not obey it and should not be made to. Its fields are the
 * record, they are written at the length the thing takes, and shortening them
 * in place would mean deleting the world to fit the page. So the limit is
 * enforced HERE, once, at the point where prose becomes something a person
 * reads - and the way it is enforced is by making more chunks rather than
 * shorter ones. A field that runs long becomes a lead paragraph inside the
 * limit and a disclosure holding the rest, itself split into paragraphs inside
 * the limit. Nothing is discarded and nothing on the page is oversized.
 *
 * SPLITTING IS AT SENTENCE BOUNDARIES, never mid-sentence, because a chunk cut
 * in the middle of a clause is worse than a long one. The consequence is that a
 * single sentence longer than the limit comes through whole, which is correct:
 * the alternative is breaking the catalog's own prose, and a sentence is the
 * smallest unit this sheet is allowed to have an opinion about.
 */
const CHUNK_LIMIT = 280;

/*
 * WHY 280 AND NOT 360. The design owner has now read this sheet three times and
 * said each time that it is still not easy. The words are not the problem and
 * are not being touched: what was wrong is that a "short paragraph" at 360
 * characters is four or five lines of dense subordinate clauses, and a page of
 * those is a wall however well each one is written.
 *
 * Lowering the limit makes MORE chunks out of the same sentences and never
 * fewer words, which is the same rule this file has always followed, applied
 * harder. Measured on the built sheet: the median chunk was 176 characters and
 * the ninetieth percentile 310, so this cuts the long tail and leaves the
 * ordinary case exactly as it was.
 *
 * It also costs less than it looks. A field that has already been split adds
 * its new paragraph INSIDE the continuation that already exists rather than
 * opening a second one, so the count of disclosures moves far less than the
 * count of paragraphs.
 */

/**
 * One field, as paragraphs that each fit the limit.
 *
 * Greedy by sentence: keep adding sentences while they fit, start a new
 * paragraph when the next one would not. Returns at least one entry, so a
 * caller never has to check for empty.
 */
function chunkParagraphs(text: string, limit = CHUNK_LIMIT): string[] {
    const trimmed = text.trim();
    if (trimmed.length <= limit) return [trimmed];

    // Sentence ends, keeping the terminator. Abbreviations are not a hazard in
    // this catalog's prose, which is why this is a split rather than a parser.
    //
    // THE CLOSING TAG IS THE PART THAT CAUGHT ME OUT. This ran on a match of
    // 'run of non-terminators, then terminators, then whitespace', which does
    // not fire on a sentence that ends inside markup - '...opened.</strong> The
    // figure...' has a tag between the full stop and the space, so the whole
    // paragraph came through as one sentence and was left oversized. The split
    // now looks behind a terminator across any number of closing tags.
    const sentences = trimmed.split(/(?<=[.!?](?:<\/[a-z]+>)*)\s+/);

    // A SENTENCE LONGER THAN THE LIMIT IS SPLIT AT ITS CLAUSES, not left whole.
    // This catalog writes long, and several of its best sentences run past a
    // short paragraph on their own - so refusing to cut inside a sentence at
    // all left a handful of chunks nobody could read. The second-level cut is
    // at a colon, a semicolon or a spaced hyphen, which is where this prose
    // actually breathes, and the separator stays with the half it belongs to.
    // Below that there is no further cut: a clause is the smallest unit this
    // sheet is allowed to have an opinion about.
    const clauses = (sentence: string): string[] => {
        if (sentence.length <= limit) return [sentence];
        const pieces = sentence.split(/(?<=[:;]|\s-)\s+/);
        const merged: string[] = [];
        let held = '';
        for (const piece of pieces) {
            if (!held) { held = piece; continue; }
            if (held.length + 1 + piece.length <= limit) held = `${held} ${piece}`;
            else { merged.push(held); held = piece; }
        }
        if (held) merged.push(held);
        return merged;
    };

    const out: string[] = [];
    let current = '';
    for (const raw of sentences.flatMap(x => clauses(x.trim()))) {
        const sentence = raw.trim();
        if (!sentence) continue;
        if (!current) {
            current = sentence;
            continue;
        }
        if (current.length + 1 + sentence.length <= limit) {
            current = `${current} ${sentence}`;
        } else {
            out.push(current);
            current = sentence;
        }
    }
    if (current) out.push(current);
    return out.length ? out : [trimmed];
}

/**
 * A field as a lead paragraph and, where there is more, a disclosure holding
 * the rest in paragraphs of the same size.
 *
 * `label` is what the disclosure is called. It should say what is behind it
 * rather than "more", because a reader deciding whether to open something is
 * entitled to know what it is.
 */
function chunked(text: string, label = 'the rest of it', cls = ''): string {
    const parts = chunkParagraphs(text);
    const attr = cls ? ` class="${cls}"` : '';
    const lead = `<p${attr}>${esc(parts[0])}</p>`;
    if (parts.length === 1) return lead;
    return lead
        + `<details class="more"><summary>${esc(label)} &middot; ${parts.length - 1} more</summary>`
        + parts.slice(1).map(part => `<p${attr}>${esc(part)}</p>`).join('')
        + '</details>';
}

/** The same, for the value side of a definition list. */
function chunkedDd(text: string): string {
    const parts = chunkParagraphs(text);
    if (parts.length === 1) return `<dd>${esc(parts[0])}</dd>`;
    return `<dd>${esc(parts[0])}`
        + `<details class="more"><summary>the rest of it &middot; ${parts.length - 1} more</summary>`
        + parts.slice(1).map(part => `<p>${esc(part)}</p>`).join('')
        + '</details></dd>';
}

/**
 * The divider between the five parts of an entry.
 *
 * A label and one line of what the part is for. It exists because the parts are
 * not obviously ordered from outside - a reader arriving at the middle of a
 * long entry cannot tell that the roster above the artifacts is a deliberate
 * sequence rather than an arbitrary one - and because a named part can be
 * omitted honestly when it is empty, which an unnamed run of blocks cannot.
 */
function sectionHead(label: string, gloss: string): string {
    return `<div class="part"><h4>${esc(label)}</h4><span>${esc(gloss)}</span></div>`;
}

/** A stable handle for a heading, so a reader's folding survives a rerender. */
function foldKey(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * One part of an entry, and the reader decides whether it is open.
 *
 * EVERYTHING IS SHOWN BY DEFAULT. This is not a detail level and there is no
 * mode: the sheet renders at full detail, always, and nothing is chosen for the
 * reader. What the reader gets is the ability to fold away the parts they are
 * not reading, on a page where one faction entry runs to seven of them and
 * there are thirty-four faction entries.
 *
 * FOLDING IS REMEMBERED BY PART NAME RATHER THAN BY ENTRY. Somebody who does
 * not care about Ancestors does not care about Ancestors on any house, and
 * making them fold it thirty-four times would be worse than not offering it.
 * So the handle is the heading, the same on every entry, and the script keeps
 * the folded set in localStorage - which is per-viewer, per-browser, and never
 * leaves the machine.
 *
 * Empty parts render as nothing at all rather than as a heading with a fold
 * control and no content behind it.
 */
function foldablePart(label: string, gloss: string, body: string): string {
    if (!body.trim()) return '';
    return `<details class="partfold" open data-part="${esc(foldKey(label))}">`
        + `<summary>${sectionHead(label, gloss)}</summary>`
        + `<div class="partbody">${body}</div>`
        + '</details>';
}

/**
 * How a faction came to be here, first on its entry.
 *
 * Quoted whole out of the history catalog and assembled nowhere. The shared
 * events carry this faction's own account and a link to everybody else who was
 * there, which is the entire mechanism by which two houses can hold different
 * accounts of one year without the sheet adjudicating between them - and the
 * date is printed from the event's own field, once, because a year restated in
 * prose is a year that will drift from the one anything reads.
 *
 * The three explanatory fields are here rather than beside the figures they
 * explain, on purpose. A reader who meets "eleven rungs under its own strongest
 * member" without having been told what the house lost reads it as an
 * assessment; a reader who has been told reads it as a consequence.
 */
function historyBody(d: SectDossier): string {
    const h = d.history;
    if (!h) {
        return '<p class="none">The history catalog has no row for this body. It came from somewhere '
            + 'and nothing on the sheet records where.</p>';
    }
    const rows: string[] = [
        `<dt>How it got here</dt>${chunkedDd(h.origin)}`,
        `<dt>Why it makes what it makes</dt>${chunkedDd(h.whyTheGapIs)}`
    ];
    if (h.whatTheUnlitNodesWere) {
        rows.push(`<dt>What the dark nodes were</dt>${chunkedDd(h.whatTheUnlitNodesWere)}`);
    }
    rows.push(`<dt>Where the false belief comes from</dt>${chunkedDd(h.whereTheWrongBeliefComesFrom)}`);

    // The years this house was in the room for, as a list it can be walked
    // from. A dated event has several parties and is not the property of any
    // one of them, so the event itself is still written once, in the section
    // above, with every account on it - this is the index into it.
    const shared = h.shared.length
        ? `<div class="grp"><h4>Dated events it is a party to <span>${h.shared.length}</span></h4>`
            + h.shared.map(e => `<p class="evtref jump" data-goto="event-${esc(e.id)}">`
                + `<span class="evtrefy">${e.yearsAgo.toLocaleString()} yr ago</span>`
                + `<span class="nsep"> &middot; </span>with ${esc(series(e.others.map(o => o.name)))}`
                + `<span class="nsep"> &middot; </span>explains ${esc(e.explains)}</p>`).join('')
            + '</div>'
        : '';

    return `<dl class="hist">${rows.join('')}</dl>${shared}`;
}

/** How a body's history reads at a glance, for its closed card. */
function historyFacts(d: SectDossier): string[] {
    const h = d.history;
    if (!h) return [nfact('history', 'nothing on record')];
    return [
        nfact('shares', `${h.shared.length} dated event${h.shared.length === 1 ? '' : 's'}`),
        h.whatTheUnlitNodesWere ? nfact('and', 'what the dark nodes were') : ''
    ];
}

/**
 * Every dated event, written ONCE, with every party's account on it.
 *
 * WHAT THIS REPLACED. A shared event was rendered inside each participant's
 * entry - the neutral line, then that house's own telling - so a three-party
 * event appeared three times with three quarters of its text identical, and a
 * reader working down the Factions tab met the same year over and over. The
 * event is one object with several accounts hanging off it; that is what it now
 * looks like on the page.
 *
 * The neutral line is the floor every account has to stand on, said once at the
 * top of the section rather than above each event, because it is a rule about
 * how this catalog is written and not a fact about any one year.
 */
function sharedEventsOnce(dossiers: readonly SectDossier[]): string {
    const anchorOf = new Map<string, string>();
    for (const d of dossiers) anchorOf.set(d.name, `faction-${d.id}`);

    const events = [...SHARED_EVENTS].sort((a, b) => b.yearsAgo - a.yearsAgo);

    return events.map(e => {
        const parties = e.parties.map(id => nameOf(id));
        return `<div class="evt" id="event-${esc(e.id)}">`
            + `<div class="evth"><span class="evty">${e.yearsAgo.toLocaleString()} yr ago</span>`
            + `<span class="nsep"> &middot; </span>`
            + `<span class="evtx">explains ${esc(e.explains)}</span>`
            + `<span class="nsep"> &middot; </span>`
            + `<span class="evtw">${parties.map(n => jumpTo(anchorOf.get(n) ?? null, n)).join(', ')}</span></div>`
            + chunked(e.what, 'the rest of what happened', 'evtn')
            + `<div class="tiesides">${e.parties.map(id => {
                const account = e.accounts[id];
                if (!account) return '';
                return `<div class="tieside"><h5>${jumpTo(anchorOf.get(nameOf(id)) ?? null, nameOf(id))}</h5>`
                    + chunked(account, 'the rest of this house\'s account', 'evta')
                    + '</div>';
            }).join('')}</div>`
            + '</div>';
    }).join('');
}

/**
 * What a faction filed demonic is actually willing to do.
 *
 * On six entries and nowhere else. `demonic` is a field on a sect row, and a
 * field is not an identity - read with the alignment as the only answer, the
 * six are one house wearing six names. Every line here is the catalog's, and
 * the ordering is the argument: what it does, who pays, whether they agreed,
 * what it will not do, where it stands with its patron, and what happens to the
 * ground if somebody ends it.
 */
function demonicBlock(x: RegisterDemonic, name: string, id: string): string {
    return `<div class="demon" id="conduct-${esc(id)}"><h4>What ${esc(name)} is willing to do <span>${esc(x.kind.replace(/-/g, ' '))}</span></h4>`
        + `<dl class="hist">`
        + `<dt>The line it crosses</dt><dd>${esc(x.theLineItCrosses)}</dd>`
        + `<dt>Who pays</dt><dd>${esc(x.whoPays)}</dd>`
        + `<dt>Whether they agreed</dt><dd>${esc(x.didTheyAgree)}</dd>`
        + `<dt>What it keeps local</dt><dd>${esc(x.whatItKeepsLocal)}</dd>`
        + `<dt>Where it stands with its patron</dt><dd>${esc(x.standingOnTheContract)}</dd>`
        + `<dt>If it were destroyed</dt><dd>${esc(x.ifItWereDestroyed)}</dd>`
        + `</dl></div>`;
}

/**
 * Whether somebody gets in here on a word, beside the gate the word would skip.
 *
 * The sharpest axis on the sheet for an ordinary reader, and a better
 * distinction between the three apexes than the alignment beside them: no,
 * because we do not do that; yes, and here is what it costs. The two "no"
 * answers are rendered differently on purpose - a house with nothing to skip is
 * not making a decision, and a house that will not move is making one every
 * time it is asked.
 */
function favourBlock(f: RegisterFavour): string {
    return `<div class="assess"><dl>
    <dt>In on somebody's word?</dt><dd><b>${esc(f.answer)}</b>. ${esc(f.why)}</dd>
    ${f.andWhatItTakes ? `<dt>And what it takes</dt><dd>${esc(f.andWhatItTakes)}</dd>` : ''}
    ${f.apexStance ? `<dt>Whether its word skips a bar</dt><dd>${esc(f.apexStance)}</dd>` : ''}
    ${f.andWhetherItsOwnWordMoves ? `<dt>Whether its own word moves anybody</dt><dd>${esc(f.andWhetherItsOwnWordMoves)}</dd>` : ''}
  </dl></div>`;
}

/**
 * Why a house has no place for its own members' children.
 *
 * On three entries and nowhere else, and the absence everywhere else is the
 * point: a cultivator ordinarily raises their child in their own house, an
 * ordinary sect is glad to have an elder's child, and no mechanism is involved
 * at all. These three cannot, for two opposite reasons - two have no intake and
 * one has a bar nothing else applies - and the reason decides everything that
 * happens to the child afterwards.
 *
 * In the ranks-and-people part, because it is a fact about who is in the house
 * and who is conspicuously not.
 */
function noPlaceBlock(x: RegisterNoPlace, name: string): string {
    return `<div class="assess"><dl>
    <dt>No place for its own</dt><dd><b>${esc(x.reason)}</b>. ${esc(x.whyItCannotKeepThem)}</dd>
    <dt>Where the child goes</dt><dd>${esc(x.whereTheChildGoes)}</dd>
    <dt>What the child knows</dt><dd>${esc(x.whatTheChildKnows)}</dd>
    <dt>Whether it ends</dt><dd>${esc(x.andWhetherItIsPermanent)}</dd>
    <dt>What it costs the parent</dt><dd>${esc(x.whatItCostsTheParent)}</dd>
  </dl>
  <p class="note">Three bodies in the world have this problem and ${esc(name)} is one of them. Everywhere else a cultivator simply raises their child in their own house, because an ordinary sect is content to produce a strong elder and any promising child might become one.</p></div>`;
}

/**
 * How a body nobody can join is staffed, and what a term there is worth.
 *
 * Rendered in the ranks-and-people part, in place of the gate an ordinary house
 * has - because for these two the gate IS the answer and the answer is that
 * there is not one. The last row is the one that makes the arrangement
 * self-sustaining rather than merely strange: a returning appointee comes back
 * at the height they left at and ahead of everybody who stayed, which is why a
 * body with no intake has never been short of people.
 */
function postingBlock(x: RegisterPosting, name: string): string {
    return `<div class="assess"><dl>
    <dt>Nobody joins it</dt><dd>${esc(x.appointedBy)}</dd>
    <dt>Worth it from below</dt><dd>${esc(x.whatItIsWorthFromBelow)}</dd>
    <dt>Worth it from the top</dt><dd>${esc(x.whatItIsWorthFromAbove)}</dd>
    <dt>Where they go after</dt><dd>${esc(x.andAfterwards)}</dd>
    <dt>What the term is worth</dt><dd>${esc(x.andWhatTheTermIsWorthAfterwards)}</dd>
    <dt>Being passed over</dt><dd>${esc(x.andBeingPassedOver)}</dd>
  </dl>
  <p class="note">${esc(name)} is one of two bodies in the world that work this way. Every other court on this sheet is a sect - it has members, an intake and a ladder, and the word court says what it administers rather than what kind of institution it is.</p></div>`;
}

/**
 * One body's side of a contested lineage, quoted whole and never summarised.
 *
 * It carries a link to the other claimant, which is the whole of what makes
 * this readable: two partisan accounts with no joint version between them are
 * only fair if a reader can get from either to the other in one click. The
 * sheet adds no adjudicating sentence of its own and must not - every line here
 * was written from inside one of the two houses.
 */
function courtPanel(court: RegisterCourt, selfAnchor: string, panelId?: string): string {
    const named = court.startingAwareness !== 'unaware' && court.startingAwareness !== 'whisper';
    const agrees = court.startingAwareness === court.apexAwareness;

    // THE ID IS THE CALLER'S DECISION, AND IT USED TO BE STAMPED HERE
    // UNCONDITIONALLY. A bare court's disclosure already carries `court-<id>`,
    // so the panel inside it was a second element with the same id on every
    // one of them - and on a body that is a court AND a sect, the wrapper
    // carries the faction anchor and the court anchor has nowhere else to
    // live, so that is exactly where the caller asks for it. `selfAnchor` is a
    // different thing and always has been: it is whose page this is, for the
    // tie chips at the foot.
    return `<div class="nbody"${panelId ? ` id="${esc(panelId)}"` : ''}>
    ${court.synopsis.length
        // First, and not `administers` - which on a body whose whole job is
        // administering something is a definition rather than an introduction.
        ? `<p class="synop">${court.synopsis.map(esc).join(' ')}</p>`
        : ''}
    <p class="desc">${esc(court.description)}</p>
    <p class="terr"><b>What it apportions.</b> ${esc(court.administers)}</p>
    ${metaRow([
        ['posted by', court.apexName],
        ['grants in', court.grantsInRegionId.replace(/^region-/, '').replace(/-/g, ' ')],
        ['offices', String(court.officers.length)],
        // Deliberately not the house's name here. Where a court is also a
        // sect, this panel sits inside a card already headed with that name,
        // and repeating it printed "also filed as The Kiln Court" on the Kiln
        // Court. The alias belongs beside the heading, which is where the
        // dossier puts it.
        ['a beginner', named ? 'may be told the name' : 'has never heard of it']
    ])}
    ${court.transferNote
        // No word of the sheet's own here. One of the two moves was a transfer
        // between patrons and the other a promotion inside one, the note says
        // which in its own first sentence, and a heading that picked one word
        // for both printed the wrong one on whichever court it was not.
        ? `<p class="terr"><b>How it came to answer here.</b> ${esc(court.transferNote)}</p>`
        : ''}
    <p class="terr"><b>Whether it can be named.</b> A court is exactly as nameable as the apex above it, and ${esc(court.apexName)} ${court.apexAwareness === 'unaware' || court.apexAwareness === 'whisper' ? 'cannot be named by a starting cultivator' : 'has a front gate'} - so this one ${named ? 'can be' : 'cannot'}${agrees ? '' : ', which is the one place the rule does not hold and is worth checking'}.</p>
    ${court.highWaterMark
        ? `<p class="terr"><b>The one who got furthest.</b> ${esc(court.highWaterMark.name)}, ${esc(court.highWaterMark.rank)} at ${court.highWaterMark.ordinal}, ${court.highWaterMark.yearsAgo.toLocaleString()} years ago - and ${court.highWaterMark.end === 'attempted' ? 'attempted the crossing' : 'declined it and died of old age at the rung'}. ${esc(court.highWaterMark.note)}</p>`
        : '<p class="note">No high-water mark. This court has never produced somebody at the last realm, which is the ordinary case and is the whole difference between a court and an apex.</p>'}
    <p class="terr">${esc(court.officesNote)}</p>
    ${court.posting ? postingBlock(court.posting, court.name) : ''}
    ${court.noPlaceForItsOwn ? noPlaceBlock(court.noPlaceForItsOwn, court.name) : ''}
    <div class="scroll"><table>
      <caption>Offices &middot; ${court.officers.length} &middot; catalog order, not a ladder</caption>
      <thead><tr><th>Office</th><th>Who</th><th class="pw">Ord</th><th>Inside ${esc(court.apexName)}</th><th>What the office does</th></tr></thead>
      <tbody>${court.officers.map(o => `<tr${o.answersForTheCourt ? ' class="answers"' : ''}>`
        + `<td class="nm">${esc(o.title)}</td>`
        + `<td class="nm">${esc(o.name)}</td>`
        + `<td class="pw">${o.ordinal}</td>`
        + `<td class="ap">${esc(o.apexRank)}</td>`
        + `<td class="q">${esc(o.office)} <span class="dim">wants ${esc(o.wants)}; fears ${esc(o.fears)}</span></td>`
        + '</tr>').join('')}</tbody></table></div>
    <p class="note"><strong>&bull;</strong> marks the officer the court's ordinal of ${court.ordinal} is naming: the strongest member who will answer. It is not the top of a chain of command, because there is not one.</p>
    ${relSummaryStrip(court.relationships, court.name, selfAnchor)}
  </div>`;
}

/**
 * One faction, read in the order it has to be read in.
 *
 * The entry runs FROM WHAT A HOUSE IS TO WHAT IT SAYS ABOUT ITSELF and then out
 * to everybody around it, in six parts, and each part is checkable against the
 * one above it:
 *
 *   1. HISTORY            how it came to be here. Everything below is a
 *                         consequence of it, so it goes first or the reader is
 *                         assembling the consequence before the cause.
 *   2. RANKS AND PEOPLE    who is in it right now, and what it can field. The
 *                         first hard test of the history: a house whose history
 *                         claims one thing and whose roster shows another is
 *                         either declining or lying, and both are interesting.
 *   3. WHAT IT TEACHES     the shelf, art by art, and the road to the top of
 *                         the ladder where there is one. The distinction is
 *                         load-bearing and the data supports it: an art nobody
 *                         else teaches is a possession, a method half the
 *                         province teaches is not. The INVENTORY is no longer
 *                         here - objects, immortal objects, doses and the ground
 *                         are the Holdings tab, and which body holds which
 *                         specific object is the Items ledger. This part carries
 *                         one line pointing at both rather than a third copy of
 *                         rows that already have two homes.
 *   4. STANDINGS           loyalty, patrons, goals and grievances. Where the
 *                         cross-references land, and every grievance here
 *                         should be recognisable from the other side's entry.
 *   5. CLAIMS AND ANCESTORS  A claim is what a house asserts, not what is true,
 *                         and putting it after the evidence lets a reader weigh
 *                         it rather than accept it. Shown first, a
 *                         nine-hundred-year-old lineage claim reads as a fact
 *                         about the world.
 *   6. HOW IT STANDS WITH EVERYBODY  last, and last for a reason: it is the
 *                         only part that is entirely about somebody else. Every
 *                         row names a second body and links to it, so it is
 *                         where a reader leaves this entry, and a section a
 *                         reader leaves by belongs at the foot rather than in
 *                         the middle. It also reads best after the five parts
 *                         above have said what this house is - a cold word
 *                         toward a patron means something different once you
 *                         know what the house is holding and what it lost.
 *
 * THE ORDER OF FIVE AND SIX HAS BEEN WRONG BEFORE. This block described parts
 * four and five in that order while the code emitted five and then four, so the
 * ancestors sat above the wants on every entry on the sheet and the comment
 * saying otherwise had been true when it was written. The code now matches the
 * order stated here, which is the order to keep.
 *
 * THE ORDER SURVIVES AN EMPTY SECTION. Most houses have no sealed ancestor, no
 * artifact and no lineage dispute; a heading with nothing under it reads as a
 * broken page rather than as an absence, so every section is omitted when empty
 * and none is ever rendered hollow. The one deliberate exception is the
 * abstention note on a faction with no ambition, which is an authored statement
 * that the house wants nothing rather than a hole where a want would go.
 *
 * The four people-groups stay separate labelled lists rather than one table
 * with a status column, because they are not comparable: an active member is
 * somebody you can meet, a sealed one is an event waiting for a trigger, and
 * the other two are history. A single sortable table would invite exactly the
 * comparison the register exists to prevent - and it is also why the living
 * sit in part two and the dead sit in part five.
 */
// ─────────────────────────────────────────────────────────────────────────
// THE RESUME NOTATION
//
// A faction entry is read in about thirty seconds by somebody deciding whether
// they care about this house. Anything countable on it is therefore written as
// notation rather than as a sentence, because notation is SCANNED and a
// sentence has to be READ - and the sheet's whole vocabulary is the ladder, so
// `44 x1` needs no key on a page where 0 to MAX_ORDINAL appears everywhere.
//
// THE RULE THIS ENFORCES, and it is the one the previous line broke. A block on
// the overview may POINT at the page that owns a question or it may ANSWER the
// question, and never both. The holdings line used to say "what this house is
// holding is on the Holdings tab" and then spell out the count, the strongest
// power, the immortal total and a named object - a cross-reference and a copy in
// one sentence, which gives the reader an incomplete answer here, a fuller one
// there, and two places to drift apart. The pointer is the whole job.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a house holds, as scale and count and nothing else.
 *
 * `1 object at 43 &middot; 4 immortal objects` - a body with one object rated
 * 43 and four immortal objects. What the objects ARE, what waking or spending
 * one costs, and who is carrying which are the Holdings and Items tabs, which
 * exist to answer exactly that and answer it in full.
 *
 * EVERY COUNT NAMES ITS NOUN. This line used to read `43 x1 &middot; 4
 * immortal &middot; 1 sent down`, which is unreadable in the one way notation
 * must never be: the design owner asked "4 immortal what?" and the sheet's
 * answer was a button labelled "what each one is". A count whose noun is on
 * another tab is not compression, it is a riddle - and the button was the
 * pointer-and-a-copy failure in its purest form, because Holdings owns the
 * detail entire. The noun is in the count now and the button is gone.
 */
function holdsNotation(d: SectDossier): string {
    // Grouped by rating, strongest first, so two objects at the same rung read
    // as one item rather than as two. The rating is the ladder, which is the
    // only scale on this sheet, so the figure itself needs no key.
    const byPower = new Map<number, number>();
    for (const a of d.artifacts) byPower.set(a.power, (byPower.get(a.power) ?? 0) + 1);
    const objects = [...byPower.entries()]
        .sort((x, y) => y[0] - x[0])
        .map(([power, n]) => `<span class="hn"><b>${n}</b> object${n === 1 ? '' : 's'} at <b>${power}</b></span>`);

    const immortal = d.holdings.reduce((n, h) => n + h.count, 0);
    if (immortal) {
        objects.push(`<span class="hn"><b>${immortal}</b> immortal object${immortal === 1 ? '' : 's'}</span>`);
    }
    // The sent-down gift and the parting gift are already named in the meta
    // strip above, so naming them again here would be the copy this notation
    // exists to remove. They are counted, not named.
    const gifts = (d.apex ? 1 : 0) + (d.partingGift ? 1 : 0);
    if (gifts) objects.push(`<span class="hn"><b>${gifts}</b> object${gifts === 1 ? '' : 's'} sent down</span>`);

    if (!objects.length) return '';
    return `<p class="holdline"><span class="nfl">holds</span> `
        + `${objects.join('<span class="nsep"> &middot; </span>')}</p>`;
}

/**
 * What a house teaches, at the depth a resume answers it: elements, and level.
 *
 * WHAT THIS REPLACED. The overview carried the shelf art by art - every title,
 * its grade, its category, its element, how many teach lists it is on - and
 * under that the deep road with its copy count, its provenance, its opening
 * penalty and a biography of its one teacher. All of it is good and all of it
 * is on the Arts tab, which is the page that owns arts, so the overview was a
 * second rendering of somebody else's page.
 *
 * A reader scanning a house wants "ice and water, and they can carry you to
 * about 33". The exact names are one click away.
 *
 * THE LEVEL IS THE TEACHABLE END, not the book's cap. A road covering the last
 * realm caps at the rung the last crossing lands on, which nobody is ever
 * taught onto, so quoting the cap here would put a rung on the resume that no
 * house can walk anybody to.
 */
function teachNotation(d: SectDossier): string {
    const c = d.curriculum;
    if (!c && !d.deepRoad) return '';

    const bits: string[] = [];
    if (c) {
        bits.push(c.elements.length
            ? `<span class="hn">${esc(c.elements.join(', '))}</span>`
            : '<span class="hn dim">no element - bodies, doors or paperwork</span>');
        bits.push(`<span class="hn"><b>${c.arts.length}</b> art${c.arts.length === 1 ? '' : 's'}</span>`);
        if (c.hardest) bits.push(`<span class="hn">to <b>${c.hardest.requiredOrdinal}</b></span>`);
        if (c.hardest) bits.push(`<span class="hn">top grade ${esc(c.hardest.grade)}</span>`);
        if (c.exclusiveCount) bits.push(`<span class="hn"><b>${c.exclusiveCount}</b> nowhere else</span>`);
    }
    if (d.deepRoad) {
        const end = d.deepRoad.teachableEnd ?? d.deepRoad.cap;
        bits.push('<span class="hn">a road to the top of the ladder'
            + (end === null ? '' : ` &middot; teachable to <b>${end}</b>`)
            + `, and this house carries to <b>${d.deepRoad.carriesTo}</b></span>`);
    }

    // NO POINTER ON THIS LINE. It carried a link labelled "art by art", set
    // inline in the middle of the notation, and the design owner's word for it
    // was ugly - correctly, because a link label is not a noun and the line is
    // made of nouns. The specifics are a tab of their own now, named in the tab
    // bar, which is where a reader looks for a page rather than mid-sentence.
    return `<p class="holdline"><span class="nfl">teaches</span> `
        + `${bits.join('<span class="nsep"> &middot; </span>')}</p>`;
}

function dossier(d: SectDossier): string {
    // ── 2. who is in it, and separately WHO THEY ARE ─────────────────
    //
    // THE ROLL IS ITS OWN PART. It used to be one `h4` group inside "Who is in
    // it", below the fielding table, the admission bar, the favour stance and
    // the house's adoption terms - so a list of named people, which is the one
    // thing on the entry a reader can go and meet, arrived as the fifth block
    // of a chunk about institutional machinery and read as a run-on. The design
    // owner asked for it as a section and it is one.
    const roll: string[] = [];
    // Which tables the names came out of, said once on the part rather than in
    // a chip on the group heading that no longer exists. Same discipline the
    // relationships section uses: a reader can go and check the union.
    const sources = [...new Set(d.people.active.map(p => p.source))];
    if (d.people.active.length) {
        // NAMED PEOPLE ONLY, AND THE ENTRY MUST SAY SO WHERE IT MATTERS. The
        // member catalog is weighted hard to the bottom of the ladder and does
        // not name everybody a house has - so an entry could print "the next
        // strongest at 37" in its own precis and then list a roll whose second
        // name stands at 24, with nothing anywhere reconciling the two. That is
        // not a hole in the roll: it is what a roll of NAMED people looks like
        // under a house that is deeper than its named people. The gap is only
        // worth a sentence where it is actually visible, so the note is
        // computed from the two figures rather than printed on every entry.
        const rollTop = d.people.active[0]?.ordinal ?? 0;
        const rollSecond = d.people.active[1]?.ordinal ?? 0;
        const houseSecond = d.apex ? d.apex.secondSeat : 0;
        const unnamedAbove = rollTop < d.ordinal
            ? `the strongest member this house answers with stands at ${d.ordinal} and is not named here`
            : houseSecond > rollSecond
                ? `this house's second is at ${houseSecond} and the strongest named after the first is at ${rollSecond}`
                : '';
        // The other direction, and it happens exactly once in the world: a
        // person on a roll standing ABOVE the figure their own house answers
        // with. It is not an error and it is not a stronger house - it is
        // somebody who holds a position that carries no obligation either way,
        // so the house cannot send them anywhere and does not answer with them.
        const overTheHouse = rollTop > d.ordinal ? d.people.active[0] : undefined;
        roll.push(`<div class="grp healthy">`
            + d.people.active.map(p =>
                `<div class="who"><span class="wn">${esc(p.name)}</span><span class="rsep"> &middot; </span>`
                + `<span class="wo">${p.ordinal}</span><span class="rsep"> &middot; </span>`
                + `<span class="wr">${esc(p.rank)} · ${esc(p.role)}</span>`
                + `<span class="wd">${esc(p.wants)}`
                // Both names, and the register is the only place they appear
                // together. Being seen to go in is public; which of the working
                // names belongs to which of the people who went in is what
                // nobody in the world can establish, and the concealment is a
                // fact about the province rather than about this sheet.
                + (p.worksOutsideAs
                    ? ` <span class="chip">works outside as ${esc(p.worksOutsideAs)}</span>`
                    : '')
                + (p.knownForBefore
                    ? `<span class="dim"> Known before the gate: ${esc(p.knownForBefore)}</span>`
                    : '')
                // What the house can actually require. On one body it is the
                // whole of the arrangement, and on one person inside it the
                // honest answer is nothing at all.
                + (p.askedOf
                    ? `<span class="dim"> Asked of them: ${esc(p.askedOf)}</span>`
                    : '')
                + `</span></div>`).join('')
            + (overTheHouse
                ? `<p class="note"><strong>${esc(overTheHouse.name)} stands at ${overTheHouse.ordinal}, above the `
                    + `${d.ordinal} this house answers with.</strong> That is not a stronger house than its own `
                    + 'figure says. The ordinal is the strongest ACTING member - the person who answers a '
                    + 'challenge, walks a border, sits at a negotiation - and the position above it here carries '
                    + 'no obligation in either direction, so there is nobody the house could send and nothing it '
                    + 'could require. A roll is who is on it; the ordinal is who answers.</p>'
                : '')
            + (unnamedAbove
                ? `<p class="note">Named people only - ${esc(unnamedAbove)}. `
                    + 'The member catalog is weighted to the bottom of the ladder, where the player starts and '
                    + 'where almost everybody is, so a house is routinely deeper than the names under it. An '
                    + 'unnamed figure quoted above this list is the house\'s own and is not a gap in the roll.</p>'
                : '')
            + '</div>');
    }

    // ── 3. WHAT IT HOLDS AND WHAT IT TEACHES ARE BOTH NOTATION HERE ─────
    //
    // Neither list is on this page any more. The artifacts and immortal objects
    // are the Holdings and Items tabs, in full, house by house and object by
    // object; the shelf art by art and the road to the top of the ladder are
    // the Arts tab, which is the page that owns arts. What is left here is the
    // scale and the count - `43 x1 &middot; 4 immortal`, `ice, water &middot; 8
    // arts &middot; to 33` - which is what a reader deciding whether they care
    // about this house is asking, and which is read in a glance rather than in
    // four screens.
    //
    // The rule, because it is the one that keeps being broken: the resume may
    // point at the page that owns a question or answer it, never both. A line
    // that says "this is on the Holdings tab" and then spells out the holdings
    // is a cross-reference and a copy at once, and the two copies drift.

    // ── 5. what it says about itself ─────────────────────────────────
    const claims: string[] = [];


    if (d.people.sealed) {
        const sl = d.people.sealed;
        const kind = sl.sealReason === 'protector' ? 'Protector' : 'Final breath';
        // Level, above, or under. Stated because the assumption a reader brings
        // is that a reserve outranks the house holding it, and on the sheet's
        // most important seal that assumption is simply false: he is level with
        // the living head, and a second person at the last realm in a house
        // everybody has counted as having one is a different and larger fact
        // than a bigger version of the head would be.
        const against = sl.ordinal > d.ordinal
            ? `${sl.ordinal - d.ordinal} above the house`
            : sl.ordinal === d.ordinal
                ? 'level with the house'
                : `${d.ordinal - sl.ordinal} under the house`;

        claims.push(`<div class="grp sealed"><h4>Sealed ancestors &middot; ${kind} <span>1</span>`
            + `<span class="gap">${esc(against)}</span></h4>`
            + `<div class="who"><span class="wn">${esc(sl.name)}</span>`
            + `<span class="wo">${sl.ordinal}</span>`
            + `<span class="wr">${esc(sl.sealGrade)} seal · ${sl.dormantYears.toLocaleString()} yr · ${sl.publiclyKnown ? 'known' : 'hidden'}</span>`
            + `<span class="wd">${esc(sl.wakeCondition)}</span></div>`
            + sealedDetail(sl, d.people.sealedOnTheRoll)
            + '</div>');
    }

    if (d.people.ascended.length) {
        claims.push(`<div class="grp ascended"><h4>Ascended <span>${d.people.ascended.length}</span></h4>`
            + d.people.ascended.map(p =>
                `<div class="who"><span class="wn">${esc(p.name)}</span><span class="rsep"> &middot; </span>`
                + `<span class="wo">${p.ordinal ?? '-'}</span>`
                + `<span class="wr">${p.yearsAgo.toLocaleString()} yr ago</span>`
                + `<span class="wd">${esc(p.rememberedFor)}</span></div>`).join('')
            + '</div>');
    }

    if (d.people.terminal.length) {
        claims.push(`<div class="grp terminal"><h4>Dead and lost <span>${d.people.terminal.length}</span></h4>`
            + d.people.terminal.map(p =>
                `<div class="who"><span class="wn">${esc(p.name)}</span><span class="rsep"> &middot; </span>`
                + `<span class="wo">${p.ordinal ?? '-'}</span>`
                + `<span class="wr">${esc(p.fate)} · ${p.yearsAgo.toLocaleString()} yr ago</span>`
                + `<span class="wd">${esc(p.rememberedFor)}</span></div>`).join('')
            + '</div>');
    }

    const nothingAtAll = !roll.length && !claims.length;

    return `<article class="dos${d.apex ? ' apex' : ''}">
  <header>
    <span class="ord">${d.ordinal}</span>
    <div>
      <h3><span class="dot ${esc(d.alignment)}"></span>${esc(d.name)}
        ${d.passerby?.dao ? `<span class="chip dao">dao of ${esc(d.passerby.dao)}</span>` : ''}
        ${d.alsoKnownAs ? `<span class="chip">also ${esc(d.alsoKnownAs)}</span>` : ''}
        ${d.apex ? '<span class="chip pin">apex</span>' : ''}
        ${d.withdrawn ? `<span class="chip wd">withdrawn x${d.withdrawn.count}</span>` : ''}
        ${d.ceiling ? `<span class="chip sl">ceiling ${d.ceiling}</span>` : ''}
      </h3>
      <!-- WHAT IT IS, BEFORE WHAT IS SAID ABOUT IT. The entry opened on the
           passerby line, which is the catalog's outside view - reputation. On
           the Deep Survey that reads "Nothing, to almost everybody", which is
           an answer about the NAME and leaves a stranger with no idea what
           kind of body they are looking at. The identity line was already
           being written; it was sitting at the head of the precis, inside a
           fold, under a heading. It leads now, and the reputation keeps its
           place directly after it. -->
      <p class="ident">${esc(d.synopsis[0] ?? identityLine(d))}</p>
      ${d.passerby
          ? `<p class="pass">${esc(d.passerby.line)}</p>`
          : `<p class="terr">${esc(d.territory)}</p>`}
      <!-- What everybody says about them, on a house whose own line above is
           about its principle rather than its reputation. On every other body
           the line above IS the reputation, so a second paragraph would be
           the same sentence twice. -->
      ${d.passerby?.dao && d.capability
          ? `<p class="pass">What everybody says about them: ${esc(unperiod(d.capability.knownAs))}.</p>`
          : ''}
    </div>
  </header>
  ${metaRow([
      ['rank', d.rank],
      // Alignment is in the strip rather than only in the coloured dot, because
      // a dot is a legend lookup and this is part of who the house is.
      ['aligned', d.alignment],
      ['gift', d.partingGift ? d.partingGift.name + (d.partingGift.intact ? '' : ' (spent)') : ''],
      ['sent down', d.apex?.giftName ?? ''],
      ['heritage', d.apex?.heritage ?? ''],
      ['stock', d.apex ? d.apex.stock.replace(/_/g, ' ') : ''],
      // WHAT THE FIGURE MEASURES. `second 39` was the rung of the house's
      // second-strongest seat and read as an index into something.
      ['second seat at rung', d.apex ? String(d.apex.secondSeat) : ''],
      // WHAT THE ROW MEANS, NOT WHAT THE COLUMN IS CALLED. This printed
      // `channel  answering channel - 6 crossings - medium`, where the label
      // and the first value were the same words twice and none of the three
      // said what was being counted. What it is actually reporting is how many
      // of a house's own people got over the Lid and whether any of them still
      // answer, which is the fact the crossing catalog calls a house's whole
      // defence against simple forgetting - `theCounterExample` in
      // `crossings.ts` says a good record IS an institution's strength rather
      // than incidental to it. So the label names the people and the value says
      // whether the line is still open and how thin it has worn.
      //
      // No branch on the house. Every value here is read off the channel row,
      // and the one institution this fact is most dramatic about gets no
      // special case - it simply has the best numbers in the column.
      // THE COUNT IS OF CROSSINGS, NEVER OF THE LIVING, and the two must not be
      // fused into one phrase. This read "6, still answering at intervals",
      // which a reader takes as six who are still up there answering. The
      // catalog is careful about exactly this and the register was not: the
      // channel row's own `resilience` field says "Six channels, of which
      // nobody knows how many are still live, and that uncertainty is
      // survivable precisely because there are six", and the roster behind it
      // carries one seat marked `died_above`. So the number is how many went
      // over the Lid from here, and whether anybody is still answering is a
      // separate clause that is never quantified.
      ['crossed from here', d.channel
          ? `${d.channel.crossings} over the Lid`
              + (d.channel.kind === 'parting_gift'
                  ? ' · nothing further is coming'
                  : d.channel.kind === 'personal_channel'
                      ? ' · one answers constantly, for somebody down here'
                      : ' · somebody up there still answers, at intervals')
              + (d.channel.depletion ? ` · the line has worn ${d.channel.depletion}` : '')
          : '']
  ])}

  ${holdsNotation(d)}
  ${teachNotation(d)}

  <!-- THE POINTERS, AND WHY THEY ARE ALL THERE IS OF THREE WHOLE SECTIONS.
       History, the ethics dossier and the relations correspondence each ran to
       screens on every one of the entries that carried them, and none of the
       three answers "what is this house". They are on the pages that own them
       now, whole and uncut, and this is the line that says so. -->
  <p class="crossref">${[
      d.history
          ? `<span class="jump" data-goto="hist-${esc(d.id)}">how it got here${d.history.shared.length
              ? `, and the ${d.history.shared.length} dated event${d.history.shared.length === 1 ? '' : 's'} it shares`
              : ''}</span>`
          : '',
      d.demonic
          ? `<span class="jump" data-goto="conduct-${esc(d.id)}">what it is willing to do &middot; ${esc(d.demonic.kind.replace(/-/g, ' '))}</span>`
          : ''
  ].filter(Boolean).join('<span class="nsep"> &middot; </span>')}</p>

  ${foldablePart('What it is', 'the fuller version, and then the catalog in its own words',
      // From the SECOND line down. The first is the identity line and it is
      // now printed unfolded in the header above, so repeating it here would
      // be the same sentence twice inside one entry.
      (d.synopsis.length > 1 ? chunked(d.synopsis.slice(1).join(' '), 'the rest of the precis', 'synop') : '')
      + (d.description
          // Moved up into this chunk from the foot of the entry. It is the
          // catalog's narrative prose - written to be read rather than used -
          // and it belongs with the description rather than after everything
          // else, collapsed so it never costs a reader who does not want it.
          ? `<details class="context"><summary>In the catalog's own words</summary>${chunkParagraphs(d.description).map(piece => `<p class="desc">${esc(piece)}</p>`).join('')}</details>`
          : ''))}

  ${foldablePart('Could I get in', 'what it admits from, what it would give somebody, and who it answers to',
      fieldedBlock(d.fielded)
      + (d.posting
          // In place of the gate rather than beside it, and `wayIn` is null on
          // these two rather than merely unrendered: there is no application
          // anybody could make, so an admission block would print a bar that
          // does not exist.
          ? postingBlock(d.posting, d.name)
          : d.wayIn ? wayInBlock(d.wayIn) : '')
      + (d.favour ? favourBlock(d.favour) : '')
      + (d.noPlaceForItsOwn ? noPlaceBlock(d.noPlaceForItsOwn, d.name) : '')
      + (d.house ? houseBlock(d.house) : '')
      + (d.id === 'sect-hollow-court' ? howTheCourtIsSeenBlock() : '')
      + (d.holdsFrom ? holdsFromBlock(d.holdsFrom) : ''))}

  ${roll.length
      ? foldablePart('Who is actually in it',
          `${d.people.active.length} named, from ${series(sources)}`,
          `<div class="grps">${roll.join('')}</div>`)
      : ''}

  ${foldablePart('What it is after, and what it is like', 'what is in the way, what it fears, and what it has wrong',
      (d.ambition
          ? ambitionBlock(d.ambition)
          // Only on a faction that could have one. An apex reaching for
          // something is not a shape the catalog records, and printing an
          // absence there would read as an omission rather than as the
          // abstention it is on a sect.
          : d.apex ? '' : '<p class="none">Nothing recorded that this faction is reaching for, and the abstention is the entry rather than a hole in it.</p>')
      + (d.capability ? capabilityBlock(d.capability) : '')
      + flagBlock(d.flags)
      + (d.withdrawn ? `<p class="terr">${esc(d.withdrawn.occupiedBy)}</p>` : '')
      + (d.apex ? `<p class="terr"><b>The lordship.</b> ${esc(d.apex.seatNote)}</p>` : ''))}

  ${claims.length
      // Omitted entirely where a house has no ancestors of any kind, which is
      // true of the two apexes nobody has ever joined. A heading with nothing
      // under it reads as a broken page rather than as an absence.
      //
      // The gloss is derived rather than fixed, because the difference between
      // a house holding somebody in reserve and a house with only a roll of the
      // dead is the single most useful fact in this chunk, and a static
      // subtitle would say the same thing about both.
      ? foldablePart('Ancestors', d.people.sealed
          ? 'one sealed and still down there, and the roll'
          : 'the roll. Nothing held in reserve, which is the ordinary case',
          `<div class="grps">${claims.join('')}</div>`)
      : ''}

  ${nothingAtAll
      ? '<div class="grps"><div class="grp"><p class="none">Nobody recorded and nothing held. The faction exists; the register has no names for it.</p></div></div>'
      : ''}

  ${relSummaryStrip(d.relationships, d.name, `faction-${d.id}`)}
</article>`;
}

/**
 * One fact on a closed card: what it is called, and what it says.
 *
 * THE DEFECT THIS EXISTS TO CLOSE. The card head used to be a single run of
 * uppercase micro-type in one colour, holding six unrelated facts with nothing
 * between them. Flattened, a reader got
 *
 *   Frostmirror Court36holds from The Deep Surveyceiling 42gate 132 flaggedwants...
 *
 * and on screen they got the same thing with a small gap where every separator
 * should have been - one weight, one colour, no labels, so the ordinal ran into
 * the name and the flag count ran into the want. It was the worst thing on the
 * page and it is where the eye lands first, because this is the list of every
 * faction in the world.
 *
 * Three things fix it and all three are needed. Every fact is NAMED, so a bare
 * number never has to be guessed at. Every fact is SEPARATED by a printed
 * middot rather than by margin alone, so the separation survives being copied,
 * pasted, read aloud or rendered without the stylesheet. And the label and the
 * value take different weights, so the row has a hierarchy to scan instead of
 * being one texture.
 */
function nfact(label: string, value: string, tone = ''): string {
    return `<span class="nfact${tone ? ` ${tone}` : ''}">`
        + `<span class="nfl">${esc(label)}</span> `
        + `<span class="nfv">${esc(value)}</span></span>`;
}

/** The facts of a card head, separated by a mark that is really in the text. */
function nfacts(items: string[]): string {
    return `<span class="nkind">${items.filter(Boolean).join('<span class="nsep"> &middot; </span>')}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────
// ONE SHAPE, LEARNED ONCE, ON EVERY FACTION-SCOPED PAGE
//
// The Factions tab arranges every body in the world twice over: the three
// apex pyramids as an indented tree, then everybody outside them grouped by
// how they hold their ground. That arrangement IS the world's structure, and
// a reader who has learned it on one tab should not have to learn a second
// one to find the same house's ties, its dated events, its inventory or its
// shelf. So the arrangement is a function of a VIEW now: the structure is
// drawn once, and each pane supplies the facts on the closed card and what
// opening a house shows.
//
// WHAT IS DELIBERATELY NOT IN IT. Items and Arts keep their own shapes,
// because they are almanacs - organised by the thing rather than by the house
// that has one - and forcing a house tree onto a catalog of objects would be
// filing the question under the wrong noun.
//
// ANCHORS ARE PER-PANE. The same house now carries a card on five tabs, so
// each view names its own prefix and every id on the sheet stays unique. The
// Factions and History views keep the prefixes they already had, because a
// few hundred cross-references on this sheet already point at them.
// ─────────────────────────────────────────────────────────────────────────

interface HouseView {
    /** Anchor for a body that has a faction entry. */
    entryAnchor: (id: string) => string;
    /** Anchor for a court with no faction row of its own. */
    courtAnchor: (id: string) => string;
    /** The facts on the closed card, for this pane's question. */
    facts: (d: SectDossier) => string[];
    /** What opening a house shows here. */
    body: (d: SectDossier) => string;
    /** What opening a bare court shows, where the pane has anything for one. */
    courtBody?: (c: RegisterCourt, anchor: string) => string;
    /**
     * What goes ABOVE the house's own answer on a body that is a court and a
     * faction at once. Only the resume has one: the offices it holds on
     * somebody else's vein come before the house it is in its own right,
     * because the court is what the apex above it sees. Everywhere else the
     * two halves are one body with one set of ties, one history and one
     * inventory, and a second block would be an empty heading.
     */
    combinedPrelude?: (c: RegisterCourt, anchor: string) => string;
    /** Extra facts on the card of a body that is also a court. */
    courtFacts?: (c: RegisterCourt) => string[];
    /** The want, on the closed card. Only the resume prints one. */
    want?: (d: SectDossier) => string;
}

/**
 * One faction: a card that opens this pane's answer for it, in place.
 *
 * `<details>` rather than a scripted panel. It is keyboard-operable, it works
 * with the page's own find, and a reader who opens six keeps all six open -
 * which is what an operator comparing factions actually does, and what a
 * jump-to-anchor would have taken away.
 *
 * The card head carries who it holds from, so grouping by governance does not
 * cost the reporting relation: the group says what kind of arrangement it is,
 * and the line says who the other party is.
 */
function houseCard(d: SectDossier, view: HouseView): string {
    const want = view.want ? view.want(d) : '';
    return `<details class="ncard" id="${esc(view.entryAnchor(d.id))}">
      <summary>
        <span class="nhead"><span class="nname"><span class="dot ${esc(d.alignment)}"></span>${esc(d.name)}</span><span class="nsep"> &middot; </span><span class="nord"><span class="nfl">rung</span> ${d.ordinal}</span><span class="rsep"> &middot; </span></span>
        ${nfacts(view.facts(d))}
        ${want ? '<span class="rsep"> &middot; </span>' : ''}${want}
        <span class="ngo">open</span>
      </summary>
      <div class="nbody">${view.body(d)}</div>
    </details>`;
}

/** The four questions a reader scanning thirty-four resumes is asking. */
function resumeFacts(d: SectDossier): string[] {
    // How dangerous, whose are they, what do they want, can I get in. Only the
    // first two used to be here, so the answer to the other two cost an expand
    // each, thirty-four times.
    return [
        d.apex ? nfact('standing', 'apex', 'pin') : '',
        nfact('holds from', d.parentName ?? 'nobody'),
        d.standing === 'strained' || d.standing === 'probationary'
            ? nfact('grant terms', d.standing, 'ex')
            : '',
        d.ceiling ? nfact('could field', String(d.ceiling), 'sl') : '',
        // WHAT THE NUMBER IS, NOT WHAT THE FIELD IS CALLED. This read `gate 13`
        // for a long time and the design owner's verdict was that it should say
        // what it is. It is the rung a house will admit somebody from, so it
        // says that. `gate` was the worse of the two available words as well as
        // the shorter one: the played game uses it 163 times to mean a gate
        // somebody walks through, so the register was quietly teaching a second
        // sense of a word the player already knew.
        d.intake === 'closed'
            ? nfact('admits', 'nobody')
            : d.intake === 'adoption'
                ? nfact('admits', 'by adoption only')
                : nfact('admits from rung', String(d.admissionOrdinal)),
        d.flags.length
            ? nfact('worth checking', `${d.flags.length} thing${d.flags.length === 1 ? '' : 's'}`, 'ex')
            : ''
    ];
}

/**
 * One node of an apex hierarchy.
 *
 * Only drawn where there is something to draw. A root with no children is not a
 * one-node tree, it is a card, and rendering it with rails and an indent would
 * dress up independence as a structure it does not have.
 *
 * A court used to get a flat card, on the grounds that it is an office rather
 * than a faction and there was no entry behind it. There is now: a court is
 * between three and six people doing a job on somebody else's vein, and they
 * open here. Anything else with nothing behind it is still a flat card, because
 * a disclosure control that opens onto nothing is worse than no control.
 */
function treeNode(
    node: StackNode,
    byId: ReadonlyMap<string, SectDossier>,
    courts: ReadonlyMap<string, RegisterCourt>,
    view: HouseView
): string {
    const entry = node.linkId ? byId.get(node.linkId) : undefined;
    const kind = getApexInstitution(node.id) ? 'apex' : getCourt(node.id) ? 'court' : 'faction';
    const court = courts.get(node.id);

    /**
     * One body, one card, even where it has a row in two catalogs.
     *
     * The Kiln and the Azure Mist are a court AND a sect, and the sheet used to
     * draw them twice because it read the pyramid out of two tables. It now
     * draws them once, with both halves in the one card: the offices they hold
     * on somebody else's vein, and then the house they are in their own right.
     * The order matters - the court is what the apex above it sees, and the
     * faction is what everybody below it sees.
     */
    const card = court && entry
        // Named for the house, not for the posting. The province has called
        // this body the Kiln Court for nine hundred years and the Root Sill is
        // what the Deep Survey calls the job; leading with the apex's word for
        // it made the name every reader arrives with disappear off the sheet
        // entirely, which is worse than the duplicate it replaced. Both names
        // are on the one node, because which one is real is precisely what the
        // catalog says has never been settled.
        ? `<details class="ncard" id="${esc(view.entryAnchor(entry.id))}">
        <summary>
          <span class="nhead"><span class="nname"><span class="dot ${esc(entry.alignment)}"></span>${esc(entry.name)}</span><span class="nsep"> &middot; </span><span class="nord"><span class="nfl">rung</span> ${entry.ordinal}</span><span class="rsep"> &middot; </span></span>
          ${nfacts(view.courtFacts
              ? view.courtFacts(court).concat(view.facts(entry))
              : view.facts(entry))}
          <span class="ngo">open</span>
        </summary>
        ${view.combinedPrelude ? view.combinedPrelude(court, view.entryAnchor(entry.id)) : ''}
        <div class="nbody">${view.body(entry)}</div>
      </details>`
        : entry
            ? houseCard(entry, view)
            : court && view.courtBody
                // Anchored, because a court with no faction row is still a body
                // other entries link to - one of the two claimants to a
                // contested lineage is exactly this case, and without an id
                // here its own account was unreachable from the other side.
                ? `<details class="ncard" id="${esc(view.courtAnchor(court.id))}">
        <summary>
          <span class="nhead"><span class="nname">${esc(court.name)}</span><span class="nsep"> &middot; </span><span class="nord"><span class="nfl">rung</span> ${court.ordinal}</span><span class="rsep"> &middot; </span></span>
          ${nfacts([
              nfact('standing', 'court', 'pin'),
              nfact('officers', String(court.officers.length)),
              nfact('posted by', court.apexName)
          ])}
          <span class="ngo">open</span>
        </summary>
        ${view.courtBody(court, view.courtAnchor(court.id))}
      </details>`
                : `<div class="ncard ncard--flat">
        <span class="nhead"><span class="nname">${esc(court ? court.name : node.name)}</span>${node.ordinal ? `<span class="nsep"> &middot; </span><span class="nord"><span class="nfl">rung</span> ${node.ordinal}</span>` : ''}<span class="rsep"> &middot; </span></span>
        ${nfacts([nfact('standing', kind), nfact('entry', 'none of its own')])}
      </div>`;

    return `<li class="node ${kind}">${card}`
        + (node.children.length
            ? `<ul>${node.children.map(c => treeNode(c, byId, courts, view)).join('')}</ul>`
            : '')
        + '</li>';
}

/**
 * Every body in the world, in the arrangement the world actually has.
 *
 * The three pyramids as a tree, then everybody standing outside one, grouped
 * by how they hold their ground. This is the whole of the Factions tab's
 * structure and it is the whole of Ties, History, Holdings and Teaching's
 * structure too - the design owner's instruction was that a faction-scoped
 * page carries the same shape, learned once and reused, and the alternative
 * was four different ways of listing the same thirty-four bodies.
 */
function houseStructure(
    view: HouseView,
    dossiers: readonly SectDossier[],
    hierarchies: readonly StackNode[],
    byId: ReadonlyMap<string, SectDossier>,
    courts: ReadonlyMap<string, RegisterCourt>,
    inTree: ReadonlySet<string>,
    apexNote = '',
    apexProse = ''
): string {
    const tree = hierarchies.length
        ? `<div class="govgrp">
    <h3 class="govhead">apex hierarchies <span>${hierarchies.length}</span></h3>
    ${apexNote}
    <div class="orgchart"><ul>${hierarchies.map(n => treeNode(n, byId, courts, view)).join('')}</ul></div>
    ${apexProse}
  </div>`
        : '';

    const groups = byGovernance([...dossiers], inTree).map(g => `<div class="govgrp">
    <h3 class="govhead">${esc(g.governance)} <span>${g.members.length}</span></h3>
    <div class="govlist">${g.members.map(d => houseCard(d, view)).join('')}</div>
  </div>`).join('');

    return tree + groups;
}

/**
 * Governance groups, strongest group first, strongest faction first inside.
 *
 * Ordered by the strongest member of each group rather than by a fixed list, so
 * the ordering says something true about the world instead of encoding an
 * opinion about which arrangement matters most.
 */
function byGovernance(
    dossiers: SectDossier[],
    inTree: ReadonlySet<string>
): { governance: string; members: SectDossier[] }[] {
    const groups = new Map<string, SectDossier[]>();
    for (const d of dossiers) {
        if (inTree.has(d.id)) continue;
        if (!groups.has(d.governance)) groups.set(d.governance, []);
        groups.get(d.governance)!.push(d);
    }
    return [...groups.entries()]
        .map(([governance, members]) => ({
            governance,
            members: members.slice().sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name))
        }))
        .sort((a, b) => b.members[0].ordinal - a.members[0].ordinal);
}

/**
 * The size limit, enforced once on the finished page.
 *
 * WHY HERE AND NOT AT EVERY CALL SITE. The rule is that no chunk a reader
 * lands on runs past a short paragraph, and this sheet emits prose from
 * something like two hundred places. Applying the rule at each of them means
 * remembering it at each of them, and the next block anybody adds will be the
 * one that forgets. Applying it to the assembled document means it holds for
 * everything, including material nobody has written yet.
 *
 * The explicit `chunked` calls upstream are not redundant: they produce a
 * disclosure LABELLED for what is behind it, which reads better than the
 * generic label this pass can supply. This is the floor, not the design.
 *
 * IT ONLY TOUCHES SIMPLE BLOCKS. A paragraph or a definition value whose
 * content is text and inline markup gets split; anything containing a nested
 * block or a disclosure is left exactly as it is, because that one has
 * already been chunked by somebody who knew what it was.
 */
function enforceChunkLimit(html: string): string {
    // A DISCLOSURE INSIDE A PARAGRAPH IS NOT A PARAGRAPH. The continuation
    // holds paragraphs, and a `p` may not contain one - a browser closes the
    // outer element at the inner tag and the markup a reader gets is not the
    // markup this function wrote. So for a paragraph the disclosure is emitted
    // as a SIBLING, after the lead is closed, and for a definition value it is
    // emitted inside, where paragraphs are legal.
    const split = (open: string, close: string, body: string): string => {
        const parts = chunkParagraphs(body);
        if (parts.length === 1) return `${open}${body}${close}`;
        const rest = `<details class="more">`
            + `<summary>the rest of it &middot; ${parts.length - 1} more</summary>`
            + parts.slice(1).map(part => `<p>${part}</p>`).join('')
            + `</details>`;
        return close === '</p>'
            ? `${open}${parts[0]}${close}${rest}`
            : `${open}${parts[0]}${rest}${close}`;
    };

    // Measured on the text a reader sees rather than on the markup, so a
    // paragraph carrying links or emphasis is not penalised for the tags.
    const visible = (fragment: string): string =>
        fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const rewrite = (source: string, pattern: RegExp): string =>
        source.replace(pattern, (whole, open: string, body: string, close: string) => {
            // Already structured, or already short enough. Leave both alone.
            if (/<(details|p|dl|div|ul|table)\b/i.test(body)) return whole;
            if (visible(body).length <= CHUNK_LIMIT) return whole;
            return split(open, close, body);
        });

    let out = rewrite(html, /(<p\b[^>]*>)([\s\S]*?)(<\/p>)/g);
    out = rewrite(out, /(<dd\b[^>]*>)([\s\S]*?)(<\/dd>)/g);
    return out;
}

/**
 * A LABEL AND ITS BODY, IN TWO COLUMNS RATHER THAN ONE RUNNING PARAGRAPH.
 *
 * THE DEFECT, AS A READER MEETS IT. A paragraph written as a bold label and
 * then its text - "The lordship. One, seated under the datum vault and
 * cultivating without interruption" - sets the body indented after the label on
 * the first line, and then wraps every later line back to the left margin,
 * underneath the label. It reads as a two-column layout whose right-hand column
 * has fallen out of its column, which is what the design owner saw and reported
 * as text going under. It is invisible in the markup and unmistakable on
 * screen, which is why this was found by looking at the page.
 *
 * The fix is to make the two columns real, once, on the finished document -
 * same reason `enforceChunkLimit` runs here rather than at two hundred call
 * sites, and it must run AFTER that one so a label lands on the lead paragraph
 * and never on a continuation.
 *
 * WHAT COUNTS AS A LABEL, which is the whole difficulty. A bold at the head of
 * a paragraph is sometimes a label and sometimes the first words of the
 * sentence, and pulling the second kind into a column would cut a sentence in
 * half. "For you is the shelf, the gate and the purse" is one sentence with a
 * bolded opening; "The lordship." is a label. Three tests separate them, and a
 * bold has to pass all three:
 *
 *   it is SHORT - a label is a handle, not a statement, so anything past a
 *   line's worth of words is prose and is left alone. This is also what keeps
 *   a bolded lead SENTENCE - the sheet has many, and they read correctly as
 *   running prose - out of the column treatment.
 *
 *   it has LETTERS in it - "6" leading "rungs, and it is one use" is a figure
 *   inside a sentence, not a label.
 *
 *   and it ENDS the thought, either by closing with a full stop or a colon, or
 *   by being a proper name that the following sentence starts cleanly after. A
 *   bold followed by a lowercase word is grammatically joined to it and is
 *   never a label.
 *
 * Definition values are stacked rather than columned: a dd is already the
 * right-hand column of a grid, and a second pair of columns inside one is not
 * a layout, it is a corridor.
 */
const LABEL_MAX = 34;

function separateLabelFromBody(html: string): string {
    const text = (fragment: string): string =>
        fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const isLabel = (label: string, rest: string): boolean => {
        const head = label.trim();
        if (head.length < 3 || head.length > LABEL_MAX) return false;
        if (!/[a-z]/i.test(head)) return false;
        const body = text(rest);
        // A label needs something to be the label OF. A handful of words is a
        // phrase that happens to be emphasised.
        if (body.length < 40) return false;
        if (/[.:]$/.test(head)) return true;
        return /^[A-Z]/.test(head) && /^[A-Z"'(]/.test(body);
    };

    // The bold has to be the FIRST thing in the block and hold no markup of its
    // own, which is what every real label on this sheet looks like.
    let out = html.replace(
        /(<p)([^>]*)(>)\s*<(b|strong)>([^<]*)<\/\4>([\s\S]*?)(<\/p>)/g,
        (whole, open: string, attrs: string, gt: string, _tag: string, label: string, rest: string, close: string) => {
            if (!isLabel(label, rest)) return whole;
            const cls = /class="([^"]*)"/.exec(attrs);
            const attrsOut = cls
                ? attrs.replace(/class="([^"]*)"/, `class="$1 labelled"`)
                : `${attrs} class="labelled"`;
            return `${open}${attrsOut}${gt}`
                + `<b class="lbl">${label.replace(/[.:]\s*$/, '')}</b>`
                + `<span class="lbd">${rest.replace(/^\s+/, '')}</span>`
                + close;
        }
    );

    out = out.replace(
        /(<dd\b[^>]*>)\s*<(b|strong)>([^<]*)<\/\2>([\s\S]*?)(<\/dd>)/g,
        (whole, open: string, _tag: string, label: string, rest: string, close: string) => {
            if (!isLabel(label, rest)) return whole;
            return `${open}<b class="lbl--stacked">${label}</b>${rest.replace(/^\s+/, '')}${close}`;
        }
    );

    return out;
}

/**
 * Every section of the page gets a fold, and the reader decides.
 *
 * WHY A PASS AND NOT A PARAMETER. The sheet's sections are written in five
 * different files and something like twenty places, all of them already
 * agreeing on one shape: a `section` whose first thing is a `sh` header holding
 * an `h2`. Threading a control through every one of them means every future
 * section has to remember to take it. Rewriting the finished document means
 * every section has one, including sections nobody has written yet.
 *
 * The id is derived from the heading rather than from a counter, so a reader's
 * folded set survives a section being added above it, a rebuild, or the whole
 * world being regenerated. A section with no header is left exactly as it is.
 */
function makeSectionsCollapsible(html: string): string {
    const out: string[] = [];
    let cursor = 0;
    const used = new Set<string>();

    for (;;) {
        const start = html.indexOf('<section', cursor);
        if (start < 0) break;
        const openEnd = html.indexOf('>', start);
        if (openEnd < 0) break;

        // The matching close, by depth, because a pass that took the first
        // one would swallow half a page the moment anybody nests a section.
        let depth = 1;
        let scan = openEnd + 1;
        let end = -1;
        while (depth > 0) {
            const next = html.indexOf('<section', scan);
            const shut = html.indexOf('</section>', scan);
            if (shut < 0) break;
            if (next >= 0 && next < shut) { depth += 1; scan = next + 8; continue; }
            depth -= 1;
            if (depth === 0) { end = shut; break; }
            scan = shut + 10;
        }
        if (end < 0) break;

        const openTag = html.slice(start, openEnd + 1);
        const inner = html.slice(openEnd + 1, end);
        const header = /^([\s\S]*?)(<div class="sh">[\s\S]*?<\/div>)([\s\S]*)$/.exec(inner);
        const heading = header ? /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(header[2]) : null;

        if (!header || !heading || header[1].trim()) {
            // No header, or something before it. Left alone rather than
            // guessed at: a fold control on a section whose top is not a
            // heading would open onto the wrong thing.
            out.push(html.slice(cursor, end + 10));
            cursor = end + 10;
            continue;
        }

        // A section that already carries an id keeps it - it is a link target
        // somebody else on the page may be pointing at, and a second id
        // attribute beside it is markup a browser silently picks one of.
        const own = /\sid="([^"]+)"/.exec(openTag);
        const base = `sec-${foldKey(heading[1].replace(/<[^>]*>/g, ''))}`.slice(0, 60);
        let id = own ? own[1] : base;
        let n = 2;
        while (used.has(id)) { id = `${base}-${n++}`.slice(0, 62); }
        used.add(id);

        const button = '<button class="secfold" type="button" aria-expanded="true">hide</button>';
        const sh = header[2].replace('</div>', `${button}</div>`);

        out.push(html.slice(cursor, start));
        out.push(own ? openTag : openTag.replace('<section', `<section id="${id}"`));
        out.push(sh);
        out.push(`<div class="secbody">${header[3]}</div>`);
        out.push('</section>');
        cursor = end + 10;
    }

    out.push(html.slice(cursor));
    return out.join('');
}
/**
 * The immortal objects, from the holder's end.
 *
 * THE LEDGER OWES A HOLDER FOR EVERY TRACKED KIND, and this was the one it did
 * not have. The artifact catalog names an owner and a carrier for all
 * twenty-four of its rows; the immortal objects had a count on the Objects tab
 * and nothing anywhere saying whose. The Holdings tab answers the same join
 * from the other end - it is house-first, and a reader who arrives with a HOUSE
 * in mind goes there. A reader who arrives with a THING in mind arrives here,
 * and until now had nowhere to arrive.
 *
 * Not a duplicate of Holdings and not a second source: both are rendered off
 * the same dossier holdings the sheet has already built, so they cannot
 * disagree, and neither says anything the other says in the same shape.
 */
function immortalObjectHolders(reg: WorldRegister): string {
    const byItem = new Map<string, { name: string; count: number; higher: number; middle: number; lower: number; ordinal: number; anchor: string }[]>();
    for (const d of reg.dossiers) {
        for (const h of d.holdings) {
            if (!byItem.has(h.item)) byItem.set(h.item, []);
            byItem.get(h.item)!.push({
                name: d.name,
                count: h.count,
                higher: h.byGrade.higher,
                middle: h.byGrade.middle,
                lower: h.byGrade.lower,
                ordinal: d.ordinal,
                anchor: `faction-${d.id}`
            });
        }
    }
    if (!byItem.size) return '';

    const tables = [...byItem.entries()].map(([item, holders]) => {
        const rows = holders
            .slice()
            .sort((a, b) => b.count - a.count || b.ordinal - a.ordinal)
            .map(h => `<tr>
      <td class="nm"><span class="jump" data-goto="${esc(h.anchor)}">${esc(h.name)}</span></td>
      <td class="n">${h.ordinal}</td>
      <td class="pw">${h.count}</td>
      <td class="m">${[
          h.higher ? `${h.higher} higher` : '',
          h.middle ? `${h.middle} middle` : '',
          h.lower ? `${h.lower} lower` : ''
      ].filter(Boolean).join(' &middot; ')}</td>
    </tr>`).join('');
        const total = holders.reduce((n, h) => n + h.count, 0);
        return `<div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:44%"><col style="width:10%"><col style="width:12%"><col style="width:34%"></colgroup>
    <caption>${esc(item)} &middot; ${total} held by ${holders.length} ${holders.length === 1 ? 'body' : 'bodies'}</caption>
    <thead><tr><th>Who holds it</th><th>Ord</th><th class="pw">How many</th><th>Which grades</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
    }).join('');

    return `<section>
  <div class="sh"><h2>Who holds an immortal object</h2><span class="r">${byItem.size} kinds &middot; most first</span></div>
  <p class="note">What each of these things <em>is</em> is on the Objects tab, with what every grade of it reaches. This is the other question: which bodies are holding one right now, how many, and of which grade. Nobody below the Lid can make another, so every figure here only ever falls.</p>
  ${tables}
</section>`;
}

/**
 * The one thing about the pyramids a reader cannot work out by looking.
 *
 * Which nodes are institutions and which are jobs. Everything else about the
 * arrangement - the ordering, the indentation, that a card opens - is on the
 * page in front of them, and telling them about it was the habit this pass
 * exists to remove.
 */
const APEX_NOTE = '<p class="note">A court is the layer every tenant in a province actually deals with. '
    + '<strong>Almost all of them are sects</strong> - they have members, an intake, a ladder and a seat, '
    + 'and the word <em>court</em> describes the arterial vein they administer rather than what kind of '
    + 'institution they are, so each of those has its own entry in the list below. <strong>Two are not.</strong> '
    + 'The Kiln Court and the Root Sill Court are offices: nobody joins either, there is no intake and no '
    + 'ladder to climb, and what stands there is between three and six people appointed from elsewhere, '
    + 'doing an assigned job on ground the body does not own. Those two are the ones with no faction entry, '
    + 'and the reason is the distinction rather than an omission.</p>';

/** The whole sheet as one self-contained document. */
export function renderRegisterHtml(
    reg: WorldRegister,
    blocks?: Record<string, { text: string; stale?: boolean }>
): string {
    const c = reg.counts;
    const dossierById = new Map(reg.dossiers.map(d => [d.id, d]));
    const courtById = new Map(reg.courts.map(x => [x.id, x]));
    // A root with children is a hierarchy worth drawing. A root without is a
    // faction that holds from nobody, and belongs with its governance group.
    const hierarchies = reg.stack.filter(n => n.children.length > 0);
    const inTree = new Set<string>();
    const claim = (n: typeof reg.stack[number]): void => {
        if (n.linkId) inTree.add(n.linkId);
        inTree.add(n.id);
        n.children.forEach(claim);
    };
    hierarchies.forEach(claim);
    const stamp = reg.generatedAt.replace('T', ' ').slice(0, 16) + ' UTC';

    // Every tie in the world, collapsed onto the PAIR. The catalog stores each
    // one on both parties, so meeting them faction by faction meets everything
    // twice; this is the same set with each pair counted once, which is also
    // the only shape in which the two ends of a tie can be read against each
    // other.
    const tiePairs = buildTiePairs(reg.dossiers, reg.courts);
    const tieCount = tiePairs.length;
    const tieIndex = tiesByBody(tiePairs);

    // ── THE FIVE VIEWS OF ONE STRUCTURE ─────────────────────────────
    //
    // Same arrangement of bodies, five questions. Each view says what its
    // closed card carries and what opening a house shows; nothing else about
    // the tree, the groups, the courts or the ordering is written twice.
    const holdingDetail = holdingsByHouse(reg.dossiers);
    const holdingCardFacts = holdingsFacts(reg.dossiers);

    const factionsView: HouseView = {
        entryAnchor: id => `faction-${id}`,
        courtAnchor: id => `court-${id}`,
        facts: resumeFacts,
        body: dossier,
        courtBody: (court, anchor) => courtPanel(court, anchor),
        // The court anchor lives on the panel here, because the disclosure
        // around it carries the faction anchor - this is the one body on the
        // sheet that needs both, and it is why the id is a parameter.
        combinedPrelude: (court, anchor) => courtPanel(court, anchor, `court-${court.id}`),
        courtFacts: court => [
            nfact('court of', court.apexName),
            nfact('as the', court.name.replace(/^The\s+/i, '')),
            nfact('officers', String(court.officers.length)),
            nfact('and', 'a faction in its own right')
        ],
        // Labelled like every other fact, and on its own line. It used to begin
        // with a bare lowercase "wants" immediately after the flag count, which
        // is where "132 flaggedwants The third arterial" came from.
        want: d => d.ambition
            ? `<span class="nwant"><span class="nfl">wants</span> ${esc(d.ambition.wants)}</span>`
            : ''
    };

    const tiesView: HouseView = {
        entryAnchor: id => `ties-${id}`,
        courtAnchor: id => `ties-court-${id}`,
        facts: d => tieFacts(`faction-${d.id}`, tieIndex),
        body: d => tiesOfHouse(`faction-${d.id}`, tieIndex),
        // A court with no faction row carries ties like anything else, and one
        // of them is a party to the largest unresolved question in the region.
        // No `courtFacts`: on a body that is a court AND a sect the ties are
        // filed under the faction anchor alone, so a second set of counts read
        // off the court id would print zeroes beside the real ones.
        courtBody: (court, _anchor) => tiesOfHouse(`court-${court.id}`, tieIndex)
    };

    const historyView: HouseView = {
        entryAnchor: id => `hist-${id}`,
        courtAnchor: id => `hist-court-${id}`,
        facts: historyFacts,
        body: historyBody
    };

    const holdingsView: HouseView = {
        entryAnchor: id => `hold-${id}`,
        courtAnchor: id => `hold-court-${id}`,
        // The label once, at the head, and the rest as bare values. Labelling
        // every item would print HOLDS four times on one line.
        facts: d => {
            const f = holdingCardFacts.get(d.id) ?? [];
            if (!f.length) return [nfact('holds', 'nothing anybody could carry away')];
            return [nfact('holds', f[0]),
                ...f.slice(1).map((x: string) => `<span class="nfact"><span class="nfv">${esc(x)}</span></span>`)];
        },
        body: d => holdingDetail.get(d.id)
            ?? '<p class="none">Nothing in any catalog is filed against this body.</p>'
    };

    const teachingView: HouseView = {
        entryAnchor: id => `teach-${id}`,
        courtAnchor: id => `teach-court-${id}`,
        facts: teachingFacts,
        body: teachingBody
    };

    const structure = (view: HouseView, apexNote = '', apexProse = ''): string =>
        houseStructure(view, reg.dossiers, hierarchies, dossierById, courtById, inTree,
            apexNote, apexProse);



    // THREE PASSES OVER THE FINISHED DOCUMENT, IN THIS ORDER AND NOT ANOTHER.
    // Chunking first, so a field that runs long becomes a lead and a
    // continuation. Then the label pass, so a label lands on the lead and never
    // on a continuation paragraph that begins mid-thought. Then the fold pass,
    // which only ever wraps and never rewrites, so it is safe last and would
    // have been in the way of both of the others.
    return makeSectionsCollapsible(separateLabelFromBody(enforceChunkLimit(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Standing Register</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500&display=swap">
<style>${STYLE}</style></head><body>

<!-- The game's top bar, on the register. Same brand block, same badge, same
     ghost controls on the right - see web/index.html, which this mirrors. It
     is a sibling of .sheet rather than a child so that it spans the viewport
     while the sheet stays a centred text column. -->
<nav class="opbar" aria-label="Admin tools">
  <div class="opbar__brand">
    <span class="opbar__sigil" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">
        <path d="M12 2.5l2.6 5.6 6 .9-4.4 4.3 1.1 6.2L12 16.6 6.7 19.5l1.1-6.2L3.4 9l6-.9z"/>
      </svg>
    </span>
    <span class="opbar__title">The Cultivation Ladder</span>
  </div>

  <div class="opbar__actions">
    <span class="opbar__badge" title="Operator tools. The server is running with admin tooling exposed.">ADMIN</span>
    <a href="/?open=roster">Roster</a>
    <a href="/api/admin/register.html" aria-current="page">Standing Register</a>
    <a href="/api/admin/register.html?refresh=1" title="Regenerate the prose. This costs provider calls.">Rewrite prose</a>
    <a href="/">Back to the game</a>
    <span class="opbar__hint" aria-hidden="true">esc</span>
    <a class="opbar__close" id="op-close" href="/" title="Close the register (Esc)" aria-label="Close the register"><span class="opbar__close-x" aria-hidden="true">&#10005;</span> Close</a>
  </div>
</nav>

<div class="sheet">

<header class="mast">
  <div class="mark">
    <span>Standing Register</span>
    <span>${c.factions} factions · ${c.apexes} apexes · ${c.courts} courts</span>
    <span>${c.sealed} sealed · ${c.wanderers} wanderer${c.wanderers === 1 ? '' : 's'}</span>
    <span>${c.immortalObjects} immortal objects · ${c.artifacts} artifacts</span>
    <span>ladder 0-${MAX_ORDINAL} &middot; ${TOTAL_RANKS} ranks</span>
    <span>${esc(stamp)}</span>
  </div>
  <h1>The Standing Register</h1>
  <p class="stand">Every faction in the world, placed on the one ladder. Ordinal is the realm of the strongest <em>acting</em> member - the person who answers a challenge, walks a border, sits at a negotiation. It is not what a faction could field once, at cost, and that distinction is the whole of the register.</p>
</header>

<nav class="tabs" role="tablist">
  <button class="tab" role="tab" data-tab="people" aria-selected="true" title="Everybody in the world at or above Grand Ascension">People <span>${reg.high.length}</span></button>
  <button class="tab" role="tab" data-tab="factions" aria-selected="false" title="What each body IS - a resume, read in thirty seconds">Factions <span>${c.factions}</span></button>
  <!-- The two pages the faction resume points at. A tie and a dated event are
       both things BETWEEN houses, so neither belongs inside one house's entry:
       written there, each one is written twice and the general rule about what
       a feud is gets restated once per feud. -->
  <button class="tab" role="tab" data-tab="ties" aria-selected="false" title="How each pair of bodies stands, written once">Ties <span>${tieCount}</span></button>
  <button class="tab" role="tab" data-tab="history" aria-selected="false" title="How each house got here, and the dated events several of them share">History <span>${SHARED_EVENTS.length}</span></button>
  <!-- The almanac and the ledger, and the counts say which is which: Objects
       counts described things, Items counts things with a named holder. -->
  <button class="tab" role="tab" data-tab="objects" aria-selected="false" title="The almanac: what kinds of thing exist, and what each one is">Objects <span>${c.catalogued}</span></button>
  <button class="tab" role="tab" data-tab="items" aria-selected="false" title="The ledger: which specific things exist right now, and who has them">Items <span>${c.artifacts}</span></button>
  <button class="tab" role="tab" data-tab="holdings" aria-selected="false" title="What is actually in each building">Holdings <span>${reg.whatEachHouseHolds.counts.houses}</span></button>
  <button class="tab" role="tab" data-tab="teaching" aria-selected="false" title="What each house will teach, art by art">Teaching <span>${reg.dossiers.filter(d => d.curriculum || d.deepRoad).length}</span></button>
  <button class="tab" role="tab" data-tab="arts" aria-selected="false" title="The almanac of arts: every art in the world, by grade">Arts <span>${c.techniques}</span></button>
  <button class="tab" role="tab" data-tab="key" aria-selected="false">Key</button>
</nav>

<!-- Everything on this page is shown, always. There is no simple view and no
     advanced view: what a reader gets instead is the ability to put away the
     parts they are not reading, section by section or all at once, and to have
     that remembered the next time they open the sheet. -->
<div class="foldbar">
  <button class="secfold" type="button" data-fold="all">fold everything</button>
  <button class="secfold" type="button" data-fold="none">open everything</button>
</div>

<div class="pane" data-pane="people">
<section>
  <div class="sh"><h2>People at or above Grand Ascension</h2><span class="r">Ordinal ${HIGH_BAND_FLOOR}-${MAX_ORDINAL} &middot; strongest first</span></div>
  <p class="note">Everyone in the band, from every catalog at once, with the faction they belong to. The named-member catalog stops well below this, so most of what is up here is lordships, sealed ancestors and the crossed - and a row marked <em>unnamed</em> is a fact about the world rather than a gap in the data. Lesser people are listed under their faction in the next tab.</p>
  <p class="note">The ladder runs to ${MAX_ORDINAL}, and its top realm is two rungs rather than one: <strong>${esc(rankName(FALSE_IMMORTAL_ORDINAL))}</strong> at ${FALSE_IMMORTAL_ORDINAL} and <strong>${esc(rankName(TRUE_IMMORTAL_ORDINAL))}</strong> at ${TRUE_IMMORTAL_ORDINAL}. They are the two landings of one attempt, not two grades of one thing - so a False Immortal is above every Tribulation Transcendence name on this page and is standing on this side of the Lid, permanently. The <em>state</em> column says what a person is doing; the rank already says what they are.</p>
  ${[
      { label: 'Alive', hint: 'Still exists somewhere. Sealed counts - under a mountain is not gone - and so does ascended: somebody above the Lid is alive, and can come back down for the ten or fifteen breaths that costs.', alive: true },
      { label: 'Deceased', hint: 'Gone. Includes the ascended who did not survive what was up there, because tribulation and old age stop being able to kill you and nothing else does.', alive: false }
  ].map(band => {
      const rows = reg.high.filter(p => p.alive === band.alive);
      if (!rows.length) return '';
      return `<h3 class="bandhead">${band.label} <span>${rows.length}</span></h3>
  <p class="note">${band.hint}</p>
  <div class="scroll"><table class="itemtbl">
  <colgroup><col style="width:6%"><col style="width:22%"><col style="width:9%"><col style="width:15%"><col style="width:48%"></colgroup>
  <thead><tr><th>Ord</th><th>Who</th><th>State</th><th>Faction</th><th>Detail</th></tr></thead><tbody>
  ${rows.map(p => `<tr><td class="n">${esc(p.ordinalNote ?? String(p.ordinal))}</td>`
        + `<td class="nm">${esc(p.name)}${p.named ? '' : ' <span class="chip">unnamed</span>'}</td>`
        + `<td class="m">${esc(p.state)}</td>`
        + `<td class="q">${factionLink(p.factionId, p.factionName, dossierById)} <span class="dim">${p.factionOrdinal || ''}</span></td>`
        + `<td class="q">${esc(p.note)}</td></tr>`).join('')}
  </tbody></table></div>`;
  }).join('')}
</section>
</div>

<div class="pane" data-pane="factions" hidden>
<section>
  <div class="sh"><h2>Every faction</h2><span class="r">${c.factions} · by governance</span></div>
  ${prose(blocks, 'register')}
  ${structure(factionsView, APEX_NOTE, prose(blocks, 'apexes'))}
</section>



<section class="startfolded">
  <div class="sh"><h2>Who administers whose ground</h2><span class="r">${ARTERIALS.length} arterials &middot; ${PROVINCES.length} provinces</span></div>
  <p class="note">A province is <em>held</em> by an apex and <em>administered through</em> a court, and those are two different relations that the world keeps in two different places. Reading them together is what this section is for, and it produces two facts that nobody in the world has ever written down - not because they are secret, but because no document exists whose job it would be.</p>
  ${groundTable()}
  ${apexGroundTable()}
</section>

<section class="startfolded">
  <div class="sh"><h2>What a favour is for</h2><span class="r">it skips the admission ordinal &middot; nothing else</span></div>
  <p class="note"><strong>A favour is not money, standing, or a recommendation that makes a good impression. It makes a house take somebody it would otherwise refuse on the bar.</strong> That is the whole of the mechanism, and it is the only thing that makes a name worth anything before a child has an ordinal at all - because every house states a minimum, no origin waives one, and a seven-year-old is at zero. Without it the greatest name in the province could only place a child at the ${reg.theFavour.noBarToSpeakOf.length} houses that admit at the floor, all of which would have taken a farmer's child that morning. Who can grant one is not a rule: it is somebody at Tribulation Transcendence or comparably placed, and there are very few of those.</p>
  <div class="scroll"><table>
    <caption>Where a word buys nothing &middot; ${reg.theFavour.noBarToSpeakOf.length} houses, and the reason the mechanic had to exist</caption>
    <thead><tr><th>House</th></tr></thead>
    <tbody>${reg.theFavour.noBarToSpeakOf.map(x => `<tr><td class="nm">${jumpTo(x.anchor, x.name)}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">And the ${reg.theFavour.willNotMove.length} whose bar does not move - never out of fastidiousness. A bar that cannot be waived is a bar whose waiving would break something: kill the applicant, dissolve the thing the house runs on, or admit a contribution the house has no use for.</p>
  <div class="scroll"><table>
    <caption>Where a word buys nothing because it is refused &middot; a different no from the table above</caption>
    <thead><tr><th>House</th><th>Why it does not move</th></tr></thead>
    <tbody>${reg.theFavour.willNotMove.map(x => `<tr>`
      + `<td class="nm">${jumpTo(x.anchor, x.name)}</td>`
      + `<td class="q">${esc(x.why)}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">Everywhere else - <strong>${reg.theFavour.movesForOne.length} houses</strong> - a word moves the bar, at a price, and the price is generally an obligation nobody names at the time. The bar is what is being bought and nothing else: the child still has to survive the teaching.</p>
  <div class="scroll"><table>
    <caption>Where a word buys the bar &middot; highest bar first, because that is where a favour is worth most</caption>
    <thead><tr><th>House</th><th class="pw">Bar</th></tr></thead>
    <tbody>${reg.theFavour.movesForOne.map(x => `<tr>`
      + `<td class="nm">${jumpTo(x.anchor, x.name)}</td>`
      + `<td class="pw">${x.bar}</td></tr>`).join('')}</tbody></table></div>
  <p class="note"><strong>And the three apexes differ on exactly this</strong>, which is a far more useful distinction than the alignment word beside them, because it is the one an ordinary person is actually asking about: no, because we do not do that - or yes, and here is what it costs.</p>
  <dl class="dispute">${reg.theFavour.apexes.map(x => `<dt>${esc(x.heading)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>
  <p class="note">The extreme case, and the reason anybody spends one.</p>
  <dl class="dispute">${reg.theFavour.theNewborn.map(x => `<dt>${esc(x.heading)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>
</section>

<section class="startfolded">
  <div class="sh"><h2>Bodies with no place for their own</h2><span class="r">${reg.noPlaceForTheirOwn.length} of ${c.factions} &middot; two opposite reasons</span></div>
  <p class="note"><strong>A cultivator ordinarily raises their child in their own house, and that covers the whole world except these three.</strong> An ordinary sect is glad to have an elder's child: it takes people who will make competent elders, and the bar for that is one anybody's child might clear. No favour is needed anywhere and none is called in. These three produce the same situation - a person of high standing whose own institution has no place for their own child - by opposite routes, and the routes are the reason this is a comparison rather than three separate notes.</p>
  <div class="scroll"><table>
    <caption>The same situation, two causes &middot; and everything downstream differs with the cause</caption>
    <thead><tr><th>Body</th><th>Why</th><th>Where the child goes</th><th>What the child knows</th></tr></thead>
    <tbody>${reg.noPlaceForTheirOwn.map(x => `<tr>`
      + `<td class="nm">${jumpTo(x.anchor, x.name)}</td>`
      + `<td class="nm">${esc(x.reason)}</td>`
      + `<td class="q">${esc(x.whereTheChildGoes)}</td>`
      + `<td class="q">${esc(x.whatTheChildKnows)}</td>`
      + '</tr>').join('')}</tbody></table></div>
  <p class="note">Two of them have <em>no intake at all</em> - people arrive by appointment to a posting and a child cannot be appointed - so there is no standard to fail. The third has a bar nothing else in the world applies: it only wants people capable of reaching the last realm, which is not a high standard but a different one, and most children of even the greatest cultivators are not that. Which is also why only one of the three produces a mystery. A posting is a public appointment and everybody knows who holds one, so those children know exactly who their parent is and inherit an expectation and a debt. The Court's discretion is absolute, and its children inherit an object with no name attached to it.</p>
  <p class="note"><strong>And a placement is a gamble rather than a gift.</strong> It applies to all three and to every other placement in the world, which is why it sits here rather than on any one entry.</p>
  <dl class="dispute">${reg.washingOut.map(x => `<dt>${esc(x.heading)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>
  <p class="note">The object at the centre of the one storyline any of this produces, on the Court's side only, because it is the only one of the three whose child has nothing else to go on.</p>
  <dl class="dispute">${reg.theMemento.map(x => `<dt>${esc(x.heading)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>
</section>

</div>

<!-- ── TIES ───────────────────────────────────────────────────────────────
     HOW EACH PAIR OF BODIES STANDS, AND EACH PAIR WRITTEN ONCE.

     This material used to live inside every faction entry, which meant a
     single feud was written out twice - once from each side, in two entries a
     reader would never see together - and that the general rule "a feud the
     other party has not heard about is not a feud" was restated once per feud.
     The rule is a legend here. The pair is one row.

     THE TREE KEEPS THE FEUDAL AXIS. Who holds from whom is a hierarchy and the
     org chart on the Factions tab draws it with indentation, which says it
     better than any notation. What a tree structurally cannot draw is the
     lateral tie - two houses under different patrons feuding, two bodies with
     a hand on the same thing - and that is what leads this page. -->
<div class="pane" data-pane="ties" hidden>
<section>
  <div class="sh"><h2>What each house makes of the others</h2><span class="r">${tieCount} ties</span></div>
  <p class="note"><strong>Open a house, and every line under it is that house's own view outward: the other body, and the one word this house would use about it.</strong> What that other body makes of this one is on its entry and not on this one. Those two words are allowed to differ and frequently do, and reading them one direction at a time is the point - printed as a pair they read as a mutual temperature belonging to neither party, when what the catalog actually holds is two separate statements, each made by somebody.</p>
  <p class="note"><strong>Standing and warmth are different questions.</strong> <em>Stands</em> is the ladder - over it, level with it, under it - and says nothing about how anybody feels. <em>Contesting</em> is a third fact again: it means the two of them have a hand on the same object, which is true or false regardless of the warmth, and two houses can contest a claim while remaining perfectly civil about it.</p>
  <p class="note"><em>Nobody wrote a date on it</em> means the year is not recorded and the tie is remembered by both houses rather than by a document.</p>
  ${warmthLegend()}
  ${structure(tiesView)}
</section>

<section>
  <div class="sh"><h2>What each of these houses is willing to do</h2><span class="r">${reg.dossiers.filter(d => d.demonic).length} of ${c.factions} &middot; a field, not an identity</span></div>
  <p class="note"><strong>On these entries and nowhere else.</strong> <em>Demonic</em> is a field on a sect row and a field is not an identity - read with the alignment as the only answer, these are one house wearing several names. Every line below is the catalog's, and the ordering is the argument: what it does, who pays, whether they agreed, what it will not do, where it stands with its patron, and what happens to the ground if somebody ends it.</p>
  ${reg.dossiers.filter(d => d.demonic).map(d => demonicBlock(d.demonic!, d.name, d.id)).join('')}
</section>
</div>

<!-- ── HISTORY ────────────────────────────────────────────────────────────
     HOW EACH HOUSE GOT HERE, AND THE DATED EVENTS SEVERAL OF THEM SHARE.

     A shared event was rendered inside each participant's entry, so a
     three-party event appeared three times with three quarters of its text
     identical. It is one object with several accounts hanging off it, and that
     is what it looks like here. -->
<div class="pane" data-pane="history" hidden>
<section>
  <div class="sh"><h2>The dated events</h2><span class="r">${SHARED_EVENTS.length} events &middot; oldest first</span></div>
  <p class="note"><strong>The first paragraph of each event is the minimum every party would concede happened.</strong> It is deliberately thin: its whole job is to be the floor the accounts under it have to stand on, so that a disagreement between two houses is checkable rather than merely a difference of tone. An account that cannot be squared with it is an error rather than a point of view.</p>
  <div class="evts">${sharedEventsOnce(reg.dossiers)}</div>
</section>

<section>
  <div class="sh"><h2>How each house came to be here</h2><span class="r">${reg.dossiers.filter(d => d.history).length} houses</span></div>
  ${structure(historyView)}
</section>
</div>

<!-- ── THE ALMANAC ────────────────────────────────────────────────────────
     WHAT KINDS OF THING EXIST IN THE WORLD, AND WHAT EACH ONE IS. Nobody is
     named on this tab and no holder appears on it; a reader opens it to find
     out what a thing is, not who has one.

     It used to be neither. This pane held the artifact catalog - twenty-four
     specific rows with an owner column and a holder column, which is a ledger
     - while the kinds, the counted-or-tracked rule and every catalogued thing
     described sat on the Items tab, which had no holder anywhere on it and
     said so in its own closing sentence. The two tabs were the wrong way
     round, so the sheet answered neither question completely and a reader
     asking either one had to open both.

     The line is the engine's own and is documented in docs/world/things/items.md
     under "Counted or tracked": whether the movement of this specific object
     is an event somebody should be able to find out about two centuries
     later. The almanac describes the KIND. The ledger tracks the ROW. -->
<div class="pane" data-pane="objects" hidden>
${renderItemsSection()}

${renderRepairMedicineSection()}

<section>
  <div class="sh"><h2>The immortal objects</h2><span class="r">Two kinds, three grades each</span></div>
  <p class="note"><strong>Grade caps the destination, not the distance.</strong> Every grade performs the same single crossing - the top rung of one realm to the first rung of the next - and what a higher grade buys is permission to perform it further up the ladder. Lower reaches ordinal 25, middle 29, higher 37, <strong>and nothing reaches ${TRIBULATION.ordinalStart}</strong>: Tribulation Transcendence is walked to or it is not reached, and the two rungs above it are not reached at all except by surviving the crossing. Who is holding one is on the Items tab, and what each house holds altogether is on Holdings.</p>
  ${reg.items.map(i => `<div class="objblk">
    <h3>${esc(i.name)} <span class="objmeta">${esc(i.form.replace(/_/g, ' '))} · ${esc(i.effect.replace(/_/g, ' '))} · ${i.knownCount} of ${i.everKnown} ever known</span></h3>
    <p class="objcount">higher ${i.knownByGrade.higher} · middle ${i.knownByGrade.middle} · lower ${i.knownByGrade.lower}</p>
    <dl class="grades">
      <dt>Higher</dt><dd>${esc(i.grades.higher)}</dd>
      <dt>Middle</dt><dd>${esc(i.grades.middle)}</dd>
      <dt>Lower</dt><dd>${esc(i.grades.lower)}</dd>
    </dl>
  </div>`).join('')}
  ${prose(blocks, 'items')}
</section>

<!-- The almanac's question about a material: what it was, what it fed, and how
     much is left. There is no holder on any row - an unfound unit is in ground
     nobody has opened - so it is a description of a kind and belongs here
     rather than in the ledger, and rather than on the arts sheet where it sat. -->
<section>
  <div class="sh"><h2>Materials nobody can gather</h2><span class="r">${LOST_MATERIALS.length} materials &middot; and what went with each</span></div>
  <p class="note">An extinction is not one loss, it is a list: the recipes it closed, the arts it fed, the object kinds nobody can make any more. What is left of each is counted here because a number with placements against it is a search with a destination and an end, where "nobody has any" is only a wall.</p>
  ${lostMaterialTable()}
</section>
</div>

<!-- ── THE LEDGER ─────────────────────────────────────────────────────────
     WHICH SPECIFIC THINGS EXIST RIGHT NOW, AND WHO HAS THEM. Every table on
     this tab carries a holder, because delivering the holder is the whole
     reason the tab exists. What a thing IS belongs on the Objects tab, and a
     description here that was not needed to identify the row would be the
     almanac leaking back into the ledger. -->
<div class="pane" data-pane="items" hidden>
<section>
  <div class="sh"><h2>The artifact catalog</h2><span class="r">${reg.artifacts.length} objects &middot; power descending</span></div>
  <p class="note"><strong>Power is the ladder people stand on.</strong> An object at ${reg.artifacts[0]?.power ?? 0} is worth roughly what a cultivator at ${reg.artifacts[0]?.power ?? 0} is worth, so the question a reader wants to ask - is this worth more than the person carrying it - is a subtraction. It is a combat rating and not a ranking of importance, and this table is sorted on it and on nothing else: the first row and the last are the same kind of record, made by the same factory and read by the same code, and the only thing between them is the number in the first column.</p>
  ${reg.artifactCeiling
      ? `<p class="note"><strong>Nothing made below the Lid passes ${reg.artifactCeiling.madeHere}.</strong> The table splits cleanly at that rung and the split is provenance rather than quality: everything above it was sent down by somebody who crossed, everything at or below it was finished here. The weakest thing that came down stands at ${reg.artifactCeiling.weakestSentDown}, one rung over the best thing anybody alive has made, and a house that wants something above the line cannot buy it, commission it or dig it up.</p>`
      : '<p class="note">The two provenances interleave in this table, so the sheet draws no line in it: there is no rung a forge below the Lid has not passed.</p>'}
  <p class="note"><strong>Nothing on this side is rated over ${OBJECT_CEILING_BELOW_THE_LID}, whoever made it.</strong> A harder limit than the provenance break above and a different one: an object rated at a rung lets whoever is holding it strike at that rung, so one rated a step higher would put a mortal in a position to injure a True Immortal. That is why the top of this table stops where it does rather than trailing off - the ceiling on making is a fact about forges, and this is a fact about what the ladder will carry.${MANUALS_MAY_EXCEED_THE_LID ? ' A manual is paper and is under no such rule; the arts are on their own sheet for that reason.' : ''}</p>
  ${artifactTable(reg.artifacts, reg.artifactCeiling)}
  <p class="note">Owner and holder are separate columns because they are separate facts. ${reg.artifacts.filter(a => a.inVault).length} of the objects above sit in a vault their owner also is, ${reg.artifacts.filter(a => a.possessorId !== null && !a.inVault).length} are being carried by somebody - and where a holder is named the rung beside them is theirs rather than the object's, so the two numbers on that line can be read against each other. An owner marked <span class="chip">no entry</span> is an id this sheet could not resolve to a faction, which is a fault in the catalog rather than a kind of ownership.</p>
</section>

${immortalObjectHolders(reg)}

${renderRepairMedicineHolders()}

<!-- WHY THIS IS ON THE LEDGER AND NOT ON THE ARTS TAB, WHERE IT WAS.
     Every row here names a house and says what that house is holding, how it
     came by it and whether it would part with it. That is the ledger's
     question exactly. It sat under a heading about the last age, on a tab
     about arts, where the only thing it had in common with its neighbours was
     the era it came from - which is a fact about the object's provenance and
     not about what kind of record it is. -->
<section>
  <div class="sh"><h2>What the last age left, and who is sitting on it</h2><span class="r">${ARCHIVE_COPIES.length} archives &middot; ${MEDICINE_HOLDINGS.length} houses</span></div>
  <p class="note"><strong>An age worked something out, paid for it, and stopped.</strong> What survives is not a weaker version of the modern line and not a stronger one - the comparison does not resolve. What the two tables below add to that is possession: a house with the book and no material is a different house from one with neither, and from one quietly holding the last of both. The catalog knows; almost nobody in the world does.</p>
  ${archiveTable()}
  ${medicineTable()}
</section>
</div>

<!-- What is in the building, joined across the seven catalogs that hold it.
     Nothing else on the sheet answers the question somebody at the gate has. -->
<div class="pane" data-pane="holdings" hidden>
${renderHoldingsSection(reg.dossiers)}

<section>
  <div class="sh"><h2>House by house</h2><span class="r">${c.factions} bodies</span></div>
  ${structure(holdingsView)}
</section>
</div>

<!-- ── WHAT EACH HOUSE TEACHES ────────────────────────────────────────────
     A tab of its own, at the design owner's instruction. The shelf art by art
     was on the Arts tab, under a heading about arts, next to the catalog of
     every art in the world - which is the almanac's question and not this one.
     What a house will actually walk you up is a fact about the HOUSE, so it is
     filed under the house, in the same structure every other faction-scoped
     page uses.

     The faction resume keeps the summary and only the summary: the elements
     and the level, which is what somebody deciding whether to care is asking.
     Both are read off the same field on the sect catalog. -->
<div class="pane" data-pane="teaching" hidden>
<section>
  <div class="sh"><h2>What each house teaches</h2><span class="r">${reg.dossiers.filter(d => d.curriculum || d.deepRoad).length} of ${c.factions} teach anything</span></div>
  <p class="note"><strong>Holding a book and being able to pass it on are different facts.</strong> A shelf says what a house has; how far it can carry somebody depends on who is standing there to teach, which is a different number - one leader's occasional hours against four people who do nothing else. Two houses with identical shelves produce utterly different numbers of high cultivators.</p>
  <p class="note">Every level printed here is the <strong>teachable end</strong>, which on a road covering the last realm is a rung below where the book stops: the last one is reached by surviving the crossing and by nothing else, so no house can walk anybody onto it.</p>
  ${structure(teachingView)}
</section>
</div>

<!-- The third column of force, and the one the sheet had nowhere. A person, an
     object and an art are the three things that decide a fight, and the first
     two have had a panel for a long time. -->
<div class="pane" data-pane="arts" hidden>
<section class="startfolded">
  <div class="sh"><h2>The arts</h2><span class="r">${c.techniques} arts &middot; grade descending</span></div>
  <p class="note"><strong>An art is worth an enormous amount inside a realm and nothing at all across the Lid.</strong> Measured, not asserted. Inside a realm: ${esc(WHAT_AN_ART_BUYS.insideARealm)}. Across the Lid: ${esc(WHAT_AN_ART_BUYS.acrossTheLid)}. What does cross: ${esc(WHAT_AN_ART_BUYS.whatDoesCross)}. So a reader comparing this table against the objects table is comparing two different kinds of thing, and the object is the one that changes which realm you can fight in.</p>
  ${(() => {
      // The rule and the catalog are two different statements and the sheet
      // makes both, separately. Asserting that an art above the object ceiling
      // is an ordinary row would be describing a row this table does not have.
      const top = reg.techniques.reduce((n, t) => Math.max(n, t.requiredOrdinal), 0);
      return `<p class="note"><strong>No object below the Lid is rated above ${OBJECT_CEILING_BELOW_THE_LID}${MANUALS_MAY_EXCEED_THE_LID ? ', and no such rule binds a manual' : ''}.</strong> A weapon rated at a rung lets its holder strike at that rung, so an object above ${OBJECT_CEILING_BELOW_THE_LID} would let a mortal injure a True Immortal and cannot exist on this side.${MANUALS_MAY_EXCEED_THE_LID ? ` A manual is paper, so an art may be written for any rung at all - studying one to full mastery leaves you exactly as strong as you were, which is why nothing has to stop it. The highest art in this catalog is written for ${top}, ${top > OBJECT_CEILING_BELOW_THE_LID ? 'which is above that ceiling' : `so the permission is currently unused: nothing here is written above ${OBJECT_CEILING_BELOW_THE_LID}`}.` : ''} The <em>Ord</em> column is the rung the art was written for and not a bar to reading it - there is no rule against practising something above you, and the catalog contains arts nobody alive can use properly.</p>`;
  })()}
  ${(() => {
      const wide = reg.techniques.filter(t => t.reach !== 'single');
      return `<p class="note"><strong>Reach</strong> is how many people one use lands on, and it is a property of the art rather than of whoever is holding it - the word means the same thing for a bandit with a wide swing as for somebody at the top of the ladder. ${wide.length} of the ${c.techniques} arts reach past one person; everything else is <em>single</em>, which is what an art is unless the catalog says otherwise. What makes a wide art terrible is not this column, it is the ordinary power arithmetic applied once per person it reached.</p>`;
  })()}
  <p class="note"><strong>Channel</strong> says how a copy reaches somebody. <em>shown</em> is an art a house will demonstrate, and being shown always beats reading; <em>read</em> is an art that survives only on a page out of a ruin or a grave, and how much of it survived the writing down varies by art rather than by grade.</p>
  ${(() => {
      // Derived here rather than stored, because the interesting figure is a
      // join between two catalogs and either of them can move. The claim is
      // falsifiable on the page: if a shown art ever loses its last teacher,
      // the sentence changes by itself instead of going quietly stale.
      const untaught = reg.techniques.filter(t => !t.taughtBy.length);
      const shownWithNobody = untaught.filter(t => t.transmission === 'shown');
      const noCopy = reg.techniques.filter(t => !t.survivingCopy).length;
      return `<p class="note"><strong>${untaught.length} of the ${c.techniques} arts are on no house's teach list</strong>, and ${shownWithNobody.length === 0 ? 'every one of them is a <em>read</em> art' : `${shownWithNobody.length} of them are <em>shown</em> arts, which should not happen`}: the two figures agreeing is what says the catalog is whole. An art nobody teaches is not a hole in the world, it is what makes a grave worth opening - and ${noCopy === 0 ? 'every art below still has a copy somewhere' : `${noCopy} ${noCopy === 1 ? 'art has' : 'arts have'} no surviving copy at all, which is the one state a grave cannot fix`}.</p>`;
  })()}
</section>

<!-- FOUR QUADRANTS, FOUR SECTIONS, AND EACH ONE FOLDS ON ITS OWN. Era and
     class are independent axes and all four combinations are different KINDS
     of thing, so they are four pages rather than four headings inside one.
     Inside each, grade is the second axis and each grade band opens on its
     own. A reader looking for "the heaven-grade ancient dao arts" reaches
     them in two clicks from a folded page instead of scrolling a table of
     everything. -->
${techniqueQuadrantSections(reg.techniques)}
<!-- WHAT EACH HOUSE TEACHES LEFT THIS TAB. It is a fact about a house, and it
     is filed under the house now, on the Teaching tab, in the structure every
     faction-scoped page shares. What stays here is the world's own belief
     about how far the ancient material can be taken, which is a fact about the
     arts and belongs beside them. -->
<section class="startfolded">
  <div class="sh"><h2>What the world believes about the ancient arts</h2><span class="r">${ANCIENT_ARTS.filter(a => a.worldSupplyCeiling !== null).length} with a figure against them</span></div>
  ${(() => {
      const capped = ANCIENT_ARTS.filter(a => a.worldSupplyCeiling !== null);
      if (!capped.length) return '';
      return `<p class="note"><strong>The ceiling in the arts table is what the world believes, not a bar anything applies.</strong> ${capped.length} ancient ${capped.length === 1 ? 'art has' : 'arts have'} a figure, expressed on the same 0-100% mastery scale the engine uses - and NOTHING CURRENTLY READS IT. No upkeep is consulted anywhere in the technique layer, so an elder saying <em>you will not get past the fifth level</em> is a person describing their own house's history with the material, and the catalog recording that they are right, rather than a rule reading itself out loud. When it is enforced it should be enforced the honest way: an upkeep nobody can meet, not a rule saying you may not.</p>`;
  })()}
</section>
</div>

<!-- The column glossary and nothing else. The repair medicine section used to
     be here, carrying both halves of the sheet's own dividing line - what the
     medicine is, and who is holding a dose - under a tab called Key. The
     description is on Objects with the rest of the almanac and the holder list
     is on Items with the rest of the ledger. -->
<div class="pane" data-pane="key" hidden>
<section class="legend">
  <div class="sh"><h2>How to read this</h2><span class="r">Column meanings</span></div>
  <div class="keys">${glossaryGroups().map(g => `<div class="key">
    <h4>${esc(g.group)}</h4>
    <p class="key__intro">${esc(g.intro)}</p>
    <dl>${g.entries.map(e => `<dt>${esc(e.term)}</dt><dd>${esc(e.meaning)}</dd>`).join('')}</dl>
  </div>`).join('')}</div>
</section>
</div>

<footer>
  <span>Ordinal = strongest acting member</span>
  <span>Ceiling is not availability</span>
  <span>Generated from the catalogs</span>
  <span>${esc(stamp)}</span>
</footer>

</div>
<script>
// The way out, and it has to work in two different situations.
//
// The game opens this page with window.open, so most of the time it is a tab of
// its own and the correct exit is to close the tab and hand focus back. But the
// same URL is also opened directly, bookmarked, and saved to a file, and a page
// that only knows how to close itself is a dead end in every one of those. So:
// close where there is an opener to go back to, navigate to the game where there
// is not. The control is a real <a href="/">, which means it still works with
// scripting off and reads as a link rather than as decoration.
function leaveRegister() {
  if (window.opener && !window.opener.closed) {
    try { window.opener.focus(); } catch (err) { /* cross-origin; not important */ }
    window.close();
    // window.close() is silently refused for anything the browser does not
    // consider script-opened. If this page is still here a moment later, the
    // close did not take, and the exit falls back to the navigation.
    setTimeout(function () { window.location.href = '/'; }, 300);
    return true;
  }
  return false;
}

var opClose = document.getElementById('op-close');
if (opClose) {
  opClose.addEventListener('click', function (e) {
    // Only swallow the navigation when there is genuinely a tab to close.
    if (leaveRegister()) e.preventDefault();
  });
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' && e.key !== 'Esc') return;
  if (!leaveRegister()) window.location.href = '/';
});

// Tabs, and nothing else. Three panes, one visible, state in the DOM - an
// admin panel that needed a framework to switch a tab would be the wrong
// trade for a page served straight out of the engine.
function showPane(want) {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.setAttribute('aria-selected', String(t.dataset.tab === want));
  });
  document.querySelectorAll('.pane').forEach(function (p) {
    p.hidden = p.dataset.pane !== want;
  });
}

// An org chart that ends at a name loses the detail. Every node and every
// cross-reference opens the full entry: switch to the tab that OWNS the target,
// scroll it into view, and flash the border so it is obvious which one was
// meant.
//
// THE PANE IS FOUND FROM THE TARGET, not assumed. This used to switch to the
// Factions tab whatever it had been handed, which was right while every
// cross-reference on the sheet pointed at a faction and silently wrong the
// moment one pointed anywhere else: a tie, an event and a house's history all
// live on their own tabs now, and a jump to one would have selected Factions
// and then scrolled to an element inside a hidden pane, which has no box and
// cannot be scrolled to. The failure is invisible - nothing happens - which is
// the worst kind.
//
// A target may also be inside a folded section or a closed disclosure, so both
// are opened on the way. A jump that lands on a collapsed heading has not
// arrived.
function revealAndScrollTo(id) {
  var el = document.getElementById(id);
  if (!el) return false;
  var pane = el.closest('.pane');
  if (pane) showPane(pane.dataset.pane);
  var section = el.closest('section');
  if (section && section.id && foldedSections.has(section.id)) setSection(section, false);
  var node = el;
  while (node) {
    if (node.tagName === 'DETAILS') node.open = true;
    node = node.parentElement;
  }
  el.scrollIntoView({ block: 'start' });
  el.classList.add('flash');
  setTimeout(function () { el.classList.remove('flash'); }, 1400);
  return true;
}

document.addEventListener('click', function (e) {
  var toTab = e.target.closest('[data-tab-goto]');
  if (toTab) {
    showPane(toTab.dataset.tabGoto);
    window.scrollTo({ top: 0 });
    return;
  }
  var target = e.target.closest('[data-goto]');
  if (!target) return;
  revealAndScrollTo(target.dataset.goto);
});

document.querySelectorAll('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    showPane(tab.dataset.tab);
    window.scrollTo({ top: 0 });
  });
});

// ── FOLDING, AND WHAT IT IS INSTEAD OF ──────────────────────────────────
//
// This page has no detail level and no modes. Everything renders, at full
// detail, every time - because a mode is somebody deciding in advance what a
// reader does not need, and on a register whose entire job is completeness
// that decision cannot be made correctly for everybody. What a reader gets
// instead is the ability to fold away what they are not reading.
//
// Two granularities, one mechanism. A SECTION is a whole subject on the page;
// a PART is one of the six chunks inside a faction entry. Both remember.
//
// SECTIONS ARE REMEMBERED BY ID and parts BY NAME. A section is a place on
// the page and there is one of each. A part is a kind of material and there
// are thirty-four of each, so somebody who does not want to read Ancestors
// does not want to read it on any house - folding it once folds it
// everywhere, and asking them to do it thirty-four times would be worse than
// not offering the control at all.
//
// localStorage is per-viewer and per-browser and nothing here leaves the
// machine. Every access is wrapped, because private windows, cleared site
// data and browsers configured to refuse storage all throw rather than
// returning nothing, and a page that cannot remember a fold must still fold.
var FOLD_SECTIONS = 'register.foldedSections.v1';
var FOLD_PARTS = 'register.foldedParts.v1';

function readSet(key) {
  try {
    var raw = window.localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (err) {
    return new Set();
  }
}

function writeSet(key, set) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.prototype.slice.call(Array.from(set))));
  } catch (err) {
    /* No storage. The fold still works for this visit, which is most of it. */
  }
}

var foldedSections = readSet(FOLD_SECTIONS);
var foldedParts = readSet(FOLD_PARTS);

// A SECTION MAY DECLARE THAT IT STARTS FOLDED, and a declaration is a starting
// position rather than a preference. The Arts tab is four quadrants of tables
// and opens on all of them at once, which is a page nobody can navigate - so
// its sections carry a startfolded class and the reader opens the one they
// want. The moment a reader touches any fold their own set is written to
// storage and wins for good, including where it says a defaulted section is
// open. Nothing here can re-close something somebody opened.
var SEEN_DEFAULTS = 'register.sawFoldDefaults.v1';
var sawDefaults = false;
try { sawDefaults = window.localStorage.getItem(SEEN_DEFAULTS) === '1'; } catch (err) { sawDefaults = false; }
if (!sawDefaults) {
  document.querySelectorAll('section.startfolded[id]').forEach(function (section) {
    foldedSections.add(section.id);
  });
  writeSet(FOLD_SECTIONS, foldedSections);
  try { window.localStorage.setItem(SEEN_DEFAULTS, '1'); } catch (err) { /* no storage; the fold still holds for this visit */ }
}

function paintSection(section) {
  var folded = foldedSections.has(section.id);
  if (folded) section.setAttribute('data-folded', '1');
  else section.removeAttribute('data-folded');
  var button = section.querySelector(':scope > .sh > .secfold');
  if (button) {
    button.textContent = folded ? 'show' : 'hide';
    button.setAttribute('aria-expanded', String(!folded));
  }
}

function setSection(section, folded) {
  if (folded) foldedSections.add(section.id);
  else foldedSections.delete(section.id);
  writeSet(FOLD_SECTIONS, foldedSections);
  paintSection(section);
}

function paintParts() {
  document.querySelectorAll('.partfold').forEach(function (part) {
    part.open = !foldedParts.has(part.dataset.part);
  });
}

document.querySelectorAll('section[id]').forEach(paintSection);
paintParts();

// The header is the control. A reader aiming at a heading to collapse it is
// aiming at the obvious thing, and the button beside it is the affordance
// that says so rather than a second, separate target.
document.addEventListener('click', function (e) {
  var head = e.target.closest('.sh');
  if (!head) return;
  var section = head.parentElement;
  if (!section || !section.id) return;
  setSection(section, !section.hasAttribute('data-folded'));
});

// A part folds by name, so folding one folds the same part on every entry.
// Written on toggle rather than on click, so it is right however the
// disclosure was operated - mouse, keyboard, or the browser's own find.
document.addEventListener('toggle', function (e) {
  var part = e.target;
  if (!part.classList || !part.classList.contains('partfold')) return;
  var key = part.dataset.part;
  if (part.open) foldedParts.delete(key);
  else foldedParts.add(key);
  writeSet(FOLD_PARTS, foldedParts);
  document.querySelectorAll('.partfold[data-part="' + key + '"]').forEach(function (other) {
    if (other !== part) other.open = part.open;
  });
}, true);

document.querySelectorAll('[data-fold]').forEach(function (button) {
  button.addEventListener('click', function () {
    var shut = button.dataset.fold === 'all';
    document.querySelectorAll('section[id]').forEach(function (section) {
      if (shut) foldedSections.add(section.id);
      else foldedSections.delete(section.id);
      paintSection(section);
    });
    document.querySelectorAll('.partfold').forEach(function (part) {
      if (shut) foldedParts.add(part.dataset.part);
      else foldedParts.delete(part.dataset.part);
    });
    writeSet(FOLD_SECTIONS, foldedSections);
    writeSet(FOLD_PARTS, foldedParts);
    paintParts();
    window.scrollTo({ top: 0 });
  });
});
</script>
</body></html>`)));
}

/** One call: read the catalogs, return the sheet. */
export function renderRegister(): string {
    return renderRegisterHtml(buildRegister());
}
