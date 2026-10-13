/* ==========================================================================
   PIXELART.JS - HIGH-RESOLUTION NORTON COMMANDER ANSI / CP437 TILE ENGINE (v6)
   Strictly NO photos. Renders 88x52 subpixel + shaded-tile (█ ▀ ▄ ▓ ▒ ░)
   hardware illustrations with full foreground + background VGA cell attributes
   AND per-product procedural variance so every single item in a category looks
   distinct and tailored to its real-world model, form factor, and specs!
   ========================================================================== */

const ART_CACHE = new Map();

/**
 * Deterministic hash & spec extractor for any product in CENTRAL_CATALOG
 */
function getProductSeed(prod) {
  if (!prod) return { hash: 42, idx: 0, text: '' };
  const str = `${prod.id || ''}|${prod.sku || ''}|${prod.name || ''}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hash = Math.abs(h >>> 0);
  return {
    hash,
    pick(arr, shift = 0) {
      return arr[(hash >>> shift) % arr.length];
    },
    num(min, max, shift = 0) {
      return min + ((hash >>> shift) % (max - min + 1));
    }
  };
}

function shortModelTag(prod, fallback = 'AI PRO') {
  if (!prod || !prod.name) return fallback;
  const n = prod.name;
  // Match well-known GPU/CPU/SSD/RAM/NIC identifiers
  const patterns = [
    /RTX\s*PRO\s*\d{4}\s*(?:Blackwell|Max-Q)?/i,
    /RTX\s*\d{4}\s*(?:Ada|Ti|SUPER|SFF)?/i,
    /R9700|W7900|W7800|RX\s*9070\s*XT|RX\s*9070|MI300X/i,
    /EPYC\s*\d{4}[A-Z]*/i,
    /9995WX|9985WX|9975WX|9965WX|9980X|9970X|9960X|7995WX|7985WX/i,
    /9950X3D|9950X|9900X3D|9900X|9800X3D|9700X|9600X/i,
    /Xeon\s*[A-Z0-9-]+/i,
    /WRX90E|W890E|TRX50|W790E|X870E|Z890|B850/i,
    /ConnectX-[678]|MCX[0-9A-Z]+|9500-\d+i|9600-\d+i|9361-\d+i/i,
    /GX10|AI\s*TOP\s*ATOM|PGX|EdgeXpert|GB300|GB10/i
  ];
  for (const rx of patterns) {
    const m = n.match(rx);
    if (m) return m[0].toUpperCase().slice(0, 16);
  }
  if (prod.model) return String(prod.model).toUpperCase().slice(0, 14);
  return (prod.sku || fallback).toUpperCase().slice(0, 14);
}

/**
 * 2D Subpixel + ANSI Tile Canvas
 * Width: W columns (88)
 * Subpixel Height: H_SUB rows (52) -> 26 terminal character rows
 */
class AnsiCanvas {
  constructor(w = 88, hSub = 52) {
    this.w = w;
    this.hSub = hSub;
    this.rows = hSub >> 1;
    this.sub = new Array(w * hSub).fill(null);
    this.ovr = new Array(w * this.rows).fill(null);
  }

  pset(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.hSub) return;
    this.sub[y * this.w + x] = color;
  }

  pget(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.hSub) return null;
    return this.sub[y * this.w + x];
  }

  fillRect(x, y, w, h, color) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.hSub, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      const rowOff = py * this.w;
      for (let px = x0; px < x1; px++) {
        this.sub[rowOff + px] = color;
      }
    }
  }

  bevelRect(x, y, w, h, fill, topLight, botDark, rim = null) {
    if (rim) {
      this.fillRect(x, y, w, h, rim);
      x += 1; y += 1; w -= 2; h -= 2;
    }
    this.fillRect(x, y, w, h, fill);
    this.fillRect(x, y, w, 1, topLight);
    this.fillRect(x, y, 1, h, topLight);
    this.fillRect(x, y + h - 1, w, 1, botDark);
    this.fillRect(x + w - 1, y, 1, h, botDark);
  }

  line(x0, y0, x1, y1, color, thickness = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      for (let ty = 0; ty < thickness; ty++) {
        for (let tx = 0; tx < thickness; tx++) {
          this.pset(x0 + tx, y0 + ty, color);
        }
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  fillCircle(cx, cy, r, color, aspectX = 1.15) {
    const rx = r * aspectX;
    const ry = r;
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          this.pset(px, py, color);
        }
      }
    }
  }

  ring(cx, cy, rOuter, rInner, color, aspectX = 1.15) {
    const rxO = rOuter * aspectX, ryO = rOuter;
    const rxI = rInner * aspectX, ryI = rInner;
    const x0 = Math.floor(cx - rxO - 1), x1 = Math.ceil(cx + rxO + 1);
    const y0 = Math.floor(cy - ryO - 1), y1 = Math.ceil(cy + ryO + 1);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dO = ((px - cx) / rxO) ** 2 + ((py - cy) / ryO) ** 2;
        const dI = ((px - cx) / rxI) ** 2 + ((py - cy) / ryI) ** 2;
        if (dO <= 1.0 && dI >= 1.0) {
          this.pset(px, py, color);
        }
      }
    }
  }

  // Draw a multi-blade axial or radial cooling fan with customizable blade count & rotation phase!
  drawFan(cx, cy, r, opts = {}) {
    const {
      housingBg = '#141923',
      ringLight = '#8fa4bd',
      ringDark = '#3a4659',
      bladeLight = '#6c7d93',
      bladeMid = '#465366',
      bladeDark = '#262f3d',
      hubColor = '#cfd8dc',
      hubCenter = '#d4af37',
      blades = 9,
      phaseOffset = 0,
      swirl = 0.95,
      aspectX = 1.18
    } = opts;

    this.fillCircle(cx, cy, r + 1.2, ringDark, aspectX);
    this.fillCircle(cx, cy, r, housingBg, aspectX);

    const rx = (r - 1.0) * aspectX;
    const ry = r - 1.0;
    for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py++) {
      for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
        const dx = (px - cx) / aspectX;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= r - 0.8 && dist >= r * 0.28) {
          const angle = Math.atan2(dy, dx) + (dist / r) * swirl + phaseOffset;
          const phase = ((angle / (Math.PI * 2)) * blades + 100) % 1;
          if (phase < 0.34) {
            this.pset(px, py, bladeLight);
          } else if (phase < 0.62) {
            this.pset(px, py, bladeMid);
          } else if (phase < 0.78) {
            this.pset(px, py, bladeDark);
          }
        }
      }
    }

    const rxO = r * aspectX;
    for (let deg = 0; deg < 360; deg += 2) {
      const rad = (deg * Math.PI) / 180;
      const px = cx + Math.cos(rad) * rxO;
      const py = cy + Math.sin(rad) * r;
      const isLit = deg >= 195 || deg <= 25;
      this.pset(px, py, isLit ? ringLight : ringDark);
    }

    const hubR = Math.max(2.2, r * 0.31);
    this.fillCircle(cx, cy, hubR, hubColor, aspectX);
    this.fillCircle(cx, cy, Math.max(1.2, hubR * 0.55), hubCenter, aspectX);
  }

  setTile(col, row, ch, fg, bg = null) {
    col = Math.round(col);
    row = Math.round(row);
    if (col < 0 || col >= this.w || row < 0 || row >= this.rows) return;
    if (!bg) {
      bg = this.pget(col, row * 2) || this.pget(col, row * 2 + 1) || '#182232';
    }
    this.ovr[row * this.w + col] = { ch, fg, bg };
  }

  text(col, row, str, fg = '#ffffff', bg = null) {
    col = Math.round(col);
    row = Math.round(row);
    for (let i = 0; i < str.length; i++) {
      this.setTile(col + i, row, str[i], fg, bg);
    }
  }

  drawPCIeEdge(xStart, ySub, width = 46) {
    this.fillRect(xStart, ySub, width, 2, '#1f4e3d');
    const notchX = xStart + 9;
    this.fillRect(xStart + 1, ySub + 1, notchX - xStart - 1, 3, '#f5b800');
    this.fillRect(notchX + 2, ySub + 1, width - (notchX - xStart) - 4, 3, '#f5b800');
    this.fillRect(xStart + width + 1, ySub, 4, 2, '#8fa4bd');
    this.fillRect(xStart + width + 3, ySub + 2, 3, 2, '#8fa4bd');
    const termRow = Math.floor((ySub + 2) / 2);
    for (let c = xStart + 1; c < xStart + width - 2; c++) {
      if (c === notchX || c === notchX + 1) continue;
      this.setTile(c, termRow, c % 2 === 0 ? '█' : '▓', '#f5b800', '#9e7400');
    }
  }

  drawIOBracket(x, yTopSub, yBotSub) {
    this.fillRect(x - 3, yTopSub - 2, 6, 2, '#e2e8f0');
    this.fillRect(x - 2, yTopSub - 1, 2, 1, '#64748b');
    this.fillRect(x, yTopSub, 4, yBotSub - yTopSub, '#cbd5e1');
    this.fillRect(x, yTopSub, 1, yBotSub - yTopSub, '#f8fafc');
    this.fillRect(x + 3, yTopSub, 1, yBotSub - yTopSub, '#64748b');
    for (let py = yTopSub + 4; py < yBotSub - 6; py += 6) {
      this.fillRect(x + 1, py, 2, 4, '#0f172a');
      this.fillRect(x + 1, py, 2, 1, '#94a3b8');
    }
    this.fillRect(x, yBotSub, 2, 4, '#cbd5e1');
    this.fillRect(x + 3, yBotSub, 1, 3, '#94a3b8');
  }

  toHTML() {
    const outLines = [];
    for (let r = 0; r < this.rows; r++) {
      let lineHTML = '';
      let curFg = null;
      let curBg = null;
      let curChars = '';

      const flush = () => {
        if (!curChars) return;
        let style = '';
        if (curFg) style += `color:${curFg};`;
        if (curBg) style += `background:${curBg};`;
        if (style) {
          lineHTML += `<span style="${style}">${curChars}</span>`;
        } else {
          lineHTML += curChars;
        }
        curChars = '';
      };

      for (let c = 0; c < this.w; c++) {
        const ov = this.ovr[r * this.w + c];
        let ch = ' ';
        let fg = null;
        let bg = null;

        if (ov) {
          ch = ov.ch;
          fg = ov.fg;
          bg = ov.bg;
        } else {
          const top = this.sub[(r * 2) * this.w + c];
          const bot = this.sub[(r * 2 + 1) * this.w + c];
          if (!top && !bot) {
            ch = '·';
            fg = '#0e1b33';
            bg = null;
          } else if (top && !bot) {
            ch = '▀';
            fg = top;
            bg = null;
          } else if (!top && bot) {
            ch = '▄';
            fg = bot;
            bg = null;
          } else if (top === bot) {
            ch = '█';
            fg = top;
            bg = null;
          } else {
            ch = '▀';
            fg = top;
            bg = bot;
          }
        }

        if (fg === curFg && bg === curBg) {
          curChars += ch;
        } else {
          flush();
          curFg = fg;
          curBg = bg;
          curChars = ch;
        }
      }
      flush();
      outLines.push(lineHTML);
    }
    return outLines.join('\n');
  }
}

/* ==========================================================================
   14 HIGH-RESOLUTION HARDWARE RENDERERS WITH RICH PER-PRODUCT VARIANCE
   ========================================================================== */

// 1. WORKSTATION BLOWER GPU (Varies length/SFF form factor, frame palette, fin angle, fan blades, VRAM & model)
function drawGpuBlower(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isRadeon = variant === 'gpu-radeon' || /radeon|amd|r9700|w7900|w7800/i.test(name);
  const isCompactSFF = /2000|4000|sff|low profile|a1000|a400/i.test(name);
  const isServerPassive = /server edition|h100|h200|l40s/i.test(name) && !/max-q/i.test(name);

  // 6 distinct workstation color schemes so cycling through GPUs visibly changes trim & finish!
  const schemes = isRadeon
    ? [
        { main: '#e63946', light: '#ff8fa3', dark: '#800f2f', body: '#1e2533', hub: '#e63946' }, // Radeon Crimson
        { main: '#f97316', light: '#fdba74', dark: '#7c2d12', body: '#1c1917', hub: '#f97316' }, // Radeon Ruby/Amber
        { main: '#0284c7', light: '#7dd3fc', dark: '#0c4a6e', body: '#1e293b', hub: '#38bdf8' }  // Radeon PRO Blue
      ]
    : [
        { main: '#d4af37', light: '#fef08a', dark: '#854d0e', body: '#1e2533', hub: '#76b900' }, // Blackwell Champagne Gold
        { main: '#94a3b8', light: '#f8fafc', dark: '#334155', body: '#18181b', hub: '#76b900' }, // RTX Ada Titanium Silver
        { main: '#10b981', light: '#6ee7b7', dark: '#065f46', body: '#111827', hub: '#f5b800' }, // PNY Emerald Pro
        { main: '#eab308', light: '#fef9c3', dark: '#713f12', body: '#1f2937', hub: '#22c55e' }, // Quadro / Pro Gold
        { main: '#64748b', light: '#cbd5e1', dark: '#1e293b', body: '#0f172a', hub: '#38bdf8' }  // Stealth Server Edition
      ];
  const sc = (/6000/i.test(name) && !isServerPassive) ? schemes[0] : seed.pick(schemes);

  const x0 = isCompactSFF ? 17 : 11;
  const wCard = isCompactSFF ? 56 : 70;
  const y0 = isCompactSFF ? 12 : 8;
  const hCard = isCompactSFF ? 28 : 34;

  // Drop shadow & PCIe I/O bracket
  cv.fillRect(x0 + 1, y0 + 2, wCard, hCard, '#060911');
  cv.drawIOBracket(x0 - 4, y0, y0 + hCard + 1);

  // Outer metallic shroud
  cv.bevelRect(x0, y0, wCard, hCard, sc.body, sc.light, sc.dark, sc.main);
  cv.fillRect(x0 + 1, y0 + 1, wCard - 2, 3, sc.main);
  cv.fillRect(x0 + 1, y0 + hCard - 4, wCard - 2, 3, sc.main);

  // Diagonal chamfered shroud bridge with per-product x-offset & slope
  const bridgeX = x0 + Math.floor(wCard * 0.46) + seed.num(-3, 3, 2);
  const slopeDir = seed.pick([0.35, -0.3, 0.0], 4);
  for (let dy = 0; dy < hCard - 8; dy++) {
    const bx = bridgeX + Math.floor(dy * slopeDir);
    cv.fillRect(bx, y0 + 4 + dy, 3, 1, sc.main);
    cv.pset(bx, y0 + 4 + dy, sc.light);
  }

  // Left-center recessed fin window with 4 different fin styles!
  const finChars = seed.pick([['▒', '░'], ['║', '│'], ['╱', '▒'], ['▓', '░']], 6);
  const finW = bridgeX - x0 - 6;
  cv.bevelRect(x0 + 4, y0 + 6, finW, hCard - 12, '#0f141e', '#090d14', '#334155');
  const rStart = Math.ceil((y0 + 7) / 2);
  const rEnd = Math.floor((y0 + hCard - 8) / 2);
  for (let r = rStart; r <= rEnd; r++) {
    for (let c = x0 + 5; c < x0 + 3 + finW; c++) {
      const idx = (c + r * seed.num(1, 2, 8)) % 2;
      cv.setTile(c, r, finChars[idx], idx === 0 ? '#94a3b8' : '#475569', '#0f141e');
    }
  }
  // Variable number of copper heatpipes (1, 2, or 3)
  const numPipes = seed.num(1, 3, 9);
  for (let p = 0; p < numPipes; p++) {
    const pr = rStart + 2 + p * 3;
    if (pr <= rEnd) {
      for (let c = x0 + 6; c < x0 + 2 + finW; c++) {
        cv.setTile(c, pr, '═', '#f59e0b', '#161e2e');
      }
    }
  }

  // Right side: either passive server airflow tunnel OR radial blower turbine with rotating blades!
  if (isServerPassive) {
    cv.bevelRect(bridgeX + 5, y0 + 6, x0 + wCard - bridgeX - 9, hCard - 12, '#111827', '#f5b800', '#374151');
    for (let r = rStart; r <= rEnd; r++) {
      cv.text(bridgeX + 7, r, '══════[ PASSIVE SERVER AIRFLOW ]══════'.slice(0, x0 + wCard - bridgeX - 12), '#cbd5e1', '#111827');
    }
  } else {
    const fanX = x0 + wCard - (isCompactSFF ? 14 : 17);
    const fanY = y0 + Math.floor(hCard / 2) + 1;
    const fanR = isCompactSFF ? 8.5 : 11.0;
    cv.drawFan(fanX, fanY, fanR, {
      housingBg: '#0b0f17',
      ringLight: sc.light,
      ringDark: sc.dark,
      bladeLight: '#cbd5e1',
      bladeMid: '#64748b',
      bladeDark: '#1e293b',
      hubColor: '#f8fafc',
      hubCenter: sc.hub,
      blades: seed.pick([9, 11, 13], 3),
      phaseOffset: (seed.hash % 360) * (Math.PI / 180)
    });
  }

  // Power header on top right
  cv.text(x0 + wCard - 12, Math.floor(y0 / 2), '⟦░░░░░⟧', '#f5b800', '#0f172a');

  // Dynamic model & VRAM badge silkscreened on the shroud
  const modelTag = shortModelTag(prod, isRadeon ? 'RADEON PRO' : 'RTX PRO');
  const vramMatch = name.match(/(\d+\s*GB)/i);
  const vramTag = vramMatch ? vramMatch[1].toUpperCase() : 'ECC GDDR';
  const mfgTag = (prod && prod.manufacturer) ? prod.manufacturer.toUpperCase() : 'NVIDIA';

  cv.text(x0 + 5, Math.floor(y0 / 2) + 1, ` ${modelTag} `, '#0f172a', sc.main);
  cv.text(x0 + 5, Math.floor((y0 + hCard) / 2) - 1, ` ${mfgTag} // ${vramTag} `, '#ffffff', sc.dark);

  cv.drawPCIeEdge(x0 + 6, y0 + hCard, isCompactSFF ? 36 : 48);
}

