import type { Metadata } from "next";

import { AdminReportDetailView } from "@/features/admin/admin-report-detail-view";

export const metadata: Metadata = {
  title: "AI report — Administration — LinQOrbit",
  description: "Internal report on an AI assessment, for administrators.",
};

export default async function AdminReportPage({
  params,
}: PageProps<"/admin/reports/[reportId]">) {
  const { reportId } = await params;
  return <AdminReportDetailView reportId={reportId} />;
}
