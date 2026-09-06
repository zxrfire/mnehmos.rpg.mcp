import io
p = 'src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.ts'
s = io.open(p, encoding='utf-8').read()
old = """/**
 * What a ring of this grade holds, in litres.
 *
 * The mortal one is small on purpose. The owner: *"Void Tribulation gets you
 * the smallest mortal grade one"* - so the first ring anybody can make is worth
 * having and is not the end of the problem, which is what keeps the better ones
 * worth going after. Weight is not listed because a folded space does not have
 * one: what is inside it is not being carried, and that is the whole of what a
 * ring is for.
 */
export const WHAT_A_RING_HOLDS: Readonly<Record<TechniqueGrade, number>> = {
    mortal: 125,
    earth: 1_000,
    heaven: 8_000,
    immortal: 64_000,
    chaos: 512_000
};"""
new = """/**
 * What a ring of this grade holds, in litres.
 *
 * ── CALIBRATED AGAINST A THING THAT ALREADY EXISTS ───────────────────────
 *
 * The owner: *"you can imagine a rich man just taking a spirit boat out of his
 * heaven grade storage ring."*
 *
 * So that is the measurement, and it turns out to be a rule rather than a
 * number: A RING OF A GRADE HOLDS A CONVEYANCE OF THAT GRADE. `A spirit boat`
 * in `what-a-house-moves-its-people-on.ts` is heaven grade and carries thirty
 * heads, which at `WHAT_ONE_BERTH_TAKES` is a hundred and twenty thousand
 * litres of hull - so the heaven-grade ring is set above that with room to
 * spare, and the rich man gets his boat out. The grades below fall in the same
 * relation to the conveyances of their own grade.
 *
 * That is worth more than a tuned figure because it stays true. Repricing a
 * conveyance moves what a ring has to hold, and the reason the ring is that big
 * is a sentence anybody can check rather than a constant somebody once picked.
 *
 * THE MORTAL ONE IS SMALL ON PURPOSE. *"Void Tribulation gets you the smallest
 * mortal grade one"* - the first ring anybody in the world can make is worth
 * having and is not the end of the problem, which is what keeps the better ones
 * worth going after.
 *
 * Weight is not on this table because a folded space does not have one. What is
 * inside a ring is not being carried, and that is the whole of what a ring is
 * for - see `whatSomebodyCanCarryInAll`.
 */
export const WHAT_A_RING_HOLDS: Readonly<Record<TechniqueGrade, number>> = {
    // A travelling chest. Everything a person owns, and not a cart.
    mortal: 200,
    // A cart and what is on it.
    earth: 4_000,
    // A spirit boat, and the reason to want one.
    heaven: 160_000,
    immortal: 4_000_000,
    chaos: 100_000_000
};

/**
 * Litres of hull one berth on a conveyance amounts to.
 *
 * A person, their gear, and the share of deck, hull and rail that carries them.
 * Used to say how big a conveyance is without putting a volume on every row of
 * a catalog that has never needed one.
 */
export const WHAT_ONE_BERTH_TAKES = 4_000;

/** How much room a conveyance of this many heads takes up, folded or not. */
export function howBigAConveyanceIs(heads: number): number {
    return Math.max(1, Math.round(heads)) * WHAT_ONE_BERTH_TAKES;
}"""
assert old in s
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('ok')
