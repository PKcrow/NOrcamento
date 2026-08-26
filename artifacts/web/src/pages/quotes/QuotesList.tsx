import { useState, useEffect } from "react";
import { useListQuotes } from "@workspace/api-client-react";
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const params: { search?: string; status?: QuoteStatus } = {};
  if (debouncedSearch) params.search = debouncedSearch;
  if (statusFilter !== "all") params.status = statusFilter;

  const { data: quotes, isLoading } = useListQuotes(
    Object.keys(params).length > 0 ? params : undefined,
  );

  const filtered = quotes ?? [];

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

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-4 border rounded-xl shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por cliente ou nº do orçamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as QuoteStatus | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os status" />
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <FileText className="w-8 h-8 text-gray-300" />
                    <p>{search ? "Nenhum orçamento encontrado para essa busca." : "Nenhum orçamento ainda."}</p>
                    {!search && (
                      <Link href="/orcamentos/novo">
                        <Button variant="link" className="text-primary">Criar o primeiro</Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((quote) => {
                const status = quoteStatusMap[quote.status];
                return (
                  <TableRow key={quote.id} className="hover:bg-gray-50/50 cursor-pointer">
                    <TableCell className="font-mono text-sm text-gray-500">
                      #{quote.id.toString().padStart(4, "0")}
                    </TableCell>
                    <TableCell className="font-medium">{quote.clientName}</TableCell>
                    <TableCell className="text-gray-500">{formatDate(quote.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.color}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(quote.total)}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Link href={`/orcamentos/${quote.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
