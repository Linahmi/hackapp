"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ProcurementContextValue {
  result: any | null;
  setResult: (result: any | null) => void;
}

const ProcurementContext = createContext<ProcurementContextValue>({
  result: null,
  setResult: () => {},
});

export function ProcurementProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<any | null>(null);
  return (
    <ProcurementContext.Provider value={{ result, setResult }}>
      {children}
    </ProcurementContext.Provider>
  );
}

export function useProcurement() {
  return useContext(ProcurementContext);
}
