import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Building2 } from 'lucide-react';
import { BusinessDetails } from '../types';

export default function BusinessSettings() {
  const [business, setBusiness] = useState<BusinessDetails>({
    name: 'R. ENTERPRISE',
    address: 'Pakortala, Near High School',
    phone: '',
  });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('blueprint-business-details');
    if (saved) {
      try {
        setBusiness(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('blueprint-business-details', JSON.stringify(business));
    setIsSaved(true);
    // Dispatch an event to update other components
    window.dispatchEvent(new Event('blueprint-business-details-updated'));
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8 border-none shadow-sm overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary">
          <Building2 className="w-5 h-5" /> Business Settings
        </CardTitle>
        <CardDescription>
          These details will automatically appear on the header of every new invoice.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Business Name</Label>
            <Input 
              placeholder="e.g., Acme Corp" 
              value={business.name} 
              onChange={e => setBusiness({ ...business, name: e.target.value })} 
              className="h-12"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Phone Number</Label>
            <Input 
              placeholder="+91..." 
              value={business.phone} 
              onChange={e => setBusiness({ ...business, phone: e.target.value })} 
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Address / Additional Info</Label>
            <Textarea 
              className="min-h-[100px]" 
              placeholder="123 Business St, City" 
              value={business.address} 
              onChange={e => setBusiness({ ...business, address: e.target.value })} 
            />
            <p className="text-xs text-slate-500">You can add multiple lines (e.g. GSTIN, Email) here which will print directly on your invoice.</p>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold">
          {isSaved ? 'Saved Successfully!' : <><Save className="w-5 h-5 mr-2" /> Save Details</>}
        </Button>
      </CardContent>
    </Card>
  );
}
