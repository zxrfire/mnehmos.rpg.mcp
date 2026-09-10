/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE ENGINE. EVERY ANSWER CARRIES HOW IT IS KNOWN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The design owner:
 *
 *   *"maybe we split the engine, one to things we can know with certainty,
 *    other to fuzzy?"* - *"then we can just route the request to either certain
 *    or fuzzy depending on what I KNOW and what the npc knows"* -
 *   *"we do duplicate paths"* - *"one for feeling one for knowing?"*
 *
 * The distinction is right and the two engines are the trap, and the owner
 * named the trap themselves. Two engines means two places that answer the same
 * question, and this repo's single most common defect - measured all through
 * this sweep - is exactly that:
 *
 *     the ration footer said 0 stones and the row held 16
 *     the pack read said "nothing at all" over a year of rations
 *     the audit CLI printed 163/546 against the test's 153/496
 *     a fallen house's boat had one owner in the record and another in fact
 *
 * Every one is two things answering one question and drifting. A second engine
 * institutionalises that.
 *
 * So: ONE engine, one answer per fact, and the answer carries a tag saying HOW
 * IT IS KNOWN. The router the owner describes then exists - it just routes on
 * the tag rather than between two codebases.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS NOT A NEW IDEA, ONLY A NEW PLACE FOR AN OLD ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `social/README.md` already sets out the four epistemic layers - *"what
 * actually happened -> what a witness saw -> what someone was told -> what
 * people believe"* - and `knowledge.ts` already stores five states rather than
 * five views of one. `discovery.ts` has a six-rung `KnowingStage` ladder.
 * `SourceKind` and `confidence` are on every knowledge row.
 *
 * ALL OF THAT IS ABOUT THINGS YOU KNOW OF: a house, a person, a place. None of
 * it is about an ANSWER. So the rule AGENTS.md states -
 *
 *   *"the engine may only state what somebody standing there could perceive"*
 *
 * - is enforced by hand at every call site, and by a test written this session
 * that catches the leaks after they ship. That test found eight in one sweep,
 * including a raw `ordinal 0` and a database key printed beside the name it
 * belonged to. A tag makes those a type question instead of a review question.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE TAG CHANGES, WHICH IS NOT ONLY WORDING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The interesting half is that some answers are not the engine's to give at
 * all. A cultivator at the first rung standing on dense ground cannot TELL it
 * is dense - they have nothing to compare it against and no art that reads it.
 * The engine currently tells them precisely, because the band is in the record
 * and nothing asks whether they could perceive it.
 *
 * `unknown` is a real answer and saying so is the whole content: *"you cannot
 * tell"* is a fact about the cultivator, and it is the sentence that makes
 * finding somebody who CAN tell worth doing.
 */

/**
 * How the engine came by an answer.
 *
 * Ordered from most to least certain, and the order is load-bearing:
 * {@link theWeakerOf} takes the lower of two, so an answer assembled from a
 * measurement and a guess is a guess.
 */
export type HowItIsKnown =
    /**
     * Your own body, purse or pack. You can just look, and you are never wrong
     * about it.
     *
     * The ONLY tag that permits an exact figure in front of a player, and even
     * then in the units a person uses - 30 spirit stones, 15 rations, 100
     * qi-units of a rung priced at 400. Never `ordinal`, never `satiety`,
     * never a multiplier.
     */
    | 'measured'
    /**
     * Your senses, at your rung, from where you are standing.
     *
     * A wall above you rather than a number. Ground that gives back less than
     * home. Somebody who reads as beyond you. Precise where the difference is
     * gross and vague where it is fine, which is what perception is.
     */
    | 'perceived'
    /**
     * Somebody said so, and who said it is part of the answer.
     *
     * May be false. That is not a defect: `social/README` is explicit that a
     * person acting on a wrong belief is reasoning correctly from a premise
     * that is written down, dated and attributed.
     */
    | 'told'
    /**
     * Worked out from things they do have, and could be wrong.
     *
     * The tag that keeps the engine honest about its own arithmetic: a
     * cultivator who knows the going rate and the distance can put a number on
     * a journey, and the number is a guess made of facts.
     */
    | 'inferred'
    /**
     * There is no way for this person to know this.
     *
     * Not an error and not silence. It is the answer, and it is the one that
     * makes going and finding out worth doing.
     */
    | 'unknown';

