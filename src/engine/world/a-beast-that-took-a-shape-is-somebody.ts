/**
 * A beast past `BEAST_CHANGE_ORDINAL`, standing among people.
 *
 * ── WHO IS SOMEBODY IS THE RUNG, AND THIS FILE USED TO SAY OTHERWISE ────
 *
 * A ruling, and it replaced a documented rule that was argued here at length.
 * The design owner, asked whether a species authored `speaks: false` keeps its
 * silence after crossing 29: *"species can't be categorized as speaks false.
 * under 29 = speaks false."*
 *
 * What that overturned: `speaks` was a column on every row, this file read it
 * and never the ordinal, and the reasoning it carried was that the column was a
 * floor rather than an iff - that the catalog deliberately held things above 29
 * with nothing to negotiate with, and that they were its worst entries for
 * exactly that reason. That is no longer the world. The column is gone from the
 * schema and from all 64 rows, speech derives from the rung alone, and three
 * species that were authored mute above the change now answer.
 *
 * It is written down rather than quietly replaced because a reader who finds
 * the old argument persuasive will re-derive it, and the old argument is
 * genuinely persuasive. It was still overruled.
 *
 * ── AND WHAT IT IS CALLED IS NOT ITS SPECIES ────────────────────────────
 *
 * The same ruling from the other side, on a finding that *I ask the ape for a
 * tuft of its fur* reached nobody: *"they give themselves a name, so you
 * wouldn't ask the ape, you'd ask for their name. calling them an ape in human
 * form is disrespectful."* So crossing 29 is the moment a catalog row stops
 * being how anybody refers to this person. `standUpTheOneOnThisGround` in
 * `a-beast-with-a-core-is-somebody-in-particular.ts` rolls the name; the
 * species stays a fact about what they are and never a form of address.
 *
 * ── TWO AXES, AND THEY ARE INDEPENDENT ──────────────────────────────────
 *
 * What somebody KNOWS and how somebody
 * DEALS are different questions, they come out of different machinery, and a
 * blunt thing that cannot name a house and a careful thing that cannot name a
 * house are two entirely different scenes. Neither axis is new here:
 *
 *   WHAT THEY KNOW    `knowledge_records`, keyed by `holder_id`, read through
 *                     `KnowledgeGate`. Nothing is stored to say somebody is
 *                     ignorant - `unaware` is what the absence of a row reads
 *                     as, and the absence is the ordinary state of everybody
 *                     about almost everything.
 *
 *   HOW THEY DEAL     read, here, off the species row this thing came off:
 *                     the one authored line of temperament, `changedManner`,
 *                     and five statements derived from columns beside it.
 *
 * ── THE KNOWLEDGE HALF NEEDED NO FIELD, AND THAT IS THE FINDING ─────────
 *
 * `beasts.ts` already ruled on this and the ruling is correct: *"A changed
 * beast begins with no records for ordinary life... an absence of records, in
 * the layer that already holds what somebody has a reference for."* That layer
 * exists, it is per-holder rather than per-player, and NPCs already hold rows
 * in it - `askedAbout` reads `isAwareOf(who.id, ...)` to decide whether the
 * person being asked has anything to say, and `whatTheyRecogniseAboutIt` reads
 * `stageOf(them.id, 'sect', house)` as its reference axis. So the bidirectional
 * relation the design wants is what the table already is: two holders, two
 * rows, and either one of them may be missing.
 *
 * What was missing is smaller and is what this file and its caller supply:
 * NOTHING SEEDED AN NPC'S RECORDS FROM WHERE THAT NPC HAD BEEN, and nothing
 * read the result back out as scene facts.
 *
 * ── AND THE DEPTH FALLS OUT OF THE RUNG, NOT OUT OF A FIELD ─────────────
 *
 * The other half of *ancient and foreign* is that it reads ground nobody else
 * can read. That is already keyed on the ladder - `whatTheyCanTellOfTheGround`,
 * `READS_THE_GROUND_AT` - and something at 29 has it in full for the same
 * reason any cultivator at 29 does. So depth comes off the ordinal, ignorance
 * comes off the missing rows, and neither is authored. A thing that has stood
 * on one mountain for four centuries is then exactly what it should be: the
 * best reader of ground in the room and the only person in it who cannot name
 * the house whose disciples are sitting two tables away.
 *
 * ── WHAT MUST NOT BE BUILT HERE ────────────────────────────────────────
 *
 * `WHAT_GIVES_A_CHANGED_BEAST_AWAY.neverAList` governs this file. No table of
 * gaffes, no per-species knowledge profile, no "confused by chopsticks". What
 * is emitted is that there is no record for a named thing, which is a fact;
 * what that looks like at a table is the narrator's and is different every
 * time. **`does not know what this is` is a fact. `is confused` and `is naive`
 * are characterisation and are not ours.**
 */

