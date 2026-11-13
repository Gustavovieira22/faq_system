import { Router } from 'express';
import { listarVariaveis, variavelForm, criarVariavel, atualizarVariavel, salvarTabelaVariaveis} from '../controllers/variavelControoler.js';
import { exigirAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/api/variavel', exigirAdmin, listarVariaveis);
router.get('/cadastrar/variavel', exigirAdmin, variavelForm);

router.post('/api/variavel', exigirAdmin, criarVariavel);
router.put('/api/variavel/tabela', exigirAdmin, salvarTabelaVariaveis);
router.put('/api/variavel/:id', exigirAdmin, atualizarVariavel);

export default router;
