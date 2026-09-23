/**
 * The words a player sends word on a communication talisman with, and cuts them
 * with. Pure reads of a sentence, kept apart from the verbs so the pattern table
 * can ask them without importing the game. The verbs are
 * `sending-word-on-a-communication-talisman.ts`.
 */

import { CUT_IN_A_SITTING } from '../data/cultivation/communication-talismans.js';

/** The ways a player names the slip. The engine's word, and the genre's others. */
const THE_SLIP =
    '(?:(?:sound\\s+)?(?:communication|transmission|message|messaging|voice)\\s+(?:talismans?|slips?|charms?))';

const BURNING = '(?:burn|burns|burning|burnt|burned|use|uses|using|crush|crushes|crushing|light|lights|lighting|activate|activates|tear|tears|break|breaks|breaking|broke|snap|snaps|snapping)';

const TO_SAY = '(?:tell|tells|inform|informs|let|lets|send\\s+word\\s+to|send\\s+a\\s+message\\s+to|message|warn|warns|report\\s+to|reports\\s+to|reach|contact)';

/** Where the target stops and the message starts. */
const THE_BREAK = /\s+(?:that|about|to\s+say|saying)\s+|\s*[:,;]\s*|\s+-\s+/i;

const SLIP_FIRST = new RegExp(
    `\\b${BURNING}\\s+(?:a|an|one|my|the|a\\s+single)?\\s*${THE_SLIP}\\s+(?:and\\s+|to\\s+)?${TO_SAY}\\s+(.+)$`, 'i');

/**
 * Breaking one and saying nothing about who or what.
 *
 * "I break the talisman" is how anybody says this act, and it reached `destroy`
 * - which ENDED the slip and sent nothing, the one outcome the player cannot
 * recover from and did not ask for. Measured on the mechanics sweep.
 *
 * A BARE `talisman` IS ADMITTED HERE AND NOWHERE ELSE. {@link THE_SLIP} wants
 * the qualifier ("communication talisman") because the word alone covers every
 * other talisman in the game; what makes it safe in this one shape is the verb
 * - a talisman somebody BURNS or BREAKS is a slip being used, whatever else the
 * word can mean, because that is what using one is.
 *
 * It names nobody, which is the point: the handler answers with who this
 * cultivator could send to and asks what to say. That is a question the engine
 * can answer, and destroying the slip is not.
 */
const THE_SLIP_AND_NOTHING_ELSE = new RegExp(
    `^\\s*(?:i\\s+)?(?:${BURNING}|speak\\s+into|speaks\\s+into|speaking\\s+into|talk\\s+into)`
    + `\\s+(?:a|an|one|my|the|a\\s+single)?\\s*`
    // THE JADE IS HERE TOO, and it is the half of the pair that needs no
    // qualifier at all: a jade is a jade. The owner's ruling is that holding
    // one names its partner - a pair has exactly one other half by
    // construction - so a sentence that names no person is not ambiguous and
    // the handler resolves it. A house slip is different precisely because it
    // goes to a hall.
    + `(?:${THE_SLIP}|talismans?|slips?|jades?|(?:communication|sound)\\s+jades?|jade\\s+halves?)`
    + `\\s*[.!?]*$`,
    'i'
);

const WORD_FIRST =
    /\b(?:send|sends|sending)\s+(?:word|a\s+message|a\s+report|a\s+warning|news)\s+(?:back\s+)?(?:(?:to|home\s+to)\s+(.+)|(home)\b(.*))$/i;

/**
 * Reporting back, which is sending word and has never been anything else.
 *
 * The owner's ruling about how word gets home is the slip: a communication
 * talisman to the house. Somebody standing at a post who types "I report back"
 * is doing exactly that, and it reached nothing.
 *
 * WHO IT GOES TO IS THE HOUSE unless the sentence says otherwise, which is the
 * same default `send word home` already has - and it is spelt the same way,
 * `my sect`, so one resolver answers both.
 */
const REPORTING_BACK =
    /^\s*(?:i\s+)?report(?:s|ing)?\s+(?:back|in)(?:\s+(?:to|home\s+to)\s+(.+))?\s*[.!?]*$/i;

/** What a sentence sending word names: who it is for, and what it says. */
export interface WordBeingSent {
    to: string;
    says: string;
}

