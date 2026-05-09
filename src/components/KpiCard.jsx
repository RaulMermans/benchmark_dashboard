export default function KpiCard({ label, value, detail, accentColor = "#E4032C" }) {
  return (
    <article className="surface-card relative overflow-hidden p-5">
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accentColor }} />
      <p className="text-xs font-medium uppercase text-neutral-500">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold text-black">{value}</p>
      {detail && <p className="mt-2 text-sm text-neutral-500">{detail}</p>}
    </article>
  );
}
