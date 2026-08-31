/**
 * Things that came down from above.
 *
 * A handful of consumables exist in the world that nobody below the Lid can
 * make, refine, repair or replace. They came down from the immortal realm,
 * which is the only provenance any of them has and the only one they can have,
 * and the supply is therefore finite and shrinking: every one spent is one
 * fewer in the world forever. That is what makes the holders careful rather
 * than merely stingy.
 *
 * TWO EFFECTS, BOTH CURRENTLY IMPOSSIBLE BY ANY OTHER MEANS
 * --------------------------------------------------------
 *   promote_realm        advance a small realm outright, skipping accumulation
 *                        that would otherwise take decades or centuries
 *   change_spirit_root   rewrite the aperture a person draws qi through
 *
 * The second one should read like something that should not exist, because it
 * should not. `spirit-roots.ts` states the rule the whole design rests on: a
 * spirit root is rolled once, is permanent, and there is no respec, no reroll
 * and no item that changes it. `CultivatorSchema` says the same thing in the
 * comment above the field - rolled once, permanent, never editable after
 * creation. Every balance measurement in this engine assumes it.
 *
 * So a Second Dealing is not a consumable tier. It is a world-historic
 * exception, of which two are known to exist, and the correct reaction to
 * hearing that one is in a room is not excitement but a kind of vertigo. The
 * catalog states the rule and then states the exception, in that order,
 * deliberately.
 *
 * NOT PURCHASABLE, AT ALL
 * -----------------------
 * There is no price field in this file and there must never be one. A price
 * would imply the economy reaches these, and it does not: the Thousand
 * Treasure Pavilion has never listed one in four hundred years of catalogues,
 * and the Stonewright Consortium declines to assay them, on the stated grounds
 * that an assay implies a rate.
 *
 * THREE GRADES, AND THE COMPARISON THEY MAKE POSSIBLE
 * ---------------------------------------------------
 * Both medicines come in higher, middle and lower, and grade tracks what an
 * ancestor can afford to send. Ancient ancestors answer rarely and send well.
 * A fresh one answers constantly and sends what she can, which is the bottom
 * grade, because three hundred and eighty years across is nothing.
 *
 *   Azure Cloud   most in total by a distance, all of it lower, and RISING
 *   Deep Survey   fewer, one higher, some middle and lower: rare and good
 *   Long Cut      fewer, one higher, differing middle and lower: rare and good
 *
 * So the four cannot be put in a single order at all, which is the point. The
 * Pavilion is rich in quantity and poor in quality; the apexes are the exact
 * inverse; and each of them would find the other position alarming for
 * completely different reasons.
 *
 * THREE HOLDERS, TWO KINDS OF OBSTACLE
 * ------------------------------------
 * The Azure Cloud Pavilion holds more than anybody, under written instructions
 * from the woman who left them, and can therefore act. There is somebody to
 * convince, and getting one is a social and political problem rather than a
 * heist. It is also the only holder whose stock goes UP, for a reason that is
 * a person rather than an institution - see `crossings.ts`.
 *
 * The Deep Survey and the Long Cut are a different kind of obstacle entirely,
 * and the difference is the point. These are the administrators of the world:
 * they hold the veins, set the terms and keep the registers, and a body that
 * runs an economy is exactly the body that counts a finite irreplaceable stock
 * down to the unit, minutes it, and requires a quorum to touch it. Their
 * carefulness is not sentiment and not hoarding. It is what an institution
 * does with a line item it cannot reorder.
 *
 * So the holding is small enough that releasing one is a decision taken
 * collectively, every member would rather not be the one who moved it, and any
 * one of them can say no. Rank does not help: a Surveyor asking is one voice,
 * and the others can refuse. There is a form for requesting one. It has been
 * submitted. The answer was no.
 *
 * That is arithmetic rather than a lever, and there is no version of the
 * problem where the player finds the right person and applies enough pressure.
 *
 * The contrast is deliberate: Azure Cloud is a sect holding a dead woman's
 * gift and trying to honour what she meant by it, and the apexes are
 * bureaucracies holding an unreplenishable line item. Same objects, entirely
 * different obstacle.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// Content-side. Nothing here is in `src/schema/cultivation.ts` yet, and two of
// the effects cannot be expressed by anything that is - see ENGINE_GAPS.
// ─────────────────────────────────────────────────────────────────────────

export const ImmortalItemEffectSchema = z.enum([
    'promote_realm',
    'change_spirit_root'
]);
export type ImmortalItemEffect = z.infer<typeof ImmortalItemEffectSchema>;

export const ImmortalItemFormSchema = z.enum(['golden_pill', 'talisman']);
export type ImmortalItemForm = z.infer<typeof ImmortalItemFormSchema>;

/**
 * Both medicines come in three grades, and the grade is a property of the
 * object rather than of the effect: a lower Unearned Step and a higher one are
 * the same kind of thing, made by the same means, and one of them does far
 * less. Grade is what an ancestor can afford to send, which is why it maps so
 * cleanly onto how long they have been across.
 */
export const ImmortalGradeSchema = z.enum(['higher', 'middle', 'lower']);
export type ImmortalGrade = z.infer<typeof ImmortalGradeSchema>;

/** Counts by grade. The four holders are directly comparable on this shape. */
export const GradeCountsSchema = z.object({
    higher: z.number().int().min(0),
    middle: z.number().int().min(0),
    lower: z.number().int().min(0)
});
export type GradeCounts = z.infer<typeof GradeCountsSchema>;

/** How a holder decides to part with one, which differs sharply by holder. */
export const ReleaseModeSchema = z.enum([
    'written_instruction',  // somebody left terms, so somebody can act on them
    'collective_consent'    // a body decides, and any member can refuse
]);
export type ReleaseMode = z.infer<typeof ReleaseModeSchema>;

export const RecordedRefusalSchema = z.object({
    yearsAgo: z.number().int().min(1),
    /** Who asked, and why the case was a good one. */
    theCase: z.string().min(120),
    /** Who refused, and the reason given at the time. */
    refusedBy: z.string().min(60),
    /** What happened to the petitioner afterwards. */
    afterwards: z.string().min(60),
    /** Why the sect was probably right, stated without softening it. */
    probablyRight: z.string().min(80),
    /** What saying no cost them anyway, which is the point of recording it. */
    costAnyway: z.string().min(80)
});
export type RecordedRefusal = z.infer<typeof RecordedRefusalSchema>;

export const HoldingSchema = z.object({
    factionId: z.string(),
    itemId: z.string(),
    /** The total. Never "a few": everyone senior knows the number. */
    count: z.number().int().min(0),
    /** The same total broken out by grade, which is the real comparison. */
    byGrade: GradeCountsSchema,
    countIsKnownTo: z.string().min(60),
    releaseMode: ReleaseModeSchema,
    /** The body or office that decides. For collective holders, a body. */
    decidedBy: z.string().min(80),
    /** True where any single member of the deciding body can end it. */
    anyoneMayRefuse: z.boolean(),
    /** What the holder considers a sufficient reason to part with one. */
    sufficientReason: z.string().min(120),
    /** What saying yes costs the holder internally. */
    costOfSayingYes: z.string().min(120),
    /**
     * The instrument, where the holder is a bureaucracy: there is a form, it
     * has been submitted, and the answer was no.
     */
    theForm: z.string().min(120).nullable(),
    /** Collective holders only: the time somebody good was told no. */
    recordedRefusal: RecordedRefusalSchema.nullable(),
    /**
     * Collective holders only. Saving the institution is not a transaction and
     * does not buy anything. It produces a circumstance in which refusing
     * becomes indefensible to people who would otherwise refuse - and even
     * then, one or two of them may hold out, and a player who saves the sect
     * and still walks away empty-handed has been treated honestly.
     */
    savingTheSect: z.string().nullable()
});
export type Holding = z.infer<typeof HoldingSchema>;

export const ImmortalItemSchema = z.object({
    id: z.string(),
    /** The name the world settled on. Nobody knows what it was called above. */
    name: z.string().min(1),
    form: ImmortalItemFormSchema,
    effect: ImmortalItemEffectSchema,
    /** Total known to exist, across every holder, right now. */
    knownCount: z.number().int().min(0),
    /** Total believed to have existed ever, including the spent ones. */
    everKnown: z.number().int().min(0),
    /** Where it came from, which is fixed and is the only possibility. */
    provenance: z.string().min(150),
    /** Why the supply cannot be renewed, including who has tried. */
    cannotBeMade: z.string().min(150),
    /** Why no price appears anywhere in this file. */
    notForSale: z.string().min(120),
    /** What it does, in world terms rather than engine terms. */
    effectNote: z.string().min(120),
    /** What each grade of this object actually accomplishes. */
    grades: z.object({
        higher: z.string().min(120),
        middle: z.string().min(120),
        lower: z.string().min(120)
    }),
    /** World counts by grade, summing to `knownCount`. */
    knownByGrade: GradeCountsSchema,
    /** What happens to the person afterwards, socially. The interesting part. */
    socialConsequence: z.string().min(200),
    /** Whether a ruin could hold one, and under exactly what circumstance. */
    ruinAvailability: z.string().min(150),
    description: z.string().min(150)
});
export type ImmortalItem = z.infer<typeof ImmortalItemSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE ITEMS
// ─────────────────────────────────────────────────────────────────────────

