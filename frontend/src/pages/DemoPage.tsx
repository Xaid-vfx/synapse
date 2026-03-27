export default function DemoPage() {
  const pills = [
    'Find your investors',
    'Find your niche followers',
    'Convert followers into hires',
  ];

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-bg-dark" aria-hidden="true">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-4xl font-black tracking-tight text-white">Synapse</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-tight text-white mb-6">
          Find the right people<br />
          <span className="text-primary">in your network.</span>
        </h1>

        {/* Sub-points */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          {pills.map((line) => (
            <div
              key={line}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold"
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
