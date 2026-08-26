import { CompanyProfileForm } from "./CompanyProfileForm";

export function TeamSettings() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Ajustes de Empresa
        </h1>
        <p className="text-gray-500 mt-1">
          Configure os dados da sua empresa que aparecem em orçamentos e documentos.
        </p>
      </div>

      <CompanyProfileForm />
    </div>
  );
}
