import { Component, type ReactNode } from "react";
import { i18n } from "@app/i18n";
import { Button } from "./button";

export class ErrorBoundary extends Component<{
  children: ReactNode;
  onError?: (error: unknown) => void;
}, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="error-fallback" role="alert">
        <h1>{i18n.t("error.title")}</h1>
        <p>{this.state.error.message}</p>
        <Button onClick={() => location.reload()}>{i18n.t("error.reload")}</Button>
      </main>
    );
  }
}
