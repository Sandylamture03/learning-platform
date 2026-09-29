import {
  API,
  hostOf,
  type LessonTask,
  type LessonView,
  type Level,
  RESOURCE_TYPE_LABELS,
  type TopicRef,
} from '@lp/contracts';
import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { isNotFound, queries } from '../api.ts';
import { ModuleOutlet } from '../ModuleOutlet.tsx';
import { InlineMarkdown, InlineNodes, Markdown, useHeadings } from '../markdown.tsx';
import { paths } from '../paths.ts';
import { Breadcrumb, LoadError, Loading, NotFound, PriorityBadge, Title } from '../ui.tsx';

// Stable loaders, defined once: ModuleOutlet remounts its module whenever `load` changes.
const loadQuiz = () => import('@lp/widgets/quiz');

const LEVEL_LABELS: Record<Level, string> = { foundation: 'Foundation', core: 'Core', advanced: 'Advanced' };

/** A written topic links to its lesson; an outline to its track. */
const topicPath = (ref: TopicRef) => (ref.written ? paths.lesson(ref.trackId, ref.id) : paths.track(ref.trackId));

function Task({ task, links }: { task: LessonTask; links: readonly TopicRef[] }) {
  const { challenge, starter, solution, checks } = task;
  const name = (field: string) => `challenge ${challenge.id} ${field}`;
  return (
    <div className="task">
      <h3>Coding task: {challenge.title}</h3>
      <p className="task__meta">About {challenge.estMinutes} minutes</p>
      <p>
        <InlineMarkdown text={challenge.prompt} name={name('prompt')} links={links} />
      </p>
      <h4>Start from this</h4>
      <pre className="code">
        <code>{starter}</code>
      </pre>
      <h4>Done when it</h4>
      <ul className="done-list">
        {checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
      <p className="task__note">Write it in your own editor for now; checking your code for you comes later.</p>
      {challenge.hints.map((hint, i) => (
        <details key={hint}>
          <summary>Hint {i + 1}</summary>
          <p>
            <InlineMarkdown text={hint} name={name(`hints[${i}]`)} links={links} />
          </p>
        </details>
      ))}
      <details>
        <summary>Show a solution</summary>
        <pre className="code">
          <code>{solution}</code>
        </pre>
      </details>
    </div>
  );
}

function Lesson({ view, done }: { view: LessonView; done: { score: number } | undefined }) {
  const { track, module, topic, links } = view;
  const headings = useHeadings(view.theory, topic.theory);
  const name = (field: string) => `${topic.id} ${field}`;
  const required = view.resources.filter((r) => r.required);
  const optional = view.resources.filter((r) => !r.required);
  const weeks =
    module?.weeks &&
    (module.weeks[0] === module.weeks[1] ? `Week ${module.weeks[0]}` : `Weeks ${module.weeks.join('–')}`);

  const resourceGroup = (title: string, items: LessonView['resources']) =>
    items.length > 0 && (
      <div>
        <h3>{title}</h3>
        <ul className="resource-list" role="list">
          {items.map(({ resource, note }) => (
            <li key={resource.id}>
              <a href={resource.url}>{resource.title}</a>{' '}
              <span className="resource-list__meta">
                {RESOURCE_TYPE_LABELS[resource.type]} · {hostOf(resource.url)}
              </span>
              <span className="resource-list__note">
                <InlineMarkdown text={note} name={name(`resources.${resource.id}.note`)} links={links} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="container">
      <Title>{`${track.title}: ${topic.title}`}</Title>
      <Breadcrumb
        items={[
          { to: paths.path, label: 'Learning path' },
          { to: paths.track(track.id), label: track.title },
          { to: paths.lesson(track.id, topic.id), label: topic.title },
        ]}
      />

      <header className="page-head">
        <p className="eyebrow">{track.title} lesson</p>
        <h1>{topic.title}</h1>
        <p className="page-head__lead">{topic.summary}</p>
        <dl className="facts">
          <div>
            <dt>Priority</dt>
            <dd>
              <PriorityBadge priority={topic.priority} />
            </dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{LEVEL_LABELS[topic.level]}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>About {topic.estMinutes} minutes</dd>
          </div>
          {module && (
            <div>
              <dt>Week</dt>
              <dd>
                <Link to={paths.track(track.id)}>{[weeks, module.title].filter(Boolean).join(': ')}</Link>
              </dd>
            </div>
          )}
          {view.prerequisites.length > 0 && (
            <div>
              <dt>Read first</dt>
              <dd>
                {view.prerequisites.map((ref, i) => (
                  <Fragment key={ref.id}>
                    {i > 0 && ', '}
                    <Link to={topicPath(ref)}>{ref.title}</Link>
                  </Fragment>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {done && (
          <p className="notice notice--success">Done: you passed the quiz with {Math.round(done.score * 100)}%.</p>
        )}
      </header>

      <section className="section" aria-labelledby="goals-title">
        <h2 id="goals-title">What you will learn</h2>
        <ul className="done-list">
          {topic.objectives.map((objective, i) => (
            <li key={objective}>
              <InlineMarkdown text={objective} name={name(`objectives[${i}]`)} links={links} />
            </li>
          ))}
        </ul>
      </section>

      <nav className="toc" aria-labelledby="toc-title">
        <h2 id="toc-title" className="toc__title">
          On this page
        </h2>
        <ul role="list">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a href={`#${heading.id}`}>
                <InlineNodes nodes={heading.children} />
              </a>
            </li>
          ))}
          <li>
            <a href="#examples-title">Code examples</a>
          </li>
          <li>
            <a href="#resources-title">Resources</a>
          </li>
          <li>
            <a href="#check-title">Check yourself</a>
          </li>
        </ul>
      </nav>

      <div className="prose">
        <Markdown source={view.theory} name={topic.theory} links={links} />
      </div>

      <section className="section" aria-labelledby="examples-title">
        <h2 id="examples-title">Code examples</h2>
        {topic.examples.map((example) => (
          <section key={example.id} className="example" aria-labelledby={`example-${example.id}`}>
            <h3 id={`example-${example.id}`}>{example.title}</h3>
            <pre className="code">
              <code>{example.code}</code>
            </pre>
            <p className="example__takeaway">
              <strong>Notice:</strong>{' '}
              <InlineMarkdown text={example.takeaway} name={name(`examples.${example.id}.takeaway`)} links={links} />
            </p>
          </section>
        ))}
      </section>

      <section className="section" aria-labelledby="resources-title">
        <h2 id="resources-title">Resources</h2>
        <p className="section__intro">
          {required.length > 0 && optional.length > 0
            ? 'All free. Start here, then go further when you want more.'
            : 'All free.'}
        </p>
        <div className="resource-groups">
          {resourceGroup('Start here', required)}
          {resourceGroup('Go further', optional)}
        </div>
      </section>

      <section className="section" aria-labelledby="check-title">
        <h2 id="check-title">Check yourself</h2>
        <div className="tasks">
          {view.quiz && (
            <div className="task">
              <h3>Quiz</h3>
              <p>Passing the quiz marks this lesson done on your learning path.</p>
              <ModuleOutlet load={loadQuiz} src={API.quiz(topic.id)} label={`Quiz: ${topic.title}`} />
            </div>
          )}
          {view.tasks.map((task) => (
            <Task key={task.challenge.id} task={task} links={links} />
          ))}
        </div>
      </section>

      {(view.previous || view.next) && (
        <nav className="pager" aria-label="Lessons">
          {view.previous && (
            <Link className="pager__link" rel="prev" to={topicPath(view.previous)}>
              <span aria-hidden="true">←</span> {view.previous.title}
            </Link>
          )}
          {view.next && (
            <Link className="pager__link pager__link--next" rel="next" to={topicPath(view.next)}>
              {view.next.title} <span aria-hidden="true">→</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export function LessonPage() {
  const { trackId = '', topicId = '' } = useParams();
  const lesson = useQuery(queries.lesson(topicId));
  const progress = useQuery(queries.progress());

  if (lesson.isPending) {
    return (
      <div className="container">
        <Loading>Loading the lesson…</Loading>
      </div>
    );
  }
  if (lesson.isError) {
    if (isNotFound(lesson.error)) {
      return (
        <NotFound
          title="Lesson not found"
          message={`There is no written lesson called “${topicId}”. It may still be an outline on its track.`}
        />
      );
    }
    return (
      <div className="container">
        <LoadError what="The lesson" error={lesson.error} onRetry={() => void lesson.refetch()} />
      </div>
    );
  }
  // A lesson lives under its own track; fix a URL that puts it under another one.
  if (lesson.data.track.id !== trackId) {
    return <Navigate replace to={paths.lesson(lesson.data.track.id, topicId)} />;
  }
  const done = progress.data?.completed.find((p) => p.topicId === topicId);
  return <Lesson key={topicId} view={lesson.data} done={done} />;
}
