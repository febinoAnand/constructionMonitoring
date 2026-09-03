/* ============================================================
   Lightweight, dependency-free chart rendering (bars, donuts,
   progress rings) built from plain DOM/SVG, styled to match
   assets/style.css. No charting library — keeps the app at
   zero external JS dependencies.
   ============================================================ */

(function () {
  "use strict";

  var PALETTE = ["#f59e0b", "#2563eb", "#16a34a", "#ec4899", "#475569", "#ea580c", "#0ea5e9", "#b45309"];

  function fmtCompact(n) {
    if (n >= 10000000) return (n / 10000000).toFixed(1) + "Cr";
    if (n >= 100000) return (n / 100000).toFixed(1) + "L";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(Math.round(n));
  }

  /* items: [{ label, value }] */
  function renderBarChart(container, items, opts) {
    opts = opts || {};
    if (!items.length || items.every(function (i) { return i.value === 0; })) {
      container.innerHTML = '<div class="chart-empty">No data yet</div>';
      return;
    }
    var max = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    var html = '<div class="chart-bar-wrap">' + items.map(function (item) {
      var pct = Math.max(2, Math.round((item.value / max) * 100));
      var displayVal = opts.formatValue ? opts.formatValue(item.value) : fmtCompact(item.value);
      return '<div class="bar-col" title="' + item.label + ': ' + displayVal + '">' +
        '<span class="bar-value">' + displayVal + '</span>' +
        '<div class="bar-shape" style="height:' + pct + '%"></div>' +
        '<span class="bar-label">' + item.label + '</span>' +
      '</div>';
    }).join("") + '</div>';
    container.innerHTML = html;
  }

  /* items: [{ label, value }] — colors assigned from PALETTE in order */
  function renderDonutChart(container, items, opts) {
    opts = opts || {};
    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    if (!total) {
      container.innerHTML = '<div class="chart-empty">No data yet</div>';
      return;
    }

    var size = opts.size || 160;
    var stroke = opts.stroke || 22;
    var radius = (size - stroke) / 2;
    var circumference = 2 * Math.PI * radius;
    var cx = size / 2, cy = size / 2;
    var offset = 0;

    var segments = items.map(function (item, i) {
      var color = item.color || PALETTE[i % PALETTE.length];
      var frac = item.value / total;
      var dash = frac * circumference;
      var seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + color + '" ' +
        'stroke-width="' + stroke + '" stroke-dasharray="' + dash + ' ' + (circumference - dash) + '" ' +
        'stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt"></circle>';
      offset += dash;
      return { svg: seg, color: color, item: item, frac: frac };
    });

    var centerLabel = opts.centerLabel || "Total";
    var centerValue = opts.formatValue ? opts.formatValue(total) : fmtCompact(total);

    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="var(--border)" stroke-width="' + stroke + '"></circle>' +
      segments.map(function (s) { return s.svg; }).join("") +
      '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" class="donut-center-value">' + centerValue + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" class="donut-center-label">' + centerLabel + '</text>' +
      '</svg>';

    var legend = '<div class="donut-legend">' + segments.map(function (s) {
      var val = opts.formatValue ? opts.formatValue(s.item.value) : fmtCompact(s.item.value);
      return '<div class="donut-legend-item">' +
        '<span class="donut-legend-dot" style="background:' + s.color + '"></span>' +
        '<span class="donut-legend-label">' + s.item.label + '</span>' +
        '<span class="donut-legend-value">' + val + '</span>' +
      '</div>';
    }).join("") + '</div>';

    container.innerHTML = '<div class="donut-wrap">' + svg + legend + '</div>';
  }

  /* Single-value ring, e.g. project % complete. */
  function renderProgressRing(container, percent, opts) {
    opts = opts || {};
    var size = opts.size || 96;
    var stroke = opts.stroke || 10;
    var radius = (size - stroke) / 2;
    var circumference = 2 * Math.PI * radius;
    var clamped = Math.max(0, Math.min(100, percent));
    var dash = (clamped / 100) * circumference;
    var color = opts.color || (clamped >= 80 ? "#16a34a" : clamped >= 40 ? "#f59e0b" : "#ea580c");
    var cx = size / 2, cy = size / 2;

    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="var(--border)" stroke-width="' + stroke + '"></circle>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" ' +
        'stroke-dasharray="' + dash + ' ' + (circumference - dash) + '" stroke-linecap="round" ' +
        'transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>' +
      '<text x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle" class="progress-ring-value">' + Math.round(clamped) + '%</text>' +
      '</svg>';

    container.innerHTML = svg;
  }

  /* Linear (horizontal) progress bar — same use-case as renderProgressRing,
     preferred wherever a compact/list-friendly indicator is needed. */
  function renderProgressBar(container, percent, opts) {
    opts = opts || {};
    var clamped = Math.max(0, Math.min(100, percent));
    var color = opts.color || (clamped >= 80 ? "#16a34a" : clamped >= 40 ? "#f59e0b" : "#ea580c");
    var mini = !!opts.mini;
    var barHtml = '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + clamped + '%;background:' + color + '"></div></div>';

    if (mini) {
      container.innerHTML = '<div class="progress-bar-mini">' + barHtml + '<span>' + Math.round(clamped) + '%</span></div>';
      return;
    }

    container.innerHTML = '<div class="progress-bar-wrap">' +
      '<div class="progress-bar-head"><strong>' + Math.round(clamped) + '% complete</strong>' + (opts.metaText ? '<span>' + opts.metaText + '</span>' : '') + '</div>' +
      barHtml +
    '</div>';
  }

  window.Charts = {
    renderBarChart: renderBarChart,
    renderDonutChart: renderDonutChart,
    renderProgressRing: renderProgressRing,
    renderProgressBar: renderProgressBar,
    fmtCompact: fmtCompact,
    PALETTE: PALETTE
  };
})();
