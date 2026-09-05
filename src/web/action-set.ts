/**
 * The closed action set, and how each verb in it is classed.
 */

/**
 * Every action the engine can execute. Closed, and short on purpose.
 */
export const ACTION_NAMES = [
    // Semantic actions. The expressive surface, held open by parameters.
    'interact',
    'investigate',
    'move',
    /**
     * Getting there ON something rather than on foot.
     */
    'ride',
    /**
     * Stepping across the distance instead of covering it.
     */
    'fold',
    /**
     * Buying a place on somebody else's span, and reading the board first.
     */
    'passage',
    /**
     * Giving your word, reading what you have given, and not keeping it.
     */
    'oath',
    // World-facing operations: distinct engine routines, distinct state effects.
    /**
     * Hitting somebody, which for a long time had no route at all.
     */
    'attack',
    /**
     * Making somebody do something, with hands rather than with words.
     */
    'coerce',
    'cultivate',
    'seclude',
    'breakthrough',
    'train_technique',
    'refine',
    /**
     * Making a thing out of what a hunt brought back.
     */
    'craft',
    'gather',
    /**
     * Going out after something that is not a person.
     */
    'hunt',
    'eat',
    /**
     * Laying in food before it is needed.
     */
    'provision',
    /**
     * Getting a wound seen to, which was a softlock.
     */
    'treat',
    /**
     * Buying something off the price board by name.
     */
    'buy',
    /**
     * Putting something on the counter, which is the only way anything a cultivator
     * gathered ever becomes stones again.
     */
    'sell',
    /**
     * Handing somebody a thing you already hold, which had no verb at all.
     */
    'give',
    /**
     * What is in the pouch, asked in words.
     */
    'inventory',
    /**
     * Swallowing a pill.
     */
    'consume_pill',
    /**
     * The arts that could be learned, and the learning of one.
     */
    'list_techniques',
    'learn_technique',
    /**
     * How a manual could go further, by every route there is.
     *
     * A read, and free: the decision is the content, so the comparison must not itself cost a decade.
     */
    'acquisition',
    /**
     * ── THE THREE QUESTIONS A DRIVEN PLAYER ASKS AND COULD NOT ────────────
     */
    /**
     * Why nothing is accumulating, with the binding gate named.
     */
    'ceiling',
    /**
     * Who stands above them and would teach, said only of people they know of.
     */
    'teacher',
    /**
     * Where they could go, priced, with the qi and the province's ceiling.
     */
    'destinations',
    /**
     * What ground this cultivator can point at teaches, and what it wants.
     */
    'roads',
    'wait',
    // The mortal economy. Half the deaths in this world are logistical, and
    // these are the two verbs that answer that - so they must be reachable
    // from plain English or the logistics layer might as well not exist.
    'work',
    'market',
    // Joining a sect is one of the most consequential things a low cultivator
    // can do - access to comprehension, to a stipend, and to knowing what is
    // out there - and it was unreachable from plain English.
    'sect',
    /**
     * Inheritance grounds: the trials and the graves.
     */
    'site',
    /**
     * Putting things beyond your own death, and collecting what somebody else put
     * beyond theirs.
     */
    'legacy',
    /**
     * ── INSTITUTIONS ACTING ON EACH OTHER, AND ON THE DEAD ────────────────
     */
    /**
     * Asking an institution for a thing: a grant, an object off its standing stock,
     * recognition of a lineage.
     */
    'petition',
    /**
     * One house's stance toward another: war, alliance, defection.
     */
    'posture',
    /**
     * The thing under the mountain.
     */
    'seal',
    /**
     * The offering upward, and the reading of a silence.
     */
    'offer',
    /**
     * Going back down through the Lid, which is the only thing at the top of the
     * ladder that is a decision rather than a fact.
     *
     * It is not a travel option and must never become one.
     */
    'descend',
    // Pure reads.
    'look',
    'status',
    'assess',
    /**
     * What this cultivator is carrying in their head, asked in words.
     */
    'recall',
    /**
     * WHOSE ART THAT WAS - the player putting the trust hierarchy's strongest check
     * to themselves.
     */
    'recognise',
    /**
     * What the people here are saying is happening elsewhere.
     */
    'news',
    /**
     * CARRYING THE NEWS THE OTHER WAY: telling somebody that a wrong was done to
     * them, and putting a name on it.
     */
    'tell',
    /**
     * ASKING A PERSON FOR SOMETHING, which is the verb the design rests on and
     * which did not exist.
     */
    'request',
    /**
     * 护法: standing over somebody else's crossing while they cannot defend it.
     */
    'guard',
    /**
     * Proposing a match, and answering one that has been put to you.
     */
    'propose',
    /**
     * Saying no to a match, and leaving one you are already in.
     */
    'decline',
    /**
     * Having a child, and spending the years.
     */
    'child',
    /**
     * The parser did not understand, and nothing happens.
     */
    'unclear'
] as const;

