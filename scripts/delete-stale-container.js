#!/usr/bin/env node
/**
 * Delete the specific stale container application that's causing deployment failures
 * This is a workaround for Alchemy's adoption logic bug
 */

const API_TOKEN = process.env.CLOUDFLARE_API_KEY;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const APPLICATION_ID = "a035964a-93f5-4d4f-88ef-2695c5cdf28b";

if (!API_TOKEN || !ACCOUNT_ID) {
  console.log("⚠️  Missing credentials, skipping cleanup");
  process.exit(0);
}

// Cloudflare API uses API Key + Email, not just token
const API_EMAIL = process.env.CLOUDFLARE_EMAIL;

async function deleteStaleApplication() {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/containers/applications/${APPLICATION_ID}`,
      {
        method: "DELETE",
        headers: {
          "X-Auth-Email": API_EMAIL || "",
          "X-Auth-Key": API_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      console.log(`✅ Deleted stale container application ${APPLICATION_ID}`);
    } else if (response.status === 404) {
      console.log(`ℹ️  Container application ${APPLICATION_ID} not found (already deleted)`);
    } else {
      const error = await response.json().catch(() => ({ errors: [{ message: "Unknown error" }] }));
      console.log(`⚠️  Failed to delete (might not exist):`, error.errors?.[0]?.message || "Unknown");
      // Don't fail the build if deletion fails
    }
  } catch (error) {
    console.log(`⚠️  Error during cleanup:`, error.message);
    // Don't fail the build
  }
}

deleteStaleApplication();

