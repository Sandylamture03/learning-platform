// Sign in and sign up. The browser's own checks (required, type="email", minlength) catch the easy mistakes;
// the API's answer names anything else field by field.
import { ACCOUNT_LIMITS } from '@lp/contracts';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { ApiRequestError, useProgress, useSignIn, useSignUp } from '../api.ts';
import { paths, safeNext } from '../paths.ts';
import { Loading, Title } from '../ui.tsx';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  hint?: string;
  /** What the browser's check shows when the field is invalid. */
  fallback: string;
  /** The API's problem with this field, shown until the next try. */
  error: string | undefined;
}

function Field({ name, label, hint, fallback, error, ...input }: FieldProps) {
  const id = `account-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;
  const describedBy = [hintId, error ? errorId : undefined].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      <p className={`field__error${error ? ' field__error--shown' : ''}`} id={errorId}>
        {error ?? fallback}
      </p>
    </div>
  );
}

/** The fields the form holds, by name. */
const read = (event: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;

function AccountPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: (next: string) => ReactNode;
}) {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { me, user } = useProgress();
  // Signed in already, or just now: go where the learner was heading.
  if (user) return <Navigate replace to={next} />;
  return (
    <div className="container">
      <Title>{title}</Title>
      <header className="page-head">
        <p className="eyebrow">Your account</p>
        <h1>{title}</h1>
        <p className="page-head__lead">{lead}</p>
      </header>
      {me.isPending ? <Loading>Checking whether you are signed in…</Loading> : children(next)}
    </div>
  );
}

/** What went wrong, for the form as a whole; field problems also show beside their fields. */
function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="notice notice--error" role="alert">
      <p>{error instanceof Error ? error.message : 'Something went wrong. Try again.'}</p>
    </div>
  );
}

const fieldsOf = (error: unknown) => (error instanceof ApiRequestError ? error.fields : {});

export function SignInPage() {
  const signIn = useSignIn();
  const fields = fieldsOf(signIn.error);
  return (
    <AccountPage title="Sign in" lead="Sign in to save your progress and pick up where you left off.">
      {(next) => (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const { email, password } = read(event);
            signIn.mutate({ email: email ?? '', password: password ?? '' });
          }}
        >
          <FormError error={signIn.error} />
          <Field
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            maxLength={ACCOUNT_LIMITS.emailMax}
            fallback="Enter an email address like name@example.com."
            error={fields.email}
          />
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            maxLength={ACCOUNT_LIMITS.passwordMax}
            fallback="Enter your password."
            error={fields.password}
          />
          <button className="button" type="submit" disabled={signIn.isPending}>
            {signIn.isPending ? 'Signing in…' : 'Sign in'}
          </button>
          <p>
            New here? <Link to={paths.signUp(next)}>Create an account</Link>
          </p>
        </form>
      )}
    </AccountPage>
  );
}

export function SignUpPage() {
  const signUp = useSignUp();
  const fields = fieldsOf(signUp.error);
  return (
    <AccountPage
      title="Create your account"
      lead="An account is free. It saves every quiz you pass, so your learning path shows how far you have come."
    >
      {(next) => (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const { name, email, password } = read(event);
            signUp.mutate({ name: name ?? '', email: email ?? '', password: password ?? '' });
          }}
        >
          <p className="form__note">All fields are required.</p>
          <FormError error={signUp.error} />
          <Field
            name="name"
            label="Name"
            type="text"
            autoComplete="name"
            maxLength={ACCOUNT_LIMITS.nameMax}
            fallback="Enter your name."
            error={fields.name}
          />
          <Field
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            maxLength={ACCOUNT_LIMITS.emailMax}
            fallback="Enter an email address like name@example.com."
            error={fields.email}
          />
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            minLength={ACCOUNT_LIMITS.passwordMin}
            maxLength={ACCOUNT_LIMITS.passwordMax}
            hint={`At least ${ACCOUNT_LIMITS.passwordMin} characters. A few unrelated words make a strong one.`}
            fallback={`Use at least ${ACCOUNT_LIMITS.passwordMin} characters.`}
            error={fields.password}
          />
          <button className="button" type="submit" disabled={signUp.isPending}>
            {signUp.isPending ? 'Creating your account…' : 'Create account'}
          </button>
          <p>
            Already have an account? <Link to={paths.signIn(next)}>Sign in</Link>
          </p>
        </form>
      )}
    </AccountPage>
  );
}
