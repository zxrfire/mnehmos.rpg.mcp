/**
 * Handing somebody a thing you already hold.
 *
 * The owner's own sentence for the feature this belongs to is *"a person could
 * steal and then hand it to someone else before running away"*. Three acts, and
 * the middle one had no verb: six ordinary phrasings of it reached `unclear`.
 *
 * ── WHAT MOVES, AND WHICH TIER IT MOVES ON ───────────────────────────────
 *
 * `docs/world/things/items.md` keeps three tiers of thing and they move by
 * three different mechanisms. What a player is carrying is the middle one -
 * COUNTED STOCK - so a gift of stones or of a pill is two rows changing by a
 * number, exactly as `GameService.whatALiftTook` moves them the other way and
 * for the same reason it states there: *"Counted stock, moved as a number on
 * two rows; `transferPossession` is for singular things and is not used here."*
 *
 * `transferPossession` and its `how: 'gifted'` are the right shape for the
 * TRACKED tier - one object, one provenance chain, an honest new link saying
 * whose it now is - and this does not reach that tier, because a player's pouch
 * does not hold one. When a tracked object can be in a player's hands, the gift
 * of it belongs in this module and `gifted` is already waiting for it.
 *
 * ── AND IT IS FREE, WHICH IS NOT A SHORTCUT ──────────────────────────────
 *
 * Nothing is attempted against the recipient. They are not being asked for
 * anything, there is no leverage on the table and no roll to lose, so there is
 * no day to spend: `PRESSING_SOMEBODY` is the set of things that spend a day
 * WHETHER OR NOT THEY COME OFF, and this is not one of them. What it costs is
 * the thing, which does not come back.
 *
 * ── THE PART THAT MAKES THE SENTENCE WORTH TYPING ────────────────────────
 *
 * A gift is not a neutral event. It is the one act in this game that puts
 * somebody in your debt WITHOUT LEVERAGE - every other route to that runs
 * through `resolveAttempt`, which prices what you leaned on - and the
 * vocabulary for it was already in the engine: `gifted_resource` is a member of
 * `FavorCause` in `grudges.ts`, and `createObligation` writes the row. So the
 * recipient ends up holding a favour about the giver, permanent until settled
 * and inheritable, off a turn that cost no day.
 *
 * What this module does NOT do, and the reason is worth having: it does not
 * make a stolen purse traceable through the gift. The theft path says so in its
 * own words - *"It is in your own purse now, with nothing in the ledger to say
 * it was ever theirs"* - because counted stock has no provenance by
 * construction. Handing on stolen stones is untraceable because stones are
 * untraceable, not because anybody decided a fence should be safe. That changes
 * the day a tracked object is in a player's hands, and it changes there rather
 * than here.
 */

import type { Cultivator } from '../schema/cultivation.js';
// ONE SOURCE FOR WHAT A POUCH HOLDS. This file spelt the union out a second
// time as PouchItemKind, and a book was unified into the pouch
// elsewhere - so a manual became storable and stayed ungivable, which is the
// shape AGENTS.md warns about: two places that must agree, and only one of
// them told.
import type { PouchItemKind } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import type { EngineFacts } from './facts.js';
import type { ObligationInput } from '../engine/social/grudges.js';
import { NAMES_STONES } from './inventory-phrasings.js';

/** What the giver is carrying, as the pouch keeps it. */
export interface GoodStackHeld {
    itemId: string;
    kind: PouchItemKind;
    quantity: number;
    name: string;
}

/** Mirrors `ToolCallRecord` in `game.ts`, structurally, to avoid a cycle. */
export interface GiveCall {
    name: string;
    action: string;
    summary: string;
    ok: boolean;
}

