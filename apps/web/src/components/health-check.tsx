'use client';
import { useState } from 'react';
import { Button } from '@agro/ui/button';
import { checkHealth } from '@/lib/health';
export function HealthCheck() {
  const [status, setStatus] = useState('Aguardando verificação.');
  const [loading, setLoading] = useState(false);
  async function verify() {
    setLoading(true);
    setStatus('Verificando…');
    try {
      await checkHealth(process.env.NEXT_PUBLIC_API_URL);
      setStatus('API disponível.');
    } catch {
      setStatus(
        'Não foi possível verificar a API. Confira a conexão e a configuração.',
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite">
        {status}
      </p>
      <Button onClick={verify} disabled={loading}>
        {loading ? 'Verificando…' : 'Verificar API'}
      </Button>
    </div>
  );
}
