/**
 * The closed action set, and how each verb in it is classed.
 *
 * The enum and the six lists over it are one subject and not two. Every list is
 * a `readonly ActionName[]` - none of them compiles without the enum, and each
 * is a statement about the same closed set. Adding a verb is a wide edit across
 * the enum and two or three lists; reclassifying one is a narrow edit to a list
 * alone. That is one reason to change with two sizes, not two reasons.
 *
 * `theVerbsOwnName` is here because it answers "is the whole sentence a verb's
 * name", which is a property of the names and of `READ_ONLY_ACTIONS` - the gate
 * that makes a bare word safe by construction.
 *
 * Single reason to change: the engine's verb list, or where a verb sits in it.
 *
 * Split out of `actions.ts`, which held this and the pattern table and the
 * sentence reader and the plan schema under one name that said none of them.
 * `actions.ts` re-exports everything here, so nothing that imported these has
 * to change and the spelling repair's harvest of that namespace is unmoved.
 */

/**
 * Every action the engine can execute. Closed, and short on purpose.
 *
 * ── Why it is not a verb list ─────────────────────────────────────────────
 * A flat taxonomy of verbs only grows. `negotiate, deceive, trade, flee`
 * becomes `bribe, threaten, spy, interrogate, steal, sabotage, recruit,
 * intimidate`, and every social nuance ends up as an engine mechanic. So the
 * expressive range lives in PARAMETERS instead:
 *
 *   interact      target + intent   dealing with a person or a faction
 *   investigate   target            examining a place, record, object, person
 *   move          target + intent   going somewhere, by whatever means
 *
 * alongside the world-facing operations that genuinely are distinct engine
 * routines with distinct state effects.
 *
 * `intent` is a free-ish label, and it is safe precisely because NOTHING in
 * the engine branches on it to decide an outcome. It is carried for the
 * narrator to reason about and for the log to record. The moment a line of
 * code reads `if (intent === 'bribe')` to pick a result, the design has
 * failed: the outcome must come from state - who these people are, what they
 * want, what they know, what is owed - not from the word the player used.
 *
 * The closed enum is the protection that stays. A model cannot widen this list
 * at runtime, so it cannot invent an action; adding a member is a deliberate
 * act that the compiler forces into `GameService.execute`.
 */
