'use client';

import Link from 'next/link';

interface NetworkNode {
  userId: string;
  firstName: string;
  lastName: string;
  businessName: string | null;
}

interface Props {
  center: { firstName: string; lastName: string; businessName: string };
  connections: NetworkNode[];
}

/**
 * Radial network map. Center is the profile being viewed; peripheral
 * nodes are 1-hop business connections, each linking to that member's
 * profile. Pure SVG — no chart library — and degrades to "no connections
 * yet" when the list is empty.
 */
export function NetworkGraph({ center, connections }: Props) {
  const W = 320;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const RING_R = 100;
  const NODE_R = 22;
  const CENTER_R = 28;

  if (connections.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        No connections yet.
      </div>
    );
  }

  const slots = Math.min(connections.length, 10);
  const angleStep = (2 * Math.PI) / slots;
  const startAngle = -Math.PI / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${center.firstName} ${center.lastName}'s network: ${connections.length} connections`}
    >
      {connections.slice(0, slots).map((node, i) => {
        const angle = startAngle + i * angleStep;
        const x = cx + RING_R * Math.cos(angle);
        const y = cy + RING_R * Math.sin(angle);
        return (
          <line
            key={`edge-${node.userId}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#d1d5db"
            strokeWidth={1.5}
          />
        );
      })}

      <g>
        <circle cx={cx} cy={cy} r={CENTER_R} className="fill-primary" />
        <text
          x={cx}
          y={cy}
          dy="0.35em"
          textAnchor="middle"
          className="fill-white text-sm font-semibold"
        >
          {initials(center.firstName, center.lastName)}
        </text>
      </g>

      {connections.slice(0, slots).map((node, i) => {
        const angle = startAngle + i * angleStep;
        const x = cx + RING_R * Math.cos(angle);
        const y = cy + RING_R * Math.sin(angle);
        const labelX = cx + (RING_R + NODE_R + 2) * Math.cos(angle);
        const labelY = cy + (RING_R + NODE_R + 2) * Math.sin(angle);
        const anchor =
          Math.cos(angle) > 0.2 ? 'start' : Math.cos(angle) < -0.2 ? 'end' : 'middle';
        const dy =
          Math.sin(angle) > 0.5 ? '0.9em' : Math.sin(angle) < -0.5 ? '-0.1em' : '0.35em';
        return (
          <Link key={node.userId} href={`/dashboard/profile/${node.userId}`}>
            <g
              className="cursor-pointer"
              aria-label={`${node.firstName} ${node.lastName}${node.businessName ? `, ${node.businessName}` : ''}`}
            >
              <circle
                cx={x}
                cy={y}
                r={NODE_R}
                className="fill-white stroke-primary stroke-2 transition hover:fill-primary/10"
              />
              <text
                x={x}
                y={y}
                dy="0.35em"
                textAnchor="middle"
                className="pointer-events-none fill-gray-700 text-[11px] font-semibold"
              >
                {initials(node.firstName, node.lastName)}
              </text>
              <text
                x={labelX}
                y={labelY}
                dy={dy}
                textAnchor={anchor}
                className="pointer-events-none fill-gray-600 text-[10px]"
              >
                {truncate(`${node.firstName} ${node.lastName.charAt(0)}.`, 16)}
              </text>
            </g>
          </Link>
        );
      })}
    </svg>
  );
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
