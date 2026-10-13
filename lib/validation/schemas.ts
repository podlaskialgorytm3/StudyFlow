import { z } from 'zod';
import { TaskStatus, PriorityOverride, UrgencyOverride } from '@prisma/client';

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Login musi mieć co najmniej 3 znaki')
    .max(30, 'Login może mieć maksymalnie 30 znaków')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Login może zawierać tylko litery, cyfry, podkreślenie i myślnik'),
  password: z
    .string()
    .min(6, 'Hasło musi mieć co najmniej 6 znaków')
    .max(100, 'Hasło może mieć maksymalnie 100 znaków'),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Podaj login'),
  password: z.string().min(1, 'Podaj hasło'),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Nazwa przedmiotu jest wymagana').max(80, 'Nazwa może mieć maksymalnie 80 znaków'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Niepoprawny format koloru (np. #1976d2)')
    .optional()
    .nullable(),
  description: z.string().trim().max(500, 'Opis może mieć maksymalnie 500 znaków').optional().nullable(),
});

export const categorySchema = z.object({
  subjectId: z.string().uuid('Nieprawidłowy identyfikator przedmiotu'),
  name: z.string().trim().min(1, 'Nazwa kategorii jest wymagana').max(80, 'Nazwa może mieć maksymalnie 80 znaków'),
  description: z.string().trim().max(500, 'Opis może mieć maksymalnie 500 znaków').optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nazwa kategorii jest wymagana').max(80, 'Nazwa może mieć maksymalnie 80 znaków'),
  description: z.string().trim().max(500, 'Opis może mieć maksymalnie 500 znaków').optional().nullable(),
});

export const taskSchema = z.object({
  subjectId: z.string().uuid('Wybierz prawidłowy przedmiot'),
  categoryId: z.string().uuid('Nieprawidłowa kategoria').optional().nullable(),
  title: z.string().trim().min(1, 'Tytuł zadania jest wymagany').max(120, 'Tytuł może mieć maksymalnie 120 znaków'),
  description: z.string().trim().max(1000, 'Opis może mieć maksymalnie 1000 znaków').optional().nullable(),
  dueDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Niepoprawny format daty')
    .optional()
    .nullable(),
  storyPoints: z
    .number()
    .int('Story Points musi być liczbą całkowitą')
    .min(1, 'Minimalna wartość Story Points to 1')
    .max(10, 'Maksymalna wartość Story Points to 10'),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.NEW),
  priorityOverride: z.nativeEnum(PriorityOverride).optional().nullable(),
  urgencyOverride: z.nativeEnum(UrgencyOverride).optional().nullable(),
});

export const taskUpdateSchema = taskSchema.partial();

export const settingsSchema = z.object({
  importantStoryPointsThreshold: z
    .number()
    .int('Próg ważności musi być liczbą całkowitą')
    .min(1, 'Próg ważności musi wynosić od 1 do 10')
    .max(10, 'Próg ważności musi wynosić od 1 do 10'),
  urgentWithinDays: z
    .number()
    .int('Próg pilności w dniach musi być liczbą całkowitą')
    .min(0, 'Próg pilności w dniach nie może być ujemny')
    .max(365, 'Maksymalny próg to 365 dni'),
  taskHorizonDays: z
    .number()
    .int('Interwał musi być liczbą całkowitą')
    .min(1, 'Minimalny interwał to 1 dzień')
    .max(90, 'Maksymalny interwał to 90 dni')
    .default(7),
});

