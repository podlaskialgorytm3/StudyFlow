'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SecurityIcon from '@mui/icons-material/Security';
import { useRouter } from 'next/navigation';
import AppNavbar from '@/components/Navigation/AppNavbar';
import { Role } from '@prisma/client';

interface AdminUser {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  _count: {
    subjects: number;
    tasks: number;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: Role } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const me = await meRes.json();
      setCurrentUser(me);

      if (me.role !== Role.ADMIN) {
        setError('Brak uprawnień. Dostęp do panelu administratora jest zablokowany.');
        setLoading(false);
        return;
      }

      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
      } else {
        setError('Nie udało się pobrać listy kont użytkowników');
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleToggleRole = async (user: AdminUser) => {
    const nextRole = user.role === Role.ADMIN ? Role.STUDENT : Role.ADMIN;
    if (!window.confirm(`Czy na pewno chcesz zmienić rolę użytkownika ${user.username} na ${nextRole}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });

      if (res.ok) {
        fetchAdminData();
      } else {
        const d = await res.json();
        alert(d.error || 'Błąd aktualizacji roli');
      }
    } catch {
      alert('Błąd połączenia');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setUserToDelete(null);
        fetchAdminData();
      } else {
        const d = await res.json();
        alert(d.error || 'Błąd usuwania konta');
      }
    } catch {
      alert('Błąd połączenia');
    } finally {
      setSubmitting(false);
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

  if (error && (!currentUser || currentUser.role !== Role.ADMIN)) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
        <AppNavbar />
        <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={() => router.push('/dashboard')}>
            Wróć do Dashboardu
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 8 }}>
      <AppNavbar />

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <AdminPanelSettingsIcon color="secondary" sx={{ fontSize: 36 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            Panel Administratora
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Bezpieczne zarządzanie kontami użytkowników. Prywatne treści zadań są chronione i niewidoczne w panelu.
        </Typography>

        <Card sx={{ p: 2, mb: 3, bgcolor: '#fdf4ff', border: '1px solid #f0abfc' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SecurityIcon color="secondary" />
            <Typography variant="body2" color="text.secondary">
              Konto administratora zostało zainicjowane ze zmiennych środowiskowych. Zmiana ról użytkowników jest rejestrowana i kontrolowana po stronie serwera.
            </Typography>
          </Stack>
        </Card>

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Użytkownik</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rola</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Data rejestracji</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Przedmioty</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Zadania</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Zarządzanie
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {u.username}
                        {isSelf && ' (Twoje konto)'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {u.id}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={u.role === Role.ADMIN ? 'ADMIN' : 'STUDENT'}
                        color={u.role === Role.ADMIN ? 'secondary' : 'default'}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {new Date(u.createdAt).toLocaleDateString('pl-PL', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{u._count.subjects}</Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{u._count.tasks}</Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<SwapHorizIcon />}
                          disabled={isSelf}
                          onClick={() => handleToggleRole(u)}
                          title="Zmień rolę"
                        >
                          Zmień rolę
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={isSelf}
                          onClick={() => setUserToDelete(u)}
                          title="Usuń konto"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(userToDelete)} onClose={() => setUserToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>
          Usuwanie konta użytkownika
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1">
            Czy na pewno chcesz usunąć konto użytkownika <strong>{userToDelete?.username}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Spowoduje to bezpowrotne usunięcie wszystkich jego przedmiotów, kategorii i zadań.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setUserToDelete(null)} disabled={submitting}>
            Anuluj
          </Button>
          <Button onClick={handleDeleteUser} variant="contained" color="error" disabled={submitting}>
            {submitting ? 'Usuwanie...' : 'Usuń konto'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
