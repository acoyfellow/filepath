#!/usr/bin/env node
/**
 * Cleanup script to list and delete stale container applications
 * Run this before deploying if you get DURABLE_OBJECT_ALREADY_HAS_APPLICATION errors
 * 
 * Usage: 
 *   List: CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx node scripts/cleanup-container.js
 *   Delete: CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx node scripts/cleanup-container.js <application-id>
 */

const APPLICATION_ID = process.argv[2];
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!API_TOKEN || !ACCOUNT_ID) {
  console.error("Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set");
  process.exit(1);
}

async function listContainerApplications() {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/containers/applications`,
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.ok) {
    const data = await response.json();
    console.log("Container Applications:");
    data.result?.forEach((app) => {
      console.log(`  - ${app.name} (${app.id})`);
      if (app.name?.includes("sandbox") || app.name?.includes("filepath")) {
        console.log(`    ⚠️  This might be the stale one!`);
      }
    });
    return data.result;
  } else {
    const error = await response.json();
    console.error(`❌ Failed to list:`, error);
    process.exit(1);
  }
}

async function deleteContainerApplication(id) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/containers/applications/${id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.ok) {
    console.log(`✅ Successfully deleted container application ${id}`);
  } else {
    const error = await response.json();
    console.error(`❌ Failed to delete:`, error);
    process.exit(1);
  }
}

if (APPLICATION_ID) {
  deleteContainerApplication(APPLICATION_ID).catch(console.error);
} else {
  listContainerApplications().catch(console.error);
}

