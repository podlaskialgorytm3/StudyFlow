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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Collapse,
  InputAdornment,
  IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import DateRangeIcon from '@mui/icons-material/DateRange';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
  const [taskHorizonDays, setTaskHorizonDays] = useState<number>(7);
  const [calendarShowGoogleEvents, setCalendarShowGoogleEvents] = useState<boolean>(true);
  const [calendarShowStudyFlowTasks, setCalendarShowStudyFlowTasks] = useState<boolean>(true);

  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<{
    googleEmail?: string | null;
    selectedCalendarId: string;
    selectedCalendarName?: string | null;
    syncFrequencyHours: number;
    lastSyncAt?: string | null;
    lastSyncStatus?: string | null;
    lastSyncError?: string | null;
  } | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<Array<{ id: string; summary: string; primary?: boolean }>>([]);
  const [googleConfigured, setGoogleConfigured] = useState(true);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Custom Google OAuth Credentials in DB
  const [hasCustomCredentials, setHasCustomCredentials] = useState(false);
  const [maskedClientId, setMaskedClientId] = useState<string | null>(null);
  const [customClientId, setCustomClientId] = useState('');
  const [customClientSecret, setCustomClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [deletingCredentials, setDeletingCredentials] = useState(false);
  const [credentialsMsg, setCredentialsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [redirectUri, setRedirectUri] = useState('');
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  const fetchGoogleData = async () => {
    try {
      const [gRes, credsRes] = await Promise.all([
        fetch('/api/calendar/google/account'),
        fetch('/api/calendar/google/credentials'),
      ]);

      if (gRes.ok) {
        const gData = await gRes.json();
        setGoogleConnected(gData.connected);
        setGoogleConfigured(gData.isConfigured);
        setHasCustomCredentials(Boolean(gData.hasCustomCredentials));
        setGoogleAccount(gData.account);
        setGoogleCalendars(gData.calendars || []);
        if (gData.redirectUri) {
          setRedirectUri(gData.redirectUri);
        }
      }

      if (credsRes.ok) {
        const cData = await credsRes.json();
        setHasCustomCredentials(Boolean(cData.hasCustomKeys));
        setMaskedClientId(cData.clientIdMasked);
        if (cData.redirectUri) {
          setRedirectUri(cData.redirectUri);
        }
      }
    } catch {
      // ignore
    }
  };

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
          if (s.taskHorizonDays !== undefined && s.taskHorizonDays !== null) {
            setTaskHorizonDays(s.taskHorizonDays);
          }
          if (s.calendarShowGoogleEvents !== undefined) {
            setCalendarShowGoogleEvents(s.calendarShowGoogleEvents);
          }
          if (s.calendarShowStudyFlowTasks !== undefined) {
            setCalendarShowStudyFlowTasks(s.calendarShowStudyFlowTasks);
          }
        }

        await fetchGoogleData();
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
          taskHorizonDays: taskHorizonDays,
          calendarShowGoogleEvents,
          calendarShowStudyFlowTasks,
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

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Czy na pewno chcesz odłączyć konto Google Calendar? Lokalne wydarzenia zostaną usunięte.')) return;
    try {
      const res = await fetch('/api/calendar/google/account', { method: 'DELETE' });
      if (res.ok) {
        setGoogleMsg({ type: 'success', text: 'Odłączono konto Google Calendar' });
        await fetchGoogleData();
      } else {
        setGoogleMsg({ type: 'error', text: 'Błąd podczas odłączania konta' });
      }
    } catch {
      setGoogleMsg({ type: 'error', text: 'Błąd połączenia' });
    }
  };

  const handleSaveCredentials = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e?.preventDefault) e.preventDefault();
    if (!customClientId.trim() || !customClientSecret.trim()) {
      setCredentialsMsg({ type: 'error', text: 'Wprowadź zarówno Client ID, jak i Client Secret' });
      return;
    }
    setSavingCredentials(true);
    setCredentialsMsg(null);
    try {
      const res = await fetch('/api/calendar/google/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: customClientId.trim(),
          clientSecret: customClientSecret.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCredentialsMsg({
          type: 'success',
          text: 'Klucze Google API zostały pomyślnie zaszyfrowane w bazie danych (AES-256-GCM) i zapisane!',
        });
        setCustomClientId('');
        setCustomClientSecret('');
        setShowCredentialsForm(false);
        await fetchGoogleData();
      } else {
        setCredentialsMsg({ type: 'error', text: data.error || 'Błąd zapisu kluczy' });
      }
    } catch {
      setCredentialsMsg({ type: 'error', text: 'Błąd połączenia z serwerem' });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleDeleteCredentials = async () => {
    if (
      !window.confirm(
        'Czy na pewno chcesz usunąć zapisane klucze Google API z bazy danych? Jeśli Twoje konto jest połączone, automatyczna synchronizacja może przestać działać.'
      )
    )
      return;
    setDeletingCredentials(true);
    setCredentialsMsg(null);
    try {
      const res = await fetch('/api/calendar/google/credentials', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setCredentialsMsg({ type: 'success', text: 'Pomyślnie usunięto własne klucze Google API z bazy danych' });
        await fetchGoogleData();
      } else {
        setCredentialsMsg({ type: 'error', text: data.error || 'Błąd usuwania kluczy' });
      }
    } catch {
      setCredentialsMsg({ type: 'error', text: 'Błąd połączenia z serwerem' });
    } finally {
      setDeletingCredentials(false);
    }
  };

  const handleCopyRedirectUri = () => {
    const uri =
      redirectUri ||
      (typeof window !== 'undefined'
        ? `${window.location.origin}/api/auth/google/callback`
        : 'http://localhost:3000/api/auth/google/callback');
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(uri);
      setCopiedRedirectUri(true);
      setTimeout(() => setCopiedRedirectUri(false), 2000);
    }
  };

  const handleUpdateGoogleCalendarPreferences = async (calendarId: string, frequencyHours: number) => {
    const selectedCal = googleCalendars.find((c) => c.id === calendarId);
    try {
      const res = await fetch('/api/calendar/google/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCalendarId: calendarId,
          selectedCalendarName: selectedCal?.summary || calendarId,
          syncFrequencyHours: frequencyHours,
        }),
      });
      if (res.ok) {
        setGoogleMsg({ type: 'success', text: 'Zapisano preferencje kalendarza Google' });
        await fetchGoogleData();
      }
    } catch {
      setGoogleMsg({ type: 'error', text: 'Błąd aktualizacji kalendarza' });
    }
  };

  const handleSyncGoogleNow = async () => {
    setGoogleSyncing(true);
    setGoogleMsg(null);
    try {
      const res = await fetch('/api/calendar/google/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setGoogleMsg({ type: 'success', text: data.message || 'Zsynchronizowano kalendarz' });
        await fetchGoogleData();
      } else {
        setGoogleMsg({ type: 'error', text: data.error || 'Błąd synchronizacji' });
      }
    } catch {
      setGoogleMsg({ type: 'error', text: 'Błąd połączenia podczas synchronizacji' });
    } finally {
      setGoogleSyncing(false);
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
          Dostosuj horyzonty czasowe listy zadań, progi automatycznej klasyfikacji w macierzy Eisenhowera oraz zarządzaj swoim kontem.
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(false)}>
            Ustawienia zostały pomyślnie zaktualizowane. Macierz Eisenhowera oraz domyślne interwały na Liście Zadań zostały zapisane!
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

            {/* Task Horizon & Interval Card */}
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <DateRangeIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Horyzont czasowy i interwały (Lista Zadań)
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Dostosuj domyślny okres wyświetlania zadań oraz długość przedziałów (np. tygodnie lub dowolne interwały co określoną liczbę dni) w filtrze na Liście Zadań.
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Domyślny interwał / horyzont zadań
                    </Typography>
                    <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
                      {taskHorizonDays} {taskHorizonDays === 1 ? 'dzień' : 'dni'}
                      {taskHorizonDays === 7 ? ' (1 tydzień)' : taskHorizonDays === 14 ? ' (2 tygodnie)' : ''}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Zadania z terminem zakończenia w ciągu <strong>{taskHorizonDays} dni w przód</strong> są wyświetlane domyślnie. Zadania przypadające na dalsze dni ({taskHorizonDays + 1} dni i więcej) możesz przeglądać wybierając odpowiedni okres w selektorze na Liście Zadań (np. Tydzień 2: [od do] dnia).
                  </Typography>

                  <Slider
                    value={taskHorizonDays}
                    onChange={(_, val) => setTaskHorizonDays(val as number)}
                    min={1}
                    max={30}
                    step={1}
                    marks={[
                      { value: 1, label: '1d' },
                      { value: 3, label: '3d' },
                      { value: 7, label: '7d (tydzień)' },
                      { value: 14, label: '14d (2 tyg.)' },
                      { value: 21, label: '21d' },
                      { value: 30, label: '30d (miesiąc)' },
                    ]}
                    valueLabelDisplay="auto"
                    sx={{ mb: 3, mt: 1 }}
                  />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <TextField
                      type="number"
                      label="Własna liczba dni interwału"
                      value={taskHorizonDays}
                      onChange={(e) => setTaskHorizonDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
                      inputProps={{ min: 1, max: 90 }}
                      fullWidth
                      sx={{ maxWidth: 220 }}
                      helperText="Dozwolony zakres: od 1 do 90 dni"
                    />

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {[3, 7, 14, 21, 30].map((d) => (
                        <Chip
                          key={d}
                          label={d === 7 ? '7 dni (tydzień)' : d === 14 ? '14 dni (2 tygodnie)' : `${d} dni`}
                          onClick={() => setTaskHorizonDays(d)}
                          color={taskHorizonDays === d ? 'primary' : 'default'}
                          variant={taskHorizonDays === d ? 'filled' : 'outlined'}
                          clickable
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Box>
              </CardContent>
            </Card>

            {/* Google Calendar Integration Card */}
            <Card id="google-calendar" sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <CalendarMonthIcon sx={{ color: '#4285F4' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Integracja z Google Calendar
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Połącz swoje konto Google, aby synchronizować wydarzenia z wybranego kalendarza oraz przeglądać je w tygodniowym widoku Kalendarza obok zadań StudyFlow.
                </Typography>
                <Divider sx={{ mb: 3 }} />

                {googleMsg && (
                  <Alert severity={googleMsg.type} sx={{ mb: 2.5 }} onClose={() => setGoogleMsg(null)}>
                    {googleMsg.text}
                  </Alert>
                )}

                {credentialsMsg && (
                  <Alert
                    severity={credentialsMsg.type}
                    sx={{ mb: 2.5 }}
                    onClose={() => setCredentialsMsg(null)}
                  >
                    {credentialsMsg.text}
                  </Alert>
                )}

                {/* Banner when NOT configured at all */}
                {!googleConfigured && (
                  <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5 }}>
                    Integracja z Google Calendar wymaga danych aplikacji z Google Cloud Console. Możesz wprowadzić poniżej swój <strong>Client ID</strong> oraz <strong>Client Secret</strong> — zostaną one <strong>bezpiecznie zaszyfrowane w bazie danych (AES-256-GCM)</strong> dla Twojego konta. Nie musisz edytować żadnych plików na serwerze!
                  </Alert>
                )}

                {/* Custom Credentials Badge when active in DB */}
                {hasCustomCredentials && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#f0fdf4',
                      borderRadius: 2,
                      border: '1px solid #bbf7d0',
                      mb: 2.5,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ sm: 'center' }}
                      spacing={1.5}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CheckCircleIcon color="success" />
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534' }}>
                            Własne poświadczenia Google API aktywne (Zaszyfrowane w bazie danych)
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#15803d' }}>
                            Client ID: <code>{maskedClientId || '••••••••'}</code> (szyfrowanie AES-256-GCM)
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setShowCredentialsForm((prev) => !prev)}
                        >
                          {showCredentialsForm ? 'Ukryj formularz' : 'Zmień klucze'}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={handleDeleteCredentials}
                          disabled={deletingCredentials}
                        >
                          Usuń z bazy
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                )}

                {/* If configured via .env without custom keys */}
                {googleConfigured && !hasCustomCredentials && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: '#f8fafc',
                      borderRadius: 2,
                      border: '1px solid #e2e8f0',
                      mb: 2.5,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ sm: 'center' }}
                      spacing={1}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Używana jest globalna konfiguracja serwera Google OAuth (zmienne środowiskowe).
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setShowCredentialsForm((prev) => !prev)}
                      >
                        {showCredentialsForm ? 'Ukryj formularz' : 'Chcesz użyć własnych kluczy w bazie? Kliknij'}
                      </Button>
                    </Stack>
                  </Box>
                )}

                {/* Expandable Credentials Form */}
                <Collapse in={showCredentialsForm || !googleConfigured}>
                  <Box
                    component="div"
                    sx={{
                      p: 2.5,
                      bgcolor: '#ffffff',
                      borderRadius: 2.5,
                      border: '1.5px dashed #cbd5e1',
                      mb: 3,
                    }}
                  >
                    {/* Hidden dummy fields to prevent browser password managers from pre-filling login credentials */}
                    <input
                      type="text"
                      name="fake_username_remember"
                      style={{ display: 'none' }}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                    />
                    <input
                      type="password"
                      name="fake_password_remember"
                      style={{ display: 'none' }}
                      tabIndex={-1}
                      autoComplete="new-password"
                      aria-hidden="true"
                    />

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <VpnKeyIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Wprowadź dane z Google Cloud Console
                      </Typography>
                      <Chip
                        icon={<LockOutlinedIcon />}
                        label="Szyfrowanie AES-256-GCM"
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Wklej poniżej dane ze swojego projektu w Google Cloud Platform. Twoje klucze zostaną zaszyfrowane bezpiecznym algorytmem AES-256-GCM i zapisane w bazie danych powiązanej z Twoim kontem użytkownika.
                    </Typography>

                    {/* Redirect URI with copy button */}
                    <Box
                      sx={{
                        p: 1.5,
                        bgcolor: '#f8fafc',
                        borderRadius: 1.5,
                        border: '1px solid #e2e8f0',
                        mb: 2.5,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 700 }}>
                        Adres URI przekierowania (Redirect URI) — skopiuj i wklej w Google Cloud Console:
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            bgcolor: '#ffffff',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            border: '1px solid #cbd5e1',
                            flexGrow: 1,
                            wordBreak: 'break-all',
                          }}
                        >
                          {redirectUri ||
                            (typeof window !== 'undefined'
                              ? `${window.location.origin}/api/auth/google/callback`
                              : 'http://localhost:3000/api/auth/google/callback')}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ContentCopyIcon />}
                          onClick={handleCopyRedirectUri}
                          sx={{ flexShrink: 0 }}
                        >
                          {copiedRedirectUri ? 'Skopiowano!' : 'Kopiuj URI'}
                        </Button>
                      </Stack>
                    </Box>

                    <Stack spacing={2} sx={{ mb: 2.5 }}>
                      <TextField
                        id="sf_google_client_id_input"
                        name="sf_google_client_id_input"
                        label="Google Client ID"
                        placeholder="np. 123456789-abcdef.apps.googleusercontent.com"
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        autoComplete="off"
                        fullWidth
                        size="small"
                        required
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
                          'data-lpignore': 'true',
                          'data-1p-ignore': 'true',
                          'data-form-type': 'other',
                        }}
                        helperText="Client ID wygenerowany w Google Cloud Console (OAuth 2.0 Client IDs)"
                      />

                      <TextField
                        id="sf_google_client_secret_input"
                        name="sf_google_client_secret_input"
                        label="Google Client Secret"
                        placeholder="Wklej sekret klienta Google..."
                        type={showClientSecret ? 'text' : 'password'}
                        value={customClientSecret}
                        onChange={(e) => setCustomClientSecret(e.target.value)}
                        autoComplete="new-password"
                        fullWidth
                        size="small"
                        required
                        inputProps={{
                          autoComplete: 'new-password',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
                          'data-lpignore': 'true',
                          'data-1p-ignore': 'true',
                          'data-form-type': 'other',
                        }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowClientSecret((prev) => !prev)}
                                edge="end"
                              >
                                {showClientSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        helperText="Client Secret — zostanie zaszyfrowany przed zapisaniem w bazie danych"
                      />
                    </Stack>

                    <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                      {hasCustomCredentials && (
                        <Button
                          variant="text"
                          onClick={() => setShowCredentialsForm(false)}
                          disabled={savingCredentials}
                        >
                          Anuluj
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => handleSaveCredentials()}
                        variant="contained"
                        color="primary"
                        startIcon={
                          savingCredentials ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <LockOutlinedIcon />
                          )
                        }
                        disabled={savingCredentials || !customClientId.trim() || !customClientSecret.trim()}
                        sx={{ fontWeight: 700 }}
                      >
                        {savingCredentials ? 'Szyfrowanie i zapisywanie...' : 'Zapisz i zaszyfruj klucze'}
                      </Button>
                    </Stack>
                  </Box>
                </Collapse>

                {/* Status & Connect / Disconnect */}
                <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', mb: 3 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    spacing={2}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Status konta Google:
                        </Typography>
                        <Chip
                          icon={googleConnected ? <CheckCircleIcon /> : undefined}
                          label={googleConnected ? 'Połączono' : 'Niepołączono'}
                          color={googleConnected ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </Stack>
                      {googleConnected && googleAccount?.googleEmail && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Zalogowany jako: <strong>{googleAccount.googleEmail}</strong>
                        </Typography>
                      )}
                      {!googleConnected && !googleConfigured && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Wprowadź i zapisz powyżej klucze Google API, aby aktywować przycisk połączenia.
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      {googleConnected ? (
                        <>
                          <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={googleSyncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                            onClick={handleSyncGoogleNow}
                            disabled={googleSyncing}
                          >
                            {googleSyncing ? 'Synchronizuję...' : 'Synchronizuj'}
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<LinkOffIcon />}
                            onClick={handleDisconnectGoogle}
                          >
                            Odłącz konto
                          </Button>
                        </>
                      ) : (
                        <Button
                          component="a"
                          href="/api/auth/google?returnTo=/settings"
                          variant="contained"
                          size="small"
                          startIcon={<LinkIcon />}
                          sx={{ bgcolor: '#4285F4', '&:hover': { bgcolor: '#3367d6' }, fontWeight: 700 }}
                          disabled={!googleConfigured}
                        >
                          Połącz z Google
                        </Button>
                      )}
                    </Stack>
                  </Stack>

                  {/* Sync status & error meta */}
                  {googleConnected && (
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #e2e8f0' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">
                          Ostatnia synchronizacja:{' '}
                          <strong>
                            {googleAccount?.lastSyncAt
                              ? new Date(googleAccount.lastSyncAt).toLocaleString('pl-PL')
                              : 'Jeszcze nie przeprowadzono'}
                          </strong>
                        </Typography>
                        {googleAccount?.lastSyncStatus && (
                          <Typography variant="caption" sx={{ color: googleAccount.lastSyncStatus === 'SUCCESS' ? 'success.main' : 'error.main', fontWeight: 700 }}>
                            Status: {googleAccount.lastSyncStatus}
                          </Typography>
                        )}
                      </Stack>
                      {googleAccount?.lastSyncError && (
                        <Alert severity="error" variant="outlined" sx={{ mt: 1, py: 0 }}>
                          {googleAccount.lastSyncError}
                        </Alert>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Calendar Preferences (if connected) */}
                {googleConnected && (
                  <Stack spacing={2.5}>
                    <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                        Wybór kalendarza do synchronizacji
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Wybierz kalendarz ze swojego konta Google, z którego wydarzenia mają pojawiać się w StudyFlow:
                      </Typography>

                      <FormControl fullWidth size="small">
                        <InputLabel>Kalendarz Google</InputLabel>
                        <Select
                          label="Kalendarz Google"
                          value={googleAccount?.selectedCalendarId || 'all'}
                          onChange={(e) =>
                            handleUpdateGoogleCalendarPreferences(
                              e.target.value,
                              googleAccount?.syncFrequencyHours || 3
                            )
                          }
                        >
                          {googleCalendars.map((cal) => (
                            <MenuItem key={cal.id} value={cal.id}>
                              {cal.summary} {cal.primary ? '(Domyślny / Główny)' : ''}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Frequency selector */}
                    <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                        Częstotliwość automatycznej synchronizacji
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Jak często serwer ma automatycznie sprawdzać zmiany i nowe wydarzenia w Google Calendar:
                      </Typography>

                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Częstotliwość</InputLabel>
                        <Select
                          label="Częstotliwość"
                          value={googleAccount?.syncFrequencyHours || 3}
                          onChange={(e) =>
                            handleUpdateGoogleCalendarPreferences(
                              googleAccount?.selectedCalendarId || 'primary',
                              Number(e.target.value)
                            )
                          }
                        >
                          <MenuItem value={1}>Co 1 godzinę</MenuItem>
                          <MenuItem value={3}>Co 3 godziny (Domyślnie)</MenuItem>
                          <MenuItem value={6}>Co 6 godzin</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Stack>
                )}

                {/* Calendar Visibility Options */}
                <Box sx={{ mt: 3, p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    Domyślna widoczność w widoku kalendarza
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Zarządzaj tym, które źródła danych są domyślnie aktywne na stronie <code>/calendar</code>:
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={calendarShowGoogleEvents}
                          onChange={(e) => setCalendarShowGoogleEvents(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Wyświetlaj wydarzenia Google"
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={calendarShowStudyFlowTasks}
                          onChange={(e) => setCalendarShowStudyFlowTasks(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Wyświetlaj zadania StudyFlow"
                    />
                  </Stack>
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

