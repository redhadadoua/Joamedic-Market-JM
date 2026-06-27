import { useState, useEffect, useMemo } from "react";
import { User } from "firebase/auth";
import { motion } from "framer-motion";
import { LogOut, RefreshCcw, FileSpreadsheet, Package, CheckCircle2, Clock } from "lucide-react";
import { initAuth, googleSignIn, logout, getAccessToken } from "../lib/firebase";
import { createSpreadsheet, appendRowToSheet } from "../lib/sheets";
import { socket } from "../lib/socket";
import { cn } from "../lib/utils";

const COLORS = ["رمادي", "أسود", "أبيض", "أزرق سماوي", "أزرق ملكي", "أزرق داكن", "أحمر عنابي"];
const SIZES = ["S", "M", "L", "XL", "XXL"];

export default function Admin() {
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => { setUser(u); setNeedsAuth(false); },
      () => { setUser(null); setNeedsAuth(true); }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch("/api/settings/spreadsheet").then(res => res.json()).then(data => {
      setSpreadsheetId(data.spreadsheetId);
    });

    fetch("/api/orders").then(res => res.json()).then(data => {
      setOrders(data);
    });

    socket.on("order_added", (order) => {
      setOrders(prev => [...prev, order]);
    });
    
    socket.on("order_updated", (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    return () => {
      socket.off("order_added");
      socket.off("order_updated");
    };
  }, []);

  // Sync to sheets side effect
  useEffect(() => {
    if (!user || !spreadsheetId) return;

    const syncUnsyncedOrders = async () => {
      const unsynced = orders.filter(o => !o.syncedToSheets);
      for (const order of unsynced) {
        try {
          await appendRowToSheet(spreadsheetId, [
            order.id,
            new Date(order.createdAt).toLocaleString('ar-DZ'),
            order.customerName,
            order.phone,
            order.address,
            order.deliveryMethod === 'home' ? 'توصيل منزلي' : 'مكتب',
            order.color,
            order.size,
            order.status
          ]);
          
          await fetch(`/api/orders/${order.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ syncedToSheets: true })
          });
        } catch (e) {
          console.error("Failed to sync order", order.id, e);
        }
      }
    };

    if (orders.some(o => !o.syncedToSheets)) {
      syncUnsyncedOrders();
    }
  }, [orders, user, spreadsheetId]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setUser(res.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSetupSheets = async () => {
    setIsCreatingSheet(true);
    try {
      const id = await createSpreadsheet();
      setSpreadsheetId(id);
      await fetch('/api/settings/spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: id })
      });
    } catch (error) {
      console.error(error);
      alert("فشل في إنشاء ملف Google Sheets.");
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const toggleStatus = async (order: any) => {
    const newStatus = order.status === 'pending' ? 'fulfilled' : 'pending';
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const variantStock = useMemo(() => {
    const stock: Record<string, number> = {};
    COLORS.forEach(c => SIZES.forEach(s => stock[`${c}-${s}`] = 0));
    orders.forEach(o => {
      const key = `${o.color}-${o.size}`;
      if (stock[key] !== undefined) {
        stock[key]++;
      }
    });
    return stock;
  }, [orders]);

  if (needsAuth === null) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" /></div>;
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 10, repeat: Infinity }} className="absolute -top-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-slate-800/50 blur-[100px]" />
        </div>
        <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative z-10">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Package className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">لوحة التحكم</h1>
          <p className="text-slate-400 text-sm mb-8">تسجيل الدخول كمسؤول حصراً</p>
          
          <button 
            onClick={handleLogin} 
            disabled={isLoggingIn}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors"
          >
            {isLoggingIn ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                تسجيل الدخول باستخدام جوجل
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/50 backdrop-blur-md border border-slate-800 p-6 rounded-2xl">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-teal-400 to-blue-500">JOAmedic Admin</h1>
            <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {!spreadsheetId ? (
              <button 
                onClick={handleSetupSheets}
                disabled={isCreatingSheet}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                {isCreatingSheet ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                تفعيل Google Sheets
              </button>
            ) : (
              <a href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                فتح جدول البيانات
              </a>
            )}
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Orders Table */}
          <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-teal-400"/> أحدث الطلبات</h2>
              <span className="bg-slate-800 text-teal-400 px-3 py-1 rounded-full text-xs font-bold">{orders.length} طلب</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">الطلب</th>
                    <th className="px-6 py-4 font-medium">العميل</th>
                    <th className="px-6 py-4 font-medium">المنتج (اللون والمقاس)</th>
                    <th className="px-6 py-4 font-medium">التوصيل</th>
                    <th className="px-6 py-4 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {orders.slice().reverse().map(order => (
                    <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-400">{order.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200">{order.customerName}</div>
                        <div className="text-slate-500 font-mono text-xs mt-1" dir="ltr">{order.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                          <span className="w-3 h-3 rounded-full bg-teal-500" />
                          <span className="font-medium">{order.color}</span>
                          <span className="text-slate-500 mx-1">|</span>
                          <span className="font-bold font-mono">{order.size}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate" title={order.address}>
                        <div className="text-xs text-teal-400 mb-1">{order.deliveryMethod === 'home' ? 'توصيل منزلي' : 'مكتب'}</div>
                        <div className="text-slate-400 truncate">{order.address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => toggleStatus(order)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                            order.status === 'fulfilled' 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                          )}
                        >
                          {order.status === 'fulfilled' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {order.status === 'fulfilled' ? 'تم التوصيل' : 'قيد المعالجة'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">لا توجد طلبات بعد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Variant Stock Monitor */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">مراقبة المخزون والمبيعات</h2>
              <p className="text-slate-400 text-xs mt-1">الطلبات المسجلة حسب اللون والمقاس</p>
            </div>
            <div className="p-4 overflow-x-auto">
              <div className="grid grid-cols-[minmax(80px,auto)_repeat(5,1fr)] gap-2 text-center text-sm mb-2 font-medium text-slate-400">
                <div className="text-right">اللون</div>
                <div>S</div>
                <div>M</div>
                <div>L</div>
                <div>XL</div>
                <div>XXL</div>
              </div>
              <div className="space-y-2 min-w-[300px]">
                {COLORS.map(color => (
                  <div key={color} className="grid grid-cols-[minmax(80px,auto)_repeat(5,1fr)] gap-2 items-center">
                    <div className="text-right text-sm text-slate-300 w-24 truncate" title={color}>{color}</div>
                    {SIZES.map(size => {
                      const count = variantStock[`${color}-${size}`];
                      return (
                        <div 
                          key={size} 
                          className={cn(
                            "py-2 rounded-lg border text-center font-mono text-sm transition-colors",
                            count > 0 ? "bg-teal-500/20 border-teal-500/30 text-teal-300 font-bold" : "bg-slate-800/30 border-slate-800 text-slate-600"
                          )}
                        >
                          {count}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
