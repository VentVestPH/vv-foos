import { describe, expect, it } from 'vitest';
import { mergeSectionOrder, moveSection, sameOrder } from '../../app/src/lib/sectionOrder';

const DEFAULTS = ['A', 'B', 'C', 'D'];

describe('mergeSectionOrder', () => {
  it('returns the defaults when nothing is saved', () => {
    expect(mergeSectionOrder([], DEFAULTS)).toEqual(DEFAULTS);
  });

  it('follows the saved order', () => {
    expect(mergeSectionOrder(['D', 'B', 'A', 'C'], DEFAULTS)).toEqual(['D', 'B', 'A', 'C']);
  });

  it('drops sections that no longer exist and ignores repeats', () => {
    expect(mergeSectionOrder(['Z', 'C', 'C', 'A'], DEFAULTS)).toEqual(['C', 'D', 'A', 'B']);
  });

  it('places a new section after the one that precedes it by default', () => {
    expect(mergeSectionOrder(['D', 'A', 'C'], DEFAULTS)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('places a new first section at the top', () => {
    expect(mergeSectionOrder(['B', 'C'], ['New', 'B', 'C'])).toEqual(['New', 'B', 'C']);
  });
});

describe('moveSection', () => {
  it('moves a section down and up', () => {
    expect(moveSection(DEFAULTS, 0, 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(moveSection(DEFAULTS, 3, 1)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('leaves the order alone for an impossible move', () => {
    expect(moveSection(DEFAULTS, 0, -1)).toBe(DEFAULTS);
    expect(moveSection(DEFAULTS, 3, 4)).toBe(DEFAULTS);
    expect(moveSection(DEFAULTS, 2, 2)).toBe(DEFAULTS);
    expect(moveSection(DEFAULTS, 9, 0)).toBe(DEFAULTS);
  });
});

describe('sameOrder', () => {
  it('compares position by position', () => {
    expect(sameOrder(['A', 'B'], ['A', 'B'])).toBe(true);
    expect(sameOrder(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(sameOrder(['A'], ['A', 'B'])).toBe(false);
  });
});
