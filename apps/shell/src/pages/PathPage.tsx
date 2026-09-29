import type { TopicSummary, TrackSummary } from '@lp/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { queries } from '../api.ts';
import { paths } from '../paths.ts';
import { LoadError, Loading, PriorityBadge, Title } from '../ui.tsx';

const hasLesson = (topic: TopicSummary) => topic.status !== 'outline';

function TrackCard({ track, done }: { track: TrackSummary; done: ReadonlySet<string> }) {
  const lessons = track.topics.filter(hasLesson);
  const finished = lessons.filter((t) => done.has(t.id)).length;
  const labelId = `progress-${track.id}`;
  return (
    <li className="card">
      <p className="card__eyebrow">Track {track.order}</p>
      <h3 className="card__title">
        <Link to={paths.track(track.id)}>{track.title}</Link>
      </h3>
      <p>{track.summary}</p>
      {lessons.length > 0 ? (
        <div className="progress">
          <p id={labelId} className="progress__label">
            {finished} of {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} done
          </p>
          <progress value={finished} max={lessons.length} aria-labelledby={labelId} />
        </div>
      ) : (
        <p className="progress__label">Lessons for this track are on the way.</p>
      )}
      <ul className="card__meta" role="list">
        <li>{track.pace.weeks} weeks</li>
        <li>{track.topics.length} topics</li>
        <li>{lessons.length} lessons written</li>
      </ul>
    </li>
  );
}

/** The first written lesson, in catalogue order, that is not done yet. */
function nextLesson(tracks: readonly TrackSummary[], done: ReadonlySet<string>) {
  for (const track of tracks) {
    const topic = track.topics.find((t) => hasLesson(t) && !done.has(t.id));
    if (topic) return { track, topic };
  }
  return undefined;
}

function UpNext({ tracks, done }: { tracks: readonly TrackSummary[]; done: ReadonlySet<string> }) {
  const next = nextLesson(tracks, done);
  const written = tracks.some((track) => track.topics.some(hasLesson));
  return (
    <section className="section" aria-labelledby="next-title">
      <h2 id="next-title">{done.size > 0 ? 'Up next' : 'Start here'}</h2>
      {next ? (
        <div className="next-lesson">
          <p className="card__eyebrow">{next.track.title}</p>
          <p className="next-lesson__title">
            <Link to={paths.lesson(next.track.id, next.topic.id)}>{next.topic.title}</Link>{' '}
            <PriorityBadge priority={next.topic.priority} />
          </p>
          <p>{next.topic.why}</p>
          {next.topic.estMinutes !== undefined && (
            <p className="task__meta">About {next.topic.estMinutes} minutes, then a quiz</p>
          )}
        </div>
      ) : (
        <p>
          {written
            ? 'You have finished every lesson written so far. New ones arrive track by track.'
            : 'Lessons are on the way.'}
        </p>
      )}
    </section>
  );
}

export function PathPage() {
  const tracks = useQuery(queries.tracks());
  const progress = useQuery(queries.progress());
  const done = new Set(progress.data?.completed.map((p) => p.topicId));

  return (
    <div className="container">
      <Title>Your learning path</Title>
      <header className="page-head">
        <p className="eyebrow">Learning path</p>
        <h1>Your learning path</h1>
        <p className="page-head__lead">
          Five tracks, in the order most people take them. Read a lesson, then pass its quiz to tick it off here.
        </p>
      </header>

      {tracks.isPending ? (
        <Loading>Loading the tracks…</Loading>
      ) : tracks.isError ? (
        <LoadError what="The tracks" error={tracks.error} onRetry={() => void tracks.refetch()} />
      ) : (
        <>
          {progress.isError && (
            <LoadError what="Your progress" error={progress.error} onRetry={() => void progress.refetch()} />
          )}
          <UpNext tracks={tracks.data} done={done} />
          <section className="section" aria-labelledby="tracks-title">
            <h2 id="tracks-title">Tracks</h2>
            <ol className="card-grid" role="list">
              {tracks.data.map((track) => (
                <TrackCard key={track.id} track={track} done={done} />
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
