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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import PaletteIcon from '@mui/icons-material/Palette';
import SchoolIcon from '@mui/icons-material/School';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Link from 'next/link';

import AppNavbar from '@/components/Navigation/AppNavbar';

interface SubjectWithCounts {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  categories: { id: string; name: string }[];
  _count: {
    tasks: number;
    categories: number;
  };
}

export const COLOR_PALETTE = [
  // Niebieskie & Cyjan
  { hex: '#2563eb', label: 'Klasyczny błękit' },
  { hex: '#0284c7', label: 'Morski' },
  { hex: '#0891b2', label: 'Cyjan' },
  { hex: '#06b6d4', label: 'Lazurowy' },

  // Fiolety & Indygo
  { hex: '#4f46e5', label: 'Indygo' },
  { hex: '#7c3aed', label: 'Fiolet' },
  { hex: '#9333ea', label: 'Purpura' },
  { hex: '#c026d3', label: 'Fuksja' },

  // Zielenie & Mięta
  { hex: '#059669', label: 'Szmaragd' },
  { hex: '#16a34a', label: 'Zieleń leśna' },
  { hex: '#65a30d', label: 'Limonka' },
  { hex: '#0d9488', label: 'Ciemny turkus' },

  // Ciepłe (Żółte, Pomarańcze, Czerwienie)
  { hex: '#d97706', label: 'Bursztyn' },
  { hex: '#ea580c', label: 'Pomarańcz' },
  { hex: '#dc2626', label: 'Czerwień' },
  { hex: '#e11d48', label: 'Koralowy' },

  // Róż & Pastele & Neutralne
  { hex: '#db2777', label: 'Róż' },
  { hex: '#475569', label: 'Stalowy' },
  { hex: '#0f766e', label: 'Morska zieleń' },
  { hex: '#78350f', label: 'Karmel' },
];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  // Subject Form Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectWithCounts | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectWithCounts | null>(null);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setName('');
    setColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setDescription('');
    setFormError(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (subject: SubjectWithCounts, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubject(subject);
    setName(subject.name);
    setColor(subject.color || '#2563eb');
    setDescription(subject.description || '');
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Nazwa przedmiotu jest wymagana');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      name: name.trim(),
      color,
      description: description.trim() || null,
    };

    try {
      const url = editingSubject ? `/api/subjects/${editingSubject.id}` : '/api/subjects';
      const method = editingSubject ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Błąd zapisu przedmiotu');
        setSubmitting(false);
        return;
      }

      setDialogOpen(false);
      fetchSubjects();
    } catch {
      setFormError('Błąd połączenia');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/subjects/${subjectToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteDialogOpen(false);
        setSubjectToDelete(null);
        fetchSubjects();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
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
              Twoje przedmioty
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organizuj przedmioty akademickie, ich kategorie oraz powiązane zadania.
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
          >
            Dodaj przedmiot
          </Button>
        </Stack>

        {/* Grid of Subjects */}
        {subjects.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center' }}>
            <SchoolIcon color="disabled" sx={{ fontSize: 56, mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Nie dodałeś jeszcze żadnego przedmiotu
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Dodaj swój pierwszy przedmiot akademicki (np. Analiza Matematyczna, Fizyka, Bazy Danych).
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
              Dodaj pierwszy przedmiot
            </Button>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {subjects.map((sub) => (
              <Grid item xs={12} sm={6} md={4} key={sub.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease-in-out',
                    borderTop: `4px solid ${sub.color || '#2563eb'}`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                        {sub.name}
                      </Typography>

                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => handleOpenEdit(sub, e)}
                          title="Edytuj"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubjectToDelete(sub);
                            setDeleteDialogOpen(true);
                          }}
                          title="Usuń"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>

                    {sub.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {sub.description}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Chip
                        label={`${sub._count.tasks} zadań`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip
                        label={`${sub._count.categories} kategorii`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </Stack>
                  </CardContent>

                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button
                      component={Link}
                      href={`/subjects/${sub.id}`}
                      fullWidth
                      variant="text"
                      endIcon={<ChevronRightIcon />}
                      sx={{ justifyContent: 'space-between', fontWeight: 700 }}
                    >
                      Szczegóły i kategorie
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Subject Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingSubject ? 'Edytuj przedmiot' : 'Nowy przedmiot'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveSubject}>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              {formError && <Alert severity="error">{formError}</Alert>}

              <TextField
                label="Nazwa przedmiotu"
                required
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Architektura Komputerów"
              />

              {/* Color Palette Selector */}
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PaletteIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Paleta barw przedmiotu
                    </Typography>
                  </Stack>

                  {/* Active Selected Color Preview */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        bgcolor: color,
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                    />
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {color}
                    </Typography>
                  </Stack>
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Wybierz jeden z gotowych odcieni lub wpisz własny kod koloru HEX:
                </Typography>

                {/* Swatches Grid */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(5, 1fr)', sm: 'repeat(10, 1fr)' },
                    gap: 1.25,
                    mb: 2,
                  }}
                >
                  {COLOR_PALETTE.map((c) => {
                    const isSelected = color.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <Tooltip key={c.hex} title={`${c.label} (${c.hex})`} arrow>
                        <Box
                          onClick={() => setColor(c.hex)}
                          sx={{
                            aspectRatio: '1',
                            borderRadius: '50%',
                            bgcolor: c.hex,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                            border: isSelected ? '3px solid #0f172a' : '2px solid rgba(255,255,255,0.8)',
                            boxShadow: isSelected
                              ? `0 0 0 2px ${c.hex}, 0 4px 10px rgba(0,0,0,0.2)`
                              : '0 1px 3px rgba(0,0,0,0.12)',
                            transform: isSelected ? 'scale(1.15)' : 'none',
                            '&:hover': {
                              transform: 'scale(1.15)',
                              boxShadow: '0 3px 8px rgba(0,0,0,0.18)',
                            },
                          }}
                        >
                          {isSelected && <CheckIcon sx={{ color: '#fff', fontSize: 16, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>

                {/* Custom Color Input & Native Color Picker */}
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    component="input"
                    type="color"
                    value={color.startsWith('#') && color.length === 7 ? color : '#2563eb'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
                    sx={{
                      width: 40,
                      height: 40,
                      p: 0,
                      border: '1px solid #cbd5e1',
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      bgcolor: 'transparent',
                      '&::-webkit-color-swatch-wrapper': { p: 0.5 },
                      '&::-webkit-color-swatch': { borderRadius: 1, border: 'none' },
                    }}
                    title="Wybierz dowolny kolor za pomocą próbnika"
                  />
                  <TextField
                    size="small"
                    label="Własny kod HEX"
                    placeholder="#2563eb"
                    value={color}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setColor(val);
                    }}
                    inputProps={{ maxLength: 7 }}
                    sx={{ width: 160 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Możesz też wybrać dowolny odcień z koła barw obok.
                  </Typography>
                </Stack>
              </Box>

              <TextField
                label="Opis przedmiotu (opcjonalny)"
                multiline
                rows={3}
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="np. Prowadzący, sala, wymagania zaliczenia..."
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={submitting}>
              Anuluj
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Zapisywanie...' : editingSubject ? 'Zapisz zmiany' : 'Utwórz'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Cascading Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>
          Usuwanie przedmiotu
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" gutterBottom>
            Czy na pewno chcesz usunąć przedmiot <strong>{subjectToDelete?.name}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <strong>Uwaga:</strong> Usunięcie przedmiotu spowoduje kaskadowe usunięcie wszystkich powiązanych z nim{' '}
            <strong>kategorii ({subjectToDelete?._count.categories})</strong> oraz{' '}
            <strong>zadań ({subjectToDelete?._count.tasks})</strong>! Tej operacji nie można cofnąć.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" disabled={submitting}>
            Anuluj
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error" disabled={submitting}>
            {submitting ? 'Usuwanie...' : 'Usuń bezpowrotnie'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

