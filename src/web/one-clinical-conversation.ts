import { asksAboutClinicalCare } from './asking-about-clinical-care.js';
import { isOneInformationExchange } from './one-information-exchange.js';

/** A single clinical information exchange; independently requested acts stay clauses. */
export function isOneClinicalConversation(input: string): boolean {
    return asksAboutClinicalCare(input) && isOneInformationExchange(input);
}
