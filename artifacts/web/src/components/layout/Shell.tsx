import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  CalendarDays,
  BarChart3,
  Users,
  Package,
  ClipboardList,
  UsersRound,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronsUpDown,
  Plus,
  UserPlus,
  Check,
} from "lucide-react";
import {
  useGetMe,
  useListTeams,
  useSwitchTeam,
  useGetNotifications,
  getGetMeQueryKey,
  getListTeamsQueryKey,
  getGetNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useCreateTeam, useJoinTeam } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";

const navItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Orçamentos", path: "/orcamentos", icon: FileText },
  { name: "Tarefas", path: "/tarefas", icon: CheckSquare },
  { name: "Agenda", path: "/agenda", icon: CalendarDays },
  { name: "Relatórios", path: "/relatorios", icon: BarChart3 },
  { name: "Clientes", path: "/clientes", icon: Users },
  { name: "Produtos", path: "/produtos", icon: Package },
  { name: "Modelos", path: "/modelos", icon: ClipboardList },
  { name: "Equipes", path: "/equipes", icon: UsersRound },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data: me } = useGetMe();
  const { data: teams } = useListTeams();
  const switchTeam = useSwitchTeam();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileNotificationsOpen, setIsMobileNotificationsOpen] = useState(false);
  const [isDesktopNotificationsOpen, setIsDesktopNotificationsOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [teamDialog, setTeamDialog] = useState<"create" | "join" | null>(null);

  const { data: notifications } = useGetNotifications({
    query: { refetchInterval: 60000, queryKey: getGetNotificationsQueryKey() },
  });

  const notificationCount =
    (notifications?.dueSoonTasks.length || 0) +
    (notifications?.overdueTasks.length || 0) +
    (notifications?.quoteResponses.length || 0);

  const notificationItems: NotificationItem[] = [
    ...(notifications?.quoteResponses || []).map((quote) => ({
      kind: "quote" as const,
      ...quote,
    })),
    ...(notifications?.overdueTasks || []).map((t) => ({
      kind: "task" as const,
      ...t,
      overdue: true,
    })),
    ...(notifications?.dueSoonTasks || []).map((t) => ({
      kind: "task" as const,
      ...t,
      overdue: false,
    })),
  ];

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  const handleSwitchTeam = (teamId: string) => {
    if (teamId === me?.teamId) { setIsTeamOpen(false); return; }
    switchTeam.mutate(
      { data: { teamId } },
      {
        onSuccess: () => {
          // Clear all team-scoped data caches
          queryClient.clear();
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setIsTeamOpen(false);
          toast({ title: "Equipe alterada com sucesso!" });
        },
        onError: () => toast({ title: "Erro ao trocar equipe", variant: "destructive" }),
      },
    );
  };

  const TeamSwitcher = () => (
    <Popover open={isTeamOpen} onOpenChange={setIsTeamOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-left group">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Equipe ativa
            </div>
            <div className="font-semibold text-sidebar-foreground text-sm truncate">
              {me?.teamName || "Carregando…"}
            </div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-sidebar-foreground/50 shrink-0 group-hover:text-sidebar-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start" side="right">
        <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Suas equipes
        </div>
        {teams?.map((t) => (
          <button
            key={t.id}
            onClick={() => handleSwitchTeam(t.id)}
            disabled={switchTeam.isPending}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100 text-sm transition-colors"
          >
            <Check
              className={cn(
                "w-4 h-4 shrink-0",
                t.id === me?.teamId ? "text-primary opacity-100" : "opacity-0",
              )}
            />
            <span className="flex-1 text-left truncate font-medium">{t.name}</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
              {t.role === "owner" ? "Dono" : "Membro"}
            </Badge>
          </button>
        ))}
        <div className="border-t mt-1 pt-1 space-y-0.5">
          <button
            onClick={() => { setIsTeamOpen(false); setTeamDialog("create"); }}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100 text-sm text-primary font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Criar nova equipe
          </button>
          <button
            onClick={() => { setIsTeamOpen(false); setTeamDialog("join"); }}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100 text-sm text-primary font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Entrar com código
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col",
            isMobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Logo */}
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

          {/* Team switcher */}
          <div className="p-2 border-b border-sidebar-border shrink-0">
            <TeamSwitcher />
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                location === item.path ||
                (item.path !== "/" && location.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path}>
                  <span
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                    {item.path === "/tarefas" && notificationCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px]"
                      >
                        {notificationCount}
                      </Badge>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom links */}
          <div className="p-3 border-t border-sidebar-border shrink-0 space-y-1">
            <Link href="/equipe">
              <span
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer",
                  location.startsWith("/equipe")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Settings className="w-5 h-5" />
                Ajustes de Empresa
              </span>
            </Link>
            <button
              onClick={() =>
                signOut({
                  redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
                })
              }
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>

          {/* User info */}
          <div className="p-4 bg-sidebar-accent/30 flex items-center gap-3 shrink-0">
            <img
              src={user?.imageUrl}
              alt={user?.fullName || "User"}
              className="w-8 h-8 rounded-full border border-sidebar-border"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{user?.fullName}</span>
              <span className="text-xs text-sidebar-foreground/60 truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile Header */}
          <header className="h-14 bg-white border-b flex items-center justify-between px-4 md:hidden shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="p-1 -ml-1 text-gray-500"
              >
                <Menu className="w-6 h-6" />
              </button>
              <span className="font-bold text-gray-900">Gestão Autônomos</span>
            </div>
            <NotificationBell
              count={notificationCount}
              items={notificationItems}
              isOpen={isMobileNotificationsOpen}
              onOpenChange={setIsMobileNotificationsOpen}
              onSelectTask={() => {
                setIsMobileNotificationsOpen(false);
                setLocation("/tarefas");
              }}
              onSelectQuote={(quoteId) => {
                setIsMobileNotificationsOpen(false);
                setLocation(`/orcamentos/${quoteId}`);
              }}
            />
          </header>

          {/* Desktop Header */}
          <header className="h-16 bg-white border-b hidden md:flex items-center justify-end px-8 shrink-0">
            <NotificationBell
              count={notificationCount}
              items={notificationItems}
              isOpen={isDesktopNotificationsOpen}
              onOpenChange={setIsDesktopNotificationsOpen}
              onSelectTask={() => {
                setIsDesktopNotificationsOpen(false);
                setLocation("/tarefas");
              }}
              onSelectQuote={(quoteId) => {
                setIsDesktopNotificationsOpen(false);
                setLocation(`/orcamentos/${quoteId}`);
              }}
            />
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto w-full p-4 md:p-8">{children}</div>
          </main>
        </div>
      </div>

      {/* Create / Join team dialogs */}
      <TeamQuickDialog
        mode={teamDialog}
        onClose={() => setTeamDialog(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setTeamDialog(null);
        }}
      />
    </>
  );
}

