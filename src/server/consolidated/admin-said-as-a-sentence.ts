/**
 * ADMIN, typed the way a person actually types it.
 */

import { REALM_TIERS, MAX_ORDINAL, realmForOrdinal } from '../../engine/cultivation/realms.js';

// ═══════════════════════════════════════════════════════════════════════════
// SUBJECTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The kinds of thing an operator asks for, and which action serves each.
 */
interface Subject {
    action: string;
    /** Where a bare number in the sentence goes. */
    ordinalKey: 'ordinal';
    /**
     * Where leftover words go, when the subject takes a name at all.
     */
    nameKey: 'name' | null;
    words: readonly string[];
    /** Extra fixed arguments this subject implies. */
    fixed?: Record<string, string>;
}

const SUBJECTS: readonly Subject[] = [
    {
        // A person to stand in front of you. `spawn_encounter` has always done
        // this; the fuzzy matcher offered it at 33% and lost to `spawn_site`.
        action: 'spawn_encounter',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        // "immortal" is deliberately NOT here. It is a realm the ladder knows
        // by name, so `ordinalNamed` already reads it as a rung, and having it
        // be a subject word as well would make "a 45 immortal weapon" name two
        // subjects and refuse a sentence that is perfectly clear.
        words: [
            'npc', 'cultivator', 'enemy', 'opponent', 'person', 'someone',
            'somebody', 'transcender', 'elder', 'bandit', 'guy',
            'fighter', 'attacker', 'foe',
            // `SPAWN A CORE FORMATION GIRL` was refused, and it is the plainest
            // sentence anybody sent. A person is a person however they are
            // described; see `PERSON_DESCRIBED_AS` for what the description can
            // and cannot reach.
            'girl', 'woman', 'lady', 'boy', 'man', 'fellow', 'youth', 'child'
        ]
    },
    {
        // A thing to carry. The owner's "a 45 weapon" - and the reason a weapon
        // is a `grant_item` rather than an action of its own is that the pouch
        // is where everything a person carries already lives.
        action: 'grant_item',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: [
            'weapon', 'artifact', 'blade', 'sword', 'sabre', 'spear', 'object',
            'treasure', 'item', 'relic'
        ],
        fixed: { kind: 'artifact' }
    },
    {
        action: 'grant_item',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: ['pill', 'medicine', 'elixir'],
        fixed: { kind: 'pill' }
    },
    {
        action: 'grant_item',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: ['herb', 'ingredient', 'plant'],
        fixed: { kind: 'herb' }
    },
    {
        action: 'spawn_site',
        ordinalKey: 'ordinal',
        nameKey: 'name',
        words: ['grave', 'tomb', 'trial', 'site', 'cave', 'ruin', 'inheritance']
    },
    {
        // "give me knowledge of every sect", "I know every location". One
        // subject rather than two, because a line naming both knowledge AND a
        // register is one request and splitting it would refuse the plainest
        // way of saying it. Which register is read off the same words below.
        action: 'grant_knowledge',
        ordinalKey: 'ordinal',
        nameKey: null,
        words: [
            'knowledge', 'locations', 'location', 'sects', 'sect', 'houses',
            'house', 'places', 'names'
        ]
    }
];

/** Which register a knowledge sentence named, when it named one. */
const KNOWLEDGE_REGISTER: ReadonlyArray<[string, 'place' | 'sect']> = [
    ['sects', 'sect'], ['sect', 'sect'], ['houses', 'sect'], ['house', 'sect'],
    ['locations', 'place'], ['location', 'place'], ['places', 'place']
];

/**
 * The words that mean "me", and the lowest-priority subject there is.
 */
const SELF = new Set(['i', 'me', 'my', 'myself', 'im', 'self']);

/**
 * Nouns that describe a person rather than name a role, and what they reach.
 */
const PERSON_DESCRIBED_AS = new Set([
    'girl', 'woman', 'lady', 'boy', 'man', 'fellow', 'youth', 'child', 'elder'
]);

/**
 * Words that carry no subject and no argument, stripped before what is left is read
 * as a name.
 */
const NOISE = new Set([
    'a', 'an', 'the', 'me', 'my', 'i', 'in', 'front', 'of', 'to', 'at', 'on',
    'here', 'there', 'with', 'and', 'for', 'into', 'onto', 'up', 'please',
    'spawn', 'give', 'grant', 'put', 'make', 'add', 'run', 'find', 'get',
    'want', 'need', 'place', 'summon', 'create', 'drop', 'hand', 'bring',
    'is', 'am', 'be', 'it', 'that', 'this', 'some', 'stage',
    // A GRANT HAS NO HOLDER ARGUMENT, SO A PRONOUN IS NEVER PART OF A NAME. "give
    // myself chaos healing pill" read as `name=myself chaos healing`, and then
    // nothing in three catalogs answered to it. `me`, `my` and `i` were already
    // here; the reflexives and the plurals were not, which is the whole of why one
    // spelling worked and its nearest neighbour did not - the failing half being
    // the more natural sentence, exactly as `AGENTS.md` says it usually is.
    'myself', 'mine', 'us', 'our', 'ourselves', 'player',
    // And the word that qualifies a grade rather than naming anything. "a
    // chaos GRADE tribulation pill" carried it into the name, where it
    // matched no row and pulled a resolvable description under the bar.
    'grade', 'graded', 'grades', 'tier', 'rated', 'level'
]);

