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
        kind: 'parting_gift',
        ancestor: {
            name: 'Ru Anjing, Third Master of the Pavilion',
            whatTheyWere: 'The last confirmed crossing in the world, who spent eleven years divesting into the sect before she made it',
            crossedYearsAgo: 380
        },
        whatItReturns:
            'Nothing further. She left what she left - three of the golden pills, the Standing Edge, and written instructions about the first - and the giver is gone in the sense that matters. One offering has been made since and returned two words, which is not a channel and the Pavilion has never pretended it was.',
        cadence:
            'None. There is no schedule because there is no relationship: a parting gift is a fixed quantity that only goes down, and the Pavilion is a hundred and eighty years past the only reply it has ever had.',
        usability:
            'Completely usable and completely finite, which is the sharpest possible contrast with the two apexes. The Pavilion is formidable now, on the best terms anybody in the province has, and on a slope: it is the strongest institution in the world holding an asset that cannot be renewed, and everyone senior in it can do that arithmetic.',
        whatItExplains: [
            'why the Pavilion can give one away at all - somebody left instructions, so somebody can act on them',
            'why a faction inside the Stonewright Consortium is quietly modelling the year the Edge is spent',
            'why the Pavilion stands at apex height on a stock rather than a channel - the only one of the three whose position is a countdown'
        ],
        note:
            'This is the difference the other two understand and almost nobody else does. Azure Cloud has a treasure, held at apex height and spent against confrontations it should lose. The Deep Survey and the Long Cut have a relationship, and a relationship renews, however rarely. That is not a better hoard; it is a different category of asset entirely, and it is the whole of why the Pavilion is on a countdown and they are not.'
    }
];

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
// tiers in `docs/world/immortals.md`: one immortal is a supreme lineage, two
// extraordinary, three legendary, four or more in succession very nearly
// mythical. That reckoning is public and undisputed. The second axis is not
// public at all, and it is the one that decides how an institution behaves.
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
    depletion: DepletionSchema,
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
        depletion: 'medium',
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
        depletion: 'heavy',
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
        depletion: 'light',
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
        depletion: 'ended',
        whatDepletionLooksLike:
            'The connection is over rather than worn. One ancestor, one crossing, one offering held since, and two words back a hundred and eighty years ago. The yield itself is intact - three golden pills and the Standing Edge, all of it usable today - and there is no mechanism by which any of it is replaced.',
        resilience:
            'None whatsoever. A single channel that has ended means every object is a countdown, and the Pavilion is the only holder in the world for whom spending and losing are the same act.',
        behaviour:
            'The opposite shape to the Court: potent right now, and with nothing behind it. That is exactly why the Pavilion can give a pill away at all - somebody left instructions, so somebody can act on them - and exactly why it has refused itself permission to draw the Standing Edge nine times, including once during a siege. A supreme lineage by the world\'s reckoning, a hundred and eighty years past its only reply, and entirely aware of the arithmetic.'
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
