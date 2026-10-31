// Netlify sets BRANCH. main may only build against the explicitly designated TEST project.
if (process.env.BRANCH === 'main') {
  const expected = 'https://slophgtrynlfesjonbzf.supabase.co';
  if (process.env.VITE_SUPABASE_URL?.replace(/\/$/, '') !== expected) {
    throw new Error('Build detenido: main debe usar Supabase TEST. Revisar variables del contexto main en Netlify.');
  }
}
