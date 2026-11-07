//! ESP-IDF NVS implementation of the [`NvsStore`] trait.
//!
//! Wraps `esp_idf_svc::nvs` to provide the key/value store used by
//! `rid_app::nvs::{save,load,erase}`.

use esp_idf_svc as _;
use esp_idf_svc::nvs::{EspNvsPartition, NvsDefault};
use rid_app::nvs::NvsStore;
use spin::Mutex;

const NS: &str = "esp_rid";

/// Shared handle to the default NVS partition, claimed once and kept for
/// the whole program lifetime.
///
/// `EspNvsPartition::take()` succeeds only while no other owner exists, so
/// every consumer (the config store here, the WiFi driver in `wifi.rs`)
/// must share this single handle instead of re-taking the partition: the
/// WiFi driver holds its clone forever, so any later `take()` would fail
/// and panic on the next `nvs_save`/`nvs_load`.
static PARTITION: Mutex<Option<EspNvsPartition<NvsDefault>>> = Mutex::new(None);

/// Returns the shared handle to the default NVS partition, claiming it on
/// first use.
pub fn partition() -> EspNvsPartition<NvsDefault> {
    let mut guard = PARTITION.lock();
    if guard.is_none() {
        let p = EspNvsPartition::<NvsDefault>::take().expect("default NVS partition unavailable");
        *guard = Some(p.clone());
    }
    guard.as_ref().expect("default NVS partition").clone()
}

/// ESP-IDF NVS implementation of `NvsStore`.
pub struct EspNvsStorage {
    partition: EspNvsPartition<NvsDefault>,
}

impl EspNvsStorage {
    /// Opens the `esp_rid` namespace on the default NVS partition.
    pub fn new() -> Self {
        Self {
            partition: partition(),
        }
    }

    fn open(&self) -> Result<esp_idf_svc::nvs::EspNvs<NvsDefault>, esp_idf_svc::sys::EspError> {
        esp_idf_svc::nvs::EspNvs::new(self.partition.clone(), NS, true)
    }
}

impl Default for EspNvsStorage {
    fn default() -> Self {
        Self::new()
    }
}

impl NvsStore for EspNvsStorage {
    fn get_str(&mut self, key: &str, out: &mut [u8]) -> bool {
        let Ok(h) = self.open() else {
            return false;
        };
        // The `&str` returned by `get_str` borrows its buffer argument, so copy
        // through a temporary and only then re-borrow `out`.
        let mut tmp = [0u8; 256];
        let n = match h.get_str(key, &mut tmp) {
            Ok(Some(s)) => s.len().min(out.len().saturating_sub(1)),
            _ => return false,
        };
        let (dst, rest) = out.split_at_mut(n);
        dst.copy_from_slice(&tmp[..n]);
        rest.fill(0);
        true
    }

    fn set_str(&mut self, key: &str, value: &str) {
        if let Ok(h) = self.open() {
            let _ = h.set_str(key, value);
        }
    }

    fn get_u8(&mut self, key: &str) -> Option<u8> {
        let h = self.open().ok()?;
        h.get_u8(key).ok().flatten()
    }

    fn set_u8(&mut self, key: &str, value: u8) {
        if let Ok(h) = self.open() {
            let _ = h.set_u8(key, value);
        }
    }

    fn get_i8(&mut self, key: &str) -> Option<i8> {
        let h = self.open().ok()?;
        h.get_i8(key).ok().flatten()
    }

    fn set_i8(&mut self, key: &str, value: i8) {
        if let Ok(h) = self.open() {
            let _ = h.set_i8(key, value);
        }
    }

    fn get_u32(&mut self, key: &str) -> Option<u32> {
        let h = self.open().ok()?;
        h.get_u32(key).ok().flatten()
    }

    fn set_u32(&mut self, key: &str, value: u32) {
        if let Ok(h) = self.open() {
            let _ = h.set_u32(key, value);
        }
    }

    fn get_f32(&mut self, key: &str) -> Option<f32> {
        let h = self.open().ok()?;
        let mut buf = [0u8; 4];
        h.get_blob(key, &mut buf).ok()?;
        Some(f32::from_le_bytes(buf))
    }

    fn set_f32(&mut self, key: &str, value: f32) {
        if let Ok(h) = self.open() {
            let _ = h.set_blob(key, &value.to_le_bytes());
        }
    }

    fn get_f64(&mut self, key: &str) -> Option<f64> {
        let h = self.open().ok()?;
        let mut buf = [0u8; 8];
        h.get_blob(key, &mut buf).ok()?;
        Some(f64::from_le_bytes(buf))
    }

    fn set_f64(&mut self, key: &str, value: f64) {
        if let Ok(h) = self.open() {
            let _ = h.set_blob(key, &value.to_le_bytes());
        }
    }

    fn get_blob(&mut self, key: &str, out: &mut [u8]) -> bool {
        let h = match self.open() {
            Ok(h) => h,
            Err(_) => return false,
        };
        match h.get_blob(key, out) {
            Ok(Some(_)) => true,
            _ => false,
        }
    }

    fn set_blob(&mut self, key: &str, value: &[u8]) {
        if let Ok(h) = self.open() {
            let _ = h.set_blob(key, value);
        }
    }

    fn erase_all(&mut self) {
        if let Ok(h) = self.open() {
            let _ = h.erase_all();
        }
    }
}

/// Initialise the NVS flash partition.  Port of `nvs_storage_init()`.
pub fn init() {
    esp_idf_svc::sys::esp!(unsafe { esp_idf_sys::nvs_flash_init() })
        .or_else(|_| unsafe {
            esp_idf_sys::nvs_flash_erase();
            esp_idf_sys::nvs_flash_init();
            Ok::<(), esp_idf_svc::sys::EspError>(())
        })
        .expect("NVS init failed");

    // Claim the shared default-partition handle up front (boot order:
    // `init` -> `nvs_load` -> `wifi::init`), so every later user clones it
    // instead of re-taking the partition.
    let _ = partition();
}
