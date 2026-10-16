/** Drive the same body/world steps with or without asynchronous adapters. */
export async function finishPreparedSpan<T>(steps: Generator<unknown, T, unknown>): Promise<T> {
    let next = steps.next();
    while (!next.done) {
        let value: unknown;
        try { value = await next.value; }
        catch (error) { next = steps.throw(error); continue; }
        next = steps.next(value);
    }
    return next.value;
}

/** No promise may escape a synchronous SQLite transaction. */
export function finishPreparedSpanNow<T>(steps: Generator<unknown, T, unknown>): T {
    let next = steps.next();
    while (!next.done) {
        if (next.value && typeof (next.value as PromiseLike<unknown>).then === 'function') {
            steps.throw(new Error('A prepared atomic span cannot await an adapter.'));
            throw new Error('A prepared atomic span yielded an asynchronous adapter.');
        }
        next = steps.next(next.value);
    }
    return next.value;
}
