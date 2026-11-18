mod auth;
mod db;

/// Whether this installation can replace itself with a downloaded update.
///
/// Windows and macOS installers can. On Linux only the AppImage can (the
/// updater swaps the file pointed to by `$APPIMAGE`); .deb, .rpm and the Arch
/// package are updated through the system package manager. Mobile is not
/// supported by the updater at all.
#[tauri::command]
fn can_self_update() -> bool {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        true
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("APPIMAGE").is_some()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        false
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    // In-app updates and relaunch are desktop-only
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![
            auth::hash_password,
            auth::verify_password,
            can_self_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Florin");
}
