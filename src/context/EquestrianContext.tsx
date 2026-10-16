import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EquestrianEvent, DocumentItem, DocumentPage, EventStatus, CompetitionDay, CompetitionClass, CompetitionArena, CompetitionStream } from '../types/equestrian';
import { supabase, isSupabaseConfigured, BUCKET_NAME, getStorageFileUrl } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { documentAssociation, documentLabel, isGeneralDocumentType } from '../utils/documents';
import { DEFAULT_TIME_ZONE, getYouTubeId } from '../utils/schedule';

export interface DocumentPageInput {
  file?: File | Blob;
  dataUrl: string;
  name: string;
  mimeType: string;
}

interface EquestrianContextType {
  events: EquestrianEvent[];
  days: CompetitionDay[];
  arenas: CompetitionArena[];
  streams: CompetitionStream[];
  arenaError: string | null;
  saveArena: (eventId: string, name: string, id?: string) => Promise<void>;
  deleteArena: (id: string) => Promise<void>;
  saveStream: (eventId: string, date: string, arenaId: string, url: string, timeZone: string) => Promise<void>;
  classes: CompetitionClass[];
  dataError: string | null;
  scheduleError: string | null;
  saveClass: (entry: Omit<CompetitionClass, 'id'> & { id?: string }) => Promise<void>;
  saveClasses: (entries: Array<Omit<CompetitionClass, 'id'>>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  reorderClasses: (orderedClasses: Array<{ id: string; order: number }>) => Promise<void>;
  reorderArenas: (orderedArenas: Array<{ id: string; order: number }>) => Promise<void>;
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
  isAuthLoading: boolean;
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
  deleteDocument: (id: string) => Promise<{ success: boolean; storageError?: string }>;
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
  const [arenas, setArenas] = useState<CompetitionArena[]>([]);
  const [streams, setStreams] = useState<CompetitionStream[]>([]);
  const [arenaError, setArenaError] = useState<string | null>(null);
  const [days, setDays] = useState<CompetitionDay[]>([]);
  const [classes, setClasses] = useState<CompetitionClass[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const isCurrentRouteAdmin = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const hash = window.location.hash.toLowerCase();
    return path === '/admin' || hash === '#/admin' || hash === '#admin';
  }, []);

  const [activeView, setActiveViewState] = useState<'public' | 'admin'>(() => {
    if (typeof window === 'undefined') return 'public';
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const hash = window.location.hash.toLowerCase();
    return path === '/admin' || hash === '#/admin' || hash === '#admin' ? 'admin' : 'public';
  });

  const setActiveView = useCallback((view: 'public' | 'admin') => {
    setActiveViewState(view);
    if (typeof window !== 'undefined') {
      if (view === 'admin') {
        const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        const hash = window.location.hash.toLowerCase();
        if (path !== '/admin' && hash !== '#/admin' && hash !== '#admin') {
          window.history.pushState({}, '', '/admin');
        }
      } else {
        const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        const hash = window.location.hash.toLowerCase();
        if (path === '/admin' || hash === '#/admin' || hash === '#admin') {
          window.history.pushState({}, '', '/');
        }
      }
    }
  }, []);

