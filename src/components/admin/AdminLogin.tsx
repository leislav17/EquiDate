import React, { useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { Lock, ArrowLeft, AlertCircle, Info } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { loginAdmin, setActiveView } = useEquestrian();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Por favor completá tu correo y contraseña.');
      return;
    }

    setLoading(true);
    const result = await loginAdmin(email.trim(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Credenciales inválidas. Verificá tu correo y contraseña.');
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#f4f6f8] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Back button */}
        <button
          type="button"
          onClick={() => setActiveView('public')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#123E59] hover:underline mb-4 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Concursos</span>
        </button>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-6 sm:p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-50 text-[#123E59] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <Lock className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-black text-[#123E59] tracking-tight uppercase">
              ADMINISTRACIÓN
            </h1>
            <p className="text-xs text-neutral-500 font-medium mt-1">
              Acceso exclusivo para administradores de concursos
            </p>
          </div>

          {/* Not configured notice */}
          {!configured && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Supabase aún no configurado:</span>
                Para persistencia real en la nube, agregá <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">VITE_SUPABASE_URL</code> y <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">VITE_SUPABASE_ANON_KEY</code> a tu archivo <code className="font-mono text-[11px]">.env</code> o panel de Netlify.
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ejemplo.com"
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all bg-white"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#123E59] focus:border-transparent transition-all bg-white"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 bg-[#123E59] hover:bg-[#0e3247] disabled:opacity-60 text-white rounded-xl text-sm font-extrabold tracking-wider uppercase transition-all shadow-xs active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Iniciando sesión...</span>
              ) : (
                <span>INICIAR SESIÓN</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
