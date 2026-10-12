'use client';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Slider,
  TextField,
  Button,
  Stack,
  Alert,
  Divider,
  CircularProgress,
  Chip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AppNavbar from '@/components/Navigation/AppNavbar';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [importantThreshold, setImportantThreshold] = useState<number>(6);
  const [urgentDays, setUrgentDays] = useState<number>(3);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [meRes, settingsRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/settings'),
        ]);

        if (meRes.ok) {
          const u = await meRes.json();
          setUsername(u.username);
          setRole(u.role);
        }

        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setImportantThreshold(s.importantStoryPointsThreshold);
          setUrgentDays(s.urgentWithinDays);
        }
      } catch {
        setError('Błąd wczytywania ustawień');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importantStoryPointsThreshold: importantThreshold,
          urgentWithinDays: urgentDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Błąd podczas zapisywania ustawień');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Błąd połączenia z serwerem');
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

      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
          Ustawienia aplikacji
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Dostosuj progi automatycznej klasyfikacji w macierzy Eisenhowera oraz zarządzaj swoim kontem.
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(false)}>
            Ustawienia zostały pomyślnie zaktualizowane. Macierz Eisenhowera została przeliczona według nowych progów!
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSave}>
          <Stack spacing={3}>
            {/* Account Card */}
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <PersonOutlineIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Twoje konto
                  </Typography>
                </Stack>
                <Divider sx={{ mb: 2 }} />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Login użytkownika
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {username}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Rola systemowa
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={role === 'ADMIN' ? 'Administrator' : 'Student'}
                        color={role === 'ADMIN' ? 'secondary' : 'default'}
                        size="small"
                      />
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Eisenhower Thresholds Card */}
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <TuneIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Progi macierzy Eisenhowera
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Wartości te decydują o automatycznym przypisywaniu zadań do ćwiartek. Zmiana progów nie unieważnia Twoich wcześniejszych ręcznych nadpisań.
                </Typography>
                <Divider sx={{ mb: 3 }} />

                {/* Important Story Points Threshold */}
                <Box sx={{ mb: 4, p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Próg ważności (Story Points)
                    </Typography>
                    <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
                      ≥ {importantThreshold} SP
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Zadania mające przynajmniej <strong>{importantThreshold} Story Points</strong> zostaną zakwalifikowane jako <strong>Ważne</strong> (ćwiartka Q1 lub Q2). Zadania z mniejszą liczbą punktów trafią do <strong>Nieważnych</strong> (Q3 lub Q4).
                  </Typography>
                  <Slider
                    value={importantThreshold}
                    onChange={(_, val) => setImportantThreshold(val as number)}
                    min={1}
                    max={10}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Box>

                {/* Urgent Within Days Threshold */}
                <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Próg pilności (dni do terminu)
                    </Typography>
                    <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
                      ≤ {urgentDays} dni
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Zadania z terminem oddania w ciągu najbliższych <strong>{urgentDays} dni</strong> (oraz z terminem dzisiaj lub po terminie) są automatycznie klasyfikowane jako <strong>Pilne</strong> (ćwiartka Q1 lub Q3).
                  </Typography>

                  <TextField
                    type="number"
                    label="Liczba dni do terminu"
                    value={urgentDays}
                    onChange={(e) => setUrgentDays(Math.max(0, parseInt(e.target.value) || 0))}
                    inputProps={{ min: 0, max: 365 }}
                    fullWidth
                    sx={{ maxWidth: 220 }}
                  />
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                disabled={submitting}
                sx={{ px: 4 }}
              >
                {submitting ? 'Zapisywanie...' : 'Zapisz ustawienia'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
