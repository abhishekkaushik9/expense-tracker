// ================= DATA =================
var KEY = "expenseDataV2";
var colors = { Food: "#e67e22", Travel: "#3498db", Shopping: "#e84393", Bills: "#e74c3c",
               Education: "#27ae60", Entertainment: "#8e44ad", Other: "#7f8c8d" };
var categories = Object.keys(colors);
var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

var income = 50000;     // monthly salary
var salaryDay = 1;      // day of month when salary is credited (month starts here)
var expenses = [];      // {date, name, category, amount}
var funds = [];         // {date, name, amount}  (mutual fund investments)

// today's date
function pad(n) { return (n < 10 ? "0" : "") + n; }
var now = new Date();
var todayStr = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
var todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

// sample data so the page is not empty at first
function sample() {
  var y = now.getFullYear(), cm = now.getMonth();
  for (var m = 0; m < cm; m++) {
    var p = y + "-" + pad(m + 1) + "-";
    expenses.push({ date: p + "03", name: "Rent", category: "Bills", amount: 9000 });
    expenses.push({ date: p + "08", name: "Groceries", category: "Food", amount: 3500 + (m % 3) * 400 });
    expenses.push({ date: p + "12", name: "Travel", category: "Travel", amount: 1200 + (m % 4) * 300 });
    expenses.push({ date: p + "18", name: "Shopping", category: "Shopping", amount: 1500 + (m % 5) * 500 });
    funds.push({ date: p + "05", name: "Index Fund SIP", amount: 5000 });
  }
  var c = y + "-" + pad(cm + 1) + "-";
  expenses.push({ date: c + "01", name: "Lunch", category: "Food", amount: 250 });
  expenses.push({ date: c + "01", name: "Bus Ticket", category: "Travel", amount: 100 });
  expenses.push({ date: c + "02", name: "Books", category: "Education", amount: 500 });
  expenses.push({ date: c + "02", name: "Movie", category: "Entertainment", amount: 300 });
}

// load saved data from browser
var loaded = false;
try {
  var s = JSON.parse(localStorage.getItem(KEY));
  if (s) { income = s.income; salaryDay = s.salaryDay; expenses = s.expenses; funds = s.funds; loaded = true; }
} catch (e) {}
if (!loaded) sample();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ income: income, salaryDay: salaryDay, expenses: expenses, funds: funds })); } catch (e) {}
}

// ================= HELPERS =================
function money(n) { return "₹" + n.toLocaleString("en-IN"); }
function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function showDate(d) { var p = d.split("-"); return p[2] + "-" + p[1] + "-" + p[0]; }
function fmt(dt) { return dt.getDate() + " " + monthNames[dt.getMonth()] + " " + dt.getFullYear(); }

// Month number of a date. A new month starts on the salary day.
// Example: salary day 5 -> 3 Nov belongs to October's month, 5 Nov starts November's month.
function cycleKey(dateStr) {
  var p = dateStr.split("-");
  var k = Number(p[0]) * 12 + (Number(p[1]) - 1);
  if (Number(p[2]) < salaryDay) k--;
  return k;
}
function keyDate(k, day) { return new Date(Math.floor(k / 12), k % 12, day); }
function nowKey() { return cycleKey(todayStr); }

function sumKey(list, k) {
  var t = 0;
  list.forEach(function (e) { if (cycleKey(e.date) === k) t += e.amount; });
  return t;
}

var catSelect = document.getElementById("category");
var filterSelect = document.getElementById("filter");
filterSelect.innerHTML = '<option value="All">All</option>';
categories.forEach(function (c) {
  catSelect.innerHTML += "<option>" + c + "</option>";
  filterSelect.innerHTML += "<option>" + c + "</option>";
});
document.getElementById("date").value = todayStr;
document.getElementById("incomeInput").value = income;
document.getElementById("dayInput").value = salaryDay;

