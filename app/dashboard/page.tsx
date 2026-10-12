'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Grid,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Chip,
  CircularProgress,
  Fab,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SchoolIcon from '@mui/icons-material/School';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventIcon from '@mui/icons-material/Event';
import Link from 'next/link';

import AppNavbar from '@/components/Navigation/AppNavbar';
import EisenhowerMatrix from '@/components/Eisenhower/EisenhowerMatrix';
import TaskFormDialog, { TaskItem, SubjectItem } from '@/components/Tasks/TaskFormDialog';
import TaskDetailDialog from '@/components/Tasks/TaskDetailDialog';
import { EisenhowerSettings } from '@/lib/domain/eisenhower';
import { TaskStatus } from '@prisma/client';

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [settings, setSettings] = useState<EisenhowerSettings>({
    importantStoryPointsThreshold: 6,
    urgentWithinDays: 3,
  });
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);

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

  // Statistics
  const activeTasks = tasks.filter((t) => t.status !== TaskStatus.DONE);

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const dueTodayOrOverdueTasks = activeTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
    const diff = Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
    return diff <= 0;
  });

  // Upcoming 5 active deadlines
  const upcomingDeadlines = activeTasks
    .filter((t) => Boolean(t.dueDate))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  const handleOpenNew = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const handleEditFromDetail = (task: TaskItem) => {
    setDetailTask(null);
    setEditingTask(task);
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 10 }}>
      <AppNavbar />

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Welcome & Action Bar */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
              Twój Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Przeglądaj zadania na macierzy Eisenhowera i kontroluj zbliżające się terminy.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              component={Link}
              href="/subjects"
              variant="outlined"
              color="primary"
              startIcon={<SchoolIcon />}
            >
              Przedmioty
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenNew}
              sx={{ px: 2.5 }}
            >
              Dodaj zadanie
            </Button>
          </Stack>
        </Stack>

        {/* 4 Summary Stats Cards */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {/* Active Tasks */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      AKTYWNE ZADANIA
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {activeTasks.length}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: 2, color: 'primary.main' }}>
                    <CheckCircleOutlineIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Due Today / Overdue */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      DZIŚ LUB PO TERMINIE
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 800,
                        mt: 0.5,
                        color: dueTodayOrOverdueTasks.length > 0 ? 'error.main' : 'text.primary',
                      }}
                    >
                      {dueTodayOrOverdueTasks.length}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: dueTodayOrOverdueTasks.length > 0 ? '#fef2f2' : '#f8fafc',
                      borderRadius: 2,
                      color: dueTodayOrOverdueTasks.length > 0 ? 'error.main' : 'text.secondary',
                    }}
                  >
                    <WarningAmberIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Subjects Count */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      PRZEDMIOTY
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {subjects.length}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#faf5ff', borderRadius: 2, color: 'secondary.main' }}>
                    <SchoolIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Nearest deadline */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box sx={{ minWidth: 0, pr: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      NAJBLIŻSZY TERMIN
                    </Typography>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 800,
                        mt: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {upcomingDeadlines.length > 0 ? upcomingDeadlines[0].title : 'Brak terminów'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {upcomingDeadlines.length > 0 && upcomingDeadlines[0].dueDate
                        ? new Date(upcomingDeadlines[0].dueDate).toLocaleDateString('pl-PL')
                        : 'Wszystko zaplanowane'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, color: 'success.main' }}>
                    <EventIcon fontSize="medium" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Main Content Area: Matrix & Upcoming List */}
        <Grid container spacing={3}>
          {/* Eisenhower Matrix */}
          <Grid item xs={12} lg={9}>
            <EisenhowerMatrix
              tasks={tasks}
              subjects={subjects}
              settings={settings}
              onSelectTask={(task) => setDetailTask(task)}
            />
          </Grid>

          {/* Upcoming Deadlines Widget */}
          <Grid item xs={12} lg={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Najbliższe terminy
                  </Typography>
                  <Button component={Link} href="/tasks" size="small">
                    Wszystkie
                  </Button>
                </Stack>

                {upcomingDeadlines.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    Brak nadchodzących terminów
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {upcomingDeadlines.map((t) => {
                      const due = new Date(t.dueDate!);
                      const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
                      const diff = Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));

                      return (
                        <Box
                          key={t.id}
                          onClick={() => setDetailTask(t)}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: '#f1f5f9',
                              borderColor: 'primary.main',
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {t.title}
                          </Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t.subject?.name}
                            </Typography>
                            <Chip
                              size="small"
                              label={diff < 0 ? `${Math.abs(diff)}d temu` : diff === 0 ? 'Dziś' : `za ${diff}d`}
                              color={diff < 0 ? 'error' : diff === 0 ? 'warning' : 'default'}
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                            />
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Floating Action Button for Mobile */}
      <Tooltip title="Dodaj zadanie">
        <Fab
          color="primary"
          aria-label="Dodaj zadanie"
          onClick={handleOpenNew}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: { xs: 'flex', md: 'none' },
          }}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

      {/* Dialogs */}
      <TaskFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchData}
        initialTask={editingTask}
        subjects={subjects}
      />

      <TaskDetailDialog
        open={Boolean(detailTask)}
        task={detailTask}
        settings={settings}
        onClose={() => setDetailTask(null)}
        onEdit={handleEditFromDetail}
        onRefresh={fetchData}
      />
    </Box>
  );
}
