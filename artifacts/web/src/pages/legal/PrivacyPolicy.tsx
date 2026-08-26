import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BriefcaseBusiness, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "giancarlo.macedo.espindola@gmail.com";

export function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Política de Privacidade | Gestão de Autônomos";
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute(
      "content",
      "Política de privacidade do aplicativo Gestão de Autônomos.",
    );
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 font-semibold text-slate-900"
            aria-label="Voltar para a página inicial"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            Gestão de Autônomos
          </button>
          <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-10 flex items-start gap-4">
            <div className="rounded-xl bg-orange-100 p-3 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Gestão de Autônomos
              </p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
                Política de Privacidade
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Última atualização: 20 de agosto de 2026
              </p>
            </div>
          </div>

          <div className="space-y-8 text-sm leading-7 text-slate-700 sm:text-base">
            <section>
              <h2 className="text-lg font-bold text-slate-950">1. Visão geral</h2>
              <p className="mt-2">
                Esta política explica como o Gestão de Autônomos trata os dados
                necessários para organizar clientes, orçamentos, ordens de serviço e
                equipes. Ao utilizar o aplicativo ou o site, você concorda com estas
                práticas.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-950">2. Dados tratados</h2>
              <p className="mt-2">Podemos tratar as seguintes categorias de dados:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>dados de cadastro e autenticação, como nome e endereço de e-mail;</li>
                <li>dados de clientes, contatos e empresas inseridos pelo usuário;</li>
                <li>orçamentos, serviços, tarefas, pagamentos e observações registrados no aplicativo;</li>
                <li>mensagens incluídas em respostas a orçamentos compartilhados;</li>
                <li>dados técnicos mínimos necessários para segurança, funcionamento e prevenção de fraudes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-950">3. Finalidades</h2>
              <p className="mt-2">
                Os dados são usados para criar e manter contas, disponibilizar os
                recursos do serviço, compartilhar orçamentos quando solicitado pelo
                usuário, proteger o acesso às informações e prestar suporte.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-950">4. Compartilhamento e armazenamento</h2>
              <p className="mt-2">
                Os dados podem ser processados por fornecedores indispensáveis para
                autenticação, hospedagem e infraestrutura do serviço. Não vendemos
                dados pessoais. O compartilhamento ocorre apenas quando necessário
                para fornecer o serviço, cumprir obrigações legais ou por solicitação
                do usuário.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-950">5. Segurança e retenção</h2>
              <p className="mt-2">
                Adotamos medidas técnicas e organizacionais razoáveis para proteger as
                informações. Os dados são mantidos enquanto a conta ou a equipe estiver
                ativa, ou pelo período necessário para cumprir obrigações legais e
                resolver eventuais solicitações.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-950">6. Seus direitos</h2>
              <p className="mt-2">
                Você pode solicitar acesso, correção, atualização ou exclusão de dados
                pessoais, observadas as hipóteses de retenção previstas em lei. Para
                isso, entre em contato pelo canal abaixo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-950">7. Alterações nesta política</h2>
              <p className="mt-2">
                Esta política pode ser atualizada para refletir melhorias no serviço ou
                mudanças legais. A versão vigente estará sempre disponível nesta página.
              </p>
            </section>

            <section className="rounded-xl border border-orange-100 bg-orange-50 p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <Mail className="h-5 w-5 text-primary" />
                8. Contato
              </h2>
              <p className="mt-2">
                Para dúvidas sobre privacidade ou solicitações relacionadas aos seus
                dados, escreva para{" "}
                <a className="font-semibold text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}