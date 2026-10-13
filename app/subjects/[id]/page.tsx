'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CategoryIcon from '@mui/icons-material/Category';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import AppNavbar from '@/components/Navigation/AppNavbar';
import TaskFormDialog, { TaskItem, SubjectItem } from '@/components/Tasks/TaskFormDialog';
import TaskDetailDialog from '@/components/Tasks/TaskDetailDialog';
import { formatHumanDuration } from '@/lib/utils/formatTime';
import { TaskStatus } from '@prisma/client';

interface CategoryItem {
  id: string;
  subjectId: string;
  name: string;
  description?: string | null;
}

interface SubjectDetails {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  categories: CategoryItem[];
  tasks: TaskItem[];
}

export default function SubjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [subject, setSubject] = useState<SubjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Category Dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Task Dialog
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);

  const fetchSubject = useCallback(async () => {
    try {
      const res = await fetch(`/api/subjects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSubject(data);
      } else {
        setError('Nie znaleziono przedmiotu');
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchSubject();
  }, [id, fetchSubject]);

  // Statistics for time spent on this subject
  const timeStats = useMemo(() => {
    if (!subject) {
      return {
        totalSeconds: 0,
        tasksWithTimeCount: 0,
        avgSecondsPerTrackedTask: 0,
        timeByCategory: {} as Record<string, number>,
        uncategorizedTime: 0,
      };
    }

    const totalSeconds = subject.tasks.reduce((acc, t) => acc + (t.timeSpentSeconds || 0), 0);
    const tasksWithTime = subject.tasks.filter((t) => (t.timeSpentSeconds || 0) > 0);
    const tasksWithTimeCount = tasksWithTime.length;
    const avgSecondsPerTrackedTask =
      tasksWithTimeCount > 0 ? Math.round(totalSeconds / tasksWithTimeCount) : 0;

    const timeByCategory: Record<string, number> = {};
    let uncategorizedTime = 0;

    for (const t of subject.tasks) {
      const sec = t.timeSpentSeconds || 0;
      if (t.categoryId) {
        timeByCategory[t.categoryId] = (timeByCategory[t.categoryId] || 0) + sec;
      } else {
        uncategorizedTime += sec;
      }
    }

    return {
      totalSeconds,
      tasksWithTimeCount,
      avgSecondsPerTrackedTask,
      timeByCategory,
      uncategorizedTime,
    };
  }, [subject]);

  const handleOpenCatCreate = () => {
    setEditingCategory(null);
    setCatName('');
    setCatDescription('');
    setCatError(null);
    setCatDialogOpen(true);
  };

  const handleOpenCatEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDescription(cat.description || '');
    setCatError(null);
    setCatDialogOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setCatError('Nazwa kategorii jest wymagana');
      return;
    }

    setCatSubmitting(true);
    setCatError(null);

    const payload = editingCategory
      ? { name: catName.trim(), description: catDescription.trim() || null }
      : { subjectId: id, name: catName.trim(), description: catDescription.trim() || null };

    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setCatError(data.error || 'Błąd zapisu kategorii');
        setCatSubmitting(false);
        return;
      }

      setCatDialogOpen(false);
      fetchSubject();
    } catch {
      setCatError('Błąd połączenia');
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę kategorię? Przypisane do niej zadania NIE zostaną usunięte — ich kategoria zostanie wyczyszczona.')) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
      if (res.ok) fetchSubject();
    } catch {
      // ignore
    }
  };

  const handleToggleTaskStatus = async (task: TaskItem) => {
    const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) fetchSubject();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
        <AppNavbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error || !subject) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
        <AppNavbar />
        <Container maxWidth="md" sx={{ mt: 6, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>{error || 'Przedmiot nie istnieje'}</Alert>
          <Button component={Link} href="/subjects" startIcon={<ArrowBackIcon />}>
            Powrót do listy przedmiotów
          </Button>
        </Container>
      </Box>
    );
  }

  const subjectItemForDialog: SubjectItem = {
    id: subject.id,
    name: subject.name,
    color: subject.color,
    categories: subject.categories.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 8 }}>
      <AppNavbar />

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Back button */}
        <Button
          component={Link}
          href="/subjects"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Wszystkie przedmioty
        </Button>

        {/* Subject Header Card */}
        <Card sx={{ p: 3, mb: 4, borderLeft: `6px solid ${subject.color || '#2563eb'}` }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
                {subject.name}
              </Typography>
              {subject.description && (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                  {subject.description}
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<CategoryIcon />}
                onClick={handleOpenCatCreate}
              >
                Dodaj kategorię
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingTask(null);
                  setTaskFormOpen(true);
                }}
              >
                Dodaj zadanie
              </Button>
            </Stack>
          </Stack>
        </Card>

        <Grid container spacing={3}>
          {/* Categories Column */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Kategorie ({subject.categories.length})
                  </Typography>
                  <IconButton size="small" color="primary" onClick={handleOpenCatCreate} title="Dodaj kategorię">
                    <AddIcon />
                  </IconButton>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  np. Kolokwia, Laboratoria, Zadania domowe, Projekt
                </Typography>

                {subject.categories.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    Brak kategorii w tym przedmiocie.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {subject.categories.map((cat) => (
                      <Paper
                        key={cat.id}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {cat.name}
                            </Typography>
                            {cat.description && (
                              <Typography variant="caption" color="text.secondary">
                                {cat.description}
                              </Typography>
                            )}
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" onClick={() => handleOpenCatEdit(cat)} title="Edytuj">
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteCategory(cat.id)} title="Usuń">
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Tasks for Subject */}
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Zadania z przedmiotu ({subject.tasks.length})
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setEditingTask(null);
                      setTaskFormOpen(true);
                    }}
                  >
                    Nowe zadanie
                  </Button>
                </Stack>

                {subject.tasks.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
                    Brak zadań przypisanych do tego przedmiotu.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ width: 40 }}></TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Zadanie</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Kategoria</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Story Points</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Termin</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {subject.tasks.map((t) => {
                          const isDone = t.status === TaskStatus.DONE;
                          return (
                            <TableRow
                              key={t.id}
                              hover
                              sx={{ cursor: 'pointer', bgcolor: isDone ? '#fafafa' : 'inherit' }}
                              onClick={() => setDetailTask(t)}
                            >
                              <TableCell onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(t); }}>
                                <IconButton size="small" color={isDone ? 'success' : 'default'}>
                                  {isDone ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                                </IconButton>
                              </TableCell>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 700,
                                    textDecoration: isDone ? 'line-through' : 'none',
                                    color: isDone ? 'text.secondary' : 'text.primary',
                                  }}
                                >
                                  {t.title}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {t.category ? (
                                  <Chip label={t.category.name} size="small" variant="outlined" />
                                ) : (
                                  <Typography variant="caption" color="text.disabled">—</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip label={`${t.storyPoints} SP`} size="small" sx={{ fontWeight: 700 }} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString('pl-PL') : 'Bez terminu'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={t.status}
                                  size="small"
                                  color={isDone ? 'success' : 'default'}
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Category Create/Edit Dialog */}
      <Dialog open={catDialogOpen} onClose={() => setCatDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingCategory ? 'Edytuj kategorię' : 'Nowa kategoria'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveCategory}>
          <DialogContent dividers>
            <Stack spacing={2}>
              {catError && <Alert severity="error">{catError}</Alert>}
              <TextField
                label="Nazwa kategorii"
                required
                fullWidth
                autoFocus
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="np. Kolokwia, Laboratoria"
              />
              <TextField
                label="Opis kategorii (opcjonalny)"
                multiline
                rows={2}
                fullWidth
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setCatDialogOpen(false)} color="inherit" disabled={catSubmitting}>
              Anuluj
            </Button>
            <Button type="submit" variant="contained" disabled={catSubmitting}>
              {catSubmitting ? 'Zapisywanie...' : editingCategory ? 'Zapisz' : 'Dodaj'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Task Dialogs */}
      <TaskFormDialog
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSaved={fetchSubject}
        initialTask={editingTask}
        subjects={[subjectItemForDialog]}
      />

      <TaskDetailDialog
        open={Boolean(detailTask)}
        task={detailTask}
        settings={{ importantStoryPointsThreshold: 6, urgentWithinDays: 3 }}
        onClose={() => setDetailTask(null)}
        onEdit={(task) => {
          setDetailTask(null);
          setEditingTask(task);
          setTaskFormOpen(true);
        }}
        onRefresh={fetchSubject}
      />
    </Box>
  );
}

