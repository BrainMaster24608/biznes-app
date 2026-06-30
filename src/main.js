const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
let db
let SQL

const dbPath = path.join(app.getPath('userData'), 'biznes-app.db')
const dokumentyPath = path.join(app.getPath('userData'), 'dokumenty')

async function initDatabase() {
  const initSqlJs = require('sql.js')
  SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS biznesy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nazwa TEXT NOT NULL,
      branza TEXT,
      opis TEXT,
      data_dodania TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pracownicy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      biznes_id INTEGER NOT NULL,
      imie TEXT NOT NULL,
      nazwisko TEXT NOT NULL,
      stanowisko TEXT DEFAULT 'Spawacz MIG/MAG',
      stawka_godzinowa REAL DEFAULT 0,
      ekipa INTEGER DEFAULT 1,
      aktywny INTEGER DEFAULT 1,
      FOREIGN KEY (biznes_id) REFERENCES biznesy(id)
    );

    CREATE TABLE IF NOT EXISTS dokumenty_pracownika (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pracownik_id INTEGER NOT NULL,
      nazwa TEXT NOT NULL,
      plik TEXT NOT NULL,
      data_dodania TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pracownik_id) REFERENCES pracownicy(id)
    );

    CREATE TABLE IF NOT EXISTS wyjazdy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      biznes_id INTEGER NOT NULL,
      ekipa INTEGER NOT NULL,
      miejsce TEXT NOT NULL,
      data_wyjazdu TEXT NOT NULL,
      data_powrotu TEXT,
      zaliczka REAL DEFAULT 0,
      wydatki_rzeczywiste REAL,
      status TEXT DEFAULT 'w_trakcie',
      notatki TEXT,
      FOREIGN KEY (biznes_id) REFERENCES biznesy(id)
    );

    CREATE TABLE IF NOT EXISTS faktury_przychody (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      biznes_id INTEGER NOT NULL,
      wyjazd_id INTEGER,
      numer_faktury TEXT,
      kwota REAL NOT NULL,
      data_wystawienia TEXT NOT NULL,
      okres_od TEXT,
      okres_do TEXT,
      opis TEXT,
      FOREIGN KEY (biznes_id) REFERENCES biznesy(id)
    );

    CREATE TABLE IF NOT EXISTS koszty_transport (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wyjazd_id INTEGER NOT NULL,
      pracownik_id INTEGER,
      typ TEXT NOT NULL,
      kwota REAL NOT NULL,
      data TEXT NOT NULL,
      opis TEXT,
      dokument TEXT DEFAULT 'paragon',
      FOREIGN KEY (wyjazd_id) REFERENCES wyjazdy(id)
    );

    CREATE TABLE IF NOT EXISTS wyplaty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pracownik_id INTEGER NOT NULL,
      biznes_id INTEGER NOT NULL,
      kwota REAL NOT NULL,
      miesiac TEXT NOT NULL,
      data_wyplaty TEXT,
      notatki TEXT,
      FOREIGN KEY (pracownik_id) REFERENCES pracownicy(id)
    );
  `)

  const kolumnyBiznesy = queryAll("PRAGMA table_info(biznesy)")
  if (!kolumnyBiznesy.some(k => k.name === 'typ')) {
    db.run("ALTER TABLE biznesy ADD COLUMN typ TEXT DEFAULT 'francja'")
  }
  const nowePoaBiznesy = ['nip TEXT', "ksef_token TEXT", "ksef_srodowisko TEXT DEFAULT 'test'"]
  nowePoaBiznesy.forEach(definicja => {
    const nazwa = definicja.split(' ')[0]
    if (!kolumnyBiznesy.some(k => k.name === nazwa)) {
      db.run(`ALTER TABLE biznesy ADD COLUMN ${definicja}`)
    }
  })

  const nowePoaPracownika = [
    'pesel TEXT', 'data_urodzenia TEXT', 'adres TEXT',
    'telefon TEXT', 'email TEXT',
    'nr_dokumentu TEXT', 'dokument_waznosc TEXT',
    'nr_konta TEXT', 'typ_umowy TEXT', 'dokument_umowy TEXT',
    'umowa_do TEXT',
  ]
  const kolumnyPracownicy = queryAll("PRAGMA table_info(pracownicy)")
  if (kolumnyPracownicy.some(k => k.name === 'wyplata_miesieczna') && !kolumnyPracownicy.some(k => k.name === 'stawka_godzinowa')) {
    db.run("ALTER TABLE pracownicy RENAME COLUMN wyplata_miesieczna TO stawka_godzinowa")
  }
  nowePoaPracownika.forEach(definicja => {
    const nazwa = definicja.split(' ')[0]
    if (!kolumnyPracownicy.some(k => k.name === nazwa) && nazwa !== 'stawka_godzinowa') {
      db.run(`ALTER TABLE pracownicy ADD COLUMN ${definicja}`)
    }
  })

  const kolumnyWyplaty = queryAll("PRAGMA table_info(wyplaty)")
  if (!kolumnyWyplaty.some(k => k.name === 'godziny')) {
    db.run("ALTER TABLE wyplaty ADD COLUMN godziny REAL")
  }

  const kolumnyWyjazdy = queryAll("PRAGMA table_info(wyjazdy)")
  if (!kolumnyWyjazdy.some(k => k.name === 'wydatki_rzeczywiste')) {
    db.run("ALTER TABLE wyjazdy ADD COLUMN wydatki_rzeczywiste REAL")
  }

  const noweKolumnyFaktury = [
    'nip_kontrahenta TEXT', 'ksef_numer TEXT', 'ksef_status TEXT', 'ksef_data_wyslania TEXT', 'ksef_blad TEXT',
    "waluta TEXT DEFAULT 'PLN'", 'kurs REAL DEFAULT 1', 'kwota_oryginalna REAL',
  ]
  const kolumnyFaktury = queryAll("PRAGMA table_info(faktury_przychody)")
  noweKolumnyFaktury.forEach(definicja => {
    const nazwa = definicja.split(' ')[0]
    if (!kolumnyFaktury.some(k => k.name === nazwa)) {
      db.run(`ALTER TABLE faktury_przychody ADD COLUMN ${definicja}`)
    }
  })
  if (!kolumnyFaktury.some(k => k.name === 'kwota_oryginalna')) {
    db.run('UPDATE faktury_przychody SET kwota_oryginalna = kwota WHERE kwota_oryginalna IS NULL')
  }

  fs.mkdirSync(dokumentyPath, { recursive: true })

  zapiszBaze()
  console.log('Baza danych gotowa:', dbPath)
}

function zapiszBaze() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

function queryAll(sql, params = []) {
  const wyniki = db.exec(sql, params)
  if (!wyniki.length) return []
  const { columns, values } = wyniki[0]
  return values.map(row => {
    const obj = {}
    columns.forEach((col, i) => obj[col] = row[i])
    return obj
  })
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params)
  return rows[0] || null
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    title: 'Biznes App'
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools()
  }
}

// ---- BIZNESY ----
ipcMain.handle('biznesy:pobierz', () => queryAll('SELECT * FROM biznesy ORDER BY data_dodania DESC'))

ipcMain.handle('biznesy:dodaj', (e, d) => {
  db.run('INSERT INTO biznesy (nazwa, branza, opis, typ) VALUES (?, ?, ?, ?)', [d.nazwa, d.branza || null, d.opis || null, d.typ || 'francja'])
  zapiszBaze()
  return queryOne('SELECT * FROM biznesy ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('biznesy:edytuj', (e, d) => {
  db.run(
    'UPDATE biznesy SET nip = ?, ksef_token = ?, ksef_srodowisko = ? WHERE id = ?',
    [d.nip || null, d.ksef_token || null, d.ksef_srodowisko || 'test', d.id]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM biznesy WHERE id = ?', [d.id])
})

ipcMain.handle('biznesy:usun', (e, id) => {
  db.run('DELETE FROM biznesy WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

// ---- PRACOWNICY ----
ipcMain.handle('pracownicy:pobierz', (e, biznes_id) =>
  queryAll('SELECT * FROM pracownicy WHERE biznes_id = ? ORDER BY aktywny DESC, ekipa, nazwisko', [biznes_id])
)

ipcMain.handle('pracownicy:dodaj', (e, d) => {
  db.run(
    `INSERT INTO pracownicy (
      biznes_id, imie, nazwisko, stanowisko, stawka_godzinowa, ekipa,
      pesel, data_urodzenia, adres, telefon, email,
      nr_dokumentu, dokument_waznosc, nr_konta, typ_umowy, dokument_umowy, umowa_do
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.biznes_id, d.imie, d.nazwisko, d.stanowisko, d.stawka_godzinowa, d.ekipa,
      d.pesel || null, d.data_urodzenia || null, d.adres || null, d.telefon || null, d.email || null,
      d.nr_dokumentu || null, d.dokument_waznosc || null, d.nr_konta || null, d.typ_umowy || null, d.dokument_umowy || null,
      d.umowa_do || null,
    ]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM pracownicy ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('pracownicy:edytuj', (e, d) => {
  db.run(
    `UPDATE pracownicy SET
      imie = ?, nazwisko = ?, stanowisko = ?, stawka_godzinowa = ?, ekipa = ?,
      pesel = ?, data_urodzenia = ?, adres = ?, telefon = ?, email = ?,
      nr_dokumentu = ?, dokument_waznosc = ?, nr_konta = ?, typ_umowy = ?, dokument_umowy = ?, umowa_do = ?
    WHERE id = ?`,
    [
      d.imie, d.nazwisko, d.stanowisko, d.stawka_godzinowa, d.ekipa,
      d.pesel || null, d.data_urodzenia || null, d.adres || null, d.telefon || null, d.email || null,
      d.nr_dokumentu || null, d.dokument_waznosc || null, d.nr_konta || null, d.typ_umowy || null, d.dokument_umowy || null,
      d.umowa_do || null,
      d.id,
    ]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM pracownicy WHERE id = ?', [d.id])
})

ipcMain.handle('pracownicy:usun', (e, id) => {
  db.run('UPDATE pracownicy SET aktywny = 0 WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

ipcMain.handle('pracownicy:przywroc', (e, id) => {
  db.run('UPDATE pracownicy SET aktywny = 1 WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

ipcMain.handle('pracownicy:wgraj-plik', (e, { nazwaPliku, dataBuffer }) => {
  const rozszerzenie = path.extname(nazwaPliku)
  const nazwaZapisu = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${rozszerzenie}`
  fs.writeFileSync(path.join(dokumentyPath, nazwaZapisu), Buffer.from(dataBuffer))
  return nazwaZapisu
})

ipcMain.handle('pracownicy:otworz-plik', (e, nazwaZapisu) => {
  shell.openPath(path.join(dokumentyPath, nazwaZapisu))
})

ipcMain.handle('pracownicy:usun-dokument-umowy', (e, id) => {
  const p = queryOne('SELECT dokument_umowy FROM pracownicy WHERE id = ?', [id])
  if (p && p.dokument_umowy) {
    fs.rmSync(path.join(dokumentyPath, p.dokument_umowy), { force: true })
  }
  db.run('UPDATE pracownicy SET dokument_umowy = NULL WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

ipcMain.handle('pliki:pobierz', (e, biznes_id) =>
  queryAll(`
    SELECT 'umowa' as typ, p.id as ref_id, p.id as pracownik_id, p.imie, p.nazwisko,
           'Skan umowy' as nazwa, p.dokument_umowy as plik, NULL as data_dodania
    FROM pracownicy p
    WHERE p.biznes_id = ? AND p.dokument_umowy IS NOT NULL
    UNION ALL
    SELECT 'dokument' as typ, d.id as ref_id, d.pracownik_id, p.imie, p.nazwisko,
           d.nazwa, d.plik, d.data_dodania
    FROM dokumenty_pracownika d
    JOIN pracownicy p ON d.pracownik_id = p.id
    WHERE p.biznes_id = ?
    ORDER BY data_dodania DESC
  `, [biznes_id, biznes_id])
)

// ---- DOKUMENTY PRACOWNIKA ----
ipcMain.handle('dokumenty:pobierz', (e, pracownik_id) =>
  queryAll('SELECT * FROM dokumenty_pracownika WHERE pracownik_id = ? ORDER BY data_dodania DESC', [pracownik_id])
)

ipcMain.handle('dokumenty:dodaj', (e, d) => {
  db.run(
    'INSERT INTO dokumenty_pracownika (pracownik_id, nazwa, plik) VALUES (?, ?, ?)',
    [d.pracownik_id, d.nazwa, d.plik]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM dokumenty_pracownika ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('dokumenty:usun', (e, id) => {
  const dokument = queryOne('SELECT * FROM dokumenty_pracownika WHERE id = ?', [id])
  if (dokument) {
    fs.rmSync(path.join(dokumentyPath, dokument.plik), { force: true })
  }
  db.run('DELETE FROM dokumenty_pracownika WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

// ---- WYJAZDY ----
ipcMain.handle('wyjazdy:pobierz', (e, biznes_id) =>
  queryAll('SELECT * FROM wyjazdy WHERE biznes_id = ? ORDER BY data_wyjazdu DESC', [biznes_id])
)

ipcMain.handle('wyjazdy:dodaj', (e, d) => {
  db.run(
    'INSERT INTO wyjazdy (biznes_id, ekipa, miejsce, data_wyjazdu, data_powrotu, zaliczka, wydatki_rzeczywiste, notatki) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [d.biznes_id, d.ekipa, d.miejsce, d.data_wyjazdu, d.data_powrotu, d.zaliczka, d.wydatki_rzeczywiste, d.notatki]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM wyjazdy ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('wyjazdy:edytuj', (e, d) => {
  db.run(
    `UPDATE wyjazdy SET
      ekipa = ?, miejsce = ?, data_wyjazdu = ?, data_powrotu = ?,
      zaliczka = ?, wydatki_rzeczywiste = ?, notatki = ?
    WHERE id = ?`,
    [d.ekipa, d.miejsce, d.data_wyjazdu, d.data_powrotu, d.zaliczka, d.wydatki_rzeczywiste, d.notatki, d.id]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM wyjazdy WHERE id = ?', [d.id])
})

ipcMain.handle('wyjazdy:usun', (e, id) => {
  db.run('DELETE FROM wyjazdy WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

// ---- FAKTURY PRZYCHODY ----
ipcMain.handle('faktury:pobierz', (e, biznes_id) =>
  queryAll('SELECT * FROM faktury_przychody WHERE biznes_id = ? ORDER BY data_wystawienia DESC', [biznes_id])
)

ipcMain.handle('faktury:dodaj', (e, d) => {
  db.run(
    'INSERT INTO faktury_przychody (biznes_id, wyjazd_id, numer_faktury, kwota, data_wystawienia, okres_od, okres_do, opis, nip_kontrahenta, waluta, kurs, kwota_oryginalna) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [d.biznes_id, d.wyjazd_id || null, d.numer_faktury || null, d.kwota, d.data_wystawienia, d.okres_od || null, d.okres_do || null, d.opis || null, d.nip_kontrahenta || null, d.waluta || 'PLN', d.kurs || 1, d.kwota_oryginalna ?? d.kwota]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM faktury_przychody ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('faktury:edytuj', (e, d) => {
  db.run(
    `UPDATE faktury_przychody SET
      numer_faktury = ?, kwota = ?, data_wystawienia = ?, okres_od = ?, okres_do = ?, opis = ?, nip_kontrahenta = ?, waluta = ?, kurs = ?, kwota_oryginalna = ?
    WHERE id = ?`,
    [d.numer_faktury || null, d.kwota, d.data_wystawienia, d.okres_od || null, d.okres_do || null, d.opis || null, d.nip_kontrahenta || null, d.waluta || 'PLN', d.kurs || 1, d.kwota_oryginalna ?? d.kwota, d.id]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM faktury_przychody WHERE id = ?', [d.id])
})

ipcMain.handle('faktury:usun', (e, id) => {
  db.run('DELETE FROM faktury_przychody WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

// ---- KURSY WALUT (NBP) ----
ipcMain.handle('kursy:nbp', async (e, { waluta, data }) => {
  if (!waluta || waluta === 'PLN') return { sukces: true, kurs: 1, data: data }
  const dzien = new Date(data + 'T00:00:00')
  for (let i = 0; i < 10; i++) {
    const szukanaData = dzien.toISOString().slice(0, 10)
    try {
      const resp = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${waluta.toLowerCase()}/${szukanaData}/?format=json`)
      if (resp.ok) {
        const dane = await resp.json()
        return { sukces: true, kurs: dane.rates[0].mid, data: szukanaData }
      }
    } catch (err) {
      return { sukces: false, blad: err.message }
    }
    dzien.setDate(dzien.getDate() - 1)
  }
  return { sukces: false, blad: `Brak kursu NBP dla ${waluta} w ostatnich 10 dniach` }
})

// ---- KSEF ----
ipcMain.handle('ksef:wyslij', async (e, { faktura_id }) => {
  const faktura = queryOne('SELECT * FROM faktury_przychody WHERE id = ?', [faktura_id])
  if (!faktura) return { sukces: false, blad: 'Nie znaleziono faktury' }

  const biznes = queryOne('SELECT * FROM biznesy WHERE id = ?', [faktura.biznes_id])
  if (!biznes || !biznes.nip || !biznes.ksef_token) {
    return { sukces: false, blad: 'Skonfiguruj NIP i token KSeF w ustawieniach integracji dla tego biznesu' }
  }

  try {
    const ksef = require('./ksef')
    const wynik = await ksef.wyslijFakture({
      srodowisko: biznes.ksef_srodowisko || 'test',
      nip: biznes.nip,
      ksefToken: biznes.ksef_token,
      sprzedawca: { nip: biznes.nip, nazwa: biznes.nazwa },
      nabywca: { nip: faktura.nip_kontrahenta || '', nazwa: faktura.opis || 'Kontrahent' },
      faktura: {
        numer: faktura.numer_faktury || `FV/${faktura.id}`,
        dataWystawienia: faktura.data_wystawienia,
        dataWytworzenia: faktura.data_wystawienia,
        kwotaNetto: faktura.kwota,
        kwotaBrutto: faktura.kwota,
      },
    })
    db.run(
      "UPDATE faktury_przychody SET ksef_numer = ?, ksef_status = ?, ksef_data_wyslania = datetime('now'), ksef_blad = NULL WHERE id = ?",
      [wynik.numerKsef, wynik.status, faktura_id]
    )
    zapiszBaze()
    return { sukces: true, ...wynik }
  } catch (err) {
    db.run("UPDATE faktury_przychody SET ksef_status = 'blad', ksef_blad = ? WHERE id = ?", [err.message, faktura_id])
    zapiszBaze()
    return { sukces: false, blad: err.message }
  }
})

// ---- KOSZTY TRANSPORTU ----
ipcMain.handle('koszty:pobierz', (e, wyjazd_id) =>
  queryAll(`
    SELECT k.*, p.imie, p.nazwisko 
    FROM koszty_transport k
    LEFT JOIN pracownicy p ON k.pracownik_id = p.id
    WHERE k.wyjazd_id = ?
    ORDER BY k.data DESC
  `, [wyjazd_id])
)

ipcMain.handle('koszty:dodaj', (e, d) => {
  db.run(
    'INSERT INTO koszty_transport (wyjazd_id, pracownik_id, typ, kwota, data, opis, dokument) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [d.wyjazd_id, d.pracownik_id, d.typ, d.kwota, d.data, d.opis, d.dokument]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM koszty_transport ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('koszty:usun', (e, id) => {
  db.run('DELETE FROM koszty_transport WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

// ---- WYPŁATY ----
ipcMain.handle('wyplaty:pobierz', (e, biznes_id) =>
  queryAll(`
    SELECT w.*, p.imie, p.nazwisko, p.ekipa
    FROM wyplaty w
    JOIN pracownicy p ON w.pracownik_id = p.id
    WHERE w.biznes_id = ?
    ORDER BY w.miesiac DESC, p.nazwisko
  `, [biznes_id])
)

ipcMain.handle('wyplaty:dodaj', (e, d) => {
  const pracownik = queryOne('SELECT stawka_godzinowa FROM pracownicy WHERE id = ?', [d.pracownik_id])
  const kwota = (d.godziny || 0) * (pracownik?.stawka_godzinowa || 0)
  db.run(
    'INSERT INTO wyplaty (pracownik_id, biznes_id, godziny, kwota, miesiac, notatki) VALUES (?, ?, ?, ?, ?, ?)',
    [d.pracownik_id, d.biznes_id, d.godziny, kwota, d.miesiac, d.notatki || null]
  )
  zapiszBaze()
  return { sukces: true }
})

ipcMain.handle('wyplaty:dodaj-hurtowo', (e, d) => {
  d.wpisy.forEach((wpis) => {
    if (!wpis.godziny) return
    const pracownik = queryOne('SELECT stawka_godzinowa FROM pracownicy WHERE id = ?', [wpis.pracownik_id])
    const kwota = wpis.godziny * (pracownik?.stawka_godzinowa || 0)
    db.run(
      'INSERT INTO wyplaty (pracownik_id, biznes_id, godziny, kwota, miesiac) VALUES (?, ?, ?, ?, ?)',
      [wpis.pracownik_id, d.biznes_id, wpis.godziny, kwota, d.miesiac]
    )
  })
  zapiszBaze()
  return { sukces: true }
})

// ---- BILANS ----
ipcMain.handle('bilans:pobierz', (e, biznes_id, miesiac) => {
  const warunekMiesiacFaktury = miesiac ? "AND strftime('%Y-%m', data_wystawienia) = ?" : ''
  const warunekMiesiacWyplaty = miesiac ? 'AND miesiac = ?' : ''
  const warunekMiesiacWyjazdy = miesiac ? "AND strftime('%Y-%m', w.data_wyjazdu) = ?" : ''
  const warunekMiesiacWydatki = miesiac ? "AND strftime('%Y-%m', data_wyjazdu) = ?" : ''
  const paramy = miesiac ? [biznes_id, miesiac] : [biznes_id]

  const przychody = queryOne(`SELECT COALESCE(SUM(kwota), 0) as suma FROM faktury_przychody WHERE biznes_id = ? ${warunekMiesiacFaktury}`, paramy)
  const wyplaty = queryOne(`SELECT COALESCE(SUM(kwota), 0) as suma FROM wyplaty WHERE biznes_id = ? ${warunekMiesiacWyplaty}`, paramy)
  const kosztyRaw = db.exec(`
    SELECT COALESCE(SUM(k.kwota), 0) as suma
    FROM koszty_transport k
    JOIN wyjazdy w ON k.wyjazd_id = w.id
    WHERE w.biznes_id = ? ${warunekMiesiacWyjazdy}
  `, paramy)
  const koszty = kosztyRaw.length ? kosztyRaw[0].values[0][0] : 0
  const wydatkiWyjazdy = queryOne(`SELECT COALESCE(SUM(wydatki_rzeczywiste), 0) as suma FROM wyjazdy WHERE biznes_id = ? ${warunekMiesiacWydatki}`, paramy)

  const suma_przychodow = przychody?.suma || 0
  const suma_wyplat = wyplaty?.suma || 0
  const suma_kosztow = (koszty || 0) + (wydatkiWyjazdy?.suma || 0)

  return {
    przychody: suma_przychodow,
    wyplaty: suma_wyplat,
    koszty_transport: suma_kosztow,
    zysk: suma_przychodow - suma_wyplat - suma_kosztow
  }
})

// ---- START ----
app.whenReady().then(async () => {
  await initDatabase()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
