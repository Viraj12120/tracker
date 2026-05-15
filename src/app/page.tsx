'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Search,
  Plus,
  CheckCircle,
  ArrowRight,
  Trash,
  Download,
  Filter,
  Package,
  ShoppingCart,
  Zap,
  MoreHorizontal,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  X
} from 'lucide-react';
import Link from 'next/link';

export default function BillingDashboard() {
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState<any>({ total_bills: 0, total_amount: 0, total_weight: 0 });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadData, setUploadData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<{ isOpen: boolean, message: string, type: 'error' | 'success' }>({ isOpen: false, message: '', type: 'error' });
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [totalUploads, setTotalUploads] = useState(0);
  const isSyncingRef = useRef(false);
  const isUploadingRef = useRef(false);

  useEffect(() => {
    fetchBills();
    fetchStats();
  }, [activeTab, search, sortDir]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bills?company=${activeTab}&search=${search}&sortDir=${sortDir}`);
      const result = await res.json();
      setBills(result.data || []);
    } catch (err) {
      console.error('Failed to fetch bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats?company=${activeTab}`);
      const result = await res.json();
      setStats(result);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleSync = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setModal({ isOpen: true, message: data.message, type: 'success' });
        fetchBills();
        fetchStats();
      } else {
        setModal({ isOpen: true, message: 'Sync failed: ' + data.error, type: 'error' });
      }
    } catch (err) {
      console.error('Failed to sync:', err);
      setModal({ isOpen: true, message: 'Error during sync', type: 'error' });
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (isUploadingRef.current) return;

    const files = Array.from(e.target.files);
    setTotalUploads(files.length);

    processFile(files[0], files.slice(1));
  };

  const processFile = async (file: File, queue: File[]) => {
    setUploadQueue(queue);
    isUploadingRef.current = true;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      
      let result;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 100) || 'Server returned a non-JSON error');
      }

      if (!res.ok) throw new Error(result.error || `Upload failed (${res.status})`);
      if (result.success) setUploadData({ ...result.data, pdf_filename: result.filename });
    } catch (err: any) {
      setModal({ isOpen: true, message: `Error parsing ${file.name}: ${err.message}`, type: 'error' });
      handleNextInQueue(queue);
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
    }
  };

  const handleNextInQueue = (currentQueue: File[] = uploadQueue) => {
    if (currentQueue.length > 0) {
      const nextFile = currentQueue[0];
      processFile(nextFile, currentQueue.slice(1));
    } else {
      setUploadData(null);
      setUploadQueue([]);
      setTotalUploads(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmUpload = async () => {
    try {
      const res = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadData),
      });
      const result = await res.json();
      if (res.ok) {
        fetchBills();
        fetchStats();
        if (uploadQueue.length === 0) {
          setModal({ isOpen: true, message: 'Successfully saved bill(s)!', type: 'success' });
        }
        handleNextInQueue();
      } else if (res.status === 409) {
        // Duplicate detected — show warning and let user decide to skip
        setModal({ isOpen: true, message: `⚠️ Duplicate Bill Detected\n\n${result.error}\n\nThis bill was NOT saved. Click dismiss to continue.`, type: 'error' });
        handleNextInQueue();
      } else {
        setModal({ isOpen: true, message: `Save failed: ${result.error}`, type: 'error' });
      }
    } catch (err: any) {
      setModal({ isOpen: true, message: `Save failed: ${err.message}`, type: 'error' });
    }
  };

  const deleteBill = async (id: number) => {
    if (!confirm('Delete this record?')) return;
    try {
      const res = await fetch('/api/bills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      if (res.ok) {
        fetchBills();
        fetchStats();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB').replace(/\//g, '.');
      }
    } catch (e) {
      console.error('Date formatting error:', e);
    }
    return String(dateStr).split('T')[0];
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans pb-20 selection:bg-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header & Global Search */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Tracker</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Archive System v2.0</p>
          </div>

          <div className="flex-1 max-w-md w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              type="text"
              placeholder="Search records..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-8 py-3.5 text-sm font-black text-slate-900 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
            >
              {isSyncing ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" /> : <RefreshCw size={18} />}
              Sync Gmail
            </button>
            <a
              href="/api/export"
              download
              className="flex items-center gap-2 px-8 py-3.5 text-sm font-black text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} />
              Export Ledger
            </a>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-8 py-3.5 text-sm font-black text-white bg-slate-900 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
              {isUploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={18} />}
              Process New
            </button>
            <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" />
          </div>
        </header>

        {/* Monochromatic KPI Cards */}
        <div className={`grid grid-cols-1 ${activeTab === 'AMAZON' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 mb-12`}>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Total Records</p>
            <p className="text-3xl font-black tracking-tighter">{stats.total_bills || 0} <span className="text-sm font-bold text-slate-300">BILLS</span></p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Amount Accumulated</p>
            <p className="text-3xl font-black tracking-tighter">₹{(stats.total_amount || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Weight Processed</p>
            <p className="text-3xl font-black tracking-tighter">{(stats.total_weight || 0).toLocaleString('en-IN')} <span className="text-sm font-bold text-slate-300">{activeTab === 'AMAZON' ? 'Kg' : 'KG'}</span></p>
          </div>
          {activeTab === 'AMAZON' && (
            <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl shadow-slate-200 flex flex-col justify-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Kesar Pieces</p>
              <p className="text-3xl font-black tracking-tighter">{stats.kesar_qty || 0} <span className="text-sm font-bold text-slate-400">PCS</span></p>
            </div>
          )}
        </div>

        {/* AI Review */}
        {uploadData && (
          <div className="mb-12 bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-100/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                  <CheckCircle className="text-slate-900" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Verification {totalUploads > 1 ? `(${totalUploads - uploadQueue.length} of ${totalUploads})` : ''}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uploadData.company} System Detected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleNextInQueue()} className="px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-900">
                  {uploadQueue.length > 0 ? 'Skip to Next' : 'Discard'}
                </button>
                <button onClick={confirmUpload} className="px-8 py-2.5 text-sm font-black text-white bg-slate-900 rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-100">
                  {uploadQueue.length > 0 ? 'Confirm & Next' : 'Confirm & Save'}
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  { key: 'vendor_name', label: 'Vendor' },
                  { key: 'po_number', label: 'PO Number' },
                  { key: 'grn_no', label: 'Reference No' },
                  { key: 'total_amount', label: 'Total Amount' }
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{f.label}</label>
                    <input
                      type="text"
                      value={uploadData[f.key] || ''}
                      onChange={e => setUploadData({ ...uploadData, [f.key]: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm font-bold focus:bg-white focus:border-slate-200 outline-none transition-all"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Vendor Address</label>
                  <textarea
                    value={uploadData.vendor_address || ''}
                    onChange={e => setUploadData({ ...uploadData, vendor_address: e.target.value })}
                    className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-xs font-medium h-20 outline-none focus:bg-white focus:border-slate-200 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Shipping Address</label>
                  <textarea
                    value={uploadData.shipping_address || ''}
                    onChange={e => setUploadData({ ...uploadData, shipping_address: e.target.value })}
                    className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-xs font-medium h-20 outline-none focus:bg-white focus:border-slate-200 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
                <div className="p-4 border-b border-slate-200/50 bg-white/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Line Items Details</h4>
                  <span className="text-[10px] font-black text-slate-900 bg-white px-2 py-0.5 rounded-full border border-slate-100">{uploadData.items?.length} items</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50">
                      <tr className="border-b border-slate-100">
                        {uploadData.company === 'STAR' ? (
                          <>
                            <th className="p-3 pl-6">Item</th>
                            <th className="p-3">Article</th>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-right">Rev. Qty</th>
                            <th className="p-3 text-right">Unit Cost</th>
                            <th className="p-3 text-right">MRP</th>
                            <th className="p-3 text-right pr-6">Cost</th>
                          </>
                        ) : uploadData.company === 'ZEPTO' ? (
                          <>
                             <th className="p-3 pl-6">HSN</th>
                             <th className="p-3">Description</th>
                             <th className="p-3 text-right">Actual Qty</th>
                             <th className="p-3 text-right">Return</th>
                             <th className="p-3 text-right">Net Qty</th>
                             <th className="p-3 text-right">Unit Price</th>
                             <th className="p-3 text-right">CGST</th>
                             <th className="p-3 text-right">SGST</th>
                             <th className="p-3 text-right pr-6">Total</th>
                          </>
                        ) : (
                          <>
                            <th className="p-4 pl-6">ASIN</th>
                            <th className="p-4">Description</th>
                            <th className="p-4 text-right">Unit Price</th>
                            <th className="p-4 text-right">Qty</th>
                            <th className="p-4 text-right pr-6">Total</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {uploadData.items?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-white transition-colors">
                          {uploadData.company === 'STAR' ? (
                            <>
                              <td className="p-3 pl-6 text-[10px] font-mono text-slate-400">{item.item_no}</td>
                              <td className="p-3 text-[10px] font-mono text-slate-500">{item.article_no}</td>
                              <td className="p-3 text-[11px] font-bold text-slate-700">{item.description}</td>
                              <td className="p-3 text-right text-[11px] font-black text-slate-900">{item.qty} {item.unit}</td>
                              <td className="p-3 text-right text-[11px] text-slate-500">₹{item.cost_per_unit}</td>
                              <td className="p-3 text-right text-[11px] text-slate-400">₹{item.mrp}</td>
                              <td className="p-3 text-right text-[11px] font-black text-slate-900 pr-6">₹{item.total_amount}</td>
                            </>
                          ) : uploadData.company === 'ZEPTO' ? (
                            <>
                               <td className="p-3 pl-6 text-[10px] font-mono text-slate-400">{item.hsn_code || '-'}</td>
                               <td className="p-3 text-[11px] font-bold text-slate-700 max-w-[180px]">{item.description}</td>
                               <td className="p-3 text-right text-[11px] font-black text-slate-900">{item.actual_qty || item.qty}</td>
                               <td className="p-3 text-right text-[11px] font-black text-red-500">{item.return_qty > 0 ? `-${item.return_qty}` : '-'}</td>
                               <td className="p-3 text-right text-[11px] font-black text-slate-900">{item.qty}</td>
                               <td className="p-3 text-right text-[11px] text-slate-500">₹{item.unit_price}</td>
                               <td className="p-3 text-right text-[10px] text-slate-400">{item.cgst_rate}% / ₹{item.cgst_amt}</td>
                               <td className="p-3 text-right text-[10px] text-slate-400">{item.sgst_rate}% / ₹{item.sgst_amt}</td>
                               <td className="p-3 text-right text-[11px] font-black text-slate-900 pr-6">₹{item.total_amount}</td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 pl-6 text-xs font-mono text-slate-400">{item.asin}</td>
                              <td className="p-4 text-sm font-bold text-slate-700">{item.description}</td>
                              <td className="p-4 text-right text-sm text-slate-500">₹{item.unit_price}</td>
                              <td className="p-4 text-right text-sm font-bold text-slate-700">{item.qty}</td>
                              <td className="p-4 text-right text-sm font-black text-slate-900 pr-6">₹{item.total_amount}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Filters */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl">
            {['ALL', 'AMAZON', 'STAR', 'ZEPTO'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 bg-white border border-slate-100 rounded-xl transition-all shadow-sm">
              <Filter size={14} />
              {sortDir === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50">
              <tr>
                <th className="py-5 px-4 pl-8">Source</th>
                <th className="py-5 px-4">Date</th>
                <th className="py-5 px-4">Description</th>
                <th className="py-5 px-4 text-right">Qty</th>
                <th className="py-5 px-4 text-right">Price</th>
                <th className="py-5 px-4">Reference No</th>
                <th className="py-5 px-4 text-right">Amount</th>
                <th className="py-5 px-4 pr-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bills.map((bill: any) => (
                <tr key={bill.id} className="group hover:bg-slate-50 transition-all">
                  <td className="py-5 px-4 pl-8">
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-100 text-slate-500">
                      {bill.company}
                    </span>
                  </td>
                  <td className="py-5 px-4 text-xs font-black text-slate-900 whitespace-nowrap">
                    {formatDate(bill.grn_date || bill.challan_date)}
                  </td>
                  <td className="py-5 px-4">
                    <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{bill.items?.[0]?.description || '-'}</p>
                    {bill.items?.length > 1 && <p className="text-[9px] font-bold text-slate-300">+{bill.items.length - 1} more</p>}
                  </td>
                  <td className="py-5 px-4 text-right text-xs font-black text-slate-900">
                    {bill.items?.[0]?.qty || '-'} {bill.items?.[0]?.unit || ''}
                  </td>
                  <td className="py-5 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                    ₹{bill.items?.[0]?.unit_price || bill.items?.[0]?.cost_per_unit || '-'}
                  </td>
                  <td className="py-5 px-4">
                    <p className="text-xs font-mono font-bold text-slate-600">{bill.grn_no || bill.challan_no || '-'}</p>
                    <p className="text-[9px] font-bold text-slate-300 uppercase truncate max-w-[100px]">{bill.vendor_name || '-'}</p>
                  </td>
                  <td className="py-5 px-4 text-right font-black text-slate-900 text-base">₹{(bill.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td className="py-5 px-4 pr-8 text-right flex items-center justify-end gap-1">
                    <button onClick={() => deleteBill(bill.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash size={16} />
                    </button>
                    <Link href={`/bills/${bill.id}`} className="p-2 text-slate-300 hover:text-slate-900 transition-all inline-block hover:scale-110">
                      <ChevronRight size={22} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && (
            <div className="p-20 flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-slate-100 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-slate-300 font-bold text-xs uppercase tracking-widest">Searching records...</p>
            </div>
          )}

          {!loading && bills.length === 0 && (
            <div className="p-32 text-center">
              <p className="text-slate-300 font-bold text-sm">No records found for "{search}"</p>
            </div>
          )}
        </div>

        {/* Modal UI */}
        {modal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className={`flex items-center gap-4 mb-6 ${modal.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${modal.type === 'error' ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  {modal.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{modal.type === 'error' ? 'Error' : 'Success'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{modal.type === 'error' ? 'Action Failed' : 'Action Completed'}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-600 mb-8 leading-relaxed max-h-48 overflow-y-auto">{modal.message}</p>
              <button onClick={() => setModal({ ...modal, isOpen: false })} className="w-full py-3.5 text-sm font-black text-white bg-slate-900 rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-200">
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
