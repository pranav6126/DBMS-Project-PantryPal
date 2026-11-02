
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const api = (url, opts) => fetch(url, opts).then(async (r) => {
  if (r.status === 401) { location.replace("/auth.html"); throw new Error("Please sign in again."); }
  const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed"); return j;
});

let signedInUser = null;

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 4500);
}

// ---------- tabs ----------
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
  ["cook", "pantry", "reports", "mongo"].forEach((t) => ($("#tab-" + t).hidden = t !== b.dataset.tab));
  load(b.dataset.tab);
});
const activeTab = () => document.querySelector("#tabs button.active").dataset.tab;

async function load(tab) {
  try {
    if (tab === "cook") return await loadCook();
    if (tab === "pantry") return await loadPantry();
    if (tab === "reports") return await loadReports();
    if (tab === "mongo") return await loadMongo();
  } catch (error) {
    $("#tab-" + tab).replaceChildren(el("div", "note", error.message));
  }
}

// ---------- cook tonight (the novelty feature) ----------
async function loadCook() {
  const box = $("#tab-cook"); box.replaceChildren(el("p", "sub", "Ranking recipes..."));
  const data = await api("/api/rank");
  box.replaceChildren();
  box.append(el("h2", null, "What should I cook tonight?"));
  box.append(el("p", "sub", "Recipes ranked by how much you already have, and how soon those ingredients expire."));
  const ex = el("div", "explain");
  ex.innerHTML = "<code>Score = 0.7 x coverage + 0.3 x urgency</code><span>Coverage is the share of ingredients in your pantry. Urgency rises as their shelf life runs out.</span>";
  box.append(ex);
  if (!data.recipes.length) { box.append(el("div", "note", "No recipe matches this pantry yet. Add items to your pantry to see suggestions.")); return; }

  const grid = el("div", "grid"); box.append(grid);
  data.recipes.forEach((r, i) => {
    const top = i === 0;
    const c = el("div", "card" + (top ? " hero" : ""));
    const main = el("div", top ? "side" : null); if (!top) main.style.display = "contents";

    const head = el("div", "head");
    const titleBox = el("div");
    if (top) titleBox.append(el("span", "badge", "Top pick for you"));
    titleBox.append(el("h3", null, r.title));
    const ring = el("div", "ring"); ring.style.setProperty("--p", Math.round(r.score * 100));
    ring.title = "Score " + r.score.toFixed(2); ring.append(el("b", null, r.score.toFixed(2)));
    head.append(titleBox, ring);

    const meta = el("div", "meta");
    [r.cuisine, r.diet_type, r.prep_minutes + " min", r.calories + " kcal", "planned " + r.times_cooked + "x"]
      .forEach((m) => meta.append(el("span", m === "veg" || m === "vegan" ? "veg" : "", m)));
    main.append(head, meta);

    const bars = [["Coverage", r.coverage, `${r.have_cnt} of ${r.need_cnt} ingredients`, "var(--leaf)"],
                  ["Expiry urgency", r.urgency, r.urgency >= 0.35 ? "use soon" : "relaxed", "var(--butter)"]];
    if (top) { bars[0][3] = "var(--lime)"; }
    const barBox = el("div");
    bars.forEach(([name, val, txt, col]) => {
      const l = el("div", "lbl"); l.append(el("b", null, name), el("span", null, txt)); barBox.append(l);
      const b = el("div", "bar"); const f = document.createElement("i");
      f.style.width = "0%"; f.style.background = col; b.append(f); barBox.append(b);
      requestAnimationFrame(() => requestAnimationFrame(() => (f.style.width = Math.round(val * 100) + "%")));
    });

    const shop = el("div", "shop"); shop.hidden = true;
    const row = el("div", "btns");
    const b1 = el("button", "act alt", "What am I missing?");
    b1.onclick = async () => {
      try {
      const m = await api(`/api/missing/${r.recipe_id}`);
      shop.hidden = false; shop.classList.toggle("ok", !m.length); shop.replaceChildren();
      if (!m.length) { shop.textContent = "You have everything you need."; return; }
      shop.append(el("b", null, "Shopping list"));
      const ul = el("ul"); m.forEach((x) => ul.append(el("li", null, `${x.ingredient} (${x.quantity})`))); shop.append(ul);
      } catch (error) { toast(error.message); }
    };
    const b2 = el("button", "act", "Add to tomorrow's plan");
    b2.onclick = async () => {
      try {
        const p = await api("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ recipe_id: r.recipe_id }) });
        toast(`Added ${p.title} to tomorrow’s dinner. Planned ${p.after} times.`);
        await load("cook");
      } catch (e) { toast("Could not add: " + e.message); }
    };
    row.append(b1, b2);
    if (top) { const side = el("div", "side"); side.append(barBox, shop, row); c.append(main, side); }
    else { c.append(main, barBox, shop, row); }
    grid.append(c);
  });
  if (data.loggedToMongo) box.append(el("p", "sub small", "This search was saved to MongoDB (search_logs)."));
}

// ---------- pantry ----------
async function loadPantry() {
  const box = $("#tab-pantry"); box.replaceChildren();
  const rows = await api("/api/pantry");
  box.append(el("h2", null, "My pantry"));
  box.append(el("p", "sub", "Everything you have, grouped by how soon it needs to be used. Days left = shelf life minus days since purchase."));
  const ingredients = await api("/api/ingredients");
  const form = el("form", "pantry-form");
  const select = el("select"); select.id = "pantry-ingredient"; select.required = true;
  select.append(new Option("Choose an ingredient", ""));
  ingredients.forEach(i => select.append(new Option(i.name, i.ingredient_id)));
  const date = el("input"); date.id = "pantry-date"; date.type = "date"; date.required = true;
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  date.value = localDate; date.max = localDate;
  const quantity = el("input"); quantity.id = "pantry-quantity"; quantity.placeholder = "e.g. 200 g"; quantity.maxLength = 30;
  for (const [text, input] of [["Ingredient", select], ["Purchased on", date], ["Quantity", quantity]]) {
    const label = el("label", null, text); label.htmlFor = input.id;
    const field = el("div"); field.append(label, input); form.append(field);
  }
  const submit = el("button", "act", "Save ingredient"); submit.type = "submit"; form.append(submit); box.append(form);
  form.onsubmit = async event => {
    event.preventDefault(); submit.disabled = true;
    try {
      await api("/api/pantry", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredient_id: Number(select.value), purchased_on: date.value, quantity: quantity.value }) });
      toast("Your pantry has been updated."); await load("pantry");
    } catch (error) { toast(error.message); submit.disabled = false; }
  };
  const lanes = [["urgent", "Use today", "1 day left or already expired", (d) => d <= 1],
                 ["soon", "Use this week", "2 to 3 days left", (d) => d > 1 && d <= 3],
                 ["fresh", "Plenty of time", "More than 3 days left", (d) => d > 3]];
  const wrap = el("div", "lanes"); box.append(wrap);
  lanes.forEach(([cls, title, hint, test]) => {
    const l = el("div", "lane " + cls); l.append(el("h3", null, title), el("p", null, hint));
    const items = el("div", "items"); const mine = rows.filter((r) => test(r.days_left));
    mine.forEach((r) => {
      const d = r.days_left;
      const label = d < 0 ? "expired" : d > 60 ? "long life" : d + (d === 1 ? " day" : " days");
      const c = el("div", "chip"); c.append(el("b", null, r.ingredient), el("em", null, label)); items.append(c);
    });
    if (!mine.length) items.append(el("span", "empty", "Nothing here."));
    l.append(items); wrap.append(l);
  });
}

