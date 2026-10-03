export const INDIAN_STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'],
  ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'],
  ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'],
  ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
  ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['31', 'Lakshadweep'],
  ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'],
  ['35', 'Andaman and Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'],
  ['38', 'Ladakh'], ['97', 'Other Territory'],
] as const;

const normalizeName = (value?: string | null) =>
  (value || '').trim().toLowerCase().replace(/\s+/g, '');

export const normalizeStateCode = (value?: string | number | null) => {
  const digits = String(value ?? '').trim().replace(/\D/g, '');
  return digits ? digits.padStart(2, '0').slice(-2) : '';
};

export const getStateByName = (name?: string | null) =>
  INDIAN_STATES.find(([, stateName]) => normalizeName(stateName) === normalizeName(name));

export const getStateByCode = (code?: string | number | null) => {
  const normalized = normalizeStateCode(code);
  return INDIAN_STATES.find(([stateCode]) => stateCode === normalized);
};

export const areSameIndianState = (
  left: { name?: string | null; code?: string | number | null },
  right: { name?: string | null; code?: string | number | null }
) => {
  const leftCode = getStateByCode(left.code)?.[0] || getStateByName(left.name)?.[0];
  const rightCode = getStateByCode(right.code)?.[0] || getStateByName(right.name)?.[0];
  if (leftCode && rightCode) return leftCode === rightCode;
  return Boolean(normalizeName(left.name) && normalizeName(left.name) === normalizeName(right.name));
};

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
