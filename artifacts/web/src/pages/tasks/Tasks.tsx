import { useRef, useState, useMemo } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListClients,
  useCreateClient,
  useGetCompany,
  useAddTaskPhoto,
  useDeleteTaskPhoto,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetNotificationsQueryKey,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import type { ApiError, TaskStatus, Task } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload, ACCEPTED_IMAGE_TYPES, MAX_ORIGINAL_SIZE_BYTES } from "@/hooks/use-file-upload";
import { normalizeStoredObjectUrl } from "@/lib/objectUrl";
import {
  Plus, Trash2, CalendarIcon, Pencil, ImagePlus, Loader2, X,
  Share2, Search, ChevronRight, DollarSign,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, taskStatusMap, taskStatusNext } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { generateTaskPdf, sharePdfFile } from "@/lib/documentPdf";

function nowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

const STATUS_TABS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "scheduled", label: "Agendadas" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluídas" },
  { value: "paid", label: "Pagas" },
];

export function Tasks() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [search, setSearch] = useState("");

  const { data: tasks, isLoading } = useListTasks(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );
  // All tasks regardless of filter — feeds the busy-days calendar
  const { data: allTasks } = useListTasks();
  const { data: clients } = useListClients();
  const { data: company } = useGetCompany();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [clientId, setClientId] = useState<string>("none");
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [sharingTaskId, setSharingTaskId] = useState<number | null>(null);

  // Payment dialog (register payment)
  const [paymentDialog, setPaymentDialog] = useState<{ taskId: number; title: string } | null>(null);
  const [paidAmountStr, setPaidAmountStr] = useState("");

  // Edit-payment dialog (paid tasks)
  const [editPaymentDialog, setEditPaymentDialog] = useState<{ taskId: number; title: string } | null>(null);
  const [editPaidAmountStr, setEditPaidAmountStr] = useState("");
  const [editPaidAtStr, setEditPaidAtStr] = useState("");

  // Calendar state
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [pickedTime, setPickedTime] = useState(nowHHMM);
  const [pickedEndDate, setPickedEndDate] = useState("");
  const [pickedEndTime, setPickedEndTime] = useState("18:00");

  // Busy-days map (excludes the task being edited)
  const busyDaysMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of allTasks ?? []) {
      if (editingTask && t.id === editingTask.id) continue;
      if (t.status !== "scheduled") continue; // only block scheduled days
      const key = new Date(t.dueAt).toLocaleDateString("sv");
      if (!map[key]) map[key] = [];
      const name = t.clientName ?? "Cliente";
      if (!map[key].includes(name)) map[key].push(name);
    }
    return map;
  }, [allTasks, editingTask]);

  const busyDays = useMemo(
    () => Object.keys(busyDaysMap).map((d) => new Date(d + "T12:00:00")),
    [busyDaysMap],
  );

  // Client-side text search
  const filtered = useMemo(() => {
    if (!tasks) return [];
    if (!search.trim()) return tasks;
    const term = search.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        (t.clientName?.toLowerCase().includes(term) ?? false) ||
        (t.description?.toLowerCase().includes(term) ?? false),
    );
  }, [tasks, search]);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const quickClientMutation = useCreateClient();

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
  };

  const openCreate = () => {
    setEditingTask(null);
    setClientId("none");
    setPickedDate(undefined);
    setPickedTime(nowHHMM());
    setPickedEndDate("");
    setPickedEndTime("18:00");
    setIsFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setClientId(task.clientId ? task.clientId.toString() : "none");
    const start = new Date(task.dueAt);
    setPickedDate(start);
    setPickedTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
    if (task.endAt) {
      const end = new Date(task.endAt);
      setPickedEndDate(end.toLocaleDateString("sv"));
      setPickedEndTime(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`);
    } else {
      setPickedEndDate(start.toLocaleDateString("sv"));
      setPickedEndTime("18:00");
    }
    setIsFormOpen(true);
  };

  const showConflictOrGenericError = (error: unknown, fallbackTitle: string) => {
    const apiError = error as ApiError;
    if (apiError?.status === 409) {
      toast({ title: "Conflito de agenda", description: apiError.message, variant: "destructive" });
    } else {
      toast({ title: fallbackTitle, description: "Tente novamente.", variant: "destructive" });
    }
  };

  const handleQuickClientCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;

    quickClientMutation.mutate(
      {
        data: {
          name,
          phone: String(formData.get("phone") ?? "").trim() || undefined,
          email: String(formData.get("email") ?? "").trim() || undefined,
        },
      },
      {
        onSuccess: (client) => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setClientId(client.id.toString());
          setIsQuickClientOpen(false);
          toast({ title: "Cliente cadastrado e selecionado." });
        },
        onError: () => {
          toast({ title: "Não foi possível cadastrar o cliente.", variant: "destructive" });
        },
      },
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pickedDate) {
      toast({ title: "Selecione a data de início.", variant: "destructive" });
      return;
    }
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    if (!title) return;

    const [h, m] = pickedTime.split(":").map(Number);
    const dt = new Date(pickedDate);
    dt.setHours(h, m, 0, 0);
    const dueAtISO = dt.toISOString();

    if (!pickedEndDate) {
      toast({ title: "Informe a data de término.", variant: "destructive" });
      return;
    }
    const [eh, em] = pickedEndTime.split(":").map(Number);
    const endDt = new Date(pickedEndDate + "T12:00:00");
    endDt.setHours(eh, em, 0, 0);
    if (endDt <= dt) {
      toast({ title: "O término deve ser posterior ao início.", variant: "destructive" });
      return;
    }
    const endAtISO = endDt.toISOString();

    if (editingTask) {
      updateMutation.mutate(
        { id: editingTask.id, data: { title, description, dueAt: dueAtISO, endAt: endAtISO, clientId: clientId !== "none" ? Number(clientId) : null } },
        {
          onSuccess: () => { invalidateTasks(); setIsFormOpen(false); toast({ title: "Tarefa atualizada." }); },
          onError: (error) => showConflictOrGenericError(error, "Erro ao atualizar tarefa"),
        },
      );
    } else {
      createMutation.mutate(
        { data: { title, description, dueAt: dueAtISO, endAt: endAtISO, clientId: clientId !== "none" ? Number(clientId) : null } },
        {
          onSuccess: () => { invalidateTasks(); setIsFormOpen(false); setClientId("none"); toast({ title: "Tarefa agendada." }); },
          onError: (error) => showConflictOrGenericError(error, "Erro ao agendar tarefa"),
        },
      );
    }
  };

  // Advance to next status; if next is 'paid', open payment dialog
  const advanceStatus = (task: Task) => {
    const next = taskStatusNext[task.status] as TaskStatus | null;
    if (!next) return;
    if (next === "paid") {
      setPaidAmountStr("");
      setPaymentDialog({ taskId: task.id, title: task.title });
      return;
    }
    updateMutation.mutate(
      { id: task.id, data: { status: next } },
      {
        onSuccess: () => invalidateTasks(),
        onError: (error) => showConflictOrGenericError(error, "Erro ao atualizar status"),
      },
    );
  };

  const handleConfirmPayment = () => {
    if (!paymentDialog) return;
    const amount = parseFloat(paidAmountStr.replace(",", "."));
    updateMutation.mutate(
      { id: paymentDialog.taskId, data: { status: "paid", paidAmount: isNaN(amount) ? null : amount } },
      {
        onSuccess: () => {
          invalidateTasks();
          setPaymentDialog(null);
          toast({ title: "OS marcada como paga! 🎉" });
        },
        onError: (error) => showConflictOrGenericError(error, "Erro ao marcar como paga"),
      },
    );
  };

  const openEditPayment = (task: Task) => {
    setEditPaidAmountStr(task.paidAmount != null ? String(task.paidAmount).replace(".", ",") : "");
    setEditPaidAtStr(task.paidAt ? new Date(task.paidAt).toLocaleDateString("sv") : "");
    setEditPaymentDialog({ taskId: task.id, title: task.title });
  };

  const handleSaveEditPayment = () => {
    if (!editPaymentDialog) return;
    const amount = parseFloat(editPaidAmountStr.replace(",", "."));
    let paidAtISO: string | null = null;
    if (editPaidAtStr) {
      const d = new Date(editPaidAtStr + "T12:00:00");
      paidAtISO = d.toISOString();
    }
    updateMutation.mutate(
      { id: editPaymentDialog.taskId, data: { paidAmount: isNaN(amount) ? null : amount, paidAt: paidAtISO } },
      {
        onSuccess: () => {
          invalidateTasks();
          setEditPaymentDialog(null);
          toast({ title: "Pagamento atualizado." });
        },
        onError: (error) => showConflictOrGenericError(error, "Erro ao atualizar pagamento"),
      },
    );
  };

  const handleUndoPayment = (task: Task) => {
    if (!confirm("Desfazer o pagamento desta tarefa? Ela voltará para 'Concluído'.")) return;
    updateMutation.mutate(
      { id: task.id, data: { status: "completed" } },
      {
        onSuccess: () => { invalidateTasks(); toast({ title: "Pagamento desfeito." }); },
        onError: (error) => showConflictOrGenericError(error, "Erro ao desfazer pagamento"),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir esta tarefa?")) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidateTasks(); toast({ title: "Tarefa excluída." }); } });
  };

  const handleShareTask = async (task: Task) => {
    setSharingTaskId(task.id);
    try {
      const file = await generateTaskPdf(task, company);
      const result = await sharePdfFile(file);
      if (result === "downloaded") {
        toast({ title: "PDF baixado", description: "Este navegador não oferece o compartilhamento nativo de arquivos." });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Não foi possível compartilhar", description: "Tente novamente ou baixe o PDF pelo navegador.", variant: "destructive" });
    } finally {
      setSharingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Agenda de Tarefas</h1>
          <p className="text-gray-500 mt-1">Acompanhe seus compromissos e entregas.</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTask ? "Editar Tarefa" : "Agendar Nova Tarefa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título / O que fazer?</Label>
                <Input id="title" name="title" required placeholder="Ex: Instalação de painel solar" defaultValue={editingTask?.title} />
              </div>

              <div className="space-y-2">
                <Label>Cliente relacionado (Opcional)</Label>
                <div className="flex items-center gap-2">
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum cliente</SelectItem>
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Cadastrar novo cliente"
                    aria-label="Cadastrar novo cliente"
                    onClick={() => setIsQuickClientOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de Início *</Label>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-100 border border-green-400 inline-block" /> Hoje
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-100 border border-red-400 inline-block" /> Ocupado
                  </span>
                </div>
                <Calendar
                  mode="single"
                  selected={pickedDate}
                  onSelect={(date) => {
                    setPickedDate(date);
                    if (date) setPickedEndDate(date.toLocaleDateString("sv"));
                  }}
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                  modifiers={{ busy: busyDays }}
                  modifiersClassNames={{ busy: "!bg-red-100 !text-red-700 hover:!bg-red-200 font-semibold" }}
                  classNames={{
                    day: "group/day relative aspect-square h-full w-full select-none p-0 text-center",
                    today: "!bg-green-50 !text-green-800 rounded-md font-semibold",
                  }}
                  className="rounded-md border w-full [--cell-size:2.1rem]"
                />
                {pickedDate && (() => {
                  const key = pickedDate.toLocaleDateString("sv");
                  const busyClients = busyDaysMap[key];
                  if (!busyClients?.length) return null;
                  return (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      ⚠️ Dia ocupado com: <strong>{busyClients.join(", ")}</strong>
                    </p>
                  );
                })()}
              </div>

              {pickedDate && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pickedTime">Horário de início</Label>
                    <Input id="pickedTime" type="time" value={pickedTime} onChange={(e) => setPickedTime(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pickedEndTime">Término (hora)</Label>
                    <Input id="pickedEndTime" type="time" value={pickedEndTime} onChange={(e) => setPickedEndTime(e.target.value)} />
                  </div>
                </div>
              )}

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

              <div className="space-y-2">
                <Label htmlFor="description">Detalhes (Opcional)</Label>
                <Textarea id="description" name="description" placeholder="Materiais necessários, endereço..." defaultValue={editingTask?.description ?? ""} />
              </div>

              {editingTask && <TaskPhotos task={editingTask} />}

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingTask ? "Salvar" : "Agendar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={isQuickClientOpen} onOpenChange={setIsQuickClientOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleQuickClientCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quick-client-name">Nome completo ou empresa *</Label>
                <Input id="quick-client-name" name="name" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quick-client-phone">Telefone</Label>
                  <Input id="quick-client-phone" name="phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-client-email">E-mail</Label>
                  <Input id="quick-client-email" name="email" type="email" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={quickClientMutation.isPending}>
                  {quickClientMutation.isPending ? "Salvando..." : "Salvar e selecionar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por título, cliente ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "default" : "outline"}
              onClick={() => setStatusFilter(tab.value)}
              className="rounded-full whitespace-nowrap"
              size="sm"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead className="hidden md:table-cell">Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                  {search ? "Nenhuma tarefa encontrada para essa busca." : "Nenhuma tarefa encontrada."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((task) => {
                const statusInfo = taskStatusMap[task.status] ?? taskStatusMap.scheduled;
                const nextStatus = taskStatusNext[task.status];
                const isPaid = task.status === "paid";
                const isOverdue = !isPaid && task.status !== "completed" && new Date(task.dueAt) < new Date();

                return (
                  <TableRow key={task.id} className={isPaid ? "bg-emerald-50/30" : ""}>
                    {/* Status badge */}
                    <TableCell className="w-36">
                      <Badge variant="outline" className={`${statusInfo.color} whitespace-nowrap text-xs`}>
                        {statusInfo.label}
                      </Badge>
                      {isOverdue && (
                        <p className="text-[10px] font-semibold text-red-600 mt-1">Atrasada</p>
                      )}
                    </TableCell>

                    {/* Task info */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className={`font-medium ${isPaid ? "text-gray-500" : "text-gray-900"}`}>
                          {task.title}
                        </span>
                        {task.clientName && (
                          <span className="text-sm text-gray-500">{task.clientName}</span>
                        )}
                        {task.description && (
                          <span className="text-xs text-gray-400 line-clamp-1">{task.description}</span>
                        )}
                        {task.photos.length > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <ImagePlus className="w-3 h-3" /> {task.photos.length} foto(s)
                          </span>
                        )}
                        {isPaid && (task.paidAmount != null || task.paidAt) && (
                          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {task.paidAmount != null ? formatCurrency(task.paidAmount) : "Sem valor"}
                            {task.paidAt && (
                              <span className="text-emerald-600/70 font-normal">· pago em {formatDate(task.paidAt)}</span>
                            )}
                          </span>
                        )}
                        {!isPaid && task.paidAmount != null && (
                          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> {formatCurrency(task.paidAmount)}
                          </span>
                        )}
                        {/* Date — mobile only */}
                        <span className="md:hidden text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" /> {formatDateTime(task.dueAt)}
                        </span>
                      </div>
                    </TableCell>

                    {/* Date — desktop */}
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className={`gap-1 w-fit text-xs ${isOverdue ? "border-red-200 text-red-700 bg-red-50" : "text-gray-600"}`}>
                          <CalendarIcon className="w-3 h-3" />
                          {formatDateTime(task.dueAt)}
                        </Badge>
                        {task.endAt && (
                          <span className="text-xs text-gray-400">até {formatDateTime(task.endAt)}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Advance status button */}
                        {nextStatus && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="hidden sm:flex items-center gap-1.5 text-xs h-7 px-2"
                            disabled={updateMutation.isPending}
                            onClick={() => advanceStatus(task)}
                            title={statusInfo.nextLabel ?? ""}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            {statusInfo.nextLabel}
                          </Button>
                        )}
                        {/* Mobile advance — icon only */}
                        {nextStatus && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="sm:hidden h-8 w-8"
                            disabled={updateMutation.isPending}
                            onClick={() => advanceStatus(task)}
                            title={statusInfo.nextLabel ?? ""}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Paid task payment actions */}
                        {isPaid && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="hidden sm:flex items-center gap-1.5 text-xs h-7 px-2"
                              disabled={updateMutation.isPending}
                              onClick={() => openEditPayment(task)}
                              title="Editar pagamento"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar pagamento
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="sm:hidden h-8 w-8 text-emerald-600"
                              disabled={updateMutation.isPending}
                              onClick={() => openEditPayment(task)}
                              title="Editar pagamento"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2 text-gray-500 hover:text-destructive"
                              disabled={updateMutation.isPending}
                              onClick={() => handleUndoPayment(task)}
                              title="Desfazer pagamento"
                            >
                              Desfazer
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-primary" onClick={() => openEdit(task)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-primary"
                          onClick={() => handleShareTask(task)}
                          disabled={sharingTaskId === task.id}
                          title="Compartilhar O.S. em PDF"
                        >
                          {sharingTaskId === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-destructive" onClick={() => handleDelete(task.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Payment dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={(o) => !o && setPaymentDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" /> Confirmar Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-gray-600">
              Marcar <strong className="text-gray-900">"{paymentDialog?.title}"</strong> como paga.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="paid-amount">Valor recebido (opcional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <Input
                  id="paid-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={paidAmountStr}
                  onChange={(e) => setPaidAmountStr(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-gray-400">Deixe em branco se não quiser registrar o valor agora.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirmPayment}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit payment dialog */}
      <Dialog open={!!editPaymentDialog} onOpenChange={(o) => !o && setEditPaymentDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" /> Editar Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-gray-600">
              Editar o pagamento de <strong className="text-gray-900">"{editPaymentDialog?.title}"</strong>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="edit-paid-amount">Valor recebido</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <Input
                  id="edit-paid-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={editPaidAmountStr}
                  onChange={(e) => setEditPaidAmountStr(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-paid-at">Data do pagamento</Label>
              <Input
                id="edit-paid-at"
                type="date"
                value={editPaidAtStr}
                onChange={(e) => setEditPaidAtStr(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentDialog(null)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSaveEditPayment}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskPhotos({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { upload, isUploading } = useFileUpload();
  const addPhotoMutation = useAddTaskPhoto();
  const deletePhotoMutation = useDeleteTaskPhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Envie uma imagem PNG, JPG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_ORIGINAL_SIZE_BYTES) {
      toast({ title: "Arquivo muito grande", variant: "destructive" });
      return;
    }
    try {
      const url = await upload(file, { maxDimension: 1920, preserveTransparency: false });
      addPhotoMutation.mutate({ id: task.id, data: { url } }, {
        onSuccess: () => invalidate(),
        onError: () => toast({ title: "Erro ao anexar foto", variant: "destructive" }),
      });
    } catch {
      toast({ title: "Erro ao enviar a foto", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const handleRemove = (photoId: number) => {
    deletePhotoMutation.mutate({ id: task.id, photoId }, { onSuccess: () => invalidate() });
  };

  return (
    <div className="space-y-2">
      <Label>Fotos do Serviço</Label>
      <div className="flex flex-col gap-1">
        {task.photos.map((photo, index) => (
          <div key={photo.id} className="flex items-center gap-2 text-sm">
            <a href={normalizeStoredObjectUrl(photo.url)} target="_blank" rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-75 truncate max-w-[260px]">
              Foto {index + 1}
            </a>
            <button type="button" onClick={() => handleRemove(photo.id)}
              className="text-gray-400 hover:text-destructive transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="hidden" onChange={handleFileChange} />
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors disabled:opacity-50">
        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        {isUploading ? "Enviando..." : "Adicionar foto"}
      </button>
      <p className="text-xs text-gray-400">PNG, JPG ou WEBP, até 5MB por foto.</p>
    </div>
  );
}
