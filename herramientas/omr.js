// Lector de burbujas para la hoja de respuestas de la I.E. Antonia Santos.
// Plantilla en mm (origen: centro del cuadro superior izquierdo, y hacia abajo).
// Debe coincidir con hoja_omr.py.
const OMR = (() => {
  const T = {
    fid: [[0, 0], [180, 0], [180, 46], [0, 46]],
    aspect: 180 / 46,
    orient: [13, 0],
    r: 2.2,
    dec: { y: 7, x0: 40, dx: 6, n: 5 },
    uni: { y: 7, x0: 86, dx: 6, n: 10 },
    q: { x0: 14, dx: 8.2, n: 20, rows: [20, 26, 32, 38] },
  };
  const LET = ['A', 'B', 'C', 'D'];

  // Lista de burbujas con su posición en mm
  function burbujas() {
    const b = [];
    for (let i = 0; i < T.dec.n; i++) b.push({ tipo: 'dec', v: i, x: T.dec.x0 + i * T.dec.dx, y: T.dec.y });
    for (let i = 0; i < T.uni.n; i++) b.push({ tipo: 'uni', v: i, x: T.uni.x0 + i * T.uni.dx, y: T.uni.y });
    for (let q = 0; q < T.q.n; q++) for (let c = 0; c < 4; c++)
      b.push({ tipo: 'q', q, c, x: T.q.x0 + q * T.q.dx, y: T.q.rows[c] });
    return b;
  }

  // ---------- Umbral adaptativo con imagen integral ----------
  function binarizar(g, w, h) {
    const W1 = w + 1;
    const I = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
      let fila = 0;
      for (let x = 0; x < w; x++) {
        fila += g[y * w + x];
        I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + fila;
      }
    }
    const s = Math.max(15, Math.round(Math.max(w, h) / 24)) | 1;
    const r = s >> 1;
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const n = (y1 - y0) * (x1 - x0);
        const sum = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
        const v = g[y * w + x];
        bin[y * w + x] = (v * n < sum * 0.86 && v < 200) ? 1 : 0;
      }
    }
    return bin;
  }

  // ---------- Componentes conexas (manchas oscuras) ----------
  function componentes(bin, w, h) {
    const lab = new Int32Array(w * h);
    const pila = new Int32Array(w * h);
    const comps = [];
    let id = 0;
    for (let i = 0; i < w * h; i++) {
      if (!bin[i] || lab[i]) continue;
      id++;
      let top = 0; pila[top++] = i; lab[i] = id;
      let area = 0, sx = 0, sy = 0, sxx = 0, syy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
      while (top) {
        const p = pila[--top];
        const x = p % w, y = (p / w) | 0;
        area++; sx += x; sy += y; sxx += x * x; syy += y * y;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = id; pila[top++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = id; pila[top++] = p + 1; }
        if (y > 0 && bin[p - w] && !lab[p - w]) { lab[p - w] = id; pila[top++] = p - w; }
        if (y < h - 1 && bin[p + w] && !lab[p + w]) { lab[p + w] = id; pila[top++] = p + w; }
      }
      if (area < 30) continue;
      const cx = sx / area, cy = sy / area;
      const m = (sxx / area - cx * cx + syy / area - cy * cy) / area; // momento normalizado
      comps.push({ area, cx, cy, minx, maxx, miny, maxy, m });
    }
    return comps;
  }

  // ---------- Homografía (4 puntos) ----------
  function homografia(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const n = 8;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      if (Math.abs(A[c][c]) < 1e-12) return null;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const h = b.map((v, i) => v / A[i][i]);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }
  function aplicar(H, x, y) {
    const d = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
  }

  // Fracción de píxeles oscuros en un disco (en mm) de la plantilla
  function oscuridad(bin, w, h, H, xm, ym, rm) {
    let n = 0, o = 0;
    const K = 5;
    for (let i = -K; i <= K; i++) for (let j = -K; j <= K; j++) {
      if (i * i + j * j > K * K) continue;
      const [u, v] = aplicar(H, xm + (rm * i) / K, ym + (rm * j) / K);
      const px = Math.round(u), py = Math.round(v);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      n++; o += bin[py * w + px];
    }
    return n ? o / n : 0;
  }

  const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

  // ---------- Buscar los cuatro cuadros de esquina ----------
  // Puntos de control de la plantilla para comprobar un candidato:
  // anillos de las burbujas (deben verse oscuros) y huecos entre ellas (claros).
  const ANILLOS = [], HUECOS = [];
  (function () {
    for (let q = 0; q < T.q.n; q += 2) for (let c = 0; c < 4; c++) {
      const x = T.q.x0 + q * T.q.dx, y = T.q.rows[c];
      for (let a = 0; a < 8; a++) ANILLOS.push([x + T.r * Math.cos(a * Math.PI / 4), y + T.r * Math.sin(a * Math.PI / 4)]);
    }
    for (let q = 0; q < T.q.n - 1; q++) {
      if (q === 9) continue;
      const x = T.q.x0 + q * T.q.dx + T.q.dx / 2;
      for (const y of [23, 29, 35]) HUECOS.push([x, y]);
    }
    for (const x of [30, 60, 90, 120, 150]) HUECOS.push([x, 43.5]);
  })();
  function punto(bin, w, h, H, x, y) {
    const [u, v] = aplicar(H, x, y);
    const px = Math.round(u), py = Math.round(v);
    if (px < 0 || py < 0 || px >= w || py >= h) return 0.5;
    return bin[py * w + px];
  }
  function ajuste(bin, w, h, H) {
    // promedio en una pequeña cruz alrededor de cada punto (tolera desenfoque)
    let an = 0;
    for (const [x, y] of ANILLOS) an += Math.max(punto(bin, w, h, H, x, y), punto(bin, w, h, H, x * 1.002, y), punto(bin, w, h, H, x, y + 0.15));
    an /= ANILLOS.length;
    let hu = 0;
    for (const [x, y] of HUECOS) hu += punto(bin, w, h, H, x, y);
    hu /= HUECOS.length;
    const marca = oscuridad(bin, w, h, H, T.orient[0], T.orient[1], 1.2);
    const opuesta = oscuridad(bin, w, h, H, 180 - T.orient[0], 46 - T.orient[1], 1.2);
    return { valor: marca - opuesta + an - 2 * hu, marca, an, hu };
  }

  function buscarEsquinas(comps, bin, w, h) {
    const lado = Math.max(w, h);
    const cand = comps.filter((c) => {
      const bw = c.maxx - c.minx + 1, bh = c.maxy - c.miny + 1;
      if (bw < 8 || bh < 8 || bw > lado / 5 || bh > lado / 5) return false;
      if (c.minx === 0 || c.miny === 0 || c.maxx === w - 1 || c.maxy === h - 1) return false;
      const asp = bw / bh;
      return asp > 0.4 && asp < 2.5 && c.m > 0.145 && c.m < 0.21 && c.area / (bw * bh) > 0.45;
    }).sort((a, b) => b.area - a.area).slice(0, 16);

    let mejor = null;
    const n = cand.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
      const g = [cand[a], cand[b], cand[c], cand[d]];
      const areas = g.map((p) => p.area);
      if (Math.max(...areas) / Math.min(...areas) > 3.5) continue;
      const mx = (g[0].cx + g[1].cx + g[2].cx + g[3].cx) / 4, my = (g[0].cy + g[1].cy + g[2].cy + g[3].cy) / 4;
      g.sort((p, q) => Math.atan2(p.cy - my, p.cx - mx) - Math.atan2(q.cy - my, q.cx - mx));
      let conv = true, signo = 0;
      for (let i = 0; i < 4; i++) {
        const p = g[i], q = g[(i + 1) % 4], r = g[(i + 2) % 4];
        const s = Math.sign((q.cx - p.cx) * (r.cy - q.cy) - (q.cy - p.cy) * (r.cx - q.cx));
        if (!signo) signo = s; else if (s !== signo) { conv = false; break; }
      }
      if (!conv) continue;
      const L = [dist(g[0], g[1]), dist(g[1], g[2]), dist(g[2], g[3]), dist(g[3], g[0])];
      const r02 = L[0] / L[2], r13 = L[1] / L[3];
      if (r02 < 0.5 || r02 > 2 || r13 < 0.5 || r13 > 2) continue;
      const largo = L[0] + L[2] > L[1] + L[3];
      const asp = largo ? (L[0] + L[2]) / (L[1] + L[3]) : (L[1] + L[3]) / (L[0] + L[2]);
      if (asp < 2.3 || asp > 6.5) continue;
      const ancho = largo ? (L[0] + L[2]) / 2 : (L[1] + L[3]) / 2;
      const ladoMed = Math.sqrt(areas.reduce((s, v) => s + v, 0) / 4);
      const ladoEsp = ancho * 7 / 180;
      if (ladoMed < ladoEsp * 0.5 || ladoMed > ladoEsp * 1.8) continue;
      const ordenes = largo ? [[0, 1, 2, 3], [2, 3, 0, 1]] : [[1, 2, 3, 0], [3, 0, 1, 2]];
      for (const o of ordenes) {
        const dst = o.map((i) => [g[i].cx, g[i].cy]);
        const H = homografia(T.fid, dst);
        if (!H) continue;
        const f = ajuste(bin, w, h, H);
        if (!mejor || f.valor > mejor.f.valor) mejor = { H, dst, f };
      }
    }
    return mejor;
  }

  // ---------- Análisis completo ----------
  function analizar(g, w, h) {
    const bin = binarizar(g, w, h);
    const comps = componentes(bin, w, h);
    const elegido = buscarEsquinas(comps, bin, w, h);
    if (!elegido) return { ok: false, error: 'No encontré los cuatro cuadros negros de la hoja. Toma la foto de una sola tirilla completa, con buena luz y sin cortar las esquinas.' };
    if (elegido.f.marca < 0.5 || elegido.f.an < 0.35 || elegido.f.hu > 0.3) return { ok: false, error: 'La hoja no se ve con claridad. Repite la foto de una sola tirilla, de frente, con buena luz y sin sombras.' };
    const H = elegido.H;
    const lista = burbujas();
    for (const b of lista) {
      b.s = oscuridad(bin, w, h, H, b.x, b.y, 1.5);
      [b.u, b.v] = aplicar(H, b.x, b.y);
    }
    // Escala aproximada (píxeles por mm) para dibujar
    const [ax, ay] = aplicar(H, 0, 23), [bx, by] = aplicar(H, 180, 23);
    const pxmm = Math.hypot(bx - ax, by - ay) / 180;
    const MARCA = 0.42, DIF = 0.25;
    const decidir = (sc) => {
      const idx = sc.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
      if (idx[0][0] < MARCA) return { v: null, estado: 'vacia' };
      if (idx[1][0] >= MARCA && idx[0][0] - idx[1][0] < DIF) return { v: null, estado: 'multiple' };
      return { v: idx[0][1], estado: 'ok' };
    };
    const resp = [];
    for (let k = 0; k < T.q.n; k++) {
      const sc = LET.map((_, c) => lista.find((b) => b.tipo === 'q' && b.q === k && b.c === c).s);
      const d = decidir(sc);
      resp.push(d.estado === 'ok' ? LET[d.v] : d.estado === 'multiple' ? '*' : '-');
    }
    const dec = decidir(lista.filter((b) => b.tipo === 'dec').map((b) => b.s));
    const uni = decidir(lista.filter((b) => b.tipo === 'uni').map((b) => b.s));
    let numero = null;
    if (uni.estado === 'ok' && dec.estado !== 'multiple') numero = (dec.estado === 'ok' ? dec.v * 10 : 0) + uni.v;
    return {
      ok: true, respuestas: resp.join(''), numero, burbujas: lista, pxmm,
      esquinas: elegido.dst, estadoNumero: { dec: dec.estado, uni: uni.estado },
    };
  }

  // Imagen (canvas) -> gris, reducida a un lado máximo
  function grisDeCanvas(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data;
    const g = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    return g;
  }

  return { T, LET, analizar, grisDeCanvas, aplicar, burbujas };
})();
if (typeof module !== 'undefined') module.exports = OMR;
