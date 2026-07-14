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

const ROZMIAR_STRONY = 10;

function stronicuj(lista, strona) {
  const start = (strona - 1) * ROZMIAR_STRONY;
  return lista.slice(start, start + ROZMIAR_STRONY);
}

function renderujPaginacje(kontenerId, calkowitaLiczba, strona, ustawStroneFn) {
  const kontener = $(kontenerId);
  const liczbaStron = Math.max(1, Math.ceil(calkowitaLiczba / ROZMIAR_STRONY));
  if (liczbaStron <= 1) {
    kontener.innerHTML = "";
    return;
  }

  const przyciskiStron = [];
  for (let i = 1; i <= liczbaStron; i++) {
    przyciskiStron.push(
      `<button data-strona="${i}" class="${i === strona ? "aktywna" : ""}">${i}</button>`,
    );
  }

  kontener.innerHTML = `
    <button data-strona="${strona - 1}" ${strona === 1 ? "disabled" : ""}>‹</button>
    ${przyciskiStron.join("")}
    <button data-strona="${strona + 1}" ${strona === liczbaStron ? "disabled" : ""}>›</button>
  `;

  kontener.querySelectorAll("button[data-strona]:not(:disabled)").forEach((btn) => {
    btn.addEventListener("click", () => ustawStroneFn(parseInt(btn.dataset.strona)));
  });
}

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
  $("sidebar-biznes-nazwa").textContent = biznes.nazwa;

  bilansMiesiac = biezacyMiesiac();
  $("bilans-miesiac").value = bilansMiesiac;

  zastosujModul(biznes.typ);

  $("menu-glowny").style.display = "none";
  $("menu-biznes").classList.remove("ukryty");

  await Promise.all([
    ladujPracownikow(),
    ladujWyjazdy(),
    ladujFaktury(),
    ladujWyplaty(),
    ladujPliki(),
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
      <div><h3>${esc(b.nazwa)}</h3></div>
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

let stronaBiznesy = 1;

function ustawStroneBiznesy(strona) {
  stronaBiznesy = strona;
  renderujListeBiznesow();
}

function renderujListeBiznesow() {
  if (!biznesy.length) {
    $("lista-biznesow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🏢</div><p>Dodaj swój pierwszy biznes.</p></div>`;
    $("biznesy-paginacja").innerHTML = "";
    return;
  }

  const maxStrona = Math.max(1, Math.ceil(biznesy.length / ROZMIAR_STRONY));
  if (stronaBiznesy > maxStrona) stronaBiznesy = maxStrona;
  const naStronie = stronicuj(biznesy, stronaBiznesy);

  $("lista-biznesow").innerHTML = naStronie
    .map(
      (b) => `
    <div class="karta-biznes" data-id="${b.id}" style="cursor:pointer">
      <div>
        <h3>${esc(b.nazwa)}</h3>
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

  renderujPaginacje("biznesy-paginacja", biznesy.length, stronaBiznesy, ustawStroneBiznesy);
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
let bilansMiesiac = "";

async function ladujBilans() {
  const b = await window.api.bilans.pobierz(aktywnyBiznes.id, bilansMiesiac || null);
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

$("bilans-miesiac").addEventListener("change", () => {
  bilansMiesiac = $("bilans-miesiac").value;
  ladujBilans();
});

$("btn-bilans-wyczysc-miesiac").addEventListener("click", () => {
  bilansMiesiac = "";
  $("bilans-miesiac").value = "";
  ladujBilans();
});

// ---- ALERTY DOKUMENTÓW ----
const parsujDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function statusTerminu(dataStr) {
  if (!dataStr) return null;
  const dzis = parsujDate(isoData(new Date()));
  const dni = Math.round((parsujDate(dataStr) - dzis) / 86400000);
  if (dni < 0) return { tekst: `Wygasł ${-dni} dni temu`, klasa: "wygasly" };
  if (dni <= 30) return { tekst: `Wygasa za ${dni} dni`, klasa: "wygasa" };
  return null;
}

function statusDokumentuPracownika(p) {
  return statusTerminu(p.dokument_waznosc);
}

function statusUmowyPracownika(p) {
  return statusTerminu(p.umowa_do);
}

function renderujAlertyDokumentow() {
  const kontener = $("alerty-dokumentow");
  if (!kontener) return;

  const zagrozenia = [];
  pracownicy
    .filter((p) => p.aktywny)
    .forEach((p) => {
      const statusUmowy = statusUmowyPracownika(p);
      if (statusUmowy) {
        zagrozenia.push({ p, etykieta: "Umowa", data: p.umowa_do, status: statusUmowy });
      }
    });
  zagrozenia.sort((a, b) => a.data.localeCompare(b.data));

  if (!zagrozenia.length) {
    kontener.innerHTML = "";
    return;
  }

  kontener.innerHTML = `
    <div class="alert-dokumenty">
      <h3>⚠️ Dokumenty i umowy wymagające uwagi</h3>
      ${zagrozenia
        .map(
          ({ p, etykieta, data, status }) => `
        <div class="alert-wiersz">
          <span>${esc(p.imie)} ${esc(p.nazwisko)} — ${etykieta}</span>
          <span class="alert-status ${status.klasa}">${status.tekst} (${data})</span>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

// ---- PRACOWNICY ----
let edytowanyPracownikId = null;
let sortPracownicy = { kolumna: "nazwisko", kierunek: 1 };
let stronaPracownicy = 1;

async function ladujPracownikow() {
  pracownicy = await window.api.pracownicy.pobierz(aktywnyBiznes.id);
  renderujPracownikow();
  renderujAlertyDokumentow();
}

function strzalkaSort(aktualnaKolumna, kolumna, kierunek) {
  if (aktualnaKolumna !== kolumna) return "";
  return `<span class="strzalka">${kierunek === 1 ? "↑" : "↓"}</span>`;
}

function filtrowaniSortowaniPracownicy() {
  const szukaj = $("pracownicy-szukaj").value.trim().toLowerCase();
  const filtrEkipa = $("pracownicy-filtr-ekipa").value;
  const filtrUmowa = $("pracownicy-filtr-umowa").value;
  const filtrStatus = $("pracownicy-filtr-status").value;

  let wynik = pracownicy.filter((p) => {
    if (
      szukaj &&
      !`${p.imie} ${p.nazwisko} ${p.stanowisko || ""}`.toLowerCase().includes(szukaj)
    )
      return false;
    if (filtrEkipa && String(p.ekipa) !== filtrEkipa) return false;
    if (filtrUmowa && p.typ_umowy !== filtrUmowa) return false;
    if (filtrStatus === "aktywny" && !p.aktywny) return false;
    if (filtrStatus === "usuniety" && p.aktywny) return false;
    return true;
  });

  const { kolumna, kierunek } = sortPracownicy;
  wynik.sort((a, b) => {
    let va = a[kolumna] ?? "";
    let vb = b[kolumna] ?? "";
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return -kierunek;
    if (va > vb) return kierunek;
    return 0;
  });

  return wynik;
}

function ustawStronePracownicy(strona) {
  stronaPracownicy = strona;
  renderujPracownikow();
}

function ustawSortowaniePracownicy(kolumna) {
  if (sortPracownicy.kolumna === kolumna) {
    sortPracownicy.kierunek *= -1;
  } else {
    sortPracownicy = { kolumna, kierunek: 1 };
  }
  stronaPracownicy = 1;
  renderujPracownikow();
}

function renderujPracownikow() {
  if (!pracownicy.length) {
    $("lista-pracownikow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">👷</div><p>Brak zarejestrowanych pracowników.</p></div>`;
    $("pracownicy-paginacja").innerHTML = "";
    return;
  }

  const modul = MODULY[aktywnyBiznes.typ] || MODULY.francja;
  const widoczni = filtrowaniSortowaniPracownicy();
  const { kolumna, kierunek } = sortPracownicy;

  if (!widoczni.length) {
    $("lista-pracownikow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🔍</div><p>Brak pracowników spełniających kryteria filtrowania.</p></div>`;
    $("pracownicy-paginacja").innerHTML = "";
    return;
  }

  const maxStrona = Math.max(1, Math.ceil(widoczni.length / ROZMIAR_STRONY));
  if (stronaPracownicy > maxStrona) stronaPracownicy = maxStrona;
  const naStronie = stronicuj(widoczni, stronaPracownicy);

  $("lista-pracownikow").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr>
          <th class="sortowalna" data-sort="nazwisko">Imię i nazwisko ${strzalkaSort(kolumna, "nazwisko", kierunek)}</th>
          <th class="sortowalna" data-sort="stanowisko">Stanowisko ${strzalkaSort(kolumna, "stanowisko", kierunek)}</th>
          ${modul.maEkipy ? `<th class="sortowalna" data-sort="ekipa">Ekipa ${strzalkaSort(kolumna, "ekipa", kierunek)}</th>` : ""}
          <th>Telefon</th><th>E-mail</th><th>Typ umowy</th>
          <th class="sortowalna" data-sort="stawka_godzinowa">Stawka godz. ${strzalkaSort(kolumna, "stawka_godzinowa", kierunek)}</th>
          <th>Dokument</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${naStronie
            .map((p) => {
              const statusUmowy = statusUmowyPracownika(p);
              const ostrzezenia = [
                statusUmowy ? `<span class="alert-status ${statusUmowy.klasa}" title="Umowa: ${statusUmowy.tekst} (${p.umowa_do})">⚠️📝</span>` : "",
              ].join(" ");
              return `
            <tr>
              <td><strong>${esc(p.imie)} ${esc(p.nazwisko)}</strong> ${ostrzezenia}</td>
              <td>${esc(p.stanowisko)}</td>
              ${modul.maEkipy ? `<td><span class="badge">Ekipa ${p.ekipa}</span></td>` : ""}
              <td>${esc(p.telefon) || "—"}</td>
              <td>${esc(p.email) || "—"}</td>
              <td>${esc(p.typ_umowy) || "—"}</td>
              <td>${pln(p.stawka_godzinowa)}/h</td>
              <td>${p.dokument_umowy ? `<button class="btn-ikona" data-otworz-plik="${esc(p.dokument_umowy)}" title="Otwórz dokument">📎</button>` : "—"}</td>
              <td><span class="badge ${p.aktywny ? "zielony" : "czerwony"}">${p.aktywny ? "Aktywny" : "Usunięty"}</span></td>
              <td>
                <div class="akcje-ikony">
                  <button class="btn-ikona" data-szczegoly-pracownika="${p.id}" title="Szczegóły">👁️</button>
                  ${p.aktywny
                    ? `<button class="btn-ikona" data-edytuj-pracownika="${p.id}" title="Edytuj">✏️</button>
                       <button class="btn-ikona btn-ikona-danger" data-usun-pracownika="${p.id}" title="Usuń">🗑️</button>`
                    : `<button class="btn-ikona" data-przywroc-pracownika="${p.id}" title="Przywróć">↩️</button>`}
                </div>
              </td>
            </tr>
          `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("[data-usun-pracownika]").forEach((btn) => {
    btn.addEventListener("click", () =>
      usunPracownika(parseInt(btn.dataset.usunPracownika)),
    );
  });
  document.querySelectorAll("[data-przywroc-pracownika]").forEach((btn) => {
    btn.addEventListener("click", () =>
      przywrocPracownika(parseInt(btn.dataset.przywrocPracownika)),
    );
  });
  document.querySelectorAll("[data-szczegoly-pracownika]").forEach((btn) => {
    btn.addEventListener("click", () =>
      pokazSzczegolyPracownika(parseInt(btn.dataset.szczegolyPracownika)),
    );
  });
  document.querySelectorAll("[data-edytuj-pracownika]").forEach((btn) => {
    btn.addEventListener("click", () =>
      otworzEdycjePracownika(parseInt(btn.dataset.edytujPracownika)),
    );
  });
  document.querySelectorAll("[data-otworz-plik]").forEach((btn) => {
    btn.addEventListener("click", () =>
      window.api.pracownicy.otworzPlik(btn.dataset.otworzPlik),
    );
  });
  document.querySelectorAll("#lista-pracownikow th.sortowalna").forEach((th) => {
    th.addEventListener("click", () => ustawSortowaniePracownicy(th.dataset.sort));
  });

  renderujPaginacje("pracownicy-paginacja", widoczni.length, stronaPracownicy, ustawStronePracownicy);
}

["pracownicy-szukaj", "pracownicy-filtr-ekipa", "pracownicy-filtr-umowa", "pracownicy-filtr-status"].forEach((id) => {
  $(id).addEventListener("input", () => {
    stronaPracownicy = 1;
    renderujPracownikow();
  });
});

let aktywnyPracownikSzczegolyId = null;

async function pokazSzczegolyPracownika(id) {
  const p = pracownicy.find((p) => p.id === id);
  if (!p) return;
  aktywnyPracownikSzczegolyId = id;
  const wiersz = (etykieta, wartosc) => `
    <p><strong>${etykieta}:</strong> ${esc(wartosc) || "—"}</p>
  `;
  $("pracownik-szczegoly-tresc").innerHTML = `
    ${wiersz("PESEL", p.pesel)}
    ${wiersz("Data urodzenia", p.data_urodzenia)}
    ${wiersz("Adres", p.adres)}
    ${wiersz("Nr dokumentu", p.nr_dokumentu)}
    ${wiersz("Ważność dokumentu", p.dokument_waznosc)}
    ${wiersz("Nr konta bankowego", p.nr_konta)}
    ${wiersz("Typ umowy", p.typ_umowy)}
    ${wiersz("Umowa do", p.umowa_do)}
  `;
  await ladujDokumentyPracownika(id);
  pokazModal("modal-pracownik-szczegoly");
}

async function ladujDokumentyPracownika(pracownik_id) {
  const dokumenty = await window.api.dokumenty.pobierz(pracownik_id);
  renderujDokumentyPracownika(dokumenty);
}

function renderujDokumentyPracownika(dokumenty) {
  if (!dokumenty.length) {
    $("pracownik-dokumenty-lista").innerHTML =
      `<p class="tekst-szary" style="font-size:13px">Brak dodatkowych dokumentów.</p>`;
    return;
  }
  $("pracownik-dokumenty-lista").innerHTML = `
    <div class="lista-dokumentow">
      ${dokumenty
        .map(
          (d) => `
        <div class="dokument-wiersz">
          <div class="dokument-info">
            <span class="dokument-nazwa">${esc(d.nazwa)}</span>
            <span class="dokument-data">${esc(d.data_dodania)}</span>
          </div>
          <div class="akcje-ikony">
            <button class="btn-ikona" data-otworz-dokument="${esc(d.plik)}" title="Otwórz">📎</button>
            <button class="btn-ikona btn-ikona-danger" data-usun-dokument="${d.id}" title="Usuń">🗑️</button>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
  document.querySelectorAll("[data-otworz-dokument]").forEach((btn) => {
    btn.addEventListener("click", () =>
      window.api.pracownicy.otworzPlik(btn.dataset.otworzDokument),
    );
  });
  document.querySelectorAll("[data-usun-dokument]").forEach((btn) => {
    btn.addEventListener("click", () =>
      usunDokumentPracownika(parseInt(btn.dataset.usunDokument)),
    );
  });
}

async function usunDokumentPracownika(id) {
  if (!confirm("Usunąć dokument?")) return;
  await window.api.dokumenty.usun(id);
  await ladujDokumentyPracownika(aktywnyPracownikSzczegolyId);
  await ladujPliki();
}

$("form-dokument-pracownik").addEventListener("submit", async (e) => {
  e.preventDefault();
  const plik = $("d-plik").files[0];
  if (!plik) return;
  const dataBuffer = await plik.arrayBuffer();
  const nazwaZapisu = await window.api.pracownicy.wgrajPlik(plik.name, dataBuffer);
  await window.api.dokumenty.dodaj({
    pracownik_id: aktywnyPracownikSzczegolyId,
    nazwa: $("d-nazwa").value.trim(),
    plik: nazwaZapisu,
  });
  e.target.reset();
  await ladujDokumentyPracownika(aktywnyPracownikSzczegolyId);
  await ladujPliki();
});

$("btn-dodaj-pracownika").addEventListener("click", () => {
  edytowanyPracownikId = null;
  $("modal-pracownik-tytul").textContent = "Nowy pracownik";
  $("p-plik-aktualny").classList.add("ukryty");
  pokazModal("modal-pracownik");
});

function otworzEdycjePracownika(id) {
  const p = pracownicy.find((p) => p.id === id);
  if (!p) return;
  edytowanyPracownikId = id;
  $("modal-pracownik-tytul").textContent = "Edytuj pracownika";

  $("p-imie").value = p.imie || "";
  $("p-nazwisko").value = p.nazwisko || "";
  $("p-stanowisko").value = p.stanowisko || "";
  $("p-stawka-godzinowa").value = p.stawka_godzinowa || "";
  $("p-ekipa").value = p.ekipa || 1;
  $("p-telefon").value = p.telefon || "";
  $("p-email").value = p.email || "";
  $("p-pesel").value = p.pesel || "";
  $("p-data-urodzenia").value = p.data_urodzenia || "";
  $("p-adres").value = p.adres || "";
  $("p-nr-dokumentu").value = p.nr_dokumentu || "";
  $("p-dokument-waznosc").value = p.dokument_waznosc || "";
  $("p-nr-konta").value = p.nr_konta || "";
  $("p-typ-umowy").value = p.typ_umowy || "";
  $("p-umowa-do").value = p.umowa_do || "";

  if (p.dokument_umowy) {
    $("p-plik-aktualny").textContent = `Obecny plik: ${p.dokument_umowy} (wybierz nowy, aby zastąpić)`;
    $("p-plik-aktualny").classList.remove("ukryty");
  } else {
    $("p-plik-aktualny").classList.add("ukryty");
  }

  pokazModal("modal-pracownik");
}

$("form-pracownik").addEventListener("submit", async (e) => {
  e.preventDefault();

  const edytowanyPracownik = edytowanyPracownikId
    ? pracownicy.find((p) => p.id === edytowanyPracownikId)
    : null;
  let dokument_umowy = edytowanyPracownik?.dokument_umowy || null;
  const plik = $("p-plik-umowy").files[0];
  if (plik) {
    const dataBuffer = await plik.arrayBuffer();
    dokument_umowy = await window.api.pracownicy.wgrajPlik(plik.name, dataBuffer);
  }

  const dane = {
    imie: $("p-imie").value.trim(),
    nazwisko: $("p-nazwisko").value.trim(),
    stanowisko: $("p-stanowisko").value.trim(),
    stawka_godzinowa: parseFloat($("p-stawka-godzinowa").value) || 0,
    ekipa: parseInt($("p-ekipa").value),
    telefon: $("p-telefon").value.trim(),
    email: $("p-email").value.trim(),
    pesel: $("p-pesel").value.trim(),
    data_urodzenia: $("p-data-urodzenia").value,
    adres: $("p-adres").value.trim(),
    nr_dokumentu: $("p-nr-dokumentu").value.trim(),
    dokument_waznosc: $("p-dokument-waznosc").value,
    nr_konta: $("p-nr-konta").value.trim(),
    typ_umowy: $("p-typ-umowy").value,
    umowa_do: $("p-umowa-do").value,
    dokument_umowy,
  };

  if (edytowanyPracownikId) {
    await window.api.pracownicy.edytuj({ id: edytowanyPracownikId, ...dane });
  } else {
    await window.api.pracownicy.dodaj({ biznes_id: aktywnyBiznes.id, ...dane });
  }
  await ladujPliki();

  edytowanyPracownikId = null;
  zamknijModal("modal-pracownik");
  await ladujPracownikow();
});

async function usunPracownika(id) {
  if (!confirm("Usunąć pracownika?")) return;
  await window.api.pracownicy.usun(id);
  await ladujPracownikow();
}

async function przywrocPracownika(id) {
  if (!confirm("Przywrócić pracownika?")) return;
  await window.api.pracownicy.przywroc(id);
  await ladujPracownikow();
}

// ---- WYJAZDY ----
const dzisiajData = new Date();
let kalendarzRok = dzisiajData.getFullYear();
let kalendarzMiesiac = dzisiajData.getMonth();

function etykietaEkipy(ekipa) {
  return ekipa === 0 ? "Wszyscy" : `Ekipa ${ekipa}`;
}
function klasaPaskaEkipy(ekipa) {
  if (ekipa === 0) return "pasek-wszyscy";
  return ekipa === 1 ? "pasek-ekipa1" : "pasek-ekipa2";
}
const isoData = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const biezacyMiesiac = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

let sortWyjazdy = { kolumna: "data_wyjazdu", kierunek: -1 };
let stronaWyjazdy = 1;

async function ladujWyjazdy() {
  wyjazdy = await window.api.wyjazdy.pobierz(aktywnyBiznes.id);
  renderujWyjazdy();
  renderujKalendarzWyjazdow();
}

function filtrowaniSortowanieWyjazdy() {
  const szukaj = $("wyjazdy-szukaj").value.trim().toLowerCase();
  const filtrKto = $("wyjazdy-filtr-kto").value;
  const dataOd = $("wyjazdy-data-od").value;
  const dataDo = $("wyjazdy-data-do").value;

  let wynik = wyjazdy.filter((w) => {
    if (szukaj && !w.miejsce.toLowerCase().includes(szukaj)) return false;
    if (filtrKto !== "" && String(w.ekipa) !== filtrKto) return false;
    const koniecWyjazdu = w.data_powrotu || w.data_wyjazdu;
    if (dataOd && koniecWyjazdu < dataOd) return false;
    if (dataDo && w.data_wyjazdu > dataDo) return false;
    return true;
  });

  const { kolumna, kierunek } = sortWyjazdy;
  wynik.sort((a, b) => {
    let va = a[kolumna] ?? "";
    let vb = b[kolumna] ?? "";
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return -kierunek;
    if (va > vb) return kierunek;
    return 0;
  });

  return wynik;
}

function ustawStroneWyjazdy(strona) {
  stronaWyjazdy = strona;
  renderujWyjazdy();
}

function ustawSortowanieWyjazdy(kolumna) {
  if (sortWyjazdy.kolumna === kolumna) {
    sortWyjazdy.kierunek *= -1;
  } else {
    sortWyjazdy = { kolumna, kierunek: 1 };
  }
  stronaWyjazdy = 1;
  renderujWyjazdy();
}

function renderujWyjazdy() {
  if (!wyjazdy.length) {
    $("lista-wyjazdow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🚗</div><p>Brak zarejestrowanych wyjazdów.</p></div>`;
    $("wyjazdy-paginacja").innerHTML = "";
    return;
  }

  const widoczne = filtrowaniSortowanieWyjazdy();
  const { kolumna, kierunek } = sortWyjazdy;

  if (!widoczne.length) {
    $("lista-wyjazdow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🔍</div><p>Brak wyjazdów spełniających kryteria filtrowania.</p></div>`;
    $("wyjazdy-paginacja").innerHTML = "";
    return;
  }

  const maxStrona = Math.max(1, Math.ceil(widoczne.length / ROZMIAR_STRONY));
  if (stronaWyjazdy > maxStrona) stronaWyjazdy = maxStrona;
  const naStronie = stronicuj(widoczne, stronaWyjazdy);

  $("lista-wyjazdow").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr>
          <th class="sortowalna" data-sort="ekipa">Kto jedzie ${strzalkaSort(kolumna, "ekipa", kierunek)}</th>
          <th class="sortowalna" data-sort="miejsce">Miejsce ${strzalkaSort(kolumna, "miejsce", kierunek)}</th>
          <th class="sortowalna" data-sort="data_wyjazdu">Wyjazd ${strzalkaSort(kolumna, "data_wyjazdu", kierunek)}</th>
          <th class="sortowalna" data-sort="data_powrotu">Powrót ${strzalkaSort(kolumna, "data_powrotu", kierunek)}</th>
          <th class="sortowalna" data-sort="zaliczka">Zaliczka ${strzalkaSort(kolumna, "zaliczka", kierunek)}</th>
          <th class="sortowalna" data-sort="wydatki_rzeczywiste">Wydatki ${strzalkaSort(kolumna, "wydatki_rzeczywiste", kierunek)}</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${naStronie
            .map(
              (w) => `
            <tr>
              <td><span class="badge">${etykietaEkipy(w.ekipa)}</span></td>
              <td><strong>${esc(w.miejsce)}</strong></td>
              <td>${w.data_wyjazdu || "—"}</td>
              <td>${w.data_powrotu || "—"}</td>
              <td>${pln(w.zaliczka)}</td>
              <td>${w.wydatki_rzeczywiste != null ? pln(w.wydatki_rzeczywiste) : "—"}</td>
              <td>
                <div class="akcje-ikony">
                  <button class="btn-ikona" data-edytuj-wyjazd="${w.id}" title="Edytuj">✏️</button>
                  <button class="btn-ikona btn-ikona-danger" data-usun-wyjazd="${w.id}" title="Usuń">🗑️</button>
                </div>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("[data-usun-wyjazd]").forEach((btn) => {
    btn.addEventListener("click", () =>
      usunWyjazd(parseInt(btn.dataset.usunWyjazd)),
    );
  });
  document.querySelectorAll("[data-edytuj-wyjazd]").forEach((btn) => {
    btn.addEventListener("click", () =>
      otworzEdycjeWyjazdu(parseInt(btn.dataset.edytujWyjazd)),
    );
  });
  document.querySelectorAll("#lista-wyjazdow th.sortowalna").forEach((th) => {
    th.addEventListener("click", () => ustawSortowanieWyjazdy(th.dataset.sort));
  });

  renderujPaginacje("wyjazdy-paginacja", widoczne.length, stronaWyjazdy, ustawStroneWyjazdy);
}

["wyjazdy-szukaj", "wyjazdy-filtr-kto", "wyjazdy-data-od", "wyjazdy-data-do"].forEach((id) => {
  $(id).addEventListener("input", () => {
    stronaWyjazdy = 1;
    renderujWyjazdy();
  });
});

// ---- KALENDARZ WYJAZDÓW ----
function tygodnieMiesiaca(rok, miesiac) {
  const ostatniDnia = new Date(rok, miesiac + 1, 0);
  const pierwszyDnia = new Date(rok, miesiac, 1);
  const startOffset = (pierwszyDnia.getDay() + 6) % 7; // 0 = poniedziałek
  let cursor = new Date(rok, miesiac, 1 - startOffset);
  const tygodnie = [];
  do {
    const tydzien = [];
    for (let i = 0; i < 7; i++) {
      tydzien.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    tygodnie.push(tydzien);
  } while (tygodnie[tygodnie.length - 1][6] < ostatniDnia);
  return tygodnie;
}

function segmentyTygodnia(tydzien, wszystkieWyjazdy) {
  const tydzienStart = isoData(tydzien[0]);
  const tydzienEnd = isoData(tydzien[6]);
  const segmenty = [];

  wszystkieWyjazdy.forEach((w) => {
    const start = w.data_wyjazdu;
    const koniec = w.data_powrotu && w.data_powrotu >= start ? w.data_powrotu : start;
    if (!start || koniec < tydzienStart || start > tydzienEnd) return;

    let startCol = tydzien.findIndex((d) => isoData(d) >= start);
    if (startCol === -1) startCol = 0;
    let endCol = 6;
    for (let i = 6; i >= 0; i--) {
      if (isoData(tydzien[i]) <= koniec) {
        endCol = i;
        break;
      }
    }
    segmenty.push({ wyjazd: w, startCol, endCol });
  });

  segmenty.sort((a, b) => a.startCol - b.startCol);
  const laneEnds = [];
  segmenty.forEach((seg) => {
    let lane = laneEnds.findIndex((endCol) => endCol < seg.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.endCol);
    } else {
      laneEnds[lane] = seg.endCol;
    }
    seg.lane = lane;
  });
  return segmenty;
}

function renderujKalendarzWyjazdow() {
  const nazwyMiesiecy = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
  ];
  const tygodnie = tygodnieMiesiaca(kalendarzRok, kalendarzMiesiac);
  const dzisiajIso = isoData(new Date());

  const tygodnieHtml = tygodnie
    .map((tydzien) => {
      const segmenty = segmentyTygodnia(tydzien, wyjazdy);
      const dniHtml = tydzien
        .map((d) => {
          const klasy = ["kalendarz-dzien"];
          if (d.getMonth() !== kalendarzMiesiac) klasy.push("poza-miesiacem");
          if (isoData(d) === dzisiajIso) klasy.push("dzisiaj");
          return `<div class="${klasy.join(" ")}">${d.getDate()}</div>`;
        })
        .join("");
      const paskiHtml = segmenty
        .map(
          (seg) => `
        <div class="kalendarz-pasek ${klasaPaskaEkipy(seg.wyjazd.ekipa)}"
             style="grid-column:${seg.startCol + 1} / ${seg.endCol + 2}; grid-row:${seg.lane + 1}"
             data-szczegoly-wyjazdu="${seg.wyjazd.id}"
             title="${esc(seg.wyjazd.miejsce)} — ${etykietaEkipy(seg.wyjazd.ekipa)}">${esc(seg.wyjazd.miejsce)}</div>
      `,
        )
        .join("");
      return `
        <div class="kalendarz-tydzien">
          <div class="kalendarz-dni-tygodnia">${dniHtml}</div>
          <div class="kalendarz-paski">${paskiHtml}</div>
        </div>
      `;
    })
    .join("");

  $("kalendarz-wyjazdow").innerHTML = `
    <div class="kalendarz">
      <div class="kalendarz-naglowek">
        <button class="btn-secondary" id="btn-miesiac-poprzedni">←</button>
        <div class="kalendarz-tytul">${nazwyMiesiecy[kalendarzMiesiac]} ${kalendarzRok}</div>
        <button class="btn-secondary" id="btn-miesiac-nastepny">→</button>
      </div>
      <div class="kalendarz-dni-naglowek">
        <span>Pn</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pt</span><span>Sb</span><span>Nd</span>
      </div>
      ${tygodnieHtml}
      <div class="kalendarz-legenda">
        <span><i style="background:var(--akcent)"></i> Wszyscy</span>
        <span><i style="background:var(--zielony)"></i> Ekipa 1</span>
        <span><i style="background:var(--zolty)"></i> Ekipa 2</span>
      </div>
    </div>
  `;

  $("btn-miesiac-poprzedni").addEventListener("click", () => zmienMiesiacKalendarza(-1));
  $("btn-miesiac-nastepny").addEventListener("click", () => zmienMiesiacKalendarza(1));
  document.querySelectorAll("[data-szczegoly-wyjazdu]").forEach((el) => {
    el.addEventListener("click", () =>
      pokazSzczegolyWyjazdu(parseInt(el.dataset.szczegolyWyjazdu)),
    );
  });
}

function zmienMiesiacKalendarza(delta) {
  kalendarzMiesiac += delta;
  if (kalendarzMiesiac < 0) {
    kalendarzMiesiac = 11;
    kalendarzRok--;
  } else if (kalendarzMiesiac > 11) {
    kalendarzMiesiac = 0;
    kalendarzRok++;
  }
  renderujKalendarzWyjazdow();
}

let edytowanyWyjazdId = null;

function pokazSzczegolyWyjazdu(id) {
  const w = wyjazdy.find((w) => w.id === id);
  if (!w) return;
  $("wyjazd-szczegoly-tresc").innerHTML = `
    <p><strong>Kto jedzie:</strong> ${etykietaEkipy(w.ekipa)}</p>
    <p><strong>Miejsce:</strong> ${esc(w.miejsce)}</p>
    <p><strong>Data wyjazdu:</strong> ${w.data_wyjazdu || "—"}</p>
    <p><strong>Data powrotu:</strong> ${w.data_powrotu || "—"}</p>
    <p><strong>Zaliczka:</strong> ${pln(w.zaliczka)}</p>
    <p><strong>Faktycznie wydane:</strong> ${w.wydatki_rzeczywiste != null ? pln(w.wydatki_rzeczywiste) : "—"}</p>
    <p><strong>Notatki:</strong> ${esc(w.notatki) || "—"}</p>
  `;
  $("btn-usun-z-modala").onclick = async () => {
    await usunWyjazd(w.id);
    zamknijModal("modal-wyjazd-szczegoly");
  };
  $("btn-edytuj-z-modala").onclick = () => {
    zamknijModal("modal-wyjazd-szczegoly");
    otworzEdycjeWyjazdu(w.id);
  };
  pokazModal("modal-wyjazd-szczegoly");
}

function otworzEdycjeWyjazdu(id) {
  const w = wyjazdy.find((w) => w.id === id);
  if (!w) return;
  edytowanyWyjazdId = id;
  $("modal-wyjazd-tytul").textContent = "Edytuj wyjazd";

  $("w-ekipa").value = w.ekipa;
  $("w-miejsce").value = w.miejsce || "";
  $("w-data-wyjazdu").value = w.data_wyjazdu || "";
  $("w-data-powrotu").value = w.data_powrotu || "";
  $("w-zaliczka").value = w.zaliczka || "";
  $("w-wydatki").value = w.wydatki_rzeczywiste ?? "";
  $("w-notatki").value = w.notatki || "";

  pokazModal("modal-wyjazd");
}

$("btn-dodaj-wyjazd").addEventListener("click", () => {
  edytowanyWyjazdId = null;
  $("modal-wyjazd-tytul").textContent = "Nowy wyjazd";
  pokazModal("modal-wyjazd");
});

$("form-wyjazd").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data_wyjazdu = $("w-data-wyjazdu").value;
  const data_powrotu = $("w-data-powrotu").value;
  if (data_powrotu && data_powrotu < data_wyjazdu) {
    alert("Data powrotu nie może być wcześniejsza niż data wyjazdu.");
    return;
  }

  const dane = {
    ekipa: parseInt($("w-ekipa").value),
    miejsce: $("w-miejsce").value.trim(),
    data_wyjazdu,
    data_powrotu,
    zaliczka: parseFloat($("w-zaliczka").value) || 0,
    wydatki_rzeczywiste: $("w-wydatki").value === "" ? null : parseFloat($("w-wydatki").value),
    notatki: $("w-notatki").value.trim(),
  };

  if (edytowanyWyjazdId) {
    await window.api.wyjazdy.edytuj({ id: edytowanyWyjazdId, ...dane });
  } else {
    await window.api.wyjazdy.dodaj({ biznes_id: aktywnyBiznes.id, ...dane });
  }

  edytowanyWyjazdId = null;
  zamknijModal("modal-wyjazd");
  await ladujWyjazdy();
  await ladujBilans();
});

async function usunWyjazd(id) {
  if (!confirm("Usunąć wyjazd?")) return;
  await window.api.wyjazdy.usun(id);
  await ladujWyjazdy();
  await ladujBilans();
}

// ---- FAKTURY ----
let stronaFaktury = 1;

async function ladujFaktury() {
  faktury = await window.api.faktury.pobierz(aktywnyBiznes.id);
  renderujFaktury();
}

function ustawStroneFaktury(strona) {
  stronaFaktury = strona;
  renderujFaktury();
}

function renderujFaktury() {
  if (!faktury.length) {
    $("lista-faktur").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">📄</div><p>Brak zarejestrowanych faktur.</p></div>`;
    $("faktury-paginacja").innerHTML = "";
    return;
  }

  const maxStrona = Math.max(1, Math.ceil(faktury.length / ROZMIAR_STRONY));
  if (stronaFaktury > maxStrona) stronaFaktury = maxStrona;
  const naStronie = stronicuj(faktury, stronaFaktury);

  $("lista-faktur").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr><th>Nr faktury</th><th>Kwota</th><th>Data</th><th>Okres</th><th>Opis</th><th>Waluta</th><th>KSeF</th><th></th></tr></thead>
        <tbody>
          ${naStronie
            .map(
              (f) => `
            <tr>
              <td><strong>${esc(f.numer_faktury) || "—"}</strong></td>
              <td style="color:var(--zielony);font-weight:600">${pln(f.kwota)}</td>
              <td>${f.data_wystawienia || "—"}</td>
              <td>${f.okres_od && f.okres_do ? `${f.okres_od} → ${f.okres_do}` : "—"}</td>
              <td style="color:var(--tekst2)">${esc(f.opis) || "—"}</td>
              <td>${podgladWaluty(f)}</td>
              <td>${znacznikKsef(f)}</td>
              <td>
                <div class="akcje-ikony">
                  ${f.ksef_numer ? "" : `<button class="btn-ikona" data-wyslij-ksef="${f.id}" title="Wyślij do KSeF">📤</button>`}
                  <button class="btn-ikona" data-edytuj-fakture="${f.id}" title="Edytuj">✏️</button>
                  <button class="btn-ikona btn-ikona-danger" data-usun-fakture="${f.id}" title="Usuń">🗑️</button>
                </div>
              </td>
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
  document.querySelectorAll("[data-edytuj-fakture]").forEach((btn) => {
    btn.addEventListener("click", () =>
      otworzEdycjeFaktury(parseInt(btn.dataset.edytujFakture)),
    );
  });
  document.querySelectorAll("[data-wyslij-ksef]").forEach((btn) => {
    btn.addEventListener("click", () =>
      wyslijFaktureDoKsef(parseInt(btn.dataset.wyslijKsef)),
    );
  });

  renderujPaginacje("faktury-paginacja", faktury.length, stronaFaktury, ustawStroneFaktury);
}

function podgladWaluty(f) {
  if (!f.waluta || f.waluta === "PLN") return `<span style="color:var(--tekst2)">PLN</span>`;
  return `<span title="${(f.kwota_oryginalna || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${esc(f.waluta)} × ${f.kurs}">${esc(f.waluta)} × ${f.kurs}</span>`;
}

function znacznikKsef(f) {
  if (f.ksef_numer) return `<span class="badge zielony" title="${esc(f.ksef_numer)}">Wysłano</span>`;
  if (f.ksef_status === "blad") return `<span class="badge czerwony" title="${esc(f.ksef_blad || "")}">Błąd</span>`;
  return `<span class="badge">Niewysłana</span>`;
}

async function wyslijFaktureDoKsef(id) {
  if (!aktywnyBiznes.nip || !aktywnyBiznes.ksef_token) {
    alert("Najpierw skonfiguruj NIP i token KSeF (przycisk „⚙ KSeF” nad listą faktur).");
    return;
  }
  const btn = document.querySelector(`[data-wyslij-ksef="${id}"]`);
  if (btn) btn.disabled = true;
  const wynik = await window.api.ksef.wyslij(id);
  if (!wynik.sukces) {
    alert(`Nie udało się wysłać faktury do KSeF:\n${wynik.blad}`);
  }
  await ladujFaktury();
}

let edytowanaFakturaId = null;

function otworzEdycjeFaktury(id) {
  const f = faktury.find((f) => f.id === id);
  if (!f) return;
  edytowanaFakturaId = id;
  $("modal-faktura-tytul").textContent = "Edytuj fakturę";

  $("f-numer").value = f.numer_faktury || "";
  $("f-kwota").value = f.kwota_oryginalna ?? f.kwota ?? "";
  $("f-waluta").value = f.waluta || "PLN";
  $("f-kurs").value = f.kurs || 1;
  $("f-data").value = f.data_wystawienia || "";
  $("f-okres-od").value = f.okres_od || "";
  $("f-okres-do").value = f.okres_do || "";
  $("f-nip-kontrahenta").value = f.nip_kontrahenta || "";
  $("f-opis").value = f.opis || "";

  zaktualizujWidocznoscKursu();
  zaktualizujPodgladPln();
  pokazModal("modal-faktura");
}

$("btn-dodaj-fakture").addEventListener("click", () => {
  edytowanaFakturaId = null;
  $("modal-faktura-tytul").textContent = "Faktura od kontrahenta";
  $("form-faktura").reset();
  $("f-data").value = isoData(new Date());
  $("f-waluta").value = "PLN";
  $("f-kurs").value = 1;
  zaktualizujWidocznoscKursu();
  zaktualizujPodgladPln();
  pokazModal("modal-faktura");
});

function zaktualizujWidocznoscKursu() {
  const jestPln = $("f-waluta").value === "PLN";
  $("f-kurs-wrapper").classList.toggle("ukryty", jestPln);
  if (jestPln) $("f-kurs").value = 1;
}

function zaktualizujPodgladPln() {
  const jestPln = $("f-waluta").value === "PLN";
  const podglad = $("f-kwota-pln-podglad");
  if (jestPln) {
    podglad.classList.add("ukryty");
    return;
  }
  const kwota = parseFloat($("f-kwota").value) || 0;
  const kurs = parseFloat($("f-kurs").value) || 0;
  podglad.textContent = `= ${pln(kwota * kurs)}`;
  podglad.classList.remove("ukryty");
}

$("f-waluta").addEventListener("change", () => {
  zaktualizujWidocznoscKursu();
  zaktualizujPodgladPln();
});
$("f-kwota").addEventListener("input", zaktualizujPodgladPln);
$("f-kurs").addEventListener("input", zaktualizujPodgladPln);

$("btn-pobierz-kurs-nbp").addEventListener("click", async () => {
  const waluta = $("f-waluta").value;
  const data = $("f-data").value;
  if (!data) {
    alert("Najpierw wpisz datę wystawienia faktury.");
    return;
  }
  const btn = $("btn-pobierz-kurs-nbp");
  btn.disabled = true;
  btn.textContent = "Pobieranie…";
  const wynik = await window.api.kursy.pobierzNbp(waluta, data);
  btn.disabled = false;
  btn.textContent = "Pobierz kurs NBP";
  if (!wynik.sukces) {
    alert(`Nie udało się pobrać kursu NBP: ${wynik.blad}`);
    return;
  }
  $("f-kurs").value = wynik.kurs;
  zaktualizujPodgladPln();
});

$("form-faktura").addEventListener("submit", async (e) => {
  e.preventDefault();
  const kwotaOryginalna = parseFloat($("f-kwota").value);
  const kurs = parseFloat($("f-kurs").value) || 1;
  const dane = {
    numer_faktury: $("f-numer").value.trim(),
    kwota: Math.round(kwotaOryginalna * kurs * 100) / 100,
    kwota_oryginalna: kwotaOryginalna,
    waluta: $("f-waluta").value,
    kurs,
    data_wystawienia: $("f-data").value,
    okres_od: $("f-okres-od").value,
    okres_do: $("f-okres-do").value,
    nip_kontrahenta: $("f-nip-kontrahenta").value.trim(),
    opis: $("f-opis").value.trim(),
  };

  if (edytowanaFakturaId) {
    await window.api.faktury.edytuj({ id: edytowanaFakturaId, ...dane });
  } else {
    await window.api.faktury.dodaj({ biznes_id: aktywnyBiznes.id, ...dane });
  }

  edytowanaFakturaId = null;
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

$("btn-ustawienia-ksef").addEventListener("click", () => {
  $("ks-nip").value = aktywnyBiznes.nip || "";
  $("ks-token").value = aktywnyBiznes.ksef_token || "";
  $("ks-srodowisko").value = aktywnyBiznes.ksef_srodowisko || "test";
  pokazModal("modal-ksef-ustawienia");
});

$("form-ksef-ustawienia").addEventListener("submit", async (e) => {
  e.preventDefault();
  const zaktualizowany = await window.api.biznesy.edytuj({
    id: aktywnyBiznes.id,
    nip: $("ks-nip").value.trim(),
    ksef_token: $("ks-token").value.trim(),
    ksef_srodowisko: $("ks-srodowisko").value,
  });
  aktywnyBiznes = zaktualizowany;
  zamknijModal("modal-ksef-ustawienia");
  renderujFaktury();
});

// ---- WYPŁATY ----
let stronaWyplaty = 1;

async function ladujWyplaty() {
  wyplaty = await window.api.wyplaty.pobierz(aktywnyBiznes.id);
  renderujWyplaty();
}

function ustawStroneWyplaty(strona) {
  stronaWyplaty = strona;
  renderujWyplaty();
}

function renderujWyplaty() {
  if (!wyplaty.length) {
    $("lista-wyplat").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">💰</div><p>Brak zarejestrowanych wypłat.</p></div>`;
    $("wyplaty-paginacja").innerHTML = "";
    return;
  }

  const maxStrona = Math.max(1, Math.ceil(wyplaty.length / ROZMIAR_STRONY));
  if (stronaWyplaty > maxStrona) stronaWyplaty = maxStrona;
  const naStronie = stronicuj(wyplaty, stronaWyplaty);

  $("lista-wyplat").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr><th>Pracownik</th><th>Ekipa</th><th>Godziny</th><th>Kwota</th><th>Miesiąc</th><th>Notatki</th><th></th></tr></thead>
        <tbody>
          ${naStronie
            .map(
              (w) => `
            <tr>
              <td><strong>${esc(w.imie)} ${esc(w.nazwisko)}</strong></td>
              <td><span class="badge">Ekipa ${w.ekipa}</span></td>
              <td>${w.godziny ?? "—"}</td>
              <td style="color:var(--czerwony);font-weight:600">${pln(w.kwota)}</td>
              <td>${w.miesiac || "—"}</td>
              <td style="color:var(--tekst2)">${esc(w.notatki) || "—"}</td>
              <td>
                <div class="akcje-ikony">
                  <button class="btn-ikona" data-edytuj-wyplate="${w.id}" title="Edytuj">✏️</button>
                  <button class="btn-ikona btn-ikona-danger" data-usun-wyplate="${w.id}" title="Usuń">🗑️</button>
                </div>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("[data-edytuj-wyplate]").forEach((btn) => {
    btn.addEventListener("click", () => otworzEdycjeWyplaty(parseInt(btn.dataset.edytujWyplate)));
  });
  document.querySelectorAll("[data-usun-wyplate]").forEach((btn) => {
    btn.addEventListener("click", () => usunWyplate(parseInt(btn.dataset.usunWyplate)));
  });

  renderujPaginacje("wyplaty-paginacja", wyplaty.length, stronaWyplaty, ustawStroneWyplaty);
}

function odswiezPodgladKwoty() {
  const p = pracownicy.find((p) => p.id == $("wp-pracownik").value);
  const godziny = parseFloat($("wp-godziny").value) || 0;
  const kwota = godziny * (p?.stawka_godzinowa || 0);
  $("wp-kwota-podglad").textContent = pln(kwota);
}

let edytowanaWyplataId = null;

$("btn-dodaj-wyplate").addEventListener("click", () => {
  edytowanaWyplataId = null;
  $("modal-wyplata-tytul").textContent = "Wypłata pracownika";
  $("wp-pracownik").disabled = false;
  $("wp-pracownik").innerHTML = pracownicy
    .filter((p) => p.aktywny)
    .map(
      (p) =>
        `<option value="${p.id}">${p.imie} ${p.nazwisko} (Ekipa ${p.ekipa}) — stawka: ${pln(p.stawka_godzinowa)}/h</option>`,
    )
    .join("");
  $("form-wyplata").reset();
  odswiezPodgladKwoty();
  pokazModal("modal-wyplata");
});

function otworzEdycjeWyplaty(id) {
  const w = wyplaty.find((w) => w.id === id);
  if (!w) return;
  edytowanaWyplataId = id;
  $("modal-wyplata-tytul").textContent = "Edytuj wypłatę";

  $("wp-pracownik").innerHTML = `<option value="${w.pracownik_id}">${esc(w.imie)} ${esc(w.nazwisko)}</option>`;
  $("wp-pracownik").disabled = true;
  $("wp-godziny").value = w.godziny ?? "";
  $("wp-miesiac").value = w.miesiac || "";
  $("wp-notatki").value = w.notatki || "";
  odswiezPodgladKwoty();
  pokazModal("modal-wyplata");
}

async function usunWyplate(id) {
  if (!confirm("Usunąć tę wypłatę?")) return;
  await window.api.wyplaty.usun(id);
  await ladujWyplaty();
  await ladujBilans();
}

$("wp-pracownik").addEventListener("change", odswiezPodgladKwoty);
$("wp-godziny").addEventListener("input", odswiezPodgladKwoty);

$("form-wyplata").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dane = {
    pracownik_id: parseInt($("wp-pracownik").value),
    godziny: parseFloat($("wp-godziny").value) || 0,
    miesiac: $("wp-miesiac").value,
    notatki: $("wp-notatki").value.trim(),
  };
  if (edytowanaWyplataId) {
    await window.api.wyplaty.edytuj({ id: edytowanaWyplataId, ...dane });
  } else {
    await window.api.wyplaty.dodaj({ biznes_id: aktywnyBiznes.id, ...dane });
  }
  edytowanaWyplataId = null;
  $("wp-pracownik").disabled = false;
  zamknijModal("modal-wyplata");
  await ladujWyplaty();
  await ladujBilans();
});

// ---- WYPŁATY HURTOWO ----
$("btn-dodaj-wyplate-hurtowo").addEventListener("click", () => {
  const aktywniPracownicy = pracownicy.filter((p) => p.aktywny);
  if (!aktywniPracownicy.length) {
    alert("Brak aktywnych pracowników.");
    return;
  }
  $("wph-zaznacz-wszystkich").checked = false;
  $("wph-lista-pracownikow").innerHTML = aktywniPracownicy
    .map(
      (p) => `
    <div class="dokument-wiersz">
      <div class="dokument-info" style="flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" class="wph-zaznacz" data-pracownik-id="${p.id}">
        <div>
          <div class="dokument-nazwa">${esc(p.imie)} ${esc(p.nazwisko)}</div>
          <div class="dokument-data">Stawka: ${pln(p.stawka_godzinowa)}/h</div>
        </div>
      </div>
      <label style="flex-direction:row;align-items:center;gap:8px">Godziny
        <input type="number" min="0" step="0.5" class="wph-godziny" data-pracownik-id="${p.id}" style="width:90px" placeholder="0">
      </label>
    </div>
  `,
    )
    .join("");
  pokazModal("modal-wyplata-hurtowo");
});

$("wph-zaznacz-wszystkich").addEventListener("change", (e) => {
  document.querySelectorAll(".wph-zaznacz").forEach((checkbox) => {
    checkbox.checked = e.target.checked;
  });
});

$("form-wyplata-hurtowo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const zaznaczeni = new Set(
    Array.from(document.querySelectorAll(".wph-zaznacz:checked")).map(
      (checkbox) => checkbox.dataset.pracownikId,
    ),
  );

  const wpisy = Array.from(document.querySelectorAll(".wph-godziny"))
    .filter((input) => zaznaczeni.has(input.dataset.pracownikId))
    .map((input) => ({
      pracownik_id: parseInt(input.dataset.pracownikId),
      godziny: parseFloat(input.value) || 0,
    }))
    .filter((w) => w.godziny > 0);

  if (!zaznaczeni.size) {
    alert("Zaznacz przynajmniej jednego pracownika.");
    return;
  }
  if (!wpisy.length) {
    alert("Wpisz liczbę godzin dla zaznaczonych pracowników.");
    return;
  }

  await window.api.wyplaty.dodajHurtowo({
    biznes_id: aktywnyBiznes.id,
    miesiac: $("wph-miesiac").value,
    wpisy,
  });
  zamknijModal("modal-wyplata-hurtowo");
  await ladujWyplaty();
  await ladujBilans();
});

// ---- WSZYSTKIE PLIKI ----
let pliki = [];
let sortPliki = { kolumna: "data_dodania", kierunek: -1 };
let stronaPliki = 1;

async function ladujPliki() {
  pliki = await window.api.pliki.pobierz(aktywnyBiznes.id);
  renderujPliki();
}

function etykietaTypuPliku(typ) {
  return typ === "umowa" ? "Umowa" : "Dokument";
}

function filtrowaniSortowaniePliki() {
  const szukaj = $("pliki-szukaj").value.trim().toLowerCase();
  const filtrTyp = $("pliki-filtr-typ").value;

  let wynik = pliki.filter((p) => {
    if (
      szukaj &&
      !`${p.imie} ${p.nazwisko} ${p.nazwa}`.toLowerCase().includes(szukaj)
    )
      return false;
    if (filtrTyp && p.typ !== filtrTyp) return false;
    return true;
  });

  const { kolumna, kierunek } = sortPliki;
  wynik.sort((a, b) => {
    let va = kolumna === "pracownik" ? `${a.imie} ${a.nazwisko}` : a[kolumna] ?? "";
    let vb = kolumna === "pracownik" ? `${b.imie} ${b.nazwisko}` : b[kolumna] ?? "";
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return -kierunek;
    if (va > vb) return kierunek;
    return 0;
  });

  return wynik;
}

function ustawStronePliki(strona) {
  stronaPliki = strona;
  renderujPliki();
}

function ustawSortowaniePliki(kolumna) {
  if (sortPliki.kolumna === kolumna) {
    sortPliki.kierunek *= -1;
  } else {
    sortPliki = { kolumna, kierunek: 1 };
  }
  stronaPliki = 1;
  renderujPliki();
}

function renderujPliki() {
  if (!pliki.length) {
    $("lista-plikow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">📁</div><p>Brak dodanych plików.</p></div>`;
    $("pliki-paginacja").innerHTML = "";
    return;
  }

  const widoczne = filtrowaniSortowaniePliki();
  const { kolumna, kierunek } = sortPliki;

  if (!widoczne.length) {
    $("lista-plikow").innerHTML =
      `<div class="pusty-stan"><div class="duza-ikona">🔍</div><p>Brak plików spełniających kryteria filtrowania.</p></div>`;
    $("pliki-paginacja").innerHTML = "";
    return;
  }

  const maxStrona = Math.max(1, Math.ceil(widoczne.length / ROZMIAR_STRONY));
  if (stronaPliki > maxStrona) stronaPliki = maxStrona;
  const naStronie = stronicuj(widoczne, stronaPliki);

  $("lista-plikow").innerHTML = `
    <div class="tabela-wrapper">
      <table>
        <thead><tr>
          <th class="sortowalna" data-sort="pracownik">Pracownik ${strzalkaSort(kolumna, "pracownik", kierunek)}</th>
          <th class="sortowalna" data-sort="nazwa">Nazwa ${strzalkaSort(kolumna, "nazwa", kierunek)}</th>
          <th class="sortowalna" data-sort="typ">Typ ${strzalkaSort(kolumna, "typ", kierunek)}</th>
          <th class="sortowalna" data-sort="data_dodania">Data dodania ${strzalkaSort(kolumna, "data_dodania", kierunek)}</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${naStronie
            .map(
              (p) => `
            <tr>
              <td><strong>${esc(p.imie)} ${esc(p.nazwisko)}</strong></td>
              <td>${esc(p.nazwa)}</td>
              <td><span class="badge ${p.typ === "umowa" ? "" : "zielony"}">${etykietaTypuPliku(p.typ)}</span></td>
              <td>${esc(p.data_dodania) || "—"}</td>
              <td>
                <div class="akcje-ikony">
                  <button class="btn-ikona" data-otworz-plik-wszystkie="${esc(p.plik)}" title="Otwórz">📎</button>
                  <button class="btn-ikona btn-ikona-danger" data-usun-plik="${p.ref_id}" data-usun-plik-typ="${p.typ}" title="Usuń">🗑️</button>
                </div>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("[data-otworz-plik-wszystkie]").forEach((btn) => {
    btn.addEventListener("click", () =>
      window.api.pracownicy.otworzPlik(btn.dataset.otworzPlikWszystkie),
    );
  });
  document.querySelectorAll("[data-usun-plik]").forEach((btn) => {
    btn.addEventListener("click", () =>
      usunPlikZListy(parseInt(btn.dataset.usunPlik), btn.dataset.usunPlikTyp),
    );
  });
  document.querySelectorAll("#lista-plikow th.sortowalna").forEach((th) => {
    th.addEventListener("click", () => ustawSortowaniePliki(th.dataset.sort));
  });

  renderujPaginacje("pliki-paginacja", widoczne.length, stronaPliki, ustawStronePliki);
}

async function usunPlikZListy(ref_id, typ) {
  if (!confirm("Usunąć ten plik?")) return;
  if (typ === "umowa") {
    await window.api.pracownicy.usunDokumentUmowy(ref_id);
    await ladujPracownikow();
  } else {
    await window.api.dokumenty.usun(ref_id);
  }
  await ladujPliki();
}

["pliki-szukaj", "pliki-filtr-typ"].forEach((id) => {
  $(id).addEventListener("input", () => {
    stronaPliki = 1;
    renderujPliki();
  });
});

// ---- START ----
async function init() {
  await ladujDashboard();
  await ladujListeBiznesow();
}

init();

// ---- AKTUALIZACJE ----
let updateUrl = null;

async function sprawdzAktualizacje(cicho = false) {
  const btn = $("btn-sprawdz-aktualizacje");
  const ikona = $("update-status-ikona");
  btn.disabled = true;
  ikona.textContent = "…";

  const wynik = await window.api.aktualizacje.sprawdz();

  btn.disabled = false;

  if (!wynik.sukces) {
    ikona.textContent = "⟳";
    if (!cicho) alert(`Nie udało się sprawdzić aktualizacji:\n${wynik.blad}`);
    return;
  }

  if (wynik.dostepna) {
    updateUrl = wynik.url;
    ikona.textContent = "🔔";
    $("update-badge").classList.remove("ukryty");
    $("update-wersja-tekst").textContent = `v${wynik.aktualna} → ${wynik.najnowsza}`;
    $("update-panel").classList.remove("ukryty");
  } else {
    ikona.textContent = "✓";
    $("update-badge").classList.add("ukryty");
    $("update-panel").classList.add("ukryty");
    if (!cicho) alert(`Masz najnowszą wersję (${wynik.aktualna}).`);
    setTimeout(() => { ikona.textContent = "⟳"; }, 3000);
  }
}

$("btn-sprawdz-aktualizacje").addEventListener("click", () => sprawdzAktualizacje(false));

$("btn-pobierz-aktualizacje").addEventListener("click", () => {
  if (updateUrl) window.api.aktualizacje.otworzStrone(updateUrl);
});

// Automatyczne sprawdzenie przy starcie (cicho — nie przeszkadza jeśli brak połączenia)
setTimeout(() => sprawdzAktualizacje(true), 3000);
