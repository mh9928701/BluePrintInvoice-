import React, { useEffect, useState } from 'react';
import { ActivityLog, Product } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, AlertTriangle, PlusCircle, PackagePlus, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface UnifiedLog {
  id: string;
  timestamp: string;
  type: string;
  badgeCategory?: string;
  productName: string;
  details: string;
}

export default function ActivityLogs({ logs }: { logs: ActivityLog[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockLevel, setLowStockLevel] = useState<number>(5);

  useEffect(() => {
    const loadState = () => {
      const saved = localStorage.getItem('blueprint-products');
      if (saved) {
        try {
          setProducts(JSON.parse(saved));
        } catch (e) {}
      }
      
      const savedLevel = localStorage.getItem('blueprint-low-stock-level');
      if (savedLevel) setLowStockLevel(Number(savedLevel));
    };

    loadState();
    window.addEventListener('blueprint-products-updated', loadState);
    return () => window.removeEventListener('blueprint-products-updated', loadState);
  }, []);

  const unifiedLogs: UnifiedLog[] = [];
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  tenDaysAgo.setHours(0, 0, 0, 0);

  // 1. Add Low Stock Alerts (always at the top, using current time for sorting)
  const lowStockProducts = products.filter(p => p.stock <= lowStockLevel);
  lowStockProducts.forEach(p => {
    unifiedLogs.push({
      id: `low-stock-${p.id}`,
      timestamp: new Date().toISOString(), // Current time so they appear at the top
      type: 'Low Stock',
      productName: p.name,
      details: `Current Stock: ${p.stock} QTY`,
    });
  });

  // 2. Filter and add relevant activity logs within the last 10 days
  logs.forEach(log => {
    const logDate = new Date(log.timestamp);
    if (logDate >= tenDaysAgo && log.action === 'EDIT_PRODUCT') {
      let displayType = 'Edited';
      let badgeCategory = 'Edited';
      
      const increaseMatch = log.details.match(/increase (\d+)/);
      const decreaseMatch = log.details.match(/decrease (\d+)/);

      if (increaseMatch) {
        displayType = `Edited (+${increaseMatch[1]})`;
        badgeCategory = 'Edited (+)';
      } else if (decreaseMatch) {
        displayType = `Edited (-${decreaseMatch[1]})`;
        badgeCategory = 'Edited (-)';
      }

      // Calculate current stock from our live products state
      const liveProduct = products.find(p => p.name === log.productName);
      const currentStockText = liveProduct ? `Current Stock: ${liveProduct.stock} QTY` : 'Current Stock: Unknown';

      unifiedLogs.push({
        id: log.id,
        timestamp: log.timestamp,
        type: displayType,
        badgeCategory: badgeCategory,
        productName: log.productName,
        details: currentStockText,
      });
    }
  });

  // Sort by timestamp descending
  unifiedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getIcon = (type: string) => {
    switch (type) {
      case 'Low Stock': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'Edited (+)': return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'Edited (-)': return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      case 'Edited': return <PlusCircle className="w-4 h-4 text-purple-500" />;
      default: return null;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'Low Stock': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Edited (+)': return 'bg-green-100 text-green-800 border-green-200';
      case 'Edited (-)': return 'bg-red-100 text-red-800 border-red-200';
      case 'Edited': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const [visibleCount, setVisibleCount] = useState(30);

  const displayLogs = unifiedLogs.slice(0, visibleCount);

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <History className="w-5 h-5" /> Activity
        </CardTitle>
      </CardHeader>
      <CardContent 
        className="p-0 max-h-[600px] overflow-auto"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
            if (visibleCount < unifiedLogs.length) {
              setVisibleCount(v => Math.min(v + 30, unifiedLogs.length)); // Lazy pagination trigger
            }
          }
        }}
      >
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">No recent activity found.</TableCell>
              </TableRow>
            ) : (
              displayLogs.map((log, i) => (
                <TableRow key={`${log.id}-${i}`}>
                  <TableCell className="whitespace-nowrap text-slate-500 text-sm">
                    {log.type === 'Low Stock' ? 'Active Alert' : new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase rounded-md border ${getBadgeColor(log.badgeCategory || log.type)}`}>
                      {getIcon(log.badgeCategory || log.type)}
                      {log.type}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{log.productName}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{log.details}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
