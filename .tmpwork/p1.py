import io
p = 'src/engine/world/possessions.ts'
s = io.open(p, encoding='utf-8').read()
old = "    | 'gifted'\n    | 'crafted'"
new = """    | 'gifted'
    /**
     * Handed over, and not handed away.
     *
     * The design owner: *"there does need a distinction between borrowing and
     * stealing."* Without this row there was none. A house furnace in a
     * disciple's hands and a house furnace somebody walked off with are the
     * same two fields - `ownerId` a house, `possessorId` a person - and the
     * only thing that could ever tell them apart is whether the house handed
     * it over. That is a fact about an EVENT, so it belongs on the chain of
     * events rather than on the object.
     *
     * Distinct from `gifted` and `awarded`, which MOVE the ownership. A lent
     * thing is still the house's, which is the whole point of it.
     */
    | 'lent'
    | 'crafted'"""
assert old in s
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
print('possessions ok')
