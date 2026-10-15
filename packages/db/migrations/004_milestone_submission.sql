ALTER TABLE milestones
ADD COLUMN submission_note TEXT;

ALTER TABLE milestones
ADD COLUMN submission_url TEXT;

ALTER TABLE milestones
ADD COLUMN submitted_at TIMESTAMPTZ;