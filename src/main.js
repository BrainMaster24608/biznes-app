const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
let db
let SQL

const dbPath = path.join(app.getPath('userData'), 'biznes-app.db')

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
      wyplata_miesieczna REAL DEFAULT 0,
      ekipa INTEGER DEFAULT 1,
      aktywny INTEGER DEFAULT 1,
      FOREIGN KEY (biznes_id) REFERENCES biznesy(id)
    );

    CREATE TABLE IF NOT EXISTS wyjazdy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      biznes_id INTEGER NOT NULL,
      ekipa INTEGER NOT NULL,
      miejsce TEXT NOT NULL,
      data_wyjazdu TEXT NOT NULL,
      data_powrotu TEXT,
      zaliczka REAL DEFAULT 0,
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
  db.run('INSERT INTO biznesy (nazwa, branza, opis, typ) VALUES (?, ?, ?, ?)', [d.nazwa, d.branza, d.opis, d.typ || 'francja'])
  zapiszBaze()
  return queryOne('SELECT * FROM biznesy ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('biznesy:usun', (e, id) => {
  db.run('DELETE FROM biznesy WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

// ---- PRACOWNICY ----
ipcMain.handle('pracownicy:pobierz', (e, biznes_id) =>
  queryAll('SELECT * FROM pracownicy WHERE biznes_id = ? AND aktywny = 1 ORDER BY ekipa, nazwisko', [biznes_id])
)

ipcMain.handle('pracownicy:dodaj', (e, d) => {
  db.run(
    'INSERT INTO pracownicy (biznes_id, imie, nazwisko, stanowisko, wyplata_miesieczna, ekipa) VALUES (?, ?, ?, ?, ?, ?)',
    [d.biznes_id, d.imie, d.nazwisko, d.stanowisko, d.wyplata_miesieczna, d.ekipa]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM pracownicy ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('pracownicy:usun', (e, id) => {
  db.run('UPDATE pracownicy SET aktywny = 0 WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
})

// ---- WYJAZDY ----
ipcMain.handle('wyjazdy:pobierz', (e, biznes_id) =>
  queryAll('SELECT * FROM wyjazdy WHERE biznes_id = ? ORDER BY data_wyjazdu DESC', [biznes_id])
)

ipcMain.handle('wyjazdy:dodaj', (e, d) => {
  db.run(
    'INSERT INTO wyjazdy (biznes_id, ekipa, miejsce, data_wyjazdu, data_powrotu, zaliczka, notatki) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [d.biznes_id, d.ekipa, d.miejsce, d.data_wyjazdu, d.data_powrotu, d.zaliczka, d.notatki]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM wyjazdy ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('wyjazdy:zamknij', (e, id) => {
  db.run('UPDATE wyjazdy SET status = ? WHERE id = ?', ['zakończony', id])
  zapiszBaze()
  return { sukces: true }
})

// ---- FAKTURY PRZYCHODY ----
ipcMain.handle('faktury:pobierz', (e, biznes_id) =>
  queryAll('SELECT * FROM faktury_przychody WHERE biznes_id = ? ORDER BY data_wystawienia DESC', [biznes_id])
)

ipcMain.handle('faktury:dodaj', (e, d) => {
  db.run(
    'INSERT INTO faktury_przychody (biznes_id, wyjazd_id, numer_faktury, kwota, data_wystawienia, okres_od, okres_do, opis) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [d.biznes_id, d.wyjazd_id, d.numer_faktury, d.kwota, d.data_wystawienia, d.okres_od, d.okres_do, d.opis]
  )
  zapiszBaze()
  return queryOne('SELECT * FROM faktury_przychody ORDER BY id DESC LIMIT 1')
})

ipcMain.handle('faktury:usun', (e, id) => {
  db.run('DELETE FROM faktury_przychody WHERE id = ?', [id])
  zapiszBaze()
  return { sukces: true }
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
  db.run(
    'INSERT INTO wyplaty (pracownik_id, biznes_id, kwota, miesiac, data_wyplaty, notatki) VALUES (?, ?, ?, ?, ?, ?)',
    [d.pracownik_id, d.biznes_id, d.kwota, d.miesiac, d.data_wyplaty, d.notatki]
  )
  zapiszBaze()
  return { sukces: true }
})

// ---- BILANS ----
ipcMain.handle('bilans:pobierz', (e, biznes_id) => {
  const przychody = queryOne('SELECT COALESCE(SUM(kwota), 0) as suma FROM faktury_przychody WHERE biznes_id = ?', [biznes_id])
  const wyplaty = queryOne('SELECT COALESCE(SUM(kwota), 0) as suma FROM wyplaty WHERE biznes_id = ?', [biznes_id])
  const kosztyRaw = db.exec(`
    SELECT COALESCE(SUM(k.kwota), 0) as suma 
    FROM koszty_transport k
    JOIN wyjazdy w ON k.wyjazd_id = w.id
    WHERE w.biznes_id = ?
  `, [biznes_id])
  const koszty = kosztyRaw.length ? kosztyRaw[0].values[0][0] : 0

  const suma_przychodow = przychody?.suma || 0
  const suma_wyplat = wyplaty?.suma || 0
  const suma_kosztow = koszty || 0

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
