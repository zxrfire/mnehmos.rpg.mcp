/**
 * What makes a demonic sect demonic, stated so a reader can tell six of them apart.
 *
 * `alignment: 'demonic'` is a field on the sect row and a field is not an
 * identity. Read the catalog with it as the only answer and you get one house
 * wearing six names, which is exactly what a distinctness pass exists to catch.
 * This file is the answer to the question the field is standing in for: what is
 * this body willing to do that the others are not, and who pays for it.
 *
 * THE AXIS, AND WHY IT IS ONE AXIS
 * --------------------------------
 * Every entry here answers the same two questions - WHO PAYS, and DID THEY
 * AGREE - and the six answers are different in a way that is checkable rather
 * than atmospheric:
 *
 *   The Severed          the member, who chose it, in advance, and itemised it
 *   Nine Abyss Flame     the member, who signed, but it falls due later and the
 *                        counterparty is not named in the sect's own text
 *   Storm Tyrant Court   the member, who did not choose to be taken and is
 *                        taught properly afterwards, which nobody credits
 *   Crimson Abyss Hall   the member, who was not told the rate at the point of
 *                        sale and is paid a wage in advance against it
 *   Bone Lantern Cult    the dead, who cannot be asked
 *   The Quiet Cut        a third party who is not present and cannot appeal
 *
 * Note what the axis is NOT. It is not cruelty, it is not power, and it is not
 * how much the province dislikes them - the Bone Lantern Cult is the most
 * reviled and the least dangerous, and the Severed harm nobody but themselves
 * and are hated hardest by the houses with the least to fear from them.
 *
 * FIVE SECTS AND ONE DAO HOUSE, AND THE SIXTH IS A DIFFERENT KIND OF THING
 * -----------------------------------------------------------------------
 * `house-quiet-cut` is a dao house rather than a sect: `house-*` ids are bodies
 * with civil authority and a specialisation and no territory at all. It is
 * carried here because it is filed demonic and a reader comparing the six needs
 * it in the comparison, and it is flagged with `kind: 'dao-house'` because the
 * apex doctrine below does not reach it and saying so is the point rather than
 * an omission.
 *
 * THE LEASH, AND WHY IT IS A LEDGER RATHER THAN AN OPINION
 * -------------------------------------------------------
 * A demonic sect on granted ground is not tolerated because anybody approves of
 * it. It holds a grant, a grant is a contract with three obligations - tribute,
 * the levy, and fighting when its patron fights - and alignment is not one of
 * them. See `alignmentDoctrine` on `apex-deep-survey`. Meet the three and the
 * Survey does not care what you are; fail them and the protection evaporates
 * without anybody having changed their mind about morality.
 *
 * Which produces the fact worth landing on a player who has just destroyed one:
 * they have not corrected an oversight, they have created a vacancy, and the
 * Survey's answer to a vacancy is to recognise whoever is standing on the ground
 * now. The structure survives with a new name in it. Nothing regrows and nothing
 * is avenged.
 *
 * AND THE DOCTRINE HAS A HOLE THAT TWO OF THE SIX LIVE IN
 * ------------------------------------------------------
 * Recognition is territorial: the instrument is the grant, and a grant needs
 * ground. Two of the six hold none. The Severed rents cutting houses at the
 * edge of six cities and holds no ground at all; the Quiet Cut has a standing
 * policy of leaving nothing that could be surveyed. Neither can be granted to,
 * warned by non-renewal, or replaced by recognising a successor, because there
 * is nothing to withhold. They are the strongest and the least findable of the
 * six, and the Survey has never approached either - which the Severed has
 * noticed and the Quiet Cut has drawn its own conclusion about and written
 * nothing down. That is the Survey's real exposure on this axis and it is not
 * one it has a procedure for.
 *
 * NOTHING HERE IS A RULE. Every entry describes what a body is willing to do
 * and what its standing costs it. There is no branch anywhere on `demonic`, no
 * combat modifier, no admission exception and no resolver that reads this file.
 * Take the alignment field away and every sect below still prices out exactly
 * as it does now - what changes is only that a reader can no longer tell them
 * apart, which is the whole reason the file exists.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export const DemonicStandingSchema = z.object({
    factionId: z.string().min(1),
    /**
     * Which catalog it lives in, because the apex doctrine only reaches one.
     *
     * A sect holds ground and can be recognised, granted to and replaced. A dao
     * house holds a specialisation and no territory, so a territorial doctrine
     * has nothing to grip. See `DAO_HOUSES_AND_THE_RECOGNITION_DOCTRINE`.
     */
    kind: z.enum(['sect', 'dao-house']),
    /**
     * The line, in one statable sentence. Never "it is evil".
     *
     * The test: could this sentence be moved onto any of the other five without
     * becoming false? If yes it is describing demonic-ness in general and it is
     * the wrong sentence.
     */
    theLineItCrosses: z.string().min(120),
    /** Who bears the cost. One of the six answers on the axis above. */
    whoPays: z.string().min(60),
    /**
     * Whether they agreed, and what the agreement was worth.
     *
     * The load-bearing half. Four of the six take the cost out of their own
     * members and the four differ entirely on this, which is the reason the
     * righteous houses cannot prosecute them with one argument.
     */
    didTheyAgree: z.string().min(120),
    /**
     * What it will not do, and why - the leash, from the inside.
     *
     * Never restraint out of decency. Every one of these is a body that has
     * worked out which of its own appetites would bring a consequence back to
     * somebody it cannot afford to have looking at it.
     */
    whatItKeepsLocal: z.string().min(120),
    /**
     * How it actually stands on the three obligations, or why none apply.
     *
     * Tribute, the levy, and fighting when the patron fights. This is the
     * ledger the sect's safety rests on and it is not an opinion about it.
     */
    standingOnTheContract: z.string().min(120),
    /**
     * What happens to the ground if this body is destroyed.
     *
     * The bleak fact, per body, because it is not the same bleak fact each
     * time: some of them sit on something a successor would inherit, and two of
     * them hold nothing anybody could succeed to.
     */
    ifItWereDestroyed: z.string().min(120)
});
export type DemonicStanding = z.infer<typeof DemonicStandingSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE SIX
//
// Ordered strongest first, which is also roughly the order in which the
// province stops being able to do anything about them.
// ─────────────────────────────────────────────────────────────────────────

