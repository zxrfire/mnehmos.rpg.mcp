/**
 * What the ground under two people does to whether one moves the other.
 *
 * **The subject is RECOURSE**, and the file is named for the half of it that
 * came first. What a piece of ground supplies is the answer to *is there
 * anybody here who would make somebody pay for this* - and that one fact is
 * read twice, in opposite directions, depending on who it would protect. See
 * WHETHER RECOURSE PROTECTS THE ASKER OR THE TARGET, below.
 *
 * The design owner's ruling, and the whole of why this file exists:
 *
 *   > And the trust system, it should also depend on WHERE YOU ARE. a righteous
 *   > sect's town is much easier for you to trust in than a demonic sect town.
 *
 * Until this, `resolveAttempt` read the two people and everything between them
 * - standing, charm, the tie, the ledger, the ask, the purse, the room, who
 * they happen to be - and **nothing at all about where they were standing.**
 * Measured, on one seed, with the same sentence put to three people: the term
 * list was identical on a righteous house's ground, on a demonic house's
 * ground, and in a town the register carries with nobody's name against it.
 * The same stranger saying the same thing was worth exactly the same
 * everywhere in the world.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT IS NOT AN ALIGNMENT TABLE, AND THAT IS THE POINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The obvious version of this - righteous ground good, demonic ground bad - is
 * wrong twice over. It branches on what a house IS rather than on what it
 * DOES, and this directory's README already forbids the underlying move:
 * *"disposition must not be predictable from alignment... a model that let a
 * demonic robe imply a tight fist would flatten the most interesting thing
 * about the setting into a colour code."*
 *
 * So the question this file asks is not what kind of house holds the ground. It
 * is **what that house does when somebody is wronged on it** - and that
 * question already has exactly one answer in this repository,
 * {@link whenItIsDoneToOneOfOurs}, which is called here rather than copied.
 * There is no second table keyed on alignment and there must never be one: a
 * fourth alignment tomorrow changes that function and this one inherits it.
 *
 *   taken_up              somebody answers for what happens here, and lying to
 *                         a stranger has a price. The best ground to be
 *                         believed on
 *   collected             there is an authority and its interest is its own. It
 *                         writes things down and does not take a side
 *   the_member_is_priced  the house does not answer for its own people, so it
 *                         certainly does not answer for you. Being taken in is
 *                         your own failure and everybody here knows it
 *   none                  nobody answers for anything. The floor
 *
 * **And the floor being unheld ground rather than demonic ground is the
 * catalog's own ruling, not a preference.** `THE_BLOWN_GROUND.whatItMakesTrue`
 * argues it at length: *"a house on your border that eats its own disciples is
 * a house that answers a letter, keeps a compound at a fixed address, can be
 * arbitrated against... The neighbours are not tolerating demonic houses
 * because they are broad-minded. They are tolerating them because they have
 * seen eleven days of the other thing and would rather have a correspondent."*
 * Recourse is the axis, and a demonic house is a correspondent.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THERE ARE FOUR WAYS TO BE WITHOUT A HOLDER AND ONLY ONE OF THEM IS A VACUUM
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `GroundHolding` resolves FOUR answers and its own docstring says they are not
 * interchangeable: *"`unrecorded` ... is NOT the same as unheld, and a caller
 * that treats it as such has invented a vacuum out of a missing row."* Reading
 * only `holding === 'held'` collapses the other three onto `none`, which is the
 * floor, and it is wrong in both directions:
 *
 *   no_authority          The Blown Ground. No house, no court, no register, no
 *                         certified datum, so no oath binds and no boundary can
 *                         be arbitrated. This is the vacuum and it is the floor
 *   no_holder_of_record   Scarwater. Nobody's name is against the ground, INSIDE
 *                         a province that has a survey, a bench, a ledger and an
 *                         assay house. Somebody can still be complained to; it
 *                         is simply not the ground's owner, and nothing obliges
 *                         them to hear it
 *   unrecorded            the survey does not say. The absence is in the record
 *                         and not in the world, and somebody may well hold it -
 *                         the people standing here usually know who
 *
 * The ordering extends the catalog's own argument rather than inventing a
 * scale. What a piece of ground buys a stranger is *an address that can be made
 * to answer*, and the six rows are how much of one there is: a house that
 * answers for you, a house that records, a province whose apparatus reaches
 * this ground without holding it, a house that has published that it will not
 * answer, and nothing at all.
 *
 * **`unrecorded` is not on that scale, and prices at zero.** Not as a
 * compromise - because a missing row is not evidence, and the honest price of
 * not knowing is nothing. `AttemptInput.where` already rules exactly this one
 * level up: an absent reading *"means the caller does not know where this is
 * happening, which weighs nothing"*. Finding the place and finding the record
 * silent is the same epistemic state one step in, and it costs the same.
 *
 * Measured on a seeded world, which is why this mattered: of 435 people alive,
 * 231 stand on held ground, 71 on the vacuum, 20 on Scarwater-shaped ground and
 * **113 on ground the record merely does not describe** - ruins, scars, wilds
 * and seven towns. All 204 of the last three priced at the same floor as eleven
 * days of sand with no bench on it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A TERM, NEVER A GATE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `GROUND_MAX` is 0.12: under one realm of standing (0.30), under a tie at full
 * strength (0.30), under a purse (0.20) and under who somebody happens to be
 * (0.18). Somewhere trustworthy makes trust easier and never automatic;
 * somewhere lawless makes it harder and never impossible. The odds floor and
 * ceiling in `an-attempt-to-move-somebody.ts` are untouched, so the answer
 * everywhere is still *yes, and here is what it costs*.
 *
 * **And that holds in the other direction too.** Lawless ground makes a threat
 * more credible; it never makes one certain, and it is worth the same 0.12 at
 * most. `GROUND_MAX` is one number for both readings on purpose - the ground is
 * a term whichever way it is read, and two caps would be two designs.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE TRUST READING IS ABOUT STRANGERS, AND SAYS SO IN THE ARITHMETIC
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The ruling is about *the same stranger, saying the same thing*. Where the
 * town's answer matters is where there is nothing else to go on - so the term
 * is damped by whatever tie the subject already holds, and a person who has
 * known you thirty years reads you the same in a market town and in a demonic
 * house's forecourt. That falls out of one multiplication rather than out of a
 * rule about strangers, and it is what stops the ground from quietly becoming
 * a modifier on every relationship in the world.
 *
 * **The damper is trust's alone.** What makes a threat credible is what would
 * happen to the person making it, and thirty years of acquaintance does not
 * change that: a friend on ground nobody holds is exactly as unanswerable for
 * as a stranger on it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A PLACE THAT IS HAVING A BAD YEAR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `AreaStatus` says so, and **nothing here reads `kind`**, because that field's
 * own header rules it free-form content and says "nothing here reads any of
 * them". What is read is whether the status BITES - it stops something, or it
 * costs more, or it is more dangerous - which is the property every status has
 * and no status has by name. A tenth kind of trouble needs no code.
 *
 * It is counted once however many are running: a town with three troubles is
 * not three times as suspicious of you, it is a town in trouble.
 *
 * **And this contradicts `docs/world/houses/trust.md`, which is worth saying
 * out loud rather than resolving quietly.** That document rules that pressure
 * makes deception WORK - *"people believe things because they have not got time
 * to find out"* - so on its reading a besieged town should be an easier place
 * to lie in, not a harder one. The design owner's instruction is the opposite
 * and is the later of the two, so it is what is built; the document's version
 * is the more interesting mechanic and is not lost, because what it describes
 * is a cost on CHECKING and nothing in this repo prices checking yet.
 *
 * Pure. A reading in, a number and a sentence out. No state, no rolls, no I/O.
 */

