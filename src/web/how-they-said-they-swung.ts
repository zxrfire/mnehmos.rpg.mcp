/**
 * ═══════════════════════════════════════════════════════════════════════════
 * READING THE SWING OFF THE SENTENCE, INSTEAD OF READING THE ENDING OFF IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The other half of {@link ../engine/cultivation/how-a-blow-was-thrown.js},
 * which carries the full account of why the old model was wrong. The short
 * version: the verb table used to pick an ENDING - kill, subdue, drive off,
 * humiliate - out of the player's words, under a comment that read *"SAYING HOW
 * IS SAYING HOW FAR"*. It is not. Saying how is saying HOW.
 *
 * The design owner: *"it depends on how you attack and how the NPC responds"* -
 * *"do you stab them? where? how hard?"*
 *
 * So this module answers exactly those three questions and nothing else. It
 * does not decide whether anybody dies, and it must never learn how: what a
 * swing DOES is the engine's, and what the person on the end of it does about
 * it is theirs.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HALF THAT WAS MISSING ENTIRELY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Eight ways of laying hands on somebody returned `unclear` from the real
 * parser - push, shove, slap, grab, punch, kick, elbow, tackle. So the game had
 * no reading at all for the commonest violence there is, and a player who typed
 * *"I shove him"* was told the sentence made no sense.
 *
 *   *"a push is assault"* - *"i slap his hand is an attack"*
 *
 * They are all here now, and they all reach `attack`, because they all ARE one.
 * What separates them from running somebody through is three fields, not a
 * different verb.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE ORDER OF THE READS IS LOAD-BEARING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHERE is read first, because it disambiguates WHAT. The word `neck` is the
 * clean case: *"cut his neck"* is a throat and *"break his neck"* is a spine,
 * and the same noun means two different injuries depending on the verb in front
 * of it. Reading the instrument first would force a guess.
 *
 * FORCE is read last, because both of the others can raise it. *"Run him
 * through"* is an edge, and it is also `everything` - not because the player
 * said so, but because that is what the phrase describes. A table that read
 * force independently would score it the same as a jab.
 */

import type {
    HowTheBlowWasThrown,
    WhatWasInTheHand,
    WhereItWasAimed,
    HowMuchWasBehindIt
} from '../engine/cultivation/how-a-blow-was-thrown.js';

// ── WHERE ───────────────────────────────────────────────────────────────────

/**
 * The verbs that mean a neck is being OPENED rather than BROKEN.
 *
 * The whole reason `neck` cannot be read on its own. Everything in this list
 * puts an edge across it; everything in {@link BREAKING_IT} puts a spine on the
 * other side of the same word.
 */
const OPENING_IT = /\b(?:cut|cuts|slit|slits|slash|slashes|open|opens|sever|severs|slice|slices)\b/i;

/** The verbs that mean a neck is a spine. */
const BREAKING_IT = /\b(?:break|breaks|snap|snaps|crush|crushes|wring|wrings|twist|twists)\b/i;

/**
 * Hands on a throat, which is its own act.
 *
 * Named separately from the open hand because it carries BOTH of the other two
 * fields with it: the throat is what the word means, and there is no such thing
 * as a tentative strangling. Left to the general rules it came out as an open
 * hand aimed nowhere at light force - the gentlest reading the table has - for
 * the sentence *"I strangle him"*.
 */
const STRANGLING = /\b(?:strangle|strangles|strangled|strangling|throttle|throttles|throttled|throttling|choke|chokes|choked|choking|garrotte|garrottes|garotte|smother|smothers|smothered)\b/i;

/**
 * A BODY PART ONLY COUNTS WHEN SOMETHING POINTS AT IT.
 *
 * Measured: *"i elbow him"* came back aimed at a LIMB. `elbow` is in the limb
 * list, so the word naming the INSTRUMENT was read as the word naming the
 * TARGET, and the same trap is set by `knee`, `shoulder`, `head` (headbutt),
 * `hand` and `back`. A bare part-word in a sentence is far more often the thing
 * doing the hitting than the thing being hit.
 *
 * So a location has to be POINTED AT: by a preposition (*"stab him IN the
 * throat"*, *"club him OVER the head"*, *"go FOR the throat"*) or by a
 * possessive (*"cut HIS throat"*, *"slap HIS hand"*). That is how people
 * actually write it, and it is what tells a target apart from an elbow.
 */
