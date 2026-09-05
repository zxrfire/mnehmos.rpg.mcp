/**
 * Recorded contingencies: plans held by parties, waiting on events that have
 * not happened.
 *
 * These are not scheduled and must never be written as though they were. A
 * contingency is the same kind of object as a wake condition - a party, an
 * instrument, a trigger, and a great deal of waiting - and the engine should
 * treat it exactly that way: nothing here fires on its own, and most of it
 * will never fire at all.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The first entry was not designed. It fell out of two catalog entries written
 * months apart for unrelated reasons:
 *
 *   `hierarchy.ts`  the Deep Survey vault is defended by presence, and the
 *                   Survey therefore cannot leave, because leaving means being
 *                   robbed by an ordinary ambitious sect with time and an
 *                   absence to work in.
 *
 *   `sects.ts`      the Frostmirror Court has a dormant ancestor under its
 *                   cold hall, wakeable once, and the hall does not survive it.
 *
 * Put those two facts in the same room and the second is the answer to the
 * first. Neither entry anticipated the other. That is the good kind of world
 * content, and when another pair like it turns up it belongs here.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS ACTUALLY IN THE VAULT
// The Lamp is the famous thing and is not the valuable thing to a thief.
// ─────────────────────────────────────────────────────────────────────────

export const VAULT_CONTENTS = {
    factionId: 'apex-deep-survey',
    summary:
        'Several centuries of an apex institution keeping everything it was ever given in one building, because the building has never been entered and there has never been a reason to disperse it.',
    whatARaiderWouldActuallyTake: [
        'Assayed spirit stones in a quantity nobody outside the Survey has ever seen in one room - the accumulated float of a body that sets the exchange rate and has never had to spend down.',
        'Refining materials and reagents at grades the Cinnabar Crucible Guild cannot buy at any price, including scar-ground and spirit-vein stock laid down before the drawdown.',
        'Manuals, in grades no living teacher transmits, from sites the Survey sealed itself and never published.',
        'The middle and lower immortal medicines: two golden pills and a talisman that are fungible, usable by anybody, and impossible to trace once out of the register.'
    ],
    whatTheyWouldLeave:
        'Nothing, if the seat is empty - see the arithmetic in `CONTINGENCIES`. The Lamp is only unwinnable while somebody is sitting on it, and the same absence that opens the accumulation opens the Lamp, because the obstacle was never the object. What a crew leaves is decided after the question of whether anybody is in the room, not before it.',
    theSecondaryReason:
        'If a crew ever did have to choose - a partial absence, a shortened window, somebody returning early - it takes the fungible depth and leaves the Lamp, because the Lamp is unusable by anyone who is not the Survey, is instantly identifiable in any room in the world, and is a confession rather than an asset. This is a real consideration and it is the second one. Nobody planning a raid gets to it until they have answered whether the chair is occupied.',
    theIrony:
        'The Lamp is what keeps the vault shut and is the last thing a thief would want to carry out of it. The Survey has organised four hundred years around never leaving the room, and the reason is the boring contents rather than the celebrated one.',
    howMuchIsKnownOutside:
        'Nothing, in detail. That an apex holds a great deal is obvious; what is in the room is not, and no register outside the Survey carries an inventory. A raider would be going in on inference - which is survivable, because the inference is correct.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// CONTINGENCIES
// ─────────────────────────────────────────────────────────────────────────

export const ContingencySchema = z.object({
    id: z.string(),
    /** Who holds the plan. Not who it is aimed at. */
    heldBy: z.string(),
    /**
     * The one-shot thing - except that in this case it is a person with her
     * own view of what is worth getting up for. She is asked, not spent, and
     * everything below follows from that.
     */
    instrument: z.string().min(150),
    /**
     * What she can and cannot convert, stated once. The rankings below are
     * consequences of it and should not re-argue it.
     */
    capabilityEnvelope: z.object({
        againstASeatedPeer: z.string().min(120),
        againstSomebodyBelowAndUnseated: z.string().min(120),
        againstUnattendedWealth: z.string().min(120)
    }),
    /** What she would agree to, in descending order of worth. */
    whatSheWouldAgreeTo: z.array(z.object({
        rank: z.number().int().min(1),
        what: z.string().min(40),
        wouldSheAgree: z.string().min(80),
        worth: z.string().min(120)
    })).min(3),
    /**
     * The hole in the plan: an absence is not enough, because the target has
     * allies who could wake to obstruct - and obstructing is the easy side of
     * the asymmetry.
     */
    theStallProblem: z.string().min(300),
    /**
     * Per allied holder: whether they would actually wake for a patron, and
     * whether the patron believes correctly. Where these diverge is where the
     * world breaks.
     */
    alliedHolders: z.array(z.object({
        factionId: z.string(),
        holds: z.string().min(60),
        wouldTheyWakeForThePatron: z.string().min(150),
        patronBelieves: z.string().min(100),
        divergence: z.enum(['matches', 'patron_overcounts', 'patron_undercounts', 'unknowable'])
    })).min(3),
    /** Why the target is actually safe, which is not the obvious answer. */
    theRealDefence: z.string().min(250),
    /** The choice the Court cannot avoid and has never resolved aloud. */
    theDilemma: z.string().min(300),
    /** How a clever rival disarms a holder of a sealed ancestor without facing the sealed ancestor. */
    theCounterMove: z.string().min(300),
    /** What the first minutes of a waking actually consist of. */
    theWakingItself: z.string().min(300),
    /** The flaw at the centre of it. This is the last word on the entry. */
    askingIsWaking: z.string().min(300),
    /**
     * The three things she can actually do with the hours, only one of which
     * the plan is written for. See `WHAT_SHE_DOES_WITH_THE_TIME`.
     */
    theThreeOutcomes: z.string().min(300),
    /**
     * Whether the holding body could survive her ruling on its own lineage,
     * which is a risk entirely separate from the arithmetic.
     * See `THE_LINEAGE_CLAIM`.
     */
    theClaimRisk: z.string().min(300),
    /** Their own understanding of what it is for, in their terms. */
    inTheirWords: z.string().min(200),
    /** The target, named here because the catalog is not the narrator. */
    targetFactionId: z.string(),
    /** Whether the holding party names the target in its own records. */
    namesTheTarget: z.boolean(),
    /**
     * Why not the obvious prize. This is the arithmetic that a long-held
     * contingency is actually the product of, and it is an instance of
     * `THE_ASYMMETRY` in `sealed-ancestors.ts` rather than a fact about this vault.
     */
    theArithmetic: z.string().min(250),
    /** Why this prize instead, stated as the conclusion of that arithmetic. */
    whyThisPrize: z.string().min(200),
    /** The event it waits on, which has never happened. */
    trigger: z.string().min(150),
    /**
     * Whether the holder has considered manufacturing the trigger, since a
     * party that has waited this long for something that does not happen by
     * itself will have had the thought.
     */
    manufacturingTheTrigger: z.string().min(250),
    /** What the party has actually established, versus assumed. */
    intelligenceState: z.string().min(200),
    /** Somebody is watching for the trigger, and that is itself observable. */
    theWatching: z.string().min(200),
    /** What the target knows about being watched. */
    targetAwareness: z.string().min(200),
    /** Why spending the instrument here is rational rather than mad. */
    whyItIsRational: z.string().min(200),
    /** And what would go wrong, because it might. */
    whatWouldGoWrong: z.string().min(150),
    /** How the plan relates to the instrument's recorded wake condition. */
    versusTheRecordedCondition: z.string().min(200)
});
export type Contingency = z.infer<typeof ContingencySchema>;

