'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import AppNavbar from '@/components/Navigation/AppNavbar';
import { formatHumanDuration } from '@/lib/utils/formatTime';

interface WeeklyReportItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  status: 'GENERATING' | 'READY' | 'FAILED';
  summary?: any;
  error?: string | null;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<WeeklyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom week generation dialog
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      } else {
        setError('Błąd podczas pobierania listy raportów');
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Generate for current week
  const handleGenerateCurrentWeek = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRegenerate: true }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Pomyślnie wygenerowano raport za bieżący tydzień!');
        await fetchReports();
      } else {
        setError(data.error || 'Nie udało się wygenerować raportu.');
      }
    } catch {
      setError('Błąd połączenia podczas generowania raportu.');
    } finally {
      setGenerating(false);
    }
  };

  // Generate for custom week
  const handleGenerateCustomWeek = async () => {
    if (!customDate) return;
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    setCustomDialogOpen(false);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: customDate, forceRegenerate: true }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Pomyślnie wygenerowano raport dla wybranego tygodnia!');
        await fetchReports();
      } else {
        setError(data.error || 'Nie udało się wygenerować raportu.');
      }
    } catch {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate existing report
  const handleRegenerateReport = async (report: WeeklyReportItem) => {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: report.weekStart, forceRegenerate: true }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Raport został pomyślnie odświeżony!');
        await fetchReports();
      } else {
        setError(data.error || 'Błąd odświeżania raportu.');
      }
    } catch {
      setError('Błąd połączenia.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 10 }}>
      <AppNavbar />

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Welcome & Action Bar */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.5,
                  bgcolor: '#4f46e5',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                }}
              >
                <AssessmentIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  Raporty tygodniowe PDF
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Automatyczne podsumowania postępów generowane w każdą niedzielę o 22:00.
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Button
              variant="outlined"
              color="primary"
              startIcon={<CalendarMonthIcon />}
              onClick={() => setCustomDialogOpen(true)}
              disabled={generating}
              sx={{ fontWeight: 700 }}
            >
              Generuj za wybrany tydzień
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={handleGenerateCurrentWeek}
              disabled={generating}
              sx={{
                bgcolor: '#4f46e5',
                '&:hover': { bgcolor: '#4338ca' },
                fontWeight: 700,
                px: 2.5,
              }}
            >
              {generating ? 'Generowanie...' : 'Generuj za bieżący tydzień'}
            </Button>
          </Stack>
        </Stack>

        {/* Schedule & Information Callout Banner */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            border: '1px solid #e0e7ff',
            bgcolor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <InfoOutlinedIcon color="primary" sx={{ mt: 0.25 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                  Harmonogram generowania: Niedziela, godz. 22:00 (strefa Europe/Warsaw)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Każdy raport podsumowuje wykonane zadania, sesje zarejestrowane stoperem, zadania w toku, zaległości oraz rekomendowany plan na nadchodzący tydzień. Dokumenty PDF można pobrać w każdej chwili.
                </Typography>
              </Box>
            </Stack>

            <Chip
              icon={<CheckCircleIcon />}
              label="Automatyczny harmonogram aktywny"
              color="success"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
          </Stack>
        </Paper>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        )}

        {/* Reports History Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : reports.length === 0 ? (
          // Empty State
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              textAlign: 'center',
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              maxWidth: 580,
              mx: 'auto',
              mt: 4,
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: '#eef2ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <AssessmentIcon sx={{ fontSize: 36 }} />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
              Brak wygenerowanych raportów
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Twój pierwszy raport wygeneruje się automatycznie w najbliższą niedzielę o 22:00, lub możesz wygenerować go ręcznie już teraz za pomocą poniższego przycisku.
            </Typography>

            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleGenerateCurrentWeek}
              disabled={generating}
              sx={{
                bgcolor: '#4f46e5',
                '&:hover': { bgcolor: '#4338ca' },
                fontWeight: 700,
                px: 3,
              }}
            >
              Wygeneruj pierwszy raport tygodniowy
            </Button>
          </Paper>
        ) : (
          // List of Generated Reports
          <Stack spacing={2.5}>
            {reports.map((report) => {
              const startFormatted = new Date(report.weekStart).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              const endFormatted = new Date(report.weekEnd).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              const genFormatted = new Date(report.generatedAt).toLocaleString('pl-PL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const summary = report.summary;
              const stats = summary?.stats;

              return (
                <Card
                  key={report.id}
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                      borderColor: '#cbd5e1',
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      spacing={2}
                    >
                      {/* Left: Info & Period */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Chip
                            label={report.status === 'READY' ? 'GOTOWY DO POBRANIA' : report.status === 'GENERATING' ? 'GENEROWANIE...' : 'BŁĄD GENEROWANIA'}
                            color={report.status === 'READY' ? 'success' : report.status === 'GENERATING' ? 'info' : 'error'}
                            size="small"
                            sx={{ fontWeight: 800, fontSize: '0.68rem', height: 22 }}
                          />

                          <Typography variant="caption" color="text.secondary">
                            Wygenerowano: {genFormatted}
                          </Typography>
                        </Stack>

                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                          Tydzień: {startFormatted} — {endFormatted}
                        </Typography>

                        {/* Metric highlights if ready */}
                        {stats && (
                          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 1 }}>
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} />}
                              label={`${stats.completedCount} ukończonych zadań`}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontWeight: 700 }}
                            />

                            <Chip
                              icon={<AccessTimeIcon sx={{ fontSize: '0.85rem !important' }} />}
                              label={`Czas: ${stats.formattedStudyTime}`}
                              size="small"
                              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
                            />

                            <Chip
                              label={`${stats.inProgressCount} w toku`}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />

                            {stats.overdueCount > 0 && (
                              <Chip
                                label={`${stats.overdueCount} zaległości`}
                                size="small"
                                color="error"
                                sx={{ fontWeight: 700 }}
                              />
                            )}

                            <Chip
                              label={`Realizacja planu: ${stats.completionRatePercent}%`}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />
                          </Stack>
                        )}

                        {report.error && (
                          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                            Błąd: {report.error}
                          </Typography>
                        )}
                      </Box>

                      {/* Right: Actions */}
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {report.status === 'READY' && (
                          <Button
                            component="a"
                            href={`/api/reports/${report.id}/download`}
                            download
                            variant="contained"
                            color="primary"
                            startIcon={<DownloadIcon />}
                            sx={{
                              bgcolor: '#4f46e5',
                              '&:hover': { bgcolor: '#4338ca' },
                              fontWeight: 700,
                              borderRadius: 2,
                              px: 2.5,
                            }}
                          >
                            Pobierz PDF
                          </Button>
                        )}

                        <Tooltip title="Wygeneruj ten raport ponownie ze świeżymi danymi">
                          <Button
                            variant="outlined"
                            color="inherit"
                            startIcon={<RefreshIcon />}
                            onClick={() => handleRegenerateReport(report)}
                            disabled={generating}
                            sx={{
                              fontWeight: 700,
                              borderRadius: 2,
                              borderColor: '#cbd5e1',
                              color: '#475569',
                            }}
                          >
                            Odśwież
                          </Button>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Container>

      {/* Custom Week Selection Dialog */}
      <Dialog
        open={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Generuj raport za wybrany tydzień
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Wskaż dowolny dzień z tygodnia, za który chcesz wygenerować podsumowanie. Raport automatycznie obejmie pełny tydzień (od poniedziałku do niedzieli 22:00).
          </Typography>

          <TextField
            label="Wybierz dzień z tygodnia"
            type="date"
            fullWidth
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCustomDialogOpen(false)} color="inherit">
            Anuluj
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateCustomWeek}
            disabled={!customDate || generating}
            sx={{ bgcolor: '#4f46e5', fontWeight: 700 }}
          >
            Generuj raport PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

