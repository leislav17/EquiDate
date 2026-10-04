import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EquestrianEvent, DocumentItem, EventStatus } from '../types/equestrian';
import { INITIAL_DEMO_EVENTS, buildInitialDocuments } from '../data/demoData';
import { supabase, isSupabaseConfigured, BUCKET_NAME, getStorageFileUrl } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface EquestrianContextType {
  events: EquestrianEvent[];
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
  seedDemoDataToSupabase: () => Promise<{ success: boolean; message: string }>;

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
    file?: File | Blob
  ) => Promise<void>;
  updateDocument: (id: string, updates: Partial<DocumentItem>, newFile?: File | Blob) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  reorderDocument: (id: string, direction: 'up' | 'down') => Promise<void>;

  // Query helpers
  getDocumentsForEvent: (eventId: string) => DocumentItem[];
  getEventById: (id: string) => EquestrianEvent | undefined;
  getDocumentById: (id: string) => DocumentItem | undefined;
  resetToDemoData: () => void;
}

const STORAGE_KEY_EVENTS = 'salto_ecuestre_events_v2';
const STORAGE_KEY_DOCS = 'salto_ecuestre_docs_v2';

const EquestrianContext = createContext<EquestrianContextType | undefined>(undefined);

// Helper to convert data URL to Blob for Supabase Storage uploads
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/svg+xml';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const EquestrianProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<EquestrianEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EVENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_DEMO_EVENTS;
  });

  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOCS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return buildInitialDocuments();
  });

  const [activeYear, setActiveYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // 9 = October
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'public' | 'admin'>('public');
  const [activeViewerDoc, setActiveViewerDoc] = useState<DocumentItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [session, setSession] = useState<Session | null>(null);

  const isBackendConnected = isSupabaseConfigured();

  // If Supabase is configured, admin status is strictly driven by an active authenticated session
  // If not configured (sandbox demo mode), allow administration without blocking
  const isAdmin = isBackendConnected ? session !== null : true;

  const [viewingDocumentId, setViewingDocumentIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#document-')) {
      return window.location.hash.replace('#document-', '');
    }
    return null;
  });

  const setViewingDocumentId = (id: string | null) => {
    setViewingDocumentIdState(id);
    if (typeof window !== 'undefined') {
      if (id) {
        window.location.hash = `document-${id}`;
      } else {
        if (window.location.hash.startsWith('#document-')) {
          history.pushState('', document.title, window.location.pathname + window.location.search);
        }
      }
    }
  };

  // Hash navigation listener
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.startsWith('#document-')) {
        const id = window.location.hash.replace('#document-', '');
        setViewingDocumentIdState(id);
      } else {
        setViewingDocumentIdState(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!isBackendConnected) return;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, [isBackendConnected]);

  // Fetch data from Supabase
  const refreshData = useCallback(async () => {
    if (!isBackendConnected) return;
    setIsLoading(true);

    try {
      // 1. Fetch Events
      const { data: dbEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

      if (eventsError) throw eventsError;

      // 2. Fetch Documents
      const { data: dbDocuments, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .order('sort_order', { ascending: true });

      if (docsError) throw docsError;

      if (dbEvents && dbEvents.length > 0) {
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

      if (dbDocuments && dbDocuments.length > 0) {
        const mappedDocs: DocumentItem[] = dbDocuments.map((d) => {
          const publicUrl = getStorageFileUrl(d.storage_path);
          return {
            id: String(d.id),
            eventId: String(d.event_id),
            name: d.name,
            type: d.type,
            eventDate: d.event_date || null,
            storagePath: d.storage_path,
            fileUrl: publicUrl,
            pages: [publicUrl],
            mimeType: d.mime_type || 'application/pdf',
            order: d.sort_order || 1,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          };
        });
        setDocuments(mappedDocs);
      }
    } catch (err) {
      console.warn('Error fetching data from Supabase, falling back to local state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isBackendConnected]);

  // Initial fetch on mount
  useEffect(() => {
    if (isBackendConnected) {
      refreshData();
    }
  }, [isBackendConnected, refreshData]);

  // Keep local storage as offline cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(documents));
    } catch {}
  }, [events, documents]);

  // Auth: Login
  const loginAdmin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isBackendConnected) {
      // In demo mode without Supabase env vars, sign in immediately
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setSession(data.session);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión con Supabase' };
    }
  };

  // Auth: Logout
  const logoutAdmin = async () => {
    if (isBackendConnected) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setActiveView('public');
  };

  // Seed demo data directly to Supabase Database & Storage
  const seedDemoDataToSupabase = async (): Promise<{ success: boolean; message: string }> => {
    if (!isBackendConnected) {
      return { success: false, message: 'Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY primero.' };
    }

    try {
      setIsLoading(true);
      // 1. Insert Events
      for (const evt of INITIAL_DEMO_EVENTS) {
        const { error: evtErr } = await supabase.from('events').upsert({
          id: evt.id,
          name: evt.name,
          venue: evt.venue,
          location: evt.city || evt.location || 'Buenos Aires',
          start_date: evt.startDate,
          end_date: evt.endDate,
          image_url: evt.imageUrl || null,
          status: evt.status,
          updated_at: new Date().toISOString(),
        });
        if (evtErr) console.warn('Seed event error:', evtErr);
      }

      // 2. Upload initial documents to Storage and insert into documents table
      const initialDocs = buildInitialDocuments();
      for (const doc of initialDocs) {
        let storagePath = `events/${doc.eventId}/${doc.id}.svg`;

        if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
          const blob = dataUrlToBlob(doc.fileUrl);
          await supabase.storage.from(BUCKET_NAME).upload(storagePath, blob, {
            contentType: 'image/svg+xml',
            upsert: true,
          });
        }

        const { error: docErr } = await supabase.from('documents').upsert({
          id: doc.id,
          event_id: doc.eventId,
          name: doc.name,
          type: doc.type,
          event_date: doc.eventDate,
          storage_path: storagePath,
          mime_type: 'image/svg+xml',
          sort_order: doc.order,
          updated_at: new Date().toISOString(),
        });
        if (docErr) console.warn('Seed doc error:', docErr);
      }

      await refreshData();
      return { success: true, message: '¡Datos y documentos demo sincronizados exitosamente a Supabase!' };
    } catch (err: any) {
      return { success: false, message: `Error al sincronizar: ${err?.message || err}` };
    } finally {
      setIsLoading(false);
    }
  };

  // CRUD Event: Add
  const addEvent = async (
    eventData: Omit<EquestrianEvent, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const tempId = `evt-${Date.now()}`;
    const now = new Date().toISOString();

    const newEvent: EquestrianEvent = {
      ...eventData,
      id: tempId,
      location: eventData.location || eventData.city || '',
      city: eventData.city || eventData.location || '',
      createdAt: now,
      updatedAt: now,
    };

    setEvents((prev) => [newEvent, ...prev]);

    if (isBackendConnected) {
      try {
        const { data, error } = await supabase
          .from('events')
          .insert({
            name: eventData.name,
            venue: eventData.venue,
            location: eventData.location || eventData.city || '',
            start_date: eventData.startDate,
            end_date: eventData.endDate,
            image_url: eventData.imageUrl || null,
            status: eventData.status,
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data?.id) {
          const actualId = String(data.id);
          setEvents((prev) =>
            prev.map((e) => (e.id === tempId ? { ...e, id: actualId } : e))
          );
          return actualId;
        }
      } catch (err) {
        console.error('Error inserting event into Supabase:', err);
      }
    }

    return tempId;
  };

  // CRUD Event: Update
  const updateEvent = async (id: string, updates: Partial<EquestrianEvent>) => {
    const now = new Date().toISOString();
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: now } : e))
    );

    if (isBackendConnected) {
      try {
        const payload: any = { updated_at: now };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.venue !== undefined) payload.venue = updates.venue;
        if (updates.location !== undefined || updates.city !== undefined)
          payload.location = updates.location || updates.city;
        if (updates.startDate !== undefined) payload.start_date = updates.startDate;
        if (updates.endDate !== undefined) payload.end_date = updates.endDate;
        if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
        if (updates.status !== undefined) payload.status = updates.status;

        const { error } = await supabase.from('events').update(payload).eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Error updating event in Supabase:', err);
      }
    }
  };

  // CRUD Event: Delete
  const deleteEvent = async (id: string) => {
    // Collect associated documents to clean up Storage files
    const eventDocs = documents.filter((d) => d.eventId === id);

    setEvents((prev) => prev.filter((e) => e.id !== id));
    setDocuments((prev) => prev.filter((d) => d.eventId !== id));
    if (selectedEventId === id) setSelectedEventId(null);

    if (isBackendConnected) {
      try {
        // Delete files from storage
        const pathsToDelete = eventDocs
          .map((d) => d.storagePath)
          .filter((p): p is string => Boolean(p));

        if (pathsToDelete.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(pathsToDelete);
        }

        // Delete from events table (CASCADE will delete documents records in DB)
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Error deleting event from Supabase:', err);
      }
    }
  };

  // CRUD Event: Toggle Status
  const toggleEventStatus = async (id: string) => {
    const target = events.find((e) => e.id === id);
    if (!target) return;
    const nextStatus: EventStatus = target.status === 'published' ? 'draft' : 'published';
    await updateEvent(id, { status: nextStatus });
  };

  // CRUD Document: Add
  const addDocument = async (
    docData: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'order'>,
    file?: File | Blob
  ) => {
    const tempId = `doc-${Date.now()}`;
    const now = new Date().toISOString();

    const existingInGroup = documents.filter(
      (d) => d.eventId === docData.eventId && d.type === docData.type && d.eventDate === docData.eventDate
    );
    const maxOrder = existingInGroup.reduce((max, d) => Math.max(max, d.order || 0), 0);
    const sortOrder = maxOrder + 1;

    let storagePath = docData.storagePath || '';
    let finalFileUrl = docData.fileUrl;

    if (isBackendConnected) {
      try {
        // Generate organized storage path: events/{eventId}/{timestamp}_{name}
        const cleanName = docData.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const extension = docData.mimeType?.includes('pdf')
          ? 'pdf'
          : docData.mimeType?.includes('svg')
          ? 'svg'
          : 'png';
        storagePath = `events/${docData.eventId}/${Date.now()}_${cleanName}.${extension}`;

        let uploadBlob: Blob | null = file || null;
        if (!uploadBlob && docData.fileUrl?.startsWith('data:')) {
          uploadBlob = dataUrlToBlob(docData.fileUrl);
        }

        if (uploadBlob) {
          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, uploadBlob, {
              contentType: docData.mimeType || 'application/pdf',
              upsert: true,
            });

          if (uploadError) throw uploadError;
          finalFileUrl = getStorageFileUrl(storagePath);
        }

        // Insert record in documents table
        const { data: dbDoc, error: insertError } = await supabase
          .from('documents')
          .insert({
            event_id: docData.eventId,
            name: docData.name,
            type: docData.type,
            event_date: docData.eventDate,
            storage_path: storagePath,
            mime_type: docData.mimeType,
            sort_order: sortOrder,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        const newDoc: DocumentItem = {
          ...docData,
          id: dbDoc?.id ? String(dbDoc.id) : tempId,
          order: sortOrder,
          storagePath,
          fileUrl: finalFileUrl,
          pages: [finalFileUrl],
          createdAt: now,
          updatedAt: now,
        };

        setDocuments((prev) => [...prev, newDoc]);
        return;
      } catch (err) {
        console.error('Error adding document to Supabase:', err);
      }
    }

    // Fallback local update
    const fallbackDoc: DocumentItem = {
      ...docData,
      id: tempId,
      order: sortOrder,
      storagePath,
      fileUrl: finalFileUrl,
      pages: [finalFileUrl],
      createdAt: now,
      updatedAt: now,
    };
    setDocuments((prev) => [...prev, fallbackDoc]);
  };

  // CRUD Document: Update
  const updateDocument = async (id: string, updates: Partial<DocumentItem>, newFile?: File | Blob) => {
    const now = new Date().toISOString();
    let updatedStoragePath = updates.storagePath;
    let updatedFileUrl = updates.fileUrl;

    if (isBackendConnected && newFile) {
      try {
        const target = documents.find((d) => d.id === id);
        if (target) {
          const extension = newFile.type?.includes('pdf') ? 'pdf' : 'png';
          updatedStoragePath = `events/${target.eventId}/${Date.now()}_updated.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(updatedStoragePath, newFile, {
              contentType: newFile.type,
              upsert: true,
            });

          if (!uploadError) {
            updatedFileUrl = getStorageFileUrl(updatedStoragePath);
          }
        }
      } catch (err) {
        console.warn('Storage upload error during document update:', err);
      }
    }

    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          return {
            ...d,
            ...updates,
            storagePath: updatedStoragePath || d.storagePath,
            fileUrl: updatedFileUrl || d.fileUrl,
            pages: updatedFileUrl ? [updatedFileUrl] : d.pages,
            updatedAt: now,
          };
        }
        return d;
      })
    );

    if (isBackendConnected) {
      try {
        const payload: any = { updated_at: now };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.eventDate !== undefined) payload.event_date = updates.eventDate;
        if (updates.order !== undefined) payload.sort_order = updates.order;
        if (updatedStoragePath) payload.storage_path = updatedStoragePath;
        if (updates.mimeType) payload.mime_type = updates.mimeType;

        await supabase.from('documents').update(payload).eq('id', id);
      } catch (err) {
        console.error('Error updating document in Supabase:', err);
      }
    }
  };

  // CRUD Document: Delete
  const deleteDocument = async (id: string) => {
    const target = documents.find((d) => d.id === id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeViewerDoc?.id === id) setActiveViewerDoc(null);

    if (isBackendConnected && target) {
      try {
        if (target.storagePath) {
          await supabase.storage.from(BUCKET_NAME).remove([target.storagePath]);
        }
        await supabase.from('documents').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting document from Supabase:', err);
      }
    }
  };

  // Reorder Document
  const reorderDocument = async (id: string, direction: 'up' | 'down') => {
    const targetDoc = documents.find((d) => d.id === id);
    if (!targetDoc) return;

    const siblings = documents
      .filter(
        (d) =>
          d.eventId === targetDoc.eventId &&
          d.type === targetDoc.type &&
          d.eventDate === targetDoc.eventDate
      )
      .sort((a, b) => a.order - b.order);

    const idx = siblings.findIndex((d) => d.id === id);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === siblings.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const currentOrder = siblings[idx].order;
    const swapOrder = siblings[swapIdx].order;

    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id === siblings[idx].id) return { ...d, order: swapOrder };
        if (d.id === siblings[swapIdx].id) return { ...d, order: currentOrder };
        return d;
      })
    );

    if (isBackendConnected) {
      try {
        await supabase
          .from('documents')
          .update({ sort_order: swapOrder })
          .eq('id', siblings[idx].id);

        await supabase
          .from('documents')
          .update({ sort_order: currentOrder })
          .eq('id', siblings[swapIdx].id);
      } catch (err) {
        console.warn('Error saving document reorder to Supabase:', err);
      }
    }
  };

  const getDocumentsForEvent = (eventId: string) => {
    return documents
      .filter((d) => String(d.eventId) === String(eventId))
      .sort((a, b) => a.order - b.order);
  };

  const getEventById = (id: string) => {
    return events.find((e) => String(e.id) === String(id));
  };

  const getDocumentById = (id: string) => {
    return documents.find((d) => String(d.id) === String(id));
  };

  const resetToDemoData = () => {
    setEvents(INITIAL_DEMO_EVENTS);
    setDocuments(buildInitialDocuments());
    setActiveYear(2026);
    setSelectedMonth(9);
    setSelectedEventId(null);
    setActiveViewerDoc(null);
    setViewingDocumentId(null);
    try {
      localStorage.removeItem(STORAGE_KEY_EVENTS);
      localStorage.removeItem(STORAGE_KEY_DOCS);
    } catch {}
  };

  return (
    <EquestrianContext.Provider
      value={{
        events,
        documents,
        activeYear,
        setActiveYear,
        selectedMonth,
        setSelectedMonth,
        selectedEventId,
        setSelectedEventId,
        activeView,
        setActiveView,
        session,
        isAdmin,
        loginAdmin,
        logoutAdmin,
        isLoading,
        isBackendConnected,
        refreshData,
        seedDemoDataToSupabase,
        activeViewerDoc,
        setActiveViewerDoc,
        viewingDocumentId,
        setViewingDocumentId,
        addEvent,
        updateEvent,
        deleteEvent,
        toggleEventStatus,
        addDocument,
        updateDocument,
        deleteDocument,
        reorderDocument,
        getDocumentsForEvent,
        getEventById,
        getDocumentById,
        resetToDemoData,
      }}
    >
      {children}
    </EquestrianContext.Provider>
  );
};

export const useEquestrian = () => {
  const context = useContext(EquestrianContext);
  if (!context) {
    throw new Error('useEquestrian must be used within an EquestrianProvider');
  }
  return context;
};
