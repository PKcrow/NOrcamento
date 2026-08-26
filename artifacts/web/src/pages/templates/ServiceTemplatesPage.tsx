import { useEffect, useMemo, useState } from "react";
import {
  useCreateServiceTemplate,
  useDeleteServiceTemplate,
  useListProducts,
  useListServiceTemplates,
  useUpdateServiceTemplate,
  type ServiceTemplate,
  type ServiceTemplateInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ClipboardList,
  Edit2,
  FilePlus2,
  PackageOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

type EditableItem = {
  localId: string;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

type TemplateDraft = {
  name: string;
  serviceScopeEnabled: boolean;
  serviceDescription: string;
  notes: string;
  laborCost: number;
  items: EditableItem[];
};

const blankItem = (): EditableItem => ({
  localId: Math.random().toString(36).slice(2),
  productId: null,
  description: "",
  quantity: 1,
  unitPrice: 0,
});

function toDraft(template?: ServiceTemplate | null): TemplateDraft {
  if (!template) {
    return {
      name: "",
      serviceScopeEnabled: false,
      serviceDescription: "",
      notes: "",
      laborCost: 0,
      items: [blankItem()],
    };
  }

  return {
    name: template.name,
    serviceScopeEnabled: template.serviceScopeEnabled,
    serviceDescription: template.serviceDescription ?? "",
    notes: template.notes ?? "",
    laborCost: template.laborCost,
    items: template.items.map((item) => ({
      localId: Math.random().toString(36).slice(2),
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

function TemplateEditor({
  template,
  open,
  onOpenChange,
  onSubmit,
  isSaving,
}: {
  template: ServiceTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: TemplateDraft) => void;
  isSaving: boolean;
}) {
  const { data: products } = useListProducts();
  const [draft, setDraft] = useState<TemplateDraft>(() => toDraft(template));

  useEffect(() => {
    if (open) setDraft(toDraft(template));
  }, [open, template]);

  const itemTotal = useMemo(
    () =>
      draft.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      ),
    [draft.items],
  );

  const updateItem = (
    index: number,
    field: keyof Omit<EditableItem, "localId">,
    value: string | number | null,
  ) => {
    setDraft((current) => {
      const items = [...current.items];
      const next = { ...items[index], [field]: value };
      if (field === "productId" && typeof value === "number") {
        const product = products?.find((entry) => entry.id === value);
        if (product) {
          next.description = product.name;
          next.unitPrice = product.price;
        }
      }
      items[index] = next;
      return { ...current, items };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar modelo de serviço" : "Novo modelo de serviço"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do modelo *</Label>
            <Input
              id="template-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Ex.: Instalação residencial padrão"
            />
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="template-scope" className="cursor-pointer">
                  Incluir escopo do serviço
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Esta descrição será preenchida no novo orçamento.
                </p>
              </div>
              <Switch
                id="template-scope"
                checked={draft.serviceScopeEnabled}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    serviceScopeEnabled: checked,
                    serviceDescription: checked
                      ? current.serviceDescription
                      : "",
                  }))
                }
              />
            </div>
            {draft.serviceScopeEnabled && (
              <Textarea
                className="mt-4 min-h-24"
                value={draft.serviceDescription}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    serviceDescription: event.target.value,
                  }))
                }
                placeholder="O que está incluído neste serviço?"
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Itens do modelo *</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    items: [...current.items, blankItem()],
                  }))
                }
              >
                <Plus className="h-4 w-4" /> Adicionar item
              </Button>
            </div>
            {draft.items.map((item, index) => (
              <div
                key={item.localId}
                className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1.4fr_1.8fr_0.7fr_1fr_auto]"
              >
                <Select
                  value={item.productId?.toString() ?? "none"}
                  onValueChange={(value) =>
                    updateItem(
                      index,
                      "productId",
                      value === "none" ? null : Number(value),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Item livre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Item livre</SelectItem>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={item.description}
                  onChange={(event) =>
                    updateItem(index, "description", event.target.value)
                  }
                  placeholder="Descrição *"
                />
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, "quantity", Number(event.target.value))
                  }
                  aria-label="Quantidade"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateItem(index, "unitPrice", Number(event.target.value))
                  }
                  aria-label="Preço unitário"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  disabled={draft.items.length === 1}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      items: current.items.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-labor">Mão de obra (R$)</Label>
              <Input
                id="template-labor"
                type="number"
                min="0"
                step="0.01"
                value={draft.laborCost}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    laborCost: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="rounded-lg border bg-muted/20 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">Total sugerido</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(itemTotal + draft.laborCost)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-notes">Observações e condições</Label>
            <Textarea
              id="template-notes"
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Ex.: Prazo, garantia ou condições de pagamento."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSubmit(draft)} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ServiceTemplatesPage() {
  const { data: templates, isLoading } = useListServiceTemplates();
  const createTemplate = useCreateServiceTemplate();
  const updateTemplate = useUpdateServiceTemplate();
  const deleteTemplate = useDeleteServiceTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(
    null,
  );

  const saveTemplate = (draft: TemplateDraft) => {
    const validItems = draft.items.filter((item) => item.description.trim());
    if (!draft.name.trim()) {
      toast({ title: "Informe o nome do modelo.", variant: "destructive" });
      return;
    }
    if (validItems.length === 0) {
      toast({
        title: "Adicione ao menos um item ao modelo.",
        variant: "destructive",
      });
      return;
    }

    const data: ServiceTemplateInput = {
      name: draft.name.trim(),
      serviceScopeEnabled: draft.serviceScopeEnabled,
      serviceDescription: draft.serviceScopeEnabled
        ? draft.serviceDescription.trim() || null
        : null,
      notes: draft.notes.trim() || null,
      laborCost: Number.isFinite(draft.laborCost) ? draft.laborCost : 0,
      items: validItems.map((item) => ({
        productId: item.productId,
        description: item.description.trim(),
        quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
        unitPrice: Number.isFinite(item.unitPrice) ? item.unitPrice : 0,
      })),
    };

    const onSuccess = () => {
      queryClient.invalidateQueries();
      setEditorOpen(false);
      setEditingTemplate(null);
      toast({
        title: editingTemplate ? "Modelo atualizado." : "Modelo criado.",
      });
    };
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data }, { onSuccess });
    } else {
      createTemplate.mutate({ data }, { onSuccess });
    }
  };

  const removeTemplate = (template: ServiceTemplate) => {
    if (!confirm(`Excluir o modelo "${template.name}"?`)) return;
    deleteTemplate.mutate(
      { id: template.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: "Modelo excluído." });
        },
      },
    );
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold text-primary">ORÇAMENTOS RÁPIDOS</p>
          <h1 className="text-3xl font-bold tracking-tight">Modelos de serviço</h1>
          <p className="mt-1 text-muted-foreground">
            Reutilize itens, preços, escopo e condições sem alterar orçamentos
            já criados.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditingTemplate(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Novo modelo
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          Carregando modelos…
        </div>
      ) : templates?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => {
            const total =
              template.items.reduce(
                (sum, item) => sum + item.quantity * item.unitPrice,
                0,
              ) + template.laborCost;
            return (
              <article
                key={template.id}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{template.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.items.length} {template.items.length === 1 ? "item" : "itens"} ·{" "}
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingTemplate(template);
                        setEditorOpen(true);
                      }}
                      aria-label={`Editar ${template.name}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeTemplate(template)}
                      aria-label={`Excluir ${template.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {template.serviceScopeEnabled && template.serviceDescription && (
                  <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
                    {template.serviceDescription}
                  </p>
                )}
                <div className="mt-5 border-t pt-4">
                  <Link
                    href={`/orcamentos/novo?modelo=${template.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <FilePlus2 className="h-4 w-4" /> Usar em novo orçamento
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <PackageOpen className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Crie seu primeiro modelo</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Salve os serviços que você repete para montar orçamentos com menos
            digitação e valores consistentes.
          </p>
          <Button
            className="mt-5 gap-2"
            onClick={() => {
              setEditingTemplate(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Criar modelo
          </Button>
        </div>
      )}

      <TemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
        onSubmit={saveTemplate}
        isSaving={isSaving}
      />
    </div>
  );
}