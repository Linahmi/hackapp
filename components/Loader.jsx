export default function Loader({ message = "Processing…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" style={{ color: "var(--text-muted)" }}>
      <svg
        className="h-8 w-8 animate-spin"
        style={{ color: "#dc2626" }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
