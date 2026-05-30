import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export const metadata: Metadata = {
  title: { template: "%s | DocuMind", default: "Dashboard" },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
        >
          <div className="p-6 max-w-screen-2xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
