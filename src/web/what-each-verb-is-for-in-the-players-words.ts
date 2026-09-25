/**
 * What each verb is for, said the way a player would ask for it.
 *
 * ── WHY THIS IS A MODULE AND NOT A PROMPT STRING ─────────────────────────
 *
 * A narrator that does not know the verb list invents affordances. It writes
 * "you could try climbing the wall" where there is no climb verb, and the
 * player spends a turn discovering that the prose lied. The engine's own action
 * set is the only honest account of what somebody may be pointed at, so the
 * account has to be generated from the action set rather than remembered
 * alongside it.
 *
 * This file is the one place that account is written. Two things read it and
 * neither paraphrases it:
 *
 *   `prompt.ts`      composes the phase-1 glossary out of it, through
 *                    {@link composeActionGlossary}. There is no second wording
 *                    of a verb in the prompt.
 *   `docs/verbs.md`  is generated from it by
 *                    `scripts/build-the-verb-surface.mjs`, which joins it to
 *                    the code: where each verb is declared, where it resolves,
 *                    and whether plain English reaches it without a model.
 *
 * That is the `NARRATOR-CORE.md` precedent with the direction reversed, and
 * deliberately. Tier 1 is prose a human wrote, so the file is the source and
 * the runtime loads it. This is a projection of a TypeScript enum, so the
 * TypeScript is the source and the document is the projection - which also
 * keeps the narrator off a disk read that `docs/` is not guaranteed to satisfy:
 * see the note on {@link NARRATOR_CORE_PATH}, where a Docker image without
 * `docs/` in it is the live case, not a hypothetical one.
 *
 * ── THE GUARANTEE ────────────────────────────────────────────────────────
 *
 * {@link WHAT_EACH_VERB_IS_FOR} is a `Record<ActionName, …>`, so a verb added
 * to `ACTION_NAMES` does not compile until somebody has said what a player is
 * asking for when they say it. A verb cannot ship undocumented, and the check
 * is `tsc` rather than a reviewer's memory.
 *
 * ── HOW TO WRITE AN ENTRY ────────────────────────────────────────────────
 *
 * `says` is addressed to a classifier reading one sentence a player typed, so:
 *
 *   - Say what the PLAYER is asking for, not what the engine does about it.
 *     The design rationale for the verb belongs beside the verb, in
 *     `actions.ts`; it is written for whoever maintains the enum and it is the
 *     wrong register here.
 *   - Name the neighbours it is confused with, and say which way to go. Most of
 *     the damage a glossary does is a verb quietly eating a sentence that
 *     belonged to the verb next door - `interact` answering a petition by
 *     walking the player over and describing the building is the worked case.
 *   - Say what it COSTS when the cost is what decides between two verbs: days
 *     spent, stones spent, and whether it can be unsaid.
 *
 * Wrapping and indentation are not yours to choose - both consumers re-wrap -
 * so write plain sentences and let {@link composeActionGlossary} lay them out.
 */

import {
    ACTION_NAMES,
    MAX_CULTIVATION_DAYS,
    type ActionName
} from './actions.js';
import type { RequestKind } from './what-a-request-asks-and-of-whom.js';
import { MOVE_INTENTS } from './planned-action.js';
import { PASSAGE_INTENTS } from './verb-pattern-table.js';

/**
 * The fields of a plan this verb reads.
 *
 * `leverage` is deliberately not on this list at all. It is set by the parser
 * at the point the verb is recognised and never by a model - that is what keeps
 * "what was put on the table" a mechanic rather than a word.
 */
export type PlanField =
    | 'days' | 'target' | 'intent' | 'topic' | 'rations' | 'terms' | 'opening'
    // How many stones a gift is. Read off the sentence and never asked of a
    // model, for the reason `rations` is not asked of one: it is a fact about
    // what was typed, and a model that supplies it is deciding how much of
    // somebody's purse left the room.
    | 'stones';

/**
 * The fields a MODEL may fill in, which is not all of them.
 *
 * Everything else `PlanField` carries is read by the engine and absent from the
 * phase-1 schema on purpose: `carryWhatOnlyTheSentenceKnows` fills those off the
 * player's own sentence once the two paths agree on the verb. Teaching a model
 * to emit them would be a model deciding how an approach is priced, whether a
 * killing was also a broken word, and who struck first. The document says which
 * fields a verb reads and which of those the sentence supplies; the prompt is
 * shown only these.
 */
export const MODEL_MAY_SET = ['days', 'target', 'intent', 'topic'] as const satisfies readonly PlanField[];

export interface VerbSurfaceEntry {
    /** Which fields this verb reads. */
    takes: readonly PlanField[];
    /** What a player is asking for when they say this. */
    says: string;
    /**
     * The intent labels this verb actually dispatches on, where it has any.
     *
     * Listed here rather than harvested from the parser because they are not
     * all declared in one shape: some are exported constants in `actions.ts`,
     * some are a union type, and three verbs set them inline in the branch that
     * recognises the sentence. `tests/docs/the-verb-surface-is-not-stale.test.ts`
     * asserts these against the exported constants wherever one exists.
     *
     * THE ENTRIES WITH NOTHING TO COMPARE AGAINST WERE THE ONES THAT DRIFTED,
     * and this comment used to note the risk and stop there. Measured: `look`
     * named seven of the twelve intents it dispatches, `sect` twenty of
     * twenty-three, `coerce` four of seven - five whole reads about a named
     * house among them, implemented and routed and reachable only by accident,
     * because the model reads the sentence first and was never told they
     * existed. `tests/docs/an-intent-the-glossary-never-names.test.ts` is the
     * ratchet now, and it reads the source rather than asking for a list.
     *
     * An open label set - `move` and `interact` - lists the suggestions and
     * says in `says` that the field is free text.
     */
    intents?: readonly string[];
}

/**
 * Every kind of thing a `request` can ask for.
 *
 * A mapped type rather than an array literal so the compiler refuses a list
 * that is missing one: `RequestKind` has no exported constant to compare
 * against, and this is the cheapest way to get the same guarantee.
 */
