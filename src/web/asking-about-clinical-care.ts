/** Clinical information is a question, not permission to administer or buy care. */
export function asksAboutClinicalCare(topic: string): boolean {
    if (!/\b(?:care|treat(?:ment)?|wounds?|injur(?:y|ies)|hurt|medicine|healing|medical)\b/i.test(topic)) return false;
    // Politeness does not turn a request to act on the player's body into an
    // information question. General capability and grade questions stay reads.
    if (/\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:(?:treat|heal)\s+(?:me\b|my\b)|(?:give|sell)\s+me\s+(?:medicine|treatment)\b)/i.test(topic)) return false;
    if (/\bI\s+(?:then\s+)?(?:pay|buy|get\s+(?:my\s+)?(?:wounds?|injuries)\s+treated|take|swallow|leave|move|go|report|attack|threaten)\b/i.test(topic)
        || /(?:^|[.;]|\band\s+(?:then\s+)?)(?:\s*please\s+)?\s*(?:(?:treat|heal)\s+me|give\s+me\s+(?:medicine|treatment))\b/i.test(topic)) return false;
    // A short topic from the planner is also information. An ordinary question
    // may contain a greeting, introduction and context before its clinical clause.
    return /\b(?:what|how|which|whether|offer|available|cost|price|fees?)\b|\b(?:can|could|do|would)\s+you\b/i.test(topic)
        || /\b(?:can|could|does|would)\b[^?.!;]*\b(?:reach|close|treat|heal)\b/i.test(topic)
        || /^(?:(?:medical|clinical|mortal|wound)\s+)?(?:care|treatment|medicine|healing)[?.!\s]*$/i.test(topic.trim());
}
