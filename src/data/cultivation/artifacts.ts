/**
 * The artifact catalog.
 *
 * One table for every artifact in the world, ordered by `power` descending,
 * because the ordering is the argument: an object an ascended founder sent back
 * down and a notched sabre off a dead bandit are the same kind of row with
 * different numbers in one column. Read top to bottom and the whole hierarchy
 * of force in the setting is legible without a single sentence of explanation.
 *
 * NOTHING HERE IS SPECIAL-CASED, AND THAT IS THE DESIGN
 * There is no immortal-artifact table, no apex tier, no rule anywhere that says
 * the strongest objects behave differently from the weakest, and no branch that
 * checks who is holding one. They are `ObjectRecord`s, made by the same factory
 * that makes a spare robe, with an ownership trail like any looted blade. What
 * makes an apex head hard to kill is that they are carrying something in the forties - the same way
 * a bandit with a 6 is harder than a bandit with nothing, resolved by the same
 * code. Take the object away and the holder is an ordinary cultivator at their
 * own rung with no residue, which is the only reason stealing one is worth
 * writing a story about.
 *
 * Everything `catastrophe.ts` says about the top of the world being unassailable
 * is a description of what these numbers produce when the ordinary resolver
 * reads them. If the resolver stops producing it, the prose is what is wrong.
 *
 * WHAT THE NUMBERS MEAN
 * `power` is on the same ladder a person stands on, so an object at 41 is worth
 * roughly what a cultivator at 41 is worth, and the comparison a player wants to
 * make - is this worth more than the person carrying it - is a subtraction.
 *
 * These are measured rather than chosen. The combat harness ran four hundred
 * seeds a pairing against a head at forty-three and reported what each rating
 * produced; the sent-down objects are set where the outcome matches what the
 * setting says about them, and if the resolver changes, these numbers move
 * rather than the prose being defended.
 */

import { makeObject, type ObjectRecord } from '../../engine/world/possessions.js';
import { idsForFaction } from './hierarchy.js';

/**
 * Every artifact, strongest first.
 *
 * Keep this sorted. The ordering is asserted by the tests, and an entry filed
 * in the wrong place is the one kind of error in this file a reader cannot see.
 */
