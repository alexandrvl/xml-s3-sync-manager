import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface OverwriteConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const OverwriteConfirmDialog: React.FC<OverwriteConfirmDialogProps> = ({
  open,
  title = 'Overwrite existing file?',
  message,
  confirmLabel = 'Overwrite',
  onCancel,
  onConfirm,
}) => (
  <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
    <DialogContent>
      <Typography variant="body2">{message}</Typography>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onCancel} color="inherit">
        Cancel
      </Button>
      <Button variant="contained" color="warning" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);
