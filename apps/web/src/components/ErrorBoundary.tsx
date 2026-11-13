import { Component, type ReactNode } from 'react';

/** Evita a tela em branco: mostra o erro e permite recarregar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ucop] erro na interface', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-screen">
        <div className="card stack">
          <p className="error">Algo deu errado nesta tela: {this.state.error.message}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