/**
 * Read a sentence that sends word, or null for one that does not.
 *
 * A sentence that burns one of the slips, or that sends word or a message to
 * somebody. The second is always this: in this world word at a distance goes
 * on a slip or on foot, and on foot is travel.
 */
export function whatWordIsBeingSent(input: string): WordBeingSent | null {
    const text = input.trim().replace(/[.!]+$/, '');
    // Breaking one and naming nobody. Empty on both halves, which is what the
    // handler's own refusal is written for - it names who could be reached and
    // asks what to say. See {@link THE_SLIP_AND_NOTHING_ELSE}.
    if (THE_SLIP_AND_NOTHING_ELSE.test(input.trim())) return { to: '', says: '' };
    // Reporting back: the house unless the sentence names somebody else.
    const reporting = REPORTING_BACK.exec(input.trim());
    if (reporting) return { to: (reporting[1] ?? 'my sect').trim(), says: '' };
    const slip = SLIP_FIRST.exec(text);
    const word = slip === null ? WORD_FIRST.exec(text) : null;
    const rest = slip !== null
        ? slip[1]
        : word === null ? null
        : word[2] !== undefined ? `my sect${word[3] ?? ''}` : word[1];
    if (rest === undefined || rest === null) return null;
    const cut = THE_BREAK.exec(rest);
    const to = (cut === null ? rest : rest.slice(0, cut.index)).trim();
    const says = cut === null ? '' : rest.slice(cut.index + cut[0].length).trim();
    if (to.length === 0) return null;
    return { to: to.replace(/^know\s+/i, ''), says };
}

const COUNT_WORDS: Readonly<Record<string, number>> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    twelve: 12, 'a dozen': 12, 'a few': CUT_IN_A_SITTING, some: CUT_IN_A_SITTING,
    several: CUT_IN_A_SITTING, 'a stack of': CUT_IN_A_SITTING, 'a handful of': CUT_IN_A_SITTING
};

const CUTTING = new RegExp(
    '\\b(?:make|makes|making|cut|cuts|cutting|craft|crafts|crafting|inscribe|inscribes|inscribing|'
    + 'draw\\s+up|write\\s+out|prepare|prepares|preparing)\\s+(?:me\\s+|myself\\s+|us\\s+|up\\s+)?'
    + `((?:(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|a dozen|a few|some|several|a stack of|a handful of)\\s+)?(?:more\\s+)?${THE_SLIP}.*)$`,
    'i'
);

/**
 * Taking the house's notice for the work, which is a duty and not a sitting at
 * the bench: "I take the cutting communication talismans", "I put my name down
 * for cutting communication talismans". The notice's own name has the verb in it.
 */
const TAKING_THE_NOTICE =
    /\b(?:take|takes|taking|took|accept|accepts|accepting|put my name down for|sign up for|sign on for)\b[^.!?]*\bcutting\b/i;

/** Whether a sentence is taking the house's notice for cutting, rather than cutting. */
export function theCuttingNoticeIsBeingTaken(input: string): boolean {
    return TAKING_THE_NOTICE.test(input) && new RegExp(THE_SLIP, 'i').test(input);
}

/** The words after the verb, when a sentence is cutting communication talismans. */
export function communicationTalismansBeingCutIn(input: string): string | null {
    if (TAKING_THE_NOTICE.test(input)) return null;
    const m = CUTTING.exec(input.trim().replace(/[.!]+$/, ''));
    return m ? m[1]!.trim() : null;
}

/** How many, and whether for the house, off the words after the verb. */
export function whatIsBeingCut(said: string): { count: number; forTheHouse: boolean } | null {
    const text = said.toLowerCase().trim();
    if (!new RegExp(THE_SLIP, 'i').test(text)) return null;
    const lead = /^(\d+|a dozen|a few|a stack of|a handful of|one|two|three|four|five|six|seven|eight|nine|ten|twelve|some|several|an?)\s+/.exec(text);
    const count = lead === null ? CUT_IN_A_SITTING
        : /^\d+$/.test(lead[1]!) ? Math.max(1, Math.min(99, Number(lead[1])))
        : lead[1] === 'a' || lead[1] === 'an' ? 1
        : COUNT_WORDS[lead[1]!] ?? CUT_IN_A_SITTING;
    const forTheHouse = /\bfor\s+(?:the|my|our)\s+(?:sect|house|hall|clan|family|stores?|treasury|elders?)\b/.test(text);
    return { count, forTheHouse };
}