// ================= SUMMARY =================
function showSummary() {
  var k = nowKey();
  var exp = sumKey(expenses, k), inv = sumKey(funds, k), bal = income - exp - inv;
  var used = income > 0 ? Math.min(100, Math.round((exp + inv) / income * 100)) : 100;

  document.getElementById("sIncome").innerText = money(income);
  document.getElementById("sExpense").innerText = money(exp);
  document.getElementById("sInvest").innerText = money(inv);
  document.getElementById("sBalance").innerText = money(bal);

  var bar = document.getElementById("bar");
  bar.style.width = used + "%";
  bar.style.background = used < 60 ? "green" : used < 85 ? "orange" : "red";

  var start = keyDate(k, salaryDay), next = keyDate(k + 1, salaryDay);
  var end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
  var days = Math.round((next - todayMid) / 86400000);
  document.getElementById("cycleInfo").innerText =
    "Month: " + fmt(start) + " → " + fmt(end) + " | Next salary in " + days + " day(s) (" + fmt(next) + ")";
  document.getElementById("msg").innerText = bal < 0
    ? "⚠️ You have spent more than your salary!"
    : "You have used " + used + "% of your salary.";
}

// ================= SAVINGS + MUTUAL FUND =================
function showSavings() {
  var k = nowKey();
  var exp = sumKey(expenses, k), inv = sumKey(funds, k), bal = income - exp - inv;
  var total = 0;
  funds.forEach(function (f) { total += f.amount; });

  document.getElementById("vLeft").innerText = money(bal);
  document.getElementById("vInv").innerText = money(inv);
  document.getElementById("vTotInv").innerText = money(total);
  document.getElementById("vRate").innerText = (income > 0 ? Math.round(bal / income * 100) : 0) + "%";

  var body = document.getElementById("fundBody");
  body.innerHTML = "";
  var sorted = funds.map(function (f, i) { return { f: f, i: i }; })
                    .sort(function (a, b) { return a.f.date < b.f.date ? 1 : -1; });
  sorted.forEach(function (o) {
    body.innerHTML += "<tr><td>" + showDate(o.f.date) + "</td><td>" + esc(o.f.name) + "</td><td>" + money(o.f.amount) +
      '</td><td><button class="red" onclick="removeFund(' + o.i + ')">✖</button></td></tr>';
  });
  if (funds.length === 0) body.innerHTML = '<tr><td colspan="4" class="empty">No investments yet</td></tr>';
}

// ================= PIE CHART =================
function showPie() {
  var k = nowKey();
  var exp = sumKey(expenses, k), inv = sumKey(funds, k), bal = income - exp - inv;
  var slices = [];
  categories.forEach(function (c) {
    var t = 0;
    expenses.forEach(function (e) { if (e.category === c && cycleKey(e.date) === k) t += e.amount; });
    if (t > 0) slices.push({ label: c, value: t, color: colors[c] });
  });
  if (inv > 0) slices.push({ label: "Mutual Fund", value: inv, color: "#f1c40f" });
  if (bal > 0) slices.push({ label: "Saving", value: bal, color: "#00bcd4" });

  var total = 0;
  slices.forEach(function (s) { total += s.value; });

  var svg = document.getElementById("pieSvg");
  var legend = document.getElementById("pieLegend");
  svg.innerHTML = "";
  legend.innerHTML = "";
  if (total === 0) { document.getElementById("pieTip").innerText = "No data this month"; return; }

  var angle = -Math.PI / 2;
  slices.forEach(function (s, i) {
    var part = s.value / total;
    var a2 = angle + part * 2 * Math.PI;
    var shape;
    if (part > 0.9999) {
      shape = '<circle class="slice" cx="100" cy="100" r="90" fill="' + s.color + '" data-i="' + i + '"></circle>';
    } else {
      var x1 = 100 + 90 * Math.cos(angle), y1 = 100 + 90 * Math.sin(angle);
      var x2 = 100 + 90 * Math.cos(a2), y2 = 100 + 90 * Math.sin(a2);
      var large = part > 0.5 ? 1 : 0;
      shape = '<path class="slice" fill="' + s.color + '" data-i="' + i + '" d="M100 100 L' + x1 + " " + y1 +
              " A90 90 0 " + large + " 1 " + x2 + " " + y2 + ' Z"></path>';
    }
    svg.innerHTML += shape;
    angle = a2;
    var pct = Math.round(part * 100);
    s.text = s.label + ": " + money(s.value) + " (" + pct + "%)";
    legend.innerHTML += '<span><span class="dot" style="background:' + s.color + '"></span>' + s.label + " " + pct + "%</span>";
  });

  var shapes = svg.querySelectorAll(".slice");
  shapes.forEach(function (el) {
    var text = slices[Number(el.getAttribute("data-i"))].text;
    el.onmouseenter = function () { document.getElementById("pieTip").innerText = text; };
    el.onclick = el.onmouseenter;
  });
  document.getElementById("pieTip").innerText = "Hover or tap a slice";
}

