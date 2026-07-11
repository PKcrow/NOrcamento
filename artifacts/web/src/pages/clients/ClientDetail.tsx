import { useParams, Link, useLocation } from "wouter";
import { useGetClient, useUpdateClient, useDeleteClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { formatCurrency, formatDate, quoteStatusMap, taskStatusMap } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, User, FileText, CheckSquare, Edit2, Trash2, ArrowLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [, setLocation] = useLocation();
  const { data: client, isLoading } = useGetClient(clientId);
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 w-32 bg-gray-200 rounded"></div>
      <div className="h-48 bg-gray-200 rounded-xl"></div>
    </div>;
  }

  if (!client) {
    return <div className="text-center py-12">Cliente não encontrado.</div>;
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const notes = formData.get("notes") as string;

    if (!name) return;

    updateMutation.mutate({ id: clientId, data: { name, email, phone, notes } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        setIsEditOpen(false);
        toast({ title: "Cliente atualizado com sucesso." });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Excluir este cliente apagará também todo seu histórico. Tem certeza?")) return;
    deleteMutation.mutate({ id: clientId }, {
      onSuccess: () => {
        toast({ title: "Cliente excluído." });
        setLocation("/clientes");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-primary" /> {client.name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2">
            <Edit2 className="w-4 h-4" /> Editar
          </Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive hover:text-white" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" /> Excluir
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 border-t-4 border-t-primary shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.phone && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="bg-gray-100 p-2 rounded-full text-gray-500"><Phone className="w-4 h-4" /></div>
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="bg-gray-100 p-2 rounded-full text-gray-500"><Mail className="w-4 h-4" /></div>
                <span>{client.email}</span>
              </div>
            )}
            {client.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-semibold mb-2">Anotações:</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" /> Histórico de Orçamentos
              </CardTitle>
              <Link href={`/orcamentos/novo?client=${client.id}`}>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="w-3 h-3" /> Novo
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {client.quotes.length > 0 ? (
                <div className="divide-y">
                  {client.quotes.map(quote => {
                    const status = quoteStatusMap[quote.status];
                    return (
                      <Link key={quote.id} href={`/orcamentos/${quote.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-medium text-gray-900">#{quote.id.toString().padStart(4, '0')}</p>
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
                <div className="p-8 text-center text-gray-500">Nenhum orçamento.</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-gray-400" /> Tarefas Associadas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {client.tasks.length > 0 ? (
                <div className="divide-y">
                  {client.tasks.map(task => {
                    const status = taskStatusMap[task.status];
                    return (
                      <div key={task.id} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium text-gray-900">{task.title}</p>
                          <p className="text-sm text-gray-500">Prazo: {formatDate(task.dueAt)}</p>
                        </div>
                        <Badge variant="outline" className={status.color}>{status.label}</Badge>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">Nenhuma tarefa.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" name="name" defaultValue={client.name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input id="edit-phone" name="phone" defaultValue={client.phone || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input id="edit-email" name="email" type="email" defaultValue={client.email || ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Anotações</Label>
              <Textarea id="edit-notes" name="notes" defaultValue={client.notes || ""} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={updateMutation.isPending}>Atualizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
