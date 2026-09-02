/**
 * Who is actually standing on the four mountains, and how the world sees them.
 *
 * The doc half of this is `docs/world/past-the-ceiling.md`, "The Hollow Court
 * is the exception to all of it" - the age cap as a rate test, the vein, why an
 * extra member costs every existing one. This file is who is standing there and
 * what the province believes about them; the seats above them are
 * `WITHDRAWN_POWERS` in `sects.ts`. Both are indexed in `docs/world/INDEX.md`.
 *
 * The Hollow Court used to be the one faction in the catalog with nobody named
 * in it. That was defensible while its three lower rungs were empty - it was
 * four Seats and nothing else - and it left the highest acting body in the
 * world as an institution with no people, which is exactly the shape the
 * register exists to stop.
 *
 * THE COURT HAS ONE PURPOSE AND EVERYTHING HERE FOLLOWS FROM IT. It exists to
 * get its own members over the last crossing. It is not accumulating ground,
 * money, influence, students or a lineage, and anything that does not serve the
 * one thing is not its business. That single sentence answers most of what the
 * province finds strange about it: why it admits only people who could plausibly
 * reach the last realm, because there is nothing else here for anybody else to
 * do; why it draws nothing off the richest vein in the world, because the work
 * does not run on qi; why it does not recruit widely, appear often, or care
 * much what any province thinks - none of that advances the one thing.
 *
 * IT ALSO EXPLAINS WHY WHO SOMEBODY WAS DOES NOT MATTER HERE. A house, a name,
 * a famous deed - those bought the look. They stop counting at the gate.
 * Standing inside is how far along the road you are and nothing else, which is
 * why an outer disciple who arrived as the most talked-about cultivator in two
 * provinces is an outer disciple.
 *
 * ADMISSION IS PUBLIC AND STANDING IS NOT
 * ---------------------------------------
 * The door is in plain view and people watch it. When somebody already famous
 * walks up those mountains, everybody knows they went in, and the catalog does
 * not pretend otherwise - each person here has a public history anybody in two
 * provinces could recite.
 *
 * What does not leave is what happens afterwards. Which tier they hold, what
 * they are being taught, how far they have got: none of that is anybody's
 * outside. And the mechanism is not a vow of silence, it is that there is
 * almost no evidence. Court members hardly ever go out, and when they do they
 * go masked, so the province is full of confident opinions about which of the
 * people who went in is which of the figures seen since, and nobody can close
 * one.
 *
 * `worksOutsideAs` is the alias a person gives when they have to be addressed
 * outside at all. It is a title and a bare surname - "Elder Bai" - and the two
 * halves are doing different work: the surname is shared by thousands and
 * identifies nobody who does not already know, and the title is what strangers
 * attach to somebody of evident standing they cannot place. It is a courtesy
 * rather than a reading of this Court's ladder, so it is not evidence of tier
 * and sometimes contradicts it. Somebody who never leaves has no alias at all,
 * and the absence is a fact about them.
 *
 * AND THE ANONYMITY IS A GIFT RATHER THAN A DISCIPLINE. A famous name brings
 * petitions, obligations, houses wanting association and people wanting things,
 * and every hour of that is an hour not spent on the one goal. Masked and
 * unranked, none of it can reach them. Nobody imposes this; it is the condition
 * that makes the work possible, and the numbers are the mechanism - several
 * indistinguishable masked figures of that order, so no individual one can be
 * tracked, petitioned or leaned on.
 *
 * THE REGISTER IS THE OMNISCIENT VIEW AND CARRIES THE TRUTH. Real names, real
 * tiers, real ordinals, and the alias beside them. The concealment is a fact
 * about what a person IN the world can establish, not about what this catalog
 * knows - so nothing here is redacted, and any player-facing surface that shows
 * these people shows what a cultivator could actually have observed.
 *
 * NOTHING HERE IS A MECHANIC. No flag makes any of these people important, no
 * field marks anybody as a prodigy, and none of this is read by a resolver. It
 * is a roster with the ordinary columns, on the ordinary ladder.
 */

