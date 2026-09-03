/**
 * Institutions acting on each other, and on the dead.
 *
 * Petition, posture, seal, offer and the way back down through the Lid: the
 * words a player uses for the five acts a house takes against another house or
 * against its own ancestors, and the one step that routes them.
 *
 * The last of the four verb families lifted out of the pattern table in
 * `actions.ts`, on the shape `leaving-things-for-the-next-life.ts` established
 * for `legacyStep`. It went last because it was the only one with an edge into
 * another family - `institutionalAct` reads `ASKING_TO_BE_TAKEN_IN`, which is
 * the sect vocabulary - so the sect file had to exist first for the dependency
 * to run one way. It now does: this module imports from `sect-phrasings.ts` and
 * nothing imports back.
 *
 * `planIntent` keeps its one-line call and the ordering around it untouched.
 * `institutionalAct`'s own ordering - alliance before offering, seal before
 * offering - is load-bearing and is exactly as it was.
 *
 * Single reason to change: how a player says one house is acting on another.
 */

import { PlannedAction } from './planned-action.js';
import { IMMORTAL_ITEMS } from '../data/cultivation/immortal-items.js';
import { usedAsVerb, partyAfter } from './sentence-parts.js';
import { ASKING_TO_BE_TAKEN_IN } from './sect-phrasings.js';

// ─── INSTITUTIONS ACTING ON EACH OTHER, AND ON THE DEAD ───────────────────
//
// Every rule below follows the shape the `order` branch established and the
// four seat powers repeated: A VERB IN VERB POSITION, PLUS THE NOUN THAT SAYS
// WHAT IT IS AIMED AT. Both halves are required, and they have to be, because
// this vocabulary is the setting's own. "ancestor", "seal", "war", "offering",
// "claim", "grant" and "petition" appear far more often as the object of
// somebody else's sentence than as the subject of one of these, and every one
// of them sits one clause away from a verb that would take the sentence
// somewhere adjacent and answer it wrongly.
//
// These sit HIGH in the table - above the asking branch, above `investigate`,
// above `interact` - and that placement is the fix for the defect that
// produced them. `interact` matches any sentence naming a faction, so
// "I ask the Deep Survey for one of its pills", "I offer an alliance to the
// Frostmirror Court" and "I petition the Third Sill Court for a grant" were
// all being answered by walking the player over and describing the building.
// A verb that quietly does something adjacent is worse than one that does
// nothing, because the player cannot tell refused from not implemented.

/** Which form is being filed. Selects a read; never decides an outcome. */
export type PetitionIntent = 'grant' | 'stock' | 'descent';
export const PETITION_INTENTS: readonly PetitionIntent[] = ['grant', 'stock', 'descent'] as const;
/** The cheapest and widest: send it up the chain and see how far it goes. */
export const DEFAULT_PETITION_INTENT: PetitionIntent = 'grant';

/**
 * The verbs that mean this on their own.
 *
 * `petition` and `appeal` are enough by themselves: nothing else in the
 * setting's vocabulary uses either word, and both name the act exactly.
 *
 * `apply` is deliberately NOT here, and leaving it in cost a regression that
 * this comment exists to stop somebody re-introducing. "I apply to the
 * Thousand Treasure Pavilion" is a sentence about JOINING - the sect surface
 * has owned `apply to` since it was written - and a bare `apply` in this table
 * took it and filed a request for a grant with a house the player was trying
 * to enrol in.
 */
export const PETITION_VERBS_ALONE =
    'petition|petitions|petitioning|appeal|appeals|appealing';

/**
 * The verbs that mean this only with the thing being asked for.
 *
 * `file`, `submit` and `lodge` reach the form branch through
 * {@link STANDING_STOCK_NOUNS}; here they need {@link PETITION_NOUNS}, because
 * every one of them is an ordinary word for putting a piece of paper somewhere.
 */
export const PETITION_VERBS =
    'petition|petitions|petitioning|appeal|appeals|appealing|apply|applies|applying|'
    + 'file|files|filing|submit|submits|submitting|lodge|lodges|lodging|put in|puts in';

