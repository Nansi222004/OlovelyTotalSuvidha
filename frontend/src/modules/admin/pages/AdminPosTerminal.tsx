import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  lookupBarcode,
  posCheckout,
  searchPosProducts,
  type PosSearchResult,
  type PosCheckoutResponse,
} from "../../../services/api/admin/adminInventoryService";
import { getAllCustomers, type Customer } from "../../../services/api/admin/adminCustomerService";
import { resolveImageUrl } from "../../../utils/imageUrl";
import { getAppSettings, type AppSettings } from "../../../services/api/admin/adminSettingsService";
import { areSameIndianState, getStateByName, INDIAN_STATES, normalizeStateCode } from "../../../utils/indianStates";
import { PosInvoiceItemRows, PosInvoiceTaxLines } from "../components/PosInvoiceParts";

// --- SOUND EFFECTS (Web Audio API - no external assets required) ---
class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  beep() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // High pleasant beep (A6)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  success() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.1, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.15);
      });
    } catch {
      // Audio fallback
    }
  }

  error() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio fallback
    }
  }
}

const sounds = new SoundManager();

// --- INTERFACES ---
export interface CartItem {
  cartItemId: string; // unique key in cart
  productId: string;
  productName: string;
  mainImage?: string;
  sku?: string;
  barcode?: string;
  variationId?: string;
  variationName?: string;
  variationTitle?: string;
  unitPrice: number;
  stock: number;
  quantity: number;
  taxRate: number; // percentage, e.g. 5, 12, 18
  hsnCode?: string;
  ownerType?: string;
  ownerLabel?: string;
  isPlatform?: boolean;
}

export interface PosCustomerInfo {
  customerId?: string;
  name: string;
  phone: string;
  email?: string;
  state?: string;
  stateCode?: string;
  isWalkIn: boolean;
}

const DEFAULT_CUSTOMER: PosCustomerInfo = {
  name: "Walk-in Customer",
  phone: "0000000000",
  isWalkIn: true,
};

