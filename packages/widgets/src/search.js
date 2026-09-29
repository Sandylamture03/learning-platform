// @ts-check
// The resource finder's search: pure functions over the catalogue, so they are easy to test.
/** @import { CatalogueResource } from '@lp/contracts' */

/**
 * @typedef {object} ResourceQuery
 * @property {string} text  What the learner typed.
 * @property {string} track A track id, or '' for every track.
 * @property {string} type  A resource type, or '' for every type.
 */

/**
 * Lowercase, without accents, so "Café" matches "cafe".
 * @param {string} text
 */
export function fold(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * The resources that match both filters and every word of the text, in catalogue order.
 * Words match the title or the site, so "mdn grid" finds MDN's grid pages.
 * @param {readonly CatalogueResource[]} resources
 * @param {ResourceQuery} query
 * @returns {CatalogueResource[]}
 */
export function filterResources(resources, { text, track, type }) {
  const words = fold(text).split(/\s+/).filter(Boolean);
  return resources.filter(
    (r) =>
      (!track || r.tracks.includes(track)) &&
      (!type || r.type === type) &&
      words.every((word) => fold(`${r.title} ${r.host}`).includes(word)),
  );
}

/**
 * The sentence the finder announces after each search: "Showing 4 of 179 resources for “grid” in React."
 * @param {number} count
 * @param {number} total
 * @param {ResourceQuery} query
 * @param {{ track?: string | undefined, type?: string | undefined }} labels Names for the chosen filters.
 */
export function describeResults(count, total, query, labels) {
  const filters = [
    query.text && `for “${query.text}”`,
    query.track && `in ${labels.track ?? query.track}`,
    query.type && `(${labels.type ?? query.type})`,
  ].filter(Boolean);
  if (filters.length === 0) return `Showing all ${total} resources.`;
  const described = filters.join(' ');
  if (count === 0) return `No resources ${described}.`;
  return `Showing ${count} of ${total} resources ${described}.`;
}
