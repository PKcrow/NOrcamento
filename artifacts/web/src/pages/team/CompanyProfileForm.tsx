import { useRef, useState } from "react";
import { useGetCompany, useUpdateCompany, getGetCompanyQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload, ACCEPTED_IMAGE_TYPES, MAX_ORIGINAL_SIZE_BYTES } from "@/hooks/use-file-upload";
import { normalizeStoredObjectUrl } from "@/lib/objectUrl";
import { Building2, ImagePlus, Loader2, Trash2 } from "lucide-react";

export function CompanyProfileForm() {
  const { data: company, isLoading } = useGetCompany();
  const updateMutation = useUpdateCompany();
  const { upload, isUploading } = useFileUpload();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (!company) return null;

  const effectiveLogoUrl = normalizeStoredObjectUrl(
    logoUrl !== undefined ? logoUrl ?? "" : company.logoUrl ?? "",
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCompanyQueryKey() });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Envie uma imagem PNG, JPG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_ORIGINAL_SIZE_BYTES) {
      toast({ title: "Arquivo muito grande", description: "Essa imagem é grande demais para ser enviada.", variant: "destructive" });
      return;
    }

    try {
      // Preserve transparency for logos (PNG/WEBP); resize to a smaller
      // max dimension since logos don't need photo-level resolution.
      const url = await upload(file, { maxDimension: 1024, preserveTransparency: true });
      setLogoUrl(url);
      updateMutation.mutate({ data: { logoUrl: url } }, {
        onSuccess: () => {
          invalidate();
          toast({ title: "Logo atualizado." });
        },
      });
    } catch {
      toast({ title: "Erro ao enviar o logo", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    updateMutation.mutate({ data: { logoUrl: null } }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Logo removido." });
      },
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = (formData.get("email") as string) || null;
    const phone = (formData.get("phone") as string) || null;
    const address = (formData.get("address") as string) || null;

    if (!name.trim()) return;

    updateMutation.mutate({ data: { name, email, phone, address } }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Dados da empresa salvos." });
      },
      onError: () => {
        toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-500" />
          <div>
            <CardTitle>Cabeçalho do Orçamento</CardTitle>
            <CardDescription>
              Estas informações aparecem no topo de todo orçamento gerado.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {effectiveLogoUrl ? (
                    <img
                      src={effectiveLogoUrl}
                      alt="Logo"
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                      {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                      {effectiveLogoUrl ? "Trocar logo" : "Enviar logo"}
                    </Button>
                    {effectiveLogoUrl && (
                      <Button type="button" variant="ghost" size="sm" className="text-gray-400 hover:text-destructive" onClick={handleRemoveLogo}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG ou WEBP, formato quadrado recomendado (ex: 512x512px), até 5MB.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input id="name" name="name" defaultValue={company.name} required placeholder="Ex: João Silva Serviços Elétricos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email de Contato</Label>
                <Input id="email" name="email" type="email" defaultValue={company.email ?? ""} placeholder="contato@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={company.phone ?? ""} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Textarea id="address" name="address" defaultValue={company.address ?? ""} placeholder="Rua, número, bairro, cidade - UF" rows={1} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Dados da Empresa"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
