'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Stack,
  Chip,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import { formatHumanDuration } from '@/lib/utils/formatTime';
import { TaskItem, SubjectItem } from '@/components/Tasks/TaskFormDialog';
import {
  classifyEisenhowerTask,
  EisenhowerSettings,
  EisenhowerQuadrant,
  QUADRANT_CONFIG,
} from '@/lib/domain/eisenhower';
import { TaskStatus } from '@prisma/client';
import EisenhowerBubbleView from './EisenhowerBubbleView';

interface EisenhowerMatrixProps {
  tasks: TaskItem[];
  subjects: SubjectItem[];
  settings: EisenhowerSettings;
  onSelectTask: (task: TaskItem) => void;
}

export default function EisenhowerMatrix({
  tasks,
  subjects,
  settings,
  onSelectTask,
}: EisenhowerMatrixProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [viewMode, setViewMode] = useState<'cards' | 'bubbles'>('cards');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [showDone, setShowDone] = useState(false);
  const [mobileTab, setMobileTab] = useState<number>(0);

  // Restore saved view mode preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('studyflow_eisenhower_view');
      if (saved === 'cards' || saved === 'bubbles') {
        setViewMode(saved);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleViewModeChange = (
    _: React.MouseEvent<HTMLElement>,
    nextMode: 'cards' | 'bubbles' | null
  ) => {
    if (nextMode) {
      setViewMode(nextMode);
      try {
        localStorage.setItem('studyflow_eisenhower_view', nextMode);
      } catch {
        // Ignore
      }
    }
  };

  // Filter tasks by subject and completion
  const filteredTasks = tasks.filter((t) => {
    if (selectedSubjectId !== 'ALL' && t.subjectId !== selectedSubjectId) return false;
    if (!showDone && t.status === TaskStatus.DONE) return false;
    return true;
  });

  // Classify all filtered tasks into their respective quadrants
  const quadrantTasks: Record<EisenhowerQuadrant, Array<{ task: TaskItem; classification: ReturnType<typeof classifyEisenhowerTask> }>> = {
    Q1_IMPORTANT_URGENT: [],
    Q2_IMPORTANT_NOT_URGENT: [],
    Q3_NOT_IMPORTANT_URGENT: [],
    Q4_NOT_IMPORTANT_NOT_URGENT: [],
  };

  for (const t of filteredTasks) {
    const classification = classifyEisenhowerTask(t, settings);
    quadrantTasks[classification.quadrant].push({ task: t, classification });
  }

  const quadrantKeys: EisenhowerQuadrant[] = [
    'Q1_IMPORTANT_URGENT',
    'Q2_IMPORTANT_NOT_URGENT',
    'Q3_NOT_IMPORTANT_URGENT',
    'Q4_NOT_IMPORTANT_NOT_URGENT',
  ];

  const renderTaskDotOrCard = (item: { task: TaskItem; classification: ReturnType<typeof classifyEisenhowerTask> }) => {
    const { task, classification } = item;
    const isOverridden = classification.isPriorityOverridden || classification.isUrgencyOverridden;

    return (
      <Paper
        key={task.id}
        elevation={0}
        onClick={() => onSelectTask(task)}
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'white',
          border: '1px solid #e2e8f0',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            {/* Subject Color Indicator */}
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: task.subject?.color || '#1976d2',
                flexShrink: 0,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: task.status === TaskStatus.DONE ? 'text.secondary' : 'text.primary',
                textDecoration: task.status === TaskStatus.DONE ? 'line-through' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {isOverridden && (
              <Tooltip title="Klasyfikacja została ręcznie nadpisana przez użytkownika">
                <EditNoteIcon color="action" sx={{ fontSize: 18 }} />
              </Tooltip>
            )}
            <Chip
              label={`${task.storyPoints} SP`}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
            />
            <Chip
              label={formatHumanDuration((task.estimatedMinutes ?? 60) * 60)}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
            />
            <Chip
              label={`${task.progressPercent ?? (task.status === TaskStatus.DONE ? 100 : 0)}%`}
              size="small"
              color={(task.progressPercent === 100 || task.status === TaskStatus.DONE) ? 'success' : (task.progressPercent && task.progressPercent > 0) ? 'primary' : 'default'}
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
            />
          </Stack>
        </Stack>

        {/* Bottom meta: Subject name & Due date */}
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.subject?.name}
            {task.category ? ` • ${task.category.name}` : ''}
          </Typography>

          {task.dueDate ? (
            <Chip
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: '0.8rem !important' }} />}
              label={
                classification.isOverdue
                  ? `${Math.abs(classification.daysRemaining || 0)}d po terminie`
                  : classification.isDueToday
                  ? 'Dziś'
                  : `${classification.daysRemaining}d`
              }
              color={classification.isOverdue ? 'error' : classification.isDueToday ? 'warning' : 'default'}
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
            />
          ) : (
            <Typography variant="caption" color="text.disabled">
              Bez terminu
            </Typography>
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Card sx={{ p: { xs: 1.5, md: 2.5 } }}>
      {/* Controls Bar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Macierz Eisenhowera
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ważność: ≥ <strong>{settings.importantStoryPointsThreshold} SP</strong> | Pilność: ≤ <strong>{settings.urgentWithinDays} dni</strong> do terminu
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          {/* View Mode Switcher: Karty vs Kropki */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            sx={{
              bgcolor: '#f1f5f9',
              p: 0.25,
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.5,
                fontWeight: 700,
                fontSize: '0.8rem',
                textTransform: 'none',
                color: 'text.secondary',
                borderRadius: 1.5,
                border: 'none',
                '&.Mui-selected': {
                  bgcolor: 'white',
                  color: 'primary.main',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                },
              },
            }}
          >
            <ToggleButton value="cards" aria-label="Widok kart">
              <ViewModuleIcon fontSize="small" sx={{ mr: 0.75 }} />
              Karty
            </ToggleButton>
            <ToggleButton value="bubbles" aria-label="Widok kropek">
              <BubbleChartIcon fontSize="small" sx={{ mr: 0.75 }} />
              Kropki
            </ToggleButton>
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Filtruj przedmiot</InputLabel>
            <Select
              value={selectedSubjectId}
              label="Filtruj przedmiot"
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              <MenuItem value="ALL">Wszystkie przedmioty</MenuItem>
              {subjects.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={showDone} onChange={(e) => setShowDone(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Ukończone ({tasks.filter((t) => t.status === TaskStatus.DONE).length})</Typography>}
          />
        </Stack>
      </Stack>

      {/* Responsive Rendering: Bubbles View or Cards View */}
      {viewMode === 'bubbles' ? (
        <Box>
          {isMobile && (
            <Tabs
              value={mobileTab}
              onChange={(_, val) => setMobileTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2, borderBottom: '1px solid #e2e8f0' }}
            >
              {quadrantKeys.map((qKey) => {
                const conf = QUADRANT_CONFIG[qKey];
                const count = quadrantTasks[qKey].length;
                return (
                  <Tab
                    key={qKey}
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <span>{conf.code}</span>
                        <Chip
                          label={count}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: conf.color,
                            color: '#fff',
                            fontWeight: 700,
                          }}
                        />
                      </Stack>
                    }
                  />
                );
              })}
            </Tabs>
          )}
          <EisenhowerBubbleView
            quadrantTasks={quadrantTasks}
            settings={settings}
            subjects={subjects}
            onSelectTask={onSelectTask}
            isMobile={isMobile}
            mobileTab={mobileTab}
          />
        </Box>
      ) : isMobile ? (
        // Mobile Tabbed View
        <Box>
          <Tabs
            value={mobileTab}
            onChange={(_, val) => setMobileTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, borderBottom: '1px solid #e2e8f0' }}
          >
            {quadrantKeys.map((qKey) => {
              const conf = QUADRANT_CONFIG[qKey];
              const count = quadrantTasks[qKey].length;
              return (
                <Tab
                  key={qKey}
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>{conf.code}</span>
                      <Chip
                        label={count}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          bgcolor: conf.color,
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                  }
                />
              );
            })}
          </Tabs>

          {(() => {
            const currentQKey = quadrantKeys[mobileTab];
            const conf = QUADRANT_CONFIG[currentQKey];
            const items = quadrantTasks[currentQKey];

            return (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: conf.bgLight,
                  border: `1px solid ${conf.border}`,
                  minHeight: 280,
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: conf.color }}>
                    {conf.code}: {conf.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {conf.subtitle}
                  </Typography>
                </Box>

                {items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    Brak zadań w tej ćwiartce
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>{items.map(renderTaskDotOrCard)}</Stack>
                )}
              </Box>
            );
          })()}
        </Box>
      ) : (
        // Desktop 2x2 Quadrant Grid
        <Box sx={{ position: 'relative' }}>
          {/* Axis Labels */}
          <Grid container spacing={2}>
            {/* Top row: Q1 (Ważne i pilne) & Q2 (Ważne i niepilne) */}
            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: QUADRANT_CONFIG.Q1_IMPORTANT_URGENT.bgLight,
                  border: `1px solid ${QUADRANT_CONFIG.Q1_IMPORTANT_URGENT.border}`,
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: QUADRANT_CONFIG.Q1_IMPORTANT_URGENT.color }}>
                      Q1: {QUADRANT_CONFIG.Q1_IMPORTANT_URGENT.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {QUADRANT_CONFIG.Q1_IMPORTANT_URGENT.subtitle}
                    </Typography>
                  </Box>
                  <Chip
                    label={quadrantTasks.Q1_IMPORTANT_URGENT.length}
                    size="small"
                    sx={{
                      bgcolor: QUADRANT_CONFIG.Q1_IMPORTANT_URGENT.color,
                      color: 'white',
                      fontWeight: 800,
                    }}
                  />
                </Stack>
                <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 320 }}>
                  {quadrantTasks.Q1_IMPORTANT_URGENT.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      Brak zadań w tej ćwiartce
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>{quadrantTasks.Q1_IMPORTANT_URGENT.map(renderTaskDotOrCard)}</Stack>
                  )}
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: QUADRANT_CONFIG.Q2_IMPORTANT_NOT_URGENT.bgLight,
                  border: `1px solid ${QUADRANT_CONFIG.Q2_IMPORTANT_NOT_URGENT.border}`,
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: QUADRANT_CONFIG.Q2_IMPORTANT_NOT_URGENT.color }}>
                      Q2: {QUADRANT_CONFIG.Q2_IMPORTANT_NOT_URGENT.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {QUADRANT_CONFIG.Q2_IMPORTANT_NOT_URGENT.subtitle}
                    </Typography>
                  </Box>
                  <Chip
                    label={quadrantTasks.Q2_IMPORTANT_NOT_URGENT.length}
                    size="small"
                    sx={{
                      bgcolor: QUADRANT_CONFIG.Q2_IMPORTANT_NOT_URGENT.color,
                      color: 'white',
                      fontWeight: 800,
                    }}
                  />
                </Stack>
                <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 320 }}>
                  {quadrantTasks.Q2_IMPORTANT_NOT_URGENT.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      Brak zadań w tej ćwiartce
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>{quadrantTasks.Q2_IMPORTANT_NOT_URGENT.map(renderTaskDotOrCard)}</Stack>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Bottom row: Q3 (Nieważne i pilne) & Q4 (Nieważne i niepilne) */}
            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: QUADRANT_CONFIG.Q3_NOT_IMPORTANT_URGENT.bgLight,
                  border: `1px solid ${QUADRANT_CONFIG.Q3_NOT_IMPORTANT_URGENT.border}`,
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: QUADRANT_CONFIG.Q3_NOT_IMPORTANT_URGENT.color }}>
                      Q3: {QUADRANT_CONFIG.Q3_NOT_IMPORTANT_URGENT.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {QUADRANT_CONFIG.Q3_NOT_IMPORTANT_URGENT.subtitle}
                    </Typography>
                  </Box>
                  <Chip
                    label={quadrantTasks.Q3_NOT_IMPORTANT_URGENT.length}
                    size="small"
                    sx={{
                      bgcolor: QUADRANT_CONFIG.Q3_NOT_IMPORTANT_URGENT.color,
                      color: 'white',
                      fontWeight: 800,
                    }}
                  />
                </Stack>
                <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 320 }}>
                  {quadrantTasks.Q3_NOT_IMPORTANT_URGENT.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      Brak zadań w tej ćwiartce
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>{quadrantTasks.Q3_NOT_IMPORTANT_URGENT.map(renderTaskDotOrCard)}</Stack>
                  )}
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: QUADRANT_CONFIG.Q4_NOT_IMPORTANT_NOT_URGENT.bgLight,
                  border: `1px solid ${QUADRANT_CONFIG.Q4_NOT_IMPORTANT_NOT_URGENT.border}`,
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: QUADRANT_CONFIG.Q4_NOT_IMPORTANT_NOT_URGENT.color }}>
                      Q4: {QUADRANT_CONFIG.Q4_NOT_IMPORTANT_NOT_URGENT.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {QUADRANT_CONFIG.Q4_NOT_IMPORTANT_NOT_URGENT.subtitle}
                    </Typography>
                  </Box>
                  <Chip
                    label={quadrantTasks.Q4_NOT_IMPORTANT_NOT_URGENT.length}
                    size="small"
                    sx={{
                      bgcolor: QUADRANT_CONFIG.Q4_NOT_IMPORTANT_NOT_URGENT.color,
                      color: 'white',
                      fontWeight: 800,
                    }}
                  />
                </Stack>
                <Box sx={{ flex: 1, overflowY: 'auto', maxHeight: 320 }}>
                  {quadrantTasks.Q4_NOT_IMPORTANT_NOT_URGENT.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      Brak zadań w tej ćwiartce
                    </Typography>
                  ) : (
                    <Stack spacing={1.5}>{quadrantTasks.Q4_NOT_IMPORTANT_NOT_URGENT.map(renderTaskDotOrCard)}</Stack>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}
    </Card>
  );
}