// ═══════════════════════════════════════════════════════════════════════════
// THE RUNG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The ordinal a phrase names, or null.
 */
export function ordinalNamed(
    phrase: string
): { ordinal: number; how: string; /** The words that named it, for stripping. */ words: string[] } | null {
    const line = phrase.toLowerCase();

    const bare = /(?:^|\s)(\d{1,2})(?=\s|$)/.exec(line);
    if (bare) {
        const n = Number(bare[1]);
        if (n >= 0 && n <= MAX_ORDINAL) {
            return { ordinal: n, how: `the number ${n} in the sentence`, words: [bare[1]] };
        }
    }

    // Longest realm name first, so "Tribulation Transcendence" is not shadowed.
    const tiers = [...REALM_TIERS].sort((a, b) => b.name.length - a.name.length);

    // THE MOST SPECIFIC READING FIRST
    for (const tier of tiers) {
        for (let i = 0; i < tier.subRanks.length; i++) {
            const sub = tier.subRanks[i].toLowerCase();
            if (sub.length >= 3 && line.includes(`${tier.name.toLowerCase()} ${sub}`)) {
                return {
                    ordinal: tier.ordinalStart + i,
                    how: `"${tier.name} ${tier.subRanks[i]}" is ordinal ${tier.ordinalStart + i}`,
                    words: `${tier.name} ${tier.subRanks[i]}`.toLowerCase().split(/\s+/)
                };
            }
        }
    }

    // THE SHORTHAND PEOPLE ACTUALLY TYPE
    for (const tier of tiers) {
        const initials = tier.name.split(/\s+/).map(w => w[0]).join('').toLowerCase();
        if (initials.length >= 2 && new RegExp(`(?:^|\\s)${initials}(?=\\s|$)`).test(line)) {
            return {
                ordinal: tier.ordinalStart,
                how: `"${initials.toUpperCase()}" is the shorthand for ${tier.name}, ordinals ` +
                    `${tier.ordinalStart}-${tier.ordinalEnd}; the first rung of the band was taken. ` +
                    'Say a number for any other rung.',
                words: [initials]
            };
        }
    }

    for (const tier of tiers) {
        // "Transcendence" and "Transcender" and "Transcending" are the same
        // word to an operator. Match on the stem the realm name actually has.
        const stem = tier.name.toLowerCase().replace(/(ence|ance|ion|ing)$/, '');
        if (stem.length >= 4 && line.includes(stem)) {
            return {
                ordinal: tier.ordinalStart,
                how: `"${tier.name}" names ordinals ${tier.ordinalStart}-${tier.ordinalEnd}; ` +
                    'the first rung of the band was taken, because a realm named without a rung ' +
                    'is the weakest reading of it. Say a number for any other rung.',
                words: tier.name.toLowerCase().split(/\s+/)
            };
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE READING
// ═══════════════════════════════════════════════════════════════════════════

export interface SentenceReading {
    /** The action to route to. */
    action: string;
    /** Arguments, all strings, to be merged over the parsed `key=value` pairs. */
    args: Record<string, string | number>;
    /**
     * The equivalent command line, printed back to the operator so the guess is
     * visible. This is the whole reason inference is allowed here.
     */
    asTyped: string;
    /** Why each part was read the way it was. For the response, never a claim. */
    because: string[];
}

export interface SentenceRefusal {
    /** Nothing in the line said what kind of thing was wanted. */
    reason: 'no_subject' | 'two_subjects' | 'a_change_not_a_creation';
    /** The subjects that collided, when two did. */
    collided: string[];
}

/**
 * Verbs that mean CHANGE SOMETHING THAT IS ALREADY THERE.
 */
const A_CHANGE_RATHER_THAN_A_CREATION = new Set([
    'set', 'change', 'modify', 'edit', 'update', 'alter', 'turn', 'convert',
    'rename', 'retitle', 'adjust', 'fix'
]);

/**
 * Read an ADMIN line that did not begin with an action.
 */
export function readAdminSentence(line: string): SentenceReading | SentenceRefusal | null {
    const clean = line.trim();
    if (clean.length === 0) return null;

    const words = clean.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0);
    if (words.length === 0) return null;

    // ── Which subject. Two different ones is a refusal, not a tie-break. ──
    const found: Subject[] = [];
    for (const subject of SUBJECTS) {
        if (subject.words.some(word => words.includes(word))) found.push(subject);
    }
    const distinct = [...new Set(found.map(s => `${s.action}${s.fixed?.kind ? `:${s.fixed.kind}` : ''}`))];

    // A CHANGE IS NOT A CREATION, WHATEVER NOUN IS IN THE LINE
    if (found.length > 0 && A_CHANGE_RATHER_THAN_A_CREATION.has(words[0])) {
        return { reason: 'a_change_not_a_creation', collided: distinct };
    }

    // ── THE SELF, when nothing else was named. ────────────────────────────
    if (found.length === 0) {
        const rung = ordinalNamed(clean);
        if (rung !== null && words.some(w => SELF.has(w))) {
            return {
                action: 'set_realm',
                args: { ordinal: rung.ordinal },
                asTyped: `set_realm ordinal=${rung.ordinal}`,
                because: [
                    'the sentence is about you and names a rung, and nothing else in it named a ' +
                    'kind of thing',
                    rung.how,
                    'set_realm goes through advanceRealm like every other rank change: the peak is ' +
                    'stamped, accumulated progress is cleared, the stagnation clock restarts. No ' +
                    'breakthrough was rolled and none is claimed.'
                ]
            };
        }
        return { reason: 'no_subject', collided: [] };
    }
    if (distinct.length > 1) return { reason: 'two_subjects', collided: distinct };

    const subject = found[0];
    const because: string[] = [];
    const args: Record<string, string | number> = { ...(subject.fixed ?? {}) };

    const matchedWords = new Set(subject.words.filter(word => words.includes(word)));
    because.push(
        `"${[...matchedWords].join('", "')}" is a ${subject.action.replace(/_/g, ' ')} subject`
    );

    // ── Which register, for a knowledge sentence. ─────────────────────────
    if (subject.action === 'grant_knowledge') {
        const register = KNOWLEDGE_REGISTER.find(([word]) => matchedWords.has(word));
        if (register) {
            args.kind = register[1];
            because.push(`"${register[0]}" names the ${register[1]} register`);
        }
    }

    // ── The rung. ─────────────────────────────────────────────────────────
    const rung = ordinalNamed(clean);
    if (rung) {
        args[subject.ordinalKey] = rung.ordinal;
        because.push(rung.how);
    }

    // ── The name, out of whatever is left. ────────────────────────────────
    //
    // Everything that was a subject word, a noise word, or the number already
    // read is removed. What survives is a name somebody typed on purpose, and
    // an empty remainder is correct rather than a failure: "spawn an NPC at 41"
    // has no name in it and the action defaults one.
    if (subject.nameKey !== null) {
        // THE WORDS THAT NAMED THE RUNG ARE NOT ALSO A NAME. "spawn NPC tribulation
        // transcender" was giving `name=tribulation`, because "transcender" was
        // removed as a subject word and "tribulation" was not - so half of a realm
        // name survived into what the world would call the person. `ordinalNamed`
        // reports the words it matched on and they are struck out here, which is
        // the general fix rather than one more word in the noise list.
        const rungWords = new Set(rung?.words ?? []);
        const rest = clean
            .split(/\s+/)
            .filter(raw => {
                const w = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (w.length === 0) return false;
                if (NOISE.has(w)) return false;
                if (matchedWords.has(w)) return false;
                if (rungWords.has(w)) return false;
                if (/^\d+$/.test(w)) return false;
                return true;
            })
            .join(' ')
            .trim();
        // A realm name that was already read as the rung is not also a name.
        const namedRung = rung !== null && ordinalNamed(rest) !== null;
        if (rest.length > 0 && !namedRung) {
            args[subject.nameKey] = rest;
            because.push(`what was left of the line - "${rest}" - was read as ${subject.nameKey}=`);
        } else if (subject.action === 'spawn_encounter') {
            // Nothing was left to be a name, but the noun that was used may
            // still describe who is standing there. `A Core Formation girl` is
            // the operator's own word carried through to what the world calls
            // her - not a field, because there is no field.
            const described = [...matchedWords].find(w => PERSON_DESCRIBED_AS.has(w));
            if (described && rung !== null) {
                args[subject.nameKey] = `A ${realmForOrdinal(rung.ordinal).name} ${described}`;
                because.push(
                    `"${described}" describes the person rather than naming them, so it became the ` +
                    'name. THE ENGINE HAS NO SEX FIELD on a cultivator, so nothing else about them ' +
                    'differs - the spirit root and the attributes are rolled from the run seed either way.'
                );
            }
        }
    }

    const asTyped = [
        subject.action,
        ...Object.entries(args).map(([key, value]) => `${key}=${value}`)
    ].join(' ');

    return { action: subject.action, args, asTyped, because };
}

/** True when a refusal came back rather than a reading. */
export function isSentenceRefusal(
    value: SentenceReading | SentenceRefusal | null
): value is SentenceRefusal {
    return value !== null && 'reason' in value;
}
