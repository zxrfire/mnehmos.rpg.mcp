/**
 * Sects - the social layer, and the only reliable source of manuals, stipends,
 * pills and enemies.
 *
 * `SectEntry` is `Sect` (the persisted engine contract) plus the content-side
 * fields the engine does not store: what a sect teaches, who it hates, what it
 * demands of applicants, and what condition its inherited compound is in.
 * `SectSchema.parse` strips the extras, so an entry can be handed straight to
 * storage without a mapping step while the catalog keeps the material the
 * runtime agent narrates from.
 *
 * THE LATE AGE
 * ------------
 * Every sect here is *late*. None of them built what they live in. The compound
 * data on each entry is the mechanical statement of that: a sect holds forty-one
 * formation nodes and has nine of them lit, because the manual for the other
 * thirty-two went wherever the previous owners went. A courtyard seats two
 * hundred; the sect has eleven disciples. Nobody finds this remarkable - it is
 * simply what a sect is in an age whose veins have already been drawn down
 * once.
 *
 * WHY ANY OF THEM ARE STRONG
 * --------------------------
 * A great sect is old because it sits on a rich vein, and it sits on a rich
 * vein because it was old enough to take one. That is the whole of sect
 * history in a sentence, and it is why territory is the most fought-over
 * property in the world: a sect that loses its vein does not decline
 * gracefully, it stops producing cultivators within a generation and is
 * absorbed by whoever took it.
 *
 * The five standing powers of the region - the Stonewright Consortium, Lantern
 * Hall, the Severed, the Hollow Court and the Kiln Court - are in this
 * catalog alongside the regional sects, because from a cultivator's point of
 * view they are the same kind of object: a door that may or may not open.
 *
 * DESIGN
 * ------
 * - Every sect's rank ladder is its own. A demonic cult does not have "Inner
 *   Disciples"; it has people it has not spent yet.
 * - `stipend[i]` pairs with `ranks[i]`, so both arrays are the same length and
 *   the stipend never falls as rank rises.
 * - `teaches` is the sect's entire *working* library. Anything a sect once held
 *   and can no longer read is not here; it is in a ruin, waiting for a digger.
 *   Consequently no sect teaches a ruin- or grave-provenance art.
 * - Two powers do not recruit at all (`recruits: false`) and therefore teach
 *   nothing. They are in the catalog as facts about the world, not as options.
 * - Rivalries are symmetric and asserted to be. A feud the other party has not
 *   heard about is not a feud.
 */

import type { Sect, SpiritRootKey, TechniqueCategory } from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import {
    delegatedFrom,
    getPrefecture,
    getProvince,
    prefectureForFaction,
    provinceForFaction,
    type Prefecture,
    type Province
} from './regions.js';

export interface SectAdmission {
    /** Mirrors `admissionOrdinal`; kept beside the prose so both are visible. */
    minOrdinal: number;
    /**
     * The floor for being taken in WITHOUT being admitted, where a sect has
     * such a thing. Only the Azure Cloud Pavilion does, and for it this is the
     * real door: `minOrdinal` is the bar for actual membership and has not
     * moved, while this is the rung at which the sect will take somebody onto
     * probation and start spending on them. Kept separate on purpose - see
     * `AZURE_CLOUD_INTAKE.engineGaps` in `hierarchy.ts`, because
     * `rankRealmBand` derives every rank band from `admissionOrdinal` and
     * collapsing the two would slide the whole ladder downward.
     */
    guestFromOrdinal?: number;
    /** Engine-checkable minimums. Undefined means the sect does not care. */
    minInsight?: number;
    minMight?: number;
    minCharm?: number;
    /** Roots the sect actively recruits. Empty means all roots are welcome. */
    preferredRoots: readonly SpiritRootKey[];
    /** Factual statement of the entrance requirement, for the agent to narrate. */
    requirement: string;
}

/**
 * What the sect is physically sitting in. `formationNodesLit` over
 * `formationNodesTotal` is the single most useful number for describing a sect
 * honestly: it is the fraction of its own inheritance it can still operate.
 */
export interface SectCompound {
    /** False only where the sect genuinely built the place it occupies. */
    inherited: boolean;
    formationNodesTotal: number;
    formationNodesLit: number;
    /** One small, legible remnant. Not grandiose - a detail, at human scale. */
    remnant: string;
}

// ─────────────────────────────────────────────────────────────────────────
// ANCESTRAL RECORDS
// Every sect keeps records of its ancestors. For almost all of them this is
// genealogy and hagiography: a wall of names, a founder's sword nobody can
// draw, tablets to people dead two thousand years who are not coming back.
//
// A handful have an ancestral asset that is still there, and it comes in two
// forms that behave nothing alike:
//
//   ascended → through the Lid and gone. Reachable only by the millennial
//              offering, which costs the sect's principal and returns a few
//              words, or nothing.
//   dormant  → still in the world. Sealed, entombed, or nine hundred years
//              into seclusion. They can be WOKEN, usually once, and waking
//              generally ends them - whatever is left is spent on the thing it
//              was woken for.
//
// The dormant kind is what makes "what happens afterwards" a real question. A
// sect with eleven disciples and something sealed under its mountain is more
// dangerous than one with three hundred and nothing, and outsiders often
// cannot tell which is which, because sects lie about both.
//
// RECENCY IS MOST OF THE PRESTIGE
// Nothing goes through the Lid with an ascending cultivator, so the years
// before a crossing are spent divesting and the sect is where it goes:
//
//   recent        the parting gift is intact, the ancestor may still answer,
//                 everyone in the world knows the sect's name
//   several_ages  the gift is spent, lost or quietly stolen; offerings return
//                 less; the claim is true and still worth something
//   ancient       records, a hall of tablets, an assertion nobody can verify
//
// The middle of that curve is where the politics live. A sect whose gift is
// gone but whose claim survives has every incentive to keep it unexamined, and
// a rival has every incentive to have it examined - which is a service the
// Ninefold Ledger sells.
// ─────────────────────────────────────────────────────────────────────────

// The ancestral roll and the types describing it live in their own file now,
// under a name somebody looking for ancestry would actually open. Re-exported
// here so every existing importer is unchanged; the accessors that read both
// this roll and SECTS stay below, which is what keeps the import one-way.
import { SECT_ANCESTRY } from './the-ancestors-a-house-still-names.js';
import type {
    AncestralRecords, DormantAncestor, PartingGift, AncestralRecency
} from './the-ancestors-a-house-still-names.js';

export { SECT_ANCESTRY } from './the-ancestors-a-house-still-names.js';
export type {
    AfterCrossing, AncestorFate, AncestralRecency, SectAncestor, MillennialOffering,
    SealGrade, SealReason, DormantAncestor, PartingGift, AncestralRecords
} from './the-ancestors-a-house-still-names.js';

// ─────────────────────────────────────────────────────────────────────────
// DRIVE
//
// A faction with standing and no wanting is scenery. `powerOrdinal`,
// `admissionOrdinal` and `ranks` say what a house IS; none of them says what
// it is trying to become, and without that the register is a photograph.
//
// Four rules, all asserted in `tests/data/cultivation-courts.test.ts`:
//
//   1. THE AMBITION SCALES WITH THE HOUSE. A four-rung road militia at ordinal
//      14 does not want a court's arterial. It wants the next stretch of road,
//      or to stop being leaned on. The strong ones want a court's position or
//      recognition as a peer rather than a client; the middling ones want a
//      better grant, an art they lack, or to stop being a feeder; the weak ones
//      want to survive the decade or to keep one thing.
//
//   2. SOMEBODY IS IN THE WAY, AND IS NAMED. `blockedBy` holds ids - sects,
//      courts or apexes - never "circumstances". An ambition nobody is opposing
//      is a mood.
//
//   3. IT COSTS SOMETHING THE HOUSE WOULD ACTUALLY HAVE TO SPEND, and
//      `wouldCost` says what. A want with no price is a want nobody has priced.
//
//   4. WHERE TWO HOUSES WANT THE SAME THING, BOTH SIDES SAY SO. `contestedWith`
//      is symmetric across the catalog, exactly as `rivals` is - and it is not
//      the same list. A rivalry is a feud; a contested claim is two parties with
//      their hands on one object, which is frequently between allies and is
//      occasionally between two houses who want the same outcome and cannot
//      both be the one who gets it.
//
// Four factions carry no ambition at all, and the abstention is the content:
// the Sweptground Temple, which states no grievance because it holds it was
// given what it needed two and a half thousand years ago; the Longbough Grove,
// which holds that a grievance is a claim and makes no claims; the Kiln
// Wardens, who are staff and have no interests of their own to have; and the
// Hollow Court, which has nothing left to be afraid of and therefore nothing
// left to reach for. Those are the only four, and each of them is characterised
// by not wanting rather than by having been left out.
// ─────────────────────────────────────────────────────────────────────────

export interface SectAmbition {
    /** What it is actually after. One line, specific enough to be refused. */
    wants: string;
    /**
     * Who stands in the way. Ids in this catalog, in `COURTS` or in
     * `APEX_INSTITUTIONS` - never a condition, a season or a mood.
     */
    blockedBy: readonly string[];
    /** What it would take, and what the house is prepared to spend on it. */
    wouldCost: string;
    /**
     * Anybody else with a hand on the same thing. Symmetric across the catalog:
     * if A is contesting with B, B is contesting with A, and both entries
     * describe the same object from their own side.
     */
    contestedWith: readonly string[];
    /** How far it has actually gone, which is usually not far. */
    movedOn: string;
}

export interface SectEntry extends Sect {
    /** Technique ids the sect will teach, gated by rank in the engine. */
    teaches: readonly string[];
    /** The art the sect is known for, or null where it teaches nothing. */
    signatureTechniqueId: string | null;
    /** Categories the sect is strong in, for matchmaking and rumour text. */
    specialities: readonly TechniqueCategory[];
    /** Ids of sects with a standing feud. Symmetric across the catalog. */
    rivals: readonly string[];
    /** Where the sect sits, in coarse terms worldgen can attach to a region. */
    territory: string;
    /**
     * False for powers that take no applicants at all.
     *
     * This is a door question and not an intake model, which matters for the
     * dao houses: a house has a route in, so the flag is true, and the route is
     * adoption rather than an admission day. `intakeRouteOf` is the three-valued
     * read - open, adoption, closed - and is what a caller should reach for
     * when it wants to know how somebody actually gets in. The boolean stays
     * because the engine, the tool layer and the register all branch on it.
     */
    recruits: boolean;
    compound: SectCompound;
    /**
     * What it is trying to become. Absent on the four that want nothing; see
     * the DRIVE comment above.
     */
    ambition?: SectAmbition;
}

// ─────────────────────────────────────────────────────────────────────────
// DAO HOUSES
// A different kind of faction. A Dao house is not a sect with stronger
// cultivators; it is an institution that has spent thousands of years
// understanding one principle better than anyone alive, and has turned that
// understanding into civil authority.
//
// The important half of each house is what its principle touches OUTSIDE a
// fight. A karma house does not do nine hundred points of karma damage; it
// supplies the region's debt arbiters, inheritance authorities and
// investigators, and the frightening question about it is never "can I kill
// this man" but "what happens afterwards".
//
// Three rules keep them from being omnipotent, and all three are asserted in
// the catalog test:
//   1. Every house has a named counter, and wherever possible a rival house
//      holds it. Specialisation is an advantage, never ownership.
//   2. Every house is genuinely bad at things, in ways a player can exploit.
//   3. Every house has internal factions, shortages, declining branches and
//      methods that never worked.
//
// Some of them stand on houses they destroyed, and wrote the record
// afterwards. `succession.officialVersion` is what their own archive says.
// `succession.trueVersion` is what happened, and is never told to the player -
// it is what the ruins, the descendants and the surviving records add up to.
// ─────────────────────────────────────────────────────────────────────────

export type DaoPrinciple =
    | 'karma'
    | 'fate'
    | 'oaths'
    | 'severance'
    | 'names'
    | 'space'
    | 'fixity';

export interface DaoHouseCounter {
    /** The thing that beats this house's principle. */
    name: string;
    /** House that actually holds it, or null when only ruins hold it now. */
    heldBy: string | null;
    description: string;
}

