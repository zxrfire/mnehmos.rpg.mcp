<!-- tier: 3 -->

# Beast contracts

A speaking beast is a party to an agreement. Both parties must stand on the
agreed ground, and a third living person must witness their oath. Consent is
an engine draw moved by the offered share, their relationship, and the beast's
open-handedness. A conversation about terms creates no agreement.

"I make a beast cultivation contract with NAME sharing 25% of my qi" offers
an agreement; omitting the share offers a quarter. Shares must leave both
parties something: strictly between zero and one hundred percent. Each party
may hold one cultivation agreement at a time. The oath, including its terms,
is held once in the world's obligation ledger.

The agreed share leaves the cultivator's draw automatically during actual
cultivation, including closed-door seclusion. Time spent waiting or travelling
shares nothing for the player. NPC cultivators share in the world's yearly
pass. The beast receives cultivation days on its own road; these are stored on
its person as `bondedCultivationDays` and enter the ordinary beast climb.
They survive a restart and remain earned after the agreement ends.

The agreement lasts on its stated ground until either party enters a major
realm above the higher party's realm at signing. Losing that ground, outgrowing
the terms, or either party's death releases both without a penalty. The player
may say "I end my beast cultivation contract with NAME"; the beast may also end
it during the yearly pass. Leaving before the terms expire closes the oath and
opens a serious `broken_oath` account held by the other party. NPCs can form
witnessed agreements with their local allies through the same engine function.

Live questions about the arrangement use `THE_CONTRACT`. Hearing its terms
does not create a bond or change anybody's cultivation rate.

Implementation: `src/engine/world/beast-cultivation-contracts.ts`; played checks:
`tests/web/cultivation-agreements-reach-play.test.ts`.
