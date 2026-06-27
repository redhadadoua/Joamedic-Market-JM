import React, { useState, useEffect, useMemo } from "react";
import { User } from "firebase/auth";
import { motion } from "framer-motion";
import { LogOut, RefreshCcw, FileSpreadsheet, Package, CheckCircle2, Clock, Phone, UserPlus, ShieldAlert } from "lucide-react";
import { initAuth, googleSignIn, logout, getAccessToken, db } from "../lib/firebase";
import { createSpreadsheet, appendRowToSheet } from "../lib/sheets";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { cn } from "../lib/utils";

const COLORS = ["رمادي", "أسود", "أبيض", "أزرق سماوي", "أزرق ملكي", "أزرق داكن", "أحمر عنابي"];
const SIZES = ["S", "M", "L", "XL", "XXL"];

const STATUSES = [
  { id: 'pending', label: 'قيد المعالجة', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'in_delivery', label: 'قيد التوصيل', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'at_office', label: 'في المكتب', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { id: 'on_the_way', label: 'في الطريق', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  { id: 'completed', label: 'مكتمل', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'cancelled', label: 'ملغى', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
];

export default function Admin() {
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [moderators, setModerators] = useState<string[]>([]);
  const [newModerator, setNewModerator] = useState("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [isEditingInventory, setIsEditingInventory] = useState(false);
  const [editedInventory, setEditedInventory] = useState<Record<string, number>>({});
  
  const isAdmin = user?.email?.toLowerCase() === 'redhadadoua@gmail.com';

  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => { setUser(u); setNeedsAuth(false); },
      () => { setUser(null); setNeedsAuth(true); setIsAuthorized(null); }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Check if user is authorized (admin or moderator)
    if (isAdmin) {
      setIsAuthorized(true);
    } else {
      getDoc(doc(db, "moderators", user.email?.toLowerCase() || '')).then((docSnap) => {
        setIsAuthorized(docSnap.exists());
      }).catch(() => {
        setIsAuthorized(false);
      });
    }

    // Fetch spreadsheet ID from Firestore instead of Express API
    getDoc(doc(db, "settings", "general")).then((docSnap) => {
      if (docSnap.exists()) {
        setSpreadsheetId(docSnap.data().spreadsheetId);
      }
    });

    // Fetch inventory
    const unsubscribeInventory = onSnapshot(doc(db, "settings", "inventory"), (docSnap) => {
      if (docSnap.exists()) {
        setInventory(docSnap.data());
      } else {
        setInventory({});
      }
    });

    if (isAdmin) {
      const unsubscribeMods = onSnapshot(collection(db, "moderators"), (snapshot) => {
        setModerators(snapshot.docs.map(doc => doc.id));
      });
      return () => {
        unsubscribeMods();
        unsubscribeInventory();
      };
    }

    return () => {
      unsubscribeInventory();
    };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAuthorized) return;
    // Listen to orders in real-time from Firestore
    const unsubscribeOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by creation time (assuming createdAt is ISO string)
      ordersList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(ordersList);
    });

    return () => {
      unsubscribeOrders();
    };
  }, [user, isAuthorized]);

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
          
          await updateDoc(doc(db, "orders", order.id), { syncedToSheets: true });
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
      await setDoc(doc(db, "settings", "general"), { spreadsheetId: id }, { merge: true });
    } catch (error) {
      console.error(error);
      alert("فشل في إنشاء ملف Google Sheets.");
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
    } catch (e) {
      console.error(e);
    }
  };

  const updateOrderLocation = async (orderId: string, location: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { trackingLocation: location });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModerator.trim() || !isAdmin) return;
    try {
      await setDoc(doc(db, "moderators", newModerator.trim().toLowerCase()), { addedAt: new Date().toISOString() });
      setNewModerator("");
    } catch (e) {
      console.error("Failed to add moderator", e);
    }
  };

  const handleRemoveModerator = async (email: string) => {
    if (!isAdmin) return;
    try {
      // Need to use deleteDoc, let's import it first
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "moderators", email));
    } catch (e) {
      console.error("Failed to remove moderator", e);
    }
  };

  const handleSaveInventory = async () => {
    try {
      await setDoc(doc(db, "settings", "inventory"), editedInventory);
      setIsEditingInventory(false);
    } catch (e) {
      console.error("Failed to save inventory", e);
    }
  };

  const handleEditInventoryStart = () => {
    setEditedInventory({ ...inventory });
    setIsEditingInventory(true);
  };

  const soldItems = useMemo(() => {
    const stock: Record<string, number> = {};
    COLORS.forEach(c => SIZES.forEach(s => stock[`${c}-${s}`] = 0));
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const key = `${o.color}-${o.size}`;
      if (stock[key] !== undefined) {
        stock[key]++;
      }
    });
    return stock;
  }, [orders]);

  if (needsAuth === null || (user && isAuthorized === null)) {
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

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="bg-slate-900/80 border border-red-500/20 p-8 rounded-3xl max-w-sm w-full text-center">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">غير مصرح لك بالدخول</h2>
          <p className="text-slate-400 text-sm mb-6">هذا الحساب ({user?.email}) ليس لديه صلاحيات المسؤول أو المشرف.</p>
          <button onClick={logout} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-4 rounded-xl transition-colors">
            تسجيل الخروج
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
            {isAdmin && (
              !spreadsheetId ? (
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
              )
            )}
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-slate-400 text-xs sm:text-sm">إجمالي المبيعات (مكتمل)</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {orders.filter(o => o.status === 'completed').length * 3700}
              </span>
              <span className="text-xs text-slate-500">دج</span>
            </div>
          </div>
          
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-slate-400 text-xs sm:text-sm">المبيعات المتوقعة</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-blue-400">
                {orders.filter(o => ['in_delivery', 'at_office', 'on_the_way', 'pending'].includes(o.status)).length * 3700}
              </span>
              <span className="text-xs text-slate-500">دج</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-slate-400 text-xs sm:text-sm">الطلبات النشطة / الكلية</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-teal-400">
                {orders.filter(o => o.status !== 'cancelled' && o.status !== 'completed').length}
              </span>
              <span className="text-xs text-slate-500">نشط /</span>
              <span className="text-sm font-bold text-slate-400">{orders.filter(o => o.status !== 'cancelled').length} كلي</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-slate-400 text-xs sm:text-sm">المخزون الكلي المتوفر</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-purple-400">
                {(() => {
                  let totalStock = 0;
                  let totalSold = 0;
                  COLORS.forEach(c => SIZES.forEach(s => {
                    const key = `${c}-${s}`;
                    totalStock += inventory[key] || 0;
                    totalSold += soldItems[key] || 0;
                  }));
                  return Math.max(0, totalStock - totalSold);
                })()}
              </span>
              <span className="text-xs text-slate-500">قطعة متوفرة</span>
            </div>
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
                    <th className="px-6 py-4 font-medium">الحالة ومكان الطرد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-400">{order.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200">{order.customerName}</div>
                        <a href={`tel:${order.phone}`} className="text-teal-400 hover:text-teal-300 font-mono text-xs mt-1 flex items-center gap-1 transition-colors" dir="ltr">
                          <Phone className="w-3 h-3" />
                          {order.phone}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                          <span className="w-3 h-3 rounded-full bg-teal-500" />
                          <span className="font-medium">{order.color}</span>
                          <span className="text-slate-500 mx-1">|</span>
                          <span className="font-bold font-mono">{order.size}</span>
                        </div>
                        <div className="text-xs text-teal-400 font-bold mt-1.5 font-mono text-right">
                          {order.price || 3700} دج
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate" title={order.address}>
                        <div className="text-xs text-teal-400 mb-1">{order.deliveryMethod === 'home' ? 'توصيل منزلي' : 'مكتب'}</div>
                        <div className="text-slate-400 truncate">{order.address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <select
                            value={order.status || 'pending'}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-bold transition-all border outline-none appearance-none cursor-pointer text-center",
                              STATUSES.find(s => s.id === (order.status || 'pending'))?.color || STATUSES[0].color
                            )}
                            style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                          >
                            {STATUSES.map(status => (
                              <option key={status.id} value={status.id} className="bg-slate-900 text-slate-100">
                                {status.label}
                              </option>
                            ))}
                          </select>
                          <input 
                            type="text" 
                            defaultValue={order.trackingLocation || ''}
                            onBlur={(e) => updateOrderLocation(order.id, e.target.value)}
                            placeholder="موقع الطرد (مثلاً: مستودع الجزائر)"
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500 transition-colors"
                          />
                        </div>
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
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">مراقبة المخزون والمبيعات</h2>
                <p className="text-slate-400 text-xs mt-1">الكمية المباعة / المخزون الكلي</p>
              </div>
              {isAdmin && (
                isEditingInventory ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsEditingInventory(false)}
                      className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                    >
                      إلغاء
                    </button>
                    <button 
                      onClick={handleSaveInventory}
                      className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition"
                    >
                      حفظ
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleEditInventoryStart}
                    className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                  >
                    تعديل المخزون الكلي
                  </button>
                )
              )}
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
                      const key = `${color}-${size}`;
                      const sold = soldItems[key] || 0;
                      const total = isEditingInventory ? (editedInventory[key] || 0) : (inventory[key] || 0);
                      const available = Math.max(0, total - sold);
                      
                      return (
                        <div 
                          key={size} 
                          className={cn(
                            "rounded-lg border text-center font-mono text-xs sm:text-sm transition-colors overflow-hidden",
                            isEditingInventory 
                              ? "bg-slate-800 border-slate-700" 
                              : (available > 0 ? "bg-teal-500/10 border-teal-500/20 text-teal-400" : (total > 0 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-slate-800/30 border-slate-800 text-slate-600"))
                          )}
                        >
                          {isEditingInventory ? (
                            <input
                              type="number"
                              min="0"
                              value={editedInventory[key] || ''}
                              onChange={(e) => setEditedInventory({ ...editedInventory, [key]: parseInt(e.target.value) || 0 })}
                              placeholder="0"
                              className="w-full bg-transparent text-center py-2 focus:outline-none focus:bg-slate-700 text-slate-200"
                              dir="ltr"
                            />
                          ) : (
                            <div className="py-2 px-1 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2">
                              <span className="font-bold" title="الكمية المباعة">{sold}</span>
                              <span className="text-slate-500 hidden sm:inline">/</span>
                              <span className="text-slate-400" title="المخزون الكلي">{total}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Moderator Management (Admins Only) */}
          {isAdmin && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden mt-8">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-purple-400" />
                  إدارة المشرفين
                </h2>
                <p className="text-slate-400 text-xs mt-1">المشرفون يمكنهم معالجة الطلبات</p>
              </div>
              <div className="p-4 space-y-4">
                <form onSubmit={handleAddModerator} className="flex gap-2">
                  <input
                    type="email"
                    value={newModerator}
                    onChange={(e) => setNewModerator(e.target.value)}
                    placeholder="بريد المشرف (Gmail)"
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition flex items-center justify-center shrink-0"
                    title="إضافة مشرف"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </form>

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {moderators.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-4">لا يوجد مشرفون مضافون</div>
                  ) : (
                    moderators.map(email => (
                      <div key={email} className="flex items-center justify-between bg-slate-800/30 border border-slate-800 rounded-lg p-3">
                        <span className="text-sm font-mono text-slate-300 truncate">{email}</span>
                        <button
                          onClick={() => handleRemoveModerator(email)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                          title="إزالة المشرف"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
