/**
 * Which intents a sentence is not allowed to be asked for.
 *
 * Not a threshold and not a confidence cutoff. A structural refusal to answer
 * a question the words cannot carry, declared per verb, so that a tier reading
 * meaning has somewhere to abstain to instead of returning its best guess.
 *
 * ── WHY ABSTAINING IS THE SAFE ANSWER AND A GUESS IS NOT ─────────────────
 *
 * Measured across three verbs, and the numbers are in
 * `tests/web/do-exemplars-separate-intents.test.ts`. What matters is not that
 * some intents scored badly. It is HOW they failed.
 *
 *   `sect` failed by INVERSION. `join -> recruit` on all four exemplars,
 *   `expel -> leave` on both, `siphon -> donate` and `donate -> siphon` in
 *   both directions. Each pair is one act with the arrow reversed.
 *
 *   `coerce` failed by SHARED PURPOSE. `submit`, `talk` and `hand_over`
 *   describe the same physical act - somebody hitting somebody until they
 *   comply - and differ only in what the compliance was for.
 *
 *   `move` failed by ADJACENCY, and is therefore NOT declared here.
 *   `approach -> enter` is a neighbouring act of the same kind. Walking up to
 *   a gate and walking through it really are nearly the same sentence, and
 *   getting it slightly wrong costs a player a slightly wrong read.
 *
 * The distinction is the whole of the rule. An adjacency error is a near miss.
 * An inversion error hands the player who asked to JOIN a recruitment drive,
 * and the one who asked to LEAVE somebody else's expulsion - and it does it
 * confidently, because the tier has no way to know the direction was never
 * written down.
 *
 * ── THE DANGEROUS OUTPUT IS NEVER THE REFUSAL ────────────────────────────
 *
 * This layer has now produced the same failure by three unrelated mechanisms
 * in one day, and every one of them was a WRONG ACT REPORTING SUCCESS rather
 * than anything that looked like an error:
 *
 *   A regex too broad. `force (him|her|them) (to|into)` with no tail claimed
 *   "I force him to swallow it" for `hand_over`, and once `hand_over` moved a
 *   purse that sentence robbed a man somebody meant to make take a pill.
 *
 *   A lookup table too narrow. `coerce` was absent from `TARGETED_ACTIONS`,
 *   so a target the model named correctly was deleted and the player was then
 *   blamed for naming nobody.
 *
 *   And a tier too confident, which is what this file is for.
 *
 * A refusal is legible: the player sees it and says it again. The confident
 * opposite is invisible, because the turn reports success and the prose reads
 * correctly. So where the sentence cannot carry the question, the answer is
 * silence and the situation decides - the way a submission is what makes
 * `hand_over` the obvious thing to offer, rather than any word in the
 * sentence.
 *
 * ── AND THIS STAYS NARROW. DO NOT WIDEN IT ───────────────────────────────
 *
 * There is a second failure that looks like this one and is its opposite, and
 * they must not be folded together.
 *
 *   HERE: the sentence does not contain the answer, so refuse to choose.
 *   "I skim from the treasury" does not say which direction the stones went
 *   in any word a reader could find.
 *
 *   THE OTHER: the sentence contains the answer plainly and the resolver has
 *   no category for it. "who is the strongest person here" is unambiguous to
 *   anybody who reads it; what fails is that the subject chain matches NAMES
 *   and was handed a DESCRIPTION. That is a missing category, not an
 *   unanswerable question, and it is fixed by reading the sentence better
 *   rather than by declining to read it.
 *
 * One is refusing to read more than the words carry. The other is failing to
 * read what the words plainly say. A guard admitting both stops being a claim
 * about what sentences can carry and becomes a general-purpose fallback that
 * hands out an answer - which is the shape this repo keeps having to unpick.
 *
 * What keeps the rows below safe is that each names a SPECIFIC pair or
 * cluster and says why the words cannot separate it. Nothing is admitted here
 * on the general ground that state ought to decide, because that ground would
 * admit almost anything.
 */

/** How a set of intents fails, which decides nothing here but explains it. */
export type WhyItCannotBeAsked =
    /** One act with the direction reversed. The confident opposite. */
    | 'inversion'
    /** One act, several goals, and the goal is usually not written down. */
    | 'shared_purpose';

export interface AQuestionTheSentenceCannotCarry {
    /** The verb these intents belong to. */
    readonly verb: string;
    /** Two or more intents no reading of the words may choose between. */
    readonly intents: readonly string[];
    readonly why: WhyItCannotBeAsked;
    /** What the words genuinely do not say. */
    readonly because: string;
    /**
     * What could decide it instead, from state.
     *
     * Marked honestly: some of these already exist and some are the open
     * design question. A field that claimed an answer nobody had built would
     * be the same dishonesty this file exists to prevent.
     */
    readonly decidedBy: string;
}

