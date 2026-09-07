import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Something went wrong
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
          {this.state.error.message || 'An unexpected error occurred.'}
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
        >
          Reload
        </Button>
      </Box>
    );
  }
}
