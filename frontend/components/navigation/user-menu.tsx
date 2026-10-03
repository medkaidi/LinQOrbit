"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

export function UserMenu() {
  const { logout } = useAuth();
  const user = useAuthStore((state) => state.user);
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
        <span className="hidden sm:flex flex-col text-right">
          <span className="text-xs text-text-primary font-bold leading-tight">{displayName}</span>
          <span className="text-[11px] text-text-tertiary leading-tight font-medium truncate max-w-[10rem]">
            {user.email}
          </span>
        </span>
        <span className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed border-2 border-slate-border flex items-center justify-center text-label-md font-bold shrink-0">
          {initials}
        </span>
        <Icon
          name="expand_more"
          className={`text-[18px] text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-canvas-white border border-slate-border shadow-md p-2 z-50 origin-top-right transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:scale-95 motion-reduce:transition-none"
        >
          <div className="px-3 py-2 border-b border-slate-border mb-1">
            <p className="text-body-md font-body-md font-bold text-text-primary truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-body-sm font-body-sm text-text-tertiary truncate">{user.email}</p>
          </div>

          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-body-md font-body-md text-text-primary hover:bg-canvas-subtle transition-colors"
          >
            <Icon name="person" className="text-[18px] text-text-secondary" />
            My Account
          </Link>
          <Link
            href="/change-password"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-body-md font-body-md text-text-primary hover:bg-canvas-subtle transition-colors"
          >
            <Icon name="lock" className="text-[18px] text-text-secondary" />
            Change password
          </Link>

          <div className="my-1 h-px bg-slate-border" role="separator" />

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-body-md font-body-md text-error hover:bg-canvas-subtle transition-colors cursor-pointer"
          >
            <Icon name="logout" className="text-[18px]" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
