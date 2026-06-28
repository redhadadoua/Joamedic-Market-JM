import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ShieldCheck, Truck, Clock, ArrowLeft, Search, CheckCircle2, Package, MapPin, Calendar, Map, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { db } from "../lib/firebase";
import { collection, addDoc, getDoc, doc, setDoc } from "firebase/firestore";

// Import real scrub images
import scrubWhite from "../assets/images/scrub_white_1782599260078.jpg";
import scrubCharcoal from "../assets/images/scrub_charcoal_1782599280126.jpg";
import scrubBlack from "../assets/images/scrub_black_1782599291799.jpg";
import scrubSky from "../assets/images/scrub_sky_1782599303467.jpg";
import scrubRoyal from "../assets/images/scrub_royal_1782599317090.jpg";
import scrubNavy from "../assets/images/scrub_navy_1782599328387.jpg";
import scrubBurgundy from "../assets/images/scrub_burgundy_1782599338839.jpg";

const COLORS = [
  { id: "charcoal", name: "رمادي", hex: "#374151", image: scrubCharcoal },
  { id: "black", name: "أسود", hex: "#0f172a", image: scrubBlack },
  { id: "white", name: "أبيض", hex: "#f8fafc", image: scrubWhite },
  { id: "sky", name: "أزرق سماوي", hex: "#38bdf8", image: scrubSky },
  { id: "royal", name: "أزرق ملكي", hex: "#1d4ed8", image: scrubRoyal },
  { id: "navy", name: "أزرق داكن", hex: "#1e3a8a", image: scrubNavy },
  { id: "burgundy", name: "أحمر عنابي", hex: "#831843", image: scrubBurgundy }
];

const SIZES = [
  { id: "S", available: false },
  { id: "M", available: true },
  { id: "L", available: true },
  { id: "XL", available: true },
  { id: "XXL", available: false }
];

import { getWilayaList, getBaladyiatsForWilaya } from "../utils/wilayas69";
import { usePageMetadata } from "../hooks/usePageMetadata";

