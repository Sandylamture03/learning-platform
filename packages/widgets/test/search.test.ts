import { describe, expect, it } from 'vitest';
import { describeResults, filterResources, fold } from '../src/search.js';
import { catalogue } from './fixtures.ts';

const ids = (text: string, track = '', type = '') =>
  filterResources(catalogue.resources, { text, track, type }).map((r) => r.id);

describe('filterResources', () => {
  it('returns everything, in catalogue order, for an empty query', () => {
    expect(ids('')).toEqual(['css-grid', 'flexbox-video', 'react-docs', 'grid-in-react']);
  });

  it('matches every word against the title and the site, ignoring case', () => {
    expect(ids('GRID')).toEqual(['css-grid', 'grid-in-react']);
    expect(ids('grid react')).toEqual(['grid-in-react']);
    expect(ids('mozilla')).toEqual(['css-grid']);
    expect(ids('  grid   ')).toEqual(['css-grid', 'grid-in-react']);
  });

  it('applies the track and type filters on top of the words', () => {
    expect(ids('', 'react')).toEqual(['react-docs', 'grid-in-react']);
    expect(ids('', '', 'video')).toEqual(['flexbox-video', 'grid-in-react']);
    expect(ids('grid', 'html-css', 'docs')).toEqual(['css-grid']);
    expect(ids('flexbox', 'react')).toEqual([]);
  });

  it('ignores accents', () => {
    expect(fold('Café Élan')).toBe('cafe elan');
  });
});

describe('describeResults', () => {
  const query = { text: '', track: '', type: '' };

  it('says when everything is shown', () => {
    expect(describeResults(4, 4, query, {})).toBe('Showing all 4 resources.');
  });

  it('names the words and the filters', () => {
    expect(
      describeResults(1, 4, { text: 'grid', track: 'react', type: 'video' }, { track: 'React', type: 'Video' }),
    ).toBe('Showing 1 of 4 resources for “grid” in React (Video).');
    expect(describeResults(0, 4, { ...query, text: 'zzz' }, {})).toBe('No resources for “zzz”.');
  });
});
