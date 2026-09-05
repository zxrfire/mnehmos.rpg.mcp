/**
 * Sealed ancestors: sealed and dormant high-realm beings, held and unheld.
 *
 * The Hollow Court description says the quiet part outright - everyone else at
 * that ordinal is sealed under a mountain - and this file is what that
 * sentence commits the world to. There are more of them than any institution
 * has counted, they are not all owned, and the ones that are owned are the
 * reason the map is stable.
 *
 * TWO KINDS, AND THEY BEHAVE NOTHING ALIKE
 * ----------------------------------------
 *   held instruments  a sealed ancestor an institution owns, with a wake condition and
 *                     a cost. One-shot, ends the sealed ancestor, and therefore the
 *                     single most consequential decision that institution will
 *                     ever make. Every one of them has a published condition
 *                     and a private contingency, and the two are never the
 *                     same thing.
 *
 *   unowned sealed ancestors  sealed beings nobody holds. Not instruments: hazards and
 *                     opportunities. Nobody to bargain with, nobody to wake
 *                     them deliberately, and no institution takes
 *                     responsibility if one comes up. Some were sealed BY
 *                     something rather than FOR something, and at least one
 *                     was sealed by a party that no longer exists, so the seal
 *                     is unmaintained and nobody has checked it in centuries.
 *
 * THE COLD-WAR LOGIC, STATED PLAINLY
 * ----------------------------------
 * The real balance of power in this age is held by instruments nobody can
 * afford to spend. Everyone holding one is stronger than they look, and
 * weaker than they appear the moment they use it - because using it converts a
 * permanent deterrent into a single act and leaves them holding nothing.
 *
 * The reason none of them can be spent profitably on offence is
 * `THE_ASYMMETRY` below: the side that must convert loses and the side that
 * must merely obstruct wins, so an offensive waking is only ever worth it
 * against something unattended - and even then it can be answered by a
 * defensive waking that has to do nothing but be in the way.
 *
 * That, and not treaty or goodwill, is why the map is stable despite the
 * scarcity. It is also why the holders lie about what they have in both
 * directions, why nobody can price anybody, and why the one recorded case of a
 * sealed ancestor actually being spent is the precedent every current holder reasons
 * from - and what it taught them was not that it works.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// THE BINDING CONSTRAINT
// The parent principle. Everything else in this file, and the immortal
// intervention material in `crossings.ts`, is this at a different scale.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The binding constraint at every tier of this world is not power. It is who
 * is standing there when the window shuts.
 *
 * A sealed ancestor has a window and enormous capability inside it. An
 * immortal reaching down has ten to fifteen breaths and can do a staggering
 * amount with them. Neither can secure what happens afterwards, and afterwards
 * is where the payoff lives - so at every scale the question that decides
 * outcomes is the same one, and it is a question about bodies on the ground
 * rather than about strength.
 */
export const THE_BINDING_CONSTRAINT = {
    principle:
        'The binding constraint at every tier of this world is not power. It is who is standing there when the window shuts.',
    atEveryScale: [
        'A woken sealed ancestor: an enormous capability, a closing window, and a payoff that depends entirely on the sect still being in a position to hold what was taken.',
        'An immortal reaching down: fifteen breaths, the ability to empty a seat, and no way to decide who fills it over the following years.',
        'A seated defender: no capability required at all, and the whole of the outcome, because they are the one still standing there.'
    ],
    whyItMatters:
        'It is why violence from above is cheap and consolidation from above is impossible, why the apexes are immobile, why a sect thin on members cannot use what it holds, and why the strongest move available to anybody in this world is usually to be present and refuse to leave.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE ASYMMETRY
// The general law. Stated once, here, so the rest of the catalog inherits it
// rather than re-deriving it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The side that must CONVERT loses. The side that must merely OBSTRUCT wins.
 *
 * A one-shot instrument is weak when it needs a decisive result inside a
 * window, and strong when it only needs to make somebody else's window
 * insufficient. Which side of that a sealed ancestor is on is decided by what it is
 * asked to do, not by what it is.
 *
 * This is a law of the world and not an observation about any particular
 * vault. Every consequence below follows from it, and no entry anywhere in
 * the catalog should re-argue it or contradict it.
 */
export const THE_ASYMMETRY = {
    law:
        'The side that must convert loses. The side that must merely obstruct wins. An instrument sent to achieve something has a window, burns its own seat in the waking, and must produce a decisive result before the window closes. A defender is not spending anything and does not have to win, prevail or achieve: they have to still be in the way when the attacker runs out of time.',
    theNumber:
        'About one in a hundred for an instrument that must convert against somebody present, and the one is the defender making a catastrophic error rather than the attacker performing well. It is a real one rather than a zero, which matters: somebody desperate enough will eventually take that bet, and being right that they were desperate is the only warning anybody gets.',
    consequences: [
        'A sealed ancestor is weak on offence against anything attended and devastating against anything unattended - so every held sealed ancestor aimed at a prize is aimed at an absence.',
        'A sealed ancestor woken DEFENSIVELY inherits the good side of the asymmetry. It does not have to beat the attacker or survive the encounter meaningfully; it has to still be in the way when the attacker\'s window closes, which is a far easier thing to be asked for and is why a weaker sealed ancestor reliably ruins a stronger one.',
        'Presence is the strongest defence in the setting. It costs the defender nothing per day and everything the moment they stand up, which is cheap to hold and ruinous to interrupt.',
        'Apexes are immobile, arbitration happens by letter, and anybody who turns up in person is making a statement about how safe they are.',
        'The map is stable because the deterrents cannot be spent profitably on offence, not because anybody agreed to anything. Every holder is stronger than they look and finished the moment they use what they hold.'
    ],
    theStall:
        'Which produces the move that makes offensive wakings nearly unthinkable. A raid by a woken ancestor can be answered by allied ancestors woken to obstruct - not to win, and everybody involved knows they cannot win. A subsidiary sealed ancestor who could never take the Mirror can absolutely make the objective unmanageable inside the time the Mirror has, and that is the whole of what is required. Note what the obstruction is actually doing: it is not outlasting her, it is showing her a sum that no longer works, and she is the one doing the sum. She will accept that conclusion coldly and early. So the raid does not fail because it was beaten - it fails because she looked at the remaining time, priced the objective again, and reallocated. See `WHEN_ONE_WAKES`.',
    howToApplyIt:
        'Where an entry implies this, it should read as the conclusion of the arithmetic rather than as a separate fact. An entry that has a sealed ancestor attacking a seated party is wrong. An entry that has a sealed ancestor woken to obstruct one is correct and is the strongest thing such a party can do.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two kinds, and it is the single most important unknown about any sealed
 * ancestor - including to the people holding one.
 *
 *   terminal   sealed near the end of a lifespan to preserve what remained.
 *              Wakes with hours. Spends the last of themselves, and every
 *              piece of the closing-window arithmetic applies.
 *
 *   protector  sealed young, at peak, deliberately, during a golden age,
 *              specifically to be there later. Wakes with real time and a real
 *              future - closer to a seated defender who happens to be asleep
 *              than to a one-shot instrument. A sect holding one is genuinely
 *              hard to attack, because waking it does not burn it out.
 *
 * A sect that believes it holds a protector and actually holds a terminal is
 * in a very bad position and does not know, which is the most consequential
 * error available to an institution in this world.
 */
export const SealedAncestorKindSchema = z.enum(['terminal', 'protector', 'unknown']);
export type SealedAncestorKind = z.infer<typeof SealedAncestorKindSchema>;

/** How anybody knows a sealed ancestor is there at all. */
export const SealedAncestorAwarenessSchema = z.enum([
    'published',          // the holder says so on purpose, as a deterrent
    'rumoured',           // circulating, unverified, and mostly right
    'holder_only',        // the holder knows and nobody else does
    'unknown_to_holder',  // it is under somebody who does not know
    'forgotten'           // nobody living knows, and the record is gone
]);
export type SealedAncestorAwareness = z.infer<typeof SealedAncestorAwarenessSchema>;

/**
 * What state the sealed ancestor is actually in, as opposed to what the holder
 * believes. For the oldest of them these two fields disagree, and the holder
 * is the last party who would find out.
 */
export const SealedAncestorConditionSchema = z.enum(['live', 'degraded', 'dead']);
export type SealedAncestorCondition = z.infer<typeof SealedAncestorConditionSchema>;

export const HeldInstrumentSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    holderFactionId: z.string(),
    whoTheyWere: z.string().min(60),
    dormantYears: z.number().int().min(100),
    restingPlace: z.string().min(40),
    /** What the holder says publicly, where it says anything. */
    publishedCondition: z.string().min(60).nullable(),
    /**
     * What they are actually saving it against, which is never the published
     * condition and is frequently not written down anywhere.
     */
    privateContingency: z.string().min(200),
    /** Publication as deterrence, or silence as ambiguity. Not both. */
    strategy: z.enum(['deterrent_by_publication', 'silence']),
    strategyNote: z.string().min(150),
    wakeCost: z.string().min(120),
    awareness: SealedAncestorAwarenessSchema,
    /** Which kind it actually is. */
    kind: SealedAncestorKindSchema,
    /** Which kind the holder believes it is, which is not always the same. */
    holderBelievesKind: SealedAncestorKindSchema,
    kindNote: z.string().min(150),
    /** The truth. */
    condition: SealedAncestorConditionSchema,
    /** What the holder believes the condition is. */
    holderBelieves: SealedAncestorConditionSchema,
    conditionNote: z.string().min(150)
});
export type HeldInstrument = z.infer<typeof HeldInstrumentSchema>;

