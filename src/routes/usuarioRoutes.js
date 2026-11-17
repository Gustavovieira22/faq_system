import { Router } from 'express';
import { alterarMinhaSenha, criarUsuario, excluirUsuario, usuarioForm } from '../controllers/usuarioController.js';
import { exigirAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/usuarios', exigirAdmin, usuarioForm);
router.post('/usuarios', exigirAdmin, criarUsuario);
router.post('/usuarios/:id/excluir', exigirAdmin, excluirUsuario);
router.post('/usuarios/minha-senha', exigirAdmin, alterarMinhaSenha);

export default router;
