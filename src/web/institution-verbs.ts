/**
 * One party asking something of another, of the dead, or of somebody above
 * the Lid.
 *
 * Four verbs, one shape, and most of them are supposed to be REFUSED. A
 * refusal that names its reason is the win condition here rather than a
 * consolation: the Requisition Against Standing Stock has been granted once in
 * four hundred years and refused ten times, and the catalog says the refusals
 * are filed with the same care as the grant.
 *
 * So the gate is the feature. `standing.ts` owns it, and two things it must
 * keep getting right are worth repeating where the callers are:
 *
 * - RANK IS NOT REALM. `realmOrdinal` says how hard somebody is to kill;
 *   `rankIndex` says whether anybody has to do what they say. The catalog is
 *   emphatic that the two come apart, so every gate here is on the rank.
 * - The gate goes BEFORE the target resolves, for the acting branches. Both
 *   refusals are about the speaker and disclose nothing about who was named,
 *   so a rogue at the bottom of the ladder learns what a declaration would
 *   take - which is a thing they can go and get.
 *
 * Three of these commit a house to something it cannot walk back, and one
 * changes a power ordinal permanently, so each has a default intent that is
 * the cheapest branch it has: a model answering `{"action":"posture"}` gets
 * the standing between two houses rather than a war.
 *
 * ── HOW THIS IS ATTACHED ───────────────────────────────
 *
 * `GameService` methods living in another file, merged onto the prototype at
 * the bottom of `game.ts` with their signatures merged into the class
 * declaration. `this.petition(...)` resolves and typechecks exactly as it did
 * when the bodies sat in the class, and every line below is the line it was.
 * `src/web/README.md` has the argument and the warning about `private`.
 */

import { DISASTER_RESPONSES } from '../data/cultivation/catastrophe.js';
import { IMMORTAL_MOTIVE, getChannel } from '../data/cultivation/crossings.js';
import {
    chainToApex,
    getApexInstitution,
    getCourt,
    getParentage
} from '../data/cultivation/hierarchy.js';
import { getHoldingsOf } from '../data/cultivation/immortal-items.js';
import { SECTS, getSect } from '../data/cultivation/index.js';
import { auditAncestralClaim, getSectAncestry, sectThreat } from '../data/cultivation/sects.js';
import { OPENLY_OR_IN_SECRET } from '../data/cultivation/standoff.js';
import { baseReservesFor } from '../engine/cultivation/embezzlement.js';
import { canExistBeyondTheLid } from '../engine/cultivation/existence.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { writeFlag } from '../server/consolidated/cultivation-support.js';
import { handlePetition, handleWake } from '../server/consolidated/sect-politics.js';
import {
    DEFAULT_OFFER_INTENT,
    DEFAULT_PETITION_INTENT,
    DEFAULT_POSTURE_INTENT,
    DEFAULT_SEAL_INTENT,
    OFFER_INTENTS,
    type OfferIntent,
    PETITION_INTENTS,
    POSTURE_INTENTS,
    type PetitionIntent,
    type PostureIntent,
    SEAL_INTENTS,
    type SealIntent
} from './actions.js';
import { MATCH_THRESHOLD, matchScore } from './entities.js';
import { factsForRefusal, factsForToolResult, rungAndOrdinal } from './facts.js';
import {
    type HousePosition,
    elderRungTitle,
    mayCommitTheHouse,
    offeringKey,
    opensAtRung,
    positionIn,
    postureKey,
    rankAndIndex,
    rankDoesNotReach,
    readOffering,
    readPosture,
    readSpentSeal,
    sealKey,
    servesNoHouse,
    standingStructure
} from './standing.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

/**
 * What a house's declaration would actually require, said to somebody who has
 * no house to declare with.
 *
 * The refusal a rogue gets has to be about POSITION rather than about rank -
 * they are not junior, they are outside - and it has to name the thing they
 * would have to go and get. "You lack authority" tells a player nothing they
 * can act on; "a war is a thing between two houses, and you are one person"
 * tells them what the missing piece is.
 */
const THE_DECLARATION_REQUIRES: Readonly<Record<'war' | 'alliance' | 'defect' | 'tribute', string>> = {
    tribute:
        'a levy is collected by somebody who is already owed it. What makes a payment due is a '
        + 'house holding from another house on stated terms, in writing, with everybody in the '
        + 'province able to name the arrangement. You are not at either end of one.',
    war:
        'a war is a thing between two houses. It needs a house on this side of it - people who '
        + 'answer when the name is used, ground that can be taken off them, and somebody entitled '
        + 'to spend both. One person saying it out loud in a square is a person saying something '
        + 'out loud in a square.',
    alliance:
        'an alliance is two parties who can each promise something and be held to it. What you '
        + 'have to offer is yourself, which is a thing you could offer by asking to be taken on, '
        + 'and that is a different sentence with a different answer.',
    defect:
        'defecting is a house changing who it holds from. You hold from nobody, so there is '
        + 'nothing to move and nobody who would notice it moving.'
};

/** How a declaration is recorded, in the world's voice rather than the schema's. */
const DECLARED: Readonly<Record<'war' | 'alliance' | 'defect' | 'tribute', (mine: string, theirs: string) => string>> = {
    war: (mine, theirs) => `${mine} is at war with ${theirs}.`,
    alliance: (mine, theirs) => `${mine} has offered ${theirs} an alliance, in the open.`,
    defect: (mine, theirs) => `${mine} holds from ${theirs} now, and said so.`,
    tribute: (mine, theirs) => `${mine} has sent to ${theirs} for a payment.`
};

/**
 * Months of a house's own payroll that an offering costs.
 *
 * A decade, which is the figure `IMMORTAL_MOTIVE.whatTheOfferingActuallyIs`
 * states in so many words: a body that spends its principal for a decade to
 * receive two words is being answered at the minimum rate. It is expressed in
 * months so that it sits in the same unit as `RESERVE_MONTHS` in
 * `embezzlement.ts`, which is twelve years of the same payroll - so the rite
 * costs five sixths of everything a house is holding, and a house that makes
 * one is a house that could not survive a bad decade afterwards.
 *
 * Here rather than in `schema/cultivation.ts` for the reason the leadership and
 * embezzlement constants are where they are: it prices one act, and it belongs
 * beside the act it prices.
 */
const OFFERING_MONTHS = 120;

