//! Result check for a NodeBridge job.
//!
//! The canonical spec is `title\ntask\nexpected`, hashed with keccak256.
//! That string must match `frontend/lib/spec.js` and `contracts/scripts/seed-demo.js`.
//! The process always prints one JSON object. Exit 0 means the JSON was produced.
//! `ok: false` is a rejected result, not a crash.

use serde::{Deserialize, Serialize};
use std::io::{self, Read};
use tiny_keccak::{Hasher, Keccak};

#[derive(Debug, Deserialize)]
struct Input {
    title: String,
    task: String,
    expected: String,
    delivered: String,
}

#[derive(Debug, Serialize, PartialEq)]
struct Output {
    ok: bool,
    #[serde(rename = "specHash")]
    spec_hash: String,
    #[serde(rename = "resultHash")]
    result_hash: String,
    reason: Option<String>,
}

fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    let mut out = [0u8; 32];
    hasher.update(data);
    hasher.finalize(&mut out);
    out
}

fn to_hex(bytes: &[u8; 32]) -> String {
    let mut encoded = String::with_capacity(66);
    encoded.push_str("0x");
    for byte in bytes {
        encoded.push_str(&format!("{byte:02x}"));
    }
    encoded
}

fn canonical_spec(title: &str, task: &str, expected: &str) -> String {
    format!("{title}\n{task}\n{expected}")
}

fn verify(input: &Input) -> Output {
    let spec = canonical_spec(&input.title, &input.task, &input.expected);
    let spec_hash = to_hex(&keccak256(spec.as_bytes()));
    let result_hash = to_hex(&keccak256(input.delivered.as_bytes()));
    let expected_hash = to_hex(&keccak256(input.expected.as_bytes()));

    let (ok, reason) = if input.title.is_empty() || input.task.is_empty() || input.expected.is_empty() {
        (false, Some("Job spec is incomplete".to_string()))
    } else if input.delivered.is_empty() {
        (false, Some("Delivered result is empty".to_string()))
    } else if result_hash != expected_hash {
        (
            false,
            Some("Result hash does not match the committed output".to_string()),
        )
    } else {
        (true, None)
    };

    Output {
        ok,
        spec_hash,
        result_hash,
        reason,
    }
}

fn main() {
    let mut raw = String::new();
    if io::stdin().read_to_string(&mut raw).is_err() {
        eprintln!("failed to read stdin");
        std::process::exit(2);
    }

    let input: Input = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(err) => {
            eprintln!("invalid input: {err}");
            std::process::exit(2);
        }
    };

    let output = verify(&input);
    println!("{}", serde_json::to_string(&output).expect("serialize output"));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Input {
        Input {
            title: "Image embedding".into(),
            task: "Embed a 224px image and return the first 8 floats.".into(),
            expected: "0.12,0.44,0.03,0.91,0.18,0.07,0.55,0.22".into(),
            delivered: "0.12,0.44,0.03,0.91,0.18,0.07,0.55,0.22".into(),
        }
    }

    #[test]
    fn accepts_the_committed_result() {
        let output = verify(&sample());
        let expected = to_hex(&keccak256(sample().expected.as_bytes()));
        assert!(output.ok);
        assert_eq!(output.spec_hash.len(), 66);
        assert!(output.spec_hash.starts_with("0x"));
        assert_eq!(output.result_hash, expected);
        assert!(output.reason.is_none());
    }

    #[test]
    fn rejects_a_different_result() {
        let mut input = sample();
        input.delivered = "18".into();
        let output = verify(&input);
        assert!(!output.ok);
        assert_eq!(
            output.reason.as_deref(),
            Some("Result hash does not match the committed output")
        );
    }

    #[test]
    fn spec_hash_changes_when_the_task_changes() {
        let left = verify(&sample());
        let mut input = sample();
        input.task = "Count tokens.".into();
        let right = verify(&input);
        assert_ne!(left.spec_hash, right.spec_hash);
    }
}
