'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SchoolIcon from '@mui/icons-material/School';
import CategoryIcon from '@mui/icons-material/Category';
import EditNoteIcon from '@mui/icons-material/EditNote';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import AppNavbar from '@/components/Navigation/AppNavbar';
import TaskFormDialog, { TaskItem, SubjectItem } from '@/components/Tasks/TaskFormDialog';
import TaskTimeTracker, { TaskTimeEntryItem } from '@/components/Tasks/TaskTimeTracker';
import { formatHumanDuration } from '@/lib/utils/formatTime';
import {
  classifyEisenhowerTask,
  EisenhowerSettings,
  QUADRANT_CONFIG,
  EisenhowerQuadrant,
} from '@/lib/domain/eisenhower';
import { PriorityOverride, UrgencyOverride, TaskStatus } from '@prisma/client';

interface FullTaskItem extends TaskItem {
  timeSpentSeconds: number;
  timeEntries: TaskTimeEntryItem[];
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const [task, setTask] = useState<FullTaskItem | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [settings, setSettings] = useState<EisenhowerSettings>({
    importantStoryPointsThreshold: 6,
    urgentWithinDays: 3,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog
  const [formOpen, setFormOpen] = useState(false);

  // Eisenhower move menu
  const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null);

  const fetchTaskData = useCallback(async () => {
    try {
      const [taskRes, settingsRes, subjectsRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch('/api/settings'),
        fetch('/api/subjects'),
      ]);

      if (!taskRes.ok) {
        if (taskRes.status === 404) {
          setError('Zadanie nie zostało znalezione');
        } else {
          setError('Błąd wczytywania zadania');
        }
        return;
      }

      const t = await taskRes.json();
      setTask(t);

      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSettings({
          importantStoryPointsThreshold: s.importantStoryPointsThreshold,
          urgentWithinDays: s.urgentWithinDays,
        });
      }

      if (subjectsRes.ok) {
        const subs = await subjectsRes.json();
        setSubjects(subs);
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  const handleToggleStatus = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE;
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchTaskData();
      }
    } catch {
      setError('Błąd aktualizacji statusu zadania');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !window.confirm('Czy na pewno chcesz bezpowrotnie usunąć to zadanie?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/tasks');
      } else {
        setError('Błąd podczas usuwania zadania');
      }
    } catch {
      setError('Błąd połączenia');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetQuadrant = async (targetQuad: EisenhowerQuadrant) => {
    if (!task) return;
    setMoveMenuAnchor(null);
    setActionLoading(true);

    let priorityOverride: PriorityOverride = PriorityOverride.IMPORTANT;
    let urgencyOverride: UrgencyOverride = UrgencyOverride.URGENT;

    switch (targetQuad) {
      case 'Q1_IMPORTANT_URGENT':
        priorityOverride = PriorityOverride.IMPORTANT;
        urgencyOverride = UrgencyOverride.URGENT;
        break;
      case 'Q2_IMPORTANT_NOT_URGENT':
        priorityOverride = PriorityOverride.IMPORTANT;
        urgencyOverride = UrgencyOverride.NOT_URGENT;
        break;
      case 'Q3_NOT_IMPORTANT_URGENT':
        priorityOverride = PriorityOverride.NOT_IMPORTANT;
        urgencyOverride = UrgencyOverride.URGENT;
        break;
      case 'Q4_NOT_IMPORTANT_NOT_URGENT':
        priorityOverride = PriorityOverride.NOT_IMPORTANT;
        urgencyOverride = UrgencyOverride.NOT_URGENT;
        break;
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityOverride, urgencyOverride }),
      });
      if (res.ok) {
        fetchTaskData();
      }
    } catch {
      setError('Błąd zmiany ćwiartki');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetOverride = async (dimension: 'priority' | 'urgency' | 'both') => {
    if (!task) return;
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (dimension === 'priority' || dimension === 'both') payload.priorityOverride = null;
      if (dimension === 'urgency' || dimension === 'both') payload.urgencyOverride = null;

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchTaskData();
      }
    } catch {
      setError('Błąd przywracania automatycznej klasyfikacji');
    } finally {
      setActionLoading(false);
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

  if (error || !task) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
        <AppNavbar />
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error || 'Zadanie nie zostało odnalezione'}
          </Alert>
          <Button component={Link} href="/tasks" startIcon={<ArrowBackIcon />} variant="outlined">
            Wróć do listy zadań
          </Button>
        </Container>
      </Box>
    );
  }

  const classification = classifyEisenhowerTask(task, settings);
  const qInfo = QUADRANT_CONFIG[classification.quadrant];
  const isDone = task.status === TaskStatus.DONE;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 8 }}>
      <AppNavbar />

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        {/* Top Navigation */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Button
            component={Link}
            href="/tasks"
            startIcon={<ArrowBackIcon />}
            variant="text"
            sx={{ fontWeight: 600 }}
          >
            Wróć do listy zadań
          </Button>

          <Stack direction="row" spacing={1}>
            <IconButton
              onClick={() => setFormOpen(true)}
              color="primary"
              title="Edytuj zadanie"
              disabled={actionLoading}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={handleDelete}
              color="error"
              title="Usuń zadanie"
              disabled={actionLoading}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Stack>
        </Stack>

        {/* Task Title Header Card */}
        <Card sx={{ mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
              spacing={2}
            >
              <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                  <Chip
                    icon={<SchoolIcon sx={{ fontSize: '1rem !important' }} />}
                    label={task.subject?.name || 'Przedmiot'}
                    sx={{
                      bgcolor: task.subject?.color || '#1976d2',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  />
                  {task.category && (
                    <Chip
                      icon={<CategoryIcon sx={{ fontSize: '1rem !important' }} />}
                      label={task.category.name}
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                  <Chip
                    label={`${task.storyPoints} Story Points`}
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    icon={<AccessTimeIcon sx={{ fontSize: '1rem !important' }} />}
                    label={`Szacowany czas: ${formatHumanDuration((task.estimatedMinutes ?? 60) * 60)}`}
                    color="info"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label={`Status: ${task.status}`}
                    color={isDone ? 'success' : 'default'}
                    variant={isDone ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>

                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 800,
                    textDecoration: isDone ? 'line-through' : 'none',
                    color: isDone ? 'text.secondary' : 'text.primary',
                  }}
                >
                  {task.title}
                </Typography>
              </Box>

              <Button
                variant={isDone ? 'outlined' : 'contained'}
                color={isDone ? 'inherit' : 'success'}
                size="large"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={handleToggleStatus}
                disabled={actionLoading}
                sx={{ px: 3, py: 1.2, fontWeight: 700, borderRadius: 2 }}
              >
                {isDone ? 'Cofnij ukończenie' : 'Oznacz jako ukończone'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          {/* Left Column: Details & Eisenhower */}
          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              {/* Eisenhower Matrix Card */}
              <Card sx={{ borderRadius: 3, border: `1px solid ${qInfo.border}`, bgcolor: qInfo.bgLight }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Box>
                      <Typography variant="overline" sx={{ fontWeight: 800, color: qInfo.color }}>
                        Macierz Eisenhowera — {qInfo.code}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: qInfo.color, lineHeight: 1.2 }}>
                        {qInfo.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {qInfo.subtitle}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SwapCallsIcon />}
                      onClick={(e) => setMoveMenuAnchor(e.currentTarget)}
                      sx={{ bgcolor: 'white' }}
                    >
                      Zmień ćwiartkę
                    </Button>
                  </Stack>

                  <Menu
                    anchorEl={moveMenuAnchor}
                    open={Boolean(moveMenuAnchor)}
                    onClose={() => setMoveMenuAnchor(null)}
                  >
                    {(Object.keys(QUADRANT_CONFIG) as EisenhowerQuadrant[]).map((qKey) => {
                      const conf = QUADRANT_CONFIG[qKey];
                      return (
                        <MenuItem key={qKey} onClick={() => handleSetQuadrant(qKey)}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: conf.color, mr: 1.5 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {conf.code}: {conf.label}
                          </Typography>
                        </MenuItem>
                      );
                    })}
                  </Menu>

                  <Divider sx={{ my: 2 }} />

                  {/* Overrides indicators */}
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">
                        Ważność:{' '}
                        <strong>
                          {classification.isImportant ? 'Ważne (≥ próg SP)' : 'Nieważne'}{' '}
                          {classification.isPriorityOverridden ? '(Ręcznie nadpisana)' : '(Automatyczna)'}
                        </strong>
                      </Typography>
                      {classification.isPriorityOverridden && (
                        <Button
                          size="small"
                          startIcon={<RotateLeftIcon />}
                          onClick={() => handleResetOverride('priority')}
                          sx={{ py: 0, fontSize: '0.75rem' }}
                        >
                          Przywróć automat
                        </Button>
                      )}
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">
                        Pilność:{' '}
                        <strong>
                          {classification.isUrgent ? 'Pilne (krótki termin)' : 'Niepilne'}{' '}
                          {classification.isUrgencyOverridden ? '(Ręcznie nadpisana)' : '(Automatyczna)'}
                        </strong>
                      </Typography>
                      {classification.isUrgencyOverridden && (
                        <Button
                          size="small"
                          startIcon={<RotateLeftIcon />}
                          onClick={() => handleResetOverride('urgency')}
                          sx={{ py: 0, fontSize: '0.75rem' }}
                        >
                          Przywróć automat
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Term & Dates Card */}
              <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Termin i harmonogram
                  </Typography>

                  <Stack spacing={2}>
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CalendarMonthIcon color="primary" />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Termin oddania zadania
                          </Typography>
                          {task.dueDate ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                {new Date(task.dueDate).toLocaleDateString('pl-PL', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </Typography>
                              {classification.daysRemaining !== null && (
                                <Chip
                                  size="small"
                                  label={
                                    classification.isOverdue
                                      ? `${Math.abs(classification.daysRemaining)} dni po terminie`
                                      : classification.isDueToday
                                      ? 'Dzisiaj!'
                                      : `Za ${classification.daysRemaining} dni`
                                  }
                                  color={
                                    classification.isOverdue
                                      ? 'error'
                                      : classification.isDueToday
                                      ? 'warning'
                                      : 'default'
                                  }
                                  sx={{ fontWeight: 700 }}
                                />
                              )}
                            </Stack>
                          ) : (
                            <Typography variant="body1" color="text.secondary">
                              Brak określonego terminu
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>

                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Szacowany czas (Estymacja)
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {formatHumanDuration((task.estimatedMinutes ?? 60) * 60)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Rzeczywisty czas (Poświęcony)
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: task.timeSpentSeconds > (task.estimatedMinutes ?? 60) * 60 ? 'warning.main' : 'success.main' }}>
                          {formatHumanDuration(task.timeSpentSeconds || 0)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Utworzono
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {task.createdAt ? new Date(task.createdAt).toLocaleString('pl-PL') : '—'}
                        </Typography>
                      </Box>
                      {task.completedAt && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Ukończono
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                            {new Date(task.completedAt).toLocaleString('pl-PL')}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Description Card */}
              <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Opis zadania
                  </Typography>
                  {task.description ? (
                    <Typography
                      variant="body1"
                      sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', lineHeight: 1.7 }}
                    >
                      {task.description}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Brak dodatkowego opisu dla tego zadania. Kliknij ikonę edycji, aby dodać szczegóły.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right Column: Time Tracker & Stopwatch */}
          <Grid item xs={12} md={6}>
            <TaskTimeTracker
              taskId={task.id}
              taskTitle={task.title}
              subjectName={task.subject?.name}
              subjectColor={task.subject?.color || '#1976d2'}
              initialTimeSpentSeconds={task.timeSpentSeconds || 0}
              initialTimeEntries={task.timeEntries || []}
              onTimeUpdated={(newTotal) => {
                setTask((prev) => (prev ? { ...prev, timeSpentSeconds: newTotal } : prev));
              }}
            />
          </Grid>
        </Grid>
      </Container>

      {/* Edit Dialog */}
      <TaskFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchTaskData}
        initialTask={task}
        subjects={subjects}
      />
    </Box>
  );
}
