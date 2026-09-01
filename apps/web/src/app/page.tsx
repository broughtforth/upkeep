import { AppRoot } from "@/components/AppRoot";

// Force runtime rendering — every page in this app hits Supabase via the
// client which evaluates the env vars eagerly. Static generation at build
// time can't see the runtime env reliably across Vercel's worker boundary.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AppRoot />;
}
