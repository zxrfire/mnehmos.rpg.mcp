import io

# ── how big one of a catalog thing is, derived and not a second table ────
p = 'src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.ts'
s = io.open(p, encoding='utf-8').read()
s += '''
// ═════════════════════════════════════════════════════════════════════════
// AND HOW BIG THE THINGS IN A POUCH ARE
// ═════════════════════════════════════════════════════════════════════════

/**
 * WHAT ONE OF A CATALOG THING TAKES UP.
 *
 * `ObjectRecord` carries its own `volume` and `weight`, because a world object
 * is a row with a history and can be measured. A pouch does not hold those. It
 * holds CATALOG ids - a herb id, a pill id, an artifact id - and the catalogs
 * carry no size at all.
 *
 * DERIVED RATHER THAN ADDED TO EVERY ROW, on the doctrine this repo already
 * follows for grade: a size column on four hundred catalog rows is four hundred
 * chances to be inconsistent and a second source for a fact the kind already
 * tells you. A pill is a pill-sized thing whatever it does; a herb is a bundle
 * of dried plant, light and awkward; an artifact is a made object somebody
 * carries in a hand.
 *
 * AND THE TWO NUMBERS PULL OPPOSITE WAYS ON PURPOSE. A pouch of pills is heavy
 * for its size and a bundle of herbs is the reverse, which is the whole reason
 * `whatStopsThemCarryingIt` reports WHICH limit ran out rather than a single
 * encumbrance figure. Somebody told "it will not fit" and somebody told "you
 * cannot lift it" go and do two different things about it.
 */
export function whatOneOfTheseTakes(kind: 'pill' | 'herb' | 'artifact'): HowMuchRoomItTakes {
    switch (kind) {
        // A pill in a wax case. Small, dense, and the reason a purse of them
        // runs a body out of carrying weight before it runs out of room.
        case 'pill':
            return { volume: 0.05, weight: 0.02 };
        // Dried, stalks and all. The bulkiest thing anybody carries by the
        // handful, and near enough weightless.
        case 'herb':
            return { volume: 0.6, weight: 0.03 };
        // A made object: a blade, a plate, a token. The default an unmeasured
        // world object gets, and for the same reason.
        case 'artifact':
            return { volume: WHAT_A_CARRIED_THING_TAKES, weight: WHAT_A_CARRIED_THING_WEIGHS };
    }
}

/** What a whole pouch amounts to. Stacks counted, not listed. */
export function whatAllOfThatTakes(
    held: readonly { kind: 'pill' | 'herb' | 'artifact'; quantity: number }[]
): HowMuchRoomItTakes {
    let volume = 0;
    let weight = 0;
    for (const lot of held) {
        const each = whatOneOfTheseTakes(lot.kind);
        const many = Math.max(0, Math.floor(lot.quantity));
        volume += each.volume * many;
        weight += each.weight * many;
    }
    return { volume: round2(volume), weight: round2(weight) };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * What a player is told about what they are carrying, or null when it is not
 * worth a line.
 *
 * SILENT UNTIL IT MATTERS. A status sheet that reports two decimal places of
 * unused capacity every turn is the engine talking to itself; somebody with a
 * near-empty pouch does not need to be told they could carry more. It speaks
 * when one of the two limits is close, and it names WHICH - because that is the
 * whole point of there being two.
 */
export function whatCarryingThatIsLike(
    load: HowMuchRoomItTakes,
    capacity: HowMuchRoomItTakes
): string | null {
    const stopped = whatStopsThemCarryingIt(load, capacity);
    if (stopped === 'too_heavy') {
        return `Carrying ${load.weight}kg against ${Math.round(capacity.weight)}kg the body will `
            + 'take. Nothing else goes in until something comes out.';
    }
    if (stopped === 'no_room') {
        return `Carrying ${load.volume} litres against ${Math.round(capacity.volume)} there is `
            + 'room for. Nothing else fits, whatever it weighs.';
    }
    const roomLeft = capacity.volume === 0 ? 0 : load.volume / capacity.volume;
    const weightLeft = capacity.weight === 0 ? 0 : load.weight / capacity.weight;
    if (Math.max(roomLeft, weightLeft) < WHEN_A_LOAD_IS_WORTH_MENTIONING) return null;
    return roomLeft >= weightLeft
        ? `The pouch is most of the way full: ${load.volume} litres of ${Math.round(capacity.volume)}.`
        : `Near what the body will carry: ${load.weight}kg of ${Math.round(capacity.weight)}.`;
}

/** How full is worth a sentence. Below this the pouch is not a consideration. */
export const WHEN_A_LOAD_IS_WORTH_MENTIONING = 0.7;
'''
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
