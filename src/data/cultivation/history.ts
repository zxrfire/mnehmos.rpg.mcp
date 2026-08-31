/**
 * The deep past: four ages, two civilisations that are gone, and the four or
 * five questions about all of it that nobody can answer.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The world has a rich present and had a thin past. Ruins were everywhere and
 * belonged to nobody; the setting asserted that civilisations stronger than
 * anything now living left the wreckage people walk through daily, and none of
 * those civilisations existed. This file is the causes.
 *
 * Depth here means causes, not more nouns. Everything in the present should be
 * explicable from what is written here, and the explanation should be partly
 * lost:
 *
 *   why the qi is thin          three ages spent it, in three different ways
 *   why sects hold veins        a vein grant is really a grant of ground plus
 *                               works, and nobody can build the works
 *   why nine of forty-one       a node that has never gone out can be kept; a
 *                               node that has gone out cannot be relit
 *   why the pyramid exists      the Settlement, which ended the age of taking
 *   why the roads go nowhere    they go to gate terminals, and the gates closed
 *   why nobody can date it      two provinces, two epochs, and an offset that
 *                               three institutions compute differently
 *
 * THE RULE THIS FILE OBEYS
 * ------------------------
 * Every claim has a knower, and the engine is one of the parties that can fail
 * to know. `src/engine/world/history.ts` supplies the distinction and this file
 * uses all three values of it:
 *
 *   objective       the engine knows this happened as stated. Rare here, and
 *                   reserved for things that are physically present: a stone
 *                   is where it is, a terminal answers or does not.
 *   reconstructed   assembled from surviving evidence by somebody named, and
 *                   it may be wrong. Most of this file.
 *   unresolved      the engine does not know either. The candidate answers are
 *                   listed and none is endorsed.
 *
 * A past the database has settled is a past nobody can discover. Where an
 * entry is `unresolved`, do not resolve it: `resolveFact` exists so that a
 * particular run can settle a particular question through play, and the
 * catalog must not do it in advance.
 *
 * SCOPE
 * -----
 * Inert data. Nothing here rolls, resolves or succeeds. The one function that
 * builds anything builds `Era` records from the age table so a ledger can be
 * opened on the authored past instead of a generated one.
 */

import { z } from 'zod';
import { dayOfYear, type Era, type FactTruth, type RecordFidelity } from '../../engine/world/history.js';

// ─────────────────────────────────────────────────────────────────────────
// SHARED SHAPES
// ─────────────────────────────────────────────────────────────────────────

/**
 * The engine's own stance toward a claim.
 *
 * Annotated with the engine's `FactTruth` on purpose: this catalog and
 * `src/engine/world/history.ts` must mean the same three things by these
 * words, and the annotation makes a divergence a compile error rather than a
 * subtle disagreement about what `reconstructed` means.
 */
export const ClaimTruthSchema: z.ZodType<FactTruth> = z.enum(['objective', 'reconstructed', 'unresolved']);
export type ClaimTruth = FactTruth;

/**
 * A claim, with the party who holds it and the reason the engine stands where
 * it stands. Nothing in this file is stated without one of these attached.
 */
export const ClaimSchema = z.object({
    /** What is being claimed, stated flatly. */
    statement: z.string().min(60),
    truth: ClaimTruthSchema,
    /**
     * Faction ids of the parties who hold it. Empty only where the claim is
     * `objective` and physical, which is to say where the ground is the knower.
     */
    heldBy: z.array(z.string()),
    /** What the holders are reasoning from. Never "it is known". */
    evidence: z.array(z.string().min(30)).min(1),
    /**
     * Candidate answers where `truth` is `unresolved`. None endorsed, and the
     * schema test enforces that this is empty otherwise.
     */
    claimedOutcomes: z.array(z.string().min(30)),
    /** How much of the underlying record survives to be argued from. */
    fidelity: z.enum(['full', 'partial', 'rumour', 'lost'])
});
export type Claim = z.infer<typeof ClaimSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE AGES
//
// Four before the present, and the qi falls across all four for four
// different reasons. That is the part that matters: an age does not thin
// because time passed, it thins because of what the people in it did, and
// each age did something different.
//
//   Wide       spent the arterial system running a network on it
//   Standing   spent nothing and could not staff what it had built
//   Counting   measured the fall, published it, and started the scramble
//   Burning    took by force what the Counting Age had only leased, and
//               killed enough ground doing it that taking stopped being worth
//               it, which is the Settlement and the present arrangement
//
// Dating is in years before the present, which is year 1,517 of the Low Fall's
// Standing Count. Whether that count is correct is a separate question and is
// dealt with under CALENDARS below.
// ─────────────────────────────────────────────────────────────────────────

/** Year 1,517 of the Standing Count, which is the Low Fall's reckoning. */
export const PRESENT_YEAR = 1_517;

export const AgeSchema = z.object({
    id: z.string(),
    /** What the present calls it. None of them called themselves this. */
    name: z.string().min(1),
    /**
     * Years before the present. `null` on the oldest age means the beginning
     * is beyond anything anyone can date, which is the honest state.
     */
    beganYearsAgo: z.number().int().positive().nullable(),
    /** Years before the present. `null` on the present age. */
    endedYearsAgo: z.number().int().min(0).nullable(),
    /** Ambient qi, 0..1, against the richest ground the world has carried. */
    qiDensity: z.number().min(0).max(1),
    whatItWas: z.string().min(200),
    whatItBuilt: z.string().min(200),
    /** What it was like to be an ordinary person in it. */
    livingThere: z.string().min(200),
    /**
     * Whether the people of the age knew they were declining. Three of the
     * four did, in different ways, and one was wrong about it in a way that
     * decided everything afterwards.
     */
    didTheyKnow: z.string().min(200),
    howItEnded: ClaimSchema,
    /** What the present would recognise, if it could read the record. */
    whatSurvives: z.array(z.string().min(40)).min(2),
    note: z.string().min(100)
});
export type Age = z.infer<typeof AgeSchema>;

