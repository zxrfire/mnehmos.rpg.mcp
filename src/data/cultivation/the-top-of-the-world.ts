/**
 * The top of the world, and whether it can be moved.
 *
 * There is no doc for this. It is the only written record of the argument, and
 * `docs/world/INDEX.md` indexes it as such - if you are about to write one,
 * read this first rather than beside it.
 *
 * Split out of `catastrophe.ts`, which had grown to fifteen exports of which
 * two were about catastrophes. This is the other thirteen: everything about
 * who could kill somebody at the top of an apex, what it would take, why
 * nobody has, and what would happen if they did.
 *
 * It is one argument in several parts and the parts do not read correctly
 * alone. The margin explains why the ordinary answer fails; the stall explains
 * why a bigger version of the ordinary answer also fails; the shadow
 * conspiracy is the only shape that solves both; the revolt is the same thing
 * with the hard part removed; and the standoff is why none of it happens.
 *
 * NOTHING HERE DECIDES A FIGHT
 * Three drafts of this file carried their own arithmetic - a margin constant, a
 * weight function, a per-apex requirement table - and every one was a second
 * opinion about combat kept in a lore file, next to an engine that already had
 * one. What is left reads the ordinary catalogs and reports. Who wins is
 * answered by the resolver that answers it for two farmhands with sticks, and
 * where a number appears here it was measured rather than chosen. The harness
 * is `scripts/playtest-conspiracy.ts`; the guard is
 * `tests/data/cultivation-standoff.test.ts`.
 *
 * The whole-house figures in this file were unmeasurable for a while and are
 * not any more. `MEASUREMENT_STATUS` at the foot records what was wrong, what
 * was retracted and what replaced it, in place, the way `catastrophe.ts` does -
 * because a number nobody can trace is worth less than a number with its
 * correction attached.
 */

import { APEX_INSTITUTIONS } from './hierarchy.js';
import { sectThreat, sectsWithASealedCeiling } from './sects.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CONSPIRACY
// ─────────────────────────────────────────────────────────────────────────

/**
 * What is required to kill somebody at the top of an apex.
 *
 * Read off the catalogs rather than asserted: `sectsWithASealedCeiling` returns
 * the houses that hold a break-glass ancestor, `sectThreat` gives the ceiling
 * each could put in the world for one use, and `APEX_INSTITUTIONS` gives the
 * ordinals that would have to be answered.
 */
export interface ConspiracyArithmetic {
    /** Ceilings available, descending, one per house that holds a seal. */
    availableCeilings: number[];
    /** What each apex head stands at. */
    apexHeads: { name: string; ordinal: number }[];
    /** Houses whose single sealed ancestor already outranks a given head. */
    housesThatAloneOutrank(ordinal: number): number;
    /** The smallest number of houses that must act together to pass an ordinal. */
    housesNeededAgainst(ordinal: number): number;
}

export function conspiracyArithmetic(): ConspiracyArithmetic {
    const availableCeilings = sectsWithASealedCeiling()
        .map(s => sectThreat(s.id)?.ceiling ?? 0)
        .filter(c => c > 0)
        .sort((a, b) => b - a);

    const apexHeads = APEX_INSTITUTIONS.map(a => ({ name: a.name, ordinal: a.powerOrdinal }));

    return {
        availableCeilings,
        apexHeads,
        housesThatAloneOutrank: (ordinal: number) =>
            availableCeilings.filter(c => c > ordinal).length,
        // Measured rather than assumed, and an earlier version of this was
        // simply wrong: it returned two whenever two houses *could* stand,
        // which contradicted its own doc comment. The harness reports a
        // single ceiling one rung clear taking a bare head 97-99 times in a
        // hundred, so one house that outranks them is already the answer and
        // the second is only needed when nobody does.
        housesNeededAgainst: (ordinal: number) => {
            if (availableCeilings.some(c => c > ordinal)) return 1;
            const ableToStand = availableCeilings.filter(c => c >= ordinal).length;
            return ableToStand === 0 ? Infinity : Math.min(2, ableToStand);
        }
    };
}

/**
 * The arrangement that makes an apex an apex, and what it costs.
 */
export const WHY_THE_HEAD_IS_PINNED = {
    theObjectDoesNotTravel:
        'An immortal object sent down by an ascended founder is not carried about. It sits where the house put it - a datum vault, an inner hall - and everything the house is rests on it being there and being theirs. So the question of where the strongest person in the house should stand answers itself.',
    andNeitherHalfWorksAlone:
        'Separate them and both become ordinary. An artifact with nobody at the last realm over it is the most stealable thing in the region. Somebody at the last realm without one is a very strong person who can be found, reached and lied to - which is precisely what the three objects prevent. Together they are unassailable; apart they are a theft and a fight.',
    soTheHeadDoesNotGoAnywhere:
        'Which is why every apex head in the catalog is pinned, one per house, and why none of them attends anything. It reads as arrogance from outside and it is not: it is the only posture the arrangement permits. An apex that sent its head across a province for a season would be offering the region a window it has never otherwise had.',
    andTheCostIsTheirOwnClimb:
        'The price is paid by the person. Ru Anwei has been at the first rung of the last realm for three hundred and eighty years and is not moving, because sitting on the object is the job and the job does not leave time for the ladder. The strongest people in the world are the ones who stopped climbing, and they stopped in order to hold something down.',
} as const;

/**
 * The deaths available to somebody at the top of an apex.
 *
 * An earlier draft of this called the conspiracy the only one. That was wrong
 * and worth correcting loudly, because the mistake was the interesting kind:
 * it treated a very hard thing as an impossible one, which is exactly the error
 * an apex would like everybody to keep making. Nobody is invincible. There are
 * two routes, both are murderous, and the artifact is why.
 */
