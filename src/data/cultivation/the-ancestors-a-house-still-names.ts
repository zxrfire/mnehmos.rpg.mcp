/**
 * The ancestors a house still names, and what is actually left of them.
 */

import { TRUE_IMMORTAL_ORDINAL } from '../../engine/cultivation/realms.js';

/**
 * What became of somebody after they crossed.
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
     * What they stood at, or null where the record does not say - which is most of
     * them. A wall of tablets is genealogy, and genealogy does not keep realms.
     * Only the ancestors who are still load-bearing (ascended, or sealed and
     * wakeable) are recorded, because those are the two cases where somebody had to
     * be able to afford it.
     */
    realmOrdinal: number | null;
    /** Years since the death, the crossing, or the sealing. */
    yearsAgo: number;
    /**
     * Set only where `fate` is 'ascended'. Null everywhere else.
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
 */
export type SealGrade = 'crude' | 'sound' | 'masterwork';

/**
 * Why somebody is under a mountain, which decides what waking them costs.
 */
export type SealReason = 'protector' | 'final_breath';

export interface DormantAncestor {
    /**
     * Optional, and the difference between a weapon and a gamble.
     */
    whoHeIs?: string;
    sealedBeforeTheCrossing?: string;
    andHeKnowsWhatHeIsFor?: string;
    andTheResourcesWentSomewhere?: string;
    name: string;
    /** Where they are, in one concrete line. */
    restingPlace: string;
    dormantYears: number;
    /**
     * THIS IS NOT THE SECT'S `powerOrdinal`, AND MUST NEVER BE FOLDED INTO IT.
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
    /**
     * Arts that came down with it, by id, and usually none.
     */
    techniqueIds: readonly string[];
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

/**
 * Ancestral records, keyed by faction id, in the same style as `SECT_ADMISSION`:
 * content-side, stripped by `SectSchema.parse`, read at request time.
 */
export const SECT_ANCESTRY: Record<string, AncestralRecords> = {
    // THE PREEMINENT INSTITUTION OF THE PRESENT AGE The last confirmed crossing in
    // the world was this one. The Pavilion is not the strongest sect by its living
    // members - it is roughly the fourth or fifth - and none of that matters,
    // because of what is in the vault and who might still be listening.
    'sect-azure-cloud-pavilion': {
        ancestors: [
            {
                name: 'Ru Anjing, Third Master of the Pavilion',
                fate: 'ascended',
                realmOrdinal: TRUE_IMMORTAL_ORDINAL,
                yearsAgo: 380,
                afterCrossing: 'still_above',
                rememberedFor: 'The last confirmed crossing in the world. Spent her final eleven years divesting: every artifact, every manual, every stone, all of it into the sect, in a sequence the Pavilion recorded and has never published in full.'
            },
            {
                name: 'Xie Wangchen, Fourth Sword Elder',
                fate: 'dormant',
                realmOrdinal: 41,
                yearsAgo: 380,
                afterCrossing: null,
                rememberedFor:
                    'Struck himself from the roll in the year Ru Anjing crossed and is recorded nowhere else in the sect\'s papers. The public account is that he left. Four people at the Pavilion know that he went under the inner hall instead, at the last realm, by an arrangement she made and did not explain, and the Pavilion has never corrected the account because the account is worth more than the truth.'
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
        // The thing every reading of this house has left out, and the reason an
        // apex resting on one woman has never been tested. Ru Anjing spent eleven
        // years divesting into the sect and the Pavilion has never published the
        // sequence in full; this is what is not in the published part. It is a
        // protector rather than a final breath - sealed while whole, deliberately,
        // by somebody who could see what she was leaving her sister to hold alone.
        dormant: {
            name: 'Xie Wangchen, Fourth Sword Elder, struck from the roll in his own hand',
            restingPlace:
                'Under the inner hall, on the gorge vein, in the chamber Ru Anjing had cut in the last of the eleven years and gave no reason for. The Pavilion runs an open outer courtyard and a public rank ladder and has never once let anybody below Sword Elder into that part of the mountain, which the province reads as ordinary vault discipline.',
            // The three facts that make a sealed protector worth anything, and
            // which most houses holding one cannot supply. A weapon whose
            // loyalty is a question is not a weapon.
            whoHeIs:
                'Level with Ru Anwei rather than above her, which is the part that surprises people who expect a reserve to be a bigger version of the house. It is not a bigger version of anything: it is a second person at the last realm in a house everybody has counted as having one, and doubling one is the largest proportional change available to any faction in the setting. Ru Anjing\'s closest friend for two hundred years, and Ru Anwei\'s senior - he taught her the third form and was at the Pavilion four decades before she was born. He is not an inheritance, a bound servant or a name on a stone: he went under while the sect was at peace, whole, at forty-three, with two centuries of the road still in front of him, and did it as one item in a plan the woman he was closest to was assembling and did not finish explaining. Whatever else is uncertain about the Pavilion, nothing about his motivation is, which is the single rarest property a sealed ancestor can have.',
            sealedBeforeTheCrossing:
                'This is the load-bearing date, and the eleven years are not what the province thinks they were. Ru Anjing did not simply divest into the sect: she picked one man, spent years of the Pavilion\'s output moving him up the ladder without a single entry appearing anywhere, cut a chamber, and put him under - all of it before she crossed, all of it in secret, and none of it explained to anybody who is still alive to ask. The generosity everybody remembers was the visible half of a plan. The other half is forty-two and asleep on the gorge vein.',
            andTheResourcesWentSomewhere:
                'Which is also the answer to a question the Jade Gorge has been asking for three hundred and eighty years without knowing it was a question. Ru Anjing\'s divestment is recorded, the sequence is not published in full, and the recorded part has never quite added up - a decade of an apex\'s output is a great deal to account for, and the Pavilion has never been asked to account for it because asking would be rude to a story everybody enjoys. It went into a breakthrough nobody witnessed, for a man whose name was taken off the roll in his own hand, and it is still sitting under the inner hall drawing interest.',

            andHeKnowsWhatHeIsFor:
                'He agreed to it knowing what waking costs and what it would mean about the day it happened, which is why the seal is keyed to Ru Anwei rather than to the mountain. He is not guarding a vault. He is waiting on one specific piece of news about one specific person, and the four people who know he is down there have never had to wonder whether he would come up angry or confused, which is what everybody else holding one of these quietly does.',
            dormantYears: 380,
            realmOrdinal: 41,
            sealGrade: 'masterwork',
            sealReason: 'protector',
            wakeCondition:
                'The inner hall is entered by anybody the Pavilion did not admit, or Ru Anwei stops holding the Edge - by death, by its loss, or by leaving the mountain with it. Nobody has established which of those the seal is actually keyed to, including the four people who know it exists.',
            wakeCost:
                'Everything, once. He comes up at forty-one into a house whose entire position is that nobody can price it, and the moment he is seen the price is public: the Pavilion stops being an unknown quantity and becomes a known one, which is the exact asset Ru Anjing spent her last decade buying. He would win the day and end the arrangement that made the day survivable.',
            publiclyKnown: false
        },
        partingGift: {
            id: 'artifact-the-standing-edge',
            name: 'The Standing Edge',
            description:
                'A sword left point-down in the floor of the inner hall, which no living smith can account for and no formation master can read. It does not need drawing to be measured: standing in the room with it is how the Pavilion certifies that a visitor is who they say they are, because the Edge is unambiguous about it. Twice in three hundred and eighty years it has been drawn. Both times the argument stopped.',
            reserveTerms:
                'Held in reserve, never carried. The Pavilion Master may draw it only with four Sword Elders consenting in the same room, and the Pavilion has refused itself permission at least nine times, including once during a siege.',
            intact: true,
            /**
             * The sword was one item and it was not the last one.
             */
            techniqueIds: [
                // The two decrees. She had them and did not use either, which is
                // the most eloquent thing in her estate: the Pavilion holds the two
                // most dangerous sentences anybody has ever written down and cannot
                // read a word of them, because an art buys nothing across the Lid at
                // any mastery. Five writings, no province, no medicine.
                'the-road-that-was-always-there',
                'the-witness-who-was-always-there',
                'one-crossing-of-a-courtyard',
                'canon-of-the-unwritten-span',
                'the-fifteenth-breath'
            ]
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
            'Everyone defers, and several rivals resent it openly. The Ashen Forge Clan calls the deference "renting a dead woman", and a faction inside the Stonewright Consortium is quietly modelling what the region looks like the year the Edge is finally spent - a document that would end several careers if it were read aloud. What none of them has worked out is that the Pavilion is not living on what she left. She still answers, every nine to fourteen years, because her sister Ru Anwei is alive in the Pavilion and is the person she answers for - so the stock rises rather than falls, all of it at the bottom of the range. What sits under it is not a clock, it is a position: the income is attached to one named living woman rather than to the mountain, and anybody who wanted it would not have to take the Pavilion, only reach her. She stands at the first rung of the last realm, which is not nothing and is not the same order of thing as what she is standing in front of. Everybody senior has done that arithmetic. Nobody discusses it. See `crossings.ts`.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // TRUE CLAIM, ANCIENT, NOTHING LEFT
    // ═══════════════════════════════════════════════════════════════════
    'sect-sweptground-temple': {
        ancestors: [
            {
                name: 'The First Abbot, whose name the Temple did not record',
                fate: 'ascended',
                realmOrdinal: TRUE_IMMORTAL_ORDINAL,
                yearsAgo: 2_600,
                afterCrossing: 'still_above',
                rememberedFor: 'Crossed from the plain outside the wall, having given away everything beforehand to people rather than to the Temple, which is why the Temple has no gift and says so. He is still up there and has not answered in a very long time, because he is in meditation and has been for most of it. He might: it would take a coincidence of factors nobody can arrange on purpose, and the Temple has never tried to arrange one. It does not know any of this and says it does not.'
            },
            {
                name: 'Abbot Sheng',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 400,
                afterCrossing: null,
                rememberedFor: 'Refused a vein offered by the Clear River Fordhall on the grounds that accepting it would change who applied.'
            }
        ],
        claimsLivingAncestor: true,
        // Correct, and held with no more evidence than the Court has for being
        // wrong. Both are guessing; only one happens to be right.
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
                realmOrdinal: TRUE_IMMORTAL_ORDINAL,
                yearsAgo: 3_400,
                afterCrossing: 'still_above',
                rememberedFor: 'Crossed from the floating stone, and left the Court the manual that is still the world\'s only working lightning curriculum. Three thousand four hundred years is a long time to be a Tyrant somewhere with its own politics, and he has not answered in nine hundred years. He is still up there. The Court reads the silence as the ordinary indifference of somebody with better things to do, which is both the reading that costs it nothing and, as it happens, correct - and it has no way whatsoever to establish that.'
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
            intact: false,
            // The curriculum came down with the rod and the Court has taught it
            // ever since, so those arts are in `teaches` where a taught art
            // belongs. Nothing else came down that the Court cannot already
            // hand a disciple.
            techniqueIds: []
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
    // THE HOUSE WITH NOTHING ABOVE IT AND NO CLAIM TO ONE.
    'sect-orchid-court': {
        ancestors: [
            {
                name: 'Xue Yinniang, who went down',
                fate: 'dead',
                realmOrdinal: 31,
                yearsAgo: 140,
                afterCrossing: null,
                rememberedFor: 'Took the household off the ice, refused the grant in writing, and died on the valley floor nine years later without having explained either decision to anybody outside it.'
            },
            {
                name: 'Mu Zhaoying',
                fate: 'dead',
                realmOrdinal: 28,
                yearsAgo: 300,
                afterCrossing: null,
                rememberedFor: 'Held the band the house was born at through two retreats and lost it twice, which is what made going down thinkable a lifetime later.'
            },
            {
                name: 'The Frost Watch nobody named',
                fate: 'dead',
                realmOrdinal: null,
                yearsAgo: 420,
                afterCrossing: null,
                rememberedFor: 'Cut the first bed below the face against her own house\'s instruction and was put out of it for a year. The Court reads her name at the setting and has never recovered what it was.'
            }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'recent',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        // Empty because the claim is honest. The Court names three dead women
        // and claims nothing above them, so there is nothing for an auditor to
        // find that does not match.
        discoverableTraces: [],
        standingNote:
            'Nobody treats the Court as a house with a lineage, because it does not present as one: it names three dead women, none of them above Void Refinement, and stops. In a province with no register that costs it nothing, and two provinces away it is the reason nobody has ever thought the valley worth a second question. A house claiming nothing is a house nobody audits.',
    },
    'sect-frostmirror-court': {
        ancestors: [
            // THE DEAD FORTY-SIX, AND THE ONLY ONE IN THE CATALOG.
            {
                name: 'Sovereign Yun Cangyi, who went up from the working face',
                fate: 'ascended',
                realmOrdinal: TRUE_IMMORTAL_ORDINAL,
                yearsAgo: 1_400,
                afterCrossing: 'died_above',
                rememberedFor: 'Crossed from the working face with the glacier at its greatest recorded extent, and sent one object down in the century after. She is dead. What killed her is not recorded anywhere on this side and would not be: the far side is not a place anybody here has an account of, and the only thing the record carries is that the sending stopped. The Court reads the stop as the object at this end failing, because the object at this end did fail, in public, and the two events are close enough together in its own annals to look like one.'
            },
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
        // The claim is made and the claim is wrong, which is a state the
        // catalog had nowhere else. The Thousand Treasure Pavilion holds a
        // false claim because it bought somebody else's; this house holds one
        // because its own ancestor died where nobody could see it happen.
        // `auditAncestralClaim` is what exposes the difference, and it needs
        // no new machinery to do it.
        claimsLivingAncestor: true,
        claimIsTrue: false,
        // The object came down within a century of the crossing and there has
        // been nothing since, so what the house holds is a claim and a gap.
        recency: 'several_ages',
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
        lastOffering: {
            yearsAgo: 300,
            cost: 'Eleven years of the Court\'s reserves and the working face left unquarried for two of them, which for a house this size was most of what it had to spend.',
            response: null,
            consequence:
                'Nothing came back, and the Court filed the silence as a failure of the instrument rather than as an answer - which is the reading its own loss makes available and the only one anybody here has ever proposed. It has not held another and has not said it will not.'
        },
        // WHAT A RIVAL CAN ACTUALLY FIND, AND WHAT NOBODY CAN.
        discoverableTraces: [
            'the Court fields a fraction of the defence its holdings warrant and has never lost the library',
            'two forced entries are recorded by outside parties; the parties are not recorded as having left',
            'the assay minute dates the loss of the object to a century after the last thing that came down it, so the two events the Court\'s annals treat as one are a hundred years apart in its own record',
            'nothing has been received on this line in thirteen centuries, against a sending that ran for a hundred years and then stopped inside a single generation, which is not the shape a line going quiet usually makes',
            'an offering was held three hundred years ago at a cost the Court minuted in full, and the minute records no response and no second attempt'
        ],
        standingNote:
            'The Court is small, isolated and treated as a curiosity with a good collection, and it holds the one ancestral claim in the world that is both made and false. It believes it cannot reach Yun Cangyi because the object that reached her was lost, which everybody watched and nobody disputes; what it does not know, and has no route to knowing, is that she has been dead for most of the silence. The Storm Tyrant Court, which has raided it twice and stopped, does not agree with the province\'s assessment of the Frostmirror and has not explained why - and is in the same position from the other side, holding a true claim it cannot use while everybody guesses about an object it will not show.'
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
    'sect-azure-mist-court': {
        ancestors: [
            { name: 'The first Mist Warden, who was a Sword Elder first', fate: 'dead', realmOrdinal: null, yearsAgo: 340, afterCrossing: null, rememberedFor: 'Took the posting as a demotion and spent forty years establishing that it was not one, which is why the arrangement reads the way it does now.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'Its hall of tablets is a shelf, and every name on it was somebody the terraces sent down. The Mist keeps it in the entrance rather than the interior, on purpose.'
    },
    'sect-azure-dew-sect': {
        ancestors: [
            { name: 'Shu Lianniang, who taught in the villages for sixty years', fate: 'dead', realmOrdinal: null, yearsAgo: 190, afterCrossing: null, rememberedFor: 'Never held a rank above Dew Elder and sent eleven people up the gorge, which is more than the Mist managed in the same period and is not mentioned by anybody at the terraces.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'No ancestors of consequence and no pretence of any. The Dew counts its history in people sent up rather than in names kept.'
    },
    'sect-hollow-bell-wanderers': {
        ancestors: [
            { name: 'Whoever hung the first bell', fate: 'lost', realmOrdinal: null, yearsAgo: 200, afterCrossing: null, rememberedFor: 'Nothing. There is a bell at a crossroads and a practice of hanging more.' },
       ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: {
            id: 'artifact-the-rung-bell',
            name: 'The Rung Bell',
            description:
                'Not a treasure sent down from anywhere. It is what Shen Guyi left, and what he left is the whole estate of somebody who stood at forty-four: manuals in grades the Wanderers cannot read, materials from ground that is now thin, and a bell he cast himself in the last year, which is the only part of it they have ever used. It hangs at the crossroads with the others and is not marked.',
            reserveTerms:
                'There are no terms. He attached none, the Wanderers have never written any, and the estate sits in a shed behind the crossroads under a roof that gets repaired when somebody notices. They are not hoarding it. They have no vein to work it on, nobody who can read the manuals, and no idea what most of it is for.',
            intact: true,
            /**
             * The manuals, named. Four, and the shape of the set is the fact worth
             * having: a gathering canon, a body, a road and a way back from being
             * killed. Not one of them is a weapon, because a man who spent six
             * hundred years climbing to the end of the ladder and then declined the
             * crossing was not collecting weapons. It is the largest body of
             * chaos-grade transmission anybody in either province could physically
             * walk up to, it is in a shed with a bad roof, and it is safe there
             * because the people holding it stand at Core Formation and cannot read
             * a character of it.
             */
            techniqueIds: [
                'heaven-conversing-primordial-canon',
                'undying-kalpa-body',
                'one-thought-ten-thousand-li',
                'rebirth-in-the-lotus-furnace'
            ]
        },
        lastOffering: null,
        discoverableTraces: [
            'A divestment sequence recorded in the Ninefold Ledger in full, opened as a lineage audit a hundred and sixty years ago and closed unresolved, because the estate went somewhere that could not possibly have earned it and no transfer of consideration was ever found',
            'Manuals in the shed at grades no living teacher in either province teaches',
            'A scar nobody can attribute is NOT among these, which is the part the Ledger keeps returning to: he divested like a man about to cross and then there is no crossing and no scar, only a grave'
        ],
        standingNote:
            'No hall, no tablets, and one ancestor who does not fit. The Wanderers tell the story plainly when asked and are not believed, because a sect at Core Formation obviously does not have that - which has protected the estate more reliably than any formation could. Whether Shen Guyi understood that when he chose them is the question the Ledger cannot close.'
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
            // Five of the six, one row each. A row that reads as a person and holds
            // a count is the one mistake this roll can make: anything reading it
            // got six ancestors out of two entries and could not say which two, and
            // the register was subtracting the entries from the count and reporting
            // the difference as crossings whose names had gone. They are entered
            // under the seat they held rather than under a name, which is the
            // Court's own practice and not a hole in the record - the names exist,
            // on tablets inside the wall, and have never been lent out. The sixth
            // is the most recent, is the one name that did get out, and is carried
            // in `crossings.ts` as `mostRecentCrossingName`, so the two catalogs
            // together hold six people and count each of them once.
            { name: 'The one who went through first, whom the Court refers to only as that', fate: 'ascended', realmOrdinal: 46, yearsAgo: 4_400, afterCrossing: 'still_above', rememberedFor: 'Crossing from the north mountain and completing it, and being the reason there is anybody on the other side who answers when the Court calls.' },
            { name: 'The Second Seat who went from the north mountain with the first standing protector', fate: 'ascended', realmOrdinal: 46, yearsAgo: 3_600, afterCrossing: 'still_above', rememberedFor: 'The first crossing anybody stood protector at, one at a time and the others standing, which is the arrangement that made the four after it possible and which nobody outside the Court has ever been able to reproduce.' },
            { name: 'The First Seat who held the vein six hundred years and then went from it', fate: 'ascended', realmOrdinal: 46, yearsAgo: 2_900, afterCrossing: 'still_above', rememberedFor: 'Held the seat longer than anybody before or since, and left the Court the only account it has of what waiting costs somebody already able to go. Every roll outside the wall enters him as a departure and nothing else.' },
            { name: 'The Third Seat who stood protector at four crossings before her own', fate: 'ascended', realmOrdinal: 46, yearsAgo: 2_100, afterCrossing: 'still_above', rememberedFor: 'Stood protector four times and went fifth, and most of what the Court holds about the approach is in her hand rather than in anything that has come back down since.' },
            { name: 'The Fourth Seat who waited two hundred years for three protectors to be free at once', fate: 'ascended', realmOrdinal: 46, yearsAgo: 1_300, afterCrossing: 'died_above', rememberedFor: 'Waited out two other attempts rather than go with two standing, which the Court records without comment and has never repeated as advice. Nothing in the correspondence changed when she stopped answering, and the Court has no way at all to establish that she did.' }
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
            'Six crossings across four thousand four hundred years puts them at the top of the lineage tiers by the world\'s own count, and their depletion is middling rather than severe despite that age for one reason: they only accept the best, so their members disproportionately cross. They are the one institution in the world that converts admissions into ancestors. Five of the six are on this roll, under the seat each held rather than under a name; the sixth is the most recent and is the one the Court has let out, and it is named in `crossings.ts`. The two catalogs hold six people between them and count each once, which is worth stating because a bare six against a roll of five reads as a missing person and is not one. See `crossings.ts` for the channel, the protector arrangement and the comparative lineage standings.'
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
            { name: 'Weir Master Ho Lian', fate: 'dead', realmOrdinal: null, yearsAgo: 60, afterCrossing: null, rememberedFor: 'Reached Core Formation on Office grants, which remains the highest anyone has ever gone from inside the Silent Cliffs.' }
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
    // The two unbacked bodies, and both walls are nearly bare, which is the
    // honest position for a house that has not been anywhere long. Neither
    // claims a living ancestor and neither has a gift, because neither has
    // ever had anybody above the Lid to be given one by - which is the
    // ordinary condition of a house with no apex over it, and is most of
    // what the word "unbacked" costs.
    'sect-halfwater-rail': {
        ancestors: [
            { name: 'Weigher Duan Xi', fate: 'dead', realmOrdinal: 19, yearsAgo: 90, afterCrossing: null, rememberedFor: 'Set the rate at a fortieth and refused four separate offers to raise it, on the argument that the port is worth what passes through it and nothing else. The rate has not moved since and the argument is repeated at every Factors\' table as though somebody had just thought of it.' },
            { name: 'The Rail Master before this one, name kept off the board', fate: 'dead', realmOrdinal: 21, yearsAgo: 22, afterCrossing: null, rememberedFor: 'Refused a lot the Deep Survey was already hunting, in writing, and had the refusal copied to the seller\'s face so that everybody on the quay would know the line existed. Died four years later of nothing in particular, which at Silver Island is worth remarking on.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'Ninety years old, no hall of tablets and no wall of names - what it keeps instead is the rate book, unbroken, which is the only continuous record in the province and is worth more to the port than any ancestor would be.'
    },
    'sect-sink-carriers': {
        ancestors: [
            { name: 'The Waterman who cut the first tally board', fate: 'dead', realmOrdinal: null, yearsAgo: 90, afterCrossing: null, rememberedFor: 'Left the names of strings that did not come back up on the board instead of wiping them, and the board has never been wiped since. It is now nine boards and the shed was rebuilt around them.' },
            { name: 'Route Elder Ma out of Iron Gate', fate: 'lost', realmOrdinal: 17, yearsAgo: 11, afterCrossing: null, rememberedFor: 'Walked a string to a show that had closed and turned it round on the fourth day with two thirds of the water gone, bringing back every carrier and none of the load. It is the only decision anybody at the shed can name.' }
        ],
        claimsLivingAncestor: false,
        claimIsTrue: false,
        recency: 'none',
        dormant: null,
        partingGift: null,
        lastOffering: null,
        discoverableTraces: [],
        standingNote: 'No tablets, no hall and no graves, because the sand keeps its own and gives them back. The tally boards are the whole of the ancestry and they are a list of the missing rather than of the honoured.'
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