// 2. TRIPLE-FAN / DUAL-FAN GAMING & WORKSTATION GPU (Varies 2 vs 3 fans, shroud armor, RGB bar, fan angle & brand)
function drawGpuTriple(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isWhite = /white|aero|ice|glacier/i.test(name);
  const isRadeon = /radeon|rx\s*9070|rx\s*7900/i.test(name);
  const isDualFan = /dual|twin|2x|ventus 2x/i.test(name) || (!/5090|5080|astral|aorus|suprim|tuf/i.test(name) && seed.num(0, 4, 1) === 0);

  // Shroud themes based on manufacturer & model
  const themes = [
    { main: '#1e293b', light: '#64748b', dark: '#090d16', accent: '#00f5d4', hub: '#76b900' }, // ROG / Astral Cyan
    { main: '#27272a', light: '#a1a1aa', dark: '#09090b', accent: '#f59e0b', hub: '#f59e0b' }, // TUF Gaming Amber/Gunmetal
    { main: '#334155', light: '#cbd5e1', dark: '#0f172a', accent: '#38bdf8', hub: '#38bdf8' }, // MSI Ventus Brushed Silver
    { main: '#1c1917', light: '#78716c', dark: '#0c0a09', accent: '#f97316', hub: '#f97316' }, // GIGABYTE WindForce Bronze
    { main: '#18181b', light: '#71717a', dark: '#09090b', accent: '#a855f7', hub: '#a855f7' }  // PNY XLR8 Violet
  ];
  let th = seed.pick(themes, 2);
  if (isWhite) {
    th = { main: '#cbd5e1', light: '#ffffff', dark: '#64748b', accent: '#38bdf8', hub: '#0284c7' };
  } else if (isRadeon) {
    th = { main: '#1f2430', light: '#94a3b8', dark: '#090d16', accent: '#ef4444', hub: '#ef4444' };
  }

  const x0 = isDualFan ? 14 : 9;
  const wCard = isDualFan ? 60 : 74;

  cv.drawIOBracket(x0 - 4, 7, 43);
  cv.bevelRect(x0, 7, wCard, 35, th.main, th.light, th.dark, '#475569');

  // Decorative armor stripes across shroud face (varies per product)
  const stripeStyle = seed.num(0, 2, 5);
  if (stripeStyle === 0) {
    cv.fillRect(x0 + 2, 11, wCard - 4, 2, th.accent);
    cv.fillRect(x0 + 2, 37, wCard - 4, 2, th.accent);
  } else if (stripeStyle === 1) {
    for (let dy = 0; dy < 28; dy += 2) {
      cv.fillRect(x0 + 4 + dy, 10 + dy, 3, 2, th.accent);
      cv.fillRect(x0 + wCard - 8 - dy, 10 + dy, 3, 2, th.accent);
    }
  }

  // Top RGB Lightbar with 4 distinct gradient palettes
  const rgbPalettes = [
    ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5'],
    ['#ff595e', '#ffca3a', '#8ac926', '#1982c4'],
    ['#f59e0b', '#fbbf24', '#fef08a', '#f59e0b'],
    ['#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4']
  ];
  const rgbPal = seed.pick(rgbPalettes, 3);
  for (let c = x0 + 2; c < x0 + 34; c++) {
    const colHex = rgbPal[(c + seed.hash) % rgbPal.length];
    cv.setTile(c, 4, '▀', colHex, '#0f172a');
  }

  // Model & Manufacturer nameplate on top bar
  const modelTag = shortModelTag(prod, isRadeon ? 'RADEON RX' : 'GEFORCE RTX');
  cv.text(x0 + 35, 4, ` ${modelTag} `, '#ffffff', isRadeon ? '#b91c1c' : '#15803d');

  // Exposed heatsink fin stack + copper heatpipes along row 19
  const finChar = seed.pick(['║', '│', '▒', '╫'], 7);
  for (let c = x0 + 2; c < x0 + wCard - 2; c++) {
    cv.setTile(c, 19, finChar, '#94a3b8', '#0f172a');
  }
  cv.text(x0 + 4, 19, '══════', '#f59e0b', '#0f172a');
  cv.text(x0 + wCard - 12, 19, '══════', '#f59e0b', '#0f172a');

  // Either 2 large 110mm fans (Dual-Fan) or 3 axial fans (Triple-Fan) with rotating blade phase!
  const phase = (seed.hash % 360) * (Math.PI / 180);
  const numBlades = seed.pick([7, 9, 11], 4);
  if (isDualFan) {
    [x0 + 17, x0 + 43].forEach((fx, i) => {
      cv.drawFan(fx, 24, 10.6, {
        housingBg: isWhite ? '#1e293b' : '#090d16',
        ringLight: th.light,
        ringDark: '#334155',
        bladeLight: isWhite ? '#f8fafc' : '#cbd5e1',
        bladeMid: '#64748b',
        bladeDark: '#1e293b',
        hubColor: '#e2e8f0',
        hubCenter: i === 0 ? th.hub : th.accent,
        blades: numBlades,
        phaseOffset: phase + i * 0.5
      });
    });
  } else {
    [x0 + 13, x0 + 37, x0 + 61].forEach((fx, i) => {
      // Middle fan counter-rotates on many flagship GPUs!
      cv.drawFan(fx, 24, 9.2, {
        housingBg: isWhite ? '#1e293b' : '#090d16',
        ringLight: th.light,
        ringDark: '#334155',
        bladeLight: isWhite ? '#f8fafc' : '#cbd5e1',
        bladeMid: '#64748b',
        bladeDark: '#1e293b',
        hubColor: '#e2e8f0',
        hubCenter: i === 1 ? th.accent : th.hub,
        blades: numBlades,
        swirl: i === 1 ? -0.95 : 0.95,
        phaseOffset: phase + i * 0.4
      });
    });
  }

  cv.drawPCIeEdge(x0 + 6, 42, isDualFan ? 40 : 48);
}

