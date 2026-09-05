/**
 * The corpus that tests one prediction, on two verbs chosen to disagree.
 *
 * ── THE RULE BEING TESTED ────────────────────────────────────────────────
 *
 * An intent distinguished by its OBJECT is a parsing question. An intent
 * distinguished by its PURPOSE is a situation question, and must never be
 * asked of the sentence.
 *
 * The `coerce` pilot next door produced it rather than assuming it.
 * `swallow` and `tame` separated cleanly - a thing going into somebody and an
 * animal being broken are IN the words. `submit`, `talk` and `hand_over` did
 * not, and could not: they describe the same physical act, a person hitting
 * another until they comply, and differ only in what the compliance was FOR.
 * That purpose is usually not written down. No classifier recovers what was
 * never said, so three of the five had another intent nearer to them than
 * their own exemplars were.
 *
 * ── WHY THESE TWO VERBS ──────────────────────────────────────────────────
 *
 * The rule is only worth anything if it predicts before it is measured, so it
 * was written down first and these two were named as the test:
 *
 *   `move`'s five SHOULD separate. Travelling, fleeing, walking over to
 *   somebody, going inside and following somebody are five different physical
 *   acts, and each one is in the sentence.
 *
 *   `sect`'s fourteen SHOULD NOT. Most of them are one act - addressing your
 *   house - told apart by what is wanted from it, and several are the same
 *   question with a different subject.
 *
 * If `sect` separates, the rule is wrong and that is the result worth having.
 *
 * ── AND WHAT A FAILURE HERE IS NOT ───────────────────────────────────────
 *
 * It is not an argument for more exemplars or a better model. Where an intent
 * is purpose-distinguished the answer is not a classifier at all: it is a
 * SCENARIO that makes the intent live, the way a submission makes `hand_over`
 * the obvious thing to offer. State knows what the sentence cannot.
 *
 * Four exemplars each, which is deliberately lean. The measure is the
 * DIFFERENCE between the two verbs under identical treatment, not either one's
 * absolute score.
 *
 * ── AND IT WAS MEASURED. THE RULE HELD, ON THE HARDER READING ────────────
 *
 *     verb     intents  exemplars  leave-one-out  collapsed
 *     move           5         20      14/20  70%      2/5
 *     sect          14         56      16/56  29%     10/14
 *
 * Do NOT read those accuracies against each other. A fourteen-way choice has a
 * 7.1% chance baseline where a five-way has 20%, so as lift over chance `sect`
 * is 4.0x and `move` is 3.5x - and `sect` is marginally the better of the two.
 * Comparing raw accuracy across different class counts compares the class
 * counts. `collapsed` is the chance-independent figure and it does order the
 * predicted way, but weakly.
 *
 * What decides it is the SHAPE of the failures. `sect` fails by INVERSION -
 * `join -> recruit` on all four, `expel -> leave` on both, `siphon -> donate`
 * and back again - which is one act with the direction reversed, and the
 * direction is the purpose. `move` fails by ADJACENCY: `approach -> enter`,
 * `travel -> flee`, neighbouring acts of the same kind, never their opposites.
 *
 * That is why the rule is a safety property and not a quality one. An
 * adjacency error is a slightly wrong read. An inversion error hands the
 * player who asked to JOIN a recruitment drive, and the one who asked to LEAVE
 * somebody else's expulsion - a wrong act reporting success, which is the
 * failure this layer keeps producing by other routes.
 *
 * The prediction is not clean on the good side and should not be reported as
 * if it were: two of `move`'s five collapsed, `approach` sitting nearer to
 * `enter` (0.852) than to its own exemplars (0.746), because walking up to a
 * gate and walking through it are very nearly the same sentence.
 *
 * See `tests/web/do-exemplars-separate-intents.test.ts`, which holds the
 * numbers and pins the inversion.
 */

export const HOW_A_PLAYER_SAYS_EACH_MOVE: Readonly<Record<string, readonly string[]>> = {
    travel: [
        'I set out for Silver Island',
        'I make the journey to the capital',
        'I take the road east',
        'I walk to the next town'
    ],
    flee: [
        'I run for it',
        'I get out of here before they catch me',
        'I break away and run',
        'I get clear of this place while I still can'
    ],
    approach: [
        'I walk over to the man by the well',
        'I go up to her',
        'I close the distance to the stall',
        'I step across to the gatekeeper'
    ],
    enter: [
        'I go inside the hall',
        'I step through the doorway',
        'I go in through the gate',
        'I let myself into the pavilion'
    ],
    follow: [
        'I follow him at a distance',
        'I keep behind her and see where she goes',
        'I trail the courier',
        'I go after them without being seen'
    ]
};

export const HOW_A_PLAYER_SAYS_EACH_SECT_ASK: Readonly<Record<string, readonly string[]>> = {
    leave: [
        'I resign from the sect',
        'I want out of the house',
        'I hand in my membership',
        'I am done with this order'
    ],
    promote: [
        'I ask for a higher rung',
        'I put myself forward for the next rank',
        'I ask the elder to raise my standing',
        'I want to be promoted'
    ],
    stipend: [
        'I go and draw my stipend',
        'I collect what the house owes me this month',
        'I want my allowance',
        'I ask for what I am paid'
    ],
    standing: [
        'where do I stand in the sect',
        'what is my rank here',
        'how does the house see me',
        'I check where I am on the roll'
    ],
    join: [
        'I ask to join the sect',
        'I want to be taken in',
        'I apply to the house',
        'I ask them to accept me as a disciple'
    ],
    siphon: [
        'I skim from the treasury',
        'I quietly take from the sect reserves',
        'I divert some of the house funds to myself',
        'I bleed the vault a little each month'
    ],
    order: [
        'I give the order',
        'I command the disciples to move',
        'I tell the house what to do',
        'I issue an instruction to my people'
    ],
    recruit: [
        'I go out and recruit for the sect',
        'I bring in new disciples',
        'I look for people to take into the house',
        'I sign somebody up to the order'
    ],
    admission: [
        'what does it take to get in',
        'what are the requirements to join',
        'who does this house accept',
        'what do they want from an applicant'
    ],
    curriculum: [
        'what does the sect teach',
        'what arts are on the shelf here',
        'what can I learn in this house',
        'what is taught to the disciples'
    ],
    expel: [
        'I throw him out of the sect',
        'I have her removed from the house',
        'I expel the disciple',
        'I strike his name off the roll'
    ],
    duty: [
        'I take a job off the mission board',
        'I pick up a duty from the house',
        'what tasks are posted here',
        'I take an assignment from the sect'
    ],
    donate: [
        'I pay into the sect ledger',
        'I donate to the house',
        'I give the sect some of my stones',
        'I make a contribution to the order'
    ],
    guest: [
        'I ask to sit in as a guest',
        'can I stay here without joining',
        'I want guest rights at this house',
        'I ask to be received without taking the oath'
    ]
};
