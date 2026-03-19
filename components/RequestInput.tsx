"use client";

const EXAMPLE =
  "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20 with premium specification. Budget capped at 25 199.55 EUR. Please use Dell Enterprise Europe with no exception.";

import { Loader2, Paperclip, Mic, X, CheckCircle2, XCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (file?: File | null) => void;
  onLoadExample?: () => void;
  disabled?: boolean;
}

export default function RequestInput({ value, onChange, onSubmit, onLoadExample, disabled = false }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const isRecordingRef = useRef(false);

  const [validations, setValidations] = useState({ quantity: false, budget: false, location: false, timeline: false });
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!value.trim()) {
      setValidations({ quantity: false, budget: false, location: false, timeline: false });
      return;
    }
    const handler = setTimeout(async () => {
      setIsValidating(true);
      try {
        const res = await fetch("/api/live-validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value })
        });
        if (res.ok) {
          const data = await res.json();
          setValidations({
            quantity: Boolean(data.quantity),
            budget: Boolean(data.budget),
            location: Boolean(data.location),
            timeline: Boolean(data.timeline)
          });
        }
      } catch (e) {
        console.error("Live validation failed", e);
      } finally {
        setIsValidating(false);
      }
    }, 600);
    return () => clearTimeout(handler);
  }, [value]);

  // Created once on mount — refs keep onChange/value current without recreating the instance
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setSpeechSupported(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        const cur = valueRef.current;
        onChangeRef.current(cur + (cur.endsWith(" ") || cur === "" ? "" : " ") + transcript);
      }
    };

    recognition.onerror = (event: any) => {
      // "aborted" fires on a normal .stop() call — not a real error
      if (event.error === "aborted") return;
      console.error("Speech recognition error", event.error);
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    return () => { try { recognition.stop(); } catch {} };
  }, []);

  const toggleRecording = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isRecordingRef.current) {
      recognitionRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        isRecordingRef.current = true;
        setIsRecording(true);
      } catch (err) {
        console.error("Voice start error", err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(file);
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 no-print">
      <div className="flex flex-col gap-1 text-center md:text-left">
        <h2 className="text-gray-900 dark:text-white text-xl font-bold tracking-tight transition-colors duration-300">New Purchase Request</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
          Describe your procurement need in plain language — any format, no constraints.
        </p>
      </div>

      <div className="relative">
        <textarea
          className="w-full rounded-xl px-5 py-4 text-sm leading-relaxed resize-none outline-none transition-all duration-300 animate-pulse-border bg-white dark:bg-[#12151f] text-gray-900 dark:text-white border border-gray-200 dark:border-[#1e2130] focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          style={{ minHeight: "160px", paddingBottom: "48px" }}
          placeholder="Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF..."
          rows={7}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          onFocus={(e) => { e.currentTarget.classList.remove("animate-pulse-border"); }}
          onBlur={() => {}}
        />

        {/* Action Icons Overlay */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
          {/* File Attachment */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.csv,.xlsx,.txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
            }}
          />
          <button
            type="button"
            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Voice Input */}
          <button
            type="button"
            className={`p-2 rounded-lg transition-colors ${
              isRecording
                ? "text-red-600 bg-red-100 dark:bg-red-900/30 animate-pulse-slow border border-red-200 dark:border-red-800"
                : "text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title={speechSupported ? (isRecording ? "Stop recording" : "Start voice input") : "Voice input not supported in this browser"}
            onClick={toggleRecording}
            disabled={disabled || !speechSupported}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* File Chip display */}
      {file && (
        <div className="flex items-center gap-2 self-start bg-gray-900 dark:bg-gray-800 text-white px-3 py-1.5 rounded-full text-xs font-medium animate-fade-slide-up">
          <Paperclip className="h-3.5 w-3.5 opacity-70" />
          <span className="truncate max-w-[200px]" title={file.name}>{file.name}</span>
          <div className="w-px h-3 bg-white/20 ml-1"></div>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
            title="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Live Validation Checklist */}
      {value.trim() && (
        <div className="flex flex-wrap items-center gap-5 bg-gray-50/80 dark:bg-white/[0.02] px-4 py-3 rounded-xl border border-gray-200 dark:border-white/5 animate-fade-slide-up no-print">
          <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors duration-300 ${validations.quantity ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {!validations.quantity && isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : validations.quantity ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            Quantity
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors duration-300 ${validations.budget ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {!validations.budget && isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : validations.budget ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            Budget
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors duration-300 ${validations.location ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {!validations.location && isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : validations.location ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            Location
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors duration-300 ${validations.timeline ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {!validations.timeline && isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : validations.timeline ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            Timeline
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onLoadExample ? onLoadExample() : onChange(EXAMPLE)}
          disabled={disabled}
          className="text-xs underline underline-offset-2 transition-opacity disabled:opacity-40"
          style={{ color: "#dc2626" }}
        >
          Load example
        </button>

        <button
          type="button"
          onClick={() => onSubmit(file)}
          disabled={Boolean(disabled || (!value.trim() && !file))}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ backgroundColor: "#dc2626" }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#b91c1c"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#dc2626"; }}
        >
          {disabled ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing…
            </>
          ) : (
            "Analyze Request"
          )}
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 transition-colors duration-300">
        Powered by ProcureTrace by ChainIQ
      </p>
    </div>
  );
}
