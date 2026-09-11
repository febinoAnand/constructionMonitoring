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

  /* Single-value ring, e.g. project % complete. Pass opts.fontSize (+ optionally omit the
     label entirely with opts.hideLabel) to scale the center text down for small/mini rings —
     the default 22px (set in CSS) only suits the full-size ring. */
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
    var fontSize = opts.fontSize || 22;

    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="var(--border)" stroke-width="' + stroke + '"></circle>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" ' +
        'stroke-dasharray="' + dash + ' ' + (circumference - dash) + '" stroke-linecap="round" ' +
        'transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>' +
      (opts.hideLabel ? '' :
        '<text x="' + cx + '" y="' + (cy + fontSize * 0.32) + '" text-anchor="middle" class="progress-ring-value" style="font-size:' + fontSize + 'px">' + Math.round(clamped) + '%</text>') +
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

  /* Horizontal Gantt-style timeline. rows: [{ id, label, status, start, estimate, completed }]
     start/estimate/completed are ISO date strings ("YYYY-MM-DD") or falsy. Rows without a
     start date are skipped (nothing to plot). Clicking a bar fires opts.onSelect(id) if given. */
  function renderGanttChart(container, rows, opts) {
    opts = opts || {};
    var DAY = 86400000;
    function toTime(iso) { return new Date(iso + "T00:00:00").getTime(); }
    function isoDaysBetween(isoStart, isoEnd) { return Math.round((toTime(isoEnd) - toTime(isoStart)) / DAY); }

    var plotRows = rows.filter(function (r) { return !!r.start; });
    if (!plotRows.length) {
      container.innerHTML = '<div class="chart-empty">No dated tasks yet</div>';
      return;
    }

    var todayIso = opts.todayIso || new Date().toISOString().slice(0, 10);
    var todayTime = toTime(todayIso);

    var allTimes = [todayTime];
    plotRows.forEach(function (r) {
      allTimes.push(toTime(r.start));
      if (r.estimate) allTimes.push(toTime(r.estimate));
      if (r.completed) allTimes.push(toTime(r.completed));
    });
    var minTime = Math.min.apply(null, allTimes) - 2 * DAY;
    var maxTime = Math.max.apply(null, allTimes) + 2 * DAY;
    var span = Math.max(maxTime - minTime, DAY);
    function pct(t) { return ((t - minTime) / span) * 100; }

    var spanDays = span / DAY;
    var ticks = [];
    var guard = 0;
    if (spanDays <= 35) {
      var dd = new Date(minTime);
      dd.setHours(0, 0, 0, 0);
      while (dd.getTime() <= maxTime && guard < 40) {
        var isMonthStart = dd.getDate() === 1;
        ticks.push({
          label: isMonthStart ? dd.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : String(dd.getDate()),
          pct: pct(dd.getTime()),
          isMonthStart: isMonthStart
        });
        dd = new Date(dd.getTime() + DAY);
        guard++;
      }
    } else if (spanDays <= 70) {
      var wd = new Date(minTime);
      while (wd.getTime() <= maxTime && guard < 60) {
        ticks.push({ label: wd.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), pct: pct(wd.getTime()) });
        wd = new Date(wd.getTime() + 7 * DAY);
        guard++;
      }
    } else {
      var d = new Date(minTime);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      while (d.getTime() <= maxTime && guard < 48) {
        ticks.push({ label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), pct: pct(d.getTime()) });
        d.setMonth(d.getMonth() + 1);
        guard++;
      }
    }

    var statusColor = { todo: "#f59e0b", in_progress: "#2563eb", done: "#16a34a" };

    var labelsHtml = '<div class="gantt-label-cell gantt-scale-spacer"></div>' + plotRows.map(function (r) {
      return '<div class="gantt-label-cell" title="' + r.label + '" data-gantt-open="' + r.id + '">' + r.label + '</div>';
    }).join("");

    var trackRowsHtml = plotRows.map(function (r) {
      var startTime = toTime(r.start);
      var endTime = r.completed ? toTime(r.completed) : (r.estimate ? toTime(r.estimate) : startTime + DAY);
      if (endTime < startTime) endTime = startTime + DAY;
      var startPct = pct(startTime);
      var widthPct = Math.max(0.8, pct(endTime) - startPct);
      var overdue = !r.completed && r.estimate && toTime(r.estimate) < todayTime;
      var color = r.completed ? statusColor.done : (overdue ? "#dc2626" : (statusColor[r.status] || statusColor.todo));
      var marker = (!r.completed && r.estimate)
        ? '<span class="gantt-marker" style="left:' + pct(toTime(r.estimate)) + '%" title="Estimated completion: ' + r.estimate + '"></span>'
        : '';
      var durationDays = r.durationDays || (r.estimate ? isoDaysBetween(r.start, r.estimate) : null);
      var durationLabel = durationDays ? (durationDays + "d") : "";
      var barLabel = (r.completed ? "Completed " + r.completed : (r.estimate ? "Est. completion " + r.estimate : "")) +
        (durationDays ? " · " + durationDays + " day" + (durationDays === 1 ? "" : "s") : "");
      return '<div class="gantt-track-row">' +
        '<div class="gantt-bar" style="left:' + startPct + '%;width:' + widthPct + '%;background:' + color + '" title="' + r.label + (barLabel ? " — " + barLabel : "") + '" data-gantt-open="' + r.id + '">' +
          (durationLabel ? '<span class="gantt-bar-label" style="color:' + color + '">' + durationLabel + '</span>' : '') +
        '</div>' +
        marker +
      '</div>';
    }).join("");

    container.innerHTML =
      '<div class="gantt-chart">' +
        '<div class="gantt-labels">' + labelsHtml + '</div>' +
        '<div class="gantt-tracks">' +
          '<div class="gantt-scale-row">' + ticks.map(function (tk) {
            var edgeClass = tk.pct < 4 ? " gantt-tick-edge-start" : (tk.pct > 96 ? " gantt-tick-edge-end" : "");
            return '<span class="gantt-tick' + (tk.isMonthStart ? ' gantt-tick-month' : '') + edgeClass + '" style="left:' + tk.pct + '%">' + tk.label + '</span>';
          }).join("") + '</div>' +
          trackRowsHtml +
          '<div class="gantt-today-line" style="left:' + pct(todayTime) + '%" title="Today"></div>' +
        '</div>' +
      '</div>' +
      '<div class="gantt-legend">' +
        '<span><i style="background:' + statusColor.todo + '"></i>To Do</span>' +
        '<span><i style="background:' + statusColor.in_progress + '"></i>In Progress</span>' +
        '<span><i style="background:' + statusColor.done + '"></i>Done</span>' +
        '<span><i style="background:#dc2626"></i>Overdue</span>' +
        '<span><i class="gantt-legend-marker"></i>Estimated completion</span>' +
      '</div>';

    if (opts.onSelect) {
      container.querySelectorAll("[data-gantt-open]").forEach(function (el) {
        el.addEventListener("click", function () { opts.onSelect(el.getAttribute("data-gantt-open")); });
      });
    }
  }

  window.Charts = {
    renderBarChart: renderBarChart,
    renderDonutChart: renderDonutChart,
    renderProgressRing: renderProgressRing,
    renderProgressBar: renderProgressBar,
    renderGanttChart: renderGanttChart,
    fmtCompact: fmtCompact,
    PALETTE: PALETTE
  };
})();
