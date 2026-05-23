import Link from "next/link";
import { signUp } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-blue-600">
          Upkeep
        </h1>
        <p className="mt-2 text-neutral-500">Create your admin account.</p>
      </header>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <form action={signUp} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Full name
          </span>
          <input
            type="text"
            name="full_name"
            required
            autoComplete="name"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-base outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-base outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Password
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-base outline-none focus:border-blue-500"
          />
          <span className="text-xs text-neutral-400">At least 8 characters.</span>
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Sign up
        </button>
      </form>

      <p className="text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
