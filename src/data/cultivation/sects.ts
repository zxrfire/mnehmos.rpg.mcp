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
 * simply what a sect is, in an age that is breathing ash the ancients already
 * used.
 *
 * The five standing powers of the Vault - the Ashwright Consortium, Lantern
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
        powerOrdinal: 24,
        ranks: ['Sword Servant', 'Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Sword Elder', 'Pavilion Master'],
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
        territory: 'Terraced peaks above Low Fall gorge, three days east of the trade road.',
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
        territory: 'A terraced herb valley fed by nine warm springs, four of which were plumbed by somebody else.',
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
        territory: 'Nine linked peaks over the deepest unbreathed vein anyone has surveyed and kept.',
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
        territory: 'Eleven river towns and every ford between them, including four bridges nobody can date.',
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
        rivals: ['sect-ashwright-consortium', 'sect-the-severed', 'house-held-names'],
        territory: 'Reading halls in nine cities, and a stack room under each one that is larger than the hall above it.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 30,
            formationNodesLit: 17,
            remnant: 'Ledgers in a hand nobody writes in any more, recording names of people who no longer possess them, indexed by the date the name came down.'
        },
        description:
            'Archivists. They catch what falls and write it down - the names, the faces, the lives of people who paid them at a realm boundary and were then told about it. Their position is that ascension is theft and that a world running on stolen memory is a world eating itself. They are correct, which has made them extremely unpopular, and they will read your ledger back to you whether or not you asked.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // NEUTRAL
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'sect-ashwright-consortium',
        name: 'Ashwright Consortium',
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
        territory: 'Refining houses at every large fall site, and the exchange rate, which is the real territory.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 55,
            formationNodesLit: 34,
            remnant: 'Presses that compress settled ash into stones, of a design the Consortium repairs constantly and has never once managed to build a new one of.'
        },
        description:
            'The closest thing the Vault has to a functioning state. They refine ash into spirit stones and set the rate, which means they set the price of everything else, including medicine and including a life. Not evil; simply incapable of seeing a falling life as anything but throughput. Their quarrel with Lantern Hall is that the Hall keeps writing down whose life it was.'
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
        rivals: ['sect-clear-river-alliance', 'sect-cinnabar-crucible-guild', 'sect-ashwright-consortium'],
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
        ranks: ['Coal Hand', 'Smith', 'Forge Disciple', 'Hammer Master', 'Ash Elder', 'Clan Chief'],
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
        territory: 'A glacier court above the snowline that appears on no accurate map.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 44,
            formationNodesLit: 26,
            remnant: 'A hall kept cold enough that the ash on its floor has never been breathed, swept into drifts against the walls by nobody, for an unknown length of time.'
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
        territory: 'The world-heart, and a perimeter of nine days\' walk in every direction that nobody has surveyed twice.',
        recruits: false,
        compound: {
            inherited: true,
            formationNodesTotal: 900,
            formationNodesLit: 900,
            remnant: 'A gate. It is not large. Everything else the Wardens hold is behind it, and the gate is the only part any outsider has described.'
        },
        description:
            'They guard the world-heart, where the fire that fired the Vault is either still burning or has not been checked in a long time. They do not explain themselves and they do not recruit. Every formation node they hold is lit, which is the single most alarming fact anyone has established about them, because nobody else in the world can say that.'
    },
    {
        id: 'sect-hollow-court',
        name: 'The Hollow Court',
        alignment: 'neutral',
        powerOrdinal: 40,
        ranks: ['Guest of the Court', 'Seated', 'Second Seat', 'First Seat'],
        admissionOrdinal: 37,
        stipend: [500, 1_500, 4_000, 12_000],
        teaches: [],
        signatureTechniqueId: null,
        specialities: ['defense'],
        rivals: [],
        territory: 'Four mountains, one occupant each, and a great deal of quiet in between.',
        recruits: false,
        compound: {
            inherited: true,
            formationNodesTotal: 200,
            formationNodesLit: 41,
            remnant: 'Stone seats arranged for an audience of two hundred, occupied by four people who have not moved them.'
        },
        description:
            'Grand Ascension cultivators who reached the Lid and refused to step through. They have nothing left worth taking, which makes them nearly invincible and almost entirely inert. They will answer a direct question honestly, since honesty costs them nothing now, and they will not get up to do it. They do not admit members; the four seats were filled by people who arrived already qualified.'
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
            'The most coherent argument in the Vault, and it works. Their reasoning is that the toll will be collected eventually, so it should be paid deliberately: cut the bonds, the memories and the name in advance, at a time of your choosing, and cross every boundary clean. They climb faster than anyone. What arrives at the top is not really a person and does not pretend to be, and the Severed regard that objection as sentimental rather than incorrect.'
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
        territory: 'A caldera fortress reached by one bridge, kept in poor repair on purpose.',
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
        territory: 'A floating stone over a permanent storm, tethered to the peak it broke off.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 71,
            formationNodesLit: 23,
            remnant: 'The tether itself: a chain of unknown make holding a mountain fragment in the air, which the Court inspects annually and cannot repair.'
        },
        description:
            'Holds the world\'s only working lightning curriculum, recovered whole from the fragment it lives on, and rules by the simple expedient of being the only place a mutated lightning root can learn anything. The Court does not recruit so much as collect, and treats refusal as a scheduling matter.'
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
            'concealment, and the detection of it'
        ],
        services: [
            'circuit arbitration of debts and inheritance, for a fee scaled to the sum in dispute',
            'audits of a claimed lineage, accepted as proof by every righteous sect in the region',
            'investigators hired to establish who benefited from a death',
            'sealed escrow of obligations that outlive their parties'
        ],
        dependents: [
            'sects settling succession after an elder dies without naming a heir',
            'the Ashwright Consortium, whose entire lending business rests on Ledger enforcement',
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
                'The Tally Court had begun entering the Vault itself as a debtor - the toll recorded as a taking, with the Lid as the party in arrears - and had got far enough to name what was owed. The Ledger\'s founders were Tally Court auditors. They ended the Court, burned the seat, kept the volumes, and have not opened them since.',
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
            'the Ashwright Consortium, for contracts it cannot underwrite on trust',
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
            'the Vault clerks, who quietly think a third of the standing treaties should be allowed to lapse'
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
            'Names held in trust. When the Vault takes a name at a realm boundary, the person is left with people having to be told it, every time - and the House still has it, written down, in a register that the taking did not reach. They will give it back. Slowly, incompletely, and for a price set by what the client can be made to pay. Nobody has ever loved them and everybody uses them.',
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
            'It was ended by its own auditors, who founded the Ninefold Ledger the following year and kept the volumes. What the Court had been doing when it was ended was entering the Vault as a debtor and totalling what the toll had taken.',
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
        minMight: 2,
        preferredRoots: ['single_metal', 'dual_metal_wood'],
        requirement: 'Qi Condensation Layer 4 or better, and one clean strike shown to a Sword Elder.'
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
    'sect-ashwright-consortium': {
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
        minOrdinal: 37,
        preferredRoots: [],
        requirement: 'Grand Ascension, and nothing left that anyone could use against you. The Court does not admit; it notices.'
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