export interface DaoHouseSuccession {
    /** Id in DESTROYED_DAO_HOUSES. */
    predecessorId: string;
    yearsAgo: number;
    /** What the house's own archive says, and what everyone repeats. */
    officialVersion: string;
    /** What happened. Discovered, never announced. */
    trueVersion: string;
    /** Evidence a player can actually reach that does not agree with the archive. */
    discoverableTraces: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────
// A HOUSE IS A FAMILY, WHICH IS THE WHOLE FORM
//
// The seven houses are outside the pyramid: no apex above them, no grant, no
// terms and no standing to lose. That is what makes an ancient house at
// ordinal thirty a different kind of problem from a sect at the same figure -
// a sect can be leaned on through whoever renews it, and a house can only be
// dealt with. It also means everything a house holds, it holds in its own
// name: the treaty vault, the register wall, the datum stone, the survey of
// record. Nobody granted those and nobody can decline to renew them.
//
// And it means the roster is a lineage. A house does not recruit; it has
// children, and their children hold the same books. `ranks` on a house are
// positions inside a family rather than rungs a stranger climbs, and the
// consequence is the structural weakness of the whole form: seven centuries of
// accumulated understanding sit on whoever happens to have been born, and a bad
// generation cannot be hired around.
//
// ADOPTION IS THE ONLY DOOR, and it is narrow in one specific direction. Not
// general talent and not a high realm: somebody exceptional at the one dao that
// house exists for. A brilliant swordsman is of no interest to the House of
// Held Names. Once in a century somebody outside turns out to be extraordinary
// at exactly the thing, and adoption is the only instrument that converts that
// person into somebody the house can keep - so they are taken into the family,
// and then usually married to one of its own, because the adoption makes them
// family on paper and the marriage makes the next generation family in fact.
// Neither is affection and neither is cruelty. It is a lineage doing the only
// thing available to it.
//
// The offer is asymmetric and the houses do not pretend otherwise. What is
// gained is a name eight hundred to five thousand years old and a library
// nobody outside has read. What is given up is being one's own line: the
// children are the house's, and so is the dao after you. It is also barely
// negotiable, because a house that has decided it wants somebody has almost no
// competition - nobody else can offer what it offers and nobody else wants that
// exact talent as badly.
//
// NAMING FOLLOWS FROM ALL OF IT, and the direction is the part people get
// backwards. The house does not name the family: the family is older, and what
// the house is called is what the family does. The Fu run the Measured Span,
// and Measured Span is a trade while Fu is who they are - which is why the
// founders are recorded under ordinary personal names centuries before any of
// these were institutions. So `houseSurname` is the family, every member of the
// house carries it, and a man adopted in changes his to it, because that is
// what the adoption is.
//
// A woman who married in may keep her own, and across all seven houses exactly
// two have. The rarity is the content: a different surname on a house roll is
// immediately legible as somebody who came in from outside and did not give all
// of it up, and it is worth reading closely rather than as decoration. One of
// the two currently runs the Ninefold Ledger, which makes the head of an
// adoption-only house the single member of it who was never adopted.
// ─────────────────────────────────────────────────────────────────────────

export interface HouseAdmission {
    /** Always adoption. There is no membership in a house that is not kinship. */
    route: 'adoption';
    /** The one talent that gets an outsider looked at, in that house's terms. */
    prodigyIn: string;
    /** Who they are married to, and what the marriage is actually for. */
    marriage: string;
    /** What the adoptee gives up, which is their own line and their dao after them. */
    surrendered: string;
    /** How the name works here, including who is allowed to keep their own. */
    naming: string;
    /** The last time it happened, and to whom. Rare by construction. */
    lastTaken: string;
    /** What the house cannot do because it cannot recruit. Never nothing. */
    costOfTheForm: string;
}

export interface DaoHouseEntry extends SectEntry {
    principle: DaoPrinciple;
    /**
     * The family name, which is also the house's name. Everybody on the roll
     * carries it except somebody who married in and declined to change.
     */
    houseSurname: string;
    /** The only route in. See the section comment above. */
    admission: HouseAdmission;
    principleDescription: string;
    /** Years since founding. The accumulated weight is the whole point. */
    foundedYearsAgo: number;
    /** What the principle reaches into away from a fight. The important half. */
    civilReach: readonly string[];
    /** Services actually supplied to the world, in plain terms. */
    services: readonly string[];
    /** Who cannot function without those services. */
    dependents: readonly string[];
    counter: DaoHouseCounter;
    /** Things this house is genuinely bad at. Exploitable, not decorative. */
    blindSpots: readonly string[];
    /** Named internal divisions. Houses are political before they are strong. */
    internalFactions: readonly string[];
    /** Shortages, declining branches, incomplete knowledge, failed methods. */
    weaknesses: readonly string[];
    succession: DaoHouseSuccession | null;
    /** What killing one of their people actually costs, stated factually. */
    afterwardsClause: string;
}

export interface DestroyedDaoHouse {
    id: string;
    name: string;
    principle: DaoPrinciple;
    destroyedYearsAgo: number;
    /** Id of the faction that ended it, or null where nobody now knows. */
    destroyedBy: string | null;
    officialVersion: string;
    trueVersion: string;
    /** What is left: ruins, bloodlines, standing oaths, cursed ground. */
    traces: readonly string[];
    /** Technique ids in `techniques.ts` that are fragments of its discipline. */
    fragmentTechniqueIds: readonly string[];
}

export interface DaoHouseDispute {
    id: string;
    /** The disagreement about reality, not the fight it occasionally causes. */
    subject: string;
    positions: readonly { houseId: string; position: string }[];
    /** What the disagreement does in practice, to people who are not in it. */
    consequence: string;
}

const REGIONAL_SECTS: readonly SectEntry[] = [
    // ═══════════════════════════════════════════════════════════════════
    // RIGHTEOUS
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'sect-azure-cloud-pavilion',
        name: 'Azure Cloud Pavilion',
        alignment: 'righteous',
        // The third apex, and the only one with a front gate. See APEX_INSTITUTIONS.
        powerOrdinal: 41,
        ranks: ['Sword Servant', 'Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Sword Elder', 'Pavilion Master'],
        // The membership bar, and it is not the door. The Pavilion takes
        // uncultivated mortals onto probation at ordinal 0 and converts almost
        // none of them; `SECT_ADMISSION.guestFromOrdinal` carries that floor,
        // because `rankRealmBand` derives every band here from this number and
        // moving it to 0 would demote the entire ladder. See AZURE_CLOUD_INTAKE.
        admissionOrdinal: 3,
        stipend: [4, 12, 35, 110, 380, 1_100],
        teaches: [
            'iron-thread-finger',
            'hundred-cut-flying-blade',
            'white-tiger-rend',
            'golden-bell-shroud',
            'gale-riding-sword-flight',
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'void-piercing-sword-domain',
            // A metal road in the middle of the Pavilion's own shelf, which
            // ran 17 then 41 and nothing between - twenty-four rungs in which
            // a house whose library is metal end to end had no metal book at
            // all, and its disciples left the element to climb. This does not
            // close that hole and is not meant to; it puts one rung of the
            // house's own element where the gap is widest.
            'drawn-wire-canon',
            // The road to the top of the ladder, and the reason this list used
            // to be wrong: an apex that has produced an ascension inside living
            // memory was carrying a teach list that stopped at Core Formation,
            // so the register reported the strongest house in the region as
            // unable to teach past the middle of the ladder. Holding it is not
            // the same as handing it over - see `THE_DEEPEST_ROADS` for the two
            // lent copies and the one person, sometimes, who can show it.
            'clear-terrace-ascension-canon'
        ],
        signatureTechniqueId: 'void-piercing-sword-domain',
        specialities: ['attack', 'movement'],
        rivals: ['sect-crimson-abyss-hall', 'sect-ashen-forge-clan'],
        territory: 'Terraced peaks above Low Fall gorge, and the vein under it, taken off somebody else nineteen centuries ago.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 41,
            formationNodesLit: 9,
            remnant: 'A practice yard cut for six hundred, with two hundred and ten flagstones worn through and the rest sharp as the day they were laid.'
        },
        description:
            'The region\'s orthodox sword sect, on terraces cut into the peaks above the Low Fall gorge, sitting on a vein it took off somebody else nineteen centuries ago and has held ever since. Its library is metal from end to end - the thread flicked off a fingertip, the flying blade, the white tiger\'s four hooked lengths, the golden bell, and the standing sword domain at the top of it - so a Pavilion disciple fights at reach and in the air, and is conspicuously bad in a corridor against somebody who has already closed. What the province sees is the courtyard, and both of the things the Pavilion is actually best at happen indoors: it certifies that a person is who they say they are, permanently and without appeal, and it runs the only programme in the world that takes uncultivated mortals onto probation and spends years finding out what they are. The number nobody says out loud is that it reliably produces Core Formation and that what it has put past Nascent Soul in four hundred years can be counted on one hand, with a Ru at each end of the count - the elder crossed three hundred and eighty years ago and is the last confirmed crossing either province can date, and the younger is sitting in the inner hall now. A house that carries one family past the middle of the ladder and thins to almost nothing around them has not found a method; it has a name and a vein, and neither of those is a method. That is why the nine lit nodes out of forty-one, the practice yard cut for six hundred that holds ninety, and the one woman the province can count in the inner hall are all the same fact.',
        ambition: {
            wants:
                'The other two to price what a house does on the axis they refuse to price, and to say so where it can be quoted. It is not asking either of them to change; it is asking them to answer in their own words instead of in a silence, which is the only move available to a body that objects and cannot act.',
            blockedBy: ['apex-deep-survey', 'apex-long-cut'],
            wouldCost:
                'Nothing it can be made to pay, and everything it would rather not spend. Any two apexes can end any third, both of the others know exactly what the Pavilion would do afterwards, and being the only one of the three whose behaviour follows from its doctrine is what keeps it safe and what makes it useless in a room. Pressing harder converts a standing objection into an event, and an event is the one thing a house three hundred and eighty years old cannot afford against two nobody can date.',
            contestedWith: [],
            movedOn:
                'It declines to sign, declines to attend, puts the objection on records nobody asked for, teaches its forms below cost to houses that will not take a demonic grant, and keeps a list it has never published and has never denied keeping.'
        }
    },
    {
        id: 'sect-verdant-spring-hall',
        name: 'Verdant Spring Hall',
        alignment: 'righteous',
        powerOrdinal: 26,
        ranks: ['Herb Boy', 'Outer Physician', 'Inner Physician', 'Hall Physician', 'Life Elder', 'Hall Sovereign'],
        admissionOrdinal: 2,
        stipend: [5, 14, 40, 130, 420, 1_200],
        teaches: [
            'green-sprout-lash',
            'green-mercy-mending-palm',
            'bark-armor-circulation',
            'windborne-willow-step',
            'hundred-herb-restoration-art',
            // The road up to the Canon, which the Hall did not previously
            // list and therefore did not have: its wood canon opens at 16 and
            // nothing on the shelf reached 16, so a Herb Boy admitted at 2
            // could not open the only manual the Hall owns. Both of these are
            // ordinary market stock and always were.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'verdant-longevity-canon',
            // The wood line continued past Foundation for the first time. The
            // Hall's canon capped at 17 and the next wood book in the world
            // did not exist, so the Hall's own attuned disciples changed to
            // somebody else's elementless road at exactly the rung its
            // identity should have been deepest.
            'heartwood-forming-canon',
            // And the rung above that, which makes the Hall the clearest case
            // in the catalog of what a house's road decides about a career.
            // Its wood line runs 16, 17, 21, 25; its elementless line stops at
            // 17. So a wood root here has somewhere to go for four realms and
            // anybody else is finished at Foundation, in a house that is
            // otherwise generous, open and cheap to join. Which road you are
            // on is how far you get inside these walls, and the Hall has never
            // pretended otherwise at its own gate.
            'grafted-form-canon',
            // The Hall's one serious weapon, and it is a physician's weapon:
            // the barbs are shaped so that taking the shaft out is a second
            // injury, which is knowledge nobody else in the province has and
            // which the Hall also charges to undo. Taught quietly, to the
            // people who go out and collect.
            'bramble-crown-spear',
            'spring-returning-life-art'
        ],
        signatureTechniqueId: 'spring-returning-life-art',
        specialities: ['support', 'cultivation', 'defense'],
        rivals: ['sect-bone-lantern-cult'],
        territory: 'A terraced herb valley fed by nine warm springs, on ordinary ground with no vein worth the name - which is why the Hall lives on its physicians.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 22,
            formationNodesLit: 14,
            remnant: 'Stone channels feeding the beds, cut to a standard the Hall\'s own masons cannot match and repair with fired clay where they crack.'
        },
        description:
            'A terraced herb valley fed by nine warm springs, an hour off the Low Fall road, on ordinary ground with no vein worth the name - which is the whole explanation for everything else about the Hall. Its arts are wood and support almost without exception, from the mending palm any villager can be shown to the restoration art at the top, so its physicians are formidable at keeping somebody alive and have almost nothing to hit anybody with; a Hall cultivator in a fight is looking for the moment after it. Outsiders read the treatment of enemies as softness and get the ledger wrong: the Hall treats anyone who arrives injured and then bills them, never writes a bill off, and holds the largest book of unpaid obligations in the province. It is one of the few houses in the catalog whose pipeline is healthy rather than inherited - reliable to Core Formation Perfection on ground that gives it nothing, because the physicians cultivate at the bedside and the springs are worth more as a working valley than as a vein would have been.',
        ambition: {
            wants:
                'A grant of its own from the Third Sill, rather than holding the valley as a sub-tenancy from the Ascetic Order.',
            blockedBy: ['sect-nine-peaks-ascetic-order', 'court-third-sill'],
            wouldCost:
                'The Order will not release it, because the sub-tenancy is the only evidence the Order administers anything rather than merely squatting on a vein, and a court reads administering and holding very differently. Buying the release would take about nine years of the Hall\'s collections and would end the arrangement under which the Order\'s injured are treated at cost.',
            contestedWith: ['sect-nine-peaks-ascetic-order'],
            movedOn:
                'The Hall has stopped treating Order disciples at cost in two of its four dispensaries and has not said why, and the Peak Wardens have noticed and not raised it.'
        }
    },
    {
        id: 'sect-nine-peaks-ascetic-order',
        name: 'Nine Peaks Ascetic Order',
        alignment: 'righteous',
        powerOrdinal: 28,
        ranks: ['Stone Bearer', 'Ascetic', 'Inner Ascetic', 'Peak Warden', 'Mountain Elder', 'Order Patriarch'],
        admissionOrdinal: 5,
        stipend: [3, 10, 30, 100, 400, 1_400],
        teaches: [
            'loam-crusher-fist',
            'stone-hide-mantle',
            'five-breath-circulation-scripture',
            // The four rungs between the Order's primer and its vein canon.
            // An ascetic order that has held nine peaks for centuries does not
            // leave its own people unable to reach the book it is famous for;
            // it buys the plain editions like everybody else.
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            'tectonic-seal-palm',
            'unyielding-mountain-body',
            'mountain-vein-devouring-canon',
            'hollow-mountain-decree'
        ],
        signatureTechniqueId: 'unyielding-mountain-body',
        specialities: ['defense', 'attack', 'cultivation'],
        rivals: ['sect-storm-tyrant-court'],
        territory: 'Nine linked peaks over the deepest vein anyone has surveyed and managed to keep.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 63,
            formationNodesLit: 11,
            remnant: 'A doorway on the fourth peak with handprints burned into the jamb at a height no one in the Order can reach flat-footed.'
        },
        description:
            'Nine linked peaks over the deepest vein anybody in the province has surveyed and managed to keep, held for two centuries without a foot of it leased to anyone. The library is earth and body from the crushing fist up to the mountain body and the vein-devouring canon, so an ascetic is slow, obvious, extremely hard to put down, and utterly unable to catch anything that decides to leave. What outsiders take from the road is the stone every ascetic carries and sets down on tables, and what the stone actually does is select for people who will do a pointless thing for years, which the Order\'s own intake records show and the Order does not teach. Eleven of sixty-three nodes are lit and the Order admits it does not know what forty of the others were for, but the pipeline tracks the vein exactly, which is the world in one row: production follows ground, and the ground here has not been sold.',
        ambition: {
            wants:
                'The vein taken off the Third Sill\'s apportionment entirely, and held outright the way the Pavilion holds the gorge.',
            blockedBy: ['court-third-sill', 'sect-stonewright-consortium'],
            wouldCost:
                'An assay, which means letting the Consortium put a figure on the deepest vein anybody has kept, in writing, where the Sill can read it. The Order has refused to be assayed for two hundred years and cannot make the claim without being, which is a trap it has understood since the second refusal and has never found a way around.',
            contestedWith: ['sect-verdant-spring-hall'],
            movedOn:
                'It has begun quietly maintaining the forty unlit nodes to a standard a surveyor would notice, which is the closest thing to a preparation the Order has ever made.'
        }
    },
    {
        id: 'sect-clear-river-alliance',
        // RENAMED OFF A WORD THE PARSER NEEDED. It was the Clear River
        // Alliance, and `alliance` is a bare alternative in the join-a-house
        // parser - "ally|alliance|swear|join" - so a house whose distinctive
        // word is `alliance` competes with every sentence about forming one.
        // The same defect cost the deposit parser the word `hoard`, which is
        // absent from `LEGACY_NOUNS` to this day because a faction was using
        // it. A fordhall is what this body actually is: eleven river towns and
        // every ford between them, agreed to rather than founded.
        //
        // THE ID STILL CARRIES THE OLD WORD. Sweeping it reaches into
        // `members.ts`, which another agent has open, and a half-applied id
        // rename does not compile. The name is what a player types and what
        // the parser sees, so the harm is fixed; the id is a follow-up.
        name: 'Clear River Fordhall',
        alignment: 'righteous',
        powerOrdinal: 24,
        ranks: ['Boat Hand', 'River Disciple', 'Current Disciple', 'Ford Master', 'River Elder', 'Alliance Head'],
        admissionOrdinal: 1,
        stipend: [3, 9, 26, 85, 300, 900],
        teaches: [
            'gutter-rain-palm',
            'reed-crossing-qinggong',
            'clear-spring-detoxification',
            // The Alliance's own road wants a cultivator already standing at
            // 10, and it admits at 1. The market primer is how anybody it
            // takes in gets as far as its water canon.
            'lesser-qi-gathering-manual',
            'moonlit-well-absorption-art',
            // AND THE TWO THAT MAKE IT A WATER HOUSE RATHER THAN A HOUSE WITH
            // A WATER BOOK. The Alliance topped out at thirteen: its own canon
            // stopped one rung into Foundation and there was no second water
            // road anywhere in the world to follow it with, so a ferryman's
            // child born to a water root walked the same elementless
            // succession as everybody else or stopped. These join it with no
            // seam - 13, then 17, then 21 - and give the Alliance the only
            // continuous elemental career below Core Formation in the catalog.
            'slack-water-foundation-canon',
            'held-under-canon',
            'nine-rivers-sword-chant',
            'still-water-mirror-guard',
            'samsara-tide-crush'
        ],
        signatureTechniqueId: 'nine-rivers-sword-chant',
        specialities: ['attack', 'movement', 'support'],
        rivals: ['sect-thousand-treasure-pavilion'],
        territory: 'Eleven river towns and every ford between them, none of it over a vein, all of it over traffic.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 8,
            formationNodesLit: 5,
            remnant: 'A pier at Scarwater standing on pilings that were already old when the town was named, and which no flood has yet moved.'
        },
        description:
            'Eleven river towns and every ford between them, none of it over a vein and all of it over traffic, which is the whole business model stated as geography. It teaches water and movement - the gutter palm that takes a bigger opponent\'s footing, the reed crossing, the nine-cut sword chant, the mirror guard - so an Alliance fighter is superb on and near water and merely competent a hundred paces from it, and knows it. Less a sect than a federation of ferrymen who learned to fight: it takes almost anyone, pays almost nothing, and its real asset is that a ferryman is told things nobody would tell a magistrate, which the Alliance has never once thought of as intelligence. Half its river charts are copies of a survey two ages old and still better than anything it has made since, and at some point in the last century it stopped attempting new ones without anybody deciding to.',
        ambition: {
            wants:
                'To federate the border road to Kettle and become a regional carrier rather than a river guild.',
            blockedBy: ['house-measured-span', 'sect-thousand-treasure-pavilion'],
            wouldCost:
                'Eleven days of road it cannot police, wagons it does not own, and a fight with a house that prices carriage in a distance nobody else can measure. The River Elders hold that the Alliance is river people and will drown on land, and they have the votes.',
            contestedWith: ['sect-thousand-treasure-pavilion', 'house-measured-span'],
            movedOn:
                'Three Ford Masters have been running an unlicensed wagon service to Scarwater for six years and remitting a share, which the River Elders have chosen not to establish.'
        }
    },
    {
        id: 'sect-sweptground-temple',
        name: 'Sweptground Temple',
        alignment: 'righteous',
        powerOrdinal: 30,
        ranks: ['Lamp Novice', 'Temple Monk', 'Inner Monk', 'Hall Warden', 'Quiet Elder', 'Abbot'],
        admissionOrdinal: 0,
        stipend: [2, 8, 24, 90, 360, 1_300],
        teaches: [
            'cross-meridian-strike',
            'iron-shirt-tempering',
            'swallow-skimming-step',
            'warm-current-qi-transfer',
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'formless-severing-intent',
            'nascent-lotus-canon',
            'soul-anchoring-invocation',
            'void-hollow-body'
        ],
        signatureTechniqueId: 'void-hollow-body',
        specialities: ['defense', 'support', 'cultivation'],
        rivals: ['sect-nine-abyss-flame-sect', 'sect-the-severed'],
        territory: 'A walled temple on swept ground, deliberately built where nothing has settled in an age.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 6,
            formationNodesLit: 6,
            remnant: 'Six nodes, all of them lit, all of them cut by the Temple\'s own hands, all of them weak - and the only complete working formation in the province.'
        },
        description:
            'A walled temple on swept ground a day out from the Sweptground treaty vault, built deliberately where nothing has settled in an age, which means no vein, no tribute and nothing anybody wants. Almost everything it teaches is elementless - the cross-meridian strike, the iron shirt, the warm current, the severing intent, the hollow body - and that is the point rather than a shortage: a temple that only accepted clean roots would be a temple for other people, and elementless arts will not conflict with whatever a muddled intake walks in carrying. It takes orphans, beggars, ruined roots and anyone else the good sects turned away that morning, asks for nothing but the work, and returns endowments of ground intact, which four separate sects have now discovered - and which is why it was never an apex and was never going to be. What makes an apex is somebody above the Lid feeding the house, and the abbot who crossed from here two and a half thousand years ago sent the Temple nothing: what came down came down to ordinary people across the province, a little of it passing through the Temple\'s hands and most of it not, in the largest uncatalogued distribution of immortal-made goods anybody has ever made. Its own patron above the Lid deliberately fed the province instead, which is exactly what the Temple does for people, done at the one scale where it changes a province. Six nodes, all lit, all cut by the Temple itself and all weak: it is the only complete working formation in the province and it is a beginner\'s diagram, which is also the honest summary of the whole institution. It holds one thing that is on no list, because the Temple keeps none, and that did not come from the abbot, because nothing did.'
    },
    {
        id: 'sect-lantern-hall',
        name: 'Lantern Hall',
        alignment: 'righteous',
        powerOrdinal: 31,
        ranks: ['Copyist', 'Reader', 'Hall Archivist', 'Keeper of Names', 'Senior Keeper', 'Hall Warden-General'],
        admissionOrdinal: 2,
        stipend: [6, 16, 44, 140, 460, 1_500],
        teaches: [
            'five-breath-circulation-scripture',
            'warm-current-qi-transfer',
            'meridian-knitting-needle-art',
            'formless-severing-intent',
            'soul-anchoring-invocation'
        ],
        signatureTechniqueId: 'soul-anchoring-invocation',
        specialities: ['support', 'cultivation'],
        rivals: ['sect-stonewright-consortium', 'sect-the-severed', 'house-held-names'],
        territory: 'Reading halls in nine cities, and a stack room under each one that is larger than the hall above it.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 30,
            formationNodesLit: 17,
            remnant: 'Ledgers in a hand nobody writes in any more, recording names of people who no longer possess them, indexed by the date of the crossing that took them.'
        },
        description:
            'Reading halls in nine cities, each with a stack room under it larger than the hall above, and every one of the nine leased from somebody else. It teaches almost nothing offensive - circulation, the warm current, the needle art, the severing intent, the soul anchor - because a Keeper\'s working day is spent copying, and the Hall considers a slow pipeline the correct price for that. What it does is write down what the crossings take: when a boundary cuts away a face, a name, or the fact that two people were brothers, the Hall records what it was from whatever witness is left, so that somebody in the world still holds it. Its position is that a world requiring its best people to amputate everything they loved in order to rise is a world eating itself, and that the cheerful word for this is the price - which makes the Hall correct, unwelcome in nine cities, and the only body alive that can tell a cultivator what a boundary is likely to cost them before they reach it.',
        ambition: {
            wants: 'Its nine stack rooms out of House of Held Names leases and into the Hall\'s own name.',
            blockedBy: ['house-held-names'],
            wouldCost:
                'More than the Hall has, and the House will not sell at any figure, because a counter-register it holds the floor under is a counter-register it can end in a season. Moving instead means shifting four ages of damp-damaged registers across nine cities, and the Hall\'s own archivists put the loss at one volume in twelve.',
            contestedWith: ['house-held-names'],
            movedOn:
                'The Warden-General has had two of the nine surveyed for a move and has told nobody, including the Keepers of Names who would have to carry the volumes.'
        }
    },

    // ── the two Azure feeders ──────────────────────────────────────────
    // The Pavilion grants to nobody except these two, which is the whole of its
    // structure, and one of them has since been promoted to its court - the Mist,
    // on the same ground, with the same four people. A court administers an
    // arterial vein for an apex; a feeder does not administer anything - it takes people the apex is
    // not currently willing to hold and keeps them where they can be watched.
    //
    // Being sent down to one is not a disgrace and nobody in the Low Fall reads
    // it as one. A disciple on probation at Mist or Dew is a disciple the
    // Pavilion has decided is worth the cost of somewhere to put them, which is
    // a great deal more than it decides about most people.
    {
        id: 'sect-azure-mist-court',
        name: 'Azure Mist Court',
        alignment: 'righteous',
        powerOrdinal: 37,
        ranks: ['Mist Servant', 'Outer Disciple', 'Inner Disciple', 'Mist Elder', 'Court Warden'],
        admissionOrdinal: 1,
        stipend: [3, 10, 30, 95, 300],
        teaches: ['lesser-qi-gathering-manual', 'foundation-tempering-scripture', 'iron-thread-finger', 'hundred-cut-flying-blade'],
        signatureTechniqueId: 'hundred-cut-flying-blade',
        specialities: ['attack'],
        rivals: [],
        territory: 'The lower gorge, below the Azure Cloud terraces and inside the same grant, on the half of the vein that was never worth terracing.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 19,
            formationNodesLit: 12,
            remnant: 'A practice yard laid out for four hundred, kept swept for sixty, with the stone worn into lanes that no longer match where anybody stands.'
        },
        description:
            'The lower gorge, below the Azure Cloud terraces and inside the same grant, on the half of the vein that was never worth terracing. It teaches four Pavilion arts and nothing of its own - the gathering manual, the tempering scripture, the thread and the flying blade - to people who have already failed at exactly those, which is a thing the terraces have four centuries of experience not doing. The name was the oldest joke in the Low Fall for three centuries and stopped being one without anybody noticing: a court administers an arterial and issues grants, and the Mist now administers the terrace runoff and issues grants in the name of the Pavilion, which is the whole of the definition. The Sword Elder who was sent down here as a punishment nobody wrote down spent forty years turning a posting into an institution and called it a Court because he wanted to; the province let him have it out of amusement; and somewhere in the second century after that it became true. Nobody has revised the joke. What it holds is people - probationers, late admissions, the refused-but-not-disqualified - and it is reliable to Core Formation on twelve lit nodes because teaching somebody who has failed once is a different trade from teaching somebody who has not, which nobody at the terraces has ever asked about.',
        ambition: {
            wants:
                'The quarterly probation roll actually read by somebody at the terraces who could act on it.',
            blockedBy: ['sect-azure-cloud-pavilion'],
            wouldCost:
                'Being interesting, which the Warden holds is the same day the Mist stops being safe. The roll has been filed unopened for ninety years, the clerk who files it has said so to three Mist Elders, and none of the three passed it on - so the cost is first of all admitting internally that the house already knows.',
            contestedWith: ['sect-azure-dew-sect'],
            movedOn:
                'Nothing has been sent up. Yu Shenxing has forty-one names and four replies and has begun writing to the four rather than to the terraces.'
        }
    },
    {
        id: 'sect-azure-dew-sect',
        name: 'Azure Dew Sect',
        alignment: 'righteous',
        powerOrdinal: 24,
        ranks: ['Dew Servant', 'Outer Disciple', 'Inner Disciple', 'Dew Elder', 'Sect Warden'],
        admissionOrdinal: 0,
        stipend: [2, 8, 26, 85, 260],
        // Its own gathering canon rather than the market primer, which is what
        // "teaches two manuals and no more" below has always meant: the Dew's
        // trade is finding people, and the thing it hands a find is the four
        // hundred years of village teaching written into its own copy. Same
        // rungs as the block-printed book, and not the same object - see
        // `MANUAL_QUALITY` in `techniques.ts`.
        teaches: ['azure-dew-gathering-canon', 'foundation-tempering-scripture'],
        signatureTechniqueId: 'azure-dew-gathering-canon',
        specialities: ['support'],
        rivals: [],
        territory: 'Four hill villages at the head of the gorge, where the vein runs shallow enough that a mortal can feel it on a cold morning.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 6,
            formationNodesLit: 6,
            remnant: 'The only compound in the grant that was built rather than inherited, which the Dew mentions more often than the Pavilion finds comfortable.'
        },
        description:
            'Four hill villages at the head of the gorge, where the vein runs shallow enough that a mortal can feel it on a cold morning, and a compound the Dew built rather than inherited. It teaches two manuals and no more - gathering and tempering - because its trade is not instruction but finding: Dew teachers work a village for two years before anybody is asked to join, so admission is a formality performed on somebody who has already been coming. Six nodes of six, all lit, all its own work, which makes it the one holding in the Azure grant that is not living in somebody else\'s building, and its Wardens raise both facts more often than the Pavilion enjoys. It sends two or three a decade up the gorge who would never have reached a terrace gate alone, records them by name going back four hundred years, and keeps none of them, which is the only sect in the catalog that measures itself in people it no longer has.',
        ambition: {
            wants:
                'Its finds sent straight to the terraces with a Dew recommendation on them, rather than routed through a Mist year that takes the credit.',
            blockedBy: ['sect-azure-mist-court', 'sect-azure-cloud-pavilion'],
            wouldCost:
                'The finds. Half the Dew Elders can count: a Mist year is what makes a terrace admission stick, and a name sent straight up is a name that comes straight back down, so the house would be trading its people\'s careers for its own roll.',
            contestedWith: ['sect-azure-mist-court'],
            movedOn:
                'It has begun writing the Dew origin into the village roll in a second hand, so that a terrace clerk reading the admission would have to see it twice.'
        }
    },
    // ═══════════════════════════════════════════════════════════════════
    // NEUTRAL
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'sect-stonewright-consortium',
        name: 'Stonewright Consortium',
        alignment: 'neutral',
        powerOrdinal: 33,
        ranks: ['Weigher', 'Refiner', 'Factor', 'House Factor', 'Rate-Setter', 'Consortium Principal'],
        admissionOrdinal: 6,
        stipend: [10, 30, 90, 300, 1_000, 3_000],
        teaches: [
            // A metal road at Core Formation, and the reason there is now more than
            // one: the fire canon was the only continuation at 17-20 in the
            // whole world, so a metal root arrived here with nothing.
            'iron-silt-settling-canon',
            'lesser-qi-gathering-manual',
            // And the Foundation book between them, without which the metal
            // road above was unopenable by anybody the Consortium trained
            // itself: it wants 17 and the primer stops at 13.
            'foundation-tempering-scripture',
            // The trade's own book, in a mason's vocabulary, and the earth
            // road the Consortium should always have been the house that had.
            // It opens at the primer's cap and hands off to the metal canon
            // above, so the shelf now walks end to end in two elements.
            'footing-and-fill-canon',
            'shadow-splitting-gait',
            'formless-severing-intent',
            'thousand-li-cloud-tread'
        ],
        signatureTechniqueId: 'thousand-li-cloud-tread',
        specialities: ['movement', 'cultivation'],
        rivals: ['sect-lantern-hall', 'sect-thousand-treasure-pavilion'],
        territory: 'Refining houses at the head of nine veins, and the exchange rate, which is the real territory.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 55,
            formationNodesLit: 34,
            remnant: 'Presses that compress raw drawn qi until it holds its shape, of a design the Consortium repairs constantly and has never once managed to build a new one of.'
        },
        description:
            'Refining houses at the head of nine veins, and the exchange rate, which is the real territory. It teaches almost nothing that fights - the gathering manual, two ways of leaving a room quickly, the severing intent - because a Factor\'s job is to arrive, weigh, price and go, and the Consortium buys its violence retail when it needs any. It draws raw qi off veins, refines it into assayed stones and sets the rate, which means it sets the price of medicine, of a cave on decent ground, and of a vein itself, and no vein sale in the province goes through without its assay. It is not evil and it is not a counting house either: about half its Core Formation members were bought mid-career off other sects, which makes it the largest employer of finished cultivators in the region and the reason three smaller houses have no seniors left, and it maintains refining presses of a design its own artificers have never once managed to rebuild.',
        ambition: {
            wants:
                'To publish a vein index and make the price of ground explicit, which would make the Consortium the body that prices veins rather than the body that prices what comes out of them.',
            blockedBy: ['sect-thousand-treasure-pavilion', 'court-third-sill'],
            wouldCost:
                'An explicit price for a vein is a starting gun, which is the Principal\'s whole objection and is correct. It would also make public that in four recorded shortages the rate was set by what the Thousand Treasure Pavilion would pay and published a week later as the Consortium\'s own.',
            contestedWith: ['sect-thousand-treasure-pavilion'],
            movedOn:
                'The Rate-Setters have compiled the index twice, in secret, and both copies are in the same locked house at Low Fall, which about eleven people know.'
        }
    },
    {
        id: 'sect-thousand-treasure-pavilion',
        name: 'Thousand Treasure Pavilion',
        alignment: 'neutral',
        powerOrdinal: 27,
        ranks: ['Runner', 'Clerk', 'Appraiser', 'Hall Steward', 'Council Seat', 'Grand Steward'],
        admissionOrdinal: 4,
        stipend: [8, 25, 70, 220, 700, 2_000],
        teaches: [
            'lesser-qi-gathering-manual',
            'shadow-splitting-gait',
            'formless-severing-intent',
            'emberstep-mirage'
        ],
        signatureTechniqueId: 'emberstep-mirage',
        specialities: ['movement'],
        rivals: ['sect-clear-river-alliance', 'sect-cinnabar-crucible-guild', 'sect-stonewright-consortium'],
        territory: 'Auction houses in every city of consequence, and a vault nobody has located.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 19,
            formationNodesLit: 12,
            remnant: 'An auction floor with tiered seating for four hundred, of which the Pavilion fills the first two rows and rents the rest for storage.'
        },
        description:
            'Auction floors in every city of consequence, a vault nobody has located, and a commission everybody grumbles about and nobody refuses. Its curriculum is a merchant\'s - gathering, two escapes and an elementless cut - and its actual expertise has no name it could say aloud: its appraisers can tell you which age a dug object came out of, which kind of hole, and frequently which province, and there is no better body of that skill anywhere that is not doing it illegally. It buys dug goods from anyone and asks nothing about the hole, which is why the region is armed and furnished out of its own graves and why the Verdant Spring Hall and the Bone Lantern Cult are both, in different directions, its suppliers. It bought its own ancestors at an estate sale the Ninefold Ledger brokered, its staff genuinely believe the lineage because the fraud is three generations old, and the one thing the best grave-readers in the region have never been asked to appraise is the provenance of the lot the house itself bought.',
        ambition: {
            wants:
                'The Consortium\'s rate-setting broken, by publishing its own floor prices for assayed stone and honouring them.',
            blockedBy: ['sect-stonewright-consortium', 'house-ninefold-ledger'],
            wouldCost:
                'The Consortium\'s underwriting, without which the Pavilion cannot carry a large lot, and an almost certain Ledger audit of the tablet hall in retaliation. The house has priced that risk internally and the figure is kept by three people.',
            contestedWith: ['sect-stonewright-consortium', 'sect-clear-river-alliance', 'sect-halfwater-rail'],
            movedOn:
                'It has honoured an unpublished floor on four lots in two years to see whether anybody noticed, and nobody did.'
        }
    },
    {
        id: 'sect-cinnabar-crucible-guild',
        name: 'Cinnabar Crucible Guild',
        alignment: 'neutral',
        powerOrdinal: 25,
        ranks: ['Bellows Hand', 'Apprentice Alchemist', 'Journeyman Alchemist', 'Cauldron Master', 'Furnace Elder', 'Guild Grandmaster'],
        admissionOrdinal: 6,
        stipend: [6, 18, 55, 180, 560, 1_600],
        teaches: [
            'clear-spring-detoxification',
            'five-breath-circulation-scripture',
            'meridian-knitting-needle-art',
            'hundred-herb-restoration-art',
            // The Guild's fire road opens at 17 and its primer stopped at 13.
            // Alchemists buy paper; this is the edition they buy.
            'foundation-tempering-scripture',
            'molten-core-refinement-scripture'
        ],
        signatureTechniqueId: 'meridian-knitting-needle-art',
        specialities: ['support', 'cultivation'],
        rivals: ['sect-thousand-treasure-pavilion'],
        territory: 'Furnace halls beside the volcanic fields, and a fixed price list nobody negotiates.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 27,
            formationNodesLit: 15,
            remnant: 'A refining hall whose walls are covered in method-script; the Guild can read about a third of it and has built its whole reputation on that third.'
        },
        description:
            'Furnace halls beside the volcanic fields, a fixed price list nobody negotiates, and a refining hall wall it was founded on that is legible to about a third. It teaches detoxification, circulation, the needle art, the hundred-herb restoration and the molten core scripture, which is a curriculum for people who will spend their cultivation years standing at a cauldron, and the Guild treats a Core Formation grandmaster as a complete career rather than a disappointment. Everybody sees the counter and almost nobody sees the examination hall behind it: admission is by examination rather than combat, so it is one of the very few doors in the world through which a careful person with no talent for violence walks out with a trade. Every formula above earth grade in its book was recovered rather than devised, it is quietly certain that the missing steps are why the heaven-grade batches fail, and it still teaches a step that killed the Furnace Elder who proved it was not one.',
        ambition: {
            wants:
                'Out from under the Frostmirror Court and back under the Third Sill, or failing that a cold source it does not buy from its own landlord.',
            blockedBy: ['sect-frostmirror-court', 'court-third-sill'],
            wouldCost:
                'The Frostmirror will not release it, because the Guild\'s tribute is most of what makes the cold arterial look administered rather than merely occupied. Finding cold elsewhere means the glacier\'s competitors, and there are none, so the honest price is a decade of failed high-grade batches while the Guild proves it can work warm.',
            contestedWith: ['sect-frostmirror-court'],
            movedOn:
                'Two petitions in forty years, both to the Third Sill, neither answered, and the Guild has begun dating its tribute receipts in a way that would let somebody reconstruct exactly what it has paid.'
        }
    },
    {
        id: 'sect-ashen-forge-clan',
        name: 'Ashen Forge Clan',
        alignment: 'neutral',
        powerOrdinal: 23,
        ranks: ['Coal Hand', 'Smith', 'Forge Disciple', 'Hammer Master', 'Cinder Elder', 'Clan Chief'],
        admissionOrdinal: 5,
        stipend: [6, 20, 60, 190, 600, 1_500],
        teaches: [
            // The forge's own road, taught the way the Consortium does not: slowly,
            // and to people who already work metal.
            'iron-silt-settling-canon',
            // The Clan held two Core Formation roads and nothing at all below
            // them, so a coal hand taken on at 5 could open neither. These are
            // the two everybody sells.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'scarlet-ember-palm',
            'ashfall-crescent',
            'cinder-lotus-blossom',
            'emberstep-mirage',
            'molten-core-refinement-scripture'
        ],
        signatureTechniqueId: 'cinder-lotus-blossom',
        specialities: ['attack', 'movement', 'cultivation'],
        rivals: ['sect-azure-cloud-pavilion', 'sect-nine-abyss-flame-sect'],
        territory: 'A clan compound built into the flank of a live volcano, around a furnace that was already there.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 12,
            formationNodesLit: 7,
            remnant: 'The great furnace itself, which the clan maintains, feeds and has never lit from cold - nobody knows the starting method, so it has not been allowed to go out in eleven generations.'
        },
        description:
            'A clan compound built into the flank of a live volcano, around a great furnace that was already there and cannot be relit. It teaches fire and only fire - the ember palm, the low crescent, the eight-petal bloom, the mirage step, the molten core scripture - which produces smiths who fight the way they work, at close range, in one committed motion, and who are helpless against anything that stays at ten paces. It is a blood clan, so intake is births rather than applicants and everybody in the compound including children and the chief takes a turn at the furnace rota; refusing a turn is how a person leaves the clan and it has happened twice. What the region knows it for is its long quarrel with the Azure Cloud Pavilion, and what it is actually good at is reading a ploughed-up fragment - which age, what it will tolerate, what it can be made into - so half the region is armed off a skill nobody can name the owner of.',
        ambition: {
            wants:
                'The Azure Cloud arms contract back, on the clan\'s terms rather than on the terms it was ended under.',
            blockedBy: ['sect-azure-cloud-pavilion', 'sect-nine-abyss-flame-sect'],
            wouldCost:
                'A public retraction of a two-hundred-year grievance the clan is not sure it can retract, and the loss of the Nine Abyss offer, which pays four times and is the only thing keeping the younger smiths at the rota. The Cinder Elders are losing that argument annually and know the year it ends.',
            contestedWith: ['sect-nine-abyss-flame-sect'],
            movedOn:
                'The clan has reforged and delivered eleven blades to the Pavilion at cost in the last four years without an order, and the Pavilion has accepted all eleven without acknowledging any.'
        }
    },
    {
        id: 'sect-hollow-bell-wanderers',
        name: 'Hollow Bell Wanderers',
        alignment: 'neutral',
        powerOrdinal: 20,
        ranks: ['Stray', 'Bellringer', 'Wanderer', 'Road Elder', 'Bell Keeper'],
        admissionOrdinal: 0,
        stipend: [1, 4, 12, 45, 160],
        teaches: [
            'cross-meridian-strike',
            'swallow-skimming-step',
            'gutter-rain-palm',
            'windborne-willow-step',
            'shadow-splitting-gait',
            'lesser-qi-gathering-manual'
        ],
        signatureTechniqueId: 'shadow-splitting-gait',
        specialities: ['movement', 'attack'],
        rivals: ['sect-crimson-abyss-hall'],
        territory: 'No fixed seat. A bell hung at a crossroads means members passed within the month.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 0,
            formationNodesLit: 0,
            remnant: 'Nothing. The Wanderers own no ground, which they present as a philosophy and everyone understands as a budget.'
        },
        description:
            'No fixed seat, no ground and no inheritance: a bell hung at a crossroads means members passed within the month, and never that they intend to come back. Its library is the cheap and portable end of everything - the cross-meridian strike, two escapes, the gutter palm, the willow step, the gathering manual - which is exactly the kit of people who dig for a living and expect to run, and it is priced at what a nobody with a muddled root can pay. Nobody else will take a Qi Condensation nobody with no family, the league knows it, and every sect in the province that refused them first now recruits out of them, which the Wanderers find funnier than they should. The bells are a four-generation map of every crossroads any member has walked, held by the only people in the province who have crossed it without a sect telling them where to go, and nobody has ever asked to read it.',
        ambition: {
            wants:
                'To keep one member past Foundation Establishment for a full decade, which it has not managed in sixty years.',
            blockedBy: ['sect-stonewright-consortium', 'sect-crimson-abyss-hall'],
            wouldCost:
                'A stipend the league does not collect and a reason to stay that is not a favour, and the Bell Keeper holds that the day the league owns ground is the day it starts refusing people. Everyone good enough leaves within a year and the league does not stop them, which is the arithmetic and is why the Road Elders want a seat.',
            contestedWith: ['sect-crimson-abyss-hall'],
            movedOn:
                'The Road Elders have been quietly holding back three names from the bells so that the recruiters cannot follow the route, which is the first thing the league has ever concealed.'
        }
    },
    {
        id: 'sect-frostmirror-court',
        name: 'Frostmirror Court',
        alignment: 'neutral',
        powerOrdinal: 36,
        ranks: ['Snow Servant', 'Mirror Disciple', 'Rime Disciple', 'Court Warden', 'Frost Elder', 'Court Sovereign'],
        admissionOrdinal: 13,
        stipend: [10, 30, 90, 300, 1_000, 3_000],
        teaches: [
            'bitter-frost-needle',
            'glacial-tomb-slash',
            'rimeglass-carapace',
            'frostmirror-displacement',
            // THE COURT'S ROAD, AND WHY IT IS LONGER THAN ANYBODY ELSE'S.
            //
            // The Court admits mutated ice roots and nobody else, and there is
            // no ice manual anywhere in the world below ordinal 33. So the
            // ordinary succession - four attuned books in a row - is not
            // available to a single person it has ever taken in, and it either
            // writes one long unattuned road or stops producing. It wrote one:
            // three realms on a single method, where every ordinary book
            // carries a reader through one.
            //
            // The market primer and the Foundation book beneath it are bought,
            // not written. The road ends at 29, which is exactly where the
            // world stops teaching anybody anything - `scripts/probe-shelf.ts`
            // and the caps suite both measure the taught ceiling at 29 - so
            // the Court is in the same position above it as every other house:
            // the Second Register is not in its hands, and its people cross
            // into Body Integration under a living master of the ice canon or
            // not at all. That last gap is `escapes.ts`, not a broken shelf.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'standing-mirror-first-register',
            'rime-heart-stillness-canon'
        ],
        signatureTechniqueId: 'rime-heart-stillness-canon',
        specialities: ['attack', 'defense', 'movement', 'cultivation'],
        rivals: ['sect-storm-tyrant-court'],
        territory: 'A glacier court above the snowline, on a cold vein nobody else can work, appearing on no accurate map.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 44,
            formationNodesLit: 26,
            remnant: 'A hall kept cold enough that nothing has ever drawn on the qi standing in it, which is why the Court cultivates there and nowhere else.'
        },
        description:
            'A glacier court above the snowline on a cold vein nobody else can work, appearing on no accurate map, with twenty-six of forty-four nodes lit and the floors left unswept as doctrine. It is the only institution left holding a complete ice curriculum, because the curriculum was sealed in the ice and the Court dug it out rather than inheriting it from teachers: the frost needle, the tomb slash, the rimeglass carapace, the mirror displacement and the stillness canon, which is the only ice-attuned accumulation canon above heaven grade anybody has. It will not open the library to anyone without a mutated ice root, and this is triage rather than arrogance - the arts kill everyone else, so every applicant it refuses is somebody it has declined to bury, and a mutated ice cultivator who finds this Court has found the one place their talent is not a death sentence. It became a court because the ice curriculum turned out to be the one thing in the province nobody could replace, and it is the only body in either province issuing grant paper of its own in a format that copies its landlord\'s, which it does while describing itself in correspondence as a peer rather than a junior, and while the glacier that fed the curriculum retreats forty spans below the working face.',
        ambition: {
            wants:
                'The third arterial, and the eleven grants that hang off it, administered by the Frostmirror instead of the Third Sill - or failing that, standing as a peer rather than a junior.',
            blockedBy: ['court-third-sill', 'apex-deep-survey'],
            wouldCost:
                'Everything it has, spent on a body that has not replied to eleven years of correspondence. The Court reads the silence as weakness and the province reads it as the Sill having read the Court correctly, and both readings cannot be right.',
            contestedWith: [
                'sect-storm-tyrant-court',
                'sect-nine-abyss-flame-sect',
                'sect-cinnabar-crucible-guild'
            ],
            movedOn:
                'Eleven years of letters, each one closer to quotable than the last, and it has begun issuing its own grant paper to the Cinnabar Crucible Guild in a format that copies the Sill\'s.'
        }
    },
    {
        id: 'sect-kiln-wardens',
        // Renamed. This is the half that left the datum, and it took the
        // Deep Survey's own administrative name for the posting with it - see
        // THE_KILN_SCHISM. The body still standing on the ground is the Kiln
        // Court, under the Survey, and says this one is not the house.
        name: 'The Root Sill Court',
        alignment: 'neutral',
        powerOrdinal: 36,
        ranks: ['Warden', 'Second Warden', 'Gate Warden', 'Keeper of the Kiln'],
        admissionOrdinal: 21,
        stipend: [200, 600, 1_800, 5_000],
        teaches: [],
        signatureTechniqueId: null,
        specialities: ['defense'],
        rivals: [],
        territory: 'The root vein, and a perimeter of nine days\' walk in every direction that nobody has surveyed twice.',
        recruits: false,
        compound: {
            inherited: true,
            formationNodesTotal: 900,
            formationNodesLit: 900,
            remnant: 'A gate. It is not large. Everything else the Wardens hold is behind it, and the gate is the only part any outsider has described.'
        },
        description:
            'The root vein - the deep ground every other vein in the region is understood to branch from, though nobody outside the gate has been permitted to test it - and a perimeter nine days\' walk in every direction that nobody has surveyed twice. It teaches nothing and takes nobody, and the fifteen rungs between its admission figure and its strongest Warden are not a gate anybody has ever been through: the bar is what a posting requires, not what an applicant could meet, and there has been no applicant in nine hundred years. In an age where every institution is fighting over drawn-down holdings, a body sitting on the richest ground in the world and taking none of it is the most alarming fact anybody has established about them, and it is closely followed by the second, which is that every one of the nine hundred nodes it holds is lit and nobody else in the world can say that about any number. The province has called them the Kiln Wardens for nine hundred years and they have never corrected it, which is convenient for them and correct in its own way: what stands at that gate is staff, posted, doing an assigned job on somebody else\'s datum, and every single thing the province finds inexplicable about them is explained by that sentence.'
    },
    {
        id: 'sect-hollow-court',
        name: 'The Hollow Court',
        alignment: 'neutral',
        // The highest acting power in the world, and the only faction whose
        // Tribulation Transcenders are awake. Everyone else at this ordinal is
        // sealed under a mountain. See the note on `recruits` below: this
        // number is real and it is almost never in the room.
        powerOrdinal: 44,
        // Four rungs, and they line up with four realms exactly: Void
        // Refinement, Body Integration, Grand Ascension, Tribulation
        // Transcendence. Admission at 29 plus the engine four ordinals per
        // rank lands on 29, 33, 37 and 41, so the ladder needs no special case.
        //
        // "Guest of the Court" is deliberately NOT here. It is honorary, given
        // without discussion, carries no obligation in either direction, and
        // sits outside the ladder rather than beneath it - which is why it can
        // be held by somebody the Court could not promote if it wanted to.
        ranks: ['Outer Disciple', 'Inner Disciple', 'Elder', 'Seat'],
        admissionOrdinal: 29,
        stipend: [500, 1_500, 4_000, 12_000],
        // One book, and it is the whole library. The Court teaches nothing
        // else because it is for nothing else: it exists to get its own
        // members over the last crossing, and a second title would be a second
        // purpose. This used to be empty, which said the highest acting body
        // in the world could not teach anybody anything - see
        // `THE_DEEPEST_ROADS` for what it holds and who can walk somebody up
        // it, which is the fact that actually distinguishes it from an apex.
        teaches: ['protected-crossing-canon'],
        signatureTechniqueId: 'protected-crossing-canon',
        specialities: ['defense'],
        rivals: [],
        territory: 'Four mountains standing on the richest vein anyone has ever surveyed, one occupant each, and a great deal of quiet in between.',
        // They do recruit, and the bar is the whole character of the place: Void
        // Refinement floor, and evidence you could reach the last realm. Nothing
        // else counts, which includes being somebody's child - see the admission
        // requirement.
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 200,
            formationNodesLit: 41,
            remnant: 'Stone seats arranged for an audience of two hundred, occupied by four people who have not moved them.'
        },
        description:
            'The holy ground of cultivation: four mountains standing on the richest vein anyone has ever surveyed, one occupant each, and a great deal of quiet in between. They are not four beings who reached the top and sat down - they are a collaboration, and possibly the only functioning one at that altitude in the history of the world. A crossing needs a dao protector, because the cultivator is helpless for the whole duration of it, and almost nobody can obtain one, which is why everybody else attempts the last step in a cave nobody was told about; the Court holds multiple Tribulation Transcenders and at points several at Perfection at once, so one crosses while the others stand guard. That single fact explains the rest of them: why they work at a published address on four known mountains rather than in hiding, because they have the thing secrecy is a substitute for; why presence is measured in decades of absence, because a protector has to be there; why the bar is a Void Refinement floor and evidence you could cross, since a member is either somebody who will need protecting or somebody who can provide it and there is no third contribution; and why they hold the best vein in existence and draw nothing from it, because the vein is not what the work runs on. Six of their members have crossed, which by the world\'s own reckoning is the top of the lineage tiers and is the one objective claim about them nobody disputes, and they may do it again in this era without anybody outside the four knowing it is being considered. The one ordinary thing about the place is the part nobody expects: a Seat arrived with a life and the Court does not take it away, so the friendships they came in with are two and three centuries old and still theirs, and they use them the way anybody uses one - to place a child somewhere good, by asking a friend at a strong house personally, never as the Court and never in writing. The Court is not told and has no view. The only term is discretion, and it needs no enforcement because naming a member burns the namer\'s own face in front of exactly the people whose trust is their whole position. The children are told nothing either, because parents know children talk - so what they grow up with is a placement they cannot account for, sometimes a memento nobody has explained, a good guess at the shape of it, and no name.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // DEMONIC
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'sect-the-severed',
        name: 'The Severed',
        alignment: 'demonic',
        powerOrdinal: 38,
        ranks: ['Bound', 'First Cut', 'Third Cut', 'Ninth Cut', 'Nameless', 'The Severed Themselves'],
        admissionOrdinal: 5,
        stipend: [15, 50, 170, 550, 1_800, 6_000],
        teaches: [
            // The only house in the region whose record supports teaching a Body
            // Integration manual, and the only alternative anywhere to an ice
            // canon held by a court that admits mutated roots and nobody else.
            'cinder-lung-tempering-canon',
            // Five orthodox books under the two the house is known for. A
            // cutting house that admits at 5 and expects Body Integration out
            // of the far end has to raise people through four realms first,
            // and none of that is done on a forbidden art: the devouring
            // method starts at 25, and nothing the house held reached 25.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            'shadow-splitting-gait',
            'crimson-tithe-palm',
            'meridian-devouring-art',
            'severed-name-finger',
            'void-hollow-body'
        ],
        signatureTechniqueId: 'severed-name-finger',
        specialities: ['forbidden', 'attack', 'movement'],
        rivals: ['sect-lantern-hall', 'sect-sweptground-temple', 'house-quiet-cut'],
        territory: 'No seat worth naming. Cutting houses at the edge of six cities, all of them rented.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 3,
            formationNodesLit: 3,
            remnant: 'A ledger of what each member has already given up, kept accurately, and shown to applicants before anything else.'
        },
        description:
            'No seat worth naming: cutting houses at the edge of six cities, all of them rented, three portable formation nodes, and a founding ledger entry whose identifying columns cut themselves. Its arts are severance and disappearance - the shadow gait, the tithe palm, the meridian-devouring art, the severed name finger, the hollow body - and a Severed cultivator fights like somebody who has already decided what they are willing to lose, because they have, and it is written down. The doctrine is the most coherent argument in the region and it works: every crossing takes something eventually, so pay it deliberately, cut the bonds and the memories and the name in advance at a time of your choosing, and cross every boundary clean. They climb faster than anybody in the catalog and their attrition is the worst, because most of them stop being people before they stop being cultivators, and the house regards that objection as sentimental rather than incorrect.',
        ambition: {
            wants:
                'The Bound Word\'s founding oath against witnessing for the Severed dissolved, so that its agreements can be witnessed like anyone else\'s.',
            blockedBy: ['house-bound-word', 'sect-lantern-hall'],
            wouldCost:
                'Nothing it can pay, which is the problem: the Bound Word wants the oath gone too and cannot revise its own instruments, and the dissolution method for an oath whose parties are all dead has never worked and is still taught. Meanwhile every contract the Severed sign is unwitnessed, which prices their work about a third above what it is worth.',
            contestedWith: ['house-bound-word'],
            movedOn:
                'The Nameless have paid for four separate readings of the founding text by three houses, and all four came back saying the same thing, which they have stopped commissioning.'
        }
    },
    {
        id: 'sect-crimson-abyss-hall',
        name: 'Crimson Abyss Hall',
        alignment: 'demonic',
        powerOrdinal: 29,
        ranks: ['Blood Offering', 'Crimson Servant', 'Chosen', 'Hall Master', 'Left Envoy', 'Abyss Lord'],
        admissionOrdinal: 3,
        stipend: [10, 35, 120, 400, 1_200, 3_500],
        teaches: [
            'scarlet-ember-palm',
            'loam-crusher-fist',
            'crimson-tithe-palm',
            'corpse-lantern-soul-forging',
            // The Hall's signature opens at 25 and the Hall taught nothing at
            // all below it, which made its own ceiling unreachable from the
            // inside. Ordinary editions, bought; a blood hall still has to get
            // an offering as far as Deity Transformation before it can spend
            // them on anything interesting.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            'meridian-devouring-art'
        ],
        signatureTechniqueId: 'meridian-devouring-art',
        specialities: ['forbidden', 'attack'],
        rivals: ['sect-azure-cloud-pavilion', 'sect-hollow-bell-wanderers', 'sect-bone-lantern-cult'],
        territory: 'A sinkhole hall under a town that officially does not know it is there.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 16,
            formationNodesLit: 6,
            remnant: 'A drain in the floor of the lower hall, cut for a purpose the Hall has adopted without ever establishing what it originally was.'
        },
        description:
            'A sinkhole hall under a town that officially does not know it is there, six of sixteen nodes lit, and a drain in the lower floor cut for a purpose the Hall has adopted without ever establishing. It teaches the ember palm, the crusher fist, the tithe palm, corpse-lantern soul forging and the meridian-devouring art, so its people fight cheaply and close and are all, without exception, spending something they were not told about at the time. Recruiters wait outside other sects\' admission days with a table and a cash box and pay the first month in advance to anybody who was refused inside, which everybody agrees is sinister and is in fact a wage. And the thing nobody says is that the Hall then teaches them: it produces more Foundation Establishment cultivators annually than any righteous sect in the province, out of people who were turned away that morning, and it would rather be thought predatory than cheap.',
        ambition: {
            wants:
                'Out from under the Storm Tyrant Court\'s tithe, which has not been revised since the First Abyss Lord and now runs at three times what it was in real terms.',
            blockedBy: ['sect-storm-tyrant-court'],
            wouldCost:
                'The Court treats refusal as a scheduling matter and the Hall is four realms below it. Buying the revision means offering the one thing the Court still wants, which is bodies, and the Hall\'s intake is the only thing it has that is genuinely its own.',
            contestedWith: ['sect-storm-tyrant-court', 'sect-hollow-bell-wanderers'],
            movedOn:
                'It has under-declared its intake for six years running by about a fifth, which the Court has not audited and eventually will.'
        }
    },
    {
        id: 'sect-bone-lantern-cult',
        name: 'Bone Lantern Cult',
        alignment: 'demonic',
        powerOrdinal: 26,
        ranks: ['Grave Digger', 'Lantern Bearer', 'Bone Disciple', 'Corpse Warden', 'Pale Elder', 'Cult Ancestor'],
        admissionOrdinal: 2,
        stipend: [7, 22, 75, 260, 800, 2_400],
        teaches: [
            // The house's cultivation manual. NOT its ceiling - the cult delivers short of what this book can carry, which makes it resource-limited rather than manual-limited, and the corpse work is what it does with people afterwards.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'cross-meridian-strike',
            'bark-armor-circulation',
            'crimson-tithe-palm',
            'corpse-lantern-soul-forging'
        ],
        signatureTechniqueId: 'corpse-lantern-soul-forging',
        specialities: ['forbidden', 'defense'],
        // The Sink Carriers are the third, and it is a quarrel about the same
        // bodies from two directions: the sand keeps a corpse and gives it
        // back a decade later with its possessions on it, so a carrier who
        // does not make the return leg is Cult stock, and the Carriers count
        // that person on their board as a name rather than as a supply.
        rivals: ['sect-verdant-spring-hall', 'sect-crimson-abyss-hall', 'sect-sink-carriers'],
        territory: 'Old battlefields, worked in rotation, in the third year after any large engagement.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 9,
            formationNodesLit: 2,
            remnant: 'A field wall of stacked fragments, sorted by weight rather than by what any of them used to be.'
        },
        description:
            'Old battlefields, worked in rotation, in the third year after any large engagement, and a field wall built of fragments sorted by weight rather than by what they were. It teaches four arts and two of them are corpse work - the cross-meridian strike, bark armour, the tithe palm and corpse-lantern soul forging - which makes its people durable, patient and carrying something that righteous sects execute for possessing. What it is actually best at is ground-reading: they are the best diggers alive and can date a battlefield to the season by what is flowering on it, which is a real science practised by people nobody will sit next to. They hold that the hundred-and-forty-year rotation exists to let sites recover; the founding note says it exists to let the survivors die off first, and the Cult has forgotten the difference.',
        ambition: {
            wants:
                'A rotation slot in the Quiet Marches burn zones, which are the only unworked ground left within reach.',
            blockedBy: ['sect-gleaners-company', 'sect-weir-office'],
            wouldCost:
                'Crossing a border neither region polices into ground the Gleaners have worked for forty years, against a company that has never defaulted on a dead digger\'s share and would be defending its people\'s living. The Cult already undercuts them there using finds the Company located, which is the grievance from the other side.',
            contestedWith: ['sect-gleaners-company', 'sect-sink-carriers'],
            movedOn:
                'Two Lantern Bearers have been working the Marches edge for three seasons without a rotation entry, which the Pale Elders have not sanctioned and have not stopped.'
        }
    },
    {
        id: 'sect-nine-abyss-flame-sect',
        name: 'Nine Abyss Flame Sect',
        alignment: 'demonic',
        powerOrdinal: 34,
        ranks: ['Kindling', 'Flame Servant', 'Abyss Disciple', 'Flame Hall Master', 'Nine Abyss Elder', 'Flame Sovereign'],
        admissionOrdinal: 8,
        stipend: [12, 40, 140, 480, 1_500, 4_500],
        teaches: [
            'ashfall-crescent',
            // Kindling is taken on at 8 and the sect's own transformation
            // wants 32. Six books of ordinary road between the two, four of
            // them bought off a stall and one of them forbidden - the Sect is
            // demonic and the devouring method is how its people cross Deity
            // Transformation, a vent vein being a poor thing to try to eat.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            'meridian-devouring-art',
            'molten-core-refinement-scripture',
            // The chant is the contract in miniature and the sect teaches it
            // as such: it lends a hall of people more than they have, states
            // the term out loud beforehand, and collects the exhaustion
            // afterwards with interest. The only art here that is not for the
            // person using it.
            'bloodwarm-battle-chant',
            'sunfeather-conflagration',
            'cinder-ward-of-the-burning-heart',
            'nine-abyss-demon-transformation'
        ],
        signatureTechniqueId: 'nine-abyss-demon-transformation',
        specialities: ['attack', 'forbidden', 'defense'],
        rivals: ['sect-sweptground-temple', 'sect-ashen-forge-clan'],
        territory: 'A caldera fortress on the vent vein, reached by one bridge kept in poor repair on purpose.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 38,
            formationNodesLit: 19,
            remnant: 'Nineteen nodes lit along the caldera rim and nineteen dark, in an alternating ring, because the sect could only read every other line of the diagram.'
        },
        description:
            'A caldera fortress on the vent vein, reached by one bridge kept in poor repair on purpose, with nineteen of thirty-eight nodes lit in an alternating ring because the sect could read every other line of the diagram and lit exactly what it understood. Its library is the hottest thing in the catalog - the ashfall crescent, the molten core scripture, the sunfeather conflagration, the burning-heart ward and the nine-abyss transformation - so its people fight by outlasting the heat they are standing in, and its elders are visibly not human any more in one specific way each. It is the one demonic sect in the province that holds from the Long Cut rather than the Deep Survey, which means the apex with a doctrine about who holds ground has no instrument on it at all, and it is the only body of any alignment that hands an applicant the full text of a transformation contract before they sign - total honesty about a monstrous bargain, which reads to everybody as recruitment. Its pipeline works for a reason nobody else can copy, because the contract works and the cost is paid later and by the individual, and it is alone among the high factions in not having concluded that the road upward is shut - which is either the only clear sight in either province or the contract talking.',
        ambition: {
            wants:
                'A court of its own, on the grounds that the transformation curriculum is the third irreplaceable thing in the province and the other two were promoted for exactly that.',
            blockedBy: ['court-third-sill', 'apex-deep-survey'],
            wouldCost:
                'The Frostmirror was promoted for ice and the Storm Tyrant for lightning, and both are neutral or worse rather than openly demonic, which is the distinction the sect insists is not one. Pressing it means an assay of the vent, and the vent has thinned measurably.',
            contestedWith: ['sect-frostmirror-court', 'sect-storm-tyrant-court', 'sect-ashen-forge-clan'],
            movedOn:
                'It has submitted the curriculum for certification to the Ninefold Ledger, unprompted, at its own expense, which no demonic sect in the province has ever done.'
        }
    },
    {
        id: 'sect-storm-tyrant-court',
        name: 'Storm Tyrant Court',
        alignment: 'demonic',
        powerOrdinal: 34,
        ranks: ['Rod Bearer', 'Storm Servant', 'Arc Disciple', 'Thunder Warden', 'Storm Elder', 'Storm Tyrant'],
        admissionOrdinal: 9,
        stipend: [14, 45, 150, 500, 1_600, 5_000],
        teaches: [
            // The house's cultivation manual. NOT its ceiling - the Court delivers short of what this book can carry, which is a statement about what it can source rather than about what it can teach. The court climbs on storm work and this is the gathering canon underneath it.
            // And the road up to it, which the Court did not list. It admits
            // at 9 and its canon opens at 21; nothing between the two was on
            // the shelf, so the storm work above was unreachable by anybody
            // the Court raised rather than recruited already formed.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            // THE STORM ROADS, AND THE COURT HAD NONE. It held five lightning
            // arts to fight with and not one lightning book to climb on, so
            // the province's storm house raised its people on the same
            // elementless succession a ford town uses and its whole identity
            // lived in its weapons. These are the road: one at Foundation that
            // has to be worked standing in the weather, and one sixteen rungs
            // above it with nothing in between, which is what a starved
            // element looks like when it is written down honestly.
            'struck-ground-foundation-canon',
            'twice-struck-canon',
            'drumming-thunder-clap',
            'arcstep-thunder-lance',
            'lightning-gate-transposition',
            'nine-heaven-scourging-bolt',
            'thunder-scale-aegis'
        ],
        signatureTechniqueId: 'nine-heaven-scourging-bolt',
        specialities: ['attack', 'movement', 'defense'],
        rivals: ['sect-nine-peaks-ascetic-order', 'sect-frostmirror-court'],
        territory: 'A floating stone over a permanent storm, tethered to the peak it broke off, drawing on a vein it can no longer reach the bottom of.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 71,
            formationNodesLit: 23,
            remnant: 'The tether itself: a chain of unknown make holding a mountain fragment in the air, which the Court inspects annually and cannot repair.'
        },
        description:
            'A floating stone over a permanent storm, tethered to the peak it broke off, drawing on a vein it can no longer reach the bottom of, with twenty-three of seventy-one nodes lit and a tether that is inspected annually and cannot be repaired. It holds the world\'s only working lightning curriculum - the thunder clap, the arcstep lance, the gate transposition, the scourging bolt and the scale aegis - and most of it can only be worn by a mutated lightning root, which is why the Court does not recruit so much as collect and treats refusal as a scheduling matter. What the province holds about it is the collection and what is actually true is the instruction: it teaches the curriculum properly, which is why the ones it took mostly stay for a century. It has stopped opening its own storeroom at successions and now describes the contents from the record instead, and at least two Storm Elders privately doubt that everything on the list is still in the room.',
        ambition: {
            wants:
                'To find out whether the ancestor is still there. The Court was one of the three once and cannot reach the founder who made it one, because reaching upward takes materials and an object it no longer has - and the object it needs is the one that is not in the room. An apex could open that channel. Asking one means telling it what was lost, to a body that would then know.',
            blockedBy: ['apex-deep-survey', 'apex-azure-cloud'],
            wouldCost:
                'The admission. Nobody above has refused the Court and nobody below can ask, which is a silence it has been able to describe as anything it liked for a hundred and forty years; a request for help ends that permanently, and it ends it in front of a body that renews its grant. The cheaper alternative, which the Court keeps choosing, is a demonstration of the curriculum\'s depth - somebody produced above Nascent Soul - which it has not managed in a century.',
            contestedWith: ['sect-frostmirror-court', 'sect-nine-abyss-flame-sect', 'sect-crimson-abyss-hall'],
            movedOn:
                'It has raised the Crimson Abyss tithe schedule twice in ten years to fund a candidate, and has not named one.'
        }
    },

    {
        id: 'sect-standing-grove',
        // RENAMED OFF A WORD THE PARSER NEEDED, and off one this sheet uses
        // for something else entirely. `standing` is a bare alternative in two
        // parser alternations - what a house's standing is, and what a
        // cultivator's own standing is - and it is also `Parentage.standing`,
        // the condition of a grant, and the first word of the Standing
        // Register itself. One word doing four jobs, one of which was a name.
        //
        // The id still carries the old word; see the note on the Clear River
        // Fordhall above for why the id sweep is a follow-up rather than part
        // of this change.
        name: 'The Longbough Grove',
        alignment: 'righteous',
        powerOrdinal: 27,
        ranks: ['Guest of the Grove', 'Disciple', 'Elder Disciple', 'Keeper of the Grove'],
        admissionOrdinal: 13,
        stipend: [20, 90, 400, 1_600],
        teaches: [
            // The house's cultivation manual. NOT its ceiling - the Grove delivers short of what this book can carry, and the shortfall is the deliberate one: it teaches slowly, has taken nobody in forty-one years, and this is what it teaches from.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            'cross-meridian-strike',
            'iron-shirt-tempering',
            'green-mercy-mending-palm',
            'formless-severing-intent',
            'unyielding-mountain-body',
            'soul-anchoring-invocation'
        ],
        signatureTechniqueId: 'formless-severing-intent',
        specialities: ['defense', 'support', 'attack'],
        rivals: [],
        territory: 'A valley of old trees, the mountain above it and four settlements - all of it within a day and a half\'s walk.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 4,
            formationNodesLit: 4,
            remnant: 'Four nodes the Grove cut itself, holding a boundary wall that has never been tested, around a hermitage six people live in.'
        },
        description:
            'A valley of old trees, the mountain above it and four settlements, all of it within a day and a half\'s walk, and six disciples holding a zone eleven days across. It teaches a short elementless list - the cross-meridian strike, the iron shirt, the mending palm, the severing intent, the mountain body, the soul anchor - which is the curriculum of people who expect to end a thing rather than win it, and four nodes of four, all lit, all their own work, in the only institution in the province whose inheritance is nothing at all. It administers what it can comfortably walk and claims nothing beyond it; everyone much further out simply knows the ground is theirs and has never wanted to find out otherwise. It keeps no patrols, no register, no lease and no clients, settles disputes nobody asked it to settle, refuses payment, and has killed twice in two hundred years - both times within nine days of being tested, in front of witnesses who were not asked to be there, which is the entire basis of a claim it has not renewed in forty-one years.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // THE QUIET MARCHES
    // The adjacent region, and a different set of assumptions. Three
    // factions rather than nineteen, because the ground will not support
    // nineteen: there is one holding worth having, the Weir Office has it,
    // and the politics is therefore patronage rather than rivalry. See
    // `regions.ts` for what changes on crossing the border.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'sect-weir-office',
        name: 'The Weir Office',
        alignment: 'neutral',
        powerOrdinal: 21,
        ranks: ['Applicant', 'Ticketed', 'Standing Grant', 'Under-Warden of the Weir', 'Office Warden', 'Weir Master'],
        admissionOrdinal: 2,
        stipend: [2, 6, 20, 70, 240, 800],
        teaches: [
            'lesser-qi-gathering-manual',
            'iron-shirt-tempering',
            'five-breath-circulation-scripture',
            'shadow-splitting-gait',
            'foundation-tempering-scripture'
        ],
        signatureTechniqueId: 'foundation-tempering-scripture',
        specialities: ['cultivation', 'defense'],
        rivals: ['sect-gleaners-company', 'sect-sixmile-wardens'],
        territory: 'Both live pockets in the Marches, the weir works above Kettle, and the grant book.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 26,
            formationNodesLit: 7,
            remnant: 'A flood-control works built to manage water by people who plainly also used it to manage qi, running seven of its twenty-six nodes and holding both of the region\'s remaining pockets between them.'
        },
        description:
            'Both live pockets in the Quiet Marches, the weir works above Kettle, and the grant book, which is the actual holding. It teaches gathering, the iron shirt, circulation, the shadow gait and the tempering scripture, all of it Low Fall material and none of it carving, because Office members do not touch a chisel: the Office cultivates by holding faces rather than working them, which every carver in the queue outside can see and none of them can do anything about. It is not a sect so much as a bureau that acquired a monopoly and never gave it back, renting the only two sites in the region where a cultivator can advance at all, by the day, against a book that is public, itemised and completely discretionary. Everything it has is positional - three people at Standing Cut and a Weir Master who would be a mid-ranking elder nobody sends for in the Low Fall - and it prices grants on a rank table it has never dared submit to the Ninefold Ledger for certification.',
        ambition: {
            wants: 'A third workable face found and brought into the grant book before Gapwater runs out.',
            blockedBy: ['court-ninth-face', 'sect-sixmile-wardens'],
            wouldCost:
                'The only candidate ground is past the Dead Verge, and the Wardens will not stake a road to it. The Office has surveyed how much workable stone is left at Gapwater and has never published the figure, so it cannot argue the urgency without conceding the number.',
            contestedWith: ['sect-sixmile-wardens'],
            movedOn:
                'It has sent two survey parties past the Verge without stakes in four years and lost one of them, which is not in the grant book.'
        }
    },
    {
        id: 'sect-sixmile-wardens',
        name: 'The Sixmile Wardens',
        alignment: 'righteous',
        powerOrdinal: 14,
        ranks: ['Marker', 'Warden', 'Road Warden', 'Warden of the Six Mile'],
        admissionOrdinal: 0,
        stipend: [1, 3, 9, 30],
        teaches: [
            'cross-meridian-strike',
            'swallow-skimming-step',
            'iron-shirt-tempering',
            'lesser-qi-gathering-manual',
            'green-mercy-mending-palm'
        ],
        signatureTechniqueId: 'swallow-skimming-step',
        specialities: ['movement', 'defense', 'support'],
        rivals: ['sect-weir-office'],
        territory: 'The marked roads: every route through the Marches that does not cross dead ground.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 0,
            formationNodesLit: 0,
            remnant: 'Nine hundred painted stakes and a shed at Sixmile with the survey in it, which is the only complete map of where it is safe to walk.'
        },
        description:
            'The marked roads: every route through the Quiet Marches that does not cross dead ground, held by a shed, nine hundred painted stakes and a survey, all of it their own work. They teach the cheapest survivable list in the catalog - the cross-meridian strike, the skimming step, the iron shirt, the gathering manual, the mending palm - which is what a militia needs to walk somebody out of burn ground, and on unaided Marches air a Warden stops at Chipping and stays there. Its strongest member would be an outer disciple in the Low Fall, it takes anyone, pays almost nothing, and loses two or three people a year to ground that moved. The province finds them mildly comic and they own the only complete record of where it is safe to walk in a region full of ground that kills, kept current at that cost, and they believe the original survey is accurate because it has never been checked.',
        ambition: {
            wants:
                'The Weir Office to pay for paint, and the burn-edge figures in the survey shed recalculated by somebody who is not a Warden.',
            blockedBy: ['sect-weir-office'],
            wouldCost:
                'A toll, which is the only instrument they have and which the Warden of the Six Mile holds is a road people leave to avoid paying for. Three Wardens have said the burn edge is accelerating and the shed has the figures, and nobody has recalculated them because nobody wants the answer.',
            contestedWith: ['sect-weir-office'],
            movedOn:
                'They have refused to stake the ground past the Dead Verge twice, which is the first time in the Wardens\' history that the survey has been used as leverage rather than published.'
        }
    },
    {
        id: 'sect-gleaners-company',
        name: 'The Gleaners\' Company',
        alignment: 'neutral',
        powerOrdinal: 17,
        ranks: ['Barrow Hand', 'Gleaner', 'Deep Gleaner', 'Company Factor', 'Company Master'],
        admissionOrdinal: 0,
        stipend: [2, 7, 26, 90, 300],
        teaches: [
            'cross-meridian-strike',
            'shadow-splitting-gait',
            'stone-hide-mantle',
            'clear-spring-detoxification',
            'lesser-qi-gathering-manual'
        ],
        signatureTechniqueId: 'shadow-splitting-gait',
        specialities: ['movement', 'defense'],
        rivals: ['sect-weir-office'],
        territory: 'The burn zones, worked in rotation, and the barrow yard at Hollowmarket where the finds are sorted.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 14,
            formationNodesLit: 3,
            remnant: 'A sorting yard laid out inside a ruin the Company did not build and has never fully entered, working three nodes at the front of it and leaving the rest sealed on the reasonable grounds that they were sealed for a reason.'
        },
        description:
            'The burn zones, worked in rotation on a nine-year cycle, and the barrow yard at Hollowmarket where the finds are sorted before they go to Kettle. It teaches what keeps a digger alive - the cross-meridian strike, the shadow gait, the stone hide, detoxification, the gathering manual - and nothing at all that would help in a fight with a person, because the thing that kills gleaners is a door. The catastrophe that emptied the Marches also sealed a great deal of it and nobody strong enough to strip it properly has bothered to come, so the region\'s only real export is what the Company brings out; losses run about one in nine a season, and it is understood locally as a way of dying slightly later than the alternative. What it actually is, underneath the pay everybody talks about, is the only body in a region administered by an eleven-person bureau that has never once broken its word: a dead digger\'s share goes to their family, without exception, and the Company has never defaulted.',
        ambition: {
            wants:
                'Permission to work live burn edges, which pay triple, instead of holding to a nine-year rotation whose stated purpose the Company has misremembered.',
            blockedBy: ['sect-weir-office', 'sect-bone-lantern-cult'],
            wouldCost:
                'The Company Master holds the rotation and the argument reopens every time a face runs out. Working live edges would raise losses from one in nine to something nobody has costed, and the share promise is the only thing the Company has, so a season of unpaid families would end it.',
            contestedWith: ['sect-bone-lantern-cult'],
            movedOn:
                'The Factors have worked two live edges without an entry and paid the shares out of the general fund, which is the first time the fund has been used for anything.'
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // TWO BODIES WITH NO APEX OVER THEM
    //
    // Every other house in this catalog holds from somebody. A Low Fall sect
    // holds a twelve-year grant, a Wide Field body holds a lease with a
    // deposit on it, a Marches district holds a face the Long Cut scheduled,
    // a northern court holds an elevation and pays for the pass. The apexes
    // divide the land between them and nominate whoever holds the ground,
    // and the reason they prefer a bad holder to an empty seat is written out
    // at length in `APEX_INSTITUTIONS`: a seat with somebody in it is a
    // counterparty and an empty one is not.
    //
    // These two are outside that arrangement, and they are outside it for
    // OPPOSITE reasons, which is the whole reason both exist rather than one.
    //
    //   The Halfwater Rail  is unowned because owning it would destroy it.
    //                       Its entire value is that no party holds it, so
    //                       the moment one does, the other parties stop
    //                       coming and what was taken is forty acres of rock
    //                       with no fresh water on it. Its security is not
    //                       strength and not distance - it is that every
    //                       power in the world is worse off the day it falls,
    //                       including the power that would take it.
    //
    //   The Sink Carriers   are unowned because nothing on the Blown Ground
    //                       outlives the instrument that would hold it. A
    //                       grant runs twelve years and a surfacing is gone
    //                       inside nine, so there is nothing there that can
    //                       be the subject of a document. Nobody has declined
    //                       to take them. Nobody has had anything to take.
    //
    // The first is unheld because it is too useful to own. The second is
    // unheld because there is nothing there to own. Neither is a hero and
    // neither is a haven, and the difference between them should be legible
    // from the two descriptions without either of them saying so.
    //
    // NEITHER IS AN EXCEPTION TO A RULE. Every mechanic below is the ordinary
    // one: the Rail's watch is cultivators on a wage, its income is a margin,
    // its records are the same records anybody keeps. The Carriers' water is
    // the water already priced in `mortal-world.ts`. Take the arrangement away
    // and both price out as ordinary houses at their ordinals, which is the
    // test in AGENTS.md and the one worth re-running on anything added here.
    // ─────────────────────────────────────────────────────────────────────

    {
        id: 'sect-halfwater-rail',
        name: 'The Halfwater Rail',
        alignment: 'neutral',
        // One Nascent Soul, and the number is doing something specific. It is
        // NOT what defends the port - the port is defended by everybody
        // else's interest in it - and it is not what enforces order either,
        // because the watch tops out five rungs below her and she does not
        // work it. What it is, is the guarantee behind the institution's own
        // word: somebody who cannot be quietly made to disappear by a buyer
        // who did not like a price. See `seam` in the description.
        powerOrdinal: 21,
        ranks: ['Rail Hand', 'Watch', 'Weigher', 'Rail Factor', 'Rail Master'],
        admissionOrdinal: 0,
        stipend: [4, 14, 45, 150, 520],
        teaches: [
            'cross-meridian-strike',
            'iron-shirt-tempering',
            'reed-crossing-qinggong',
            'clear-spring-detoxification',
            'still-water-mirror-guard',
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture'
        ],
        // A guard art, and the whole doctrine of the watch is in the choice:
        // the port trains people to stop a thing without ending anybody,
        // because a death at Halfwater is a party ashore with a grievance and
        // that is the one commodity the port cannot afford to stock.
        signatureTechniqueId: 'still-water-mirror-guard',
        specialities: ['defense', 'movement', 'support'],
        // None, and the absence is the institution. A feud is a party you
        // will not trade with, and the Rail's entire business is being the
        // counter that both parties to any feud will still stand at.
        rivals: [],
        territory: 'Forty acres of island at the middle of the eastern passage, a deep anchorage, and no claim to one foot of water beyond the shoal line.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 0,
            formationNodesLit: 0,
            remnant: 'Nothing inherited and nothing lit. The port stands on ground with no vein under it, so there is no diagram to have lost: what it built, it built - a stone quay, a weigh house, a water cistern cut into the rock, and a bell that is rung for arrivals and for nothing else.'
        },
        description:
            'An island port at the middle of the eastern passage, holding forty acres and no water beyond the shoal line, where every party in the world buys and sells because none of them owns it. It is the only market of consequence with no apex seat at it: demonic houses, righteous houses, all three apexes\' factors and four courts\' buyers do business across the same rail within sight of each other, and the arrangement holds because taking the port destroys the port. Whoever held it would be holding forty acres of rock with a cistern on it, because the traffic is the asset and the traffic is there for the neutrality. Its income is the spread and not the tax: it buys from people who have no other buyer and sells on at what a thing is worth, and it taxes the traffic lightly on purpose, because the traffic is where the profit already is and squeezing it moves it. The service it actually sells is being a counterparty a weak seller can approach - a Qi Condensation cultivator holding something valuable cannot sell it to an individual, since the individual can simply take it and nobody is coming for them, and the Rail is an institution with a reputation and a funded watch, which is a different proposition. Discretion is priced into the margin rather than offered as a courtesy: a seller who wants no name attached takes less, knows they are taking less, and pays it gladly. Order is bought as far as money buys it and no further. The watch is thirty-odd cultivators on a wage, none above Foundation Establishment, and it handles theft, brawls, debt and the ordinary business of a crowded quay competently. Above that rung the port does not police anybody and says so at the gate: a high cultivator at Halfwater is protected by what they are and by who would come for them, and a theft at that level becomes a private war the Rail does not stop and is not party to. The seam between the two is the thing nobody at the port has solved - somebody at Core Formation, above what the watch can hold, with nobody in the world who would come for them, is exactly the person the Rail has no answer for, and the last three killings on the quay were all of that shape.',
        ambition: {
            wants:
                'A second anchorage on the northern crossing, so that a hull out of the capes has somewhere to make a market before it reaches anybody\'s coast.',
            blockedBy: ['sect-thousand-treasure-pavilion', 'house-measured-span'],
            wouldCost:
                'The thing it is. A second port is a network, a network is a body with reach, and a body with reach is a party rather than a counter - at which point the powers who currently protect the Rail by not touching it acquire a reason to. The Rail Master has put this to the Factors in exactly those words twice and been outvoted once.',
            contestedWith: ['sect-thousand-treasure-pavilion'],
            movedOn:
                'Two Factors have been buying salt flats at Salt Reach in their own names rather than the port\'s, which is either prudence or the first move of the thing the Rail Master warned about, and nobody has established which.'
        }
    },

    {
        id: 'sect-sink-carriers',
        name: 'The Sink Carriers',
        alignment: 'neutral',
        powerOrdinal: 19,
        ranks: ['Skin', 'Carrier', 'String Head', 'Route Elder', 'Waterman'],
        admissionOrdinal: 0,
        stipend: [2, 6, 22, 75, 260],
        teaches: [
            'cross-meridian-strike',
            'iron-shirt-tempering',
            'stone-hide-mantle',
            'clear-spring-detoxification',
            'warm-current-qi-transfer',
            'five-breath-circulation-scripture',
            'lesser-qi-gathering-manual'
        ],
        signatureTechniqueId: 'five-breath-circulation-scripture',
        specialities: ['defense', 'support', 'cultivation'],
        rivals: ['sect-bone-lantern-cult'],
        territory: 'A shed and a stockyard a day past the last painted stake in the Marches, and a route across the sand that has to be rewalked every season.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 0,
            formationNodesLit: 0,
            remnant: 'A tally board under the shed roof with every string that has gone out on it, and the ones that did not come back left up rather than wiped, which is the only record of the dead anywhere on this ground.'
        },
        description:
            'Water carried out onto the Blown Ground in strings of forty to sixty skins, from the Sink to whatever surfacings are open, by people who could not be taken anywhere else. It asks three things and no more: that you carry your own load, that you do not touch another string\'s water, and that you come back to the shed to be counted or be marked as not having. It does not ask where you came from, what you did, or whose art you are practising, and those three omissions are exactly the three questions a rogue cannot answer at any gate in the world, which is why the shed is full. What it lives on is the carry and a share of what comes off the ground it watered - never a price at the well, because the Sink is the one thing on that ground nobody has ever fought over and a body that started selling it would be the first party to try. So the entry is cheap and the staying is not: water on the sand is bought by the cup at four days\' distance from the only well, and a carrier who cannot make the return leg is not thrown out, they simply run out, and everybody standing there can do the arithmetic before it happens. Losses run about one in six a season and the Carriers publish the figure at the shed door, on the reasonable view that somebody who cannot face the number should not be told it later. It teaches nothing anybody would want except what keeps a body walking - the strike, the shirt, the stone hide, detoxification, the warm current, the five-breath circulation - and it has produced exactly two cultivators past Core Formation in ninety years, both of whom stayed, which the Route Elders regard as the only endorsement the shed has ever had.',
        ambition: {
            wants:
                'A second well. One dug, anywhere on the sand, of its own, so that the four-day figure stops being the thing that kills its people.',
            blockedBy: ['sect-thousand-treasure-pavilion', 'sect-bone-lantern-cult'],
            wouldCost:
                'Everything the shed has and probably the shed. A well is a fixed point and a fixed point on the Blown Ground is a thing the cover reaches in a decade, so the Carriers would be spending the whole of what they have on something with a shorter life than the debt - which is the province\'s own argument for why nobody holds anything here, made against the only body that has ever wanted to.',
            contestedWith: ['sect-bone-lantern-cult'],
            movedOn:
                'Two Route Elders have been paying a Marches carver out of their own shares to sound for water at a point nine days out, without telling the Waterman, and have four soundings and no water.'
        }
    }
] as const;

