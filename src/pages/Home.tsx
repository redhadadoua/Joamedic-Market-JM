import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ShieldCheck, Truck, Clock, ArrowLeft, Search, CheckCircle2, Package, MapPin, Calendar, Map } from "lucide-react";
import { cn } from "../lib/utils";
import productImage from "../assets/images/medical_scrubs_white_1782522892178.jpg";
import { db } from "../lib/firebase";
import { collection, addDoc, getDoc, doc, setDoc } from "firebase/firestore";

const COLORS = [
  { id: "charcoal", name: "رمادي", hex: "#374151", filter: "saturate(0) brightness(0.5)" },
  { id: "black", name: "أسود", hex: "#0f172a", filter: "saturate(0) brightness(0.2)" },
  { id: "white", name: "أبيض", hex: "#f8fafc", filter: "saturate(0) brightness(1.2)" },
  { id: "sky", name: "أزرق سماوي", hex: "#38bdf8", filter: "hue-rotate(180deg) saturate(1.5) brightness(1.1)" },
  { id: "royal", name: "أزرق ملكي", hex: "#1d4ed8", filter: "hue-rotate(200deg) saturate(2) brightness(0.9)" },
  { id: "navy", name: "أزرق داكن", hex: "#1e3a8a", filter: "hue-rotate(220deg) saturate(1.2) brightness(0.7)" },
  { id: "burgundy", name: "أحمر عنابي", hex: "#831843", filter: "hue-rotate(320deg) saturate(1.5) brightness(0.8)" }
];

const SIZES = [
  { id: "S", available: false },
  { id: "M", available: true },
  { id: "L", available: true },
  { id: "XL", available: true },
  { id: "XXL", available: false }
];

import { getWilayaList, getBaladyiatsForWilaya } from "@dzcode-io/leblad";

