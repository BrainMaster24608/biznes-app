// ---- MODUŁY BIZNESOWE ----
const MODULY = {
  francja: { maEkipy: true, maWyjazdy: true },
};

// ---- STAN ----
let biznesy = [];
let aktywnyBiznes = null;
let pracownicy = [];
let wyjazdy = [];
let faktury = [];
let wyplaty = [];

// ---- HELPERS ----
const esc = (str) => {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
};
const pln = (kwota) =>
  (kwota || 0).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " PLN";
const $ = (id) => document.getElementById(id);

// ---- MODALS ----
const overlay = $("modal-overlay");

function pokazModal(id) {
  overlay.classList.remove("ukryty");
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("ukryty"));
  $(id).classList.remove("ukryty");
}

function zamknijModal(id) {
  $(id).classList.add("ukryty");
  overlay.classList.add("ukryty");
  const form = $(id).querySelector("form");
  if (form) form.reset();
}

document.querySelectorAll(".btn-zamknij").forEach((btn) => {
  btn.addEventListener("click", () => zamknijModal(btn.closest(".modal").id));
});
document.querySelectorAll("[data-modal]").forEach((btn) => {
  btn.addEventListener("click", () => zamknijModal(btn.dataset.modal));
});
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) {
    document
      .querySelectorAll(".modal:not(.ukryty)")
      .forEach((m) => zamknijModal(m.id));
  }
});

// ---- NAWIGACJA GŁÓWNA ----
function pokazStrone(strona) {
  document
    .querySelectorAll(".strona")
    .forEach((s) => s.classList.remove("aktywna"));
  document
    .querySelectorAll("[data-strona]")
    .forEach((i) => i.classList.remove("aktywny"));
  $(`strona-${strona}`).classList.add("aktywna");
  document
    .querySelectorAll(`[data-strona="${strona}"]`)
    .forEach((i) => i.classList.add("aktywny"));
}

document.querySelectorAll("[data-strona]").forEach((item) => {
  item.addEventListener("click", async (e) => {
    e.preventDefault();
    const strona = item.dataset.strona;
    if (strona === "biznesy") await ladujListeBiznesow();
    if (strona === "dashboard") await ladujDashboard();
    pokazStrone(strona);
  });
});

// ---- NAWIGACJA W BIZNESIE ----
function pokazTab(tab) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("aktywna"));
  document
    .querySelectorAll("[data-tab]")
    .forEach((i) => i.classList.remove("aktywny"));
  $(`tab-${tab}`).classList.add("aktywna");
  document
    .querySelectorAll(`[data-tab="${tab}"]`)
    .forEach((i) => i.classList.add("aktywny"));
}

document.querySelectorAll("[data-tab]").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    pokazTab(item.dataset.tab);
  });
});

// ---- MODUŁY ----
// Elementy oznaczone [data-modul="x"] są widoczne tylko gdy aktywny biznes ma typ "x".
function zastosujModul(typ) {
  document.querySelectorAll("[data-modul]").forEach((el) => {
    el.classList.toggle("ukryty", el.dataset.modul !== typ);
  });
  const aktywnaZakladka = document.querySelector(".tab.aktywna");
  if (aktywnaZakladka && aktywnaZakladka.matches("[data-modul]") && aktywnaZakladka.classList.contains("ukryty")) {
    pokazTab("przeglad");
  }
}

$("btn-powrot").addEventListener("click", (e) => {
  e.preventDefault();
  aktywnyBiznes = null;
  $("menu-biznes").classList.add("ukryty");
  $("menu-glowny").style.display = "";
  pokazStrone("biznesy");
});

// ---- OTWIERANIE BIZNESU ----
async function otworzBiznes(id) {
  const biznes = biznesy.find((b) => b.id === id);
  if (!biznes) return;
  aktywnyBiznes = biznes;

  $("biznes-nazwa-naglowek").textContent = biznes.nazwa;
  $("biznes-branza-naglowek").textContent = biznes.branza || "";
  $("biznes-opis-tekst").textContent = biznes.opis || "Brak opisu.";
  $("sidebar-biznes-nazwa").textContent = biznes.nazwa;

  zastosujModul(biznes.typ);

  $("menu-glowny").style.display = "none";
  $("menu-biznes").classList.remove("ukryty");

  await Promise.all([
    ladujPracownikow(),
    ladujWyjazdy(),
    ladujFaktury(),
    ladujWyplaty(),
  ]);
  await ladujBilans();

  pokazStrone("biznes");
  pokazTab("przeglad");
}