export const IMMORTAL_ITEMS: readonly ImmortalItem[] = [
    {
        id: 'immortal-unearned-step',
        name: 'The Unearned Step',
        form: 'golden_pill',
        effect: 'promote_realm',
        knownCount: 13,
        everKnown: 24,
        knownByGrade: { higher: 1, middle: 3, lower: 9 },
        provenance:
            'It came down. That is the whole of the provenance and there is no competing account: every one in the world arrived with somebody who had crossed and then came back down, or was left behind by somebody who crossed and did not. Nothing in either province has ever produced one, and no record anywhere describes an attempt that got further than an ingredient list.',
        cannotBeMade:
            'The Cinnabar Crucible Guild has tried it four times across three centuries, published every failure in full, and states plainly that it cannot identify the method, the materials, or in two cases even the direction of the error. What is left of a failed attempt is inert and does not resemble the original in any measurable way. No alchemist at any grade has produced anything closer.',
        notForSale:
            'It has never appeared in a Thousand Treasure catalogue, and the Stonewright Consortium declines to assay one on the stated grounds that an assay implies a rate. There is no price, there has never been a price, and a party who opens with an offer of stones has told the room something about themselves.',
        grades: {
            higher: 'May deliver a cultivator into Grand Ascension and no higher, so the greatest crossing it enables is Body Integration Perfection to Grand Ascension Early - ordinal 36 to 37, the last boundary on the mortal plane. One is known to exist and the Deep Survey holds it. It is still one rung, still only from Perfection, and it still stops dead below 41. See `THE_LAST_REALM_IS_UNBUYABLE`.',
            middle: 'May deliver a cultivator into Void Refinement and no higher: at best Deity Transformation Perfection to Void Refinement Early, ordinal 28 to 29. That is the boundary most careers end at, which makes a middle the difference between a regional power and one of the dozen strongest people in a province - and it is one rung, from the top, like every other grade. Three are known.',
            lower: 'May deliver a cultivator into Deity Transformation and no higher: at best Nascent Soul Perfection to Deity Transformation Early, ordinal 24 to 25. Not a lesser effect - the same single crossing every grade performs, capped at a lower destination - and 25 is body and soul merged, two thousand years of lifespan, and a region learning your name. Nine are known: seven at the Azure Cloud Pavilion, one at the Deep Survey, one on the Long Cut schedule.'
        },
        effectNote:
            'It carries a cultivator across exactly one realm boundary, from Perfection of their current realm into Early of the next, and it does nothing else at all. It is not a ride from wherever somebody happens to be standing: what it moves is one rung, from where the recipient stands to Early of the next realm, and Perfection is where that is worth the most rather than where it is required. The grade caps how high that destination may be. What would have been forty years of sitting at Perfection, or a century, or a lifetime that ran out at the boundary, is simply done - and the body arrives without having built the road to it, which every physician who has examined a recipient has remarked on and none can quantify. See `THE_STEP_AND_THE_BOUNDARY` and `ONCE_IN_A_LIFE`.',
        socialConsequence:
            'The arithmetic is public. Anybody who has watched a cultivator for a decade can see that the accumulation was not there, and the conclusion arrives in a week. The Ninefold Ledger opens a lineage audit without being asked, because an unexplained jump is exactly what an unrecorded transfer looks like and the Ledger does not distinguish. Rivals stop treating the person as an individual and start treating them as the instrument of whoever gave it, which is usually correct. And the giver becomes publicly known to hold one fewer, which invites the only question that matters about a finite supply: how many are left. The recipient is not admired. What gets remarked on is the part that could not be given.',
        ruinAvailability:
            'Only as the rarest case, and only as a grave rather than an inheritance: somebody who came down carrying one and died somewhere remote before spending it. That is legitimate and it has happened perhaps twice in recorded history. What does not exist, at any depth, in any sealed site, is a supply - a cache, a shelf, a second one in the same room. Two finds have been claimed in four hundred years and the Ledger established both as forgeries.',
        description:
            'A golden pill, smaller than expected, in a box that is plainly part of the object rather than packaging for it. The inscription on the lid is in no script anybody below the Lid can read, and the four institutions that have examined one agree on nothing about it except that the writing is not decorative.'
    },
    {
        id: 'immortal-second-dealing',
        name: 'The Second Dealing',
        form: 'talisman',
        effect: 'change_spirit_root',
        knownCount: 4,
        everKnown: 7,
        knownByGrade: { higher: 1, middle: 1, lower: 2 },
        provenance:
            'The same and no other: it came down. Two are known to be in the world, one was spent nine hundred years ago in a case the Ninefold Ledger still holds the file on, and there is no fourth in any record anywhere. Whether more exist above is not a question anyone below can put to anybody.',
        cannotBeMade:
            'Nothing in the world approaches it, and unlike the golden pill there is no history of attempts, because there is no theory to attempt. A spirit root is the aperture a person draws qi through and it is settled before birth; there is no discipline anywhere that treats it as a thing with a mechanism, and the alchemists who tried the pill will say flatly that this is a different kind of object and they would not know where to begin.',
        notForSale:
            'No price, no catalogue, no assay, and no broker who will carry an approach. The Thousand Treasure Pavilion, which will handle almost anything, has twice declined to pass a message about one and did not explain why either time.',
        grades: {
            higher: 'Grants a single mutated root - the best outcome that exists below the Lid, and the thing no institution in the world can supply by any other means. Exactly one is known. This is the object that should not exist, and everything alarming ever said about the Second Dealing is about this grade.',
            middle: 'Takes a five-root straight to a one or a two, and which of the two you get is luck. Not dosage, not preparation, not the skill of anybody present: luck, on the day, with no way found in nine hundred years to influence it. That uncertainty is exactly why it is a middle grade rather than a higher one - a better ceiling than the lower and a worse floor than anybody would choose for something this rare. One is known.',
            lower: 'Reliable, bounded, and the most useful object in this file. A five-root becomes a four or a three; a four or a three becomes a two. It never produces better than a two, and it cannot produce a single root at any point, by any route, for anybody. What it does is take the worst root in the world and make it merely bad, every time, without a gamble - and because nobody gets a second one, the two it leaves behind is where that person stays forever. Two are known, both at the Azure Cloud Pavilion.'
        },
        effectNote:
            'It changes the root once and forever, to the extent its grade permits: the lower narrows reliably and never past a two, the middle goes to a one or a two on luck alone, and the higher grants a single mutated root outright. Nobody gets a second, at any grade, in any circumstance. The thing that was dealt once and could not be redrawn is redrawn, and a cultivator who was muddled is not muddled any more. Every rule in the world says this is impossible - the manuals say it, the physicians say it, the Frostmirror Court has four centuries of records saying it - and the rule is correct in every case but this one, which is precisely what a world-historic exception is.',
        socialConsequence:
            'There is no version of this that stays quiet. The House of Held Names holds a register entry describing a person who no longer matches it, and an entry that has stopped matching its holder is the single loudest signal that register can produce - it is what the register is for. The Quiet Cut will take a commission to make the discrepancy go away and will not be able to, which has happened once and did not improve their reputation. The House of the Narrow Hour cannot sight the person correctly for some years afterwards, because every reading it holds was cast on a root that is no longer there. And two institutions in particular want to know: the Frostmirror Court and the Storm Tyrant Court both survive on an intake of one root in a hundred, and a manufactured mutated root would end that problem permanently, which makes them the least safe parties in the world to be recognised by.',
        ruinAvailability:
            'In principle only, and nobody sensible plans on it. The legitimate case is identical to the pill - a grave, one person, one object, somewhere remote - and it has never once been the recorded outcome of a dig. The Bone Lantern Cult, which works more graves than anybody, states that it has never seen one and does not expect to. There is no cache, there has never been a cache, and the claim that there is one has been the bait in at least three lethal frauds.',
        description:
            'A talisman, thin, and warm in a way that does not change with the room. Two are known. The correct reaction to being told one is in the building is not excitement, and the people who have handled one describe the same thing afterwards: that it should not be here, and that it plainly is.'
    }
];

// -------------------------------------------------------------------------
// THE LAST REALM IS UNBUYABLE
// The ceiling on every grade of every object in this file, stated once as an
// absolute so nothing downstream has to reason about it.
// -------------------------------------------------------------------------

/**
 * Nothing carries anybody into Tribulation Transcendence. Ordinal 41 and
 * everything above it is done by hand, always, by everybody, with no exception
 * anywhere in the catalog or the record.
 */
