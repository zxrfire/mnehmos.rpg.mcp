/**
 * Three institutions with no place for their own members' children.
 *
 * EVERYWHERE ELSE, A CULTIVATOR RAISES THEIR CHILD IN THEIR OWN HOUSE. That is
 * the normal case and it covers the entire world except these three. An
 * ordinary sect is glad to have an elder's child: it takes people who will make
 * competent elders, and the bar for that is one anybody's child might clear. No
 * favour is needed and none is called in. Do not read what follows as a general
 * mechanism - an earlier draft of this file did exactly that, made placement by
 * favour universal and scaled by standing, and the effect was to turn a sharp
 * fact about three bodies into an explanation for every anomalous placement in
 * the catalog, which is both false and lazy.
 *
 * THE THREE, AND THE TWO OPPOSITE REASONS
 * ---------------------------------------
 * All three produce the same situation - a person of high standing whose own
 * institution has no place for their own child - and they get there by opposite
 * routes, which is worth keeping visible rather than collapsing:
 *
 *   THE HOLLOW COURT      because of its BAR. It only wants people capable of
 *                         reaching immortality, which is not a high standard so
 *                         much as a different one, and most children of even
 *                         the greatest cultivators are not that. The child
 *                         fails a standard, and being told that about your own
 *                         child is hard; being the child is harder.
 *
 *   THE KILN COURT        because there is NO INTAKE AT ALL. Nobody joins
 *   THE ROOT SILL COURT   either of them. People arrive by being appointed to a
 *                         posting, by the apex above or by a sect below, and a
 *                         child cannot be appointed to a posting. There is no
 *                         standard to fail, because there is no door.
 *
 * AND WHAT FOLLOWS FROM EACH IS DIFFERENT
 * ---------------------------------------
 * The Hollow Court's discretion is absolute, so its version of this is a
 * mystery: the identity goes to the friend being asked and to nobody else, the
 * child included, and a member's child grows up with a placement they cannot
 * account for, a memento nobody has explained, a good guess at the shape of it
 * and no name.
 *
 * A posting is a public appointment and an honour that goes on a service
 * record. Everybody knows who holds one. So the postings' version is not a
 * mystery at all - the child knows exactly who their parent is - and what they
 * inherit instead is an expectation and a debt, in a house that took them in as
 * a favour to somebody who will come back with precedence and be in a position
 * to repay it. That is a different and more workable kind of story, and the two
 * should not be run together.
 *
 * NOTHING HERE IS A MECHANIC. No resolver reads this file, no admission bar is
 * altered by it, and no faction gets a rule of its own. It records why three
 * specific bodies produce a situation nobody else does, so that a roster can be
 * read correctly and a narrator has an answer when a player asks where somebody
 * came from.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export const NoPlaceForTheirOwnSchema = z.object({
    factionId: z.string().min(1),
    /**
     * Which of the two reasons, because they are opposites and the difference
     * decides everything downstream.
     */
    reason: z.enum(['the bar', 'no intake at all']),
    /** Why this body specifically cannot keep a member's child. */
    whyItCannotKeepThem: z.string().min(150),
    /** How the child is placed instead, and through whom. */
    whereTheChildGoes: z.string().min(150),
    /**
     * Whether the child is told, which is the axis the two cases differ on.
     *
     * The Court's answer is no and is enforced by nothing at all; the postings'
     * answer is that there was never anything to hide.
     */
    whatTheChildKnows: z.string().min(150),
    /** Whether the arrangement ever ends. Resolved deliberately on both. */
    andWhetherItIsPermanent: z.string().min(150),
    /** What it costs the parent, stated as a price rather than as pathos. */
    whatItCostsTheParent: z.string().min(120)
});
export type NoPlaceForTheirOwn = z.infer<typeof NoPlaceForTheirOwnSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE THREE
// ─────────────────────────────────────────────────────────────────────────