export const institutionVerbs = {
    /**
     * Asking an institution for a thing.
     *
     * Three forms, selected by the label and never by what the answer turns out
     * to be. `grant` sends it up the chain through `handlePetition`, which has
     * been in `sect-politics.ts` the whole time and which nothing typed could
     * reach; `stock` is the application against something the holder cannot
     * reorder, which is the Requisition and the schedule amendment and anything
     * else shaped like them; `descent` is a claim of a line, which is an
     * application for recognition and is adjudicated rather than granted.
     */
    async petition(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined,
        matter: string | undefined
    ): Promise<Execution> {
        const which: PetitionIntent = PETITION_INTENTS.includes(intent as PetitionIntent)
            ? intent as PetitionIntent
            : DEFAULT_PETITION_INTENT;

        if (which === 'stock') return this.requisition(run, cultivator, target, matter);
        if (which === 'descent') return this.claimDescent(run, cultivator, target);

        const position = positionIn(this.repos, cultivator.id);
        const named = this.factionMeant(target, cultivator);

        // A body was named and it resolved to nothing, so the request has not
        // been made. Falling through to the player's own chain here would send
        // a petition somewhere they did not ask about and report back on it.
        if (this.namedButUnresolved(target, named)) {
            return this.noPartyNamed(
                'petition', target, cultivator,
                'No such door.',
                'You have named somebody to put it to, and it is not a name you hold. Nobody has '
                + 'said it in front of you, and a petition goes to a body you can find.'
            );
        }

        // Nobody to ask, and nobody to ask through. The gate here is POSITION
        // rather than rank: a petition is carried by people who are already
        // carrying things for you, and an unbacked cultivator has none.
        if (!position && !named) {
            return refused('engine.petitionChain', 'petition', factsForRefusal(
                'Nowhere for it to go.',
                servesNoHouse(
                    cultivator.name,
                    'a petition is not a thing you send - it is a thing somebody carries. It goes '
                    + 'up over the name of a house, through whoever that house holds from, as far '
                    + 'as each of them is willing to pass it. With no house above you and nobody '
                    + 'named to receive it, there is nothing for it to travel along.'
                ),
                standingStructure(null, null)
            ));
        }

        // The chain is the house's, so the petition starts at the house. A
        // named body that is not on it is not above this cultivator, and saying
        // which bodies ARE is the useful half of the refusal.
        const startId = position?.sectId ?? named?.id ?? null;
        if (named && position) {
            const chain = chainToApex(position.sectId);
            if (!chain.includes(named.id)) {
                const nameable = chain
                    .slice(1)
                    .filter(id => this.knowledge.isAwareOf(cultivator.id, 'sect', id))
                    .map(id => this.repos.sects.getById(id)?.name
                        ?? getCourt(id)?.name
                        ?? getApexInstitution(id)?.name
                        ?? id);
                return refused('engine.petitionChain', 'petition', factsForRefusal(
                    'Not above you.',
                    `${named.name} is not somebody ${position.sectName} holds from, so there is `
                    + 'nobody between you and them whose business it is to carry anything. '
                    + (nameable.length === 0
                        ? 'Who your own house answers to is not something you have been told.'
                        : `What is above ${position.sectName}, as far as you have been told, is `
                          + `${nameable.join(', then ')}.`),
                    `The chain of houses ${position.sectId} answers up does not contain `
                    + `${named.id} at any link. ${standingStructure(position, null)}`
                ));
            }
        }

        const result = await handlePetition({
            action: 'petition',
            cultivatorId: cultivator.id,
            ...(startId ? { sectId: startId } : {}),
            matter: (matter ?? target ?? 'a hearing').slice(0, 400)
        });
        const execution = this.fromToolResult(
            'sect_politics.petition', 'petition', result, 'The petition'
        );
        // Whose name it went up under. Not a gate - a petition may be sent from
        // any rung - but the receiving body reads the rank off the letter, and
        // a player is entitled to know what it says about them.
        execution.facts.structure.push(
            position
                ? `Sent over ${rankAndIndex(position)}.`
                : 'Sent by somebody who serves no house. There is no rank on the letter.'
        );
        return execution;
    },

    /**
     * The application against something a holder cannot reorder.
     *
     * The Requisition Against Standing Stock is the named instance and it is
     * DATA rather than a rule: `theForm`, `sufficientReason`, `decidedBy`,
     * `releaseMode` and `recordedRefusal` are fields on `Holding`, so a
     * schedule amendment at another body runs through the same code and comes
     * back in that body's own terms. Nothing here names a faction.
     *
     * IT IS ALWAYS REFUSED, and the refusal is the content. Not because a grant
     * is forbidden - one has been made - but because the engine holds no state
     * that satisfies `sufficientReason`, and a caller asserting that it does is
     * exactly the affordance the authority boundary exists to refuse. So the
     * form's own standard comes back, with the applicant's own words beside it,
     * and with the recorded precedent where the holder kept one. `savingTheSect`
     * says what would actually change the answer, which makes the refusal a
     * route rather than a wall.
     */
    requisition(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        matter: string | undefined
    ): Execution {
        const named = this.factionMeant(target, cultivator);
        if (!named) {
            return this.noPartyNamed(
                'petition', target, cultivator,
                'Filed against whom?',
                'A form is filed against a body that is holding something, and you have not said '
                + 'which body.'
            );
        }

        const holdings = getHoldingsOf(named.id);
        const withForm = holdings.filter(h => h.theForm !== null);
        if (withForm.length === 0) {
            // Never "they hold nothing". The count is known to the people the
            // catalog says it is known to, and an outsider learning that a body
            // holds nothing is learning the same shape of secret as an outsider
            // learning that it holds something.
            return refused('engine.requisition', 'petition', factsForRefusal(
                'No such form there.',
                `${named.name} keeps no procedure of the kind. Whether that is because there is `
                + 'nothing behind it to apply for, or because they have never written one down, '
                + 'is not something anybody outside could tell you.',
                `${named.id} holds ${holdings.length} line item(s) of the kind, and not one of them `
                + 'carries a stated form to fill in. What the counts are is not disclosed either '
                + 'way: who a count is known to is a property of the holding, and it does not '
                + 'include this cultivator.'
            ));
        }

        const asked = (matter ?? '').trim();
        const lines: string[] = [];
        for (const holding of withForm) {
            lines.push(holding.theForm as string);
            lines.push(holding.sufficientReason);
            lines.push(holding.decidedBy);
            if (holding.anyoneMayRefuse) {
                lines.push(
                    'Any one of them can refuse without giving a reason, and the instrument does '
                    + 'not require them to.'
                );
            }
            if (holding.recordedRefusal) {
                lines.push(holding.recordedRefusal.theCase);
                lines.push(holding.recordedRefusal.refusedBy);
                lines.push(holding.recordedRefusal.afterwards);
            }
            if (holding.savingTheSect) lines.push(holding.savingTheSect);
        }
        // The applicant's own words, shown back. Being refused in the terms you
        // asked in is the interaction; nothing branches on the string.
        lines.push(asked.length >= 2
            ? `What you have put on the form is: ${asked}. It is filed as written.`
            : 'The matter line is blank. It is filed as written.');
        lines.push(
            'It is receipted. Nothing else happens today, and nothing else was ever going to.'
        );

        const facts = factsForToolResult(`${named.name}: the form is filed.`, lines);
        facts.structure.push(
            `${withForm.length} line item(s) at ${named.id} carry a form to fill in. `
            + withForm.map(h =>
                h.releaseMode === 'written_instruction'
                    ? 'One is released on a written instruction somebody left, which means '
                      + 'somebody can act on those terms'
                      + (h.anyoneMayRefuse ? ', and any single member may still end it.' : '.')
                    : 'One is released by a body deciding together'
                      + (h.anyoneMayRefuse
                          ? ', and any single member of that body may end it.'
                          : ', and no single member may end it alone.')).join(' ')
            + ' The counts and the grades are withheld: who the count is known to does not '
            + 'include this cultivator.'
        );
        facts.structure.push(
            'Refused by construction. No state this engine can reach satisfies what the holder '
            + 'counts as a sufficient reason, and no argument may assert that it has been met.'
        );
        // Whose name is on the form. NOT a gate, and deliberately not one: the
        // catalog says clerks are taught the Requisition as a single procedure
        // and that it permits an application nobody has made, so the form is
        // open to anybody who can find the counter. What standing changes here
        // is the letterhead, and the answer is the same either way - which is
        // the honest shape of an instrument that has been granted once in four
        // hundred years.
        const filedBy = positionIn(this.repos, cultivator.id);
        facts.structure.push(
            filedBy
                ? `Filed over ${rankAndIndex(filedBy)}.`
                : 'Filed by somebody who serves no house. The form does not require one.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'refused',
            calls: [{
                name: 'engine.requisition',
                action: 'petition',
                summary:
                    `Filed against ${named.id}. Answered out of the holder's own form. Not `
                    + 'granted: sufficientReason is a fact about the world and nothing here may '
                    + 'claim it has been met.',
                ok: false
            }]
        };
    },

    /**
     * Claiming a line, which is an application for recognition.
     *
     * `auditAncestralClaim` exists to adjudicate a FACTION's claim and the
     * Ninefold Ledger opens a lineage audit unasked, so the world already had
     * both halves of this - and a player had no way to make the claim that
     * would be audited.
     *
     * The gate is the knowledge gate and it is the whole of it: the ancestor is
     * matched against the ancestral records of houses this cultivator can
     * already name, so there is no path from a name they type to a name they
     * have not been told. An unheard ancestor and an invented one come back
     * identical, and only the quoted string differs.
     */
    claimDescent(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Execution {
        const wanted = (target ?? '').trim();

        let line: { sectId: string; sectName: string; ancestorName: string } | null = null;
        if (wanted.length >= 3) {
            for (const sect of SECTS) {
                if (!this.knowledge.isAwareOf(cultivator.id, 'sect', sect.id)) continue;
                const records = getSectAncestry(sect.id);
                for (const ancestor of records?.ancestors ?? []) {
                    if (matchScore(wanted, ancestor.name) > MATCH_THRESHOLD) {
                        line = {
                            sectId: sect.id,
                            sectName: sect.name,
                            ancestorName: ancestor.name
                        };
                        break;
                    }
                }
                if (line) break;
            }
        }

        if (!line) {
            return refused('engine.claimDescent', 'petition', factsForRefusal(
                'A name and nothing behind it.',
                'You can say it. Saying it is free, and it is also all that happens: there is '
                + 'nobody in front of you who has heard the name, no roll it appears on that you '
                + 'have ever been shown, and nothing you are carrying that would connect you to '
                + 'it. A claim is worth what somebody can certify, and nobody certifies this.',
                `Unresolved ancestor "${wanted.slice(0, 60)}": no match in the ancestral records `
                + 'of any faction this cultivator is aware of. An unheard name and an invented '
                + 'one are answered identically here, by construction.'
            ));
        }

        // `claimIsTrue` is ground truth and is never surfaced. What is public
        // is whether a claim was MADE, which is what `claimed` reports.
        const audit = auditAncestralClaim(line.sectId);
        const lines = [
            `${line.ancestorName} is on ${line.sectName}'s wall, and you have said you are of `
            + 'that line.',
            'It is filed the way any claim is filed: written down, dated, and left standing until '
            + 'somebody has a reason to test it.',
            audit
                ? `${line.sectName} makes a claim of its own about what became of that line, and `
                  + 'has done for a long time. Whether a claim is true is not a thing anybody '
                  + 'settles by asserting it - it is a thing one house in the world sells an '
                  + 'answer to, and it sells that answer to the claimant or to a rival with equal '
                  + 'willingness.'
                : `${line.sectName} makes no claim about that line at all, which is not the same `
                  + 'as denying yours and is not evidence for it either.',
            'Nothing has changed about what you can do, where you can stand, or what anybody owes '
            + 'you. That is what an unexamined claim is worth.'
        ];

        const facts = factsForToolResult('The claim is made.', lines);
        facts.structure.push(
            `Matched "${wanted.slice(0, 40)}" to an ancestor of ${line.sectId} within this `
            + 'cultivator\'s knowledge. claimIsTrue and afterCrossing are ground truth and are '
            + 'not read here.'
        );
        facts.structure.push(
            'No state supports a personal lineage in this engine: there is no descent edge from a '
            + 'player to a catalogued ancestor, so the claim is recorded as an assertion and '
            + 'nothing derives from it. Certification is the only instrument that would.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'refused',
            calls: [{
                name: 'engine.claimDescent',
                action: 'petition',
                summary:
                    `Claim of descent from an ancestor of ${line.sectId}, filed and unsupported. `
                    + 'No lineage state exists to support or contradict it.',
                ok: false
            }]
        };
    },

    /**
     * What one house is to another: war, alliance, defection - or the read.
     *
     * The three that commit are the head of the house's, for one reason stated once: each of
     * them binds the house to something it cannot quietly walk back, and there
     * is exactly one person in a house entitled to do that. A rogue is told what
     * a declaration would require; a junior is told the rung it opens at in
     * their own house's title; the head's declaration happens and is recorded.
     *
     * WHAT IT COSTS IS STATED AND NOT INVENTED. `DISASTER_RESPONSES` prices war
     * and aid in consequences rather than numbers, and `sectThreat` supplies the
     * two ordinals that decide whether this was sane. No standing figure is
     * charged, deliberately: the catalog holds no number for what a declaration
     * costs a head with their own people, and manufacturing one here would be a
     * balance decision made in the narration tier - the specific thing AGENTS.md
     * forbids. It is a real gap and it belongs in `leadership.ts`.
     */
    posture(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined
    ): Execution {
        const which: PostureIntent = POSTURE_INTENTS.includes(intent as PostureIntent)
            ? intent as PostureIntent
            : DEFAULT_POSTURE_INTENT;

        const named = this.factionMeant(target, cultivator);
        const position = positionIn(this.repos, cultivator.id);

        if (which === 'stance') {
            if (!named) {
                return this.noPartyNamed(
                    'posture', target, cultivator,
                    'Toward whom?',
                    'A house takes a position toward somebody in particular, and you have not '
                    + 'said who.'
                );
            }
            return this.standingToward(run, cultivator, position, named);
        }

        // ── the gate ──
        //
        // BEFORE the target is resolved, and that ordering is deliberate. Both
        // of these refusals are about the speaker and disclose nothing whatever
        // about who was named, so they are safe to give to somebody who has
        // never heard of the house in the sentence - and a rogue at the bottom
        // of the ladder learns what a declaration would take, which is a thing
        // they can go and get. Resolving first would have answered them with
        // the knowledge gate instead, which is correct and teaches nothing.
        //
        // Position, then rank. Two failures and two sentences: somebody who
        // serves nothing has nothing to declare with, and somebody junior has a
        // house whose decision this is not.
        if (!position) {
            return refused('engine.housePosture', 'posture', factsForRefusal(
                'You speak for nobody.',
                servesNoHouse(cultivator.name, THE_DECLARATION_REQUIRES[which]),
                standingStructure(null, null)
            ));
        }
        if (!mayCommitTheHouse(position)) {
            const opens = opensAtRung(position);
            const elder = elderRungTitle(position);
            return refused('engine.housePosture', 'posture', factsForRefusal(
                'Not your decision.',
                rankDoesNotReach(position, opens)
                + (elder && elder !== position.ranks[opens]
                    ? ` What ${elder} does with a thing like this is put it in front of them.`
                    : ''),
                standingStructure(position, opens)
            ));
        }

        // Only now: the head is entitled to declare, and the question is
        // whether they have named anybody they could actually have meant.
        if (!named) {
            return this.noPartyNamed(
                'posture', target, cultivator,
                'Against nobody.',
                'A house takes a position toward somebody in particular, and you have not said who.'
            );
        }

        // ── it happens ──
        const own = sectThreat(position.sectId);
        const theirActing = sectThreat(named.id)?.acting
            ?? getCourt(named.id)?.powerOrdinal
            ?? getApexInstitution(named.id)?.powerOrdinal
            ?? null;
        const theirSeal = sectThreat(named.id);

        const cost = DISASTER_RESPONSES.find(
            r => r.response === (which === 'war' ? 'war' : 'aid')
        );

        // A levy is only a levy where the paying house already holds from the
        // asking one. That is `getParentage`, and it means whether this is a
        // right being exercised or a threat being made is a fact about the two
        // parties rather than about the word the player used.
        const theirParentage = getParentage(named.id);
        const theyHoldFromUs = theirParentage?.parentFactionId === position.sectId;

        const lines: string[] = [DECLARED[which](position.sectName, named.name)];
        if (cost) lines.push(cost.cost);

        // The measured half, and the only place a number appears. Both figures
        // are the catalog's own `powerOrdinal`, read through `sectThreat` so the
        // acting number and the one-off ceiling are never conflated.
        if (own && theirActing !== null) {
            const gap = theirActing - own.acting;
            lines.push(
                gap > 0
                    ? `The strongest person ${named.name} will actually put in a room stands `
                      + `${gap} rung${gap === 1 ? '' : 's'} above the strongest person `
                      + `${position.sectName} can.`
                    : gap < 0
                        ? `${position.sectName} can put somebody in a room that ${named.name} `
                          + 'cannot answer.'
                        : 'Neither house can put somebody in a room the other cannot answer.'
            );
            // A ceiling is disclosed only where the world already knows about
            // it. A sealed ancestor nobody has heard of stays unheard of, and
            // the silence is not a tell, because most houses have nothing.
            if (theirSeal?.sealedIsPublic && theirSeal.ceiling > theirSeal.acting) {
                lines.push(
                    'And it is common talk that they are holding something they have never '
                    + 'spent. Whether that is true, and what it is, was somebody else\'s problem '
                    + 'until today.'
                );
            }
        }

        if (which === 'alliance') lines.push(OPENLY_OR_IN_SECRET.theAllianceIsVisible);
        if (which === 'tribute') {
            lines.push(theyHoldFromUs
                ? `${named.name} holds from ${position.sectName} already, on terms everybody in `
                  + `the province can name: ${theirParentage?.holds ?? 'the arrangement is on record.'} `
                  + 'Asking is the ordinary exercise of it, and being refused would be the news.'
                : `${named.name} holds from nobody you can call on, so there is nothing behind the `
                  + 'asking except what happens if they say no. That is not a levy. Everybody who '
                  + 'hears about it will read it as the sentence before a different one.');
        }
        if (which === 'defect') {
            const parentage = getParentage(position.sectId);
            lines.push(parentage?.holds
                ?? 'Whoever the house currently holds from will hear about it from somebody other '
                   + 'than you.');
        }

        const onDay = Math.floor(run.elapsedDays);
        writeFlag(
            this.repos.db,
            cultivator.id,
            postureKey(position.sectId, named.id),
            JSON.stringify({
                stance: which,
                towardId: named.id,
                towardName: named.name,
                onDay,
                // All three are said out loud. A stance nobody can see is a
                // conspiracy, which is a different instrument with a different
                // failure mode - see OPENLY_OR_IN_SECRET - and this engine has
                // no way to keep one secret.
                openly: true
            })
        );

        const facts = factsForToolResult(DECLARED[which](position.sectName, named.name), lines);
        facts.structure.push(
            `The posture ${position.sectName} holds toward ${named.name} (${named.id}) is now `
            + `"${which}", recorded on day ${onDay} against the pair of them. Declared by `
            + `${rankAndIndex(position)}, which is the rung that heads the house.`
        );
        if (own && theirActing !== null) {
            facts.structure.push(
                `What each house can actually put in a room: ${position.sectName} at `
                + `${rungAndOrdinal(own.acting)}, ${named.name} at ${rungAndOrdinal(theirActing)}. `
                + (theirSeal?.sealedIsPublic
                    ? `The one-off they could wake on top of that reaches `
                      + `${rungAndOrdinal(theirSeal.ceiling)}, and they do not keep it quiet.`
                    : 'Whether they hold a one-off to wake on top of that is not disclosed.')
            );
        }
        facts.structure.push(
            'No standing is charged. The catalog holds no figure for what a declaration costs a '
            + 'head with their own people, and inventing one here would be a balance decision '
            + 'made in the narration tier.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.housePosture',
                action: 'posture',
                summary:
                    `${position.sectId} -> ${named.id}: ${which}, recorded on day ${onDay} by the `
                    + 'head of the house. There is no verb anywhere that unsays it.',
                ok: true
            }]
        };
    },

    /** Where two houses already stand. A read, and the cheapest branch of `posture`. */
    standingToward(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        position: HousePosition | null,
        named: { id: string; name: string }
    ): Execution {
        const lines: string[] = [];
        const entry = position ? getSect(position.sectId) : null;

        const declared = position
            ? readPosture(this.repos.db, cultivator.id, position.sectId, named.id)
            : null;
        if (declared && position) {
            lines.push(
                `${position.sectName} has already taken a position toward ${named.name}, and it `
                + `was ${declared.stance === 'war'
                    ? 'war'
                    : declared.stance === 'alliance'
                        ? 'an alliance'
                        : 'a change of who the house holds from'}. `
                + 'That was said out loud and cannot be unsaid.'
            );
        }

        if (entry) {
            if (entry.rivals.includes(named.id)) {
                lines.push(
                    'There is a feud, and it is old enough that nobody argues about who started it.'
                );
            }
            if (entry.ambition?.contestedWith.includes(named.id)) {
                lines.push(
                    `Both houses have a hand on the same thing: ${entry.ambition.wants} `
                    + `${entry.ambition.wouldCost}`
                );
            }
            if (entry.ambition?.blockedBy.includes(named.id)) {
                lines.push(`They are what stands between ${entry.name} and what it is after.`);
            }
        }

        // Whether anybody stands above both of them, which is what decides
        // whether a quarrel is allowed to become anything.
        if (position) {
            const mine = chainToApex(position.sectId);
            const theirs = chainToApex(named.id);
            const shared = mine.find(id => theirs.includes(id) && id !== position.sectId);
            if (shared && this.knowledge.isAwareOf(cultivator.id, 'sect', shared)) {
                const name = this.repos.sects.getById(shared)?.name
                    ?? getCourt(shared)?.name
                    ?? getApexInstitution(shared)?.name
                    ?? shared;
                lines.push(
                    `Both of you hold from ${name} somewhere above, which means whatever happens `
                    + 'between you is something they will have an opinion about.'
                );
            }
        }

        if (lines.length === 0) {
            lines.push(
                `Nothing stands between ${position?.sectName ?? cultivator.name} and ${named.name} `
                + 'that anybody has written down, and nothing has been said either way.'
            );
        }

        const facts = factsForToolResult(`${named.name}: where you stand.`, lines);
        facts.structure.push(
            position
                ? `${standingStructure(position, opensAtRung(position))} A declaration opens at `
                  + `${position.ranks[opensAtRung(position)] ?? 'the head of the house'}.`
                : 'No membership row. Nothing to declare with; see the refusal on the acting intents.'
        );
        return this.freeAction(run, 'posture', facts);
    },

    /**
     * The thing under the mountain.
     *
     * WHOSE mountain it is decides which act this is, and it is read off the
     * membership row rather than off the sentence - so no phrasing can choose
     * between a legal decision and a crime. Waking your own house's is a
     * decision with a stated cost. Breaking somebody else's is not a decision at
     * all: it is theft of the most dangerous object in the region, and it is
     * gated on GETTING TO IT rather than on standing, which is exactly what
     * `handleWake`'s capability assessment against the seal already answers.
     *
     * The read is the default and the read is `handleWake` unchanged, which has
     * been in `sect-politics.ts` the whole time: it discloses nothing about a
     * house whose seal is not public unless the caller is senior in that house,
     * and it says "nothing this cultivator knows of" for a house with nothing
     * under it in exactly the same words - so the shape of the answer is not the
     * answer. None of that is weakened here.
     */
    async seal(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined
    ): Promise<Execution> {
        const which: SealIntent = SEAL_INTENTS.includes(intent as SealIntent)
            ? intent as SealIntent
            : DEFAULT_SEAL_INTENT;

        const position = positionIn(this.repos, cultivator.id);
        const named = this.factionMeant(target, cultivator);

        // A mountain was named and it is not one this cultivator can find.
        // Falling back to their own house here would answer a question about
        // somebody else's seal with an answer about theirs, which is the
        // elder-dismissal rule applied to mountains.
        if (this.namedButUnresolved(target, named)) {
            return this.noPartyNamed(
                'seal', target, cultivator,
                'No mountain you know of.',
                'You have named a house, and it is not a name you hold.'
            );
        }

        const sectId = named?.id ?? position?.sectId ?? null;

        if (!sectId) {
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'No mountain in particular.',
                servesNoHouse(
                    cultivator.name,
                    'there is no mountain that is yours to have anything under. Whatever is asleep '
                    + 'anywhere else is asleep under somebody, and getting to it is a matter of '
                    + 'walking past them first.'
                ),
                standingStructure(null, null)
            ));
        }

        const isOwn = position !== null && position.sectId === sectId;

        // Somebody else's. Not a decision, and no rank anywhere makes it one -
        // so the gate is the seal itself, priced by the engine's own capability
        // predicates rather than by anything this layer decides.
        if (which === 'wake' && !isOwn) {
            const assessment = await handleWake({
                action: 'wake', sectId, cultivatorId: cultivator.id
            });
            const execution = this.fromToolResult(
                'sect_politics.wake', 'seal', assessment, 'The seal'
            );
            execution.outcome = 'refused';
            // Pushed onto BOTH channels. `lines` is what a provider narrator is
            // handed and `prose` is what the deterministic one ships, and the
            // two are separate fields on `EngineFacts` - appending to one and
            // not the other means the sentence exists for a player with a model
            // configured and not for a player without one, which is the exact
            // asymmetry `facts.ts` says must never appear.
            const notYours =
                'Whatever is down there is not yours to wake. There is no rank in any house that '
                + 'entitles somebody to break somebody else\'s seal, because it is not a decision '
                + 'anybody is entitled to make - it is a theft, and the only question it turns on '
                + 'is whether you could get to it.';
            execution.facts.lines.push(notYours);
            execution.facts.prose = `${execution.facts.prose}\n\n${notYours}`;
            execution.facts.structure.push(
                `The seal belongs to ${sectId}, and this cultivator `
                + (position
                    ? `serves ${position.sectId}, which is a different house.`
                    : 'serves no house at all.')
                + ' Nothing here is gated on rank; it is gated on reaching the seal.'
            );
            execution.calls.push({
                name: 'engine.wakeSeal',
                action: 'seal',
                summary:
                    `${sectId} is not this cultivator's house. Routed to the capability assessment `
                    + 'against the seal; no authority path exists and none should.',
                ok: false
            });
            return execution;
        }

        // The read, which is where a player finds out what the condition and the
        // cost are before spending either.
        if (which === 'read') {
            return this.fromToolResult(
                'sect_politics.wake', 'seal',
                await handleWake({ action: 'wake', sectId, cultivatorId: cultivator.id }),
                'The seal'
            );
        }

        // Your own house's. The rank gate, in the house's own titles.
        if (position && !mayCommitTheHouse(position)) {
            const opens = opensAtRung(position);
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'Not your decision.',
                `${rankDoesNotReach(position, opens)} It is not a thing the house votes on and not `
                + 'a thing an elder does quietly. One person decides, and if you were that person '
                + 'you would already have been shown where it is.',
                standingStructure(position, opens)
            ));
        }

        return this.breakTheGlass(run, cultivator, position as HousePosition);
    },

    /**
     * The head of the house spends the house's last card.
     *
     * The one method in this package that changes a `powerOrdinal`, and the
     * sharpest expression of what `sectThreat` has always modelled: `acting` is
     * the strongest member who will answer, `ceiling` is the strongest thing the
     * house can put in the world at all including one it can spend once, and
     * waking is the event that turns the second into the first. Permanently,
     * and once.
     *
     * The cost is the catalog's, verbatim, because the catalog wrote it as a
     * cost rather than as colour: nearly every `wakeCost` in the file says the
     * ancestor is spent, and several say the arrangement that made the house
     * survivable ends with them.
     */
    breakTheGlass(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        position: HousePosition
    ): Execution {
        const dormant = getSectAncestry(position.sectId)?.dormant ?? null;
        const already = readSpentSeal(this.repos.db, cultivator.id, position.sectId);

        if (!dormant) {
            // Phrased the way `handleWake` phrases a house with nothing under
            // it, because a head being told "there is nothing" and a head being
            // told "there is nothing you have been shown" must not be
            // distinguishable from outside this method.
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'Nothing to wake.',
                `There is nothing under ${position.sectName} that you have ever been shown, and `
                + 'you would have been shown it. That is not the same as nothing being there, and '
                + 'nobody alive can tell you which.',
                `The ancestry the catalog holds for ${position.sectId} records nobody dormant. `
                + 'The negative is phrased identically to a withheld positive by construction, so '
                + 'this answer does not distinguish the two.'
            ));
        }

        if (already) {
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'Spent.',
                `${dormant.name} came up once, on the day you sent for them, and there is no `
                + 'second time. A seal is a thing you have until you use it.',
                `seal_spent:${position.sectId} recorded on day ${already.onDay}. Single use, by `
                + 'construction.'
            ));
        }

        const sect = this.repos.sects.getById(position.sectId);
        const before = sect?.powerOrdinal ?? 0;
        const onDay = Math.floor(run.elapsedDays);

        // The state change. `powerOrdinal` is what every other surface in the
        // engine reads to decide whether this house can be fought, refused or
        // leaned on, so raising it to the woken ancestor's ordinal is all that
        // waking means - and recording the spend is what stops a card from
        // quietly becoming a resource.
        if (sect) {
            this.repos.sects.upsert({ ...sect, powerOrdinal: dormant.realmOrdinal });
        }
        writeFlag(
            this.repos.db,
            cultivator.id,
            sealKey(position.sectId),
            JSON.stringify({
                onDay,
                ancestorName: dormant.name,
                ordinal: dormant.realmOrdinal
            })
        );

        const lines = [
            `${dormant.name} is awake, at ${dormant.restingPlace.replace(/\.$/, '')}.`,
            `${dormant.dormantYears} years asleep, and everybody who arranged it is dead.`,
            // The cost, in the catalog's own words. It is not a warning about
            // what might happen; it is the account of what this has done.
            dormant.wakeCost,
            dormant.sealReason === 'final_breath'
                ? 'What came up is shaped around one act and cannot be pointed at a second one. '
                  + 'Whatever they were kept for is what you have, whether or not it is what you '
                  + 'wanted.'
                : 'They were banked whole and can be spent on anything worth a weapon, which is '
                  + 'the reading a house does not say out loud about its own last card.',
            'The circumstance the house told itself this was for was not met. It was not '
            + 'consulted. You decided, and the record will say so for as long as there is a record.'
        ];

        const facts = factsForToolResult(`${dormant.name} is awake.`, lines);
        facts.structure.push(
            `What ${position.sectId} can put in a room has gone from `
            + `${rungAndOrdinal(before)} to ${rungAndOrdinal(dormant.realmOrdinal)}. The ceiling `
            + 'has become the acting figure and cannot be spent a second time.'
        );
        facts.structure.push(
            `The seal is recorded as spent at ${position.sectId} on day ${onDay}. It was a `
            + `${dormant.sealGrade} seal holding somebody `
            + (dormant.sealReason === 'protector'
                ? 'banked whole and deliberately, as a reserve'
                : 'kept at the end, because they were ending anyway')
            + ', and outsiders '
            + (dormant.publiclyKnown ? 'already knew there was something under the mountain.' : 'did not know there was anything under the mountain.')
            + ` Decided by ${rankAndIndex(position)}, which is the rung that heads the house.`
        );
        facts.structure.push(
            'The condition the house wrote down for waking this one was not met and was not '
            + `consulted. It reads: ${dormant.wakeCondition}`
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.wakeSeal',
                action: 'seal',
                summary:
                    `${position.sectId}: seal spent by the head of the house on day ${onDay}. power_ordinal `
                    + `${before} -> ${dormant.realmOrdinal}, permanently, once.`,
                ok: true
            }]
        };
    },

    /**
     * The offering upward, and the reading of a silence.
     *
     * `IMMORTAL_MOTIVE` is unusually blunt about what this is: not a great
     * honour a sect has earned, but the cheapest possible acknowledgement,
     * costing the giver nothing whatsoever, which the sects have built entire
     * ceremonies around because it is all they were ever going to get. A body
     * that spends its principal for a decade to receive two words is being
     * answered at the minimum rate.
     *
     * So this method charges the decade and produces the silence, and says
     * plainly that the silence is consistent with several things without saying
     * which. `afterCrossing` and `claimIsTrue` are ground truth the catalog
     * holds precisely so that nobody in the world can read them, and nothing
     * here looks at either. There is no roll, because there is nothing to roll:
     * whether an ancestor answers is not a thing this engine decides.
     */
    offer(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined,
        /** What goes with it, where the sender said. Carried, never branched on. */
        message?: string
    ): Execution {
        const which: OfferIntent = OFFER_INTENTS.includes(intent as OfferIntent)
            ? intent as OfferIntent
            : DEFAULT_OFFER_INTENT;

        // The other end of the same pipe. Which end the speaker is standing at
        // is STATE rather than the word they used, so a player below who types
        // "send" gets the offering and a player above who types "offering" gets
        // the sending - both of them reach the thing they can actually do.
        if (canExistBeyondTheLid(cultivator)) {
            return this.sendDown(run, cultivator, target, message);
        }

        const position = positionIn(this.repos, cultivator.id);
        const named = this.factionMeant(target, cultivator);

        // A line was named and it is not one this cultivator can find. An
        // offering sent up the wrong wall is not a smaller version of the right
        // one; it is a different act.
        if (this.namedButUnresolved(target, named)) {
            return this.noPartyNamed(
                'offer', target, cultivator,
                'No line you know of.',
                'You have named a house whose ancestors you would be addressing, and it is not a '
                + 'name you hold.'
            );
        }

        const sectId = named?.id ?? position?.sectId ?? null;

        if (!sectId) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'To whom?',
                servesNoHouse(
                    cultivator.name,
                    'an offering goes up a line, and a line is a thing a house keeps. There is no '
                    + 'wall with your name at the bottom of it, no rite anybody would recognise '
                    + 'you performing, and nothing to pay for one with - what an offering costs is '
                    + 'a decade of a house\'s principal, and it is spent whether or not anything '
                    + 'answers.'
                ),
                standingStructure(null, null)
            ));
        }

        const records = getSectAncestry(sectId);
        const ascended = (records?.ancestors ?? []).filter(a => a.fate === 'ascended');
        const sect = this.repos.sects.getById(sectId) ?? getSect(sectId) ?? null;
        const isOwn = position !== null && position.sectId === sectId;

        if (which === 'channel' || !isOwn) {
            return this.readTheChannel(run, sectId, sect, records, ascended, isOwn);
        }

        // Your own house's line, and the head's decision, for the reason every
        // other commitment here is: it comes out of the principal, and one
        // person in a house signs for the principal.
        if (position && !mayCommitTheHouse(position)) {
            const opens = opensAtRung(position);
            return refused('engine.offering', 'offer', factsForRefusal(
                'Not yours to spend.',
                `${rankDoesNotReach(position, opens)} You can stand at the back of the hall while `
                + 'it is done. Everybody does.',
                standingStructure(position, opens)
            ));
        }

        const head = position as HousePosition;
        const stipend = sect?.stipend ?? [];
        const reserves = baseReservesFor(stipend);
        // The house's monthly payroll, defined EXACTLY as `baseReservesFor`
        // defines it - the sum of the ladder, not the ladder weighted by how
        // many people stand on each rung.
        //
        // The first version here weighted it by `rosterByRung`, which is the
        // more realistic figure and was wrong for the only reason that matters:
        // the reserve it is compared against is not weighted, so the comparison
        // was between two different quantities and the rite priced out as
        // unaffordable for every house in the world. A verb that can never fire
        // is a verb that is not there. Two definitions of one number is the
        // defect, not the choice of definition.
        const monthly = stipend.reduce((sum, s) => sum + Math.max(0, s), 0);
        // A decade of it, which is the figure IMMORTAL_MOTIVE states in years
        // and the stipend ladder states in stones. Against a reserve of twelve
        // years, an offering is five sixths of everything the house is holding.
        const cost = monthly * OFFERING_MONTHS;

        const alreadySent = readOffering(this.repos.db, cultivator.id, sectId);
        if (alreadySent) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'Once.',
                'It was done, and it was answered the way it was answered. A house that goes back '
                + 'up the line inside one lifetime is a house that has misunderstood what the '
                + 'first one was, and everybody senior would say so.',
                `offering:${sectId} recorded on day ${alreadySent.onDay}, ${alreadySent.stones} `
                + 'stones out of the principal.'
            ));
        }

        if (ascended.length === 0) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'Nobody up there to address it to.',
                `${sect?.name ?? 'The house'} has a wall of names and not one of them went `
                + 'through. A rite performed to a name that is only a dead person is a rite; it is '
                + 'just not an offering, and the elders who would have to conduct it would want to '
                + 'know who you thought it was for.',
                `The ancestry the catalog holds for ${sectId} lists nobody who crossed. An `
                + 'offering has to be addressed to somebody on the far side, and there is nobody '
                + 'there to address.'
            ));
        }

        if (cost > reserves) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'It cannot be paid for.',
                `What the rite costs is a decade of everything ${sect?.name ?? 'the house'} pays `
                + 'out, and the house does not hold a decade of everything it pays out. Making it '
                + 'anyway would not be an offering; it would be the end of the house with an '
                + 'offering in the middle of it.',
                `The rite costs ${cost} stones against reserves of ${reserves} at ${sectId}, `
                + `which is ${cost - reserves} more than the house holds. The reserves figure is `
                + 'the same one the stipend is paid out of; there is not a second purse.'
            ));
        }

        const onDay = Math.floor(run.elapsedDays);
        writeFlag(
            this.repos.db, cultivator.id, offeringKey(sectId),
            JSON.stringify({ onDay, stones: cost, response: null })
        );

        const lines = [
            `It is made, in the name of ${sect?.name ?? 'the house'}, to ${ascended[0].name}, who `
            + `went through ${ascended[0].yearsAgo} years ago.`,
            `It costs ${cost} spirit stones out of the principal, which is about a decade of `
            + 'everything the house pays out, and it is spent before anybody knows whether it '
            + 'bought anything.',
            IMMORTAL_MOTIVE.whatTheOfferingActuallyIs,
            'Nothing answers. Not that day, not that season, not that year.',
            // The four readings, none of them ranked and none of them resolved.
            // The engine holds which is true and this method does not read it,
            // which is the whole reason working it out is a prize.
            'And nothing about the silence tells the possibilities apart, which is what everybody '
            + 'who has ever done this has had to live with: that they died up there long ago; '
            + 'that they are alive and have no reason at all to answer a house full of strangers '
            + 'born two thousand years after they left; that the name at the top of the page has '
            + 'been wrong for so long that an answer would arrive addressed to somebody nobody '
            + 'here would recognise; or that it was heard, weighed, and found not worth the ten '
            + 'breaths a reply would cost.'
        ];
        const previous = records?.lastOffering ?? null;
        if (previous) {
            lines.push(
                `The house has done this before, ${previous.yearsAgo} years ago. ${previous.cost} `
                + (previous.response === null
                    ? 'Nothing came back that time either, and what the house did about it is on '
                      + `the record: ${previous.consequence}`
                    : `What came back was: ${previous.response} ${previous.consequence}`)
            );
        }

        const facts = factsForToolResult('The offering is made.', lines);
        facts.structure.push(
            `The offering is recorded at ${sectId} on day ${onDay}. It cost ${cost} stones, which `
            + `is ${OFFERING_MONTHS} months of payroll at ${monthly} a month, taken against `
            + `reserves of ${reserves} and leaving ${reserves - cost}. Decided by `
            + `${rankAndIndex(head)}, which is the rung that heads the house.`
        );
        facts.structure.push(
            'Response is null and is not rolled. Nothing in this engine decides whether an '
            + 'ancestor answers; SectAncestor.afterCrossing is ground truth the world cannot read, '
            + 'and this method does not read it either.'
        );
        facts.structure.push(
            'The reserve is NOT decremented. `siphon_taken:<sectId>` owns that figure inside '
            + 'sect-manage.ts behind a key this module does not reach into, and a second ledger '
            + 'only one side reads is worse than no ledger. Unifying them is outstanding.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.offering',
                action: 'offer',
                summary:
                    `${sectId}: offering made by the head of the house on day ${onDay} at ${cost} stones. No `
                    + 'response, and no response was rolled for.',
                ok: true
            }]
        };
    },

    /** What the line is, before anybody spends a decade on it. Free. */
    readTheChannel(
        this: GameService,
        run: Run,
        sectId: string,
        sect: { name: string } | null,
        records: ReturnType<typeof getSectAncestry>,
        ascended: ReadonlyArray<{ name: string; yearsAgo: number; rememberedFor: string }>,
        isOwn: boolean
    ): Execution {
        const lines: string[] = [];
        const name = sect?.name ?? 'the house';

        if (ascended.length === 0) {
            lines.push(
                `${name} has a wall of names, and as far as anybody will say out loud, that is all `
                + 'it is. Genealogy does not keep realms.'
            );
        } else {
            for (const one of ascended.slice(0, 2)) {
                lines.push(`${one.name}, ${one.yearsAgo} years ago. ${one.rememberedFor}`);
            }
        }

        // A public claim is public. Whether it is TRUE is `claimIsTrue`, which
        // is ground truth and is read nowhere in this package.
        if (records?.claimsLivingAncestor) {
            lines.push(
                `${name} says the line still answers. Every house that says this says it the same `
                + 'way, and no house that says it can show you.'
            );
        }

        // What the house has actually received is house business. An outsider
        // gets the claim and the ceremony; a member gets the ledger.
        if (isOwn) {
            const channel = getChannel(sectId);
            if (channel) {
                lines.push(channel.cadence);
                lines.push(channel.usability);
            }
            const previous = records?.lastOffering ?? null;
            if (previous) {
                lines.push(
                    `The last offering was ${previous.yearsAgo} years ago. ${previous.cost} `
                    + (previous.response === null
                        ? `Nothing came back. ${previous.consequence}`
                        : `What came back was: ${previous.response} ${previous.consequence}`)
                );
            }
        }

        lines.push(
            'What an offering costs is a decade of a house\'s principal, and it is paid before '
            + 'anybody knows whether it bought anything.'
        );

        const facts = factsForToolResult(`${name}: the line upward.`, lines);
        facts.structure.push(
            `The ancestry the catalog holds for ${sectId} lists ${ascended.length} who crossed, `
            + `and the house ${records?.claimsLivingAncestor ? 'claims one of them is still alive up there' : 'makes no claim that any of them is still alive up there'}. `
            + `The detail of how a house reaches them is ${isOwn ? 'disclosed here, because the caller is of this house' : 'withheld here, because the caller is not of this house'}. `
            + 'Whether the claim is true, and what became of any of them after crossing, are held '
            + 'by the engine and are not read on this path.'
        );
        return this.freeAction(run, 'offer', facts);
    }
};
