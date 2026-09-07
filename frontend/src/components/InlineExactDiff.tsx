import React from 'react';
import { Box, Typography, Tooltip, useTheme, Chip } from '@mui/material';
import { getWordDiff, calculateDiffStats, DiffPart } from '../utils/diffHelper';

interface InlineExactDiffProps {
  oldValue: string;
  newValue: string;
  maxChars?: number;
  onInspect?: () => void;
}

export const InlineExactDiff: React.FC<InlineExactDiffProps> = ({
  oldValue,
  newValue,
  maxChars = 60,
  onInspect,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const oldText = oldValue === 'None' ? '' : oldValue;
  const newText = newValue === '(deleted)' ? '' : newValue;

  // If both empty or identical
  if (!oldText && !newText) {
    return <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>No change</Typography>;
  }

  // If node deleted
  if (newValue === '(deleted)' || (!newText && oldText)) {
    return (
      <Tooltip title="View deleted node XML in Inspector">
        <Box
          onClick={onInspect}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: onInspect ? 'pointer' : 'default',
            p: '2px 6px',
            borderRadius: 1,
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.74rem',
              color: isDark ? '#f87171' : '#b91c1c',
              textDecoration: 'line-through',
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            - {oldText}
          </Typography>
          <Chip label="DELETED" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, backgroundColor: 'transparent', color: '#ef4444' }} />
        </Box>
      </Tooltip>
    );
  }

  // If new node added
  if (oldValue === 'None' || (!oldText && newText)) {
    return (
      <Tooltip title="View added node XML in Inspector">
        <Box
          onClick={onInspect}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: onInspect ? 'pointer' : 'default',
            p: '2px 6px',
            borderRadius: 1,
            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: isDark ? '#4ade80' : '#15803d',
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            + {newText}
          </Typography>
          <Chip label="ADDED" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, backgroundColor: 'transparent', color: '#22c55e' }} />
        </Box>
      </Tooltip>
    );
  }

  // If it's a multi-line or long XML document edit
  const isMultiLine = oldText.includes('\n') || newText.includes('\n');
  if (isMultiLine || oldText.length > 120 || newText.length > 120) {
    const stats = calculateDiffStats(oldText, newText);
    return (
      <Box
        onClick={onInspect}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: onInspect ? 'pointer' : 'default',
          p: '3px 8px',
          borderRadius: 1,
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
          border: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            borderColor: theme.palette.primary.main,
          },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.74rem' }}>
          Exact diff:
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: '0.72rem',
            color: isDark ? '#4ade80' : '#15803d',
          }}
        >
          +{stats.additions}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: '0.72rem',
            color: isDark ? '#f87171' : '#b91c1c',
          }}
        >
          -{stats.deletions}
        </Typography>
        <Typography variant="caption" sx={{ color: theme.palette.primary.main, textDecoration: 'underline', fontSize: '0.72rem' }}>
          Inspect Changes
        </Typography>
      </Box>
    );
  }

  // Standard inline word diff
  const diffParts: DiffPart[] = getWordDiff(oldText, newText);

  return (
    <Box
      onClick={onInspect}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: onInspect ? 'pointer' : 'default',
        p: '2px 6px',
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
        maxWidth: 320,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
      }}
    >
      {diffParts.map((part, index) => {
        if (part.added) {
          return (
            <Box
              component="span"
              key={index}
              sx={{
                color: isDark ? '#4ade80' : '#15803d',
                backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
                px: 0.4,
                py: 0.1,
                borderRadius: 0.5,
                fontWeight: 700,
              }}
            >
              +{part.value}
            </Box>
          );
        }
        if (part.removed) {
          return (
            <Box
              component="span"
              key={index}
              sx={{
                color: isDark ? '#f87171' : '#b91c1c',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                px: 0.4,
                py: 0.1,
                borderRadius: 0.5,
                textDecoration: 'line-through',
              }}
            >
              -{part.value}
            </Box>
          );
        }
        return (
          <Box component="span" key={index} sx={{ color: theme.palette.text.secondary }}>
            {part.value}
          </Box>
        );
      })}
    </Box>
  );
};
