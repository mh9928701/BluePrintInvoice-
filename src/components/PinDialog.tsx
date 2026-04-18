import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PinDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  expectedPin: string;
  title?: string;
}

export default function PinDialog({ open, onClose, onConfirm, expectedPin, title = "Enter Admin PIN" }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (pin === expectedPin) {
      setPin('');
      setError('');
      onConfirm();
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setPin('');
        setError('');
        onClose();
      }
    }}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-500 text-center">Default PIN is 1234</p>
          <Input 
            type="password" 
            value={pin} 
            onChange={e => setPin(e.target.value)} 
            placeholder="****" 
            maxLength={4} 
            className="text-center text-2xl tracking-widest"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          {error && <p className="text-destructive text-sm text-center font-medium">{error}</p>}
          <Button className="w-full bg-primary" onClick={handleSubmit}>Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
