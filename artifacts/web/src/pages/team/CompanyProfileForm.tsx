import { useRef, useState } from "react";
import {
  useCreateCompanyDocument,
  useDeleteCompanyDocument,
  useGetCompany,
  useListCompanyDocuments,
  useRequestUploadUrl,
  useUpdateCompany,
  getGetCompanyQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload, ACCEPTED_IMAGE_TYPES, MAX_ORIGINAL_SIZE_BYTES } from "@/hooks/use-file-upload";
import { normalizeStoredObjectUrl } from "@/lib/objectUrl";
import { Building2, FileText, ImagePlus, Loader2, Search, Share2, Trash2, Upload } from "lucide-react";

type DocumentTypeFilter = "all" | "pdf" | "image" | "document" | "other";

const DOCUMENT_TYPE_FILTERS: Array<{ value: DocumentTypeFilter; label: string }> = [
  { value: "all", label: "Todos os tipos" },
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Imagens" },
  { value: "document", label: "Documentos" },
  { value: "other", label: "Outros" },
];

function getDocumentTypeFilter(contentType: string | null | undefined, fileName: string | null | undefined): Exclude<DocumentTypeFilter, "all"> {
  const normalizedType = (contentType ?? "").toLowerCase();
  const normalizedName = (fileName ?? "").toLowerCase();
  if (normalizedType === "application/pdf" || normalizedName.endsWith(".pdf")) return "pdf";
  if (normalizedType.startsWith("image/")) return "image";
  if (
    normalizedType.startsWith("text/") ||
    normalizedType.includes("word") ||
    normalizedType.includes("excel") ||
    normalizedType.includes("spreadsheet") ||
    normalizedType.includes("presentation") ||
    normalizedType.includes("opendocument")
  ) {
    return "document";
  }
  return "other";
}

