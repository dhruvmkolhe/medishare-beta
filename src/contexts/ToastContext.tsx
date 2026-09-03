import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: 'border-l-green-500 bg-green-50 text-green-800',
  error: 'border-l-red-500 bg-red-50 text-red-800',
  warning: 'border-l-amber-500 bg-amber-50 text-amber-800',
  info: 'border-l-blue-500 bg-blue-50 text-blue-800',
};

const iconColors: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => {
      const next = [...prev, { id, message, type, duration }];
      return next.length > 3 ? next.slice(-3) : next;
    });
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
          {toasts.map((t) => {
            const Icon = icons[t.type];
            return (
              <div
                key={t.id}
                className={`border-l-4 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right ${colors[t.type]}`}
                style={{ animation: 'slideIn 0.3s ease-out' }}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColors[t.type]}`} />
                <p className="text-sm flex-1 font-medium">{t.message}</p>
                <button
                  onClick={() => removeToast(t.id)}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-black/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