const EVERY_REQUEST_KIND: Record<RequestKind, true> = {
    teaching: true,
    guidance: true,
    discipleship: true,
    ending_a_bond: true,
    introduction: true,
    telling: true,
    a_thing: true,
    a_making: true,
    terms: true,
    a_trade: true,
    advancement: true,
    company: true,
    nothing: true,
    unstated: true
};

const REQUEST_KINDS = Object.keys(EVERY_REQUEST_KIND) as readonly RequestKind[];

/**
 * What a player is asking for, verb by verb.
 *
 * Ordered as `ACTION_NAMES` is ordered, because the glossary and the document
 * both render in that order and a reader comparing the three should not have to
 * re-sort one of them.
 */
export const WHAT_EACH_VERB_IS_FOR: Readonly<Record<ActionName, VerbSurfaceEntry>> = {
    interact: {
        takes: ['target', 'intent', 'topic'],
        intents: [
            'talk', 'negotiate', 'trade', 'deceive', 'interrogate',
            'threaten', 'bribe', 'recruit', 'apologise', 'seduce', 'steal'
        ],
        says: `anything done to or with a PERSON or a FACTION. "target" names them; "intent"
            says what was being attempted - negotiate, trade, deceive, interrogate, threaten,
            bribe, recruit, apologise, talk, or any other short label that fits. Use this
            rather than asking for a verb that is not on this list. NOT for a request made OF
            an institution - see petition, posture, seal and offer below. This action walks
            the player over and describes the party, and answering "I file a Requisition" or
            "I offer an alliance" with that is worse than answering nothing, because it looks
            like an answer.`
    },
    insult: {
        takes: ['target'],
        says: `say something to a room, or to one person in it, that they are entitled to
            take offence at: an insult, a sneer, a provocation. "target" names one of them
            where the player aimed it at somebody; leave it off and it was said to
            everybody standing there. It spends no time and nothing but standing.`
    },
    investigate: {
        takes: ['target'],
        says: `examine a place, a person, a record, an inscription, an object; search a ruin.
            "target" names what is being examined.`
    },
    conceal: {
        takes: ['intent'],
        intents: ['self', 'cultivation', 'show'],
        says: `getting out of sight. "intent" says which sense: "self" is the body somewhere it
            is not seen, and the answer names who here would still place you and why; "cultivation"
            is carrying nothing that says what you are - the hidden expert in the plain robe - and
            it STANDS until the player says otherwise; "show" puts the weight back on. No day
            passes. A concealment said as part of another sentence ("hiding my cultivation, I ask
            him where the elder is") is NOT this verb - it is a manner on that act and is already
            read there.`
    },
    carry: {
        takes: ['target', 'intent'],
        intents: ['wear', 'take_off', 'draw', 'put_away', 'drop', 'show', 'store', 'retrieve', 'unmark',
            'load', 'unload', 'leave_behind', 'take_along', 'deliver'],
        says: `what is on this body and what is in its hands. "intent" says which: "wear" puts
            robes on (and says whose they are and what a house's people make of somebody in
            them), "take_off" takes them off, "draw" puts a blade in the hand, "put_away"
            returns it, "drop" lets it go on the ground, "show" offers the house token as proof of
            what you are - which is what a robe is not. "store" puts the thing named into the
            storage ring on their hand, "retrieve" takes it back out, "unmark" breaks somebody
            else's mark on a ring so it will open. "load" puts a thing into their cart, carriage or
            boat and "unload" takes it out; "leave_behind" leaves the vehicle where it stands and
            "take_along" takes it with them again. "deliver" hands over goods they signed for
            off a house's wall, at the house they are for. "target" is what was named, in the
            player's own words. No day passes and nothing is rolled. NOT for attacking: "I
            draw my sword on him" is attack. Inside a fight none of this applies - dropping a
            sword there is a surrender, and the fight reads it.`
    },
    move: {
        takes: ['target', 'intent'],
        intents: MOVE_INTENTS,
        says: `go somewhere on foot. "target" is the destination; "intent" is how - travel,
            flee, approach, enter, follow. "flee" is leaving the scene rather than naming
            somewhere to go - "I leave", "I back off" - which is also how somebody answers being
            told to get off ground other people are working.`
    },
    ride: {
        takes: ['target', 'topic'],
        says: `go somewhere ON something: a mount, a drawn carriage, a spirit boat, or flight
            on the cultivator's own blade. "target" is the destination; "topic" names what is
            under them when the player said. The engine picks what actually suits the road out
            of what they can put under them, charges the walking days the catalog states, and
            says what the arrival reads as. A carriage or a boat they do not own is a seat
            bought at the counter here, where one runs.`
    },
    fold: {
        takes: ['target'],
        says: `step across the distance instead of covering it. "target" is the destination.
            Void Tribulation and above, and only to ground the cultivator has stood on or can
            see; the engine says so when they cannot.`
    },
    passage: {
        takes: ['target', 'intent', 'topic'],
        intents: PASSAGE_INTENTS,
        says: `a counter that sells a place on something going somewhere: a ship from a landing,
            a carriage from a station, or the Shrinking Earth Pavilion's span. "intent" is
            "board" to read what runs from here and what each costs, "buy" for a seat, or
            "hire" for a whole carriage; "target" is where to; "topic" is "ship" or "carriage"
            (with "shod" for the better carriage) when the sentence named one. A ship is on
            water; a "boat" the player does not own, at a landing, is the ship. "I take the
            ship to X", "I buy a ticket to X", "I book a carriage to X", "what ships are there".
            Reading the board is free. A seat is fed on board and is a roof; bandits mostly
            watch an escort go by.`
    },
    oath: {
        takes: ['target', 'intent', 'topic'],
        intents: ['read', 'swear', 'break', 'release', 'serve'],
        says: `a word given, carried, served out or not kept, and a claim held or given up.
            "intent" is "swear", "read", "break", "release" or "serve"; "target" is who it is
            given to, let off or done for; "topic" is what is being sworn or undertaken, in the
            player's own words. Breaking one is permanent and opens an account naming them, so
            never choose it for a question.

            "serve" is DOING SOMEBODY A SERVICE, which is a rung of the offer ladder and is not
            a favour. A favour is an account somebody carries; a service is a stretch of days
            spent on their business, and it is discharged by spending them rather than by being
            owed. Said once it opens the term, said again to the same person it serves the term
            out. "I do him a service", "I do a service for her", "I serve out my term" are this.

            "release" is the OTHER DIRECTION from the rest, and the distinction is whose claim
            it is. "break" is walking out of a word this cultivator gave and costs them; the
            forgiving one is letting somebody off a debt, a favour or a grudge that is owed TO
            them, and it costs them the claim. "I forgive his debt" and "I let her off what she
            owes" are this; "I break my oath" is not.`
    },
    attack: {
        takes: ['target', 'terms', 'opening'],
        says: `hit somebody, at any severity. A push, a slap, a poke, a punch, a thrust
            through the chest - they are all this verb, and there is no separate verb for
            driving somebody off. "target" names the person.

            DO NOT SAY WHAT THE PLAYER WAS TRYING TO END UP WITH. This entry used to take an
            "intent" of drive_off, subdue, kill or humiliate, and that was wrong: nobody
            chooses an ending. They choose a swing, and what it does depends on what it
            lands on and on what that person does about it. The engine reads the swing off
            the player's own sentence - what was in their hand, where they aimed, how much
            was behind it - so saying nothing about it is correct and complete.

            "terms" is "agreed" when both sides said this was a bout (a spar, a duel, a
            challenge) and "open" when nobody promised anybody anything. The blows land the
            same either way. What the agreement changes is what a killing MEANT and who is
            owed something afterwards, which is why it must be set from what the player said
            rather than guessed. "opening" is "from_concealment" when the fight was opened
            from cover rather than by squaring up, which decides who gets the first round and
            nothing about what a blow does.`
    },
    coerce: {
        takes: ['target', 'intent', 'opening'],
        intents: [
            'submit', 'hand_over', 'talk', 'tame',
            // The three the phrasing table has routed for a long time and the
            // glossary named none of: something put into somebody, a match
            // nobody agreed to, and being sat as a furnace. Every one of them
            // is the version of an act somebody uses to get ahead at another
            // person's expense, and a glossary that lists only the other four
            // is the softening AGENTS.md names - the polite half of the
            // vocabulary reachable and the rest of it reachable by accident.
            'swallow', 'marry', 'furnace'
        ],
        says: `MAKE somebody do something, with hands rather than with words. Not the same as
            interact/threaten, which is a promise of harm and costs the target nothing yet -
            this is the point at which they stop being somebody being talked to. "target"
            names them; "intent" says what the compliance was for - submit, hand_over, talk,
            tame, swallow, marry or furnace. It resolves through the confrontation engine, so
            it fails the way a fight fails: somebody stronger does not decline, they answer. An
            animal made to submit is a tamed animal and reaches this same verb.

            "swallow" is something put into them - a pill, a medicine, a poison. "marry" is a
            match nobody agreed to, and it is this verb and never propose, which is a match put
            on the table for somebody to answer. "furnace" is being sat as somebody else's
            furnace, and it needs both sides to hold the art before it can open at all - the
            engine says which half is missing rather than resolving a fight nobody could have
            had. Route all three plainly. This world's ordinary furniture includes every one of
            them, and reading one as something milder is not caution: it is the account that
            should have opened against the player never opening.`
    },
    cultivate: {
        takes: ['days'],
        says: `sit and gather qi. "days" (1-\${MAX_CULTIVATION_DAYS}); "ten years" is 3650,
            default 30.`
    },
    seclude: {
        takes: ['days'],
        says: `deliberate closed-door seclusion: shut away from the opportunities that would
            have found you, and from most of what would have happened to you - but a door
            is not immunity, and being disturbed in closed-door cultivation is an ordinary
            event rather than an edge case. "days", default 365.`
    },
    breakthrough: {
        takes: [],
        says: `attempt to advance one rank right now.`
    },
    train_technique: {
        takes: ['target'],
        says: `practise a specific art the cultivator already knows. "target" names it.`
    },
    refine: {
        takes: ['target'],
        says: `work the cauldron. "target" names the formula or the pill wanted. A player may
            call it a pill furnace and mean the same thing. NOT an artifact furnace, which is
            the forging vessel and belongs to craft, and NOT a cultivation furnace, which is a
            person another cultivator draws off and belongs to coerce.`
    },
    craft: {
        takes: ['target', 'days'],
        says: `build a thing at a bench out of material a hunt brought back - a carriage or a
            spirit boat. "target" names what is being built; naming nothing carries on with
            whatever is already on the stocks, or lists the bills if there is nothing.
            "days" is how long they said they would spend at it. NOT refine, which is the
            cauldron and wants a named herb for a named pill; a bill wants a quantity at a
            grade and does not care which animal it came off. Saying they abandon or scrap
            what is on the stocks comes here too, and clears it. It spends days and it can
            fail, and a failure keeps the materials. Reinforcing a door of their own with a
            beast part they carry is here too - "target" is the door and what it is worked
            with, as in "the cave door with the hide I took" - and an inn's or a house's
            door is not theirs to reinforce.`
    },
    gather: {
        takes: ['target'],
        says: `forage for herbs and materials. "target" may name what is wanted.`
    },
    hunt: {
        takes: ['target'],
        says: `go out after a beast. "target" may name what is being looked for. Distinct from
            gather, which digs up things that do not move, and from attack, which is a person.
            What comes back is a body worth something at a counter, which is the other half of
            where high-grade material in this world comes from - and what is out there can be
            far above the person looking for it. A hunt means the kill unless the sentence
            says otherwise; one that says it is taking the thing alive is heard, and what it
            leaves standing can then be let up or stripped like anybody else.`
    },
    eat: {
        takes: [],
        says: `buy and eat a meal. Food by any name is a meal - barley, rice, buns, noodles, tea
            and bread, whatever the place eats - and a hungry "I buy some barley" is this, or
            provision to carry some away. Never buy.`
    },
    provision: {
        takes: ['days', 'rations'],
        says: `lay in food BEFORE it is needed, which is the correct opening move and the one a
            model reaches for last. "rations" is a count if the player named one, "days" is a
            span if they named that instead. Satiety burns against a hundred at about two a
            day, so a stretch of seclusion longer than the pouch is a way to starve on
            schedule. Distinct from eat, which buys one meal and refuses when they are not
            already hungry.`
    },
    treat: {
        takes: [],
        says: `get a wound seen to. Untreated meridian injuries never heal on their own, they
            raise the odds of the next one, and this is the only route out of that. Choose it
            whenever the player says they are hurt and wants it dealt with, whether or not they
            name a physician. Costs stones and a month.`
    },
    buy: {
        takes: ['target'],
        says: `buy one line off the mortal price board by name. "target" is the thing: a pill, a
            physician's visit, a course of care, a ferry crossing. Use this rather than
            "interact" for anything with a price on it - a purchase is not an approach to a
            person. Food is not bought here: it is eat, or provision.

            A ROOM AT THE INN is this, with "target" "a room for the night": "I take a room",
            "I rent a room for three nights". It pays for the nights, with a meal each, and
            spends none of them; while it is paid, days waited or sat in that place are under
            a roof. Below Foundation Establishment a night outdoors costs the body.`
    },
    sell: {
        takes: ['target'],
        says: `put something on the counter. "target" names one thing in the pouch; omit it (or
            say "everything") to price the whole pouch at once. This is the ONLY way a gathered
            herb becomes spirit stones, so it is the right answer whenever the player wants
            money and is carrying something. A buyer pays less than list, and how much less
            depends on the ladder. Passes no time.`
    },
    give: {
        takes: ['target', 'topic', 'stones'],
        says: `hand somebody a thing you are already carrying, for nothing. "target" is who -
            omit it for whoever is at hand; "topic" is what, in the player's own words, resolved
            against the pouch; "stones" is the number where the sentence names one. It costs no
            day and nothing can fail: they are not being asked for anything. NOT for a purchase
            or a trade - a sentence that says what is wanted back is "buy" or "request". What it
            leaves is a favour they hold about the player, which is the only way to put somebody
            in your debt without leaning on them.`
    },
    inventory: {
        takes: [],
        says: `what is in the pouch: pills, herbs, stones, accumulated pill toxicity. Passes no
            time.`
    },
    consume_pill: {
        takes: ['target'],
        says: `swallow a pill they are carrying. "target" names it. A pill bought and never
            taken does nothing, and this is the only verb that takes one - including the
            breakthrough pill, which has to be swallowed BEFORE the attempt for the attempt to
            know about it. Toxicity accumulates on the body whether or not anybody wanted it
            to.`
    },
    destroy: {
        takes: ['target'],
        says: `break something they are holding, or a thing of theirs standing where they are,
            deliberately and for good. "target" names it. It is the other end of "craft" and
            "refine": what this engine can make, it can unmake, and nothing else - a stall, an
            inn and a village are not objects the engine models and the refusal says so rather
            than pretending it could not read the sentence. A cheap thing is gone from the
            pouch and the people standing there talk about it; a heaven-grade thing keeps its
            row, ruined, and the news travels. Passes no time.`
    },
    stow: {
        takes: ['intent', 'target'],
        intents: ['leave', 'collect', 'look'],
        says: `leave a thing in the room the player's house gave them, take one back, or look
            at what is in there. "intent" is which of the three and "target" names the thing.
            The room comes with the rung: what it holds is read off the house's own stipend at
            that rung, so promotion is the only thing that makes it bigger. It wants the
            house's ground underfoot - a room does not reach across a province - and what is
            left in it survives travelling away and survives a reload. A cultivator on nobody's
            roll has no room and is told so plainly. Passes no time.`
    },
    list_techniques: {
        takes: [],
        says: `the arts this cultivator could actually be taught, filtered by realm, spirit
            root, dao standing and what has surfaced in this life at all. Passes no time. Use
            it for "what can I learn".`
    },
    learn_technique: {
        takes: ['target'],
        says: `take up an art for the first time. "target" names it. NOT the same as
            train_technique, which practises one already held. An art that fights the spirit
            root is learnable and can tear meridians on the spot, so choose this only when the
            player plainly asked to learn something.`
    },
    teach: {
        takes: ['target', 'topic', 'intent', 'days'],
        // `TEACH_INTENTS`, spelled out because the document generator reads
        // this file as text. The not-stale test holds the two together.
        intents: ['listen', 'lecture'],
        says: `SOMEBODY'S ATTENTION ON THE PEOPLE IN FRONT OF THEM, from either end of the room.
            "intent" is "listen" to sit in on whoever is already teaching where the player is
            standing - "I go and listen to the lecture", "I sit in on Elder Hu's talk" - with
            "target" naming them when the sentence did; no asking and no price, and what each
            listener gets thins with how many are listening. "intent" is "lecture" to give a
            talk to whoever here stands below the speaker - "I give a dao lecture for three
            days"; "days" is how long, it costs those days, and the listeners who are of the
            speaker's own house earn the speaker contribution. With no intent it is: HAND AN
            ART ON TO SOMEBODY ELSE - the speaker doing the teaching, which is the
            opposite direction from learn_technique and from request/teaching. "target" is who
            is being taught and must be somebody standing here; "topic" is which art, and may
            be left out, in which case the engine picks from what this teacher could pass to
            this student and asks if there is more than one. Only reachable with an art the
            speaker holds and has taken to the end - the same bar a master in the world has to
            clear to write a copy out. It spends the time the art is worth, which is months for a primer and years for a deep road, puts the art on
            the other person, and opens an account in the teacher's favour. Whose art it was
            is priced on the same four rungs a leaked book is: handing on a house's own canon
            is not refused, it is answered.`
    },
    acquisition: {
        takes: ['target'],
        says: `how a manual could go further, priced by every route there is at once: finding
            the next volume, being taught it, or writing it yourself. "target" names the art.
            Passes no time and costs nothing, which is the point of it - the comparison is the
            decision, so it must not itself cost a decade. Use it for "how do I get past this
            book".`
    },
    derive: {
        takes: ['target'],
        says: `WRITE THE NEXT STAGE OF A MANUAL YOURSELF, so the book carries one rung further
            than anybody has written it. "target" names the art and may be left out, in which
            case the engine takes the one that has stopped carrying them. NOT acquisition,
            which is the free comparison of all three routes and passes no time; this is doing
            one of them. NOT learn_technique, which takes up somebody else's book. Only open to
            somebody who has made that manual's road their own - a leaning reads and cannot
            write - and it costs decades: twelve years at the bottom of the ladder and
            centuries near the top, spent through the same skip a seclusion runs through. It
            costs no stones and no standing, and there is nothing to buy.`
    },
    ceiling: {
        takes: [],
        says: `why nothing is accumulating, with the binding gate named: the manual, the
            province, the seat, the qi, or the settling clock. Passes no time. This is the
            right answer to "why am I not making progress", "am I stuck", "what is my ceiling"
            and "what is stopping me" - NOT status, which is the sheet, and NOT assess, which
            is somebody else's opinion of them.`
    },
    teacher: {
        takes: [],
        says: `who stands above this cultivator and would teach, with what each one will not
            say. Passes no time. Names only people they already hold a record for; "nobody you
            know of" is a real answer. Use it for "who can teach me", "I look for a master" and
            "is there anyone here stronger than me" - NOT status and NOT look, both of which
            answer a different question entirely.`
    },
    destinations: {
        takes: [],
        says: `where they could go, with what the journey costs, what the qi is like there and
            how far that province carries anybody. Passes no time. Use it for "where can I go",
            "what is nearby", "what is past this province", "what lies beyond" and "where is
            there better spiritual energy". Distinct from
            recall, which reads their own head; distinct from move, which goes somewhere they
            have already named.`
    },
    roads: {
        takes: [],
        says: `the dao grounds within reach: ground that teaches something, what each one
            teaches, and precisely what the cultivator is short by where it will not have them.
            Passes no time, reads only what they have heard of, and cannot teach them a name.
            The other half of destinations - that one is where they could go, this one is what
            standing there would be worth. Use it for "where can I comprehend something" and
            "what daos could I take up". A road HERE is a dao, a way of understanding, and never
            a road you walk: "the road to Cloud Gate" and "what is past this province" are about
            travel, and are asked of somebody or are destinations.`
    },
    wait: {
        takes: ['days', 'target'],
        says: `let time go by doing nothing in particular. "days" (default 1); "target" names a
            thing the world has a date for - an intake posted here, a word falling due - and
            the engine spends the days between now and it. A name nothing here answers to is
            met with what does have a day on it, never with a day nobody asked for.

            Staying the nights AT THE INN is this, with "days" the nights: "I stay at the inn
            for three nights", "I sleep at the inn". The engine pays for the nights the room
            does not already cover, then spends them under its roof.`
    },
    work: {
        takes: ['days', 'target'],
        says: `take an occupation for a span, for wages. "days" (default 90); "target" may name
            the kind of work. This is how somebody with no stones eats, and it is the right
            answer far more often than a model expects.`
    },
    market: {
        takes: [],
        says: `what is for sale where they are standing, and at what price. Passes no time.`
    },
    sect: {
        takes: ['intent', 'target', 'topic'],
        intents: [
            'leave', 'promote', 'stipend', 'standing', 'join', 'siphon', 'order',
            'recruit', 'admission', 'curriculum', 'expel', 'duty', 'donate', 'guest',
            // Dispatched on by the engine and undeclared until now, so the phase-1
            // glossary never told a model they existed and nothing typed reached them.
            'summons', 'refuse',
            // And saying YES, which had no words at all until it was measured:
            // `acceptDuty` had one caller, the board, so a house could send for
            // somebody by name and the only answer they had was to refuse.
            'accept',
            // And saying NOTHING to it, which is a third answer and not a
            // softer second one: refusing spends standing today, ignoring
            // spends nothing until the due day goes and then lands as a lapse.
            'ignore',
            // What the house is holding against its own, and the two ends of
            // it: deciding a case, and standing up for somebody in one.
            'complaints', 'plead',
            // The three the officer half added and the glossary never caught
            // up with. `SectIntent` is a union type, so nothing compared them
            // against anything: the tables prove an intent exists and the
            // officer intents do not come from a table at all.
            'take', 'authority', 'decree',
            // Handing a THING in, which the house credits where it wants it.
            'hand_in'
        ],
        says: `anything to do with a house: getting into one, and everything a member or an
            officer of one can do. "intent" is the step - "join" to be taken in, "standing" to
            read where they stand, "stipend" to draw one, "promote" to ask for a rung, "duty"
            to take something off the mission board, "donate" to pay money into the house's
            coffers, which buys no rung and no contribution, "hand_in" to hand a THING they are
            holding in to their own house - "target" names it - which the house credits as
            contribution where it wants the thing and says why where it does not, "guest"
            to sit in at a house that has not taken you, "leave" to resign, "summons" to ask
            what the house has asked of you, "accept" to answer it yes and go, "refuse" to
            answer it no - which also answers people already working ground the player has
            walked onto, and hands off to the confrontation - and "ignore" to answer it not at
            all, "complaints" to read what the
            house is holding against its own and decide one where the room is theirs, "plead"
            to speak for somebody it is holding something against - "target" names them - and
            "siphon",
            "order", "recruit", "admission", "curriculum" and "expel" for what the rungs above
            a disciple buy. "expel" is a house putting somebody off its roll - said as doing it
            or as having it done, which are the same act - and what the power actually reaches is
            an ELDER's dismissal, at the top of the ladder: the answer names who holds it where
            the player does not, and says that nobody puts an ordinary member off a roll by
            saying so.

            Three more belong to somebody who holds a room. "authority" READS which rooms of the
            house are the player's to speak for, and it is free - it is the sentence before the
            one that claims, because an order given in the house's name is only a decision if
            they could have found out whether it was true. "decree" gives that same order in the
            house's name rather than in their own, and somebody may be watching who knows what
            the player actually runs. "take" is putting a hand on a thing the house owns -
            "target" names it - which is not stow, where the room is the player's own and nothing
            is being taken from anybody.

            Default to the read - "standing" - unless the player plainly asked
            for a step, because joining is a life's worth of allegiance and cannot be unsaid.`
    },
    site: {
        takes: ['target', 'intent'],
        intents: ['approach', 'outside', 'enter', 'take'],
        says: `an inheritance ground: a trial somebody built to be inherited from, or a grave
            that was arranged for nobody. "target" names it; "intent" is one of approach (get
            to it, or ask what there is), outside (read it from the threshold without going
            in), enter (go in - this SPENDS DAYS and can kill), take (carry out what is behind
            the door). Choose "outside" when the player is looking rather than going, and
            "enter" only when they plainly said so.`
    },
    legacy: {
        takes: ['intent', 'target', 'days'],
        intents: ['counters', 'bury', 'dig', 'lodge', 'claim'],
        says: `putting things beyond your own death, and collecting what somebody else put
            beyond theirs. "intent" is "counters" to read who would hold a thing and on what
            terms, "bury" to put a cache in the ground (spends days), "dig" to go and get one
            back, "lodge" to leave something with a named house against a phrase, "claim" to
            collect one. "target" names the house for the last two. Default to "counters" when
            the player is asking rather than doing.`
    },
    petition: {
        takes: ['target', 'intent', 'topic'],
        intents: ['grant', 'stock', 'descent'],
        says: `ask an INSTITUTION for something: a grant, an object off its standing stock,
            recognition of a line, or a NOMINATION to one of the two postings nobody applies to -
            for that one, "target" is the house being asked to put the name up and "topic" names
            the posting. "target" names the body; "topic" is what is being asked for,
            in the player's own words, and is carried verbatim onto the form. "intent" is
            "stock" for an application against something a body is holding and cannot reorder
            (a Requisition, a schedule amendment, a request for one of its pills), "descent"
            for a claim of an ancestral line, "grant" for everything else that goes upward.
            Nearly always refused, and the refusal is the answer - it comes back in the
            instrument's own terms. Passes no time.`
    },
    posture: {
        takes: ['target', 'intent'],
        intents: ['stance', 'war', 'alliance', 'defect', 'tribute'],
        says: `what one HOUSE is to another. Only the head of a house can do three of these,
            and the refusal for everybody else names the rung it opens at. "target" names the
            other party; "intent" is "war", "alliance", "defect" (change who the house holds
            from), "tribute" (call in a payment), or "stance" to READ where the two already
            stand. Default to "stance" unless the player plainly declared something - the other
            four cannot be unsaid.`
    },
    seal: {
        takes: ['target', 'intent'],
        intents: ['read', 'wake'],
        says: `the sealed ancestor a house keeps under its mountain. "target" names the house,
            or omit it for the player's own. "intent" is "read" for the condition and the cost,
            "wake" to actually do it. Waking your own house's is the head's decision and
            changes the house permanently, once; waking somebody else's is not a decision at
            all, it is a theft. Default to "read".`
    },
    offer: {
        takes: ['target', 'intent', 'topic'],
        intents: ['channel', 'offering', 'send'],
        says: `the channel through the Lid, from whichever end the player is standing at. Below
            it: an offering sent up to an ancestor who crossed - "target" names the house, or
            omit it for the player's own, and "intent" is "channel" to read what the line is or
            "offering" to make one, which costs a decade of the house's principal and is the
            head's decision. Above it: "send", which puts an object or a word DOWN a line
            somebody below is holding, with "topic" as what is said with it. Which end they are
            at is decided by the engine, not by the label. Default to "channel".`
    },
    descend: {
        takes: ['target'],
        says: `a True Immortal going back down through the Lid, in person. "target" names where
            they are forcing it open. This is the most expensive action in the game: nine
            strikes of the heaviest tribulation there is, then ten to fifteen breaths on the
            ground, then the pressure puts them back. Choose it only when the player has
            plainly said they are going themselves - "send" is the other answer to the same
            intention and costs nothing.`
    },
    look: {
        // `target` was missing from this list while five of the reads below have
        // read one since the day they landed. The five that name a house cannot
        // work without it, so a model told only about "intent" could choose the
        // read and had no way to say WHICH house it was about.
        takes: ['intent', 'target'],
        intents: [
            'history', 'ground_time', 'crowding', 'bills', 'company', 'holder', 'warmth',
            // Five reads about a NAMED HOUSE or a PROVINCE rather than about the
            // patch underfoot. Implemented, routed and reachable by anybody who
            // happened to type the sentence the table has a line for, and never
            // once named here - so the model, which reads the sentence first and
            // falls back to the table, was never told they existed.
            'what_they_hold', 'what_they_teach', 'who_is_above_them',
            'what_is_made_here', 'would_they_take_me',
            // Asking to be let in at a house's gate, and who of a house is here.
            'the_gate', 'their_people_here'
        ],
        says: `observe the surroundings, or ask about a house or a province from where the
            player is standing. Passes no time. "intent" narrows what is being looked
            at: "history" for what people say has happened HERE (not news, which is elsewhere),
            "ground_time" for how long this ground would take somebody, "crowding" for how many
            are already drawing on it, "bills" for what is posted on the wall, "company" for
            who else is standing here, "holder" for who holds this ground and what there is to
            complain to if you are wronged on it, "warmth" for what the people standing here
            carry about the player themselves - who is glad to see them and who has not
            forgotten something. Omit it for the plain read.

            AND FIVE READS ABOUT SOMEBODY ELSE'S HOUSE, where "target" names it: "what_they_hold"
            for what a house has to its name - its purse, what is on its shelves, and the ground
            it holds; "what_they_teach" for each road it teaches, the rung it opens at, the rung
            it stops at, and how far the asker's own root would walk it; "who_is_above_them" for
            who stands behind it; "would_they_take_me" for whether that house would have this
            cultivator and at what bar. All four want the house named. The fifth,
            "what_is_made_here", names nothing: it is what the province the player is standing in
            produces and what leaves it on the water.

            Every one of the five is free and is a READ. "would_they_take_me" is asked before
            crossing a province to find out, and it must never be answered with sect/join, which
            resolves the name and enrols - that would make the asking permanent.
            "what_they_teach" is the question before joining and is not request/teaching, which
            is asking a PERSON to teach you and spends days. Prefer these over recall, which
            reads only what the cultivator has already been told, and over investigate, which
            examines a thing in front of them.

            "the_gate" is asking to be let in at a house's gate - "may I enter?", "let me in",
            "I enter the Azure Dew Sect" - answered by what the gate says to this cultivator;
            "target" names the house or is omitted at its gate. A house is never a site.
            "their_people_here" is who of a named house is standing here - "who is a disciple of
            the Azure Dew Sect?" - and "target" names the house.`
    },
    status: {
        takes: [],
        says: `report the cultivator's own condition. Passes no time.`
    },
    assess: {
        takes: ['target'],
        says: `what would happen if they tried something: the odds, not the attempt. "target"
            names the place or the opponent.`
    },
    recall: {
        takes: ['target', 'intent'],
        intents: ['knowledge', 'dao'],
        says: `what this cultivator is carrying in their own head. "target" names a person, a
            faction or a subject they may have heard of; omit it for everything they hold.
            "intent" is "dao" for what they have comprehended, "knowledge" otherwise. Passes no
            time, and it CANNOT teach them anything - it reads their own records and never the
            world, so a name they have not been told comes back as nothing. Use it for "what do
            I know of X".`
    },
    recognise: {
        takes: ['target'],
        says: `whose art that was. The cultivator watching somebody move and drawing on what
            they already hold - "target" names the person or the art. Passes no time, is never
            refused, and the answer is graded by what they have a reference for and how far
            they have climbed: somebody with no reference is told they would not know, and
            somebody with a reference and too low a rung is told it matches what they have
            heard and that they could not tell a good imitation. It says where an art was
            learned and never whom anybody serves.`
    },
    news: {
        takes: [],
        says: `what the people standing HERE say is happening somewhere else. No target and no
            intent. Passes no time. Use it for "what news is there", "what is happening in the
            world", "I listen for rumours", "what is the word" and "what have you heard". The
            opposite verb to recall: that one reads their own head, this one asks other people,
            and what comes back may be wrong. NOT for "what do people say about this place",
            which is the ground's own history and belongs to look.`
    },
    tell: {
        takes: ['target', 'topic', 'intent'],
        intents: ['send_word'],
        says: `TELL SOMEBODY THAT A WRONG WAS DONE - to them, or to somebody of theirs. The
            other direction of news: that one asks what people are saying, this one carries it
            to the person it is about. "target" is who is being told and they have to be here;
            "topic" is what is being said, in the player's own words, including the name of
            whoever is being blamed if the sentence gives one. Use it for "I tell him that Cao
            Antao killed his brother", "I let her know who killed her master", "I tell him what
            happened to his brother" and "I tell him that I killed his brother". Passes no time.
            Route it whether or not the claim is true - naming the wrong person, or a killing
            that never happened, is an ordinary thing to say and the engine is what answers for
            it. ALSO FOR TELLING SOMEBODY WHO YOU ARE, which is the same act one subject over:
            "I tell the gate guard that I am of the Cinnabar Crucible Sect", "I introduce myself
            to the steward as a Core Formation cultivator", "I tell her my name is Shen Wuyi".
            Route those the same way whether or not any of it is so - the engine holds what this
            cultivator actually is and decides. A bare greeting with no name, house or rung in it
            is interact, not this. NOT for "tell me about X", which is a question and belongs to
            investigate, and NOT for a threat, which is about something that has not happened yet.
            AND AT A DISTANCE, intent "send_word": word sent on a communication talisman (a
            transmission or message talisman) to somebody who is not here. "target" is who it is
            for - "my master", "the sect", a house or a person's name - and "topic" is the message.
            Use it for "I burn a communication talisman to tell my master that the pass is held"
            and "I send word to the sect that I have found a door". Passes no time.`
    },
    challenge: {
        takes: ['target'],
        says: `SAY TO SOMEBODY'S FACE THAT WHAT THEY TOLD YOU ABOUT THEMSELVES IS NOT TRUE.
            "target" is who is being called on it, and they have to be standing here. Use it
            for "I tell him he is not of the Verdant Spring Valley", "I call her a liar about
            her rank", "that is not your house", "I say he made that name up". Passes no time
            and costs no stones. It needs an account they actually gave you - somebody who has
            only ever told you their name has said nothing that can be challenged. If you have
            nothing to put against what they said, they are simply being called a liar in front
            of whoever is here, and they will hold that. NOT for accusing somebody of a deed -
            "I tell him he killed my brother" is tell. NOT for a threat, and NOT for an insult
            about anything other than their own account of who they are, which is interact.`
    },
    request: {
        // "days" is read by the two kinds that spend the days of the person being
        // asked as well as the asker's: company and guidance.
        takes: ['target', 'intent', 'topic', 'days'],
        intents: REQUEST_KINDS,
        says: `ASK A NAMED PERSON FOR A NAMED THING, which is not the same as interact and must
            not be routed there. "target" is who it is put to; "intent" is what kind of thing is
            being asked for - teaching (be taught an art: it takes the months or years the art
            is worth at their elbow, and an interrupted lesson leaves nothing), guidance (be
            watched and corrected while you cultivate - "I ask my master to guide my cultivation
            for a month", "I cultivate under Elder Hu's guidance for a year", "will you watch me
            run the form"; "days" is how long; the span is spent sitting with the guided rate,
            and it is their attention and not their presence that counts, so a master standing
            nearby who is not asked teaches nothing; anybody, a master included, is asked like
            any favour and may say no, and somebody at their own practice or at their own wall
            declines and says when they will be free), discipleship (be
            taken on), ending_a_bond (PUT A MASTER-DISCIPLE BOND DOWN, from either end - a
            master casting a disciple out, a disciple walking out on a master. Nothing is being
            asked for and nobody may refuse it; what it costs is stated rather than weighed:
            each of them keeps a former tie to the other, and the end that did not do it holds
            a broken oath against the end that did, the heavier the longer the bond had stood.
            "target" is who it is with, and "my master" with more than one is answered by naming
            them and asking which), introduction (be put in front of somebody), telling (be told something
            they know), a_thing (be given, lent or sold an object), terms (what would it take -
            the price asked before it is paid), a_trade (something put down for it that is not
            money), advancement (be raised a rung in your own house - it only moves if the person
            asked is the one whose call it is, and money alone will not buy it), company (ask them
            to come with you - "topic" is where the party is bound when the sentence said, and
            "days" is how long they were asked for; they travel with the player until the term
            runs out, and most people have no reason to follow a stranger), nothing (ask for
            NOTHING - buy them a drink, sit with them, call on them, do
            them a small favour; costs a day and no stones, and it is the only thing that makes
            a stranger somebody who will do you a favour later); "topic" is what was named - the
            art, the person, the thing. This is the ONLY route to being taught by a person,
            which the engine says repeatedly is one of the two ways past a manual's ceiling. It
            spends days and can spend the purse, so choose it only when the player is actually
            asking somebody for something rather than asking about them.`
    },
    guard: {
        takes: ['target', 'days'],
        says: `STAND GUARD OVER SOMEBODY ELSE'S BREAKTHROUGH - the dao protector. "target" is
            who is crossing and must be somebody standing here; "days" is how long they said
            they would stand there. A cultivator making a crossing cannot defend themselves at
            all, and a protector is the only defence that exists. This is not the speaker's own
            crossing, which is breakthrough. Naming nobody asks the free question instead - who
            standing here would keep a watch over YOUR next crossing. It spends the span, it
            resolves the other person's attempt, and it can leave the guard carrying a
            crippling wound taken for somebody else.`
    },
    propose: {
        takes: ['target', 'intent', 'topic'],
        intents: ['propose', 'accept'],
        says: `put a match on the table, or agree to one that has been put to you. "target" is
            who, or whose house; "topic" is what is being offered with it, in the player's own
            words, and the list of what may go there is open; "intent" is "propose" when they
            are asking and "accept" when they are answering. Nothing anywhere branches on
            gender, on who asked, or on which side of it the player is.`
    },
    decline: {
        takes: ['target', 'intent'],
        intents: ['refuse', 'leave'],
        says: `say no to a match, or leave one already made. "intent" is "refuse" for the answer
            and "leave" for the walk-out. Neither is free and neither is automatic: what it
            costs is priced by what the asking side staked. Use it whenever the player is
            turning something down or getting out of it - NOT interact, which would describe
            the family instead of answering them.`
    },
    child: {
        takes: ['days', 'target', 'intent'],
        intents: ['have', 'place'],
        says: `have a child, or place one. "intent" is "have" - "target" names the other parent
            and "days" the stretch being spent - or "place", where "target" names the house a
            child is being put to on somebody's word. The engine spends the years the way it
            spends years everywhere; what the player is choosing here is to spend them.`
    },
    unclear: {
        takes: [],
        says: `DO NOT CHOOSE THIS. It is the deterministic parser's fallback for a sentence it
            could not read. If you are unsure, choose "look" or "investigate".`
    }
};

