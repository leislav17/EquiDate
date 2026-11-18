import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../utils/navigation';
import { useEquestrian } from '../../context/EquestrianContext';

export const AdminUsers: React.FC = () => {
  const { events } = useEquestrian();
  const [users, setUsers] = useState<{id: string; email: string}[]>([]);
  const [assignments, setAssignments] = useState<{user_id: string; event_id: string}[]>([]);
  const [userId, setUserId] = useState('');
  const [eventId, setEventId] = useState('');
  const [listError, setListError] = useState('');
  const load = async () => {
    const { data, error } = await supabase.functions.invoke('external-assignments', { body: { action: 'list' } });
    if (error || !data?.users) { setListError('No se pudieron cargar los usuarios y asignaciones.'); return; }
    setUsers(data.users); setAssignments(data.assignments); setListError('');
  };
  useEffect(() => { void load(); }, []);
  const assign = async (e: React.FormEvent) => {
    e.preventDefault(); setListError('');
    const { error, data } = await supabase.functions.invoke('external-assignments', { body: { action: 'assign', userId, eventId } });
    if (error || !data?.success) { setListError('No se pudo asignar el concurso.'); return; }
    setEventId(''); await load();
  };
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
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el usuario.'); }
    finally { setLoading(false); }
  };
  return <div className="max-w-xl mx-auto px-4 py-8">
    <button onClick={() => navigate('/admin')} className="text-sm text-[#123E59] underline mb-5">Volver al panel</button>
    <h1 className="text-2xl font-black text-[#123E59]">Usuarios externos</h1>
    <p className="text-sm text-neutral-600 mt-2">Definí un correo y una contraseña para compartir con la persona. No se enviará un correo automático.</p>
    <form onSubmit={submit} className="bg-white border border-neutral-200 rounded-2xl p-6 mt-5 space-y-4">
      <label className="block text-sm font-bold">Correo<input type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} className="block w-full mt-1 h-11 px-3 border rounded-xl font-normal" /></label>
      <label className="block text-sm font-bold">Contraseña inicial<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full mt-1 h-11 px-3 border rounded-xl font-normal" /></label>
      <p className="text-xs text-neutral-500">Usá al menos 8 caracteres. La contraseña no se mostrará después de crear la cuenta.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      <button disabled={loading} className="px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold disabled:opacity-50">{loading ? 'Creando…' : 'Crear usuario'}</button>
    </form>
    <section className="bg-white border rounded-2xl p-6 mt-5 space-y-4">
      <h2 className="font-bold text-lg text-[#123E59]">Asignar concursos</h2>
      <p className="text-sm text-neutral-600">La asignación prepara el acceso para futuras funciones. Todavía no habilita la edición de transmisiones ni resultados.</p>
      <form onSubmit={assign} className="space-y-3">
        <label className="block text-sm font-bold">Usuario<select required value={userId} onChange={e => setUserId(e.target.value)} className="block w-full mt-1 h-11 border rounded-xl px-3 font-normal"><option value="">Elegí un usuario</option>{users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}</select></label>
        <label className="block text-sm font-bold">Concurso<select required value={eventId} onChange={e => setEventId(e.target.value)} className="block w-full mt-1 h-11 border rounded-xl px-3 font-normal"><option value="">Elegí un concurso</option>{events.map(event => <option key={event.id} value={event.id}>{event.name} — {event.startDate}</option>)}</select></label>
        <button className="px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold">Asignar concurso</button>
      </form>
      {listError && <p role="alert" className="text-red-700 text-sm">{listError}</p>}
      {users.map(user => <div key={user.id} className="border-t pt-3"><p className="font-bold">{user.email}</p><ul className="text-sm text-neutral-600">{assignments.filter(a => a.user_id === user.id).map(a => <li key={a.event_id}>{events.find(e => e.id === a.event_id)?.name || 'Concurso no disponible'}</li>)}</ul>{!assignments.some(a => a.user_id === user.id) && <p className="text-sm text-neutral-500">Sin concursos asignados.</p>}</div>)}
    </section>
  </div>;
};