/** Most certain first. The index is the rank. */
export const HOW_WELL_KNOWN: readonly HowItIsKnown[] = [
    'measured', 'perceived', 'inferred', 'told', 'unknown'
] as const;

/**
 * An answer, and how the engine came by it.
 *
 * `because` is a plain factual clause and the engine's own voice is allowed in
 * it - it is what the renderer turns into a hedge, and what the play log
 * carries. It says WHY this is the kind of knowing it is, never what the answer
 * means.
 */
export interface AnAnswer<T> {
    readonly value: T;
    readonly known: HowItIsKnown;
    readonly because: string;
}

export const measured = <T>(value: T, because: string): AnAnswer<T> =>
    ({ value, known: 'measured', because });
export const perceived = <T>(value: T, because: string): AnAnswer<T> =>
    ({ value, known: 'perceived', because });
export const told = <T>(value: T, because: string): AnAnswer<T> =>
    ({ value, known: 'told', because });
export const inferred = <T>(value: T, because: string): AnAnswer<T> =>
    ({ value, known: 'inferred', because });
export const unknown = (because: string): AnAnswer<null> =>
    ({ value: null, known: 'unknown', because });

/**
 * The weaker of two ways of knowing.
 *
 * THE RULE THAT MAKES THE TAG WORTH HAVING. An answer built out of two others
 * is only as good as the worse one, and this is where a chain of derivations
 * would otherwise quietly launder a guess into a fact. A journey time computed
 * from a measured purse and a perceived distance is perceived.
 */
export function theWeakerOf(a: HowItIsKnown, b: HowItIsKnown): HowItIsKnown {
    return HOW_WELL_KNOWN.indexOf(a) >= HOW_WELL_KNOWN.indexOf(b) ? a : b;
}

/** Whether there is anything here to say at all. */
export function theyCanTell<T>(answer: AnAnswer<T | null>): answer is AnAnswer<T> {
    return answer.known !== 'unknown' && answer.value !== null;
}

/**
 * HOW A SENTENCE CARRYING THIS SHOULD BE PITCHED.
 *
 * The renderer's half, and the reason the tag is not just documentation. Each
 * of these is an instruction to whoever writes the sentence - the narrator
 * prompt, or the deterministic fallback - and it replaces the per-call-site
 * judgement that the engine-voice guard currently polices after the fact.
 *
 * Note what `measured` does NOT license: naming the engine's own columns. Being
 * certain of a number is not permission to print the field it lives in. That is
 * a separate rule and it is not weakened by this one.
 */
export const HOW_TO_PITCH_IT: Record<HowItIsKnown, string> = {
    measured:
        'State it flatly, in the units a person uses. No hedge - they are looking '
        + 'straight at it and cannot be wrong about it.',
    perceived:
        'State what they can tell and stop there. Gross differences are plain and fine '
        + 'ones are not: a wall above, ground thinner than home, somebody clearly beyond '
        + 'them. No figure they could not have arrived at by standing there.',
    told:
        'Attribute it. Who said so is part of the answer, and it may be wrong - so it is '
        + 'reported as a thing somebody said rather than as a thing that is so.',
    inferred:
        'Say it as a working figure and say what it rests on. It is made of facts and it '
        + 'is still a guess, and the player is entitled to know which.',
    unknown:
        'Say plainly that they cannot tell, and why not. This is the answer and not a '
        + 'failure to have one; it is also what makes finding somebody who CAN tell worth '
        + 'the trouble.'
};
