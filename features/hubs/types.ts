/**
 * Hub shape returned by the NestJS backend.
 * Matches /Users/johnphilip/Desktop/watch-nestjs/src/hubs/entities/hub.entity.ts
 */
export interface Hub {
  id: string;
  name: string;
  year: number | null;
  type: "movie" | "series";
  genres: string | null;
  director: string | null;
  iconUrl: string | null;
  backdropUrl: string | null;
  description: string | null;
  followersCount: number;
  postsCount: number;
  trendingScore: number;
  tmdbId: number | null;
  trailerKey: string | null;
  createdAt: string;
  /** Only present on /hubs/:id (not list endpoints). */
  followedByMe?: boolean;
}

export interface HubListResponse {
  hubs: Hub[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface FollowedHubsResponse {
  hubs: Hub[];
}

export interface SearchHubsResponse {
  hubs: Hub[];
}
