import type { Metadata } from "next";

import { AccountView } from "@/features/auth/account";

export const metadata: Metadata = {
  title: "My account — LinQOrbit",
  description: "Your LinQOrbit account details.",
};

export default function AccountPage() {
  return <AccountView />;
}
