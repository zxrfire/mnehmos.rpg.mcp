/**
 * Somebody holding an account against the cultivator finds them.
 *
 * The catalog's feud row names a bystander and a grudge drawn from a list. This
 * draws from the ledger instead: the holders `whoIsComingForYou` says may act and
 * think it worth doing, each with the weight of what they hold. A house holder
 * sends somebody on its roll, chosen by the caller.
 */

import { ENCOUNTERS, fillSummary, type EncounterEntry } from '../../data/cultivation/encounters.js';
import { rankName } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import { locatabilityApplies, socialReach } from './activity.js';
import { resolveOccurrence } from './resolve.js';
import type {
    AnAccountComingDue,
    EncounterOccurrence,
    EncounterRollInput,
    KnowledgeGrant
} from './types.js';

/**
 * Daily chance one of the holders finds the cultivator.
 *
 * THE CURVE: per day, `ACCOUNT_DAILY_AT_MOST * (1 - e^-weight)`, weight being
 * `WHAT_A_RECORD_COUNTS_FOR` summed over every open account the holders carry.
 * Mean days to being found, on open ground:
 *
 *     one slight (0.05)        ~1020 days
 *     one serious (0.25)       ~226
 *     one grave (1)            ~79
 *     one unforgivable (2)     ~58
 *     several heavy (4+)       ~51, the floor
 *
 * Behind a door the same curve is cut by `socialReach` - a private cave 0.45,
 * undiscovered ground 0.08 - because a hunter has to know where to look.
 * Activity exposure is NOT applied: exposure prices coincidences, and somebody
 * coming for you is not one.
 */
export const ACCOUNT_DAILY_AT_MOST = 0.02;

/** The catalog row an account arrives as. Its threat is replaced by who came. */
export const THE_FEUD_ROW = 'enc-old-feud-ambush';

export function dailyChanceAnAccountComesDue(weight: number): number {
    if (!Number.isFinite(weight) || weight <= 0) return 0;
    return ACCOUNT_DAILY_AT_MOST * (1 - Math.exp(-weight));
}

/** Chance of being found across `days`, for the window's own grid. */
export function chanceAnAccountComesDue(
    accounts: readonly AnAccountComingDue[],
    days: number,
    input: Pick<EncounterRollInput, 'activity' | 'locatability'>
): number {
    const weight = accounts.reduce((sum, account) => sum + account.weight, 0);
    const daily = dailyChanceAnAccountComesDue(weight);
    const findable = locatabilityApplies(input.activity)
        ? socialReach(input.locatability ?? 'private')
        : 1;
    return 1 - Math.exp(-daily * findable * Math.max(1, days));
}

/**
 * One check: whether a holder arrives on this day, and which.
 *
 * Its own stream, drawn only when there is an account to come due, so a
 * cultivator nobody holds anything against draws exactly what they drew before.
 */
export function attemptAnAccount(
    input: EncounterRollInput,
    absoluteDay: number,
    dayOffset: number,
    days: number,
    stage: string
): EncounterOccurrence | null {
    const accounts = input.comingForYou ?? [];
    if (accounts.length === 0) return null;
    const row = ENCOUNTERS.find(entry => entry.id === THE_FEUD_ROW);
    if (!row) return null;

    const rng = forStream(input.seed, 'enc.account', absoluteDay, stage, input.cultivator.id);
    const came = rng.next();
    const which = rng.next();
    if (came >= chanceAnAccountComesDue(accounts, days, input)) return null;

    // Which holder, in proportion to what each holds.
    const total = accounts.reduce((sum, account) => sum + account.weight, 0);
    let left = which * total;
    const account = accounts.find(one => (left -= one.weight) < 0) ?? accounts[accounts.length - 1];

    const entry: EncounterEntry = {
        ...row,
        threatOrdinal: account.sent.realmOrdinal,
        interrupts: true,
        tokens: ['name', 'holder', 'place', 'what', 'threatRank'],
        summaryTemplate: account.holderIsAHouse
            ? '{name} of {holder} has found the cultivator at {place}, sent over the account '
              + '{holder} holds against them: {what} {name} stands at {threatRank}. No terms offered.'
            : '{name} has found the cultivator at {place}, over the account {name} holds against '
              + 'them: {what} {name} stands at {threatRank}. No terms offered.'
    };

    const grants: KnowledgeGrant[] = [{
        kind: 'cultivator',
        id: account.sent.id,
        name: account.sent.name,
        sourceKind: 'witnessed',
        sourceNote: `Came for them at ${input.place.name} on day ${Math.round(absoluteDay)}.`,
        stance: 'knows',
        confidence: 0.9,
        statement: `${account.sent.name} came to settle an account.`
    }];
    if (account.holderIsAHouse) {
        grants.push({
            kind: 'sect',
            id: account.holderId,
            name: account.holderName,
            sourceKind: 'told',
            sourceNote: `Named by ${account.sent.name}, who was sent by it.`,
            stance: 'knows',
            confidence: 0.9,
            statement: `${account.holderName} holds an account against them.`
        });
    }

    const values = {
        name: account.sent.name,
        holder: account.holderName,
        place: input.place.name,
        what: account.what.trim(),
        threatRank: rankName(account.sent.realmOrdinal)
    };
    const resolved = resolveOccurrence({
        entry,
        activity: input.activity,
        ordinal: input.cultivator.realmOrdinal,
        maxHp: input.cultivator.maxHp,
        hp: input.cultivator.hp,
        spiritStones: input.cultivator.spiritStones,
        absoluteDay,
        dayOffset,
        values,
        grants,
        castIds: [account.sent.id],
        cast: input.cast ?? [],
        outcome: 'landed'
    });

    // They came for this cultivator, so they looked up whatever the regard band
    // says, and there is no walking past them. What the gap does is the fight's
    // to settle: `openFight` asks `theGapDecidesItAlone` first.
    return {
        ...resolved,
        interrupts: true,
        stance: 'engaged',
        event: {
            ...resolved.event,
            interrupts: true,
            summary: fillSummary(entry, values),
            data: { ...resolved.event.data, stance: 'engaged', accountHolderId: account.holderId }
        },
        confrontation: resolved.confrontation
            ? { ...resolved.confrontation, stance: 'engaged', count: 1, avoidable: false, engageable: true }
            : null,
        account
    };
}
