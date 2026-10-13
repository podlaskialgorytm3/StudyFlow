'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Stack,
  Chip,
  Tooltip,
  Paper,
  LinearProgress,
  Divider,
  alpha,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarsIcon from '@mui/icons-material/Stars';
import { TaskItem, SubjectItem } from '@/components/Tasks/TaskFormDialog';
import {
  EisenhowerSettings,
  EisenhowerQuadrant,
  QUADRANT_CONFIG,
  EisenhowerClassification,
} from '@/lib/domain/eisenhower';
import { formatHumanDuration } from '@/lib/utils/formatTime';
import { TaskStatus } from '@prisma/client';

export interface QuadrantTaskItem {
  task: TaskItem;
  classification: EisenhowerClassification;
}

interface EisenhowerBubbleViewProps {
  quadrantTasks: Record<EisenhowerQuadrant, QuadrantTaskItem[]>;
  settings: EisenhowerSettings;
  subjects: SubjectItem[];
  onSelectTask: (task: TaskItem) => void;
  isMobile: boolean;
  mobileTab: number;
}

// Calculate bubble radius from Story Points (1 to 10)
export function getBubbleRadius(storyPoints: number): number {
  const num = typeof storyPoints === 'number' && !isNaN(storyPoints) ? storyPoints : 3;
  const sp = Math.max(1, Math.min(10, num));
  // Radius from 19px (diameter 38px) up to 34px (diameter 68px)
  return Math.round(19 + ((sp - 1) / 9) * 15);
}

// Extract concise initials from task title
export function getTaskInitials(title: string): string {
  if (!title) return '??';
  const clean = title.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

// Ensure high contrast text for any background hex color
export function getContrastTextColor(hexColor?: string | null): string {
  if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 155 ? '#0f172a' : '#ffffff';
}

interface PositionedBubble {
  task: TaskItem;
  classification: EisenhowerClassification;
  radius: number;
  leftPercent: number;
  topPercent: number;
}

// Deterministic positioning with collision repulsion inside quadrant bounds
function computeQuadrantBubblePositions(
  items: QuadrantTaskItem[],
  quadrantKey: EisenhowerQuadrant,
  settings: EisenhowerSettings
): PositionedBubble[] {
  if (items.length === 0) return [];

  const W = 500;
  const H = 340;

  const isUrgentQuad = quadrantKey === 'Q1_IMPORTANT_URGENT' || quadrantKey === 'Q3_NOT_IMPORTANT_URGENT';

  // Step 1: Initial deterministic positions based on task parameters
  const bubbles = items.map((item) => {
    const sp = Math.max(1, Math.min(10, item.task.storyPoints || 3));
    const r = getBubbleRadius(sp);
    const days = item.classification.daysRemaining;

    // Y axis: High SP near top, low SP near bottom
    const yRatio = (sp - 1) / 9; // 0 for 1 SP, 1 for 10 SP
    const baseY = (H - 2 * r - 75) * (1 - yRatio) + r + 50;

    // X axis: Urgency / Days remaining
    let baseX: number;
    if (isUrgentQuad) {
      // Urgent: days <= urgentWithinDays. Smaller days = further left (more urgent)
      const ratio = Math.max(0, Math.min(1, (days ?? 0) / Math.max(1, settings.urgentWithinDays)));
      baseX = (W - 2 * r - 70) * ratio + r + 35;
    } else {
      // Not urgent: days > urgentWithinDays. Larger days = further right
      const safeDays = days ?? settings.urgentWithinDays + 7;
      const ratio = Math.max(0, Math.min(1, (safeDays - settings.urgentWithinDays) / 14));
      baseX = (W - 2 * r - 70) * ratio + r + 35;
    }

    // Deterministic hash offset based on task.id to avoid exact coordinate overlap
    let hash = 0;
    for (let k = 0; k < item.task.id.length; k++) {
      hash = (hash * 31 + item.task.id.charCodeAt(k)) & 0xffffffff;
    }
    const offsetX = ((Math.abs(hash) % 70) - 35);
    const offsetY = ((Math.abs(hash >> 3) % 40) - 20);

    const x = Math.max(r + 18, Math.min(W - r - 18, baseX + offsetX));
    const y = Math.max(r + 48, Math.min(H - r - 20, baseY + offsetY));

    return {
      task: item.task,
      classification: item.classification,
      radius: r,
      x,
      y,
    };
  });

  // Step 2: Deterministic collision repulsion loop (35 iterations)
  const iterations = 35;
  const padding = 8; // minimum distance between bubble boundaries

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const b1 = bubbles[i];
        const b2 = bubbles[j];

        let dx = b2.x - b1.x;
        let dy = b2.y - b1.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = b1.radius + b2.radius + padding;

        if (dist < minDist) {
          if (dist < 0.001) {
            dx = 1;
            dy = 0;
            dist = 1;
          }
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;

          b1.x -= nx * overlap;
          b1.y -= ny * overlap;
          b2.x += nx * overlap;
          b2.y += ny * overlap;
        }
      }
    }

    // Clamp inside quadrant bounds after each iteration
    for (const b of bubbles) {
      b.x = Math.max(b.radius + 16, Math.min(W - b.radius - 16, b.x));
      b.y = Math.max(b.radius + 48, Math.min(H - b.radius - 18, b.y));
    }
  }

  // Convert to responsive percentages
  return bubbles.map((b) => ({
    task: b.task,
    classification: b.classification,
    radius: b.radius,
    leftPercent: (b.x / W) * 100,
    topPercent: (b.y / H) * 100,
  }));
}

