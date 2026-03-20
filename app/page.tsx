"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import RequestInput from "@/components/RequestInput";
import ProgressStepper from "@/components/ProgressStepper";
import { Laptop, Package, AlertTriangle, Search } from "lucide-react";
import { useProcurement } from "@/contexts/ProcurementContext";

type Stage = "idle" | "streaming" | "done" | "error";

const STEP_INDEX: Record<string, number> = {
  parsing: 0, rules: 1, scoring: 2, decision: 3, logged: 4,
};

const STANDARD_CASES = [
  "Need 120 laptops for the Geneva and Zurich offices within 3 weeks. Budget 180k CHF. Prefer Dell, but open to any compliant supplier with 3-year warranty and next-business-day support.",
  "Need 240 docking stations compatible with the existing Dell laptop fleet for Berlin and Munich. Delivery required in 4 weeks. Budget capped at 28k EUR. Open to approved suppliers.",
  "Need 85 monitors for new analysts in Paris and Brussels. Delivery within 21 days. Budget 42k EUR. Please include ergonomic stands and standard corporate warranty.",
  "Need 60 rugged laptops for field engineers in Milan and Madrid. Delivery needed in 5 weeks. Budget 140k EUR. Preference for low-risk suppliers with strong after-sales support.",
  "Need 45 sit-stand desks for the new operations floor in Amsterdam and Brussels. Delivery required within 5 weeks. Budget 95k EUR. Prefer durable commercial-grade workstations and assembly support.",
  "Need 120 ergonomic office chairs for the finance and HR teams in Zurich and Vienna. Delivery within 30 days. Budget 72k CHF. Prioritize low-risk suppliers with strong warranty coverage.",
  "Need meeting room furniture for 8 collaboration spaces in Paris. Delivery in 6 weeks. Budget 110k EUR. Include tables, seating, and installation.",
];

const SCENARIOS = [
  { icon: Laptop, title: "Standard Case", desc: "Fresh realistic request every click across IT and workplace categories.", text: "" },
  { icon: Package, title: "Cross-Border Case", desc: "Logistics request with uncertain duties and constraints.", text: "Required 50 specialized medical transport coolers to Kigali by end of month. Budget 12k USD, unsure about import duties." },
  { icon: AlertTriangle, title: "High-Value Case", desc: "Software renewal that should trigger approval logic.", text: "Need to renew Autodesk Maya licenses for 15 designers and add 5 new seats. Total budget 45k." },
  { icon: Search, title: "Missing Information", desc: "Vague request requiring clarification before sourcing.", text: "Need more screens for the newly hired analysts. Send them ASAP." }
];

