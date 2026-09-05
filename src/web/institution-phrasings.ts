/**
 * Institutions acting on each other, and on the dead.
 */

import { PlannedAction } from './planned-action.js';
import { IMMORTAL_ITEMS } from '../data/cultivation/immortal-items.js';
import { usedAsVerb, partyAfter } from './sentence-parts.js';
import { ASKING_TO_BE_TAKEN_IN } from './sect-phrasings.js';

// INSTITUTIONS ACTING ON EACH OTHER, AND ON THE DEAD

/** Which form is being filed. Selects a read; never decides an outcome. */
export type PetitionIntent = 'grant' | 'stock' | 'descent';
export const PETITION_INTENTS: readonly PetitionIntent[] = ['grant', 'stock', 'descent'] as const;
/** The cheapest and widest: send it up the chain and see how far it goes. */
export const DEFAULT_PETITION_INTENT: PetitionIntent = 'grant';

/**
 * The verbs that mean this on their own.
 */
export const PETITION_VERBS_ALONE =
    'petition|petitions|petitioning|appeal|appeals|appealing';

/**
 * The verbs that mean this only with the thing being asked for.
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
 */
export const AN_INSTITUTION_IS_BEING_ASKED =
    /\b(?:sects?|houses?|clans?|orders?|schools?|halls?|courts?|pavilions?|councils?|elders?|the (?:seat|body|institution|administration|registry)|my house|our house|the family|patriarch|matriarch|hall master|sect master|head of the)\b/;

/**
 * The form, by name and by shape.
 */
export const REQUISITION_NAMED = /\brequisitions?\b/;

/**
 * The objects themselves, by name, generated from the catalog.
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
    // `peace with` and `truce` were missing, and "I make peace with the Azure Dew
    // Sect" is the plainest sentence in this whole block - `make` was already a
    // declaration verb, so the only thing standing between that sentence and the
    // verb it wants was the noun. Both require their preposition, which keeps them
    // off "the region is at peace" and off anybody merely describing a standing.
    /\b(?:alliance|alliances|allied|a pact|the pact|a league|common cause|mutual defence|mutual defense|terms with|peace with (?!it\b|them\b|him\b|her\b|that\b|this\b|myself\b)|peace between|truce with (?!it\b|them\b|him\b|her\b|that\b|this\b)|a truce)\b/;

/**
 * Changing who the house holds from, which two courts in the catalog's own history
 * have already done.
 */
/**
 * Demanding a payment from somebody, which is only a demand if you hold something
 * over them.
 */
export const TRIBUTE_VERBS =
    'demand|demands|demanding|levy|levies|levying|require|requires|requiring|'
    + 'exact|exacts|exacting|collect|collects|collecting|call in|calls in';

export const TRIBUTE_NOUNS =
    /\b(?:tribute|a levy|the levy|dues|a tithe|the tithe|their (?:grant|stones|contribution)|what (?:they|it) owes?)\b/;

/**
 * Where a house stands with another, which is the READ and the default posture
 * intent - and had no phrasing, so the only reachable postures were the four
 * that CHANGE something. A subsystem you can only act on and never look at is
 * a subsystem nobody will use twice.
 */
export const WHERE_WE_STAND =
    new RegExp([
        String.raw`\bwhere (?:do |does )?(?:we|my house|our house|the (?:house|sect|clan|order|school)|it) stand\b`,
        String.raw`\bhow (?:do|does) (?:we|my house|our house|the (?:house|sect|clan|order|school)|it) stand\b`,
        String.raw`\b(?:our|my house'?s?|the house'?s?) (?:standing|posture|relations?|terms) with\b`,
        String.raw`\bwho (?:are|is) (?:we|my house|our house) (?:at war with|allied (?:to|with)|holding from)\b`,
        String.raw`\bare we (?:at war|allied|at peace)\b`
    ].join('|'), 'i');

export const DEFECT_PATTERN =
    /\b(?:defect(?:s|ing)? to|go(?:es|ing)? over to|went over to|transfer (?:our|the house'?s?|its|the) (?:allegiance|grant|patronage|standing)|change (?:our |the house'?s? )?patrons?|hold from|swear the (?:house|sect|clan|school) to|put (?:us|the house|the sect) under)\b/;

/** The seal. Selects a read; never decides an outcome, and never whose it is. */
export type SealIntent = 'read' | 'wake';
export const SEAL_INTENTS: readonly SealIntent[] = ['read', 'wake'] as const;
/**
 * The priced read, and it must stay the default.
 */
