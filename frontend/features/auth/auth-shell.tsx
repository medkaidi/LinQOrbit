import type { ReactNode } from "react";

export type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative w-full min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden bg-surface">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-fixed/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full bg-secondary-fixed/40 blur-3xl pointer-events-none" />
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="50%" cy="50%" r="380" fill="none" stroke="#f97316" strokeDasharray="6 8" strokeWidth="1" />
        <circle cx="50%" cy="50%" r="560" fill="none" stroke="#cbd5e1" strokeDasharray="8 12" strokeWidth="1" />
        <ellipse
          cx="50%"
          cy="50%"
          rx="700"
          ry="340"
          fill="none"
          stroke="#bec6e0"
          strokeWidth="1"
          transform="rotate(-28 700 450)"
        />
      </svg>
      <div className="relative z-10 w-full max-w-[540px] flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}