export const ACTION_NAMES = [
    // Semantic actions. The expressive surface, held open by parameters.
    'interact',
    'investigate',
    'move',
    /**
     * Getting there ON something rather than on foot.
     *
     * `what-a-conveyance-does-to-a-journey.ts` prices a mount, a drawn
     * carriage, a spirit boat and flight on one's own blade against the days
     * and the range, `bestForThisRoad` picks between them, and
     * `whatArrivingOnThisSays` is what a watcher at the far gate reads off the
     * arrival. None of it had a caller. `ride` was a LABEL on `move` - one of
     * five intents, every one of which resolved through the same flat
     * one-day journey - so "I ride to Scarwater" and "I walk to Scarwater"
     * were the same event with a different word on the log, and "I ride the
     * horse" asked after a place called `horse`.
     *
     * Its own member rather than a widened `move` because it is a different
     * question. `move` asks where; this asks where AND on what, prices the
     * road in the walking days the catalog states, and charges them.
     */
    'ride',
    /**
     * Stepping across the distance instead of covering it.
     *
     * `how-far-somebody-can-fold-space-and-what-it-costs.ts` has the whole of
     * it - the range curve off the rung, the two fixes and only two, the
     * quadratic settling, and the loudest arrival in the world - and its own
     * `FOLD_TRAVEL_ENGINE_GAP` says where it would go. Nothing called it, so
     * `spatial_folding` was a grant that granted a sentence in a document.
     */
    'fold',
    /**
     * Buying a place on somebody else's span, and reading the board first.
     *
     * The counter is the only door to the far half of the map for anybody
     * below the folding floor, and the BOARD is the more important half:
     * standing in front of it is how somebody who has never left their
     * province finds out there are others. `boardAt` and
     * `quotePassageAtACounter` were complete and unreachable.
     */
    'passage',
    /**
     * Giving your word, reading what you have given, and not keeping it.
     *
     * The oath contract shape was built and had no player path: a penalty
     * clause, a witnessing house, a term of years, and enforcement that is
     * structural rather than punitive. A house could put one on somebody and
     * nobody could swear one, carry one knowingly, or break one.
     */
    'oath',
    // World-facing operations: distinct engine routines, distinct state effects.
    /**
     * Hitting somebody, which for a long time had no route at all.
     *
     * The engine has carried a full confrontation model the whole time -
     * power assessment, edges, vectors, obligations, wounds that persist -
     * and the only thing a player could do with it was assess. Meanwhile
     * "I attack the nearest cultivator" fell through the entire table and
     * was caught by the cultivation branch, which sat them down to breathe
     * for a month. An enum member that plain English cannot reach is bad;
     * a missing one that lets another verb eat the sentence is worse.
     */
    'attack',
    /**
     * Making somebody do something, with hands rather than with words.
     *
     * ── WHY IT IS ITS OWN VERB AND NOT A PHRASING THAT REACHES `threaten` ──
     *
     * Because they are two acts, not two words for one, and the design owner
     * settled it in four: **"threaten is different, it's verbal."**
     *
     *   `threaten`   a promise of harm, and nothing has happened yet. This
     *                repo's own `what-somebody-does-about-being-wronged.ts`
     *                states the definition outright - "a threat costs its
     *                target nothing until it is made good on" - which is
     *                exactly why it sits among the `interact` intents beside
     *                talking and bargaining. It is a thing you SAY.
     *   `coerce`     the point at which the target stops being somebody being
     *                talked to. Hands on, or the harm actually begun, or the
     *                thing taken while they are held.
     *
     * A second door onto one resolver would be duplication and this is not
     * one: coercion fails the way a FIGHT fails rather than the way a
     * conversation fails. Somebody stronger than you does not decline to be
     * coerced - they answer, and you find out what that costs. So it resolves
     * through `resolveConfrontation` with `goal: 'coerce'`, beside attacking,
     * and the two differ only in what the aggressor wants at the end: a fight
     * wants them stopped, coercion wants them complying and still standing.
     *
     * `how-far-you-went-to-make-them-comply.ts` holds the ladder the two of
     * them are rungs of, and holds it as a VALUE rather than as a branch, so a
     * fourth level is a row and not a mechanism.
     *
     * ── AND IT IS THE SAME VERB WITH AN ANIMAL ON THE OTHER SIDE ──────────
     *
     * `BEAST_CHANGE_ORDINAL` does all the differentiating on its own. At and
     * above it a beast is a person - a shape, a voice, and the ability to
     * decline - and nothing here branches on whether the thing standing there
     * is one. Below it the top of the ladder is available and the bottom is
     * not: you cannot promise harm to something that does not take a promise,
     * and you can force it. **Forcing an animal to submit is taming**, and it
     * is this verb rather than a taming subsystem, which is why "I tame the
     * beast" is one of the phrasings that reaches it.
     */
    'coerce',
    'cultivate',
    'seclude',
    'breakthrough',
    'train_technique',
    'refine',
    'gather',
    /**
     * Going out after something that is not a person.
     *
     * `beasts.ts` is 1113 lines and, until this member existed, nothing in
     * `src/engine/`, `src/web/` or `src/server/` read a line of it. Sixteen
     * beasts on the cultivator ladder, eighteen materials priced in the herb
     * catalog's own bands, a weighted draw and a threats-above-you lookup, all
     * of it authored and none of it reachable by anybody playing.
     *
     * It is the missing answer to two separate questions. "What do cultivators
     * DO" - a beast is somewhere to go, something to weigh yourself against,
     * and a reason to come back carrying something. And where the top of the
     * material ladder comes from - a measurement showing no cultivator deaths
     * at the heaven band was read as saying the world produces no high-grade
     * material, and that measurement was about people. Beasts are the other
     * half of the population and their bodies are the legitimate supply.
     */
    'hunt',
    'eat',
    /**
     * Laying in food before it is needed.
     *
     * The engine has modelled provisions the whole time - the time skip
     * consumes rations, `provisions_exhausted` fires when they run out, the
     * price of a month of them is in the catalog and on the market board -
     * and the only food verb a player could reach was `eat`, which buys one
     * meal and refuses when they are not already hungry. So the interrupt
     * was warning them about a resource they had no way to acquire, and the
     * correct opening move in this game was unavailable.
     *
     * Satiety burns about two a day against a hundred, so a character
     * starves at about fifty days and the default seclusion is thirty. Two
     * cultivations and a death was the likeliest first session.
     */
    'provision',
    /**
     * Getting a wound seen to, which was a softlock.
     *
     * `treatWorstInjuries` has been in `engine/cultivation/injuries.ts` the
     * whole time and `scripts/playtest.ts` exercises it, so the mechanic
     * existed and only the route was missing. What that produced, found by
     * playing cold in a browser: a cultivator at Qi Condensation with three
     * untreated meridian injuries, told by the engine in as many words that
     * nothing heals them on their own and that any further combat is fatal.
     * Untreated injuries raise deviation risk, deviation adds another injury
     * and ejects them from seclusion after about a month, and the next attempt
     * goes wrong slightly sooner. They could not advance, could not heal, and
     * could not die - the run was neither winnable nor loseable, with three
     * hundred spirit stones in the purse and a physician advertised on the
     * board in front of them.
     *
     * An engine that manufactures a state it labels lethal, says outright that
     * it will not resolve itself, and offers no verb is worse than one that
     * never had the state.
     */
    'treat',
    /**
     * Buying something off the price board by name.
     *
     * `mortal-world.ts` advertises twenty-two priced lines and `market` prints
     * them; until this existed, four of the verbs that would spend money -
     * `eat`, `provision`, `refine`, `market` - covered exactly three of those
     * lines between them. "I buy a visit from the mortal physician" fell to the
     * INTERACT table, which looked for a person called "visit from the mortal
     * physician" and reported that nobody by that name was there. A price
     * quoted to a player who cannot pay it is a shop window with a wall behind
     * it.
     */
    'buy',
    /**
     * Putting something on the counter, which is the only way anything a
     * cultivator gathered ever becomes stones again.
     *
     * `quoteSale` and `quotePouchSale` have priced this the whole time, and
     * nothing called them. What that produced, found by playing: gathering
     * prices every herb it finds, the pouch fills with things with a list
     * value written next to them, and the purse stays empty, because there was
     * no sentence in the language that converted one into the other. "I sell a
     * Qi Grass" fell to the INTERACT table and the engine went looking for a
     * person called Qi Grass.
     *
     * The pouch is the resolver, not the party. A thing you are not carrying
     * cannot be sold, and a person is never a lot.
     */
    'sell',
    /**
     * Handing somebody a thing you already hold, which had no verb at all.
     *
     * ── THE OWNER'S OWN EXAMPLE, AND IT DID NOT RUN ──────────────────────
     *
     * "A person could steal and then hand it to someone else before running
     * away." Two of those three were verbs and the middle one was not, so the
     * sentence that motivates the whole feature stopped in the middle. Six
     * ordinary phrasings of it reached `unclear`: "I hand him the purse", "I
     * give Shen Liefeng my manual", "I press it into her hand", "I pass it to
     * him", "I put ten stones on the table".
     *
     * ── AND THE ENGINE HALF WAS ALREADY THE RIGHT SHAPE ──────────────────
     *
     * `gifted` is a member of `AcquisitionMode` in `possessions.ts` and
     * `gifted_resource` is a member of `FavorCause` in `grudges.ts`. Neither
     * needed adding. What was missing was the sentence.
     *
     * ── FREE, AND IT MEANS IT ────────────────────────────────────────────
     *
     * In neither {@link READ_ONLY_ACTIONS} nor {@link TIME_CONSUMING_ACTIONS},
     * with `sect`, `posture`, `seal`, `offer` and `oath` and for their reason:
     * it spends no day and it commits the giver to something they cannot walk
     * back. Nothing is attempted against the recipient, so nothing can fail -
     * {@link PRESSING_SOMEBODY} is the set of things that spend a day WHETHER
     * OR NOT they come off, and handing over a thing you are already holding is
     * not one of those. What protects a misparse is that it needs both halves:
     * a person, and a thing this cultivator is actually carrying.
     */
    'give',
    /**
     * What is in the pouch, asked in words.
     *
     * `alchemy_manage.inventory` has been complete the whole time - pills,
     * herbs, stones, accumulated toxicity against tolerance - and no sentence
     * reached it. Exactly the defect `list_recipes` had: a player could gather
     * for a season and have no way to find out what they were carrying, which
     * makes both the cauldron and the counter unusable.
     */
    'inventory',
    /**
     * Swallowing a pill.
     *
     * `alchemy_manage.consume_pill` is complete - the catalog row decides the
     * effect, toxicity accumulates on the body whether anybody wanted it to,
     * and a breakthrough pill is RECORDED for the next attempt rather than
     * asserted at it - and no sentence reached it. Two consequences, and the
     * second is the bigger:
     *
     *   The six `heal_hp` pills could be bought and never swallowed. A new
     *   cultivator could spend 28 of their 30 stones on a Minor Healing Pill
     *   and carry it to their death.
     *
     *   `handleConsumePill` is the ONLY writer of `FLAG_PENDING_PILL`, so
     *   `ctx.pill` at a breakthrough was always null and `MAX_PILL_BONUS` -
     *   0.35, the largest modifier in the game and the intended way past the
     *   rungs that kill - had never once fired in play.
     */
    'consume_pill',
    /**
     * The arts that could be learned, and the learning of one.
     *
     * `technique_manage.handleListAvailable` and `handleLearn` are complete -
     * realm gates, dao gates, element compatibility, per-run scarcity, and the
     * qi deviation a conflicting art routes through - and neither was
     * reachable. `train_technique` practises what is ALREADY known, so until
     * this existed the only arts a cultivator could ever hold were the ones a
     * site handed them.
     */
    'list_techniques',
    'learn_technique',
    /**
     * How a manual could go further, by every route there is.
     *
     * ONE COMMAND, THREE COSTS. Finding the next volume, being taught it and
     * writing it yourself are the same question asked of a world that answers
     * differently depending on what you have, and `assessAcquisition` funnels
     * all three through one report. A player standing at a ceiling has three
     * things they might do and had no way to compare them; the engine could
     * price all three the whole time and nothing asked it to.
     *
     * A read, and free, which is what makes it worth having: the decision is
     * the content, so the comparison must not itself cost a decade.
     */
    'acquisition',
    /**
     * ── THE THREE QUESTIONS A DRIVEN PLAYER ASKS AND COULD NOT ────────────
     *
     * Added together because they are one measurement.
     * `scripts/playtest-the-drive.mjs` puts the four questions a player asks
     * when they want something, in five plain phrasings each, over the real
     * `/api/act` endpoint. Joining a sect scored 5/5. These three scored 0/5,
     * 0/5 and 2/5, and the middle column was the finding: three of the five
     * "who can teach me" phrasings were DEFLECTED rather than refused - the
     * engine replied, the reply looked like an answer, and it was about
     * something else. "who could guide my cultivation" returned the character
     * sheet. "I look for a master" returned the room.
     *
     * A deflection is worse than a refusal because a player cannot tell it
     * from the game being small. All three route to a READ, so a misfire costs
     * nothing but a moment.
     */
    /**
     * Why nothing is accumulating, with the binding gate named.
     *
     * The engine has known the answer the whole time and said it in one place:
     * `techniqueCeiling(...).line` on the STATUS read, forty lines down a sheet
     * a player asks for when they want their hit points. Everything else - the
     * province's `localCeilingOrdinal`, the seat's two bars, the stagnation
     * clock that `stagnation_aging` kills on - was reachable by no sentence at
     * all. Twelve honest lives ended at ordinal 0 after fifty years of
     * two-year seclusions with nothing anywhere saying why.
     */
    'ceiling',
    /**
     * Who stands above them and would teach, said only of people they know of.
     *
     * `members.ts` has carried `role: 'master'` and a three-limit `teaching`
     * object on every person in the catalog since it was written, and
     * `rosterFor` already joins it to the player's own knowledge rows. Nothing
     * asked for it.
     */
    'teacher',
    /**
     * Where they could go, priced, with the qi and the province's ceiling.
     *
     * Distinct from `recall`, which reads their own head and answers "what
     * have I heard of". A name is not a destination until it has a cost and a
     * reason next to it, and the catalog holds both.
     */
    'destinations',
    /**
     * What ground this cultivator can point at teaches, and what it wants.
     *
     * The other half of `destinations`, and the half that was missing outright.
     * Twenty-three dao grounds are seeded into every world;
     * `daoGroundsInReachOf` had no caller anywhere in `src/web` or
     * `src/server`, so nothing a player could type reached one, and the only
     * place a player ever saw the name of one was a discovery leak in the
     * travel list that has since been closed.
     *
     * Reads their own knowledge rows and nothing else, exactly like `recall`,
     * so it cannot teach a name - and every ground it does name comes with
     * either what it teaches or precisely what they are short by.
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
     *
     * `data/cultivation/inheritance-trials.ts` is the largest finished system
     * in the project - twenty-odd sites, three unrelated kinds of gate, an
     * interior the type system keeps out of the pre-entry view - and until
     * this member existed nothing a player could type reached a single line
     * of it. `scripts/playtest-systems.ts` reported it as the finding: the
     * trials existed and were unplayable.
     *
     * One action carrying four verbs, on the `sect` precedent, because they
     * are four steps of one act and splitting them across `move`, `look` and
     * `investigate` would put the expensive one behind a verb whose whole
     * design is that it is cheap. See {@link SiteIntent}.
     */
    'site',
    /**
     * Putting things beyond your own death, and collecting what somebody else
     * put beyond theirs.
     *
     * Five steps of one act, on the `site` precedent: listing the counters,
     * burying a cache, digging one up, lodging a deposit against a phrase, and
     * claiming one. Splitting them across `move`, `interact` and `investigate`
     * would put the two that spend something behind verbs whose whole design
     * is that they are cheap.
     */
    'legacy',
    /**
     * ── INSTITUTIONS ACTING ON EACH OTHER, AND ON THE DEAD ────────────────
     *
     * Four verbs added together because they are one discovery, made by
     * playing the ambitious things a player reaches for once they know the
     * world exists. Twelve sentences from a sect head with fifty thousand
     * stones who had heard of every faction; all twelve dead, and five of them
     * dead in the worse way - swallowed by `interact`, which matches any
     * sentence naming a faction and answers it by walking the player over and
     * describing them. A player asking for something enormous got a shrug and
     * could not tell REFUSED from NOT IMPLEMENTED.
     *
     * The vocabulary above covers a cultivator's own life - train, eat, fight,
     * seclude, join, climb, be treated, buy - and almost nothing of what
     * institutions do to each other, or to you beyond membership. That is
     * where nearly all of the lore lives, and most of it is behind a form.
     *
     * All four share one shape: A PARTY ASKING SOMETHING OF ANOTHER PARTY, OF
     * THE DEAD, OR OF SOMEBODY ABOVE THE LID - and most of them are supposed
     * to be REFUSED. A refusal that names its reason is the win condition
     * here, not a consolation. The Requisition Against Standing Stock has been
     * granted once in four hundred years, and a player filing it and being
     * turned down in the terms the form itself uses has had a complete
     * interaction.
     *
     * Every one is gated on standing, and the gate speaks - see
     * `web/standing.ts`, which copies the refusal `sect-leadership.ts` already
     * produces rather than inventing a second voice for the same act.
     */
    /**
     * Asking an institution for a thing: a grant, an object off its standing
     * stock, recognition of a lineage.
     *
     * `sect-politics.ts` has carried `handlePetition` the whole time - it walks
     * the parentage chain one tier at a time, stops where the world stops it,
     * and returns the effect without the attribution where the chain runs past
     * what the player can name. Nothing typed reached it.
     */
    'petition',
    /**
     * One house's stance toward another: war, alliance, defection.
     *
     * `DISASTER_RESPONSES` prices war, aid and watching; `OPENLY_OR_IN_SECRET`
     * distinguishes an alliance from a conspiracy and says how each fails;
     * `ambition.contestedWith` holds nineteen symmetric contested claims and
     * `rivals` holds the feuds. Two courts in the catalog's own history have
     * already changed patrons. There was no verb for any of it.
     */
    'posture',
    /**
     * The thing under the mountain.
     *
     * Six houses hold a sealed ancestor with a written `wakeCondition` and
     * `wakeCost`; the strongest stands at forty-four. The legal and the illegal
     * routes are different acts by different people, and the action does not
     * ask which - whose mountain it is decides, out of the membership row.
     */
    'seal',
    /**
     * The offering upward, and the reading of a silence.
     *
     * `IMMORTAL_CHANNELS` models four answering channels, what each returns and
     * how much of it is usable; `MillennialOffering` is a type with a cost, a
     * response that is usually null, and what the house did about it. The
     * silence is equally consistent with four things and the engine will not
     * say which, which is the content rather than a gap.
     */
    'offer',
    /**
     * Going back down through the Lid, which is the only thing at the top of
     * the ladder that is a decision rather than a fact.
     *
     * `evaluateLidTransit(cultivator, 'down')` has priced this the whole time -
     * permitted, at `DESCENT_TRIBULATION_STRIKES` - and nothing called it, so
     * a True Immortal could be told what descending would cost by a comment in
     * the engine and by nothing a player could reach. What that produced,
     * found by playing at ordinal 46: every mortal-world verb answered "Not
     * from here" and there was no other verb, so the far side of the Lid read
     * as the game ending rather than as the game moving.
     *
     * It is not a travel option and must never become one. Nine strikes is
     * above the heaviest crossing in the game, the window on the ground is
     * `BREATHS_IN_THE_LOWER_REALM`, and the expulsion happens on its own
     * because a True Immortal down there is a thing being pushed back out.
     */
    'descend',
    // Pure reads.
    'look',
    'status',
    'assess',
    /**
     * What this cultivator is carrying in their head, asked in words.
     *
     * The knowledge layer is the spine of `docs/world/houses/discovery.md` and the
     * sheet shows the other axis in a panel, and neither could be asked about.
     * Found by a rank-band sweep, and the dead sentences were at the TOP of
     * the ladder rather than the bottom, which is where it matters most:
     *
     *   "what do I know of Lu Sheng"          -> unclear
     *   "what do I know of the Hollow Court"  -> unclear
     *   "what is my dao"                      -> unclear
     *
     * All three are one verb. A read of what the holder holds - a person, a
     * faction, a subject, or their own comprehension - answered out of
     * `knowledge_records` and the insight list and out of nothing else.
     *
     * The last of the three is close to the whole game at the ceiling. A
     * False Immortal cannot climb in rank again and can still climb in dao, so
     * `DaoView.theOnlyAxisLeft` is literally true for them, and until this
     * existed the only place it was ever said was a panel.
     */
    'recall',
    /**
     * WHOSE ART THAT WAS - the player putting the trust hierarchy's strongest
     * check to themselves.
     *
     * `docs/world/houses/trust.md` says a house's arts are the closest thing it has to
     * an identity and that watching somebody cultivate is the one reading that
     * goes straight to the thing in question. Nothing in the game could ask it.
     * A player watching somebody move had no sentence at all, and the two
     * things that decide the answer - their rung and what they have a reference
     * for - were both sitting in the database with no question pointed at them.
     *
     * Introspective, like `status` and `recall`: the character looking at
     * something and drawing on what they already hold. It costs no time, it is
     * never refused, and it consults no catalog the holder has no record for.
     *
     * THE ANSWER IS GRADED AND IT NEVER FAKES CONFIDENCE. Somebody with no
     * reference is told they would not know it, rather than handed a "no" they
     * did not earn. Somebody with a reference and too low a rung is told it
     * matches what they have heard and that they could not tell a good
     * imitation - the uncertainty IS the answer. Somebody with both gets it
     * flat, at a glance, and that terseness is the reward for the climb: it is
     * progression a player can feel that is not combat power.
     *
     * And it answers WHERE AN ART WAS LEARNED and never whom anybody serves.
     * The Hollow Court takes nobody below Void Refinement, so its people arrive
     * trained elsewhere and honestly perform their origin house's art - a
     * correct identification that leaves a wrong conclusion available. That is
     * the design, not a gap to paper over, so this verb volunteers no
     * allegiance it cannot know.
     */
    'recognise',
    /**
     * What the people here are saying is happening elsewhere.
     *
     * `recall` reads the holder's own head and structurally cannot teach them
     * anything. This is the opposite verb and the world had no route to it:
     * the simulation writes rankings, refusals, duels and houses opening closed
     * ground into the ledger every year, and the only way any of it reached a
     * player was the digest, which is gated on standing and is a report.
     *
     * Nobody finds out that two of the world's tallest people fell out by
     * being briefed. They find out because somebody in a market says so, and is
     * about two thirds right.
     *
     * A read, and it costs nothing but being somewhere with people in it. The
     * refusal where there is nobody is the content: a cultivator forty years
     * into a cave asking what is happening in the world is asking a wall.
     */
    'news',
    /**
     * CARRYING THE NEWS THE OTHER WAY: telling somebody that a wrong was done
     * to them, and putting a name on it.
     *
     * ── THE ASYMMETRY IT CLOSES ──────────────────────────────────────────
     *
     * `hearing-of-a-wrong.ts` is the receiving half and it works. Being told is
     * the event that opens the account - dated to the day you were told, at the
     * deed's own weight, against whoever the telling named - and `news` is a
     * live caller of it, so a square repeating something in front of the player
     * already does all of this to them.
     *
     * Nothing could do it in the other direction. Measured on the deterministic
     * reader: "I tell him that Cao Antao killed his brother" reached
     * `interact/talk` with the whole proposition swallowed into the party name,
     * and "I tell her that Cao Antao stole from her" reached `interact/steal` -
     * the reader saw `stole`, decided the PLAYER was stealing, and pointed an
     * attempt at the person being warned. The world could do this to a player
     * and the player could not do it to anybody, which is AGENTS.md's *if an NPC
     * can do it, you can* failing in the direction that is hardest to see.
     *
     * ── THREE PARTS, WHICH IS ONE MORE THAN MOST VERBS TAKE ──────────────
     *
     * `target` is who is being told and `topic` is what is being said, in the
     * player's own words. The third part - who it is being put on - is read out
     * of `topic` by `whoTheClaimBlames` and resolved by the engine against the
     * same knowledge-gated party lookup every other approach uses. It is not a
     * field of its own because it is not always there: a telling that names a
     * loss and nobody for it is the middle state the whole design is about.
     *
     * ── FREE, AND FOR `give`'S REASON ────────────────────────────────────
     *
     * In neither {@link READ_ONLY_ACTIONS} nor {@link TIME_CONSUMING_ACTIONS},
     * with `give`, `sect`, `posture`, `seal`, `offer` and `oath`. It spends no
     * day and it commits the teller to something they cannot walk back: their
     * name goes onto the row as `told-by:`, so *who told him* has an answer
     * that a person in the world can reach, and whatever anybody does about
     * that is an ordinary deed.
     *
     * What protects a misparse is that it needs both halves, exactly as `give`
     * does - a person who is actually here, and a wrong the world has already
     * priced that this cultivator can point at. Neither is supplied by a
     * sentence the parser guessed at.
     */
    'tell',
    /**
     * ASKING A PERSON FOR SOMETHING, which is the verb the design rests on and
     * which did not exist.
     *
     * The engine says, correctly and often, that there are exactly two ways
     * past a manual's ceiling - another book, or somebody willing to teach you.
     * The book half works: a common primer costs about eight spirit stones at a
     * stall. The teacher half had no verb at all, and four phrasings of it
     * reached four different lookups, none of which was a person:
     *
     *   I ask X to teach me                   the roster of everybody above me
     *   I beg X to take me as a disciple      a description of X
     *   ask X for the Lesser Qi-Gathering     the almanac entry for the book
     *   I bribe X with 60 spirit stones       "X agreed." Agreed to what?
     *
     * `interact` is not this. It carries an intent that nothing branches on,
     * which is right for the verb and useless for the OBJECT: what is being
     * asked FOR has to reach the engine, because `AskWeight` prices resistance
     * and duration off it and because a take has to end in the thing actually
     * happening. So `target` names who, `intent` names what KIND of thing was
     * asked - one of a closed set, from `what-a-request-asks-and-of-whom.ts` -
     * and `topic` carries what was named, resolved against the same catalogs
     * everything else uses.
     *
     * It is deliberately NOT free. It spends days, it can spend stones, and on
     * a take it writes an art onto the sheet or a name into the knowledge
     * table.
     */
    'request',
    /**
     * Proposing a match, and answering one that has been put to you.
     *
     * The other half of the life this game models. A cultivator climbs, stalls
     * - which is what the Late Age premise says almost everybody does - and
     * then has decades and a ceiling, and the thing to do with those decades is
     * somebody else. None of the machinery for it was missing: the price of
     * something singular its holder will not sell, the `marriage_pact` oath,
     * the walk-out, the line that dilutes over three generations. What was
     * missing is that a person at a table could reach any of it.
     *
     * `target` is who or whose house, `topic` is what is being put on the table
     * and the list of what may go there is open, and `intent` says whether the
     * sentence was proposing or agreeing. Nothing anywhere branches on gender,
     * on who asked, or on which side of it the player is.
     */
    'propose',
    /**
     * Saying no to a match, and leaving one you are already in.
     *
     * One verb because they are one act pointed at two moments, and one
     * implementation because the rule that binds NPCs binds the player: a
     * player matched by their own house who runs, and somebody running from a
     * clan that will not marry out, are the same call.
     *
     * A refusal is not free and is not automatic. What it leaves is priced by
     * what the asking side staked, which is what stops "no" being a move
     * nobody can afford and stops it being one that costs nothing.
     */
    'decline',
    /**
     * Having a child, and spending the years.
     *
     * The decision, not the clock. What the player chooses is to spend the
     * time; the engine spends it the way it spends time everywhere, and this
     * verb invents no second one. `days` carries the stretch and `target` the
     * other parent - or, with `intent: 'place'`, the house a child is being
     * placed at on somebody's word, which is `spendAWord` reaching a player for
     * the first time.
     */
    'child',
    /**
     * The parser did not understand, and nothing happens.
     *
     * A member of the closed set rather than a special case, so the exhaustive
     * switch in `GameService.execute` is forced to handle it and no future verb
     * can quietly become the fallback again. The model should never CHOOSE it -
     * the glossary says so - but a model that does costs the player nothing,
     * which is the entire point of it being here.
     */
    'unclear'
] as const;