export default function EisenhowerBubbleView({
  quadrantTasks,
  settings,
  subjects,
  onSelectTask,
  isMobile,
  mobileTab,
}: EisenhowerBubbleViewProps) {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // Compute positioned bubbles for all 4 quadrants
  const positionedByQuadrant = useMemo(() => {
    const keys: EisenhowerQuadrant[] = [
      'Q1_IMPORTANT_URGENT',
      'Q2_IMPORTANT_NOT_URGENT',
      'Q3_NOT_IMPORTANT_URGENT',
      'Q4_NOT_IMPORTANT_NOT_URGENT',
    ];

    const result: Record<EisenhowerQuadrant, PositionedBubble[]> = {
      Q1_IMPORTANT_URGENT: [],
      Q2_IMPORTANT_NOT_URGENT: [],
      Q3_NOT_IMPORTANT_URGENT: [],
      Q4_NOT_IMPORTANT_NOT_URGENT: [],
    };

    for (const qKey of keys) {
      result[qKey] = computeQuadrantBubblePositions(quadrantTasks[qKey], qKey, settings);
    }

    return result;
  }, [quadrantTasks, settings]);

  const quadrantKeys: EisenhowerQuadrant[] = [
    'Q1_IMPORTANT_URGENT',
    'Q2_IMPORTANT_NOT_URGENT',
    'Q3_NOT_IMPORTANT_URGENT',
    'Q4_NOT_IMPORTANT_NOT_URGENT',
  ];

  // Render an individual interactive bubble with rich tooltip
  const renderBubble = (bubble: PositionedBubble, qKey: EisenhowerQuadrant) => {
    const { task, classification, radius, leftPercent, topPercent } = bubble;
    const color = task.subject?.color || '#1976d2';
    const textColor = getContrastTextColor(color);
    const initials = getTaskInitials(task.title);
    const diameter = radius * 2;
    const isHovered = hoveredTaskId === task.id;
    const isDone = task.status === TaskStatus.DONE;
    const qConf = QUADRANT_CONFIG[qKey];

    // Rich tooltip content
    const tooltipContent = (
      <Box sx={{ p: 1, maxWidth: 280 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            {task.subject?.name || 'Przedmiot'} {task.category ? `• ${task.category.name}` : ''}
          </Typography>
        </Stack>

        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, lineHeight: 1.3 }}>
          {task.title}
        </Typography>

        <Chip
          label={`${qConf.code}: ${qConf.label}`}
          size="small"
          sx={{
            mb: 1.5,
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 700,
            bgcolor: alpha(qConf.color, 0.15),
            color: qConf.color,
            border: `1px solid ${qConf.color}`,
          }}
        />

        <Stack spacing={0.75} sx={{ mb: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Nakład (Story Points):
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {task.storyPoints} SP {task.storyPoints >= 7 ? '(Wysoki)' : task.storyPoints >= 4 ? '(Średni)' : '(Niski)'}
            </Typography>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Szacowany czas:
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {formatHumanDuration((task.estimatedMinutes ?? 60) * 60)}
            </Typography>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Termin:
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: classification.isOverdue ? 'error.main' : classification.isDueToday ? 'warning.main' : 'text.primary',
              }}
            >
              {task.dueDate
                ? classification.isOverdue
                  ? `${Math.abs(classification.daysRemaining || 0)}d po terminie`
                  : classification.isDueToday
                  ? 'Dzisiaj!'
                  : `Za ${classification.daysRemaining} dni`
                : 'Bez terminu'}
            </Typography>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Status:
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {task.status}
            </Typography>
          </Stack>
        </Stack>

        <Box sx={{ mb: 1 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Postęp:
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {task.progressPercent ?? 0}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={task.progressPercent ?? 0}
            color={isDone ? 'success' : 'primary'}
            sx={{ height: 4, borderRadius: 2 }}
          />
        </Box>

        <Typography variant="caption" color="primary" sx={{ display: 'block', fontStyle: 'italic', textAlign: 'center', mt: 1 }}>
          Kliknij kropkę, aby otworzyć szczegóły zadania
        </Typography>
      </Box>
    );

    return (
      <Tooltip
        key={task.id}
        title={tooltipContent}
        arrow
        placement="top"
        enterDelay={100}
        leaveTouchDelay={4000}
        componentsProps={{
          tooltip: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0',
              borderRadius: 2,
              p: 1.5,
            },
          },
          arrow: {
            sx: {
              color: 'background.paper',
              '&::before': {
                border: '1px solid #e2e8f0',
              },
            },
          },
        }}
      >
        <Box
          onClick={(e) => {
            e.stopPropagation();
            onSelectTask(task);
          }}
          onMouseEnter={() => setHoveredTaskId(task.id)}
          onMouseLeave={() => setHoveredTaskId(null)}
          sx={{
            position: 'absolute',
            left: `${leftPercent}%`,
            top: `${topPercent}%`,
            width: diameter,
            height: diameter,
            borderRadius: '50%',
            transform: isHovered
              ? 'translate(-50%, -50%) scale(1.15)'
              : 'translate(-50%, -50%) scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
            cursor: 'pointer',
            zIndex: isHovered ? 40 : 10,
            // Realistic bubble styling with gradient depth and color matching
            background: `radial-gradient(circle at 35% 35%, ${alpha(color, 0.95)} 0%, ${color} 70%, ${alpha(color, 1)} 100%)`,
            border: `2px solid ${alpha(color, 0.85)}`,
            boxShadow: isHovered
              ? `0 10px 24px ${alpha(color, 0.6)}, 0 0 0 4px ${alpha(color, 0.25)}`
              : `0 4px 14px ${alpha(color, 0.38)}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          {isDone ? (
            <CheckCircleIcon sx={{ color: textColor, fontSize: radius * 1.1 }} />
          ) : (
            <>
              <Typography
                variant="caption"
                sx={{
                  color: textColor,
                  fontWeight: 900,
                  fontSize: radius >= 28 ? '0.85rem' : radius >= 24 ? '0.75rem' : '0.65rem',
                  lineHeight: 1,
                  letterSpacing: '0.02em',
                  textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                {initials}
              </Typography>
              {radius >= 26 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: textColor,
                    fontWeight: 700,
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    mt: 0.2,
                    opacity: 0.9,
                    textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                  }}
                >
                  {task.storyPoints} SP
                </Typography>
              )}
            </>
          )}
        </Box>
      </Tooltip>
    );
  };

  // Render a quadrant canvas box
  const renderQuadrantArea = (qKey: EisenhowerQuadrant, isSingleMobileView = false) => {
    const qConf = QUADRANT_CONFIG[qKey];
    const bubbles = positionedByQuadrant[qKey];
    const count = quadrantTasks[qKey].length;

    return (
      <Box
        sx={{
          position: 'relative',
          height: isSingleMobileView ? 380 : 340,
          bgcolor: qConf.bgLight,
          borderRadius: 2.5,
          border: `1.5px solid ${qConf.border}`,
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.015)',
        }}
      >
        {/* Quadrant Watermark Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            position: 'absolute',
            top: 10,
            left: 12,
            right: 12,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 900,
                color: qConf.color,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                lineHeight: 1.2,
              }}
            >
              <span>{qConf.code}: {qConf.label}</span>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
              {qConf.subtitle}
            </Typography>
          </Box>

          <Chip
            label={`${count} ${count === 1 ? 'zadanie' : count < 5 ? 'zadania' : 'zadań'}`}
            size="small"
            sx={{
              bgcolor: qConf.color,
              color: 'white',
              fontWeight: 800,
              fontSize: '0.7rem',
              height: 22,
            }}
          />
        </Stack>

        {/* Empty state when no tasks */}
        {bubbles.length === 0 ? (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Brak zadań w tej ćwiartce
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Dodaj zadanie z odpowiednim terminem lub Story Points
            </Typography>
          </Box>
        ) : (
          bubbles.map((b) => renderBubble(b, qKey))
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Axis Headers & Direction Hints */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 2,
          bgcolor: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          spacing={1.5}
        >
          {/* Vertical axis explanation */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'primary.main', fontWeight: 700 }}>
              <ArrowUpwardIcon fontSize="small" />
              <ArrowDownwardIcon fontSize="small" />
            </Stack>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              OŚ PIONOWA (Y):{' '}
              <strong style={{ color: '#1e293b' }}>
                Nakład pracy / Trudność (Story Points 1–10)
              </strong>{' '}
              — wyżej to większa pracochłonność
            </Typography>
          </Stack>

          {/* Horizontal axis explanation */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: '#ed6c02', fontWeight: 700 }}>
              <ArrowBackIcon fontSize="small" />
              <ArrowForwardIcon fontSize="small" />
            </Stack>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              OŚ POZIOMA (X):{' '}
              <strong style={{ color: '#1e293b' }}>
                Pilność & Termin oddania
              </strong>{' '}
              — po lewej zadania pilne (≤ {settings.urgentWithinDays} dni), po prawej do zaplanowania
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Matrix Content */}
      {isMobile ? (
        // Mobile View: Shows the active tab's quadrant in detail
        <Box>
          {renderQuadrantArea(quadrantKeys[mobileTab], true)}
        </Box>
      ) : (
        // Desktop 2x2 Quadrant Grid
        <Box sx={{ position: 'relative' }}>
          <Grid container spacing={2}>
            {/* Top row: Q1 & Q2 */}
            <Grid item xs={12} sm={6}>
              {renderQuadrantArea('Q1_IMPORTANT_URGENT')}
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderQuadrantArea('Q2_IMPORTANT_NOT_URGENT')}
            </Grid>

            {/* Bottom row: Q3 & Q4 */}
            <Grid item xs={12} sm={6}>
              {renderQuadrantArea('Q3_NOT_IMPORTANT_URGENT')}
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderQuadrantArea('Q4_NOT_IMPORTANT_NOT_URGENT')}
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Visual Legend */}
      <Paper
        elevation={0}
        sx={{
          mt: 2.5,
          p: 2,
          borderRadius: 2,
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          flexWrap="wrap"
        >
          {/* Bubble Size Legend */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
              Wielkość kropki:
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                1–3 SP (Niski nakład)
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                4–6 SP (Średni nakład)
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  bgcolor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                7–10 SP (Wysoki nakład)
              </Typography>
            </Stack>
          </Stack>

          {/* Subjects Legend */}
          {subjects.length > 0 && (
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
                Kolory przedmiotów:
              </Typography>
              {subjects.map((s) => (
                <Stack key={s.id} direction="row" spacing={0.75} alignItems="center">
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: s.color || '#1976d2',
                    }}
                  />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {s.name}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