import {
    BEAST_CHANGE_ORDINAL,
    BEASTS,
    anythingAtThisRungSpeaks,
    type Beast
} from '../../data/cultivation/beasts.js';
import { highestStage, type KnowingStage } from '../social/discovery.js';
import {
    whoDecidesIn,
    type OnTheRoll
} from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';

/**
 * Find the species somebody means, by id, by name, or by the one word people
 * actually say - "fox", "ape", "seam".
 */
export function theSpeciesTheyMeant(wanted: string): Beast | null {
    const asked = wanted.trim().toLowerCase();
    if (asked.length === 0) return null;
    const exact = BEASTS.find(b => b.id === asked || b.name.toLowerCase() === asked);
    if (exact) return exact;
    // THE ABILITY NAME IS PART OF WHAT A SPECIES IS CALLED, and it is the only
    // honest way `fox` reaches the catalog's fox: that entry is named for what
    // it does rather than for what it is, and its fire is `Foxfire`. Reading a
    // comment for it would not be reading the catalog, and adding an alias
    // field would be storing a second name beside the one already there.
    //
    // FROM A WORD BOUNDARY AND NOT FROM ANYWHERE IN THE STRING. A raw
    // `includes` was right while the catalog was small and stopped being the
    // moment it grew: `ape` matched `beast-paper-moth` as well as the White Ape
    // of the Gorge, two matches came back, and the function answered null - so
    // growing the catalog silently took a species away from anybody who typed
    // its ordinary name. The collision is arbitrary and it gets likelier with
    // every row.
    //
    // The START has to be a boundary and the end does not, because the fox is
    // reached through `Foxfire` and the seam through `Seam-Held`. Somebody
    // typing the front of a word means it; somebody typing three letters out of
    // the middle of one does not.
    const from = new RegExp(`\\b${asked.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}`);
    const near = BEASTS.filter(b =>
        from.test(b.id)
        || from.test(b.name.toLowerCase())
        || from.test(b.ability.name.toLowerCase()));
    return near.length === 1 ? near[0] : null;
}

/**
 * Why this species cannot be stood up as a person, or null when it can.
 *
 * READS THE RUNG, AND THERE IS NOTHING ELSE TO READ. This used to read an
 * authored `speaks` column and argue at length that the column was a floor
 * rather than an iff - that the catalog deliberately carried things above 29
 * with nothing to negotiate with. The design owner overruled it: *"species
 * can't be categorized as speaks false. under 29 = speaks false."* The column
 * is gone from the schema and from all 64 rows, so there is exactly one
 * refusal left and it is the one below the change.
 */
export function whyThisOneIsNotSomebody(beast: Beast): string | null {
    if (anythingAtThisRungSpeaks(beast.ordinal)) return null;
    return `${beast.name} stands at ordinal ${beast.ordinal}, below the change at `
        + `${BEAST_CHANGE_ORDINAL}. It is an animal. It has no human shape and no voice, and `
        + 'ADMIN reaches past what a cultivator has heard of - never past what the world holds.';
}

/** Every species that can be stood up in a room, for a refusal that helps. */
export function theOnesThatCanBeStoodUp(): readonly Beast[] {
    return BEASTS.filter(b => anythingAtThisRungSpeaks(b.ordinal));
}

// ─────────────────────────────────────────────────────────────────────────
// HOW THEY DEAL - READ OFF THE ROW, ONE LINE AUTHORED AND FIVE DERIVED
// ─────────────────────────────────────────────────────────────────────────

