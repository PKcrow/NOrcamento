import { useParams, Link, useLocation } from "wouter";
import { useGetQuote, useUpdateQuote, useDeleteQuote, useGetMe, getGetQuoteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, quoteStatusMap } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Printer, Edit2, Trash2, Send, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { QuoteStatus } from "@workspace/api-client-react";

export function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const quoteId = Number(id);
  const [, setLocation] = useLocation();
  
  const { data: quote, isLoading } = useGetQuote(quoteId);
  const { data: me } = useGetMe();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();

  if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando orçamento...</div>;
  if (!quote) return <div className="p-8 text-center">Orçamento não encontrado.</div>;

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = (status: QuoteStatus) => {
    updateMutation.mutate({ id: quoteId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(quoteId) });
        toast({ title: `Status atualizado para ${quoteStatusMap[status].label}` });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Tem certeza que deseja excluir este orçamento?")) return;
    deleteMutation.mutate({ id: quoteId }, {
      onSuccess: () => {
        toast({ title: "Orçamento excluído." });
        setLocation("/orcamentos");
      }
    });
  };

  const statusInfo = quoteStatusMap[quote.status];

  return (
    <div className="space-y-8 max-w-4xl mx-auto print:max-w-none print:m-0 print:p-0">
      {/* Non-printable action bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/orcamentos">
            <Button variant="outline" size="icon" className="h-10 w-10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Orçamento #{quote.id.toString().padStart(4, '0')}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusInfo.color} variant="outline">{statusInfo.label}</Badge>
              <span className="text-sm text-gray-500">Atualizado em {formatDate(quote.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={updateMutation.isPending}>
                Mudar Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange('draft')} className="gap-2">
                <Edit2 className="w-4 h-4 text-gray-500" /> Rascunho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('sent')} className="gap-2">
                <Send className="w-4 h-4 text-blue-500" /> Marcar como Enviado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('approved')} className="gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" /> Aprovado pelo Cliente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('rejected')} className="gap-2">
                <XCircle className="w-4 h-4 text-red-500" /> Rejeitado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href={`/orcamentos/novo?id=${quote.id}`}>
            <Button variant="default" className="gap-2">
              <Edit2 className="w-4 h-4" /> Editar
            </Button>
          </Link>
          
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Printable Document Layout */}
      <Card className="shadow-lg border-gray-200 overflow-hidden print:shadow-none print:border-none print:w-full">
        {/* Header Strip */}
        <div className="h-4 w-full bg-primary print:bg-black !bg-opacity-100" style={{ backgroundColor: 'var(--primary)' }}></div>
        
        <CardContent className="p-8 md:p-12 space-y-12">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Orçamento</h2>
              <p className="text-gray-500 font-mono mt-1">#{quote.id.toString().padStart(4, '0')}</p>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-gray-900 text-lg">{me?.teamName || "Negócio"}</h3>
              <p className="text-sm text-gray-500">{me?.name}</p>
              <p className="text-sm text-gray-500">{me?.email}</p>
            </div>
          </div>

          {/* Info Block */}
          <div className="flex justify-between border-t border-b py-6 border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preparado Para</p>
              <p className="font-bold text-gray-900 text-lg">{quote.clientName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Data de Emissão</p>
              <p className="font-medium text-gray-900">{formatDate(quote.createdAt)}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-8">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-900 text-sm">
                  <th className="py-3 font-bold text-gray-900 w-full">Descrição do Serviço/Produto</th>
                  <th className="py-3 font-bold text-gray-900 text-center px-4">Qtd</th>
                  <th className="py-3 font-bold text-gray-900 text-right px-4 whitespace-nowrap">Valor Unit.</th>
                  <th className="py-3 font-bold text-gray-900 text-right whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quote.items.map((item, i) => (
                  <tr key={item.id || i}>
                    <td className="py-4 text-gray-900">{item.description}</td>
                    <td className="py-4 text-center text-gray-600">{item.quantity}</td>
                    <td className="py-4 text-right text-gray-600 whitespace-nowrap">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-4 text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
                {quote.laborCost > 0 && (
                  <tr>
                    <td className="py-4 text-gray-900" colSpan={3}>Mão de Obra</td>
                    <td className="py-4 text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(quote.laborCost)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total Block */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm bg-gray-50 rounded-xl p-6">
              <div className="flex justify-between items-center text-lg font-black text-gray-900">
                <span>Valor Total</span>
                <span className="text-2xl text-primary">{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="pt-8 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Observações e Condições</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
            </div>
          )}
          
          <div className="pt-12 text-center text-xs text-gray-400 print:block">
            Este é um documento comercial válido por 15 dias a partir da data de emissão.
          </div>
        </CardContent>
      </Card>
      
      {/* CSS for printing hidden in global css but explicit overrides here */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:max-w-none * { visibility: visible; }
          .print\\:max-w-none { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
