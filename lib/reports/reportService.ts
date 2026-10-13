import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';
import { formatHumanDuration } from '@/lib/utils/formatTime';
import { TaskStatus } from '@prisma/client';
import { classifyEisenhowerTask, EisenhowerSettings } from '@/lib/domain/eisenhower';

export interface WeeklyReportSummaryData {
  username: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  stats: {
    completedCount: number;
    inProgressCount: number;
    activeCount: number;
    overdueCount: number;
    plannedCount: number;
    completionRatePercent: number;
    totalStudyTimeSeconds: number;
    formattedStudyTime: string;
    sessionCount: number;
    averageSessionMinutes: number;
    prevWeekTotalSeconds: number;
    studyTimeChangePercent: number | null;
  };
  completedTasks: Array<{
    id: string;
    title: string;
    subjectName: string;
    categoryName?: string | null;
    completedAt: string;
    timeSpentSeconds: number;
    storyPoints: number;
  }>;
  inProgressTasks: Array<{
    id: string;
    title: string;
    subjectName: string;
    dueDate?: string | null;
    progressPercent: number;
    timeSpentSeconds: number;
    isOverdue: boolean;
    storyPoints: number;
  }>;
  backlogAndOverdueTasks: Array<{
    id: string;
    title: string;
    subjectName: string;
    status: string;
    dueDate?: string | null;
    isOverdue: boolean;
    dueNextWeek: boolean;
    storyPoints: number;
  }>;
  studyTimeBySubject: Array<{
    subjectName: string;
    durationSeconds: number;
    formattedDuration: string;
    percentOfTotal: number;
  }>;
  nextWeekPlan: Array<{
    id: string;
    title: string;
    subjectName: string;
    dueDate?: string | null;
    priorityReason: string;
    storyPoints: number;
  }>;
}

/**
 * Calculates the standard weekly reporting range:
 * From Monday 00:00:00 to Sunday 22:00:00 of the given week.
 */
export function getWeekRange(referenceDate: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(22, 0, 0, 0);

  return { weekStart: monday, weekEnd: sunday };
}

/**
 * Calculates the previous week's reporting range.
 */
export function getPreviousWeekRange(referenceDate: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const { weekStart } = getWeekRange(referenceDate);
  const prevMonday = new Date(weekStart);
  prevMonday.setDate(weekStart.getDate() - 7);
  prevMonday.setHours(0, 0, 0, 0);

  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  prevSunday.setHours(22, 0, 0, 0);

  return { weekStart: prevMonday, weekEnd: prevSunday };
}

/**
 * Gathers and aggregates all real study data for a given user and week.
 */
