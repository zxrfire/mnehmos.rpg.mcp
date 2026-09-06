import io
p = 'src/engine/social/what-laying-a-qi-seal-takes.ts'
s = io.open(p, encoding='utf-8').read()

s += '''
// ═════════════════════════════════════════════════════════════════════════
// AND TAKING ONE OFF AGAIN
// ═════════════════════════════════════════════════════════════════════════

/**
 * The two ways a seal comes off.
 *
 * The design owner: *"seals can be removed - 1. by the one who casted it, 2.
 * broken through force of arms by someone significantly stronger than the
 * castor, with odds"*, and *"for 2 reference the soul search table."*
 *
 * There is no third. Nothing lifts on its own that has no day on it, no pill
 * dissolves one, and the subject cannot take their own off however strong they
 * become - which is what makes a seal with no day the thing it is.
 */
export type HowASealComesOff =
    /** The hand that laid it. No contest: it is theirs to close and to open. */
    | 'the_hand_that_laid_it'
    /** Somebody strong enough to break it off them. Contested, with odds. */
    | 'force_of_arms';

export interface BreakingASeal {
    readonly lifted: boolean;
    /**
     * The chance it comes off, 0..1, for the caller to roll against.
     *
     * PURE, like `whatASoulSearchTakes`: state in, odds out, with no roll in
     * here. One is certainty and the caller may skip the roll; zero is a wall
     * and the caller must not roll at all.
     */
    readonly odds: number;
    /** Major realms the breaker stands over THE HAND THAT LAID IT. */
    readonly realmGapOverTheCaster: number;
    readonly line: string;
}

/**
 * What breaking a seal takes.
 *
 * ── MEASURED AGAINST THE CASTER, NOT THE PRISONER ────────────────────────
 *
 * The seal is the caster's work and it is the caster's strength holding it
 * shut. Who is inside it has nothing to do with whether somebody else can tear
 * it open - a sealed ascendant and a sealed disciple are behind the same door,
 * and the door is as strong as whoever hung it.
 *
 * That is also why a prisoner cannot free themselves by growing: a seal caps
 * what they can hold at a tenth, so they are not going to out-grow the elder
 * who laid it from inside it. Somebody has to come and do it for them.
 *
 * ── THE TABLE IS THE SOUL SEARCH'S, TURNED INTO ODDS ─────────────────────
 *
 * `howMuchOpens` there walks the same realm gap: nothing at or below zero, a
 * little at one, half at two, everything at three. This is that shape with a
 * probability where the haul was, because a soul search is a reading and this
 * is a fight - the gap says how likely, and the caller rolls it.
 */
export function whatBreakingASealTakes(input: {
    how: HowASealComesOff;
    /** The ordinal of whoever is trying. Ignored for the hand that laid it. */
    breakerOrdinal: number;
    /** The ordinal the seal was laid at. */
    casterOrdinal: number;
    /** True where the breaker IS the caster, which the caller resolves by id. */
    isTheCaster: boolean;
}): BreakingASeal {
    const realmGapOverTheCaster = realmsBetween(input.breakerOrdinal, input.casterOrdinal);

    if (input.how === 'the_hand_that_laid_it') {
        // Theirs to close and theirs to open, and no roll: a house that cannot
        // release its own prisoner has not sealed one, it has lost one.
        if (!input.isTheCaster) {
            return {
                lifted: false,
                odds: 0,
                realmGapOverTheCaster,
                line: 'Not the hand that laid it. Nothing happened.'
            };
        }
        return {
            lifted: true,
            odds: 1,
            realmGapOverTheCaster,
            line: 'Lifted by the hand that laid it.'
        };
    }

    const odds = oddsOfBreakingASeal(realmGapOverTheCaster);
    return {
        lifted: odds >= 1,
        odds,
        realmGapOverTheCaster,
        line: odds === 0
            ? `Realm gap ${realmGapOverTheCaster} over the caster: nothing to break it with.`
            : `Realm gap ${realmGapOverTheCaster} over the caster: ${Math.round(odds * 100)} in a `
                + 'hundred, and the caller rolls it.'
    };
}

/**
 * The chance force of arms takes a seal off, by realms over the caster.
 *
 * SIGNIFICANTLY STRONGER, which the owner said and which the table says as a
 * shape: an equal cannot touch it at all, one realm up is a long shot worth
 * trying, two is better than even, and three is a wall coming down. The same
 * four steps the soul search walks, because it is the same question - how much
 * more of you is there than of the thing you are pushing against.
 */
export function oddsOfBreakingASeal(realmGapOverTheCaster: number): number {
    if (realmGapOverTheCaster <= 0) return 0;
    if (realmGapOverTheCaster === 1) return 0.2;
    if (realmGapOverTheCaster === 2) return 0.6;
    return 1;
}
'''
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
