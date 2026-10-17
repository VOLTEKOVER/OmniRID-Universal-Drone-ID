# Connessione e comunicazione App <-> Firmware

## Panoramica
L'OmniRID-app (Nuxt 4) parla con il firmware ESP32 tramite l'API HTTP del device esposta a http://192.168.4.1 quando connessi al suo WiFi AP o sulla stessa rete.

L'app usa un proxy Nitro locale: `/api/esp/**` che durante `nuxt dev` forwarda verso il device, evitando problemi di CORS/mixed-content in sviluppo. In build statica (GitHub Pages) il proxy non esiste: l'app può funzionare in modalità simulata o via WebSerial per il flashing; per controllo reale serve hosting self-hosted con il proxy o navigazione diretta all'IP del device.

## Endpoint principali firmware (rid-app/web_config/bsp-esp32)
- GET `/api/capabilities` — info device, modello, features
- GET `/api/config` — legge configurazione corrente
- POST `/api/config` — salva configurazione (payload JSON). A lock_level >= 1 richiede header `X-Signature` (Ed25519) con firma sul body JSON canonizzato. Logica firmata in `rid-app/src/web_config.rs` (da collegare ai handler HTTP in `bsp-esp32/src/web.rs` se mancante).
- GET `/api/status` — stato operativo (GPS, etc)
- GET `/api/logs` — log ringbuffer testuale (usato da ConsoleTerminal)
- POST `/api/command` — comandi (es. Status/Restart/FactoryReset/Unknown) — può richiedere firma secondo logica
- POST `/api/reset` — reset/azioni speciali
- POST `/ota` — upload firmware. Richiede `X-Expected-SHA256` e `X-Signature` quando lock_level >= 1 (verifiche in `rid-app/src/ota.rs`). Il client invia header `x-esp-ip` tramite proxy.

## App → Device (come avviene)
- `server/routes/api/esp/[...path].ts` riceve richieste `/api/esp/*` e le forwarda a `http://192.168.4.1/*` aggiungendo `x-forwarded-for` e preservando body/headers. In produzione statico questa route non esiste.
- `useEspConnection()` usa `proxyFetch` che punta a `/api/esp/...` in sviluppo/modo proxy, altrimenti può puntare direttamente a `http://<espIp>/...`. Gestisce connessione via capabilities check.
- ConsoleTerminal legge da `GET /api/esp/api/logs` (attraverso proxy) e invia comandi a `POST /api/esp/api/command`.
- ConfigPage legge/scrive `api/esp/api/config`, PresetManager applica preset via POST config, firmware.vue usa `api/esp/ota` con header signature/SHA.

## Note su firma (per lock >= 1)
L'app **non** firma attualmente le POST config dal browser (manca chiave privata sul client). Per lock_level >= 1 il firmware deve ricevere `X-Signature` valida. Questo è documentato in `docs/security-hardening.md` (sezione "Known gaps"). L'UI può produrre richieste ma senza firma verranno rifiutate se lock è attivo. La guida della app menziona anche l'header manuale per OTA in alcuni casi.

## Debug rapido
- Verifica raggiungibilità: `curl http://192.168.4.1/api/capabilities`
- Logs: `curl http://192.168.4.1/api/logs`
- Config: `curl http://192.168.4.1/api/config`
