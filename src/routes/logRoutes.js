import { Router } from 'express';
import { logsForm } from '../controllers/logController.js';
import { exigirAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/logs', exigirAdmin, logsForm);

export default router;
