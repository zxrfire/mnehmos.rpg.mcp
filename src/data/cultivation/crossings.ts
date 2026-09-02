/**
 * How the last crossing is actually attempted, and who still has somebody
 * answering from the other side of it.
 *
 * Two subjects, and they explain each other.
 *
 * THE PRACTICE
 * ------------
 * Almost everybody attempts the crossing in a cave in the middle of nowhere
 * and tells nobody where. Not modesty: a crossing is the most exposed moment
 * of a cultivator's life - committed, occupied, and drawing heavenly lightning
 * that can be seen for a very long way - and anybody with a grudge and the
 * sense to wait has been waiting for exactly this. Announcing the location is
 * handing a century-old feud its opportunity.
 *
 * The practice is completely ordinary. Everybody knows it, nobody discusses
 * it, and it is not considered cowardice by anyone. It is also why the record
 * of the last crossing is so thin: people simply stop being seen, and there is
 * nobody who could say which of the four things happened to them.
 *
 * THE CHANNEL
 * -----------
 * Immortal-realm consumables can only come down from above and cannot be made
 * or reordered here. So an institution that holds them has a channel, and a
 * channel means somebody up there who is still answering.
 *
 * That, and not vein wealth or realm distribution, is the real hierarchy of
 * the world: whether anyone above the Lid is still answering when you call.
 * Two administering bodies can call and get objects. One body can call and get
 * accounts of the crossing itself, which is the only thing it wants. Everybody
 * else has a hall of tablets.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// THE PRACTICE
// ─────────────────────────────────────────────────────────────────────────

export const CROSSING_PRACTICE = {
    whatEverybodyDoes:
        'A cave, somewhere remote, told to nobody. No announcement, no witnesses, no location shared - frequently not even with a sect that has spent three hundred years supplying the attempt. The cultivator disappears, and that is the whole of the arrangement.',
    why:
        'Because a crossing needs a dao protector and almost nobody can obtain one. The cultivator is entirely committed and entirely helpless for the duration - occupied, drawing lightning visible for a very long way, and unable to defend themselves at all - so somebody has to stand guard. Almost nobody can. Secrecy is therefore not the first line of defence, it is what a cultivator does INSTEAD of protection: unable to be guarded, the only remaining measure is that nobody knows where you are. That it also defeats a century-old feud waiting for exactly this moment is true, and is the second reason rather than the first.',
    howItIsRegarded:
        'As ordinary. Everybody knows it is what is done, nobody discusses it, and nobody thinks less of anyone for it. It is not a doctrine or a secret; it is simply the practice, in the way that not announcing which road you are travelling is the practice.',
    consequences: [
        'The record is thin because there is nothing to record. People stop being seen, and whether they crossed, died, half-failed or went into seclusion is unknown, because there is nobody who could say.',
        'Scars turn up later and unattributed: a patch of dead ground with a tribulation signature and no name on it. Some belong to names on the candidate lists and some belong to people nobody ever wondered about.',
        'Names get misfiled as a matter of course. A cultivator vanishes, something garbled surfaces a decade later, and no register can distinguish ascended from died from walking around from perfectly fine and in seclusion.',
        'The enemies do sometimes turn up, because somebody worked out the location or followed or simply guessed well - and a crossing interrupted is a death that leaves no trace of having been anything other than a failed crossing.'
    ],
    theAnomaly:
        'The Hollow Court does it openly. Four known mountains, continuously, at an address anybody could walk to, which is the exact opposite of what every other cultivator in the world does with the single most vulnerable act available to them. It is not confidence about the crossing itself. It is the plain fact that nothing in the world can reach them mid-attempt, stated in the only way that could not be mistaken for a boast. Nobody has ever tested it.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE DAO PROTECTOR
// The thing almost nobody can get, and the reason everything else about a
// crossing looks the way it does.
// ─────────────────────────────────────────────────────────────────────────

export const DAO_PROTECTOR = {
    whatItIs:
        'Somebody who stands guard over a crossing. The cultivator making the attempt is committed and helpless for its whole duration, and cannot break off, defend themselves, or be moved. A protector is the only defence that exists.',
    whyAlmostNobodyHasOne:
        'Three requirements, and the conjunction is what kills it. The protector must be strong enough to matter against whatever arrives - which at this altitude means very few people. They must be willing to spend that on somebody else\'s advancement rather than their own. And they must be physically present for the whole of it, which at the top of the ladder means abandoning their own work for the duration. There is essentially nobody who satisfies all three and is available.',
    whatMostPeopleDoInstead:
        'They disappear. Secrecy is the substitute for a guard, chosen because the guard is unobtainable, and it is why crossings happen in caves nobody was told about.',
    theTrust:
        'Accepting a protector is the most complete trust available in this world. You are helpless, for a long time, in front of somebody strong enough to matter, having told them exactly where and when. There is no larger act of trust anybody here can perform, and there is no worse treachery available than betraying it.',
    theBetrayal: {
        yearsAgo: 1_700,
        what:
            'It has happened, and the histories keep one instance because it is the only one anybody could prove. A cultivator at Tribulation Transcendence Perfection accepted a protector, named the mountain, and was killed at the moment of commitment by the person standing guard, who then took what was on the body and reported a failed crossing - which is exactly what a failed crossing looks like from outside.',
        howItWasEstablished:
            'Two centuries later, by an inheritance that could not have been opened by anyone but the dead party, in the possession of somebody who should never have had it. The Ninefold Ledger still holds the case and cites it in arbitration about nothing else.',
        whyItStillMatters:
            'It is the reason a protector arrangement is almost never made between parties who are not already bound by something older than the arrangement, and it is quoted by every cultivator who declines to guard somebody. One instance in seventeen hundred years has been enough to shape the practice permanently.'
    },
    theOtherPossibility:
        'A False Immortal could stand protector. Strong enough to matter against anything that arrives, available in a way nobody with a sect or a crossing of their own ever is, and entirely indifferent to what it would cost him. Whether the wandering one would, and what it would mean that he did, is unresolved and should stay unresolved - but it is legible to anybody who understands what he is, and it means an inheritor of his has something to hope for that nobody else in the world can hope for at all.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE HOLLOW COURT, RESTATED
// Not four beings who reached the top and sat down. A collaboration, and
// possibly the only functioning one at that altitude in the history of the
// world.
// ─────────────────────────────────────────────────────────────────────────

export const HOLLOW_COURT_COLLABORATION = {
    whatTheyActuallyAre:
        'The only body in the world that can supply its own protectors. They hold multiple Tribulation Transcenders, and at points in their history several at Perfection simultaneously, which means they can do the one thing nobody else can: one crosses while the others stand guard. Everything else about them follows from that sentence.',
    explains: [
        'The open, published address. They do not need secrecy because they have the thing secrecy is a substitute for, and four known mountains is what it looks like when a crossing does not have to be hidden.',
        'Presence measured in decades of absence. They take turns, and a protector has to be there for the whole of it - so at any given time some of them are crossing, some are standing guard, and none of them is available for anything else.',
        'The admission bar, exactly. A Void Refinement floor plus evidence you could cross means a member is either somebody who will need protecting or somebody who can provide it. There is no third contribution, which is why nothing else counts and why being somebody\'s child explicitly does not.',
        'Why they hold the richest vein in the world and draw nothing from it: the vein is not what the work runs on.'
    ],
    theLivePossibility:
        'They may do it in this era. Not history and not aspiration - a live present-tense possibility, under consideration now, that could resolve within the span of a single run: one of them attempts the crossing with the others standing protector, which would be the first protected crossing in a very long time. Nobody outside the four knows it is being considered. If it happens the world finds out afterwards, from the tide.',
    whatTheWorldWouldSee:
        'A spirit tide, arriving without warning and without explanation, and four mountains that are quiet in a way somebody would eventually notice was different. No announcement would be made. The Court has never announced anything.',
    whyNobodyElseCanCopyIt:
        'It requires two or more cultivators at the top of the ladder who are willing to spend their own time and risk on somebody else\'s attempt, in the same place, repeatedly, for centuries. Every other institution in the world that has had two such people has had them competing.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// CHANNELS
// ─────────────────────────────────────────────────────────────────────────

export const ChannelKindSchema = z.enum([
    /** Somebody up there is still answering, at intervals measured in ages. */
    'answering_channel',
    /**
     * Somebody up there is answering constantly, because they have a reason
     * down here that is a person rather than an institution.
     */
    'personal_channel',
    /** Somebody left what they left, and nothing further is coming. */
    'parting_gift'
]);
export type ChannelKind = z.infer<typeof ChannelKindSchema>;

