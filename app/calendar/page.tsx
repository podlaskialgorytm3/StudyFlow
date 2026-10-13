'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Tooltip,
  Paper,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import SyncIcon from '@mui/icons-material/Sync';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Link from 'next/link';
import AppNavbar from '@/components/Navigation/AppNavbar';
import type { UnifiedCalendarItem } from '@/app/api/calendar/events/route';

interface CalendarMeta {
  startDate: string;
  endDate: string;
  googleConnected: boolean;
  googleEmail?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  showGoogle: boolean;
  showTasks: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [events, setEvents] = useState<UnifiedCalendarItem[]>([]);
  const [meta, setMeta] = useState<CalendarMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCalendarItem | null>(null);

  // Filter toggles
  const [filterGoogle, setFilterGoogle] = useState(true);
  const [filterTasks, setFilterTasks] = useState(true);

  // Compute days in view (Week: Monday -> Sunday, Day: currentDate)
  const viewDays = useMemo(() => {
    if (viewMode === 'day') {
      const d = new Date(currentDate);
      d.setHours(0, 0, 0, 0);
      return [d];
    }

    // Week: Monday as day 0
    const start = new Date(currentDate);
    const day = start.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate, viewMode]);

  const rangeStart = useMemo(() => {
    const d = new Date(viewDays[0]);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [viewDays]);

  const rangeEnd = useMemo(() => {
    const d = new Date(viewDays[viewDays.length - 1]);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [viewDays]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const startIso = rangeStart.toISOString();
      const endIso = rangeEnd.toISOString();
      const res = await fetch(`/api/calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items || []);
        setMeta(data.meta || null);
        if (data.meta) {
          setFilterGoogle(data.meta.showGoogle);
          setFilterTasks(data.meta.showTasks);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle Manual Sync Now
  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/calendar/google/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || 'Pomyślnie zsynchronizowano kalendarz');
        await fetchEvents();
      } else {
        setSyncMessage(`Błąd: ${data.error || 'Nie udało się zsynchronizować'}`);
      }
    } catch {
      setSyncMessage('Błąd połączenia podczas synchronizacji');
    } finally {
      setSyncing(false);
    }
  };

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filtered events based on toggles
  const displayEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.source === 'google' && !filterGoogle) return false;
      if (e.source === 'studyflow' && !filterTasks) return false;
      return true;
    });
  }, [events, filterGoogle, filterTasks]);

  // Partition events into All-day vs Timed events per day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, { allDay: UnifiedCalendarItem[]; timed: UnifiedCalendarItem[] }>();

    for (const day of viewDays) {
      const dayKey = day.toISOString().slice(0, 10);
      map.set(dayKey, { allDay: [], timed: [] });
    }

    for (const ev of displayEvents) {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);

      for (const day of viewDays) {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        // Check intersection
        if (evStart <= dayEnd && evEnd >= dayStart) {
          const dayKey = day.toISOString().slice(0, 10);
          const entry = map.get(dayKey);
          if (entry) {
            if (ev.isAllDay) {
              if (!entry.allDay.some((x) => x.id === ev.id)) {
                entry.allDay.push(ev);
              }
            } else {
              if (!entry.timed.some((x) => x.id === ev.id)) {
                entry.timed.push(ev);
              }
            }
          }
        }
      }
    }

    return map;
  }, [viewDays, displayEvents]);

  // Date format header text
  const headerDateText = useMemo(() => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('pl-PL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    const startStr = viewDays[0].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    const endStr = viewDays[6].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [viewMode, currentDate, viewDays]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentHourNow = new Date().getHours() + new Date().getMinutes() / 60;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 8 }}>
      <AppNavbar />

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Top Control Header Card */}
        <Card sx={{ p: { xs: 2, sm: 2.5 }, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            spacing={2}
          >
            {/* Title & Navigation */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <CalendarMonthIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, textTransform: 'capitalize' }}>
                  {headerDateText}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Połączony kalendarz Google oraz zadań akademickich StudyFlow
                </Typography>
              </Box>
            </Stack>

            {/* Middle Nav Buttons */}
            <Stack direction="row" spacing={1} alignItems="center" alignSelf={{ xs: 'center', md: 'auto' }}>
              <IconButton onClick={handlePrev} size="small" sx={{ border: '1px solid #cbd5e1' }}>
                <ChevronLeftIcon />
              </IconButton>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TodayIcon />}
                onClick={handleToday}
                sx={{ fontWeight: 700 }}
              >
                Dzisiaj
              </Button>
              <IconButton onClick={handleNext} size="small" sx={{ border: '1px solid #cbd5e1' }}>
                <ChevronRightIcon />
              </IconButton>

              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, val) => val && setViewMode(val)}
                size="small"
                sx={{ ml: 1 }}
              >
                <ToggleButton value="week">Tydzień</ToggleButton>
                <ToggleButton value="day">Dzień</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {/* Right: Sync & Filters */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              {meta?.googleConnected ? (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                  onClick={handleSyncNow}
                  disabled={syncing}
                  sx={{ fontWeight: 700 }}
                >
                  {syncing ? 'Synchronizuję...' : 'Synchronizuj teraz'}
                </Button>
              ) : (
                <Button
                  component={Link}
                  href="/settings#google-calendar"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 700, borderColor: '#4285F4', color: '#4285F4' }}
                >
                  Połącz Google Calendar
                </Button>
              )}
            </Stack>
          </Stack>

          {/* Subheader: Filter toggles & sync status */}
          <Divider sx={{ my: 1.5 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Widoczność:
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={filterGoogle}
                    onChange={(e) => setFilterGoogle(e.target.checked)}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4285F4' } }}
                  />
                }
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4285F4' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Google Calendar {meta?.googleEmail ? `(${meta.googleEmail})` : ''}
                    </Typography>
                  </Stack>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={filterTasks}
                    onChange={(e) => setFilterTasks(e.target.checked)}
                  />
                }
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#10b981' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Zadania StudyFlow
                    </Typography>
                  </Stack>
                }
              />
            </Stack>

            {meta?.googleConnected && meta.lastSyncAt && (
              <Typography variant="caption" color="text.secondary">
                Ostatnia synchronizacja: {new Date(meta.lastSyncAt).toLocaleString('pl-PL')}
              </Typography>
            )}
          </Stack>

          {syncMessage && (
            <Alert
              severity={syncMessage.startsWith('Błąd') ? 'error' : 'success'}
              sx={{ mt: 1.5 }}
              onClose={() => setSyncMessage(null)}
            >
              {syncMessage}
            </Alert>
          )}
        </Card>

        {/* Calendar Grid Container */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', bgcolor: 'white' }}>
            {/* Days Column Headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `60px repeat(${viewDays.length}, 1fr)`,
                borderBottom: '1px solid #e2e8f0',
                bgcolor: '#f8fafc',
              }}
            >
              <Box sx={{ p: 1, borderRight: '1px solid #e2e8f0' }} />
              {viewDays.map((d) => {
                const dayKey = d.toISOString().slice(0, 10);
                const isToday = dayKey === todayIso;

                return (
                  <Box
                    key={dayKey}
                    sx={{
                      p: 1.5,
                      textAlign: 'center',
                      borderRight: '1px solid #e2e8f0',
                      bgcolor: isToday ? 'rgba(37, 99, 235, 0.05)' : 'inherit',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: isToday ? 'primary.main' : 'text.secondary',
                        textTransform: 'uppercase',
                        display: 'block',
                      }}
                    >
                      {d.toLocaleDateString('pl-PL', { weekday: 'short' })}
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        width: 32,
                        height: 32,
                        lineHeight: '32px',
                        borderRadius: '50%',
                        mx: 'auto',
                        mt: 0.5,
                        bgcolor: isToday ? 'primary.main' : 'transparent',
                        color: isToday ? '#ffffff' : 'text.primary',
                      }}
                    >
                      {d.getDate()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* All-day Section Header Row (if any all day events exist) */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `60px repeat(${viewDays.length}, 1fr)`,
                borderBottom: '2px solid #cbd5e1',
                bgcolor: '#f1f5f9',
                minHeight: 36,
              }}
            >
              <Box sx={{ p: 1, borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', color: 'text.secondary' }}>
                  Cały dzień
                </Typography>
              </Box>

              {viewDays.map((d) => {
                const dayKey = d.toISOString().slice(0, 10);
                const allDayItems = eventsByDay.get(dayKey)?.allDay || [];

                return (
                  <Box
                    key={`allday_${dayKey}`}
                    sx={{
                      p: 0.5,
                      borderRight: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                    }}
                  >
                    {allDayItems.map((item) => (
                      <Chip
                        key={item.id}
                        size="small"
                        label={item.title}
                        onClick={() => setSelectedEvent(item)}
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          bgcolor: item.color || '#4285F4',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </Box>
                );
              })}
            </Box>

            {/* 24-Hours Timed Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `60px repeat(${viewDays.length}, 1fr)`,
                position: 'relative',
                maxHeight: '700px',
                overflowY: 'auto',
              }}
            >
              {/* Hour Labels Left Column */}
              <Box sx={{ borderRight: '1px solid #e2e8f0' }}>
                {HOURS.map((hour) => (
                  <Box
                    key={hour}
                    sx={{
                      height: 60,
                      borderBottom: '1px solid #f1f5f9',
                      textAlign: 'right',
                      pr: 1,
                      pt: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 600 }}>
                      {String(hour).padStart(2, '0')}:00
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Day Columns */}
              {viewDays.map((d) => {
                const dayKey = d.toISOString().slice(0, 10);
                const isToday = dayKey === todayIso;
                const timedItems = eventsByDay.get(dayKey)?.timed || [];

                return (
                  <Box
                    key={`col_${dayKey}`}
                    sx={{
                      position: 'relative',
                      borderRight: '1px solid #e2e8f0',
                      bgcolor: isToday ? 'rgba(37, 99, 235, 0.02)' : 'inherit',
                    }}
                  >
                    {/* Hour grid lines */}
                    {HOURS.map((hour) => (
                      <Box
                        key={`line_${hour}`}
                        sx={{
                          height: 60,
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      />
                    ))}

                    {/* Current Time Line if Today */}
                    {isToday && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: `${currentHourNow * 60}px`,
                          left: 0,
                          right: 0,
                          borderTop: '2px solid #ef4444',
                          zIndex: 10,
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: -4,
                            top: -4,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#ef4444',
                          },
                        }}
                      />
                    )}

                    {/* Timed Event Blocks */}
                    {timedItems.map((item) => {
                      const start = new Date(item.start);
                      const end = new Date(item.end);

                      // Calculate top offset (start hours * 60px)
                      const startMinutes = start.getHours() * 60 + start.getMinutes();
                      const endMinutes = end.getHours() * 60 + end.getMinutes();
                      const durationMinutes = Math.max(25, endMinutes - startMinutes);

                      const topPx = (startMinutes / 60) * 60;
                      const heightPx = (durationMinutes / 60) * 60;

                      return (
                        <Box
                          key={item.id}
                          onClick={() => setSelectedEvent(item)}
                          sx={{
                            position: 'absolute',
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            left: 4,
                            right: 4,
                            bgcolor: item.color || '#2563eb',
                            color: '#ffffff',
                            borderRadius: 1.5,
                            p: 0.75,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            zIndex: 5,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            '&:hover': {
                              transform: 'scale(1.02)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                              zIndex: 20,
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.72rem',
                              lineHeight: 1.1,
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.title}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.9 }}>
                            {start.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {end.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}

        {/* Event Detail Dialog */}
        <Dialog open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} maxWidth="sm" fullWidth>
          {selectedEvent && (
            <>
              <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: selectedEvent.color || '#2563eb',
                  }}
                />
                {selectedEvent.title}
              </DialogTitle>

              <DialogContent dividers>
                <Stack spacing={2}>
                  {/* Source chip */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      label={selectedEvent.source === 'google' ? 'Google Calendar' : 'Zadanie StudyFlow'}
                      sx={{
                        bgcolor: selectedEvent.source === 'google' ? '#4285F4' : '#10b981',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    />
                    {selectedEvent.studyflowMeta && (
                      <Chip
                        size="small"
                        label={selectedEvent.studyflowMeta.subjectName}
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Stack>

                  {/* Time info */}
                  <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTimeIcon fontSize="small" color="primary" />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {selectedEvent.isAllDay
                          ? `Wydarzenie całodniowe: ${new Date(selectedEvent.start).toLocaleDateString('pl-PL')}`
                          : `${new Date(selectedEvent.start).toLocaleString('pl-PL')} — ${new Date(selectedEvent.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`}
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Location if exists */}
                  {selectedEvent.location && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LocationOnIcon fontSize="small" color="action" />
                      <Typography variant="body2">{selectedEvent.location}</Typography>
                    </Stack>
                  )}

                  {/* Description if exists */}
                  {selectedEvent.description && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Opis:
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                        {selectedEvent.description}
                      </Typography>
                    </Box>
                  )}

                  {/* Studyflow Specific Metadata */}
                  {selectedEvent.studyflowMeta && (
                    <Box sx={{ p: 2, bgcolor: '#ecfdf5', borderRadius: 2, border: '1px solid #a7f3d0' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#065f46', mb: 1 }}>
                        Szczegóły zadania akademickiego:
                      </Typography>
                      <Stack direction="row" spacing={1.5} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={`Status: ${selectedEvent.studyflowMeta.status}`}
                          color="success"
                        />
                        <Chip
                          size="small"
                          label={`${selectedEvent.studyflowMeta.storyPoints} Story Points`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`Postęp: ${selectedEvent.studyflowMeta.progressPercent}%`}
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
                <Button onClick={() => setSelectedEvent(null)} color="inherit">
                  Zamknij
                </Button>

                {selectedEvent.url && (
                  <Button
                    component={selectedEvent.source === 'studyflow' ? Link : 'a'}
                    href={selectedEvent.url}
                    target={selectedEvent.source === 'google' ? '_blank' : undefined}
                    rel="noreferrer"
                    variant="contained"
                    startIcon={<OpenInNewIcon />}
                  >
                    {selectedEvent.source === 'google' ? 'Otwórz w Google Calendar' : 'Przejdź do zadania'}
                  </Button>
                )}
              </DialogActions>
            </>
          )}
        </Dialog>
      </Container>
    </Box>
  );
}
