/**
 * The existing provision price, shared without loading a tool handler.
 * Native GameService imports failed before startup when cultivation-mortal
 * reached this constant through cultivation-manage, whose eager action table
 * in turn needs cultivation-mortal's initialized schemas. Keep the answer here
 * once; the old export remains a compatibility door.
 */
export const RATION_COST_STONES = 2;