/**
 * What it reaches for first, off `ability.kind`.
 *
 * The species' one ability is what it has been able to do for its whole life,
 * so it is what it has spent that life doing - and a creature deals with a
 * person the way it has always dealt with everything. Keyed on the ability
 * AXIS rather than on the species, so a new entry in the catalog gets a manner
 * for free and two species with the same axis genuinely do carry themselves
 * alike. Deliberately NOT keyed on `element`: the schema forbids branching on
 * it and is right to, and an element says what a thing is made of rather than
 * how it conducts itself.
 */
const WHAT_IT_REACHES_FOR: Record<Beast['ability']['kind'], string> = {
    defence:
        'Nothing that ever came at it moved it. It says a thing once, does not soften it, '
        + 'does not repeat it, and does not wait to see how it landed.',
    movement:
        'It has never been obliged to stay anywhere. It leaves a dealing the moment the '
        + 'dealing stops being worth its time, including in the middle of a sentence.',
    breath:
        'What it does it does at reach and all at once. It does not close the distance first '
        + 'and it does not say it is about to.',
    perception:
        'It has already looked. It asks after things it can see the answer to, and it marks '
        + 'the difference when the answer it is given is not that one.',
    concealment:
        'It does not show what it is doing while it is doing it. What it says is true and is '
        + 'never the whole of what it is there for.',
    endurance:
        'It outlasts. It lets a dealing run past the point where the other party has nothing '
        + 'left to put into it, and then goes on.',
    strength:
        'It settles things by weight. Talking is what it does when taking the outcome outright '
        + 'is more trouble than it is worth.'
};

/** What its dealings are ABOUT, off what it does with ground. */
const WHAT_IT_WANTS: Record<Beast['veinRelation'], string> = {
    holds:
        'Every arrangement it has ever made was an arrangement about one piece of ground. It '
        + 'holds that ground, it has held it against everything that wanted it, and what it '
        + 'wants from anybody is that they be finished and gone.',
    indifferent:
        'It holds no ground and wants none, so nothing it wants is in anybody\'s deed. What it '
        + 'wants is a thing a person is carrying or a thing a person knows.',
    follows:
        'It goes where the ground is richest and has no attachment to where it is standing. '
        + 'Nothing here is its, and it expects to be elsewhere.',
    drains:
        'What it takes it takes continuously, and the taking has never once stopped because '
        + 'somebody asked it to.'
};

/**
 * What it does about terms, off `disposition`.
 *
 * The same three-way axis the houses are read on, which is the point: this is
 * not a beast scale. `righteous` here means what it means everywhere - nobody
 * pays who did not agree to.
 */
const WHAT_IT_DOES_ABOUT_TERMS: Record<Beast['disposition'], string> = {
    righteous:
        'It keeps terms it agreed to and takes nothing from anybody who did not agree. What it '
        + 'says it will do is what it does, and it has done it for longer than anybody present '
        + 'has been alive.',
    neutral:
        'It prices everything in front of it, including the person it is speaking to, and says '
        + 'the price before anything else. It has never broken terms and has never once '
        + 'forgiven a breach.',
    demonic:
        'It takes first and names the terms afterwards, and the terms are not negotiable once '
        + 'it has taken.'
};

/**
 * Whether the only thing it can want has to be given to it by a person.
 *
 * THE OLDEST FIGURE IN THIS GENRE'S FURNITURE, AND IT IS DERIVED. Three columns
 * together, each doing work:
 *
 *   `nature: intelligent`        it can be dealt with at all
 *   `veinRelation: indifferent`  it wants nothing out of the ground, so what it
 *                                wants is held by somebody
 *   `persistence: open_world`    it spent that life where people are, so it has
 *                                had centuries of practice getting it
 *
 * A creature that wants nothing from the earth and everything from people, and
 * has been among them long enough to be good at it, works on the PERSON rather
 * than on the terms. That is where the trope comes from, and it is a conclusion
 * off three enum columns rather than a species name.
 *
 * NOT `ability.kind`, which has no `seeming` axis - it is defence, movement,
 * breath, perception, endurance, concealment, strength - and the fox's is
 * `breath`, shared with a marsh ambush predator. Keying this there would hand a
 * venomous serpent a manner it has no business with.
 *
 * ONE OCCUPANT TODAY, AND THAT IS NOT AN ID CHECK IN DISGUISE. A column
 * combination with one member is a fact about the catalog, the way every
 * `sealed_only` entry standing above the open-world ceiling is. Add a second
 * creature that wants only what people have and lives among them and it will
 * carry itself the same way, which is correct.
 */
