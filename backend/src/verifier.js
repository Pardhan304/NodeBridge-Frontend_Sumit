const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function verifierBin() {
  if (process.env.VERIFIER_BIN) return process.env.VERIFIER_BIN;

  const name = process.platform === "win32" ? "nodebridge-verifier.exe" : "nodebridge-verifier";
  const root = path.join(__dirname, "..", "..", "verifier", "target");
  const release = path.join(root, "release", name);
  const debug = path.join(root, "debug", name);
  if (fs.existsSync(release)) return release;
  if (fs.existsSync(debug)) return debug;
  return release;
}

function runVerifier(payload) {
  const bin = verifierBin();
  if (!fs.existsSync(bin)) {
    return Promise.reject(
      new Error(
        `Rust verifier not found at ${bin}. From the repo root run: cargo build --release --manifest-path verifier/Cargo.toml`
      )
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(bin, [], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Verifier timed out"));
    }, 5000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Verifier exited ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Verifier returned invalid JSON: ${stdout}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

module.exports = { runVerifier };
