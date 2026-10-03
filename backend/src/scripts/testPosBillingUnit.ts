import assert from 'node:assert/strict';
import { splitPosGst, toPosInvoiceItem, validatePosBusinessSettings } from '../utils/posBilling';
import { validateStateIdentity } from '../utils/indianStates';

const businessState = validateStateIdentity('  Madhya   Pradesh ', '23');
const sameState = validateStateIdentity('madhya pradesh', 23);
const otherState = validateStateIdentity('Maharashtra', '27');

assert.equal(businessState.valid, true, 'business state and code should normalize');
assert.equal(sameState.valid, true, 'customer state should normalize');
assert.equal(otherState.valid, true, 'inter-state customer should normalize');

const intra = splitPosGst(18, true, businessState, sameState);
assert.deepEqual(intra, { taxModel: 'INTRA_STATE', cgst: 9, sgst: 9, igst: 0 });

const inter = splitPosGst(18, true, businessState, otherState);
assert.deepEqual(inter, { taxModel: 'INTER_STATE', cgst: 0, sgst: 0, igst: 18 });

const noGst = splitPosGst(18, false, businessState, otherState);
assert.deepEqual(noGst, { taxModel: 'NONE', cgst: 0, sgst: 0, igst: 0 });

const invalidBusiness = validatePosBusinessSettings({
  gstEnabled: true,
  businessName: 'Olovely Total Suvidha',
  companyState: 'Madhya Pradesh',
  stateCode: '23',
  companyPincode: '452001',
});
assert.equal(invalidBusiness.valid, false, 'GST billing must reject a missing registered address');
assert.equal(invalidBusiness.gstInvoiceReady, false, 'missing settings must not produce a GST invoice');

const nonGstBusiness = validatePosBusinessSettings({
  gstEnabled: false,
  businessName: 'Olovely Total Suvidha',
  companyState: 'Madhya Pradesh',
  stateCode: '23',
  companyPincode: '452001',
});
assert.equal(nonGstBusiness.valid, true, 'non-GST receipts may omit GSTIN and registered GST address');
assert.equal(nonGstBusiness.gstInvoiceReady, false, 'non-GST billing must not enable GST invoices');

const gstBusinessWithoutGstin = validatePosBusinessSettings({
  gstEnabled: true,
  businessName: 'Olovely Total Suvidha',
  companyAddress: 'Configured business address',
  companyState: 'Madhya Pradesh',
  stateCode: '23',
  companyPincode: '452001',
});
assert.equal(gstBusinessWithoutGstin.valid, false, 'GST billing must be rejected without GSTIN');
assert.equal(gstBusinessWithoutGstin.gstInvoiceReady, false, 'GST invoice must remain disabled without a configured GSTIN');

const validBusiness = validatePosBusinessSettings({
  gstEnabled: true,
  businessName: 'Olovely Total Suvidha',
  companyAddress: 'Configured business address',
  companyState: 'Madhya Pradesh',
  stateCode: '23',
  companyPincode: '452001',
  gstin: '23AAAAA0000A1Z5',
});
assert.equal(validBusiness.valid, true);
assert.equal(validBusiness.gstInvoiceReady, true);

const invoiceItem = toPosInvoiceItem({
  _id: { toString: () => 'order-item-1' },
  productName: 'Cadbury Milk',
  variantTitle: 'Pack: 100g',
  sku: 'CAD-100',
  hsnCode: '1806',
  quantity: 2,
  unitPrice: 175,
  total: 350,
  taxRate: 18,
  taxAmount: 53.39,
});
assert.deepEqual(invoiceItem, {
  id: 'order-item-1',
  productName: 'Cadbury Milk',
  variantTitle: 'Pack: 100g',
  sku: 'CAD-100',
  hsnCode: '1806',
  quantity: 2,
  unitPrice: 175,
  total: 350,
  taxRate: 18,
  taxAmount: 53.39,
});

const missingHsnItem = toPosInvoiceItem({
  _id: { toString: () => 'order-item-2' },
  productName: 'Unclassified Product',
  quantity: 1,
  unitPrice: 10,
  total: 10,
  taxRate: 0,
  taxAmount: 0,
});
assert.equal(missingHsnItem.hsnCode, '', 'missing HSN must remain empty, never fabricated');

console.log('POS billing unit tests passed: state normalization, CGST/SGST, IGST, missing settings, invoice mapping, HSN.');