import type { WhoHoldsThisGround } from '../world/ground-holder.js';
import type { AreaStatus } from '../world/what-is-true-of-a-place-right-now.js';
import type { ApproachLeverage } from '../../schema/cultivation.js';
import type { AskWeight } from './an-attempt-to-move-somebody.js';
import { whenItIsDoneToOneOfOurs, type HouseResponse } from './what-a-house-will-do-about-it.js';

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

/**
 * What happens here when somebody is wronged.
 *
 * {@link HouseResponse} answers it for ground somebody holds, and is called
 * rather than copied so a fourth alignment tomorrow arrives here for free. The
 * two rows beside it are the ones a house cannot answer, because there is no
 * house: ground with no name against it inside a province that has
 * institutions, and ground the record simply does not describe.
 *
 * They are rows here rather than a second field because the caller's question
 * is one question - *if this person lies to me, is there anybody who would make
 * them pay for it* - and a reading that answered it twice would need a rule for
 * which answer wins.
 */
export type GroundRecourse =
    | HouseResponse
    /**
     * Nobody's name is against this ground, and the province around it has a
     * survey, a bench and a register. A complaint has somewhere to go and
     * nothing obliges anybody to hear it.
     */
    | 'unheld_inside_a_province'
    /**
     * The record does not say. Not a vacuum - an absence of record, over
     * ground somebody may well hold, among people who probably know who.
     */
    | 'the_record_does_not_say';