/**
 * The two ways an object at forty-five comes to be in the world.
 *
 * Forty-five is the ceiling for anything that can be HELD down here, and the
 * reason is in `OBJECT_CEILING_BELOW_THE_LID`: a weapon rated at a rung lets
 * whoever holds it strike at that rung, so a forty-six in a mortal hand would
 * be a way to injure a True Immortal, and there is no such thing. But the
 * ceiling is a ceiling on what STAYS, not on what has ever been here, and that
 * distinction is where the second route comes from.
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
 *
 * `OBJECT_CEILING_BELOW_THE_LID` is forty-five and it is a ceiling on what can
 * be HELD down here, for the reason `realms.ts` gives: an object rated at a rung
 * lets whoever is holding it strike at that rung, so a forty-six in a mortal
 * hand is a way for somebody at forty-four to injure a True Immortal, and there
 * is no such thing anywhere. Nothing in these three rows breaks that. They are
 * not held down here. They are what somebody up there is carrying, and the
 * whole of their behaviour in the lower realm is the ten to fifteen breaths in
 * `BREATHS_IN_THE_LOWER_REALM` and then gone, with the carrier, every time.
 *
 * So they are in this table for the same reason a notched sabre is: because
 * there is exactly one table, the ordering is the argument, and an object that
 * lived in a separate immortal tier would be the precise mistake the header of
 * this file exists to prevent. The columns say the rest without a rule
 * anywhere - `ownerId` is null on all three, so `artifactsOwnedBy` can never
 * return one to any faction, and `possessorId` names a person no party in this
 * world can reach, ask, rob or inherit from.
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

export const ARTIFACTS: readonly ObjectRecord[] = [
    // ── 46: carried, never held. See `NOTHING_AT_FORTY_SIX_IS_EVER_LEFT` ──
    // Three rows with a null owner and a possessor nobody in this world can
    // reach. No faction owns one, no faction has ever held one, and the
    // catalog's own accessors enforce that without a branch: `artifactsOwnedBy`
    // filters on a non-null `ownerId` and there is not one on this band.
    makeObject({
        id: 'carried-the-first-course',
        name: 'The First Course',
        kind: 'artifact',
        significance: 'legendary',
        power: 46,
        ownerId: null,
        ownerName: '',
        possessorId: 'figure-set-hand-eleven',
        description:
            'A carver\'s tool, in the hand of a carver who crossed from driven ground twenty-six centuries ago and files rather than speaks. The Ninth Nail the Long Cut has been standing behind for all of that time is not a piece of this and never was: it is a second, lesser thing, cut deliberately at the rung that can be left, by somebody who knew they would not be here to hold anything.',
        tags: ['immortal-made', 'carried', 'above-the-lid', 'never-below']
    }),
    makeObject({
        id: 'carried-the-second-edge',
        name: 'The Second Edge',
        kind: 'artifact',
        significance: 'legendary',
        power: 46,
        ownerId: null,
        ownerName: '',
        possessorId: 'figure-ru-anjing',
        description:
            'The newest object in existence, three hundred and eighty years old, and the counterpart nobody in the Low Fall has ever considered: the Standing Edge is what she left, and this is what she took. The Azure Cloud Pavilion has built a certification practice, a reputation and most of its standing on the half of the pair she could afford to part with, and has never once asked what the other half is.',
        tags: ['immortal-made', 'carried', 'above-the-lid', 'never-below']
    }),
    makeObject({
        id: 'carried-the-first-datum',
        name: 'The First Datum',
        kind: 'artifact',
        significance: 'legendary',
        power: 46,
        ownerId: null,
        ownerName: '',
        possessorId: 'figure-tao-jingwei',
        description:
            'A reference that is not local, held by the woman who founded the arterial survey and crossed from a site her own register locates precisely and describes not at all. The Datum Lamp in the Deep Survey vault does the same job three rungs down and does it well enough that the Survey has never wondered what it is a smaller version of.',
        tags: ['immortal-made', 'carried', 'above-the-lid', 'never-below']
    }),
    // ── 45: three of them, and no two are held by allies ──────────────────
    makeObject({
        id: 'hollow-unwritten-length',
        name: 'The Unwritten Length',
        kind: 'artifact',
        significance: 'legendary',
        power: 45,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'seat-first',
        description:
            'Carried rather than stored, by somebody at forty-four who uses it as a tool for the crossing and would think describing it to an outsider a waste of an afternoon. Nobody outside the Court has seen it and the Court has never said it exists.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    makeObject({
        id: 'sent-ninth-nail',
        name: 'The Ninth Nail',
        kind: 'artifact',
        significance: 'legendary',
        power: 45,
        ownerId: 'apex-long-cut',
        ownerName: 'The Long Cut',
        possessorId: 'apex-long-cut',
        description:
            'A fixed point in a world where nothing else is fixed. Ground near it cannot be moved, folded or unmade, which settles most fights before anybody swings at anything.',
        tags: ['immortal-made', 'sent-down', 'never-carried', 'known-to-exist']
    }),
    makeObject({
        id: 'artifact-the-standing-edge',
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
        name: 'The Second Silence',
        kind: 'artifact',
        significance: 'legendary',
        power: 44,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'seat-second',
        description:
            'The same, one rung down. What the province knows is that four people went in, and that the mountains are visited while the occupants are not; what it does not know is that all four are carrying something an apex would empty a vault for.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    // ── 43: the most VALUABLE object there is, and the least use in a duel ─
    makeObject({
        id: 'hollow-turned-ledger',
        name: 'The Turned Ledger',
        kind: 'artifact',
        significance: 'legendary',
        power: 43,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'seat-third',
        description:
            'Held by the Third Seat, who stands level with the Deep Survey\'s head and is better equipped than him, and who has never had a reason to be within a province of the man.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    makeObject({
        id: 'hollow-fourth-refusal',
        name: 'The Fourth Refusal',
        kind: 'artifact',
        significance: 'legendary',
        power: 43,
        ownerId: 'sect-hollow-court',
        ownerName: 'The Hollow Court',
        possessorId: 'seat-fourth',
        description:
            'The weakest of the Court\'s four and still the equal of the Long Cut\'s Nail. The Fourth Seat is the youngest and the one most likely to be met, on the grounds that they are the only one who still occasionally answers the gate.',
        tags: ['immortal-made', 'carried', 'undeclared']
    }),
    makeObject({
        id: 'sent-datum-lamp',
        name: 'The Datum Lamp',
        kind: 'artifact',
        significance: 'legendary',
        power: 43,
        ownerId: 'apex-deep-survey',
        ownerName: 'The Deep Survey',
        possessorId: 'apex-deep-survey',
        description:
            'A reference that is not local. Its holder cannot be lied to about where anything is: formations do not resolve against it and concealment does not hold in front of it. It has not left the vault in nine hundred years, and the reason is logistics rather than doctrine - the seat is full of valuable things and the defence is presence.',
        tags: ['immortal-made', 'sent-down', 'never-carried', 'known-to-exist']
    }),
    // ── THE CEILING AT FORTY-ONE ──────────────────────────────────────────
    // Everything above this line was sent down by somebody who crossed.
    // Everything below it was made here, and the band is populated - a house
    // with centuries, a vein and a dao can build most of the way up. What no
    // forge below the Lid has ever passed is forty-one, and the boundary is
    // not scarcity or skill: an object is anchored by whoever finished it, and
    // nobody who finished one was standing above the last realm. So the best
    // thing anybody alive can make sits a rung under the weakest thing that
    // came down, permanently, and every house that has tried to close that
    // rung has produced something that came apart.
    // ── 41: the ceiling, and the only mortal-made thing that reaches it ───
    makeObject({
        id: 'artifact-the-standing-weight',
        name: 'The Standing Weight',
        kind: 'artifact',
        significance: 'legendary',
        power: 41,
        ownerId: 'house-anchorhold',
        ownerName: 'The Anchorhold',
        possessorId: 'house-anchorhold',
        description:
            'The datum stone, chained down under a roof and watched by two people at all times. Twenty-nine centuries of the least dramatic dao in the world went into it and it is the high-water mark of everything made below the Lid: a place that cannot be moved, folded, opened, spread or relocated while it is standing. It is one rung under the weakest sent-down object and the Anchorhold has never claimed otherwise, which is most of why the claim is believed.',
        tags: ['forged', 'the-ceiling', 'immovable', 'known-to-exist']
    }),
    // ── 38-26: what centuries and a dao will buy ──────────────────────────
    makeObject({
        id: 'artifact-the-ninth-volume-case',
        name: 'The Ninth Volume Case',
        kind: 'artifact',
        significance: 'legendary',
        power: 38,
        ownerId: 'house-ninefold-ledger',
        ownerName: 'The Ninefold Ledger',
        possessorId: 'house-ninefold-ledger',
        description:
            'The case the nine sealed volumes sit in, which the Ledger commissioned and which is worth more than most of what it holds. An obligation entered into its presence binds to ground rather than to a name, so it cannot be escaped by becoming somebody else - which in a world where identity is what people shed at realm boundaries is the whole of what an oath is for. Four thousand years of the house\'s trade is inside it.',
        tags: ['forged', 'oath-bearing', 'known-to-exist']
    }),
    makeObject({
        id: 'artifact-the-cold-arterial-key',
        name: 'The Cold Arterial Key',
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
        id: 'artifact-the-severed-ledger-blade',
        name: 'The Severed Ledger',
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
        name: 'The Storm Tally',
        kind: 'artifact',
        significance: 'significant',
        power: 26,
        ownerId: 'sect-storm-tyrant-court',
        ownerName: 'Storm Tyrant Court',
        possessorId: 'sect-storm-tyrant-court',
        description:
            'A lightning curriculum written into a bar of something that was struck often enough to remember it. The Court was held on probation for two centuries and raised to answer the Deep Survey directly because of what is in this object, and it has never let anybody outside read it - which is the entire reason the probation was imposed and the entire reason it was not lifted with the promotion.',
        tags: ['forged', 'curriculum-bearing', 'never-shown']
    }),
    // ── 22-14: what an ordinary strong house fields ───────────────────────
    makeObject({
        id: 'artifact-frostmirror-plate',
        name: 'The Rimeglass Plate',
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
        name: 'The Gate Seal of the Kiln',
        kind: 'artifact',
        significance: 'significant',
        power: 18,
        ownerId: 'sect-kiln-wardens',
        ownerName: 'The Kiln Court',
        possessorId: 'sect-kiln-wardens',
        description:
            'The instrument the Gate Warden carries, which closes a working and holds it closed against the pressure of the vein. It is a tool that happens to be dangerous rather than a weapon that happens to be useful, and the Court has never described it as either.',
        tags: ['forged', 'office-issued']
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
    makeObject({
        id: 'artifact-severed-name-knife',
        name: 'A Cutting Knife',
        kind: 'artifact',
        significance: 'notable',
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
        significance: 'notable',
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

    // ── A SCATTERED WORK, IN THREE HANDS ──────────────────────────────────
    //
    // The Heaven-Conversing Primordial Canon is the only cultivation manual
    // anywhere that continues past ordinal 37, and until now its only route
    // was a dead woman's estate in a shed with a bad roof. One route, at the
    // narrowest point on the ladder.
    //
    // These are the second route. The complete work is still in the shed -
    // that lore is untouched and it is the better prize. What is here is three
    // separate volumes, loose, in three houses, none of which holds more than
    // one. A volume is rated one rung below the whole by `shardPower`, the
    // ordinary rule that turns a broken blade into a worse blade, so a partial
    // set carries a reader less far than a complete one and the engine derives
    // that rather than the catalog asserting it.
    //
    // The three holders are deliberately different KINDS of problem, because
    // the point of scattering a book is that each piece is its own adventure:
    // one house knows exactly what it has, one has no idea, and one knows it
    // holds a third of something and has been looking for the rest for two
    // hundred years. `knownOwnershipBy` differs on each accordingly - it is
    // the difference between stealing a thing that will be missed by name and
    // stealing a thing nobody can describe.
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
        ownerId: 'house-anchorhold',
        ownerName: 'The Anchorhold',
        possessorId: 'house-anchorhold',
        knownOwnershipBy: ['house-anchorhold', 'house-ninefold-ledger', 'sect-azure-cloud-pavilion'],
        description:
            'Catalogued, shelved, and read once a decade by somebody checking it is still the same book. The Anchorhold knows what it is, knows it is a third of something, and has never advertised either fact - a house of surveyors is a house that understands the difference between holding a thing and being known to hold it. It is also the only one of the three that could not read past the fourth page if it wanted to.',
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
        ownerId: 'sect-gleaners-company',
        ownerName: "The Gleaners' Company",
        possessorId: 'sect-gleaners-company',
        knownOwnershipBy: [],
        description:
            'Came out of a burn zone in a bundle of forty-one salvaged documents, was priced by weight, and has been holding a window open in a back office for a hundred and ten years. Nobody in the Company can read it and nobody has asked anybody who can. It is the cheapest of the three to acquire and the hardest to find, which is the ordinary shape of salvage.',
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
        ownerId: 'house-ninefold-ledger',
        ownerName: 'The Ninefold Ledger',
        possessorId: 'house-ninefold-ledger',
        knownOwnershipBy: ['house-ninefold-ledger', 'house-anchorhold'],
        description:
            'The Ledger knows it holds a third of a chaos-grade canon, has known for two hundred years, and has an open standing offer for either of the other two that it has never once described in writing. It does not know the Anchorhold has the first. The Anchorhold does know the Ledger has the third, and has said nothing, for reasons the Ledger would find entirely familiar.',
        tags: ['shard', 'from:heaven-conversing-primordial-canon', 'volume:3', 'sought']
    })
];



/**
 * Everything a given party owns. Not artifact-tier-specific in any way.
 *
 * Resolves through `idsForFaction` so a house that appears in two catalogs -
 * the Azure Cloud Pavilion is both an apex and a joinable sect - answers to
 * either of its ids. Ownership is a fact about the house, not about which
 * table you happened to look it up in.
 */
export function artifactsOwnedBy(ownerId: string): readonly ObjectRecord[] {
    const ids = idsForFaction(ownerId);
    return ARTIFACTS.filter(a => a.ownerId !== null && ids.includes(a.ownerId));
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
