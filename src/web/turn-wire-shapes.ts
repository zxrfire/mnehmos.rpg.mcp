/**
 * The shapes the web front door hands out, and the refusal it throws.
 *
 * Everything here crosses a boundary. `StateView`, `ActResult`,
 * `CultivateResult` and `BreakthroughApiResult` are what the browser reads off
 * an endpoint; `ToolCallRecord` is the inspector's row; `GameServiceOptions` is
 * what a caller hands the service; `GameError` is a refusal with an HTTP status
 * on it. `Execution` is the one that does not leave the process - it is what a
 * verb hands back to the turn pipeline before anything is narrated - and it is
 * here because every verb family in this package returns one.
 *
 * Split out of `game.ts` unchanged. The reason to change this file is that the
 * contract between the service and the browser moved; nothing else in the turn
 * should be able to drag it.
 */
import type Database from 'better-sqlite3';

import type {
    AmbientQi,
    BreakthroughResult,
    Cultivator,
    SimEvent,
    TimeSkipResult
} from '../schema/cultivation.js';
import type { TollLedgerEntry } from '../server/consolidated/cultivation-support.js';
import type { PlanSource } from './actions.js';
import type { CrossroadsView } from './choosing-what-to-do-when-a-seclusion-is-broken.js';
import type { EngineFacts } from './facts.js';
import type { FightView } from './fight-answers.js';
import type { Hearing } from './hearsay.js';
import type { LogEntry } from './log.js';
import type { Narrator } from './narrator.js';
import type { DerivedView, RunView } from './view.js';

export class GameError extends Error {
    constructor(message: string, readonly status = 400) {
        super(message);
        this.name = 'GameError';
    }
}

export interface StateView {
    run: RunView;
    cultivator: Cultivator;
    ambient: AmbientQi;
    derived: DerivedView;
    /** Everything the crossings have cut away from this cultivator, oldest first. */
    tolls: TollLedgerEntry[];
    log: LogEntry[];
    /**
     * A seclusion the engine stopped and has NOT resolved, waiting on an answer.
     *
     * Null on every ordinary turn. When it is set, the run is standing at a
     * fork the engine deliberately did not take: somebody broke a long sitting
     * and the two things that were always physically available - go, or sit
     * back down - are both still open. See
     * `choosing-what-to-do-when-a-seclusion-is-broken.ts`.
     *
     * The client renders two controls off this. It is emphatically not a modal
     * jail: free text is still the whole game, and anything that is not sitting
     * back down is going.
     */
    crossroads: CrossroadsView | null;
    /**
     * The fight, when one is standing. Same shape and same rules as the fork
     * above: the client draws controls off it, and free text is still the whole
     * game. Re-checked against this run and this body on every read.
     */
    fight: FightView | null;
}

/**
 * One step the engine actually took, for the client's inspector.
 *
 * This list is the visible proof of the project's central claim. A player who
 * suspects the narration of flattering them can open it and read the engine's
 * own one-line account of every routine that ran - `summary` is always sourced
 * from facts.ts or from a `SimEvent.summary`, never from narrator prose.
 */
export interface ToolCallRecord {
    /** The engine routine or repository call that ran. */
    name: string;
    /** What it was doing: the player-facing verb, or the kind of ruling. */
    action: string;
    /** The engine's factual one-liner. Never narration. */
    summary: string;
    /** False when the engine declined to act - an ineligible attempt, a refusal. */
    ok: boolean;
    /** Present on the routing step: whether the model or the parser chose. */
    source?: PlanSource;
    /** Present when a fallback ran, saying why. */
    note?: string;
}

export interface ActResult {
    narration: string;
    events: SimEvent[];
    toolCalls: ToolCallRecord[];
    state: StateView;
}

export interface CultivateResult {
    timeSkip: TimeSkipResult;
    state: StateView;
    /**
     * EVERYTHING that happened in the span, merged and in order.
     *
     * `timeSkip.events` is only the cultivation engine's half. `runSeclusion`
     * merges the encounter layer's occurrences into `Execution.events`, and
     * only `act` was returning those - so a player who clicked the seclusion
     * button in the GUI saw NO ENCOUNTERS AT ALL, while the same build reached
     * through the typed endpoint produced 1.63 summonses a sect life and made
     * `npc_event` the commonest event kind in the game. One design, two front
     * doors, and the door with a button on it was showing half the world.
     *
     * Measured as zero summonses across 200 lives on this endpoint against
     * 1.63 per sect life on the other, on the same build.
     */
    events: SimEvent[];
    /**
     * Why the span stopped short, when it did.
     *
     * Provisions ran out, a wound opened, something walked in. No endpoint
     * returned it, so "the ten years you asked for were three" arrived with no
     * reason attached.
     */
    interruptReason: string | null;
    /**
     * The same prose a typed command would have produced.
     *
     * This was always being written - narrated, and appended to the log -
     * and then dropped on the floor before the response was built, so a
     * player who clicked got a table of deltas and a player who typed got
     * the game. One design, two front doors, and only one of them had it.
     */
    narration: string;
}

export interface BreakthroughApiResult {
    result: BreakthroughResult;
    state: StateView;
    /** As above: the click path narrates the same way the typed path does. */
    narration: string;
}

export interface GameServiceOptions {
    db: Database.Database;
    narrator: Narrator;
    /**
     * Whether the world advances alongside the cultivator.
     *
     * The world itself is owned by `src/server/state/cultivation-world.ts` and
     * is addressed by run, not held here. This flag exists only so a test can
     * run the cultivation engine on its own without paying to seed several
     * hundred people it is not asserting anything about.
     */
    worldEnabled?: boolean;
    adminMode?: boolean;
    /** Injectable for tests that need a reproducible run. */
    seedFactory?: () => string;
}

/** What an action did, before it is narrated. */
export interface Execution {
    facts: EngineFacts;
    events: SimEvent[];
    timeSkip: TimeSkipResult | null;
    breakthrough: BreakthroughResult | null;
    outcome: 'executed' | 'refused';
    /** Every engine call this action made, in the order it made them. */
    calls: ToolCallRecord[];
    /**
     * A name somebody said in this scene, decided and recorded by the engine.
     *
     * Carried on the execution rather than fetched during narration so that the
     * knowledge record is written in phase 2, where writes belong, and phase 3
     * only ever receives a licence to mention what is already true.
     */
    hearing?: Hearing | null;
}