export const AGES: readonly Age[] = [
    {
        id: 'age-wide',
        name: 'The Wide Age',
        beganYearsAgo: null,
        endedYearsAgo: 11_200,
        qiDensity: 0.94,
        whatItWas:
            'The age in which distance did not signify. A single order held ground from one end of the continent to the other, not because it was strong enough to hold it but because holding it was cheap: a person stepped between fixed points rather than travelling between them, and an administration that can be everywhere in an afternoon does not need provinces, garrisons or a second capital. Nothing since has been that large and nothing since has needed to be that small.',
        whatItBuilt:
            'The gate terminals, of which the Measured Span inherited a survey listing thirty-one. The roads, which is the part everybody walks on and nobody thinks about: the old roads run terminal to terminal and not town to town, so the present road network connects places with no reason to be connected and misses every market in both provinces. And the figures. True distance between two points is a Wide Age measurement and the Span has never produced an original one, only maintained the table.',
        livingThere:
            'Crowded, and by every account extremely uneven. The qi was thicker than anything now living has stood in and it was drawn on continuously by the network, so a person near a terminal lived in ground richer than the Hollow Court holds and a person four days away lived in ground the Low Fall would consider ordinary. There was no local anything: no local price, no local ruler, no local famine, because a shortfall anywhere was answered from somewhere else the same day. It is the only age in the record with no recorded famine at all, and the only one where a single failure could starve everybody.',
        didTheyKnow:
            'They knew the arterial veins were falling and they did not treat it as a problem, because for eleven thousand years of their own record it had never once mattered: the network moved qi to wherever it was short, so a drawn-down artery read as an accounting entry rather than as an event. Every surviving figure is a rate of draw, carefully kept, in a hand that plainly regarded the number as routine. Nobody has found a Wide Age document that treats the decline as anything other than administration.',
        howItEnded: {
            statement:
                'The Wide Age ended over a period nobody can bound, and the gates closed. Nine terminals still answer and twenty-two do not, and no account survives of a decision to close any of them.',
            truth: 'unresolved',
            heldBy: ['house-measured-span', 'house-anchorhold', 'apex-deep-survey'],
            evidence: [
                'thirty-one terminals exist, nine of which still answer when worked, which is not the behaviour of a network that was destroyed',
                'four of the nine open somewhere a person can breathe and five do not, and nothing distinguishes the two groups in any surviving figure',
                'the roads are intact, unmaintained, and go to terminals rather than to settlements, so nothing was fought over along them',
                'no scar, no dead ground and no tribulation signature anywhere in the terminal survey, which is the wrong evidence for a war',
                'the last dated Wide Age document anybody holds is a draw figure, not a warning'
            ],
            claimedOutcomes: [
                'the arterial system fell below what the network required to run and the gates closed on their own, one at a time, over generations that each thought the last one was the anomaly',
                'the gates were closed deliberately, by the order itself, for a reason it did not write down and possibly could not have written down',
                'something on the far side of the network stopped answering, and the closures are the near side of a failure that did not happen here at all',
                'the order did not end at all and the closures were an ordinary administrative withdrawal, after which the population simply became the Standing Age'
            ],
            fidelity: 'rumour'
        },
        whatSurvives: [
            'thirty-one gate terminals on the Measured Span survey, twenty-two closed and nine answering, none of them Span work',
            'the road network, which goes to terminals and is the reason travel in both provinces is inefficient in a way nobody can explain locally',
            'the true-distance table, which prices every courier contract and every freight span in the region and has never been recalculated',
            'the gate hand: a script on the terminal frames of which three sign groups are agreed and one of the three is agreed to be a number'
        ],
        note:
            'The Wide Age is the reason the world is late, and almost nothing in the present points at it. It spent the arterial system on ordinary administration over a span of time nobody can measure, and left a road network, a distance table and a silence.'
    },
    {
        id: 'age-standing',
        name: 'The Standing Age',
        beganYearsAgo: 11_200,
        endedYearsAgo: 5_600,
        qiDensity: 0.71,
        whatItWas:
            'What people did when distance came back. The Standing Age is the age of building things where they are used, and it is the only age in the record that was primarily civil rather than martial: weights, surveys, granaries, boundaries, drainage, a datum, a standard for everything that could be standardised. It inherited a continent it could no longer cross and it responded by making every part of it separately habitable, which took five and a half thousand years and worked.',
        whatItBuilt:
            'The node grammar, which is the single most consequential thing anybody has ever built in this world. A node is qi driven into stone and held there against the ground\'s own tendency to give it up; a network of them holds a pocket of density in place over ground that would not otherwise carry it. Every inherited compound in both provinces is Standing work, uses the same node spacing, the same node families and the same conventions, and no institution alive can cut one to the same specification. Also: the survey of record, the datum stone the Anchorhold keeps chained under a roof, the standard weights, and the practice yards, seat halls and granaries cut for populations nobody now fields.',
        livingThere:
            'Poorer than the Wide Age and enormously better organised. An ordinary person lived in one place their whole life, in a district with a boundary stone, under an administration that weighed their grain with a certified weight and recorded the transaction. Cultivation was ordinary rather than exalted: the works made thin ground workable, so a great many people got somewhere modest and almost nobody got very far, which is the opposite distribution to every age since. The Standing Age produced fewer crossings than any age in the record and more literate people than all the others combined.',
        didTheyKnow:
            'They knew exactly, they wrote it down, and they built the entire civilisation as an answer to it. The Standing hand has a standing formula that appears at the head of survey documents for four thousand years, and the numerals in it are readable even though the sentence is not: it is a comparison between a present figure and an older one, and the older one is always larger. They were the only civilisation in the record that understood its own position, and the works are what a civilisation builds when it has stopped expecting the ground to improve.',
        howItEnded: {
            statement:
                'The Standing Age ended without a war. The works required more people able to cut and hold nodes than the age could produce, the shortfall compounded for several centuries, and districts were abandoned in an order that follows the difficulty of their networks rather than the wealth of their ground.',
            truth: 'reconstructed',
            heldBy: ['house-anchorhold', 'apex-deep-survey', 'house-measured-span'],
            evidence: [
                'abandonment order tracks node count and not vein quality: the richest ground with the largest networks emptied first, which no invasion produces',
                'no scar layer, no burned seats and no mass graves anywhere in the Standing survey, in five and a half thousand years of it',
                'the last dated Standing documents are staffing returns, and the returns get shorter',
                'the boundary stones were never thrown down, which is what happens when a district is taken and does not happen when it is left',
                'the Sweptground Temple can cut six nodes to its own specification and all six are weak, which is the modern floor and demonstrates the gap'
            ],
            claimedOutcomes: [],
            fidelity: 'partial'
        },
        whatSurvives: [
            'every inherited compound in both provinces, at node counts far above what their occupants can light',
            'the datum stone, chained, roofed and watched by two people at all times, which is itself a marker referring to a survey nobody holds',
            'the standard weights, still the basis of every transaction in the Low Fall',
            'the Standing hand, whose numerals are fully readable because the weights and the distance table kept them in continuous use, and whose prose is not readable at all'
        ],
        note:
            'The Standing Age is the age the present is actually squatting in. A vein grant is a grant of ground plus works, the works are Standing works, and the reason a sect holds its vein at sufferance is that the thing being granted was built by somebody else and cannot be replaced.'
    },
    {
        id: 'age-counting',
        name: 'The Counting Age',
        beganYearsAgo: 5_600,
        endedYearsAgo: 2_400,
        qiDensity: 0.47,
        whatItWas:
            'The age of institutions rather than civilisations. Nothing in the Counting Age held a continent or wanted to; what it produced instead was bodies that specialised, persisted and outlived their founders, which is why every ancient house in both provinces dates from it and none from anywhere else. It is also the age of crossings. More cultivators went through the Lid in the Counting Age than in every age before and after it combined, which is the fact that makes it the age everybody wants back.',
        whatItBuilt:
            'The houses, the disciplines and the practice of specialising in one aspect of reality for thousands of years until nobody can compete. It also built the instruments: the first survey that measured ambient qi rather than describing it, the first tally of what a crossing costs, the first register of names, the first schedule. Almost nothing physical. The Counting Age is the only age that left more record than masonry, and it is the reason anything at all is known about the two ages before it.',
        livingThere:
            'Comfortable at the top and unremarkable below it, on ground still rich enough that an ordinary person in an ordinary district could reach Foundation Establishment without a patron. The houses were young, competitive and generous, and admission was easier than it has ever been since. What an ordinary person noticed was the measuring: surveyors, tallies, registers and inspections, everywhere, constantly, by nine institutions who did not coordinate and each wanted their own figure.',
        didTheyKnow:
            'They found out, and finding out is what ended them. The Counting Age is the age that discovered the decline as a measured rate rather than an impression, published it, and then discovered that a published rate is an instruction. Every account of the Burning Age that traces its own causes traces them to a figure, and the figure was correct.',
        howItEnded: {
            statement:
                'The Counting Age ended when the first arterial surveys were published and the great powers of the age acted on them. There is no single event and no date anybody defends; there is a century in which leases stopped being renewed everywhere at once and were not replaced by anything.',
            truth: 'reconstructed',
            heldBy: ['house-ninefold-ledger', 'house-anchorhold', 'apex-deep-survey', 'house-narrow-hour'],
            evidence: [
                'three surviving arterial figures from that century, from three institutions, agreeing to within a tenth, which is the only time in the record that any three surveys have agreed about anything',
                'lease and grant instruments from the Ledger\'s own tally volumes stop mid-series across nine unrelated parties within about eighty years',
                'the Narrow Hour has case records from the century showing an abrupt collapse in the number of live possibilities its predecessors could read, which it interprets as everybody having already decided',
                'no battle of any size is recorded for the first forty years of it, which is what a scramble looks like before it becomes a war'
            ],
            claimedOutcomes: [],
            fidelity: 'partial'
        },
        whatSurvives: [
            'every ancient house in both provinces, all of them founded inside this age and none outside it',
            'the disciplines themselves, which are the Counting Age\'s actual monument and are still being practised',
            'the first ambient survey, held in three incomplete copies by parties who will not lend them to each other',
            'six crossings from the Hollow Court alone, and the channels that still answer because of them'
        ],
        note:
            'The Counting Age is the world the present is nostalgic for and the world that caused the present. It measured honestly, published, and could not have predicted that an honest number would be read as a starting pistol.'
    },
    {
        id: 'age-burning',
        name: 'The Burning Age',
        beganYearsAgo: 2_400,
        endedYearsAgo: 1_517,
        qiDensity: 0.31,
        whatItWas:
            'Nine hundred years of taking. The shortest age in the record and the only one whose events still have names attached to them, because it is recent enough that the parties who did the taking are the parties still standing. Every scar, every dead province, every forbidden perimeter and most of the sealed sites in both provinces date from it. It is not a dark age in the sense of a collapse: the institutions functioned perfectly well throughout, kept excellent records, and used them to plan.',
        whatItBuilt:
            'Nothing. The Burning Age is the only age in the record with no construction layer at all. What it produced was destruction of a specific and deliberate kind: ground killed so that a rival could not hold it, networks broken rather than taken, and the discovery, made independently by several parties, that culling a region\'s cultivators frees its qi and that this works.',
        livingThere:
            'Survivable in inverse proportion to the quality of your ground. A district on a poor vein went untouched for nine hundred years; a district on a good one changed hands eleven times and then stopped existing. The Burning Age is where the present habit of not announcing anything comes from, and where the crossing practice hardened into what it is now, because a crossing was the single most reliably attended event of the age and almost nobody who attempted one in it was left alone.',
        didTheyKnow:
            'They knew the ground was being killed and they did it anyway, and the surviving arguments for it are not stupid. The Burning Age position, stated plainly in three separate places, is that the decline made the arithmetic unavoidable: a region carries so many cultivators, the number is falling, and a party that declines to act on that is choosing to be the one that is culled. Everybody who acted on it was individually correct and collectively catastrophic, and every institution that came out of it knows this and none of them will say it in a room.',
        howItEnded: {
            statement:
                'The Burning Age ended in the Settlement: an arrangement, not a treaty, under which water is granted rather than taken and a party that wants a holder gone stops renewing instead of attacking. Nobody knows who convened it, no instrument bearing that name survives, and the Bound Word does not hold one.',
            truth: 'unresolved',
            heldBy: ['house-bound-word', 'house-ninefold-ledger', 'apex-deep-survey', 'apex-long-cut'],
            evidence: [
                'the practice changed within about a decade across both provinces and every tradition, which is not how customs change and is exactly how instruments do',
                'the Bound Word holds eleven agreements dated to that decade, all of them subsidiary, all of them referring to terms they do not restate',
                'grant language in nine unrelated houses converges on the same four clauses in the same order within a generation',
                'the Low Fall counts its years from it, so at minimum somebody at the time was certain enough to reset a calendar'
            ],
            claimedOutcomes: [
                'an instrument was made, was witnessed, and is in somebody\'s keeping unpublished, most likely an apex that has never confirmed holding anything',
                'no instrument was ever made and the convergence is exhaustion: every party independently arrived at granting because taking had stopped paying, and the eleven subsidiary agreements refer to a consensus rather than to a document',
                'something was said from above the Lid and passed down through the channels of the day, which would explain the speed and the silence and is held quietly by two institutions who cannot produce it',
                'it was imposed, by a party strong enough that nobody has ever named it in writing, and the reason no instrument survives is that none was needed'
            ],
            fidelity: 'partial'
        },
        whatSurvives: [
            'the pyramid itself: grant, tribute, renewal, non-renewal, and every clause in it',
            'the scars, the dead provinces and the eleven containment perimeters the Anchorhold maintains',
            'the crossing practice, which is a Burning Age adaptation that nobody has seen a reason to abandon',
            'the standing grievances of every institution founded before it against every institution founded before it'
        ],
        note:
            'The Burning Age is why the map is not on fire now. Everything stabilising about the present arrangement was invented by parties who had just spent nine centuries proving the alternative, and the arrangement holds because all of them remember what it is an alternative to.'
    },
    {
        id: 'age-present',
        name: 'The Standing Count',
        beganYearsAgo: 1_517,
        endedYearsAgo: null,
        qiDensity: 0.22,
        whatItWas:
            'The present, and nobody living in it calls it an age. The Low Fall calls the period the Standing Count because that is the name of its calendar, the Quiet Marches does not name it at all, and the term the two archivist institutions use between themselves for the whole situation is not in general circulation. It is fifteen centuries of granting rather than taking, on ground that has continued to fall the entire time, with no construction, no new discipline and one confirmed crossing in the last four hundred years.',
        whatItBuilt:
            'Institutions inside inherited buildings. The present age has built ferry towns, market towns, sorting yards, register houses, a counter register, a courier network laid over somebody else\'s roads, and one complete formation of six weak nodes at the Sweptground Temple, which is the only entirely new working formation in the province and is cited by everybody on all sides of every argument about whether the age can build anything.',
        livingThere:
            'Thin, ordinary and survivable, and for most people uneventful in a way the earlier ages were not. Progress is slow, the ceiling arrives early, and the ruins are so common that a village granary is built against a wall nobody remembers building. What the present has that no earlier age had is the wreckage of four ages lying open, and the whole exploration economy is people digging in it.',
        didTheyKnow:
            'The present knows the ground is thin and mostly explains it as bad luck or as the sins of the Burning Age, which is a quarter true. Two institutions hold the fuller account and neither publishes it: the Anchorhold, which can read the numerals and has the datum, and the Deep Survey, which has the arterial figures and no reason to share them. Everybody else believes the world was always going to end up like this and that the ancients were simply better, which is the most comfortable available error.',
        howItEnded: {
            statement:
                'It has not ended. Ambient qi is still falling at a rate the Deep Survey measures and does not publish, and no institution in either province has a plan that addresses it rather than positions against it.',
            truth: 'objective',
            heldBy: [],
            evidence: [
                'the age is current, and the fall is measured against the datum stone and against the Ninth Nail independently'
            ],
            claimedOutcomes: [],
            fidelity: 'full'
        },
        whatSurvives: [
            'everything, because nothing has happened to it yet',
            'one confirmed crossing in four hundred years, and the institution that produced it is the strongest in the world on the strength of it'
        ],
        note:
            'The present is not unlucky. It is late, and the four things that made it late are all still visible if anybody puts the four surveys on the same table, which no two of the parties holding them will do.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// DEAD CIVILISATIONS
//
// Distinct from the sects and houses that came after, and not the same kind of
// thing. A house is an institution with a discipline; these were populations
// with an infrastructure, and what they left is not a technique but a
// utility that the present is still consuming.
//
// Every surviving work below is tied to something already in the catalogs. No
// parallel wreckage is invented: the compounds are the compounds the sects are
// standing in, the terminals are the Measured Span's terminals, the weights
// and the datum are the Anchorhold's.
// ─────────────────────────────────────────────────────────────────────────

export const SurvivingWorkSchema = z.object({
    /** What the present has, physically. */
    what: z.string().min(60),
    /** Faction currently holding, squatting in, or pricing off it. */
    heldByFactionId: z.string().nullable(),
    /**
     * Where the work is a formation compound, the node figures the sect
     * catalog carries. The test asserts these against `SECTS` so this file
     * cannot drift from the compounds it is explaining.
     */
    nodes: z.object({ total: z.number().int().min(0), lit: z.number().int().min(0) }).nullable(),
    /** Why the present cannot reproduce it. Never "it is lost". */
    whyItCannotBeReplaced: z.string().min(80)
});
export type SurvivingWork = z.infer<typeof SurvivingWorkSchema>;

export const DeadCivilisationSchema = z.object({
    id: z.string(),
    /** What the present calls them. None of these are names they used. */
    name: z.string().min(1),
    /** Whether anybody can show that they existed at all. */
    existence: z.enum(['established', 'disputed']),
    ageId: z.string(),
    /** What the name is derived from, which is usually a count of something. */
    whyThatName: z.string().min(100),
    whoTheyWere: z.string().min(200),
    /** The specific capability. One thing, stated so a player can want it. */
    whatTheyCouldDo: z.string().min(200),
    survivingWorks: z.array(SurvivingWorkSchema).min(2),
    /** What is known about the end, at whatever truth value it deserves. */
    theEnd: ClaimSchema,
    /** How a player could find out any of this, and from whom. */
    howItIsDiscoverable: z.array(z.string().min(50)).min(3),
    note: z.string().min(120)
});
export type DeadCivilisation = z.infer<typeof DeadCivilisationSchema>;

export const DEAD_CIVILISATIONS: readonly DeadCivilisation[] = [
    {
        id: 'dead-thirty-one',
        name: 'The Thirty-One',
        existence: 'established',
        ageId: 'age-wide',
        whyThatName:
            'For the terminal count on the survey the Measured Span inherited, which is the only number about them anybody can state. It is very likely wrong: the Anchorhold\'s fixed survey disagrees with the Span\'s in four places, all of them over arterial ground, and at least one of the four is a site the Span lists as a terminal and the Anchorhold does not.',
        whoTheyWere:
            'An administration that held the continent, and whose entire character follows from the fact that it could be anywhere in it the same afternoon. No provinces, no local authorities, no second seat, no garrisons, and an extraordinary volume of routine paperwork about draw rates, stocks and shortfalls. Every surviving fragment of them is a clerk\'s document. Whatever they were called and whoever they answered to, what is legible of them is an office, not a court, and they left no monument to anybody at all.',
        whatTheyCouldDo:
            'Move people and cargo between fixed points without crossing the distance between them, permanently, in both directions, at will, and at a scale that fed a continent. The Measured Span can fold a courier down a route it has surveyed and can build a one-way gate at ruinous cost; it has never in five thousand years produced a permanent two-way span, and the nine terminals that still answer are doing exactly that, unattended, having been unmaintained for eleven thousand years.',
        survivingWorks: [
            {
                what: 'Thirty-one gate terminals on the inherited survey. Twenty-two closed, nine still answering, four of the nine opening somewhere a person can breathe and five somewhere they cannot.',
                heldByFactionId: 'house-measured-span',
                nodes: { total: 58, lit: 29 },
                whyItCannotBeReplaced:
                    'The Span has spent six hundred years trying to reopen one span at one station and keeps a swept gate frame with no gate in it there. Every attempt it has made from first principles has produced a gate that runs one way and closes, which is a different object.'
            },
            {
                what: 'The true-distance table: the difference between the walked distance and the true distance between any two points in the region.',
                heldByFactionId: 'house-measured-span',
                nodes: null,
                whyItCannotBeReplaced:
                    'The Span maintains the table, corrects it where the ground has moved, and prices the whole region off it, and has never produced an original measurement. Its method reads a distance; the table states one, for pairs of points nobody has ever surveyed.'
            },
            {
                what: 'The road network, which runs terminal to terminal rather than settlement to settlement and is the reason travel in both provinces is inefficient in a way no local explanation covers.',
                heldByFactionId: null,
                nodes: null,
                whyItCannotBeReplaced:
                    'It does not need replacing and that is the point: it is a functioning road system built for a purpose that no longer exists, so everybody uses it and nobody can say why it goes where it goes.'
            }
        ],
        theEnd: {
            statement:
                'The gates closed. Whether the Thirty-One ended before, during or after that is not established, and no account of an ending survives in any hand anybody can read.',
            truth: 'unresolved',
            heldBy: ['house-measured-span', 'house-anchorhold'],
            evidence: [
                'nine terminals still answer, which is not what a destroyed network looks like',
                'no scar, no burn layer and no battle debris anywhere in the terminal survey',
                'the last legible Wide Age figures are routine, and the hand does not change'
            ],
            claimedOutcomes: [
                'the arterial draw fell below what the network needed and the terminals closed one at a time over centuries',
                'they closed them deliberately and left, and the nine that answer are the ones they did not get to',
                'the five terminals that open somewhere unbreathable are where they went, and the closures are on the far side',
                'nothing ended: the population stayed and became the Standing Age, and the Thirty-One is a name for an administration rather than a people'
            ],
            fidelity: 'rumour'
        },
        howItIsDiscoverable: [
            'walking the old roads and noticing that they connect nothing, then finding what is at the ends of them',
            'a Measured Span station warden who will explain, at length and for free, why the swept gate frame is swept',
            'comparing the Span survey and the Anchorhold survey, which disagree in four places, all arterial, and asking why nobody has resolved it',
            'the gate hand on a terminal frame, and the fact that a Cinnabar Crucible reader can tell you it is not method-script and nothing else'
        ],
        note:
            'The Thirty-One are the reason the world is thin and almost nothing in the present points at them. They spent the arterial system on freight and correspondence over a period nobody can measure, and the only institution that could reconstruct it has no reason to and no instrument for the arterial layer at all.'
    },
    {
        id: 'dead-standing-works',
        name: 'The Standing Works',
        existence: 'established',
        ageId: 'age-standing',
        whyThatName:
            'Because the works are still standing, which is the whole of the reasoning. The Standing hand has a sign group at the head of survey documents that three parties transliterate three different ways, and it is not agreed whether it is a name, an office, or the word for the survey itself.',
        whoTheyWere:
            'A civil administration that inherited a continent it could no longer cross, understood exactly what had happened to it, and spent five and a half thousand years making each part of it separately habitable. They weighed, surveyed, drained, bounded and recorded. They produced fewer crossings than any age in the record and more literate people than every other age combined, and every institution in both provinces that keeps a register, certifies a weight or argues a boundary is doing a Standing Works job in a Standing Works format without knowing it.',
        whatTheyCouldDo:
            'Cut a node: drive qi into stone and hold it there against the ground\'s own tendency to give it up, to a specification that has held for eleven thousand years unattended. A network of nodes holds a pocket of density over ground that would not otherwise carry it, which is why an inherited compound is denser than the land around it and why a sect that loses its works loses its vein whether or not it keeps the ground.',
        survivingWorks: [
            {
                what: 'The Azure Cloud Pavilion\'s compound, with a practice yard cut for six hundred and a formation network the Pavilion works a fraction of.',
                heldByFactionId: 'sect-azure-cloud-pavilion',
                nodes: { total: 41, lit: 9 },
                whyItCannotBeReplaced:
                    'The strongest institution in the world, holding an ancestral channel and an income of consumables from above, lights nine nodes out of forty-one and has never lit a tenth. Wealth is not the constraint and never was.'
            },
            {
                what: 'The Nine Peaks Ascetic Order\'s compound, including a doorway on the fourth peak with handprints burned into the jamb at a height nobody in the Order can reach flat-footed.',
                heldByFactionId: 'sect-nine-peaks-ascetic-order',
                nodes: { total: 63, lit: 11 },
                whyItCannotBeReplaced:
                    'Sixty-three nodes on a mountain held continuously by an order that has never had more than a few dozen members, which is the clearest available demonstration that the works were built for a population that no longer exists.'
            },
            {
                what: 'The datum stone: a marker at the centre of the survey that every measurement in the Low Fall is ultimately taken from, chained down, under a roof, watched by two people at all times.',
                heldByFactionId: 'house-anchorhold',
                nodes: { total: 88, lit: 62 },
                whyItCannotBeReplaced:
                    'It is not a datum. It is a marker referring to a survey the Anchorhold does not hold, which means every boundary, weight and property argument in the province is being resolved against a citation rather than against an origin.'
            },
            {
                what: 'The standard weights, and the numerals they are marked in, which are the only part of the Standing hand anybody can read completely.',
                heldByFactionId: 'house-anchorhold',
                nodes: null,
                whyItCannotBeReplaced:
                    'They survived because they were never out of use. Everything else in the hand fell out of use and is now unreadable, which is the whole mechanism of how a script dies while its numbers live.'
            },
            {
                what: 'The Weir Office\'s flood works, built to manage water by people who plainly also used it to manage qi.',
                heldByFactionId: 'sect-weir-office',
                nodes: { total: 26, lit: 7 },
                whyItCannotBeReplaced:
                    'Seven of twenty-six nodes hold both of the region\'s remaining pockets. The Office is aware that whatever the other nineteen were doing, they were doing it to a province that is now driven ground.'
            }
        ],
        theEnd: {
            statement:
                'The Standing Works ran short of people who could cut and hold nodes, for several centuries, and abandoned districts in an order that follows network difficulty rather than ground quality.',
            truth: 'reconstructed',
            heldBy: ['house-anchorhold', 'apex-deep-survey'],
            evidence: [
                'the abandonment order tracks node count, not vein quality, which no invasion produces',
                'the last dated Standing documents are staffing returns and the returns get shorter',
                'the boundary stones were never thrown down anywhere in the survey',
                'no scar layer at all across five and a half thousand years'
            ],
            claimedOutcomes: [],
            fidelity: 'partial'
        },
        howItIsDiscoverable: [
            'counting nodes in two compounds held by unrelated sects and finding the same spacing and the same node families',
            'the Sweptground Temple, whose six self-cut nodes are the only complete modern formation in the province and are all weak',
            'a Gleaners Company salvage crew, who work the front of a compound they did not build and can describe exactly where the work stops being theirs',
            'the Anchorhold\'s own numerals, which any careful person can learn to read in a season, at which point every Standing document becomes a readable table of quantities inside an unreadable sentence'
        ],
        note:
            'This is the civilisation the present is actually living inside. The pyramid, the vein lease and the phrase "holds a vein at sufferance" all resolve to the same thing: the thing being granted was built by the Standing Works, cannot be rebuilt, and is being spent.'
    },
    {
        id: 'dead-before-the-gates',
        name: 'Whoever Cut the Terminal Seats',
        existence: 'disputed',
        ageId: 'age-wide',
        whyThatName:
            'It has no name because most parties do not accept that it is a thing. The phrase is a description of the evidence: at eleven of the thirty-one terminals the frame sits in a seat that was cut before the frame and to a different standard, and the seat is not Wide Age work.',
        whoTheyWere:
            'Unknown, and possibly nobody. The claim is that the Thirty-One did not build the gate network but inherited it, refitted it, and ran it, exactly as the present inherited the Standing Works and lights a ninth of them. It is held by two people: an Elder Surveyor of the Measured Span who has published nothing, and a Warden of the Anchorhold\'s survey who has published a note about seat tooling and has been left alone about it because nobody read it.',
        whatTheyCouldDo:
            'Nothing anybody can state, which is the honest position. The seats are cut, they are older than the frames sitting in them, and the tooling is not a tooling anybody can match to a known hand. Every other statement about them is an inference from eleven holes in the ground.',
        survivingWorks: [
            {
                what: 'Eleven terminal seats whose tooling predates the frames set into them, on the Measured Span\'s own stations.',
                heldByFactionId: 'house-measured-span',
                nodes: null,
                whyItCannotBeReplaced:
                    'Nobody is trying to replace them. The Span\'s Freight faction regards the whole question as an antiquarian expense and the Long Measure faction regards it as the only lead anybody has ever had on reopening a gate.'
            },
            {
                what: 'A tooling note in the Anchorhold\'s survey appendix, four pages, unread by anybody outside the house in ninety years.',
                heldByFactionId: 'house-anchorhold',
                nodes: null,
                whyItCannotBeReplaced:
                    'It is a live document in a working archive that nobody consults, which is the ordinary way a fact stays lost in a world that writes things down.'
            }
        ],
        theEnd: {
            statement:
                'There is no established civilisation here and therefore no end. What exists is eleven seats, a tooling difference, and two people who think it means something.',
            truth: 'unresolved',
            heldBy: ['house-measured-span', 'house-anchorhold'],
            evidence: [
                'eleven of thirty-one seats show tooling that does not match the frames set into them',
                'the mismatch is consistent across all eleven and absent from the other twenty',
                'the four terminals the two surveys disagree about are not among the eleven, which nobody has explained'
            ],
            claimedOutcomes: [
                'a civilisation before the Wide Age cut the seats, and the Thirty-One inherited and refitted a network exactly as the present inherited the Standing Works',
                'the Thirty-One cut the seats themselves, early, and changed their own standard once, which would make the eleven the oldest terminals rather than the oldest anything',
                'the eleven are repairs: seats recut later to a field standard by whoever was maintaining the network at the end, which would date them younger rather than older',
                'the tooling difference is not a difference, and the Warden measured badly'
            ],
            fidelity: 'rumour'
        },
        howItIsDiscoverable: [
            'a Long Measure surveyor who will talk about the seats for an hour and expects to be laughed at',
            'reading the Anchorhold survey appendix, which requires only being permitted into the archive and having a reason',
            'looking at two seats and noticing that one of them was cut with something that does not leave the same mark'
        ],
        note:
            'Deliberately unresolved and deliberately small. The point is not that there was an older civilisation; it is that the past keeps going down, that the evidence for the next layer is always this thin, and that at every layer the people looking at it are two eccentrics nobody reads.'
    }
];

/**
 * The two traditions, reconciled against the Standing Works.
 *
 * The catalogs already carry a tension that this file has to answer rather
 * than paper over. The Cut Road as a mass practice dates from the weir
 * inversion nine hundred years ago, and the Long Cut's ancestor was a carver
 * who crossed from driven ground twenty-six hundred years ago. Both are true,
 * because driven ground is not a Marches invention and the hierarchy catalog
 * already says so: the Long Cut administers every province where the qi went
 * into the stone, of which the Quiet Marches is one and not the largest.
 *
 * What this file adds is the reason driven ground exists at all, and it is
 * uncomfortable for both traditions.
 */
export const DRIVEN_GROUND_AND_THE_NODE: Claim = {
    statement:
        'A Standing Works node is qi driven into stone and held there. A carver\'s seam is qi driven into stone and worked out. They are very likely the same physical thing at two scales, and the Cut Road is therefore an unwitting reconstruction of one part of a Standing Works trade.',
    truth: 'reconstructed',
    heldBy: ['house-anchorhold'],
    evidence: [
        'the Weir Office\'s flood works have nodes cut into stone rather than laid on ground, which is the only place in either province where Standing work and Cut work are the same operation on the same site',
        'the Cut Road was reconstructed from nothing in nine hundred years by people with no manuals, which is a plausible span for rediscovering a technique and a very short one for inventing a road',
        'driven ground is not confined to the Marches and predates it by ages, so the weir inversion made a province of a thing that already existed rather than making the thing',
        'a carver can work a Standing node out of a wall and does not find it different in kind from a face, which several Gleaners Company crews will confirm and no Anchorhold Warden will discuss'
    ],
    claimedOutcomes: [],
    fidelity: 'partial'
};

/** Why nobody has ever said the sentence above in a room with both traditions in it. */
export const WHY_THE_RECONCILIATION_IS_NOT_MADE = [
    'The Anchorhold holds it, has not published it, and does not intend to. Its own discipline is fixity, its own founding account is already in trouble on dates, and a finding that the carvers are doing Standing work is a finding that the house that keeps the survey has been treating a live tradition as quarrying for nine hundred years.',
    'The Drawn will not hear it, because it makes carving older and more legitimate than the Drawn Road\'s own account of itself, and the standing Low Fall position is that carving is quarrying with extra steps.',
    'The Cut will not hear it either, and this is the part outsiders get wrong. A carver\'s objection is not sentimental: the Marches account of itself is that the Cut Road was built from nothing by people who were dying of the ground, in living memory, without help. Being told they recovered somebody else\'s trade takes the one thing the province is actually proud of.',
    'And it would change what a vein lease is. If a node and a seam are the same thing, then a Drawn sect holding lit nodes and a carver holding a face are holding the same asset under two entirely different bodies of law, which is a question no arbitration in the world currently has a forum for.'
] as const;

// ─────────────────────────────────────────────────────────────────────────
// WHERE CULTIVATION CAME FROM
//
// Four accounts, none endorsed, one of them demonstrably wrong and held by
// most of the world. The engine does not know the answer and must not
// acquire one here.
// ─────────────────────────────────────────────────────────────────────────

export const OriginAccountSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** Faction ids. At least one, because an account nobody holds is not one. */
    heldBy: z.array(z.string()).min(1),
    /** Roughly how much of the world holds it. */
    currency: z.enum(['most_of_the_world', 'widespread', 'institutional', 'minority', 'two_people']),
    account: z.string().min(200),
    /** Why the realms have the shape they do, on this account. */
    whyTheRealmsHaveTheirShape: z.string().min(150),
    evidence: z.array(z.string().min(40)).min(2),
    /** The thing it cannot answer. Every account has one. */
    theProblem: z.string().min(150),
    /**
     * True on exactly one account: it is refutable from surviving evidence,
     * and is held anyway. The refutation and the reason it does not land are
     * both required.
     */
    demonstrablyWrong: z.object({
        refutation: z.string().min(150),
        whyItIsStillHeld: z.string().min(150),
        whoCouldDemonstrateIt: z.array(z.string()).min(1)
    }).nullable()
});
export type OriginAccount = z.infer<typeof OriginAccountSchema>;

