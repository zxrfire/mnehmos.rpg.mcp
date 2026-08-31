/**
 * Secrets: a lifecycle, and who is holding each one.
 *
 * ── Relationship to the existing secret system ────────────────────────────
 * `src/storage/repos/secret.repo.ts` and the `secrets` table already exist and
 * are not duplicated here. That system owns the CONTENT of a secret - its
 * name, its public and hidden descriptions, its world, its sensitivity, its
 * leak patterns. It is a good fit for what it does and this module leaves it
 * alone.
 *
 * What it does not have, and what the spec requires, is two things:
 *
 *   1. **A lifecycle.** The existing model is a boolean: `revealed`, plus the
 *      condition that flipped it. That cannot express a secret that was
 *      *stolen* rather than discovered, *traded* for something, *leaked* by a
 *      third party, deliberately *suppressed* after the fact, *falsified* so
 *      that what circulates is wrong, or *misunderstood* by the person who now
 *      has it. Those are different situations with different consequences.
 *
 *   2. **Holders.** `revealed` is a global flag: once true, it is true for
 *      everyone. But a secret is almost never known to everyone or to nobody -
 *      it is known to four people, suspected by a fifth, and held in a
 *      falsified version by a sixth who paid for it.
 *
 * So this module adds a per-holder layer on top: one {@link SecretHolding} per
 * (secret, holder) pair, each with its own status and its own version, plus an
 * append-only {@link SecretEvent} log of every transition. `secretId` points at
 * the existing `secrets` row; nothing here restates its content.
 *
 * ── The player is not privileged ──────────────────────────────────────────
 * The player is a holder like any other. **The player must not automatically
 * know what the simulation knows**: what they know about a secret is whatever
 * holding names them, and if there is no holding, they know nothing - however
 * long the secret has been in the database and however central it is.
 *
 * ── The engine records; it does not adjudicate ────────────────────────────
 * Any status may follow any other. There is no legality table, because whether
 * a secret *could* have gone from suppressed back to leaked is a question
 * about the fiction, and the fiction is the narrator's. The engine's
 * contribution is that whatever happened is written down, dated, attributed,
 * and still there in forty years.
 */

import { byId, stableId, type DayIndex } from './common.js';

// ─────────────────────────────────────────────────────────────────────────
// LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where a secret stands with respect to one holder.
 *
 *   `unknown`       they have no idea. Storable, so "she still does not know"
 *                   is a fact with a date rather than an absence.
 *   `suspected`     they think something is there without having it.
 *   `discovered`    they found it out legitimately - saw it, worked it out,
 *                   were told by someone entitled to tell them.
 *   `stolen`        taken from someone who was keeping it. The distinction
 *                   from `discovered` matters because somebody was robbed.
 *   `traded`        obtained in exchange for something. Information is a
 *                   resource in this world, and this is what it looks like
 *                   when it is priced.
 *   `leaked`        it got out. Nobody meant this holder to have it.
 *   `suppressed`    they had it and it has been forced back down - by
 *                   threat, by an oath, by a sect ruling, by a memory being
 *                   taken at a realm boundary.
 *   `falsified`     what they hold is a version somebody altered on purpose.
 *   `misunderstood` they have it and have it wrong, with nobody at fault.
 *
 * The last two are why `heldVersion` exists: those holders are acting on
 * something that is not the secret, and the engine has to be able to hand the
 * narrator what they actually think.
 */
export type SecretStatus =
    | 'unknown'
    | 'suspected'
    | 'discovered'
    | 'stolen'
    | 'traded'
    | 'leaked'
    | 'suppressed'
    | 'falsified'
    | 'misunderstood';

/** Statuses in which the holder is acting on something other than the truth. */
export const DISTORTED_STATUSES: readonly SecretStatus[] = Object.freeze([
    'falsified',
    'misunderstood'
] as const);

/** Statuses in which the holder has the secret in some usable form. */
export const HOLDING_STATUSES: readonly SecretStatus[] = Object.freeze([
    'discovered',
    'stolen',
    'traded',
    'leaked',
    'falsified',
    'misunderstood'
] as const);

export type SecretHolderKind = 'character' | 'faction' | 'public';

/**
 * One (secret, holder) pair.
 *
 * `heldVersion` is null when the holder has the secret as it really is. When
 * it is set, that string is what they will act on - and the engine keeps the
 * two apart so that a falsified secret can be sold onward, believed, and
 * eventually discovered to have been wrong.
 */
