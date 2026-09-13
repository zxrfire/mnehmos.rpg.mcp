/**
 * The road to the service rung: giving your word to go and do a thing, and then
 * going and doing it.
 *
 * `what-they-will-take-instead-of-money.ts` has said since it was written that
 * somebody on this rung wants "something done, by you, that they cannot do
 * themselves". Nothing anywhere could be that thing. The ladder's other four
 * rungs are all reachable by a sentence - stones and goods are in the pouch, a
 * favour is a row the kindness verbs already open, a hold is what `leverage`
 * records - and the one in between had no verb, no write and no read.
 *
 * ── IT IS THE DUTY PATH WITH NOBODY'S HOUSE ON IT ────────────────────────
 *
 * `acceptDuty` and `completeDuty` in `encounters.ts` already do exactly this
 * for work taken off a board: an `oath` row at `service_term`, held by whoever
 * gave their word, with the length in `terms`, the deadline in `dueOnDay`, days
 * served kept on the tag list, and `oath_fulfilled` at the end of it. The only
 * thing that differs when a PERSON asks is that there is no contribution to
 * credit and no house to credit it with, so `daysServedOn` and
 * `recordDaysServed` are borrowed rather than re-expressed and the row is the
 * same shape a board writes.
 *
 * ── AND WHY THE VERB IS NOT ON `TIME_CONSUMING_ACTIONS` ──────────────────
 *
 * That list is a floor on what a MISPARSE may reach, and `oath` carries three
 * free reads a stray sentence lands on constantly. It does not need to be on
 * it: the step that spends days fires ONLY where the ledger already holds an
 * open word this cultivator gave to this person, and the step that opens one
 * spends nothing. A misparse cannot reach a span it has to have deliberately
 * opened on an earlier turn.
 */

import {
    howLongAServiceRuns,
    howLongThisTermRuns,
    servicesYouOwe,
    theServiceYouGaveYourWordOn,
    undertakingAService,
    whatABrokenTermLeft,
    whatServingItLeft,
    whatWasUndertaken
} from '../engine/social-leverage/a-service-is-something-done.js';
import {
    createObligation,
    settleObligation,
    type ObligationRecord
} from '../engine/social/grudges.js';
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import {
    daysServedOn,
    recordDaysServed,
    type DatabaseHandle
} from './encounters.js';
import { factsForRefusal, factsForToolResult, sayThisWhateverTheNarratorDoes } from './facts.js';
import { refused } from './tool-result-prose.js';
import { TRAVEL_FOCUS } from './turn-constants.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';

/**
 * A service undertaken with no particular ask named is weighted at the ladder's
 * own middle: the weight whose definition is "time, money, or a word put in
 * somewhere - costs them something", which is what a service IS.
 *
 * Where a caller knows what is being paid for it passes the real weight, and
 * the term gets longer. Nothing here invents a figure: the days come off
 * `PURSE_REACH` in `howLongAServiceRuns`.
 */
const A_SERVICE_WITH_NO_ASK_NAMED = 'a_real_favour' as const;

