/**
 * The artifact catalog.
 */

import { makeObject, type ObjectRecord } from '../../engine/world/possessions.js';
import { NASCENT_SOUL_ORDINAL } from '../../engine/cultivation/existence.js';
import { refiningOrdinalFor } from '../../engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import {
    theSameCultivationIn,
    type ACountOfBodies
} from '../../engine/cultivation/how-much-cultivation-a-body-carries.js';
import { REALM_TIERS } from '../../engine/cultivation/realms.js';
import { idsForFaction } from './hierarchy.js';
import type { Awareness } from './governance-and-water-rights.js';

/**
 * Every artifact, strongest first.
 *
 * Keep this sorted. The ordering is asserted by the tests, and an entry filed
 * in the wrong place is the one kind of error in this file a reader cannot see.
 *
 * EVERY ROW CARRIES AN ORDINAL, and that is a rule rather than a habit of this
 * table. These are finished things: a hand has already been applied to each one,
 * so how strong it is has a single answer, on the same ladder people are
 * measured on. A grade would be the wrong measurement here - a grade says what
 * the stuff is and leaves the maker out, which is only an open question while
 * the stuff is still a material. See the rule above `ObjectKind` in
 * `src/engine/world/possessions.ts`. An artifact row with no ordinal is a
 * defect, and nothing that mints one anywhere in `src/` may leave it null.
 */
/**
 * The two ways an object at forty-five comes to be in the world.
 */
export const HOW_A_FORTY_FIVE_EXISTS = {
    sentDown:
        'Given. An ascended founder sends something back to the house they came from, intact, made for the purpose and rated where they meant it to be rated. Both objects the region calls sent-down arrived this way and the houses holding them can name the year. It is the clean route and it is the rare one, because it requires somebody above the Lid to still care about a specific institution down here.',
    shattered:
        'Broken, by the ordinary rule that governs every broken object in the world: a piece is worth one rung less than the whole, whether the whole was a notched sabre at six or something an immortal was carrying - see `shardPower`. Somebody crossed, came back down with their own equipment at their own rung, and did not go back up; a forty-six that fails down here does not survive being here without its owner. What is left is pieces, and a piece of a forty-six is a forty-five. Nothing about that is a rule for immortals. It is the same arithmetic that turns a broken blade into a worse blade, meeting a boundary. That is a violent, undocumented and entirely plausible origin for an object nobody can find a giver for, and it is why a house holding one may genuinely not know where it came from.',
    andTheSameThingHappensAtTheBOTTOM:
        'Which is worth saying out loud because the catalog reads as though the interesting objects are the high ones. A shattered blade at six leaves pieces at five, and those pieces are ordinary objects with owners and provenance that can be broken again. Most of the low end of this table is that process having run several times on something nobody recorded the name of, and the only reason the high end feels different is that the boundary it runs into happens to be the Lid.',
    whichIsWhyProvenanceMatters:
        'And it is the difference between an object with a story and an object with a gap. A sent-down piece comes with a founder, a year and a witness; a shard comes with a place where something happened that nobody recorded, because everybody who could have recorded it was standing too close. The \'immortal-made\' tag says what a thing is. It does not say which of these it was, and for several objects in this catalog nobody alive can say either.',
    andTheRideUpFallsOutOfIt:
        'Nothing below is a new rule. Pieces are one rung down because pieces are always one rung down; a forty-six cannot be held here because a weapon lets its holder strike at its rung; and anything above the Lid gets fifteen breaths. Put those three together, which anybody can, and the one route up that has ever been described in full falls straight out - and it is not a route, it is a method of dying. Gather every piece of a shattered forty-six, put them back together, and you are holding a forty-six in the lower realm - which is a thing the lower realm does not permit to remain. It goes up. It goes up immediately, and it goes up with whoever is holding it, and whoever is holding it is not an immortal. Ten to fifteen breaths is the allowance for something that belongs up there. It is not an allowance for a person at forty-four who has just made himself luggage.',
    andTheReasonNobodyHasTriedIt:
        'Is not that they have not thought of it. Every house that has ever held a shard has thought of it, and the reasoning survives in three separate places in the record, each arriving independently at the same two sentences: you would be the first person in history to reach the immortal realm without crossing, and you would arrive dead. The pieces of any given forty-six are scattered across a province and several centuries, and no reassembly has ever been completed - which the careful reading attributes to the difficulty and the honest one attributes to nobody wanting it enough.',
    andItMeansImmortalsHaveDiedHere:
        'The second route only exists because the first premise is true: somebody above the Lid can come down and fail to leave. Fifteen breaths is not long, and it is long enough to be killed in by something that was waiting, or to be caught by the expulsion in the middle of doing something that could not be interrupted. Nobody has ever written one of those down. There are pieces.'
} as const;

/**
 * The rung above the ceiling, and why it is in this table at all.
 */
