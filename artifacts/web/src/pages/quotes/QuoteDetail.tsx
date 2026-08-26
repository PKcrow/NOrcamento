import { useParams, Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { useGetQuote, useUpdateQuote, useDeleteQuote, useGetCompany, useConvertQuoteToTask, useListTasks, useShareQuote, useRevokeQuotePublicLink, useGetMe, getGetQuoteQueryKey, getListTasksQueryKey, getGetDashboardSummaryQueryKey, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { formatCurrency, formatDate, formatDateTime, quoteStatusMap } from "@/lib/format";
import { normalizeStoredObjectUrl } from "@/lib/objectUrl";
import { downloadPdfFile, generateQuotePdf } from "@/lib/documentPdf";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Printer, Download, Edit2, Trash2, Send, CheckCircle, XCircle, Loader2, ClipboardList, Share2, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { QuoteStatus } from "@workspace/api-client-react";

export function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const quoteId = Number(id);
  const [, setLocation] = useLocation();
  
  const { data: quote, isLoading } = useGetQuote(quoteId);
  const { data: company } = useGetCompany();
  const { data: me } = useGetMe();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();
  const convertQuoteMutation = useConvertQuoteToTask();
  const shareLinkMutation = useShareQuote();
  const revokeLinkMutation = useRevokeQuotePublicLink();
  const { data: allTasks } = useListTasks();
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [pickedTime, setPickedTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [pickedEndDate, setPickedEndDate] = useState("");
  const [pickedEndTime, setPickedEndTime] = useState("18:00");
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Map date string (YYYY-MM-DD local) → list of client names already scheduled
  const busyDaysMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const task of allTasks ?? []) {
      const key = new Date(task.dueAt).toLocaleDateString("sv"); // "2026-08-18"
      if (!map[key]) map[key] = [];
      const name = task.clientName ?? "Cliente";
      if (!map[key].includes(name)) map[key].push(name);
    }
    return map;
  }, [allTasks]);

  const busyDays = useMemo(
    () => Object.keys(busyDaysMap).map((d) => new Date(d + "T12:00:00")),
    [busyDaysMap],
  );

  if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando orçamento...</div>;
  if (!quote) return <div className="p-8 text-center">Orçamento não encontrado.</div>;

  const handlePrint = () => {
    window.print();
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

  const handleSendLink = async () => {
    if (!quote) return;
    const getToken = (): Promise<string> => {
      if (publicLinkIsActive && quote.publicToken) return Promise.resolve(quote.publicToken);
      return new Promise((resolve, reject) => {
        shareLinkMutation.mutate(
          { id: quoteId },
          {
            onSuccess: (updated) => {
              queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(quoteId) });
              queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
              if (updated.publicToken) resolve(updated.publicToken);
              else reject(new Error("Token não gerado"));
            },
            onError: reject,
          },
        );
      });
    };
    try {
      const token = await getToken();
      const url = `${window.location.origin}${import.meta.env.BASE_URL}orcamento-publico/${token}`;
      const title = `Orçamento #${quote.id.toString().padStart(4, "0")}`;
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!", description: url });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Não foi possível compartilhar o link", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const handleRevokeApprovalLink = () => {
    if (!quote || !confirm("Revogar este link? Quem o receber não poderá mais abrir ou responder o orçamento.")) return;
    revokeLinkMutation.mutate(
      { id: quoteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(quoteId) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Link de aprovação revogado." });
        },
        onError: () => {
          toast({ title: "Não foi possível revogar o link", description: "Tente novamente.", variant: "destructive" });
        },
      },
    );
  };

  const handleStatusChange = (status: QuoteStatus) => {
    updateMutation.mutate({ id: quoteId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(quoteId) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: `Status atualizado para ${quoteStatusMap[status].label}` });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Tem certeza que deseja excluir este orçamento?")) return;
    deleteMutation.mutate({ id: quoteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Orçamento excluído." });
        setLocation("/orcamentos");
      }
    });
  };

  const handleConvert = () => {
    if (!quote || !pickedDate) return;

    // Combine picked date + time into a single ISO string in local TZ
    const [hours, minutes] = pickedTime.split(":").map(Number);
    const dt = new Date(pickedDate);
    dt.setHours(hours, minutes, 0, 0);

    if (!pickedEndDate) {
      toast({ title: "Informe a data de término.", variant: "destructive" });
      return;
    }
    const [endHours, endMinutes] = pickedEndTime.split(":").map(Number);
    const endDt = new Date(pickedEndDate + "T12:00:00");
    endDt.setHours(endHours, endMinutes, 0, 0);
    if (endDt <= dt) {
      toast({ title: "O término deve ser posterior ao início.", variant: "destructive" });
      return;
    }

    convertQuoteMutation.mutate(
      {
        id: quoteId,
        data: {
          dueAt: dt.toISOString(),
          endAt: endDt.toISOString(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(quoteId) });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
          toast({ title: "Ordem de serviço agendada!", description: "A agenda já mostra este serviço." });
          setIsConvertOpen(false);
          setLocation("/agenda");
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message;
          toast({
            title: "Erro ao criar O.S.",
            description: msg ?? "Tente novamente.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const statusInfo = quoteStatusMap[quote.status];
  const publicLinkIsActive = Boolean(
    quote.publicToken &&
      quote.publicLinkExpiresAt &&
      !quote.publicLinkRevokedAt &&
      new Date(quote.publicLinkExpiresAt).getTime() > Date.now(),
  );

  return (
    <div className="quote-detail-print space-y-8 max-w-4xl mx-auto print:max-w-none print:m-0 print:p-0">
      {/* Non-printable action bar */}
      <div className="quote-detail-actions flex flex-col sm:flex-row justify-between gap-4 print:hidden">
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
            {quote.publicToken && (
              <p className="mt-2 text-xs text-gray-500">
                {publicLinkIsActive && quote.publicLinkExpiresAt
                  ? `Link público válido até ${formatDateTime(quote.publicLinkExpiresAt)}`
                  : quote.publicLinkRevokedAt
                    ? "Link público revogado"
                    : "Link público expirado"}
              </p>
            )}
            {quote.respondedAt && (
              <div className="mt-3 max-w-md rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Resposta do cliente
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {quote.status === "approved" ? "Aprovado" : quote.status === "rejected" ? "Recusado" : "Respondido"}{" "}
                  em {formatDateTime(quote.respondedAt)}
                </p>
                {quote.clientResponseNote?.trim() && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                    "{quote.clientResponseNote}"
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            onClick={handleSendLink}
            disabled={shareLinkMutation.isPending}
            className="gap-2"
          >
            {shareLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Enviar link
          </Button>

          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isPdfGenerating} className="gap-2">
            {isPdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isPdfGenerating ? "Gerando PDF..." : "Baixar PDF"}
          </Button>

          {quote.status === "approved" && !quote.convertedTaskId && (
            <Button className="gap-2" onClick={() => setIsConvertOpen(true)}>
              <ClipboardList className="w-4 h-4" /> Agendar serviço
            </Button>
          )}
          {quote.convertedTaskId && (
            <Button variant="outline" className="gap-2" onClick={() => setLocation("/agenda")}>
              <ClipboardList className="w-4 h-4" /> O.S. #{quote.convertedTaskId} na agenda
            </Button>
          )}

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
              {me?.role === "owner" && publicLinkIsActive && (
                <DropdownMenuItem
                  onClick={handleRevokeApprovalLink}
                  disabled={revokeLinkMutation.isPending}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  {revokeLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Revogar link público
                </DropdownMenuItem>
              )}
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
      <Card className="quote-detail-document shadow-lg border-gray-200 overflow-hidden print:shadow-none print:border-none print:w-full print:overflow-visible">
        {/* Header Strip */}
        <div className="h-4 w-full bg-primary print:bg-black !bg-opacity-100" style={{ backgroundColor: 'var(--primary)' }}></div>
        
        <CardContent className="p-8 md:p-12 space-y-12">
          {/* Header: logo/company identity on the left, quote identity on the right. */}
          <div className="flex items-start justify-between gap-8 border-b border-gray-200 pb-7">
            <div className="flex min-w-0 items-start gap-4">
              {company?.logoUrl ? (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white p-2">
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
                {company?.address && <p className="mt-1 max-w-xs text-sm text-gray-500">{company.address}</p>}
                {company?.phone && <p className="text-sm text-gray-500">{company.phone}</p>}
                {company?.email && <p className="break-all text-sm text-gray-500">{company.email}</p>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <h2 className="text-3xl font-black uppercase tracking-tight text-gray-900">Orçamento</h2>
              <p className="mt-1 font-mono text-gray-500">#{quote.id.toString().padStart(4, '0')}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-400">Data de emissão</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(quote.createdAt)}</p>
            </div>
          </div>

          {quote.serviceScopeEnabled && quote.serviceDescription?.trim() && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Escopo do serviço
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {quote.serviceDescription}
              </p>
            </div>
          )}

          {/* Info Block */}
          <div className="flex justify-between border-t border-b py-6 border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preparado Para</p>
              <p className="font-bold text-gray-900 text-lg">{quote.clientName}</p>
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
      
      {/* Convert to O.S. dialog */}
      <Dialog open={isConvertOpen} onOpenChange={(open) => {
        setIsConvertOpen(open);
        if (!open) { setPickedDate(undefined); setPickedEndDate(""); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Converter em Ordem de Serviço
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-500 -mt-1">
            Escolha o intervalo de horário para o serviço:
          </p>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-100 border border-green-400 inline-block" />
              Tem horários disponíveis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-100 border border-red-400 inline-block" />
              Já há atendimento
            </span>
          </div>

          {/* Calendar */}
          <Calendar
            mode="single"
            selected={pickedDate}
            onSelect={(date) => {
              setPickedDate(date);
              if (date) setPickedEndDate(date.toLocaleDateString("sv"));
            }}
            disabled={{ before: new Date(new Date().setHours(0,0,0,0)) }}
            modifiers={{ busy: busyDays }}
            modifiersClassNames={{
              busy: "!bg-red-100 !text-red-700 hover:!bg-red-200 font-semibold",
            }}
            classNames={{
              day: "group/day relative aspect-square h-full w-full select-none p-0 text-center",
              today: "!bg-green-50 !text-green-800 rounded-md font-semibold",
            }}
            className="rounded-md border mx-auto w-full [--cell-size:2.25rem]"
          />

          {/* Busy day warning */}
          {pickedDate && (() => {
            const key = pickedDate.toLocaleDateString("sv");
            const clients = busyDaysMap[key];
            if (!clients?.length) return null;
            return (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                Há atendimento neste dia: <strong>{clients.join(", ")}</strong>. Você ainda pode agendar em outro horário.
              </p>
            );
          })()}

          {/* Start + end time — only shown after a day is picked */}
          {pickedDate && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pickedTime">Início</Label>
                <Input
                  id="pickedTime"
                  type="time"
                  value={pickedTime}
                  onChange={(e) => setPickedTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickedEndTime">Término (hora)</Label>
                <Input
                  id="pickedEndTime"
                  type="time"
                  value={pickedEndTime}
                  onChange={(e) => setPickedEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* End date — shown after a start day is picked */}
          {pickedDate && (
            <div className="space-y-1.5">
              <Label htmlFor="pickedEndDate">
                Data de término *
              </Label>
              <Input
                id="pickedEndDate"
                type="date"
                value={pickedEndDate}
                min={pickedDate.toLocaleDateString("sv")}
                onChange={(e) => setPickedEndDate(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleConvert}
              disabled={!pickedDate || !pickedEndDate || convertQuoteMutation.isPending}
            >
              {convertQuoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Agendar serviço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keep browser printing limited to the document and allow natural multipage flow. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .quote-detail-print, .quote-detail-print * { visibility: visible !important; }
          .quote-detail-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .quote-detail-document {
            overflow: visible !important;
            box-shadow: none !important;
            border: 0 !important;
          }
          .quote-detail-document table { width: 100% !important; }
          .quote-detail-document thead { display: table-header-group; }
          .quote-detail-document tr { break-inside: avoid; }
          .quote-detail-actions { display: none !important; }
          img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