export type ActionName = typeof ACTION_NAMES[number];

/**
 * Actions that pass no in-world time and change no cultivator state.
 *
 * `interact` was on this list and was never a read. Seven of its ten intents
 * reach the pressure model, which spends days out of the same clock everything
 * else spends and can empty the purse. Measured in a played run before the
 * change - "can I bribe Bai Jinglu with 10 spirit stones", purse 30 to 20, day
 * 16 to 17 - and the question was the whole of the sentence. The note under
 * {@link TIME_CONSUMING_ACTIONS} carries the reasoning, and says why it went
 * into neither list rather than into that one.
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
     *
     * A petition costs no days and moves no stones: it travels as far as
     * somebody is willing to pass it and stops, and the only state it writes is
     * a knowledge record for a tier that answered - which is one of the few
     * legitimate ways a name enters a cultivator's world at all.
     */
    'petition'
] as const;

/**
 * `sect`, `posture`, `seal`, `offer` and `oath` are in neither list on purpose.
 * So is `interact`, which is the sixth and the one that had to be found by
 * playing -
 * the note under {@link TIME_CONSUMING_ACTIONS} carries it.
 *
 * None of them spends days, and every one of them commits somebody to
 * something they cannot walk back, so classifying them as free would be as
 * wrong as classifying them as slow. Which one happened depends on whether a
 * party was named and on what the membership row says, so it is decided at the
 * point of execution - and the protection a misparse actually needs is supplied
 * instead by {@link DEFAULT_POSTURE_INTENT}, {@link DEFAULT_SEAL_INTENT},
 * {@link DEFAULT_OFFER_INTENT} and {@link DEFAULT_OATH_INTENT}, every one of
 * which is a read.
 *
 * `oath` is the newest and the sharpest case for the arrangement. Swearing one
 * writes a permanent row with a named holder, a witnessing house and a penalty
 * clause; breaking one writes a second naming the person and reopens whatever
 * the first was closing. Neither spends a day, and neither may be reached by a
 * sentence the parser did not understand.
 *
 * The original note, which still holds:
 *
 * Listing what would take you costs nothing; being taken costs a life's worth
 * of allegiance. Which one happened depends on whether a sect was named, so it
 * is classified at the point of execution rather than here.
 */

