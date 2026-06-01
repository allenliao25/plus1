import test from "node:test";
import assert from "node:assert/strict";
import { publicProfileSelect } from "@/lib/questService";

test("public event profile hydration does not select private contact fields", () => {
  const selectedFields = publicProfileSelect
    .split(",")
    .map((field) => field.trim());

  assert.equal(selectedFields.includes("email"), false);
  assert.equal(selectedFields.includes("phone"), false);
  assert.equal(selectedFields.includes("area"), true);
});
