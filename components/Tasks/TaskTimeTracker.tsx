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
  initialTimeSpentSeconds?: number;
  initialTimeEntries?: TaskTimeEntryItem[];
  onTimeUpdated?: (newTotalSeconds: number) => void;
}

export default function TaskTimeTracker({
  taskId,
  initialTimeSpentSeconds = 0,
  initialTimeEntries = [],
  onTimeUpdated,
}: TaskTimeTrackerProps) {
  // Total logged time & entries history
  const [totalSeconds, setTotalSeconds] = useState<number>(initialTimeSpentSeconds);
  const [entries, setEntries] = useState<TaskTimeEntryItem[]>(initialTimeEntries);

  // Active stopwatch state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualHours, setManualHours] = useState<number>(0);
  const [manualMinutes, setManualMinutes] = useState<number>(15);
  const [manualNote, setManualNote] = useState('');

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Błąd podczas zapisywania sesji czasu');
      } else {
        setTotalSeconds(data.timeSpentSeconds);
        setEntries((prev) => [data.entry, ...prev]);
        setSuccessMsg(`Zapisano sesję: ${formatHumanDuration(timerSeconds)}`);
        setTimerSeconds(0);
        localStorage.removeItem(`studyflow_stopwatch_${taskId}`);
        setSaveDialogOpen(false);
        if (onTimeUpdated) {
          onTimeUpdated(data.timeSpentSeconds);
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Błąd podczas odnotowywania czasu');
      } else {
        setTotalSeconds(data.timeSpentSeconds);
        setEntries((prev) => [data.entry, ...prev]);
        setSuccessMsg(`Odnotowano czas: ${formatHumanDuration(duration)}`);
        setManualDialogOpen(false);
        setManualHours(0);
        setManualMinutes(15);
        setManualNote('');
        if (onTimeUpdated) {
          onTimeUpdated(data.timeSpentSeconds);
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
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AccessTimeIcon color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Pomiar czasu zadania
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Opcjonalny stoper do śledzenia i zapisywania czasu poświęconego na to zadanie.
              </Typography>
            </Box>
          </Stack>

          <Button
            size="small"
            variant="outlined"
            startIcon={<MoreTimeIcon />}
            onClick={() => setManualDialogOpen(true)}
          >
            Odnotuj czas ręcznie
          </Button>
        </Stack>

        <Divider sx={{ mb: 3 }} />

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
            p: 3,
            bgcolor: isRunning ? '#f0fdf4' : '#f8fafc',
            border: isRunning ? '2px solid #86efac' : '1px solid #e2e8f0',
            borderRadius: 3,
            textAlign: 'center',
            transition: 'all 0.3s ease',
            mb: 3,
          }}
        >
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

        {/* Total Time Summary Card */}
        <Box
          sx={{
            p: 2,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { sm: 'center' },
            gap: 1.5,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Łączny czas poświęcony na to zadanie
            </Typography>
            <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
              {formatHumanDuration(totalSeconds)}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`${entries.length} ${entries.length === 1 ? 'zapisana sesja' : entries.length > 1 && entries.length < 5 ? 'zapisane sesje' : 'zapisanych sesji'}`}
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600 }}
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
        <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Zapisz czas sesji</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Zmierzony czas do zapisania:
                </Typography>
                <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
                  {formatHumanDuration(timerSeconds)}
                </Typography>
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
              {submitting ? 'Zapisywanie...' : 'Zapisz czas'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog for manual time logging */}
        <Dialog open={manualDialogOpen} onClose={() => setManualDialogOpen(false)} maxWidth="xs" fullWidth>
          <Box component="form" onSubmit={handleSaveManual}>
            <DialogTitle sx={{ fontWeight: 700 }}>Odnotuj czas ręcznie</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Wpisz ile czasu spędziłeś nad tym zadaniem poza aplikacją.
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
                {submitting ? 'Zapisywanie...' : 'Dodaj wpis'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </CardContent>
    </Card>
  );
}
