'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
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

  if (loading) return <div className="p-20 text-center font-bold text-slate-300">Loading...</div>;
  if (!bill) return <div className="p-20 text-center font-bold text-slate-300">Not found</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-8 md:p-20">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-slate-900 mb-12 transition-all group">
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Dashboard
        </Link>

        <header className="mb-16">
          <div className="flex items-center gap-3 mb-6">
             <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                bill.company === 'STAR' ? 'bg-indigo-50 text-indigo-600' : 
                bill.company === 'AMAZON' ? 'bg-orange-50 text-orange-600' : 'bg-pink-50 text-pink-600'
             }`}>
                {bill.company}
             </span>
             <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{bill.grn_date || bill.challan_date}</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-4 text-slate-900">
            {bill.grn_no || bill.challan_no}
          </h1>
          <p className="text-2xl font-bold text-slate-400">{bill.vendor_name}</p>
        </header>

        {/* Global Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-20 border-y border-slate-50 py-12">
           <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">PO Number</p>
              <p className="font-bold text-slate-700">{bill.po_number || 'N/A'}</p>
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Vendor Code</p>
              <p className="font-mono text-slate-700">{bill.vendor_code || 'N/A'}</p>
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">GSTN / UIN</p>
              <p className="font-mono text-slate-700">{bill.gstn || 'N/A'}</p>
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Movement</p>
              <p className="font-bold text-slate-700">{bill.movement_type || '101'}</p>
           </div>
        </div>

        {/* Detailed Items Table */}
        <section className="mb-24">
           <div className="flex items-center justify-between mb-8">
              <h4 className="font-black uppercase tracking-widest text-xs text-slate-900">Line Items</h4>
              <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{bill.items?.length} Items Detected</span>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50">
                    <tr>
                       {bill.company === 'STAR' ? (
                         <>
                           <th className="pb-4">Article</th>
                           <th className="pb-4">HSN</th>
                           <th className="pb-4">Description</th>
                           <th className="pb-4 text-right">Rcv Qty</th>
                           <th className="pb-4 text-right">Unit Cost</th>
                           <th className="pb-4 text-right">CGST</th>
                           <th className="pb-4 text-right">SGST</th>
                           <th className="pb-4 text-right">Total</th>
                         </>
                       ) : (
                         <>
                           <th className="pb-4">ASIN</th>
                           <th className="pb-4">Description</th>
                           <th className="pb-4 text-right">Unit Price</th>
                           <th className="pb-4 text-right">Qty</th>
                           <th className="pb-4 text-right">Total</th>
                         </>
                       )}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {bill.items?.map((item: any, i: number) => (
                      <tr key={i} className="group hover:bg-slate-50/30 transition-colors">
                        {bill.company === 'STAR' ? (
                          <>
                            <td className="py-5 text-xs font-mono text-slate-400">{item.article_no}</td>
                            <td className="py-5 text-xs font-mono text-slate-400">{item.hsn_code}</td>
                            <td className="py-5 text-sm font-bold text-slate-800">{item.description}</td>
                            <td className="py-5 text-right text-sm font-black text-slate-900">{item.qty} {item.unit}</td>
                            <td className="py-5 text-right text-xs text-slate-500">₹{item.cost_per_unit}</td>
                            <td className="py-5 text-right text-[10px] text-slate-400">
                              {item.cgst_amt > 0 ? `₹${item.cgst_amt} (${item.cgst_rate}%)` : '-'}
                            </td>
                            <td className="py-5 text-right text-[10px] text-slate-400">
                              {item.sgst_amt > 0 ? `₹${item.sgst_amt} (${item.sgst_rate}%)` : '-'}
                            </td>
                            <td className="py-5 text-right text-sm font-black text-slate-900">₹{item.total_amount}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-5 text-xs font-mono text-slate-400">{item.asin}</td>
                            <td className="py-5 text-sm font-bold text-slate-800">{item.description}</td>
                            <td className="py-5 text-right text-sm text-slate-500">₹{item.unit_price}</td>
                            <td className="py-5 text-right text-sm font-black text-slate-900">{item.qty}</td>
                            <td className="py-5 text-right text-sm font-black text-slate-900">₹{item.total_amount}</td>
                          </>
                        )}
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
           
           <div className="mt-12 pt-12 border-t border-slate-50 flex justify-between items-center">
              <span className="text-sm font-black uppercase tracking-widest text-slate-300">Grand Total</span>
              <span className="text-4xl font-black text-slate-900">₹{bill.total_amount?.toLocaleString('en-IN')}</span>
           </div>
        </section>

        {/* Extended Details & Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
           {bill.vendor_address && (
              <section>
                 <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-300 mb-6">Vendor Address</h4>
                 <div className="bg-slate-50 p-8 rounded-[2.5rem]">
                    <p className="text-sm leading-relaxed font-bold text-slate-500 italic">
                      {bill.vendor_address}
                    </p>
                 </div>
              </section>
           )}
           
           <section>
              <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-300 mb-6">Plant & Logistics</h4>
              <div className="space-y-6">
                 <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Plant Name</p>
                    <p className="text-sm font-bold text-slate-600">{bill.plant_name || 'N/A'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{bill.plant_description}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Delivery Note</p>
                      <p className="text-sm font-mono text-slate-600">{bill.delivery_note || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">State Code</p>
                      <p className="text-sm font-bold text-slate-600">{bill.supply_state || '-'}</p>
                    </div>
                 </div>
              </div>
           </section>
        </div>

        {/* Company Footer */}
        <footer className="mt-32 pt-12 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">
           <div className="flex items-center gap-4">
              <span>PAN: {bill.company_pan || 'N/A'}</span>
              <span>•</span>
              <span>Ref: {bill.vendor_inv_no || 'N/A'}</span>
           </div>
           <p>© 2026 {bill.company} Digital Twin Archive</p>
        </footer>
      </div>
    </div>
  );
}