function TeamQuickDialog({
  mode,
  onClose,
  onSuccess,
}: {
  mode: "create" | "join" | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();
  const { toast } = useToast();

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (new FormData(e.currentTarget).get("name") as string).trim();
    if (!name) return;
    createTeam.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          toast({ title: `Equipe "${name}" criada!` });
          onSuccess();
        },
        onError: () => toast({ title: "Erro ao criar equipe", variant: "destructive" }),
      },
    );
  };

  const handleJoin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inviteCode = (new FormData(e.currentTarget).get("inviteCode") as string).trim();
    if (!inviteCode) return;
    joinTeam.mutate(
      { data: { inviteCode } },
      {
        onSuccess: (data) => {
          toast({ title: `Entrou na equipe "${data.name}"!` });
          onSuccess();
        },
        onError: () => toast({ title: "Código inválido", variant: "destructive" }),
      },
    );
  };

  return (
    <>
      <Dialog open={mode === "create"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Criar nova equipe
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Nome da equipe</Label>
              <Input id="create-name" name="name" required placeholder="Ex: Carlos Elétrica" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={createTeam.isPending}>
                {createTeam.isPending ? "Criando…" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "join"} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Entrar com código
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJoin} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="join-code">Código de convite</Label>
              <Input
                id="join-code"
                name="inviteCode"
                required
                placeholder="Ex: AB12CD34"
                className="font-mono tracking-widest uppercase"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={joinTeam.isPending}>
                {joinTeam.isPending ? "Verificando…" : "Entrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface NotificationTaskItem {
  kind: "task";
  id: number;
  title: string;
  dueAt: string;
  clientName: string | null;
  overdue: boolean;
}

interface QuoteResponseNotificationItem {
  kind: "quote";
  id: number;
  status: "approved" | "rejected";
  clientName: string;
  respondedAt: string;
}

type NotificationItem = NotificationTaskItem | QuoteResponseNotificationItem;

function NotificationBell({
  count,
  items,
  isOpen,
  onOpenChange,
  onSelectTask,
  onSelectQuote,
}: {
  count: number;
  items: NotificationItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTask: () => void;
  onSelectQuote: (quoteId: number) => void;
}) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button className="relative p-1" aria-label="Notificações">
          <Bell className="w-5 h-5 text-gray-500" />
          {count > 0 && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b">
          <p className="font-semibold text-gray-900 text-sm">Notificações</p>
          <p className="text-xs text-gray-500">Respostas de orçamento e lembretes de tarefas</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            items.map((item) =>
              item.kind === "quote" ? (
                <button
                  key={`quote-${item.id}`}
                  onClick={() => onSelectQuote(item.id)}
                  className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">
                      Orçamento #{item.id.toString().padStart(4, "0")}
                    </span>
                    <Badge
                      variant={item.status === "approved" ? "default" : "destructive"}
                      className="shrink-0 text-[10px] h-5"
                    >
                      {item.status === "approved" ? "Aprovado" : "Recusado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.clientName} · {formatDateTime(item.respondedAt)}
                  </p>
                </button>
              ) : (
                <button
                  key={`task-${item.id}`}
                  onClick={onSelectTask}
                  className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">
                      {item.title}
                    </span>
                    {item.overdue && (
                      <Badge variant="destructive" className="shrink-0 text-[10px] h-5">
                        Atrasada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.clientName ? `${item.clientName} · ` : ""}
                    {formatDateTime(item.dueAt)}
                  </p>
                </button>
              ),
            )
          )}
        </div>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full" onClick={onSelectTask}>
            Ver todas as tarefas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