export const DAO_HOUSES: readonly DaoHouseEntry[] = [
    {
        id: 'house-ninefold-ledger',
        name: 'The Ninefold Ledger',
        alignment: 'neutral',
        powerOrdinal: 32,
        ranks: ['Tallyhand', 'Reader of Threads', 'Auditor', 'Circuit Arbiter', 'Ledger Elder', 'Keeper of the Ninefold Book'],
        admissionOrdinal: 4,
        stipend: [12, 36, 110, 340, 1_100, 3_400],
        teaches: [
            'thread-reading-stance',
            'five-breath-circulation-scripture',
            // The two plain editions between the primer and the Canon. Three
            // of the four houses that could not cross this gap are each
            // other's rivals and all four now hold the same two books, which
            // is not a shared method - it is four ledgers with the same line
            // item on them.
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'meridian-knitting-needle-art',
            'formless-severing-intent',
            'nascent-lotus-canon',
            'soul-anchoring-invocation'
        ],
        signatureTechniqueId: 'thread-reading-stance',
        specialities: ['support', 'cultivation'],
        rivals: ['house-quiet-cut', 'house-narrow-hour'],
        territory: 'A book hall at Low Fall, and a circuit of arbitration benches in forty-one towns.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 49,
            formationNodesLit: 31,
            remnant: 'A vault of tally volumes in a hand two ages old, still consulted, still binding, and still accurate about families that no longer know they are in it.'
        },
        description:
            'A book hall at Low Fall and a circuit of arbitration benches in forty-one towns, all of it held in the house\'s own name on nobody\'s grant, which is why a house at this height is a different sort of problem from a sect at the same figure: a sect can be leaned on through whoever renews it, and the Ninefold can only be dealt with. Its dao is karma read as a graph rather than a score - favour, debt, betrayal, oath, inheritance, a killing, a rescue - and four thousand one hundred years of writing those connections down means it is the only institution alive that can see a whole thread at once, across generations, when every person standing on the thread has forgotten it exists. That is not a combat art and it is not sold as one: nobody in the region can settle an inheritance, prove a debt, open a succession or establish whether a sect really has an ancestor above the Lid without a Ledger auditor present, which is how a house with no field doctrine at all has never been attacked twice by the same sect. What it costs is the pace - an audit takes seasons, and the Ledger is habitually too late to prevent anything - and what it cannot do is see somebody with no relationships, who is close to invisible to it, or read a thread through a grave, which has never once worked and is filed under research rather than failure. The Yan have held it since Yan Duo, which makes it a family before it is an institution, and the current Keeper of the Ninefold Book is a Cao who married in and did not change her name: the head of an adoption-only house is the one person in it who was never adopted, and the house has never once written down what it thinks about that.',
        ambition: {
            wants:
                'The nine sealed volumes opened and entered, ending twenty-three centuries of the house not knowing what it is standing on.',
            blockedBy: ['house-quiet-cut'],
            wouldCost:
                'The Keeper has refused without giving a reason and three internal factions have asked. Opening them establishes what the founders did to the Tally Court, which every branded descendant the house quietly pays the upkeep of would then be able to read.',
            contestedWith: ['house-quiet-cut'],
            movedOn:
                'The Circuit has had the vault index copied out, which is not the same as opening anything and is the furthest anybody has got in two hundred years.'
        },
        principle: 'karma',
        principleDescription:
            'Karma is a persistent relationship graph - favour, debt, betrayal, blood feud, oath, inheritance, gratitude, revenge, teacher and disciple, a killing, a rescue. The Ledger does not own it. It is simply the only institution that can see a whole thread at once, across generations, when everyone standing on the thread has forgotten it exists.',
        foundedYearsAgo: 4_100,
        civilReach: [
            'debts, and which of them survived the death of the borrower',
            'inheritance: who is actually owed a legacy when three parties claim it',
            'blood feuds, and which killing started one',
            'family lines, including the ones a family has paid to have forgotten',
            'causal tracking: who benefited from an event nobody witnessed',
            'concealment, and the detection of it',
            'certification of an ancestral claim, which is the only way in the world to establish whether a sect actually has an ancestor above the Lid'
        ],
        services: [
            'circuit arbitration of debts and inheritance, for a fee scaled to the sum in dispute',
            'audits of a claimed lineage, accepted as proof by every righteous sect in the region',
            'certification of a claimed living ancestor, sold to the claimant or to a rival, published either way',
            'placement of a foreign cultivator inside a realm, which no table can do and which the house sells at a published error rate of one in six',
            'investigators hired to establish who benefited from a death',
            'sealed escrow of obligations that outlive their parties'
        ],
        dependents: [
            'sects settling succession after an elder dies without naming a heir',
            'the Stonewright Consortium, whose entire lending business rests on Ledger enforcement',
            'ordinary families, who use a Ledger seal the way a mortal uses a deed'
        ],
        counter: {
            name: 'karmic severance',
            heldBy: 'house-quiet-cut',
            description:
                'A cut connection cannot be read as a connection. The Ledger can usually tell that something was removed and roughly when, but naming what it was requires a fragment recovered from the Tally Court, and the Ledger will not admit publicly that it uses one.'
        },
        blindSpots: [
            'open warfare: it has no field doctrine and hires the Azure Cloud Pavilion when it needs one',
            'alchemy: it does not refine, and buys medicine at retail like anyone else',
            'formations: it has never produced a formation master and lights barely two thirds of its own nodes',
            'anyone with no relationships at all, who is close to invisible to it',
            'speed: an audit takes seasons, and the Ledger is habitually too late to prevent anything'
        ],
        internalFactions: [
            'the Circuit, who want arbitration expanded into criminal judgement',
            'the Book, who want the Ledger to record and never rule',
            'a quiet third group who believe the Tally Court was right'
        ],
        weaknesses: [
            'three of its forty-one benches have gone unstaffed for a century for want of auditors',
            'the founding volumes for years 400 to 900 are missing and were probably destroyed internally',
            'its method for reading a thread through a grave deposit has never once worked'
        ],
        houseSurname: 'Yan',
        admission: {
            route: 'adoption',
            prodigyIn:
                'Reading a thread. Somebody who can look at two strangers and name what is owed between them, without the register in front of them, which the house tests by putting them in a room with a case it has already solved and saying nothing.',
            marriage:
                'Almost always, and usually to a Reader of Threads of about the same age, because the point is the generation after: an adopted auditor holds the method for one lifetime and their children hold it for the house.',
            surrendered:
                'Your own line, and every prior obligation you were standing on - the house enters them, settles them, and enters you afterwards with a clean thread, which is the single most expensive thing it does for anybody.',
            naming:
                'The family is Yan and the house is what the Yan do: the First Keeper was Yan Duo, and every auditor on the forty-one benches today is a Yan. A man adopted in takes the name, which is what the adoption is. The current Keeper of the Ninefold Book does not carry it - she married in from the Narrow Hour and kept Cao - so the head of an adoption-only house is the one person in it who was never adopted, which the Circuit raises about once a decade and the Book has never answered.',
            lastTaken:
                'Eighty years ago: a tax clerk from a town two provinces east who had reconstructed nine inheritances off the back of the collection rolls for no reason and no fee.',
            costOfTheForm:
                'Three of its forty-one circuit benches have gone unstaffed for a century for want of auditors, and the house cannot hire one. Four thousand years of method sits on whoever was born into it, and a thin generation is a thin century.'
        },
        succession: {
            predecessorId: 'house-tally-court',
            yearsAgo: 2_300,
            officialVersion:
                'The Tally Court sold its judgements, branded debts that could not be settled, and was dissolved by a coalition of righteous sects. The Ledger was founded to do the work honestly.',
            trueVersion:
                'The Tally Court had begun keeping an account of what the crossings take - every cut made at every boundary, entered as a taking, with the Lid itself named as the party in arrears - and had got far enough to name what was owed. The Ledger\'s founders were Tally Court auditors. They ended the Court, burned the seat, kept the volumes, and have not opened them since.',
            discoverableTraces: [
                'the coalition named in the official account never existed as a coalition; the four sects listed were not at peace with each other that century',
                'the Ledger\'s own vault index lists nine sealed volumes with no subject line',
                'branded descendants still exist and the Ledger quietly pays their upkeep'
            ]
        },
        afterwardsClause:
            'Killing an auditor is entered as an unsettled account against the killer and their line. The Ledger does not retaliate. It records, publishes the entry, and lets every party who ever needed a Ledger seal decide what to do about a person who is in arrears to it.'
    },
    {
        id: 'house-narrow-hour',
        name: 'The House of the Narrow Hour',
        alignment: 'neutral',
        powerOrdinal: 30,
        ranks: ['Watcher', 'Sighting Disciple', 'Reader of Hours', 'Convergence Master', 'Elder of the Narrow Hour', 'First Sighting'],
        admissionOrdinal: 6,
        stipend: [14, 42, 130, 400, 1_300, 3_800],
        teaches: [
            'convergence-sighting',
            'five-breath-circulation-scripture',
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'formless-severing-intent',
            'nascent-lotus-canon'
        ],
        signatureTechniqueId: 'convergence-sighting',
        specialities: ['support', 'cultivation'],
        rivals: ['house-ninefold-ledger', 'house-quiet-cut', 'house-held-names'],
        territory: 'A sighting hall on a bare hill with no walls, and standing chairs beside four thrones.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 12,
            formationNodesLit: 12,
            remnant: 'Twelve nodes, all lit, arranged to observe rather than defend, which means the hall itself cannot be held against anyone who decides to walk in.'
        },
        description:
            'A sighting hall on a bare hill with no walls, held outright and defended by nothing - twelve nodes, all lit, all observational, so the hall cannot be held against anybody who decides to walk in and the house has never fixed this. Its dao is fate read as pruning rather than prophecy: three thousand two hundred years of case records support the claim that a thousand possibilities are real on the first day and four are real on the ninth, and everything that matters happens on the ninth, so the whole art is arriving at the ninth day early. It does not know what will happen and has never said it did; what it can do is tell a ruler which two of this month\'s decisions are load-bearing, which is a smaller and far more useful thing, and four thrones have not made a succession decision unadvised in two centuries. Clients want prophecy, pay for pruning and go away satisfied, and the house has taken three millennia of retainers without correcting the misunderstanding once - while its own advisers have fallen from nineteen to eleven, because it cannot replace one faster than it loses one and has never formally decided anything about that.',
        ambition: {
            wants: 'The two disputed thrones settled, either way, so that its retainer count stops falling.',
            blockedBy: ['house-held-names', 'house-ninefold-ledger'],
            wouldCost:
                'It has advised both claimants in both disputes, which is a fact its own records establish and it cannot now un-advise. Held Names holds a withholding retainer over at least one claimant, so the house cannot sight the succession it is being paid to advise, and admitting that would end the retainer.',
            contestedWith: ['house-held-names'],
            movedOn:
                'It has offered a free public convergence warning on one of the two successions and the throne in question has declined to receive it.'
        },
        principle: 'fate',
        principleDescription:
            'Probability, divination, and the recognition of convergence. The House holds that events narrow: a thousand possibilities are real on the first day and four are real on the ninth, and everything that matters happens in the ninth day. Its whole art is arriving at the ninth day early.',
        foundedYearsAgo: 3_200,
        civilReach: [
            'advice to rulers and sect heads on which decision this season is load-bearing',
            'divination of convergence around a person, a place or a bloodline',
            'insurance-like pricing: the House sells odds and honours them',
            'site selection for breakthroughs, weddings, sieges and burials',
            'identification of which of a hundred rumours is about to become an event'
        ],
        services: [
            'a resident adviser placed with a ruler or sect head, at an annual retainer',
            'single sightings sold to walk-in clients at a fixed and famously large price',
            'convergence warnings issued publicly and without charge when a region is about to be involved'
        ],
        dependents: [
            'four regional rulers who have not made a succession decision unadvised in two centuries',
            'the Thousand Treasure Pavilion, which prices its auctions off House sightings',
            'sects choosing when to attempt a disciple\'s realm boundary'
        ],
        counter: {
            name: 'a name withheld from the register',
            heldBy: 'house-held-names',
            description:
                'A sighting is cast at a party, and a party is identified by name. The House of Held Names can hold a name out of every register, and a client of theirs cannot be sighted at all - which is the single most expensive service either house sells, and the reason they loathe each other.'
        },
        blindSpots: [
            'genuine chaos: at a catastrophe site or a fresh tribulation scar it reads nothing at all',
            'deliberate disruption - an opponent making arbitrary choices is opaque to it',
            'speed and force: it has no combat doctrine worth the name and knows it',
            'the very near term, where too many possibilities are still live to prune',
            'anything about itself; sightings cast on the House by its own members are worthless'
        ],
        internalFactions: [
            'the Standing Chairs, who believe advising rulers has made the House a servant',
            'the Open Hall, who want warnings published freely and the retainers ended',
            'a small group who have stopped sighting entirely after what they saw in the year of the scar'
        ],
        weaknesses: [
            'the Narrow Hour cannot replace an adviser faster than its advisers die, and it is down to eleven',
            'two of the four thrones it advises are in dispute, and it has advised both claimants',
            'its records for the last confirmed ascension are internally contradictory and it has never resolved why'
        ],
        houseSurname: 'Cao',
        admission: {
            route: 'adoption',
            prodigyIn:
                'Sighting a convergence cold. Somebody who can walk into a situation with no records and say which two of the live possibilities are carrying the weight, and be right often enough that the house stops calling it luck.',
            marriage:
                'Usually, and the house is candid that the marriage is the more important half: a reader\'s talent is thought to run in blood and the whole purpose of the adoption is to get that blood onto the roll before it goes somewhere else.',
            surrendered:
                'Your line and your own future as a subject: an adopted reader is entered into the house\'s own records, and the house does not permit sightings cast on itself, so the day you join is the last day anybody will look at your future.',
            naming:
                'The family is Cao - Cao Xun, who sighted the first convergence, and Cao Yin, whose sealed account of the scar year does not match what happened - and the Narrow Hour is the trade rather than the line. Every reader on the hill is a Cao and a man adopted in takes it; nobody currently on the roll married in and kept anything else, though the house has sent one of its own daughters out to the Ledger and did not stop her keeping the name.',
            lastTaken:
                'A hundred and sixty years ago, and the house has looked twice since and both times decided the talent was pattern memory rather than sighting.',
            costOfTheForm:
                'Eleven advisers where there were nineteen, and no mechanism to reverse it. The house could fill four benches tomorrow from paying applicants and cannot, because a reader who is not family is not a reader the house will put beside a throne.'
        },
        succession: null,
        afterwardsClause:
            'The House does not avenge. It publishes the sighting it had already cast on the killer, in full, including the parts the killer had paid other people to keep quiet.'
    },
    {
        id: 'house-bound-word',
        name: 'The House of the Bound Word',
        alignment: 'righteous',
        powerOrdinal: 31,
        ranks: ['Witness', 'Sworn Clerk', 'Oathwright', 'Warden of Terms', 'Elder Oathwright', 'Keeper of the Standing Word'],
        admissionOrdinal: 5,
        stipend: [11, 34, 105, 330, 1_050, 3_200],
        teaches: [
            'binding-word-seal',
            'iron-shirt-tempering',
            'warm-current-qi-transfer',
            'five-breath-circulation-scripture',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'soul-anchoring-invocation',
            'nascent-lotus-canon'
        ],
        signatureTechniqueId: 'binding-word-seal',
        specialities: ['support', 'defense', 'cultivation'],
        rivals: ['house-anchorhold', 'house-quiet-cut'],
        territory: 'Oath halls at every border crossing of consequence, and the treaty vault at Sweptground.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 36,
            formationNodesLit: 25,
            remnant: 'A treaty vault holding agreements between parties who are all dead, several of which are still binding on people who have never read them.'
        },
        description:
            'Oath halls at every border crossing of consequence and a treaty vault at Sweptground, all of it the house\'s own and none of it on anybody\'s grant, which is what lets it witness between parties who are at war. Its dao is oaths made structural: three thousand eight hundred years of the discipline means a Bound Word witness does not threaten anybody who breaks a promise, the promise is simply built into them afterwards, and removing it removes some of them with it. Every treaty in the region is in that vault, every sect succession is sworn in front of them, no ruler has yet found a way to hold a border without them, and the reason they look like a formality is that the enforcement has never had to be demonstrated in public - which is exactly what a working deterrent looks like. The house pays for the discipline in speed and in rigidity: a contested reading takes a year, its members are individually unimpressive fighters, and it cannot revise its own oaths even when the terms have become absurd, which is why a founding clause forbidding it to witness for the Severed is costing it a fortune it can see and cannot touch.',
        ambition: {
            wants:
                'Its own founding oath against witnessing for the Severed dissolved, which it has wanted for two centuries and cannot do.',
            blockedBy: ['house-anchorhold', 'house-ninefold-ledger'],
            wouldCost:
                'The Anchorhold holds that the oath was sworn on fixed ground and therefore stands, which is the same argument the house uses to make everybody else\'s oaths bind. Its own dissolution method for an oath whose parties are all dead has never worked, and it is still taught, so admitting the method is empty costs it the doctrine as well as the fee.',
            contestedWith: ['sect-the-severed'],
            movedOn:
                'The vault clerks have prepared a reading arguing the clause names a house that no longer exists under that description, and the Strict Hall has refused to hear it three times.'
        },
        principle: 'oaths',
        principleDescription:
            'Contracts, promises, restrictions, sworn agreement, and the penalty for breaking one. The House does not enforce - enforcement is somebody else\'s trade. It witnesses, and the witnessing is what makes the breach cost something that cannot be paid in stones.',
        foundedYearsAgo: 3_800,
        civilReach: [
            'treaties between sects, and the terms nobody else can adjudicate',
            'succession: a sworn heir is a settled heir, and an unsworn one is a war',
            'commercial contracts above a value the Consortium will not carry uninsured',
            'marriage, adoption, apprenticeship and the transfer of a technique under terms',
            'surrender terms, hostage terms, and truces that have to survive a grudge'
        ],
        services: [
            'oath witnessing, at a fee proportional to the penalty clause rather than the sum',
            'custody of the treaty vault, with certified copies issued to any party to a treaty',
            'reading of an existing oath to establish what it actually binds, which is rarely what the parties assumed'
        ],
        dependents: [
            'every sect that has ever ended a war without being destroyed',
            'the Stonewright Consortium, for contracts it cannot underwrite on trust',
            'rulers whose borders are held by treaty rather than by garrison'
        ],
        counter: {
            name: 'nullification by unfixed ground',
            heldBy: 'house-anchorhold',
            description:
                'An oath binds to a place as well as to a person. Sworn on ground the Anchorhold has not surveyed and fixed, there is nothing for the seal to hold to, and the oath is words. The Anchorhold sells this knowledge to nobody and uses it constantly.'
        },
        blindSpots: [
            'anyone who has sworn nothing, against whom the House has no purchase at all',
            'offence: it has no attack doctrine and its members are, individually, unimpressive fighters',
            'demonic parties who accept the structural penalty and break the oath anyway',
            'speed of adjudication - a contested reading takes a year and both parties know it',
            'its own oaths, which it cannot revise even when the terms have become absurd'
        ],
        internalFactions: [
            'the Strict Hall, who read terms exactly as written whatever the outcome',
            'the Warden faction, who want the House to enforce as well as witness',
            'the vault clerks, who quietly think a third of the standing treaties should be allowed to lapse'
        ],
        weaknesses: [
            'the House is bound by an ancient oath of its own not to witness for the Severed, and this is costing it a fortune',
            'oathwright training takes forty years and the intake has been falling for three generations',
            'its method for dissolving an oath whose parties are all dead has never worked and is still taught'
        ],
        houseSurname: 'Lin',
        admission: {
            route: 'adoption',
            prodigyIn:
                'Reading terms. Somebody who can hear an oath spoken once and say what it actually binds, which is almost never what the parties assumed, and who does it faster than an Oathwright of forty years\' training.',
            marriage:
                'Yes, and it is sworn rather than arranged: the adoption and the marriage are witnessed in the same sitting, by the house, in the vault, and the two documents are filed as one instrument.',
            surrendered:
                'Every oath you were carrying, which is dissolved or assumed by the house, and your line - your children are Bound, sworn at naming, and cannot leave without the house witnessing that too.',
            naming:
                'The family is Lin, from Lin Zhao onward, and the Bound Word is what the Lin do rather than who they are: a treaty is witnessed by a Lin and filed under the house, and the two are not the same signature. A man adopted in takes the name in the same sitting his oath is sworn, and the house holds the name change to be the more binding of the two instruments.',
            lastTaken:
                'Two hundred and ten years ago, and he is the current Keeper of the Standing Word, which the Strict Hall mentions rather often.',
            costOfTheForm:
                'Oathwright training takes forty years, intake has fallen for three generations, and the house will not shorten the training. It cannot buy a generation and will not compress one, so its floor is whoever was born forty years ago.'
        },
        succession: null,
        afterwardsClause:
            'Killing a witness voids nothing. The oaths they witnessed stand, the House sends a replacement, and the killer is entered as a party who has interfered with a sworn agreement - which every treaty in the vault has a clause about.'
    },
    {
        id: 'house-quiet-cut',
        name: 'The House of the Quiet Cut',
        alignment: 'demonic',
        powerOrdinal: 33,
        ranks: ['Holder of the Blade', 'Cutter', 'Quiet Hand', 'Master of Removal', 'Elder of the Cut', 'The Last Cut'],
        admissionOrdinal: 7,
        stipend: [20, 60, 190, 620, 2_000, 6_500],
        teaches: [
            // The house's cultivation manual. NOT its ceiling - the house delivers short of what this book can carry, which on a body that cuts its own records is a figure it cannot audit either. A house of removal still has to raise the people doing the removing.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            'quiet-cut-severing-stroke',
            'shadow-splitting-gait',
            'formless-severing-intent',
            'severed-name-finger',
            'void-hollow-body'
        ],
        signatureTechniqueId: 'quiet-cut-severing-stroke',
        specialities: ['forbidden', 'movement', 'attack'],
        rivals: ['house-ninefold-ledger', 'house-held-names', 'house-narrow-hour', 'house-bound-word', 'sect-the-severed'],
        territory: 'No seat that anyone has proved. Work is taken and delivered through third parties.',
        recruits: true,
        compound: {
            inherited: false,
            formationNodesTotal: 4,
            formationNodesLit: 4,
            remnant: 'Four nodes, portable, of the House\'s own making, and a standing policy of leaving nothing that could be surveyed.'
        },
        description:
            'No seat anybody has proved, four portable formation nodes of its own making, and a standing policy of leaving nothing that could be surveyed - a house that holds everything in its own name by holding almost nothing at all. Its dao is severance: concealing a connection, cutting one, redirecting consequence, breaking an inheritance structurally rather than defying it, and nineteen centuries of it have made the house the only body that can remove a thing rather than merely argue about it. What is cut does not grow back, which is why the work is expensive, permanent and impossible to appeal, and it is also why the counter exists - every cut leaves an edge, the Ninefold Ledger has been reading edges for two hundred years, and the house still prices its work as though that were a secret. Every institution that has publicly called for its destruction has privately commissioned it, so the denunciation and the fee are performed by the same people, and the Quiet Cut has built its whole pricing around neither side ever mentioning the other.',
        ambition: {
            wants:
                'A replacement for the Tally Court fragments its whole method depends on, which are visibly wearing out and cannot be reproduced.',
            blockedBy: ['house-ninefold-ledger'],
            wouldCost:
                'The only surviving Tally Court material of that grade is in the Ledger\'s nine sealed volumes, which the Ledger will not open and would not hand over. Taking them means cutting a four-thousand-year-old house\'s own thread, which is the largest commission the Quiet Cut has ever considered and the one nobody would pay for.',
            contestedWith: ['house-ninefold-ledger'],
            movedOn:
                'It has priced the job internally, three times in a century, and the figure has come down each time.'
        },
        principle: 'severance',
        principleDescription:
            'Concealing a connection, cutting one, transferring or redirecting consequence, erasing traces, breaking an inheritance. Severance is rare, dangerous and never free - what is cut does not grow back, and the cut itself leaves an edge that a good enough auditor can find.',
        foundedYearsAgo: 1_900,
        civilReach: [
            'removal of a debt, including debts that are being inherited',
            'concealment of a bloodline from an inheritance audit',
            'redirection of consequence onto a party who agreed to take it, or did not',
            'erasure of a person from an event they were present at',
            'breaking an oath structurally rather than defying it'
        ],
        services: [
            'severance, priced by how old and how load-bearing the connection is',
            'concealment retainers, renewed annually, because concealment decays',
            'quiet certification that a cut was clean, sold to the client who paid for it'
        ],
        dependents: [
            'sects with a succession they cannot afford to have audited',
            'families ending a blood feud they cannot win',
            'more than one righteous institution that has never admitted to using them'
        ],
        counter: {
            name: 'the register of absences',
            heldBy: 'house-held-names',
            description:
                'A cut leaves a hole, and the House of Held Names keeps a register precise enough that the hole is visible as a hole. They cannot say what was removed. They can say, with dates, that something was, which is often enough to ruin the client who paid for it.'
        },
        blindSpots: [
            'it cuts and cannot build: no healing doctrine, no alchemy, no cultivation-rate canon of its own',
            'no civil office anywhere, because no institution will seat it publicly',
            'it cannot restore anything it has removed, including its own mistakes',
            'a client base that cannot testify for it, leaving it with no allies in any dispute',
            'against a party with no connections worth cutting it is simply an ordinary assassin'
        ],
        internalFactions: [
            'the Trade, who take any commission that pays',
            'the Doctrine, who hold that severance is mercy and should be given away',
            'a faction that has begun cutting connections without a client, for reasons the others find alarming'
        ],
        weaknesses: [
            'its own records are deliberately incomplete, so it repeatedly recuts work it has already done',
            'the Tally Court fragments it depends on are wearing out, and it cannot reproduce them',
            'severance performed on a party at Nascent Soul or above fails about a third of the time, and failure is loud'
        ],
        houseSurname: 'Chu',
        admission: {
            route: 'adoption',
            prodigyIn:
                'Cutting cleanly the first time, without training and without a client, which is a talent that announces itself by accident - somebody who severed something that was theirs to lose and left an edge nobody could read.',
            marriage:
                'Yes, and it is the only part of the arrangement the house performs openly, because a marriage is a connection the Quiet Cut deliberately does not sever and is therefore the strongest thing anybody in it has.',
            surrendered:
                'Everything that could identify you, which the house removes as a condition rather than a courtesy, and your line, which is entered nowhere at all. An adopted cutter has no prior life that can be established by any means the Ledger holds.',
            naming:
                'The family is Chu, and the house cuts its own records, so it can no longer establish who the first Chu was - the only one of the seven whose founder is unrecoverable, by its own hand. Since no member gives a name to a client and no face is seen twice on a commission, Chu is the only name most of them ever use aloud; a man adopted in takes it and loses the other permanently, and a woman who married in and kept hers is recorded in a column with no heading.',
            lastTaken:
                'Forty years ago, a girl who had cut her own family debt at eleven and could not explain how, and the house had three cutters looking for her within a season.',
            costOfTheForm:
                'It cuts its own records as doctrine, so it cannot audit its own lineage either, and has twice adopted somebody it had already removed. A house that cannot recruit and cannot remember is running on about five people, which is the real reason severance above Nascent Soul fails a third of the time.'
        },
        succession: null,
        afterwardsClause:
            'Killing a cutter is unusually safe. The House does not avenge its people; it prices the work higher next time. The danger is entirely that the cutter\'s client list dies with them, and that several parties want to know what was on it.'
    },
    {
        id: 'house-held-names',
        name: 'The House of Held Names',
        alignment: 'neutral',
        powerOrdinal: 29,
        ranks: ['Register Hand', 'Namekeeper', 'Holder', 'Warden of the Register', 'Elder Holder', 'First Register'],
        admissionOrdinal: 3,
        stipend: [9, 28, 88, 280, 900, 2_800],
        teaches: [
            'name-holding-recitation',
            'five-breath-circulation-scripture',
            'warm-current-qi-transfer',
            'meridian-knitting-needle-art',
            'soul-anchoring-invocation'
        ],
        signatureTechniqueId: 'name-holding-recitation',
        specialities: ['support', 'cultivation'],
        rivals: ['house-quiet-cut', 'house-narrow-hour', 'sect-lantern-hall'],
        territory: 'Register houses at nine city gates, and a stack room none of the nine can access.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 33,
            formationNodesLit: 20,
            remnant: 'A register wall of names in nine hands, twenty thousand of them belonging to people who no longer answer to them.'
        },
        description:
            'Register houses at nine city gates, held outright, and a stack room none of the nine can reach - and everything in it is the house\'s own, which is why nobody can lean on it and everybody has to deal with it. Its dao is names held as objects rather than as possessions: twenty-seven centuries of the discipline mean a name entered in the register is a fact about the world independent of the person carrying it, which is why it can be held through a boundary, withheld from a divination, or shown to be missing after a severance. When a crossing takes a name at a realm boundary the person is left having to be told it every time, and the House still has it, written down, in a register the taking did not reach; it will give it back, slowly, incompletely, and at a price set by what the client can be made to pay. Nobody separates the price from the service and the House has never given anybody a reason to - which obscures the fact that twenty thousand names exist in the world only because somebody recites them aloud every morning, and a holder who stumbles is relieved of one the same day and never told which.',
        ambition: {
            wants:
                'Gate registration made compulsory beyond the nine cities, out into the market towns and the sect towns.',
            blockedBy: ['house-narrow-hour', 'sect-lantern-hall'],
            wouldCost:
                'It cannot enforce anything itself and would be asking nine city administrations to argue for it in forty more places. The Narrow Hour will oppose it, because a register that reaches everybody makes withholding worth more and sighting worth less, and Lantern Hall will publish the fee schedule beside it and let people draw the conclusion.',
            contestedWith: ['sect-lantern-hall', 'house-narrow-hour'],
            movedOn:
                'The Gate faction has had two market towns registering voluntarily for nine years at no charge, which is a demonstration and is costing the House money it has not accounted for.'
        },
        principle: 'names',
        principleDescription:
            'Identity as a held object rather than a personal possession. A name entered in the register is a fact about the world independent of the person carrying it, which is why a name can be held through a toll, withheld from a divination, or shown to be missing after a severance.',
        foundedYearsAgo: 2_700,
        civilReach: [
            'restoration of a name taken at a realm boundary, partially and over years',
            'gate registration, without which most cities will not admit a cultivator',
            'proof of identity in inheritance and succession disputes',
            'withholding a client\'s name from every register, which blinds divination cast at them',
            'detection of erasure: what the register says should be present and is not'
        ],
        services: [
            'name custody, an annual fee, payable in advance and famously never refunded',
            'gate registration, cheap, compulsory in nine cities, and the House\'s real income',
            'a withholding retainer, ruinously expensive, sold to perhaps thirty clients at a time'
        ],
        dependents: [
            'nine city administrations, which cannot control entry without the registers',
            'the Ninefold Ledger, which cannot prove a lineage without registered names',
            'any cultivator past a realm boundary who wants to be called something again'
        ],
        counter: {
            name: 'erasure at the source',
            heldBy: 'house-quiet-cut',
            description:
                'A register entry can be cut like anything else. The Quiet Cut can remove a name from the register and from the people who used it, and the House of Held Names is then holding an entry for somebody nobody remembers - which has happened at least four times and is why the two houses cannot be in a room together.'
        },
        blindSpots: [
            'physically weak: the House has produced two combat cultivators in seven hundred years',
            'its authority stops at the gate of a jurisdiction that does not use its registers',
            'it cannot hold a name that was never entered, which makes rural-born cultivators invisible to it',
            'restoration is partial and it has never explained why, because it does not know',
            'it is entirely dependent on other people enforcing registration for it'
        ],
        internalFactions: [
            'the Gate, who want registration extended to every settlement',
            'the Stack, who want the House to hold names and sell nothing at all',
            'holders who have begun quietly using held names themselves, which is theft of a kind nobody has a word for'
        ],
        weaknesses: [
            'the stack room floods, and roughly one register in forty from the third age is illegible',
            'withholding decays and must be renewed, so a lapsed client is exposed without warning',
            'the House has never recovered a name taken at a realm boundary above Deity Transformation, and no longer advertises that it tries'
        ],
        houseSurname: 'Gu',
        admission: {
            route: 'adoption',
            prodigyIn:
                'Holding. Somebody who can carry a name that is not theirs without it slipping - the house tests it with eleven names and a year, and almost everybody drops one in the first month.',
            marriage:
                'Yes, and quickly, because the house holds that the capacity runs in a line and a holder without children is a set of names with nowhere to go.',
            surrendered:
                'Your own name, entered and held by somebody else for the rest of your life, which is the one thing the house asks of nobody outside and requires of everybody inside.',
            naming:
                'The family is Gu, from the First Register Gu Yao, and Held Names is the trade. Every holder on the register wall is a Gu except the Warden of the Register, who is an Anchorhold Xu, married in and unchanged - which in a house whose entire business is holding somebody else\'s name is either a joke or a position, and the House has never said which.',
            lastTaken:
                'A hundred and ten years ago: a gate clerk from a town with no register at all who had been holding eleven names in her head as a favour, for nothing, for six years. She took Gu the same season, married a Namekeeper the next, and the Stack still argues about whether the House found her or she found it.',
            costOfTheForm:
                'Two combat cultivators in seven hundred years, and no way to acquire one. The House is entirely dependent on other people enforcing registration for it and has never been able to grow anybody who could do anything about that.'
        },
        succession: null,
        afterwardsClause:
            'Killing a namekeeper ends the House\'s custody of every name that keeper personally held, which typically includes several hundred clients who now cannot prove who they are. Those clients, not the House, are what arrives afterwards.'
    },
    {
        id: 'house-measured-span',
        name: 'The House of the Measured Span',
        alignment: 'neutral',
        powerOrdinal: 34,
        ranks: ['Chain Bearer', 'Surveyor', 'Span Master', 'Gate Warden', 'Elder Surveyor', 'Keeper of the Long Measure'],
        admissionOrdinal: 8,
        stipend: [16, 48, 150, 470, 1_500, 4_600],
        teaches: [
            // The house's cultivation manual. NOT its ceiling - the Anchorhold delivers short of what this book can carry, which is unusual on a house whose method and whose duty are the same activity. Surveyors walk the veins they draw on, which is what this canon is for.
            // Four ordinary books beneath it, none of them the Anchorhold's.
            // The two houses stand at opposite ends of the same feud and both
            // finish on the vein canon, but the Span raises its surveyors on
            // the elementless editions anybody can buy rather than on the
            // earth road its rival teaches - which is why a Span chain bearer
            // and an Anchorhold peg do not look alike until Deity
            // Transformation, and then suddenly do.
            'lesser-qi-gathering-manual',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            'mountain-vein-devouring-canon',
            'span-folding-survey',
            'swallow-skimming-step',
            'shadow-splitting-gait',
            'thousand-li-cloud-tread',
            'void-hollow-body'
        ],
        signatureTechniqueId: 'span-folding-survey',
        specialities: ['movement', 'defense'],
        rivals: ['house-anchorhold'],
        territory: 'Nine gate stations, no two of which are within a month\'s walk, and all of which are an hour apart.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 58,
            formationNodesLit: 29,
            remnant: 'A gate frame with no gate in it, kept swept, at a station where the House has been trying to reopen the same span for six hundred years.'
        },
        description:
            'Nine gate stations, no two within a month\'s walk and all of them an hour apart, held in the house\'s own name because nobody else could grant a thing like that. Its dao is space: five thousand years of writing down both the walked distance between two places and the true one, and the entire house follows from being the only institution that has kept both numbers. Every courier route, storage ring, sect barrier and long trade contract in the region is priced off figures only the Span can produce, which makes it a quiet input to arrangements it is not party to and explains why the other houses regard the oldest institution in the catalog as a very large and very useful guild. The price of the discipline is that it cannot hold anything: holding requires staying and the whole doctrine is leaving, so it has no political influence, no succession doctrine, four disputed successions behind it, twenty-two of thirty-one terminals closed and unreopenable, and a gate frame with no gate in it that it keeps swept at a station where it has been failing to reopen the same span for six hundred years.',
        ambition: {
            wants:
                'One closed terminal reopened, starting with the eastern one, which sits inside an Anchorhold perimeter.',
            blockedBy: ['house-anchorhold'],
            wouldCost:
                'Anchored ground cannot be folded into, and the Anchorhold will not lift a nail for a survey it did not place. Reopening it also means finding out whether the terminals closed on their own, which the Long Measure wants and the Freight faction regards as an expensive way to learn something bad.',
            contestedWith: ['house-anchorhold', 'sect-clear-river-alliance'],
            movedOn:
                'It has surveyed the approach four times in six hundred years and the fourth survey is the first that does not agree with the other three.'
        },
        principle: 'space',
        principleDescription:
            'Travel, portals, territory, formations, storage and barriers. The House holds that the walked distance between two places and the true distance are different numbers, and that the difference is workable. Everything it does follows from being the only institution that has written both numbers down for five thousand years.',
        foundedYearsAgo: 5_000,
        civilReach: [
            'the courier network, and therefore the speed of every other institution',
            'storage: rings, vaults and the standard by which their capacity is certified',
            'barriers and sect boundary formations, built to contract',
            'the survey of record, from which all property boundaries are argued',
            'evacuation of settlements, which it does for free and at speed'
        ],
        services: [
            'courier and cargo spans, priced per true distance rather than per walked one',
            'storage certification, without which no storage ring sells at full value',
            'barrier construction, on a waiting list currently eleven years long'
        ],
        dependents: [
            'every merchant house in the region, absolutely and without alternative',
            'sects whose mountain barriers it built and only it can service',
            'the Thousand Treasure Pavilion, whose vault is a Span product'
        ],
        counter: {
            name: 'spatial anchoring',
            heldBy: 'house-anchorhold',
            description:
                'Fixed ground cannot be folded, entered or left by a span. The Anchorhold can nail a region shut, and the Measured Span has never found a way through an anchor it did not itself place - which it regards as a technical problem and the Anchorhold regards as the correct order of the world.'
        },
        blindSpots: [
            'no political influence and no interest in acquiring any',
            'it cannot hold territory, because holding requires staying and its entire doctrine is leaving',
            'no succession doctrine: the House has had four disputed successions and lost stations in three of them',
            'useless in a fight it cannot leave',
            'anything anchored, warded against folding, or simply too far inside another house\'s ground'
        ],
        internalFactions: [
            'the Long Measure, who want the closed gates reopened whatever it costs',
            'the Freight faction, who want the House to stop being ancient and start being profitable',
            'station wardens who have quietly gone independent and are still counted on the rolls'
        ],
        weaknesses: [
            'twenty-two of its thirty-one historical gate terminals are closed and it cannot reopen one',
            'its survey of the eastern range is four hundred years out of date because the ground moved',
            'the method for a permanent two-way span was lost with its predecessor and every attempt since has produced a one-way gate'
        ],
        houseSurname: 'Fu',
        admission: {
            route: 'adoption',
            prodigyIn:
                'True distance. Somebody who can stand between two places and give the folded figure without a chain, and be within a fraction of what the survey says, which the house tests on a span it has already measured and never tells them the answer.',
            marriage:
                'Yes, though the house is looser about it than the others and says so: its people are constantly travelling, so the marriage is frequently arranged years before the two parties are at the same station.',
            surrendered:
                'Any claim to a place. An adopted surveyor is entered on the roll and off every property record they held, because the house holds that a person who owns ground eventually stops walking.',
            naming:
                'The family is Fu - Fu Chang, Fu Zhen who is somewhere on a closed terminal, Elder Surveyor Fu Ling - and the Measured Span is a trade rather than a lineage. Every surveyor at every station is a Fu and men adopted in take it, so a bill signed Fu is signed by the family and honoured by the house, which is a distinction nobody outside has ever needed to make.',
            lastTaken:
                'Sixty years ago, the only one in four centuries, a placer\'s runner on the border road who had been quoting true distances to caravans for a fee and getting them right.',
            costOfTheForm:
                'The method for a permanent two-way span was lost with its predecessor and every attempt since has produced a one-way gate. The house cannot buy in a spatial talent from outside to solve it, and its own line has produced nobody who could in fourteen centuries.'
        },
        succession: {
            predecessorId: 'house-unlit-gate',
            yearsAgo: 1_400,
            officialVersion:
                'The Unlit Gate House overreached, opened a span it could not hold, and destroyed itself. The Measured Span inherited the survey out of duty and has been repairing the network since.',
            trueVersion:
                'Nobody now alive knows what the quarrel was about. The two houses were at war for eleven years over something neither side\'s surviving records state, both seats burned, and the Measured Span is a merger of the losers of both sides who agreed not to write down why. The gates closed on their own afterwards, which nobody has explained either.',
            discoverableTraces: [
                'the Measured Span\'s founding roll includes forty-one names that also appear on Unlit Gate rolls',
                'both seats burned in the same season, which the official account does not mention',
                'nine terminals still answer, and four of them open somewhere breathable, which is not the behaviour of a network that destroyed itself'
            ]
        },
        afterwardsClause:
            'Killing a surveyor stops the couriers to that region while the House works out whether it was aimed at them. It is usually restored within a season, and the region spends that season learning what its walked distances actually are.'
    },
    {
        id: 'house-anchorhold',
        name: 'The Anchorhold',
        alignment: 'righteous',
        powerOrdinal: 35,
        ranks: ['Peg', 'Holder', 'Nail Warden', 'Warden of the Survey', 'Elder of the Fixed Ground', 'The Standing Anchor'],
        admissionOrdinal: 10,
        stipend: [15, 46, 145, 460, 1_450, 4_400],
        teaches: [
            'anchor-stance-of-fixed-ground',
            'iron-shirt-tempering',
            'stone-hide-mantle',
            'unyielding-mountain-body',
            'five-breath-circulation-scripture',
            'foundation-tempering-scripture',
            'undyed-core-canon',
            'nascent-lotus-canon',
            // Between the lotus canon and the vein road, in the house's own
            // element, and it is the one book on this shelf that cannot be
            // carried away: the soul it produces is buried on the Anchorhold's
            // ground and stays there. A house that teaches it is a house
            // stating it does not expect to be driven off.
            'interred-soul-canon',
            'mountain-vein-devouring-canon'
        ],
        signatureTechniqueId: 'anchor-stance-of-fixed-ground',
        specialities: ['defense', 'cultivation'],
        rivals: ['house-measured-span', 'house-bound-word'],
        territory: 'The fixed survey: eleven containment perimeters, four scars, and the standard weights.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 88,
            formationNodesLit: 62,
            remnant: 'A stone at the centre of the survey that every measurement in the region is ultimately taken from, chained down, under a roof, watched by two people at all times.'
        },
        description:
            'The fixed survey held in the house\'s own name: eleven containment perimeters, four catastrophe scars, the standard weights, and a datum stone chained down under a roof and watched by two people at all times. Its dao is fixity - making a place be itself against everything that would move, fold, open, spread or relocate it - and twenty-nine centuries of it have made the least dramatic principle in the world the one every other principle quietly requires, because an oath binds to ground, a survey needs a datum, and a containment is only a containment while somebody is holding it. That is why it is the only house that can make an oath fail, a span close and a sealed thing stay sealed, and why its entire product is nothing happening, which is unimprovable as work and hopeless as reputation. It pays for the discipline by being immobile: it cannot pursue, cannot raid, arrives everywhere last, has no authority a step beyond surveyed ground, is funded by settlements becoming too poor to fund it, and is maintaining two of its eleven perimeters below the standard it publishes itself.',
        ambition: {
            wants:
                'Containment extended to the fourth scar, which has never been perimetered and is the only one still moving.',
            blockedBy: ['house-measured-span', 'house-bound-word'],
            wouldCost:
                'A levy on settlements that are already too poor to fund the eleven perimeters it has, and the Measured Span will argue the survey rather than the need, because a fourth perimeter closes the last open approach to two of its terminals. The Datum faction holds that the survey is the house\'s only real duty and that a twelfth perimeter is how the eleventh gets dropped.',
            contestedWith: ['house-measured-span'],
            movedOn:
                'It has surveyed the fourth scar and published the figure, which is as far as it can go without money, and has now published it three times.'
        },
        principle: 'fixity',
        principleDescription:
            'Anchoring: making a place be itself, reliably, against forces that would move, fold, open, spread or relocate it. Fixity is the least dramatic principle in the world and the one every other principle quietly requires - an oath binds to ground, a survey needs a datum, and a containment is only a containment while something holds it.',
        foundedYearsAgo: 2_900,
        civilReach: [
            'quarantine and containment of forbidden zones and catastrophe sites',
            'the survey of record and the standard weights, from which property and trade are argued',
            'nullification: an oath sworn on unfixed ground has nothing to bind to',
            'sealing, and the certification that a seal is still holding',
            'refusal of entry: an anchored region cannot be folded into'
        ],
        services: [
            'containment maintenance, paid for by every settlement within reach of a scar',
            'survey and datum certification, which every property dispute eventually needs',
            'anchoring of a site for a breakthrough, a burial or a sealed inheritance'
        ],
        dependents: [
            'eleven settlements that exist only because a perimeter is being maintained',
            'the Kiln Wardens, who accept Anchorhold survey figures and nothing else from outsiders',
            'sects whose vaults cannot be folded into precisely because the Anchorhold nailed them'
        ],
        counter: {
            name: 'folding around the anchor',
            heldBy: 'house-measured-span',
            description:
                'An anchor fixes what it covers and nothing else. A good enough surveyor folds around the nailed ground rather than through it, which does not break the anchor but makes it irrelevant, and is why the two houses have been arguing about perimeters for fourteen centuries.'
        },
        blindSpots: [
            'immobile by doctrine: it cannot pursue, cannot raid, and arrives everywhere last',
            'it cannot project force beyond surveyed ground, where its authority simply stops',
            'no divination, no alchemy, no economic instruments - it has money only because it is paid',
            'it is helpless against anything that does not need to move to hurt it',
            'anchoring a region it has not surveyed takes months it usually does not have'
        ],
        internalFactions: [
            'the Perimeter, who want containment expanded to every scar in the region',
            'the Datum, who hold that the survey is the House\'s only real duty',
            'a faction pressing to break one of the four nails to find out what is under it'
        ],
        weaknesses: [
            'containment is funded by settlements that are becoming too poor to fund it',
            'two of the eleven perimeters are being maintained below the standard the House itself sets',
            'it has never managed to anchor water, and has lost three wardens proving this repeatedly'
        ],
        houseSurname: 'Xu',
        admission: {
            route: 'adoption',
            prodigyIn:
                'Holding ground. Somebody who can fix a patch against a fold without a nail and without having been taught, which the house finds about once a century and usually at a scar, standing where nobody sensible would.',
            marriage:
                'Yes, and the house treats it as a survey question: it says outright which line it wants the talent crossed into, which visitors find cold and the Anchorhold considers the same kind of statement as a datum.',
            surrendered:
                'Your line and your mobility. An adopted warden is posted to a perimeter and the posting does not end, so the house is asking for the rest of somebody\'s life in one place and does not soften the request.',
            naming:
                'The family is Xu, from Xu Ping to Xu Ci under the datum stone, and the Anchorhold is what the Xu do. Men adopted in take the name. The Girdle descendants at the perimeter carry their own and are not permitted to hold rank, which is the only place in the seven houses where a surname is a bar rather than a fact, and the house is aware that the bar is the argument.',
            lastTaken:
                'Three hundred years ago, at the eastern perimeter, and the house has not looked at anybody since the scar went quiet.',
            costOfTheForm:
                'The live containment is what used to produce a Standing Anchor, the scar has gone quiet, and its own people no longer advance on the watch. The published wake schedule for Xu Ci is, read closely, an admission that the house does not expect to grow a replacement and cannot adopt one out of ground that is no longer dangerous.'
        },
        succession: {
            predecessorId: 'house-girdle-of-nine-stones',
            yearsAgo: 900,
            officialVersion:
                'The Girdle of Nine Stones let a containment fail, a province died, and the Anchorhold was raised from the survivors to make certain it could not happen twice.',
            trueVersion:
                'The containment had not failed. It was holding, and had been holding for six hundred years, and the Girdle would not surrender the survey to anyone. The Anchorhold\'s founders broke the eastern nail themselves to demonstrate that the Girdle could not maintain it, and the province died in the four days it took them to drive their own nail in its place. They then wrote the account, and the account is taught.',
            discoverableTraces: [
                'the province died four days after the breach, not before it - the sequence is wrong in the official account',
                'the eastern nail in place today is Anchorhold work of the correct age, sitting in a socket cut for a larger Girdle nail',
                'Girdle descendants still live at the perimeter and are not permitted to hold rank in the House'
            ]
        },
        afterwardsClause:
            'Killing a warden takes a perimeter below its watch minimum. The Anchorhold does not hunt anyone; it posts the shortfall publicly, names the date the containment will be considered unmaintained, and lets the eleven settlements downwind of it decide what to do about the person who caused that.'
    }
] as const;

