/**
 * The second way anybody gets into a house: somebody asked.
 *
 * Every faction in the catalog states an admission bar, and the bar is what a
 * reader assumes the roll is made of. It is not. Two routes lead to the same
 * rank and one of them is invisible from outside:
 *
 *   BY THE BAR    you met the figure, at the gate, on your own.
 *   BY THE WORD   somebody with standing asked somebody they know personally,
 *                 and you were taken in.
 *
 * TWO OUTER DISCIPLES, ONE ADMITTED AND ONE PLACED, LOOK IDENTICAL ON THE ROLL.
 * That is the whole point of writing this down. Anybody in any house might be
 * somebody's, nobody can tell from the record, and the roll cannot be read as
 * evidence of how anybody got there.
 *
 * ONE MECHANISM, AND THE REACH IS THE VARIABLE
 * --------------------------------------------
 * The route is the same at every height and what changes is how far up it
 * reaches, which is set by the standing of whoever is calling in the favour.
 * That is deliberate: one rule produces the whole social ladder rather than a
 * special case at the top.
 *
 *   somebody at the top of the world      a child placed high, at a strong court
 *   an ordinary elder                     a nephew taken as an outer disciple
 *                                         somewhere respectable
 *   somebody with nothing to trade on     nobody, anywhere
 *
 * And it explains placements the bars cannot. Wherever the catalog holds
 * somebody sitting at a rank their height does not obviously justify, this is
 * an available explanation rather than an inconsistency - check here before
 * filing it as a data error.
 *
 * IT IS THE SAME SHAPE AS A POSTING, AND NOT THE SAME THING
 * --------------------------------------------------------
 * Both are arrivals decided by somebody else about you rather than by a bar you
 * met, which is why they read alike. The difference is who decides and what it
 * makes you. A posting is an institution appointing to a job it holds, and it
 * is public: the Kiln Court and the Root Sill Court state who may appoint, and
 * a term there goes on a record other institutions read. A placement is one
 * person asking another person, it is private by construction, and it makes you
 * an ordinary member of the receiving house with no mark on you at all. See
 * `PostingSchema` in `governance-and-water-rights.ts`.
 *
 * THE FAVOUR RUNS THROUGH THE FRIENDSHIP, NEVER THROUGH THE INSTITUTION
 * --------------------------------------------------------------------
 * This is the part that is easiest to get wrong and it changes what the whole
 * arrangement is. Nobody writes to a house about a child. One person asks
 * another person they are personally on good terms with, and the receiving
 * house takes in a promising young cultivator on somebody's word. The patron's
 * own institution is not a party, is frequently not told, and in the case that
 * matters most is specifically not told.
 *
 * Which makes standing a currency rather than a decoration. Elsewhere in this
 * catalog standing is prestige; here it buys one specific thing - a place for
 * somebody you care about - and spending it is visible to exactly one other
 * person.
 *
 * AND THE CHILD IS TOLD NOTHING
 * -----------------------------
 * The identity goes to the person being asked and to nobody else, the child
 * included, and the reason is not mystique: parents know children talk. So
 * somebody placed this way grows up with a placement they did not earn and
 * cannot fully explain, sometimes a memento that was left and never explained,
 * a rough idea of the shape of it, and no name. The one person who could tell
 * them is holding somebody else's confidence.
 *
 * The common case is a disciple two provinces from anywhere who half-knows they
 * were spoken for and does not know by whom, and it should be far commoner than
 * the grand one. See `PLACEMENT_REACH` for the ladder of what a given standing
 * can actually buy, and `THE_HOLLOW_COURT_AND_ITS_CHILDREN` for the rare end.
 *
 * NOTHING HERE IS A MECHANIC. No resolver reads this file. It records how
 * arrivals happen so that a roster can be read correctly and so that a narrator
 * has an answer when a player asks how somebody got in; the actual admission
 * bars stay where they are, in `SECT_ADMISSION`, and are unaffected.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A GIVEN STANDING CAN BUY
// ─────────────────────────────────────────────────────────────────────────

export const PlacementReachSchema = z.object({
    /** What the person calling in the favour is, stated as a position. */
    patron: z.string().min(20),
    /** The highest thing they can get somebody, and where. */
    reaches: z.string().min(60),
    /** Why it stops there. Never "they are not important enough". */
    andNoFurtherBecause: z.string().min(80),
    /** How often anybody at this standing actually spends it. */
    howOften: z.string().min(40)
});
export type PlacementReach = z.infer<typeof PlacementReachSchema>;

/**
 * The ladder of what a favour is worth, top to bottom.
 *
 * Not a table anything reads - it is the shape of the rule written out so that
 * two people authoring different corners of the catalog place somebody the same
 * way. The bands are deliberately coarse, because the real variable is who
 * specifically you know rather than what rung you stand on: a Sword Elder with
 * one genuine friendship at a strong court outreaches a Court Warden with none.
 */
