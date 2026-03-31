#!/usr/bin/env node

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const requiredVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
  "MISTRAL_API_KEY",
  "SARVAM_API_KEY",
  "NEXT_PUBLIC_VIDEO_STUDIO_API_BASE",
];

const optionalVars = [];

const missingRequired = requiredVars.filter((name) => !process.env[name]);

if (missingRequired.length > 0) {
  console.error("\n[env-check] Missing required environment variables:\n");
  for (const name of missingRequired) {
    console.error(`- ${name}`);
  }
  console.error("\n[env-check] Build/start aborted. Set the missing variables and retry.\n");
  process.exit(1);
}

const missingOptional = optionalVars.filter(({ name }) => !process.env[name]);

if (missingOptional.length > 0) {
  console.warn("\n[env-check] Optional environment variables not set:\n");
  for (const item of missingOptional) {
    console.warn(`- ${item.name}: ${item.reason}`);
  }
  console.warn("");
}

console.log("[env-check] Required environment variables are configured.");