export const ORIGIN_ACCOUNTS: readonly OriginAccount[] = [
    {
        id: 'origin-taught',
        name: 'The Taught Account',
        heldBy: [
            'sect-azure-cloud-pavilion',
            'sect-verdant-spring-hall',
            'sect-nine-peaks-ascetic-order',
            'sect-frostmirror-sect',
            'sect-storm-tyrant-sect',
            'sect-clear-river-alliance'
        ],
        currency: 'most_of_the_world',
        account:
            'That the ladder was given. Somebody came down, at the beginning, and taught it: the realms are a curriculum, the boundaries are the ends of lessons, and the tribulation is an examination. Almost every sect in both provinces teaches some version of this, and the version taught at an outer gate is usually a story with a named teacher in it whose name differs by sect and whose sect is always the one telling it.',
        whyTheRealmsHaveTheirShape:
            'Because a curriculum has stages, and the stages are where a teacher decided one thing had been learned and the next could begin. On this account the boundaries are pedagogical, the Price of Advancement is a fee, and the shape of the ladder is evidence of an intention.',
        evidence: [
            'manuals across the entire world share a structure: the same order of sections, the same conventions for marking a stage, the same phrase forms at the head of a passage',
            'the ladder itself is identical everywhere, in both traditions, with the same boundaries at the same places, which is a remarkable thing to be true by accident',
            'the Hollow Court receives accounts of the crossing from somebody who made it, which establishes at minimum that instruction across the Lid is possible',
            'the Ninth Nail was driven through from above by somebody who intended it to be found and used, which is teaching in every sense that matters'
        ],
        theProblem:
            'It has no teacher. Not a name that survives, not a site, not a manual that claims to be the first one, and nothing anywhere in the record that behaves like a founding transmission rather than a copy of a copy. Every named teacher in every sect version is a sect ancestor, and no two sects name the same one.',
        demonstrablyWrong: {
            refutation:
                'The shared structure is a copying artifact and not a doctrine. The Standing Works standardised manual formatting the way they standardised weights: section order, stage marks and head phrases are Standing survey conventions applied to instructional documents, and they appear in every manual in the world because every manual in the world descends from a Standing-era recopying programme. Pre-Standing manual fragments exist, they do not share the structure, and they do not share it in exactly the places the convention would predict.',
            whyItIsStillHeld:
                'Because the fragments that refute it are in two collections and neither will lend. The Deep Survey holds a set it has never described to anybody, and the Cinnabar Crucible Guild holds three sheets it believes to be a defective alchemy text and has never shown to a person who reads the Standing hand. Nobody has ever put a pre-Standing and a post-Standing manual on the same table, so the argument has never been made in a room, and the account is far too useful to a sect that wants to be descended from a teacher for anybody inside one to go looking.',
            whoCouldDemonstrateIt: ['apex-deep-survey', 'house-anchorhold', 'sect-cinnabar-crucible-guild']
        }
    },
    {
        id: 'origin-found',
        name: 'The Found Account',
        heldBy: ['house-measured-span', 'house-anchorhold', 'apex-deep-survey', 'sect-sixmile-wardens'],
        currency: 'institutional',
        account:
            'That cultivation was not invented and not given. It is a property of the world, the way a vein is, and the first cultivators were the first people to notice a thing that had always been there. The surveying houses hold this because it is what a surveyor believes about everything: the world has features, features can be measured, and the question of who put them there is not a question a survey can be asked.',
        whyTheRealmsHaveTheirShape:
            'Because the world has boundaries at those places, in the same sense that a river has banks. On this account the tribulation is not an examination and not a fee but a physical event at a physical edge, which is why it leaves scars that can be surveyed and quarantined like any other terrain.',
        evidence: [
            'the tribulation is physical: it leaves ground that can be measured, perimeter and radius, and the Anchorhold nails four such sites shut',
            'the boundaries are identical in the two traditions, which share no method, no vocabulary, no lineage and no manuals, and have been mutually contemptuous for nine hundred years',
            'the ladder does not vary by region, by ground quality or by teaching, which is a very strange property for a curriculum and a very ordinary one for terrain',
            'nothing in the record has ever moved a boundary, and several extremely well-resourced parties have tried'
        ],
        theProblem:
            'Thirteen and four. Qi Condensation divides into thirteen stages and every other realm on the ladder divides into four, universally, in both traditions, and no natural feature anybody has ever surveyed does anything remotely like that. The Found account has no explanation for the asymmetry, has never produced one, and its own surveyors regard it as the strongest argument against them.',
        demonstrablyWrong: null
    },
    {
        id: 'origin-built',
        name: 'The Built Account',
        heldBy: ['house-narrow-hour', 'house-ninefold-ledger', 'house-bound-word'],
        currency: 'institutional',
        account:
            'That somebody built it. The ladder is a work, the boundaries are its joints, and the tribulation is its enforcement. The three houses that hold this hold it for three incompatible reasons and are not allies about it: the fate house because a structure that prunes is a structure somebody shaped, the karma house because a charge that specific is a term, and the oath house because a rule with an enforcement clause is an agreement whether or not anybody signed it.',
        whyTheRealmsHaveTheirShape:
            'Because a builder chose. On this account the thirteen and the four are the strongest evidence anybody has: thirteen at the bottom and four everywhere above is not a natural number and not a pedagogical one either, it is the shape of a decision, and the decision is legible even though the decider is not.',
        evidence: [
            'thirteen at the bottom and four above, which reads as a design choice and nothing else',
            'the Price of Advancement takes something specific rather than something proportional, which is a term and not a weather',
            'the tribulation arrives, which is to say something responds, and a response requires a responder even if nobody can name one',
            'the Bound Word can demonstrate that an oath sworn on unfixed ground does not bind, which establishes that the world enforces terms against ground rather than against intent'
        ],
        theProblem:
            'No builder, no site, no method, no tool and no artifact of the building, in eleven thousand years of digging, by a world whose entire economy is digging. The Built account has never produced a single object. Its holders answer that a work this size would not leave the kind of debris anybody is looking for, which is true and is also exactly what an unfalsifiable position sounds like, and all three houses know it.',
        demonstrablyWrong: null
    },
    {
        id: 'origin-workshop',
        name: 'The Workshop Account',
        heldBy: ['apex-long-cut', 'sect-gleaners-company'],
        currency: 'minority',
        account:
            'That there is no ladder, only material. The Cut Road position, held by carvers and by nobody in the Low Fall, is that the realms are simply the points at which the material fails and has to be worked differently, and that the Drawn dressed a workshop fact up as cosmology because they cultivate in the air where nothing can be seen. A carver will tell you the boundaries are where the stone changes, and will not be joking.',
        whyTheRealmsHaveTheirShape:
            'Because material has grain, and grain changes at intervals. On this account the ladder has the shape of the world\'s stone rather than of anybody\'s intention, and the thirteen at the bottom is simply the number of times a face changes character before it settles.',
        evidence: [
            'a face genuinely does change character at intervals a carver can predict, and the intervals correspond to the boundaries',
            'nothing in the Cut Road requires the ladder to be anything: the road was reconstructed from scratch in nine hundred years by people with no manuals, and it arrived at the same rungs',
            'the seam is material, is worked with tools, and can be quarried, which makes cultivation on this account a trade with a stock rather than a mystery'
        ],
        theProblem:
            'It is wrong about the Drawn and knows it is not permitted to be. The ordinals are the same for cultivators who have never touched stone, on ground with no workable face within a province, and the Workshop account has to say that this is a coincidence of two materials having the same grain. The Long Cut, which is legalistic and honest, records the account as the tradition\'s position and does not defend it.',
        demonstrablyWrong: null
    }
];

