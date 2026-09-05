/**
 * What a favour is for: it skips the admission ordinal.
 *
 * Not money, not standing, not a recommendation that makes a good impression.
 * A favour from somebody high enough MAKES A HOUSE TAKE A PERSON IT WOULD
 * OTHERWISE REFUSE ON THE BAR, and that is the whole of the mechanism. It buys
 * one thing, it buys it outright, and outside that one thing it buys nothing.
 *
 * THE PROBLEM IT SOLVES, WHICH IS A REAL ONE IN THE DATA
 * -----------------------------------------------------
 * Every house states a `minOrdinal`, no origin waives one, and a child has an
 * ordinal of zero until they have cultivated. Without this mechanic the numbers
 * produce absurdities that nobody wrote and everybody would have to explain:
 *
 *   - A Ninefold Ledger child cannot enter the Ledger, which admits at 4. At
 *     seven years old they are at 0. They wait, in their own family's house.
 *   - A Dao house's name reaches perhaps thirty houses, and the ones it can
 *     actually use on a seven-year-old are EXACTLY THE FIVE THAT ADMIT AT 0 -
 *     the Burnt Earth Temple, the Azure Dew, the Hollow Bell Wanderers, the
 *     Six Li Wardens and the Gleaners' Company. All five take anybody. So the
 *     greatest name in the province buys a place at a house that would have
 *     taken a farmer's child that morning, which makes the name worth nothing
 *     at the only moment it should be worth everything.
 *
 * The favour is what makes a name mean something before the child has an
 * ordinal. It is also why a favour from somebody at Tribulation Transcendence
 * is worth what it is worth, and why almost nobody has one to give.
 *
 * WHO CAN GRANT ONE
 * -----------------
 * Somebody at Tribulation Transcendence, or somebody comparably placed - a
 * seated apex head, a court warden of real standing, an elder whose house other
 * houses need something from. The scarcity is not a rule about favours. It is
 * the scarcity of the people: there are four of them on one mountain, one in
 * each apex seat, and a thin scatter of everybody else, and most of them have
 * nobody they want to spend it on. See `PLACEMENT_REACH` is NOT what this is -
 * that file was retracted, because placement by favour is not a universal
 * ladder scaled by standing. This is narrower and sharper: a bar, and a word
 * that skips it.
 *
 * THE EXTREME CASE IS A NEWBORN
 * -----------------------------
 * A child with nothing measurable yet except potential, taken now, by a house
 * whose stated bar they will not meet for a decade and might never meet. That
 * is the thing a favour is actually for, and the reason somebody spends one -
 * a house that takes a newborn is a house that will raise them, and the ten
 * years it saves are not ten years of waiting, they are ten years of teaching
 * nobody else was going to give them.
 *
 * AND THE THREE APEXES DIFFER ON EXACTLY THIS
 * -------------------------------------------
 * Which is a far more useful distinction than the alignment word beside them,
 * because it is the one an ordinary person is actually asking about:
 *
 *   AZURE CLOUD PAVILION   Takes the child, and grants no favour. Its
 *                          probation door stands at 0 - it is the ONLY house in
 *                          the world with one - so it will take an uncultivated
 *                          mortal off the road and start spending on them, and
 *                          being handed that same child by somebody powerful
 *                          gets you exactly what walking up gets you. It does
 *                          not lower a bar. Not for anybody, not ever, and the
 *                          disciple bar at 3 has never moved.
 *   THE DEEP SURVEY        Knows what a favour is worth and will spend one, and
 *   THE LONG CUT           charge for it. Neither admits anybody itself, so
 *                          what they trade is the word: a house holding a grant
 *                          does not refuse the granter's request, and both
 *                          apexes are entirely clear that this is a trade and
 *                          not a kindness.
 *
 * The Pavilion's refusal should read as admirable and faintly maddening at
 * once, and it is not coldness - it is the whole of what the house is. It is
 * also not a disadvantage: it is the only one of the three that never has to
 * ask what a placement cost it.
 *
 * NOTHING HERE IS A MECHANIC. No resolver reads this file and no admission bar
 * in `SECT_ADMISSION` is altered by it. It records what a favour does so that a
 * roster can be read correctly and a narrator has an answer when a player asks
 * how a child got in - and the bars stay exactly where they are, which is the
 * point, because a bar that quietly bends for everybody is not a bar.
 */

import { z } from 'zod';
import { SECTS, SECT_ADMISSION } from './sects.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The answer to the question an ordinary person is actually asking.
 *
 * Five answers, and the two "no" answers are not the same no. One is a house
 * that has nothing to skip; the other is a house that has something to skip and
 * will not skip it, which is a position rather than an absence.
 */
