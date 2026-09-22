import { Router } from 'express';
import { authenticate, requireUserType } from '../middleware/auth';
import {
  getInventoryTransactions,
  adjustStock,
  recordDamage,
  addStock,
  lookupProductByBarcode,
  getLowStockProducts,
  notifyVendorLowStock,
} from '../modules/admin/controllers/adminInventoryController';

const router = Router();

// All admin inventory routes require Admin authentication
router.use(authenticate, requireUserType('Admin'));

// Transaction ledger
router.get('/transactions', getInventoryTransactions);

// Low-stock dashboard
router.get('/low-stock', getLowStockProducts);

// POS barcode lookup (admin sees full catalog)
router.get('/barcode/:barcode', lookupProductByBarcode);

// Stock mutations
router.post('/adjust', adjustStock);
router.post('/damage', recordDamage);
router.post('/stock-in', addStock);

// Vendor low-stock notification
router.post('/notify-vendor', notifyVendorLowStock);

export default router;
