import { useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { Onboarding } from "@/pages/onboarding/Onboarding";
import { Dashboard } from "@/pages/dashboard/Dashboard";
import { QuotesList } from "@/pages/quotes/QuotesList";
import { QuoteForm } from "@/pages/quotes/QuoteForm";
import { QuoteDetail } from "@/pages/quotes/QuoteDetail";
import { Tasks } from "@/pages/tasks/Tasks";
import { Agenda } from "@/pages/agenda/Agenda";
import { Reports } from "@/pages/reports/Reports";
import { PublicQuoteView } from "@/pages/quotes/PublicQuoteView";
import { PrivacyPolicy } from "@/pages/legal/PrivacyPolicy";
import { ClientsList } from "@/pages/clients/ClientsList";
import { ClientDetail } from "@/pages/clients/ClientDetail";
import { ProductsList } from "@/pages/products/ProductsList";
import { ServiceTemplatesPage } from "@/pages/templates/ServiceTemplatesPage";
import { TeamSettings } from "@/pages/team/TeamSettings";
import { EquipesPage } from "@/pages/team/EquipesPage";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(24 95% 53%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214 32% 91%)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-gray-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-xl font-bold text-gray-900",
    headerSubtitle: "text-sm text-gray-500",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "text-sm font-semibold",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-gray-500",
    dividerText: "text-xs text-gray-400 font-medium uppercase",
    formFieldSuccessText: "text-green-600 text-sm",
    alertText: "text-sm",
    logoBox: "mb-6",
    logoImage: "h-12 w-12 rounded-lg",
    socialButtonsBlockButton: "border-gray-200 bg-white hover:bg-gray-50 text-gray-700",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 rounded-md",
    formFieldInput: "rounded-md border-gray-200 bg-white px-3 py-2 text-sm focus:ring-primary focus:border-primary",
    footerAction: "mt-6",
    dividerLine: "bg-gray-200",
    alert: "rounded-md border p-3",
    otpCodeFieldInput: "border-gray-200 rounded-md",
    formFieldRow: "mb-4",
    main: "w-full",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function PublicLanding() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="px-6 py-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <img src={`${basePath}/logo.svg`} alt="Logo" className="w-8 h-8 rounded" />
          <span className="font-bold text-lg tracking-tight">Gestão de Autônomos</span>
        </div>
        <Button onClick={() => setLocation('/sign-in')} variant="outline" className="gap-2">
          <LogIn className="w-4 h-4" /> Entrar
        </Button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl">
          A ferramenta que organiza seu <span className="text-primary">negócio independente.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-10">
          Chega de perder orçamentos e esquecer tarefas. Uma plataforma completa para enviar propostas, gerenciar clientes e acompanhar seus serviços.
        </p>
        <Button onClick={() => setLocation('/sign-up')} size="lg" className="text-lg px-8 py-6 h-auto">
          Começar Agora
        </Button>
      </main>
    </div>
  );
}

function TeamGuard({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (!me) return <Redirect to="/sign-in" />;
  
  if (!me.teamId) {
    return <Onboarding />;
  }

  return <Shell>{children}</Shell>;
}

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType, path: string }) {
  return (
    <Route path={path}>
      <Show when="signed-in">
        <TeamGuard>
          <Component />
        </TeamGuard>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </Route>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <TeamGuard>
          <Dashboard />
        </TeamGuard>
      </Show>
      <Show when="signed-out">
        <PublicLanding />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClientInstance = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClientInstance.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClientInstance]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Bem-vindo de volta",
            subtitle: "Faça login para acessar sua conta",
          },
        },
        signUp: {
          start: {
            title: "Crie sua conta",
            subtitle: "Comece a organizar seu negócio hoje",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ErrorBoundary key={location}>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <ProtectedRoute path="/orcamentos" component={QuotesList} />
            <ProtectedRoute path="/orcamentos/novo" component={QuoteForm} />
            <ProtectedRoute path="/orcamentos/:id" component={QuoteDetail} />
            <Route path="/orcamento-publico/:token" component={PublicQuoteView} />
            <Route path="/politica-de-privacidade" component={PrivacyPolicy} />
            <ProtectedRoute path="/tarefas" component={Tasks} />
            <ProtectedRoute path="/agenda" component={Agenda} />
            <ProtectedRoute path="/relatorios" component={Reports} />
            <ProtectedRoute path="/clientes" component={ClientsList} />
            <ProtectedRoute path="/clientes/:id" component={ClientDetail} />
            <ProtectedRoute path="/produtos" component={ProductsList} />
            <ProtectedRoute path="/modelos" component={ServiceTemplatesPage} />
            <ProtectedRoute path="/equipe" component={TeamSettings} />
          <ProtectedRoute path="/equipes" component={EquipesPage} />
            <Route>
              <div className="flex h-[100dvh] items-center justify-center">Página não encontrada</div>
            </Route>
          </Switch>
        </ErrorBoundary>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
