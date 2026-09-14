/**
 * The `challenge` verb: saying to somebody's face that what they told you about
 * themselves does not stand.
 *
 * `an-account-of-yourself.ts` could write a lie into a hearer's head and nobody
 * could ever say so. The row carried `fabricated`, the gate would hand it back,
 * and the only reader was an operator. The design owner's ruling was that a
 * challenge is BIDIRECTIONAL - the world's own people gainsay an account put to
 * them, and the player gainsays one that was put to them. This is the player's
 * half; the world's half is at the telling, in `GameService.tellSomebody`.
 * Both run the same read in `two-accounts-of-one-person.ts` from opposite ends.
 *
 * ── IT COSTS NO TIME AND IT IS NOT FREE ──────────────────────────────────
 *
 * It is words said to somebody standing in front of you, so it passes no days,
 * the same as `tell`. What it can cost is the person: calling somebody a liar
 * in front of whoever is here is a thing that happened to them, and it goes on
 * the ledger as one when nothing backs it up.
 *
 * ── WHAT COUNTS AS HAVING SOMETHING TO PUT AGAINST IT ────────────────────
 *
 * Two things, and no third:
 *
 *   another account   Somebody, themselves included, gave the player a
 *                     different account of the same person. Two claims, and
 *                     neither is privileged.
 *   what is on them   A cultivator wears their house's marks, and `entities.ts`
 *                     already says so to anybody who can name that house. That
 *                     gate is the whole of what makes this fallible: somebody
 *                     whose house means nothing to this player is wearing marks
 *                     they cannot read, and the challenge goes in blind.
 *
 * A RUNG CANNOT BE CHECKED BY LOOKING, and that is an absence rather than an
 * oversight. What a look reaches is a GAP between two people and never an
 * ordinal - `describeStanding` is the whole of it - so a claimed realm is
 * catchable only where somebody else's account contradicts it. See
 * {@link A_RUNG_SHOWS_AS_A_GAP}.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { createObligation } from '../engine/social/grudges.js';
import {
    severityOfTheWrong,
    shapeOf
} from '../engine/social-leverage/what-somebody-does-about-being-wronged.js';
import { writeOneObligation, type ObligationWriteDb } from '../storage/repos/obligation.repo.js';
import { whereTheAccountIsNotSo } from './an-account-of-yourself.js';
import { factsForRefusal, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import {
    factsForAChallenge,
    theAccountsAmong,
    whatIsHeldAgainstThisAccount,
    whatTheyCaught,
    type AnAccountContradicted,
    type AnAccountHeld
} from './two-accounts-of-one-person.js';

/**
 * Why a claimed realm is not catchable on sight.
 *
 * `resolveCultivator` reports a person as "reads as somebody a little above
 * you" and never as an ordinal, on purpose: a cultivator perceives a gap. So
 * there is no reading anywhere in this engine that would let a player say "you
 * are not at Core Formation" off what is in front of them, and the only route
 * to a false rung is a second account of the same person.
 */
export const A_RUNG_SHOWS_AS_A_GAP =
    'Nothing in this engine lets a look settle what rung somebody stands at. A claimed realm '
    + 'is caught by somebody else\'s account of them and by nothing else.';

