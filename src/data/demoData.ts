import { EquestrianEvent, DocumentItem } from '../types/equestrian';
import {
  createAnteprogramaDoc,
  createStartListDoc,
  createResultDoc,
  createCoursePlanDoc
} from './sampleDocuments';

export const INITIAL_DEMO_EVENTS: EquestrianEvent[] = [
  {
    id: 'evt-1',
    name: 'Torneo Iniciación de Salto',
    venue: 'Club Hípico del Norte',
    city: 'Buenos Aires',
    imageUrl: '/src/assets/images/hero_jumping_arena_1791133972260.jpg',
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    status: 'published',
    createdAt: '2026-09-15T10:00:00Z',
    updatedAt: '2026-09-15T10:00:00Z',
  },
  {
    id: 'evt-2',
    name: 'Copa Ciudad Ecuestre',
    venue: 'San Jorge Village Hípico',
    city: 'Los Polvorines, Buenos Aires',
    startDate: '2026-10-09',
    endDate: '2026-10-10',
    status: 'published',
    createdAt: '2026-09-18T11:00:00Z',
    updatedAt: '2026-10-02T14:30:00Z',
  },
  {
    id: 'evt-3',
    name: 'Gran Premio Primavera FEI',
    venue: 'Club Alemán de Equitación',
    city: 'Buenos Aires',
    imageUrl: '/src/assets/images/club_hipico_jumping_1791133983367.jpg',
    startDate: '2026-10-16',
    endDate: '2026-10-18',
    status: 'published',
    createdAt: '2026-09-20T09:00:00Z',
    updatedAt: '2026-10-04T12:00:00Z',
  },
  {
    id: 'evt-4',
    name: 'Concurso Abierto de Salto Primavera',
    venue: 'Club Hípico Argentino',
    city: 'Nuñez, Buenos Aires',
    startDate: '2026-10-17',
    endDate: '2026-10-18',
    status: 'published',
    createdAt: '2026-09-22T14:00:00Z',
    updatedAt: '2026-10-03T16:00:00Z',
  },
  {
    id: 'evt-5',
    name: 'Copa Nacional de Campeones',
    venue: 'Hípico San Isidro',
    city: 'San Isidro, Buenos Aires',
    startDate: '2026-10-23',
    endDate: '2026-10-25',
    status: 'published',
    createdAt: '2026-09-25T16:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  }
];

// Reusable starter riders for realistic jumping lists
const SAMPLE_STARTERS_A = [
  { order: 1, rider: 'Martín Dopazo', horse: 'Pegasus Z', club: 'Club Hípico Argentino' },
  { order: 2, rider: 'Justo Albarracín', horse: 'Cornet Blue', club: 'Club Alemán de Equitación' },
  { order: 3, rider: 'Victoria Morosini', horse: 'Chacco Pearl', club: 'San Jorge Village' },
  { order: 4, rider: 'Federico Sztyrle', horse: 'Diamant Boy', club: 'Hípico San Isidro' },
  { order: 5, rider: 'Camila Rossi', horse: 'Baloubet Star', club: 'Jockey Club Rosario' },
  { order: 6, rider: 'Gonzalo Bosch', horse: 'Quick Silver', club: 'Club de Campo La Horqueta' },
  { order: 7, rider: 'Lucía Santillán', horse: 'Kashmir Spirit', club: 'Club Hípico del Norte' },
  { order: 8, rider: 'Esteban Brena', horse: 'Vigo d’Arsouilles', club: 'Club Alemán de Equitación' },
];

const SAMPLE_STARTERS_GP = [
  { order: 1, rider: 'José María Larocca', horse: 'Finn Lente', club: 'Club Hípico Argentino' },
  { order: 2, rider: 'Damián Ancic', horse: 'Santa Rosa Valery', club: 'Club Alemán de Equitación' },
  { order: 3, rider: 'Matías Albarracín', horse: 'Cannavaro 9', club: 'San Jorge Village' },
  { order: 4, rider: 'Fabián Sejzer', horse: 'Quidams Rubin', club: 'Hípico San Isidro' },
  { order: 5, rider: 'Martín Dopazo', horse: 'Callisto Z', club: 'Club Hípico Argentino' },
  { order: 6, rider: 'Victoria Morosini', horse: 'Lord Chancellor', club: 'San Jorge Village' },
  { order: 7, rider: 'Santiago Brandolino', horse: 'Casallino', club: 'Jockey Club Córdoba' },
  { order: 8, rider: 'Justo Albarracín', horse: 'E-Cointreau', club: 'Club Alemán de Equitación' },
];

const SAMPLE_RESULTS_120 = [
  { rank: 1, rider: 'Victoria Morosini', horse: 'Chacco Pearl', club: 'San Jorge Village', r1Faults: 0, r1Time: '68.42', jumpOffFaults: 0, jumpOffTime: '34.18', prize: '$180.000' },
  { rank: 2, rider: 'Martín Dopazo', horse: 'Pegasus Z', club: 'Club Hípico Argentino', r1Faults: 0, r1Time: '70.15', jumpOffFaults: 0, jumpOffTime: '35.04', prize: '$130.000' },
  { rank: 3, rider: 'Gonzalo Bosch', horse: 'Quick Silver', club: 'Club de Campo La Horqueta', r1Faults: 0, r1Time: '71.20', jumpOffFaults: 0, jumpOffTime: '36.88', prize: '$95.000' },
  { rank: 4, rider: 'Federico Sztyrle', horse: 'Diamant Boy', club: 'Hípico San Isidro', r1Faults: 0, r1Time: '69.80', jumpOffFaults: 4, jumpOffTime: '33.90', prize: '$65.000' },
  { rank: 5, rider: 'Justo Albarracín', horse: 'Cornet Blue', club: 'Club Alemán de Equitación', r1Faults: 0, r1Time: '72.44', jumpOffFaults: 4, jumpOffTime: '37.12', prize: '$50.000' },
  { rank: 6, rider: 'Camila Rossi', horse: 'Baloubet Star', club: 'Jockey Club Rosario', r1Faults: 4, r1Time: '70.08' },
  { rank: 7, rider: 'Lucía Santillán', horse: 'Kashmir Spirit', club: 'Club Hípico del Norte', r1Faults: 4, r1Time: '73.22' },
  { rank: 8, rider: 'Esteban Brena', horse: 'Vigo d’Arsouilles', club: 'Club Alemán de Equitación', r1Faults: 8, r1Time: '74.50' },
];

const SAMPLE_RESULTS_GP = [
  { rank: 1, rider: 'José María Larocca', horse: 'Finn Lente', club: 'Club Hípico Argentino', r1Faults: 0, r1Time: '74.12', jumpOffFaults: 0, jumpOffTime: '39.24', prize: '$850.000' },
  { rank: 2, rider: 'Matías Albarracín', horse: 'Cannavaro 9', club: 'San Jorge Village', r1Faults: 0, r1Time: '75.80', jumpOffFaults: 0, jumpOffTime: '40.18', prize: '$600.000' },
  { rank: 3, rider: 'Damián Ancic', horse: 'Santa Rosa Valery', club: 'Club Alemán de Equitación', r1Faults: 0, r1Time: '76.30', jumpOffFaults: 4, jumpOffTime: '38.92', prize: '$450.000' },
  { rank: 4, rider: 'Martín Dopazo', horse: 'Callisto Z', club: 'Club Hípico Argentino', r1Faults: 4, r1Time: '73.55', jumpOffFaults: '—', jumpOffTime: '', prize: '$300.000' },
  { rank: 5, rider: 'Victoria Morosini', horse: 'Lord Chancellor', club: 'San Jorge Village', r1Faults: 4, r1Time: '76.10', prize: '$200.000' },
  { rank: 6, rider: 'Santiago Brandolino', horse: 'Casallino', club: 'Jockey Club Córdoba', r1Faults: 8, r1Time: '77.40' },
  { rank: 7, rider: 'Fabián Sejzer', horse: 'Quidams Rubin', club: 'Hípico San Isidro', r1Faults: 8, r1Time: '78.90' },
];

export function buildInitialDocuments(): DocumentItem[] {
  // 1. EVENTO 1: Un solo día (4 OCT) - Solo Anteprograma. Sin listados ni resultados.
  const evt1ProgramP1 = createAnteprogramaDoc({
    eventName: 'Torneo Iniciación de Salto',
    venue: 'Club Hípico del Norte',
    dates: '4 de Octubre de 2026',
    page: 1,
    totalPages: 2
  });
  const evt1ProgramP2 = createAnteprogramaDoc({
    eventName: 'Torneo Iniciación de Salto',
    venue: 'Club Hípico del Norte',
    dates: '4 de Octubre de 2026',
    page: 2,
    totalPages: 2
  });

  // 2. EVENTO 2: Dos días (9-10 OCT) - Anteprograma + Listados. Sin resultados todavía.
  const evt2ProgramP1 = createAnteprogramaDoc({
    eventName: 'Copa Ciudad Ecuestre',
    venue: 'San Jorge Village Hípico',
    dates: '9 — 10 de Octubre de 2026',
    page: 1,
    totalPages: 2
  });
  const evt2ProgramP2 = createAnteprogramaDoc({
    eventName: 'Copa Ciudad Ecuestre',
    venue: 'San Jorge Village Hípico',
    dates: '9 — 10 de Octubre de 2026',
    page: 2,
    totalPages: 2
  });

  const evt2StartListFri = createStartListDoc({
    eventName: 'Copa Ciudad Ecuestre',
    testTitle: 'Prueba N° 2 — Clasificatoria',
    height: '1.20 m',
    dayFormatted: 'Viernes 9 de Octubre 2026',
    tableBaremo: 'Dos Fases Especial (Art. 274.2.5)',
    starters: SAMPLE_STARTERS_A
  });

  const evt2StartListSat = createStartListDoc({
    eventName: 'Copa Ciudad Ecuestre',
    testTitle: 'Prueba N° 4 — Final Especial',
    height: '1.30 m',
    dayFormatted: 'Sábado 10 de Octubre 2026',
    tableBaremo: 'Tabla A con cronómetro (Art. 238.2.1)',
    starters: SAMPLE_STARTERS_A
  });

  // 3. EVENTO 3: Tres días (16-18 OCT) - Anteprograma (Original y Actualizado) + Listados + Resultados completos para cada jornada!
  const evt3ProgramOriginalP1 = createAnteprogramaDoc({
    eventName: 'Gran Premio Primavera FEI',
    venue: 'Club Alemán de Equitación',
    dates: '16 — 18 de Octubre de 2026',
    page: 1,
    totalPages: 2
  });
  const evt3ProgramOriginalP2 = createAnteprogramaDoc({
    eventName: 'Gran Premio Primavera FEI',
    venue: 'Club Alemán de Equitación',
    dates: '16 — 18 de Octubre de 2026',
    page: 2,
    totalPages: 2
  });

  // Start Lists for Evt 3
  const evt3StartFri110 = createStartListDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Prueba N° 1 — Bienvenida',
    height: '1.10 m',
    dayFormatted: 'Viernes 16 de Octubre 2026',
    tableBaremo: 'Doble Fase sin cronómetro (Art. 274.1)',
    starters: SAMPLE_STARTERS_A
  });

  const evt3StartFri120 = createStartListDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Prueba N° 2 — Velocidad',
    height: '1.20 m',
    dayFormatted: 'Viernes 16 de Octubre 2026',
    tableBaremo: 'Tabla C Velocidad y Manejabilidad',
    starters: SAMPLE_STARTERS_A
  });

  const evt3StartSat130 = createStartListDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Prueba N° 4 — Especial Mediana',
    height: '1.30 m',
    dayFormatted: 'Sábado 17 de Octubre 2026',
    tableBaremo: 'Tabla A al cronómetro (Art. 238.2.1)',
    starters: SAMPLE_STARTERS_A
  });

  const evt3StartSunGP = createStartListDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Prueba N° 6 — Gran Premio Primavera',
    height: '1.45 m',
    dayFormatted: 'Domingo 18 de Octubre 2026',
    tableBaremo: 'Doble Recorrido al Cronómetro (Art. 273.3.2)',
    starters: SAMPLE_STARTERS_GP
  });

  // Results for Evt 3
  const evt3ResultsFri120 = createResultDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Resultados Oficiales — Prueba N° 2',
    height: '1.20 m',
    dayFormatted: 'Viernes 16 de Octubre 2026',
    results: SAMPLE_RESULTS_120
  });

  const evt3ResultsSat130 = createResultDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Resultados Oficiales — Prueba N° 4',
    height: '1.30 m',
    dayFormatted: 'Sábado 17 de Octubre 2026',
    results: SAMPLE_RESULTS_120
  });

  const evt3ResultsSunGP = createResultDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Resultados Oficiales — Gran Premio Primavera',
    height: '1.45 m',
    dayFormatted: 'Domingo 18 de Octubre 2026',
    results: SAMPLE_RESULTS_GP
  });

  const evt3CoursePlanSunGP = createCoursePlanDoc({
    eventName: 'Gran Premio Primavera FEI',
    testTitle: 'Plano de Pista Oficial — Gran Premio',
    height: '1.45 m',
    dayFormatted: 'Domingo 18 de Octubre 2026'
  });

  // 4. EVENTO 4: Concurso coincidente parcialmente (17-18 OCT) - Club Hípico Argentino
  const evt4ProgramP1 = createAnteprogramaDoc({
    eventName: 'Concurso Abierto de Salto Primavera',
    venue: 'Club Hípico Argentino',
    dates: '17 — 18 de Octubre de 2026',
    page: 1,
    totalPages: 2
  });
  const evt4ProgramP2 = createAnteprogramaDoc({
    eventName: 'Concurso Abierto de Salto Primavera',
    venue: 'Club Hípico Argentino',
    dates: '17 — 18 de Octubre de 2026',
    page: 2,
    totalPages: 2
  });

  const evt4StartSat = createStartListDoc({
    eventName: 'Concurso Abierto de Salto Primavera',
    testTitle: 'Orden de Ingreso — Prueba 1.15m',
    height: '1.15 m',
    dayFormatted: 'Sábado 17 de Octubre 2026',
    tableBaremo: 'Dos Fases Especial',
    starters: SAMPLE_STARTERS_A.slice(0, 6)
  });

  const evt4StartSun = createStartListDoc({
    eventName: 'Concurso Abierto de Salto Primavera',
    testTitle: 'Orden de Ingreso — Clásico 1.30m',
    height: '1.30 m',
    dayFormatted: 'Domingo 18 de Octubre 2026',
    tableBaremo: 'Tabla A con Desempate',
    starters: SAMPLE_STARTERS_A.slice(0, 6)
  });

  // 5. EVENTO 5: Tres días (23-25 OCT) - San Isidro
  const evt5ProgramP1 = createAnteprogramaDoc({
    eventName: 'Copa Nacional de Campeones',
    venue: 'Hípico San Isidro',
    dates: '23 — 25 de Octubre de 2026',
    page: 1,
    totalPages: 1
  });

  return [
    // Event 1 documents
    {
      id: 'doc-101',
      eventId: 'evt-1',
      name: 'Anteprograma Oficial',
      type: 'PROGRAM',
      eventDate: null,
      fileUrl: evt1ProgramP1,
      pages: [evt1ProgramP1, evt1ProgramP2],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-09-15T10:00:00Z',
      updatedAt: '2026-09-15T10:00:00Z',
    },

    // Event 2 documents
    {
      id: 'doc-201',
      eventId: 'evt-2',
      name: 'Anteprograma Oficial Aprobado',
      type: 'PROGRAM',
      eventDate: null,
      fileUrl: evt2ProgramP1,
      pages: [evt2ProgramP1, evt2ProgramP2],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-09-18T11:00:00Z',
      updatedAt: '2026-09-18T11:00:00Z',
    },
    {
      id: 'doc-202',
      eventId: 'evt-2',
      name: 'Orden de Ingreso — Prueba N° 2 (1.20 m)',
      type: 'START_LIST',
      eventDate: '2026-10-09',
      fileUrl: evt2StartListFri,
      pages: [evt2StartListFri],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-08T18:00:00Z',
      updatedAt: '2026-10-08T18:00:00Z',
    },
    {
      id: 'doc-203',
      eventId: 'evt-2',
      name: 'Orden de Ingreso — Prueba N° 4 (1.30 m)',
      type: 'START_LIST',
      eventDate: '2026-10-10',
      fileUrl: evt2StartListSat,
      pages: [evt2StartListSat],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-09T20:00:00Z',
      updatedAt: '2026-10-09T20:00:00Z',
    },

    // Event 3 documents (Full: Anteprogramas, Start Lists, Results)
    {
      id: 'doc-301',
      eventId: 'evt-3',
      name: 'Anteprograma Oficial FEI (Original)',
      type: 'PROGRAM',
      eventDate: null,
      fileUrl: evt3ProgramOriginalP1,
      pages: [evt3ProgramOriginalP1, evt3ProgramOriginalP2],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-09-20T09:00:00Z',
      updatedAt: '2026-09-20T09:00:00Z',
    },
    {
      id: 'doc-302',
      eventId: 'evt-3',
      name: 'Anteprograma Actualizado (con reglamentación de boxes)',
      type: 'PROGRAM',
      eventDate: null,
      fileUrl: evt3ProgramOriginalP1,
      pages: [evt3ProgramOriginalP1, evt3ProgramOriginalP2],
      mimeType: 'image/svg+xml' as any,
      order: 2,
      createdAt: '2026-10-02T10:00:00Z',
      updatedAt: '2026-10-02T10:00:00Z',
    },
    // Event 3 - Viernes 16 Oct
    {
      id: 'doc-303',
      eventId: 'evt-3',
      name: 'Orden de Ingreso — Prueba 1 (1.10 m)',
      type: 'START_LIST',
      eventDate: '2026-10-16',
      fileUrl: evt3StartFri110,
      pages: [evt3StartFri110],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-15T19:00:00Z',
      updatedAt: '2026-10-15T19:00:00Z',
    },
    {
      id: 'doc-304',
      eventId: 'evt-3',
      name: 'Orden de Ingreso — Prueba 2 Velocidad (1.20 m)',
      type: 'START_LIST',
      eventDate: '2026-10-16',
      fileUrl: evt3StartFri120,
      pages: [evt3StartFri120],
      mimeType: 'image/svg+xml' as any,
      order: 2,
      createdAt: '2026-10-15T19:30:00Z',
      updatedAt: '2026-10-15T19:30:00Z',
    },
    {
      id: 'doc-305',
      eventId: 'evt-3',
      name: 'Resultados Oficiales — Prueba 2 (1.20 m)',
      type: 'RESULT',
      eventDate: '2026-10-16',
      fileUrl: evt3ResultsFri120,
      pages: [evt3ResultsFri120],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-16T17:00:00Z',
      updatedAt: '2026-10-16T17:00:00Z',
    },
    // Event 3 - Sábado 17 Oct
    {
      id: 'doc-306',
      eventId: 'evt-3',
      name: 'Orden de Ingreso — Prueba 4 Especial (1.30 m)',
      type: 'START_LIST',
      eventDate: '2026-10-17',
      fileUrl: evt3StartSat130,
      pages: [evt3StartSat130],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-16T20:00:00Z',
      updatedAt: '2026-10-16T20:00:00Z',
    },
    {
      id: 'doc-307',
      eventId: 'evt-3',
      name: 'Resultados Oficiales — Prueba 4 Especial (1.30 m)',
      type: 'RESULT',
      eventDate: '2026-10-17',
      fileUrl: evt3ResultsSat130,
      pages: [evt3ResultsSat130],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-17T18:00:00Z',
      updatedAt: '2026-10-17T18:00:00Z',
    },
    // Event 3 - Domingo 18 Oct
    {
      id: 'doc-308',
      eventId: 'evt-3',
      name: 'Orden de Ingreso — Gran Premio Primavera (1.45 m)',
      type: 'START_LIST',
      eventDate: '2026-10-18',
      fileUrl: evt3StartSunGP,
      pages: [evt3StartSunGP],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-17T21:00:00Z',
      updatedAt: '2026-10-17T21:00:00Z',
    },
    {
      id: 'doc-309',
      eventId: 'evt-3',
      name: 'Resultados Oficiales — Gran Premio Primavera (1.45 m)',
      type: 'RESULT',
      eventDate: '2026-10-18',
      fileUrl: evt3ResultsSunGP,
      pages: [evt3ResultsSunGP],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-18T18:30:00Z',
      updatedAt: '2026-10-18T18:30:00Z',
    },
    {
      id: 'doc-310',
      eventId: 'evt-3',
      name: 'Plano de Pista — Gran Premio (Recorrido 1.45 m)',
      type: 'START_LIST',
      eventDate: '2026-10-18',
      fileUrl: evt3CoursePlanSunGP,
      pages: [evt3CoursePlanSunGP],
      mimeType: 'image/svg+xml' as any,
      order: 2,
      createdAt: '2026-10-17T22:00:00Z',
      updatedAt: '2026-10-17T22:00:00Z',
    },

    // Event 4 documents (Overlapping event)
    {
      id: 'doc-401',
      eventId: 'evt-4',
      name: 'Anteprograma Oficial',
      type: 'PROGRAM',
      eventDate: null,
      fileUrl: evt4ProgramP1,
      pages: [evt4ProgramP1, evt4ProgramP2],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-09-22T14:00:00Z',
      updatedAt: '2026-09-22T14:00:00Z',
    },
    {
      id: 'doc-402',
      eventId: 'evt-4',
      name: 'Orden de Ingreso — Prueba 1.15 m',
      type: 'START_LIST',
      eventDate: '2026-10-17',
      fileUrl: evt4StartSat,
      pages: [evt4StartSat],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-16T19:00:00Z',
      updatedAt: '2026-10-16T19:00:00Z',
    },
    {
      id: 'doc-403',
      eventId: 'evt-4',
      name: 'Orden de Ingreso — Clásico 1.30 m',
      type: 'START_LIST',
      eventDate: '2026-10-18',
      fileUrl: evt4StartSun,
      pages: [evt4StartSun],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-10-17T19:00:00Z',
      updatedAt: '2026-10-17T19:00:00Z',
    },

    // Event 5 documents
    {
      id: 'doc-501',
      eventId: 'evt-5',
      name: 'Anteprograma Oficial',
      type: 'PROGRAM',
      eventDate: null,
      fileUrl: evt5ProgramP1,
      pages: [evt5ProgramP1],
      mimeType: 'image/svg+xml' as any,
      order: 1,
      createdAt: '2026-09-25T16:00:00Z',
      updatedAt: '2026-09-25T16:00:00Z',
    }
  ];
}
