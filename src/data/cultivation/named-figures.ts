/**
 * The named dead, the named absent, and the named enormous.
 *
 * `members.ts` holds the people a cultivator can meet. This file holds the far
 * larger population who exist as a NAME IN A RECORD and nothing else: founders,
 * ancestors who crossed, sealed figures who are titles to the people standing
 * on them, and the handful of historical figures the world argues about. They
 * are referenced, sworn by, made offerings to, and never encountered.
 *
 * WHY THIS IS NOT DECORATION
 * --------------------------
 * `LOST_RECORDS` in `sealed-ancestors.ts` turns on whether a sect can name its
 * ancestor, and `THE_LINEAGE_CLAIM` turns on whether it can show the line runs
 * to them. Neither is writable against an abstraction. An offering is made to a
 * name. A false claim is a claim to a specific person somebody else also claims.
 * A garbled name is a name, garbled. So the names come first and the rules
 * become facts about particular people rather than principles about records.
 *
 * ATTESTATION IS THE POINT
 * ------------------------
 * Every name here carries how well it is known, and the range is the content:
 * securely attested, written down later because the ceremony needed something,
 * garbled in copying, disputed between two bodies who both claim it, held in a
 * hand nobody at the holding institution can read, or deliberately withheld. A
 * name a sect HAS and cannot use is a different problem from a name it lost,
 * and both are different from a name it invented in good faith.
 *
 * THESE ARE NOT ROSTER ENTRIES
 * ----------------------------
 * Nothing here is instantiable. There is no realm ordinal, no rank index, no
 * faction membership and no location, because none of these people are in the
 * world - see `ENGINE_GAP` at the foot of the file. Do not move them into
 * `members.ts`; the two files answer different questions on purpose.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// ATTESTATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * How well a name is actually known, which is never a binary.
 *
 *   secure      multiple independent records agree, and at least one of them
 *               is contemporary. The name is simply the name.
 *   ceremonial  written down later because a rite needed something to say. Held
 *               in complete good faith and very probably not the name.
 *   garbled     the name survived copying and did not survive it intact. What
 *               the institution has is a name shaped like the name.
 *   disputed    two bodies hold different names, or the same name, and there is
 *               no instrument in the world that settles it.
 *   unreadable  the record exists, is in the institution's own vault, and is in
 *               a hand nobody there can read. They have the name. They cannot
 *               use it.
 *   withheld    known and deliberately not said, which is a policy rather than
 *               a loss and is reversible in a way none of the others are.
 *   unrecorded  never written at all. Not lost - never taken down, usually for
 *               a reason that made sense to the people not taking it down.
 */
export const AttestationSchema = z.enum([
    'secure', 'ceremonial', 'garbled', 'disputed', 'unreadable', 'withheld', 'unrecorded'
]);
export type Attestation = z.infer<typeof AttestationSchema>;

