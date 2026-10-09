// Consume the ESP-IDF linker args and cfg flags propagated by
// esp-idf-sys (through esp-idf-svc/esp-idf-hal) and apply them to every
// artifact of this package, including the final binary. Without this, the
// propagated linker args -- most importantly `--ldproxy-linker <gcc>` --
// never reach the link step and `ldproxy` fails with:
//   "Cannot locate argument '--ldproxy-linker <linker>'".
fn main() {
    embuild::espidf::sysenv::output();
    embuild::espidf::sysenv::relay();
}