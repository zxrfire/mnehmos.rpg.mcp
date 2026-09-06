import io
p = 'src/engine/world/possessions.ts'
s = io.open(p, encoding='utf-8').read()
old = """    power: number | null;

    /** Where it currently is, when it is not on a person. */
    locationId: string | null;"""
new = """    power: number | null;

    /**
     * HOW MUCH ROOM IT TAKES AND WHAT IT WEIGHS.
     *
     * The design owner: *"objects have volume and weight"*, *"how much you can
     * carry is limited by volume and weight by cultivation level."*
     *
     * Litres and kilograms, on every object in the world, because the two bind
     * differently and a single "encumbrance" number would hide the interesting
     * half: a purse of spirit stones is heavy and small, a bundle of dried
     * herbs is light and enormous, and which of them stops you is a different
     * problem with a different answer. See
     * `what-a-body-can-carry-and-what-a-ring-holds.ts`.
     *
     * Defaulted rather than optional, so nothing anywhere has to handle an
     * object that does not take up space. A row nobody has measured is a small
     * carried thing, which is what the overwhelming majority of them are.
     */
    volume: number;
    weight: number;

    /** Where it currently is, when it is not on a person. */
    locationId: string | null;"""
assert old in s
s = s.replace(old, new)

old2 = """        ownerName: '',
        claims: [],
        provenance: [],
        knownOwnershipBy: [],
        locationId: null,
        tags: [],
        data: {},
        nextClaimSeq: 1,
        ...init
    };"""
new2 = """        ownerName: '',
        claims: [],
        provenance: [],
        knownOwnershipBy: [],
        // A thing somebody carries in one hand. The commonest object in the
        // world, and the right default for a row nobody has measured.
        volume: WHAT_A_CARRIED_THING_TAKES,
        weight: WHAT_A_CARRIED_THING_WEIGHS,
        locationId: null,
        tags: [],
        data: {},
        nextClaimSeq: 1,
        ...init
    };"""
assert old2 in s
s = s.replace(old2, new2)

s = s.replace("""/**
 * A lot of a fungible resource with a story attached.
 */""",
"""/** Litres a thing takes up when nobody has said. A sword, a book, a jar. */
export const WHAT_A_CARRIED_THING_TAKES = 2;

/** Kilos the same thing weighs. */
export const WHAT_A_CARRIED_THING_WEIGHS = 1.5;

/**
 * A lot of a fungible resource with a story attached.
 */""")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