export interface SecretHolding {
    id: string;
    /** References the existing `secrets` table. Content is not restated here. */
    secretId: string;
    holderId: string;
    holderKind: SecretHolderKind;
    status: SecretStatus;
    /** What this holder actually has, when it differs from the secret itself. */
    heldVersion: string | null;
    acquiredOnDay: DayIndex;
    /** Who they got it from, when there is somebody. */
    acquiredFromId: string | null;
    /** What it cost, for a trade. Prose: a favour, a manual, three hundred stones. */
    price: string | null;
    note: string;
    tags: string[];
    lastChangedOnDay: DayIndex;
}

/**
 * An append-only transition.
 *
 * The history is the valuable part: a secret that is currently `suppressed`
 * but was `leaked` for two years in between is a very different problem from
 * one that was never out, and only the log can tell them apart.
 */
export interface SecretEvent {
    id: string;
    secretId: string;
    holderId: string;
    onDay: DayIndex;
    from: SecretStatus | null;
    to: SecretStatus;
    /** Who did it, when somebody did: the thief, the broker, the elder. */
    actorId: string | null;
    /** What happened, in plain words. */
    note: string;
}

// ─────────────────────────────────────────────────────────────────────────
// CREATION AND TRANSITION
// ─────────────────────────────────────────────────────────────────────────

export interface HoldingInput {
    secretId: string;
    holderId: string;
    status: SecretStatus;
    onDay: DayIndex;
    holderKind?: SecretHolderKind;
    heldVersion?: string | null;
    acquiredFromId?: string | null;
    price?: string | null;
    note?: string;
    tags?: readonly string[];
}

export function createHolding(input: HoldingInput): SecretHolding {
    return {
        id: stableId('shold', input.secretId, input.holderId),
        secretId: input.secretId,
        holderId: input.holderId,
        holderKind: input.holderKind ?? 'character',
        status: input.status,
        heldVersion: input.heldVersion ?? null,
        acquiredOnDay: input.onDay,
        acquiredFromId: input.acquiredFromId ?? null,
        price: input.price ?? null,
        note: input.note ?? '',
        tags: [...(input.tags ?? [])],
        lastChangedOnDay: input.onDay
    };
}

export interface TransitionInput {
    to: SecretStatus;
    onDay: DayIndex;
    note: string;
    actorId?: string | null;
    /** Set or clear the version this holder acts on. */
    heldVersion?: string | null;
    acquiredFromId?: string | null;
    price?: string | null;
    tags?: readonly string[];
}

/**
 * Move a holding to a new status and emit the log entry.
 *
 * Pure: returns a new holding and a new event, and mutates nothing. Any
 * transition is permitted - see the header note on why the engine does not
 * adjudicate. `acquiredOnDay` is preserved, because when this holder first
 * came into contact with the secret does not change just because their
 * relationship to it did.
 */
export function transitionHolding(
    holding: SecretHolding,
    input: TransitionInput
): { holding: SecretHolding; event: SecretEvent } {
    const event: SecretEvent = {
        id: stableId('sevt', holding.secretId, holding.holderId, input.onDay, input.to),
        secretId: holding.secretId,
        holderId: holding.holderId,
        onDay: input.onDay,
        from: holding.status,
        to: input.to,
        actorId: input.actorId ?? null,
        note: input.note
    };
    return {
        holding: {
            ...holding,
            status: input.to,
            heldVersion:
                input.heldVersion === undefined ? holding.heldVersion : input.heldVersion,
            acquiredFromId: input.acquiredFromId ?? holding.acquiredFromId,
            price: input.price ?? holding.price,
            tags: input.tags ? [...input.tags] : holding.tags,
            lastChangedOnDay: input.onDay
        },
        event
    };
}

/** True when this holder has the secret in some usable form. */
export function isHolding(holding: SecretHolding): boolean {
    return HOLDING_STATUSES.includes(holding.status);
}

/** True when what this holder has is not what the secret actually is. */
export function isDistorted(holding: SecretHolding): boolean {
    return DISTORTED_STATUSES.includes(holding.status);
}

// ─────────────────────────────────────────────────────────────────────────
// THE LEDGER
// ─────────────────────────────────────────────────────────────────────────

