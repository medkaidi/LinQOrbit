import { SiteFooter } from "@/features/marketing/site-footer";
import { SiteHeader } from "@/features/marketing/site-header";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen flex flex-col bg-surface antialiased selection:bg-orange-subtle selection:text-orange-deep">
      <SiteHeader />
      <main className="pt-16 flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
