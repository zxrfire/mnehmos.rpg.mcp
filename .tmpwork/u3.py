import io

# ── 1. the soul search's threshold becomes the shared one ───────────────
p = 'src/engine/social/what-a-soul-search-takes.ts'
s = io.open(p, encoding='utf-8').read()
old = """const OPENS_WITHOUT_FORCING_AT = 3;"""
new = """export const OPENS_WITHOUT_FORCING_AT = 3;"""
assert old in s, 'threshold not found'
s = s.replace(old, new, 1)
s = s.replace(""" * The gap at which a search stops being a forcing. Below it the reader gets in
 * by tearing; at or above it nothing is contested because nothing had to be
 * overcome. The same number decides how much comes across AND what it costs
 * them, deliberately: two tables over one gap is how they start disagreeing.
 */""",
""" * The gap at which a search stops being a forcing. Below it the reader gets in
 * by tearing; at or above it nothing is contested because nothing had to be
 * overcome. The same number decides how much comes across AND what it costs
 * them, deliberately: two tables over one gap is how they start disagreeing.
 *
 * EXPORTED, because breaking a qi seal asks the identical question and the
 * design owner said so: *"breaking a seal at a significantly high enough realm
 * up is 100%, same for a soul search. A false immortal would never fail to
 * break a void tribulation seal."* Two constants both spelled 3 is how they
 * start disagreeing, so there is one and `what-laying-a-qi-seal-takes.ts`
 * reads it.
 */""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. the seal reads it, and the caster learns of a break ──────────────
p2 = 'src/engine/social/what-laying-a-qi-seal-takes.ts'
s2 = io.open(p2, encoding='utf-8').read()

s2 = s2.replace("""import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';""",
"""import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { OPENS_WITHOUT_FORCING_AT } from './what-a-soul-search-takes.js';""")

s2 = s2.replace("""export function oddsOfBreakingASeal(realmGapOverTheCaster: number): number {
    if (realmGapOverTheCaster <= 0) return 0;
    if (realmGapOverTheCaster === 1) return 0.2;
    if (realmGapOverTheCaster === 2) return 0.6;
    return 1;
}""",
"""export function oddsOfBreakingASeal(realmGapOverTheCaster: number): number {
    if (realmGapOverTheCaster <= 0) return 0;
    // AT OR ABOVE THE SEARCH'S OWN THRESHOLD IT IS NOT A CONTEST. The owner:
    // *"a false immortal would never fail to break a void tribulation seal."*
    // Read off `OPENS_WITHOUT_FORCING_AT` rather than spelled again here - the
    // soul search is the same question about the same ladder, and two
    // constants both spelled 3 is how they start disagreeing.
    if (realmGapOverTheCaster >= OPENS_WITHOUT_FORCING_AT) return 1;
    if (realmGapOverTheCaster === 1) return 0.2;
    return 0.6;
}""")

s2 = s2.replace("""    readonly realmGapOverTheCaster: number;
    readonly line: string;
}""",
"""    readonly realmGapOverTheCaster: number;
    /**
     * WHETHER THE HAND THAT LAID IT FINDS OUT, AND IT ALWAYS DOES.
     *
     * The design owner: *"if you break the seal, just as if you broke a
     * formation, the caster knows (see life plates for a similar mechanic)."*
     *
     * A seal is the caster's own work held shut by their own strength, so it
     * going is something that happens TO THEM, wherever they are standing. The
     * genre's jade plate that cracks on a mountain the moment a disciple dies
     * a province away is the same object seen from the other end.
     *
     * True only for a break. A seal the caster lifts themselves is not news to
     * them, and a break that failed is not news to anybody - which is the whole
     * reason somebody would try and fail quietly rather than not try.
     *
     * The value is a FACT and not a write. Who gets told, and through what, is
     * the caller's - this function is pure like the search it is built on.
     */
    readonly theCasterKnows: boolean;
    readonly line: string;
}""")

s2 = s2.replace("""            return {
                lifted: false,
                odds: 0,
                realmGapOverTheCaster,
                line: 'Not the hand that laid it. Nothing happened.'
            };""",
"""            return {
                lifted: false,
                odds: 0,
                realmGapOverTheCaster,
                theCasterKnows: false,
                line: 'Not the hand that laid it. Nothing happened.'
            };""")
s2 = s2.replace("""        return {
            lifted: true,
            odds: 1,
            realmGapOverTheCaster,
            line: 'Lifted by the hand that laid it.'
        };""",
"""        return {
            lifted: true,
            odds: 1,
            realmGapOverTheCaster,
            // Not news to somebody who did it.
            theCasterKnows: false,
            line: 'Lifted by the hand that laid it.'
        };""")
s2 = s2.replace("""    const odds = oddsOfBreakingASeal(realmGapOverTheCaster);
    return {
        lifted: odds >= 1,
        odds,
        realmGapOverTheCaster,
        line: odds === 0""",
"""    const odds = oddsOfBreakingASeal(realmGapOverTheCaster);
    return {
        lifted: odds >= 1,
        odds,
        realmGapOverTheCaster,
        // Anything that can break it tells them it broke. A failed attempt
        // tells nobody, which is why quietly trying is a thing somebody does.
        theCasterKnows: odds > 0,
        line: odds === 0""")
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
