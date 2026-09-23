import { theOathAHouseOffersAtItsDoor } from '../../../src/engine/social/the-oath-a-house-offers-at-its-door.js';
describe('the oath a house offers at its door', () => {
    it('is a silence oath the leaver holds when sworn, and a grievance the house holds when refused', () => {
        const at = { leaverId: 'p', leaverName: 'P', houseId: 'house-a', houseName: 'The Test Hall', onDay: DAY };
        const sworn = theOathAHouseOffersAtItsDoor({ ...at, answer: 'swear' });
        expect(sworn.record.kind).toBe('oath');
        expect(sworn.record.cause).toBe('silence');
        expect(sworn.record.holderId).toBe('p');
        expect(sworn.record.subjectId).toBe('house-a');
        const refused = theOathAHouseOffersAtItsDoor({ ...at, answer: 'refuse' });
        expect(refused.record.kind).toBe('grudge');
        expect(refused.record.holderId).toBe('house-a');
        expect(refused.record.subjectId).toBe('p');
    });
});
