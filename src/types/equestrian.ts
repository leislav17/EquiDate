export type EventStatus = 'draft' | 'published';

export type EventTemporalStatus = 'ACTUAL' | 'PROXIMO' | 'FINALIZADO';

export type DocumentType = 'PROGRAM' | 'START_LIST' | 'RESULT';

export interface DocumentPage {
  id: string;
  documentId: string;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
  sortOrder: number;
  createdAt?: string;
}

export interface EquestrianEvent {
  id: string;
  name: string;
  venue: string;
  location?: string;  // Database column location
  city?: string;      // Alias for location
  imageUrl?: string;  // Database column image_url
  startDate: string;  // YYYY-MM-DD (Database column start_date)
  endDate: string;    // YYYY-MM-DD (Database column end_date)
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  classId?: string | null;
  id: string;
  eventId: string;          // Database column event_id
  name: string;
  type: DocumentType;
  eventDate: string | null; // Database column event_date
  storagePath?: string;     // Database column storage_path
  fileUrl: string;          // Resolved public URL or Data URI
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | string;
  pages?: string[];         // URLs or data URIs for multi-page documents (resolved URLs in order)
  documentPages?: DocumentPage[]; // Structured pages
  order: number;            // Database column sort_order
  createdAt: string;
  updatedAt: string;
  // Optional metadata useful for preview / structured rendering
  testNumber?: string;      // e.g. "Prueba 3"
  height?: string;          // e.g. "1.20 m"
  category?: string;        // e.g. "Segunda y Primera"
}

export interface DaySchedule {
  date: string;          // YYYY-MM-DD
  dayOfWeek: string;     // e.g. "VIERNES"
  dayNumber: number;     // e.g. 9
  monthName: string;     // e.g. "OCTUBRE"
  fullFormatted: string; // e.g. "VIERNES 9 OCTUBRE"
  startLists: DocumentItem[];
  results: DocumentItem[];
}

export interface CompetitionDay {
  id: string;
  eventId: string;
  date: string;
  youtubeUrl: string;
  timeZone: string;
}

export interface CompetitionClass {
  arenaId: string;
  id: string;
  dayId: string;
  eventId: string;
  date: string;
  time: string;
  number: string;
  name: string;
  description: string;
  order: number;
}

export interface CompetitionArena {
  id: string;
  eventId: string;
  name: string;
  isPrimary: boolean;
}

export interface CompetitionStream {
  id: string;
  eventId: string;
  dayId: string;
  arenaId: string;
  youtubeUrl: string;
}
