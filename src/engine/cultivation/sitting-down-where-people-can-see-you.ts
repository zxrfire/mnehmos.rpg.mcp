/**
 * ═══════════════════════════════════════════════════════════════════════════
 * YOU CANNOT SIT FOR TWENTY YEARS IN A SQUARE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FOUND BY PLAYING, seed `dm2-2`. A ten-year seclusion, entered in Clear Creek
 * Village with six people standing in it, ran undisturbed for 2.1 years and was
 * cut short by nothing but the food running out. Nobody so much as looked up.
 *
 * The design owner:
 *
 *   *"you typically can't cultivate for 20 years in a square"* -
 *   *"someone will tell you to go somewhere else"* -
 *   *"that's like being homeless"* - *"you'll be bugged"*
 *
 * Which is obviously right and is the reason the genre is full of caves,
 * mountains, sealed halls and rented rooms. A cultivator does not withdraw for
 * a decade because withdrawing is spiritually superior; they withdraw because a
 * decade of sitting still in front of other people is not a thing anybody is
 * allowed to do. Somewhere to sit undisturbed is a RESOURCE, and it has been
 * free in this engine.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING NEW IS SIMULATED. THE RATE WAS ALREADY THERE AND WAS ALWAYS 1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `TimeSkipContext.randomEventScale` is documented as *"scales how often those
 * rolls land, without switching them off"*, and the seclusion verb was setting
 * it in exactly one direction:
 *
 *     randomEventScale: sealed ? doorScaleOverStretch(...) : 1
 *
 * A shut door scaled interruptions DOWN. Nothing ever scaled them UP, so an
 * open sitting in a market square drew events at precisely the rate of an open
 * sitting on an empty mountainside. The disturbance machinery, the encounter
 * rolls and the crossroads fork - somebody is close, do you stay or go - were
 * all built and all firing at the wilderness rate wherever the player sat.
 *
 * So this is one number, and it is read off something the square already knows.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * READ OFF WHO IS STANDING THERE, WHICH IS THE THING THAT ACTUALLY BOTHERS YOU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Not a `privacy` column on a location, which would be a second opinion about
 * somewhere the roster already describes, and would need authoring for every
 * place in the world and every place added later. AGENTS.md: derive rather than
 * store.
 *
 * People are what interrupt you. An empty road and an abandoned hall are the
 * same fact - nobody is there - and it is already computed for every square on
 * every turn, and it moves on its own as the world moves people around.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BUT A COURTYARD YOU ARE ON THE ROLL OF IS NOT A SQUARE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A first cut of this counted heads and stopped, and a played test caught it
 * within the hour: a disciple practising inside their own sect's compound for
 * forty years was interrupted every few months by the people they live with.
 * Their own house told them to move on, from their own courtyard.
 *
 * Which is the opposite of what a compound is FOR. The owner's comparison is
 * being homeless, and being homeless is not about being seen - it is about
 * having nowhere you are entitled to be. Being watched by people who have no
 * standing to move you on is not the same fact as being watched by your own
 * senior brothers, and the count cannot tell those apart.
 *
 * So the question is not *who can see you*. It is WHETHER YOU HAVE ANY BUSINESS
 * SITTING HERE. On ground your own house holds you do, and the crowd is
 * irrelevant. Anywhere else, every person who can see you is somebody who might
 * ask what you are doing.
 */

/**
 * What the FIRST person costs you, and it is the largest step on this scale.
 *
 * The difference between a place you can sit and a place you cannot is not how
 * crowded it is - it is whether there is anybody at all. The owner's comparison
 * is being homeless, and being homeless is not about crowds: it is about there
 * being somebody with standing to ask what you are doing there. One person who
 * walks past every day and wonders is the whole mechanism.
 */
export const THE_FIRST_PERSON_WHO_CAN_SEE_YOU = 4;

/**
 * And what everybody after them adds, which is less.
 *
 * A square that already has somebody in it is already a square you are visible
 * in. The second onlooker changes how fast word gets round; they do not change
 * whether you were seen.
 */