export async function calculateWeeklyReportData(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyReportSummaryData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });

  if (!user) {
    throw new Error('Użytkownik nie istnieje');
  }

  const defaultSettings: EisenhowerSettings = {
    importantStoryPointsThreshold: user.settings?.importantStoryPointsThreshold ?? 6,
    urgentWithinDays: user.settings?.urgentWithinDays ?? 3,
  };

  // Previous week range for comparison
  const { weekStart: prevWeekStart, weekEnd: prevWeekEnd } = getPreviousWeekRange(weekStart);

  // Next week end for planning
  const nextWeekEnd = new Date(weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Fetch user's tasks
  const allTasks = await prisma.task.findMany({
    where: { ownerId: userId },
    include: {
      subject: true,
      category: true,
      timeEntries: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Fetch time entries for this week and previous week
  const thisWeekTimeEntries = await prisma.taskTimeEntry.findMany({
    where: {
      task: { ownerId: userId },
      createdAt: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      task: {
        include: { subject: true },
      },
    },
  });

  const prevWeekTimeEntries = await prisma.taskTimeEntry.findMany({
    where: {
      task: { ownerId: userId },
      createdAt: {
        gte: prevWeekStart,
        lte: prevWeekEnd,
      },
    },
  });

  const prevWeekTotalSeconds = prevWeekTimeEntries.reduce((acc, e) => acc + e.durationSeconds, 0);
  const totalStudyTimeSeconds = thisWeekTimeEntries.reduce((acc, e) => acc + e.durationSeconds, 0);
  const sessionCount = thisWeekTimeEntries.length;
  const averageSessionMinutes = sessionCount > 0 ? Math.round(totalStudyTimeSeconds / sessionCount / 60) : 0;

  // Study time comparison with previous week
  let studyTimeChangePercent: number | null = null;
  if (prevWeekTotalSeconds > 0) {
    studyTimeChangePercent = Math.round(((totalStudyTimeSeconds - prevWeekTotalSeconds) / prevWeekTotalSeconds) * 100);
  }

  // Study time by subject
  const subjectTimeMap = new Map<string, { duration: number; color?: string | null }>();
  for (const entry of thisWeekTimeEntries) {
    const sName = entry.task.subject.name;
    const existing = subjectTimeMap.get(sName) || { duration: 0, color: entry.task.subject.color };
    existing.duration += entry.durationSeconds;
    subjectTimeMap.set(sName, existing);
  }

  const studyTimeBySubject = Array.from(subjectTimeMap.entries())
    .map(([subjectName, { duration }]) => ({
      subjectName,
      durationSeconds: duration,
      formattedDuration: formatHumanDuration(duration),
      percentOfTotal: totalStudyTimeSeconds > 0 ? Math.round((duration / totalStudyTimeSeconds) * 100) : 0,
    }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);

  // 3. Classify tasks
  // A. Completed in this week
  const completedTasksList = allTasks.filter((t) => {
    if (t.status !== TaskStatus.DONE) return false;
    const compDate = t.completedAt || t.updatedAt;
    return compDate >= weekStart && compDate <= weekEnd;
  });

  const completedTasks = completedTasksList.map((t) => ({
    id: t.id,
    title: t.title,
    subjectName: t.subject.name,
    categoryName: t.category?.name || null,
    completedAt: (t.completedAt || t.updatedAt).toISOString(),
    timeSpentSeconds: t.timeSpentSeconds,
    storyPoints: t.storyPoints,
  }));

  // B. In progress at report time
  const inProgressList = allTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS);
  const inProgressTasks = inProgressList.map((t) => {
    const isOverdue = Boolean(t.dueDate && new Date(t.dueDate) < weekEnd);
    return {
      id: t.id,
      title: t.title,
      subjectName: t.subject.name,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      progressPercent: t.progressPercent,
      timeSpentSeconds: t.timeSpentSeconds,
      isOverdue,
      storyPoints: t.storyPoints,
    };
  });

  // C. Backlog, New, Todo & Overdue tasks
  const uncompletedTasks = allTasks.filter((t) => t.status !== TaskStatus.DONE);
  const overdueTasks = uncompletedTasks.filter((t) => Boolean(t.dueDate && new Date(t.dueDate) < weekEnd));
  const activeCount = uncompletedTasks.length;

  const backlogAndOverdueTasks = uncompletedTasks.map((t) => {
    const isOverdue = Boolean(t.dueDate && new Date(t.dueDate) < weekEnd);
    const dueNextWeek = Boolean(
      t.dueDate &&
      new Date(t.dueDate) >= weekEnd &&
      new Date(t.dueDate) <= nextWeekEnd
    );
    return {
      id: t.id,
      title: t.title,
      subjectName: t.subject.name,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      isOverdue,
      dueNextWeek,
      storyPoints: t.storyPoints,
    };
  }).filter((t) => t.isOverdue || t.dueNextWeek || t.status === TaskStatus.TODO);

  // Planned tasks: tasks due this week or completed this week
  const plannedThisWeek = allTasks.filter((t) => {
    if (t.dueDate && new Date(t.dueDate) >= weekStart && new Date(t.dueDate) <= weekEnd) return true;
    const compDate = t.completedAt || t.updatedAt;
    return t.status === TaskStatus.DONE && compDate >= weekStart && compDate <= weekEnd;
  });

  const plannedCount = plannedThisWeek.length;
  const completionRatePercent = plannedCount > 0
    ? Math.round((completedTasks.length / plannedCount) * 100)
    : completedTasks.length > 0
    ? 100
    : 0;

  // D. Next Week Plan recommendations
  const candidateTasks = uncompletedTasks.slice();
  candidateTasks.sort((a, b) => {
    const aClass = classifyEisenhowerTask(a, defaultSettings, weekEnd);
    const bClass = classifyEisenhowerTask(b, defaultSettings, weekEnd);

    // Overdue first
    if (aClass.isOverdue !== bClass.isOverdue) return aClass.isOverdue ? -1 : 1;
    // Q1 first
    const aQ1 = aClass.quadrant === 'Q1_IMPORTANT_URGENT';
    const bQ1 = bClass.quadrant === 'Q1_IMPORTANT_URGENT';
    if (aQ1 !== bQ1) return aQ1 ? -1 : 1;
    // Deadline closer first
    const aDays = aClass.daysRemaining ?? 999;
    const bDays = bClass.daysRemaining ?? 999;
    if (aDays !== bDays) return aDays - bDays;
    // Story points
    return b.storyPoints - a.storyPoints;
  });

  const nextWeekPlan = candidateTasks.slice(0, 5).map((t) => {
    const classification = classifyEisenhowerTask(t, defaultSettings, weekEnd);
    let priorityReason = 'Zadanie zaplanowane';
    if (classification.isOverdue) priorityReason = 'Pilne: zaległość z poprzedniego tygodnia';
    else if (classification.quadrant === 'Q1_IMPORTANT_URGENT') priorityReason = 'Ważne i pilne (Q1)';
    else if (classification.daysRemaining !== null && classification.daysRemaining <= 7) priorityReason = 'Termin w nadchodzącym tygodniu';
    else if (t.status === TaskStatus.IN_PROGRESS) priorityReason = 'Kontynuacja rozpoczętej pracy';

    return {
      id: t.id,
      title: t.title,
      subjectName: t.subject.name,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      priorityReason,
      storyPoints: t.storyPoints,
    };
  });

  return {
    username: user.username,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    stats: {
      completedCount: completedTasks.length,
      inProgressCount: inProgressTasks.length,
      activeCount,
      overdueCount: overdueTasks.length,
      plannedCount,
      completionRatePercent,
      totalStudyTimeSeconds,
      formattedStudyTime: formatHumanDuration(totalStudyTimeSeconds),
      sessionCount,
      averageSessionMinutes,
      prevWeekTotalSeconds,
      studyTimeChangePercent,
    },
    completedTasks,
    inProgressTasks,
    backlogAndOverdueTasks,
    studyTimeBySubject,
    nextWeekPlan,
  };
}

/**
 * Generates an A4 PDF document using PDFKit with full Polish character support.
 */
export async function generateWeeklyPdf(data: WeeklyReportSummaryData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
        bufferPages: true,
        autoFirstPage: true,
      });

      // Register bundled TrueType fonts
      const regularFontPath = path.join(process.cwd(), 'assets/fonts/LiberationSans-Regular.ttf');
      const boldFontPath = path.join(process.cwd(), 'assets/fonts/LiberationSans-Bold.ttf');

      if (fs.existsSync(regularFontPath)) {
        doc.registerFont('Liberation', regularFontPath);
      }
      if (fs.existsSync(boldFontPath)) {
        doc.registerFont('Liberation-Bold', boldFontPath);
      }

      const fontRegular = fs.existsSync(regularFontPath) ? 'Liberation' : 'Helvetica';
      const fontBold = fs.existsSync(boldFontPath) ? 'Liberation-Bold' : 'Helvetica-Bold';

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;

      const startDateFormatted = new Date(data.weekStart).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const endDateFormatted = new Date(data.weekEnd).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const genDateFormatted = new Date(data.generatedAt).toLocaleString('pl-PL');

      // --- SECTION A: HEADER BANNER ---
      doc.rect(startX, 40, pageWidth, 68).fill('#4f46e5');

      doc.font(fontBold).fontSize(16).fillColor('#ffffff').text('StudyFlow', startX + 16, 50);
      doc.font(fontBold).fontSize(13).fillColor('#ffffff').text('Raport tygodniowy postępów w nauce', startX + 16, 68);
      doc.font(fontRegular).fontSize(9).fillColor('#e0e7ff').text(`Okres: ${startDateFormatted} – ${endDateFormatted} • Użytkownik: ${data.username}`, startX + 16, 86);

      doc.y = 120;

      // --- SECTION B: PODSUMOWANIE TYGODNIA (KPI Cards) ---
      doc.font(fontBold).fontSize(12).fillColor('#1e293b').text('B. Podsumowanie tygodnia');
      doc.y += 6;

      const cardWidth = (pageWidth - 30) / 4;
      const cardHeight = 52;
      const cardY = doc.y;

      const statsToDisplay = [
        { label: 'Ukończone zadania', value: `${data.stats.completedCount}`, color: '#10b981' },
        { label: 'Zarejestrowany czas', value: data.stats.formattedStudyTime, color: '#4f46e5' },
        { label: 'Zadania w toku', value: `${data.stats.inProgressCount}`, color: '#0284c7' },
        { label: 'Przeterminowane', value: `${data.stats.overdueCount}`, color: data.stats.overdueCount > 0 ? '#ef4444' : '#64748b' },
      ];

      statsToDisplay.forEach((s, idx) => {
        const x = startX + idx * (cardWidth + 10);
        doc.rect(x, cardY, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.font(fontBold).fontSize(14).fillColor(s.color).text(s.value, x + 8, cardY + 10, { width: cardWidth - 16, align: 'center' });
        doc.font(fontRegular).fontSize(8).fillColor('#64748b').text(s.label, x + 4, cardY + 30, { width: cardWidth - 8, align: 'center' });
      });

      doc.y = cardY + cardHeight + 15;

      // Sub-stats: Sesje i realizacja planu
      const subStatsText = `Liczba sesji nauki: ${data.stats.sessionCount} • Średni czas sesji: ${data.stats.averageSessionMinutes} min • Realizacja planu tygodnia: ${data.stats.completionRatePercent}%` +
        (data.stats.studyTimeChangePercent !== null ? ` • Zmiana czasu vs poprz. tydzień: ${data.stats.studyTimeChangePercent > 0 ? '+' : ''}${data.stats.studyTimeChangePercent}%` : '');

      doc.font(fontRegular).fontSize(8.5).fillColor('#475569').text(subStatsText, startX, doc.y);
      doc.y += 15;

      // Helper for tables
      const checkPageOverflow = (neededHeight: number) => {
        if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
        }
      };

      // --- SECTION C: ZADANIA UKOŃCZONE ---
      checkPageOverflow(80);
      doc.font(fontBold).fontSize(12).fillColor('#1e293b').text(`C. Zadania ukończone w tym tygodniu (${data.completedTasks.length})`);
      doc.y += 6;

      if (data.completedTasks.length === 0) {
        doc.font(fontRegular).fontSize(9).fillColor('#64748b').text('Brak ukończonych zadań w raportowanym tygodniu.', startX + 8, doc.y);
        doc.y += 14;
      } else {
        const colWidths = [190, 110, 80, 70, 55];
        const headers = ['Tytuł zadania', 'Przedmiot', 'Data ukończenia', 'Czas nauki', 'Waga'];

        // Header
        const headerY = doc.y;
        doc.rect(startX, headerY, pageWidth, 18).fill('#f1f5f9');
        let curX = startX + 6;
        headers.forEach((h, i) => {
          doc.font(fontBold).fontSize(8).fillColor('#334155').text(h, curX, headerY + 4, { width: colWidths[i] });
          curX += colWidths[i];
        });
        doc.y = headerY + 20;

        // Rows
        data.completedTasks.forEach((t) => {
          checkPageOverflow(22);
          const rowY = doc.y;
          doc.rect(startX, rowY, pageWidth, 20).stroke('#f1f5f9');

          curX = startX + 6;
          doc.font(fontBold).fontSize(8).fillColor('#0f172a').text(t.title, curX, rowY + 5, { width: colWidths[0] - 8, lineBreak: false });
          curX += colWidths[0];

          doc.font(fontRegular).fontSize(8).fillColor('#334155').text(t.subjectName + (t.categoryName ? ` (${t.categoryName})` : ''), curX, rowY + 5, { width: colWidths[1] - 8, lineBreak: false });
          curX += colWidths[1];

          const dateStr = new Date(t.completedAt).toLocaleDateString('pl-PL');
          doc.font(fontRegular).fontSize(8).fillColor('#475569').text(dateStr, curX, rowY + 5, { width: colWidths[2] });
          curX += colWidths[2];

          doc.font(fontRegular).fontSize(8).fillColor('#059669').text(formatHumanDuration(t.timeSpentSeconds), curX, rowY + 5, { width: colWidths[3] });
          curX += colWidths[3];

          doc.font(fontRegular).fontSize(8).fillColor('#64748b').text(`${t.storyPoints} SP`, curX, rowY + 5, { width: colWidths[4] });

          doc.y = rowY + 22;
        });
      }
      doc.y += 10;

      // --- SECTION D: ZADANIA W TRAKCIE REALIZACJI ---
      checkPageOverflow(80);
      doc.font(fontBold).fontSize(12).fillColor('#1e293b').text(`D. Zadania w trakcie realizacji (${data.inProgressTasks.length})`);
      doc.y += 6;

      if (data.inProgressTasks.length === 0) {
        doc.font(fontRegular).fontSize(9).fillColor('#64748b').text('Brak zadań o statusie „W trakcie realizacji”.', startX + 8, doc.y);
        doc.y += 14;
      } else {
        const colWidths = [190, 110, 80, 65, 60];
        const headers = ['Tytuł zadania', 'Przedmiot', 'Termin oddania', 'Postęp', 'Zarejestr. czas'];

        const headerY = doc.y;
        doc.rect(startX, headerY, pageWidth, 18).fill('#f1f5f9');
        let curX = startX + 6;
        headers.forEach((h, i) => {
          doc.font(fontBold).fontSize(8).fillColor('#334155').text(h, curX, headerY + 4, { width: colWidths[i] });
          curX += colWidths[i];
        });
        doc.y = headerY + 20;

        data.inProgressTasks.forEach((t) => {
          checkPageOverflow(22);
          const rowY = doc.y;
          doc.rect(startX, rowY, pageWidth, 20).stroke('#f1f5f9');

          curX = startX + 6;
          doc.font(fontBold).fontSize(8).fillColor('#0f172a').text(t.title, curX, rowY + 5, { width: colWidths[0] - 8, lineBreak: false });
          curX += colWidths[0];

          doc.font(fontRegular).fontSize(8).fillColor('#334155').text(t.subjectName, curX, rowY + 5, { width: colWidths[1] - 8, lineBreak: false });
          curX += colWidths[1];

          const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('pl-PL') : 'Brak';
          doc.font(fontRegular).fontSize(8).fillColor(t.isOverdue ? '#ef4444' : '#475569').text(dueStr + (t.isOverdue ? ' (!)' : ''), curX, rowY + 5, { width: colWidths[2] });
          curX += colWidths[2];

          doc.font(fontRegular).fontSize(8).fillColor('#0284c7').text(`${t.progressPercent}%`, curX, rowY + 5, { width: colWidths[3] });
          curX += colWidths[3];

          doc.font(fontRegular).fontSize(8).fillColor('#475569').text(formatHumanDuration(t.timeSpentSeconds), curX, rowY + 5, { width: colWidths[4] });

          doc.y = rowY + 22;
        });
      }
      doc.y += 10;

      // --- SECTION E: ZADANIA NIEROZPOCZĘTE I ZALEGŁOŚCI ---
      checkPageOverflow(80);
      doc.font(fontBold).fontSize(12).fillColor('#1e293b').text('E. Zadania nierozpoczęte i zaległości');
      doc.y += 6;

      if (data.backlogAndOverdueTasks.length === 0) {
        doc.font(fontRegular).fontSize(9).fillColor('#64748b').text('Brak zaległości oraz zadań oczekujących na wykonanie.', startX + 8, doc.y);
        doc.y += 14;
      } else {
        const colWidths = [210, 120, 85, 90];
        const headers = ['Tytuł zadania', 'Przedmiot', 'Termin', 'Status zaległości'];

        const headerY = doc.y;
        doc.rect(startX, headerY, pageWidth, 18).fill('#f1f5f9');
        let curX = startX + 6;
        headers.forEach((h, i) => {
          doc.font(fontBold).fontSize(8).fillColor('#334155').text(h, curX, headerY + 4, { width: colWidths[i] });
          curX += colWidths[i];
        });
        doc.y = headerY + 20;

        data.backlogAndOverdueTasks.slice(0, 10).forEach((t) => {
          checkPageOverflow(22);
          const rowY = doc.y;
          doc.rect(startX, rowY, pageWidth, 20).stroke('#f1f5f9');

          curX = startX + 6;
          doc.font(fontBold).fontSize(8).fillColor('#0f172a').text(t.title, curX, rowY + 5, { width: colWidths[0] - 8, lineBreak: false });
          curX += colWidths[0];

          doc.font(fontRegular).fontSize(8).fillColor('#334155').text(t.subjectName, curX, rowY + 5, { width: colWidths[1] - 8, lineBreak: false });
          curX += colWidths[1];

          const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('pl-PL') : 'Brak';
          doc.font(fontRegular).fontSize(8).fillColor(t.isOverdue ? '#ef4444' : '#475569').text(dueStr, curX, rowY + 5, { width: colWidths[2] });
          curX += colWidths[2];

          const badge = t.isOverdue ? 'Przeterminowane' : t.dueNextWeek ? 'Termin w nast. tyg.' : 'Do zrobienia';
          doc.font(fontBold).fontSize(7.5).fillColor(t.isOverdue ? '#ef4444' : '#64748b').text(badge, curX, rowY + 5, { width: colWidths[3] });

          doc.y = rowY + 22;
        });
      }
      doc.y += 10;

      // --- SECTION F: PODSUMOWANIE CZASU NAUKI WG PRZEDMIOTÓW ---
      checkPageOverflow(90);
      doc.font(fontBold).fontSize(12).fillColor('#1e293b').text('F. Podsumowanie czasu nauki wg przedmiotów');
      doc.y += 4;
      doc.font(fontRegular).fontSize(7.5).fillColor('#64748b').text('* Raport uwzględnia czas zarejestrowany stoperem w aplikacji StudyFlow.');
      doc.y += 8;

      if (data.studyTimeBySubject.length === 0) {
        doc.font(fontRegular).fontSize(9).fillColor('#64748b').text('Brak zarejestrowanych sesji nauki w tym tygodniu.', startX + 8, doc.y);
        doc.y += 14;
      } else {
        const colWidths = [210, 110, 95, 90];
        const headers = ['Przedmiot', 'Czas poświęcony', 'Udział %', 'Pasek czasu'];

        const headerY = doc.y;
        doc.rect(startX, headerY, pageWidth, 18).fill('#f1f5f9');
        let curX = startX + 6;
        headers.forEach((h, i) => {
          doc.font(fontBold).fontSize(8).fillColor('#334155').text(h, curX, headerY + 4, { width: colWidths[i] });
          curX += colWidths[i];
        });
        doc.y = headerY + 20;

        data.studyTimeBySubject.forEach((s) => {
          checkPageOverflow(22);
          const rowY = doc.y;
          doc.rect(startX, rowY, pageWidth, 20).stroke('#f1f5f9');

          curX = startX + 6;
          doc.font(fontBold).fontSize(8).fillColor('#0f172a').text(s.subjectName, curX, rowY + 5, { width: colWidths[0] - 8, lineBreak: false });
          curX += colWidths[0];

          doc.font(fontRegular).fontSize(8).fillColor('#4f46e5').text(s.formattedDuration, curX, rowY + 5, { width: colWidths[1] });
          curX += colWidths[1];

          doc.font(fontRegular).fontSize(8).fillColor('#334155').text(`${s.percentOfTotal}%`, curX, rowY + 5, { width: colWidths[2] });
          curX += colWidths[2];

          // Mini progress bar
          doc.rect(curX, rowY + 7, 75, 6).fill('#e2e8f0');
          if (s.percentOfTotal > 0) {
            doc.rect(curX, rowY + 7, Math.max(3, (s.percentOfTotal / 100) * 75), 6).fill('#4f46e5');
          }

          doc.y = rowY + 22;
        });
      }
      doc.y += 10;

      // --- SECTION G: PLAN NA KOLEJNY TYDZIEŃ ---
      checkPageOverflow(85);
      doc.font(fontBold).fontSize(12).fillColor('#1e293b').text('G. Rekomendacje i plan na kolejny tydzień');
      doc.y += 6;

      if (data.nextWeekPlan.length === 0) {
        doc.font(fontRegular).fontSize(9).fillColor('#64748b').text('Brak zaplanowanych zadań w kolejce na kolejny tydzień.', startX + 8, doc.y);
        doc.y += 14;
      } else {
        const colWidths = [200, 110, 85, 110];
        const headers = ['Zadanie', 'Przedmiot', 'Termin', 'Dlaczego rekomendowane?'];

        const headerY = doc.y;
        doc.rect(startX, headerY, pageWidth, 18).fill('#f1f5f9');
        let curX = startX + 6;
        headers.forEach((h, i) => {
          doc.font(fontBold).fontSize(8).fillColor('#334155').text(h, curX, headerY + 4, { width: colWidths[i] });
          curX += colWidths[i];
        });
        doc.y = headerY + 20;

        data.nextWeekPlan.forEach((t) => {
          checkPageOverflow(22);
          const rowY = doc.y;
          doc.rect(startX, rowY, pageWidth, 20).stroke('#f1f5f9');

          curX = startX + 6;
          doc.font(fontBold).fontSize(8).fillColor('#0f172a').text(t.title, curX, rowY + 5, { width: colWidths[0] - 8, lineBreak: false });
          curX += colWidths[0];

          doc.font(fontRegular).fontSize(8).fillColor('#334155').text(t.subjectName, curX, rowY + 5, { width: colWidths[1] - 8, lineBreak: false });
          curX += colWidths[1];

          const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('pl-PL') : 'Brak';
          doc.font(fontRegular).fontSize(8).fillColor('#475569').text(dueStr, curX, rowY + 5, { width: colWidths[2] });
          curX += colWidths[2];

          doc.font(fontRegular).fontSize(7.5).fillColor('#4f46e5').text(t.priorityReason, curX, rowY + 5, { width: colWidths[3] - 4, lineBreak: false });

          doc.y = rowY + 22;
        });
      }

      // --- FOOTERS ON ALL PAGES ---
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const footerY = doc.page.height - 35;
        doc.rect(startX, footerY - 5, pageWidth, 0.5).fill('#cbd5e1');

        doc.font(fontRegular).fontSize(8).fillColor('#94a3b8').text('StudyFlow — Inteligentna organizacja nauki', startX, footerY, { width: pageWidth / 2, align: 'left' });
        doc.font(fontRegular).fontSize(8).fillColor('#94a3b8').text(`Strona ${i + 1} z ${totalPages} • Wygenerowano: ${genDateFormatted}`, startX + pageWidth / 2, footerY, { width: pageWidth / 2, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Creates or retrieves a weekly report.
 * Ensures idempotency: avoids creating duplicates for the same user and week range.
 */
export async function createOrGetWeeklyReport(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
  forceRegenerate: boolean = false
) {
  // Check if report already exists
  const existing = await prisma.weeklyReport.findUnique({
    where: {
      userId_weekStart_weekEnd: {
        userId,
        weekStart,
        weekEnd,
      },
    },
  });

  if (existing && existing.status === 'READY' && !forceRegenerate && existing.pdfData) {
    return existing;
  }

  // Calculate report data
  const summaryData = await calculateWeeklyReportData(userId, weekStart, weekEnd);
  const pdfBuffer = await generateWeeklyPdf(summaryData);

  // Save report to database
  const report = await prisma.weeklyReport.upsert({
    where: {
      userId_weekStart_weekEnd: {
        userId,
        weekStart,
        weekEnd,
      },
    },
    create: {
      userId,
      weekStart,
      weekEnd,
      status: 'READY',
      summaryJson: JSON.stringify(summaryData),
      pdfData: pdfBuffer,
    },
    update: {
      generatedAt: new Date(),
      status: 'READY',
      summaryJson: JSON.stringify(summaryData),
      pdfData: pdfBuffer,
      error: null,
    },
  });

  return report;
}

/**
 * Executes automatic weekly report generation for all active users.
 * Intended to be invoked every Sunday at 22:00 via cron or scheduler endpoint.
 */
export async function runWeeklyReportCronForAllUsers(referenceDate: Date = new Date()) {
  const { weekStart, weekEnd } = getWeekRange(referenceDate);

  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  const results = [];

  for (const user of users) {
    try {
      const report = await createOrGetWeeklyReport(user.id, weekStart, weekEnd, false);
      results.push({
        userId: user.id,
        username: user.username,
        reportId: report.id,
        status: report.status,
      });
    } catch (error: any) {
      results.push({
        userId: user.id,
        username: user.username,
        status: 'FAILED',
        error: error.message || 'Nieznany błąd',
      });
    }
  }

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    totalUsers: users.length,
    results,
  };
}