/**
 * Everything the world calls a faction, in one array: the regional sects and
 * the ancient houses. Houses satisfy `SectSchema` exactly as sects do, so
 * every existing lookup, admission check and rivalry rule covers both.
 */
export const SECTS: readonly SectEntry[] = [...REGIONAL_SECTS, ...DAO_HOUSES];

/**
 * Houses that no longer exist, and are still load-bearing. A destroyed house
 * leaves ruins, forbidden fragments, bloodlines, descendants, standing oaths
 * and cursed ground, and those can matter for thousands of years after its
 * last member died.
 */
export const DESTROYED_DAO_HOUSES: readonly DestroyedDaoHouse[] = [
    {
        id: 'house-tally-court',
        name: 'The Tally Court',
        principle: 'karma',
        destroyedYearsAgo: 2_300,
        destroyedBy: 'house-ninefold-ledger',
        officialVersion:
            'A karma house that sold its judgements and branded debts which could not be settled. Dissolved by a coalition of righteous sects; its records were destroyed with it.',
        trueVersion:
            'It was ended by its own auditors, who founded the Ninefold Ledger the following year and kept the volumes. What the Court had been doing when it was ended was totalling what the crossings had taken out of everyone, and entering the Lid as the party that owed it.',
        traces: [
            'the burned seat at Sweptground, where debts sworn on the ground do not settle and never have since',
            'nine sealed volumes in the Ledger\'s own vault index, with no subject line',
            'a branded bloodline in the eastern towns that inherits an obligation nobody can identify or discharge',
            'standing oaths sworn to the Court, which have no surviving party to be discharged by and therefore do not lapse'
        ],
        fragmentTechniqueIds: [
            'severed-thread-audit',
            'unpayable-tally-brand',
            'debt-collection-in-arrears'
        ]
    },
    {
        id: 'house-girdle-of-nine-stones',
        name: 'The Girdle of Nine Stones',
        principle: 'fixity',
        destroyedYearsAgo: 900,
        destroyedBy: 'house-anchorhold',
        officialVersion:
            'A containment house whose eastern nail failed, killing a province. Its survivors were absorbed into the Anchorhold, which was founded to replace it.',
        trueVersion:
            'Its containment was intact. The Anchorhold\'s founders broke the eastern nail to prove the Girdle could not hold the survey, and the province died in the four days it took to replace it.',
        traces: [
            'a dead province, permanently thin, with the old nail sockets still visible and the wrong size',
            'Girdle descendants living at the perimeter, barred from rank in the house that replaced theirs',
            'a partial containment manual whose method is better than the one now taught, and which nobody in the Anchorhold will cite',
            'eight of the nine original stones, all still standing, all still doing something'
        ],
        fragmentTechniqueIds: [
            'anchor-nail-of-the-broken-girdle',
            'nameless-witness-stance'
        ]
    },
    {
        id: 'house-unlit-gate',
        name: 'The Unlit Gate House',
        principle: 'space',
        destroyedYearsAgo: 1_400,
        destroyedBy: null,
        officialVersion:
            'A gate house that opened a span it could not hold and destroyed itself. Its survey passed to the Measured Span.',
        trueVersion:
            'Nobody now alive knows. Two houses went to war for eleven years over something neither side\'s records state, both seats burned in the same season, and the survivors merged and agreed not to write down why. The gates closed on their own afterwards.',
        traces: [
            'thirty-one gate terminals, twenty-two closed, nine still answering',
            'four terminals that open somewhere a person can breathe, and five that do not',
            'a swept gate frame with no gate in it at a Measured Span station',
            'forty-one names on both houses\' founding rolls'
        ],
        fragmentTechniqueIds: ['gate-that-was-closed']
    }
];

