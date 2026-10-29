// Performance page: weekly (Friday) account values against the stock.
// Reads data/performance.json, written by /home/ben/GIT/crons/optionicity_performance.
// Plain JS (from optionicity-app ui/src/performance.ts), no build step.
// The JSON holds % values already worked out (since the first Friday and week over
// week); the site is public, so it has no balances. Only the stock has a raw value (its price).
async function fetchPerformance() {
  const resp = await fetch("data/performance.json", { cache: "no-store" });
  if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
  return resp.json();
}
const SVG = "http://www.w3.org/2000/svg";
const ACCOUNT_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
const hidden = /* @__PURE__ */ new Set();
const $ = (id) => document.getElementById(id);
const tip = $("tip");
const signed = (v, digits = 2) => `${v >= 0 ? "+" : "\u2212"}${Math.abs(v).toFixed(digits)}`;
const pctText = (v) => v == null ? "\u2014" : `${signed(v)}%`;
const tone = (v) => v == null ? "" : v >= 0 ? "up" : "down";
const shortDate = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
function el(tag, attrs, parent) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}
function ticks(lo, hi) {
  const raw = (hi - lo) / 5 || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}
function showTip(html, ev) {
  tip.innerHTML = html;
  tip.hidden = false;
  const { width, height } = tip.getBoundingClientRect();
  const x = ev.clientX + 16 + width > innerWidth ? ev.clientX - 16 - width : ev.clientX + 16;
  const y = Math.min(Math.max(8, ev.clientY - height / 2), innerHeight - height - 8);
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
function key(s, box = false) {
  return box ? `<span class="key box" style="background:${s.color}"></span>` : `<span class="key${s.dashed ? " dashed" : ""}" style="border-color:${s.color}"></span>`;
}
function renderLegend(container, series, onToggle) {
  container.innerHTML = "";
  for (const s of series) {
    const b = document.createElement("button");
    b.innerHTML = `${key(s, !onToggle)}${s.label}`;
    if (onToggle) {
      b.classList.toggle("off", hidden.has(s.id));
      b.title = "Show or hide this line";
      b.onclick = () => {
        hidden.has(s.id) ? hidden.delete(s.id) : hidden.add(s.id);
        onToggle();
      };
    } else {
      b.disabled = true;
      b.style.cursor = "default";
    }
    container.appendChild(b);
  }
}
function renderLineChart(container, fridays, all) {
  const series = all.filter((s) => !hidden.has(s.id));
  const cum = new Map(series.map((s) => [s.id, s.cum]));
  const width = Math.max(320, container.clientWidth);
  const height = width < 600 ? 260 : 380;
  const m = { top: 14, right: width < 600 ? 64 : 96, bottom: 28, left: 52 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const nums = [0, ...[...cum.values()].flat().filter((v) => v != null)];
  let lo = Math.min(...nums), hi = Math.max(...nums);
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad;
  hi += pad;
  const x = (i) => m.left + (fridays.length > 1 ? i / (fridays.length - 1) * w : w / 2);
  const y = (v) => m.top + (hi - v) / (hi - lo) * h;
  container.innerHTML = "";
  const svg = el("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "% change since the first Friday, per account, total and stock"
  }, container);
  for (const t of ticks(lo, hi)) {
    el("line", {
      x1: m.left,
      x2: m.left + w,
      y1: y(t),
      y2: y(t),
      stroke: t === 0 ? "var(--dim)" : "var(--grid)",
      "stroke-width": 1
    }, svg);
    el("text", { x: m.left - 8, y: y(t) + 4, "text-anchor": "end" }, svg).textContent = `${t > 0 ? "+" : ""}${t}%`;
  }
  const every = Math.ceil(fridays.length / Math.max(2, Math.floor(w / 56)));
  fridays.forEach((d, i) => {
    if (i % every && i !== fridays.length - 1) return;
    el("text", { x: x(i), y: height - 8, "text-anchor": "middle" }, svg).textContent = shortDate(d);
  });
  for (const s of series) {
    const pts = cum.get(s.id);
    let d = "";
    pts.forEach((v, i) => {
      if (v != null) d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    el("path", {
      d,
      fill: "none",
      stroke: s.color,
      "stroke-width": s.id === "total" ? 3 : 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      ...s.dashed ? { "stroke-dasharray": "6 5" } : {}
    }, svg);
  }
  const ends = series.filter((s) => s.id === "total" || s.id === "bench").map((s) => ({ s, v: cum.get(s.id).at(-1) })).filter((e) => e.v != null).map((e) => ({ ...e, ty: y(e.v) + 4 })).sort((a, b) => a.ty - b.ty);
  if (ends.length === 2 && ends[1].ty - ends[0].ty < 14) {
    const mid = (ends[0].ty + ends[1].ty) / 2;
    ends[0].ty = mid - 7;
    ends[1].ty = mid + 7;
  }
  for (const e of ends) {
    el("text", { x: x(fridays.length - 1) + 8, y: e.ty, class: "end-label" }, svg).textContent = `${e.s.id === "total" ? "Total" : e.s.label} ${signed(e.v, 1)}%`;
  }
  const hover = el("g", { visibility: "hidden" }, svg);
  const cross = el("line", { y1: m.top, y2: m.top + h, stroke: "var(--dim)", "stroke-width": 1 }, hover);
  const dots = series.map((s) => el("circle", { r: 4.5, fill: s.color, stroke: "var(--surface)", "stroke-width": 2 }, hover));
  const hit = el("rect", { x: m.left - 10, y: 0, width: w + 20, height, fill: "transparent" }, svg);
  hit.addEventListener("mousemove", (ev) => {
    const box = svg.getBoundingClientRect();
    const px = (ev.clientX - box.left) / box.width * width;
    const i = Math.max(0, Math.min(fridays.length - 1, Math.round((px - m.left) / w * (fridays.length - 1))));
    hover.setAttribute("visibility", "visible");
    cross.setAttribute("x1", String(x(i)));
    cross.setAttribute("x2", String(x(i)));
    const rows = series.map((s, k) => {
      const v = cum.get(s.id)[i];
      dots[k].setAttribute("visibility", v == null ? "hidden" : "visible");
      if (v != null) {
        dots[k].setAttribute("cx", String(x(i)));
        dots[k].setAttribute("cy", String(y(v)));
      }
      // No dollars on the public site, so only the stock shows a raw value (its price).
      const raw = s.id === "bench" ? s.values[i] : null;
      const rawText = s.id !== "bench" ? "" : raw == null ? "\u2014" : `$${raw.toFixed(2)}`;
      return { v, html: `<div class="tip-row">${key(s)}<span>${s.label}</span><span class="num">${rawText}</span><span class="num ${tone(v)}">${pctText(v)}</span></div>` };
    }).sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
    showTip(`<div class="tip-date">Fri ${fridays[i]} \xB7 since ${shortDate(fridays[0])}</div>${rows.map((r) => r.html).join("")}`, ev);
  });
  hit.addEventListener("mouseleave", () => {
    hover.setAttribute("visibility", "hidden");
    tip.hidden = true;
  });
}
function renderBarChart(container, fridays, pair) {
  const wk = pair.map((s) => s.week);
  const width = Math.max(320, container.clientWidth);
  const height = width < 600 ? 220 : 280;
  const m = { top: 12, right: 12, bottom: 28, left: 52 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const weeks = fridays.length - 1;
  const nums = [0, ...wk.flat().filter((v) => v != null)];
  let lo = Math.min(...nums), hi = Math.max(...nums);
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad;
  hi += pad;
  const y = (v) => m.top + (hi - v) / (hi - lo) * h;
  const slot = w / Math.max(1, weeks);
  const gap = 2;
  const barW = Math.max(3, Math.min(28, (slot * 0.7 - gap * (pair.length - 1)) / pair.length));
  container.innerHTML = "";
  const svg = el("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Week-over-week % change"
  }, container);
  for (const t of ticks(lo, hi)) {
    el("line", { x1: m.left, x2: m.left + w, y1: y(t), y2: y(t), stroke: "var(--grid)", "stroke-width": 1 }, svg);
    el("text", { x: m.left - 8, y: y(t) + 4, "text-anchor": "end" }, svg).textContent = `${t > 0 ? "+" : ""}${t}%`;
  }
  const every = Math.ceil(weeks / Math.max(2, Math.floor(w / 56)));
  for (let i = 1; i <= weeks; i++) {
    const cx = m.left + (i - 0.5) * slot;
    if ((i - 1) % every === 0 || i === weeks) {
      el("text", { x: cx, y: height - 8, "text-anchor": "middle" }, svg).textContent = shortDate(fridays[i]);
    }
    const groupW = pair.length * barW + (pair.length - 1) * gap;
    pair.forEach((s, k) => {
      const v = wk[k][i];
      if (v == null) return;
      const bx = cx - groupW / 2 + k * (barW + gap);
      const top = y(Math.max(v, 0)), bottom = y(Math.min(v, 0));
      const r = Math.min(4, barW / 2, bottom - top);
      const d = v >= 0 ? `M${bx},${bottom}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + barW - r}Q${bx + barW},${top} ${bx + barW},${top + r}V${bottom}Z` : `M${bx},${top}V${bottom - r}Q${bx},${bottom} ${bx + r},${bottom}H${bx + barW - r}Q${bx + barW},${bottom} ${bx + barW},${bottom - r}V${top}Z`;
      el("path", { d, fill: s.color }, svg);
    });
    const hit = el("rect", { x: cx - slot / 2, y: m.top, width: slot, height: h, fill: "transparent" }, svg);
    hit.addEventListener("mousemove", (ev) => {
      const rows = pair.map((s, k) => `<div class="tip-row">${key(s, true)}<span>${s.label}</span><span></span><span class="num ${tone(wk[k][i])}">${pctText(wk[k][i])}</span></div>`).join("");
      const [a, b] = [wk[0][i], wk[1]?.[i]];
      const diff = a != null && b != null ? `<div class="tip-row"><span></span><span>Difference</span><span></span><span class="num ${tone(a - b)}">${signed(a - b)} pts</span></div>` : "";
      showTip(`<div class="tip-date">Week ending Fri ${fridays[i]}</div>${rows}${diff}`, ev);
      hit.setAttribute("fill", "rgba(120,140,255,0.08)");
    });
    hit.addEventListener("mouseleave", () => {
      tip.hidden = true;
      hit.setAttribute("fill", "transparent");
    });
  }
  el("line", { x1: m.left, x2: m.left + w, y1: y(0), y2: y(0), stroke: "var(--dim)", "stroke-width": 1 }, svg);
}
function renderTiles(fridays, total, bench) {
  const first = shortDate(fridays[0]);
  const t = total.cum.at(-1);
  const tiles = [
    `<div class="tile"><div class="label">TOTAL ACCOUNTS \xB7 ${shortDate(fridays.at(-1))}</div><div class="big ${tone(t)}">${pctText(t)}</div><div class="sub">since ${first}</div></div>`
  ];
  if (bench) {
    const b = bench.cum.at(-1);
    const tw = total.week, bw = bench.week;
    const beat = tw.filter((v, i) => v != null && bw[i] != null && v > bw[i]).length;
    const counted = tw.filter((v, i) => v != null && bw[i] != null).length;
    tiles.push(
      `<div class="tile"><div class="label">${bench.label} \xB7 ${shortDate(fridays.at(-1))}</div><div class="big">${bench.values.at(-1) != null ? `$${bench.values.at(-1).toFixed(2)}` : "\u2014"}</div><div class="sub"><span class="${tone(b ?? null)}">${pctText(b ?? null)}</span> since ${first}</div></div>`,
      `<div class="tile"><div class="label">TOTAL VS ${bench.label}</div><div class="big ${tone(b == null ? null : t - b)}">${b == null ? "\u2014" : `${signed(t - b)} pts`}</div><div class="sub">${b == null ? "" : t >= b ? "outperforming the stock" : "trailing the stock"}</div></div>`,
      `<div class="tile"><div class="label">WEEKS BEATING ${bench.label}</div><div class="big">${beat} of ${counted}</div><div class="sub">total's week % above the stock's</div></div>`
    );
  }
  $("tiles").innerHTML = tiles.join("");
}
function renderTable(fridays, series, total, bench) {
  const wk = new Map(series.map((s) => [s.id, s.week]));
  const cum = new Map(series.map((s) => [s.id, s.cum]));
  const head = `<tr><th>Friday</th>${series.map((s) => `<th>${s.label}</th>`).join("")}${bench ? `<th>Total \u2212 ${bench.label}<br>(week, pts)</th>` : ""}</tr>`;
  const body = fridays.map((d, i) => {
    const cells = series.map((s) => {
      const p = wk.get(s.id)[i];
      // Accounts show % since the first Friday (no dollars on the public site); the stock its price.
      const price = s.id === "bench" ? s.values[i] : null;
      const text = s.id !== "bench" ? pctText(cum.get(s.id)[i]) : price == null ? "\u2014" : `$${price.toFixed(2)}`;
      return `<td>${text}<span class="pct ${tone(p)}">${i ? pctText(p) : ""}</span></td>`;
    }).join("");
    const tw = wk.get(total.id)[i], bw = bench ? wk.get(bench.id)[i] : null;
    const diff = bench ? `<td class="${tw != null && bw != null ? tone(tw - bw) : ""}">${tw != null && bw != null ? signed(tw - bw) : "\u2014"}</td>` : "";
    return `<tr><td>${d}</td>${cells}${diff}</tr>`;
  }).reverse().join("");
  $("table").innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
}
function render(p) {
  const { fridays } = p;
  if (p.notice) {
    $("notice").textContent = p.notice;
    $("notice").hidden = false;
  }
  if (fridays.length < 2) {
    $("range").textContent = "Not enough Fridays yet";
    return;
  }
  $("range").textContent = `${fridays[0]} \u2192 ${fridays.at(-1)} \xB7 ${fridays.length} Fridays`;
  $("start").textContent = `Fri ${shortDate(fridays[0])}`;
  const accounts = p.accounts.map((a, i) => ({
    id: `acct-${a.id}`,
    label: a.name,
    color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
    cum: a.since_start,
    week: a.week
  }));
  const total = {
    id: "total",
    label: "Total accounts",
    color: "var(--s5)",
    cum: p.total.since_start,
    week: p.total.week
  };
  const bench = p.benchmark ? { id: "bench", label: p.symbol, color: "var(--bench)", dashed: true, values: p.benchmark.price, cum: p.benchmark.since_start, week: p.benchmark.week } : null;
  const lines = [...accounts, total, ...bench ? [bench] : []];
  let compare = total;
  const select = document.createElement("select");
  select.innerHTML = [total, ...accounts].map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  select.onchange = () => {
    compare = [total, ...accounts].find((s) => s.id === select.value);
    draw();
  };
  $("wow-title").replaceChildren(select, ` vs ${bench ? bench.label : "stock (no prices yet)"}`);
  const draw = () => {
    renderLegend($("legend"), lines, draw);
    renderLineChart($("line-chart"), fridays, lines);
    const pair = [compare, ...bench ? [bench] : []];
    renderLegend($("wow-legend"), pair);
    renderBarChart($("bar-chart"), fridays, pair);
  };
  draw();
  renderTiles(fridays, total, bench);
  renderTable(fridays, lines, total, bench);
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(draw, 100);
  }).observe($("line-chart"));
}
fetchPerformance().then(render).catch((e) => {
  $("range").textContent = "Could not load performance data";
  $("notice").textContent = String(e);
  $("notice").hidden = false;
});
