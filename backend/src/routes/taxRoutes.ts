import { Router } from 'express';
import { getActiveTaxes, getAllTaxes, createTax, updateTaxStatus } from '../modules/seller/controllers/taxController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Publicly available within the app for calculation if needed, 
// but usually requires auth
router.use(authenticate);

// Get active taxes for selection
router.get('/active', getActiveTaxes);

// Get all taxes for management
router.get('/', getAllTaxes);

// Create tax (Admin should ideally do this, but seller management has a page for it in this app it seems)
router.post('/', createTax);

// Update tax status
router.patch('/:id/status', updateTaxStatus);

export default router;