export interface TheGroundUnderYou {
    /** What happens here when somebody is wronged. The whole of the axis. */
    recourse: GroundRecourse;
    placeName: string | null;
    holderName: string | null;
    /** True when something the world had to write down is running here. */
    underDuress: boolean;
    /**
     * Why, in the words a refusal would use.
     *
     * Kept on the reading rather than computed at the point of printing, for
     * the same reason `Proximity.reasons` is: a band with no reason attached is
     * a number in a coat, and the player is owed the route.
     */
    why: string;
}

/**
 * What is running here that bites.
 *
 * Three properties, none of them a kind: it stops something being had, it
 * raises what everything costs, or it makes the place more dangerous. A status
 * that does none of those is a status that changes nothing, and a place is not
 * in trouble because a row exists.
 */
function bites(status: AreaStatus): boolean {
    return status.stops.length > 0 || status.priceMultiplier > 1 || status.dangerDelta > 0;
}

/**
 * The ground, read for what it does to being believed.
 *
 * `statuses` is whatever is RUNNING on this area chain today - the caller has
 * `statusesInArea` for that and this file does not date-filter, because
 * deciding what is current is that module's job and doing it twice is how two
 * readings of one clock drift.
 */
export function theGroundUnderYou(
    holding: WhoHoldsThisGround,
    statuses: readonly AreaStatus[] = []
): TheGroundUnderYou {
    const recourse = whatThereIsToTakeItTo(holding);
    const underDuress = statuses.some(bites);

    return {
        recourse,
        placeName: holding.placeName,
        holderName: holding.holderName,
        underDuress,
        why: `${holding.why} ${WHAT_THAT_MEANS_FOR_A_STRANGER[recourse]}`
            + (underDuress
                ? ' And the place is having a bad year, which is not when anybody here is at '
                  + 'their most trusting.'
                : '')
    };
}

/**
 * Which of the six answers this ground gives.
 *
 * The four `GroundHolding` readings map onto them, and the mapping is the whole
 * of what this file adds to `whoHoldsTheGround`: three of the four used to
 * collapse onto `none`.
 */
function whatThereIsToTakeItTo(holding: WhoHoldsThisGround): GroundRecourse {
    switch (holding.holding) {
        case 'held':
            // A holder the sect catalog cannot place is still a holder.
            // `whenItIsDoneToOneOfOurs` answers `none` to a null alignment -
            // the vacuum - and `ground-holder.ts` says in as many words that
            // this degradation must read as "somebody holds this and I cannot
            // say what kind of house they are" rather than as unheld. So it
            // goes where every other unanswered record goes.
            if (holding.alignment === null) return 'the_record_does_not_say';
            // `ranked` is true by construction: a house that holds ground has
            // something invested in it. `wasAnAttachment` and `ask` reach only
            // the severity floor in that function, which is not what is being
            // asked for here.
            return whenItIsDoneToOneOfOurs({
                alignment: holding.alignment,
                ranked: true,
                wasAnAttachment: false,
                ask: 'a_real_favour'
            }).response;
        case 'no_holder_of_record':
            return 'unheld_inside_a_province';
        case 'no_authority':
            return 'none';
        case 'unrecorded':
            return 'the_record_does_not_say';
    }
}

