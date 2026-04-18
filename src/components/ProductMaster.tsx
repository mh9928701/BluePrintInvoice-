import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit2, Trash2, Package, KeyRound } from 'lucide-react';
import { Product } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SAMPLE_PRODUCTS: Product[] = [];

interface ProductMasterProps {
  requirePin?: (callback: () => void) => void;
  logActivity?: (action: string, productName: string, details: string) => void;
  onChangePinClick?: () => void;
}

export default function ProductMaster({ requirePin = (cb) => cb(), logActivity, onChangePinClick }: ProductMasterProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [lowStockLevel, setLowStockLevel] = useState<number>(5);
  const [tempLowStockLevel, setTempLowStockLevel] = useState<number | ''>(5);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({
    name: '',
    category: '',
    mrp: 0,
    price: 0,
    unit: 'pcs',
    discountRate: 0,
    stock: 0,
  });

  useEffect(() => {
    const loadProducts = () => {
      const saved = localStorage.getItem('blueprint-products');
      if (saved) {
        setProducts(JSON.parse(saved));
      } else {
        setProducts(SAMPLE_PRODUCTS);
        localStorage.setItem('blueprint-products', JSON.stringify(SAMPLE_PRODUCTS));
      }
    };
    loadProducts();

    const savedLevel = localStorage.getItem('blueprint-low-stock-level');
    if (savedLevel) {
      setLowStockLevel(Number(savedLevel));
      setTempLowStockLevel(Number(savedLevel));
    }

    window.addEventListener('blueprint-products-updated', loadProducts);
    return () => window.removeEventListener('blueprint-products-updated', loadProducts);
  }, []);

  const saveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    localStorage.setItem('blueprint-products', JSON.stringify(newProducts));
    window.dispatchEvent(new Event('blueprint-products-updated'));
  };

  const handleSave = () => {
    if (!currentProduct.name?.trim()) {
      return;
    }
    if (!currentProduct.category?.trim()) {
      return;
    }

    if (currentProduct.id) {
      const oldProduct = products.find(p => p.id === currentProduct.id);
      const oldStock = oldProduct?.stock || 0;
      const newStock = currentProduct.stock || 0;
      const stockDiff = newStock - oldStock;
      
      let editDetails = 'Product details modified';
      if (stockDiff > 0) {
        editDetails = `increase ${stockDiff} (QTY)`;
      } else if (stockDiff < 0) {
        editDetails = `decrease ${Math.abs(stockDiff)} (QTY)`;
      }
      
      saveProducts(products.map(p => p.id === currentProduct.id ? { ...p, ...currentProduct } as Product : p));
      if (logActivity) {
        logActivity('EDIT_PRODUCT', currentProduct.name || '', editDetails);
      }
    } else {
      // Check for duplicate product name
      const existingProduct = products.find(p => p.name.toLowerCase() === currentProduct.name?.trim().toLowerCase());
      if (existingProduct) {
        alert(`A product named "${existingProduct.name}" already exists. Please edit its stock instead of creating a duplicate.`);
        return;
      }

      const newProduct: Product = {
        name: currentProduct.name.trim(),
        category: currentProduct.category.trim(),
        mrp: currentProduct.mrp || 0,
        price: currentProduct.price || 0,
        unit: currentProduct.unit || 'pcs',
        discountRate: currentProduct.discountRate || 0,
        stock: currentProduct.stock || 0,
        id: Math.random().toString(36).substr(2, 9),
        usageCount: 0,
      };
      saveProducts([newProduct, ...products]);
      if (logActivity) {
        logActivity('ADD_PRODUCT', newProduct.name, `Initial stock: QTY ${newProduct.stock}`);
      }
      setSearch(''); // Clear search to show the new product
    }
    setIsEditing(false);
    setCurrentProduct({ name: '', category: '', mrp: 0, price: 0, unit: 'pcs', discountRate: 0, stock: 0 });
  };

  const updatePrice = (mrp: number, discount: number) => {
    const price = mrp * (1 - discount / 100);
    setCurrentProduct(prev => ({ ...prev, mrp, discountRate: discount, price: Number(price.toFixed(2)) }));
  };

  const updateDiscount = (mrp: number, price: number) => {
    const discount = mrp > 0 ? ((mrp - price) / mrp) * 100 : 0;
    setCurrentProduct(prev => ({ ...prev, mrp, price, discountRate: Number(discount.toFixed(2)) }));
  };

  const handleModalNavKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
      e.preventDefault();
      const navOrder = [
        'pm-name',
        'pm-category',
        'pm-mrp',
        'pm-stock',
        'pm-discount',
        'pm-price'
      ];
      const currentIndex = navOrder.indexOf(id);
      if (currentIndex === -1) return;

      if (e.key === 'Enter' && id === 'pm-price') {
        handleSave();
        return;
      }

      let nextIndex = currentIndex;
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextIndex = (currentIndex + 1) % navOrder.length;
      } else if (e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + navOrder.length) % navOrder.length;
      }

      const nextId = navOrder[nextIndex];
      const nextElement = document.getElementById(nextId) as HTMLInputElement;
      if (nextElement) {
        nextElement.focus();
        if ('select' in nextElement && typeof nextElement.select === 'function') {
           nextElement.select();
        }
      }
    }
  };

  const handleDelete = (id: string) => {
    saveProducts(products.filter(p => p.id !== id));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search products or categories..." 
            className="pl-10 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => {
            requirePin(() => {
              setCurrentProduct({ name: '', category: '', mrp: 0, price: 0, unit: 'pcs', discountRate: 0, stock: 0 });
              setIsEditing(true);
            });
          }} className="bg-primary flex-1 md:flex-none">
            <Plus className="w-4 h-4 mr-2" /> Add New Product
          </Button>
          <Button 
            variant="outline" 
            onClick={() => { 
              requirePin(() => {
                if(confirm('Are you sure you want to clear all products?')) {
                  saveProducts([]);
                  if (logActivity) logActivity('CLEAR_ALL', 'All Products', 'Cleared entire inventory');
                }
              });
            }}
            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
          >
            Clear All
          </Button>
          {onChangePinClick && (
            <Button 
              variant="ghost" 
              onClick={onChangePinClick}
              className="text-slate-500 hover:text-primary"
            >
              <KeyRound className="w-4 h-4 mr-2" /> Change PIN
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="bg-primary/5 border-b border-primary/10 flex flex-row items-center justify-between overflow-visible">
          <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
            <Package className="w-5 h-5" /> Stock Inventory
          </CardTitle>
          <div className="flex items-center gap-3 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200 relative">
            <Label className="text-sm text-slate-600 font-medium whitespace-nowrap">Stock Alert:</Label>
            <Input
              type="number"
              min="0"
              className="w-20 h-8 text-sm"
              value={tempLowStockLevel}
              onChange={e => setTempLowStockLevel(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
            />
            <Button 
              size="sm" 
              className="h-8 px-3"
              onClick={() => {
                const val = Math.max(0, Number(tempLowStockLevel) || 0);
                setLowStockLevel(val);
                setTempLowStockLevel(val);
                localStorage.setItem('blueprint-low-stock-level', val.toString());
                // dispatch event so invoice form can also pick it up immediately
                window.dispatchEvent(new Event('blueprint-low-stock-level-updated'));
                if (logActivity) {
                  logActivity('UPDATE_SETTINGS', 'Global Settings', `Updated stock alert level to ${val}`);
                }
                setShowSuccessPopup(true);
                setTimeout(() => setShowSuccessPopup(false), 2000);
              }}
            >
              Save
            </Button>

            <AnimatePresence>
              {showSuccessPopup && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-500 text-white text-sm font-bold px-6 py-3 rounded-xl shadow-xl flex items-center gap-2.5 z-[9999]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  Successful!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>MRP (₹)</TableHead>
                <TableHead>Discount (%)</TableHead>
                <TableHead>Price (₹)</TableHead>
                <TableHead>Stock Qty</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredProducts.map((product) => (
                  <motion.tr 
                    key={product.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md">
                        {product.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 line-through text-xs">₹{(product.mrp || product.price).toFixed(2)}</TableCell>
                    <TableCell className="text-destructive font-medium">{product.discountRate}%</TableCell>
                    <TableCell className="font-bold text-primary">₹{product.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className={`font-semibold ${product.stock <= lowStockLevel ? 'text-destructive' : 'text-slate-700'}`}>
                          {product.stock} {product.unit || 'PCS'}
                        </span>
                        {product.stock <= lowStockLevel && product.stock > 0 && (
                          <span className="text-[10px] text-destructive font-bold uppercase">Low Stock</span>
                        )}
                        {product.stock <= 0 && (
                          <span className="text-[10px] text-destructive font-bold uppercase">Out of Stock</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
                          <Button variant="ghost" size="icon" onClick={() => { 
                            requirePin(() => {
                              setCurrentProduct(product); 
                              setIsEditing(true); 
                            });
                          }}>
                            <Edit2 className="w-4 h-4 text-slate-400 hover:text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setProductToDelete(product)}>
                            <Trash2 className="w-4 h-4 text-slate-400 hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Add Modal */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{currentProduct.id ? 'Edit Stock Item' : 'Add New Stock Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input 
                id="pm-name"
                value={currentProduct.name} 
                onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})}
                onKeyDown={e => handleModalNavKeyDown(e, 'pm-name')}
                placeholder="e.g. Wireless Mouse"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input 
                id="pm-category"
                value={currentProduct.category} 
                onChange={e => setCurrentProduct({...currentProduct, category: e.target.value})}
                onKeyDown={e => handleModalNavKeyDown(e, 'pm-category')}
                placeholder="e.g. Electronics"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>MRP (₹)</Label>
                <Input 
                  id="pm-mrp"
                  type="text"
                  inputMode="decimal"
                  value={currentProduct.mrp === 0 ? '0' : currentProduct.mrp} 
                  onFocus={(e) => e.target.select()}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    const sanitized = val.replace(/^0+/, '') || '0';
                    const mrp = parseFloat(sanitized) || 0;
                    updatePrice(mrp, currentProduct.discountRate || 0);
                  }}
                  onKeyDown={e => handleModalNavKeyDown(e, 'pm-mrp')}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Qty & Unit</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="pm-stock"
                    type="number"
                    step={currentProduct.unit === 'K.G' || currentProduct.unit === 'FIT' ? "0.01" : "1"}
                    value={currentProduct.stock === 0 ? '' : currentProduct.stock} 
                    onFocus={(e) => e.target.select()}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setCurrentProduct({...currentProduct, stock: isNaN(val) ? 0 : val});
                    }}
                    onKeyDown={e => handleModalNavKeyDown(e, 'pm-stock')}
                    placeholder="0"
                  />
                  <select
                    value={currentProduct.unit || 'PCS'}
                    onChange={e => setCurrentProduct({...currentProduct, unit: e.target.value})}
                    className="h-9 rounded-md border border-slate-200 bg-transparent px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="PCS">PCS</option>
                    <option value="K.G">K.G</option>
                    <option value="FIT">FIT</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input 
                  id="pm-discount"
                  type="text"
                  inputMode="decimal"
                  value={currentProduct.discountRate === 0 ? '0' : currentProduct.discountRate} 
                  onFocus={(e) => e.target.select()}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    const sanitized = val.replace(/^0+/, '') || '0';
                    const disc = parseFloat(sanitized) || 0;
                    updatePrice(currentProduct.mrp || 0, disc);
                  }}
                  onKeyDown={e => handleModalNavKeyDown(e, 'pm-discount')}
                />
              </div>
              <div className="space-y-2">
                <Label>Final Price (₹)</Label>
                <Input 
                  id="pm-price"
                  type="text"
                  inputMode="decimal"
                  value={currentProduct.price === 0 ? '0' : currentProduct.price} 
                  onFocus={(e) => e.target.select()}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    const sanitized = val.replace(/^0+/, '') || '0';
                    const price = parseFloat(sanitized) || 0;
                    updateDiscount(currentProduct.mrp || 0, price);
                  }}
                  onKeyDown={e => handleModalNavKeyDown(e, 'pm-price')}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">Editing price will auto-calculate discount</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary">Save Product</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 text-sm">
              Are you sure you want to delete <span className="font-bold text-slate-900">{productToDelete?.name}</span>? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setProductToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (productToDelete) {
                  requirePin(() => {
                    saveProducts(products.filter(p => p.id !== productToDelete.id));
                    if (logActivity) {
                      logActivity('DELETE_PRODUCT', productToDelete.name, 'Deleted product from inventory');
                    }
                    setProductToDelete(null);
                  });
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