// ---- DASHBOARD ----
async function ladujDashboard() {
  biznesy = await window.api.biznesy.pobierz();

  $("dash-statystyki").innerHTML = `
    <div class="karta-stat">
      <div class="liczba akcent">${biznesy.length}</div>
      <div class="etykieta">Aktywnych biznesów</div>
    </div>
  `;

  if (!biznesy.length) {
    $("dash-lista").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🏢</div><p>Nie masz jeszcze żadnych biznesów.</p></div>`;
    return;
  }

  $("dash-lista").innerHTML = biznesy
    .map(
      (b) => `
    <div class="karta-biznes" data-id="${b.id}" style="cursor:pointer">
      <div><h3>${esc(b.nazwa)}</h3>${b.branza ? `<span class="badge">${esc(b.branza)}</span>` : ""}</div>
      <span style="color:var(--tekst2);font-size:13px">Otwórz →</span>
    </div>
  `,
    )
    .join("");

  document.querySelectorAll("#dash-lista .karta-biznes").forEach((el) => {
    el.addEventListener("click", () => otworzBiznes(parseInt(el.dataset.id)));
  });
}

// ---- LISTA BIZNESÓW ----
async function ladujListeBiznesow() {
  biznesy = await window.api.biznesy.pobierz();
  renderujListeBiznesow();
}

function renderujListeBiznesow() {
  if (!biznesy.length) {
    $("lista-biznesow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🏢</div><p>Dodaj swój pierwszy biznes.</p></div>`;
    return;
  }
  $("lista-biznesow").innerHTML = biznesy
    .map(
      (b) => `
    <div class="karta-biznes" data-id="${b.id}" style="cursor:pointer">
      <div>
        <h3>${esc(b.nazwa)}</h3>
        ${b.branza ? `<span class="badge">${esc(b.branza)}</span>` : ""}
        ${b.opis ? `<p style="color:var(--tekst2);font-size:13px;margin-top:6px">${esc(b.opis)}</p>` : ""}
      </div>
      <div class="karta-akcje">
        <button class="btn-danger" data-usun="${b.id}">Usuń</button>
      </div>
    </div>
  `,
    )
    .join("");

  document.querySelectorAll("#lista-biznesow .karta-biznes").forEach((el) => {
    el.addEventListener("click", () => otworzBiznes(parseInt(el.dataset.id)));
  });

  document.querySelectorAll("[data-usun]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await usunBiznes(parseInt(btn.dataset.usun));
    });
  });
}

$("btn-otworz-modal-biznes").addEventListener("click", () =>
  pokazModal("modal-biznes"),
);

$("form-biznes").addEventListener("submit", async (e) => {
  e.preventDefault();
  await window.api.biznesy.dodaj({
    nazwa: $("b-nazwa").value.trim(),
    typ: $("b-typ").value,
  });
  zamknijModal("modal-biznes");
  await ladujListeBiznesow();
  await ladujDashboard();
});

async function usunBiznes(id) {
  if (!confirm("Usunąć ten biznes?")) return;
  await window.api.biznesy.usun(id);
  await ladujListeBiznesow();
  await ladujDashboard();
}

// ---- BILANS ----
async function ladujBilans() {
  const b = await window.api.bilans.pobierz(aktywnyBiznes.id);
  const modul = MODULY[aktywnyBiznes.typ] || MODULY.francja;
  $("bilans-karty").innerHTML = `
    <div class="karta-stat">
      <div class="liczba zielona">${pln(b.przychody)}</div>
      <div class="etykieta">Przychody (faktury)</div>
    </div>
    <div class="karta-stat">
      <div class="liczba czerwona">${pln(b.wyplaty)}</div>
      <div class="etykieta">Wypłaty pracowników</div>
    </div>
    ${modul.maWyjazdy ? `
    <div class="karta-stat">
      <div class="liczba czerwona">${pln(b.koszty_transport)}</div>
      <div class="etykieta">Koszty transportu</div>
    </div>` : ""}
    <div class="karta-stat">
      <div class="liczba ${b.zysk >= 0 ? "zielona" : "czerwona"}">${pln(b.zysk)}</div>
      <div class="etykieta">Zysk netto</div>
    </div>
  `;
}

// ---- PRACOWNICY ----
async function ladujPracownikow() {
  pracownicy = await window.api.pracownicy.pobierz(aktywnyBiznes.id);
  renderujPracownikow();
}

