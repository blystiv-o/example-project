var React = window.React;
var ReactDOM = window.ReactDOM;
var M = window.MaterialUI;

var SCREEN = document.body.dataset.screen || "dashboard";

var NAV_ITEMS = [
  { id: "dashboard", label: "Огляд", href: "dashboard.html", icon: "dashboard" },
  { id: "expenses", label: "Витрати", href: "expenses.html", icon: "receipt" },
  { id: "categories", label: "Категорії", href: "categories.html", icon: "category" },
  { id: "auth", label: "Профіль", href: "auth.html", icon: "person" }
];

var INITIAL_CATEGORIES = [
  { id: "food", name: "Їжа", type: "Обов'язкові", budget: 12500, spent: 8240, color: "primary" },
  { id: "transport", name: "Транспорт", type: "Щоденні", budget: 3200, spent: 2120, color: "secondary" },
  { id: "home", name: "Дім", type: "Побут", budget: 7200, spent: 4860, color: "neutral" },
  { id: "health", name: "Здоров'я", type: "Планові", budget: 3600, spent: 980, color: "success" }
];

var INITIAL_EXPENSES = [
  { id: 1, title: "Сільпо", category: "Їжа", amount: 1260, date: "2026-08-01", account: "Monobank" },
  { id: 2, title: "Метро", category: "Транспорт", amount: 42, date: "2026-08-01", account: "Готівка" },
  { id: 3, title: "Комунальні", category: "Дім", amount: 3180, date: "2026-07-30", account: "ПриватБанк" },
  { id: 4, title: "Аптека", category: "Здоров'я", amount: 430, date: "2026-07-29", account: "Monobank" },
  { id: 5, title: "Кава з командою", category: "Їжа", amount: 380, date: "2026-07-28", account: "Monobank" }
];

function iconPath(name) {
  var paths = {
    wallet: ["M4 7.5h16v10H4z", "M16 11h4v3h-4z", "M7 7.5V5h10v2.5"],
    dashboard: ["M4 5h7v7H4z", "M13 5h7v4h-7z", "M13 11h7v8h-7z", "M4 14h7v5H4z"],
    receipt: ["M6 3h12v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21z", "M9 8h6", "M9 12h6", "M9 16h4"],
    category: ["M5 5h6v6H5z", "M13 5h6v6h-6z", "M5 13h6v6H5z", "M13 13h6v6h-6z"],
    person: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20a8 8 0 0 1 16 0"],
    plus: ["M12 5v14", "M5 12h14"],
    edit: ["M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5z", "M13.5 7 17 10.5"],
    trash: ["M5 7h14", "M9 7V5h6v2", "M8 10v9", "M16 10v9", "M10 10v9", "M14 10v9"],
    filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
    arrow: ["M5 12h14", "M13 6l6 6-6 6"]
  };
  return paths[name] || paths.wallet;
}

function Icon(props) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {iconPath(props.name).map(function (d, index) { return <path key={index} d={d} />; })}
    </svg>
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 0 }).format(value);
}

function makeTheme() {
  return M.createTheme({
    typography: {
      fontFamily: '"Roboto Flex", "Roboto", system-ui, sans-serif',
      button: { textTransform: "none", fontWeight: 600, letterSpacing: "0.02em" }
    },
    shape: { borderRadius: 18 },
    palette: {
      mode: "light",
      primary: { main: "rgb(0, 106, 67)", contrastText: "rgb(252, 255, 251)" },
      secondary: { main: "rgb(72, 95, 86)" },
      error: { main: "rgb(170, 55, 42)" },
      warning: { main: "rgb(150, 103, 0)" },
      success: { main: "rgb(0, 114, 74)" },
      background: { default: "rgb(247, 250, 246)", paper: "rgb(253, 254, 252)" },
      text: { primary: "rgb(38, 54, 46)", secondary: "rgb(101, 119, 109)" }
    },
    components: {
      MuiButton: { styleOverrides: { root: { minHeight: 44, borderRadius: 22, boxShadow: "none" } } },
      MuiTextField: { defaultProps: { size: "medium" } },
      MuiChip: { styleOverrides: { root: { borderRadius: 14, fontWeight: 600 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 28 } } }
    }
  });
}

