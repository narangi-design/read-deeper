import { Redis } from "@upstash/redis";

// Reads KV_REST_API_URL / KV_REST_API_TOKEN set by the Vercel Upstash integration
export const redis = Redis.fromEnv();
