import io
p = 'src/engine/cultivation/a-qi-seal-is-put-on-a-person.ts'
s = io.open(p, encoding='utf-8').read()

old = """ * ── WHAT IT TAKES, AND WHAT IT DOES NOT ──────────────────────────────────
 *
 * It takes the ability to DRAW. Not the pool, not the ceiling on the pool, and
 * not what is already in them.
 *
 * That distinction is the owner's, stated about techniques and true here for
 * the same reason: *"your cultivation sets your qi max, and techniques expend
 * your qi - but techniques shouldn't expend your qi max."* A sealed cultivator
 * is exactly as strong as they were the moment it went on. They can still
 * spend what they are holding, and once it is gone there is no more, because
 * getting more is the one thing the seal stops.
 *
 * Which is what makes a term bite without a single number being taken away:
 * no breakthrough, no recovering what you spend, and the years going by
 * anyway. The genre's own mechanism - what a sect does to somebody it holds is
 * cut them off from the qi of heaven and earth - rather than an invention."""

new = """ * ── WHAT IT TAKES, AND WHAT IT DOES NOT ──────────────────────────────────
 *
 * Two things, and the second was a correction. It caps what they can HOLD at a
 * tenth, and it takes what they can DRAW down to almost nothing. It does not
 * touch the CEILING: *"your cultivation sets your qi max, and techniques expend
 * your qi - but techniques shouldn't expend your qi max."* The same is true of
 * a seal. Cultivation set that number and only cultivation moves it; what the
 * seal does is stop them filling it.
 *
 * A first cut left the pool alone entirely, on the reasoning that a sealed
 * cultivator is as strong as they were when it went on. The owner corrected it:
 * *"a seal gives them 10% of their qi"*, *"and it replenishes VERY slowly
 * (thanks room)"*, *"like to a cultivator a realm below they're still
 * harmless."*
 *
 * AND THE TENTH IS EXACTLY RIGHT, WHICH IS WORTH SHOWING. `maxQiForOrdinal`
 * doubles the pool at each realm, so a tenth of a realm is a FIFTH of what a
 * whole cultivator one realm below is carrying:
 *
 *   Nascent Soul       160 full     16 sealed     vs 80 at Deity's realm below
 *   Void Tribulation   640 full     64 sealed     vs 320 one realm below
 *   Immortal        10,240 full  1,024 sealed  vs 5,120 one realm below
 *
 * Harmless at every rung on the ladder, and harmless by the same ratio at all
 * of them - so one guard a realm under their prisoner is the arrangement, and
 * it is the arrangement whether the prisoner is a disciple or an ascendant.
 *
 * Which is what makes a term bite with the ceiling untouched: a tenth of a
 * pool, refilling at the rate the thinnest ground in the world allows, no
 * breakthrough, and the years going by anyway. The genre's own mechanism -
 * what a sect does to somebody it holds is cut them off from the qi of heaven
 * and earth - rather than an invention."""
assert old in s, 'header not found'
s = s.replace(old, new, 1)

anchor = """/**
 * The density to hand a skip for this person, given the ground they stand on."""
block = '''/**
 * What a sealed person can hold, off the ceiling their cultivation set.
 *
 * A tenth. The ceiling itself is untouched - `maxQiForOrdinal` still says what
 * they are, and coming off the seal gives it all back with no re-cultivating -
 * because a seal is a lid and not a wound.
 */
export function whatASealLeavesInThePool(maxQi: number): number {
    return Math.floor(Math.max(0, maxQi) * WHAT_A_SEAL_LEAVES_IN_THE_POOL);
}

/**
 * How much of their own pool a sealed person keeps.
 *
 * A tenth, and it is a ratio rather than a figure on purpose: the pool doubles
 * every realm, so a tenth stays a fifth of the realm below at every rung, and
 * the arrangement that holds an ascendant is the same arrangement that holds a
 * disciple.
 */
export const WHAT_A_SEAL_LEAVES_IN_THE_POOL = 0.1;

/**
 * The pool this person may actually hold right now.
 *
 * Applied on the way in AND on the way out: a seal laid on somebody full has to
 * take the surplus at once, and a seal that is still on has to stop them
 * climbing back over the lid however they came by it.
 */
export function whatThisPersonMayHold(input: {
    maxQi: number;
    seal: AQiSeal | null;
    onDay: number;
}): number {
    return theSealStillHolds(input.seal, input.onDay)
        ? whatASealLeavesInThePool(input.maxQi)
        : input.maxQi;
}

/**
 * The density to hand a skip for this person, given the ground they stand on.'''
assert anchor in s
s = s.replace(anchor, block, 1)

s = s.replace("""    if (held.liftsOnDay === null) {
        return 'A qi seal, with no day on it. Whatever is in them is what they have, and '
            + 'nothing is going to be added to it.';
    }
    const left = Math.max(0, Math.ceil(held.liftsOnDay - onDay));
    return `A qi seal, ${left} day${left === 1 ? '' : 's'} left on it. They can spend what `
        + 'they are holding and they cannot draw a breath of anything to replace it.';""",
"""    if (held.liftsOnDay === null) {
        return 'A qi seal, with no day on it. A tenth of what they are is all they may hold, '
            + 'and it comes back at the rate the ground allows, which is nothing worth counting.';
    }
    const left = Math.max(0, Math.ceil(held.liftsOnDay - onDay));
    return `A qi seal, ${left} day${left === 1 ? '' : 's'} left on it. A tenth of what they `
        + 'are is all they may hold, and it refills at the rate the ground allows.';""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
