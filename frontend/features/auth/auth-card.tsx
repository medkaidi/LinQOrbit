import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
};

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full bg-surface-container-lowest rounded-lg p-6 sm:p-9 shadow-sm flex flex-col">
      {children}
    </div>
  );
}
