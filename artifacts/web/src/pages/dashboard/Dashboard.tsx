import {
  getGetDashboardSummaryQueryKey,
  useGetDashboardSummary,
  type DashboardPriority,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, quoteStatusMap, taskStatusMap } from "@/lib/format";
import {
  FileText, CheckSquare, Users, Package,
  ArrowRight, TrendingUp, DollarSign, BarChart3, CircleCheck,
  AlertTriangle, Clock3, Link2, MessageSquare, WalletCards,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const priorityMeta: Record<
  DashboardPriority["type"],
  { label: string; icon: typeof AlertTriangle; className: string }
> = {
  overdue_task: {
    label: "Atrasado",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-700",
  },
  expiring_link: {
    label: "Link expirando",
    icon: Link2,
    className: "bg-amber-100 text-amber-800",
  },
  today_task: {
    label: "Hoje",
    icon: Clock3,
    className: "bg-sky-100 text-sky-800",
  },
  pending_payment: {
    label: "Pagamento pendente",
    icon: WalletCards,
    className: "bg-violet-100 text-violet-800",
  },
  quote_response: {
    label: "Aguardando resposta",
    icon: MessageSquare,
    className: "bg-blue-100 text-blue-800",
  },
};

export function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      refetchInterval: 60_000,
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral do seu negócio.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>Prioridades de hoje</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Resolva primeiro o que pode travar seu atendimento.
            </p>
          </div>
          {data.priorities.length > 0 && (
            <Badge variant="secondary">{data.priorities.length}</Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {data.priorities.length > 0 ? (
            <div className="divide-y">
              {data.priorities.map((priority) => {
                const meta = priorityMeta[priority.type];
                const Icon = meta.icon;
                const href =
                  priority.target === "quote"
                    ? `/orcamentos/${priority.targetId}`
                    : "/tarefas";

                return (
                  <Link
                    key={`${priority.type}-${priority.targetId}`}
                    href={href}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className={`rounded-full p-2 ${meta.className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{priority.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{priority.reason}</p>
                    </div>
                    <Badge variant="outline" className={`${meta.className} shrink-0`}>
                      {meta.label}
                    </Badge>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <CircleCheck className="h-8 w-8 text-emerald-500" />
              <p className="font-medium text-gray-900">Tudo em dia por aqui.</p>
              <p className="text-sm text-muted-foreground">
                Não há pendências que precisem da sua atenção agora.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 1 — operational KPIs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Geral</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos Pendentes</CardTitle>
              <FileText className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.pendingQuotesCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(data.pendingQuotesTotal)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clientes</CardTitle>
              <Users className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalClients}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Produtos/Serviços</CardTitle>
              <Package className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalProducts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">OS Agendadas</CardTitle>
              <CheckSquare className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.upcomingTasks.length}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2 — financial KPIs (this month) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Este mês</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Recebida</CardTitle>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">{formatCurrency(data.monthlyRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.paidTasksCount} OS pagas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conversão</CardTitle>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.conversionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">orçamentos aprovados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">OS Concluídas</CardTitle>
              <CircleCheck className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.completedTasksCount}</div>
              <p className="text-xs text-muted-foreground mt-1">concluídas + pagas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">OS Pagas</CardTitle>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.paidTasksCount}</div>
              <p className="text-xs text-muted-foreground mt-1">pagamentos confirmados</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lists */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle>Orçamentos Recentes</CardTitle>
            <Link href="/orcamentos" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {data.recentQuotes.length > 0 ? (
              <div className="divide-y">
                {data.recentQuotes.map((quote) => {
                  const status = quoteStatusMap[quote.status];
                  return (
                    <Link key={quote.id} href={`/orcamentos/${quote.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">{quote.clientName}</p>
                        <p className="text-sm text-gray-500">{formatDate(quote.createdAt)}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="font-semibold">{formatCurrency(quote.total)}</span>
                        <Badge variant="outline" className={status.color}>{status.label}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p>Nenhum orçamento recente.</p>
                <Link href="/orcamentos/novo">
                  <Button variant="link" className="mt-2 text-primary">Criar o primeiro</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle>Próximas OS</CardTitle>
            <Link href="/tarefas" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {data.upcomingTasks.length > 0 ? (
              <div className="divide-y">
                {data.upcomingTasks.map((task) => {
                  const status = taskStatusMap[task.status] ?? taskStatusMap.scheduled;
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-4">
                      <Badge variant="outline" className={`${status.color} mt-0.5 shrink-0 text-[11px]`}>
                        {status.label}
                      </Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{task.title}</p>
                        {task.clientName && <p className="text-sm text-gray-600">{task.clientName}</p>}
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(task.dueAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CheckSquare className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p>Nenhuma OS agendada.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