const STATUS_LABELS: Record<string, { label: string, colorClass: string }> = {
  pending: { label: 'قيد المعالجة', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  in_delivery: { label: 'قيد التوصيل', colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  at_office: { label: 'في المكتب', colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  on_the_way: { label: 'في الطريق', colorClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  completed: { label: 'مكتمل', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'ملغى', colorClass: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

export default function Home() {
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedSize, setSelectedSize] = useState("M");
  
  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const [selectedCommune, setSelectedCommune] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("home");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successOrder, setSuccessOrder] = useState<any>(null);

  // Tracking State
  const [isTrackingMode, setIsTrackingMode] = useState(false);
  const [trackingId, setTrackingId] = useState("");
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const fullAddress = deliveryMethod === "home" 
        ? `${selectedWilaya} - ${selectedCommune}\n${address}`
        : selectedWilaya;

      const customTrackingId = 'JM-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const orderData = {
        customerName: name,
        phone,
        address: fullAddress,
        deliveryMethod,
        color: selectedColor.name,
        size: selectedSize,
        cod: true,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "orders", customTrackingId), orderData);
      setSuccessOrder({ id: customTrackingId, ...orderData });
      setIsSuccess(true);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء تأكيد الطلب. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setIsSearching(true);
    try {
      const docRef = doc(db, "orders", trackingId.trim());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTrackingResult({ id: docSnap.id, ...docSnap.data() });
      } else {
        setTrackingResult({ notFound: true });
      }
    } catch (error) {
      console.error(error);
      setTrackingResult({ notFound: true });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-100 flex flex-col py-6 px-4 sm:px-6">
      
      {/* Header */}
      <div className="relative z-20 w-full max-w-6xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-teal-200 to-blue-400 tracking-tight">
          JOAmedic
        </h1>
        <button 
          onClick={() => { setIsTrackingMode(!isTrackingMode); setTrackingResult(null); setTrackingId(""); }}
          className="text-sm font-medium text-teal-400 hover:text-teal-300 flex items-center gap-2 bg-teal-500/10 px-4 py-2 rounded-full border border-teal-500/20 transition-colors"
        >
          {isTrackingMode ? <><ArrowLeft className="w-4 h-4" /> العودة للتسوق</> : <><Search className="w-4 h-4" /> تتبع طلبك</>}
        </button>
      </div>
      
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-teal-900/20 blur-[120px]"
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }} 
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-blue-900/20 blur-[100px]"
        />
        <motion.div 
          animate={{ x: [0, 100, 0], y: [0, -50, 0] }} 
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-emerald-900/10 blur-[80px]"
        />
      </div>

      <AnimatePresence mode="wait">
        {isTrackingMode ? (
          <motion.div 
            key="tracking"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative w-full max-w-xl mx-auto flex flex-col items-center z-10 pt-10"
          >
            <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 p-8 rounded-3xl shadow-2xl w-full">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Search className="text-teal-400" /> تتبع طلبك</h2>
              <form onSubmit={handleTrackOrder} className="flex gap-3 mb-8">
                <input 
                  type="text" 
                  dir="ltr"
                  placeholder="رقم الطلب (مثال: JM-ABCDEF)"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-left uppercase"
                />
                <button 
                  disabled={isSearching}
                  type="submit"
                  className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-70"
                >
                  {isSearching ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full" /> : "بحث"}
                </button>
              </form>

              {trackingResult && (
                <div className="mt-4">
                  {trackingResult.notFound ? (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
                      لم يتم العثور على طلب بهذا الرقم. يرجى التأكد من الرقم والمحاولة مجدداً.
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="bg-slate-800/80 border border-slate-700/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden"
                    >
                      {/* Decorative background element */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/50 relative z-10">
                        <div>
                          <div className="text-slate-400 text-sm mb-1 flex items-center gap-2">
                            <Package className="w-4 h-4" /> رقم الطلب
                          </div>
                          <div className="font-mono font-bold text-teal-400 text-xl">{trackingResult.id}</div>
                        </div>
                        <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold border backdrop-blur-md self-start md:self-auto", 
                          STATUS_LABELS[trackingResult.status]?.colorClass || STATUS_LABELS['pending'].colorClass
                        )}>
                          {trackingResult.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          {STATUS_LABELS[trackingResult.status]?.label || STATUS_LABELS['pending'].label}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs mb-0.5">تاريخ الطلب</div>
                              <div className="text-slate-200 text-sm font-medium" dir="ltr">
                                {new Date(trackingResult.createdAt).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center shrink-0">
                              <Map className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs mb-0.5">المنتج المطلوب</div>
                              <div className="text-slate-200 text-sm font-medium">JOAmedic - {trackingResult.color} (المقاس {trackingResult.size})</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center shrink-0">
                              <Truck className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs mb-0.5">وجهة التوصيل</div>
                              <div className="text-slate-200 text-sm font-medium">{trackingResult.wilaya} {trackingResult.commune ? `- ${trackingResult.commune}` : ''}</div>
                              <div className="text-slate-400 text-xs mt-0.5">{trackingResult.deliveryMethod === 'home' ? 'توصيل إلى باب المنزل' : 'توصيل إلى مكتب شركة الشحن'}</div>
                            </div>
                          </div>

                          {trackingResult.trackingLocation && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4 text-teal-400 animate-pulse" />
                              </div>
                              <div>
                                <div className="text-teal-500/80 text-xs mb-0.5 font-medium">الموقع الحالي للطرد</div>
                                <div className="text-teal-300 text-sm font-bold bg-teal-500/5 px-2 py-1 rounded-lg border border-teal-500/10 inline-block">
                                  {trackingResult.trackingLocation}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="shop"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative w-full max-w-6xl mx-auto flex-1 flex items-center justify-center"
          >
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start z-10">
              {/* Left Column: Product Showcase */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col space-y-6"
              >
          <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-700/50 p-6 rounded-3xl shadow-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-teal-200 to-blue-400 tracking-tight mb-2">
                  JOAmedic
                </h1>
                <p className="text-slate-400 text-lg">الزي الطبي الأكثر راحة وأناقة</p>
              </div>
              <div className="bg-teal-500/20 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium border border-teal-500/30">
                حصري
              </div>
            </div>

            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-800/50 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedColor.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  src={productImage}
                  alt="JOAmedic Scrubs"
                  className="w-full h-full object-cover mix-blend-screen"
                  style={{ filter: selectedColor.filter }}
                />
              </AnimatePresence>
            </div>
            
            <div className="mt-6 flex items-center gap-4 text-sm text-slate-300 bg-slate-800/50 p-4 rounded-2xl">
              <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-teal-400" /> قماش مضاد للبكتيريا</div>
              <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-teal-400" /> مرونة 4 اتجاهات</div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Configurator & Checkout */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col space-y-6"
        >
          {/* Configurator */}
          <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-700/50 p-6 rounded-3xl shadow-2xl">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-slate-200">اللون: <span className="text-teal-400">{selectedColor.name}</span></h3>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 pb-2 justify-center sm:justify-start">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "flex-shrink-0 w-9 h-9 sm:w-12 sm:h-12 rounded-full transition-all duration-300 border-2 outline-none",
                      selectedColor.id === c.id 
                        ? "border-teal-400 scale-110 shadow-[0_0_15px_rgba(45,212,191,0.4)]" 
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.hex }}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-slate-200">المقاس:</h3>
                <span className="text-sm text-teal-400 underline decoration-teal-400/30 cursor-pointer">دليل المقاسات</span>
              </div>
              <div className="flex gap-3 flex-wrap">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    disabled={!s.available}
                    onClick={() => s.available && setSelectedSize(s.id)}
                    className={cn(
                      "flex-1 min-w-[3rem] py-3 rounded-xl font-medium transition-all duration-300 border",
                      selectedSize === s.id 
                        ? "bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-[0_0_15px_rgba(45,212,191,0.2)]" 
                        : s.available 
                          ? "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 cursor-pointer"
                          : "bg-slate-900/30 text-slate-600 border-slate-800 cursor-not-allowed opacity-50"
                    )}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
            <AnimatePresence>
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-slate-900/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center"
                >
                  <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mb-6">
                    <Check className="w-10 h-10 text-teal-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-100 mb-2">تم تأكيد الطلب بنجاح!</h2>
                  <p className="text-slate-400 mb-2">سيتم التواصل معك قريباً لتأكيد تفاصيل الشحن.</p>
                  {successOrder && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6 w-full">
                      <div className="text-sm text-slate-400 mb-1">رقم تتبع الطلب الخاص بك:</div>
                      <div className="font-mono text-xl font-bold text-teal-400 select-all">{successOrder.id}</div>
                    </div>
                  )}
                  <button 
                    onClick={() => { setIsSuccess(false); setName(""); setPhone(""); setAddress(""); setSuccessOrder(null); }}
                    className="flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> العودة للتسوق
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex items-center gap-3 mb-6">
              <Truck className="w-6 h-6 text-teal-400" />
              <h2 className="text-2xl font-bold">الدفع عند الاستلام</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">الاسم الكامل</label>
                  <input 
                    required 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    placeholder="الإسم واللقب"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">رقم الهاتف</label>
                  <input 
                    required 
                    type="tel" 
                    dir="ltr"
                    value={phone} 
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-right"
                    placeholder="05XX XXX XXX"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">طريقة التوصيل</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("home")}
                    className={cn(
                      "py-3 rounded-xl text-sm font-medium transition-all border",
                      deliveryMethod === "home" 
                        ? "bg-teal-500/20 text-teal-300 border-teal-500/50" 
                        : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800"
                    )}
                  >
                    توصيل للمنزل
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("stopdesk")}
                    className={cn(
                      "py-3 rounded-xl text-sm font-medium transition-all border",
                      deliveryMethod === "stopdesk" 
                        ? "bg-teal-500/20 text-teal-300 border-teal-500/50" 
                        : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800"
                    )}
                  >
                    استلام من المكتب
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">الولاية</label>
                <select
                  required
                  value={selectedWilaya}
                  onChange={e => {
                    setSelectedWilaya(e.target.value);
                    setSelectedCommune(""); // Reset commune when wilaya changes
                  }}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all appearance-none"
                >
                  <option value="">اختر الولاية...</option>
                  {getWilayaList().map((w: any) => (
                    <option key={w.mattricule} value={w.name_ar}>
                      {w.mattricule} - {w.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              {deliveryMethod === "home" && selectedWilaya && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">البلدية</label>
                  <select
                    required
                    value={selectedCommune}
                    onChange={e => setSelectedCommune(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all appearance-none"
                  >
                    <option value="">اختر البلدية...</option>
                    {getBaladyiatsForWilaya(getWilayaList().find((w: any) => w.name_ar === selectedWilaya)?.mattricule || 1).map((c: any, idx: number) => (
                      <option key={idx} value={c.name_ar}>
                        {c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {deliveryMethod === "home" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">
                    عنوان التوصيل التفصيلي (الحي، الشارع...)
                  </label>
                  <textarea 
                    required 
                    value={address} 
                    onChange={e => setAddress(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all resize-none h-20"
                    placeholder="أدخل تفاصيل العنوان هنا..."
                  />
                </div>
              )}

              <button 
                disabled={isSubmitting}
                type="submit" 
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-900 font-bold text-lg py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(45,212,191,0.3)] hover:shadow-[0_0_30px_rgba(45,212,191,0.5)] disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full" />
                ) : "تأكيد الطلب"}
              </button>
            </form>
          </div>
        </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