export const THE_LAST_REALM_IS_UNBUYABLE = {
    theAbsolute:
        'No object, at any grade, from any source, in any circumstance, delivers anybody to ordinal 41 or above. Tribulation Transcendence is walked to or it is not reached. There is no exception in this catalog, none in the historical record, and none that could be introduced without breaking the thing the ladder is for.',
    theCeilings: [
        'lower: may deliver into Deity Transformation. Top crossing 24 to 25.',
        'middle: may deliver into Void Refinement. Top crossing 28 to 29.',
        'higher: may deliver into Grand Ascension. Top crossing 36 to 37.',
        'and then nothing. Grand Ascension Perfection at 40 is the highest rung any object touches, and 41 upward is reachable only by the work.'
    ],
    gradeCapsDestinationNotDistance:
        'Note what the grades actually buy, because it is easy to misread: every grade performs the same single crossing, from Perfection to the Early rung above it. What a higher grade buys is permission to perform that crossing further up the ladder, not a longer journey. A higher-grade pill spent at Nascent Soul Perfection does exactly what a lower-grade one would have done there, and the difference between them is spent for nothing.',
    whyItStopsThere:
        'Because 40 is the last rung of the mortal plane and 41 is the approach to the Lid. Everything below the sky can be given: inputs, time, teachers, medicine, a rung. The approach cannot, and that is not a rule about these objects - it is the same rule as the Hollow Court refusing to look at anybody below a Void Refinement floor with evidence they could cross, and the same rule as `origin.md` holding that privilege buys inputs and never rank. Being handed things gets you to the foot of the last climb and no further.',
    whatItProtects:
        'The meaning of the top of the ladder. If any grade could hand somebody 41, everything above 40 would be a statement about what an institution had in a vault rather than about a person, and every Tribulation Transcender in the world would be an open question about who paid for them. Instead the answer is known in advance and is the same for all of them: they walked. That is why the last realm still means something, and why the four seated at the Hollow Court are impressive in a way no holding can imitate.',
    theConsequenceForHolders:
        'It also caps what any of this buys politically. The Deep Survey holds the only higher-grade pill in existence and could not manufacture a peer for the Hollow Court with it - the best it can do is move somebody who has already climbed to 36 onto the first rung of the last mortal realm. An apex spending its rarest object still cannot buy its way into the last realm, every apex knows it, and that takes a great deal of heat out of the cold war.'
} as const;

// -------------------------------------------------------------------------
// THE STEP AND THE BOUNDARY
// One crossing, into Early of the next realm. Taking it from Perfection is
// the clean case and the rare one; most Steps in history were taken early by
// somebody who was running out of time.
// -------------------------------------------------------------------------

export const THE_STEP_AND_THE_BOUNDARY = {
    theRule:
        'It carries a cultivator across exactly one realm boundary and delivers them to Early of the next realm. The grade caps how high that destination may be. What varies is where the recipient was standing when they took it, and that decides what they are for the rest of their life.',
    perfectionIsTheCleanCase:
        'Taken at Perfection of the current realm, the crossing is clean. The accumulation was finished, the boundary is simply paid for, and what arrives on the far side is an ordinary cultivator of the new realm with an ordinary foundation who will go on climbing. This is the full value of the object and it is the outcome every instrument in this file was written to produce.',
    takingItEarlyIsAvailable:
        'And taking it below Perfection works. It is not a waste, not a misfire and not a refusal: the Step still crosses the boundary, the recipient still arrives at Early of the next realm, and they are still alive on the other side of a wall that was going to kill them. What they gave up is ceiling. What they bought is time.',
    whyPeopleDoIt: [
        'They are running out of life at their current realm, which is the big one. Lifespan is tied to realm, so crossing is the only thing that extends the clock. A cultivator with fifteen years left at Nascent Soul who is plainly not reaching Perfection in fifteen years has no decision to make: take it now and live, or hold out for the better outcome and die holding the pill.',
        'Or they simply do not care. Somebody who is not chasing the summit wants the power and the years now, and the theoretical ceiling they are trading away is one they were never going to approach. That is not a failure of nerve, and treating it as one is a thing sects do rather than a thing that is true.'
    ],
    whatItCosts:
        'A permanent ceiling. They arrive in the new realm having never properly finished the last one - the accumulation was skipped rather than completed - and the foundation they land on is correspondingly poor, which is exactly what `foundationQuality` already exists to hold. They are alive, they are a realm higher, they have centuries they would not otherwise have had, and they will very probably stall where they stand for all of it.',
    theOrdinaryCase:
        'This is how Steps actually get used, and the catalog should read that way. The disciplined version - a candidate held at Perfection, an object spent at the exact right moment by an institution with the patience to wait - is the rare one. The ordinary one is a frightened person with a deadline making a rational trade, and most Steps in the history of the world have been spent exactly like that.',
    thePopulation:
        'So the world contains a visible number of people who are one realm above what their foundation supports: permanently stalled, obviously carried rather than climbed, and legible as such to any cultivator who looks properly. It is a social fact rather than a secret. It is also not uniformly shameful - a good many of them made the only sensible choice available to them, and the ones who sneer are usually people who have never had a deadline.',
    holdingSomebodyAtPerfection:
        'Which reframes the disciplined case as a luxury rather than a practice. An institution with time in hand can ask a candidate at Perfection to hold there while a council decides, and the request is correct, because a cultivator who pushes through the boundary on their own has spent the crossing the Step was going to pay for. So they wait. Some of them wait years. Nobody in the room is behaving badly and the person waiting has no good way to describe what is being done to them.',
    theCompensationThatIsNotOne:
        'Institutions that do this usually pay in rank, which costs them nothing and reads outside as a promotion: a seat, a title, a stipend, and a standing instruction not to break through. At an apex, where rank is decoupled from realm anyway, the arrangement is almost invisible from outside and completely legible to anybody inside who has been asked the same thing.'
} as const;

// -------------------------------------------------------------------------
// WHAT SERVICE ACTUALLY BUYS
// Sects reward service generously and reliably. They will not spend an
// immortal medicine on it. Those are two different statements and this file
// keeps them apart.
// -------------------------------------------------------------------------

export const WHAT_SERVICE_ACTUALLY_BUYS = {
    theyDoReward:
        'Read nothing in this file as sects being ungrateful. A sect that owes somebody enormously pays enormously, publicly, and for a long time, and considers the debt genuinely honoured when it has - because it has. The refusal that runs through `THE_TWO_CLAIMS` is about one category of object and nothing else.',
    theLine:
        'Replaceability, and that is the whole of it. Everything else a sect has, it can get more of: it can promote, endow, teach, house, protect and vouch for people, and it can do all of that again next year. An immortal medicine does not come from the world. It comes down, rarely, at somebody else\'s discretion, and there is no supply, no method, and nobody to ask. So it sits outside the reward economy entirely - not because service is not worth it, but because nothing is worth it except the thing it was held for.',
    whatIsOnOffer: [
        'Rank, and quickly. Seats, titles, and the standing that goes with them.',
        'A stipend that does not stop, and is not means-tested against what else the person has.',
        'Resources: medicine, materials, a place in the queue for what the sect produces.',
        'Technique access, including things the sect does not teach at that rank and makes an exception about.',
        'A cave on a real vein, which is the largest material gift most cultivators will ever receive and is a decision about somebody\'s entire remaining career.',
        'Protection, meaning the sect answers for you - which is worth more in this world than any object and is the thing an unaffiliated cultivator has no way to buy.',
        'And a name that opens doors, permanently, in rooms the person could not otherwise enter.'
    ],
    theFamily:
        'And the largest of them, which is easy to underrate from inside a cultivator-shaped view of the world: the sect looks after the family. Meritorious service buys generational security. The people of somebody who served are taken in, kept, placed, educated, fed and not forgotten - for decades, through deaths and successions, whether or not any of them can cultivate at all. It is honoured long after everybody who made the decision is gone, it costs the sect a great deal in the aggregate, and no institution in this catalog treats it as optional.',
    whyItIsTheRealMotivation:
        'Which is the actual reason a great many people cultivate, and the catalog should say so plainly. For somebody out of a thin county - no placement, no teacher, no readable manual, nobody outside the valley who knows the family name - the summit is an abstraction and glory is somebody else\'s word. What is not abstract is that if they serve well enough, their people stop being poor. Permanently. That is a clean, sufficient, entirely admirable motive, it has nothing to do with power, and it is available to somebody who will never see ordinal 20.',
    theSameAtEveryScale:
        'And it is not an apex practice. The Gleaners\' Company pays a dead digger\'s share to their family without exception and has never once defaulted, on a salvage contract, in the poorest province in the world - see `unitOfValue` in `faction-character.ts`. That is the same institution as an apex endowing an elder\'s grandchildren, at the only scale the Company has. An apex honouring it is not being kind; it is doing what every sect does, with more to spend.',
    soTheRefusalIsNarrow:
        'Which is what makes the refusal in `THE_TWO_CLAIMS` land where it does. Nobody deserving is turned away with nothing. They are given everything the sect can replace, sincerely and in full, and refused the single category it cannot - and being told no about one irreplaceable object by people who have just given you everything else is a much harder thing to be angry about than a snub would be.'
} as const;

// -------------------------------------------------------------------------
// THE TWO CLAIMS
// Potential and debt. Same object, two incompatible justifications, and no
// institution holding one of these escapes the argument.
// -------------------------------------------------------------------------

