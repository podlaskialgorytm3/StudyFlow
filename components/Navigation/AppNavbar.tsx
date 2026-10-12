'use client';

import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Badge,
  Menu,
  MenuItem,
  Box,
  Stack,
  Divider,
  ListItemIcon,
  ListItemText,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  Chip,
  Container,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import SchoolIcon from '@mui/icons-material/School';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

export interface UserSession {
  id: string;
  username: string;
  role: Role;
}

export interface NotificationTask {
  id: string;
  title: string;
  subjectName: string;
  isOverdue: boolean;
  isDueToday: boolean;
  daysRemaining: number | null;
}

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserSession | null>(null);
  const [notifications, setNotifications] = useState<NotificationTask[]>([]);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Fetch current user and notifications
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          router.push('/login');
        }
      } catch {
        // ignore
      }
    };

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/tasks?includeDone=false');
        if (res.ok) {
          const tasks = await res.json();
          const now = new Date();
          const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

          const urgentItems: NotificationTask[] = [];

          for (const t of tasks) {
            if (!t.dueDate) continue;
            const due = new Date(t.dueDate);
            const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
            const diffDays = Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
              urgentItems.push({
                id: t.id,
                title: t.title,
                subjectName: t.subject?.name || 'Przedmiot',
                isOverdue: diffDays < 0,
                isDueToday: diffDays === 0,
                daysRemaining: diffDays,
              });
            }
          }

          setNotifications(urgentItems);
        }
      } catch {
        // ignore
      }
    };

    fetchUserData();
    fetchNotifications();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard', icon: <GridViewIcon fontSize="small" /> },
    { label: 'Zadania', href: '/tasks', icon: <FormatListBulletedIcon fontSize="small" /> },
    { label: 'Przedmioty', href: '/subjects', icon: <SchoolIcon fontSize="small" /> },
    { label: 'Ustawienia', href: '/settings', icon: <SettingsIcon fontSize="small" /> },
  ];

  if (user?.role === Role.ADMIN) {
    navLinks.push({
      label: 'Panel Admina',
      href: '/admin',
      icon: <AdminPanelSettingsIcon fontSize="small" />,
    });
  }

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary', borderBottom: '1px solid #e2e8f0' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 64 }}>
            {/* Left: Brand & Mobile Hamburger */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton
                sx={{ display: { xs: 'flex', md: 'none' } }}
                onClick={() => setMobileOpen(true)}
                aria-label="Otwórz menu"
              >
                <MenuIcon />
              </IconButton>
              <Link href="/dashboard" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                <GridViewIcon color="primary" sx={{ fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  StudyFlow
                </Typography>
              </Link>
            </Stack>

            {/* Desktop Navigation Links */}
            <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {navLinks.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Button
                    key={item.href}
                    component={Link}
                    href={item.href}
                    startIcon={item.icon}
                    variant={isActive ? 'contained' : 'text'}
                    color={isActive ? 'primary' : 'inherit'}
                    sx={{
                      px: 2,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#ffffff' : 'text.secondary',
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Stack>

            {/* Right: Notifications & User profile */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {/* Notification Bell */}
              <IconButton
                color="inherit"
                aria-label="Powiadomienia w aplikacji"
                onClick={(e) => setNotifAnchor(e.currentTarget)}
              >
                <Badge badgeContent={notifications.length} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>

              <Menu
                anchorEl={notifAnchor}
                open={Boolean(notifAnchor)}
                onClose={() => setNotifAnchor(null)}
                PaperProps={{
                  sx: { width: 340, maxHeight: 420, borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
                }}
              >
                <Box sx={{ p: 2, pb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Powiadomienia
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {notifications.length === 0
                      ? 'Brak pilnych zadań z terminem dzisiaj lub po terminie.'
                      : `${notifications.length} zadań wymaga uwagi`}
                  </Typography>
                </Box>
                <Divider />

                {notifications.length === 0 ? (
                  <MenuItem disabled sx={{ py: 3, justifyContent: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Wszystko zrobione na czas! 🎉
                    </Typography>
                  </MenuItem>
                ) : (
                  notifications.map((n) => (
                    <MenuItem
                      key={n.id}
                      component={Link}
                      href={`/tasks`}
                      onClick={() => setNotifAnchor(null)}
                      sx={{ py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                        {n.isOverdue ? (
                          <WarningAmberIcon color="error" fontSize="small" />
                        ) : (
                          <EventAvailableIcon color="warning" fontSize="small" />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={n.isOverdue ? `Po terminie` : 'Termin dzisiaj'}
                          color={n.isOverdue ? 'error' : 'warning'}
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5 }}>
                        {n.subjectName}
                      </Typography>
                    </MenuItem>
                  ))
                )}
              </Menu>

              {/* User display & logout */}
              {user && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {user.username}
                    </Typography>
                    <Chip
                      size="small"
                      label={user.role === Role.ADMIN ? 'Administrator' : 'Student'}
                      color={user.role === Role.ADMIN ? 'secondary' : 'default'}
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  </Box>
                  <IconButton onClick={handleLogout} color="default" title="Wyloguj się">
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 260, p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <GridViewIcon color="primary" sx={{ fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              StudyFlow
            </Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          <List>
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    selected={isActive}
                    sx={{ borderRadius: 2 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: isActive ? 'primary.main' : 'inherit' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          <Divider sx={{ my: 2 }} />
          <Button
            variant="outlined"
            color="error"
            fullWidth
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Wyloguj się
          </Button>
        </Box>
      </Drawer>
    </>
  );
}

