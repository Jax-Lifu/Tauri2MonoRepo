use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Greeting {
    pub message: String,
}

pub fn greet(name: &str) -> Greeting {
    let name = name.trim();
    let name = if name.is_empty() { "World" } else { name };
    Greeting {
        message: format!("Hello, {name}! (from app-core)"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greets_by_name_and_trims_whitespace() {
        assert_eq!(greet("  Tauri \n").message, "Hello, Tauri! (from app-core)");
    }

    #[test]
    fn falls_back_to_world() {
        for name in ["", " \t\n", "\u{3000}"] {
            assert_eq!(greet(name).message, "Hello, World! (from app-core)");
        }
    }

    #[test]
    fn preserves_unicode_names() {
        assert_eq!(greet("你好").message, "Hello, 你好! (from app-core)");
    }
}
