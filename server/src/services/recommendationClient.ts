import { env } from "../config/env";
import { logger } from "../config/logger";

export interface RecommendationItem {
  propertyId: string;
  score: number;
  reasons: string[];
}

export interface RecommendationResponse {
  source: "personalized" | "popular";
  items: RecommendationItem[];
}

export interface PreferenceRow {
  featureType: string;
  featureValue: string;
  score: number;
}

async function call<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${env.RECOMMENDATION_SERVICE_URL}${path}`, {
      headers: { "x-internal-token": env.INTERNAL_API_TOKEN },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ err: (err as Error).message, path }, "recommendation-service unavailable");
    return null;
  }
}

export const fetchRecommendations = (userId: string, limit: number) =>
  call<RecommendationResponse>(`/v1/recommendations/${encodeURIComponent(userId)}?limit=${limit}`);

export const fetchPreferences = (userId: string, limit = 25) =>
  call<{ preferences: PreferenceRow[] }>(`/v1/preferences/${encodeURIComponent(userId)}?limit=${limit}`);
