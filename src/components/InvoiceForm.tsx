import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save, CreditCard, Banknote, Search, Package, Clock, Star } from 'lucide-react';
import { Invoice, InvoiceItem, BusinessDetails, ClientDetails, Product } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import Fuse from 'fuse.js';

interface InvoiceFormProps {
  onSave: (invoice: Partial<Invoice>, action?: 'download' | 'whatsapp' | 'dashboard') => void;
  onPreview: (invoice: Partial<Invoice>) => void;
  logActivity?: (action: string, productName: string, details: string) => void;
}

export default function InvoiceForm({ onSave, onPreview, logActivity }: InvoiceFormProps) {
  const [business, setBusiness] = useState<BusinessDetails>(() => {
    try {
      const saved = localStorage.getItem('blueprint-business-details');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      name: 'R. ENTERPRISE',
      address: 'Pakortala, Near High School',
      phone: '',
    };
  });

  const [client, setClient] = useState<ClientDetails>({
    name: '',
    address: '',
    phone: '',
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', quantity: 0, mrp: 0, price: 0, discountRate: 0, unit: '' },
  ]);

  const [invoiceMeta, setInvoiceMeta] = useState({
    number: `INV-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    type: 'sale' as 'sale' | 'return',
    paymentMode: ['Cash'],
    lessAmount: 0,
    paidAmount: 0,
    promiseDay: '',
  });

  // Stock Integration
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [lowStockLevel, setLowStockLevel] = useState<number>(5);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);

  useEffect(() => {
    setSearchSelectedIndex(0);
  }, [searchResults]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearch) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIndex(prev => {
        const next = Math.min(prev + 1, searchResults.length - 1);
        document.getElementById(`search-item-${next}`)?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIndex(prev => {
        const next = Math.max(prev - 1, 0);
        document.getElementById(`search-item-${next}`)?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[searchSelectedIndex]) {
        addProductToInvoice(searchResults[searchSelectedIndex]);
      }
    }
  };

  useEffect(() => {
    const loadProducts = () => {
      const saved = localStorage.getItem('blueprint-products');
      if (saved) setProducts(JSON.parse(saved));
    };
    loadProducts();

    const loadStockAlert = () => {
      const savedLevel = localStorage.getItem('blueprint-low-stock-level');
      if (savedLevel) setLowStockLevel(Number(savedLevel));
    };
    loadStockAlert();
    
    const loadBusinessDetails = () => {
      const savedBusiness = localStorage.getItem('blueprint-business-details');
      if (savedBusiness) {
        try {
          setBusiness(JSON.parse(savedBusiness));
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadBusinessDetails();

    window.addEventListener('blueprint-products-updated', loadProducts);
    window.addEventListener('blueprint-low-stock-level-updated', loadStockAlert);
    window.addEventListener('blueprint-business-details-updated', loadBusinessDetails);

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blueprint-products-updated', loadProducts);
      window.removeEventListener('blueprint-low-stock-level-updated', loadStockAlert);
      window.removeEventListener('blueprint-business-details-updated', loadBusinessDetails);
    };
  }, []);

  useEffect(() => {
    if (productSearch.trim() === '') {
      // Products are naturally ordered by recently added because ProductMaster prepends them
      setSearchResults(products.slice(0, 10));
      return;
    }

    const fuse = new Fuse(products, {
      keys: ['name', 'category'],
      threshold: 0.3,
    });

    const results = fuse.search(productSearch);
    setSearchResults(results.map(r => r.item));
  }, [productSearch, products]);

  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  useEffect(() => {
    if (focusItemId) {
      // Focus on the newly added item's quantity input
      const ele = document.getElementById(`quantity-${focusItemId}`) as HTMLInputElement;
      if (ele) {
        ele.focus();
        ele.select();
      }
      setFocusItemId(null);
    }
  }, [items, focusItemId]);

  const addProductToInvoice = (product: Product) => {
    if (invoiceMeta.type === 'sale' && product.stock <= 0) {
      alert(`"${product.name}" is Out of Stock!`);
      return;
    }

    const newItemId = Math.random().toString(36).substr(2, 9);
    const newItem: InvoiceItem = {
      id: newItemId,
      productId: product.id,
      description: product.name,
      quantity: 0,
      mrp: product.mrp || product.price,
      price: product.price,
      discountRate: product.discountRate,
      unit: product.unit,
    };

    if (items.length === 1 && !items[0].description) {
      setItems([newItem]);
    } else {
      setItems([newItem, ...items]);
    }

    const updatedProducts = products.map(p => 
      p.id === product.id ? { ...p, usageCount: (p.usageCount || 0) + 1, lastUsed: new Date().toISOString() } : p
    );
    setProducts(updatedProducts);
    localStorage.setItem('blueprint-products', JSON.stringify(updatedProducts));

    setProductSearch('');
    setShowSearch(false);
    setFocusItemId(newItemId);
  };

  const addItem = () => {
    const newItemId = Math.random().toString(36).substr(2, 9);
    setItems([{ id: newItemId, description: '', quantity: 0, mrp: 0, price: 0, discountRate: 0, unit: '' }, ...items]);
    setFocusItemId(newItemId);
  };

  const removeItem = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    if (newItems.length === 0) {
      setItems([{ id: Math.random().toString(36).substr(2, 9), description: '', quantity: 0, mrp: 0, price: 0, discountRate: 0, unit: '' }]);
    } else {
      setItems(newItems);
    }
  };

  const saveToStock = (item: InvoiceItem) => {
    if (!item.description) return;
    
    // Calculate MRP from selling price and discount if possible
    const mrp = item.discountRate < 100 ? item.price / (1 - item.discountRate / 100) : item.price;

    const newProduct: Product = {
      id: Math.random().toString(36).substr(2, 9),
      name: item.description,
      category: 'General',
      mrp: Number(mrp.toFixed(2)),
      price: item.price,
      unit: item.unit || 'pcs',
      discountRate: item.discountRate,
      stock: 0,
      usageCount: 1,
      lastUsed: new Date().toISOString(),
    };

    const updatedProducts = [newProduct, ...products];
    setProducts(updatedProducts);
    localStorage.setItem('blueprint-products', JSON.stringify(updatedProducts));
    
    // Link the item to the new product
    updateItem(item.id, 'productId', newProduct.id);
    alert(`"${item.description}" saved to Stock!`);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updatedItem = { ...item, [field]: value };

      // Auto-calculation logic
      if (field === 'discountRate') {
        const disc = Number(value) || 0;
        const mrp = Number(item.mrp) || 0;
        updatedItem.price = Number((mrp * (1 - disc / 100)).toFixed(2));
      }

      return updatedItem;
    }));
  };

  const togglePaymentMode = (mode: string) => {
    const current = invoiceMeta.paymentMode;
    if (current.includes(mode)) {
      if (current.length > 1) {
        setInvoiceMeta({ ...invoiceMeta, paymentMode: current.filter(m => m !== mode) });
      }
    } else {
      setInvoiceMeta({ ...invoiceMeta, paymentMode: [...current, mode] });
    }
  };

  const handleNavKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, id: string) => {
    if (e.key === 'Enter' && e.currentTarget.tagName === 'TEXTAREA') {
      return; // allow native newlines in textareas
    }
    
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();

      const due = calculateDue();
      if (e.key === 'Enter') {
        if (id === 'paid-amount' && due <= 0) {
          handleSave();
          return;
        }
        if (id === 'promise-day') {
          handleSave();
          return;
        }
      }

      const navOrder = [
        'biz-name',
        'biz-address',
        'client-name',
        'client-phone',
        'client-address',
        'less-amount',
        'paid-amount'
      ];
      if (due > 0) navOrder.push('promise-day');

      const currentIndex = navOrder.indexOf(id);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextIndex = (currentIndex + 1) % navOrder.length;
      } else if (e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + navOrder.length) % navOrder.length;
      }

      const nextId = navOrder[nextIndex];
      const nextElement = document.getElementById(nextId) as HTMLInputElement | HTMLTextAreaElement;
      if (nextElement) {
        nextElement.focus();
        if ('select' in nextElement && typeof nextElement.select === 'function') {
           nextElement.select();
        }
      }
    }
  };

  const handleItemNavKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: 'description' | 'quantity' | 'mrp' | 'discountRate' | 'price'
  ) => {
    // Increment/Decrement QTY with +/-
    if (field === 'quantity' && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
      e.preventDefault();
      const item = items[rowIndex];
      const currentQty = Number(item.quantity) || 0;
      const step = (item.unit === 'K.G' || item.unit === 'FIT') ? 1 : 1; // Assuming integer steps even for kg for simple +/-
      let newQty = currentQty;
      if (e.key === '+' || e.key === '=') newQty += step;
      if (e.key === '-' || e.key === '_') newQty = Math.max(0, newQty - step);
      updateItem(item.id, 'quantity', newQty);
      return;
    }

    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const searchInput = document.getElementById('product-search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    const maxRow = items.length - 1;
    const fieldsOrder = ['description', 'quantity', 'mrp', 'discountRate', 'price'];
    const currentFieldIndex = fieldsOrder.indexOf(field);

    let nextRow = rowIndex;
    let nextField = currentFieldIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextRow = Math.min(maxRow, rowIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (currentFieldIndex < fieldsOrder.length - 1) {
        nextField = currentFieldIndex + 1;
      } else if (rowIndex < maxRow) {
        nextRow = rowIndex + 1;
        nextField = 0;
      }
    } else if (e.key === 'ArrowLeft') {
      // If we are in the description field, only move left if cursor is at the very beginning
      // Or just strictly move. To preserve native text editing left/right, let's only block default if we want to jump.
      if ((e.target as HTMLInputElement).selectionStart === 0 && (e.target as HTMLInputElement).selectionEnd === 0) {
         if (currentFieldIndex > 0) {
           e.preventDefault();
           nextField = currentFieldIndex - 1;
         } else if (rowIndex > 0) {
           e.preventDefault();
           nextRow = rowIndex - 1;
           nextField = fieldsOrder.length - 1;
         }
      } else if (field !== 'description') { // for number inputs, just transition easily
         e.preventDefault();
         if (currentFieldIndex > 0) {
           nextField = currentFieldIndex - 1;
         } else if (rowIndex > 0) {
           nextRow = rowIndex - 1;
           nextField = fieldsOrder.length - 1;
         }
      }
    }

    if (nextRow !== rowIndex || nextField !== currentFieldIndex) {
      const targetId = `${fieldsOrder[nextField]}-${items[nextRow].id}`;
      const ele = document.getElementById(targetId) as HTMLInputElement;
      if (ele) {
        ele.focus();
        if ('select' in ele && typeof ele.select === 'function') {
           ele.select();
        }
      }
    }
  };

  const calculateSubtotal = () => {
    // Force integer math internally to prevent floating point drift and sum accurately
    const totalCents = items.reduce((acc, item) => {
      const priceCents = Math.round(Number(item.price || 0) * 100);
      const qty = Number(item.quantity || 0);
      return acc + (priceCents * qty);
    }, 0);
    return Number((totalCents / 100).toFixed(2));
  };
  
  const calculateTotalAmount = () => calculateSubtotal();

  const calculateRoundOff = () => {
    const total = calculateTotalAmount();
    return Math.round(total) - total;
  };

  const calculateFinalTotal = () => {
    const roundedTotal = Math.round(calculateTotalAmount());
    return Math.max(0, roundedTotal - (Number(invoiceMeta.lessAmount) || 0));
  };

  const calculateDue = () => {
    const total = calculateFinalTotal();
    return Math.max(0, total - (Number(invoiceMeta.paidAmount) || 0));
  };

  const handleSave = (action: 'download' | 'whatsapp' | 'dashboard' = 'dashboard') => {
    try {
      const isReturn = invoiceMeta.type === 'return';
      
      const hasValidItems = items.some(item => item.description.trim() !== '' && item.quantity > 0);
      if (!hasValidItems) {
        alert('Please add at least one valid item before saving.');
        return;
      }

      // Check stock for all items (only if it's a sale)
      if (!isReturn) {
        for (const item of items) {
          if (!item.description || item.quantity <= 0) continue;
          
          const product = products.find(p => p.id === item.productId || p.name.trim().toLowerCase() === item.description.trim().toLowerCase());
          if (product) {
            if (product.stock < item.quantity) {
              alert(`"${item.description}" has insufficient stock. Available: ${product.stock}`);
              return;
            }
          }
        }
      }

      // Deduct or Add stock - handle multiple entries of same product
      const updatedProducts = products.map(p => {
        const totalQty = items
          .filter(item => item.productId === p.id || item.description.trim().toLowerCase() === p.name.trim().toLowerCase())
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        
        if (totalQty > 0) {
          return { 
            ...p, 
            stock: isReturn ? p.stock + totalQty : Math.max(0, p.stock - totalQty) 
          };
        }
        return p;
      });

      setProducts(updatedProducts);
      localStorage.setItem('blueprint-products', JSON.stringify(updatedProducts));

      if (logActivity) {
        items.forEach(item => {
          if (item.description && item.quantity > 0) {
            const actionLogs = isReturn ? 'RETURN_RESTOCK' : 'SALE_DEDUCT';
            const details = isReturn 
              ? `Restocked ${item.quantity} via Return Invoice #${invoiceMeta.number}` 
              : `Deducted ${item.quantity} via Sale Invoice #${invoiceMeta.number}`;
            logActivity(actionLogs, item.description, details);
          }
        });
      }

      onSave({
        invoiceNumber: invoiceMeta.number,
        date: invoiceMeta.date,
        type: invoiceMeta.type,
        businessDetails: business,
        clientDetails: client,
        items: items.filter(item => item.description.trim() !== ''),
        paymentMode: invoiceMeta.paymentMode,
        lessAmount: Number(invoiceMeta.lessAmount) || 0,
        roundOff: calculateRoundOff(),
        finalTotal: calculateFinalTotal(),
        paidAmount: Number(invoiceMeta.paidAmount) || 0,
        dueAmount: calculateDue(),
        promiseDay: calculateDue() > 0 ? invoiceMeta.promiseDay : undefined,
        status: 'draft',
      }, action);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save invoice. Please check your inputs.');
    }
  };

  const executePreview = () => {
    onPreview({
      businessDetails: business,
      clientDetails: client,
      items: items.filter(item => item.description.trim() !== ''),
      ...invoiceMeta,
      lessAmount: Number(invoiceMeta.lessAmount) || 0,
      roundOff: calculateRoundOff(),
      finalTotal: calculateFinalTotal(),
      dueAmount: calculateDue()
    });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleResetForm = () => {
      setInvoiceMeta(prev => ({
        ...prev,
        number: `INV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'sale',
        lessAmount: 0,
        paidAmount: 0,
        promiseDay: ''
      }));
      setClient({ name: '', address: '', phone: '' });
      setItems([{ id: '1', description: '', quantity: 0, mrp: 0, price: 0, discountRate: 0, unit: '' }]);
    };
    window.addEventListener('blueprint-reset-form', handleResetForm);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is actively interacting with a modal/dialog (outside of the form)
      if (document.querySelector('[role="dialog"]') !== null) {
        return; 
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave('download');
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        handleSave('whatsapp');
      } else if (e.key === 'Enter' && !cmdOrCtrl) {
        // Only trigger 'dashboard' save if we are not actively in an input field that might need Enter
        const activeElement = document.activeElement;
        const isInput = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.tagName === 'SELECT'
        );
        if (!isInput) {
          e.preventDefault();
          handleSave('dashboard');
        }
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        // Open preview mode which has the print button
        executePreview();
        setTimeout(() => {
          // Send print command explicitly
          window.print();
        }, 500);
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('blueprint-reset-form', handleResetForm);
    };
  }, [items, invoiceMeta, products, business, client]);

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Meta */}
        <Card className="border-none shadow-sm h-fit">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-3">
            <CardTitle className="text-base font-semibold text-primary">Invoice Settings</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transaction Type</Label>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant={invoiceMeta.type === 'sale' ? 'default' : 'outline'} 
                  className={`flex-1 h-9 ${invoiceMeta.type === 'sale' ? 'bg-primary' : ''}`}
                  onClick={() => setInvoiceMeta({ ...invoiceMeta, type: 'sale' })}
                >
                  Sale
                </Button>
                <Button 
                  type="button"
                  variant={invoiceMeta.type === 'return' ? 'destructive' : 'outline'} 
                  className="flex-1 h-9"
                  onClick={() => setInvoiceMeta({ ...invoiceMeta, type: 'return' })}
                >
                  Return
                </Button>
              </div>
            </div>
            <div className="gap-4 flex">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice #</Label>
                <Input className="h-9" value={invoiceMeta.number} onChange={e => setInvoiceMeta({ ...invoiceMeta, number: e.target.value })} />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</Label>
                <Input className="h-9" type="date" value={invoiceMeta.date} onChange={e => setInvoiceMeta({ ...invoiceMeta, date: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business & Client Details */}
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-3">
            <CardTitle className="text-base font-semibold text-primary">Party Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Bill From</h4>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm">
                <p className="font-bold text-slate-900">{business.name}</p>
                <p className="text-slate-500 whitespace-pre-line mt-1">{business.address}</p>
                {business.phone && <p className="text-slate-500 mt-1">{business.phone}</p>}
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Bill To</h4>
              <div className="space-y-1.5">
                <Label className="text-xs">Client Name</Label>
                <Input className="h-9" id="client-name" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} onKeyDown={e => handleNavKeyDown(e, 'client-name')} placeholder="Client Name" />
              </div>
              <div className="flex gap-2">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-9" id="client-phone" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} onKeyDown={e => handleNavKeyDown(e, 'client-phone')} placeholder="+91..." />
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs">Address</Label>
                <Input className="h-9" id="client-address" value={client.address} onChange={e => setClient({ ...client, address: e.target.value })} onKeyDown={e => handleNavKeyDown(e, 'client-address')} placeholder="Client Address" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Table */}
      <div className="space-y-4">
        {/* Smart Search Bar */}
        <div className="relative" ref={searchRef}>
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                id="product-search-input"
                placeholder="Search or Add Item" 
                className="pl-11 h-12 text-lg border-none focus-visible:ring-0 shadow-none"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                onFocus={() => setShowSearch(true)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <Button variant="ghost" className="text-primary font-medium" onClick={addItem}>
              <Plus className="w-4 h-4 mr-2" /> Manual Add
            </Button>
          </div>

          <AnimatePresence>
            {showSearch && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
              >
                <div className="p-2 max-h-96 overflow-y-auto">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{productSearch ? 'Search Results' : 'Recently Added'}</span>
                    {!productSearch && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      No products found. Add one in the Stock List.
                    </div>
                  ) : (
                    searchResults.map((product, index) => (
                      <button
                        key={product.id}
                        id={`search-item-${index}`}
                        onClick={() => addProductToInvoice(product)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors group text-left ${index === searchSelectedIndex ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-primary/5'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <Package className="w-5 h-5 text-slate-400 group-hover:text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{product.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500 uppercase tracking-tight">{product.category}</p>
                              <span className="text-slate-300">•</span>
                              <p className={`text-[10px] font-bold uppercase ${product.stock <= lowStockLevel ? 'text-destructive' : 'text-emerald-600'}`}>
                                {product.stock <= 0 ? 'Out of Stock' : product.stock <= lowStockLevel ? `Low Stock: ${product.stock} ${product.unit || 'PCS'}` : `In Stock: ${product.stock} ${product.unit || 'PCS'}`}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">₹{product.price.toFixed(2)}</p>
                          {product.mrp > product.price && (
                            <p className="text-[10px] text-slate-400 line-through">MRP: ₹{product.mrp.toFixed(2)}</p>
                          )}
                          <p className="text-[10px] text-destructive font-medium">Disc: {product.discountRate}%</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-primary">Items</CardTitle>
            <Button onClick={addItem} variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[30%]">DESCRIPTION</TableHead>
                <TableHead>QTY & Unit</TableHead>
                <TableHead>MRP (₹)</TableHead>
                <TableHead>DISC (%)</TableHead>
                <TableHead>PRICE (₹)</TableHead>
                <TableHead className="text-right">TOTAL (₹)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="group"
                  >
                    <TableCell>
                      <Input
                        id={`description-${item.id}`}
                        value={item.description}
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        onKeyDown={e => handleItemNavKeyDown(e, items.findIndex(i => i.id === item.id), 'description')}
                        placeholder="Item description..."
                        className="border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          id={`quantity-${item.id}`}
                          type="number"
                          step={item.unit === 'K.G' || item.unit === 'FIT' ? "0.01" : "1"}
                          value={item.quantity === 0 ? '' : item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            updateItem(item.id, 'quantity', isNaN(val) ? 0 : val);
                          }}
                          onKeyDown={e => handleItemNavKeyDown(e, items.findIndex(i => i.id === item.id), 'quantity')}
                          className="w-16 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                          placeholder="0"
                        />
                        <select
                          value={item.unit || 'PCS'}
                          onChange={e => updateItem(item.id, 'unit', e.target.value)}
                          className="h-9 rounded-md border border-slate-200 bg-transparent px-1 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                        >
                          <option value="PCS">PCS</option>
                          <option value="K.G">K.G</option>
                          <option value="FIT">FIT</option>
                        </select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        id={`mrp-${item.id}`}
                        type="text"
                        inputMode="decimal"
                        value={item.mrp === 0 ? '0' : item.mrp}
                        onFocus={(e) => e.target.select()}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          const sanitized = val.replace(/^0+/, '') || '0';
                          const mrpVal = Number(sanitized);
                          const priceVal = Number((mrpVal * (1 - item.discountRate / 100)).toFixed(2));
                          updateItem(item.id, 'mrp', mrpVal);
                          updateItem(item.id, 'price', priceVal);
                        }}
                        onKeyDown={e => handleItemNavKeyDown(e, items.findIndex(i => i.id === item.id), 'mrp')}
                        className="w-20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        id={`discountRate-${item.id}`}
                        type="text"
                        inputMode="decimal"
                        value={item.discountRate === 0 ? '0' : item.discountRate}
                        onFocus={(e) => e.target.select()}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          const sanitized = val.replace(/^0+/, '') || '0';
                          updateItem(item.id, 'discountRate', Number(sanitized));
                        }}
                        onKeyDown={e => handleItemNavKeyDown(e, items.findIndex(i => i.id === item.id), 'discountRate')}
                        className="w-16 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        id={`price-${item.id}`}
                        type="text"
                        inputMode="decimal"
                        value={item.price === 0 ? '0' : item.price}
                        onFocus={(e) => e.target.select()}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          const sanitized = val.replace(/^0+/, '') || '0';
                          const priceVal = Number(sanitized);
                          const discVal = item.mrp > 0 ? ((item.mrp - priceVal) / item.mrp) * 100 : 0;
                          updateItem(item.id, 'price', priceVal);
                          updateItem(item.id, 'discountRate', Number(discVal.toFixed(2)));
                        }}
                        onKeyDown={e => handleItemNavKeyDown(e, items.findIndex(i => i.id === item.id), 'price')}
                        className="w-20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {!item.productId && item.description && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveToStock(item)}
                            className="text-slate-400 hover:text-primary transition-colors"
                            title="Save to Stock"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="text-destructive opacity-80 hover:opacity-100 hover:bg-destructive/10 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>

      {/* Summary & Payment Mode */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-bold text-slate-900">Mode of Payment</Label>
            <div className="flex gap-4">
              <button
                onClick={() => togglePaymentMode('Cash')}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl border-2 transition-all ${
                  invoiceMeta.paymentMode.includes('Cash')
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span className="font-semibold">Cash</span>
                {invoiceMeta.paymentMode.includes('Cash') && <div className="w-2 h-2 rounded-full bg-primary" />}
              </button>
              <button
                onClick={() => togglePaymentMode('UPI')}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl border-2 transition-all ${
                  invoiceMeta.paymentMode.includes('UPI')
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="font-semibold">UPI</span>
                {invoiceMeta.paymentMode.includes('UPI') && <div className="w-2 h-2 rounded-full bg-primary" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4 border border-slate-100">
          <div className="flex justify-between text-xl font-bold text-slate-900">
            <span>Total Amount</span>
            <span>₹{calculateTotalAmount().toFixed(2)}</span>
          </div>

          {calculateRoundOff() !== 0 && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>Round Off</span>
              <span>{calculateRoundOff() > 0 ? '+' : ''}{calculateRoundOff().toFixed(2)}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <Label className="text-slate-500">Less (₹)</Label>
            <Input 
              id="less-amount"
              type="text"
              inputMode="decimal"
              className="w-24 text-right" 
              value={invoiceMeta.lessAmount === 0 ? '0' : invoiceMeta.lessAmount} 
              onFocus={(e) => e.target.select()}
              onKeyDown={e => handleNavKeyDown(e, 'less-amount')}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                const sanitized = val.replace(/^0+/, '') || '0';
                const numVal = Number(sanitized);
                setInvoiceMeta({ ...invoiceMeta, lessAmount: numVal });
              }}
            />
          </div>

          <div className="h-px bg-slate-100 my-2" />
          <div className="flex justify-between text-xl font-bold text-primary">
            <span>Final Payable Amount</span>
            <span>₹{calculateFinalTotal().toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <Label className="text-slate-700 font-semibold">Paid Amount (₹)</Label>
            <Input 
              id="paid-amount"
              type="text"
              inputMode="decimal"
              className="w-32 text-right font-bold text-green-600" 
              value={invoiceMeta.paidAmount === 0 ? '0' : invoiceMeta.paidAmount} 
              onFocus={(e) => e.target.select()}
              onKeyDown={e => handleNavKeyDown(e, 'paid-amount')}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                const sanitized = val.replace(/^0+/, '') || '0';
                const numVal = Number(sanitized);
                setInvoiceMeta({ ...invoiceMeta, paidAmount: numVal });
              }}
            />
          </div>

          <div className="flex justify-between text-lg font-bold text-destructive">
            <span>Due Amount</span>
            <span>₹{calculateDue().toFixed(2)}</span>
          </div>

          {calculateDue() > 0 && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100 mt-2">
              <Label className="text-slate-700 font-semibold">Promise Day (Due Date)</Label>
              <Input 
                id="promise-day"
                type="date"
                className="w-40" 
                value={invoiceMeta.promiseDay} 
                onChange={e => setInvoiceMeta({ ...invoiceMeta, promiseDay: e.target.value })}
                onKeyDown={e => handleNavKeyDown(e as any, 'promise-day')}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={executePreview}>
          Preview {invoiceMeta.type === 'return' ? 'Return' : 'Invoice'}
        </Button>
        <Button onClick={() => handleSave('dashboard')} className={invoiceMeta.type === 'return' ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}>
          <Save className="w-4 h-4 mr-2" /> {invoiceMeta.type === 'return' ? 'Confirm Return' : 'Save Invoice'}
        </Button>
      </div>
    </div>
  );
}
