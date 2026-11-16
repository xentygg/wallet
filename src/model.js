// Modelo de Poisson: fuerza de ataque/defensa de cada equipo a partir de resultados
// pasados, y de ahí la probabilidad de cada marcador.

const MAX_GOALS = 8;
const SHRINK = 5; // partidos "virtuales" de liga promedio para no exagerar con pocas muestras

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function buildStrengths(results) {
  const t = {};
  const get = (n) => (t[n] ??= { hs: 0, hc: 0, hn: 0, as: 0, ac: 0, an: 0, form: [] });
  let hg = 0, ag = 0;
  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
  for (const r of sorted) {
    const h = get(r.home), a = get(r.away);
    h.hs += r.hg; h.hc += r.ag; h.hn++;
    a.as += r.ag; a.ac += r.hg; a.an++;
    hg += r.hg; ag += r.ag;
    h.form.push(r.hg > r.ag ? 'V' : r.hg === r.ag ? 'E' : 'D');
    a.form.push(r.ag > r.hg ? 'V' : r.ag === r.hg ? 'E' : 'D');
  }
  const n = sorted.length || 1;
  const avgH = hg / n || 1.5, avgA = ag / n || 1.2;
  const ratio = (sum, cnt, avg) => (sum + SHRINK * avg) / ((cnt + SHRINK) * avg);
  const teams = {};
  for (const [name, s] of Object.entries(t)) {
    teams[name] = {
      name,
      attHome: ratio(s.hs, s.hn, avgH), defHome: ratio(s.hc, s.hn, avgA),
      attAway: ratio(s.as, s.an, avgA), defAway: ratio(s.ac, s.an, avgH),
      played: s.hn + s.an,
      gf: s.hs + s.as, ga: s.hc + s.ac,
      form: s.form.slice(-5),
    };
  }
  return { teams, avgH, avgA };
}

function predict(model, home, away) {
  const H = model.teams[home], A = model.teams[away];
  if (!H || !A) return null;
  const lh = model.avgH * H.attHome * A.defAway;
  const la = model.avgA * A.attAway * H.defHome;
  let pH = 0, pD = 0, pA = 0, over25 = 0, over15 = 0, btts = 0;
  const scores = [];
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poisson(i, lh) * poisson(j, la);
      if (i > j) pH += p; else if (i === j) pD += p; else pA += p;
      if (i + j > 2.5) over25 += p;
      if (i + j > 1.5) over15 += p;
      if (i > 0 && j > 0) btts += p;
      scores.push({ score: `${i}-${j}`, p });
    }
  }
  const tot = pH + pD + pA; // normaliza lo que queda fuera de MAX_GOALS
  scores.sort((a, b) => b.p - a.p);
  return {
    home: H, away: A,
    xg: { home: lh, away: la },
    p1: pH / tot, px: pD / tot, p2: pA / tot,
    over15: over15 / tot, over25: over25 / tot, btts: btts / tot,
    topScores: scores.slice(0, 3).map((s) => ({ score: s.score, p: s.p / tot })),
  };
}

module.exports = { buildStrengths, predict };