/**
 * The first cultivators, which is a separate question from where the ladder
 * came from and is in worse shape. Three pieces of evidence, three
 * incompatible implications, no resolution, and the engine does not have one.
 */
export const THE_FIRST_CULTIVATORS: Claim = {
    statement:
        'Nobody can name a first cultivator, place one, or date one. What exists is three pieces of evidence, and they cannot all be about the same beginning.',
    truth: 'unresolved',
    heldBy: ['house-anchorhold', 'house-measured-span', 'sect-hollow-court', 'apex-deep-survey'],
    evidence: [
        'the Standing hand has a sign group for a practitioner that appears in documents older than any manual anybody holds, in survey contexts, treated as an ordinary occupation alongside masons and weighers',
        'the gate terminals cannot be worked by anyone now living, and the Measured Span\'s own estimate of what operating one would require is a realm nobody in the world currently occupies, which means the Wide Age already had people above the present ceiling',
        'the Hollow Court has an account from above, received roughly nine hundred years ago and never reconciled with the rest, in which the person who made the crossing describes the approach in terms that do not assume the ladder has a bottom'
    ],
    claimedOutcomes: [
        'cultivation is older than every civilisation in the record and the question has no answer inside this world at all',
        'the Wide Age had it, taught it as an occupation, and everything since is a degraded transmission of a Wide Age trade',
        'there were several beginnings, unrelated, and the ladder is what all of them converged on because it is what is there',
        'the account from above is not about this world and the Court has been treating a description of somewhere else as evidence for four thousand years'
    ],
    fidelity: 'rumour'
};

