//! Per-chip capability matrix, grounded in what the bindings in this crate
//! actually deliver (not just what the silicon/sdkconfig could support):
//! WiFi/BLE injection in `wifi.rs`/`ble.rs`, native USB on esp32s3/esp32c6.
//! A capability is `true` only when the transmit path behind it exists.

use rid_interface::region::Standard;

/// Compile-time capabilities of the selected chip. Choosing a chip is a
/// feature flag: exactly one of `esp32`, `esp32s3`, `esp32c6` must be active.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Capabilities {
    /// 2.4 GHz Wi-Fi (802.11 beacon / NAN injection).
    pub wifi: bool,
    /// BLE 4.x legacy advertising.
    pub ble: bool,
    /// BLE 5 extended advertising. True only where the binding transmits it
    /// (`ble::transmit_extended`: esp32s3 today — issue #45).
    pub ble5: bool,
    /// Native USB.
    pub usb: bool,
    /// NVS key/value storage.
    pub nvs: bool,
    /// Status LED.
    pub led: bool,
    /// HTTP JSON config API (`web.rs`, headless — no embedded page).
    pub web: bool,
    /// OTA update over Wi-Fi via the authenticated `/ota` upload handler.
    pub ota: bool,
    /// Broadcast standards the radio stack can transmit.
    pub standards: &'static [Standard],
}

impl Capabilities {
    /// Capabilities of the chip selected via the `esp32`/`esp32s3`/`esp32c6`
    /// features.
    pub fn current() -> Self {
        #[cfg(feature = "esp32")]
        return Self {
            wifi: true,
            ble: true,
            ble5: false,
            usb: false,
            nvs: true,
            led: true,
            web: true,
            ota: true,
            standards: &[Standard::Astm],
        };

        #[cfg(feature = "esp32s3")]
        return Self {
            wifi: true,
            ble: true,
            // Extended advertising transmits on S3 (ext-adv instances 0/1,
            // 1M + Coded PHY) — see `ble::transmit_extended`.
            ble5: true,
            usb: true,
            nvs: true,
            led: true,
            web: true,
            ota: true,
            standards: &[Standard::Astm],
        };

        #[cfg(feature = "esp32c6")]
        return Self {
            wifi: true,
            // Issue #45: the BLE stack is never initialised on C6 in this
            // port (`ble::init` is a no-op and both transmit paths return
            // `false`), so no BLE capability may be advertised. Re-enable
            // once the C6 binding actually transmits.
            ble: false,
            ble5: false,
            usb: true,
            nvs: true,
            led: true,
            web: true,
            ota: true,
            standards: &[Standard::Astm, Standard::ChnGb, Standard::Frdid],
        };

        #[cfg(not(any(feature = "esp32", feature = "esp32s3", feature = "esp32c6")))]
        {
            compile_error!("bsp-esp32: select exactly one chip feature: esp32, esp32s3 or esp32c6");
        }
    }

    /// Whether the radio stack can broadcast `standard`.
    pub fn supports(&self, standard: Standard) -> bool {
        self.standards.contains(&standard)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_chip_has_wifi() {
        let c = Capabilities::current();
        assert!(c.wifi);
    }

    #[test]
    fn ota_is_advertised_when_the_upload_handler_is_available() {
        assert!(Capabilities::current().ota);
    }

    #[test]
    #[cfg(feature = "esp32")]
    fn esp32_reports_legacy_ble_only() {
        let c = Capabilities::current();
        assert!(c.ble);
        assert!(!c.ble5);
    }

    #[test]
    #[cfg(feature = "esp32s3")]
    fn s3_reports_ble5() {
        let c = Capabilities::current();
        assert!(c.ble);
        assert!(c.ble5);
    }

    #[test]
    #[cfg(feature = "esp32c6")]
    fn c6_reports_no_ble_until_the_binding_transmits() {
        // Issue #45: `ble::init` is a no-op on C6 and both transmit paths
        // return false, so no BLE capability may be advertised.
        let c = Capabilities::current();
        assert!(!c.ble, "C6 must not advertise BLE4: init() is a no-op");
        assert!(
            !c.ble5,
            "C6 must not advertise BLE5: ext-adv never transmits"
        );
    }

    #[test]
    #[cfg(feature = "esp32c6")]
    fn esp32c6_supports_all_three_standards() {
        let c = Capabilities::current();
        assert!(c.supports(Standard::Astm));
        assert!(c.supports(Standard::ChnGb));
        assert!(c.supports(Standard::Frdid));
    }
}
