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
} from '@mui/material';
import { TaskStatus, PriorityOverride, UrgencyOverride } from '@prisma/client';

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
  const [dueDate, setDueDate] = useState('');
  const [hasDueDate, setHasDueDate] = useState(true);
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
      if (initialTask.dueDate) {
        setHasDueDate(true);
        // Format as YYYY-MM-DD
        const d = new Date(initialTask.dueDate);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setDueDate(`${y}-${m}-${day}`);
      } else {
        setHasDueDate(false);
        setDueDate('');
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
      setTitle('');
      setDescription('');
      setSubjectId(subjects.length > 0 ? subjects[0].id : '');
      setCategoryId('');
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setDueDate(`${y}-${m}-${day}`);
      setHasDueDate(true);
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

    const calcEstimatedMinutes = Math.max(0, (estimatedHours * 60) + estimatedMinutes);

    setLoading(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      subjectId,
      categoryId: categoryId ? categoryId : null,
      dueDate: hasDueDate && dueDate ? new Date(dueDate).toISOString() : null,
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

            {/* Due Date */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Termin oddania
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setHasDueDate(!hasDueDate)}
                >
                  {hasDueDate ? 'Usuń termin (bez terminu)' : 'Ustaw termin'}
                </Button>
              </Stack>

              {hasDueDate ? (
                <TextField
                  type="date"
                  fullWidth
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              ) : (
                <Alert severity="info" variant="outlined">
                  Zadanie bez terminu nie jest uznawane za pilne w macierzy Eisenhowera.
                </Alert>
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

