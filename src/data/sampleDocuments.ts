/**
 * Helper to generate crisp, high-resolution SVG documents as data URIs.
 * These simulate real official jumping federation bulletins, start lists, and results sheets.
 */

function svgToDataUri(svgString: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

export function createAnteprogramaDoc(options: {
  eventName: string;
  venue: string;
  dates: string;
  page: number;
  totalPages: number;
}): string {
  const { eventName, venue, dates, page, totalPages } = options;

  if (page === 1) {
    return svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1130" width="800" height="1130" style="background:#ffffff; font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
  <!-- Paper Background & Frame -->
  <rect width="800" height="1130" fill="#ffffff" />
  <rect x="36" y="36" width="728" height="1058" fill="none" stroke="#e2e8f0" stroke-width="1.5" />
  <rect x="42" y="42" width="716" height="1046" fill="none" stroke="#0f172a" stroke-width="0.75" />

  <!-- Header Banner -->
  <rect x="42" y="42" width="716" height="85" fill="#0f172a" />
  <text x="70" y="78" fill="#ffffff" font-size="11" font-weight="700" letter-spacing="3">FEDERACIÓN ECUESTRE · TEMPORADA OFICIAL 2026</text>
  <text x="70" y="105" fill="#94a3b8" font-size="18" font-weight="800" letter-spacing="1">ANTEPROGRAMA OFICIAL DE SALTO</text>
  <text x="710" y="92" text-anchor="end" fill="#ffffff" font-size="14" font-weight="700">CSN ***</text>

  <!-- Competition Info Block -->
  <rect x="70" y="155" width="660" height="110" fill="#f8fafc" stroke="#e2e8f0" rx="4" />
  <text x="95" y="190" fill="#64748b" font-size="11" font-weight="700" letter-spacing="1">EVENTO</text>
  <text x="95" y="215" fill="#0f172a" font-size="20" font-weight="800">${eventName}</text>
  
  <text x="95" y="245" fill="#475569" font-size="13" font-weight="600">Sede: <tspan fill="#0f172a" font-weight="700">${venue}</tspan></text>
  <text x="440" y="245" fill="#475569" font-size="13" font-weight="600">Fechas: <tspan fill="#0f172a" font-weight="700">${dates}</tspan></text>

  <!-- Authorities Section -->
  <text x="70" y="300" fill="#0f172a" font-size="14" font-weight="800" letter-spacing="0.5">1. AUTORIDADES DEL CONCURSO</text>
  <line x1="70" y1="310" x2="730" y2="310" stroke="#0f172a" stroke-width="1.5" />

  <g transform="translate(70, 325)" font-size="12">
    <rect x="0" y="0" width="320" height="65" fill="#ffffff" stroke="#f1f5f9" rx="4" />
    <text x="15" y="24" fill="#64748b" font-weight="600">Presidente del Jurado de Campo</text>
    <text x="15" y="46" fill="#0f172a" font-weight="700">Cnel. (R) Roberto Méndez (Juez Nac. FEI)</text>

    <rect x="340" y="0" width="320" height="65" fill="#ffffff" stroke="#f1f5f9" rx="4" />
    <text x="355" y="24" fill="#64748b" font-weight="600">Diseñador de Pistas (Course Designer)</text>
    <text x="355" y="46" fill="#0f172a" font-weight="700">Arq. Javier E. Larrea (Nivel 3 FEI)</text>

    <rect x="0" y="75" width="320" height="65" fill="#ffffff" stroke="#f1f5f9" rx="4" />
    <text x="15" y="99" fill="#64748b" font-weight="600">Comisario General (Chief Steward)</text>
    <text x="15" y="121" fill="#0f172a" font-weight="700">Lic. Martín Gómez Paz</text>

    <rect x="340" y="75" width="320" height="65" fill="#ffffff" stroke="#f1f5f9" rx="4" />
    <text x="355" y="99" fill="#64748b" font-weight="600">Cronometraje Electrónico</text>
    <text x="355" y="121" fill="#0f172a" font-weight="700">Sistema Fotocélulas Wireless Longines/Tag</text>
  </g>

  <!-- Technical Conditions -->
  <text x="70" y="500" fill="#0f172a" font-size="14" font-weight="800" letter-spacing="0.5">2. CONDICIONES TÉCNICAS Y REGLAMENTACIÓN</text>
  <line x1="70" y1="510" x2="730" y2="510" stroke="#0f172a" stroke-width="1.5" />

  <g transform="translate(70, 530)" font-size="12" fill="#334155">
    <text x="0" y="0">• El concurso se disputará conforme al Reglamento General y de Salto de la Federación Ecuestre.</text>
    <text x="0" y="24">• Pista Principal: Césped / Arena Sílica de alta densidad (110m x 75m). Pista de calentamiento arena (70m x 45m).</text>
    <text x="0" y="48">• Número máximo de caballos por jinete en cada prueba: Tres (3). En el Gran Premio: Dos (2).</text>
    <text x="0" y="72">• Se exige pasaporte ecuestre al día con vacunas de influenza y anemia infecciosa negativa vigentes.</text>
    <text x="0" y="96">• Vestimenta reglamentaria completa obligatoria para todas las categorías.</text>
  </g>

  <!-- Summary of tests preview -->
  <text x="70" y="685" fill="#0f172a" font-size="14" font-weight="800" letter-spacing="0.5">3. CUADRO RESUMEN DE PRUEBAS</text>
  <line x1="70" y1="695" x2="730" y2="695" stroke="#0f172a" stroke-width="1.5" />

  <g transform="translate(70, 715)">
    <rect x="0" y="0" width="660" height="28" fill="#f1f5f9" />
    <text x="15" y="18" fill="#0f172a" font-size="11" font-weight="700">JORNADA</text>
    <text x="140" y="18" fill="#0f172a" font-size="11" font-weight="700">PRUEBA</text>
    <text x="320" y="18" fill="#0f172a" font-size="11" font-weight="700">ALTURA</text>
    <text x="440" y="18" fill="#0f172a" font-size="11" font-weight="700">TABLA / BAREMO</text>
    <text x="590" y="18" fill="#0f172a" font-size="11" font-weight="700">PREMIOS</text>

    <!-- Row 1 -->
    <line x1="0" y1="28" x2="660" y2="28" stroke="#e2e8f0" />
    <text x="15" y="48" fill="#0f172a" font-size="12" font-weight="600">Día 1</text>
    <text x="140" y="48" fill="#0f172a" font-size="12">Prueba N° 1 y N° 2</text>
    <text x="320" y="48" fill="#0f172a" font-size="12" font-weight="700">1.10 m / 1.20 m</text>
    <text x="440" y="48" fill="#64748b" font-size="11">Dos Fases Especial (Art. 274.2)</text>
    <text x="590" y="48" fill="#0f172a" font-size="12">Trofeos</text>

    <!-- Row 2 -->
    <line x1="0" y1="58" x2="660" y2="58" stroke="#e2e8f0" />
    <text x="15" y="78" fill="#0f172a" font-size="12" font-weight="600">Día 2</text>
    <text x="140" y="78" fill="#0f172a" font-size="12">Prueba N° 3 y N° 4</text>
    <text x="320" y="78" fill="#0f172a" font-size="12" font-weight="700">1.25 m / 1.35 m</text>
    <text x="440" y="78" fill="#64748b" font-size="11">Tabla A con cronómetro (Art. 238.2.1)</text>
    <text x="590" y="78" fill="#0f172a" font-size="12">Bolsa $</text>

    <!-- Row 3 -->
    <line x1="0" y1="88" x2="660" y2="88" stroke="#e2e8f0" />
    <text x="15" y="108" fill="#0f172a" font-size="12" font-weight="600">Día Final</text>
    <text x="140" y="108" fill="#0f172a" font-size="12" font-weight="700">Gran Premio Oficial</text>
    <text x="320" y="108" fill="#0f172a" font-size="12" font-weight="700">1.40 m / 1.45 m</text>
    <text x="440" y="108" fill="#64748b" font-size="11">Doble Recorrido (Art. 273.3.2)</text>
    <text x="590" y="108" fill="#0f172a" font-size="12" font-weight="700">Copa + $</text>
    <line x1="0" y1="120" x2="660" y2="120" stroke="#e2e8f0" />
  </g>

  <!-- Footer Pagination -->
  <line x1="70" y1="1030" x2="730" y2="1030" stroke="#cbd5e1" />
  <text x="70" y="1055" fill="#94a3b8" font-size="10">Documento Oficial · Generado para la Comisión Técnica de Salto</text>
  <text x="730" y="1055" text-anchor="end" fill="#0f172a" font-size="11" font-weight="700">Página ${page} de ${totalPages}</text>
</svg>
    `.trim());
  }

  // Page 2
  return svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1130" width="800" height="1130" style="background:#ffffff; font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
  <rect width="800" height="1130" fill="#ffffff" />
  <rect x="36" y="36" width="728" height="1058" fill="none" stroke="#e2e8f0" stroke-width="1.5" />
  <rect x="42" y="42" width="716" height="1046" fill="none" stroke="#0f172a" stroke-width="0.75" />

  <!-- Header Banner -->
  <rect x="42" y="42" width="716" height="60" fill="#0f172a" />
  <text x="70" y="78" fill="#ffffff" font-size="13" font-weight="700" letter-spacing="1">CRONOGRAMA DETALLADO DE PRUEBAS · ANTEPROGRAMA</text>
  <text x="710" y="78" text-anchor="end" fill="#94a3b8" font-size="12">Pág. ${page}/${totalPages}</text>

  <!-- Section 4 Details -->
  <text x="70" y="140" fill="#0f172a" font-size="15" font-weight="800">4. DISPOSICIONES PARTICULARES DE LAS PRUEBAS</text>
  <line x1="70" y1="150" x2="730" y2="150" stroke="#0f172a" stroke-width="1.5" />

  <g transform="translate(70, 175)" font-size="12" fill="#1e293b">
    <rect x="0" y="0" width="660" height="145" fill="#f8fafc" stroke="#e2e8f0" rx="4" />
    <text x="20" y="30" font-weight="800" font-size="14" fill="#0f172a">PRUEBA DE VELOCIDAD Y DESTREZA (1.20 m)</text>
    <text x="20" y="55" fill="#475569">Baremo: Tabla A al cronómetro sin desempate (Art. 238.2.1)</text>
    <text x="20" y="75" fill="#475569">Velocidad: 350 m/minuto. Obstáculos: 11 con 1 combinación doble.</text>
    <text x="20" y="95" fill="#475569">Categorías admitidas: Mayores, Juveniles y Caballos Jóvenes 6 y 7 años.</text>
    <text x="20" y="120" font-weight="700" fill="#0f172a">Premio: Copas para los 3 primeros clasificados y cucardas al 25% de participantes.</text>
  </g>

  <g transform="translate(70, 340)" font-size="12" fill="#1e293b">
    <rect x="0" y="0" width="660" height="165" fill="#f8fafc" stroke="#e2e8f0" rx="4" />
    <text x="20" y="30" font-weight="800" font-size="14" fill="#0f172a">GRAN PREMIO OFICIAL (1.40 m / 1.45 m)</text>
    <text x="20" y="55" fill="#475569">Baremo: Dos Recorridos diferentes al cronómetro contra reloj (Art. 273.3.2)</text>
    <text x="20" y="75" fill="#475569">Velocidad: 375 m/minuto. Ría facultativa: 3.50 m.</text>
    <text x="20" y="95" fill="#475569">Clasifican al 2° recorrido: Los 10 mejores jinetes o todos los jinetes sin faltas.</text>
    <text x="20" y="115" fill="#475569">Inspección de pista y veterinaria: Domingo 08:30 hs.</text>
    <text x="20" y="140" font-weight="700" fill="#0f172a">Premio Especial: Trofeo Perpetuo Challenger y Medalla Dorada Oficial.</text>
  </g>

  <!-- Veterinary and Box regulations -->
  <text x="70" y="540" fill="#0f172a" font-size="14" font-weight="800">5. BOXES Y ATENCIÓN VETERINARIA</text>
  <line x1="70" y1="550" x2="730" y2="550" stroke="#0f172a" stroke-width="1.5" />
  
  <g transform="translate(70, 575)" font-size="12" fill="#334155">
    <text x="0" y="0">• Reserva de boxes: Debe realizarse con 72 hs de anticipación a la fecha de inicio.</text>
    <text x="0" y="24">• Servicio Veterinario de Guardia: Dr. Ignacio Quintana (Mat. Prov. 4812).</text>
    <text x="0" y="48">• Herrador Oficial: Disponible en el sector caballerizas desde las 07:30 hs.</text>
    <text x="0" y="72">• Los jinetes deberán presentar la libreta sanitaria al momento del desembarque.</text>
  </g>

  <!-- Signatures -->
  <g transform="translate(70, 800)">
    <line x1="40" y1="60" x2="240" y2="60" stroke="#94a3b8" />
    <text x="140" y="80" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700">Comisión Organizadora</text>
    <text x="140" y="95" text-anchor="middle" fill="#64748b" font-size="10">${venue}</text>

    <line x1="420" y1="60" x2="620" y2="60" stroke="#94a3b8" />
    <text x="520" y="80" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700">Federación Ecuestre</text>
    <text x="520" y="95" text-anchor="middle" fill="#64748b" font-size="10">Aprobación Técnica N° 2026-CS-41</text>
  </g>

  <!-- Footer -->
  <line x1="70" y1="1030" x2="730" y2="1030" stroke="#cbd5e1" />
  <text x="70" y="1055" fill="#94a3b8" font-size="10">Salto Ecuestre · Sistema Integrado</text>
  <text x="730" y="1055" text-anchor="end" fill="#0f172a" font-size="11" font-weight="700">Página ${page} de ${totalPages}</text>
</svg>
  `.trim());
}

export function createStartListDoc(options: {
  eventName: string;
  testTitle: string;
  height: string;
  dayFormatted: string;
  tableBaremo: string;
  starters: Array<{ order: number; rider: string; horse: string; club: string }>;
}): string {
  const { eventName, testTitle, height, dayFormatted, tableBaremo, starters } = options;

  const rows = starters.map((item, idx) => {
    const y = 305 + idx * 36;
    const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    return `
      <rect x="60" y="${y - 20}" width="680" height="34" fill="${bg}" rx="2" />
      <text x="80" y="${y}" fill="#0f172a" font-size="13" font-weight="700" text-anchor="middle">${item.order}</text>
      <text x="120" y="${y}" fill="#0f172a" font-size="12" font-weight="700">${item.rider}</text>
      <text x="350" y="${y}" fill="#1e293b" font-size="12" font-weight="600">${item.horse}</text>
      <text x="560" y="${y}" fill="#64748b" font-size="11">${item.club}</text>
      <line x1="60" y1="${y + 14}" x2="740" y2="${y + 14}" stroke="#f1f5f9" />
    `;
  }).join('');

  return svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1130" width="800" height="1130" style="background:#ffffff; font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
  <rect width="800" height="1130" fill="#ffffff" />
  <rect x="36" y="36" width="728" height="1058" fill="none" stroke="#e2e8f0" stroke-width="1.5" />

  <!-- Header -->
  <rect x="36" y="36" width="728" height="70" fill="#0f172a" />
  <text x="60" y="65" fill="#94a3b8" font-size="10" font-weight="700" letter-spacing="2">ORDEN DE INGRESO OFICIAL · START LIST</text>
  <text x="60" y="90" fill="#ffffff" font-size="18" font-weight="800">${eventName}</text>
  <text x="730" y="85" text-anchor="end" fill="#ffffff" font-size="13" font-weight="700">${dayFormatted}</text>

  <!-- Test Title Block -->
  <rect x="60" y="130" width="680" height="90" fill="#f8fafc" stroke="#e2e8f0" rx="4" />
  <text x="80" y="160" fill="#0f172a" font-size="16" font-weight="800">${testTitle} — Altura: ${height}</text>
  <text x="80" y="185" fill="#475569" font-size="12">Baremo: <tspan font-weight="600" fill="#0f172a">${tableBaremo}</tspan> · Longitud: 460m · Velocidad: 350 m/min</text>
  <text x="80" y="205" fill="#64748b" font-size="11">Tiempo Permitido: 79 seg. · Tiempo Límite: 158 seg. · Total Inscriptos: ${starters.length} binomios</text>

  <!-- Table Header -->
  <rect x="60" y="245" width="680" height="34" fill="#0f172a" rx="3" />
  <text x="80" y="267" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">ORD.</text>
  <text x="120" y="267" fill="#ffffff" font-size="11" font-weight="700">JINETE / AMAZONA</text>
  <text x="350" y="267" fill="#ffffff" font-size="11" font-weight="700">CABALLO</text>
  <text x="560" y="267" fill="#ffffff" font-size="11" font-weight="700">CLUB / AFILIACIÓN</text>

  <!-- Starters Rows -->
  <g>
    ${rows}
  </g>

  <!-- Footer -->
  <line x1="60" y1="1050" x2="740" y2="1050" stroke="#cbd5e1" />
  <text x="60" y="1075" fill="#94a3b8" font-size="10">El orden de ingreso es riguroso. Presentarse en antepista con 3 números de anticipación.</text>
  <text x="740" y="1075" text-anchor="end" fill="#0f172a" font-size="11" font-weight="700">Página 1 de 1</text>
</svg>
  `.trim());
}

export function createResultDoc(options: {
  eventName: string;
  testTitle: string;
  height: string;
  dayFormatted: string;
  results: Array<{
    rank: number;
    rider: string;
    horse: string;
    club: string;
    r1Faults: number | string;
    r1Time: string;
    jumpOffFaults?: number | string;
    jumpOffTime?: string;
    prize?: string;
  }>;
}): string {
  const { eventName, testTitle, height, dayFormatted, results } = options;

  const rows = results.map((item, idx) => {
    const y = 310 + idx * 36;
    const bg = idx === 0 ? '#f0fdf4' : idx < 3 ? '#f8fafc' : '#ffffff';
    const rankColor = idx === 0 ? '#15803d' : '#0f172a';
    return `
      <rect x="50" y="${y - 20}" width="700" height="34" fill="${bg}" rx="2" stroke="${idx === 0 ? '#bbf7d0' : '#f1f5f9'}" />
      <text x="75" y="${y}" fill="${rankColor}" font-size="13" font-weight="800" text-anchor="middle">${item.rank}°</text>
      <text x="110" y="${y}" fill="#0f172a" font-size="12" font-weight="700">${item.rider}</text>
      <text x="290" y="${y}" fill="#334155" font-size="12" font-weight="600">${item.horse}</text>
      <text x="445" y="${y}" fill="#64748b" font-size="11">${item.club}</text>
      <text x="560" y="${y}" fill="#0f172a" font-size="12" font-weight="700" text-anchor="middle">${item.r1Faults} / ${item.r1Time}</text>
      <text x="640" y="${y}" fill="#0f172a" font-size="12" font-weight="700" text-anchor="middle">${item.jumpOffTime ? `${item.jumpOffFaults} / ${item.jumpOffTime}` : '—'}</text>
      <text x="720" y="${y}" fill="#15803d" font-size="11" font-weight="700" text-anchor="end">${item.prize || ''}</text>
    `;
  }).join('');

  return svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1130" width="800" height="1130" style="background:#ffffff; font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
  <rect width="800" height="1130" fill="#ffffff" />
  <rect x="36" y="36" width="728" height="1058" fill="none" stroke="#e2e8f0" stroke-width="1.5" />

  <!-- Header -->
  <rect x="36" y="36" width="728" height="70" fill="#0f172a" />
  <text x="55" y="65" fill="#94a3b8" font-size="10" font-weight="700" letter-spacing="2">PLANILLA OFICIAL DE RESULTADOS · FINAL RESULTS</text>
  <text x="55" y="90" fill="#ffffff" font-size="18" font-weight="800">${eventName}</text>
  <text x="735" y="85" text-anchor="end" fill="#ffffff" font-size="13" font-weight="700">${dayFormatted}</text>

  <!-- Test Summary -->
  <rect x="50" y="130" width="700" height="90" fill="#f8fafc" stroke="#e2e8f0" rx="4" />
  <text x="70" y="160" fill="#0f172a" font-size="16" font-weight="800">${testTitle} (${height})</text>
  <text x="70" y="185" fill="#475569" font-size="12">Baremo: Tabla A al cronómetro con desempate posterior (Art. 238.2.2)</text>
  <text x="70" y="205" fill="#64748b" font-size="11">Total binomios clasificados: ${results.length} · Juez Presidente: Cnel. Roberto Méndez</text>

  <!-- Table Header -->
  <rect x="50" y="245" width="700" height="34" fill="#0f172a" rx="3" />
  <text x="75" y="267" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">POS.</text>
  <text x="110" y="267" fill="#ffffff" font-size="11" font-weight="700">JINETE / AMAZONA</text>
  <text x="290" y="267" fill="#ffffff" font-size="11" font-weight="700">CABALLO</text>
  <text x="445" y="267" fill="#ffffff" font-size="11" font-weight="700">CLUB</text>
  <text x="560" y="267" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">REC. 1 (F/T)</text>
  <text x="640" y="267" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">DESEMPATE</text>
  <text x="720" y="267" fill="#ffffff" font-size="11" font-weight="700" text-anchor="end">PREMIO</text>

  <!-- Result Rows -->
  <g>
    ${rows}
  </g>

  <!-- Signature / Certified -->
  <g transform="translate(50, 960)">
    <text x="20" y="30" fill="#64748b" font-size="11">Planilla homologada por el Jurado de Campo Oficial.</text>
    <line x1="450" y1="35" x2="680" y2="35" stroke="#94a3b8" />
    <text x="565" y="55" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700">Firma del Presidente del Jurado</text>
  </g>

  <!-- Footer -->
  <line x1="50" y1="1050" x2="750" y2="1050" stroke="#cbd5e1" />
  <text x="50" y="1075" fill="#94a3b8" font-size="10">Resultados computarizados por Sistema de Salto Ecuestre Oficial.</text>
  <text x="750" y="1075" text-anchor="end" fill="#0f172a" font-size="11" font-weight="700">Página 1 de 1</text>
</svg>
  `.trim());
}