// ─── A VERB SHOULD ANSWER TO ITS OWN NAME ─────────────────────────────────
//
// Measured by `scripts/probe-does-every-verb-answer-to-its-own-name.ts`: 17 of
// 40 action names reached their own verb when typed bare. `inventory` on its
// own reached nothing, and `market` on its own was answered by walking the
// player over to talk to somebody. The bare word is the cheapest thing a
// person types and usually the first, and somebody whose first three words
// each reach nothing concludes the game is broken rather than that they have
// guessed the vocabulary wrong.
//
// THE GATE IS `READ_ONLY_ACTIONS`, and it does all the work here. Those verbs
// pass no in-world time and change no cultivator state, so a bare word
// reaching one cannot cost a day, a stone or a life however badly it was
// meant. That makes this safe by construction rather than by an exception list
// somebody has to maintain - and it is why every verb it declines is declined
// without a special case being written for it:
//
//   descend   crosses the Lid, once, and ends the footing the whole run stands
//             on. A bare word must never be able to reach it
//   seal      wakes a sealed ancestor: irreversible, and a crime or not
//             depending on what a membership row says
//   move      movement naming no destination is the documented "I set out"
//             failure - the engine would store the sentence as a place
//   sect      listing what would take you is free; being taken costs a life's
//             worth of allegiance, and the bare word cannot say which
//   posture   three of its five commit a house to something it cannot undo
//   offer     spends the thing offered
//   site, legacy, refine, provision, treat, interact, request
//             each either takes something or needs a target the bare word
//             does not supply
//   tell      needs a person AND a claim, and puts the teller's name on a row
//             somebody else will act on. The bare word supplies neither half
//
// Every one of those is already argued for beside its own verb. This rule adds
// no judgement of its own; it reads the classification the file already keeps.

