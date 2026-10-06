-- P4: skill suggestions queue — candidate-submitted names missing from the
-- catalogue, curated manually. Nothing writes to `skills` automatically.

CREATE TABLE skill_suggestions (
    id           UUID         PRIMARY KEY,
    candidate_id UUID         NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    created_at   TIMESTAMP    NOT NULL
);

-- A candidate can only suggest a given name once, case-insensitively.
CREATE UNIQUE INDEX uq_skill_suggestions_candidate_name
    ON skill_suggestions (candidate_id, lower(name));
