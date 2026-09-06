/**
 * THE TRANSACTION THE PACKAGED BINARY GETS.
 *
 * `esbuild.config.mjs` cannot bundle better-sqlite3's JavaScript wrapper, so it
 * writes its own against the native addon. That reimplementation had
 * `transaction` issue a bare BEGIN, with no savepoints and no depth counter -
 * so a `transaction()` called inside another `transaction()` ran BEGIN inside an
 * open transaction, which SQLite refuses.
 *
 * NESTING IS ALREADY LOAD-BEARING, in two paths a player reaches in a normal
 * run:
 *
 *   sect-manage.ts:583  wraps  sect.repo.ts:200      - joining a house
 *   apply.ts:78         wraps  cultivator.repo.ts:602 - a skip that gains a realm
 *
 * Both threw `cannot start a transaction within a transaction` in the shipped
 * binary and neither could ever fail in vitest, which loads the real module. The
 * test suite was structurally incapable of seeing it.
 *
 * So the implementation lives here, in one file, and is used twice: imported by
 * the test that runs it against a real connection, and inlined into the bundle
 * by the build. One source, so the shipped driver is the tested driver.
 */

/**
 * `Database.prototype.transaction`, with nesting.
 *
 * `this` is the Database. Deliberately free of module-scope references - the
 * build inlines this function's own source text, and anything it closed over
 * would not come with it.
 */
export function packagedTransaction(fn) {
    if (typeof fn !== 'function') throw new TypeError('Expected first argument to be a function');
    const db = this;

    // Depth lives on the CONNECTION, because being inside a transaction is a
    // fact about the connection rather than about any one wrapped function.
    const run = function (begin, args, self) {
        const depth = db.__packagedTxDepth || 0;
        const name = 'packaged_tx_' + depth;
        db.__packagedTxDepth = depth + 1;
        try {
            db.exec(depth === 0 ? begin : 'SAVEPOINT ' + name);
            let result;
            try {
                result = fn.apply(self, args);
            } catch (err) {
                // ROLLBACK TO leaves the savepoint standing, so it is released
                // too - otherwise the next sibling at this depth reuses a name
                // that is still open.
                if (depth === 0) db.exec('ROLLBACK');
                else db.exec('ROLLBACK TO ' + name + '; RELEASE ' + name);
                throw err;
            }
            db.exec(depth === 0 ? 'COMMIT' : 'RELEASE ' + name);
            return result;
        } finally {
            db.__packagedTxDepth = depth;
        }
    };

    const transaction = function (...args) { return run('BEGIN', args, this); };
    transaction.deferred = transaction;
    // An inner immediate or exclusive is still only a savepoint: the outermost
    // BEGIN already decided what kind of transaction this connection is in.
    transaction.immediate = function (...args) { return run('BEGIN IMMEDIATE', args, this); };
    transaction.exclusive = function (...args) { return run('BEGIN EXCLUSIVE', args, this); };
    return transaction;
}

/** What the build inlines. Derived from the function above, never retyped. */
export const PACKAGED_TRANSACTION_SOURCE =
    'Database.prototype.transaction = ' + packagedTransaction.toString() + ';';

/**
 * What the bundle shipped before this file existed.
 *
 * Kept ONLY so the test can demonstrate the failure against the same connection
 * it demonstrates the fix on. Nothing builds with it.
 */
export function theDriverThatCouldNotNest(fn) {
    if (typeof fn !== 'function') throw new TypeError('Expected first argument to be a function');
    const db = this;
    const begin = db.prepare('BEGIN');
    const commit = db.prepare('COMMIT');
    const rollback = db.prepare('ROLLBACK');
    function transaction(...args) {
        begin.run();
        try {
            const result = fn.apply(this, args);
            commit.run();
            return result;
        } catch (err) {
            rollback.run();
            throw err;
        }
    }
    transaction.deferred = transaction;
    return transaction;
}
