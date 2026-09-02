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

// ──────────────────────────────────────────────────────────────────────────
// THE DECAY OF MEMORY
// Helpfulness is a decaying function of time since ascension. Not a
// temperament, not a virtue: an accounting error that sets in with distance.
// ──────────────────────────────────────────────────────────────────────────

export const THE_DECAY_OF_MEMORY = {
    theRule:
        'The longer somebody has been an immortal, the less they price mortal constraints. Not from contempt and not from cruelty - from distance. The memory of what a question costs down here fades the way memories fade, and once it has gone the consideration is simply not live for them any more.',
    whatFadesFirst:
        'The price. An old immortal answers precisely and completely and it does not occur to them that there will be no second exchange, because the fact that an offering is ruinous at the mortal scale is not something they can still feel. They are not withholding the context. They cannot see that context is needed.',
    whatANewOneStillKnows:
        'A recent one remembers the arithmetic. They know an offering is ruinously expensive to make, that the sect cannot afford many, and that nobody can - so they do not answer and stop. They front-load: the exact answer wrapped in whatever protective context stops it being misread, because they know there is no round trip in which to correct it.',
    frontLoadingIsTheAntidote:
        'And that is the only antidote to `THE_WRONG_QUESTION` that exists. It is not extra kindness and it is not a different answer - it is correct accounting on a budget the old ones have stopped being able to see. Only a recently ascended immortal would think of it, because only they still remember that a question is a once-a-century act rather than a conversation.',
    theInversion:
        'Which means a sect\'s best possible arrangement is a fresh immortal, and produces the unfairest fact in the catalog with a cause rather than a personality behind it: the Hollow Court\'s six ancients are a channel that is technically superior and practically worse, while the Azure Cloud Pavilion\'s single recent one is thin, lucky, and worth more.',
    theClockOnAzureCloud:
        'And it puts a term on the Pavilion. Ru Anjing will get worse. Not soon, not by choosing to, and not in any way she would recognise as a change - in a few centuries she will answer like the others, and nobody currently alive at the Pavilion will see it happen. The present advantage is a window rather than a possession.',
    somebodyHasWorkedThisOut:
        'One Sword Elder has followed the reasoning to the end and has been quietly organising around it for thirty years: shorter intervals between offerings, a standing instruction that every answer be recorded verbatim rather than summarised, and a slow effort to get the questions asked while they are still worth asking. There is no version of the plan that works. The best available outcome is a fuller archive of a channel going cold, and she knows it, and has not said so to anybody.',
    howToWriteIt:
        'Give every immortal a vintage and let the manner follow from it. Two ancestors of similar temperament and very different age should read completely differently, and the reason should be legible from how they answer without anybody stating it.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE WRONG QUESTION
// They answer what was asked. Exactly. Not what you meant.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The offering is the most dangerous instrument in this world and nothing
 * about it looks dangerous. A precisely correct answer to a badly framed
 * question is worse than no answer at all, because you come away holding
 * something true and you will act on it.
 */
export const THE_WRONG_QUESTION = {
    theMechanism:
        'They answer the question that was asked, exactly and completely. They do not answer the question you meant. They do not clarify it, reframe it, ask what you are actually after, or warn you that you have framed it badly - so a poorly framed question produces a precisely correct answer that ruins you. The immortal is not at fault and the outcome is still a catastrophe with bodies in it. Both are true at once, and that is the whole of the mechanism.',
    whyTheyDoNotCorrectYou: [
        'Because answering what was asked is the complete discharge of the obligation, and going further would be doing your thinking for you.',
        'Because they have no particular reason to engage with mortal concerns at all, and reframing a question is engagement. See `IMMORTAL_MOTIVE` in `crossings.ts`.',
        'Because some of them do not notice. The gap between what a sect said and what it needed is not necessarily visible from where they are standing.',
        'And because a hint costs attention, which is spent on ties rather than on descendants. See `WHO_HINTS_AND_WHY`.'
    ],
    theStakes:
        'A sect gets a question perhaps once in a thousand years. Framing it badly is not a wasted turn: it is worse than wasting it, because a wasted question leaves you where you were and a badly framed one sends you somewhere on good authority.',
    thisIsTheAskingPrinciple:
        'And it is the `asking.md` thesis at the top of the world, at maximum stakes. The skill was always knowing enough to ask the narrower question - who to ask, what they can actually tell you, and how to frame it so the answer is the one you need. Here the respondent is exact, the channel opens once an age, and the improvement being asked for is the player\'s rather than the character\'s. Nothing else in the setting expresses the doc\'s argument this cleanly.',
    howToRunIt:
        'Never let an immortal answer the intended question. Write the literal one, answer it perfectly, and let the gap do the work. If the table wants a warning, the warning has to come from a mortal in the room who has read the drafting history - which is exactly why institutions keep drafting histories.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// WHO HINTS, AND WHY
// Warmth is not a property of kindness. It is a property of having a tie.
// ─────────────────────────────────────────────────────────────────────────

export const WHO_HINTS_AND_WHY = {
    theRule:
        'Whether an answer comes with a handhold is decided by two things and neither is temperament: how long the answerer has been up there, and whether they have a tie to a living person. Vintage governs whether they still know a hint is needed; the tie governs whether they spend the attention. See `THE_DECAY_OF_MEMORY`.',
    theHollowCourtDoesNotHint:
        'Their ancestors are ancestors of a body rather than of anybody, and the youngest of them crossed nine hundred years ago. Picture a senior figure who has no time for you: not cruel, not contemptuous, simply busy and far above the matter. Qiu Danzhi answers because answering is the obligation, she answers exactly, and she is already gone. Nobody up there will notice that the Court framed its question badly and do it the courtesy of saying so - partly because the Court is not a person to any of them, and mostly because none of them can still feel that the Court gets one attempt.',
    anInstitutionGetsInstitutionalService:
        'Correct, complete, and no help whatsoever. That is not a failure of the Court\'s records or its standing - its records are the best in the world and its standing is unmatched. It is what a perfectly maintained institutional channel actually delivers.',
    ruAnjingDoes:
        'Ru Anjing is the exception twice over: she has a living sister, and she is three hundred and eighty years old, which is nothing. She still remembers what an offering costs to make and that the Pavilion cannot afford many. So she does not answer and stop - she front-loads, wrapping the exact answer in the context that stops it being misread, because she knows there is no second exchange in which to fix it. Not a different answer, which none of them give. The same answer, delivered by somebody who can still see the budget.',
    theBitterIrony:
        'Which produces the most unfair fact in the catalog, and it now has a cause rather than a personality behind it. The Hollow Court\'s excellent archives buy it a perfect channel to six people who have been up there long enough to have forgotten what a question costs. The Azure Cloud Pavilion\'s thin, lucky, sentimental arrangement - one recent ancestor, one living sister - is worth more in practice than four thousand years of immaculate record-keeping, and will stop being worth more on a timetable nobody at the Pavilion can affect.',
    theCourtsRealVulnerability:
        'And it leaves a genuine exposure underneath all of it: the Hollow Court is the body most likely to ask a question well and be destroyed by the answer anyway, because there is nobody up there who cares enough to break the frame. Everybody who fears the Court fears its power. The thing that could actually end it is a well-drafted sentence.',
    howToTellWhichChannelYouAreOn:
        'Ask two questions about the answerer: how long ago did they cross, and is there anybody alive they know. Recent and tied is the warm channel, and there is exactly one of those in the world. Everything else is exact, complete and cold, and the coldness increases with age at a rate nobody down here has been able to measure because nobody down here lives long enough to see it move.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE WORKED CASE
// The guidance survives. It is correct. It destroyed them.
// ─────────────────────────────────────────────────────────────────────────

export const THE_THRESHING_HALL = {
    who: 'The Threshing Hall, a mid-tier righteous sect of the eastern terraces with about two hundred disciples, which does not exist now.',
    yearsAgo: 780,
    theSituation:
        'A neighbour three times its size had taken two of its outlying holdings in eleven months and was plainly coming for the hall itself. The Hall had one ancestor through the Lid, one offering left that it could afford to make, and a winter to prepare in.',
    theQuestionAsked:
        'What must we do to keep the hall?',
    theAnswer:
        'Nine words: send the disciples out along the four roads before the thaw, and do not recall them.',
    whatTheyDid:
        'Exactly that, in full, on time, without argument. Two hundred people went out along four roads in the last weeks of winter, and the recall order that four separate elders drafted over the following two years was never sent, because the instruction had said not to.',
    theOutcome:
        'The hall was never taken. It was never even approached: an empty compound with nothing in it to hold was not worth the campaign, and the neighbour turned aside. The building is still standing. It is a grain store now, and the terrace it sits on has been leased three times since.',
    andYetTheSectEnded:
        'Because two hundred cultivators dispersed along four roads in early spring, with no recall coming, are two hundred people who stop being a sect. Some died in the first two winters, a great many were taken in by other institutions who were delighted to have them, and the rest simply became people who had once belonged to something. There was no massacre and no defeat. Within thirty years there was nobody left who could convene the Hall, and within sixty there was nobody who wanted to.',
    theAnswerWasCorrect:
        'And this is the part that has to be held onto: the answer was right. It was asked how to keep the hall. It gave the only method that would have worked, it worked completely, and the hall was kept. Nothing in the reply is untrue, incomplete, ambiguous, or capable of being read another way. The ancestor discharged the obligation perfectly.',
    theQuestionWasWrong:
        'They did not want the hall. They wanted to go on existing, and they asked about a building, because in the winter they drafted it the building was what the neighbour was coming for and the distinction had not yet occurred to anybody. One noun, chosen under pressure, by frightened people who had a month.',
    theReconstruction: {
        by: 'sect-lantern-hall',
        yearsAfter: 240,
        what:
            'A Keeper of the Lantern Hall assembled the offering record, the four unsent recall drafts, the neighbour\'s own campaign accounts and the terrace lease history, and established the exact wording of the question for the first time - it had been paraphrased in every prior account, always as "how do we survive".',
        theDocument:
            'Eleven pages, and the sixth is the one people cannot get past: the question on the left, the answer on the right, and a column establishing that every clause of the answer was executed correctly and achieved its stated end. There is no error in it anywhere. That is what makes it unbearable.',
        howItWasReceived:
            'Very badly, and the Hall published it anyway, which is precisely the behaviour that has made it unwelcome in nine cities. Four sects sent letters. One of them was about a question its own elders were then drafting.',
        whatItIsUsedForNow:
            'It is the standard text on offering practice. Every institution in this file that holds a question in reserve has a copy, and the drafting rooms of at least three of them keep page six on the wall.'
    },
    theLesson:
        'Not that guidance is a trap, because it is not: the answer was a gift and it worked. The lesson every careful institution took is that the noun in your question is the whole of your fate, and that you will be answered as though you meant it - because you did mean it, at the moment you wrote it, and there is nobody up there whose job it is to ask whether you still do.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// QUESTIONS HELD IN RESERVE
// Entirely rational and slightly mad, which is the correct response to
// THE_THRESHING_HALL.
// ─────────────────────────────────────────────────────────────────────────

export const HELD_QUESTIONS: readonly {
    factionId: string;
    heldForYears: number;
    drafts: number;
    theProblem: string;
    theCurrentWording: string;
    whyItIsStillNotSent: string;
}[] = [
    {
        factionId: 'apex-deep-survey',
        heldForYears: 400,
        drafts: 31,
        theProblem:
            'The Survey knows its arterial layer is failing and does not know in what order, and one exact sentence from the First Surveyor would settle a question its whole institutional existence is organised around.',
        theCurrentWording:
            'Draft thirty-one, current since the ninth revision cycle, is a single clause of nineteen characters that names no site, asks for no instruction and requests one ordering. Twenty-nine of the discarded drafts asked what the Survey should do. It stopped asking that in the second century, after somebody read page six aloud in the drafting room.',
        whyItIsStillNotSent:
            'Because the drafting committee has an unwritten rule that a wording must survive one full turnover of its own membership before it can be sent, and it has never yet managed that: somebody new arrives, finds a noun they cannot defend, and the clock resets. Four hundred years of this is either the most careful institutional behaviour in the world or a permanent, elegant way of never taking the risk, and the Survey has never established which.'
    },
    {
        factionId: 'sect-hollow-court',
        heldForYears: 900,
        drafts: 2,
        theProblem:
            'The Court holds one question and has not needed it, which is a different situation from the Survey\'s and produces different behaviour: it is not refining a wording against a live problem, it is keeping a wording ready for a problem it expects to recognise when it arrives.',
        theCurrentWording:
            'Not written down anywhere, on the reasoning that a sentence in a drawer is a sentence somebody can read. Two of the four seated hold it verbatim and confirm it against each other at intervals, which is the whole of the archive.',
        whyItIsStillNotSent:
            'Because they know exactly what they will get: precisely what they ask for, from somebody who will not look up. The Court is the best-informed body in the world about how cold its own channel is, and the caution follows from the information rather than from fear.'
    },
    {
        factionId: 'apex-long-cut',
        heldForYears: 0,
        drafts: 0,
        theProblem:
            'None. The Long Cut has a working channel and holds no question at all, which is a policy and not an oversight.',
        theCurrentWording:
            'There is no wording. The schedule carries the arrivals as dated entries with nothing in the reason column, and the administration has never entered an outgoing one.',
        whyItIsStillNotSent:
            'Because the Long Cut owns every act by name and a question is an act whose consequences it could not own. It has read page six, it agrees with page six, and it has drawn the conclusion that the other two apexes will not draw: that the correct number of questions to ask something that answers exactly is zero.'
    }
];

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
    /**
     * Immortals only: how they answer, which is a function of how long they
     * have been up there rather than of temperament. See `THE_DECAY_OF_MEMORY`.
     */
    manner: z.string().min(80).nullable().optional(),
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
        manner:
            'Four thousand four hundred years, and nothing has come back in any of them. If he were to answer, the Court\'s own position is that it would be one clause, correct, and referring to a state of affairs nobody present could identify.',
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
        manner:
            'Silent for thirty-nine centuries. The three replies attributed to her in the Court record all date from her first two hundred years and all three are longer and plainer than anything the Court has received since, which nobody at the Court has ever connected to her age at the time.',
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
        manner:
            'Silent. The one thing in the record from her is a two-word confirmation of a date, sent unprompted, twenty-nine centuries ago.',
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
        manner:
            'Silent, and the most requested of the six: the Court has petitioned her about the aborted crossing eleven times over two thousand years and received nothing, which is not a refusal so much as a matter that has stopped being live for her.',
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
        manner:
            'Silent. Sixteen centuries, and the last thing anybody up there is known to have said about her was relayed by Qiu Danzhi as a single word of agreement with something the Court had not asked about.',
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
        manner:
            'Exact, complete, and no help whatsoever. She answers what was asked, in as few words as the answer requires, and does not stay. Nine hundred years is long enough that the cost of the offering is no longer something she can feel, so it does not occur to her to wrap anything in context - and just occasionally her answers run a clause longer than the other five would have managed, which is the last visible trace of a person who used to know what this costs. Nobody at the Court has noticed, and nobody there knows to be grateful for it.',
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
        manner:
            'Thirty-one centuries, and the most exact voice in the world. What comes back is a figure, or a name, or a direction, with nothing around it - the Survey has never received a sentence from her that contained a verb, and has an internal style guide for interpreting replies that is longer than every reply combined.',
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
        manner:
            'Twenty-six centuries, and answers in the schedule\'s own format: a dated entry, a face, and a completion mark. The Long Cut finds this entirely natural and has never once remarked on the fact that its ancestor files rather than speaks.',
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
        manner:
            'Three hundred and eighty years, which is nothing, and it shows in everything she sends. She front-loads: the exact answer, and then the context that stops it being misread, because she knows the Pavilion gets one of these a decade at best and there is no round trip. She is the only voice in the world that has ever volunteered a caution nobody asked for, and the Pavilion - which has misread her twice anyway - does not understand how unusual that is.',
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
    // ── the two unbacked bodies, ninety years each ────────────────────
    //
    // Both founders are within living memory, both are securely attested,
    // and both are attested by the SAME KIND of document: a running record
    // the body has kept from the first day. That is what a house has instead
    // of an ancestor when there is nobody above it to have been given one by.
    // The Rail has a rate book and the Carriers have a tally board, and each
    // of those is worth more to its holder than a wall of tablets, because it
    // is the thing the body is actually trusted for.
    {
        id: 'figure-duan-xi',
        name: 'Duan Xi',
        alsoCalled: 'the first Weigher',
        kind: 'founder',
        factionId: 'sect-halfwater-rail',
        whatTheyWere: 'A Watering factor who worked out that the middle of the eastern passage was the only place four parties who would not sit in a room together all had to stop anyway, and put a weigh house on it.',
        yearsAgo: 90,
        attestation: 'secure',
        attestationNote: 'Attested by the rate book, which begins in her hand on a dated page and has not been broken since, and by four separate refusals to raise the rate recorded in the margins with the names of the parties who asked.',
        answers: null,
        juniority: null,
        note: 'She set the rate at a fortieth and refused every offer to raise it on the argument that the port is worth exactly what passes through it. Everybody at the quay repeats the argument as though it were obvious; it was not obvious to any of the four who tried to buy her off it.'
    },
    {
        id: 'figure-the-first-waterman',
        name: 'The first Waterman, name cut on the oldest board',
        alsoCalled: 'the one who would not wipe it',
        kind: 'founder',
        factionId: 'sect-sink-carriers',
        whatTheyWere: 'Somebody the Weir Office had no record of, who put a shed a day past the last painted stake and started carrying water to people the eastern cities had a rate posted on.',
        yearsAgo: 90,
        attestation: 'secure',
        attestationNote: 'Attested by the boards themselves, which are physical, dated by the seasons cut into their edges, and were the reason the shed had to be rebuilt around them rather than moved. Nothing else about him is recorded and the shed has never looked.',
        answers: null,
        juniority: null,
        note: 'The founding decision was leaving the names of strings that did not come back up on the board instead of wiping them. It was a bookkeeping choice about knowing how many skins were still out, and it became the only memorial anybody on that ground has.'
    },
    {
        id: 'figure-the-first-mist-warden',
        name: 'The first Mist Warden',
        alsoCalled: 'the one who was sent down',
        kind: 'founder',
        factionId: 'sect-azure-mist-court',
        whatTheyWere: 'A Sword Elder of the terraces who was sent to the lower gorge as a punishment nobody wrote down, and spent forty years turning the posting into an institution.',
        yearsAgo: 340,
        attestation: 'secure',
        attestationNote: 'The Pavilion kept the posting order and the Mist kept everything after it, and the two records agree on every date and disagree on what the posting was for.',
        answers: null,
        juniority: null,
        note: 'The whole of the Mist follows from one man declining to be humiliated. He is why a probation term is posted on the wall in the disciple\'s own hand: he posted his own on the day he arrived and never struck it through.'
    },
    {
        id: 'figure-shu-lianniang',
        name: 'Shu Lianniang',
        alsoCalled: 'the village teacher',
        kind: 'founder',
        factionId: 'sect-azure-dew-sect',
        whatTheyWere: 'A Dew Elder who never held a rank above that and taught in four hill villages for sixty years, sending eleven people up the gorge.',
        yearsAgo: 190,
        attestation: 'secure',
        attestationNote: 'Attested by the village rolls, which the Dew keeps and the terraces have never read, and by eleven terrace admissions that record a Dew origin and nothing about her.',
        answers: null,
        juniority: null,
        note: 'Eleven is more than the Mist managed in the same period. Nobody at the terraces has ever put those two figures side by side, and the Dew has never been in a position to.'
    },
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
export const NAMED_FIGURE_ENGINE_GAP = {
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
