import Sidebar from "../components/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-dvh bg-slate-100">
      <Sidebar />

      <div className="min-w-0 md:pl-60">
        <main className="w-full min-w-0 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}