export const NO_PLACE_FOR_THEIR_OWN: readonly NoPlaceForTheirOwn[] = [
    {
        factionId: 'sect-hollow-court',
        reason: 'the bar',
        whyItCannotKeepThem:
            'It only wants people capable of reaching the last realm. That is not a high standard, it is a different one - a house content to produce a strong elder will take a promising child gladly, and a body that only wants people who could cross the Lid will not, because most children of even the greatest cultivators are not that. The Court has never made an exception, has never been asked to make one, and would be a different institution if it did: the whole reason four people at that height can protect each other through a crossing is that everybody there is either somebody who will need protecting or somebody who can provide it.',
        whereTheChildGoes:
            'To a strong house, placed by the parent asking a friend they are personally on good terms with, and the friend taking the child in on their word. The favour runs through the friendship and never through the institution - nobody writes to the Hollow Court about a child and nobody at the Hollow Court writes as the Hollow Court about one. Somebody who reaches that standing arrived with a life and two or three centuries of friendships in it; the Court does not confiscate anybody\'s history and has no view on what they do with it.',
        whatTheChildKnows:
            'The shape and not the name. The identity goes to the friend being asked and to nobody else, the child included, because parents know children talk - and the discretion needs no enforcement, because naming a Hollow Court member burns the namer\'s own face in front of exactly the people whose trust is their entire position. Nobody at that level would take money for it and no sum would make sense. So what the child actually has is a placement they did not earn and cannot fully explain, sometimes a memento that was left and never accounted for, a near-certainty about the shape of it because nothing else explains the placement, and no name at all. The one person who could tell them will not, and their refusal is honourable rather than cruel.',
        andWhetherItIsPermanent:
            'Permanent, because the parent is never leaving. A Seat does not serve a term and does not come back, so a child placed this way is placed for good and the receiving house knows it is taking a member rather than a boarder. And the placement is a gamble rather than a gift: a child placed high who cannot meet the receiving house\'s standard does not go home, because there is no home to go to - they wash out into a servant\'s position and stay, which is what a house does with somebody it was given and cannot promote. The parent placed them at a friendly strong court precisely to avoid the bar that shut them out of the Court, and the friendly court has a bar of its own. The risk was moved rather than removed.',
        whatItCostsTheParent:
            'Their child is raised by somebody else\'s house and will not be told why. Nothing else in the catalog costs anybody that, and it is the price of standing at the top of the world stated as a fact rather than as a lesson - the Court has four people on it, they have been there a very long time, and most of them have placed nobody.'
    },
    {
        factionId: 'court-kiln',
        reason: 'no intake at all',
        whyItCannotKeepThem:
            'There is no door. The Kiln takes nobody on any terms: people stand here because they were appointed to a posting, by the Deep Survey or by a sect under it or friendly to it, and a child cannot be appointed to a posting. It is not that a child would fail an assessment - there is no assessment, no admission figure anybody has ever met, and no procedure by which an application could be made. Che Yuan has turned away something over four thousand people and not one of them was ever going to be admitted.',
        whereTheChildGoes:
            'Home, which is not here. An appointee is on loan from somewhere and the child goes to the somewhere: sent by the Deep Survey, the child goes to the Survey; sent by a sect below, the child goes back to that sect. Nothing has to be arranged, because the parent\'s house is the child\'s house and the posting is only where the parent currently is. The one case that needs a favour is an appointee promoted into the apex during or after the term, who then asks for their child the way anybody asks - on somebody\'s word, openly, because a posting is a public appointment and everybody already knows who holds one.',
        whatTheChildKnows:
            'Everything. There was never anything to hide: their parent\'s name is on a gate the province has been reading for nine hundred years. What the child inherits is not a mystery but an expectation, and a debt - they are in this house because somebody who will come back from the datum with precedence asked, and everybody in the house knows it, including them. Being visibly somebody\'s is a different weight from being secretly somebody\'s and is not obviously the lighter one.',
        andWhetherItIsPermanent:
            'The appointment is temporary and the placement is not, and both parties understood that going in without either saying it. A term at the Kiln runs in decades; a child placed at the start of one is grown by the end of it, taught by the receiving house, on its roll, with its rank ladder behind them. So the Warden comes back alone, to a body that never had their child in it, and the house that raised them has a member rather than a guest - which is the actual repayment and is larger than the favour was.',
        whatItCostsTheParent:
            'A decade or three of somebody else raising them, and the certainty that the child will not come back either. It is a smaller price than the Court pays and it is paid in public, which some find harder: everybody knows exactly what was given up and can watch the account being settled.'
    },
    {
        factionId: 'sect-kiln-wardens',
        reason: 'no intake at all',
        whyItCannotKeepThem:
            'The same absence of a door, moved four provinces and re-signed. Nobody joins the Root Sill either; appointment is by the Long Cut, or by a sect under it or friendly to it, and a child cannot be appointed. What is different is only who signs, and the admission figure on its own row is what a posting requires rather than what an applicant could meet - there has been no applicant in nine hundred years because there is no way to be one.',
        whereTheChildGoes:
            'Home, by the same three routes and into a different kind of house. Sent by the Long Cut, the child goes to the Long Cut - which means to a face rather than to a sect, into an arrangement that ranks people by faces worked and deaths avoided, so what they get is not a rank but a schedule, and a schedule is a thing that can be honoured exactly. Sent by a sect below, the child goes back to that sect. Promoted into the apex, the appointee asks a favour like anybody else. The Root Sill has never been able to explain the first of the three to anybody from the Low Fall.',
        whatTheChildKnows:
            'Everything, and more than at the Kiln, because the roll here is public. Every appointee is a name somebody can read, so a child knows their parent\'s name, the term, and where it sits among nine hundred years of names above it. What they also know, and what nobody at the Kiln has to carry, is that the name is on a document one of the three apexes behaves as though does not exist - the Deep Survey has never referred to this body in correspondence, so a child of this house grows up holding a lineage that is public, verifiable and formally unacknowledged.',
        andWhetherItIsPermanent:
            'Same answer and a sharper edge. The appointment ends, the placement does not, and more Root Sill appointees stay on than Kiln ones - so a returning Warden here is often coming back to a body their child never entered while their own term has become a career. The Long Cut has no vocabulary for any of this and has never been asked for one.',
        whatItCostsTheParent:
            'The same decades, publicly, plus one thing the Kiln does not charge: the child is raised inside the patron that took the posting, which means the parent has handed the Long Cut a person as well as a term, and has done it without anybody proposing it or writing it down.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// WHAT HAPPENS WHEN A PLACEMENT DOES NOT TAKE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Washing out, which is what makes a placement a risk rather than a gift.
 *
 * It is an outcome of being placed above your ability rather than a rule about
 * any one body, and it applies wherever a child is placed - the Hollow Court's
 * children included, which is the sharpest version of it: their parent placed
 * them at a friendly strong court precisely to avoid the bar that shut them out
 * of the Court, and the friendly court has a bar of its own.
 *
 * Nothing here is a mechanic and no resolver reads it. It describes an outcome
 * the ordinary systems already produce - somebody who cannot meet a standard
 * does not meet it - and says what a house does with the person afterwards,
 * which is the part nobody had written down.
 */
export const WASHING_OUT = {
    whatItIs:
        'A child placed above their ability does not simply leave. They wash out into a servant\'s position and the house keeps them, at a level that reflects what they turned out to be - which is not cruelty and is not charity: it is what an institution does with somebody it was given, cannot promote, and cannot send back without saying so to the person who asked.',
    andWhyThereIsNoGoingHome:
        'Because the arrangement that put them there was a favour between two people, and unwinding it means one of them telling the other that their child was not enough. Nobody does that. The receiving house absorbs the outcome quietly instead, and the parent is told the child is doing well, and both parties understand the sentence.',
    whichIsWhyAFriendSaysYES:
        'Taking somebody\'s child on a favour is not pure cost, and this is the return. If the placement takes, the house has a strong member it did not have to find. If it does not, the house has a servant who is loyal, well-connected, going nowhere, and cheaper than anybody it could hire - which is a real asset and is why the answer to the asking is usually yes.',
    andWhatItProduces:
        'People who know things. A washed-out servant in a great house knows they were somebody\'s child, knows what they were supposed to become, has been inside the place for decades being spoken over, and is not on anybody\'s list of who matters. They are among the better positions in this world to be a person from, and among the worst to have underestimated.',
    andTheParentGambled:
        'Which is the honest description of what a high placement is. Succeed and the child has a start nobody could have earned. Fail and they spend a life inside that house as staff, having been given every advantage and visibly not been enough, in front of everybody who watched them arrive.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE MEMENTO
// ─────────────────────────────────────────────────────────────────────────

/**
 * The object at the centre of the one storyline this produces.
 *
 * On the Hollow Court's side only, because it is the only one of the three
 * whose child has nothing else to go on. It behaves like every other object in
 * this world: an ordinary row in the ordinary catalog, with an ordinary power,
 * held by an ordinary person, and nothing about it exempt from anything. What
 * makes it worth having is its provenance rather than a rule attached to it -
 * and that is exactly why the storyline works, because the object is a clue
 * rather than a key.
 */
export const THE_MEMENTO_AND_THE_SEARCH = {
    whatItIs:
        'Something left, kept and unexplained. It is not a token, not a key, not keyed to anybody and not a summons; take it away and the person holding it prices out as an ordinary cultivator with an ordinary possession, which is the test everything in this world has to pass.',
    whyItIsAClueAndNotAKey:
        'Because it cannot do anything. It cannot be shown to the Court, which does not answer the gate to anybody; it cannot be traced through a register, because the transaction was one person asking another and was never written down anywhere; and it cannot be used to compel the friend who took the child in, because that person is holding the confidence of somebody at the top of the world and their refusal is honourable rather than cruel. What it can do is be recognised by somebody who happens to have seen its like, which is the whole of the route.',
    howRareThisIs:
        'Rare, and it must stay rare or it stops being a fact about a person and becomes a birth condition. Four people hold that ground, they have been there a very long time, and most of them have placed nobody. This is something that occasionally turns out to be true about a cultivator, not a category of cultivator.',
    andWhatTheStoryActuallyIs:
        'Somebody who wants to find their parent in a world where the only route runs through a person who will not tell them, who is not being cruel, and who will still be alive and still refusing in a century. There is no forcing it and there is no forum for it. What there is, if the dice go a particular way, is one person deciding on their own that the confidence has outlived what it was for.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ACCESSORS
// ─────────────────────────────────────────────────────────────────────────

const BY_FACTION = new Map(NO_PLACE_FOR_THEIR_OWN.map(x => [x.factionId, x]));

/** Why this body has no place for a member's child, where that is true of it. */
export function noPlaceForTheirOwn(factionId: string): NoPlaceForTheirOwn | undefined {
    return BY_FACTION.get(factionId);
}

/** The three, grouped by which of the two opposite reasons applies. */
export function noPlaceByReason(
    reason: NoPlaceForTheirOwn['reason']
): readonly NoPlaceForTheirOwn[] {
    return NO_PLACE_FOR_THEIR_OWN.filter(x => x.reason === reason);
}
