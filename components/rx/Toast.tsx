'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

type ToastFn = (message: string) => void;
const Ctx = createContext<ToastFn>(() => {});

/** Shows a short confirmation. Holds for four seconds. */
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 4000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="rx rx-toast" role="status" aria-live="polite">
          <Check aria-hidden />
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