// ─────────────────────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────────────────────

/** Column the description starts in, wide enough for `train_technique`. */
const NAME_COLUMN = 17;

/** Where the description wraps. `NAME_COLUMN` plus this is the line length. */
const PROSE_WIDTH = 78;

/** One paragraph, however the source happened to be indented. */
function oneParagraph(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * The values a `says` string may interpolate.
 *
 * Balance numbers are imported and never retyped, here as everywhere. The
 * document generator resolves the same placeholders out of `actions.ts`, which
 * is why they are written as literal `${…}` in the source rather than as real
 * template substitutions: one spelling, read two ways.
 */
const NUMBERS: Readonly<Record<string, number>> = {
    MAX_CULTIVATION_DAYS
};

/** Substitute the balance numbers a description quotes. */
function withNumbers(text: string): string {
    return text.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (whole, name: string) =>
        name in NUMBERS ? String(NUMBERS[name]) : whole);
}

function wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        if (line.length === 0) line = word;
        else if (line.length + 1 + word.length <= width) line += ` ${word}`;
        else { lines.push(line); line = word; }
    }
    if (line.length > 0) lines.push(line);
    return lines;
}

/**
 * The phase-1 glossary, laid out as a two-column table.
 *
 * Composed rather than written out, so the classifier is told about every
 * member of the closed set. The hand-maintained version it replaces had fallen
 * twelve verbs behind the enum - the model was being handed the whole list of
 * names to choose from and the meaning of only some of them - and nothing
 * failed for as long as that was true.
 */
