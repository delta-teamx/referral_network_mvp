-- Enable pg_trgm for fuzzy text search on Listing name/description.
-- Used by PostgresSearchService in domains/search/.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- GIN indexes speed up ILIKE / similarity() queries on the columns we
-- actually search on the directory + life-events matching flows.
CREATE INDEX IF NOT EXISTS "Listing_name_trgm_idx"        ON "Listing" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Listing_description_trgm_idx" ON "Listing" USING GIN ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Category_name_trgm_idx"       ON "Category" USING GIN ("name" gin_trgm_ops);
