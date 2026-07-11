import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  Users, 
  Package, 
  Settings, 
  LogOut,
  Bell,
  Menu,
  X
} from "lucide-react";
import {
  useGetMe,
  useGetNotifications,
  getGetNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

const navItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Orçamentos", path: "/orcamentos", icon: FileText },
  { name: "Tarefas", path: "/tarefas", icon: CheckSquare },
  { name: "Clientes", path: "/clientes", icon: Users },
  { name: "Produtos", path: "/produtos", icon: Package },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data: me } = useGetMe();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Poll notifications every minute
  const { data: notifications } = useGetNotifications({
    query: { refetchInterval: 60000, queryKey: getGetNotificationsQueryKey() },
  });
  
  const notificationCount = (notifications?.dueSoonTasks.length || 0) + (notifications?.overdueTasks.length || 0);

  // Close mobile nav on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-xl">
              G
            </div>
            <span className="font-bold tracking-tight truncate">Gestão Autônomos</span>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setIsMobileOpen(false)}>
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        </div>

        <div className="p-4 border-b border-sidebar-border shrink-0">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-1">Sua Equipe</div>
          <div className="font-medium text-sidebar-foreground truncate">{me?.teamName || 'Carregando...'}</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path}>
                <span className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}>
                  <item.icon className="w-5 h-5" />
                  {item.name}
                  {item.path === "/tarefas" && notificationCount > 0 && (
                    <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px]">
                      {notificationCount}
                    </Badge>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border shrink-0 space-y-1">
          <Link href="/equipe">
            <span className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer",
              location.startsWith("/equipe")
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <Settings className="w-5 h-5" />
              Ajustes da Equipe
            </span>
          </Link>
          <button 
            onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
        
        <div className="p-4 bg-sidebar-accent/30 flex items-center gap-3 shrink-0">
          <img src={user?.imageUrl} alt={user?.fullName || "User"} className="w-8 h-8 rounded-full border border-sidebar-border" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">{user?.fullName}</span>
            <span className="text-xs text-sidebar-foreground/60 truncate">{user?.primaryEmailAddress?.emailAddress}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 md:hidden shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileOpen(true)} className="p-1 -ml-1 text-gray-500">
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-gray-900">Gestão Autônomos</span>
          </div>
          <div className="relative">
            <Bell className="w-5 h-5 text-gray-500" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
