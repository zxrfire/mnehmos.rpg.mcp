/**
 * What somebody standing here can be told about being reached, before they
 * commit to a span.
 *
 * The arrival machinery is ONE-DIRECTIONAL without this: every input to it is
 * consulted at execution and nowhere else, so a player weighing a decade in a
 * cave could learn what the ground would do to them only by spending the decade.
 *
 * THE CONSTRAINT: THE INPUTS, NEVER THE ROLL. `encountersFor` is deterministic,
 * so running it forward for an uncommitted span is trivially possible and is
 * exactly what this must not do - reporting what it drew would hand the player
 * an OUTCOME the engine has not filed. Same settlement as `request`'s `weigh`
 * mode: run everything up to the roll and stop there.
 */

import { arrivalExposure, concealmentScale, sealedDoorFraction, socialReach } from './activity.js';
import type { EncounterActivity, Locatability } from './types.js';

/**
 * The columns locatability is read off, and nothing else.
 */
export interface GroundAsFoundOn {
    kind: string;
    discovered?: boolean;
    controllingFactionId?: string | null;
}

/**
 * Whether somebody looking for this person would know where to start.
 */
export function locatabilityFrom(
    ground: GroundAsFoundOn | null,
    membershipSectId: string | null
): Locatability {
    if (!ground) return 'private';

    // Undiscovered ground is ground nobody has a name for.
    if (ground.discovered === false) return 'hidden';

    if (membershipSectId !== null && ground.controllingFactionId === membershipSectId) return 'known';

    // Somewhere people live is somewhere people notice who is about.
    if (ground.kind === 'settlement' || ground.kind === 'sect_seat') return 'known';

    // Deep wilds and sealed places are where somebody goes not to be found.
    if (ground.kind === 'wilds' || ground.kind === 'sealed_domain' ||
        ground.kind === 'forbidden_zone' || ground.kind === 'secret_realm') {
        return 'hidden';
    }

    return 'private';
}

export interface ArrivalReadInput {
    /** What the place is called, in the player's own words for it. */
    placeName: string;
    /** Whether anybody looking would know where to start. */
    locatability: Locatability;
    /** People standing on this ground besides the asker. */
    heads: number;
    /** The asker's rung, for what hiding a door would filter. */
    realmOrdinal: number;
    /**
     * The span the question is about.
     *
     * `seclusion` is the default because that is what somebody asking whether
     * they can sit here means, and it is the activity the played question named.
     */
    activity?: EncounterActivity;
}

/**
 * What this ground is like for being found on, as sentences.
 */
export function theArrivalReadFor(input: ArrivalReadInput): string[] {
    const lines: string[] = [];
    const where = input.placeName;
    const activity = input.activity ?? 'seclusion';

    // THE GROUND, AS SOMEBODY LOOKING FOR YOU WOULD FIND IT
    lines.push(
        input.locatability === 'known'
            ? `${where} is ground people know to look on. Anybody with a reason to find you `
              + 'would know where to start, and the ones who mean well know it too.'
            : input.locatability === 'hidden'
                ? `Nobody knows to look for you on ${where}. Little reaches you here, and that `
                  + 'includes anything that would have come to help.'
                : `${where} is not somewhere people would think to look, though a few could find `
                  + 'you if they set out to.'
    );

    // WHO IS ALREADY ON IT
    //
    // Not a roll and not a forecast: these are people standing here now. The
    // count is the same one the ground read prints, so the two cannot disagree.
    lines.push(
        input.heads <= 0
            ? 'Nobody is standing on it with you, so whatever comes here comes from somewhere else.'
            : input.heads === 1
                ? 'One person is standing on it with you, and knows you are here.'
                : `${input.heads} people are standing on it with you, and know you are here.`
    );

    // WHAT A SHUT DOOR IS WORTH, WHICH IS THE THING NOBODY BELIEVES
    //
    // Stated as an ordering rather than as a ratio. What matters to somebody
    // deciding is that sealing is the quietest option AND that it is not a ward:
    // at zero, closing the door stopped being a trade and became the dominant
    // strategy, which is the reason `sealed` is low and not nought.
    //
    // ONE SENTENCE, not two. The first draft said the door's worth and then the
    // open-against-sealed ordering separately, and read as the same fact twice -
    // which is `AGENTS.md`'s repeated-clause dump, in the middle of a read whose
    // whole job is to be answerable in a breath.
    const shutIsQuieter = arrivalExposure(activity) > arrivalExposure('sealed');
    lines.push(
        `Sitting behind a shut door is the quietest thing you could do on ${where}`
        + (shutIsQuieter
            ? ' - sitting with it open is a good deal more exposed, and working among people more '
              + 'again, because what reaches you tracks how much of the world you are standing in'
            : '')
        + '. It is not silence either: a door keeps you from walking into the world and does not '
        + 'keep the world from arriving at it'
        + (sealedDoorFraction() > 0 ? ', and over a long enough sitting something does' : '')
        + '.'
    );

    // AND WHAT HIDING THE ENTRANCE WOULD BUY AT THIS RUNG
    //
    // The one line that moves with the asker, and the reason it is worth
    // printing: hiding a door is a RUNG FILTER rather than a rate cut, so its
    // value is a fact about how far up the ladder they are standing. A Qi
    // Condensation cultivator who hides their cave has excluded almost nobody.
    const filtered = concealmentScale(input.realmOrdinal);
    lines.push(
        filtered >= 0.3
            ? 'Hiding the entrance would not buy you much yet. Almost everybody who might come '
              + 'is standing at your rung or above it, and they would find it anyway.'
            : filtered >= 0.05
                ? 'Hiding the entrance would turn most of the people who might come into people '
                  + 'who walk past a hillside. The rest would still find it.'
                : 'Hiding the entrance would put you out of reach of very nearly everybody. The '
                  + 'few it would not stop are the few you could not refuse anyway.'
    );

    // AND THE HONEST CLOSE
    //
    // The read stops short of the roll deliberately and says so, because a
    // player told everything above and given no verdict will otherwise read the
    // absence as a promise. This is the same shape as `request`'s weigh mode:
    // everything the attempt is built from, and none of the attempt.
    lines.push(
        'None of that says whether anybody will. It says who could, and what you could do '
        + 'about it before you sit down.'
    );

    return lines;
}

/**
 * How much of the people-shaped world reaches somebody this findable.
 *
 * Re-exported so a caller composing the read does not have to reach into the
 * table module for one number. Nothing in the prose above prints it.
 */
export { socialReach };
