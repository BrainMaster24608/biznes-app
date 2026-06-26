const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  biznesy: {
    pobierz: () => ipcRenderer.invoke('biznesy:pobierz'),
    dodaj: (d) => ipcRenderer.invoke('biznesy:dodaj', d),
    usun: (id) => ipcRenderer.invoke('biznesy:usun', id),
  },
  pracownicy: {
    pobierz: (biznes_id) => ipcRenderer.invoke('pracownicy:pobierz', biznes_id),
    dodaj: (d) => ipcRenderer.invoke('pracownicy:dodaj', d),
    usun: (id) => ipcRenderer.invoke('pracownicy:usun', id),
  },
  wyjazdy: {
    pobierz: (biznes_id) => ipcRenderer.invoke('wyjazdy:pobierz', biznes_id),
    dodaj: (d) => ipcRenderer.invoke('wyjazdy:dodaj', d),
    zamknij: (id) => ipcRenderer.invoke('wyjazdy:zamknij', id),
  },
  faktury: {
    pobierz: (biznes_id) => ipcRenderer.invoke('faktury:pobierz', biznes_id),
    dodaj: (d) => ipcRenderer.invoke('faktury:dodaj', d),
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
  },
  bilans: {
    pobierz: (biznes_id) => ipcRenderer.invoke('bilans:pobierz', biznes_id),
  }
})
