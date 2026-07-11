import { useState, useMemo, useEffect } from "react";
import { useListClients, useListProducts, useCreateQuote, useGetQuote, useUpdateQuote, getGetQuoteQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
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
  
  const { data: clients } = useListClients();
  const { data: products } = useListProducts();
  
  // If id provided, fetch existing quote data
  const { data: existingQuote, isLoading: isLoadingQuote } = useGetQuote(id as number, { query: { enabled: !!id, queryKey: getGetQuoteQueryKey(id as number) } });
  
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const { toast } = useToast();

  const [clientId, setClientId] = useState<string>(initialClientId || "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<(QuoteItemInput & { localId: string })[]>([
    { localId: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, productId: null }
  ]);

  // Load existing data into form
  useEffect(() => {
    if (existingQuote) {
      setClientId(existingQuote.clientId.toString());
      setNotes(existingQuote.notes || "");
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

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [items]);

  const handleAddItem = () => {
    setItems([...items, { localId: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, productId: null }]);
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
      items: validItems.map(i => ({
        productId: i.productId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice
      }))
    };

    if (id) {
      updateMutation.mutate({ id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Orçamento atualizado." });
          setLocation(`/orcamentos/${id}`);
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: (data) => {
          toast({ title: "Orçamento criado com sucesso!" });
          setLocation(`/orcamentos/${data.id}`);
        }
      });
    }
  };

  if (id && isLoadingQuote) {
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
            {id ? `Editar Orçamento #${id.toString().padStart(4, '0')}` : 'Novo Orçamento'}
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
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Escolha da sua lista" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