/** Which of these a sect can act on, which is the question that matters. */
export const ATTESTATION_IS_USABILITY = {
    thePrinciple:
        'Attestation is not scholarship. It is whether the name can be used - in an offering, in a claim of descent, in front of the person themselves if they ever wake or answer. A sect with a ceremonial name has been addressing somebody who is not there for six hundred years, and the ceremony has worked perfectly the whole time, because nothing about an offering reports back.',
    whatEachOneCosts: [
        'secure: nothing. Say it and be understood.',
        'ceremonial: the offering goes nowhere and nobody finds out. The cost lands entirely at the one moment it matters, which is a waking or an answer.',
        'garbled: an offering made to a name shaped like the name, which is the case nobody has any way to distinguish from the working one.',
        'disputed: two bodies making the same claim, at most one correctly, and the only adjudicator is the person being claimed. See `THE_LINEAGE_CLAIM`.',
        'unreadable: the most galling of the six, because the institution owns the answer. Any party who reads the hand can tell them, which is exactly the leverage the archival powers hold.',
        'withheld: costs nothing until the holder dies without saying it, at which point it silently becomes unrecorded and nobody notices the transition.',
        'unrecorded: the sect is honest about having nothing, which is rarer than it sounds and much healthier than the alternatives.'
    ],
    theQuietOne:
        'The dangerous state is `ceremonial`, because it is indistinguishable from `secure` from the inside. Every institution in this catalog holding a ceremonial name believes it holds a secure one, and there is no test available to them that would tell them otherwise short of the event they are saving it for.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE JUNIOR ANSWERS
// The rule that makes every immortal channel in the catalog one phenomenon
// rather than four unrelated facts.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Answering a mortal offering is a chore, and chores fall to the most junior
 * person in the room. That is the whole mechanism, and it is not a metaphor
 * about the immortal realm being a bureaucracy - it is what happens in any
 * society where the senior members have better things to do and everybody
 * knows each other.
 */
export const THE_JUNIOR_ANSWERS = {
    theRule:
        'The interface to the immortal realm is always its most junior member. A sect with several ancestors through the Lid hears from the newest one, every time, and the seniors are neither hostile nor absent - they simply have their own priorities, exactly as `IMMORTAL_MOTIVE` sets out, and answering descendants is at the bottom of them.',
    theyAreASociety:
        'Because they know each other. They are up there together, they talk, they have views about each other, and an offering arriving from below is a small tedious matter that somebody has to deal with. It falls the way such things always fall.',
    itExplainsTheGrades:
        'And it dissolves what looked like a separate fact about Ru Anjing. A fresh immortal sending lower-grade medicines is not a statement about her generosity or her limits as a person; she is the most junior member of the only society that could send anything, so she is the one who answers and the one whose reach sets the grade. The Azure Cloud Pavilion has the highest answer rate in the world and the lowest grade for one reason rather than two.',
    itIsNotASnub:
        'A sect answered by its junior ancestor is being answered by a functioning institution. The Hollow Court hears from the weakest of six, which is still something enormous, and the fact that the other five are silent means they are far stronger rather than that they are displeased. Reading juniority as a slight is a mortal error and a common one.',
    theAnswerIsExact:
        'And what comes down is precise. Two words from one of them are two deliberately chosen words that say exactly what was meant and no more - brevity as completeness at a scale the receiver is not equipped for, rather than vagueness. They do not garble, forget, approximate or misremember, and nothing is lost in the crossing.',
    relayingIsAccurate:
        'The junior who relays, relays accurately. Where an answer is partial, that is a decision: the group\'s position was partial, or they chose not to say more. It is never a failure of transmission, and there is no version of this in which the messenger got it wrong.',
    everyMismatchIsMortal:
        'So every discrepancy in the record is on the mortal side, without exception. The sect asked a question it has since misremembered. A copyist transcribed it wrong. Somebody read a specific answer as a general instruction, or a general one as a specific promise. The words were right. The reception was not, and the reception is the only part that was ever going to fail.',
    neverWriteThemAsFallible:
        'Catalog-wide rule: no immortal in this world is sloppy, forgetful, confused or mistaken. Where one does something that looks strange, they did it deliberately and the reason is above the observer\'s stratum. An exact answer nobody can understand is far worse than a garbled one, because there is nothing to blame. If an immortal has ever genuinely erred it is one of the largest events in the record and is not to be spent casually; nothing in this catalog spends it.',
    aQuestionCanBeCarriedUpward:
        'And it runs the other way, slowly and entirely at their discretion. If they talk to each other, then an offering that reaches the junior can in principle reach the seniors, which is the only channel by which a mortal institution can put a question to something it cannot name. Nobody should expect an answer. Several institutions in this world would give a great deal for the attempt.',
    immortalGossip:
        'They know each other\'s business, including whose descendants are asking for what. A petition is not private once it arrives: it is a thing the responder may mention, and the responder is a person with opinions about the sect that sent it. An institution that thinks it is addressing one ancestor is addressing a room.',
    theConsequenceForPlay:
        'So the size of the answer is not a measure of favour. A sect with one ancestor and a sect with six get the same junior voice; the difference is that the second one has five more people who might one day be told about you.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

export const FigureKindSchema = z.enum([
    'immortal_ancestor', 'founder', 'sealed', 'historical'
]);
export type FigureKind = z.infer<typeof FigureKindSchema>;

/** Whether an immortal answers what is sent up to them. */
export const AnswerStateSchema = z.enum(['answers', 'silent', 'never_has', 'unknown']);
export type AnswerState = z.infer<typeof AnswerStateSchema>;

export const NamedFigureSchema = z.object({
    id: z.string(),
    /** The name as the holding institution says it. */
    name: z.string().min(2),
    /** The title, epithet or role the name usually hides behind. */
    alsoCalled: z.string().nullable(),
    kind: FigureKindSchema,
    /** Whose record they are in. Null for figures no institution owns. */
    factionId: z.string().nullable(),
    whatTheyWere: z.string().min(60),
    /** Roughly how long ago, in years. Null where nobody can date them. */
    yearsAgo: z.number().int().min(0).nullable(),
    attestation: AttestationSchema,
    attestationNote: z.string().min(80),
    /** Immortals only: whether anything comes back, and how. */
    answers: AnswerStateSchema.nullable(),
    /** Immortals only: 1 is the most junior, and the most junior answers. */
    juniority: z.number().int().min(1).nullable(),
    note: z.string().min(60)
});
export type NamedFigure = z.infer<typeof NamedFigureSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE IMMORTAL ANCESTORS
// Four institutions have a line upward. Between them they have nine names,
// and two of those names ever say anything.
// ─────────────────────────────────────────────────────────────────────────

export const IMMORTAL_ANCESTORS: readonly NamedFigure[] = [
    // ── the Hollow Court: six crossings, one voice ────────────────────
    {
        id: 'figure-shen-yuandao',
        name: 'Shen Yuandao',
        alsoCalled: 'the one who went through first, which is the only way the Court refers to him',
        kind: 'immortal_ancestor',
        factionId: 'sect-hollow-court',
        whatTheyWere: 'A Seat before there were four, who made the crossing from the north mountain with nobody standing guard over him, and completed it.',
        yearsAgo: 4400,
        attestation: 'withheld',
        attestationNote:
            'The Court holds the name, has never said it aloud to an outsider, and does not use it internally either - four thousand years of referring to a man as "the one who went through first" is a practice rather than an omission. The name in this entry is the Anchorhold\'s, taken off a Standing Works site register that predates the Court\'s reticence and was never meant to be interesting.',
        answers: 'silent',
        juniority: 6,
        note: 'The seniormost thing any institution in this world has a line to, and nothing has come back from him in four thousand years. Nobody at the Court reads that as a problem.'
    },
    {
        id: 'figure-tian-luoshu',
        name: 'Tian Luoshu',
        alsoCalled: 'the second through',
        kind: 'immortal_ancestor',
        factionId: 'sect-hollow-court',
        whatTheyWere: 'The first crossing the Court protected properly: three seated, one climbing, and the practice that has defined the institution ever since.',
        yearsAgo: 3900,
        attestation: 'secure',
        attestationNote:
            'On the Court\'s own tablet, dated, with the three protectors named beside her. The Court does not publish the tablet and has never denied its contents to anybody who reached the mountain and asked.',
        answers: 'silent',
        juniority: 5,
        note: 'The crossing that turned a group of very strong people into a method, which is the Court\'s actual founding rather than its first.'
    },
    {
        id: 'figure-yun-shizhen',
        name: 'Yun Shizhen',
        alsoCalled: null,
        kind: 'immortal_ancestor',
        factionId: 'sect-hollow-court',
        whatTheyWere: 'A Seat who held the guard at two crossings before making her own, which is the pattern the Court now expects of anybody it admits.',
        yearsAgo: 3100,
        attestation: 'secure',
        attestationNote: 'Tablet, dated, and corroborated by a Deep Survey register entry recording her at a site the Survey was working at the time.',
        answers: 'silent',
        juniority: 4,
        note: 'Held the guard twice before she climbed, which the Court considers the correct order and says so to applicants.'
    },
    {
        id: 'figure-mo-yanting',
        name: 'Mo Yanting',
        alsoCalled: null,
        kind: 'immortal_ancestor',
        factionId: 'sect-hollow-court',
        whatTheyWere: 'The only Seat in the Court\'s record who attempted a crossing, aborted it, and made it thirty years later on the second attempt.',
        yearsAgo: 2400,
        attestation: 'secure',
        attestationNote: 'Tablet, dated twice, and the double date is the single most-copied line in the Court\'s record because it establishes that aborting is survivable.',
        answers: 'silent',
        juniority: 3,
        note: 'Two dates on one tablet, which is the whole of the evidence that a crossing can be broken off and re-attempted, and which every Void Refinement cultivator in the world would want to read.'
    },
    {
        id: 'figure-he-zhaoqing',
        name: 'He Zhaoqing',
        alsoCalled: null,
        kind: 'immortal_ancestor',
        factionId: 'sect-hollow-court',
        whatTheyWere: 'A Seat of the western mountain who crossed at the end of the Counting Age with four standing over her, the largest guard the Court has ever fielded.',
        yearsAgo: 1600,
        attestation: 'secure',
        attestationNote: 'Tablet, dated, four protectors named. The Ninefold Ledger holds an independent record of the same year because two of the four owed it obligations that lapsed on the day.',
        answers: 'silent',
        juniority: 2,
        note: 'Four protectors for one climber is the Court operating at its historical maximum, and it has not been able to field that since.'
    },
    {
        id: 'figure-qiu-danzhi',
        name: 'Qiu Danzhi',
        alsoCalled: 'the one who answers',
        kind: 'immortal_ancestor',
        factionId: 'sect-hollow-court',
        whatTheyWere: 'The most recent Seat to cross, and consequently the most junior member of whatever society exists on the other side, which is why she is the one who deals with the post.',
        yearsAgo: 900,
        attestation: 'secure',
        attestationNote:
            'Securely attested, currently addressed by name, and answered by name - the strongest attestation available to anybody in this file, because the Court has the rare luxury of being corrected if it gets it wrong.',
        answers: 'answers',
        juniority: 1,
        note: 'The Court\'s working line upward, and the reason its depletion is medium rather than terminal. Its archives are good, so it can still name her; because it can name her, the channel is open. That sequence is the entire argument for record-keeping, demonstrated once, in one institution.'
    },

    // ── the other three apexes ────────────────────────────────────────
    {
        id: 'figure-tao-jingwei',
        name: 'Tao Jingwei',
        alsoCalled: 'the First Surveyor, whose name the Survey records and does not use',
        kind: 'immortal_ancestor',
        factionId: 'apex-deep-survey',
        whatTheyWere: 'The founder of the arterial survey, who crossed from a site the register locates precisely and describes not at all.',
        yearsAgo: 3100,
        attestation: 'secure',
        attestationNote:
            'In the Survey\'s own register, in the Standing hand, correctly. The Survey reads the hand perfectly well and still refers to her by title in every context, which is house style rather than loss - it is one of the few institutions in this file whose reticence is a choice it could reverse tomorrow.',
        answers: 'answers',
        juniority: 1,
        note: 'One ancestor, so the junior and the senior are the same person, and the Survey has never had to discover what the rule in `THE_JUNIOR_ANSWERS` costs an institution with more than one.'
    },
    {
        id: 'figure-set-hand-eleven',
        name: 'Set Hand Eleven',
        alsoCalled: 'the First Course, named on the schedule and nowhere else',
        kind: 'immortal_ancestor',
        factionId: 'apex-long-cut',
        whatTheyWere: 'A carver who crossed from driven ground, which the Long Cut regards as the harder road and declines to argue about with anybody.',
        yearsAgo: 2600,
        attestation: 'secure',
        attestationNote:
            'A face number and a work rank, which is a complete name in the Marches and reads as a filing reference to everybody in the Low Fall. The schedule carries it in the same column as any other completed face, dated, with nothing in the reason column.',
        answers: 'answers',
        juniority: 1,
        note: 'The Long Cut is the only institution in the world whose immortal ancestor is recorded as a completed piece of work rather than as a person, and it does not regard the distinction as meaningful.'
    },
    {
        id: 'figure-ru-anjing',
        name: 'Ru Anjing',
        alsoCalled: 'Third Master of the Pavilion',
        kind: 'immortal_ancestor',
        factionId: 'sect-azure-cloud-pavilion',
        whatTheyWere: 'The last confirmed crossing in the world, who spent eleven years divesting into her sect before she made it and left her younger sister holding the hall.',
        yearsAgo: 380,
        attestation: 'secure',
        attestationNote:
            'The best-attested name in this file by a distance: contemporary records, a living sister who was in the room, an itemised divestment sequence, and a parting gift standing point-down in the floor.',
        answers: 'answers',
        juniority: 1,
        note: 'The most junior immortal in the world, which is why she answers most often and sends the lowest grade. Both facts are `THE_JUNIOR_ANSWERS` rather than two separate observations about her character.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// SEALED FIGURES WHO ARE TITLES TO THE PEOPLE STANDING ON THEM
// ─────────────────────────────────────────────────────────────────────────

export const SEALED_FIGURE_NAMES: readonly NamedFigure[] = [
    {
        id: 'figure-lian-suwen',
        name: 'Lian Suwen',
        alsoCalled: 'the First Sovereign, called the Mirror',
        kind: 'sealed',
        factionId: 'sect-frostmirror-court',
        whatTheyWere: 'The founding Sovereign, who dug the ice curriculum out of the glacier rather than inheriting it from anybody, and went under it when she had finished.',
        yearsAgo: 2000,
        attestation: 'ceremonial',
        attestationNote:
            'And this is the quiet problem at the centre of the Court. The name is in the founding volumes, the founding volumes were compiled four centuries after the sealing, and the compiler had a ceremony to write and a blank where a name should be. Everybody in the hall believes it is secure. Nothing available to them would show otherwise, and the one test is the waking itself.',
        answers: null,
        juniority: null,
        note: 'A hundred and ninety years of planning, a nine-line briefing revised eleven times, and the first word of it is a name somebody supplied to fill a gap. See `CONTINGENCIES` and `THE_LINEAGE_CLAIM`.'
    },
    {
        id: 'figure-guo-chishan',
        name: 'Guo Chishan',
        alsoCalled: 'the Kindler, first Flame Sovereign',
        kind: 'sealed',
        factionId: 'sect-nine-abyss-flame-sect',
        whatTheyWere: 'The first to take the caldera contract in full and survive the terms, who sealed herself at strength during a good century specifically to be available in a bad one.',
        yearsAgo: 1400,
        attestation: 'secure',
        attestationNote:
            'Named in the contract text the sect hands to every applicant, which is the most-copied document in the province and therefore the hardest name in the catalog to have corrupted. Total honesty about a monstrous bargain has an unglamorous side benefit: excellent provenance.',
        answers: null,
        juniority: null,
        note: 'A protector rather than a terminal, held correctly, by a sect that knows which it has because the paperwork was public from the first day.'
    },
    {
        id: 'figure-the-first-warden',
        name: 'The First Warden',
        alsoCalled: null,
        kind: 'sealed',
        factionId: 'sect-kiln-wardens',
        whatTheyWere: 'Whoever first stood the perimeter at the deep vein, and did not draw from it, and thereby set the only practice the Wardens have.',
        yearsAgo: null,
        attestation: 'unrecorded',
        attestationNote:
            'No name has ever been recorded, and the Wardens are not withholding one. They speak to outsiders in numbers, they have never been recorded making an exchange of any kind, and a name is a thing you give somebody so that they can address you. Nobody has established that they use names internally either.',
        answers: null,
        juniority: null,
        note: 'The only figure in this file where the absence of a name is not a records failure but appears to be the doctrine working correctly.'
    },
    {
        id: 'figure-ke-yuan',
        name: 'Ke Yuan',
        alsoCalled: 'who set the datum',
        kind: 'sealed',
        factionId: 'house-measured-span',
        whatTheyWere: 'The surveyor who fixed the house datum every price in the region is still quoted against, and who went under the station where he set it.',
        yearsAgo: 600,
        attestation: 'secure',
        attestationNote: 'A datum is a signed object. The house has the signature, the figures and six hundred years of every subsequent measurement agreeing with them.',
        answers: null,
        juniority: null,
        note: 'The Measured Span sweeps a gateless frame above him at a station where it has been failing to reopen the same span for six centuries.'
    },
    {
        id: 'figure-the-standing-storm-second',
        name: 'The Standing Storm, the second of that name',
        alsoCalled: null,
        kind: 'sealed',
        factionId: 'sect-storm-tyrant-court',
        whatTheyWere: 'The Tyrant who took a dead predecessor\'s style as a title, which the Court now cannot untangle in its own record.',
        yearsAgo: 1200,
        attestation: 'disputed',
        attestationNote:
            'The Court has one style and two people, and its vault list, its succession recitation and its offering rite disagree about which of them is under the mountain. Nobody has opened the vault in four hundred years to check, and at least two Storm Elders privately doubt the recitation.',
        answers: null,
        juniority: null,
        note: 'The clearest case in the catalog of a sect holding a name it cannot use: they can say it, and they cannot say who it means.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// FOUNDERS
// Somebody started each of these. Most sects know the name. What varies is
// whether the name is any good.
// ─────────────────────────────────────────────────────────────────────────

export const FOUNDERS: readonly NamedFigure[] = [
    {
        id: 'figure-kang-ye',
        name: 'Kang Ye',
        alsoCalled: 'founder',
        kind: 'founder',
        factionId: 'sect-azure-cloud-pavilion',
        whatTheyWere: 'The sword cultivator who cleared four centuries of birds out of somebody else\'s upper halls and lit the nine nodes he could still read.',
        yearsAgo: 900,
        attestation: 'secure',
        attestationNote: 'Contemporary, corroborated, and unremarkable, which is what a well-kept record looks like when nothing interesting has happened to it.',
        answers: null,
        juniority: null,
        note: 'The Pavilion did not build the Pavilion, and its founding record says so in the first line rather than the last.'
    },
    {
        id: 'figure-lu-wan',
        name: 'Lu Wan',
        alsoCalled: 'Physician Lu Wan',
        kind: 'founder',
        factionId: 'sect-verdant-spring-hall',
        whatTheyWere: 'The physician who took nine people into a valley and treated whoever arrived, including the people who had put them there.',
        yearsAgo: 1100,
        attestation: 'secure',
        attestationNote:
            'Secure as a person and wrong as a credit. The Hall teaches that Lu Wan wrote the restoration method; the valley ruin it came out of predates her by six hundred years and the Hall\'s own founding record says "recovered".',
        answers: null,
        juniority: null,
        note: 'A correctly remembered founder attached to an incorrectly remembered achievement, which is the commonest shape of institutional error in this world.'
    },
    {
        id: 'figure-the-stone-bearer',
        name: 'Yin Kuo',
        alsoCalled: 'the Stone Bearer',
        kind: 'founder',
        factionId: 'sect-nine-peaks-ascetic-order',
        whatTheyWere: 'The first ascetic up all nine peaks carrying the same stone, who declined to say what the stone was for and set the Order\'s entire manner.',
        yearsAgo: 800,
        attestation: 'unreadable',
        attestationNote:
            'The Order has the name. It is in the founding record, in the Standing hand, and the Order reads the numerals in that document perfectly and has not read the prose in eight hundred years - so it carries a founder it can point at and cannot pronounce, and uses the title instead. Any party who reads the hand could hand it back in an afternoon.',
        answers: null,
        juniority: null,
        note: 'The same document, the same hand and the same gap that makes Patriarch Meng Da a folklore problem rather than an institutional one. One unread page is doing a great deal of work at the Nine Peaks.'
    },
    {
        id: 'figure-old-shen',
        name: 'Old Shen of the Third Ford',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-clear-river-alliance',
        whatTheyWere: 'A ferryman who armed the other ferrymen, which is the whole of the Alliance\'s founding and is not written down anywhere as a decision.',
        yearsAgo: 400,
        attestation: 'garbled',
        attestationNote:
            'Every landing on the water has a version, none of them agree on the surname, and the Alliance has never once tried to settle it because settling it would mean telling four landings they are wrong. What survives intact is the ford, which is Third and is still there.',
        answers: null,
        juniority: null,
        note: 'A federation cannot correct its own founding story without picking a landing, so it has a founder whose given name is a matter of local pride in six places.'
    },
    {
        id: 'figure-the-first-abbot',
        name: 'The First Abbot',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-sweptground-temple',
        whatTheyWere: 'The one who chose ground for having no vein, swept it, and made the crossing off it - the only crossing in the Temple\'s record and a true claim nobody believes.',
        yearsAgo: 2300,
        attestation: 'unrecorded',
        attestationNote:
            'Never written. The Temple keeps no accounts of any kind, which is the same practice that leaves it unable to state its own most valuable fact, and the monks regard the gap as consistent rather than regrettable.',
        answers: null,
        juniority: null,
        note: 'The poorest institution in the province holds a true crossing claim and cannot name the person who made it, which is why the claim buys it nothing.'
    },
    {
        id: 'figure-the-first-keeper-of-names',
        name: 'Ao Duan',
        alsoCalled: 'the First Keeper of Names',
        kind: 'founder',
        factionId: 'sect-lantern-hall',
        whatTheyWere: 'The archivist who began writing down what boundaries take, starting with what one had just taken from a friend of his.',
        yearsAgo: 700,
        attestation: 'secure',
        attestationNote: 'The Hall\'s first entry is about the Hall\'s founder and is in his own hand, which is either excellent practice or the most pointed thing in the archive.',
        answers: null,
        juniority: null,
        note: 'An institution that exists to hold names has, unsurprisingly, kept its own.'
    },
    {
        id: 'figure-the-first-keeper-grove',
        name: 'Wen Su',
        alsoCalled: 'the first Keeper, who planted nothing and cleared nothing',
        kind: 'founder',
        factionId: 'sect-standing-grove',
        whatTheyWere: 'The one who settled in a valley, answered what was brought to her, refused payment, and never claimed a foot of ground beyond what she could walk.',
        yearsAgo: 200,
        attestation: 'secure',
        attestationNote: 'Two hundred years and six disciples is a short chain with no copies in it. The Grove knows her name the way a family knows a grandmother.',
        answers: null,
        juniority: null,
        note: 'The most recent founder in the catalog and the best attested, purely because nothing has had time to happen to the record.'
    },
    {
        id: 'figure-hou-jian',
        name: 'Hou Jian',
        alsoCalled: 'Principal Hou Jian',
        kind: 'founder',
        factionId: 'sect-stonewright-consortium',
        whatTheyWere: 'The assayer who worked out that whoever sets the rate does not need to hold a vein, and then set it.',
        yearsAgo: 600,
        attestation: 'secure',
        attestationNote: 'On a signed rate schedule, which is a document type the Consortium has never in its history mislaid.',
        answers: null,
        juniority: null,
        note: 'A founder attested by a price list, which is exactly how this institution would want to be remembered.'
    },
    {
        id: 'figure-mu-ganlu',
        name: 'Mu Ganlu',
        alsoCalled: 'first Grand Steward',
        kind: 'founder',
        factionId: 'sect-thousand-treasure-pavilion',
        whatTheyWere: 'The appraiser who opened a floor that would buy dug goods from anybody and ask nothing about the hole.',
        yearsAgo: 500,
        attestation: 'secure',
        attestationNote: 'Attested by his own commission ledgers, which survive complete, unlike the provenance of anything they record.',
        answers: null,
        juniority: null,
        note: 'The Pavilion knows exactly who founded it and has bought two ancestors since, which is the arrangement that produced the disputed claim in `THE_LINEAGE_CLAIM`.'
    },
    {
        id: 'figure-xie-lan',
        name: 'Xie Lan',
        alsoCalled: 'Grandmaster Xie Lan',
        kind: 'founder',
        factionId: 'sect-cinnabar-crucible-guild',
        whatTheyWere: 'The alchemist who read a third of a wall, built a monopoly on it, and instituted examination rather than combat as the door.',
        yearsAgo: 700,
        attestation: 'secure',
        attestationNote: 'Signed formulae in a house that counts standing in refinements that held. A Guild founder is attested the way a batch is.',
        answers: null,
        juniority: null,
        note: 'Still teaches, posthumously, a step that killed the man who proved it was not one.'
    },
    {
        id: 'figure-the-first-hammer',
        name: 'Duan Wu',
        alsoCalled: 'the First Hammer',
        kind: 'founder',
        factionId: 'sect-ashen-forge-clan',
        whatTheyWere: 'The smith who lit the clan fire and instituted the rota, and whose descendants have not let it go out in eleven generations.',
        yearsAgo: 300,
        attestation: 'secure',
        attestationNote: 'A blood clan, so the record is a family tree rather than an archive, and eleven generations is a length any of them can recite standing at the furnace.',
        answers: null,
        juniority: null,
        note: 'Every member of the clan is descended from him and every member takes a turn at his fire, which makes the lineage claim in this one case completely unarguable.'
    },
    {
        id: 'figure-the-first-bell',
        name: 'Whoever hung the first bell',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-hollow-bell-wanderers',
        whatTheyWere: 'Somebody who hung a bell at a crossroads they did not intend to return to, and was copied.',
        yearsAgo: null,
        attestation: 'unrecorded',
        attestationNote:
            'A league with no mountain, no register and no admission beyond turning up has no mechanism by which a founder could have been recorded. The Wanderers do not experience this as a loss and find the question faintly amusing.',
        answers: null,
        juniority: null,
        note: 'The bells record where the league has been and nothing at all about who it is, which is the practice working exactly as designed.'
    },
    {
        id: 'figure-the-first-cut',
        name: 'The First Cut',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-the-severed',
        whatTheyWere: 'The first to cut deliberately and in advance, and to write the reasoning down as an argument rather than a confession.',
        yearsAgo: 1000,
        attestation: 'unrecorded',
        attestationNote:
            'Cut. The founder\'s own name is the first entry in the house ledger and it is struck through, which the Severed regard as the strongest possible attestation of the doctrine and everybody else regards as the single most unsettling document in the province.',
        answers: null,
        juniority: null,
        note: 'The only unnamed figure in this file whose name was removed on purpose, by the person it belonged to, as the founding act of the institution.'
    },
    {
        id: 'figure-the-first-abyss-lord',
        name: 'Shu Wangdao',
        alsoCalled: 'the First Abyss Lord',
        kind: 'founder',
        factionId: 'sect-crimson-abyss-hall',
        whatTheyWere: 'The one who set a table outside somebody else\'s admission day with a cash box on it and paid the first month in advance.',
        yearsAgo: 400,
        attestation: 'secure',
        attestationNote: 'In the wage book, which is the only record this institution has ever kept scrupulously and the only one it needs.',
        answers: null,
        juniority: null,
        note: 'A demonic sect with better payroll records than most righteous sects have ancestral ones.'
    },
    {
        id: 'figure-the-pale-ancestor',
        name: 'The Pale Ancestor',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-bone-lantern-cult',
        whatTheyWere: 'The one Deity Transformation the cult has managed in its history, seven hundred years ago, and the whole of its prestige.',
        yearsAgo: 700,
        attestation: 'garbled',
        attestationNote:
            'Three sites, three names, and the cult uses the epithet because using any of the three would be choosing between three digging crews who each hold that theirs is right. The rotation has come round to all three sites twice since.',
        answers: null,
        juniority: null,
        note: 'A prestige claim that cannot be stated precisely, held by an institution whose seniority system is a queue.'
    },
    {
        id: 'figure-jiang-wu',
        name: 'Jiang Wu',
        alsoCalled: 'Sovereign Jiang Wu',
        kind: 'founder',
        factionId: 'sect-nine-abyss-flame-sect',
        whatTheyWere: 'The Sovereign who took the caldera, recovered the transformation art with the contract terms attached, and published both.',
        yearsAgo: 900,
        attestation: 'secure',
        attestationNote: 'Named in the same public contract text that names the Kindler, and for the same reason: the sect has never had a document it was tempted to keep quiet.',
        answers: null,
        juniority: null,
        note: 'Disclosure as a doctrine produces the best archives in the demonic half of the catalog, which nobody there has ever pointed out.'
    },
    {
        id: 'figure-the-first-tyrant',
        name: 'The First Tyrant, styled the Standing Storm',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-storm-tyrant-court',
        whatTheyWere: 'The one who recovered the lightning curriculum whole from the fragment, crossed three and a half thousand years ago, and left a style behind that a later Tyrant took.',
        yearsAgo: 3500,
        attestation: 'disputed',
        attestationNote:
            'A true crossing claim and a style used twice, which means the Court\'s founding name and its sealed name are the same words attached to two people. The claim itself is sound. Which of the two any given rite is addressing is not.',
        answers: 'silent',
        juniority: null,
        note: 'A collection of one style, two people and four hundred years of not opening the vault, held by the sect least willing to admit a filing problem.'
    },
    {
        id: 'figure-qiu-shen',
        name: 'Warden Qiu Shen',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-weir-office',
        whatTheyWere: 'The clerk who took custody of two workable faces during an administrative gap and issued the first grant against them.',
        yearsAgo: 200,
        attestation: 'secure',
        attestationNote: 'Grant number one, in the book, on the public shelf, itemised. The Office would sooner lose a face than a page.',
        answers: null,
        juniority: null,
        note: 'The entire authority of the Weir Office rests on a two-hundred-year-old filing action that nobody has ever formally challenged.'
    },
    {
        id: 'figure-the-first-marker',
        name: 'The first Marker',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-sixmile-wardens',
        whatTheyWere: 'The one who painted the first stake at the edge of ground that had moved, and went back the next season to repaint it.',
        yearsAgo: 150,
        attestation: 'unrecorded',
        attestationNote:
            'Not recorded, and the Wardens have a reason rather than an excuse: they count their strength, their dead and their year in painted markers, and a marker carries a distance rather than a person. Nobody thought to write the name because nobody writes names.',
        answers: null,
        juniority: null,
        note: 'A militia that has never written down a single one of its dead by name and can tell you exactly where each of them stopped.'
    },
    {
        id: 'figure-bo-ai',
        name: 'Company Master Bo Ai',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-gleaners-company',
        whatTheyWere: 'The digger who instituted shares allocated before a shift and paid to a dead gleaner\'s family after it.',
        yearsAgo: 300,
        attestation: 'secure',
        attestationNote: 'In the shares book, which the Company has never once defaulted on and consequently has never had a reason to lose.',
        answers: null,
        juniority: null,
        note: 'The founding act was a promise about money, and three hundred years of keeping it is why the record is intact.'
    },
    {
        id: 'figure-yan-duo',
        name: 'First Keeper Yan Duo',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'house-ninefold-ledger',
        whatTheyWere: 'The auditor who began writing connections down as a graph rather than as scores, and who destroyed the house he grew out of.',
        yearsAgo: 4000,
        attestation: 'secure',
        attestationNote:
            'Four thousand years of continuous audit, and the entry that matters is his own account of ending the Tally Court, filed by him, in the first volume, in his own hand.',
        answers: null,
        juniority: null,
        note: 'The only founder in this file who wrote down why he destroyed his predecessor and then sealed the volumes that say so.'
    },
    {
        id: 'figure-the-first-sighting',
        name: 'Cao Xun',
        alsoCalled: 'the First Sighting',
        kind: 'founder',
        factionId: 'house-narrow-hour',
        whatTheyWere: 'The first reader to say that only a few possibilities are load-bearing at any moment, and to charge for saying which.',
        yearsAgo: 3000,
        attestation: 'disputed',
        attestationNote:
            'Two of the House\'s own records give different names for the same person in the same decade, which is the same doubling that afflicts its account of the scar year. The House teaches both and has never chosen.',
        answers: null,
        juniority: null,
        note: 'A house that prunes possibilities for four thrones and cannot prune two entries in its own founding record.'
    },
    {
        id: 'figure-the-first-oathwright',
        name: 'Lin Zhao',
        alsoCalled: 'the First Oathwright',
        kind: 'founder',
        factionId: 'house-bound-word',
        whatTheyWere: 'The first to make a promise structural rather than punitive, and the first to sign last.',
        yearsAgo: 3200,
        attestation: 'secure',
        attestationNote: 'The founding oath is in the vault, and his name is at the bottom of it, after every other party, exactly as house practice requires of every witness since.',
        answers: null,
        juniority: null,
        note: 'The most literal attestation in the file: the founder is attested by having signed last, which is the practice he founded.'
    },
    {
        id: 'figure-the-quiet-cut-founder',
        name: 'Unrecorded',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'house-quiet-cut',
        whatTheyWere: 'Whoever first sold the permanent removal of a relationship, and then removed the record of having done so.',
        yearsAgo: null,
        attestation: 'unrecorded',
        attestationNote:
            'The house cuts its own records as doctrine, so its founding is the first thing it removed. It is the only institution in the catalog that has erased itself deliberately, and the practical consequence is that it repeatedly recuts work it has already been paid for.',
        answers: null,
        juniority: null,
        note: 'A house with no founder, no members it will name and no reliable account of its own commissions, which is exactly what its doctrine predicts and nobody there finds alarming.'
    },
    {
        id: 'figure-gu-yao',
        name: 'First Register Gu Yao',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'house-held-names',
        whatTheyWere: 'The one who began holding names in trust against the day a boundary took them, and instituted the morning recitation.',
        yearsAgo: 2800,
        attestation: 'secure',
        attestationNote: 'His is the first name in the register and it is recited every morning, in order, at the head of twenty thousand others.',
        answers: null,
        juniority: null,
        note: 'The house that sells names back has never mislaid one, including its own, which is the entire basis of its pricing.'
    },
    {
        id: 'figure-the-long-measure',
        name: 'Fu Chang',
        alsoCalled: 'the Long Measure',
        kind: 'founder',
        factionId: 'house-measured-span',
        whatTheyWere: 'The surveyor who first quoted a price in true rather than walked distance and made everybody else pay it.',
        yearsAgo: 5000,
        attestation: 'secure',
        attestationNote: 'Attested by a figure rather than a document: his original datum is still the one every price in the region is quoted against, and it has never disagreed with a subsequent measurement.',
        answers: null,
        juniority: null,
        note: 'Five thousand years old and verified continuously, because the house checks the founder every time it quotes anybody for anything.'
    },
    {
        id: 'figure-the-first-standing-anchor',
        name: 'Xu Ping',
        alsoCalled: 'the First Standing Anchor',
        kind: 'founder',
        factionId: 'house-anchorhold',
        whatTheyWere: 'The one who drove the first nail, set the datum stone, and instituted the perimeter watch as both an admission requirement and a cultivation method.',
        yearsAgo: 2600,
        attestation: 'secure',
        attestationNote: 'The datum stone is signed and has not moved. The house publishes the survey standard that cites it, annually, as a line item.',
        answers: null,
        juniority: null,
        note: 'Shares a surname with Xu Ci, the Second Standing Anchor sealed beneath his stone, and the house has never treated the succession as a family matter.'
    },
    {
        id: 'figure-the-first-keeper-kiln',
        name: 'The First Keeper of the Kiln',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-kiln-wardens',
        whatTheyWere: 'Whoever established that the deep vein is held and not drawn, which is the Wardens\' entire doctrine and their entire recorded history.',
        yearsAgo: 900,
        attestation: 'unrecorded',
        attestationNote:
            'Nine hundred years of perimeter and not one recorded name, exchange, or statement of purpose. Everything anybody knows about the Wardens comes from the Anchorhold estimating what walks the boundary.',
        answers: null,
        juniority: null,
        note: 'Two figures, both unnamed, both from the same institution: the only faction in the file that has never given anybody a name to use.'
    },
    {
        id: 'figure-hollow-court-first-seated',
        name: 'The four seated now, who are not named outside the Court',
        alsoCalled: null,
        kind: 'founder',
        factionId: 'sect-hollow-court',
        whatTheyWere: 'The current collaboration: four at the top of the ladder who declined the last step and hold the guard for whoever climbs next.',
        yearsAgo: null,
        attestation: 'withheld',
        attestationNote:
            'Known to themselves and to anybody who has reached the mountain and been answered, which is a small number of people who mostly do not repeat it. Withheld rather than lost - the Court could say tomorrow and has not.',
        answers: null,
        juniority: null,
        note: 'The one population in this file that could correct its own entry and has chosen not to.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// HISTORICAL FIGURES
// The people behind the ages, the accounts and the theories. Almost none of
// them are securely attested, and the ones who are turn out to be clerks.
// ─────────────────────────────────────────────────────────────────────────

export const HISTORICAL_FIGURES: readonly NamedFigure[] = [
    {
        id: 'figure-the-thirty-one',
        name: 'The Thirty-One',
        alsoCalled: null,
        kind: 'historical',
        factionId: null,
        whatTheyWere: 'An administration rather than a people: whoever ran the arterial network, spent it on freight and correspondence, and did not write down how it ended.',
        yearsAgo: null,
        attestation: 'garbled',
        attestationNote:
            'A count without a list. Thirty-one of something is attested in three independent hands; what the thirty-one were - seats, districts, offices, people - is not attested anywhere, and every institution that has an opinion is reasoning from the number alone.',
        answers: null,
        juniority: null,
        note: 'The reason the world is thin, known by a numeral, with no name attached to any part of it.'
    },
    {
        id: 'figure-the-standing-hand-clerks',
        name: 'The Standing Works recopying clerks',
        alsoCalled: null,
        kind: 'historical',
        factionId: null,
        whatTheyWere: 'The people who standardised manual formatting the way they standardised weights, and thereby made every manual in the world look descended from one teacher.',
        yearsAgo: 4000,
        attestation: 'secure',
        attestationNote:
            'Attested exhaustively and read by almost nobody. The recopying programme is documented in its own convention notes, which survive, in the Standing hand, in two collections that will not lend.',
        answers: null,
        juniority: null,
        note: 'The most consequential people in the argument about where cultivation came from are a clerical office, and the Taught Account survives because nobody has put their notes on a table next to a pre-Standing fragment.'
    },
    {
        id: 'figure-the-taught-teacher',
        name: 'The teacher the Taught Account requires',
        alsoCalled: null,
        kind: 'historical',
        factionId: null,
        whatTheyWere: 'Whoever came down at the beginning and taught the ladder, if anybody did.',
        yearsAgo: null,
        attestation: 'disputed',
        attestationNote:
            'Every sect that holds the account names one, every named teacher is that sect\'s own ancestor, and no two sects name the same person. This is not six competing records; it is six institutions each supplying the blank with the most flattering available answer.',
        answers: null,
        juniority: null,
        note: 'The account with the widest currency in the world has, as its central figure, a name that varies by whoever is telling you.'
    },
    {
        id: 'figure-the-anchorhold-containment-warden',
        name: 'Warden Pei Sun',
        alsoCalled: null,
        kind: 'historical',
        factionId: 'house-anchorhold',
        whatTheyWere: 'The Anchorhold warden who first argued that the Lid is a containment of the same kind as the house perimeters, and wrote the internal position that has never been published.',
        yearsAgo: 900,
        attestation: 'secure',
        attestationNote: 'Signed, filed, unpublished, and cited internally by every warden since. The house does not lose documents and does not release them either.',
        answers: null,
        juniority: null,
        note: 'The person behind the Containment theory, including the part the house does not put in writing: that a containment which nobody is holding can let go.'
    },
    {
        id: 'figure-the-span-long-reader',
        name: 'Elder Surveyor Fu Ling',
        alsoCalled: null,
        kind: 'historical',
        factionId: 'house-measured-span',
        whatTheyWere: 'The surveyor who stated that the Lid is a distance rather than a lid, and that the whole vocabulary of ascension is a walked-distance description of a true-distance fact.',
        yearsAgo: 600,
        attestation: 'secure',
        attestationNote: 'In the house figures, where an argument is a measurement with a name on it, and where nothing is ever restated in prose.',
        answers: null,
        juniority: null,
        note: 'Also one of the two people alive to the possibility that the terminal seats predate the Thirty-One, and she has published nothing about it.'
    },
    {
        id: 'figure-the-seat-tooling-warden',
        name: 'Warden of Survey Ru Bo',
        alsoCalled: null,
        kind: 'historical',
        factionId: 'house-anchorhold',
        whatTheyWere: 'The warden who published a note on seat tooling implying the terminal seats were cut before the Thirty-One, and has been left alone about it because nobody read the note.',
        yearsAgo: 40,
        attestation: 'secure',
        attestationNote: 'Published, catalogued, and unread. The most recent figure in this file and the most obscure, which are the same fact.',
        answers: null,
        juniority: null,
        note: 'A living person\'s name attached to a claim that would reorder the whole history of the world, sitting in a survey annexe nobody requests.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE WHOLE POPULATION
// ─────────────────────────────────────────────────────────────────────────

export const NAMED_FIGURES: readonly NamedFigure[] = [
    ...IMMORTAL_ANCESTORS,
    ...SEALED_FIGURE_NAMES,
    ...FOUNDERS,
    ...HISTORICAL_FIGURES
];

const BY_ID: ReadonlyMap<string, NamedFigure> = new Map(NAMED_FIGURES.map(f => [f.id, f]));

const BY_FACTION: ReadonlyMap<string, readonly NamedFigure[]> = (() => {
    const m = new Map<string, NamedFigure[]>();
    for (const f of NAMED_FIGURES) {
        if (!f.factionId) continue;
        const list = m.get(f.factionId);
        if (list) list.push(f);
        else m.set(f.factionId, [f]);
    }
    return m;
})();

export function getNamedFigure(id: string): NamedFigure | undefined {
    return BY_ID.get(id);
}

/** Every name a faction holds, across all four kinds. */
export function figuresFor(factionId: string): readonly NamedFigure[] {
    return BY_FACTION.get(factionId) ?? [];
}

export function figuresOfKind(kind: FigureKind): readonly NamedFigure[] {
    return NAMED_FIGURES.filter(f => f.kind === kind);
}

/**
 * Whether a faction can actually use the name it holds for a figure. A name
 * it cannot read, cannot choose between, or never took down is a name it has
 * and cannot spend - which is the whole of `LOST_RECORDS` reduced to a lookup.
 */
export function nameIsUsable(figure: NamedFigure): boolean {
    return figure.attestation === 'secure' || figure.attestation === 'withheld';
}

/**
 * Who answers for a faction, under `THE_JUNIOR_ANSWERS`: the most junior
 * immortal it can name. Undefined where it has no line upward at all.
 */
export function whoAnswersFor(factionId: string): NamedFigure | undefined {
    const immortals = figuresFor(factionId).filter(f => f.kind === 'immortal_ancestor');
    if (immortals.length === 0) return undefined;
    return immortals.reduce((lowest, f) =>
        (f.juniority ?? Number.MAX_SAFE_INTEGER) < (lowest.juniority ?? Number.MAX_SAFE_INTEGER) ? f : lowest
    );
}

// ─────────────────────────────────────────────────────────────────────────
// ENGINE GAP
// ─────────────────────────────────────────────────────────────────────────

/**
 * There is no schema for a person who exists as a name and a history and is
 * not in the world, which is why this file carries its own and stays out of
 * `members.ts`.
 */
export const ENGINE_GAP = {
    theShape:
        'A named figure has no realm ordinal, no rank index, no faction membership and no location, because none of those questions have answers for somebody who is dead, sealed, or through the Lid. Forcing them into the member schema would require inventing all four, and inventing a realm ordinal for a founder is exactly the kind of number that later gets treated as a fact.',
    whatTheEngineWouldNeed: [
        'A record type for a person referenced rather than instantiated: name, attestation, era, and a faction whose records hold them.',
        'An attestation field on any name the engine repeats back to a player, so that a garbled or ceremonial name can be reported as the institution believes it rather than as truth.',
        'A link from an offering or a claim of descent to the figure it addresses, since both are currently free text and neither can be wrong.'
    ],
    untilThen:
        'This file is the record and the tests are the contract. Nothing here should be given a realm, a rank or a location by any consumer, and anything that needs to know whether a name is trustworthy should call `nameIsUsable` rather than reading the string.'
} as const;