// 3. MULTI-CORE PROCESSOR (Varies between Rectangular SP5/sTR5 Server IHS, Notched AM5 Octagram IHS, and Intel LGA IHS)
function drawCpuChip(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isIntel = variant === 'cpu-intel' || /intel|xeon|ultra|core/i.test(name);
  const isEpycOrTr = /epyc|threadripper|sp5|str5|wrx/i.test(name);

  // Substrate color variations (Emerald Green, Deep Teal, Forest Green, or Intel Cobalt/Sapphire)
  const pcbPalettes = isIntel
    ? [
        { main: '#0d47a1', light: '#42a5f5', dark: '#06214d', rim: '#64b5f6' },
        { main: '#155e75', light: '#38bdf8', dark: '#083344', rim: '#22d3ee' }
      ]
    : [
        { main: '#0f5132', light: '#2ecc71', dark: '#062819', rim: '#34d399' },
        { main: '#115e59', light: '#2dd4bf', dark: '#042f2e', rim: '#14b8a6' },
        { main: '#14532d', light: '#4ade80', dark: '#052e16', rim: '#22c55e' }
      ];
  const pcb = seed.pick(pcbPalettes, 1);

  // SP5 / Threadripper chips are wide rectangular packages; AM5 Ryzen chips are square!
  const xSub = isEpycOrTr ? 10 : 16;
  const wSub = isEpycOrTr ? 68 : 56;
  cv.fillRect(xSub + 2, 6, wSub, 42, '#060a12');
  cv.bevelRect(xSub, 4, wSub, 42, pcb.main, pcb.light, pcb.dark, pcb.rim);

  // Substrate alignment notches
  cv.fillRect(xSub, 22, 2, 6, '#040711');
  cv.fillRect(xSub + wSub - 2, 22, 2, 6, '#040711');

  // Circuit trace pattern varies by product seed
  const traceMod = seed.num(4, 7, 3);
  for (let r = 3; r <= 20; r++) {
    for (let c = xSub + 2; c <= xSub + wSub - 3; c++) {
      if ((c + r * seed.num(2, 4, 5)) % traceMod === 0) {
        cv.setTile(c, r, '░', pcb.light, pcb.main);
      }
    }
  }

  // Perimeter SMD gold capacitors
  const capStep = seed.num(2, 4, 2);
  for (let c = xSub + 5; c <= xSub + wSub - 6; c += capStep) {
    cv.setTile(c, 3, '▪', '#f5b800', '#78350f');
    cv.setTile(c, 20, '▪', '#f5b800', '#78350f');
  }
  for (let r = 5; r <= 18; r += 2) {
    cv.setTile(xSub + 2, r, '▐', '#f5b800', '#78350f');
    cv.setTile(xSub + wSub - 3, r, '▌', '#f5b800', '#78350f');
  }
  cv.text(xSub + 2, 21, '◣PIN1', '#f5b800', pcb.main);

  // IHS Geometry: Wide Rectangular Server IHS (EPYC/TR) vs Octagram Notched Square IHS (Ryzen AM5) vs Elongated Intel IHS
  const xIhs = isEpycOrTr ? 16 : 23;
  const wIhs = isEpycOrTr ? 56 : 42;
  cv.bevelRect(xIhs, 8, wIhs, 32, '#94a3b8', '#f8fafc', '#334155');

  if (!isIntel && !isEpycOrTr) {
    // Ryzen AM5 8-tab octagram cutouts showing SMD caps in the notches
    cv.fillRect(xIhs, 13, 4, 5, pcb.main);
    cv.fillRect(xIhs, 30, 4, 5, pcb.main);
    cv.fillRect(xIhs + wIhs - 4, 13, 4, 5, pcb.main);
    cv.fillRect(xIhs + wIhs - 4, 30, 4, 5, pcb.main);
    cv.fillRect(xIhs + 10, 8, 5, 3, pcb.main);
    cv.fillRect(xIhs + wIhs - 15, 8, 5, 3, pcb.main);
  } else if (isEpycOrTr) {
    // EPYC / Threadripper stepped side ears & alignment holes
    cv.setTile(xIhs + 2, 6, '◯', '#0f172a', '#94a3b8');
    cv.setTile(xIhs + wIhs - 3, 6, '◯', '#0f172a', '#94a3b8');
    cv.setTile(xIhs + 2, 17, '◯', '#0f172a', '#94a3b8');
    cv.setTile(xIhs + wIhs - 3, 17, '◯', '#0f172a', '#94a3b8');
  }

  // Raised Brushed Nickel Center Lid
  cv.bevelRect(xIhs + 4, 11, wIhs - 8, 26, '#cbd5e1', '#ffffff', '#475569');
  const sheenMod = seed.num(6, 11, 4);
  for (let r = 6; r <= 17; r++) {
    for (let c = xIhs + 5; c <= xIhs + wIhs - 6; c++) {
      const sheen = (c + r * 2 + seed.hash) % sheenMod < 3 ? '#f1f5f9' : '#cbd5e1';
      cv.setTile(c, r, '░', sheen, '#94a3b8');
    }
  }

  // Extract exact CPU model & core count for laser-etched markings!
  const modelTag = shortModelTag(prod, isIntel ? 'INTEL XEON' : 'AMD EPYC');
  const coreMatch = name.match(/(\d+)\s*[-]?\s*Core/i);
  const coreStr = coreMatch ? `${coreMatch[1]}-CORE` : (isEpycOrTr ? 'SERVER CPU' : 'DESKTOP CPU');
  const ghzMatch = name.match(/(\d+(?:\.\d+)?)\s*GHz/i);
  const ghzStr = ghzMatch ? `${ghzMatch[1]}GHz` : 'TURBO';

  const tx = xIhs + 6;
  cv.text(tx, 7, isIntel ? ' ◈ INTEL XEON ' : (isEpycOrTr ? ' ◢◣ AMD SERVER ' : ' ◢◣ AMD RYZEN '), '#ffffff', isIntel ? '#0284c7' : '#ea580c');
  cv.text(tx, 9, ` ${modelTag} `, '#0f172a', '#f8fafc');
  cv.text(tx, 11, ` ${coreStr} // ${ghzStr} `, '#1e293b', '#e2e8f0');

  // Visual CCD chiplet die map etched at bottom of IHS (varies by core count!)
  const numChiplets = coreMatch ? Math.min(8, Math.max(2, Math.ceil(Number(coreMatch[1]) / 16))) : 4;
  let chipletBar = '';
  for (let i = 0; i < numChiplets; i++) chipletBar += '▣ ';
  cv.text(tx, 14, ` DIE: ${chipletBar.trim()} `, '#0f172a', '#94a3b8');
  cv.text(tx, 16, ` S/N:${(prod.sku || 'CPU').slice(-8)} `, '#334155', '#cbd5e1');

  for (let c = xSub + 2; c <= xSub + wSub - 3; c++) {
    cv.setTile(c, 23, c % 2 === 0 ? '▀' : '▄', '#f5b800', '#78350f');
  }
}

// 4. DDR5 ECC RDIMM / RGB MEMORY MODULE (Varies PCB color, chip count/density, heatspreader fin style, RGB gradient & capacity badge)
function drawRamDimm(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isRgb = variant === 'ram-rgb' || /rgb|fury|vengeance|trident|dominator/i.test(name);
  const isHeatsink = isRgb || /pro|fury|vengeance|heatsink|black/i.test(name);

  // PCB / Heatspreader color schemes
  const pcbSchemes = isHeatsink
    ? [
        { main: '#1e293b', light: '#64748b', dark: '#090d16', rim: '#94a3b8' }, // Anodized Gunmetal
        { main: '#cbd5e1', light: '#ffffff', dark: '#475569', rim: '#f8fafc' }, // Brushed Silver/White Heatspreader
        { main: '#18181b', light: '#f5b800', dark: '#09090b', rim: '#d4af37' }  // Stealth Black + Gold Trim
      ]
    : [
        { main: '#0f5132', light: '#34d399', dark: '#052e16', rim: '#10b981' }, // JEDEC Server Green
        { main: '#0c4a6e', light: '#38bdf8', dark: '#082f49', rim: '#0284c7' }, // OEM Sapphire Blue PCB
        { main: '#134e4a', light: '#2dd4bf', dark: '#042f2e', rim: '#14b8a6' }  // SK Hynix Teal-Green PCB
      ];
  const sc = seed.pick(pcbSchemes, 1);

  cv.bevelRect(4, 11, 80, 25, sc.main, sc.light, sc.dark, sc.rim);
  cv.fillRect(4, 18, 3, 4, '#040711');
  cv.fillRect(4, 26, 3, 4, '#040711');
  cv.fillRect(81, 18, 3, 4, '#040711');
  cv.fillRect(81, 26, 3, 4, '#040711');

  // Top lightbar or Vdd trace
  if (isRgb) {
    const palettes = [
      ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#fee440'],
      ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
      ['#38bdf8', '#818cf8', '#c084fc', '#e879f9', '#38bdf8']
    ];
    const pal = seed.pick(palettes, 3);
    for (let c = 6; c < 82; c++) {
      const colHex = pal[(Math.floor((c - 6) / 8) + seed.hash) % pal.length];
      cv.setTile(c, 5, '█', colHex, colHex);
      cv.setTile(c, 6, '▓', '#ffffff', colHex);
    }
  } else {
    for (let c = 7; c < 81; c++) {
      cv.setTile(c, 6, c % 3 === 0 ? '═' : '─', sc.light, sc.main);
    }
  }

  // Extract capacity & speed (e.g. 256GB DDR5-6400)
  const capMatch = name.match(/(\d+\s*GB)/i);
  const capStr = capMatch ? capMatch[1].toUpperCase() : '64GB';
  const spdMatch = name.match(/DDR5[-\s]*(\d{4})/i) || name.match(/(\d{4})\s*MHz/i);
  const spdStr = spdMatch ? `DDR5-${spdMatch[1]}` : 'DDR5 ECC';
  const mfg = (prod && prod.manufacturer) ? prod.manufacturer.toUpperCase().slice(0, 8) : 'HYNIX';

  // Vary DRAM IC layout: 8 standard chips vs 10 high-density 3DS chips vs sculpted heatspreader fins
  const isHighDensity = /128gb|256gb|96gb/i.test(name) || seed.num(0, 2, 4) === 1;
  const chipCols = isHighDensity
    ? [7, 13, 19, 25, 31, 51, 57, 63, 69, 75]
    : [8, 16, 24, 32, 50, 58, 66, 74];
  const chipW = isHighDensity ? 5 : 7;

  chipCols.forEach((cx, idx) => {
    cv.bevelRect(cx, 15, chipW, 14, '#111827', '#4b5563', '#030712');
    if (chipW >= 7) {
      cv.text(cx + 1, 8, mfg.slice(0, 4), '#9ca3af', '#111827');
      cv.text(cx + 1, 9, `IC0${idx + 1}`, '#6b7280', '#111827');
      cv.text(cx + 1, 11, '▪░░▪', '#d1d5db', '#111827');
    } else {
      cv.text(cx + 1, 9, '3DS', '#9ca3af', '#111827');
      cv.text(cx + 1, 11, '███', '#6b7280', '#111827');
    }
    cv.text(cx + 1, 15, '▫▪▫', '#f5b800', sc.main);
  });

  // Central RCD + PMIC controller IC + Spec Sticker
  cv.bevelRect(39, 14, 10, 16, '#1f2937', '#f5b800', '#030712');
  cv.text(40, 8, ` ${capStr.padEnd(6)} `, '#0f172a', '#f5b800');
  cv.text(40, 10, `${spdStr.slice(0, 8)}`, '#38bdf8', '#1f2937');
  cv.text(40, 12, ` ${mfg.padEnd(6)} `, '#4ade80', '#1f2937');

  // 288-pin Gold Edge Connector
  for (let c = 6; c < 82; c++) {
    if (c >= 45 && c <= 47) continue;
    cv.setTile(c, 18, c % 2 === 0 ? '█' : '▓', '#f5b800', '#92400e');
    cv.setTile(c, 19, '▀', '#f5b800', '#040711');
  }
}

