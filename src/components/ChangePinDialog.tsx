import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ChangePinDialogProps {
  open: boolean;
  onClose: () => void;
  currentAdminPin: string;
  onSave: (newPin: string) => void;
}

export default function ChangePinDialog({ open, onClose, currentAdminPin, onSave }: ChangePinDialogProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    if (currentPin !== currentAdminPin) {
      setError('Current PIN is incorrect');
      return;
    }
    if (newPin.length < 4) {
      setError('New PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setError('New PINs do not match');
      return;
    }

    onSave(newPin);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setError('');
        onClose();
      }
    }}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>Change Admin PIN</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current PIN</Label>
            <Input 
              type="password" 
              value={currentPin} 
              onChange={e => setCurrentPin(e.target.value)} 
              placeholder="****" 
              maxLength={4} 
              className="text-center tracking-widest"
            />
          </div>
          <div className="space-y-2">
            <Label>New PIN</Label>
            <Input 
              type="password" 
              value={newPin} 
              onChange={e => setNewPin(e.target.value)} 
              placeholder="****" 
              maxLength={4} 
              className="text-center tracking-widest"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New PIN</Label>
            <Input 
              type="password" 
              value={confirmPin} 
              onChange={e => setConfirmPin(e.target.value)} 
              placeholder="****" 
              maxLength={4} 
              className="text-center tracking-widest"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          
          {error && <p className="text-destructive text-sm text-center font-medium">{error}</p>}
          
          <Button className="w-full bg-primary" onClick={handleSubmit}>Update PIN</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
