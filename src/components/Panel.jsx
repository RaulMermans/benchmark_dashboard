export default function Panel({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`surface-card p-5 md:p-6 ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            {eyebrow && <p className="analysis-label mb-2 text-accent-500">{eyebrow}</p>}
            {title && <h2 className="text-xl font-semibold text-black">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
