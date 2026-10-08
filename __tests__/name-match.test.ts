/**
 * MUDRA 2026 — Team Lookup fuzzy name matching
 * =============================================
 * Self-contained test file using Node's built-in assert module.
 * Run with:  npx tsx __tests__/name-match.test.ts
 *
 * Uses a synthetic in-memory cohort only — no Google Sheets calls.
 */

import assert from "node:assert/strict";
import { matchByName, normalizeName, MAX_CANDIDATES } from "../lib/server/services/name-match";

interface Row { name: string; team: string }

const COHORT: Row[] = [
  { name: "ADITHYAN S.", team: "T1" },
  { name: "ADITHYAN P.", team: "T2" },
  { name: "MEERA KRISHNAN", team: "T3" },
  { name: "RAHUL R", team: "T4" },
  { name: "ANANYA  MARIA JOSEPH", team: "T1" },
  { name: "OM", team: "T2" },
  { name: "അനന്തു കെ", team: "T3" },
  { name: "SREELAKSHMI V. NAIR", team: "T4" },
];

const run = (q: string, rows: Row[] = COHORT) => matchByName(q, rows, (r) => r.name);

function direct(q: string, expected: string, rows: Row[] = COHORT) {
  const out = run(q, rows);
  assert.equal(out.kind, "direct", `"${q}" should match directly, got ${out.kind}`);
  if (out.kind === "direct") assert.equal(out.item.name, expected, `"${q}"`);
}

function candidates(q: string, expected: string[], rows: Row[] = COHORT) {
  const out = run(q, rows);
  assert.equal(out.kind, "candidates", `"${q}" should give candidates, got ${out.kind}`);
  if (out.kind === "candidates") {
    assert.deepEqual(out.items.map((r) => r.name).sort(), [...expected].sort(), `"${q}"`);
  }
}

function none(q: string, rows: Row[] = COHORT) {
  assert.equal(run(q, rows).kind, "none", `"${q}" should not match`);
}

let passed = 0;
function test(label: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}

console.log("name-match");

test("normalisation ignores case, dots, spacing", () => {
  const forms = ["ADITHYAN S.", "adithyan s", "Adithyan  S.", " ADITHYAN S "];
  const compact = new Set(forms.map((f) => normalizeName(f).compact));
  assert.equal(compact.size, 1);
});

test("exact registered name", () => direct("MEERA KRISHNAN", "MEERA KRISHNAN"));
test("different capitalisation", () => direct("meera krishnan", "MEERA KRISHNAN"));
test("missing '.' from an initial", () => direct("Adithyan S", "ADITHYAN S."));
test("added '.' to an initial", () => direct("Rahul R.", "RAHUL R"));
test("extra spaces", () => direct("  meera    krishnan ", "MEERA KRISHNAN"));
test("missing spaces", () => direct("meerakrishnan", "MEERA KRISHNAN"));
test("multiple internal spaces in register", () => direct("ananya maria joseph", "ANANYA  MARIA JOSEPH"));
test("minor typo", () => direct("meera krishan", "MEERA KRISHNAN"));
test("transposed letters", () => direct("meera krihsnan", "MEERA KRISHNAN"));
test("initials with dots in the middle", () => direct("sreelakshmi v nair", "SREELAKSHMI V. NAIR"));
test("partial first name, unique", () => direct("sreelakshmi", "SREELAKSHMI V. NAIR"));
test("partial full name", () => direct("ananya maria", "ANANYA  MARIA JOSEPH"));
test("same first name → candidates", () => candidates("adithyan", ["ADITHYAN S.", "ADITHYAN P."]));

test("highly similar names → candidates, not a silent pick", () => {
  candidates("adithyan sree", ["ADITHYAN SREEKUMAR", "ADITHYAN SREERAJ"], [
    { name: "ADITHYAN SREEKUMAR", team: "T1" },
    { name: "ADITHYAN SREERAJ", team: "T2" },
    { name: "MEERA KRISHNAN", team: "T3" },
  ]);
});

test("two names identical after normalisation → candidates", () => {
  candidates("adithyan s", ["ADITHYAN S.", "Adithyan S"], [
    { name: "ADITHYAN S.", team: "T1" },
    { name: "Adithyan S", team: "T2" },
  ]);
});

test("exact match outranks a close fuzzy one", () => {
  direct("rahul r", "RAHUL R", [...COHORT, { name: "RAHUL RAJ", team: "T1" }]);
});

test("no matching student", () => none("zacharias thomas"));
test("unrelated closest name is never returned", () => none("rohit"));
test("very short query only matches exactly", () => {
  none("me");
  none("a");
  direct("om", "OM");
});
test("empty / punctuation-only query", () => {
  none("");
  none(" . ");
});
test("Malayalam names", () => {
  direct("അനന്തു കെ", "അനന്തു കെ");
  direct("അനന്തു", "അനന്തു കെ");
});

test("candidate list is capped", () => {
  const many: Row[] = Array.from({ length: 12 }, (_, i) => ({
    name: `ARJUN ${String.fromCharCode(65 + i)}`,
    team: "T1",
  }));
  const out = run("arjun", many);
  assert.equal(out.kind, "candidates");
  if (out.kind === "candidates") {
    assert.equal(out.items.length, MAX_CANDIDATES);
    assert.equal(out.more, true);
  }
});

console.log(`\n${passed} passed`);
