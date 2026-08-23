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
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  CategoryWithBudgetUsage,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@money-tracker/shared';
import { createCategoryRequestSchema, updateCategoryRequestSchema } from '@money-tracker/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  CategoriesApiError,
  archiveCategory,
  createCategory,
  formatActiveCount,
  formatMinorCurrency,
  getCategories,
  parseBudgetInput,
  progressValue,
  updateCategory,
  usageColor,
} from '@/lib/categories';

type FormMode = 'create' | 'edit';
type FieldErrors = Partial<Record<'name' | 'type' | 'monthlyBudgetMinor' | 'form', string>>;

interface FormState {
  name: string;
  type: string;
  budget: string;
}

const emptyForm: FormState = { name: '', type: '', budget: '' };

function budgetToInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(/\.00$/, '');
}

function firstFieldError(errors: FieldErrors): keyof FormState | null {
  if (errors.name) return 'name';
  if (errors.type) return 'type';
  if (errors.monthlyBudgetMinor) return 'budget';
  return null;
}

function validateCategoryForm(
  mode: FormMode,
  values: FormState,
): {
  data: CreateCategoryRequest | UpdateCategoryRequest | null;
  errors: FieldErrors;
} {
  const budgetMinor = parseBudgetInput(values.budget);
  const budgetError =
    budgetMinor === null
      ? 'Вкажіть суму в гривнях без експоненційного запису й не більше ніж із двома знаками після коми'
      : undefined;

  const schemaInput = {
    name: values.name,
    type: values.type,
    ...(budgetMinor === null ? {} : { monthlyBudgetMinor: budgetMinor }),
  };
  const parsed =
    mode === 'create'
      ? createCategoryRequestSchema.safeParse(schemaInput)
      : updateCategoryRequestSchema.safeParse(schemaInput);

  const errors: FieldErrors = {};
  if (budgetError) errors.monthlyBudgetMinor = budgetError;
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? 'form') as keyof FieldErrors;
      if (!errors[field]) errors[field] = issue.message;
    }
  }

  return {
    data: parsed.success && !budgetError ? parsed.data : null,
    errors,
  };
}

