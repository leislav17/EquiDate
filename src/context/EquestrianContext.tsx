import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EquestrianEvent, DocumentItem, DocumentPage, EventStatus, CompetitionDay, CompetitionClass } from '../types/equestrian';
import { supabase, isSupabaseConfigured, BUCKET_NAME, getStorageFileUrl } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getYouTubeId } from '../utils/schedule';

export interface DocumentPageInput {
  file?: File | Blob;
  dataUrl: string;
  name: string;
  mimeType: string;
}

interface EquestrianContextType {
  events: EquestrianEvent[];
  days: CompetitionDay[];
  classes: CompetitionClass[];
  dataError: string | null;
  scheduleError: string | null;
  saveDay: (day: Omit<CompetitionDay, 'id'>) => Promise<void>;
  saveClass: (entry: Omit<CompetitionClass, 'id'> & { id?: string }) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  documents: DocumentItem[];
  activeYear: number;
  setActiveYear: (year: number) => void;
  selectedMonth: number; // -1 for all months, 0 to 11 for specific month
  setSelectedMonth: (month: number) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  activeView: 'public' | 'admin';
  setActiveView: (view: 'public' | 'admin') => void;

  // Supabase Auth state
  session: Session | null;
  isAdmin: boolean;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;

  // Loading & sync state
  isLoading: boolean;
  isBackendConnected: boolean;
  refreshData: () => Promise<void>;

  // Viewer state
  activeViewerDoc: DocumentItem | null;
  setActiveViewerDoc: (doc: DocumentItem | null) => void;
  viewingDocumentId: string | null;
  setViewingDocumentId: (id: string | null) => void;

