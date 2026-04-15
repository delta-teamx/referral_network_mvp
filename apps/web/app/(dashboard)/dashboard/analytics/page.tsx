export default function AnalyticsPage() {
  return (
    <div className="p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Analytics</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Views, leads, conversions</h1>
      </header>
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-600">
          Branch 7 wires Recharts + backend aggregators to show views-over-time, lead-source
          breakdown, and trust-score evolution. Event collectors are already publishing the data —
          this page just needs the chart UI.
        </p>
      </div>
    </div>
  );
}