export const serviceVerbs = {
    /**
     * Two steps, and which one this is is read off the ledger rather than off
     * the sentence.
     *
     * A player who has not given their word to this person gives it; a player
     * who has goes and serves it out. The engine's own line after the first
     * step says what the second one is, so the road is discoverable from inside
     * the game rather than from a manual.
     */
    async doSomebodyAService(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        topic: string | undefined
    ): Promise<Execution> {
        const today = Math.floor(run.elapsedDays);
        const wanted = (target ?? '').trim();
        const scope = this.scopeFor(cultivator);

        // WHO IT IS FOR. A service is done for somebody: there is no such thing
        // as one done in the air, which is the whole of what separates it from
        // a stretch of work.
        //
        // WHOEVER THEY WERE TALKING TO, where the sentence named nobody or
        // named the work instead of the person. The same fallback the release
        // branch takes, and for the same reason: somebody mid-conversation who
        // offers to go and do a thing has not left the recipient out, they have
        // left it obvious.
        const named = wanted.length >= 2
            ? this.partyPutTo(cultivator, wanted, scope) ?? this.somebodyAtHand(wanted, cultivator)
            : null;
        const found = named ?? this.somebodyAtHand('', cultivator);
        const person = found ? { id: found.id, name: found.name } : null;

        if (!person) {
            const owed = servicesYouOwe(
                ledgerAbout(this.db as unknown as DatabaseHandle, cultivator.id), cultivator.id
            );
            return refused('engine.aServiceIsSomethingDone', 'oath', factsForRefusal(
                'A service is done for somebody.',
                owed.length > 0
                    ? 'The sentence names nobody. What you have already given your word on: '
                      + `${owed.map(row => row.terms ?? row.description).join(' ')} Say whose `
                      + 'it is and the days go into that one.'
                    : 'Nobody is named and nobody is standing here, so there is nothing to go '
                      + 'and do and nobody to have asked for it.',
                `No party resolved for a service from "${wanted}". `
                + `${owed.length} open service term(s) held by ${cultivator.id}. `
                + 'Nothing written, no time passed.'
            ));
        }

        const ledger = ledgerAbout(this.db as unknown as DatabaseHandle, cultivator.id);
        const standing = theServiceYouGaveYourWordOn(ledger, cultivator.id, person.id);

        return standing
            ? await this.servingOutTheTerm(run, cultivator, ambient, person, standing, today)
            : this.givingYourWordToDoIt(run, cultivator, person, topic, today);
    },

    /**
     * The first step: a word given, and nothing spent.
     *
     * WHAT THEY WANT DONE COMES FROM THEM. Their own open want is what they say
     * when they are asked to name one, which is the same row and the same text
     * `request` already reads out at a table. Where the world holds no want for
     * them the player's own sentence stands as the terms - `grudges.ts` is
     * explicit that an oath's terms are prose, written by whoever swore it and
     * never parsed - and where there is neither, the row says so rather than
     * inventing an errand.
     */
    givingYourWordToDoIt(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        person: { id: string; name: string },
        topic: string | undefined,
        today: number
    ): Execution {
        const said = (topic ?? '').trim();
        const theirs = this.theirOpenBusiness(person.id)?.goals[0] ?? null;
        const what = theirs
            ? `${theirs.text}`
            : said.length >= 3
                ? `${said}${/[.!?]$/.test(said) ? '' : '.'}`
                : `Whatever ${person.name} names, and they have not named it yet.`;

        const opened = undertakingAService({
            doerId: cultivator.id,
            forWhomId: person.id,
            forWhomName: person.name,
            what,
            ask: A_SERVICE_WITH_NO_ASK_NAMED,
            onDay: today
        });
        const record = createObligation(opened);
        writeOneObligation(this.db as unknown as DatabaseHandle, record);

        const days = howLongAServiceRuns(A_SERVICE_WITH_NO_ASK_NAMED);
        const facts = factsForToolResult(
            `A word given to ${person.name}.`,
            [
                whatWasUndertaken(person.name, what, days, record.dueOnDay ?? today + days),
                theirs === null
                    ? 'Nothing in the world says what they want done, so what was undertaken is '
                      + 'what you said it was.'
                    : 'That is their own open business, said by them, and it is what the term is '
                      + 'for.'
            ]
        );
        facts.structure.push(
            `a-service-is-something-done: obligation ${record.id} (oath, service_term, `
            + `${record.severity}) opened, holder ${cultivator.id}, subject ${person.id}, `
            + `${days} day(s), due on day ${record.dueOnDay}. Open until the days are served. `
            + 'No days spent opening it.'
        );

        const done = this.freeAction(run, 'oath', facts);
        done.calls.push({
            name: 'social.createObligation',
            action: 'oath',
            summary:
                `${record.id}: ${cultivator.id} owes ${person.id} a service term of ${days} `
                + 'day(s). It is discharged by serving it and by nothing else.',
            ok: true
        });
        return done;
    },

    /**
     * The second step: the days.
     *
     * A TERM CUT SHORT IS NOT A TERM, and what was served is kept, for the
     * reason `daysServedOn` already gives: `shortSkip` stops a span at its first
     * interrupt, including the provisions warning the skip fires deliberately,
     * and losing fifty days of a term to the engine being helpful is not a cost
     * anybody agreed to.
     */
    async servingOutTheTerm(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        person: { id: string; name: string },
        standing: ObligationRecord,
        today: number
    ): Promise<Execution> {
        const days = howLongThisTermRuns(standing);
        const already = daysServedOn(standing);
        const stillToServe = Math.max(1, days - already);

        const execution = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS,
            `A service for ${person.name}`, stillToServe, 'labour'
        );

        const after = this.repos.cultivators.getById(cultivator.id);
        const doneOn = Math.floor(this.repos.runs.getById(run.id)!.elapsedDays);
        const served = already + (doneOn - today);

        if (!after?.alive) {
            execution.facts.structure.push(
                `a-service-is-something-done: ${standing.id} left open. The term was not served `
                + 'and nobody is left to serve it.'
            );
            return execution;
        }

        if (served < days) {
            recordDaysServed(this.repos, standing, served);
            sayThisWhateverTheNarratorDoes(
                execution.facts,
                whatABrokenTermLeft(person.name, served, days, standing.dueOnDay ?? today + days)
            );
            execution.facts.structure.push(
                `a-service-is-something-done: ${served} of ${days} day(s) served on `
                + `${standing.id}. Still open. Nothing is discharged and nothing is owed for it.`
            );
            execution.calls.push({
                name: 'encounters.recordDaysServed',
                action: 'oath',
                summary:
                    `${standing.id} broken off at ${served} of ${days} day(s). The word stands.`,
                ok: false
            });
            return execution;
        }

        const settled = settleObligation(standing, {
            resolution: 'oath_fulfilled',
            onDay: doneOn,
            byId: cultivator.id,
            note: `Served out over ${days} days, for ${person.name}.`
        });
        writeOneObligation(this.db as unknown as DatabaseHandle, settled);

        sayThisWhateverTheNarratorDoes(execution.facts, whatServingItLeft(person.name, days));
        execution.facts.structure.push(
            `a-service-is-something-done: ${settled.id} settled oath_fulfilled on day ${doneOn}. `
            + `${person.id} is owed nothing and the ledger holds that ${cultivator.id} did it. `
            + 'It stands on the service rung of the offer ladder until it buys something.'
        );
        execution.calls.push({
            name: 'social.settleObligation',
            action: 'oath',
            summary:
                `${settled.id} (oath, service_term) fulfilled: ${days} day(s) spent on `
                + `${person.id}'s business. A service done, not a favour owed.`,
            ok: true
        });
        return execution;
    }
};