// 5. MOTHERBOARD (Varies PCB/heatsink theme, socket orientation, DIMM slot count 4 vs 8, PCIe slot count, Q-Code & model badge)
function drawMotherboard(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isServerGreen = /asrock rack|supermicro|server/i.test(name);
  const isProArt = /proart/i.test(name);
  const isRog = /rog|crosshair|strix/i.test(name);
  const is8Dimm = /w890|wrx90|8x ddr5|eep|ssi/i.test(name) || seed.num(0, 1, 2) === 0;

  const boardThemes = [
    { pcb: '#131b2e', sink: '#334155', accent: '#f5b800', badgeBg: '#f5b800', badgeFg: '#0f172a' }, // ASUS Pro WS Gold
    { pcb: '#0f3822', sink: '#cbd5e1', accent: '#4ade80', badgeBg: '#22c55e', badgeFg: '#052e16' }, // Server Rack Green
    { pcb: '#18181b', sink: '#27272a', accent: '#d97706', badgeBg: '#d97706', badgeFg: '#ffffff' }, // ProArt Bronze/Black
    { pcb: '#0f172a', sink: '#1e293b', accent: '#00f5d4', badgeBg: '#00f5d4', badgeFg: '#0f172a' }, // ROG Cyan/Silver
    { pcb: '#1c1917', sink: '#44403c', accent: '#38bdf8', badgeBg: '#38bdf8', badgeFg: '#0f172a' }  // AI TOP Titanium
  ];
  let bt = seed.pick(boardThemes, 1);
  if (isServerGreen) bt = boardThemes[1];
  else if (isProArt) bt = boardThemes[2];
  else if (isRog) bt = boardThemes[3];

  cv.bevelRect(8, 2, 72, 48, bt.pcb, '#64748b', '#090d16', '#475569');

  // Brass mounting standoffs
  [[10, 2], [44, 2], [77, 2], [10, 23], [44, 23], [77, 23]].forEach(([c, r]) => {
    cv.setTile(c, r, '◎', '#f5b800', bt.pcb);
  });

  // Top-Left Rear I/O Shield & VRM Heatsink
  cv.bevelRect(10, 4, 9, 18, '#cbd5e1', '#ffffff', '#475569');
  cv.text(11, 3, '10GbE', '#0f172a', '#cbd5e1');
  cv.text(11, 5, 'USB4 ', '#0f172a', '#94a3b8');
  cv.text(11, 7, 'WIFI7', '#ffffff', '#2563eb');
  cv.text(11, 9, 'AUDIO', '#0f172a', '#cbd5e1');

  cv.bevelRect(20, 4, 7, 18, bt.sink, '#94a3b8', '#0f172a');
  for (let r = 3; r <= 9; r++) cv.text(21, r, '▓▓▓▓▓', bt.accent, '#1e293b');
  cv.text(22, 2, '╔═══════════════╗', '#f59e0b', bt.pcb);

  // Central LGA CPU Socket (varies orientation & size per board)
  const sockHoriz = seed.num(0, 1, 3) === 0;
  cv.bevelRect(29, 6, 22, 16, '#cbd5e1', '#ffffff', '#475569');
  cv.bevelRect(31, 8, 18, 12, '#78350f', '#f5b800', '#451a03');
  for (let r = 4; r <= 8; r++) {
    for (let c = 32; c <= 47; c++) {
      const pinCh = sockHoriz ? (r % 2 === 0 ? '═' : '─') : ((c + r) % 2 === 0 ? '░' : '▒');
      cv.setTile(c, r, pinCh, '#f5b800', '#78350f');
    }
  }
  const sockTag = shortModelTag(prod, 'LGA SOCKET').slice(0, 10);
  cv.text(34, 6, ` ${sockTag} `, bt.badgeFg, bt.badgeBg);

  // 4 or 8 Vertical DDR5 DIMM Slots
  const numDimms = is8Dimm ? 8 : 4;
  for (let i = 0; i < numDimms; i++) {
    const sc = 53 + i * (is8Dimm ? 2 : 4);
    const slotClr = i % 2 === 0 ? bt.accent : '#64748b';
    cv.setTile(sc, 2, '╦', '#f8fafc', bt.pcb);
    for (let r = 3; r <= 9; r++) cv.setTile(sc, r, '║', slotClr, '#0f172a');
    cv.setTile(sc, 10, '╩', '#f8fafc', bt.pcb);
  }

  for (let r = 3; r <= 9; r++) cv.text(72, r, '▐██▌', '#e2e8f0', '#0f172a');

  // Variable number of PCIe 5.0 x16 SafeSlots (3, 4, or 5)
  const allPcieRows = [12, 15, 18, 20, 22];
  const slotCount = seed.pick([3, 4, 5], 4);
  allPcieRows.slice(0, slotCount).forEach((pr, idx) => {
    cv.text(14, pr, '⟦═════════════════════════════════════⟧▸', idx % 2 === 0 ? '#e2e8f0' : bt.accent, '#0f172a');
  });
  cv.text(16, 13, '▓▓▓[ M.2 PCIe 5.0 NVMe ]▓▓▓', '#cbd5e1', bt.sink);
  cv.text(16, 16, '▓▓▓[ M.2 GEN5 HEATSINK ]▓▓▓', '#cbd5e1', bt.sink);

  // Chipset Heatsink with Board Model + Unique Q-Code Diagnostic Hex
  cv.text(56, 12, ' ◯ ', '#ffffff', '#64748b');
  cv.bevelRect(56, 28, 20, 16, bt.sink, bt.accent, '#090d16', bt.accent);
  cv.text(58, 15, ` ${sockTag.padEnd(13)} `, bt.badgeFg, bt.badgeBg);
  cv.text(58, 17, ` ${(prod && prod.manufacturer || 'ASUS').toUpperCase().slice(0, 7)} PCIe5 `, '#f8fafc', bt.sink);
  cv.text(58, 19, ' ▓▓▓▓▓▓▓▓▓▓▓▓▓ ', bt.accent, '#0f172a');

  const qCodes = ['A0', '00', '99', 'd7', 'b2', 'F1', 'C5'];
  cv.text(68, 22, `[${seed.pick(qCodes, 6)}]`, '#ff4d4d', '#2b0909');
  cv.text(73, 22, '[PWR]', '#4ade80', '#062819');
}

// 6. SOLID STATE DRIVE (Varies between Bare M.2 Gumstick, Heatsinked M.2, U.2 2.5" Enterprise, and E3.S Ruler SSD + brand colors & capacity)
function drawSsdDrive(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isM2 = /m\.2|9100|990|sn850|t705|kc3000|nvme m2|2280/i.test(name);
  const isHeatsinkM2 = isM2 && (/heatsink|pro with|armor/i.test(name) || seed.num(0, 2, 2) === 1);
  const capMatch = name.match(/(\d+(?:\.\d+)?\s*TB|\d+\s*GB)/i);
  const capStr = capMatch ? capMatch[1].toUpperCase() : '3.84TB';
  const brand = (prod && prod.manufacturer) ? prod.manufacturer.toUpperCase() : 'MICRON';

  // Brand-specific accent colors
  const brandColors = [
    { main: '#00e5ff', dark: '#0284c7', pcb: '#111827' }, // Micron / Crucial Cyan
    { main: '#a855f7', dark: '#6b21a8', pcb: '#1e1b4b' }, // Solidigm Violet
    { main: '#ef4444', dark: '#991b1b', pcb: '#18181b' }, // Samsung / Kingston Red
    { main: '#f5b800', dark: '#92400e', pcb: '#0f5132' }, // Western Digital / Server Gold
    { main: '#22c55e', dark: '#15803d', pcb: '#064e3b' }  // Seagate / Enterprise Green
  ];
  let bc = seed.pick(brandColors, 1);
  if (/solidigm/i.test(brand)) bc = brandColors[1];
  else if (/samsung|kingston/i.test(brand)) bc = brandColors[2];
  else if (/micron/i.test(brand)) bc = brandColors[0];

  if (isM2) {
    // M.2 2280 NVMe Gumstick Form Factor
    cv.fillRect(6, 16, 6, 18, bc.pcb);
    for (let r = 8; r <= 16; r++) {
      if (r === 10) continue;
      cv.text(6, r, '███', '#f5b800', '#78350f');
    }
    cv.bevelRect(11, 13, 70, 24, bc.pcb, '#64748b', '#030712', bc.main);
    cv.text(79, 12, '◖◎', '#f5b800', bc.pcb);

    if (isHeatsinkM2) {
      // Extruded M.2 Aluminum Heatsink Armor
      cv.bevelRect(14, 14, 63, 22, '#1e293b', '#94a3b8', '#090d16', bc.main);
      for (let r = 8; r <= 16; r++) {
        cv.text(16, r, '▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓', '#64748b', '#0f172a');
      }
      cv.text(22, 11, ` ◈ ${brand} ${capStr} PCIe GEN5 HEATSINK `, '#0f172a', bc.main);
      cv.text(22, 13, ` 14,800 MB/s NVMe M.2 2280 // ${prod.sku || ''} `, '#ffffff', '#0f172a');
    } else {
      // Bare M.2 PCB with Controller ASIC + DRAM + NAND packages
      cv.bevelRect(15, 16, 12, 18, '#cbd5e1', '#ffffff', '#475569');
      cv.text(17, 10, 'CTRLR', '#0f172a', '#cbd5e1');
      cv.text(17, 12, 'GEN 5', '#0f172a', '#94a3b8');

      cv.bevelRect(29, 16, 8, 18, '#1f2937', '#6b7280', '#030712');
      cv.text(30, 11, 'DRAM', '#9ca3af', '#1f2937');

      cv.bevelRect(39, 15, 38, 20, '#0f172a', bc.main, bc.dark, bc.main);
      cv.text(41, 9, ` ${brand} ${capStr} NVMe `, '#0f172a', bc.main);
      cv.text(41, 11, ` M.2 2280 // ${(prod.model || prod.sku || '').slice(0, 12)} `, '#ffffff', '#0f172a');
      cv.text(41, 13, ' V-NAND TLC ▓▓▓▓▓▓▓▓▓▓ ', '#f5b800', '#0f172a');
    }
  } else {
    // 2.5-inch U.2 / E3.S Enterprise NVMe Solid State Drive
    const casingColors = ['#1e293b', '#27272a', '#334155', '#172554'];
    const casing = seed.pick(casingColors, 3);
    cv.bevelRect(12, 5, 64, 39, casing, '#cbd5e1', '#090d16', bc.main);

    [[14, 3], [73, 3], [14, 20], [73, 20]].forEach(([c, r]) => {
      cv.setTile(c, r, '⊕', '#f5b800', casing);
    });

    // Vary cooling rib pattern on left & right flanks
    const ribPattern = seed.pick(['▓▓▒░', '════', '▒▒░░', '████'], 4);
    for (let r = 5; r <= 18; r++) {
      cv.text(15, r, ribPattern, '#94a3b8', '#0f172a');
      cv.text(69, r, ribPattern, '#94a3b8', '#0f172a');
    }

    cv.bevelRect(21, 9, 46, 29, '#0f172a', bc.main, bc.dark, bc.main);
    cv.text(24, 6, ` ◈ ${brand} ${capStr} ENTERPRISE `, '#0f172a', bc.main);
    cv.text(24, 9, ` MODEL: ${(prod.model || prod.sku || 'U.2 NVME').slice(0, 20).padEnd(20)} `, '#ffffff', '#0f172a');
    cv.text(24, 11, ' U.2 / E3.S PCIe NVMe 24/7  ', '#f5b800', '#0f172a');
    cv.text(24, 14, ` ▐█▌▐██▌▐█▌ SKU:${(prod.sku || '').slice(0, 11).padEnd(11)} `, '#94a3b8', '#0f172a');
    cv.text(24, 16, ' ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ', bc.main, '#0f172a');

    cv.drawPCIeEdge(22, 44, 42);
  }
}

// 7. 3.5" ENTERPRISE HARD DISK DRIVE (Varies platter tint, actuator head position, and brand/capacity badge)
function drawHddDrive(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const capMatch = name.match(/(\d+\s*TB)/i);
  const capStr = capMatch ? capMatch[1].toUpperCase() : '24TB';
  const isWD = /western|wd|ultrastar/i.test(name);
  const isExos = /exos/i.test(name);

  const accent = isWD ? '#38bdf8' : (isExos ? '#f5b800' : '#4ade80');
  cv.bevelRect(14, 2, 60, 46, '#1e293b', '#94a3b8', '#090d16', '#cbd5e1');

  [[16, 2], [44, 2], [71, 2], [16, 22], [44, 22], [71, 22]].forEach(([c, r]) => {
    cv.setTile(c, r, '⊗', '#f5b800', '#1e293b');
  });

  cv.fillRect(18, 5, 52, 38, '#0b0f19');

  // Platter tint & specular reflection angle vary per drive!
  const platterTints = [
    { base: '#94a3b8', mid: '#cbd5e1', spec: '#f8fafc', ring: '#64748b' }, // Mirror Silver
    { base: '#d4af37', mid: '#fde047', spec: '#fef9c3', ring: '#854d0e' }, // Helium Gold Platter
    { base: '#64748b', mid: '#94a3b8', spec: '#e2e8f0', ring: '#334155' }  // Dark Platinum Platter
  ];
  const pt = seed.pick(platterTints, 1);
  const specAngleShift = seed.num(-35, 35, 3);

  const cx = 42, cy = 22, r = 16.5;
  cv.fillCircle(cx, cy, r + 1, '#475569', 1.18);
  cv.fillCircle(cx, cy, r, pt.base, 1.18);

  for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
    for (let px = Math.floor(cx - r * 1.18); px <= Math.ceil(cx + r * 1.18); px++) {
      const dx = (px - cx) / 1.18;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r && dist >= 4.2) {
        const angle = ((Math.atan2(dy, dx) * 180) / Math.PI) + specAngleShift;
        const isSpec = (angle > -65 && angle < -20) || (angle > 115 && angle < 160);
        const isMid = (angle >= -90 && angle <= 0) || (angle >= 90 && angle <= 180);
        if (isSpec) cv.pset(px, py, pt.spec);
        else if (isMid) cv.pset(px, py, pt.mid);
        else if (Math.round(dist) % 4 === 0) cv.pset(px, py, pt.ring);
      }
    }
  }

  cv.fillCircle(cx, cy, 4.2, '#e2e8f0', 1.18);
  cv.fillCircle(cx, cy, 2.0, accent, 1.18);

  // Actuator arm sweeps to different track radius per drive!
  const headX = 43 + seed.num(-4, 7, 5);
  const headY = 23 + seed.num(-3, 5, 6);
  cv.fillCircle(60, 36, 4.5, '#cbd5e1', 1.18);
  cv.fillCircle(60, 36, 2.2, '#334155', 1.18);
  cv.line(60, 35, headX, headY, '#f8fafc', 3);
  cv.line(58, 37, headX, headY + 1, '#f5b800', 2);
  cv.fillRect(headX - 1, headY - 1, 3, 2, '#ef4444');

  const series = isWD ? 'WD ULTRASTAR' : (isExos ? 'SEAGATE EXOS' : 'SKYHAWK AI');
  cv.text(19, 3, ` ${capStr} ${series} `, '#0f172a', accent);
  cv.text(19, 20, ` 7200RPM // ${(prod.sku || 'SATA').slice(-7)} `, '#f8fafc', '#334155');

  cv.drawPCIeEdge(26, 48, 34);
}

