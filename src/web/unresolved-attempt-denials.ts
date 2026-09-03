/**
 * What did not happen, said in the act's own terms.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A DENIAL AND NOT A STATUS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * An interaction the engine cannot resolve used to end with *"Nothing is
 * settled by it. Nobody agreed to anything, nothing changed hands, and no
 * standing shifted one way or the other."* Every word of that is true and it
 * does not work, and the reason is worth stating exactly, because the first two
 * attempts at this both got it wrong in the same direction.
 *
 * **It is a sentence about SETTLEMENT.** A model handed *"nothing changed
 * hands"* alongside the player's own *"I take a manual from the sect library"*
 * has no contradiction to resolve: it can narrate the hand closing and the
 * outcome pending, and that is precisely what it did -
 *
 *   > I take a manual from the sect library without asking
 *   "You move through the library, your hand closing around a manual. You take
 *    it without asking."
 *
 * Nothing was stolen. No object moved, nobody noticed, no ledger row.
 *
 * The comparison that settles it is two played turns of the same build. Given a
 * denial of the ACT, the model wrote *"The words have been spoken, but the air
 * remains still... The declaration hangs between you and the world,
 * unanswered."* Given a report of the CONDITION, it wrote the hand closing and
 * then hedged. The difference is not the model.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MECHANISM: GIVE THE SENTENCE A FACT IT COLLIDES WITH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The player's own words are in the phase-3 prompt and have to be - asking in
 * this game turns on what was said - so the player's sentence is doing the
 * narrating. That cannot be taken away, and an output check that deleted the
 * result of it would be policing prose: it can tell that a sentence was
 * written, never that the sentence was wrong.
 *
 * So the instrument is the input. **A model cannot write "you pull it from its
 * place" against "it is still in its place" without writing a flat
 * contradiction, which is a far harder thing for a model to do than writing a
 * hedge.** It is not being asked to omit anything; it is being handed a fact
 * its sentence runs into.
 *
 * That is why every line below names something physical and checkable - a purse
 * unopened, a shelf undisturbed, a word unsaid - rather than reporting that an
 * outcome is open.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALL ELEVEN, AND THAT IS THE POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Measured: every member of `INTERACT_INTENTS` against a faction target reaches
 * the unresolved branch. Eight of them are `PRESSING_SOMEBODY` acts, which are
 * where this pays, because the player's sentence already says they did it.
 *
 * `steal` is being given a real resolver as this is written and will stop
 * arriving here. **The other ten have no such wiring coming**, and an
 * unresolved intent is the permanent condition for most of them, so this is
 * built as the general answer rather than as a patch over one verb.
 *
 * A `Record` over the intent union rather than a lookup with a fallback: an
 * intent added to `INTERACT_INTENTS` does not compile until somebody has
 * written down what it means for it not to have happened. The same discipline
 * as `WHAT_EACH_VERB_IS_FOR`, and for the same reason - a default here would be
 * a plausible sentence that denies nothing, which is the exact failure this
 * module exists to end.
 *
 * Single reason to change: what it means for an attempt not to have happened.
 */

import { INTERACT_INTENTS } from './planned-action.js';

export type InteractIntent = typeof INTERACT_INTENTS[number];

/**
 * The denial for each intent, as the sentence a player reads.
 *
 * Written in the third person with the actor's name, because `facts.lines`
 * speaks that way and the narrator turns it around. Each one names the
 * observable that would have changed and says it did not.
 */
const WHAT_DID_NOT_HAPPEN: Readonly<Record<InteractIntent, (who: string) => string>> = {
    talk: who =>
        `No words were exchanged. Nobody greeted ${who} and nobody answered them; whatever was `
        + 'going to be said is still unsaid.',

    negotiate: who =>
        `No terms were put and none were heard. ${who} offered nothing, nobody countered, and `
        + 'there is no bargain between them of any kind.',

    trade: who =>
        `Nothing changed hands. Every item is where it was, in the hands that already held it, `
        + `and ${who} is carrying exactly what they arrived carrying.`,

    deceive: who =>
        `No lie was told and nobody believed anything. ${who} has not been taken for anything `
        + 'they are not, because nothing was put to anybody to be taken either way.',

    interrogate: who =>
        `No question was put and nothing was answered. Nobody told ${who} a single thing they `
        + 'did not already know, and nobody was held anywhere or pressed for anything.',

    threaten: who =>
        `No threat landed. Nobody was frightened of ${who}, nobody gave way, and everybody is `
        + 'standing exactly where and how they were standing before.',

    bribe: who =>
        `No purse was opened. Not one stone left ${who}, nobody was paid anything, and nobody `
        + 'has agreed to overlook a thing.',

    recruit: who =>
        `Nobody was asked to come along and nobody said yes. No one has taken up with ${who}, `
        + 'changed sides, or left where they were standing.',

    apologise: who =>
        `No apology was made and none was accepted. Whatever stands between ${who} and them `
        + 'stands exactly as high as it did, unaltered.',

    seduce: who =>
        `Nothing passed between anybody. Nobody was charmed, nobody came closer to ${who}, and `
        + 'nothing whatever was begun.',

    // The one the defect was found on, and the most concrete on purpose. The
    // played prose was "your hand closing around a manual" and "you pull it
    // from its place on the shelf", so the denial names the shelf and the hand.
    steal: who =>
        `Nothing was taken. Nothing left a shelf, a purse or a hand, every object is still `
        + `exactly where it was and still belongs to whoever it belonged to, and ${who} is `
        + 'carrying nothing they did not walk in with.'
};

/**
 * The denial for an intent, or the general one when the label is not a member.
 *
 * The fallback is for a label that reached here from outside the closed set -
 * the parser's `intent` is free text at the schema boundary - and it is written
 * to the same standard as the eleven rather than as a shrug, because a sentence
 * that denies nothing is how this defect started.
 */
export function whatDidNotHappen(intent: string, who: string): string {
    const known = (WHAT_DID_NOT_HAPPEN as Record<string, ((who: string) => string) | undefined>)[intent];
    if (known) return known(who);
    return `Nothing came of it. Nothing moved, nothing was said that mattered, and ${who} is `
        + 'standing where they were with everything they arrived with.';
}
