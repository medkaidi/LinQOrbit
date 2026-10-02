import type { Metadata } from "next";

import { ProfileView } from "@/features/auth/profile";

export const metadata: Metadata = {
  title: "Profile — LinQOrbit",
  description: "Your LinQOrbit account profile.",
};

export default function ProfilePage() {
  return <ProfileView />;
}