export function worksOnThePersonRatherThanTheTerms(beast: Beast): boolean {
    return beast.nature === 'intelligent'
        && beast.veinRelation === 'indifferent'
        && beast.persistence === 'open_world';
}

/**
 * What it is doing while it deals, when what it wants is held by a person.
 *
 * CONDUCT, NOT A LABEL AND NOT A BODY. Nothing here says alluring, says
 * beautiful, or describes anybody: those are characterisation and costume, and
 * `WHAT_GIVES_A_CHANGED_BEAST_AWAY.notTheBody` forbids the second outright. What
 * is stated is what it DOES - whose side of the exchange it works on, and what
 * it reaches for first - and the scene is the narrator's.
 */
const WORKING_ON_THE_PERSON =
    'What it wants can only be given by a person, and it has spent its life among the people '
    + 'who have it. So it works on whoever is in front of it rather than on the terms: it '
    + 'finds out what somebody wants said and says that first, and being welcome is the thing '
    + 'it reaches for where another creature would reach for a threat.';

/**
 * What they do about a name they have no record for.
 *
 * THE TWO HALVES OF ONE ABSENCE, which `beasts.ts` already states: *"not knowing
 * when at ease, and inventing badly when trying - and the second is the sharper
 * scene, because effort is what exposes it."* Which half shows is not a species
 * fact and not a second field: something that works on the person cannot afford
 * to be the one who has not heard of it, and something that says a thing once
 * has no reason to be anything else.
 *
 * AND THE INVENTED HALF HAS A HOME ALREADY. `SourceKind` carries `fabricated`
 * as a first-class value with an index behind it, so a lie told to pass is meant
 * to be a row with a flag rather than a way of writing a line. Nothing writes
 * one from somebody's account of THEMSELVES yet - see `OPEN-QUESTIONS.md` - so
 * this states the conduct and does not claim a row that was never written.
 */
export function whatTheyDoAboutANameTheyDoNotHave(beast: Beast): string {
    return worksOnThePersonRatherThanTheTerms(beast)
        ? 'Does not say that it has not heard of it. It agrees with whatever the asker seems '
          + 'to hold about the thing and carries on from there, and what it adds is wrong in '
          + 'the way only somebody who has actually been there would catch.'
        : 'Says so, once, and does not soften it.';
}

/**
 * What a life alone or a life in numbers left in it.
 *
 * `groupSize` is the catalog's own count and needs no threshold: one is one.
 */
function whatCompanyDidToIt(beast: Beast): string {
    return beast.groupSize === 1
        ? 'It has never in its life had to agree with anybody. It does not defer, does not '
          + 'consult, and does not register that somebody is waiting for it to.'
        : `It lived its whole life in numbers - ${beast.groupSize} of them together is ordinary `
          + 'for its kind - so the first thing it reads in a room is who in it is deferring '
          + 'to whom.';
}

/** Whether it has had people to practise on, off `nature` and `persistence`. */
function howMuchOfPeopleItHasHad(beast: Beast): string {
    if (beast.persistence === 'sealed_only') {
        return 'Nothing has come to it in centuries. Whatever it last learned about how people '
            + 'do things, it learned from the last people who were here, and they are dead.';
    }
    if (beast.nature === 'intelligent') {
        return 'It has dealt with people before and knows what a bargain is. That is practice at '
            + 'bargaining and is not the same as having been raised among them.';
    }
    return 'It was here before anybody standing in front of it, and has had no occasion to deal '
        + 'with anyone in a very long time.';
}