  // Listen to popstate and hashchange events so typing /admin or navigating back/forward updates the view
  useEffect(() => {
    const handleLocationChange = () => {
      const shouldBeAdmin = isCurrentRouteAdmin();
      setActiveViewState(prev => {
        const next = shouldBeAdmin ? 'admin' : 'public';
        return prev !== next ? next : prev;
      });
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [isCurrentRouteAdmin]);

  const [activeViewerDoc, setActiveViewerDoc] = useState<DocumentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
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
    if (!isBackendConnected) {
      setIsAuthLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(data.session);
        if (error) setDataError(error.message);
        setIsAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      requestVersion.current += 1;
      setEvents([]); setDocuments([]); setDays([]); setClasses([]); setArenas([]); setStreams([]);
      setSession(currentSession);
      setIsAuthLoading(false);
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
    setIsLoading(true); setDataError(null); setScheduleError(null); setArenaError(null);
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
          importantInfo: e.important_info || '',
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
          id: entry.id, dayId: entry.day_id, eventId: entry.event_id, arenaId: entry.arena_id || '',
          date: entry.event_date, time: entry.start_time?.slice(0, 5) || '',
          number: entry.number, name: entry.name, description: entry.description || '', order: entry.sort_order,
          isApproximate: Boolean(entry.is_approximate),
          isContinuous: Boolean(entry.is_continuous),
        })));
      }
      const [arenaResponse, streamResponse] = await Promise.all([
        supabase.from('competition_arenas').select('*').order('is_primary', { ascending: false }).order('name'),
        supabase.from('competition_streams').select('*'),
      ]);
      if (version !== requestVersion.current) return;
      if (arenaResponse.error || streamResponse.error) {
        setArenas([]); setStreams([]);
        setArenaError('La gestión de pistas y transmisiones no está disponible. Revisá la migración de pistas.');
      } else {
        setArenas((arenaResponse.data || []).map(arena => ({
          id: arena.id, eventId: arena.event_id, name: arena.name, isPrimary: arena.is_primary,
          order: typeof arena.sort_order === 'number' ? arena.sort_order : (arena.is_primary ? 1 : 2),
        })));
        setStreams((streamResponse.data || []).map(stream => ({
          id: stream.id, eventId: stream.event_id, dayId: stream.day_id,
          arenaId: stream.arena_id, youtubeUrl: stream.youtube_url || '',
        })));
      }
    } catch (error) {
      if (version !== requestVersion.current) return;
      setEvents([]); setDocuments([]); setDays([]); setClasses([]); setArenas([]); setStreams([]);
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
    const fields = {
      name: 'name',
      venue: 'venue',
      startDate: 'start_date',
      endDate: 'end_date',
      imageUrl: 'image_url',
      status: 'status',
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in entry) payload[column] = entry[key as keyof EquestrianEvent] ?? null;
    }
    if ('importantInfo' in entry) {
      const val = entry.importantInfo;
      payload.important_info = val && typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
    }
    if ('city' in entry || 'location' in entry) payload.location = entry.city ?? entry.location ?? '';
    return payload;
  };
  const addEvent: EquestrianContextType['addEvent'] = async entry => {
    requireAdmin();
    const payload = eventPayload(entry);
    let { data, error } = await supabase.from('events').insert(payload).select('id').single();
    if (error && (error.message?.includes('important_info') || error.code === '42703')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.important_info;
      const res = await supabase.from('events').insert(fallbackPayload).select('id').single();
      data = res.data;
      error = res.error;
    }
    if (error) throw error;
    await refreshData();
    return data!.id;
  };
  const updateEvent: EquestrianContextType['updateEvent'] = async (id, entry) => {
    requireAdmin();
    const payload = eventPayload(entry);
    let { error } = await supabase.from('events').update(payload).eq('id', id).select('id').single();
    if (error && (error.message?.includes('important_info') || error.code === '42703')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.important_info;
      const res = await supabase.from('events').update(fallbackPayload).eq('id', id).select('id').single();
      error = res.error;
    }
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
    if (file.size === 0) {
      throw new Error('El archivo seleccionado está vacío.');
    }
    if (file.size > 25 * 1024 * 1024) {
      throw new Error('El archivo supera el tamaño máximo permitido (25 MB).');
    }

    const fileName = (file instanceof File ? file.name : '').toLowerCase();
    const isPdf =
      fileName.endsWith('.pdf') ||
      mimeType.toLowerCase() === 'application/pdf' ||
      mimeType.toLowerCase().includes('pdf') ||
      (file instanceof File && file.type.toLowerCase().includes('pdf'));

    const effectiveMime = isPdf
      ? 'application/pdf'
      : (mimeType || (file instanceof File ? file.type : '') || 'image/jpeg');
    const extension = isPdf ? 'pdf' : (effectiveMime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'jpg');
    const path = `events/${eventId}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
      contentType: effectiveMime,
      upsert: false,
    });
    if (error) {
      throw new Error(`Error al subir archivo a Storage: ${error.message}`);
    }
    return { path, mimeType: effectiveMime };
  };

  const saveDocument = async (entry: DocumentItem, file?: File | Blob, pages?: DocumentPageInput[]) => {
    requireAdmin();
    const association = documentAssociation(entry.type, entry.classId, entry.eventId, classes);
    const computedName = entry.type === 'OTHER'
      ? (entry.name || '').trim()
      : documentLabel({ ...entry, ...association }, classes);

    if (entry.type === 'OTHER' && !computedName) {
      throw new Error('El nombre del documento es obligatorio.');
    }

    entry = { ...entry, ...association, name: computedName };

    let path = entry.storagePath || entry.documentPages?.[0]?.storagePath || null;
    let mimeType = entry.mimeType;
    let pagePayload: { storage_path: string; mime_type: string; sort_order: number }[] | null = null;
    const newlyUploadedPaths: string[] = [];

    try {
      if (pages?.length) {
        pagePayload = [];
        for (const [index, page] of pages.entries()) {
          if (!page.file) throw new Error('Seleccioná un archivo para cada página.');
          const { path: storagePath, mimeType: pageMime } = await uploadFile(entry.eventId, page.file, page.mimeType);
          newlyUploadedPaths.push(storagePath);
          pagePayload.push({ storage_path: storagePath, mime_type: pageMime, sort_order: index + 1 });
        }
        path = pagePayload[0].storage_path;
        mimeType = pagePayload[0].mime_type;
      } else if (file) {
        const isPdf =
          (file instanceof File && file.name.toLowerCase().endsWith('.pdf')) ||
          (entry.mimeType && entry.mimeType.toLowerCase().includes('pdf')) ||
          (file instanceof File && file.type && file.type.toLowerCase().includes('pdf'));
        const targetMime = isPdf
          ? 'application/pdf'
          : (file instanceof File && file.type ? file.type : entry.mimeType || 'application/pdf');
        const uploadResult = await uploadFile(entry.eventId, file, targetMime);
        path = uploadResult.path;
        mimeType = uploadResult.mimeType;
        newlyUploadedPaths.push(path);
        pagePayload = [{ storage_path: path, mime_type: mimeType, sort_order: 1 }];
      }

      if (!path) throw new Error('Seleccioná un archivo.');

      const { error } = await supabase.rpc('equidate_save_document', {
        payload: {
          id: entry.id,
          event_id: entry.eventId,
          name: entry.name,
          type: entry.type,
          event_date: entry.eventDate,
          class_id: entry.classId || null,
          storage_path: path,
          mime_type: mimeType,
          sort_order: entry.order,
        },
        page_payload: pagePayload,
      });

      if (error) {
        throw new Error(`Error al guardar documento en base de datos: ${error.message}`);
      }

      await refreshData();
    } catch (err) {
      // Limpiar ÚNICAMENTE los archivos recién subidos de este intento fallido
      if (newlyUploadedPaths.length > 0) {
        try {
          await supabase.storage.from(BUCKET_NAME).remove(newlyUploadedPaths);
        } catch (cleanupErr) {
          console.warn('Error al limpiar archivos en intento fallido:', cleanupErr);
        }
      }
      throw err;
    }
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
    if ('type' in updates || 'classId' in updates || 'eventDate' in updates || 'name' in updates) {
      const merged = { ...entry, ...updates };
      const association = documentAssociation(merged.type, merged.classId, entry.eventId, classes);
      const computedName = merged.type === 'OTHER'
        ? (merged.name || '').trim()
        : documentLabel({ type: merged.type, classId: association.classId }, classes);

      if (merged.type === 'OTHER' && !computedName) {
        throw new Error('El nombre del documento es obligatorio.');
      }
      updates = { ...updates, ...association, name: computedName };
    }
    const fields = { name: 'name', type: 'type', eventDate: 'event_date', classId: 'class_id', order: 'sort_order' };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) payload[column] = updates[key as keyof DocumentItem] ?? null;
    }
    const { error } = await supabase.from('documents').update(payload).eq('id', id).select('id').single();
    if (error) throw error;
    await refreshData();
  };
  const deleteDocument: EquestrianContextType['deleteDocument'] = async (id: string) => {
    requireAdmin();
    const docToDelete = documents.find(d => d.id === id);
    if (!docToDelete) throw new Error('Documento no encontrado.');

    // 1. Recopilar candidatos de rutas de almacenamiento exclusivas antes de eliminar
    const docPages = docToDelete.documentPages || [];
    const candidatePaths = new Set<string>();
    if (docToDelete.storagePath) candidatePaths.add(docToDelete.storagePath);
    for (const p of docPages) {
      if (p.storagePath) candidatePaths.add(p.storagePath);
    }

    const otherDocs = documents.filter(d => d.id !== id);
    const otherPaths = new Set<string>();
    for (const od of otherDocs) {
      if (od.storagePath) otherPaths.add(od.storagePath);
      for (const op of od.documentPages || []) {
        if (op.storagePath) otherPaths.add(op.storagePath);
      }
    }

    const fallbackExclusivePaths = Array.from(candidatePaths).filter(p => !otherPaths.has(p));

    let deletedStoragePaths: string[] = fallbackExclusivePaths;
    let rpcSuccess = false;

    // 2. Intentar primero con la función RPC atómica equidate_delete_document
    try {
      const { data, error } = await supabase.rpc('equidate_delete_document', { target_id: id });
      if (!error && data && data.success) {
        rpcSuccess = true;
        if (Array.isArray(data.deleted_storage_paths)) {
          deletedStoragePaths = data.deleted_storage_paths;
        }
      } else if (error) {
        if (error.code === '42501' || error.message?.includes('Permisos')) {
          throw new Error('No tenés permisos de administrador para eliminar este documento.');
        }
        console.warn('RPC equidate_delete_document falló o no existe aún, usando borrado directo:', error.message);
      }
    } catch (rpcErr) {
      if ((rpcErr as Error).message?.includes('permisos') || (rpcErr as Error).message?.includes('Permisos')) {
        throw rpcErr;
      }
    }

    if (!rpcSuccess) {
      // Eliminar páginas asociadas primero para respetar integridad
      await supabase.from('document_pages').delete().eq('document_id', id);
      // Eliminar documento de la base de datos
      const { error: deleteError } = await supabase.from('documents').delete().eq('id', id);
      if (deleteError) {
        throw new Error(`Error al eliminar documento: ${deleteError.message}`);
      }
    }

    // 3. Limpiar ÚNICAMENTE archivos de Storage que no estén compartidos con otros documentos
    let storageErrorMsg: string | undefined = undefined;
    if (deletedStoragePaths.length > 0) {
      try {
        const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove(deletedStoragePaths);
        if (storageError) {
          storageErrorMsg = storageError.message;
          console.warn('Documento eliminado de la base de datos, pero falló la limpieza de Storage:', storageError.message);
        }
      } catch (stErr) {
        storageErrorMsg = (stErr as Error).message;
        console.warn('Excepción al limpiar archivos de Storage:', stErr);
      }
    }

    // 4. Cerrar visores si estaba abierto este documento
    if (activeViewerDoc?.id === id) setActiveViewerDoc(null);
    if (viewingDocumentId === id) setViewingDocumentId(null);

    // 5. Refrescar estado completo
    await refreshData();

    return { success: true, storageError: storageErrorMsg };
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
  const saveClass: EquestrianContextType['saveClass'] = async entry => {
    requireAdmin();
    if (arenaError) throw new Error(arenaError);
    const arena = arenas.find(item => item.id === entry.arenaId && item.eventId === entry.eventId);
    if (!arena) throw new Error('Seleccioná una pista del concurso.');
    const dayId = await ensureDay(entry.eventId, entry.date);
    const cleanTime = entry.time ? entry.time.trim().slice(0, 5) : null;
    const basePayload = {
      day_id: dayId,
      arena_id: arena.id,
      event_id: entry.eventId,
      event_date: entry.date,
      start_time: cleanTime || null,
      number: entry.number.trim(),
      name: entry.name.trim(),
      description: entry.description.trim(),
      sort_order: entry.order,
    };
    const payloadWithFlags = {
      ...basePayload,
      is_approximate: Boolean(entry.isApproximate),
      is_continuous: Boolean(entry.isContinuous),
    };
    let response = entry.id
      ? await supabase.from('competition_classes').update(payloadWithFlags).eq('id', entry.id).select('id').single()
      : await supabase.from('competition_classes').insert(payloadWithFlags).select('id').single();

    if (response.error && (response.error.message?.includes('is_approximate') || response.error.message?.includes('is_continuous') || response.error.code === '42703')) {
      response = entry.id
        ? await supabase.from('competition_classes').update(basePayload).eq('id', entry.id).select('id').single()
        : await supabase.from('competition_classes').insert(basePayload).select('id').single();
    }
    if (response.error) throw response.error;
    await refreshData();
  };
  const saveClasses: EquestrianContextType['saveClasses'] = async entries => {
    requireAdmin();
    if (arenaError) throw new Error(arenaError);
    if (!entries.length) return;

    // Validate all items before inserting anything
    for (const entry of entries) {
      if (!entry.number.trim()) throw new Error('Ingresá el número de la prueba.');
      if (!entry.name.trim()) throw new Error('Ingresá el nombre de la prueba.');
      const arena = arenas.find(item => item.id === entry.arenaId && item.eventId === entry.eventId);
      if (!arena) throw new Error('Seleccioná una pista válida para cada prueba.');
    }

    // Ensure all target competition days exist
    const dayIdMap = new Map<string, string>();
    for (const entry of entries) {
      const key = `${entry.eventId}_${entry.date}`;
      if (!dayIdMap.has(key)) {
        const dayId = await ensureDay(entry.eventId, entry.date);
        dayIdMap.set(key, dayId);
      }
    }

    // Build payload array for atomic single-statement batch insert
    const payloadArray = entries.map(entry => {
      const dayId = dayIdMap.get(`${entry.eventId}_${entry.date}`);
      const cleanTime = entry.time ? entry.time.trim().slice(0, 5) : null;
      return {
        day_id: dayId!,
        arena_id: entry.arenaId,
        event_id: entry.eventId,
        event_date: entry.date,
        start_time: cleanTime || null,
        number: entry.number.trim(),
        name: entry.name.trim(),
        description: entry.description.trim(),
        sort_order: entry.order,
        is_approximate: Boolean(entry.isApproximate),
        is_continuous: Boolean(entry.isContinuous),
      };
    });

    let { error } = await supabase.from('competition_classes').insert(payloadArray).select('id');
    if (error && (error.message?.includes('is_approximate') || error.message?.includes('is_continuous') || error.code === '42703')) {
      const fallbackArray = payloadArray.map(({ is_approximate, is_continuous, ...base }) => base);
      const res = await supabase.from('competition_classes').insert(fallbackArray).select('id');
      error = res.error;
    }
    if (error) throw error;
    await refreshData();
  };
  const deleteClass = async (id: string) => {
    requireAdmin();
    const { error } = await supabase.from('competition_classes').delete().eq('id', id).select('id').single();
    if (error) throw error;
    await refreshData();
  };
  const reorderClasses: EquestrianContextType['reorderClasses'] = async orderedClasses => {
    requireAdmin();
    setClasses(prev => prev.map(cls => {
      const match = orderedClasses.find(o => o.id === cls.id);
      return match ? { ...cls, order: match.order } : cls;
    }));

    const updates = orderedClasses.map(item =>
      supabase.from('competition_classes').update({ sort_order: item.order }).eq('id', item.id)
    );
    const results = await Promise.all(updates);
    const failure = results.find(r => r.error);
    if (failure?.error) throw failure.error;
    await refreshData();
  };
  const reorderArenas: EquestrianContextType['reorderArenas'] = async orderedArenas => {
    requireAdmin();
    setArenas(prev => prev.map(a => {
      const match = orderedArenas.find(o => o.id === a.id);
      return match ? { ...a, order: match.order } : a;
    }));

    try {
      const updates = orderedArenas.map(item =>
        supabase.from('competition_arenas').update({ sort_order: item.order }).eq('id', item.id)
      );
      const results = await Promise.all(updates);
      const failure = results.find(r => r.error);
      if (failure?.error && !failure.error.message?.includes('sort_order') && failure.error.code !== '42703') {
        throw failure.error;
      }
    } catch (err: any) {
      if (!err?.message?.includes('sort_order') && err?.code !== '42703') {
        await refreshData();
        throw err;
      }
    }
    await refreshData();
  };

  const ensureDay = async (eventId: string, date: string) => {
    requireAdmin();
    const { error: insertError } = await supabase.from('competition_days')
      .upsert({ event_id: eventId, event_date: date }, { onConflict: 'event_id,event_date', ignoreDuplicates: true });
    if (insertError) throw insertError;
    const { data, error } = await supabase.from('competition_days').select('id').eq('event_id', eventId).eq('event_date', date).single();
    if (error) throw error;
    return data.id as string;
  };
  const saveArena: EquestrianContextType['saveArena'] = async (eventId, name, id) => {
    requireAdmin();
    if (!name.trim()) throw new Error('Ingresá el nombre de la pista.');
    const response = id
      ? await supabase.from('competition_arenas').update({ name: name.trim() }).eq('id', id).eq('event_id', eventId).select('id').single()
      : await supabase.from('competition_arenas').insert({ event_id: eventId, name: name.trim() }).select('id').single();
    if (response.error) throw response.error;
    await refreshData();
  };
  const deleteArena = async (id: string) => {
    requireAdmin();
    const { error } = await supabase.from('competition_arenas').delete().eq('id', id).select('id').single();
    if (error) throw new Error('No se puede eliminar una pista con pruebas o transmisiones asignadas.');
    await refreshData();
  };
  const saveStream: EquestrianContextType['saveStream'] = async (eventId, date, arenaId, url, timeZone) => {
    requireAdmin();
    if (arenaError) throw new Error(arenaError);
    const trimmedUrl = url.trim();
    if (trimmedUrl && !getYouTubeId(trimmedUrl)) throw new Error('Ingresá un enlace válido de un video de YouTube.');
    if (!arenas.some(arena => arena.id === arenaId && arena.eventId === eventId)) throw new Error('Seleccioná una pista del concurso.');
    const dayId = await ensureDay(eventId, date);
    const { error } = await supabase.rpc('equidate_save_stream', {
      target_day: dayId, target_arena: arenaId, video_url: trimmedUrl || null, zone: timeZone || DEFAULT_TIME_ZONE,
    });
    if (error) throw error;
    await refreshData();
  };
  const namedDocuments = documents.map(doc => ({ ...doc, name: documentLabel(doc, classes) }));

  return <EquestrianContext.Provider value={{
    events, documents: namedDocuments, days, classes, arenas, streams, arenaError, saveArena, deleteArena, saveStream, dataError, scheduleError, saveClass, saveClasses, deleteClass, reorderClasses, reorderArenas,
    activeYear, setActiveYear, selectedMonth, setSelectedMonth, selectedEventId, setSelectedEventId,
    activeView, setActiveView, session, isAdmin, loginAdmin, logoutAdmin, isLoading, isAuthLoading,
    isBackendConnected, refreshData, activeViewerDoc, setActiveViewerDoc, viewingDocumentId,
    setViewingDocumentId, addEvent, updateEvent, deleteEvent, toggleEventStatus,
    addDocument, updateDocument, deleteDocument, reorderDocument,
    getDocumentsForEvent: id => namedDocuments.filter(doc => doc.eventId === id).sort((first, second) => first.order - second.order),
    getEventById: id => events.find(event => event.id === id),
    getDocumentById: id => namedDocuments.find(doc => doc.id === id),
  }}>{children}</EquestrianContext.Provider>;
};
export const useEquestrian = () => {
  const context = useContext(EquestrianContext);
  if (!context) throw new Error('EquestrianProvider no disponible.');
  return context;
};
