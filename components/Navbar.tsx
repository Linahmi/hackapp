export default function Navbar() {
  return (
    <nav className="w-full px-6 py-3 flex items-center gap-3" style={{ backgroundColor: "#0f1117", borderBottom: "1px solid #1e2130" }}>
      {/* Product name */}
      <span className="text-white font-bold text-lg tracking-tight">
        ProcureTrace
      </span>

      {/* Divider */}
      <span className="text-gray-600 select-none">|</span>

      {/* Agent status */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-red-500 text-sm font-medium tracking-wide">
          Agent ready
        </span>
      </div>
    </nav>
  );
}