export const FavourAnswerSchema = z.enum([
    /** The bar is already at the floor. Nothing to skip, nobody to ask. */
    'no bar to speak of',
    /** There is a bar, a word moves it, and everybody involved knows the price. */
    'yes, at a price',
    /** There is a bar, and it does not move. The reason is never squeamishness. */
    'no, and the bar does not move',
    /** Nobody is admitted at all. Arrival is by appointment to a posting. */
    'no bar to skip, because there is no door'
]);
export type FavourAnswer = z.infer<typeof FavourAnswerSchema>;

export const FavourStanceSchema = z.object({
    factionId: z.string().min(1),
    answer: FavourAnswerSchema,
    /**
     * Why, in this house's own terms.
     *
     * On a house that will not move, this must never read as fastidiousness. A
     * bar that cannot be waived is a bar whose waiving would break something -
     * kill the applicant, dissolve the thing the house runs on, or admit a
     * contribution the house has no use for.
     */
    why: z.string().min(150),
    /**
     * What it takes in return. Null except on the houses that trade.
     *
     * Stated as a price rather than as a favour returned, because that is what
     * it is and both parties treat it that way.
     */
    andWhatItTakes: z.string().min(100).nullable(),
    /**
     * Whether this body's own word will move somebody ELSE's bar.
     *
     * A different question from its own door and frequently a different answer.
     * Null where the body is not placed highly enough for its word to move
     * anybody, which is most of them.
     */
    andWhetherItsOwnWordMovesAnybody: z.string().min(100).nullable()
});
export type FavourStance = z.infer<typeof FavourStanceSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSES WHERE THE ANSWER IS NOT THE ORDINARY ONE
//
// The ordinary answer is "yes, at a price", and it is derived rather than
// written out thirty times - see `favourStanceOf`. What is authored here is
// every house where the answer is something else, and the reason.
// ─────────────────────────────────────────────────────────────────────────

