import io
p = 'src/engine/world/a-house-holds-its-own.ts'
s = io.open(p, encoding='utf-8').read()

old = """export type WhoseThisIs =
    /** Theirs outright. However it got there, nobody can simply want it back. */
    | 'their_own'
    /** A house owns it and somebody else is holding it. It can be called in. */
    | 'lent_by_their_house'
    /** A house owns it and nobody has it out. */
    | 'in_a_treasury';

export function whoseThisIs(input: {
    /** The object's `ownerId`. Null is a real answer: nobody's. */
    ownerId: string | null;
    /** The object's `possessorId`. Null where it is in the ground or lost. */
    possessorId: string | null;
    /** Which ids name houses rather than people. */
    houseIds: ReadonlySet<string>;
}): WhoseThisIs {
    const { ownerId, possessorId, houseIds } = input;
    // Nobody's, or a person's. Either way no house has a call on it, and a
    // bestowed thing is exactly this: the house is no longer in the field.
    if (ownerId === null || !houseIds.has(ownerId)) return 'their_own';
    if (possessorId === null || possessorId === ownerId) return 'in_a_treasury';
    return 'lent_by_their_house';
}"""

new = """export type WhoseThisIs =
    /** Theirs outright. However it got there, nobody can simply want it back. */
    | 'their_own'
    /** A house owns it and nobody has it out. */
    | 'in_a_treasury'
    /** A house owns it, somebody else holds it, and the house handed it over. */
    | 'lent_by_their_house'
    /** A house owns it, somebody else holds it, and the house did not. */
    | 'taken_from_their_house'
    /**
     * A house owns it, somebody else holds it, and nothing on the record says
     * how it got there.
     *
     * NOT A SHRUG AND NOT A THIRD GUESS. The design owner: *"there does need a
     * distinction between borrowing and stealing."* There does - and the
     * engine does not get to invent one it cannot show. An object whose chain
     * says nothing is not evidence of a theft and is not proof of a loan; it
     * is the exact state that makes a quartermaster start asking, which is a
     * more useful thing for the world to be able to say than either guess.
     */
    | 'unaccounted_for';

export function whoseThisIs(input: {
    /** The object's `ownerId`. Null is a real answer: nobody's. */
    ownerId: string | null;
    /** The object's `possessorId`. Null where it is in the ground or lost. */
    possessorId: string | null;
    /** Which ids name houses rather than people. */
    houseIds: ReadonlySet<string>;
    /**
     * The object's `provenance`, oldest first, as `possessions.ts` keeps it.
     *
     * THE CHAIN AND NOT A FIELD ON THE ROW. Whether this was lent or taken is
     * a fact about an EVENT. A field would have to be maintained by every code
     * path that ever moves a thing, and the one that forgot would quietly turn
     * a theft into a loan; the chain is written once, at the transfer, by
     * whoever made it.
     */
    provenance?: readonly { holderId: string | null; how: AcquisitionMode }[];
}): WhoseThisIs {
    const { ownerId, possessorId, houseIds } = input;
    // Nobody's, or a person's. Either way no house has a call on it, and a
    // bestowed thing is exactly this: the house is no longer in the field.
    if (ownerId === null || !houseIds.has(ownerId)) return 'their_own';
    if (possessorId === null || possessorId === ownerId) return 'in_a_treasury';

    // How THIS holder came by it, which is the last link naming them. Reading
    // backwards matters: a thing lent, returned, and later taken carries both
    // words on its chain, and only the most recent one is about now.
    const chain = input.provenance ?? [];
    for (let at = chain.length - 1; at >= 0; at--) {
        const link = chain[at];
        if (link === undefined || link.holderId !== possessorId) continue;
        if (link.how === 'lent') return 'lent_by_their_house';
        if (link.how === 'stolen' || link.how === 'looted') return 'taken_from_their_house';
        // Bought, inherited, awarded and the rest do not describe a thing the
        // house still owns, so they say nothing about how this one got here.
        break;
    }
    return 'unaccounted_for';
}"""
assert old in s
s = s.replace(old, new)

old3 = """        case 'in_a_treasury':
            return 'It is in the treasury and nobody has it out, which is not the same as '
                + 'being free to take.';
    }
}

/** Whether a house could call this back without it being a seizure. */
export function couldBeCalledBackIn(whose: WhoseThisIs): boolean {
    return whose === 'lent_by_their_house';
}"""
new3 = """        case 'in_a_treasury':
            return 'It is in the treasury and nobody has it out, which is not the same as '
                + 'being free to take.';
        case 'taken_from_their_house':
            return 'The house owns it, the house did not hand it over, and the chain says so '
                + 'to anybody who thinks to read it.';
        case 'unaccounted_for':
            return 'The house owns it and nothing on the record says how it left the treasury. '
                + 'That is not the same as nobody noticing.';
    }
}

/**
 * Whether a house could call this back without it being a seizure.
 *
 * True of a loan, because a loan ends. NOT true of a thing that was taken: a
 * house recovering stolen property is doing something the world has its own
 * word for, and letting that read as routine would lose the distinction this
 * type exists to make.
 */
export function couldBeCalledBackIn(whose: WhoseThisIs): boolean {
    return whose === 'lent_by_their_house';
}

/** Whether the house has something here to ask somebody about. */
export function isSomethingTheHouseWouldAskAbout(whose: WhoseThisIs): boolean {
    return whose === 'taken_from_their_house' || whose === 'unaccounted_for';
}"""
assert old3 in s
s = s.replace(old3, new3)
s = s.replace("/** What a house is holding, at a moment. */",
              "import type { AcquisitionMode } from './possessions.js';\n\n/** What a house is holding, at a moment. */", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('house ok')
