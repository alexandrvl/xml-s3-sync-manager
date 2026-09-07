import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  ButtonGroup,
  useTheme,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import CodeIcon from '@mui/icons-material/Code';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { ChangeLogEntry } from '../types';
import { getWordDiff, getCharDiff, getLineDiff, calculateDiffStats, DiffPart, DiffLine } from '../utils/diffHelper';

interface DiffViewerModalProps {
  open: boolean;
  onClose: () => void;
  entry: ChangeLogEntry | null;
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({ open, onClose, entry }) => {
  const theme = useTheme();
  const [diffMode, setDiffMode] = useState<'inline' | 'split' | 'lines'>('inline');
  const [granularity, setGranularity] = useState<'words' | 'chars'>('words');
  const [copiedType, setCopiedType] = useState<'old' | 'new' | null>(null);

  if (!entry) return null;

  const isDark = theme.palette.mode === 'dark';
  const oldVal = entry.oldValue === 'None' ? '' : entry.oldValue;
  const newVal = entry.newValue === '(deleted)' ? '' : entry.newValue;
  const isMultiLine = oldVal.includes('\n') || newVal.includes('\n');

  const stats = calculateDiffStats(oldVal, newVal);
  const wordDiff: DiffPart[] = granularity === 'words' ? getWordDiff(oldVal, newVal) : getCharDiff(oldVal, newVal);
  const lineDiff: DiffLine[] = getLineDiff(oldVal, newVal);

  const handleCopy = (text: string, type: 'old' | 'new') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          p: 2,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            Exact Change Diff Inspector
          </Typography>
          <Chip
            size="small"
            label={entry.changeType.replace('_', ' ')}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.7rem', height: 24 }}
          />
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Metadata & Stats Strip */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            p: 1.5,
            borderRadius: '8px',
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          {/* Node path and timestamp */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                Target Node:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: isDark ? '#93c5fd' : '#1d4ed8',
                }}
              >
                {entry.nodePath}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Edited by <strong>{entry.user}</strong> &bull; {entry.timestamp}
            </Typography>
          </Box>