export const QUESTIONS_A_SENTENCE_CANNOT_CARRY:
readonly AQuestionTheSentenceCannotCarry[] = [
    {
        verb: 'sect',
        intents: ['join', 'recruit'],
        why: 'inversion',
        because:
            'Being taken into a house and bringing somebody else into it are the same act '
            + 'from the two ends of it, and "I ask them to accept me as a disciple" carries '
            + 'no word that says which end the speaker is standing at.',
        decidedBy:
            'BUILT. Membership: somebody on the roll is not joining it, and somebody who is '
            + 'not on it cannot recruit for it. The roster answers this without asking the '
            + 'sentence anything.'
    },
    {
        verb: 'sect',
        intents: ['leave', 'expel'],
        why: 'inversion',
        because:
            'Resigning and throwing somebody out are one act with the arrow reversed, and '
            + 'both are said as somebody leaving the house.',
        decidedBy:
            'BUILT. Whether a target was named, and whether the speaker holds a rung that '
            + 'can put somebody off the roll. A disciple naming another disciple is not an '
            + 'expulsion, it is a sentence with no authority behind it.'
    },
    {
        verb: 'sect',
        intents: ['donate', 'siphon'],
        why: 'inversion',
        because:
            'Stones moving between a member and the treasury, in one direction or the other. '
            + 'The words that would tell them apart - quietly, skim, divert - are a register '
            + 'rather than a direction, and a player who types neither has said neither.',
        decidedBy:
            'OPEN. Treasury access comes with a rung, which narrows it but does not settle '
            + 'it: an officer may do either. This is the pair with no state answer yet and '
            + 'is the one worth designing a scenario for.'
    },
    {
        verb: 'coerce',
        intents: ['submit', 'hand_over', 'talk'],
        why: 'shared_purpose',
        because:
            'All three are one person hitting another until they comply. What separates them '
            + 'is what the compliance was FOR, and a sentence that describes the hitting has '
            + 'not said. Three of the five collapsed on this and it is the failure that '
            + 'started the whole measurement.',
        decidedBy:
            'PARTLY BUILT, and it is the model for the rest. A submission already makes '
            + '`hand_over` the live thing to offer - the yielding flag, written when a '
            + 'coercion reaches one, and read by the situated affordances. The situation '
            + 'supplies what the sentence cannot, which is the general answer this file '
            + 'argues for.'
    }
];

/**
 * Intents no reading of the words may return, keyed on the verb.
 *
 * Derived rather than declared twice: the table above is the single statement,
 * and two lists of the same fact are how they start disagreeing.
 */
const UNASKABLE: ReadonlyMap<string, ReadonlySet<string>> = (() => {
    const built = new Map<string, Set<string>>();
    for (const row of QUESTIONS_A_SENTENCE_CANNOT_CARRY) {
        const held = built.get(row.verb) ?? new Set<string>();
        for (const intent of row.intents) held.add(intent);
        built.set(row.verb, held);
    }
    return built;
})();

/**
 * Whether a tier reading meaning may offer this intent for this verb.
 *
 * False is not a low score. It says the question is not answerable from words
 * at all, so there is no amount of evidence that would make the answer safe -
 * and a caller that treats it as a threshold to push past has misread it.
 */
export function theSentenceMayDecide(verb: string, intent: string): boolean {
    return !(UNASKABLE.get(verb)?.has(intent) ?? false);
}

/**
 * The intents of this verb that must come from the situation.
 *
 * For a caller building the affordances a scenario offers: these are exactly
 * the labels that need a state reason to become live, because nothing a player
 * types will ever reach them safely.
 */
export function whatOnlyTheSituationKnows(verb: string): readonly string[] {
    return [...(UNASKABLE.get(verb) ?? [])];
}

/**
 * Filter a ranked reading down to what the words are allowed to decide.
 *
 * The shape a tier returns - label and score, best first - in and out, so this
 * drops in ahead of whatever picks the winner. An empty result is the abstain:
 * every candidate was a question the sentence cannot carry, and the caller
 * owes the situation a chance to answer rather than a guess.
 */
export function onlyWhatTheWordsCanDecide<T extends { label: string }>(
    verb: string,
    ranked: readonly T[]
): T[] {
    return ranked.filter(row => theSentenceMayDecide(verb, row.label));
}
