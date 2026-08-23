ALTER TABLE expenses RENAME COLUMN archived_at TO deleted_at;

ALTER TABLE expenses
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ALTER COLUMN title TYPE varchar(120),
  ALTER COLUMN title DROP DEFAULT;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_title_length_check CHECK (char_length(title) BETWEEN 1 AND 120);

DROP INDEX IF EXISTS expenses_user_id_category_id_expense_date_idx;

CREATE INDEX expenses_user_id_expense_date_active_idx
  ON expenses (user_id, expense_date DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX expenses_user_id_category_id_expense_date_active_idx
  ON expenses (user_id, category_id, expense_date DESC)
  WHERE deleted_at IS NULL;
