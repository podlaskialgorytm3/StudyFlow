'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  IconButton,
  Chip,
  Alert,
  Fade,
  CircularProgress,
  Tooltip,
  Paper,
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import StarIcon from '@mui/icons-material/Star';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';

import { TaskItem } from '@/components/Tasks/TaskFormDialog';
import { EisenhowerSettings, classifyEisenhowerTask } from '@/lib/domain/eisenhower';
import { selectFocusTopTasks } from '@/lib/domain/focusMode';
import { formatHumanDuration } from '@/lib/utils/formatTime';
import { TaskStatus } from '@prisma/client';

interface FocusModeViewProps {
  tasks: TaskItem[];
  settings: EisenhowerSettings;
  onClose: () => void;
  onOpenTaskDetail: (task: TaskItem) => void;
  onRefreshData: () => Promise<void> | void;
}

export default function FocusModeView({
  tasks,
  settings,
  onClose,
  onOpenTaskDetail,
  onRefreshData,
}: FocusModeViewProps) {
  const [skippedTaskIds, setSkippedTaskIds] = useState<string[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; severity: 'success' | 'info' | 'error' } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monitor fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  // Compute TOP 3 tasks dynamically
  const topTasks = useMemo(() => {
    return selectFocusTopTasks(tasks, settings, skippedTaskIds);
  }, [tasks, settings, skippedTaskIds]);

  // Current formatted date in Polish
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Toggle fullscreen mode
  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Browser denied or does not support fullscreen; gracefully ignore
    }
  };

  // Mark task as completed
  const handleCompleteTask = async (task: TaskItem) => {
    setCompletingTaskId(task.id);
    setNotification(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: TaskStatus.DONE }),
      });

      if (res.ok) {
        setNotification({
          text: `Brawo! Ukończono zadanie: „${task.title}”. Kolejne zadanie czeka na Ciebie!`,
          severity: 'success',
        });
        await onRefreshData();
      } else {
        const data = await res.json();
        setNotification({
          text: data.error || 'Nie udało się zaktualizować statusu zadania.',
          severity: 'error',
        });
      }
    } catch {
      setNotification({
        text: 'Błąd połączenia z serwerem podczas zapisywania.',
        severity: 'error',
      });
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Skip task for today
  const handleSkipTask = (task: TaskItem) => {
    setSkippedTaskIds((prev) => [...prev, task.id]);
    setNotification({
      text: `Pominięto „${task.title}” w tej sesji. Zaktualizowano rekomendacje.`,
      severity: 'info',
    });
  };

  // Reset skipped tasks
  const handleResetSkipped = () => {
    setSkippedTaskIds([]);
    setNotification(null);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        bgcolor: '#f8fafc',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Distraction-free Action Bar */}
      <Box
        sx={{
          py: 2,
          px: { xs: 2, md: 4 },
          bgcolor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Container maxWidth="md">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            {/* Left: Focus mode logo & active status */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  bgcolor: '#4f46e5',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                }}
              >
                <CenterFocusStrongIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
                  StudyFlow Focus
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                  {todayFormatted}
                </Typography>
              </Box>
            </Stack>

            {/* Right: Fullscreen & Exit buttons */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Tooltip title={isFullscreen ? 'Opuść pełny ekran' : 'Pełny ekran (F11)'}>
                <IconButton
                  onClick={handleToggleFullscreen}
                  size="small"
                  sx={{
                    border: '1px solid #e2e8f0',
                    bgcolor: '#f8fafc',
                    '&:hover': { bgcolor: '#f1f5f9' },
                  }}
                  aria-label="Przełącz pełny ekran"
                >
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>

              <Button
                variant="outlined"
                color="inherit"
                startIcon={<CloseIcon />}
                onClick={onClose}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  borderRadius: 2,
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  bgcolor: '#ffffff',
                  '&:hover': {
                    borderColor: '#94a3b8',
                    bgcolor: '#f1f5f9',
                  },
                }}
              >
                Wyłącz tryb skupienia
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Main Focus Content Container */}
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Title, Slogan & Counter */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Chip
            icon={<CenterFocusStrongIcon sx={{ fontSize: '1rem !important' }} />}
            label="TRYB SKUPIENIA"
            size="small"
            sx={{
              bgcolor: alpha('#4f46e5', 0.1),
              color: '#4f46e5',
              fontWeight: 800,
              fontSize: '0.75rem',
              mb: 1.5,
              border: `1px solid ${alpha('#4f46e5', 0.2)}`,
            }}
          />

          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: -1,
              mb: 1,
              fontSize: { xs: '2rem', md: '2.75rem' },
            }}
          >
            Skup się na tym, co najważniejsze
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 500,
              mx: 'auto',
              fontSize: { xs: '0.95rem', md: '1.05rem' },
            }}
          >
            {topTasks.length > 0
              ? `Twój plan na dziś — ${topTasks.length} ${topTasks.length === 1 ? 'zadanie' : topTasks.length < 5 ? 'zadania' : 'zadań'}. Zacznij od pierwszego, a resztę zrób po kolei.`
              : 'Wszystkie zadania na dziś ukończone lub brak aktywnych zadań.'}
          </Typography>
        </Box>

        {/* Transient notification */}
        {notification && (
          <Fade in>
            <Alert
              severity={notification.severity}
              onClose={() => setNotification(null)}
              sx={{ mb: 3, borderRadius: 2 }}
            >
              {notification.text}
            </Alert>
          </Fade>
        )}

        {/* Task Cards or Empty State */}
        {topTasks.length === 0 ? (
          // Empty / All Completed Celebration View
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              textAlign: 'center',
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              maxWidth: 600,
              mx: 'auto',
              my: 'auto',
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 48 }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
              Wszystko zrobione! 🎉
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {skippedTaskIds.length > 0
                ? 'Wszystkie aktualne rekomendacje zostały ukończone. Masz również zadania pominięte w tej sesji.'
                : 'Nie masz obecnie zaległych ani zaplanowanych zadań do zrobienia na dziś. Czas na przerwę lub zaplanowanie nowych celów.'}
            </Typography>

            <Stack direction="row" spacing={2} justifyContent="center">
              {skippedTaskIds.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleResetSkipped}
                  sx={{ fontWeight: 700 }}
                >
                  Przywróć pominięte ({skippedTaskIds.length})
                </Button>
              )}

              <Button
                variant="contained"
                onClick={onClose}
                sx={{
                  bgcolor: '#4f46e5',
                  '&:hover': { bgcolor: '#4338ca' },
                  fontWeight: 700,
                  px: 3,
                }}
              >
                Wróć do dashboardu
              </Button>
            </Stack>
          </Paper>
        ) : (
          // TOP 3 Tasks Stack
          <Stack spacing={3}>
            {topTasks.map((task, index) => {
              const isFirst = index === 0;
              const classification = classifyEisenhowerTask(task, settings);
              const isBusy = completingTaskId === task.id;
              const subjectColor = task.subject?.color || '#1976d2';

              return (
                <Card
                  key={task.id}
                  elevation={0}
                  sx={{
                    borderRadius: 3.5,
                    border: isFirst ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    bgcolor: isFirst ? '#ffffff' : '#ffffff',
                    boxShadow: isFirst
                      ? '0 12px 30px rgba(99, 102, 241, 0.12)'
                      : '0 2px 8px rgba(0,0,0,0.03)',
                    position: 'relative',
                    transition: 'all 0.25s ease',
                    overflow: 'visible',
                    '&:hover': {
                      boxShadow: isFirst
                        ? '0 16px 36px rgba(99, 102, 241, 0.18)'
                        : '0 6px 16px rgba(0,0,0,0.06)',
                      borderColor: isFirst ? '#4f46e5' : '#cbd5e1',
                    },
                  }}
                >
                  {/* Top Badge for #1 "ZACZNIJ OD TEGO" */}
                  {isFirst && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -14,
                        left: 24,
                        bgcolor: '#4f46e5',
                        color: '#ffffff',
                        px: 1.75,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                      }}
                    >
                      <StarIcon sx={{ fontSize: 14 }} />
                      ZACZNIJ OD TEGO
                    </Box>
                  )}

                  <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, pt: isFirst ? { xs: 3.5, md: 4 } : { xs: 2.5, md: 3.5 } }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      spacing={2.5}
                    >
                      {/* Left: Task Info */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Subject & Category Badge */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: subjectColor,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              color: 'text.secondary',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {task.subject?.name || 'Przedmiot'}
                            {task.category ? ` • ${task.category.name}` : ''}
                          </Typography>

                          {!isFirst && (
                            <Chip
                              label={`KROK ${index + 1}`}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                bgcolor: '#f1f5f9',
                                color: '#64748b',
                              }}
                            />
                          )}
                        </Stack>

                        {/* Title */}
                        <Typography
                          variant={isFirst ? 'h5' : 'h6'}
                          component="h2"
                          sx={{
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.3,
                            mb: 1.5,
                            wordBreak: 'break-word',
                          }}
                        >
                          {task.title}
                        </Typography>

                        {/* Metadata Pills: Due Date, Estimated Time, Story Points */}
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                          {task.dueDate ? (
                            <Chip
                              icon={<AccessTimeIcon sx={{ fontSize: '0.9rem !important' }} />}
                              label={
                                classification.isOverdue
                                  ? `${Math.abs(classification.daysRemaining || 0)}d po terminie!`
                                  : classification.isDueToday
                                  ? 'Termin: Dzisiaj!'
                                  : `Termin: za ${classification.daysRemaining} dni`
                              }
                              size="small"
                              color={classification.isOverdue ? 'error' : classification.isDueToday ? 'warning' : 'default'}
                              variant={classification.isOverdue || classification.isDueToday ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 700, height: 26 }}
                            />
                          ) : (
                            <Chip
                              label="Bez terminu"
                              size="small"
                              variant="outlined"
                              sx={{ color: 'text.disabled', height: 26 }}
                            />
                          )}

                          <Chip
                            icon={<HourglassEmptyIcon sx={{ fontSize: '0.9rem !important' }} />}
                            label={formatHumanDuration((task.estimatedMinutes ?? 60) * 60)}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 600, height: 26 }}
                          />

                          <Chip
                            label={`${task.storyPoints} SP`}
                            size="small"
                            sx={{
                              bgcolor: alpha('#4f46e5', 0.08),
                              color: '#4f46e5',
                              fontWeight: 700,
                              height: 26,
                            }}
                          />

                          <Chip
                            label={task.status === TaskStatus.IN_PROGRESS ? 'W trakcie' : 'Do zrobienia'}
                            size="small"
                            color={task.status === TaskStatus.IN_PROGRESS ? 'primary' : 'default'}
                            variant="outlined"
                            sx={{ fontWeight: 600, height: 26 }}
                          />
                        </Stack>
                      </Box>

                      {/* Right: Focused Action Buttons */}
                      <Stack
                        direction={{ xs: 'row', sm: 'row' }}
                        spacing={1.5}
                        alignItems="center"
                        flexWrap="wrap"
                        sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}
                      >
                        {/* Start / Continue Button */}
                        <Button
                          component={Link}
                          href={`/tasks/${task.id}`}
                          variant={isFirst ? 'contained' : 'outlined'}
                          color="primary"
                          startIcon={<PlayArrowIcon />}
                          sx={{
                            fontWeight: 800,
                            px: isFirst ? 2.5 : 2,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: isFirst ? '#4f46e5' : undefined,
                            '&:hover': {
                              bgcolor: isFirst ? '#4338ca' : undefined,
                            },
                          }}
                        >
                          {task.status === TaskStatus.IN_PROGRESS ? 'Kontynuuj' : 'Rozpocznij'}
                        </Button>

                        {/* Complete Button */}
                        <Button
                          variant="contained"
                          color="success"
                          disabled={isBusy}
                          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon />}
                          onClick={() => handleCompleteTask(task)}
                          sx={{
                            fontWeight: 700,
                            px: 2,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: '#10b981',
                            '&:hover': { bgcolor: '#059669' },
                          }}
                        >
                          Ukończ
                        </Button>

                        {/* Quick details button */}
                        <Tooltip title="Podgląd szczegółów">
                          <IconButton
                            size="small"
                            onClick={() => onOpenTaskDetail(task)}
                            sx={{
                              border: '1px solid #e2e8f0',
                              borderRadius: 2,
                              p: 1,
                              '&:hover': { bgcolor: '#f1f5f9' },
                            }}
                            aria-label="Podgląd zadania"
                          >
                            <OpenInNewIcon fontSize="small" color="action" />
                          </IconButton>
                        </Tooltip>

                        {/* Skip for today button */}
                        <Tooltip title="Pomiń to zadanie na dziś i pokaż kolejne">
                          <IconButton
                            size="small"
                            onClick={() => handleSkipTask(task)}
                            sx={{
                              border: '1px solid #e2e8f0',
                              borderRadius: 2,
                              p: 1,
                              '&:hover': { bgcolor: '#f1f5f9' },
                            }}
                            aria-label="Pomiń zadanie na dziś"
                          >
                            <SkipNextIcon fontSize="small" color="action" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}

        {/* Skipped tasks notification bar at bottom */}
        {skippedTaskIds.length > 0 && topTasks.length > 0 && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Pominięto {skippedTaskIds.length} {skippedTaskIds.length === 1 ? 'zadanie' : 'zadań'} w tej sesji.{' '}
              <Button
                size="small"
                variant="text"
                onClick={handleResetSkipped}
                sx={{ p: 0, minWidth: 'auto', fontSize: '0.75rem', fontWeight: 700 }}
              >
                Przywróć pominięte
              </Button>
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
