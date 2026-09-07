/* ============================================================
   Construction business logic — pure functions over Data.
   Kept separate from data.js (storage) and app.js (UI behavior).
   ============================================================ */

(function () {
  "use strict";

  function inRange(dateStr, from, to) {
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  }

  /* Earned = Σ daysWorked × wageRate (snapshotted at entry time).
     Paid = Σ wagePayments.amount. Owed = Earned − Paid. */
  function getWageSummary(labourerId, opts) {
    opts = opts || {};
    var attendance = window.Data.getAttendance().filter(function (a) {
      if (a.labourerId !== labourerId) return false;
      if (opts.projectId && a.projectId !== opts.projectId) return false;
      return inRange(a.date, opts.from, opts.to);
    });
    var earned = attendance.reduce(function (sum, a) { return sum + a.daysWorked * a.wageRate; }, 0);

    var payments = window.Data.getWagePayments().filter(function (p) {
      if (p.labourerId !== labourerId) return false;
      if (opts.projectId && p.projectId !== opts.projectId) return false;
      return inRange(p.date, opts.from, opts.to);
    });
    var paid = payments.reduce(function (sum, p) { return sum + p.amount; }, 0);

    return {
      daysWorked: attendance.reduce(function (sum, a) { return sum + a.daysWorked; }, 0),
      earned: earned,
      paid: paid,
      owed: earned - paid,
      attendance: attendance,
      payments: payments
    };
  }

  /* Balance = Σ inward − Σ outward ± Σ adjustment, derived on every read. */
  function getStockBalance(projectId, materialId) {
    var txns = window.Data.getStockTransactions().filter(function (t) {
      return t.projectId === projectId && t.materialId === materialId;
    });
    var balance = 0;
    txns.forEach(function (t) {
      if (t.type === "inward") balance += t.quantity;
      else if (t.type === "outward") balance -= t.quantity;
      else if (t.type === "adjustment") balance += t.quantity;
    });
    var material = window.Data.getMaterials().find(function (m) { return m.id === materialId; });
    var isLowStock = material ? balance < material.reorderThreshold : false;
    return { balance: balance, isLowStock: isLowStock, txns: txns };
  }

  /* Only considers materials the project has actually transacted at least once —
     a material the project has never ordered isn't "low stock", it just hasn't started. */
  function getAllStockBalances(projectId) {
    var materials = window.Data.getMaterials();
    return materials.map(function (m) {
      var b = getStockBalance(projectId, m.id);
      return { material: m, balance: b.balance, isLowStock: b.isLowStock && b.txns.length > 0, hasActivity: b.txns.length > 0 };
    });
  }

  /* Supervisors carry one monthly salary figure (no payment ledger — see user.monthlySalary).
     Attributed in full to every project they're currently assigned to. */
  function getSupervisorsForProject(projectId) {
    return window.Data.getUsers().filter(function (u) {
      return u.roleId === "r_supervisor" && (u.assignedProjectIds || []).indexOf(projectId) !== -1;
    });
  }

  function getSupervisorSalaryTotal(projectId) {
    return getSupervisorsForProject(projectId).reduce(function (sum, u) { return sum + (u.monthlySalary || 0); }, 0);
  }

  /* Cash-basis project cost = inward stock spend + wages actually paid out + supervisor
     salary + other expenses. Deliberately excludes wages *owed* (accrued but unpaid) to
     avoid double-counting — that figure is surfaced separately via getWageSummary. */
  function getProjectCost(projectId) {
    var stockCost = window.Data.getStockTransactions()
      .filter(function (t) { return t.projectId === projectId && t.type === "inward"; })
      .reduce(function (sum, t) { return sum + t.totalAmount; }, 0);

    var wagesPaid = window.Data.getWagePayments()
      .filter(function (p) { return p.projectId === projectId; })
      .reduce(function (sum, p) { return sum + p.amount; }, 0);

    var supervisorSalary = getSupervisorSalaryTotal(projectId);

    var otherExpenses = window.Data.getExpenses()
      .filter(function (e) { return e.projectId === projectId; })
      .reduce(function (sum, e) { return sum + e.amount; }, 0);

    var wagesEarned = window.Data.getAttendance()
      .filter(function (a) { return a.projectId === projectId; })
      .reduce(function (sum, a) { return sum + a.daysWorked * a.wageRate; }, 0);

    return {
      stockCost: stockCost,
      wagesPaid: wagesPaid,
      supervisorSalary: supervisorSalary,
      otherExpenses: otherExpenses,
      totalCashSpent: stockCost + wagesPaid + supervisorSalary + otherExpenses,
      wagesEarned: wagesEarned,
      wagesOwed: wagesEarned - wagesPaid
    };
  }

  /* Linear projection from the latest recorded percent-complete and elapsed days. */
  function estimateCompletion(project) {
    var updates = window.Data.getProgressUpdates()
      .filter(function (p) { return p.projectId === project.id; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    if (!updates.length) {
      return { percentComplete: 0, hasData: false, estimatedDate: null, atRisk: false };
    }

    var latest = updates[updates.length - 1];
    var percentComplete = latest.percentComplete;

    if (percentComplete <= 0) {
      return { percentComplete: 0, hasData: false, estimatedDate: null, atRisk: false, latestNote: latest.notes };
    }

    var start = new Date(project.startDate);
    var latestDate = new Date(latest.date);
    var elapsedDays = Math.max(1, Math.round((latestDate - start) / 86400000));
    var projectedTotalDays = elapsedDays / (percentComplete / 100);
    var estimatedDate = new Date(start.getTime() + projectedTotalDays * 86400000);
    var estimatedIso = window.Data.isoDate(estimatedDate);

    var atRisk = !!project.targetEndDate && estimatedIso > project.targetEndDate;

    return {
      percentComplete: percentComplete,
      hasData: true,
      estimatedDate: estimatedIso,
      atRisk: atRisk,
      latestNote: latest.notes,
      latestUpdateDate: latest.date,
      history: updates
    };
  }

  function getLowStockAlerts() {
    var projects = window.Data.getProjects();
    var alerts = [];
    projects.forEach(function (proj) {
      getAllStockBalances(proj.id).forEach(function (row) {
        if (row.isLowStock) {
          alerts.push({ project: proj, material: row.material, balance: row.balance });
        }
      });
    });
    return alerts;
  }

  /* Projects linked to a customer, and customers linked to a project —
     both sides of the Project.customerIds many-to-many relationship. */
  function getProjectCustomers(projectId) {
    var project = window.Data.getProjects().find(function (p) { return p.id === projectId; });
    if (!project || !project.customerIds) return [];
    var customers = window.Data.getCustomers();
    return project.customerIds
      .map(function (cid) { return customers.find(function (c) { return c.id === cid; }); })
      .filter(Boolean);
  }

  function getCustomerProjects(customerId) {
    return window.Data.getProjects().filter(function (p) {
      return p.customerIds && p.customerIds.indexOf(customerId) !== -1;
    });
  }

  /* Total cash spent (stock + wages paid + other expenses) across every
     project linked to this customer — what it has cost us to serve them. */
  function getCustomerTotalExpenses(customerId) {
    return getCustomerProjects(customerId).reduce(function (sum, p) {
      return sum + getProjectCost(p.id).totalCashSpent;
    }, 0);
  }

  /* Balance due FROM the customer = Σ invoices − Σ receipts. The mirror image
     of getProjectCost, which tracks money the company spends. */
  function getCustomerLedger(customerId) {
    var entries = window.Data.getCustomerLedger().filter(function (e) { return e.customerId === customerId; });
    var invoiced = entries.filter(function (e) { return e.type === "invoice"; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var received = entries.filter(function (e) { return e.type === "receipt"; }).reduce(function (s, e) { return s + e.amount; }, 0);
    return { invoiced: invoiced, received: received, balanceDue: invoiced - received, entries: entries };
  }

  /* Material billing (inward = purchase cost) vs usage (outward = consumed on site),
     per material, for a single project — feeds the Expenses "Material Costs" panel. */
  function getMaterialCostBreakdown(projectId) {
    var materials = window.Data.getMaterials();
    var txns = window.Data.getStockTransactions().filter(function (t) { return t.projectId === projectId; });
    var rows = materials.map(function (m) {
      var matTxns = txns.filter(function (t) { return t.materialId === m.id; });
      var inward = matTxns.filter(function (t) { return t.type === "inward"; });
      var outward = matTxns.filter(function (t) { return t.type === "outward"; });
      var purchasedQty = inward.reduce(function (s, t) { return s + t.quantity; }, 0);
      var purchaseCost = inward.reduce(function (s, t) { return s + t.totalAmount; }, 0);
      var usedQty = outward.reduce(function (s, t) { return s + t.quantity; }, 0);
      var usageCost = outward.reduce(function (s, t) { return s + t.totalAmount; }, 0);
      return {
        material: m,
        purchasedQty: purchasedQty, purchaseCost: purchaseCost,
        usedQty: usedQty, usageCost: usageCost,
        balanceQty: purchasedQty - usedQty,
        hasActivity: matTxns.length > 0
      };
    }).filter(function (r) { return r.hasActivity; });

    var totalPurchaseCost = rows.reduce(function (s, r) { return s + r.purchaseCost; }, 0);
    var totalUsageCost = rows.reduce(function (s, r) { return s + r.usageCost; }, 0);
    return { rows: rows, totalPurchaseCost: totalPurchaseCost, totalUsageCost: totalUsageCost };
  }

  /* Kanban columns for a project: To Do and Done are fixed bookends; In Progress
     is a fixed default middle column; any project-defined extra columns (added
     from the board) are inserted between In Progress and Done, in the order
     they were created. */
  function getProjectStatusColumns(projectId) {
    var customs = window.Data.getTaskStatusDefs()
      .filter(function (s) { return s.projectId === projectId; })
      .sort(function (a, b) { return a.order - b.order; });
    return [{ key: "todo", label: "To Do", builtin: true }, { key: "in_progress", label: "In Progress", builtin: true }]
      .concat(customs.map(function (s) { return { key: s.key, label: s.label, builtin: false, id: s.id }; }))
      .concat([{ key: "done", label: "Done", builtin: true }]);
  }

  /* Percent-complete for a task: driven by its subtasks (inner tasks) when it has
     any, otherwise falls back to a simple done/not-done split on the task status. */
  function getTaskProgress(task) {
    var subtasks = task.subtasks || [];
    if (subtasks.length) {
      var done = subtasks.filter(function (s) { return s.done; }).length;
      return { percent: Math.round((done / subtasks.length) * 100), doneCount: done, totalCount: subtasks.length };
    }
    var percent = task.status === "done" ? 100 : 0;
    return { percent: percent, doneCount: 0, totalCount: 0 };
  }

  function getWagesDueTotal(projectId) {
    var labourers = window.Data.getLabourers();
    var total = 0;
    labourers.forEach(function (lab) {
      total += getWageSummary(lab.id, projectId ? { projectId: projectId } : {}).owed;
    });
    return total;
  }

  window.Business = {
    getWageSummary: getWageSummary,
    getStockBalance: getStockBalance,
    getAllStockBalances: getAllStockBalances,
    getProjectCost: getProjectCost,
    estimateCompletion: estimateCompletion,
    getLowStockAlerts: getLowStockAlerts,
    getWagesDueTotal: getWagesDueTotal,
    getProjectCustomers: getProjectCustomers,
    getCustomerProjects: getCustomerProjects,
    getCustomerTotalExpenses: getCustomerTotalExpenses,
    getCustomerLedger: getCustomerLedger,
    getMaterialCostBreakdown: getMaterialCostBreakdown,
    getProjectStatusColumns: getProjectStatusColumns,
    getSupervisorsForProject: getSupervisorsForProject,
    getSupervisorSalaryTotal: getSupervisorSalaryTotal,
    getTaskProgress: getTaskProgress
  };
})();