export const THE_TWO_CLAIMS = {
    theTest:
        'Saving the sect is necessary and it is not sufficient. To have a Step spent on you as an old servant you must have saved the institution AND your continued living must be of use to it, and the second term is the one that decides. The first only clears you to be considered.',
    theQuestionIsForwardLooking:
        'Because the sect is not settling accounts. It is asking what it gets for this, which is a question about the years ahead rather than the years behind, and gratitude is not an answer to it. Somebody who saved the institution forty years ago and has nothing further to offer does not get one. The debt is real, it is acknowledged, everybody agrees it exists, and it does not move the object.',
    itIsNotThatServiceGoesUnrewarded:
        'First, the thing this is not. Sects reward service generously, reliably, and at real cost to themselves, and they look after the families of the people who gave it - see `WHAT_SERVICE_ACTUALLY_BUYS`. What is being argued over here is one category of object that cannot be replaced at any price, and the argument would be exactly the same if everybody in the room adored the claimant, which they frequently do.',
    theEldersKnowThis:
        'And this is the part that matters most: they are not deceived. Nobody senior is waiting in hope, nobody is owed an illusion, and nobody has to have it explained to them. They understand that they are being assessed on what remains rather than on what they did, they know precisely the difference between what a sect can give and what it cannot, and they are not bitter about a supply problem. Most of them hold that the assessment is the correct one for the sect to make. Being on the wrong side of a judgement you agree with is a specific and quiet kind of hard.',
    soMostOfThemDie:
        'Which should be stated plainly, because it is the ordinary outcome. The Step spent on an elder is rare even among the deserving - rarer than the founding acts that would qualify somebody for it. Most people who have earned it die at their realm on schedule, the sect grieves properly, and nobody opens the box. That is not a failure of the institution. It is the institution working as everybody inside it expects.',
    bothClaimsAreForwardLooking:
        'Which makes the argument worse rather than better. It is not debt against potential: it is two estimates of future value, in the same units, directly comparable - and the old one is nearly always lower. A young cultivator who reaches Perfection in forty years and takes a clean crossing will serve for centuries at a ceiling nobody can see the top of. An elder given the same object arrives on a poor foundation, stalls there permanently, and buys the sect a known quantity of a known thing. The comparison is honest and it almost always comes out the same way, and everyone in the room can do the arithmetic.',
    theOneWhoWasKept: {
        who: 'Elder Ji Wanru of the Azure Cloud Pavilion, formation master, who took a lower Step ninety years ago at Nascent Soul Perfection and is now the only person in the sect who has ever held the compound at nine lit nodes.',
        theReason:
            'Entirely instrumental and stated as such at the time. The Pavilion inherited a network of forty-one nodes, can light nine, and has failed for sixty years to train anybody who can hold that many at once. Spending the Step bought two thousand years of the one person who can, against a training problem the sect has not solved and may not solve. Nobody described it as an honour.',
        sheKnowsIt:
            'Completely, and says so without bitterness when asked, which is rarely. She was not honoured and she was not thanked. She was kept, the way a sect keeps anything it cannot replace, and she has spent ninety years being the reason the lights are on and knowing exactly why she is still here.',
        theCost:
            'She stalled at Deity Transformation Early the year she took it and has not moved since, which everybody expected. A Sword Elder seat was not offered and she did not ask for one; the Pavilion pays what it owes in stipend and in access and has never pretended the arrangement was anything else.'
    },
    theOneWhoWasRefused: {
        who: 'A Sword Elder who held the lower gate through the second Crimson Abyss incursion and lost the use of an arm doing it, and who was refused sixty years later.',
        theReasoning:
            'Unanimous, correct on the instrument, and delivered to her face by people who had all been in the hall she saved. She had cleared the threshold and there was nothing further she could offer: the arm was gone, the seat was ceremonial by then, and the Pavilion could not name a single thing her next two thousand years would produce that its next two thousand years needed.',
        whatSheWasGivenInstead:
            'Everything else the Pavilion had, and none of it grudgingly. A Sword Elder seat and the stipend that goes with it, a cave on the gorge vein, access to two arts the sect does not teach at that rank, the sword name, and an undertaking on her family that the Pavilion has honoured for four generations without anybody having to ask: her people were taken in, placed, schooled and kept, and two of them who cannot cultivate at all still hold posts on the terraces. She was not refused. She was refused one object.',
        theGrievance:
            'And this is the shape it actually takes, which is not what anybody assumes. Her people do not say she was ungratefully treated - they know exactly what the Pavilion gave and are still living on some of it. They say the Pavilion was right, and they have never forgiven it. Watching an institution correctly conclude that the rest of your life is not worth the one thing it cannot replace, while it hands you everything it can, and having no argument against any of it, is far more corrosive than an injustice would be. An injustice can be disputed. This can only be agreed with.',
        howLongItHasLasted:
            'Four generations. Her line is still at the Pavilion, still serves, still takes the stipend and the schooling because refusing those would be a gesture at the wrong people - and has declined every seat offered to it since, always politely, always with a reason that is not the reason. They are turning down real generosity, repeatedly, over a century, from an institution that keeps offering in good faith and has long since forgotten why the offers are refused.'
    },
    theOnesWhoDoNotAsk:
        'Which is why the good ones do not raise it. They can do the arithmetic themselves and they know the answer before anybody else in the room does. One of them declined to raise it at all, deliberately, and died at Nascent Soul Perfection with the sect holding an object it might well have spent on her. The hall found out afterwards, from somebody she had told and asked to stay quiet until it no longer mattered. Nobody at the Pavilion has been able to say what that did to the argument, and it has been running for sixty years since without anybody proposing a rule.',
    rivalsReadIt:
        'And the decision is legible from outside either way. A sect that spends an irreplaceable object to keep one functioning specialist alive has told everybody what it cannot replace, which is a useful thing for a rival to know. A sect that refuses has told them something else, equally useful. There is no way to make this decision privately.',
    itKeysToUnitOfValue:
        'How a given institution runs the argument is predictable from what it counts - see `unitOfValue` in `faction-character.ts`, which is doing more work here than anywhere else in the catalog. The Azure Cloud Pavilion keeps no ledger of favours and an exact mental account of who stood up, so its version is conducted from memory by people who remember it differently and cannot produce a document, and takes sixty years. The Ninefold Ledger prices every obligation with a term attached, would answer the same question in an afternoon by reading the entry aloud, and finds the Pavilion argument mildly embarrassing to watch.',
    howToRunIt:
        'Put both claimants in the room and give neither of them a flaw. The scene is not who deserves it - both of them do, and the deserving is not what is being measured. It is an institution deciding in public what it expects to need, permanently, in front of everybody who will have to live with the answer.'
} as const;

// -------------------------------------------------------------------------
// ONCE IN A LIFE
// Both objects. No stacking, no repeating, no second attempt.
// -------------------------------------------------------------------------

