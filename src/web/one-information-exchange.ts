/** Greeting, context and questions to one person; requested acts stay clauses.
 * The actual rooms07 model supplied the complete name/work question, but topic
 * normalization erased its tail. This shared read covers ordinary conversation,
 * including care, without turning unrelated single questions into person verbs.
 */
export function isOneInformationExchange(input: string): boolean {
    if (/\b(?:while|after|before)\s+I\b/i.test(input)) return false;
    const sentences = input.trim().split(/[.;!?]+/).map(s => s.trim()).filter(Boolean);
    const contextual = sentences.some(sentence => /^I (?:greet\b|have come from\b)/i.test(sentence));
    const questioning = sentences.some(sentence => /^(?:(?:may|can|could) I ask\b|what|who|where|when|how|which|whether|can you|could you|do you|would you)\b/i.test(sentence));
    // This reader preserves a conversation's context and questions together.
    // A single clinical word does not establish an addressed exchange: body
    // checks and medicine prices keep their ordinary sentence-table routes.
    if (!(contextual && questioning)) return false;
    return sentences.length > 0 && sentences.every(sentence =>
        /^(?:I greet [^,;]+$|I have come from [^,;]+$|(?:may|can|could) I ask\b|(?:what|who|where|when|how|which|whether|can you|could you|do you|would you)\b|(?:medical|clinical|mortal|wound)?\s*(?:care|treatment|medicine|healing)\s*$)/i.test(sentence)
        // A comma before "and" contributes no clause. Only further questions
        // can follow; a treatment, purchase or departure remains another act.
        && sentence.split(/,|\band(?:\s+then)?\b|\bthen\b/i).slice(1).map(part => part.trim()).filter(Boolean).every(part =>
            /^(?:what|who|where|when|how|which|whether|your name|can you|could you|do you|would you)\b/i.test(part)));
}

/** The questions in an already bounded exchange, in the player's order.
 * Greeting and origin supply context; they do not request another answer.
 * This is a structural read, not an authority to perform any requested act.
 */
export function informationQuestionsOf(input: string): string[] {
    if (!isOneInformationExchange(input)) return [];
    return input.trim().split(/[.;!?]+/).map(sentence => sentence.trim()).filter(Boolean)
        .filter(sentence => !/^I (?:greet\b|have come from\b)/i.test(sentence))
        .flatMap(sentence => sentence.split(/,|\band(?:\s+then)?\b|\bthen\b/i)
            .map(part => part.trim()).filter(Boolean));
}
