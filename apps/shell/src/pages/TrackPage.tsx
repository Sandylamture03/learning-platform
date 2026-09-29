import type { Module, TopicSummary, TrackView } from '@lp/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { isNotFound, queries, useProgress } from '../api.ts';
import { paths } from '../paths.ts';
import { Breadcrumb, LoadError, Loading, NotFound, PriorityBadge, Title } from '../ui.tsx';

function weeksLabel(module: Module): string | undefined {
  if (!module.weeks) return undefined;
  const [first, last] = module.weeks;
  return first === last ? `Week ${first}` : `Weeks ${first}–${last}`;
}

function TopicItem({ trackId, topic, done }: { trackId: string; topic: TopicSummary; done: boolean }) {
  const written = topic.status !== 'outline';
  const details = [
    written ? `Lesson, about ${topic.estMinutes} minutes` : 'Outline: the lesson is on the way',
    topic.quizSize > 0 && `quiz of ${topic.quizSize} questions`,
  ].filter(Boolean);
  return (
    <li className={`topic${done ? ' topic--done' : ''}`}>
      <p className="topic__title">
        {done && <span className="topic__done">Done: </span>}
        {written ? <Link to={paths.lesson(trackId, topic.id)}>{topic.title}</Link> : topic.title}{' '}
        <PriorityBadge priority={topic.priority} />
      </p>
      <p className="topic__why">{topic.why}</p>
      <p className="topic__meta">{details.join(', ')}</p>
    </li>
  );
}

function ModuleSection({ track, module, done }: { track: TrackView; module: Module; done: ReadonlySet<string> }) {
  const topics = track.topics.filter((t) => t.module === module.id);
  const id = `module-${module.id}`;
  const weeks = weeksLabel(module);
  return (
    <section className="module" aria-labelledby={id}>
      <h3 id={id}>
        {weeks && (
          <span className="module__weeks">
            {weeks}
            <span className="visually-hidden">:</span>
          </span>
        )}{' '}
        {module.title}
      </h3>
      {module.goal && <p className="module__goal">{module.goal}</p>}
      {topics.length > 0 ? (
        <ul className="topic-list" role="list">
          {topics.map((topic) => (
            <TopicItem key={topic.id} trackId={track.id} topic={topic} done={done.has(topic.id)} />
          ))}
        </ul>
      ) : (
        <p className="module__topics">This week practises what the weeks before it taught.</p>
      )}
      {module.build && (
        <p className="module__build">
          <strong>Build:</strong> {module.build.title}
        </p>
      )}
    </section>
  );
}

export function TrackPage() {
  const { trackId = '' } = useParams();
  const track = useQuery(queries.track(trackId));
  const { user, done: finishedTopics } = useProgress();

  if (track.isPending) {
    return (
      <div className="container">
        <Loading>Loading the track…</Loading>
      </div>
    );
  }
  if (track.isError) {
    if (isNotFound(track.error)) {
      return <NotFound title="Track not found" message={`There is no track called “${trackId}”.`} />;
    }
    return (
      <div className="container">
        <LoadError what="The track" error={track.error} onRetry={() => void track.refetch()} />
      </div>
    );
  }

  const view = track.data;
  const done = new Set(finishedTopics.keys());
  const lessons = view.topics.filter((t) => t.status !== 'outline');
  const finished = lessons.filter((t) => done.has(t.id)).length;

  return (
    <div className="container">
      <Title>{view.title}</Title>
      <Breadcrumb
        items={[
          { to: paths.path, label: 'Learning path' },
          { to: paths.track(view.id), label: view.title },
        ]}
      />
      <header className="page-head">
        <p className="eyebrow">Track {view.order}</p>
        <h1>{view.title}</h1>
        <p className="page-head__lead">{view.summary}</p>
        <dl className="facts">
          <div>
            <dt>Pace</dt>
            <dd>
              {view.pace.weeks} weeks · {view.pace.effort}
            </dd>
          </div>
          <div>
            <dt>Lessons</dt>
            <dd>
              {lessons.length} of {view.topics.length} topics
            </dd>
          </div>
          {user && (
            <div>
              <dt>Done</dt>
              <dd>
                {finished} of {lessons.length}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <section className="section" aria-labelledby="plan-title">
        <h2 id="plan-title">Weekly plan</h2>
        <p className="section__intro">
          Each week lists its topics. Written ones open as lessons; outlines get their lesson soon.
        </p>
        {view.modules.map((module) => (
          <ModuleSection key={module.id} track={view} module={module} done={done} />
        ))}
      </section>
    </div>
  );
}
