/**
 * The fallen: cultivators the road already finished with, and what they do now.
 *
 * This is an age of decline whose every inhabitant is, so far, intact. That is
 * the least believable thing about the world. A ladder that charges a price at
 * every boundary, medicine that is more poisonous the better it is, sealed
 * sites that were sealed for a reason, and a Clear Meridian Pill priced at five
 * months of a culler's gross should be producing casualties continuously - and
 * the catalog should be able to hand the narrator one without ceremony.
 *
 * So these are common, cheap to meet, and deliberately unremarkable. A market
 * town has several. A sect town has more, standing outside the gate. None of
 * them is a quest, a secret master, or a lesson.
 *
 * THREE RULES
 * -----------
 *  1. WORK, PLACE AND ATTITUDE, NEVER PITY. Every entry says what they do for
 *     money, where they are, and how they carry it. A misfortune with no work
 *     attached is a prop. The test in `tests/data/cultivation-margins.test.ts`
 *     enforces all three.
 *  2. NOBODY IS FLAGGED IMPORTANT. No hidden prodigies, no concealed realms, no
 *     inheritance waiting behind the limp. What they know is worth something
 *     because they were there, not because the catalog put it there.
 *  3. THE ENGINE STATES WHERE THEY FIT, AND PLAIN DAMAGE WHERE THEY DO NOT.
 *     `existenceState`, `identityContinuity` and `foundationQuality` are the
 *     engine's own vocabulary and are used exactly where they apply. Where
 *     nothing in the model covers it, `unexplained` holds it and the catalog
 *     never resolves it. Somebody who came back from a sealed site wrong is not
 *     owed an explanation by the data.
 *
 * Several of them are better company than the people who succeeded, and at
 * least three are dangerous - one of them precisely because everyone in the
 * room has decided he is not.
 *
 * Money is the mortal economy and nothing else: see `mortal-world.ts`, and use
 * `monthsOfWorkToAfford` rather than writing a second set of numbers.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { ExistenceStateSchema, FoundationQualitySchema } from '../../schema/cultivation.js';
import { SettlementSchema, getOccupation, getPrice } from './mortal-world.js';
import { PLACE } from './place-names.js';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/** How they were finished with. Five kinds, and the world produces all five. */
export const FallenKindSchema = z.enum([
    /** Meridians ruined. The cultivation is gone and is not coming back. */
    'meridians_destroyed',
    /** A foundation that cracked, or was never finished. They stopped. */
    'stalled',
    /** Went into a sealed site and did not entirely come out of it. */
    'came_back_wrong',
    /** Traded something irreversible for a rank, got the rank, and pays. */
    'spent',
    /** Carrying damage nobody treated, usually because treatment costs money. */
    'maimed'
]);
export type FallenKind = z.infer<typeof FallenKindSchema>;

/** Whether sitting down with them is worth the evening. */
export const CompanySchema = z.enum(['good', 'difficult', 'not_company']);
export type Company = z.infer<typeof CompanySchema>;

export const FallenSchema = z.object({
    id: z.string(),
    /** A role rather than a protagonist. Reusable, and meant to be reused. */
    name: z.string().min(1),
    kind: FallenKindSchema,
    /** How often a travelling cultivator meets one. Most are common. */
    rarity: z.enum(['common', 'uncommon', 'rare']),
    /** The highest rank they ever stood on, which is frequently the point. */
    lastOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /**
     * What they can actually bring to work now. Zero where the cultivation is
     * gone, and never above `lastOrdinal`. This is the number an employer is
     * hiring, which is why the meridian-destroyed hold mortal jobs beside the
     * cultivator jobs they used to be paid four times as much for.
     */
    currentOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Whether the ladder is still open to them at all. Usually it is not. */
    stillClimbs: z.boolean(),
    /** What happened, in plain sentences, with no build-up. */
    what: z.string().min(60),
    /**
     * The part nobody can name, including them. Null wherever the damage is
     * ordinary. Never resolved anywhere in this file, on purpose.
     */
    unexplained: z.string().min(40).nullable(),
    /** The engine's own vocabulary, used only where it genuinely applies. */
    existenceState: ExistenceStateSchema,
    identityContinuity: z.number().min(0).max(1).nullable(),
    foundationQuality: FoundationQualitySchema.nullable(),
    /** What they do for money. `occupationId` indexes `OCCUPATIONS`. */
    work: z.object({
        occupationId: z.string().nullable(),
        doing: z.string().min(40),
        /** A price id from `PRICES` where the trade quotes one. */
        quotesPriceId: z.string().nullable()
    }),
    place: z.object({
        regionId: z.string(),
        /** Place names from that region's `places` list. */
        places: z.array(z.string().min(3)).min(1),
        settlements: z.array(SettlementSchema.shape.kind).min(1)
    }),
    /** How they carry it. Never sad on the reader's behalf. */
    attitude: z.string().min(60),
    company: CompanySchema,
    /** The question they are asked constantly, where there is one. */
    asked: z.string().min(30).nullable(),
    /** Null where they are simply not dangerous. Most of them are not. */
    danger: z.object({
        /** True where the danger survives entirely because nobody credits it. */
        underestimated: z.boolean(),
        how: z.string().min(60)
    }).nullable(),
    /** Factions named in the entry. Ids only, resolved against the catalog. */
    factionIds: z.array(z.string())
});
export type Fallen = z.infer<typeof FallenSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// ─────────────────────────────────────────────────────────────────────────

