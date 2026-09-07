import React, { useState } from 'react';
import { Box, Typography, Tooltip, IconButton, useTheme, Chip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TagIcon from '@mui/icons-material/Tag';

export type PathStyleMode = 'breadcrumb' | 'compact' | 'full';

interface PathBreadcrumbProps {
  path: string;
  tagName: string;
  mode?: PathStyleMode;
  isSplitView?: boolean;
}

export const PathBreadcrumb: React.FC<PathBreadcrumbProps> = ({
  path,
  tagName,
  mode = 'breadcrumb',
  isSplitView = false,
}) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const isDark = theme.palette.mode === 'dark';

  // Parse path segments: e.g. "/catalog/book[0]/title" -> ["catalog", "book[0]", "title"]
  const rawSegments = path
    .split('/')
    .filter((s) => s.trim().length > 0);

  const leaf = rawSegments.length > 0 ? rawSegments[rawSegments.length - 1] : tagName;
  const ancestors = rawSegments.slice(0, -1);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Full XPath Mode
  if (mode === 'full') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: '100%' }}>
        <Tooltip title={path} placement="top" arrow>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.74rem',
              color: isDark ? '#93c5fd' : '#1d4ed8',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: isSplitView ? 200 : 340,
            }}
          >
            {path}
          </Typography>
        </Tooltip>
        <Tooltip title={copied ? 'Copied!' : 'Copy full XPath'}>
          <IconButton size="small" onClick={handleCopy} sx={{ p: 0.25, opacity: 0.7, '&:hover': { opacity: 1 } }}>
            {copied ? <CheckIcon sx={{ fontSize: 13, color: '#22c55e' }} /> : <ContentCopyIcon sx={{ fontSize: 13 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // Compact Mode: "... › parent › leaf"
  if (mode === 'compact') {
    const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : '';
    return (
      <Tooltip title={`Full Path: ${path} (Click copy icon)`} placement="top" arrow>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: '100%' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.3,
              p: '2px 6px',
              borderRadius: 1,
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f1f5f9',
              border: `1px solid ${theme.palette.divider}`,
              maxWidth: isSplitView ? 200 : 320,
              overflow: 'hidden',
            }}
          >
            {ancestors.length > 1 && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                .../
              </Typography>
            )}
            {parent && (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {parent}
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }} />
              </>
            )}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                fontSize: '0.74rem',
                fontFamily: 'monospace',
                color: isDark ? '#60a5fa' : '#2563eb',
                whiteSpace: 'nowrap',
              }}
            >
              {leaf}
            </Typography>
          </Box>
          <Tooltip title={copied ? 'Copied!' : 'Copy path'}>
            <IconButton size="small" onClick={handleCopy} sx={{ p: 0.2, opacity: 0.7 }}>
              {copied ? <CheckIcon sx={{ fontSize: 12, color: '#22c55e' }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Tooltip>
    );
  }

  // Breadcrumb Mode (Default - Highly readable 2-layer presentation)
  // If ancestors > 2, display first and last: "root › ... › book[0]"
  let displayAncestors = ancestors;
  const isTooDeep = ancestors.length > 2;
  if (isTooDeep) {
    displayAncestors = [ancestors[0], '...', ancestors[ancestors.length - 1]];
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, maxWidth: '100%' }}>
      {/* Ancestor Hierarchy Breadcrumbs */}
      {ancestors.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexWrap: 'nowrap', overflow: 'hidden' }}>
          {displayAncestors.map((anc, idx) => (
            <React.Fragment key={idx}>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.68rem',
                  color: theme.palette.text.secondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: isSplitView ? 80 : 120,
                  lineHeight: 1.2,
                }}
              >
                {anc}
              </Typography>
              {idx < displayAncestors.length - 1 && (
                <ChevronRightIcon sx={{ fontSize: 11, color: 'text.disabled', flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </Box>
      )}

      {/* Leaf Target Tag & Action */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
        <Tooltip title={`Full XPath: ${path}`} placement="top" arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              px: 0.75,
              py: 0.2,
              borderRadius: '4px',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
              border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe'}`,
              cursor: 'pointer',
              maxWidth: isSplitView ? 160 : 240,
              overflow: 'hidden',
            }}
          >
            <TagIcon sx={{ fontSize: 11, color: isDark ? '#93c5fd' : '#2563eb', flexShrink: 0 }} />
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: isDark ? '#93c5fd' : '#1d4ed8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {leaf}
            </Typography>
          </Box>
        </Tooltip>

        <Tooltip title={copied ? 'Copied XPath!' : 'Copy full XPath'}>
          <IconButton size="small" onClick={handleCopy} sx={{ p: 0.2, opacity: 0.6, '&:hover': { opacity: 1 } }}>
            {copied ? <CheckIcon sx={{ fontSize: 12, color: '#22c55e' }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
