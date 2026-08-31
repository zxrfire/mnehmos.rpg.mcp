/**
 * Sects — the social layer, and the only reliable source of manuals, stipends,
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
 * hundred; the sect has eleven disciples. Nobody finds this remarkable — it is
 * simply what a sect is, in an age that is breathing ash the ancients already
 * used.
 *
 * The five standing powers of the Vault — the Ashwright Consortium, Lantern
 * Hall, the Severed, the Hollow Court and the Kiln Wardens — are in this
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
    /** One small, legible remnant. Not grandiose — a detail, at human scale. */
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

export const SECTS: readonly SectEntry[] = [
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
            remnant: 'Six nodes, all of them lit, all of them cut by the Temple\'s own hands, all of them weak — and the only complete working formation in the province.'
        },
        description:
            'Takes orphans, beggars, muddled roots and anyone else the good sects turn away, and asks for nothing but the work. It is the rarest thing in the region: a compound its occupants actually built, on thin ground nobody else wanted, running six modest nodes it fully understands. Almost everything it teaches is elementless, which is the point — a temple that only accepted clean roots would be a temple for other people.'
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
        rivals: ['sect-ashwright-consortium', 'sect-the-severed'],
        territory: 'Reading halls in nine cities, and a stack room under each one that is larger than the hall above it.',
        recruits: true,
        compound: {
            inherited: true,
            formationNodesTotal: 30,
            formationNodesLit: 17,
            remnant: 'Ledgers in a hand nobody writes in any more, recording names of people who no longer possess them, indexed by the date the name came down.'
        },
        description:
            'Archivists. They catch what falls and write it down — the names, the faces, the lives of people who paid them at a realm boundary and were then told about it. Their position is that ascension is theft and that a world running on stolen memory is a world eating itself. They are correct, which has made them extremely unpopular, and they will read your ledger back to you whether or not you asked.'
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
            remnant: 'The great furnace itself, which the clan maintains, feeds and has never lit from cold — nobody knows the starting method, so it has not been allowed to go out in eleven generations.'
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
            'The only institution left holding a complete ice curriculum, because the ice curriculum was sealed in the glacier and the Court dug it out rather than inheriting it from teachers. It will not open its library to anyone without a mutated ice root — not out of malice, but because the arts kill everyone else. A mutated ice cultivator who finds this Court has found the one place their talent is not a death sentence. Most never find it.'
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
        rivals: ['sect-lantern-hall', 'sect-sweptground-temple'],
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
    const cap = Math.max(0, Math.min(44, Math.floor(ordinal)));
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
export function formationIntegrity(sectId: string): number {
    const sect = requireSect(sectId);
    if (sect.compound.formationNodesTotal === 0) return 0;
    return sect.compound.formationNodesLit / sect.compound.formationNodesTotal;
}
