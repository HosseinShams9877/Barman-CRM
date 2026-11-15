"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * مرز خطای React — فاز ۱: راه‌اندازی اولیه.
 * خطاهای رندر را می‌گیرد و یک رابط قابل بازگشت نشان می‌دهد.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== "undefined") {
      console.error("ErrorBoundary caught:", error, info.componentStack);
    }
  }

  private retry = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        this.props.fallback?.(error, this.retry) ?? (
          <div className="card" role="alert">
            <h2 className="h2">خطای نمایش</h2>
            <p>هنگام بارگذاری این بخش خطایی رخ داد. دوباره تلاش کنید.</p>
            <button type="button" className="btn btn-primary" onClick={this.retry}>
              تلاش دوباره
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
