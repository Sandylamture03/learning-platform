/**
 * A team directory with every state a list from the network has.
 * @typedef {{ id: number, name: string, role: string }} Person
 * @param {{ status: 'loading' | 'error' | 'success', people?: Person[], query?: string }} props
 */
export function PeopleList({ status, people = [], query = '' }) {
  // One early return per state; the list at the end runs only when there is something to show.
  if (status === 'loading') return <p role="status">Loading people…</p>;
  if (status === 'error') return <p role="alert">Could not load people. Try again later.</p>;

  const search = query.trim();
  const matches = people.filter((person) => person.name.toLowerCase().includes(search.toLowerCase()));
  if (matches.length === 0) return <p>{search ? `No one matches “${search}”.` : 'No people yet.'}</p>;

  return (
    <>
      <p>{matches.length === 1 ? '1 person' : `${matches.length} people`}</p>
      <ul>
        {matches.map((person) => (
          <li key={person.id}>
            {person.name} ({person.role})
          </li>
        ))}
      </ul>
    </>
  );
}
