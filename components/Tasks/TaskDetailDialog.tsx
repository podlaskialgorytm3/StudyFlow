'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Stack,
  Box,
  Chip,
  Divider,
  IconButton,
  Alert,
  Menu,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import { TaskItem } from './TaskFormDialog';
import {
  classifyEisenhowerTask,
  EisenhowerSettings,
  QUADRANT_CONFIG,
  EisenhowerQuadrant,
} from '@/lib/domain/eisenhower';
import { PriorityOverride, UrgencyOverride, TaskStatus } from '@prisma/client';

interface TaskDetailDialogProps {
  open: boolean;
  task: TaskItem | null;
  settings: EisenhowerSettings;
  onClose: () => void;
  onEdit: (task: TaskItem) => void;
  onRefresh: () => void;
}

export default function TaskDetailDialog({
  open,
  task,
  settings,
  onClose,
  onEdit,
  onRefresh,
}: TaskDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null);

  if (!task) return null;

  const classification = classifyEisenhowerTask(task, settings);
  const qInfo = QUADRANT_CONFIG[classification.quadrant];

  const handleToggleDone = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE;
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        setError('Błąd aktualizacji statusu');
      }
    } catch {
      setError('Błąd połączenia');
    } finally {
      setLoading(false);
    }
  };

  const handleResetOverride = async (dimension: 'priority' | 'urgency' | 'both') => {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (dimension === 'priority' || dimension === 'both') payload.priorityOverride = null;
      if (dimension === 'urgency' || dimension === 'both') payload.urgencyOverride = null;

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        setError('Błąd przywracania automatu');
      }
    } catch {
      setError('Błąd połączenia');
    } finally {
      setLoading(false);
    }
  };

  const handleSetQuadrant = async (targetQuad: EisenhowerQuadrant) => {
    setMoveMenuAnchor(null);
    setLoading(true);
    setError(null);

    let priorityOverride: PriorityOverride = PriorityOverride.IMPORTANT;
    let urgencyOverride: UrgencyOverride = UrgencyOverride.URGENT;

    switch (targetQuad) {
      case 'Q1_IMPORTANT_URGENT':
        priorityOverride = PriorityOverride.IMPORTANT;
        urgencyOverride = UrgencyOverride.URGENT;
        break;
      case 'Q2_IMPORTANT_NOT_URGENT':
        priorityOverride = PriorityOverride.IMPORTANT;
        urgencyOverride = UrgencyOverride.NOT_URGENT;
        break;
      case 'Q3_NOT_IMPORTANT_URGENT':
        priorityOverride = PriorityOverride.NOT_IMPORTANT;
        urgencyOverride = UrgencyOverride.URGENT;
        break;
      case 'Q4_NOT_IMPORTANT_NOT_URGENT':
        priorityOverride = PriorityOverride.NOT_IMPORTANT;
        urgencyOverride = UrgencyOverride.NOT_URGENT;
        break;
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityOverride, urgencyOverride }),
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        setError('Błąd zmiany ćwiartki');
      }
    } catch {
      setError('Błąd połączenia');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Czy na pewno chcesz usunąć to zadanie?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        setError('Błąd usuwania zadania');
      }
    } catch {
      setError('Błąd połączenia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6, fontWeight: 700 }}>
        {task.title}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
          aria-label="Zamknij"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Subject & Category Pills */}
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Chip
              label={task.subject?.name || 'Przedmiot'}
              sx={{
                bgcolor: task.subject?.color || '#1976d2',
                color: '#fff',
                fontWeight: 700,
              }}
            />
            {task.category && (
              <Chip label={task.category.name} variant="outlined" sx={{ fontWeight: 600 }} />
            )}
            <Chip
              label={`${task.storyPoints} Story Points`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
            <Chip
              label={`Status: ${task.status}`}
              color={task.status === TaskStatus.DONE ? 'success' : 'default'}
              sx={{ fontWeight: 600 }}
            />
          </Stack>

          {/* Eisenhower Quadrant Card */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: qInfo.bgLight,
              border: `1px solid ${qInfo.border}`,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 800, color: qInfo.color }}>
                  Macierz Eisenhowera — {qInfo.code}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: qInfo.color, lineHeight: 1.2 }}>
                  {qInfo.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {qInfo.subtitle}
                </Typography>
              </Box>

              <Button
                size="small"
                variant="outlined"
                startIcon={<SwapCallsIcon />}
                onClick={(e) => setMoveMenuAnchor(e.currentTarget)}
                sx={{ bgcolor: 'white' }}
              >
                Zmień ćwiartkę
              </Button>
            </Stack>

            <Menu
              anchorEl={moveMenuAnchor}
              open={Boolean(moveMenuAnchor)}
              onClose={() => setMoveMenuAnchor(null)}
            >
              {(Object.keys(QUADRANT_CONFIG) as EisenhowerQuadrant[]).map((qKey) => {
                const conf = QUADRANT_CONFIG[qKey];
                return (
                  <MenuItem key={qKey} onClick={() => handleSetQuadrant(qKey)}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: conf.color, mr: 1.5 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {conf.code}: {conf.label}
                    </Typography>
                  </MenuItem>
                );
              })}
            </Menu>

            {/* Overrides indicator and restore buttons */}
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption">
                  Ważność:{' '}
                  <strong>
                    {classification.isImportant ? 'Ważne' : 'Nieważne'}{' '}
                    {classification.isPriorityOverridden ? '(Ręcznie nadpisana)' : '(Automatyczna)'}
                  </strong>
                </Typography>
                {classification.isPriorityOverridden && (
                  <Button
                    size="small"
                    startIcon={<RotateLeftIcon />}
                    onClick={() => handleResetOverride('priority')}
                    sx={{ py: 0, fontSize: '0.75rem' }}
                  >
                    Przywróć automat
                  </Button>
                )}
              </Stack>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption">
                  Pilność:{' '}
                  <strong>
                    {classification.isUrgent ? 'Pilne' : 'Niepilne'}{' '}
                    {classification.isUrgencyOverridden ? '(Ręcznie nadpisana)' : '(Automatyczna)'}
                  </strong>
                </Typography>
                {classification.isUrgencyOverridden && (
                  <Button
                    size="small"
                    startIcon={<RotateLeftIcon />}
                    onClick={() => handleResetOverride('urgency')}
                    sx={{ py: 0, fontSize: '0.75rem' }}
                  >
                    Przywróć automat
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>

          {/* Due date info */}
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Termin i czas:
            </Typography>
            {task.dueDate ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {new Date(task.dueDate).toLocaleDateString('pl-PL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
                {classification.daysRemaining !== null && (
                  <Chip
                    size="small"
                    label={
                      classification.isOverdue
                        ? `${Math.abs(classification.daysRemaining)} dni po terminie`
                        : classification.isDueToday
                        ? 'Dzisiaj!'
                        : `Za ${classification.daysRemaining} dni`
                    }
                    color={classification.isOverdue ? 'error' : classification.isDueToday ? 'warning' : 'default'}
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Bez ustalonego terminu
              </Typography>
            )}
          </Box>

          {/* Description */}
          {task.description && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Opis:
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                {task.description}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={handleDelete} color="error" title="Usuń zadanie" disabled={loading}>
            <DeleteOutlineIcon />
          </IconButton>
          <IconButton onClick={() => onEdit(task)} color="primary" title="Edytuj zadanie" disabled={loading}>
            <EditIcon />
          </IconButton>
          <Button
            component={Link}
            href={`/tasks/${task.id}`}
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            sx={{ ml: 1 }}
          >
            Pełna strona i timer
          </Button>
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant={task.status === TaskStatus.DONE ? 'outlined' : 'contained'}
            color={task.status === TaskStatus.DONE ? 'inherit' : 'success'}
            startIcon={<CheckCircleOutlineIcon />}
            onClick={handleToggleDone}
            disabled={loading}
          >
            {task.status === TaskStatus.DONE ? 'Cofnij ukończenie' : 'Oznacz jako ukończone'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

