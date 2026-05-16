import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decrypt, encrypt } from "@/lib/truelayer/crypto";

const TEST_KEY = "a".repeat(64); // 32 bytes of hex

describe("token encryption", () => {
  beforeAll(() => {
    process.env.OB_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    delete process.env.OB_TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a value through encrypt/decrypt", () => {
    const secret = "truelayer-access-token-xyz";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects a tampered ciphertext", () => {
    const payload = encrypt("sensitive");
    const [iv, tag, cipher] = payload.split(":");
    const tampered = [iv, tag, `${cipher.slice(0, -2)}ff`].join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow();
  });
});
