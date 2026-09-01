/**
 * Bodies that will hold a thing for somebody who is not coming back, and the
 * terms each of them holds it on.
 *
 * Nothing here is a new faction. Every entry below is an id that already exists
 * in `sects.ts`, selected because that house's own `services` array already
 * advertises custody of something that outlives the party who lodged it, and
 * every entry carries the exact line it was selected on in `derivedFrom`. That
 * field is not decoration: it is the check that this file has not invented an
 * institution, and the test asserts that each `derivedFrom` string is really
 * present in the named faction's catalog entry.
 *
 * ── Why these six and nobody else ────────────────────────────────────────
 *
 * Six houses in the catalog already say, in their own words, that they hold
 * property or obligations for parties who are absent, dead or unidentifiable:
 *
 *   Ninefold Ledger     'sealed escrow of obligations that outlive their parties'
 *   Held Names          'name custody, an annual fee, payable in advance and
 *                        famously never refunded'
 *   Bound Word          'custody of the treaty vault, with certified copies
 *                        issued to any party to a treaty'
 *   Measured Span       'storage certification, without which no storage ring
 *                        sells at full value'
 *   Thousand Treasure   'a vault nobody has located'
 *   Lantern Hall        'records what it was from whatever witness is left, so
 *                        that somebody in the world still holds it'
 *
 * That is not a service invented for this feature. It is a service the setting
 * had already written down six times, with nobody able to use it.
 *
 * ── The phrase, and why an institution asks for one ──────────────────────
 *
 * The Ninefold Ledger settles every inheritance in the region by reading the
 * karma graph, and its own entry states the one thing the graph cannot do: it
 * "cannot read a thread through a grave, which has never once worked and is
 * filed under research rather than failure." A depositor who is dead and a
 * claimant who is a stranger to them are precisely the case the graph fails on.
 * So the houses fall back on the only instrument that survives a death - a
 * phrase agreed in advance, held against the entry, and produced by whoever
 * turns up. See `WHY_A_PHRASE_AND_NOT_A_NAME`.
 *
 * ── What a deposit is not ────────────────────────────────────────────────
 *
 * `A_DEPOSIT_IS_NOT_A_LIFE`, stated once and enforced by the engine and by a
 * test. Objects cross. Nothing else does.
 *
 * ── No odds in this file ─────────────────────────────────────────────────
 *
 * Whether a house is still honouring claims in six hundred years is arithmetic
 * over the numbers the catalog already holds - `foundedYearsAgo`, `powerOrdinal`,
 * `production.yearsSinceLastPeak`, `rivals.length`, whether the house has a
 * `quietlyStopped` line - and it lives in
 * `engine/world/whether-a-house-still-honours-a-deposit.ts`. A hazard constant
 * written next to a house here would be a second failure model living in the
 * prose layer, which is exactly what AGENTS.md forbids.
 */

import { getSect, type SectEntry } from './sects.js';

// ─────────────────────────────────────────────────────────────────────────
// THE INVARIANT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rule that keeps this from becoming a save file.
 *
 * A run ends and does not resume. What a later run may collect is a set of
 * OBJECTS - stones counted out, pills and herbs handed over a counter. It is
 * never a rung, never accumulated progress, never a foundation, never a
 * comprehension, never standing inside a house, never a knowledge record about
 * what the depositor knew, and never the depositor's name.
 *
 * The person who collects is a stranger who happens to know a phrase or a patch
 * of ground. That is the whole of the relationship, and the fiction says so
 * plainly at the counter: the clerk does not ask who you are, because the house
 * does not care and could not check.
 */
export const A_DEPOSIT_IS_NOT_A_LIFE = {
    rule: 'A claim hands over objects. It hands over nothing else, under any circumstances, by any route.',
    whatCrosses: [
        'spirit stones, counted',
        'pills and herbs, by catalog id and quantity'
    ],
    whatDoesNotCross: [
        'realm ordinal, cultivation progress, foundation quality',
        'insights and achievements - a comprehension is something a person did, and the person is dead',
        'standing, rank or membership inside any house, including the one holding the deposit',
        'knowledge records - the depositor knew where things were and the claimant does not',
        'the depositor\'s name, which the claimant has no route to and no use for',
        'lifespan, health, injuries healed, or anything else measured on a body'
    ],
    whyItMatters:
        'Because a death that can be softened is not a death. The whole weight of this game sits on the run ending for good, and an inheritance route that returned any part of WHO somebody was would convert permadeath into a save file with an inconvenient loading screen. Objects are safe to pass because objects are what a grave passes already: every inheritance site in the catalog hands a stranger somebody else\'s possessions and hands them nothing else.',
    theTest:
        'Take the claim away and the claimant must price out as exactly the cultivator they were the moment before, plus a purse and a pouch. If anything else moved, the route is wrong.'
} as const;

