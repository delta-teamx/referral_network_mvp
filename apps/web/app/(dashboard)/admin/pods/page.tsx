'use client';

import { useEffect, useState } from 'react';
import { Calendar, Check, Play, Sparkles, Users, Video } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { Button } from '../../../../components/ui/Button';

interface PodMember {
  id: string;
  userId: string;
  attended: boolean;
  user: { firstName: string; lastName: string; email: string };
}

interface Pod {
  id: string;
  scheduledAt: string;
  zoomJoinUrl: string | null;
  zoomStartUrl: string | null;
  status: string;
  podSize: number;
  matchCriteria: { industries?: string[] } | null;
  createdAt: string;
  completedAt: string | null;
  members: PodMember[];
  _count: { feedback: number };
}

export default function AdminPodsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<Pod[]>('/api/v1/pods', {
        accessToken: accessToken ?? undefined,
      });
      setPods(data);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function triggerMatchmaking() {
    if (!accessToken) return;
    if (!window.confirm('Run AI matchmaking now? This will create pods and send Zoom invitations to matched members.')) return;
    setTriggering(true);
    setError(null);
    setTriggerResult(null);
    try {
      const result = await api.post<{ podsCreated: number; membersMatched: number }>(
        '/api/v1/pods/trigger',
        {},
        { accessToken: accessToken ?? undefined },
      );
      setTriggerResult(`Created ${result.podsCreated} pod(s) with ${result.membersMatched} members matched.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Matchmaking failed');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">AI Pods</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            Matchmaking pods{' '}
            <span className="text-sm font-normal text-gray-400">({pods.length})</span>
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            AI automatically creates pods daily at 9 AM EST. Each pod gets a unique Zoom link.
          </p>
        </div>
        <Button onClick={() => void triggerMatchmaking()} loading={triggering}>
          <Play size={14} /> Run matchmaking now
        </Button>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {triggerResult && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <Check size={14} /> {triggerResult}
        </p>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-gray-900" />
      ) : pods.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-500">
          <Sparkles size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="font-medium">No pods yet</p>
          <p className="mt-1 text-sm">Click &ldquo;Run matchmaking now&rdquo; to create the first batch, or wait for the daily 9 AM run.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pods.map((pod) => (
            <div
              key={pod.id}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">
                      Pod of {pod.podSize} members
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        pod.status === 'scheduled'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : pod.status === 'completed'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {pod.status}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
                    <Calendar size={12} />
                    {new Date(pod.scheduledAt).toLocaleString()}
                  </p>
                  {pod.matchCriteria?.industries && (
                    <p className="mt-1 text-xs text-gray-500">
                      Industries: {pod.matchCriteria.industries.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {pod.zoomJoinUrl && (
                    <a
                      href={pod.zoomJoinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
                    >
                      <Video size={10} /> Zoom link
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Users size={12} /> {pod._count.feedback} feedback
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {pod.members.map((m) => (
                  <span
                    key={m.id}
                    className={`rounded-full px-3 py-1 text-xs ${
                      m.attended
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-gray-800 text-gray-300 border border-gray-700'
                    }`}
                  >
                    {m.user.firstName} {m.user.lastName}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
