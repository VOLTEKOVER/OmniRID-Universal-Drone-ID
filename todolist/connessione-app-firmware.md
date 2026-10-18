# Connessione e comunicazione App <-> Firmware

## Panoramica
L'OmniRID-app (Nuxt 4) parla con il firmware ESP32 tramite l'API HTTP del device esposta a http://192.168.4.1 quando connessi al suo WiFi AP o sulla stessa rete.

L'app usa un proxy Nitro locale: `/api/esp/**` che durante `nuxt dev` forwarda verso il device, evitando problemi di CORS/mixed-content in sviluppo. In build statica (GitHub Pages) il proxy non esiste: l'app può funzionare in modalità simulata o via WebSerial per il flashing; per il controllo reale serve hosting self-hosted con il proxy **oppure navigazione diretta all'IP del device** — dal 2026-10-18 il firmware è headless e serve solo JSON con **CORS permessivo + preflight OPTIONS su tutte le route** (`bsp-esp32/src/web.rs`), quindi la PWA su GitHub Pages può parlare direttamente con `http://192.168.4.1` senza proxy.

## Endpoint principali firmware (rid-app/web_config/bsp-esp32)
- GET `/api/capabilities` — info device, modello, features
- GET `/api/config` — legge configurazione corrente
- POST `/api/config` — salva configurazione (payload JSON). A lock_level >= 1 richiede header `X-Signature` (Ed25519) con firma sul body JSON canonizzato. Logica firmata in `rid-app/src/web_config.rs` (`signed_action_decision`), **già collegata** ai handler HTTP di `bsp-esp32/src/web.rs` (`write_decision`): 401 se firma assente/non valida, 429 dopo 10 tentativi falliti/60 s (rate limiter condiviso con `/api/reset` e `/api/command`).
- GET `/api/status` — stato operativo (GPS, etc)
- GET `/api/logs` — JSON con le righe del log ringbuffer (usato da ConsoleTerminal / `useFirmwareLogs`)
- POST `/api/command` — comandi (es. Status/Restart/FactoryReset/Unknown) — a lock_level >= 1 restart/reset richiedono `X-Signature` valida (`command_needs_auth`), stessa rate limitazione 10 fail/60 s → 429
- POST `/api/reset` — reset/azioni speciali
- POST `/ota` — upload firmware. Richiede `X-Expected-SHA256` e `X-Signature` quando lock_level >= 1 (verifiche in `rid-app/src/ota.rs`). Il client invia header `x-esp-ip` tramite proxy.

## App → Device (come avviene)
- `server/routes/api/esp/[...path].ts` riceve richieste `/api/esp/*` e le forwarda a `http://<x-esp-ip>/<path>` (default `192.168.4.1`; solo IPv4 privato accettato, guard anti-SSRF), preservando body e header rilevanti (`content-type`, `x-expected-sha256`, `x-signature`), con timeout guidato da `x-esp-timeout` (max 5 min per OTA) e risposta limitata a 1 MB. In produzione statico questa route non esiste.
- `useEspConnection()` usa `proxyFetch` che punta a `/api/esp/...` in sviluppo/modo proxy, altrimenti può puntare direttamente a `http://<espIp>/...`. Gestisce connessione via capabilities check.
- ConsoleTerminal legge da `GET /api/esp/api/logs` (attraverso proxy) e invia comandi a `POST /api/esp/api/command`.
- ConfigPage legge/scrive `api/esp/api/config`, PresetManager applica preset via POST config, firmware.vue usa `api/esp/ota` con header signature/SHA.

## Note su firma (per lock >= 1)
L'app **non** firma attualmente le POST config dal browser (manca chiave privata sul client). Per lock_level >= 1 il firmware deve ricevere `X-Signature` valida. Questo è documentato in `todolist/security-hardening.md` (sezione "Known gaps"). L'UI può produrre richieste ma senza firma verranno rifiutate se lock è attivo. La guida della app menziona anche l'header manuale per OTA in alcuni casi.

## Debug rapido
- Verifica raggiungibilità: `curl http://192.168.4.1/api/capabilities`
- Logs: `curl http://192.168.4.1/api/logs`
- Config: `curl http://192.168.4.1/api/config`
