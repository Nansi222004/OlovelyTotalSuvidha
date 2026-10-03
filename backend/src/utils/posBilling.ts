import { areSameIndianState, GSTIN_PATTERN, validateStateIdentity } from './indianStates';

export interface PosStateIdentity {
  name: string;
  code: string;
}

export function validatePosBusinessSettings(settings: any) {
  const businessName = String(settings?.businessName || '').trim();
  const businessAddress = String(settings?.companyAddress || '').trim();
  const companyPincode = String(settings?.companyPincode || '').trim();
  const gstin = String(settings?.gstin || '').trim().toUpperCase();
  const state = validateStateIdentity(settings?.companyState, settings?.stateCode);

  if (!businessName || !state.valid || !/^\d{6}$/.test(companyPincode)) {
    return {
      valid: false,
      error: 'Business GST settings incomplete. Configure business name, state, matching state code, and 6-digit pincode before using POS.',
      businessName,
      businessAddress,
      companyPincode,
      gstin,
      state,
      gstInvoiceReady: false,
    };
  }
  if (settings?.gstEnabled && (!businessAddress || !/^\d{6}$/.test(companyPincode) || !gstin)) {
    return {
      valid: false,
      error: 'Business GST settings incomplete. Configure GSTIN, registered business address, and 6-digit pincode before GST billing.',
      businessName,
      businessAddress,
      companyPincode,
      gstin,
      state,
      gstInvoiceReady: false,
    };
  }
  if (gstin && (!GSTIN_PATTERN.test(gstin) || gstin.slice(0, 2) !== state.code)) {
    return {
      valid: false,
      error: 'Business GST settings incomplete. GSTIN is invalid or does not match the configured state.',
      businessName,
      businessAddress,
      gstin,
      state,
      gstInvoiceReady: false,
    };
  }
  return {
    valid: true,
    businessName,
    businessAddress,
    companyPincode,
    gstin,
    state,
    gstInvoiceReady: Boolean(settings?.gstEnabled && gstin && businessAddress),
  };
}

export function splitPosGst(
  totalTax: number,
  gstEnabled: boolean,
  businessState: PosStateIdentity,
  customerState: PosStateIdentity
) {
  const roundedTax = Number(Number(totalTax || 0).toFixed(2));
  if (!gstEnabled) {
    return { taxModel: 'NONE' as const, cgst: 0, sgst: 0, igst: 0 };
  }
  if (areSameIndianState(businessState, customerState)) {
    const cgst = Number((roundedTax / 2).toFixed(2));
    return {
      taxModel: 'INTRA_STATE' as const,
      cgst,
      sgst: Number((roundedTax - cgst).toFixed(2)),
      igst: 0,
    };
  }
  return { taxModel: 'INTER_STATE' as const, cgst: 0, sgst: 0, igst: roundedTax };
}

export function toPosInvoiceItem(orderItem: any) {
  return {
    id: orderItem._id.toString(),
    productName: orderItem.productName,
    variantTitle: orderItem.variantTitle || '',
    sku: orderItem.sku || '',
    hsnCode: orderItem.hsnCode || '',
    quantity: orderItem.quantity,
    unitPrice: orderItem.unitPrice,
    total: orderItem.total,
    taxRate: orderItem.taxRate,
    taxAmount: orderItem.taxAmount,
  };
}
