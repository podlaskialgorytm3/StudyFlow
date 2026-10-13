'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  Grid,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  InputAdornment,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import TableRowsIcon from '@mui/icons-material/TableRows';
import DateRangeIcon from '@mui/icons-material/DateRange';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AppNavbar from '@/components/Navigation/AppNavbar';
import TaskFormDialog, { TaskItem, SubjectItem } from '@/components/Tasks/TaskFormDialog';
import TaskDetailDialog from '@/components/Tasks/TaskDetailDialog';
import TaskKanbanBoard from '@/components/Tasks/TaskKanbanBoard';
import {
  classifyEisenhowerTask,
  EisenhowerSettings,
  QUADRANT_CONFIG,
} from '@/lib/domain/eisenhower';
import {
  generateTimeframePeriods,
  isTaskInTimeframe,
  TimeframePeriod,
} from '@/lib/domain/timeframe';
import { TaskStatus } from '@prisma/client';

interface TaskPageSettings extends EisenhowerSettings {
  taskHorizonDays: number;
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [settings, setSettings] = useState<TaskPageSettings>({
    importantStoryPointsThreshold: 6,
    urgentWithinDays: 3,
    taskHorizonDays: 7,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('current');
  const [sortBy, setSortBy] = useState<string>('dueDate'); // 'dueDate', 'storyPoints', 'createdAt'

  // View mode: 'kanban' or 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [initialStatusForNew, setInitialStatusForNew] = useState<TaskStatus | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, subjectsRes, settingsRes] = await Promise.all([
        fetch('/api/tasks?includeDone=true'),
        fetch('/api/subjects'),
        fetch('/api/settings'),
      ]);

