import { Router } from 'express';
import { alterarMinhaSenha, criarUsuario, usuarioForm } from '../controllers/usuarioController.js';

const router = Router();

router.get('/usuarios', usuarioForm);
router.post('/usuarios', criarUsuario);
router.post('/usuarios/minha-senha', alterarMinhaSenha);

export default router;
