-- Record the raw model output alongside the 0-100 score so the admin
-- console can show "the model said X% flood probability" next to the
-- blended, UI-scaled score.

BEGIN;

ALTER TABLE risk_scores ADD COLUMN ml_probability REAL;

COMMIT;