export type ActionName = typeof ACTION_NAMES[number];

/**
 * Actions that pass no in-world time and change no cultivator state.
 */
export const READ_ONLY_ACTIONS: readonly ActionName[] = [
    'look', 'status', 'investigate', 'assess', 'market', 'unclear',
    // Both are reads of what is already true - the pouch, and the catalog
    // filtered by rows this cultivator already owns. Neither can teach and
    // neither can kill.
    'inventory', 'list_techniques', 'acquisition',
    // Reading your own head changes nothing in it. This one is a read in the
    // strictest sense in the package: it touches no catalog the holder has no
    // record for, so it cannot even accidentally become a way to learn.
    'recall',
    // The same, one subject over. Looking at what is in front of you and
    // thinking about it is always a legitimate thing to do, so this is never
    // refused and never spends a day - and what it can tell the holder is
    // bounded by the two things they already are.
    'recognise',
    // Asking a square what it has heard writes knowledge records and nothing
    // else. It cannot spend, move or kill, and what it teaches is a name at
    // `whisper` - the same thing standing near a conversation already does.
    'news',
    // The three reads that answer a stuck player. Every line each of them
    // produces is a restatement of a number the engine already computed, so
    // none of them can teach, spend, move or kill - and a player at a wall
    // must be able to ask what it is a hundred times for nothing.
    'ceiling', 'teacher', 'destinations',
    // And what the ground within reach would teach, which is a read over the
    // player's own knowledge rows joined to the catalog. It names no place they
    // could not already name, spends nothing and moves nobody.
    'roads',
    /**
     * Asking is free. Getting is not, and nobody has ever got.
     */
    'petition'
] as const;

/**
 * `sect`, `posture`, `seal`, `offer` and `oath` are in neither list on purpose. So
 * is `interact`, which is the sixth and the one that had to be found by playing -
 * the note under {@link TIME_CONSUMING_ACTIONS} carries it.
 */

// A VERB SHOULD ANSWER TO ITS OWN NAME

/**
 * The action a sentence names, when the sentence is nothing but the name.
 */
