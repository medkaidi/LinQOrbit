import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { QueryProvider } from "@/components/layout/query-provider";
import "./globals.css";
import "./material-symbols.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LinQOrbit",
  description: "Recruitment platform connecting candidates, recruiters and companies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface font-body-md text-on-surface">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
