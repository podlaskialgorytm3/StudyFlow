'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Button,
  Paper,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FiberNewIcon from '@mui/icons-material/FiberNew';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

import { TaskItem } from '@/components/Tasks/TaskFormDialog';
import {
  classifyEisenhowerTask,
  EisenhowerSettings,
  QUADRANT_CONFIG,
} from '@/lib/domain/eisenhower';
import { TaskStatus } from '@prisma/client';

interface KanbanColumnConfig {
  status: TaskStatus;
  title: string;
  subtitle: string;
  color: string;
  bgLight: string;
  border: string;
  icon: React.ReactNode;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    status: TaskStatus.NEW,
    title: 'Nowe',
    subtitle: 'Świeżo dodane zadania',
    color: '#0284c7',
    bgLight: '#f0f9ff',
    border: '#bae6fd',
    icon: <FiberNewIcon sx={{ fontSize: 22 }} />,
  },
  {
    status: TaskStatus.TODO,
    title: 'Do zrobienia',
    subtitle: 'Zaplanowane do rozpoczęcia',
    color: '#6366f1',
    bgLight: '#eef2ff',
    border: '#c7d2fe',
    icon: <FormatListBulletedIcon sx={{ fontSize: 20 }} />,
  },
  {
    status: TaskStatus.IN_PROGRESS,
    title: 'W trakcie',
    subtitle: 'Aktualnie realizowane',
    color: '#d97706',
    bgLight: '#fffbeb',
    border: '#fde68a',
    icon: <AutorenewIcon sx={{ fontSize: 20 }} />,
  },
  {
    status: TaskStatus.DONE,
    title: 'Ukończone',
    subtitle: 'Zaliczone i zrealizowane',
    color: '#10b981',
    bgLight: '#ecfdf5',
    border: '#a7f3d0',
    icon: <CheckCircleIcon sx={{ fontSize: 20 }} />,
  },
];

const STATUS_SEQUENCE: TaskStatus[] = [
  TaskStatus.NEW,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
];

interface TaskKanbanBoardProps {
  tasks: TaskItem[];
  settings: EisenhowerSettings;
  onSelectTask: (task: TaskItem) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onAddTaskToStatus: (status: TaskStatus) => void;
}