/**
 * What each answer means for somebody nobody here knows.
 *
 * Keyed on the response and not on an alignment, so this reads as one sentence
 * per thing a house DOES rather than one per kind of house.
 */
const WHAT_THAT_MEANS_FOR_A_STRANGER: Readonly<Record<GroundRecourse, string>> = {
    taken_up:
        'Somebody answers for what is done here, which is the whole of why a stranger gets '
        + 'the benefit of the doubt: lying to you would cost the liar something.',
    collected:
        'Whoever holds this writes down what happens on it and takes nobody\'s side, so a '
        + 'stranger is neither vouched for nor suspected.',
    the_member_is_priced:
        'The house that holds this does not answer for its own people when they are taken '
        + 'in, so it certainly does not answer for you. Being had here is your own failure '
        + 'and everybody knows it, which is why nobody takes a stranger\'s word.',
    unheld_inside_a_province:
        'There is nobody here who answers for the ground itself. The province around it keeps '
        + 'a survey, a bench and a register, and whoever keeps this place working was never '
        + 'appointed to and would rather it went on working - so a complaint has somewhere to '
        + 'go and nothing at all obliges anybody to hear it, which leaves a stranger neither '
        + 'vouched for nor written off.',
    the_record_does_not_say:
        'What is open is what would actually happen to somebody who lied to you here, and that '
        + 'is a gap in the paper rather than a hole in the world - the people standing on this '
        + 'ground would be able to tell you. So it says nothing about a stranger in either '
        + 'direction, and a word is worth what the person saying it is worth.',
    none:
        'Nobody answers for anything here. There is no house to complain to, nothing anybody '
        + 'could be made to pay, and a stranger\'s word is worth exactly what it can be '
        + 'checked against, which is nothing.'
};

// ─────────────────────────────────────────────────────────────────────────
// THE TERM
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most the ground can ever be worth, before the ask and the tie damp it.
 *
 * Under `PER_RUNG * RUNG_CLAMP` (0.30), under `TIE_WEIGHT` (0.30), under
 * `PURSE_MAX` (0.20) and under `DISPOSITION_MAX` (0.18). Where you are is a
 * term and it is never the term: who you are, what they already make of you,
 * what you put down and who they happen to be all outweigh it.
 */
export const GROUND_MAX = 0.12;

/** What a place in trouble costs a stranger, on top of whatever the ground is. */
export const GROUND_UNDER_DURESS = 0.05;

/**
 * How much recourse there is, on -1..+1.
 *
 * Keyed on {@link GroundRecourse} rather than on an alignment, which is what
 * keeps this from being a second alignment table. The ordering is the catalog's
 * own argument extended, not a scale invented beside it: what a piece of ground
 * buys a stranger is an address that can be made to answer, and this is how
 * much of one there is.
 *
 *   taken_up                  +1     a house, and it answers for you
 *   collected              +0.25     a house, and it records
 *   the_record_does_not_say    0     see below
 *   unheld_inside_a_province -0.25   no address for this ground; the apparatus
 *                                    that makes addresses is a few days away,
 *                                    and the people who keep the place working
 *                                    have an interest in it going on working.
 *                                    Discretionary rather than owed, which for
 *                                    a stranger specifically is the wrong side
 *                                    of nothing: a body with no obligation
 *                                    helps the people it already knows
 *   the_member_is_priced     -0.6    an address that has published that it will
 *                                    not answer, on ground where being taken in
 *                                    is understood as the victim's failure. The
 *                                    catalog's argument is that this beats a
 *                                    VACUUM, and it does. It does not beat a
 *                                    province with a bench in it
 *   none                       -1    no address, no apparatus, no survey, and
 *                                    no oath that binds. The floor
 *
 * **Zero is a decision and not a midpoint.** A missing row is not evidence, so
 * it moves nothing - the same ruling `AttemptInput.where` already makes about a
 * caller that does not know where it is. Pricing ignorance as a vacuum is
 * precisely the defect `GroundHolding`'s own docstring warns about, and it was
 * the reading 113 of 435 people in a seeded world were getting.
 */