/**
 * How this one deals with people, read off its species row.
 *
 * The species' own temperament first, then five statements from five columns
 * that were already there. Adding a species to the catalog gives it a manner
 * without touching this file. If this ever needs a table keyed on `beast.id`,
 * something has drifted - the per-species line lives on the row, not here.
 */
export function howThisOneDealsWithPeople(beast: Beast): string[] {
    return [
        // WHAT KIND OF THING IT WAS, STILL SHOWING. `changedManner` is authored
        // on every row for exactly this scene and was built and never read, so
        // a fox and a weasel crossed into the same five sentences. A changed
        // beast that behaves like nothing in particular is a person carrying a
        // species for no reason.
        beast.changedManner,
        WHAT_IT_REACHES_FOR[beast.ability.kind],
        // The vein line says what it wants; where what it wants is held by a
        // person, the same column says something sharper about how it goes
        // after it, and that replaces rather than joins - two sentences about
        // one want is the engine saying a thing twice.
        worksOnThePersonRatherThanTheTerms(beast)
            ? WORKING_ON_THE_PERSON
            : WHAT_IT_WANTS[beast.veinRelation],
        WHAT_IT_DOES_ABOUT_TERMS[beast.disposition],
        whatCompanyDidToIt(beast),
        howMuchOfPeopleItHasHad(beast)
    ];
}