export const PLACEMENT_REACH: readonly PlacementReach[] = [
    {
        patron: 'Somebody at the last realm, seated, whose name is not public',
        reaches:
            'A high placement at a strong court - not an outer place but a real one, with a teacher assigned and a seat at the front of the hall, in a house that will spend on them.',
        andNoFurtherBecause:
            'The receiving house has to be able to absorb them without a story. A place that would need explaining is a place that gets explained, and at this height the whole value of the transaction is that nobody has to account for anything - so the ceiling is not the patron\'s standing but the largest favour the friend can do quietly.',
        howOften:
            'Once or twice in a life, if at all. Most of them have nobody to place.'
    },
    {
        patron: 'A seated head, a court warden, or an elder of an apex',
        reaches:
            'An inner place at a good house, or an outer place anywhere at all with a note attached that means the person will be watched rather than processed.',
        andNoFurtherBecause:
            'Above this the receiving house is spending real resources on somebody it did not assess, and a friendship is not collateral for that. What a favour at this level actually moves is attention rather than rank, and attention is most of what a young cultivator is short of.',
        howOften:
            'Several times over a long career, and the count is watched by everybody who might be next.'
    },
    {
        patron: 'An ordinary elder, a guild master, a well-regarded physician',
        reaches:
            'An outer disciple\'s place somewhere respectable, which is the commonest transaction of this kind in the world by an enormous margin.',
        andNoFurtherBecause:
            'An outer place costs the receiving house very little and is given readily, which is exactly why it is worth asking for and worth nothing to boast about. Anything above it requires the asker to be somebody the house wants something from later.',
        howOften:
            'Constantly, everywhere, and it is why intake figures never match admission bars.'
    },
    {
        patron: 'Somebody with a good name and nothing anybody needs',
        reaches:
            'A hearing. The applicant is looked at rather than turned away at the figure, which on a marginal candidate is the whole difference and on a poor one is nothing.',
        andNoFurtherBecause:
            'A favour is a debt somebody is willing to carry, and nobody carries a debt for a person who cannot repay it. This is the honest floor of the system and it is the reason the system is not a ladder out of anywhere.',
        howOften:
            'Whenever they can find somebody who will take the letter.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE RARE END OF IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The Hollow Court's children, and why nobody can find their parents.
 *
 * The extreme case of the ordinary rule above, and it has to sit correctly
 * beside three facts already established about that house: it teaches nothing,
 * it takes nobody who cannot already reach the last realm, and it is the
 * ceiling of the visible world. None of those is contradicted here, because
 * nothing in this record happens at the Court or through it.
 */
export const THE_HOLLOW_COURT_AND_ITS_CHILDREN = {
    theTiesDoNotDISSOLVE:
        'Somebody who reaches that standing arrived with a life, and the friendships in it are two and three centuries old. They do not end at the gate. The Court is not a monastery, does not confiscate anybody\'s history and has never asked anyone to give up a name they came in with - which is unremarkable everywhere else in the world and is worth stating here only because everything else about the Court is so severe that readers assume this part is too.',
    soTheyPlaceTheirCHILDREN:
        'By asking a friend at a strong court that they are personally on good terms with, exactly the way an elder two provinces away asks for an outer place for a nephew. The transaction is the ordinary one and only the reach is different: what a Seat can obtain is a real placement at a strong house, high, with a teacher assigned. The Court is not a party to it, is generally not told, and has no view.',
    andTheFAVOURRunsThroughThePerson:
        'Never through the institution. Nobody writes to the Hollow Court about a child and nobody at the Hollow Court writes as the Hollow Court about one. One person asks another person, and the receiving house takes in a promising young cultivator on somebody\'s word - which is what it does eleven times a decade for eleven other people, and this is the twelfth.',
    andTheOnlyTermIsDISCRETION:
        'The identity goes to the friend and to nobody else. There is no rule about it and there does not need to be one: naming a Hollow Court member burns the namer\'s own face, because it announces to an audience of exactly the people whose trust is your entire position that you were trusted and are not trustworthy. Nobody at that level would take money for it, and there is no sum that would make sense - the payment could not be worth what it costs. A confidence that enforces itself needs no enforcement, which is why the Court has never had to say anything.',
    andTheCHILDIsToldNothing:
        'Because parents know children talk. So what somebody in that position actually has is a placement they did not earn and cannot fully account for, a memento that was left and never explained, and a near-certainty about the shape of it - nothing else explains the placement - and no name at all. The one person who could tell them is the friend who took them in, and that person is holding the confidence of somebody at the top of the world and will not break it. Their refusal is honourable rather than cruel, and it is permanent.',
    howOftenThisIsTrueOfANYBODY:
        'Rarely, and it must stay rare or it stops being a fact about a person and becomes a birth condition. Four people hold that ground, they have been there a very long time, and most of them have placed nobody. This is something that occasionally turns out to be true about a cultivator, not a category of cultivator - and the ordinary version of the same story, a disciple in a small house who half-knows they were spoken for and does not know by whom, should be commoner than this one by a very wide margin.',
    andTheMEMENTOIsAnObject:
        'It behaves like any other object: it is a row in the ordinary catalog with an ordinary power, held by an ordinary person, and nothing about it is exempt from anything. What makes it worth having is its provenance rather than a rule attached to it - which is the same standard everything else in this world is held to, and the reason the storyline works at all is that the object is a clue rather than a key.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ACCESSORS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a patron of a given description can get somebody, by band.
 *
 * Coarse on purpose. The real variable is which specific person owes you a
 * favour, and no table can hold that.
 */
export function placementReachFor(band: number): PlacementReach | undefined {
    return PLACEMENT_REACH[band];
}

/** The bands, strongest first, for anything that wants to walk them. */
export function placementBands(): readonly PlacementReach[] {
    return PLACEMENT_REACH;
}