  // Event actions
  addEvent: (eventData: Omit<EquestrianEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateEvent: (id: string, updates: Partial<EquestrianEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  toggleEventStatus: (id: string) => Promise<void>;

  // Document actions
  addDocument: (
    docData: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'order'>,
    file?: File | Blob,
    pages?: DocumentPageInput[]
  ) => Promise<void>;
  updateDocument: (
    id: string,
    updates: Partial<DocumentItem>,
    newFile?: File | Blob,
    newPages?: DocumentPageInput[]
  ) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  reorderDocument: (id: string, direction: 'up' | 'down') => Promise<void>;

  // Query helpers
  getDocumentsForEvent: (eventId: string) => DocumentItem[];
  getEventById: (id: string) => EquestrianEvent | undefined;
  getDocumentById: (id: string) => DocumentItem | undefined;
}


const EquestrianContext = createContext<EquestrianContextType | undefined>(undefined);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String((error as { message?: string })?.message || 'No se pudo completar la operación.');

export const EquestrianProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<EquestrianEvent[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [days, setDays] = useState<CompetitionDay[]>([]);
  const [classes, setClasses] = useState<CompetitionClass[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'public' | 'admin'>('public');
  const [activeViewerDoc, setActiveViewerDoc] = useState<DocumentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authRevision, setAuthRevision] = useState(0);
  const requestVersion = useRef(0);
  const previousDocumentRoute = useRef('');
  const isBackendConnected = isSupabaseConfigured();
  const isAdmin = isBackendConnected && session?.user.app_metadata?.equidate_admin === true;
  const [viewingDocumentId, setViewingDocumentIdState] = useState<string | null>(
    () => window.location.hash.startsWith('#document-') ? window.location.hash.slice(10) : null
  );
  const setViewingDocumentId = (id: string | null) => {
    setViewingDocumentIdState(id);
    if (id) {
      if (!window.location.hash.startsWith('#document-')) previousDocumentRoute.current = window.location.hash;
      window.location.hash = 'document-' + id;
    } else if (window.location.hash.startsWith('#document-')) window.location.hash = previousDocumentRoute.current;
  };
  useEffect(() => {
    const onHash = () => setViewingDocumentIdState(window.location.hash.startsWith('#document-') ? window.location.hash.slice(10) : null);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!isBackendConnected) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(data.session);
        if (error) setDataError(error.message);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      requestVersion.current += 1;
      setEvents([]); setDocuments([]); setDays([]); setClasses([]);
      setSession(currentSession);
      setAuthRevision(version => version + 1);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [isBackendConnected]);
  const refreshData = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!isBackendConnected) {
      setDataError('El servicio de concursos aún no está configurado.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true); setDataError(null); setScheduleError(null);
    try {
      const [eventResponse, documentResponse, pageResponse] = await Promise.all([
        supabase.from('events').select('*').order('start_date'),
        supabase.from('documents').select('*').order('sort_order'),
        supabase.from('document_pages').select('*').order('sort_order'),
      ]);
      if (version !== requestVersion.current) return;
      for (const response of [eventResponse, documentResponse, pageResponse]) {
        if (response.error) throw response.error;
      }
      const dbEvents = eventResponse.data || [];
      const dbDocuments = documentResponse.data || [];
      const dbPages = pageResponse.data || [];
      if (dbEvents) {
        const mappedEvents: EquestrianEvent[] = dbEvents.map((e) => ({
          id: String(e.id),
          name: e.name,
          venue: e.venue,
          location: e.location || '',
          city: e.location || '',
          imageUrl: e.image_url || undefined,
          startDate: e.start_date,
          endDate: e.end_date,
          status: e.status as EventStatus,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        }));
        setEvents(mappedEvents);
      }

      if (dbDocuments) {
        const mappedDocs: DocumentItem[] = dbDocuments.map((d) => {
          const publicUrl = d.storage_path ? getStorageFileUrl(d.storage_path) : '';
          const isPdf =
            (d.mime_type && d.mime_type.toLowerCase() === 'application/pdf') ||
            (d.storage_path && d.storage_path.toLowerCase().endsWith('.pdf')) ||
            (publicUrl && publicUrl.toLowerCase().includes('.pdf'));

          const mimeType = d.mime_type || (isPdf ? 'application/pdf' : 'image/jpeg');

          // Check if this document has entries in document_pages
          const pagesForDoc = dbPages
            .filter((p) => String(p.document_id) === String(d.id))
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

          let structuredPages: DocumentPage[] | undefined = undefined;
          let resolvedPageUrls: string[] | undefined = undefined;
          let finalFileUrl = publicUrl;

          if (pagesForDoc.length > 0) {
            structuredPages = pagesForDoc.map((p) => {
              const pageUrl = getStorageFileUrl(p.storage_path);
              return {
                id: String(p.id),
                documentId: String(p.document_id),
                storagePath: p.storage_path,
                fileUrl: pageUrl,
                mimeType: p.mime_type,
                sortOrder: p.sort_order || 1,
                createdAt: p.created_at,
              };
            });
            resolvedPageUrls = structuredPages.map((p) => p.fileUrl);
            finalFileUrl = resolvedPageUrls[0] || publicUrl;
          } else if (!isPdf && publicUrl) {
            resolvedPageUrls = [publicUrl];
          }

          return {
            id: String(d.id),
            eventId: String(d.event_id),
            classId: d.class_id || null,
            name: d.name,
            type: d.type,
            eventDate: d.event_date || null,
            storagePath: d.storage_path,
            fileUrl: finalFileUrl,
            pages: isPdf ? undefined : resolvedPageUrls,
            documentPages: structuredPages,
            mimeType,
            order: d.sort_order || 1,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          };
        });
        setDocuments(mappedDocs);
      }

      const [dayResponse, classResponse] = await Promise.all([
        supabase.from('competition_days').select('*').order('event_date'),
        supabase.from('competition_classes').select('*').order('sort_order'),
      ]);
      if (version !== requestVersion.current) return;
      if (dayResponse.error || classResponse.error) {
        setDays([]); setClasses([]);
        setScheduleError('El cronograma no está disponible. Los documentos existentes siguen disponibles.');
      } else {
        setDays((dayResponse.data || []).map(day => ({
          id: day.id, eventId: day.event_id, date: day.event_date,
          youtubeUrl: day.youtube_url || '', timeZone: day.time_zone,
        })));
        setClasses((classResponse.data || []).map(entry => ({
          id: entry.id, dayId: entry.day_id, eventId: entry.event_id,
          date: entry.event_date, time: entry.start_time?.slice(0, 5) || '',
          number: entry.number, name: entry.name, description: entry.description || '', order: entry.sort_order,
        })));
      }
    } catch (error) {
      if (version !== requestVersion.current) return;
      setEvents([]); setDocuments([]); setDays([]); setClasses([]);
      setDataError('No pudimos cargar los concursos. ' + errorMessage(error));
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [isBackendConnected]);
  useEffect(() => { void refreshData(); }, [refreshData, session, authRevision]);
  const requireAdmin = () => {
    if (!isBackendConnected || !isAdmin) throw new Error('Necesitás una sesión de administrador válida.');
  };
  const loginAdmin = async (email: string, password: string) => {
    if (!isBackendConnected) return { success: false, error: 'Supabase no está configurado.' };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user?.app_metadata?.equidate_admin !== true) {
        await supabase.auth.signOut();
        return { success: false, error: 'Esta cuenta no tiene permisos de administración.' };
      }
      setSession(data.session);
      return { success: true };
    } catch (error) { return { success: false, error: errorMessage(error) }; }
  };
  const logoutAdmin = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null); setActiveView('public');
  };
  const eventPayload = (entry: Partial<EquestrianEvent>) => {
    const payload: Record<string, unknown> = {};
    const fields = { name: 'name', venue: 'venue', startDate: 'start_date', endDate: 'end_date', imageUrl: 'image_url', status: 'status' };
    for (const [key, column] of Object.entries(fields)) {
      if (key in entry) payload[column] = entry[key as keyof EquestrianEvent] ?? null;
    }
    if ('city' in entry || 'location' in entry) payload.location = entry.city ?? entry.location ?? '';
    return payload;
  };
  const addEvent: EquestrianContextType['addEvent'] = async entry => {
    requireAdmin();
    const { data, error } = await supabase.from('events').insert(eventPayload(entry)).select('id').single();
    if (error) throw error;
    await refreshData();
    return data.id;
  };
  const updateEvent: EquestrianContextType['updateEvent'] = async (id, entry) => {
    requireAdmin();
    const { error } = await supabase.from('events').update(eventPayload(entry)).eq('id', id).select('id').single();
    if (error) throw error;
    await refreshData();
  };
  const deleteEvent = async (id: string) => {
    requireAdmin();
    const { error } = await supabase.from('events').delete().eq('id', id).select('id').single();
    if (error) throw error;
    if (selectedEventId === id) setSelectedEventId(null);
    await refreshData();
  };
  const toggleEventStatus = async (id: string) => {
    const entry = events.find(event => event.id === id);
    if (entry) await updateEvent(id, { status: entry.status === 'published' ? 'draft' : 'published' });
  };

  const uploadFile = async (eventId: string, file: File | Blob, mimeType: string) => {
    const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin';
    const path = 'events/' + eventId + '/' + crypto.randomUUID() + '.' + extension;
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, file, { contentType: mimeType, upsert: false });
    if (error) throw error;
    return path;
  };
  const saveDocument = async (entry: DocumentItem, file?: File | Blob, pages?: DocumentPageInput[]) => {
    requireAdmin();
    let path = entry.storagePath || entry.documentPages?.[0]?.storagePath || null;
    let mimeType = entry.mimeType;
    let pagePayload: { storage_path: string; mime_type: string; sort_order: number }[] | null = null;
    if (pages?.length) {
      pagePayload = [];
      for (const [index, page] of pages.entries()) {
        if (!page.file) throw new Error('Seleccioná un archivo para cada página.');
        const storagePath = await uploadFile(entry.eventId, page.file, page.mimeType);
        pagePayload.push({ storage_path: storagePath, mime_type: page.mimeType, sort_order: index + 1 });
      }
      path = pagePayload[0].storage_path; mimeType = pagePayload[0].mime_type;
    } else if (file) {
      mimeType = file.type || entry.mimeType;
      path = await uploadFile(entry.eventId, file, mimeType);
      pagePayload = [];
    }
    if (!path) throw new Error('Seleccioná un archivo.');
    const { error } = await supabase.rpc('equidate_save_document', {
      payload: { id: entry.id, event_id: entry.eventId, name: entry.name,
        type: entry.type, event_date: entry.eventDate, class_id: entry.classId || null,
        storage_path: path, mime_type: mimeType, sort_order: entry.order },
      page_payload: pagePayload,
    });
    if (error) throw error;
    await refreshData();
  };
  const addDocument: EquestrianContextType['addDocument'] = async (entry, file, pages) => {
    const order = Math.max(0, ...documents.filter(doc => doc.eventId === entry.eventId).map(doc => doc.order)) + 1;
    await saveDocument({ ...entry, id: crypto.randomUUID(), order, createdAt: '', updatedAt: '' }, file, pages);
  };
  const updateDocument: EquestrianContextType['updateDocument'] = async (id, updates, file, pages) => {
    requireAdmin();
    const entry = documents.find(doc => doc.id === id);
    if (!entry) throw new Error('Documento no encontrado.');
    if (file || pages) {
      await saveDocument({ ...entry, ...updates }, file, pages);
      return;
    }
    const payload: Record<string, unknown> = {};
    const fields = { name: 'name', type: 'type', eventDate: 'event_date', classId: 'class_id', order: 'sort_order' };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) payload[column] = updates[key as keyof DocumentItem] ?? null;
    }
    const { error } = await supabase.from('documents').update(payload).eq('id', id).select('id').single();
    if (error) throw error;
    await refreshData();
  };
  const deleteDocument = async (id: string) => {
    requireAdmin();
    const { error } = await supabase.from('documents').delete().eq('id', id).select('id').single();
    if (error) throw error;
    if (activeViewerDoc?.id === id) setActiveViewerDoc(null);
    if (viewingDocumentId === id) setViewingDocumentId(null);
    await refreshData();
  };
  const reorderDocument: EquestrianContextType['reorderDocument'] = async (id, direction) => {
    requireAdmin();
    const target = documents.find(doc => doc.id === id);
    if (!target) return;
    const siblings = documents.filter(doc => doc.eventId === target.eventId && doc.type === target.type && doc.eventDate === target.eventDate).sort((first, second) => first.order - second.order);
    const index = siblings.findIndex(doc => doc.id === id);
    const other = siblings[index + (direction === 'up' ? -1 : 1)];
    if (!other) return;
    const { error } = await supabase.rpc('equidate_swap_documents', { first_id: id, second_id: other.id });
    if (error) throw error;
    await refreshData();
  };
  const saveDay: EquestrianContextType['saveDay'] = async day => {
    requireAdmin();
    if (day.youtubeUrl && !getYouTubeId(day.youtubeUrl)) throw new Error('Ingresá una URL válida de un video de YouTube.');
    const { error } = await supabase.from('competition_days').upsert({
      event_id: day.eventId, event_date: day.date, youtube_url: day.youtubeUrl || null, time_zone: day.timeZone,
    }, { onConflict: 'event_id,event_date' }).select('id').single();
    if (error) throw error;
    await refreshData();
  };
  const saveClass: EquestrianContextType['saveClass'] = async entry => {
    requireAdmin();
    const payload = { day_id: entry.dayId, event_id: entry.eventId, event_date: entry.date,
      start_time: entry.time || null, number: entry.number.trim(), name: entry.name.trim(),
      description: entry.description.trim(), sort_order: entry.order };
    const response = entry.id
      ? await supabase.from('competition_classes').update(payload).eq('id', entry.id).select('id').single()
      : await supabase.from('competition_classes').insert(payload).select('id').single();
    if (response.error) throw response.error;
    await refreshData();
  };
  const deleteClass = async (id: string) => {
    requireAdmin();
    const { error } = await supabase.from('competition_classes').delete().eq('id', id).select('id').single();
    if (error) throw error;
    await refreshData();
  };
  return <EquestrianContext.Provider value={{
    events, documents, days, classes, dataError, scheduleError, saveDay, saveClass, deleteClass,
    activeYear, setActiveYear, selectedMonth, setSelectedMonth, selectedEventId, setSelectedEventId,
    activeView, setActiveView, session, isAdmin, loginAdmin, logoutAdmin, isLoading,
    isBackendConnected, refreshData, activeViewerDoc, setActiveViewerDoc, viewingDocumentId,
    setViewingDocumentId, addEvent, updateEvent, deleteEvent, toggleEventStatus,
    addDocument, updateDocument, deleteDocument, reorderDocument,
    getDocumentsForEvent: id => documents.filter(doc => doc.eventId === id).sort((first, second) => first.order - second.order),
    getEventById: id => events.find(event => event.id === id),
    getDocumentById: id => documents.find(doc => doc.id === id),
  }}>{children}</EquestrianContext.Provider>;
};
export const useEquestrian = () => {
  const context = useContext(EquestrianContext);
  if (!context) throw new Error('EquestrianProvider no disponible.');
  return context;
};
