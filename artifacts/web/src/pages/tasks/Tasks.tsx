import { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, useListClients, getListTasksQueryKey, getGetDashboardSummaryQueryKey, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle2, Circle, Clock, Trash2, CalendarIcon } from "lucide-react";
import { formatDateTime, taskStatusMap } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@workspace/api-client-react";

export function Tasks() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const { data: tasks, isLoading } = useListTasks(statusFilter !== "all" ? { status: statusFilter } : undefined);
  const { data: clients } = useListClients();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("none");
  
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

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const dueAt = formData.get("dueAt") as string;

    if (!title || !dueAt) return;

    // Convert local datetime to ISO string for backend
    const dueAtISO = new Date(dueAt).toISOString();

    createMutation.mutate({ 
      data: { 
        title, 
        description, 
        dueAt: dueAtISO,
        clientId: clientId !== "none" ? Number(clientId) : null 
      } 
    }, {
      onSuccess: () => {
        invalidateTasks();
        setIsCreateOpen(false);
        setClientId("none");
        toast({ title: "Tarefa criada." });
      }
    });
  };

  const toggleStatus = (id: number, currentStatus: TaskStatus) => {
    const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
    updateMutation.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        invalidateTasks();
      }
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

  // Get current local datetime formatted for the datetime-local input
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const defaultDateTime = now.toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Agenda de Tarefas</h1>
          <p className="text-gray-500 mt-1">Acompanhe seus compromissos e entregas.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Nova Tarefa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título / O que fazer?</Label>
                <Input id="title" name="title" required placeholder="Ex: Instalação de painel solar" />
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

              <div className="space-y-2">
                <Label htmlFor="dueAt">Data e Hora (Prazo)</Label>
                <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={defaultDateTime} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Detalhes (Opcional)</Label>
                <Textarea id="description" name="description" placeholder="Materiais necessários, endereço..." />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending}>Agendar</Button>
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
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={`gap-1 ${isOverdue ? 'border-red-200 text-red-700 bg-red-50' : 'text-gray-600'}`}>
                          <CalendarIcon className="w-3 h-3" />
                          {formatDateTime(task.dueAt)}
                        </Badge>
                        {isOverdue && <span className="text-xs font-semibold text-red-600">Atrasada</span>}
                      </div>
                    </TableCell>
                    <TableCell className="w-12 text-right pr-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-destructive" onClick={() => handleDelete(task.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