function renderujPracownikow() {
  const renderKarta = (p) => `
    <div class="karta-pracownik">
      <div class="pracownik-info">
        <span class="pracownik-imie">${esc(p.imie)} ${esc(p.nazwisko)}</span>
        <span class="pracownik-szczeg">${esc(p.stanowisko)} · Wypłata: ${pln(p.wyplata_miesieczna)}/mies.</span>
      </div>
      <button class="btn-danger" data-usun-pracownika="${p.id}">Usuń</button>
    </div>
  `;

  const modul = MODULY[aktywnyBiznes.typ] || MODULY.francja;

  if (modul.maEkipy) {
    const renderEkipa = (lista, nr) => {
      if (!lista.length)
        return `
        <div class="ekipa-sekcja">
          <div class="ekipa-naglowek">Ekipa ${nr}</div>
          <div class="pusty-stan" style="padding:20px"><p>Brak pracowników w ekipie ${nr}</p></div>
        </div>`;
      return `
        <div class="ekipa-sekcja">
          <div class="ekipa-naglowek">Ekipa ${nr}</div>
          ${lista.map(renderKarta).join("")}
        </div>`;
    };
    const ekipa1 = pracownicy.filter((p) => p.ekipa == 1);
    const ekipa2 = pracownicy.filter((p) => p.ekipa == 2);
    $("lista-pracownikow").innerHTML =
      renderEkipa(ekipa1, 1) + renderEkipa(ekipa2, 2);
  } else {
    $("lista-pracownikow").innerHTML = pracownicy.map(renderKarta).join("");
  }

  document.querySelectorAll("[data-usun-pracownika]").forEach((btn) => {
    btn.addEventListener("click", () =>
      usunPracownika(parseInt(btn.dataset.usunPracownika)),
    );
  });
}

$("btn-dodaj-pracownika").addEventListener("click", () =>
  pokazModal("modal-pracownik"),
);

$("form-pracownik").addEventListener("submit", async (e) => {
  e.preventDefault();
  await window.api.pracownicy.dodaj({
    biznes_id: aktywnyBiznes.id,
    imie: $("p-imie").value.trim(),
    nazwisko: $("p-nazwisko").value.trim(),
    stanowisko: $("p-stanowisko").value.trim(),
    wyplata_miesieczna: parseFloat($("p-wyplata").value) || 0,
    ekipa: parseInt($("p-ekipa").value),
  });
  zamknijModal("modal-pracownik");
  await ladujPracownikow();
});

async function usunPracownika(id) {
  if (!confirm("Usunąć pracownika?")) return;
  await window.api.pracownicy.usun(id);
  await ladujPracownikow();
}

// ---- WYJAZDY ----
async function ladujWyjazdy() {
  wyjazdy = await window.api.wyjazdy.pobierz(aktywnyBiznes.id);
  renderujWyjazdy();
}

