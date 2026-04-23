'use client';

import type { ReactNode } from 'react';
import { AuthGate } from '../../../../components/auth/AuthGate';

export function AuthGateServer({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
