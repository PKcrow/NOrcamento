import { useState, useMemo, useEffect } from "react";
import { useListClients, useListProducts, useListServiceTemplates, useCreateQuote, useGetQuote, useUpdateQuote, useCreateClient, getGetQuoteQueryKey, getGetDashboardSummaryQueryKey, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Plus, Trash2, ArrowLeft, Save, ChevronsUpDown, Check, UserPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type { QuoteItemInput } from "@workspace/api-client-react";

interface QuoteFormProps {
  id?: number; // if present, it's an edit form
}

export function QuoteForm({ id }: QuoteFormProps) {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialClientId = searchParams.get('client');
  const initialTemplateId = searchParams.get('modelo');
  const queryId = searchParams.get('id');
  const parsedQueryId = queryId ? Number(queryId) : undefined;
  const quoteId =
    id ?? (parsedQueryId && Number.isInteger(parsedQueryId) && parsedQueryId > 0
      ? parsedQueryId
      : undefined);
  const isEditing = quoteId !== undefined;
  
  const { data: clients } = useListClients();
  const { data: products } = useListProducts();
  const { data: serviceTemplates } = useListServiceTemplates();
  
  // If id provided, fetch existing quote data
  const { data: existingQuote, isLoading: isLoadingQuote } = useGetQuote(quoteId ?? 0, {
    query: {
      enabled: isEditing,
      queryKey: getGetQuoteQueryKey(quoteId ?? 0),
    },
  });
  
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const createClientMutation = useCreateClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [clientOpen, setClientOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  const [clientId, setClientId] = useState<string>(isEditing ? "" : initialClientId || "");
  const [notes, setNotes] = useState("");
  const [laborCost, setLaborCost] = useState<number>(0);
  const [serviceScopeEnabled, setServiceScopeEnabled] = useState(false);
  const [serviceDescription, setServiceDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [items, setItems] = useState<(QuoteItemInput & { localId: string })[]>([
    { localId: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, productId: null }
  ]);

  // Load existing data into form
  useEffect(() => {
    if (existingQuote) {
      setClientId(existingQuote.clientId.toString());
      setNotes(existingQuote.notes || "");
      setLaborCost(existingQuote.laborCost || 0);
      setServiceScopeEnabled(existingQuote.serviceScopeEnabled);
      setServiceDescription(existingQuote.serviceDescription || "");
      if (existingQuote.items.length > 0) {
        setItems(existingQuote.items.map(i => ({
          localId: Math.random().toString(),
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        })));
      }
    }
  }, [existingQuote]);

  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [items]);

  const total = itemsTotal + laborCost;

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = serviceTemplates?.find(
      (entry) => entry.id === Number(templateId),
    );
    if (!template) return;

    setItems(
      template.items.map((item) => ({
        localId: Math.random().toString(),
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    );
    setLaborCost(template.laborCost);
    setServiceScopeEnabled(template.serviceScopeEnabled);
    setServiceDescription(template.serviceDescription ?? "");
    setNotes(template.notes ?? "");
    toast({
      title: `Modelo "${template.name}" aplicado.`,
      description: "Revise e ajuste os campos antes de salvar o orçamento.",
    });
  };

  useEffect(() => {
    if (
      !isEditing &&
      initialTemplateId &&
      serviceTemplates &&
      !selectedTemplateId
    ) {
      applyTemplate(initialTemplateId);
    }
  }, [initialTemplateId, isEditing, selectedTemplateId, serviceTemplates]);

  const handleAddItem = () => {
    setItems((previousItems) => [
      { localId: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, productId: null },
      ...previousItems,
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof QuoteItemInput, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // If selecting a product, auto-fill description and price
    if (field === 'productId' && value !== null && products) {
      const product = products.find(p => p.id === Number(value));
      if (product) {
        newItems[index].description = product.name;
        newItems[index].unitPrice = product.price;
      }
    }
    
    setItems(newItems);
  };

  const handleQuickCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    const email = (fd.get("email") as string).trim();
    const phone = (fd.get("phone") as string).trim();
    if (!name) return;
    createClientMutation.mutate(
      { data: { name, email: email || undefined, phone: phone || undefined } },
      {
        onSuccess: (newClient) => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setClientId(newClient.id.toString());
          setIsQuickCreateOpen(false);
          toast({ title: `Cliente "${newClient.name}" criado e selecionado.` });
        },
        onError: () => {
          toast({ title: "Erro ao criar cliente.", variant: "destructive" });
        },
      },
    );
  };

  const handleSave = () => {
    if (!clientId) {
      toast({ title: "Selecione um cliente.", variant: "destructive" });
      return;
    }
    
    // Validate items
    const validItems = items.filter(i => i.description.trim() !== "");
    if (validItems.length === 0) {
      toast({ title: "Adicione pelo menos um item válido.", variant: "destructive" });
      return;
    }

    const payload = {
      clientId: Number(clientId),
      notes: notes || undefined,
      laborCost,
      serviceScopeEnabled,
      serviceDescription: serviceScopeEnabled ? serviceDescription.trim() || null : null,
      items: validItems.map(i => ({
        productId: i.productId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice
      }))
    };

    if (quoteId) {
      updateMutation.mutate({ id: quoteId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Orçamento atualizado." });
          setLocation(`/orcamentos/${quoteId}`);
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Orçamento criado com sucesso!" });
          setLocation(`/orcamentos/${data.id}`);
        }
      });
    }
  };

  if (isEditing && isLoadingQuote) {
    return <div className="p-8 text-center">Carregando orçamento...</div>;
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {isEditing ? `Editar Orçamento #${quoteId.toString().padStart(4, '0')}` : 'Novo Orçamento'}
          </h1>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Selecione o Cliente *</Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientOpen}
                    className="w-full max-w-md justify-between font-normal"
                  >
                    {clientId && clients
                      ? (clients.find(c => c.id.toString() === clientId)?.name ?? "Escolha da sua lista")
                      : "Escolha da sua lista"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {/* Criar novo — sempre primeiro */}
                        <CommandItem
                          value="__new__"
                          onSelect={() => {
                            setClientOpen(false);
                            setIsQuickCreateOpen(true);
                          }}
                          className="text-primary font-medium gap-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          Criar novo cliente
                        </CommandItem>
                        {/* Lista de clientes existentes */}
                        {clients?.map(c => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setClientId(c.id.toString());
                              setClientOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn("h-4 w-4", clientId === c.id.toString() ? "opacity-100" : "opacity-0")}
                            />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Dialog de cadastro rápido */}
              <Dialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-primary" />
                      Novo cliente
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleQuickCreate} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-name">Nome *</Label>
                      <Input id="qc-name" name="name" required placeholder="Nome completo ou empresa" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-phone">Telefone</Label>
                      <Input id="qc-phone" name="phone" placeholder="(11) 99999-9999" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qc-email">E-mail</Label>
                      <Input id="qc-email" name="email" type="email" placeholder="cliente@email.com" />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancelar</Button>
                      </DialogClose>
                      <Button type="submit" disabled={createClientMutation.isPending}>
                        {createClientMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Criar e selecionar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {!isEditing && (
          <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Começar com um modelo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-2">
                <Label htmlFor="service-template">Modelo de serviço (opcional)</Label>
                <Select
                  value={selectedTemplateId || "none"}
                  onValueChange={(value) => {
                    if (value !== "none") applyTemplate(value);
                    else setSelectedTemplateId("");
                  }}
                >
                  <SelectTrigger id="service-template" className="bg-white">
                    <SelectValue placeholder="Preencher manualmente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Preencher manualmente</SelectItem>
                    {serviceTemplates?.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Itens, valores, escopo e condições serão copiados para este orçamento.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Escopo do serviço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label htmlFor="serviceScopeEnabled" className="cursor-pointer text-base">
                  Adicionar escopo do serviço
                </Label>
                <p className="mt-1 text-sm text-gray-500">
                  Exiba no orçamento uma descrição do que será realizado.
                </p>
              </div>
              <Switch
                id="serviceScopeEnabled"
                checked={serviceScopeEnabled}
                onCheckedChange={(checked) => {
                  setServiceScopeEnabled(checked);
                  if (!checked) setServiceDescription("");
                }}
              />
            </div>
            {serviceScopeEnabled && (
              <div className="space-y-2">
                <Label htmlFor="serviceDescription">Descrição do escopo</Label>
                <Textarea
                  id="serviceDescription"
                  placeholder="Descreva o serviço que será realizado, incluindo o que está incluído e os limites da execução."
                  className="min-h-[130px]"
                  value={serviceDescription}
                  onChange={(event) => setServiceDescription(event.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Itens do Orçamento</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddItem} className="gap-2">
              <Plus className="w-4 h-4" /> Adicionar Linha
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={item.localId} className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-gray-50/50">
                <div className="flex-1 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500 uppercase">Preencher do Catálogo</Label>
                      <Select 
                        value={item.productId?.toString() || "none"} 
                        onValueChange={(v) => handleItemChange(index, "productId", v === "none" ? null : Number(v))}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Item livre (sem catálogo)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Item livre</SelectItem>
                          {products?.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name} - {formatCurrency(p.price)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500 uppercase">Descrição do Item *</Label>
                      <Input 
                        value={item.description} 
                        onChange={(e) => handleItemChange(index, "description", e.target.value)} 
                        className="bg-white"
                        placeholder="Ex: Serviço de Instalação"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500 uppercase">Qtd</Label>
                      <Input 
                        type="number" min="1" step="any"
                        value={item.quantity} 
                        onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))} 
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs text-gray-500 uppercase">Preço Unitário</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                        <Input 
                          type="number" min="0" step="0.01"
                          value={item.unitPrice} 
                          onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))} 
                          className="bg-white pl-8"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500 uppercase">Total</Label>
                      <div className="h-10 flex items-center font-semibold text-gray-900 bg-white border rounded-md px-3">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {items.length > 1 && (
                  <Button 
                    variant="ghost" size="icon" 
                    className="self-end sm:self-center text-gray-400 hover:text-destructive"
                    onClick={() => handleRemoveItem(index)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter className="flex justify-between items-center border-t p-6 bg-gray-50 rounded-b-xl">
            <span className="text-sm font-medium text-gray-500">Subtotal dos itens</span>
            <span className="text-lg font-semibold text-gray-900">{formatCurrency(itemsTotal)}</span>
          </CardFooter>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Mão de Obra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="laborCost">Valor da mão de obra</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">R$</span>
                <Input
                  id="laborCost"
                  type="number" min="0" step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(Number(e.target.value))}
                  className="pl-8"
                  placeholder="0,00"
                />
              </div>
              <p className="text-xs text-gray-500">Adicionado ao valor total do orçamento, além dos itens.</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center border-t p-6 bg-gray-50 rounded-b-xl">
            <span className="text-lg font-medium text-gray-600">Valor Total do Orçamento</span>
            <span className="text-3xl font-extrabold text-primary">{formatCurrency(total)}</span>
          </CardFooter>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Observações e Condições</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Ex: Validade de 15 dias. Pagamento de 50% no início e 50% na entrega." 
              className="min-h-[100px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 bg-white border-t flex justify-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <div className="flex gap-4 w-full max-w-4xl mx-auto justify-end">
          <Button variant="outline" onClick={() => window.history.back()} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending} className="gap-2 px-8">
            <Save className="w-4 h-4" /> {isPending ? 'Salvando...' : 'Salvar Orçamento'}
          </Button>
        </div>
      </div>
    </div>
  );
}
