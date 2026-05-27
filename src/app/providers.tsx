"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider } from "@/components/ui/ToastContext";
import { Toaster } from "@/components/ui/Toaster";
import { ABTestingProvider } from "@/components/ab-testing/ABTestingProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ABTestingProvider>
          {children}
          <Toaster />
        </ABTestingProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
