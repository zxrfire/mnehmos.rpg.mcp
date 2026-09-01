/**
 * The medicine that mends a cracked cultivator, and the fixed set of it that
 * exists.
 *
 * ── WHAT THIS IS FOR, AND THE ONE THING IT IS FOR ────────────────────────
 *
 * A crossing can end five ways and exactly one of them is this table's market:
 * BROKEN SUCCESS. The cultivator got across, arrived at the new rung, and the
 * structure the crossing was supposed to build did not take. They are not a
 * failure - they are somebody who paid too much for a rung they actually
 * reached, and the road forward is shut behind them because the next thing
 * cannot be built on a broken version of the last one.
 *
 * That is the whole of what these four objects answer. Everything else that
 * comes out of a bad crossing is somebody else's medicine:
 *
 *   torn meridians, a scorched channel   ordinary pills, ordinary money.
 *                                        `pills.ts` has answered this since it
 *                                        was written and must go on answering
 *                                        it. Somebody who crossed CLEANLY and
 *                                        is merely hurt is not a customer here.
 *   a heart demon, a fixed premise       nothing in this file. A failure with
 *                                        sequelae leaves a person at their
 *                                        previous perfection carrying a mental
 *                                        wound; it does not crack them, and a
 *                                        structural repair has nothing to
 *                                        reach for.
 *   a ruined dantian, a severed meridian `wounds.ts` says plainly that nothing
 *                                        answers these, which is a deliberate
 *                                        answer rather than a gap.
 *
 * The gate in code is `BROKEN_STATUSES` in
 * `engine/cultivation/what-goes-wrong-at-a-realm-boundary.ts`. If a wound key
 * is not in that list, no row here touches it, and there is no second opinion
 * anywhere about which wounds are structural.
 *
 * ── WHY THIS IS NOT A ROW IN `pills.ts`, WHICH IS A FAIR QUESTION ────────
 *
 * AGENTS.md forbids a parallel catalog for important things, and the first cut
 * of this work tried to obey it literally by adding four rows to `PILLS` with a
 * new `repair_structure` effect. That does not work, and the reasons are
 * mechanical rather than aesthetic:
 *
 *   THE GRADE WORD MEANS A DIFFERENT THING HERE. A pill's grade says what realm
 *   it is PITCHED AT, and `pillBandOrdinal` reads it that way everywhere. A
 *   repair grade says what break it REACHES, which is a ceiling rather than a
 *   band, and the two would be the same column carrying two meanings.
 *
 *   THE PRICE BANDS CANNOT HOLD IT. `PILL_VALUE_BANDS` runs 5 to 1,000,000
 *   stones across five grades, disjoint and ascending, and the cheapest thing
 *   in this file is three hundred thousand. A mortal-grade row at that price
 *   would flip `gradeTradeTier('mortal')` to barter, which would take
 *   `commodityMarketCeiling` with it and close the open pill market the middle
 *   of the ladder runs on. That is not a tuning problem; the catalogs are
 *   measuring different things.
 *
 *   THE SEEDER WOULD SCATTER IT. `seedPillStock` places a barter pill on any
 *   house working near its band at 18% a house. These are supposed to be
 *   almost nowhere, and being almost nowhere is the entire design.
 *
 * `immortal-items.ts` is the precedent and it is the same argument: a catalog
 * of its own, because the effect is not expressible by `PillEffect` and the
 * economy does not reach the objects. The rule this file is careful to keep is
 * the one that actually matters - THERE IS NO SECOND HIERARCHY OF FORCE HERE.
 * Nothing in this file wins a fight, changes a roll, or gives its holder an
 * exemption from anything. It is four consumables and a list of who has them.
 *
 * ── FOUR GRADES, AND EACH ONE STOPS SOMEWHERE ────────────────────────────
 *
 * The same four words every other catalog uses. What differs is that grade here
 * is a CEILING, and the ceilings are the design:
 *
 *   mortal     reaches the end of Foundation Establishment. Re-lays a
 *              foundation that set wrong.
 *   earth      reaches the end of Core Formation. Knits a cracked core, and
 *              anything below it.
 *   heaven     reaches the end of Deity Transformation, AND THAT IS WHERE
 *              EVERYTHING MADE ON THIS SIDE STOPS. Nothing below immortal grade
 *              repairs a break above ordinal 28, at any price, from anybody.
 *   immortal   reaches the end of Grand Ascension. Cannot be made here. Sent
 *              down, and the number in the world is what has been sent.
 *
 * And nothing reaches 41. Not a shortage - a rule: getting into Tribulation
 * Transcendence is your own effort, helpers are allowed at that crossing and
 * medicine is not, so `unformed-tribulation-body` is the one break with no
 * treatment behind it at all. `REPAIRED_IN_THE_CRUCIBLE` states the same rule
 * from the other side, and the two must never disagree.
 *
 * ── RARE TO A DEGREE WHERE MOST PEOPLE JUST LIVE WITH IT ─────────────────
 *
 * The test is not the price. It is what fraction of the cultivators carrying a
 * structural break are ever mended, and the answer has to be almost none. Two
 * independent scarcities enforce it and both are needed:
 *
 *   THERE ARE VERY FEW DOSES. `STRUCTURAL_REPAIR_HOLDINGS` below is the whole
 *   of what stands in the world. Count it; it is not a large number.
 *
 *   AND ALMOST NOBODY STANDS WHERE ONE WOULD BE SPENT ON THEM. A house holds
 *   its doses for its own. A commoner who cracks is not a buyer who cannot meet
 *   the price - they are outside the market entirely, because it is not sold to
 *   them at any figure. `who-a-house-will-spend-a-repair-dose-on.ts` is that
 *   standard, and it is a standard rather than a story: rank, standing, and
 *   what the house has already put into them.
 *
 * The ordinary end for the rest is not a long quiet life. It is death at the
 * wall: the road is shut, the settling clock goes on running, and the lifespan
 * the rung granted them runs out at that rung, because there is no further
 * crossing to buy more with. That is what "most people just live with it"
 * actually costs, and it is why a dose is worth what it is worth.
 *
 * ── WHAT THE ENGINE DOES NOT PRODUCE YET, AND SAYING SO ──────────────────
 *
 * THE MORTAL GRADE CURRENTLY HAS NO PATIENTS. `ARRIVES_BROKEN_CHANCE` sets the
 * first wall - the setting of the foundation - to exactly zero, on the stated
 * ground that every run starts there and `assessFoundation` already owns what a
 * badly-laid foundation is worth. So `broken-foundation` is a wound the table
 * names and nothing in the engine hands out, and a Second Pour Pill is a real
 * object with, at present, nobody to take it.
 *
 * That is written down rather than quietly patched, because it is somebody
 * else's decision: the rate lives in the crossing layer and moving it is a
 * balance change with measured consequences at every wall above. The row stays,
 * because the wound row stays, and if the first wall ever starts breaking people
 * the medicine for it is already here.
 *
 * ── INERT ────────────────────────────────────────────────────────────────
 *
 * No arithmetic here. What a dose costs, what it reaches and what moves it are
 * computed in `engine/cultivation/what-structural-repair-medicine-can-reach.ts`
 * from the ladder's own income and lifespan curves. This file says what exists
 * and who is holding it, and nothing else.
 */