/**
 * Disagreements about how the world actually works. These are ideological
 * before they are martial, and they are why three of the houses cannot sit on
 * the same arbitration bench.
 */
export const DAO_HOUSE_DISPUTES: readonly DaoHouseDispute[] = [
    {
        id: 'dispute-what-decides-outcomes',
        subject: 'What actually decides what happens to a person.',
        positions: [
            {
                houseId: 'house-ninefold-ledger',
                position:
                    'Nothing is decided in advance. Everything is owed, and consequence arrives when the thread pulls tight, which may be four generations after the act. Read the graph and you can say what must eventually happen, though not when.'
            },
            {
                houseId: 'house-narrow-hour',
                position:
                    'Debt is one shape an outcome takes and not the governing one. Possibilities narrow; a few are load-bearing; what happens is what the convergence was already going to produce. The Ledger is describing the bookkeeping and calling it the cause.'
            },
            {
                houseId: 'house-quiet-cut',
                position:
                    'Neither is absolute, and both houses have a commercial interest in saying otherwise. A thread can be cut and a convergence can be starved of its parties. What happens is what nobody removed.'
            }
        ],
        consequence:
            'The three cannot be seated on the same arbitration together, so any dispute involving inheritance, prophecy and concealment at once has no forum in the region and is settled by whoever is stronger.'
    },
    {
        id: 'dispute-who-may-hold-a-name',
        subject: 'Whether a name belongs to the person carrying it or to the record.',
        positions: [
            {
                houseId: 'house-held-names',
                position:
                    'A name held in trust survives the toll. Custody is a service, it is paid for, and the alternative is that the taking is final.'
            },
            {
                houseId: 'sect-lantern-hall',
                position:
                    'A name written down and charged for is a name sold. The Hall records what falls so that it is known, freely, by anyone; the House holds it hostage and calls the ransom a fee.'
            }
        ],
        consequence:
            'Nine cities require House registration and the Hall publishes a free counter-register, so a cultivator crossing between jurisdictions can be two different people on paper, which the Ledger has to arbitrate several times a year.'
    },
    {
        id: 'dispute-what-an-oath-binds-to',
        subject: 'Whether an oath binds to a person or to a place.',
        positions: [
            {
                houseId: 'house-bound-word',
                position:
                    'The seal binds the sworn party. Ground is a convenience of the ceremony and nothing more, and the Anchorhold\'s claim otherwise is an attempt to charge rent on other people\'s promises.'
            },
            {
                houseId: 'house-anchorhold',
                position:
                    'An oath sworn on unsurveyed ground has held in no recorded instance. The Bound Word knows this, has known it for eight centuries, and continues to witness on unfixed ground for the fee.'
            }
        ],
        consequence:
            'Every treaty of consequence is now sworn on Anchorhold-surveyed ground with both houses present and paid, which is expensive, universal, and never described in either house\'s own account of why.'
    }
];

