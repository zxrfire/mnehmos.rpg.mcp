/**
 * The words for where a secret stands with somebody.
 *
 * WHO HOLDS A SECRET, AND IN WHAT VERSION, IS A KNOWLEDGE ROW. A per-holder
 * ledger of statuses lived here beside `knowledge.ts` and nothing ever wrote to
 * it: `knowledge_records` already carries the holder, the stance (knows,
 * believes, suspects, ignorant), how it was got (told, taken, fabricated), who
 * it came from, and a false version held with conviction. Two stores for one
 * fact would drift, so the ledger went and the vocabulary stayed, because the
 * catalog describes its secrets in it (`wanderers.ts`).
 *
 * `unknown` is storable, so "she still does not know" is a fact rather than an
 * absence. `stolen` is apart from `discovered` because somebody was robbed, and
 * `traded` because information here has a price. `falsified` and
 * `misunderstood` are holders acting on something that is not the secret.
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