// 8. CPU COOLER (Varies across 360mm AIO, 240mm AIO, 1U/2U Passive Server Sink, 4U Single-Tower, and Dual-Tower Air Cooler)
function drawCpuCooler(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isAio360 = /360|420/i.test(name);
  const isAio240 = /240|280|aio|liquid|water/i.test(name) && !isAio360;
  const isPassive1U = /1u|passive/i.test(name) && !/fan/i.test(name);
  const isNoctua = /noctua|nh-/i.test(name);
  const phase = (seed.hash % 360) * (Math.PI / 180);
  const skuLabel = (prod && (prod.model || prod.sku) || 'COOLER').slice(0, 14).toUpperCase();

  if (isAio360 || isAio240) {
    // Liquid AIO Cooler (240mm 2-fan or 360mm 3-fan radiator)
    const rx0 = isAio240 ? 16 : 8;
    const rw = isAio240 ? 56 : 72;
    const radAccent = seed.pick(['#00e5ff', '#4ade80', '#f5b800', '#a855f7', '#f97316'], 2);

    cv.bevelRect(rx0, 3, rw, 22, '#1e293b', '#94a3b8', '#090d16', radAccent);
    for (let r = 2; r <= 11; r++) {
      for (let c = rx0 + 2; c <= rx0 + rw - 3; c++) {
        cv.setTile(c, r, c % 2 === 0 ? '▒' : '░', '#334155', '#0f172a');
      }
    }

    const fanPositions = isAio240 ? [32, 56] : [21, 44, 67];
    fanPositions.forEach((fx, i) => {
      cv.drawFan(fx, 14, isAio240 ? 9.2 : 8.2, {
        housingBg: '#0b0f19',
        ringLight: '#cbd5e1',
        ringDark: '#334155',
        bladeLight: '#e2e8f0',
        bladeMid: '#64748b',
        bladeDark: '#1e293b',
        hubColor: '#f8fafc',
        hubCenter: radAccent,
        blades: seed.pick([7, 9, 11], 3),
        phaseOffset: phase + i * 0.6
      });
    });

    const tubeSpread = seed.num(-4, 4, 4);
    cv.line(30 + tubeSpread, 25, 40, 38, '#475569', 3);
    cv.line(58 - tubeSpread, 25, 48, 38, '#475569', 3);

    cv.fillCircle(44, 41, 8.0, '#d97706', 1.2);
    cv.fillCircle(44, 40, 6.5, '#1e293b', 1.2);
    cv.ring(44, 40, 5.2, 3.8, radAccent, 1.2);
    cv.text(35, 20, ` ${skuLabel.padEnd(16)} `, '#0f172a', radAccent);
  } else if (isPassive1U) {
    // 1U / 2U Low-Profile Server Extruded Copper/Aluminum Heatsink
    const finColors = ['#f59e0b', '#cbd5e1', '#94a3b8', '#fbbf24'];
    const finClr = seed.pick(finColors, 1);
    const wSink = seed.pick([54, 60, 66], 3);
    const sx0 = Math.floor((88 - wSink) / 2);

    cv.bevelRect(sx0, 14, wSink, 24, '#1e293b', finClr, '#090d16', finClr);
    const finStep = seed.pick([2, 3], 5);
    for (let c = sx0 + 3; c <= sx0 + wSink - 4; c += finStep) {
      for (let r = 8; r <= 18; r++) {
        cv.setTile(c, r, '║', finClr, '#0f172a');
      }
    }
    // Embedded vapor chamber / heatpipes
    cv.text(sx0 + 6, 13, ` ═══[ ${skuLabel} ]═══ `, '#0f172a', finClr);
    cv.bevelRect(20, 38, 48, 7, '#d97706', '#fef08a', '#78350f', '#f59e0b');
    cv.text(24, 20, ` 1U/2U SERVER SINK // ${(prod.sku || '').slice(0, 12).padEnd(12)} `, '#0f172a', '#f5b800');
  } else {
    // 2U / 4U Tower Heatpipe Air Cooler (varies fin width, Noctua brown vs Silver/Black fan, & heatpipe count)
    const numPipes = seed.pick([4, 6, 8], 2);
    const pipes = [];
    for (let i = 0; i < numPipes / 2; i++) {
      pipes.push(24 + i * 4);
      pipes.push(64 - i * 4);
    }
    pipes.forEach(px => cv.bevelRect(px, 2, 3, 5, '#f59e0b', '#fde68a', '#92400e'));

    const finW = seed.pick([46, 52, 58], 4);
    const fx0 = Math.floor((88 - finW) / 2);
    cv.bevelRect(fx0, 6, finW, 32, '#94a3b8', '#f8fafc', '#334155', '#cbd5e1');
    for (let r = 4; r <= 17; r++) {
      for (let c = fx0 + 2; c <= fx0 + finW - 3; c++) {
        cv.setTile(c, r, r % 2 === 0 ? '═' : '─', '#e2e8f0', '#475569');
      }
    }

    const fanThemes = [
      { frame: '#d6c7b2', bLight: '#9a5b32', bMid: '#6e3b1b', bDark: '#47240e', hub: '#9a5b32' }, // Noctua Brown/Tan
      { frame: '#1e293b', bLight: '#e2e8f0', bMid: '#64748b', bDark: '#1e293b', hub: '#00e5ff' }, // Arctic White/Cyan
      { frame: '#18181b', bLight: '#94a3b8', bMid: '#475569', bDark: '#09090b', hub: '#f5b800' }, // Server PWM Black/Gold
      { frame: '#334155', bLight: '#cbd5e1', bMid: '#475569', bDark: '#0f172a', hub: '#4ade80' }  // SilverStone Industrial
    ];
    const ft = isNoctua ? fanThemes[0] : seed.pick(fanThemes, 3);

    cv.bevelRect(29, 8, 30, 28, ft.frame, '#f8fafc', '#090d16');
    cv.drawFan(44, 22, 11.8, {
      housingBg: '#0b0f19',
      ringLight: ft.frame,
      ringDark: '#334155',
      bladeLight: ft.bLight,
      bladeMid: ft.bMid,
      bladeDark: ft.bDark,
      hubColor: '#e2e8f0',
      hubCenter: ft.hub,
      blades: seed.pick([7, 9, 11], 5),
      phaseOffset: phase
    });

    pipes.forEach(px => cv.line(px + 1, 38, 36 + Math.floor((px - 24) * 0.4), 45, '#f59e0b', 3));
    cv.bevelRect(30, 44, 28, 6, '#d97706', '#fef08a', '#78350f', '#f59e0b');
    cv.text(33, 23, ` ${(prod.sku || skuLabel).slice(0, 18).padEnd(18)} `, '#0f172a', '#f5b800');
  }
}

// 9. POWER SUPPLY (Varies between 1U/2U Redundant CRPS Server PSU and ATX 3.1 Workstation PSU with varying wattage, trim & fan phase)
function drawPsuUnit(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isCRPS = /crps|2u|1u|redundant|gemini/i.test(name);
  const wattMatch = name.match(/(\d{3,4})\s*W/i);
  const wattStr = wattMatch ? `${wattMatch[1]}W` : '1600W';

  if (isCRPS) {
    // 1U / 2U Server Hot-Swap Redundant CRPS Power Supply Module
    cv.bevelRect(6, 12, 76, 26, '#cbd5e1', '#ffffff', '#475569', '#94a3b8');
    // Left hot-swap pull handle & orange/green release latch
    cv.bevelRect(8, 15, 10, 20, '#1e293b', '#64748b', '#090d16');
    cv.bevelRect(19, 15, 5, 10, '#f97316', '#fdba74', '#9a3412');
    cv.text(10, 11, 'PULL', '#ffffff', '#1e293b');
    // 40mm High-RPM Server Fan + C19 AC Socket
    cv.drawFan(32, 25, 7.5, {
      housingBg: '#090d16',
      ringLight: '#f8fafc',
      ringDark: '#334155',
      bladeLight: '#94a3b8',
      bladeMid: '#475569',
      bladeDark: '#1e293b',
      hubColor: '#f5b800',
      hubCenter: '#0f172a',
      blades: 7,
      phaseOffset: (seed.hash % 360) * (Math.PI / 180)
    });
    cv.bevelRect(44, 15, 34, 20, '#0f172a', '#f5b800', '#1e293b', '#d4af37');
    cv.text(46, 9, ` ⚡ ${wattStr} CRPS REDUNDANT `, '#0f172a', '#f5b800');
    cv.text(46, 11, ` 80+ PLATINUM/TITANIUM 2U `, '#4ade80', '#0f172a');
    cv.text(46, 13, ` SKU: ${(prod.sku || '').slice(0, 16).padEnd(16)} `, '#cbd5e1', '#0f172a');
    cv.drawPCIeEdge(50, 38, 28);
  } else {
    // ATX 3.1 / PCIe 5.1 Modular Workstation PSU
    const accents = ['#f5b800', '#38bdf8', '#f97316', '#4ade80', '#e2e8f0'];
    const acc = seed.pick(accents, 1);

    cv.bevelRect(8, 5, 72, 41, '#1e2533', '#64748b', '#090d16', acc);

    cv.drawFan(27, 25, 14.5, {
      housingBg: '#0b0f19',
      ringLight: '#cbd5e1',
      ringDark: '#334155',
      bladeLight: '#94a3b8',
      bladeMid: '#475569',
      bladeDark: '#1e293b',
      hubColor: acc,
      hubCenter: '#0f172a',
      blades: seed.pick([7, 9, 11], 2),
      phaseOffset: (seed.hash % 360) * (Math.PI / 180)
    });
    cv.ring(27, 25, 11.0, 10.2, '#94a3b8', 1.18);
    if (seed.num(0, 1, 4) === 0) cv.ring(27, 25, 7.2, 6.4, acc, 1.18);
    cv.text(24, 12, ` ${wattStr} `, '#0f172a', acc);

    cv.bevelRect(46, 8, 31, 13, '#0f172a', acc, '#1e293b', acc);
    const mfg = (prod && prod.manufacturer) ? prod.manufacturer.toUpperCase().slice(0, 10) : 'PRO WS';
    cv.text(48, 5, ` ⚡ ${mfg} ${wattStr} `, '#0f172a', acc);
    cv.text(48, 7, ' ATX 3.1 // PCIe 5.1 ', '#ffffff', '#0f172a');
    cv.text(48, 9, ` SKU:${(prod.sku || '').slice(0, 14).padEnd(14)} `, '#38bdf8', '#0f172a');

    cv.text(47, 12, '12V-2x6:', '#f5b800', '#1e2533');
    cv.text(56, 12, Number(wattStr.replace(/\D/g, '')) >= 2000 ? '[░░░░][░░░░][░░░░]' : '[░░░░░░] [░░░░░░]', '#0f172a', '#f5b800');

    cv.text(47, 15, 'CPU/PCIe:', '#cbd5e1', '#1e2533');
    cv.text(57, 15, '[⣿⣿] [⣿⣿] [⣿⣿] [⣿⣿]', '#94a3b8', '#090d16');

    cv.text(47, 18, '24-PIN :', '#cbd5e1', '#1e2533');
    cv.text(56, 18, '[██████████] [████]', '#94a3b8', '#090d16');

    cv.text(47, 20, 'AC IN  :', '#4ade80', '#1e2533');
    cv.text(56, 20, '⟦ ▬ ▬ ▬ ⟧ [ON/OFF]', '#ffffff', '#090d16');
  }
}

