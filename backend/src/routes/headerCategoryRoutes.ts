import { Router } from 'express';
import {
    getAdminHeaderCategories,
    getHeaderCategories,
    createHeaderCategory,
    updateHeaderCategory,
    deleteHeaderCategory,
} from '../modules/admin/controllers/headerCategoryController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

// Public route to get published categories
router.get('/', getHeaderCategories);

// Protected Admin routes
router.get('/admin', authenticate, requireUserType('Admin'), getAdminHeaderCategories);
router.post('/', authenticate, requireUserType('Admin'), createHeaderCategory);
router.put('/:id', authenticate, requireUserType('Admin'), updateHeaderCategory);
router.delete('/:id', authenticate, requireUserType('Admin'), deleteHeaderCategory);

export default router;
