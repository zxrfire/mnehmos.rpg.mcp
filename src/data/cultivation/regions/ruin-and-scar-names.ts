/**
 * Names for the generated half of the map: what a sealed compound and a scar
 * get called, so that neither is called by its kind.
 *
 * Not `place-names.ts`, which is the one source of truth for the places the
 * catalog AUTHORS. These two tables are drawn from at world generation, by
 * `history.ts` and `locations.ts`, for ground that does not exist until a
 * world is seeded and therefore belongs to no province here.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// PLACE NAMES FOR THE GENERATED HALF OF THE MAP
//
// A seeded world holds twelve ruins and eight scars, and every one of them was
// called `the sealed compound at Lowhollow` or `the scar at Coldmouth` - the
// LocationKind leaking into the fiction. Nobody in this world calls a place a
// sealed compound, and a scar is not called a scar by the people who watched it
// happen.
//
// `seedPriorAges` now draws from these tables and `locationFromRuin` and
// `locationFromScar` patch the drawn name onto the record, so what a player
// travels to is Cold Well or Nothing Grows. The generated toponym survives as
// `location` - the ground the province puts it at - and that half was always
// fine: Sweptfall and Coldmouth sit beside Burnt Earth and Clear River Ford
// without embarrassing themselves.
//
// The claim above about the generated half being fine was WRONG, and it is
// left standing because it is the mistake worth seeing: Sweptfall and Coldmouth
// were welded compounds out of `PLACE_HEAD` and `PLACE_TAIL` in `history.ts`,
// which is the English habit and not the one this world is translated out of.
// They are Swept Fall and Cold Mouth now, and the type noun is a word again.
//
// The draw is keyed on the world seed. It was not, and the consequence is
// worth keeping: a ruin is drawn for every faction in every age, so the same
// twelve keys occurred in every world and every world got the same twelve
// names in the same order. Eight of the twenty below were unreachable
// anywhere, three of them carrying a `LOCAL_RESIDUE` story about ground no
// generator would ever make.
//
// THE RULE THE TABLES OBEY, so a later addition matches:
//
//   1. Never the kind. No "Ruin of", no "Sealed Compound of", no "the X Scar".
//      If a reader cannot tell what sort of place it is without a label, that
//      is what the description field is for.
//   2. One of five sources, and the source is recorded per entry so the rule
//      stays checkable: what is visibly there, what happened, who held it (in
//      the possessive, and only where the holder is gone), what people do there
//      now, or a name that is wrong.
//   3. Slightly too plain for what it describes. The province kept saying it
//      because the province was there, not because it was apt.
//   4. Modifier plus feature, and never a compound. English toponyms weld the
//      two into one word - Halfroof, Coldwell, Cutbank, Hookyard - and Chinese
//      ones do not, which is the whole of why a table obeying every rule above
//      still read as a Yorkshire moor. Half Roof, Cold Well, Cut Bank, Hook
//      Yard: the same names, and the second set reads as translated.
//      A gerund is the same failure in another coat. Digging and Gleaning are
//      English place names (Reading, Barking); what people do there is named
//      by the THING it leaves - Turned Ground, The Picked Edge.
//   5. It must not sound like a faction. `sects.ts` names are very good and the
//      registers must not blur - a place is duller than a house, always.
// ─────────────────────────────────────────────────────────────────────────

export const PlaceNameSourceSchema = z.enum([
    'what_is_visibly_there',
    'what_happened',
    'who_held_it',
    'what_people_do_there_now',
    'a_name_that_is_wrong'
]);
export type PlaceNameSource = z.infer<typeof PlaceNameSourceSchema>;

export const GeneratedPlaceNameSchema = z.object({
    name: z.string().min(1),
    source: PlaceNameSourceSchema,
    /** What the name is actually recording, in one line. */
    records: z.string().min(20)
});
export type GeneratedPlaceName = z.infer<typeof GeneratedPlaceNameSchema>;

/**
 * Names for a sealed compound: the walled seat of a house that fell, shut from
 * the inside in a richer age, with its manuals and its people still in it.
 *
 * Twenty against a draw of twelve, so a seeded world does not repeat.
 */
