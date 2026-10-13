'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Slider,
  Typography,
  Box,
  Alert,
  Chip,
  FormControlLabel,
  Switch,
  CircularProgress,
} from '@mui/material';
import AddTaskIcon from '@mui/icons-material/AddTask';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { SubjectItem } from '@/components/Tasks/TaskFormDialog';

interface CreateCalendarTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialDate?: Date | null;
  googleConnected?: boolean;
}

function formatDateToInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function CreateCalendarTaskDialog({
  open,
  onClose,
  onSaved,
  initialDate,
  googleConnected = false,
}: CreateCalendarTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [dueDateTime, setDueDateTime] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [storyPoints, setStoryPoints] = useState(3);
  const [description, setDescription] = useState('');
  const [sendToGoogle, setSendToGoogle] = useState(googleConnected);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when opening
  useEffect(() => {
    if (open) {
      setError(null);
      setTitle('');
      setDescription('');
      setStoryPoints(3);
      setEstimatedMinutes(60);
      setSendToGoogle(googleConnected);

      const startDate = initialDate ? new Date(initialDate) : new Date();
      if (!initialDate) {
        startDate.setMinutes(0, 0, 0);
        startDate.setHours(startDate.getHours() + 1);
      }
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      setStartDateTime(formatDateToInput(startDate));
      setDueDateTime(formatDateToInput(endDate));

      // Fetch subjects
      setLoadingSubjects(true);
      fetch('/api/subjects')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSubjects(data);
            if (data.length > 0 && !subjectId) {
              setSubjectId(data[0].id);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSubjects(false));
    }
  }, [open, initialDate, googleConnected]);

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const availableCategories = selectedSubject?.categories || [];

  const handleStartDateChange = (val: string) => {
    setStartDateTime(val);
    if (val) {
      const s = new Date(val);
      if (!isNaN(s.getTime())) {
        const newEnd = new Date(s.getTime() + estimatedMinutes * 60 * 1000);
        setDueDateTime(formatDateToInput(newEnd));
      }
    }
  };

  const handleDueDateChange = (val: string) => {
    setDueDateTime(val);
    if (val && startDateTime) {
      const s = new Date(startDateTime);
      const e = new Date(val);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e.getTime() > s.getTime()) {
        const diffMins = Math.round((e.getTime() - s.getTime()) / 60000);
        setEstimatedMinutes(diffMins);
      }
    }
  };

  const handleDurationSelect = (mins: number) => {
    setEstimatedMinutes(mins);
    if (startDateTime) {
      const s = new Date(startDateTime);
      if (!isNaN(s.getTime())) {
        const newEnd = new Date(s.getTime() + mins * 60 * 1000);
        setDueDateTime(formatDateToInput(newEnd));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Wprowadź tytuł zadania');
      return;
    }
    if (!subjectId) {
      setError('Wybierz przedmiot');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create task in StudyFlow with start and end times
      const taskRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subjectId,
          categoryId: categoryId || null,
          startDate: startDateTime ? new Date(startDateTime).toISOString() : null,
          dueDate: dueDateTime ? new Date(dueDateTime).toISOString() : null,
          storyPoints,
          estimatedMinutes,
          description: description.trim() || null,
        }),
      });

      const taskData = await taskRes.json();
      if (!taskRes.ok) {
        throw new Error(taskData.error || 'Nie udało się utworzyć zadania');
      }

      // 2. If sendToGoogle is checked, export to Google Calendar
      if (sendToGoogle && (startDateTime || dueDateTime) && taskData.id) {
        try {
          const gRes = await fetch(`/api/tasks/${taskData.id}/google-calendar`, {
            method: 'POST',
          });
          const gData = await gRes.json();
          if (!gRes.ok) {
            console.warn('Google calendar export notice:', gData.error);
          }
        } catch {
          // Task was already created in StudyFlow
        }
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AddTaskIcon color="primary" />
          Dodaj zadanie do kalendarza
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Task Title */}
            <TextField
              label="Tytuł zadania *"
              placeholder="np. Przygotowanie do kolokwium, Zadania domowe..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              size="small"
              required
              autoFocus
            />

            {/* Subject & Category */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Przedmiot *</InputLabel>
                <Select
                  label="Przedmiot *"
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setCategoryId('');
                  }}
                  disabled={loadingSubjects || subjects.length === 0}
                >
                  {subjects.map((sub) => (
                    <MenuItem key={sub.id} value={sub.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: sub.color || '#1976d2',
                          }}
                        />
                        <span>{sub.name}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {availableCategories.length > 0 && (
                <FormControl fullWidth size="small">
                  <InputLabel>Kategoria</InputLabel>
                  <Select
                    label="Kategoria"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Brak kategorii</em>
                    </MenuItem>
                    {availableCategories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>

            {/* Date and Time (Start & End) */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTimeIcon fontSize="small" color="primary" />
                Data i godzina w kalendarzu
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  type="datetime-local"
                  label="Data i godzina rozpoczęcia *"
                  value={startDateTime}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  InputLabelProps={{ shrink: true }}
                />

                <TextField
                  type="datetime-local"
                  label="Data i godzina zakończenia (termin)"
                  value={dueDateTime}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 700 }}>
                Szybki wybór czasu trwania ({estimatedMinutes} min):
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {[15, 30, 45, 60, 90, 120, 180].map((mins) => (
                  <Chip
                    key={mins}
                    label={mins >= 60 ? `${mins / 60} godz.` : `${mins} min`}
                    onClick={() => handleDurationSelect(mins)}
                    color={estimatedMinutes === mins ? 'primary' : 'default'}
                    variant={estimatedMinutes === mins ? 'filled' : 'outlined'}
                    clickable
                    size="small"
                  />
                ))}
              </Stack>
            </Box>

            {/* Story Points */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Waga zadania (Story Points)
                </Typography>
                <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>
                  {storyPoints} SP
                </Typography>
              </Stack>
              <Slider
                value={storyPoints}
                onChange={(_, val) => setStoryPoints(val as number)}
                min={1}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>

            {/* Description */}
            <TextField
              label="Opis zadania (opcjonalnie)"
              placeholder="Dodatkowe informacje, notatki, linki..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2.5}
              fullWidth
              size="small"
            />

            {/* Push to Google Calendar Toggle */}
            {googleConnected && (
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: sendToGoogle ? 'rgba(66, 133, 244, 0.08)' : '#f8fafc',
                  borderRadius: 2,
                  border: sendToGoogle ? '1px solid #4285F4' : '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={sendToGoogle}
                      onChange={(e) => setSendToGoogle(e.target.checked)}
                      sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4285F4' } }}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CalendarMonthIcon sx={{ color: '#4285F4', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Prześlij również do Google Calendar
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Wydarzenie pojawi się na Twoim koncie Google Calendar
                        </Typography>
                      </Box>
                    </Stack>
                  }
                />
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button onClick={onClose} color="inherit" disabled={submitting}>
            Anuluj
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <AddTaskIcon />}
            disabled={submitting || !title.trim() || !subjectId}
            sx={{ fontWeight: 700 }}
          >
            {submitting ? 'Dodawanie...' : 'Zapisz i dodaj do kalendarza'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
