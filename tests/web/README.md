# Played tests

`an-arranged-tie-is-known-in-conversation.test.ts` plays an ADMIN sworn sibling
and greeting through a scripted provider. The real tie, recognition and speaker
card determine whether its scripted reply is familiar. Close, friendly and
hostile controls also read both ends without writing extra knowledge records.

`player-rulings.test.ts` separates the player rendering from the inspector and
private narrator material. It checks ids, routine names and calibration language
on played reads, while requiring the structural account to remain inspectable.

`narration-keeps-resolved-facts.test.ts` captures the ProviderNarrator user card
with scripted replies: purchase versus quote, learned arts, player identity,
present people and current state over previous prose. It proves the supplied
facts and instructions, not universal model compliance.

The focused issuing test plays `I leave the sect` through the real turn handler
and checks the same-turn roll removal, returned robes, cancelled token and gate
access. Departure mechanics are held by `tests/engine/world/leaving-a-house.test.ts`;
the two certification files have small roll-change and unreachable-course
reproductions that require no aged world.

The direct harness yields to I/O before each new life and action. A real HTTP
caller already has that boundary; long in-process promise chains otherwise
starve Vitest's RPC acknowledgements and leave assertions unreported. The
refusal probe also yields between its independently restored requests. This
changes no engine clock, result, assertion or timeout.

Witness-account controls use a real reciprocal ally tie to the victim when a
demand for an account is their precondition. Alignment alone is a weighted
decision. Belief, contradiction, suspicion and the unchanged deed still use
the ordinary witness authorities; unrelated witnesses retain their own choice.

`local-news-reaches-a-present-non-participant.test.ts` advances the real clock
past two scheduled NPC meetings on separate actual grounds. The player's stored
body receives the local report without attending either meeting; the remote
report stays unheard. Both the run and world seeds are pinned.

`a-fractional-seclusion-remainder-is-not-lost.test.ts` arranges the completed skip
at its question boundary. Spent and remaining time conserve the requested span,
a remainder below one day stays available, and the stopping date comes from
the already-applied run clock.

The private-business player controls pin both the run and its world and use
their own databases. `a-player-joins-a-private-venture.test.ts` covers explicit
invitation answers, an actual auction visit, expiry, reached-ground leaving and
the elder/equal custody paths. Removing only the physical-pickup hook makes its
two custody cases fail; the current source is restored byte for byte afterward.
`private-work-with-a-person.test.ts` covers deferred stones/pill/favour wages,
actual harvest delivery, failure, nonpayment and an ordinarily released word.
`private-road-protection.test.ts` requires real joint arrival, retained cargo
custody and failure when the SQL guard leaves its admitted party.

`swearing-brotherhood-with-a-person.test.ts` keeps human silence distinct from
consent, reads an existing ordinary favour, writes reciprocal serious words and
kin edges, and routes player party formation through ordinary company consent.
`a-private-party-hunts-with-the-player.test.ts` samples four bounded worlds:
actual member votes can overrule the human, while an agreed hunt enters the
shared fight with its actual native beast and closes through that fight's result.
No vote or winner is forced. These are native/scripted played behaviour checks,
not acceptance of live-model prose.

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