export function CategoriesScreen() {
  const [categories, setCategories] = useState<CategoryWithBudgetUsage[]>([]);
  const [summary, setSummary] = useState({
    activeCount: 0,
    totalBudgetMinor: 0,
    totalSpentMinor: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formValues, setFormValues] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [currentCategory, setCurrentCategory] = useState<CategoryWithBudgetUsage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const loadCategories = async (options?: { initial?: boolean; afterSuccessMessage?: string }) => {
    if (options?.initial) {
      setLoading(true);
      setError('');
    } else {
      setReloading(true);
    }

    try {
      const response = await getCategories();
      setCategories(response.categories);
      setSummary(response.summary);
      setError('');
      if (options?.afterSuccessMessage) {
        setMessage({ type: 'success', text: options.afterSuccessMessage });
      }
    } catch {
      const nextError = 'Не вдалося завантажити категорії. Спробуйте ще раз.';
      if (options?.afterSuccessMessage) {
        setMessage({
          type: 'info',
          text: `${options.afterSuccessMessage} Дані збережено, але список не вдалося оновити.`,
        });
      } else {
        setError(nextError);
      }
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => {
    void loadCategories({ initial: true });
  }, []);

  useEffect(() => {
    if (formOpen) window.setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [formOpen]);

  const openCreate = (event: React.MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = event.currentTarget;
    setFormMode('create');
    setCurrentCategory(null);
    setFormValues(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (
    event: React.MouseEvent<HTMLButtonElement>,
    category: CategoryWithBudgetUsage,
  ) => {
    triggerRef.current = event.currentTarget;
    setFormMode('edit');
    setCurrentCategory(category);
    setFormValues({
      name: category.name,
      type: category.type,
      budget: budgetToInput(category.monthlyBudgetMinor),
    });
    setFormErrors({});
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
    setMessage(null);

    const { data, errors } = validateCategoryForm(formMode, formValues);
    if (!data) {
      setFormErrors(errors);
      const field = firstFieldError(errors);
      if (field === 'name') nameInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (formMode === 'create') {
        await createCategory(data as CreateCategoryRequest);
      } else if (currentCategory) {
        await updateCategory(
          currentCategory.id,
          currentCategory.version,
          data as UpdateCategoryRequest,
        );
      }
      setFormOpen(false);
      await loadCategories({
        afterSuccessMessage: formMode === 'create' ? 'Категорію створено.' : 'Категорію оновлено.',
      });
      triggerRef.current?.focus();
    } catch (requestError) {
      if (requestError instanceof CategoriesApiError) {
        const nextErrors: FieldErrors = {};
        for (const [field, messages] of Object.entries(requestError.fields)) {
          nextErrors[field as keyof FieldErrors] = messages[0];
        }
        if (requestError.code === 'CATEGORY_VERSION_CONFLICT') {
          nextErrors.form = requestError.message;
        }
        setFormErrors(nextErrors);
        if (!Object.keys(nextErrors).length) {
          setFormErrors({ form: requestError.message });
        }
      } else {
        setFormErrors({ form: 'Не вдалося зберегти категорію. Спробуйте ще раз.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (
    event: React.MouseEvent<HTMLButtonElement>,
    category: CategoryWithBudgetUsage,
  ) => {
    triggerRef.current = event.currentTarget;
    setCurrentCategory(category);
    setDeleteOpen(true);
    setMessage(null);
  };

  const confirmDelete = async () => {
    if (!currentCategory || deleting) return;
    setDeleting(true);
    try {
      await archiveCategory(currentCategory.id, currentCategory.version);
      setDeleteOpen(false);
      await loadCategories({ afterSuccessMessage: 'Категорію видалено.' });
      triggerRef.current?.focus();
    } catch (requestError) {
      if (requestError instanceof CategoriesApiError) {
        setMessage({ type: 'error', text: requestError.message });
      } else {
        setMessage({ type: 'error', text: 'Не вдалося видалити категорію. Спробуйте ще раз.' });
      }
    } finally {
      setDeleting(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        spacing={2}
      >
        <Box>
          <Typography variant="overline" color="primary">
            CRUD категорій
          </Typography>
          <Typography variant="h3" component="h1" fontWeight={700} sx={{ mt: 1 }}>
            Бюджети за призначенням
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 720 }}>
            Категорії мають тип, місячний бюджет і поточне використання, щоб витрати одразу лягали в
            потрібний контекст.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ alignSelf: { md: 'center' } }}>
          Категорія
        </Button>
      </Stack>

      {message && <Alert severity={message.type}>{message.text}</Alert>}
      {error && !loading && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void loadCategories({ initial: true })}
            >
              Спробувати ще
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
        <Paper
          variant="outlined"
          sx={{
            flex: 1.1,
            p: { xs: 2.5, md: 3 },
            borderRadius: 4,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,252,247,0.96))',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2.5 }}
          >
            <Typography variant="h5" fontWeight={700}>
              Список
            </Typography>
            <Chip label={formatActiveCount(summary.activeCount)} variant="outlined" />
          </Stack>

          {reloading && <LinearProgress sx={{ mb: 2 }} aria-label="Оновлення списку категорій" />}

          {loading ? (
            <Stack spacing={2}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                  <Skeleton variant="text" width="28%" height={34} />
                  <Skeleton variant="text" width="48%" />
                  <Skeleton variant="rounded" height={10} sx={{ mt: 1.5 }} />
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
                    <Skeleton variant="text" width="20%" />
                    <Skeleton variant="text" width="16%" />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : categories.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                borderRadius: 4,
                textAlign: 'center',
                borderStyle: 'dashed',
              }}
            >
              <Typography variant="h6" fontWeight={700}>
                Категорій ще немає
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                Створіть першу категорію, щоб планувати місячний бюджет і бачити прогрес витрат.
              </Typography>
              <Button variant="contained" onClick={openCreate}>
                Створити категорію
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {categories.map((category) => {
                const progress = progressValue(category.usagePercent);
                const color = usageColor(category.usagePercent);
                return (
                  <Paper
                    key={category.id}
                    variant="outlined"
                    sx={{ p: 2.5, borderRadius: 3, overflow: 'hidden' }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" fontWeight={700} noWrap>
                          {category.name}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                          {category.type} · витрачено {formatMinorCurrency(category.spentMinor)}
                        </Typography>
                        <Box sx={{ mt: 1.75 }}>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            color={color}
                            aria-label={`Використано ${category.usagePercent}% бюджету для ${category.name}`}
                            aria-valuenow={progress}
                            sx={{ height: 10, borderRadius: 999 }}
                          />
                        </Box>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          spacing={1}
                          sx={{ mt: 1.25 }}
                        >
                          <Typography color="text.secondary">
                            {category.usagePercent}% бюджету
                          </Typography>
                          <Typography
                            color={category.remainingMinor < 0 ? 'error.main' : 'text.secondary'}
                          >
                            {category.remainingMinor < 0 ? 'Перевитрата' : 'Залишок'}{' '}
                            {formatMinorCurrency(Math.abs(category.remainingMinor))}
                          </Typography>
                        </Stack>
                      </Box>
                      <Stack
                        direction={{ xs: 'row', sm: 'column' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'center', sm: 'flex-end' }}
                        spacing={1}
                      >
                        <Typography variant="h6" fontWeight={700}>
                          {formatMinorCurrency(category.monthlyBudgetMinor)}
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton
                            aria-label={`Редагувати ${category.name}`}
                            onClick={(event) => openEdit(event, category)}
                          >
                            <span aria-hidden="true">✎</span>
                          </IconButton>
                          <IconButton
                            aria-label={`Видалити ${category.name}`}
                            onClick={(event) => requestDelete(event, category)}
                          >
                            <span aria-hidden="true">🗑</span>
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>

        <Stack spacing={3} sx={{ width: { xs: '100%', lg: 360 }, flexShrink: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 4,
              background:
                'radial-gradient(circle at top right, rgba(46,125,50,0.10), transparent 38%), #fff',
            }}
          >
            <Typography variant="h5" fontWeight={700}>
              Загальний бюджет
            </Typography>
            <Typography variant="h3" fontWeight={700} sx={{ mt: 2 }}>
              {formatMinorCurrency(summary.totalBudgetMinor)}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Сума всіх активних категорій на поточний місяць.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 4 }}>
            <Typography variant="h5" fontWeight={700}>
              Використано
            </Typography>
            <Typography variant="h3" fontWeight={700} sx={{ mt: 2 }}>
              {formatMinorCurrency(summary.totalSpentMinor)}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Оновлюється після змін у витратах та архівування категорій.
            </Typography>
          </Paper>
        </Stack>
      </Stack>

      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>
          {formMode === 'create' ? 'Нова категорія' : 'Редагувати категорію'}
        </DialogTitle>
        <Box component="form" onSubmit={submitForm} noValidate>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Вкажіть назву, тип і місячний бюджет у гривнях. Перевищення бюджету дозволене, але
              буде помітне в індикаторі.
            </DialogContentText>
            <Stack spacing={2}>
              {formErrors.form && <Alert severity="error">{formErrors.form}</Alert>}
              <TextField
                inputRef={nameInputRef}
                label="Назва"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, name: event.target.value }))
                }
                error={Boolean(formErrors.name)}
                helperText={formErrors.name ?? ' '}
                disabled={submitting}
              />
              <TextField
                label="Тип"
                value={formValues.type}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, type: event.target.value }))
                }
                error={Boolean(formErrors.type)}
                helperText={formErrors.type ?? ' '}
                disabled={submitting}
              />
              <TextField
                label="Місячний бюджет"
                value={formValues.budget}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, budget: event.target.value }))
                }
                error={Boolean(formErrors.monthlyBudgetMinor)}
                helperText={formErrors.monthlyBudgetMinor ?? 'Наприклад: 2500, 2500,5 або 2500.50'}
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
        <DialogTitle>Видалити категорію</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {currentCategory
              ? `Видалити категорію «${currentCategory.name}»? Вона зникне зі списку та нових витрат. Існуючі витрати збережуться.`
              : ''}
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
