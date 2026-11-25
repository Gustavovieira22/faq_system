import { Router } from 'express';
import { atualizarPergunta, buscarPerguntas, deletarPergunta, listarPerguntas, criarPergunta, perguntaBusca, registrarCopia } from '../controllers/perguntaController.js';
import { exigirAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/api/perguntas/busca', buscarPerguntas);
router.get('/api/perguntas', listarPerguntas);
router.get('/buscar/perguntas', perguntaBusca);

//qualquer usuario autenticado pode registrar que copiou uma resposta
router.post('/api/perguntas/:id/copiar', registrarCopia);

router.post('/api/perguntas', exigirAdmin, criarPergunta);
router.put('/api/perguntas/:id', exigirAdmin, atualizarPergunta);
router.delete('/api/perguntas/:id', exigirAdmin, deletarPergunta);

export default router;