export const DEATHS_AVAILABLE = {
    whyNotADisaster:
        'Nothing unaimed reaches them. An apex head stands at forty-one and above, and a catastrophe is a physical event in a world they stopped being physically vulnerable to several realms ago. Every apex in the region could lose its mountains in the same decade and the region would still have three of them, standing in the open, rebuilding.',

    theFirstRoute:
        'Two people of their own realm - which is the answer everywhere else on this ladder and is precisely the case the immortal weapon was sent down to absorb. It is worth naming as a route anyway, because it is the plan everybody makes and the reason the plans fail. Against anybody without an apex object behind them, two peers arriving together is arithmetic. Against a head sitting on one it is the margin, and the margin holds. See `ARTIFACT_MARGIN`.',

    theSecondRoute:
        'Sealed ancestors, woken. The band a seal can hold runs from Void Refinement to Tribulation Transcendence, so a house with a good instrument and a very old formation is holding something that outranks a living apex head - asleep, for one use, against the worst day it can imagine. Six houses in the region hold one, and one of them is not enough. A single woken ancestor a rung clear of a head is inside the margin the weapon eats, which means the best single weapon anybody in the region owns is a weapon that loses. It takes several, at once, which is what turns the second route into a conspiracy rather than a decision.',

    howManyItTakes:
        'These are the bare-duel figures, before the weapon and before the reinforcement, and they are the floor rather than the requirement. Measured against the engine\'s own confrontation resolution, two hundred seeds a pairing: a ceiling one rung clear of a head takes them ninety-eight times in a hundred; one rung short takes them twenty-two. So the Azure Cloud Pavilion at forty-one is inside the reach of a single house holding a forty-two, the Deep Survey at forty-three can be reached alone by exactly one house in the world and by nobody else without a second body, and a ceiling a full realm short loses two hundred times out of two hundred. A realm is worth four times over and no amount of nerve closes it. Then add the weapon, which eats two of his realm outright, and the stall, which means the head only has to outlast the plan rather than beat it - and the honest number stops being two and starts being everybody in the region who holds a seal, acting in the same hour, with the target\'s own courts arranged not to answer. See `ARTIFACT_MARGIN`, `THE_STALL` and `THE_SHADOW_CONSPIRACY`.',

    andThenTheArtifact:
        'Which is where every one of those figures stops being the answer, because none of them is measured against an immortal weapon. An apex holds an immortal object sent down by its own ascended ancestor, and that is not a treasure, it is the reason the house is an apex. The Deep Survey\'s holder cannot be lied to about where anything is: formations do not resolve against it, concealment does not hold in front of it, and an ambush is a thing that has to be somewhere. The Long Cut\'s is a fixed point in a world where nothing else is fixed, and ground near it cannot be moved, folded or unmade. The Azure Cloud\'s settles who somebody is, permanently and without appeal, in a world where identity is what people lose at realm boundaries and forge for a living. All three are weapons sent down by somebody who crossed, and not one of them is a sword: none of the three kills anybody by itself, and all three are worse than something that did. Two peers who can find their target, reach the ground they are standing on and be certain of who they are fighting is a fight; take any of those away and it is an execution going the other direction.',

    soItIsMegaHardRatherThanImpossible:
        'The distinction matters and the setting should never blur it. It takes a mega conspiracy - not a duel, not a raid, not two strong people with a grudge, and not one woken ancestor however good. An apex head is not unkillable - they are protected by an object that makes the ordinary methods stop working, and the ordinary methods are the only ones anybody has. So the answer is not more people. It is more people who have solved the artifact, which is a research problem rather than a military one, and which nobody has ever been observed to attempt.',

    whichIsWhyEnemiesWouldStudyItTogether:
        'And that is the one arrangement that makes the alliance assemblable, because it solves the problem the plot otherwise cannot. Houses that hold sealed ancestors are rivals before they are anything to an apex, and no rival trusts another to spend an irreplaceable weapon at the same hour on a shared enemy - not for territory, which is divisible and therefore worth cheating over. But the object is not divisible. It cannot be split, it cannot be quietly kept, and it is worth more studied than owned: several houses can read one artifact together for a century and each come away with something none of them could have derived alone. That is a prize enemies can genuinely share, and sharing it is the only reason any of them would sit in the same room long enough to plan the rest.',

    whyNobodyHasDoneIt:
        'It has never been assembled, and the reason is not scruple. The conversation cannot be had without being reported, an apex that hears the first half does not wait for the second, and the Deep Survey in particular holds an instrument that makes concealment structurally difficult - so the plot must be built against the very object it is being built to take. What protects the top of the world is not that it cannot be killed. It is that killing it requires several parties to trust each other completely, once, with no way to verify, against somebody who is very hard to lie to.',

    andIfItWorked:
        'The apex ends, and the region does not simply absorb it. The houses that did it are ordinary sects again with an empty vault where the ancestor was, holding an object none of them can claim alone, facing everybody who now knows exactly what they were willing to do and exactly what they no longer have. And the succession does not go to them - see `THE_COURTS_BELOW`.'
} as const;



/**
 * No arithmetic lives in this file any more, and the absence is the point.
 *
 * Three drafts of it did: a margin constant, a weight function, a per-apex
 * requirement table, a holder ranking. Every one of them was a second opinion
 * about who wins a fight, kept in a lore file, next to a fighting system that
 * already had one - and all of them were special cases dressed as data, because
 * they only ever applied to apexes.
 *
 * What is left is the ordinary machinery everything else already uses:
 *
 *   who is standing there   -> `powerOrdinal` on the faction, like anybody
 *   what they are holding   -> `ARTIFACTS`, ordered by power, like any object
 *   what could be woken     -> `sectThreat().ceiling`, like any sealed ancestor
 *   who arrives afterwards  -> `COURTS`, like any patron obligation
 *   who wins                -> the fighting system, like every other fight
 *
 * An apex head is a person at forty-something carrying an artifact rated in the
 * forties. That is the whole of it. Nothing below is a rule; it is a reading of
 * what those four tables already say, and if the resolver ever disagrees with
 * the reading, the reading is what is wrong.
 */

// ─────────────────────────────────────────────────────────────────────────
// THE MARGIN, THE STALL, AND WHY IT HAS TO BE A MEGA CONSPIRACY
// Colocated with the deaths above on purpose: none of these three reads
// correctly on its own. The margin is why the ordinary answer fails, the
// stall is why a bigger version of the ordinary answer also fails, and the
// shadow conspiracy is the only shape that solves both at once.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the immortal weapon sent down is worth when somebody actually comes.
 *
 * Stated as a margin rather than a power level, because that is how it behaves:
 * it does not make the head stronger, it eats a fixed amount of what arrives.
 */
