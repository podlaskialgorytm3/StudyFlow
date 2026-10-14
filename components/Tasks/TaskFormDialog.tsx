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
  FormHelperText,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Grid,
  InputAdornment,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventIcon from '@mui/icons-material/Event';
import { TaskStatus, PriorityOverride, UrgencyOverride } from '@prisma/client';
import { getCalendarDaysRemaining } from '@/lib/domain/eisenhower';

export interface SubjectItem {
  id: string;
  name: string;
  color?: string | null;
  categories: { id: string; name: string }[];
}

export interface TaskItem {
  id: string;
  subjectId: string;
  categoryId?: string | null;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  storyPoints: number;
  status: TaskStatus;
  priorityOverride?: PriorityOverride | null;
  urgencyOverride?: UrgencyOverride | null;
  completedAt?: string | null;
  createdAt?: string | null;
  timeSpentSeconds?: number;
  estimatedMinutes?: number;
  progressPercent?: number;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  subject?: { id: string; name: string; color?: string | null };
  category?: { id: string; name: string } | null;
}

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialTask?: TaskItem | null;
  initialStatus?: TaskStatus;
  subjects: SubjectItem[];
}

function toDatetimeLocalString(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function TaskFormDialog({
  open,
  onClose,
  onSaved,
  initialTask,
  initialStatus,
  subjects,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [daysUntilDue, setDaysUntilDue] = useState<string>('');
  const [scheduleInCalendar, setScheduleInCalendar] = useState<boolean>(false);
  const [storyPoints, setStoryPoints] = useState<number>(3);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.NEW);
  const [priorityOverride, setPriorityOverride] = useState<string>('AUTO');
  const [urgencyOverride, setUrgencyOverride] = useState<string>('AUTO');
  const [estimatedHours, setEstimatedHours] = useState<number>(1);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description || '');
      setSubjectId(initialTask.subjectId);
      setCategoryId(initialTask.categoryId || '');
      
      if (initialTask.startDate) {
        setStartDate(toDatetimeLocalString(initialTask.startDate));
        setScheduleInCalendar(true);
      } else {
        setStartDate('');
        setScheduleInCalendar(false);
      }

      if (initialTask.dueDate) {
        setDueDate(toDatetimeLocalString(initialTask.dueDate));
        const rem = getCalendarDaysRemaining(initialTask.dueDate);
        setDaysUntilDue(rem !== null ? String(Math.max(0, rem)) : '');
      } else {
        setDueDate('');
        setDaysUntilDue('');
      }

      setStoryPoints(initialTask.storyPoints);
      setStatus(initialTask.status);
      setPriorityOverride(initialTask.priorityOverride || 'AUTO');
      setUrgencyOverride(initialTask.urgencyOverride || 'AUTO');
      const totalEst = initialTask.estimatedMinutes !== undefined && initialTask.estimatedMinutes !== null ? initialTask.estimatedMinutes : 60;
      setEstimatedHours(Math.floor(totalEst / 60));
      setEstimatedMinutes(totalEst % 60);
      setProgressPercent(initialTask.progressPercent ?? (initialTask.status === TaskStatus.DONE ? 100 : 0));
    } else {
      // Domyślnie dla każdego nowego zadania puste terminy
      setTitle('');
      setDescription('');
      setSubjectId(subjects.length > 0 ? subjects[0].id : '');
      setCategoryId('');
      setStartDate('');
      setDueDate('');
      setDaysUntilDue('');
      setScheduleInCalendar(false);
      setStoryPoints(3);
      setStatus(initialStatus || TaskStatus.NEW);
      setPriorityOverride('AUTO');
      setUrgencyOverride('AUTO');
      setEstimatedHours(1);
      setEstimatedMinutes(0);
      setProgressPercent(initialStatus === TaskStatus.DONE ? 100 : 0);
    }
    setError(null);
  }, [initialTask, initialStatus, open, subjects]);

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const availableCategories = selectedSubject?.categories || [];

  const handleDaysUntilDueChange = (valStr: string) => {
    setDaysUntilDue(valStr);
    if (valStr.trim() === '') {
      setDueDate('');
      return;
    }
    const days = parseInt(valStr, 10);
    if (!isNaN(days) && days >= 0) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      // Domyślnie zawsze do północy (23:59)
      targetDate.setHours(23, 59, 0, 0);
      setDueDate(toDatetimeLocalString(targetDate.toISOString()));
    }
  };

  const handleDueDateChange = (newVal: string) => {
    let adjustedVal = newVal;
    // Jeśli nie planujemy w kalendarzu, a użytkownik wybrał datę (lub przeglądarka ustawiła 00:00),
    // domyślnie ustawiamy termin do północy (23:59)
    if (!scheduleInCalendar && adjustedVal) {
      if (adjustedVal.endsWith('T00:00')) {
        adjustedVal = adjustedVal.replace('T00:00', 'T23:59');
      }
    }
    setDueDate(adjustedVal);
    if (!adjustedVal) {
      setDaysUntilDue('');
    } else {
      const rem = getCalendarDaysRemaining(adjustedVal);
      setDaysUntilDue(rem !== null ? String(Math.max(0, rem)) : '');
    }
  };

  const applyDaysPreset = (days: number | null) => {
    if (days === null) {
      setDueDate('');
      setDaysUntilDue('');
      if (!scheduleInCalendar) {
        setStartDate('');
      }
    } else {
      handleDaysUntilDueChange(String(days));
    }
  };

  const handleToggleScheduleInCalendar = (checked: boolean) => {
    setScheduleInCalendar(checked);
    if (checked) {
      if (!startDate) {
        if (dueDate) {
          const d = new Date(dueDate);
          const s = new Date(d.getTime() - 60 * 60 * 1000);
          setStartDate(toDatetimeLocalString(s.toISOString()));
        } else {
          const now = new Date();
          now.setMinutes(0, 0, 0);
          now.setHours(now.getHours() + 1);
          setStartDate(toDatetimeLocalString(now.toISOString()));
          const end = new Date(now.getTime() + 60 * 60 * 1000);
          setDueDate(toDatetimeLocalString(end.toISOString()));
          const rem = getCalendarDaysRemaining(end);
          setDaysUntilDue(rem !== null ? String(Math.max(0, rem)) : '');
        }
      }
    } else {
      setStartDate('');
      // Po wyłączeniu kalendarza termin przechodzi na domyślny deadline do północy (23:59)
      if (dueDate) {
        const d = new Date(dueDate);
        d.setHours(23, 59, 0, 0);
        setDueDate(toDatetimeLocalString(d.toISOString()));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Tytuł zadania jest wymagany');
      return;
    }
    if (!subjectId) {
      setError('Wybierz przedmiot');
      return;
    }

    if (scheduleInCalendar && startDate && dueDate) {
      if (new Date(dueDate).getTime() < new Date(startDate).getTime()) {
        setError('Termin zakończenia w kalendarzu nie może być wcześniejszy niż data rozpoczęcia');
        return;
      }
    }

    const calcEstimatedMinutes = Math.max(0, (estimatedHours * 60) + estimatedMinutes);

    setLoading(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      subjectId,
      categoryId: categoryId ? categoryId : null,
      startDate: scheduleInCalendar && startDate ? new Date(startDate).toISOString() : null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      storyPoints,
      status,
      priorityOverride: priorityOverride === 'AUTO' ? null : priorityOverride,
      urgencyOverride: urgencyOverride === 'AUTO' ? null : urgencyOverride,
      estimatedMinutes: calcEstimatedMinutes,
      progressPercent,
    };

    try {
      const url = initialTask ? `/api/tasks/${initialTask.id}` : '/api/tasks';
      const method = initialTask ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Wystąpił błąd podczas zapisywania zadania');
        setLoading(false);
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initialTask ? 'Edytuj zadanie' : 'Nowe zadanie akademickie'}
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Tytuł zadania"
              required
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Kolokwium z analizy matematycznej"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth required>
                <InputLabel>Przedmiot</InputLabel>
                <Select
                  value={subjectId}
                  label="Przedmiot"
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setCategoryId(''); // Reset category on subject change
                  }}
                >
                  {subjects.map((sub) => (
                    <MenuItem key={sub.id} value={sub.id}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: sub.color || '#1976d2',
                          }}
                        />
                        <span>{sub.name}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
                {subjects.length === 0 && (
                  <FormHelperText error>Najpierw dodaj przynajmniej jeden przedmiot!</FormHelperText>
                )}
              </FormControl>

              <FormControl fullWidth disabled={availableCategories.length === 0}>
                <InputLabel>Kategoria (opcjonalnie)</InputLabel>
                <Select
                  value={categoryId}
                  label="Kategoria (opcjonalnie)"
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
            </Stack>

            {/* Story Points */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Story Points (1–10)
                </Typography>
                <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>
                  {storyPoints} SP
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Określa złożoność i wagę zadania. Wpływa bezpośrednio na próg ważności w macierzy.
              </Typography>
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

            {/* Estimated Time (Hours & Minutes) */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Szacowany czas wykonania (Estymacja)
                </Typography>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                  {estimatedHours > 0 ? `${estimatedHours} godz. ` : ''}{estimatedMinutes} min
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Określ orientacyjną liczbę godzin i minut potrzebnych do zrealizowania zadania.
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Godziny"
                  type="number"
                  fullWidth
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Math.max(0, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 0, max: 999 }}
                  size="small"
                />
                <TextField
                  label="Minuty"
                  type="number"
                  fullWidth
                  value={estimatedMinutes}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setEstimatedMinutes(Math.min(59, val));
                  }}
                  inputProps={{ min: 0, max: 59 }}
                  size="small"
                />
              </Stack>
            </Box>

            {/* Progress Percent Slider */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Postęp realizacji zadania
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: progressPercent === 100 ? 'success.main' : progressPercent > 0 ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {progressPercent}%
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Określ procent ukończenia zadania (od 0% do 100%).
              </Typography>
              <Slider
                value={progressPercent}
                onChange={(_, val) => {
                  const num = val as number;
                  setProgressPercent(num);
                  if (num === 100) {
                    setStatus(TaskStatus.DONE);
                  } else if (status === TaskStatus.DONE && num < 100) {
                    setStatus(TaskStatus.IN_PROGRESS);
                  }
                }}
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                  { value: 75, label: '75%' },
                  { value: 100, label: '100%' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            {/* Termin zadania (Deadline) & opcjonalny kalendarz */}
            <Box
              sx={{
                p: 2,
                bgcolor: '#f8fafc',
                borderRadius: 2,
                border: '1px solid #e2e8f0',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarMonthIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    Termin wykonania (Deadline)
                  </Typography>
                </Stack>
                {(dueDate || daysUntilDue || startDate) && (
                  <Button
                    size="small"
                    variant="text"
                    color="secondary"
                    onClick={() => applyDaysPreset(null)}
                    sx={{ textTransform: 'none', py: 0, fontSize: '0.8rem' }}
                  >
                    Wyczyść termin (bez terminu)
                  </Button>
                )}
              </Stack>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={7}>
                  <TextField
                    label="Termin zakończenia (deadline)"
                    type="datetime-local"
                    fullWidth
                    size="small"
                    value={dueDate}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    helperText={
                      dueDate
                        ? 'Domyślnie termin do północy (23:59)'
                        : 'Domyślnie brak terminu (zadanie niepilne)'
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label="Ile dni na zakończenie"
                    type="number"
                    size="small"
                    fullWidth
                    value={daysUntilDue}
                    onChange={(e) => handleDaysUntilDueChange(e.target.value)}
                    placeholder="Domyślnie puste"
                    InputProps={{
                      inputProps: { min: 0 },
                      endAdornment: <InputAdornment position="end">dni</InputAdornment>,
                    }}
                    helperText={
                      daysUntilDue !== ''
                        ? Number(daysUntilDue) === 0
                          ? 'Termin przypada dzisiaj'
                          : `Deadline za ${daysUntilDue} ${Number(daysUntilDue) === 1 ? 'dzień' : 'dni'}`
                        : 'Liczba dni od dzisiaj'
                    }
                  />
                </Grid>
              </Grid>

              {/* Szybki wybór liczby dni */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5, gap: 0.75, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Szybki wybór:
                </Typography>
                {[
                  { label: 'Dzisiaj', days: 0 },
                  { label: 'Jutro', days: 1 },
                  { label: 'Za 3 dni', days: 3 },
                  { label: 'Za tydzień (7 dni)', days: 7 },
                  { label: 'Za 2 tyg. (14 dni)', days: 14 },
                ].map((preset) => {
                  const isSelected = daysUntilDue === String(preset.days);
                  return (
                    <Chip
                      key={preset.days}
                      label={preset.label}
                      size="small"
                      variant={isSelected ? 'filled' : 'outlined'}
                      color={isSelected ? 'primary' : 'default'}
                      onClick={() => applyDaysPreset(preset.days)}
                      clickable
                      sx={{
                        fontSize: '0.75rem',
                        height: 24,
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    />
                  );
                })}
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Opcja: Zaplanuj konkretny czas w kalendarzu */}
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleInCalendar}
                    onChange={(e) => handleToggleScheduleInCalendar(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Ustaw konkretne godziny w kalendarzu
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Opcjonalnie: zablokuj przedział czasowy (od - do) w kalendarzu
                    </Typography>
                  </Box>
                }
              />

              {scheduleInCalendar && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px dashed #cbd5e1' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Data i godzina rozpoczęcia"
                      type="datetime-local"
                      fullWidth
                      size="small"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText="Początek pracy / bloku w kalendarzu"
                    />
                    <TextField
                      label="Data i godzina zakończenia"
                      type="datetime-local"
                      fullWidth
                      size="small"
                      value={dueDate}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText="Koniec pracy / bloku w kalendarzu"
                    />
                  </Stack>
                </Box>
              )}
            </Box>

            {/* Status */}
            <FormControl fullWidth>
              <InputLabel>Status zadania</InputLabel>
              <Select
                value={status}
                label="Status zadania"
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <MenuItem value={TaskStatus.NEW}>Nowe (NEW)</MenuItem>
                <MenuItem value={TaskStatus.TODO}>Do zrobienia (TODO)</MenuItem>
                <MenuItem value={TaskStatus.IN_PROGRESS}>W trakcie (IN_PROGRESS)</MenuItem>
                <MenuItem value={TaskStatus.DONE}>Ukończone (DONE)</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            {/* Manual Classification Overrides */}
            <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Ręczne nadpisanie macierzy Eisenhowera
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Domyślnie aplikacja wylicza ćwiartkę automatycznie. Możesz wymusić konkretną ważność lub pilność.
              </Typography>

              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Ważność (Importance):
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    value={priorityOverride}
                    onChange={(_, val) => val && setPriorityOverride(val)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="AUTO">Automatycznie (SP)</ToggleButton>
                    <ToggleButton value={PriorityOverride.IMPORTANT} color="primary">
                      Ważne
                    </ToggleButton>
                    <ToggleButton value={PriorityOverride.NOT_IMPORTANT} color="standard">
                      Nieważne
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Pilność (Urgency):
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    value={urgencyOverride}
                    onChange={(_, val) => val && setUrgencyOverride(val)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="AUTO">Automatycznie (Dni)</ToggleButton>
                    <ToggleButton value={UrgencyOverride.URGENT} color="error">
                      Pilne
                    </ToggleButton>
                    <ToggleButton value={UrgencyOverride.NOT_URGENT} color="standard">
                      Niepilne
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Stack>
            </Box>

            <TextField
              label="Opis zadania (opcjonalny)"
              multiline
              rows={3}
              fullWidth
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dodatkowe notatki, zakres materiału..."
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={loading} color="inherit">
            Anuluj
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Zapisywanie...' : initialTask ? 'Zapisz zmiany' : 'Utwórz zadanie'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

