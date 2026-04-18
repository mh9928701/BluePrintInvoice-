import React from 'react';
import { Invoice } from '@/src/types';
import { Separator } from '@/components/ui/separator';

interface InvoicePreviewProps {
  invoice: Partial<Invoice>;
  id?: string;
}

export default function InvoicePreview({ invoice, id = "invoice-preview" }: InvoicePreviewProps) {
  const { businessDetails, clientDetails, items = [], invoiceNumber, date, type = 'sale', paymentMode = [], lessAmount = 0, roundOff, finalTotal, paidAmount = 0, dueAmount = 0, promiseDay } = invoice;

  const calculateSubtotal = () => items.reduce((acc, item) => {
    const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
    return acc + Number(itemTotal.toFixed(2));
  }, 0);
  const calculateTotalAmount = () => calculateSubtotal();

  const isReturn = type === 'return';
  const themeColor = isReturn ? 'text-red-700' : 'text-slate-900';
  const themeBg = isReturn ? 'bg-red-700' : 'bg-slate-900';
  const themeBorder = isReturn ? 'border-red-700' : 'border-slate-900';

  // Always enforce the latest global business settings over historical snapshots if available
  let activeBusiness = businessDetails;
  try {
    const defaultGlobal = localStorage.getItem('blueprint-business-details');
    if (defaultGlobal) {
      activeBusiness = JSON.parse(defaultGlobal);
    }
  } catch (e) {}
  
  const bizLogoChar = (activeBusiness?.name || 'R').charAt(0).toUpperCase();
  const bizName = activeBusiness?.name || 'R. Enterprise';
  const bizAddress = activeBusiness?.address || 'Pakurtala';
  const bizPhone = activeBusiness?.phone || '';

  return (
    <div id={id} className="bg-white p-12 w-full max-w-[800px] mx-auto shadow-lg border border-slate-100 text-slate-800 font-sans relative">
      {/* Type Tag */}
      <div className={`absolute top-0 right-0 px-8 py-2 text-white font-bold tracking-widest uppercase text-sm ${themeBg} rounded-bl-xl`}>
        {isReturn ? 'RETURN INVOICE' : 'SALE INVOICE'}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-10 mt-4">
        <div className="flex items-center gap-4 max-w-[60%]">
          <div className={`flex items-center justify-center w-14 h-14 min-w-[56px] ${themeBg} text-white rounded-lg shadow-md`}>
            <span className="text-4xl font-black tracking-tighter">{bizLogoChar}</span>
          </div>
          <div>
            <h2 className={`text-3xl font-bold ${themeColor} tracking-tight leading-none`}>{bizName}</h2>
          </div>
        </div>
        <div className="text-right mt-2 flex-shrink-0">
          <div className="flex flex-col items-end">
            <p className="text-slate-500 font-bold text-xl mt-1">Invoice #{invoiceNumber || '---'}</p>
          </div>
        </div>
      </div>

      <Separator className="mb-10 bg-slate-200" />

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bill From</h3>
          <p className="text-xl font-bold text-slate-900 mb-2">{bizName}</p>
          <p className="text-slate-600 text-sm whitespace-pre-line leading-relaxed">{bizAddress}</p>
          {bizPhone && <p className="text-slate-600 text-sm mt-1">{bizPhone}</p>}
        </div>
        <div className="text-right">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bill To</h3>
          <p className="text-xl font-bold text-slate-900 mb-2">{clientDetails?.name || 'Client Name'}</p>
          {clientDetails?.phone && <p className="text-slate-600 text-sm mb-2">{clientDetails.phone}</p>}
          <p className="text-slate-600 text-sm whitespace-pre-line leading-relaxed mb-4">{clientDetails?.address}</p>
          
          <div className="flex justify-end items-center gap-4 mt-6 pt-4 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date</span>
            <span className="text-sm font-bold text-slate-900">{date || '---'}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-12">
        <table className="w-full border-collapse">
          <thead>
            <tr className={`border-b-2 ${themeBorder}`}>
              <th className={`text-left py-4 px-2 text-xs font-bold ${themeColor} uppercase tracking-wider w-[35%]`}>DESCRIPTION</th>
              <th className={`text-center py-4 px-2 text-xs font-bold ${themeColor} uppercase tracking-wider w-[12%]`}>QTY</th>
              <th className={`text-right py-4 px-2 text-xs font-bold ${themeColor} uppercase tracking-wider w-[12%]`}>MRP</th>
              <th className={`text-right py-4 px-2 text-xs font-bold ${themeColor} uppercase tracking-wider w-[10%]`}>DISC</th>
              <th className={`text-right py-4 px-2 text-xs font-bold ${themeColor} uppercase tracking-wider w-[12%]`}>PRICE</th>
              <th className={`text-right py-4 px-2 text-xs font-bold ${themeColor} uppercase tracking-wider w-[19%]`}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                <td className="py-4 px-2 text-sm text-slate-800 break-words font-medium">{item.description || '---'}</td>
                <td className="py-4 px-2 text-center text-sm text-slate-700 tabular-nums">{item.quantity} {item.unit || 'PCS'}</td>
                <td className="py-4 px-2 text-right text-sm text-slate-500 tabular-nums">
                  {Number(item.mrp || item.price || 0).toFixed(2)}
                </td>
                <td className="py-4 px-2 text-right text-sm text-slate-700 tabular-nums">{Number(item.discountRate || 0)}%</td>
                <td className="py-4 px-2 text-right text-sm text-slate-800 tabular-nums">
                  {Number(item.price || 0).toFixed(2)}
                </td>
                <td className={`py-4 px-2 text-right text-sm font-bold ${themeColor} tabular-nums`}>
                  {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Payment Mode</h3>
          <div className="flex gap-2">
            {paymentMode.map(mode => (
              <span key={mode} className={`px-4 py-1.5 rounded-md text-xs font-bold ${isReturn ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                {mode}
              </span>
            ))}
          </div>
        </div>
        <div className="w-80 space-y-3">
          <div className="flex justify-between items-center text-lg font-bold text-slate-900 px-2">
            <span>Subtotal</span>
            <span className="tabular-nums">
              <span className="mr-0.5 font-sans">₹</span>{calculateTotalAmount().toFixed(2)}
            </span>
          </div>
          {roundOff !== undefined && roundOff !== 0 && (
            <div className="flex justify-between items-center text-sm text-slate-500 px-2">
              <span>Round Off</span>
              <span className="tabular-nums">
                {roundOff > 0 ? '+' : ''}{Number(roundOff).toFixed(2)}
              </span>
            </div>
          )}
          {Number(lessAmount) > 0 && (
            <div className="flex justify-between items-center text-sm text-slate-600 px-2">
              <span>Less</span>
              <span className="font-medium tabular-nums">
                <span className="mr-0.5 font-sans">- ₹</span>{Number(lessAmount).toFixed(2)}
              </span>
            </div>
          )}
          
          <div className={`mt-4 pt-4 border-t-2 ${themeBorder}`}>
            <div className={`flex justify-between items-center text-xl font-black ${themeColor} px-2`}>
              <span>Final Amount</span>
              <span className="tabular-nums">
                <span className="mr-0.5 font-sans">₹</span>{Number(finalTotal).toFixed(2)}
              </span>
            </div>
          </div>
          
          {paidAmount > 0 && (
            <div className="flex justify-between items-center text-sm text-emerald-600 font-bold mt-2 px-2">
              <span>Paid Amount</span>
              <span className="tabular-nums">
                <span className="mr-0.5 font-sans">₹</span>{Number(paidAmount).toFixed(2)}
              </span>
            </div>
          )}
          {dueAmount > 0 && (
            <div className={`flex justify-between items-center text-sm font-bold mt-1 px-2 ${isReturn ? 'text-slate-500' : 'text-rose-600'}`}>
              <span>{isReturn ? 'Pending Refund' : 'Due Amount'}</span>
              <span className="tabular-nums">
                <span className="mr-0.5 font-sans">₹</span>{Number(dueAmount).toFixed(2)}
              </span>
            </div>
          )}
          {dueAmount > 0 && promiseDay && !isReturn && (
            <div className="flex justify-between items-center text-xs text-rose-500/80 font-medium mt-1 px-2">
              <span>Promise Date</span>
              <span>{new Date(promiseDay).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-8 border-t border-slate-200 text-center">
        <p className="text-sm font-medium text-slate-500">Thank you for your business!</p>
      </div>
    </div>
  );
}