export function CompanyProfileForm() {
  const { data: company, isLoading } = useGetCompany();
  const updateMutation = useUpdateCompany();
  const { upload, isUploading } = useFileUpload();
  const { data: documents } = useListCompanyDocuments();
  const requestUploadUrl = useRequestUploadUrl();
  const createDocument = useCreateCompanyDocument();
  const deleteDocument = useDeleteCompanyDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentTypeFilter>("all");

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
  const normalizedDocumentSearch = documentSearch.trim().toLowerCase();
  const filteredDocuments = (documents ?? []).filter((document) => {
    const matchesSearch =
      !normalizedDocumentSearch ||
      document.name.toLowerCase().includes(normalizedDocumentSearch) ||
      document.fileName.toLowerCase().includes(normalizedDocumentSearch);
    const matchesType =
      documentTypeFilter === "all" ||
      getDocumentTypeFilter(document.contentType, document.fileName) === documentTypeFilter;
    return matchesSearch && matchesType;
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCompanyQueryKey() });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Envie uma imagem PNG, JPG, WEBP ou SVG.", variant: "destructive" });
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
      await updateMutation.mutateAsync({ data: { logoUrl: url } });
      setLogoUrl(url);
      invalidate();
      toast({ title: "Logo atualizado." });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Tente novamente.";
      toast({ title: "Erro ao enviar o logo", description: message, variant: "destructive" });
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateMutation.mutateAsync({ data: { logoUrl: null } });
      setLogoUrl(null);
      invalidate();
      toast({ title: "Logo removido." });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Tente novamente.";
      toast({ title: "Erro ao remover o logo", description: message, variant: "destructive" });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = (formData.get("email") as string) || null;
    const phone = (formData.get("phone") as string) || null;
    const address = (formData.get("address") as string) || null;
    const legalName = (formData.get("legalName") as string) || null;
    const taxId = (formData.get("taxId") as string) || null;
    const website = (formData.get("website") as string) || null;
    const pixKey = (formData.get("pixKey") as string) || null;
    const bankDetails = (formData.get("bankDetails") as string) || null;
    const paymentInstructions = (formData.get("paymentInstructions") as string) || null;
    const additionalInfo = (formData.get("additionalInfo") as string) || null;

    if (!name.trim()) return;

    updateMutation.mutate({ data: {
      name,
      email,
      phone,
      address,
      legalName,
      taxId,
      website,
      pixKey,
      bankDetails,
      paymentInstructions,
      additionalInfo,
      showPhoneOnQuotes: formData.get("showPhoneOnQuotes") === "on",
      showEmailOnQuotes: formData.get("showEmailOnQuotes") === "on",
      showAddressOnQuotes: formData.get("showAddressOnQuotes") === "on",
      showLegalNameOnQuotes: formData.get("showLegalNameOnQuotes") === "on",
      showTaxIdOnQuotes: formData.get("showTaxIdOnQuotes") === "on",
      showWebsiteOnQuotes: formData.get("showWebsiteOnQuotes") === "on",
      showPixKeyOnQuotes: formData.get("showPixKeyOnQuotes") === "on",
      showBankDetailsOnQuotes: formData.get("showBankDetailsOnQuotes") === "on",
      showPaymentInstructionsOnQuotes: formData.get("showPaymentInstructionsOnQuotes") === "on",
      showAdditionalInfoOnQuotes: formData.get("showAdditionalInfoOnQuotes") === "on",
    } }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Dados da empresa salvos." });
      },
      onError: () => {
        toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
      },
    });
  };

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é de 30MB.", variant: "destructive" });
      return;
    }

    setIsUploadingDocument(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        },
      });
      const response = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error("upload");
      await createDocument.mutateAsync({
        data: {
          name: file.name,
          documentType: "Documento da empresa",
          fileName: file.name,
          objectPath,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
      });
      queryClient.invalidateQueries();
      toast({ title: "Documento salvo." });
    } catch {
      toast({ title: "Erro ao enviar o documento", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleShareDocument = async (document: NonNullable<typeof documents>[number]) => {
    const url = normalizeStoredObjectUrl(document.objectPath);
    if (navigator.share) {
      try {
        await navigator.share({ title: document.name, text: document.name, url });
        return;
      } catch {}
    }
    window.open(url, "_blank", "noopener,noreferrer");
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
                   <p className="text-xs text-gray-500">PNG, JPG, WEBP ou SVG, formato quadrado recomendado (ex: 512x512px), até 5MB.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input id="name" name="name" defaultValue={company.name} required placeholder="Ex: João Silva Serviços Elétricos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalName">Razão social</Label>
                <Input id="legalName" name="legalName" defaultValue={company.legalName ?? ""} placeholder="Ex: João Silva Serviços Elétricos LTDA" />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showLegalNameOnQuotes" defaultChecked={company.showLegalNameOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">CPF ou CNPJ</Label>
                <Input id="taxId" name="taxId" defaultValue={company.taxId ?? ""} placeholder="00.000.000/0001-00" />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showTaxIdOnQuotes" defaultChecked={company.showTaxIdOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email de Contato</Label>
                <Input id="email" name="email" type="email" defaultValue={company.email ?? ""} placeholder="contato@empresa.com" />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showEmailOnQuotes" defaultChecked={company.showEmailOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={company.phone ?? ""} placeholder="(11) 99999-9999" />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showPhoneOnQuotes" defaultChecked={company.showPhoneOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Textarea id="address" name="address" defaultValue={company.address ?? ""} placeholder="Rua, número, bairro, cidade - UF" rows={1} />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showAddressOnQuotes" defaultChecked={company.showAddressOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Site ou rede social</Label>
                <Input id="website" name="website" defaultValue={company.website ?? ""} placeholder="www.suaempresa.com.br" />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showWebsiteOnQuotes" defaultChecked={company.showWebsiteOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixKey">Chave Pix</Label>
                <Input id="pixKey" name="pixKey" defaultValue={company.pixKey ?? ""} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showPixKeyOnQuotes" defaultChecked={company.showPixKeyOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankDetails">Dados bancários</Label>
                <Textarea id="bankDetails" name="bankDetails" defaultValue={company.bankDetails ?? ""} placeholder="Banco, agência, conta e favorecido" rows={2} />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showBankDetailsOnQuotes" defaultChecked={company.showBankDetailsOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="paymentInstructions">Instruções de pagamento</Label>
                <Textarea id="paymentInstructions" name="paymentInstructions" defaultValue={company.paymentInstructions ?? ""} placeholder="Ex: 50% na aprovação e 50% na conclusão do serviço." rows={2} />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showPaymentInstructionsOnQuotes" defaultChecked={company.showPaymentInstructionsOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="additionalInfo">Outras informações</Label>
                <Textarea id="additionalInfo" name="additionalInfo" defaultValue={company.additionalInfo ?? ""} placeholder="Informações adicionais relevantes para seus clientes" rows={3} />
                <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" name="showAdditionalInfoOnQuotes" defaultChecked={company.showAdditionalInfoOnQuotes} /> Mostrar nos orçamentos e PDFs</label>
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-5 w-5 text-gray-500" />
            <div>
              <CardTitle>Documentos da empresa</CardTitle>
              <CardDescription>
                Guarde CCMEI, cartão MEI, dados de pagamento e outros arquivos importantes.
              </CardDescription>
            </div>
          </div>
          <input ref={documentInputRef} type="file" className="hidden" onChange={handleDocumentChange} />
          <Button type="button" variant="outline" size="sm" disabled={isUploadingDocument} onClick={() => documentInputRef.current?.click()}>
            {isUploadingDocument ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {documents?.length ? (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Buscar por nome ou arquivo"
                    className="pl-9"
                  />
                </div>
                <Select value={documentTypeFilter} onValueChange={(value) => setDocumentTypeFilter(value as DocumentTypeFilter)}>
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPE_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {filteredDocuments.length ? (
                <div className="divide-y rounded-lg border">
                  {filteredDocuments.map((document) => (
                    <div key={document.id} className="flex items-center gap-3 p-3">
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{document.name}</p>
                        <p className="truncate text-xs text-gray-500">{document.fileName}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" title="Compartilhar" onClick={() => handleShareDocument(document)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        className="text-gray-400 hover:text-destructive"
                        onClick={async () => {
                          if (!window.confirm(`Remover "${document.name}"?`)) return;
                          await deleteDocument.mutateAsync({ id: document.id });
                          queryClient.invalidateQueries();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
                  Nenhum documento encontrado para essa busca.
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
              Nenhum documento salvo ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
