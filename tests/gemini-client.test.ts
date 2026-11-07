import test, { describe, it } from "node:test";
import assert from "node:assert";
import { callGemini } from "../src/lib/ai/gemini-analysis";

describe("Gemini Client & Retry Logic (/lib/ai/gemini-analysis)", () => {
  it("uses key query parameter and retries on 429 up to 3 times", async () => {
    const originalFetch = global.fetch;
    const originalApiKey = process.env.GEMINI_API_KEY;
    const originalModel = process.env.GEMINI_MODEL;

    process.env.GEMINI_API_KEY = "test-secret-key-12345";
    process.env.GEMINI_MODEL = "gemini-3.8-flash";

    const fetchUrls: string[] = [];

    // Mock fetch returning 429
    global.fetch = async (url: string | URL | Request) => {
      fetchUrls.push(String(url));
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => JSON.stringify({ error: { message: "Resource exhausted" } }),
      } as unknown as Response;
    };

    try {
      const res = await callGemini({
        userPrompt: "Hello",
        temperature: 0.1,
      });

      // Assert key was in query parameter
      assert.ok(fetchUrls.length > 0, "Fetch should be called");
      assert.ok(fetchUrls[0].includes("key=test-secret-key-12345"), "URL should contain key parameter");
      assert.ok(fetchUrls[0].includes("/models/gemini-3.8-flash:generateContent"), "URL should use model name");

      // Assert retried 3 times (1 initial + 3 retries = 4 attempts)
      assert.strictEqual(res.attempts, 4, "Should attempt 4 times total (initial + 3 retries)");
      assert.strictEqual(res.status, 429, "Status should be 429");
      assert.strictEqual(res.ok, false, "Result should not be ok");
      assert.strictEqual(
        res.error,
        "AI unavailable: Gemini overloaded [Model tried: gemini-3.8-flash], try Re-analyse in a minute",
        "Error message should indicate Gemini overloaded and model tried"
      );
    } finally {
      global.fetch = originalFetch;
      process.env.GEMINI_API_KEY = originalApiKey;
      process.env.GEMINI_MODEL = originalModel;
    }
  });

  it("attempts fallback model once if main model fails with 503", async () => {
    const originalFetch = global.fetch;
    const originalApiKey = process.env.GEMINI_API_KEY;
    const originalModel = process.env.GEMINI_MODEL;
    const originalFallback = process.env.GEMINI_FALLBACK_MODEL;

    process.env.GEMINI_API_KEY = "test-secret-key-12345";
    process.env.GEMINI_MODEL = "gemini-3.8-flash";
    process.env.GEMINI_FALLBACK_MODEL = "gemini-1.5-flash";

    const modelsCalled: string[] = [];

    global.fetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("gemini-3.8-flash")) {
        modelsCalled.push("gemini-3.8-flash");
        return {
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: async () => "Unavailable",
        } as unknown as Response;
      }
      if (urlStr.includes("gemini-1.5-flash")) {
        modelsCalled.push("gemini-1.5-flash");
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: "Fallback response OK" }],
                },
              },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: false, status: 500 } as unknown as Response;
    };

    try {
      const res = await callGemini({
        userPrompt: "Test fallback",
      });

      assert.strictEqual(res.ok, true, "Should succeed via fallback model");
      assert.strictEqual(res.fallbackUsed, true, "fallbackUsed should be true");
      assert.strictEqual(res.modelUsed, "gemini-1.5-flash", "modelUsed should be fallback model");
      assert.strictEqual(res.text, "Fallback response OK");
      assert.strictEqual(modelsCalled.filter((m) => m === "gemini-3.8-flash").length, 4, "Primary model tried 4 times");
      assert.strictEqual(modelsCalled.filter((m) => m === "gemini-1.5-flash").length, 1, "Fallback model tried once");
    } finally {
      global.fetch = originalFetch;
      process.env.GEMINI_API_KEY = originalApiKey;
      process.env.GEMINI_MODEL = originalModel;
      process.env.GEMINI_FALLBACK_MODEL = originalFallback;
    }
  });
});

