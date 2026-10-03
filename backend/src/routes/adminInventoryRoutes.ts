import { Router } from 'express';
import { authenticate, requireUserType } from '../middleware/auth';
import {
  getInventoryTransactions,
  adjustStock,
  recordDamage,
  addStock,
  lookupProductByBarcode,
  searchPosProducts,
  getLowStockProducts,
  notifyVendorLowStock,
  posCheckout,
} from '../modules/admin/controllers/adminInventoryController';

const router = Router();

// All admin inventory routes require Admin authentication
router.use(authenticate, requireUserType('Admin'));

// Transaction ledger
router.get('/transactions', getInventoryTransactions);

// Low-stock dashboard
router.get('/low-stock', getLowStockProducts);

// POS barcode lookup and variant-aware manual search (platform inventory only)
router.get('/barcode/:barcode', lookupProductByBarcode);
router.get('/pos-search', searchPosProducts);

// Stock mutations
router.post('/adjust', adjustStock);
router.post('/damage', recordDamage);
router.post('/stock-in', addStock);

// Vendor low-stock notification
router.post('/notify-vendor', notifyVendorLowStock);

// POS counter sale checkout
router.post('/pos-checkout', posCheckout);

export default router;