export const FALLEN: readonly Fallen[] = [
    // ── meridians destroyed ───────────────────────────────────────────
    {
        id: 'fallen-broken-duellist',
        name: 'Broken duellist',
        kind: 'meridians_destroyed',
        rarity: 'common',
        lastOrdinal: 14,
        currentOrdinal: 0,
        stillClimbs: false,
        what: 'Lost a duel over a survey line at thirty-eight and had his meridians cut rather than his throat, which at the time was presented as mercy and was in fact bookkeeping: a dead disciple is an arbitration and a ruined one is not.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-caravan-guard',
            doing: 'Hired as a mortal spear alongside the cultivator escort he would once have been, at a tenth of that fee, and teaches merchants\' children forms in the evenings for the difference.',
            quotesPriceId: 'price-mortal-sword'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.STONE_FORD, PLACE.GREEN_FALL],
            settlements: ['market_town', 'city']
        },
        attitude: 'Professional about the lessons and uninterested in the story. Buy him a drink and he will give you four hours on why the duel was decided before either of them drew, which is the best instruction anybody in that town is getting.',
        company: 'good',
        asked: 'Whether it can be reversed, by every parent who hires him',
        danger: {
            underestimated: true,
            how: 'Twenty years of body tempering did not leave with the qi. In a room with knives and no cultivators in it he is the most dangerous thing present, and every person in that room has already decided he is a cripple with a stick.'
        },
        factionIds: ['sect-azure-cloud-pavilion', 'house-ninefold-ledger']
    },
    {
        id: 'fallen-innkeeper-at-the-gate',
        name: 'The failed crossing behind the counter',
        kind: 'meridians_destroyed',
        rarity: 'common',
        lastOrdinal: 16,
        currentOrdinal: 0,
        stillClimbs: false,
        what: 'Attempted Core Formation in rented ground with a pill she had bought on the road, and the meridians went instead of the boundary. She was found by the landlord, who was chiefly annoyed about the month.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: 'damaged',
        work: {
            occupationId: 'job-innkeeper',
            doing: 'Bought a room-and-board house inside the sect gate with what was left of her stones. Every other inn on that street is held by a family with a cousin in the sect; she simply paid, which nobody there has forgiven.',
            quotesPriceId: 'price-inn-night'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.NINE_PEAKS, PLACE.GREEN_FALL],
            settlements: ['sect_town', 'city']
        },
        attitude: 'Dry, unhurried, and entirely willing to name the road dealer who sold her the pill and what he charged. Half the outer disciples in that town complain to her and none of them ask her anything about herself.',
        company: 'good',
        asked: 'Which pill it was, by everybody about to buy one',
        danger: null,
        factionIds: ['sect-nine-peaks-ascetic-order']
    },
    {
        id: 'fallen-mistreated',
        name: 'Treated by the wrong hand',
        kind: 'meridians_destroyed',
        rarity: 'common',
        lastOrdinal: 9,
        currentOrdinal: 0,
        stillClimbs: false,
        what: 'Tore a meridian on a culling contract and was given earth-grade medicine for it by a village herbalist who had one and wanted the sale. The tear healed. Everything around it did not.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-herb-picker',
            doing: 'Picks mortal-grade herbs on safe ground, and sells dosage advice on the side for the price of a written letter.',
            quotesPriceId: 'price-scribe-letter'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.STONE_FORD],
            settlements: ['village', 'market_town']
        },
        attitude: 'Not bitter at the herbalist. Bitter at himself, specifically and repeatedly, for having wanted it fast, and he will say so to any young cultivator holding a pill above their grade.',
        company: 'good',
        asked: 'What grade is safe at this rank, which is the only free advice he gives',
        danger: null,
        factionIds: ['sect-cinnabar-crucible-guild']
    },
    {
        id: 'fallen-cut-by-his-crew',
        name: 'Cut by his own crew',
        kind: 'meridians_destroyed',
        rarity: 'uncommon',
        lastOrdinal: 11,
        currentOrdinal: 0,
        stillClimbs: false,
        what: 'A share dispute at the mouth of a shaft was settled the cheap way. Four of them went back to the sorting yard, and so, eventually, did he.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-porter',
            doing: 'Carries salvage at the barrow yard for the people who did it, because that is where the work is and both parties have agreed to be normal about it.',
            quotesPriceId: null
        },
        place: {
            regionId: 'region-quiet-marches',
            places: [PLACE.GRAVE_MARKET, PLACE.IRON_GATE],
            settlements: ['village', 'market_town']
        },
        attitude: 'Cordial with all four. Drinks with two of them. Nobody who watches this understands it and he has never offered to explain.',
        company: 'difficult',
        asked: null,
        danger: {
            underestimated: true,
            how: 'He walked eleven sealed shafts in six years and remembers which three were baited. He has never told anybody, he is asked for directions constantly, and there is no longer any reason for him to be accurate.'
        },
        factionIds: ['sect-gleaners-company']
    },

    // ── stalled ───────────────────────────────────────────────────────
    {
        id: 'fallen-ninety-years-at-foundation',
        name: 'Ninety years at Foundation',
        kind: 'stalled',
        rarity: 'common',
        lastOrdinal: 13,
        currentOrdinal: 13,
        stillClimbs: false,
        what: 'Reached Foundation Establishment at sixty, in thin qi, in a hurry, on a borrowed pill, and laid a foundation that was never finished. He has not moved since, and he is a hundred and fifty.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: 'incomplete',
        work: {
            occupationId: 'job-formation-hand',
            doing: 'Holds nodes steady for people who understand them. Indoors, seated, and the steadiest hands in the city belong to somebody with nothing left to spend them on.',
            quotesPriceId: null
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.GREEN_FALL, PLACE.NINE_PEAKS],
            settlements: ['city', 'sect_town']
        },
        attitude: 'Answers in one sentence, the same sentence, every time: part of it was never there and cannot be added later. Nobody believes him, because everybody wants the answer to be a technique somebody is withholding.',
        company: 'good',
        asked: 'What is really stopping him, asked by somebody new about twice a month for ninety years',
        danger: null,
        factionIds: ['sect-azure-cloud-pavilion']
    },
    {
        id: 'fallen-foundation-reader',
        name: 'The foundation reader',
        kind: 'stalled',
        rarity: 'uncommon',
        lastOrdinal: 13,
        currentOrdinal: 13,
        stillClimbs: false,
        what: 'Stopped at the same wall thirty years ago, spent a decade working out precisely why, and discovered that the only marketable thing he owned afterwards was the diagnosis.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: 'unstable',
        work: {
            occupationId: null,
            doing: 'Reads a foundation and tells you what it is, for five stones, in a back room, with nobody else present. That is a fifteenth of what the Ledger charges to place a foreign cultivator, and he makes the comparison before you do.',
            quotesPriceId: 'price-placement'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.GREEN_FALL, PLACE.STONE_FORD],
            settlements: ['city', 'market_town']
        },
        attitude: 'Blunt, quick, and completely uninterested in softening it. About a third of his clients pay and then argue, which he expects and prices in.',
        company: 'difficult',
        asked: 'Whether he can fix what he has just named, which he cannot and says so',
        danger: null,
        factionIds: ['house-ninefold-ledger']
    },
    {
        id: 'fallen-damaged-climber',
        name: 'Climbed on a damaged foundation anyway',
        kind: 'stalled',
        rarity: 'uncommon',
        lastOrdinal: 17,
        currentOrdinal: 17,
        stillClimbs: true,
        what: 'Laid a foundation over meridians that had not healed, was told what that meant, and went up anyway. It worked. Everything he does costs him about twice what it costs anybody else at his rank, permanently.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: 'damaged',
        work: {
            occupationId: 'job-escort',
            doing: 'Takes caravan escort contracts at Core Formation and spends most of the fee on medicine, which is an arrangement he describes as break-even and defends.',
            quotesPriceId: 'price-clear-meridian-pill'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.STONE_FORD, PLACE.GREEN_FALL],
            settlements: ['market_town', 'city']
        },
        attitude: 'Short-tempered in the mornings and reasonable by evening, which everybody who travels with him learns to schedule around. He is proof the climb is possible on a bad foundation and is sick of being asked how.',
        company: 'difficult',
        asked: 'How he did it, by every stalled cultivator who hears about him',
        danger: null,
        factionIds: ['sect-stonewright-consortium']
    },

    // ── came back wrong ───────────────────────────────────────────────
    {
        id: 'fallen-quiet-returner',
        name: 'Came out of the shaft three days late',
        kind: 'came_back_wrong',
        rarity: 'common',
        lastOrdinal: 8,
        currentOrdinal: 8,
        stillClimbs: true,
        what: 'His crew left Nine Hundred Paces without him on the second day, as the rule says. He walked into Six Li on the fifth, carrying his tools, having no account of the three days that anybody including him finds satisfactory.',
        unexplained: 'Something is different and nobody can name it. He does not blink on the beat a person blinks on, and every crew that has shared a tent with him has noticed something, and no two of them describe the same thing.',
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-gleaner',
            doing: 'Still dives. Crews pay him a share and a half and will not sleep in the same tent, and he has stopped arguing about either half of that.',
            quotesPriceId: null
        },
        place: {
            regionId: 'region-quiet-marches',
            places: [PLACE.SIX_LI, PLACE.DEAD_STONE, PLACE.GRAVE_MARKET],
            settlements: ['hamlet', 'village']
        },
        attitude: 'Thinks the whole thing is overdone, says so, and would like to be left alone about it. He is the same man he was in every particular anybody can point at, which is exactly the problem.',
        company: 'good',
        asked: 'What happened in the three days, and he does not know',
        danger: null,
        factionIds: ['sect-gleaners-company', 'sect-sixmile-wardens']
    },
    {
        id: 'fallen-lantern-and-carrier',
        name: 'A lantern and the hand that carries it',
        kind: 'came_back_wrong',
        rarity: 'rare',
        lastOrdinal: 22,
        currentOrdinal: 22,
        stillClimbs: false,
        what: 'Went into a sealed site at Nascent Soul with an anchor prepared and came out of it without a body. What survived is in a lantern, and the lantern is carried by a hired man who is paid monthly and has never once been asked what he thinks about the arrangement.',
        unexplained: null,
        existenceState: 'soul_preserved',
        identityContinuity: 0.8,
        foundationQuality: null,
        work: {
            occupationId: 'job-formation-hand',
            doing: 'The lantern reads the node and names the plate; the carrier lays it. They are hired as one formation hand and split the wage two ways, which neither of them considers unfair and both mention.',
            quotesPriceId: null
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.GREEN_FALL, PLACE.BURNT_EARTH],
            settlements: ['city', 'sect_town']
        },
        attitude: 'Impatient, precise, and superb company for exactly one hour, after which the impatience wins. Cannot do anything that needs hands and has organised an entire working life around that sentence.',
        company: 'good',
        asked: 'What is on the other side of dying, which it refuses on the grounds that it did not go',
        danger: null,
        factionIds: ['sect-lantern-hall']
    },
    {
        id: 'fallen-two-names',
        name: 'The one who answers to two names',
        kind: 'came_back_wrong',
        rarity: 'rare',
        lastOrdinal: 21,
        currentOrdinal: 21,
        stillClimbs: false,
        what: 'The body went in a collapse and a vessel had been arranged in advance. She declines to say by whom, or what the vessel was before, and the decline is flat rather than mysterious.',
        unexplained: 'She remembers two childhoods with equal confidence and knows that at most one of them is hers. She has stopped trying to establish which and finds the question less interesting than everybody else does.',
        existenceState: 'possessing',
        identityContinuity: 0.55,
        foundationQuality: null,
        work: {
            occupationId: 'job-placer-runner',
            doing: 'Works the border road for a placer, finding foreign cultivators willing to be assessed. The Ledger\'s tables were the first document that ever described her accurately and she has kept a copy.',
            quotesPriceId: 'price-placement'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.STONE_FORD],
            settlements: ['market_town', 'village']
        },
        attitude: 'Introduces herself with both names and lets the other person choose. Whichever they pick, she uses for the rest of the conversation and does not mention again.',
        company: 'good',
        asked: 'Which of the two names is the real one, usually within a minute of meeting her',
        danger: null,
        factionIds: ['house-ninefold-ledger']
    },
    {
        id: 'fallen-shaft-mouth-remnant',
        name: 'The greeting at the shaft mouth',
        kind: 'came_back_wrong',
        rarity: 'rare',
        lastOrdinal: 23,
        currentOrdinal: 0,
        stillClimbs: false,
        what: 'Something was left in the doorway of a burn-zone shaft by somebody who died there long before the catastrophe. It greets every crew that arrives, by a name in a form of speech nobody uses, and asks the same question. It is not the person. It never was.',
        unexplained: null,
        existenceState: 'remnant',
        identityContinuity: 0,
        foundationQuality: null,
        work: {
            occupationId: null,
            doing: 'It is used. Crews treat the greeting as a gauge: if it speaks the shaft is as they left it, and if it is silent the edge has moved and nobody goes in. Four generations of Gleaners have worked off that reading.',
            quotesPriceId: null
        },
        place: {
            regionId: 'region-quiet-marches',
            places: [PLACE.DEAD_STONE, PLACE.SIX_LI],
            settlements: ['hamlet']
        },
        attitude: 'Identical every time, courteous, and entirely uninterested in the answer. Crews leave food, which it does not take, and have done for so long that the leaving is now the custom rather than the offering.',
        company: 'not_company',
        asked: null,
        danger: null,
        factionIds: ['sect-gleaners-company', 'sect-sixmile-wardens']
    },

    // ── spent ─────────────────────────────────────────────────────────
    {
        id: 'fallen-spent-his-foundation',
        name: 'Spent his foundation and got what he paid for',
        kind: 'spent',
        rarity: 'uncommon',
        lastOrdinal: 15,
        currentOrdinal: 15,
        stillClimbs: false,
        what: 'Broke a formation from the inside to get eleven people out of a collapsing site, using the only thing he had that was worth enough. It worked. All eleven walked out. So did he, at four-tenths of the rate he went in at, for good.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: 'sacrificed',
        work: {
            occupationId: 'job-escort',
            doing: 'Captains an escort crew on the border road. The Consortium rank table reads him at Foundation and pays accordingly, and the table is not wrong about the rank.',
            quotesPriceId: 'price-caravan-passage'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.STONE_FORD, PLACE.GREEN_FALL],
            settlements: ['market_town', 'city']
        },
        attitude: 'Would do it again, says so without ceremony, and finds the retelling boring. He has a two-sentence version for tables where somebody has just found out.',
        company: 'good',
        asked: 'Whether it was worth it, which he treats as a question about arithmetic',
        danger: null,
        factionIds: ['sect-stonewright-consortium']
    },
    {
        id: 'fallen-name-on-a-slip',
        name: 'The courier with a name on a slip of paper',
        kind: 'spent',
        rarity: 'uncommon',
        lastOrdinal: 17,
        currentOrdinal: 17,
        stillClimbs: true,
        what: 'Crossed into Core Formation, and the crossing took somebody. She wrote a list before the attempt because an archivist told her to, and the list is now the only evidence she has that a boy of that name was ever anything to her.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: 'stable',
        work: {
            occupationId: 'job-courier',
            doing: 'Runs Measured Span work at true distance, and is very good at it, which is a trade that rewards somebody who does not need to be anywhere in particular.',
            quotesPriceId: 'price-span-courier'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.GREEN_FALL, PLACE.STONE_FORD, PLACE.BURNT_EARTH],
            settlements: ['city', 'market_town']
        },
        attitude: 'Brisk, unbothered, and mildly irritated that strangers find it sad. She answers two questions about the slip and then changes the subject, and the rule is stated in advance.',
        company: 'good',
        asked: 'Who the boy was, which is the one thing the slip does not say',
        danger: null,
        factionIds: ['sect-lantern-hall', 'house-measured-span']
    },
    {
        id: 'fallen-forced-the-rank',
        name: 'Forced the rank and can no longer take medicine',
        kind: 'spent',
        rarity: 'common',
        lastOrdinal: 12,
        currentOrdinal: 12,
        stillClimbs: false,
        what: 'Took heaven-grade medicine at Qi Condensation to buy a rank he could not accumulate. He got the rank. Everything above mortal grade is now poison to him, in a world where pills are the only reliable way to undo damage.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-beast-culler',
            doing: 'Takes village culling contracts, and takes them slowly. A broken arm costs him a splint and a season rather than a pill and an afternoon, and he prices his own time accordingly.',
            quotesPriceId: 'price-splint-and-month'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.STONE_FORD, PLACE.NINE_PEAKS],
            settlements: ['village', 'market_town']
        },
        attitude: 'Methodical to the point of tedium, on purpose. Every experienced culler on that circuit would rather work with him than with anybody faster, and they say so where he can hear it.',
        company: 'good',
        asked: 'Whether the pill was worth one rank',
        danger: null,
        factionIds: ['sect-verdant-spring-hall']
    },
    {
        id: 'fallen-cut-in-advance',
        name: 'Cut it in advance, once, and kept the receipt',
        kind: 'spent',
        rarity: 'rare',
        lastOrdinal: 16,
        currentOrdinal: 16,
        stillClimbs: true,
        what: 'Never joined anybody. Read the demonic path\'s argument, decided it was correct about one specific bond, cut that bond herself the year before her crossing, and crossed clean.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: 'stable',
        work: {
            occupationId: 'job-scribe',
            doing: 'Copies lists for the archivists: the names, the faces, the people who are no longer remembered by anyone who knew them. She says the paperwork is restful and appears to mean it.',
            quotesPriceId: 'price-scribe-letter'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.BURNT_EARTH, PLACE.GREEN_FALL],
            settlements: ['sect_town', 'city']
        },
        attitude: 'Entirely functional and slightly puzzled by the discomfort she causes. The discomfort is other people\'s; she made a decision, it worked, and she has no further position on it.',
        company: 'difficult',
        asked: 'Whether she would do it again, and she says the question is badly formed',
        danger: null,
        factionIds: ['sect-lantern-hall', 'sect-the-severed']
    },

    // ── maimed and poisoned ───────────────────────────────────────────
    {
        id: 'fallen-thirty-years-untreated',
        name: 'Thirty years with a torn meridian',
        kind: 'maimed',
        rarity: 'common',
        lastOrdinal: 7,
        currentOrdinal: 7,
        stillClimbs: false,
        what: 'Tore it at nineteen. The pill that fixes it costs sixty stones, which is five months of a culler\'s gross, and he has never once had five clear months. It is now structural and the pill would not help.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-beast-culler',
            doing: 'Culls on village contracts, on one working side, and has done for three decades. He is slower than the young ones and has buried more of them than he can name.',
            quotesPriceId: 'price-clear-meridian-pill'
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.STONE_FORD, PLACE.NINE_PEAKS],
            settlements: ['village', 'market_town']
        },
        attitude: 'Quotes the price to the cash and has quoted it for thirty years. He is not asking for it. He is explaining the shape of the world to somebody who has just noticed the limp.',
        company: 'good',
        asked: 'Why he does not simply buy the pill',
        danger: null,
        factionIds: ['sect-verdant-spring-hall', 'sect-cinnabar-crucible-guild']
    },
    {
        id: 'fallen-deviation-survivor',
        name: 'Qi deviation survivor, still firing',
        kind: 'maimed',
        rarity: 'common',
        lastOrdinal: 10,
        currentOrdinal: 10,
        stillClimbs: false,
        what: 'Cultivated a conflicting art on a muddled root for two years because it was the manual he could afford. He survived the deviation. The art did not stop, and it no longer takes instruction from him.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-charcoal-burner',
            doing: 'Burns charcoal alone in the woods for weeks at a stretch, which he chose deliberately and describes as the safest available arrangement for everybody concerned.',
            quotesPriceId: null
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.NINE_PEAKS, PLACE.STONE_FORD],
            settlements: ['hamlet', 'village']
        },
        attitude: 'Gentle, apologetic, and exact about his own rules. He tells you where to stand before he tells you his name, and he is not being dramatic.',
        company: 'good',
        asked: 'Whether it can be aimed, and it cannot',
        danger: {
            underestimated: false,
            how: 'It goes off when he is frightened, unaimed, at whatever is in front of him. He signals this clearly, everybody in the district knows, and about once a decade somebody stands in the wrong place anyway.'
        },
        factionIds: []
    },
    {
        id: 'fallen-furnace-hand',
        name: 'Ten years of furnace residue',
        kind: 'maimed',
        rarity: 'uncommon',
        lastOrdinal: 5,
        currentOrdinal: 5,
        stillClimbs: false,
        what: 'A decade on the bellows in a refining hall. The residue settled where it settles, and now his blood carries something the Guild will buy quarterly and his skin carries something nobody wants to touch.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-bellows-hand',
            doing: 'Still on the bellows, and sells his own blood back to the Guild four times a year, an arithmetic he finds funnier than anyone else in the hall does.',
            quotesPriceId: null
        },
        place: {
            regionId: 'region-low-fall',
            places: [PLACE.GREEN_FALL, PLACE.NINE_PEAKS],
            settlements: ['city', 'sect_town']
        },
        attitude: 'Wheezing, cheerful and profane. He has watched three journeymen promoted past him and holds opinions about all three that are worth the evening.',
        company: 'good',
        asked: 'What the Guild does with the blood, which he does not know either',
        danger: {
            underestimated: true,
            how: 'Bare skin on him for any length of time is a poisoning, and everybody in the hall treats him as a harmless old wheezer who can be shoved out of the way. Two apprentices have found out and neither of them was believed at first.'
        },
        factionIds: ['sect-cinnabar-crucible-guild']
    },
    {
        id: 'fallen-marches-carver',
        name: 'Carver at forty',
        kind: 'maimed',
        rarity: 'common',
        lastOrdinal: 6,
        currentOrdinal: 6,
        stillClimbs: false,
        what: 'Cut faces on other people\'s grants for eighteen years and inhaled the reason Silent Cliffs carvers die at forty. He is thirty-nine and entirely clear about the arithmetic.',
        unexplained: null,
        existenceState: 'alive',
        identityContinuity: null,
        foundationQuality: null,
        work: {
            occupationId: 'job-face-labour',
            doing: 'Still cutting, for a share of what comes out, and buying a fresh chisel every season because that is what the work costs before it costs anything else.',
            quotesPriceId: 'price-chisel'
        },
        place: {
            regionId: 'region-quiet-marches',
            places: [PLACE.IRON_GATE, PLACE.JADE_FACE],
            settlements: ['market_town']
        },
        attitude: 'Working. Not dying, not doomed, not brave about it: working, with a year or two of it left, and irritated by visitors from the Jade Gorge who arrive with a face already arranged.',
        company: 'good',
        asked: 'Why he does not stop, which assumes there is something else to do in Iron Gate',
        danger: null,
        factionIds: ['sect-weir-office']
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const FALLEN_BY_ID: ReadonlyMap<string, Fallen> = new Map(FALLEN.map(f => [f.id, f]));

export function getFallen(id: string): Fallen | undefined {
    return FALLEN_BY_ID.get(id);
}

export function fallenByKind(kind: FallenKind): Fallen[] {
    return FALLEN.filter(f => f.kind === kind);
}

export function fallenInRegion(regionId: string): Fallen[] {
    return FALLEN.filter(f => f.place.regionId === regionId);
}

/** Who is actually about, in a place of this size. Most of them are common. */
export function fallenInSettlement(kind: Fallen['place']['settlements'][number]): Fallen[] {
    return FALLEN.filter(f => f.place.settlements.includes(kind));
}

/** The ones it would be a mistake to write off, and why. */
export function dangerousFallen(opts: { underestimatedOnly?: boolean } = {}): Fallen[] {
    return FALLEN.filter(f =>
        f.danger !== null && (!opts.underestimatedOnly || f.danger.underestimated));
}

/** Who is holding down a given job. Meshes this file with `OCCUPATIONS`. */
export function fallenWorkingAs(occupationId: string): Fallen[] {
    return FALLEN.filter(f => f.work.occupationId === occupationId);
}

/**
 * The arithmetic that keeps the maimed maimed, computed rather than written
 * down, so it can never disagree with the mortal economy.
 *
 * A Clear Meridian Pill against a culler's contract is roughly five months of
 * gross earnings before food and lodging, which is why a torn meridian carried
 * for thirty years is the ordinary outcome rather than a tragedy.
 */
export function monthsOfWorkToAfford(priceId: string, occupationId: string): number | undefined {
    const price = getPrice(priceId);
    const job = getOccupation(occupationId);
    if (!price || !job || job.cashPerMonth <= 0) return undefined;
    return Number((price.cash / job.cashPerMonth).toFixed(1));
}
