'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  createExpenseRequestSchema,
  type CategoryWithBudgetUsage,
  type CreateExpenseRequest,
  type Expense,
} from '@money-tracker/shared';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';

import { formatMinorCurrency, getCategories } from '@/lib/categories';
import {
  amountToInput,
  createExpense,
  currentDateInKyiv,
  deleteExpense,
  ExpensesApiError,
  formatExpenseDate,
  getExpenses,
  parseAmountInput,
  updateExpense,
} from '@/lib/expenses';

const pageSize = 10;

interface FormValues {
  title: string;
  amount: string;
  categoryId: string;
  expenseDate: string;
}

type FormErrors = Partial<Record<keyof FormValues | 'amountMinor' | 'form', string>>;

interface Notice {
  type: 'success' | 'error' | 'info';
  text: string;
}

function emptyForm(categories: CategoryWithBudgetUsage[]): FormValues {
  return {
    title: '',
    amount: '',
    categoryId: categories[0]?.id ?? '',
    expenseDate: currentDateInKyiv(),
  };
}

function validateForm(values: FormValues): {
  data?: CreateExpenseRequest;
  errors: FormErrors;
} {
  const amountMinor = parseAmountInput(values.amount);
  const result = createExpenseRequestSchema.safeParse({
    title: values.title,
    amountMinor,
    categoryId: values.categoryId,
    expenseDate: values.expenseDate,
  });
  const errors: FormErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? 'form') as keyof FormErrors;
      errors[field] ??= issue.message;
    }
  }
  if (values.expenseDate && values.expenseDate > currentDateInKyiv()) {
    errors.expenseDate = 'Дата витрати не може бути в майбутньому';
  }
  return Object.keys(errors).length ? { errors } : { data: result.data, errors };
}

function ExpenseActions({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onEdit: (event: MouseEvent<HTMLButtonElement>, expense: Expense) => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>, expense: Expense) => void;
}) {
  return (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <IconButton
        aria-label={`Редагувати ${expense.title}`}
        onClick={(event) => onEdit(event, expense)}
      >
        <span aria-hidden="true">✎</span>
      </IconButton>
      <IconButton
        aria-label={`Видалити ${expense.title}`}
        onClick={(event) => onDelete(event, expense)}
      >
        <span aria-hidden="true">🗑</span>
      </IconButton>
    </Stack>
  );
}