export const ImmortalChannelSchema = z.object({
    factionId: z.string(),
    kind: ChannelKindSchema,
    ancestor: z.object({
        name: z.string().min(1),
        whatTheyWere: z.string().min(40),
        crossedYearsAgo: z.number().int().min(1)
    }),
    /** What actually comes back, which differs completely by holder. */
    whatItReturns: z.string().min(150),
    /** How often, and with what guarantee. Usually none. */
    cadence: z.string().min(100),
    /** How much of it is usable. For accounts of the crossing, very little. */
    usability: z.string().min(150),
    /** The best grade this channel can supply, and why it is capped there. */
    gradeCeiling: z.enum(['higher', 'middle', 'lower', 'none']),
    gradeNote: z.string().min(150),
    /**
     * Present only on a personal channel: WHO it answers for, why that makes it
     * answer so often, and what being that person exposes the house to.
     *
     * THIS USED TO BE CALLED `theClock` AND HELD A COUNTDOWN. The field named
     * the sister as a Core Formation cultivator with about fifty years left and
     * built the Pavilion's whole tension on her dying. The design owner has
     * retired that: the sister stands at ordinal 41, and the tension is not
     * that she runs out - *"at core formation someone is gonna come and grab
     * the 45 sword"*. Somebody at Core Formation holding the one channel in the
     * world whose stock RISES is a kidnapping that has not happened yet, and
     * the setting cannot support that, so the person a channel answers for
     * stands at the last realm. Even there she is weak RELATIVE TO WHAT SHE
     * GUARDS, which is a live problem somebody can act on rather than a
     * countdown that only elapses.
     *
     * Note what this is NOT. There are four channel holders in this file and she
     * is not a single point of failure for the world - only for the Pavilion,
     * whose distinction is a rising supply rather than a lone one.
     *
     * Renamed rather than repurposed, because a field called `theClock` holding
     * something that is not a clock is how the next reader gets it wrong.
     */
    thePersonItAnswersFor: z.object({
        who: z.string().min(60),
        why: z.string().min(150),
        note: z.string().min(200)
    }).nullable(),
    /** What having this explains about the institution. */
    whatItExplains: z.array(z.string().min(40)),
    note: z.string().min(120)
});
export type ImmortalChannel = z.infer<typeof ImmortalChannelSchema>;

