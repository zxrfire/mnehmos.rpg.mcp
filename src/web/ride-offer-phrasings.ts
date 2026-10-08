/** Pure offered-passage wording; imports no runtime or state authority. */
/** The ordinary offered forms also provide the parser's deterministic floor.
 * Payment always comes from the player's actual sentence, never model fields. */
export function rideOfferSaid(raw: string): { person: string; destination: string; free: boolean; payment: string | null } | null {
    const text = raw.trim().replace(/[.!?]$/, '').replace(/\s+(?:aboard|in|on)\s+my\s+(?:spirit\s+boat|boat|drawn\s+carriage|carriage|craft)\b/gi, '');
    const match = /^(?:I\s+)?offer\s+(.+?)\s+(?:(?:a|an)\s+)?(free\s+)?(?:ride|passage)\s+to\s+(.+?)(?:\s+(?:for|in\s+exchange\s+for)\s+(.+?))?$/i.exec(text);
    const take = match ? null : /^(?:I\s+)?(?:offer\s+to|can)\s+(?:take|carry)\s+(.+?)\s+to\s+(.+?)(?:\s+(?:for|in\s+exchange\s+for)\s+(.+?))?$/i.exec(text);
    if (!match && !take) return null;
    const person = (match ? match[1] : take![1])!.trim(), destination = (match ? match[3] : take![2])!.trim();
    const payment = (match ? match[4] : take![3])?.trim() ?? null;
    const paymentIsFree = /^(?:free|no\s+(?:payment|charge))$/i.test(payment ?? '');
    return { person, destination, free: !!match?.[2] || paymentIsFree, payment: paymentIsFree ? null : payment };
}
