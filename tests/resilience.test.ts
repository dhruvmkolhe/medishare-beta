import { describe, it, expect } from 'vitest';
import ErrorBoundary from '../src/components/ErrorBoundary';

describe('React Error Boundary & Resilience Suite', () => {
  it('initializes in healthy state without errors', () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
  });

  it('updates state to hasError: true via getDerivedStateFromError', () => {
    const testError = new Error('Render crash simulation');
    const nextState = ErrorBoundary.getDerivedStateFromError(testError);

    expect(nextState.hasError).toBe(true);
    expect(nextState.error).toBe(testError);
    expect(nextState.error?.message).toBe('Render crash simulation');
  });

  it('componentDidCatch captures error and errorInfo cleanly', () => {
    const boundary = new ErrorBoundary({ children: null });
    const testError = new Error('Test boundary exception');
    const mockErrorInfo = { componentStack: '\n    in CrashingComponent\n    in App' };

    boundary.componentDidCatch(testError, mockErrorInfo);
    expect(boundary.state.error).toBe(testError);
    expect(boundary.state.errorInfo).toEqual(mockErrorInfo);
  });
});
