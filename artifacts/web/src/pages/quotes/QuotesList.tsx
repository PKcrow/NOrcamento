import { useState } from "react";
import { useListQuotes, getListQuotesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, ArrowRight } from "lucide-react";
import { formatCurrency, formatDate, quoteStatusMap } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { QuoteStatus } from "@workspace/api-client-react";

export function QuotesList() {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  
  const { data: quotes, isLoading } = useListQuotes(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Orçamentos</h1>
          <p className="text-gray-500 mt-1">Gerencie propostas comerciais para seus clientes.</p>
        </div>
        <Link href="/orcamentos/novo">
          <Button className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 border rounded-xl shadow-sm">
        <div className="w-full max-w-xs">
          <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Filtrar por Status</p>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os orçamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(quoteStatusMap).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Carregando...</TableCell>
              </TableRow>
            ) : quotes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-900">Nenhum orçamento encontrado.</p>
                  <p className="mb-4">Comece criando sua primeira proposta.</p>
                  <Link href="/orcamentos/novo">
                    <Button variant="outline">Criar Orçamento</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              quotes?.map((quote) => {
                const status = quoteStatusMap[quote.status];
                return (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium text-gray-500">
                      <Link href={`/orcamentos/${quote.id}`} className="hover:text-primary">
                        #{quote.id.toString().padStart(4, '0')}
                      </Link>
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900">{quote.clientName}</TableCell>
                    <TableCell className="text-gray-600">{formatDate(quote.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.color}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">
                      {formatCurrency(quote.total)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/orcamentos/${quote.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-primary">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
