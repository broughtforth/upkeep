// Lightweight session context. Holds the picked user's id and a sign-out
// function so any screen can boot the user back to the OnboardingScreen
// without having to lift state up through navigation props.

import { createContext, useContext, type ReactNode } from 'react';

type SessionValue = {
  currentUserId: string | null;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionValue;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside <SessionProvider>');
  return v;
}
