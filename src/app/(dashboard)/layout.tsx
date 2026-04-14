import Topbar from '@/components/layout/Topbar';
import Sidebar from '@/components/layout/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Topbar />
      <div className="flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}