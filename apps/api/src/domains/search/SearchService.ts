/**
 * `SearchService` — the contract every search-capable backend implements.
 *
 * Branch 3 ships a Postgres `pg_trgm` implementation as the default (good
 * enough for MVP traffic, zero infra burden). Higher-traffic deployments
 * can drop in an Elasticsearch implementation by satisfying this same
 * interface — callers in `domains/directory/listings/` and
 * `domains/matching/connector/` never change.
 *
 * The interface is intentionally narrow: one method to query, one to
 * upsert, one to delete. Ranking is NOT a concern of the search layer —
 * results come back in backend-native relevance order and the
 * `RankingStrategy` (see `domains/matching/ranking/`) re-scores for
 * business logic (trust weight, distance weight, conversion weight).
 */

export interface SearchQuery {
  /** Free-text query. Empty string means "no text filter". */
  q?: string;
  /** Restrict to these category IDs (OR). */
  categoryIds?: string[];
  /** Geographic filter centred on this point with a mile radius. */
  near?: { latitude: number; longitude: number; radiusMiles: number };
  /** Minimum average rating (0–5). */
  minRating?: number;
  /** Only return verified listings if true. */
  verifiedOnly?: boolean;
  /** Free-text filter on ListingTag.tag values. */
  tags?: string[];
  /** Pagination — 0-based. */
  page?: number;
  limit?: number;
}

export interface SearchHit {
  listingId: string;
  /** Backend-native relevance score, NOT the final rank. */
  score: number;
  /** Populated when the query included a `near` filter. */
  distanceMiles?: number;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
}

export interface IndexDocument {
  listingId: string;
  name: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  categoryName: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  avgRating: number;
  trustScore: number;
  reviewCount: number;
  isVerified: boolean;
  isFeatured: boolean;
  tags: string[];
  status: string;
  updatedAt: Date;
}

export interface SearchService {
  /** Execute a search query. */
  query(q: SearchQuery): Promise<SearchResult>;

  /** Upsert (create-or-replace) one listing's searchable document. */
  upsert(doc: IndexDocument): Promise<void>;

  /** Remove a listing from the index. */
  remove(listingId: string): Promise<void>;

  /** Drop + rebuild the entire index. Admin/ops tool. */
  reindexAll(docs: AsyncIterable<IndexDocument>): Promise<void>;
}
