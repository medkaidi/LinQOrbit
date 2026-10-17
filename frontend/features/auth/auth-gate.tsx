"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useMounted } from "@/hooks/use-mounted";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Garde de la zone authentifiée : sans token → `/login` en mémorisant la
 * route demandée (`?next=`), que les formulaires auth consomment pour
 * ramener l'utilisateur au bon endroit après connexion (D56).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const mounted = useMounted();

  useEffect(() => {
    if (mounted && !token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, token, router, pathname]);

  if (!mounted || !token) {
    return null;
  }

  return <>{children}</>;
}