export const DEMONIC_STANDINGS: readonly DemonicStanding[] = [
    {
        factionId: 'sect-the-severed',
        kind: 'sect',
        theLineItCrosses:
            'It treats a person as an inventory that can be itemised and spent, and it starts with its own members. Nothing it does is done to anybody else: the doctrine is that every crossing takes something eventually, so take it deliberately, in advance, at a time you choose, and cross clean. The line is not harm. It is that a bond, a memory and a name are entered in a ledger as stock.',
        whoPays:
            'The member, entirely, and nobody else at all. It is the only one of the six with no external cost whatsoever.',
        didTheyAgree:
            'Completely, in advance, and in writing, and they are shown the ledger before they are shown anything else. This is the reason the righteous houses find it the hardest of the six to prosecute and hate it the most: there is no victim to produce, no complaint to take, and every member will tell you at length that they chose it and would choose it again. The one thing the doctrine does not survive is the Quiet Cut\'s finding, which the Severed have been told and do not accept - a self-severance takes what is reachable rather than what was chosen.',
        whatItKeepsLocal:
            'It cuts nobody who has not asked. Six cities, all rented, no ground, no recruitment table and no approach to anybody who has not walked in - and the restraint is not principle, it is the only reason a body of that strength with no grant and no patron has never had a province decide about it. The moment a Severed cultivator cuts something off somebody else, the doctrine stops being a philosophy and becomes an incident, and the house knows precisely which of its arts would make that argument for it.',
        standingOnTheContract:
            'None of it applies and that is the whole of its position. It holds no grant, so there is no tribute, no levy and no obligation to fight, and there is correspondingly nothing anybody can withhold. The Deep Survey has never approached it, which the Severed have noticed and have never been able to read: it is either the largest compliment the Survey has paid anybody or evidence that a body which cannot be granted to cannot be dealt with at all, and both readings are available.',
        ifItWereDestroyed:
            'Nothing is inherited, because there is nothing to inherit - six rented halls, three portable nodes and a ledger. No vacancy opens on any vein, so the recognition doctrine has nothing to recognise, and the Survey\'s procedure produces no response of any kind. What would actually happen is that the fastest pipeline in the catalog stops, and the six cities that have been quietly sending it their refusals for four hundred years find out what they were doing with them.'
    },
    {
        factionId: 'sect-nine-abyss-flame-sect',
        kind: 'sect',
        theLineItCrosses:
            'It sells an obligation to a counterparty it cannot name. The transformation contract is shown to every applicant in full, the terms are exactly what the sect says they are, and the recovered text names nobody on the other side of it - so the sect supplies one by tradition and has done for centuries. The line is not the monstrousness of the bargain, which is disclosed. It is that the sect is brokering for a party whose existence it has never established.',
        whoPays:
            'The member, who signed, but not at signing - it falls due later, individually, and the sect is honest that it does not know the schedule.',
        didTheyAgree:
            'Yes, with the fullest disclosure of any of the six, and that is precisely what makes it arguable rather than settled. An applicant is handed the whole text before anything else and can read every clause; what nobody can read is who is on the far end, and consent to an unnamed counterparty is either the most honest transaction in the province or not a transaction at all. The sect has never pretended it is anything but demonic, which the province reads as recruitment.',
        whatItKeepsLocal:
            'The cost is paid by the individual and never by the caldera - that is the sentence the whole arrangement rests on, and the sect enforces it internally far harder than any patron enforces anything on it. An elder who lets what they have become reach the villages below the vent is a liability rather than a scandal, and the bridge is kept in poor repair on purpose for reasons that run in both directions.',
        standingOnTheContract:
            'The best of the six and by some distance. It holds from the Third Sill Court, has paid its tribute early every cycle for two hundred years, and has never been refused a renewal. Which places the strongest live demonic pipeline in the province on the Long Cut\'s books rather than the Survey\'s - so the apex with the recognition doctrine has no instrument on it at all, and the apex that does hold its grant has no doctrine about what it is.',
        ifItWereDestroyed:
            'The caldera and the vent vein are a real grant on real ground, so a vacancy opens and the Third Sill fills it, and the Sill grants to whoever is standing there on the same terms as anybody else because tribute is tribute. The lightning of it is that the vent vein is worth having and several righteous houses in the province have said publicly that it should not be held by that sect - which means the successor is likely to be one of them, holding the ground on terms it has spent two centuries condemning.'
    },
    {
        factionId: 'sect-storm-tyrant-court',
        kind: 'sect',
        theLineItCrosses:
            'It does not ask. The Court collects rather than recruits, treats a refusal as a scheduling matter rather than as an answer, and measures its own standing in cultivators taken and kept. It is the oldest and least inventive line on this list and the only one that needs no doctrine to explain it: everything else about the Court is unusual and this part is simply that it takes people.',
        whoPays:
            'The member, who did not choose to be taken - and who is then taught properly, at length, and mostly stays a century.',
        didTheyAgree:
            'No, and the part nobody credits is what happens afterwards. The world holds that the Court is a collection and what is actually true is the instruction: it teaches the only working lightning curriculum anybody has, it teaches it well, and most of what it took does not leave when it could. That is not a defence and the Court does not offer it as one. It is the reason the province has never been able to settle on a story about the place, and it is the whole gap between what the Court is known for and what it is good at.',
        whatItKeepsLocal:
            'It collects mutated lightning roots and nothing else. There are perhaps a handful in a generation, most of them die young in houses that cannot teach them, and the Court takes those - so its intake is measured in people per century and is invisible to anybody not watching for it. A body that took ordinarily talented disciples at that rate would have been ended long ago, and the Court is entirely clear that its restraint is what buys the arrangement.',
        standingOnTheContract:
            'Probationary, and the province can read the warning if it knows the vocabulary. It is a court answering directly to the Deep Survey, raised past the Kiln Court - the Survey\'s other body in the province, which issues nothing and answers nothing downward - because the curriculum is the one thing in the Jade Gorge nobody can replace and the Survey would rather administer such a thing than lease it. The last two renewals were issued for six years instead of twelve, which in the grant vocabulary is a warning delivered without a word, and the Court has not established which of the three terms it is being warned about.',
        ifItWereDestroyed:
            'The floating stone is tethered to a peak by a chain that is inspected annually and cannot be repaired, so what a successor inherits is a maintenance liability with the world\'s only lightning curriculum inside it. The Survey would recognise whoever held it, and the honest problem is that almost nobody could: the curriculum can only be worn by a mutated root, so the ground would pass to a body that could hold the stone and not read the library, and the one thing in the province nobody can replace would stop being replaced by anybody.'
    },
    {
        factionId: 'house-quiet-cut',
        kind: 'dao-house',
        theLineItCrosses:
            'It does the harm to somebody who is not in the room. Nineteen centuries of severance sold as a service: a connection concealed, a connection cut, a consequence redirected, an inheritance broken structurally rather than defied. What is cut does not grow back, the party it is cut from is not present, is not told and cannot appeal, and the house has no position whatever on whether any given cut should be made.',
        whoPays:
            'A third party, named by the client, absent from the transaction, and frequently unaware for years that anything happened.',
        didTheyAgree:
            'They were not asked and there is no mechanism by which they could have been - which is the service. The house is unusual among the six in that its own members bear no cost at all, and the moral weight of the place sits entirely in a place its practitioners never have to look at. Every institution that has publicly called for its destruction has privately commissioned it, so the denunciation and the fee are performed by the same people, and the house has built its pricing around neither side ever mentioning the other.',
        whatItKeepsLocal:
            'It leaves nothing that could be surveyed - no seat anybody has proved, four portable nodes of its own making, no name given, no face seen twice on a commission, and delivery through third parties paid not to remember. The discipline is total and it is not modesty: a body selling permanent unappealable harm survives exactly as long as nobody can produce an address. What it will not do is take work it cannot deliver through intermediaries, which rules out most of what it is offered.',
        standingOnTheContract:
            'There is no contract, because there is no ground. A dao house holds a specialisation and civil standing rather than territory, so tribute, the levy and the war obligation have nothing to attach to, and the recognition doctrine cannot reach it - see `DAO_HOUSES_AND_THE_RECOGNITION_DOCTRINE`. It has twice been paid by a party it could not identify, through three intermediaries, for cuts it was not permitted to record. It has drawn the obvious conclusion and written nothing down.',
        ifItWereDestroyed:
            'No vacancy of any kind opens, because the house occupies nothing. What ends is a capability rather than a holding: the only body in either province that can remove a thing rather than argue about it, along with nineteen centuries of accumulated method that is not written down anywhere a successor could find it. Every institution that has publicly wanted this would discover within a decade what it had actually been using, and the Ninefold Ledger, which has been reading the house\'s edges for two hundred years, would lose the only subject its best people work on.'
    },
    {
        factionId: 'sect-crimson-abyss-hall',
        kind: 'sect',
        theLineItCrosses:
            'It conceals the rate at the point of sale. The Hall pays a wage in advance, in cash, on a table outside somebody else\'s admission day, to people who were refused inside that morning - and the devouring art it then teaches them spends the practitioner, at a rate nobody was told and the Hall has never published. The line is not the tithe. It is the sequence: the money first, the terms never.',
        whoPays:
            'The member, out of themselves, at a rate that was not disclosed and that the Hall\'s own recruiters have mostly not been told either.',
        didTheyAgree:
            'They agreed to a wage, which is a real wage and is paid, and the Hall would rather be thought predatory than cheap. What they did not agree to is the arithmetic, and the Hall\'s position - stated internally and never outside - is that a person who was turned away that morning was not being offered anything else and that an undisclosed price beats no price. It produces more Foundation Establishment cultivators annually than any righteous sect in the province, out of exactly those people, which is the argument it would make if anybody asked it in a room where it could answer.',
        whatItKeepsLocal:
            'It takes only refusals. The recruiters sit outside admission days and approach nobody who has not already been turned down, which is a hard operational limit that costs the Hall real intake and buys it the one thing it needs: no righteous house in the province has ever been able to say the Hall took somebody who had a place. The sinkhole is under a town that officially does not know it is there, and keeping the town able to say that is a standing instruction.',
        standingOnTheContract:
            'It pays and it has never missed, because its recruiters understand precisely what the alternative looks like. It holds the least valuable grant in the province and holds it from the Storm Tyrant Court rather than from the Survey directly - moved there because the Survey stated in one line that one letter should cover both demonic holdings, which the province has read forty years of intent into and which was a filing decision. It has been under-declaring the Court\'s tithe by about a fifth for six years, which is the one term it is actually failing and the one nobody has checked.',
        ifItWereDestroyed:
            'A thin vein under a town nobody claims, which is the least attractive vacancy in the Jade Gorge, so the likeliest successor is nobody and the ground stays open - the exact case the Survey\'s doctrine exists to avoid and the one it is least equipped to fix, because there is nothing on that vein worth a grant to anybody. What ends immediately is the province\'s largest annual source of Foundation Establishment cultivators, and the several hundred people a year who are refused everywhere else go back to having nowhere.'
    },
    {
        factionId: 'sect-bone-lantern-cult',
        kind: 'sect',
        theLineItCrosses:
            'It uses the dead as material. Old battlefields worked in rotation in the third year after an engagement, a field wall built of fragments sorted by weight rather than by what they were, and two of its four arts are corpse work. It is the only one of the six whose cost falls on people already past objecting, which is why it is the most reviled of them and by a wide margin the least dangerous.',
        whoPays:
            'The dead, who cannot be asked, and after them the survivors who find out what a rotation year means.',
        didTheyAgree:
            'The question does not arrive, and the Cult has organised its entire practice around making sure it does not. The hundred-and-forty-year rotation is held to exist so that sites recover; the founding note says it exists so that the survivors die off first, and the Cult has genuinely forgotten the difference rather than concealed it. That single substitution is the whole moral position of the place: a piece of scheduling designed to avoid ever meeting a complainant, remembered for a century as conservation.',
        whatItKeepsLocal:
            'It works only sites nobody has been granted, which is why nobody with standing has ever been wronged by it, and it does not work a site inside three years. Members work in silence at a site and talk continuously away from one. The restraint is entirely about the calendar and not at all about the dead, and it is the reason a body that every righteous house in the province would execute on sight has been operating openly for seven hundred years.',
        standingOnTheContract:
            'Outside it, and not by choice. It holds no grant because nobody has ever granted the ground it works, so it pays nothing, sends nobody and owes no war - and it is unaware there is an apex at all. It is tolerated in the narrowest available sense: not permitted, not protected, simply not the subject of any complaint anybody with standing is entitled to make.',
        ifItWereDestroyed:
            'The battlefields are not granted, so no vacancy opens and the doctrine has nothing to say. What ends is the best ground-reading in either province - they are the finest diggers alive and can date a battlefield to the season by what is flowering on it - and it ends without anybody noticing for about a generation, because the four houses that quietly buy that reading buy it through intermediaries and would have to explain how they knew.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE CLAUSE THE TERRITORIAL DOCTRINE NEEDS AND DOES NOT HAVE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why recognising whoever holds the ground says nothing about a dao house.
 *
 * The Deep Survey's doctrine is territorial all the way down: the instrument is
 * a grant, a grant is on a vein, and the three obligations it carries - tribute,
 * the levy, fighting when the Survey fights - are all things a body standing on
 * something can be made to do. A dao house holds no ground. It holds a
 * specialisation and a civil standing, and neither can be granted, withheld,
 * renewed for six years as a warning, or handed to a successor.
 *
 * So the doctrine does not transfer, and the honest statement of that is not
 * that dao houses are exempt but that the Survey has no procedure for them. It
 * does not recognise them, because there is nothing to recognise; it does not
 * tolerate them, because toleration implies a decision that was taken; and it
 * cannot replace them, because a capability has no successor.
 *
 * What it does instead is use them, through intermediaries, in a way that
 * creates standing in neither direction and leaves no record on either side.
 * The Quiet Cut has been paid twice by a party it could not identify, through
 * three layers, for cuts it was not permitted to record, and has written nothing
 * down about who it thinks that was. This catalog does not say either, and the
 * silence is deliberate: a body whose entire architecture is that no
 * transaction can be traced does not get a traceable entry here.
 *
 * The general form, which applies to all four dao houses and not only the
 * demonic one: an institution with civil authority and no territory sits outside
 * the grant system entirely, is answerable to no apex, and is correspondingly
 * unprotected by one. That is a worse position than it sounds and the houses
 * know it. It is also why every one of them has a counter rather than a patron.
 */
export const DAO_HOUSES_AND_THE_RECOGNITION_DOCTRINE = {
    whyItDoesNotReachThem:
        'The Deep Survey\'s doctrine is territorial in every part: the instrument is a grant, a grant sits on a vein, and its three obligations are things a body standing on something can be held to. A dao house stands on nothing. It holds a specialisation and a civil standing, and neither can be granted, withheld, renewed short as a warning, or passed to a successor - so there is no version of "recognise whoever holds the ground" that has a subject.',
    soWhatTheApexDoesInstead:
        'It uses them, through intermediaries, in a way that creates standing in neither direction. That is not recognition and it is not patronage: it is a transaction between two parties who have both arranged not to be identifiable to the other, and it leaves no record on either side, which is exactly what both of them are paying for.',
    andWhyThatIsWorseForTheHouses:
        'Outside the grant system means answerable to no apex and protected by none. A sect that pays, sends and fights has somebody with an interest in its continuing; a dao house has nobody at all, and if a province decides about one there is no letter anybody could write. Every dao house has a counter rather than a patron - the Ledger reads the Quiet Cut\'s edges, Held Names holds the register of absences - and a counter is what an institution grows instead of protection when protection is not available to it.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ACCESSORS
// ─────────────────────────────────────────────────────────────────────────

const BY_FACTION = new Map(DEMONIC_STANDINGS.map(d => [d.factionId, d]));

/** The demonic standing of a faction, or undefined where it is not one. */
export function demonicStandingOf(factionId: string): DemonicStanding | undefined {
    return BY_FACTION.get(factionId);
}

/** Every demonic body of one kind. The apex doctrine only reaches the sects. */
export function demonicOfKind(kind: DemonicStanding['kind']): readonly DemonicStanding[] {
    return DEMONIC_STANDINGS.filter(d => d.kind === kind);
}
