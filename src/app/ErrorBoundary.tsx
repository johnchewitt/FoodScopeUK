import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/states/ErrorState";

interface Props {
  /** Region name shown in the error message, e.g. "Insights panel". */
  region: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Per-region error boundary: a failing panel never blanks the map (SH-07). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.region}]`, error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <ErrorState
          title={`${this.props.region} stopped working`}
          body={`${this.state.error.message}. The rest of the app is unaffected.`}
          actionLabel="Try again"
          onAction={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
