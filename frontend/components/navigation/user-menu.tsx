"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { MenuItem, MenuPanel, MenuSeparator } from "@/components/ui/menu";
import { useAuth } from "@/hooks/use-auth";
import { useRecruiterProfile } from "@/hooks/use-recruiter";
import { useViewMode } from "@/hooks/use-view-mode";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Menu utilisateur. `compact` (rail replié du sidenav admin, D40) masque le
 * bloc nom/email — le déclencheur garde son `aria-label`.
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { logout } = useAuth();
  const user = useAuthStore((state) => state.user);
  const { mode } = useViewMode();
  const recruiter = useRecruiterProfile({ enabled: mode === "recruiter" });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const displayName = `${user.firstName} ${user.lastName.charAt(0)}.`;
  const isRecruiterMode = mode === "recruiter";
  const headline = recruiter.profile?.headline ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-canvas-subtle transition-[background-color,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep active:scale-[0.98] cursor-pointer"
      >
        {!compact && (
          <span className="hidden sm:flex flex-col text-right">
            <span className="text-xs text-text-primary font-bold leading-tight">{displayName}</span>
            {isRecruiterMode && headline ? (
              <span className="text-[11px] text-orange-deep leading-tight font-medium truncate max-w-[10rem]">
                {headline}
              </span>
            ) : (
              <span className="text-[11px] text-text-tertiary leading-tight font-medium truncate max-w-[10rem]">
                {user.email}
              </span>
            )}
          </span>
        )}
        <span className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed border-2 border-slate-border flex items-center justify-center text-label-md font-bold shrink-0">
          {initials}
        </span>
        <Icon
          name="expand_more"
          className={`text-[18px] text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <MenuPanel label="Account menu" className="w-64">
          <div className="px-3 py-2 border-b border-slate-border mb-1">
            <p className="text-body-md font-body-md font-bold text-text-primary truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-body-sm font-body-sm text-text-tertiary truncate">{user.email}</p>
          </div>

          <MenuItem icon="person" href="/account" onClick={() => setOpen(false)}>
            My Account
          </MenuItem>
          {isRecruiterMode ? (
            <MenuItem
              icon="badge"
              href="/recruiter/settings"
              onClick={() => setOpen(false)}
            >
              Recruiter settings
            </MenuItem>
          ) : null}
          <MenuItem icon="lock" href="/change-password" onClick={() => setOpen(false)}>
            Change password
          </MenuItem>

          <MenuSeparator />

          <MenuItem icon="logout" tone="danger" onClick={logout}>
            Log out
          </MenuItem>
        </MenuPanel>
      ) : null}
    </div>
  );
}