export const FAVOUR_STANCES: readonly FavourStance[] = [
    // ── the one that takes anybody and bends for nobody ────────────────
    {
        factionId: 'sect-azure-cloud-pavilion',
        answer: 'no bar to speak of',
        why: 'It has the only probation door in the world, standing at zero, and it will take an uncultivated mortal off the road, test them, and spend years finding out what they are. So a favour buys nothing here: the child was getting in anyway. What a favour also cannot buy is the other door - the disciple bar has never moved, for anybody, and the Pavilion declines to move it in the same words every time. It is righteous, which in practice means it does not do the one thing everybody at that height is asked to do, and being handed a child by somebody powerful gets you precisely what walking up the mountain gets you.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody:
            'It would move almost any bar in the province and it does not use it. The Pavilion has never asked a house to take somebody it would have refused, on the stated ground that it would then be doing to another house what it will not do to itself, and it is aware that this costs it a currency the other two spend freely. The Jade Gorge finds the position admirable and exhausting in roughly equal measure.'
    },

    // ── the ones with a bar that cannot move, for four different reasons ─
    {
        factionId: 'sect-frostmirror-court',
        answer: 'no, and the bar does not move',
        why: 'The bar is a mutated ice root and it is triage rather than standing. The arts kill everybody else - that is the whole reason the Court refuses, and every applicant it turns away is somebody it has declined to bury. A favour that got somebody through this door would be a favour that buried them, which the Court has said once, in those words, to somebody in a position to have made it an order. It has never been asked twice.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody:
            'Its word moves the Cinnabar Crucible Guild, which holds from it, and nothing else - the Court has spent two centuries trying to be read as a peer rather than a junior and a body in that position cannot afford to ask anybody above it for anything.'
    },
    {
        factionId: 'sect-hollow-court',
        answer: 'no, and the bar does not move',
        why: 'The bar is evidence you could reach the last realm, and the whole arrangement rests on it. A crossing needs a protector, so every member is either somebody who will need protecting or somebody who can provide it, and there is no third contribution - a person admitted on a word would be exactly that third thing, and the Court would stop being the one place at that altitude where the arrangement works. It is the only house in the world whose bar protects the house rather than its reputation.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody:
            'It is the largest word in the world and the Court itself never uses it - the Court is not told and has no view. What its members use, personally, is a two-century friendship, which is a different instrument and is the one that places their children.'
    },
    {
        factionId: 'sect-ashen-forge-clan',
        answer: 'no, and the bar does not move',
        why: 'It is not a bar. It is a family, and a blood clan cannot recruit, so there is no door for a word to open - what it produces is the family, and every Ashen child who takes the rota arrives at the rung the clan chief stands on. Somebody asking the Ashen Forge to take a favoured child is asking it to have a different son, and the clan finds the request bewildering rather than offensive.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody: null
    },
    {
        factionId: 'sect-standing-grove',
        answer: 'no, and the bar does not move',
        why: 'Six disciples is the number at which every one of them is known by name across the province, and the deference the Grove lives on is a belief about those six specific people rather than about an institution. A seventh means a roster, a roster means administration, and administration means the belief stops being about anybody in particular - so a favoured seventh would dissolve the exact thing the favour was trying to buy into. It has taken nobody in forty-one years and would say the same to anybody.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody: null
    },
    {
        factionId: 'sect-the-severed',
        answer: 'no, and the bar does not move',
        why: 'The bar is the ledger. A member is somebody who has already cut something and written down what it was, and nobody can choose that for anybody else - so there is nothing for a word to move, and a favour asking the Severed to take an unchosen child is asking them to do to a person the one thing their entire doctrine says must be done by the person. They would refuse it as a matter of principle, which surprises everybody who has heard of them and nobody who has met them.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody: null
    },

    // ── the two with no door at all ────────────────────────────────────
    {
        factionId: 'court-kiln',
        answer: 'no bar to skip, because there is no door',
        why: 'Nobody joins it. People stand here because they were appointed - by the Deep Survey, or by a sect under it or friendly to it - and an appointment is not an admission, so there is no bar for a word to skip and no application anybody could make. What LOOKS like a bar from outside is fifteen rungs of distance; what it actually is, is that the question is decided elsewhere, about you. A favour is the wrong instrument here and the right one is a nomination, which is a different thing with a different price.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody:
            'The Keeper reports one figure a year upward and answers nothing downward, including requests. In nine hundred years the Kiln has asked nobody for anything, which the province reads as austerity and which is more simply a body with no interest in the world outside its perimeter.'
    },
    {
        factionId: 'sect-kiln-wardens',
        answer: 'no bar to skip, because there is no door',
        why: 'The same absence, four provinces away and signed by the other apex. Appointment is by the Long Cut, or by a sect under it or friendly to it, and its admission figure is what a posting requires rather than what an applicant could meet - there has been no applicant in nine hundred years because there is no way to be one. A Root Sill heir is a shape the arrangement cannot produce, and the reason is not that the bar is high: it is that the Court has no members in the sense the word usually carries.',
        andWhatItTakes: null,
        andWhetherItsOwnWordMovesAnybody:
            'Its nominations carry, inside the Long Cut, and that is the whole of its influence - a body holding the founding posting order is worth being on good terms with, and the Course Keepers have never once declined one of its names.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE APEXES THAT TRADE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two apexes that will spend a word, and what they charge for it.
 *
 * Neither admits anybody itself, so what they are trading is not a place in
 * their own house - it is the word, and a house holding a grant does not refuse
 * the granter's request. That is the same realpolitik the neutral pair already
 * runs on, applied to people instead of territory, and both of them are candid
 * inside their own records that it is a trade rather than a kindness.
 *
 * The Pavilion's absence from this record is the record's sharpest fact.
 */
export const THE_APEXES_THAT_TRADE = {
    theDeepSurvey:
        'It will place anybody, anywhere in its own arrangement, and it does not have to ask twice - a tenant holding a twelve-year grant does not refuse the body that renews it, and everybody in the Jade Gorge understands that a Survey request is a request in form only. What it takes is not stones. It takes the thing it always takes: a term added to what the house already owes, unstated, uncollected, and available. A house that has been done a favour by the Survey is a house that will be asked for something later and will not be in a position to weigh it.',
    theLongCut:
        'It will do the same and it prices it honestly, which is the difference. The Long Cut employs rather than grants, so it cannot lean on a tenant - what it has instead is a schedule, five provinces of driven ground and forty posted staff, and what it trades is a place in that schedule. The price is stated at the time, in writing, and is generally a term of work from somebody the asking house would rather have kept. Nobody has ever complained about the terms, which the Long Cut regards as evidence that it sets them correctly.',
    andWhatTheyWillNotDo:
        'Neither will move a bar that cannot be moved, and both know exactly which those are. Asking the Deep Survey to place a child at the Frostmirror gets a one-line reply saying the arts would kill them; asking either of them to place one at the Hollow Court gets no reply at all. A word is not a lever against a wall, and the two apexes are better than anybody in the world at knowing the difference - which is most of why their words are worth anything.',
    andWhyThePavilionIsNotHere:
        'Because it will not. It has the standing to move almost any bar in the province and has never once asked, on the stated ground that it would then be doing to another house what it refuses to do to itself. That is a real cost paid annually in a currency the other two spend freely, and it is the only one of the three that never has to wonder what a placement is going to be worth to somebody later.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE EXTREME CASE
// ─────────────────────────────────────────────────────────────────────────

/**
 * A newborn, taken on somebody's word, into a house whose bar they will not
 * meet for a decade.
 *
 * The thing a favour is actually for, and the reason anybody spends one.
 */
export const A_NEWBORN_WITH_POTENTIAL = {
    whatIsBeingAsked:
        'That a house take a person with nothing measurable about them except potential, now, and raise them - against a stated bar they will not meet for ten years and might never meet at all. Every house that admits at anything above zero refuses this by default, because the bar is the whole of how it decides, and a child at zero is indistinguishable from every other child at zero.',
    whyItIsWorthSpendingAFavourOn:
        'The ten years are not ten years of waiting. They are ten years of teaching that nobody else was going to give, in a house with a library, an elder and a vein, starting before the body has set - and the difference between beginning there at six and arriving there at sixteen having qualified is not ten years of progress, it is a different ceiling. That is what the word buys and it cannot be bought any other way.',
    whoCanAskForIt:
        'Somebody at Tribulation Transcendence, or comparably placed. Not because a rule says so but because a house asked to suspend its own method wants the asker to be somebody it cannot afford to disappoint, and there are very few of those - four on one mountain, one in each apex seat, and a thin scatter of everybody else, most of whom have nobody they want to spend it on.',
    andWhatTheHouseIsActuallyTaking:
        'A risk it cannot assess, which is why the price is what it is. The house has no measurement to go on and is betting on the asker\'s judgement rather than on the child; if the child turns out ordinary the house has spent a decade of teaching on somebody it would have refused, and it cannot say so to the person who asked. That is the same wash-out the postings produce, arriving by a different road.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ACCESSORS
// ─────────────────────────────────────────────────────────────────────────

const AUTHORED = new Map(FAVOUR_STANCES.map(f => [f.factionId, f]));

/**
 * What a favour is worth at this house.
 *
 * Authored where the answer is unusual, derived otherwise - and the derivation
 * is the ordinary case rather than a fallback: a house with a bar above the
 * floor can be moved, at a price, and writing that out thirty times would be
 * filler. A house at the floor has nothing to skip.
 */
export function favourStanceOf(factionId: string): FavourStance | undefined {
    const authored = AUTHORED.get(factionId);
    if (authored) return authored;

    const sect = SECTS.find(s => s.id === factionId);
    if (!sect) return undefined;

    const bar = SECT_ADMISSION[factionId]?.minOrdinal ?? sect.admissionOrdinal;
    if (bar <= 0) {
        return {
            factionId,
            answer: 'no bar to speak of',
            why: 'It admits at the floor and refuses nobody on standing, so there is nothing for a word to skip. A favour spent here buys what an afternoon\'s walk buys, which is why the greatest names in the province are worth exactly nothing at these five doors and why that was the problem the mechanic exists to solve.',
            andWhatItTakes: null,
            andWhetherItsOwnWordMovesAnybody: null
        };
    }
    return {
        factionId,
        answer: 'yes, at a price',
        why: `It admits at ${bar} and a word from somebody high enough moves that, which is the ordinary case in this world and is not corruption - a house suspending its own method for one person is doing something it can be asked to account for, and it prices it accordingly. What is being bought is the bar and nothing else: the child still has to survive the teaching.`,
        andWhatItTakes:
            'An obligation, unstated at the time and collected later. Houses at this level do not name a price for a favour because naming one makes it a transaction that ends, and an unnamed one does not.',
        andWhetherItsOwnWordMovesAnybody: null
    };
}

/** Every house whose bar will not move, with the reason. */
export function willNotBeMoved(): readonly FavourStance[] {
    return FAVOUR_STANCES.filter(f => f.answer === 'no, and the bar does not move');
}

/**
 * The houses a favour is actually needed at, which is the useful list.
 *
 * Everything with a bar above the floor and a door to come through. Derived, so
 * it cannot drift from `SECT_ADMISSION`.
 */
export function favourIsWorthSomethingAt(): string[] {
    return SECTS
        .map(s => s.id)
        .filter(id => favourStanceOf(id)?.answer === 'yes, at a price');
}
