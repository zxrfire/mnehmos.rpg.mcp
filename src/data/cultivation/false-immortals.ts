/**
 * False Immortals: what they do with the time, the office that used to exist,
 * and the two ways they leave the world.
 *
 * THE ONE THING TO UNDERSTAND
 * ---------------------------
 * A False Immortal is not rare because the world stopped making them. The world
 * makes them at roughly the rate the crossing record implies - the recorded span
 * is about four thousand four hundred years and holds something like nine
 * completed crossings, and a completed crossing lands on one of two rungs. They
 * are rare because they do not REMAIN. The rarity is in the residence and never
 * in the production, and every piece of this file is that sentence with names
 * attached.
 *
 * THE OPEN AXIS
 * -------------
 * Rank is shut at ordinal 45 and shut permanently - the Lid does not open twice
 * for the same name. The dao is not shut. Nothing in the understanding layer
 * reads an ordinal; insight has no ceiling tied to the ladder, and a False
 * Immortal keeps going deeper for as long as there is anywhere deeper to go.
 *
 * So what they actually have is one open axis and a fixed number of years, and
 * what they do with both is LEGACY. Three forms, and they are the whole of the
 * behaviour of everyone in this catalog:
 *
 *   protector      legacy through an institution. You outlive the house that
 *                  raised you and become the reason it survives, typically the
 *                  house that raised you in the first place. The most social of
 *                  the three and the only one the record has a name for. The
 *                  post is tiered: at an ordinary sect it is a job and it is
 *                  filled, and at the top of the world it is reserved for a
 *                  False Immortal and has been empty for eight hundred years.
 *                  It is not abolished. See `THE_OFFICE` and `THE_VACANCY`.
 *   peak           legacy through understanding. Going as deep as the axis
 *                  allows, for its own sake, with nobody to show it to. This is
 *                  what "went exploring and did not come back" almost always
 *                  is: not sightseeing, but going where the answer is.
 *   transmission   legacy through handing it on. Students where there are
 *                  students, and carved stone where there are not.
 *
 * AND THEN THE MADNESS
 * --------------------
 * Which is not boredom, is not decay, and is not age. It is what a mind does
 * when the only open axis closes or when the thing the depth was being left to
 * stops existing. Understanding is what holds a False Immortal together; a dao
 * has a peak and reaching it is a real event with a date; a house can fall and
 * a carving can go unread. `MADNESS_STAGES` sets the pace in years and
 * `LegacyState` decides how fast it is actually walked.
 *
 * NOBODY CAN BANK ONE
 * -------------------
 * And the mechanical fact under the whole institution: the seal band runs from
 * Void Refinement to Tribulation Transcendence, and a False Immortal is one
 * rung above the top of it. No sect has ever held one as a reserve, because no
 * sect could. Every protector in this file was there by choice, was free to
 * leave at any hour, and did. See `THE_SEAL_CANNOT_REACH_THEM`.
 *
 * WHAT THE PRESENT DAY HAS
 * ------------------------
 * No serving protector anywhere in the world, an office that several houses are
 * still holding open, exactly one person alive who is eligible for it, and a
 * good reason why he is the wrong man for it. See `THE_PRESENT_COUNT`. He is
 * also, unbidden and on no schedule, doing the half of it that mattered.
 */

import { z } from 'zod';
import {
    FALSE_IMMORTAL_LIFESPAN_YEARS,
    FALSE_IMMORTAL_ORDINAL,
    rankName
} from '../../engine/cultivation/realms.js';
// The residence figure the world layer prices the standing population against.
// Imported rather than restated so a change there breaks here loudly, which is
// the point: this file is what that number is made of.
import { FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS } from '../../engine/world/ladder-odds.js';

// ─────────────────────────────────────────────────────────────────────────
// THE OPEN AXIS
// Stated once. Every entry below concludes from it rather than re-arguing it.
// ─────────────────────────────────────────────────────────────────────────