function renderujWyjazdy() {
  if (!wyjazdy.length) {
    $("lista-wyjazdow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🚗</div><p>Brak zarejestrowanych wyjazdów.</p></div>`;
    return;
  }
  $("lista-wyjazdow").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr>
          <th>Ekipa</th><th>Miejsce</th><th>Wyjazd</th><th>Powrót</th>
          <th>Zaliczka</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${wyjazdy
            .map(
              (w) => `
            <tr>
              <td><span class="badge">Ekipa ${w.ekipa}</span></td>
              <td><strong>${esc(w.miejsce)}</strong></td>
              <td>${w.data_wyjazdu || "—"}</td>
              <td>${w.data_powrotu || "—"}</td>
              <td>${pln(w.zaliczka)}</td>
              <td><span class="badge ${w.status === "zakończony" ? "zielony" : "zolty"}">${w.status === "zakończony" ? "Zakończony" : "W trakcie"}</span></td>
              <td>${w.status !== "zakończony" ? `<button class="btn-success" data-zamknij="${w.id}">Zakończ</button>` : ""}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("[data-zamknij]").forEach((btn) => {
    btn.addEventListener("click", () =>
      zamknijWyjazd(parseInt(btn.dataset.zamknij)),
    );
  });
}

$("btn-dodaj-wyjazd").addEventListener("click", () =>
  pokazModal("modal-wyjazd"),
);

$("form-wyjazd").addEventListener("submit", async (e) => {
  e.preventDefault();
  await window.api.wyjazdy.dodaj({
    biznes_id: aktywnyBiznes.id,
    ekipa: parseInt($("w-ekipa").value),
    miejsce: $("w-miejsce").value.trim(),
    data_wyjazdu: $("w-data-wyjazdu").value,
    data_powrotu: $("w-data-powrotu").value,
    zaliczka: parseFloat($("w-zaliczka").value) || 0,
    notatki: $("w-notatki").value.trim(),
  });
  zamknijModal("modal-wyjazd");
  await ladujWyjazdy();
  await ladujBilans();
});

async function zamknijWyjazd(id) {
  if (!confirm("Oznaczyć wyjazd jako zakończony?")) return;
  await window.api.wyjazdy.zamknij(id);
  await ladujWyjazdy();
}

// ---- FAKTURY ----
async function ladujFaktury() {
  faktury = await window.api.faktury.pobierz(aktywnyBiznes.id);
  renderujFaktury();
}

function renderujFaktury() {
  if (!faktury.length) {
    $("lista-faktur").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">📄</div><p>Brak zarejestrowanych faktur.</p></div>`;
    return;
  }
  $("lista-faktur").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr><th>Nr faktury</th><th>Kwota</th><th>Data</th><th>Okres</th><th>Opis</th><th></th></tr></thead>
        <tbody>
          ${faktury
            .map(
              (f) => `
            <tr>
              <td><strong>${esc(f.numer_faktury) || "—"}</strong></td>
              <td style="color:var(--zielony);font-weight:600">${pln(f.kwota)}</td>
              <td>${f.data_wystawienia || "—"}</td>
              <td>${f.okres_od && f.okres_do ? `${f.okres_od} → ${f.okres_do}` : "—"}</td>
              <td style="color:var(--tekst2)">${esc(f.opis) || "—"}</td>
              <td><button class="btn-danger" data-usun-fakture="${f.id}">Usuń</button></td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("[data-usun-fakture]").forEach((btn) => {
    btn.addEventListener("click", () =>
      usunFakture(parseInt(btn.dataset.usunFakture)),
    );
  });
}

$("btn-dodaj-fakture").addEventListener("click", () =>
  pokazModal("modal-faktura"),
);

$("form-faktura").addEventListener("submit", async (e) => {
  e.preventDefault();
  await window.api.faktury.dodaj({
    biznes_id: aktywnyBiznes.id,
    numer_faktury: $("f-numer").value.trim(),
    kwota: parseFloat($("f-kwota").value),
    data_wystawienia: $("f-data").value,
    okres_od: $("f-okres-od").value,
    okres_do: $("f-okres-do").value,
    opis: $("f-opis").value.trim(),
  });
  zamknijModal("modal-faktura");
  await ladujFaktury();
  await ladujBilans();
});

async function usunFakture(id) {
  if (!confirm("Usunąć fakturę?")) return;
  await window.api.faktury.usun(id);
  await ladujFaktury();
  await ladujBilans();
}

// ---- WYPŁATY ----
async function ladujWyplaty() {
  wyplaty = await window.api.wyplaty.pobierz(aktywnyBiznes.id);
  renderujWyplaty();
}

function renderujWyplaty() {
  if (!wyplaty.length) {
    $("lista-wyplat").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">💰</div><p>Brak zarejestrowanych wypłat.</p></div>`;
    return;
  }
  $("lista-wyplat").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr><th>Pracownik</th><th>Ekipa</th><th>Kwota</th><th>Miesiąc</th><th>Data wypłaty</th><th>Notatki</th></tr></thead>
        <tbody>
          ${wyplaty
            .map(
              (w) => `
            <tr>
              <td><strong>${esc(w.imie)} ${esc(w.nazwisko)}</strong></td>
              <td><span class="badge">Ekipa ${w.ekipa}</span></td>
              <td style="color:var(--czerwony);font-weight:600">${pln(w.kwota)}</td>
              <td>${w.miesiac || "—"}</td>
              <td>${w.data_wyplaty || "—"}</td>
              <td style="color:var(--tekst2)">${esc(w.notatki) || "—"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

$("btn-dodaj-wyplate").addEventListener("click", () => {
  $("wp-pracownik").innerHTML = pracownicy
    .map(
      (p) =>
        `<option value="${p.id}">${p.imie} ${p.nazwisko} (Ekipa ${p.ekipa}) — ${pln(p.wyplata_miesieczna)}/mies.</option>`,
    )
    .join("");
  pokazModal("modal-wyplata");
});

$("wp-pracownik").addEventListener("change", () => {
  const p = pracownicy.find((p) => p.id == $("wp-pracownik").value);
  if (p) $("wp-kwota").value = p.wyplata_miesieczna;
});

$("form-wyplata").addEventListener("submit", async (e) => {
  e.preventDefault();
  await window.api.wyplaty.dodaj({
    biznes_id: aktywnyBiznes.id,
    pracownik_id: parseInt($("wp-pracownik").value),
    kwota: parseFloat($("wp-kwota").value),
    miesiac: $("wp-miesiac").value,
    data_wyplaty: $("wp-data").value,
    notatki: $("wp-notatki").value.trim(),
  });
  zamknijModal("modal-wyplata");
  await ladujWyplaty();
  await ladujBilans();
});

// ---- START ----
async function init() {
  await ladujDashboard();
  await ladujListeBiznesow();
}

init();
