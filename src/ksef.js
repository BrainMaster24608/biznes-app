// Klient KSeF (Krajowy System e-Faktur) — wstępna integracja.
//
// UWAGA: Endpointy KSeF API 2.0 poniżej odpowiadają opublikowanej przez
// Ministerstwo Finansów specyfikacji (OpenAPI) na dzień napisania tego kodu.
// MF potrafi zmieniać szczegóły API w trakcie trwania testów otwartych —
// przed użyciem na koncie testowym/produkcyjnym warto zweryfikować dokładne
// ścieżki w aktualnym Swaggerze: https://api-test.ksef.mf.gov.pl/
//
// Przepływ uwierzytelnienia tokenem (uproszczony, docelowo zastąpiony przez
// certyfikaty KSeF, ale token działa jeszcze przez cały 2026 rok):
//   1. POST /api/v2/auth/challenge            -> challenge + timestamp
//   2. zaszyfrowanie "NIP|token|timestamp" kluczem publicznym MF (RSA-OAEP)
//   3. POST /api/v2/auth/token                -> zwraca referenceNumber/authenticationToken
//   4. GET  /api/v2/auth/token/{referenceNumber} -> polling do statusu 200 (zalogowano)
//   5. POST /api/v2/sessions/online            -> otwarcie sesji interaktywnej
//   6. POST /api/v2/sessions/online/{sessionRef}/invoices -> wysłanie faktury FA(3) XML
//   7. GET  /api/v2/sessions/online/{sessionRef}/invoices/{ref} -> status przetworzenia
//   8. POST /api/v2/sessions/online/{sessionRef}/close -> zamknięcie sesji + UPO

const ENV_URL = {
  test: 'https://api-test.ksef.mf.gov.pl',
  demo: 'https://api-demo.ksef.mf.gov.pl',
  produkcja: 'https://api.ksef.mf.gov.pl',
}

function bazowyUrl(srodowisko) {
  return ENV_URL[srodowisko] || ENV_URL.test
}

async function pobierzKluczPubliczny(srodowisko) {
  const resp = await fetch(`${bazowyUrl(srodowisko)}/api/v2/security/public-key-certificate`)
  if (!resp.ok) throw new Error(`Nie udało się pobrać klucza publicznego KSeF (HTTP ${resp.status})`)
  return resp.text()
}

function zaszyfrujTokenAutoryzacyjny(certyfikatPem, tekst) {
  const crypto = require('crypto')
  const bufor = Buffer.from(tekst, 'utf-8')
  return crypto.publicEncrypt(
    {
      key: certyfikatPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    bufor,
  ).toString('base64')
}

async function uzyskajChallenge(srodowisko) {
  const resp = await fetch(`${bazowyUrl(srodowisko)}/api/v2/auth/challenge`, { method: 'POST' })
  if (!resp.ok) throw new Error(`KSeF: błąd pobrania challenge (HTTP ${resp.status})`)
  return resp.json()
}

async function zalogujTokenem(srodowisko, nip, ksefToken) {
  const { challenge, timestamp } = await uzyskajChallenge(srodowisko)
  const certyfikat = await pobierzKluczPubliczny(srodowisko)
  const tekstDoSzyfrowania = `${challenge}|${timestamp}`
  const zaszyfrowanyToken = zaszyfrujTokenAutoryzacyjny(certyfikat, `${ksefToken}|${tekstDoSzyfrowania}`)

  const resp = await fetch(`${bazowyUrl(srodowisko)}/api/v2/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge,
      contextIdentifier: { type: 'nip', identifier: nip },
      encryptedToken: zaszyfrowanyToken,
    }),
  })
  if (!resp.ok) {
    const tresc = await resp.text().catch(() => '')
    throw new Error(`KSeF: logowanie nieudane (HTTP ${resp.status}) ${tresc}`)
  }
  const dane = await resp.json()

  for (let i = 0; i < 10; i++) {
    const statusResp = await fetch(`${bazowyUrl(srodowisko)}/api/v2/auth/token/${dane.referenceNumber}`)
    const statusDane = await statusResp.json().catch(() => null)
    if (statusDane && statusDane.status && statusDane.status.code === 200) {
      return statusDane.accessToken
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  throw new Error('KSeF: przekroczono czas oczekiwania na potwierdzenie logowania')
}

async function otworzSesje(srodowisko, accessToken) {
  const resp = await fetch(`${bazowyUrl(srodowisko)}/api/v2/sessions/online`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken.token || accessToken}` },
    body: JSON.stringify({ formCode: { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } }),
  })
  if (!resp.ok) {
    const tresc = await resp.text().catch(() => '')
    throw new Error(`KSeF: nie udało się otworzyć sesji (HTTP ${resp.status}) ${tresc}`)
  }
  return resp.json()
}

