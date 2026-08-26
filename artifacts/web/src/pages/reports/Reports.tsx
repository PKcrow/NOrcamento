import { useState } from "react";
import { useGetMonthlyReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ChevronLeft, ChevronRight, Download, DollarSign, CheckSquare,
  CircleCheck, FileText, BadgeCheck,
} from "lucide-react";

function formatMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

export function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useGetMonthlyReport({ year, month });

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleExportCsv = () => {
    if (!data) return;

    const separator = ";";
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const header = ["Título", "Cliente", "Data de Pagamento", "Valor"].map(escape).join(separator);

    const rows = data.paidTasks.map((task) =>
      [
        escape(task.title),
        escape(task.clientName ?? ""),
        escape(formatDate(task.paidAt)),
        escape(formatCurrency(task.paidAmount ?? 0)),
      ].join(separator),
    );

    const summaryRow = [
      escape("Total"),
      escape(""),
      escape(""),
      escape(formatCurrency(data.revenue)),
    ].join(separator);

    const csv = "\uFEFF" + [header, ...rows, summaryRow].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${year}-${String(month).padStart(2, "0")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Relatório mensal</h1>
          <p className="text-gray-500 mt-1">Resumo financeiro e operacional do período.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
            <Button variant="ghost" size="icon" onClick={goToPrevMonth} aria-label="Mês anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-medium capitalize">
              {formatMonthLabel(year, month)}
            </span>
            <Button variant="ghost" size="icon" onClick={goToNextMonth} aria-label="Próximo mês">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={handleExportCsv} disabled={!data}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      ) : !data ? (
        <div className="p-8 text-center text-gray-500">
          <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p>Não foi possível carregar o relatório.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita</CardTitle>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">{formatCurrency(data.revenue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">OS pagas</CardTitle>
                <BadgeCheck className="w-4 h-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.paidTasksCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">OS concluídas</CardTitle>
                <CheckSquare className="w-4 h-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.completedTasksCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos enviados</CardTitle>
                <FileText className="w-4 h-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.quotesSentCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Orçamentos aprovados</CardTitle>
                <CircleCheck className="w-4 h-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.quotesApprovedCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>OS pagas no período</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.paidTasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data de Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.paidTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium text-gray-900">{task.title}</TableCell>
                        <TableCell className="text-gray-600">{task.clientName ?? "—"}</TableCell>
                        <TableCell className="text-gray-600">{formatDate(task.paidAt)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(task.paidAmount ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <DollarSign className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p>Nenhuma OS paga neste período.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
