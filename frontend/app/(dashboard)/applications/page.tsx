import type { Metadata } from "next";

import { ApplicationsView } from "@/features/application/applications-view";

export const metadata: Metadata = {
  title: "My applications — LinQOrbit",
  description: "The job applications you submitted on LinQOrbit.",
};

export default function ApplicationsPage() {
  return <ApplicationsView />;
}