export const BOTHERED_PER_PERSON_AFTER = 1.6;

/**
 * The most a crowd can raise it.
 *
 * A ceiling because the alternative is unbounded, and a market with forty
 * people in it is not four times worse than one with ten - past a handful of
 * onlookers you are already as conspicuous as you are going to get, and the
 * thing that ends the sitting is the FIRST person to say something.
 */
export const AS_BOTHERED_AS_IT_GETS = 12;

/**
 * How often a sitting HERE is interrupted, as a multiplier on the wilderness
 * rate.
 *
 * 1 is nobody watching: a cave, an empty road, a mountainside. That is the rate
 * the engine has always used everywhere, and it stays exactly right for the
 * places it was always right for.
 *
 * WHAT THIS IS NOT. It is not a penalty and it does not reduce what a stretch
 * returns; a day sat in a square is worth exactly what a day sat on a mountain
 * is worth. What changes is HOW MANY of them you get before somebody stands in
 * front of you, which is the honest shape of the problem: the qi does not care
 * where you sit and the people do.
 *
 * Nor is it a refusal. Sitting down in the middle of a village is allowed, and
 * a player who wants to is entitled to find out what happens. What must not
 * happen is that nothing does.
 */
export function howOftenSittingHereIsInterrupted(
    peopleWhoCanSeeYou: number,
    /**
     * Whether this is ground the cultivator's own house holds.
     *
     * A compound full of your own people is the one place in this world you are
     * SUPPOSED to sit for decades, and it is why a house is worth joining. The
     * crowd stops counting entirely rather than counting for less: a disciple
     * in their own courtyard is not being tolerated, they are at home.
     */
    onGroundYourHouseHolds = false
): number {
    if (onGroundYourHouseHolds) return 1;
    const watching = Math.max(0, Math.floor(peopleWhoCanSeeYou));
    if (watching === 0) return 1;
    return Math.min(
        AS_BOTHERED_AS_IT_GETS,
        1 + THE_FIRST_PERSON_WHO_CAN_SEE_YOU + (watching - 1) * BOTHERED_PER_PERSON_AFTER
    );
}

/**
 * Whether this is somewhere a long sitting could actually be finished.
 *
 * The read behind *"someone will tell you to go somewhere else"* - so the
 * engine can say so before the player spends the years rather than after. What
 * it is NOT is a gate: the player may sit here anyway and the answer is what
 * happens, not a refusal.
 *
 * The threshold is one person, and deliberately: the owner's comparison is
 * being homeless, and being homeless is not about crowds. It is about there
 * being anybody at all with standing to ask what you are doing there.
 */
export function somewhereYouCouldFinishALongSitting(
    peopleWhoCanSeeYou: number,
    onGroundYourHouseHolds = false
): boolean {
    return onGroundYourHouseHolds
        || Math.max(0, Math.floor(peopleWhoCanSeeYou)) === 0;
}

/**
 * Roughly how long a sitting here runs before somebody interrupts it, in days.
 *
 * Derived from the same multiplier rather than authored beside it, so the two
 * cannot disagree - and exposed because a player deciding where to sit down for
 * a decade is entitled to the estimate a person would have. Somebody who has
 * lived in this world knows a market square is no place to sit, and the engine
 * saying so is not a hint; it is the thing everybody around them already knows.
 *
 * The base is `ENCOUNTER_CHECK_DAYS / ENCOUNTER_CHANCE` from `time-skip.ts`,
 * which is how often an encounter roll lands at scale 1. It is restated as a
 * number here rather than imported to keep this module free of the simulator,
 * and pinned against the real constants by its test.
 */
export const DAYS_BETWEEN_INTERRUPTIONS_UNWATCHED = 450;

export function aboutHowLongYouWouldGetHere(
    peopleWhoCanSeeYou: number,
    onGroundYourHouseHolds = false
): number {
    return Math.round(
        DAYS_BETWEEN_INTERRUPTIONS_UNWATCHED
        / howOftenSittingHereIsInterrupted(peopleWhoCanSeeYou, onGroundYourHouseHolds)
    );
}