/** The asking verbs, which reach this only with an institutional object. */
export const PETITION_ASKING_VERBS =
    'ask|asks|asking|request|requests|requesting|beg|begs|begging|entreat|entreats';

/** What is being asked for, where a bare asking verb needs a noun to qualify. */
export const PETITION_NOUNS =
    // `what i am owed` is the plainest thing anybody petitions for and it was
    // absent: "I ask the house for what I am owed" is the exemplar corpus's own
    // phrasing and it reached the stipend read, which is the house telling you
    // what your standing entitles you to rather than you asking for it.
    /\b(?:a grant|the grant|a stipend from|an allowance|a posting|a place at|relief|for aid|for protection|for help|a dispensation|an exemption|a hearing|a ruling|a (?:dao )?protector|a guard for|a technique|an art|a manual|the manual|resources|materials|stones for|a pill from|what i(?:'m| am)? owed|what is owed (?:me|to me))\b/;

/**
 * A BODY, rather than a person standing in front of you.
 *
 * The asking half of the petition rule is documented as reaching this "only
 * with an institutional object", and it did not: {@link PETITION_NOUNS} lists
 * things - a manual, an art, a pill - and a thing can be asked of anybody. So
 * "I ask him for the manual", which is `request`'s own exemplar and the ONLY
 * route in this game to being taught by a person, was filed as a petition to
 * an institution and refused in an institution's terms.
 *
 * The fix is the sentence the docstring already claimed: an asking verb
 * reaches `petition` when the thing being asked is asked OF a body. A named
 * faction satisfies it through the same phrase list the rest of this block
 * uses; the generic nouns are here because a player says "the house" far more
 * often than they say a name they may not have been told yet.
 *
 * `PETITION_VERBS` - petition, appeal, apply, file, lodge - are unaffected.
 * Nobody petitions a person, and those words carry the institution in
 * themselves.
 */
export const AN_INSTITUTION_IS_BEING_ASKED =
    /\b(?:sects?|houses?|clans?|orders?|schools?|halls?|courts?|pavilions?|councils?|elders?|the (?:seat|body|institution|administration|registry)|my house|our house|the family|patriarch|matriarch|hall master|sect master|head of the)\b/;

/**
 * The form, by name and by shape.
 *
 * `requisition` is unambiguous and needs no verb. The rest is the general case
 * the Requisition is one instance of: an application against something an
 * institution is holding and cannot reorder. Nothing here names a faction.
 */
export const REQUISITION_NAMED = /\brequisitions?\b/;

/**
 * The objects themselves, by name, generated from the catalog.
 *
 * A player who has been told what one of these is called asks for it by name -
 * "an Unearned Step", "a Second Dealing" - and a hand-written list here would
 * go stale the moment the catalog gained a third. Built rather than typed, on
 * the precedent `SITE_PHRASES` already sets in this file: a phrase list that
 * can drift from the content it describes is a phrase list that will.
 *
 * Names only. Nothing about what any of them does, how many exist, or who is
 * holding one crosses this boundary - the parser is deciding which verb the
 * sentence is, and the knowledge gate in `game.ts` decides everything else.
 */
export const IMMORTAL_ITEM_NAMED = new RegExp(
    '\\b(?:' + IMMORTAL_ITEMS
        .map(item => item.name.replace(/^The\s+/i, ''))
        .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')
    + ')\\b',
    'i'
);

export const STANDING_STOCK_NOUNS =
    /\b(?:standing stock|the stock|schedule amendment|amendment against|golden pills?|talismans?|immortal (?:pill|item|medicine|object)|one of (?:its|their|his|her) (?:pills?|talismans?)|(?:its|their) pills?)\b/;

/** Claiming a line, which is an application for recognition and is audited. */
export const DESCENT_VERBS =
    'claim|claims|claiming|assert|asserts|asserting|press|presses|pressing|'
    + 'register|registers|registering|prove|proves|proving';

export const DESCENT_NOUNS =
    /\b(?:descent|descended from|descend from|my (?:line|lineage|ancestry|blood)|the line of|of the blood of|kinship (?:to|with)|ancestral claim|claim of descent)\b/;

/** What a house is to another house. Selects a read; never decides an outcome. */
export type PostureIntent = 'stance' | 'war' | 'alliance' | 'defect' | 'tribute';
export const POSTURE_INTENTS: readonly PostureIntent[] =
    ['stance', 'war', 'alliance', 'defect', 'tribute'] as const;
/**
 * The read, and it must stay the default.
 *
 * Three of the four commit the house irreversibly and one of them starts a war.
 * A model answering `{"action":"posture","intent":"deal with them"}` gets the
 * standing between the two houses and nothing else, on exactly the reasoning
 * behind {@link DEFAULT_SITE_INTENT}.
 */
export const DEFAULT_POSTURE_INTENT: PostureIntent = 'stance';

export const DECLARE_VERBS =
    'declare|declares|declaring|open|opens|opening|make|makes|making|start|starts|'
    + 'starting|go to|going to|take|takes|taking';

/** The noun that says a declaration is a declaration of war. */
export const WAR_NOUN = /\b(?:war|hostilities|the field against)\b/;

export const ALLIANCE_VERBS =
    'offer|offers|offering|propose|proposes|proposing|make|makes|making|form|forms|'
    + 'forming|seek|seeks|seeking|extend|extends|extending|ally|allies|sue for';

export const ALLIANCE_NOUNS =
    // `peace with` and `truce` were missing, and "I make peace with the Azure
    // Dew Sect" is the plainest sentence in this whole block - `make` was
    // already a declaration verb, so the only thing standing between that
    // sentence and the verb it wants was the noun. Both require their
    // preposition, which keeps them off "the region is at peace" and off
    // anybody merely describing a standing.
    //
    // And both refuse a PRONOUN after it, which `misparse.test.ts` caught
    // immediately: "I make peace with it, in a manner of speaking, for a
    // season" is in the inert-fallback set, and it committed the house to a
    // peace with a party the sentence never named. Three of the five postures
    // bind a house irreversibly, so a phrasing that reaches one without
    // naming anybody is worse than a phrasing that reaches nothing.
    /\b(?:alliance|alliances|allied|a pact|the pact|a league|common cause|mutual defence|mutual defense|terms with|peace with (?!it\b|them\b|him\b|her\b|that\b|this\b|myself\b)|peace between|truce with (?!it\b|them\b|him\b|her\b|that\b|this\b)|a truce)\b/;

/**
 * Changing who the house holds from, which two courts in the catalog's own
 * history have already done.
 *
 * Requires a destination. "I defect" on its own is a member leaving a sect and
 * belongs to `sect`, which owns the word already - taking it here without
 * somewhere to go would answer a resignation with a diplomatic manoeuvre.
 */
/**
 * Demanding a payment from somebody, which is only a demand if you hold
 * something over them.
 *
 * Nearly dropped for want of data, and then it turned out the data is the best
 * part: `getParentage(client).parentFactionId` says who a house actually holds
 * from and `holds` says in what terms, so whether this is a levy or a threat is
 * a fact about the two parties rather than about the sentence. A house
 * demanding from its own client is exercising a right the catalog wrote down. A
 * house demanding from somebody else's client has said something about the
 * patron.
 */
export const TRIBUTE_VERBS =
    'demand|demands|demanding|levy|levies|levying|require|requires|requiring|'
    + 'exact|exacts|exacting|collect|collects|collecting|call in|calls in';

export const TRIBUTE_NOUNS =
    /\b(?:tribute|a levy|the levy|dues|a tithe|the tithe|their (?:grant|stones|contribution)|what (?:they|it) owes?)\b/;

export const DEFECT_PATTERN =
    /\b(?:defect(?:s|ing)? to|go(?:es|ing)? over to|went over to|transfer (?:our|the house'?s?|its|the) (?:allegiance|grant|patronage|standing)|change (?:our |the house'?s? )?patrons?|hold from|swear the (?:house|sect|clan|school) to|put (?:us|the house|the sect) under)\b/;

/** The seal. Selects a read; never decides an outcome, and never whose it is. */
export type SealIntent = 'read' | 'wake';
export const SEAL_INTENTS: readonly SealIntent[] = ['read', 'wake'] as const;
/**
 * The priced read, and it must stay the default.
 *
 * Waking one is the single most consequential thing a house can do and the one
 * act in this file that changes a power ordinal. A model answering
 * `{"action":"seal"}` with no label gets the condition and the cost.
 */
export const DEFAULT_SEAL_INTENT: SealIntent = 'read';

export const WAKE_VERBS =
    'wake|wakes|waking|waken|wakens|awaken|awakens|awakening|rouse|rouses|rousing|'
    + 'raise|raises|raising|unseal|unseals|unsealing|break|breaks|breaking|'
    + 'call up|calls up|bring up|brings up|open|opens|opening';

/**
 * Who or what is being woken. Without one of these the sentence is about
 * something else entirely - waking at dawn, raising a bar, breaking a barrier.
 */
export const SEALED_NOUNS =
    // "the sleeper" is retired vocabulary in the catalogs - they are people
    // under a mountain rather than instruments - and it stays HERE because a
    // parser has to accept the words a player types, not the words the world
    // uses. Nothing downstream repeats it back.
    /\b(?:sealed ancestor|dormant ancestor|the sleeper|sleeping ancestor|(?:our|their|its|the|my) ancestors?|seals?|what(?:'s| is) under the mountain|under the mountain|the thing under|sealed elder)\b/;

/**
 * Sentences that contain the wake vocabulary and mean something else.
 *
 * "break through the barrier" is the breakthrough branch and reaches this file
 * first, but "I break the seal on the gate" at an inheritance ground is a
 * site sentence and "I raise the admission bar" is a decree, and both would
 * otherwise satisfy the rule above. Vetoed rather than ordered, because each of
 * them satisfies it completely.
 */
export const NOT_THE_SEALED_ANCESTOR =
    /\b(?:barrier|bottleneck|admission|entry bar|the bar\b|curriculum|dawn|morning|from sleep|up early)\b/;

/**
 * The channel, from whichever end the speaker is standing at.
 *
 * `send` is the immortal side of the same pipe `offering` is the mortal side
 * of, and they are one verb on purpose. Somebody below pays a decade of a
 * house's principal and asks; somebody above decides whether to answer and what
 * to send. Two verbs for that would have been two implementations of one
 * relationship, and the half that decides which end you are at is state -
 * `canExistBeyondTheLid` - rather than the word the player used.
 */
export type OfferIntent = 'channel' | 'offering' | 'send';
export const OFFER_INTENTS: readonly OfferIntent[] = ['channel', 'offering', 'send'] as const;
/**
 * Reading what the line is, which costs nothing.
 *
 * An offering is paid out of the principal rather than the interest, so the
 * default here is the same as everywhere else in this section: the read.
 */
export const DEFAULT_OFFER_INTENT: OfferIntent = 'channel';

export const OFFERING_VERBS =
    'make|makes|making|send|sends|sending|offer|offers|offering|give|gives|giving|'
    + 'burn|burns|burning|lay|lays|laying|present|presents|presenting|pay|pays|paying';

export const OFFERING_NOUNS =
    /\b(?:an offering|the offering|offerings|incense|a sacrifice|the sacrifice|tribute to (?:our|the|its) ancestor|rites? (?:to|for) (?:our|the) ancestor)\b/;

/**
 * Who the offering is aimed at, for the phrasings that name the recipient
 * rather than the rite. "I make an offering to our ascended ancestor" is
 * caught by the noun above; "I send word up to the founder" is caught here.
 */
export const ASCENDED_NOUNS =
    /\b(?:ascended ancestor|our ancestor above|the one who crossed|our founder above|above the lid|the far side of the lid|(?:our|the) ascended)\b/;

/**
 * Sending something DOWN, which is the other end of the same pipe.
 *
 * Both halves required, as everywhere in this section. "send" and "down" are
 * each far too ordinary alone - "I send the disciples down to the river" is an
 * errand - so the rule wants a sending verb aimed at the lower world by name.
 */
export const SENDING_DOWN =
    /\b(?:send|sends|sending|drop|drops|dropping|put|puts|putting|pass|passes|passing|reach|reaches|reaching|deliver|delivers)\b[^.!?]*\b(?:down through the lid|through the lid|below the lid|down the line|down the channel|down to (?:the )?(?:province|world below|lower world|mortal world|my |our |them\b))\b/;

/** What is being sent, where the sentence says. Never a gate; carried through. */
export const SENDING_NOUNS =
    /\b(?:a word|word|a message|the message|a warning|an answer|a sword|a blade|a weapon|a pill|a talisman|an object|something|a gift|instructions?)\b/;

// ─── GOING BACK DOWN YOURSELF ─────────────────────────────────────────────
//
// The other of the two answers, and the expensive one. Kept narrow because it
// is the single most dangerous action in the game: nine strikes of the
// heaviest tribulation there is, weathered by somebody who spent a life
// reaching the rung where they could be struck by it. A sentence has to say
// plainly that the speaker is going, and through the Lid, before it reaches
// this - so the whole rule is a movement verb next to the boundary by name.
//
// "I go down" alone is deliberately NOT enough. Below the Lid it means a
// staircase, and a phrasing that means a staircase to almost everybody must
// not end a run for the one player standing above the Lid when they type it.

export const GOING_DOWN_VERBS =
    'go|goes|going|descend|descends|descending|return|returns|returning|come|comes|coming|'
    + 'drop|drops|dropping|step|steps|stepping|force|forces|forcing|open|opens|opening|'
    + 'cross|crosses|crossing|head|heads|heading';

export const THE_WAY_BACK_DOWN =
    // `to the lower world` without a preceding "down" or "into". The pattern
    // carried both of those and not the bare preposition, so "I return to the
    // lower world" reached nothing while "I go down to the lower world" and "I
    // go into the lower world" both worked. There is no second reading of the
    // phrase: below the Lid nobody calls anywhere the lower world, so it needs
    // no anchor beyond itself.
    //
    // Note what is still NOT here, and must not be added: "the mountain",
    // "downhill", or any other slope. This verb crosses the Lid once and ends
    // the run's whole footing, and "I descend the mountain" means a walk to
    // very nearly everybody who types it. See the banner above.
    /\b(?:back down|down through the lid|through the lid|down to the (?:province|world below|lower world|mortal world|world)|(?:in)?to the lower world|below the lid|down myself|down in person|the way i came)\b/;

/**
 * Going down without saying so, in the two phrasings that unmistakably mean it.
 *
 * A verb is not required here because neither phrase has any other reading:
 * nobody says "I descend through the Lid" about a staircase.
 */
export const DESCENT_UNAMBIGUOUS =
    /\b(?:descend(?:s|ing)? (?:through|below|past) the lid|go back down through|force (?:the lid|a hole|an opening) (?:inward|open|down)|open the lid (?:again|a second time))\b/;

/**
 * What is being asked for, in the petitioner's own words.
 *
 * Carried verbatim into the record and shown back in the refusal, which is the
 * entire point of the verb: the Requisition requires the applicant to state
 * what is at stake in terms of the arterial system rather than in terms of
 * themselves, and being refused in the terms you asked in is the interaction.
 * Nothing branches on it.
 */
export function matterAsked(input: string): string | undefined {
    const found = /\b(?:for|about|regarding|concerning)\s+(?:one of\s+|the\s+|a\s+|an\s+|some\s+)?(.{2,120}?)\s*[.!?]?$/i
        .exec(input);
    const cleaned = (found?.[1] ?? '').trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 120) : undefined;
}

/**
 * A party phrase that is not a party.
 *
 * "make an offering to our ascended ancestor" names a recipient and no
 * institution, and handing `ascended ancestor` to a faction matcher would
 * resolve nothing and produce a refusal for a sentence that was perfectly
 * clear. The rule is narrow on purpose: it drops the phrase only where the
 * whole of it is the act's own vocabulary, so "our ancestor at the Pavilion"
 * still carries the Pavilion.
 */
function isTheActItself(phrase: string | undefined): boolean {
    if (!phrase) return true;
    return /^(?:own |our |their |its |the |ascended |sealed |dormant |sleeping )*(?:ancestors?|founders?|line|forebears?|dead|seal|offering|requisition|standing stock|form|application)$/i
        .test(phrase.trim());
}

/**
 * One of the four institutional acts, or null when the sentence is about
 * something else.
 *
 * Ordered narrowest first, and the ordering is load-bearing in two places.
 * ALLIANCE before OFFERING, because `offer` is a verb in both tables and "I
 * offer an alliance" is not a rite. SEAL before OFFERING for the same reason
 * in the other direction: a sentence about an ancestor is not automatically a
 * sentence about incense.
 *
 * Every branch that COMMITS the house is reachable only through an explicit
 * verb plus its noun. There is no phrasing that arrives here vaguely and
 * starts a war, which is the property `DEFAULT_POSTURE_INTENT` exists to keep
 * true on the model path as well.
 */
export function institutionalAct(text: string, input: string): PlannedAction | null {
    // ── war ──
    //
    // The declaration verb has to be in verb position. Without that, "what do
    // I know of the war with the Nine Abyss" satisfies the noun rule
    // completely and would be answered by starting one.
    if (usedAsVerb(text, DECLARE_VERBS) && WAR_NOUN.test(text)) {
        const on = partyAfter(input, 'war (?:on|against|upon|with)|against|on');
        return { action: 'posture', intent: 'war', ...(on ? { target: on } : {}) };
    }

    // ── alliance ──
    if (usedAsVerb(text, ALLIANCE_VERBS) && ALLIANCE_NOUNS.test(text)) {
        const to = partyAfter(input, 'alliance (?:to|with)|allied? with|ally with|pact with|cause with|terms with|to|with');
        return { action: 'posture', intent: 'alliance', ...(to ? { target: to } : {}) };
    }

    // ── a levy, or a threat wearing one ──
    if (usedAsVerb(text, TRIBUTE_VERBS) && TRIBUTE_NOUNS.test(text)) {
        const from = partyAfter(input, 'tribute from|levy on|dues from|tithe from|from|on|of');
        return { action: 'posture', intent: 'tribute', ...(from ? { target: from } : {}) };
    }

    // ── defection ──
    //
    // The pattern carries its own destination requirement, so "I defect" alone
    // falls through to `sect`, which owns the word and reads it as a member
    // walking out. Changing who a HOUSE holds from is a different act by a
    // different person and must not be reached by the resignation phrasing.
    if (DEFECT_PATTERN.test(text)) {
        const to = partyAfter(input, 'defect(?:s|ing)? to|go(?:es|ing)? over to|went over to|under|to');
        if (to) return { action: 'posture', intent: 'defect', target: to };
    }

    // ── the thing under the mountain ──
    //
    // Whose mountain it is is NOT read off the sentence. A player who names
    // nobody meant their own house and one who names a house meant that one,
    // and which of those is a decision and which is theft is decided by the
    // membership row in `game.ts`. Reading it here would let a phrasing choose
    // between a legal act and a crime.
    if (usedAsVerb(text, WAKE_VERBS)
        && SEALED_NOUNS.test(text)
        && !NOT_THE_SEALED_ANCESTOR.test(text)) {
        const named = partyAfter(input, 'seal (?:at|of|under|beneath)|ancestor (?:at|of|under|beneath)|at|beneath|under');
        const whose = isTheActItself(named) ? undefined : named;
        return { action: 'seal', intent: 'wake', ...(whose ? { target: whose } : {}) };
    }

    // ── going back down, which is the most expensive sentence in the game ──
    //
    // Ahead of the sending rule, because "I go back down and put a sword in
    // front of them" is somebody going, and above `move`, which owns every
    // other way of getting anywhere and would answer this by walking.
    if (DESCENT_UNAMBIGUOUS.test(text)
        || (usedAsVerb(text, GOING_DOWN_VERBS) && THE_WAY_BACK_DOWN.test(text))) {
        // "myself" and "in person" are what distinguishes this sentence from
        // the proxy one; they are not part of the destination, and handing them
        // to a place matcher resolves nothing.
        const where = partyAfter(input, 'down to|back to|down at|to the|at the|to')
            ?.replace(/\s+(?:myself|in person|personally|alone)$/i, '')
            .trim();
        return {
            action: 'descend',
            ...(where && where.length >= 2 && !isTheActItself(where) ? { target: where } : {})
        };
    }

    // ── the other end of the channel: sending something down ──
    if (SENDING_DOWN.test(text)) {
        const to = partyAfter(input, 'to my|to the|to our|down to|reach');
        return {
            action: 'offer',
            intent: 'send',
            ...(to && !isTheActItself(to) ? { target: to } : {}),
            ...(matterAsked(input) ? { topic: matterAsked(input) as string } : {})
        };
    }

    // ── the offering, and the reading of a silence ──
    if (usedAsVerb(text, OFFERING_VERBS)
        && (OFFERING_NOUNS.test(text) || ASCENDED_NOUNS.test(text))) {
        const named = partyAfter(input, 'offering to|sacrifice to|incense to|rites to|up to|to');
        const to = isTheActItself(named) ? undefined : named;
        return { action: 'offer', intent: 'offering', ...(to ? { target: to } : {}) };
    }

    // ── the form, by name ──
    //
    // `requisition` needs no verb: nothing else in the setting uses the word,
    // and a player who has heard it has heard it from somebody describing
    // exactly this. Everything else needs the verb and the thing.
    //
    // `against` is deliberately not a party marker here. The form's own name
    // is "a Requisition Against Standing Stock", so reading a party out of it
    // resolved the sentence to an institution called "Standing Stock" - which
    // is the shape of every bug this parser has produced, a phrase matched in
    // the wrong role and answered confidently.
    if (REQUISITION_NAMED.test(text)
        || (usedAsVerb(text, `${PETITION_VERBS}|${PETITION_ASKING_VERBS}`)
            && (STANDING_STOCK_NOUNS.test(text) || IMMORTAL_ITEM_NAMED.test(text)))) {
        const named = partyAfter(
            input,
            `(?:${PETITION_ASKING_VERBS})|(?:with|to|at|of|before) the`
        );
        const of = isTheActItself(named) ? undefined : named;
        const matter = matterAsked(input);
        return {
            action: 'petition',
            intent: 'stock',
            ...(of ? { target: of } : {}),
            ...(matter ? { topic: matter } : {})
        };
    }

    // ── a claim of descent ──
    if (usedAsVerb(text, DESCENT_VERBS) && DESCENT_NOUNS.test(text)) {
        const from = partyAfter(input, 'descent from|descended from|descend from|line of|blood of|kinship (?:to|with)|from');
        return { action: 'petition', intent: 'descent', ...(from ? { target: from } : {}) };
    }

    // ── everything else that goes upward ──
    //
    // Vetoed by the joining vocabulary, which is the other half of the `apply`
    // lesson above: "I apply to the Pavilion", "I ask them to take me on" and
    // "I want to be admitted" are all sentences about membership, and every one
    // of them satisfies a petition rule completely.
    if ((usedAsVerb(text, PETITION_VERBS_ALONE)
        || (usedAsVerb(text, PETITION_VERBS) && PETITION_NOUNS.test(text))
        // The asking verbs, which need the institution as well as the thing.
        // See {@link AN_INSTITUTION_IS_BEING_ASKED}: without it "I ask him for
        // the manual" was a petition, and asking a PERSON for something is the
        // one route this game has to being taught by one.
        || (usedAsVerb(text, PETITION_ASKING_VERBS)
            && PETITION_NOUNS.test(text)
            && AN_INSTITUTION_IS_BEING_ASKED.test(text)))
        && !ASKING_TO_BE_TAKEN_IN.test(text)) {
        const of = partyAfter(
            input,
            `(?:${PETITION_VERBS})|(?:${PETITION_ASKING_VERBS})|to|at`
        );
        const matter = matterAsked(input);
        return {
            action: 'petition',
            intent: 'grant',
            ...(of ? { target: of } : {}),
            ...(matter ? { topic: matter } : {})
        };
    }

    return null;
}