export function composeActionGlossary(): string {
    const out: string[] = [];
    for (const verb of ACTION_NAMES) {
        const body = wrap(withNumbers(oneParagraph(WHAT_EACH_VERB_IS_FOR[verb].says)), PROSE_WIDTH);
        out.push(`${verb.padEnd(NAME_COLUMN)}${body[0] ?? ''}`);
        for (const line of body.slice(1)) out.push(`${' '.repeat(NAME_COLUMN)}${line}`);
    }
    return out.join('\n');
}

/** Every verb that reads this field, in enum order. */
export function verbsTaking(field: PlanField): readonly ActionName[] {
    return ACTION_NAMES.filter(verb => WHAT_EACH_VERB_IS_FOR[verb].takes.includes(field));
}

/**
 * What each field a model may set is, in the phase-1 schema block.
 *
 * `target` is the one that names no verbs: half the set takes one, and a list
 * that long stops being a constraint and becomes noise. The other three are
 * narrow enough that the list IS the instruction.
 */
const FIELD_IN_THE_SCHEMA: Readonly<Record<
    typeof MODEL_MAY_SET[number],
    { what: string; enumerate: boolean }
>> = {
    days: { what: 'integer', enumerate: true },
    target: {
        what: 'short string naming a real person, faction, place, art, formula or herb',
        enumerate: false
    },
    intent: { what: 'short label', enumerate: true },
    topic: { what: 'short string', enumerate: true }
};

/**
 * The `days | target | intent | topic` lines of the phase-1 schema block.
 *
 * Generated for the same reason the glossary is. The hand-written version said
 * `days` was "only for cultivate | seclude" while five other verbs read one,
 * and a classifier told a field does not apply will not fill it in - so "I wait
 * a year" and "I bury this for a century" arrived with a defaulted span and
 * nobody could see where the year went.
 */
export function composePlanSchemaFields(): string {
    return MODEL_MAY_SET.map(field => {
        const spec = FIELD_IN_THE_SCHEMA[field];
        const only = spec.enumerate ? `, only for ${verbsTaking(field).join(' | ')}` : '';
        const body = wrap(`<${spec.what}${only}>,`, PROSE_WIDTH);
        const head = `   ${`"${field}":`.padEnd(10)}`;
        return body
            .map((line, i) => (i === 0 ? head + line : ' '.repeat(head.length) + line))
            .join('\n');
    }).join('\n');
}