export function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<CategoryWithBudgetUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filteredAmountMinor, setFilteredAmountMinor] = useState(0);
  const [currentMonthAmountMinor, setCurrentMonthAmountMinor] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(() => emptyForm([]));
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const requestRef = useRef(0);
  const createQueryHandledRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const loadData = useCallback(
    async (options?: { initial?: boolean; successMessage?: string; requestedPage?: number }) => {
      const requestId = ++requestRef.current;
      if (options?.initial) setLoading(true);
      else setReloading(true);
      setError('');
      const targetPage = options?.requestedPage ?? page;
      try {
        const [expenseResponse, categoryResponse] = await Promise.all([
          getExpenses({ query: debouncedQuery, categoryId, page: targetPage, pageSize }),
          getCategories(),
        ]);
        if (requestId !== requestRef.current) return;
        if (targetPage > 1 && expenseResponse.total > 0 && expenseResponse.expenses.length === 0) {
          setPage(Math.max(1, expenseResponse.pagination.totalPages));
          return;
        }
        setExpenses(expenseResponse.expenses);
        setTotal(expenseResponse.total);
        setTotalPages(expenseResponse.pagination.totalPages);
        setFilteredAmountMinor(expenseResponse.summary.filteredAmountMinor);
        setCurrentMonthAmountMinor(expenseResponse.summary.currentMonthAmountMinor);
        setCategories(categoryResponse.categories);
        if (options?.successMessage) {
          setNotice({ type: 'success', text: options.successMessage });
        }
      } catch {
        if (requestId !== requestRef.current) return;
        if (options?.successMessage) {
          setNotice({
            type: 'info',
            text: `${options.successMessage} Дані збережено, але підсумки не вдалося оновити.`,
          });
        } else {
          setError('Не вдалося завантажити витрати. Спробуйте ще раз.');
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setReloading(false);
        }
      }
    },
    [categoryId, debouncedQuery, page],
  );

  useEffect(() => {
    void loadData({ initial: true });
  }, [loadData]);

  useEffect(() => {
    if (formOpen) window.setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [formOpen]);

  useEffect(() => {
    if (loading || createQueryHandledRef.current || typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('create') !== '1') return;
    createQueryHandledRef.current = true;
    if (!categories.length) return;
    setCurrentExpense(null);
    setFormValues(emptyForm(categories));
    setFormErrors({});
    setNotice(null);
    setFormOpen(true);
  }, [categories, loading]);

  const openCreate = (event: MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = event.currentTarget;
    setCurrentExpense(null);
    setFormValues(emptyForm(categories));
    setFormErrors({});
    setNotice(null);
    setFormOpen(true);
  };

  const openEdit = (event: MouseEvent<HTMLButtonElement>, expense: Expense) => {
    triggerRef.current = event.currentTarget;
    setCurrentExpense(expense);
    setFormValues({
      title: expense.title,
      amount: amountToInput(expense.amountMinor),
      categoryId: expense.category.id,
      expenseDate: expense.expenseDate,
    });
    setFormErrors({});
    setNotice(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setFormErrors({});
    triggerRef.current?.focus();
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFormErrors({});
    const validated = validateForm(formValues);
    if (!validated.data) {
      setFormErrors(validated.errors);
      if (validated.errors.title) titleInputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      if (currentExpense) {
        await updateExpense(currentExpense.id, currentExpense.version, validated.data);
      } else {
        await createExpense(validated.data);
      }
      setFormOpen(false);
      const successMessage = currentExpense ? 'Витрату оновлено.' : 'Витрату додано.';
      if (page !== 1) setPage(1);
      else await loadData({ successMessage, requestedPage: 1 });
      if (page !== 1) setNotice({ type: 'success', text: successMessage });
      triggerRef.current?.focus();
    } catch (requestError) {
      if (requestError instanceof ExpensesApiError) {
        const nextErrors: FormErrors = {};
        for (const [field, messages] of Object.entries(requestError.fields)) {
          nextErrors[field as keyof FormErrors] = messages[0];
        }
        nextErrors.form ??= requestError.message;
        setFormErrors(nextErrors);
      } else {
        setFormErrors({ form: 'Не вдалося зберегти витрату. Спробуйте ще раз.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (event: MouseEvent<HTMLButtonElement>, expense: Expense) => {
    triggerRef.current = event.currentTarget;
    setCurrentExpense(expense);
    setNotice(null);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    triggerRef.current?.focus();
  };

  const confirmDelete = async () => {
    if (!currentExpense || deleting) return;
    setDeleting(true);
    try {
      await deleteExpense(currentExpense.id, currentExpense.version);
      setDeleteOpen(false);
      await loadData({ successMessage: 'Витрату видалено.' });
      triggerRef.current?.focus();
    } catch (requestError) {
      setNotice({
        type: 'error',
        text:
          requestError instanceof ExpensesApiError
            ? requestError.message
            : 'Не вдалося видалити витрату. Спробуйте ще раз.',
      });
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = Boolean(debouncedQuery || categoryId);
  const archivedCurrentCategory =
    currentExpense?.category.archived &&
    !categories.some((category) => category.id === currentExpense.category.id)
      ? currentExpense.category
      : null;

  return (
    <Stack spacing={3} sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="overline" color="primary">
            CRUD витрат
          </Typography>
          <Typography variant="h4" component="h2" fontWeight={700} sx={{ mt: 0.5 }}>
            Записи без втрати контексту
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
            Знаходьте операції за назвою й категорією, а суми завжди отримуйте з сервера.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} disabled={!categories.length || loading}>
          Витрата
        </Button>
      </Stack>

      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      {!loading && categories.length === 0 && (
        <Alert
          severity="info"
          action={
            <Button component={Link} href="/categories" color="inherit">
              До категорій
            </Button>
          }
        >
          Щоб додати витрату, спочатку створіть активну категорію.
        </Alert>
      )}
      {error && !loading && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void loadData({ initial: true })}>
              Спробувати ще
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4, flex: 1 }}>
          <Typography color="text.secondary">За поточним фільтром</Typography>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMinorCurrency(filteredAmountMinor)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4, flex: 1 }}>
          <Typography color="text.secondary">Витрати цього місяця</Typography>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ mt: 1, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMinorCurrency(currentMonthAmountMinor)}
          </Typography>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden', minWidth: 0 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <TextField
            label="Пошук"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ maxLength: 120 }}
          />
          <TextField
            select
            label="Категорія"
            value={categoryId}
            onChange={(event) => {
              setPage(1);
              setCategoryId(event.target.value);
            }}
            sx={{ minWidth: { md: 240 } }}
          >
            <MenuItem value="">Усі активні категорії</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
          <Chip label={`${total} записів`} variant="outlined" />
        </Stack>
        {reloading && <LinearProgress aria-label="Оновлення списку витрат" />}

        {loading ? (
          <Stack spacing={1.5} sx={{ p: 3 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={64} />
            ))}
          </Stack>
        ) : expenses.length === 0 ? (
          <Box sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>
              {hasFilters ? 'Нічого не знайдено' : 'Витрат ще немає'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {hasFilters
                ? 'Змініть пошуковий запит або категорію.'
                : categories.length
                  ? 'Додайте перший запис, щоб почати журнал витрат.'
                  : 'Спочатку створіть активну категорію на сторінці категорій.'}
            </Typography>
            {hasFilters ? (
              <Button
                onClick={() => {
                  setQuery('');
                  setDebouncedQuery('');
                  setCategoryId('');
                  setPage(1);
                }}
              >
                Очистити фільтри
              </Button>
            ) : categories.length ? (
              <Button variant="contained" onClick={openCreate}>
                Додати витрату
              </Button>
            ) : null}
          </Box>
        ) : (
          <>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table aria-label="Витрати">
                <TableHead>
                  <TableRow>
                    <TableCell>Назва</TableCell>
                    <TableCell>Категорія</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell>Рахунок</TableCell>
                    <TableCell align="right">Сума</TableCell>
                    <TableCell align="right">Дії</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{expense.title}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant={expense.category.archived ? 'outlined' : 'filled'}
                          label={`${expense.category.name}${expense.category.archived ? ' · архів' : ''}`}
                        />
                      </TableCell>
                      <TableCell>{formatExpenseDate(expense.expenseDate)}</TableCell>
                      <TableCell>{expense.account}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: 'error.main',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        −{formatMinorCurrency(expense.amountMinor)}
                      </TableCell>
                      <TableCell align="right">
                        <ExpenseActions
                          expense={expense}
                          onEdit={openEdit}
                          onDelete={requestDelete}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' }, p: 2 }}>
              {expenses.map((expense) => (
                <Paper
                  key={expense.id}
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 3, minWidth: 0 }}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>
                        {expense.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {expense.category.name}
                        {expense.category.archived ? ' · архів' : ''} ·{' '}
                        {formatExpenseDate(expense.expenseDate)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {expense.account}
                      </Typography>
                    </Box>
                    <Typography
                      color="error.main"
                      fontWeight={700}
                      sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                    >
                      −{formatMinorCurrency(expense.amountMinor)}
                    </Typography>
                  </Stack>
                  <ExpenseActions expense={expense} onEdit={openEdit} onDelete={requestDelete} />
                </Paper>
              ))}
            </Stack>
          </>
        )}

        {!loading && totalPages > 1 && (
          <Stack alignItems="center" sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Pagination
              page={page}
              count={totalPages}
              onChange={(_, value) => setPage(value)}
              color="primary"
              siblingCount={0}
              aria-label="Сторінки витрат"
            />
          </Stack>
        )}
      </Paper>

      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>{currentExpense ? 'Редагувати витрату' : 'Нова витрата'}</DialogTitle>
        <Box component="form" onSubmit={submitForm} noValidate>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Рахунок для MVP встановлено автоматично: Monobank.
            </DialogContentText>
            <Stack spacing={2}>
              {formErrors.form && <Alert severity="error">{formErrors.form}</Alert>}
              <TextField
                inputRef={titleInputRef}
                label="Назва"
                value={formValues.title}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, title: event.target.value }))
                }
                error={Boolean(formErrors.title)}
                helperText={formErrors.title ?? ' '}
                inputProps={{ maxLength: 120 }}
                disabled={submitting}
              />
              <TextField
                label="Сума"
                inputMode="decimal"
                value={formValues.amount}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, amount: event.target.value }))
                }
                error={Boolean(formErrors.amountMinor)}
                helperText={formErrors.amountMinor ?? 'Наприклад: 1250,50'}
                disabled={submitting}
              />
              <TextField
                select
                label="Категорія"
                value={formValues.categoryId}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, categoryId: event.target.value }))
                }
                error={Boolean(formErrors.categoryId)}
                helperText={formErrors.categoryId ?? ' '}
                disabled={submitting}
              >
                {archivedCurrentCategory && (
                  <MenuItem value={archivedCurrentCategory.id} disabled>
                    {archivedCurrentCategory.name} · архівна
                  </MenuItem>
                )}
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Дата"
                type="date"
                value={formValues.expenseDate}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, expenseDate: event.target.value }))
                }
                error={Boolean(formErrors.expenseDate)}
                helperText={formErrors.expenseDate ?? ' '}
                inputProps={{ max: currentDateInKyiv() }}
                InputLabelProps={{ shrink: true }}
                disabled={submitting}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={closeForm} disabled={submitting}>
              Скасувати
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={20} color="inherit" /> : 'Зберегти'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={deleteOpen} onClose={closeDelete} fullWidth maxWidth="xs">
        <DialogTitle>Видалити витрату</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {currentExpense ? `Видалити «${currentExpense.title}»? Цю дію не можна скасувати.` : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeDelete} disabled={deleting}>
            Скасувати
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void confirmDelete()}
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={20} color="inherit" /> : 'Видалити'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
