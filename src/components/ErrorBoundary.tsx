import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 pb-20 space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tighter uppercase text-red-600">Errore di Sistema</h1>
              <p className="mt-1 font-serif italic text-[11px] uppercase opacity-60">Impossibile caricare il modulo.</p>
            </div>
            
            <div className="border border-[var(--fg-color)] bg-[var(--card-bg)] p-6 shadow-[4px_4px_0px_0px_var(--fg-color)]">
                <h3 className="font-bold tracking-widest text-[#DC2626] uppercase text-xs mb-2">Dettagli Errore:</h3>
                <pre className="text-[10px] font-mono whitespace-pre-wrap opacity-80 bg-[var(--fg-color)] text-[var(--bg-color)] p-4 border border-[var(--fg-color)]">
                   {this.state.error?.toString()}
                </pre>
                <div className="mt-6">
                    <button 
                       onClick={() => (this as any).setState({ hasError: false })}
                       className="px-4 py-2 bg-[var(--fg-color)] text-[var(--bg-color)] text-[10px] uppercase font-bold tracking-widest hover:bg-[var(--bg-color)] hover:text-[var(--fg-color)] transition-colors border border-[var(--fg-color)]"
                    >
                        Riprova
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
