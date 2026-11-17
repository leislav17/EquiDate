import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../utils/navigation';

export const AdminUsers: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-external-user', { body: { email: email.trim(), password } });
      if (error || !data?.success) throw new Error('No se pudo crear el usuario. Verificá el correo, la contraseña o si la cuenta ya existe.');
      setMessage('Usuario creado. Ya puede iniciar sesión; todavía no tiene concursos asignados.');
      setEmail(''); setPassword('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el usuario.'); }
    finally { setLoading(false); }
  };
  return <div className="max-w-xl mx-auto px-4 py-8">
    <button onClick={() => navigate('/admin')} className="text-sm text-[#123E59] underline mb-5">Volver al panel</button>
    <h1 className="text-2xl font-black text-[#123E59]">Crear usuario externo</h1>
    <p className="text-sm text-neutral-600 mt-2">Definí un correo y una contraseña para compartir con la persona. No se enviará un correo automático.</p>
    <form onSubmit={submit} className="bg-white border border-neutral-200 rounded-2xl p-6 mt-5 space-y-4">
      <label className="block text-sm font-bold">Correo<input type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} className="block w-full mt-1 h-11 px-3 border rounded-xl font-normal" /></label>
      <label className="block text-sm font-bold">Contraseña inicial<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full mt-1 h-11 px-3 border rounded-xl font-normal" /></label>
      <p className="text-xs text-neutral-500">Usá al menos 8 caracteres. La contraseña no se mostrará después de crear la cuenta.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      <button disabled={loading} className="px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold disabled:opacity-50">{loading ? 'Creando…' : 'Crear usuario'}</button>
    </form>
  </div>;
};