import { z } from 'zod';

import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { AwarenessSchema, type Awareness } from './hierarchy.js';

/**
 * The Court's own ladder, bottom to top, plus the one position that is not on
 * it at all.
 *
 * The four rungs match `ranks` on the sect row. `Guest of the Court` does not
 * and is deliberately absent from it: the sect row's own comment says the title
 * is honorary, given without discussion, carries no obligation in either
 * direction, and sits OUTSIDE the ladder rather than beneath it - which is
 * exactly why it can be held by somebody the Court could not promote if it
 * wanted to.
 */
export const HollowCourtTierSchema = z.enum([
    'Outer Disciple',
    'Inner Disciple',
    'Elder',
    'Seat',
    'Guest of the Court'
]);
export type HollowCourtTier = z.infer<typeof HollowCourtTierSchema>;

export const HollowCourtMemberSchema = z.object({
    id: z.string().min(1),
    /** Their own name. The register shows it; the world cannot connect it. */
    name: z.string().min(2),
    tier: HollowCourtTierSchema,
    /**
     * Index into the sect row's `ranks`, so the two cannot drift.
     *
     * Null on a Guest, and the null is the content: the title is not a rung, so
     * there is no index for it, and anything sorting the roll by rank has to
     * decide what to do with somebody who is not on the ladder rather than
     * quietly filing them at the bottom or the top of it.
     */
    rankIndex: z.number().int().min(0).max(3).nullable(),
    realmOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /**
     * Years alive. Constrained from both ends and neither end is decoration.
     *
     * Below: nobody holds a rung their age cannot account for, because the
     * climb takes what it takes. Above: nobody is older than the lifespan their
     * rung grants, and every figure here is a modest fraction of it - Void
     * Refinement gives five thousand years, Body Integration ten, Grand
     * Ascension thirty. Age is never the thing that will stop any of these
     * people, which is precisely why the road is the only question they have.
     */
    ageYears: z.number().int().min(1),
    /**
     * What the Court can actually require of them. Empty on exactly one person.
     *
     * Every other member is here to walk the road and the road is what is asked
     * of them. A Guest is asked for nothing at all, which is the only
     * arrangement available with somebody standing above the ladder, and the
     * Court took it because association and access are worth more to a body
     * with one goal than authority it could never have enforced.
     */
    whatIsAskedOfThem: z.string().min(60),
    /**
     * What they were famous for BEFORE the gate, which everybody knows.
     *
     * Admission is public. Somebody watched them walk up. This is the half of
     * each person that circulates freely, and it is why the Court can be
     * simultaneously famous and opaque - the province has a complete list of
     * who went in and no way to attach any of it to what has been seen since.
     */
    knownForBefore: z.string().min(80),
    /**
     * The alias they use when they have to act outside. Null where they never do.
     *
     * A title and a bare surname. The title is what strangers call somebody of
     * evident standing, not this Court's word for their rank, so it is not
     * evidence of tier - see the module comment.
     */
    worksOutsideAs: z.string().min(3).nullable(),
    /** Where they are on the road, in the Court's own terms rather than a figure. */
    howFarAlong: z.string().min(80),
    /** One concrete thing. A habit, a possession, a refusal. Never a flag. */
    detail: z.string().min(60)
});
export type HollowCourtMember = z.infer<typeof HollowCourtMemberSchema>;

/**
 * The Guest, and the six below the Seats. One or two at each rung, on purpose.
 *
 * The Court is not a populous body and a roster of dozens would contradict
 * everything else said about it. What is here is what a body admitting on this
 * criterion actually accumulates: a handful of people, every one of whom the
 * outside world knows the name of, none of whom the outside world can place.
 *
 * The four Seats are deliberately NOT in this list. They are enumerated with
 * their ordinals in `WITHDRAWN_POWERS` in `sects.ts` - First through Fourth at
 * 44, 43, 43 and 42 - and they are unnamed across the whole catalog on purpose.
 * That is unchanged and should stay unchanged: the roster the Court was missing
 * was the one under them.
 */
