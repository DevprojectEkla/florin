mod auth;
mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            auth::hash_password,
            auth::verify_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Florin");
}