// ================= 3D BAR CHART =================
function showChart() {
  var k = nowKey();
  var totals = {};
  categories.forEach(function (c) { totals[c] = 0; });
  expenses.forEach(function (e) { if (cycleKey(e.date) === k) totals[e.category] += e.amount; });

  var max = 1;
  categories.forEach(function (c) { if (totals[c] > max) max = totals[c]; });

  var scene = document.getElementById("scene");
  var legend = document.getElementById("legend");
  scene.innerHTML = "";
  legend.innerHTML = "";

  categories.forEach(function (c) {
    var h = Math.max(6, Math.round(totals[c] / max * 190));
    var cube = document.createElement("div");
    cube.className = "cube";
    cube.style.height = h + "px";
    cube.style.setProperty("--c", colors[c]);
    cube.innerHTML = '<div class="face front"></div><div class="face back"></div>' +
                     '<div class="face left"></div><div class="face right"></div><div class="face top"></div>';
    var text = c + ": " + money(totals[c]);
    cube.onmouseenter = function () { document.getElementById("tip").innerText = text; };
    cube.onclick = cube.onmouseenter;
    scene.appendChild(cube);
    legend.innerHTML += '<span><span class="dot" style="background:' + colors[c] + '"></span>' + c + "</span>";
  });
}

var angleY = -25;
function setAngle(a) {
  angleY = a;
  document.getElementById("scene").style.transform = "rotateX(-20deg) rotateY(" + a + "deg)";
}
document.getElementById("rotate").oninput = function () { setAngle(Number(this.value)); };

var spinTimer = null;
document.getElementById("spinBtn").onclick = function () {
  if (spinTimer) { clearInterval(spinTimer); spinTimer = null; this.innerText = "▶ Auto Spin"; }
  else { this.innerText = "⏸ Stop"; spinTimer = setInterval(function () { setAngle(angleY + 1.5); }, 30); }
};

// ================= EXPENSE TABLE =================
function showTable() {
  var f = filterSelect.value;
  var all = document.getElementById("showAll").checked;
  var k = nowKey();
  var body = document.getElementById("tbody");
  body.innerHTML = "";
  var count = 0;
  expenses.forEach(function (e, i) {
    if (f !== "All" && e.category !== f) return;
    if (!all && cycleKey(e.date) !== k) return;
    count++;
    body.innerHTML += "<tr><td>" + showDate(e.date) + "</td><td>" + esc(e.name) + "</td><td>" + e.category +
      "</td><td>" + money(e.amount) + '</td><td><button class="red" onclick="removeExpense(' + i + ')">✖</button></td></tr>';
  });
  if (count === 0) body.innerHTML = '<tr><td colspan="5" class="empty">No expenses found</td></tr>';
}