export const DEFAULT_SEAL_INTENT: SealIntent = 'read';

/**
 * Reading a seal rather than breaking it, which is the PRICED half and the
 * default intent - and had no phrasing, so the whole subsystem could only be
 * reached by the one sentence that opens it. "I read the seal" reached
 * `investigate`, which is a look at a thing and knows nothing about what is
 * under a mountain.
 */
export const SEAL_READ_VERBS =
    'read|reads|reading|study|studies|studying|examine|examines|examining|'
    + 'inspect|inspects|inspecting|look at|looks at|looking at|'
    + 'measure|measures|measuring|check|checks|checking';

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
 */
export const NOT_THE_SEALED_ANCESTOR =
    /\b(?:barrier|bottleneck|admission|entry bar|the bar\b|curriculum|dawn|morning|from sleep|up early)\b/;

/**
 * The channel, from whichever end the speaker is standing at.
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
 */
export const SENDING_DOWN =
    /\b(?:send|sends|sending|drop|drops|dropping|put|puts|putting|pass|passes|passing|reach|reaches|reaching|deliver|delivers)\b[^.!?]*\b(?:down through the lid|through the lid|below the lid|down the line|down the channel|down to (?:the )?(?:province|world below|lower world|mortal world|my |our |them\b))\b/;

/** What is being sent, where the sentence says. Never a gate; carried through. */
export const SENDING_NOUNS =
    /\b(?:a word|word|a message|the message|a warning|an answer|a sword|a blade|a weapon|a pill|a talisman|an object|something|a gift|instructions?)\b/;

// GOING BACK DOWN YOURSELF

export const GOING_DOWN_VERBS =
    'go|goes|going|descend|descends|descending|return|returns|returning|come|comes|coming|'
    + 'drop|drops|dropping|step|steps|stepping|force|forces|forcing|open|opens|opening|'
    + 'cross|crosses|crossing|head|heads|heading';

export const THE_WAY_BACK_DOWN =
    // `to the lower world` without a preceding "down" or "into". The pattern
    // carried both of those and not the bare preposition, so "I return to the lower
    // world" reached nothing while "I go down to the lower world" and "I go into
    // the lower world" both worked. There is no second reading of the phrase: below
    // the Lid nobody calls anywhere the lower world, so it needs no anchor beyond
    // itself.
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
 */
export function matterAsked(input: string): string | undefined {
    const found = /\b(?:for|about|regarding|concerning)\s+(?:one of\s+|the\s+|a\s+|an\s+|some\s+)?(.{2,120}?)\s*[.!?]?$/i
        .exec(input);
    const cleaned = (found?.[1] ?? '').trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 120) : undefined;
}

/**
 * A party phrase that is not a party.
 */
function isTheActItself(phrase: string | undefined): boolean {
    if (!phrase) return true;
    return /^(?:own |our |their |its |the |ascended |sealed |dormant |sleeping )*(?:ancestors?|founders?|line|forebears?|dead|seal|offering|requisition|standing stock|form|application)$/i
        .test(phrase.trim());
}

/**
 * One of the four institutional acts, or null when the sentence is about something
 * else.
 */
export function institutionalAct(text: string, input: string): PlannedAction | null {
    // ── where we stand ──
    //
    // The READ first, and that ORDER is the point: "are we at war with the Iron
    // Gate" is a question and "I declare war on the Iron Gate" is an act, and
    // the two share every noun. Getting them the wrong way round starts a war
    // by answering a question.
    if (WHERE_WE_STAND.test(text)) {
        const withWhom = partyAfter(input, 'stand with|standing with|posture with|relations with|terms with|at war with|allied to|allied with|holding from|with');
        return {
            action: 'posture',
            intent: 'stance',
            ...(withWhom ? { target: withWhom } : {})
        };
    }

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

    // ── reading a seal, before breaking one ──
    //
    // Same order and same reason as the stance read above: `open` is on both
    // verb lists, so the reading has to be asked first or every look at a seal
    // is an opening of it.
    if (usedAsVerb(text, SEAL_READ_VERBS)
        && SEALED_NOUNS.test(text)
        && !NOT_THE_SEALED_ANCESTOR.test(text)) {
        const named = partyAfter(input, 'seal (?:at|of|under|beneath)|ancestor (?:at|of|under|beneath)|at|beneath|under');
        const whose = isTheActItself(named) ? undefined : named;
        return { action: 'seal', intent: 'read', ...(whose ? { target: whose } : {}) };
    }

    // the thing under the mountain
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

    // the form, by name
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
