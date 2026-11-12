import { Router } from 'express';
import { atualizarPergunta, listarPerguntas, criarPergunta, perguntaBusca} from '../controllers/perguntaController.js';

const router = Router();

router.get('/api/perguntas', listarPerguntas);
router.get('/buscar/perguntas', perguntaBusca);

router.post('/api/perguntas', criarPergunta);
router.put('/api/perguntas/:id', atualizarPergunta);

export default router;
