// Fuente de datos. Con FOOTBALL_DATA_KEY usa football-data.org (plan gratis);
// sin clave genera una temporada de EJEMPLO (resultados inventados) para probar.

const API = 'https://api.football-data.org/v4';

// --- Datos de ejemplo -------------------------------------------------------
const SAMPLE_LEAGUES = {
  'LaLiga (ejemplo)': [
    ['Real Madrid', 1.45], ['Barcelona', 1.5], ['Atlético de Madrid', 1.25], ['Athletic Club', 1.1],
    ['Villarreal', 1.1], ['Real Sociedad', 1.0], ['Real Betis', 1.0], ['Sevilla', 0.9],
    ['Valencia', 0.85], ['Getafe', 0.75],
  ],
  'Premier League (ejemplo)': [
    ['Manchester City', 1.45], ['Arsenal', 1.4], ['Liverpool', 1.45], ['Chelsea', 1.2],
    ['Tottenham', 1.1], ['Newcastle', 1.1], ['Aston Villa', 1.05], ['Manchester United', 1.0],
    ['Brighton', 0.95], ['Everton', 0.8],
  ],
  'Liga MX (ejemplo)': [
    ['América', 1.35], ['Monterrey', 1.25], ['Tigres', 1.25], ['Cruz Azul', 1.2],
    ['Toluca', 1.15], ['Guadalajara', 1.05], ['Pumas', 0.95], ['Santos Laguna', 0.85],
    ['Pachuca', 1.0], ['León', 0.95],
  ],
};

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function samplePoisson(lambda, r) {
  let k = 0, p = 1;
  const L = Math.exp(-lambda);
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

function sampleData() {
  const r = rng(42);
  const leagues = [];
  const start = new Date('2026-08-15');
  for (const [name, teams] of Object.entries(SAMPLE_LEAGUES)) {
    const results = [];
    let d = 0;
    for (const [h, sh] of teams) for (const [a, sa] of teams) {
      if (h === a || r() < 0.35) continue; // ~2/3 de la temporada ya jugada
      const date = new Date(start.getTime() + d++ * 86400000 / 3).toISOString().slice(0, 10);
      results.push({ date, home: h, away: a, hg: samplePoisson(1.45 * sh / sa, r), ag: samplePoisson(1.15 * sa / sh, r) });
    }
    const names = teams.map((t) => t[0]).sort(() => r() - 0.5);
    const fixtures = [];
    for (let i = 0; i < names.length; i += 2) fixtures.push({ home: names[i], away: names[i + 1], date: 'Próxima jornada' });
    leagues.push({ name, results, fixtures });
  }
  return leagues;
}

// --- football-data.org ------------------------------------------------------
async function fdGet(path, key) {
  const res = await fetch(API + path, { headers: { 'X-Auth-Token': key } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiData(key, codes) {
  const leagues = [];
  const today = new Date();
  const from = new Date(today.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const nowIso = today.toISOString().slice(0, 10);
  for (const code of codes) {
    const fin = await fdGet(`/competitions/${code}/matches?status=FINISHED&dateFrom=${from}&dateTo=${nowIso}`, key);
    const next = await fdGet(`/competitions/${code}/matches?status=SCHEDULED,TIMED&dateFrom=${nowIso}&dateTo=${to}`, key);
    const nm = (t) => t.shortName || t.name;
    leagues.push({
      name: fin.competition?.name || code,
      results: fin.matches.map((m) => ({
        date: m.utcDate.slice(0, 10), home: nm(m.homeTeam), away: nm(m.awayTeam),
        hg: m.score.fullTime.home, ag: m.score.fullTime.away,
      })),
      fixtures: next.matches.map((m) => ({
        home: nm(m.homeTeam), away: nm(m.awayTeam),
        date: new Date(m.utcDate).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      })),
    });
    await new Promise((r) => setTimeout(r, 6500)); // plan gratis: 10 peticiones/minuto
  }
  return leagues;
}

async function loadData() {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return { source: 'ejemplo', leagues: sampleData() };
  const codes = (process.env.LEAGUES || 'PD,PL').split(',').map((s) => s.trim());
  return { source: 'football-data.org', leagues: await apiData(key, codes) };
}

module.exports = { loadData };
