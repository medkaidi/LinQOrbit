import type { Metadata } from "next";

import { ProfileView } from "@/features/candidate/profile-view";

export const metadata: Metadata = {
  title: "My professional profile — LinQOrbit",
  description: "Your professional profile on LinQOrbit.",
};

export default function ProfilePage() {
  return <ProfileView />;
}
