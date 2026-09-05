/**
 * Secrets: a lifecycle, and who is holding each one.
 */

import { byId, stableId, type DayIndex } from './common.js';

/**
 * Where a secret stands with respect to one holder. `unknown` is storable, so "she
 * still does not know" is a dated fact rather than an absence. `stolen` is apart
 * from `discovered` because somebody was robbed, and `traded` because information
 * here has a price. `suppressed` is having had it and been forced back down.
 * `falsified` and `misunderstood` are why `heldVersion` exists: those holders are
 * acting on something that is not the secret.
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
 * One (secret, holder) pair. `heldVersion` is null when the holder has the
 * secret as it really is; set, it is what they act on, kept apart so a
 * falsified secret can be sold onward, believed, and later found wrong.
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
 * An append-only transition. The history is the valuable part: a secret now
 * `suppressed` that was `leaked` for two years in between is a different
 * problem from one never out, and only the log can tell them apart.
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
 * Move a holding to a new status and emit the log entry, mutating nothing. Any
 * transition is permitted; see the header. `acquiredOnDay` is preserved,
 * because when this holder first met the secret does not change when their
 * relationship to it does.
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
 * Per-holder secret state, indexed both ways. Mirrors the SQLite indexes in
 * `migrations.social.ts`. The two queries that matter are `holdersOf` - who
 * could give this away - and `heldBy` - what this person has to trade.
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
     * The gate the presentation layer must go through before showing anything
     * to anybody: a secret existing in the database is not the player having it.
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
