import { createEventBus, type PlatformEvents } from '@lp/platform-kit';
import { useEffect, useState } from 'react';

// One bus for the whole app; UI modules receive it through PlatformContext (Phase 3).
const events = createEventBus<PlatformEvents>();

export function App() {
  const [completed, setCompleted] = useState(0);

  useEffect(() => events.on('topic.completed.v1', () => setCompleted((n) => n + 1)), []);

  return (
    <main className="shell">
      <h1>Learning Platform</h1>
      <p>
        This is the React + TypeScript app shell. The learning path, quizzes and progress arrive in Phase 3; the public
        site lives in <code>apps/site</code>.
      </p>
      <button
        type="button"
        onClick={() => events.emit('topic.completed.v1', { trackId: 'react', topicId: 'useeffect', score: 1 })}
      >
        Send a test event
      </button>
      <p aria-live="polite">Events received: {completed}</p>
    </main>
  );
}