export const HOLLOW_COURT_ROSTER: readonly HollowCourtMember[] = [
    // ── Guest of the Court. Off the ladder, above everything on it. ────
    //
    // He is on the roll, and putting him anywhere else would have been the
    // wrong shape: he holds a title in the Court's own record, so his
    // connection to this house is membership rather than a relationship
    // between a faction and a passing individual. There is nothing exceptional
    // about the mechanism at all - the title already existed, the sect row
    // already describes it as honorary and obligation-free in both directions,
    // and this is the person it was always for.
    //
    // AND IT BINDS HIM TO NOTHING, which is the only arrangement available with
    // somebody standing above the ladder. The Court can require nothing of him,
    // has no authority over him, and holds no instrument that would produce
    // any. What it gets is association and access; what it gives up is every
    // claim it might have made. A body whose single purpose is getting its
    // members to the last crossing would keep the one person who has come
    // nearest to it on any terms he would accept, and these are the terms.
    //
    // It also makes his teaching of the Seats INTERNAL - a member instructing
    // members - rather than an outside visitor arriving at a closed house,
    // which is tidier and matches the Court's discretion about who is where.
    {
        id: 'hollow-court-guest-lu-sheng',
        name: 'Lu Sheng',
        tier: 'Guest of the Court',
        rankIndex: null,
        realmOrdinal: 45,
        // Six hundred and forty years since the crossing, on top of the climb
        // to the end of Tribulation Transcendence before it. His own record in
        // `wanderers.ts` carries both halves; this is the sum.
        ageYears: 1_460,
        whatIsAskedOfThem:
            'Nothing. Not a duty, not an appearance, not an answer, not a term of any kind - the title is honorary, given without discussion, and carries no obligation in either direction. The Court has no authority over him and no instrument that would produce any, and everybody involved understands the arrangement as exactly that.',
        knownForBefore:
            'He held First Seat. At Tribulation Transcendence Perfection there was nobody above him and he made the crossing from the top of this house rather than from the edge of it, and what came back could not hold a seat at all. The province knows the shape of the story and does not know it is about the same man it occasionally meets on a road.',
        // He does not need one and has never used one. The name in the outside
        // record is the name; what protects him is that nobody sees him unless
        // he intends them to.
        worksOutsideAs: null,
        howFarAlong:
            'Past the end of it, one rung above every Tribulation Transcendence alive and one below the thing he was reaching for, and both halves of that are permanent. He is the only person in the world who can tell somebody at the top of this ladder what the next step was actually like.',
        detail:
            'Comes back. Nobody sends for him, nobody can, and nobody outside the four mountains can establish that any visit ever happened - and the Third Seat delivers a dao sermon on obligation at him, at length, every single time.'
    },

    // ── Seat. Tribulation Transcendence, 41-44. Lifespan 100,000. ──────
    //
    // THE FOUR ARE MEMBERS AND THE ROLL HAS TO SHOW THEM. They were left off
    // it at first on the reasoning that the catalog leaves the Seats unnamed on
    // purpose, and that was the wrong conclusion from a true premise: a roll
    // that omits the four people the entire house is about is not discretion,
    // it is a hole - the entry said "four of its seats are out of the world
    // entirely" over a list with no seats on it, and nothing reconciled the two.
    //
    // They are still unnamed. `name` carries the OFFICE, because that is what
    // the world has for them and what the Court itself uses; nobody outside the
    // four mountains has ever had a personal name for any of these people, and
    // the register does not invent one. The ordinals are read off
    // `WITHDRAWN_POWERS['sect-hollow-court'].seats` - 44, 43, 43, 42 - rather
    // than restated, and the ages carry the ordering rule that record states:
    // by ordinal descending, then by youth, so the Second is younger than the
    // Third they stand level with.
    {
        id: 'hollow-court-first-seat',
        name: 'First Seat',
        tier: 'Seat',
        rankIndex: 3,
        realmOrdinal: 44,
        ageYears: 5_400,
        whatIsAskedOfThem:
            'To stand protector when the rota reaches them, and to be the last answer on anything the four cannot settle between them. Neither is a duty anybody imposed; they are what the seat is.',
        knownForBefore:
            'Nothing the province can name, and the blank is old rather than concealed. Whoever walked up that mountain did it long enough ago that the houses which would have known are gone, and the Court has never supplied the gap.',
        worksOutsideAs: null,
        howFarAlong:
            'At the last rung of the ladder, which is where the road ends and the crossing begins, and has been for longer than anybody outside can date. Holds that a free answer from something like them is a form of interference, and has not resolved that with the Second Seat in six hundred years.',
        detail:
            'Has never been recorded leaving the four mountains, and no account of a masked figure anywhere has ever been credibly matched to this seat.'
    },
    {
        id: 'hollow-court-second-seat',
        name: 'Second Seat',
        tier: 'Seat',
        rankIndex: 3,
        realmOrdinal: 43,
        // Level with the Third and younger, which is why this is the higher
        // seat. The ordering rule is in SEAT_ORDER and this is it applied.
        ageYears: 3_900,
        whatIsAskedOfThem:
            'The rota, like the others, and one thing the others are not asked for: the argument. The Second holds that the Court should answer questions freely and keeps saying so.',
        knownForBefore:
            'Nothing the record carries. The Court took them at a point far enough back that the only surviving statement about it is the Court\'s own, which is that they met the bar.',
        worksOutsideAs: null,
        howFarAlong:
            'One rung under the top of the ladder and level with the Third, which the seats treat as a fact about two people rather than as a race. Wants Bai Ruozhen moved up and has said so where she could hear it.',
        detail:
            'The only one of the four who has ever proposed that the Court do something outward, and has proposed it repeatedly for six hundred years without once acting on it alone.'
    },
    {
        id: 'hollow-court-third-seat',
        name: 'Third Seat',
        tier: 'Seat',
        rankIndex: 3,
        realmOrdinal: 43,
        ageYears: 4_600,
        whatIsAskedOfThem:
            'The rota. Beyond it, nothing - and the Third has filled the space with a subject of her own, which the other three tolerate at length.',
        knownForBefore:
            'Nothing the province can name. What is known of her outside is second-hand and entirely from one source, and that source has never confirmed any of it.',
        worksOutsideAs: null,
        howFarAlong:
            'Level with the Second and older, which is what puts her one seat below somebody standing at the same rung. She has never treated the ordering as anything but an arrangement.',
        detail:
            'Delivers a dao sermon on obligation, at length, to the Guest of the Court on every visit he makes, to a man permanently barred from the only obligation that would have mattered. He sits through it for the other three.'
    },
    {
        id: 'hollow-court-fourth-seat',
        name: 'Fourth Seat',
        tier: 'Seat',
        rankIndex: 3,
        realmOrdinal: 42,
        // The youngest of the four by a wide margin, which is the whole reason
        // this is the seat a disciple actually deals with.
        ageYears: 2_300,
        whatIsAskedOfThem:
            'The rota, and the teaching. The Fourth walked the stretch an outer disciple is on more recently than anybody else here, so the Court has decided that is who should be walking it with them.',
        knownForBefore:
            'The most recent admission the province was able to watch, and even that is beyond living memory for everybody except cultivators who are themselves exceptions. What it remembers is that somebody went up and did not come back down.',
        worksOutsideAs: null,
        howFarAlong:
            'Two rungs under the top and the furthest from it of the four, which is why the road below is fresher to this seat than to any of them. Carries the weakest of the Court\'s four objects and is still the equal of what the Long Cut is holding.',
        detail:
            'The only one of the four who still occasionally answers the gate, which is why every account of meeting a Seat is probably an account of meeting this one.'
    },

    // ── Outer Disciple. Void Refinement, 29-32. Lifespan 5,000. ────────
    {
        id: 'hollow-court-huang-shu',
        name: 'Huang Shu',
        tier: 'Outer Disciple',
        rankIndex: 0,
        realmOrdinal: 30,
        // Four centuries to Void Refinement is fast and not impossible, which is
        // the whole of why she was looked at. It is also a fourteenth of what
        // the rung gives her, so the clock is not her problem and never will be.
        ageYears: 386,
        whatIsAskedOfThem:
            'The road, and nothing else. She walks the stretch she is on, she is taught by whoever most recently walked it, and there is no service, no duty and no errand attached - because there is nothing here for anybody to be sent to do.',
        knownForBefore:
            'Held a collapsing formation network alone across a bad winter after the house that owned it had already left, and was still standing at it when the relief arrived four months late. Two provinces heard about it. She has never given an account of it to anybody and the version that circulates is somebody else\'s.',
        worksOutsideAs: 'Outer Disciple Huang',
        howFarAlong:
            'At the start of it, which at this house means the start of a road nobody below Void Refinement can open at all. She has been on the first stretch for sixty years and the Fourth Seat, who walked it most recently, is the one who comes down to her.',
        detail:
            'Still keeps the winter\'s node log, in the same hand, and has never been able to say why she carried it up the mountain.'
    },
    {
        id: 'hollow-court-tan-jingzhi',
        name: 'Tan Jingzhi',
        tier: 'Outer Disciple',
        rankIndex: 0,
        realmOrdinal: 29,
        ageYears: 511,
        whatIsAskedOfThem:
            'The road. The Court has never asked him for anything else and he has never been given anything to hold, which he has remarked on twice and been answered neither time.',
        knownForBefore:
            'Refused a seat at a great house twice, in writing, on grounds he published both times, and then went on working out of a rented room for another two hundred years. The refusals are better known than anything he did before or after them, and the house he refused has never commented.',
        // He has not left since he arrived, so nothing needed a name.
        worksOutsideAs: null,
        howFarAlong:
            'At the bar and barely over it. He was admitted on the second look rather than the first, which the Court records without comment and which he has mentioned to nobody, and he is the newest person on the mountains.',
        detail:
            'Writes out the stretch he has just finished before starting the next one, unasked, and the copies have started being handed to whoever arrives after him.'
    },

    // ── Inner Disciple. Body Integration, 33-36. Lifespan 10,000. ──────
    {
        id: 'hollow-court-bai-ruozhen',
        name: 'Bai Ruozhen',
        tier: 'Inner Disciple',
        rankIndex: 1,
        realmOrdinal: 35,
        // Nine hundred years to Body Integration, which is a normal pace at
        // this height rather than a fast one, and a tenth of what the rung
        // gives her.
        ageYears: 934,
        whatIsAskedOfThem:
            'The road, and the Court has begun to want something adjacent to it: the Second Seat would like her to write out the middle stretch the way the newest arrival writes out his. Nobody has put it to her.',
        knownForBefore:
            'Survived a tribulation nobody had seen the shape of before and then described it accurately enough that two houses rewrote their approach on the strength of the account. She was not asked to write it and did not sign it, and everybody worked out who it was inside a year.',
        // The alias the province knows best, and it says Elder, which she is
        // not. Nobody outside has ever had a way to find that out.
        worksOutsideAs: 'Elder Bai',
        howFarAlong:
            'Past the middle of it, and the first person in two hundred years the Seats have disagreed about in front of her: the Second Seat wants her moved up and the First does not, and they have said so where she could hear it, which she has decided was deliberate.',
        detail:
            'Goes out to ruins more than anybody else here, masked, and comes back with nothing anybody can sell.'
    },
    {
        id: 'hollow-court-wei-lianfang',
        name: 'Wei Lianfang',
        tier: 'Inner Disciple',
        rankIndex: 1,
        realmOrdinal: 33,
        ageYears: 1_102,
        whatIsAskedOfThem:
            'The road, and standing protector when the rota reaches her, which it has not yet. She has said she will and nobody has recorded her saying it.',
        knownForBefore:
            'Stood dao protector for somebody else\'s crossing, outside, without an arrangement and without being asked, and the crossing failed anyway. The province tells it as a defeat. The Court read the account and admitted her on it, and has never explained the reasoning to her or to anybody.',
        worksOutsideAs: 'Elder Wei',
        howFarAlong:
            'At the boundary the Court considers the real one, which is the transition rather than the rung, and she has been at it for eighty years without visible movement. Nobody here regards that as a problem and she does.',
        detail:
            'The only person on the mountains who asks the Seats direct questions, and the only one they answer at length.'
    },

    // ── Elder. Grand Ascension, 37-40. Lifespan 30,000. ────────────────
    {
        id: 'hollow-court-shen-quan',
        name: 'Shen Quan',
        tier: 'Elder',
        rankIndex: 2,
        realmOrdinal: 39,
        // Two thousand eight hundred years at Grand Ascension. Under a tenth of
        // what the rung gives him, and old enough to account for the climb
        // without being old for it.
        ageYears: 2_840,
        whatIsAskedOfThem:
            'The road, and the last stretch of it, which the Court would like finished. That is the closest thing to a demand anybody here has ever been under and it is not one.',
        knownForBefore:
            'Was the strongest person in a province for four hundred years and is remembered there for having done nothing whatever with it. He settled no disputes, took no students, held no ground and refused every seat offered, and when he walked up the mountains the province decided that had been the plan the whole time.',
        worksOutsideAs: 'Elder Shen',
        howFarAlong:
            'Near the end of the road and not on the Seats\' side of it. He is the person here most likely to reach the last rung next, which everybody including him treats as an ordinary schedule item rather than as an event.',
        detail:
            'Answers a question with the shortest true sentence available, which strangers find rude and the Court finds restful.'
    },
    {
        id: 'hollow-court-mo-yinlu',
        name: 'Mo Yinlu',
        tier: 'Elder',
        rankIndex: 2,
        realmOrdinal: 37,
        ageYears: 1_960,
        whatIsAskedOfThem:
            'The road, and the same stretch twice, which she is not being hurried through. The Court does not hurry anybody, on the stated ground that hurry is what the failures had in common.',
        knownForBefore:
            'Opened a sealed ground that had turned back everybody who tried it for eleven centuries, took nothing out of it, and sealed it again behind her. Nobody has ever established what was in there. Three houses have asked and she has answered all three the same way, which is that they should go and look.',
        worksOutsideAs: 'Elder Mo',
        howFarAlong:
            'Onto the last stretch and stopped on it, twice, at the same place - which the Third Seat says is the ordinary shape of that stretch and the First Seat says is not. She has not been told about the disagreement.',
        detail:
            'Keeps a mask she did not make and will not say where it came from, which on these mountains is not remarked on.'
    }
];

