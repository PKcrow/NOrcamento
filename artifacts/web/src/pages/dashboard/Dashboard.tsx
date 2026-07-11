import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, quoteStatusMap } from "@/lib/format";
import { FileText, CheckSquare, Users, Package, ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos Pendentes</CardTitle>
            <FileText className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.pendingQuotesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(data.pendingQuotesTotal)}
            </p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Produtos/Serviços</CardTitle>
            <Package className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tarefas Próximas</CardTitle>
            <CheckSquare className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.upcomingTasks.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle>Orçamentos Recentes</CardTitle>
            </div>
            <Link href="/orcamentos" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {data.recentQuotes.length > 0 ? (
              <div className="divide-y">
                {data.recentQuotes.map(quote => {
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
                  )
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
            <div>
              <CardTitle>Tarefas Pendentes</CardTitle>
            </div>
            <Link href="/tarefas" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {data.upcomingTasks.length > 0 ? (
              <div className="divide-y">
                {data.upcomingTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-4">
                    <div className="mt-1">
                      <Clock className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.clientName && <p className="text-sm text-gray-600">Cliente: {task.clientName}</p>}
                      <p className="text-xs text-gray-500 mt-1">Prazo: {formatDate(task.dueAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CheckSquare className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p>Nenhuma tarefa próxima.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
