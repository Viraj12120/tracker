'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  ChevronLeft, 
  Package, 
  Truck, 
  CreditCard, 
  Building2, 
  Hash, 
  Calendar, 
  Info,
  MapPin,
  FileText,
  BadgeInfo
} from 'lucide-react';
import Link from 'next/link';

export default function BillDetailPage() {
  const { id } = useParams();
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBill();
  }, [id]);

  const fetchBill = async () => {
    try {
      const res = await fetch(`/api/bills/${id}`);
      const data = await res.json();
      if (data.success) setBill(data.bill);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Bill Details...</p>
      </div>
    </div>
  );

  if (!bill) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
      Bill Not Found
    </div>
  );

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return String(dateStr).split('T')[0];
  };

  const currencySymbol = bill.currency === 'INR' || !bill.currency ? '₹' : bill.currency + ' ';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-all group uppercase tracking-widest">
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
             <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                bill.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
             }`}>
                {bill.status.replace('_', ' ')}
             </span>
             <button className="text-[9px] font-black text-white bg-slate-900 px-4 py-2 rounded-lg uppercase tracking-widest hover:bg-indigo-600 transition-colors">
                Export PDF
             </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 mt-12">
        {/* Header Section */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                  bill.company === 'STAR' ? 'bg-indigo-600 text-white' : 
                  bill.company === 'AMAZON' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-white'
                }`}>
                  {bill.company}
                </span>
                <span className="text-xs font-bold text-slate-400">/ {bill.pdf_filename}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-2">
                {bill.grn_no || bill.challan_no || 'No Reference'}
              </h1>
              <p className="text-xl font-bold text-slate-500 flex items-center gap-2">
                <Building2 size={20} className="text-slate-300" />
                {bill.vendor_name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Amount</p>
              <p className="text-4xl font-black text-slate-900">{currencySymbol}{bill.total_amount?.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </header>

        {/* Info Grid - Dynamic Bento Layout */}
        <div className={`grid grid-cols-1 ${bill.company === 'STAR' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-12`}>
          {/* Box 1: PO Number */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Hash size={10} className="text-indigo-500" /> PO Number
             </p>
             <p className="text-lg font-black text-slate-800 tracking-tight">{bill.po_number || 'N/A'}</p>
          </div>

          {/* Box 2: Vendor Code */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <BadgeInfo size={10} className="text-emerald-500" /> Vendor Code
             </p>
             <p className="text-lg font-black text-slate-800 tracking-tight">{bill.vendor_code || 'N/A'}</p>
             <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{bill.currency || 'INR'} Currency</p>
          </div>

          {/* Box 3: GSTN / UIN (STAR ONLY) or Challan (AMAZON) */}
          {bill.company === 'STAR' ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <CreditCard size={10} className="text-rose-500" /> GSTN / UIN
               </p>
               <p className="text-lg font-black text-slate-800 tracking-tight">{bill.gstn || 'N/A'}</p>
               {bill.company_pan && (
                 <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">PAN: {bill.company_pan}</p>
               )}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <FileText size={10} className="text-orange-500" /> Challan No.
               </p>
               <p className="text-lg font-black text-slate-800 tracking-tight">{bill.challan_no || 'N/A'}</p>
               {bill.challan_version && (
                 <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ver: {bill.challan_version}</p>
               )}
            </div>
          )}

          {/* Box 4: Movement (STAR ONLY) or Date/Version (AMAZON is already handled above) */}
          {bill.company === 'STAR' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Truck size={10} className="text-indigo-500" /> Movement
               </p>
               <p className="text-lg font-black text-slate-800 tracking-tight">{bill.movement_type || '101'}</p>
               <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{formatDate(bill.grn_date || bill.challan_date)}</p>
            </div>
          )}
        </div>

        {/* Main Content Area: Table and Addresses */}
        <div className="space-y-12">
          {/* Table Section */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Line Item Details</h4>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                {bill.items?.length} Items Detected
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50/80">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-4 text-left border-b border-slate-200">#</th>
                    {bill.company === 'STAR' ? (
                      <>
                        <th className="px-4 py-4 text-left border-b border-slate-200">Article / EAN</th>
                        <th className="px-4 py-4 text-left border-b border-slate-200">Description</th>
                        <th className="px-4 py-4 text-right border-b border-slate-200">Rev. Qty</th>
                        <th className="px-4 py-4 text-right border-b border-slate-200">Unit Cost</th>
                        <th className="px-4 py-4 text-right border-b border-slate-200">Tax</th>
                        <th className="px-8 py-4 text-right border-b border-slate-200">Total</th>
                      </>
                    ) : bill.company === 'ZEPTO' ? (
                      <>
                         <th className="px-4 py-4 text-left border-b border-slate-200">HSN</th>
                         <th className="px-4 py-4 text-left border-b border-slate-200">Description</th>
                         <th className="px-4 py-4 text-right border-b border-slate-200">Actual Qty</th>
                         <th className="px-4 py-4 text-right border-b border-slate-200 text-red-500">Return</th>
                         <th className="px-4 py-4 text-right border-b border-slate-200">Net Qty</th>
                        <th className="px-4 py-4 text-right border-b border-slate-200">Unit Price</th>
                        <th className="px-4 py-4 text-right border-b border-slate-200">Tax</th>
                        <th className="px-8 py-4 text-right border-b border-slate-200">Total</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-4 text-left border-b border-slate-200">ASIN / ID</th>
                        <th className="px-4 py-4 text-left border-b border-slate-200">Description</th>
                        <th className="px-4 py-4 text-right border-b border-slate-200">Unit Price</th>
                        <th className="px-4 py-4 text-right border-b border-slate-200">Qty</th>
                        <th className="px-8 py-4 text-right border-b border-slate-200">Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bill.items?.map((item: any, i: number) => (
                    <tr key={i} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-5 text-xs font-bold text-slate-300">{i + 1}</td>
                      {bill.company === 'STAR' ? (
                        <>
                          <td className="px-4 py-5">
                            <p className="text-xs font-black text-slate-900 font-mono tracking-tight">{item.article_no}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1">{item.ean || item.hsn_code}</p>
                          </td>
                          <td className="px-4 py-5 max-w-xs">
                            <p className="text-sm font-bold text-slate-800 leading-tight">{item.description}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{item.merch_cat}</p>
                          </td>
                          <td className="px-4 py-5 text-right">
                            <p className="text-sm font-black text-slate-900">{item.qty}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.unit}</p>
                          </td>
                          <td className="px-4 py-5 text-right text-sm font-medium text-slate-500">
                            {currencySymbol}{item.cost_per_unit}
                          </td>
                          <td className="px-4 py-5 text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="text-[10px] font-black text-slate-800">
                                {item.cgst_amt > 0 ? `${currencySymbol}${item.cgst_amt} CGST` : ''}
                              </span>
                              <span className="text-[10px] font-black text-slate-800">
                                {item.sgst_amt > 0 ? `${currencySymbol}${item.sgst_amt} SGST` : ''}
                              </span>
                              {!(item.cgst_amt > 0 || item.sgst_amt > 0) && <span className="text-xs text-slate-300">-</span>}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right text-sm font-black text-slate-900">
                            {currencySymbol}{item.total_amount?.toLocaleString('en-IN')}
                          </td>
                        </>
                      ) : bill.company === 'ZEPTO' ? (
                        <>
                          <td className="px-4 py-5">
                            <p className="text-xs font-black text-slate-900 font-mono tracking-tight">{item.hsn_code || '-'}</p>
                          </td>
                          <td className="px-4 py-5 max-w-xs">
                            <p className="text-sm font-bold text-slate-800 leading-tight">{item.description}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{item.unit}</p>
                          </td>
                          <td className="px-4 py-5 text-right text-sm font-black text-slate-900">
                            {item.qty}
                          </td>
                          <td className="px-4 py-5 text-right text-sm font-medium text-slate-500">
                            {currencySymbol}{item.unit_price}
                          </td>
                          <td className="px-4 py-5 text-right">
                            <div className="inline-flex flex-col items-end">
                              <span className="text-[10px] font-black text-slate-800">
                                {item.cgst_amt > 0 ? `${currencySymbol}${item.cgst_amt} CGST` : ''}
                              </span>
                              <span className="text-[10px] font-black text-slate-800">
                                {item.sgst_amt > 0 ? `${currencySymbol}${item.sgst_amt} SGST` : ''}
                              </span>
                              {!(item.cgst_amt > 0 || item.sgst_amt > 0) && <span className="text-xs text-slate-300">-</span>}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right text-sm font-black text-slate-900">
                            {currencySymbol}{item.total_amount?.toLocaleString('en-IN')}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-5">
                            <p className="text-xs font-black text-slate-900 font-mono tracking-tight">{item.asin || '-'}</p>
                          </td>
                          <td className="px-4 py-5">
                            <p className="text-sm font-bold text-slate-800 leading-tight">{item.description}</p>
                          </td>
                          <td className="px-4 py-5 text-right text-sm font-medium text-slate-500">
                            {currencySymbol}{item.unit_price}
                          </td>
                          <td className="px-4 py-5 text-right text-sm font-black text-slate-900">
                            {item.qty}
                          </td>
                          <td className="px-8 py-5 text-right text-sm font-black text-slate-900">
                            {currencySymbol}{item.total_amount?.toLocaleString('en-IN')}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/50">
                  <tr>
                     <td colSpan={bill.company === 'STAR' ? 6 : bill.company === 'ZEPTO' ? 8 : 5} className="px-8 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Grand Total
                    </td>
                    <td className="px-8 py-6 text-right text-2xl font-black text-slate-900">
                      {currencySymbol}{bill.total_amount?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>          {/* Addresses Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                <MapPin size={12} className="text-rose-500" /> Billing Address
              </h5>
              <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                {bill.billing_address || bill.vendor_address || 'No billing address provided.'}
              </p>
            </div>
            
            {(bill.shipping_address || bill.plant_name) && (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                  <Truck size={12} className="text-indigo-500" /> Shipping / Delivery Info
                </h5>
                <div className="space-y-4">
                  {bill.shipping_address ? (
                    <p className="text-sm font-bold text-slate-600 leading-relaxed">
                      {bill.shipping_address}
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm font-black text-slate-800">{bill.plant_name}</p>
                      <p className="text-xs text-slate-500 mt-1">{bill.plant_description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 pt-12 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
           <div className="flex items-center gap-4">
              <span>DB ARCHIVE ID: {bill.id}</span>
              <span className="text-slate-200">/</span>
              <span>ENTRY: {new Date(bill.entry_date).toLocaleString()}</span>
           </div>
           <p>© 2026 {bill.company} DIGITAL TWIN INFRASTRUCTURE</p>
        </footer>
      </div>
    </div>
  );
}