const POINTED_AT =
    String.raw`(?:\b(?:in|into|through|on|onto|at|across|over|under|behind|for|to|against|by)\s+`
    + String.raw`(?:the|his|her|their|its|my|a)?\s*(?:[A-Za-z]+'s\s+)?`
    + String.raw`|\b(?:his|her|their|its|my|the)\s+`
    // A NAME'S POSSESSIVE POINTS AT A PART TOO. Measured: *"I cut Gu Peiyan's
    // throat"* read the throat as unstated and came back as a wound rather
    // than a death, because only pronoun possessives were accepted - so
    // naming the person you were cutting made the sentence weaker than
    // saying "his".
    + String.raw`|\b[A-Za-z]+'s\s+)`;

/** A location, once something has pointed at it. */
function pointedAt(parts: string): RegExp {
    return new RegExp(POINTED_AT + String.raw`(?:` + parts + String.raw`)\b`, 'i');
}

/**
 * Where the blow went, in the order the words have to be checked.
 *
 * Only the places that CHANGE WHAT THE BLOW CAN DO are here. A shoulder and a
 * thigh are both `limb`, because nothing downstream treats them differently and
 * inventing a distinction the engine cannot act on would be decoration.
 *
 * Order is by how much the place changes the outcome, so *"a cut across his
 * face and throat"* reads as the throat rather than the face.
 */
const WHERE: ReadonlyArray<readonly [RegExp, WhereItWasAimed]> = [
    [pointedAt(String.raw`throat|windpipe|jugular`), 'throat'],
    [pointedAt(String.raw`spine|backbone|vertebrae`), 'spine'],
    [pointedAt(String.raw`head|skull|face|temple|jaw|eyes?|nose|brow`), 'head'],
    [pointedAt(String.raw`chest|heart|ribs?|breast|sternum`), 'chest'],
    [pointedAt(String.raw`gut|guts|stomach|belly|abdomen|navel`), 'gut'],
    // The dantian is not a limb and not a chest. It is the one place in this
    // setting where a blow is aimed at somebody's CULTIVATION rather than at
    // their body, and the crippling machinery already knows that sentence.
    // Read as chest so the blow lands somewhere vital; what it TAKES is decided
    // by the crippling path, not here.
    [pointedAt(String.raw`dantian|core|meridians?|foundation`), 'chest'],
    [pointedAt(String.raw`hands?|fingers?|wrist|knuckles`), 'hand'],
    [pointedAt(String.raw`arms?|legs?|shoulders?|thigh|knee(?:cap)?s?|elbows?|feet|foot|ankle`), 'limb'],
    [pointedAt(String.raw`back|kidneys?`), 'back']
];

/**
 * Where the sentence said it went.
 *
 * `neck` is handled before the table because it is the one word that is two
 * places: *"cut his neck"* is a throat and *"break his neck"* is a spine, and
 * only the verb in front of it says which.
 */
export function whereItWasAimed(input: string): WhereItWasAimed {
    // A STRANGLING NAMES ITS OWN TARGET. Nobody writes *"I strangle him by the
    // throat"* - the throat is the whole meaning of the word. Measured, it read
    // as `unstated` and therefore as a blow that lands nowhere in particular,
    // which made it survivable by default.
    if (STRANGLING.test(input)) return 'throat';
    if (pointedAt(String.raw`neck`).test(input)) {
        if (BREAKING_IT.test(input)) return 'spine';
        if (OPENING_IT.test(input)) return 'throat';
        // A hand on a neck, unqualified, is a hand on a throat.
        return 'throat';
    }
    for (const [pattern, where] of WHERE) {
        if (pattern.test(input)) return where;
    }
    return 'unstated';
}

// ── WHAT WITH ───────────────────────────────────────────────────────────────

/**
 * An open hand, which is a CHOICE and not an absence.
 *
 * Somebody holding a sword who shoves you instead has said something, and the
 * engine reads it: see `theOffenceInIt`. Strangling lives here rather than with
 * the edges for the same reason - it is done with the hands, and the hands are
 * what makes it the thing it is.
 */
