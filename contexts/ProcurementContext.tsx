"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface ProcurementContextValue {
  result: any | null;
  setResult: (result: any | null) => void;
  requestText: string;
  setRequestText: (text: string) => void;
}

const ProcurementContext = createContext<ProcurementContextValue>({
  result: null,
  setResult: () => {},
  requestText: "",
  setRequestText: () => {},
});

export function ProcurementProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<any | null>(null);
  const [requestText, setRequestText] = useState("");
  return (
    <ProcurementContext.Provider value={{ result, setResult, requestText, setRequestText }}>
      {children}
    </ProcurementContext.Provider>
  );
}

export function useProcurement() {
  return useContext(ProcurementContext);
}