/**
 * The action a sentence names, when the sentence is nothing but the name.
 *
 * Whole-input only, so it cannot swallow the verb next door: a sentence with a
 * second word in it does not match at all and falls through to the table
 * untouched.
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
 *
 * The list exists to be asserted against. An intent the engine did not
 * understand must never resolve to anything in it: a misparse that costs a
 * season costs a starving cultivator their run, and a player should be able to
 * type something ambiguous a hundred times and lose nothing but a moment.
 */
export const TIME_CONSUMING_ACTIONS: readonly ActionName[] = [
    'cultivate', 'seclude', 'breakthrough', 'train_technique',
    'move', 'gather', 'hunt', 'wait', 'work', 'refine', 'eat',
    /**
     * The three ways of covering ground that are not walking, and all three
     * spend real days off the catalog's own `travelDays` rather than the flat
     * one `move` spends.
     *
     * `ride` charges the road, priced by what is under the rider. `fold`
     * charges the settling, which is quadratic in how hard they reached and is
     * three days at full stretch. `passage` charges the wait for a departure
     * and then the settling, which is worst for the people the ticket is worth
     * most to.
     *
     * `passage` takes the coarse label the way `site` does: reading the board
     * is a free read and buying a place on a span is not, and the whole action
     * is declared dangerous because the conservative direction is the only safe
     * one to be wrong in. What protects a misparse is
     * {@link DEFAULT_PASSAGE_INTENT}, which is the read.
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
     *
     * Coercion resolves through `resolveConfrontation` with `goal: 'coerce'` -
     * the same resolver, the same wounds, the same `evaluateDeathConditions` on
     * the far side - and the two differ only in what the aggressor wants at the
     * end. A misparse that can end the run inside one turn belongs on this list
     * whatever the sentence was trying to say.
     */
    'coerce',
    /**
     * Here for the same reason, and it is not obvious from the name. An art
     * that FIGHTS the spirit root is learnable and routes through the qi
     * deviation engine on the spot: torn meridians, lost progress, and
     * `evaluateDeathConditions` called on the far side of it. A misparse must
     * never reach that.
     */
    'learn_technique',
    /**
     * And this one, which is even less obvious. Swallowing a pill spends no
     * day at all - and toxicity crossing `TOXICITY_TOLERANCE` mints a real
     * poison injury through the same path every other wound takes, with
     * `evaluateDeathConditions` running on the far side of it. This list is a
     * floor on what a MISPARSE may reach, not a description of what each
     * action costs, and a verb that can write a wound belongs on it.
     */
    'consume_pill',
    /**
     * Here for exactly the same reason, and it is the strongest case on the
     * list. Nine strikes of the heaviest tribulation in the game, weathered by
     * somebody who has already spent a life reaching the point where they could
     * be struck by it. A misparse that reaches this ends the run, so nothing
     * ambiguous may.
     */
    'descend',
    /**
     * Here for the same reason `attack` is, and not because every intent it
     * carries costs anything: approaching a site and reading it from outside
     * are reads that pass no time at all. Going into one spends days and puts
     * a body in front of a thing set at an ordinal, so the whole action is
     * declared dangerous. This list is a floor on what a MISPARSE may reach,
     * not a description of what each intent costs, and the conservative
     * direction is the only safe one to be wrong in.
     */
    'site',
    // Burying spends a week or a season with a spade, and the food clock
    // runs through it. Conservative direction, same as `site`.
    'legacy',
    /**
     * Putting something to somebody costs a day for a courtesy and a season and
     * a half for a betrayal - `ASK_DAYS` in `an-attempt-to-move-somebody.ts`
     * owns the figure - and it can spend the whole purse on the way.
     *
     * On this list rather than in `READ_ONLY_ACTIONS` on purpose, and `interact`
     * is the reason it says so: it carried the same leverage intents, spent the
     * same days and the same stones, and was classified free. See the note
     * under this list.
     */
    'request',
] as const;

/**
 * `interact` is in neither list, and it is the fifth member of the paragraph
 * above rather than a fourth exception to it.
 *
 * It used to be in `READ_ONLY_ACTIONS` and it was never a read. Seven of its
 * ten intents - {@link PRESSING_SOMEBODY} - reach `resolveAttempt` through
 * `GameService.pressSomebody`, which runs the days through `shortSkip` like
 * every other span in the game, so the food clock runs through them, and writes
 * `-result.stonesSpent` against the purse when the attempt lands. Played cold
 * before the change, on a fresh run carrying thirty stones:
 *
 *   > can I bribe Bai Jinglu with 10 spirit stones
 *     purse 30 -> 20, day 16 -> 17
 *
 * A question spent ten spirit stones and a day, and the mislabel is what made
 * it possible twice over. It kept `interact` out of the assertion
 * `TIME_CONSUMING_ACTIONS` exists for, AND it made {@link theReadThatAnswersIt}
 * hand the question straight back to the executor - because that guard trusts
 * `READ_ONLY_ACTIONS` to say which verbs are already free, which is exactly
 * what makes it complete for every verb that is labelled correctly.
 *
 * So classifying it free is wrong and classifying it slow is equally wrong, on
 * the same reasoning `sect`, `posture`, `seal` and `offer` are given: WHICH ONE
 * HAPPENED DEPENDS ON THE INTENT, and the intent is decided at the point of
 * execution. The difference from `site`, which took the coarse label and was
 * declared dangerous whole, is that `site` is only ever reached by a sentence
 * about a site, and `interact` is this parser's broadest catch for anything
 * involving a person. "I follow the cultivator", "I talk to the cultivator by
 * the well" and "I steal from the market stall keeper" all land here, all cost
 * nothing, and `tests/web/coverage.test.ts` asserts that they cost nothing.
 * Declaring the whole action slow would have turned that guard red on three
 * sentences that are inert in fact - and the fix for a guard that reports the
 * world moving as the world breaking is never to widen the guard.
 *
 * The protection a misparse actually needs is supplied where the other four
 * supply it: THE DEFAULT IS THE CHEAP BRANCH. A sentence that names none of the
 * seven verbs falls through to `talk`, which describes somebody and settles
 * nothing, and `FALLBACK_ACTION` is `unclear` rather than this - so nothing the
 * parser failed to understand reaches an attempt at all. That is asserted at
 * the intent rather than at the action in `tests/web/misparse.test.ts`, which
 * is the sharper claim and the one that is actually true.
 */

/** What an unparseable sentence resolves to. Inert, by construction. */
export const FALLBACK_ACTION: ActionName = 'unclear';

