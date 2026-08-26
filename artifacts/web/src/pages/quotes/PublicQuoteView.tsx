import { useState } from "react";
import { useParams } from "wouter";
import { useGetPublicQuote, useRespondPublicQuote, getGetPublicQuoteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime, quoteStatusMap } from "@/lib/format";
import { normalizeStoredObjectUrl } from "@/lib/objectUrl";
import { downloadPdfFile, generateQuotePdf } from "@/lib/documentPdf";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Printer, Download } from "lucide-react";
import type { ApiError, PublicQuoteResponseInputAction } from "@workspace/api-client-react";

export function PublicQuoteView() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useGetPublicQuote(token);
  const respondMutation = useRespondPublicQuote();
  const [note, setNote] = useState("");
  const [responseLocked, setResponseLocked] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const quote = data?.quote;
  const company = data?.company;

  const handleRespond = (action: PublicQuoteResponseInputAction) => {
    if (responseLocked || respondMutation.isPending) return;
    setResponseLocked(true);
    respondMutation.mutate(
      { token, data: { action, note: note.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPublicQuoteQueryKey(token) });
          toast({
            title: action === "approved" ? "Orçamento aprovado!" : "Orçamento recusado",
          });
        },
        onError: (mutationError) => {
          const status = (mutationError as ApiError | undefined)?.status;
          if (status === 409) {
            queryClient.invalidateQueries({ queryKey: getGetPublicQuoteQueryKey(token) });
            return;
          }
          setResponseLocked(false);
          toast({
            title: "Não foi possível registrar sua resposta",
            description: "Tente novamente em instantes.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDownloadPdf = async () => {
    if (!quote || isPdfGenerating) return;
    setIsPdfGenerating(true);
    try {
      const file = await generateQuotePdf(quote, company ?? undefined);
      downloadPdfFile(file);
      toast({
        title: "PDF gerado",
        description: "O orçamento foi baixado para o seu dispositivo.",
      });
    } catch {
      toast({
        title: "Não foi possível gerar o PDF",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsPdfGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  const status = (error as ApiError | undefined)?.status;
  if (isError || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {status === 404 ? "Link inválido ou expirado" : "Não foi possível abrir o orçamento"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {status === 404
              ? "Verifique o link enviado ou solicite um novo ao prestador de serviço."
              : "Ocorreu um erro ao carregar o orçamento. Tente novamente mais tarde."}
          </p>
        </div>
      </div>
    );
  }

  const statusInfo = quoteStatusMap[quote.status];
  const canRespond = quote.status === "sent";
  const isApproved = quote.status === "approved";
  const isRejected = quote.status === "rejected";

  return (
    <div className="public-quote-print min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Document card */}
        <div className="public-quote-document overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm print:border-none print:shadow-none print:overflow-visible">
          <div className="h-3 w-full bg-primary" style={{ backgroundColor: "var(--primary)" }} />
          <div className="space-y-10 p-6 sm:p-10">
            {/* Header */}
            <div className="flex flex-col gap-6 border-b border-gray-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                {company?.logoUrl ? (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white p-2">
                    <img
                      src={normalizeStoredObjectUrl(company.logoUrl)}
                      alt={company.name}
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900">{company?.name || "Negócio"}</h3>
                  {company?.address && <p className="mt-1 text-sm text-gray-500">{company.address}</p>}
                  {company?.phone && <p className="text-sm text-gray-500">{company.phone}</p>}
                  {company?.email && <p className="break-all text-sm text-gray-500">{company.email}</p>}
                </div>
              </div>
              <div className="shrink-0 sm:text-right">
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">Orçamento</h2>
                <p className="mt-1 font-mono text-gray-500">#{quote.id.toString().padStart(4, "0")}</p>
                <div className="mt-2 sm:flex sm:justify-end">
                  <Badge className={statusInfo.color} variant="outline">{statusInfo.label}</Badge>
                </div>
              </div>
            </div>

            {/* Client */}
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">Preparado para</p>
              <p className="text-lg font-bold text-gray-900">{quote.clientName}</p>
            </div>

            {/* Service scope */}
            {quote.serviceScopeEnabled && quote.serviceDescription?.trim() && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Escopo do serviço</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {quote.serviceDescription}
                </p>
              </div>
            )}

            {/* Items */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-gray-900 text-sm">
                    <th className="py-3 font-bold text-gray-900">Descrição</th>
                    <th className="py-3 px-4 text-center font-bold text-gray-900">Qtd</th>
                    <th className="py-3 px-4 text-right font-bold text-gray-900 whitespace-nowrap">Valor Unit.</th>
                    <th className="py-3 text-right font-bold text-gray-900 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quote.items.map((item, i) => (
                    <tr key={item.id || i}>
                      <td className="py-4 text-gray-900">{item.description}</td>
                      <td className="py-4 px-4 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-4 px-4 text-right text-gray-600 whitespace-nowrap">{formatCurrency(item.unitPrice)}</td>
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

            {/* Total */}
            <div className="flex justify-end">
              <div className="w-full max-w-sm rounded-xl bg-gray-50 p-6">
                <div className="flex items-center justify-between text-lg font-black text-gray-900">
                  <span>Valor Total</span>
                  <span className="text-2xl text-primary">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quote.notes?.trim() && (
              <div className="border-t border-gray-100 pt-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Observações e Condições</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{quote.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Response section */}
        <div className="public-quote-response rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:hidden">
          {canRespond ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Aprovar este orçamento?</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Confirme sua decisão para o prestador de serviço.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="response-note">Observação (opcional)</Label>
                <Textarea
                  id="response-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Deixe uma mensagem para o prestador..."
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="gap-2 sm:flex-1"
                  onClick={() => handleRespond("approved")}
                  disabled={respondMutation.isPending || responseLocked}
                >
                  {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Aprovar orçamento
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 sm:flex-1"
                  onClick={() => handleRespond("rejected")}
                  disabled={respondMutation.isPending || responseLocked}
                >
                  <XCircle className="h-4 w-4" />
                  Recusar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              {isApproved ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <h3 className="text-lg font-bold text-gray-900">Orçamento aprovado</h3>
                </>
              ) : isRejected ? (
                <>
                  <XCircle className="h-12 w-12 text-red-500" />
                  <h3 className="text-lg font-bold text-gray-900">Orçamento recusado</h3>
                </>
              ) : (
                <h3 className="text-lg font-bold text-gray-900">Resposta registrada</h3>
              )}
              {quote.respondedAt && (
                <p className="text-sm text-gray-500">Em {formatDateTime(quote.respondedAt)}</p>
              )}
              {quote.clientResponseNote?.trim() && (
                <p className="max-w-md whitespace-pre-wrap text-sm text-gray-700">
                  "{quote.clientResponseNote}"
                </p>
              )}
            </div>
          )}
        </div>

        <div className="public-quote-actions flex flex-wrap justify-center gap-3 print:hidden">
          <Button variant="ghost" className="gap-2 text-gray-500" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleDownloadPdf} disabled={isPdfGenerating}>
            {isPdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isPdfGenerating ? "Gerando PDF..." : "Baixar PDF"}
          </Button>
        </div>
      </div>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          html,
          body {
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .public-quote-print,
          .public-quote-print * {
            visibility: visible !important;
          }
          .public-quote-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          .public-quote-document {
            width: 100%;
            max-width: none;
            overflow: visible !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .public-quote-document .overflow-x-auto {
            overflow: visible !important;
          }
          .public-quote-document table {
            width: 100% !important;
          }
          .public-quote-document thead {
            display: table-header-group;
          }
          .public-quote-document tr {
            break-inside: avoid;
          }
          .public-quote-response,
          .public-quote-actions {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