export const UnownedAncestorSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    whereItIs: z.string().min(60),
    /** Sealed FOR a purpose, or sealed BY something that happened. */
    sealedBy: z.string().min(60),
    sealedFor: z.string().min(80).nullable(),
    /** Null where the sealing party no longer exists. */
    sealerFactionId: z.string().nullable(),
    sealMaintained: z.boolean(),
    lastChecked: z.string().min(60),
    awareness: SealedAncestorAwarenessSchema,
    whoKnows: z.string().min(100),
    /** Nobody owns this. That is the point of the category. */
    hazard: z.string().min(150),
    opportunity: z.string().min(120),
    nobodyIsResponsible: z.string().min(120),
    /**
     * Who is actually in there and what they would do with the hours. The
     * hazard field is what the institutions worry about; this is the part
     * that is true.
     */
    ifSheWakes: z.string().min(200)
});
export type UnownedAncestor = z.infer<typeof UnownedAncestorSchema>;

// ─────────────────────────────────────────────────────────────────────────
// AGE IS NOT MENACE
// Stated once here and applied catalog-wide.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The default reading of an ancient thing in this world is not threat.
 *
 * Most of what is old here is people. They were young once, they built
 * something, they are diminished now, and on the whole they are kind. The
 * dangerous ones are dangerous for specific written reasons - a named
 * grievance, a named appetite, a named character flaw - and never merely
 * because they are old.
 */