/** Actions that take a duration in days. Every other action ignores one. */
export const TIMED_ACTIONS: readonly ActionName[] = [
    'cultivate', 'seclude', 'work', 'provision', 'legacy',
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
    // WHO is being handed it. The thing itself rides on `topic`, because a
    // gift is the one verb in the set that needs both halves named and neither
    // substitutes: handing the wrong person the right thing is a different
    // event from handing the right person the wrong one.
    'give',
    /**
     * Where they are going, resolved against the same three registers `move`
     * resolves against - so a name the world has never heard of reaches
     * nothing here either, and none of the three can store a sentence as a
     * location.
     *
     * `oath` takes the other party instead: the house or the person a word is
     * being given to, through the same knowledge-gated lookup, so swearing
     * something to a house nobody has heard of is refused identically to
     * swearing it to one that does not exist.
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
     * The art being ASKED about, by name, which is where a question about
     * learning one lands. Free and it must be: a player is entitled to ask
     * what a book would take a hundred times and lose nothing, and the whole
     * reason this target exists is that "can I learn the Lesser Qi-Gathering
     * Manual" used to LEARN IT. An unresolvable name falls through to the
     * listing rather than being refused.
     */
    'list_techniques',
    // The pill, by name. Resolved against the POUCH, so a pill nobody is
    // carrying is refused with what they are carrying attached.
    'consume_pill',
    /**
     * The other party, by name: the institution being asked, the house being
     * declared against, the mountain with something under it, the line an
     * offering is being sent up.
     *
     * All four resolve through the same knowledge-gated faction lookup, so a
     * house the player has never heard of resolves to nothing and is refused
     * identically to one that does not exist. That equivalence is required
     * rather than incidental: asking about a thing must not teach its existence,
     * and the shape of the refusal must not be the answer.
     */
    'petition', 'posture', 'seal', 'offer',
    /**
     * The person it is being put to, by name or by the phrase that points at
     * them. Resolved through the same knowledge-gated party lookup `interact`
     * uses, and refused with the same guiding refusal - who is actually here,
     * and which of them the player could put it to - when it resolves to
     * nobody.
     */
    'request',
    /**
     * Who is being told. Resolved through the same knowledge-gated party lookup
     * `interact` and `request` use, and refused with the same guiding refusal
     * when it reaches nobody - because a telling that reaches nobody is not a
     * telling, and the person has to be somewhere the player can speak to them.
     */
    'tell'
] as const;

/**
 * `look` is deliberately NOT in the list above, even though the history read
 * can use a place name.
 *
 * The deterministic parser hands its own plan straight to the service and is
 * not filtered here, so "what happened at the Reed Scar" keeps its subject on
 * that path. A MODEL-planned look loses it and answers about the ground the
 * cultivator is standing on, which is the overwhelmingly common reading of the
 * question and the safe direction to be wrong in: a stripped subject costs a
 * player a follow-up sentence, and letting a model attach a free-text subject
 * to every observation widens the one field this file exists to keep narrow.
 */

/**
 * Actions that may carry a topic. `sect` uses it for the siphoning pace.
 *
 * `petition` uses it for the MATTER - what is actually being asked for, in the
 * petitioner's own words. It is free text and it is safe for the same reason
 * `intent` is: nothing branches on it to decide whether the petition is
 * granted. It is carried into the record and shown back in the refusal, which
 * is precisely the point - being told no in the terms you asked in is the
 * interaction.
 */
export const TOPIC_ACTIONS: readonly ActionName[] = [
    'interact', 'sect', 'petition',
    // WHAT is being handed over, in the player's own words, resolved against
    // the pouch by the handler. See `give` in {@link TARGETED_ACTIONS} for why
    // it needs a field of its own rather than riding on `target`.
    'give',
    /**
     * `offer` uses it for the WORD that goes down the line with whatever is
     * sent, which is half of what a proxy action is: an object arrives, and a
     * message says what it is for. Free text, carried into the recipient's
     * memory and into a secret fact, and read by no conditional - the whole
     * unreliability of acting by proxy is that people who are not you decide
     * what you meant.
     */
    'offer',
    /**
     * `request` uses it for WHAT WAS NAMED: the art, the person to be
     * introduced to, the subject. Free text, resolved against the same catalogs
     * every other target resolves against, and refused by name when it resolves
     * to nothing - which is the point, because "no art called that" is a
     * different answer from "they will not teach you that" and a player is
     * entitled to know which one they got.
     */
    'request',
    /**
     * `ride` uses it for WHAT IS UNDER THEM, when the sentence names one.
     * Matched against `CONVEYANCES` and ignored where it matches nothing:
     * which conveyance actually suits the road is `bestForThisRoad`'s answer
     * and never the word's, so naming a beast expresses a preference and
     * cannot produce a journey the rider could not have made.
     */
    'ride',
    /**
     * `oath` uses it for WHAT IS BEING SWORN, in the swearer's own words. Free
     * text, written into `terms` on the ledger row - which is the field
     * `grudges.ts` requires an oath to carry - and read by no conditional. It
     * is what somebody reads in eighty years when they are working out why
     * this person was standing where they were standing.
     */
    'oath',
    /**
     * `tell` uses it for WHAT IS BEING SAID, in the teller's own words - the
     * whole proposition, not a label for it. Two things read it and neither
     * decides an outcome: `whoTheClaimBlames` looks in it for a name, which the
     * engine then resolves like any other party, and the answer echoes it back
     * so the player is told what landed in the terms they said it in.
     *
     * Nothing checks whether it is TRUE, here or anywhere on the path. That is
     * the design rather than an omission - see `hearing-of-a-wrong.ts`.
     */
    'tell'
] as const;

/**
 * Actions that carry a free-text intent. Never branched on for an outcome -
 * with one deliberate exception, `sect`, whose intent selects which of the
 * sect surface's five verbs runs. It is safe there because the value is
 * produced by {@link SECT_INTENT_PATTERNS} rather than by a model: the model's
 * own string is normalised to a label and then matched against the same closed
 * set, so an unrecognised one falls through to the listing.
 */
