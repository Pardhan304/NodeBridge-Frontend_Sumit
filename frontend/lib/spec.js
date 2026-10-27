import { keccak256, toBytes } from "viem";

function clean(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

/** Canonical spec. Must match verifier/src/main.rs and contracts/scripts/seed-demo.js. */
export function canonicalSpec({ title, task, expected }) {
  return `${clean(title)}\n${clean(task)}\n${clean(expected)}`;
}

export function hashSpec(spec) {
  return keccak256(toBytes(canonicalSpec(spec)));
}

export function cleanSpec(spec) {
  return {
    title: clean(spec.title),
    task: clean(spec.task),
    expected: clean(spec.expected),
  };
}