export interface HoldingQuery {
    status?: SecretStatus;
    statuses?: readonly SecretStatus[];
    holderKind?: SecretHolderKind;
    /** Only holders who actually have it, in any of the holding statuses. */
    holdingOnly?: boolean;
    /** Only holdings acquired on or before this day. */
    asOfDay?: DayIndex;
    tags?: readonly string[];
}

/**
 * Per-holder secret state, indexed both ways.
 *
 * Mirrors the SQLite indexes in `migrations.social.ts`. The two queries that
 * matter are `holdersOf(secret)` - who could give this away - and
 * `heldBy(holder)` - what does this person have to trade. Both are O(matches).
 */
export class SecretLedger {
    private readonly holdings = new Map<string, SecretHolding>();
    private readonly bySecret = new Map<string, Set<string>>();
    private readonly byHolder = new Map<string, Set<string>>();
    private readonly events: SecretEvent[] = [];

    private static key(secretId: string, holderId: string): string {
        return `${secretId}${holderId}`;
    }

    put(holding: SecretHolding): SecretHolding {
        const key = SecretLedger.key(holding.secretId, holding.holderId);
        this.holdings.set(key, holding);
        index(this.bySecret, holding.secretId, key);
        index(this.byHolder, holding.holderId, key);
        return holding;
    }

    addEvent(event: SecretEvent): SecretEvent {
        this.events.push(event);
        return event;
    }

    /** Apply a transition and record it in one call. */
    apply(holding: SecretHolding, input: TransitionInput): SecretHolding {
        const result = transitionHolding(holding, input);
        this.addEvent(result.event);
        return this.put(result.holding);
    }

    /** One pair. Null means this holder has no recorded relationship to it. */
    statusFor(secretId: string, holderId: string): SecretHolding | null {
        return this.holdings.get(SecretLedger.key(secretId, holderId)) ?? null;
    }

    /** Everyone with a recorded position on this secret. */
    holdersOf(secretId: string, query: HoldingQuery = {}): SecretHolding[] {
        return this.resolve(this.bySecret.get(secretId), query);
    }

    /** Everything this person has a position on. */
    heldBy(holderId: string, query: HoldingQuery = {}): SecretHolding[] {
        return this.resolve(this.byHolder.get(holderId), query);
    }

    /**
     * Whether a specific holder actually has a specific secret.
     *
     * The gate the presentation layer must go through before showing anything
     * to anyone. A secret existing in the database is not the same as the
     * player having it, and this is the function that keeps those apart.
     */
    isKnownTo(secretId: string, holderId: string): boolean {
        const holding = this.statusFor(secretId, holderId);
        return holding !== null && isHolding(holding);
    }

    /** What this holder would act on: their version if distorted, else null. */
    versionHeldBy(secretId: string, holderId: string): string | null {
        return this.statusFor(secretId, holderId)?.heldVersion ?? null;
    }

    /** The full lifecycle of a secret across every holder, oldest first. */
    historyOf(secretId: string): SecretEvent[] {
        return this.events
            .filter(e => e.secretId === secretId)
            .sort((a, b) => a.onDay - b.onDay || byId(a, b));
    }

    /** The lifecycle for one holder. */
    historyFor(secretId: string, holderId: string): SecretEvent[] {
        return this.historyOf(secretId).filter(e => e.holderId === holderId);
    }

    size(): number {
        return this.holdings.size;
    }

    private resolve(keys: Iterable<string> | undefined, query: HoldingQuery): SecretHolding[] {
        if (!keys) return [];
        const out: SecretHolding[] = [];
        for (const key of keys) {
            const holding = this.holdings.get(key);
            if (!holding) continue;
            if (!matches(holding, query)) continue;
            out.push(holding);
        }
        return out.sort((a, b) => a.acquiredOnDay - b.acquiredOnDay || byId(a, b));
    }
}

function matches(holding: SecretHolding, query: HoldingQuery): boolean {
    if (query.status && holding.status !== query.status) return false;
    if (query.statuses && !query.statuses.includes(holding.status)) return false;
    if (query.holderKind && holding.holderKind !== query.holderKind) return false;
    if (query.holdingOnly && !isHolding(holding)) return false;
    if (query.asOfDay !== undefined && holding.acquiredOnDay > query.asOfDay) return false;
    if (query.tags) {
        for (const tag of query.tags) {
            if (!holding.tags.includes(tag)) return false;
        }
    }
    return true;
}

function index(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (set) set.add(value);
    else map.set(key, new Set([value]));
}