// ================= FULL YEAR HISTORY =================
function showYear() {
  var nk = nowKey();
  var sel = document.getElementById("yearSel");
  var chosen = sel.value || String(Math.floor(nk / 12));

  var years = {};
  years[Math.floor(nk / 12)] = 1;
  expenses.concat(funds).forEach(function (e) { years[Math.floor(cycleKey(e.date) / 12)] = 1; });
  sel.innerHTML = "";
  Object.keys(years).sort().forEach(function (y) {
    sel.innerHTML += '<option value="' + y + '"' + (y === chosen ? " selected" : "") + ">" + y + "</option>";
  });
  var Y = Number(sel.value);

  var body = document.getElementById("ybody");
  body.innerHTML = "";
  var tI = 0, tE = 0, tV = 0, tS = 0;
  for (var m = 0; m < 12; m++) {
    var k = Y * 12 + m;
    var label = monthNames[m] + " " + Y + (k === nk ? " (running)" : "");
    if (k > nk) {
      body.innerHTML += "<tr><td>" + label + "</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>";
      continue;
    }
    var e = sumKey(expenses, k), v = sumKey(funds, k), sv = income - e - v;
    tI += income; tE += e; tV += v; tS += sv;
    body.innerHTML += "<tr><td>" + label + "</td><td>" + money(income) + "</td><td>" + money(e) + "</td><td>" +
      money(v) + '</td><td class="' + (sv < 0 ? "neg" : "pos") + '">' + money(sv) + "</td></tr>";
  }
  document.getElementById("yfoot").innerHTML = "<tr><td>Total</td><td>" + money(tI) + "</td><td>" + money(tE) +
    "</td><td>" + money(tV) + '</td><td class="' + (tS < 0 ? "neg" : "pos") + '">' + money(tS) + "</td></tr>";
}
document.getElementById("yearSel").onchange = showYear;

// ================= ACTIONS =================
function refresh() { showSummary(); showPie(); showChart(); showSavings(); showTable(); showYear(); save(); }

document.getElementById("form").addEventListener("submit", function (ev) {
  ev.preventDefault();
  expenses.push({
    date: document.getElementById("date").value,
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    amount: Number(document.getElementById("amount").value)
  });
  expenses.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  this.reset();
  document.getElementById("date").value = todayStr;
  refresh();
});

function removeExpense(i) { expenses.splice(i, 1); refresh(); }
function removeFund(i) { funds.splice(i, 1); refresh(); }

// Mutual fund: the amount typed by the user is deducted from this month's balance
document.getElementById("fundBtn").onclick = function () {
  var amt = Number(document.getElementById("fundAmt").value);
  var name = document.getElementById("fundName").value.trim() || "Mutual Fund";
  if (!(amt > 0)) { alert("Please enter an amount."); return; }
  var k = nowKey();
  var bal = income - sumKey(expenses, k) - sumKey(funds, k);
  if (amt > bal) { alert("Not enough balance left this month (" + money(bal) + ")."); return; }
  funds.push({ date: todayStr, name: name, amount: amt });
  document.getElementById("fundAmt").value = "";
  document.getElementById("fundName").value = "";
  refresh();
};

document.getElementById("saveSetBtn").onclick = function () {
  var inc = Number(document.getElementById("incomeInput").value);
  var day = Math.round(Number(document.getElementById("dayInput").value));
  if (inc > 0) income = inc;
  if (day >= 1 && day <= 28) salaryDay = day;
  document.getElementById("incomeInput").value = income;
  document.getElementById("dayInput").value = salaryDay;
  refresh();
};

document.getElementById("clearBtn").onclick = function () {
  if (confirm("Delete all expenses and investments?")) { expenses = []; funds = []; refresh(); }
};

filterSelect.onchange = showTable;
document.getElementById("showAll").onchange = showTable;

document.getElementById("themeBtn").onclick = function () {
  var r = document.documentElement;
  var dark = r.getAttribute("data-theme") === "dark" ||
             (!r.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  r.setAttribute("data-theme", dark ? "light" : "dark");
};

refresh();