/** Admission terms, kept beside the sects rather than inside them. */
export const SECT_ADMISSION: Record<string, SectAdmission> = {
    'sect-azure-cloud-pavilion': {
        minOrdinal: 3,
        guestFromOrdinal: 0,
        minMight: 2,
        preferredRoots: ['single_metal', 'dual_metal_wood'],
        requirement:
            'To be a disciple: Qi Condensation Layer 4 or better, and one clean strike shown to a Sword Elder. That bar has never moved and is not the door most people come through. The Pavilion also tests uncultivated mortals, takes the best of them onto probation at the very bottom of the ladder, and carries them for years before deciding - wide intake, narrow conversion, and the requirement above still waiting at the far end. And it will not be skipped: the Pavilion is asked perhaps twice a decade to take somebody under the bar on the word of a person who could make it awkward to refuse, and it refuses, in the same words each time, on the stated ground that a bar it moves once is not a bar. Being handed a child by somebody at the top of the world gets you what walking up the mountain gets you, which is a probation place and an honest look. See `AZURE_CLOUD_INTAKE` in `hierarchy.ts` and `a-favour-skips-the-admission-bar.ts`.'
    },
    'sect-verdant-spring-hall': {
        minOrdinal: 2,
        minInsight: 2,
        preferredRoots: ['single_wood', 'dual_metal_wood'],
        requirement: 'Qi Condensation Layer 3, and the ability to name forty herbs on sight.'
    },
    'sect-nine-peaks-ascetic-order': {
        minOrdinal: 5,
        minMight: 3,
        preferredRoots: ['single_earth', 'muddled_five_element'],
        requirement: 'Qi Condensation Layer 6, and a stone carried over all nine peaks without setting it down.'
    },
    'sect-clear-river-alliance': {
        minOrdinal: 1,
        preferredRoots: ['single_water', 'dual_water_fire'],
        requirement: 'Any cultivator who can cross the ford at Scarwater unaided.'
    },
    'sect-sweptground-temple': {
        minOrdinal: 0,
        preferredRoots: [],
        requirement: 'None. The Temple has never refused an applicant, including the ones it should have.'
    },
    'sect-lantern-hall': {
        minOrdinal: 2,
        minInsight: 3,
        preferredRoots: [],
        requirement: 'Literacy, and a written account of one thing the applicant has already lost and can still name.'
    },
    'sect-stonewright-consortium': {
        minOrdinal: 6,
        minInsight: 3,
        minCharm: 2,
        preferredRoots: [],
        requirement: 'An assaying examination and two hundred spirit stones as bond, refundable at Factor.'
    },
    'sect-thousand-treasure-pavilion': {
        minOrdinal: 4,
        minInsight: 3,
        minCharm: 2,
        preferredRoots: [],
        requirement: 'Literacy, an appraisal examination, and two hundred spirit stones as bond.'
    },
    'sect-cinnabar-crucible-guild': {
        minOrdinal: 6,
        minInsight: 3,
        preferredRoots: ['single_fire', 'single_wood', 'single_water'],
        requirement: 'A successful mortal-grade refinement performed in front of a Cauldron Master.'
    },
    'sect-ashen-forge-clan': {
        minOrdinal: 5,
        minMight: 2,
        preferredRoots: ['single_fire', 'single_metal'],
        requirement: 'Clan blood, or three years indentured at the bellows, whichever the applicant has.'
    },
    'sect-azure-mist-court': {
        minOrdinal: 1,
        preferredRoots: [],
        requirement: 'A refusal from the terraces, or a probation order from them, or nothing at all. Mist asks what happened and writes the answer down, and has never once refused somebody for the answer being unflattering.'
    },
    'sect-azure-dew-sect': {
        minOrdinal: 0,
        preferredRoots: [],
        requirement: 'Be found. Dew teaches in the villages first and admits afterwards, so by the time anybody is asked they have already been coming for two years.'
    },
    'sect-hollow-bell-wanderers': {
        minOrdinal: 0,
        preferredRoots: [],
        requirement: 'Show up. Ring the bell. That is the whole ceremony.'
    },
    'sect-frostmirror-court': {
        minOrdinal: 13,
        minInsight: 3,
        preferredRoots: ['mutated_ice'],
        requirement: 'A mutated ice root, verified at the gate. No other applicant is admitted, ever.'
    },
    'sect-kiln-wardens': {
        minOrdinal: 21,
        preferredRoots: [],
        requirement: 'The Wardens do not take applicants. People who arrive at the gate are turned around, once, politely.'
    },
    'sect-hollow-court': {
        minOrdinal: 29,
        preferredRoots: [],
        requirement: 'Void Refinement at the floor, and evidence - not ambition, evidence - that the last realm is reachable from where you stand. Nothing else is considered, and the exclusion is enforced downward as hard as upward: the children of the seated are fostered out to allied sects as a matter of course, at whatever rank they happen to be. They are not barred, and that distinction matters - they may come back, on the same terms as a stranger, if they reach the floor young enough that the rest of the road is still in front of them. Most do not, and are not disgraced by it. In a world that runs on lineage, patronage and inherited claim, this is the only door where none of it is worth anything, which is most of why the Court is spoken of the way it is.'
    },
    'sect-the-severed': {
        minOrdinal: 5,
        preferredRoots: [],
        requirement: 'One bond cut in front of a witness, chosen by the applicant, and recorded in the house ledger.'
    },
    'sect-crimson-abyss-hall': {
        minOrdinal: 3,
        preferredRoots: [],
        requirement: 'One killing, witnessed by a Chosen. The Hall is not particular about whom.'
    },
    'sect-bone-lantern-cult': {
        minOrdinal: 2,
        preferredRoots: ['single_earth', 'muddled_five_element'],
        requirement: 'A season spent working a battlefield without being seen by anyone who left it.'
    },
    'sect-nine-abyss-flame-sect': {
        minOrdinal: 8,
        minMight: 2,
        preferredRoots: ['single_fire', 'dual_water_fire'],
        requirement: 'Foundation-track talent, and a signed acceptance of the transformation contract.'
    },
    'sect-storm-tyrant-court': {
        minOrdinal: 9,
        preferredRoots: ['mutated_lightning'],
        requirement: 'A mutated lightning root. Everyone else the Court speaks to is not an applicant.'
    },

    // The two unbacked bodies, and both doors are low for reasons that are
    // not generosity. The port needs hands and cannot buy loyalty from
    // anybody who has a better offer; the shed needs bodies at a rate that
    // would end a house with a reputation to keep.
    'sect-halfwater-rail': {
        minOrdinal: 0,
        preferredRoots: [],
        requirement: 'Anything that can work a quay. The port hires on the day, pays on the day, and asks for a name it can shout across a deck rather than one anybody can check.'
    },
    'sect-sink-carriers': {
        minOrdinal: 0,
        preferredRoots: [],
        requirement: 'Carry your own load, leave another string\'s water alone, and come back to the shed to be counted. Three conditions, no questions, and the board at the door says what the odds are.'
    },

    // Dao houses. Note how little any of them cares about combat talent, and
    // how much they care about literacy, patience and staying put.
    'house-ninefold-ledger': {
        minOrdinal: 4,
        minInsight: 3,
        preferredRoots: [],
        requirement: 'Literacy, arithmetic, and a written account of one obligation the applicant is currently under. The account is checked.'
    },
    'house-narrow-hour': {
        minOrdinal: 6,
        minInsight: 4,
        preferredRoots: [],
        requirement: 'A sighting cast on the applicant by the House, at the applicant\'s expense, which the applicant is not shown.'
    },
    'house-bound-word': {
        minOrdinal: 5,
        minInsight: 3,
        minCharm: 2,
        preferredRoots: [],
        requirement: 'Forty years of intended service, sworn in front of a Warden of Terms before any training begins.'
    },
    'house-quiet-cut': {
        minOrdinal: 7,
        preferredRoots: [],
        requirement: 'One connection of the applicant\'s own, cut by the applicant, in front of a Quiet Hand. The House chooses which one.'
    },
    'house-held-names': {
        minOrdinal: 3,
        minInsight: 3,
        preferredRoots: [],
        requirement: 'The applicant\'s own name, entered in the register and held by the House for as long as they serve it.'
    },
    'house-measured-span': {
        minOrdinal: 8,
        minInsight: 3,
        preferredRoots: [],
        requirement: 'A survey of any nine li of ground, walked and measured, submitted with the applicant\'s working.'
    },
    'sect-standing-grove': {
        minOrdinal: 13,
        minInsight: 3,
        preferredRoots: [],
        requirement: 'There is no application. The Grove approaches perhaps one person a generation, having watched them for some years, and has approached nobody in forty-one.'
    },

    // The Quiet Marches. Note how low the bars are, and that the binding
    // requirement everywhere is stones rather than talent.
    'sect-weir-office': {
        minOrdinal: 2,
        preferredRoots: [],
        requirement: 'A grant application, a witness to residency, and the first day\'s access fee in advance. The Office refuses about half, and does not give reasons.'
    },
    'sect-sixmile-wardens': {
        minOrdinal: 0,
        preferredRoots: [],
        requirement: 'Walk the six miles from Kettle to Sixmile by the marked route, alone, and repaint any stake found down on the way.'
    },
    'sect-gleaners-company': {
        minOrdinal: 0,
        minMight: 2,
        preferredRoots: [],
        requirement: 'One season as a barrow hand at the sorting yard before anyone is permitted into a burn zone. Most applicants are refused after the season rather than before it.'
    },

    'house-anchorhold': {
        minOrdinal: 10,
        minMight: 2,
        preferredRoots: ['single_earth', 'muddled_five_element'],
        requirement: 'One year standing a perimeter watch before instruction begins. Most applicants leave in the first month.'
    }
} as const;


// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const SECT_BY_ID: ReadonlyMap<string, SectEntry> = new Map(SECTS.map(s => [s.id, s]));

const SECTS_BY_ALIGNMENT: ReadonlyMap<Sect['alignment'], readonly SectEntry[]> = (() => {
    const map = new Map<Sect['alignment'], SectEntry[]>();
    for (const s of SECTS) {
        const bucket = map.get(s.alignment);
        if (bucket) bucket.push(s);
        else map.set(s.alignment, [s]);
    }
    return map;
})();

/** Reverse index: which sects teach a given technique. */
const SECTS_BY_TAUGHT_TECHNIQUE: ReadonlyMap<string, readonly SectEntry[]> = (() => {
    const map = new Map<string, SectEntry[]>();
    for (const s of SECTS) {
        for (const id of s.teaches) {
            const bucket = map.get(id);
            if (bucket) bucket.push(s);
            else map.set(id, [s]);
        }
    }
    return map;
})();


// ──────────────────────────────────────────────────────────────────────
// ACTING POWER VERSUS SEALED POWER
//
// Two different questions that must never be answered with one number:
//
//   what can this sect field on a Tuesday   -> `powerOrdinal`
//   what can it field once, ever, at cost   -> `sealedCeiling`
//
// The gap between them is the interesting part of a sect. A sect with a small
// gap is what it looks like. A sect with a large one is an ordinary provincial
// institution until a specific condition fires, and then it is briefly the
// most dangerous thing in the province and afterwards has nothing at all.
// ──────────────────────────────────────────────────────────────────────

/**
 * A power that is awake, unsealed, and almost never present.
 *
 * The third case, and the one the Hollow Court needed. A sealed ancestor
 * CANNOT act without being spent. A withdrawn power CAN act, at full strength,
 * any time it likes - and does not, because its attention is committed to
 * something that does not leave room for the province.
 *
 * Mechanically this is the opposite failure from folding a sealed ancestor
 * into `powerOrdinal`. Here the ordinal is honest and the AVAILABILITY is the
 * lie: reading the Court's 44 as a thing that will meet you at a border gets
 * the world wrong in the other direction. What is true is that it could, that
 * it will not, and that nothing anyone does makes the second part a promise.
 */
export interface WithdrawnPower {
    /**
     * How many the faction holds above Grand Ascension.
     *
     * The number is the whole difference between this and an apex. An apex has
     * exactly one, pinned to the seat: sending them out uncovers the vault, so
     * they are never sent, and the institution is unassailable at home and
     * absent everywhere else. More than one means the ground stays covered
     * while somebody leaves, and REDUNDANCY IS WHAT BUYS REACH.
     *
     * Redundancy is also why the Court cannot be robbed, and this is the half
     * that decides the standoff. An apex with one holder can defend its object
     * or pursue whoever took it, never both, so the correct play against an
     * apex is to make it choose. Against the Court there is no such play: it
     * sends two, recovers the object, kills everyone involved, and the mountain
     * was covered the entire time. Every party that has thought about taking
     * something from the Court has arrived at that arithmetic and stopped.
     *
     * So the two ends of the world are asymmetric in a way that is easy to miss.
     * The apexes are individually unbeatable and structurally fragile. The Court
     * is neither pinned nor exposed, and is the only body in the setting with no
     * failure mode anybody has been able to name.
     *
     * This is the only faction in the world with a count above one, which makes
     * it the only faction that can put the last realm somewhere that is not its
     * own mountain. It is busy rather than pinned, and busy is a decision.
     */
    count: number;
    /**
     * The seats themselves, in order, with the rung each stands on.
     *
     * Ordered by `SEAT_ORDER`: ordinal descending, then age ascending. Second
     * and Third stand on the same rung, which is the tiebreak doing visible
     * work rather than a rounding artefact - equal ordinals, and the younger
     * holds the higher seat, so Second is younger than Third and takes first
     * claim on everything the Court can supply.
     *
     * `count` must equal this length, and the catalog test asserts it.
     */
    seats: readonly { position: string; ordinal: number }[];
    /** What the attention is committed to instead. */
    occupiedBy: string;
    /** Roughly how often anyone sees one, in plain terms. */
    seenAs: string;
    /** The circumstances under which it has actually come out. Short list, on purpose. */
    hasAppearedFor: readonly string[];
}

/**
 * Keyed by sect id. One entry, and it should stay close to one: a world where
 * several factions hold an unreachable ceiling is a world where the ceiling
 * stops meaning anything.
 */
