import Topbar from '@/components/layout/Topbar';
import Sidebar from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import MustChangePasswordModal from '@/components/auth/MustChangePasswordModal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-[1700px] mx-auto w-full transition-all duration-300">
              {children}
            </div>
          </main>
        </div>
      </div>
      <MustChangePasswordModal />
    </SidebarProvider>
  );
}