import type { Metadata } from "next";

import { ApplyView } from "@/features/application/apply-view";

export const metadata: Metadata = {
  title: "Apply — LinQOrbit",
  description: "Apply to a published job offer on LinQOrbit.",
};

export default async function ApplyPage({ params }: PageProps<"/jobs/[job]/apply">) {
  const { job } = await params;
  return <ApplyView jobParam={job} />;
}