export const ARTIFACT_MARGIN = {
    /**
     * Not a rule. An observation about what a rated object does when the
     * ordinary resolver reads it, which is roughly two of the holder's own
     * realm or one from above it - and if the resolver stops producing that,
     * this sentence is what changes, not the resolver.
     */
    absorbs: 'two of the holder\'s own realm, or one from above it, absorbed outright - and the real threshold is four peers, or three including somebody above him. An outcome rather than a rule: these are the numbers the resolver returned, not numbers anybody chose.',
    whyThatIsDevastating:
        'Because it is exactly the shape of every plan anybody would make. Two peers arriving together is how a cultivator at any rung on this ladder is killed, and one woken ancestor a rung clear of the target is the single best weapon any house in the region is holding. The immortal weapon absorbs both cases, and it does so without anybody writing a rule that says apex heads survive attacks: the object has a power level, the resolver adds it like it adds anything else, and that is where the number comes from. It is not that those attacks lose narrowly - they are the two attacks the founder sent the thing down to make pointless, and a house that spends its ancestor discovering this has spent its ancestor.',
    itIsAWeaponThatDoesNotStrike:
        'It is a weapon, sent down by somebody who crossed, and it is not a sword. None of the three kills anybody by itself. The Datum Lamp cannot be lied to about position, the Ninth Nail makes ground refuse to move, and the Standing Edge settles who somebody is without appeal. What they take away is what an assault needs - surprise, footing, and the ability to be somebody other than who you are - in the hands of a person already at the last realm. That is worth about two of his own realm, which is why the count has to start above that number rather than at it.'
} as const;

/**
 * The part that turns a hard fight into an impossible one: the head is not
 * trying to win.
 */
export const THE_STALL = {
    whatTheHeadIsActuallyDoing:
        'Not winning. Lasting. The head is standing in their own house, on the weapon, in the middle of an administration that exists to answer them, and every hour they hold is an hour in which somebody a province away is breaking a seal on their behalf. An apex does not have to beat what came for it. It has to still be there when the answer arrives.',
    andTheAnswerIsSealed:
        'Which is the detail that ruins the arithmetic. The reinforcement is not the two hundred cultivators a court can march - those are irrelevant at this altitude - it is the courts\' and the clients\' own break-glass ancestors, held asleep for exactly this. The Deep Survey has a court under it and a ring of client houses, several of which hold a seal; the Long Cut has two, one of them recently. An assault that breaks the margin at noon can be facing a second body above forty by evening and a third the next morning, having already spent everything it brought. The harness puts numbers on it: a head who has to hold for four rounds goes down anyway, one who holds for six survives about half the time, and one who holds for eight survives nine times in ten. The entire question is how long the courts take.',
    soTwoIsNotTheNumber:
        'The setting must never let two peers read as a plan against an apex. Two is what the weapon eats. Four is what it takes, or three with something above him among them - measured, at four hundred seeds a pairing - and getting through it only starts the clock, because the moment the house knows, seals begin coming open behind you. The requirement is not force sufficient to kill the head. It is force sufficient to kill the head faster than his own hierarchy can wake up.',
    whichIsWhatMakesItMega:
        'And that is why this cannot be a raid, a duel, a grudge or a good year. It is a decades-long project with a research problem at the front of it and an administration to suborn behind it, and the number of parties who would all have to hold their nerve is the actual defence at the top of the world.'
} as const;

/**
 * The one shape that solves both problems: somebody who already owns the
 * reinforcement.
 *
 * If a single party has spent a century acquiring quiet control of several
 * courts, then on the day the courts do not reinforce. They arrive, and they
 * arrive on the wrong side.
 */
export const THE_SHADOW_CONSPIRACY = {
    theInsight:
        'You do not out-muscle the reinforcement. You own it in advance. Every count that protects an apex head assumes the courts beneath them are theirs, because for nine hundred years the courts have been - and nothing in the arrangement verifies it, because nothing ever needed to. A court is administration: it holds ground, collects, issues grants and answers when called. Whether it answers is a habit rather than a mechanism.',
    howYouGetACourt:
        'Not by conquest, which is visible, but by succession. Courts are run by officers with lifespans measured in centuries and vacancies measured in the same, and the person who decides who fills a seat is nearly always another officer. A party patient enough to place one officer, wait, have that officer place two more, and repeat across a hundred and fifty years owns the court without an hour of fighting and without the apex above ever seeing anything but a court that kept working. Two courts is twice the same patience. Three is a lifetime of it.',
    andItBuysTheSealsToo:
        'Which is the second half and the reason it is worth doing at all. A court that answers to you does not merely fail to reinforce - it brings its own ancestor, and its clients\', and it does so wearing the livery of the house being attacked. The strike is made with the target\'s own reserve power. That is the only assembly in the setting that can put three or four bodies above forty in one place at one hour without the region noticing an alliance form, because it does not look like an alliance. It looks like the apex\'s own people going to work.',
    whatItStillCannotSolve:
        'The weapon. All of this is preparation for a fight that still has to be won on the day against something that eats two of his realm, and the Deep Survey\'s in particular makes concealment structurally hard - a plot built over a century has a century of surface for the Datum Lamp to catch. The Azure Cloud Pavilion, whose entire administration is one court of four people, has almost nothing to suborn and is the softest of the three by this reasoning and the hardest by another: the Standing Edge settles who somebody is, permanently and without appeal, which is precisely the instrument a conspiracy of borrowed liveries cannot survive contact with.',
    andTheFailureMode:
        'It fails the way everything with this many parties fails: one officer, somewhere in the hundred and fifty years, decides that being the person who warned an apex is worth more than being the person who helped kill one. The plot cannot be verified from inside and cannot be abandoned safely, and every year it exists is another year of somebody having that thought. Nobody has ever been observed to complete it, and the setting should treat that as a record rather than a law.'
} as const;



/**
 * Who, in the whole world, is actually holding something that counts.
 *
 * Measured rather than designed, and it came back sharper than the prose above
 * would have guessed - and with one entry nobody would have predicted from the
 * politics. Read off `ARTIFACTS` and `sectsWithASealedCeiling()`, which is all it takes.
 */
