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
 * Hall, the Severed, the Hollow Court and the Kiln Wardens - are in this
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
    probationOrdinal?: number;
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

/**
 * What became of somebody after they crossed.
 *
 * Ascension is not an ending, which the sheet kept implying. Two of the three
 * things that kill a cultivator here cannot reach them up there - heavenly
 * tribulation is behind them and lifespan has stopped being a number - but the
 * Immortal Realm has dangers and politics of its own, and people lose to them.
 * Somebody who crossed three thousand years ago has had three thousand years of
 * that.
 *
 * Nobody below the Lid can establish which of these is true for any given
 * ancestor. The catalog records it because the engine is allowed to know things
 * the world cannot; every character in the world is guessing.
 */
export type AfterCrossing = 'still_above' | 'died_above';

export type AncestorFate =
    | 'dead'
    | 'ascended'
    | 'dormant'
    | 'lost';

export type AncestralRecency = 'none' | 'recent' | 'several_ages' | 'ancient';

export interface SectAncestor {
    name: string;
    fate: AncestorFate;
    /**
     * What they stood at, or null where the record does not say - which is
     * most of them. A wall of tablets is genealogy, and genealogy does not
     * keep realms. Only the ancestors who are still load-bearing (ascended, or
     * sealed and wakeable) are recorded, because those are the two cases where
     * somebody had to be able to afford it.
     */
    realmOrdinal: number | null;
    /** Years since the death, the crossing, or the sealing. */
    yearsAgo: number;
    /**
     * Set only where `fate` is 'ascended'. Null everywhere else.
     *
     * Ground truth, and unknowable in the world. A sect claiming its ancestor
     * still answers is making a claim it cannot check, and one claiming the
     * opposite is doing the same thing in the other direction.
     */
    afterCrossing: AfterCrossing | null;
    rememberedFor: string;
}

export interface MillennialOffering {
    yearsAgo: number;
    /** What it cost. Offerings are paid out of the principal, never the interest. */
    cost: string;
    /** The few words that came back, as the sect records them. Null for silence. */
    response: string | null;
    /** What the sect did about the answer, or about the silence. */
    consequence: string;
}

/**
 * What the seal itself is, which decides what it can hold and for how long.
 *
 * A seal is a formation running continuously for centuries, and the grade is
 * mostly a statement about how much it burns to do that. The band it can hold
 * runs from Void Refinement to Tribulation Transcendence - below that nobody
 * would pay for it, and above it nothing in the Late Age has been built.
 *
 *   crude       cheap to raise and expensive to keep. Burns vein output
 *               continuously, degrades measurably within a lifetime, and anything
 *               sealed inside it thins. Holds the bottom of the band.
 *   sound       the ordinary standard, and the ordinary reason a sect is poor.
 *   masterwork  built by somebody who is not available any more. Draws almost
 *               nothing, has not been serviced in centuries, and is the reason
 *               a small sect can be sitting on something enormous without the
 *               expenditure that would give it away.
 *
 * The grade is therefore also a tell. A sect running a crude seal cannot hide
 * it - the vein output does not add up and the Consortium can read that off a
 * ledger. A masterwork is invisible, which is exactly why nobody can say which
 * quiet mountain has something under it.
 */
export type SealGrade = 'crude' | 'sound' | 'masterwork';

/**
 * Why somebody is under a mountain, which decides what waking them costs.
 *
 *   protector     sealed while still whole, deliberately, as a reserve. Waking
 *                 one spends a weapon the sect chose to bank.
 *   final_breath   sealed because they were ending anyway, and the seal is what
 *                 is left of them. Waking one spends the last of a person who
 *                 was already finished, usually to do a single specific thing
 *                 nobody else can.
 *
 * The distinction is not sentiment. A protector can be spent on anything worth
 * a weapon; one sealed at the end generally cannot be redirected, because what
 * is left of them is shaped around one act. It is also the difference between a
 * sect that armed itself and a sect that could not bear to let go, and rivals
 * read those two very differently.
 */
export type SealReason = 'protector' | 'final_breath';

export interface DormantAncestor {
    name: string;
    /** Where they are, in one concrete line. */
    restingPlace: string;
    dormantYears: number;
    /**
     * THIS IS NOT THE SECT'S `powerOrdinal`, AND MUST NEVER BE FOLDED INTO IT.
     *
     * `powerOrdinal` is the strongest member who will actually answer: someone
     * who takes a challenge, walks a border, sits at a negotiation. A sealed
     * ancestor does none of that. They are a break-glass asset with a stated
     * trigger and a stated cost, spent once and generally not survived, so a
     * sect holding one is an ordinary sect in every week of its life and a
     * catastrophe in the one week its `wakeCondition` fires.
     *
     * Reading the two as one number breaks the world in both directions: it
     * makes an eleven-disciple sect unfightable on paper, and it removes the
     * only thing that made robbing them interesting - that outsiders cannot
     * tell which sects have something under the mountain, because sects lie
     * about it in both directions. See `sealedCeiling`.
     *
     * A SEAL CUTS BOTH WAYS, and the catalog should be read in both directions.
     *
     * Defensively it is the last card, and this is the reading every entry here
     * is written in: the wake conditions are disaster clauses. The caldera is
     * breached. The library is entered by force. Two perimeters are lost in one
     * season. That is what a sect tells itself the seal is for, and it is true.
     *
     * Offensively it is a single use looking for something worth spending it
     * on, and that is the reading a sect does not say out loud. Same object,
     * same decision, opposite direction - which means a sect that has quietly
     * reclassified its last card as an opening move looks exactly like one that
     * has not. Nothing visible about it changes.
     *
     * Two objects in the world would justify the offensive read. See `sentDown`
     * on the apex institutions in `hierarchy.ts`, and `partingGift` below: they
     * are the same phenomenon at two ends of the ladder. An ascending cultivator
     * divests downward, rarely but reliably; what a sect gets is a gift, and
     * what an apex got is the reason it is an apex. Note also `asAnArtifact`:
     * those objects are immortal-made and formidable before the Lid enters into
     * it, so the sum works even for a sect with no route upward at all.
     *
     * The band is Void Refinement to Tribulation Transcendence, and which end
     * depends on `sealGrade` rather than on the sect. Holding a body and a soul
     * intact costs a formation running continuously off a vein, so the floor is
     * economic: below Void Refinement nobody would spend it, and above
     * Tribulation Transcendence nothing in the Late Age was ever built to hold.
     *
     * A crude seal holds the bottom of that band and eats the vein doing it. A
     * masterwork holds the top and draws almost nothing, which is why the
     * dangerous case is a small sect with a very old formation nobody can read.
     *
     * An ordinal below the band is not forbidden, but it is a claim about the
     * SEALER rather than the sealed - somebody with an unreasonable amount of
     * money and a personal reason - and it has to be said out loud in
     * `wakeCondition` rather than left for a reader to notice.
     */
    realmOrdinal: number;
    /** What is holding them, which decides both the band and the running cost. */
    sealGrade: SealGrade;
    /** Whether they were banked whole, or kept at the end. See `SealReason`. */
    sealReason: SealReason;
    /** The circumstance under which the sect would actually break the glass. */
    wakeCondition: string;
    /** What waking costs. Nearly always the ancestor. */
    wakeCost: string;
    /** False when outsiders do not know there is anything under the mountain. */
    publiclyKnown: boolean;
}