export function theVerbsOwnName(text: string): ActionName | null {
    const bare = text.trim().replace(/[.!?]+$/, '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (bare.length === 0) return null;
    for (const name of ACTION_NAMES) {
        if (name === FALLBACK_ACTION) continue;
        if (!READ_ONLY_ACTIONS.includes(name)) continue;
        if (bare === name.replace(/_/g, ' ')) return name;
    }
    return null;
}

/**
 * Actions that spend in-world time, and can therefore kill.
 */
export const TIME_CONSUMING_ACTIONS: readonly ActionName[] = [
    'cultivate', 'seclude', 'breakthrough', 'train_technique',
    'move', 'gather', 'hunt', 'wait', 'work', 'refine', 'eat',
    /**
     * Building spends days at a bench and the days are a real span - the food
     * clock, the world tick and the encounter window all run over them, the same as
     * they do for a stretch of foraging.
     */
    'craft',
    /**
     * The three ways of covering ground that are not walking, and all three spend
     * real days off the catalog's own `travelDays` rather than the flat one `move`
     * spends.
     */
    'ride', 'fold', 'passage',
    // Years, and they are the resource this world prices everything else in.
    // A decade raising somebody is a decade nobody was cultivating in, and the
    // food clock runs through it like any other stretch.
    'child',
    // A course of care is a month lying still. It is the cheapest month in the
    // game and it is still a month, and the food clock runs through it.
    'treat',
    // Not because it spends days. Because it can end the run inside one
    // turn, which is the thing this list is actually protecting against.
    'attack',
    /**
     * And the verb beside it, for the identical reason.
     */
    'coerce',
    /**
     * Here for the same reason, and it is not obvious from the name. An art that
     * FIGHTS the spirit root is learnable and routes through the qi deviation
     * engine on the spot: torn meridians, lost progress, and
     * `evaluateDeathConditions` called on the far side of it. A misparse must never
     * reach that.
     */
    'learn_technique',
    /**
     * And this one, which is even less obvious. Swallowing a pill spends no day at
     * all - and toxicity crossing `TOXICITY_TOLERANCE` mints a real poison injury
     * through the same path every other wound takes, with `evaluateDeathConditions`
     * running on the far side of it. This list is a floor on what a MISPARSE may
     * reach, not a description of what each action costs, and a verb that can write
     * a wound belongs on it.
     */
    'consume_pill',
    /**
     * Here for exactly the same reason, and it is the strongest case on the list.
     * Nine strikes of the heaviest tribulation in the game, weathered by somebody
     * who has already spent a life reaching the point where they could be struck by
     * it. A misparse that reaches this ends the run, so nothing ambiguous may.
     */
    'descend',
    /**
     * Here for the same reason `attack` is, and not because every intent it carries
     * costs anything: approaching a site and reading it from outside are reads that
     * pass no time at all. Going into one spends days and puts a body in front of a
     * thing set at an ordinal, so the whole action is declared dangerous. This list
     * is a floor on what a MISPARSE may reach, not a description of what each
     * intent costs, and the conservative direction is the only safe one to be wrong
     * in.
     */
    'site',
    // Burying spends a week or a season with a spade, and the food clock
    // runs through it. Conservative direction, same as `site`.
    'legacy',
    /**
     * Putting something to somebody costs a day for a courtesy and a season and a
     * half for a betrayal - `ASK_DAYS` in `an-attempt-to-move-somebody.ts` owns the
     * figure - and it can spend the whole purse on the way.
     */
    'request',
    /**
     * A watch is a span of months standing beside somebody else's crossing,
     * and `resolveVigil` can take a crippling wound off the person keeping it.
     * Both halves of this list's own sentence - it spends in-world time, and it
     * can therefore kill.
     */
    'guard',
] as const;

/**
 * `interact` is in neither list, and it is the fifth member of the paragraph above
 * rather than a fourth exception to it.
 */

/** What an unparseable sentence resolves to. Inert, by construction. */
export const FALLBACK_ACTION: ActionName = 'unclear';

/** Actions that take a duration in days. Every other action ignores one. */
export const TIMED_ACTIONS: readonly ActionName[] = [
    'cultivate', 'seclude', 'work', 'provision', 'legacy',
    // How long they said they would stand there. The protector module refuses
    // to invent a length for a crossing and says so - the span is the player's
    // own and is read off their own sentence.
    'guard',
    // Raising somebody is a stretch of years and the sentence names it.
    // The verb is the decision; the clock is the one every other stretch
    // is spent on.
    'child'
] as const;

/**
 * Actions that take a subject. The subject must resolve to a real entity - a
 * cultivator row, a sect, a catalogued art, formula or herb, a place - or the
 * action fails. An unresolvable target is never narrated as though it worked.
 */
export const TARGETED_ACTIONS: readonly ActionName[] = [
    'interact', 'investigate', 'move', 'train_technique', 'refine', 'gather',
    'work', 'market', 'assess', 'sect', 'attack', 'hunt',
    /**
     * WHO IS BEING MADE TO DO IT. Absent from this list until it was measured, and
     * the consequence was total: `validatePlan` keeps a field only for the actions
     * that own it, so every model-planned coercion arrived with its target deleted
     * -
     */
    'coerce',
    // WHO is being handed it. The thing itself rides on `topic`, because a
    // gift is the one verb in the set that needs both halves named and neither
    // substitutes: handing the wrong person the right thing is a different
    // event from handing the right person the wrong one.
    'give',
    /**
     * Where they are going, resolved against the same three registers `move`
     * resolves against - so a name the world has never heard of reaches nothing
     * here either, and none of the three can store a sentence as a location.
     */
    'ride', 'fold', 'passage', 'oath',
    // Who is being proposed to, refused, or had a child with - or, for
    // `child` with intent `place`, the house being asked. Resolved against the
    // world like every other target, so a name nobody answers to reaches
    // nothing.
    'propose', 'decline', 'child',
    // The name being asked about. Matched against the holder's OWN rows and
    // never against the world, which is the whole gate - see `GameService.recall`.
    'recall',
    // The site, by name. Resolved against the catalog and against what this
    // cultivator may name, so an invented one resolves to nothing.
    'site',
    // The custody house, by name, resolved against the six that take a
    // deposit. A cache takes the place instead and needs no target.
    'legacy',
    // The line on the price board. Resolved against `PRICES`, so a purchase
    // the board never advertised resolves to nothing and is refused with the
    // board attached.
    'buy',
    // What is on the counter, resolved against THE POUCH. Bare "I sell my
    // herbs" carries no target and prices the whole pouch instead.
    'sell',
    // The manual being asked about, by name. Resolved against what this
    // cultivator HOLDS: the question is how THEIR book goes further.
    'acquisition',
    // The art, by name. Resolved against the whole catalog and then put to
    // `handleLearn`, which owns every gate - so naming one out of reach is
    // refused with the measured reason rather than dropped here.
    'learn_technique',
    /**
     * The art being ASKED about, by name, which is where a question about learning
     * one lands. Free and it must be: a player is entitled to ask what a book would
     * take a hundred times and lose nothing, and the whole reason this target
     * exists is that "can I learn the Lesser Qi-Gathering Manual" used to LEARN IT.
     * An unresolvable name falls through to the listing rather than being refused.
     */
    'list_techniques',
    // The pill, by name. Resolved against the POUCH, so a pill nobody is
    // carrying is refused with what they are carrying attached.
    'consume_pill',
    /**
     * The other party, by name: the institution being asked, the house being
     * declared against, the mountain with something under it, the line an offering
     * is being sent up.
     */
    'petition', 'posture', 'seal', 'offer',
    /**
     * The person it is being put to, by name or by the phrase that points at them.
     * Resolved through the same knowledge-gated party lookup `interact` uses, and
     * refused with the same guiding refusal - who is actually here, and which of
     * them the player could put it to - when it resolves to nobody.
     */
    'request',
    /**
     * Who is being guarded. Resolved off who is standing in the square, because
     * a watch is kept in the same room as the crossing.
     */
    'guard',
    /**
     * Who is being told. Resolved through the same knowledge-gated party lookup
     * `interact` and `request` use, and refused with the same guiding refusal
     * when it reaches nobody - because a telling that reaches nobody is not a
     * telling, and the person has to be somewhere the player can speak to them.
     */
    'tell'
] as const;

/**
 * `look` is deliberately NOT in the list above, even though the history read can
 * use a place name.
 */

/**
 * Actions that may carry a topic. `sect` uses it for the siphoning pace.
 */
export const TOPIC_ACTIONS: readonly ActionName[] = [
    'interact', 'sect', 'petition',
    // WHAT is being handed over, in the player's own words, resolved against
    // the pouch by the handler. See `give` in {@link TARGETED_ACTIONS} for why
    // it needs a field of its own rather than riding on `target`.
    'give',
    /**
     * `offer` uses it for the WORD that goes down the line with whatever is sent,
     * which is half of what a proxy action is: an object arrives, and a message
     * says what it is for. Free text, carried into the recipient's memory and into
     * a secret fact, and read by no conditional - the whole unreliability of acting
     * by proxy is that people who are not you decide what you meant.
     */
    'offer',
    /**
     * `request` uses it for WHAT WAS NAMED: the art, the person to be introduced
     * to, the subject. Free text, resolved against the same catalogs every other
     * target resolves against, and refused by name when it resolves to nothing -
     * which is the point, because "no art called that" is a different answer from
     * "they will not teach you that" and a player is entitled to know which one
     * they got.
     */
    'request',
    /**
     * `ride` uses it for WHAT IS UNDER THEM, when the sentence names one. Matched
     * against `CONVEYANCES` and ignored where it matches nothing: which conveyance
     * actually suits the road is `bestForThisRoad`'s answer and never the word's,
     * so naming a beast expresses a preference and cannot produce a journey the
     * rider could not have made.
     */
    'ride',
    /**
     * `oath` uses it for WHAT IS BEING SWORN, in the swearer's own words. Free
     * text, written into `terms` on the ledger row - which is the field
     * `grudges.ts` requires an oath to carry - and read by no conditional. It is
     * what somebody reads in eighty years when they are working out why this person
     * was standing where they were standing.
     */
    'oath',
    /**
     * `tell` uses it for WHAT IS BEING SAID, in the teller's own words - the whole
     * proposition, not a label for it. Two things read it and neither decides an
     * outcome: `whoTheClaimBlames` looks in it for a name, which the engine then
     * resolves like any other party, and the answer echoes it back so the player is
     * told what landed in the terms they said it in.
     */
    'tell'
] as const;

/**
 * Actions that carry a free-text intent. Never branched on for an outcome - with
 * one deliberate exception, `sect`, whose intent selects which of the sect
 * surface's five verbs runs. It is safe there because the value is produced by
 * {@link SECT_INTENT_PATTERNS} rather than by a model: the model's own string is
 * normalised to a label and then matched against the same closed set, so an
 * unrecognised one falls through to the listing.
 */
export const INTENT_ACTIONS: readonly ActionName[] = [
    'interact', 'move', 'attack', 'sect',
    /**
     * `look` is the second exception, and it is safe for the same reason: the label
     * selects WHICH READ runs - the room, the faces in it, or what was done to the
     * ground here - and every one of those is answered out of state. An
     * unrecognised label falls through to the room, which is what `look` did before
     * any of them existed.
     */
    'look',
    /**
     * `site` is the third, and it carries the same guarantee with one extra
     * obligation. The label selects which of the four steps runs - reaching one,
     * reading it from outside, going in, taking what is behind it - and every
     * outcome on the far side is computed from the catalog and the cultivator's own
     * rows. What is different here is that one of the four SPENDS SOMETHING, so an
     * unrecognised label must fall through to the cheapest of them and not to the
     * expensive one. It falls through to the listing. See `SITE_INTENTS` and
     * `GameService.site`.
     */
    'site',
    /**
     * `legacy` is the fourth, and it carries the site rule exactly: the label
     * picks which of five steps runs, two of them spend something, and an
     * unrecognised label falls through to `counters` - the free read of what
     * the counters here will take - and never to burying.
     */
    'legacy',
    /**
     * `recall` is the fourth, picking between what the holder has HEARD and
     * what they have UNDERSTOOD. Two different tables, both theirs, and both
     * free.
     */
    'recall',
    /**
     * `request` carries the site rule with one difference worth stating: what the
     * label selects is not which routine runs but WHAT IS BEING ASKED FOR, which is
     * the one thing about an approach the engine is required to read. `asking.md`
     * is the reason - asking a gate guard for a name and asking the same guard to
     * leave the gate unwatched are the same sentence with the same charm behind it,
     * and they are not remotely the same attempt.
     */
    'request',
    /**
     * The four new ones, all carrying the same guarantee and the same extra
     * obligation `site` carries.
     */
    'petition', 'posture', 'seal', 'offer',
    /**
     * `passage` and `oath` are the sixth and seventh, and both carry the `site`
     * rule: the label picks which step runs, one step of each SPENDS or COMMITS
     * something, and an unrecognised label must fall through to the read.
     */
    'passage', 'oath',
    /**
     * `work` carries exactly one label and it exists to make a QUESTION free.
     */
    'work'
    /**
     * ── AND `coerce` IS DELIBERATELY NOT HERE ────────────────────────────
     */
] as const;

// AND THE OTHER AXIS: WHETHER IT CAN HURT YOU

/**
 * The ways an act reaches this cultivator's body, as a closed set.
 */
export type HowAnActCanEndBadly =
    /**
     * `resolveExchange` runs with this cultivator's body on one side of it. The one
     * channel that needs no time at all: a single turn, HP off a fraction of the
     * defender's own maximum, wounds that persist, and `evaluateDeathConditions` on
     * the far side.
     */
    | 'force'
    /**
     * A stretch of days passes over this body, which is the broadest channel and
     * the one the Late Age actually kills people with.
     */
    | 'a_span_of_days'
    /**
     * Heavenly tribulation strikes, which is the one thing in this game that is
     * supposed to be able to kill somebody who did everything right.
     * `triggersHeavenlyTribulation` decides where, and it is one of the three
     * realm capabilities `AGENTS.md` records as genuinely enforced.
     */
    | 'the_crossing'
    /**
     * Qi deviation on the spot, from an art that fights the spirit root. Torn
     * meridians, lost progress, and `evaluateDeathConditions` immediately -
     * `technique-manage.ts` calls it on both the learning path and the practice
     * path.
     */
    | 'the_art'
    /**
     * Accumulated toxicity crossing `TOXICITY_TOLERANCE` and minting a poison
     * injury through the same path every other wound takes.
     * `alchemy-manage.ts#handleConsumePill`.
     */
    | 'the_dose';

/**
 * How each verb can end badly, and the empty array where it cannot.
 */
export const HOW_EACH_VERB_CAN_END_BADLY: Readonly<Record<ActionName, readonly HowAnActCanEndBadly[]>> = {
    /**
     * Eight of its ten intents run their days through `GameService.shortSkip`,
     * which is a real span with a real encounter window over it. The other two --
     * `talk`, `trade`, `apologise` -- settle nothing and pass no time.
     */
    interact: ['a_span_of_days'],
    investigate: [],
    move: ['a_span_of_days'],
    ride: ['a_span_of_days'],
    fold: ['a_span_of_days'],
    passage: ['a_span_of_days'],
    /**
     * Giving your word takes nothing off the body. What it writes is a permanent
     * row with a penalty clause and a witnessing house, and every consequence of
     * that arrives later through somebody else's decision - which is a real risk
     * and is not this channel. See the note on {@link HowAnActCanEndBadly} for why
     * there is no `social` member.
     */
    oath: [],
    attack: ['force'],
    coerce: ['force'],
    cultivate: ['a_span_of_days'],
    seclude: ['a_span_of_days'],
    /**
     * The crossing itself, and only above `triggersHeavenlyTribulation`'s floor.
     * Below it a failed attempt costs progress and a wound, which is the same body
     * cost the span channel already carries - so this entry names the thing that is
     * different about a breakthrough rather than the thing it shares with
     * everything else.
     */
    breakthrough: ['the_crossing'],
    /**
     * Both channels, and the second is the one nobody expects. Practice spends
     * days; practising an art that fights the root routes through the deviation
     * engine on the spot, and `technique-manage.ts` calls `evaluateDeathConditions`
     * on the far side of the practice path as well as the learning path.
     */
    train_technique: ['a_span_of_days', 'the_art'],
    /**
     * On {@link TIME_CONSUMING_ACTIONS} and it reaches no time skip at all -
     * `GameService.refine` neither advances days nor calls one. Refining makes a
     * pill; the toxicity is charged when somebody swallows it, which is
     * `consume_pill`. The classification difference is not a contradiction: one
     * list is a floor on a misparse and this one is a description.
     */
    refine: [],
    /**
     * Unlike the cauldron, a bench does spend the days, and they run through
     * `shortSkip` - so the encounter window is over them and a bench in a bad place
     * can end a run. What it cannot do is hurt the body on its own: `launch` risks
     * the MATERIALS and nothing else, and a hull that does not hold leaves a yard
     * full of firewood rather than a wound.
     */
    craft: ['a_span_of_days'],
    gather: ['a_span_of_days'],
    /**
     * The only verb on the strip that carries both, and it is the honest shape
     * of what hunting is: ten days of walking, and then something at an ordinal
     * on the other side of them, priced by `assessPower`.
     */
    hunt: ['force', 'a_span_of_days'],
    /**
     * A meal, and `GameService.eat` is synchronous - no skip, no day, nothing
     * rolled. It sits on {@link TIME_CONSUMING_ACTIONS} in the conservative
     * direction; it belongs on neither side of this one.
     */
    eat: [],
    provision: [],
    treat: ['a_span_of_days'],
    buy: [],
    /**
     * The counter takes nothing off anybody. The one branch that spends is
     * `sellACopyOfAnArt`, which is MONTHS with a brush - and it is named here
     * rather than folded in, because what spends there is the copying and not the
     * sale, the player has to name an art to reach it, and flagging every `I sell
     * my herbs` as dangerous is the cry-wolf failure this table exists to avoid. If
     * a consumer ever needs that branch it should ask about the copying, which is a
     * separate act with a separate price.
     */
    sell: [],
    give: [],
    inventory: [],
    consume_pill: ['the_dose'],
    list_techniques: [],
    learn_technique: ['the_art'],
    acquisition: [],
    ceiling: [],
    teacher: [],
    destinations: [],
    roads: [],
    /**
     * SITTING STILL IS NOT SAFE, and this is the entry that says so. `wait` runs
     * `shortSkip` with the label `Waiting`, which `activityForVerb` does not
     * recognise and therefore defaults to `labour` - a real, non-zero exposure row.
     * The world can reach somebody who is doing nothing at all, which is exactly
     * the asymmetry `AGENTS.md` records under arrivals: the player can be found.
     */
    wait: ['a_span_of_days'],
    work: ['a_span_of_days'],
    market: [],
    sect: [],
    /**
     * Approaching one and reading it from outside pass no time. Going in spends
     * days and then stands a body in front of a thing set at an ordinal, and
     * `site-verbs.ts#forceAtOrdinal` resolves that through `resolveExchange` twice
     * - once at the gate, once on the ground behind it.
     */
    site: ['force', 'a_span_of_days'],
    legacy: ['a_span_of_days'],
    petition: [],
    /**
     * Declaring war commits a house to something it cannot undo, and what
     * follows lands on the house rather than on the body in the turn that
     * declared it. Same reading as `oath`.
     */
    posture: [],
    /**
     * ── AN ABSENCE, WRITTEN DOWN WHERE THE AFFECTED MATERIAL LIVES ───────
     */
    seal: [],
    offer: [],
    descend: ['the_crossing'],
    look: [],
    status: [],
    assess: [],
    recall: [],
    recognise: [],
    news: [],
    tell: [],
    /**
     * Putting something to somebody costs a day for a courtesy and a season and
     * a half for a betrayal, and `ASK_DAYS` spends every one of them through
     * `shortSkip`. The span is the channel; nothing about the asking itself
     * touches the body.
     */
    request: ['a_span_of_days'],
    /**
     * Both channels, and the second is the whole argument for the verb. The span is
     * months; `resolveVigil` rolls an ordinary wound off what came down for
     * somebody else, at `crippling` wherever the exposure share reaches half. A
     * watch kept a realm below a tribulation rung is the most dangerous generous
     * act in the game.
     */
    guard: ['a_span_of_days', 'the_crossing'],
    propose: ['a_span_of_days'],
    decline: ['a_span_of_days'],
    /**
     * Years, and the food clock runs through every one of them. The longest
     * span any verb in this set can spend, and therefore the largest exposure.
     */
    child: ['a_span_of_days'],
    /**
     * Inert by construction, and it has to stay that way: this is where every
     * sentence the parser did not understand lands.
     */
    unclear: []
} as const;

/**
 * The three `interact` intents that settle nothing.
 */
export const INTERACT_SETTLES_NOTHING: ReadonlySet<string> = new Set([
    'talk', 'trade', 'apologise'
]);

/**
 * How this act can end badly, given the verb and - where the verb alone cannot say
 * - the intent.
 */
export function canEndBadly(action: ActionName, intent?: string): readonly HowAnActCanEndBadly[] {
    if (action === 'interact' && INTERACT_SETTLES_NOTHING.has(intent ?? 'talk')) return [];
    return HOW_EACH_VERB_CAN_END_BADLY[action];
}

/**
 * Whether this act can hurt the person who takes it. The boolean over {@link
 * canEndBadly}, which is what a caller ranking sentences wants.
 */
export function canHurtYou(action: ActionName, intent?: string): boolean {
    return canEndBadly(action, intent).length > 0;
}