// ─────────────────────────────────────────────────────────────────────────
// THE LID
//
// The important one. Nobody below it knows what it is. Four institutions hold
// four incompatible theories, each with real evidence and a real problem, and
// two serious bodies hold no theory at all in ways that are worse than any of
// the theories.
//
// This is `truth: 'unresolved'` and it stays that way. The houses disagree
// along the lines of their own principles, which is not a coincidence and is
// the honest reason the disagreement is permanent: a fixity house looking at
// the Lid sees a containment because a fixity house looking at anything sees a
// containment, and a fate house sees a narrowing for the same reason. Each is
// reasoning correctly from an instrument that only reads one thing.
// ─────────────────────────────────────────────────────────────────────────

export const LidTheorySchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** The house or body that holds it, by id. */
    heldBy: z.string(),
    /** The principle the holder reads everything through. */
    throughWhichPrinciple: z.string().min(1),
    theory: z.string().min(250),
    /** Real evidence, which must be evidence the holder actually possesses. */
    evidence: z.array(z.string().min(50)).min(3),
    /** The thing it cannot answer, stated as an opponent would state it. */
    cannotAnswer: z.string().min(200),
    /** What the holder says when the problem is put to them. */
    theirAnswerToThat: z.string().min(150),
    /** What follows in the world if this one happens to be right. */
    ifItIsTrue: z.string().min(120)
});
export type LidTheory = z.infer<typeof LidTheorySchema>;

export const LID_THEORIES: readonly LidTheory[] = [
    {
        id: 'lid-containment',
        name: 'The Containment',
        heldBy: 'house-anchorhold',
        throughWhichPrinciple: 'fixity',
        theory:
            'That the Lid is an anchor. Not a wall, not a door and not a distance: a containment, of exactly the kind the Anchorhold maintains around four catastrophe sites, differing from those only in age and scale. The house\'s position is that the Lid is doing the same job as its eleven perimeters and can be reasoned about with the same discipline, and that everybody else is confused because they are looking at what is on the other side instead of at the boundary itself.',
        evidence: [
            'the Lid does not distinguish a hole made outward from one made inward, which is the defining behaviour of a containment and is not a property of a wall, a gate or a distance',
            'a span cannot be folded through it, exactly as a span cannot be folded through anchored ground, and the Measured Span has never disputed this measurement',
            'the tribulation drawn by an immortal coming down is indistinguishable in kind from what a perimeter does to something crossing it outward, which the Anchorhold has measured on its own sites',
            'the crossing is survivable only for something that has been changed enough to belong on the far side, which is how every containment the house maintains behaves at its edge'
        ],
        cannotAnswer:
            'A containment has a holder. Every containment the Anchorhold has ever certified, without exception, fails when nobody is holding it, and the failure is the house\'s entire business: it maintains eleven perimeters because eleven perimeters would otherwise let go. The Lid has not let go in the whole recoverable record, and there is no nail, no datum, no staff and no institution anywhere that claims to be holding it.',
        theirAnswerToThat:
            'That the holder exists and is not in the survey, which the house concedes is an admission rather than an argument. Its internal position, written down and not published, is that the Kiln Wardens are staff of something, that the deep vein at the world\'s root is a datum of some kind, and that these two facts sit uncomfortably close to the question and cannot be pursued because the Wardens do not answer anyone.',
        ifItIsTrue:
            'Somebody is holding it, has held it since before the record, and the entire history of the world is happening inside a maintained perimeter. It also means it can fail, which is the part the Anchorhold does not put in writing.'
    },
    {
        id: 'lid-distance',
        name: 'The Long Span',
        heldBy: 'house-measured-span',
        throughWhichPrinciple: 'space',
        theory:
            'That the Lid is not a lid. It is a distance, and the other side is not above but far. The house holds that the whole vocabulary of ascension is a walked-distance description of a true-distance fact: the crossing is a span, its cost is a span\'s cost, the stripping is what a span does to anything not part of the traveller, and the density on the far side is simply what somewhere else is like. The Span is untroubled by this being unromantic and considers that a point in its favour.',
        evidence: [
            'the true distance to the far side is finite and the house has computed it three times from different stations, getting three figures within a hand of each other, while the walked distance does not exist at all',
            'the crossing strips everything not part of the traveller, which is precisely what the house\'s own gates do to cargo above a mass and is not a property of any wall or containment',
            'the nine answering terminals do the same operation at small scale, unattended, and five of them open somewhere nothing can breathe, which establishes that a span can end somewhere uninhabitable without anything being wrong with the span',
            'information crosses and matter mostly does not, in exactly the ratio the house observes on its own long routes'
        ],
        cannotAnswer:
            'Their spans go both ways in principle and this one does not. Worse for them: on their own theory a terminal could in principle open on ground of any density, and not one of the thirty-one opens anywhere near immortal-realm density, including the five that open somewhere unbreathable. The Span has no account of why the largest span in the world has one direction, and no account of why its own network cannot reach the destination its own figures locate.',
        theirAnswerToThat:
            'That the one-way behaviour is the same defect as every gate they have built since the predecessor house died, which is to say a known engineering failure rather than a metaphysical fact, and that the network\'s inability to reach immortal-realm ground is a range limit. Both answers are the answers of a house that believes every problem is a technical problem, and the Long Measure faction says so out loud.',
        ifItIsTrue:
            'The Lid is an engineering problem, the Thirty-One may have solved it, and the reason nobody has repeated it is that the method died with a network nobody can read. It would make the Measured Span the most important institution in the world and it is entirely aware of the incentive.'
    },
    {
        id: 'lid-narrowing',
        name: 'The Narrowing',
        heldBy: 'house-narrow-hour',
        throughWhichPrinciple: 'fate',
        theory:
            'That there is no structure. The Lid is what a narrowing looks like from underneath: ascension is the state in which the possibilities available to a person have reduced to one, and what people describe as a barrier is the experience of arriving at a place where nothing else can happen. The House does not claim the far side is unreal. It claims that the crossing is not a passage through anything, and that everybody who describes a boundary is describing the last few days of their own convergence and mistaking it for terrain.',
        evidence: [
            'the House can sight a convergence around a crossing candidate and it behaves like every other convergence it reads: a thousand possibilities on the first day and four on the ninth, pruning in the ordinary way, with nothing in the sighting that reads as an obstacle',
            'the sighting goes dark at the exact moment the crossing resolves, in the same way and with the same character as a sighting cast at a catastrophe site or a fresh scar, which the House takes as exhaustion of possibility rather than as a departure',
            'three thousand years of case records in which no reading has ever returned a wall, an edge, a distance or a holder, for any client, ever',
            'the crossing cannot be attempted early or late, only when the convergence has arrived, which every practitioner reports and which is a statement about possibility and not about geography'
        ],
        cannotAnswer:
            'Objects come down. Golden pills, talismans, the Standing Edge, a nail driven through from above and still sitting in the Long Cut\'s seat chamber. A narrowing does not send freight. There is a physical object in a room in the Quiet Marches that somebody on the other side put there, which is the plainest possible refutation of a theory that says there is no other side to put things from.',
        theirAnswerToThat:
            'That the objects are evidence of something and not necessarily of a place, and that a sighting cannot be cast on a thing that is not a party, so the House has no instrument that reaches the question. Everybody including the House regards this as weak. The Open Hall faction has argued for two centuries that the House should either obtain a reading on the Ninth Nail or stop holding the theory.',
        ifItIsTrue:
            'Ascension is not going anywhere, the Immortal World is a description rather than a place, and every channel in the world is a correspondence with something that is not where anybody thinks it is. The House does not push this conclusion in front of clients.'
    },
    {
        id: 'lid-term',
        name: 'The Term',
        heldBy: 'house-ninefold-ledger',
        throughWhichPrinciple: 'karma',
        theory:
            'That the Lid is a term of an agreement, and the crossing is its discharge. The Ledger\'s position is that a boundary which charges something specific rather than something proportional is a clause and not a phenomenon: the Price of Advancement takes a named thing, at a named point, in a defined order, and nothing in the natural world behaves like that while every instrument in the house\'s own vault does. On this reading the ladder is an instalment schedule and the last crossing is the settlement of an account.',
        evidence: [
            'the Price of Advancement takes something specific rather than an amount, which is the signature of a term and is not the signature of a physical process',
            'the charge is not negotiable, not avoidable, and not reducible by strength, which is how the house\'s own binding instruments behave and is not how terrain behaves',
            'the Tally Court had begun an account of what the crossings take, with the Lid itself named as the party in arrears, and had got far enough to name what was owed before it was ended',
            'oaths, debts and inheritances all pull tight across generations without anybody enforcing them, which establishes that this world does in fact carry obligations that nothing visible is holding'
        ],
        cannotAnswer:
            'An obligation has a counterparty and the Ledger cannot name one it could serve. It has never produced an instrument, a party, a witness or a date. And the body that had come closest to producing all four was destroyed by the Ledger\'s own founders, who kept the volumes and have not opened them in twenty-three hundred years, so the house\'s strongest evidence is a thing it deliberately made unavailable.',
        theirAnswerToThat:
            'Nothing, in public. In private the house\'s position is that the founders ended the Tally Court because naming a party in arrears creates an account, that an account against that particular party was judged not survivable, and that the nine sealed volumes are exactly where a responsible institution keeps a finding it cannot act on. Whether that is prudence or the largest act of cowardice in the history of the world is argued inside the house and nowhere else.',
        ifItIsTrue:
            'Something is owed, by everybody, and the crossings are collection. It would also mean the Ledger has been sitting on the identity of the counterparty for twenty-three centuries, which is the reading its enemies prefer and which the house cannot refute without opening the volumes.'
    }
];

