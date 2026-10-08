/**
 * Model probe 05's single physician exchange contained greeting, introduction
 * and "what care you offer travellers?". Its clinical clause became an unknown
 * topic, so the physician answered a house ladder. The parser and information
 * handler must share the clinical-question read. A hypothetical course remains
 * information; actually paying, swallowing or leaving remains a separate act.
 * Polite personal requests ("Can you treat me?") are still treatment requests,
 * not informational offers. A capability question about travellers or medicine
 * grades asks what is possible without asking the provider to act on a body.
 */
import { expect, it } from 'vitest';
import { asksAboutClinicalCare } from '../../src/web/asking-about-clinical-care.js';

it('recognizes clinical information inside an introduction and hypothetical care', () => {
    for (const topic of [
        'Hello, I am from a house. What is your name and what care do you offer travellers?',
        'Can you treat travellers?', 'What would treatment cost?', 'medical care',
        'Which medicine could reach my wound?',
        'Can mortal medicine reach wounds of this grade?',
        'Could this medicine close an injury of that severity?',
        'Do you offer healing for travellers?',
    ]) expect(asksAboutClinicalCare(topic), topic).toBe(true);
});

it('does not fold actual treatment, payment, medicine or departure into an information question', () => {
    for (const topic of [
        'Treat me', 'I get my injuries treated', 'What does care cost? I then pay the fee.',
        'What medicine is offered? I swallow a pill.', 'What care is offered? I go outside.',
        'Hello, what does care cost, and then heal me.', 'What houses do you know?',
        'Can you treat me?', 'Could you heal my injuries?',
        'Would you please treat my wounds?', 'Will you give me medicine?',
    ]) expect(asksAboutClinicalCare(topic), topic).toBe(false);
});