          {/* Additions & Deletions Stat Badges */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={`+${stats.additions} added`}
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
                color: isDark ? '#4ade80' : '#15803d',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            />
            <Chip
              size="small"
              label={`-${stats.deletions} removed`}
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                color: isDark ? '#f87171' : '#b91c1c',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            />
          </Box>
        </Box>

        {/* Diff Mode Controls Toolbar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <ButtonGroup size="small" variant="outlined">
            <Button
              variant={diffMode === 'inline' ? 'contained' : 'outlined'}
              onClick={() => setDiffMode('inline')}
              startIcon={<ViewStreamIcon fontSize="small" />}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Inline Diff
            </Button>
            <Button
              variant={diffMode === 'split' ? 'contained' : 'outlined'}
              onClick={() => setDiffMode('split')}
              startIcon={<ViewColumnIcon fontSize="small" />}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              Side-by-Side
            </Button>
            {isMultiLine && (
              <Button
                variant={diffMode === 'lines' ? 'contained' : 'outlined'}
                onClick={() => setDiffMode('lines')}
                startIcon={<CodeIcon fontSize="small" />}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                Line Gutter Diff
              </Button>
            )}
          </ButtonGroup>

          {diffMode === 'inline' && !isMultiLine && (
            <ButtonGroup size="small" variant="outlined">
              <Button
                variant={granularity === 'words' ? 'contained' : 'outlined'}
                onClick={() => setGranularity('words')}
                sx={{ fontSize: '0.72rem', textTransform: 'none' }}
              >
                Words
              </Button>
              <Button
                variant={granularity === 'chars' ? 'contained' : 'outlined'}
                onClick={() => setGranularity('chars')}
                sx={{ fontSize: '0.72rem', textTransform: 'none' }}
              >
                Characters
              </Button>
            </ButtonGroup>
          )}
        </Box>

        {/* Main Diff Display Area */}
        <Box
          sx={{
            borderRadius: '8px',
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: isDark ? '#0b1120' : '#ffffff',
            overflow: 'hidden',
          }}
        >
          {/* MODE 1: Inline Word / Character Diff */}
          {diffMode === 'inline' && (
            <Box sx={{ p: 2, maxHeight: 420, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.8 }}>
              {wordDiff.map((part, index) => {
                if (part.added) {
                  return (
                    <Box
                      component="span"
                      key={index}
                      sx={{
                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)',
                        color: isDark ? '#4ade80' : '#15803d',
                        px: 0.4,
                        py: 0.1,
                        borderRadius: '3px',
                        borderBottom: '2px solid #22c55e',
                        fontWeight: 600,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {part.value}
                    </Box>
                  );
                }
                if (part.removed) {
                  return (
                    <Box
                      component="span"
                      key={index}
                      sx={{
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                        color: isDark ? '#f87171' : '#b91c1c',
                        px: 0.4,
                        py: 0.1,
                        borderRadius: '3px',
                        textDecoration: 'line-through',
                        borderBottom: '2px solid #ef4444',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {part.value}
                    </Box>
                  );
                }
                return (
                  <Box component="span" key={index} sx={{ whiteSpace: 'pre-wrap', color: theme.palette.text.primary }}>
                    {part.value}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* MODE 2: Side-by-Side Diff */}
          {diffMode === 'split' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', divider: `1px solid ${theme.palette.divider}` }}>
              {/* Left Column: Original / Before */}
              <Box sx={{ borderRight: `1px solid ${theme.palette.divider}`, display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    p: 1,
                    px: 1.5,
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? '#f87171' : '#b91c1c' }}>
                    BEFORE (Original)
                  </Typography>
                  <Tooltip title={copiedType === 'old' ? 'Copied!' : 'Copy Original'}>
                    <IconButton size="small" onClick={() => handleCopy(oldVal, 'old')} sx={{ p: 0.25 }}>
                      {copiedType === 'old' ? <CheckIcon fontSize="small" sx={{ color: '#22c55e' }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    maxHeight: 420,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    color: isDark ? '#fca5a5' : '#991b1b',
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.04)' : '#fffafa',
                  }}
                >
                  {oldVal || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>(empty / new node)</span>}
                </Box>
              </Box>

              {/* Right Column: Modified / After */}
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    p: 1,
                    px: 1.5,
                    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : '#f0fdf4',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? '#4ade80' : '#15803d' }}>
                    AFTER (Modified)
                  </Typography>
                  <Tooltip title={copiedType === 'new' ? 'Copied!' : 'Copy Modified'}>
                    <IconButton size="small" onClick={() => handleCopy(newVal, 'new')} sx={{ p: 0.25 }}>
                      {copiedType === 'new' ? <CheckIcon fontSize="small" sx={{ color: '#22c55e' }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    maxHeight: 420,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    color: isDark ? '#86efac' : '#166534',
                    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.04)' : '#f8fdf9',
                  }}
                >
                  {newVal || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>(deleted)</span>}
                </Box>
              </Box>
            </Box>
          )}

          {/* MODE 3: Line Gutter Diff */}
          {diffMode === 'lines' && (
            <Box sx={{ maxHeight: 420, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.78rem' }}>
              {lineDiff.map((lineObj, idx) => {
                const isAdd = lineObj.type === 'added';
                const isDel = lineObj.type === 'removed';
                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'stretch',
                      backgroundColor: isAdd
                        ? isDark
                          ? 'rgba(34, 197, 94, 0.15)'
                          : '#dcfce7'
                        : isDel
                        ? isDark
                          ? 'rgba(239, 68, 68, 0.15)'
                          : '#fee2e2'
                        : 'transparent',
                      borderLeft: isAdd
                        ? '3px solid #22c55e'
                        : isDel
                        ? '3px solid #ef4444'
                        : '3px solid transparent',
                      py: 0.2,
                    }}
                  >
                    {/* Line numbers and sign */}
                    <Box
                      sx={{
                        width: 70,
                        flexShrink: 0,
                        display: 'flex',
                        justifyContent: 'space-between',
                        px: 1,
                        userSelect: 'none',
                        color: theme.palette.text.disabled,
                        fontSize: '0.7rem',
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <span>{lineObj.oldLineNumber || ''}</span>
                      <span>{lineObj.newLineNumber || ''}</span>
                      <strong style={{ color: isAdd ? '#22c55e' : isDel ? '#ef4444' : 'inherit' }}>
                        {isAdd ? '+' : isDel ? '-' : ' '}
                      </strong>
                    </Box>

                    {/* Code Content */}
                    <Box
                      sx={{
                        px: 1.5,
                        flex: 1,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: isAdd
                          ? isDark
                            ? '#4ade80'
                            : '#15803d'
                          : isDel
                          ? isDark
                            ? '#f87171'
                            : '#b91c1c'
                          : theme.palette.text.primary,
                      }}
                    >
                      {lineObj.line || ' '}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 2.5, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} size="small" variant="outlined">
          Close Inspector
        </Button>
      </DialogActions>
    </Dialog>
  );
};