/**
 * Why a house takes a phrase rather than a name, an heir or a token.
 *
 * Read off the Ledger's own stated limit rather than asserted here.
 */
export const WHY_A_PHRASE_AND_NOT_A_NAME = {
    theLimit:
        'The Ninefold Ledger settles inheritance by reading a thread across generations, and its own entry states that it has never once been able to read a thread through a grave. A dead depositor and an unrelated claimant is that case exactly.',
    soWhatIsLeft:
        'A form of words agreed while the depositor was alive, written against the entry, and produced at the counter by whoever turns up. It proves nothing about who the claimant is and is not supposed to: it proves that the depositor told them, which is the only fact the house is being asked to establish.',
    andTheHouseKnowsThisIsWeak:
        'Every one of the six says so in its own way. A phrase can be overheard, tortured out of somebody, or guessed by a persistent fraud, and the houses that keep records defend against the last of those by counting failed attempts and refusing the entry when the count runs out. The other two do not count, which is a different kind of risk and not a smaller one.',
    whyTheHouseDoesNotHoldTheDepositorsName:
        'Held Names would, for a fee, and that is a separate product. An escrow entry carries the phrase and the goods. Attaching the depositor to it would make the entry findable by anybody who knew who died, which is the failure the phrase exists to prevent.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// TERMS
// ─────────────────────────────────────────────────────────────────────────

/** What the house does with an entry whose paid term has run out. */
export type LapsePolicy =
    /**
     * The goods become the house's, the entry stays in the book, and the book
     * is readable. A claimant who turns up late learns exactly what was there
     * and who has it now, which is a lead and not a refund.
     */
    | 'absorbed_and_recorded'
    /**
     * The goods become the house's and the entry is struck. Nobody can
     * afterwards establish that there was ever anything there.
     */
    | 'absorbed_and_struck'
    /**
     * The entry is published on lapse. The goods are still there and now
     * everybody knows, which is the Hall's whole practice applied to this.
     */
    | 'published';

export interface CustodyTerms {
    /** An id in `sects.ts`. Never a body invented for this file. */
    factionId: string;
    /**
     * The exact line in that faction's own catalog entry that this custody is
     * derived from. Asserted by the test against the real entry.
     */
    derivedFrom: string;
    /**
     * Stones a year to hold an entry, paid in advance. Anchored to
     * `price-gate-registration` - three stones a year to Held Names for a gate
     * record, which is the one custody fee the price board already carries -
     * and scaled by how much more than a line of writing the house is holding.
     */
    annualFeeStones: number;
    /** Shortest term the house will write. Nobody lodges anything for a season. */
    minimumTermYears: number;
    /**
     * Wrong phrases the counter will hear before the entry is closed against
     * the claimant.
     *
     * A house that keeps a written record can afford to count and does; a house
     * that does not keep one cannot tell a second attempt from a first, which
     * is why the loose operations are generous here and dangerous elsewhere.
     */
    attemptsAllowed: number;
    /**
     * Whether there is a book. Decides whether a claim survives the people who
     * took it, and decides what a failing house loses first.
     */
    keepsWrittenRecord: boolean;
    /**
     * What the counter will tell a claimant who has the wrong phrase. Never any
     * part of the phrase - see `HINTS_ARE_NOT_THE_PHRASE`.
     */
    hintOnFailure: string;
    lapse: LapsePolicy;
    /** How the house describes what it is doing, at the counter. */
    counterLine: string;
    /** What this house will not do, which is the shape of the risk. */
    whatTheyWillNotDo: string;
}

/**
 * What a counter is permitted to say to a claimant who cannot produce the
 * phrase.
 *
 * The rule, and it is the same rule `FATE_IS_NOT_A_STAT` runs on: a hint that
 * narrows the phrase is the prize. What a house may say is what its own ledger
 * genuinely records about the ENTRY - how many words were agreed, what day it
 * was lodged, how long the term runs - none of which is any part of the words
 * themselves, and all of which a real clerk reading a real book would have in
 * front of them.
 */
export const HINTS_ARE_NOT_THE_PHRASE = {
    rule: 'A house may state what its book records ABOUT the entry. It may never state, spell, partially reveal, rhyme with, or narrow the phrase itself.',
    whatABookHolds: [
        'the day the entry was lodged, and therefore how long ago',
        'how many words were agreed, because a clerk counts them writing it down',
        'how many years the term was paid for, and whether it has run out',
        'how many wrong attempts have already been heard against this entry'
    ],
    whyNotOneLetter:
        'Because the phrase is the only thing in this game the player themselves has to carry across a death, and a hint that narrows it hands the carrying back to the engine. A house that will give you the first letter after four failures is a house with a four-failure password, and the player will find that out and use it.',
    andTheHousesThatKeepNoBook:
        'They cannot even offer the four facts above. What they say is that they do not know, which is true, and is the reason their attempt counts are generous and their entries are the ones that go missing.'
} as const;

/**
 * The six, in the order a cultivator with something to lose would consider
 * them: most expensive and most durable first.
 */
export const CUSTODY_TAKERS: readonly CustodyTerms[] = [
    {
        factionId: 'house-ninefold-ledger',
        derivedFrom: 'sealed escrow of obligations that outlive their parties',
        // Seven times the gate-registration rate. The Ledger is holding goods
        // under seal and an obligation to hand them over, against a book it
        // maintains across generations, and it prices the placement of a single
        // cultivator at seventy stones.
        annualFeeStones: 21,
        minimumTermYears: 50,
        attemptsAllowed: 3,
        keepsWrittenRecord: true,
        hintOnFailure:
            'The auditor closes the book on her finger and tells you what the entry says about itself: the day it was lodged, and how many words were agreed. She does not tell you the words, and she does not soften it.',
        lapse: 'absorbed_and_recorded',
        counterLine:
            'The Ledger writes the phrase against the entry, seals it, and enters the obligation in the ninefold book. It does not ask who lodged it and it will not ask who collects.',
        whatTheyWillNotDo:
            'It will not take an entry it cannot audit later, and it will not take a claimant\'s word over the book. Three wrong phrases and the entry is marked contested, which in this house means it stops being collectible by anybody at all.'
    },
    {
        factionId: 'house-bound-word',
        derivedFrom: 'custody of the treaty vault, with certified copies issued to any party to a treaty',
        annualFeeStones: 14,
        minimumTermYears: 100,
        attemptsAllowed: 2,
        keepsWrittenRecord: true,
        hintOnFailure:
            'The oathwright reads back the terms of the deposit - the day, the term, the count of words - and points out, without any apparent unkindness, that you have one attempt left.',
        lapse: 'absorbed_and_recorded',
        counterLine:
            'The House writes it as an undertaking rather than a storage contract: the vault holds the goods, and the House holds the promise to give them up to whoever says the words. A certified copy of the terms is issued, and it does not contain the words.',
        whatTheyWillNotDo:
            'It will not witness a deposit on unsurveyed ground and it will not shorten the term. Two wrong phrases voids the undertaking, and a voided undertaking at this house is not reopened for any consideration.'
    },
    {
        factionId: 'house-measured-span',
        derivedFrom: 'storage certification, without which no storage ring sells at full value',
        annualFeeStones: 9,
        minimumTermYears: 25,
        attemptsAllowed: 4,
        keepsWrittenRecord: true,
        hintOnFailure:
            'The clerk checks the certificate, tells you the lodging day and the word count off it, and asks whether you would like to try again now or come back.',
        lapse: 'absorbed_and_recorded',
        counterLine:
            'The Span treats it as certified storage: a numbered space, a stated capacity, an inspection schedule, and a phrase on the docket. The certificate is what is really being sold.',
        whatTheyWillNotDo:
            'It will not defend the goods against anybody who takes the station. The Span is a courier house that certifies capacity; it does not garrison, and it has never claimed to.'
    },
    {
        factionId: 'house-held-names',
        derivedFrom: 'name custody, an annual fee, payable in advance and famously never refunded',
        // Three stones a year is the published gate-registration rate. Holding
        // goods rather than a line of writing is priced at twice it.
        annualFeeStones: 6,
        minimumTermYears: 100,
        attemptsAllowed: 3,
        keepsWrittenRecord: true,
        hintOnFailure:
            'The registrar tells you the day and the number of words, in the flat voice of somebody who has said it several thousand times, and reminds you that the fee is not refunded whatever happens next.',
        lapse: 'absorbed_and_struck',
        counterLine:
            'The House takes it the way it takes a name: an annual fee, payable in advance, and a register entry that exists exactly as long as the fee does. What lapses is struck.',
        whatTheyWillNotDo:
            'It will not carry an entry a day past the term. The House is famous for not refunding and equally consistent about not extending, and an entry struck here leaves nothing behind for anybody to find.'
    },
    {
        factionId: 'sect-thousand-treasure-pavilion',
        derivedFrom: 'a vault nobody has located',
        annualFeeStones: 4,
        minimumTermYears: 25,
        attemptsAllowed: 6,
        keepsWrittenRecord: false,
        hintOnFailure:
            'The appraiser is sympathetic, tells you these things happen, and offers to let you try as many times as you like. He cannot tell you the day or the word count, because nobody wrote them down anywhere he can reach.',
        lapse: 'absorbed_and_struck',
        counterLine:
            'The Pavilion takes it as consignment: cheap, quick, no questions, and a receipt with a number on it. Where the vault is nobody outside the house has ever established, which is the whole of what you are buying.',
        whatTheyWillNotDo:
            'It will not tell you where the goods are, will not produce a book, and will not be audited. It is the cheapest counter in the province and the only one where a claimant can guess all afternoon.'
    },
    {
        factionId: 'sect-lantern-hall',
        derivedFrom:
            'the Hall records what it was from whatever witness is left, so that somebody in the world still holds it',
        // Free. The Hall's own position in the dispute with Held Names is that a
        // name written down and charged for is a name sold; it does not charge
        // for the register, and it does not charge for this.
        annualFeeStones: 0,
        minimumTermYears: 25,
        attemptsAllowed: 6,
        keepsWrittenRecord: true,
        hintOnFailure:
            'The archivist shows you the entry itself, because the register is open. The day is on it and the word count is on it and the words are not, and she says so without any sense that she is withholding anything.',
        lapse: 'published',
        counterLine:
            'The Hall takes nothing for it and writes it in the open register, where anybody at all may read that something was lodged, on what day, by somebody it does not name. It considers a charged register to be a sold one and will not operate one.',
        whatTheyWillNotDo:
            'It will not conceal the entry. Everybody in both provinces can read that a deposit exists at the Hall, how old it is and how many words open it, which is a standing advertisement to every fraud with an afternoon free.'
    }
];

const TERMS_BY_FACTION: ReadonlyMap<string, CustodyTerms> =
    new Map(CUSTODY_TAKERS.map(t => [t.factionId, t]));

export function custodyTermsFor(factionId: string): CustodyTerms | undefined {
    return TERMS_BY_FACTION.get(factionId);
}

/** The house behind a set of terms, out of the ordinary sect catalog. */
export function custodyHouse(terms: CustodyTerms): SectEntry | undefined {
    return getSect(terms.factionId);
}

/** Terms plus the house, for every taker whose faction the catalog still holds. */
export function custodyTakers(): { terms: CustodyTerms; house: SectEntry }[] {
    const out: { terms: CustodyTerms; house: SectEntry }[] = [];
    for (const terms of CUSTODY_TAKERS) {
        const house = getSect(terms.factionId);
        if (house) out.push({ terms, house });
    }
    return out;
}

/** What a term of `years` costs at this counter, paid in advance. */
export function feeForTerm(terms: CustodyTerms, years: number): number {
    const held = Math.max(terms.minimumTermYears, Math.floor(years));
    return terms.annualFeeStones * held;
}

// ─────────────────────────────────────────────────────────────────────────
// THE OTHER ROUTE'S ONE PURCHASABLE SERVICE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The Anchorhold will anchor a burial, and says so.
 *
 * Its `services` array reads "anchoring of a site for a breakthrough, a burial
 * or a sealed inheritance" - three things, and two of them are this. So the one
 * way a cache can be made materially harder to find is a service the catalog
 * already sells, at a house that already exists, to anybody who can pay for it.
 *
 * What it buys is not concealment. The Anchorhold's discipline is fixity: the
 * ground does not move, cannot be folded into, and an anchored site holds its
 * survey. In practice that means the marks stay where they were put, the hole
 * does not silt or slump, and nothing gets at it by opening a span into it -
 * which is why an anchored cache decays far more slowly than a hidden one. It
 * is also a public act performed by a house that keeps a survey of record, so
 * anybody who thinks to ask the Anchorhold what it anchored that decade can be
 * told. Fixity is not secrecy and the house has never pretended otherwise.
 */
export const ANCHORING_A_CACHE = {
    factionId: 'house-anchorhold',
    derivedFrom: 'anchoring of a site for a breakthrough, a burial or a sealed inheritance',
    /**
     * Fifty stones. `price-oath-witness` is fifty stones and up for a witnessed
     * oath, and this is the same house-scale civil act: surveyors on the
     * ground, a datum cut, an entry in the survey of record.
     */
    feeStones: 50,
    whatItBuys:
        'The ground is entered on the survey of record and holds its datum. Marks stay where they were cut, the hole does not slump or silt, and a span cannot be opened into it, so what usually finds a cache - the ground moving, or somebody arriving through it - does not.',
    whatItDoesNotBuy:
        'Secrecy. The Anchorhold keeps the survey of record and will tell any competent party what it anchored and roughly when, because the survey is the product and a withheld survey is worthless. What you have bought is that the cache is still where you put it, not that nobody knows there is one.',
    counterLine:
        'Two surveyors, a datum cut into the nearest fixed thing, and a line in a book that will still be legible in a thousand years. They do not ask what is in the hole and they do not look.'
} as const;