      if (tasksRes.ok) {
        const t = await tasksRes.json();
        setTasks(t);
      }
      if (subjectsRes.ok) {
        const s = await subjectsRes.json();
        setSubjects(s);
      }
      if (settingsRes.ok) {
        const setts = await settingsRes.json();
        setSettings({
          importantStoryPointsThreshold: setts.importantStoryPointsThreshold,
          urgentWithinDays: setts.urgentWithinDays,
          taskHorizonDays: setts.taskHorizonDays ?? 7,
        });
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Categories available for chosen subject
  const availableCategories = useMemo(() => {
    if (selectedSubject === 'ALL') {
      return subjects.flatMap((s) => s.categories);
    }
    const subj = subjects.find((s) => s.id === selectedSubject);
    return subj?.categories || [];
  }, [selectedSubject, subjects]);

  // Dynamic timeframe periods based on student's interval setting
  const timeframePeriods = useMemo(() => {
    return generateTimeframePeriods({
      horizonDays: settings.taskHorizonDays || 7,
      tasksDueDates: tasks.map((t) => t.dueDate),
    });
  }, [settings.taskHorizonDays, tasks]);

  // Task count per timeframe period
  const taskCountsByTimeframe = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const period of timeframePeriods) {
      counts[period.key] = tasks.filter((t) => {
        if (selectedSubject !== 'ALL' && t.subjectId !== selectedSubject) return false;
        if (selectedCategory !== 'ALL' && t.categoryId !== selectedCategory) return false;
        return isTaskInTimeframe(t.dueDate, period.key, settings.taskHorizonDays || 7, timeframePeriods);
      }).length;
    }
    return counts;
  }, [tasks, timeframePeriods, selectedSubject, selectedCategory, settings.taskHorizonDays]);

  const activePeriod = useMemo(() => {
    return timeframePeriods.find((p) => p.key === timeframeFilter) || timeframePeriods[0];
  }, [timeframePeriods, timeframeFilter]);

  // Filtered & sorted tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (selectedSubject !== 'ALL' && t.subjectId !== selectedSubject) return false;
        if (selectedCategory !== 'ALL' && t.categoryId !== selectedCategory) return false;
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (!isTaskInTimeframe(t.dueDate, timeframeFilter, settings.taskHorizonDays || 7, timeframePeriods)) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          const matchSubj = t.subject?.name.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchSubj) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === 'storyPoints') {
          return b.storyPoints - a.storyPoints;
        }
        return 0;
      });
  }, [tasks, selectedSubject, selectedCategory, statusFilter, timeframeFilter, settings.taskHorizonDays, timeframePeriods, search, sortBy]);

  const handleToggleStatus = async (task: TaskItem) => {
    const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) fetchData();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to zadanie?')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic local update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch {
      fetchData();
    }
  };

  const handleAddTaskToStatus = (status: TaskStatus) => {
    setEditingTask(null);
    setInitialStatusForNew(status);
    setFormOpen(true);
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 8 }}>
      <AppNavbar />

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              Lista zadań
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Filtruj, sortuj i zarządzaj wszystkimi zadaniami akademickimi.
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, val) => val && setViewMode(val)}
              size="small"
              sx={{ bgcolor: 'white' }}
            >
              <ToggleButton value="kanban" aria-label="Tablica kolumnowa">
                <ViewKanbanIcon sx={{ mr: 0.75, fontSize: 20 }} />
                Kolumny (Kanban)
              </ToggleButton>
              <ToggleButton value="table" aria-label="Tabela zadań">
                <TableRowsIcon sx={{ mr: 0.75, fontSize: 20 }} />
                Tabela
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingTask(null);
                setInitialStatusForNew(undefined);
                setFormOpen(true);
              }}
            >
              Dodaj zadanie
            </Button>
          </Stack>
        </Stack>

        {/* Filter Card */}
        <Card sx={{ p: 2.5, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Search */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Szukaj zadania..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Subject filter */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Przedmiot</InputLabel>
                <Select
                  value={selectedSubject}
                  label="Przedmiot"
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedCategory('ALL');
                  }}
                >
                  <MenuItem value="ALL">Wszystkie przedmioty</MenuItem>
                  {subjects.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Category filter */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Kategoria</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Kategoria"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="ALL">Wszystkie kategorie</MenuItem>
                  {availableCategories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Timeframe / Horizon filter */}
            <Grid item xs={12} sm={12} md={5}>
              <FormControl fullWidth size="small">
                <InputLabel>Termin / Okres zadania</InputLabel>
                <Select
                  value={timeframeFilter}
                  label="Termin / Okres zadania"
                  onChange={(e) => setTimeframeFilter(e.target.value)}
                >
                  {timeframePeriods.map((period) => (
                    <MenuItem key={period.key} value={period.key}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ width: '100%' }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: period.key === 'current' ? 700 : 500 }}>
                          {period.label}
                        </Typography>
                        <Chip
                          size="small"
                          label={taskCountsByTimeframe[period.key] ?? 0}
                          color={timeframeFilter === period.key ? 'primary' : 'default'}
                          sx={{ ml: 1.5, height: 20, fontSize: '0.72rem', fontWeight: 700 }}
                        />
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Status filter */}
            <Grid item xs={12} sm={6} md={3.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="ALL">Wszystkie statusy</MenuItem>
                  <MenuItem value={TaskStatus.NEW}>Nowe (NEW)</MenuItem>
                  <MenuItem value={TaskStatus.TODO}>Do zrobienia (TODO)</MenuItem>
                  <MenuItem value={TaskStatus.IN_PROGRESS}>W trakcie (IN_PROGRESS)</MenuItem>
                  <MenuItem value={TaskStatus.DONE}>Ukończone (DONE)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort by */}
            <Grid item xs={12} sm={6} md={3.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Sortuj według</InputLabel>
                <Select value={sortBy} label="Sortuj według" onChange={(e) => setSortBy(e.target.value)}>
                  <MenuItem value="dueDate">Termin oddania</MenuItem>
                  <MenuItem value="storyPoints">Story Points (od najwyższych)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Active timeframe indicator bar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #f1f5f9' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <DateRangeIcon fontSize="small" color="primary" />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Wybrany okres:
              </Typography>
              <Chip
                size="small"
                color="primary"
                variant="filled"
                label={activePeriod?.label || 'Bieżący okres'}
                sx={{ fontWeight: 700, fontSize: '0.75rem' }}
              />
              <Typography variant="caption" color="text.secondary">
                (widoczne: {filteredTasks.length} {filteredTasks.length === 1 ? 'zadanie' : filteredTasks.length > 1 && filteredTasks.length < 5 ? 'zadania' : 'zadań'})
              </Typography>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Domyślny horyzont to <strong>{settings.taskHorizonDays} dni</strong>.{' '}
              <Link href="/settings" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: 600 }}>
                Zmień w Ustawieniach
              </Link>
            </Typography>
          </Stack>
        </Card>

        {/* Task List / Kanban / Table */}
        {filteredTasks.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Brak zadań spełniających kryteria
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Zmień filtry wyszukiwania lub utwórz nowe zadanie.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingTask(null);
                setInitialStatusForNew(undefined);
                setFormOpen(true);
              }}
            >
              Utwórz zadanie
            </Button>
          </Card>
        ) : viewMode === 'kanban' ? (
          <TaskKanbanBoard
            tasks={filteredTasks}
            settings={settings}
            onSelectTask={(t) => setDetailTask(t)}
            onEditTask={(t) => {
              setEditingTask(t);
              setFormOpen(true);
            }}
            onDeleteTask={handleDelete}
            onStatusChange={handleStatusChange}
            onAddTaskToStatus={handleAddTaskToStatus}
          />
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ width: 48 }}></TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Zadanie</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Przedmiot</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Story Points</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ćwiartka Eisenhowera</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Termin</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Akcje
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTasks.map((t) => {
                  const classification = classifyEisenhowerTask(t, settings);
                  const qConf = QUADRANT_CONFIG[classification.quadrant];
                  const isDone = t.status === TaskStatus.DONE;
                  const isOverridden = classification.isPriorityOverridden || classification.isUrgencyOverridden;

                  return (
                    <TableRow
                      key={t.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        bgcolor: isDone ? '#fafafa' : 'inherit',
                      }}
                    >
                      {/* Quick Done Checkbox */}
                      <TableCell onClick={(e) => { e.stopPropagation(); handleToggleStatus(t); }}>
                        <IconButton size="small" color={isDone ? 'success' : 'default'}>
                          {isDone ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                        </IconButton>
                      </TableCell>

                      {/* Title & Description */}
                      <TableCell onClick={() => setDetailTask(t)}>
                        <Stack direction="row" spacing={1} alignItems="center">
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
                          {isOverridden && (
                            <Tooltip title="Ręcznie nadpisana klasyfikacja w macierzy">
                              <EditNoteIcon fontSize="small" color="action" />
                            </Tooltip>
                          )}
                        </Stack>
                        {t.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {t.description}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Subject & Category */}
                      <TableCell onClick={() => setDetailTask(t)}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: t.subject?.color || '#1976d2',
                            }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t.subject?.name}
                          </Typography>
                        </Stack>
                        {t.category && (
                          <Typography variant="caption" color="text.secondary">
                            {t.category.name}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Story Points */}
                      <TableCell onClick={() => setDetailTask(t)}>
                        <Chip
                          label={`${t.storyPoints} SP`}
                          size="small"
                          color={t.storyPoints >= settings.importantStoryPointsThreshold ? 'primary' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>

                      {/* Eisenhower Quadrant */}
                      <TableCell onClick={() => setDetailTask(t)}>
                        <Chip
                          label={`${qConf.code}: ${qConf.label}`}
                          size="small"
                          sx={{
                            bgcolor: qConf.bgLight,
                            color: qConf.color,
                            border: `1px solid ${qConf.border}`,
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>

                      {/* Due date */}
                      <TableCell onClick={() => setDetailTask(t)}>
                        {t.dueDate ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2">
                              {new Date(t.dueDate).toLocaleDateString('pl-PL')}
                            </Typography>
                            {classification.daysRemaining !== null && !isDone && (
                              <Chip
                                size="small"
                                label={
                                  classification.isOverdue
                                    ? `Po terminie`
                                    : classification.isDueToday
                                    ? 'Dziś'
                                    : `${classification.daysRemaining}d`
                                }
                                color={
                                  classification.isOverdue
                                    ? 'error'
                                    : classification.isDueToday
                                    ? 'warning'
                                    : 'default'
                                }
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                              />
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Bez terminu
                          </Typography>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell onClick={() => setDetailTask(t)}>
                        <Chip
                          label={t.status}
                          size="small"
                          color={isDone ? 'success' : 'default'}
                          variant={isDone ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setEditingTask(t);
                              setFormOpen(true);
                            }}
                            title="Edytuj"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(t.id)}
                            title="Usuń"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      {/* Dialogs */}
      <TaskFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchData}
        initialTask={editingTask}
        initialStatus={initialStatusForNew}
        subjects={subjects}
      />

      <TaskDetailDialog
        open={Boolean(detailTask)}
        task={detailTask}
        settings={settings}
        onClose={() => setDetailTask(null)}
        onEdit={(task) => {
          setDetailTask(null);
          setEditingTask(task);
          setFormOpen(true);
        }}
        onRefresh={fetchData}
      />
    </Box>
  );
}