const RECOURSE: Readonly<Record<GroundRecourse, number>> = {
    taken_up: 1,
    collected: 0.25,
    the_record_does_not_say: 0,
    unheld_inside_a_province: -0.25,
    the_member_is_priced: -0.6,
    none: -1
};

/**
 * WHETHER RECOURSE PROTECTS THE ASKER OR THE TARGET.
 *
 * The design owner, asked whether the sign should flip for a threat:
 *
 *   > I agree, the more lawless somewhere is, the more credible the threat.
 *
 * **It is one property read two ways, not two properties.** Recourse is the
 * axis in both cases, and what changes is who it protects:
 *
 *   TRUST     if this person lies to me, is there anybody who would make them
 *             pay for it? Nobody, so their word is worth less.
 *   A THREAT  if this person does what they are promising, is there anybody who
 *             would make them pay for it? Nobody, so the promise is worth more.
 *
 * **It keys on the LEVERAGE and never on a verb**, which is what stops it being
 * a special case for one action. `force` is the enum member that means *the
 * credible ability to take it*, and it is the same field the world simulation
 * fills for every manoeuvre any NPC runs - so this is one rule through one
 * resolver, for the player and for everybody else. A verb added tomorrow that
 * puts force on the table gets this with no code.
 *
 * ── AND IT IS NOT THE TRUST READING NEGATED ──────────────────────────────
 *
 * Each row is read for what it means to the TARGET, and two of them come out
 * somewhere a mirror would not have put them.
 *
 * **The alignment distinction largely collapses.** `the_member_is_priced` is a
 * ruling about a house that will not avenge a member who was *outwitted*, and
 * being outwitted is not what a threat is - `what-a-house-will-do-about-it.ts`
 * says in the same breath that a demonic house is "dangerous to belong to and
 * not only to cross". A body that holds ground and can be crossed deters force
 * about as well as any other body that holds ground, so it sits beside
 * `collected` instead of near the floor. What matters to somebody weighing a
 * threat is whether anybody holds this ground at all.
 *
 * **And Scarwater is not the mirror of Scarwater.** For trust it is -0.25,
 * because a body under no obligation will not bother to vouch for a stranger.
 * The same fact does not free a threatener by as much: the people who keep an
 * unheld ford working were never appointed, but open violence on the road is
 * precisely what stops it working, so they have MORE reason to move against a
 * threat than to speak for a stranger. It is worth less to a threatener than it
 * costs a stranger.
 *
 * `the_record_does_not_say` stays at zero in both directions, for the same
 * reason in both: a missing row is not evidence either way.
 */
const RECOURSE_AGAINST_A_THREAT: Readonly<Record<GroundRecourse, number>> = {
    // A house that treats a wrong done to one of its own as a wrong done to
    // itself, and writes the name somewhere it will be read again. The most
    // any ground deters.
    taken_up: -1,
    // An authority that records and does not act. A record can be produced at a
    // bench later, which deters; it is not a pursuit.
    collected: -0.25,
    // A body that holds this ground and is dangerous to cross. Declining to
    // avenge a member who was worked is a statement about deception, not about
    // force. A hair more permissive than a court and no more.
    the_member_is_priced: -0.2,
    the_record_does_not_say: 0,
    // Nobody's ground, and a bench several days off that is under no
    // obligation - but people here with an interest in the place going on
    // working, and violence is what stops it working. SMALLER than the 0.25 it
    // costs a stranger, which is the asymmetry argued above: the un-appointed
    // keepers of an unheld ford have more reason to move against a threat than
    // to speak for somebody they do not know.
    unheld_inside_a_province: 0.15,
    // No house, no court, no register, no certified datum and no oath that
    // binds. Nothing whatever happens to you, which is why this row stands well
    // clear of the others rather than one step above them.
    none: 1
};

