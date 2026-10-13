'use client';
import { useEffect } from 'react';
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((error: unknown) =>
          console.error('Falha no registro PWA', error),
        );
    }
  }, []);
  return null;
}
