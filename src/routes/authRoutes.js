import { Router } from 'express';
import { login, loginForm, logout } from '../controllers/authController.js';
import { redirecionarSeAutenticado } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/login', redirecionarSeAutenticado, loginForm);
router.post('/login', redirecionarSeAutenticado, login);
router.post('/logout', logout);

export default router;