export function createCoursePlanDoc(options: {
  eventName: string;
  testTitle: string;
  height: string;
  dayFormatted: string;
}): string {
  const { eventName, testTitle, height, dayFormatted } = options;

  return svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700" style="background:#ffffff; font-family:'Plus Jakarta Sans', system-ui, sans-serif;">
  <rect width="1000" height="700" fill="#ffffff" />
  <rect x="20" y="20" width="960" height="660" fill="none" stroke="#cbd5e1" stroke-width="1.5" />

  <!-- Top Header similar to Longines / Hippodata Arena Plan -->
  <text x="40" y="52" fill="#0f172a" font-size="16" font-weight="900" letter-spacing="1">FEI · FEDERACIÓN ECUESTRE</text>
  <text x="500" y="52" text-anchor="middle" fill="#0f172a" font-size="20" font-weight="900">${eventName}</text>
  <text x="960" y="52" text-anchor="end" fill="#0f172a" font-size="14" font-weight="800">OFFICIAL TIMING</text>

  <text x="500" y="74" text-anchor="middle" fill="#475569" font-size="13" font-weight="700">${testTitle} — ${height} · ${dayFormatted}</text>

  <!-- Technical Spec Box -->
  <g transform="translate(40, 90)" font-size="11" fill="#334155">
    <text x="0" y="0">Table: <tspan font-weight="700" fill="#0f172a">A al Cronómetro (Art. 238.2.1)</tspan></text>
    <text x="0" y="18">Height: <tspan font-weight="700" fill="#0f172a">${height}</tspan></text>
    
    <text x="280" y="0">Speed: <tspan font-weight="700" fill="#0f172a">400 m/min</tspan></text>
    <text x="280" y="18">Length: <tspan font-weight="700" fill="#0f172a">470 m</tspan></text>

    <text x="520" y="0">Time Allowed: <tspan font-weight="700" fill="#0f172a">71 sec</tspan></text>
    <text x="520" y="18">Time Limit: <tspan font-weight="700" fill="#0f172a">142 sec</tspan></text>

    <text x="760" y="0">Obstacles: <tspan font-weight="700" fill="#0f172a">12</tspan></text>
    <text x="760" y="18">Efforts: <tspan font-weight="700" fill="#0f172a">15</tspan></text>
  </g>

  <!-- Arena Outer Border -->
  <rect x="70" y="130" width="860" height="520" fill="#fafafa" stroke="#0f172a" stroke-width="2.5" rx="2" />

  <!-- Stands Labels -->
  <rect x="70" y="130" width="860" height="24" fill="#f1f5f9" stroke="#0f172a" stroke-width="1.5" />
  <text x="500" y="146" text-anchor="middle" fill="#0f172a" font-size="10" font-weight="800" letter-spacing="2">VIP STAND</text>

  <rect x="70" y="626" width="400" height="24" fill="#f1f5f9" stroke="#0f172a" stroke-width="1.5" />
  <text x="270" y="642" text-anchor="middle" fill="#0f172a" font-size="10" font-weight="800" letter-spacing="2">PUBLIC STAND</text>

  <rect x="470" y="626" width="160" height="24" fill="#0f172a" stroke="#0f172a" stroke-width="1.5" />
  <text x="550" y="642" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="800" letter-spacing="2">JURY</text>

  <rect x="906" y="154" width="24" height="472" fill="#f1f5f9" stroke="#0f172a" stroke-width="1.5" />
  <text x="918" y="390" text-anchor="middle" transform="rotate(-90 918 390)" fill="#0f172a" font-size="10" font-weight="800" letter-spacing="2">RIDERS STAND</text>

  <!-- Course Track Dashed Line -->
  <path d="M 640 570 C 640 530, 610 470, 580 430 C 530 360, 480 340, 420 320 C 350 300, 260 320, 220 380 C 180 450, 210 540, 310 550 C 400 560, 490 530, 530 460 C 580 380, 620 280, 710 260 C 800 240, 840 310, 820 400 C 800 480, 730 520, 670 510 C 580 490, 520 390, 490 280 C 470 210, 390 190, 310 210 C 230 230, 200 300, 210 330" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="6,6" />

  <!-- Start & Finish -->
  <rect x="625" y="560" width="30" height="16" fill="#16a34a" rx="2" />
  <text x="640" y="572" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">START</text>

  <rect x="200" y="315" width="34" height="16" fill="#dc2626" rx="2" />
  <text x="217" y="327" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">FINISH</text>

  <!-- Obstacle symbols with numbers -->
  <!-- 1: Vertical -->
  <g transform="translate(580, 430)">
    <line x1="-15" y1="0" x2="15" y2="0" stroke="#0f172a" stroke-width="5" />
    <circle cx="0" cy="-14" r="9" fill="#0f172a" />
    <text x="0" y="-11" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">1</text>
  </g>

  <!-- 2: Oxer -->
  <g transform="translate(420, 320)">
    <line x1="-15" y1="-3" x2="15" y2="-3" stroke="#0f172a" stroke-width="4" />
    <line x1="-15" y1="3" x2="15" y2="3" stroke="#0f172a" stroke-width="4" />
    <circle cx="0" cy="-15" r="9" fill="#0f172a" />
    <text x="0" y="-12" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">2</text>
  </g>

  <!-- 3: Vertical -->
  <g transform="translate(220, 380)">
    <line x1="0" y1="-15" x2="0" y2="15" stroke="#0f172a" stroke-width="5" />
    <circle cx="-16" cy="0" r="9" fill="#0f172a" />
    <text x="-16" y="3" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">3</text>
  </g>

  <!-- 4: Water Jump / Ría -->
  <g transform="translate(310, 550)">
    <rect x="-18" y="-8" width="36" height="16" fill="#38bdf8" stroke="#0f172a" stroke-width="2" rx="2" />
    <circle cx="0" cy="-18" r="9" fill="#0f172a" />
    <text x="0" y="-15" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">4</text>
  </g>

  <!-- 5a-5b: Double Combination -->
  <g transform="translate(530, 460)">
    <line x1="-12" y1="-10" x2="12" y2="-10" stroke="#0f172a" stroke-width="4" />
    <circle cx="-20" cy="-10" r="8" fill="#0f172a" />
    <text x="-20" y="-7" text-anchor="middle" fill="#ffffff" font-size="7" font-weight="800">5a</text>

    <line x1="-12" y1="15" x2="12" y2="15" stroke="#0f172a" stroke-width="4" />
    <circle cx="-20" cy="15" r="8" fill="#0f172a" />
    <text x="-20" y="18" text-anchor="middle" fill="#ffffff" font-size="7" font-weight="800">5b</text>
  </g>

  <!-- 6: Triple Bar -->
  <g transform="translate(710, 260)">
    <line x1="-15" y1="-5" x2="15" y2="-5" stroke="#0f172a" stroke-width="3" />
    <line x1="-15" y1="0" x2="15" y2="0" stroke="#0f172a" stroke-width="3" />
    <line x1="-15" y1="5" x2="15" y2="5" stroke="#0f172a" stroke-width="3" />
    <circle cx="0" cy="-16" r="9" fill="#0f172a" />
    <text x="0" y="-13" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">6</text>
  </g>

  <!-- 7: Oxer -->
  <g transform="translate(820, 400)">
    <line x1="-4" y1="-15" x2="-4" y2="15" stroke="#0f172a" stroke-width="4" />
    <line x1="4" y1="-15" x2="4" y2="15" stroke="#0f172a" stroke-width="4" />
    <circle cx="18" cy="0" r="9" fill="#0f172a" />
    <text x="18" y="3" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">7</text>
  </g>

  <!-- 8: Vertical -->
  <g transform="translate(670, 510)">
    <line x1="-15" y1="0" x2="15" y2="0" stroke="#0f172a" stroke-width="5" />
    <circle cx="0" cy="16" r="9" fill="#0f172a" />
    <text x="0" y="19" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">8</text>
  </g>

  <!-- 9: Oxer -->
  <g transform="translate(490, 280)">
    <line x1="-15" y1="-3" x2="15" y2="-3" stroke="#0f172a" stroke-width="4" />
    <line x1="-15" y1="3" x2="15" y2="3" stroke="#0f172a" stroke-width="4" />
    <circle cx="0" cy="-15" r="9" fill="#0f172a" />
    <text x="0" y="-12" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">9</text>
  </g>

  <!-- 10: Plancha / Wall -->
  <g transform="translate(310, 210)">
    <rect x="-16" y="-5" width="32" height="10" fill="#dc2626" stroke="#0f172a" stroke-width="2" />
    <circle cx="0" cy="-16" r="9" fill="#0f172a" />
    <text x="0" y="-13" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800">10</text>
  </g>

  <!-- Course Designer Tag -->
  <g transform="translate(80, 570)" font-size="10" fill="#475569">
    <text x="0" y="0" font-weight="700" fill="#0f172a">Course Designer:</text>
    <text x="0" y="14">Arq. Javier E. Larrea (FEI Level 3)</text>
    <text x="0" y="28">Assistants: E. Méndez / C. Rossi</text>
  </g>
</svg>
  `.trim());
}

