'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider,
  Chip,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  LinearProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddTaskIcon from '@mui/icons-material/AddTask';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import HistoryIcon from '@mui/icons-material/History';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SchoolIcon from '@mui/icons-material/School';
import { formatDigitalTime, formatHumanDuration } from '@/lib/utils/formatTime';

export interface TaskTimeEntryItem {
  id: string;
  taskId: string;
  durationSeconds: number;
  note?: string | null;
  createdAt: string | Date;
}

interface TaskTimeTrackerProps {
  taskId: string;
  taskTitle?: string;
  subjectName?: string;
  subjectColor?: string;
  initialTimeSpentSeconds?: number;
  initialTimeEntries?: TaskTimeEntryItem[];
  initialProgressPercent?: number;
  onTimeUpdated?: (newTotalSeconds: number, newProgressPercent?: number) => void;
}

export default function TaskTimeTracker({
  taskId,
  taskTitle,
  subjectName,
  subjectColor = '#1976d2',
  initialTimeSpentSeconds = 0,
  initialTimeEntries = [],
  initialProgressPercent = 0,
  onTimeUpdated,
}: TaskTimeTrackerProps) {
  // Total logged time & entries history
  const [totalSeconds, setTotalSeconds] = useState<number>(initialTimeSpentSeconds);
  const [entries, setEntries] = useState<TaskTimeEntryItem[]>(initialTimeEntries);
  const [progressPercent, setProgressPercent] = useState<number>(initialProgressPercent);

  // Active stopwatch state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [saveProgress, setSaveProgress] = useState<number>(initialProgressPercent);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualHours, setManualHours] = useState<number>(0);
  const [manualMinutes, setManualMinutes] = useState<number>(15);
  const [manualNote, setManualNote] = useState('');
  const [manualProgress, setManualProgress] = useState<number>(initialProgressPercent);

  // Fullscreen Focus Mode state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isFullscreen]);

  // Local storage synchronization for persistent active session
  useEffect(() => {
    const storageKey = `studyflow_stopwatch_${taskId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.seconds === 'number') {
          setTimerSeconds(parsed.seconds);
        }
      } catch {
        // ignore storage parse error
      }
    }
  }, [taskId]);

  useEffect(() => {
    const storageKey = `studyflow_stopwatch_${taskId}`;
    if (timerSeconds > 0) {
      localStorage.setItem(storageKey, JSON.stringify({ seconds: timerSeconds }));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [taskId, timerSeconds]);

  // Stopwatch ticking
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  // Handlers for Stopwatch
  const handleStart = () => {
    setIsRunning(true);
    setError(null);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
  };

  const handleReset = () => {
    if (timerSeconds > 0 && !window.confirm('Czy na pewno chcesz zresetować bieżący stoper bez zapisywania?')) {
      return;
    }
    setIsRunning(false);
    setTimerSeconds(0);
    localStorage.removeItem(`studyflow_stopwatch_${taskId}`);
  };

  const handleOpenSaveDialog = () => {
    setIsRunning(false);
    setSaveNote('');
    setSaveProgress(progressPercent);
    setSaveDialogOpen(true);
  };

  const handleSaveTimerSession = async () => {
    if (timerSeconds <= 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: timerSeconds,
          note: saveNote.trim() || undefined,
          progressPercent: saveProgress,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Błąd podczas zapisywania sesji czasu');
      } else {
        setTotalSeconds(data.timeSpentSeconds);
        if (typeof data.progressPercent === 'number') {
          setProgressPercent(data.progressPercent);
        }
        setEntries((prev) => [data.entry, ...prev]);
        setSuccessMsg(`Zapisano sesję: ${formatHumanDuration(timerSeconds)} (Postęp: ${saveProgress}%)`);
        setTimerSeconds(0);
        localStorage.removeItem(`studyflow_stopwatch_${taskId}`);
        setSaveDialogOpen(false);
        if (onTimeUpdated) {
          onTimeUpdated(data.timeSpentSeconds, data.progressPercent);
        }
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const duration = (manualHours * 60 + manualMinutes) * 60;
    if (duration <= 0) {
      setError('Wprowadź czas trwania większy niż 0');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: duration,
          note: manualNote.trim() || undefined,
          progressPercent: manualProgress,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Błąd podczas odnotowywania czasu');
      } else {
        setTotalSeconds(data.timeSpentSeconds);
        if (typeof data.progressPercent === 'number') {
          setProgressPercent(data.progressPercent);
        }
        setEntries((prev) => [data.entry, ...prev]);
        setSuccessMsg(`Odnotowano czas: ${formatHumanDuration(duration)} (Postęp: ${manualProgress}%)`);
        setManualDialogOpen(false);
        setManualHours(0);
        setManualMinutes(15);
        setManualNote('');
        if (onTimeUpdated) {
          onTimeUpdated(data.timeSpentSeconds, data.progressPercent);
        }
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten wpis czasu?')) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/time/${entryId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setTotalSeconds(data.timeSpentSeconds);
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        setSuccessMsg('Wpis czasu został usunięty');
        if (onTimeUpdated) {
          onTimeUpdated(data.timeSpentSeconds);
        }
      } else {
        setError(data.error || 'Błąd usuwania wpisu');
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    }
  };

  return (
    <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{ mb: 2.5 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'primary.50',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AccessTimeIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Pomiar czasu zadania
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                Stoper do śledzenia i zapisywania sesji nauki
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexShrink={0} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<FullscreenIcon fontSize="small" />}
              onClick={handleToggleFullscreen}
              sx={{
                whiteSpace: 'nowrap',
                fontWeight: 600,
                borderColor: '#cbd5e1',
                color: 'text.primary',
                px: 1.5,
                py: 0.75,
                '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
              }}
            >
              Pełny ekran
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<MoreTimeIcon fontSize="small" />}
              onClick={() => setManualDialogOpen(true)}
              sx={{
                whiteSpace: 'nowrap',
                fontWeight: 600,
                px: 1.5,
                py: 0.75,
              }}
            >
              Odnotuj czas ręcznie
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        )}

        {/* Stopwatch Main Area */}
        <Box
          sx={{
            position: 'relative',
            p: 3,
            bgcolor: isRunning ? '#f0fdf4' : '#f8fafc',
            border: isRunning ? '2px solid #86efac' : '1px solid #e2e8f0',
            borderRadius: 3,
            textAlign: 'center',
            transition: 'all 0.3s ease',
            mb: 3,
          }}
        >
          {/* Quick Fullscreen Button in Corner */}
          <Tooltip title="Przełącz na pełny ekran (Tryb skupienia)">
            <IconButton
              size="small"
              onClick={handleToggleFullscreen}
              sx={{
                position: 'absolute',
                right: 12,
                top: 12,
                bgcolor: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid #e2e8f0',
                '&:hover': { bgcolor: 'white' },
              }}
            >
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {isRunning && (
            <Chip
              label="Stoper aktywny — pomiar czasu w toku..."
              color="success"
              size="small"
              sx={{ fontWeight: 700, mb: 1.5, animation: 'pulse 1.5s infinite' }}
            />
          )}

          {/* Digital Time Display */}
          <Typography
            variant="h2"
            component="div"
            sx={{
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: 2,
              color: isRunning ? '#15803d' : '#1e293b',
              fontSize: { xs: '2.5rem', sm: '3.5rem' },
              my: 1,
            }}
          >
            {formatDigitalTime(timerSeconds)}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Bieżąca sesja: <strong>{formatHumanDuration(timerSeconds)}</strong>
          </Typography>

          {/* Stopwatch Controls */}
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap">
            {!isRunning && timerSeconds === 0 && (
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={handleStart}
                sx={{ px: 4, py: 1.2, fontWeight: 700, borderRadius: 2 }}
              >
                Zacznij mierzyć czas
              </Button>
            )}

            {isRunning && (
              <>
                <Button
                  variant="outlined"
                  color="warning"
                  size="large"
                  startIcon={<PauseIcon />}
                  onClick={handlePause}
                  sx={{ px: 3, fontWeight: 700, borderRadius: 2 }}
                >
                  Wstrzymaj (Pauza)
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<StopIcon />}
                  onClick={handleOpenSaveDialog}
                  sx={{ px: 3, fontWeight: 700, borderRadius: 2 }}
                >
                  Zakończ i zapisz czas
                </Button>
              </>
            )}

            {!isRunning && timerSeconds > 0 && (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleResume}
                  sx={{ px: 3, fontWeight: 700, borderRadius: 2 }}
                >
                  Wznów pomiar
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<AddTaskIcon />}
                  onClick={handleOpenSaveDialog}
                  sx={{ px: 3, fontWeight: 700, borderRadius: 2 }}
                >
                  Zapisz czas sesji
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  size="large"
                  startIcon={<RestartAltIcon />}
                  onClick={handleReset}
                  sx={{ px: 2, borderRadius: 2 }}
                >
                  Zresetuj
                </Button>
              </>
            )}
          </Stack>
        </Box>

        {/* Total Time & Progress Summary Card */}
        <Box
          sx={{
            p: 2.5,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            mb: 3,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Łączny czas poświęcony na to zadanie
              </Typography>
              <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
                {formatHumanDuration(totalSeconds)}
              </Typography>
            </Box>

            <Box sx={{ minWidth: { sm: 220 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Aktualny postęp zadania
                </Typography>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 800,
                    color: progressPercent === 100 ? 'success.main' : 'primary.main',
                  }}
                >
                  {progressPercent}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                color={progressPercent === 100 ? 'success' : 'primary'}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Chip
              label={`${entries.length} ${entries.length === 1 ? 'zapisana sesja' : entries.length > 1 && entries.length < 5 ? 'zapisane sesje' : 'zapisanych sesji'}`}
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600, alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          </Stack>
        </Box>

        {/* Logged Sessions History */}
        {entries.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <HistoryIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Historia zarejestrowanych sesji czasu
              </Typography>
            </Stack>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Data i godzina</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Czas trwania</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notatka / opis</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Akcja</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell sx={{ fontSize: '0.82rem' }}>
                        {new Date(entry.createdAt).toLocaleString('pl-PL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {formatHumanDuration(entry.durationSeconds)}
                      </TableCell>
                      <TableCell sx={{ color: entry.note ? 'text.primary' : 'text.secondary', fontSize: '0.82rem' }}>
                        {entry.note || '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Usuń ten wpis">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Dialog for saving stopwatch session */}
        <Dialog
          open={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          maxWidth="xs"
          fullWidth
          sx={{ zIndex: 1400 }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Zapisz czas sesji</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Zmierzony czas do zapisania:
                </Typography>
                <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
                  {formatHumanDuration(timerSeconds)}
                </Typography>
              </Box>

              {/* Progress Slider */}
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Postęp zadania po tej sesji
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      color: saveProgress === 100 ? 'success.main' : 'primary.main',
                    }}
                  >
                    {saveProgress}%
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Ile procent zadania udało się zrealizować?
                </Typography>
                <Slider
                  value={saveProgress}
                  onChange={(_, val) => setSaveProgress(val as number)}
                  min={0}
                  max={100}
                  step={5}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 50, label: '50%' },
                    { value: 100, label: '100%' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>

              <TextField
                label="Notatka (opcjonalnie)"
                placeholder="np. Nauka teorii, rozwiązywanie zadań..."
                value={saveNote}
                onChange={(e) => setSaveNote(e.target.value)}
                multiline
                rows={2}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setSaveDialogOpen(false)} color="inherit" disabled={submitting}>
              Anuluj
            </Button>
            <Button
              onClick={handleSaveTimerSession}
              variant="contained"
              color="success"
              disabled={submitting}
            >
              {submitting ? 'Zapisywanie...' : 'Zapisz czas i postęp'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog for manual time logging */}
        <Dialog
          open={manualDialogOpen}
          onClose={() => setManualDialogOpen(false)}
          maxWidth="xs"
          fullWidth
          sx={{ zIndex: 1400 }}
        >
          <Box component="form" onSubmit={handleSaveManual}>
            <DialogTitle sx={{ fontWeight: 700 }}>Odnotuj czas ręcznie</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Wpisz ile czasu spędziłeś nad tym zadaniem poza aplikacją oraz zaktualizuj postęp.
                </Typography>

                <Stack direction="row" spacing={2}>
                  <TextField
                    type="number"
                    label="Godziny"
                    value={manualHours}
                    onChange={(e) => setManualHours(Math.max(0, parseInt(e.target.value) || 0))}
                    inputProps={{ min: 0, max: 24 }}
                    fullWidth
                  />
                  <TextField
                    type="number"
                    label="Minuty"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    inputProps={{ min: 0, max: 59 }}
                    fullWidth
                  />
                </Stack>

                {/* Manual Progress Slider */}
                <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Postęp zadania
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        color: manualProgress === 100 ? 'success.main' : 'primary.main',
                      }}
                    >
                      {manualProgress}%
                    </Typography>
                  </Stack>
                  <Slider
                    value={manualProgress}
                    onChange={(_, val) => setManualProgress(val as number)}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Box>

                <TextField
                  label="Notatka (opcjonalnie)"
                  placeholder="np. Praca nad projektem w bibliotece"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setManualDialogOpen(false)} color="inherit" disabled={submitting}>
                Anuluj
              </Button>
              <Button type="submit" variant="contained" color="primary" disabled={submitting}>
                {submitting ? 'Zapisywanie...' : 'Dodaj wpis i postęp'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        {/* Fullscreen Focus Mode Dialog */}
        <Dialog
          fullScreen
          open={isFullscreen}
          onClose={handleToggleFullscreen}
          sx={{
            zIndex: 1300,
            '& .MuiDialog-paper': {
              bgcolor: '#090e17',
              color: '#f8fafc',
              backgroundImage: `radial-gradient(circle at 50% 30%, ${subjectColor}28 0%, #090e17 75%)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              p: { xs: 3, sm: 6 },
            },
          }}
        >
          {/* Fullscreen Top Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {subjectName && (
                <Chip
                  icon={<SchoolIcon sx={{ fontSize: '1rem !important', color: 'inherit !important' }} />}
                  label={subjectName}
                  sx={{
                    bgcolor: subjectColor,
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}
                />
              )}
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                {taskTitle || 'Zadanie'}
              </Typography>
            </Stack>

            <Button
              variant="outlined"
              color="inherit"
              startIcon={<FullscreenExitIcon />}
              onClick={handleToggleFullscreen}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.25)',
                color: '#f8fafc',
                fontWeight: 600,
                borderRadius: 2,
                '&:hover': {
                  borderColor: '#ffffff',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Wyjdź z pełnego ekranu (Esc)
            </Button>
          </Stack>

          {/* Fullscreen Main Center Area */}
          <Box sx={{ textAlign: 'center', my: 'auto', py: 4 }}>
            {isRunning ? (
              <Chip
                label="TRYB SKUPIENIA — POMIAR CZASU W TOKU"
                color="success"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 2,
                  px: 2.5,
                  py: 2,
                  fontSize: '0.85rem',
                  mb: 3,
                  animation: 'pulse 1.5s infinite',
                }}
              />
            ) : timerSeconds > 0 ? (
              <Chip
                label="POMIAR WSTRZYMANY (PAUZA)"
                color="warning"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 2,
                  px: 2.5,
                  py: 2,
                  fontSize: '0.85rem',
                  mb: 3,
                }}
              />
            ) : (
              <Chip
                label="TRYB SKUPIENIA — GOTOWY DO ROZPOCZĘCIA"
                variant="outlined"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 2,
                  px: 2.5,
                  py: 2,
                  fontSize: '0.85rem',
                  mb: 3,
                  color: '#94a3b8',
                  borderColor: '#475569',
                }}
              />
            )}

            {/* Giant Digital Stopwatch Clock */}
            <Typography
              variant="h1"
              component="div"
              sx={{
                fontWeight: 900,
                fontFamily: 'monospace',
                letterSpacing: { xs: 4, sm: 8, md: 12 },
                fontSize: { xs: '3.6rem', sm: '7rem', md: '9.5rem' },
                color: isRunning ? '#4ade80' : timerSeconds > 0 ? '#fde047' : '#f8fafc',
                textShadow: isRunning ? '0 0 50px rgba(74, 222, 128, 0.4)' : 'none',
                lineHeight: 1.1,
                my: 2,
              }}
            >
              {formatDigitalTime(timerSeconds)}
            </Typography>

            <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 500, mb: 5 }}>
              Czas bieżącej sesji:{' '}
              <strong style={{ color: '#ffffff', fontWeight: 800 }}>
                {formatHumanDuration(timerSeconds)}
              </strong>
            </Typography>

            {/* Huge Controls in Fullscreen */}
            <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
              {!isRunning && timerSeconds === 0 && (
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<PlayArrowIcon sx={{ fontSize: '2.2rem !important' }} />}
                  onClick={handleStart}
                  sx={{
                    px: 6,
                    py: 2,
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    borderRadius: 3,
                    boxShadow: '0 8px 30px rgba(25, 118, 210, 0.5)',
                  }}
                >
                  Zacznij mierzyć czas
                </Button>
              )}

              {isRunning && (
                <>
                  <Button
                    variant="outlined"
                    color="warning"
                    size="large"
                    startIcon={<PauseIcon sx={{ fontSize: '1.8rem !important' }} />}
                    onClick={handlePause}
                    sx={{
                      px: 4.5,
                      py: 1.8,
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      borderRadius: 3,
                      bgcolor: 'rgba(237, 108, 2, 0.15)',
                      borderColor: '#ed6c02',
                    }}
                  >
                    Wstrzymaj (Pauza)
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<StopIcon sx={{ fontSize: '1.8rem !important' }} />}
                    onClick={handleOpenSaveDialog}
                    sx={{
                      px: 5.5,
                      py: 1.8,
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      borderRadius: 3,
                      boxShadow: '0 8px 30px rgba(46, 125, 50, 0.5)',
                    }}
                  >
                    Zakończ i zapisz czas
                  </Button>
                </>
              )}

              {!isRunning && timerSeconds > 0 && (
                <>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<PlayArrowIcon sx={{ fontSize: '1.8rem !important' }} />}
                    onClick={handleResume}
                    sx={{
                      px: 4.5,
                      py: 1.8,
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      borderRadius: 3,
                    }}
                  >
                    Wznów pomiar
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<AddTaskIcon sx={{ fontSize: '1.8rem !important' }} />}
                    onClick={handleOpenSaveDialog}
                    sx={{
                      px: 4.5,
                      py: 1.8,
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      borderRadius: 3,
                    }}
                  >
                    Zapisz czas sesji
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="large"
                    startIcon={<RestartAltIcon />}
                    onClick={handleReset}
                    sx={{
                      px: 3.5,
                      py: 1.8,
                      fontSize: '1.05rem',
                      borderRadius: 3,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    Zresetuj
                  </Button>
                </>
              )}
            </Stack>
          </Box>

          {/* Fullscreen Bottom Footer */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems="center"
            spacing={1.5}
            sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              Łączny czas poświęcony na to zadanie:{' '}
              <strong style={{ color: '#ffffff' }}>{formatHumanDuration(totalSeconds)}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Naciśnij <strong>Esc</strong> na klawiaturze lub kliknij przycisk, aby wyjść z pełnego ekranu
            </Typography>
          </Stack>
        </Dialog>
      </CardContent>
    </Card>
  );
}

