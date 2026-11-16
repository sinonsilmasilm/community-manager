import { test } from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import { verifyDiscordRequest } from "../src/lib/discord-verify.js";
test("accepts a correctly signed request", () => {
    const keyPair = nacl.sign.keyPair();
    const publicKeyHex = Buffer.from(keyPair.publicKey).toString("hex");
    const timestamp = "1700000000";
    const body = JSON.stringify({ type: 1 });
    const signature = nacl.sign.detached(Buffer.from(timestamp + body), keyPair.secretKey);
    const signatureHex = Buffer.from(signature).toString("hex");
    assert.equal(verifyDiscordRequest(publicKeyHex, signatureHex, timestamp, body), true);
});
test("rejects a tampered body", () => {
    const keyPair = nacl.sign.keyPair();
    const publicKeyHex = Buffer.from(keyPair.publicKey).toString("hex");
    const timestamp = "1700000000";
    const body = JSON.stringify({ type: 1 });
    const signature = nacl.sign.detached(Buffer.from(timestamp + body), keyPair.secretKey);
    const signatureHex = Buffer.from(signature).toString("hex");
    assert.equal(verifyDiscordRequest(publicKeyHex, signatureHex, timestamp, JSON.stringify({ type: 2 })), false);
});
test("rejects missing signature/timestamp", () => {
    assert.equal(verifyDiscordRequest("aa".repeat(32), undefined, undefined, "{}"), false);
});