export const NOTHING_AT_FORTY_SIX_IS_EVER_LEFT = {
    theyAreCarriedAndOnlyCarried:
        'Every one of these is in a hand. That is not a flavour note, it is the entire difference between this band and the one under it: a forty-five can be sent down, set in a floor, chained under a roof and inherited twice, and a forty-six has never been put down in the lower realm for longer than a person can hold their breath. Nothing at this rung has ever been stored, lent, displayed, pledged, escrowed or willed to anybody.',
    andThereforeNeverLooted:
        'Which closes the obvious question before anybody asks it. A visitor from above the Lid is here for fifteen breaths at the outside and what they are carrying goes back up with them, so there is no window in which an object at this rung is lying on the ground with nobody standing over it. The two provinces have no account of one being taken, dropped, sold or found, and the reason is not that the parties were careful.',
    theOnlyResidueIsPieces:
        'See `HOW_A_FORTY_FIVE_EXISTS.shattered`, which is the one route by which anything of this rung has ever stayed, and it is not the object staying. A piece is one rung under the whole by the ordinary rule that governs every broken thing in the world, so what a shattered forty-six leaves is forty-fives - ordinary rows with owners and gaps in their provenance, which is exactly what the band below looks like and exactly why some of it cannot be sourced.',
    andWhatAHouseActuallyHoldsIsTheLesserThing:
        'The three rows here pair with three rows below them, and the pairing is the useful reading. What came down to a house was made to be leavable: rated where the maker meant it to be rated, at the rung that can stay, by somebody who was not going to be here to hold it. It is not a shard of what they carry and never was. It is a smaller thing made on purpose, and the gap between the pair is what an ascended founder decided their house could be trusted with.',
    nobodyBelowHasSeenOne:
        'With one exception, and it is the only evidence for any of this: something came down into a courtyard, crossed it, and eleven people watched. Three accounts survive, they agree on the duration and on nothing else, and not one of them describes what was in its hand in a way that establishes anything. Everything above is inference from the rule rather than from a sighting, and the catalog states it that way round.'
} as const;

// AN OBJECT FIT FOR YOUR PATH, AND THE MANY THAT ARE NOT