export default function Home() {
  const router = useRouter();
  const { requestText, setRequestText } = useProcurement();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  // Counters
  const [reqProcessed, setReqProcessed] = useState(0);
  const [autoApproved, setAutoApproved] = useState(0);
  // Real-time pipeline state
  const [activeStep, setActiveStep] = useState(0);
  const [thinkingText, setThinkingText] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const standardCaseIndexRef = useRef(-1);

  // Parallax Scroll State
  const [scrollY, setScrollY] = useState(0);

  function handleTextChange(val: string) {
    setRequestText(val);
    localStorage.setItem("buyer_request", val);
  }

  function getNextStandardCase() {
    standardCaseIndexRef.current = (standardCaseIndexRef.current + 1) % STANDARD_CASES.length;
    return STANDARD_CASES[standardCaseIndexRef.current];
  }

  useEffect(() => {
    const savedText = localStorage.getItem("buyer_request");
    if (savedText && !requestText) setRequestText(savedText);

    const result = sessionStorage.getItem("procuretrace_result");
    const active = sessionStorage.getItem("procuretrace_session_active");
    const restoredText = sessionStorage.getItem("procuretrace_request_text");
    if (result && active === "true") {
      if (restoredText) setRequestText(restoredText);
      setStage("done");
      router.push("/analysis");
    }

    // Scroll listener for parallax
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Fetch real stats then animate to them
    let animTimer: ReturnType<typeof setInterval> | null = null;
    fetch("/api/stats")
      .then((r) => r.ok ? r.json() : Promise.resolve(null))
      .then((data) => {
        const target = data ?? { total: 0, autoApprovedPct: 0 };
        const duration = 2000;
        const intervalMs = 20;
        const steps = duration / intervalMs;
        let step = 0;
        animTimer = setInterval(() => {
          step++;
          setReqProcessed(Math.min(target.total, Math.floor((target.total / steps) * step)));
          setAutoApproved(Math.min(target.autoApprovedPct, Math.floor((target.autoApprovedPct / steps) * step)));
          if (step >= steps) {
            clearInterval(animTimer!);
            setReqProcessed(target.total);
            setAutoApproved(target.autoApprovedPct);
          }
        }, intervalMs);
      })
      .catch(() => {});

    return () => {
      if (animTimer) clearInterval(animTimer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [requestText, router, setRequestText]);

  async function handleSubmit(file?: File | null) {
    let finalRequestText = requestText;
    
    if (file) {
      const attachmentText = `\n\n[Additional context: see attached ${file.name}]`;
      if (!finalRequestText.includes(attachmentText)) {
        finalRequestText += attachmentText;
        setRequestText(finalRequestText);
        localStorage.setItem("buyer_request", finalRequestText);
      }
    }

    if (!finalRequestText.trim()) return;

    setError(null);
    setActiveStep(0);
    setThinkingText("");
    setProgressPct(0);
    setStage("streaming");

    try {
      const res = await fetch("/api/process-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalRequestText }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream connection failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            if (line.startsWith("data: ")) eventData = line.slice(6);
          }

          if (!eventType || !eventData) continue;

          try {
            const payload = JSON.parse(eventData);

            if (eventType === "step") {
              const idx = STEP_INDEX[payload.step] ?? 0;
              if (payload.status === "active") {
                setActiveStep(idx);
              } else if (payload.status === "done") {
                setActiveStep(idx + 1);
              }
              if (payload.thinking) {
                setThinkingText(payload.thinking);
              }
              if (payload.pct !== undefined) {
                setProgressPct(payload.pct);
              }
            }

            if (eventType === "result") {
              sessionStorage.setItem("procuretrace_result", JSON.stringify(payload));
              sessionStorage.setItem("procuretrace_session_active", "true");
              sessionStorage.setItem("procuretrace_request_text", finalRequestText);
              setStage("done");
              router.push("/analysis");
              return;
            }

            if (eventType === "error") {
              throw new Error(payload.message || "Pipeline error");
            }
          } catch (parseErr: unknown) {
            if (eventType === "error") throw parseErr;
          }
        }
      }

      if (stage !== "done") {
        setStage("done");
        router.push("/analysis");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStage("error");
    }
  }

  const isLoading = stage === "streaming";
  const titleWords = "Procurement Intelligence".split(" ");

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-[#0f1117] transition-colors duration-300">
      {/* Pure CSS Mesh Animated Background */}
      <div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-colors duration-1000"
        style={{
          transform: `translateY(-${scrollY * 0.4}px)`,
          opacity: Math.max(0, 1 - scrollY / 600)
        }}
      >
        {/* Vibrant glowing orbs for Mesh Gradient */}
        <div className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vh] rounded-full bg-blue-500/30 dark:bg-blue-600/30 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" />
        <div className="absolute top-[10%] -right-[10%] w-[50vw] h-[60vh] rounded-full bg-red-400/30 dark:bg-red-600/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" style={{ animationDelay: "2s" }} />
        <div className="absolute -bottom-[20%] left-[10%] w-[70vw] h-[60vh] rounded-full bg-purple-500/30 dark:bg-indigo-600/20 blur-[140px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" style={{ animationDelay: "4s" }} />

        {/* Enterprise Grid Lines - High Visibility */}
        <div
          className="absolute inset-0 opacity-[0.25] dark:opacity-[0.10]"
          style={{
            backgroundImage: `linear-gradient(to right, #6b7280 1px, transparent 1px), linear-gradient(to bottom, #6b7280 1px, transparent 1px)`,
            backgroundSize: `4rem 4rem`,
            maskImage: `radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)`,
            WebkitMaskImage: `radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)`
          }}
        />
        {/* Smooth gradient fade to page background */}
        <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-gray-50 dark:from-[#0f1117] to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center mt-8 mb-16">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-500 text-sm font-semibold mb-8 animate-pulse-slow">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Procurement Rules Engine · Supplier Ranking · Audit Trail
        </div>

        {/* Large Title with word-by-word fade in */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 text-center transition-colors duration-300">
          {titleWords.map((word, i) => (
            <span key={i} className="inline-block animate-word mr-3 lg:mr-4" style={{ animationDelay: `${i * 150}ms` }}>
              {word}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 font-medium mb-5 text-center max-w-3xl transition-colors duration-300">
          Turn unstructured purchase requests into compliant supplier decisions with clear escalation logic.
        </p>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-500 font-medium mb-12 text-center max-w-3xl transition-colors duration-300">
          The workflow extracts requirements, flags missing or conflicting inputs, applies policy rules, ranks suppliers, and explains when human approval is required.
        </p>

        {/* Stat Counters */}
        <div className="flex items-center gap-12 lg:gap-24 mb-16">
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-gray-900 dark:text-white transition-colors duration-300">{reqProcessed}</span>
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mt-2">Requests Processed</span>
          </div>
          <div className="w-px h-16 bg-gray-300 dark:bg-gray-800 transition-colors duration-300" />
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-gray-900 dark:text-white transition-colors duration-300">{autoApproved}%</span>
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mt-2">Auto-Approved Rate</span>
          </div>
        </div>

        {/* Scenario Cards */}
        {!isLoading && stage !== "error" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full mb-12">
            {SCENARIOS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  handleTextChange(s.title === "Standard Case" ? getNextStandardCase() : s.text);
                  const el = e.currentTarget;
                  el.classList.add("scale-95");
                  setTimeout(() => el.classList.remove("scale-95"), 150);
                }}
                className="flex flex-col items-start gap-4 p-5 rounded-2xl bg-white/90 dark:bg-[#12151f]/80 backdrop-blur-md border border-gray-200 dark:border-[#1e2130] text-left transition-all duration-300 hover:scale-[1.02] hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)] group"
              >
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors duration-300">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-1.5 transition-colors duration-300">{s.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium transition-colors duration-300">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Action Input Section */}
        <div className="w-full flex flex-col items-center justify-center">
          <RequestInput
            value={requestText}
            onChange={handleTextChange}
            onSubmit={handleSubmit}
            disabled={isLoading}
          />

          {isLoading && (
            <div className="w-full max-w-2xl mt-8 animate-fade-slide-up">
              <ProgressStepper
                activeStep={activeStep}
                thinkingText={thinkingText}
                done={false}
                pct={progressPct}
              />
            </div>
          )}

          {stage === "error" && error && (
            <div className="w-full max-w-2xl mt-8 rounded-xl px-5 py-4 text-sm flex items-start justify-between gap-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 animate-fade-slide-up transition-colors duration-300">
              <span><span className="font-semibold">Error: </span>{error}</span>
              <button
                onClick={() => { setStage("idle"); setError(null); }}
                className="shrink-0 rounded-lg border border-red-500/40 bg-red-100 dark:bg-red-900/30 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
