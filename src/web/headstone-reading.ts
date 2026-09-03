/**
 * What the outside of a grave tells anybody who stops and reads it.
 *
 * ── THE OWNER'S QUESTIONS, IN THE OWNER'S ORDER ──────────────────────────
 *
 *   "A TOMB? WHAT CULTIVATION LEVEL IS THE EXPERT? IS THERE A TRIAL!!!? GO GO
 *    GO!!!"
 *
 * The second one is the load-bearing one, and the engine already holds the
 * answer: `Grave.occupantOrdinal` is on the pre-entry face, ungated, because
 * the rank is cut into the lintel. What the engine did with it was print
 *
 *   "The manner of death is legible off the marker: old age, 160 years ago, at
 *    ordinal 44. interred by a sect."
 *
 * **at ordinal 44.** The single most useful fact about a tomb, rendered as a
 * database column, three lines under authored prose that says it properly - *"a
 * course of inscription along the lintel giving a name, a rank at the end of
 * Tribulation Transcendence, a date"*. Every other surface in this package puts
 * a rung through `rankName` or `rungAndOrdinal`; this one did not.
 *
 * ── AND THE RULE THAT WAS WRITTEN AND NEVER READ ─────────────────────────
 *
 * `WHAT_THE_LIGHTNING_TOOK` and `GRAVE_CONTENTS_BANDS` had **zero readers
 * outside the file that declares them**. They carry the setting's sharpest
 * ruling about tombs and it runs opposite to intuition: heavenly tribulation
 * destroys nearly everything the cultivator was carrying, so a tribulation
 * grave is a short list and every item on it survived the heaviest thing in the
 * world, while anybody who died in bed at four hundred leaves a full inventory
 * that nothing has ever tested.
 *
 * The bands are data so tests can assert against the same table the entries
 * were authored from - and nothing in the played game had ever asked.
 *
 * ── WHAT IS FREE, AND WHAT IS A TRADE ────────────────────────────────────
 *
 * `docs/world/places/ruins.md` rules that **reading a site is a skill and is
 * not a realm** - it runs through `assessCapability`'s `understand` predicate,
 * where comprehension keys are absolute, so a scholar places a site a cultivator
 * four realms above them cannot. So the split here is deliberate and the line is
 * where the catalog already puts it:
 *
 *   FREE      what is cut into the marker. The rank, the date, how they died,
 *             what happened to the remains. `inheritance-trials.ts` says the
 *             manner of death is *"the single most useful thing a knowledgeable
 *             party reads off a headstone and the thing an ignorant one walks
 *             straight past"* - so it is on the stone, and what a tribulation
 *             does to what somebody was carrying is the most famous fact in this
 *             world rather than an esoteric one.
 *   A TRADE   the appraisal. That the rich crypt is the weaker one, that a
 *             proven object sells for a multiple, what a house like that valued
 *             and where it would have put it. That is the grave-reader's whole
 *             profession and **it is not wired** - see the note at the foot of
 *             this file.
 *
 * Nothing here reaches the interior. It reads two enum values and an integer off
 * the pre-entry face and says what they imply in general; it never touches the
 * contents list, which is what `outsideViewOf`'s missing `interior` key exists
 * to make impossible.
 *
 * PURE. Marker facts in, lines out. No I/O, no RNG, no mutation.
 */

import {
    GRAVE_CONTENTS_BANDS,
    type Burial,
    type MannerOfDeath
} from '../data/cultivation/inheritance-trials.js';
import { rankName } from '../engine/cultivation/realms.js';

/** Exactly what the pre-entry face already carries for a grave. */
export interface HeadstoneFacts {
    mannerOfDeath: MannerOfDeath;
    burial: Burial;
    /** The rung the occupant stood at. Cut into the lintel; never withheld. */
    occupantOrdinal: number;
    yearsDead: number;
}

/**
 * Which of the two contents profiles this death produces.
 *
 * The mapping is `GRAVE_CONTENTS_BANDS`'s own comment made executable -
 * *"`tribulation` covers `heavenly_tribulation` and `failed_crossing`; `intact`
 * covers everything else"* - so there is one statement of it rather than two
 * that can drift.
 */
type ContentsProfile = keyof typeof GRAVE_CONTENTS_BANDS;

/**
 * Deliberately not exported. `headstoneStructure` states the band it chose, by
 * name and by number, so the mapping is assertable through a function the game
 * actually calls - and an export only a test reads is a rule that looks
 * maintained and is reached by nobody.
 */