export interface PartingGift {
    /** Catalog-style id so the engine can treat it as a real object. */
    id: string;
    name: string;
    /** Plainly beyond what this age can produce. */
    description: string;
    /** Why it is held in reserve rather than wielded. */
    reserveTerms: string;
    /** False when the gift has been spent, lost, or quietly stolen. */
    intact: boolean;
}

export interface AncestralRecords {
    /** The wall of names. Everybody has one. */
    ancestors: readonly SectAncestor[];
    /** What the sect says publicly. */
    claimsLivingAncestor: boolean;
    /** Whether the claim is true. Never surfaced directly; discovered. */
    claimIsTrue: boolean;
    recency: AncestralRecency;
    /** Present only where something is still in the world and can be woken. */
    dormant: DormantAncestor | null;
    /** What an ascending ancestor left on the way out. */
    partingGift: PartingGift | null;
    lastOffering: MillennialOffering | null;
    /** Evidence that does not match the claim. Empty when the claim is honest. */
    discoverableTraces: readonly string[];
    /** How the world actually treats the sect because of all this. */
    standingNote: string;
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
    /** False for powers that take no applicants at all. */
    recruits: boolean;
    compound: SectCompound;
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

export interface DaoHouseEntry extends SectEntry {
    principle: DaoPrinciple;
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
        // none of them; `SECT_ADMISSION.probationOrdinal` carries that floor,
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
            'void-piercing-sword-domain'
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
            'The region\'s orthodox sword sect, and its most reliable source of both instruction and condescension. The Pavilion did not build the Pavilion; it moved in, cleared four centuries of birds out of the upper halls, and lit the nine formation nodes it could still read. Disciples fly before they are permitted to argue, which the Pavilion considers the correct order.'
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
            'verdant-longevity-canon',
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
            'Healers first and cultivators second, which is why the Hall has outlived four sects that considered it soft. It treats anyone who arrives injured, including enemies, and then bills them, including enemies. Its restoration art came out of the valley\'s own ruin nine generations back; the Hall is candid that it recovered the manual rather than wrote it.'
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
            'Body-tempering ascetics squatting on a vein somebody else opened, refusing for two centuries to lease any part of it. They light eleven of the sixty-three nodes and admit freely that they do not know what forty of the others were for. Admission requires carrying a stone up all nine peaks; the stone is not important and the Order will not say what is.'
    },
    {
        id: 'sect-clear-river-alliance',
        name: 'Clear River Alliance',
        alignment: 'righteous',
        powerOrdinal: 24,
        ranks: ['Boat Hand', 'River Disciple', 'Current Disciple', 'Ford Master', 'River Elder', 'Alliance Head'],
        admissionOrdinal: 1,
        stipend: [3, 9, 26, 85, 300, 900],
        teaches: [
            'gutter-rain-palm',
            'reed-crossing-qinggong',
            'clear-spring-detoxification',
            'moonlit-well-absorption-art',
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
            'Less a sect than a federation of ferrymen who learned to fight. Takes almost anyone, pays almost nothing, and knows every crossing, smuggler and drowned secret on the water. Half its river-charts are copied from a survey two ages old, and the copies are still more accurate than anything the Alliance has managed since.'
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
            'Takes orphans, beggars, muddled roots and anyone else the good sects turn away, and asks for nothing but the work. It is the rarest thing in the region: a compound its occupants actually built, on thin ground nobody else wanted, running six modest nodes it fully understands. Almost everything it teaches is elementless, which is the point - a temple that only accepted clean roots would be a temple for other people.'
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
            'Archivists of what the crossings take. When a boundary cuts something away - a face, a name, the fact that two people were brothers - the Hall writes down what it was, from whatever record and whichever witness is left, so that somebody in the world still holds it. Their position is that a world which requires its best people to cut away everything they loved in order to rise is a world eating itself, and that the cheerful phrase for this is "the price". They are unpopular in exactly the way that suggests, and they will read a cultivator their own ledger whether or not it was requested.'
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
            'lesser-qi-gathering-manual',
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
            'The closest thing the region has to a functioning state. They draw raw qi off the veins, refine it into spirit stones, and set the rate - which means they set the price of medicine, of a cave on decent ground, and of a vein itself. A vein sale goes through their assay or it does not go through. Not evil; simply incapable of seeing a valley as anything but throughput, and entirely aware that the stones a poor cultivator buys are the difference between progressing and not.'
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
            'A commercial sect that buys dug goods from anyone and asks nothing about the hole. Most of what crosses its floor came out of the ground rather than out of a workshop, and its appraisers are, by necessity, the best grave-readers in the region who are not calling themselves that. It resents the Consortium for setting the rate it must sell at, and says so only in private.'
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
            'The region\'s pill supply, and therefore the region\'s real power. Every formula above earth grade in its book was recovered rather than devised, and the Guild is quietly certain that the missing steps are why its heaven-grade batches fail as often as they do. Admission is by examination rather than combat, which makes it one of the few sects a low-Might cultivator can enter at the front.'
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
            'A blood-clan of smiths who cultivate fire because the work demands it. They arm half the region with reforged fragments ploughed out of fields, and they have opinions about how their swords are used, which is the origin of their long and expensive quarrel with the Azure Cloud Pavilion.'
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
            'A loose league of rogue cultivators with five ranks, no mountain, and no requirement beyond turning up. Most members dig for a living and sell what they find by weight. Nobody else will take a Qi Condensation nobody with a muddled root and no family, and the Wanderers know it, and price their instruction accordingly.'
    },
    {
        id: 'sect-frostmirror-court',
        name: 'Frostmirror Court',
        alignment: 'neutral',
        powerOrdinal: 35,
        ranks: ['Snow Servant', 'Mirror Disciple', 'Rime Disciple', 'Court Warden', 'Frost Elder', 'Court Sovereign'],
        admissionOrdinal: 13,
        stipend: [10, 30, 90, 300, 1_000, 3_000],
        teaches: [
            'bitter-frost-needle',
            'glacial-tomb-slash',
            'rimeglass-carapace',
            'frostmirror-displacement',
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
            'The only institution left holding a complete ice curriculum, because the ice curriculum was sealed in the glacier and the Court dug it out rather than inheriting it from teachers. It will not open its library to anyone without a mutated ice root - not out of malice, but because the arts kill everyone else. A mutated ice cultivator who finds this Court has found the one place their talent is not a death sentence. Most never find it.'
    },
    {
        id: 'sect-kiln-wardens',
        name: 'Kiln Wardens',
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
            'They guard the deep vein at the world\'s root - the one every other vein in the region is understood to branch from, though nobody outside the gate has been permitted to test that. They draw nothing from it. In an age where every institution is fighting over drawn-down holdings, a body of cultivators sitting on the richest ground in the world and taking none of it is the single most alarming fact anyone has established about them, and it is closely followed by the second: every formation node they hold is lit, which nobody else in the world can say.'
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
        teaches: [],
        signatureTechniqueId: null,
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
            'The holy ground of cultivation, and the only place in the world where the last realm is awake rather than sealed. What they are is not inertia and not four beings who reached the top and sat down: they are a collaboration, and possibly the only functioning one at that altitude in the history of the world. A crossing needs a dao protector - the cultivator is helpless for its whole duration - and almost nobody can obtain one, which is why everybody else attempts it in a cave nobody was told about. The Court holds multiple Tribulation Transcenders and at points several at Perfection at once, so it can do the one thing nobody else can: one crosses while the others stand guard. That single fact explains the rest of them. It is why they work at a published address on four known mountains rather than in hiding, because they have the thing secrecy is a substitute for. It is why presence is measured in decades of absence, because a protector has to be there. It is why the bar is a Void Refinement floor and evidence you could cross - a member is either somebody who will need protecting or somebody who can provide it, and there is no third contribution. And it is why they hold the best vein in existence and draw nothing from it: the vein is not what the work runs on. Six of their members have crossed, which by the world\'s own reckoning is the top of the lineage tiers and is the one objective claim about them nobody disputes. They may do it again in this era, and nobody outside the four knows it is being considered.'
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
            'The most coherent argument in the region, and it works. Their reasoning is that every crossing takes something eventually, so it should be paid deliberately: cut the bonds, the memories and the name in advance, at a time of your choosing, and cross every boundary clean. They climb faster than anyone. What arrives at the top is not really a person and does not pretend to be, and the Severed regard that objection as sentimental rather than incorrect.'
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
            'Pays four times what an orthodox sect pays and teaches the arts nobody else will, on the understanding that the Hall takes its tithe from someone and prefers that someone not be you. Recruits hardest among cultivators who have just been refused elsewhere, and keeps a list of who was refused where.'
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
            'cross-meridian-strike',
            'bark-armor-circulation',
            'crimson-tithe-palm',
            'corpse-lantern-soul-forging'
        ],
        signatureTechniqueId: 'corpse-lantern-soul-forging',
        specialities: ['forbidden', 'defense'],
        rivals: ['sect-verdant-spring-hall', 'sect-crimson-abyss-hall'],
        territory: 'Old battlefields, worked in rotation, in the third year after any large engagement.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 9,
            formationNodesLit: 2,
            remnant: 'A field wall of stacked fragments, sorted by weight rather than by what any of them used to be.'
        },
        description:
            'Corpse cultivators and grave-readers who follow wars at a respectful distance and harvest what is left, then sell the unusable remainder to farmers as hardcore. They are the best diggers in the region and the worst company. The Verdant Spring Hall hunts them on principle; the Crimson Abyss Hall hunts them over supply.'
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
            'molten-core-refinement-scripture',
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
            'The strongest openly demonic sect in the region, and the only one that does not pretend to be anything else. Its transformation art was recovered from the caldera it now occupies, along with the contract terms, which the sect provides to applicants in full. Elders are recognisable, late on, by what has stopped being human about them.'
    },
    {
        id: 'sect-storm-tyrant-court',
        name: 'Storm Tyrant Court',
        alignment: 'demonic',
        powerOrdinal: 36,
        ranks: ['Rod Bearer', 'Storm Servant', 'Arc Disciple', 'Thunder Warden', 'Storm Elder', 'Storm Tyrant'],
        admissionOrdinal: 9,
        stipend: [14, 45, 150, 500, 1_600, 5_000],
        teaches: [
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
            'Holds the world\'s only working lightning curriculum, recovered whole from the fragment it lives on, and rules by the simple expedient of being the only place a mutated lightning root can learn anything. The Court does not recruit so much as collect, and treats refusal as a scheduling matter.'
    },

    {
        id: 'sect-standing-grove',
        name: 'The Standing Grove',
        alignment: 'righteous',
        powerOrdinal: 27,
        ranks: ['Guest of the Grove', 'Disciple', 'Elder Disciple', 'Keeper of the Grove'],
        admissionOrdinal: 13,
        stipend: [20, 90, 400, 1_600],
        teaches: [
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
            'Six disciples, a valley, and a region eleven days across that does not encroach. The Grove administers what it can comfortably walk and claims nothing beyond it; everyone for a great distance further out simply knows the ground is theirs and has never wanted to find out what happens otherwise. It keeps no patrols, no register, no lease and no clients. It settles disputes nobody asked it to settle, refuses payment for it, and has killed twice in two hundred years, both times within nine days of being tested and in front of witnesses who were not asked to be there.'
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
            'Not a sect so much as an office that acquired a monopoly and never gave it back. The Weir holds the only two sites in the Marches where a cultivator can advance at all, and rents access by the day against a grant book that is public, itemised and completely discretionary. There is no rivalry here to speak of, because there is nothing to be rival about: everyone in the region is either holding a grant, waiting on one, or has been refused. A Weir Master at Core Formation is the strongest thing anyone in the Marches has seen, and outside the Marches would be a mid-ranking elder nobody sends for.'
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
            'A road militia that marks the safe ground and repaints the stakes, which in a region of dead zones is the single most valuable public service anyone performs. Its strongest Warden is at Foundation Establishment and would be an outer disciple at home. They take anyone, pay almost nothing, and lose two or three people a year to burn ground that moved. Their quarrel with the Weir Office is that the Office charges for grants and contributes nothing to the roads its grantees walk in on.'
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
            'Diggers. The catastrophe that emptied the Marches also sealed a great deal of it, and nobody strong enough to strip it properly has bothered to come, so the region\'s only real export is what the Company brings out of the burn zones. Losses run about one in nine a season. It is the best-paid work available to a Qi Condensation cultivator anywhere in the region and it is understood locally as a way of dying slightly later than the alternative.'
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
            'Karma read as a graph rather than a score. The Ledger holds that every connection between two entities persists, is inherited, and is eventually load-bearing, and it has been writing those connections down for four thousand years. Nobody in the region can settle an inheritance, prove a debt or open a succession without a Ledger auditor present, which is why a house with no war doctrine at all has never been attacked twice by the same sect.',
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
            'Fate read as pruning rather than prophecy. The House does not claim to know what will happen; it claims - correctly, and with three thousand years of case records - that at any moment only a few possibilities are load-bearing, and that it can tell you which. Rulers keep a Narrow Hour adviser the way they keep a physician, and for the same reason: not to be told the future, but to be told which of this month\'s decisions is the one that matters.',
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
            'Oaths made structural. A Bound Word witness does not threaten a party who breaks a promise; the promise is simply built into them afterwards, and removing it removes some of them with it. Every treaty in the region is in their vault, every sect succession is sworn in front of them, and no ruler has yet found a way to hold a border without them.',
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
            'The counter-house. Where the Ledger reads a connection and the Bound Word builds one, the Quiet Cut removes it: a debt, an oath, an inheritance, the fact that two people ever met. Their work is expensive, permanent, and impossible to appeal, and every institution that publicly wants them destroyed has privately used them. They are not liked. They are extremely busy.',
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
            'Names held in trust. When a crossing takes a name at a realm boundary, the person is left with people having to be told it, every time - and the House still has it, written down, in a register that the taking did not reach. They will give it back. Slowly, incompletely, and for a price set by what the client can be made to pay. Nobody has ever loved them and everybody uses them.',
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
            'Distance as a quantity that can be argued with. The House surveys, folds, stores and carries, and every courier route, storage ring, sect barrier and long trade contract in the region is priced off its figures. It has no political influence whatsoever, wants none, and is regarded by the other houses as a very large and very useful guild that happens to be five thousand years old.',
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
            'Fixity as a discipline. The Anchorhold holds the survey of record, the standard weights, the quarantine perimeters around forbidden ground, and the nails that keep four catastrophe sites from spreading. It is slow, immovable, unglamorous and completely indispensable, and it is the only house that can make an oath fail, a span close, and a sealed thing stay sealed.',
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
        probationOrdinal: 0,
        minMight: 2,
        preferredRoots: ['single_metal', 'dual_metal_wood'],
        requirement:
            'To be a disciple: Qi Condensation Layer 4 or better, and one clean strike shown to a Sword Elder. That bar has never moved and is not the door most people come through. The Pavilion also tests uncultivated mortals, takes the best of them onto probation at the very bottom of the ladder, and carries them for years before deciding - wide intake, narrow conversion, and the requirement above still waiting at the far end. See `AZURE_CLOUD_INTAKE` in `hierarchy.ts`.'
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

/**
 * Ancestral records, keyed by faction id, in the same style as
 * `SECT_ADMISSION`: content-side, stripped by `SectSchema.parse`, read at
 * request time.
 *
 * Almost every entry here is a wall of names. Three factions have something
 * dormant that is still in the world; two have a true ascended claim; one has
 * a claim that is simply false and has been working for four hundred years.
 */
export const SECT_ANCESTRY: Record<string, AncestralRecords> = {
    // ═══════════════════════════════════════════════════════════════════
    // THE PREEMINENT INSTITUTION OF THE PRESENT AGE
    // The last confirmed crossing in the world was this one. The Pavilion
    // is not the strongest sect by its living members - it is roughly the
    // fourth or fifth - and none of that matters, because of what is in
    // the vault and who might still be listening.
    // ═══════════════════════════════════════════════════════════════════
    'sect-azure-cloud-pavilion': {
        ancestors: [
            {
                name: 'Ru Anjing, Third Master of the Pavilion',
                fate: 'ascended',
                realmOrdinal: 45,
                yearsAgo: 380,
                afterCrossing: 'still_above',
                rememberedFor: 'The last confirmed crossing in the world. Spent her final eleven years divesting: every artifact, every manual, every stone, all of it into the sect, in a sequence the Pavilion recorded and has never published in full.'
            },
            {
                name: 'Ru Wenshi, Second Master',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 640,
                afterCrossing: null,
                rememberedFor: 'Held the gorge through two sieges and died of ordinary age at Deity Transformation, which the Pavilion considers a failure and says so at every memorial.'
            },
            {
                name: 'Kang Ye, founder',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 1_900,
                afterCrossing: null,
                rememberedFor: 'Took the gorge and the vein under it off a house whose name the Pavilion no longer records.'
            }
        ],
        claimsLivingAncestor: true,
        claimIsTrue: true,
        recency: 'recent',
        dormant: null,
        partingGift: {
            id: 'artifact-the-standing-edge',
            name: 'The Standing Edge',
            description:
                'A sword left point-down in the floor of the inner hall, which no living smith can account for and no formation master can read. It does not need drawing to be measured: standing in the room with it is how the Pavilion certifies that a visitor is who they say they are, because the Edge is unambiguous about it. Twice in three hundred and eighty years it has been drawn. Both times the argument stopped.',
            reserveTerms:
                'Held in reserve, never carried. The Pavilion Master may draw it only with four Sword Elders consenting in the same room, and the Pavilion has refused itself permission at least nine times, including once during a siege.',
            intact: true
        },
        lastOffering: {
            yearsAgo: 180,
            cost: 'The channel artifact, which did not survive the offering, plus eleven years of the Pavilion\'s accumulated reserves and its second vein holding, sold to the Stonewright Consortium to fund it.',
            response: 'Not yet.',
            consequence:
                'The Pavilion has declined three wars it was expected to fight, refused two alliances, and will not explain any of it. Every rival has spent a century trying to work out what the two words were about, and the Pavilion is aware that the ambiguity is worth more than the answer.'
        },
        discoverableTraces: [],
        standingNote:
            'Everyone defers, and several rivals resent it openly. The Ashen Forge Clan calls the deference "renting a dead woman", and a faction inside the Stonewright Consortium is quietly modelling what the region looks like the year the Edge is finally spent - a document that would end several careers if it were read aloud. What none of them has worked out is that the Pavilion is not living on what she left. She still answers, every nine to fourteen years, because her younger sister Ru Anxi is alive in the Pavilion at four hundred and forty-seven years old - so the stock rises rather than falls, all of it at the bottom of the range, and the clock under the strongest institution in the world is a Core Formation cultivator with perhaps fifty years left. Everybody senior has done that arithmetic. Nobody discusses it. See `crossings.ts`.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // TRUE CLAIM, ANCIENT, NOTHING LEFT
    // ═══════════════════════════════════════════════════════════════════
    'sect-sweptground-temple': {
        ancestors: [
            {
                name: 'The First Abbot, whose name the Temple did not record',
                fate: 'ascended',
                realmOrdinal: 45,
                yearsAgo: 2_600,
                afterCrossing: 'still_above',
                rememberedFor: 'Crossed from the plain outside the wall, having given away everything beforehand to people rather than to the Temple, which is why the Temple has no gift and says so.'
            },
            {
                name: 'Abbot Sheng',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 400,
                afterCrossing: null,
                rememberedFor: 'Refused a vein offered by the Clear River Alliance on the grounds that accepting it would change who applied.'
            }
        ],
        claimsLivingAncestor: true,
        claimIsTrue: true,
        recency: 'ancient',
        dormant: null,
        partingGift: null,
        lastOffering: {
            yearsAgo: 900,
            cost: 'Everything the Temple had, which was not much, and the Temple has never pretended it was a real offering.',
            response: null,
            consequence:
                'Nothing came back. The Temple recorded the silence in full, including the amount spent, and has not held another. It still teaches that the claim is true and does not press the point.'
        },
        discoverableTraces: [],
        standingNote:
            'The claim is true and almost nobody believes it, because the Temple is poor, sits on swept ground with no vein, and has no gift to show. It is the cheapest true claim in the world and it buys the Temple nothing at all.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // FALSE CLAIM, PURCHASED, AND WORKING
    // ═══════════════════════════════════════════════════════════════════
    'sect-thousand-treasure-pavilion': {
        ancestors: [
            {
                name: 'Wei Zhaoyin, "the Ascended Steward"',
                fate: 'lost',
                realmOrdinal: null,
                yearsAgo: 430,
                afterCrossing: null,
                rememberedFor: 'Recorded by the Pavilion as having crossed at the northern scar. Recorded by nobody else as having existed.'
            },
            {
                name: 'Mu Ganlu, first Grand Steward',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 610,
                afterCrossing: null,
                rememberedFor: 'Bought the Pavilion\'s first auction floor and its tablet hall in the same year, from the same estate.'
            }
        ],
        claimsLivingAncestor: true,
        claimIsTrue: false,
        recency: 'several_ages',
        dormant: null,
        partingGift: null,
        lastOffering: {
            yearsAgo: 120,
            cost: 'Publicly, four hundred thousand spirit stones and a heaven-grade reagent. In the Pavilion\'s own books, considerably less, and the reagent came back.',
            response: 'A name, which the Pavilion has never disclosed.',
            consequence:
                'The undisclosed name is the whole of the evidence, and it is unfalsifiable by design. Attendance at the offering was invitation-only and every invitee was a client.'
        },
        discoverableTraces: [
            'Wei Zhaoyin appears in no register, ledger or sect record outside the Pavilion\'s own, in a century when the House of Held Names was registering at all nine gates',
            'the northern scar is dated four hundred years older than the claimed crossing, and scars do not accumulate',
            'the Ninefold Ledger has twice declined to certify the lineage and the Pavilion has not asked a third time',
            'the tablet hall was bought complete, tablets included, from an estate sale the Ledger itself brokered and still has the paper for'
        ],
        standingNote:
            'It works. Nine cities treat the Pavilion as an ancient house, its bonds price accordingly, and the cost of the fraud is a standing incentive to keep the Ledger uninterested - which the Pavilion manages by being the Ledger\'s largest paying client.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // TRUE CLAIM, GIFT GONE, CLAIM DEFENDED
    // ═══════════════════════════════════════════════════════════════════
    'sect-storm-tyrant-court': {
        ancestors: [
            {
                name: 'The First Tyrant, styled the Standing Storm',
                fate: 'ascended',
                realmOrdinal: 45,
                yearsAgo: 3_400,
                afterCrossing: 'died_above',
                rememberedFor: 'Crossed from the floating stone, and left the Court the manual that is still the world\'s only working lightning curriculum. Three thousand four hundred years is a long time to be a Tyrant somewhere with its own politics, and he is not there any more. Nobody below the Lid knows that, and the Court would not believe it if told.'
            },
            {
                name: 'Yan Kuo, ninth Storm Tyrant',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 700,
                afterCrossing: null,
                rememberedFor: 'Held the tether through the century it began to fail, and did not report that it was failing.'
            },
            {
                name: 'The Standing Storm, the second of that name',
                fate: 'dormant',
                realmOrdinal: 40,
                yearsAgo: 900,
                afterCrossing: null,
                rememberedFor: 'Went into the floating stone rather than let it be brought down, and has been inside it ever since. The Court does not discuss him and has never landed the stone.'
            }
        ],
        claimsLivingAncestor: true,
        claimIsTrue: true,
        recency: 'several_ages',
        dormant: {
            name: 'The Standing Storm, the second of that name',
            restingPlace: 'Inside the floating stone itself, which the Court has never landed and never explains.',
            dormantYears: 900,
            realmOrdinal: 40,
            sealGrade: 'masterwork',
            sealReason: 'protector',
            wakeCondition:
                'The lightning curriculum is taken out of the Court by force, or the floating stone is brought down. Both have been attempted; neither got far enough to find out.',
            wakeCost:
                'He comes down with the stone and neither goes back up. The Court would keep the curriculum and stop being a Court, which the Sovereigns consider an acceptable trade and have said so in front of witnesses.',
            publiclyKnown: false
        },
        partingGift: {
            id: 'artifact-the-standing-storm-rod',
            name: 'The Standing Storm Rod',
            description:
                'The rod the ancestor left with the curriculum: the instrument the Court\'s whole doctrine was built to use, and the only object that made the tether serviceable.',
            reserveTerms:
                'Displayed once a generation at the succession of a Storm Tyrant. The last three successions were conducted with the vault closed and the rod described rather than shown.',
            intact: false
        },
        lastOffering: {
            yearsAgo: 1_100,
            cost: 'Two centuries of stores and the Court\'s second holding.',
            response: 'Hold the stone.',
            consequence:
                'The Court has held the stone, at increasing expense, for eleven hundred years, and can no longer repair the tether that holds it up.'
        },
        discoverableTraces: [
            'the rod has not been shown at a succession in three generations, and the Court now describes it instead',
            'a rod answering its description was sold through a Thousand Treasure auction two centuries ago by a seller the Pavilion will not name',
            'the Court has refused Ledger certification of its vault inventory four times, most recently in writing',
            'Frostmirror Court has offered to pay the Ledger\'s fee itself, which the Ledger has neither accepted nor declined'
        ],
        standingNote:
            'The claim is true, the gift is gone, and the Court is spending real resources to keep anyone from establishing the second fact. Frostmirror Court knows, cannot prove it, and would like it examined by somebody whose certification the world accepts.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // DORMANT: STILL IN THE WORLD, AND WAKEABLE
    // ═══════════════════════════════════════════════════════════════════
    'sect-nine-abyss-flame-sect': {
        ancestors: [
            {
                name: 'The Kindler, first Flame Sovereign',
                fate: 'dormant',
                realmOrdinal: 37,
                yearsAgo: 1_200,
                afterCrossing: null,
                rememberedFor: 'Took the caldera, signed the transformation contract in full, and went down into the vent rather than finish the terms above ground.'
            },
            {
                name: 'Sovereign Jiang Wu',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 300,
                afterCrossing: null,
                rememberedFor: 'Burned two allied sects to hold the bridge, and was not disciplined for it.'
            }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: {
            name: 'The Kindler',
            restingPlace: 'The vent under the caldera floor, behind a seal the sect maintains and has never opened.',
            dormantYears: 1_200,
            realmOrdinal: 37,
            sealGrade: 'sound',
            sealReason: 'final_breath',
            wakeCondition:
                'The caldera itself is breached, or a Flame Sovereign dies without a named successor. The sect has come within one death of the second condition twice.',
            wakeCost:
                'Whatever is left of the Kindler burns itself and the caldera together. The sect survives the waking as an institution and does not survive it as a place.',
            publiclyKnown: false
        },
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [
            'the sect maintains a seal at the vent and has no recorded reason for one',
            'the caldera bridge is kept in poor repair deliberately, which is defensive doctrine for a sect that is not afraid of being attacked',
            'two Sovereign successions in four hundred years were resolved in under a day, unusually fast for a demonic sect'
        ],
        standingNote:
            'Nobody outside the sect knows the Kindler is there. Its rivals price it as a strong demonic sect with a caldera, which is why the Ashen Forge Clan has twice pushed a border dispute further than it would have if it knew what was under the floor.'
    },
    'sect-frostmirror-court': {
        ancestors: [
            {
                name: 'The First Sovereign, called the Mirror',
                fate: 'dormant',
                realmOrdinal: 42,
                yearsAgo: 2_000,
                afterCrossing: null,
                rememberedFor: 'Dug the curriculum out of the glacier, taught it to nine people, and then lay down in the hall she had cleared.'
            },
            {
                name: 'Sovereign Bai Ning',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 500,
                afterCrossing: null,
                rememberedFor: 'Turned away forty applicants with clean roots and no ice, all of whom would have died learning it.'
            }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: {
            name: 'The Mirror',
            restingPlace: 'The cold hall itself, at the centre of the ice field, under a floor nobody sweeps.',
            dormantYears: 2_000,
            realmOrdinal: 42,
            sealGrade: 'masterwork',
            sealReason: 'final_breath',
            wakeCondition: 'The library is entered by force. Not theft, not trespass - force.',
            wakeCost:
                'She wakes cold and unhurried, and the Court\'s own hall does not survive it. The Court has written down that this is acceptable.',
            publiclyKnown: false
        },
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [
            'the Court fields a fraction of the defence its holdings warrant and has never lost the library',
            'two forced entries are recorded by outside parties; the parties are not recorded as having left'
        ],
        standingNote:
            'The Court is small, isolated and treated as a curiosity with a good collection. The Storm Tyrant Court, which has raided it twice and stopped, does not agree with that assessment and has not explained why.'
    },
    'house-anchorhold': {
        ancestors: [
            {
                name: 'Xu Ci, the Second Standing Anchor',
                fate: 'dormant',
                realmOrdinal: 33,
                yearsAgo: 700,
                afterCrossing: null,
                rememberedFor: 'Drove the replacement eastern nail personally, then had herself entombed under the datum stone rather than retire, on the argument that a nail should stay where it is.'
            },
            {
                name: 'The First Standing Anchor',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 900,
                afterCrossing: null,
                rememberedFor: 'Founded the house on the ruins of the Girdle, and wrote the official account of how that happened.'
            }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: {
            name: 'Xu Ci',
            restingPlace: 'Under the datum stone, in the chamber every measurement in the region is ultimately taken from.',
            dormantYears: 700,
            realmOrdinal: 33,
            sealGrade: 'crude',
            sealReason: 'final_breath',
            wakeCondition:
                'Two perimeters lost in a single season. One is a shortfall the house posts publicly; two is the condition.',
            wakeCost:
                'She rises, drives one nail, and does not come back up. The house has published this, in detail, in the survey standard, as a schedule.',
            publiclyKnown: true
        },
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote:
            'Publishing it is the point. The Anchorhold cannot pursue anyone and does not need to: every party that has considered testing a perimeter has read the schedule, and the two perimeters currently maintained below standard are watched by more people than the house employs.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // WALLS OF NAMES
    // Genealogy and hagiography. Nobody is coming back for any of these.
    // ═══════════════════════════════════════════════════════════════════
    'sect-verdant-spring-hall': {
        ancestors: [
            { name: 'Physician Lu Wan', fate: 'dead', realmOrdinal: null, yearsAgo: 1_100, afterCrossing: null, rememberedFor: 'Wrote the restoration method the Hall recovered from the valley ruin, or copied it; the Hall is honest that it cannot tell.' },
            { name: 'Hall Sovereign Ji Rou', fate: 'dead', realmOrdinal: null, yearsAgo: 260, afterCrossing: null, rememberedFor: 'Treated a Crimson Abyss envoy, billed him, and was killed for the second thing rather than the first.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'A tablet hall, well kept, of people who are entirely dead. The Hall\'s standing rests on its physicians, which it considers the correct arrangement.'
    },
    'sect-nine-peaks-ascetic-order': {
        ancestors: [
            { name: 'The Stone Bearer', fate: 'dead', realmOrdinal: null, yearsAgo: 1_600, afterCrossing: null, rememberedFor: 'Carried the founding stone over all nine peaks and never said why, which is now the admission requirement.' },
            { name: 'Patriarch Meng Da', fate: 'dormant', realmOrdinal: 31, yearsAgo: 800, afterCrossing: null, rememberedFor: 'Walked into the vein workings to survey them and did not come out. He is still down there, which the Order has surveyed to the depth of and has never accepted in words: the entrance has never been sealed and the ascetics tell it as a story.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: {
            name: 'Patriarch Meng Da',
            restingPlace: 'In the vein workings he walked into and did not come out of, at a depth the Order has surveyed and never opened.',
            dormantYears: 800,
            realmOrdinal: 31,
            sealGrade: 'crude',
            sealReason: 'protector',
            wakeCondition:
                'The vein is taken, or the workings are entered by anybody the Order did not send. The Order has never sealed the entrance, which outsiders read as confidence and is in fact the seal needing the airflow.',
            wakeCost:
                'He comes up, and the workings close behind him permanently. The Order would keep its mountain and lose the deepest vein in the province, which is the whole of what the Order is.',
            publiclyKnown: true
        },
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The Order\'s standing is the vein, and everybody knows it is the vein. Meng Da is a story the ascetics tell each other and do not offer to outsiders.'
    },
    'sect-clear-river-alliance': {
        ancestors: [
            { name: 'Old Shen of the Third Ford', fate: 'dead', realmOrdinal: null, yearsAgo: 300, afterCrossing: null, rememberedFor: 'Federated eleven ferry towns by refusing to carry anyone who would not sign.' },
            { name: 'River Elder Pei', fate: 'dead', realmOrdinal: null, yearsAgo: 90, afterCrossing: null, rememberedFor: 'Drowned holding a ford against a Thousand Treasure toll collection.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'Three hundred years of records and no ancestor above Core Formation. The Alliance says so plainly, which costs it nothing it was going to get anyway.'
    },
    'sect-lantern-hall': {
        ancestors: [
            { name: 'The First Keeper of Names', fate: 'dead', realmOrdinal: null, yearsAgo: 1_500, afterCrossing: null, rememberedFor: 'Began the counter-register by writing down what a crossing had taken from a man who could no longer say it himself.' },
            { name: 'Keeper Ao Shi', fate: 'dead', realmOrdinal: null, yearsAgo: 220, afterCrossing: null, rememberedFor: 'Published the crossing ledger of a sitting Grand Elder and was expelled from four cities for it.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The Hall records other people\'s ancestors with more care than its own, and is regularly accused of doing so to avoid the comparison.'
    },
    'sect-stonewright-consortium': {
        ancestors: [
            { name: 'Principal Hou Jian', fate: 'dead', realmOrdinal: null, yearsAgo: 780, afterCrossing: null, rememberedFor: 'Set the first published exchange rate between raw qi and cut stones, which is still the basis of every price in the region.' },
            { name: 'Rate-Setter Tuo Ming', fate: 'dead', realmOrdinal: null, yearsAgo: 150, afterCrossing: null, rememberedFor: 'Priced a vein sale that started a war, and collected the commission from both sides afterwards.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The Consortium treats ancestry as an asset class, values several sects\' claims internally, and has never claimed one of its own.'
    },
    'sect-cinnabar-crucible-guild': {
        ancestors: [
            { name: 'Grandmaster Xie Lan', fate: 'dead', realmOrdinal: null, yearsAgo: 900, afterCrossing: null, rememberedFor: 'Read a third of the method-script on the refining hall wall and built the guild on it.' },
            { name: 'Furnace Elder Bo', fate: 'dead', realmOrdinal: null, yearsAgo: 40, afterCrossing: null, rememberedFor: 'Died proving that the fourth line of the wall script is not a step in the method.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The Guild venerates the wall rather than its dead, which the other sects find distasteful and the Guild finds accurate.'
    },
    'sect-ashen-forge-clan': {
        ancestors: [
            { name: 'The First Hammer', fate: 'dead', realmOrdinal: null, yearsAgo: 1_400, afterCrossing: null, rememberedFor: 'Found the furnace already burning and built the compound around it rather than move it.' },
            { name: 'Clan Chief Duan Qi', fate: 'dead', realmOrdinal: null, yearsAgo: 170, afterCrossing: null, rememberedFor: 'Refused to arm the Azure Cloud Pavilion for a decade over a remark, and the clan is still poorer for it.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'A clan of smiths with a genealogy rather than a hagiography: they can name every ancestor and none of them is interesting.'
    },
    'sect-hollow-bell-wanderers': {
        ancestors: [
            { name: 'Whoever hung the first bell', fate: 'lost', realmOrdinal: null, yearsAgo: 200, afterCrossing: null, rememberedFor: 'Nothing. There is a bell at a crossroads and a practice of hanging more.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'No hall, no tablets, no ancestors worth the word. The Wanderers point out that this also means nobody inherits their debts.'
    },
    'sect-kiln-wardens': {
        ancestors: [
            { name: 'The First Keeper of the Kiln', fate: 'lost', realmOrdinal: null, yearsAgo: 4_000, afterCrossing: null, rememberedFor: 'Nothing the Wardens will state. Outside accounts do not agree on whether there was one.' },
            { name: 'The First Warden', fate: 'dormant', realmOrdinal: 44, yearsAgo: 3_100, afterCrossing: null, rememberedFor: 'Took the position at the world-heart and has not left it, which is why the watches are shaped the way they are and why every node the Wardens hold is lit. The Wardens state this in numbers when asked and have never elaborated.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: {
            name: 'The First Warden',
            restingPlace: 'At the world-heart, in the position the Wardens still stand their watches around, which is why the watches are shaped the way they are.',
            dormantYears: 3_100,
            realmOrdinal: 44,
            sealGrade: 'masterwork',
            sealReason: 'protector',
            wakeCondition:
                'The fire is found to have gone out, or to be going out. Nothing else, and the Wardens have never described what either would look like to somebody who was not one of them.',
            wakeCost:
                'Unstated. The Wardens do not explain themselves and have never been pressed on this by anybody in a position to insist.',
            publiclyKnown: false
        },
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [
            'the Wardens keep every one of their formation nodes lit, which no other institution in the world manages',
            'no Warden has ever been recorded as dying of age, and no Warden has ever been recorded as leaving'
        ],
        standingNote: 'The Wardens make no ancestral claim of any kind, and their refusal to make one is the most-discussed silence in the region.'
    },
    'sect-hollow-court': {
        ancestors: [
            { name: 'The one who went through first, whom the Court refers to only as that', fate: 'ascended', realmOrdinal: null, yearsAgo: 4_400, afterCrossing: null, rememberedFor: 'Crossing from the north mountain and completing it, and being the reason there is anybody on the other side who answers when the Court calls.' },
            { name: 'Five more in succession, named on no tablet outside the Court', fate: 'ascended', realmOrdinal: null, yearsAgo: 600, afterCrossing: null, rememberedFor: 'Crossing, one at a time, with the others standing protector - which is the arrangement that made all six possible and which nobody else in the world has ever been able to reproduce.' },
            { name: 'The four seated now', fate: 'dead', realmOrdinal: null, yearsAgo: 0, afterCrossing: null, rememberedFor: 'Nothing yet. They are still working, and they are the ancestors of nobody, having taken almost no disciples in six hundred years.' }
        ],
        claimsLivingAncestor: true,
        claimIsTrue: true,
        recency: 'recent',
        dormant: null,
        partingGift: null,
        lastOffering: {
            yearsAgo: 600,
            cost: 'Not stones and not materials. The Court spends attention, which is the only thing it has and the only thing it is short of, and an offering costs one of the four a stretch of work measured in decades.',
            response: 'Fragments about the approach.',
            consequence:
                'What comes back is knowledge of the crossing itself, from somebody who made it, and it is the only thing the Court wants and the one thing obtainable nowhere else. Very little of it is usable: answers from the far side of a boundary that strips everything arrive incomplete, oddly weighted, and sometimes plainly wrong in ways nobody below can check. That four beings have been working on it for four thousand years is the most accurate available statement about how good the information is.'
        },
        discoverableTraces: [],
        standingNote:
            'Six crossings across four thousand four hundred years puts them at the top of the lineage tiers by the world\'s own count, and their depletion is middling rather than severe despite that age for one reason: they only accept the best, so their members disproportionately cross. They are the one institution in the world that converts admissions into ancestors. See `crossings.ts` for the channel, the protector arrangement and the comparative lineage standings.'
    },
    'sect-the-severed': {
        ancestors: [
            { name: 'The First Cut', fate: 'lost', realmOrdinal: null, yearsAgo: 600, afterCrossing: null, rememberedFor: 'Cut every bond, memory and name in advance, and is recorded in the house ledger as an entry with the identifying columns blank.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [
            'the ledger entry is blank because the entry cut itself, which means the house cannot establish whether its founder crossed, died, or is presently a member'
        ],
        standingNote: 'The Severed cannot claim an ancestor, because the doctrine that makes them fast is the doctrine that makes ancestry unrecordable. They present this as proof of sincerity.'
    },
    'sect-crimson-abyss-hall': {
        ancestors: [
            { name: 'The First Abyss Lord', fate: 'dead', realmOrdinal: null, yearsAgo: 500, afterCrossing: null, rememberedFor: 'Opened the sinkhole hall and set the tithe at a rate the Hall has never raised.' },
            { name: 'Left Envoy Shu', fate: 'dead', realmOrdinal: null, yearsAgo: 60, afterCrossing: null, rememberedFor: 'Recruited two hundred refused applicants in one season, which is still the record.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The Hall pays well, dies young, and keeps short records. Nobody in it expects to be remembered and the arrangement is understood.'
    },
    'sect-bone-lantern-cult': {
        ancestors: [
            { name: 'The Pale Ancestor', fate: 'dead', realmOrdinal: null, yearsAgo: 700, afterCrossing: null, rememberedFor: 'Worked the third year after a war and established the rotation the Cult still follows.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The Cult keeps unusually good records of other people\'s dead and almost none of its own.'
    },
    'sect-standing-grove': {
        ancestors: [
            { name: 'The first Keeper, who planted nothing and cleared nothing', fate: 'dead', realmOrdinal: null, yearsAgo: 240, afterCrossing: null, rememberedFor: 'Settled a border war between two granted sects by walking into the middle of it unarmed and staying there for eleven days.' },
            { name: 'Keeper Wen Zhao', fate: 'dead', realmOrdinal: null, yearsAgo: 60, afterCrossing: null, rememberedFor: 'Answered the last test of the deference zone in nine days, visibly, and then went home and never referred to it again.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'Two hundred and forty years, four Keepers, and a wall of names short enough to read aloud in a minute. The Grove is respected for people rather than for an institution, which is exactly why it cannot afford a disgrace.'
    },
    'sect-weir-office': {
        ancestors: [
            { name: 'Warden Qiu Shen', fate: 'dead', realmOrdinal: null, yearsAgo: 220, afterCrossing: null, rememberedFor: 'Took the weir works during the resettlement, wrote the grant book, and never explained why access was to be rented rather than shared.' },
            { name: 'Weir Master Ho Lian', fate: 'dead', realmOrdinal: null, yearsAgo: 60, afterCrossing: null, rememberedFor: 'Reached Core Formation on Office grants, which remains the highest anyone has ever gone from inside the Marches.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'Two hundred years of records and one Core Formation cultivator in all of it. The Office does not claim ancestors and would not be believed if it did.'
    },
    'sect-sixmile-wardens': {
        ancestors: [
            { name: 'The first Marker, name not recorded', fate: 'dead', realmOrdinal: null, yearsAgo: 190, afterCrossing: null, rememberedFor: 'Walked the burn edge until it killed her, painting stakes, and the survey she left is still the basis of every safe route in the region.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'No hall, no tablets, and a survey shed. The Wardens count their dead by the stakes those people were painting when the ground took them.'
    },
    'sect-gleaners-company': {
        ancestors: [
            { name: 'Company Master Bo Ai', fate: 'dead', realmOrdinal: null, yearsAgo: 140, afterCrossing: null, rememberedFor: 'Established the rotation that keeps a burn zone unworked for nine years between passes, which halved the losses and is still resented.' },
            { name: 'Deep Gleaner Xun', fate: 'lost', realmOrdinal: null, yearsAgo: 30, afterCrossing: null, rememberedFor: 'Went through the sealed part of the sorting-yard ruin on a wager and did not come back. The Company sealed it again and raised the wager.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'A trade company with a mortality table instead of a genealogy, and it can quote the table from memory.'
    },
    'house-ninefold-ledger': {
        ancestors: [
            { name: 'First Keeper Yan Duo', fate: 'dead', realmOrdinal: null, yearsAgo: 2_290, afterCrossing: null, rememberedFor: 'Founded the Ledger the year after the Tally Court ended, having been one of its auditors.' },
            { name: 'Circuit Arbiter Tang Wei', fate: 'dead', realmOrdinal: null, yearsAgo: 400, afterCrossing: null, rememberedFor: 'Established that a debt survives the death of the borrower, in a ruling every sect now relies on and several have tried to overturn.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The Ledger certifies other houses\' ancestral claims and has never asserted one, which its rivals describe as prudence and it describes as method.'
    },
    'house-narrow-hour': {
        ancestors: [
            { name: 'The First Sighting', fate: 'dead', realmOrdinal: null, yearsAgo: 3_180, afterCrossing: null, rememberedFor: 'Established that possibilities narrow, and that the narrowing is the only part worth reading.' },
            { name: 'Reader Cao Yin', fate: 'dead', realmOrdinal: null, yearsAgo: 300, afterCrossing: null, rememberedFor: 'Sighted the year of the scar, said nothing publicly, and left the house a sealed account that does not match what happened.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The House holds that an ancestor who crossed is by definition outside the convergence and therefore not worth sighting for, which is either doctrine or sour grapes.'
    },
    'house-bound-word': {
        ancestors: [
            { name: 'The First Oathwright', fate: 'dead', realmOrdinal: null, yearsAgo: 3_780, afterCrossing: null, rememberedFor: 'Swore the house\'s founding oath, which is still binding and is why the house cannot witness for the Severed.' },
            { name: 'Warden of Terms Lin Ke', fate: 'dead', realmOrdinal: null, yearsAgo: 500, afterCrossing: null, rememberedFor: 'Read a treaty back to two sects until both withdrew from a war they had already started.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The house is bound by its own ancestors more literally than any other institution, and regards the arrangement as the point rather than the cost.'
    },
    'house-quiet-cut': {
        ancestors: [
            { name: 'Unrecorded', fate: 'lost', realmOrdinal: null, yearsAgo: 1_900, afterCrossing: null, rememberedFor: 'The house cuts its own founding records as a matter of doctrine, and does not know who started it.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'No ancestors, deliberately. It is the only house that treats having no ancestral claim as a demonstration of competence.'
    },
    'house-held-names': {
        ancestors: [
            { name: 'First Register Gu Yao', fate: 'dead', realmOrdinal: null, yearsAgo: 2_690, afterCrossing: null, rememberedFor: 'Held a name through a crossing and gave most of it back, which is the founding demonstration and the house\'s entire product.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'The house holds twenty thousand names of people who are not coming back, and is careful never to describe any of them as its ancestors.'
    },
    'house-measured-span': {
        ancestors: [
            { name: 'The Long Measure', fate: 'dead', realmOrdinal: null, yearsAgo: 4_900, afterCrossing: null, rememberedFor: 'Wrote both distances for the first time, walked and true, and the survey has been argued from ever since.' },
            { name: 'Keeper Fu Zhen', fate: 'lost', realmOrdinal: null, yearsAgo: 1_400, afterCrossing: null, rememberedFor: 'Went through a terminal in the year the gates closed and has not been reported since. Four terminals open somewhere breathable.' },
            { name: 'Ke Yuan, who set the datum', fate: 'dormant', realmOrdinal: 39, yearsAgo: 2_400, afterCrossing: null, rememberedFor: 'Set the first survey marker the house ever drove and then lay down under it, on the reasoning that a datum somebody is holding does not drift. The shed above him has a tiled roof that is repaired on a schedule and nobody outside the house has ever asked why.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: {
            name: 'Ke Yuan, who set the datum',
            restingPlace: 'Under the first survey marker the house ever drove, in a shed with a tiled roof that is repaired on a schedule.',
            dormantYears: 2_400,
            realmOrdinal: 39,
            sealGrade: 'sound',
            sealReason: 'final_breath',
            wakeCondition:
                'The datum itself is moved, or is proved to have moved. The house maintains that the second is impossible and audits for it quarterly anyway.',
            wakeCost:
                'He re-sets the datum once and does not survive doing it. Every measurement the house holds would then be referred to a mark nobody living watched him place, which the house regards as the worse half of the loss.',
            publiclyKnown: true
        },
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [
            'the Long Measure faction maintains that Fu Zhen is alive on the far side of a closed terminal, which is not an ancestral claim and is treated as one'
        ],
        standingNote: 'The house has no ancestral claim and a persistent internal argument about whether it should be making one.'
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
    /** Sects that take them. Holding one is a mark of standing, not a chore. */
    fosteredTo: readonly string[];
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
    fosteredTo: [
        'sect-azure-cloud-pavilion',
        'sect-nine-peaks-ascetic-order',
        'sect-sweptground-temple',
        'sect-lantern-hall'
    ],
    returnOrdinal: 29,
    returnByAge: 250,
    assessment:
        'The same assessment a stranger gets, conducted by the same seated member, on the same afternoon it would have been given to a stranger. Nobody has ever been told the result gently.',
    otherwise:
        'They stay where they were raised, at or near the top of it. A fostered Court child who does not go back is typically an elder somewhere reputable by the middle of their life, is treated with a deference the sect cannot quite account for, and is the single most reliable source in the province on what the Court is actually like - which is worth a great deal to people who will never get closer than that.'
};

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

export const WITHDRAWN_POWERS: Record<string, WithdrawnPower> = {
    'sect-hollow-court': {
        count: 4,
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