/**
 * Whether what is on the table is a promise of harm rather than a claim to be
 * believed.
 *
 * `force` and nothing else, for now. **`secret` is the open question** and is
 * deliberately left on the trust side rather than guessed at. Blackmail is a
 * promise to speak, so lawless ground should make it more credible - and the
 * counter-argument is real, because what a secret is worth is the damage
 * disclosure does to standing, and on ground where nobody is on a register and
 * everybody was refused at a gate somewhere there is less standing to damage.
 * Those pull opposite ways and the owner has not been asked.
 */
function isAPromiseOfHarm(leverage: ApproachLeverage | undefined): boolean {
    return leverage === 'force';
}

/**
 * How far the ground reaches into what is being asked.
 *
 * Read next to `PURSE_REACH` and `DISPOSITION_REACH`, which are the same kind
 * of table. Where the ground reaches furthest is where the only question is
 * whether to believe a stranger at all - a courtesy, an ordinary favour. It
 * reaches least at the far end, because somebody weighing the end of their own
 * standing is weighing their house and not the local magistrate. Never zero,
 * because "typically does not" is not "never".
 */
const GROUND_REACH: Readonly<Record<AskWeight, number>> = {
    a_courtesy: 1,
    a_real_favour: 1,
    against_their_interest: 0.5,
    a_betrayal: 0.2
};

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

/**
 * What the ground is worth to this attempt, as odds.
 *
 * Exported for the same reason `purseWeight` and `dispositionWeight` are: a
 * probe that cannot price the term without resolving an attempt cannot tell a
 * tuning problem from a bug.
 */
export function groundWeight(input: {
    ground: TheGroundUnderYou | null | undefined;
    ask: AskWeight;
    /**
     * How strong the SUBJECT's existing view of the asker is, 0..1.
     *
     * The damper, and it applies to TRUST only. Somebody who already knows you
     * does not need the town to tell them what to make of you - but what makes
     * a THREAT credible is what would happen to the person making it, and
     * thirty years of acquaintance does not change that. A friend on ground
     * nobody holds is exactly as unanswerable for as a stranger on it.
     */
    theirTieStrength?: number;
    /**
     * What the attempt is made with.
     *
     * The discriminator, and it is the leverage rather than the verb. See
     * {@link RECOURSE_AGAINST_A_THREAT}.
     */
    leverage?: ApproachLeverage;
}): number {
    if (!input.ground) return 0;
    const threat = isAPromiseOfHarm(input.leverage);
    const reach = GROUND_REACH[input.ask];
    const stranger = threat ? 1 : 1 - clamp(input.theirTieStrength ?? 0, 0, 1);
    const recourse = (threat ? RECOURSE_AGAINST_A_THREAT : RECOURSE)[input.ground.recourse]
        * GROUND_MAX;
    // A place having a bad year is not when anybody is at their most trusting,
    // and it is not when anybody is at their most willing to be leaned on
    // either. So it comes off what the ground is worth to the ASKER in both
    // readings, which for a threat means it comes off a positive number.
    const duress = input.ground.underDuress ? -GROUND_UNDER_DURESS : 0;
    const worth = clamp(
        (recourse + duress) * reach * stranger,
        -(GROUND_MAX + GROUND_UNDER_DURESS),
        GROUND_MAX
    );
    // Normalised, because a damped term reaches negative zero and this number
    // is printed: the mechanical channel would carry "-0 points" and a JSON
    // payload would carry `-0`, both of which read as a defect.
    return worth === 0 ? 0 : worth;
}


/** Exported so a probe can print the bars without restating them. */
export const GROUND_CONSTANTS = Object.freeze({
    GROUND_MAX,
    GROUND_UNDER_DURESS,
    RECOURSE,
    RECOURSE_AGAINST_A_THREAT,
    GROUND_REACH
});
