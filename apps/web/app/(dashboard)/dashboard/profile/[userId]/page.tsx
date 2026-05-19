'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Sparkles, Users, Video } from 'lucide-react';
import { api, ApiError } from '../../../../../lib/api';
import { useAuthStore } from '../../../../../stores/auth';
import { NetworkGraph } from '../../../../../components/profile/NetworkGraph';

type ViewerRelationship =
  | { kind: 'self' }
  | { kind: 'connected'; acceptedAt: string | null }
  | { kind: 'pending_outgoing' }
  | { kind: 'pending_incoming' }
  | { kind: 'intro_suggested'; introId: string }
  | { kind: 'intro_requested'; introId: string }
  | { kind: 'none' };

interface ConnectionSummary {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  businessName: string | null;
  industry: string | null;
}

interface MemberProfileView {
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  profile: {
    businessName: string;
    industry: string;
    headline: string | null;
    bio: string | null;
    yearsInBusiness: number | null;
    servicesOffered: string[];
    keywords: string[];
    icpIndustries: string[];
    icpRoles: string[];
    icpProblems: string[];
    canReferIndustries: string[];
    canReferTypes: string[];
    city: string | null;
    state: string | null;
    videoUrl: string | null;
    videoDurationSec: number | null;
  };
  relationship: ViewerRelationship;
  recentConnections: ConnectionSummary[];
  stats: { totalConnections: number; introsSent: number; introsAccepted: number };
}

export default function MemberProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<MemberProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!userId || !accessToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const view = await api.get<MemberProfileView>(`/api/v1/ai/profile/${userId}`, {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setData(view);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken]);

  async function onRequestIntro() {
    if (!userId || !accessToken || !data) return;
    setRequesting(true);
    try {
      await api.post(
        `/api/v1/ai/intros/by-target/${userId}/request`,
        {},
        { accessToken: accessToken ?? undefined },
      );
      setData({
        ...data,
        relationship: { kind: 'intro_requested', introId: '' },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setRequesting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        Loading profile…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Profile not available.'}
        </div>
      </div>
    );
  }

  const { user, profile, relationship, recentConnections, stats } = data;
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const location =
    profile.city && profile.state
      ? `${profile.city}, ${profile.state}`
      : profile.city ?? profile.state ?? null;
  const videoEmbed = toEmbedUrl(profile.videoUrl);

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {user.firstName.charAt(0)}
              {user.lastName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            <p className="text-sm font-medium text-gray-700">{profile.businessName}</p>
            <p className="text-xs uppercase tracking-wide text-gray-500">{profile.industry}</p>
            {location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                {location}
              </p>
            )}
          </div>
        </div>
        <RelationshipCTA
          relationship={relationship}
          requesting={requesting}
          onRequestIntro={onRequestIntro}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {videoEmbed && (
            <Section title="Video intro" icon={<Video className="h-4 w-4" />}>
              <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
                <iframe
                  src={videoEmbed}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Section>
          )}

          {profile.headline && (
            <Section title="About">
              <p className="text-sm font-medium text-gray-900">{profile.headline}</p>
              {profile.bio && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{profile.bio}</p>}
            </Section>
          )}

          {profile.servicesOffered.length > 0 && (
            <Section title="Services offered">
              <TagList items={profile.servicesOffered} />
            </Section>
          )}

          {(profile.icpIndustries.length > 0 || profile.icpRoles.length > 0 || profile.icpProblems.length > 0) && (
            <Section title="Ideal clients">
              {profile.icpIndustries.length > 0 && (
                <Field label="Industries">
                  <TagList items={profile.icpIndustries} />
                </Field>
              )}
              {profile.icpRoles.length > 0 && (
                <Field label="Roles">
                  <TagList items={profile.icpRoles} />
                </Field>
              )}
              {profile.icpProblems.length > 0 && (
                <Field label="Problems they solve">
                  <TagList items={profile.icpProblems} />
                </Field>
              )}
            </Section>
          )}

          {(profile.canReferIndustries.length > 0 || profile.canReferTypes.length > 0) && (
            <Section title="Can refer to">
              {profile.canReferIndustries.length > 0 && (
                <Field label="Industries">
                  <TagList items={profile.canReferIndustries} />
                </Field>
              )}
              {profile.canReferTypes.length > 0 && (
                <Field label="Client types">
                  <TagList items={profile.canReferTypes} />
                </Field>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Network">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Connections" value={stats.totalConnections} />
              <Stat label="Intros sent" value={stats.introsSent} />
              <Stat label="Accepted" value={stats.introsAccepted} />
            </div>
          </Section>

          <Section title="Network map">
            <NetworkGraph
              center={{
                firstName: user.firstName,
                lastName: user.lastName,
                businessName: profile.businessName,
              }}
              connections={recentConnections.map((c) => ({
                userId: c.userId,
                firstName: c.firstName,
                lastName: c.lastName,
                businessName: c.businessName,
              }))}
            />
          </Section>

          <Section title="Recent connections" icon={<Users className="h-4 w-4" />}>
            {recentConnections.length === 0 ? (
              <p className="text-sm text-gray-500">No connections yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentConnections.map((c) => (
                  <li key={c.userId}>
                    <Link
                      href={`/dashboard/profile/${c.userId}`}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-gray-50"
                    >
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                          {c.firstName.charAt(0)}
                          {c.lastName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {c.firstName} {c.lastName}
                        </p>
                        {c.businessName && (
                          <p className="truncate text-xs text-gray-500">{c.businessName}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/matches" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" />
      Back to matches
    </Link>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function RelationshipCTA({
  relationship,
  requesting,
  onRequestIntro,
}: {
  relationship: ViewerRelationship;
  requesting: boolean;
  onRequestIntro: () => void;
}) {
  switch (relationship.kind) {
    case 'self':
      return (
        <span className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
          This is your profile
        </span>
      );
    case 'connected':
      return (
        <span className="rounded-md bg-green-100 px-3 py-2 text-sm font-medium text-green-800">
          Connected
        </span>
      );
    case 'pending_outgoing':
      return (
        <span className="rounded-md bg-yellow-100 px-3 py-2 text-sm font-medium text-yellow-800">
          Connection pending
        </span>
      );
    case 'pending_incoming':
      return (
        <span className="rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800">
          They want to connect with you
        </span>
      );
    case 'intro_requested':
      return (
        <span className="rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800">
          Intro requested
        </span>
      );
    case 'intro_suggested':
    case 'none':
    default:
      return (
        <button
          type="button"
          onClick={onRequestIntro}
          disabled={requesting}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {requesting ? 'Requesting…' : 'Request intro'}
        </button>
      );
  }
}

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === 'player.vimeo.com' || host === 'www.youtube.com' || host === 'youtube-nocookie.com') {
      return url;
    }
    return url;
  } catch {
    return null;
  }
}
