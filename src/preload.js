const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  biznesy: {
    pobierz: () => ipcRenderer.invoke('biznesy:pobierz'),
    dodaj: (d) => ipcRenderer.invoke('biznesy:dodaj', d),
    edytuj: (d) => ipcRenderer.invoke('biznesy:edytuj', d),
    usun: (id) => ipcRenderer.invoke('biznesy:usun', id),
  },
  pracownicy: {
    pobierz: (biznes_id) => ipcRenderer.invoke('pracownicy:pobierz', biznes_id),
    dodaj: (d) => ipcRenderer.invoke('pracownicy:dodaj', d),
    edytuj: (d) => ipcRenderer.invoke('pracownicy:edytuj', d),
    usun: (id) => ipcRenderer.invoke('pracownicy:usun', id),
    przywroc: (id) => ipcRenderer.invoke('pracownicy:przywroc', id),
    wgrajPlik: (nazwaPliku, dataBuffer) => ipcRenderer.invoke('pracownicy:wgraj-plik', { nazwaPliku, dataBuffer }),
    otworzPlik: (nazwaZapisu) => ipcRenderer.invoke('pracownicy:otworz-plik', nazwaZapisu),
    usunDokumentUmowy: (id) => ipcRenderer.invoke('pracownicy:usun-dokument-umowy', id),
  },
  pliki: {
    pobierz: (biznes_id) => ipcRenderer.invoke('pliki:pobierz', biznes_id),
  },
  dokumenty: {
    pobierz: (pracownik_id) => ipcRenderer.invoke('dokumenty:pobierz', pracownik_id),
    dodaj: (d) => ipcRenderer.invoke('dokumenty:dodaj', d),
    usun: (id) => ipcRenderer.invoke('dokumenty:usun', id),
  },
  wyjazdy: {
    pobierz: (biznes_id) => ipcRenderer.invoke('wyjazdy:pobierz', biznes_id),
    dodaj: (d) => ipcRenderer.invoke('wyjazdy:dodaj', d),
    edytuj: (d) => ipcRenderer.invoke('wyjazdy:edytuj', d),
    usun: (id) => ipcRenderer.invoke('wyjazdy:usun', id),
  },
  faktury: {
    pobierz: (biznes_id) => ipcRenderer.invoke('faktury:pobierz', biznes_id),
    dodaj: (d) => ipcRenderer.invoke('faktury:dodaj', d),
    edytuj: (d) => ipcRenderer.invoke('faktury:edytuj', d),
    usun: (id) => ipcRenderer.invoke('faktury:usun', id),
  },
  koszty: {
    pobierz: (wyjazd_id) => ipcRenderer.invoke('koszty:pobierz', wyjazd_id),
    dodaj: (d) => ipcRenderer.invoke('koszty:dodaj', d),
    usun: (id) => ipcRenderer.invoke('koszty:usun', id),
  },
  wyplaty: {
    pobierz: (biznes_id) => ipcRenderer.invoke('wyplaty:pobierz', biznes_id),
    dodaj: (d) => ipcRenderer.invoke('wyplaty:dodaj', d),
    dodajHurtowo: (d) => ipcRenderer.invoke('wyplaty:dodaj-hurtowo', d),
  },
  bilans: {
    pobierz: (biznes_id, miesiac) => ipcRenderer.invoke('bilans:pobierz', biznes_id, miesiac),
  },
  ksef: {
    wyslij: (faktura_id) => ipcRenderer.invoke('ksef:wyslij', { faktura_id }),
  },
  kursy: {
    pobierzNbp: (waluta, data) => ipcRenderer.invoke('kursy:nbp', { waluta, data }),
  }
})