export const WHO_HOLDS_A_KEY = {
    theCountAmongTheHouses:
        'Among the houses that would ever want to, there are two. The forty-four asleep under the Kiln Court and the forty-two asleep under the Frostmirror. Everything else anybody is holding - the forty, the thirty-nine, the thirty-seven, the thirty-one - sits a full realm below Tribulation Transcendence and is worth nothing at this altitude, however many of them arrive. A realm is four times over and numbers do not close it.',
    soTheDoorIsTiny:
        'Which reduces the entire question of whether the top of the world can be killed by its rivals to whether two specific houses would spend two specific ancestors in the same hour. Not a coalition, not a movement, not a war - two houses, each spending the only irreplaceable thing it owns, on a plan neither can verify the other is still holding to.',
    andOneOfThemBelongsToTheTarget:
        'And the arrangement\'s worst joke is that the stronger of the two is a court federated under the Deep Survey, whose own head stands at forty-three. The one sealed weapon in the world that outranks the region\'s strongest apex is being held, asleep, by that apex\'s own client. Nothing enforces which way it points. See `OPENLY_OR_IN_SECRET`.',
    whichIsWhyTheCourtsAreTheRealTarget:
        'So a plotter\'s effort does not go into finding more strength, because there is none to find. It goes into the courts - the two keys are already enough to break the margin and nowhere near enough to survive what wakes up afterwards. The scarce resource is not power. It is silence from an administration, and that is bought over a century in appointments, which the court rosters make concrete: four named officers to a court, each seated by another officer. See `THE_SHADOW_CONSPIRACY` and `courtOfficers`.'
} as const;

/**
 * And the correction that undoes most of the drama above: the count of two is
 * a count of the houses that would want to. It is not the count of who could.
 *
 * The Hollow Court holds four Seats at forty-two to forty-four - awake, not
 * sealed, no wake condition, no once-ever cost - and four immortal weapons.
 * Two of them walking out with two of those ends any apex in the region on the
 * same afternoon. No conspiracy, no century of appointments, no borrowed
 * liveries. The reason it has never happened is not that it is hard.
 */
