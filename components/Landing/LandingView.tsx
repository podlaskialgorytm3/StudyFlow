'use client';

import React from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  AppBar,
  Toolbar,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SecurityIcon from '@mui/icons-material/Security';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import Link from 'next/link';

export default function LandingView() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #e2e8f0' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <GridViewIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
              StudyFlow
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Button component={Link} href="/login" variant="outlined" color="primary">
              Logowanie
            </Button>
            <Button component={Link} href="/register" variant="contained" color="primary">
              Rejestracja
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2.25rem', md: '3.5rem' },
              lineHeight: 1.15,
              mb: 2.5,
              background: 'linear-gradient(90deg, #1e40af, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Organizuj zadania akademickie z macierzą Eisenhowera
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4, fontWeight: 400, maxWidth: 650, mx: 'auto' }}>
            StudyFlow ułatwia studentom priorytetyzację nauki. Przypisuj zadania do przedmiotów, określaj Story Points i termin oddania, a aplikacja natychmiast rozmieści je w odpowiedniej ćwiartce.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mb: 4 }}>
            <Button
              component={Link}
              href="/register"
              variant="contained"
              size="large"
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
            >
              Rozpocznij za darmo
            </Button>
            <Button
              component={Link}
              href="/login"
              variant="outlined"
              size="large"
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
            >
              Mam już konto
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 8, flex: 1 }}>
        <Typography variant="h5" align="center" sx={{ fontWeight: 700, mb: 6 }}>
          Kluczowe możliwości StudyFlow
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', p: 1 }}>
              <CardContent>
                <GridViewIcon color="primary" sx={{ fontSize: 40, mb: 1.5 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                  Macierz Eisenhowera
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Automatyczna klasyfikacja zadań na 4 ćwiartki według Story Points i dni do terminu, z możliwością ręcznej korekty.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', p: 1 }}>
              <CardContent>
                <SchoolIcon color="primary" sx={{ fontSize: 40, mb: 1.5 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                  Przedmioty i kategorie
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Twórz przedmioty z unikalnymi kolorami, dodawaj kategorie takie jak kolokwia, laboratoria czy projekty.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', p: 1 }}>
              <CardContent>
                <CheckCircleOutlineIcon color="primary" sx={{ fontSize: 40, mb: 1.5 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                  Statusy i terminy
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Śledź postęp: Nowe, Do zrobienia, W trakcie, Ukończone. Natychmiastowe przypomnienia o terminach na dziś i po terminie.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', p: 1 }}>
              <CardContent>
                <InstallMobileIcon color="primary" sx={{ fontSize: 40, mb: 1.5 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                  Aplikacja PWA
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Zainstaluj aplikację na telefonie lub komputerze, korzystaj z responsywnego interfejsu dostosowanego do ekranu dotykowego.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      <Box sx={{ py: 3, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          StudyFlow — system organizacji zadań akademickich © {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
}