export const RUIN_NAMES: readonly GeneratedPlaceName[] = [
    { name: 'Nine Bells', source: 'what_happened', records: 'The bells were counted on the last night and the count was passed outward. There were seven.' },
    { name: 'Quan\'s Shelf', source: 'who_held_it', records: 'A surname nobody in the province can now attach to anything else, on a terrace anybody can see from the road.' },
    { name: 'The Warm Gate', source: 'a_name_that_is_wrong', records: 'It has been cold for nine hundred years. The name is older than the sealing and was never revised.' },
    { name: 'Half Roof', source: 'what_is_visibly_there', records: 'What is left standing above the wall line, which is about half of one roof.' },
    { name: 'Three Stones', source: 'what_is_visibly_there', records: 'Three array stones out of a ring nobody has ever counted the rest of.' },
    { name: 'The Millet Yard', source: 'a_name_that_is_wrong', records: 'Nothing has grown in it in an age, and the surrounding villages still call it that at market.' },
    { name: 'Turned Ground', source: 'what_people_do_there_now', records: 'The only thing that has happened there for four hundred years, done by whoever is broke that season.' },
    { name: 'Nothing Standing', source: 'what_happened', records: 'What the first party back reported, which turned out to be wrong by about eleven buildings.' },
    { name: 'Muyang', source: 'who_held_it', records: 'The house name, used flat, with no honorific and no form of words around it.' },
    { name: 'Sixty Doors', source: 'what_is_visibly_there', records: 'Counted from outside by somebody who could not get through any of them.' },
    { name: 'The Long Rota', source: 'what_happened', records: 'The duty roster was still being kept for two years after the sealing, and the last page is legible.' },
    { name: 'Went Under', source: 'what_happened', records: 'Said of the seat rather than of the ground, and said the same way about a person.' },
    { name: 'Cold Well', source: 'what_is_visibly_there', records: 'The only well outside the wall, still good, and the reason anybody camps there at all.' },
    { name: 'Bai\'s Shortcut', source: 'who_held_it', records: 'A path around the perimeter named for the last steward, who was not using it to get anywhere.' },
    { name: 'The Wide Door', source: 'a_name_that_is_wrong', records: 'It is narrow, it faces the wrong way, and every account since the fall has called it wide.' },
    { name: 'Five Winters', source: 'what_happened', records: 'How long the compound answered after it was shut, counted by the people who kept coming back to check.' },
    { name: 'Hook Yard', source: 'what_people_do_there_now', records: 'Where the diggers dress and sort before they go in, named for the tools they leave in it.' },
    { name: 'The Second Wall', source: 'what_is_visibly_there', records: 'There is no first wall any more, so the surviving one is still called the second.' },
    { name: 'Ren\'s Landing', source: 'who_held_it', records: 'A stair head that carries the name of a Warden nobody can now place in any roll.' },
    { name: 'The Quiet Course', source: 'a_name_that_is_wrong', records: 'It is not quiet, it has never been quiet, and everybody who has been in says so and goes on calling it that.' }
];

/**
 * Names for a scar: ground something did to, permanently thin, that people
 * were standing near enough to name.
 *
 * Fourteen against a draw of eight. A scar name should be plainer than a ruin
 * name, because the people who chose it were describing weather.
 */
export const SCAR_NAMES: readonly GeneratedPlaceName[] = [
    { name: 'The Burn', source: 'what_happened', records: 'What the nearest village called it that week, and did not stop calling it.' },
    { name: 'Four Days', source: 'what_happened', records: 'How long it took, counted from a hill by people who could not do anything else.' },
    { name: 'The Flat', source: 'what_is_visibly_there', records: 'It was not flat before, and the word does the whole of the work.' },
    { name: 'Nothing Grows', source: 'what_is_visibly_there', records: 'Stated as a fact rather than as a name, and used as one for two hundred years.' },
    { name: 'Wenzhi\'s Field', source: 'who_held_it', records: 'The farmer who held the ground, named because nobody could name what did it.' },
    { name: 'The Good Ground', source: 'a_name_that_is_wrong', records: 'It was, and the surveys still carry the old entry, and every local knows better.' },
    { name: 'Standing Water', source: 'what_is_visibly_there', records: 'It has not drained since, and nothing will drink it.' },
    { name: 'Three Years', source: 'what_happened', records: 'The interval before anybody would cross it, agreed by nobody and observed by everybody.' },
    { name: 'The Short Way', source: 'a_name_that_is_wrong', records: 'It is the short way and it costs a day to go round, which is the joke and the warning at once.' },
    { name: 'The Picked Edge', source: 'what_people_do_there_now', records: 'People still work the edges for what the ground gives up, and are known by it.' },
    { name: 'Cut Bank', source: 'what_is_visibly_there', records: 'The edge is sharp, and the sharpness of the edge is the thing everybody remarks on.' },
    { name: 'The Old Crossing', source: 'a_name_that_is_wrong', records: 'Nobody has crossed it in two centuries and the road signs have never been changed.' },
    { name: 'Hemu\'s Rest', source: 'who_held_it', records: 'A waystation keeper who did not leave, whose name outlasted the waystation and the road.' },
    { name: 'White Water', source: 'what_is_visibly_there', records: 'The stream that comes off it runs pale and has done since, and the colour is the name.' }
];
