import io

p = 'src/web/apply.ts'
s = io.open(p, encoding='utf-8').read()

# ── the header records what the two paths disagreed about ───────────────
s = s.replace(""" * This module owns only the ordering and the transaction.
 */""",
""" * This module owns only the ordering and the transaction.
 *
 * ── AND THE THREE WRITES THE PLAY LOOP WAS NOT MAKING ────────────────────
 *
 * The tool path at `cultivation-manage.ts` was a second copy of this function,
 * and the copies had drifted in exactly three load-bearing ways. Everything a
 * player did through the command bar went down one write short of everything
 * the same action did through the tool:
 *
 *   persistImmortalStatus  A skip can resolve the last crossing.
 *                          `migrations.cultivation.ts` says that column is what
 *                          enforces the Lid bar - a `false_immortal` is what
 *                          bars every further attempt - so a played life that
 *                          crossed could cross AGAIN. The Lid opened twice.
 *   persistVisions         Beliefs with no fact behind them, computed by the
 *                          engine and discarded by the play loop.
 *   recordRankGained       The peak-rank ledger row, so a played life's peak
 *                          survived its later decline only on the tool path.
 *
 * The injuries too: the copy wrote `id`, `cultivationPenalty`,
 * `breakthroughPenalty` and `treated`, and this one dropped all four, so a
 * played wound came back with the engine's penalties gone.
 *
 * They are here now, which is a BEHAVIOUR CHANGE and not a tidy-up: the play
 * loop starts enforcing a bar it has never enforced.
 */""", 1)

s = s.replace("""import {
    persistFoundation,
    persistToll,
    persistUnderstanding,
    skipEndState,
    type CultivationRepos
} from '../server/consolidated/cultivation-support.js';""",
"""import {
    persistFoundation,
    persistImmortalStatus,
    persistToll,
    persistUnderstanding,
    persistVisions,
    recordRankGained,
    skipEndState,
    type CultivationRepos
} from '../server/consolidated/cultivation-support.js';""", 1)

# ── the injury write, whole ─────────────────────────────────────────────
s = s.replace("""            repos.cultivators.addInjury(before.id, {
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn,
                // What the wound is called. The engine mints it and this layer
                // used to drop it, so every wound a player carried read
                // `woundType: null` and nothing could name it.
                woundType: injury.woundType
            });""",
"""            repos.cultivators.addInjury(before.id, {
                // The engine's own record, whole. Its id, its name and its two
                // penalties were all being dropped here and written on the tool
                // path, so one wound meant two different things depending on
                // which door the player came through.
                id: injury.id,
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn,
                woundType: injury.woundType,
                cultivationPenalty: injury.cultivationPenalty,
                breakthroughPenalty: injury.breakthroughPenalty,
                treated: injury.treated
            });""", 1)

# ── the crossing that must not be forgotten ─────────────────────────────
s = s.replace("""        if (skip.foundationEstablished) {
            persistFoundation(repos, before.id, skip.foundationEstablished);
        }""",
"""        if (skip.foundationEstablished) {
            persistFoundation(repos, before.id, skip.foundationEstablished);
        }

        // THE LID. A skip can resolve the last crossing, and the ordinal does
        // not encode the result. `immortal_status` is what bars every further
        // attempt; without this write a played life that crossed could cross
        // again.
        if (skip.immortalStatusGained) {
            persistImmortalStatus(repos, before.id, skip.immortalStatusGained);
        }""", 1)

# ── the rank ledger and the visions ─────────────────────────────────────
s = s.replace("""        repos.runs.advanceDays(run.id, skip.simulatedDays);
        repos.runs.incrementTurn(run.id, 1);

        if (skip.died && skip.deathCause) {""",
"""        repos.runs.advanceDays(run.id, skip.simulatedDays);
        repos.runs.incrementTurn(run.id, 1);

        // The peak survives the decline, and the death. Stamped at the moment
        // the rank is reached, which is here.
        if (ranksGained > 0) recordRankGained(repos.db, before.id, nextTurn, ranksGained);

        if (skip.died && skip.deathCause) {""", 1)

s = s.replace("""        understanding = persistUnderstanding(
            repos, before.id, skip.insightsGained, skip.achievements
        );""",
"""        understanding = persistUnderstanding(
            repos, before.id, skip.insightsGained, skip.achievements
        );
        // Beliefs with no fact behind them. They go to the knowledge layer and
        // never to the cultivator's capability.
        persistVisions(repos.db, skip.visions);""", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('folded')
