import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../utils/navigation';
import { useEquestrian } from '../../context/EquestrianContext';

type ExternalUser = { id: string; email: string; disabled: boolean };
type Assignment = { user_id: string; event_id: string; current: boolean };

export const AdminUsers: React.FC = () => {
  const { events } = useEquestrian();
  const [users, setUsers] = useState<ExternalUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState('');
  const [replacement, setReplacement] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('external-assignments', { body: { action: 'list' } });
    if (error || !Array.isArray(data?.users) || !Array.isArray(data?.assignments)) setError('No se pudieron cargar los usuarios. Intentá nuevamente.');
    else { setUsers(data.users); setAssignments(data.assignments); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const reset = () => { setMode('list'); setSelectedId(''); setEmail(''); setPassword(''); setError(''); };
  const invoke = async (body: object) => {
    const { data, error } = await supabase.functions.invoke('external-assignments', { body });
    if (error || !data?.success) throw new Error('No se pudo completar la operación.');
  };
  const openEdit = (user: ExternalUser) => { setSelectedId(user.id); setEmail(user.email); setPassword(''); setError(''); setMessage(''); setMode('edit'); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'create') {
        const { data, error } = await supabase.functions.invoke('create-external-user', { body: { email: email.trim(), password } });
        if (error || !data?.success) throw new Error('No se pudo crear el usuario. Verificá el correo, la contraseña o si la cuenta ya existe.');
        reset(); setMessage('Usuario creado. Podés editarlo para asignarle concursos.');
      } else {
        const original = users.find(user => user.id === selectedId);
        if (!original) throw new Error('No se encontró el usuario.');
        if (email.trim().toLowerCase() !== original.email.toLowerCase()) {
          await invoke({ action: 'email', userId: selectedId, email: email.trim() });
          // Reload after each successful operation so partial errors cannot hide a saved change.
          await load();
        }
        if (password) await invoke({ action: 'password', userId: selectedId, password });
        reset(); setMessage('Datos del usuario actualizados.');
      }
      await load();
    } catch (err) { setPassword(''); setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  const run = async (body: object, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await invoke(body); await load(); setMessage(success); }
    catch { setError('No se pudo completar la operación. Intentá nuevamente.'); }
    finally { setBusy(false); }
  };
  const removeUser = (user: ExternalUser) => {
    if (!window.confirm(`¿Eliminar a ${user.email}? Se eliminará la cuenta y sus asignaciones a concursos. Esta acción no se puede deshacer.`)) return;
    void run({ action: 'delete', userId: user.id }, 'Usuario eliminado.');
  };
  const selected = users.find(user => user.id === selectedId);
  const filtered = users.filter(user => user.email.toLowerCase().includes(search.trim().toLowerCase()));
  const input = 'block w-full mt-1 h-11 px-3 border border-neutral-300 rounded-xl font-normal focus:outline-none focus:ring-2 focus:ring-[#123E59]/30';
  return <div className="equidate-container py-6 sm:py-8 space-y-5">
    <button onClick={() => navigate('/admin')} className="text-sm text-[#123E59] underline">Volver al panel</button>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-[#123E59]">Usuarios externos</h1><p className="text-sm text-neutral-600 mt-1">Administrá las cuentas y los concursos habilitados.</p></div>{mode === 'list' && <button onClick={() => { reset(); setMessage(''); setMode('create'); }} className="inline-flex items-center gap-2 px-4 py-3 bg-[#123E59] text-white rounded-xl font-bold"><Plus size={18} /> Agregar usuario</button>}</div>
    {error && <p role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</p>}
    {message && <p role="status" className="p-3 rounded-xl bg-green-50 text-green-700 text-sm">{message}</p>}
    {mode === 'list' ? <section className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-6 min-w-0">
      <label className="relative block sm:ml-auto sm:max-w-xs"><span className="sr-only">Buscar por correo</span><Search className="absolute left-3 top-3 text-neutral-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por correo" className="w-full h-11 pl-10 pr-3 border border-neutral-200 rounded-xl" /></label>
      {loading ? <p className="py-8 text-center text-neutral-500">Cargando usuarios…</p> : filtered.length === 0 ? <p className="py-8 text-center text-neutral-500">{search ? 'No se encontraron usuarios.' : 'Todavía no hay usuarios externos.'}</p> : <div className="overflow-x-auto max-w-full mt-4"><table className="w-full min-w-[700px] text-sm text-left"><thead className="text-[#123E59] border-b border-neutral-200"><tr><th className="py-3 pr-4">Correo</th><th className="py-3 pr-4">Contraseña</th><th className="py-3 pr-4">Concursos habilitados</th><th className="py-3 pr-4">Estado</th><th className="py-3">Acciones</th></tr></thead><tbody>{filtered.map(user => <tr key={user.id} className="border-b border-neutral-100 align-top"><td className="py-4 pr-4 font-medium">{user.email}</td><td className="py-4 pr-4 text-neutral-500"><span aria-label="Contraseña protegida">••••••••</span><span className="block text-xs">Protegida</span></td><td className="py-4 pr-4">{assignments.some(a => a.user_id === user.id) ? <ul className="space-y-1">{assignments.filter(a => a.user_id === user.id).map(a => <li key={a.event_id}>{events.find(e => e.id === a.event_id)?.name || 'Concurso no disponible'} {!a.current && <span className="text-xs text-neutral-500">(vencido)</span>}</li>)}</ul> : <span className="text-neutral-500">Sin concursos</span>}</td><td className="py-4 pr-4"><span className={`inline-block px-2 py-1 rounded-full text-xs ${user.disabled ? 'bg-neutral-100 text-neutral-600' : 'bg-green-50 text-green-700'}`}>{user.disabled ? 'Desactivada' : 'Activa'}</span></td><td className="py-4"><div className="flex gap-2"><button onClick={() => openEdit(user)} aria-label={`Editar ${user.email}`} title="Editar" className="p-2 border rounded-lg text-[#123E59] hover:bg-neutral-50"><Pencil size={17} /></button><button onClick={() => removeUser(user)} disabled={busy} aria-label={`Eliminar ${user.email}`} title="Eliminar" className="p-2 border rounded-lg text-red-700 hover:bg-red-50"><Trash2 size={17} /></button></div></td></tr>)}</tbody></table></div>}
    </section> : <section className="max-w-2xl bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex justify-between items-center"><h2 className="text-lg font-bold text-[#123E59]">{mode === 'create' ? 'Agregar usuario' : 'Editar usuario'}</h2><button type="button" onClick={reset} aria-label="Cerrar" className="p-2 rounded-lg hover:bg-neutral-100"><X size={20} /></button></div>
      <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-bold">Correo<input className={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" /></label><label className="block text-sm font-bold">{mode === 'create' ? 'Contraseña inicial' : 'Nueva contraseña (opcional)'}<input className={input} type="password" minLength={8} required={mode === 'create'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label><p className="text-xs text-neutral-500">La contraseña debe tener al menos 8 caracteres y no se puede volver a mostrar. No se enviará un correo automático.</p><div className="flex gap-3"><button disabled={busy} className="px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" onClick={reset} className="px-5 py-3 border rounded-xl">Cancelar</button></div></form>
      {mode === 'edit' && selected && <div className="space-y-4 border-t pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-[#123E59]">Estado de la cuenta</h3><p className="text-sm text-neutral-600">{selected.disabled ? 'Desactivada' : 'Activa'}</p></div><button type="button" disabled={busy} onClick={() => { if (!selected.disabled && !window.confirm('¿Desactivar esta cuenta? La persona dejará de poder operar.')) return; void run({ action: selected.disabled ? 'enable' : 'disable', userId: selected.id }, selected.disabled ? 'Cuenta reactivada.' : 'Cuenta desactivada.'); }} className="text-sm underline text-[#123E59]">{selected.disabled ? 'Reactivar' : 'Desactivar'}</button></div><div><h3 className="font-bold text-[#123E59]">Concursos habilitados</h3><p className="text-xs text-neutral-500 mt-1">El acceso vence a las 23:59 del día siguiente a la fecha de cierre del concurso (hora argentina). Los cambios se guardan al seleccionarlos.</p><div className="max-h-64 overflow-y-auto mt-3 space-y-1">{events.length ? events.map(event => { const checked = assignments.some(a => a.user_id === selected.id && a.event_id === event.id); return <label key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 text-sm"><input type="checkbox" checked={checked} disabled={busy} onChange={() => void run({ action: checked ? 'unassign' : 'assign', userId: selected.id, eventId: event.id }, checked ? 'Acceso al concurso retirado.' : 'Concurso asignado.')} /><span className="min-w-0 break-words">{event.name} <span className="text-neutral-500">({event.startDate})</span></span></label>; }) : <p className="text-sm text-neutral-500">No hay concursos disponibles.</p>}</div></div><div className="border-t pt-4"><h3 className="font-bold text-[#123E59]">Reemplazar usuario en un concurso</h3><p className="text-xs text-neutral-500 mt-1">El acceso se retira a este usuario y se asigna al reemplazo. Los datos del concurso se conservan.</p>{assignments.filter(a => a.user_id === selected.id).map(a => <div key={a.event_id} className="flex flex-wrap gap-2 items-center mt-3"><span className="text-sm w-full break-words">{events.find(e => e.id === a.event_id)?.name || 'Concurso no disponible'} {!a.current && '(vencido)'}</span><select className="border rounded-xl px-3 h-10 text-sm max-w-full min-w-0" value={replacement[a.event_id] || ''} onChange={e => setReplacement({ ...replacement, [a.event_id]: e.target.value })}><option value="">Elegir reemplazo</option>{users.filter(u => u.id !== selected.id && !u.disabled).map(u => <option key={u.id} value={u.id}>{u.email}</option>)}</select><button disabled={busy || !replacement[a.event_id]} type="button" className="border rounded-xl px-3 py-2 text-sm disabled:opacity-50" onClick={() => { if (window.confirm('¿Reemplazar este acceso?')) void run({ action: 'replace', userId: selected.id, newUserId: replacement[a.event_id], eventId: a.event_id }, 'Usuario reemplazado.'); }}>Reemplazar</button></div>)}</div></div>}
    </section>}
  </div>;
};