export default function AdminPosTerminal() {
  // Scanner & Search
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PosSearchResult[]>([]);
  const [scannerReady, setScannerReady] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const checkoutAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [businessSettings, setBusinessSettings] = useState<AppSettings | null>(null);
  const [businessSettingsError, setBusinessSettingsError] = useState("");

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [orderNotes, setOrderNotes] = useState("");

  // Customer State
  const [customer, setCustomer] = useState<PosCustomerInfo>(DEFAULT_CUSTOMER);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Variant Picker Modal
  const [pendingVariantProduct, setPendingVariantProduct] = useState<any | null>(null);

  // Payment & Checkout
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Card" | "Wallet" | "Other">("Cash");
  const [tenderAmount, setTenderAmount] = useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<PosCheckoutResponse["data"] | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptFormat, setReceiptFormat] = useState<"thermal" | "a4">("thermal");
  const [recentSales, setRecentSales] = useState<PosCheckoutResponse["data"][]>([]);

  // Feedback notifications
  const [alertBanner, setAlertBanner] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showAlert = (message: string, type: "success" | "error" | "info" = "info") => {
    setAlertBanner({ type, message });
    if (type === "error") sounds.error();
    else if (type === "success") sounds.success();
    setTimeout(() => {
      setAlertBanner(null);
    }, 4500);
  };

  // Auto-focus barcode scanner input
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    getAppSettings()
      .then((response) => {
        if (response?.success && response.data) setBusinessSettings(response.data);
        else setBusinessSettingsError("Business GST settings could not be loaded.");
      })
      .catch(() => setBusinessSettingsError("Business GST settings could not be loaded."));
  }, []);

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an active textarea or modal text input
      const target = e.target as HTMLElement;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        setShowCustomerModal(prev => !prev);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cart.length > 0 && !isCheckingOut) {
          handleDirectCheckout();
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        if (lastCompletedSale) {
          setShowReceiptModal(true);
        }
      } else if (e.key === "Escape") {
        if (showReceiptModal) setShowReceiptModal(false);
        if (showCustomerModal) setShowCustomerModal(false);
        if (pendingVariantProduct) setPendingVariantProduct(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, isCheckingOut, lastCompletedSale, showReceiptModal, showCustomerModal, pendingVariantProduct]);

  // Sync sound manager enabled state
  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const results = await searchPosProducts(query);
        if (barcodeInputRef.current?.value.trim() === query) setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Load recent sales from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pos_recent_sales");
      if (saved) {
        setRecentSales(JSON.parse(saved).slice(0, 15));
      }
    } catch {
      // LocalStorage parsing error fallback
    }
  }, []);

  const saveRecentSale = (saleData: PosCheckoutResponse["data"]) => {
    try {
      const updated = [saleData, ...recentSales.filter(s => s.order?.orderNumber !== saleData.order?.orderNumber)].slice(0, 15);
      setRecentSales(updated);
      localStorage.setItem("pos_recent_sales", JSON.stringify(updated));
    } catch {
      // LocalStorage fallback
    }
  };

  // Add Item to Cart helper
  const addItemToCart = (
    product: any,
    variation?: any,
    qty = 1
  ) => {
    if (!businessConfigReady) {
      showAlert("Configure valid business billing settings before adding POS items.", "error");
      return;
    }
    // 1. Ownership check: POS Terminal only sells Platform Inventory
    const isPlatform =
      product.ownerType === "PLATFORM" ||
      product.isPlatform === true ||
      !product.seller ||
      product.seller?.isPlatform ||
      product.seller?.email === "admin-store@olovely.com" ||
      product.seller?.storeName === "Olovely Admin Store";

    if (!isPlatform) {
      const vendorName = product.ownerLabel || product.seller?.storeName || product.seller?.sellerName || "Vendor";
      showAlert(`Cannot sell vendor item via Admin POS terminal (${vendorName}). POS counter checkout is restricted to platform inventory.`, "error");
      return;
    }

    // Auto-resolve variation if not explicitly passed as second argument
    const resolvedVariation =
      variation ||
      product.variation ||
      (product.variationId
        ? {
            _id: product.variationId,
            variationId: product.variationId,
            title: product.variationTitle,
            name: product.variationName || "Variant",
            value: product.variationTitle || "Default",
            price: product.price,
            stock: product.stock,
            sku: product.sku,
            barcode: product.barcode,
          }
        : undefined);

    const hasVariations =
      Boolean(product.hasVariations) ||
      (Array.isArray(product.variations) && product.variations.length > 0) ||
      Boolean(resolvedVariation);

    // If product contains variations and no specific variation is targeted, require explicit selection
    if (hasVariations && !resolvedVariation) {
      setPendingVariantProduct(product);
      sounds.beep();
      return;
    }

    const targetVariationId = resolvedVariation?._id
      ? String(resolvedVariation._id)
      : resolvedVariation?.variationId
      ? String(resolvedVariation.variationId)
      : undefined;

    const variationTitle =
      resolvedVariation?.title ||
      resolvedVariation?.variationTitle ||
      (resolvedVariation ? [resolvedVariation.name, resolvedVariation.value].filter(Boolean).join(": ") : undefined);

    const availableStock = resolvedVariation ? (resolvedVariation.stock ?? 0) : (product.stock ?? 0);
    if (availableStock <= 0) {
      showAlert(`"${product.productName}${variationTitle ? ` (${variationTitle})` : ""}" is Out of Stock (Stock: 0). Cannot add to cart.`, "error");
      return;
    }

    const productId = product.productId || product._id;
    const cartItemId = targetVariationId ? `${productId}_${targetVariationId}` : productId;
    const unitPrice = resolvedVariation?.price ?? product.price ?? 0;
    const rawTax = product.taxRate ?? product.tax;
    const parsedTaxRate = typeof rawTax === "number"
      ? rawTax
      : typeof rawTax === "object" && rawTax
        ? Number(rawTax.percentage || 0)
        : Number(String(rawTax || "").match(/(\d+(?:\.\d+)?)\s*%?$/)?.[1] || 0);
    const taxRate = businessSettings?.gstEnabled
      ? (parsedTaxRate || Number(businessSettings.gstRate) || 0)
      : 0;

    const sku = resolvedVariation?.sku || product.sku;
    const barcode = resolvedVariation?.barcode || product.barcode;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + qty;
        if (newQty > availableStock) {
          showAlert(`Maximum available stock reached for "${product.productName}". Available: ${availableStock}`, "error");
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
        };
        sounds.beep();
        return updated;
      } else {
        if (qty > availableStock) {
          showAlert(`Requested ${qty} exceeds available stock of ${availableStock}`, "error");
          return prev;
        }
        sounds.beep();
        return [
          ...prev,
          {
            cartItemId,
            productId,
            productName: product.productName,
            mainImage: product.mainImage,
            sku,
            barcode,
            variationId: targetVariationId,
            variationName: variationTitle,
            variationTitle,
            unitPrice,
            stock: availableStock,
            quantity: qty,
            taxRate,
            hsnCode: product.hsnCode,
            ownerType: "PLATFORM",
            ownerLabel: "Platform Store",
            isPlatform: true,
          },
        ];
      }
    });

    // Reset scanner input and refocus
    setSearchInput("");
    setSearchResults([]);
    barcodeInputRef.current?.focus();
  };

  // Barcode / Hardware Scanner Submission
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessConfigReady) {
      showAlert("Configure valid business billing settings before adding POS items.", "error");
      return;
    }
    const query = searchInput.trim();
    if (!query) return;

    setSearching(true);
    try {
      // 1. Try authoritative barcode lookup first
      const barcodeResult = await lookupBarcode(query);
      if (barcodeResult && barcodeResult.product) {
        const prod = barcodeResult.product;
        // If product matched variation directly
        if (barcodeResult.selectedVariation) {
          addItemToCart(prod, barcodeResult.selectedVariation, 1);
        } else if (prod.hasVariations || (prod.variations && prod.variations.length > 0)) {
          // Has variations, prompt cashier to select
          setPendingVariantProduct(prod);
          sounds.beep();
        } else {
          // Simple product
          addItemToCart(prod, undefined, 1);
        }
        setSearching(false);
        return;
      }
    } catch (error: any) {
      if ([403, 409].includes(error?.response?.status)) {
        showAlert(error?.response?.data?.message || "This product is not available for POS billing.", "error");
        setSearching(false);
        return;
      }
      // Not a direct barcode match; fallback to search by name/SKU
    }

    // 2. Fallback to read-only, variant-aware platform catalogue search.
    try {
      const products = await searchPosProducts(query);
      setSearchResults(products);
      if (products.length === 0) {
        showAlert(`No product found matching barcode / query: "${query}"`, "error");
      }
    } catch (err: any) {
      showAlert(err?.response?.data?.message || "Search failed", "error");
    } finally {
      setSearching(false);
      barcodeInputRef.current?.select();
    }
  };

  // Cart item modifications
  const updateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.cartItemId === cartItemId) {
          if (newQty > item.stock) {
            showAlert(`Only ${item.stock} units available in stock`, "error");
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("Clear all items from current cart?")) {
      setCart([]);
      setBillDiscount(0);
      setOrderNotes("");
      setTenderAmount("");
      barcodeInputRef.current?.focus();
    }
  };

  // --- GST & TOTAL CALCULATIONS ---
  const configuredBusinessState = getStateByName(businessSettings?.companyState);
  const businessConfigReady = Boolean(
    businessSettings?.businessName?.trim() &&
    configuredBusinessState &&
    configuredBusinessState[0] === normalizeStateCode(businessSettings?.stateCode) &&
    /^\d{6}$/.test(businessSettings?.companyPincode?.trim() || "") &&
    (!businessSettings?.gstEnabled || (businessSettings.gstin?.trim() && businessSettings.companyAddress?.trim() && /^\d{6}$/.test(businessSettings.companyPincode?.trim() || "")))
  );
  const gstInvoiceReady = Boolean(
    businessConfigReady &&
    businessSettings?.gstEnabled &&
    businessSettings.gstin?.trim()
  );

  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    let taxableAmount = 0;

    cart.forEach(item => {
      const lineGross = Number((item.unitPrice * item.quantity).toFixed(2));
      subtotal += lineGross;

      // Inclusive GST formula
      const rate = item.taxRate || 0;
      const tax = rate > 0
        ? Number(((lineGross * rate) / (100 + rate)).toFixed(2))
        : 0;
      const base = Number((lineGross - tax).toFixed(2));

      taxableAmount += base;
      totalTax += tax;
    });

    // Discount calculations
    let calculatedDiscount = 0;
    if (discountType === "percent") {
      calculatedDiscount = (subtotal * Math.min(100, Math.max(0, billDiscount))) / 100;
    } else {
      calculatedDiscount = Math.min(subtotal, Math.max(0, billDiscount));
    }

    const netPayable = Number(Math.max(0, subtotal - calculatedDiscount).toFixed(2));

    const effectiveCustomerState = customer.state || (customer.isWalkIn ? businessSettings?.companyState : "");
    const effectiveCustomerCode = customer.stateCode || getStateByName(effectiveCustomerState)?.[0];
    const canDetermineTax = Boolean(configuredBusinessState && effectiveCustomerState && effectiveCustomerCode);
    const isIntraState = canDetermineTax && areSameIndianState(
      { name: businessSettings?.companyState, code: businessSettings?.stateCode },
      { name: effectiveCustomerState, code: effectiveCustomerCode }
    );
    const cgst = businessSettings?.gstEnabled && isIntraState ? totalTax / 2 : 0;
    const sgst = businessSettings?.gstEnabled && isIntraState ? totalTax - cgst : 0;
    const igst = businessSettings?.gstEnabled && canDetermineTax && !isIntraState ? totalTax : 0;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      discount: Math.round(calculatedDiscount * 100) / 100,
      netPayable,
      taxModel: !businessSettings?.gstEnabled ? "NONE" : !canDetermineTax ? "UNKNOWN" : isIntraState ? "INTRA_STATE" : "INTER_STATE",
    };
  }, [cart, billDiscount, discountType, customer.state, customer.stateCode, customer.isWalkIn, businessSettings, configuredBusinessState]);

  // Cash change calculation
  const tenderedNum = parseFloat(tenderAmount) || 0;
  const changeToReturn = paymentMethod === "Cash" && tenderedNum >= calculations.netPayable ? tenderedNum - calculations.netPayable : 0;

  // Search registered customers
  const handleSearchCustomers = async (query: string) => {
    setCustomerSearchQuery(query);
    if (!query.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    setSearchingCustomers(true);
    try {
      const res = await getAllCustomers({ search: query.trim(), limit: 10 });
      setCustomerSearchResults(res.data || []);
    } catch {
      // Error fetching customers
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Checkout Execution
  const handleDirectCheckout = async () => {
    if (cart.length === 0) {
      showAlert("Cart is empty! Scan items to proceed.", "error");
      return;
    }

    if (!businessConfigReady) {
      showAlert("Business GST settings incomplete. Configure business name, state, matching state code, and GST address before checkout.", "error");
      return;
    }

    if (!customer.isWalkIn && (!customer.state || !customer.stateCode)) {
      showAlert("Select the customer's billing state before checkout.", "error");
      return;
    }

    if (paymentMethod === "Cash" && tenderAmount && tenderedNum < calculations.netPayable) {
      showAlert(`Tendered amount (₹${tenderedNum}) is less than net payable (₹${calculations.netPayable})`, "error");
      return;
    }

    setIsCheckingOut(true);
    try {
      const checkoutFingerprint = JSON.stringify({
        cart: cart.map(({ productId, variationId, quantity }) => ({ productId, variationId, quantity })),
        customer,
        paymentMethod,
        tenderAmount,
        discount: calculations.discount,
        notes: orderNotes.trim(),
      });
      if (!checkoutAttemptRef.current || checkoutAttemptRef.current.fingerprint !== checkoutFingerprint) {
        checkoutAttemptRef.current = {
          fingerprint: checkoutFingerprint,
          key: `POS-${crypto.randomUUID()}`,
        };
      }

      const payload = {
        items: cart.map(item => ({
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.quantity,
        })),
        customer: {
          customerId: customer.customerId,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          state: customer.state,
          stateCode: customer.stateCode,
          isWalkIn: customer.isWalkIn,
        },
        payment: {
          method: paymentMethod,
          amountPaid: paymentMethod === "Cash" && tenderedNum >= calculations.netPayable ? tenderedNum : calculations.netPayable,
          changeReturned: changeToReturn,
        },
        discount: calculations.discount,
        notes: orderNotes.trim() || undefined,
        idempotencyKey: checkoutAttemptRef.current.key,
      };

      const res = await posCheckout(payload);
      if (res.success && res.data) {
        sounds.success();
        setLastCompletedSale(res.data);
        saveRecentSale(res.data);
        if (!res.data.business.gstInvoiceReady) setReceiptFormat("thermal");
        setShowReceiptModal(true);

        // Reset cart for next customer
        setCart([]);
        setBillDiscount(0);
        setOrderNotes("");
        setTenderAmount("");
        setCustomer(DEFAULT_CUSTOMER);
        checkoutAttemptRef.current = null;
        showAlert(`Sale Completed! Order #${res.data.order?.orderNumber}`, "success");
      } else {
        throw new Error(res.message || "Failed to process POS checkout");
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || "POS checkout failed";
      showAlert(errMsg, "error");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Print helper for Thermal / A4 receipt
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* Top POS Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-4 shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-white shadow-lg text-lg">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white uppercase">POS Counter Terminal</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {businessSettings?.businessName || "Business settings not configured"}
              {businessSettings?.gstin ? ` • GSTIN: ${businessSettings.gstin}` : " • GSTIN not configured"}
              {businessSettings?.companyState ? ` • ${businessSettings.companyState} (${businessSettings.stateCode || "state code missing"})` : " • State not configured"}
            </p>
          </div>
        </div>

        {/* Shortcuts & Status Toolbar */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
              soundEnabled ? "border-slate-700 bg-slate-800 text-emerald-400" : "border-slate-800 bg-slate-900 text-slate-500"
            }`}
            title="Toggle scanner audio feedback"
          >
            <span>{soundEnabled ? "🔊 Beep ON" : "🔇 Muted"}</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-slate-400 text-[11px] bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <span>Shortcuts:</span>
            <kbd className="px-1.5 py-0.5 bg-slate-700 text-slate-200 rounded text-[10px] font-mono">[F2] Scan</kbd>
            <kbd className="px-1.5 py-0.5 bg-slate-700 text-slate-200 rounded text-[10px] font-mono">[F4] Customer</kbd>
            <kbd className="px-1.5 py-0.5 bg-slate-700 text-slate-200 rounded text-[10px] font-mono">[F8] Pay</kbd>
            <kbd className="px-1.5 py-0.5 bg-slate-700 text-slate-200 rounded text-[10px] font-mono">[F9] Receipt</kbd>
          </div>

          {lastCompletedSale && (
            <button
              onClick={() => setShowReceiptModal(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1 shadow-sm transition-all"
            >
              <span>🖨️ Last Slip</span>
            </button>
          )}

          <Link
            to="/admin/inventory-ledger"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
          >
            <span>📦 Inventory Ledger</span>
          </Link>
        </div>
      </header>

      {(!businessConfigReady || businessSettingsError) && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm font-semibold text-red-700">
          {businessSettingsError || "Business GST settings incomplete. POS checkout is disabled until business identity and state configuration are valid."}
          <Link to="/admin/product/taxes" className="ml-2 underline">Open Taxes & GST settings</Link>
        </div>
      )}

      {/* Alert Notification Toast */}
      {alertBanner && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border text-sm max-w-md animate-bounce ${
            alertBanner.type === "error"
              ? "bg-red-50 text-red-900 border-red-200"
              : alertBanner.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-blue-50 text-blue-900 border-blue-200"
          }`}
        >
          <span className="text-xl">
            {alertBanner.type === "error" ? "⚠️" : alertBanner.type === "success" ? "✅" : "ℹ️"}
          </span>
          <div className="flex-1 font-medium">{alertBanner.message}</div>
          <button onClick={() => setAlertBanner(null)} className="text-gray-400 hover:text-gray-600 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 max-w-[1920px] mx-auto w-full">
        {/* LEFT COLUMN: SCANNER + CART ITEMS (Cols 1-7 or 8) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Top Barcode Input & Search Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
            <form onSubmit={handleBarcodeSubmit} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  📟
                </span>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={searchInput}
                  onChange={e => {
                    setSearchInput(e.target.value);
                  }}
                  placeholder="Scan barcode or search product..."
                  className="w-full pl-11 pr-24 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-600 font-semibold">
                    AUTO [Enter]
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={searching}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-all shadow-md flex items-center gap-2 min-w-[110px] justify-center"
              >
                {searching ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>Add Item</span>
                  </>
                )}
              </button>
            </form>

            {/* Dropdown for multiple search results */}
            {searchResults.length > 0 && (
              <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-60 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-500 px-3 py-1 uppercase">
                  Select product from search results:
                </p>
                {searchResults.map(prod => {
                  const variation = prod.variation || (prod.variationId ? {
                    _id: prod.variationId,
                    variationId: prod.variationId,
                    title: prod.variationTitle,
                    name: "Variant",
                    value: prod.variationTitle || "Default",
                    price: prod.price ?? 0,
                    stock: prod.stock ?? 0,
                    sku: prod.sku,
                    barcode: prod.barcode,
                  } : undefined);
                  const stock = variation ? (variation.stock ?? 0) : (prod.stock || 0);
                  const price = variation ? (variation.price ?? 0) : (prod.price || 0);
                  const sku = variation?.sku || prod.sku;
                  const barcode = variation?.barcode || prod.barcode;
                  const variantLabel = prod.variationTitle || variation?.title || (variation as any)?.value;
                  return <div
                    key={`${prod.productId || prod._id}:${variation?._id || prod.variationId || "simple"}`}
                    onClick={() => {
                      addItemToCart(prod, variation, 1);
                      setSearchResults([]);
                    }}
                    className="p-3 hover:bg-white rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {prod.mainImage && (
                        <img
                          src={resolveImageUrl(prod.mainImage)}
                          alt=""
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                        />
                      )}
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">
                          {prod.productName}{variantLabel && <span className="ml-1 text-indigo-700">— {variantLabel}</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          SKU: {sku || "N/A"} • Barcode: {barcode || "Not configured"} • Stock:{" "}
                          <strong className={stock > 0 ? "text-slate-800" : "text-rose-600"}>{stock}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">₹{price}</div>
                      <span className={`text-[11px] font-medium ${stock > 0 ? "text-indigo-600" : "text-rose-600"}`}>
                        {stock > 0 ? "+ Click to Add" : "Out of Stock"}
                      </span>
                    </div>
                  </div>;
                })}
              </div>
            )}
          </div>

          {/* Cart Table Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 flex-1 flex flex-col overflow-hidden min-h-[420px]">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-slate-900 text-base">Current Bill Items</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} Units ({cart.length} lines)
                </span>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>🗑️ Clear Cart</span>
                </button>
              )}
            </div>

            {/* Cart Item Rows */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl mb-3 shadow-inner">
                    🛒
                  </div>
                  <p className="font-bold text-slate-700 text-lg">Cart is Empty</p>
                  <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
                    Scan any product barcode with your barcode gun or enter SKU / name above to ring up items.
                  </p>
                </div>
              ) : (
                cart.map((item, index) => {
                  const lineTotal = Number((item.unitPrice * item.quantity).toFixed(2));
                  return (
                    <div
                      key={item.cartItemId}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 rounded-xl px-2 transition-colors"
                    >
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-center gap-3 min-w-[220px] flex-1">
                        <span className="text-xs font-mono text-slate-400 w-5 text-right">{index + 1}.</span>
                        {item.mainImage ? (
                          <img
                            src={resolveImageUrl(item.mainImage)}
                            alt=""
                            className="w-12 h-12 object-cover rounded-xl border border-slate-200 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
                            📦
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-1">
                            {item.productName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                            {(item.variationTitle || item.variationName) && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-800 font-semibold text-[11px]">
                                {item.variationTitle || item.variationName}
                              </span>
                            )}
                            {item.sku && <span>SKU: {item.sku}</span>}
                            {item.barcode && <span>Barcode: {item.barcode}</span>}
                            <span className="text-slate-400">•</span>
                            <span className="text-emerald-700 font-medium">In Stock: {item.stock}</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Unit Price & Tax */}
                      <div className="text-right min-w-[100px]">
                        <div className="text-xs text-slate-400 font-medium">Rate</div>
                        <div className="font-bold text-slate-800 text-sm">₹{item.unitPrice}</div>
                        {item.taxRate > 0 && (
                          <div className="text-[10px] text-slate-400">incl. {item.taxRate}% GST</div>
                        )}
                      </div>

                      {/* Middle: Quantity Controller */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center shadow-xs transition-colors"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 1;
                            updateQuantity(item.cartItemId, val);
                          }}
                          className="w-12 text-center bg-transparent font-bold text-slate-900 text-sm focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center shadow-xs transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Right: Line Total & Delete */}
                      <div className="text-right min-w-[110px] flex items-center justify-end gap-3">
                        <div>
                          <div className="text-xs text-slate-400 font-medium">Line Total</div>
                          <div className="text-base font-extrabold text-slate-900">₹{lineTotal.toFixed(2)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CHECKOUT & PAYMENT PANEL (Cols 8-12) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Customer Selection Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <span className="font-bold text-slate-800 text-sm">Customer Details</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
              >
                {customer.isWalkIn ? "+ Add Customer" : "Change Customer"}
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 text-sm">{customer.name}</p>
                <p className="text-xs text-slate-500">
                  {customer.isWalkIn ? "Walk-in Counter Sale" : `📞 ${customer.phone}`}
                </p>
                <p className="text-[10px] text-slate-400">
                  Billing state: {customer.state || (customer.isWalkIn ? `${businessSettings?.companyState || "store state not configured"} (walk-in place of supply)` : "not selected")}
                </p>
              </div>
              {!customer.isWalkIn && (
                <button
                  type="button"
                  onClick={() => setCustomer(DEFAULT_CUSTOMER)}
                  className="text-xs text-slate-400 hover:text-rose-600"
                  title="Reset to Walk-in"
                >
                  ✕ Walk-in
                </button>
              )}
            </div>
          </div>

          {/* Calculations & GST Breakdown Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">Bill Summary</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Inclusive of GST)</span>
                <span className="font-semibold text-slate-800">₹{calculations.subtotal.toFixed(2)}</span>
              </div>

              {/* Bill Discount Input */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <span className="text-xs text-slate-600 font-medium">Bill Discount</span>
                <div className="flex items-center gap-1">
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as any)}
                    className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none"
                  >
                    <option value="fixed">₹</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={billDiscount || ""}
                    onChange={e => setBillDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-16 border border-slate-300 rounded px-2 py-1 text-right text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {calculations.discount > 0 && (
                <div className="flex justify-between text-emerald-600 text-xs font-medium">
                  <span>Discount Applied</span>
                  <span>- ₹{calculations.discount.toFixed(2)}</span>
                </div>
              )}

              {/* Tax Details Accordion / Sub-block */}
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Taxable Value</span>
                  <span>₹{calculations.taxableAmount.toFixed(2)}</span>
                </div>
                {calculations.taxModel === "INTER_STATE" ? (
                  <div className="flex justify-between text-slate-500">
                    <span>IGST</span>
                    <span>₹{calculations.igst.toFixed(2)}</span>
                  </div>
                ) : calculations.taxModel === "INTRA_STATE" ? (
                  <>
                    <div className="flex justify-between text-slate-500">
                      <span>CGST (Intra-state)</span>
                      <span>₹{calculations.cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>SGST (Intra-state)</span>
                      <span>₹{calculations.sgst.toFixed(2)}</span>
                    </div>
                  </>
                ) : calculations.taxModel === "UNKNOWN" ? (
                  <div className="text-amber-700 font-semibold">Select a valid billing state to calculate GST.</div>
                ) : (
                  <div className="text-slate-500">GST billing is disabled.</div>
                )}
                <div className="flex justify-between font-semibold text-slate-700 pt-1 border-t border-slate-200">
                  <span>Total Tax Included</span>
                  <span>₹{calculations.totalTax.toFixed(2)}</span>
                </div>
              </div>

              {/* Net Grand Total */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-xl shadow-inner flex items-center justify-between mt-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-indigo-300 font-bold">
                    Net Payable
                  </div>
                  <div className="text-xs text-slate-400">Tax & Discounts Included</div>
                </div>
                <div className="text-3xl font-black text-white tracking-tight">
                  ₹{calculations.netPayable.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method & Checkout Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Payment Method</h3>

            {/* Payment Mode Selector Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {(["Cash", "UPI", "Card", "Wallet"] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMethod(mode)}
                  className={`py-2.5 px-1 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-1 ${
                    paymentMethod === mode
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-base">
                    {mode === "Cash" ? "💵" : mode === "UPI" ? "📱" : mode === "Card" ? "💳" : "👛"}
                  </span>
                  <span>{mode}</span>
                </button>
              ))}
            </div>

            {/* Cash Tender Calculation */}
            {paymentMethod === "Cash" && (
              <div className="bg-amber-50/60 border border-amber-200/80 p-3 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-900">Cash Tendered</span>
                  <div className="flex gap-1">
                    {[
                      calculations.netPayable,
                      Math.ceil(calculations.netPayable / 100) * 100,
                      500,
                      2000,
                    ]
                      .filter((val, idx, arr) => val > 0 && arr.indexOf(val) === idx)
                      .slice(0, 3)
                      .map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTenderAmount(val.toString())}
                          className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-700">₹</span>
                  <input
                    type="number"
                    min={calculations.netPayable}
                    value={tenderAmount}
                    onChange={e => setTenderAmount(e.target.value)}
                    placeholder={calculations.netPayable.toString()}
                    className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {tenderedNum >= calculations.netPayable && (
                  <div className="flex items-center justify-between bg-emerald-100/80 px-3 py-2 rounded-lg text-emerald-900">
                    <span className="text-xs font-bold uppercase">Change to Return:</span>
                    <span className="text-base font-extrabold text-emerald-800">
                      ₹{changeToReturn.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* UPI QR Hint */}
            {paymentMethod === "UPI" && (
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-center space-y-1">
                <p className="text-xs font-semibold text-indigo-900">Scan QR to Pay via PhonePe / GPay / Paytm</p>
                <div className="w-24 h-24 mx-auto bg-white p-2 rounded-lg border border-indigo-200 shadow-xs flex items-center justify-center text-4xl">
                  📱
                </div>
                <p className="text-[11px] text-indigo-700">Confirm payment in the configured UPI application before completing the sale.</p>
              </div>
            )}

            {/* Optional Notes */}
            <input
              type="text"
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              placeholder="Order / POS cashier notes (optional)..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
            />

            {/* BIG ACTION: COMPLETE SALE BUTTON */}
            <button
              type="button"
              onClick={handleDirectCheckout}
              disabled={isCheckingOut || cart.length === 0 || !businessConfigReady || calculations.taxModel === "UNKNOWN"}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-base tracking-wide shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCheckingOut ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Processing Sale...</span>
                </>
              ) : (
                <>
                  <span>CHARGE ₹{calculations.netPayable.toLocaleString()}</span>
                  <span className="text-emerald-200 text-xs font-normal">[F8]</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL 1: VARIATION SELECTOR --- */}
      {pendingVariantProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Variation</h3>
                <p className="text-xs text-slate-500">{pendingVariantProduct.productName}</p>
              </div>
              <button
                onClick={() => setPendingVariantProduct(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {pendingVariantProduct.variations?.map((v: any) => {
                const stock = v.stock ?? 0;
                const isOutOfStock = stock <= 0;
                return (
                  <div
                    key={v._id || `${v.name}_${v.value}`}
                    onClick={() => {
                      if (!isOutOfStock) {
                        addItemToCart(pendingVariantProduct, v, 1);
                        setPendingVariantProduct(null);
                      }
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isOutOfStock
                        ? "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
                        : "hover:border-indigo-600 hover:bg-indigo-50/50 cursor-pointer border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-sm">
                        {v.title || [v.name, v.value].filter(Boolean).join(": ") || "Variant"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {(v.sku || pendingVariantProduct.sku) && <span>SKU: {v.sku || pendingVariantProduct.sku} • </span>}
                        {(v.barcode || pendingVariantProduct.barcode) && <span>Barcode: {v.barcode || pendingVariantProduct.barcode} • </span>}
                        <span className={stock > 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                          {stock > 0 ? `In Stock: ${stock}` : "Out of Stock"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">
                        ₹{v.price ?? pendingVariantProduct.price}
                      </div>
                      {!isOutOfStock && (
                        <span className="text-xs text-indigo-600 font-semibold">+ Select</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CUSTOMER SELECTOR / SEARCH --- */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Select or Register Customer</h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Walk-in Button */}
            <button
              type="button"
              onClick={() => {
                setCustomer(DEFAULT_CUSTOMER);
                setShowCustomerModal(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span>🚶 Reset to Default Walk-in Customer</span>
            </button>

            {/* Search Input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Search Registered Customer (Phone or Name)
              </label>
              <input
                type="text"
                value={customerSearchQuery}
                onChange={e => handleSearchCustomers(e.target.value)}
                placeholder="Type customer phone or name..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>

            {searchingCustomers && (
              <p className="text-xs text-slate-400 text-center py-2">Searching customers...</p>
            )}

            {customerSearchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border rounded-xl">
                {customerSearchResults.map(c => (
                  <div
                    key={c._id}
                    onClick={() => {
                      setCustomer({
                        customerId: c._id,
                        name: c.name || c.phone,
                        phone: c.phone,
                        email: c.email,
                        state: c.state || undefined,
                        stateCode: getStateByName(c.state)?.[0],
                        isWalkIn: false,
                      });
                      setShowCustomerModal(false);
                    }}
                    className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800">
                        {c.name || "Customer"}
                      </div>
                      <div className="text-slate-500">📞 {c.phone}</div>
                    </div>
                    <span className="text-indigo-600 font-semibold">+ Select</span>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Quick Entry Form */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-2">Or Enter Manual Customer Details:</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Full Name"
                  defaultValue={customer.isWalkIn ? "" : customer.name}
                  id="manual-customer-name"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  defaultValue={customer.isWalkIn ? "" : customer.phone}
                  id="manual-customer-phone"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
                />
                <select
                  id="manual-customer-state"
                  defaultValue={customer.isWalkIn ? "" : customer.state || ""}
                  className="col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white"
                >
                  <option value="">Select billing state</option>
                  {INDIAN_STATES.map(([code, name]) => (
                    <option key={code} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nameInput = (document.getElementById("manual-customer-name") as HTMLInputElement)?.value;
                  const phoneInput = (document.getElementById("manual-customer-phone") as HTMLInputElement)?.value;
                  const stateInput = (document.getElementById("manual-customer-state") as HTMLSelectElement)?.value;
                  if (!nameInput && !phoneInput) {
                    showAlert("Please enter customer name or phone", "error");
                    return;
                  }
                  if (!stateInput) {
                    showAlert("Please select the customer's billing state", "error");
                    return;
                  }
                  setCustomer({
                    name: nameInput || "Customer",
                    phone: phoneInput || "0000000000",
                    state: stateInput,
                    stateCode: getStateByName(stateInput)?.[0],
                    isWalkIn: false,
                  });
                  setShowCustomerModal(false);
                }}
                className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Apply Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: THERMAL BILL & GST INVOICE RECEIPT MODAL --- */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            {/* Modal Controls Bar */}
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Sale Receipt Ready</h3>
                  <p className="text-xs text-slate-500">Order #{lastCompletedSale.order?.orderNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs">
                  <button
                    type="button"
                    onClick={() => setReceiptFormat("thermal")}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      receiptFormat === "thermal" ? "bg-white shadow-xs text-indigo-700" : "text-slate-600"
                    }`}
                  >
                    Thermal (80mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (lastCompletedSale.business.gstInvoiceReady) setReceiptFormat("a4");
                    }}
                    disabled={!lastCompletedSale.business.gstInvoiceReady}
                    title={!lastCompletedSale.business.gstInvoiceReady ? "Business GST settings incomplete" : undefined}
                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                      receiptFormat === "a4" ? "bg-white shadow-xs text-indigo-700" : "text-slate-600"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    A4 GST Invoice
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* PRINTABLE AREA */}
            <div
              id="printable-pos-receipt"
              data-format={receiptFormat}
              className={
                receiptFormat === "thermal"
                  ? "bg-white p-4 font-mono text-xs text-slate-900 border border-dashed border-slate-300 rounded-xl mx-auto max-w-[340px]"
                  : "bg-white p-6 font-sans text-xs text-slate-900 border border-slate-200 rounded-xl"
              }
            >
              {receiptFormat === "thermal" ? (
                /* --- 80MM THERMAL RECEIPT VIEW --- */
                <div className="space-y-3 leading-tight">
                  <div className="text-center space-y-1">
                    <p className="font-extrabold text-base tracking-wider uppercase">
                      {lastCompletedSale.business.businessName}
                    </p>
                    {lastCompletedSale.business.businessAddress && (
                      <p className="text-[11px] text-slate-600">{lastCompletedSale.business.businessAddress}</p>
                    )}
                    <p className="text-[11px] text-slate-600">
                      {lastCompletedSale.business.companyState} ({lastCompletedSale.business.stateCode})
                    </p>
                    {lastCompletedSale.business.gstin ? (
                      <p className="text-[11px] text-slate-600">GSTIN: <strong>{lastCompletedSale.business.gstin}</strong></p>
                    ) : (
                      <p className="text-[11px] font-semibold text-amber-700">GSTIN not configured — non-GST receipt</p>
                    )}
                    {lastCompletedSale.business.contactPhone && (
                      <p className="text-[11px] text-slate-600">Tel: {lastCompletedSale.business.contactPhone}</p>
                    )}
                  </div>

                  <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-0.5 text-[11px]">
                    <div className="flex justify-between">
                      <span>Invoice #:</span>
                      <span className="font-bold">{lastCompletedSale.order?.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date/Time:</span>
                      <span>{new Date(lastCompletedSale.order?.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer:</span>
                      <span className="font-semibold">{lastCompletedSale.customer?.name}</span>
                    </div>
                    {lastCompletedSale.customer?.phone && (
                      <div className="flex justify-between">
                        <span>Phone:</span>
                        <span>{lastCompletedSale.customer.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Items list */}
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-dashed border-slate-400">
                        <th className="py-1">Item</th>
                        <th className="text-center py-1">Qty</th>
                        <th className="text-right py-1">Price</th>
                        <th className="text-right py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dotted divide-slate-200">
                      <PosInvoiceItemRows items={lastCompletedSale.items || []} format="thermal" />
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="border-t border-dashed border-slate-400 pt-2 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span>Subtotal (Gross):</span>
                      <span>₹{lastCompletedSale.taxSummary?.subtotal?.toFixed(2)}</span>
                    </div>
                    {lastCompletedSale.taxSummary?.discount > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>Discount:</span>
                        <span>- ₹{lastCompletedSale.taxSummary.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable Value:</span>
                      <span>₹{lastCompletedSale.taxSummary?.taxableAmount?.toFixed(2)}</span>
                    </div>
                    <div className="text-slate-600"><PosInvoiceTaxLines summary={lastCompletedSale.taxSummary} /></div>
                    <div className="border-t border-b border-slate-800 py-1.5 flex justify-between font-black text-sm">
                      <span>NET AMOUNT:</span>
                      <span>₹{lastCompletedSale.taxSummary?.grandTotal?.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-0.5 text-[11px] pt-1">
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <span className="font-bold uppercase">{lastCompletedSale.paymentSummary?.method}</span>
                    </div>
                    {lastCompletedSale.paymentSummary?.method === "Cash" && (
                      <>
                        <div className="flex justify-between">
                          <span>Amount Tendered:</span>
                          <span>₹{lastCompletedSale.paymentSummary.amountPaid?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>Change Returned:</span>
                          <span>₹{lastCompletedSale.paymentSummary.changeReturned?.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer & Barcode simulation */}
                  <div className="text-center pt-3 border-t border-dashed border-slate-400 space-y-1">
                    <p className="font-mono tracking-widest text-xs">||| | | |||| || | || |||||</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {lastCompletedSale.order?.orderNumber}
                    </p>
                    <p className="text-[10px] text-slate-600 pt-1">
                      *** Thank You for Shopping with Us! ***
                    </p>
                    <p className="text-[9px] text-slate-400">
                      Goods once sold cannot be returned without original cash memo.
                    </p>
                  </div>
                </div>
              ) : (
                /* --- A4 FULL GST TAX INVOICE VIEW --- */
                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 uppercase">GST TAX INVOICE</h2>
                      <p className="font-bold text-slate-800 text-sm">
                        {lastCompletedSale.business.businessName}
                      </p>
                      <p className="text-slate-500 text-xs">{lastCompletedSale.business.businessAddress}</p>
                      <p className="text-slate-500 text-xs">{lastCompletedSale.business.companyState} ({lastCompletedSale.business.stateCode})</p>
                      <p className="text-slate-500 text-xs">GSTIN: <strong>{lastCompletedSale.business.gstin}</strong></p>
                    </div>
                    <div className="text-right text-xs">
                      <p>
                        Invoice #: <strong className="text-slate-900">{lastCompletedSale.order?.invoiceNumber}</strong>
                      </p>
                      <p>
                        Order #: <strong className="text-slate-900">{lastCompletedSale.order?.orderNumber}</strong>
                      </p>
                      <p>Date: {new Date(lastCompletedSale.order?.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg">
                    <div>
                      <p className="font-bold text-slate-700 uppercase text-[10px]">Billed To:</p>
                      <p className="font-bold text-slate-900">{lastCompletedSale.customer?.name}</p>
                      <p className="text-slate-600">Phone: {lastCompletedSale.customer?.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-700 uppercase text-[10px]">Payment Information:</p>
                      <p className="font-bold text-slate-900 uppercase">{lastCompletedSale.paymentSummary?.method}</p>
                      <p className="text-slate-600">Status: PAID</p>
                    </div>
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border border-slate-200">
                        <th className="p-2">#</th>
                        <th className="p-2">Description</th>
                        <th className="p-2">HSN</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Rate</th>
                        <th className="p-2 text-right">Tax %</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border border-slate-200">
                      <PosInvoiceItemRows items={lastCompletedSale.items || []} format="a4" />
                    </tbody>
                  </table>

                  <div className="flex justify-end pt-2">
                    <div className="w-64 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span>Taxable Value:</span>
                        <span>₹{lastCompletedSale.taxSummary?.taxableAmount?.toFixed(2)}</span>
                      </div>
                      <PosInvoiceTaxLines summary={lastCompletedSale.taxSummary} />
                      {lastCompletedSale.taxSummary?.discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>Discount:</span>
                          <span>- ₹{lastCompletedSale.taxSummary.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-sm pt-2 border-t border-slate-300">
                        <span>Grand Total:</span>
                        <span>₹{lastCompletedSale.taxSummary?.grandTotal?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t print:hidden">
              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  barcodeInputRef.current?.focus();
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                + Start Next Sale (Esc)
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <span>🖨️ Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print CSS Injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-pos-receipt, #printable-pos-receipt * {
            visibility: visible;
          }
          #printable-pos-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 4mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          #printable-pos-receipt[data-format="thermal"] {
            max-width: 80mm !important;
          }
          #printable-pos-receipt[data-format="a4"] {
            width: 190mm !important;
            max-width: 190mm !important;
            padding: 10mm !important;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>
    </div>
  );
}