/**
 * Two serious bodies hold no theory, and both silences are worse than any of
 * the theories above.
 */
export const LID_NON_POSITIONS = [
    {
        factionId: 'sect-hollow-court',
        position:
            'The Hollow Court holds no theory of the Lid. Four beings have been receiving accounts of the crossing itself, from somebody who made it, for four thousand four hundred years, and when the question has been put to them the answer has been that the accounts do not describe one. Not that the accounts are unclear about it: that the subject does not arise. Everybody who learns this finds it worse than any of the four theories, and it is the single most disturbing fact available to anybody investigating the question.',
        whyItMatters:
            'The best-informed party in the world, working continuously on nothing else, has not formed an opinion in four millennia. Either the question is malformed, or the answer is something the accounts cannot carry, or the four of them have one and have never been asked by anybody they considered worth answering.'
    },
    {
        factionId: 'sect-the-severed',
        position:
            'The Severed refuse the question as a category error. Their position is that asking what the Lid is, is asking what the last taking is made of, and that the answer changes nothing about what to do: everything will be taken eventually, so take it yourself first, on your own terms, at a time of your choosing. They are the only body in the world that regards the entire investigation as a way of not preparing.',
        whyItMatters:
            'It is a stance rather than a theory, and it is coherent, which is why it recruits. Nothing in the four theories contradicts it and none of the four houses has an answer to it that does not amount to preferring to know.'
    },
    {
        factionId: 'sect-kiln-wardens',
        position:
            'The Kiln Wardens do not answer. They have been asked, in writing, by the Anchorhold, twice in nine hundred years, and both letters were received and neither was replied to. They keep a datum of their own, they date documents in a five-figure year in a reckoning nobody else uses, and they hold every node they have lit since before the province had a name.',
        whyItMatters:
            'They are staff of an apex, posted, doing an assigned job on somebody else\'s datum. Whatever the assignment is, it is older than the Standing Age\'s ability to date it, and the Anchorhold\'s unpublished position is that the Wardens are the closest thing in the world to a party that might be holding something.'
    }
] as const;

/**
 * The Lid as the engine stands to it. This is the entry that must never be
 * resolved in the catalog: `resolveFact` exists so a particular run can settle
 * it in play, and settling it here would remove the largest discoverable in
 * the world from every run at once.
 */
export const THE_LID: Claim = {
    statement:
        'There is a limit to how far the world will let a person rise, and past it is somewhere else. What it is made of, whether it is made at all, and whether anything is holding it are not known, including to the engine.',
    truth: 'unresolved',
    heldBy: ['house-anchorhold', 'house-measured-span', 'house-narrow-hour', 'house-ninefold-ledger'],
    evidence: [
        'people who cross stop being here, and a small number of them keep answering afterwards',
        'objects come down and can be held, counted and spent, and nothing goes up',
        'an immortal coming down draws tribulation on the way through, so the boundary treats an inward hole exactly as it treats an outward one',
        'a cultivator below the last realm cannot exist on the far side, which is a statement about pressure and is the only thing every account agrees on'
    ],
    claimedOutcomes: [
        'a containment, held by something nobody has identified',
        'a distance, computable, with one working direction for reasons nobody has explained',
        'a narrowing, which is to say not a thing at all',
        'a term of an agreement, with a counterparty nobody can serve'
    ],
    fidelity: 'partial'
};

// ─────────────────────────────────────────────────────────────────────────
// TRANSMISSION AND LOSS
//
// This is what makes the past discoverable rather than merely written. A
// player can learn a script, get into an archive, notice a recopying error, or
// find out that the document everybody argues from is a citation of something
// nobody holds.
// ─────────────────────────────────────────────────────────────────────────

export const DeadScriptSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    ageId: z.string(),
    /** How much can actually be read, stated in the specific. */
    legibility: z.string().min(150),
    /** Who can read what can be read. */
    readBy: z.array(z.string()).min(1),
    /** Why it died, or why the readable part did not. */
    whyItIsLikeThat: z.string().min(150),
    /** What is written in it that somebody would want. */
    whatIsWrittenInIt: z.array(z.string().min(40)).min(2)
});
export type DeadScript = z.infer<typeof DeadScriptSchema>;

export const DEAD_SCRIPTS: readonly DeadScript[] = [
    {
        id: 'script-standing-hand',
        name: 'The Standing hand',
        ageId: 'age-standing',
        legibility:
            'The numerals are read completely and by a great many people. The prose is not read at all. A careful person can pick up a five-thousand-year-old survey document and state every quantity in it to the unit while having no idea what is being quantified, which is the ordinary experience of every archivist in the Low Fall and is far more frustrating than total illegibility would be.',
        readBy: ['house-anchorhold', 'house-measured-span', 'house-ninefold-ledger', 'sect-stonewright-consortium'],
        whyItIsLikeThat:
            'The numerals never went out of use. The standard weights are marked in them, the distance table is written in them, and every transaction in the province has kept them in continuous circulation for eleven thousand years. The prose went out of use in a single generation somewhere in the Counting Age and was never taught again, and nothing has ever kept a sentence alive the way a price keeps a number alive.',
        whatIsWrittenInIt: [
            'the survey of record, including the sections the Anchorhold cannot read and cites anyway',
            'staffing returns from the last centuries of the Standing Age, which are the evidence for how that age ended',
            'the standing formula at the head of survey documents, which is a comparison between a present figure and a larger older one and appears for four thousand years'
        ]
    },
    {
        id: 'script-gate-hand',
        name: 'The gate hand',
        ageId: 'age-wide',
        legibility:
            'Three sign groups are agreed by everybody who has looked, and one of the three is agreed to be a number that nobody can interpret because nothing states its units. Beyond that there is no agreement of any kind, including on whether the marks on a terminal frame are one script or two.',
        readBy: ['house-measured-span'],
        whyItIsLikeThat:
            'Nothing carried it forward. The Standing Age inherited the terminals as objects rather than as documents, kept the distance table because it was useful, and let the frames become furniture, so there was never a period in which anybody needed to read a terminal in order to do their job.',
        whatIsWrittenInIt: [
            'whatever is on the thirty-one terminal frames, which is the only Wide Age text anybody can point at',
            'the disputed number, which appears once at each terminal and differs between terminals'
        ]
    },
    {
        id: 'script-method-script',
        name: 'Method-script',
        ageId: 'age-standing',
        legibility:
            'About a third, and the Cinnabar Crucible Guild has built its whole reputation on that third. It is a technical notation and not a language: it encodes procedure, and a reader who cannot follow the procedure cannot read the notation no matter how much of the world they can read otherwise.',
        readBy: ['sect-cinnabar-crucible-guild'],
        whyItIsLikeThat:
            'It survives at all only where it was cut into a working surface that nobody had a reason to reuse, which in practice means one refining hall wall. A notation that is only preserved on the walls of buildings is preserved in exactly the fraction of cases where the building outlasted the trade.',
        whatIsWrittenInIt: [
            'the refining hall wall, of which a third is the Guild\'s method and the rest is not attempted',
            'the fourth line, which a Furnace Elder died proving is not a step in the method, which is the only negative result anybody has ever published about it'
        ]
    },
    {
        id: 'script-tally-hand',
        name: 'The tally hand',
        ageId: 'age-burning',
        legibility:
            'Fully legible to the Ninefold Ledger and to nobody else, deliberately. It is not ancient enough to have died; it is a working notation that has been kept inside one institution for twenty-three hundred years because the volumes written in it are still binding on families who cannot read them.',
        readBy: ['house-ninefold-ledger'],
        whyItIsLikeThat:
            'A house that arbitrates inheritance has an obvious interest in being the only party that can read the inheritance record, and the Ledger has never pretended otherwise. It teaches the hand to auditors and to no one else, and an auditor who leaves the house is required to have never written it down.',
        whatIsWrittenInIt: [
            'the tally volumes, still consulted, still binding, and still accurate about families that do not know they are in them',
            'the nine sealed volumes in the house\'s own index, with no subject line'
        ]
    },
    {
        id: 'script-warden-reckoning',
        name: 'The Warden reckoning',
        ageId: 'age-wide',
        legibility:
            'Not a script so much as a date format, and it is the only living example of anything of the sort. The Kiln Wardens mark documents with a five-figure year in a reckoning nobody else uses and have never explained the epoch. Two attempts have been made to convert it against known events and the two answers are about four thousand years apart.',
        readBy: ['sect-kiln-wardens'],
        whyItIsLikeThat:
            'It is not dead and never was. It is in continuous use by a body that does not answer questions, which produces the same practical result as a dead script and is far more unsettling, because the only people who could explain it are alive and standing right there.',
        whatIsWrittenInIt: [
            'every document the Wardens have ever handed to an outside party, of which there are eleven',
            'the year, which if it is a year at all makes their posting older than any dateable thing in the world'
        ]
    }
];

