'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MemberProfileView } from '../../../../../components/members/MemberProfileView';

function ProfileInner() {
  const id = useSearchParams().get('id') ?? '';
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Link
        href="/dashboard/members"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <ArrowLeft size={14} /> All members
      </Link>
      <MemberProfileView id={id} />
    </div>
  );
}

export default function DashboardMemberProfilePage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" /></div>}>
      <ProfileInner />
    </Suspense>
  );
}
