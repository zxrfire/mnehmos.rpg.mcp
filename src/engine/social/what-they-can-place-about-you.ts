/**
 * What the person in front of you can place about what you ARE, which is not
 * the same question as what you are.
 *
 * The design owner: *"the demonic/righteous work ONLY IF THEY KNOW UR
 * DEMONIC/RIGHTEOUS, that should also fall out. like if ur a hidden expert from
 * a demonic/righteous sect in a nondescript robe and nobody knows. that should
 * be the source of truth of how you are reached too."*
 *
 * ── WHAT WAS MISSING, AND WHERE IT ALREADY EXISTED ────────────────────────
 *
 * `regard.ts` has held the world's answer since the bands were written:
 * `concealmentHolds` says whether somebody deliberately not showing what they
 * are gets away with it, and `apparentOrdinal` is the rung the room believes it
 * is dealing with. `resolveAttempt` passes an approach straight into
 * `regardFor`, so the ROLL has always been taken against the apparent rung.
 *
 * What read the real one was everything that decides what is on the table
 * before the roll. `background-as-leverage.ts` weighed the rung you have and
 * the house you are in, whoever could see either. So the same sentence from the
 * same person landed as a False Immortal leaning on a junior even where the
 * junior had been given every reason to take them for a pedlar - and the
 * mechanical channel said *"and they can see it"* about a thing nobody had
 * asked whether they could see.
 *
 * ── ONE PREDICATE, NOT A GATE PER FACT ────────────────────────────────────
 *
 * There is no separate answer for the rung and the house. The schema's own
 * words for `concealed` are *"deliberately not showing what they are"*, and a
 * rung is one thing you are while a house is another. Somebody who has put the
 * sect robe away and is carrying themselves like a labourer has not half done
 * it. So one concealment covers everything about you, and where it holds, none
 * of what you are is weighed against them.
 *
 * ── IT RUNS BOTH WAYS ─────────────────────────────────────────────────────
 *
 * `AGENTS.md`: every read runs both ways unless there is a reason it cannot.
 * The mirror of *what can they place about me* is *what can I place about
 * them*, and it is this function with the two sides swapped - the reader is
 * whoever is looking, the read is whoever is being looked at, and neither
 * position is the player's by construction.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * Not blindness, and not the `unreachable` band. Nine rungs apart decides
 * whether a thing is PUT IN FRONT OF somebody - `REGARD_BANDS` says so in its
 * own reaction text - and `presence-recognition.ts` stretches it as far as
 * whether a stranger registers in a crowd. Neither is a claim that a junior
 * standing in a conversation cannot tell they are outmatched. In this world a
 * cultivator's weight is on them unless they put it away, so the default here
 * is that everything shows, and the only thing that hides it is the act of
 * hiding it.
 *
 * Pure. Two rungs and a declaration in, one reading out.
 */

import { apparentOrdinal, concealmentHolds } from '../cultivation/regard.js';
import { realmIndexOf } from '../cultivation/realms.js';

export interface WhatIsOnShow {
    /** The rung the one being read is actually at. */
    readonly theirOrdinal: number;
    /** The rung of the one doing the reading. They are the witness. */
    readonly readerOrdinal: number;
    /**
     * True when the one being read is deliberately not showing what they are.
     * The only thing in the world that turns this on is doing it.
     */
    readonly keepingItToThemselves: boolean;
    /**
     * Whether the reader has stood in front of them before.
     *
     * A known face wins outright, which is `presence-recognition.ts`'s ruling
     * and is the same ruling here: a plain robe is not a new person to somebody
     * who has already dealt with you.
     */
    readonly hasDealtWithThemBefore?: boolean;
}

export interface WhatTheyCanPlace {
    /** The rung the reader takes them for. Theirs unless a concealment held. */
    readonly rungTheyAreTakenFor: number;
    /**
     * Major realms of the one being read over the reader, as the READER has it.
     * Negative is looking up. `realmIndexOf`'s own number, so it is the same
     * unit every caller upstream already passes.
     */
    readonly realmsTheyAreTakenToBeOver: number;
    /** Whether what they are can be weighed against the reader at all. */
    readonly theyCanBePlaced: boolean;
    /** One sentence for the mechanical channel. Null where they can. */
    readonly whyNot: string | null;
}

/**
 * What one person can place about another, from the rungs and the declaration.
 *
 * The presented rung is not a number anybody has to supply. Somebody putting
 * their weight away passes for the people they are standing among, and the
 * person in front of them IS who they are standing among - so the rung offered
 * to `concealmentHolds` is the reader's own, and the reader is the witness that
 * `concealmentHolds` already tests against. A concealment aimed at somebody at
 * or above your real rung fails there, unchanged, and it fails for the reason
 * it has always failed for.
 */
export function whatTheyCanPlaceAbout(input: WhatIsOnShow): WhatTheyCanPlace {
    const shown = (): WhatTheyCanPlace => ({
        rungTheyAreTakenFor: input.theirOrdinal,
        realmsTheyAreTakenToBeOver:
            realmIndexOf(input.theirOrdinal) - realmIndexOf(input.readerOrdinal),
        theyCanBePlaced: true,
        whyNot: null
    });

    if (!input.keepingItToThemselves) return shown();
    if (input.hasDealtWithThemBefore === true) return shown();

    // Passing for one of them, which is what putting your weight away is for.
    // Below their rung and never at it: `concealmentHolds` requires a presented
    // rung strictly under the real one, and somebody claiming exactly the rung
    // of the person reading them has claimed something rather than nothing.
    const passingFor = Math.min(input.readerOrdinal, input.theirOrdinal - 1);
    const approach = {
        concealed: true,
        presentedAs: passingFor,
        witnessOrdinal: input.readerOrdinal
    };
    if (!concealmentHolds(input.theirOrdinal, approach)) return shown();

    const taken = apparentOrdinal(input.theirOrdinal, approach);
    return {
        rungTheyAreTakenFor: taken,
        realmsTheyAreTakenToBeOver:
            realmIndexOf(taken) - realmIndexOf(input.readerOrdinal),
        theyCanBePlaced: false,
        whyNot:
            'They are carrying nothing that says what they are, and nobody here is placed '
            + 'high enough to look through it. What is being weighed is the person in the '
            + 'robe and not the one wearing it.'
    };
}
