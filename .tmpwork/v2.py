import io
p = 'src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.ts'
s = io.open(p, encoding='utf-8').read()

start = s.index("/** What a house reads off a plate. */")
end = s.index("/**\n * WHOLE PLATE, AND NOBODY HAS SEEN THEM.")
new = '''/** What a house reads off a plate. */
export type WhatThePlateSays =
    /** Whole. They are alive, wherever they are. */
    | 'they_live'
    /** Shattered. They are dead, and the house learned it the moment it broke. */
    | 'they_are_dead';

/**
 * WHAT THE PLATE SAYS, DERIVED FROM THE PERSON AND NOT STORED ON THE PLATE.
 *
 * A first cut stored `whole` on the row and wrote it at death. That is the
 * second copy of a fact this repo's doctrine forbids, and the reason is not
 * theoretical: `markDead` is called from SIX places across four files, so a
 * stored flag is six chances to forget, and the one that forgot would leave a
 * whole plate hanging for a dead disciple - which is precisely the signature
 * the world uses to mean *somebody is holding them prisoner*. The bug would not
 * read as a bug. It would read as a kidnapping.
 *
 * A plate's wholeness IS its holder's aliveness. One fact. So it is asked of
 * the person, every time, and there is nothing to write, nothing to migrate,
 * and no call site that can miss it.
 */
export function whatThePlateSays(holderIsAlive: boolean): WhatThePlateSays {
    return holderIsAlive ? 'they_live' : 'they_are_dead';
}

/**
 * Whether the token in somebody's hand is a working one.
 *
 * Derived from the same single fact, for the same reason. *"You cannot take a
 * working token off a corpse"* is not a rule anybody enforces at a call site -
 * it is what this function returns, and a caller that reads it cannot get it
 * wrong.
 */
export function theTokenStillAnswers(holderIsAlive: boolean): boolean {
    return holderIsAlive;
}

/**
 * How a plate and a token read once their holder is gone, for prose.
 *
 * Nothing is written. These are the words for a state the world is already in,
 * so a shattered plate needs no shattering pass and a dead disciple's token is
 * dust from the moment they die rather than from the moment somebody
 * remembered to write it down.
 */
export function whatIsLeftOfThem(input: {
    holderIsAlive: boolean;
    holderName: string;
}): { plate: string; token: string } | null {
    if (input.holderIsAlive) return null;
    return {
        plate: `The life plate of ${input.holderName} is in pieces on the floor of the hall, `
            + 'and everybody who was in the room when it went knows what it means.',
        token: 'Dust. It went when its holder did, which is why nobody has ever taken a working '
            + 'one off a corpse.'
    };
}

'''
s = s[:start] + new + s[end:]

s = s.replace("""export function whatAHouseMakesOfSilence(input: {
    plate: Pick<ObjectRecord, 'data'> | null;
    daysSinceAnybodySawThem: number;
}): 'nothing_yet' | 'they_are_dead' | 'somebody_has_them' {
    if (input.plate === null) return 'nothing_yet';
    if (whatThePlateSays(input.plate) === 'they_are_dead') return 'they_are_dead';
    return input.daysSinceAnybodySawThem >= WHEN_SILENCE_BECOMES_A_CAPTIVE
        ? 'somebody_has_them'
        : 'nothing_yet';
}""",
"""export function whatAHouseMakesOfSilence(input: {
    /** False where this house never issued them one. */
    theyHaveAPlate: boolean;
    holderIsAlive: boolean;
    daysSinceAnybodySawThem: number;
}): 'nothing_yet' | 'they_are_dead' | 'somebody_has_them' {
    if (!input.theyHaveAPlate) return 'nothing_yet';
    if (whatThePlateSays(input.holderIsAlive) === 'they_are_dead') return 'they_are_dead';
    return input.daysSinceAnybodySawThem >= WHEN_SILENCE_BECOMES_A_CAPTIVE
        ? 'somebody_has_them'
        : 'nothing_yet';
}""")

# and the office that issues them
s += '''
// ═════════════════════════════════════════════════════════════════════════
// AND WHOSE JOB IT IS
// ═════════════════════════════════════════════════════════════════════════

/**
 * THE KEEPER OF THE ROLL.
 *
 * The design owner: *"when you join, an identity plate and token get created
 * for you - that's another elder's job"*, *"idk, give him a name, a role."*
 *
 * So it is an office, and this repo already decides what an office IS: a SEALED
 * ROOM dealt to a decider by `whoIsInChargeOfWhat`. There is no title table
 * anywhere and adding one would be a second way of saying who is in charge of
 * what. The armoury elder is whoever holds the armoury; the Keeper of the Roll
 * is whoever holds the room the plates hang in.
 *
 * WHICH IS WHY THE NAME IS THE ROOM'S AND NOT A PERSON'S. Nobody is appointed
 * Keeper of the Roll in this engine. Somebody holds the hall, and holding it is
 * what makes them the person a new disciple is sent to - and what makes losing
 * it a demotion that costs them something specific rather than face.
 */
export const THE_KEEPER_OF_THE_ROLL = 'Keeper of the Roll';

/**
 * What the office is, said as the room it is held over.
 *
 * `whoAnswersAbout(portfolios, THE_ROOM_THE_ROLL_IS_KEPT_IN)` is the whole
 * lookup - the same call the punishment hall and the treasury already use.
 */
export const THE_ROOM_THE_ROLL_IS_KEPT_IN = WHERE_THE_PLATES_HANG;
'''
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