// 10. DESKTOP WORKSTATION TOWER CASE (Varies White vs Black chassis, Wood slats vs Mesh vs Solid front, and internal RGB theme)
function drawDesktopCase(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isWhite = /white|chalk/i.test(name);
  const isWood = /north/i.test(name);
  const isSolid = /solid|define/i.test(name) && !/tg|glass/i.test(name);

  const chassisBody = isWhite ? '#cbd5e1' : seed.pick(['#1e293b', '#18181b', '#27272a'], 1);
  const chassisRim = isWhite ? '#ffffff' : '#64748b';
  const rgbAccent = seed.pick(['#00e5ff', '#f5b800', '#a855f7', '#4ade80', '#ef4444'], 2);

  cv.bevelRect(16, 2, 56, 46, chassisBody, '#ffffff', '#090d16', chassisRim);

  if (isSolid) {
    // Sound-Damped Brushed Aluminum Solid Side Panel
    cv.bevelRect(19, 5, 35, 40, isWhite ? '#e2e8f0' : '#18181b', '#94a3b8', '#090d16');
    for (let r = 4; r <= 20; r++) {
      cv.text(21, r, '░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░', isWhite ? '#cbd5e1' : '#27272a', isWhite ? '#94a3b8' : '#18181b');
    }
    cv.text(24, 11, ` ${(prod.manufacturer || 'FRACTAL').toUpperCase()} SILENT WORKSTATION `, '#0f172a', rgbAccent);
  } else {
    // Tempered Glass Side Panel showing internal Motherboard, AIO & RTX GPU
    cv.bevelRect(19, 5, 35, 31, '#0b1324', rgbAccent, '#1e293b');
    cv.bevelRect(22, 7, 24, 22, '#111827', '#475569', '#030712');
    cv.fillCircle(31, 14, 4.2, rgbAccent, 1.15);
    cv.fillCircle(31, 14, 2.5, '#0f172a', 1.15);
    for (let c = 38; c <= 41; c++) {
      cv.setTile(c, 6, '║', rgbAccent, '#111827');
      cv.setTile(c, 7, '║', '#ffffff', '#111827');
    }
    cv.bevelRect(21, 21, 30, 6, '#334155', rgbAccent, '#0f172a');
    cv.text(23, 11, ' GEFORCE RTX // PRO ', '#0f172a', rgbAccent);
    cv.text(23, 12, ' ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ', '#94a3b8', '#1e293b');

    cv.bevelRect(19, 37, 35, 8, isWhite ? '#94a3b8' : '#161e2e', '#64748b', '#090d16');
    cv.text(21, 20, ` ${(prod.model || prod.sku || 'WORKSTATION').slice(0, 19).padEnd(19)} `, '#0f172a', rgbAccent);
  }

  // Right Front Bezel: Walnut/Oak Wood Slats OR High-Airflow Mesh with 3 Intake Fans
  cv.bevelRect(55, 4, 14, 41, isWood ? '#78350f' : '#0f172a', isWood ? '#f59e0b' : rgbAccent, '#090d16');
  const phase = (seed.hash % 360) * (Math.PI / 180);
  [12, 24, 36].forEach((fy, i) => {
    cv.drawFan(62, fy, 4.8, {
      housingBg: '#090d16',
      ringLight: isWood ? '#f59e0b' : rgbAccent,
      ringDark: '#334155',
      bladeLight: '#cbd5e1',
      bladeMid: '#475569',
      bladeDark: '#1e293b',
      hubColor: '#e2e8f0',
      hubCenter: rgbAccent,
      blades: 7,
      phaseOffset: phase + i * 0.5
    });
  });
  if (isWood) {
    for (let r = 3; r <= 20; r++) {
      cv.setTile(56, r, '║', '#d97706', '#451a03');
      cv.setTile(67, r, '║', '#d97706', '#451a03');
    }
  }

  cv.fillRect(20, 48, 8, 3, '#cbd5e1');
  cv.fillRect(58, 48, 8, 3, '#cbd5e1');
}

// 11. RACKMOUNT SERVER CHASSIS & BAREBONES (Varies 1U, 2U, 4U, and 6U height, drive bay matrix, latch colors & model badge)
function drawRackmount(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const is1U = /\b1u\b|rm100/i.test(name);
  const is2U = /\b2u\b|rm2/i.test(name);
  const is6U = /\b5u\b|\b6u\b|rm600/i.test(name);

  const yTop = is1U ? 16 : (is2U ? 12 : (is6U ? 4 : 7));
  const hBox = is1U ? 20 : (is2U ? 26 : (is6U ? 44 : 36));
  const bayRows = is1U ? 1 : (is2U ? 2 : 3);
  const latchClr = seed.pick(['#ef4444', '#f59e0b', '#00e5ff', '#a855f7'], 1);

  // Left & Right 19" Rackmount Ears
  cv.bevelRect(4, yTop, 6, hBox, '#cbd5e1', '#ffffff', '#475569');
  cv.bevelRect(78, yTop, 6, hBox, '#cbd5e1', '#ffffff', '#475569');
  const rTopTerm = Math.ceil(yTop / 2) + 1;
  const rBotTerm = Math.floor((yTop + hBox) / 2) - 1;
  cv.text(5, rTopTerm, '◯█', '#0f172a', '#cbd5e1');
  cv.text(80, rTopTerm, '█◯', '#0f172a', '#cbd5e1');
  if (rBotTerm > rTopTerm + 2) {
    cv.text(5, rBotTerm, '◯█', '#0f172a', '#cbd5e1');
    cv.text(80, rBotTerm, '█◯', '#0f172a', '#cbd5e1');
  }

  // Main Server Chassis Body
  cv.bevelRect(10, yTop, 68, hBox, '#1e2533', '#94a3b8', '#090d16', '#64748b');

  const uTag = is1U ? '1U' : (is2U ? '2U' : (is6U ? '6U' : '4U'));
  const mfg = (prod && prod.manufacturer) ? prod.manufacturer.toUpperCase() : 'SERVER';
  cv.text(13, Math.floor(yTop / 2), ` ${uTag} ${mfg} // ${(prod.model || prod.sku || 'RACKMOUNT').slice(0, 26).padEnd(26)} `, '#0f172a', '#cbd5e1');

  // Hot-Swap Drive Bays Matrix (varies rows x cols based on 1U / 2U / 4U)
  const rowH = Math.floor((hBox - 8) / bayRows);
  for (let rowIdx = 0; rowIdx < bayRows; rowIdx++) {
    for (let colIdx = 0; colIdx < 4; colIdx++) {
      const bx = 13 + colIdx * 11;
      const by = yTop + 5 + rowIdx * rowH;
      cv.bevelRect(bx, by, 10, Math.max(6, rowH - 2), '#0f172a', '#475569', '#030712');
      const rTerm = Math.floor(by / 2) + 1;
      cv.text(bx + 1, rTerm, '░░░░░░', '#64748b', '#0f172a');
      cv.text(bx + 7, rTerm, '●', '#4ade80', '#0f172a');
      if (rowH >= 10) {
        cv.text(bx + 1, rTerm + 1, '▓▓▓▓██', '#94a3b8', '#1e293b');
        cv.text(bx + 5, rTerm + 1, '██', latchClr, '#1e293b');
      }
    }
  }

  // Right Management & Redundant Power Module Panel
  cv.bevelRect(58, yTop + 5, 17, hBox - 9, '#0f172a', '#475569', '#030712');
  const rPanel = Math.floor((yTop + 6) / 2);
  cv.text(60, rPanel, 'FAN WALL ▓▓▓', '#38bdf8', '#0f172a');
  if (hBox >= 26) {
    cv.text(60, rPanel + 2, 'PSU1: OK ●  ', '#4ade80', '#1e293b');
    cv.text(60, rPanel + 4, 'PSU2: OK ●  ', '#4ade80', '#1e293b');
  }
  if (hBox >= 34) {
    cv.text(60, rPanel + 7, '[VGA] [USB3]', '#f5b800', '#0f172a');
    cv.text(60, rPanel + 9, ' [PWR] [UID]', '#ffffff', '#2563eb');
  }
}

// 12. HBAs, 400G/800G SMARTNICS, NVLINK, CABLES & USB/PCIe AI ACCELERATORS
function drawAccelerator(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isCable = /cable|cord|dac|splitter|patch/i.test(name);
  const isTransceiver = !isCable && /qsfp|sfp|osfp|transceiver|optical|100g|400g|800g/i.test(name) && !/adapter|nic|connectx|card|pcie/i.test(name);
  const isNvlink = /nvlink/i.test(name);
  const isUsbAccel = /usb|ugen300|hailo/i.test(name);

  if (isCable) {
    // High-Speed QSFP / DAC / Fiber Optic Interconnect Cable Loop
    const cableClr = /optical|fiber|mmf|om4/i.test(name) ? '#00e5ff' : seed.pick(['#1e293b', '#2563eb', '#f59e0b'], 1);
    cv.ring(44, 26, 17, 13, cableClr, 1.45);
    cv.ring(44, 26, 15.5, 14.5, '#ffffff', 1.45);
    // Left & Right QSFP / Mini-SAS Connector Heads
    cv.bevelRect(12, 18, 16, 12, '#cbd5e1', '#ffffff', '#475569');
    cv.bevelRect(60, 18, 16, 12, '#cbd5e1', '#ffffff', '#475569');
    cv.text(14, 11, 'QSFP/SAS', '#0f172a', '#f5b800');
    cv.text(62, 11, 'QSFP/SAS', '#0f172a', '#f5b800');
    cv.text(31, 13, ` ${(prod.sku || 'DAC CABLE').slice(0, 16)} `, '#0f172a', '#00e5ff');
  } else if (isTransceiver) {
    // 100G / 400G / 800G Optical Transceiver Module (varies pull-tab color & speed label)
    const tabColors = ['#00e5ff', '#f5b800', '#ec4899', '#4ade80', '#a855f7'];
    const tabClr = seed.pick(tabColors, 1);
    cv.bevelRect(8, 18, 12, 14, tabClr, '#ffffff', '#090d16');
    cv.text(10, 12, 'PULL◄', '#0f172a', tabClr);
    cv.bevelRect(20, 14, 54, 22, '#94a3b8', '#ffffff', '#334155', '#cbd5e1');
    cv.bevelRect(25, 17, 42, 16, '#0f172a', tabClr, '#1e293b');
    const spd = /800g/i.test(name) ? '800G OSFP' : (/400g/i.test(name) ? '400G QSFP-DD' : (/100g/i.test(name) ? '100G QSFP28' : 'SFP+ OPTICAL'));
    cv.text(27, 10, ` ${spd} TRANSCEIVER `, '#0f172a', tabClr);
    cv.text(27, 12, ` SKU: ${(prod.sku || '').slice(0, 18).padEnd(18)} `, '#ffffff', '#0f172a');
    cv.text(27, 14, ' 850nm/1310nm DUPLEX LC/MPO ', '#f5b800', '#0f172a');
    for (let r = 8; r <= 15; r++) cv.text(74, r, '███', '#f5b800', '#78350f');
  } else if (isNvlink) {
    // NVIDIA NVLink GPU Bridge
    cv.bevelRect(18, 10, 52, 30, '#1e2533', '#ffe680', '#78350f', '#d4af37');
    cv.bevelRect(24, 15, 40, 20, '#0f172a', '#f5b800', '#451a03');
    cv.text(27, 9, ` NVIDIA NVLINK // ${(prod.sku || '').slice(-6)} `, '#0f172a', '#d4af37');
    cv.text(28, 12, ' 900 GB/s GPU INTERCONNECT ', '#76b900', '#0f172a');
    cv.text(28, 15, ' ⟦░░░░░░░░░⟧   ⟦░░░░░░░░░⟧ ', '#f5b800', '#0f172a');
  } else if (isUsbAccel) {
    // Compact External USB-C AI Accelerator (ASUS UGen300 Hailo-10H)
    cv.bevelRect(12, 21, 9, 10, '#cbd5e1', '#ffffff', '#475569');
    cv.text(13, 12, 'USB-C', '#0f172a', '#cbd5e1');
    cv.bevelRect(21, 13, 52, 26, '#1e293b', '#00e5ff', '#090d16', '#38bdf8');
    for (let r = 8; r <= 17; r++) {
      cv.text(24, r, '▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓▒▒░░▓▓', '#475569', '#0f172a');
    }
    cv.text(27, 11, ' HAILO-10H NPU // 40 TOPS AI ', '#0f172a', '#00e5ff');
    cv.text(27, 13, ` ${(prod.name || '').slice(0, 26).padEnd(26)} `, '#ffffff', '#0f172a');
  } else {
    // PCIe SmartNIC / SAS HBA / Raid Controller Card (varies PCB color, heatsink color & port count)
    const pcbColors = [
      { main: '#0f5132', light: '#34d399', dark: '#052e16', rim: '#10b981' }, // Enterprise Green
      { main: '#0c4a6e', light: '#38bdf8', dark: '#082f49', rim: '#0284c7' }, // Intel/Mellanox Blue
      { main: '#1e293b', light: '#94a3b8', dark: '#090d16', rim: '#64748b' }  // Broadcom Stealth Black
    ];
    const pcb = seed.pick(pcbColors, 1);
    const sinkColors = ['#cbd5e1', '#f5b800', '#38bdf8', '#94a3b8'];
    const sinkClr = seed.pick(sinkColors, 3);

    cv.drawIOBracket(9, 7, 42);
    cv.text(7, 7, '⟦███⟧', '#00e5ff', '#0f172a');
    cv.text(7, 12, '⟦███⟧', '#00e5ff', '#0f172a');

    cv.bevelRect(13, 9, 64, 31, pcb.main, pcb.light, pcb.dark, pcb.rim);
    cv.bevelRect(22, 13, 38, 22, sinkClr, '#ffffff', '#334155', '#ffffff');
    for (let r = 7; r <= 16; r++) {
      cv.text(24, r, '══════════════════════════════════', r % 2 === 0 ? '#f8fafc' : '#475569', '#1e293b');
    }
    const tag = shortModelTag(prod, 'PCIe SMARTNIC');
    cv.text(26, 11, ` ${tag.padEnd(20)} `, '#0f172a', '#f5b800');
    cv.text(63, 8, ' ▣ ▣ ', '#94a3b8', pcb.main);
    cv.text(63, 11, ' ◯ ◯ ', '#38bdf8', pcb.main);
    cv.text(63, 14, ' [SAS]', '#f5b800', '#0f172a');

    cv.drawPCIeEdge(18, 40, seed.pick([28, 44], 5));
  }
}