export interface GiveDeps {
    giver: Cultivator;
    /** Who it is being handed to. Null when nobody of that name is here. */
    recipient: { id: string; name: string } | null;
    /** What the player typed for the recipient, for the refusal that names one. */
    namedRecipient: string | undefined;
    /** Everybody standing here, for the refusal that names a route. */
    othersHere: readonly string[];
    /** Pills and herbs on the giver, with their catalog names. */
    pouch: readonly GoodStackHeld[];
    /**
     * Names of the arts this cultivator holds a COPY of.
     *
     * Read only to refuse honestly. See {@link handOver}: the lot this verb
     * hands its caller is a pill, a herb or a rated object, and a book is none
     * of the three - not because there is nowhere to put one, which there now
     * is, but because the moving half has not been widened.
     */
    heldArts: readonly string[];
    /** Absolute world day, for the favour's own clock. */
    onDay: number;
}

export interface GiveOutcome {
    facts: EngineFacts;
    calls: GiveCall[];
    refused: boolean;
    /** Stones to move off the giver and onto the recipient. Zero for a thing. */
    stones: number;
    /** The pouch lot to move, when a thing rather than stones was handed over. */
    lot: { itemId: string; kind: PouchItemKind; quantity: number; name: string } | null;
    /** The favour the recipient now holds, for the caller to write. */
    favour: ObligationInput | null;
}

function decline(headline: string, scene: string, mechanical: string): GiveOutcome {
    return {
        facts: { headline, lines: [scene], structure: [mechanical], prose: scene },
        calls: [{ name: 'engine.handOver', action: 'give', summary: mechanical, ok: false }],
        refused: true,
        stones: 0,
        lot: null,
        favour: null
    };
}

// The money words live in `inventory-phrasings.ts` now, because the self-read
// needs the same list and two enumerations of how people name money is the
// duplication this repository repeats most. Unchanged, and still applied here
// to the noun phrase the player named rather than to the whole sentence.

/**
 * The lot in the pouch these words name, or nothing.
 *
 * Held-first by construction: the only rows it looks at are the ones the giver
 * is carrying, which is the resolution order `entities.ts` now keeps for a
 * manual and is at its most obvious here. Every sentence that uses this verb
 * names something the player already has.
 *
 * A tie refuses rather than guessing, on the rule this package keeps
 * everywhere: an ambiguity's honest answer is the question back, not a coin
 * toss between two things that do not come back.
 */