export const IMMORTAL_CHANNELS: readonly ImmortalChannel[] = [
    {
        factionId: 'apex-deep-survey',
        kind: 'answering_channel',
        ancestor: {
            name: 'The First Surveyor, whose name the Survey records and does not use',
            whatTheyWere: 'The founder of the arterial survey, who crossed from a site the register locates and does not describe',
            crossedYearsAgo: 3_100
        },
        whatItReturns:
            'Objects. Consumables of a kind nobody below can make, arriving without announcement, entered on the standing stock register on the day they are found and never explained. The Survey has never received a message, an instruction or a word: it receives items, and it counts them.',
        cadence:
            'At intervals measured in ages, with no way to request more, no schedule, and no guarantee that the next one comes at all. The last arrival is a hundred and forty years old and the gap before it was longer.',
        gradeCeiling: 'higher',
        gradeNote:
            'An ancestor three thousand years across sends rarely and sends well. What arrives is graded across the range and includes the only higher-grade golden pill anybody in the world can point to, which is the whole of the Survey advantage: not volume, which it has never had, but the top of the range, which nobody else can reach at all.',
        thePersonItAnswersFor: null,
        usability:
            'Entirely usable, which is the point and also the problem. An object is a line item: it can be counted, minuted, stored, and released by quorum, and every instinct a bureaucracy has applies to it correctly. What cannot be done is reorder it, and that single fact is what turns careful administration into the arithmetic that no petitioner can move.',
        whatItExplains: [
            'why the Survey administers the world at all: it holds a resource nobody can duplicate, arriving on a schedule nobody else can access',
            'why the stock is counted to the unit and requires all four Surveyors to touch',
            'why a Requisition Against Standing Stock exists as a form, has been submitted eleven times, and has been granted once'
        ],
        note:
            'The honest reason the Survey is an apex is not conquest and not competence, though it has a great deal of the latter. It is that somebody above the Lid is still answering, and only one other body in the world can say the same.'
    },
    {
        factionId: 'apex-long-cut',
        kind: 'answering_channel',
        ancestor: {
            name: 'The First Course, named on the schedule and nowhere else',
            whatTheyWere: 'A carver who crossed from driven ground, which the Long Cut regards as the more difficult road and does not argue about with anybody',
            crossedYearsAgo: 2_600
        },
        whatItReturns:
            'Objects, exactly as with the Survey, and received the same way: found, receipted, entered on the schedule, and never discussed. The Long Cut has never had a word from the other side either, and has never expected one.',
        cadence:
            'Ages apart, unrequestable, and unguaranteed. The schedule carries the arrivals as dated entries with nothing in the reason column, which is the most the administration is willing to write down.',
        gradeCeiling: 'higher',
        gradeNote:
            'Two thousand six hundred years across, answering at intervals measured in ages, sending well when it sends. The Long Cut holds the only higher-grade talisman in existence and two middle pills against it, which is a thinner stock than the Pavilion by any count and a better one by the only measure that decides what can actually be done with it.',
        thePersonItAnswersFor: null,
        usability:
            'Fully usable and fully governed. The Long Cut owns every act it takes by name, so an object it cannot reorder is the hardest possible thing for it to spend: there is no vassal to attribute the decision to and no authority above it to authorise the loss. The result is a body that can act on anything except this.',
        whatItExplains: [
            'why a body administering five provinces on forty staff is nonetheless an apex',
            'why a schedule amendment against the standing entry has been submitted three times and answered by restating the entry',
            'why the Long Cut does not compare notes with the Deep Survey about any of it'
        ],
        note:
            'The two apexes hold the same category of asset from different ancestors, and neither institution knows whether the two are acquainted, hostile, or unaware of each other. Neither has ever asked the other. The House of the Narrow Hour would give a great deal for the answer and has no instrument that reaches it.'
    },
    {
        factionId: 'sect-hollow-court',
        kind: 'answering_channel',
        ancestor: {
            name: 'The one who went through first, whom the Court refers to only as that',
            whatTheyWere: 'A Seat, before there were four, who made the crossing from the north mountain and completed it',
            crossedYearsAgo: 4_400
        },
        whatItReturns:
            'Not objects. Accounts of the crossing itself, from somebody who made it: fragments about what the approach is like, what the seam does, what is required and in what order, and what happens to a person at the moment it resolves. It is the only thing the Court wants and the one thing that cannot be obtained below the Lid by any other means.',
        cadence:
            'At intervals measured in ages, arriving when it arrives, in response to nothing anybody can identify. Four beings have been working on this for a very long time and are still working, which is the most accurate available statement about how often it comes.',
        gradeCeiling: 'none',
        gradeNote:
            'Nothing material comes down this channel at all, at any grade. The Court receives accounts and no objects, which is why it is the only holder in this file with nothing on the standing stock of anybody and the only one that does not care.',
        thePersonItAnswersFor: null,
        usability:
            'Very little of it. Answers from the far side of a boundary that strips everything arrive incomplete, oddly weighted, and sometimes plainly wrong in ways nobody below can check - a step described in detail that nobody can locate, an ordering that contradicts the previous account, an emphasis on something no cultivator here can identify. The Court does not know whether the discrepancies are transmission, translation, or the thing itself being different for each person. That the four of them are still at it after four thousand years tells you exactly how good the information is.',
        whatItExplains: [
            'why all four are working continuously rather than waiting: they are being told things, badly, rarely, and by somebody who made it',
            'why they hold the richest vein in the world and draw nothing from it - they do not need it for what they are doing',
            'why the bar is a Void Refinement floor and evidence of a plausible crossing, since anybody who cannot attempt one has nothing to contribute and nothing to gain',
            'why presence at the Court is measured in decades of absence, and why a cultivator admitted there stops participating in everything else the world does',
            'and, with the protector arrangement, why they are a collaboration rather than four recluses - see HOLLOW_COURT_COLLABORATION'
        ],
        note:
            'The Deep Survey and the Long Cut get objects; the Court gets accounts of the crossing. Neither apex can ask for what the Court has and the Court has never offered - not out of secrecy, but because it has not occurred to any of them that anybody else would find it useful. They are not withholding. They are simply not thinking about anyone else at all.'
    },
    {
        factionId: 'sect-azure-cloud-pavilion',
        kind: 'personal_channel',
        ancestor: {
            name: 'Ru Anjing, Third Master of the Pavilion',
            whatTheyWere: 'The last confirmed crossing in the world, who spent eleven years divesting into the sect before she made it',
            crossedYearsAgo: 380
        },
        whatItReturns:
            'Objects, constantly by the standards of anybody else: golden pills and talismans arriving every nine to fourteen years, sometimes twice in a decade, always without ceremony and always in the same condition. The Pavilion has received more from above in the last century than the two administering bodies of the world have received between them in a thousand years.',
        cadence:
            'Every nine to fourteen years, which is not a cadence anybody else in this file would recognise as one. The apexes measure their arrivals in ages. The Pavilion has had four in living memory and expects the next one.',
        usability:
            'Completely usable and immediately so, and this is where the Pavilion position inverts. It has more of these objects than any institution in the world, they are all at the bottom of the range, and it therefore holds a great deal of something that will carry a cultivator into Core Formation and nothing that will carry one past Void Refinement. It is rich in quantity and poor in quality, exactly opposite to the apexes, and neither side would trade.',
        gradeCeiling: 'lower',
        gradeNote:
            'All of it lower, without exception, and the reason is not stinginess: she is three hundred and eighty years across, which is nothing. A fresh immortal has neither the standing to ask for better nor the power to send it, and she sends anyway - as much as she can, as often as she can manage it, at the only grade available to her. Everybody senior at the Pavilion understands this and nobody has ever described it as a limitation of hers.',
        thePersonItAnswersFor: {
            who: 'Ru Anwei, her sister, Pavilion Master of Azure Cloud, standing at the first rung of the last realm and not moving from it.',
            why: 'The channel is a person. It answers this often because there is somebody specific down here that Ru Anjing has a reason to answer for, and everybody at the Pavilion knows exactly whose channel it is - the objects arrive, and within the month Ru Anwei is asked politely about her health by people who have no other reason to ask. Ru Anxi, a younger relative the Pavilion also raised, is asked the same questions by people who have got the wrong one.',
            note: 'What that exposes is not a countdown. It is a position. The only holding in the world that goes UP rather than down runs on an income arriving because of one named living person, and the whole of the flow is attached to her rather than to the mountain, the seat or the sect - so anybody who wants the income does not have to take the Pavilion, they have to reach her. She is at the last realm and that is not nothing; it is also not the same order of thing as what she is standing in front of, and everybody senior on both sides of every border has done that arithmetic and said nothing. What happens to the flow if somebody ever moves on her is the single largest open question about the Pavilion, it is discussed by nobody, and it is not resolved here.'
        },
        whatItExplains: [
            'why the Pavilion can give a pill away at all, and why it now gives them away more freely than any institution in history',
            'why its stock has been revised upward four times in a century while every other register in the world only goes down',
            'why the Pavilion holds nothing that would help anybody at the top of the ladder, and does not seem to mind',
            'why the two apexes find its position alarming without being able to say it is better than theirs'
        ],
        note:
            'The difference the apexes understand and almost nobody else does. Azure Cloud has an income, from a person, at the bottom of the range. The Deep Survey and the Long Cut have a relationship with something ancient that answers rarely and sends the top of the range. Neither is straightforwardly better and the four cannot be put in a single order, which is why every attempt to rank them produces an argument.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHY AN IMMORTAL WOULD EVER DO ANYTHING
// The question is not why they do not intervene. It is why on earth they
// would, and for almost all of them the answer is that they would not, and
// arriving at it takes no deliberation at all.
// ─────────────────────────────────────────────────────────────────────────

export const IMMORTAL_MOTIVE = {
    theirOwnPriorities:
        'An immortal is cultivating immortal qi on a ladder above this one, and that is what they are doing with their existence. Descending costs them personally, risks them personally, and gains them nothing personally. Every hour spent reaching down is an hour not spent climbing, measured against a road they are still on.',
    theLateAgeIsWorthless:
        'And this is the part that closes it: there is nothing here they want. A depleted world is not merely dangerous to them, it is worthless - no resource worth the trip, no opportunity, nothing to cultivate that they did not exhaust before they left. So every reason to descend is sentimental, obligatory or spiteful. None of them is self-interested, which is exactly why they are so rare.',
    descendingIsRisky:
        'Not merely expensive. It is exposure: forcing an opening inward, paid out of cultivation condensed over ages, for ten to fifteen breaths, and the ones who get it wrong do not come back at all. An immortal who dies down here dies for somebody else\'s benefit having gained nothing, and that risk is priced against a ladder where the same effort spent upward is spent on themselves.',
    descendantsAreStrangers:
        'An ancestor who ascended four thousand years ago has no relationship with anybody alive. The sect that reveres them is an institution they walked out of, run by people born thousands of years after they were last here. Reverence flows one way and always has, and no amount of ceremony converts it into an obligation.',
    tiesAreTheMechanism:
        'So the entire mechanism is ties, and they have to be specific and personal rather than institutional. Four things actually move one: somebody they knew and still love; an oath they personally swore; something they built themselves and still care about; and a grudge, which is a tie like any other and motivates a descent every bit as well as affection does.',
    sendingVersusComing:
        'Which produces the baseline behaviour of every apex ancestor. Sending is cheap - a medicine dispatched costs them nothing they will miss and carries no risk at all. Coming down is the expensive, dangerous thing. So they send occasionally, appear almost never, and answer an offering once a millennium with a few words.',
    whatTheOfferingActuallyIs:
        'Not a great honour a sect has earned. The cheapest possible acknowledgement, costing the giver nothing whatsoever, and the sects have built entire ceremonies around it because it is all they were ever going to get. A body that spends its principal for a decade to receive two words is not being rewarded; it is being answered at the minimum rate.',
    // THE SUPERLATIVE CAME OFF, AND THE MEASUREMENT IS WHY.
    //
    // This field used to end by calling the Azure Cloud Pavilion the strongest
    // institution in the world. The catalog does not support it. By declared
    // `powerOrdinal` the Hollow Court stands at 44 and Azure Cloud at 41, with
    // the Severed at 38 and three courts at 36 to 37 - so it is ONE OF the
    // strongest, with three houses inside four rungs of it and a body above it
    // that is not the same kind of body at all. The Court takes no beginners:
    // its floor is Void Refinement and evidence of a plausible crossing, so it
    // admits the nearly-arrived, and ranking a house that raises nobody against
    // houses that raise everybody is what makes that comparison feel wrong.
    //
    // Note what that does NOT settle, because the temptation is to over-read
    // it. Admissions explain the Court's VOLUME. They do not establish that the
    // Court contributes nothing to the crossings it counts, and nothing in the
    // world could: the counterfactual - that same cultivator without the Court -
    // is not observable by anybody. The causal claim is unproven and so is the
    // null one, the province credits them, and that credit is not obviously
    // wrong. Leave it a live dispute. Never build a statistic that subtracts a
    // selection effect: count who was admitted and who crossed, and stop, or
    // the engine is asserting a counterfactual it cannot see.
    //
    // What replaces it is smaller, truer and specific: the Pavilion is the one
    // holder of the four whose stock GOES UP. `immortal-items.ts` says the four
    // cannot be put in a single order at all and that this is the point, and a
    // superlative fights that.
    theExceptionAndWhy:
        'Ru Anjing is the rule producing an exception rather than a fact about one woman. She has a living sister - a real relationship with a real person who is alive right now - and that is the only category of thing that reliably outweighs the sum above. Everything downstream follows from it: she answers every nine to fourteen years instead of once an age, she sends as much as she can manage at the only grade she can reach, and the Azure Cloud Pavilion is the one holder in the world whose stock rises - because of sisterly love rather than because of anything the sect did.',
    readTheApexesThisWay: [
        'Deep Survey: three ancestors, all of them nineteen centuries or more gone, all of them institutional rather than personal. Rare answers and good grade is exactly what the rule predicts for ties that have decayed to nothing but provenance.',
        'Long Cut: two ancestors, same shape, same answer rate. Fewer ties, same decay, and an administration that has never expected more.',
        'Hollow Court: six, and what comes back is accounts of the crossing rather than objects - because the tie there is professional interest rather than affection. They are being answered by people who find the question interesting, which is a weaker tie than love and a stronger one than reverence.',
        'Azure Cloud: one ancestor, three hundred and eighty years, and a living sister. The highest answer rate in the world, the lowest grade in the world, and both are the same fact.'
    ]
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE ARCHIVE IS THE CLAIM
// A sect that has lost its ancestor's name has severed the only thing that
// would ever have made them answer.
//
// `theCounterExample` below is the Hollow Court, and it is the design record
// for why the Court's records matter. Somebody looking for exactly this
// searched `docs/` for it, found nothing, invented an answer and relayed it to
// another agent before it was retracted. The doc half is
// `docs/world/climbing/past-the-ceiling.md`, "The Hollow Court is the exception to all
// of it"; the roster half is `hollow-court-roster.ts`. Change one, read the
// others. Indexed in `docs/world/INDEX.md`.
// ─────────────────────────────────────────────────────────────────────────

export const ARCHIVE_AS_CLAIM = {
    thePrinciple:
        'The mechanism is personal ties, so a sect\'s archive is not sentimental: it is the sect\'s entire claim on an immortal. Lose the name and you have not lost a document, you have cut the tie - and you can do it quietly, over centuries of perfectly diligent ceremony, without anybody noticing.',
    bothDirections: {
        downward:
            'The sect makes an offering to a name that may be wrong, and would not recognise an answer if one arrived under a different name.',
        upward:
            'And the half nobody in the world has thought about: an immortal answers because somebody down here is specifically theirs. A body that cannot name them is addressing a stranger, and a stranger is under no obligation to it. They are not being ignored out of indifference. They have severed the thing that would have made the answer happen.'
    },
    cases: [
        {
            case: 'record intact and legible',
            example: 'sect-azure-cloud-pavilion',
            note: 'Three hundred and eighty years old, in a hand everybody can still read, naming a woman whose sister is alive. Rare, and it is the reason the answers keep coming.'
        },
        {
            case: 'holds the record and cannot read it',
            example: 'sect-nine-peaks-ascetic-order',
            note: 'The best case in the catalog and it is already implied by the transmission work in `history.ts`: the Standing hand\'s numerals are read completely and its prose is not read at all. So the Order can state the exact weight and count of every offering ever made and cannot read the name at the top of the page. Somebody has been reading that document aloud for eight hundred years as a list of quantities.'
        },
        {
            case: 'wrong name, honestly held',
            example: 'sect-clear-river-alliance',
            note: 'A name written down later because the ceremony needed one, held in complete good faith, with nothing anywhere to contradict it. The Alliance is not lying and has no way to find out.'
        },
        {
            case: 'two sects claiming the same ancestor',
            example: 'sect-thousand-treasure-pavilion',
            note: 'At most one correctly, neither able to settle it, and the Ninefold Ledger will certify neither because certification requires a record and both records are assertions. The Pavilion is the loud claimant; the quiet one has never been named here on purpose.'
        },
        {
            case: 'does not know it has one',
            example: 'sect-hollow-bell-wanderers',
            note: 'Never made an offering, therefore never been answered, therefore concludes it has no ancestor. Correct behaviour, wrong conclusion, and the loss is completely invisible to them.'
        },
        {
            case: 'ancestor died, offerings continued',
            example: 'sect-sweptground-temple',
            note: 'Nobody can tell the difference between an ancestor who is dead and one who simply has better things to do, which is the point. The Temple recorded its silence honestly and drew no conclusion from it, which is the most anybody can do.'
        }
    ],
    theCounterExample:
        'The Hollow Court is the counter-example and should read as one. Their records are good, and that is not incidental to their strength - it is their strength. Six ancestors who can still be named and addressed correctly is the whole reason their depletion is medium rather than terminal at four thousand four hundred years. Every other institution\'s decline includes a component of simple forgetting, and theirs does not.',
    howToUseIt:
        'Where a sect\'s answer rate is unexplained, this is now the available explanation, and it is usually the correct one. An institution does not lose a channel in a dramatic event. It loses a page.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// MORE MEDICINE THAN CULTIVATORS
// What an institution does when the stock outruns the people, and who has
// worked out that it is happening.
// ─────────────────────────────────────────────────────────────────────────

export const PAVILION_SURPLUS = {
    theTension:
        'The Azure Cloud Pavilion holds nine of these objects - seven Unearned Steps and two Second Dealings, all lower grade - and can barely use any of them. A lower Step is not a small thing: it carries somebody from Nascent Soul Perfection across into Deity Transformation, which is a regional power made in an afternoon. It is also useless to anybody not standing at that boundary, and the Pavilion produces reliably at Core Formation with six people at that height and about ninety disciples below it. The stock is enormous, the stock is rising, and the sect has almost nobody it fits. The bottleneck is people rather than medicine, which is the same sentence as everything else about this institution.',
    whatItDoes: [
        'Gives them away, at a rate no institution in history has matched, because the instructions permit it and the arithmetic no longer punishes it - four grants in the last century against one in the two centuries before.',
        'Places them outward: with allied sects, with guest elders, and twice with cultivators who hold no affiliation at all, which is the closest thing the world has seen to an institution exporting advancement.',
        'Buys loyalty in medicine rather than in stones, which is a currency the Stonewright Consortium cannot price and does not like.',
        'Argues with itself. The refusal doctrine was written when a grant was a wound, and it is now being applied to an income by people who know it and have not revised it.'
    ],
    theQuietProblem:
        'Every object placed outside creates somebody who owes the Pavilion a realm, and the Pavilion has never decided what it wants that to be. It is not building a faction, it is not charging, and it has not asked for anything back - so it is accumulating obligations at a rate its own Sword Elders describe as untidy and nobody has proposed a use for.',
    whoHasNoticed: [
        'The Stonewright Consortium, whose Kettle and Low Fall houses see the second-order flow - stones not spent on medicine that should have been bought - and cannot account for it.',
        'The Ninefold Ledger, because unexplained advancements cluster around Pavilion allies and each one opens a lineage audit that finds nothing wrong and no explanation.',
        'The Thousand Treasure Pavilion, which has noticed the opposite of a thing: not one of these has ever come to auction from a sect that plainly has more than it needs.',
        'The Deep Survey, which holds three objects, keeps a register on the subject, and has no explanation whatever for how a single sect in a single province has nine.'
    ],
    whatNobodyHasWorkedOut:
        'That the flow has a name and an address, and that the name is in the Pavilion.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// LINEAGE STANDING
// Two axes, not one, and they interact.
//
//   count      how many immortals a house has sent up across its history.
//              This drives RESILIENCE: more channels means more chances that
//              any of them is still answering, and no single silence is fatal.
//
//   depletion  how worn the connection and its yield are NOW: how long since
//              anything came down, how much of what did is spent, how thin the
//              answers have become.
//
// The world counts the first axis and treats it as the prestige, using the
// tiers in `docs/world/climbing/immortals.md`: one immortal is a supreme lineage, two
// extraordinary, three legendary, four or more in succession very nearly
// mythical. That reckoning is public and undisputed. The second axis is not
// public at all, and it is the one that decides how an institution behaves.
//
// And there are two more that cut across both: VOLUME, how much is actually
// held, and GRADE CEILING, the best of it that can be reached for. Those two
// point in opposite directions for the Pavilion and for the apexes, which is
// why THE FOUR CANNOT BE PUT IN A SINGLE ORDER. Sorting by remaining channel
// is still the right question to ask about resilience; it is not a ranking,
// and `byVolume` and `byGradeCeiling` will disagree with it and with each
// other. Any tool that renders one of these as a league table is wrong.
// ─────────────────────────────────────────────────────────────────────────

export const LineageTierSchema = z.enum([
    'supreme',            // 1
    'extraordinary',      // 2
    'legendary',          // 3
    'very_nearly_mythical' // 4+
]);
export type LineageTier = z.infer<typeof LineageTierSchema>;

export const DepletionSchema = z.enum(['light', 'medium', 'heavy', 'ended']);
export type Depletion = z.infer<typeof DepletionSchema>;

export const LineageStandingSchema = z.object({
    factionId: z.string(),
    /** Immortals produced across the whole history of the house. */
    count: z.number().int().min(1),
    /** The public reckoning, by the world's own table. */
    tier: LineageTierSchema,
    mostRecentCrossingYearsAgo: z.number().int().min(1),
    /**
     * Who made the most recent one, where the house still has the name.
     *
     * Only the latest is named, deliberately. A house that produced six across
     * four thousand years does not remember six people - it remembers the last
     * one and a number, and the older names have gone the way names go.
     *
     * They are not founders. A crossing is somebody the house produced, which
     * is a different thing from whoever built it; most houses here have both,
     * and the two are rarely the same person.
     */
    mostRecentCrossingName: z.string().nullable(),
    /** One line on who they were before they crossed. */
    mostRecentCrossingNote: z.string().min(60).nullable(),
    /**
     * Every crossing this house has ever had, one entry each, oldest first.
     *
     * `count` is a number and a number is not a roster. That distinction has
     * already cost this catalog once: the Hollow Court's six were carried as a
     * count plus a line reading "five more in succession", and everything
     * downstream reported three of its people as names that had gone. They had
     * not gone; nobody had written them down.
     *
     * So the roll sits beside the count and a test asserts they agree. Nobody at
     * this rung is a remainder. A house may withhold a NAME - several do, and
     * that is a fact about the house rather than a gap - but it may not withhold
     * that somebody existed, and every entry here carries a title even where the
     * name is refused.
     */
    roll: z.array(z.object({
        /**
         * A title always. A name only where the house uses one.
         *
         * The floor is deliberately low: 'Yin Que' is seven characters and is
         * a whole person. What this field must not hold is a count.
         */
        title: z.string().min(3),
        yearsAgo: z.number().int().min(0),
        /** What they were before, in the house's own terms. */
        was: z.string().min(20),
        /** Null where nobody below the Lid knows. */
        afterCrossing: z.enum(['still_above', 'died_above']).nullable()
    })).min(1),
    depletion: DepletionSchema,
    /** Total objects held, across both medicines. Volume, not quality. */
    volume: z.number().int().min(0),
    /** The best grade the house can reach for. Quality, not volume. */
    gradeCeiling: z.enum(['higher', 'middle', 'lower', 'none']),
    /** Which way the stock is moving. Only one of them is going up. */
    trend: z.enum(['rising', 'flat', 'falling']),
    /** What depletion actually looks like here, in specifics. */
    whatDepletionLooksLike: z.string().min(150),
    /** What the count buys: how many silences the house can survive. */
    resilience: z.string().min(120),
    /** How the two axes together produce the behaviour anybody can observe. */
    behaviour: z.string().min(150)
});
export type LineageStanding = z.infer<typeof LineageStandingSchema>;

export const LINEAGE_STANDINGS: readonly LineageStanding[] = [
    {
        factionId: 'sect-hollow-court',
        count: 6,
        tier: 'very_nearly_mythical',
        mostRecentCrossingYearsAgo: 600,
        mostRecentCrossingName: 'Yin Que',
        mostRecentCrossingNote:
            'Took Second Seat at four hundred and eleven, held it for ninety years, and crossed from the east mountain without telling the other three she was going. The Court has never said whether that was discourtesy or consideration.',
        roll: [
            { title: 'The one who went through first, whom the Court refers to only as that', yearsAgo: 4_400, was: 'the first of them to reach the last rung, in a house that did not yet know what it was for', afterCrossing: 'still_above' },
            { title: 'The Second Seat who went from the north mountain', yearsAgo: 3_600, was: 'Second Seat, with the first standing protector the Court ever posted', afterCrossing: 'still_above' },
            { title: 'The First Seat who held the vein six hundred years and then went from it', yearsAgo: 2_900, was: 'First Seat, and the longest holder of that chair in the Court\'s record', afterCrossing: 'still_above' },
            // She is filed as the Third Seat because that is the chair she held
            // longest and the one the Court still calls her by. It is not the
            // chair she went from. SEAT_ORDER ranks by ordinal descending, so
            // every crossing above her moved her up a place - and she stood
            // protector at four of them. By the time it was her turn there was
            // nobody left in front of her, which is the whole shape of her life:
            // she reached First Seat by outlasting the reason the chair mattered.
            { title: 'The Third Seat who stood protector at four crossings and was First by her own', yearsAgo: 2_100, was: 'Third Seat for most of it and First Seat by the end, having watched four others go up from in front of her', afterCrossing: 'still_above' },
            { title: 'The Fourth Seat who waited two hundred years for three protectors to be free at once', yearsAgo: 1_300, was: 'Fourth Seat, ready long before the Court could spare the people to stand for her', afterCrossing: 'died_above' },
            { title: 'Yin Que', yearsAgo: 600, was: 'Second Seat at four hundred and eleven, and holder of it for ninety years', afterCrossing: 'still_above' }
        ],
        depletion: 'medium',
        volume: 0,
        gradeCeiling: 'none',
        trend: 'flat',
        whatDepletionLooksLike:
            'Longer gaps than the records from two thousand years ago describe, and accounts that arrive thinner than the older ones held in the same hall - more fragmentary, more oddly weighted, and harder to reconcile with what came before. Nothing has gone quiet. It has simply become a slower and less generous correspondence than four beings working continuously would like.',
        resilience:
            'Six channels, of which nobody knows how many are still live, and that uncertainty is survivable precisely because there are six. No single silence would end the Court, which is not true of any other holder in the world.',
        behaviour:
            'Medium depletion at four thousand four hundred years is the anomaly, and the explanation is admissions. A Void Refinement floor plus evidence of a plausible crossing means the Court disproportionately admits people who then cross, so it is functionally the one institution in the world that converts admissions into ancestors. Age would have drained anybody else by now; volume has kept it mid-scale, and it is the top tier by the world\'s own reckoning - the single objective claim about the Court that nobody disputes.'
    },
    {
        factionId: 'apex-deep-survey',
        count: 3,
        tier: 'legendary',
        mostRecentCrossingYearsAgo: 1_900,
        mostRecentCrossingName: 'Qiao Yan',
        mostRecentCrossingNote:
            'A field surveyor for two centuries before anybody suggested she was anything else, and the Survey still files her under the district she worked rather than under the crossing. The Lamp is older than her and came from somebody else.',
        roll: [
            { title: 'The First Surveyor, whose name the Survey records and does not use', yearsAgo: 3_100, was: 'the founder of the arterial survey, who crossed from a site the register locates and does not describe', afterCrossing: 'still_above' },
            // The middle crossing, and the reason the Survey files people by
            // district rather than by anything else. He is a line in a ledger
            // that was never closed, which is the most Deep Survey thing about
            // him and the whole of what is known.
            { title: 'The surveyor of the fourth branch, entered under the district and never under his own name', yearsAgo: 2_400, was: 'a working surveyor on the fourth arterial branch, who filed for seven hundred years and stopped mid-return', afterCrossing: 'still_above' },
            { title: 'Qiao Yan', yearsAgo: 1_900, was: 'a field surveyor for two centuries before anybody suggested she was anything else', afterCrossing: 'still_above' }
        ],
        depletion: 'heavy',
        volume: 4,
        gradeCeiling: 'higher',
        trend: 'falling',
        whatDepletionLooksLike:
            'Intervals that have roughly doubled across the last thousand years, the most recent arrival a hundred and forty years ago against a previous gap that was longer still, and a standing stock counted down to three objects total. Two of the three channels have produced nothing in over a thousand years and the Survey does not know whether they are quiet or finished, because there is no instrument that would tell it.',
        resilience:
            'Three channels is real insurance and the Survey knows it, which is why it has never treated any single silence as decisive. It also knows that two of the three may already be over, which converts the insurance into a question nobody can answer.',
        behaviour:
            'Several ancestors and heavy depletion produces rationing from fear of running out. The Survey counts to the unit, minutes every movement, requires all four Surveyors, and has granted one requisition in eleven - not because the stock is precious in the abstract, but because it has watched the interval lengthen twice within its own records and has drawn the obvious conclusion in writing.'
    },
    {
        factionId: 'apex-long-cut',
        count: 2,
        tier: 'extraordinary',
        mostRecentCrossingYearsAgo: 2_600,
        mostRecentCrossingName: 'Bai Zhuo',
        mostRecentCrossingNote:
            'Cut his own road, in the Marches, on driven ground, with no patron and a posted staff that did not notice until it was over. The Nail was already there and had been for a long time.',
        roll: [
            // Both at twenty-six hundred years, which the Court's own schedule
            // records without comment and which nobody outside has ever been
            // able to get an explanation of. Two people went up in the same
            // year, on the same ground, and only one of them is named.
            { title: 'The First Course, named on the schedule and nowhere else', yearsAgo: 2_600, was: 'whoever drove the Nail through from the other side, which the Long Cut states and does not elaborate', afterCrossing: 'still_above' },
            { title: 'Bai Zhuo', yearsAgo: 2_600, was: 'a cutter with no patron and a posted staff that did not notice until it was over', afterCrossing: 'still_above' }
        ],
        depletion: 'light',
        volume: 4,
        gradeCeiling: 'higher',
        trend: 'flat',
        whatDepletionLooksLike:
            'Very little. The intervals are enormous and always were, the arrivals are dated on the schedule with nothing in the reason column, and almost nothing has ever been spent - two objects held against two ancestors, with three refused amendments in three hundred years and no grant on record at all. What looks like severity from outside is a stock that has barely been touched.',
        resilience:
            'Two channels, which is thin insurance, and the Long Cut has never needed to find out: neither has gone silent within its records, and the administration does not plan around the possibility because it has no procedure that would.',
        behaviour:
            'Two ancestors and light depletion produces rationing from not needing much, which reads identically to fear from outside and is a different thing. The Long Cut refuses because the schedule provides no occasion, not because it is frightened of the count - it administers driven ground on a horizon of centuries and has never encountered a case its instrument could read.'
    },
    {
        factionId: 'sect-azure-cloud-pavilion',
        count: 1,
        tier: 'supreme',
        mostRecentCrossingYearsAgo: 380,
        mostRecentCrossingName: 'Ru Anjing',
        mostRecentCrossingNote:
            'Third Master of the Pavilion, and the only crossing this house has ever produced. She is named in the sect ancestry too, which is where the detail lives.',
        roll: [
            { title: 'Ru Anjing, Third Master of the Pavilion', yearsAgo: 380, was: 'Third Master, and the last confirmed crossing anybody in either province can date', afterCrossing: 'still_above' }
        ],
        depletion: 'light',
        volume: 9,
        gradeCeiling: 'lower',
        trend: 'rising',
        whatDepletionLooksLike:
            'Nothing that anybody else in this file would recognise as depletion. One ancestor, one crossing, and a channel that answers every nine to fourteen years - so the stock has been revised upward four times in a century while every other register in the world only goes down. What it does look like is a ceiling: everything that arrives is lower grade, has always been lower grade, and will be for as long as the sender is only three hundred and eighty years across.',
        resilience:
            'Enormous in the short term and entirely contingent. A single channel with a person at the end of it produces more objects than three ancient ones combined, and stops completely when that person dies. The Pavilion has the deepest stock in the world and the shortest guarantee on it, and both halves of that are true at once.',
        behaviour:
            'One ancestor, light depletion and a rising stock produces the opposite of rationing: the Pavilion gives pills away more freely than any institution in history, because they are income rather than principal. That is also why its refusal doctrine is under strain, why eleven disciples petitioned inside a year of the last grant, and why the Master who authorises one is now named in a book that reads less like a confession every decade.'
    }
];

const STANDING_BY_FACTION: ReadonlyMap<string, LineageStanding> =
    new Map(LINEAGE_STANDINGS.map(l => [l.factionId, l]));

export function getLineageStanding(factionId: string): LineageStanding | undefined {
    return STANDING_BY_FACTION.get(factionId);
}

/** The public reckoning for a count, by the world's own table. */
export function lineageTierFor(count: number): LineageTier {
    if (count >= 4) return 'very_nearly_mythical';
    if (count === 3) return 'legendary';
    if (count === 2) return 'extraordinary';
    return 'supreme';
}

/** Deepest stock first. Disagrees with every other ordering here. */
export function byVolume(): LineageStanding[] {
    return [...LINEAGE_STANDINGS].sort((a, b) => b.volume - a.volume);
}

/** Best reachable grade first, which is the apex advantage and nothing else. */
export function byGradeCeiling(): LineageStanding[] {
    const rank: Record<LineageStanding['gradeCeiling'], number> =
        { higher: 0, middle: 1, lower: 2, none: 3 };
    return [...LINEAGE_STANDINGS].sort((a, b) =>
        rank[a.gradeCeiling] - rank[b.gradeCeiling] || b.volume - a.volume);
}

/**
 * The four orderings, side by side, so a caller can see that they disagree
 * rather than picking one and calling it the ranking.
 */
export function standingsAreNotATotalOrder(): {
    byChannel: string[];
    byVolume: string[];
    byGrade: string[];
    note: string;
} {
    return {
        byChannel: byRemainingChannel().map(l => l.factionId),
        byVolume: byVolume().map(l => l.factionId),
        byGrade: byGradeCeiling().map(l => l.factionId),
        note: 'Three questions, three different answers, and no way to combine them. The Pavilion is first on volume, last on grade and near the top on channel; the Long Cut is first on grade and thin on volume; the Court holds no objects at all and is the top of the public tier table. Anybody who produces a single ranking has chosen an axis and not said so.'
    };
}

/**
 * Houses ordered by how much of their lineage is still working, which is not
 * the order the world ranks them in and is the order that decides behaviour.
 */
export function byRemainingChannel(): LineageStanding[] {
    const weight: Record<Depletion, number> = { light: 0, medium: 1, heavy: 2, ended: 3 };
    return [...LINEAGE_STANDINGS].sort((a, b) =>
        weight[a.depletion] - weight[b.depletion] || b.count - a.count);
}

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const CHANNEL_BY_FACTION: ReadonlyMap<string, ImmortalChannel> =
    new Map(IMMORTAL_CHANNELS.map(c => [c.factionId, c]));

export function getChannel(factionId: string): ImmortalChannel | undefined {
    return CHANNEL_BY_FACTION.get(factionId);
}

/** Institutions with somebody above the Lid still answering. */
export function answeringChannels(): ImmortalChannel[] {
    return IMMORTAL_CHANNELS.filter(c => c.kind === 'answering_channel');
}

/** True where the faction holds a relationship rather than a hoard. */
export function hasAnsweringChannel(factionId: string): boolean {
    return CHANNEL_BY_FACTION.get(factionId)?.kind === 'answering_channel';
}

// ─────────────────────────────────────────────────────────────────────────
// THE ANCESTOR WHO MIGHT ANSWER
// The largest deterrent in the setting, and it is not a weapon, an ancestor
// or a count. It is a question nobody can answer and everybody has an opinion
// about, which turns out to be worth more than an answer would be.
//
// This is a rule about anybody who crossed and stayed attentive - it applies
// wherever `claimsLivingAncestor` and `claimIsTrue` are both set, and the
// Azure Cloud Pavilion is the clearest instance rather than the subject.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a true living ascended ancestor is worth to the house that has one.
 *
 * Not a power level. A house with somebody genuinely above the Lid who has not
 * stopped paying attention holds a deterrent that no assembly answers and no
 * object counters, and that nobody can price - including the house itself.
 *
 * WHAT IS MEASURED, AND WHAT IT TOOK TO MEASURE IT
 * An earlier draft quoted figures that came from a broken harness, and the
 * correction is worth keeping because of what it turned up. The resolver would
 * not settle one person against a mobilised house at all: it returned a
 * stalemate in every seed, with her standing near full and most of them dead at
 * her feet, because a striker could only ever remove one body a round. That was
 * not a fact about her. It was a missing mechanic - nothing in the engine could
 * hit more than one person at a time, which is a poor model of this world at
 * every rung and an absurd one at the top.
 *
 * With area attacks in, the case resolves, and these are the numbers: somebody
 * at the last rung carrying an art that lands on more than one person takes any
 * mobilised apex in the region a hundred times in a hundred, in about two
 * rounds. Carrying a single-target art she takes none of them, which is the
 * more interesting half - what makes her unanswerable is not the rung on its
 * own, it is the rung and an art wide enough to use it.
 *
 * The gradient one rung down says it more sharply still, and the reason is not
 * the crowd. Lu Sheng stands at forty-five and holds no immortal object at all,
 * having stopped being close to the Hollow Court a long time ago, so his arts
 * are the whole of his inventory. With a wide one he takes the Deep Survey
 * every time, the Azure Cloud Pavilion seven times in eight, and the Long Cut
 * four times in five.
 *
 * Read that ordering against what each house is carrying rather than who it is:
 *
 *   the Deep Survey    head 43, the Datum Lamp rated 43   - he takes it always
 *   the Azure Cloud    head 41, the Standing Edge at 45   - seven times in eight
 *   the Long Cut       head 42, the Ninth Nail at 45      - four times in five
 *
 * It tracks the OBJECT and not the head. The Deep Survey has the highest rung
 * in the region and the weakest thing in its hands, and it is the one that
 * never holds. The Long Cut has a lesser head and a forty-five, and it is the
 * only house in the world that has ever been measured stopping somebody above
 * the Lid - one time in five, by withdrawal rather than by killing him, because
 * he is never killed in any of it.
 *
 * AND THE PROVINCE STANDING BEHIND THEM IS NOT PART OF THE FIGHT
 * This is the part worth being exact about. Mean damage dealt to him, by source,
 * over two hundred seeds: the apex head, and nothing else. Not "less". Zero.
 * The Deep Survey's sealed ancestor at forty-four - the best weapon any house in
 * the region owns, spent once, ever - lands nothing at all. The courts land
 * nothing, the clients land nothing, and removing six high-ordinal bodies from a
 * side including that forty-four moves the result by about two points.
 *
 * So a mobilised apex against somebody above the Lid is not a battle that is
 * lost. It is a duel with a crowd standing around it. The province is not
 * outweighed; it is irrelevant, and the only question in the room is what the
 * one person at the front is holding.
 */
export const THE_ANCESTOR_WHO_MIGHT_ANSWER = {
    theThingNobodyWantsToTest:
        'Kill somebody who is being watched from the other side of the Lid and you have made an enemy nothing in this world answers. No object below the Lid counters one, no seal holds one, and no amount of practice closes the rung - measured, the best art in the world at full mastery buys a mortal nothing at all across that boundary. And a province is not an answer either: an apex mobilised, courts and clients and every seal broken, is taken by one person in about two rounds. The fifteen breaths are not a limit on what she can do. They are a limit on how long she stays. It is the only threat in the setting with no ceiling on it, and a house that has one does not have to say so more than once.',
    andItLastsFifteenBreaths:
        'And it is over almost before it starts, which is the part that makes the whole arrangement stable rather than absurd. Nothing above the Lid can remain below it: come down and tribulation lightning takes you back up in ten to fifteen breaths, and it takes what you are carrying with it, so a True Immortal arrives with an object of their own rung and both of them are already leaving. See `BREATHS_IN_THE_LOWER_REALM`. That is enough to end a faction and nowhere near enough to take one. Nobody above the Lid can occupy anything, install anybody, hold ground or govern for an afternoon down here - which is why the strongest force in the setting has never once been used to rule and why the people below it are afraid of exactly one thing rather than of everything.',
    soItIsAnANSWERAndNotAConquest:
        'Which changes what the threat is for. It cannot be turned into an empire, a protectorate or a standing arrangement, and no house can rent it. It can be provoked, once, by doing something specific to somebody specific, and the fifteen breaths that follow are aimed at whoever did it. That is the whole instrument: not a power anybody holds, but a consequence anybody can trigger and nobody can direct.',
    andItIsNeverACERTAINTY:
        'And it is never a certainty, which the setting must not round off. Nobody below the Lid knows what somebody above it will do. The record is clear that most who cross do not look back - they go exploring and they perish out there - and the ones who stay attentive to one province are the exception. Whether any given ascended ancestor would answer for their house is exactly as unknowable as whether a sealed ancestor would wake for the right reason: a question about a person, put by people who cannot reach them.',
    butPeopleHaveADecentIdea:
        'What everybody does have is a decent idea, and a decent idea is enough. What somebody spent their last decades on is a matter of record - what they divested, to whom, in what order, and what they arranged for afterwards - and any Surveyor in the region can read the same file and reach the same estimate. Nobody publishes a figure, because publishing one would mean somebody could argue with it. The estimate does the work precisely by staying an estimate.',
    whichIsWhyTheCLAIMBeingTrueMatters:
        'Half the houses in the world claim a living ascended ancestor and most of those claims are ornamental - a name on a tablet, an offering channel nobody has seen answered, a lineage that would like to be older than it is. `claimsLivingAncestor` and `claimIsTrue` are separate fields for exactly this reason, and `auditAncestralClaim` exists so the difference can be established rather than asserted. What a true claim buys is not force. It is that when it is weighed against everybody else\'s, it is the one nobody discounts.',
    andItIsTheSameShapeAsASEAL:
        'Which makes it the same instrument as a sealed ancestor, one tier up and with the uncertainty inverted. A seal is a weapon whose existence is uncertain and whose loyalty is known; this is a weapon whose existence is known and whose willingness is not. Both deter, neither can be verified without spending it, and a house that had to find out would learn the answer at the same moment as everybody else.',
    theClearestInstance:
        'The Azure Cloud Pavilion, which is why it is the one apex nobody has ever pressed. Ru Anjing made the most recent confirmed crossing in the world, there are witnesses alive who watched it, the objects she sent back are in a catalog, and she spent eleven documented years divesting into that sect on behalf of one specific person - one of the years on a chamber and a man nobody was told about, put under to stand behind the sister she was leaving in charge. That is not the file of somebody about to lose interest, and every apex in the region has read it. The Pavilion has never once referred to her in correspondence, which the Low Fall reads as grief and every rival reads correctly.'
} as const;
