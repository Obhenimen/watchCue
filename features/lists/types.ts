/**
 * Shapes returned by /lists and /lists/:id/items on the NestJS backend.
 * Matches watch-nestjs/src/lists/entities.
 */

export type ListType = "watchlist" | "watched" | "favorites" | "custom";

export interface UserList {
  id: string;
  userId: string;
  listType: ListType;
  name: string;
  emoji: string | null;
  description: string | null;
  isDefault: boolean;
  isPublic: boolean;
  itemsCount: number;
  createdAt: string;
}

export interface UserListsResponse {
  defaults: UserList[];
  custom: UserList[];
}

export interface ListItem {
  listId: string;
  hubId: string;
  status: "watching" | "watch_next" | null;
  addedAt: string;
  hub: {
    id: string;
    name: string;
    year: number | null;
    iconUrl: string | null;
    backdropUrl: string | null;
  };
}

export interface ListItemsResponse {
  items: ListItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
}
