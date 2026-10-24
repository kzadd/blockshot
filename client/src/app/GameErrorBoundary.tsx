import { Component, type ReactNode } from 'react';

interface Props {
  onLeave: () => void;
  children: ReactNode;
}

// WebGL blocked on a lab PC, or a stale Game chunk after the server was rebuilt: show a way out
// instead of a blank page
export default class GameErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error(error);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="modal-bg">
        <div className="modal pass-modal" role="alertdialog" aria-labelledby="game-error-title">
          <div className="modal-head">
            <h2 id="game-error-title">No se pudo iniciar el juego</h2>
          </div>
          <p className="meta">
            Puede que este ordenador no tenga gráficos 3D activados o que el servidor se haya reiniciado.
          </p>
          <div className="modal-foot">
            <button className="btn ghost md" onClick={this.props.onLeave}>
              Volver al lobby
            </button>
            <button className="btn primary md" onClick={() => location.reload()}>
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