export const CONTINGENCIES: readonly Contingency[] = [
    {
        id: 'contingency-cold-hall-for-a-vault',
        heldBy: 'sect-frostmirror-court',
        instrument:
            'The Mirror: the first Sovereign, dormant under the cold hall for two thousand years, wakeable once. She is not a device and the Court has never spoken of her as one - she wakes cold and unhurried, she is asked, and she decides. The hall does not survive the waking regardless of what she decides, so the Court gets one conversation with the most formidable thing it owns and loses its own seat in the having of it. That is the price of asking, for any reason, whatever the answer turns out to be.',
        capabilityEnvelope: {
            againstASeatedPeer:
                'She cannot convert, at any strength. Somebody seated and present does not have to beat her; they have to still be there when her window closes, and no amount of her being stronger changes what the window is. This is the general law rather than a fact about her - see `THE_ASYMMETRY` in `sealed-ancestors.ts` - and it is why nothing in this plan points at a person in a chair.',
            againstSomebodyBelowAndUnseated:
                'One or two realms below her and not seated, a decisive kill is straightforward and comfortably inside her window. She would not have to reach, hurry or gamble. This is the one case where waking her produces a clean, certain result against a living opponent, and it is also the cheapest thing she could possibly be asked for.',
            againstUnattendedWealth:
                'Not a fight at all. Seals, formations, wards, a competent crew arriving late - none of it is a contest with somebody who has a window and nothing to convert against. This is the case her waking is actually suited to, and the Court arrived at the plan by working out that it is the only case where her strength turns into a result.'
        },
        whatSheWouldAgreeTo: [
            {
                rank: 1,
                what: 'An ancient apex accumulation, taken in one night from a building nobody is sitting in.',
                wouldSheAgree: 'Yes, and the Court is as confident of this as it is of anything - it is the only use where what she is converts fully into what the Court would still have afterwards.',
                worth: 'The best realistic use of a waking that exists in this age. Several centuries of an apex holding, taken once, by something that cannot be met. The Court ends as a place and continues as the wealthiest institution in the world, and this is the reason the contingency is held at all.'
            },
            {
                rank: 2,
                what: 'The survival of the Court itself, against a threat that would otherwise end it.',
                wouldSheAgree: 'Almost certainly. It is her sect, her hall and her heritage, and nothing in any record suggests she would refuse to save it.',
                worth: 'Less than the vault. That is the brutal arithmetic and the Court has done it: surviving means continuing as a mid-tier sect with a dead hall, no instrument, no plan and nothing anybody needs to be careful about - while the first use would have made them the richest institution alive. Her agreeing is not in doubt. Whether asking her is the right thing to do with the only ask they have is exactly the doubt.'
            },
            {
                rank: 3,
                what: 'Killing a specific person one or two realms below her who is not seated.',
                wouldSheAgree: 'Probably, if the reason were a good one and briefly put, and she would regard the request itself as small - which is not the same as regarding it as beneath her.',
                worth: 'Achievable, decisive, well inside her envelope - and almost never worth the price. Two thousand years and a hall, for one death that a determined Court could arrange in other ways given a decade. It is on the list because it is the only other thing that reliably works, and it has been raised twice in a hundred and ninety years and dismissed both times inside an afternoon.'
            }
        ],
        inTheirWords:
            'The Court records it as a question rather than a plan, which is how it has stayed unwritten for a hundred and ninety years: what is worth waking her for. The answer the Court has arrived at, and has never put on paper in this form, is that she is worth waking for a room that has stood unopened for four hundred years and is not being sat on. Not for a border. Not for a raid on a rival. For one act, against an accumulation nobody is guarding, taken in a single night by something that was never going to be used for anything smaller.',
        targetFactionId: 'apex-deep-survey',
        namesTheTarget: false,
        theArithmetic:
            'A hundred and ninety years of thinking produced a sum, and the sum is why the plan is not aimed at the Lamp. The Lamp is the best prize in the world and it is guarded by somebody seated, and against a seated defender a sealed ancestor loses even when it is the stronger of the two - because they are not playing the same game. The Mirror is one-shot: she wakes, she has a window, the hall burns in the waking, and she must convert decisively inside that window or the whole instrument is spent for nothing. The one under the vault is spending nothing at all. She does not have to win, or prevail, or leave, or achieve anything. She has to still be there with the intruder still there and nothing done. The Court put a number on it - about one in a hundred, and the one is the defender erring catastrophically rather than the Mirror performing - and then observed that nobody sane spends two thousand years of instrument at ninety-nine to one. So they did the sum, the sum said no, and they went looking for what the sum said yes to.',
        whyThisPrize:
            'The accumulation is second best and it is worth materially less than the Lamp. It is the target for a structural reason rather than a valuation: it is the prize with no fight attached to it at all. There is nobody to beat, no window to convert inside, and no way for the Mirror to fail by being met - only an absence to exploit. That is the entire logic of the plan, and it follows directly from the arithmetic above rather than from anything about the contents.',
        trigger:
            'Not the seat being empty. The seat being empty AND no allied sealed ancestor able to wake inside the window - which is a far harder condition and is the one the Court actually holds. The first half is one event rather than two, because it is one person holding down both prizes. That is the whole of the Survey bind: they are not guarding a vault and separately guarding an artifact, they are a single body in a single chair doing both, and standing up loses both at once. So the trigger is not a choice the Mirror would have to make. If the seat is ever empty she takes everything, the Lamp included, because the thing that made the Lamp unwinnable was never the Lamp. It has not happened in four hundred years and there is no reason to expect it, which is precisely what makes it a contingency: it costs nothing to hold and pays for two millennia of waiting if it ever arrives.',
        manufacturingTheTrigger:
            'They have thought about it, and they got further than they are comfortable admitting: the Court costed it, in writing, once, and the working was destroyed rather than filed. What stopped them was not means and not nerve. It was the third thing, and it is the sum again. Anything large enough to pull an apex Transcender out of a chair she has held for four hundred years is by definition a catastrophe on the scale of a province - and a catastrophe on the scale of a province makes the accumulation worthless, because stones, materials, manuals and medicine are only worth anything inside a world that is still running. They would spend the Mirror, lose the hall, and arrive at an emptied vault holding the wealth of a region that no longer has a market. So the plan stays a plan, waiting on an event it cannot arrange without destroying the reason to arrange it, which is a shape the Court finds bleakly funny and has never said aloud.',
        intelligenceState:
            'They have worked it out, and they got there sideways rather than by penetrating anything. A Court Sovereign four generations back noticed that the office which rules on everything has never once attended anything, tested it cheaply by forcing a boundary question it would have been trivial for the Survey to settle in person, and watched it settle by letter instead. From that she concluded that the absence is not discretion. The Court has told nobody in a hundred and ninety years, because telling anybody spends it: the value of the observation is entirely in being the only party holding it, and a second party holding it is a race.',
        theWatching:
            'Somebody at Frostmirror has been watching for the Survey to move, continuously, for a hundred and ninety years. In practice this is one disciple resident at Green Water City who never advances, never returns to the glacier, and files nothing anybody has intercepted - a posting the Court treats as its most important and describes internally as nothing at all. The watching is itself a quiet fact that could be noticed by anybody who wondered why an ice sect keeps a permanent resident in a province where its curriculum cannot be practised.',
        targetAwareness:
            'The Survey has the observation and not the conclusion, exactly as with its other famous file. Its registers carry an unexplained long-term residency - a Frostmirror-affiliated cultivator of forty years standing with no visible business, no trade, no petitions and no advancement - and it is filed as an anomaly under a category that does not exist for what it actually is. Nothing about the entry is inaccurate. The Survey has never connected a resident who does nothing with a hall two provinces away that contains something sleeping, and it is the most dangerous thing it does not know.',
        whyItIsRational:
            'A dormant ancestor is a single use that ends the institution holding it, so the only question that matters is what it is spent on - and by `THE_ASYMMETRY` the answer is never a person and always an absence. Spent on a border dispute it is idiotic and the Court knows it. Spent on a seated defender it is ninety-nine to one against and the Court has done that sum. Spent on the contents of an apex vault at the one moment nobody is in the building, it is arguably the best use anybody in this age could put such a thing to: several centuries of accumulation, taken once, by something that cannot be met and does not need to survive the act. The Court would end as a place and continue as the wealthiest institution in the world.',
        whatWouldGoWrong:
            'The trigger is a guess about somebody else\'s movements, made from two provinces away, by a party that cannot ask. If the Survey ever leaves for a reason the Court does not understand, or leaves somebody behind who is not in the register, the Mirror is woken into a room that is not empty - and there is no second Mirror, no second hall and no second chance to be wrong.',
        theStallProblem:
            'A hundred and ninety years is long enough to find the hole, and the Court found it early. An empty chair is necessary and not sufficient, because the Survey has subsidiaries, and a subsidiary that holds a sealed ancestor can wake it to obstruct - which is the easy side of the asymmetry. Such a sealed ancestor does not have to beat the Mirror and everybody involved would know it could not. It has to make an apex vault unmanageable for as long as her window lasts, which is a far smaller thing to be asked for. If that happens the raid does not fail because it was beaten; it fails because it was still going when the clock ran out, and then there is no Mirror, no cold hall, and no second attempt ever. The Court has spent most of the last century not counting the vault at all, but counting this - and the counting is why the plan has never moved past being a question.',
        alliedHolders: [
            {
                factionId: 'sect-nine-abyss-flame-sect',
                holds: 'The Kindler, under the caldera vent, live and maintained, and the healthiest sealed ancestor in the world.',
                wouldTheyWakeForThePatron:
                    'No. The Kindler is being saved for a creditor the sect believes is coming for nine centuries of contract terms, and a Flame Sovereign asked to spend it defending a patron vault would refuse and would not consider it a difficult decision. The sect pays its tribute early every cycle and has done for two hundred years precisely so that this question never gets asked out loud.',
                patronBelieves:
                    'That they are the most reliable subsidiary in the province and would answer a summons. The Survey has no idea what they hold, so it is not counting the Kindler - it is counting a loyalty that would not extend to the only thing that would matter.',
                divergence: 'patron_overcounts'
            },
            {
                factionId: 'house-anchorhold',
                holds: 'Xu Ci under the datum stone, published in the survey standard as a schedule, and dead for perhaps two centuries.',
                wouldTheyWakeForThePatron:
                    'They would try, and nothing would happen. The house is not a subsidiary and owes the Survey nothing formally, but its whole existence is containment and survey work, and a request from the party whose datum its own stone refers to would be answered - by a house whose one instrument has been gone since before anybody currently posted was born.',
                patronBelieves:
                    'That the published schedule is real, because it has never had a reason to think otherwise and the Anchorhold has never had a reason to check.',
                divergence: 'patron_overcounts'
            },
            {
                factionId: 'sect-nine-peaks-ascetic-order',
                holds: 'Meng Da, somewhere in the vein workings, unsealed, unowned and unwakeable by anybody deliberately.',
                wouldTheyWakeForThePatron:
                    'They could not if they wanted to. There is no procedure, no seal, no condition and no acknowledgement that there is anything down there - the Order treats it as a story its ascetics tell each other. It is the only sealed ancestor in the province that might intervene in something by accident and cannot be asked to intervene in anything on purpose.',
                patronBelieves:
                    'Nothing at all. The Survey holds the Order as its oldest continuous grant and has never heard the story.',
                divergence: 'unknowable'
            },
            {
                factionId: 'apex-deep-survey',
                holds: 'Whatever else is out there. The Survey has never enumerated its own coverage and could not.',
                wouldTheyWakeForThePatron:
                    'Unknown, and this is the row that actually stops the plan. Frostmirror can name two allied holders and rule out a third, and cannot rule out a fourth it has never heard of - a quiet mountain, a subsidiary that has never mentioned what is under it, or a party with an old obligation nobody has written down. The Court has concluded, correctly, that this cannot be resolved from outside.',
                patronBelieves:
                    'That it is covered. The Survey has never counted either, and its confidence is inherited from four hundred years of nobody testing it.',
                divergence: 'unknowable'
            }
        ],
        theRealDefence:
            'The Survey is not defended by one seated Transcender. It is defended by one seated Transcender plus an unknown number of allied instruments that an attacker would have to count correctly, in advance, with no way to check any of them - and by the fact that a single wrong count is fatal and unrepeatable. That is the federation and the deference border doing the same work at the top of the world: the reason nobody tests an apex is not the chair, it is that nobody can enumerate what would answer. The Survey believes it is covered. Frostmirror believes it has counted. Both are working from readings of sealed ancestors nobody has spoken to in centuries, and at least one of them is wrong.',
        theDilemma:
            'The two uses are mutually exclusive and the Court cannot have both. If Frostmirror is ever attacked existentially, waking her to survive means permanently giving up the payoff they have held for a hundred and ninety years - there is no second Mirror and no second hall. So the choice is to survive as a mid-tier sect with nothing left that anybody needs to be careful about, or to refuse to wake her and possibly not survive at all. There is no version where they get both, everybody senior in that hall understands it, and somebody in there has already decided which way they would go and has never said so aloud. The Court has no procedure for the question, which is not an oversight: writing a procedure would require somebody to put the answer in a document.',
        theCounterMove:
            'The way to disarm a holder of a sealed ancestor is not to beat them. It is to threaten them hard enough that they burn the instrument defensively - a rival who understood the position could force the Mirror to be spent on survival and walk away having neutralised a two-thousand-year asset without ever facing it, at the cost of a war they intended to lose anyway. Somebody has worked this out: the House of the Narrow Hour holds it as an abstract reading, has published it to nobody, and quietly declined a commission that would have amounted to selling it - one of the two declined commissions in its own records, and the party that commissioned it has no idea how close it came. The Storm Tyrant Court, which has raided the glacier twice and stopped, would use it the day it heard it and has not heard it.',
        theWakingItself:
            'The Court has written the briefing. It is nine lines, it has been revised eleven times in a hundred and ninety years, and it exists because somebody worked out early that her first minutes will be spent establishing what the sect has become, what year it is, who holds the seat and whether the people in front of her are who they say - and that those minutes come off the clock. The nine lines are the single largest contribution the living can make to a waking, and the Court knows it. What the Court has never been able to write is the other half of the scene: she is the first Sovereign, the people asking will be her successors at a distance she can measure in a glance, she may not be impressed, and she will say so once, briefly, while deciding whether to go and rob somebody. Nobody in that hall expects to enjoy it.',
        askingIsWaking:
            'And here is the flaw at the centre of all of it: you cannot consult a sealed ancestor. Asking is waking. The Court has spent a hundred and ninety years planning around what they believe she would agree to, and they have never once been able to check - every term of the plan rests on a reading of a woman nobody currently alive has met, assembled out of records, out of what she was reportedly like, out of what the founding volumes say she cared about. They may simply be wrong. She may wake, listen to what they want her to do, and decline it - and the hall is gone either way, because the waking is the irreversible part and her answer comes afterwards.',
        theThreeOutcomes:
            'And the plan has priced one outcome out of three. She can do the thing, which is what every line of the vault reasoning assumes. She can decide the best use of the hours is to hand down something the world has lost, and spend them teaching whichever people are in the room - which would be the Court\'s single greatest gain in nine hundred years and would leave the vault exactly where it is. Or she can listen, decline without drama, walk out of the broken hall and go and look at the sky, because she has been under ice for two thousand years and would rather see the sun go down than rob a bank for her successors. Nothing about that third one is a rebuke and there is nothing in it anybody could take offence at, which is why it would be worse for the Court than a refusal with reasons. The plan is not a plan for spending an asset. It is a proposal being put to a person, and the Court has quietly assumed an answer it has no way to obtain.',
        theClaimRisk:
            'There is also a risk in this that the Court has never written down, and it is not the arithmetic. She is the only authority in the world who could rule on whether the Frostmirror Court is really her Court, and the moment she opens her eyes she is doing exactly that, before anybody says a word about vaults. The Court believes its claim is sound and it is probably right - the records are good, the line is legible, the hall is the hall. Probably is doing a lot of work in that sentence when the ruling is public, immediate and final, and when the alternative reading is that a body of administrators woke a founder in order to defraud her into working for them. Nobody in that hall has ever raised it aloud, which is not the same as nobody having thought about it at three in the morning.',
        versusTheRecordedCondition:
            'The written wake condition is defensive: the library entered by force. That is what the Court has recorded, it is true, and it is not the whole of what the Court intends. The offensive reading has never been added to the record, and the reason is exactly why it has never been added: writing it down would make it a plan somebody could find, and the Court would rather hold a question than a document. A seal cuts both ways, and this is the case the phrase was for.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE SAME OBSERVATION, WITHOUT THE MEANS
// Frostmirror is not the only party to have noticed. It is the only one that
// can do anything about it, which is a much rarer position than the noticing.
// ─────────────────────────────────────────────────────────────────────────

export const OTHERS_WHO_NOTICED: readonly {
    factionId: string;
    whatTheyHave: string;
    whatTheyLack: string;
    whatTheyDoWithIt: string;
}[] = [
    {
        factionId: 'sect-thousand-treasure-pavilion',
        whatTheyHave:
            'Four hundred years of auction records, arbitration filings and correspondence, and not one instance of a Survey party attending anything in person. The Pavilion noticed because it notices absences professionally: it is the house that spotted that no immortal medicine has ever come to auction from a sect with more than it needs.',
        whatTheyLack:
            'Any means whatsoever. The Pavilion has appraisers, couriers and a vault nobody has located, and nothing that would survive five minutes in a room with an apex. It also has far too much to lose: it holds a charter from the party in question.',
        whatTheyDoWithIt:
            'Prices it. The Pavilion quietly discounts the risk of Survey enforcement in its own internal terms, has never explained why to its own Council Seats, and treats the observation as commercially useful rather than strategically interesting. It has read the absence as discretion, which is the same wrong conclusion the Long Cut has reached and for the same reason: it is the reading a party with something to lose finds comfortable.'
    },
    {
        factionId: 'sect-hollow-bell-wanderers',
        whatTheyHave:
            'The observation as a joke. Wanderers who have been refused, ruled against or moved on by a Sill have a standing line about the office that never comes, and it is old enough that nobody remembers who started it.',
        whatTheyLack:
            'Everything. No ground, no instrument, no organisation and no interest in the question beyond the pleasure of the remark.',
        whatTheyDoWithIt:
            'Repeat it in inns, which makes them the most likely route by which a player first hears any of this - a true and load-bearing fact, delivered as a grumble by somebody with no idea what they are holding, in a form nobody has ever bothered to verify.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const BY_ID: ReadonlyMap<string, Contingency> = new Map(CONTINGENCIES.map(c => [c.id, c]));

export function getContingency(id: string): Contingency | undefined {
    return BY_ID.get(id);
}

/** Plans a faction is holding, which it will not be discussing. */
export function contingenciesHeldBy(factionId: string): Contingency[] {
    return CONTINGENCIES.filter(c => c.heldBy === factionId);
}

/** Plans aimed at a faction, whether or not that faction has any idea. */
export function contingenciesAgainst(factionId: string): Contingency[] {
    return CONTINGENCIES.filter(c => c.targetFactionId === factionId);
}

/** Parties who have reached the observation without the means to use it. */
export function noticedWithoutMeans(): readonly { factionId: string }[] {
    return OTHERS_WHO_NOTICED;
}
