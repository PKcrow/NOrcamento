import { useRef, useState } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListClients,
  useGetCompany,
  useAddTaskPhoto,
  useDeleteTaskPhoto,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload, ACCEPTED_IMAGE_TYPES, MAX_ORIGINAL_SIZE_BYTES } from "@/hooks/use-file-upload";
import { normalizeStoredObjectUrl } from "@/lib/objectUrl";
import { Plus, CheckCircle2, Circle, Trash2, CalendarIcon, Pencil, ImagePlus, Loader2, X, Share2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus, Task } from "@workspace/api-client-react";
import { generateTaskPdf, sharePdfFile } from "@/lib/documentPdf";

// Get current local datetime formatted for a datetime-local input
function toLocalInputValue(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function Tasks() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const { data: tasks, isLoading } = useListTasks(statusFilter !== "all" ? { status: statusFilter } : undefined);
  const { data: clients } = useListClients();
  const { data: company } = useGetCompany();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [clientId, setClientId] = useState<string>("none");
  const [sharingTaskId, setSharingTaskId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
  };

  const openCreate = () => {
    setEditingTask(null);
    setClientId("none");
    setIsFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setClientId(task.clientId ? task.clientId.toString() : "none");
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const dueAt = formData.get("dueAt") as string;
    const endAt = formData.get("endAt") as string;

    if (!title || !dueAt) return;

    const dueAtISO = new Date(dueAt).toISOString();
    const endAtISO = endAt ? new Date(endAt).toISOString() : null;

    if (editingTask) {
      updateMutation.mutate({
        id: editingTask.id,
        data: {
          title,
          description,
          dueAt: dueAtISO,
          endAt: endAtISO,
          clientId: clientId !== "none" ? Number(clientId) : null,
        },
      }, {
        onSuccess: () => {
          invalidateTasks();
          setIsFormOpen(false);
          toast({ title: "Tarefa atualizada." });
        },
        onError: (error) => showConflictOrGenericError(error, "Erro ao atualizar tarefa"),
      });
    } else {
      createMutation.mutate({
        data: {
          title,
          description,
          dueAt: dueAtISO,
          endAt: endAtISO,
          clientId: clientId !== "none" ? Number(clientId) : null,
        },
      }, {
        onSuccess: () => {
          invalidateTasks();
          setIsFormOpen(false);
          setClientId("none");
          toast({ title: "Tarefa agendada." });
        },
        onError: (error) => showConflictOrGenericError(error, "Erro ao agendar tarefa"),
      });
    }
  };

  const toggleStatus = (id: number, currentStatus: TaskStatus) => {
    const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
    updateMutation.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        invalidateTasks();
      },
      onError: (error) => showConflictOrGenericError(error, "Erro ao atualizar status"),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Excluir esta tarefa?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        invalidateTasks();
        toast({ title: "Tarefa excluída." });
      }
    });
  };

  const handleShareTask = async (task: Task) => {
    setSharingTaskId(task.id);
    try {
      const file = await generateTaskPdf(task, company);
      const result = await sharePdfFile(file);
      if (result === "downloaded") {
        toast({
          title: "PDF baixado",
          description: "Este navegador não oferece o compartilhamento nativo de arquivos.",
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        title: "Não foi possível compartilhar",
        description: "Tente novamente ou baixe o PDF pelo navegador.",
        variant: "destructive",
      });
    } finally {
      setSharingTaskId(null);
    }
  };

  const defaultDateTime = toLocalInputValue(new Date());

  return (
    <div className="space-y-6">
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
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum cliente</SelectItem>
                    {clients?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dueAt">Data de Início</Label>
                  <Input
                    id="dueAt"
                    name="dueAt"
                    type="datetime-local"
                    defaultValue={editingTask ? toLocalInputValue(new Date(editingTask.dueAt)) : defaultDateTime}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endAt">Previsão de Término</Label>
                  <Input
                    id="endAt"
                    name="endAt"
                    type="datetime-local"
                    defaultValue={editingTask?.endAt ? toLocalInputValue(new Date(editingTask.endAt)) : ""}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                Não é possível agendar em um dia que já tenha um serviço marcado.
              </p>

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
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <Button 
          variant={statusFilter === "all" ? "default" : "outline"} 
          onClick={() => setStatusFilter("all")}
          className="rounded-full"
        >
          Todas
        </Button>
        <Button 
          variant={statusFilter === "pending" ? "default" : "outline"} 
          onClick={() => setStatusFilter("pending")}
          className="rounded-full"
        >
          Pendentes
        </Button>
        <Button 
          variant={statusFilter === "done" ? "default" : "outline"} 
          onClick={() => setStatusFilter("done")}
          className="rounded-full"
        >
          Concluídas
        </Button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell className="h-24 text-center">Carregando...</TableCell>
              </TableRow>
            ) : tasks?.length === 0 ? (
              <TableRow>
                <TableCell className="h-24 text-center text-gray-500">Nenhuma tarefa encontrada.</TableCell>
              </TableRow>
            ) : (
              tasks?.map((task) => {
                const isDone = task.status === 'done';
                const isOverdue = !isDone && new Date(task.dueAt) < new Date();
                
                return (
                  <TableRow key={task.id} className={isDone ? "bg-gray-50/50" : ""}>
                    <TableCell className="w-12">
                      <button 
                        onClick={() => toggleStatus(task.id, task.status)}
                        className="text-gray-400 hover:text-primary transition-colors disabled:opacity-50"
                        disabled={updateMutation.isPending}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <Circle className="w-6 h-6" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={`font-medium text-base ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title}
                        </span>
                        {task.clientName && (
                          <span className={`text-sm ${isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                            {task.clientName}
                          </span>
                        )}
                        {task.description && (
                          <span className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</span>
                        )}
                        {task.photos.length > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <ImagePlus className="w-3 h-3" /> {task.photos.length} foto(s)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={`gap-1 ${isOverdue ? 'border-red-200 text-red-700 bg-red-50' : 'text-gray-600'}`}>
                          <CalendarIcon className="w-3 h-3" />
                          {formatDateTime(task.dueAt)}
                        </Badge>
                        {task.endAt && (
                          <span className="text-xs text-gray-500">até {formatDateTime(task.endAt)}</span>
                        )}
                        {isOverdue && <span className="text-xs font-semibold text-red-600">Atrasada</span>}
                      </div>
                    </TableCell>
                    <TableCell className="w-20 text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
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
                          {sharingTaskId === task.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-destructive" onClick={() => handleDelete(task.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
      toast({ title: "Arquivo muito grande", description: "Essa foto é grande demais para ser enviada.", variant: "destructive" });
      return;
    }

    try {
      // Photos don't need transparency; compress to JPEG so phone photos
      // (often 8-20MB) always fit within the upload limit.
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
    deletePhotoMutation.mutate({ id: task.id, photoId }, {
      onSuccess: () => invalidate(),
    });
  };

  return (
    <div className="space-y-2">
      <Label>Fotos do Serviço</Label>
      <div className="flex flex-wrap gap-2">
        {task.photos.map((photo) => (
          <div key={photo.id} className="relative h-20 w-20 rounded-lg overflow-hidden border group">
            <img
              src={normalizeStoredObjectUrl(photo.url)}
              alt="Foto do serviço"
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <button
              type="button"
              onClick={() => handleRemove(photo.id)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-20 w-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
        </button>
      </div>
      <p className="text-xs text-gray-500">PNG, JPG ou WEBP, até 5MB por foto.</p>
    </div>
  );
}
