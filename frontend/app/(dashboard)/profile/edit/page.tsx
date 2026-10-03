import type { Metadata } from "next";

import { ProfileEdit } from "@/features/candidate/profile-edit";

export const metadata: Metadata = {
  title: "Edit profile — LinQOrbit",
  description: "Edit your professional profile on LinQOrbit.",
};

export default function ProfileEditPage() {
  return <ProfileEdit />;
}