export const ARTIFACTS: readonly ObjectRecord[] = [
    // ── 46: carried, never held. See `NOTHING_AT_FORTY_SIX_IS_EVER_LEFT` ──
    // Three rows with a null owner and a possessor nobody in this world can
    // reach. No faction owns one, no faction has ever held one, and the
    // catalog's own accessors enforce that without a branch: `artifactsOwnedBy`
    // filters on a non-null `ownerId` and there is not one on this band.
    makeObject({
        id: 'carried-heaven-splitting-chisel',
        name: 'The Heaven-Splitting Chisel',
        kind: 'artifact',
        significance: 'legendary',
        power: 46,
        ownerId: null,
        ownerName: '',
        possessorId: 'figure-set-hand-eleven',
        description:
            'A carver\'s tool, in the hand of a carver who crossed from driven ground twenty-six centuries ago and files rather than speaks. The Ninth Nail the Myriad Course Hall has been standing behind for all of that time is not a piece of this and never was: it is a second, lesser thing, cut deliberately at the rung that can be left, by somebody who knew they would not be here to hold anything.',
        tags: ['immortal-made', 'carried', 'above-the-lid', 'never-below']
    }),
    makeObject({
        id: 'carried-the-hidden-edge',
        name: 'The Hidden Edge',
        kind: 'artifact',
        significance: 'legendary',
        power: 46,
        ownerId: null,
        ownerName: '',
        possessorId: 'figure-ru-anjing',
        description:
            'The newest object in existence, three hundred and eighty years old, and the counterpart nobody in the Jade Gorge has ever considered: the Standing Edge is what she left, and this is what she took. The Azure Cloud Pavilion has built a certification practice, a reputation and most of its standing on the half of the pair she could afford to part with, and has never once asked what the other half is.',
        tags: ['immortal-made', 'carried', 'above-the-lid', 'never-below']
    }),
    makeObject({
        id: 'carried-the-polestar-dial',
        name: 'The Polestar Dial',
        kind: 'artifact',
        significance: 'legendary',
        power: 46,
        ownerId: null,
        ownerName: '',
        possessorId: 'figure-tao-jingwei',
        description:
            'A reference that is not local, held by the woman who founded the arterial survey and crossed from a site her own register locates precisely and describes not at all. The Polestar Lamp in the Earth Vein Tower vault does the same job three rungs down and does it well enough that the Survey has never wondered what it is a smaller version of.',
        tags: ['immortal-made', 'carried', 'above-the-lid', 'never-below']
    }),
    // 45: three of them, and no two are held by allies
    makeObject({
        id: 'hollow-unwritten-length',
        data: { daoDomain: 'life_death' },
        name: 'The Long Life Candle',
        kind: 'artifact',
        significance: 'legendary',
        power: 45,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'hollow-court-first-seat',
        description:
            'Carried rather than stored, by somebody at forty-four who uses it as a tool for the crossing and would think describing it to an outsider a waste of an afternoon. Nobody outside the Court has seen it and the Court has never said it exists.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    makeObject({
        id: 'sent-ninth-nail',
        data: { daoDomain: 'formation' },
        name: 'The Ninth Nail',
        kind: 'artifact',
        significance: 'legendary',
        power: 45,
        ownerId: 'apex-myriad-course-hall',
        ownerName: 'The Myriad Course Hall',
        possessorId: 'apex-myriad-course-hall',
        description:
            'A fixed point in a world where nothing else is fixed. Ground near it cannot be moved, folded or unmade, which settles most fights before anybody swings at anything.',
        tags: ['immortal-made', 'sent-down', 'never-carried', 'known-to-exist']
    }),
    makeObject({
        id: 'artifact-the-standing-edge',
        data: { daoDomain: 'karma' },
        name: 'The Standing Edge',
        kind: 'artifact',
        significance: 'legendary',
        power: 45,
        ownerId: 'sect-azure-cloud-pavilion',
        ownerName: 'The Azure Cloud Pavilion',
        possessorId: 'sect-azure-cloud-pavilion',
        description:
            'It settles who somebody is, permanently and without appeal, in a world where identity is what people lose at realm boundaries and forge for a living. It is also the newest object in the world and the reason the weakest apex is the one nobody will touch: forty-five in the hands of somebody standing at forty-one, which is the widest gap between a person and what they are holding anywhere in the catalog. She cannot win a war. She can make certain that whoever wins one is in no condition to face the third house that afternoon.',
        tags: ['immortal-made', 'sent-down', 'never-carried', 'known-to-exist']
    }),
    // ── 44 ────────────────────────────────────────────────────────────────
    makeObject({
        id: 'hollow-second-silence',
        name: 'The Nine-Knot Cord',
        kind: 'artifact',
        significance: 'legendary',
        power: 44,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'hollow-court-second-seat',
        description:
            'The same, one rung down. What the province knows is that four people went in, and that the mountains are visited while the occupants are not; what it does not know is that all four are carrying something an apex would empty a vault for.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    // THE ROOT CAULDRON, IN TWO PIECES. One object, and the only reason there
    // are two rows is that it is not in one place. See `THE_ROOT_CAULDRON`
    // below for the recipes, the gate they read, and what the split cost.
    makeObject({
        id: 'cauldron-the-belly',
        name: 'The Cauldron Belly',
        kind: 'artifact',
        significance: 'legendary',
        power: 44,
        ownerId: 'court-kiln',
        ownerName: 'The Kiln Court',
        possessorId: 'court-kiln',
        knownOwnershipBy: ['court-kiln', 'apex-earth-vein-tower', 'sect-deeproot-court'],
        description:
            'The lower half of a refining vessel, set into the datum at the world\'s root and not liftable by anybody. What it takes is cultivators, body and soul, and what it returns is a blade - the same blade, every time, which is why anybody holding one can be asked where they got it.',
        tags: ['immortal-made', 'containment', 'half-of:the-root-cauldron', 'makes-a-blade', 'never-carried', 'known-to-exist']
    }),
    makeObject({
        id: 'cauldron-the-lid',
        name: 'The Cauldron Lid',
        kind: 'artifact',
        significance: 'legendary',
        power: 44,
        ownerId: 'sect-deeproot-court',
        ownerName: 'Deeproot Court',
        possessorId: 'sect-deeproot-court',
        knownOwnershipBy: ['sect-deeproot-court', 'apex-myriad-course-hall', 'court-kiln'],
        data: { lastFiredYearsAgo: 890 },
        description:
            'The upper half of the same vessel, fed the same way and returning a shield instead of a blade. A lid is the part of a cauldron that comes off, which is the whole of why this is the half that walked and the other one did not. It has fired once since it walked, eight hundred and ninety years ago, and its rest is over.',
        tags: ['immortal-made', 'containment', 'half-of:the-root-cauldron', 'makes-a-shield', 'known-to-exist']
    }),
    // ── 43: the most VALUABLE object there is, and the least use in a duel ─
    makeObject({
        id: 'hollow-turned-ledger',
        name: 'The Cinnabar Brush',
        kind: 'artifact',
        significance: 'legendary',
        power: 43,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'hollow-court-third-seat',
        description:
            'Held by the Third Seat, who stands level with the Earth Vein Tower\'s head and is better equipped than him, and who has never had a reason to be within a province of the man.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    makeObject({
        id: 'hollow-fourth-refusal',
        name: 'The Closed Fan',
        kind: 'artifact',
        significance: 'legendary',
        power: 43,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'hollow-court-fourth-seat',
        description:
            'The weakest of the Court\'s four and still the equal of the Myriad Course Hall\'s Nail. The Fourth Seat is the youngest and the one most likely to be met, on the grounds that they are the only one who still occasionally answers the gate.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    makeObject({
        id: 'sent-datum-lamp',
        data: { daoDomain: 'void' },
        name: 'The Polestar Lamp',
        kind: 'artifact',
        significance: 'legendary',
        power: 43,
        ownerId: 'apex-earth-vein-tower',
        ownerName: 'The Earth Vein Tower',
        possessorId: 'apex-earth-vein-tower',
        description:
            'A reference that is not local. Its holder cannot be lied to about where anything is: formations do not resolve against it and concealment does not hold in front of it. It has not left the vault in nine hundred years, and the reason is logistics rather than doctrine - the seat is full of valuable things and the defence is presence.',
        tags: ['immortal-made', 'sent-down', 'never-carried', 'known-to-exist']
    }),
    // THE CEILING AT FORTY-ONE Everything above this line was sent down by somebody
    // who crossed. Everything below it was made here, and the band is populated - a
    // house with centuries, a vein and a dao can build most of the way up. What no
    // forge below the Lid has ever passed is forty-one, and the boundary is not
    // scarcity or skill: an object is anchored by whoever finished it, and nobody
    // who finished one was standing above the last realm. So the best thing anybody
    // alive can make sits a rung under the weakest thing that came down,
    // permanently, and every house that has tried to close that rung has produced
    // something that came apart. 41: the ceiling, and the only mortal-made thing
    // that reaches it
    makeObject({
        id: 'artifact-the-standing-weight',
        data: { daoDomain: 'formation' },
        name: 'The Quelling Stone',
        kind: 'artifact',
        significance: 'legendary',
        power: 41,
        ownerId: 'house-immovable-mountain',
        ownerName: 'Immovable Mountain Temple',
        possessorId: 'house-immovable-mountain',
        description:
            'The datum stone, chained down under a roof and watched by two people at all times. Twenty-nine centuries of the least dramatic dao in the world went into it and it is the high-water mark of everything made below the Lid: a place that cannot be moved, folded, opened, spread or relocated while it is standing. It is one rung under the weakest sent-down object and the Immovable Mountain Temple has never claimed otherwise, which is most of why the claim is believed.',
        tags: ['forged', 'the-ceiling', 'immovable', 'known-to-exist']
    }),
    // ── 38-26: what centuries and a dao will buy ──────────────────────────
    makeObject({
        id: 'artifact-the-ninth-volume-case',
        data: { daoDomain: 'karma' },
        name: 'The Sealing Casket',
        kind: 'artifact',
        significance: 'legendary',
        power: 38,
        ownerId: 'house-ninefold-karma',
        ownerName: 'Ninefold Karma Palace',
        possessorId: 'house-ninefold-karma',
        description:
            'The case the nine sealed volumes sit in, which the Karma Palace commissioned and which is worth more than most of what it holds. An obligation entered into its presence binds to ground rather than to a name, so it cannot be escaped by becoming somebody else - which in a world where identity is what people shed at realm boundaries is the whole of what an oath is for. Four thousand years of the house\'s trade is inside it.',
        tags: ['forged', 'oath-bearing', 'known-to-exist']
    }),
    makeObject({
        id: 'artifact-the-cold-arterial-key',
        name: 'The Black Ice Key',
        kind: 'artifact',
        significance: 'significant',
        power: 34,
        ownerId: 'sect-frostmirror-court',
        ownerName: 'Frostmirror Court',
        possessorId: 'sect-frostmirror-court',
        description:
            'What the Court cut out of the ice rather than inherited: the instrument that opens and closes the cold arterial, which is the only reason a glacier court on a vein nobody else can work is a court at all. It is the strongest thing anybody has built out of a curriculum instead of out of a dao, and it does one thing perfectly and nothing else at all.',
        tags: ['forged', 'office-issued', 'mutated-root-only']
    }),
    makeObject({
        // WHAT THE WHOLE CAULDRON MAKES, and the ordinals on all three rows
        // below are read off `refiningOrdinalFor` rather than chosen: nothing
        // worked these, so what they can be is what the grade's own working
        // asks of a hand, and no more.
        id: 'artifact-cauldron-born-pair',
        name: 'A Cauldron-Born Pair',
        kind: 'artifact',
        significance: 'legendary',
        power: refiningOrdinalFor('heaven'),
        ownerId: 'apex-earth-vein-tower',
        ownerName: 'The Earth Vein Tower',
        possessorId: 'apex-earth-vein-tower',
        knownOwnershipBy: ['apex-earth-vein-tower', 'court-kiln'],
        description:
            'A sword and a shield that are one object and have never been apart. Three exist, all three in the Survey vault and all three out of the Hundred Schools Age, when the world held more cultivators at the top of the ladder than it has held since, and every one of them predates the reposting - a pair can only come out of the whole vessel, the vessel stood whole only under the Survey, and it has not been whole in nine hundred years. So a pair in a hand names a side as well as a century.',
        tags: ['from:the-root-cauldron', 'derangement-bearing', 'three-exist', 'made-while-it-was-whole', 'known-to-exist']
    }),
    makeObject({
        id: 'artifact-the-severed-ledger-blade',
        data: { daoDomain: 'karma' },
        name: 'The Severing Canon',
        kind: 'artifact',
        significance: 'significant',
        power: 29,
        ownerId: 'sect-the-severed',
        ownerName: 'The Severed',
        possessorId: null,
        description:
            'Not a weapon and the most feared object the house owns: the book a member\'s cuts are written in, carried by whoever is doing the cutting that decade. What it does is make a severance hold - a name, a bond, a memory, given up deliberately and then unable to be taken back by anybody, including the person who gave it. Every doctrine the Severed have rests on that being irreversible, and this is what makes it so.',
        tags: ['forged', 'issued-to-office', 'irreversible']
    }),
    makeObject({
        id: 'artifact-the-storm-tally',
        name: 'The Thunder-Struck Rod',
        kind: 'artifact',
        significance: 'significant',
        power: 26,
        ownerId: 'sect-storm-tyrant-court',
        ownerName: 'Storm Tyrant Court',
        possessorId: 'sect-storm-tyrant-court',
        description:
            'A lightning curriculum written into a bar of something that was struck often enough to remember it. The Court was held on probation for two centuries and raised to answer the Earth Vein Tower directly because of what is in this object, and it has never let anybody outside read it - which is the entire reason the probation was imposed and the entire reason it was not lifted with the promotion.',
        tags: ['forged', 'curriculum-bearing', 'never-shown']
    }),
    // ── 22-14: what an ordinary strong house fields ───────────────────────
    makeObject({
        id: 'artifact-frostmirror-plate',
        name: 'The Cold Jade Plate',
        kind: 'artifact',
        significance: 'significant',
        power: 22,
        ownerId: 'sect-frostmirror-court',
        ownerName: 'Frostmirror Court',
        possessorId: 'sect-frostmirror-court',
        description:
            'Ice curriculum made solid: a carapace cut from the working face and finished over eleven years, which is what the Court has instead of a sent-down object. It is the strongest thing in either province that somebody alive made on purpose, and it is twenty rungs below the weakest immortal artifact, which is the most useful single fact about the difference between the two classes.',
        tags: ['forged', 'mutated-root-only', 'known-to-exist']
    }),
    makeObject({
        id: 'artifact-kiln-gate-seal',
        name: 'The Kiln Gate Seal',
        kind: 'artifact',
        significance: 'significant',
        power: 18,
        ownerId: 'sect-deeproot-court',
        ownerName: 'The Kiln Court',
        possessorId: 'sect-deeproot-court',
        description:
            'The instrument the Gate Warden carries, which closes a working and holds it closed against the pressure of the vein. It is a tool that happens to be dangerous rather than a weapon that happens to be useful, and the Court has never described it as either.',
        tags: ['forged', 'office-issued']
    }),
    makeObject({
        id: 'artifact-cauldron-born-blade',
        name: 'A Cauldron-Born Blade',
        kind: 'artifact',
        significance: 'significant',
        power: refiningOrdinalFor('earth'),
        ownerId: 'apex-earth-vein-tower',
        ownerName: 'The Earth Vein Tower',
        possessorId: 'apex-earth-vein-tower',
        knownOwnershipBy: ['apex-earth-vein-tower', 'court-kiln', 'sect-deeproot-court'],
        description:
            'One blade, with no shield anywhere that matches it, which places it exactly: made after the split, by a half working alone. It is the only object of its kind in the world and it is the only figure in the Survey storehouse that has gone up in nine hundred years. It has never been issued to anybody.',
        tags: ['from:the-root-cauldron', 'derangement-bearing', 'one-exists', 'made-after-the-split', 'never-issued']
    }),
    makeObject({
        id: 'artifact-cauldron-born-shield',
        name: 'A Cauldron-Born Shield',
        kind: 'artifact',
        significance: 'significant',
        power: refiningOrdinalFor('earth'),
        ownerId: 'apex-myriad-course-hall',
        ownerName: 'The Myriad Course Hall',
        possessorId: 'apex-myriad-course-hall',
        knownOwnershipBy: ['apex-myriad-course-hall', 'sect-deeproot-court', 'court-kiln'],
        description:
            'The other half\'s output, and the same story: one shield made over and over, identical enough that two of them side by side cannot be told apart by anybody who has handled either. Nine are in the seat chamber. The Hall publishes a decreasing count of its sealed cases and has never published this one.',
        tags: ['from:the-root-cauldron', 'derangement-bearing', 'nine-exist', 'never-issued']
    }),
    makeObject({
        id: 'artifact-azure-sword-tally',
        name: 'A Sword Elder\'s Tally',
        kind: 'artifact',
        significance: 'significant',
        power: 16,
        ownerId: 'sect-azure-cloud-pavilion',
        ownerName: 'The Azure Cloud Pavilion',
        possessorId: null,
        description:
            'One of four, issued with the office rather than to the person, and returned when the office is. A good blade with a century of the Pavilion\'s own sword intent worked into it, which is the ordinary way a sect makes something strong: slowly, by using it.',
        tags: ['forged', 'office-issued', 'four-exist']
    }),
    // -- FROM HERE DOWN, A ROW IS A KIND AND NOT AN OBJECT ----------------
    makeObject({
        id: 'artifact-severed-name-knife',
        name: 'A Cutting Knife',
        kind: 'artifact',
        significance: 'mundane',
        power: 14,
        ownerId: 'sect-the-severed',
        ownerName: 'The Severed',
        possessorId: null,
        description:
            'Issued to anybody who has cut something, which in that house is everybody. It is not rare, it is not honoured, and losing one is a fine rather than a disgrace - the Severed regard the object as a receipt for a decision rather than as a possession.',
        tags: ['forged', 'issued-widely']
    }),
    // ── 9-4: what a wandering cultivator is realistically carrying ────────
    makeObject({
        id: 'artifact-hollow-bell',
        name: 'A Hollow Bell',
        kind: 'artifact',
        significance: 'mundane',
        power: 9,
        ownerId: null,
        ownerName: '',
        possessorId: null,
        description:
            'A wanderer\'s bell, rung to make a road behave for an hour. Several hundred exist, most of them worn out, and a working one is the single most common thing a rogue cultivator owns that anybody would rob them for.',
        tags: ['forged', 'common', 'traded']
    }),
    makeObject({
        id: 'artifact-notched-sabre',
        name: 'A Notched Sabre',
        kind: 'artifact',
        significance: 'mundane',
        power: 4,
        ownerId: null,
        ownerName: '',
        possessorId: null,
        description:
            'Somebody\'s, once. It is in this catalog for the same reason the Datum Lamp is: it has a number, the number is read by the same code, and a person holding it beats a person holding nothing. The distance between this row and the first one is the whole of the world\'s power structure, written as a subtraction.',
        tags: ['forged', 'common', 'looted']
    }),

    // A SCATTERED WORK, IN THREE HANDS
    makeObject({
        id: 'volume-heaven-conversing-first',
        name: 'The Heaven-Conversing Canon, first volume',
        kind: 'manual',
        significance: 'significant',
        // A book is not a weapon. `OBJECT_CEILING_BELOW_THE_LID` caps
        // objects because an object rated at a rung lets its holder STRIKE
        // at that rung, and paper does not - which is the whole reason
        // `MANUALS_MAY_EXCEED_THE_LID` can be true at all. What a volume is
        // worth is a ceiling it lifts, and the engine derives that from how
        // many of the set are held. It is worth nothing in a room.
        power: null,
        ownerId: 'house-immovable-mountain',
        ownerName: 'Immovable Mountain Temple',
        possessorId: 'house-immovable-mountain',
        knownOwnershipBy: ['house-immovable-mountain', 'house-ninefold-karma', 'sect-azure-cloud-pavilion'],
        description:
            'Catalogued, shelved, and read once a decade by somebody checking it is still the same book. Immovable Mountain Temple knows what it is, knows it is a third of something, and has never advertised either fact - a house of surveyors is a house that understands the difference between holding a thing and being known to hold it. It is also the only one of the three that could not read past the fourth page if it wanted to.',
        tags: ['shard', 'from:heaven-conversing-primordial-canon', 'volume:1', 'catalogued']
    }),
    makeObject({
        id: 'volume-heaven-conversing-second',
        name: 'The Heaven-Conversing Canon, second volume',
        kind: 'manual',
        significance: 'significant',
        // A book is not a weapon. `OBJECT_CEILING_BELOW_THE_LID` caps
        // objects because an object rated at a rung lets its holder STRIKE
        // at that rung, and paper does not - which is the whole reason
        // `MANUALS_MAY_EXCEED_THE_LID` can be true at all. What a volume is
        // worth is a ceiling it lifts, and the engine derives that from how
        // many of the set are held. It is worth nothing in a room.
        power: null,
        ownerId: 'sect-fallen-grain-caravan',
        ownerName: "Fallen Grain Caravan",
        possessorId: 'sect-fallen-grain-caravan',
        knownOwnershipBy: [],
        description:
            'Came out of a burn zone in a bundle of forty-one salvaged documents, was priced by weight, and has been holding a window open in a back office for a hundred and ten years. Nobody in the Caravan can read it and nobody has asked anybody who can. It is the cheapest of the three to acquire and the hardest to find, which is the ordinary shape of salvage.',
        tags: ['shard', 'from:heaven-conversing-primordial-canon', 'volume:2', 'unidentified', 'looted']
    }),
    makeObject({
        id: 'volume-heaven-conversing-third',
        name: 'The Heaven-Conversing Canon, third volume',
        kind: 'manual',
        significance: 'significant',
        // A book is not a weapon. `OBJECT_CEILING_BELOW_THE_LID` caps
        // objects because an object rated at a rung lets its holder STRIKE
        // at that rung, and paper does not - which is the whole reason
        // `MANUALS_MAY_EXCEED_THE_LID` can be true at all. What a volume is
        // worth is a ceiling it lifts, and the engine derives that from how
        // many of the set are held. It is worth nothing in a room.
        power: null,
        ownerId: 'house-ninefold-karma',
        ownerName: 'Ninefold Karma Palace',
        possessorId: 'house-ninefold-karma',
        knownOwnershipBy: ['house-ninefold-karma', 'house-immovable-mountain'],
        description:
            'The Karma Palace knows it holds a third of a chaos-grade canon, has known for two hundred years, and has an open standing offer for either of the other two that it has never once described in writing. It does not know the Immovable Mountain Temple has the first. Immovable Mountain Temple does know the Karma Palace has the third, and has said nothing, for reasons the Karma Palace would find entirely familiar.',
        tags: ['shard', 'from:heaven-conversing-primordial-canon', 'volume:3', 'sought']
    })
];



/**
 * The lowest rung that carries anything at all.
 *
 * Not the floor itself: somebody who has never advanced has spent nothing, so
 * no quantity of them adds up to a working. One rung up is the cheapest fuel
 * that is fuel.
 */
const THE_BOTTOM_OF_THE_LADDER = REALM_TIERS[0]!.ordinalStart + 1;

/** The rung the whole vessel's recipe is written at. */
const VOID_TRIBULATION_ORDINAL =
    REALM_TIERS.find(t => t.key === 'void_tribulation')!.ordinalStart;

/**
 * The Root Cauldron: a liability, and what it costs to be tempted by it.
 *
 * Not a weapon and not a tomb. It is a refining vessel that takes cultivators
 * as its material, so the two courts are staff on a working site rather than
 * mourners at a door - which is why there is a rota and why there are leaks to
 * walk down.
 *
 * A HALF IS A LIABILITY AND THE WHOLE IS A PRIZE, and which of the two it is
 * depends only on how much of it you are holding. A half buys a city of the
 * weak for an earth-grade sword, and `refiningOrdinalFor` opens earth grade at
 * seventeen, which thousands of ordinary cultivators stand at: an idiotic
 * trade, and the reason both halves sit idle. The whole makes a heaven-grade
 * object, and what it takes to make one is the point - see `whatItSubstitutes`.
 * So the two apexes each hold the worthless version and jointly hold the
 * valuable one, which neither can assemble.
 *
 * THE GATE IS THE ENGINE'S OWN. `existence.ts` hangs the soul states on
 * `NASCENT_SOUL_ORDINAL`, and this reads the same band rather than adding a
 * rule. Above it `aSoulThisOldCanRefuse` is true and the vessel gets nothing,
 * so every recipe below has to be paid out of the ranks beneath it.
 */
export const THE_ROOT_CAULDRON = {
    /**
     * The two recipes, as counts of bodies at a rung. `theSameCultivationIn`
     * reads either at any other rung off the ladder's own power curve, so there
     * is no table here of what a Qi Condensation is worth.
     */
    whole: { bodies: 10, ordinal: VOID_TRIBULATION_ORDINAL } as ACountOfBodies,
    half: { bodies: 10, ordinal: NASCENT_SOUL_ORDINAL } as ACountOfBodies,
    /** Eight hundred and eighty-eight years between firings. */
    restsForYears: 888,
    yields:
        'The whole vessel returns one sword and shield that are a single heaven-grade object. The belly alone returns an earth-grade blade and the lid alone an earth-grade shield. Nothing else in the world makes any of the three.',
    andTheyAreTheSameObjectEveryTime:
        'It is not a smith and it does not vary, so what comes out is a duplicate rather than a new thing: one blade made repeatedly, one shield made repeatedly. Holding one is therefore evidence of where it came from, read the way any marked property is read, and nobody has ever had to prove it.',
    andWhatItIsWorth:
        'Set the ordinals beside the prices. `refiningOrdinalFor` opens earth grade at seventeen and heaven grade at twenty-nine, so a half costs a city for something a Core Formation cultivator forges. That is the whole argument against a half.',
    whatItSubstitutes:
        'And the argument FOR the whole, which is not that it skips the material. Making a heaven-grade artifact takes a hand at twenty-nine AND heaven-grade material, and the material has to be found and killed for: six things in the catalog carry it, a Thunder Hawk Core, a Grave Hound Core, a Glacier Lynx Core, a White Tiger Core, a Tortoise Plastron and an Earth Dragon Scale. The cauldron meets the same requirement out of a different stock. A certain quantity of people is heaven-grade material, and the vessel is what performs the equivalence.',
    andWhoThatTempts:
        'Two kinds of hard. The honest road is a beast that has to be tracked and beaten, which is slow, uncertain and your own body. The cauldron is politically ruinous and carries no personal risk at all, and the people it takes were condemned by a sentence somebody else handed down, so nobody has to stand in front of a living thing and do it themselves. That is the benefit and it is the whole of it - a bureaucratic one, which is exactly what two neutral administrative apexes would find reasonable. The person this tempts is somebody at twenty-nine who wants the artifact and would rather spend other people than face an Earth Dragon.',
    andTheAlignmentFaultLine:
        'Which is the line the material economy runs along. A righteous house does not hunt a person and a neutral one might, and at and above `BEAST_CHANGE_ORDINAL` a beast is a person - so which roads to material are open to a house is a fact about its alignment. Both bodies holding a half are the neutral pair, which is why neither experiences any of this as a compromise, and why the one righteous apex is the one that revolts.',
    andWhyAnybodyFeedsItAtAll:
        'Because they are holding it, and not the other way round. The custody came first: it must not be loose. The executions were going to happen regardless, and since the vessel is standing there the condemned go into it rather than somewhere else and something comes out. That is the whole of the reasoning and it is the register of two neutral apexes - no programme, no ambition, a sentence that had to be carried out and a thing with no better use.',
    whoCanWorkIt:
        'Twenty-nine, and that is true of a half as well as the whole - the same rung `refiningOrdinalFor` opens heaven grade at. Counted through the catalog: thirty-two cultivators in the world stand there or above, and every one of them is the seat of a house, the head of an apex or a Seat of the Hollow Court. So a firing is not something a garrison does. Somebody from the summit has to attend, which is why it is an occasion rather than a procedure and why it pairs with a judgement handed down in person.',
    whatItDoesToWhoeverCarriesOne:
        'Bloodlust, and it has to be held down. `WHAT_A_HALF_MAD_STRETCH_DOES` is already this mechanic - a stretch somebody was not entirely steering, resolved as deeds rather than as a status word - and the fight unpicked, the thing taken and the month of not stopping are its rows. Both apexes know what they are holding and both keep theirs.',
    /**
     * Every way of loading a half, none of them cheap. Derived by
     * `theSameCultivationIn`; the figures are here because the shape of the
     * ladder is the entry and a reader should not have to run it.
     */
    whatAHalfCosts: [
        'ten at Nascent Soul: ten of the strongest people in a province, taken alive. Only a body that can condemn them can do it, which is why the lawful fuel is condemned high-realm cultivators and why the lawful road is also the quiet one.',
        'sixteen at Core Formation Perfection: a war against a real house, won without killing any of the sixteen.',
        'fifty at Foundation Establishment Perfection: a smaller war, still a war.',
        'twenty-eight thousand five hundred and eighty-three at the floor of the ladder: no war at all, and no arrangement of secrecy that survives the next harvest count.'
    ],
    andTheWholeIsTheSameLadderTimesEleven:
        'One hundred and nine at Nascent Soul, or three hundred and ten thousand three hundred and six at the floor. The price never becomes low; it changes currency, from a war that can be lost to a crime that cannot be hidden.',
    /**
     * Three reasons, in this order, and the first makes the other two
     * unnecessary. The world COULD pay. It does not, because the trade is
     * idiotic.
     */
    whyNobodyFiresIt: [
        'The arithmetic is absurd AT A HALF. A city, or a war, for an object an ordinary Core Formation cultivator could forge, held by bodies that are not short of one. It is not absurd at the whole, which is why the whole is the one that cannot be assembled.',
        'It would cost them politically. Three hundred thousand mortals and the righteous houses beneath them revolt, and so does the Azure Cloud Pavilion - which is the standoff the apex entries already describe, arriving at a specific act. Both cauldron-holding apexes are the neutral pair, so neither is restrained by principle. They are restrained by the third one having some.',
        'Their dao hearts. `whatACrossingAsksOfTheDaoHeart` reads what a life brings to a crossing, and everybody who can work this stands at twenty-nine or above with the rest of the ladder still in front of them - the heads who would actually order it most of all. The ones who could pay the price are the ones who can least afford to.'
    ],
    /**
     * Four locks, none of them doing the work on its own, which is why nine
     * hundred years of this has needed no particular guarding.
     */
    theFourLocks: ['politics', 'arithmetic', 'economics', 'capability'],
    whyTheWholeHasNeverFired:
        'Not the seal and not the arithmetic. The two halves are held by two postings answering two different apexes, so putting them together needs either an agreement between bodies that have not raised anything with each other in eleven hundred years, or a half taken off an apex\'s own subordinate. The schism was a political accident and it installed a two-key lock nobody designed.',
    andEachHalfNeedsNobody:
        'Which is the other half of the same sentence. Either apex can fire its own whenever it likes, without permission and without anybody being told, so the world lives permanently with two working execution grounds and one impossible one - and the impossible one is safe precisely because the other two are unsupervised.',
    whyItIsGuarded:
        'Not to keep it. Whoever steals a half acquires an object they cannot work: to fire it they must recruit, buy or coerce one of thirty-two named people, every one of whom sits at the top of a house, can already craft what it makes, and would be risking their own crossing. That is a conspiracy with a cast list rather than a heist, and the thief has also just taken something off an apex, which gives every apex a reason to end them that costs no dao heart at all.',
    whoDecidesWhoGoesIn:
        'Both apexes holding a half refuse the alignment axis - one because it is not a term of the grant, one because it has never had a counterparty to read one off - and what they put in are condemned high-realm cultivators, which is a judgement on that axis. Neither has been asked to answer that in a room where it would have to.',
    andPeopleWouldKnow:
        'Two independent tells, and a player can work from either to the other. The weapon in somebody\'s hand says which cauldron made it. The hole in the population says one was fired, at a loudness `howLoudTakingPeopleIs` reads off the head count - ten condemned is a matter inside one house, and twenty-eight thousand is a province counting its dead.',
    whatTheSplitDid:
        'It capped the thing. Safer, and not safe: a half is still a catastrophe, and the two differ in scale and in product rather than in kind.',
    andAPairDatesItself:
        'The rest is why any of this is countable and it is also a calendar. A pair can only have come out of the whole vessel, and the vessel has not been whole since the reposting nine hundred years ago - so a pair predates the split and a lone sword or a lone shield postdates it, and anybody holding one can be placed in history by whether it has its mate. Nobody had to write that down; it falls out of the interval.',
    andTheRestIsNotWhatStopsIt:
        'The eight hundred and eighty-eight years is a minimum between firings and not a schedule. Both halves are ready and have been ready for centuries. What governs the rate is how often the world produces a condemned high-realm cultivator, which is rarely: they are not waiting on the vessel, they are waiting on somebody to deserve it. So the standing tension is not a date arriving. It is that the sum comes out differently for somebody who cannot forge at seventeen and has no crossing to lose.',
    whoHandsItDown:
        'By convention the elder holding the punishment portfolio, in person. What he hands down is a SENTENCE - where the body goes afterwards is disposal, and disposal is not what he is ruling on, which is why the public notice is a death sentence and complete as far as it goes. Nothing is being concealed at the moment of judgement because at that moment there is nothing yet to conceal. Reading the names out is convention rather than a lock, so a firing nobody published is a reachable state of the world and one person\'s decision rather than an institution\'s.'
} as const;

/**
 * The most times a vessel COULD have fired in this many years.
 *
 * A ceiling and nothing else. How many times it actually fired is a small
 * authored number that sits under this, because each firing needed somebody to
 * assemble the fuel and that has almost never been possible - the rest has
 * never been the binding constraint and dividing history by it would invent a
 * cadence the world does not have.
 */
export function mostFiringsIn(years: number): number {
    return Math.max(0, Math.floor(years / THE_ROOT_CAULDRON.restsForYears));
}

/** Years still to run before a vessel last fired this long ago may fire again. */
export function yearsUntilItMayFireAgain(yearsSinceItLastFired: number): number {
    return Math.max(0, THE_ROOT_CAULDRON.restsForYears - yearsSinceItLastFired);
}

/** Whether a vessel that last fired this long ago is ready. */
export function itMayFireAgain(yearsSinceItLastFired: number): boolean {
    return yearsUntilItMayFireAgain(yearsSinceItLastFired) <= 0;
}

/**
 * What each recipe costs paid at the floor of the ladder, which is how it would
 * actually be paid: above Nascent Soul a cultivator resists, so the fuel has to
 * come from underneath and there are far more people underneath.
 *
 * Both figures are massacres and they differ in scale rather than in kind. The
 * split capped the larger one; it disarmed nothing. Computed off
 * `powerMultiplierForOrdinal` so no figure here can be typed wrong or go stale.
 */
export function whatTheCauldronCostsAtTheBottom(): { half: number; whole: number } {
    return {
        half: theSameCultivationIn(THE_ROOT_CAULDRON.half, THE_BOTTOM_OF_THE_LADDER),
        whole: theSameCultivationIn(THE_ROOT_CAULDRON.whole, THE_BOTTOM_OF_THE_LADDER)
    };
}

/**
 * What anybody at this awareness can be told about the Root Cauldron.
 *
 * The reveal sits UNDER the one the apex material already builds - a strange
 * order guarding a vein it draws nothing from is the evidence in plain view
 * that the province is a tenancy, and this is the next layer on the same
 * bodies. So every tier below the last is true, boring and complete as far as
 * it goes, and none of them is the sentence that joins the execution notices to
 * the object.
 *
 * The public record is available the whole way down: a high-realm cultivator
 * was caught and sentenced, which surprises nobody. What is held back is where
 * the body went.
 *
 * Null means say nothing rather than say a hedge - `actsWithoutAttribution` is
 * the register at that tier, and the narrator has effects to use without names.
 */
export function whatIsSaidOfTheCauldronAt(awareness: Awareness): string | null {
    switch (awareness) {
        case 'unaware':
            return null;
        case 'whisper':
            return 'There is an order on the deep vein that lights every node it holds, '
                + 'draws nothing, and has turned away everybody who ever walked up to it.';
        case 'named':
            return 'They are not eccentric and they are not local. They are staff, posted, '
                + 'doing an assigned job on ground they do not own.';
        case 'placed':
            return 'What they are posted over is one object in two pieces, and the other '
                + 'piece is four provinces away under the other power.';
        case 'encountered':
        case 'known':
            return 'It is a refining vessel. What the execution notices name is what goes '
                + 'into it, and the sword and the shield are what comes out.';
    }
}

/** Everything the Root Cauldron has ever produced, by the mark it leaves. */
export function cameOutOfTheRootCauldron(): readonly ObjectRecord[] {
    return ARTIFACTS.filter(a => a.tags.includes('from:the-root-cauldron'));
}

/**
 * Everything a given party owns. Not artifact-tier-specific in any way.
 */
export function artifactsOwnedBy(ownerId: string): readonly ObjectRecord[] {
    const ids = idsForFaction(ownerId);
    return ARTIFACTS.filter(a => a.ownerId !== null && ids.includes(a.ownerId));
}

/**
 * What this house stands over, where what it stands over is a containment.
 *
 * Derived rather than listed, so a second containment added to the table is on
 * its holder's board the same afternoon and nobody has to remember a roster.
 */
export function containmentHeldBy(ownerId: string): readonly ObjectRecord[] {
    return artifactsOwnedBy(ownerId).filter(a => a.tags.includes('containment'));
}

/** Everything a given person or house is physically holding right now. */
export function artifactsHeldBy(possessorId: string): readonly ObjectRecord[] {
    return ARTIFACTS.filter(a => a.possessorId === possessorId);
}

/** Power levels a party could put on the ground, strongest first. */
export function artifactPowerOf(ownerId: string): number[] {
    return artifactsOwnedBy(ownerId)
        .map(a => a.power ?? 0)
        .sort((a, b) => b - a);
}

/** One artifact by id, or undefined. */
export function getArtifact(id: string): ObjectRecord | undefined {
    return ARTIFACTS.find(a => a.id === id);
}
