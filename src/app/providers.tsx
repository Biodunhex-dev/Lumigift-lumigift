"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { ToastProvider } from "@/components/ui/ToastContext";
import { Toaster } from "@/components/ui/Toaster";
import { CrispChat } from "@/components/support/CrispChat";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>
          {children}
          <Toaster />
          <CrispChat />
        </ToastProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
