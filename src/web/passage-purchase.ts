/** Public seats and tickets cannot fall through to buying their vehicle. */
const A_PASSAGE_ITEM = /\b(?:tickets?|passage tall(?:y|ies)|(?:seats?|berths?)\s+(?:on|in|aboard)|(?:carriage|coach|ship|boat|ferry)\s+seats?)\b/i;

/** Read only the purchased passage's destination; the ordinary counter owns its terms. */
export function passagePurchase(said: string, target?: string): { destination?: string; words: string } | null {
    const words = A_PASSAGE_ITEM.test(said) ? said : target ?? '';
    const item = A_PASSAGE_ITEM.exec(words);
    if (!item) return null;
    const destination = /\bto\s+([^.!?;]+)/i.exec(words.slice(item.index + item[0].length))?.[1]
        ?.replace(/[,.\s]+$/, '').trim();
    return { destination: destination || undefined, words };
}
