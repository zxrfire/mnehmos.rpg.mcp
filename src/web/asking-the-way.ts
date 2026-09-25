/**
 * A question about where somewhere is, and the topic it travels under. Kept
 * apart from the answer so the verb table can read it without the world.
 */

/** The topic a question about the way travels under: `the way to <X>`. */
export const THE_WAY_TO = 'the way to ';

/** Whether a sentence asks where something is or how to get there. */
const ASKS_THE_WAY =
    /\b(?:where\s+(?:is|are|lies|would|could|can|do|does|might|should)|how\s+(?:do|can|would|should)\s+(?:i|we)\s+(?:get|go)|how\s+to\s+(?:get|go)|which\s+way|the\s+way\s+to|directions?\s+to)\b/i;

export function asksTheWay(sentence: string): boolean {
    return ASKS_THE_WAY.test(sentence);
}

/** Words that put a question to whoever is standing here rather than to one of them. */
const A_CROWD =
    /^(?:every(?:one|body)|any(?:one|body)|some(?:one|body)|people|folks?|them|y'?all|the (?:crowd|locals|people|folk)|you (?:all|guys|lot|people)|(?:any|all) of (?:you|them|u)(?: guys)?|u guys)(?:\s+(?:here|around|around here|about))?$/i;

export function aCrowdIsAsked(target: string): boolean {
    return A_CROWD.test(target.trim());
}

/**
 * "Anyone know the way to X?", "does anybody know how to get to X", "can someone tell me where X
 * is": the way, put to whoever is standing here. Only the first question in the line is read, so
 * "anyone know the way to the white stair? the mountain province" asks after the first.
 */
const THE_WAY_ASKED_OF_A_CROWD =
    /^(?:(?:hey|yo|so|um+|ok(?:ay)?)\s*,?\s*)?(?:(?:does|do|can|could|would)\s+)?(?:any(?:one|body)|some(?:one|body)|(?:any|all) of (?:you|u)(?: guys)?|you guys|u guys|y'?all)(?:\s+(?:here|around here))?\s*,?\s+(?:know|knows|tell me|show me)\s+(?:the (?:way|road) to|how (?:to|i can|do i|we can|one can) (?:get|go) to|where)\s+(.+?)(?:\s+(?:is|are|lies))?(?:\s+from here)?\s*[.!]*$/i;

/** The place a crowd was asked the way to, or null when the sentence is not that. */
export function theWayAskedOfACrowd(sentence: string): string | null {
    const first = sentence.trim().split('?')[0] ?? '';
    const place = THE_WAY_ASKED_OF_A_CROWD.exec(first.trim())?.[1]?.trim();
    return place && place.length >= 2 ? place : null;
}

/**
 * A topic that asks the way, however a reader wrote it down: "the way to X", "road to X",
 * "directions to X", "how to get to X". Played: the model filed "road to Emerald Water City", and
 * a topic read only as `the way to` sent the question to the list of destinations.
 */
const A_WAY_TOPIC =
    /^(?:the\s+)?(?:(?:way|road|route|path)\s+(?:to|towards?)|directions?\s+(?:to|for)|how\s+to\s+(?:get|go)\s+to)\s+(?!(?:the\s+)?(?:immortality|foundation|breakthrough|break(?:ing)?|enlightenment|ascension|dao|heavens?|power|strength|golden core|a core|nascent|mastery|the top)\b)(.+)$/i;

/** The place a way-topic asks after, or null for any other topic. */
export function theWayAskedFor(topic: string): string | null {
    const place = A_WAY_TOPIC.exec(topic.trim())?.[1]?.trim();
    return place && place.length >= 2 ? place : null;
}
