// types/paystack.d.ts
// Global Paystack inline popup type declaration

interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref: string;
  metadata?: Record<string, unknown>;
  onClose: () => void;
  callback: (res: { reference: string }) => void;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (cfg: PaystackConfig) => { openIframe: () => void };
    };
  }
}

export {};
