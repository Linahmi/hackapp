export default function Navbar() {
  return (
    <nav
      className="w-full flex items-center gap-3 px-6 py-3"
      style={{ backgroundColor: "#0f1117", borderBottom: "1px solid #1a1d27" }}
    >
      <span className="text-white font-bold text-lg tracking-tight select-none">
        ProcureTrace
      </span>
      <span style={{ color: "#374151" }}>|</span>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: "#dc2626" }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: "#dc2626" }}
          />
        </span>
        <span className="text-sm font-medium" style={{ color: "#dc2626" }}>
          Agent ready
        </span>
      </div>
    </nav>
  );
}
