/**
 * How a player says each KIND of coercion, in their own words.
 *
 * A pilot, deliberately scoped to one verb. What it is for is a measurement,
 * not a routing change: do exemplars separate intents whose frames overlap?
 *
 * ── THE GAP THIS IS AIMED AT ─────────────────────────────────────────────
 *
 * The ladder that reads a sentence has three rungs - the pattern table, the
 * exemplar tier, the model - and it produces an INTENT on the first and the
 * third. The table has rows that name one; phase 1 has `intent` in its schema
 * and answers it, or leaves it empty. Between them sits a tier that has no
 * representation of an intent AT ALL:
 *
 *     HOW_A_PLAYER_SAYS_EACH_VERB: Record<Exclude<ActionName, 'unclear'>, ...>
 *
 * That is a type, not a gap somebody forgot to fill - there is nothing in that
 * file an intent could be written into, and `verbForASentenceThePatternsMissed`
 * returns an `ActionName`. A reader who knows that stops looking for the
 * routing bug, because there is no routing to be wrong.
 *
 * So this is not moving intent off the regex rows and onto exemplars. It is
 * GIVING THE MIDDLE RUNG THE THING IT IS MISSING, and that is the stronger
 * argument for the same change: it explains why the failures cluster the way
 * they do. Rung 1 is loose, rung 3 is a model that drops fields, and there is
 * nothing in between to arbitrate. Two measured failures in one day, both of
 * them exactly that shape:
 *
 *   A model answered a bare `coerce` and the sentence's `hand_over` was lost,
 *   because the backfill carried five fields and not that one.
 *
 *   A table row that read `force (him|her|them) (to|into)` and nothing after
 *   it claimed "I force him to swallow it" for `hand_over`, and once
 *   `hand_over` moved a purse that sentence robbed a man somebody had meant to
 *   make take a pill.
 *
 * ── AND WHY ONE VERB RATHER THAN ALL NINETEEN ────────────────────────────
 *
 * Counted before any of this was written: 80 intents are declared across 19
 * verbs, 0 are reachable by exemplar, and the deterministic code that produces
 * them is spread over NINE MODULES - `verb-pattern-table.ts` holds only 17 of
 * the 68 sites, with the rest in `institution-phrasings.ts`, `sect-phrasings.ts`,
 * `asking-is-not-doing.ts`, `leaving-things-for-the-next-life.ts`,
 * `site-phrasings.ts` and three more. There is no single table to point a tier
 * at, and whoever picks up verb two should know that before they start.
 *
 * Doing all of it means 320 to 560 new exemplars at this file's own standard,
 * every one a sentence somebody would really type. Writing those on the
 * strength of an untested hypothesis is the shape of work this repo keeps
 * having to unpick. `coerce` is the pilot because the overlap that prompted
 * the question lives here: `swallow` and `hand_over` are the same sentence
 * frame - somebody made to do a thing with a thing - and if exemplars cannot
 * tell those apart they will not tell apart the harder pairs either.
 *
 * ── `swallow` IS IN THIS CORPUS AND IS NOT A VERB YOU CAN REACH ──────────
 *
 * Measuring whether a label separates is not the same as wiring an act to it,
 * and the two must not be confused. Forcing a pill on somebody is on hold on a
 * content question - every one of the nine effects in the pill catalog is
 * beneficial, so the act as the genre means it has no object in the world yet.
 * Until that is ruled, the sentence goes unrouted, which is correct: a
 * sentence that cannot become an honest act must not become a dishonest one.
 *
 * It is here because it is the measurement. It is nowhere else.
 *
 * ── THE THREE RULES, WHICH ARE THE VERB CORPUS'S OWN ─────────────────────
 *
 *   - A phrasing goes in because somebody would type it, not because it makes
 *     a number go up.
 *   - Keep them short and keep them distinct from each other.
 *   - Write the INTENTION, never the mood.
 */

/**
 * The four labels `COERCION_INTENT_PATTERNS` already carries, plus the one
 * being measured. `tame` is not a fifth kind of person: above
 * `BEAST_CHANGE_ORDINAL` what is standing there is a person and the same act
 * is an indenture, which is why the rows tell them apart on the target and not
 * on the words.
 */
export type CoercionIntent = 'submit' | 'hand_over' | 'talk' | 'tame' | 'swallow';

export const HOW_A_PLAYER_SAYS_EACH_COERCION:
Readonly<Record<CoercionIntent, readonly string[]>> = {
    // Compliance and nothing else. The thing wanted IS the kneeling.
    submit: [
        'I beat him until he kneels',
        'I make her yield to me',
        'I force them to bow to me',
        'I want him on his knees and nothing more',
        'I keep hitting him until he gives in'
    ],

    // Compliance for their things.
    hand_over: [
        'I make him hand over everything he is carrying',
        'I take the merchant\'s purse off him by force',
        'I shake him down for his spirit stones',
        'I force her to empty her pockets',
        'I want what he is carrying and I will hurt him for it'
    ],

    // Compliance for what they know. Distinct from `interact`'s `interrogate`
    // by the hands: this is the point at which somebody stops being asked.
    talk: [
        'I beat the answer out of him',
        'I make her tell me where it is',
        'I keep hurting him until he talks',
        'I force the name out of her',
        'I want the location and he is going to say it'
    ],

    // An animal broken to somebody's will.
    tame: [
        'I break the wolf in',
        'I bring the beast to heel',
        'I master the animal until it follows me',
        'I subdue the creature and make it mine',
        'I force the beast to take me as its master'
    ],

    // Compliance with something going INTO them. The frame `hand_over` shares
    // - a person made to do a thing with a thing - and the opposite direction.
    swallow: [
        'I force the pill down his throat',
        'I make him swallow it',
        'I hold her jaw open and put the pill in',
        'I make the man take the medicine whether he wants it or not',
        'I force him to drink it'
    ]
};

/**
 * Sentences NOT in the corpus, and what a player typing them would mean.
 *
 * The corpus scores well against itself by construction, so held-out sentences
 * are the only honest measure. Two of them are deliberately hard:
 * "I make the beast submit to me" sits between `tame` and `submit`, and
 * "I make her eat it" says neither pill nor throat.
 */
export const COERCIONS_NOBODY_WROTE_AN_EXEMPLAR_FOR:
readonly { readonly said: string; readonly means: CoercionIntent }[] = [
    { said: 'I force him to swallow the pill', means: 'swallow' },
    { said: 'I push the tablet past his teeth', means: 'swallow' },
    { said: 'I make her eat it', means: 'swallow' },
    { said: 'I force it down his throat', means: 'swallow' },
    { said: 'I make him turn out his pockets', means: 'hand_over' },
    { said: 'I take everything he has by force', means: 'hand_over' },
    { said: 'I force him to give me the ledger', means: 'hand_over' },
    { said: 'I strip him of what he is carrying', means: 'hand_over' },
    { said: 'I make him kneel to me', means: 'submit' },
    { said: 'I force her to surrender to me', means: 'submit' },
    { said: 'I torture him until he tells me', means: 'talk' },
    { said: 'I force the truth out of her', means: 'talk' },
    { said: 'I break the horse to my hand', means: 'tame' },
    { said: 'I make the beast submit to me', means: 'tame' }
];
