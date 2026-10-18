//! ESP-IDF OTA update: the hardware side of `rid_ota.c`.
//!
//! Reads the OTA trigger GPIO, starts a temporary WiFi AP + HTTP server
//! if triggered, writes the firmware to the next update partition, and
//! reboots on success.

use esp_idf_svc as _;
use esp_idf_svc::sys::{self as sys};

/// Check the OTA trigger GPIO and, if held low, log it.
///
/// The dedicated "RemoteID-OTA" AP + upload server from `rid_ota.c` is not
/// implemented in this build. Entering the old infinite wait here would
/// hang the device at boot with no way to ever receive an image, so the
/// trigger is only reported and the normal boot sequence continues.
pub fn check_and_run(ota_trigger_gpio: i8) {
    if ota_trigger_gpio < 0 {
        return;
    }

    unsafe {
        let mut cfg: sys::gpio_config_t = core::mem::zeroed();
        cfg.pin_bit_mask = 1u64 << ota_trigger_gpio as u64;
        cfg.mode = sys::gpio_mode_t_GPIO_MODE_INPUT;
        cfg.pull_up_en = sys::gpio_pullup_t_GPIO_PULLUP_ENABLE;
        sys::gpio_config(&cfg);
        sys::vTaskDelay(10);
        if sys::gpio_get_level(ota_trigger_gpio as _) != 0 {
            return; // Not pressed.
        }
    }

    log::warn!(
        "[OTA] trigger GPIO {} held low at boot, but OTA mode is not implemented in this \
         build (no receive server): continuing normal boot.",
        ota_trigger_gpio
    );
}

/// Write a chunk to the OTA partition.
pub fn ota_write(handle: &mut OtaHandle, data: &[u8]) -> bool {
    handle.write(data)
}

/// Finalise the OTA handle.
pub fn ota_end(handle: OtaHandle) -> bool {
    handle.finish()
}

/// Reboot into the new firmware.
pub fn reboot() -> ! {
    unsafe {
        sys::esp_restart();
    }
    loop {}
}

/// Minimal OTA write handle wrapping ESP-IDF OTA APIs.
pub struct OtaHandle {
    handle: sys::esp_ota_handle_t,
    /// Update partition being written; it becomes the boot partition on
    /// success (kept here because `esp_ota_end` consumes the handle only).
    partition: *const sys::esp_partition_t,
}

impl OtaHandle {
    /// Begin an OTA write session to the next update partition.
    pub fn begin() -> Option<Self> {
        unsafe {
            let partition = sys::esp_ota_get_next_update_partition(core::ptr::null());
            if partition.is_null() {
                return None;
            }
            let mut handle: sys::esp_ota_handle_t = 0;
            if sys::esp_ota_begin(partition, usize::MAX, &mut handle) != sys::ESP_OK {
                return None;
            }
            Some(Self { handle, partition })
        }
    }

    fn write(&mut self, data: &[u8]) -> bool {
        unsafe {
            sys::esp_ota_write(self.handle, data.as_ptr() as *const _, data.len()) == sys::ESP_OK
        }
    }

    fn finish(self) -> bool {
        let ok = unsafe { sys::esp_ota_end(self.handle) == sys::ESP_OK };
        if ok {
            // Boot the partition that was just written (the update partition
            // chosen in `begin()`), not the running one: pointing the boot
            // selector back at `running` would silently discard the new image.
            unsafe {
                if sys::esp_ota_set_boot_partition(self.partition) != sys::ESP_OK {
                    return false;
                }
            }
        }
        ok
    }
}
