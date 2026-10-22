use std::{
    fs,
    io::{self, Write},
    path::Path,
};

use serde_json::{Map, Value};

fn read_bytes(path: &Path) -> io::Result<Option<Vec<u8>>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

fn parse(bytes: &[u8]) -> io::Result<Map<String, Value>> {
    serde_json::from_slice(bytes).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

pub fn read(path: &Path, key: &str) -> io::Result<Option<Value>> {
    let Some(bytes) = read_bytes(path)? else {
        return Ok(None);
    };
    match parse(&bytes)?.remove(key) {
        Some(Value::Null) => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Stored settings value must not be null",
        )),
        value => Ok(value),
    }
}

pub fn write(path: &Path, key: String, value: Value, reset: bool) -> io::Result<()> {
    let previous = read_bytes(path)?;
    let mut document = match previous.as_deref().map(parse).transpose() {
        Ok(document) => document.unwrap_or_default(),
        // Only an explicit reset may replace a corrupt document, after backing it up below.
        Err(_) if reset => Map::new(),
        Err(error) => return Err(error),
    };
    document.insert(key, value);
    let bytes = serde_json::to_vec_pretty(&document).map_err(io::Error::other)?;
    let directory = path.parent().expect("settings file has a parent directory");
    fs::create_dir_all(directory)?;

    if let Some(previous) = previous.filter(|_| reset) {
        let mut backup = tempfile::Builder::new()
            .prefix("settings.backup-")
            .suffix(".json")
            .tempfile_in(directory)?;
        backup.write_all(&previous)?;
        backup.as_file().sync_all()?;
        backup.keep().map_err(|error| error.error)?;
    }

    let mut file = tempfile::NamedTempFile::new_in(directory)?;
    file.write_all(&bytes)?;
    file.as_file().sync_all()?;
    file.persist(path).map_err(|error| error.error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_file_returns_none_and_first_save_creates_directory() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("new").join("settings.json");

        assert_eq!(read(&path, "settings").unwrap(), None);
        write(&path, "settings".into(), json!({ "theme": "dark" }), false).unwrap();
        assert_eq!(
            read(&path, "settings").unwrap(),
            Some(json!({ "theme": "dark" }))
        );
    }

    #[test]
    fn corrupt_documents_are_not_overwritten_by_normal_writes() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.json");

        for bytes in [b"{broken".as_slice(), b"[]", b"null"] {
            fs::write(&path, bytes).unwrap();
            assert_eq!(
                read(&path, "settings").unwrap_err().kind(),
                io::ErrorKind::InvalidData
            );
            assert!(write(&path, "settings".into(), json!({}), false).is_err());
            assert_eq!(fs::read(&path).unwrap(), bytes);
            assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        }
    }

    #[test]
    fn null_settings_value_is_invalid_and_preserves_original_bytes() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.json");
        let original = br#"{"settings":null,"other":"preserve"}"#;
        fs::write(&path, original).unwrap();

        assert_eq!(
            read(&path, "settings").unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
        assert_eq!(read(&path, "absent").unwrap(), None);
        assert_eq!(fs::read(&path).unwrap(), original);
    }

    #[test]
    fn writes_preserve_other_keys_including_explicit_reset() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.json");
        fs::write(
            &path,
            br#"{"other":{"token":"preserve"},"settings":{"theme":"light"}}"#,
        )
        .unwrap();

        for reset in [false, true] {
            write(&path, "settings".into(), json!({ "theme": "dark" }), reset).unwrap();
            assert_eq!(
                read(&path, "other").unwrap(),
                Some(json!({ "token": "preserve" }))
            );
            assert_eq!(
                read(&path, "settings").unwrap(),
                Some(json!({ "theme": "dark" }))
            );
            assert_eq!(read(&path, "absent").unwrap(), None);
        }
    }

    #[test]
    fn explicit_reset_backs_up_original_bytes_without_overwriting_backups() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.json");
        let original = b"{broken settings\n";
        fs::write(&path, original).unwrap();

        write(&path, "settings".into(), json!({ "theme": "system" }), true).unwrap();
        assert_eq!(
            read(&path, "settings").unwrap(),
            Some(json!({ "theme": "system" }))
        );
        let first_backup = fs::read_dir(directory.path())
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|entry| entry != &path)
            .unwrap();
        assert_eq!(fs::read(&first_backup).unwrap(), original);

        write(&path, "settings".into(), json!({ "theme": "light" }), true).unwrap();
        assert_eq!(fs::read(&first_backup).unwrap(), original);
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 3);
    }

    #[test]
    fn io_errors_are_not_treated_as_missing_or_resettable() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.json");
        fs::create_dir(&path).unwrap();

        assert!(read(&path, "settings").is_err());
        assert!(write(&path, "settings".into(), json!({}), true).is_err());
        assert!(path.is_dir());
    }

    #[cfg(windows)]
    #[test]
    fn failed_replacement_preserves_original_and_cleans_temporary_file() {
        use std::os::windows::fs::OpenOptionsExt;

        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("settings.json");
        let original = br#"{"settings":{"theme":"light"}}"#;
        fs::write(&path, original).unwrap();
        // Permit reading the original but deny replacing an open file on Windows.
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(3)
            .open(&path)
            .unwrap();

        assert!(write(&path, "settings".into(), json!({ "theme": "dark" }), false).is_err());
        drop(lock);
        assert_eq!(fs::read(&path).unwrap(), original);
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }
}
