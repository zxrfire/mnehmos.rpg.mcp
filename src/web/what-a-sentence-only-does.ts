/**
 * Sentences that only say a thing, and the verbs they must never reach.
 *
 * A guard rather than a reading. The pattern table and the model both decide
 * what a sentence MEANS; these decide what it cannot be allowed to mean,
 * because being wrong about it is not recoverable:
 *
 *   a haggle         must not become a purchase - the purse opens
 *   an insult        must not become an attack - a fight opens
 *
 * A model may be wrong about what you said, and the irreversible things still
 * do not happen. That is the whole of what this file is for, and it is why
 * each pattern is broader than a reading would be: a veto that misses is worse
 * than one that is too easily satisfied, and the fallback is always the
 * narrower act rather than the wider one.
 *
 * ── AND IT IS A LEAF, DELIBERATELY ───────────────────────────────────────
 *
 * It imports nothing. These patterns lived in `verb-pattern-table.ts`, and
 * importing them into `turn-engine.ts` closed a cycle - `actions.js` was not
 * initialised when `prompt.ts` evaluated a top-level constant, so
 * `costsTheAskerNothing` arrived as `undefined` and a whole test file died at
 * load with a TypeError rather than failing to compile. The same trap
 * `takeTheRoundFirst` documents one module over, which takes a boolean rather
 * than importing the predicate it wants for exactly this reason.
 *
 * A file with no imports cannot be in a cycle. That is the fix and it is the
 * reason to keep it that way.
 */

/**
 * A sentence that goes back and forth over a price rather than paying one.
 *
 * Four words, each unambiguous: nobody writes *I haggle* and means *I pay what
 * they asked*.
 */
export const A_SENTENCE_THAT_ONLY_NEGOTIATES =
    /\b(?:haggle|haggles|haggling|haggled|negotiate|negotiates|negotiating|negotiated|bargain|bargains|bargaining|bargained|barter|barters|bartering|bartered)\b/i;

/**
 * Telling a room, or one of them, what you think of it.
 *
 * Plain obscenity is on the list because a player who types it means it, and
 * the measured failure was that *"fuck you all"* reached no verb at all and was
 * read as a QUESTION put to everybody standing there.
 */
export const AN_INSULT = new RegExp([
    // Plain obscenity aimed at somebody. A player who types it means it.
    String.raw`\b(?:fuck|screw) (?:you|him|her|them|the lot of|off)\b`,
    // Saying it, in the verbs for saying it.
    String.raw`\b(?:insult|insults|insulting|insulted|sneer|sneers|sneering|sneered|jeer|jeers|jeering|taunt|taunts|taunting|taunted|mock|mocks|mocking|mocked|curse|curses|cursing|cursed|spit|spits|spitting|spat)\b`,
    String.raw`\b(?:call|calls|calling|called) (?:him|her|them|the \w+) (?:a|an) (?:fraud|coward|disgrace|dog|worm|cur|fool|wretch)\b`,
    String.raw`\btell (?:him|her|them|the lot of them) (?:exactly )?what i think\b`,
    // ── AND CONTEMPT WITH NO SWEARING IN IT ──────────────────────────────
    //
    // The first cut wanted an obscenity or a named verb, so "fuck you all"
    // was caught and *"you are all worthless trash"* went straight through to
    // the pressing path and killed the player on the next turn. A curse does
    // not need a curse word.
    //
    // WHAT MAKES IT SAFE is the veto's other half: this fires only where no
    // hand is raised in the same sentence, so "I strike the worthless dog"
    // is untouched. The pattern is what somebody SAYS people are.
    String.raw`\b(?:you|he|she|they|the lot of you|all of you)\s+(?:are|is|'re|'s)\s+(?:all\s+)?(?:a\s+|an\s+)?(?:worthless|pathetic|useless|contemptible|beneath|nothing|trash|scum|filth|rubbish|vermin|cowards?|dogs?|worms?|fools?|wretches?|disgraces?|frauds?|jokes?)\b`,
    String.raw`\b(?:worthless|pathetic|useless|contemptible)\s+(?:trash|scum|filth|rubbish|vermin|dogs?|worms?|fools?|wretches?|cowards?)\b`
].join('|'), 'i');

/**
 * Anything that would put hands on somebody, in the plainest words.
 *
 * Read together with {@link AN_INSULT}: a sentence that insults and does NOT
 * contain one of these has nobody being hit in it, whatever a model made of it.
 */
export const A_HAND_RAISED =
    /\b(?:attack|attacks|attacking|attacked|strike|strikes|striking|struck|hit|hits|hitting|punch|punches|punching|punched|kick|kicks|kicking|kicked|stab|stabs|stabbing|stabbed|cut|cuts|cutting|slash|slashes|kill|kills|killing|killed|draw|draws|drawing|drew|swing|swings|swinging|swung|lunge|lunges|charge|charges|charging|charged|grab|grabs|grabbing|grabbed|seize|seizes|seizing|seized|throttle|throttles|strangle|strangles|beat|beats|beating|fight|fights|fighting|fought|sword|blade|fist|fists|make|makes|making|made|force|forces|forcing|forced|drag|drags|dragging|dragged|pin|pins|pinning|pinned|shove|shoves|shoving|shoved|push|pushes|pushing|pushed|throw|throws|throwing|threw)\b/i;

/**
 * A bow, a kneel or cupped hands aimed at somebody.
 *
 * The genre's ordinary greeting and its ordinary apology, and it shares every
 * word with surrendering. What tells them apart is that a courtesy is aimed AT
 * a person - a name, a title, a senior - and a surrender is aimed at whoever is
 * currently hitting you, which the sentence does not have to say.
 */
export const A_COURTESY_TO_SOMEBODY =
    /\b(?:bow|bows|bowing|bowed|kneel|kneels|kneeling|knelt|salute|salutes|saluting|saluted|cup|cups|cupping)\b[^.!?]{0,30}?\b(?:to|before|toward|towards|at)\s+((?:my|our|the|his|her|their)\s+)?((?:senior|junior|elder|master|grand)\s+)?(seniors?|juniors?|elders?|masters?|patriarch|abbot|brothers?|sisters?|[A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?)/;