const AN_OPEN_HAND =
    /\b(?:push|pushes|pushed|pushing|shove|shoves|shoved|shoving|slap|slaps|slapped|slapping|grab|grabs|grabbed|grabbing|seize|seizes|seized|poke|pokes|poked|poking|prod|prods|prodded|swat|swats|swatted|cuff|cuffs|cuffed|backhand|backhands|throttle|throttles|throttled|strangle|strangles|strangled|strangling|choke|chokes|choked|choking|grapple|grapples|wrestle|wrestles|tackle|tackles|tackled|shoulder|shoulders|nudge|nudges|nudged|flick|flicks|flicked|tap|taps|tapped|pin|pins|pinned)\b/i;

/**
 * Bare and meant. Not literally a closed fist - a knee and a headbutt belong
 * here too, because what matters downstream is that there is no instrument, and
 * that unlike an open hand this was thrown to do damage.
 */
const BARE_AND_MEANT =
    /\b(?:punch|punches|punched|punching|kick|kicks|kicked|kicking|elbow|elbows|elbowed|knee|knees|kneed|headbutt|headbutts|jab|jabs|jabbed|uppercut|pummel|pummels|pummelled|pummeled|beat|beats|sock|socks|deck|decks|clout|clouts|batter|batters)\b/i;

/**
 * An edge or a point. The only ordinary instrument that opens a body, which is
 * why it is the one the ceiling table treats differently.
 *
 * `run through` is here rather than in the force list even though it also means
 * `everything`: it names a thrust with a blade, and the phrase is the reason
 * the old table's worst measured defect existed at all.
 */
const AN_EDGE =
    /\b(?:stab|stabs|stabbed|stabbing|slash|slashes|slashed|slit|slits|slice|slices|cut|cuts|cutting|carve|carves|gash|gashes|hack|hacks|pierce|pierces|impale|impales|skewer|skewers|behead|beheads|decapitate|decapitates|disembowel|disembowels|knife|knifes|sword|blade|dagger|sabre|saber|spear|glaive|halberd|thrust|thrusts)\b/i;

/** Named separately because the phrase, not the word, is what says it. */
const RUN_THROUGH = /\brun (?:him|her|them|it|[a-z]+) through\b/i;

/** Breaks rather than opens. */
const SOMETHING_BLUNT =
    /\b(?:club|clubs|clubbed|cudgel|cudgels|bludgeon|bludgeons|staff|stave|pommel|hammer|hammers|mace|rock|stone|brick|cane|baton|truncheon)\b/i;

/**
 * What was in the hand.
 *
 * The order is by how specific the claim is. An edge named outright beats a
 * generic bare-handed verb, because *"I punch him with my dagger out"* is a
 * sentence about a dagger. And `in_hand` is the default rather than `fist`,
 * because a player who says only *"I attack him"* attacked with whatever they
 * are carrying - defaulting to a fist would quietly disarm every armed
 * cultivator at the moment they swung.
 */
export function whatWasInTheHand(input: string, aimedAt: WhereItWasAimed): WhatWasInTheHand {
    // BREAKING A NECK IS DONE WITH HANDS. Measured: *"i break his neck"* read
    // as `in_hand`, so it would have been resolved with whatever sword the
    // cultivator happened to be carrying. Nobody breaks a neck with a sword.
    // Checked before the instruments because `break` names no instrument at all
    // and would otherwise fall through to the unresolved default.
    if (BREAKING_IT.test(input) && (aimedAt === 'spine' || aimedAt === 'throat')) {
        return 'open_hand';
    }
    if (RUN_THROUGH.test(input) || AN_EDGE.test(input)) return 'edge';
    if (SOMETHING_BLUNT.test(input)) return 'blunt';
    if (AN_OPEN_HAND.test(input)) return 'open_hand';
    if (BARE_AND_MEANT.test(input)) return 'fist';
    return 'in_hand';
}

// ── HOW HARD ────────────────────────────────────────────────────────────────

/**
 * Zero, by construction rather than by degree.
 *
 *   *"and i poke probably gentlest"* - *"like probably 0 damage"* -
 *   *"but you might still annoy someone depending on relationship"*
 *
 * Which is why this is a named step and not simply the low end of `light`. A
 * poke has to be able to reach the offence machinery while reaching none of the
 * damage machinery, and one number cannot do that.
 */
const BARELY_TOUCHING =
    /\b(?:poke|pokes|poked|poking|prod|prods|prodded|prodding|tap|taps|tapped|tapping|nudge|nudges|nudged|flick|flicks|flicked)\b/i;

