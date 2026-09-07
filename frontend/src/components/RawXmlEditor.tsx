import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  Tooltip,
  IconButton,
  Chip,
  useTheme,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SyncIcon from '@mui/icons-material/Sync';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';
import { useXmlManager } from '../context/XmlManagerContext';
import { validateXmlString, parseXmlStringToModel, xmlModelToString } from '../utils/xmlParser';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';

export const RawXmlEditor: React.FC = () => {
  const theme = useTheme();
  const { brand } = useBrand();
  const { canEdit: roleCanEdit } = useAuth();
  const { rawXml, setRawXmlDirectly, document, isActiveDocumentInbound } = useXmlManager();
  const canEdit = roleCanEdit && isActiveDocumentInbound;

  const [textValue, setTextValue] = useState(rawXml);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    setTextValue(rawXml);
  }, [rawXml]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTextValue(val);
    const check = validateXmlString(val);
    if (!check.isValid) {
      setValidationError(check.error || 'Syntax Error');
    } else {
      setValidationError(null);
    }
  };

  const handleApplyChanges = () => {
    const res = setRawXmlDirectly(textValue);
    if (!res.success) {
      setValidationError(res.error || 'Failed to apply changes');
    } else {
      setValidationError(null);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    }
  };

  const handleFormat = () => {
    const res = parseXmlStringToModel(textValue, document?.fileName || 'document.xml');
    if (res.document) {
      const formatted = xmlModelToString(res.document.root);
      setTextValue(formatted);
      setValidationError(null);
    } else {
      setValidationError(res.error || 'Cannot format invalid XML');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(textValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isChanged = textValue !== rawXml;

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: `${brand.borderRadius}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Action Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Raw XML Source &amp; Payload Inspector
          </Typography>
          <Chip
            size="small"
            label={validationError ? 'Syntax Error' : 'Valid XML'}
            color={validationError ? 'error' : 'success'}
            variant="outlined"
            icon={validationError ? <ErrorIcon /> : <CheckIcon />}
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
          {isChanged && (
            <Chip
              size="small"
              label="Unsaved in Visual Form"
              color="warning"
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoFixHighIcon />}
            onClick={handleFormat}
            sx={{ fontSize: '0.8rem' }}
          >
            Format / Indent
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
            onClick={handleCopy}
            sx={{ fontSize: '0.8rem' }}
          >
            {copied ? 'Copied!' : 'Copy XML'}
          </Button>

          {canEdit && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<SyncIcon />}
              onClick={handleApplyChanges}
              disabled={!!validationError || !isChanged}
              sx={{ fontSize: '0.8rem', fontWeight: 600 }}
            >
              Apply to Visual Form
            </Button>
          )}
        </Box>
      </Box>

      {/* Alerts */}
      {validationError && (
        <Alert severity="error" sx={{ py: 0.5, fontFamily: 'monospace', fontSize: '0.82rem' }}>
          {validationError}
        </Alert>
      )}

      {syncSuccess && (
        <Alert severity="success" sx={{ py: 0.5 }}>
          Successfully synchronized raw XML with the Visual Form model and change logs!
        </Alert>
      )}

      {/* Raw Code Editor Area */}
      <TextField
        multiline
        rows={22}
        fullWidth
        value={textValue}
        onChange={handleTextChange}
        disabled={!canEdit}
        slotProps={{
          input: {
            sx: {
              fontFamily: '"JetBrains Mono", Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              letterSpacing: '0.01em',
              backgroundColor: theme.palette.mode === 'dark' ? '#090d16' : '#fcfcfd',
            },
          },
        }}
      />
    </Paper>
  );
};
