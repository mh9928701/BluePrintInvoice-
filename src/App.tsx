import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileText, LayoutDashboard, Download, Printer, Package, Banknote, History, KeyRound, MessageCircle, Send, CloudUpload, CheckSquare, Square, Share2, Building2 } from 'lucide-react';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import ProductMaster from './components/ProductMaster';
import ActivityLogs from './components/ActivityLogs';
import PinDialog from './components/PinDialog';
import BusinessSettings from './components/BusinessSettings';
import ChangePinDialog from './components/ChangePinDialog';
import { Invoice, ActivityLog } from './types';
import { generatePDF, getPDFFile } from './lib/pdf';
import { motion } from 'motion/react';
import { createPortal, flushSync } from 'react-dom';

const GOOGLE_SHEETS_WEBAPP_URL = import.meta.env.VITE_GOOGLE_SHEETS_URL || '';

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previewInvoice, setPreviewInvoice] = useState<Partial<Invoice> | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generatingPdfFor, setGeneratingPdfFor] = useState<Invoice | Partial<Invoice> | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Listen to focus search event
  useEffect(() => {
    const handleFocusSearch = () => {
      setActiveTab('dashboard');
      setTimeout(() => {
        const searchInput = document.getElementById('dashboard-invoice-search');
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    };
    window.addEventListener('blueprint-focus-search', handleFocusSearch);
    
    const handleAppKeys = (e: KeyboardEvent) => {
      // Don't intercept if user is actively interacting with a modal/dialog
      if (document.querySelector('[role="dialog"]') !== null) {
        return; 
      }
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdOrCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        window.dispatchEvent(new Event('blueprint-focus-search'));
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setActiveTab('create');
        setTimeout(() => {
          window.dispatchEvent(new Event('blueprint-reset-form'));
        }, 50);
      }
    };
    window.addEventListener('keydown', handleAppKeys);
    
    return () => {
      window.removeEventListener('blueprint-focus-search', handleFocusSearch);
      window.removeEventListener('keydown', handleAppKeys);
    };
  }, []);

  // RBAC & Logs State
  const [adminPin, setAdminPin] = useState<string>('1234');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [changePinDialogOpen, setChangePinDialogOpen] = useState(false);
  const [pinCallback, setPinCallback] = useState<(() => void) | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('blueprint-invoices');
    if (saved) {
      try {
        setInvoices(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved invoices', e);
      }
    }
    const savedLogs = localStorage.getItem('blueprint-logs');
    if (savedLogs) {
      try { setLogs(JSON.parse(savedLogs)); } catch (e) {}
    }
    const savedPin = localStorage.getItem('blueprint-admin-pin');
    if (savedPin) setAdminPin(savedPin);
  }, []);

  // Save to local storage whenever invoices change
  useEffect(() => {
    localStorage.setItem('blueprint-invoices', JSON.stringify(invoices));
  }, [invoices]);

  const syncInvoiceToSheets = async (invoice: Invoice) => {
    if (!GOOGLE_SHEETS_WEBAPP_URL) return;
    const custName = invoice.clientDetails?.name || 'Unknown';
    const payload = {
      Timestamp: new Date().toISOString(),
      Invoice_ID: invoice.id,
      Customer_Name: custName,
      Total_Amount: invoice.finalTotal || 0,
      Amount_Paid: invoice.paidAmount || 0,
      Due_Balance: invoice.dueAmount || 0,
      Return_Status: invoice.type === 'return' ? 'Returned' : 'No'
    };

    try {
      await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
    } catch (e) {
      console.error('Failed to sync to Google Sheets', e);
    }
  };

  const handleSingleDownloadShare = async (inv: Invoice | Partial<Invoice>, action: 'download' | 'whatsapp' | 'dashboard' | 'share' = 'download') => {
    // Determine context (dashboard or preview)
    const isNewDraft = !inv.id;
    let targetInv = inv as Invoice;

    if (isNewDraft) {
      const isReturn = inv.type === 'return';
      
      // Load and update products
      const savedProducts = localStorage.getItem('blueprint-products');
      if (savedProducts) {
        let products = JSON.parse(savedProducts);
        
        // Deduct/add stock for auto save
        if (!isReturn) {
          // Check stock before saving
          for (const item of (inv.items || [])) {
            if (!item.description || item.quantity <= 0) continue;
            const product = products.find((p: any) => p.id === item.productId || p.name.trim().toLowerCase() === item.description.trim().toLowerCase());
            if (product && product.stock < item.quantity) {
              alert(`Cannot Save: "${item.description}" has insufficient stock. Available: ${product.stock}`);
              return; 
            }
          }
        }
        
        const updatedProducts = products.map((p: any) => {
          const totalQty = (inv.items || [])
            .filter((item: any) => item.productId === p.id || item.description.trim().toLowerCase() === p.name.trim().toLowerCase())
            .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
          
          if (totalQty > 0) {
            return { 
              ...p, 
              stock: isReturn ? p.stock + totalQty : Math.max(0, p.stock - totalQty) 
            };
          }
          return p;
        });

        localStorage.setItem('blueprint-products', JSON.stringify(updatedProducts));
        window.dispatchEvent(new Event('blueprint-products-updated'));
      }

      // Log activity
      if (inv.items) {
        inv.items.forEach((item: any) => {
          if (item.description && item.quantity > 0) {
            const actLog = isReturn ? 'RETURN_RESTOCK' : 'SALE_DEDUCT';
            const details = isReturn 
              ? `Restocked ${item.quantity} via Return Invoice #${inv.invoiceNumber}` 
              : `Deducted ${item.quantity} via Sale Invoice #${inv.invoiceNumber}`;
            logActivity(actLog, item.description, details);
          }
        });
      }

      targetInv = {
        ...inv as any,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'local-user',
      };
      setInvoices(prev => [targetInv, ...prev]);
      syncInvoiceToSheets(targetInv);
      if (isPreviewOpen) {
        setPreviewInvoice(targetInv);
      }
      setActiveTab('dashboard');
    }

    setGeneratingPdfFor(targetInv);
    // Let react flush state to DOM
    await new Promise(r => requestAnimationFrame(r));
    
    try {
      const filename = `Invoice-${targetInv.invoiceNumber || 'Draft'}.pdf`;
      const fileBlob = await getPDFFile('hidden-invoice-preview', filename);
      
      if (!fileBlob) {
        alert("Could not generate PDF for downloading.");
        return;
      }
      
      const file = new File([fileBlob], filename, { type: 'application/pdf' });
      
      let bizName = targetInv.businessDetails?.name || 'R. Enterprise';
      try {
        const defaultGlobal = localStorage.getItem('blueprint-business-details');
        if (defaultGlobal) {
          bizName = JSON.parse(defaultGlobal).name || bizName;
        }
      } catch (e) {}

      let sharedViaAPI = false;
      const shouldUseNativeShare = (action === 'share' || action === 'download'); // Desktop 'download' mapping to native share if present

      if (shouldUseNativeShare && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          // Send only the file payload to avoid text-file creation bugs on Save to Drive
          await navigator.share({
            files: [file],
            title: `Invoice from ${bizName}`
          });
          sharedViaAPI = true;
        } catch (e) {
          console.log('Share canceled or blocked', e);
        }
      }
      
      if (!sharedViaAPI) {
        // Direct Download Fallback
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setGeneratingPdfFor(null);
    }
  };

  const requirePin = (callback: () => void) => {
    setPinCallback(() => callback);
    setPinDialogOpen(true);
  };

  const logActivity = (action: string, productName: string, details: string, user: string = 'Admin') => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      action,
      productName,
      details,
      user
    };
    setLogs(prev => {
      const updated = [newLog, ...prev];
      localStorage.setItem('blueprint-logs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveInvoice = (invoiceData: Partial<Invoice>, action: 'download' | 'whatsapp' | 'dashboard' | 'share' = 'dashboard') => {
    const newInvoice: Invoice = {
      ...invoiceData as any,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'local-user',
    };
    setInvoices([newInvoice, ...invoices]);
    syncInvoiceToSheets(newInvoice);
    setActiveTab('dashboard');

    // Handle WhatsApp popup synchronously to bypass popup blockers
    let waWindow: Window | null = null;
    if (action === 'whatsapp') {
      let bizName = invoiceData.businessDetails?.name || 'R. Enterprise';
      try {
        const defaultGlobal = localStorage.getItem('blueprint-business-details');
        if (defaultGlobal) bizName = JSON.parse(defaultGlobal).name || bizName;
      } catch (e) {}
      const finalTotal = newInvoice.finalTotal || invoiceData.finalTotal || 0;
      const message = `Hello, please find the invoice ${newInvoice.invoiceNumber || 'attached'} from ${bizName}. \nTotal: ${finalTotal}\nPlease physically attach the PDF that is downloading right now.`;
      const whatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      waWindow = window.open(whatsappUrl, '_blank');
    }

    // Both regular save and Ctrl+S now trigger downloading the PDF to device.
    // But only Ctrl+S triggers the Share UI panel.
    if (action !== 'dashboard') {
      setTimeout(() => {
         handleSingleDownloadShare(newInvoice, action);
      }, 50);
    }
  };

  const handlePreview = (invoiceData: Partial<Invoice>) => {
    setPreviewInvoice(invoiceData);
    setIsPreviewOpen(true);
  };

    // Fallback handlers handled by handleSingleDownloadShare

  // Dashboard Metrics Calculation
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  const recentInvoices = invoices.filter(inv => {
    const d = new Date(inv.date);
    d.setHours(0, 0, 0, 0);
    return d >= twoDaysAgo;
  });
  
  const salesInvoices = recentInvoices.filter(inv => inv.type !== 'return');
  const returnInvoices = recentInvoices.filter(inv => inv.type === 'return');

  const calculateInvoiceTotal = (inv: Invoice) => {
    if (inv.finalTotal !== undefined) return inv.finalTotal;
    const subtotal = inv.items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    return Math.max(0, subtotal - (Number(inv.lessAmount) || 0));
  };

  const calculateNetSales = (invs: Invoice[]) => {
    const sales = invs.filter(i => i.type !== 'return').reduce((acc, inv) => acc + calculateInvoiceTotal(inv), 0);
    const returns = invs.filter(i => i.type === 'return').reduce((acc, inv) => acc + calculateInvoiceTotal(inv), 0);
    return sales - returns;
  };

  const todayInvoices = invoices.filter(inv => inv.date === todayStr);
  const yesterdayInvoices = invoices.filter(inv => inv.date === yesterdayStr);

  const getFirstDayOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };
  
  const startOfWeek = getFirstDayOfWeek(today);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thisWeekInvoices = invoices.filter(inv => {
    const d = new Date(inv.date);
    d.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  });

  const thisMonthInvoices = invoices.filter(inv => {
    const d = new Date(inv.date);
    d.setHours(0, 0, 0, 0);
    return d >= startOfMonth;
  });

  const todayNetSales = calculateNetSales(todayInvoices);
  const yesterdayNetSales = calculateNetSales(yesterdayInvoices);
  const thisWeekNetSales = calculateNetSales(thisWeekInvoices);
  const thisMonthNetSales = calculateNetSales(thisMonthInvoices);

  const todaySalesInvoices = todayInvoices.filter(i => i.type !== 'return');
  const todayReturnInvoices = todayInvoices.filter(i => i.type === 'return');
  const todaySalesTotalAmount = todaySalesInvoices.reduce((acc, inv) => acc + calculateInvoiceTotal(inv), 0);
  const todayReturnTotalAmount = todayReturnInvoices.reduce((acc, inv) => acc + calculateInvoiceTotal(inv), 0);

  const todayPaymentBreakdown = todayInvoices.reduce((acc, inv) => {
    const isReturn = inv.type === 'return';
    const multiplier = isReturn ? -1 : 1;
    
    // If paidAmount is not set, assume full amount is paid for backward compatibility
    const total = calculateInvoiceTotal(inv);
    const paid = inv.paidAmount !== undefined ? (Number(inv.paidAmount) * multiplier) : (total * multiplier);
    const due = inv.dueAmount !== undefined ? (Number(inv.dueAmount) * multiplier) : 0;
    
    acc.due += due;
    
    if (inv.paymentMode.includes('Cash') && !inv.paymentMode.includes('UPI')) {
      acc.cash += paid;
    } else if (inv.paymentMode.includes('UPI') && !inv.paymentMode.includes('Cash')) {
      acc.upi += paid;
    } else if (inv.paymentMode.includes('Cash') && inv.paymentMode.includes('UPI')) {
      acc.cash += paid / 2;
      acc.upi += paid / 2;
    } else {
      acc.cash += paid; // Default to cash if no mode selected
    }
    
    return acc;
  }, { cash: 0, upi: 0, due: 0 });

  const overdueInvoices = invoices.filter(inv => {
    if (!inv.promiseDay || !inv.dueAmount || inv.dueAmount <= 0) return false;
    const promiseDate = new Date(inv.promiseDay);
    promiseDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return promiseDate < todayDate;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <FileText className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">BluePrint<span className="text-primary">Invoice</span></span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList className="bg-white border border-slate-200 p-1 h-16 shadow-sm">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-white h-full px-8 text-base font-semibold transition-all">
                <LayoutDashboard className="w-5 h-5 mr-2" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="create" className="data-[state=active]:bg-primary data-[state=active]:text-white h-full px-8 text-base font-semibold transition-all">
                <Plus className="w-5 h-5 mr-2" /> New Invoice
              </TabsTrigger>
              <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-white h-full px-8 text-base font-semibold transition-all">
                <Package className="w-5 h-5 mr-2" /> Stock
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-white h-full px-8 text-base font-semibold transition-all">
                <Building2 className="w-5 h-5 mr-2" /> Settings
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-primary data-[state=active]:text-white h-full px-8 text-base font-semibold transition-all hidden sm:flex">
                <History className="w-5 h-5 mr-2" /> Activity
              </TabsTrigger>
            </TabsList>

            {activeTab === 'dashboard' && (
              <Button size="lg" onClick={() => setActiveTab('create')} className="bg-primary hover:bg-primary/90 text-base font-semibold h-14 px-8 shadow-sm">
                <Plus className="w-5 h-5 mr-2" /> Create Invoice
              </Button>
            )}
          </div>

          <TabsContent value="dashboard">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Left Panel: Invoice History */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-900">Recent History</h2>
                  </div>
                  <div className="w-full sm:w-64 relative">
                    <History className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      id="dashboard-invoice-search"
                      type="text"
                      placeholder="Search invoices..."
                      className="w-full pl-9 h-10 rounded-lg border-slate-200 text-sm focus:ring-primary focus:border-primary border px-3"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                    />
                  </div>
                </div>
                
                {recentInvoices.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="text-slate-300 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No recent transactions</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">Sales and returns from the last 2 days will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4">Invoice No.</th>
                            <th className="px-6 py-4">Client Name</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentInvoices
                            .filter(inv => inv.invoiceNumber?.toLowerCase().includes(invoiceSearch.toLowerCase()) || inv.clientDetails?.name?.toLowerCase().includes(invoiceSearch.toLowerCase()))
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => (
                            <tr 
                              key={inv.id} 
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${inv.type === 'return' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                #{inv.invoiceNumber}
                              </td>
                              <td className="px-6 py-4 text-slate-700">{inv.clientDetails?.name || 'Walk-in Customer'}</td>
                              <td className="px-6 py-4 text-right font-bold text-slate-900">
                                ₹{calculateInvoiceTotal(inv).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Summary Metrics */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">Summary</h2>
                
                <div className="grid gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 mb-4">Sales Performance</p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Today</span>
                        <span className="font-bold text-slate-900">₹{todayNetSales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">This Week</span>
                        <span className="font-bold text-slate-900">₹{thisWeekNetSales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-medium">This Month</span>
                        <span className="font-bold text-slate-900">₹{thisMonthNetSales.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Sales</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-xl font-bold text-slate-900">{todaySalesInvoices.length} invoices <span className="text-slate-500 font-normal">(₹{todaySalesTotalAmount.toFixed(2)})</span></h3>
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">Sales</span>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Returns</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-xl font-bold text-slate-900">{todayReturnInvoices.length} invoices <span className="text-slate-500 font-normal">(₹{todayReturnTotalAmount.toFixed(2)})</span></h3>
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">Returns</span>
                    </div>
                  </div>

                  <div className="bg-primary p-6 rounded-2xl shadow-sm text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Banknote className="w-24 h-24" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-primary-foreground mb-1">Today Net Sales</p>
                        <h3 className="text-3xl font-bold mb-2">₹{todayNetSales.toFixed(2)}</h3>
                        <p className="text-xs text-primary-foreground/80 font-medium">
                          Previous Day: ₹{yesterdayNetSales.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right space-y-1 bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                        <div className="text-xs font-medium flex justify-between gap-4">
                          <span className="text-primary-foreground/80">Cash:</span>
                          <span>₹{todayPaymentBreakdown.cash.toFixed(2)}</span>
                        </div>
                        <div className="text-xs font-medium flex justify-between gap-4">
                          <span className="text-primary-foreground/80">UPI:</span>
                          <span>₹{todayPaymentBreakdown.upi.toFixed(2)}</span>
                        </div>
                        <div className="text-xs font-medium flex justify-between gap-4 pt-1 border-t border-white/20">
                          <span className="text-primary-foreground/80">Due:</span>
                          <span className={todayPaymentBreakdown.due > 0 ? "text-red-200 font-bold" : ""}>
                            ₹{todayPaymentBreakdown.due.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {overdueInvoices.length > 0 && (
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
                      <p className="text-sm font-medium text-red-800 mb-1">Overdue Payments</p>
                      <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-bold text-red-600">{overdueInvoices.length}</h3>
                        <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-md">Action Needed</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {overdueInvoices.slice(0, 3).map(inv => (
                          <div key={inv.id} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg border border-red-100 cursor-pointer hover:bg-red-50" onClick={() => handlePreview(inv)}>
                            <span className="font-medium text-slate-700">#{inv.invoiceNumber}</span>
                            <span className="font-bold text-red-600">₹{Number(inv.dueAmount).toFixed(2)}</span>
                          </div>
                        ))}
                        {overdueInvoices.length > 3 && (
                          <p className="text-xs text-center text-red-500 font-medium mt-2">+{overdueInvoices.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="create">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <InvoiceForm onSave={handleSaveInvoice} onPreview={handlePreview} logActivity={logActivity} />
            </motion.div>
          </TabsContent>

          <TabsContent value="products">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ProductMaster requirePin={requirePin} logActivity={logActivity} onChangePinClick={() => setChangePinDialogOpen(true)} />
            </motion.div>
          </TabsContent>

          <TabsContent value="settings">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <BusinessSettings />
            </motion.div>
          </TabsContent>

          <TabsContent value="activity">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ActivityLogs logs={logs} />
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-100 p-0 border-none">
          <DialogHeader className="p-6 bg-white border-b sticky top-0 z-20 flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-bold">Invoice Preview</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
              <Button size="sm" onClick={() => previewInvoice && handleSingleDownloadShare(previewInvoice)} className="bg-primary hover:bg-primary/90 text-white">
                <Share2 className="w-4 h-4 mr-2" /> Download / Share
              </Button>
            </div>
          </DialogHeader>
          <div className="p-8">
            {previewInvoice && <InvoicePreview invoice={previewInvoice} />}
          </div>
        </DialogContent>
      </Dialog>

      <PinDialog 
        open={pinDialogOpen} 
        onClose={() => {
          setPinDialogOpen(false);
          setPinCallback(null);
        }} 
        onConfirm={() => {
          setPinDialogOpen(false);
          if (pinCallback) pinCallback();
          setPinCallback(null);
        }} 
        expectedPin={adminPin} 
      />

      <ChangePinDialog
        open={changePinDialogOpen}
        onClose={() => setChangePinDialogOpen(false)}
        currentAdminPin={adminPin}
        onSave={(newPin) => {
          setAdminPin(newPin);
          localStorage.setItem('blueprint-admin-pin', newPin);
          alert('Admin PIN successfully updated!');
        }}
      />

      {/* Hidden container to render one invoice at a time for PDF generation without showing it */}
      {generatingPdfFor && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '210mm', opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
          <div id="hidden-invoice-preview">
            <InvoicePreview invoice={generatingPdfFor} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