/** Meant to move somebody, or to say something, rather than to hurt them. */
const NOT_MUCH_BEHIND_IT =
    /\b(?:lightly|gently|softly|just|barely|a little|half-?hearted(?:ly)?|without (?:much )?force)\b/i;

/** Nothing kept back for whatever comes after. */
const EVERYTHING_THEY_HAVE =
    // The last group is the words for killing MORE than one. They say the same
    // thing about the force as `kill` does and were reaching `committed`, so
    // *"I exterminate his family"* opened at less than *"I kill him"*.
    /\b(?:with everything|all[- ]out|as hard as (?:i|he|she|they) can|with all (?:my|his|her|their) (?:strength|might|power|force)|full[- ]force|with intent to kill|to kill|kill|kills|murder|murders|slay|slays|assassinate|finish (?:him|her|them) off|no holding back|hold nothing back|exterminate|exterminates|wipe out|wipes out|slaughter|slaughters|massacre|massacres|annihilate|annihilates|butcher|butchers|put (?:him|her|them) to the sword)\b/i;

/**
 * CUT SOMEBODY DOWN.
 *
 * Its own pattern because the phrase is split around the person every single
 * time anybody says it - *"cut him down"*, never *"cut down him"* - so no word
 * list reaches it. The verb table already learned this the hard way and carries
 * the same note.
 *
 * And it belongs with the force rather than with the edges: `cut` already says
 * what is in the hand. What `down` adds is that it was meant to be the end of
 * them, which is the difference between this and a cut.
 */
const CUT_THEM_DOWN = /\bcuts?\s+(?:him|her|them|it|[A-Z][a-z]+)\s+down\b|\bcut down\b/i;

/** The words that mean a light instrument was thrown hard anyway. */
const HARD =
    /\b(?:hard|hardest|violently|savagely|with force|as hard as)\b/i;

/**
 * How much was behind it.
 *
 * Read last, because the instrument and the target can both raise it. Two rules
 * that are easy to get backwards:
 *
 * A poke is checked FIRST and wins outright, so *"I poke him hard"* is still a
 * poke. The word `hard` on a poke is emphasis, not force, and letting it
 * promote would make the gentlest act in the game into a real blow on one
 * adverb.
 *
 * `light` is NOT the default. The bare form is `committed`, because *"I attack
 * him"* means somebody is fighting - the old table defaulted the bare form to
 * its weakest reading and that is precisely how a killing thrust came back as
 * shooing somebody away.
 */
export function howMuchWasBehindIt(
    input: string,
    held: WhatWasInTheHand,
    aimedAt: WhereItWasAimed
): HowMuchWasBehindIt {
    if (BARELY_TOUCHING.test(input)) return 'a_poke';
    if (RUN_THROUGH.test(input) || CUT_THEM_DOWN.test(input)
        || EVERYTHING_THEY_HAVE.test(input)) return 'everything';
    // NEITHER A STRANGLING NOR A BROKEN NECK IS A HALF-MEASURE. Nobody snaps a
    // spine tentatively and nobody strangles somebody a bit. Both are open
    // hands, so without this the line further down would score them `light` -
    // the gentlest reading there is - and both sentences would be survivable
    // by default.
    if (STRANGLING.test(input)) return 'everything';
    if (BREAKING_IT.test(input) && (aimedAt === 'spine' || aimedAt === 'throat')) {
        return 'everything';
    }
    if (HARD.test(input)) return 'committed';
    if (NOT_MUCH_BEHIND_IT.test(input)) return 'light';
    // A shove, a slap, a grab. These describe their own force, and describing
    // one is the reason somebody chose the word over `hit`.
    if (held === 'open_hand') return 'light';
    return 'committed';
}

/**
 * The whole reading, which is the only thing the verb table should call.
 *
 * Returns a blow for ANY sentence handed to it, including one that named none
 * of the three. That is deliberate and it is what {@link AN_ORDINARY_SWING}
 * exists for: a player who typed *"I attack him"* described a swing, and the
 * engine is entitled to a complete one.
 *
 * WHERE is read first because both of the others depend on it - see the header.
 */
export function howTheySaidTheySwung(input: string): HowTheBlowWasThrown {
    const aimedAt = whereItWasAimed(input);
    const held = whatWasInTheHand(input, aimedAt);
    return {
        with: held,
        at: aimedAt,
        force: howMuchWasBehindIt(input, held, aimedAt)
    };
}
