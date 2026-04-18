export interface BusinessDetails {
  name: string;
  address: string;
  phone: string;
  logo?: string;
  taxId?: string;
}

export interface ClientDetails {
  name: string;
  address: string;
  phone: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  mrp: number;
  price: number;
  unit: string;
  discountRate: number;
  stock: number;
  usageCount?: number;
  lastUsed?: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  mrp: number;
  price: number;
  discountRate: number;
  unit: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  type: 'sale' | 'return';
  businessDetails: BusinessDetails;
  clientDetails: ClientDetails;
  items: InvoiceItem[];
  paymentMode: string[];
  lessAmount: number;
  roundOff?: number;
  finalTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  promiseDay?: string;
  status: 'draft' | 'sent' | 'paid';
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  productName: string;
  details: string;
  user: string;
}
