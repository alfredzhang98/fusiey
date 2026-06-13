-- Add the OFFICIAL value to PatternSource in its own migration (Postgres
-- requires ALTER TYPE ... ADD VALUE to be isolated from statements that use it).
ALTER TYPE "PatternSource" ADD VALUE 'OFFICIAL';