export default function TaskKanbanBoard({
  tasks,
  settings,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onAddTaskToStatus,
}: TaskKanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== status) {
      setDragOverCol(status);
    }
  };

  const handleDragLeave = (status: TaskStatus) => {
    if (dragOverCol === status) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverCol(null);
    setDraggedTaskId(null);

    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== targetStatus) {
        onStatusChange(taskId, targetStatus);
      }
    }
  };

  const handleMoveStep = (task: TaskItem, direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = STATUS_SEQUENCE.indexOf(task.status);
    if (direction === 'prev' && currentIndex > 0) {
      onStatusChange(task.id, STATUS_SEQUENCE[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < STATUS_SEQUENCE.length - 1) {
      onStatusChange(task.id, STATUS_SEQUENCE[currentIndex + 1]);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2.5,
        overflowX: 'auto',
        pb: 2,
        pt: 1,
        // Make sure it looks great on desktop and scrolls smoothly on mobile
        minHeight: '650px',
        alignItems: 'stretch',
      }}
    >
      {KANBAN_COLUMNS.map((column) => {
        const colTasks = tasks.filter((t) => t.status === column.status);
        const totalSP = colTasks.reduce((sum, t) => sum + t.storyPoints, 0);
        const isDragTarget = dragOverCol === column.status;
        const colIndex = STATUS_SEQUENCE.indexOf(column.status);

        return (
          <Box
            key={column.status}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={() => handleDragLeave(column.status)}
            onDrop={(e) => handleDrop(e, column.status)}
            sx={{
              flex: '1 1 300px',
              minWidth: { xs: '280px', sm: '310px' },
              maxWidth: { xs: '320px', md: '360px' },
              display: 'flex',
              flexDirection: 'column',
              bgcolor: isDragTarget ? '#f1f5f9' : '#f8fafc',
              borderRadius: 3,
              border: `2px ${isDragTarget ? 'dashed ' + column.color : 'solid ' + column.border}`,
              transition: 'all 0.2s ease',
              boxShadow: isDragTarget ? `0 0 0 3px ${column.border}` : 'none',
            }}
          >
            {/* Column Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: `1px solid ${column.border}`,
                bgcolor: column.bgLight,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ color: column.color, display: 'flex' }}>{column.icon}</Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: column.color }}>
                    {column.title}
                  </Typography>
                </Stack>

                <Tooltip title={`Dodaj zadanie do: ${column.title}`}>
                  <IconButton
                    size="small"
                    onClick={() => onAddTaskToStatus(column.status)}
                    sx={{
                      bgcolor: 'white',
                      border: '1px solid #e2e8f0',
                      '&:hover': { bgcolor: column.bgLight, borderColor: column.color },
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Chip
                  label={`${colTasks.length} zadań`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: 'white',
                    color: 'text.primary',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Chip
                  label={`${totalSP} SP`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: column.color,
                    color: 'white',
                  }}
                />
              </Stack>
            </Box>

            {/* Task Cards Container */}
            <Box
              sx={{
                p: 1.5,
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                minHeight: '200px',
              }}
            >
              {colTasks.length === 0 ? (
                <Box
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '1px dashed #cbd5e1',
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.6)',
                    my: 'auto',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Przeciągnij zadanie tutaj lub kliknij + aby dodać
                  </Typography>
                </Box>
              ) : (
                colTasks.map((t) => {
                  const classification = classifyEisenhowerTask(t, settings);
                  const qConf = QUADRANT_CONFIG[classification.quadrant];
                  const isDone = t.status === TaskStatus.DONE;
                  const isOverridden = classification.isPriorityOverridden || classification.isUrgencyOverridden;

                  return (
                    <Card
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectTask(t)}
                      sx={{
                        cursor: 'grab',
                        '&:active': { cursor: 'grabbing' },
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        borderLeft: `5px solid ${t.subject?.color || '#1976d2'}`,
                        opacity: draggedTaskId === t.id ? 0.4 : 1,
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        {/* Top: Subject & Story Points */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                            <DragIndicatorIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color: t.subject?.color || '#1976d2',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {t.subject?.name}
                            </Typography>
                          </Stack>

                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip
                              label={`${t.storyPoints} SP`}
                              size="small"
                              color={t.storyPoints >= settings.importantStoryPointsThreshold ? 'primary' : 'default'}
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }}
                            />
                            <Chip
                              label={formatHumanDuration((t.estimatedMinutes ?? 60) * 60)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                            />
                          </Stack>
                        </Stack>

                        {/* Title */}
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.3,
                            mb: 1,
                            textDecoration: isDone ? 'line-through' : 'none',
                            color: isDone ? 'text.secondary' : 'text.primary',
                          }}
                        >
                          {t.title}
                        </Typography>

                        {/* Description snippet */}
                        {t.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              mb: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.3,
                            }}
                          >
                            {t.description}
                          </Typography>
                        )}

                        {/* Category & Eisenhower Quadrant Badge */}
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 1.5, gap: 0.5 }}>
                          {t.category && (
                            <Chip
                              label={t.category.name}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                            />
                          )}

                          <Tooltip title={`${qConf.label} (${qConf.subtitle})`}>
                            <Chip
                              label={qConf.code}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                bgcolor: qConf.bgLight,
                                color: qConf.color,
                                border: `1px solid ${qConf.border}`,
                              }}
                            />
                          </Tooltip>

                          {isOverridden && (
                            <Tooltip title="Ręcznie nadpisana w macierzy">
                              <EditNoteIcon fontSize="small" color="action" />
                            </Tooltip>
                          )}
                        </Stack>

                        {/* Due Date & Action controls */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          {t.dueDate ? (
                            <Chip
                              size="small"
                              icon={<AccessTimeIcon sx={{ fontSize: '0.75rem !important' }} />}
                              label={
                                classification.isOverdue
                                  ? `${Math.abs(classification.daysRemaining || 0)}d po terminie`
                                  : classification.isDueToday
                                  ? 'Dziś'
                                  : `${new Date(t.dueDate).toLocaleDateString('pl-PL')}`
                              }
                              color={
                                classification.isOverdue
                                  ? 'error'
                                  : classification.isDueToday
                                  ? 'warning'
                                  : 'default'
                              }
                              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              Bez terminu
                            </Typography>
                          )}

                          {/* Quick Shift buttons */}
                          <Stack direction="row" spacing={0.25} onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              size="small"
                              disabled={colIndex === 0}
                              onClick={(e) => handleMoveStep(t, 'prev', e)}
                              title="Cofnij status"
                              sx={{ p: 0.5 }}
                            >
                              <ArrowBackIcon sx={{ fontSize: 16 }} />
                            </IconButton>

                            <IconButton
                              size="small"
                              disabled={colIndex === STATUS_SEQUENCE.length - 1}
                              onClick={(e) => handleMoveStep(t, 'next', e)}
                              title="Przesuń do kolejnego statusu"
                              sx={{ p: 0.5 }}
                            >
                              <ArrowForwardIcon sx={{ fontSize: 16 }} />
                            </IconButton>

                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTask(t);
                              }}
                              title="Edytuj"
                              sx={{ p: 0.5 }}
                            >
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>

                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask(t.id);
                              }}
                              title="Usuń"
                              sx={{ p: 0.5 }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