// ──────────────────────────────────────────────────────────────────────
// FOSTERAGE
//
// What happens to the children of people who joined the only institution in
// the world that does not care whose child you are.
//
// The rule is not cruelty and it is not a test. It is the same bar applied to
// somebody who happens to be related to a seat, and the reason it has to be
// stated separately is that every other faction in the catalog would have
// bent it. A Court child arrives at an allied sect as a genuinely valuable
// person - the sect gains standing by holding them, teaches them properly,
// and has every reason to want them to succeed - and then the age gate
// decides, once, and everybody involved knows the date.
//
// Both outcomes are real outcomes. Returning is extraordinary and has happened.
// Not returning leaves someone senior, respected, well-placed and permanently
// half a step outside the institution that raised them, which is a life rather
// than a punishment.
// ──────────────────────────────────────────────────────────────────────

export interface Fosterage {
    /**
     * The house whose children these terms are about. Terms belong to the
     * SENDING house and travel with the child.
     */
    factionId: string;
    /**
     * WHERE A CHILD GOES IS NOT IN THIS OBJECT, AND MUST NOT BE.
     *
     * This carried a list of four sects. It was wrong, and it was wrong in the
     * way the whole catalog is most often wrong: it made a general thing look
     * like one body's arrangement, and it decided a destination from the
     * institution rather than from the person. A cultivator fosters a child to
     * somebody THEY have a tie to - somebody who owes them, somebody they
     * trained beside, somebody whose house theirs is close to - and two members
     * of the same house with different friends place their children in
     * different places. Four names in a data file cannot say that.
     *
     * `src/engine/world/a-child-their-own-house-will-not-keep.ts` decides it
     * from the fosterer's own ties, and the placement itself is `spendAWord`.
     * Nothing may put a destination list back here.
     */
    /** The floor they have to reach to be considered at all. */
    returnOrdinal: number;
    /**
     * And by what age. The gate is age rather than rank because the Court is
     * not asking whether they are strong; it is asking whether the rest of the
     * road fits in the life they have left. Reaching Void Refinement at four
     * hundred is a magnificent career and answers the wrong question.
     */
    returnByAge: number;
    /** Assessed the same way an outsider is, by the same people, once. */
    assessment: string;
    /** What the life looks like for the many who do not go back. */
    otherwise: string;
}

export const HOLLOW_COURT_FOSTERAGE: Fosterage = {
    factionId: 'sect-hollow-court',
    returnOrdinal: 29,
    returnByAge: 250,
    assessment:
        'The same assessment a stranger gets, conducted by the same seated member, on the same afternoon it would have been given to a stranger. Nobody has ever been told the result gently.',
    otherwise:
        'They stay where they were raised, at or near the top of it. A fostered Court child who does not go back is typically an elder somewhere reputable by the middle of their life, is treated with a deference the sect cannot quite account for, and is the single most reliable source in the province on what the Court is actually like - which is worth a great deal to people who will never get closer than that.'
};

/**
 * Every house that attaches terms to a child it placed elsewhere.
 *
 * One entry, and one entry is the shape of the claim: fostering is ordinary
 * and TERMS are not. Almost every house that sends a child away sends them
 * away, and the arrangement has no clause in it at all. A second entry here is
 * a statement that a second body in the world runs its children on a deadline,
 * which is a design decision rather than a content addition.
 */
export const FOSTERAGE_TERMS: readonly Fosterage[] = [HOLLOW_COURT_FOSTERAGE];

const FOSTERAGE_BY_FACTION = new Map(FOSTERAGE_TERMS.map(f => [f.factionId, f]));

/**
 * The terms this house attaches, where it attaches any.
 *
 * Undefined for every house but one, which is the answer the engine wants: a
 * fostering with no terms is the normal case and needs no branch to express.
 */
export function fosterageTermsOf(factionId: string | null | undefined): Fosterage | undefined {
    return factionId ? FOSTERAGE_BY_FACTION.get(factionId) : undefined;
}

/**
 * How the four Seats are ordered, First through Fourth.
 *
 * Rank first: the highest ordinal holds First Seat, so the powerOrdinal of
 * the Court and its First Seat are the same person by construction.
 *
 * Then age, and the tiebreak is an allocation rule rather than a courtesy.
 * Among equal ordinals the YOUNGER holds the higher seat, because a seat is
 * first claim on what the Court has, and lifespan is the constraint on the
 * crossing. Two at Tribulation Transcendence Perfection have the same odds per
 * attempt and different numbers of attempts left, so the resources go to the
 * one with more years to spend them in. Nothing about it is sentimental: it is
 * the Court putting its finite supply where it can still convert.
 *
 * So a seat is held rather than owned, and cannot be accumulated. Nobody here
 * has been demoted for failing; several have been moved down for being
 * overtaken, which is the same event described honestly - and being moved down
 * means going second for everything the Court can hand out.
 */
/**
 * The Azure intake: one gate, three places to be put, and probation everywhere.
 *
 * The Pavilion does not refuse people at the terrace gate. It takes them, scores
 * them, and places them - and where somebody is placed is a statement about the
 * score rather than about them. All three placements are probationary, which is
 * the part outsiders consistently miss: a terrace disciple is on probation at
 * the terraces exactly as a Mist disciple is on probation at the Mist, and the
 * terms are posted the same way.
 *
 *   exceptional   probation at the Azure Cloud Pavilion itself, immediately
 *   promising     placed at the Azure Mist Sect, which teaches the same
 *                 forms more slowly to people who have time to be taught
 *   unformed      placed at the Azure Dew Sect, or more often found by it
 *                 first and admitted afterwards
 *
 * Movement is upward and it is ordinary. Somebody exceptional emerging at the
 * Mist or the Dew is reintegrated to the terraces, which happens often enough
 * that the Mist keeps a recall roll and rarely enough that everybody at the Mist
 * knows the current number.
 *
 * So being sent down is not a disgrace and the Low Fall does not read it as one.
 * It reads it as the Pavilion deciding somebody is worth the cost of somewhere
 * to put them, which is a great deal more than it decides about most people -
 * and the alternative, at every other sect in the province, is being turned away
 * at the gate with no record that you were ever there.
 */
export const AZURE_INTAKE = {
    theGate:
        'One gate, at the terraces, and nobody is refused at it. An applicant is taken, scored, and placed, and the placement is the answer.',
    placements: [
        'exceptional: probation at the Azure Cloud Pavilion itself, from the first day',
        'promising: the Azure Mist Sect, which teaches the terrace forms to people who failed them or were never taught them',
        'unformed: the Azure Dew Sect, which more often finds somebody two years before it admits them'
    ],
    everythingIsProbation:
        'All three are probationary and all three post the term the same way, in the disciple\'s own hand, struck through in the same hand when it ends. A terrace disciple is not more permanent than a Mist one; they are on a shorter term.',
    reintegration:
        'Upward and ordinary. Somebody exceptional emerging at the Mist or the Dew is recalled to the terraces on the years served, and the Mist keeps the roll. It happens often enough to be a system and rarely enough that everybody at the Mist can tell you the current number without looking.',
    whyItIsNotShameful:
        'Because the alternative everywhere else is the gate. Every other sect in the province refuses people and keeps no record that they came; the Pavilion places them and writes down where. A Mist posting is the Pavilion spending something on somebody, and the province has understood that for four hundred years.',
    whatItCostsThePavilion:
        'Two holdings it could have kept for itself, on a vein it is not using either half of, and a standing obligation to read a quarterly roll. It reads the roll rarely, which is the one part of the arrangement that would embarrass it.'
} as const;

export const SEAT_ORDER = {
    primary: 'Realm ordinal, descending. The highest holds First Seat.',
    tiebreak:
        'Age, ascending. Among equal ordinals the younger holds the higher seat, because the seat is first claim on the resources and lifespan is what limits how many attempts at the crossing anybody gets. Same odds per attempt, more attempts remaining, so the supply goes there.',
    displacement:
        'A seat is held, not owned. Somebody arriving at an equal ordinal younger takes the seat above them and everybody below shifts down one, which moves them down the queue for everything the Court can supply. It is not a demotion and the Court does not treat it as one, which does not make it comfortable.',
    outsideTheLadder:
        'Guest of the Court is honorary, sits outside the four rungs, and is not a seat. It confers nothing and asks nothing.',
    whenSomebodyRunsOut:
        'The rule has an edge nobody designed and everybody has now seen. It allocates on attempts remaining, so somebody with none cannot be placed on it at all - not at the bottom, not anywhere. A First Seat who makes the crossing and does not complete it comes back with no ordinal and no attempts, and the ladder that ranked them has no rung that fits. Guest of the Court exists because that happened once and the Court had to put him somewhere.'
} as const;

/**
 * The powers that have withdrawn from the world, and the seats they hold.
 *
 * This is the apex of the setting and `docs/` does not name it anywhere - a
 * search of the bible for the Hollow Court's holdings returns nothing, which
 * has already produced one invented answer that had to be retracted. The
 * written design for what the Court is and who it admits is
 * `docs/world/climbing/past-the-ceiling.md`, "The Hollow Court is the exception to all
 * of it"; who stands on the mountains is `hollow-court-roster.ts`; the seat
 * ordering is `SEAT_ORDER` immediately above. All four are indexed in
 * `docs/world/INDEX.md`.
 */
export const WITHDRAWN_POWERS: Record<string, WithdrawnPower> = {
    'sect-hollow-court': {
        count: 4,
        seats: [
            { position: 'First Seat', ordinal: 44 },
            { position: 'Second Seat', ordinal: 43 },
            { position: 'Third Seat', ordinal: 43 },
            { position: 'Fourth Seat', ordinal: 42 }
        ],
        occupiedBy:
            'Four Seats, First through Fourth, ordered by ordinal and then by youth. The crossing. Everyone seated is working on it continuously, and has been for long enough that the province measures their presence in decades of absence rather than in appearances.',
        seenAs:
            'A generation of a regional sect can pass without anyone at that sect meeting one. The mountains are visited; the occupants are not.',
        hasAppearedFor: [
            'a direct question asked in person, which is answered honestly and briefly, because honesty costs them nothing',
            'somebody arriving at the gate who actually meets the bar, which has happened four times',
            'interference with the vein itself, which has happened once and is not described in any surviving record'
        ]
    }
};

export interface SectThreat {
    /** Strongest member who will actually answer. The public number. */
    acting: number;
    /**
     * Strongest thing the sect can put in the world at all, including one it
     * can only spend once. Equals `acting` where there is nothing sealed.
     */
    ceiling: number;
    /** Null where nothing is sealed. What has to happen for `ceiling` to be real. */
    wakeCondition: string | null;
    /** Null where nothing is sealed. What spending it costs, which is usually all of it. */
    wakeCost: string | null;
    /** False when outsiders do not know there is anything under the mountain. */
    sealedIsPublic: boolean;
    /**
     * Set where `acting` is real, awake, and effectively never in the room.
     * An engine deciding whether a border will actually be defended must read
     * this before it reads `acting`.
     */
    withdrawn: WithdrawnPower | null;
}

/**
 * What a sect is worth being afraid of, split into the two numbers.
 *
 * Deliberately returns both rather than a max: an engine deciding whether a
 * challenge is survivable wants `acting`, and an engine deciding whether a
 * plan to burn the sect down is wise wants `ceiling`. Collapsing them is the
 * bug this function exists to prevent.
 */
export function sectThreat(id: string): SectThreat | undefined {
    const sect = getSect(id);
    if (!sect) return undefined;
    const sealed = SECT_ANCESTRY[id]?.dormant ?? null;
    return {
        acting: sect.powerOrdinal,
        ceiling: Math.max(sect.powerOrdinal, sealed?.realmOrdinal ?? 0),
        wakeCondition: sealed?.wakeCondition ?? null,
        wakeCost: sealed?.wakeCost ?? null,
        sealedIsPublic: sealed?.publiclyKnown ?? false,
        withdrawn: WITHDRAWN_POWERS[id] ?? null
    };
}

/**
 * Whether a faction can put a last-realm cultivator anywhere but home.
 *
 * Almost nothing can. An apex holds one and cannot spare them; every other
 * holder at this ordinal is sealed and cannot be spared at all without being
 * spent. A faction answers true here only by holding more than one awake, and
 * exactly one faction does.
 */
export function canProjectLastRealm(id: string): boolean {
    const withdrawn = WITHDRAWN_POWERS[id];
    return withdrawn != null && withdrawn.count > 1;
}

/** Sects whose one-off ceiling is above what they can field day to day. */
export function sectsWithASealedCeiling(): SectEntry[] {
    return SECTS.filter(s => {
        const d = SECT_ANCESTRY[s.id]?.dormant;
        return d != null && d.realmOrdinal > s.powerOrdinal;
    });
}
export function getSect(id: string): SectEntry | undefined {
    return SECT_BY_ID.get(id);
}

export function requireSect(id: string): SectEntry {
    const s = SECT_BY_ID.get(id);
    if (!s) throw new Error(`Unknown sect: ${id}`);
    return s;
}

export function getSectsByAlignment(alignment: Sect['alignment']): readonly SectEntry[] {
    return SECTS_BY_ALIGNMENT.get(alignment) ?? [];
}

export function getSectsTeaching(techniqueId: string): readonly SectEntry[] {
    return SECTS_BY_TAUGHT_TECHNIQUE.get(techniqueId) ?? [];
}

export function getSectAdmission(id: string): SectAdmission | undefined {
    return SECT_ADMISSION[id];
}

/** Sects whose door is open to a cultivator at this ordinal. */
export function findSectsForOrdinal(ordinal: number, alignment?: Sect['alignment']): SectEntry[] {
    const cap = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
    const pool = alignment ? getSectsByAlignment(alignment) : SECTS;
    return pool.filter(s => s.recruits && s.admissionOrdinal <= cap);
}

/** Monthly stipend in spirit stones for a rank index within a sect. */
export function stipendForRank(sectId: string, rankIndex: number): number {
    const sect = requireSect(sectId);
    if (rankIndex < 0 || rankIndex >= sect.stipend.length) return 0;
    return sect.stipend[rankIndex];
}

/**
 * Fraction of its own inherited formation a sect can still operate. The
 * clearest single number for how late this age is: nobody is near 1, and the
 * ones who are did not inherit anything worth having.
 */
export function getSectAncestry(id: string): AncestralRecords | undefined {
    return SECT_ANCESTRY[id];
}

/**
 * Factions with something still in the world that can be woken. This is the
 * list that makes "what happens afterwards" a real question, and the engine
 * should never surface it wholesale to a player: `publiclyKnown` is false for
 * most of them, and the ones that are hidden are hidden on purpose.
 */
export function getDormantAncestors(): { sectId: string; dormant: DormantAncestor }[] {
    const out: { sectId: string; dormant: DormantAncestor }[] = [];
    for (const [sectId, records] of Object.entries(SECT_ANCESTRY)) {
        if (records.dormant) out.push({ sectId, dormant: records.dormant });
    }
    return out;
}

/** Factions publicly claiming an ancestor above the Lid, true or otherwise. */
export function getSectsClaimingLivingAncestor(): string[] {
    return Object.entries(SECT_ANCESTRY)
        .filter(([, r]) => r.claimsLivingAncestor)
        .map(([id]) => id);
}

/**
 * The parting gift a sect is holding, if it still has one. An intact gift from
 * a recent crossing is the difference between a venerable sect and a currently
 * formidable one.
 */
export function getPartingGift(sectId: string): PartingGift | undefined {
    const gift = SECT_ANCESTRY[sectId]?.partingGift;
    return gift ?? undefined;
}

/**
 * The preeminent institution of the present age: the sect whose ancestor made
 * the last confirmed crossing and left an intact gift behind. There is exactly
 * one, and the test asserts that.
 */
export function getPreeminentSect(): SectEntry | undefined {
    for (const [sectId, r] of Object.entries(SECT_ANCESTRY)) {
        if (r.claimsLivingAncestor && r.claimIsTrue && r.recency === 'recent' && r.partingGift?.intact) {
            return SECT_BY_ID.get(sectId);
        }
    }
    return undefined;
}

/**
 * What a verification of this faction's ancestral claim would actually turn
 * up. Undefined where the faction makes no claim; an empty trace list means
 * the claim is honest and the certification would come back clean.
 */
export function auditAncestralClaim(sectId: string): {
    claimed: boolean;
    true: boolean;
    recency: AncestralRecency;
    giftIntact: boolean;
    traces: readonly string[];
} | undefined {
    const r = SECT_ANCESTRY[sectId];
    if (!r || !r.claimsLivingAncestor) return undefined;
    return {
        claimed: r.claimsLivingAncestor,
        true: r.claimIsTrue,
        recency: r.recency,
        giftIntact: r.partingGift?.intact ?? false,
        traces: r.discoverableTraces
    };
}

const DAO_HOUSE_BY_ID: ReadonlyMap<string, DaoHouseEntry> = new Map(DAO_HOUSES.map(h => [h.id, h]));
const DESTROYED_HOUSE_BY_ID: ReadonlyMap<string, DestroyedDaoHouse> =
    new Map(DESTROYED_DAO_HOUSES.map(h => [h.id, h]));
const DAO_HOUSE_BY_PRINCIPLE: ReadonlyMap<DaoPrinciple, DaoHouseEntry> =
    new Map(DAO_HOUSES.map(h => [h.principle, h]));

export function getDaoHouse(id: string): DaoHouseEntry | undefined {
    return DAO_HOUSE_BY_ID.get(id);
}

export function requireDaoHouse(id: string): DaoHouseEntry {
    const h = DAO_HOUSE_BY_ID.get(id);
    if (!h) throw new Error(`Unknown Dao house: ${id}`);
    return h;
}

/** One house per principle, which is the point of a house. */
export function getDaoHouseByPrinciple(principle: DaoPrinciple): DaoHouseEntry | undefined {
    return DAO_HOUSE_BY_PRINCIPLE.get(principle);
}

export function getDestroyedDaoHouse(id: string): DestroyedDaoHouse | undefined {
    return DESTROYED_HOUSE_BY_ID.get(id);
}

/** True for the houses, false for the ordinary regional sects. */
export function isDaoHouse(id: string): boolean {
    return DAO_HOUSE_BY_ID.has(id);
}

/** How somebody actually gets in, which the `recruits` boolean cannot say. */
export type IntakeRoute = 'open' | 'adoption' | 'closed';

/**
 * The three-valued read of a faction's door.
 *
 * `recruits` is a boolean and is consumed as one by the engine, the tool layer
 * and the register, so it stays a boolean: it answers "is there a way in at
 * all", and for a dao house the answer is genuinely yes. It just is not an
 * admission day. This is the single place to widen if those consumers ever
 * want the distinction, rather than changing the flag under them.
 */
export function intakeRouteOf(factionId: string): IntakeRoute | undefined {
    const sect = SECT_BY_ID.get(factionId);
    if (!sect) return undefined;
    if (!sect.recruits) return 'closed';
    return DAO_HOUSE_BY_ID.has(factionId) ? 'adoption' : 'open';
}

/** Everything the given faction is contesting a claim with, both directions. */
export function contestedClaimsOf(factionId: string): SectEntry[] {
    const mine = SECT_BY_ID.get(factionId);
    const ids = new Set(mine?.ambition?.contestedWith ?? []);
    for (const s of SECTS) {
        if (s.ambition?.contestedWith.includes(factionId)) ids.add(s.id);
    }
    ids.delete(factionId);
    return [...ids].map(id => SECT_BY_ID.get(id)).filter((s): s is SectEntry => Boolean(s));
}

/**
 * The house that holds the counter to this house's principle, where a living
 * house holds it at all. No specialisation is an automatic win, and this is
 * the lookup that says who to go to about it.
 */
export function getCounterHouse(houseId: string): DaoHouseEntry | undefined {
    const held = requireDaoHouse(houseId).counter.heldBy;
    return held ? DAO_HOUSE_BY_ID.get(held) : undefined;
}

/** Disputes a given house is a party to. */
export function getDisputesFor(factionId: string): DaoHouseDispute[] {
    return DAO_HOUSE_DISPUTES.filter(d => d.positions.some(p => p.houseId === factionId));
}

/**
 * What a house's own archive says about how it came to hold its ground, and
 * what actually happened. The engine hands the official version out freely and
 * gates the true version behind whatever the run has actually uncovered - this
 * lookup does not decide that, it only supplies both.
 */
export function getSuccessionAccounts(houseId: string): {
    official: string;
    truth: string;
    predecessor: DestroyedDaoHouse | undefined;
    traces: readonly string[];
} | undefined {
    const succession = requireDaoHouse(houseId).succession;
    if (!succession) return undefined;
    return {
        official: succession.officialVersion,
        truth: succession.trueVersion,
        predecessor: DESTROYED_HOUSE_BY_ID.get(succession.predecessorId),
        traces: succession.discoverableTraces
    };
}

export function formationIntegrity(sectId: string): number {
    const sect = requireSect(sectId);
    if (sect.compound.formationNodesTotal === 0) return 0;
    return sect.compound.formationNodesLit / sect.compound.formationNodesTotal;
}

// ─────────────────────────────────────────────────────────────────────────
// TERRITORY
//
// The vocabulary existed on one side of the hierarchy and not the other. A
// court has carried `grantsInRegionId` since it was written; a sect had no
// field at all saying where it stands, so "the Ashen Forge Clan holds the
// volcanic flank" was a sentence in a `holds` string and nothing a query could
// reach. These four functions are that field, on this side.
//
// THEY ARE LOOKUPS AND NOT A SECOND COPY, deliberately. `PREFECTURES` in
// `regions.ts` is the single authority for who holds what ground, and the
// alternative - a `SECT_TERRITORY` record beside `SECT_ADMISSION` - would have
// been a second place entitled to an opinion about the same fact, which is
// exactly the failure `ADVANCEMENT_EFFECTS` was written to end in `pills.ts`.
// A sect's ground is stated once, in the file that owns ground.
//
// `delegatedFromSect` returning null is a real answer and the most interesting
// one in the catalog: it is what the Azure Cloud Pavilion, the Hollow Court,
// the Longbough Grove, the Clear River Fordhall and the Sixmile Wardens have in
// common, and it is the only thing they have in common. An apex that answers
// to nobody, an occupation nothing can move, a zone held by a belief, a toll
// nobody authorised and six people repainting stakes are five completely
// different reasons for the same empty field.
// ─────────────────────────────────────────────────────────────────────────

/** The prefecture a sect holds, or sits inside as a sub-holder. */
export function prefectureOfSect(sectId: string): Prefecture | undefined {
    return prefectureForFaction(sectId);
}

/** The province a sect's ground is in. */
export function provinceOfSect(sectId: string): Province | undefined {
    return provinceForFaction(sectId);
}

/**
 * Whose gift a sect's ground is in - a court, an apex, or another sect where
 * the holding is at one remove. Null where nothing granted it.
 */
export function delegatedFromSect(sectId: string): string | null {
    return delegatedFrom(sectId);
}

/**
 * Everything a sect's ground amounts to in one object, including whether the
 * record and the ground agree. The `discrepancy` is the field worth reading:
 * per `the-late-age.md` every institution is operating a fraction of what it
 * inherited, so a holder whose paper and ground read the same is the case that
 * needs no explanation and the other four are the content.
 */
export function territoryOfSect(sectId: string): {
    province: Province;
    prefecture: Prefecture;
    /** True where this sect holds the prefecture rather than sitting in it. */
    isPrincipalHolder: boolean;
    delegatedFromId: string | null;
    onPaper: string;
    onTheGround: string;
    discrepancy: Prefecture['discrepancy'];
} | undefined {
    const prefecture = prefectureForFaction(sectId);
    if (!prefecture) return undefined;
    const province = getProvince(prefecture.provinceId);
    if (!province) return undefined;
    const isPrincipalHolder = prefecture.heldByFactionId === sectId;
    const sub = prefecture.subHoldings.find(s => s.factionId === sectId);
    return {
        province,
        prefecture,
        isPrincipalHolder,
        delegatedFromId: delegatedFrom(sectId),
        // A sub-holder's paper is its own line in the grant, not the
        // prefecture's; the prefecture's is what its principal holds.
        onPaper: isPrincipalHolder ? prefecture.onPaper : (sub?.holds ?? prefecture.onPaper),
        onTheGround: prefecture.onTheGround,
        discrepancy: prefecture.discrepancy
    };
}

/** Every sect standing in a prefecture, holder first. */
export function sectsSeatedIn(prefectureId: string): SectEntry[] {
    const prefecture = getPrefecture(prefectureId);
    if (!prefecture) return [];
    const ids = [
        ...(prefecture.heldByFactionId ? [prefecture.heldByFactionId] : []),
        ...prefecture.subHoldings.map(s => s.factionId)
    ];
    return ids.map(id => getSect(id)).filter((s): s is SectEntry => s !== undefined);
}