export const INTENT_ACTIONS: readonly ActionName[] = [
    'interact', 'move', 'attack', 'sect',
    /**
     * `look` is the second exception, and it is safe for the same reason: the
     * label selects WHICH READ runs - the room, the faces in it, or what was
     * done to the ground here - and every one of those is answered out of
     * state. An unrecognised label falls through to the room, which is what
     * `look` did before any of them existed.
     */
    'look',
    /**
     * `site` is the third, and it carries the same guarantee with one extra
     * obligation. The label selects which of the four steps runs - reaching
     * one, reading it from outside, going in, taking what is behind it - and
     * every outcome on the far side is computed from the catalog and the
     * cultivator's own rows. What is different here is that one of the four
     * SPENDS SOMETHING, so an unrecognised label must fall through to the
     * cheapest of them and not to the expensive one. It falls through to the
     * listing. See `SITE_INTENTS` and `GameService.site`.
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
     * `request` carries the site rule with one difference worth stating: what
     * the label selects is not which routine runs but WHAT IS BEING ASKED FOR,
     * which is the one thing about an approach the engine is required to read.
     * `asking.md` is the reason - asking a gate guard for a name and asking the
     * same guard to leave the gate unwatched are the same sentence with the
     * same charm behind it, and they are not remotely the same attempt.
     *
     * That does not weaken the rule this list exists for. Nothing branches on
     * the VERB; the kind comes from a closed set produced by
     * `what-a-request-asks-and-of-whom.ts`, an unrecognised label falls through
     * to the cheapest reading, and `AskWeight` - which the resolver actually
     * prices off - is derived from the kind and from `manuals.ts`, never from
     * the word the player typed.
     */
    'request',
    /**
     * The four new ones, all carrying the same guarantee and the same extra
     * obligation `site` carries.
     *
     * The label selects WHICH ROUTINE runs - which form is being filed, which
     * stance is being taken, whether the seal is being read or spent, whether
     * the channel is being read or paid - and every outcome on the far side is
     * computed from the catalog and the membership row. What is different from
     * `look` and `recall` is that one branch of each COMMITS THE HOUSE, so an
     * unrecognised label must fall through to the read and never to the
     * commitment. It does, by construction: see the four DEFAULT_* constants,
     * every one of which is the cheapest branch the action has.
     */
    'petition', 'posture', 'seal', 'offer',
    /**
     * `passage` and `oath` are the sixth and seventh, and both carry the `site`
     * rule: the label picks which step runs, one step of each SPENDS or COMMITS
     * something, and an unrecognised label must fall through to the read.
     *
     * `passage` falls through to the board, which is a free list of what runs
     * from this counter. `oath` falls through to reading what the swearer
     * already carries, which touches their own ledger rows and nothing else.
     * See {@link DEFAULT_PASSAGE_INTENT} and {@link DEFAULT_OATH_INTENT}.
     */
    'passage', 'oath',
    /**
     * `work` carries exactly one label and it exists to make a QUESTION free.
     *
     * ── THE MEASUREMENT ──────────────────────────────────────────────────
     *
     * Found by playing. `any work going?` spent NINETY DAYS as a Shipmaster -
     * a question, answered by taking a season of somebody else's fields. That
     * is the class of defect `misparse.test.ts` exists for, stated in its own
     * header as the sentence that killed a run, and it arrives here because
     * naming no trade at all is deliberately read as *take any work*:
     * `WORK_UNSPECIFIED` matches the empty string on purpose, so that "I take
     * whatever the village will give me" is not answered with a menu.
     *
     * Both readings are right and they are different sentences. `board` is the
     * label that tells them apart, and it is the ONLY thing it does - which of
     * the two runs, never what either one produces.
     *
     * ── AND THE DEFAULT IS THE COSTLY ONE, WHICH IS THE EXCEPTION ────────
     *
     * Every other action on this list defaults to its read. `work` cannot,
     * because its bare form is the sentence somebody types when they are out of
     * stones and out of options, and answering that with a listing costs them a
     * turn they may not have. So the default stays where it was and the LABEL
     * is what buys the free branch, which inverts the usual protection.
     *
     * What keeps that safe is that nothing unparsed can reach the costly
     * branch: `work` is in {@link TIME_CONSUMING_ACTIONS}, so the assertion
     * that a misparse never reaches a slow verb already covers it, and the
     * label is only ever set by a phrasing that is a question by construction.
     */
    'work'
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// AND THE OTHER AXIS: WHETHER IT CAN HURT YOU
// ═══════════════════════════════════════════════════════════════════════════
//
// THE GAP THIS CLOSES, MEASURED. The web layer's suggestion strip was swept
// across three pinned worlds and 102 squares and every square scored 1.000 on
// `costsTheAskerNothing`: city 12/12, market_town 15/15, village 9/9,
// site 42/42. A cut flat at the ceiling carries no information, and the reason
// is the instrument rather than the world. **Costly in this file has always
// meant SPENDS - a turn, a day, or the purse. It has never meant CAN HURT
// YOU.** `I buy a Lesser Qi-Gathering Manual` scores costly. So does
// `I travel to Mudsummer`. The design owner's complaint that started it -
// everything reads as safe - is about harm, and until now nothing in `src/`
// split safe from dangerous at all.
//
// THE CLASSIFICATION WAS ALREADY HERE, WEARING THE COST LIST'S CLOTHES. Read
// {@link TIME_CONSUMING_ACTIONS} again: its own first line is "Actions that
// spend in-world time, AND CAN THEREFORE KILL", and five of its members are on
// it for the second half alone, each saying so in its own comment -
//
//   attack         "Not because it spends days. Because it can end the run
//                  inside one turn, which is the thing this list is actually
//                  protecting against."
//   coerce         the same resolver, the same wounds, the same
//                  `evaluateDeathConditions` on the far side
//   consume_pill   "Swallowing a pill spends no day at all" - and toxicity
//                  past `TOXICITY_TOLERANCE` mints a real poison injury
//   learn_technique an art that FIGHTS the spirit root routes through the qi
//                  deviation engine on the spot
//   descend        nine strikes of the heaviest tribulation in the game
//
// - and the list says three separate times that it is "a floor on what a
// MISPARSE may reach, not a description of what each action costs". So the
// harm axis has been in this file the whole time as PROSE, folded into a list
// whose name says something else, and readable by nothing. That is
// `AGENTS.md`'s *a field nothing writes* one size up: the knowledge exists, it
// is correct, and no consumer can ask for it.
//
// This section is that prose promoted to a value. Nothing below is a new
// judgement about any verb; every entry cites the code path that already
// decides it.
//
// ── WHAT THIS IS NOT ─────────────────────────────────────────────────────
//
// **NOT A SECOND MISPARSE FLOOR.** {@link TIME_CONSUMING_ACTIONS} is that, it
// stays that, and it must go on being the thing asserted against, because it
// is deliberately WIDER than the truth in the conservative direction. This
// table is deliberately ACCURATE, which is the opposite obligation - a
// suggestion strip that flags everything is the same failure as one that flags
// nothing, and the owner is already looking at one of those. Never gate a
// misparse on this.
//
// **NOT A SEVERITY SCALE.** A closed union and a set over it. A number here
// would invite tuning and nobody has ruled on what the numbers would mean.
//
// **NOT ABOUT WHAT IT COSTS.** The two axes are orthogonal and both cells off
// the diagonal are occupied: `buy` spends the purse and cannot hurt anybody,
// `attack` spends no day and can end the run in one turn.

/**
 * The ways an act reaches this cultivator's body, as a closed set.
 *
 * Five, because five is how many code paths in `src/` can take HP off the
 * player or call `evaluateDeathConditions` on them. Derived by following the
 * callers rather than by deciding what ought to be dangerous, which is why
 * there is no `social` member: being caught stealing writes a row that a house
 * acts on LATER (`being-hunted.ts`, `what-a-house-does-when-it-catches-you.ts`)
 * and takes nothing off anybody in the turn that produced it. What is here is
 * what can happen to you before the answer comes back.
 */
export type HowAnActCanEndBadly =
    /**
     * `resolveExchange` runs with this cultivator's body on one side of it.
     * The one channel that needs no time at all: a single turn, HP off a
     * fraction of the defender's own maximum, wounds that persist, and
     * `evaluateDeathConditions` on the far side.
     *
     * Callers in `src/`: `combat-manage.ts` (attack, coerce),
     * `site-verbs.ts#forceAtOrdinal` (a gate, and then the ground behind it),
     * `turn-engine.ts#hunt` through `assessPower`.
     */
    | 'force'
    /**
     * A stretch of days passes over this body, which is the broadest channel
     * and the one the Late Age actually kills people with.
     *
     * `simulateTimeSkip` runs starvation against `SATIETY_BURN_BY_REALM`,
     * untreated injuries against the deviation odds, deviation against the
     * meridians, and then `evaluateDeathConditions`. The encounter window rolls
     * over the same span - `encountersFor` in `web/encounters.ts`, where
     * `VERB_ACTIVITY` coarsens the verb to one of seven exposures and an entry
     * at `stance: 'engaged'` is handed to the combat resolver.
     *
     * So this member covers being worn out AND being found. They are one
     * channel because they are one span: cut the days and you cut both.
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
 *
 * A full `Record<ActionName, …>` rather than a list of the dangerous ones, on
 * the {@link WHAT_EACH_VERB_IS_FOR} precedent: a verb added to
 * {@link ACTION_NAMES} does not compile until somebody has said whether it can
 * hurt the person who types it. The check is `tsc` rather than a reviewer's
 * memory, and the alternative - a `readonly ActionName[]` - is silently
 * complete the moment a new verb is left off it.
 *
 * ── WHY THE ENTRIES ARE NOT ARGUED HERE ONE BY ONE ───────────────────────
 *
 * Most of them are already argued somewhere in this file, and the ones that
 * are not are a single lookup: does the handler reach `simulateTimeSkip`,
 * `resolveExchange`, a tribulation, the deviation engine, or the toxicity
 * ledger. Comments below carry only the entries where the answer surprised
 * somebody who went looking, because those are the ones that will be
 * re-litigated.
 */
export const HOW_EACH_VERB_CAN_END_BADLY: Readonly<Record<ActionName, readonly HowAnActCanEndBadly[]>> = {
    /**
     * Eight of its ten intents run their days through `GameService.shortSkip`,
     * which is a real span with a real encounter window over it. The other two
     * -- `talk`, `trade`, `apologise` -- settle nothing and pass no time.
     *
     * The action-level answer is therefore the pressing one, and
     * {@link canEndBadly} narrows it by intent. This is the same verb that
     * forced {@link costsTheAskerNothing} to be a function rather than a list,
     * for the same reason and at the same seam: the action alone cannot answer
     * either question about `interact`.
     */
    interact: ['a_span_of_days'],
    investigate: [],
    move: ['a_span_of_days'],
    ride: ['a_span_of_days'],
    fold: ['a_span_of_days'],
    passage: ['a_span_of_days'],
    /**
     * Giving your word takes nothing off the body. What it writes is a
     * permanent row with a penalty clause and a witnessing house, and every
     * consequence of that arrives later through somebody else's decision -
     * which is a real risk and is not this channel. See the note on
     * {@link HowAnActCanEndBadly} for why there is no `social` member.
     */
    oath: [],
    attack: ['force'],
    coerce: ['force'],
    cultivate: ['a_span_of_days'],
    seclude: ['a_span_of_days'],
    /**
     * The crossing itself, and only above `triggersHeavenlyTribulation`'s
     * floor. Below it a failed attempt costs progress and a wound, which is the
     * same body cost the span channel already carries - so this entry names the
     * thing that is different about a breakthrough rather than the thing it
     * shares with everything else.
     */
    breakthrough: ['the_crossing'],
    /**
     * Both channels, and the second is the one nobody expects. Practice spends
     * days; practising an art that fights the root routes through the deviation
     * engine on the spot, and `technique-manage.ts` calls
     * `evaluateDeathConditions` on the far side of the practice path as well as
     * the learning path.
     */
    train_technique: ['a_span_of_days', 'the_art'],
    /**
     * On {@link TIME_CONSUMING_ACTIONS} and it reaches no time skip at all -
     * `GameService.refine` neither advances days nor calls one. Refining makes
     * a pill; the toxicity is charged when somebody swallows it, which is
     * `consume_pill`. The classification difference is not a contradiction: one
     * list is a floor on a misparse and this one is a description.
     */
    refine: [],
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
     * rather than folded in, because what spends there is the copying and not
     * the sale, the player has to name an art to reach it, and flagging every
     * `I sell my herbs` as dangerous is the cry-wolf failure this table exists
     * to avoid. If a consumer ever needs that branch it should ask about the
     * copying, which is a separate act with a separate price.
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
     * SITTING STILL IS NOT SAFE, and this is the entry that says so. `wait`
     * runs `shortSkip` with the label `Waiting`, which `activityForVerb` does
     * not recognise and therefore defaults to `labour` - a real, non-zero
     * exposure row. The world can reach somebody who is doing nothing at all,
     * which is exactly the asymmetry `AGENTS.md` records under arrivals: the
     * player can be found.
     */
    wait: ['a_span_of_days'],
    work: ['a_span_of_days'],
    market: [],
    sect: [],
    /**
     * Approaching one and reading it from outside pass no time. Going in spends
     * days and then stands a body in front of a thing set at an ordinal, and
     * `site-verbs.ts#forceAtOrdinal` resolves that through `resolveExchange`
     * twice - once at the gate, once on the ground behind it.
     *
     * Taken whole rather than by intent, which is the ruling this file already
     * made for `site` on {@link TIME_CONSUMING_ACTIONS}. It is a different
     * ruling from `interact`'s and both are right: `site` is only ever reached
     * by a sentence about a site, so the coarse label costs nothing, while
     * `interact` is this parser's broadest catch for anything involving a
     * person and coarse-labelling it would call three inert sentences lethal.
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
     *
     * Six houses hold a sealed ancestor with a written `wakeCondition` and
     * `wakeCost`, and the strongest of them stands at forty-four. Waking one
     * ought to be the single most dangerous sentence a player can type, and
     * **it is empty here because nothing in `src/` resolves force against the
     * person who woke it.** `institution-verbs.ts` charges the `wakeCost` and
     * nothing calls `resolveExchange`, `assessPower` or
     * `evaluateDeathConditions` on that path.
     *
     * This entry is `[]` because that is what the code does, not because it is
     * what the world should do. `AGENTS.md`: "The engine has no answer for this
     * yet" is a legitimate and useful sentence, and a table that quietly
     * flagged this as dangerous would be asserting a mechanic that does not
     * exist - which is how a no-op reviews as a feature.
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
 *
 * The complement of `PRESSING_SOMEBODY`, which lives in
 * `asking-is-not-doing.ts` and cannot be imported here - that module already
 * imports {@link READ_ONLY_ACTIONS} from this one, and reversing the arrow
 * would put a cycle between the classification and the rule that reads it.
 *
 * A second copy of a set is a drift risk and `AGENTS.md` is explicit that the
 * answer is not a comment asking people to be careful. So this is guarded the
 * way `PRESSING_SOMEBODY`'s other copy - `ATTEMPT_INTENTS` in `game.ts` - is
 * guarded: by a test that goes red when either side moves.
 * `tests/web/coercion-is-not-rapport.test.ts` and
 * `tests/web/asking-is-not-doing.test.ts` between them play all ten intents and
 * measure what each spent, and the exact-complement assertion sits beside this
 * table's own tests.
 *
 * Stated as the FREE three rather than the pressing eight on purpose: it is the
 * shorter list, it is the one that has never changed, and a ninth way of
 * leaning on somebody added tomorrow is dangerous by default here rather than
 * safe by omission.
 */
export const INTERACT_SETTLES_NOTHING: ReadonlySet<string> = new Set([
    'talk', 'trade', 'apologise'
]);

/**
 * How this act can end badly, given the verb and - where the verb alone cannot
 * say - the intent.
 *
 * ── ACTION, OR ACTION PLUS CONTEXT? ──────────────────────────────────────
 *
 * This takes the ACT and not the situation, and the argument is worth having
 * out because the obvious objection is a good one: travelling to a market town
 * and walking into a ruin below its floor are not the same risk, so surely
 * harm is a property of the act plus where it points.
 *
 * Three things decided it the other way.
 *
 * **The two examples are two different verbs.** Walking into a ruin is `site`
 * at intent `enter`, which is on this table with `force`. `move` cannot reach a
 * ruin's gate at all - the destination resolver refuses a name that is not a
 * place, and the thing behind the gate is only ever met through `site`. The
 * case that looks like it needs context turns out to be the verb list already
 * doing the work.
 *
 * **What context changes here is the RATE, never the possibility.** Every span
 * rolls an encounter window; `EncounterPlace.danger`, the sitting-to-standing
 * ratio and `Locatability` multiply how often something happens and never
 * whether it can. A boolean about possibility is exactly the shape that is
 * invariant to all of it - and the moment this returns a likelihood instead, it
 * is the severity scale nobody has ruled on.
 *
 * **A predicate that reads the world cannot be checked.** The value of this
 * table is that every entry cites a code path a reader can follow. A function
 * taking a place, a rung and a destination would be a second opinion about
 * danger sitting outside the resolvers that own it, and this repo has spent a
 * day removing second opinions.
 *
 * So: the act says WHETHER, and the world - which already models it, in
 * `encounters/` and in `assessPower` - says how often and how badly. Where a
 * consumer needs how-badly it should ask those, not widen this.
 *
 * ── AND WHY IT TAKES AN INTENT ANYWAY ────────────────────────────────────
 *
 * `interact` and nothing else. Not because intent is context - it is part of
 * the act, and it is the same seam {@link costsTheAskerNothing} already needs a
 * function for. Every other verb whose intents disagree takes the coarse label,
 * on the reasoning written beside `site`.
 */
export function canEndBadly(action: ActionName, intent?: string): readonly HowAnActCanEndBadly[] {
    if (action === 'interact' && INTERACT_SETTLES_NOTHING.has(intent ?? 'talk')) return [];
    return HOW_EACH_VERB_CAN_END_BADLY[action];
}

/**
 * Whether this act can hurt the person who takes it. The boolean over
 * {@link canEndBadly}, which is what a caller ranking sentences wants.
 *
 * The sibling of {@link costsTheAskerNothing} and deliberately shaped like it,
 * so the two read as the pair of axes they are:
 *
 *                      costs nothing            costs something
 *   cannot hurt you    reading a board          buying a manual
 *   can hurt you       (nothing reaches here)   walking into a ruin
 *
 * The empty cell is a real finding rather than an oversight, and it is worth
 * recording because it looks like it should be occupied. Every verb that can
 * reach the body reaches it through a span, a resolver, a tribulation, the
 * deviation engine or the toxicity ledger, and each of those is behind a verb
 * that spends. `wait` looks like the counterexample - sitting still and being
 * found - and is not, because waiting spends its days like anything else.
 *
 * The one thing that genuinely lands in that cell is not a `PlannedAction` at
 * all: inside a live fight, `I block` and `I keep swinging` are answered by
 * `fight-answers.ts` before the pattern table is reached, spend no day, and can
 * end the run in the round they are typed. A consumer that ranks sentences
 * rather than plans has to handle those separately, and it should - they are
 * the most dangerous five strings in the game.
 */
export function canHurtYou(action: ActionName, intent?: string): boolean {
    return canEndBadly(action, intent).length > 0;
}