/**
 * What a sect archive actually contains, which is not what anybody expects and
 * is the single most useful correction available to a player who thinks
 * archives hold secrets.
 */
export const SECT_ARCHIVE = {
    whatIsActuallyInIt: [
        'stipend rolls, in enormous quantity, going back as far as the sect does',
        'grain and stores accounts, which are the most complete series in any archive anywhere and are what an economic historian would actually want',
        'intake registers: who was admitted, at what age, from where, and whether they were still there ten years later',
        'boundary disputes and the correspondence about them, frequently the same dispute recurring every eighty years',
        'medical records, because a sect that spends resources on a disciple keeps track of the investment',
        'three generations of some particular elder\'s letters, kept because a descendant was fond of them and not because anybody decided they mattered'
    ],
    whatIsNotInIt: [
        'manuals, which are in the treasury and are inventory rather than record',
        'anything about a crossing, because crossings are attempted in caves nobody was told about and there is nothing to file',
        'the sect\'s actual decisions, which were made in rooms and are recalled by people rather than written',
        'anything the sect has ever been embarrassed by, which was not destroyed so much as never written down in the first place'
    ],
    theRecopyingProblem:
        'Paper that was worth keeping was recopied and paper that was merely true was not. Every document older than about four hundred years in any archive in either province is a copy of a copy, and each recopying was done by somebody who understood the subject less well than the last one. A manual recopied nine times carries nine generations of a hand that did not understand it, and the errors are not random: they are systematically in the direction of what the copyist expected the text to say.',
    whoCannotReadIt:
        'Most of the sect. Literacy among outer disciples is not assumed and is not taught; an outer disciple who can read is doing something unusual and is noticed for it. The archive of a sect with three hundred disciples is typically maintained by one person, consulted by four, and understood by nobody currently alive, and this is the normal condition rather than a decline.',
    theHonestArchive:
        'Lantern Hall keeps the best-maintained record in either province, in a hand nobody writes in any more, indexed by the date of the crossing that took each name. It is complete, it is honest, it is freely open, and it is a record of losses rather than of events: the best archive in the world is an account of what people no longer have, which is the Hall\'s entire argument stated as a filing system.'
} as const;

/**
 * Why two honest records disagree. Four mechanisms, none of them requiring
 * anybody to lie, plus the one that does.
 */
export const WHY_ACCOUNTS_DISAGREE: readonly Claim[] = [
    {
        statement:
            'Recopying drift. Every old document is a copy, each copyist understood less than the last, and errors run systematically toward what the copyist expected rather than randomly.',
        truth: 'objective',
        heldBy: ['sect-lantern-hall', 'house-ninefold-ledger'],
        evidence: [
            'two sects holding copies of the same Counting Age instrument differ in nine places, and in all nine the difference is in the direction of that sect\'s own practice',
            'the Ledger keeps originals precisely because it worked this out early and has never allowed a volume to be recopied'
        ],
        claimedOutcomes: [],
        fidelity: 'full'
    },
    {
        statement:
            'Deliberate rewriting at a succession. A house that replaces another inherits its territory, its records and its enemies, and writes an account of the replacement that suits the successor.',
        truth: 'objective',
        heldBy: ['house-ninefold-ledger', 'house-narrow-hour', 'sect-lantern-hall'],
        evidence: [
            'the official account of the Girdle of Nine Stones has the Anchorhold founded to replace it, and the two published dates are two thousand years apart',
            'the official account of the Unlit Gate House has it destroying itself, and both seats burned in the same season',
            'the coalition named in the official account of the Tally Court\'s end did not exist as a coalition in that century'
        ],
        claimedOutcomes: [],
        fidelity: 'full'
    },
    {
        statement:
            'The crossing practice. Cultivators attempt the last crossing in caves nobody was told about, so the last thousand years of ascension records are structurally unreliable: a person stops being seen, and nothing distinguishes crossed, killed, failed and in seclusion.',
        truth: 'objective',
        heldBy: ['sect-lantern-hall', 'house-held-names', 'house-narrow-hour'],
        evidence: [
            'the Narrow Hour\'s own records for the last confirmed ascension are internally contradictory and it has never resolved why',
            'unattributed tribulation scars exist with no name against them, and some belong to candidates and some to people nobody wondered about',
            'the House of Held Names holds register entries that stopped matching their holders and cannot say what happened to any of them'
        ],
        claimedOutcomes: [],
        fidelity: 'full'
    },
    {
        statement:
            'The calendar. Two provinces count from two different epochs with an offset nobody can verify, so two true records can be irreconcilable without either being wrong, and a great many disagreements about what happened are disagreements about when.',
        truth: 'objective',
        heldBy: ['house-measured-span', 'house-anchorhold', 'house-ninefold-ledger'],
        evidence: [
            'freight contracts across the border use an offset of twenty-eight years because a contract requires a number',
            'the Anchorhold computes thirty-one and says so in its survey notes',
            'the Ninefold Ledger computes thirty-three from inheritance intervals and has never published it'
        ],
        claimedOutcomes: [],
        fidelity: 'full'
    },
    {
        statement:
            'And sometimes somebody is lying, usually about an ancestor. A claimed immortal ancestor is the cheapest prestige in the world if nobody can check, and verifying one is exactly the service a house sells and exactly the thing worth killing to keep unverified.',
        truth: 'objective',
        heldBy: ['house-ninefold-ledger', 'house-narrow-hour', 'sect-lantern-hall'],
        evidence: [
            'audit is a paid service with a price list, which establishes that the market for unverified claims is large enough to support one',
            'sects lie about dormant ancestors in both directions, and outsiders frequently cannot tell which lie is being told'
        ],
        claimedOutcomes: [],
        fidelity: 'full'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// CALENDARS
//
// Two provinces, two epochs, and an offset three institutions compute
// differently. This is not colour: it is load-bearing on property law, because
// an inheritance interval computed across the border is computed against a
// number nobody can verify, and twenty-eight is the number that has been used
// for fifteen hundred years because a contract requires one.
// ─────────────────────────────────────────────────────────────────────────

export const CalendarSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** Region id, or null for a reckoning that is not territorial. */
    regionId: z.string().nullable(),
    /** Faction ids that keep and enforce it. */
    keptBy: z.array(z.string()).min(1),
    countsFrom: z.string().min(100),
    /** The current year in this reckoning. */
    presentYear: z.number().int().nullable(),
    /** Whether the epoch is even the event it is said to be. */
    isTheOriginCorrect: ClaimSchema,
    note: z.string().min(100)
});
export type Calendar = z.infer<typeof CalendarSchema>;

export const CALENDARS: readonly Calendar[] = [
    {
        id: 'calendar-standing-count',
        name: 'The Standing Count',
        regionId: 'region-low-fall',
        keptBy: ['house-anchorhold', 'sect-stonewright-consortium', 'house-ninefold-ledger'],
        countsFrom:
            'The Settlement, which is said to be the arrangement that ended the Burning Age and made water something granted rather than taken. Year one is the year of it, and the present year is 1,517.',
        presentYear: PRESENT_YEAR,
        isTheOriginCorrect: {
            statement:
                'The Standing Count is dated from an event for which no instrument survives, whose convening nobody can name, and which may not have been a single event at all.',
            truth: 'unresolved',
            heldBy: ['house-bound-word', 'house-anchorhold', 'house-ninefold-ledger'],
            evidence: [
                'no instrument bearing the name survives and the Bound Word does not hold one, which for that house is an extraordinary admission',
                'the eleven subsidiary agreements of that decade refer to terms they do not restate',
                'the practice changed across both provinces within about a decade, which is instrument speed and not custom speed',
                'the calendar itself was reset, which means somebody at the time was certain enough to make everybody renumber'
            ],
            claimedOutcomes: [
                'the epoch is correct and an instrument exists unpublished in somebody\'s keeping',
                'the epoch is a decade compressed into a year for administrative convenience, chosen a generation later by whoever was renumbering',
                'the epoch is the year of a different event entirely, and the association with the Settlement is a later gloss'
            ],
            fidelity: 'partial'
        },
        note:
            'Every property boundary, lease renewal and inheritance interval in the Low Fall is computed in this count, which means an error in the epoch would not change a single interval and would change every date.'
    },
    {
        id: 'calendar-face-reckoning',
        name: 'The Face Reckoning',
        regionId: 'region-quiet-marches',
        keptBy: ['apex-long-cut', 'sect-weir-office', 'sect-sixmile-wardens'],
        countsFrom:
            'The first cut on the founding face, which is a schedule entry rather than a treaty: the Long Cut dates from work rather than from agreement, and considers this the more honest practice. The present year is 1,489.',
        presentYear: 1_489,
        isTheOriginCorrect: {
            statement:
                'The Face Reckoning\'s epoch is a dated schedule entry, which makes it the better-evidenced of the two origins and does not make it convertible to the other one.',
            truth: 'reconstructed',
            heldBy: ['apex-long-cut', 'house-measured-span'],
            evidence: [
                'the entry exists, in the schedule, in a continuous series with entries either side of it',
                'the Long Cut has never revised the series and publishes a decreasing stock count against it, which is the same administration being honest about a different number',
                'the founding face is a physical place and has been worked continuously since'
            ],
            claimedOutcomes: [],
            fidelity: 'full'
        },
        note:
            'The Marches does not name the present age and does not consider the question interesting. It has a schedule, the schedule has years on it, and a carver dates a contract by the face and the year and nothing else.'
    },
    {
        id: 'calendar-seat-years',
        name: 'Seat years',
        regionId: null,
        keptBy: [
            'sect-azure-cloud-pavilion',
            'sect-nine-peaks-ascetic-order',
            'sect-verdant-spring-hall',
            'sect-frostmirror-sect',
            'sect-crimson-abyss-hall'
        ],
        countsFrom:
            'Whoever is sitting. A sect dates internally by the year of the current seat: the ninth year of the Fourth Master, and before that the thirty-first year of the Third. There is no absolute count anywhere in it and none is felt to be needed.',
        presentYear: null,
        isTheOriginCorrect: {
            statement:
                'Seat years have no origin to be correct about, and converting a sect\'s internal date to either provincial count requires a complete and accurate list of its seats and their lengths, which almost no sect has.',
            truth: 'objective',
            heldBy: ['sect-lantern-hall', 'house-ninefold-ledger'],
            evidence: [
                'sect succession lists are hagiography and routinely omit short or disputed seats',
                'an arbitration that turns on a sect\'s internal date requires the Ledger to reconstruct the seat list first, which it charges for'
            ],
            claimedOutcomes: [],
            fidelity: 'full'
        },
        note:
            'This is how most people in the world actually date things, and it is why an event two sects both witnessed is filed under two different years in two different reckonings with no relation between them.'
    },
    {
        id: 'calendar-warden-year',
        name: 'The Warden year',
        regionId: null,
        keptBy: ['sect-kiln-wardens'],
        countsFrom:
            'Nothing anybody can identify. The Kiln Wardens mark their eleven known outside documents with a five-figure year and have never stated the epoch, been asked in a way they answered, or shown any sign of considering the question worth a reply.',
        presentYear: null,
        isTheOriginCorrect: {
            statement:
                'Two attempts have been made to convert the Warden year against dateable events, and the two answers are about four thousand years apart. Nobody has made a third.',
            truth: 'unresolved',
            heldBy: ['house-anchorhold', 'sect-lantern-hall'],
            evidence: [
                'eleven documents, over nine hundred years, with year marks in a consistent series, which establishes at minimum that the count is real and is being kept',
                'the increments between the eleven match the elapsed years exactly, so the unit is the same year everybody else uses',
                'the two conversion attempts disagree by roughly four thousand years and both are defensible from what is available'
            ],
            claimedOutcomes: [
                'the epoch is in the Wide Age, which would make the Wardens\' posting older than any dateable thing in the world',
                'the epoch is early in the Standing Age and the higher conversion is an arithmetic error nobody has audited',
                'it is not a year at all but an index of something else that happens to increment annually'
            ],
            fidelity: 'partial'
        },
        note:
            'The single most alarming document in either province is a receipt. It is dated, the date is five figures, and it is filed in the Anchorhold under correspondence because nobody could think of anywhere better to put it.'
    }
];

