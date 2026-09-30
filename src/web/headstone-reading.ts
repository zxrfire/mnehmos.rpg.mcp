/** Marker facts remain readable. Learned grave appraisal uses the understand predicate. */

import {
    GRAVE_CONTENTS_BANDS, WHAT_THE_LIGHTNING_TOOK,
    contentsBandFor,
    tribulationTouched,
    type Burial,
    type MannerOfDeath
} from '../data/cultivation/inheritance-trials.js';
import { rankName, MAX_ORDINAL } from '../engine/cultivation/realms.js';
import { assessCapability, makeRequirements, makeSubject, type CapabilityActor } from '../engine/world/capability.js';

/** Grave appraisal is a learned trade; the marker itself remains readable. */
export function appraiseTheGrave(actor: CapabilityActor, facts: HeadstoneFacts): string[] {
    const read = assessCapability(actor, makeSubject({
        kind: 'inscription', id: 'grave-appraisal', name: 'grave appraisal',
        requirements: makeRequirements({ understand: MAX_ORDINAL }),
        comprehensionKeys: ['grave-reading']
    })).understand;
    if (!read.holds) return ['Appraising this grave requires grave-reading knowledge or a grave reader. The rank and date remain legible.'];
    return tribulationTouched(facts.mannerOfDeath)
        ? ['A tribulation grave normally holds few objects. Surviving objects are proven against tribulation; a long inventory is evidence of later additions.']
        : ['An intact crypt can hold more objects than a tribulation grave. Their number does not establish their strength; none were proven by the occupant\'s death.'];
}

/** Exactly what the pre-entry face already carries for a grave. */
export interface HeadstoneFacts {
    mannerOfDeath: MannerOfDeath;
    burial: Burial;
    /** The rung the occupant stood at. Cut into the lintel; never withheld. */
    occupantOrdinal: number;
    yearsDead: number;
}

/**
 * Which of the two contents profiles this death produces. The rule is the
 * catalog's `tribulationTouched`, so there is one statement of it.
 */
type ContentsProfile = keyof typeof GRAVE_CONTENTS_BANDS;

function contentsProfileOf(manner: MannerOfDeath): ContentsProfile {
    return tribulationTouched(manner) ? 'tribulation' : 'intact';
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
        lines.push(WHAT_THE_LIGHTNING_TOOK.andAFailedCrossingLeavesNoBody);
    } else if (facts.mannerOfDeath === 'heavenly_tribulation') {
        lines.push(WHAT_THE_LIGHTNING_TOOK.rule);
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
 * the same division `theRung` is built on.
 */
export function headstoneStructure(facts: HeadstoneFacts): string {
    const profile = contentsProfileOf(facts.mannerOfDeath);
    const band = contentsBandFor(facts.mannerOfDeath);
    return `grave marker: occupant at ${rankName(facts.occupantOrdinal)}, `
        + `${facts.mannerOfDeath}, ${facts.burial}, ${facts.yearsDead} years dead. `
        + `GRAVE_CONTENTS_BANDS.${profile}: ${band.minItems}-${band.maxItems} item(s), `
        + `allProven=${band.allProven}.`;
}
