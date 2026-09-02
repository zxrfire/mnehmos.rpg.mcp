/**
 * Local Mode and AI Mode, said out loud.
 *
 * With no provider configured this game is fully playable: the intent parser
 * reads the sentence, the engine rules on it, and `facts.ts` writes the prose
 * itself. Every one of the thirty-eight verbs is reachable that way, and the
 * engine's own account of what happened is not a template - it is the same
 * account a configured narrator is handed and asked to dress.
 *
 * What was missing was not the capability. It was the sentence saying so.
 * A player with no key saw a status bar reading `narrator anthropic/claude-
 * opus-5 (not configured)`, which is a diagnostic about a missing environment
 * variable, and reads like something is broken. Nothing is broken. The
 * difference between the two modes is the writing, and the design owner's
 * ruling is that it should be an explicit mode rather than a silent
 * degradation:
 *
 *     "Local Mode - AI narration unavailable. Game mechanics remain fully
 *      playable."
 *
 * ── WHY BOTH DIRECTIONS ARE ANNOUNCED ────────────────────────────────────
 *
 * A line that only ever appears when something is absent is an apology. The
 * mode is stated in both directions, so what the player reads is which of two
 * ways of playing they are in, not whether they have failed to configure
 * something. A key present is a fact about the prose and nothing else - the
 * engine rules the same way on the same seed either way, which is the claim
 * the AI-mode line is careful to make.
 */

import type { Narrator } from './narrator.js';

export type PlayMode = 'local' | 'ai';

export interface ModeAnnouncement {
    mode: PlayMode;
    /** The short name, for a status bar. */
    label: string;
    /** The honest sentence, for the log the player reads on their first turn. */
    line: string;
}

/**
 * Which mode a narrator puts this session in.
 *
 * Read off the narrator that was actually built rather than off configuration,
 * so it cannot disagree with what is running. `buildNarrator` returns the
 * deterministic one whenever a provider could not be constructed, which is the
 * same condition by a shorter route - and if that ever changes, this follows
 * it without being edited.
 */
export function announceMode(narrator: Pick<Narrator, 'kind' | 'providerName'>): ModeAnnouncement {
    if (narrator.kind === 'deterministic') {
        return {
            mode: 'local',
            label: 'Local Mode',
            line:
                'Local Mode - no narrator model is configured, so the engine writes its own '
                + 'account of what happens. Every action, every verb and every outcome is '
                + 'fully playable; what a model would add is the prose, not the game.'
        };
    }

    return {
        mode: 'ai',
        label: 'AI Mode',
        line:
            `AI Mode - ${narrator.providerName ?? 'a model'} is narrating. It reads your `
            + 'sentence to pick which action you meant, and describes what the engine '
            + 'decided afterwards. It never decides an outcome, and the same seed rules '
            + 'the same way with it as without it.'
    };
}
