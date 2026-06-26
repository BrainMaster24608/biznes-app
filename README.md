# BiznesApp 🏢

Platforma zarządzania wieloma biznesami — aplikacja desktopowa.

## Uruchomienie (pierwsze uruchomienie)

Otwórz terminal w folderze projektu i wpisz:

```bash
npm install
npm start
```

## Codzienna praca

```bash
npm start        # uruchom aplikację
npm run dev      # uruchom z narzędziami deweloperskimi
```

## Struktura projektu

```
biznes-app/
├── package.json          # konfiguracja projektu i paczki
├── src/
│   ├── main.js           # główny proces Electron (backend)
│   ├── preload.js        # most między backendem a frontendem
│   └── renderer/
│       ├── index.html    # struktura interfejsu
│       ├── style.css     # wygląd
│       └── app.js        # logika interfejsu
```

## Dane

Baza danych SQLite jest zapisywana automatycznie w:
- **Mac**: `~/Library/Application Support/biznes-app/biznes-app.db`
- **Windows**: `C:\Users\TwojaNazwa\AppData\Roaming\biznes-app\biznes-app.db`
