-- Fix: evaluation_records view was producing duplicate rows
-- due to LEFT JOIN on votes creating a cartesian product
-- (each response row × each vote on that prompt).
-- Solution: DROP and recreate with GROUP BY to aggregate votes per response.
-- (CREATE OR REPLACE cannot rename columns in PostgreSQL, so DROP is required.)

DROP VIEW IF EXISTS evaluation_records;

CREATE VIEW evaluation_records AS
SELECT
    p.id AS prompt_id,
    p.text AS prompt_text,
    p.created_at AS prompt_created_at,
    r.id AS response_id,
    r.model,
    r.response_text,
    r.truth_score,
    r.failure_type,
    r.stability_score,
    r.run_number,
    COUNT(v.id) AS total_votes,
    COUNT(v.id) FILTER (WHERE v.winner_model = r.model) AS votes_won,
    CASE WHEN COUNT(v.id) = 0 THEN false
         ELSE COUNT(v.id) FILTER (WHERE v.winner_model = r.model) > 0
    END AS won_vote
FROM prompts p
JOIN responses r ON r.prompt_id = p.id
LEFT JOIN votes v ON v.prompt_id = p.id
WHERE r.run_number IS NULL
GROUP BY p.id, p.text, p.created_at, r.id, r.model, r.response_text,
         r.truth_score, r.failure_type, r.stability_score, r.run_number
ORDER BY p.created_at DESC, r.model;

GRANT SELECT ON evaluation_records TO anon;
