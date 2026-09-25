import { getDb } from '../../src/storage/index.js';
import {
    getDomainServices,
    type DomainServices,
} from '../../src/server/domain-services.js';
import { useInMemoryDatabase } from '../helpers/test-db.js';

useInMemoryDatabase();

describe('domain service boundary', () => {
    it('builds the facade on the current database', () => {
        expect(getDomainServices().db).toBe(getDb());
    });

    it('exposes the repository dependencies needed by world, npc and inventory', () => {
        const services = getDomainServices();
        const required: Array<keyof DomainServices> = [
            'db', 'character', 'concentration', 'encounter',
            'eventInbox', 'inventory', 'item', 'world', 'worldSnapshot'
        ];

        for (const key of required) expect(services[key]).toBeDefined();
    });
});
