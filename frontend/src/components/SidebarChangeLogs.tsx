import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  useTheme,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useXmlManager } from '../context/XmlManagerContext';

interface SidebarChangeLogsProps {
  onViewAllHistory?: () => void;
  onOpenS3Modal?: () => void;
}

export const SidebarChangeLogs: React.FC<SidebarChangeLogsProps> = ({
  onViewAllHistory,
  onOpenS3Modal,
}) => {
  const theme = useTheme();
  const { history, s3Config, isSyncing, document } = useXmlManager();

  const recentLogs = history.slice(0, 7);

  const formatDisplayTime = (timestamp: string) => {
    // If timestamp starts with YYYY-MM-DD or time, simplify to readable format like "Today, 10:42 AM"
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isToday = new Date().toDateString() === date.toDateString();
        return isToday ? `Today, ${timeStr}` : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
      }
    } catch {
      // fallback
    }
    return timestamp;
  };

  return (
    <Box
      component="aside"
      sx={{
        width: 280,
        flexShrink: 0,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: theme.palette.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Change Logs
        </Typography>
        <Box
          component="span"
          sx={{
            px: 1,
            py: 0.25,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
            color: theme.palette.mode === 'dark' ? '#93c5fd' : '#2563eb',
            borderRadius: '4px',
            fontSize: '0.625rem',
            fontWeight: 600,
          }}
        >
          Activity Stream
        </Box>
      </Box>

      {/* Logs Table / List */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Box
          component="table"
          sx={{
            width: '100%',
            textAlign: 'left',
            borderCollapse: 'collapse',
          }}
        >
          <Box component="thead">
            <Box
              component="tr"
              sx={{
                backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box
                component="th"
                sx={{
                  px: 2,
                  py: 1,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: theme.palette.text.secondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Timestamp
              </Box>
              <Box
                component="th"
                sx={{
                  px: 2,
                  py: 1,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: theme.palette.text.secondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'right',
                }}
              >
                Status
              </Box>
            </Box>
          </Box>

          <Box component="tbody">
            {recentLogs.length === 0 ? (
              <Box component="tr">
                <Box
                  component="td"
                  colSpan={2}
                  sx={{
                    px: 2,
                    py: 3,
                    textAlign: 'center',
                    color: theme.palette.text.secondary,
                    fontSize: '0.75rem',
                  }}
                >
                  No changes recorded yet. Edit fields to create history logs.
                </Box>
              </Box>
            ) : (
              recentLogs.map((entry) => (
                <Box
                  component="tr"
                  key={entry.id}
                  onClick={onViewAllHistory}
                  sx={{
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    backgroundColor:
                      entry.status === 'pending'
                        ? theme.palette.mode === 'dark'
                          ? 'rgba(37, 99, 235, 0.08)'
                          : 'rgba(239, 246, 255, 0.6)'
                        : 'inherit',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc',
                    },
                  }}
                >
                  <Box component="td" sx={{ px: 2, py: 1.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                      }}
                    >
                      {formatDisplayTime(entry.timestamp)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        color: theme.palette.text.secondary,
                        fontFamily: 'monospace',
                        fontStyle: 'italic',
                        display: 'block',
                        mt: 0.25,
                      }}
                    >
                      {document ? document.fileName : entry.nodeTag || 'config.xml'}
                    </Typography>
                  </Box>

                  <Box component="td" sx={{ px: 2, py: 1.5, textAlign: 'right', verticalAlign: 'middle' }}>
                    {entry.status === 'synced' && (
                      <Box
                        component="span"
                        sx={{
                          px: 1,
                          py: 0.25,
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        SYNCED
                      </Box>
                    )}
                    {entry.status === 'pending' && (
                      <Box
                        component="span"
                        sx={{
                          px: 1,
                          py: 0.25,
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        PENDING
                      </Box>
                    )}
                    {entry.status === 'failed' && (
                      <Box
                        component="span"
                        sx={{
                          px: 1,
                          py: 0.25,
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        FAILED
                      </Box>
                    )}
                    {entry.status === 'reverted' && (
                      <Box
                        component="span"
                        sx={{
                          px: 1,
                          py: 0.25,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          borderRadius: '9999px',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        REVERTED
                      </Box>
                    )}
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Box>

      {/* Storage Status Card */}
      <Box sx={{ p: 2 }}>
        <Paper
          sx={{
            p: 2,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #1e293b',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.625rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              Storage Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#4ade80',
                  boxShadow: '0 0 6px #4ade80',
                }}
              />
              <Typography variant="caption" sx={{ color: '#4ade80', fontSize: '0.625rem', fontWeight: 600 }}>
                Active
              </Typography>
            </Box>
          </Box>

          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#cbd5e1',
              mb: 1.25,
              wordBreak: 'break-all',
            }}
          >
            {s3Config.objectKey || 'No object key set'}
          </Typography>

          {/* Progress bar */}
          <Box
            sx={{
              width: '100%',
              height: 5,
              backgroundColor: '#334155',
              borderRadius: '9999px',
              overflow: 'hidden',
              mb: 0.75,
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: document ? `${Math.min(100, Math.max(15, (document.fileSize / (1024 * 1024)) * 25))}%` : '20%',
                backgroundColor: '#3b82f6',
                borderRadius: '9999px',
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#94a3b8' }}>
            <span>{document ? `${(document.fileSize / 1024).toFixed(1)} KB` : '12.4 MB'}</span>
            <span>5 GB quota</span>
          </Box>

          {onOpenS3Modal && (
            <Button
              fullWidth
              size="small"
              onClick={onOpenS3Modal}
              startIcon={<CloudUploadIcon sx={{ fontSize: '0.9rem' }} />}
              sx={{
                mt: 1.5,
                fontSize: '0.68rem',
                py: 0.4,
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                borderRadius: '6px',
                border: '1px solid #334155',
                '&:hover': {
                  backgroundColor: '#2563eb',
                  borderColor: '#2563eb',
                  color: '#ffffff',
                },
              }}
            >
              {isSyncing ? 'Syncing S3...' : 'Configure / Sync S3'}
            </Button>
          )}
        </Paper>
      </Box>
    </Box>
  );
};