// 13. HPC POWER DELIVERY (Varies between APC Switched 3-Phase Rack PDU and Tripp Lite SmartOnline 2U UPS)
function drawHpcPower(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isUps = /ups|smartonline|battery|va\b/i.test(name);

  cv.bevelRect(4, 10, 5, 30, '#cbd5e1', '#ffffff', '#475569');
  cv.bevelRect(79, 10, 5, 30, '#cbd5e1', '#ffffff', '#475569');

  if (isUps) {
    // 2U SmartOnline Double-Conversion Sine-Wave Rack UPS
    cv.bevelRect(9, 10, 70, 30, '#18181b', '#71717a', '#09090b', '#f5b800');
    // Left hot-swap battery compartment vents
    for (let r = 7; r <= 17; r++) {
      cv.text(12, r, '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', '#3f3f46', '#09090b');
    }
    // Central Interactive Blue LCD Screen
    cv.bevelRect(35, 13, 24, 24, '#0c4a6e', '#38bdf8', '#082f49', '#00e5ff');
    cv.text(37, 8, ' SMARTONLINE UPS ', '#0f172a', '#00e5ff');
    cv.text(37, 10, ' IN : 208/240V AC ', '#ffffff', '#0c4a6e');
    cv.text(37, 12, ' BAT: 100% ██████ ', '#4ade80', '#0c4a6e');
    cv.text(37, 14, ` ${(prod.sku || '6000VA').slice(0, 15).padEnd(15)} `, '#f5b800', '#0c4a6e');
    // Right control buttons
    cv.text(62, 9, ' [ON/MUTE] ', '#0f172a', '#4ade80');
    cv.text(62, 12, ' [MODE/ST] ', '#ffffff', '#27272a');
    cv.text(62, 15, ' 208V 30A⚡ ', '#0f172a', '#f5b800');
  } else {
    // APC NetShelter Switched Rack PDU
    const accent = seed.pick(['#dc2626', '#2563eb', '#16a34a'], 1);
    cv.bevelRect(9, 10, 70, 30, '#18181b', '#71717a', '#09090b', accent);

    cv.bevelRect(13, 14, 20, 22, '#022c22', '#34d399', '#064e3b', '#10b981');
    cv.text(15, 8, ' 208V 3-PHASE ', '#0f172a', '#34d399');
    cv.text(15, 10, ` ${(prod.sku || 'APDU').slice(0, 12).padEnd(12)} `, '#4ade80', '#022c22');
    cv.text(15, 12, ' PWR : 17.3kW ', '#f5b800', '#022c22');
    cv.text(15, 14, ' NET : [RJ45] ', '#38bdf8', '#022c22');

    cv.text(36, 7, 'C19/C21 HIGH-CURRENT OUTLETS:', '#f5b800', '#18181b');
    for (let i = 0; i < 4; i++) {
      const ox = 36 + i * 8;
      cv.text(ox, 9, '╔════╗', '#f8fafc', '#09090b');
      cv.text(ox, 10, '║▬ ▬ ║', '#f5b800', '#09090b');
      cv.text(ox, 11, '╚════╝', '#94a3b8', '#09090b');
    }

    cv.text(36, 13, 'C13/C15 SWITCHED OUTLETS:', '#cbd5e1', '#18181b');
    for (let i = 0; i < 5; i++) {
      const ox = 36 + i * 6;
      cv.text(ox, 15, '[▪▪▪]', '#4ade80', '#09090b');
      cv.text(ox, 16, '[▪▪▪]', '#4ade80', '#09090b');
    }

    cv.bevelRect(69, 14, 7, 22, '#27272a', '#a1a1aa', '#09090b');
    cv.text(70, 9, 'BRK1', '#ffffff', '#16a34a');
    cv.text(70, 12, 'BRK2', '#ffffff', '#16a34a');
    cv.text(70, 15, '60A⚡', '#0f172a', '#f5b800');
  }
}

// 14. AI SUPERCOMPUTER (Varies across ASUS Ascent GX10, GIGABYTE AI TOP ATOM, Lenovo PGX, MSI EdgeXpert, and Full-Tower Multi-GPU AI Systems)
function drawAiSuper(cv, variant, prod) {
  const seed = getProductSeed(prod);
  const name = prod ? prod.name : '';
  const isTowerSystem = /threadripper|epyc|w7900|rtx pro 6000|gb300/i.test(name) && !/gx10|atom|pgx|edgexpert|spark/i.test(name);

  if (isTowerSystem) {
    // Full-Tower / Deskside Multi-GPU Turnkey AI Supercomputer System
    cv.bevelRect(14, 2, 60, 46, '#18181b', '#f5b800', '#090d16', '#d4af37');
    cv.bevelRect(18, 5, 52, 38, '#0b0f19', '#38bdf8', '#1e293b');
    cv.text(21, 3, ` ◢◣ TURNKEY MULTI-GPU AI SUPERCOMPUTER `, '#0f172a', '#f5b800');
    // 4 Stacked Blower AI GPUs inside chassis
    [7, 10, 13, 16].forEach((r, idx) => {
      cv.text(21, r, `⟦▓▓▓▓▓▓▓▓▓[ GPU #${idx + 1}: RTX PRO / INSTINCT ]▓▓▓▓▓◎▓⟧`, idx % 2 === 0 ? '#f5b800' : '#00e5ff', '#1e293b');
    });
    cv.text(21, 19, ` ${(prod.name || '').slice(0, 44).padEnd(44)} `, '#4ade80', '#0f172a');
    cv.fillRect(20, 48, 10, 3, '#f5b800');
    cv.fillRect(58, 48, 10, 3, '#f5b800');
    return;
  }

  // Compact Desktop DGX Spark / GB10 Supercomputer Cube (varies by brand!)
  const brandThemes = [
    { outer: '#d4af37', inner: '#1e2533', bar: '#76b900', mesh: '❖' }, // NVIDIA / ASUS Ascent GX10 Champagne Gold
    { outer: '#475569', inner: '#0f172a', bar: '#f97316', mesh: '▒' }, // GIGABYTE AI TOP ATOM Titanium/Orange
    { outer: '#27272a', inner: '#18181b', bar: '#ef4444', mesh: '░' }, // Lenovo ThinkStation PGX Carbon/Crimson
    { outer: '#334155', inner: '#1e1b4b', bar: '#00e5ff', mesh: '◈' }  // MSI EdgeXpert Gunmetal/Cyan
  ];
  let bt = seed.pick(brandThemes, 1);
  if (/gigabyte|atom/i.test(name)) bt = brandThemes[1];
  else if (/lenovo|pgx/i.test(name)) bt = brandThemes[2];
  else if (/msi|edgexpert/i.test(name)) bt = brandThemes[3];

  cv.bevelRect(14, 4, 60, 42, bt.outer, '#fef08a', '#451a03', bt.bar);
  cv.bevelRect(17, 7, 54, 36, bt.inner, '#cbd5e1', '#090d16', bt.outer);

  cv.bevelRect(20, 10, 48, 30, '#0b0f19', '#475569', '#030712');
  for (let r = 6; r <= 18; r++) {
    for (let c = 22; c <= 65; c++) {
      const hexChar = (c + r) % 2 === 0 ? bt.mesh : '░';
      const hexClr = (c + r) % 4 === 0 ? '#64748b' : '#1e293b';
      cv.setTile(c, r, hexChar, hexClr, '#0b0f19');
    }
  }

  const brand = (prod && prod.manufacturer) ? prod.manufacturer.toUpperCase() : 'NVIDIA';
  const tag = shortModelTag(prod, 'DGX SPARK');
  const ssdMatch = name.match(/(\d+\s*TB)/i);
  const ssdStr = ssdMatch ? `${ssdMatch[1].toUpperCase()} NVMe` : '128GB LPDDR5x';

  cv.bevelRect(25, 20, 38, 10, '#0f172a', bt.bar, '#14532d', bt.bar);
  cv.text(27, 11, ` ◢◣ ${brand} // ${tag.padEnd(14)} `, '#0f172a', bt.bar);
  cv.text(27, 13, ` GRACE BLACKWELL GB10 // ${ssdStr.padEnd(8)} `, '#ffffff', '#0f172a');
  cv.text(27, 14, ` SKU: ${(prod.sku || 'DGX-SPARK').padEnd(26)} `, '#f5b800', '#0f172a');

  cv.fillRect(20, 46, 10, 3, bt.outer);
  cv.fillRect(58, 46, 10, 3, bt.outer);
}

/* ==========================================================================
   SECONDARY CONNECTOR / INTERFACE PIXEL ART (Matches Slide 1 bottom-right icon!)
   ========================================================================== */
const CONNECTOR_ART = {
  '12v-2x6': {
    label: '12V-2x6 600W',
    grid: [
      "   ▄████████▄   ",
      " ▄████████████▄ ",
      " █▣░▣░▣░░▣░▣░▣█ ",
      " █░▣░▣░░░░▣░▣░█ ",
      " ██████████████ ",
      "  ▀▀▀██████▀▀▀  "
    ]
  },
  'pcie-8pin': {
    label: '3x 8-PIN PCIe',
    grid: [
      "  ▄██▄    ▄██▄  ",
      " ██████..██████ ",
      " █▣░▣░█..█░▣░▣█ ",
      " █░▣░▣█..█▣░▣░█ ",
      " ▀▀▀▀▀▀..▀▀▀▀▀▀ "
    ]
  },
  'socket-sp5': {
    label: 'LGA-6096 / sTR5',
    grid: [
      " ██████████████ ",
      " █░░░░░░░░░░░░█ ",
      " █░▒▒██████▒▒░█ ",
      " █░▒▒██▓▓██▒▒░█ ",
      " █░░░░░░░░░░░░█ ",
      " ██████████████ "
    ]
  },
  'ddr5-288': {
    label: '288-PIN DDR5',
    grid: [
      " ████████████████ ",
      " █▓▓▓▓▓▓▓▓▓▓▓▓▓▓█ ",
      " ▀▀▀▀▀▀▀▀..▀▀▀▀▀▀ ",
      " ███▓▓███..██▓▓██ "
    ]
  },
  'pcie5-u2': {
    label: 'PCIe 5.0 / U.2',
    grid: [
      " ████████████████ ",
      " █░░░░░█░░███████ ",
      " ▀▀▀▀▀▀▀..▀▀▀▀▀▀▀ "
    ]
  },
  'sata-3': {
    label: 'SATA 6Gb/s',
    grid: [
      " ██████████████ ",
      " █░░░░░█░░░░███ ",
      " ▀▀▀▀▀▀▀▀▀▀▀▀▀▀ "
    ]
  },
  'c19-pdu': {
    label: '240V C19/C20',
    grid: [
      " ╔════════════╗ ",
      " ║ ▬▬  ▬▬  ▬▬ ║ ",
      " ║     ▬▬     ║ ",
      " ╚════════════╝ "
    ]
  },
  'qsfp-dd': {
    label: '400G/800G QSFP',
    grid: [
      " ╔════════════╗ ",
      " ║▓▓▓▓▓▓▓▓▓▓▓▓║ ",
      " ║░░░░░░░░░░░░║ ",
      " ╚════════════╝ "
    ]
  }
};

