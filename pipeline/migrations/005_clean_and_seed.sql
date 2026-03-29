-- Step 1: Delete all article_contexts (child rows first to respect FK)
DELETE FROM article_contexts;

-- Step 2: Delete all video_jobs and video_scripts if they exist
DELETE FROM video_jobs WHERE true;
DELETE FROM video_scripts WHERE true;

-- Step 3: Delete all story_arcs
DELETE FROM story_arcs;

-- Step 4: Delete all articles
DELETE FROM articles;

-- Verify tables are empty
SELECT 'articles' as table_name, COUNT(*) as remaining FROM articles
UNION ALL
SELECT 'article_contexts', COUNT(*) FROM article_contexts
UNION ALL
SELECT 'story_arcs', COUNT(*) FROM story_arcs;
