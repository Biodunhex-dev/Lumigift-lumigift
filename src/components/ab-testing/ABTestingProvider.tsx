"use client";

import { GrowthBookProvider } from "@growthbook/growthbook-react";
import { useEffect, useState } from "react";
import { GrowthBook } from "@growthbook/growthbook-react";
import { createGrowthBook, loadFeatures } from "@/lib/growthbook";

export function ABTestingProvider({ children }: { children: React.ReactNode }) {
  const [gb, setGb] = useState<GrowthBook | null>(null);

  useEffect(() => {
    const instance = createGrowthBook();
    loadFeatures(instance).then(() => setGb(instance));
    return () => instance.destroy();
  }, []);

  if (!gb) return <>{children}</>;

  return <GrowthBookProvider growthbook={gb}>{children}</GrowthBookProvider>;
}
