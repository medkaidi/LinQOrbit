"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useMounted } from "@/hooks/use-mounted";
import { useAuthStore } from "@/stores/auth-store";

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const mounted = useMounted();

  useEffect(() => {
    if (mounted && token) {
      router.replace("/dashboard");
    }
  }, [mounted, token, router]);

  if (mounted && token) {
    return null;
  }

  return <>{children}</>;
}