import { z } from 'zod';
import { TechniqueGradeSchema } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CONTRACT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What actually moves one of these, by grade.
 *
 * Three terms, and they are three different economies rather than three price
 * points. `docs/world/items.md` draws the line: a thing is cash-priced exactly
 * where it is fungible and barter-only exactly where it is singular.
 */
export const RepairTermsSchema = z.enum([
    /**
     * Cash, and an enormous amount of it, arranged privately between a house
     * and whoever refined it. Never on a shelf, never in a catalogue, and never
     * within reach of the patient's own purse - see the price function.
     */
    'private_sale',
    /**
     * No standing price. It reaches open sale exactly once in a long while, and
     * only when a court body needs money badly enough to put one up, which is
     * the only event that ever exposes one to anybody outside a holder's walls.
     */
    'court_auction_only',
    /**
     * Never cash, at any figure. A favour owed from a height your house cannot
     * reach, or another singular thing. Offering money for one reads as not
     * understanding what you are looking at.
     */
    'favour_or_singular_thing'
]);
export type RepairTerms = z.infer<typeof RepairTermsSchema>;

export const StructuralRepairMedicineSchema = z.object({
    id: z.string().min(3),
    name: z.string().min(3),
    /** The same four words every catalog uses. No chaos grade exists here. */
    grade: TechniqueGradeSchema,
    /**
     * Wound keys from `wounds.ts` this is the NAMED answer for. A grade also
     * reaches everything a lower grade reaches; that is the ceiling's job, not
     * this list's.
     */
    mends: z.array(z.string().min(3)).min(1),
    /**
     * The last rung on the ladder this repairs at. Above it the medicine does
     * nothing and is spent doing nothing, which is a fact the seller states in
     * advance and in writing.
     */
    reachesUpToOrdinal: z.number().int().min(0).max(46),
    /**
     * The rung the price is quoted at: the first ordinal at which this grade is
     * the cheapest thing that answers. Read by the price function; not a price.
     */
    pricedAtOrdinal: z.number().int().min(0).max(46),
    /** False where nobody below the Lid can refine one. */
    madeBelowTheLid: z.boolean(),
    /**
     * How many the whole world successfully refines in a century, or null where
     * nobody can make one at all.
     *
     * These are the supply side of the rarity, and they are small enough to
     * read as strange: the world produces well under one of the middle grade
     * per century, against a population that breaks somebody at that wall every
     * few decades. That gap is the design, and it is why a house holding one is
     * holding something it cannot replace on any horizon it plans over.
     *
     * Each figure is the dated record divided by the age of the record rather
     * than a target - `theRecord` below is where it comes from.
     */
    refinedPerCentury: z.number().min(0).nullable(),
    terms: RepairTermsSchema,
    /** Where it is refined, or how it arrives when it is not refined. */
    provenance: z.string().min(60),
    description: z.string().min(80),
    /** What taking one is actually like, which is not pleasant for any of them. */
    takingIt: z.string().min(80),
    /**
     * What the dated record says about one working. For three of the four this
     * is a very short sentence, and the shortness is the content.
     */
    theRecord: z.string().min(60)
});
export type StructuralRepairMedicine = z.infer<typeof StructuralRepairMedicineSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE FOUR
//
// Named for what each re-lays rather than for what it cures, in the same
// register the broken statuses use: a healer's words, plain and physical and
// about the specific thing that did not take.
// ─────────────────────────────────────────────────────────────────────────