/**
 * The offset between the two provincial counts. Three institutions compute it
 * three ways, one of the three is used by everybody because contracts require
 * a number, and the one that is probably right is unpublished because too much
 * settled property depends on the one that is used.
 */
export const THE_CALENDAR_OFFSET: Claim = {
    statement:
        'The Standing Count and the Face Reckoning are twenty-eight years apart by universal commercial practice, thirty-one by the Anchorhold\'s survey notes, and thirty-three by the Ninefold Ledger\'s unpublished computation from inheritance intervals. No event is dated in both reckonings, so nothing bridges them.',
    truth: 'unresolved',
    heldBy: ['house-measured-span', 'house-anchorhold', 'house-ninefold-ledger', 'apex-long-cut'],
    evidence: [
        'twenty-eight is what every freight and border contract has used for fifteen hundred years, on no stated basis, because the first one to need a number picked one',
        'thirty-one is the Anchorhold\'s figure, derived from the advance of a physical edge against its own survey, and it has never pressed the point',
        'thirty-three is the Ledger\'s, derived from inheritance intervals across the border where the same estate is dated twice, and it is unpublished',
        'the two epochs are different events of different kinds, and no third event anywhere is dated in both'
    ],
    claimedOutcomes: [
        'twenty-eight, and the other two are computing against a reckoning that was itself adjusted once',
        'thirty-one, and the commercial figure is a rounding that got fixed by use',
        'thirty-three, and every cross-border inheritance settled in the last fifteen hundred years is out by five years',
        'the question is malformed because the Standing Count\'s own epoch is a compressed decade, in which case no single offset exists at all'
    ],
    fidelity: 'partial'
};

/**
 * Why the offset is not merely an antiquarian matter, and what it silently
 * conceals.
 */
export const WHAT_THE_OFFSET_HIDES = [
    'The official account of the Girdle of Nine Stones has the Anchorhold founded to replace it. The Anchorhold publishes its own founding at two thousand nine hundred years ago and the Girdle\'s fall is dated nine hundred years ago, so the account is off by two thousand years, on two numbers both houses publish. Nobody has ever put the two on the same page, because the dates are quoted in different reckonings in different provinces and everybody assumes the discrepancy is the offset.',
    'Cross-border inheritance intervals are computed at twenty-eight. If the Ledger\'s thirty-three is right, a class of settled estates is out by five years, several of them are out across a boundary that decides which house arbitrates, and the Ledger has known this for at least two centuries.',
    'A carver and a Low Fall cultivator describing the same border incident will file it in years that differ by an unverifiable amount, which is why the tradition war has two dates as well as two accounts and why nobody has noticed that the two dates are not the same event.'
] as const;

// ─────────────────────────────────────────────────────────────────────────
// ERA RECORDS
// The one builder in the file. It turns the authored age table into the
// engine's `Era` shape so a ledger can be opened on the canonical past
// instead of a generated one. Still inert: it computes days and copies text.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The authored ages as engine `Era` records, oldest first.
 *
 * Days are absolute and negative, with day zero at the present, which is the
 * convention `seedPriorAges` already uses. The oldest age has no dateable
 * beginning, so its `startDay` is set one age-length before its end and its
 * note says so: the alternative is a false precision at the one place in the
 * record that most deserves not to have any.
 */
export function historyEras(): Era[] {
    const out: Era[] = [];
    for (const age of AGES) {
        const endYearsAgo = age.endedYearsAgo;
        const beganYearsAgo = age.beganYearsAgo ?? (endYearsAgo === null ? 0 : endYearsAgo * 2);
        out.push({
            id: age.id,
            name: age.name,
            startDay: dayOfYear(-beganYearsAgo),
            endDay: endYearsAgo === null ? null : dayOfYear(-endYearsAgo),
            qiDensity: age.qiDensity,
            note:
                age.beganYearsAgo === null
                    ? `${age.note} The beginning is not dateable; the start day here is a placeholder and must not be quoted as a date.`
                    : age.note
        });
    }
    return out;
}

/** Record fidelity by age, oldest to most recent. Used for seeding facts. */
export const AGE_FIDELITY: Readonly<Record<string, RecordFidelity>> = {
    'age-wide': 'rumour',
    'age-standing': 'partial',
    'age-counting': 'partial',
    'age-burning': 'partial',
    'age-present': 'full'
};

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const AGE_BY_ID: ReadonlyMap<string, Age> = new Map(AGES.map(a => [a.id, a]));
const DEAD_BY_ID: ReadonlyMap<string, DeadCivilisation> = new Map(DEAD_CIVILISATIONS.map(d => [d.id, d]));
const ORIGIN_BY_ID: ReadonlyMap<string, OriginAccount> = new Map(ORIGIN_ACCOUNTS.map(o => [o.id, o]));
const LID_BY_ID: ReadonlyMap<string, LidTheory> = new Map(LID_THEORIES.map(t => [t.id, t]));
const CALENDAR_BY_ID: ReadonlyMap<string, Calendar> = new Map(CALENDARS.map(c => [c.id, c]));

export function getAge(id: string): Age | undefined {
    return AGE_BY_ID.get(id);
}

export function getDeadCivilisation(id: string): DeadCivilisation | undefined {
    return DEAD_BY_ID.get(id);
}

export function getOriginAccount(id: string): OriginAccount | undefined {
    return ORIGIN_BY_ID.get(id);
}

export function getLidTheory(id: string): LidTheory | undefined {
    return LID_BY_ID.get(id);
}

export function getCalendar(id: string): Calendar | undefined {
    return CALENDAR_BY_ID.get(id);
}

/** The age containing a point given in years before the present. */
export function ageAtYearsAgo(yearsAgo: number): Age | undefined {
    return AGES.find(a => {
        const began = a.beganYearsAgo ?? Number.POSITIVE_INFINITY;
        const ended = a.endedYearsAgo ?? 0;
        return yearsAgo <= began && yearsAgo > ended;
    }) ?? (yearsAgo <= 0 ? AGES[AGES.length - 1] : undefined);
}

/** The present age. There is always exactly one age with no end. */
export function presentAge(): Age {
    const open = AGES.filter(a => a.endedYearsAgo === null);
    return open[0];
}

/** Which theory a given faction holds about the Lid, if it holds one. */
export function lidTheoryOf(factionId: string): LidTheory | undefined {
    return LID_THEORIES.find(t => t.heldBy === factionId);
}

/** The account of cultivation's origin that is refutable and held anyway. */
export function theWrongOriginAccount(): OriginAccount | undefined {
    return ORIGIN_ACCOUNTS.find(o => o.demonstrablyWrong !== null);
}

/** Everything in this file the engine does not know the answer to. */
export function unresolvedQuestions(): Claim[] {
    const out: Claim[] = [THE_LID, THE_FIRST_CULTIVATORS, THE_CALENDAR_OFFSET];
    for (const age of AGES) if (age.howItEnded.truth === 'unresolved') out.push(age.howItEnded);
    for (const dead of DEAD_CIVILISATIONS) if (dead.theEnd.truth === 'unresolved') out.push(dead.theEnd);
    for (const cal of CALENDARS) if (cal.isTheOriginCorrect.truth === 'unresolved') out.push(cal.isTheOriginCorrect);
    return out;
}

/** Every faction id this file attributes a belief, a holding or a reading to. */
export function allCitedFactionIds(): string[] {
    const ids = new Set<string>();
    const addAll = (list: readonly string[]) => { for (const id of list) ids.add(id); };
    const addClaim = (c: Claim) => addAll(c.heldBy);

    for (const age of AGES) addClaim(age.howItEnded);
    for (const dead of DEAD_CIVILISATIONS) {
        addClaim(dead.theEnd);
        for (const w of dead.survivingWorks) if (w.heldByFactionId) ids.add(w.heldByFactionId);
    }
    for (const o of ORIGIN_ACCOUNTS) {
        addAll(o.heldBy);
        if (o.demonstrablyWrong) addAll(o.demonstrablyWrong.whoCouldDemonstrateIt);
    }
    for (const t of LID_THEORIES) ids.add(t.heldBy);
    for (const n of LID_NON_POSITIONS) ids.add(n.factionId);
    addClaim(THE_LID);
    addClaim(THE_FIRST_CULTIVATORS);
    addClaim(THE_CALENDAR_OFFSET);
    addClaim(DRIVEN_GROUND_AND_THE_NODE);
    for (const s of DEAD_SCRIPTS) addAll(s.readBy);
    for (const c of WHY_ACCOUNTS_DISAGREE) addClaim(c);
    for (const cal of CALENDARS) {
        addAll(cal.keptBy);
        addClaim(cal.isTheOriginCorrect);
    }
    return [...ids].sort();
}
