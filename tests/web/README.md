# Played tests

`local-news-reaches-a-present-non-participant.test.ts` advances the real clock
past two scheduled NPC meetings on separate actual grounds. The player's stored
body receives the local report without attending either meeting; the remote
report stays unheard. Both the run and world seeds are pinned.

`a-fractional-seclusion-remainder-is-not-lost.test.ts` arranges the completed skip
at its question boundary. Spent and remaining time conserve the requested span,
a remainder below one day stays available, and the stopping date comes from
the already-applied run clock.

`every-executed-result-reaches-the-narrator.test.ts` checks the folded execution
boundary with actual span facts, narration composition and the output audit.
Two lived months retain both occurrences, later automatic grants are recognized,
and addressed/overheard dialogue instructions survive nested folds. Scalar-only
control arms expose the former omissions in the same run; static answers retain
their deduplication and legacy single-result fields retain their behavior.

`refining-finishes-before-it-makes-a-pill.test.ts` checks shared readiness is a read,
and scripts an interrupted cauldron span to prove no roll or consumption happened early.

`places-are-destinations.test.ts` records the owner's 2026-10-03 places ruling:
junior routes to the existing missions hall and training grounds, rank-assigned private
quarters, an exit from interiors into town, stable full-roll lodging areas, empty public
city destinations and auction-house movement without changing the calendar's city ID.
Medical, pill refining and cultivation names reuse their generated room purposes;
even the highest house rank does not pass a treasury door without its key.
It also checks night arrivals and uninvited private-door/person approaches against the
same privacy and area-presence rules, with quarter-day walking costs.

`real-travellers-have-a-road.test.ts` follows actual travellers on foot, in a paid
carriage, in an owned spirit boat and aboard a paid ship. It checks independent
departure/arrival, real company at an interruption and the remaining journey.
Its quiet control reaches the requested end. The engine companion checks route
prices/access, party legs, fuel, booked fare, hull identity and existing water.

`area-cap-walk.test.ts` checks area placement and narrator company through busy
towns, markets, compound rooms, ship decks and three years of world ticks. The
engine companion test also covers overflow, private rooms, beasts and bodies.
`area-arrivals.test.ts` adds visiting run sheets and remote presences, checks
their scene and offer rosters, and walks to visitors in overflow areas.

`makeGameInWorld` copies a freshly seeded JSON world into a private SQLite
database built from the cached schema. The key covers the harness, schema,
seeding and their imports, plus
the world seed and installed runtime. One fork builds each snapshot, then closes
its database. Every harness clears world handles and installs its own database.
World rows use the ordinary repository writer; seeded SQLite buffer copies
added native allocations to the many harnesses a played file keeps open.

Run seeds, narrators and player identities are still configured per caller.
`makeGame` keeps its schema-only setup for tests which do not pin a world.
`fresh-world-snapshot.test.ts` compares the cached world with `createWorld` and
checks that SQLite mutations, held graphs and ambient handles stay isolated.

The played deed search caches completed candidates in `tests/support/played-deed.ts`.
Its key follows the played path's sources. World and ledger assertions, plus
the hearsay readers, run again on each caller's JSON copy.

`routine-invitations.test.ts` plays company, private visits, dismissal and hourly waits
through scripted model plans. It checks the live routine and the hour derived from the run.

`capital-events-reach-play.test.ts` follows the live city auction and competition
verbs through bid, payment, possession and board settlement. It checks that an
addressed visitor receives their mission facts in the ordinary private card.
The companion census in `../engine/world/capital-missions.test.ts` uses
`soakedWorld` to measure presence, house diversity and event attendance.

The capital played tests also buy and sell finite house consignments through ordinary
market verbs. Posting tests keep relief pending until physical arrival and prove that
an ongoing tour is not filled twice; an ended tour waits through its handover day.

NPC qi storage controls run the actual world migration before writes to a copied
schema. Preview overlays do not change the disk bytes used to key makeDb's
cache. A separate saved legacy-file control uses frozen original migration and
repository code (imports alone relocated), then the current native migration,
world opening and spending authorities. Fresh DDL and repeated file reopening
distinguish nullable absence from a real exhausted pool. These controls do not
clear shared caches or author database balances through migration defaults.