export const ONCE_IN_A_LIFE = {
    theRule:
        'One Unearned Step per person, ever. One Second Dealing per person, ever. They do not stack, cannot be repeated, and a second one of either does nothing at all to somebody who has already taken one - it is simply consumed against a body that will not take it twice.',
    whyItMattersForTheStep:
        'Because it converts merit into timing. Whatever crossing somebody spends their one Step on is the only one they will ever be given, so a cultivator carried across an early boundary can never be carried across a later one - and somebody who took theirs below Perfection to buy years has also used it up. Nothing here is wasted and everything here is final, which is a harder thing to reason about than waste.',
    whyItBitesHardestOnTheLowerDealing:
        'And it lands hardest on the grade that looked safest. A five-root taken to a three by a lower Dealing has spent their one use: a second lower Dealing will not take them from a three to a two, ever, and no accumulation of lower-grade objects walks anybody down the ladder of roots. Reliable and bounded now means permanently bounded, at whatever the first one happened to produce, and the difference between a three and a two is a career.',
    theHardestVersion:
        'The cruellest case is a five-root who receives a lower Dealing and lands on a three, and then, decades later, stands in a room with the middle-grade one - which would have taken them to a one or a two straight from five, and which will now do nothing for them at all. That situation is possible in this world today, and one of the four institutions that hold these objects would recognise it immediately.',
    whatItProtects:
        'It stops the objects from being an accumulation strategy. No sect can assemble a champion by stacking gifts; the most any one person can ever receive from this entire category is one rung and one root, and everything else they become they have to build.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// WHO HOLDS THEM
// Counts are exact, small, and known to the people who hold them.
// ─────────────────────────────────────────────────────────────────────────

export const IMMORTAL_HOLDINGS: readonly Holding[] = [
    // ── the Azure Cloud Pavilion: the deepest stock in the world ───────
    // Most of anything, all of it lower grade, and rising. There is somebody
    // to convince, and what she sends arrives faster than the Pavilion can
    // find people to spend it on.
    {
        factionId: 'sect-azure-cloud-pavilion',
        itemId: 'immortal-unearned-step',
        count: 7,
        byGrade: { higher: 0, middle: 0, lower: 7 },
        countIsKnownTo:
            'The Pavilion Master, the four Sword Elders, and the grant book, which records the number openly and has been revised upward four times in a hundred years. It is seven. The Pavilion does not treat the count as a secret and never has.',
        releaseMode: 'written_instruction',
        decidedBy:
            'The Pavilion Master, with four Sword Elders consenting in the same room - the same instrument that governs drawing the Standing Edge, which is not a coincidence and is how Ru Anjing wrote it.',
        anyoneMayRefuse: false,
        sufficientReason:
            'Ru Anjing left instructions rather than a prohibition, and they are specific: one goes to a cultivator who has done the accumulation and is being stopped by something outside their control. A documented injury that will not close. A bottleneck the Pavilion physicians have recorded over years. A lifespan that will run out before the road does. Ambition is not a reason. Usefulness to the Pavilion is explicitly not a reason, and she wrote that part twice.',
        costOfSayingYes:
            'Less than it used to, and this is the change nobody outside has priced. Seven becomes six, and six will very probably be seven again inside a decade. The Master who authorises it is still named in the grant book beside the entry, permanently - but the entry that used to read as spending the sect down now reads as spending an income, and two Sword Elders have said so out loud.',
        theForm: null,
        recordedRefusal: null,
        savingTheSect: null
    },
    {
        factionId: 'sect-azure-cloud-pavilion',
        itemId: 'immortal-second-dealing',
        count: 2,
        byGrade: { higher: 0, middle: 0, lower: 2 },
        countIsKnownTo:
            'The Pavilion Master and the four Sword Elders know it is two. The grant book records these separately from the pills and in less detail, which is the only thing about the Pavilion holdings that could be called cautious.',
        releaseMode: 'written_instruction',
        decidedBy:
            'The Pavilion Master with four Sword Elders, exactly as with the pills, and the instructions do not distinguish the two objects because Ru Anjing had never held one of these and wrote nothing specific about them.',
        anyoneMayRefuse: false,
        sufficientReason:
            'Undecided, which is a real institutional problem rather than a mystery. The instructions cover a cultivator stopped by something outside their control, and a muddled root is exactly that - so the Pavilion has been arguing for forty years about whether a root is a circumstance or a person, and has not given one away while the argument continues.',
        costOfSayingYes:
            'Two becomes one, against a flow that has never yet produced a second one of these in the same decade. The pills arrive often enough to be treated as income; these do not, and everybody senior is quietly aware that the sister may simply never manage another.',
        theForm: null,
        recordedRefusal: null,
        savingTheSect: null
    },

    // ── the Deep Survey: a line item, minuted, with a form ─────────────
    {
        factionId: 'apex-deep-survey',
        itemId: 'immortal-unearned-step',
        count: 3,
        byGrade: { higher: 1, middle: 1, lower: 1 },
        countIsKnownTo:
            'The four Surveyors, the standing stock register, and the annual minute that confirms the register. It is three, and the register states the grade of each: one higher, one middle, one lower. It has read that way for a hundred and forty years, and the higher one is the only object of its kind anybody in the world can point to.',
        releaseMode: 'collective_consent',
        decidedBy:
            'All four Surveyors, unanimously, against a minuted request. There is no office above them to appeal to and no post that can act alone: a Surveyor who wants one released is one voice of four, and the other three can refuse without giving a reason and have.',
        anyoneMayRefuse: true,
        sufficientReason:
            'The register describes the stock as unreorderable and the standing instruction is that it is spent only where the arterial system itself is at stake. Nothing about individual merit enters it. A cultivator of enormous promise is not a reason under the instruction, and the Survey does not consider that harsh so much as simply not what the line item is for.',
        costOfSayingYes:
            'Three becomes two, permanently, in a register that has never once been revised upward. Every Surveyor who consents is minuted by name, and the minute outlives them. There is no institution above to authorise it and therefore nobody to share the entry with - and if the object released were the higher one, the Survey would be spending the only one of its kind in existence.',
        theForm:
            'A Requisition Against Standing Stock, which exists, has a number, and requires the applicant to state what is at stake in terms of the arterial system rather than in terms of themselves. It has been submitted eleven times in four hundred years. It has been granted once, in a year the Survey does not discuss, and refused ten times, and the refusals are filed with the same care as the grant.',
        recordedRefusal: {
            yearsAgo: 140,
            theCase:
                'A formation master relit a node at the Root Sill that had been dark for six years, alone, over a winter, at a cost to herself the Kiln Wardens recorded in detail. It is the only instance in the outside record of anybody doing that court a service it could not do itself, and she filed the requisition for a disciple rather than for herself.',
            refusedBy:
                'Two of the four Surveyors, in writing, on the ground that a service to a court is not a matter touching the arterial system. The other two consented and it made no difference, because the instrument requires all four.',
            afterwards:
                'She accepted, took what the Wardens offered instead - passage and water, which they consider serious things - and the disciple she had filed for never advanced past Core Formation.',
            probablyRight:
                'On the instruction as written they were correct, and nobody has ever shown otherwise: the stock is for the arterial system, her service was to a court, and the distinction is exactly the sort of thing a register exists to hold. It also meant that the only outsider who ever did the Survey a real favour was told no on a technicality.',
            costAnyway:
                'The Wardens acknowledged the debt in writing themselves, in numbers, and are still honouring it a hundred and forty years later in small ways nobody has totalled - her line has never been refused passage, water, shelter or a warning. The Survey saved a line item and its own court has been paying the bill by instalments ever since.'
        },
        savingTheSect:
            'Saving the Survey does not buy one and no Surveyor will pretend otherwise. What it does is remove the argument the instruction rests on: if the arterial system itself was at stake and an outsider is the reason it held, then refusing them is indefensible to at least two of the four. Two is not four. It is entirely possible to save the Deep Survey, be minuted for it permanently, and be refused by one Surveyor who does not give a reason, and a player standing in that outcome has been treated honestly.'
    },
    {
        factionId: 'apex-deep-survey',
        itemId: 'immortal-second-dealing',
        count: 1,
        byGrade: { higher: 0, middle: 1, lower: 0 },
        countIsKnownTo:
            'The four Surveyors and the standing stock register, where it is a single line annotated only with the grade. It is one, and it is a middle: it will clean a root rather than rewrite one, which the Survey knows and has never seen a reason to say.',
        releaseMode: 'collective_consent',
        decidedBy:
            'All four Surveyors, unanimously, and no requisition against this line has ever been submitted - not refused, submitted. The form permits it and nobody has ever filled it in.',
        anyoneMayRefuse: true,
        sufficientReason:
            'None is stated anywhere, and the absence is deliberate: the register describes the item and does not describe a circumstance for it. The Survey administers a world in which talent is dealt once and every arrangement it operates assumes so, which makes the line item an instrument for undoing one of its own foundations, and no Surveyor has ever wanted to be the one who raised it.',
        costOfSayingYes:
            'One becomes none, for the world rather than for the Survey, and there is no prospect of another. Whichever Surveyor moved it would be proposing to end a category of thing, in a minute, with their name on it, in a register that is read by their successors.',
        theForm:
            'The same Requisition Against Standing Stock, which does not distinguish between the two line items and therefore permits an application nobody has made. Clerks are taught the form as a single procedure and most have never noticed that the second line exists.',
        recordedRefusal: null,
        savingTheSect:
            'Not connected. Saving the arterial system makes refusal indefensible on the pill and does not reach this line at all, and a petitioner who has just done the Survey an enormous service and asks for the talisman instead has, in the view of all four Surveyors, misunderstood what they are standing in front of.'
    },

    // ── the Long Cut: receipted, scheduled, and slower than a life ─────
    {
        factionId: 'apex-long-cut',
        itemId: 'immortal-unearned-step',
        count: 3,
        byGrade: { higher: 0, middle: 2, lower: 1 },
        countIsKnownTo:
            'The Course Keepers, and the schedule, where the three appear as entries with no dates against them and their grades stated. It is three: two middle and one lower, everybody senior knows the number, and the entries are read aloud at every schedule revision.',
        releaseMode: 'collective_consent',
        decidedBy:
            'The Course Keepers together, unanimously, at a schedule revision rather than on request - which means the body that would decide is not assembled when anybody asks and cannot be assembled early. A petition arriving between revisions is receipted, logged, and waits.',
        anyoneMayRefuse: true,
        sufficientReason:
            'Nothing in the schedule provides for it. The Long Cut administers driven ground on a horizon measured in centuries and treats a human career as a rounding error, so a case that turns on one person having very little time is not a case the instrument can read at all.',
        costOfSayingYes:
            'Three becomes two, and the Long Cut is the holder least able to justify any of it: it owns every act by name, has no vassal to attribute anything to, and would have to minute the decision as its own. The administration is legalistic precisely because it cannot deflect, and this is among the largest things it could do without being able to deflect.',
        theForm:
            'A schedule amendment, receipted on submission and answered at the next revision, which is up to twenty years away. Three have been submitted. All three were answered with the original entry restated and no reasoning, which is the standard form of a refusal here and is not intended as contempt.',
        recordedRefusal: {
            yearsAgo: 60,
            theCase:
                'A Weir Office warden submitted an amendment for a carver at Standing Cut who had held a collapsing face alone for nine days while a crew got out, and whose lungs were finished by it. The Office backed the submission, which it had never done before and has not since, and attached the crew rolls as evidence.',
            refusedBy:
                'The Course Keepers at the following revision, four years later, by restating the entry. No reasoning was given, because the form does not require one and the administration does not volunteer.',
            afterwards:
                'The carver died of dust-lung two years before the revision was held. The Office was notified of the refusal in the ordinary way and filed it.',
            probablyRight:
                'By its own instrument it was correct, and the instrument is what makes the Long Cut governable at all: a body administering five provinces on forty staff cannot start reading cases on their merits without ceasing to be able to administer anything. The cost of that consistency was that the only person the Weir Office ever asked for was dead before the question was heard.',
            costAnyway:
                'The Weir Office has never submitted another amendment of any kind, on any subject, in sixty years - not out of protest, which it would consider improper, but because it now regards the instrument as something that does not answer. An administration that stops being petitioned by its own bureau has lost something it cannot measure and has no line for.'
        },
        savingTheSect:
            'The same body, the same revision cycle, and the same answer in every recorded instance: a receipt, and the entry restated. If the driven ground itself was at stake and an outsider is why it held, refusing at the next revision becomes indefensible to most of the Keepers - and the revision is still up to twenty years away, and one Keeper can still hold out, and nobody will explain.'
    },
    {
        factionId: 'apex-long-cut',
        itemId: 'immortal-second-dealing',
        count: 1,
        byGrade: { higher: 1, middle: 0, lower: 0 },
        countIsKnownTo:
            'The Course Keepers. Outside the administration it is not known at all, and the Deep Survey does not know the Long Cut holds the only higher-grade one in existence, which is the single largest gap in either register.',
        releaseMode: 'collective_consent',
        decidedBy:
            'The Course Keepers together, unanimously, at a revision, exactly as with the pill - the Long Cut draws no procedural distinction between the two objects, which outsiders find either admirable or alarming depending on what they came for.',
        anyoneMayRefuse: true,
        sufficientReason:
            'Never described and never petitioned for. It sits on the schedule as an entry with no date, and every Keeper for three centuries has read it aloud at revisions without any of them proposing anything about it.',
        costOfSayingYes:
            'It would end the higher grade entirely: there is one, this is it, and there is no prospect of another from an ancestor who answers at intervals measured in ages. Minuted, by name, in an administration that owns every act it takes. Nobody has been willing to be the Keeper whose name is against that line.',
        theForm:
            'The same schedule amendment, which does not distinguish the two entries and has never been submitted against this one. The Keepers are aware that it could be, and have never discussed what they would do.',
        recordedRefusal: null,
        savingTheSect:
            'The Long Cut has never connected the two and would regard the connection as a category error. The most a petitioner has ever received on this line is a receipt confirming that their submission was received, which is accurate and is all it says.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// ENGINE GAPS
// Declared, not invented. Neither effect can be resolved by anything that
// exists today, and this file deliberately does not attempt a mechanic.
// ─────────────────────────────────────────────────────────────────────────

export const ENGINE_GAPS: readonly {
    effect: ImmortalItemEffect;
    missing: string;
    blockedBy?: string;
    /** What the effect must do, stated precisely enough to be wired. */
    contract: readonly string[];
    note: string;
}[] = [
    {
        effect: 'promote_realm',
        missing: 'There is no `PillEffect` for advancing a rank. The closest is `advance_progress`, which adds cultivation progress toward the next rank and is not the same thing: progress still has to be spent through a breakthrough attempt that can fail, and the whole point of this object is that it does not.',
        blockedBy: 'Nothing, as it turns out, and this is worth stating because it used to be the objection. `MAX_RANKS_PER_TURN = 1` in `src/schema/cultivation.ts` caps advancement at one rank per turn, and the Step grants exactly one rank - so the cap and the object agree rather than collide. What is missing is the effect, not room for it.',
        contract: [
            'It crosses exactly one realm boundary and delivers the recipient to the Early rung of the next realm. It never grants a within-realm rung and never grants two.',
            'Grade caps the destination realm, not the distance: lower may deliver no higher than Deity Transformation (top crossing 24 to 25), middle no higher than Void Refinement (28 to 29), higher no higher than Grand Ascension (36 to 37).',
            'Ordinal 41 and above is unreachable by this or any object, for anybody, always. Hard stop, not a modifier.',
            'Once per cultivator for life. A second Step is consumed and does nothing.',
            'Perfection of the current realm is the clean case and is not a requirement. Taken below Perfection it still crosses, and the skipped accumulation lands as a permanently poor `foundationQuality` on the far side.'
        ],
        note: 'The remaining engine decision is what the Price of Advancement does about a boundary crossed without accumulation. Content has answered the social half - they stall, visibly, for the rest of a much longer life - and deliberately not the arithmetic.'
    },
    {
        effect: 'change_spirit_root',
        missing: 'There is no `PillEffect` for it and there is no field-level path to it either. `CultivatorSchema.spiritRoot` is documented as rolled once, permanent and never editable after creation, and `spirit-roots.ts` states in its header that there is no respec, no reroll and no item that changes it.',
        blockedBy: 'The permanence is not merely a comment: cultivation rate, deviation risk, matched-technique bonus and technique availability are all derived from the root, so a change is a recalculation of a run rather than a field write.',
        contract: [
            'lower: five to four or three; four or three to two. Never better than two, and never a single root, by any route.',
            'middle: five straight to one or two, decided by luck at use time and by nothing else. No input influences which.',
            'higher: grants a single mutated root outright.',
            'Once per cultivator for life, at every grade. A five-root taken to a three by a lower one can never be improved again by anything.'
        ],
        note: 'Deliberately left unresolvable. If this is ever implemented it should be an engine ceremony with its own audit record, not a mutation - and the catalog should not be the place that decided how it works.'
    }
];

// -------------------------------------------------------------------------
// STOCK VERSUS FLOW
// The axis the four apexes actually turn on, and it is not age.
// -------------------------------------------------------------------------

export const STOCK_VERSUS_FLOW = {
    theDistinction:
        'There are two positions in this world and only one institution holds the second. Stock is what you have on the shelf, and stock only ever goes down. Flow is somebody sending, now, repeatedly. Every other holder in the catalog is living off stock with no expectation of resupply; the Azure Cloud Pavilion has an income.',
    whyFlowIsSoRare:
        'Because flow needs a benefactor who both answers often and still remembers that answering matters, and that means a recent crossing with a living tie. There is one of those in the world. Every other line upward runs to somebody who crossed millennia ago, answers at intervals measured in ages, and can no longer feel what a request costs the people making it - see `THE_DECAY_OF_MEMORY` in `named-figures.ts`.',
    theTwoAxesDoNotAlign: [
        'The old lines - the Hollow Court, the Deep Survey, the Long Cut - hold a proper pyramid: one higher apiece where they have one at all, a little middle, more lower, and most of what they were ever sent long since spent. Quality without flow.',
        'The Azure Cloud Pavilion holds more objects than anybody else in the world and not one of them above lower grade. Flow without quality.'
    ],
    whyAzureCloudIsAllLower:
        'And that is the decay rule running in the other direction, which is the part worth stating plainly. Ru Anjing answers often and sends often because she is new. Lower grade is what a new immortal can reach. The same three hundred and eighty years that make her generous make her limited, and there is no version of the Pavilion position where the flow is large and the grade is high, because the two properties have one cause.',
    theHardConsequence:
        'So the Pavilion can never put anybody past Deity Transformation with medicine. A lower Step tops out at ordinal 28 and 28 is the ceiling of everything the Pavilion will ever hold. The Deep Survey, which is poor in this currency, holds one higher Step that could deliver somebody to Grand Ascension at 37. Abundance buys breadth. Poverty, in exactly one case, bought height.',
    theyAreDifferentBetsAndOneIsBetter:
        'These are different bets and for most purposes there is no exchange rate between them. On the one question that actually matters there is, and it does not favour the shelf everybody envies.',
    theArgument: [
        'The last realm cannot be bought by anybody. Nothing delivers past Grand Ascension Perfection, and 41 upward is climbed unaided by everyone who has ever done it. That is fixed and universal - see `THE_LAST_REALM_IS_UNBUYABLE`.',
        'So height purchased is spent on the part of the ladder that was never the constraint. A higher Step puts exactly one person at 37, and that person then faces the unbuyable stretch alone. If they do not have whatever it takes, the object is gone and there is no second candidate.',
        'Width is therefore the rational purchase. Seven people carried across the first hard boundary is seven independent chances that one of them turns out to be somebody who can make the last climb without help.',
        'And the conjunction at the top is multiplicative and brutal: talent, affinity, luck, time, a protector, and forty centuries of not dying. Nothing anybody can buy moves any of those terms. The only lever in the world is the number of candidates standing at the bottom of the climb.'
    ],
    soTheStatisticalBetIsCorrect:
        'Against an unbuyable summit the statistical bet beats the singular one, and it is not close. The Azure Cloud Pavilion is not the poor cousin holding the wrong currency. It is the institution that worked out what the currency is for.',
    thePavilionPlanIsWide:
        'Which fixes what the Pavilion attempts, and it is chosen rather than settled for. Seven crossings at 24 to 25, if it can manufacture seven people who qualify, and nothing above that ever - see `AZURE_CLOUD_INTAKE` in `hierarchy.ts`. A sect hunting one extraordinary talent would run a different programme. The Pavilion is running the wide one on purpose.',
    theyAreDoingItOnPurpose:
        'And they know. Somebody at the Pavilion articulated this - the Sword Elder who worked out the decay clock, in the same decade and from the same reasoning - and the hall has been organised around it since: test mortals, carry the best of them through probation, produce as many people at Nascent Soul Perfection as the sect can feed, and spend a lower Step on every one of them who gets there. Every part of the Pavilion behaviour serves that plan. The probation programme is its front end, the outward placement of objects is the same instinct applied to allies, and the refusal to hoard is a policy rather than a temperament.',
    itIsALongBet:
        'The admirable part is that nobody now living will see it resolve. Seven crossings at 24 to 25, over decades, feeding a climb that takes millennia and that the Pavilion cannot assist past 28 in any case. They are spending everything they have on raising the odds for somebody who has not been born, in an institution that will not know whether it worked. That is not cleverness. It is an institution behaving as though the future is real.',
    whoElseHasWorkedItOut:
        'The Deep Survey has, exactly and independently, and can do nothing about it - which is the sharpest position of the four. Its register holds one higher Step, one middle and one lower, and there is no operation in the world that converts a higher into six lowers. It understands the argument perfectly, agrees with it, and holds the wrong inventory to act on it, which the four Surveyors have discussed once and minuted in a single line. The Long Cut has not raised the question, because a body that treats a human career as a rounding error has no instrument that could read the argument. The Hollow Court does not need to: it is the thing at the top of the funnel that everybody else is trying to produce.'
} as const;

// -------------------------------------------------------------------------
// WHY THE OLD LINES RECEIVED MORE, AND HELD LESS
// -------------------------------------------------------------------------

export const THE_SENDING_PYRAMID = {
    olderBenefactorsSendLowersEasily:
        'A faction whose founder crossed long ago has a benefactor who is well established up there, and for such a one a lower-grade object is trivial to send. So the old lines received a great many lowers across their history - more than the Azure Cloud Pavilion has ever seen - and received them at intervals measured in centuries rather than decades.',
    andSpentThem:
        'Which is the half that matters. Their shelves are thin now not because nothing ever came, but because a great deal came and was used over two thousand years, at a rate of roughly one a century, by people who each thought they were spending it well and mostly were. A long list of receipts and a nearly empty shelf is the normal condition of an old institution, and it should not read as decline.',
    thePyramid:
        'The distribution is a pyramid everywhere it is measured: in what gets sent, in what is held now, and in what any given faction has ever seen in its whole history. Many lower, fewer middle, and higher grade vanishingly rare outside the apexes and mostly absent inside them too. There are two higher-grade objects in the entire world.',
    theOrdinaryFactionShape:
        'So the ordinary faction shape is: a handful of lowers received across centuries, perhaps one middle in the whole record, no higher ever, and almost all of it spent. Anything richer than that needs a reason written down.',
    whoNeverReceivedAnything:
        'And a great many factions have never received anything at all, ever, which the catalog states rather than leaves implied. A receipt requires a line: somebody up there who is yours. The Standing Grove, the Sixmile Wardens, the Hollow Bell Wanderers, the Bone Lantern Cult, the Severed, the Clear River Alliance and every Dao house have no crossed ancestor and no parent that has one, and consequently no history of receipts whatever. For them these objects are a rumour about other people.'
} as const;

// -------------------------------------------------------------------------
// WHAT THE REGISTERS CAN ACTUALLY COUNT
// -------------------------------------------------------------------------

export const REGISTERS_COUNT_WHAT_THEY_CAN_SEE = {
    theCaveat:
        '`knownCount` is a knowledge claim rather than a census. It is what the Anchorhold survey standard and the Deep Survey register can between them point at, and both are honest about the limit: thirteen Steps and four Dealings are what the world can name, not what the world contains.',
    soItIsAFloor:
        'The true figure is at least that and probably a little higher, and the two parties most likely to hold something uncounted are exactly the ones the registers cannot reach: an institution that will not discuss its shelf, and an institution that keeps no accounts of any kind.',
    andEverKnownIsToo:
        'The same applies to `everKnown`. Twenty-four Steps and seven Dealings is what the record can trace, and the record is a Standing Works inheritance with four thousand years of gaps in it. Nobody who works with these figures treats them as complete, and nobody has a better method.'
} as const;

// -------------------------------------------------------------------------
// RECEIPT HISTORIES
// What each line received across its whole history, what it did with it, and
// how that decision reads now to people who were not there.
// -------------------------------------------------------------------------

export const ReceiptHistorySchema = z.object({
    factionId: z.string(),
    /** Which object. A faction may have a separate history for each. */
    itemId: z.string(),
    /** Which crossed ancestor the receipts came through. */
    throughLine: z.string().min(20),
    /** Everything ever received, by grade, across the whole history. */
    everReceived: GradeCountsSchema,
    /** What is on the shelf now, and whether the registers know about it. */
    stillHeld: GradeCountsSchema,
    countedByTheRegisters: z.boolean(),
    /** What the spent ones went on. */
    spentOn: z.string().min(150),
    /** How the decision reads now, to people who were not in the room. */
    judgedInHindsight: z.string().min(150)
});
export type ReceiptHistory = z.infer<typeof ReceiptHistorySchema>;

export const RECEIPT_HISTORIES: readonly ReceiptHistory[] = [
    // -- spent well, and it is why they are what they are --------------
    {
        factionId: 'sect-storm-tyrant-court',
        itemId: 'immortal-unearned-step',
        throughLine: 'The First Tyrant, styled the Standing Storm, who crossed three and a half thousand years ago and has answered four times since.',
        everReceived: { higher: 0, middle: 1, lower: 4 },
        stillHeld: { higher: 0, middle: 0, lower: 0 },
        countedByTheRegisters: true,
        spentOn:
            'Curriculum holders, every time, on a rule the Court has never once broken: an object goes to whoever is currently carrying the lightning curriculum and to nobody else. Four lowers across thirty-five centuries and one middle eleven hundred years ago, each spent on a Storm Elder standing at Perfection who was going to die at the boundary, and each of whom went on teaching for another two thousand years.',
        judgedInHindsight:
            'The best-spent stock in the world and nobody disputes it, including the people who hate them. The only working lightning curriculum in existence is there because five cultivators who would have died at a boundary went on teaching instead, and the Court at ordinal 36 is the compounded result of a rule somebody wrote in the first century and every successor had the discipline to keep. It is also why the Court collects rather than recruits: it has nothing left to spend and knows exactly what it cost to get here.'
    },
    {
        factionId: 'sect-storm-tyrant-court',
        itemId: 'immortal-second-dealing',
        throughLine: 'The same line, which sent one talisman in thirty-five centuries and nothing like it since.',
        everReceived: { higher: 0, middle: 0, lower: 1 },
        stillHeld: { higher: 0, middle: 0, lower: 0 },
        countedByTheRegisters: true,
        spentOn:
            'A lower Second Dealing, sixteen hundred years ago, on a five-root child of the Tyrant house who was carrying a name the Court needed carried. It narrowed her to a three. She was never anything remarkable and she held the seat for four hundred years, which was the entire purpose.',
        judgedInHindsight:
            'Regarded internally as sound and externally as revealing: the Court spent an irreplaceable object on succession rather than on strength, which tells you what the Storm Tyrant Court is actually organised around. The Ninefold Ledger, which audited it, has never said so out loud and has the file.'
    },
    // -- spent badly, and everybody knows ------------------------------
    {
        factionId: 'sect-thousand-treasure-pavilion',
        itemId: 'immortal-unearned-step',
        throughLine: 'Wei Zhaoyin, the Ascended Steward, whose claim the Pavilion bought at an estate sale and which at most one of two bodies holds correctly.',
        everReceived: { higher: 0, middle: 0, lower: 1 },
        stillHeld: { higher: 0, middle: 0, lower: 0 },
        countedByTheRegisters: true,
        spentOn:
            'One lower Step, four hundred years ago, on a Grand Steward of thirty-one who was the finest appraiser anybody had seen and was nowhere near Perfection at the time. He took it early, on the argument that the Pavilion could not afford to wait, arrived on a poor foundation, stalled where he landed, and eleven years later accepted the Crimson Abyss Hall offer and left, taking the client book with him.',
        judgedInHindsight:
            'Discussed on the floor to this day, in front of customers, as shorthand for a bad decision. The Pavilion spent the only object it will ever receive on somebody who was neither at the boundary nor loyal, and the two errors compound: had he been made to wait he might have been worth it, and had he been worth it he might not have left. Nobody involved is alive. The story has hardened into a rule the Pavilion states as though it were ancient - never spend on somebody who has not finished - which is correct, and was learned in the most expensive way available.'
    },
    // -- one left, and forty-one years of not deciding ------------------
    {
        factionId: 'sect-nine-peaks-ascetic-order',
        itemId: 'immortal-unearned-step',
        throughLine: 'The Deep Survey line, through the Third Sill court, which passed objects down to its clients three times in the history of the Order and has not since.',
        everReceived: { higher: 0, middle: 0, lower: 3 },
        stillHeld: { higher: 0, middle: 0, lower: 1 },
        countedByTheRegisters: false,
        spentOn:
            'Two lowers, six and nine centuries ago, both on ascetics standing at Nascent Soul Perfection who had carried the same stone for two hundred years. Both clean crossings, both uncontroversial then and since.',
        judgedInHindsight:
            'The two spends are not the interesting part. The third object is: the Order has held one lower Step for forty-one years without agreeing on a recipient. The Peak Wardens want it spent on somebody who works the vein; the Mountain Elders hold that no candidate has appeared. The argument has the exact shape of a held question - see `HELD_QUESTIONS` in `named-figures.ts` - the Order does not discuss it beyond the peaks, the registers do not count it, and two of the four ascetics who would have qualified have died while the discussion continued.'
    },
    // -- does not know what it has -------------------------------------
    {
        factionId: 'sect-sweptground-temple',
        itemId: 'immortal-unearned-step',
        throughLine: 'The First Abbot, who crossed twenty-three centuries ago off swept ground, whose name the Temple never recorded and whose claim nobody believes.',
        everReceived: { higher: 0, middle: 0, lower: 2 },
        stillHeld: { higher: 0, middle: 0, lower: 0 },
        countedByTheRegisters: true,
        spentOn:
            'Unrecorded by the Temple and reconstructed entirely from outside. The Ninefold Ledger holds two lineage audits, six hundred years apart, each opened because a Sweptground monk advanced in a way that did not add up and each closed without a finding. The Ledger is confident about the count and has no idea who authorised either.',
        judgedInHindsight:
            'Nobody can judge it, because nobody can say who received them or why. What is not in dispute is that a temple which takes in beggars and muddled roots put two irreplaceable objects into two people it never named, and the province - which regards the place as a charity - has never once wondered what it does with what it is given.'
    },
    {
        factionId: 'sect-sweptground-temple',
        itemId: 'immortal-second-dealing',
        throughLine: 'The same line, which sent one talisman at an unknown date and has sent nothing since that anybody can establish.',
        everReceived: { higher: 0, middle: 1, lower: 0 },
        stillHeld: { higher: 0, middle: 1, lower: 0 },
        countedByTheRegisters: false,
        spentOn:
            'Nothing. It is still there, and this is the entry: the Temple keeps no accounts of any kind, has never inventoried anything, and the shelf has not been looked at by anybody currently alive.',
        judgedInHindsight:
            'It cannot be judged, which is the point. Somewhere in the Temple is a box nobody living has opened, holding a middle-grade Second Dealing received before any of the four current monks was born, and none of them could tell you it exists. This is `LOST_RECORDS` at its most literal. The poorest institution in the province is sitting on the single most valuable object outside the apexes, behind the ground rice - and would give it away inside the hour to whoever needed it, if only somebody would tell them it was there.'
    },
    // -- the ordinary shape --------------------------------------------
    {
        factionId: 'sect-verdant-spring-hall',
        itemId: 'immortal-unearned-step',
        throughLine: 'The Deep Survey line, through the Third Sill court and the Nine Peaks above it, which is two removes and shows in the volume.',
        everReceived: { higher: 0, middle: 0, lower: 1 },
        stillHeld: { higher: 0, middle: 0, lower: 0 },
        countedByTheRegisters: true,
        spentOn:
            'One lower Step, two hundred and twenty years ago, on a Life Elder standing at Nascent Soul Perfection who had run the springs for sixty years and was three years from dying at the boundary. A clean crossing, unanimously agreed. She practised for another eighty years and trained the physicians who trained the current ones.',
        judgedInHindsight:
            'Obviously correct inside the Hall and slightly disappointing outside it, because she was a hospital administrator rather than a prodigy and the province expected something more dramatic from the only object the Hall will ever receive. The position of the Hall, stated once and never repeated, was that she was the person who kept the doors open.'
    },
    {
        factionId: 'sect-frostmirror-court',
        itemId: 'immortal-second-dealing',
        throughLine: 'The Deep Survey line, through the Third Sill court, exactly once and never again.',
        everReceived: { higher: 0, middle: 0, lower: 1 },
        stillHeld: { higher: 0, middle: 0, lower: 0 },
        countedByTheRegisters: true,
        spentOn:
            'A lower Second Dealing, nine hundred years ago, which was the wrong object arriving at the wrong door. The Court needs mutated ice roots; a lower Dealing cannot produce a mutated root by any route, and what it does instead is narrow a bad root to a two, which is of no use whatever to an institution that admits one root in a hundred. It was spent on the steward who ran the hall - a five-root who could not have used the library if she had wanted to, and who was made merely bad instead of hopeless.',
        judgedInHindsight:
            'The Court records it without comment and considers the matter closed. Everybody else finds it quietly astonishing that the one institution in the world with an obvious use for a higher-grade Dealing received a lower one and spent it on an administrator. The answer of the Court, when anybody is rude enough to ask, is that no lower Dealing was ever going to make an ice cultivator out of anybody, and that the steward was cold enough already.'
    },
    {
        factionId: 'sect-cinnabar-crucible-guild',
        itemId: 'immortal-second-dealing',
        throughLine: 'The Deep Survey line, through the Third Sill court, which sent one object to the Guild and has sent nothing since.',
        everReceived: { higher: 0, middle: 1, lower: 0 },
        stillHeld: { higher: 0, middle: 0, lower: 0 },
        countedByTheRegisters: true,
        spentOn:
            'The middle Second Dealing spent nine hundred years ago, whose file the Ninefold Ledger still holds. The Guild gambled it on its most promising alchemist, a muddled five-root who leaned toward fire, expecting a single fire root. A middle Dealing goes to a one or a two on luck and nothing else. It produced a dual water and metal, which is a real and useful root and is close to useless at a furnace.',
        judgedInHindsight:
            'The object did exactly what it does. The Guild bet on the half of the outcome it wanted and lost, and the alchemist - who was not meaningfully consulted, and who became a perfectly successful formation contractor two provinces away - is the reason every institution that has held a middle Dealing since has declined to spend it. The Deep Survey has never submitted a requisition against its own, and its clerks are taught the form without ever being told why nobody uses it.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const ITEM_BY_ID: ReadonlyMap<string, ImmortalItem> = new Map(IMMORTAL_ITEMS.map(i => [i.id, i]));

const RECEIPTS_BY_FACTION: ReadonlyMap<string, ReceiptHistory> =
    new Map(RECEIPT_HISTORIES.map(r => [r.factionId, r]));

/** What this faction has ever received. Undefined means never anything. */
export function receiptsFor(factionId: string): ReceiptHistory | undefined {
    return RECEIPTS_BY_FACTION.get(factionId);
}

/** What the receipt histories account for as spent, by grade, for one item. */
export function spentAcrossHistories(itemId: string): GradeCounts {
    return RECEIPT_HISTORIES.filter(r => r.itemId === itemId).reduce<GradeCounts>((acc, r) => ({
        higher: acc.higher + (r.everReceived.higher - r.stillHeld.higher),
        middle: acc.middle + (r.everReceived.middle - r.stillHeld.middle),
        lower: acc.lower + (r.everReceived.lower - r.stillHeld.lower)
    }), { higher: 0, middle: 0, lower: 0 });
}

export function getImmortalItem(id: string): ImmortalItem | undefined {
    return ITEM_BY_ID.get(id);
}

/** Everything a faction holds, which for almost every faction is nothing. */
export function getHoldingsOf(factionId: string): Holding[] {
    return IMMORTAL_HOLDINGS.filter(h => h.factionId === factionId);
}

export function getHoldersOf(itemId: string): Holding[] {
    return IMMORTAL_HOLDINGS.filter(h => h.itemId === itemId);
}

/** The count in the world right now, summed from the holdings. */
export function worldCountOf(itemId: string): number {
    return getHoldersOf(itemId).reduce((sum, h) => sum + h.count, 0);
}

/** The same, broken out by grade, which is the comparison that matters. */
export function worldCountByGrade(itemId: string): GradeCounts {
    return getHoldersOf(itemId).reduce<GradeCounts>((acc, h) => ({
        higher: acc.higher + h.byGrade.higher,
        middle: acc.middle + h.byGrade.middle,
        lower: acc.lower + h.byGrade.lower
    }), { higher: 0, middle: 0, lower: 0 });
}

/** What a faction holds in total, across both medicines. */
export function totalHeldBy(factionId: string): GradeCounts & { total: number } {
    const counts = getHoldingsOf(factionId).reduce<GradeCounts>((acc, h) => ({
        higher: acc.higher + h.byGrade.higher,
        middle: acc.middle + h.byGrade.middle,
        lower: acc.lower + h.byGrade.lower
    }), { higher: 0, middle: 0, lower: 0 });
    return { ...counts, total: counts.higher + counts.middle + counts.lower };
}

/** The best grade a holder can reach for, which is not the same as depth. */
export function gradeCeilingOf(factionId: string): 'higher' | 'middle' | 'lower' | 'none' {
    const held = totalHeldBy(factionId);
    if (held.higher > 0) return 'higher';
    if (held.middle > 0) return 'middle';
    if (held.lower > 0) return 'lower';
    return 'none';
}

/**
 * Holders a petitioner could in principle persuade, as opposed to holders
 * where there is nobody with the authority to be persuaded.
 */
export function persuadableHolders(): Holding[] {
    return IMMORTAL_HOLDINGS.filter(h => h.releaseMode === 'written_instruction');
}

/** Every recorded instance of a good case being refused. */
export function recordedRefusals(): { holding: Holding; refusal: RecordedRefusal }[] {
    return IMMORTAL_HOLDINGS
        .filter(h => h.recordedRefusal !== null)
        .map(h => ({ holding: h, refusal: h.recordedRefusal as RecordedRefusal }));
}

export function getEngineGap(effect: ImmortalItemEffect): typeof ENGINE_GAPS[number] | undefined {
    return ENGINE_GAPS.find(g => g.effect === effect);
}