function contentsProfileOf(manner: MannerOfDeath): ContentsProfile {
    return manner === 'heavenly_tribulation' || manner === 'failed_crossing'
        ? 'tribulation'
        : 'intact';
}

/** The enums as somebody would say them, rather than as they are stored. */
const HOW_THEY_DIED: Readonly<Record<MannerOfDeath, string>> = {
    heavenly_tribulation: 'struck down by the tribulation',
    failed_crossing: 'lost on the last crossing',
    old_age: 'of old age',
    duel: 'in a duel',
    killed_in_a_fight: 'killed in a fight',
    died_of_injuries: 'of injuries that did not close'
};

const WHAT_BECAME_OF_THEM: Readonly<Record<Burial, string>> = {
    left_where_they_fell: 'Nobody came for the body.',
    interred_by_a_sect: 'A sect paid for the masonry.',
    family_crypt: 'The family put them in with their own.',
    scar_field: 'It is not a burial at all. It is a scar with things lying on it.'
};

/**
 * The lines a person gets off the stone, in the order they would read them.
 *
 * Short and factual on purpose. The authored `marker`, `rumour` and
 * `whatAKnowledgeablePartyReads` strings are printed alongside these and are
 * where the voice lives; restating any of them here would be two copies of one
 * sentence, which is the failure `find-duplicated-prose.mjs` exists to catch.
 */
export function whatTheStoneSays(facts: HeadstoneFacts): string[] {
    const lines: string[] = [
        `The rank is cut into it: ${rankName(facts.occupantOrdinal)}, ${HOW_THEY_DIED[facts.mannerOfDeath]}, `
        + `${facts.yearsDead} years ago. ${WHAT_BECAME_OF_THEM[facts.burial]}`
    ];

    // What the manner of death did to what they were carrying. Not an appraisal
    // and not a contents list - the general consequence, which is the thing an
    // ignorant party walks straight past.
    if (facts.mannerOfDeath === 'failed_crossing') {
        // The one case with no body at all, and the shortest list in the world.
        lines.push(
            'Nobody survives the last crossing and nothing is left of one who tries it. There is no '
            + 'body in there, no pouch and no arrangement: whatever is on that ground fell out of a '
            + 'hand.'
        );
    } else if (facts.mannerOfDeath === 'heavenly_tribulation') {
        lines.push(
            'The tribulation takes nearly everything a cultivator is carrying. Whatever is still in '
            + 'there is a short list, and all of it stayed on a body through the heaviest thing in '
            + 'the world.'
        );
    } else {
        lines.push(
            'Nothing tested what they had. They died with everything they owned on them, and it is '
            + 'all still the way they left it.'
        );
    }

    return lines;
}

/**
 * The mechanical channel: the band, by name and by number, off the table.
 *
 * Separate from the prose because an operator sorts and compares on it, which is
 * the same division `rungAndOrdinal` is built on.
 */
export function headstoneStructure(facts: HeadstoneFacts): string {
    const profile = contentsProfileOf(facts.mannerOfDeath);
    const band = GRAVE_CONTENTS_BANDS[profile];
    return `grave marker: occupant at ordinal ${facts.occupantOrdinal} (${rankName(facts.occupantOrdinal)}), `
        + `${facts.mannerOfDeath}, ${facts.burial}, ${facts.yearsDead} years dead. `
        + `GRAVE_CONTENTS_BANDS.${profile}: ${band.minItems}-${band.maxItems} item(s), `
        + `allProven=${band.allProven}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS NOT HERE, AND IT IS THE HALF WITH THE MONEY IN IT
//
// The APPRAISAL. `WHAT_THE_LIGHTNING_TOOK` carries three more rulings that
// nothing reads: that the rich crypt is usually the weaker one, that a proven
// object sells for a multiple that looks insane on an inventory count, and that
// a tribulation grave with a long inventory has been salted. Those are the
// grave-reader's trade rather than what is on the stone, and `ruins.md` rules
// that such a read runs through `assessCapability`'s `understand` predicate on
// absolute comprehension keys - so a scholar places a site a cultivator four
// realms above them cannot.
//
// That predicate is not consulted anywhere on this surface, so today every
// reader gets exactly the same reading. Wiring it needs the comprehension key
// for grave-reading to exist and `assessCapability` to be reachable from the
// site verbs, and both are somebody's decision rather than a gap to fill in
// passing. The rule `ruins.md` sets for when it IS wired: a failed read is
// informative and never blank - it returns the NAME OF WHAT IS MISSING, so
// somebody who cannot appraise it is told that an appraisal exists and that
// they would need the reading or a person who has it.
// ─────────────────────────────────────────────────────────────────────────
