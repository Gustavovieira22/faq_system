import { Router } from 'express';
import { atualizarPergunta, listarPerguntas, criarPergunta, perguntaBusca} from '../controllers/perguntaController.js';
import { exigirAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/api/perguntas', listarPerguntas);
router.get('/buscar/perguntas', perguntaBusca);

router.post('/api/perguntas', exigirAdmin, criarPergunta);
router.put('/api/perguntas/:id', exigirAdmin, atualizarPergunta);

export default router;
