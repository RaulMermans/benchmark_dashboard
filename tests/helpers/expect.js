import assert from "node:assert/strict";

export function expect(received) {
  return {
    toBe(expected) {
      assert.equal(received, expected);
    },
    toBeCloseTo(expected, digits = 2) {
      const tolerance = 10 ** -digits;
      assert.ok(
        Math.abs(received - expected) < tolerance,
        `Expected ${received} to be close to ${expected}`,
      );
    },
    toBeGreaterThan(expected) {
      assert.ok(received > expected, `Expected ${received} to be greater than ${expected}`);
    },
    toBeNull() {
      assert.equal(received, null);
    },
    toContain(expected) {
      assert.ok(received.includes(expected), `Expected ${JSON.stringify(received)} to contain ${expected}`);
    },
    toHaveProperty(property) {
      assert.ok(Object.hasOwn(received, property), `Expected object to have property ${property}`);
    },
    toMatchObject(expected) {
      Object.entries(expected).forEach(([key, value]) => {
        assert.deepEqual(received?.[key], value, `Expected property ${key} to match`);
      });
    },
  };
}
