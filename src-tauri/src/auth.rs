use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

/// Hash a plaintext password using Argon2id.
/// Returns the PHC string (includes salt + hash).
#[tauri::command]
pub fn hash_password(password: String) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

/// Verify a plaintext password against a stored PHC hash.
#[tauri::command]
pub fn verify_password(password: String, hash: String) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(&hash).map_err(|e| e.to_string())?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify_correct_password() {
        let password = "test_password_123".to_string();
        let hash = hash_password(password.clone()).expect("hash should succeed");
        assert!(hash.starts_with("$argon2"));
        let ok = verify_password(password, hash).expect("verify should succeed");
        assert!(ok);
    }

    #[test]
    fn test_verify_wrong_password() {
        let hash = hash_password("correct_pass".to_string()).expect("hash should succeed");
        let ok = verify_password("wrong_pass".to_string(), hash).expect("verify should succeed");
        assert!(!ok);
    }

    #[test]
    fn test_verify_invalid_hash() {
        let result = verify_password("pass".to_string(), "not-a-hash".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_hash_different_salts() {
        let h1 = hash_password("same".to_string()).unwrap();
        let h2 = hash_password("same".to_string()).unwrap();
        // Same password should produce different hashes (different salt each time)
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_empty_password_hashes() {
        // Empty passwords should still hash (policy is enforced in frontend, not here)
        let hash = hash_password("".to_string());
        assert!(hash.is_ok());
    }

    #[test]
    fn test_minimum_length_password() {
        let hash = hash_password("12345678".to_string()).expect("8-char password should hash");
        let ok = verify_password("12345678".to_string(), hash).unwrap();
        assert!(ok);
    }
}
