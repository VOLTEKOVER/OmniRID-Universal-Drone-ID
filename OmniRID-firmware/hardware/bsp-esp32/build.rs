// Consume the ESP-IDF linker args and cfg flags propagated by
// esp-idf-sys (through esp-idf-svc/esp-idf-hal) and apply them to every
// artifact of this package, including the final binary. Without this, the
// propagated linker args -- most importantly `--ldproxy-linker <gcc>` --
// never reach the link step and `ldproxy` fails with:
//   "Cannot locate argument '--ldproxy-linker <linker>'".
// Host builds (no `hardware` feature) have no ESP-IDF metadata to propagate:
// the sysenv relay only runs for real firmware builds. The gate uses the
// `CARGO_FEATURE_*` env var (available to any build script at runtime) rather
// than `#[cfg(feature)]`, so this script stays compilable on hosts where
// `embuild::espidf` would otherwise be configured out — that is what makes
// `cargo test` for the `caps` matrix work on any host.
fn main() {
    if std::env::var_os("CARGO_FEATURE_HARDWARE").is_some() {
        embuild::espidf::sysenv::output();
        embuild::espidf::sysenv::relay();
    }
}
