'use client';

import { useEffect, useState } from 'react';
import { FileSignature } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface Contract {
  id: string;
  title: string;
  body: string;
  status: string;
  senderSignature: string;
  receiverSignature: string | null;
  senderSignedAt: string;
  receiverSignedAt: string | null;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; email: string };
  receiver: { id: string; firstName: string; lastName: string; email: string };
}

export default function AdminContractsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const data = await api.get<Contract[]>('/api/v1/contracts/all', {
          accessToken: accessToken ?? undefined,
        });
        setContracts(data);
      } catch (err) {
        if (err instanceof ApiError && err.status !== 401) setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Contracts</p>
        <h1 className="mt-1 text-2xl font-bold text-white">
          Platform contracts{' '}
          <span className="text-sm font-normal text-gray-400">({contracts.length})</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Every contract executed between members. Admins are also CC&rsquo;d on all contract
          emails.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-gray-900" />
      ) : contracts.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-500">
          <FileSignature size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="font-medium">No contracts yet</p>
          <p className="mt-1 text-sm">
            When members send each other the platform contract, every copy shows up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div key={c.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{c.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.status === 'signed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : c.status === 'declined'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    {c.sender.firstName} {c.sender.lastName} ({c.sender.email}) →{' '}
                    {c.receiver.firstName} {c.receiver.lastName} ({c.receiver.email})
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    ✍️ {c.senderSignature}
                    {c.receiverSignature ? ` · ✍️ ${c.receiverSignature}` : ' · awaiting countersignature'}
                    {' · '}
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
                >
                  {expanded === c.id ? 'Hide terms' : 'View terms'}
                </button>
              </div>
              {expanded === c.id && (
                <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-950 p-4 font-mono text-xs leading-relaxed text-gray-300">
                  {c.body}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