async function wyslijFaktureXml(srodowisko, accessToken, sessionRef, xml) {
  const resp = await fetch(`${bazowyUrl(srodowisko)}/api/v2/sessions/online/${sessionRef}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken.token || accessToken}` },
    body: JSON.stringify({ invoiceHash: null, invoicePayload: { type: 'plain', invoiceBody: Buffer.from(xml, 'utf-8').toString('base64') } }),
  })
  if (!resp.ok) {
    const tresc = await resp.text().catch(() => '')
    throw new Error(`KSeF: błąd wysyłki faktury (HTTP ${resp.status}) ${tresc}`)
  }
  return resp.json()
}

async function sprawdzStatusFaktury(srodowisko, accessToken, sessionRef, elementReferenceNumber) {
  const resp = await fetch(
    `${bazowyUrl(srodowisko)}/api/v2/sessions/online/${sessionRef}/invoices/${elementReferenceNumber}`,
    { headers: { Authorization: `Bearer ${accessToken.token || accessToken}` } },
  )
  if (!resp.ok) {
    const tresc = await resp.text().catch(() => '')
    throw new Error(`KSeF: błąd sprawdzania statusu (HTTP ${resp.status}) ${tresc}`)
  }
  return resp.json()
}

async function zamknijSesje(srodowisko, accessToken, sessionRef) {
  const resp = await fetch(`${bazowyUrl(srodowisko)}/api/v2/sessions/online/${sessionRef}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken.token || accessToken}` },
  })
  return resp.ok
}

// Budowa minimalnej faktury w strukturze FA(3) — wycinek wystarczający do
// poprawnego wskazania sprzedawcy/nabywcy, pozycji i kwoty. Pełna struktura
// FA(3) ma znacznie więcej opcjonalnych węzłów (rabaty, załączniki, JST itd.)
// — należy ją rozbudować zgodnie z realnymi potrzebami przed produkcją.
function zbudujFakturaFA3Xml({ sprzedawca, nabywca, faktura }) {
  const escXml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/30/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${escXml(faktura.dataWytworzenia)}</DataWytworzeniaFa>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${escXml(sprzedawca.nip)}</NIP>
      <Nazwa>${escXml(sprzedawca.nazwa)}</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${escXml(nabywca.nip)}</NIP>
      <Nazwa>${escXml(nabywca.nazwa)}</Nazwa>
    </DaneIdentyfikacyjne>
  </Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>${escXml(faktura.dataWystawienia)}</P_1>
    <P_2>${escXml(faktura.numer)}</P_2>
    <P_13_1>${escXml(faktura.kwotaNetto)}</P_13_1>
    <P_15>${escXml(faktura.kwotaBrutto)}</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
  </Fa>
</Faktura>`
}

// Pełny przepływ: logowanie -> sesja -> wysyłka -> status -> zamknięcie.
async function wyslijFakture({ srodowisko, nip, ksefToken, sprzedawca, nabywca, faktura }) {
  const accessToken = await zalogujTokenem(srodowisko, nip, ksefToken)
  const sesja = await otworzSesje(srodowisko, accessToken)
  const xml = zbudujFakturaFA3Xml({ sprzedawca, nabywca, faktura })
  const wynikWysylki = await wyslijFaktureXml(srodowisko, accessToken, sesja.referenceNumber, xml)

  let statusOdpowiedzi = null
  for (let i = 0; i < 10; i++) {
    statusOdpowiedzi = await sprawdzStatusFaktury(srodowisko, accessToken, sesja.referenceNumber, wynikWysylki.referenceNumber)
    if (statusOdpowiedzi.status && statusOdpowiedzi.status.code !== 100) break
    await new Promise((r) => setTimeout(r, 1000))
  }

  await zamknijSesje(srodowisko, accessToken, sesja.referenceNumber)

  return {
    numerKsef: statusOdpowiedzi?.ksefReferenceNumber || null,
    status: statusOdpowiedzi?.status?.description || 'wyslano',
    sessionRef: sesja.referenceNumber,
    elementRef: wynikWysylki.referenceNumber,
  }
}

module.exports = {
  wyslijFakture,
  zbudujFakturaFA3Xml,
  ENV_URL,
}
