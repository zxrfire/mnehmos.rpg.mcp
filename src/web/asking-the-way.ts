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

/** The place a way-topic asks after, or null for any other topic. */
export function theWayAskedFor(topic: string): string | null {
    const said = topic.trim();
    return said.toLowerCase().startsWith(THE_WAY_TO) && said.length > THE_WAY_TO.length + 1
        ? said.slice(THE_WAY_TO.length).trim()
        : null;
}
