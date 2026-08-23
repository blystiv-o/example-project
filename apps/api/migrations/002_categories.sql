CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  name_normalized varchar(80) NOT NULL,
  type varchar(50) NOT NULL,
  monthly_budget_minor bigint NOT NULL CHECK (monthly_budget_minor BETWEEN 1 AND 99999999999),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_name_normalized_active_key
  ON categories (user_id, name_normalized)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS categories_user_id_created_at_active_idx
  ON categories (user_id, created_at DESC, id DESC)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS categories_set_updated_at ON categories;
CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title varchar(160) NOT NULL DEFAULT '',
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 99999999999),
  expense_date date NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_user_id_category_id_expense_date_idx
  ON expenses (user_id, category_id, expense_date);

DROP TRIGGER IF EXISTS expenses_set_updated_at ON expenses;
CREATE TRIGGER expenses_set_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