export const THE_OPEN_AXIS = {
    twoAxesAndOneIsShut:
        `Rank and dao are separate axes and only one of them is closed. Ordinal ${FALSE_IMMORTAL_ORDINAL} is final - the Lid has been opened against the name and will not open again - but understanding has no ceiling tied to the ladder, reads the spirit root rather than the rung, and does not care in the slightest what realm the person holding it stands at. A False Immortal cannot climb and can absolutely keep going deeper, and that asymmetry is the whole of their situation.`,
    soTheTimeGoesSomewhere:
        'Which is why they are not idle and should never be written as idle. Somebody with one open axis and a countable number of years is a person with a project, and the project is legacy: an institution that outlives them, a dao taken as far as it goes, or something handed on to somebody who can carry it. They are frequently the most purposeful beings in the world and almost none of that purpose is legible from below.',
    understandingIsWhatHoldsThemTogether:
        'And this is the load-bearing claim of the file, chosen deliberately over the alternative. Going deeper is not what breaks them; it is the only thing that keeps them intact. As long as the axis has somewhere further to go and the depth has somewhere to land, a False Immortal is lucid, present, useful and good company for tens of thousands of years. What breaks them is the axis closing or the landing disappearing.',
    aDaoHasAPeak:
        'Because a person\'s own dao is not infinite even though the axis is. There is a bottom to any particular understanding, it can be reached, and reaching it is an event with a date rather than a horizon. A False Immortal who has been to the bottom of their own dao is holding a depth nothing in this world can use, with no rung to spend it on and nobody at their altitude to show it to, and from that day forward the only thing between them and the trajectory is whether the legacy still has somewhere to go.',
    theTwoFailures:
        'So there are two ways it goes wrong and they produce the same curve at different speeds. The dao finishes, which is path two failing by succeeding. Or the legacy fails: the house falls, the students die, the carving is never read by anybody. Path one fails by being outlived, which is why protectors are so heavily over-represented among the ones the world remembers going mad - an institution is somebody else\'s and institutions fall.',
    thisIsAlreadyTrueInTheEngine:
        // CORRECTED. This used to read "`discoverableInsights` reads the spirit
        // root and nothing else", which was true when it was written and has
        // not been true for some time: the function is now fully access-shaped
        // and reads `readableManuals`, `teachers`, `artifacts`, `inheritances`,
        // `tradition`, `locationTags` and `survived` alongside the root. The
        // claim the file actually needs is the one about CEILINGS, and that
        // half is intact - which matters more now that cultivation manuals
        // carry a `cap` and rank is gated by the book in your hands. Dao is
        // the axis that has no such ceiling, and that asymmetry is the point.
        'None of this needs building. Insight degree has no ordinal ceiling, `formInsight` never looks at a rung, and no cultivation manual\'s `cap` touches comprehension - a cap stops a RANK, never an understanding. What `discoverableInsights` does read is access: manuals in reach, teachers, artifacts, inheritances, tradition, the ground underfoot and what has been survived. So a False Immortal is limited by what they can get at, exactly as everybody else is, and not by how high they stand. The engine already treats rank and dao as independent; this file is the setting saying out loud what that independence means for the one population that has hit the end of one axis and not the other.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE PRICE OF THE CROSSING
// Why the constant and the wanderer's remaining years do not match, and why
// that mismatch is the single most load-bearing number in the file.
// ─────────────────────────────────────────────────────────────────────────

export const THE_REMAINDER = {
    theRungsFigure:
        `The ladder grants ${FALSE_IMMORTAL_LIFESPAN_YEARS.toLocaleString('en-GB')} years at ${rankName(FALSE_IMMORTAL_ORDINAL)}. That is the rung's figure and it is correct as a figure. What it is not is what anybody actually walks away with.`,
    whatAnIndividualKeeps:
        'The crossing takes a share, the share is enormous, and it is not the same twice. What a False Immortal has is the rung\'s grant minus whatever did not come back with them, which is why two of them can stand on the same rung with spans two orders of magnitude apart and neither figure is wrong. They know their own number to the year. Nobody has ever collected enough of these numbers to see a distribution, because there has never been anywhere near enough of them.',
    thisIsThePriceAndNotTheTrajectory:
        'State it that way and never the other way. A short remainder is what the crossing cost, charged once, at the crossing, and settled. It is not the beginning of the madness, it is not a wasting, and it does not get worse. Conflating the two would turn the trajectory into an illness, and it is not an illness - it is what a mind does with a finished project and a great deal of time.',
    andItDecidesWhetherTheTrajectoryIsEvenReachable:
        'Which produces the quiet structural fact underneath the whole catalog. Most False Immortals come out with a few thousand years, spend them on whatever they were going to spend them on, and die inside the first stage or the second having never gone anywhere near the far end of the curve. Only a large remainder buys enough years to arrive there. So the ones the world remembers as going mad are precisely the ones the crossing barely charged, and the ones the crossing charged heavily are the ones nobody remembers at all, because they were sane for the whole of a short life and left an ordinary corpse.',
    theWandererIsTheWorkedCase:
        'Lu Sheng crossed six hundred and forty years ago and holds eleven thousand years. That is about four per cent of the rung\'s figure, and it is the price of his crossing rather than anything that has happened to him since. He is roughly five per cent of the way through his own span, which by the standards of this file makes him young, and his entire remaining existence ends comfortably inside the second stage. Whatever else is ahead of him, the trajectory in this file is not. He will be recognisably the man he is now for the whole of it.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE SEAL CANNOT REACH THEM
// The mechanical fact the institution rests on, and the door out of it.
// ─────────────────────────────────────────────────────────────────────────

export const THE_SEAL_CANNOT_REACH_THEM = {
    theBand:
        'A seal holds from Void Refinement to Tribulation Transcendence, ordinal twenty-nine to forty-four, and the sect catalog states why in both directions: the floor is economic, because below Void Refinement nobody would pay to run a formation continuously off a vein, and the ceiling is what was built, because nothing in the Late Age was ever made to hold anything higher.',
    theGap:
        `A False Immortal stands at ordinal ${FALSE_IMMORTAL_ORDINAL}. One rung above the top of the band, and one rung is the whole of it. The strongest thing anybody in either province has ever sealed is the First Warden of the Kiln Wardens at ordinal forty-four, under a masterwork formation, on the deepest ground in the world, held by staff posted by an apex - and that is the ceiling, and it is still short.`,
    soNobodyBanksOne:
        'No sect holds a False Immortal in reserve. No sect has ever held one. No sect could. Every protector in this catalog stood on a mountain because they chose to, could have walked off it at any hour of any day, and eventually did - and the whole architecture of the office follows from that one asymmetry rather than from anything anybody negotiated.',
    andNobodyHasNoticedTheGapIsTheReason:
        'The institutions know the band and do not connect it to the office. A formation master will tell you the ceiling is forty-four; an archivist will tell you the houses used to keep protectors and no longer do; and nobody has put the two sentences beside each other, because the office ended so long ago that it is filed under history rather than under formations. Somebody who puts them together has worked out why every account of the office reads the way it does.',
    theSpecification: {
        whatWouldBeNeeded:
            'The Standing Age left a specification for holding something above the band, and it is a specification rather than a record of anything built. It calls for nine nodes of the ninth family, in one place, on ground carrying more than any vein in either province now runs.',
        theNinthFamily:
            'The Standing node grammar has nine families. The Anchorhold reads eight of them and can cut six. The ninth appears only on the oldest work, no living formation master can cut one, and its presence is the actual definition of a masterwork seal - which is why masterworks are inherited and never built, and why a small sect with a very old formation can be holding something enormous without the expenditure that would give it away.',
        theCount:
            'Eleven ninth-family nodes exist in the two provinces by the Anchorhold\'s own survey. Nine are required. The eleven are in four different places, none of them can be moved, and cutting a new one is the thing nobody can do. The world is holding more than enough and cannot get them into one room.',
        theGround:
            'And even in one room it would burn more than any vein in either province carries. The one that would run it is the datum itself, which the Kiln Wardens are posted on and draw nothing from, and they are staff on somebody else\'s ground rather than a sect with a decision to make.',
        nobodyEverBuiltOne:
            'There is no evidence the specification was ever executed and good reason to think it was not. The Standing Age produced fewer crossings than any age in the record and therefore had almost nothing above the band to hold, so what survives is an engineering figure for a problem that age did not have. Nothing anywhere in this world is a sealed False Immortal, and nothing should ever be written as one.',
        theQualifier:
            'Which is what "not today" actually means. It is a fact about the Late Age and not a law of the world: the hand that could cut the ninth family is gone with the staffing returns that got shorter, the ground that would carry it is spoken for, and both of those are losses rather than impossibilities. The door is open by exactly the width of nine stones that cannot be moved and one skill nobody has.'
    }
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE MADNESS
// Five stages, ordered, covering the rung's full span. The pace is years; the
// speed is legacy.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether the legacy still has somewhere to go.
 *
 *   holding    the work is being done and the depth still has a landing.
 *   finished   the axis closed. The peak of their own dao was reached, or the
 *              transmission is complete and there is nobody further to hand it
 *              to. Success, and it is the more dangerous of the two.
 *   failed     the house fell, the students died, the carving went unread.
 */
export const LegacyStateSchema = z.enum(['holding', 'finished', 'failed']);
export type LegacyState = z.infer<typeof LegacyStateSchema>;

/** Which of the three a False Immortal is actually spending the years on. */
export const LegacyPathSchema = z.enum(['protector', 'peak', 'transmission']);
export type LegacyPath = z.infer<typeof LegacyPathSchema>;

export const MadnessStageSchema = z.object({
    id: z.string(),
    name: z.string().min(3),
    /** Years since the crossing. Bands are contiguous and cover the span. */
    fromYear: z.number().int().min(0),
    toYear: z.number().int().positive(),
    /** What the axis is doing, which is the actual driver. */
    theAxis: z.string().min(150),
    /** What somebody sitting across a table from them would see. */
    presentation: z.string().min(200),
    /** How an institution that has one reads it, which is usually wrongly. */
    howItReadsFromOutside: z.string().min(150),
    /** What ends a stage, stated as the thing rather than as a duration. */
    whatMovesThemOn: z.string().min(120),
    /** True only where somebody in the record has actually watched it. */
    observed: z.boolean(),
    observedNote: z.string().min(100)
});
export type MadnessStage = z.infer<typeof MadnessStageSchema>;

export const MADNESS_STAGES: readonly MadnessStage[] = [
    {
        id: 'stage-the-interval',
        name: 'The Interval',
        fromYear: 0,
        toYear: 2_000,
        theAxis:
            'Wide open and barely started. Whatever they were working on before the crossing is still the thing they are working on, and the crossing has handed them a depth of aperture they have not yet found the bottom of. Nearly everybody chooses their path inside the first century and most of them inside the first decade, without ceremony and usually without noticing they have chosen.',
        presentation:
            'Nothing. They are an extremely capable person of no obvious age, finishing a life they had already mostly finished: enemies still dying off, friends still alive or recently not, a world they can still navigate without correction. The one distinguishing habit is arithmetic. They know their own remaining figure to the year, they check it, and they will give it to anybody who asks without any drama attached to the giving.',
        howItReadsFromOutside:
            'As an old cultivator who has been through something and does not discuss it. Nobody at this stage has ever been identified as a False Immortal by observation alone, because there is nothing to observe: the power is enormous and the person is ordinary, and the two do not have to be reconciled by anyone who is not being attacked.',
        whatMovesThemOn:
            'The last person who knew them before the crossing dies. That is the boundary rather than any number, and it happens somewhere in the first two thousand years for everybody, because nothing below the Lid outlives that.',
        observed: true,
        observedNote:
            'Directly, in the present, and by four people. The Seats of the Hollow Court have had six hundred and forty years of it and would recognise the description immediately, which is the only reason the first stage is written from life rather than reconstructed.'
    },
    {
        id: 'stage-the-long-work',
        name: 'The Long Work',
        fromYear: 2_000,
        toYear: 20_000,
        theAxis:
            'Deep, still descending, and now the entire content of the life. Everybody they knew is dead, the world they remember has turned over twice, and the work is the only continuous thing left. This is where the axis pays: almost everything in this world that came out of a False Immortal was made in this stage, by somebody who had eighteen thousand years and one thing to do with them.',
        presentation:
            'Disproportion, and nothing worse. The work gets a weight nothing else gets, and everything outside it is handled with a mild, incurious inaccuracy - names of places two centuries out of date, an assumption about who administers what that stopped being true a while ago, a fondness for one inn or one road or one person that is out of all scale to it. They are lucid, courteous, extremely good company and entirely reliable, and they do not distinguish between what they saw and what they were told about the present.',
        howItReadsFromOutside:
            'As an extremely old person being an extremely old person, which is exactly the problem. A house holding a protector at this stage has no instrument that would tell it anything is coming, because nothing is coming yet and the presentation is indistinguishable from the presentation of a healthy one. Every office in the catalog was contracted against somebody at this stage or later, and no house ever knew which.',
        whatMovesThemOn:
            'The bottom of their own dao, or the work running out of anywhere to land. Where neither happens the stage simply continues, and a False Immortal whose legacy keeps holding stays here well past the nominal band.',
        observed: true,
        observedNote:
            'Yes, repeatedly, and it is the stage the record is best on. Several of the seven entries in this catalog were at it during the whole of their office, and the accounts agree so completely about the presentation that they read as though somebody collated them, which nobody has.'
    },
    {
        id: 'stage-the-settled-error',
        name: 'The Settled Error',
        fromYear: 20_000,
        toYear: 90_000,
        theAxis:
            'At or past its own bottom, and this is the turn. The depth is complete and there is no rung to spend it on and nobody at that altitude to show it to, so the axis stops being a direction and starts being a possession. What was a project becomes a position, and a position is a thing to defend.',
        presentation:
            'Lucidity, articulacy, long and correct reasoning, from a small number of premises about the present that were true when they were acquired and have not been checked since. They are not confused and cannot be caught out on any detail, because the memory is genuinely accurate; it is simply accurate about a world four hundred generations gone, and nothing has been permitted to overwrite it. Contradicted, they do not become agitated. They restate, competently, and the person contradicting them goes away doubting themselves.',
        howItReadsFromOutside:
            'As authority. This is the stage that ruins institutions, and it does it without a single raised voice: a correction offered by somebody who is manifestly the most knowledgeable being in the building, accepted gratefully, written into the standard, and wrong by four thousand years. Nobody argues with it and nobody could. The damage compounds quietly in whatever the house does with numbers.',
        whatMovesThemOn:
            'The premises stop being defended in argument and start being acted on. There is no moment anybody could point to; the talking simply reduces and the behaviour takes over, over the course of a century or two.',
        observed: true,
        observedNote:
            'Twice, both times without being recognised as anything, and one of the two is still doing damage to a table that prices freight in two provinces. The stage has never been named by any institution and this catalog is the first place it has been written down as a stage rather than as a difficult guest.'
    },
    {
        id: 'stage-the-long-repetition',
        name: 'The Long Repetition',
        fromYear: 90_000,
        toYear: 220_000,
        theAxis:
            'Complete and closed for a very long time, and no longer referred to. The depth is intact and undiminished and does not come up. What is left running is the shape the work made rather than the work: a habit of keeping something, worn into a mind over a hundred thousand years, with the reason it was being kept somewhere far behind.',
        presentation:
            'Keeping. They hold a place, walk a border, maintain a building, wait for somebody, turn people back from a path - courteously, without heat, without explanation, and without any possibility of being talked out of it. Speech narrows to a small set of things said the same way. There is no violence in it and there does not need to be: what they are doing is being in the way of something, and being in the way is the strongest position anybody in this world can occupy. Whatever is on the other side of them is simply not going to get past.',
        howItReadsFromOutside:
            'As catastrophe with nobody to blame for it. No malice, no grievance, no plan, no demand and nothing to negotiate against - which is worse than any of those, because every instrument the world has for dealing with a powerful party assumes the party wants something. This one does not want anything. It is keeping, and it will keep for another hundred thousand years.',
        whatMovesThemOn:
            'Nothing anybody can arrange. The thing being kept stops existing entirely, or the last person who might have addressed them stops coming, and the keeping loses even its object.',
        observed: true,
        observedNote:
            'Once, over a hundred and ten years, by a house that starved on its own mountain while writing down every attempt. The record survives and the house does not, and it is the only first-hand account of this stage anywhere in the world.'
    },
    {
        id: 'stage-the-standing-silence',
        name: 'The Standing Silence',
        fromYear: 220_000,
        toYear: FALSE_IMMORTAL_LIFESPAN_YEARS,
        theAxis:
            'Not referred to and possibly not there. There is no way to establish from outside whether the understanding is still held, because the only test anybody could run is to ask, and nothing addressed to them at this stage arrives.',
        presentation:
            'Stillness. Not seclusion, not sealing, not sleep and not death - the power is intact and would answer instantly if something touched it, and nothing about the body has failed. They stop moving, stop speaking and stop responding, and remain exactly as capable as they ever were. The description ends there because there is nothing further in it.',
        howItReadsFromOutside:
            'It does not read at all. Nobody has ever encountered one, and if somebody did they would be looking at what they would take for a statue or a person meditating, in ground nobody surveys, and they would walk past it.',
        whatMovesThemOn:
            'The span, which is the only thing left and arrives on schedule. There is no further stage for it to move them into, and the rung\'s figure is the figure: whatever else has or has not happened by then, the years run out and that is the end of the account.',
        observed: false,
        observedNote:
            'No. This stage is reconstructed from two accounts of the fourth and an inference about where the fourth is going, and the reconstruction is the Hollow Court\'s rather than anybody else\'s. It may simply be wrong, and the file states that rather than smoothing it, because a stage nobody has seen is exactly the sort of thing a catalog quietly turns into a fact.'
    }
];

/**
 * Which stage a False Immortal is at, given years since their crossing and
 * whether their legacy still has somewhere to go.
 *
 * Years set the pace. Legacy sets the speed: a finished axis or a failed
 * legacy advances the trajectory by one stage, which is the whole design of the
 * curve in a single line of code. Somebody whose house fell at thirty thousand
 * years presents as though they were at sixty.
 *
 * Pure, total, and clamped at both ends. Above the span it returns the last
 * stage rather than throwing, because a caller asking about a year past the
 * rung's figure is asking about somebody who is dead and should get the last
 * true answer rather than an exception.
 */
export function madnessStageAt(
    yearsSinceCrossing: number,
    legacy: LegacyState = 'holding'
): MadnessStage {
    const years = Number.isFinite(yearsSinceCrossing) ? Math.max(0, Math.floor(yearsSinceCrossing)) : 0;
    let index = MADNESS_STAGES.findIndex(s => years >= s.fromYear && years < s.toYear);
    if (index < 0) index = MADNESS_STAGES.length - 1;
    if (legacy !== 'holding') index = Math.min(index + 1, MADNESS_STAGES.length - 1);
    return MADNESS_STAGES[index];
}

/** Position of a stage in the trajectory. Ordered, so it compares. */
export function stageIndex(stageId: string): number {
    return MADNESS_STAGES.findIndex(s => s.id === stageId);
}

/**
 * Whether somebody with this remainder can ever reach this stage at all.
 *
 * The answer is no far more often than anybody expects, and it is the reason
 * the world is not full of the fourth stage: a remainder short of a band's
 * floor means the span runs out first, and the person dies lucid.
 */
export function canEverReach(remainderYears: number, stageId: string): boolean {
    const stage = MADNESS_STAGES.find(s => s.id === stageId);
    if (!stage) return false;
    return remainderYears > stage.fromYear;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TWO EXITS
// Why they do not remain, and why the record cannot tell the two apart.
// ─────────────────────────────────────────────────────────────────────────

export const THE_TWO_EXITS = {
    theyGoLooking:
        'The commonest, and it is path two rather than restlessness. Somebody at the bottom of their own dao who wants the next thing has to go where the next thing is, and none of it is here: down the arterial system to where the qi comes from, out past the last surveyed ground, or through one of the twenty-two closed gate terminals. All three are one-way for practical purposes, all three are the reasonable act for somebody with nothing left to attempt, and none of them has ever returned anybody. Write it as going where the answer is and not as sightseeing.',
    theGatesAreWhereTheyGo:
        'And the terminals are the specific door, which is worth stating because it explains a category of visitor the Measured Span has never accounted for. Nine terminals answer, four of the nine open somewhere a person can breathe, and five do not - and the person for whom walking into one is a defensible decision is precisely the person with an enormous span, no remaining rung, and a completed dao. Two of the seven in this catalog left through a gate. The Span has no entry for any of them and would not know what it was looking at.',
    theyGoMad:
        'The other, and it does not look like leaving at all from inside the house. See `MADNESS_STAGES`. What matters here is that the trajectory removes them as reliably as the door does: a protector at the fourth stage is no longer available to anybody in any sense that an institution could use, and the institution is usually the last party to work that out.',
    andTheyAreOftenTheSameExit:
        'This is the part that defeats the record. A False Immortal at the Settled Error goes looking BECAUSE the memory is accurate: it tells them, correctly, that there is somewhere to go, and the somewhere closed eight thousand years ago. So a departure that reads as curiosity is frequently the trajectory wearing a different coat, and there is no test that separates the two from outside. The catalog marks the end it can defend and says where it cannot tell.',
    theThirdThingThatIsNotAnExit:
        'And the honest baseline underneath both: most of them simply run out. The crossing charges a share, the share is usually enormous, and a False Immortal with three thousand years is dead of the clock long before either exit becomes relevant. That is the commonest end by a wide margin, it removes nobody early, and it is invisible - a lifespan expiring leaves an ordinary corpse and no scar, which is why the world has never once recognised one.',
    whyTheRecordIsBiased:
        'Put those together and the record is skewed in a specific direction. A completed crossing leaves a tablet and an ancestor. A death at the crossing leaves a scar and no name. A False Immortal who remains leaves an office, a carving and forty generations of anecdote; one who goes looking leaves a last sighting; one who runs out leaves a body nobody examined. So the record over-counts the ones who stayed, and every institution reading it concludes that fewer are being made. Fewer are not being made. Fewer are staying, which produces exactly the same shortage and has an entirely different cause.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE OFFICE
// A standing post with no incumbent anywhere. Present tense throughout: it is
// available, it is what a house would offer, and it has been vacant for eight
// hundred years.
// ─────────────────────────────────────────────────────────────────────────

export const THE_OFFICE = {
    whatItIs:
        'A very long favour, dressed as a post. A house with a False Immortal standing on it writes the arrangement up as an appointment, gives it a title, enters it on a roll and keeps it in the ceremonies, because a house cannot administer a courtesy and has no other vocabulary available. None of that makes it an appointment, and every house that has ever held one has understood the difference perfectly and gone on writing it the other way.',
    theWordDoesTwoJobs:
        'And before any of that: most houses in the world that have a dao protector have somebody in the post right now, and none of them is a False Immortal. At an ordinary sect the position is a job - a Nascent Soul who does not travel, a Core Formation veteran who has been there forty years, somebody whose whole function is to be in the compound when something arrives. It is filled, it is unremarkable, and nobody thinks of it as exotic. The Marches and the Low Fall already disagree about what a realm name means without either of them having met anybody to ask; this is the same phenomenon at a smaller scale, and the two senses of the phrase almost never meet because the people who use one are not in rooms with the people who use the other.',
    theReservedPost:
        'What is empty is the other one. At the top of the world the post is reserved: the house will not fill it with anybody who is not a False Immortal, and it has therefore been empty for a very long time. That refusal is what makes the emptiness mean something - a house with a vacant protector\'s chair is not short of strong people, it is declining to pretend that a strong person is the same thing.',
    onlyAHouseThatProducedOneCanHaveOne:
        'And there is a structural reason the reserved post exists where it does, which nobody wrote down because it falls out of the office being internal. A protector is typically one of your own who crossed and came back, so only a house that has itself produced somebody who reached the last crossing can expect one at all. The qualifying fact is therefore the crossing record and never a position in a hierarchy, and the two come apart at the sharpest case in the world: the house with more completed crossings behind it than the rest of the top of the world put together holds from nobody, sits on no grant table, and is on nobody\'s list of the institutions that run anything.',
    theChairIsEmptyBecauseTheirPeopleGotThrough:
        'Which produces the reading that is worth having, because it is the opposite of failure. Every completed crossing in the records is a house that could in principle have had a protector and got a True Immortal instead - somebody who went all the way and therefore left. The Azure Cloud Pavilion sent Ru Anjing three hundred and eighty years ago. The Sweptground Temple sent the First Abbot two thousand six hundred years ago and is now four monks with a chair. The Storm Tyrant Court sent the First Tyrant three thousand four hundred years ago. The Hollow Court has sent six. Every one of those chairs is empty because the house succeeded, and the ones that would have filled them are the ones who did not.',
    itIsVacantAndNotAbolished:
        'Nobody ended the reserved post. No house has struck it off a roll, no arbitration has ruled on it, and no age closed it. It is a position that exists, that a handful of houses still hold open, and that has had no incumbent anywhere in the world for eight hundred years - which is a vacancy rather than a history, and the tense matters everywhere it comes up.',
    whatItObliges:
        'Nothing enforceable, in either direction, ever. Eleven instruments survive across the two provinces and the obligations in all eleven run one way: the house undertakes, and the guest is described. Not one of the eleven contains a sentence in which the guest agrees to anything, and the omission is so consistent that it plainly was not an omission.',
    whatTheHouseGets:
        'Two things, and they are separable, which almost nobody notices because for two thousand years they arrived together. The first is presence: the strongest position anybody in this world can hold is to be standing there and decline to move, and a False Immortal on a mountain is the most complete version of that available anywhere. The second is dao: somebody at the top of an axis nobody else can reach, in a hall, talking, for a century at a time. The first is what the ceremonies are about and the second is what the houses actually got.',
    whatTheHousePays:
        'Not stones, not medicine, not a share of a vein. Nothing a house holds is worth anything to somebody with no property, no ambition and no ceiling left to buy. What a house actually supplies is occupation and company: an argument, a problem worth being present for, a room full of people who will talk, a reason for this century to be different from the last one. The instruments are silent about it and the household accounts are not.',
    internalIsTheNorm:
        'Typically it is one of your own. They went up from your mountain, they came back changed, and standing on the place that raised them is the obvious thing to do with the first stretch of an enormous life - so the ordinary arrangement is a house and its own returned ancestor, and it needs no negotiation, no instrument and no explanation from anybody. Recruiting one from outside is possible and it is rare, and every external case in this catalog carries an awkwardness the internal one does not have: somebody else\'s existence on your ground, with no history there and no reason to die for the place.',
    whyTheRecordSaysOtherwise:
        'Which is why this catalog looks unrepresentative and is. An internal protector generates almost no account at all - a house writes its own ancestor standing on its own mountain up as continuity, not as an event, and tells nobody outside because there is nothing to tell. An external one generates instruments, disputes, correspondence, arbitration and gossip in every direction. So the surviving corpus is skewed toward external recruitments by an enormous factor, five of the seven entries here are external, and the honest reading of that is not that outsiders were common. It is that outsiders were written down.',
    whatItCannotAskFor:
        'An order. It is the one thing no instrument attempts and the one mistake no house makes twice: a house that gives a protector an instruction has a protector until the end of the sentence. One of the seven in this catalog left on exactly that, the same afternoon, and the house has never recorded that it happened.',
    whatItIsNot:
        'Not a seal, not a retainer, not a member, not an elder, and not on the house\'s ladder at all - the office sits outside the ranks rather than above them, because a seat is a position in an order of precedence and there is no order that could contain one. It is also not a deterrent that can be traded on, since a house cannot threaten with something it does not control.',
    theNameOutlivedTheOccupancy:
        'And the phrase has drifted with eight centuries of vacancy. A cultivator today who hears "dao protector" understands the one-off guard at a crossing - somebody who stands over a helpless attempt for its duration - and has no idea the words also name a seat that has been held for two thousand years at a stretch. See `DAO_PROTECTOR` in `crossings.ts`, which is the surviving sense and the only one anybody uses. The two are related the way a watchman and a wall are related.',
    theCourtDidNotUseTheName:
        'Worth noticing at the one place it came up again. When the Hollow Court had to invent somewhere to put a False Immortal it could not seat, the precedent was available, well documented and exactly the right shape - a position outside the rungs, held by somebody the house cannot order. Nobody proposed it. Guest of the Court was invented instead, and whether that was tact, oversight or an accurate reading of the man is not recorded, has never been raised by any of the five people who could raise it, and is not resolved here.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE VACANCY
// Why the post is empty, which is supply and nothing else. There is no
// falling-out here, no turning point and no villain, and there must not be.
// ─────────────────────────────────────────────────────────────────────────

export const THE_VACANCY = {
    theReason:
        'A lack of False Immortals. That is the whole of it and there is nothing underneath it. An office that only one kind of person can fill is empty when there is nobody of that kind, and there is nobody: the world holds one that anybody can point to and he is not standing on anything. No house broke faith, none was refused, nothing was decided by anyone at any point, and no age closed the institution. It ran out of the one sort of person who could hold it.',
    andThatIsNotADeclineInProduction:
        'What "a lack of False Immortals" actually consists of is worth being precise about, because every institution that says the phrase means the wrong thing by it. Crossings still resolve the way they always did and the split between the two rungs has not moved. What has collapsed is not how many are made but how many are here afterwards: they go looking, or the trajectory takes them, and the seal cannot hold one long enough to keep them. See `THE_TWO_EXITS` and `THE_SEAL_CANNOT_REACH_THEM`. Same shortage, entirely different cause, and nobody in the world has the two apart.',
    whyNoHouseInvestigated:
        'Because from inside a house there is nothing to investigate. A vacancy is not an event. There is a seat, there is nobody in it, there has been nobody in it since before anybody now living was born, and no year can be pointed to in which anything happened. Houses do not open enquiries into the absence of a thing they never controlled the supply of.',
    thereIsLessOnOfferToo:
        'And it is true, and it changes nothing, that a house has less to offer than it did. Every discipline practised in either province was founded in the Counting Age and not one since; the houses maintain a dao rather than build one, so what a protector would be standing on is a smaller thing than it was. That would matter if there were anybody to make the offer to. There is not, so it does not, and it should never be written as the reason.',
    theVacancyBegan:
        'Eight hundred years ago, when the House of Held Names lost its Kept Name to an expiring span in a chair on an ordinary afternoon. Nobody at the time knew it was the last one in the world and there is no reason they would have. The house kept the ceremonies, kept the quarters, and kept the entry on the wall until it struck it four years later for reasons that had nothing to do with any of this.',
    whatTheResidueLooksLike: [
        'A stipend line in a house ledger that has been carried forward at the same figure for eight hundred years and never drawn against, because striking it would require a Keeper to write down that the house has given up.',
        'Quarters kept swept at the top of a stair, with no bedding in them and a schedule for the sweeping, in houses that would be embarrassed to be asked why.',
        'A place laid at a founding ceremony, at the end of the row rather than the head of it, which the officiant announces as vacant and everybody present has heard announced as vacant every year of their lives.',
        'An entry on a roll with the name column empty, which the Ninefold Ledger will certify as a valid standing office and has certified twice in four centuries for houses that wanted it on paper.',
        'A hall in the Nine Peaks compound that the ascetics still call the ninth guest\'s, which is the only trace of the last occupant anybody outside the Order would recognise.',
        'And at Sweptground, four monks, a plain wall, and a chair that has been reserved for two thousand six hundred years by an institution that has never had more than a dozen people in it, which the province finds either absurd or unbearable depending on who is telling it.'
    ],
    itCouldBeFilledTomorrow:
        'And that is the point of writing it as a vacancy. The post is live wherever it is reserved. The houses that hold it open would fill it, several have the quarters ready, and the terms would be recognisable to anybody who has read the eleven instruments. Nothing about the world prevents it. The only missing element is the person, and the person is exactly what a cultivator who survives the last crossing becomes.',
    theShapeOfItRightNow:
        'Which produces the actual standing position, and it is funnier and bleaker than either half of it alone. A handful of houses hold a chair they will not fill with anybody else. There is one eligible person in the world. He came up through one of those houses, held its first seat, crossed from the top of it, and does not care for titles - so the one house with a candidate is the one house that cannot get him to find the question interesting. Every other reserved chair has no candidate at all and is being swept on a schedule.'
} as const;

/**
 * How an offer would actually be made, if there were anybody to make it to.
 *
 * This exists because it is the answer to the question a run reaches at
 * ordinal 45: there is one rung above and it is shut, and the three legacy
 * paths are what is left. Path one is the only one an institution can hand you,
 * and this is the shape of the handing.
 */
export const THE_OFFER = {
    theDefaultIsYourOwnHouse:
        'A cultivator who survives the last crossing and does not complete it is, that morning, the natural candidate for the reserved post at the house that raised them - if their house is one of the handful that has one, which it is only if that house has itself produced a crossing. Nobody has to propose anything. It is the expected thing, the house has been holding the chair, and the only question is whether the person wants it.',
    whichMakesAnEarlyChoiceMatterVeryLate:
        'And that is the shape worth building for. Which house a cultivator joined at the bottom of the ladder decides whether there is a chair at the top of it. Most houses have no reserved post at all and never will, because they have never sent anybody through; the ones that have are few, and joining one at ordinal three is a decision that pays or fails to pay four decades of play later at ordinal forty-five.',
    outsideIsPossibleAndRare:
        'Recruitment from outside happens and is unusual. A house with a reserved chair and no candidate of its own can ask somebody else\'s, and occasionally has. What it cannot do is make the arrangement ordinary: an external protector has no history on that ground, no ancestor buried under it, and no reason to die for the place, and everybody involved knows it from the first day to the last. Five of the seven historical entries here are external, which says more about what gets written down than about what usually happened.',
    howItWouldCome:
        'Not as a summons and never as a bid. A senior member arrives in person, which for an apex is already a remarkable act, says what the house is, says what it is working on, and leaves without asking for an answer. Houses that have read their own instruments know that the ask is the thing that ends it, so the good offers are the ones that do not contain one.',
    whatTheHouseWouldWant:
        'Presence first, in every case, and the house will say so plainly because there is no point pretending otherwise: it wants nobody to attempt anything against it for as long as the arrangement lasts. The second thing it wants and will not say first is the dao, and the houses that lead with the second are the ones worth listening to.',
    whatTheHouseWouldPay:
        'Whatever it has that is not material, because nothing material is worth anything. A problem that will not be finished inside a century. A hall and the people in it. Access to whatever the house is the only holder of - a record, a site, a survey, a question. Two of the eleven instruments simply promise that the house will not ask anything, which reads as nothing and is in fact the largest offer on the list.',
    whatItCouldNotAsk:
        'For an instruction to be obeyed, for a term to be served, for the arrangement to be exclusive, or for any of it in writing in a form that binds. A house that attempts any of the four is telling a False Immortal that it has misunderstood what it is talking to, and the answer to that is not a refusal - it is that the visitor is somewhere else the following week.',
    whatTakingItWouldMean:
        'That the whole of a very long remaining life now has a place in it, which is the thing worth weighing and is not obviously good. A post is a promise to be somewhere. Everybody in this catalog who took one and then wanted to be somewhere else simply went, at no cost to themselves and considerable cost to the house, and none of them thought about it for longer than an afternoon.',
    andWhatItWouldBuy:
        'Legacy through an institution, which is the only one of the three paths that somebody else can hand you. The other two are available to any False Immortal anywhere and require nobody\'s agreement. This one requires a house, and a house that is worth outliving is a genuinely scarce thing.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// DEPARTURE
// The mechanism the world arithmetic assumes and nothing in the data
// performed. `immortalStock` in `engine/world/ladder-odds.ts` multiplies
// production by mean residence and gets one to three standing; this is what
// the residence figure is actually made of.
// ─────────────────────────────────────────────────────────────────────────

export const DEPARTURE = {
    theArithmeticItServes:
        'The world layer prices the standing population as production times mean residence, and puts mean residence at five hundred years against a rung that grants three hundred thousand. That is not a lifespan and must never be read as one: nobody is dying of age at five hundred. They are leaving at five hundred, and this is what the leaving is.',
    theHazard:
        'Going looking is what kills them, and their span is not what ends them. The places worth a False Immortal\'s attention are exactly the places that were closed by parties who could close things against a False Immortal - closed terminals, arterial seams below anything the Deep Survey has instrumented, the dead provinces, sealed sites nobody living can open, and whatever is past the last surveyed ground in any direction. The odds out there are not written down anywhere, by anybody, and the people who could have written them down are the ones who went.',
    itIsNotSightseeing:
        'Write it as path two rather than as restlessness. Somebody at the bottom of their own dao who wants the next thing has to go where the next thing is, and none of it is here. It is the most reasonable act available to a person in their situation and it is the reason there are not forty of them standing about.',
    nobodyBelowCanTellTheDifference:
        'And there is no signal, exactly as with ascension and for exactly the same reason. A False Immortal who has gone looking and a False Immortal who died out there produce identical evidence below the Lid, which is none. There is no scar, no body, no last word and no register entry, and a house that has not heard from one in two centuries knows precisely nothing. Every institution that keeps a list keeps it in that state and says so, and the ones that do not say so are the ones being dishonest.',
    theyComeBack:
        'Sometimes, and it is one of the better entrances the setting has. A departure is not a death and is not a retirement: somebody who went down a seam four hundred years ago can walk back into a market town with something nobody has seen, and two of the entries in this catalog took a post after a period away that nobody has ever accounted for. The Kept Name did exactly that - six hundred years gone, then back down to the house that raised him.',
    luShengIsTheOneWhoStayed:
        'Which is the correct frame for him and a much better fact about him than the crossing. He is not the only False Immortal the world has ever made. He is the one who did not go, six hundred and forty years resident against a mean of five hundred, with a stated want of knowing what the far side declined and every reason to go and find out. Everybody else with his problem went. He is still here, walking around, asking, and nobody has ever asked him why he did not.'
} as const;

/**
 * Where they go, what is known about anybody who went there, and why nothing
 * below the Lid can tell a departure from a death.
 */
export const DEPARTURE_DESTINATIONS: readonly {
    id: string;
    where: string;
    whyThere: string;
    whoWent: string;
    whatComesBack: string;
}[] = [
    {
        id: 'departure-closed-terminals',
        where: 'The twenty-two gate terminals that do not answer, and the five of the nine that open somewhere a person cannot breathe.',
        whyThere:
            'They are the only doors out of a world that is otherwise closed, they were built by an age that could do things nothing since can, and walking into one is a defensible act for somebody with an enormous span, no remaining rung and a completed dao. For everybody else it is suicide, which is why the terminals are surveyed and not used.',
        whoWent:
            'Two of the seven in this catalog, on the record, and an unknown number who were never in anybody\'s record at all. The Measured Span has never accounted for this category of visitor and would not know what it was looking at if it did.',
        whatComesBack:
            'Nothing has ever come back through a closed terminal. Whether that is because nothing survives the other side or because nobody who arrives somewhere better bothers returning is exactly the sort of question the world cannot answer.'
    },
    {
        id: 'departure-arterial-seams',
        where: 'Down the arterial veins, below the depth any survey instrument reaches, toward whatever the output actually comes from.',
        whyThere:
            'It is the question under every other question in the world - the ground is thinning, everybody has measured it, and nobody has been to the bottom. A False Immortal is the only kind of being that could go and look, and the ones who care about the answer are the ones with nothing else left to care about.',
        whoWent:
            'The Standing Sum, two thousand four hundred years ago, at a branch the Deep Survey now numbers as the fourth. She said where she was going and why. There is no further entry of any kind.',
        whatComesBack:
            'Nothing yet. The Deep Survey holds the only records that would show a return and its arterial register has no category for a person, so an ascent out of a seam would be filed as an anomaly in the ground reading and nothing else.'
    },
    {
        id: 'departure-past-the-survey',
        where: 'Out past the edge of any province with a name, in whichever direction the maps stop.',
        whyThere:
            'Because the maps stop, and everybody who could have extended them is dead or busy. The two provinces are the whole of what anybody in this catalog can describe and neither of them believes the world ends at the boundary.',
        whoWent:
            'Unknowable by construction. This is where the departures that leave no record at all have gone, and the number is almost certainly larger than every other destination combined.',
        whatComesBack:
            'Occasionally somebody. Not often, not on any schedule, and never with an account anybody can check - which is one of the few reliable ways a genuinely new thing enters the world, and is indistinguishable from a fraud until it is not.'
    },
    {
        id: 'departure-sealed-sites',
        where: 'Sites closed by parties who could close things against something at the top of the ladder, which is a very short list of parties and a much longer list of sites.',
        whyThere:
            'Because a site sealed against a False Immortal was sealed by somebody who had a reason, and the reason is the most interesting object in the world to the one category of person the seal was aimed at.',
        whoWent:
            'Not recorded anywhere, and this is the destination the institutions would most like a list of. The Deep Survey holds site records it sealed itself and never published, and has never cross-referenced them against anybody\'s disappearance.',
        whatComesBack:
            'A seal that has been opened and closed again looks exactly like a seal, which is the whole difficulty. At least one site in the two provinces has almost certainly been entered this way and nobody has any means of establishing which.'
    }
];

/**
 * Whether a residence of this many years is unusual for a False Immortal.
 *
 * Against the world layer's mean rather than against the rung's span, because
 * the rung's span is not what removes them. Anything past the mean is already
 * remarkable and anything past twice it has no precedent in the record except
 * the one man currently doing it.
 */
export function residenceIsExceptional(
    yearsResident: number,
    meanResidenceYears = FALSE_IMMORTAL_MEAN_RESIDENCE_YEARS
): boolean {
    return yearsResident > meanResidenceYears;
}

// ─────────────────────────────────────────────────────────────────────────
// CARVING
// The durable form of transmission, for when there is nobody to hand it to.
// ─────────────────────────────────────────────────────────────────────────

export const CARVING = {
    whyTheyCarve:
        'Because legacy is the objective and a student is not always available. Somebody with tens of thousands of years, a completed understanding and no reader can still cut it into a face and let the reader be a problem for later. It is the least social of the transmissions and the most durable, and for several of the seven here it is very nearly the only reason anybody knows they existed at all.',
    aRecordThatTheyWereHere:
        'And it is frequently not a technique. Several of these carvings are simply the fact of a person: a name, a date, a rank, a course of cutting on the inside face of a stone where nobody would look for it. The name outlasting everything else about them is not a failure of the carving. It is very often the whole of what was intended.',
    whyMostOfItCannotBeRead:
        'The obstacle is not concealment and is almost never a cipher. A False Immortal cutting a face has stopped assuming a reader, and a person who has stopped assuming a reader writes in their own hand rather than in a script - shorthand that was legible to them, compressed by somebody who had already understood it, in a register nobody below has any purchase on. The characters are cut cleanly and there is nothing hidden. There is simply nothing under them for anybody who is not the author.',
    andSomeOfItIsPerfectlyLegible:
        'Which is a different failure and produces a different kind of ruin. A carving in the ordinary hand of its province can be read completely by anybody and still be about a world that no longer exists, and what gets built on it is built in complete good faith on a correct reading of a true statement. That is how a table of distances comes to be wrong for eleven hundred years without anybody having made an error.',
    itIsNotTheColdCurriculum:
        'Distinguish these from the ledge above the Frostmirror ice field, which is a different problem with a similar surface. That curriculum is legible, complete and unusable because the obstacle is the reader\'s body - an aperture a wuxing root does not have. These carvings are unusable because the obstacle is the reader\'s altitude and the author\'s assumptions, and no root anywhere opens that. Two failures, two different doors, and neither is a puzzle to be solved.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/** The hands a carving can be in. Named from the transmission work in `history.ts`. */
export const CarvingScriptSchema = z.enum([
    'ordinary',
    'standing_hand',
    'gate_hand',
    'tally_hand',
    'method_script',
    /** Their own shorthand. The commonest and the least recoverable. */
    'own_hand'
]);
export type CarvingScript = z.infer<typeof CarvingScriptSchema>;

export const CarvingLegibilitySchema = z.enum(['fully', 'partly', 'not_at_all', 'unseen']);
export type CarvingLegibility = z.infer<typeof CarvingLegibilitySchema>;

export const DaoCarvingSchema = z.object({
    id: z.string(),
    where: z.string().min(60),
    whatItIs: z.string().min(120),
    script: CarvingScriptSchema,
    legible: CarvingLegibilitySchema,
    /** Faction currently standing over it, or null where nobody does. */
    heldByFactionId: z.string().nullable(),
    /** Whether the holder knows what they are standing over. Usually not. */
    holderKnows: z.boolean(),
    /** What has been built on it, correctly or otherwise. */
    builtOnIt: z.string().min(150),
    /** Arts already in the technique catalog that came out of this face. */
    yieldedTechniqueIds: z.array(z.string().min(3))
});
export type DaoCarving = z.infer<typeof DaoCarvingSchema>;

/**
 * How they left the world. Five, and the record can only defend one of them
 * per entry even where two are plainly true.
 */
export const FalseImmortalEndSchema = z.enum([
    /** Went where the answer was. Did not come back. */
    'went_looking',
    /** The trajectory took them, and what followed is a separate question. */
    'went_mad',
    /** Something came down, and it took the time it took. */
    'ended_from_above',
    /** The span expired. The commonest end and the one nobody counts. */
    'ran_out',
    /** The record stops and the catalog declines to fill it in. */
    'unresolved'
]);
export type FalseImmortalEnd = z.infer<typeof FalseImmortalEndSchema>;

/**
 * Where the protector came from, and it decides almost everything about how
 * the arrangement reads.
 *
 *   internal   one of the house's own, who crossed from it and came back. The
 *              norm by a wide margin, and it generates almost no record at all,
 *              because a house writes its own ancestor standing on its own
 *              mountain up as continuity rather than as an event.
 *   external   somebody else's existence on your ground. Rare, possible, and
 *              awkward in ways an internal one never is - and it produces
 *              instruments, disputes, correspondence and gossip, which is why
 *              the surviving record is so heavily skewed toward it.
 */
export const RecruitmentSchema = z.enum(['internal', 'external']);
export type Recruitment = z.infer<typeof RecruitmentSchema>;

export const HeldOfficeSchema = z.object({
    /**
     * The house. Null where the house is gone and unnameable, which is not an
     * oversight - a house that ended this way is precisely the kind that leaves
     * no name, and `factionNote` says what is actually known.
     */
    factionId: z.string().nullable(),
    factionNote: z.string().min(80),
    recruitment: RecruitmentSchema,
    /** Why they were here rather than at the house that made them. */
    recruitmentNote: z.string().min(120),
    /** The local title. No two houses used the same one. */
    title: z.string().min(3),
    fromYearsAgo: z.number().int().positive(),
    toYearsAgo: z.number().int().min(0),
    /** What this house specifically supplied, which was never material. */
    whatTheHouseSupplied: z.string().min(150),
    /** What the house got, stated without the ceremony on top of it. */
    whatTheHouseGot: z.string().min(120),
    /** Whether the house ever tried to give an instruction, and what happened. */
    theOrderThatWasGiven: z.string().min(100).nullable()
});
export type HeldOffice = z.infer<typeof HeldOfficeSchema>;

export const FalseImmortalRecordSchema = z.object({
    id: z.string(),
    name: z.string().min(2),
    /** What the house called them, where a house did. */
    calledBy: z.string().min(3),
    /**
     * Null where nothing survives that would date it. The catalog does not
     * estimate: an unknown crossing date makes the whole trajectory
     * unassignable, and saying so is the honest entry.
     */
    crossedYearsAgo: z.number().int().positive().nullable(),
    /**
     * How many years they kept out of the rung's grant, where anybody recorded
     * it. See `THE_REMAINDER`: this is the price charged once, not a decline.
     */
    remainderAtCrossingYears: z.number().int().positive().nullable(),
    remainderNote: z.string().min(100),
    /** Which of the three they were actually spending the years on. */
    path: LegacyPathSchema,
    pathNote: z.string().min(150),
    office: HeldOfficeSchema.nullable(),
    carving: DaoCarvingSchema.nullable(),
    end: FalseImmortalEndSchema,
    endedYearsAgo: z.number().int().min(0),
    endNote: z.string().min(200),
    /** Where the record cannot separate the two exits, this says so. */
    whichExitItReallyWas: z.string().min(120).nullable(),
    /** Stage they were at when the record ends, or null where undatable. */
    stageAtEndId: z.string().nullable(),
    legacyAtEnd: LegacyStateSchema,
    /** What became of the thing they were leaving behind. */
    whatBecameOfIt: z.string().min(150),
    /** Traces a player could actually find, each one concrete. */
    whatSurvives: z.array(z.string().min(50)).min(1),
    /**
     * Always false. There are no serving protectors in this world, and the
     * field exists so that adding one fails a test rather than passing quietly.
     */
    servingNow: z.literal(false)
});
export type FalseImmortalRecord = z.infer<typeof FalseImmortalRecordSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// Seven, across roughly five thousand years, of whom none is serving and
// none is alive in this world in any way anybody can establish.
// ─────────────────────────────────────────────────────────────────────────

export const FALSE_IMMORTALS: readonly FalseImmortalRecord[] = [
    {
        id: 'fi-yu-han',
        name: 'Yu Han',
        calledBy: 'The Second Stone',
        crossedYearsAgo: 31_000,
        remainderAtCrossingYears: 34_000,
        remainderNote:
            'Thirty-four thousand, which he gave to the Girdle once, in a letter about something else, and which the house entered in its survey ledger under a column for durations because that is the column it had. It is the only figure of its kind anybody in either province has ever written down.',
        path: 'protector',
        pathNote:
            'The clearest case of path one in the record. He came to the Girdle of Nine Stones because a containment house is a thing that is only worth anything if it is still standing in two thousand years, which is a project with the right shape for somebody who has thirty-four thousand of them. He was not being generous and would not have understood the word. He wanted something to still be there.',
        office: {
            factionId: 'house-girdle-of-nine-stones',
            factionNote:
                'The containment house destroyed nine hundred years ago by the Anchorhold, which was raised from its survivors and taught an account of the ending that is not what happened.',
            recruitment: 'external',
            recruitmentNote:
                'Entirely external and the most awkward case in the catalog, because the Girdle had never produced a crossing and never would. He was not their ancestor, owed them nothing, had no history on that perimeter and no reason to die for it, and everybody in the house knew all four of those things every day for twenty-three centuries. What they did about it was write the instrument as an invitation and then never refer to it again, and what he did about it was stay.',
            title: 'The Second Stone, which is a position on the perimeter rather than a rank in the house',
            fromYearsAgo: 5_200,
            toYearsAgo: 2_900,
            whatTheHouseSupplied:
                'A survey that ran continuously, nine stones that had to be held against ground actively trying to give them up, and a genuinely difficult problem that got no easier for twenty-three centuries. The Girdle never had to entertain him. It handed him a perimeter that would fail if anybody stopped thinking about it, and that turned out to be the most valuable thing any house in this catalog ever supplied.',
            whatTheHouseGot:
                'Two thousand three hundred years in which nobody attempted anything against the Girdle, and a containment that did not fail once. The house understood the first part perfectly and attributed the second to its own method.',
            theOrderThatWasGiven: null
        },
        carving: {
            id: 'carving-the-inner-faces',
            where: 'The inner faces of three of the eight standing stones, on the sides that face the perimeter rather than the road, where nothing was ever expected to be looked at.',
            whatItIs:
                'A course of cutting that is not containment work and was never part of the survey. It runs to about nine hundred characters across the three faces, it is finished rather than abandoned, and the Anchorhold has surveyed all eight stones four times without publishing a word about what is on the inside of them.',
            script: 'gate_hand',
            legible: 'not_at_all',
            heldByFactionId: 'house-anchorhold',
            holderKnows: false,
            builtOnIt:
                'Nothing, which is the ordinary case and worth having once. Three sign groups of the gate hand are agreed and one of the three is agreed to be a number, so what the Anchorhold has is nine hundred characters of which it can identify roughly forty and can read none. It surveys them, records that they are unchanged, and files the entry under condition of the stones. The house has never asked why a containment house would cut gate hand on anything.',
            yieldedTechniqueIds: []
        },
        end: 'went_looking',
        endedYearsAgo: 2_900,
        endNote:
            'He walked into the seventh terminal and did not come back. He said where he was going, to two people, and neither of them thought to write down that the seventh had been closed for eight thousand years by then - it is a Measured Span terminal in the eastern hills and it does not answer, and everybody in the region knows it does not answer, and he went in anyway. The Girdle recorded his departure as a departure. It recorded nothing else about it, ever, and it went on maintaining the office in its ceremonies for the next two thousand years.',
        whichExitItReallyWas:
            'Both, and it cannot be separated. He was at the Settled Error, and the memory a man acquires at the Settled Error is accurate: he remembered the seventh terminal answering, because it did, and nothing since had been permitted to overwrite it. So he went to a door that had been shut for eighty centuries with complete confidence, and the record has it as an expedition.',
        stageAtEndId: 'stage-the-settled-error',
        legacyAtEnd: 'holding',
        whatBecameOfIt:
            'The Girdle stood for another two thousand years and then was ended by the Anchorhold, which broke the eastern nail itself to demonstrate that the Girdle could not hold the survey. Nobody involved on either side knew that the Girdle had been keeping an empty office for twenty centuries, and nobody has worked out since that the house the Anchorhold\'s founders moved against had lost its deterrent before the Counting Age ended. He does not know any of it happened.',
        whatSurvives: [
            'nine hundred characters of gate hand on the inner faces of three standing stones, surveyed four times and never published',
            'a duration entered in the Girdle survey ledger in a column meant for something else, which the Anchorhold inherited and has never queried',
            'the office in the Girdle ceremonies, kept for two thousand years after the occupant walked out, which is why the accounts of the house are confident about a protector nobody alive ever saw'
        ],
        servingNow: false
    },
    {
        id: 'fi-shi-wan',
        name: 'Shi Wan',
        calledBy: 'The Standing Sum',
        crossedYearsAgo: 8_400,
        remainderAtCrossingYears: null,
        remainderNote:
            'Unknown, and the joke is at the expense of the only house it could possibly be at the expense of. The Tally Court totalled what the crossings had taken out of everybody in the world, entered the Lid as the party that owed it, and could not get a figure out of the one person in its own building who had actually crossed. She was asked. She did not refuse and she did not answer, and there is no entry.',
        path: 'peak',
        pathNote:
            'Path two, held openly, and she was the only False Immortal in this catalog who said so out loud. She was at the Tally Court because the Court was working on the same question she was from the other end - what the crossings cost and where the cost goes - and she stated plainly and repeatedly that she was there until the work took her somewhere else. It did.',
        office: {
            factionId: 'house-tally-court',
            factionNote:
                'The karma house ended twenty-three centuries ago by its own auditors, who founded the Ninefold Ledger the following year and kept the volumes.',
            recruitment: 'external',
            recruitmentNote:
                'External, and it never troubled either party, because she was not there for the house. She had crossed four thousand years before the Tally Court existed and turned up at it for the same reason a scholar turns up at an archive. The Court was clear-eyed about what it had: not an ancestor and not a partisan, but somebody working on the same question who would leave when the question moved, which she told them and then did.',
            title: 'The Standing Sum, which the Court entered on its roll as a line rather than as a person',
            fromYearsAgo: 4_100,
            toYearsAgo: 2_400,
            whatTheHouseSupplied:
                'The single largest body of accounting anybody has ever assembled about the crossing, and colleagues who could argue with her about it competently. The Tally Court was the one house in the world doing work she would have been doing anyway, which is why she stayed seventeen hundred years and why she gave it nothing beyond her presence and did not need to.',
            whatTheHouseGot:
                'The most complete impunity any house in the record has enjoyed, and the confidence to enter the Lid as a debtor in its own volumes. The second of those is what got it destroyed and it could not have been written down at all without her standing in the building.',
            theOrderThatWasGiven: null
        },
        carving: {
            id: 'carving-under-the-burned-seat',
            where: 'Under the burned seat at Sweptground, behind the seal the Tally Court cut in its last year, on ground where debts sworn do not settle and never have since.',
            whatItIs:
                'Her account of the arterial system and where its output goes, cut into the wall of the Court\'s own seat chamber over about a century, finished a hundred years before the house ended. It is the only thing she ever wrote down and it is not a technique. It is a survey of the thing every institution in the world is now quietly losing to.',
            script: 'tally_hand',
            legible: 'unseen',
            heldByFactionId: 'sect-sweptground-temple',
            holderKnows: false,
            builtOnIt:
                'Nothing whatever, by anybody, in twenty-three centuries. The Temple knows there is something under its ground and has never investigated, on the Abbot\'s stated reasoning that a thing sealed by dead people is not the Temple\'s business. The Ninefold Ledger almost certainly holds the reason for the seal in its nine sealed volumes and has never opened them. Whether the Court sealed the chamber to keep something in, to keep something preserved, or to keep something from being read is genuinely open, and this entry supplies a fourth possibility rather than settling any of the three: that it sealed her wall.',
            yieldedTechniqueIds: []
        },
        end: 'went_looking',
        endedYearsAgo: 2_400,
        endNote:
            'She went down the arterial system to find out where the qi comes from. She said so, gave a reason, and the reason was correct - the question is the one every survey in the world has been circling for four thousand years, she was the only being alive who could have gone and looked, and going and looking was the obvious thing to do. She went down at a branch the Deep Survey now numbers as the fourth and has not been reported since. There is no scar, no body and no account. Nothing about her departure was confused, hurried or strange, and it is the cleanest instance of path two in the record.',
        whichExitItReallyWas: null,
        stageAtEndId: 'stage-the-long-work',
        legacyAtEnd: 'holding',
        whatBecameOfIt:
            'The Tally Court was ended by its own auditors within a century of her going down, which they could not have attempted while she was standing in the building, and every account of the ending that survives is theirs. The Ledger has held her figures ever since without knowing they are hers, in volumes it has never opened, in a hand it can read.',
        whatSurvives: [
            'nine sealed volumes in the Ninefold Ledger vault index with no subject line, which almost certainly contain her figures',
            'a wall under the burned seat at Sweptground that nobody has looked at in twenty-three centuries',
            'a branded bloodline in the eastern towns carrying an obligation nobody can identify, entered by a house that was totalling what the crossings had taken and had her arithmetic to do it with'
        ],
        servingNow: false
    },
    {
        id: 'fi-deng-ru',
        name: 'Deng Ru',
        calledBy: 'The Guest at Kettle',
        crossedYearsAgo: 44_000,
        remainderAtCrossingYears: null,
        remainderNote:
            'Never given and never asked for. He had been across for forty thousand years before the Measured Span ever met him and the Span had no framework in which the question would have occurred to anybody. Whether he is still alive is therefore not answerable: nothing rules it out and nothing supports it, and this catalog does not resolve it.',
        path: 'peak',
        pathNote:
            'Path two, completed. He reached the bottom of his own dao somewhere in the region of four thousand years before he ever came to the Span, which means he arrived at the office already holding a finished axis and nowhere to put it. The post was not a project. It was somewhere to be afterwards, and this catalog holds him up as the clearest demonstration that being afterwards is the dangerous condition rather than being busy.',
        office: {
            factionId: 'house-measured-span',
            factionNote:
                'The gate house that holds the terminal survey and the true-distance table, and has never produced an original figure of its own - which is what it sincerely believes.',
            recruitment: 'external',
            recruitmentNote:
                'External, and the Span never once put it that way, because the Span never put it any way at all. He was entered on a station roll rather than a house roll, which is what the Span does with a surveyor it has hired for a season, and nobody ever revised the entry in eleven hundred years. It is the least ceremonious arrangement in the catalog and it worked better than any of the others.',
            title: 'The Guest at Kettle, entered on the station roll and never on the house roll',
            fromYearsAgo: 4_600,
            toYearsAgo: 3_500,
            whatTheHouseSupplied:
                'Terminals. Twenty-two closed and nine answering, a survey listing thirty-one, and a house that would talk about nothing else for as long as anybody would sit there. It was the last subject in the world he still had an appetite for, and the Span gave him eleven hundred years of it without ever once asking him for anything.',
            whatTheHouseGot:
                'Eleven hundred years of a guest at Kettle station who was never described as anything more than that, and nine amended entries in the true-distance table, which is the part the Span does not know it got.',
            theOrderThatWasGiven: null
        },
        carving: {
            id: 'carving-under-the-kettle-plaster',
            where: 'On the north wall of the second room at Kettle station, faced over with lime plaster during a rebuild four hundred years ago by masons who recorded the wall as bearing old cutting of no interest.',
            whatItIs:
                'A folding: how two known places are brought against each other and walked across, cut out in full by somebody who remembered doing it as a matter of ordinary travel. About two thirds of the face was recorded in a station notebook before the plaster went on, by a clerk who copied it because it was there and did not understand a character of it.',
            script: 'ordinary',
            legible: 'partly',
            heldByFactionId: 'house-measured-span',
            holderKnows: false,
            builtOnIt:
                'A great deal, at second and third hand, and none of it credited. The clerk\'s notebook left the station in an estate sale, and the art that came out of it is in circulation as a recovered fragment of nobody in particular. The Span is holding the original under two fingers of plaster in a room its own staff sit in every day, has the notebook nowhere, and would not connect the two if it had both.',
            yieldedTechniqueIds: ['void-fold-pilgrimage']
        },
        end: 'went_mad',
        endedYearsAgo: 3_500,
        endNote:
            'Over about a century he answered less, and then not at all, and one spring he walked out of Kettle station and down the eastern road toward a terminal that stopped existing eleven thousand years ago. The station book has one line in the ordinary hand recording that the Guest departed on that date, and no further entry of any kind. Nobody went after him. Nobody at the station thought anything had happened, because from inside the building nothing had: a very old man had stopped being talkative and then had gone somewhere, which is what very old men do.',
        whichExitItReallyWas:
            'The record would call it going looking and this catalog calls it the trajectory, and the distinction rests on the eleven hundred years before it rather than on the walk. A man who spends a century answering less and then leaves for a place that is not there has not decided anything. He has arrived somewhere.',
        stageAtEndId: 'stage-the-settled-error',
        legacyAtEnd: 'finished',
        whatBecameOfIt:
            'Nine entries of the true-distance table carry corrections in the Span\'s own hand, unsigned, all made in one season, and they are the only original figures the house has ever produced. The Span believes they are a recovered Wide Age correction, which in every sense that matters they are: he took them himself, correctly, when the network ran. Every courier contract and freight span in two provinces has been priced off them for eleven hundred years and the Span cannot find the error, because there is no error in them.',
        whatSurvives: [
            'nine corrected entries in the true-distance table, unsigned, in the Span\'s own hand, which price every courier contract in two provinces',
            'a line in the Kettle station book recording that the Guest departed, with no entry before it and none after',
            'about two thirds of a folding, copied by a clerk who did not understand it, circulating as a recovered fragment with no attribution',
            'the original under lime plaster on the north wall of a room the Span uses daily'
        ],
        servingNow: false
    },
    {
        id: 'fi-the-courtyard',
        name: 'The one in the courtyard, whom the three accounts name differently',
        calledBy: 'Nothing that can be established. Two of the three accounts give a title and the two titles are not the same title.',
        crossedYearsAgo: null,
        remainderAtCrossingYears: null,
        remainderNote:
            'Nothing survives that would date the crossing, so nothing about the trajectory can be assigned to him, and the catalog does not guess. He is the entry that exists to demonstrate what the record actually looks like when it fails, which is most of the time.',
        path: 'transmission',
        pathNote:
            'Path three, and the loss is total for exactly that reason. He was teaching - all three accounts agree that there were students in the courtyard, and they disagree about how many and about whether any of them were still there afterwards. A transmission held only in the people being shown it does not survive the people, and nothing of his does.',
        office: {
            factionId: null,
            factionNote:
                'Not nameable. The three surviving accounts name three different houses, two of which certainly did not exist yet at the date all three give, and the Ninefold Ledger has never been able to do anything with that beyond record it.',
            recruitment: 'internal',
            recruitmentNote:
                'Internal on all three accounts, which is the one thing they agree about besides the duration, and it is why the house is unnameable rather than merely unnamed. An internal protector is a house\'s own ancestor doing what a house expects of an ancestor, so nobody writes an instrument, nobody arbitrates anything and nobody outside is told. The record of an internal arrangement is the house, and the house is gone.',
            title: 'Given in two of the three accounts, differently',
            fromYearsAgo: 3_000,
            toYearsAgo: 2_700,
            whatTheHouseSupplied:
                'Students, on the only reading of the accounts that makes them consistent with each other. Whatever else the house was, it was a place with people in it who were being shown something, and that is the whole of what anybody can say about what it was offering him.',
            whatTheHouseGot:
                'Unknown, and it is unlikely that it survived him by long. No house in either province claims descent from anything at that site, which for a house that had a False Immortal standing on it is not what one would expect.',
            theOrderThatWasGiven: null
        },
        carving: null,
        end: 'ended_from_above',
        endedYearsAgo: 2_700,
        endNote:
            'Something came down and settled it in the time it takes to cross a courtyard. Eleven people saw it, three accounts survive in three unrelated archives, and they agree on the duration and on nothing else - not the name, not the house, not the season, and not what he had done. Two of the three say the thing he had done was small. All three say he was not fighting when it finished, and two of the three say he was not fighting when it started either. What came is not described in any of them in a way that establishes it was a person.',
        whichExitItReallyWas: null,
        stageAtEndId: null,
        legacyAtEnd: 'failed',
        whatBecameOfIt:
            'Nothing. No students are traceable, no house claims the site, no art is attributed to him and no carving of his has ever been found. He is the one entry in this catalog with no legacy of any kind, which is what happens to path three when the transmission is held in people and the people are in the courtyard.',
        whatSurvives: [
            'three accounts in three unrelated archives, agreeing on the duration and on nothing else, none of which has ever been placed beside the other two',
            'a Deep Survey register entry for the site filed under weather, which is the closest any institution has come to writing it down as an event',
            'the only evidence in the world that there is a ceiling above a False Immortal and that it is occupied'
        ],
        servingNow: false
    },
    {
        id: 'fi-qin-zhao',
        name: 'Qin Zhao',
        calledBy: 'The Kept Name',
        crossedYearsAgo: 2_300,
        remainderAtCrossingYears: 1_500,
        remainderNote:
            'One thousand five hundred, which he gave the House of Held Names on the day he came back down because they asked, and which they entered correctly on the register wall beside the name. It is the only remainder in this catalog recorded by a party that understood exactly what it was being told, and it is under a strike.',
        path: 'protector',
        pathNote:
            'Path one, chosen by somebody who did not have the years for anything else. Fifteen hundred is a countable life by the standards of this file - it does not reach the end of the first stage, let alone anything past it - and he knew that on the day of his crossing. So he did not attempt a dao that would need forty thousand years and did not go looking for anything that could not be reached inside a lifetime he could count. He did go looking first, for six hundred years, which is what everybody does - and then he came back, which is what almost nobody does, walked down to the house that had raised him, and stood on it for nine hundred years.',
        office: {
            factionId: 'house-held-names',
            factionNote:
                'The counter-register house, whose founding demonstration was holding a name through a crossing and giving most of it back.',
            recruitment: 'internal',
            recruitmentNote:
                'Internal, and it is the model case: the house raised him, sent him up, and got him back. It is also the only crossing the House of Held Names has ever produced, which is why the reserved post existed there at all - and it is why the house does not appear in anybody\'s crossing records, because the entry that would say so is the one it struck.',
            title: 'The Kept Name, cut on the register wall in the ordinary hand beside the figure',
            fromYearsAgo: 1_700,
            toYearsAgo: 800,
            whatTheHouseSupplied:
                'The only house in the world whose entire product is the question of what a crossing takes and what of a person survives it, run by people who had known him since before he went up and would ask him directly and write the answers down. He was not a curiosity to them and they never treated him as one. He was the best source they had ever had, and they used him the way an archive uses a source, respectfully and constantly, for nine hundred years.',
            whatTheHouseGot:
                'Nine centuries of first-hand testimony from the far side of the last crossing, entered in the counter-register under the name of somebody the house believed in absolutely, and a protector nobody in the province ever tested.',
            theOrderThatWasGiven: null
        },
        carving: {
            id: 'carving-the-struck-name',
            where: 'The register wall of the House of Held Names, third course from the bottom, in the ordinary hand of the province, with a single ruled line through it.',
            whatItIs:
                'His name, his rank at the end of the last crossing, and the figure he gave them. Three lines. He never cut anything else anywhere, was asked twice to and declined both times without explaining, and this is the only legible carving by a False Immortal that anybody in either province can walk up to and read.',
            script: 'ordinary',
            legible: 'fully',
            heldByFactionId: 'house-held-names',
            holderKnows: false,
            builtOnIt:
                'A conclusion, and the conclusion is wrong. When he died the house examined the body, found it ordinary in every way a body can be measured, and reasoned that a being of that rank could not leave that - so the entry was a fraud, the testimony behind it was a fraud, and nine hundred years of counter-register material sourced to him was quietly reclassified as uncorroborated. Nobody in the room had ever met anybody who had met him before he went up; the Keepers who watched him go were nine centuries dead, and what the house had instead of a memory was a document, which is the thing this house of all houses knows is losable. They struck the name rather than erasing it, because the house does not erase, which means the strike is a ruled line and the name is perfectly readable underneath it. Every visitor is told what the line means and every visitor is told wrongly.',
            yieldedTechniqueIds: []
        },
        end: 'ran_out',
        endedYearsAgo: 800,
        endNote:
            'The span expired, on the year he had given them, in a chair, in the afternoon, with two Keepers in the room and nothing whatever remarkable about it. He had said the year out loud eleven times across nine centuries and nobody had ever quite believed him. He was the last serving protector in the world and neither he nor the house had any idea that was what he was.',
        whichExitItReallyWas: null,
        stageAtEndId: 'stage-the-interval',
        legacyAtEnd: 'holding',
        whatBecameOfIt:
            'It failed after he was dead and it failed because of the corpse. Nine centuries of the best material any institution in the world has ever held about the last crossing was reclassified as uncorroborated inside four years, on a reading of a body by people who had no way to know that a False Immortal whose span runs out leaves exactly that and nothing else. The House of Held Names is still working, still respected, and is the only party in the world that has ever had the answer and thrown it away.',
        whatSurvives: [
            'a name, a rank and a figure on the register wall of the House of Held Names, under a ruled line, readable by anybody who walks in',
            'nine hundred years of counter-register testimony about the last crossing, filed as uncorroborated and open to any Keeper who asks',
            'the strike itself, which the house explains to every visitor and explains wrongly',
            'the one fact the world could have had and did not keep: that a False Immortal who runs out leaves an ordinary corpse'
        ],
        servingNow: false
    },
    {
        id: 'fi-xiang-wu',
        name: 'Xiang Wu',
        calledBy: 'The one who kept the road',
        crossedYearsAgo: 120_000,
        remainderAtCrossingYears: null,
        remainderNote:
            'Nobody ever asked and there is no figure anywhere. He had been across for a hundred and fourteen thousand years when he arrived at the mountain, which is longer than any institution in the world has existed and longer than the ages have names for, and nobody in the house had a concept that would have made the question occur to them.',
        path: 'transmission',
        pathNote:
            'Path three, at the largest scale anybody has ever attempted it. He took the post because a house is a room full of people you can show things to, and he spent twelve hundred years cutting a dao into a practice yard section by section for readers he assumed would keep arriving. It is the single largest body of carved dao in either province and it is the sharpest instance in the catalog of a legacy failing, because the readers stopped and he did not.',
        office: {
            factionId: null,
            factionNote:
                'A Counting Age house squatting in a Standing Age compound in the high Low Fall. Its name is cut on its own boundary stone in Standing hand prose, which nobody can read, so the house is nameless for exactly the reason everything else about the site is: the record is there and cannot be opened.',
            recruitment: 'external',
            recruitmentNote:
                'External, and the house never knew by how much. It took in a courteous stranger of no stated age who could show its disciples things nobody else in the world could show them, and it did not occur to anybody to ask when he had crossed, because the question has no ordinary answer and the house had no ordinary reason to want one. He had been across for longer than every institution in the world put together.',
            title: 'Not recorded. The house wrote about him constantly and never once used a title.',
            fromYearsAgo: 5_400,
            toYearsAgo: 4_100,
            whatTheHouseSupplied:
                'People, continuously, for thirteen centuries, and an entire practice yard they let him cut up. By every account in the house record it was the best thing that had ever happened to them and they knew it at the time - a hundred and forty disciples at the peak, in a compound built for eight hundred, being shown things by somebody nobody else in the world had access to.',
            whatTheHouseGot:
                'Thirteen hundred years of the finest transmission available anywhere, a yard nobody has ever fully read, and then a hundred and ten years in which nobody could leave the mountain.',
            theOrderThatWasGiven: null
        },
        carving: {
            id: 'carving-the-practice-yard',
            where: 'The floor of the practice yard of an intact, unlooted, never-resettled Standing Age compound in the high Low Fall, which local practice says you do not go to.',
            whatItIs:
                'A complete dao, cut in courses across roughly four hundred paces of dressed floor over twelve hundred years. It is the largest single body of carved dao in either province by an enormous margin and there is no second place. The characters are cut cleanly throughout, in one hand, at one standard, from the first course to the last.',
            script: 'own_hand',
            legible: 'partly',
            heldByFactionId: null,
            holderKnows: false,
            builtOnIt:
                'The first third has been read, once, about six hundred years ago, by somebody who got a genuine art out of it and did not say where. The remaining two thirds have never resolved into anything for anybody, and the reason is the part worth understanding: they are the same characters in the same hand cut to the same standard, and they were made after the readers stopped. The yard is a legible record of a mind narrowing, laid out in order, at a rate of about a course a year, and nobody who has stood on it has ever recognised that is what they were looking at.',
            yieldedTechniqueIds: ['immovable-heaven-pillar']
        },
        end: 'went_mad',
        endedYearsAgo: 4_060,
        endNote:
            'A rockfall took the lower road about four thousand two hundred years ago and the house began going down by the eastern path instead. The eastern path was the one nobody was to use, for a reason that had been correct ninety thousand years earlier, and he turned them back at it. Courteously, without heat, without explanation, and every single time, for a hundred and ten years. Nobody was hurt and nobody was threatened. The house wrote down every attempt in a hand that gets worse toward the end, and then it starved on its own mountain, and about forty years after that a party from the valley found the compound empty and him not in it. Where he went is not recorded anywhere by anybody.',
        whichExitItReallyWas:
            'Not ambiguous, and it is the only entry here that is not. He was at the Long Repetition before the house ever met him and had been for twenty-five thousand years, which nobody could have known and nobody did. The house did not acquire a protector who later declined. It took in somebody who was already keeping something, gave him thirteen hundred good years, and then changed which road it used.',
        stageAtEndId: 'stage-the-long-repetition',
        legacyAtEnd: 'failed',
        whatBecameOfIt:
            'The house is gone and the compound is not. It stands intact, unlooted and never resettled, at node counts far above what anybody now can light, and the reason is neither haunting nor formation: a compound where everybody starved in place with the doors standing open is a thing local practice has a rule about, and the rule has held for four thousand years without anybody remembering what it is for.',
        whatSurvives: [
            'a complete carved dao across four hundred paces of practice yard floor, of which the first third has been read once and the rest never',
            'an intact Standing Age compound in the high Low Fall that nobody enters, at node counts nobody can light',
            'the house record of the hundred and ten years, kept to the end, in a hand that deteriorates - the only first-hand account of the fourth stage in existence',
            'a boundary stone carrying the house name in Standing hand prose, which is the reason nobody can say whose compound it is'
        ],
        servingNow: false
    },
    {
        id: 'fi-mo-xun',
        name: 'Mo Xun',
        calledBy: 'The Ninth Guest',
        crossedYearsAgo: 19_000,
        remainderAtCrossingYears: 21_000,
        remainderNote:
            'Twenty-one thousand, which he mentioned once at the Nine Peaks in the course of declining something and which the Order recorded as a quantity, because quantities are what the Order records. It is in the offering ledger, in the numerals everybody can read, in a column with no heading.',
        path: 'peak',
        pathNote:
            'Path two, and he was five hundred years into a post before he admitted to himself that was what it had always been. He came to the Nine Peaks because an ascetic order that carries nothing and asks for nothing is a restful place to think, and he left the moment thinking somewhere else looked better - which is the whole of path two and is not dramatic in the slightest.',
        office: {
            factionId: 'sect-nine-peaks-ascetic-order',
            factionNote:
                'The ascetic order on the nine peaks, which holds its founding record in a hand whose numerals it reads perfectly and whose prose it has not read in eight hundred years.',
            recruitment: 'external',
            recruitmentNote:
                'External, and the Order handled it the way the Order handles everything, which is to say it did not handle it. Nobody negotiated, nobody drew an instrument and nobody entered him on any roll except the one that records who is on which peak. The Order asks nothing of anybody and therefore had nothing to ask of him, which is the only reason an external arrangement there was frictionless and is also why it ended the first afternoon somebody asked.',
            title: 'The Ninth Guest, which is what the Order calls anybody staying on the ninth peak and was never a title at all',
            fromYearsAgo: 4_900,
            toYearsAgo: 4_400,
            whatTheHouseSupplied:
                'Nothing, deliberately, which is why it worked. The Order asks nothing of anybody, offers nothing to anybody, and left him alone on the ninth peak for five hundred years with the weather and the workings, and that turned out to be exactly what somebody two thirds of the way down their own dao wanted. He said as much, once, and the Order recorded the date and not the sentence.',
            whatTheHouseGot:
                'Five hundred years of not being interfered with by anyone in the province, which the Order attributed entirely to the peaks being difficult to reach.',
            theOrderThatWasGiven:
                'One, on a spring afternoon four thousand four hundred years ago. A boundary with a neighbouring holding had gone bad and a Mountain Elder asked him to go down and settle it. He stood up, said that was not what he was there for, and walked down the mountain. He did not come back and the Order has never written down that any of it happened.'
        },
        carving: {
            id: 'carving-the-lintel-underside',
            where: 'The underside of the lintel of the ninth peak shelter, which is a surface nobody looks at because there is nothing on any other lintel in the compound.',
            whatItIs:
                'Nine characters, cut small, in the ordinary hand, entirely legible, meaning nothing at all to anybody who reads them. It is a record that he was there rather than a transmission of anything, and it is the plainest example in the catalog of what carving is usually for.',
            script: 'ordinary',
            legible: 'fully',
            heldByFactionId: 'sect-nine-peaks-ascetic-order',
            holderKnows: false,
            builtOnIt:
                'Nothing, because nobody has looked. Ascetics have slept under that lintel continuously for four and a half thousand years and the characters are twenty inches above where a sleeping person\'s eyes would be if they opened them, which they do not. Somebody who does look is reading the only sentence a False Immortal ever left in a script anybody can read that was intended to be found, and it will not tell them anything except that he was there, which is exactly what it was for.',
            yieldedTechniqueIds: []
        },
        end: 'went_looking',
        endedYearsAgo: 4_400,
        endNote:
            'He walked down the mountain the same afternoon he was asked for something and went east. The last record of him anywhere is a Measured Span station daybook nine years later: a traveller asked which of the terminals open somewhere a person can breathe, was told the four, thanked the clerk, and left. The clerk wrote it down because the question was unusual, and the entry gives no name because the traveller did not offer one and the clerk did not ask.',
        whichExitItReallyWas:
            'Going looking, and the catalog is reasonably confident. He was fourteen and a half thousand years across, well inside the second stage, entirely lucid on every account of him, and he asked a specific question and got a specific answer before doing anything. That is a decision rather than an arrival, and it is the difference between him and Yu Han.',
        stageAtEndId: 'stage-the-long-work',
        legacyAtEnd: 'holding',
        whatBecameOfIt:
            'The Order lost five hundred years of undisturbed peace and never connected the loss to the departure. Its offering weights change abruptly in the year he left, in the direction of a house that has begun paying for things it did not previously have to pay for, and they have never changed back - which is the only evidence anywhere that he was ever there, and it is in a column of numerals that the Order reads perfectly and has never interpreted.',
        whatSurvives: [
            'nine legible characters on the underside of the ninth peak lintel, which nobody has ever looked at',
            'a step change in the Nine Peaks offering weights in one year, in numerals the Order reads perfectly and has never interpreted',
            'a remainder figure of twenty-one thousand in an unheaded column of the Order offering ledger',
            'an unnamed entry in a Measured Span station daybook, nine years later, about a traveller who asked which terminals open somewhere breathable'
        ],
        servingNow: false
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE REGISTER OF POSSIBLE FALSE IMMORTALS
// What the marks above actually produce in the world. Every entry in the
// catalog left something still working, an institution that notices things
// wrote a line about who it might have been, and the lines cannot be closed.
// The register is maintained and never used. It is also where the one living
// candidate sits, as one line among several, and nothing here may give
// anybody a way to tell his line from the rest of them.
// ─────────────────────────────────────────────────────────────────────────

export const THE_CANDIDATE_REGISTER = {
    whatItIs:
        'A list of people the world has some reason to think came back from a crossing. One line each, maintained at the three apex institutions and nowhere else, and it is not a watch list: nobody on it is being looked for, nobody on it has been approached, and most of the names are of people who have been dead for thousands of years. It is a register of questions that cannot be closed, kept because an institution that notices things cannot un-notice them and has no procedure for striking a line it was never able to disprove.',
    whatIsActuallyPublic:
        'Admissions, and nothing after them. You cannot hide somebody walking up a mountain and being taken in - people see arrivals, the person had a life somewhere before, and somebody notices when they stop having it - so who has entered the Hollow Court is a matter of public fact going back centuries. Rank, seat, standing, progression, whether they are still alive and whether they ever attempted the crossing are internal and have never been stated by anybody. It is not a wall. It is a house with one open door and no windows.',
    soTheApexesHoldAListOfTheHouseAndNotADossier:
        'Which is what the three institutions are actually holding, and it is worth writing it that way round rather than as a file on any individual. What they have is a list of everybody known to have gone up those mountains, kept because the Court admits at Void Refinement and a Void Refinement admission is a rare and individually remarkable event that three separate institutions would each note the year of. It goes back centuries, it is probably accurate, and it is nearly useless: it records who went in and nothing whatever about what became of them.',
    theMarksAreWhatGeneratesIt:
        'And the evidence base is the catalog above, which is the part worth seeing. Every entry in this file left something behind that is still in the world and still working: nine corrections in the true-distance table that price freight in two provinces, an art circulating as a recovered fragment of nobody in particular, a course of cutting whose readable third produced a technique somebody now teaches, three lines on a register wall under a ruled line that every visitor has explained to them wrongly. Something in the world that is correct in a way nobody living can account for is exactly what an apex writes a line about, and the line it writes is a guess at who.',
    mostOfItIsDeadPeopleAndTheEntriesAreUneven:
        'Because a mark is usually left by somebody long gone, so the register is mainly a list of the dead written up as maybe, at wildly different qualities of evidence. Several of the seven above are on it and not one of them under the name this file gives: some appear under a name an archivist guessed at from a hand or a province, and at least one appears as something that was never a name in the first place - the list carries a Girdle-lineage story it has classified as never having been a person, and the Girdle had one of these standing on its perimeter for twenty-three centuries. Nobody has ever put those two facts beside each other, and this file does not do it for them.',
    everyLineHasTheSameShape:
        'Was this person at the top of Tribulation Transcendence. Did they attempt the crossing. Did they die at it, which is what happens, or did they come back. Three questions in that order, and no line on the register has ever got past the first with anything better than a rumour. The uniformity is not laziness. Those are the only three questions the evidence can be made to bear, so every entry is the same entry with a different guess at the front of it.',
    itCannotTellADeathFromADeparture:
        'Which is the fault under the whole register and is not fixable by anybody. A crossing that killed somebody and a crossing somebody walked away from produce the same absence below the Lid, and `DEPARTURE.nobodyBelowCanTellTheDifference` is that problem stated from the other end. So the likeliest reading of any line is that the person died at it, the likeliest reading is correct most of the time, and being correct most of the time is exactly what makes the register useless: it cannot tell which line is the exception, and the exception is the only thing it was ever for.',
    itIsMaintainedAndNeverUsed:
        'Nobody has ever acted on it. No approach has been made to anybody on it, no line has been struck, no line has been confirmed, and no institution has assigned anybody to work it - and none of that is negligence. There is no procedure for confirming a False Immortal short of asking a party who will not answer, an unconfirmed one is not a thing any institution moves on, and being wrong in either direction costs more than the answer is worth. So it is carried forward, added to occasionally, and read by nobody in particular.',
    andOneLineOnItIsAlive:
        'Exactly one, and what makes it unusual is not that it is likelier. It is that it has a name attached, which most lines do not. Every line on the admissions list goes blank after the date, because that is what the document is - the Court takes somebody in and the record ends there - and his goes blank in the ordinary way rather than in a pointed one. What sits against his name and not against most of the others is one word, written by whoever noticed that a man admitted at that bar six centuries ago has not since been seen doing any of the things somebody of that standing does where people can watch. That is reasoning rather than a hunch, and it still gets nobody past the first of the three questions. See `whoKnowsWhat.apexBlindSpot` in `wanderers.ts` for the list as the institutions actually hold it. Nothing in this file distinguishes that line from the others and nothing anywhere should.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// IDENTIFYING A SEAT
// The one crack in the Court's opacity, and it lives here rather than in the
// sect data because it is the knowledge model the present-day material above
// rests on. The information exists outside those mountains. It is held by the
// category of person who has no price, which is a different and better
// problem than an unknowable one.
// ─────────────────────────────────────────────────────────────────────────

export const IDENTIFYING_A_SEAT = {
    admissionIsNotUniform:
        'Some enter well above the bar. The floor is Void Refinement and somebody arriving several rungs over it arrives already formidable, which is a different event from somebody scraping in, and the difference is visible for the same reason the admission is. So the list has shape to it - dates, and a rough sense of how strong each of them was on the way up - and three institutions read that shape perfectly well and can do nothing with it, because it stops at exactly the point the mountain starts.',
    nobodyWorksOutASeatFromRecords:
        'And nobody ever has, because there are none to work from. No rank, seat, promotion or death has ever been published, so there is no document anywhere an analyst could be clever with. Every identification that has happened happened the other way round: somebody who knew a person closely recognised them. The way they ask a second question. What they find funny. The specific quality of not being in a hurry. Names and faces and ranks are precisely what the Court withholds, and none of them is what recognition runs on.',
    andOnlyIfTheSeatShowedThem:
        'No amount of closeness gets there on its own. Presence up there is measured in decades of absence and a Seat is not standing in a market being looked at, so nothing has ever been worked out at a distance. Every instance of this is a choice somebody made once, probably long ago and probably to exactly one person. The opacity is intact. Somebody was told.',
    theConfidenceIsGraded:
        'And the gradation is most of the content. A few are certain, having been told plainly with nothing ambiguous in it. More sit at about four in five and have sat there for forty years, off one visit, one sentence, or one thing nobody else in the room would have noticed - and they will never get the last fifth, because the only party who could supply it has not come down in decades. Somebody fairly sure their brother is on one of those mountains, and fairly sure of it for most of a lifetime, is a better figure than somebody who knows, and this file takes that version wherever it has the choice.',
    familyDoesNotSell:
        'Which is the sharpest fact in the whole knowledge model. The people positioned to know are close family - a sister, a brother, somebody who was there before any of it happened - and not one of them trades it. Not to an apex, not to a house that would pay in things they could not get in a lifetime otherwise, and not to somebody who has been kind to them for ten years to precisely that end. It is not naivety and it is emphatically not virtue. It is the relationship, and a relationship does not have a price on it because it was never that sort of object.',
    butSellingAndTalkingAreNotTheSameThing:
        'And that difference is the whole of it. Nobody sells. Some talk. Family is a category rather than one careful person, so across enough of them somebody mentions a brother at a wedding, somebody is proud of a relative in front of the wrong guest, somebody old tells a story that only makes sense one way. None of that is a betrayal and none of it is foolishness: a person who mentions their brother without knowing what their brother is has done nothing wrong, and an entry recording what they said is not recording a mistake.',
    whichIsTheActualProblemTheApexesHave:
        'So the difficulty was never that the answer does not exist. It exists, it is held by a small number of ordinary people who are not hiding it, and it cannot be reached by any instrument an institution built on registers and leverage has. Three apexes maintain a list they cannot close while the thing that would close it sits in somebody\'s house, not being sold. Nobody at any of the three has ever framed it that way, and framing it that way would not help them.',
    theOpacityHasFailedBefore: {
        itIsInTheRecord:
            'Seats have been identified. It is in the historical record, it happened more than once, and everybody involved has been dead long enough that the identification changed nothing still live. So the wall is not perfect and never was: it is a wall that has demonstrably been got over, and the getting over was always an accident.',
        theMechanismWasAlwaysInadvertent:
            'Never investigation, never analysis and never a purchase. Two routes, and both of them are accidents. An art at the top grades has effectively one origin - it moves by being shown, so holding it means having stood in a room with the person who had it - so somebody who used a signature art where it could be seen identified themselves, and the world worked backwards from the technique to the man. Or somebody\'s family said more than they knew they were saying. Both are arithmetic performed on a slip rather than cleverness performed on a secret. Nobody was outwitted and nobody was bought. Somebody acted in front of the wrong person, or spoke in front of one.',
        whyItIsRareRatherThanCommon:
            'And the reason is absence rather than security, which is the less obvious answer and the correct one. The Court is four people working continuously on the crossing, and presence there is measured in decades of absence because that is what the work looks like. A Seat is not out in the world being careful about which arts get used in front of whom. A Seat is in seclusion, for decades at a stretch, and the question of being seen does not arise. Nothing needs guarding that nobody is in any position to observe, so the wall is made of the work rather than of anything anybody does about witnesses. Every historical instance is an afternoon on which that stopped being true.',
        theBackstopWhenItDoesHappen:
            'They do also know that a signature art identifies its user, and somebody who has seen one and understood what they were looking at does not walk away holding it. That is the arithmetic a house four thousand years into one problem performs on a witness, and it arrives at the only answer that protects the work. There is no cruelty in it and no relish anywhere near it, and it is the backstop rather than the mechanism: it applies on the rare afternoon somebody had to act, and on no other afternoon at all.',
        andTheRecordDoesNotSayWhichCause:
            'Which is where the tidy framing has to be resisted, because an identification has two possible causes and the volumes do not distinguish them. Either a Seat acted where they could be seen and the art gave them away, in which case the house was forced into the open - a thing that came at the mountains, a debt nobody else could be sent for, something one of them judged worth interrupting the work for. Or somebody\'s relative talked and no Seat did anything whatever, in which case the house was never out and simply stopped being a secret. From four centuries away those two look identical. Some entries are one and some are the other, and nothing establishes which for any of them.',
        theFamilyChannelIsPolicyRatherThanAHole:
            'And this is where the obvious reading is wrong. The Court knows families leak. It has known for four thousand years, it is not a gap in anybody\'s thinking, and there is a settled position on it: clean up your own mess. A Seat\'s family is a Seat\'s business. The house does not go near them, does not audit them, does not ask who a Seat has told, and does not send anybody. If your sister talks, that is yours to deal with by whatever means you judge right, and the range of right means available to somebody at that realm is wide and includes doing nothing.',
        whyThatIsAPositionAndNotLaxity:
            'Three things hold it up. It is an adult institution - four people who have each spent centuries on the same problem do not police one another\'s relatives - and it could not do otherwise anyway, because a Seat told to hand over a sister leaves that afternoon and a house of four cannot afford to lose one. The third is the most practical of the three and is why the other two are cheap to hold: there is very little there to manage in the first place. Most Seats arrive with nobody left to tell, because the climb to the floor outlives the people who would have cared, so what the policy declines to police is a rare circumstance affecting one member or two rather than a standing exposure across the house. See `andMostOfThemHaveNobodyLeftToTell`. Standing an apparatus up against that would be absurd on the arithmetic before it was anything else, and nobody there has done the arithmetic in any case: they know what the climb costs because they made it. Somebody who has spent four hundred years reaching Void Refinement and centuries more on the crossing does not need to be told how to handle their own brother. And it is the reason a Seat may reveal themselves to family at all. The permission and the responsibility are one object: you are allowed to tell somebody, and what follows from having told them is yours.',
        butMostOfThemNeverTell:
            'Which makes the size of the channel much smaller than the permission suggests, because most of them never use it. Many say nothing whatever: they go up the mountain and that is the last of it, no explanation offered and no goodbye that reads as one afterwards, and whatever the family concluded they concluded on their own with nothing to go on. So the commonest thing a Seat\'s relatives have is an absence they have made their own sense of, and the sense they made is almost never close.',
        andManyGiveTheHalfTruth:
            'Many more give a version, and the version is that they are still out there - which is true. They are alive, they are cultivating, and they are somewhere. What it leaves out is the house, the seat, the work and the crossing, and leaving those out does not make the rest of it false. That is why it holds for centuries with nobody maintaining anything: there is no story to keep straight and nothing that can be caught, because the only thing wrong with it is the size of the omission. It is the answer of somebody who will not lie to their mother and cannot tell her, and it leaves a family waiting for a return that is not coming.',
        soTheWholeTruthIsRare:
            'And only very few say all of it. That small number, across four thousand years, is the entire origin of every family leak in the record - so the channel is not families talking, it is a handful of people having told somebody everything and some of those somebodies having talked afterwards. Everything the outside world has ever accidentally learned about the inside of that house came through a door that has been opened, in total, a countable number of times.',
        andMostOfThemHaveNobodyLeftToTell:
            'And underneath that distribution sits a group the distribution does not describe, because it has nothing to distribute. The floor is Void Refinement. Reaching it takes three or four hundred years from a standing start for very nearly everybody who manages it at all, and the parents, the brothers and sisters and the people from the same village are on ordinary spans of about a hundred. So the arithmetic has already happened long before the question of telling anybody comes up: on the afternoon somebody is taken in at the bar, most of the people they might have told have been dead two hundred years and more, and there was never a moment at which that was a choice anybody made. It is what the climb costs, it is charged to everybody who makes it, and it is charged in full before the mountain has heard the name. A large share of everybody ever seated has had nobody to tell. That is a third reason the channel is small, it is the least avoidable of the three, and it should be written as the structural fact it is rather than as a sadness - somebody who spends four hundred years getting to that floor has outlived the people who would have cared, and outliving them is what going that far up consists of.',
        whichIsAlsoWhyTheSisterIsRarerThanSheLooks:
            'Which makes the intimate in `familyDoesNotSell` a rarer figure than she reads as, and the rarity is arithmetic rather than sentiment. Somebody still alive to be a Seat\'s sister four centuries on is not a woman in a village. She went up a road of her own and got a fair way along it - Core Formation at the least, which is a full realm past the rung where a span stops being a mortal question, and is the rung at which sects stop recruiting you and start negotiating with you. So the relatives who actually hold one of these things are, disproportionately, cultivators of some standing who made their own climb beside somebody who made a longer one, and there are very few of them alive at any one time. Both facts hold together and neither softens the other: she would not sell it, and there is almost nobody like her.',
        andTheRemedyIsContainmentRatherThanTheOtherThing:
            'When it does become somebody\'s mess, cleaning it up has a shape, and the example worth stating is not the violent one. The relatives are taken up to the mountains and kept there, under house arrest, for the rest of their lives. They are fed, they are housed, they are sitting on the richest vein anybody has ever surveyed, and they do not leave again. Set against what is otherwise available to a person at that realm this is the merciful answer, and it is worth being plain that it is the merciful answer, because that is the part that does not sit well. The Seat goes and collects their own brother. The house does not send anybody and its whole involvement is not objecting to four more people on the mountain. What follows is the rest of an ordinary mortal span spent among people working on a problem they cannot follow, because somebody who loved them told them something. It is one answer among several, chosen by individuals and not by the house, and it is why the Court can afford to permit telling anybody at all: the remedy exists, it works, it costs the Seat something real, and nobody has to die for it.',
        butTheMessHasAPrice:
            'It is not free, and the price is charged inside the house and nowhere else. A Seat whose mess gets large enough wears it themselves: standing with the other three first, in the ordinary way a member who has cost the house stops being a member in good standing, and at the far end the seat itself. Nothing in it is ever aimed at the family and no outsider is enforced against by anybody at any point. The sanction is internal, proportionate, and the shape any house\'s is - a house has ways of saying you have cost it something that stop a long way short of putting you out.',
        soTheAsymmetryIsDeliberate:
            'Which restates the two channels correctly. An art seen is an immediate operational problem with a witness standing in it, and it gets an immediate answer. A family talking is a known and tolerated cost of letting people have families, handled by the person whose family it is. That is a house that worked out the least bad arrangement a long time ago and has not revisited it, and it is more unsettling than an oversight would have been: they could reach a sister, and have decided not to, every time, for four thousand years.',
        soTheListIsRationalRatherThanSad:
            'Which is the correction to any reading of the register as a pitiable object. The three institutions keep it because the method has paid off before and the precedent is in their own volumes. That is not sentiment and not habit: it is patience about a category that has demonstrably resolved, maintained on the only evidence that has ever resolved it. Patient with evidence is a different posture from hopeful, and it is the accurate one.',
        butNotForSeveralHundredYears:
            'And the recent silence is itself an entry. There has been no such incident in centuries - the last confirmation in any of the three volumes is old enough that nobody now working has seen one happen - and an institution keeping a list notices that immediately, and has. What it means is not established. The Court may have got stricter. The four now seated may simply have had no occasion. The people who could still recognise an art at that grade may all be dead. Nobody has picked between those three and this file does not pick either. The second of them is `whyItIsRareRatherThanCommon` read from the other end - nothing has forced any of them out of the work in several hundred years - which is the neatest of the three and is still one of three.',
        thePairingRatherThanTheSeparation:
            'So the historical routes and the present one are not two subjects. Both historical routes are accidents, both left records, and both have stopped. What is live instead is intimates who could say and do not, which produces nothing at all - not because that channel is sealed but because the people holding it have no reason to open it. Put together, the wall has never been solid. It leaks at exactly one place, which is the people who love somebody, and it always has. One route was answered and has gone quiet. The other was never going to be closed and was never meant to be, which is `theFamilyChannelIsPolicyRatherThanAHole` and is a decision rather than a hole.',
        andTheQuietIsARunOfLuck:
            'Which makes the present silence something other than a defence. The four now seated have discreet families, or families who are gone, or families that have simply not yet been in the wrong room, and which of those it is the Court does not ask - by the same policy, so nobody there holds the answer and nobody there wants it. Several hundred quiet years is a run rather than a wall, and a run is the sort of thing that ends without notice on an ordinary afternoon. That is understood on those mountains and has been accounted for. It is not a thing anybody there is anxious about.'
    },
    whatItIsForInPlay:
        'Not a lead, and it must never be written as one. There is no right person to find and pay: the ones who know cannot be bought, cannot be leveraged, and mostly do not think of themselves as holding anything. If it produces play at all, the play is years of being trusted and very probably still not being told, and a run that ends with somebody courteously declining to say is the correct outcome rather than a failed one.'
} as const;

/**
 * The entries whose marks are still readable or still in use, which is what
 * an institution could actually notice and write a line about.
 *
 * Derived rather than listed, so it stays true as the catalog changes. A
 * carving nobody can read and a carving nobody has ever seen generate nothing,
 * which is why the register is shorter than the catalog and why most of what
 * has been across leaves no line at all.
 */
export function marksThatGenerateCandidateLines(): FalseImmortalRecord[] {
    return FALSE_IMMORTALS.filter(f =>
        f.carving !== null &&
        (f.carving.yieldedTechniqueIds.length > 0 ||
            f.carving.legible === 'fully' ||
            f.carving.legible === 'partly')
    );
}

// ─────────────────────────────────────────────────────────────────────────
// THE PRESENT COUNT
// Zero serving protectors, one open question, and the open question stays
// open. Do not resolve it here or anywhere else.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The design ceiling on how many False Immortals may be resident in the world
 * at once. Not a hard cap on the population - it is the statement that
 * residence is the scarce thing, and that a world holding four of them has
 * stopped being this world.
 */
export const MAX_RESIDENT_FALSE_IMMORTALS = 3;

export const THE_PRESENT_COUNT = {
    servingProtectors:
        'Zero, in the sense this file counts. No sect, house, court or apex in the world has a False Immortal standing on it and none has had one for eight hundred years. Plenty of ordinary houses have a dao protector in post today and every one of those is a strong elder doing a job, which is the same phrase doing different work - see `THE_OFFICE.theWordDoesTwoJobs`. What is empty is the reserved post at the houses that will not fill it with anybody else, and that post is open rather than abolished.',
    residentFalseImmortals:
        'One that anybody can point to: Lu Sheng, who crossed six hundred and forty years ago, walks the two provinces, and is in `wanderers.ts` in full. The Deep Survey and the Long Cut have both independently established that a False Immortal is wandering and neither can establish whether the sightings are one existence or four in sequence, which is what real institutional knowledge looks like at this distance.',
    theOneEligiblePerson: {
        theSituation:
            'He is the only person alive who could fill a reserved post, he came up through the one house whose chair he would be filling, and he does not hold it. That is not an oversight, it is not a question nobody thought of, and it is not a judgement anybody made about him.',
        heIsEligible:
            'Fully, and nothing about him has ever been in doubt on that score. Nobody has assessed him unfit, he has failed no test, and he would very probably be a fine protector in every way that mattered, on the occasions he turned up. There is no story here in which the Court found him wanting.',
        heDoesNotCareForTitles:
            'That is the whole of it. The office as an office means nothing to him, so the question of holding it has never become interesting enough to answer. He is not avoiding the post and he is not weighing it; he is uninterested in the difference between doing a thing and being called the thing that does it. For a man with eleven thousand years and no rank left to gain, a title is the one currency that has stopped meaning anything, and it stopped meaning anything on the afternoon the Lid shut against his name.',
        whichMakesTheVacancyHisWithoutARefusal:
            'So the chair at the one house in the world with a candidate stands empty because the candidate cannot be got to care, which is funnier and sadder than a decline and needs no scene to have happened. Nobody was turned down. The subject simply never became a subject.',
        theUnrestraintIsTextureRatherThanTheReason:
            'He does have no fixed face, does change when it suits him for reasons that are barely reasons, does go back on no schedule and does take students by whim - and all of that is true and none of it is why. It is the texture of a man who has stopped finding titles interesting, not a disqualification anybody applied.',
        whetherItWasEverOffered:
            'Nothing formal, ever. No summons, no proposal, no instrument, no entry on any roll and nothing in anybody\'s hand - the Court has never put the post to him in a form that would have to be answered, and whether it ever intended to is unknown and this entry establishes none of it.',
        theInformalOffer: {
            whatWasSaid:
                'One Seat, in person and alone with him, told him the chair was there, that it had been kept, and that the Court would be glad of him in it, in the course of an afternoon that was about several other things. Which of the four it was is not established here, and it is the one detail that would change how all of the rest of it reads. Nothing was proposed, nothing was asked for, and nobody afterwards described it as an offer. See `THE_OFFER.howItWouldCome`: that is the shape a good one takes, and it is the reason there is nothing to point at.',
            whatHeSaidBack:
                'That he is too unrestrained for that sort of thing. Said lightly, in the tone of a man conceding a small and well-known fault, and then he asked about something else. He did not accept, did not decline, and did not treat it as a question that had been put to him. Whether that was his reason or the nearest true thing to hand is not established here and is not going to be. It is entirely true of him, it is not what this entry gives as the reason he holds no post, and a man reaching for something true about himself is under no obligation to reach for the load-bearing one. Which leaves it where it was: a plausible answer, delivered at no cost to anybody, that is also exactly what somebody says who would rather not have the conversation.',
            whetherHeHeardItAsAnOffer:
                'Open, and it is not a trick. A sentence with no ask in it can be missed by anybody, and a man who finds the whole category uninteresting has no reason to be listening for one. He may have heard a chair being offered and turned it aside. He may have heard a Seat being fond of him and answered in kind. Nothing he has said since distinguishes those, and nobody has been in a position to ask him which it was.',
            onlyOneOfThemWasThere:
                'Which is the whole of why anything about it is unsettled. The other three have that Seat\'s account of what was said, given accurately, by somebody with no reason to think they were carrying anything anywhere - and an account of a man deflecting is not the deflection. A sentence about his own unreliability, repeated without the afternoon it was an answer to, does not stay the same shape. The entire distance it has travelled is from one room to another inside the same house.',
            nobodyHasRaisedItSince:
                'Not the Court, and not him. Nobody has put it to him again, because putting it to him is pressing and the Court does not press, and because the four who would need the answer are the four who cannot ask for it - the same bind `theDefenceQuestionStaysOpen` sets out, on a smaller question and exactly as binding. Whether the silence since is tact, an answer taken and not argued with, or the Court doing with this what it does with everything is not going to be settled by four people who do not discuss anything. He has not raised it either, and for him that is not restraint: it is a subject that did not stay in his head.',
            andThisIsTheOnlyHouseWhereNoneOfItGetsOut:
                'Worth stating once and not developing. Every other reserved chair in the world is at least publicly empty - announced at a ceremony, carried on a ledger line, certifiable on a roll by the Ninefold Ledger. This one is held by a house that answers to nobody and has never mentioned him where a third party could hear. Three apex institutions hold his name, his house and the word possible, and that is the whole outer extent of it: not one of them knows there is a chair, let alone that somebody sat beside him and said so. The chair, the afternoon and the answer have never been anywhere but inside the same five heads.'
        },
        theRumour:
            'There is a rumour that he declined, or that he would not take it officially, and its entire population is three. It is not in the world and could not get there: what it presupposes is that the Court has a chair for him at all, and five people alive know that. What the three hold is an offhand remark at second hand, from the one of them who was in the room, and they do not agree about it. One reads a refusal. One reads a man changing the subject, which he does constantly and about everything. One holds that no question was ever actually put and there is therefore nothing in it to interpret. So it might be true. It might be a misheard joke. It might have been about something else entirely, and he does not remember making it. Nothing in this catalog says which.',
        nobodyCanCheck:
            'And nobody can, the three holding it included. The Hollow Court does not announce, deny, correct or brief, and it does not do any of those things inwardly either: there is no procedure by which three Seats settle a disagreement about what a fourth heard, and none of them has ever proposed one. Note the shape it leaves - a rumour that he declined implies an offer that was made and answered, in a situation where whether either of those happened is the thing in dispute. That is not an inconsistency to be tidied. It is the Court\'s opacity turned on the Court, which is the one place nothing has ever shown it operating, and it should stay visible.',
        andNowhereElseIsACandidate:
            'It would be the Hollow Court or nothing, and this is not loyalty and should never be written as gratitude. It is where he is from, it is where the four people who know what he is are, and everywhere else in the world is a room he would be the strangest thing in. Another house could offer on any terms it liked and it would not be a decision he had to make; it would be a conversation he was having with somebody in an inn.',
        threeReasonsAndAllOfThemTrue:
            'So the reason he does not hold the post is overdetermined, which is the correct state for it. He does not care for titles. The rule that orders seats cannot order him, because a seat is a position in a queue for the crossing and he has no attempts left. And he no longer belongs to them in the way holding their office would require. Nobody refused anybody. It is simply not a thing that could happen.',
        heUsedToBeOfThem:
            'He held First Seat. At Tribulation Transcendence Perfection there was nobody above him and he made the crossing from the top of the Court rather than from the edge of it, and what came back could not hold a seat at all. He used to be of them and he is not, and he has made his peace with that without ever having had a conversation about it with anybody, including himself as far as anybody can tell. He likes them. He goes back. He gives them dao. He is not one of them and will not be again, and he does not appear to mind.',
        theRegister:
            'Fondness without belonging, and it is easy to overplay in both directions. He is not devoted and he is not bitter. The accurate note is affectionate and entirely resigned, in a shrugging way rather than a grieving one - the same unhurried, faintly amused acceptance that lets him sit through the Third Seat on obligation to keep three other people from losing face. He does not perform any of this, has probably never said it out loud, and would change the subject. Whether the peace is genuine or is the most complete thing he has ever built is not resolved here and costs nothing to leave open.',
        andHeDoesTheOtherHalfAnyway:
            'The office has two functions and only one of them needs a promise. He goes back to the Hollow Court - not often, on no schedule, under no obligation - and what he does there is give dao lectures, which is the substantive half of what a protector was ever for, being performed right now, by the only False Immortal in the world, for the four beings best placed to use it. He wants no name for it and there is no name attached to it, which is the arrangement working exactly as a man indifferent to titles would arrange it if he had arranged anything.',
        theThirdSeat:
            'And on every one of those visits the Third Seat delivers a dao sermon on obligation, at length, to a man permanently barred from the only obligation that would have mattered. He finds it insufferable and does not hide it well. He sits through it anyway, for the other three rather than for her. Both things are true on the same afternoon and neither party has ever remarked on it.'
    },
    theDefenceQuestionStaysOpen: {
        whatIsTrue:
            'He is on the Hollow Court\'s roll as Guest of the Court, entered without discussion, and has never asked to be taken off it. There is no obligation attached in either direction and neither party has ever proposed one, including the obvious one. If the mountains were attacked tomorrow nothing whatsoever compels him to come.',
        whatIsNotKnown:
            'Whether he would. That is not withheld from the reader and it is not withheld by him: it has never been asked, it has never been decided, and it is unknown to him as much as to anybody. A man who had privately made up his mind either way would be a different man from the one in the catalog.',
        itIsTheSameTraitProducingASecondUnknown:
            'Being unsuited to a standing post and being unpredictable in a crisis are one property of one person read two different ways, and the two questions do not settle each other. He is definitely the wrong man to appoint. What he would do on a bad morning is a separate matter and nobody has the answer, him included.',
        whyNobodyAsks:
            'Because the four people who would need the answer are the four who cannot ask for it. Asking converts a tie into a proposal, a proposal has to be accepted or declined, and either outcome is worse for the Court than the present state - in which it may have the single most consequential asset in the world and has never verified it, counted it, or mentioned it to anybody.',
        doNotResolveIt:
            'This is the sharpest expression of what the Hollow Court is: opaque by construction, holding something it cannot count on. It stays a maybe in the data as well as in the prose. No field anywhere records whether he would come, no faction record points at him as a protector, and no tool may report the Court as having one.',
        andItIsNotADeterrent:
            'It deters nobody, because deterrence requires somebody to have been told. Four Seats and him know he is on the roll. The Court has never mentioned him in any setting where a third party was present and has never tried to trade on it, so outside the mountains it is not even a question anybody could be wrong about.'
    },
    whatLuShengIsActuallyDoing:
        'Path three, and neither he nor any text about him has ever called it that. He built his arts himself over six centuries out of what came back rather than out of anything he was taught, there is no manual because he never had a reason to write one for a reader who does not exist, and effectively the only way any of it gets out is through a student. That is transmission, it is the narrowest supply in the world, and the lectures at the Court are the same activity aimed at the only audience in existence that can follow all of it. The three faces in `LU_SHENG_CARVINGS` are what the lecturing leaves behind rather than a second channel he opened on purpose - a reader who finds one is getting the surface an afternoon was worked out on, without the afternoon.',
    whyHeHasNotCarved:
        'Because he still has students, and carving in the sense this file means is what path three does when there is nobody left to hand it to. He is six hundred and forty years into eleven thousand, in the first stage, with people in front of him who can be shown things - so the durable form has not become necessary yet and there is no reason it would have. Whether he ever will is a live question with a long fuse, and if he does it will be somewhere nobody was looking, in his own hand, and it will be the single most valuable object in the world.',
    andTheFacesAreNotThat:
        'Which has to be said in the same breath, because there is stone with his cutting on it in three places and it is a different act. A lecture needs a surface, he works on whatever is there, and he does not take it away with him afterwards - so what is left is an afternoon\'s working, cut where the afternoon happened, in the ordinary hand of the province, for people who were in the room and had it shown to them first. See `LU_SHENG_CARVINGS`. Nobody cut those for posterity and none of them is a dao laid out in order; they are the residue of transmission rather than a substitute for it, and the difference is the whole of why he can leave one lying about on a river stone and not think about it again.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE LIVING ONE'S FACES
// The only carvings in this file by somebody who is still walking around,
// and the only route by which anything at ordinal 45 reaches a reader who
// was not in the room. Same type, same field, same route as the seven
// above: a face somebody cut. See `allDaoCarvings`.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What he has to lose, which is the fact these faces are actually about.
 *
 * Stated here rather than in `wanderers.ts` because it is a claim about the
 * top of the world and it is checked against the resolver rather than argued.
 * No arithmetic lives in this block and none may: it reports what the harness
 * returned and points at the rows that produced it.
 */
export const THE_ARTS_ARE_THE_WHOLE_INVENTORY = {
    heHoldsNothing:
        'No object at all, of any rung. Not a diminished one, not a borrowed one, and not one of the Hollow Court\'s - he was of them once and is not now, so nothing of theirs is his to carry, and there is nobody else in the world who would hand him anything. Every other figure at the top of this setting is a person plus something they were given. He is the one who is only the person.',
    soTheArtsAreTheAccount:
        'Which is why the three entries at ordinal forty-five in the technique catalog carry more than a strong man\'s arts usually would. They are not the flourish on top of an object doing the real work; they are the whole of why he is dangerous, and taking them away leaves a man at a rung and nothing else. Read `WHAT_AN_ART_BUYS` beside this: an art is worth most of a rung inside a realm and nothing at all across the Lid, and he is the one case in the world where somebody is standing on the art alone.',
    andItIsMeasuredRatherThanClaimed:
        'Against the three mobilised apexes, run through the ordinary resolver with nothing special-cased anywhere: he takes the Deep Survey every time, the Azure Cloud Pavilion about seven times in eight, and the Long Cut four times in five. Nothing in that ordering tracks the head\'s rung. It tracks the object each house is holding - a forty-three lamp, a forty-five edge under a head at forty-one, and a forty-five nail - which is exactly what the catalog says force is made of.',
    andTheOneInFiveIsThePoint:
        'So the strongest person below the Lid can be fought to a standstill one time in five by an apex head three rungs beneath him, and the whole of the difference is that somebody sent them a nail and nobody has ever sent him anything. That is not a flaw in the arithmetic to be corrected by giving him something. It is the arithmetic saying what the setting says: objects cross where arts do not, `OBJECT_CEILING_BELOW_THE_LID` is forty-five and he is at forty-five with empty hands.',
    doNotFixIt:
        'No entry anywhere may give him an object, at any rung, for any reason, and none may quietly compensate him with a rule instead. The asymmetry is the character. If a run puts something in his hands it should be a thing that happened in the run, with an owner column that changed, and the whole world should be different afterwards.'
} as const;

/**
 * Three faces, three arts, and the reason a reader gets less off them than a
 * student got in the room.
 *
 * The route is the ordinary one - `yieldedTechniqueIds`, the same field the
 * seven historical entries use - and nothing about these being cut by somebody
 * still alive changes how they are read, held or found. What it changes is the
 * one thing worth noticing: for the first time in the record, the author could
 * simply have been asked. See `ABOVE_THE_LID_TRANSMISSION.andTheFacesHeLeavesBehind`
 * in `techniques.ts` for why that costs the reader rather than saving them.
 */
export const LU_SHENG_CARVINGS: readonly DaoCarving[] = [
    {
        id: 'carving-the-lecture-face-at-the-court',
        where: 'The floor of the north hall on the Hollow Court\'s own mountain, in the space the four of them sit in when he comes back, cut in courses over the last two hundred years of visits.',
        whatItIs:
            'The working of a dao lecture, left where the lecture happened. It accumulates rather than composes: he arrives, they talk, something gets cut, and he goes, and there are perhaps forty separate afternoons on that floor with nothing joining them up. It is the only body of his cutting that anybody in the world has watched being made.',
        script: 'ordinary',
        legible: 'fully',
        heldByFactionId: 'sect-hollow-court',
        holderKnows: true,
        builtOnIt:
            'Four thousand years of work on one problem, and this is the first outside contribution any of it has had. The Court knows exactly what it is standing on, which is the one place in this file where a holder does, and it changes nothing about what they can do with it: the art on that floor asks for a rung above the one all four of them stand at, and the Seats read it the way anybody reads a thing written for somebody else. They have never mentioned the floor to an outsider and have never needed a policy about it. Nobody outside those mountains knows there is cutting in that hall.',
        yieldedTechniqueIds: ['what-came-back-instead']
    },
    {
        id: 'carving-the-register-wall-second-course',
        where: 'The second course of the register wall at the House of Held Names, three feet along from a struck entry that the house explains to every visitor and explains wrongly.',
        whatItIs:
            'Nine lines in the ordinary hand, cut in an afternoon by a visitor the Keepers remember as courteous and cannot otherwise describe, on a wall the house cuts its whole product into. It is a working rather than a record: it says how a thing is done and does not say who did it, which is the opposite of every other line on that wall.',
        script: 'ordinary',
        legible: 'fully',
        heldByFactionId: 'house-held-names',
        holderKnows: false,
        builtOnIt:
            'Nothing, and it is the second time this house has had the answer in the building and not kept it. The counter-register exists to establish what a crossing takes and what of a person survives it; nine lines by somebody who came back from one are on its own wall, three feet from the name it struck for leaving an ordinary corpse, and the Keepers file the lines under wall condition because no Keeper was in the room and nobody signs a wall they are not entered on. Every visitor is walked past both. The house has been asked twice what the nine lines are and has said, accurately, that it does not know.',
        yieldedTechniqueIds: ['the-second-question']
    },
    {
        id: 'carving-the-ford-stone',
        where: 'The upstream face of the mooring stone at the Fourth Ford, at about knee height, where a boat used to be tied and a tea stall now stands about nine paces off.',
        whatItIs:
            'A short course of cutting made in one afternoon the spring after a boatman who was not a cultivator died, by somebody who had come back to argue with him about the same three subjects and found the boat gone. It is the hardest thing he has ever put on a surface and there is no indication anywhere on the stone of what it is or who cut it.',
        script: 'ordinary',
        legible: 'partly',
        heldByFactionId: null,
        holderKnows: false,
        builtOnIt:
            'Nothing whatever, by anybody, in thirty years. Nobody holds a ford. The stall keeper is the dead boatman\'s granddaughter, she has swept past it four times a day for twelve years, and the one person who has ever stood in front of it and known what it was is the man who cut it and has not mentioned it since. It is legible in the ordinary hand up to a point and stops being legible where the reader stops being able to follow rather than where the cutting stops, which is the difference between this face and every other one in the file.',
        yieldedTechniqueIds: ['the-seam-that-did-not-close']
    }
];

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const BY_ID: ReadonlyMap<string, FalseImmortalRecord> =
    new Map(FALSE_IMMORTALS.map(f => [f.id, f]));

export function getFalseImmortal(id: string): FalseImmortalRecord | undefined {
    return BY_ID.get(id);
}

/** Everyone who held an office at a given house. Usually nobody. */
export function protectorsOf(factionId: string): FalseImmortalRecord[] {
    return FALSE_IMMORTALS.filter(f => f.office?.factionId === factionId);
}

/** Grouped by how they left. The distribution is the design. */
export function byEnd(end: FalseImmortalEnd): FalseImmortalRecord[] {
    return FALSE_IMMORTALS.filter(f => f.end === end);
}

/** Which of the three each of them was spending the years on. */
export function byPath(path: LegacyPath): FalseImmortalRecord[] {
    return FALSE_IMMORTALS.filter(f => f.path === path);
}

/**
 * Internal against external, which the record is badly skewed on. See
 * `THE_OFFICE.whyTheRecordSaysOtherwise` before drawing anything from the ratio.
 */
export function byRecruitment(recruitment: Recruitment): FalseImmortalRecord[] {
    return FALSE_IMMORTALS.filter(f => f.office?.recruitment === recruitment);
}

/**
 * Protectors currently standing on a house, which is none of them and is
 * expected to stay none of them. The function exists so that the invariant is
 * queryable rather than only asserted.
 */
export function servingProtectors(): FalseImmortalRecord[] {
    return FALSE_IMMORTALS.filter(f => f.servingNow);
}

/**
 * Every face cut by anybody who has been over the Lid, in one list.
 *
 * The carving route is defined as `DaoCarving.yieldedTechniqueIds` in this
 * file, and it always was - the route is the kind of thing, not the array it
 * happens to be reachable through. Seven of these hang off a record in
 * `FALSE_IMMORTALS` because their authors are gone and a record is the only
 * place a fact about them can live. Three do not, because their author is
 * still walking around and does not belong in a catalog of endings.
 *
 * Anything asking "what can a face hand somebody" must ask here rather than
 * walking `FALSE_IMMORTALS`, or it will quietly answer for two thirds of the
 * faces in the world. `scripts/audit-lore.ts` and the technique-routes suite
 * both read this.
 */
export function allDaoCarvings(): DaoCarving[] {
    return [
        ...FALSE_IMMORTALS.map(f => f.carving).filter((c): c is DaoCarving => c !== null),
        ...LU_SHENG_CARVINGS
    ];
}

/** Carvings anybody could actually go and stand in front of. */
export function reachableCarvings(): DaoCarving[] {
    return allDaoCarvings().filter(c => c.legible !== 'unseen');
}

/** Arts in the technique catalog that came off one of these faces. */
export function techniquesFromCarvings(): string[] {
    return allDaoCarvings().flatMap(c => c.yieldedTechniqueIds);
}

/** The stage a record was at when its account ends, where it can be assigned. */
export function stageAtEndOf(id: string): MadnessStage | undefined {
    const stageId = BY_ID.get(id)?.stageAtEndId;
    return stageId ? MADNESS_STAGES.find(s => s.id === stageId) : undefined;
}