export const challengeVerb = {
    /**
     * Put it to somebody that their account of themselves does not stand.
     *
     * `target` is who is being challenged. They have to be standing here: this
     * is said to a face, and a challenge nobody is present to hear is not one.
     */
    challenge(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Execution {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();
        const today = Math.floor(run.elapsedDays);

        // NOBODY NAMED IS NOT NOBODY THERE. "that is not your house" names its
        // addressee by standing in front of them, so the square answers where
        // the words do not - and only where the square gives ONE answer, since
        // picking one of several would be the engine deciding who the player
        // was looking at.
        const here = this.present(cultivator);
        const them = query.length < 2
            ? (here.length === 1 ? here[0] : null)
            : (party => party && party.kind === 'cultivator'
                ? here.find(row => row.id === party.id) ?? null
                : null)(this.partyPutTo(
                    cultivator, query, scope, this.somebodyAtHand(query, cultivator)
                ));

        if (them === null && query.length < 2) {
            return refused('engine.resolveParty', 'challenge', factsForRefusal(
                here.length === 0 ? 'Nobody here to say it to.' : 'Say it to which of them.',
                this.whoIsAbout(cultivator),
                'challenge: no subject named and the square does not settle it. '
                + `${here.length} person(s) standing here. A challenge is put to somebody's own `
                + 'account of themselves, and which of them is being called on is not the '
                + "engine's to pick."
            ));
        }
        if (them === null) {
            return this.nobodyByThatName(cultivator, query, scope, 'challenge');
        }

        const held = theAccountsAmong(
            this.knowledge.provenanceOf(cultivator.id, 'cultivator', them.id),
            cultivator.id
        );

        // NOTHING TO CHALLENGE IS NOT THE SAME AS NOTHING TO SEE. Knowing
        // somebody exists is not holding an account of them, and the refusal
        // says which of the two this is rather than reporting an empty world.
        if (held.length === 0) {
            return refused('knowledge.provenanceOf', 'challenge', factsForRefusal(
                `${them.name} has never given you an account of themselves.`,
                'You have their name and nothing they have said about who they are. There is '
                + 'nothing to put to them.',
                `challenge: no account row held by ${cultivator.id} about ${them.id}. An `
                + 'existence row is not an account - an account names a house, a rung or a name '
                + 'given, and only those can disagree with anything.'
            ));
        }

        // The newest is the one being challenged: it is what they last said,
        // and it is what a person would actually be answering for.
        const challenged = held[held.length - 1];

        const against = [
            ...whatIsHeldAgainstThisAccount(
                held.filter(row => row !== challenged), challenged.account
            ),
            ...this.whatTheirMarksSayAbout(cultivator, them, challenged)
        ];

        // THE OMNISCIENT HALF, AND IT IS JOINED TO NOTHING ON ITS OWN. The same
        // comparison that decided the row's `sourceKind` when the account was
        // given, against the same columns. `whatTheyCaught` will only let it
        // through on a part the player has actually landed on, so a player who
        // has nothing learns nothing from it.
        const notSo = whereTheAccountIsNotSo(challenged.account, {
            name: them.name,
            house: them.sectName,
            realmOrdinal: them.realmOrdinal
        });
        const caught = whatTheyCaught(against, notSo);

        const facts = factsForAChallenge({
            subject: them.name,
            challenged,
            against,
            caught
        });

        const calls: ToolCallRecord[] = [];
        const landed = caught.length > 0;

        // ── AND SOMEBODY ENDS UP HOLDING SOMETHING ───────────────────────
        //
        // Which side of the ledger it goes on is decided by whether the
        // challenge landed, and both sides are ordinary rows through the
        // ordinary door. `what-somebody-does-about-being-wronged.ts` owns both
        // the cause and the weight; no figure is re-argued here and there is no
        // reputation number anywhere in this verb.
        const wrong = landed ? 'deceived' as const : 'insulted' as const;
        const holderId = landed ? cultivator.id : them.id;
        const subjectId = landed ? them.id : cultivator.id;
        const record = createObligation({
            kind: 'grudge',
            holderId,
            subjectId,
            cause: shapeOf(wrong).cause,
            severity: severityOfTheWrong(wrong),
            onDay: today,
            description: landed
                ? `${them.name} gave ${cultivator.name} an account of themselves that was not `
                  + `so, and was called on it in front of whoever was standing at `
                  + `${placeName(cultivator)}. Not so: ${caught.join(', ')}.`
                : `${cultivator.name} called ${them.name} a liar about their own account of `
                  + `themselves at ${placeName(cultivator)}, in front of whoever was `
                  + 'standing there, and had nothing that settled it.',
            participants: here.map(row => row.id),
            tags: ['public', 'account_challenged'],
            // Not a suspicion either way. When it landed, the world's own row
            // says the account was not so; when it did not, the insult happened
            // whatever the truth of the thing it was about.
            fromBelief: false
        });
        writeOneObligation(this.db as unknown as ObligationWriteDb, record);
        calls.push({
            name: 'social.createObligation',
            action: 'challenge',
            summary:
                `${holderId} now holds a ${record.severity} grudge (${record.cause}) about `
                + `${subjectId}, opened on day ${today}. `
                + (landed
                    ? `The challenge landed on ${caught.join(', ')}.`
                    : 'The challenge landed on nothing the world holds as untrue, so what is on '
                      + 'the ledger is what was said to somebody in public.'),
            ok: true
        });

        const execution = this.freeAction(run, 'challenge', facts);
        // EXECUTED either way, and that is the ruling rather than an oversight -
        // the same one `tell` keeps. The words were said and the person heard
        // them; whether anything came of it is a fact about the world.
        execution.outcome = 'executed';
        execution.calls = calls;
        return execution;
    },

    /**
     * What the marks on somebody contradict, where the player can read them.
     *
     * A READ AT A SCENE. One person, one gate question, at the moment somebody
     * is standing in front of the player - not a pass over anybody's rows and
     * nothing on the world advance.
     *
     * The gate is the whole of it: `entities.ts` already hands a house's name to
     * a reader who can name that house and a shape to one who cannot, and this
     * asks the same question rather than a second one. So a player who cannot
     * place the house whose marks are in front of them has nothing here, which
     * is what a challenge being fallible actually looks like.
     */
    whatTheirMarksSayAbout(
        this: GameService,
        cultivator: Cultivator,
        them: { id: string; name: string; sectId: string | null; sectName: string | null },
        challenged: AnAccountHeld
    ): AnAccountContradicted[] {
        if (challenged.account.house === null) return [];
        if (them.sectId === null || them.sectName === null) return [];
        if (!this.knowledge.isAwareOf(cultivator.id, 'sect', them.sectId)) return [];

        const seen: AnAccountHeld = {
            holderId: cultivator.id,
            holderName: null,
            // The rung is deliberately absent: see `A_RUNG_SHOWS_AS_A_GAP`.
            account: { name: them.name, house: them.sectName, rung: null },
            statement: `${them.name} is wearing the marks of the ${them.sectName}.`,
            onDay: challenged.onDay,
            note: 'What is on them, seen standing here.'
        };
        return whatIsHeldAgainstThisAccount([seen], challenged.account);
    }
};