function Brand() {
  return (
    <div className="brand-lockup" data-od-id="brand-lockup">
      <div className="brand-mark"><Icon name="wallet" /></div>
      <div>
        <p className="brand-name">Облік витрат</p>
        <div className="brand-subtitle">Домашні фінанси</div>
      </div>
    </div>
  );
}

function Navigation() {
  return (
    <>
      <aside className="side-nav" data-od-id="side-navigation">
        <Brand />
        <nav aria-label="Основна навігація">
          <ul className="nav-list">
            {NAV_ITEMS.map(function (item) {
              return (
                <li key={item.id}>
                  <a className={"nav-link " + (SCREEN === item.id ? "is-active" : "")} href={item.href} data-od-id={"nav-" + item.id}>
                    <Icon name={item.icon} /><span>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="profile-pill" data-od-id="profile-summary">
          <div className="avatar">ВК</div>
          <div>
            <p className="row-title">Володимир</p>
            <p className="row-sub">Особистий простір</p>
          </div>
        </div>
      </aside>
      <nav className="mobile-nav" aria-label="Мобільна навігація" data-od-id="mobile-navigation">
        {NAV_ITEMS.map(function (item) {
          return (
            <a key={item.id} className={SCREEN === item.id ? "is-active" : ""} href={item.href} data-od-id={"mobile-nav-" + item.id}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
}

function AppShell(props) {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="page" data-od-id={props.id}>
        {props.children}
      </main>
    </div>
  );
}

function PageHeader(props) {
  return (
    <header className="topbar" data-od-id={props.id || "page-header"}>
      <div className="title-group">
        <div className="eyebrow">{props.eyebrow}</div>
        <h1 className="page-title" data-od-id={props.titleId}>{props.title}</h1>
        <p className="page-copy">{props.copy}</p>
      </div>
      <div className="toolbar">{props.actions}</div>
    </header>
  );
}

function StatCard(props) {
  return (
    <article className="stat-card" data-od-id={props.odId}>
      <p className="stat-label">{props.label}</p>
      <p className="stat-value">{props.value}</p>
      <p className="stat-note">{props.note}</p>
    </article>
  );
}

function ExpenseRow(props) {
  return (
    <div className="list-row" data-od-id={"expense-row-" + props.expense.id}>
      <div className="row-icon"><Icon name="receipt" /></div>
      <div>
        <p className="row-title">{props.expense.title}</p>
        <p className="row-sub">{props.expense.category} · {props.expense.date}</p>
      </div>
      <div className="money negative">-{formatMoney(props.expense.amount)}</div>
    </div>
  );
}

function CategoryRow(props) {
  var percent = Math.min(100, Math.round((props.category.spent / props.category.budget) * 100));
  return (
    <article className="category-row" data-od-id={"category-card-" + props.category.id}>
      <div className="row-icon"><Icon name="category" /></div>
      <div>
        <p className="row-title">{props.category.name}</p>
        <p className="row-sub">{props.category.type} · {percent}% бюджету</p>
        <div className="budget-meter" aria-label={"Використано " + percent + " відсотків бюджету"}>
          <div className="meter-track"><div className="meter-fill" style={{ width: percent + "%" }} /></div>
        </div>
      </div>
      <div className="money">{formatMoney(props.category.budget)}</div>
    </article>
  );
}

function DashboardPage() {
  var totalSpent = INITIAL_EXPENSES.reduce(function (sum, item) { return sum + item.amount; }, 0);
  var budget = INITIAL_CATEGORIES.reduce(function (sum, item) { return sum + item.budget; }, 0);
  var bars = [34, 48, 41, 70, 54, 82, 64];
  var labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  return (
    <AppShell id="dashboard-screen">
      <PageHeader
        eyebrow="Серпень · демо дані"
        title="Місяць під контролем"
        titleId="dashboard-heading"
        copy="Перший екран показує витрати, доступний бюджет і категорії, які потребують уваги."
        actions={<M.Button href="expenses.html" variant="contained" startIcon={<Icon name="plus" />} data-od-id="dashboard-add-expense">Додати витрату</M.Button>}
      />
      <section className="workspace dashboard" data-od-id="dashboard-workspace">
        <div className="workspace">
          <div className="stat-grid" data-od-id="dashboard-stats">
            <StatCard odId="stat-spent" label="Витрачено" value={formatMoney(totalSpent)} note="За поточний місяць" />
            <StatCard odId="stat-budget" label="Бюджет" value={formatMoney(budget)} note="За всіма активними категоріями" />
            <StatCard odId="stat-left" label="Залишок" value={formatMoney(budget - totalSpent)} note="Оновлюється після кожного запису" />
          </div>
          <section className="panel" data-od-id="weekly-chart-panel">
            <div className="panel-header">
              <h2 className="panel-title">Ритм тижня</h2>
              <M.Chip label="Витрати" variant="outlined" size="small" />
            </div>
            <div className="chart" role="img" aria-label="Стовпчикова діаграма витрат за тиждень">
              {bars.map(function (height, index) {
                return (
                  <div className="bar-wrap" key={labels[index]}>
                    <div className="bar" style={{ height: height + "%" }} />
                    <div className="bar-label">{labels[index]}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="workspace" data-od-id="dashboard-side-panel">
          <section className="panel" data-od-id="recent-expenses-panel">
            <div className="panel-header">
              <h2 className="panel-title">Останні витрати</h2>
              <M.Button href="expenses.html" size="small" endIcon={<Icon name="arrow" />}>Усі</M.Button>
            </div>
            <div className="list">{INITIAL_EXPENSES.slice(0, 4).map(function (expense) { return <ExpenseRow key={expense.id} expense={expense} />; })}</div>
          </section>
          <section className="panel" data-od-id="budget-focus-panel">
            <div className="panel-header">
              <h2 className="panel-title">Категорії</h2>
              <M.Button href="categories.html" size="small" endIcon={<Icon name="arrow" />}>Керувати</M.Button>
            </div>
            <div className="list">{INITIAL_CATEGORIES.slice(0, 3).map(function (category) { return <CategoryRow key={category.id} category={category} />; })}</div>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function AuthPage() {
  var [tab, setTab] = React.useState(0);
  var [email, setEmail] = React.useState("volodymyr@example.com");
  var [password, setPassword] = React.useState("");
  var [name, setName] = React.useState("Володимир");
  var [snack, setSnack] = React.useState("");
  var validEmail = email.indexOf("@") > 1;
  function submit() {
    if (!validEmail || password.length < 6) {
      setSnack("Перевір email і пароль від 6 символів.");
      return;
    }
    setSnack(tab === 0 ? "Вхід готовий для підключення API." : "Реєстрація готова для підключення API.");
  }
  return (
    <main className="auth-layout" data-od-id="auth-screen">
      <section className="auth-hero" data-od-id="auth-hero">
        <Brand />
        <h1 className="auth-title" data-od-id="auth-heading">Фінанси без шуму</h1>
        <p className="auth-copy">Легкий старт для пет-проєкту: обліковий запис, категорії бюджету та витрати з валідацією вводу.</p>
      </section>
      <section className="auth-card" data-od-id="auth-card">
        <M.Tabs value={tab} onChange={function (event, next) { setTab(next); }} variant="fullWidth" aria-label="Перемикач входу та реєстрації">
          <M.Tab label="Вхід" data-od-id="auth-login-tab" />
          <M.Tab label="Реєстрація" data-od-id="auth-register-tab" />
        </M.Tabs>
        <div className="form-grid" style={{ marginTop: 22 }}>
          {tab === 1 && <M.TextField label="Ім'я" value={name} onChange={function (event) { setName(event.target.value); }} data-od-id="auth-name-field" />}
          <M.TextField label="Email" type="email" value={email} error={!validEmail} helperText={!validEmail ? "Потрібен коректний email" : " "} onChange={function (event) { setEmail(event.target.value); }} data-od-id="auth-email-field" />
          <M.TextField label="Пароль" type="password" value={password} helperText="Мінімум 6 символів" onChange={function (event) { setPassword(event.target.value); }} data-od-id="auth-password-field" />
          <div className="form-actions">
            <M.Button href="dashboard.html" variant="text">До огляду</M.Button>
            <M.Button variant="contained" onClick={submit} data-od-id="auth-submit-button">{tab === 0 ? "Увійти" : "Створити акаунт"}</M.Button>
          </div>
        </div>
      </section>
      <M.Snackbar open={Boolean(snack)} autoHideDuration={3200} onClose={function () { setSnack(""); }} message={snack} />
    </main>
  );
}

function CategoryDialog(props) {
  var editing = Boolean(props.category);
  var [name, setName] = React.useState(editing ? props.category.name : "");
  var [type, setType] = React.useState(editing ? props.category.type : "Щоденні");
  var [budget, setBudget] = React.useState(editing ? props.category.budget : 2500);
  React.useEffect(function () {
    setName(editing ? props.category.name : "");
    setType(editing ? props.category.type : "Щоденні");
    setBudget(editing ? props.category.budget : 2500);
  }, [props.open, props.category]);
  function save() {
    if (!name.trim() || Number(budget) <= 0) return;
    props.onSave({ id: editing ? props.category.id : name.toLowerCase().replace(/\s+/g, "-"), name: name.trim(), type: type, budget: Number(budget), spent: editing ? props.category.spent : 0, color: "primary" });
  }
  return (
    <M.Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <M.DialogTitle>{editing ? "Редагувати категорію" : "Нова категорія"}</M.DialogTitle>
      <M.DialogContent>
        <div className="form-grid" style={{ paddingTop: 8 }}>
          <M.TextField label="Назва" value={name} onChange={function (event) { setName(event.target.value); }} data-od-id="category-name-field" />
          <M.TextField label="Тип" value={type} onChange={function (event) { setType(event.target.value); }} data-od-id="category-type-field" />
          <M.TextField label="Місячний бюджет" type="number" value={budget} onChange={function (event) { setBudget(event.target.value); }} data-od-id="category-budget-field" />
        </div>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={props.onClose}>Скасувати</M.Button>
        <M.Button variant="contained" onClick={save} data-od-id="category-save-button">Зберегти</M.Button>
      </M.DialogActions>
    </M.Dialog>
  );
}

function CategoriesPage() {
  var [categories, setCategories] = React.useState(INITIAL_CATEGORIES);
  var [open, setOpen] = React.useState(false);
  var [current, setCurrent] = React.useState(null);
  function saveCategory(next) {
    setCategories(function (items) {
      var exists = items.some(function (item) { return item.id === next.id; });
      return exists ? items.map(function (item) { return item.id === next.id ? next : item; }) : [next].concat(items);
    });
    setOpen(false);
    setCurrent(null);
  }
  function removeCategory(id) {
    setCategories(function (items) { return items.filter(function (item) { return item.id !== id; }); });
  }
  return (
    <AppShell id="categories-screen">
      <PageHeader
        eyebrow="CRUD категорій"
        title="Бюджети за призначенням"
        titleId="categories-heading"
        copy="Категорії мають тип, місячний бюджет і поточне використання, щоб витрати одразу лягали в потрібний контекст."
        actions={<M.Button variant="contained" startIcon={<Icon name="plus" />} onClick={function () { setCurrent(null); setOpen(true); }} data-od-id="add-category-button">Категорія</M.Button>}
      />
      <section className="workspace two-col" data-od-id="categories-workspace">
        <section className="panel" data-od-id="categories-list-panel">
          <div className="panel-header">
            <h2 className="panel-title">Список</h2>
            <M.Chip label={categories.length + " активні"} variant="outlined" />
          </div>
          <div className="list">
            {categories.map(function (category) {
              return (
                <article className="category-row" key={category.id} data-od-id={"category-row-" + category.id}>
                  <div className="row-icon"><Icon name="category" /></div>
                  <div>
                    <p className="row-title">{category.name}</p>
                    <p className="row-sub">{category.type} · витрачено {formatMoney(category.spent)}</p>
                    <div className="budget-meter"><div className="meter-track"><div className="meter-fill" style={{ width: Math.min(100, Math.round(category.spent / category.budget * 100)) + "%" }} /></div></div>
                  </div>
                  <div className="chip-row">
                    <M.IconButton aria-label={"Редагувати " + category.name} onClick={function () { setCurrent(category); setOpen(true); }} data-od-id={"edit-category-" + category.id}><Icon name="edit" /></M.IconButton>
                    <M.IconButton aria-label={"Видалити " + category.name} onClick={function () { removeCategory(category.id); }} data-od-id={"delete-category-" + category.id}><Icon name="trash" /></M.IconButton>
                  </div>
                </article>
              );
            })}
            {!categories.length && <div className="empty-state">Категорій ще немає.</div>}
          </div>
        </section>
        <aside className="panel" data-od-id="categories-detail-panel">
          <div className="panel-header">
            <h2 className="panel-title">Правила бюджету</h2>
          </div>
          <div className="list">
            <StatCard odId="category-budget-total" label="Загальний бюджет" value={formatMoney(categories.reduce(function (sum, item) { return sum + item.budget; }, 0))} note="Сума активних категорій" />
            <StatCard odId="category-spent-total" label="Використано" value={formatMoney(categories.reduce(function (sum, item) { return sum + item.spent; }, 0))} note="На основі записів витрат" />
          </div>
        </aside>
      </section>
      <CategoryDialog open={open} category={current} onClose={function () { setOpen(false); setCurrent(null); }} onSave={saveCategory} />
    </AppShell>
  );
}

function ExpenseDialog(props) {
  var editing = Boolean(props.expense);
  var [title, setTitle] = React.useState("");
  var [amount, setAmount] = React.useState(0);
  var [category, setCategory] = React.useState("Їжа");
  var [date, setDate] = React.useState("2026-08-01");
  React.useEffect(function () {
    setTitle(editing ? props.expense.title : "");
    setAmount(editing ? props.expense.amount : 0);
    setCategory(editing ? props.expense.category : "Їжа");
    setDate(editing ? props.expense.date : "2026-08-01");
  }, [props.open, props.expense]);
  function save() {
    if (!title.trim() || Number(amount) <= 0) return;
    props.onSave({ id: editing ? props.expense.id : Date.now(), title: title.trim(), amount: Number(amount), category: category, date: date, account: "Monobank" });
  }
  return (
    <M.Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <M.DialogTitle>{editing ? "Редагувати витрату" : "Нова витрата"}</M.DialogTitle>
      <M.DialogContent>
        <div className="form-grid" style={{ paddingTop: 8 }}>
          <M.TextField label="Назва" value={title} onChange={function (event) { setTitle(event.target.value); }} data-od-id="expense-title-field" />
          <M.TextField label="Сума" type="number" value={amount} onChange={function (event) { setAmount(event.target.value); }} data-od-id="expense-amount-field" />
          <M.TextField select label="Категорія" value={category} onChange={function (event) { setCategory(event.target.value); }} data-od-id="expense-category-field">
            {INITIAL_CATEGORIES.map(function (item) { return <M.MenuItem key={item.name} value={item.name}>{item.name}</M.MenuItem>; })}
          </M.TextField>
          <M.TextField label="Дата" type="date" value={date} onChange={function (event) { setDate(event.target.value); }} InputLabelProps={{ shrink: true }} data-od-id="expense-date-field" />
        </div>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={props.onClose}>Скасувати</M.Button>
        <M.Button variant="contained" onClick={save} data-od-id="expense-save-button">Зберегти</M.Button>
      </M.DialogActions>
    </M.Dialog>
  );
}

function ExpensesPage() {
  var [expenses, setExpenses] = React.useState(INITIAL_EXPENSES);
  var [query, setQuery] = React.useState("");
  var [category, setCategory] = React.useState("Усі");
  var [open, setOpen] = React.useState(false);
  var [current, setCurrent] = React.useState(null);
  var categories = ["Усі"].concat(INITIAL_CATEGORIES.map(function (item) { return item.name; }));
  var filtered = expenses.filter(function (expense) {
    var inQuery = expense.title.toLowerCase().indexOf(query.toLowerCase()) >= 0;
    var inCategory = category === "Усі" || expense.category === category;
    return inQuery && inCategory;
  });
  function saveExpense(next) {
    setExpenses(function (items) {
      var exists = items.some(function (item) { return item.id === next.id; });
      return exists ? items.map(function (item) { return item.id === next.id ? next : item; }) : [next].concat(items);
    });
    setOpen(false);
    setCurrent(null);
  }
  function removeExpense(id) {
    setExpenses(function (items) { return items.filter(function (item) { return item.id !== id; }); });
  }
  return (
    <AppShell id="expenses-screen">
      <PageHeader
        eyebrow="CRUD витрат"
        title="Записи без втрати контексту"
        titleId="expenses-heading"
        copy="Таблиця підтримує пошук, фільтр за категорією, створення, редагування і видалення записів."
        actions={<M.Button variant="contained" startIcon={<Icon name="plus" />} onClick={function () { setCurrent(null); setOpen(true); }} data-od-id="add-expense-button">Витрата</M.Button>}
      />
      <section className="workspace" data-od-id="expenses-workspace">
        <section className="panel" data-od-id="expenses-table-panel">
          <div className="filter-strip" data-od-id="expenses-filters">
            <M.TextField label="Пошук" value={query} onChange={function (event) { setQuery(event.target.value); }} data-od-id="expense-search-field" />
            <M.TextField select label="Категорія" value={category} onChange={function (event) { setCategory(event.target.value); }} data-od-id="expense-filter-category">
              {categories.map(function (item) { return <M.MenuItem key={item} value={item}>{item}</M.MenuItem>; })}
            </M.TextField>
            <M.Chip icon={<Icon name="filter" />} label={filtered.length + " записів"} variant="outlined" />
          </div>
          <div className="table-shell">
            <table className="native-table" data-od-id="expenses-table">
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Категорія</th>
                  <th>Дата</th>
                  <th>Рахунок</th>
                  <th>Сума</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(function (expense) {
                  return (
                    <tr key={expense.id} data-od-id={"expense-table-row-" + expense.id}>
                      <td>{expense.title}</td>
                      <td><M.Chip label={expense.category} size="small" /></td>
                      <td>{expense.date}</td>
                      <td>{expense.account}</td>
                      <td className="table-money negative">-{formatMoney(expense.amount)}</td>
                      <td>
                        <M.IconButton aria-label={"Редагувати " + expense.title} onClick={function () { setCurrent(expense); setOpen(true); }} data-od-id={"edit-expense-" + expense.id}><Icon name="edit" /></M.IconButton>
                        <M.IconButton aria-label={"Видалити " + expense.title} onClick={function () { removeExpense(expense.id); }} data-od-id={"delete-expense-" + expense.id}><Icon name="trash" /></M.IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filtered.length && <div className="empty-state" style={{ marginTop: 14 }}>Немає витрат за поточним фільтром.</div>}
        </section>
      </section>
      <ExpenseDialog open={open} expense={current} onClose={function () { setOpen(false); setCurrent(null); }} onSave={saveExpense} />
    </AppShell>
  );
}

function LauncherPage() {
  var cards = [
    { id: "auth", title: "Авторизація", text: "Вхід, реєстрація і базова валідація форми.", href: "auth.html", icon: "person" },
    { id: "dashboard", title: "Огляд", text: "Баланс місяця, витрати за тиждень і останні операції.", href: "dashboard.html", icon: "dashboard" },
    { id: "categories", title: "Категорії", text: "CRUD категорій з бюджетами та прогресом.", href: "categories.html", icon: "category" },
    { id: "expenses", title: "Витрати", text: "CRUD витрат із пошуком і фільтрацією.", href: "expenses.html", icon: "receipt" }
  ];
  return (
    <main className="launcher" data-od-id="launcher-screen">
      <div>
        <div className="eyebrow">Material Design 3 · MUI</div>
        <h1 className="page-title" data-od-id="launcher-heading">Облік витрат</h1>
        <p className="page-copy">Набір адаптивних екранів для пет-проєкту з робочими станами форм, таблиць і навігації.</p>
      </div>
      <section className="launcher-grid" data-od-id="launcher-grid">
        {cards.map(function (card) {
          return (
            <a className="launcher-card" href={card.href} key={card.id} data-od-id={"launcher-card-" + card.id}>
              <div>
                <div className="row-icon"><Icon name={card.icon} /></div>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </div>
              <span className="meta">Відкрити</span>
            </a>
          );
        })}
      </section>
    </main>
  );
}

function Root() {
  var map = {
    auth: <AuthPage />,
    dashboard: <DashboardPage />,
    categories: <CategoriesPage />,
    expenses: <ExpensesPage />,
    launcher: <LauncherPage />
  };
  return (
    <M.ThemeProvider theme={makeTheme()}>
      <M.CssBaseline />
      {map[SCREEN] || map.launcher}
    </M.ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);

Object.assign(window, { ExpenseTrackerRoot: Root });
