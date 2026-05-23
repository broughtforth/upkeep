import Link from "next/link";
import { signIn } from "../actions";

type Search = { error?: string; notice?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { error, notice } = await searchParams;

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-blue-600">
          Upkeep
        </h1>
        <p className="mt-2 text-neutral-500">Sign in to the admin.</p>
      </header>

      {notice === "check-email" && (
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Check your email for a confirmation link, then come back to sign in.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <form action={signIn} className="flex flex-col gap-4">
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
            autoComplete="current-password"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-base outline-none focus:border-blue-500"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </button>
      </form>

      <p className="text-sm text-neutral-500">
        No account?{" "}
        <Link href="/signup" className="font-semibold text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