// ---------- SQL reports ----------
function renderTable(columns, rows) {
  const t = el("table"); const thead = el("thead"), h = el("tr");
  const isNum = (c) => rows.length && rows.every((r) => r[c] !== null && r[c] !== "" && !isNaN(Number(r[c])));
  columns.forEach((c) => h.append(el("th", isNum(c) ? "num" : "", c.replace(/_/g, " ")))); thead.append(h); t.append(thead);
  const tb = el("tbody");
  rows.forEach((r) => { const tr = el("tr"); columns.forEach((c) => tr.append(el("td", isNum(c) ? "num" : "", r[c] ?? ""))); tb.append(tr); });
  t.append(tb); return t;
}
function reportCard(tag, title, content) {
  const d = el("div", "rep"); const h = el("h3"); h.append(el("span", null, tag), document.createTextNode(title));
  d.append(h, content); return d;
}
async function loadReports() {
  const box = $("#tab-reports"); box.replaceChildren(el("p", "sub", "Loading..."));
  const reps = await api("/api/reports");
  box.replaceChildren(el("h2", null, "PostgreSQL reports"), el("p", "sub", "Shared recipe summaries; personal activity is limited to your account unless you are an admin."));
  const g = el("div", "reps"); box.append(g);
  reps.forEach((r, i) => g.append(reportCard("R" + (i + 1), r.title, renderTable(r.columns, r.rows))));
}

// ---------- Mongo reports ----------
async function loadMongo() {
  const box = $("#tab-mongo"); box.replaceChildren(el("p", "sub", "Loading..."));
  const m = await api("/api/mongo");
  box.replaceChildren(el("h2", null, "MongoDB reports"), el("p", "sub", "Search and journal summaries for your account. Admins can see all users."));
  if (!m.available) {
    box.append(el("div", "note", "MongoDB is not running, so this tab is empty. Start MongoDB, run mongo_setup.js once, and refresh. The rest of the app works without it."));
    return;
  }
  const g = el("div", "reps"); box.append(g);
  m.reports.forEach((r, i) => g.append(reportCard("M" + (i + 1), r.title,
    r.rows.length ? renderTable(Object.keys(r.rows[0]), r.rows) : el("div", "empty", "No data yet."))));
}

// ---------- authenticated start ----------
$("#logout").onclick = async () => {
  try {
    await api("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    location.replace("/auth.html");
  } catch (error) { toast(error.message); }
};
(async () => {
  try {
    const result = await api("/api/auth/me");
    signedInUser = result.user;
    $("#identity").textContent = `${signedInUser.name} (${signedInUser.diet_pref})`;
    await load("cook");
  } catch (error) {
    $("#tab-cook").replaceChildren(el("div", "note", error.message));
  }
})();
