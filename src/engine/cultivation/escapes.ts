/**
 * Moved to `acquisition.ts`.
 *
 * "escapes" said nothing about what is in here. The module answers one
 * question - HOW DOES SOMEBODY GET THE NEXT MANUAL - and `assessAcquisition`,
 * `AcquisitionReport` and `AcquisitionInput` were already named for it, so the
 * file was the only thing still using the old word.
 *
 * This re-export exists because several agents hold uncommitted work in the
 * files that import it, and rewriting their imports would sweep that work into
 * a commit of mine. Migrate imports to `acquisition.js` as those files come
 * free, then delete this.
 */
export * from './acquisition.js';
