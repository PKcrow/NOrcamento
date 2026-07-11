import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors in the route tree so a single crashing page
 * doesn't leave the user staring at a blank/unrecoverable screen.
 * Resets automatically whenever the location changes (via `key` on
 * the instance in App.tsx).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Erro ao renderizar a página:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center px-4">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Algo deu errado ao carregar esta página</h2>
            <p className="text-gray-500 mt-1">Tente recarregar. Se o erro continuar, avise o suporte.</p>
          </div>
          <Button onClick={() => window.location.reload()}>Recarregar página</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