/**
 * How the Court moves when it has to be outside at all, which is seldom.
 *
 * Kept beside the roster rather than in it because it is one practice covering
 * everybody, and because the interesting facts are about the province rather
 * than about any individual: what people see, what they conclude, and why the
 * conclusion never closes.
 */
export const HOW_THE_COURT_IS_SEEN = {
    whereTheyAreSeenAtAll:
        'At ruins, and effectively nowhere else. The Court has one purpose and studying the dao is how the road is walked, so a ruin is not the Court acting in the world - it is the Court doing its own work somewhere a stranger happens to be standing. Outer disciples, inner disciples and elders all go. The Seats do not need to, and that is the concrete privilege of the top of this house rather than a courtesy: what a ruin holds is what somebody left behind, and what a Seat can have instead is a conversation with the Guest of the Court, who is alive at the rung above the ladder and comes back on nobody\'s schedule.',
    masked:
        'Always, and it is a house practice rather than a decision taken per occasion. The province understands what a masked cultivator of that height at a ruin probably is, so being recognised as Hollow Court is not the secret at all - being recognised as a particular person is. Some of them anonymise the voice as well, which says the caution is practised rather than improvised, and means even one who chooses to help gives away nothing that could later be matched to a name.',
    whyItIsWorthIt:
        'Not protection from enemies. Protection from their own reputations. A famous cultivator\'s name brings petitions, obligations, houses wanting association and people wanting things, and every hour of that is an hour not spent on the one goal. Masked and unranked, none of it reaches them - and the numbers are the mechanism, because several indistinguishable figures of that order cannot be told apart, so no individual one can be tracked or leaned on. Nobody imposes it. It is the condition that makes the work possible.',
    whyTheyDoNotTalk:
        'The gap, not contempt. A Court outer disciple stands at or above the head of an ordinary sect, so there is no shared footing to have a conversation on, in the way there is none between a provincial elder and a farmhand. What a cultivator at a ruin experiences is presence without engagement: somebody plainly there, plainly far above everybody in the place, saying nothing.',
    andSometimesTheyDo:
        'They are people and not demons, and typically silent is a tendency rather than a rule. Rarely, and for their own reasons, one of them will say something - show a stranger a thing or two, correct an error, answer one question - and may disguise the voice while doing it. It is uncommon enough that somebody it happens to will still be telling the story at the end of their life, and it is the reason the Court is worth meeting rather than merely worth avoiding.',
    /**
     * Where an ordinary cultivator stands on the ladder of knowing, about the
     * two different questions - and they are different questions with
     * different answers, which is the whole of the Court's opacity.
     *
     * Read on the same `Awareness` ladder everything else in the world is read
     * on, because this is not a second kind of secret. `mayBeNamed` is true of
     * the first and false of the second: the province may say that somebody
     * walked up those mountains, and may not say which of the masked figures
     * at a ruin was them.
     *
     * AND IT GOES STALE, which is the part that makes it playable. The Court
     * does not answer, so it does not report deaths either - not as a policy
     * but because telling the province anything is not its business. Every
     * other house's losses propagate; these do not. So an outside belief here
     * is not merely incomplete, it can be years or centuries WRONG, and
     * somebody can carry a name that stopped meaning anything long ago. A
     * hidden roster teaches a player nothing. A stale one can be acted on.
     */
    whatTheProvinceHolds: {
        thatSomebodyWalkedUp: AwarenessSchema.parse('named') as Awareness,
        whichOfThemIsWhich: AwarenessSchema.parse('whisper') as Awareness
    },
    andWhyNobodyCanBeSure:
        'The province holds two lists it cannot join. It knows who went in, because the door is public and famous people were watched walking up it. It knows the working names, because those circulate. What it cannot do is match one to the other, and the reason is simply that there is almost no evidence: these people hardly ever come out, so a handful of sightings across centuries will not establish that the figure under one alias is the person who went through the gate, however reasonable the guess. So there are confident identifications, some of them are probably right, and not one of them can be closed. Somebody hunting a parent inside the Court is doing inference on a matching problem with a handful of candidates - counting arrivals against names, watching ages and rungs, noticing who stopped being seen elsewhere - which is a real thing a person can be good or bad at, and better than a locked door.'
} as const;

const BY_TIER: ReadonlyMap<HollowCourtTier, HollowCourtMember[]> = (() => {
    const map = new Map<HollowCourtTier, HollowCourtMember[]>();
    for (const m of HOLLOW_COURT_ROSTER) {
        const bucket = map.get(m.tier);
        if (bucket) bucket.push(m);
        else map.set(m.tier, [m]);
    }
    return map;
})();

/** Everybody at one rung of the Court. */
export function hollowCourtTier(tier: HollowCourtTier): readonly HollowCourtMember[] {
    return BY_TIER.get(tier) ?? [];
}

/** One of them, by id. */
export function getHollowCourtMember(id: string): HollowCourtMember | undefined {
    return HOLLOW_COURT_ROSTER.find(m => m.id === id);
}

/**
 * The aliases the province actually hears, without the people behind them.
 *
 * Exported as its own list because it is the half of the roster that
 * circulates, and anything reasoning about what a cultivator could have heard
 * should be able to ask for it without being handed the join.
 */
export function workingNamesInCirculation(): readonly string[] {
    return HOLLOW_COURT_ROSTER
        .map(m => m.worksOutsideAs)
        .filter((n): n is string => n !== null);
}