/** Whether a player's words name a thing, by a word of its own name. */
function theSameThing(said: string, name: string): boolean {
    const lowered = name.toLowerCase();
    if (lowered === said.trim().toLowerCase()) return true;
    const words = said.toLowerCase().match(/[a-z']+/g) ?? [];
    return words.some(word => word.length >= 4 && lowered.includes(word));
}

export function theLotTheyMeant(
    said: string,
    pouch: readonly GoodStackHeld[]
): GoodStackHeld | 'ambiguous' | null {
    const words = said.toLowerCase().match(/[a-z']+/g) ?? [];
    if (words.length === 0) return null;

    const exact = pouch.filter(row => row.name.toLowerCase() === said.trim().toLowerCase());
    if (exact.length === 1) return exact[0]!;

    const hits = pouch.filter(row => {
        const name = row.name.toLowerCase();
        return words.some(word => word.length >= 4 && name.includes(word));
    });
    if (hits.length === 1) return hits[0]!;
    return hits.length > 1 ? 'ambiguous' : null;
}

/**
 * What a gift does, decided here and applied by the caller.
 *
 * Returns deltas rather than writing them, so this module opens no database
 * handle and can be tested against a plain object - the same seam
 * `leaving-things-for-the-next-life.ts` keeps for the same reason.
 */
export function handOver(deps: GiveDeps, thing: string, stonesAsked: number | undefined): GiveOutcome {
    const said = (thing ?? '').trim();

    if (deps.recipient === null) {
        const here = deps.othersHere.length > 0
            ? `Standing here: ${deps.othersHere.join(', ')}.`
            : 'There is nobody standing here to hand it to.';
        return decline(
            deps.namedRecipient
                ? `Nobody here is called ${deps.namedRecipient}.`
                : 'There is nobody here to give it to.',
            `You hold it out and there is nobody to take it. ${here}`,
            `No party resolved for "${deps.namedRecipient ?? '(nobody named)'}". Nothing moved, `
            + 'nothing written, no time passed.'
        );
    }

    // ── STONES ───────────────────────────────────────────────────────────
    if (NAMES_STONES.test(said)) {
        const asked = stonesAsked ?? deps.giver.spiritStones;
        if (asked <= 0 || deps.giver.spiritStones <= 0) {
            return decline(
                'You are carrying nothing to give.',
                'You reach for the purse and there is nothing in it worth the gesture.',
                `Purse is ${deps.giver.spiritStones}; asked ${asked}. Nothing moved, no time passed.`
            );
        }
        if (asked > deps.giver.spiritStones) {
            return decline(
                `You have ${deps.giver.spiritStones} spirit stones, not ${asked}.`,
                `You do not have ${asked} spirit stones to give. What is in the purse is `
                + `${deps.giver.spiritStones}.`,
                `Asked ${asked} against a purse of ${deps.giver.spiritStones}. Nothing moved, `
                + 'no time passed.'
            );
        }
        return given(deps, `${asked} spirit stones`, asked, null);
    }

    // ── A THING IN THE POUCH ─────────────────────────────────────────────
    //
    // AND IT SAYS WHAT COULD GO IN THE HAND. This refused with the gap and
    // nothing else - *"the something is the part that was not said"* - which is
    // a refusal naming no route, the one shape this engine is not allowed to
    // produce. The player is holding the answer, and the same list `inventory`
    // prints one sentence away was already in `deps`.
    //
    // Measured in the refusal probe: "I hand her everything I have" and "I let
    // him keep it" both land here, because the reader carries no object out of
    // either sentence. Naming the pouch does not make those sentences work -
    // that is the reader's half - but it turns a dead end into a turn the
    // player can answer.
    if (said.length === 0) {
        const couldHandOver = [
            ...deps.pouch.map(row => row.name),
            ...(deps.giver.spiritStones > 0
                ? [`your spirit stones (${deps.giver.spiritStones})`]
                : [])
        ];
        return decline(
            'You did not say what.',
            `You mean to hand ${deps.recipient.name} something, and the something is the part `
            + 'that was not said. '
            + (couldHandOver.length > 0
                ? `What you could put in their hand: ${couldHandOver.join(', ')}.`
                : 'You are carrying nothing and your purse is empty, so there is nothing it '
                  + 'could have been.'),
            `No object named; ${deps.pouch.length} pouch row(s) and `
            + `${deps.giver.spiritStones} stone(s) held. Nothing moved, no time passed.`
        );
    }

    // ── A COPY OF AN ART IS THE THIRD TIER, AND THIS VERB DOES NOT REACH IT ─
    //
    // Refused by name rather than by falling through to "you are not carrying
    // that", which would be a lie: they ARE carrying it.
    //
    // THE OLD REASON WAS THE BESPOKE STORE AND IT IS GONE. A copy used to be a
    // per-cultivator flag, so there was nowhere for a book to go - the several
    // hundred people in the world are not cultivator rows. A copy is now a
    // `manual` row in the one pack, keyed on a free-form holder, so the taker
    // has somewhere to put one. What still stops this verb is that `handOver`
    // hands its caller a lot to move and the caller's lot shape is pills,
    // herbs and rated objects; until that widens, refusing is the honest
    // answer and the reason has to be the real one.
    //
    // The route that DOES exist is named, because a refusal owes the player
    // one. `sellACopyOfAnArt` is the whole machine for putting a method into
    // somebody else's hands, and it is months of writing it out with a mastery
    // bar in front of it - which is the honest price of a copy and is why this
    // is not a two-line addition to a free verb.
    const artHeld = deps.heldArts.find(name => theSameThing(said, name));
    if (artHeld) {
        return decline(
            `${artHeld} is not a thing that changes hands like that.`,
            `You hold ${artHeld}, and what you hold is what you understood of it. Putting that `
            + 'into somebody else\'s hands means writing it out, which is months of work and '
            + 'wants the whole of the art rather than the parts you have. Selling a copy is the '
            + 'road, and it starts the same way.',
            `"${said}" resolved to a held copy of ${artHeld}. The copy is a \`manual\` row in the `
            + 'one pack and the taker could hold one; what this verb cannot do is move it, '
            + 'because the lot it hands its caller is a pill, a herb or a rated object. See '
            + '`sellACopyOfAnArt`. Nothing moved, no time passed.'
        );
    }

    const lot = theLotTheyMeant(said, deps.pouch);
    if (lot === 'ambiguous') {
        return decline(
            `More than one thing you are carrying answers to "${said}".`,
            `You are carrying more than one thing that could be what you mean. Say which: `
            + `${deps.pouch.map(row => row.name).join(', ')}.`,
            `Ambiguous lot for "${said}" against ${deps.pouch.length} pouch row(s). Nothing `
            + 'moved, no time passed.'
        );
    }
    if (lot === null) {
        const holding = deps.pouch.length > 0
            ? `What you are carrying: ${deps.pouch.map(row => row.name).join(', ')}.`
            : 'The pouch is empty.';
        return decline(
            `You are not carrying ${said}.`,
            `You go to hand it over and find you have no such thing. ${holding}`,
            `No pouch row matched "${said}". Nothing moved, no time passed.`
        );
    }

    return given(deps, lot.name, 0, {
        itemId: lot.itemId,
        kind: lot.kind,
        quantity: 1,
        name: lot.name
    });
}

function given(
    deps: GiveDeps,
    what: string,
    stones: number,
    lot: GiveOutcome['lot']
): GiveOutcome {
    const to = deps.recipient!;
    const scene =
        `You put ${what} into ${to.name}'s hands and ask for nothing back. `
        + 'They take it, because there is no reason not to, and something has changed between '
        + 'the two of you that neither of you has said out loud.';

    // The one act in the game that opens an account without leverage. The cause
    // is a member of `FavorCause` and was waiting for a caller.
    //
    // ── THE GIVER HOLDS IT, AND GETTING THIS BACKWARDS PUT THEM IN DEBT ──
    //
    // A FAVOUR IS OWED TO ITS HOLDER. That is the one inversion in the ledger
    // and `whichWayItPoints` is where it is written down, in a header whose
    // whole subject is this mistake: *a reader that gets `favor` backwards
    // tells them somebody owes them a thing they in fact owe*.
    //
    // This was written the other way about, and the reader was right while the
    // writer was wrong. Measured, by putting a gift row through
    // `whatStandsBetweenYouAndEverybody` - the read a player gets when they ask
    // what they owe:
    //
    //     Owed by you to Shen Liefeng: gifted resource ... I handed them a
    //     flask, asking nothing for it.
    //
    // The player hands somebody a gift asking nothing for it, and the game puts
    // them in debt to the person they were being generous to.
    //
    // `aFavourForTheWork` in `commissioning-a-craft.ts` is the same row for the
    // same act - a thing made and handed over for nothing - and it holds it the
    // right way about: the maker holds, the asker owes.
    const favour: ObligationInput = {
        kind: 'favor',
        holderId: deps.giver.id,
        subjectId: to.id,
        cause: 'gifted_resource',
        severity: 'slight',
        onDay: deps.onDay,
        description: `${deps.giver.name} handed ${to.name} ${what}, asking nothing for it.`,
        participants: [deps.giver.id, to.id],
        tags: ['gift']
    };

    return {
        facts: {
            headline: `${what} to ${to.name}.`,
            lines: [scene],
            structure: [
                `Gift: ${what} from ${deps.giver.id} to ${to.id}. `
                + (stones > 0
                    ? 'Counted stock, moved as a number on two rows - `transferPossession` is '
                      + 'for singular things and is not used here.'
                    : 'One pouch lot, removed from the giver and added to the taker.')
                + ' No day spent: nothing was attempted against them, so nothing could fail.',
                `Favour opened: ${deps.giver.id} holds a slight favor about ${to.id} for `
                + 'gifted_resource, so it is the taker who owes. Permanent until settled, and '
                + 'inheritable. It is the only account in this engine that opens without '
                + 'leverage having been used.'
            ],
            prose: scene
        },
        calls: [{
            name: 'engine.handOver',
            action: 'give',
            summary: `${what} from ${deps.giver.name} to ${to.name}. No day spent, nothing rolled.`,
            ok: true
        }],
        refused: false,
        stones,
        lot,
        favour
    };
}