export const THE_HOLLOW_COURT_COULD = {
    whatTheyActuallyHold:
        'Four Seats, at forty-four, forty-three, forty-three and forty-two, and four immortal weapons between them. Set that beside an apex and the comparison is not close: the strongest apex head in the region stands at forty-three with one weapon, and the Hollow Court could field two people above or level with him, each holding one of their own, without waking anything or spending anything that does not come back. Everything written above about margins and assemblies is a description of what the hierarchy can do. The Hollow Court is not in the hierarchy.',
    andItIsNotSealedPower:
        'That is the part that makes it different in kind rather than in degree. A sealed ancestor is a once-ever object with a wake condition and a cost that usually takes the house with it - which is why six houses holding one produce no conspiracies. The Seats are awake, they are permanent, and using two of them costs the Court an interruption. Nothing about it would be a sacrifice.',
    soWhyHasNobodyDiedOfIt:
        'Because they want nothing an apex has. Everybody seated is working on the crossing and has been long enough that the province measures their presence in decades of absence. An apex is an administrative object - grants, veins, arbitration, precedence - and none of that is on the road the Seats are walking. Destroying one would cost them years of attention they are spending on the only thing they care about, and would buy them a province they have no use for.',
    whichIsAStrongerDefenceThanTheWeapon:
        'And that is worth stating plainly, because it is the real answer to how the top of the world stays where it is. The apexes are not protected from the Hollow Court by their objects, their courts, their sealed clients or their arithmetic. None of that would matter. They are protected by the fact that the one body which could do it in an afternoon is not interested, and has not been for nine hundred years.',
    andTheApexesKnowIt:
        'They do, which is why nobody at the top of the region has ever pressed the Court on anything. No grant is issued over it, no arbitration is offered to it, no precedence is claimed against it, and its governance is recorded as unassailable rather than apex for exactly this reason. The relationship is not deference and it is not fear. It is three institutions being extremely careful never to become interesting.',
    andIfItEverChanged:
        'Then the setting has a different shape overnight, and it should be playable rather than unthinkable. Interference with the vein itself has brought the Court out once, and the record of what happened does not survive. Anything that puts an apex between a Seat and the crossing - a formation that touches their mountain, a theft of something they were using, an heir taken - converts the strongest disinterest in the world into the shortest war in it.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// APEX AGAINST APEX
// The likeliest war there is, and the reason it has not happened. Measured
// through the ordinary resolver rather than designed - the harness is
// scripts/playtest-conspiracy.ts and the guard is tests/data/cultivation-standoff.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why the top two do not fight, which is not restraint.
 *
 * The obvious arrangement was checked first and was wrong in the worst way:
 * with the three immortal objects rated in the same order as the heads holding
 * them, the Deep Survey won every pairing in every configuration a hundred
 * times in a hundred, including with its own courts defecting. Three
 * institutions that cannot fight are one institution and two titles.
 *
 * So the objects were rated against what each actually does in a fight rather
 * than against how important its owner is, and a standoff came out that nobody
 * wrote: the duel and the war have different winners, and neither house can
 * choose which one it gets.
 */
export const WHY_NOBODY_MOVES = {
    theDuelGoesToTheLongCut:
        'Head against head, on their objects, with nobody called: the Long Cut takes the Deep Survey a hundred times in a hundred. The Ninth Nail is the most martial object in the world - ground that will not move, fold or be unmade is the one advantage a person cannot cultivate around - while the Datum Lamp, which is worth more than everything else in the region put together, is worth the least of the three in a room where both parties already know exactly where the other is standing. The Survey\'s object prevents surprise, and a duel has none.',
    andTheWarGoesToNOBODY:
        'Whole houses, everybody called, every seal broken: the Survey takes the Long Cut sixteen times in a hundred and the Long Cut takes the Survey none. Neither of them can finish it. Five bodies against five, two grant systems, two courts apiece and a client ring each - what that produces is not a winner, it is a war that goes on until both houses are smaller and the region is administered by whoever was not in it.',
    soTheOnlyMoveIsTheOtherHouseSCOURTS:
        'Which leaves exactly one lever on the board, and it is not a weapon. If the Long Cut\'s courts change sides, the Survey wins sixty-nine times in a hundred. That single number is worth more than every object, every sealed ancestor and every rung of cultivation in the catalog put together, and it is not won in a fight - it is won in a grant book, over decades, by being the patron a court would rather have. The two strongest institutions in the world are locked in a competition to be reasonable.',
    andTheCourtsKnowExactlyWhatTheyAreWorth:
        'They do, and it is the reason a court is administration rather than a believer. It holds ground it will still be holding next year under whichever name wins; the attacking apex will back it, and that offer is credible precisely because an apex that punished a defector would never be offered another one. So the court\'s question was never who is right. It is who will be above it in ten years, and whether the answer will remember what it did.',
    andItHasHappenedOnce:
        'The Root Sill Court answered the Deep Survey for nine hundred years and does not any more. The Survey reposted it - which is a thing you can do to a posting and to nothing else in the world - and most of the Wardens declined the reposting and walked, and the Long Cut offered them a schedule and they took it. No fighting, no announcement, no betrayal anybody could name. What went with them was not a grant book: it was the roll, the founding posting order, and a claim on the strongest sealed thing anybody has established the existence of, which the Long Cut acquired by taking in some disaffected appointees and never having to say a word. It is the largest thing that has happened at the top of the world in nine centuries and there is no battle in it anywhere.',
    andThePavilionIsTheReasonNEITHEROfThemMoves:
        'The Azure Cloud Pavilion is the shallowest house on the board rather than the emptiest one - one body at the last realm, the next name three full stages below it, and a single four-person court against the others\' courts and client rings - and either of the other two can take it in a day - the Survey ninety-nine times in a hundred, the Long Cut a hundred. Neither will, and the reason is not mercy. Whoever does it walks out of that mountain having spent a war on a house at forty-one holding the most martial object in the world, and then has to stand in front of the third apex the same season: measured, the Survey survives that meeting twice in a hundred and the Long Cut not once. Taking the weakest house in the region is the single most reliable way to stop existing that either of them has available.',
    whichIsWhatSheActuallyHolds:
        'So the Pavilion\'s power is not its own strength and never was. It is the certainty that anybody who spends themselves on it is next - and behind that, the thing nobody will put a number on: see `THE_ANCESTOR_WHO_MIGHT_ANSWER`. Ru Anjing left a house that cannot win anything and cannot be attacked, which is a stranger legacy than an army and a considerably more durable one - and the province, which reads the Pavilion as the harmless one, is describing the only faction on the board that has never had to be careful.',
    andSheDoesNotJOINAnything:
        'And she does not intervene in theirs, which is the other half and the half everybody gets wrong. When the Survey and the Long Cut go at each other the Pavilion sits it out - measured, a Survey that somehow won that war would still take her ninety-six times in a hundred afterwards, so there is no moment in it where walking in improves her position. She is not a balancer, a kingmaker or a third party to their quarrel. She is a house that cannot be attacked and does not attack, and the distinction matters because two centuries of Low Fall commentary has assumed the first thing means the second.',
    soTheTopTwoAreLockedBySomethingElse:
        'What holds the Survey and the Long Cut apart is not her. It is each other: sixteen out of a hundred one way, none the other, five bodies against five, and a defection in either grant book worth more than every object in the region. Their standoff is administrative and hers is arithmetic, and the two have nothing to do with one another - which is why the province, which insists on describing all three in the same sentence, has never once predicted what any of them would do.',
    andItIsTHREEHousesForAReason:
        'Which is why the number is three rather than two. Two apexes in a province is a war with a winner; a third makes attacking the weak one lethal and leaves the strong two to deadlock each other on their own terms. None of the three can be removed without the other two discovering what they are actually worth, and none of them wants to find out.',
    andTwoOfThemTogetherIsTheOnlyLeverLeft:
        // Re-measured. This used to say exactly one of the three alliances
        // could win and the other two never could. All three win, every time,
        // and the finding is better for it: the lever exists three times over
        // and is unusable three times over, for the same reason each time.
        'Which leaves the alliance, and it was measured too. Two apexes against the third wins - all three pairings, a hundred times in a hundred, which is the one thing on this board that is not close. Any two of them can end any third whenever they choose to. The lever is not rare and it is not hidden; it is simply held at both ends by people who have each worked out what the other does with it afterwards.',
    andTheMorningAfterIsWhyItHasNotHappened:
        // Was "ninety-nine times in a hundred", which contradicted
        // `theDuelIsNotTheWar` twenty lines up saying "a hundred times in a
        // hundred" about the same pairing. Re-measured: 100%, over 300 seeds
        // and again over 3,000. The head-to-head figures are the ones that
        // still reproduce, because two bodies a side resolve inside the round
        // budget. See `MEASUREMENT_STATUS`.
        'Because the war is not the last thing that happens that season. Put the two of them alone in a room on the evening of their victory and the Long Cut takes the Deep Survey a hundred times in a hundred - forty-five against forty-three, with no courts left in it and nothing to hide behind. The Survey does not need to be told this. Joining the only alliance that can win means winning, and then standing in front of the one person in the world who beats it, having just spent a war proving it will do that sort of thing. The alliance fails on the arithmetic of the following morning rather than on the arithmetic of the fight.',
    andSheOnlyHasToREACHOne:
        'And that is before the Pavilion does anything deliberate. Ru Anwei cannot beat two houses - three bodies against twenty-three, and the measured result is that she never lays a hand on either head, because at that scale the people who matter are behind everybody else. What she can do is decline to fight the battle they brought and go for one man: head to head, on the objects, she takes the Deep Survey\'s ninety-seven times in a hundred. So the Survey cannot be in the room. Not cannot win - cannot be present, because the whole of its position is a person who has not left a chamber in four hundred years and the one thing the Pavilion is for is making sure that if he ever does, it is the last day of it.',
    whichIsWhyTheAllianceIsNotEvenDiscussed:
        'Two houses that could take the Pavilion between them, and neither can be the one standing next to the other when it is done. The Long Cut cannot attack alone and would not survive the Survey\'s clients; the Survey cannot attack at all without putting its head somewhere Ru Anwei could get to it; and both of them, if they somehow managed it, would wake up in a province with one apex fewer and every reason to find out which of them it was. The proposal has never been made. It is not a secret and it is not forbidden - it is simply a plan that dies the moment either party works out who is holding it.',
    andNoneOfThisHasToBeEven:
        'The peace does not rest on the three of them being matched, and writing it that way would be a worse setting than the one that exists. It rests on nobody being certain. An apex is already at the top of the world - it has the vein, the grants, the object and the centuries - and the return on winning is a little more of what it already has, while the price of losing is all of it. At those stakes sixteen out of a hundred is not an opportunity and neither is sixty-nine; both are a way to stop existing, chosen voluntarily, by somebody who did not have to. Nobody at that altitude gambles, and the arrangement only requires that nothing be a sure thing.',
    whichIsWhyTheWeakestOneIsSafeToo:
        'And it is why the Pavilion is not eaten despite losing everything on paper. Certainty is not the only thing missing; so is the point. The whole prize is a mountain and an object that cannot be taken off a corpse quietly - and taking it would tell the one rival who beats you in a duel exactly what you are willing to do. The bar an apex applies is not "would I win". It is "is there any version of this where I lose", and there always is.',
    andWhatWouldBreakIt:
        'An object changing hands, a court changing patrons, or the Pavilion ceasing to exist. Nothing else on the board matters - not a death, not a succession, not a grant. Two apexes in this province is a war with a winner, so the fastest route to the largest change in the region is not attacking either of the strong houses: it is removing the weak one, which is precisely what neither of them can safely do. The day the Ninth Nail leaves the Long Cut, the Survey can travel; the day a second court moves, the war stops being unwinnable. Which is why the two of them, who agree on nothing, watch each other\'s grant books far more closely than each other\'s vaults.',
    soNothingOnTheBoardIsWorthDOING:
        'Which is the finding the whole arrangement turns on, and it was swept rather than argued. Every move available to every apex, measured, with the bar an apex would actually apply - take the target AND still be standing in front of the house that did not fight - and the best move anybody has comes out clean three times in a thousand. It is the Long Cut, against the Pavilion, and it is the only entry on the board above zero. Not zero, and the difference matters: nothing here is forbidden, impossible or ruled out, and a setting where the top of the world literally cannot be moved would be a worse one than a setting where moving it is simply a terrible idea. Three in a thousand is a real number. It is also nobody\'s plan.',
    andTheREASONIsTheThirdHouseRatherThanTheFight:
        'And the sweep says WHY, which it never used to be able to. Winning is not the hard part and for two of the three it is barely a part at all: the Long Cut takes the Deep Survey ninety-nine times in a hundred with everybody mobilised, and the Pavilion takes the Deep Survey eighty-eight. What none of them can do is the second thing. Across every ordering of every pair, the house that wins the war and then meets the third house survives it zero times in a thousand - not rarely, not usually not, never. The arrangement is not held together by anybody being unable to win. It is held together by the evening after the victory, and that is a different and much more durable kind of peace.',
    andTheThingThatWouldBreakItIsAnOBJECT:
        // Re-measured, and the old figures are retracted rather than adjusted:
        // this said thirty-two and twenty-eight for a second object and five
        // per cent for a second person, and concluded "a person is worth almost
        // nothing". The first half survives and the second half does not. See
        // `MEASUREMENT_STATUS`.
        'One more immortal object arriving from above does it, and it does it enormously. Sent a second, the Long Cut\'s move on either neighbour goes to ninety-seven and ninety-eight per cent; the Deep Survey\'s on the Long Cut goes to forty-seven; the Pavilion\'s on the Long Cut goes to fifty. Every one of those is from nobody\'s plan to somebody\'s, in the time it takes to hand a person a box, and no house on the board is exempt.',
    andAPersonIsNotWorthNothingAfterAll:
        // The correction. The old sentence was the better line and it is not
        // what the resolver says.
        'The catalog used to say a person was worth almost nothing at this altitude and an object was worth the region, which was tidy and is half wrong. Give the Deep Survey a second cultivator at forty-four and its best move moves from nothing to three in a thousand - almost nothing, exactly as claimed. Give the LONG CUT one and it takes the Pavilion sixty-five times in a hundred and the Survey thirty-five. Same gift, same rung, two houses, and the difference is not close.',
    andWhatDecidesItIsHowManyTheyAlreadyHave:
        'What separates them is what the gift lands on. The Deep Survey is one seated person and an instrument, and a second body standing next to somebody who has not left a room in four hundred years does not change what the Survey is; it mobilises eight and the eighth is not the problem. The Long Cut mobilises fifteen, and a fifteenth thing at the last realm arrives on top of a position that was already winning its wars and losing only the evening afterwards - which is precisely the margin a second body closes. So an object is worth more than a person to everybody, and how much more depends entirely on how many people you had already. That is not the neat claim. It is the one that is true, and it explains something the neat one never could: why the two of them watch each other\'s grant books more closely than each other\'s vaults, which this file has always said and could not previously account for.',
    whichIsWhyTheyWatchTHESKY:
        'So the thing the top of the world is actually afraid of is not each other and never was. It is an ancestor on the far side of the Lid deciding, for reasons nobody down here will ever be told, to send a second thing down to somebody. That is the only event that turns a province where nothing is worth doing into a province where something is - it cannot be prevented, negotiated, predicted or answered, and it has happened four times in nine hundred years. Every apex in the region has spent centuries building a position that a stranger who is no longer a person could end by making a gift.',
    andTheReasonTheZEROHoldsIsUnderTheInnerHall:
        'The Pavilion is one woman at forty-one and the sweep still says almost nobody can touch her, and the difference is a chamber Ru Anjing had cut in the last of her eleven years. Xie Wangchen went under at forty-one - level with Ru Anwei, not above her - before she crossed, whole, at peace, as one item in a plan she never finished explaining - her closest friend of two centuries, Ru Anwei\'s own senior, sealed by arrangement rather than by disaster. Take the Pavilion and you have to take him too, and unlike every other sealed ancestor in the region there is not one question anywhere about whose side he comes up on. He is not stronger than the woman he is under the floor for, and he does not need to be: every count in the region has the Pavilion at one body, and the largest proportional change available to any faction in this setting is having two. Four people know. The number every rival is working from is exactly half right.',
    andTheSameSweepSaysThePavilionIsTheKEYSTONE:
        'Read the other way, the sweep says something the Low Fall would find absurd: give the weakest house in the region anything at all - a second object, a second body at the last realm, it does not matter which - and the board goes completely inert. Every move by everybody drops to zero. The Azure Cloud Pavilion is not a junior partner in this arrangement, it is the load-bearing member, and the two houses that could crush it are the two whose safety depends on nobody ever doing so.',
    andItIsCheckedRatherThanAsserted:
        'Every pairing is measured in both configurations whenever the suite runs, off the same resolver that settles a tavern brawl, and the full worth-it sweep including the perturbations lives in scripts/playtest-conspiracy.ts. The test does not demand that the three be evenly matched - they are not, and should not be. It demands that no house be able to take everything without risking anything, and that the balance still break when somebody is handed something new, because a standoff that survived a second object would not be a standoff, it would be a rule.'
} as const;


// ─────────────────────────────────────────────────────────────────────────
// THE REVOLT
// The scenario the catalog had the least written about, which the exhaustive
// sweep found by simply running it: everything under an apex, turning on it
// at once. It is the conspiracy with the hard part removed, and the numbers
// are not close.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What happens when a house's own people come up the stairs.
 *
 * Everything in `THE_SHADOW_CONSPIRACY` is about the cost of assembling force
 * in secret against somebody who is very hard to lie to. A revolt does not have
 * that problem: the parties are already inside, already coordinate as a matter
 * of routine, and already have standing reasons to be in the same room. The
 * only thing a plotter had to buy over a hundred and fifty years, a revolt gets
 * for nothing.
 */
export const THE_REVOLT = {
    whatItIs:
        'Not an attack. An administration declining, together and on the same morning, to keep being an administration - the courts, the client houses, the sealed ancestors those houses hold, all of it arriving at the one place where the person it belongs to cannot leave. There is no approach march, no concealment problem and no question of trust, because everybody involved has been in correspondence with everybody else for centuries and has a legitimate reason to be.',
    andTheNumbersAreNotClose:
        'Measured through the ordinary resolver: nine bodies out of the Deep Survey\'s own pyramid take its head ninety-five times in a hundred. That is the same head that no outside conspiracy in the region can touch, and the difference is not strength - it is that the nine did not have to get there in secret. A revolt is the cheapest way to kill an apex by a wide margin and it is the only one that requires nobody to be clever.',
    soWhyHasNobodyDoneIt:
        'Because the arithmetic that makes it easy is not the arithmetic anybody is doing. A court holds ground in its apex\'s name, issues grants that are honoured because of whose name is on them, and is owed water by clients who pay because of who stands behind the court. Kill the name and every one of those becomes a piece of paper. The people best placed to end an apex are the people whose entire position is made of it, which is not loyalty and is considerably more reliable than loyalty.',
    andTheOneThatWouldNotWork:
        'The Long Cut is the exception and it is instructive. Twelve of its own turning on it takes the head none times in a hundred, against nine taking the Deep Survey\'s ninety-five, and the twelve are the larger number. What decides it is the Ninth Nail: forty-five in the hands of the person being revolted against, against a Datum Lamp at forty-three in the other case. The most dangerous thing about a head is not their rung and never was - it is what they are holding, and a house whose people might one day come up the stairs is a house that should think carefully about what it lets its head keep.',
    whichIsTheRealAnswerToTheApexQuestion:
        'And it reframes everything above it. The top of the world is not defended by objects, by pinning, by courts or by the difficulty of assembling a conspiracy - all of those defend it against outsiders, and outsiders were never the threat. It is defended by every person who could reach it having been given something they would lose. That is a policy, it is renewed every year in grant books, and it is the only one of the region\'s defences that could be withdrawn by accident.'
} as const;

/**
 * What the apex's own courts do about it, which is the part that decides who
 * actually inherits.
 *
 * A court is not a bystander to its apex's death. It has been administering an
 * arterial vein in that apex's name for centuries, which means it already holds
 * the ground, already collects, and is already the party every client sect
 * beneath it deals with. When the name above it stops existing, the court is
 * the only body in the region that can credibly say the arrangement continues.
 */
export const THE_COURTS_BELOW = {
    theyClaimTheLegitimacy:
        'Every court under a fallen apex claims to be the continuation of it, and each of them has a real case. They were the administration; the vein is still theirs to run; the grants they issued are still in force and nobody else can honour them. A court does not need to defeat anybody to make this claim - it needs only to keep doing on Monday what it was doing on Friday, and to be the first to say out loud that this is what it is now.',
    andTheyAllClaimItAtOnce:
        'Which is the problem, because there is more than one of them. The Deep Survey alone has three, each administering its own arterial, each with the same argument and none with a better one. So the succession is not a vacuum and it is not a war of conquest either - it is three institutions issuing letters, honouring each other\'s grants selectively, and waiting to see which of them the client sects keep paying. The first court that another court\'s clients start paying has won, and it will have happened without anybody drawing anything.',
    whatSettlesIt:
        'Legitimacy here is not a claim, it is a behaviour: who honours whose paper. A court that keeps its own grants running while quietly declining to recognise a rival\'s has told every sect in the province to choose, and the sects choose on what they need next season rather than on any principle. It is decided in ledgers, over about a decade, and the losing courts are not destroyed - they are simply courts again, under a name that used to be their peer.',
    andTheArtifactDecidesFaster:
        'Unless somebody holds the object. An apex artifact is the one thing that ends the argument early: whoever holds it can do the thing the apex was for, and a court holding it is not claiming continuation, it is demonstrating it. Which is why the succession and the conspiracy are the same subject - the parties who took an apex down are holding the only item that would let its courts settle the question, and they cannot use it without announcing themselves.'
} as const;

/**
 * Openly, or in secret. Both are available and they fail in opposite ways.
 *
 * A conspiracy buys surprise and pays for it in trust: parties who cannot
 * verify each other must spend irreplaceable weapons at the same hour on a
 * signal. An alliance buys durability and pays for it in warning, because an
 * alliance is a thing people can see, and what they can see the target can see.
 */
export const OPENLY_OR_IN_SECRET = {
    theAllianceIsVisible:
        'An alliance is the easier thing to hold together and the harder thing to hide. Parties who have declared to each other can plan properly, verify, rehearse, and withdraw without being murdered for it - all the things a conspiracy cannot do. What they cannot do is assemble quietly. Houses that stop feuding are noticed; a grant honoured out of season is noticed; the Deep Survey in particular holds an instrument that makes concealment structurally difficult, and the region contains three institutions whose entire trade is noticing.',
    soTheApexGetsToMobilise:
        'And a warned apex is a different problem from a surprised one. It has courts - the Deep Survey has two, the Long Cut one - and those courts are institutions at thirty-seven and thirty-eight with their own people, their own ground and every reason to keep the name above them standing. It has a second at thirty-seven to thirty-nine. And it has clients, several of whom are holding sealed ancestors, which the apex may ask them to wake.',
    theAskThatMayNotBeAnswered:
        'That last one is not an order and everybody involved knows it. A sealed ancestor is the client house\'s own irreplaceable weapon, held against its own worst day, and an apex asking for it is asking a house to spend its future on somebody else\'s emergency. Some would. The arrangement has always assumed some would.',
    andTheNumberThatMakesItInteresting:
        'Because the strongest sealed ancestor in the region sits at forty-four, and the house holding it is a federated court under the Deep Survey - whose own head stands at forty-three. The Survey\'s most useful client is holding the one weapon in the world that could kill the Survey\'s head without help. Nothing enforces which direction it points. The entire arrangement between them rests on the client not having wondered about it, or having wondered and decided not to, and there is no instrument anywhere that could tell the Survey which of those it is.',
    soNeitherIsImpossible:
        'Neither route is impossible and the setting must not be written as though either were. A conspiracy fails on trust and succeeds on surprise; an alliance fails on warning and succeeds on preparation. Both have to solve the artifact and neither has been observed to try. The top of the world is defended by difficulty, by an object, and by the fact that nobody has yet been willing to go first - and none of those three is the same as being safe.'
} as const;

/** Houses that hold a ceiling high enough to matter in such an arrangement. */
export function housesThatCouldJoinAConspiracy(): { id: string; name: string; ceiling: number }[] {
    return sectsWithASealedCeiling()
        .map(s => ({ id: s.id, name: s.name, ceiling: sectThreat(s.id)?.ceiling ?? 0 }))
        .filter(h => h.ceiling >= Math.min(...APEX_INSTITUTIONS.map(a => a.powerOrdinal)))
        .sort((a, b) => b.ceiling - a.ceiling);
}



// ─────────────────────────────────────────────────────────────────────────
// MEASUREMENT STATUS
//
// The header promises that every number in this file was measured rather than
// chosen. This is the record of which ones still are, taken by re-running
// `scripts/playtest-conspiracy.ts` against the current engine and then
// replicating it independently at ten times the sample size.
//
// It is here rather than in a report because `catastrophe.ts` set the
// precedent and it is the right one: a number nobody can trace is worth less
// than a number with its retraction attached.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What reproduces, what does not, and why.
 *
 * THE FINDING, IN ONE LINE: the whole-house figures are not measuring the
 * world, they are measuring the round budget.
 *
 * `MAX_EXCHANGES` is 8, and its own doc comment says it is set "so that a
 * genuinely even fight only just runs out of exchanges". That is calibrated
 * for a DUEL. The conspiracy harness fights whole mobilised apexes - the Deep
 * Survey brings 8 bodies, the Long Cut 15, the Pavilion 5 - and eight
 * exchanges cannot empty a side of fifteen. Replicated at 300 seeds with full
 * reinforcements, every one of the six apex pairings returned
 * `winningSideId: null` on all 300 runs. Not one resolved, in either
 * direction, in any pairing.
 *
 * `worthIt` in the harness gates on `first.winningSideId === 'a'`, so a
 * stalemate is counted as "the attacker did not take the target". With every
 * fight stalemating, that expression is structurally zero for every house in
 * every world, and it prints as "nothing is worth doing".
 *
 * This is the failure mode AGENTS.md names: "A stalemate is not a loss...
 * scoring `winner === 'a'` counts that as a defeat for A." The same page warns
 * that an even five-a-side used to be a 100% stalemate. It is that, again, at
 * apex scale.
 *
 * Confirmed by removing one variable: the identical construction with the
 * client reinforcements left out - two or three bodies a side instead of
 * fifteen - stalemated 0 times in 3,000 and returned decisive figures. Side
 * SIZE is what decides whether the resolver resolves, and nothing else
 * changed.
 */
export const MEASUREMENT_STATUS = {
    whatWasWrong:
        'For a period this file carried five figures off the whole-house sweep that could not be reproduced, and the cause was the instrument. `MAX_EXCHANGES` was a flat 8 - calibrated, by its own doc comment, so that a genuinely even DUEL only just runs out of exchanges - and the sweep fights whole mobilised apexes of eight, fifteen and five bodies. Eight exchanges cannot empty a side of fifteen, so every one of the six pairings returned `winningSideId: null` on all three hundred runs, in both directions. `worthIt` gates on the attacker actually winning, so a stalemate counted as a failure to take the target, and the sweep printed "nothing is worth doing" for every house in every world.',
    howItWasFound:
        'By removing one variable. The identical construction with the client reinforcements left out - two or three bodies a side instead of fifteen - stalemated zero times in three thousand and returned decisive figures. Side SIZE decided whether the resolver resolved, and nothing else had changed. That is the failure mode AGENTS.md names by title: a stalemate is not a loss, and scoring it as one is how "one immortal loses to ten ordinary cultivators" was once reported.',
    andTheFix:
        'Was in the engine and not here, which is why this file did not chase it. The round budget is now per body on the smallest side, so a fight ends when some side can be cleared, and the stalemate rate is zero at every size from one against one to fifteen against fifteen. The sweep produces real numbers for the first time and this file has been rewritten against them.',
    whatWasRetracted:
        'Three figures, all wrong, all replaced above. The best move on the board was written as one in a hundred and is three in a thousand. Exactly one of the three two-apex alliances was said to be able to win, and all three win a hundred times in a hundred. A second object was said to take the Deep Survey to thirty-two per cent and a second person to five, from which the file concluded that a person is worth almost nothing - and that conclusion is the one real casualty, because it was one of the better arguments in the setting and it is only half true.',
    andWhatSurvivedIntact:
        'The argument, which is the part that matters. Nobody moves because nobody survives the morning after, and that is now emerging from the resolver rather than being asserted next to it: every attacker who wins a war and then meets the third house survives it zero times in a thousand. The head-to-head figures were never in question and still reproduce exactly - the Long Cut takes the Deep Survey a hundred times in a hundred, the Pavilion takes the Deep Survey ninety-seven. And the property the whole arrangement was designed around holds on measurement rather than by request: the best move available to anybody is above zero and is nobody\'s plan.',
    theLessonWorthKeeping:
        'Which is that the request that came out of the bad numbers was to tune the resolver until "one in a hundred" came back. That would have been tuning the fight that settles a tavern brawl to compensate for a metric that could not tell a beaten attacker from a clock running out, and it would have corrupted every other measurement in the repo to fix a sentence in this file. The instrument was wrong. The world was not.'
} as const;

/**
 * The harness prints `head 43, Datum Lamp 45` in one banner and
 * `The Deep Survey (43+43)` in another, for the same object in the same run.
 *
 * Checked against the catalog: `sent-datum-lamp` carries `power: 43` and no
 * catalog anywhere rates it 45. The computation reads `lamp.power`, correctly;
 * the 45 is a hardcoded literal in a `console.log` banner. So it is a stale
 * label rather than a measurement defect - the figures underneath it were
 * computed from 43 throughout - but it is exactly the kind of thing that makes
 * a reader distrust a run they should distrust for other reasons entirely.
 */
export const THE_LAMP_IS_RATED_FORTY_THREE = 43;
