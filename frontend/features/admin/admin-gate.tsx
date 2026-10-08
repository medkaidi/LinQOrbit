"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useMounted } from "@/hooks/use-mounted";
import { useAuthStore } from "@/stores/auth-store";
import { isAdmin } from "@/lib/utils/roles";

/**
 * Garde de la zone d'administration : rend les enfants uniquement pour un
 * compte portant le rôle ADMIN, sinon retourne au dashboard (miroir
 * d'AuthGate — jamais de router côté axios).
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const mounted = useMounted();
  const allowed = isAdmin(user);

  useEffect(() => {
    if (mounted && !allowed) {
      router.replace("/dashboard");
    }
  }, [mounted, allowed, router]);

  if (!mounted || !allowed) {
    return null;
  }

  return <>{children}</>;
}