export const AGE_IS_NOT_MENACE = {
    principle:
        'Age is not menace. An ancient thing in this world is, by default, a person who was young once and is diminished now, and the reasonable expectation on meeting one is not violence.',
    whyTheDefaultMatters:
        'Because the opposite default makes the whole setting into a haunted house, and this one is not a haunted house. It is a depleted country full of institutions doing their best with less than their predecessors had, and the oldest things in it are mostly the people who built those institutions and would still like them to do well.',
    whereThreatIsReal:
        'Where an old thing is dangerous, the reason is written down in its entry and is specific: a grievance with a living heir, an appetite, a vanity, a judgement made against values nobody holds any more. Absent such a line, read an ancient thing as a person having an unexpected day.',
    theTest:
        'If a catalog entry about something old reads as an instrument, a hazard or a monster and nothing else, it is tonally wrong and should be rewritten. The sealed ancestors are the sharpest case, because the institutional vocabulary around them - instrument, asset, deterrent, spend - is the holders speaking, not the narrator, and it is describing somebody who is asleep under a building and would be surprised to hear it.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE LAW OF SEALING
// Same grammar as the node law in `history.ts`: what exists can be kept,
// what is gone cannot be made again.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The Late Age cannot make a new seal. That art went with everything else.
 * It can maintain, repair and read the seals that already exist - exactly as
 * a node that has never gone out can be kept while a node that has gone out
 * cannot be relit. One law, two applications.
 */
export const SEALING_LAW = {
    theLaw:
        'The Late Age cannot make a new seal, and can maintain, repair and read the ones that exist. This is the node law from `history.ts` applied to sealing: what has never lapsed can be kept, and what is gone cannot be made again.',
    wakingIsAlwaysPossible:
        'And the consequence that matters most: there is no lost-key dead end anywhere in this world. No sealed ancestor is permanently unreachable. Any sect holding one can open it today, whatever state its records are in, and "we cannot wake ours" is never an available excuse - it does not appear in this catalog and should not appear anywhere else.',
    theConstraintIsKnowledge:
        'So the difficulty sits where this setting always wants it: not in capability, in knowledge. Opening the chamber is easy and irreversible. Knowing who is inside, which kind she is, how long she would have, whether she is still there at all, and whether now is the moment - that is hard, that is the whole game, and no amount of strength substitutes for it.',
    everyContingencyIsLive:
        'It also keeps the cold war real rather than theoretical. If waking needed a lost art the deterrents would be scenery. Because it does not, every holder in the world faces a live decision continuously, every rival knows they do, and the restraint on display is a choice being made daily rather than an incapacity.',
    sealsDoNotCheckWhoIsStanding:
        'And a seal does not check who opens it. An outsider who reaches the chamber can open it exactly as the holder can, which is what makes the raid scenarios coherent and what makes an unattended hall genuinely exposed. The protection on a sealed ancestor is the walk in, the wall, and the people standing in front of it - never the seal itself.',
    readingIsAScarceSkill:
        'Repairing and understanding an existing seal is possible and not common. It needs somebody who can read what is written on it, in a hand most people cannot read, and that skill is where the archival powers get their leverage: the Anchorhold certifies seals for a fee and keeps copies, the Deep Survey holds site records it sealed itself and never published, and a Dao house will read a hand nobody local can. It is the concrete, unmagical reason an outside party can know more about what is under your floor than you do.',
    unmaintainedSealsDecay:
        'A seal nobody maintains erodes. Not toward a wake condition and not on any schedule anybody set - it simply degrades, continuously, with nobody responsible and nobody watching. Every unowned ancestor in this catalog is sitting under a slow failure of exactly this kind, and that is the most likely way any of this material actually comes up: not a plan, not a raid, not a decision. Erosion, and then a morning when something that had been holding stops holding.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE LINEAGE CLAIM
// A sect's relationship to its ancestor is a claim, with every property a
// claim has - and she is the only authority in the world who can settle it.
// ─────────────────────────────────────────────────────────────────────────

export const THE_LINEAGE_CLAIM = {
    thePrinciple:
        'The question a woken ancestor is actually resolving is not whether her sect modernised. It is by what right this body claims her lineage, which is the same structure as a dynasty claiming the right to rule. Drift does not matter to her; she has lived a very long time and expects a thousand years to change an institution. The claim is what matters.',
    whatAClaimIs: [
        'It can be strong, weak, inherited, purchased, fabricated, or simply asserted long enough that nobody asks any more.',
        'It can be disputed. Two bodies can claim descent from one ancestor, and a schism produces exactly that: the ones who stayed and the ones who left, each holding in complete sincerity that they are the true continuation.',
        'Possession is not legitimacy. A sect can hold the original mountain, the original name and the original hall and have a broken claim, refounded by outsiders who took the name after the line had actually died. And the inverse holds: a body that moved, renamed itself and changed everything can hold the true line.',
        'It is usually unfalsifiable, which is why it survives. Everybody is working from documents, and documents are the thing that gets lost.'
    ],
    sheIsTheOnlyAuthority:
        'And here is what makes it explosive. A woken ancestor is, for a few hours, the single adjudicator of a legitimacy question that no other party in the world can resolve - not the Ninefold Ledger, which certifies records rather than lines, not the Anchorhold, and not possession. Waking her is therefore a political act quite apart from anything she could destroy.',
    theSecondReasonInstrumentsGoUnspent:
        'Which produces a reason for not waking that sits entirely alongside the arithmetic and has nothing to do with it. Not cost, not risk, not losing the hall: they are not certain their own claim would survive her verdict. Fear of being told, by the only party who could say it, that they are not who they have been saying they are for six hundred years - in front of witnesses, in the moment they were counting on her most. It applies to bodies whose claim is probably fine, because probably is not good enough when the answer is public, immediate and final.',
    theRivalClaimantWantsHerWoken:
        'And it inverts cleanly. A rival claimant who is confident wants her woken, and may work to bring it about - through a raid that forces a defensive waking, through pressure that makes one prudent, through simply telling somebody where the chamber is. That is an attack that nobody involved would recognise as one, that requires no strength at all, and that the target cannot defend against by being strong.',
    theUnusableAsset:
        'So a sect with a weak claim holds something it can never use and knows it. It keeps the ceremonies up exactly so that nobody wonders why it never wakes anybody, and its restraint reads from outside as the ordinary cold-war caution everybody else is exercising. At least one holder in this world is in that position, and its published caution is a cover for a hole in its own paperwork.',
    theVerdictMayBeNeither:
        'The verdict is not guaranteed to be a verdict. She may look at two claimants and decline to recognise either, or recognise the one nobody expected, or decline to engage with the question at all - she has hours, and adjudicating a succession dispute may be the very last thing she wants to spend them on. A body that wakes her to win an argument may find that the argument is not interesting to a woman with an afternoon left.',
    theDutyFollowsTheClaim:
        'What the claim actually buys is duty. Where the line runs to her and can be shown, she acts for the institution as a matter of course, diminished or not, and does not need to be persuaded that it deserves her. Where the claim is broken or gone, there is no duty - and see the last paragraphs of `WHAT_SHE_DOES_WITH_THE_TIME`, because no duty is not no kindness, and what she does freely is worth more than what she owes.',
    theLieIsViable:
        'And a body with a murky claim can simply lie. They wake her, present themselves as the true line, and she has been asleep a thousand years and cannot go and check anything - she has to judge from what is standing in front of her, in the time she has. The deception is genuinely workable, which is what makes this a decision rather than a closed door.',
    andIfSheWorksItOut:
        'If she works it out, she kills them all. Not as a twist - as the obvious response, and anybody who thinks about it from her side arrives there immediately. She has a handful of hours of existence left, and somebody has spent them, and the seal, and possibly the hall, in order to defraud her into acting for people she never agreed to protect. There is very little anybody in this world could do to her that is more offensive, and she has both the capability and the window to answer it completely.',
    theTwoQuestions: [
        'Do you actually know this ancestor?',
        'Are you actually the people she should be defending?'
    ],
    theTwoQuestionsNote:
        'That is the calculus a waking party actually runs, and it is not the arithmetic of windows and objectives that the plans are written in. Answer yes to both and you wake her with confidence. Answer no and you are gambling the entire sect - not the hall, the sect - on a deception aimed at somebody who can erase you inside her window and has every reason to.',
    preparationIsVisible:
        'Which makes preparation an observable activity. A sect with a shaky claim contemplating a waking has to rehearse: assemble the lineage, get the story straight, decide who speaks and in what order, possibly commission a document that did not exist last year. That is a great deal of unusual behaviour for attentive neighbours to notice over a season, and none of it looks like what it is - it looks like an anniversary, an audit, or a succession being tidied.',
    theSabotage:
        'And the perfect sabotage follows directly: exposure at the moment of waking. A rival who walks in holding the real document while she is standing there does not have to fight anybody, take anything, or survive anything. They have to be believed for one sentence. It costs nothing, it requires no strength, and it converts the target sect into the thing she deals with first.',
    theCruelAsymmetry:
        'The information runs one way and it is unkind. The liars know they are lying. What they cannot know is whether she can tell - what she remembers, what she can read in a room, how much of the line she could reconstruct from faces and forms and the way people hold themselves. There is no way to find that out that is not the attempt itself.',
    sheMayNotCare:
        'And she may not care. A real outcome, not a mercy: she works out that the claim is false and helps anyway, or leaves without comment, or says so plainly and goes outside. She has hours. Prosecuting a fraud is a way to spend them and not obviously the best one, and a woman on her last afternoon may find she would rather teach somebody something than punish a room full of frightened administrators. That uncertainty is exactly what keeps the gamble live rather than suicidal.',
    whichAssetYouActuallyHold:
        'So the claim decides what kind of thing a holder is sitting on. A clean claim means the instrument is usable. A murky one means it is usable only as a fraud, at the risk of annihilation, which is a completely different asset - and the sect holding it knows precisely which kind it has, has known for generations, and has never written the distinction down anywhere.',
    whereItAlreadyBites: [
        'sect-thousand-treasure-pavilion: two bodies claiming one ancestor, at most one correctly, neither able to settle it and the Ledger refusing to certify either. If that ancestor were ever woken, the dispute ends in an afternoon, which is why the quiet claimant is quiet.',
        'sect-clear-river-alliance: a name written down later because the ceremony needed one. The Alliance would not survive its own ancestor being asked, and has no way of finding that out.',
        'sect-frostmirror-court: a claim that is probably fine, resting on records that are good rather than perfect - and the Court has never once written down that this is one of the things it is risking when it opens the ice.'
    ]
} as const;

// ─────────────────────────────────────────────────────────────────────────
// WHAT SHE DOES WITH THE TIME
// Three outcomes, equal in standing, and nobody knows which until it
// happens - because asking is waking.
// ─────────────────────────────────────────────────────────────────────────

export const WHAT_SHE_DOES_WITH_THE_TIME = {
    theThreeOutcomes: [
        'She does the thing. She hears what is wanted, judges it sound, and spends the hours on it. This is the outcome every plan in the world is written around and it is one of three.',
        'She gives something away instead. She looks at what her institution has become, understands it immediately, and decides the best use of the time is to hand down something the world has lost.',
        'She goes and looks at the world. Not angry, not refusing anybody, not making a point - she has been asleep two thousand years, she has a few hours, and she would rather see the sky than solve the problems of people who cannot name her. She walks out, finds somewhere with a view, and watches the sun go down.'
    ],
    theyAreEqual:
        'These are three live outcomes rather than one outcome and two curiosities, and nobody - including her holders, including her - knows which it will be until it happens. Any plan that treats a waking as spending an asset has quietly assumed an answer it has no way to obtain.',
    theGift:
        'And the second one deserves its own paragraph, because it is likely rather than merciful. Consider what a woken ancestor actually is for those hours: a living teacher of something that has left the world. Understanding requires exposure - a teacher who holds it, a manual somebody can read, a thing to understand that nobody alive can teach - and the Late Age bites precisely because all three are gone. She is all three, walking and talking, briefly. So she spends the hours passing down an inheritance: a technique, a manual read aloud because nobody present can read the hand it is written in, a Dao transmitted directly, the location of something she left, or simply the answer to a question the sect has been getting wrong for six hundred years.',
    aDaoCanReEnterTheWorld:
        'Which makes this one of the very few mechanisms by which the Late Age gets anything back. Not a restoration, not a project, not anybody\'s plan: an accident, a woken woman with an afternoon, and a thing that was gone being in the world again on the other side of it. In a setting where nothing planned ever works, this is the right way for a recovery to happen.',
    itMayBeAPersonRatherThanTheInstitution:
        'And she may spend it on whichever disciple happened to be standing there when the wall came down, rather than on the sect at all. That is fate delivering, in exactly the register the inheritances in `wanderers.ts` already work in, and it does not require the recipient to have been anybody in particular beforehand. Being present is the qualification.',
    theRefusalThatIsNotARejection:
        'The third outcome is the one holders have not priced and it is devastating to a deliberate waking. A court spends its one instrument on a vault, and she gets up, listens, declines without drama, and goes outside. The plan is over. The hall is gone. Nobody did anything wrong to anybody and there is nothing anybody could even take offence at, which is worse for them than any confrontation would have been. It is also the strongest possible statement that these are people: she is not an instrument that malfunctioned, she is somebody with her own last afternoon, and she is allowed to want it.',
    howSheIsWokenMattersAsMuchAsWho:
        'The approach shapes the answer as much as the objective does. A deliberate waking by people who can name her, state her lineage and say why they came is a different event from a wall coming down on her while strangers repair a drain. Same woman, different first thirty seconds, different outcome - so build the result out of the approach rather than only out of what is being asked for.',
    theClaimDecidesTheDuty:
        'And what the first thirty seconds actually establish is not whether the sect has changed. Drift is expected and she knows it. It is by what right this body claims her line at all - see `THE_LINEAGE_CLAIM`, which is the whole of the question and is also the second reason instruments go unspent.',
    theyVary:
        'They are people, so they vary: kind, greedy, cruel, vain, tired, curious, principled. Do not write them as a uniform grade of noble ancient. At least one waking in this catalog would go badly for reasons of character rather than circumstance - see `sealed-the-sorting-yard`.',
    theSelectionEffect:
        'But the distribution is skewed, and by construction: a sect does not seal somebody it does not trust to act correctly a thousand years later. The population is high-reliability on purpose. Two things keep that honest. The judgement was made by people who are now long dead and can simply have been wrong. And it was made against that generation\'s values rather than their successors\' - so an ancestor can be exactly as reliable as advertised and still do something the current sect finds appalling, correctly, by the standard she was sealed under.',
    andSheMayHelpAnyway:
        'And no obligation is not the same as no kindness. She may look at whoever is standing in the rubble - a stranger, from an institution that does not exist any more, with no claim on her at all - and help them, because she is a decent person and it is her last afternoon and she would rather do that than not. That is worth more than the obligated version rather than less: a held ancestor acting for her sect is discharging a duty, and a free one helping somebody with no claim on her is a gift, freely given, by somebody who could have walked away and had every reason to. So the unowned case is not the dangerous case and the held case is not the safe one. Both are people with a short window and a choice, and the only difference is that one of them has a reason and the other does not need one.',
    theMostLikelyEvent:
        'Combine this with the decay rule in `SEALING_LAW` and the live case for the setting is clear: a defunct sect, an unmaintained seal, and a person inside with no ties. It is nobody\'s plan and nobody\'s fault, it is the likeliest uncontrolled event in the world, and what comes out of it is a person deciding what to do with an afternoon.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// WHEN THE RECORD IS LOST
// An ascended ancestor whose name is lost is an asset quietly written off.
// A sealed ancestor whose record is lost is somebody under your own hall
// whom you can no longer identify, and whose claim on you has lapsed
// because you cannot state it.
// ─────────────────────────────────────────────────────────────────────────

export const LOST_RECORDS = {
    thePrinciple:
        'Everything a holder needs is in the document, the document is nine hundred years old, and every part of it is losable independently. A sect does not lose a sealed ancestor in a dramatic event. It loses a page, and then it is standing on somebody it cannot name.',
    whatIsLosableSeparately: [
        'Who is down there: a name, a garbled name, or a name somebody wrote later because the ceremony needed one.',
        'Which kind - terminal or protector. Losing this is the actual mechanism by which a sect comes to believe it holds a protector while holding a terminal. Nobody is lying. They have a sentence written by somebody nine hundred years dead.',
        'How much time she would have, which is the entire basis on which waking her is or is not worth doing.',
        'Whether she is there at all. Nothing about a sealed chamber distinguishes an occupied one from an empty one, and opening it to check is the irreversible act.',
        'The wake condition - not the ability to open the chamber, which is never lost and never at issue, but the standing trigger the sealing party left in the work. Losing it means you cannot avoid tripping it, which is the direction that actually bites. See `SEALING_LAW`.',
        'And the lineage, which is the one that costs most: the line of descent that shows this body is her body. Lose that and you have not lost a document, you have lost the claim. See `THE_LINEAGE_CLAIM`.'
    ],
    theClaimProblem:
        'Which compounds catastrophically at the moment it matters. She wakes, and the sect cannot state who they are to her. Her duty ran to an institution whose line reaches her, and the people standing over her have no name for her and no descent they can show - so what they have is not a diminished claim, it is no claim, and she is under no obligation to it. That does not make her hostile and it does not even make her unhelpful. It makes everything she does from that point a gift rather than a duty, freely given or freely withheld, and the sect has no standing to be disappointed either way. The waking was spent before anybody opened their mouth, and it was spent by an archivist nine centuries ago.',
    somebodyElseMayKnow:
        'An outside party with better archives can know more about what is under your floor than you do, and the mechanism is mundane: reading a seal is a scarce skill and the archival powers have it. The Deep Survey holds site records it sealed itself and never published, the Anchorhold certifies seals for a fee and keeps copies, and a Dao house will read a hand nobody local can. So a rival with one good document knows the wake condition, the kind and the remaining window, while the holder knows a ceremony - an enormous, entirely quiet advantage that requires no strength at all. Somebody in this world is sitting on one right now, has never mentioned it, and is waiting to see whether it ever becomes useful.',
    categoryCollapse:
        'A forgotten sealed ancestor collapses the two categories in this file. It is not a held instrument, because nobody has priced it and nobody could brief her. It is not an ordinary unowned one either, because it is under an inhabited building with people working over it every day. It is an unowned ancestor under somebody else\'s floor: nobody\'s responsibility, with nobody watching the seal, an unmaintained seal decaying on schedule, and a congregation on top. The merge is the interesting part rather than a gap in the taxonomy.',
    theAccidentalWaking:
        'And the likeliest waking in the world is nobody\'s decision at all: masons, a footing, a drain, a leak being sealed, a hall being defended against something perfectly ordinary - reasonable people doing competent work, satisfying a condition nobody alive could have told them about. What comes out of it is not a disaster released. It is a person who has just been handed a small amount of time and a choice about how to spend it, standing in a broken wall looking at strangers, and the best thing she can do with those hours is give something away. See `WHAT_SHE_DOES_WITH_THE_TIME`, and `unowned-under-the-spring-hall` for the case.',
    howToUseIt:
        'These are available explanations across the catalog rather than a set piece. Where a sect is unaccountably careful about its own hall, unaccountably reluctant to allow building work, or unaccountably confident about what it holds, this is now a reason - and it is usually a better one than the reason the sect gives.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// WHEN ONE WAKES
// She is not a released monster. She is lucid, loyal and economical, she
// knows the size of her own window to the hour, and she spends it the way
// somebody spends the last of something.
// ─────────────────────────────────────────────────────────────────────────

export const WHEN_ONE_WAKES = {
    sheKnowsTheClock:
        'She wakes knowing how long she has, to the hour, without being told and without having to work it out. Everything she does afterwards is priced against that number, and anybody standing next to her is talking to somebody doing arithmetic continuously.',
    lucidNotFeral:
        'Fully herself, immediately. There is no confusion to exploit, no rage to redirect and no interval in which she is dangerous to her own side. What she is, is in a hurry - and being in a hurry makes her more careful rather than less.',
    economical:
        'She does nothing pointless. No massacre, no display, no burning a province on the way past - not out of gentleness, which does not enter into it, but because those things cost time and buy the sect nothing. Anybody expecting a rampage has misunderstood what was woken, and will be standing in the wrong place.',
    loyalToTheInstitution:
        'To the sect, and that is the frame for every decision she makes. Not to the person who woke her, not to the plan as it was written, and not to whoever is currently holding the seat: to the institution. So she will do the thing that serves it, and that is not automatically the thing she was woken for.',
    sheReassesses:
        'She makes her own assessment of the objective, on the way and again on arrival. If the sum has stopped working - the room is not empty, the window is shorter than the briefing said, somebody has arrived who should not be there - she can abort and reallocate the remainder. She would far rather spend the last of herself on something achievable than fail expensively at what she was asked for, and she has no stake in a sunk cost and no reason whatever to be brave.',
    andSheMayNotDoIt:
        'And doing what she was woken for is one of three outcomes rather than the outcome. See `WHAT_SHE_DOES_WITH_THE_TIME`: she may hand down something the world has lost instead, or she may simply go outside and look at the sky, and neither of those is a malfunction or a rebuke.',
    theAvailableOutcome:
        'Which means a sect can wake one for a vault and have her come back having done something else entirely, correctly, and be unable to argue with the reasoning. That is a genuinely available outcome and should be treated as one rather than as a twist.',
    whyStallingWorks:
        'This is why a defensive waking works, and it is not "hold her off until she is spent". A sealed ancestor woken to obstruct does not have to survive her or beat her. It has to make the arithmetic visibly stop working - because she is the one doing the arithmetic, and she will accept the conclusion faster and more coldly than any living commander would. The defence succeeds by persuading, and the persuasion is arithmetic rather than words.',
    whatSheAsksFirst:
        'She has been out for two thousand years. The first minutes are hers: what the sect has become, what year it is, who is holding the seat, what happened to the people she left it to, and whether the parties in front of her are who they say they are. She knows exactly what those minutes cost and asks anyway, because going out on somebody else\'s summary of the world is how an instrument gets wasted. Somebody had better have prepared the briefing, and the quality of that briefing is the single largest thing the living can contribute.',
    whatSheThinksOfThem:
        'She is the first Sovereign and the people waking her are her successors at a distance she can measure in a glance. She may not be impressed. She has no time and no particular reason to be kind about it, and she will say what she thinks once, briefly, while deciding. Being judged by your own founder in the last hours of her existence, while asking her to go and rob somebody, is what a waking actually looks like from the inside.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// HELD INSTRUMENTS
// ─────────────────────────────────────────────────────────────────────────

export const HELD_INSTRUMENTS: readonly HeldInstrument[] = [
    {
        id: 'sealed-the-kindler',
        name: 'The Kindler',
        holderFactionId: 'sect-nine-abyss-flame-sect',
        whoTheyWere: 'The first Flame Sovereign, who took the caldera, signed the transformation contract in full, and went down into the vent rather than finish the terms above ground.',
        dormantYears: 1_200,
        restingPlace: 'The vent under the caldera floor, behind a seal the sect maintains and has never opened.',
        publishedCondition: null,
        privateContingency:
            'The contract coming due. The sect teaches that the transformation is a bargain with a knowable counterparty, its own recovered text names none, and the elders who have read the original are privately certain that something will eventually arrive to collect on nine centuries of terms. The Kindler is what they intend to set against that arrival. It is the only contingency they have ever discussed in a closed room, they have never written it down, and every Flame Sovereign is told about it on the day they are seated.',
        strategy: 'silence',
        strategyNote:
            'Nobody outside the caldera knows the Kindler is there, and the sect prefers it that way for a reason that is not modesty: a published sealed ancestor deters attacks, and the sect is not afraid of being attacked. It is afraid of a creditor, and a creditor cannot be deterred by a threat it has not been told about - which the elders know, and which means the silence is protecting the surprise rather than the sect.',
        wakeCost:
            'Whatever is left of the Kindler burns itself and the caldera together. The sect survives the waking as an institution and does not survive it as a place, and everybody in it has been told so.',
        awareness: 'holder_only',
        kind: 'protector',
        holderBelievesKind: 'protector',
        kindNote:
            'A protector, correctly identified. He went down into the vent at strength rather than at the end of anything - the contract was signed and the terms were running, and he chose the vent as a position rather than as a grave. So he wakes with real time and a real future, which is why the Nine Abyss Flame Sect is genuinely hard to attack and why its rivals cannot work out where the confidence comes from.',
        condition: 'live',
        holderBelieves: 'live',
        conditionNote:
            'Live, and the sect is right about it - the seal at the vent has been maintained continuously and the Kindler has been checked, in the only way anybody dares check such a thing, twice in the last four centuries. It is the healthiest sealed ancestor in the world and belongs to the institution least likely to be attacked, which is the sort of distribution the world keeps producing.'
    },
    {
        id: 'sealed-the-mirror',
        name: 'The Mirror',
        holderFactionId: 'sect-frostmirror-court',
        whoTheyWere: 'The first Sovereign, who dug the ice curriculum out of the glacier, taught it to nine people, and then lay down in the hall she had cleared.',
        dormantYears: 2_000,
        restingPlace: 'The cold hall itself, at the centre of the ice field, under a floor nobody sweeps.',
        publishedCondition: null,
        privateContingency:
            'An apex vault at the one moment nobody is sitting on it. The Court has worked out that the Deep Survey cannot leave its own seat, has told nobody in a hundred and ninety years, and keeps a permanent watcher at Green Water City against a trigger that has never once occurred. See `contingencies.ts` for the worked case: it is the clearest example in the world of what a private contingency actually looks like, and it is not what the Court has written down.',
        strategy: 'silence',
        strategyNote:
            'Silence, absolutely, and for the specific reason that the plan requires surprise and the observation underneath it is spent the moment a second party holds it. The Court fields a fraction of the defence its holdings warrant and has never lost the library, which reads externally as luck and is a deliberate refusal to advertise.',
        wakeCost:
            'She wakes cold and unhurried, and the hall does not survive it. The Court has written down that this is acceptable, which is the only part of the arrangement that is on paper.',
        awareness: 'holder_only',
        kind: 'terminal',
        holderBelievesKind: 'terminal',
        kindNote:
            'Terminal, and the Court has never pretended otherwise. She dug the curriculum out of the glacier, taught it to nine people and lay down in the hall she had cleared, at the end of a life rather than in the middle of one - so she wakes with hours and the whole closing-window arithmetic applies. Every term of the vault plan is built on that number and the Court has never had cause to doubt it.',
        condition: 'live',
        holderBelieves: 'live',
        conditionNote:
            'Live. Two forced entries are recorded by outside parties and neither party is recorded as having left, which is the closest thing to a test any sealed ancestor in the catalog has had, and it is why the Court is confident where the Anchorhold is merely certain.'
    },
    {
        id: 'sealed-xu-ci',
        name: 'Xu Ci, the Second Standing Anchor',
        holderFactionId: 'house-anchorhold',
        whoTheyWere: 'The Anchor who drove the replacement eastern nail personally and then had herself entombed under the datum stone rather than retire, on the argument that a nail should stay where it is.',
        dormantYears: 700,
        restingPlace: 'Under the datum stone, in the chamber every measurement in the region is ultimately taken from.',
        publishedCondition: 'Two perimeters lost in a single season. One is a shortfall the house posts publicly; two is the condition, and it appears in the regional survey standard as a line item.',
        privateContingency:
            'The eastern nail specifically, and not perimeters in general. The published schedule is deliberately broader than the intention: the Wardens of the Survey have agreed among themselves that they would wake her for the eastern socket failing and would find a reason not to for anything else, because the eastern nail is the one the house broke to found itself and is the only failure it could not survive being blamed for. Nobody has written that down and every Warden of the Survey knows it.',
        strategy: 'deterrent_by_publication',
        strategyNote:
            'The only holder in the world that publishes. Putting the condition in the survey standard converts a sealed ancestor into a deterrent that works continuously and costs nothing, and the Anchorhold cannot pursue anybody, so a schedule is the only enforcement it has. It also means the house has bet everything on a claim anybody could test by taking two perimeters in one season, and nobody has.',
        wakeCost:
            'She rises, drives one nail, and does not come back up. The house has published that too, in detail, which is the part that makes the deterrent legible rather than boastful.',
        awareness: 'published',
        kind: 'terminal',
        holderBelievesKind: 'protector',
        kindNote:
            'The worst error available, made in complete good faith. The house believes it entombed a protector - she had herself put under the stone rather than retire, which reads as a position taken at strength - and what it actually entombed was a terminal at the end of a long career, because driving the replacement eastern nail personally had already cost her most of what she had left. A protector keeps. A terminal does not, and this is why she is dead: not because the entombment failed, but because the house sealed the wrong kind of person and set the schedule accordingly.',
        condition: 'dead',
        holderBelieves: 'live',
        conditionNote:
            'She is gone, and has been for something on the order of two centuries. Seven hundred years is a long time under a stone, the entombment was performed by a house that had never done one before and has never done another, and nothing about the chamber would tell anybody: it is sealed, it is quiet, and quiet is what it is supposed to be. So the Anchorhold has published a schedule it cannot execute, the entire strategic posture of a house that administers eleven perimeters rests on it, and the two perimeters currently maintained below standard are being watched by more people than the house employs. It is the most likely state for the oldest of these and it is the one nobody checks, because checking is indistinguishable from spending.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// UNOWNED SEALED ANCESTORS
// Nobody's to wake, nobody's to bargain with, nobody's to blame.
// ─────────────────────────────────────────────────────────────────────────

export const UNOWNED_ANCESTORS: readonly UnownedAncestor[] = [
    {
        id: 'sealed-meng-da',
        name: 'Patriarch Meng Da',
        whereItIs: 'Somewhere in the vein workings under the Nine Peaks, which have never been sealed and are entered by ascetics on ordinary business several times a year.',
        sealedBy: 'Nothing. He walked in eight hundred years ago to survey the workings and did not come out, and the Order has never closed the entrance.',
        sealedFor: null,
        sealerFactionId: null,
        sealMaintained: false,
        lastChecked: 'Never. There is nothing to check, because the Order does not treat this as a thing that exists - it is a story ascetics tell each other and do not offer to outsiders.',
        awareness: 'unknown_to_holder',
        whoKnows:
            'The Order has surveyed the workings to the depth he is at and has never opened it or said why, which is as close to knowing as an institution gets without admitting anything. What it does not accept is the conclusion: the ascetics tell it as a story, and a story is not a thing an Order has to act on. The Peak Wardens want the workings surveyed and Meng Da resolved; the Mountain Elders hold that the workings are the vein and the vein is not to be entered, which is doctrine dressed as caution and is the only reason nobody has gone looking.',
        hazard:
            'The deepest vein in the province is being worked continuously by an institution that has an eight-hundred-year-old Patriarch somewhere underneath it and has decided the question is a matter of tradition. If he is down there and something reaches him - a collapse, a deep survey, a boundary dispute that goes to digging - it happens under the richest ground in the Jade Gorge, to a party nobody warned, with no wake condition, no cost accounting and nobody who could be said to have decided anything.',
        opportunity:
            'The only sealed ancestor in the world that is not behind a seal. Anybody willing to go into the workings could reach him, and reaching him is the single cheapest access to a high-realm being available anywhere - which is exactly why the Mountain Elders have made not entering into a principle.',
        ifSheWakes:
            'He is the best case in the world and nobody has noticed, because everybody is busy treating him as a hazard under a vein. The Order still exists, the line runs to him unbroken and legibly, and he would recognise it in a sentence - so the duty holds and he would act for them. What he would probably do with the hours is not fight anybody. It is talk: the Order holds its founding record in a hand whose numerals it reads perfectly and whose prose it has not read in eight hundred years, and he is the last person alive who could read it aloud. An afternoon of that is worth more to the Nine Peaks than anything under the mountain, and the Mountain Elders have turned not going to look at him into doctrine.',
        nobodyIsResponsible:
            'The Order would deny he is there. If he came up, no institution would accept that it had been theirs to manage: the Order because it never sealed anything, the Sill because a vein grant is not a custodial obligation, and the Survey because its register has no entry for a person who is not dead and is not anywhere.'
    },
    {
        id: 'sealed-the-tally-seal',
        name: 'Whatever the Tally Court sealed at Burnt Earth',
        whereItIs: 'Under the burned seat at Burnt Earth, behind a seal that predates the Ninefold Ledger and was cut by the house the Ledger destroyed.',
        sealedBy: 'The Tally Court, twenty-three centuries ago, for a reason that was in the volumes the Ledger took and has never opened.',
        sealedFor: 'Unknown, and the distinction matters: nobody can say whether it was sealed to keep something in, to keep something preserved, or to keep something from being read. The three cases call for three completely different responses and there is no evidence that separates them.',
        sealerFactionId: null,
        sealMaintained: false,
        lastChecked: 'Not in twenty-three centuries by anyone with standing to do it. The ground is where debts sworn do not settle and never have, which is treated locally as a curiosity of the site.',
        awareness: 'rumoured',
        whoKnows:
            'Burnt Earth Temple knows there is something under its ground and has never investigated, on the Abbot\'s stated reasoning that a thing sealed by people who are dead is not the Temple\'s business. The Ninefold Ledger almost certainly holds the answer in its nine sealed volumes, has never opened them, and has three internal factions arguing about it for reasons that have nothing to do with this.',
        hazard:
            'An unmaintained seal cut by a destroyed house, on ground that visibly does something to obligations sworn on it, under a temple that takes in anybody and has four monks. Nobody is maintaining it because the maintainers were dissolved twenty-three centuries ago, nobody has inspected it because inspecting it requires opening it, and the only party who could say what is behind it destroyed the party that put it there and then sealed the records.',
        opportunity:
            'The Ledger volumes and the seal are the same question from two ends. A player who opened either would be the first person in two millennia to know what the Tally Court was actually doing when it was ended, which is worth more than anything physical that might be behind the stone.',
        ifSheWakes:
            'If it is a person at all, it is a person whose institution was destroyed by a body that still exists and still holds the volumes. There is no duty to anybody - the Tally Court is gone, and nothing the Burnt Earth monks could say would give them a claim - so what wakes is someone with a short window, no obligations, and a grievance whose defendant is genuinely still there. That is the one case in this catalog where a stale grievance has a living heir, and the Ninefold Ledger has never once considered that its nine sealed volumes might be the other half of a person. What she would actually do with the hours is nobody\'s to predict. The Abbot, who takes in anybody and asks nothing, would very likely be the first person she spoke to, and that is not the worst possible start.',
        nobodyIsResponsible:
            'The Temple did not seal it, the Ledger did not seal it, and the party that did no longer exists. If it opens, the arbitration would be about who has to deal with it rather than who caused it, and the Ledger would be arbitrating a case in which it is the interested party.'
    },
    {
        id: 'sealed-the-sorting-yard',
        name: 'The sealed part of the sorting-yard ruin',
        whereItIs: 'Behind the front three chambers of the ruin the Gleaners\' Company works out of at Willow Village, in the Silent Cliffs.',
        sealedBy: 'The catastrophe, most likely, rather than by anybody - the driving of the qi into the stone closed a great deal that nobody chose to close, and this is one of the places that shut.',
        sealedFor: null,
        sealerFactionId: null,
        sealMaintained: false,
        lastChecked: 'Thirty years ago, by Deep Gleaner Xun, who went in on a wager and did not come back. The Company sealed it again and raised the wager, which is the whole of the region\'s risk assessment.',
        awareness: 'rumoured',
        whoKnows:
            'Every Gleaner, as a working fact rather than a secret: the Company lays out its sorting yard inside a building it has never fully entered, works three nodes at the front of it, and leaves the rest closed on the reasonable grounds that it was closed for a reason. Nobody outside the Silent Cliffs has ever been told, because nobody outside the Silent Cliffs asks the Gleaners anything.',
        hazard:
            'A crew of nine to fifteen people sorts salvage every working day against a wall that has taken one person in living memory. The Company has no idea what is behind it, has never seen the inscription its own vocabulary above Keystone was copied from, and the highest-ranking authority in the province is a bureau with eleven staff and no procedure for this.',
        opportunity:
            'The Silent Cliffs vocabulary for the upper realms came off an inscription in there, which means somebody in that ruin knew what those states are - and the Long Cut, which administers the province and would very much like a working account of the upper realms, has never been told the sealed part exists.',
        ifSheWakes:
            'This is the entry where the selection effect does not apply, because nobody chose her: the catastrophe shut the door and her own people sealed the front and walked out, and she has had four thousand years to think about that. She was a scholar of the upper realms and vain about it - the inscription the whole Silent Cliffs vocabulary was copied from is hers, and she wrote it in the register of somebody who expected to be read. What makes her dangerous is not power and not malice. It is that she cannot tell the difference between the people who left her and the people working her yard, because the Gleaners are sorting salvage in her building using her words, and the distinction between a successor and a stranger will not survive the first thirty seconds. A crew of nine would be talking to somebody who has already decided who they are.',
        nobodyIsResponsible:
            'The Company holds a salvage contract rather than a lease, and a contractor is not protected, arbitrated for, or spoken for. If it opened, the Weir Office would receipt the notification and the Ninth Face would answer it at the next revision, up to twenty years later.'
    },
    {
        id: 'unowned-under-the-spring-hall',
        name: 'Whoever is under the Verdant Spring Hall',
        whereItIs: 'Beneath the terraced herb valley, in a chamber the stone irrigation channels run over and around, under a hall with ninety physicians working in it every day.',
        sealedBy: 'The party whose channels the Hall inherited and has never been able to reproduce, at a date nothing in the valley records.',
        sealedFor: 'Unknown, and nobody has ever formulated the question. The Hall does not know there is a chamber; it knows the channels are original, that they are cut to a standard its own masons cannot match, and that they crack.',
        sealerFactionId: null,
        sealMaintained: false,
        lastChecked: 'Never, by anybody, in any record. The Hall patches a cracked channel with fired clay roughly every forty years and has done so for nine hundred.',
        awareness: 'forgotten',
        whoKnows:
            'Nobody living. The Deep Survey may hold the original site record among the material it sealed itself and never published, which would make it the only party in the world that could say what is down there - and it has never had a reason to look, because a herb valley two provinces from an arterial is not something a Survey register asks questions about.',
        hazard:
            'The channels are part of the sealing work rather than merely near it, and the standing trigger is a state of that work rather than an intruder - so the Hall moves a little closer to it every time its masons make a careful, competent, entirely reasonable repair with the wrong material. Nobody alive could have told them. There is no malice anywhere in it, no raid and no greed, and no moment at which anybody did anything wrong. The seal is also unmaintained and has been eroding for nine hundred years, so the two clocks are running together.',
        opportunity:
            'Anybody who read the original site record would know something about the Verdant Spring Hall that the Verdant Spring Hall cannot know, and could tell them - which would be worth more to the Hall than anything else in the world and is worth almost nothing to anybody else.',
        nobodyIsResponsible:
            'The Hall holds a sub-grant on a valley and has no custodial obligation to anything under it, the Ascetic Order that granted it has never surveyed below the springs, and the party that did the sealing has been gone long enough that the question of liability has no defendant. If it opens, the arbitration is about who deals with ninety physicians and a chamber, and the Ledger would be starting from nothing.',
        ifSheWakes:
            'A wall comes down during a repair and a woman steps out into a working infirmary. Nobody there can name her, nobody can show her a line, and she does not ask them to - she can see what the building is for inside a minute, which is more than most wakings get. So there is no duty and she does not pretend there is one. What there is, is an afternoon, ninety physicians, and a person who knew the channels when they were cut and understood what they were doing to the water. The likely outcome is the generous one and it is generous precisely because nothing obliges it: she spends the hours teaching. A method the Late Age lost, a Dao transmitted directly to whichever physician was holding the trowel, or simply the answer to the question the Hall has been getting wrong since the channels started cracking. It is one of the very few ways anything actually comes back in this age, it is nobody\'s plan, and it happens because somebody was standing there.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE CLASS AS A WHOLE
// ─────────────────────────────────────────────────────────────────────────

export const SEALED_ANCESTOR_PATTERN = {
    theLaw:
        'See THE_ASYMMETRY above. The side that must convert loses and the side that must obstruct wins, so an offensive waking is pointed at an absence and a defensive one only has to be in the way. Everything below is that law with names attached.',
    coldWarLogic:
        'The balance of power in this age is held by instruments nobody can afford to spend. Every holder is stronger than they look, because an unspent sealed ancestor is a permanent deterrent that costs nothing to hold - and weaker than they appear the moment they use it, because using it converts that permanence into one act and leaves them holding nothing. That is why the map is stable despite the scarcity: not treaties, and not restraint. Unspendable deterrents, held by parties who all understand the arithmetic and none of whom can go first.',
    whyHoldersLieBothWays:
        'A holder with a live sealed ancestor may publish it, to deter, or conceal it, to preserve surprise. A holder with a dead one has every reason to keep publishing. So a claim is not evidence and an absence of claim is not evidence, and no institution in the world can price another one on this axis - which is a large part of why the powers are so careful with each other.',
    howAnybodyKnows: [
        'published: the Anchorhold puts its wake condition in the regional survey standard as a line item, because a deterrent that nobody has read does not deter.',
        'rumoured: the sorting-yard ruin and the Burnt Earth seal, known as working facts to the people standing next to them and to almost nobody else.',
        'holder only: the Kindler and the Mirror, both concealed deliberately and for opposite reasons - one to surprise a creditor, one to preserve a plan.',
        'unknown to the holder: Meng Da, under an institution that treats the question as folklore.',
        'forgotten: the category the world keeps producing and nobody can enumerate, since a seal whose record is gone is indistinguishable from a wall.'
    ],
    whatWakingLooksLikeFromOutside: [
        'The qi goes wrong first, over a region rather than a site: ambient readings that swing in a day, and cultivators reporting circulation that will not settle for reasons no physician can find.',
        'Formations fail in a pattern that runs outward from one place, and the failures are not damage - nodes simply stop resolving, in order, over hours.',
        'Animals leave. Spirit beasts move before anything else does, in numbers, in one direction, and nobody local misreads it because everybody local has heard what it means.',
        'The ground reports it. A sound below hearing that people describe as pressure rather than noise, and standing water going still in a way it does not otherwise do.',
        'Then the weather, which is the point at which it is too late to be anywhere near it: a season arriving in an afternoon over a province, at the wrong time of year, with no front behind it.'
    ],
    theOneCaseWhereItWasSpent: {
        yearsAgo: 1_100,
        who: 'A sect the Ledger records as the Verge Hall, which held a vein at the head of a valley two provinces east and does not exist now.',
        why: 'Its vein was taken by a larger neighbour in a lease dispute that the Hall lost on paper, correctly and unappealably, and it woke what it had under its mountain rather than accept the ruling.',
        whatItBought:
            'Everything it asked for, in one night. The neighbour ceased to exist as an institution - not defeated, ended - the lease was void because there was no counterparty, and the Verge Hall held its vein and the neighbour\'s with nobody in the province willing to raise the subject.',
        whatItCost:
            'The sealed ancestor, the mountain, and forty years later the Hall itself. Having spent the only thing that made anybody careful around it, it was an ordinary sect with two veins and a reputation for having no reserve left - and a third party that had watched the whole thing absorbed it inside two generations, without a fight, mostly by hiring its people.',
        theLessonEverybodyTook:
            'Not that it fails, because it did not fail: it worked completely. The lesson every current holder reasons from is that it works and then you are food. That is why the Anchorhold publishes rather than uses, why the Frostmirror Court will only spend the Mirror on something that leaves it the wealthiest institution in the world afterwards, and why the Nine Abyss Flame Sect is saving the Kindler for a creditor rather than for a rival.'
    },
    theyArePeople:
        'Read this whole section in the light of `AGE_IS_NOT_MENACE`. The vocabulary above - instrument, asset, deterrent, spend - is the holders speaking and not the narrator. What it describes is somebody asleep under a building who was young once, built the place, would still like it to do well, and would be surprised to hear herself priced. Three things can happen when one wakes, only one of them is what anybody planned, and the other two are better. See `WHAT_SHE_DOES_WITH_THE_TIME`.',
    theSecondReasonNobodyWakes:
        'Alongside the arithmetic there is a reason that has nothing to do with cost: she is the only authority in the world who can rule on whether the body waking her is really hers. Some holders are not certain their claim would survive that, and the ceremonies they keep up are partly there so that nobody wonders why the chamber never opens. See `THE_LINEAGE_CLAIM`.',
    forgetting:
        'And the commonest failure of all is not a raid or a waking: it is an archive. See `LOST_RECORDS`. A sect that has lost the page can still open the chamber - opening is never the hard part - but it cannot name her, cannot brief her, cannot price the window and cannot show her the line, and the loss is invisible from inside because the ceremony continues exactly as before.',
    theTwoKinds:
        'Terminal and protector, and it is the most important unknown about any of them. A terminal wakes with hours and must convert inside them; a protector wakes with real time and a future, is closer to a seated defender who happens to be asleep, and does not burn out in the using. Value rankings, capability envelopes and wake conditions all change depending on which one a holder actually has - and where the records are thin, the holder frequently does not know. There is one of each in this catalog held correctly, and one held wrongly.',
    theOneThatWillNotWake:
        'At least one of them is already gone, and the holder is the last party who would find out. Xu Ci has been dead for perhaps two centuries under the Anchorhold datum stone, the house has published a schedule it cannot execute, and its entire strategic posture rests on it. This is the most likely state for the oldest of these, and nobody checks, because checking a sealed ancestor is indistinguishable from spending one.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const HELD_BY_ID: ReadonlyMap<string, HeldInstrument> = new Map(HELD_INSTRUMENTS.map(h => [h.id, h]));
const UNOWNED_BY_ID: ReadonlyMap<string, UnownedAncestor> = new Map(UNOWNED_ANCESTORS.map(u => [u.id, u]));

export function getHeldInstrument(id: string): HeldInstrument | undefined {
    return HELD_BY_ID.get(id);
}

export function getUnownedAncestor(id: string): UnownedAncestor | undefined {
    return UNOWNED_BY_ID.get(id);
}

/** What a faction is holding, which is at most one thing. */
export function instrumentHeldBy(factionId: string): HeldInstrument | undefined {
    return HELD_INSTRUMENTS.find(h => h.holderFactionId === factionId);
}

/**
 * Instruments whose holder is wrong about what they have. The engine should
 * never surface this to the holder, and the holder should keep acting on the
 * belief.
 */
export function bluffs(): HeldInstrument[] {
    return HELD_INSTRUMENTS.filter(h => h.condition !== h.holderBelieves);
}

/** Sealed ancestors nobody is maintaining, which is all of the unowned ones. */
export function unmaintainedSeals(): UnownedAncestor[] {
    return UNOWNED_ANCESTORS.filter(u => !u.sealMaintained);
}
