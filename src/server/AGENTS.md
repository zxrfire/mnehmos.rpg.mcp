# MCP server instructions

Read [README.md](README.md) and the affected consolidated/state/transport README.
New tools are action-routed: one tool with an `action` discriminator, fuzzy matching
and guiding errors. Follow `consolidated/character-manage.ts`, registering in
`consolidated/index.ts` with only the minimal addition to that shared registry.
SQL remains owned by [storage repositories](../storage/AGENTS.md).

## Days a handler spends are days the world spends

Maintain `world.currentDay === thisRun.startedOnDay + floor(run.elapsedDays)`.
`repos.runs.advanceDays` alone loses the observer, knowledge, memory and digest when
unobserved catch-up fills the gap. A handler spending days passes that span to
`theseDaysPassedInTheWorldToo` after its transaction commits. The advance is async:
never put its await inside a SQLite transaction. Existing prepared synchronous spans
retain their own [web transaction contract](../web/README.md).
`tests/web/the-two-clocks-are-one-clock.test.ts` holds the invariant.