/** The structural row behind the manner, so an operator can see it derived. */
export function whereTheMannerCameFrom(beast: Beast): string {
    return `${beast.name}: manner read off the species row - changedManner (authored for `
        + `the kind), ability ${beast.ability.kind} (${beast.ability.name}), vein relation `
        + `${beast.veinRelation}, disposition ${beast.disposition}, group size `
        + `${beast.groupSize}, nature ${beast.nature}, persistence ${beast.persistence}. `
        + 'Nothing was stored for this individual.';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THEY HAVE A RECORD FOR - READ, NEVER ASSERTED
// ─────────────────────────────────────────────────────────────────────────

/** One thing the gate was asked about, and what it answered. */
export interface ARecordAskedFor {
    readonly kind: 'sect' | 'place' | 'cultivator' | 'event';
    readonly name: string;
    readonly stage: KnowingStage;
}

/**
 * Turn what the gate answered into facts.
 *
 * THE CALLER ASKS THE GATE. This function never touches storage and never
 * decides that somebody is ignorant - it is handed stages that were read and
 * says what they are. That ordering is the whole honesty of it: if a row is
 * ever written for one of these names, the fact changes by itself.
 */
export function whatTheyHaveARecordFor(asked: readonly ARecordAskedFor[]): {
    none: readonly ARecordAskedFor[];
    held: readonly ARecordAskedFor[];
    lines: string[];
} {
    const none = asked.filter(a => a.stage === 'unaware');
    const held = asked.filter(a => a.stage !== 'unaware');
    const lines: string[] = [];

    if (none.length > 0) {
        // SAID AS A FACT ABOUT THE PERSON, NOT AS AN OMISSION. Leaving the
        // institutional facts out entirely is the likelier failure and the
        // worse one: a narrator cannot write an absence it was never told
        // about, and what it writes instead is a stranger who happens to say
        // nothing. So the absence is stated, in one short sentence.
        lines.push(
            `Has never heard ${none.length === 1 ? 'the name' : 'any of the names'} `
            + `${listOf(none.map(a => a.name))}. Not forgotten and not mistaken - `
            + 'never said in front of them.'
        );
    }
    for (const one of held) {
        lines.push(`${one.name}: ${one.stage}.`);
    }
    return { none, held, lines };
}

/**
 * What the rung gives them of the ground, said as the other half.
 *
 * Emitted beside the missing records on purpose. Separated, the two read as a
 * powerful thing and an ignorant thing; together they read as what they are,
 * which is one person whose reference was acquired somewhere nobody else has
 * been.
 */
export function whatTheirRungGivesThemInstead(beast: Beast, ordinal: number): string[] {
    return [
        // SHORT AND CONCRETE, and three of them rather than one paragraph. A
        // character who only lacks things is a simpleton; one who lacks the
        // courtesies and knows the mountain is a person, and the depth has to
        // be as visible as the gap or the gap is all that gets written.
        `Reads the ground here completely: what is under it, what it gives back, and what has `
        + `been taken out of it. At ordinal ${ordinal} that is what the rung affords anybody.`,
        `Spent that whole ladder on ${beast.biome} ground - the water there, the seasons the qi `
        + 'turns on, and what has crossed it, for as long as it has been standing on it.',
        // The catalog's own line about this individual. Read, not written: it
        // is the one place the world says where this particular thing has been.
        beast.note
    ];
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE OTHER END OF IT, WHICH IS NOT STORED ANYWHERE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a house knows of somebody: whatever the best-placed person on its roll
 * knows, and nothing else.
 *
 * NO HOUSE CARRIES AN AWARENESS RECORD AND NONE SHOULD. A house is not a thing
 * that can hear something; the people on its roll are, and they tell each
 * other. So this is a read over the roll rather than a store, it cannot drift
 * from the people it is derived from, and "the house has never heard of it"
 * means precisely that nobody on the roll has - which is the only thing it
 * could honestly mean.
 *
 * WHICH ANSWER IS AUTHORITATIVE, BECAUSE THERE ARE TWO IN THE REPO.
 * `knowledge_records` says whether a name has ever reached one named person;
 * `what-people-are-saying.ts` says what is in circulation at a PLACE, which is
 * a different question with a different subject and is not a second answer to
 * this one. The order is: circulation is how a fact travels, a row is what the
 * travelling left behind in somebody. **A row, where one exists, is the
 * authority on what that person knows.** Circulation is the authority on what
 * is available to be picked up here, and on nothing else. Neither reads the
 * other's storage, so they cannot disagree - they answer different questions.
 *
 * Bidirectionality needs no relation table for the same reason: what this
 * person knows of that one is a row held by this person, and the converse is a
 * row held by that one. Either may be missing, and usually both are.
 */
export function whatThisHouseKnowsOf(input: {
    roll: readonly OnTheRoll[];
    /** How many rungs this house's own ladder has. `whoDecidesIn` takes it too. */
    rankCount: number;
    stageFor: (holderId: string) => KnowingStage;
}): WhatAHouseKnows {
    // WHO DECIDES IS NOT WHO HEARS, so the roll is read twice rather than
    // filtered once. `whoDecidesIn` answers the first question and is reused
    // verbatim for it; the second question is every name on the roll, because
    // an outer disciple who heard a rumour IS the house having heard of it.
    //
    // Both are wanted and neither substitutes. A house whose gate porter has
    // heard a name has heard it; a house whose head has heard it can act on
    // it, and the difference between those two states is most of what a player
    // is actually manoeuvring in. The weighting in
    // `what-a-body-wants-is-what-its-deciders-want.ts` is not carried over -
    // it weights a body's WANT, which is a mean of opinions, and knowing is
    // not a mean of anything. One person who has heard is not half-heard.
    const deciders = new Set(
        whoDecidesIn({ roll: input.roll, rankCount: input.rankCount }).map(d => d.id)
    );

    let anybody: KnowingStage = 'unaware';
    let whoCarriesIt: string | null = null;
    let deciderStage: KnowingStage = 'unaware';
    let whichDecider: string | null = null;

    for (const person of input.roll) {
        const theirs = input.stageFor(person.id);
        if (highestStage(anybody, theirs) !== anybody) {
            anybody = theirs;
            whoCarriesIt = person.id;
        }
        if (deciders.has(person.id) && highestStage(deciderStage, theirs) !== deciderStage) {
            deciderStage = theirs;
            whichDecider = person.id;
        }
    }
    return { anybody, whoCarriesIt, deciders: deciderStage, whichDecider };
}

export interface WhatAHouseKnows {
    /** The best any name on the roll holds. The house has heard of it at all. */
    anybody: KnowingStage;
    /** Who that is, or null when nobody on the roll has heard of it. */
    whoCarriesIt: string | null;
    /** The best any of its deciders holds. What the house could act on. */
    deciders: KnowingStage;
    whichDecider: string | null;
}

function listOf(names: readonly string[]): string {
    if (names.length <= 2) return names.join(' and ');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