const STATUS_LABELS: Record<string, { label: string, colorClass: string }> = {
  pending: { label: 'قيد المعالجة', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  in_delivery: { label: 'قيد التوصيل', colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  at_office: { label: 'في المكتب', colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  on_the_way: { label: 'في الطريق', colorClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  completed: { label: 'مكتمل', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'ملغى', colorClass: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

export default function Home() {
  usePageMetadata("Joamedic - أحذية طبية مريحة", "أحذية Joamedic الطبية، راحة يومية وأناقة في كل خطوة.");

  const [orderItems, setOrderItems] = useState<Array<{ id: string, color: typeof COLORS[0], size: string, quantity: number }>>([
    { id: "initial-item", color: COLORS[0], size: "M", quantity: 1 }
  ]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  const selectedColor = orderItems[activeItemIndex]?.color || COLORS[0];
  const selectedSize = orderItems[activeItemIndex]?.size || "M";

  const setSelectedColor = (color: typeof COLORS[0]) => {
    setOrderItems(prev => prev.map((item, idx) => idx === activeItemIndex ? { ...item, color } : item));
  };

  const setSelectedSize = (size: string) => {
    setOrderItems(prev => prev.map((item, idx) => idx === activeItemIndex ? { ...item, size } : item));
  };

  const handleUpdateQty = (idx: number, delta: number) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleDeleteItem = (idx: number) => {
    if (orderItems.length <= 1) return;
    setOrderItems(prev => prev.filter((_, i) => i !== idx));
    setActiveItemIndex(prev => {
      const newLen = orderItems.length - 1;
      if (prev >= newLen) {
        return Math.max(0, newLen - 1);
      }
      return prev;
    });
  };

  const handleAddItem = () => {
    const newItem = {
      id: Math.random().toString(),
      color: COLORS[0],
      size: "M",
      quantity: 1
    };
    setOrderItems(prev => [...prev, newItem]);
    setActiveItemIndex(orderItems.length);
  };
  
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
  const [whatsappNumber, setWhatsappNumber] = useState("213000000000");

  // Fetch whatsapp number
  React.useEffect(() => {
    getDoc(doc(db, "settings", "general")).then((docSnap) => {
      if (docSnap.exists() && docSnap.data().whatsappNumber) {
        setWhatsappNumber(docSnap.data().whatsappNumber);
      }
    });
  }, []);

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
        : `${selectedWilaya} - ${selectedCommune} (استلام من المكتب)`;

      const generateSecureTrackingId = () => {
        const array = new Uint8Array(8);
        window.crypto.getRandomValues(array);
        return 'JM-' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 10).toUpperCase();
      };
      
      const customTrackingId = generateSecureTrackingId();

      const totalQty = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = orderItems.reduce((sum, item) => sum + (3700 * item.quantity), 0);

      // Color and size strings for backward compatibility and Sheets view
      const summaryColor = orderItems.map(item => `${item.color.name} (x${item.quantity})`).join(', ');
      const summarySize = orderItems.map(item => `${item.size} (x${item.quantity})`).join(', ');

      const orderData = {
        customerName: name,
        phone,
        wilaya: selectedWilaya,
        baladiya: selectedCommune,
        address: fullAddress,
        deliveryMethod,
        color: summaryColor,
        size: summarySize,
        price: totalPrice,
        quantity: totalQty,
        items: orderItems.map(item => ({
          color: item.color.name,
          size: item.size,
          quantity: item.quantity,
          price: 3700
        })),
        cod: true,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "orders", customTrackingId), orderData);
      setSuccessOrder({ id: customTrackingId, ...orderData });
      setIsSuccess(true);
      toast.success("تم تأكيد الطلب بنجاح");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء تأكيد الطلب. يرجى المحاولة مرة أخرى.");
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
        toast.error("عذراً، لم نتمكن من العثور على طلب بهذا الرقم.");
      }
    } catch (error) {
      console.error(error);
      setTrackingResult({ notFound: true });
      toast.error("حدث خطأ أثناء البحث عن الطلب.");
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
                              <div className="text-slate-200 text-sm font-medium">{trackingResult.wilaya} {trackingResult.baladiya ? `- ${trackingResult.baladiya}` : ''}</div>
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
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-teal-400">3700 دج</span>
                  <span className="text-xs sm:text-sm text-slate-500 line-through">5200 دج</span>
                </div>
              </div>
              <div className="bg-teal-500/20 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium border border-teal-500/30">
                حصري
              </div>
            </div>

            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-800/30 flex items-center justify-center border border-slate-800">
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedColor.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  src={selectedColor.image}
                  alt="JOAmedic Scrubs"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
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

            <div className="mt-4">
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

            {/* List of items in the current order */}
            <div className="mt-6 pt-6 border-t border-slate-800" dir="rtl">
              <h4 className="text-sm font-semibold text-slate-400 mb-3 text-right">القطع المطلوبة في هذا الطلب ({orderItems.length}):</h4>
              <div className="space-y-3">
                {orderItems.map((item, idx) => (
                  <div 
                    key={item.id}
                    onClick={() => setActiveItemIndex(idx)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden text-right",
                      activeItemIndex === idx 
                        ? "bg-slate-800/80 border-teal-500/50 shadow-[0_0_15px_rgba(45,212,191,0.1)]" 
                        : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border border-slate-700 flex-shrink-0" style={{ backgroundColor: item.color.hex }} />
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-200">
                          JOAmedic - {item.color.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          المقاس: <span className="text-teal-400 font-semibold">{item.size}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      {/* Quantity Selector */}
                      <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1" dir="ltr">
                        <button 
                          type="button"
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-teal-400 text-lg transition-colors font-bold"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-mono font-bold text-slate-200">{item.quantity}</span>
                        <button 
                          type="button"
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-teal-400 text-lg transition-colors font-bold"
                        >
                          +
                        </button>
                      </div>

                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="text-red-400 hover:text-red-300 p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                          title="حذف القطعة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Removed 'تعديل حالي' label indicator */}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="w-full mt-4 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 hover:border-teal-500/30 text-teal-300 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-sm"
              >
                <Plus className="w-4 h-4 text-teal-400" /> إضافة قطعة أخرى للطلب (بلون أو مقاس مختلف)
              </button>
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
                      <div className="font-mono text-xl font-bold text-teal-400 select-all mb-4">{successOrder.id}</div>
                      
                      <a 
                        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`مرحباً، قمت للتو بطلب حذاء Joamedic وأود تأكيد طلبي.\nالاسم: ${successOrder.customerName}\nرقم الطلب: ${successOrder.id}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-lg font-bold transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                        تأكيد الطلب عبر واتساب
                      </a>
                    </div>
                  )}
                  <button 
                    onClick={() => { 
                      setIsSuccess(false); 
                      setName(""); 
                      setPhone(""); 
                      setAddress(""); 
                      setSuccessOrder(null); 
                      setOrderItems([{ id: "initial-item", color: COLORS[0], size: "M", quantity: 1 }]);
                      setActiveItemIndex(0);
                    }}
                    className="flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> العودة للتسوق
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Truck className="w-6 h-6 text-teal-400" />
                <h2 className="text-2xl font-bold">الدفع عند الاستلام</h2>
              </div>
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl px-4 py-2 flex items-center gap-2 self-start sm:self-auto text-right" dir="rtl">
                <span className="text-sm text-slate-400">
                  السعر الإجمالي ({orderItems.reduce((sum, item) => sum + item.quantity, 0)} قطع):
                </span>
                <span className="text-xl font-black text-teal-400">
                  {orderItems.reduce((sum, item) => sum + (3700 * item.quantity), 0)} دج
                </span>
              </div>
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

              {selectedWilaya && (
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
