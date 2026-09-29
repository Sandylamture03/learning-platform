// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeopleList } from './solution.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const asha = { id: 1, name: 'Asha Rao', role: 'Engineer' };
const ben = { id: 2, name: 'Ben Okafor', role: 'Designer' };
const chen = { id: 3, name: 'Chen Wei', role: 'Engineer' };

describe('PeopleList', () => {
  it('shows a loading message while the people are on their way', () => {
    render(<PeopleList status="loading" />);
    expect(screen.getByRole('status').textContent).toBe('Loading people…');
  });

  it('shows an error when they could not load', () => {
    render(<PeopleList status="error" />);
    expect(screen.getByRole('alert').textContent).toBe('Could not load people. Try again later.');
  });

  it('lists every person with their role, in the order given, and counts them', () => {
    render(<PeopleList status="success" people={[asha, ben, chen]} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Asha Rao (Engineer)',
      'Ben Okafor (Designer)',
      'Chen Wei (Engineer)',
    ]);
    expect(screen.getByText('3 people')).toBeTruthy();
  });

  it('filters by name, ignoring case, and says “1 person” for one', () => {
    render(<PeopleList status="success" people={[asha, ben, chen]} query="  chen " />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Chen Wei (Engineer)']);
    expect(screen.getByText('1 person')).toBeTruthy();
  });

  it('says so when no one matches, or when there is no one at all', () => {
    const { rerender } = render(<PeopleList status="success" people={[asha]} query="zed" />);
    expect(screen.getByText('No one matches “zed”.')).toBeTruthy();
    rerender(<PeopleList status="success" people={[]} />);
    expect(screen.getByText('No people yet.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('keeps each person’s element when the list is reordered (stable keys)', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<PeopleList status="success" people={[asha, ben]} />);
    const ashaItem = screen.getByText(/Asha Rao/);
    rerender(<PeopleList status="success" people={[ben, asha]} />);
    // With keys from the data, React moves Asha's <li>; with index keys it would rewrite the first one.
    expect(screen.getByText(/Asha Rao/)).toBe(ashaItem);
    expect(errors).not.toHaveBeenCalled();
  });
});
