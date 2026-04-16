import { EVENT_TYPES } from '@refnet/shared';
import ConnectEventClient from './ConnectEventClient';

/**
 * Static export: pre-render one /connect/<event-slug> page for each of the 14
 * life-event types. Slug format is the EventType enum in lowercase with
 * underscores replaced by hyphens (mirrors the runtime `slugToEventType` parser).
 */
export function generateStaticParams() {
  return EVENT_TYPES.map((t) => ({ event: t.toLowerCase().replace(/_/g, '-') }));
}

export const dynamicParams = false;

export default function Page() {
  return <ConnectEventClient />;
}