export const STRUCTURAL_REPAIR_MEDICINES: readonly StructuralRepairMedicine[] = [
    {
        id: 'repair-second-pour',
        name: 'Second Pour Pill',
        grade: 'mortal',
        mends: ['broken-foundation'],
        // The end of Foundation Establishment.
        reachesUpToOrdinal: 16,
        pricedAtOrdinal: 13,
        madeBelowTheLid: true,
        // One every two thousand years, between three houses that can each
        // attempt it and mostly do not. Set against the measured rate at which
        // this world actually breaks somebody at a wall - once in about eleven
        // hundred years - so the medicine is never piling up unspent.
        refinedPerCentury: 0.05,
        terms: 'private_sale',
        provenance:
            'Refined in three places in the two provinces and nowhere else, from a formula none of the three will show the other two. The Cinnabar Crucible Guild is one of them and does not advertise it, on the grounds that a queue would form and could not be served.',
        description:
            'A foundation gets one pour, and the qi that would have gone into a second was spent getting there. This is the second pour: it dissolves what set wrong and re-lays it out of the taker, which is why it costs what it costs and why the taker comes out of it thinner than they went in.',
        takingIt:
            'Nine days on a stone floor while the thing that has been holding the body up is taken apart around them. They are conscious for most of it. Every house that has administered one keeps two people in the room for the whole nine days and does not explain why.',
        theRecord:
            'The best-attested of the four, which is not saying much: three uses in the dated record of the two provinces, all of them on somebody a house had already spent forty years on, and it worked twice. It is the only one of the four anybody living has watched work.'
    },
    {
        id: 'repair-core-knitting',
        name: 'Core-Knitting Pill',
        grade: 'earth',
        mends: ['cracked-core'],
        // The end of Core Formation.
        reachesUpToOrdinal: 20,
        pricedAtOrdinal: 17,
        madeBelowTheLid: true,
        // One every five thousand years, between the two houses that will
        // attempt it at all.
        refinedPerCentury: 0.02,
        terms: 'private_sale',
        provenance:
            'The same three places, and only two of them will attempt it. The fault a cracked core carries is in the structure rather than the channels, so nothing that treats meridians reaches it and nothing cheaper has ever been made to.',
        description:
            'The core turns with a fault running through it, and it will not survive being opened to birth anything. This closes the fault from the inside, over about a year, by growing the core through itself. It does not make a good core. It makes one that will hold when it is opened.',
        takingIt:
            'A year in which the taker must not cultivate, must not fight, and must not be surprised, because the core is soft for the whole of it. Most of the recorded failures are not the medicine failing; they are somebody being interrupted in month seven.',
        theRecord:
            'One use in the dated record, and the house that made it names the disciple. A house that spends this does not spend it quietly, which is why the entry exists at all - and why the absence of other entries is evidence rather than a gap.'
    },
    {
        id: 'repair-soul-seating',
        name: 'Soul-Seating Pill',
        grade: 'heaven',
        mends: ['unformed-nascent-soul', 'incomplete-transformation'],
        // The end of Deity Transformation, and the end of the road for
        // everything made on this side of the Lid.
        reachesUpToOrdinal: 28,
        pricedAtOrdinal: 21,
        madeBelowTheLid: true,
        // One every twenty-five thousand years. Four exist, they accumulated
        // over far longer than the provinces have had a dated record, and
        // nobody has ever refined two - so this is a rate assembled out of
        // single events rather than measured off a run of them.
        refinedPerCentury: 0.004,
        terms: 'court_auction_only',
        provenance:
            'Refined perhaps once in an age, by whichever of the three houses happens to have an alchemist who can hold the final step, and the step is not written down anywhere because the two people who could write it down learned it from each other. Nobody has ever refined two.',
        description:
            'The infant soul was born and did not take, or the form came back with body and soul lying alongside each other rather than through each other. This seats one in the other. It is the same medicine for both, which surprises people who have not been told that the two realms are the same operation done twice.',
        takingIt:
            'The taker is not present for it. What comes back afterwards agrees, mostly, that it is the same person, and every house that has done this has at least one elder who privately does not think so and has never said it out loud to the person concerned.',
        theRecord:
            'The record of one working is a single line four hundred years old. There are three other lines about one being taken, and none of those three say what happened next.'
    },
    {
        id: 'repair-unbroken-pattern',
        name: 'Unbroken Pattern Pill',
        grade: 'immortal',
        mends: ['damaged-spirit-sense', 'unsealed-seam', 'unset-ascension'],
        // The end of Grand Ascension. There is nothing for the crossing above.
        reachesUpToOrdinal: 40,
        pricedAtOrdinal: 29,
        madeBelowTheLid: false,
        // Nobody can make one. The supply is a count, and it only falls.
        refinedPerCentury: null,
        terms: 'favour_or_singular_thing',
        provenance:
            'Sent down, which is the only provenance any of these has and the only one any of them can have. Nobody below the Lid has ever refined one, nobody below the Lid knows what is in one, and the number in the world is exactly the number that has been sent.',
        description:
            'A spirit sense torn in the emptiness, a seam in a body joining that did not close, an ascension where two of the four axes went up and two did not. One object answers all three, which is either a fact about the medicine or a fact about what those three injuries have in common, and nobody on this side knows which.',
        takingIt:
            'Reported by the three people known to have taken one as brief, and none of the three has ever elaborated. The Deep Survey has all three accounts in the same file and they do not agree about anything except the brevity.',
        theRecord:
            'Three are known to have been used in the whole of the dated record. One of them was for a failed body joining, and it worked. The other two entries record the object being spent and do not record an outcome.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// THE SENT-DOWN LEDGER
//
// The immortal grade cannot be made here, so its supply is not a rate. It is a
// count, fixed by what has arrived, and it only ever goes down. Every figure
// below is a fact somebody in the world could in principle establish - the two
// apex bureaucracies count their standing stock to the unit and minute it - so
// this is a ledger rather than an assertion, and the standing register reads
// its total straight off it.
//
// The arithmetic is deliberately NOT done here. `sentDownLedgerTotals` in the
// engine adds it up, and the test asserts the parts reconcile, so a holdings
// edit that forgets to move a number fails loudly rather than quietly.
// ─────────────────────────────────────────────────────────────────────────

export const SentDownSpendingSchema = z.object({
    /** How long ago, in years. The record is dated; that is the point of it. */
    yearsAgo: z.number().int().min(1),
    /** Who spent it, by faction id where the faction still stands. */
    spentByFactionId: z.string().nullable(),
    /** The break it was spent on, or null where the record does not say. */
    onWoundKey: z.string().nullable(),
    /** What the entry actually says, which is often less than one would like. */
    entry: z.string().min(80)
});
export type SentDownSpending = z.infer<typeof SentDownSpendingSchema>;

/**
 * Everything the record says has ever come down, and what became of it.
 *
 * ELEVEN, ACROSS THE WHOLE DATED RECORD OF BOTH PROVINCES. Three spent, one
 * that a holder cannot account for, and seven standing. That is the entire
 * supply of the only medicine that reaches a break above ordinal 28, against a
 * world that produces broken cultivators at every crossing above it, every
 * generation, forever.
 */
export const SENT_DOWN_EVER_ARRIVED = 11;

export const SENT_DOWN_SPENDINGS: readonly SentDownSpending[] = [
    {
        yearsAgo: 1_180,
        spentByFactionId: 'apex-deep-survey',
        onWoundKey: 'unsealed-seam',
        entry:
            'A First Mark of the Survey came back from the joining with one seam open and the Survey released one against a quorum that took eleven months to assemble. It worked. He served another four hundred years and the file on him is the reason anybody knows the medicine does anything at all.'
    },
    {
        yearsAgo: 860,
        spentByFactionId: 'apex-long-cut',
        onWoundKey: null,
        entry:
            'The schedule records the object leaving the standing entry, the date, and the four signatures required to move it. The reason column is empty, as it is for every arrival, and the Long Cut has never been willing to say whether that emptiness is discretion or a lost page.'
    },
    {
        yearsAgo: 410,
        spentByFactionId: 'sect-azure-cloud-pavilion',
        onWoundKey: 'unset-ascension',
        entry:
            'The grant book names the recipient, the Master who authorised it, and the four Sword Elders who consented, in that order and on one line. It does not say what happened afterwards, and the recipient does not appear anywhere in the Pavilion record again.'
    }
] as const;

/**
 * The one nobody can produce.
 *
 * `docs/world/items.md`: an inventory read from a list rather than from the
 * shelf is a house that has decided not to look. This is that, and it is the
 * best thing in the ledger.
 */
export const SENT_DOWN_UNACCOUNTED = {
    heldByFactionId: 'apex-long-cut',
    count: 1,
    note:
        'The schedule carries eight arrivals against the Long Cut across two thousand six hundred years and the standing entry reads two. Three are accounted for by the spending above and by the two the Long Cut holds; the eighth was receipted, entered, and has not been seen since a hand-over ninety years ago. The Long Cut has not amended the schedule, because amending it would require somebody to write down which of the two figures is wrong.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// WHO HAS WHAT, AT THE START OF THE WORLD
//
// The authored opening position, and it is ONLY the opening position. What a
// house is holding right now is a question about the world rather than about
// this file: the seeder turns every row below into live records in
// `state.objects`, and `who-holds-the-structural-repair-medicine.ts` is what
// answers "what does this house have today", after however many centuries of
// spending, gifting and losing.
//
// TRACKED OR COUNTED, on the line `docs/world/items.md` draws. Heaven and
// immortal grade are ROWS: a holder, a provenance chain, and a record that
// survives the object being swallowed, because where a specific one went is
// exactly the sort of thing somebody should be able to find out two centuries
// later. Mortal and earth grade are COUNTS on the holder, because a house that
// keeps two of the cheap one keeps a number rather than two stories.
// ─────────────────────────────────────────────────────────────────────────

export const RepairHoldingSchema = z.object({
    factionId: z.string(),
    medicineId: z.string(),
    count: z.number().int().min(1),
    /** How this holder came by it. Becomes the first provenance entry. */
    howGot: z.string().min(60),
    /** Why it is still here. The barter reasons, stated for this holder. */
    whyStillHeld: z.string().min(80),
    /**
     * Who inside the holder can decide to spend one.
     *
     * Short answers are the interesting ones. "The head of the house." and
     * "Nobody, currently, which is the whole of the situation." are both real
     * entries, and a minimum length that forced them to be padded would be a
     * schema making the content worse.
     */
    whoDecides: z.string().min(15)
});
export type RepairHolding = z.infer<typeof RepairHoldingSchema>;

export const STRUCTURAL_REPAIR_HOLDINGS: readonly RepairHolding[] = [
    // ══ IMMORTAL GRADE - the seven that are standing ══════════════════
    // Only the three bodies with somebody above the Lid still answering hold
    // any, because there is no other way to have one. This is not a rule about
    // apexes; it is what "sent down" means, and the same three bodies hold the
    // other sent-down consumables in `immortal-items.ts` for the same reason.
    {
        factionId: 'apex-deep-survey',
        medicineId: 'repair-unbroken-pattern',
        count: 3,
        howGot:
            'Arrived. Entered on the standing stock register on the day they were found, never explained, and never acknowledged from the other side. The Survey has received objects from its First Surveyor for three thousand years and has never received a word.',
        whyStillHeld:
            'A line item that cannot be reordered is the hardest thing a bureaucracy owns. Releasing one requires all four Surveyors in the same room and any one of them can refuse, which is arithmetic rather than a lever: there is no version of this where a petitioner finds the right person and applies enough pressure.',
        whoDecides:
            'The four Surveyors, unanimously, against a Requisition Against Standing Stock. The form exists, has been submitted eleven times, and has been granted once.'
    },
    {
        factionId: 'apex-long-cut',
        medicineId: 'repair-unbroken-pattern',
        count: 2,
        howGot:
            'Found, receipted, entered on the schedule as a dated arrival with nothing in the reason column, which is the most the Long Cut has ever been willing to write down about any of it.',
        whyStillHeld:
            'The Long Cut owns every act it takes by name, so an object it cannot reorder is the hardest possible thing for it to spend: no vassal to attribute the decision to and no authority above it to authorise the loss. A schedule amendment against the standing entry has been submitted three times and answered each time by restating the entry.',
        whoDecides:
            'Four signatures against the standing entry, which is the same instrument that governs every other irreplaceable line the Long Cut carries.'
    },
    {
        factionId: 'sect-azure-cloud-pavilion',
        medicineId: 'repair-unbroken-pattern',
        count: 2,
        howGot:
            'Sent by the Pavilion\'s own ancestor, both of them a very long time ago and neither of them recently. The channel that is currently rising sends a different object; it has never sent one of these, and the Pavilion has stopped expecting it to.',
        whyStillHeld:
            'Not hoarding, and not fear. Ru Anjing left instructions rather than a prohibition and they are specific about who a thing goes to - somebody who has done the accumulation and is being stopped by something outside their control. A broken structure is exactly that, which is why the Pavilion is the one holder where a case can actually be made to a person.',
        whoDecides:
            'The Pavilion Master with four Sword Elders consenting in the same room, the same instrument that governs drawing the Standing Edge.'
    },

    // ══ HEAVEN GRADE - the four that reach Deity Transformation ════════
    // Held only at the top, and the price is why rather than a rule. A dose is
    // most of what a Grand Ascension cultivator could accumulate in the whole
    // of the life their rung granted them, so no individual anywhere is a
    // buyer and only an institution can hold one at all.
    {
        factionId: 'apex-deep-survey',
        medicineId: 'repair-soul-seating',
        count: 1,
        howGot:
            'Bought, four hundred and sixty years ago, from the house that refined it, in a transaction the Survey minuted in full and has never published. The sum is in the minute.',
        whyStillHeld:
            'Against a succession the Survey can name. The four Surveyors are not young by the standards of the office and the Survey has watched two of its own break at the merging inside eight hundred years, which is what a body that keeps records four thousand years long is able to notice about itself.',
        whoDecides: 'The four Surveyors, by the same quorum that governs the standing stock.'
    },
    {
        factionId: 'apex-long-cut',
        medicineId: 'repair-soul-seating',
        count: 1,
        howGot:
            'Taken in settlement of a grant dispute two hundred years ago, from a house that could not pay in stones and could pay in this. The Long Cut recorded it as a receipt and has never described it as a purchase.',
        whyStillHeld:
            'Because selling it would announce that the Long Cut has one, and a body of forty staff administering five provinces does not announce what it is holding. This is the plainest instance in the catalog of the reason `items.md` puts first: a weak house holding a valuable thing is not rich, it is quiet.',
        whoDecides: 'Four signatures, as with everything else on the standing entry.'
    },
    {
        factionId: 'sect-azure-cloud-pavilion',
        medicineId: 'repair-soul-seating',
        count: 1,
        howGot:
            'Refined by the Pavilion\'s own hall, once, ninety years ago, by an alchemist who was able to hold the final step and who died before teaching it to anybody. The Pavilion has attempted it twice since and lost the materials both times.',
        whyStillHeld:
            'For a disciple who is not yet born. The Pavilion is explicit about this internally and slightly embarrassed about it externally: it is holding the thing against the possibility of its next exceptional intake breaking at the birthing, which is a plan rather than sentiment and is written into the grant book as one.',
        whoDecides: 'The Pavilion Master with four Sword Elders, as with everything the grant book governs.'
    },
    {
        // THE AUCTION CASE, and it is a real body under real pressure rather
        // than a hypothetical. The Kiln administers a datum nobody draws on,
        // so its grant list is empty and it has no tenancy income at all. It
        // is the one holder in the world for whom selling is on the table.
        factionId: 'court-kiln',
        medicineId: 'repair-soul-seating',
        count: 1,
        howGot:
            'Inherited with the office, from an administration that ended, along with a datum nobody draws on and a set of nodes laid out to a plan that assumes a mountain is still attached. Nobody now serving knows which of the Kiln\'s predecessors bought it or what for.',
        whyStillHeld:
            'Because it has not been sold YET, which is the only entry in this table that reads that way. A court with an empty grant list has no tenancy income, and every generation of Kiln officers has considered putting this up and has been talked out of it by the argument that a court which sells its last irreplaceable thing has stopped being a court. That argument is getting thinner.',
        whoDecides:
            'The Kiln\'s serving officers, by majority, which is a far lower bar than any other holder in this table and is exactly why this is the one that might move.'
    },

    // ══ EARTH GRADE - counted, and still beyond any individual ═════════
    {
        factionId: 'sect-cinnabar-crucible-guild',
        medicineId: 'repair-core-knitting',
        count: 2,
        howGot: 'Refined in the Guild\'s own crucible, which is one of the two places in the world that will attempt it.',
        whyStillHeld:
            'Stock, and the Guild is candid that it is stock. It will sell one to a house that can pay, and the number of houses that can pay is small enough that the Guild has gone eighty years between sales twice.',
        whoDecides: 'The Guild, commercially, on terms it sets and does not negotiate.'
    },
    {
        factionId: 'sect-azure-cloud-pavilion',
        medicineId: 'repair-core-knitting',
        count: 2,
        howGot: 'Bought from the Crucible in two separate transactions a century apart, both minuted in the grant book.',
        whyStillHeld: 'Held for the Pavilion\'s own, under the same instructions that govern everything else in the grant book.',
        whoDecides: 'The Pavilion Master, without needing the Sword Elders for a thing of this grade.'
    },
    {
        factionId: 'house-ninefold-ledger',
        medicineId: 'repair-core-knitting',
        count: 1,
        howGot: 'Bought outright, at a figure the house recorded and does not discuss, for a grandson who had not yet reached the wall it answers.',
        whyStillHeld:
            'The grandson reached the wall, crossed it clean, and the pill is still in the box. The house has not sold it and has not said why, and the honest answer inside the house is that the next generation exists.',
        whoDecides: 'The head of the house, personally, and nobody else is consulted.'
    },
    {
        factionId: 'sect-thousand-treasure-pavilion',
        medicineId: 'repair-core-knitting',
        count: 1,
        howGot: 'Taken in a lot at an estate sale eleven years ago, along with four hundred other things, and identified afterwards.',
        whyStillHeld:
            'It is for sale. The Pavilion has never listed it, because listing it would tell three interested parties about each other, and the Pavilion has been in business long enough to know what that costs.',
        whoDecides: 'Whoever is authorised to close a sale of that size, which is two people.'
    },

    // ══ MORTAL GRADE - counted. The rich family's purchase ═════════════
    {
        factionId: 'sect-cinnabar-crucible-guild',
        medicineId: 'repair-second-pour',
        count: 3,
        howGot: 'Refined to order and to stock, being the only one of the four this Guild makes with any regularity.',
        whyStillHeld: 'Awaiting a buyer who can pay, which is a very short list and does not include anybody who has ever needed one for themselves.',
        whoDecides: 'The Guild, commercially.'
    },
    {
        factionId: 'sect-azure-cloud-pavilion',
        medicineId: 'repair-second-pour',
        count: 2,
        howGot: 'Bought from the Crucible against the intake, the way a hall buys bandages against a season.',
        whyStillHeld: 'For the Pavilion\'s own intake, and it has spent one on a disciple twice in three hundred years.',
        whoDecides: 'The hall that runs the intake, which does not need the Master for this.'
    },
    {
        factionId: 'house-ninefold-ledger',
        medicineId: 'repair-second-pour',
        count: 2,
        howGot: 'Bought as a pair, on the reasoning that a house with two children at the wall should not have to choose.',
        whyStillHeld: 'Neither child has needed one. The house regards this as money well spent and would buy them again.',
        whoDecides: 'The head of the house.'
    },
    {
        factionId: 'house-held-names',
        medicineId: 'repair-second-pour',
        count: 1,
        howGot: 'Bought sixty years ago for a specific child, who did not need it.',
        whyStillHeld:
            'Because the house cannot now agree whose it is. It was bought for one line and three lines have an argument about the box, and the argument has outlasted the child it was bought for.',
        whoDecides: 'Nobody, currently, which is the whole of the situation.'
    },
    {
        factionId: 'court-third-sill',
        medicineId: 'repair-second-pour',
        count: 1,
        howGot: 'Bought out of grant income eighty years ago, in the one year the third arterial paid unusually well.',
        whyStillHeld: 'Held for a serving officer, which is what a court that ranks by service rather than by realm does with anything it buys.',
        whoDecides: 'The Keeper of the Eleven, who has never been asked.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// O(1) against prebuilt Maps, in the house style. No arithmetic.
// ─────────────────────────────────────────────────────────────────────────

const BY_ID = new Map<string, StructuralRepairMedicine>(
    STRUCTURAL_REPAIR_MEDICINES.map(m => [m.id, m])
);

/** The medicine row for an id, or null. Never throws. */
export function getStructuralRepairMedicine(
    id: string | null | undefined
): StructuralRepairMedicine | null {
    if (!id) return null;
    return BY_ID.get(id) ?? null;
}

/** Every medicine that names this wound key as one it mends. */
export function medicinesNaming(woundKey: string): StructuralRepairMedicine[] {
    return STRUCTURAL_REPAIR_MEDICINES.filter(m => m.mends.includes(woundKey));
}

/** The authored opening holdings of one faction. Not the live answer. */
export function openingHoldingsOf(factionId: string): RepairHolding[] {
    return STRUCTURAL_REPAIR_HOLDINGS.filter(h => h.factionId === factionId);
}

/** Every faction that starts the world holding any of one medicine. */
export function openingHoldersOf(medicineId: string): RepairHolding[] {
    return STRUCTURAL_REPAIR_HOLDINGS.filter(h => h.medicineId === medicineId);
}

/** The medicines that cannot be made on this side of the Lid. */
export function sentDownMedicines(): StructuralRepairMedicine[] {
    return STRUCTURAL_REPAIR_MEDICINES.filter(m => !m.madeBelowTheLid);
}