/* ==========================================================================
   HIGH-FIDELITY MANUFACTURER PIXELATED LOGOS (Matches Slide 1 Left-Middle Column!)
   ========================================================================== */
const MANUFACTURER_BADGES = {
  'NVIDIA': {
    color: '#76b900',
    secondaryColor: '#ffffff',
    art: [
      " ▄████████▄   █▄ █ █ █ █ █▀▄ █ ▄▀▄",
      "██░░▄██▄░░██  █ ▀█ ▀▄▀ █ █▄▀ █ █▀█",
      "██░░▀██▀░░██  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀",
      " ▀████████▀   GEFORCE // BLACKWELL"
    ]
  },
  'ASUS': {
    color: '#00a8ff',
    secondaryColor: '#55ffff',
    art: [
      "  ▄▀▀█ ▄▀▀▀ █  █ ▄▀▀▀ ",
      " ▄▄▄▄█ ▀▀▀▄ █  █ ▀▀▀▄ ",
      " █   █ ▄▄▄▀ ▀▄▄▀ ▄▄▄▀ ",
      " ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ "
    ]
  },
  'AMD': {
    color: '#ff5555',
    secondaryColor: '#ffffff',
    art: [
      " ███████◣    ▄▀▄ █▄ ▄█ █▀▄ ",
      "    ███▓▓◣   █▀█ █ ▀ █ █ █ ",
      " ███▀  ▓▓▓   ▀ ▀ ▀   ▀ ▀▀  ",
      " RYZEN // EPYC // INSTINCT "
    ]
  },
  'Intel': {
    color: '#00b4d8',
    secondaryColor: '#ffffff',
    art: [
      "  ▄██████████████▄  ",
      " ██  █ █▄ █ ▀█▀ █▀▀ █  ",
      " ██  █ █ ▀█  █  █▄▄ █▄▄",
      "  ▀██████████████▀  "
    ]
  },
  'PNY': {
    color: '#76b900',
    secondaryColor: '#cfd8dc',
    art: [
      " ███▄  █▄  █ ▀▄ ▄▀ ",
      " ██▄▄▀ █ ▀▄█   █   ",
      " ██    █   █   █   ",
      " ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ "
    ]
  },
  'MSI': {
    color: '#ff4444',
    secondaryColor: '#ffffff',
    art: [
      " ▛▀▜  █▄ ▄█ ▄▀▀▀ █ ",
      " █▓█  █ ▀ █ ▀▀▀▄ █ ",
      " ▀▄▀  ▀   ▀ ▄▄▄▀ █ ",
      " WORKSTATION // AI "
    ]
  },
  'GIGABYTE': {
    color: '#ff9900',
    secondaryColor: '#55ffff',
    art: [
      " ▄▀▀▀ █ ▄▀▀▀ ▄▀▄ █▄▄ ▀▄▀ ▀█▀ █▀▀",
      " █ ▀█ █ █ ▀█ █▀█ █▄█  █   █  █▄▄",
      " ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀",
      " AI TOP // AORUS // SERVER      "
    ]
  },
  'ASRock': {
    color: '#55ff55',
    secondaryColor: '#ffffff',
    art: [
      " ▄▀▄ ▄▀▀ █▀▄ ▄▀▄ ▄▀▀ █▄▀ ",
      " █▀█ ▀▀▄ █▀▄ █▄█ █▄▄ █ █ ",
      " ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ",
      " RACK // WORKSTATION     "
    ]
  },
  'Corsair': {
    color: '#ffff55',
    secondaryColor: '#ffffff',
    art: [
      "    ◢█   ◢██   ◢███  ",
      "   ███  ████  █████  ",
      "  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ",
      "  C O R S A I R      "
    ]
  },
  'Kingston': {
    color: '#ff5555',
    secondaryColor: '#ffffff',
    art: [
      " ▄██▄  █▄▀ █ █▄ █ ▄▀▀ ",
      " ████  █ █ █ █ ▀█ █▄█ ",
      " ▀██▀  F U R Y  P R O ",
      " ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ "
    ]
  },
  'Samsung': {
    color: '#55ffff',
    secondaryColor: '#ffffff',
    art: [
      "  ▄████████████████▄  ",
      " ██ S A M S U N G ██ ",
      "  ▀████████████████▀  ",
      "  SEMICONDUCTOR ECC   "
    ]
  },
  'Micron': {
    color: '#00e5ff',
    secondaryColor: '#ffffff',
    art: [
      "   ▄████████████▄   ",
      " ▄██ M I C R O N ██▄ ",
      "   ▀████████████▀   ",
      " ENTERPRISE MEMORY  "
    ]
  },
  'SK Hynix': {
    color: '#ff8844',
    secondaryColor: '#ffff55',
    art: [
      " ▀██▄ ▄██▀  ▄▀▀ █▄▀ ",
      "  ████████  ▀▀▄ █ █ ",
      " ▄██▀ ▀██▄  H Y N I X",
      " ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ "
    ]
  },
  'Solidigm': {
    color: '#a882ff',
    secondaryColor: '#55ffff',
    art: [
      "  ◢████◣   ▄▀▀ ▄▀▄ █   ",
      " ◢██░░██◣  ▀▀▄ █▄█ █▄▄ ",
      "  ◥████◤   S O L I D I G M",
      "  DATACENTER NVMe SSD  "
    ]
  },
  'Seagate': {
    color: '#55ff55',
    secondaryColor: '#ffffff',
    art: [
      "  ▄██████▄   ▄▀▀ █▀▀ ▄▀▄",
      " ██░▄██▄░██  ▀▀▄ █▀▀ █▀█",
      "  ▀██████▀   S E A G A T E",
      "  SKYHAWK AI // EXOS   "
    ]
  },
  'Western Digital': {
    color: '#5599ff',
    secondaryColor: '#ffffff',
    art: [
      " ██   ██   ██ ██████▄ ",
      " ██ █ ██ █ ██ ██   ██ ",
      "  ███  ███▀   ██████▀ ",
      "  ULTRASTAR DATACENTER"
    ]
  },
  'SilverStone': {
    color: '#cfd8dc',
    secondaryColor: '#55ffff',
    art: [
      "   ▄█▄██▄█▄   ▄▀▀ █▀▀ ▀█▀",
      "   ████████   ▀▀▄ ▀▀▄  █ ",
      "   ▀█▀██▀█▀   SILVERSTONE",
      "   SERVER // WORKSTATION "
    ]
  },
  'Fractal': {
    color: '#ffd166',
    secondaryColor: '#ffffff',
    art: [
      " ████  █▀▀ █▀▄ ▄▀▄ ▄▀▀",
      " ██▀▀  █▀  █▀▄ █▀█ █▄▄",
      " ██    F R A C T A L  ",
      " SCANDINAVIAN CHASSIS "
    ]
  },
  'APC': {
    color: '#ff5555',
    secondaryColor: '#ffffff',
    art: [
      "   ▄███▄   ████▄  ▄████ ",
      "  ██▄▄▄██  ██▄▄█ ██     ",
      " ██     ██ ██     ▀████ ",
      " NETSHELTER RACK POWER  "
    ]
  },
  'Tripp Lite': {
    color: '#ffff55',
    secondaryColor: '#ffffff',
    art: [
      " ▀██▀ █▀▄ █ █▀▄ █▀▄ ",
      "  ██  █▀▄ █ █▀▀ █▀▀ ",
      "  ▀▀  L I T E  U P S ",
      " SMARTONLINE 208/240V"
    ]
  },
  'Phanteks': {
    color: '#55ffff',
    secondaryColor: '#ffffff',
    art: [
      " ███▄ █  █ ▄▀▄ █▄ █ ",
      " ██▀▀ █▀▀█ █▀█ █ ▀█ ",
      " ██   P H A N T E K S",
      " ENTHOO PRO SERVER  "
    ]
  },
  'Arctic': {
    color: '#00e5ff',
    secondaryColor: '#ffffff',
    art: [
      "   ◢██◣   ▄▀▄ █▀▄ ▄▀▀",
      "  ◢█░░█◣  █▀█ █▀▄ █▄▄",
      "  A R C T I C  C O O L",
      "  SERVER / WORKSTATION"
    ]
  },
  'Noctua': {
    color: '#d48855',
    secondaryColor: '#ffffff',
    art: [
      "  ▄██▄ ▄██▄  █▄ █ ▄▀▄",
      "  ██●█ █●██  █ ▀█ █▄█",
      "   ▀█████▀   NOCTUA  ",
      "  AUSTRIAN COOLING   "
    ]
  },
  'be quiet!': {
    color: '#ff9900',
    secondaryColor: '#ffffff',
    art: [
      " █▄▄ █▀▀   ▄▀▄ █ █ █ ",
      " █▄█ █▄▄   ▀▄█ ▀▄▀ █ ",
      " B E   Q U I E T !   ",
      " DARK POWER TITANIUM "
    ]
  },
  'Seasonic': {
    color: '#00b4d8',
    secondaryColor: '#ffffff',
    art: [
      "  ▄▀▀ █▀▀ ▄▀▄ ▄▀▀ ▄▀▄",
      "  ▀▀▄ █▄▄ █▀█ ▀▀▄ █▄█",
      "  S E A S O N I C    ",
      "  PRIME TX TITANIUM  "
    ]
  },
  'Lenovo': {
    color: '#ff4444',
    secondaryColor: '#ffffff',
    art: [
      " ████████████████████",
      " █ L E N O V O      █",
      " ████████████████████",
      " THINKSTATION PGX AI "
    ]
  },
  'Central': {
    color: '#00894a',
    secondaryColor: '#ffffff',
    art: [
      "  ▄█████▄   CENTRAL  ",
      " ██░░█▀▀    COMPUTERS",
      "  ▀█████▀   BAY AREA ",
      "  SILICON // AI READY"
    ]
  }
};

/**
 * Renders a high-resolution product illustration using our 88x52 subpixel + ANSI tile engine
 * with rich per-product variance so cycling through products within any category updates the art!
 */
function renderPixelArtHTML(templateName, colorVariant, prod = null) {
  const cacheKey = `${templateName}|${colorVariant}|${prod ? prod.id : ''}`;
  if (ART_CACHE.has(cacheKey)) {
    return ART_CACHE.get(cacheKey);
  }

  const cv = new AnsiCanvas(88, 52);

  switch (templateName) {
    case 'gpu-blower':
      drawGpuBlower(cv, colorVariant, prod);
      break;
    case 'gpu-triple':
      drawGpuTriple(cv, colorVariant, prod);
      break;
    case 'cpu-chip':
      drawCpuChip(cv, colorVariant, prod);
      break;
    case 'ram-dimm':
      drawRamDimm(cv, colorVariant, prod);
      break;
    case 'motherboard':
      drawMotherboard(cv, colorVariant, prod);
      break;
    case 'ssd-drive':
      drawSsdDrive(cv, colorVariant, prod);
      break;
    case 'hdd-drive':
      drawHddDrive(cv, colorVariant, prod);
      break;
    case 'cpu-cooler':
      drawCpuCooler(cv, colorVariant, prod);
      break;
    case 'psu-unit':
      drawPsuUnit(cv, colorVariant, prod);
      break;
    case 'desktop-case':
      drawDesktopCase(cv, colorVariant, prod);
      break;
    case 'rackmount':
      drawRackmount(cv, colorVariant, prod);
      break;
    case 'accelerator':
      drawAccelerator(cv, colorVariant, prod);
      break;
    case 'hpc-power':
      drawHpcPower(cv, colorVariant, prod);
      break;
    case 'ai-super':
      drawAiSuper(cv, colorVariant, prod);
      break;
    default:
      drawGpuBlower(cv, colorVariant, prod);
      break;
  }

  const html = cv.toHTML();
  ART_CACHE.set(cacheKey, html);
  return html;
}

function renderConnectorHTML(connKey) {
  const conn = CONNECTOR_ART[connKey] || CONNECTOR_ART['12v-2x6'];
  const art = conn.grid.join('\n');
  return `<div style="color:#55ffff">${art}</div><span class="connector-label">${conn.label}</span>`;
}

function renderMfgBadgeHTML(mfgName) {
  const badge = MANUFACTURER_BADGES[mfgName] || {
    color: '#55ffff',
    art: [
      "████████████████",
      "██░░████████░░██",
      "████████████████",
      mfgName.toUpperCase()
    ]
  };
  return `
    <div class="mfg-tile-badge">
      <div class="mfg-pixel-art" style="color:${badge.color}">${badge.art.join('\n')}</div>
      <div class="mfg-name-label" style="color:${badge.color}">${mfgName}</div>
    </div>
  `;
}
